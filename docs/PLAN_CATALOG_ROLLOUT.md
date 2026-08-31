# Catálogo de planes en MongoDB

Actualización **31-08-2026**: integración local completa, pendiente de despliegue y
verificación con Atlas/MercadoPago. No se modificaron datos productivos ni se
hicieron pagos reales. Esta colección es un **cambio de arquitectura**.

## Modelo

Un documento por `free`, `basic` y `pro`, con la misma estructura:

```json
{
  "name": "pro",
  "label": "Pro",
  "description": "Máximo control",
  "price": 49999,
  "discountPrice": null,
  "currency": "ARS",
  "periodMultipliers": { "1": 1, "3": 2.7, "6": 5, "12": 9 },
  "features": {
    "menu_editor": true,
    "qr": true,
    "pedido_whatsapp": true,
    "landing_page": true,
    "sin_publicidad": true,
    "carga_masiva_excel": true,
    "programacion_productos": true,
    "menu_pdf": true,
    "estadisticas": true,
    "item_limit": null,
    "templateIds": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
  }
}
```

Ejemplo de la semilla inicial, no de una lectura de producción.

- `features` es obligatorio y explícito: **no hay herencia** entre planes.
- `item_limit`: entero positivo o `null` para ilimitado. Reducirlo no elimina
  productos existentes; bloquea altas que excedan el máximo.
- `templateIds`: lista no vacía, sin duplicados, de diseños implementados (1–15).
  Al retirar un diseño en uso, la API muestra el primero permitido sin borrar
  la selección guardada del usuario.
- ARS enteros hasta 100.000.000; Free siempre cero. Promoción nullable o positiva
  y menor al precio regular. No hay dominios propios ni reseñas integradas.
- `name` único/inmutable; `updatedBy`, timestamps y `__v` registran autor, fecha y
  versión actual. No constituyen un historial completo de revisiones.

## Inicio y compatibilidad

`app.js` espera `connectDB()` e `initializePlans()` antes de escuchar conexiones.
La inicialización crea el índice único y usa `$setOnInsert` para planes faltantes.
Las semillas mantienen Free 0, Basic 29.999 y Pro 49.999, límites 15/50/ilimitado y
1/5/15 diseños. **Nunca son precios de respaldo** si falla MongoDB.

Solo los documentos legados que no tienen `features` reciben el objeto inicial
correspondiente y un incremento de `__v`. Se preservan precios y promociones.
Un objeto parcial o inválido no se corrige silenciosamente: impide iniciar la API.
Revisar/resguardar los documentos existentes antes del primer despliegue.

## API y administración

- `GET /api/plans`: lectura pública, features y `periodMultipliers` guardados, `version` y opciones de
  facturación calculadas. `Cache-Control: no-store`.
- `GET /api/admin/plans`: lectura con `protect + isAdmin`.
- `PATCH /api/admin/plans/:name`: requiere `price`, `discountPrice`, `label`,
  `description`, `features` completo y `version`; rechaza campos desconocidos.
  Acepta también `periodMultipliers` completo. Si se omite, conserva el mapa guardado
  para permitir ediciones desde clientes anteriores sin restablecer descuentos.
- `/admin/plans`: editor por plan desde **Planes** del panel CEO. Permite editar
  también los beneficios de Free, manteniendo su precio fijo en cero. Incluye
  totales, validación, deshacer y conflicto 409 con recarga explícita.

Los multiplicadores se editan por plan en **Multiplicadores por período**. El de
un mes permanece en `1`, porque representa el precio mensual base. Los de 3/6/12
admiten decimales mayores que cero y hasta la cantidad de meses correspondiente;
el formulario acepta coma o punto decimal. Cada período pago debe dar al menos
un peso tras redondear. La vista previa combina precio/promoción y multiplicadores
sin modificar lo publicado hasta guardar. Deshacer y recargar tras un conflicto
también restauran estos campos.

Por ejemplo, cambiar el factor de tres meses de `2.7` a `2.5` hace que el total
pase a `round(precioMensualVigente × 2.5)`. El cambio incrementa `version` y exige
reconfirmar cotizaciones abiertas con la versión anterior, igual que un cambio de
precio. No modifica snapshots existentes ni se restablece al reiniciar la API.

