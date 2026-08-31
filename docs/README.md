# MenuDigital — Frontend

Frontend de **MenuDigital**, SaaS argentino de cartas digitales para bares y
restaurantes. Está construido con React 19, TypeScript y Vite, y se despliega en
Vercel.

Revisión documental: **31-08-2026**, contra el código local de ambos repositorios.
No implica que los cambios locales estén desplegados.

Actualización **31-08-2026**: catálogo MongoDB conectado a precios, features,
checkout y permisos. `/admin/plans` permite administrarlo. Dominio propio y reseñas
integradas siguen fuera del alcance; Maps por dirección se mantiene.
Estos cambios son locales: no se consultó Atlas ni se desplegó.

## Mapa de documentación

Los cuatro documentos principales viven en `docs/` del frontend:

- **Este README**: entrada al proyecto, desarrollo local y validación vigente.
- [ARCHITECTURE.md](ARCHITECTURE.md): arquitectura técnica y recorrido archivo por
  archivo de frontend y backend.
- [BLUEPRINT.md](BLUEPRINT.md): producto, negocio, pricing, roadmap y criterios de
  aceptación.
- [RESUMEN_EJECUTIVO.txt](RESUMEN_EJECUTIVO.txt): guía comercial para vendedores;
  es un documento principal aunque su extensión sea `.txt`.

Documentos complementarios, referenciados pero fuera de ese núcleo:

- [Catálogo de planes](PLAN_CATALOG_ROLLOUT.md): guía operativa vigente, modelo y
  checklist de despliegue pendiente.
- [Design QA](design-qa.md): evidencia histórica del editor y diferencias con el
  código actual; no certifica una nueva prueba visual.
- [Dev log del backend](../../menu-digital-backend/DEVLOG-LUCAS.md): historial
  técnico con un resumen de estado local; requiere ambos repositorios como
  carpetas hermanas.

Fuera de Markdown, [ARCHITECTURE.html](ARCHITECTURE.html) es una copia histórica
de la arquitectura y [REVISION_TECNICA_SEGURIDAD_Y_PENDIENTES.txt](REVISION_TECNICA_SEGURIDAD_Y_PENDIENTES.txt)
conserva una auditoría del 27-08-2026. Son candidatos a archivo histórico, no fuentes
del estado vigente. No se eliminaron ni movieron durante esta revisión.

La aplicación, los scripts y el build no consumen estos documentos. Eso no implica
que estén sin uso: sirven para desarrollo, operación o venta. Los tres Markdown
complementarios tienen referencias desde la documentación principal. El informe
técnico `.txt` no tenía referencias entrantes antes de incorporarlo a este índice.
Las excepciones de `.gitignore` permiten versionar README y ARCHITECTURE en `docs/`.
No hay README en la raíz; este archivo es la entrada documental actual.

## Aplicaciones incluidas

- Landing comercial y registro (`/`, `/register`, `/register/plans`).
- Panel del dueño (`/dashboard`, editor de menú, negocio y estadísticas).
- Panel CEO, CRM, pagos y planes (`/admin`, `/admin/crm`, `/admin/payments`, `/admin/plans`).
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
Ver el [modelo y guía del catálogo](PLAN_CATALOG_ROLLOUT.md).

Antes de liberar cambios de pagos, verificar deploys y configuración de ambiente,
y validar con autorización el circuito preferencia → Checkout Pro → webhook
firmado → `PaymentCheckout`/`PaymentTransaction` → plan/vencimiento → dashboard.
Esta revisión no consultó Atlas, Koyeb ni Vercel ni realizó pagos reales. Sigue
pendiente PAY-05: registro configura vencimiento de preferencia; upgrade/renovación
todavía no lo hacen. El historial admin de pagos es de solo lectura, sin reembolsos
ni acreditaciones manuales.

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

Verificación técnica repetida el 31-08-2026 durante la revisión documental:

- Frontend: `npm run typecheck`, `npm run lint` y `npm run build` **pasan**.
- Backend: **117/119 tests pasan**; las 36 pruebas de catálogo, cotización y
  gating dinámico pasan.
- `git diff --check` pasa en ambos repositorios.
- Dos regresiones previas de `editItem` sobre `available`/`hidden` siguen fuera de
  este cambio; no fueron corregidas ni ocultadas.
- Navegador con API simulada durante la integración previa: edición de Pro, landing, registro, dashboard, totales por período,
  conflicto de precio con reconfirmación, estadísticas desactivadas, template
  retirado y recuperación tras un error de catálogo.
  No prueba persistencia real ni producción; esta revisión documental no repitió
  esas interacciones. Para el nuevo editor de multiplicadores se comprobó validación,
  deshacer y vista previa; el guardado se cubrió con tests de backend, sin completar
  una nueva prueba de guardado desde el navegador.
- No hay script de tests automatizados frontend. Falta E2E con backend real,
  Atlas/MercadoPago y verificación de despliegue antes de publicar.

## Convenciones

- CSS Modules por componente.
- Tokens y utilidades compartidas en `src/styles/globals.css`.
- Prefijos de tokens: `--admin-*`, `--auth-*` y `--t-*`.
- Los cambios de planes deben mantenerse sincronizados con el backend.
- No se confía en el frontend para gating, precios de cobro ni activación de pagos.
