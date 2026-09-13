# Revisión de apoyo al rediseño CEO

Fecha: 2026-09-13. Revisión de código local para coordinar con Claude Code.
Base inspeccionada: frontend `9a633ee`, backend `050944a`. El frontend empezó a recibir cambios durante la revisión; esto no es una aprobación del rediseño terminado.

## Componentes y datos disponibles

- `src/components/Admin/Panel/CEODashboard.tsx`: consume `/admin/stats`, `/sellers/crm/summary` y `/admin/payments` mediante los clientes existentes. Conserva resultados parciales cuando falla una fuente.
- `src/components/Admin/Panel/AdminLayout.tsx`: sidebar colapsable, tema claro/oscuro y navegación móvil. Cambiarlo afecta también Pagos, Planes y Vendedores. Los enlaces CRM apuntan a `/sellers/crm`.
- `src/components/Common/DataTable/DataTable.tsx`: tabla reutilizable.
- `src/styles/globals.css`: tokens compartidos; estilos exclusivos en los CSS Modules existentes. `src/lib/dates.ts` contiene `formatDateAR`.

| Elemento del diseño | Datos actuales y límites |
| --- | --- |
| KPI de clientes, cuentas habilitadas, cartas publicadas y productos | `/admin/stats`. `active` significa cuenta habilitada; no demuestra uso reciente. |
| Donut de planes | `planBreakdown` y `totalClients` de `/sellers/crm/summary`. Usar el plan efectivo entregado por el servidor. |
| Clientes recientes | `recentClients`: hasta cinco altas, con negocio, plan efectivo y estado. |
| Alertas operativas | `attentionSummary`: pagos, vencimientos, seguimientos y onboarding. Son contadores, no un historial global de notificaciones. |
| Importe de suscripciones | `summary.appliedAmount` de `/admin/payments`: suma acumulada de pagos con `status: approved` y `entitlementStatus: applied`. No representa ingreso mensual, ganancia neta ni MRR. No descuenta comisiones y la suma no resta `refundedAmount`. |
| Tendencias y gráfico de área por período | Estos endpoints no entregan series temporales ni comparación con el período anterior. Requieren definir y agregar datos en backend; no derivarlos de las cinco filas recientes. |
| Pedidos e ingresos de restaurantes | El carrito arma un enlace WhatsApp en `CartDrawer.tsx` y `src/lib/whatsapp.ts`. Ese envío no acredita pedido confirmado, venta ni cobro. |

`NotificationProvider` gestiona avisos temporales de UI en memoria; no es una bandeja persistente. Una bandeja con leído/no leído y persistencia implicaría un cambio de arquitectura que debe plantearse por separado. Para este rediseño se pueden reutilizar las alertas operativas existentes.

## Hallazgo reproducido: límite mensual dependiente del servidor

En el backend, `src/controllers/crmController.js:570`, `getCrmSummary` calcula:

```js
const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
```

Esto usa el huso horario del proceso. Para el instante `2026-10-01T01:00:00Z` (30/09 a las 22:00 en Buenos Aires), un proceso UTC empieza octubre y excluye las altas de septiembre; un proceso en Buenos Aires sigue contando septiembre. Reproducción local realizada con ambos valores de `TZ`. No se verificó el TZ del despliegue.

Propuesta puntual: calcular el inicio del mes de Buenos Aires en el servidor usando las convenciones de fechas existentes y agregar una prueba del cambio de mes. El formateador del frontend no corrige el conteo recibido. Hallazgo previo al rediseño; no se modificó código funcional.

## Estado del trabajo y validación

- Durante la revisión apareció un diff en `CEODashboard.tsx` que reemplaza barras por un donut con `conic-gradient` y tokens de planes. Los porcentajes proceden de datos reales. Es un cambio en curso, pendiente de revisar junto con su CSS final.
- Antes de ese diff pasaron 12 pruebas frontend de fechas/horarios, typecheck y lint.
- Pasaron 36 pruebas backend seleccionadas de horarios, última conexión, CRM, perfil, resumen de usuario, administración y pagos; usan mocks locales.
- Las pruebas previas no validan los cambios posteriores de Claude. Quedan pendientes validación final del diff, build, navegador autenticado, responsive y accesibilidad sobre el diseño terminado.
- Esta revisión no modificó componentes, backend, commits ni despliegues. El único archivo creado por Codex es este documento.

## Próxima revisión del rediseño

Revisar el diff terminado contra este mapa, conservar estados de carga/error/datos vacíos, validar navegación de todos los módulos afectados y comprobar el donut con cero clientes, una sola categoría y fallo del CRM. Verificar contraste en ambos temas y lectura accesible de los valores.