Los IDs, períodos disponibles (1/3/6/12) y orden de upgrade siguen siendo reglas
técnicas; no se crean ni eliminan planes ni períodos desde el panel.

Usar el editor admin para modificar el catálogo: incrementa `__v` con concurrencia
optimista. Una edición directa en Atlas debe respetar el esquema e incrementar
`__v` de forma atómica; MongoDB no lo hace automáticamente.

## Cobro y permisos

Registro pago, upgrade y renovación usan `getCheckoutQuote()`:
`round((discountPrice ?? price) × periodMultiplier)`. El importe enviado por un
cliente nunca determina el cobro. El frontend envía `planVersion`; si falta o
cambió, recibe 409 `PLAN_PRICE_CHANGED` **antes** de crear una preferencia o un
registro pendiente. La UI recarga y requiere otro clic de confirmación.
Los clientes antiguos sin versión deben recargar la aplicación.

`PaymentCheckout` guarda `planVersion` y snapshots inmutables de importe, moneda,
plan y período. Los cambios no recalculan compras/checkouts anteriores; el webhook
sigue acreditando por snapshot. No hay renovación automática.

`requireFeature()` y los controllers consultan el plan efectivo en MongoDB,
reutilizando la lectura solo dentro de esa petición. Un plan vencido usa Free.
Excel, PDF, programación, estadísticas, editor, límites y diseños se validan en
el servidor. La API pública devuelve features para publicidad, landing y pedidos.
QR y carrito son controles de UI; no impiden compartir una URL pública fuera de
MenuDigital.

**Los beneficios nuevos afectan a todos los usuarios del plan en su próxima
consulta, incluidos quienes ya pagaron.** El editor lo advierte antes de guardar.
No hay beneficios congelados por compra ni actualización por notificaciones en
vivo: una pantalla abierta cambia al recargar o volver a consultar.

Landing, registro, modal de suscripción, dashboard, paywalls y selector de diseños
consumen el catálogo. Ante error no se inventan precios: se bloquea el inicio de
pago y se ofrece reintentar. `config/plans.js` conserva únicamente identificadores,
orden técnico, validadores y resolución de plan efectivo.

## Verificación local

Frontend: typecheck, lint y build pasan. Backend: 117/119 pasan, con los dos
fallos previos de editItem; catálogo/cotización/gating: 36/36. Diff sin errores.

Pruebas backend: cotización dinámica 1/3/6/12 meses, promociones, snapshots,
versiones viejas, catálogo caído, modelo y permisos independientes. Persistencia
simulada con mocks; no demuestra índices o migraciones reales en Atlas.

La revisión de navegador utiliza una API aislada, controladores reales del
catálogo y almacenamiento en memoria. Comprueba cambios guardados y reflejados
en las pantallas sin tocar precios reales. Ver resultados y las dos regresiones
previas de `editItem` en el [README](../README.md).

## Despliegue pendiente

1. Revisar/resguardar catálogo existente y publicar backend: comprobar conexión,
   índice, semillas/completado legado y validación antes de `listen`.
2. Verificar lectura pública y permisos HTTP reales: sin JWT 401, no admin 403.
3. Publicar frontend; comprobar registro, renovación y administración; recargar
   pestañas antiguas. No alterar precios productivos solo para probar.
4. En entorno de pruebas, verificar persistencia, cambios entre pestañas, rechazo
   409 de cotización vieja y recuperación de un catálogo indisponible.
5. Validar con autorización un pago real: preferencia, webhook firmado, snapshot,
   plan/vigencia, CRM y regreso al dashboard.

**PAY-05 sigue separado:** registro configura siete días de vigencia de preferencia;
upgrade/renovación aún no envían expiración explícita y `PaymentCheckout` no guarda
`preferenceExpiresAt`. No borrar auditoría con TTL ni rechazar un pago realmente
aprobado solo porque su webhook llegó tarde.

Contexto: [arquitectura](../ARCHITECTURE.md), [blueprint](../BLUEPRINT.md) y
[dev log backend](../../menu-digital-backend/DEVLOG-LUCAS.md).
