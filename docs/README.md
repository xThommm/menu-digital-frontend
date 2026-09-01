# MenuDigital — Frontend

Frontend de **MenuDigital**, SaaS argentino de cartas digitales para bares y
restaurantes. Está construido con React 19, TypeScript y Vite, y se despliega en
Vercel.

Revisión documental: **01-09-2026**, contra el código local de ambos repositorios.
No implica que los cambios locales estén desplegados.

Actualización **01-09-2026**: el catálogo MongoDB continúa conectado a precios,
features, checkout y permisos. El descuento de `discountPrice` queda reservado al
alta paga cuyo código resuelve un `sellerID`; sin vendedor se conserva el precio de
lista. `editItem` ya persiste y valida `available`, `hidden` y `recommended`. La
suite backend pasa **126/126** y el frontend pasa typecheck, lint y build. Esta
intervención no realizó un E2E real con MercadoPago, Atlas o Cloudinary ni verificó
los deploys.

## Mapa de documentación

Los documentos principales vigentes viven en `docs/` del frontend:

- **Este README**: entrada al proyecto, desarrollo local y validación vigente.
- [ARCHITECTURE.md](ARCHITECTURE.md): arquitectura técnica y recorrido archivo por
  archivo de frontend y backend.
- [BLUEPRINT.md](BLUEPRINT.md): producto, negocio, pricing, roadmap y criterios de
  aceptación.
- [RESUMEN_EJECUTIVO.txt](RESUMEN_EJECUTIVO.txt): guía comercial para vendedores;
  es un documento principal aunque su extensión sea `.txt`.

Como documento complementario se mantiene el
[dev log del backend](../../menu-digital-backend/DEVLOG-LUCAS.md): historial
  técnico con un resumen de estado local; requiere ambos repositorios como
  carpetas hermanas.

Fuera de Markdown, [ARCHITECTURE.html](ARCHITECTURE.html) es una copia histórica
de la arquitectura, no la fuente del estado vigente. `PLAN_CATALOG_ROLLOUT.md`,
`design-qa.md` y `REVISION_TECNICA_SEGURIDAD_Y_PENDIENTES.txt` están eliminados en
el working tree y no se restauraron durante esta revisión.

La aplicación, los scripts y el build no consumen estos documentos. Eso no implica
que estén sin uso: sirven para desarrollo, operación o venta.
Las excepciones de `.gitignore` permiten versionar README y ARCHITECTURE en `docs/`.
No hay README en la raíz; este archivo es la entrada documental actual.

## Aplicaciones incluidas

- Landing comercial y registro (`/`, `/register`, `/register/plans`).
- Panel del dueño (`/dashboard`, editor de menú, negocio y estadísticas).
- Panel CEO, CRM, pagos, planes y vendedores (`/admin`, `/admin/crm`,
  `/admin/payments`, `/admin/plans`, `/admin/sellers`).
- Landing y carta pública multi-tenant (`/:slug`, `/:slug/menu`).

## Planes y registro

La landing muestra Free, Basic y Pro directamente, sin popup. Cada tarjeta conserva
el plan elegido mediante `?plan=<id>`:

- **Free:** completa el formulario, crea la cuenta, inicia sesión y entra al
  dashboard.
- **Basic/Pro:** completa el formulario, confirma el período, crea una preferencia de
  MercadoPago y espera que el webhook del backend cree la cuenta. Al acreditarse,
  inicia sesión y redirige al dashboard.

El gating de límites y funcionalidades se valida siempre en el backend. El frontend
solo refleja el plan efectivo.

La colección `plans` centraliza precios, promociones, períodos y `features`:
booleanos, `item_limit` y `templateIds`, con la misma estructura en Free/Basic/Pro.
El backend consulta MongoDB para cotizar y validar permisos; el frontend muestra
ese catálogo, sin precios de respaldo ante un error. Las semillas iniciales son
Free $0, Basic $29.999 y Pro $49.999 ARS, pero no reemplazan valores administrados.
No hay renovación automática: se prepagan 1/3/6/12 meses.

**Administración → Planes** permite editar precios, multiplicadores para 3/6/12
meses, nombres, descripciones y beneficios. El factor de un mes es 1 y se cambia
su importe mediante el precio mensual. Los cambios de beneficios alcanzan a los
usuarios existentes en su próxima consulta. Los precios nuevos se aplican a nuevos
checkouts; los anteriores conservan su snapshot. Una versión desactualizada se
rechaza con 409 y exige reconfirmación.

**Administración → Vendedores** lista, crea y edita vendedores con nombre y DNI
únicos; el backend genera un código `AAA-999`. En el alta paga el código se valida
de nuevo en servidor: solo si resuelve un vendedor aplica `discountPrice ?? price`
y guarda `sellerID` en el registro pendiente y en el usuario creado. Sin `sellerID`
usa el precio regular. La vista muestra clientes vendidos,
planes pagos vigentes, altas recientes, vencimientos próximos, distribución
Basic/Pro, menú creado y última alta. El detalle de cada vendedor lista sus clientes
y enlaza sus fichas de CRM y pagos. No calcula comisiones, conversión ni facturación
histórica: el checkout/transacción todavía no conserva un snapshot inmutable del
vendedor que permita auditarlas.

