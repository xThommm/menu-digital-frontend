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

> **PRÓXIMO PASO OBLIGATORIO — antes de cualquier otro desarrollo:** validar el
> circuito completo con un pago real de importe bajo y una cuenta compradora distinta
> de la vendedora: preferencia → Checkout Pro → webhook → plan/vencimiento en MongoDB
> → regreso al dashboard. Los tests automatizados del webhook pasan, pero esta prueba
> end-to-end todavía no fue realizada.

Los cambios de suscripciones descriptos abajo están implementados en el workspace;
quedan pendientes de deploy y validación real antes de considerarlos cerrados en
producción.

Los usuarios existentes administran su suscripción desde la tarjeta **“Tu plan”** del
dashboard. Free puede subir a Basic/Pro; Basic puede renovar o subir a Pro; Pro puede
renovar. El selector compartido ofrece 1/3/6/12 meses, muestra total/ahorro y el
backend recalcula el importe. El vencimiento se muestra en el dashboard y se
sincroniza en `AuthContext` al volver de MercadoPago.

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
