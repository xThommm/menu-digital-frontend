# MenuDigital — Frontend

Frontend de **MenuDigital**, SaaS argentino de cartas digitales para bares y
restaurantes. Está construido con React 19, TypeScript y Vite, y se despliega en
Vercel.

La documentación completa está separada en:

- [ARCHITECTURE.md](ARCHITECTURE.md): arquitectura técnica y recorrido archivo por
  archivo de frontend y backend.
- [BLUEPRINT.md](BLUEPRINT.md): producto, negocio, pricing, roadmap y criterios de
  aceptación.

## Aplicaciones incluidas

- Landing comercial y registro (`/`, `/register`, `/register/plans`).
- Panel del dueño (`/dashboard`, editor de menú, negocio y estadísticas).
- Panel CEO y CRM interno (`/admin`, `/admin/crm`).
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

> Estado al 20-08-2026: el circuito gratuito está listo. El alta paga tiene un
> incidente productivo abierto: `crear-preferencia-registro` responde 500 en Koyeb.
> Falta revisar el log interno del servicio para identificar si falla la persistencia
> del registro pendiente o la creación de la preferencia en MercadoPago.

## Desarrollo local

Requisitos: Node.js `^20.19.0` o `>=22.12.0`, y el backend ejecutándose en el
puerto 5000.

```bash
npm install
npm run dev
```

Vite proxifica `/api` hacia `http://localhost:5000`. Para consumir otro backend,
definir `VITE_API_URL` con la base completa de la API, por ejemplo
`https://servidor.example/api`.

## Verificaciones

```bash
npm run typecheck
npm run lint
npm run build
```

## Convenciones

- CSS Modules por componente.
- Tokens y utilidades compartidas en `src/styles/globals.css`.
- Prefijos de tokens: `--admin-*`, `--auth-*` y `--t-*`.
- Los cambios de planes deben mantenerse sincronizados con el backend.
- No se confía en el frontend para gating, precios de cobro ni activación de pagos.
