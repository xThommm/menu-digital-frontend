# MenuDigital — Startup Blueprint v2
> **Catálogo actualizado — 31-08-2026:** precios y features ya se leen de MongoDB
> en el código local. Editor `/admin/plans`, checkout con versión y gating dinámico
> conectados. Las revisiones anteriores son históricas; ver README y la guía del
> catálogo para la validación actual. No se consultó Atlas ni se desplegó.


> **Cómo leer este documento.** Es el plan integral de la startup: mercado, producto
> (PRD), arquitectura, datos, APIs, seguridad, UX/design system, modelo de negocio,
> roadmap, KPIs, growth y backlog priorizado. A diferencia de un blueprint teórico,
> está anclado en un producto existente. ✅ significa implementado en el código
> revisado, **no despliegue ni aceptación productiva certificados**; ⚠️ indica un
> pendiente o integración parcial y 🔜 una propuesta. El detalle
> archivo-por-archivo del código vive en [ARCHITECTURE.md](ARCHITECTURE.md) — acá no
> se repite, se referencia.

> **Revisión — 30-08-2026:** se contrastó cada sección con ambos repositorios.
> Precios locales: Basic $29.999 / Pro $49.999; catálogo MongoDB parcial, todavía
> sin conectar a rutas ni checkout. Backend pasa 93/95 tests; frontend pasa lint/build
> y falla typecheck en el nuevo módulo Planes. No se consultaron despliegues ni
> bases productivas. El E2E de pagos y PAY-05 siguen como controles pendientes (§10.1).

> **Decisión de producto — 31-08-2026:** dominio propio y reseñas integradas quedan
> fuera del alcance actual, sin compromiso de implementación. Se retiraron sus
> permisos, campos, controles y anuncios del código local. Maps por dirección y
> WhatsApp se conservan. No se modificó la base productiva ni se desplegaron cambios.

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
la carta del local en una presencia digital completa: menú QR con 15 templates de
diseño, landing page propia, pedidos por WhatsApp con carrito,
estadísticas de visitas y de productos más vistos, y un panel de gestión
mobile-first con importación/exportación por Excel.

- **Estado**: producto en producción según el contexto del proyecto; código local
  React 19 + Express 4 + Mongoose 7, despliegue previsto en Vercel + Koyeb/Atlas.
  El origen web permitido en la API es `https://www.menudigitalapp.com.ar`.
- **Modelo**: freemium por suscripción. Free ($0, hasta 15 productos) → Basic
  ($29.999/mes base, hasta 50 productos) → Pro ($49.999/mes base), con prepago
  1/3/6/12 meses. Sin renovación automática ni comisiones de MenuDigital por pedidos
  WhatsApp; no incluye las comisiones que MercadoPago cobre por la suscripción.