Antes de liberar cambios de pagos, verificar deploys y configuración de ambiente,
y validar con autorización el circuito preferencia → Checkout Pro → webhook
firmado → `PaymentCheckout`/`PaymentTransaction` → plan/vencimiento → dashboard.
Esta intervención no consultó Atlas, Koyeb ni Vercel ni realizó pagos reales. El E2E
del alta y sus siete días fue informado por el responsable del producto, no
reproducido acá ni tomado como validación del Git actual. Sigue pendiente PAY-05:
el checkout no conserva una ventana inmutable de siete días y los reintentos de
registro pueden recalcularla; upgrade/renovación tampoco envían la expiración
explícita. El historial admin de pagos es de solo lectura, sin reembolsos ni
acreditaciones manuales.

Los usuarios existentes administran su suscripción desde la tarjeta **“Tu plan”** del
dashboard. Free puede subir a Basic/Pro; Basic puede renovar o subir a Pro; Pro puede
renovar. El selector compartido ofrece 1/3/6/12 meses, muestra total/ahorro y el
backend recalcula el importe. El vencimiento se muestra en el dashboard y se
sincroniza en `AuthContext` al volver de MercadoPago.

## Desarrollo local

Requisitos: Node.js `^20.19.0` o `>=22.12.0` (contrato del Vite instalado), npm y el
backend configurado según su `.env.example`, ejecutándose en el puerto 5000.
Definir `VITE_API_URL=/api` en `.env` antes de iniciar el frontend. No
versionar credenciales.

```bash
npm ci
npm run dev
```

Vite proxifica `/api` hacia `http://localhost:5000`. `vercel.json` declara un
rewrite de `/api` a Koyeb y un fallback SPA a `index.html`. Algunas pantallas usan
`/api` directamente y otras `VITE_API_URL`: cambiar solo esa variable no redirige
todas las peticiones. Para otro backend hay que alinear también proxy/rewrite.

## Verificaciones

```bash
npm run typecheck
npm run lint
npm run build
```

Resultado reproducido el 01-09-2026:

- Frontend: `npm run typecheck`, `npm run lint` y `npm run build` pasan. Para
  completar la validación se restauró en `node_modules` la versión de `lucide-react`
  ya declarada en `package.json` y lockfile, sin cambios rastreados de dependencias.
- Backend: `npm test` pasa **126/126**. La cotización usa precio regular para
  catálogo, upgrade y renovación, y reserva `discountPrice` al alta con vendedor
  validado. `editItem` persiste y exige booleanos en `available`, `hidden` y
  `recommended`.
- `sellerController.test.js` pasa **6/6**: métricas, plan efectivo, ventanas de 30
  días, DTO acotado, agrupación, lista vacía, 404 y error genérico. La cotización
  con código y los siete días adicionales del webhook tienen cobertura automatizada
  local, pero no sustituyen el E2E real.
- `git diff --check` pasa en ambos repositorios.
- Navegador con API simulada durante la integración previa: edición de Pro, landing, registro, dashboard, totales por período,
  conflicto de precio con reconfirmación, estadísticas desactivadas, template
  retirado y recuperación tras un error de catálogo.
  No prueba persistencia real ni producción; esta revisión documental no repitió
  esas interacciones. Para el nuevo editor de multiplicadores se comprobó validación,
  deshacer y vista previa; el guardado se cubrió con tests de backend, sin completar
  una nueva prueba de guardado desde el navegador.
- No hay script de tests automatizados frontend. Antes de publicar hay que incorporar
  esa cobertura, validar una instalación limpia y recién después ejecutar E2E con
  backend real, Atlas/MercadoPago/Cloudinary y verificación de despliegue.

### Bloqueos de producción detectados

Aunque las verificaciones locales pasan, el estado auditado no es un candidato de
producción hasta corregir y volver a validar estos puntos:

- `Item.image` admite valores arbitrarios y la plantilla PDF los inserta en HTML sin
  validar ni escapar el atributo. El Chrome headless puede ejecutar una inyección de
  atributo o solicitar una URL controlada (SSRF).
- El alta paga comprueba `acceptedTerms` por truthiness y solo exige longitud mínima
  de contraseña; no aplica la validación estricta y el bloqueo de contraseñas comunes
  del alta Free.
- El modelo de productos acepta precios negativos.
- La auditoría de dependencias reporta 8 vulnerabilidades en frontend (7 altas y 1
  moderada) y 4 de runtime en backend (2 altas, 1 moderada y 1 baja).
- PAY-05 sigue pendiente y no se hizo E2E real de pagos ni verificación de los
  despliegues.

## Convenciones

- CSS Modules por componente.
- Tokens y utilidades compartidas en `src/styles/globals.css`.
- Prefijos de tokens: `--admin-*`, `--auth-*` y `--t-*`.
- Los cambios de planes deben mantenerse sincronizados con el backend.
- No se confía en el frontend para gating, precios de cobro ni activación de pagos.
