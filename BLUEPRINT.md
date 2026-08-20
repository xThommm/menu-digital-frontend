# MenuDigital — Startup Blueprint v2

> **Cómo leer este documento.** Es el plan integral de la startup: mercado, producto
> (PRD), arquitectura, datos, APIs, seguridad, UX/design system, modelo de negocio,
> roadmap, KPIs, growth y backlog priorizado. A diferencia de un blueprint teórico,
> está anclado en un producto **que ya existe y funciona en producción**: todo lo
> marcado ✅ está construido y desplegado hoy; lo marcado 🔜 es plan. El detalle
> archivo-por-archivo del código vive en [ARCHITECTURE.md](ARCHITECTURE.md) — acá no
> se repite, se referencia.

---

## Índice

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Visión y tesis](#2-visión-y-tesis)
3. [Investigación de mercado](#3-investigación-de-mercado)
4. [PRD — Product Requirements Document](#4-prd--product-requirements-document)
5. [Arquitectura técnica](#5-arquitectura-técnica)
6. [Base de datos](#6-base-de-datos)
7. [APIs](#7-apis)
8. [Seguridad](#8-seguridad)
9. [UX/UI y Design System](#9-uxui-y-design-system)
10. [Modelo de negocio](#10-modelo-de-negocio)
11. [Roadmap](#11-roadmap)
12. [KPIs y analítica](#12-kpis-y-analítica)
13. [Growth](#13-growth)
14. [Backlog priorizado (RICE)](#14-backlog-priorizado-rice)
15. [Riesgos y mitigaciones](#15-riesgos-y-mitigaciones)
16. [Referencias](#16-referencias)

---

## 1. Resumen ejecutivo

**MenuDigital** es un SaaS argentino para bares, cafés y restaurantes que convierte
la carta del local en una presencia digital completa: menú QR con 13 templates de
diseño, landing page propia, pedidos por WhatsApp con carrito, embudo de reseñas de
Google, estadísticas de visitas y de productos más vistos, y un panel de gestión
mobile-first con importación/exportación por Excel.

- **Estado**: producto en producción (`menudigitalapp.com.ar`), stack React 19 +
  Express + MongoDB Atlas, deploy en Vercel + Koyeb, cobro por MercadoPago.
- **Modelo**: freemium por suscripción. Free ($0, hasta 15 productos) → Basic
  ($5.999/mes base) → Pro ($29.999/mes base), con descuentos por prepagar
  3/6/12 meses. Sin comisiones por venta.
- **Mercado**: ~67.000 establecimientos gastronómicos en Argentina (FEHGRA). Sector
  golpeado por la caída del consumo (−13% de actividad feb-2025 vs feb-2023), lo que
  paradójicamente **acelera** la demanda de herramientas baratas que ayuden a vender
  más sin sumar personal.
- **Diferenciación**: mientras la competencia local compite por "carta QR gratis",
  MenuDigital compite por **hacer vender más al local**: pedidos por WhatsApp sin
  fricción, reseñas de Google que mejoran el ranking local, analítica por plato para
  decidir el menú con datos, y una calidad visual (13 templates con design system
  propio) que las soluciones gratuitas no alcanzan.
- **Próximo salto** (roadmap): cobro de pedidos online con **MercadoPago Connect**
  (cada local cobra en su propia cuenta; la plataforma puede tomar un fee por
  transacción), panel de pedidos en tiempo real, y capa de IA (descripciones de
  platos, insights automáticos).

**North star metric**: pedidos generados a los locales por la plataforma (WhatsApp
hoy, pagos online mañana). Si los locales venden gracias a MenuDigital, el churn se
desploma y el pricing se defiende solo.

---

## 2. Visión y tesis

**No vendemos un menú QR: construimos el sistema operativo comercial del local
gastronómico chico.**

La tesis, en tres partes:

1. **El QR es la puerta de entrada, no el producto.** La carta digital es un
   commodity (hay decenas gratis). Lo que el dueño de un café de barrio no tiene es:
   presencia digital decente, un canal de pedidos ordenado, reseñas que lo hagan
   aparecer en Google Maps, y datos para decidir qué vender. Eso es lo que se cobra.
2. **El segmento desatendido es el local chico e independiente.** Los POS grandes
   (Toast, Square a nivel global; Maxirest/Fudo acá) apuntan al restaurante
   establecido con staff y hardware. El café de especialidad, la pizzería de barrio
   y la cervecería artesanal necesitan algo que se configure en una tarde desde el
   celular, sin hardware, sin capacitación y a precio de "dos cafés por mes".
3. **La distribución es local y por confianza.** En gastronomía argentina las
   herramientas se adoptan por recomendación entre colegas, no por ads. El producto
   tiene viralidad estructural: cada carta pública es una demo con la marca de la
   plataforma (el plan Free incluye publicidad de MenuDigital — es marketing pagado
   por el usuario gratuito).

**Principios de producto** (se cumplen hoy y ordenan el roadmap):

- Mobile-first radical: el dueño gestiona todo desde el teléfono; el comensal nunca
  instala nada.
- Cero fricción para el comensal: la carta pública no pide login, carga rápido y el
  pedido sale por el canal que ya usa (WhatsApp).
- El gating por plan se valida **siempre** en el servidor; la UI solo lo refleja.
- Sin comisiones ocultas: suscripción plana. (Cuando llegue el cobro online, el fee
  por transacción será explícito y opcional.)

---

## 3. Investigación de mercado

### 3.1 Contexto

- **Universo**: FEHGRA agrupa ~84.000 empresas del sector hotelero-gastronómico en
  Argentina, de las cuales **~67.000 son establecimientos gastronómicos** (el resto,
  hotelería).
- **Coyuntura**: el sector viene de dos años de caída (−13% de actividad entre
  feb-2023 y feb-2025; turismo receptivo −23,9% en S1-2025). Cierres y reconversión
  son la norma. Implicancia directa para MenuDigital: (a) el presupuesto de software
  del local es chico y sensible al precio — el freemium importa; (b) la promesa que
  vende no es "modernizate", es **"vendé más con lo que ya tenés"**.
- **Vientos de cola estructurales**: el QR quedó instalado culturalmente desde la
  pandemia; WhatsApp es el canal comercial de facto de las pymes argentinas;
  MercadoPago es el rail de pagos dominante; la búsqueda "cerca mío" en Google Maps
  define tráfico real a los locales (las reseñas son SEO local).

### 3.2 TAM / SAM / SOM

Supuestos explícitos (revisables): ARPU pago promedio ≈ $5.000 ARS/mes
(≈ $60.000/año) a precios de julio 2026.

| Capa | Definición | Tamaño | Valor anual potencial |
|---|---|---|---|
| **TAM** | Establecimientos gastronómicos de Argentina | ~67.000 locales | ~$4.000M ARS/año |
| **SAM** | Locales independientes con dueño operativo digital-friendly (excluye cadenas con POS enterprise y locales sin ninguna operación digital), est. 45% | ~30.000 locales | ~$1.800M ARS/año |
| **SOM** (24 meses) | Cuota alcanzable con distribución orgánica + partnerships, 1–3% del SAM | 300–900 locales pagos | $18M–$54M ARS/año |

La expansión natural post-Argentina es LATAM hispanohablante (mismo idioma, mismos
rails: WhatsApp + MercadoPago en AR/UY/CL/MX), pero no entra en el horizonte de este
blueprint.

### 3.3 Dolores del cliente (validados por diseño del producto)

1. **"Cambiar el precio de la carta es un drama"** → edición desde el celular en
   segundos; carga masiva por Excel para menús grandes.
2. **"Los pedidos por WhatsApp son un caos de mensajes"** → carrito que arma el
   mensaje completo y ordenado (producto × cantidad, variante, total).
3. **"No aparezco en Google / no tengo reseñas"** → CTA de reseñas en landing y
   carta, con link directo al perfil de Google Maps.
4. **"No sé qué funciona de mi menú"** → estadísticas de visitas + ranking de
   productos más vistos (ventana 30 días).
5. **"Las soluciones lindas son caras; las gratis son feas"** → 13 templates con
   calidad de diseño real, escalonados por plan.

### 3.4 Competencia

| Competidor | Origen/foco | Modelo | Fortalezas | Debilidades frente a MenuDigital |
|---|---|---|---|---|
| **OlaClick** | LATAM (40k+ locales) | Freemium agresivo (menú QR, pedidos WhatsApp, POS, chatbot IA gratis; planes pagos encima) | Escala, marca regional, POS incluido | Genérico multi-país, poca profundidad local AR; la carta pública es utilitaria, sin identidad visual del local |
| **GloriaFood** (Oracle) | Global | Base gratis + módulos USD (web $9, promos $19, pagos $29, apps $59/mes) | Robustez, reservas y ordering maduros | Precio en USD (letal con el tipo de cambio), sin WhatsApp nativo, UX anticuada, sin foco AR |
| **Pedix** | Argentina | Planes fijos sin comisiones (trial 14 días) | Marca local instalada en tiendas WhatsApp | Es tienda genérica, no gastronomía: sin templates de carta, sin reseñas, sin analítica por plato |
| **lacartaa** | Argentina | Suscripción | Competidor más directo (carta + pedidos WhatsApp + reseñas) | Menor profundidad de producto (sin import Excel, menos templates, sin CRM interno de la plataforma) |
| **Larga cola gratis** (SoyMenu, Recafy, RestoMenu QR, cartadigital.gratis, menudigital.ar) | Argentina | Gratis o casi | Precio | Sin analítica, sin pedidos estructurados, diseño pobre, continuidad dudosa |
| **POS establecidos** (Fudo, Maxirest) | Argentina | Suscripción alta + hardware | Gestión integral (stock, caja, AFIP) | Otro segmento: caros y complejos para el local chico; la carta pública es un accesorio |

**Lectura estratégica**: el mercado está fragmentado con barrera de entrada baja en
"carta QR" y barrera **alta** en la combinación (diseño + pedidos + reseñas +
analítica + precio ARS). La defensa no es ninguna feature suelta sino el paquete y
la velocidad de iteración. OlaClick es la amenaza a vigilar (podría profundizar AR);
GloriaFood pierde por precio en dólares; la larga cola gratis valida la demanda y
educa el mercado a costo cero.

### 3.5 Posicionamiento

> Para el dueño de un local gastronómico chico que quiere vender más sin sumar
> gente, **MenuDigital** es la plataforma que convierte su carta en un canal de
> ventas (QR + landing + pedidos por WhatsApp + reseñas + datos), a diferencia de
> las cartas QR gratuitas (que solo muestran precios) y de los POS tradicionales
> (caros y pensados para otro tamaño de negocio).

---

## 4. PRD — Product Requirements Document

### 4.1 Personas

| Persona | Descripción | Objetivo | Frustración típica |
|---|---|---|---|
| **Dueño/a operativo** (persona primaria) | 30–55 años, atiende su propio local, gestiona todo desde el celular, poco tiempo y paciencia técnica | Vender más; cambiar precios rápido; verse profesional | Herramientas complejas, precios en USD, depender de "el sobrino que sabe de compus" |
| **Comensal** | Cliente del local, cualquier edad, escanea QR en mesa o recibe link por redes | Ver la carta rápido, pedir fácil | Cartas PDF pixeladas, apps que piden registro |
| **Encargado/staff** 🔜 | Empleado de confianza que carga productos y toma pedidos | Operar sin acceso a la facturación | Compartir la contraseña del dueño |
| **CEO de la plataforma** (interno) | Operador del SaaS | Convertir, retener, cobrar | Datos dispersos → por eso el CRM interno ya existe |

### 4.2 Jobs-to-be-done

- *Cuando* un cliente pregunta "¿tenés menú?", *quiero* mandarle un link que cargue
  al instante y se vea profesional, *para* no perder la venta ni la imagen.
- *Cuando* cambia el precio de la harina, *quiero* actualizar 40 precios en minutos,
  *para* no vender a pérdida (job del Excel).
- *Cuando* un cliente quiere pedir, *quiero* recibir un mensaje ordenado con todo el
  pedido, *para* no encadenar 15 audios de WhatsApp.
- *Cuando* alguien salió contento, *quiero* capturar su reseña en el momento, *para*
  subir en Google Maps.
- *Cuando* armo el menú del mes, *quiero* saber qué miran y qué ignoran, *para*
  destacar lo que rinde.

### 4.3 Alcance funcional

#### Módulos en producción ✅

| # | Módulo | Qué hace | Gating |
|---|---|---|---|
| M1 | **Auth y cuentas** | Registro/login JWT, política de contraseñas, términos versionados | — |
| M2 | **Editor de menú** | Secciones → categorías → productos; variantes (options), ofertas con % y vigencia, recomendado, oculto, no disponible; drag & drop; imágenes a Cloudinary | Free: 15 productos |
| M3 | **Carta pública** (`/:slug/menu`) | Tabs por sección, tarjetas con foto/precio/badges, skeleton, scroll-reveal, grilla 2 columnas en desktop, sticky header+tabs | — |
| M4 | **Landing del local** (`/:slug`) | Hero o avatar según template, galería bento, chips de contacto, lightbox | Basic+ |
| M5 | **Templates** | 13 estilos visuales vía design tokens `--t-*` | Escalonado (3 free / 4 basic / 6 pro) |
| M6 | **Carrito + pedido WhatsApp** | Carrito por local (localStorage), steppers, drawer con total, mensaje `wa.me` prearmado, confirmación al vaciar | Todos los planes |
| M7 | **Reseñas Google** | CTA "Dejanos tu reseña" en landing y carta si el dueño cargó el link | Todos los planes |
| M8 | **QR descargable** | PDF con el QR de la carta (client-side) | Todos los planes |
| M9 | **Estadísticas** | Visitas diarias (30 días, tiempo real con polling), ranking top-10 de productos más vistos | Pro+ |
| M10 | **Import/Export Excel** | Plantilla generada con datos actuales, preview de cambios, confirmación fila a fila | Basic+ |
| M11 | **Suscripciones** ⚠️ | Checkout MercadoPago, webhook firmado y alta automática implementados; incidente productivo abierto en la creación de preferencias para altas pagas | — |
| M12 | **Panel CEO + CRM interno** | KPIs de la plataforma, gestión de clientes (pipeline kanban, notas, eventos automáticos, seguimientos vencidos, export Excel) | Solo admin |

#### Módulos del roadmap 🔜 (ver §11)

M13 Cobro de pedidos (MP Connect) · M14 Panel de pedidos en tiempo real · M15 Roles
de staff · M16 IA (contenido + insights) · M17 Reservas · M18 Fidelización/campañas ·
M19 Multi-sucursal · M20 Dominio propio (prometido en Pro — deuda de producto).

### 4.4 Historias de usuario y criterios de aceptación

Formato: historia → criterios (Given/When/Then abreviado). Las de módulos ✅ son la
especificación de lo construido (sirven como base de regresión); las 🔜 definen lo
próximo.

**HU-01 · Alta y primer menú (M1, M2)** ✅
Como dueño, quiero registrarme y publicar mi primera carta en menos de 30 minutos.
- La landing muestra Free/Basic/Pro con precio y features sin abrir un modal; el CTA
  conserva el plan elegido al entrar al formulario.
- Dado un username libre y contraseña válida (≥8, no común), al registrarme entro
  directo al panel con sesión iniciada (JWT 7 días).
- Si no acepto términos, el backend rechaza el alta (400).
- Al crear mi primer producto, la carta pública ya lo muestra sin pasos extra.
- Con plan Free, el producto 16 es rechazado por el servidor (403) y la UI me ofrece
  el upgrade.

**HU-02 · Editar precios rápido (M2)** ✅
Como dueño, quiero cambiar precios desde el celular en segundos.
- Editar el precio de un producto impacta la carta pública inmediatamente después de
  guardar (sin caché intermedia).
- Un precio vacío se muestra como producto "a consultar" (sin precio), no como $0.

**HU-03 · Pedido por WhatsApp (M6)** ✅
Como comensal, quiero armar un pedido y mandarlo por WhatsApp sin registrarme.
- Puedo agregar productos simples con "+" y variantes eligiendo la opción; cada
  variante es una línea separada.
- El carrito persiste si recargo la página (localStorage por slug) y no se mezcla
  entre locales distintos.
- "Pedir por WhatsApp" abre `wa.me` del local con el detalle completo y total; si el
  local no cargó teléfono, veo un aviso en lugar del botón.
- "Vaciar pedido" pide confirmación (acción destructiva).
- En pantallas bajas, la lista del carrito scrollea internamente y el total/checkout
  siempre quedan visibles.

**HU-04 · Variantes y ofertas (M2, M3)** ✅
Como dueño, quiero ofrecer tamaños y ofertas con descuento visible.
- Un producto con `options` muestra "Desde $X" (mínimo entre variantes) y el panel
  de variantes con precio y agregado individual.
- Una oferta muestra precio nuevo + precio anterior tachado + badge "−N%"; el
  producto en oferta se agrega al precio de oferta como ítem simple.

**HU-05 · Reseñas (M7)** ✅
Como dueño, quiero capturar reseñas de clientes contentos.
- Si cargo el link de reseñas (validado `http(s)://` en cliente **y** servidor), la
  landing y el final de la carta muestran el CTA; si lo borro, desaparece.

**HU-06 · Decidir con datos (M9)** ✅
Como dueño Pro, quiero saber cuánto se mira mi carta y qué productos rinden.
- Veo visitas de los últimos 30 días (fechas en huso de Buenos Aires) con
  actualización automática (~45 s con pestaña visible).
- Veo el top-10 de productos por vistas; un producto borrado figura como "(producto
  eliminado)".
- Con plan insuficiente veo el paywall con upgrade directo (el 403 viene del server).

**HU-07 · Carga masiva (M10)** ✅
Como dueño con menú grande, quiero actualizar todo en Excel.
- Descargo la plantilla **con mis datos actuales**, la edito y al subirla veo un
  preview (crear/actualizar/errores por fila) antes de confirmar.
- Errores por fila no abortan el resto (reporte fila a fila).

**HU-08 · Cobrar suscripciones (M11)** ⚠️
Como plataforma, quiero cobrar sin intervención manual.
- Un alta paga crea un `PendingRegistration`; el checkout usa su id como
  `external_reference` y conserva un token opaco para consultar la activación.
- Solo el webhook (firma HMAC verificada + consulta del pago real a la API de MP)
  crea la cuenta o cambia `User.subscription`. Un plan_id desconocido se descarta.
- El período elegido fija `subscriptionExpiresAt`; al completarse, el frontend hace
  un único login y redirige automáticamente al dashboard.
- El alta o cambio de plan queda logueado como evento en el CRM.
- **Incidente abierto 2026-08-20:** en producción, el alta paga alcanza
  `POST /payments/crear-preferencia-registro` pero recibe 500 antes de redirigir a
  MercadoPago. La causa exacta requiere revisar los logs internos de Koyeb; hasta
  resolverla, este criterio no se considera validado end-to-end.

**HU-09 · Gestionar clientes (M12)** ✅
Como CEO, quiero operar la cartera desde un solo lugar.
- Pipeline con etapas (lead → onboarding → activo → en riesgo → baja) en lista o
  kanban drag & drop; seguimientos vencidos con badge en el sidebar; export a Excel;
  historial que mezcla notas manuales con eventos automáticos del sistema.

**HU-10 · Cobrar pedidos online (M13)** 🔜
Como dueño, quiero que el cliente pague el pedido y la plata llegue a MI cuenta.
- Conecto mi cuenta de MercadoPago vía OAuth (MP Connect); los tokens se guardan
  cifrados (`ENCRYPTION_KEY`) y se refrescan solos.
- El pago del pedido se acredita en la cuenta del local; la plataforma registra la
  Order y puede aplicar `marketplace_fee`.
- Si el local no conectó MP, el checkout cae a WhatsApp (comportamiento actual).

**HU-11 · Panel de pedidos (M14)** 🔜
Como dueño, quiero ver los pedidos entrantes y su estado.
- Order con estados `nuevo → en preparación → listo → entregado / cancelado`;
  cambios reflejados en <5 s (SSE o polling corto); aviso sonoro opcional.

**HU-12 · Staff (M15)** 🔜
Como dueño, quiero que un empleado cargue productos sin ver facturación.
- Rol `staff` invitado por link, con permisos: editar menú y ver pedidos; nunca ve
  suscripción, stats de negocio ni configuración de cobro.

**HU-13 · IA de contenido (M16)** 🔜
Como dueño, quiero descripciones apetitosas sin escribirlas.
- Botón "Generar descripción" en el editor de producto (nombre + categoría →
  2 opciones de ≤140 caracteres, tono editable); siempre editable a mano, nunca se
  publica sin confirmación.

### 4.5 Requisitos no funcionales

| Dimensión | Requisito | Estado |
|---|---|---|
| Performance carta pública | LCP < 2,5 s en 4G; imágenes lazy; skeleton con silueta real (sin CLS) | ✅ (lazy + skeletons) / medir LCP 🔜 |
| Disponibilidad | Objetivo 99,5% mensual (Vercel + Koyeb + Atlas) | ✅ implícito / sin monitoreo formal 🔜 |
| Accesibilidad | WAI-ARIA en tabs/diálogos, focus-visible, tap targets ≥44 px, `prefers-reduced-motion`, sr-only | ✅ |
| Compatibilidad | Últimas 2 versiones de navegadores móviles; la carta funciona en WebView de Instagram/WhatsApp | ✅ |
| Zona horaria | Métricas en `America/Argentina/Buenos_Aires` | ✅ |
| Idioma | Español rioplatense; i18n fuera de alcance hasta expansión regional | ✅ |
| Privacidad | Datos mínimos del comensal (ninguno hoy; con Orders: nombre/teléfono con consentimiento) | ✅ / 🔜 |

### 4.6 Métricas de aceptación de producto (por release)

- Activación: % de cuentas nuevas que publican ≥5 productos en 72 h (objetivo >40%).
- Time-to-value: mediana registro → primera visita a su carta (<24 h).
- Conversión free→pago a 30 días (objetivo 5–8%).
- % de cartas con ≥1 pedido WhatsApp/semana (objetivo >25% de las activas).
- Churn mensual de pagos (<3%).

---

## 5. Arquitectura técnica

### 5.1 Estado actual ✅

```
Comensal ──HTTPS──▶ Vercel (React 19 + Vite, SPA)
                       │  /api/* (rewrite)
Dueño/CEO ──────────▶  ▼
                    Koyeb (Node + Express 4)
                    ├─ helmet · CORS allowlist · express-mongo-sanitize · rate limiters
                    ├─ JWT auth (HS256) · requirePlan · isAdmin
                    ├─ Controllers (user/menu/item/admin/crm/massive/payment)
                    └─ Webhook MercadoPago (HMAC verificado)
                       │
        ┌──────────────┼───────────────────┐
        ▼              ▼                   ▼
  MongoDB Atlas   Cloudinary          MercadoPago
  (Mongoose 7)    (imágenes,          (checkout Pro,
                   upload_stream)      webhook de pagos)
```

- **Frontend**: SPA con code-splitting por ruta (`lazy()`), React Query para el
  server state del panel, CSS Modules + design tokens globales. Cuatro "apps" en un
  build: landing comercial, panel del dueño, panel CEO, y las vistas públicas por
  slug (multi-tenant por URL).
- **Backend**: monolito Express modular (routes → middlewares → controllers →
  models). Sin estado en memoria → escala horizontal trivial.
- **Multi-tenancy**: por documento (`userID` en cada colección) con validación de
  ownership en cada operación. Un solo cluster para todos los tenants.
- **CI/CD**: deploy automático por push a `master` (Vercel/Koyeb).

**Decisiones y trade-offs asumidos**:

| Decisión | Por qué | Costo aceptado |
|---|---|---|
| Monolito Express (no NestJS/microservicios) | Velocidad de iteración con equipo de 1; el dominio es chico | Menos estructura formal; se mitiga con convenciones (ver ARCHITECTURE.md) |
| MongoDB (no SQL) | Menú = documento anidado natural; Atlas M0 gratis al inicio | Agregaciones de analítica más artesanales |
| SPA (no SSR) | Simplicidad; el panel no necesita SEO | La carta pública tampoco se prerenderiza → SEO por local limitado (ítem del backlog) |
| Sin Redis/colas hoy | El tráfico actual no lo justifica | Rate limiting en memoria por instancia; contadores con upsert directo |
| localStorage para carrito/sesión | Cero backend para el comensal | Carrito no cruza dispositivos (aceptable para el caso de uso mesa/mostrador) |

### 5.2 Evolución propuesta 🔜 (gatillada por hitos, no por moda)

| Hito de negocio | Cambio técnico |
|---|---|
| Pedidos online (M13/M14) | Modelo `Order` + webhook de pagos de pedidos separado del de suscripciones + SSE para el panel de pedidos (antes que WebSockets: más simple detrás de proxies) |
| >500 locales activos | Redis: rate limiting compartido, caché de cartas públicas (TTL 60 s), contadores de vistas bufferizados |
| SEO local como canal | Prerender/SSR solo de `/:slug` y `/:slug/menu` (Vite SSR o edge functions), sitemap dinámico |
| IA (M16) | Servicio interno de generación con Claude API; cola simple para jobs (BullMQ sobre el mismo Redis) |
| Observabilidad | Sentry (front+back) + logs estructurados + uptime checks con alertas (ver §12) |
| Multi-sucursal (M19) | `Organization` como tenant raíz; `User` pasa a miembro con rol; slugs por sucursal |

---

## 6. Base de datos

### 6.1 Colecciones actuales ✅ (detalle completo en ARCHITECTURE.md)

| Colección | Rol | Claves/índices |
|---|---|---|
| `users` | Tenant + cuenta + suscripción + branding (`contactInfo`, `media`, `template`) | `username` único; `slug` único de facto |
| `menus` | Secciones y categorías (auto-referencia `sectionID`) | `userID` |
| `items` | Productos (precio, oferta+vigencia, `options` Map, flags) | `menuID`; `code` único por usuario (validación en app) |
| `pageviews` | Visitas diarias agregadas por local | único `{userID, date}` |
| `itemviews` | Vistas diarias agregadas por producto | único `{userID, itemID, date}` + `{userID, date}` |
| `crmprofiles` | CRM interno (etapa, tags, seguimiento, notas/eventos) — **aislado de `users` a propósito** | `userID` único |
| `pendingregistrations` | Altas pagas todavía no convertidas en User; conserva plan/período, token opaco hasheado y estado | `activationTokenHash` único sparse; TTL por `expiresAt` |

Convenciones vigentes: fechas de métricas como string `YYYY-MM-DD` en huso BA
(upserts atómicos sin líos de timezone); `userID` denormalizado en `itemviews` para
agregar sin joins; borrado protegido (una categoría no se elimina con items).

### 6.2 Modelos del roadmap 🔜

```js
// Order — pedido de un comensal a un local (M13/M14)
Order {
  userID,            // local (tenant)
  number,            // correlativo por local (para cantar "pedido #42")
  lines: [{ itemId, title, unitPrice, quantity, selectedOption }], // snapshot de precios
  totals: { subtotal, fee, total },
  channel: "whatsapp" | "online",
  payment: { provider: "mercadopago", paymentId, status, marketplaceFee },
  status: "nuevo" | "preparando" | "listo" | "entregado" | "cancelado",
  customer: { name, phone },        // mínimo indispensable
  timestamps
}
// Índices: {userID, createdAt desc} · {userID, status} · payment.paymentId único sparse

// User.mpConnect — credenciales OAuth del local (M13)
mpConnect: {
  collectorId,
  accessTokenEnc, refreshTokenEnc,  // cifrados AES-256-GCM con ENCRYPTION_KEY
  expiresAt, scope, connectedAt
}

// AuditLog — trazabilidad de acciones sensibles (M15/seguridad)
AuditLog { actorId, actorRole, action, targetType, targetId, meta, ip, createdAt }
// TTL index 365 días

// Membership (M15/M19) — desacopla persona de local
Membership { userId, organizationId, role: "owner"|"staff", invitedBy, createdAt }
```

### 6.3 Operación de datos

- **Backups**: Atlas snapshots diarios, retención 7/30 días + restore ensayado
  trimestralmente 🔜 (hoy: snapshots del plan de Atlas sin runbook formal).
- **Migraciones**: scripts one-shot versionados (patrón ya usado en el rename de
  planes free/basic/pro).
- **Retención**: `pageviews`/`itemviews` se conservan (son livianas y valen para
  tendencias anuales); `AuditLog` con TTL.
- **PII**: hoy casi nula (datos del local, no de comensales). Con Orders entra
  teléfono/nombre del comensal → política de retención 90 días y derecho a borrado.

---

## 7. APIs

### 7.1 Convenciones ✅

- REST bajo `/api/*`, JSON; auth `Authorization: Bearer <JWT>` (HS256, expiración
  7 días).
- Autorización en capas: `protect` (identidad) → `isAdmin` (rol) →
  `requirePlan(min)` (gating comercial) → ownership check en el controller (recurso).
- Errores: `{ message }` en español, sin stack traces ni internals (`handleError`);
  el front los clasifica por status (`ApiError.type`).
- Rate limits: 10 req/15 min en auth; 300 req/15 min general.
- Endpoints públicos de tracking responden `204` incondicional (fire-and-forget, no
  filtran existencia de recursos).

### 7.2 Catálogo actual ✅ (resumen; detalle en ARCHITECTURE.md)

| Recurso | Endpoints clave |
|---|---|
| Auth/cuenta | `POST /users/register` · `POST /users/login` · `GET /users/me` · `PUT /users/me` · `PATCH /users/template` · `PATCH /users/active` |
| Menú (gestión) | `GET /users/me/menu` · CRUD `/menus` y `/items` (+move/hide/available/upload) |
| Carta pública | `GET /users/:slug` · `GET /users/:slug/menu` · `POST /users/:slug/menu/items/:itemID/view` |
| Analítica dueño | `GET /users/me/stats` · `GET /users/me/item-stats` (ambas pro+) |
| Excel | `GET /massive/template` · `POST /massive/preview` · `POST /massive/confirm` (basic+) |
| Pagos | `POST /payments/crear-preferencia` · `POST /payments/crear-preferencia-registro` · `POST /payments/registro/estado` · `POST /payments/webhook` |
| Admin/CRM | `GET /admin/stats` · `GET /admin/allUsers` · `PATCH /admin/users/:id/active` · `/admin/crm/*` (clients, notes, overdue-count, export) |

### 7.3 APIs del roadmap 🔜

| Endpoint | Propósito | Notas de diseño |
|---|---|---|
| `GET /payments/mp/connect` → redirect OAuth · `GET /payments/mp/callback` | Vincular cuenta MP del local | `state` firmado anti-CSRF; tokens cifrados; refresh proactivo |
| `POST /orders` (público, por slug) | Crear pedido con pago | Precios recalculados **en el servidor** desde `items` (nunca confiar en el carrito del cliente); idempotencia por `clientOrderId` |
| `POST /payments/orders/webhook` | Confirmación de pago de pedidos | Separado del webhook de suscripciones; misma verificación de firma; idempotente por `paymentId` |
| `GET /orders?status=` · `PATCH /orders/:id/status` | Panel de pedidos del dueño | Transiciones de estado validadas server-side |
| `GET /orders/stream` (SSE) | Tiempo real del panel | Fallback a polling 10 s |
| `POST /ai/describe-item` | Descripciones con IA | Rate limit propio + tope mensual por plan |
| `POST /invitations` · `POST /invitations/accept` | Staff (M15) | Tokens de un solo uso, expiran 72 h |

**Versionado**: sin `/v2` mientras el único cliente sea el frontend propio; los
cambios breaking se coordinan por deploy. Si se abre API pública (integraciones),
ahí sí `/api/v1` congelada + API keys por local.

---

## 8. Seguridad

### 8.1 Implementado ✅ (resultado de la auditoría interna + hardening de esta etapa)

| Capa | Medida |
|---|---|
| Transporte/headers | HTTPS extremo a extremo; `helmet` (CSP-friendly, CORP cross-origin para servir a Vercel); CORS con allowlist explícita |
| Autenticación | JWT HS256 con algoritmo **fijado** en la verificación (anti alg-confusion); bcrypt; política de contraseñas (≥8 + blocklist de comunes); expiración 7 días |
| Autorización | `protect`/`isAdmin`/`requirePlan` + ownership check por recurso en cada controller (anti-IDOR); el gating de plan se valida SIEMPRE server-side (bypass de suscripción y de templates pagos cerrados y verificados con exploits de regresión) |
| Inyección | `express-mongo-sanitize` (scoped, excluye el webhook MP a propósito) + validación de tipos en login/registro (rechaza payloads no-string) |
| Abuso | `authLimiter` 10/15 min (anti fuerza bruta) + `apiLimiter` 300/15 min; límites de upload (imágenes 8 MB, Excel 5 MB en memoria) |
| Pagos | Firma HMAC-SHA256 del webhook verificada con `timingSafeEqual`; el estado del pago se consulta a la API de MP (nunca se confía en el query string); `PLAN_MAP` valida plan_ids |
| Fugas de información | `handleError` loguea server-side y responde genérico (sin stack traces/rutas); password con `select:false` |
| Contenido | `googleReviewUrl` validado con allowlist `http(s)://` en cliente **y** servidor (bloquea `javascript:` XSS); subidas restringidas por formato y transformadas en Cloudinary |
| Dependencias | Auditoría aplicada (cloudinary v2 con storage engine propio, override de `uuid` parcheado para exceljs) |

### 8.2 Mapa OWASP Top 10 → estado

| Riesgo | Estado |
|---|---|
| A01 Broken Access Control | ✅ cubierto (capas + ownership + regresión de exploits) — se refuerza con AuditLog 🔜 |
| A02 Cryptographic Failures | ✅ bcrypt/HTTPS/JWT — cifrado de tokens MP con AES-256-GCM llega con MP Connect 🔜 |
| A03 Injection | ✅ sanitize + validación de tipos + Mongoose |
| A04 Insecure Design | ✅ gating server-side, webhooks verificados, precios server-side en Orders (diseñado) |
| A05 Security Misconfiguration | ✅ helmet/CORS/trust proxy — falta escaneo automático de config 🔜 |
| A06 Vulnerable Components | ✅ deps auditadas — automatizar con Dependabot/`npm audit` en CI 🔜 |
| A07 Auth Failures | ✅ rate limit + política de contraseñas — 2FA para admin y refresh tokens 🔜 |
| A08 Data Integrity | ✅ webhook firmado — lockfile audit en CI 🔜 |
| A09 Logging/Monitoring | ⚠️ logs básicos — Sentry + alertas + AuditLog 🔜 |
| A10 SSRF | ✅ sin fetches a URLs de usuario en el backend |

### 8.3 Roadmap de seguridad 🔜 (orden de prioridad)

1. **Con M13 (dinero de terceros)**: `ENCRYPTION_KEY` + cifrado de tokens MP,
   idempotencia estricta de webhooks, AuditLog de acciones de cobro.
2. Sentry + alertas de uptime (detección antes que el cliente).
3. Refresh tokens con rotación (hoy: JWT 7 días sin revocación) + logout server-side.
4. 2FA TOTP para cuentas admin/CEO.
5. Dependabot + `npm audit` como gate de CI.
6. Runbook de backups/restore + simulacro trimestral.
7. Al superar ~1.000 locales: pentest externo puntual.

---

## 9. UX/UI y Design System

### 9.1 Principios ✅

1. **Mobile-first real**: el panel se diseña primero a 390 px; desktop es la
   adaptación (sidebar ↔ bottomnav, grillas que se expanden).
2. **El comensal no espera**: skeletons con la silueta exacta del contenido (cero
   layout shift), imágenes lazy, animaciones cortas con `--ease-out`.
3. **Tap targets ≥44 px**, `focus-visible` consistente con halo, navegación por
   teclado en patrones ARIA (tablist de la carta, diálogos, kanban).
4. **`prefers-reduced-motion` en todo**: cada animación tiene su apagado.
5. **La marca es del local, no de la plataforma**: en la carta pública manda el
   template elegido; la identidad de MenuDigital vive en el panel y la landing
   comercial.

### 9.2 Design System ✅ (fuente de verdad: `styles/globals.css` — ver ARCHITECTURE.md §styles)

**Cuatro familias de tokens**, cada una con su prefijo y su ámbito:

| Familia | Ámbito | Carácter |
|---|---|---|
| Base (`--gold`, `--cream`, `--surface-*`, `--text-*`, radios/sombras/espaciado/escala tipográfica/easings/z-index) | Storefront claro + primitivas compartidas | Cálido, editorial |
| `--admin-*` | Panel del dueño + CEO + CRM | Oscuro default con **tema claro** vía `data-theme="light"`; derivados calculados con `color-mix()` para que el theming sea cambiar ~30 bases |
| `--auth-*` | Login/Registro/landing comercial | Oscuro/ámbar, alta energía de conversión |
| `--t-*` (×13) | Carta pública y landing del local | Un bloque `[data-template]` por template; los premium suman `--t-bg-image` y `--t-btn-bg` metálico |

**Tipografías**: DM Sans (UI), Playfair Display (títulos de carta), Fraunces
(display de auth/landing), DM Mono (datos/precios del panel CEO).

**Los 13 templates** (producto, no solo estética — son el eje del gating):
free: Clásico, Natural, Minimal · basic: Moderno, Rojo, Coastal, Charcoal ·
pro: Terracotta, Lavender, Forest, Aurora, Noir Gold, Platinum (los últimos
con degradés y botones metálicos).

**Patrones canónicos ya construidos**: cards con hover spotlight, drawers
(carrito, detalle CRM), bottom-sheet de acciones, kanban drag & drop, steppers de
cantidad, toggles con spring, badges semánticos, spinners centralizados (página
completa / inline / botón), skeletons por vista, estados vacíos y not-found
compartidos (`.t-notfound*`). La landing comercial expone las tarjetas de planes
inline y usa un CTA propio por plan, evitando un modal adicional en el embudo.

**Regla de oro del CSS** (vigente y auditada): lo que se repite en 2+ módulos se
centraliza en `globals.css`; los módulos no redeclaran keyframes ni spinners ni
utilidades.

### 9.3 Deuda y evolución de UX 🔜

- Focus management completo en CartDrawer (trap + retorno de foco) y `aria-controls`
  en el botón de variantes.
- Contraste de `--admin-text-faint` en tema claro (borderline WCAG AA).
- Affordance de scroll del kanban en mobile.
- Auditoría Lighthouse/axe formal por release (hoy es manual).
- Modo offline básico de la carta (PWA liviana) — evaluar demanda real antes.

---

## 10. Modelo de negocio

### 10.1 Pricing vigente ✅ (ARS, julio 2026)

| Plan | Precio | Equivalente mensual | Desbloquea |
|---|---|---|---|
| **Gratis** | $0 | $0 | 15 productos, carta QR, publicidad de MenuDigital en la carta |
| **Basic** | $5.999/mes base | Según período | Productos ilimitados, landing del local, Excel, +4 templates |
| **Pro** | $29.999/mes base | Según período | Todo Basic + estadísticas, dominio propio 🔜 y +6 templates |

Mecánica de monetización: el **prepago largo se premia** (3 meses ≈10% off,
6 meses ≈17% y 12 meses 25%); el plan Free hace marketing
(publicidad de la plataforma en cartas gratuitas) y alimenta el pipeline del CRM.
La selección nace en la landing y viaja por query string al registro; Free crea la
cuenta sin checkout, mientras Basic/Pro confirman período antes de abrir MercadoPago.

**Nota operativa**: con inflación ARS, los precios se revisan trimestralmente. Hoy
los valores están duplicados entre `PLANES` en backend y `PLANS` en la landing/
registro, por lo que cada ajuste debe sincronizar ambos repositorios.

### 10.2 Unit economics (supuestos explícitos, base 2026)

- **ARPU pago**: recalcular con la mezcla real Basic/Pro y los períodos elegidos.
- **Costo marginal por local ≈ $0** (infra compartida: Vercel/Koyeb/Atlas/Cloudinary
  en tiers bajos; margen bruto >90% hasta miles de locales).
- **CAC objetivo por canal**: orgánico/viral ≈ $0; partnerships ≈ 1 mes de ARPU;
  paid (si se activa) tope 3 meses de ARPU.
- **LTV** con churn 3%/mes ⇒ vida media ~33 meses ⇒ LTV ≈ $165.000 ⇒ LTV/CAC >10
  en canales orgánicos.
- **Punto de cobertura de costos fijos de infra/tooling** (~USD 50–100/mes): ~15–30
  suscripciones pagas. Todo lo demás es margen para reinvertir en growth.

| Escenario (24 meses) | Locales pagos | MRR | ARR |
|---|---|---|---|
| Piso | 300 | $1,5M ARS | $18M ARS |
| Base | 600 | $3,0M ARS | $36M ARS |
| Techo | 900 | $4,5M ARS | $54M ARS |

### 10.3 Líneas de ingreso futuras 🔜

1. **Fee por pedido online (M13)**: `marketplace_fee` de 1–3% sobre pedidos cobrados
   vía MP Connect — opt-in, transparente, alineado con "te ayudo a vender". Es el
   camino de expansión de revenue que no depende de subir la suscripción.
2. **Add-ons**: dominio propio fuera de Pro, IA de contenido por paquete de
   usos, sucursal adicional.
3. **Partnerships con revenue share**: distribuidores gastronómicos e imprentas de
   QR que revenden el alta.

---

## 11. Roadmap

Cadencia trimestral; cada fase tiene criterio de salida medible. Las fases 0–3 del
plan original (carrito, WhatsApp, reseñas, analítica por plato) **ya están en
producción** ✅.

### Q3 2026 — "Cobrar pedidos" (M13 + base M14)
- MercadoPago Connect (OAuth por local, tokens cifrados, refresh).
- Modelo `Order` + checkout online en el CartDrawer (la zona de acciones ya está
  preparada para sumar el botón sin reestructurar).
- Webhook de pedidos idempotente; panel mínimo de pedidos (lista + cambio de estado).
- Seguridad que lo acompaña: `ENCRYPTION_KEY`, AuditLog de cobros, Sentry.
- **Criterio de salida**: 10 locales cobrando pedidos reales; 0 incidentes de
  conciliación; fee configurado y reportado.

### Q4 2026 — "Operar el pedido" (M14 completo + M20)
- Panel de pedidos en tiempo real (SSE), número de pedido cantable, aviso sonoro.
- Estados de pedido con notificación al comensal por WhatsApp (link de estado).
- Dominio propio para Pro (saldar la promesa de la landing).
- Prerender de `/:slug` y `/:slug/menu` + sitemap (SEO local como canal).
- **Criterio de salida**: mediana de "pedido nuevo → visto por el local" <60 s;
  primeros 20 dominios propios activos.

### Q1 2027 — "Equipo e inteligencia" (M15 + M16)
- Roles staff con invitaciones y AuditLog.
- IA v1: descripciones de platos + resumen mensual automático de stats ("tu top 3
  creció 20%, considerá destacarlo") por email/WhatsApp.
- Refresh tokens + 2FA admin.
- **Criterio de salida**: 30% de cuentas activas con ≥1 staff o ≥1 uso de IA/mes.

### Q2 2027 — "Retener y crecer" (M17/M18, exploración M19)
- Reservas simples (lo prometido "próximamente" en Pro) o fidelización
  (puntos/cupones vía WhatsApp) — **decidir por demanda medida**, no por intuición.
- Programa de referidos in-product (mes gratis por local referido que paga).
- Spike técnico multi-sucursal (Organization/Membership) si ≥10 clientes lo piden.
- **Criterio de salida**: churn mensual <2,5%; ≥15% de altas nuevas por referido.

**Reglas del roadmap**: nada entra a un trimestre sin historia de usuario +
criterios de aceptación en este documento; lo "próximamente" de la landing no puede
envejecer más de dos trimestres sin construirse o quitarse.

---

## 12. KPIs y analítica

### 12.1 Métricas de negocio (revisión semanal en el panel CEO)

| KPI | Definición | Objetivo 12 meses |
|---|---|---|
| MRR / ARR | Suscripciones activas normalizadas a mes | Escenario base §10.2 |
| Churn mensual | Bajas pagas / pagas activas | <3% |
| Conversión free→pago | Cohorte a 30 días del alta | 5–8% |
| CAC blended | Gasto de adquisición / altas pagas | <1 mes de ARPU |
| NRR | Revenue neto de expansión (upgrades + fees) | >100% tras M13 |
| Locales "vivos" | ≥1 edición de menú o ≥50 vistas de carta en 30 días | >70% de la base paga |

### 12.2 Métricas de producto

- **Activación**: publicar ≥5 productos en 72 h.
- **TTV**: registro → primera visita a la carta propia.
- **Uso que retiene**: pedidos WhatsApp/local/semana; vistas de carta/local;
  frecuencia de edición de precios; descargas de QR; % de cartas con reseñas
  configuradas.
- **Embudos**: carta → carrito → click WhatsApp (hoy medible parcialmente; se
  completa con eventos 🔜) · free → paywall visto → checkout → pago aprobado.

### 12.3 Instrumentación

✅ Ya se mide server-side: `pageviews`, `itemviews` (huso BA), KPIs del panel CEO,
eventos de CRM automáticos (upgrades, activaciones, cambios de template).
🔜 Falta: eventos client-side con nombres estables (`cart_add`, `cart_open`,
`wa_order_click`, `paywall_view`, `checkout_start`) hacia un colector propio
liviano (endpoint + colección `events`) — se prefiere propio antes que GA4 por
privacidad, bloqueadores y costo cero. Sentry para errores. Uptime checks externos.

---

## 13. Growth

1. **Viralidad estructural del Free** ✅: cada carta gratuita lleva la marca; el QR
   está impreso en mesas frente a otros gastronómicos (el rubro se copia entre sí).
2. **SEO local** 🔜 (desbloquea con prerender): "menú + [barrio/ciudad]", páginas
   públicas indexables por local, sitemap dinámico. Costo marginal cero.
3. **Partnerships de canal**: imprentas de QR/menús, distribuidores gastronómicos,
   consultores y cámaras locales — revenue share o meses bonificados. Es el canal
   con mejor CAC/confianza en el rubro.
4. **Referidos in-product** 🔜 (Q2 2027): mes gratis por local referido pagador; el
   CRM ya registra la fuente.
5. **Contenido práctico**: guías cortas ("cómo conseguir reseñas", "cómo armar
   ofertas que rotan stock") — posiciona la marca como socia del local, alimenta
   SEO y da material a los partners.
6. **WhatsApp como canal de lifecycle**: onboarding, tips de activación y resúmenes
   mensuales de stats por el canal que el dueño ya mira (respetando opt-in).

**Anti-metas**: no hacer paid ads masivo antes de churn <3% sostenido; no abrir
países antes de dominar un corredor local argentino.

---

## 14. Backlog priorizado (RICE)

Score = (Reach × Impact × Confidence) / Effort. Reach: locales afectados/trimestre
(escala 1–10) · Impact: 0,5/1/2/3 · Confidence: 0,5–1 · Effort: persona-semanas.

| # | Iniciativa | R | I | C | E | RICE | Fase |
|---|---|---|---|---|---|---|---|
| 1 | MP Connect + Order + checkout online | 8 | 3 | 0,8 | 6 | 3,2 | Q3-26 |
| 2 | Sentry + uptime + alertas | 10 | 1 | 1,0 | 1 | 10,0 | Q3-26 |
| 3 | Eventos client-side (embudo carrito→WA) | 9 | 1 | 0,9 | 1,5 | 5,4 | Q3-26 |
| 4 | Panel de pedidos tiempo real (SSE) | 7 | 3 | 0,8 | 4 | 4,2 | Q4-26 |
| 5 | Prerender público + sitemap (SEO) | 9 | 2 | 0,7 | 3 | 4,2 | Q4-26 |
| 6 | Dominio propio Pro | 3 | 2 | 0,9 | 2 | 2,7 | Q4-26 |
| 7 | Notificación de estado de pedido por WA | 6 | 2 | 0,7 | 2 | 4,2 | Q4-26 |
| 8 | IA: descripciones de platos | 7 | 1 | 0,8 | 2 | 2,8 | Q1-27 |
| 9 | Resumen mensual automático (insights) | 8 | 1 | 0,8 | 2 | 3,2 | Q1-27 |
| 10 | Roles staff + invitaciones + AuditLog | 5 | 2 | 0,8 | 3 | 2,7 | Q1-27 |
| 11 | Refresh tokens + 2FA admin | 10 | 1 | 0,9 | 2 | 4,5 | Q1-27 |
| 12 | Referidos in-product | 6 | 2 | 0,7 | 2 | 4,2 | Q2-27 |
| 13 | Reservas simples | 4 | 2 | 0,5 | 4 | 1,0 | Q2-27* |
| 14 | Fidelización (cupones WA) | 5 | 2 | 0,5 | 4 | 1,3 | Q2-27* |
| 15 | Multi-sucursal (Organization) | 2 | 3 | 0,5 | 6 | 0,5 | Backlog |
| 16 | Redis (cache carta + rate limit compartido) | 6 | 1 | 0,9 | 2 | 2,7 | Al hito 500 |
| 17 | Focus trap CartDrawer + a11y pendientes | 8 | 0,5 | 1,0 | 0,5 | 8,0 | Continuo |
| 18 | Auditoría Lighthouse/axe por release | 8 | 0,5 | 0,9 | 0,5 | 7,2 | Continuo |
| 19 | Dependabot + npm audit en CI | 10 | 0,5 | 1,0 | 0,5 | 10,0 | Q3-26 |
| 20 | PWA/offline de la carta | 4 | 1 | 0,5 | 3 | 0,7 | Explorar |
| 21 | Búsqueda dentro de la carta pública | 5 | 1 | 0,8 | 1 | 4,0 | Q4-26 |
| 22 | Modificadores avanzados (extras con precio) | 5 | 2 | 0,7 | 3 | 2,3 | Q1-27 |
| 23 | Página de estado del sistema (status page) | 3 | 0,5 | 0,9 | 0,5 | 2,7 | Q4-26 |
| 24 | Export contable de pedidos (CSV) | 3 | 1 | 0,8 | 1 | 2,4 | Post-M14 |
| 25 | Onboarding guiado in-app (checklist) | 9 | 1 | 0,8 | 2 | 3,6 | Q3-26 |

\* Q2-27 decide **uno** de los dos (13 o 14) por demanda medida.

Los quick wins de mantenimiento (#2, #17, #18, #19) no compiten con las apuestas
grandes: se intercalan como trabajo continuo.

---

## 15. Riesgos y mitigaciones

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| Macro argentina deprime el gasto del sector | Alta | Alto | Freemium como amortiguador; pricing en ARS revisado trimestral; prepago anual adelanta caja; la propuesta es "vender más", contracíclica |
| OlaClick (u otro regional) profundiza Argentina con más capital | Media | Alto | Velocidad de producto + profundidad local (WhatsApp AR, MP, huso, castellano rioplatense) + relación directa vía CRM; no competir en "gratis", competir en resultado |
| Dependencia de MercadoPago (rail único de cobro) | Media | Alto | Abstracción de proveedor en el módulo de pagos; monitoreo de webhooks; plan B: transferencia/link de pago manual documentado |
| Bus factor = 1 (equipo de una persona) | Alta | Alto | ARCHITECTURE.md + este blueprint como memoria externa; automatización de deploy/backup; priorizar simplicidad técnica (monolito, pocas piezas) |
| Incidente de seguridad con dinero de terceros (post-M13) | Baja | Crítico | §8.3 punto 1 completo **antes** de GA de pedidos; fee y flujos auditados; pentest al hito 1.000 |
| Churn por "lo probé y no me trajo clientes" | Media | Alto | Onboarding guiado (#25), resumen mensual de valor (#9), north star = pedidos generados; CRM detecta "en riesgo" temprano |
| WhatsApp cambia políticas de links `wa.me` | Baja | Medio | El pedido online (M13) reduce dependencia; fallback a mensaje copiable |
| Inflación desactualiza precios de cartas (mala imagen del rubro) | Media | Medio | Excel masivo ya existe; explorar "ajuste % masivo" de un click (candidato a backlog) |

---

## 16. Referencias

**Mercado y competencia** (consultadas julio 2026):
- [FEHGRA — datos del sector](https://argentina.ladevi.info/actualidad/fehgra-los-datos-que-marcan-la-realidad-del-sector-n82775) (~67.000 establecimientos gastronómicos)
- [Ficha sectorial gastronomía CABA — Jun 2025](https://buenosaires.gob.ar/sites/default/files/2025-07/Ficha%20Gastronom%C3%ADa%20-%20Junio%202025.pdf)
- [Caída de actividad del sector](https://www.trtespanol.com/article/f31ef495ccf0)
- [OlaClick — menú digital](https://olaclick.com/menu-digital/) · [software para restaurantes](https://olaclick.com/es/software-para-restaurantes/)
- [GloriaFood — pricing](https://www.gloriafood.com/pricing)
- [Pedix](https://info.pedix.app/)
- Larga cola local: [SoyMenu](https://soymenu.com.ar/) · [Recafy](https://www.recafy.com/carta-menu-digital-qr-buenos-aires-argentina/) · [RestoMenu QR](https://www.restomenuqr.com.ar/) · [cartadigital.gratis](https://www.cartadigital.gratis/menu-digital-qr-buenos-aires-argentina/) · [menudigital.ar](https://menudigital.ar/)

**Internas**:
- [ARCHITECTURE.md](ARCHITECTURE.md) — documentación técnica archivo por archivo
  (modelos, endpoints, componentes, design system).
- Código fuente de pricing: `src/components/Admin/Home/AdminHome.tsx` (`PLANS`) y
  `menu-digital-backend/src/config/plans.js` (`PLAN_FEATURES`, `TEMPLATE_MIN_PLAN`,
  `FREE_ITEM_LIMIT`).

---

*Versión 2 — actualizada el 20 de agosto de 2026. Reemplaza al esqueleto v1.
Documento vivo: se actualiza al cierre de cada trimestre junto con el roadmap.*