- **Mercado**: FEHGRA publica ~67.000 establecimientos gastronómicos. Es una
  referencia sectorial, no una base verificada de compradores del SaaS.
  [Fuente institucional](https://fehgra.org.ar/acerca-de-fehgra).
- **Diferenciación buscada**: edición simple, pedidos por WhatsApp,
  analítica de visitas y diseño por templates. El impacto sobre ventas/retención
  todavía debe medirse; estas funciones no garantizan mejor ranking ni ventas.
- **Próximo salto** (roadmap): cobro de pedidos online con **MercadoPago Connect**
  (cada local cobra en su propia cuenta; la plataforma puede tomar un fee por
  transacción), panel de pedidos en tiempo real, y capa de IA (descripciones de
  platos, insights automáticos).

**North star metric**: pedidos generados a los locales por la plataforma (WhatsApp
hoy, pagos online mañana). **Todavía no está instrumentada**: abrir `wa.me` no
demuestra que el mensaje se envió ni que el pedido se concretó. La relación con
retención y disposición a pagar es una hipótesis a validar.

---

## 2. Visión y tesis

**No vendemos un menú QR: construimos el sistema operativo comercial del local
gastronómico chico.**

La tesis, en tres partes:

1. **El QR es la puerta de entrada, no el producto.** La carta digital es un
   commodity (hay decenas gratis). Lo que el dueño de un café de barrio no tiene es:
   presencia digital cuidada, un canal de pedidos ordenado y datos sobre qué
   productos consultan sus clientes. Esas necesidades orientan la oferta paga.
2. **El segmento desatendido es el local chico e independiente.** Los POS grandes
   (Toast, Square a nivel global; Maxirest/Fudo acá) apuntan al restaurante
   establecido con staff y hardware. El café de especialidad, la pizzería de barrio
   y la cervecería artesanal necesitan algo que se configure en una tarde desde el
   celular, sin hardware adicional y con un precio que puedan justificar con valor
   real; no se usa la comparación desactualizada de "dos cafés por mes".
3. **La distribución es local y por confianza.** En gastronomía argentina las
   herramientas se adoptan por recomendación entre colegas, no por ads. El producto
   tiene viralidad estructural: cada carta pública es una demo con la marca de la
   plataforma (el plan Free incluye publicidad de MenuDigital — es marketing pagado
   por el usuario gratuito).

**Principios de producto** (guían implementación y aceptación del roadmap):

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

- **Universo**: la página institucional de FEHGRA publica más de 84.000 empresas,
  con 17.000 establecimientos hoteleros y **67.000 gastronómicos**. Consulta documental
  del 30-08-2026; la página no convierte ese número en un censo de clientes potenciales
  activos de MenuDigital. [FEHGRA](https://fehgra.org.ar/acerca-de-fehgra).
- **Coyuntura**: los informes 2023–2025 citados en versiones anteriores son
  antecedentes, no indicadores de agosto de 2026. No se extrapolan caídas históricas
  a la demanda actual; validar presupuesto y sensibilidad al precio en entrevistas.
- **Hipótesis comercial**: aprovechar QR, WhatsApp y presencia en Google para reducir
  trabajo operativo. La promesa debe demostrarse con pilotos y métricas, no con
  afirmaciones de aumento de ventas o posicionamiento garantizados.

### 3.2 TAM / SAM / SOM

Supuestos explícitos (no datos de ventas): con los precios del código local del
30-08-2026, una mezcla de 70% Basic y 30% Pro da un ARPU de lista de **$35.999**.
Aplicando 10% promedio de descuentos de prepago, el **ARPU de referencia es
$32.399,10/mes** ($388.789,20/año), antes de comisiones, impuestos, devoluciones e
inflación. No incluye Free ni promociones adicionales del catálogo administrado.

| Capa | Definición | Tamaño | Valor anual potencial |
|---|---|---|---|
| **TAM** | Referencia sectorial FEHGRA × ARPU supuesto | ~67.000 locales | ~$26.048,88M ARS/año |
| **SAM** | Hipótesis de locales independientes digital-friendly, aprox. 45% redondeado; no relevamiento | ~30.000 locales | ~$11.663,68M ARS/año |
| **SOM** (24 meses) | Escenario de captación, 1–3% del SAM; no pronóstico validado | 300–900 locales pagos | $116,64M–$349,91M ARS/año |

La expansión natural post-Argentina es LATAM hispanohablante (mismo idioma, mismos
rails: WhatsApp + MercadoPago en AR/UY/CL/MX), pero no entra en el horizonte de este
blueprint.

### 3.3 Dolores que el producto busca resolver (validación comercial pendiente)

1. **"Cambiar el precio de la carta es un drama"** → edición desde el celular en
   segundos; carga masiva por Excel para menús grandes.
2. **"Los pedidos por WhatsApp son un caos de mensajes"** → carrito que arma el
   mensaje completo y ordenado (producto × cantidad, variante, total).
3. **"No sé qué funciona de mi menú"** → estadísticas de visitas + ranking de
   productos más vistos (ventana 30 días).
4. **"Las soluciones lindas son caras; las gratis son feas"** → 15 templates con
   calidad de diseño real, escalonados por plan.

### 3.4 Competencia

Revisión de páginas oficiales del 30-08-2026. Se documenta lo publicado, no una
prueba funcional ni una garantía de precio/disponibilidad al contratar.

| Competidor | Oferta publicada | Lectura para MenuDigital |
|---|---|---|
| [OlaClick](https://olaclick.com/cardapio-digital/) | Menú digital gratuito con funciones premium; la página consultada corresponde a Brasil | No asumir que todas las funciones son gratis ni trasladar condiciones a Argentina |
| [GloriaFood](https://www.gloriafood.com/pricing) | Pedidos/reservas en base gratuita; pagos online USD 29/mes y promociones avanzadas USD 19/mes | Comparar alcance completo y disponibilidad regional; no sostener importes antiguos de web/apps sin fuente actual |
| [Pedix Argentina](https://info.pedix.app/ar/) | Tienda/menú WhatsApp desde ARS 19.000/mes; publica pagos integrados, variantes y centro de pedidos | No describirlo como catálogo sin gastronomía o sin analítica; contrastar onboarding y operación real |
| [lacartaa](https://www.lacartaa.com/) | Menú, carrito WhatsApp, cobro MercadoPago, reseñas y reportes; Pro publicado a ARS 29.999/mes | Competencia directa; no afirmar ausencia de Excel u otras funciones sin comprobarla |

SoyMenu, Recafy, RestoMenu QR, cartadigital.gratis, menudigital.ar, Fudo y Maxirest
permanecen en el mapa histórico de alternativas; esta revisión no certifica sus
planes ni funcionalidades. Se retiran juicios no sustentados sobre calidad o continuidad.

**Inferencia estratégica**: el conjunto QR/WhatsApp/estadísticas no es exclusivo. El
posicionamiento debe validarse por facilidad de uso, soporte local y resultados
medidos. Un CRM interno ayuda a operar MenuDigital, pero no es una feature que
reciba el restaurante ni demuestra inferioridad de otro proveedor.

### 3.5 Posicionamiento

> Para el dueño de un local gastronómico chico que quiere vender más sin sumar
> gente, **MenuDigital** es la plataforma que convierte su carta en un canal de
> ventas (QR + landing + pedidos por WhatsApp + datos), a diferencia de
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
- *Cuando* armo el menú del mes, *quiero* saber qué miran y qué ignoran, *para*
  destacar lo que rinde.

### 4.3 Alcance funcional

#### Módulos presentes en el código ✅

La asignación vigente de beneficios se consulta en MongoDB. Las referencias
comerciales por nivel son la configuración inicial; no son una herencia técnica.

| # | Módulo | Qué hace | Gating |
|---|---|---|---|
| M1 | **Auth y cuentas** | Registro/login JWT, política de contraseñas, términos versionados | — |
| M2 | **Editor de menú** | Secciones → categorías → productos; variantes (options), ofertas manuales o programadas con fecha/hora, disponibilidad semanal por plato con múltiples franjas, recomendado, oculto/no disponible; drag & drop; imágenes a Cloudinary | `menu_editor`, `item_limit`, `programacion_productos` |
| M3 | **Carta pública** (`/:slug/menu`) | Tabs por sección, tarjetas con foto/precio/badges, skeleton, scroll-reveal, grilla 2 columnas en desktop, sticky header+tabs | — |
| M4 | **Landing del local** (`/:slug`) | Hero o avatar según template, galería bento, chips de contacto, lightbox; muestra publicidad según el catálogo | `landing_page` y `sin_publicidad` |
| M5 | **Templates** | 15 estilos visuales vía design tokens `--t-*` | `templateIds` |
| M6 | **Carrito + pedido WhatsApp** | Carrito por local (localStorage), steppers, drawer con total, mensaje `wa.me` prearmado, confirmación al vaciar | `pedido_whatsapp` |
| M8 | **QR descargable** | PDF con el QR de la carta (client-side) | `qr` |
| M9 | **Estadísticas** | Visitas diarias (30 días, tiempo real con polling), ranking top-10 de productos más vistos | `estadisticas` |
| M10 | **Import/Export Excel** | Plantilla generada con datos actuales, preview de cambios, confirmación fila a fila | `menu_editor` + `carga_masiva_excel` |
| M10b | **Exportación PDF** | Menú imprimible generado desde la carta vigente | `menu_pdf` |
| M11 | **Suscripciones** ✅ | Checkout MercadoPago, alta automática, upgrades/renovaciones 1/3/6/12 meses, vencimiento visible, historial durable, validación del checkout original, webhook firmado/idempotente y separación estricta test/producción por `live_mode` | — |
| M12 | **Panel CEO + CRM interno** | KPIs de la plataforma, gestión de clientes (pipeline kanban, notas, eventos automáticos, seguimientos vencidos, export Excel) | Solo admin |
| M12c | **Planes admin** | Precios, promociones, multiplicadores por período, textos, funciones, límites y diseños desde MongoDB; guardado con versión | Solo admin |
| M12b | **Pagos admin** | Historial local paginado, filtros, detalle de validación/acreditación y resumen por cliente; no realiza reembolsos | Solo admin |

CRM incluye vista 360, onboarding calculado, alertas de pagos y vencimientos, y
activación/desactivación con confirmación. El CEO muestra resumen y atajos, no otra
pantalla completa de operación. **Catálogo editable de planes ⚠️**: hay modelo,
servicio y UI locales, pero falta integración; ver [rollout](docs/PLAN_CATALOG_ROLLOUT.md).

#### Módulos del roadmap 🔜 (ver §11)

M13 Cobro de pedidos (MP Connect) · M14 Panel de pedidos en tiempo real · M15 Roles
de staff · M16 IA (contenido + insights) · M17 Reservas · M18 Fidelización/campañas ·
M19 Multi-sucursal.

### 4.4 Historias de usuario y criterios de aceptación

Formato: historia → criterios (Given/When/Then abreviado). Las de módulos ✅ son la
especificación de lo construido (sirven como base de regresión); las 🔜 definen lo
próximo.

**HU-01 · Alta y primer menú (M1, M2)** ✅
Como dueño, quiero registrarme y publicar mi primera carta en menos de 30 minutos.

- La landing muestra Free/Basic/Pro con precio y features sin abrir un modal; el CTA
  conserva el plan elegido al entrar al formulario.
- Con Free, username libre y contraseña válida (≥8, no común), el alta inicia sesión
  y entra al panel. Con Basic/Pro hay checkout previo y activación por webhook.
- Si no acepto términos, el backend rechaza el alta (400).
- Al crear mi primer producto, la carta pública ya lo muestra sin pasos extra.
- Con plan Free, el producto 16 es rechazado por el servidor (403) y la UI me ofrece
  el upgrade.

**HU-02 · Editar precios rápido (M2)** ✅
Como dueño, quiero cambiar precios desde el celular en segundos.

- Editar el precio de un producto impacta la carta pública inmediatamente después de
  guardar (sin caché intermedia).
- El modelo y las vistas soportan precio nulo, pero el formulario actual exige
  precio positivo y código. Esa diferencia debe resolverse si se mantiene el
  criterio de crear productos “a consultar” desde el editor.
- Hay una regresión pendiente: el guardado general envía disponibilidad/visibilidad,
  pero `editItem` las ignora. No dar este caso por validado mientras fallen sus tests.

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
- Desde Basic, un rango con fecha y hora activa y desactiva la oferta automáticamente;
  sin rango, el precio promocional permanece activo de forma manual.
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
- Errores ordinarios se reportan por fila; una importación que exceda el límite del
  plan se rechaza antes de aplicar cambios.
- Basic no puede confirmar una importación que deje más de 50 productos; Pro no
  tiene límite.

**HU-08 · Cobrar suscripciones (M11)** ✅
Como plataforma, quiero cobrar sin intervención manual.

- Un alta paga crea un `PendingRegistration`; el checkout usa su id como
  `external_reference` y conserva un token opaco para consultar la activación. La
  contraseña temporal queda cifrada con AES-256-GCM hasta que el webhook crea el User.
- Volver atrás, cerrar la pestaña o reintentar recupera el alta pendiente y
  reutiliza la preferencia `ready` si conserva plan/período/importe/moneda. Cambiar
  la selección crea otro `PaymentCheckout` y otra preferencia sin mutar el snapshot
  anterior; el checkout reemplazado queda marcado `superseded`.
- Solo el webhook (firma HMAC verificada + consulta del pago real a la API de MP)
  crea la cuenta o cambia `User.subscription`. Cada pago queda primero en
  `PaymentTransaction`; los checkouts nuevos deben coincidir en asociación,
  operación, plan, período, importe y moneda. Una diferencia queda `not_applied`.
- El período elegido fija `subscriptionExpiresAt`; al completarse, el frontend hace
  un único login y redirige automáticamente al dashboard.
- Un usuario existente ve plan y vencimiento en el dashboard. Free puede elegir
  Basic/Pro; Basic puede renovar o subir a Pro; Pro puede renovar. La renovación
  vigente suma meses desde el vencimiento y la vencida desde la aprobación.
- Cada `paymentID` distinto extiende exactamente una vez dentro de una transacción
  MongoDB; un reintento del mismo pago no vuelve a sumar. Un checkout antiguo nunca
  baja el plan ni acorta una vigencia posterior y queda auditado para conciliación.
- Al volver del checkout, `AuthContext` reintenta `/users/me` para absorber la posible
  carrera con el webhook y persiste el plan/vencimiento actualizado.
- El alta o cambio de plan queda logueado como evento en el CRM.
- Las altas gratuitas y pagas generan slugs únicos legibles; las colisiones reciben
  sufijos incrementales y el backend reintenta las carreras contra el índice `unique`.
- La suite backend cubre el webhook, el cifrado temporal y las colisiones de slug.
- La revisión del 30-08-2026 reporta 93/95 tests backend; frontend lint/build pasan,
  typecheck falla por el módulo Planes en desarrollo. No equivale a E2E productivo.
- **Pendientes:** E2E autorizado en el despliegue a liberar, publicación del catálogo
  y PAY-05 (vencimiento explícito de preferencias upgrade/renovación). No cambiar
  precios productivos solo para probar.

**HU-09 · Gestionar clientes (M12)** ✅
Como CEO, quiero operar la cartera desde un solo lugar.

- Pipeline con etapas (lead → onboarding → activo → en riesgo → baja) en lista o
  kanban drag & drop; seguimientos vencidos con badge en el sidebar; export a Excel;
  historial que mezcla notas manuales con eventos automáticos del sistema.
- Tabla 360 ordenable con onboarding, último pago, plan/vencimiento y bandeja de
  atención; ficha enlazable con `?client=<id>` y Pagos filtrable con `?userID=<id>`.
- El dashboard carga estadísticas, CRM y pagos de forma independiente y mantiene
  lo disponible si falla una fuente. El importe acumulado **no es MRR**.

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
| Disponibilidad | Objetivo 99,5% mensual (Vercel + Koyeb + Atlas) | Objetivo, sin medición certificada en esta revisión |
| Accesibilidad | WAI-ARIA, focus-visible, tap targets ≥44 px, `prefers-reduced-motion`, sr-only | Patrones implementados; auditoría integral pendiente |
| Compatibilidad | Últimas 2 versiones de navegadores móviles y WebViews | Matriz de regresión pendiente; no validada aquí |
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
                    ├─ JWT auth (HS256) · requireFeature · isAdmin
                    ├─ Controllers (user/menu/item/admin/crm/massive/payment/adminPayment)
                    └─ Webhook MercadoPago (HMAC verificado)
                       │
        ┌──────────────┼───────────────────┐
        ▼              ▼                   ▼
  MongoDB Atlas   Cloudinary          MercadoPago
  (Mongoose 7)    (imágenes,          (checkout Pro,
                   upload_stream)      webhook de pagos)
```

- **Frontend**: SPA con code-splitting por ruta (`lazy()`), QueryClient disponible,
  aunque gran parte del panel aún usa fetch/axios y estado local; CSS Modules +
  design tokens globales. Cuatro "apps" en un
  build: landing comercial, panel del dueño, panel CEO, y las vistas públicas por
  slug (multi-tenant por URL).
- **Backend**: monolito Express modular (routes → middlewares → controllers →
  models). Conserva rate limits en memoria y un Chrome por proceso para PDF:
  escalar exige revisar límites compartidos, recursos y concurrencia de pagos.
- **Multi-tenancy**: ownership por documentos; `Menu.userID` identifica al dueño e
  `Item.menuID` hereda la pertenencia mediante la categoría. No todos los modelos
  tienen `userID` directo. El catálogo `Plan` es global, no por tenant.
- **Despliegue**: Vercel/Koyeb según configuración del proyecto; este trabajo no
  comprobó hooks de deploy, variables remotas ni correspondencia con `master`.
- **Catálogo integrado localmente**: `services/planCatalog.js` y `Plan` centralizan
  precios y features; la publicación y persistencia real siguen pendientes.

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
| `users` | Tenant + cuenta + suscripción/vencimiento + branding y horario del local | `username` único; `slug` único sparse |
| `menus` | Secciones y categorías (auto-referencia `sectionID`) | `userID` |
| `items` | Productos (precio, oferta+vigencia, `options` Map, flags) | `menuID`; `code` único por usuario (validación en app) |
| `pageviews` | Visitas diarias agregadas por local | único `{userID, date}` |
| `itemviews` | Vistas diarias agregadas por producto | único `{userID, itemID, date}` + `{userID, date}` |
| `crmprofiles` | CRM interno (etapa, tags, seguimiento, notas/eventos) — **aislado de `users` a propósito** | `userID` único |
| `pendingregistrations` | Altas pagas todavía no convertidas en User; conserva plan/período, token opaco hasheado y estado | `activationTokenHash` único sparse; TTL por `expiresAt` |
| `paymentcheckouts` | Snapshot durable e inmutable de asociación, plan, período, importe y moneda antes de abrir MercadoPago | `preferenceId` único sparse; `{userID, createdAt}`; `{pendingRegistrationID, createdAt}`; sin TTL |
| `paymenttransactions` | Historial financiero y resultado interno de cada pago/webhook, incluidos vencimientos antes/después y validación del checkout | `paymentID` único; `{userID, createdAt}`; `{pendingRegistrationID, createdAt}`; sin TTL |

`Plan` (`plans`) centraliza precios/promociones, multiplicadores y `features`
(booleanos, `item_limit` y `templateIds`), con `name` único, `updatedBy`, timestamps
 y versión `__v`. El arranque espera su inicialización y validación; no se consultó
Atlas. Cada plan define sus beneficios completos, sin herencia acumulativa.

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

- **Backups**: propuesta de backups diarios, retención y restore ensayado; verificar
  primero el tier y la configuración real de Atlas. No hay evidencia local que
  garantice snapshots o retención productiva.
- **Migraciones**: versionar y ensayar cambios de datos. El inicializador de `Plan`
  existe localmente con `$setOnInsert`, pero no se ejecuta en el arranque actual.
- **Retención**: `pageviews`/`itemviews` se conservan (son livianas y valen para
  tendencias anuales); `AuditLog` con TTL.
- **Datos personales**: existen credenciales, datos de contacto del dueño/local,
  aceptación de términos y notas CRM. El carrito actual no persiste comensales en
  backend. Una futura Order con nombre/teléfono requerirá definir consentimiento,
  retención y borrado antes de implementarla; 90 días no es una política vigente.

---

## 7. APIs

### 7.1 Convenciones ✅

- REST bajo `/api/*`, JSON; auth `Authorization: Bearer <JWT>` (HS256, expiración
  7 días).
- Autorización en capas: `protect` (identidad) → `isAdmin` (rol) →
  `requireFeature(feature)` (gating comercial) → ownership check en el controller (recurso).
- Errores: los controllers usan `{message}` con `handleError`; las rutas inline
  de pagos conservan también `{error}`. El frontend debe contemplar ambos formatos;
  no asumir un contrato uniforme todavía.
- Rate limits: 10 req/15 min en auth; 300 req/15 min general.
- Endpoints públicos de tracking responden `204` incondicional (fire-and-forget, no
  filtran existencia de recursos).

### 7.2 Catálogo actual ✅ (resumen; detalle en ARCHITECTURE.md)

| Recurso | Endpoints clave |
|---|---|
| Auth/cuenta | `POST /users/register` · `POST /users/login` · `GET /users/me` · `PUT /users/me` · `PATCH /users/template` · `PATCH /users/active` |
| Menú (gestión) | `GET /users/me/menu` · CRUD `/menus` y `/items` (+move/hide/available/upload) |
| Carta pública | `GET /users/:slug` · `GET /users/:slug/menu` · `POST /users/:slug/menu/items/:itemID/view` |
| Analítica dueño | `GET /users/me/stats` · `GET /users/me/item-stats` (permiso `estadisticas`) |
| Excel | `GET /massive/template` · `POST /massive/preview` · `POST /massive/confirm` (permisos `menu_editor` y `carga_masiva_excel`) |
| PDF | `GET /users/:slug/menu/pdf` (público, valida `menu_pdf` del local) |
| Pagos | `POST /payments/crear-preferencia` · `POST /payments/crear-preferencia-registro` · `POST /payments/registro/estado` · `POST /payments/webhook` |
| Admin/CRM | `GET /admin/stats` · `GET /admin/allUsers` · `PATCH /admin/users/:id/active` · `/admin/crm/*` (clients, notes, overdue-count, export) |
| Pagos admin | `GET /admin/payments` con filtros/paginación y `userID` opcional; solo lectura |

`GET /plans`, `GET /admin/plans` y `PATCH /admin/plans/:name` están montados
bajo `/api` en el código local; solo la lectura pública no requiere admin.

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

### 8.1 Controles presentes en código (no certificación de seguridad)

| Capa | Medida |
|---|---|
| Transporte/headers | `helmet`, CORP cross-origin y CORS con allowlist explícita; variables URL HTTPS exigidas en producción. TLS/despliegue no verificados en esta revisión |
| Autenticación | JWT HS256 con algoritmo **fijado** en la verificación (anti alg-confusion); bcrypt; política de contraseñas (≥8 + blocklist de comunes); expiración 7 días |
| Autorización | `protect`/`isAdmin`/`requireFeature` y ownership por recurso; límites, templates, Excel, PDF, programación y estadísticas se validan server-side. Esto no equivale a una auditoría integral anti-IDOR |
| Inyección | `express-mongo-sanitize` (scoped, excluye el webhook MP a propósito) + validación de tipos en login/registro (rechaza payloads no-string) |
| Abuso | `authLimiter` 10/15 min (anti fuerza bruta) + `apiLimiter` 300/15 min; límites de upload (imágenes 8 MB, Excel 5 MB en memoria) |
| Pagos | HMAC-SHA256, consulta real a MP, validación `live_mode`/`MP_ENV`, snapshot de checkout y auditoría antes de acreditar. Persistencia transaccional e idempotencia; catálogo integrado localmente, PAY-05 y despliegue pendientes |
| Fugas de información | `handleError` loguea server-side y responde genérico (sin stack traces/rutas); password con `select:false` |
| Contenido | Contacto limitado a campos vigentes al leer/editar; subidas restringidas por formato y transformadas en Cloudinary |
| Dependencias | Cloudinary v2 con storage propio y override `uuid` en ExcelJS presentes; no se ejecutó una auditoría de vulnerabilidades actual en esta revisión documental |

Las credenciales temporales de altas pagas están cifradas con AES-256-GCM y los
campos sensibles son `select:false`. No registrar cuerpos de requests, contraseñas,
correos, tokens, cabeceras Authorization ni URLs completas de checkout en diagnósticos.

### 8.2 Mapa de riesgos OWASP usado por el proyecto → controles y pendientes

| Riesgo | Estado |
|---|---|
| A01 Broken Access Control | Capas de autorización/ownership; falta revisión integral y AuditLog. La API de borrar notas CRM no distingue eventos |
| A02 Cryptographic Failures | bcrypt/JWT y AES-256-GCM para altas pendientes; tokens MP por local son roadmap |
| A03 Injection | Sanitización y validación de tipos; no garantía para todos los payloads |
| A04 Insecure Design | Gating y snapshot server-side presentes; Orders aún no existe |
| A05 Security Misconfiguration | helmet/CORS/trust proxy en código; configuración remota no comprobada |
| A06 Vulnerable Components | Dependencias y lockfile presentes; auditoría vigente/automatización pendientes |
| A07 Auth Failures | Rate limit y política de contraseñas; 2FA, recuperación de contraseña y revocación pendientes |
| A08 Data Integrity | Webhook firmado y snapshot durable; checkout exige versión del catálogo y rechaza cambios con 409 |
| A09 Logging/Monitoring | ⚠️ logs básicos — Sentry + alertas + AuditLog 🔜 |
| A10 SSRF | No se identificó un proxy genérico de URLs; revisar integraciones y renderizado PDF ante cambios |

La tabla organiza deuda técnica; no afirma conformidad ni reemplaza un pentest.

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
2. **El comensal no espera**: skeletons, imágenes lazy y animaciones cortas;
   comprobar LCP/CLS en mediciones, no inferir “cero layout shift” por tener skeletons.
3. **Tap targets ≥44 px**, `focus-visible` consistente con halo, navegación por
   teclado en patrones ARIA (tablist de la carta, diálogos, kanban).
4. **`prefers-reduced-motion`**: mantenerlo como criterio en cada animación;
   cobertura integral pendiente de regresión.
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
| `--t-*` (×15) | Carta pública y landing del local | Un bloque `[data-template]` por template; los premium suman `--t-bg-image` y `--t-btn-bg` metálico |

**Tipografías**: DM Sans (UI), Playfair Display (títulos de carta), Fraunces
(display de auth/landing), DM Mono (datos/precios del panel CEO).

**Los 15 templates** (producto, no solo estética — son el eje del gating):
Free: Clásico · Basic agrega Moderno, Natural, Rojo y Minimal (5 totales) ·
Pro agrega Aurora, Noir Gold, Coastal, Charcoal, Terracotta, Lavender, Forest,
Platinum, Ocean y Rosé (15 totales; varios usan degradés y botones metálicos).

**Patrones canónicos ya construidos**: cards con hover spotlight, drawers
(carrito, detalle CRM), bottom-sheet de acciones, kanban drag & drop, steppers de
cantidad, toggles con spring, badges semánticos, spinners centralizados (página
completa / inline / botón), skeletons por vista, estados vacíos y not-found
compartidos (`.t-notfound*`). La landing comercial expone las tarjetas de planes
inline y usa un CTA propio por plan, evitando un modal adicional en el embudo.

**Regla de oro del CSS**: lo repetido en 2+ módulos se centraliza en
`src/styles/globals.css`; lo específico queda en su CSS Module. No es una garantía
de ausencia de duplicados: conviven `Spinner` y loaders directos `pageLoaderRing`.
Marca (`BrandMark`), publicidad Free y dock mobile son patrones compartidos.
El editor incorpora secciones progresivas y búsqueda; su QA histórico y las
diferencias actuales están en [design-qa.md](design-qa.md).

### 9.3 Deuda y evolución de UX 🔜

- Focus management completo en CartDrawer (trap + retorno de foco) y `aria-controls`
  en el botón de variantes.
- Contraste de `--admin-text-faint` en tema claro (borderline WCAG AA).
- Affordance de scroll del kanban en mobile.
- Auditoría Lighthouse/axe formal por release (hoy es manual).
- Modo offline básico de la carta (PWA liviana) — evaluar demanda real antes.

---

## 10. Modelo de negocio

### 10.1 Pricing del código local (ARS, 30-08-2026)

| Plan | Precio | Equivalente mensual | Desbloquea |
|---|---|---|---|
| **Gratis** | $0 | $0 | Menú/editor, landing, QR, pedido por WhatsApp, hasta 15 productos y publicidad |
| **Basic** | $29.999/mes base | Según período | Hasta 50 productos, sin publicidad, Excel, programación, PDF y 5 diseños |
| **Pro** | $49.999/mes base | Según período | Todo Basic + productos ilimitados, métricas y 15 diseños |

Totales de referencia de las semillas iniciales (sin promociones; los vigentes
se calculan con MongoDB en `getCheckoutQuote`):

| Período | Multiplicador | Basic | Pro |
|---|---|---|---|
| 1 mes | 1 | $29.999 | $49.999 |
| 3 meses | 2,7 | $80.997 | $134.997 |
| 6 meses | 5 | $149.995 | $249.995 |
| 12 meses | 9 | $269.991 | $449.991 |

Mecánica de monetización: el **prepago largo se premia** (3 meses ≈10% off,
6 meses ≈17% y 12 meses 25%); el plan Free hace marketing
(publicidad de la plataforma en cartas gratuitas) y alimenta el pipeline del CRM.
La selección nace en la landing y viaja por query string al registro; Free crea la
cuenta sin checkout, mientras Basic/Pro confirman período antes de abrir MercadoPago.

**Control de liberación pendiente:** antes de dar por cerrado el flujo productivo,
confirmar los despliegues de Vercel/Koyeb, `NODE_ENV=production`/`MP_ENV=production`,
URLs y secreto del webhook. Validar un pago real solo con autorización e importe
acordado, usando comprador distinto del vendedor.
Verificar preferencia, monto, moneda, `checkout_id`, webhook, `PaymentCheckout`,
`PaymentTransaction`, plan y `subscriptionExpiresAt`, estado `completed` del alta,
evento CRM, redirección y sincronización del dashboard. No modificar precios
productivos únicamente para probar. Esta revisión no certifica que el E2E se haya
realizado ni que estos precios estén desplegados.

**Nota operativa**: precios y beneficios vigentes se administran en MongoDB desde
`/admin/plans`; el frontend consume ese catálogo. Las tablas de este documento son
una referencia de la configuración inicial, no una consulta en vivo. Los beneficios
se aplican a todos los usuarios del plan en su siguiente consulta. Los precios
nuevos afectan nuevos checkouts, sin reescribir snapshots anteriores. Falta publicar
y validar el [rollout](docs/PLAN_CATALOG_ROLLOUT.md) con la base real.

**PAY-05, independiente del catálogo:** el registro configura siete días de vigencia
de preferencia y tres días extra de conservación del pending. Upgrade/renovación
no envían expiración explícita ni `PaymentCheckout` guarda `preferenceExpiresAt`.
Propuesta pendiente: fecha server-side inmutable, sin TTL de auditoría, y pruebas
de pagos aprobados cerca del límite con webhooks tardíos. No confundirlo con
`subscriptionExpiresAt`, que sí existe.

### 10.2 Unit economics (supuestos explícitos, base 2026)

- **ARPU de lista**: 70% Basic + 30% Pro = **$35.999/mes**.
- **ARPU efectivo de referencia**: **$32.399,10/mes**, aplicando una previsión promedio
  de 10% por descuentos de prepago. Debe reemplazarse por la mezcla real cuando haya
  suficiente volumen.
- **CAC objetivo hipotético por canal**: partnerships ≤1 mes de ARPU (~$32.399);
  paid, si se activa, ≤3 meses (~$97.197). Ambos límites deben revisarse sobre margen
  de contribución, no solo facturación.
- **LTV bruto de ingresos** con churn de 3%/mes: vida media ~33 meses y
  **$1.079.970 por cliente** (`ARPU / 0,03`, vida media 33,33 meses). El LTV financiero debe descontar MercadoPago, impuestos,
  devoluciones, soporte e infraestructura.
- **Infra/tooling**: se mantiene la hipótesis de USD 50–100/mes, pero el punto de
  cobertura se calcula cada mes como `costos fijos ARS / margen de contribución por
  suscripción`; no se fija una cantidad mientras costo y facturación estén en monedas
  distintas.
- Todos los valores siguientes están expresados en **pesos constantes de agosto 2026**,
  antes de comisiones, impuestos, devoluciones e inflación futura.

| Escenario hipotético (24 meses) | Locales pagos | MRR normalizado | ARR anualizado |
|---|---|---|---|
| Piso | 300 | $9.719.730 ARS | $116.636.760 ARS |
| Base | 600 | $19.439.460 ARS | $233.273.520 ARS |
| Techo | 900 | $29.159.190 ARS | $349.910.280 ARS |

Fórmulas: `MRR = locales pagos × 32.399,10`; `ARR = MRR × 12`. Son escenarios,
no ingresos reales ni caja mensual: el prepago cobra varios meses juntos. El panel
CEO actual muestra importe acumulado con plan aplicado, no estos indicadores.

### 10.3 Líneas de ingreso futuras 🔜

1. **Fee por pedido online (M13)**: `marketplace_fee` de 1–3% sobre pedidos cobrados
   vía MP Connect — opt-in, transparente, alineado con "te ayudo a vender". Es el
   camino de expansión de revenue que no depende de subir la suscripción.
2. **Add-ons**: IA de contenido por paquete de usos, sucursal adicional.
3. **Partnerships con revenue share**: distribuidores gastronómicos e imprentas de
   QR que revenden el alta.

---

## 11. Roadmap

Cadencia trimestral propuesta; fechas e hitos deben reconfirmarse según capacidad.
Carrito, WhatsApp y analítica por plato están implementados; no se volvió
a verificar su despliegue en esta revisión.

**Pendientes inmediatos de la base actual (sin sustituir el roadmap):** cerrar
regresiones locales, publicar y validar el catálogo, completar PAY-05 y registrar evidencia
del E2E. El módulo Pagos ya consulta el historial, pero no ejecuta conciliaciones
ni reembolsos. Nuevas colecciones, servicios externos y flujos de pagos requieren
decisión explícita de arquitectura; las propuestas siguientes no son autorización
para implementarlas ni compromisos comerciales.

### Q3 2026 — "Cobrar pedidos" (M13 + base M14)

- MercadoPago Connect (OAuth por local, tokens cifrados, refresh).
- Modelo `Order` + checkout online en el CartDrawer (la zona de acciones ya está
  preparada para sumar el botón sin reestructurar).
- Webhook de pedidos idempotente; panel mínimo de pedidos (lista + cambio de estado).
- Seguridad que lo acompaña: `ENCRYPTION_KEY`, AuditLog de cobros, Sentry.
- **Criterio de salida**: 10 locales cobrando pedidos reales; 0 incidentes de
  conciliación; fee configurado y reportado.

### Q4 2026 — "Operar el pedido" (M14 completo)

- Panel de pedidos en tiempo real (SSE), número de pedido cantable, aviso sonoro.
- Estados de pedido con notificación al comensal por WhatsApp (link de estado).
- Prerender de `/:slug` y `/:slug/menu` + sitemap (SEO local como canal).
- **Criterio de salida**: mediana de "pedido nuevo → visto por el local" <60 s.

### Q1 2027 — "Equipo e inteligencia" (M15 + M16)

- Roles staff con invitaciones y AuditLog.
- IA v1: descripciones de platos + resumen mensual automático de stats ("tu top 3
  creció 20%, considerá destacarlo") por email/WhatsApp.
- Refresh tokens + 2FA admin.
- **Criterio de salida**: 30% de cuentas activas con ≥1 staff o ≥1 uso de IA/mes.

### Q2 2027 — "Retener y crecer" (M17/M18, exploración M19)

- Reservas con agenda (distintas del enlace WhatsApp ya existente) o fidelización
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

La tabla define indicadores objetivo. Actualmente el CEO muestra conteos de clientes,
contenido, distribución del plan guardado, alertas e importes acumulados de pagos.
MRR/ARR, churn, cohortes, CAC y NRR no están calculados automáticamente.

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
  frecuencia de edición de precios y descargas de QR.
- **Embudos**: carta → carrito → click WhatsApp y free → paywall → checkout → pago
  aprobado. Hoy hay visitas agregadas y trazabilidad de pagos, pero no eventos
  client-side que permitan reconstruir esos embudos completos.

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
4. **Referidos in-product** 🔜 (Q2 2027): mes gratis por local referido pagador;
   actualmente puede anotarse origen en tags/notas, pero `CrmProfile` no tiene un
   campo de atribución ni un sistema de referidos estructurado.
5. **Contenido práctico**: guías cortas ("cómo compartir tu carta QR", "cómo armar
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

Estos puntajes son estimaciones internas, no mediciones recalculadas desde clientes.
Antes de tomar nuevas iniciativas, resolver o aceptar explícitamente:

- Despliegue y verificación real del catálogo integrado localmente.
- Persistencia/validación de flags del formulario de productos (2 tests fallidos).
- PAY-05 y evidencia de E2E del flujo de suscripciones.
- Revalidación visual del editor; su registro histórico no refleja el código actual.

| # | Iniciativa | R | I | C | E | RICE | Fase |
|---|---|---|---|---|---|---|---|
| 1 | MP Connect + Order + checkout online | 8 | 3 | 0,8 | 6 | 3,2 | Q3-26 |
| 2 | Sentry + uptime + alertas | 10 | 1 | 1,0 | 1 | 10,0 | Q3-26 |
| 3 | Eventos client-side (embudo carrito→WA) | 9 | 1 | 0,9 | 1,5 | 5,4 | Q3-26 |
| 4 | Panel de pedidos tiempo real (SSE) | 7 | 3 | 0,8 | 4 | 4,2 | Q4-26 |
| 5 | Prerender público + sitemap (SEO) | 9 | 2 | 0,7 | 3 | 4,2 | Q4-26 |
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
| Dependencia de MercadoPago (proveedor único de cobro) | Media | Alto | Mantener auditoría durable; definir monitoreo y procedimiento alternativo. No hay adaptador multi-proveedor ni activación manual documentada como flujo vigente |
| Bus factor = 1 (equipo de una persona) | Alta | Alto | ARCHITECTURE.md + este blueprint como memoria externa; automatización de deploy/backup; priorizar simplicidad técnica (monolito, pocas piezas) |
| Incidente de seguridad con dinero de terceros (post-M13) | Baja | Crítico | §8.3 punto 1 completo **antes** de GA de pedidos; fee y flujos auditados; pentest al hito 1.000 |
| Churn por "lo probé y no me trajo clientes" | Media | Alto | Onboarding guiado (#25), resumen mensual de valor (#9), north star = pedidos generados; CRM detecta "en riesgo" temprano |
| WhatsApp cambia políticas de links `wa.me` | Baja | Medio | Evaluar mensaje copiable y canal alternativo; pagos online M13 todavía no existen |
| Inflación desactualiza precios de cartas (mala imagen del rubro) | Media | Medio | Excel masivo ya existe; explorar "ajuste % masivo" de un click (candidato a backlog) |

---

## 16. Referencias

**Fuentes primarias consultadas el 30-08-2026**:

- [FEHGRA — acerca de la entidad](https://fehgra.org.ar/acerca-de-fehgra): referencia
  de 84.000 empresas / 67.000 establecimientos gastronómicos.
- [OlaClick — oferta publicada en Brasil](https://olaclick.com/cardapio-digital/).
- [GloriaFood — pricing publicado](https://www.gloriafood.com/pricing).
- [Pedix — oferta Argentina](https://info.pedix.app/ar/).
- [lacartaa — planes y funcionalidades](https://www.lacartaa.com/).

**Antecedentes conservados de la versión anterior, no revalidados como datos actuales**:

- [FEHGRA — cobertura de datos sectoriales](https://argentina.ladevi.info/actualidad/fehgra-los-datos-que-marcan-la-realidad-del-sector-n82775).
- [Ficha sectorial gastronomía CABA — Jun 2025](https://buenosaires.gob.ar/sites/default/files/2025-07/Ficha%20Gastronom%C3%ADa%20-%20Junio%202025.pdf)
- [Caída de actividad del sector](https://www.trtespanol.com/article/f31ef495ccf0)
- Larga cola local: [SoyMenu](https://soymenu.com.ar/) · [Recafy](https://www.recafy.com/carta-menu-digital-qr-buenos-aires-argentina/) · [RestoMenu QR](https://www.restomenuqr.com.ar/) · [cartadigital.gratis](https://www.cartadigital.gratis/menu-digital-qr-buenos-aires-argentina/) · [menudigital.ar](https://menudigital.ar/)

**Internas**:

- [ARCHITECTURE.md](ARCHITECTURE.md) — documentación técnica archivo por archivo
  (modelos, endpoints, componentes, design system).
- Pricing y beneficios: colección `plans`, modelo `Plan` y `services/planCatalog.js`
  en backend. Frontend consume `api/plans.ts`/`usePlans`.
- Gating: `requireFeature` y controllers consultan MongoDB; `config/plans.js`
  conserva orden, IDs, validadores y plan efectivo, sin asignaciones comerciales.
- [Catálogo y rollout pendiente](docs/PLAN_CATALOG_ROLLOUT.md),
  [Design QA](design-qa.md) y [dev log backend](../menu-digital-backend/DEVLOG-LUCAS.md).

---

*Versión 2 — revisión documental del 30 de agosto de 2026. Fuentes: código local,
verificaciones ejecutadas y páginas primarias indicadas. Revisar al cambiar precios,
integraciones o estado de despliegue, además del seguimiento trimestral del roadmap.*
