# MenuDigital — Arquitectura de la aplicación

Documentación técnica de los dos repositorios que componen **MenuDigital**, un
SaaS de menús/cartas digitales para bares y restaurantes de Argentina. Describe
cada archivo de código y cada función (los `.module.css` por componente no se
documentan; `styles/globals.css` sí, por ser la fuente compartida de tokens,
keyframes y utilidades — ver [styles/](#styles)).

- **Frontend** (`menu-digital-frontend`): React 19 + TypeScript + Vite. Deploy en Vercel.
- **Backend** (`menu-digital-backend`): Node + Express 4 + Mongoose 7 (MongoDB Atlas). Deploy en Koyeb.
- **Servicios externos**: Cloudinary (imágenes), MercadoPago (pagos).

Modelo de negocio: el dueño elige `free`, `basic` o `pro` antes de completar el alta.
Free crea la cuenta sin checkout; Basic/Pro crean un registro pendiente y pasan por
MercadoPago antes de crear el `User`. Luego carga su menú y obtiene una carta pública
en `menudigitalapp.com.ar/<slug>/menu`. Los planes pagos desbloquean features de forma
escalonada.

> **Continuación obligatoria (22-08-2026):** antes de cualquier otro cambio, ejecutar
> la prueba end-to-end de MercadoPago con importes bajos documentada en `BLUEPRINT.md`
> §10.1. Los tests automatizados pasan; falta validar el circuito desplegado real.

---

## Índice

- [Backend](#backend)
  - [Entry point](#entry-point-srcappjs)
  - [config/](#config)
  - [models/](#models)
  - [middleware/](#middleware)
  - [controllers/](#controllers)
  - [routes/](#routes)
  - [utils/](#utils)
- [Frontend](#frontend)
  - [Entry / bootstrap](#entry--bootstrap)
  - [routes/](#frontend-routes)
  - [context/](#context)
  - [hooks/](#hooks)
  - [lib/](#lib)
  - [api/](#api)
  - [types/](#types)
  - [components/](#components)
  - [pages/](#pages)
  - [Utils/](#utils-frontend)
  - [styles/](#styles)
- [Flujos clave](#flujos-clave)

---

# Backend

Estructura: `src/{app.js, config, models, middleware, controllers, routes, utils}`.
Todos los controllers capturan errores con `handleError` (nunca filtran stack
traces al cliente).

## Entry point — `src/app.js`

Arma la app Express y arranca el servidor.

- Conecta a la base (`connectDB()`).
- `app.set("trust proxy", 1)` — necesario detrás del balanceador de Koyeb para que
  `req.ip` sea la IP real del cliente (lo usa el rate limiter).
- Middlewares globales, en orden:
  - `helmet(...)` con `crossOriginResourcePolicy: "cross-origin"` (la API se consume
    desde otro origen: el frontend en Vercel).
  - `cors(...)` con allowlist explícita (Vercel prod + `localhost:5173/3000`).
  - `express.json()` + `express.urlencoded()`.
  - `express-mongo-sanitize` — **solo** en `/api/users|menus|items|admin|massive`
    (excluye `/api/payments` a propósito: el webhook de MercadoPago manda un query
    param `data.id` con punto, que el sanitizer eliminaría).
  - `apiLimiter` en `/api`.
- Monta los routers: `/api/admin`, `/api/users`, `/api/menus`, `/api/items`,
  `/api/massive`, `/api/payments`.
- Rutas sueltas: `GET /ping` (health check con log), `GET /:businessName/menu`
  (redirect legacy), `GET /` (status JSON).
- Handler 404 y, al final, el **error middleware** `(err, req, res, next)` que
  centraliza en `handleError` cualquier error no atrapado (ej: JSON malformado).

## config/

### `config/db.js`
- **`connectDB()`** — conecta Mongoose a `MONGODB_URI`. Antes fuerza los DNS a
  Google/Cloudflare (`dns.setServers(["8.8.8.8","1.1.1.1"])`) porque el resolver
  de c-ares bloquea las consultas SRV de Atlas. Si falla, corta el proceso.

### `config/plans.js`
Fuente de verdad del sistema de planes. Exporta:
- **`PLAN_MAP`** — mapea el `plan_id` que viaja en el pago de MercadoPago
  (`basic/pro`) al valor interno de `User.subscription`. Hoy 1:1; se
  mantiene como capa de validación (el webhook rechaza plan_ids desconocidos).
- **`PLAN_ORDER`** = `["free","basic","pro"]`. El índice ES la jerarquía.
- **`PLAN_FEATURES`** — features que desbloquea cada nivel (acumulativo).
  La landing pública pertenece a Free; Basic elimina publicidad y suma Excel,
  programación y PDF; Pro suma estadísticas, ilimitados y reseñas.
- **`ITEM_LIMITS`**, **`FREE_ITEM_LIMIT`** y **`BASIC_ITEM_LIMIT`** — topes: Free 15,
  Basic 50 y Pro sin límite; `getItemLimit(plan)` resuelve el valor efectivo.
- **`TEMPLATE_MIN_PLAN`** — mapa `templateId → plan mínimo` (gating escalonado de
  templates). Free: 1 diseño · Basic: 5 diseños totales · Pro: 15 diseños totales.
- **`getFeaturesForPlan(plan)`** — devuelve todas las features de un plan y los
  inferiores.
- **`hasMinPlan(userPlan, requiredPlan)`** — `true` si el plan del user alcanza el
  mínimo (compara índices en `PLAN_ORDER`).

### `config/cloudinary.js`
- Configura el SDK `cloudinary.v2` con las credenciales del `.env`.
- Define 3 `CloudinaryStorage` (storage engine propio, ver abajo) para carpetas
  `menu-digital/{users,menus,items}`, con `allowed_formats` y `transformation`
  (límite de ancho).
- `IMAGE_SIZE_LIMIT` = 8MB, aplicado a las 3 instancias de `multer`.
- Exporta `cloudinary`, `uploadUser`, `uploadMenu`, `uploadItem` (middlewares multer).

### `config/cloudinaryStorage.js`
Storage engine de Multer propio que sube directo a Cloudinary vía `upload_stream`
(reemplazó a `multer-storage-cloudinary`, que arrastraba una versión vulnerable de
`cloudinary@1.x`).
- **`class CloudinaryStorage`** — constructor recibe `{ cloudinary, params }`.
  - **`_handleFile(req, file, cb)`** — streamea el archivo al `upload_stream`; en el
    callback devuelve `{ path: secure_url, size: bytes, filename: public_id }` (mismos
    campos que consumen los controllers: `req.file.path`).
  - **`_removeFile(req, file, cb)`** — `destroy(file.filename)` para revertir subidas.

## models/

### `models/User.js`
Schema del dueño de local. Campos: `username` (único), `password` (hasheado,
`select:false`, min 8), `slug` (URL pública), `active`, `admin`, `subscription`
(enum `free/basic/pro`, default `free`), `subscriptionExpiresAt` (fin de vigencia
paga; null para free y cuentas legacy), `menu` (bool, si ya creó menú),
`hasDelivery`, `template` (nº, default 1), `contactInfo` (objeto: businessName, mail,
number, address, social, `googleReviewUrl` — link "Dejanos tu reseña" de Google Maps),
`media` (pictures[], backgroundPicture), `acceptedTerms*`. `timestamps`. Incluye hook
de hasheo de password con bcrypt.

### `models/Menu.js`
Cada documento es una **sección o categoría** del menú de un local. Campos: `userID`
(ref User), `sectionID` (ref a otro Menu, para anidar categorías dentro de secciones;
null si no tiene), `code`, `title` (requerido), `description`, `image`, `section`
(bool: true = sección contenedora, false = categoría con items), `hidden`. `timestamps`.

### `models/Item.js`
Un **producto** del menú. Campos: `menuID` (ref Menu), `code`, `title` (requerido),
`description`, `price` (null = sin precio), `offerPrice`, `offerRange` (`{from,to}`
con fecha y hora de vigencia de la oferta), `options` (Map string→number, ej variantes de
tamaño), `image`, `available`, `availabilitySchedule` (programación semanal
`enabled` + hasta 4 rangos `{from,to}` por día), `isExtra`, `recommended`, `hidden`, `apt` (objeto
libre: alérgenos, calorías...). `timestamps`.

### `models/PageView.js`
Agregado **diario** de visitas a la carta pública (una fila por local por día, con un
contador). `userID` (ref User), `date` (string `"YYYY-MM-DD"`), `count`. Índice único
`{userID, date}`. Se guarda como string (no Date) para hacer upsert por día sin lidiar
con husos horarios en la query.

### `models/ItemView.js`
Igual que PageView pero a **nivel de producto**: cuántas veces se tocó cada item de la
carta, agregado por día. `userID` (ref User), `itemID` (ref Item), `date` (string
`"YYYY-MM-DD"` en horario BA), `count`. Índice único `{userID, itemID, date}` + índice
secundario `{userID, date}` para la agregación de "top platos". Guarda `userID`
denormalizado (derivable vía Item→Menu→User) para que la consulta no necesite joins.

### `models/CrmProfile.js`
Datos de **CRM** de un cliente (un local suscripto), para uso interno del panel del CEO.
Vive en su propia colección — NO se mete en User — a propósito: así estos datos internos
nunca se filtran por los endpoints públicos de usuario. `userID` (ref User, único),
`stage` (enum del pipeline: `lead/onboarding/activo/en_riesgo/baja`), `tags [String]`,
`nextFollowUp` (Date), `notes` (subdocs `{text, kind, author, createdAt}`). `kind`
distingue notas manuales (`"note"`) de **eventos automáticos del sistema** (`"event"`:
cambio de plan, activar/desactivar cuenta, cambio de template — ver `utils/crmEvents.js`).
Exporta también `STAGES`.

### `models/PendingRegistration.js`
Alta paga todavía no convertida en `User`. Guarda temporalmente los datos de
registro, plan y período, junto con el hash de un token opaco de activación y
el `preferenceId/initPoint` de MercadoPago. Un retry recupera este documento y
actualiza la misma preferencia en vez de crear otro checkout cobrable.
`status` recorre `pending/completed/failed`; al completar elimina la contraseña,
enlaza `userID` y un índice TTL limpia el documento vencido.

## middleware/

### `middleware/auth.js`
- **`protect(req,res,next)`** — exige `Authorization: Bearer <jwt>`. Verifica el token
  (`jwt.verify` con `algorithms:["HS256"]` fijado como defensa contra confusión de
  algoritmo), carga el user en `req.user` (sin password), rechaza si no existe o si la
  cuenta está desactivada (salvo admins), y expone `free` como plan efectivo si la
  suscripción paga ya venció.
- **`isAdmin(req,res,next)`** — 403 si `req.user.admin` no es true. Se usa después de
  `protect`.
- **`requirePlan(minPlan)`** — factory: devuelve un middleware que corta con 403 si
  `hasMinPlan(req.user.subscription, minPlan)` es false.

### `middleware/rateLimiters.js`
- **`authLimiter`** — 10 req / 15 min. Para login y registro (anti brute-force).
- **`apiLimiter`** — 300 req / 15 min. Red de contención general en toda la API.

## controllers/

### `controllers/userController.js`
Helpers internos:
- **`trackView(userID)`** — suma 1 a la visita de hoy del local (upsert no bloqueante).
  El "hoy" se calcula en horario de Buenos Aires (`buenosAiresDateStr`).
- **`trackItemView(userID, itemID)`** — mismo patrón que `trackView`, a nivel de
  producto (colección `ItemView`).
- **`generateToken(id)`** — firma un JWT HS256 con el id, expira en `JWT_EXPIRES_IN`.
- **`generateSlug(name)`** — normaliza un nombre a slug URL-friendly (saca acentos,
  espacios→guiones, colapsa guiones).
- **`isWeakPassword(password)`** — `true` si tiene < 8 chars o está en un blocklist de
  contraseñas comunes.

Endpoints:
- **`newUser`** `POST /api/users/register` — valida tipos (anti NoSQL injection),
  términos aceptados, fuerza de password; crea el user (slug desde businessName o
  username), devuelve token.
- **`loginUser`** `POST /api/users/login` — valida credenciales, compara con bcrypt,
  devuelve token.
- **`getAuthUser`** `GET /api/users/me` — datos del user autenticado + `itemCount` y
  `categoryCount` (para el dashboard).
- **`fetchUserWithMenu`** `GET /api/users/:slug/menu` — carta **pública** por slug:
  arma el menú agrupado (secciones→categorías→items), filtra ocultos, y dispara
  `trackView`. Para Basic+ combina el interruptor manual `available` con la programación
  semanal del producto en horario de Buenos Aires; fuera de horario el item permanece
  visible como no disponible. Es lo que renderiza la carta pública.
- **`fetchOwnMenu`** `GET /api/users/me/menu` — menú del dueño autenticado, **sin**
  filtrar ocultos (para gestionarlos en el editor) + objeto `limits`
  (`itemCount`, `itemLimit`, `canImportExcel`, `canExportPdf`, `canScheduleItems`) para
  la UI de gating.
- **`fetchStats`** `GET /api/users/me/stats` (plan pro+) — devuelve `totalViews` y la
  serie `last30Days` (30 puntos, rellenando días sin visitas con 0), con las fechas
  calculadas en horario de Buenos Aires.
- **`trackItemViewEndpoint`** `POST /api/users/:slug/menu/items/:itemID/view` (público) —
  registra que se tocó un producto de la carta. Resuelve el dueño desde el **slug** (no
  confía en un userID del cliente) y valida que el item sea realmente de ese local antes
  de contarlo. Responde siempre `204` (fire-and-forget, nunca rompe la experiencia).
- **`fetchItemStats`** `GET /api/users/me/item-stats` (plan pro+) — top 10 de productos
  más vistos en los últimos 30 días (agregación sobre `ItemView` + join contra `Item`
  para título/imagen; un producto borrado se muestra como "(producto eliminado)").
- **`fetchUser`** `GET /api/users/:slug` — datos públicos de un local (landing por
  slug), disponible desde Basic; Free recibe 403 y el frontend deriva a la carta.
- **`downloadMenuPdf`** `GET /api/users/:slug/menu/pdf` — genera el menú imprimible,
  disponible desde Basic aunque la URL sea pública; excluye productos manualmente
  pausados o fuera de su horario programado.
- **`editUser`** `PUT /api/users/me` — edita `contactInfo/hasDelivery/media` (whitelist;
  `template` queda afuera a propósito, va por `useTemplate`). `googleReviewUrl` es el
  link/Place ID de reseñas requieren Pro y el link debe empezar con `http(s)://`.
- **`uploadImage`** / **`uploadBackground`** — suben foto a la galería / de fondo del
  local (a Cloudinary).
- **`removeImage`** / **`deleteBackground`** — sacan una foto de la galería / el fondo.
- **`useTemplate`** `PATCH /api/users/template` — cambia el template; valida contra
  `TEMPLATE_MIN_PLAN` (id conocido + plan suficiente). **Barrera real** del gating de
  templates. Si el template realmente cambió, loguea un evento de CRM (`logCrmEvent`).
- **`setActive`** `PATCH /api/users/active` — el dueño activa/desactiva su propia cuenta.

### `controllers/menuController.js`
- **`verifyOwnership(menuID, userID)`** — helper: 404 si no existe, 403 si el menú no es
  del user.
- **`newMenu`** `POST /api/menus` — crea sección/categoría (code único por usuario);
  marca `User.menu = true`.
- **`editMenu`** `PUT /api/menus/:menuID` — edita `title/description/code` (whitelist),
  revalida unicidad de code.
- **`moveMenu`** `PATCH /api/menus/:menuID/move` — mueve una categoría a otra sección (o
  la saca, `sectionID:null`).
- **`hideMenu`** `PATCH /api/menus/:menuID/hidden` — oculta/muestra sin borrar.
- **`deleteMenu`** `DELETE /api/menus/:menuID` — elimina **solo si está vacía** (sección
  sin categorías / categoría sin items).
- **`uploadImage`** `POST /api/menus/:menuID/upload-image` — foto de la categoría.

### `controllers/itemController.js`
- **`verifyMenuOwnership(menuID, userID)`** — igual patrón que arriba.
- **`newItem`** `POST /api/items` — crea producto; aplica el tope escalonado (Free 15,
  Basic 50, Pro ilimitado), protege la programación de ofertas y disponibilidad desde
  Basic, valida horarios/solapamientos y la unicidad de `code` **por usuario** (no global).
- **`editItem`** `PUT /api/items/:itemID` — edita campos de contenido (whitelist);
  unicidad de code por usuario solo si cambia.
- **`moveItem`** `PATCH /api/items/:itemID/move` — mueve el item a otra categoría
  (verifica ownership de origen y destino).
- **`uploadImage`** `POST /api/items/:itemID/upload-image` — foto del producto.
- **`setHidden`** / **`setAvailable`** — togglean visibilidad / disponibilidad.
- **`deleteItem`** `DELETE /api/items/:itemID` — elimina el producto.

### `controllers/adminController.js` (rutas admin/CEO)
- **`getAllUsers`** `GET /api/admin/allUsers` — lista todos los usuarios (sin password).
- **`getUser`** `GET /api/admin/:userID` — un usuario por id.
- **`setActiveUser`** `PATCH /api/admin/users/:userID/active` — activa/desactiva a
  cualquier cliente (no a sí mismo ni a otros admins). Loguea el evento en el CRM
  ("Cuenta activada/desactivada por el CEO").
- **`getStats`** `GET /api/admin/stats` — métricas globales de la plataforma (usuarios
  activos/inactivos/con menú, totales de menús/secciones/categorías/items, 5 usuarios
  recientes), todo en queries paralelas.

### `controllers/massiveController.js` (importar/exportar Excel — plan basic+)
- **`parseBool(val)`** — normaliza `"SI"/"NO"` a boolean.
- **`styleHeader(row)`** — estiliza la fila de encabezado del Excel generado.
- **`getTemplate`** `GET /api/massive/template` — genera y descarga el `.xlsx` con los
  datos actuales del local (hoja Instrucciones + hoja Categorías + hoja Productos). Se
  usa tanto para **exportar** como para editar y reimportar.
- **`parseExcel(buffer)`** — parsea las hojas Categorías/Productos del Excel subido a
  arrays de filas.
- **`parseDate(val)`** — parsea `DD/MM/AAAA` a `Date` o null.
- **`previewMassive`** `POST /api/massive/preview` — procesa el Excel y devuelve el
  **resumen** de cambios (a crear / actualizar / errores) sin guardar nada.
- **`confirmMassive`** `POST /api/massive/confirm` — aplica los cambios fila por fila
  (categorías primero, después productos) e informa qué se creó/actualizó/falló.

### `controllers/crmController.js` (CRM interno — admin)
Todas las rutas pasan por protect + isAdmin. `defaultProfile()` / `isValidId()` helpers,
más `STAGE_LABEL`/`PLAN_LABEL` (etiquetas legibles para el Excel exportado).
- **`listClients`** `GET /api/admin/crm/clients` — lista de clientes (locales) enriquecida
  con su etapa/tags/próximo seguimiento (dos queries que se cruzan en memoria).
- **`getClient`** `GET /api/admin/crm/clients/:userID` — detalle: datos del local + su
  perfil de CRM (o default) + resumen de actividad (categorías/secciones/items).
- **`updateProfile`** `PATCH /.../:userID` — actualiza etapa/tags/nextFollowUp (upsert;
  valida la etapa y que el user exista).
- **`addNote`** `POST /.../:userID/notes` — agrega una nota (autor = admin logueado).
- **`deleteNote`** `DELETE /.../:userID/notes/:noteID` — borra una nota puntual.
- **`getOverdueCount`** `GET /api/admin/crm/overdue-count` — cantidad de clientes con
  seguimiento vencido (`nextFollowUp` en el pasado). Endpoint liviano para el badge de
  alerta del sidebar del panel.
- **`exportClients`** `GET /api/admin/crm/export?stage=` — exporta el listado (opcional
  filtrado por etapa) a un `.xlsx` con ExcelJS (mismo patrón que el exportador de menús).

### `controllers/paymentController.js` (MercadoPago)
- **`verifyMpSignature(req)`** — valida la firma HMAC-SHA256 del header `x-signature`
  contra `MP_WEBHOOK_SECRET` (con `timingSafeEqual`). Si el secret no está configurado,
  no bloquea pero avisa por consola.
- **`getRegistrationStatus`** `POST /api/payments/registro/estado` — consulta con el
  token opaco si el alta paga sigue pendiente, se completó o falló.
- **`mpWebhook`** `POST /api/payments/webhook` — endpoint que llama MercadoPago. Verifica
  firma, consulta el estado **real** del pago contra la API de MP (nunca confía en el
  query string), y si está `approved` crea el `User` de un alta pendiente o actualiza
  una cuenta existente. En altas fija `subscriptionExpiresAt`, elimina la contraseña
  temporal y habilita el login automático. En upgrades fija la vigencia desde la
  aprobación; en renovaciones anticipadas suma meses desde el vencimiento vigente (o
  desde la aprobación si ya venció). La fecha base viaja en metadata y produce un
  vencimiento absoluto idempotente ante reintentos del mismo webhook. Es la **única**
  vía legítima para cambiar/renovar un plan y registra el evento en el CRM.

## routes/

Cada archivo define un `express.Router` y ata rutas → middlewares → controllers.

- **`routes/userRoutes.js`** — `/register` y `/login` (con `authLimiter`); rutas privadas
  `/me`, `/me/menu`, `/me/stats` y `/me/item-stats` (ambas requirePlan "pro"), `PUT /me`,
  uploads, `/template`, `/active`; y al final las públicas por slug
  `POST /:slug/menu/items/:itemID/view` (tracking por plato), `/:slug/menu` y `/:slug`
  (van últimas para no interceptar las rutas fijas).
- **`routes/menuRoutes.js`** — CRUD de menús (todas `protect`).
- **`routes/itemRoutes.js`** — CRUD de items (todas `protect`).
- **`routes/adminRoutes.js`** — rutas admin (todas `protect + isAdmin`).
- **`routes/massiveRoutes.js`** — `template/preview/confirm`, todas gateadas con
  `requirePlan("basic")`; multer en memoria con límite de 5MB.
- **`routes/crmRoutes.js`** — CRM interno bajo `/api/admin/crm` (montado en app.js
  ANTES de `/api/admin` para que su prefijo matchee primero). Todas `protect + isAdmin`:
  `GET /overdue-count` y `GET /export` (de nombre fijo, van antes del param),
  `GET /clients`, `GET /clients/:userID`, `PATCH /clients/:userID`,
  `POST /clients/:userID/notes`, `DELETE /clients/:userID/notes/:noteID`.
- **`routes/paymentRoutes.js`** — define `PLANES` (Basic/Pro) y períodos de
  1/3/6/12 meses. `POST /crear-preferencia-registro` crea o recupera el alta
  pendiente, crea/actualiza una única preferencia idempotente y devuelve
  `init_point` + token opaco; `POST /registro/estado` permite esperar al webhook;
  `POST /crear-preferencia` (autenticado) valida plan/período, impide downgrades,
  calcula el precio server-side y crea upgrades o renovaciones; `POST /webhook` crea
  la cuenta o acredita el cambio/renovación con vencimiento.

## utils/

- **`utils/handleError.js`** — **`handleError(res, error, status=500)`**: loguea el error
  real server-side y responde un mensaje genérico (nunca reenvía `error.message` para no
  filtrar internals).
- **`utils/dates.js`** — **`buenosAiresDateStr(date=now)`**: devuelve la fecha
  `"YYYY-MM-DD"` del instante leída en `America/Argentina/Buenos_Aires` (vía `Intl`, sin
  dependencias). Evita que las visitas después de las 21:00 se cuenten al día siguiente.
  **`addCalendarMonths(date, months)`** calcula vencimientos respetando el último día
  de meses cortos. También exporta `TIMEZONE_BA`.
- **`utils/offers.js`** — normaliza y valida precio/período de una oferta, y resuelve
  si está activa en el instante actual. Una oferta sin período es manual/permanente;
  una programada requiere inicio y fin y solo se expone públicamente dentro del rango.
- **`utils/itemAvailability.js`** — valida las franjas semanales de disponibilidad,
  detecta solapamientos y calcula el estado actual en horario de Buenos Aires.
- **`utils/slug.js`** — **`generateSlug(name)`** centraliza la normalización usada por
  el registro gratuito y el alta paga.
- **`utils/crmEvents.js`** — **`logCrmEvent(userID, text)`**: inserta un evento
  automático (`kind:"event"`, sin autor) al principio del historial de CRM del cliente
  (upsert). Lo llaman `mpWebhook` (cambio de plan), `setActiveUser` (activar/desactivar)
  y `useTemplate` (cambio de template). Atrapa su propio error: nunca rompe el flujo
  principal si el logueo falla.

---

# Frontend

Estructura: `src/{main.tsx, App.tsx, routes, context, hooks, lib, api, types,
components, pages, Utils, styles}`. Cada componente tiene su `.module.css` (no
documentado individualmente); tokens, keyframes, spinners y utilidades compartidas
viven en `styles/globals.css` (ver [styles/](#styles)).

## Entry / bootstrap

### `main.tsx`
Punto de entrada. Crea el `QueryClient` de React Query (staleTime 2min, retry 1, sin
refetch al enfocar el tab), importa `globals.css`, y monta `<App/>` dentro de
`StrictMode` + `QueryClientProvider`.

### `App.tsx`
- **`PageLoader`** — spinner a pantalla completa (fallback de Suspense).
- **`App`** — envuelve la app en `BrowserRouter` → `AuthProvider` → `Suspense` →
  `AppRoutes` (todas las páginas se cargan lazy).

## <a id="frontend-routes"></a>routes/

### `routes/AppRoutes.tsx`
- **`AppRoutes`** — declara todas las rutas con `lazy()`:
  - Públicas: `/` (AdminHome = landing comercial), `/login`, `/register`,
    `/register/plans`, `/register/success`, `/terminos`, `/privacidad`, `/contacto`.
  - Admin (protegidas por `AdminRoute` + `AdminLayout`, el shell con sidebar/bottomnav):
    `/admin` (CEODashboard), `/admin/crm` (CrmClients).
  - Dueño (protegidas por `UserRoute` + `DashboardLayout`): `/dashboard`,
    `/menu/editor`, `/user/editor`, `/estadisticas`.
  - Tenant público por slug (al final): `/:slug` (UserHome) y `/:slug/menu` (UserMenu).

### `routes/AdminRoutes.tsx`
- **`AdminRoute`** — guard: muestra loader mientras carga auth; redirige a `/login` si no
  está logueado, o a `/dashboard` si no es admin; si es admin renderiza `<Outlet/>`.

### `routes/UserRoutes.tsx`
- **`UserRoute`** — guard inverso: redirige a `/login` si no está logueado, o a `/admin`
  si es admin; si es dueño renderiza `<Outlet/>`.

## context/

### `context/AuthContext.tsx`
- **`AuthContextType`** (interface) y **`AuthContext`** — el contexto de auth (user,
  token, isLoading, login, `refreshUser`, logout, isAuthenticated). El tipo del user es `AuthUser`
  (definido en `types`).

### `context/AuthProvider.tsx`
- **`readAuthFromStorage()`** — lee token/user/expiry de localStorage; si el token venció
  o el JSON está corrupto, limpia y devuelve null.
- **`AuthProvider`** — provee el contexto. Estado combinado (una sola lectura de
  localStorage). Funciones:
  - **`login(username, password)`** — hace fetch a `/users/login`, adapta la
    `AuthResponse` a `AuthUser` (id/name/role/slug/subscription/vencimiento), guarda en state +
    localStorage (expiry 7 días).
  - **`refreshUser()`** — relee `/users/me` y sincroniza plan/vencimiento en state y
    localStorage. Se usa al volver de MercadoPago para no conservar el plan anterior.
  - **`logout()`** — limpia state y localStorage.

### `context/useAuth.ts`
- **`useAuth()`** — hook que devuelve el `AuthContext`; tira error si se usa fuera del
  `AuthProvider`.

### `context/CartContext.tsx`
- **`CartLine`** (interface: itemId, title, unitPrice, quantity, selectedOption?) y
  **`CartContextType`** / **`CartContext`** — el contexto del **carrito de la carta
  pública** (items, addItem, removeItem, updateQuantity, clearCart, totalItems,
  totalPrice). Dos variantes distintas del mismo producto son líneas separadas.

### `context/CartProvider.tsx`
- **`lineKey(itemId, selectedOption)`** — clave única de línea (producto + variante).
- **`readCart(slug)`** — lee el carrito de localStorage (tolerante a JSON corrupto).
- **`CartProvider({slug, children})`** — provee el carrito. Persiste en localStorage
  bajo `cart:<slug>` (un carrito **por local**, no global); si el slug cambia por
  navegación SPA recarga el carrito de ese local (ajuste de estado durante el render,
  sin efecto). Si localStorage no está disponible sigue funcionando en memoria.

### `context/useCart.ts`
- **`useCart()`** — hook consumidor del `CartContext` (mismo patrón que `useAuth`).

## hooks/

### `hooks/useReveal.tsx`
- **`useReveal<T>()`** — devuelve `{ref, revealed}`. Con un `IntersectionObserver`,
  marca `revealed=true` la primera vez que el elemento entra al viewport y deja de
  observar. Usado para scroll-reveal en la landing pública.

### `hooks/useAsyncAction.tsx`
- **`useAsyncAction()`** — abstrae el boilerplate `setLoading/try/catch/setError` de las
  acciones async. Devuelve `{loading, error, success, setError, setSuccess, run,
  mountedRef}`. **`run(fn, opts)`** ejecuta la acción, maneja `ApiError` (mensajes
  reales según tipo), respeta `successMessage`/`onError` y no pisa estado si el
  componente se desmontó.

### `hooks/useTheme.ts`
Tema claro/oscuro del **panel** (solo tokens `--admin-*`).
- **`readTheme()`** — lee la preferencia de localStorage (default `"dark"`).
- **`applyTheme(theme)`** — pone/saca `data-theme="light"` en `<html>`.
- **`useTheme()`** — devuelve `{theme, toggle, setTheme}`; persiste en localStorage. La
  primera aplicación (anti-flash) la hace un script inline en `index.html`.

## lib/

### `lib/plans.ts`
Espejo del sistema de planes del backend, para la UI.
- **`PLAN_ORDER`**, **`PLAN_LABEL`** (nombres visibles), **`TEMPLATE_MIN_PLAN`** (mapa
  template→plan), y **`planMeetsMin(userPlan, minPlan)`** (helper de gating para
  candados/badges en el editor).

### `lib/whatsapp.ts`
Helpers puros del **pedido por WhatsApp** (sin backend, sin gating por plan).
- **`sanitizePhoneForWa(number)`** — convierte el teléfono guardado (dígitos locales
  sin código de país) al formato `54 9 <área><número>` que exige `wa.me` para celulares
  argentinos; saca un `0` inicial de discado si lo hubiera. Devuelve null si no hay número.
- **`buildOrderMessage(cart, businessName)`** — arma el texto legible del pedido
  (cantidad × producto, variante, subtotal por línea y total).
- **`buildWaLink(number, message)`** — devuelve el link `https://wa.me/...?text=` (URL-
  encoded) o null si el número no sirve (el caller oculta el botón en ese caso).

## api/

Capa de acceso a la API. Dos estilos coexisten: un cliente `axios` (`client.ts`) y un
wrapper sobre `fetch` (`apiClient.ts`).

### `api/client.ts`
- **`apiClient`** (axios instance) — baseURL desde `VITE_API_URL`. Interceptor de
  request que adjunta el JWT desde localStorage; interceptor de response que, ante 401,
  limpia la sesión y redirige a `/login`.

### `api/apiClient.ts`
Wrapper tipado sobre `fetch`.
- **`DEFAULT_MESSAGES`** — mensajes por tipo de error, en español.
- **`class ApiError`** — error tipado (`type`, `status`, `details`) que viaja por la app.
- **`classifyStatus(status)`** — mapea código HTTP → `ApiErrorType`.
- **`ApiFetchOptions`** (interface) — extiende `RequestInit` (timeoutMs, parseJson).
- **`apiFetch<T>(url, options)`** — reemplazo de `fetch`: timeout con AbortController,
  clasificación de errores, lectura del `message` del backend; siempre tira `ApiError`.
- (Exporta también `isCancelled` para distinguir cancelaciones intencionales.)

### `api/users.ts`
Funciones tipadas por endpoint de usuario: **`register`**, **`login`**,
**`fetchUserBySlug`**, **`getMe`**, **`updateMe`**, **`uploadUserImage`**,
**`setTemplate`**, **`setActive`**.

### `api/menus.ts`
**`fetchPublicMenu(slug)`**, **`createMenu`**, **`updateMenu`**, **`hideMenu`**,
**`uploadMenuImage`**.

### `api/items.ts`
**`createItem`**, **`updateItem`**, **`moveItem`**, **`deleteItem`**,
**`uploadItemImage`**, **`setItemHidden`**, **`setItemAvailable`**.

### `api/massive.ts`
**`downloadMassiveTemplate`** (blob), **`previewMassiveImport(file)`**,
**`confirmMassiveImport(file)`**, y **`triggerBlobDownload(blob, filename)`** (dispara la
descarga en el navegador).

### `api/crm.ts`
CRM interno (admin): **`listCrmClients`**, **`getCrmClient`**, **`updateCrmProfile`**,
**`addCrmNote`**, **`deleteCrmNote`**, **`getCrmOverdueCount`** (conteo de seguimientos
vencidos para el badge del sidebar) y **`exportCrmClients(stage?)`** (descarga el
listado como blob `.xlsx`, respetando el filtro de etapa).

### `api/index.ts`
Barrel: re-exporta `users/menus/items`, el `apiClient` (axios) y
`apiFetch/isCancelled/ApiError`.

## types/

### `types/index.ts`
Tipos espejo de los schemas del backend y de las respuestas de la API. Incluye:
`Subscription`, `ApiErrorType`, `ContactInfo`, `Media`, `User`, `AuthUser` (forma
normalizada del user logueado en el contexto), `Menu`, `Item`, respuestas
(`PublicMenuResponse`, `AuthResponse`, `TemplateResponse`, ...), el menú público
agrupado (`Categoria`, `Seccion`, `MenuData`, `Tab`, `UserMenuResponse`), el menú del
panel (`AdminItem/AdminCategoria/AdminSeccion/AdminMenuData`, con campos que solo usa el
editor), `DashData`, `DayCount`, `StatsData`, la analítica por plato (`TopItemStat`,
`ItemStatsData`), tipos de import masivo (`MassiveRowResult`, `MassivePreviewResponse`,
`MassiveConfirmResponse`), de admin (`Plan`, `AdminStats`) y de CRM (`CrmStage`,
`CrmNote` — con `kind: "note" | "event"` para distinguir notas manuales de eventos del
sistema —, `CrmProfile`, `CrmClient`, `CrmClientDetail`). `ContactInfo` incluye
`googleReviewUrl` (link de reseñas de Google Maps).

## components/

### `components/Common/`
- **`ErrorBoundary.tsx`** — **`class ErrorBoundary`**: error boundary de React (único
  modo de atrapar errores de render). `getDerivedStateFromError`, `componentDidCatch`
  (loguea, hook para Sentry), `handleReload` y un fallback con botón "Recargar".
- **`FullScreenLoader.tsx`** — **`FullScreenLoader`**: spinner a pantalla completa (guard
  de rutas). Usa las clases globales `.pageLoaderScreen`/`.pageLoaderRing` (mismo loader
  que el fallback de Suspense y las pantallas de carga del panel).
- **`Spinner.tsx`** — **`Spinner({size})`**: spinner SVG inline para botones y overlays
  ("Guardando...", subiendo imagen, etc). Hereda color vía `currentColor` y gira con la
  clase global `.iconSpinner`. Antes estaba copiado idéntico en UserEditor y MenuEditor.
- **`UpgradeModal.tsx`** — selector compartido de suscripción para dashboard y
  paywalls. Filtra upgrades/renovaciones válidos según plan actual, ofrece Basic/Pro y
  períodos 1/3/6/12, calcula el total/ahorro informativo y envía sólo `planId/months`;
  el backend vuelve a validar y calcular el precio real. CSS en su módulo homónimo.

### `components/Admin/Home/AdminHome.tsx`
Landing comercial pública (la home de `/`). Presenta la propuesta, precios y CTA a
registrarse. Datos locales: `PLANS` (grilla Free/Basic/Pro con precio, features y
badge) y `REVIEWS`. Las tarjetas viven en una sección inline de la landing —no hay
modal de precios— y enlazan a `/register?plan=<id>`: Free muestra "Crear cuenta" y
Basic/Pro, "Pagar y crear cuenta". Los CTA generales desplazan hasta esa sección.
Componente principal **`HomePage`** con hooks de animación (`useParallax`,
`useReveal`, `useCounterOnView`, steam rings), `CustomCursor` y navegación mobile.

### `components/Admin/Panel/AdminLayout.tsx`
Shell del **panel CEO** (sidebar desktop + bottom nav mobile + `<Outlet/>` para `/admin`
y `/admin/crm`), mismo patrón que el `DashboardLayout` del dueño.
- **`AdminLayout`** — nav items (Panel / CRM), `useTheme` (toggle claro/oscuro),
  `handleLogout`, y un **badge de alerta** en el ítem CRM con la cantidad de clientes
  con seguimiento vencido (`getCrmOverdueCount`, se refresca en cada cambio de ruta).
  Íconos: `GridIcon`, `UsersIcon`, `LogoutIcon`, `SunIcon`, `MoonIcon`.

### `components/Admin/Panel/CEODashboard.tsx`
Panel interno del CEO (`/admin`). Helpers: `SUBSCRIPTION_LABEL`, `SUBSCRIPTION_COLOR`,
`timeAgo(date)`. Componente **`CEODashboard`**: trae `/admin/stats` y `/admin/allUsers`,
muestra KPIs, breakdown de suscripciones (free/basic/pro), buscador de
clientes y toggle activar/desactivar. Sub-componente **`KpiCard`** (acentos vía CSS
vars, theme-aware) y varios íconos SVG. La navegación/logout viven en `AdminLayout`; el
`.module.css` define sus tokens locales (`--c-*`, glass, sombras) con un bloque
`[data-theme="light"]` para el tema claro.

### `components/Admin/Crm/CrmClients.tsx`
**CRM interno** del CEO (`/admin/crm`). Helpers: `STAGE_META` (etiqueta+color por etapa),
`STAGE_ORDER`, `fmtDate`, `isOverdue`, `timeAgo`, `dateInputValue`.
- **`CrmClients`** — trae la lista (`listCrmClients`), la filtra por etapa (chips con
  contadores) y búsqueda, con **dos vistas alternables**: lista y **Kanban** (columnas
  por etapa, tarjetas arrastrables con drag & drop nativo que llaman a
  `updateCrmProfile` al soltarlas — `moveToStage`, optimista). Arriba, un **banner de
  seguimientos vencidos** (clickeable: filtra solo esos clientes) y un botón
  **"Exportar a Excel"** (`exportCrmClients`, respeta el filtro de etapa activo). Al
  seleccionar un cliente abre el drawer.
- **`ClientDrawer`** — panel lateral de detalle: trae `getCrmClient`, muestra perfil +
  actividad + link a la carta, y permite cambiar etapa, editar tags, setear el próximo
  seguimiento y gestionar el historial de **Actividad**: notas manuales mezcladas
  cronológicamente con los eventos automáticos del sistema (`kind:"event"` — estilo
  discreto, autor "Sistema", sin botón de borrar). Los cambios se guardan al backend y
  se sincronizan con la fila del listado (optimista). Cierra con Escape.

### `components/Login/Login.tsx`
- **`Login`** — formulario de login. Usa `useAuth().login`, muestra errores, redirige
  según rol al entrar. Toggle de ver/ocultar contraseña, "recordarme".

### `components/Register/Register.tsx`
- **`Register`** — formulario común para altas gratuitas y pagas. Valida
  username/password (min 8 chars, coincidencia) y aceptación de términos; guarda los
  datos temporalmente en `sessionStorage` como `pendingRegister` y navega a
  `/register/plans`. Si recibe `?plan=free|basic|pro`, conserva esa elección en la URL.

### `components/Register/RegisterPlans.tsx`
- **`RegisterPlans`** — confirma el plan elegido (Basic por defecto si no vino uno
  válido) y ofrece períodos de 1/3/6/12 meses para planes pagos. Free llama a
  `POST /users/register`, inicia sesión y redirige al dashboard. Basic/Pro llaman a
  `POST /payments/crear-preferencia-registro`, guardan el token opaco y redirigen al
  checkout de MercadoPago.

### `components/Register/RegisterSuccess.tsx`
- **`RegisterSuccess`** — pantalla de retorno del alta paga. Consulta
  `POST /payments/registro/estado` hasta que el webhook complete la cuenta; luego hace
  un único login, limpia `pendingRegister` y redirige a `/dashboard`.

### `components/User/Home/Home/UserHome.tsx`
**Landing pública por slug** (`/:slug`). Núcleo del sistema de templates.
- **`TemplateId`** / **`TemplateTokens`** (types), **`SLUG_REGEX`**, y
  **`TEMPLATE_TOKENS`** — mapa de config por template (heroClass, overlayClass,
  titleClass, showDeliveryRow, galleryRadius, btnLabel, useAvatar) para los 15 templates.
- **`BusinessLandingPage`** — componente de ruta: valida el slug, hace fetch de
  `/users/:slug`, maneja loading/notFound, y renderiza `<Template>` con los tokens del
  template elegido.
- **`Template`** — layout unificado (hero con foto/overlay o header con avatar según
  `useAvatar`, título, badge de delivery, lista de contacto, galería bento, botón "Ver
  menú"). Setea `document.title`.
- Sub-componentes: **`ContactList`** (chips de contacto con `useReveal`; incluye la fila
  "Dejanos tu reseña en Google" si el dueño cargó `googleReviewUrl`), **`Gallery`**
  (galería bento con foto destacada), **`Loader`** (skeleton con la silueta real),
  **`NotFound`** (clases globales `.t-notfound*`, compartidas con la carta).
- **`ImageViewer`** — lightbox a pantalla completa (se abre al tocar la foto de portada
  o una de la galería). Theme-agnóstico: backdrop con blur, imagen con zoom de entrada,
  botones glassmorphic (cerrar / prev / next con estado disabled en los extremos) y
  contador "N / total". Navegación por teclado (← → / Esc), bloqueo del scroll del fondo
  mientras está abierto, y `role="dialog"` + aria-labels. Responsive (tap targets
  cómodos en mobile).

### `components/User/Home/Menu/UserMenu.tsx`
**Carta pública** (`/:slug/menu`). Helpers: `minOption(options)` (precio mínimo entre
variantes), `fmt(n)` (formato de precio AR), `offerPct(orig, offer)` (% de descuento).
- **`MenuPage`** — trae `/users/:slug/menu`, arma tabs por sección, aplica el template,
  scroll-reveal, `document.title`. La cabecera y las tabs viven en un **único wrapper
  sticky** (`.mpSticky`): las tabs quedan pegadas exactamente debajo del header sin
  acoplar un `top:` fijo a una altura que cambia entre mobile y desktop; al cambiar de
  tab se vuelve al tope de la página (el inicio visible del contenido). Envuelve todo en
  **`CartProvider`** (carrito por slug), renderiza el **`CartFab`** (botón flotante con
  badge de cantidad, solo si el carrito tiene algo), el **`CartDrawer`** — **dentro** del
  contenedor `[data-template]`, porque los tokens `--t-*` solo existen ahí — y, si hay
  `googleReviewUrl`, un **banner de reseñas** al final del listado ("¿Te gustó lo que
  viste? Contanos en Google"). **Responsive**: columna única estilo mobile hasta 1024px;
  de ahí en adelante el contenedor crece (~1080px) y cada categoría pasa a una **grilla
  de 2 columnas** (título ocupando ambas; `align-items:start` para que expandir
  variantes en una tarjeta no estire a su vecina).
- **`ItemCard`** — tarjeta de producto (imagen con `loading="lazy"`, precio, badges).
  El precio muestra un solo estado a la vez: oferta (precio nuevo + tachado + badge de
  descuento) > variantes ("Desde" el mínimo) > precio simple. Control de **carrito**:
  `AddControl` simple si el producto no tiene variantes, o un `AddControl` por variante
  dentro del panel expandible; el botón "Variantes" solo aparece cuando el panel
  realmente abre (con oferta activa el producto se agrega como ítem simple al precio de
  oferta). El primer tap sobre la tarjeta dispara el **tracking de vista por plato**
  (`POST /:slug/menu/items/:itemID/view`, fire-and-forget, una vez por montaje).
- **`AddControl`** — botón "+" que al agregar se convierte en stepper −/cantidad/+
  (sincronizado con el carrito vía `useCart`).
- **`CartFab`** — botón flotante del carrito (abre el drawer).
- Sub-componentes: **`MenuSkeleton`** (misma silueta que el contenido real, incluida la
  grilla de 2 columnas en desktop), **`NotFound`** (clases globales `.t-notfound*`),
  **`EmptyMenu`**, e íconos SVG (`BackIcon`, `PinIcon`, `DeliveryIcon`, `StarIcon`,
  `CartIcon`, `ImagePlaceholderIcon`).

### `components/User/Home/Menu/CartDrawer.tsx`
Panel deslizable del **pedido** (bottom-sheet en mobile, modal centrado en desktop),
tematizado con los tokens `--t-*` del template activo.
- **`CartDrawer({open, onClose, businessName, whatsappNumber})`** — lista las líneas
  del carrito (título, variante, stepper de cantidad, subtotal, quitar) con scroll
  interno propio (en pantallas bajas el listado scrollea en vez de empujar el total y
  el checkout fuera del viewport), muestra el total, y la **zona de acciones de
  checkout**: hoy el botón "Pedir por WhatsApp" (arma el link con `buildWaLink` +
  `buildOrderMessage` y lo abre en otra pestaña; si el local no cargó teléfono muestra
  un aviso en su lugar) y "Vaciar pedido" (con confirmación nativa — acción destructiva
  sin undo). La zona está separada a propósito para que sumar un botón de pago con
  MercadoPago después sea un cambio aislado. Debe renderizarse dentro del contenedor
  `[data-template]` (hereda los tokens `--t-*` de ahí). Íconos: `CloseIcon`,
  `TrashIcon`, `WhatsAppIcon`.

### `components/User/Panel/DashboardLayout/DashboardLayout.tsx`
Shell del panel del dueño (sidebar desktop + bottom nav mobile + `<Outlet/>`).
- **`DashboardLayout`** — nav items, `useTheme` (toggle claro/oscuro con `themeLabel`),
  `handleLogout`. Íconos: `HomeIcon`, `DocIcon`, `StoreIcon`, `ChartIcon`, `LogoutIcon`,
  `SunIcon`, `MoonIcon`.

### `components/User/Panel/Dashboard/UserDashboard.tsx`
Home del panel (`/dashboard`). Layout de dos columnas en desktop.
- **`useSpotlight(ref)`** — hook: luz que sigue al cursor en las cards.
- **`UserDashboard`** — trae `/users/me`, muestra bienvenida, tarjeta "storefront" (URL
  pública, copiar link, ver página, descargar QR con `qrcode`+`jsPDF`), tarjeta **“Tu
  plan”** (plan efectivo, vencimiento y CTA de upgrade/renovación), cards de navegación
  y la vista previa en vivo. Al volver con `?payment=success` reintenta `refreshUser`
  unos segundos por la posible carrera con el webhook. QR menu con portal.
- **`SpotlightCard`** — card de navegación con el efecto spotlight.
- **`PreviewCard`** — vista previa en vivo de la carta pública en un iframe escalado
  (toggle Móvil/Escritorio). Usa un `ResizeObserver` para calcular el `scale`: por ancho
  siempre, y por alto **solo** en el layout de dos columnas (evita el bucle de
  realimentación del layout apilado). Íconos `RefreshIcon`, etc.

### `components/User/Panel/MenuEditor/MenuEditor.tsx`
Editor del menú (`/menu/editor`). El componente más grande.
- Tipos importados de `types` como `Item/Categoria/Seccion/MenuData` (alias de los
  `Admin*`). `EMPTY_ITEM`, `icons`, constantes de Cloudinary.
- Sub-componentes: **`Toggle`**, **`TopBar`**, **`CategoriaAcordeon`** (memoizado —
  acordeón de categoría con items, drag & drop). El spinner inline viene de
  `Common/Spinner`.
- **`MenuEditorPage`** — estado del editor (menú, límites, vistas item/categoría/sección/
  massive-import, modales de borrado y de upgrade). Fetch a `/users/me/menu`, `refetch`,
  handlers CRUD de items/categorías/secciones, drag & drop, subida de imágenes directo a
  Cloudinary, **exportar/importar Excel** y **exportar PDF** (gateados a Basic con
  modal de upsell). El formulario del producto permite activar una programación semanal
  Basic+ con varios rangos por día, incluso cruzando medianoche, y programar el inicio y
  fin de una oferta con fecha y hora. Los paywalls abren `Common/UpgradeModal` con el
  plan mínimo correspondiente.

### `components/User/Panel/UserEditor/UserEditor.tsx`
"Mi negocio" (`/user/editor`). Tabs info / media / template.
- `TEMPLATES` (los 15 con `minPlan`), `EMPTY_FORM`. Sub-componentes `Toggle` y
  `LockIcon`; el spinner inline viene de `Common/Spinner`.
- **`UserEditorPage`** — edita datos de contacto (incluido el **link de reseñas de
  Google Maps**, disponible en Pro y validado como `http(s)://`), delivery, galería
  (subida múltiple a Cloudinary con progreso, drag & drop) y **selección de template**
  con gating por plan (`planMeetsMin`): candado + badge del plan requerido y
  `Common/UpgradeModal` configurado con el nivel mínimo del template.

### `components/User/Panel/Stats/UserStats.tsx`
Estadísticas de visitas (`/estadisticas`, plan pro+).
- **`requestStats(token)`** — fetch puro (sin React) de `/users/me/stats`; devuelve
  `{kind:"locked"|"data"|"none"}`.
- **`requestItemStats(token)`** — ídem para `/users/me/item-stats` (mismo gate de plan;
  se pide después de stats para no duplicar el manejo del 403).
- **`UserStats`** — carga inicial (con spinner) + **auto-refresh en tiempo real**
  (polling cada 45s solo con la pestaña visible + refresco al volver el foco). Muestra
  total y gráfico de los últimos 30 días, más la sección **"Productos más vistos"**
  (ranking top 10 con barra proporcional al más visto, solo si hay datos). Si el plan
  no incluye stats (403), muestra paywall que abre `Common/UpgradeModal` para Pro.

## pages/

### `pages/Legal/`
Páginas legales estáticas:
- **`Terms.tsx`** — **`Terms`**: términos y condiciones.
- **`Privacy.tsx`** — **`Privacy`**: política de privacidad.
- **`Contact.tsx`** — **`Contact`**: formulario de contacto con validación local
  (`FormState`, `validate()`, `handleChange`, `handleSubmit`).

## <a id="utils-frontend"></a>Utils/

### `Utils/MassiveImport.tsx`
Asistente de importación por Excel (se abre desde el MenuEditor).
- Tipos `Resumen`/`Resultado` (derivados de las respuestas de la API), `Step`.
- **`MassiveImport`** — flujo de 3 pasos (upload → preview → success): descarga de
  plantilla, drag & drop del archivo (valida .xlsx y ≤5MB), preview de cambios y
  confirmación. Sub-componentes **`ResumenSection`** y **`ResultadoSection`** (render de
  las filas a crear/actualizar/errores).

## <a id="styles"></a>styles/

### `styles/globals.css`
Única hoja global; todo lo demás son CSS Modules por componente. La regla de la casa:
**lo que se repite en 2+ módulos se centraliza acá**. Contiene:

- **Design tokens**, en 4 familias con prefijo propio para no colisionar:
  - Paleta base del storefront claro (`--gold`, `--cream`, `--text-*`, `--surface-*`,
    radios, sombras, espaciado, escala tipográfica, easings, z-index).
  - **`--admin-*`** — panel de administración (Dashboard, editores, CEO, CRM). Tema
    oscuro default + bloque `:root[data-theme="light"]` que redefine solo las bases
    (los derivados se recalculan solos vía `color-mix()`).
  - **`--auth-*`** — Login/Register/AdminHome (tema oscuro/ámbar).
  - **`--t-*`** — tokens **por template** de la carta pública: 15 bloques
    `[data-template="N"]` (bg, surface, borders, text, accent, gradientes de hero;
    los premium suman `--t-bg-image` y `--t-btn-bg` metálico). Solo existen dentro
    del contenedor con `data-template`.
- **Keyframes globales** (`spin`, `spinReverse`, `t-fadeIn`, `t-fadeUp`,
  `t-slideRight`, `fadeUp`, `scaleIn`, `pulse`, `shimmer`, `slideDown`, `slideUp`) —
  los módulos los referencian sin redeclararlos.
- **Spinners de carga** (3 variantes): `.pageLoaderScreen` + `.pageLoaderRing`
  (página completa, doble anillo conic-gradient, theme-aware vía `--admin-*`),
  `.iconSpinner` (SVG inline de botones — lo usa `Common/Spinner`) y
  `.btnSpinnerDark` (anillo oscuro sobre botón ámbar/dorado de Login/Contact).
- **Utilidades compartidas**: `.sr-only` (texto solo para lectores de pantalla),
  `.t-notfound`/`.t-notfound-title`/`.t-notfound-sub` (estado "no encontrado" de las
  vistas públicas — colores fijos porque sin negocio no hay template del que heredar),
  `.grain` (textura), `.t-reveal`/`.t-reveal-in` (scroll-reveal con `useReveal`).
- **Componentes de template `.t-*`** (hero, header con avatar, badges, info-rows,
  galería bento, botones, cards, stats) que consumen los tokens `--t-*` — el layout de
  `UserHome` se arma con estas clases.
- Reset, base de `html/body`, `:focus-visible` global y `prefers-reduced-motion`.

---

# Flujos clave

- **Registro y sesión**: la landing enlaza a `/register?plan=<id>` y la selección se
  mantiene al pasar a `RegisterPlans`. Free usa `POST /users/register`, inicia sesión
  y entra directo al dashboard. En un alta paga, `RegisterPlans` crea la preferencia
  y conserva el token opaco; al volver de MP, `RegisterSuccess` espera
  `/payments/registro/estado`, ejecuta un único login cuando el webhook completa la
  cuenta y redirige a `/dashboard`. El JWT queda en localStorage (`AuthProvider`). Los
  guards `UserRoute`/`AdminRoute` protegen las rutas.
- **Carga del menú**: el dueño usa `MenuEditor` → `/menus` y `/items` (CRUD). Las
  imágenes van directo a Cloudinary. Los ocultos se ven en el editor pero no en la carta
  pública.
- **Carta pública**: visitante entra a `/:slug/menu` → `fetchUserWithMenu` arma el menú
  agrupado, filtra ocultos, calcula la disponibilidad semanal de cada producto en
  horario BA y registra la visita (`trackView`).
- **Planes y pagos**: hay dos entradas. El alta paga usa
  `POST /payments/crear-preferencia-registro` antes de que exista el usuario; el upsell
  desde el panel usa `POST /payments/crear-preferencia` sobre una cuenta autenticada.
  En ambos casos el **webhook** (`mpWebhook`) verifica el pago real antes de crear la
  cuenta o actualizar `User.subscription`/`subscriptionExpiresAt`. El panel abre el
  `Common/UpgradeModal` compartido (plan + 1/3/6/12 meses) desde la tarjeta “Tu plan”
  y desde cada paywall. El gating de features (límite de items, Excel, PDF, reseñas,
  ofertas y disponibilidad programadas, stats y templates) se valida en el backend
  (`requirePlan` / `TEMPLATE_MIN_PLAN`) y se refleja en la UI (`lib/plans.ts`). La
  landing del local está incluida en Free y muestra publicidad en ese nivel.

- **Validación de pagos**: `test/paymentWebhook.test.js` simula MercadoPago/Mongoose y
  cubre upgrades, renovaciones vigentes/vencidas, reintentos idempotentes, pagos
  pendientes, metadata inválida, preferencias legacy, firma inválida, usuario
  inexistente y alta paga. No reemplaza la prueba real end-to-end pendiente.

- **Pedido por WhatsApp**: en la carta pública el cliente arma un carrito
  (`CartProvider`, persistido en localStorage por slug) tocando "+" en cada producto
  (con selección de variante si tiene opciones). El `CartDrawer` muestra el pedido y
  el botón "Pedir por WhatsApp" abre `wa.me` con el mensaje prearmado
  (`lib/whatsapp.ts`) al número del local. 100% client-side, sin backend, sin gating
  por plan (el teléfono ya es público vía el link `tel:` existente).
- **Reseñas de Google** (Pro): el dueño carga `contactInfo.googleReviewUrl` en "Mi negocio";
  la landing pública (`ContactList`) y la carta (banner al final del menú) muestran el
  CTA "Dejanos tu reseña" solo si el campo está cargado y el plan vigente es Pro.
- **Estadísticas**: cada visita incrementa `PageView` del día (BA), y cada tap sobre un
  producto incrementa `ItemView` (mismo esquema, a nivel plato). Los planes pro+ ven en
  `UserStats` la serie de 30 días con auto-refresh en tiempo real más el ranking de
  "Productos más vistos" (top 10 de la misma ventana).
- **Import/export Excel** (plan basic+): `getTemplate` genera el `.xlsx`;
  `previewMassive`/`confirmMassive` procesan la reimportación fila por fila y rechazan
  el archivo completo antes de mutar si supera el tope del plan.
- **CRM interno** (solo CEO/admin): desde `/admin/crm` se gestiona a los locales
  suscriptos como clientes (etapa del pipeline — en vista lista o Kanban con drag &
  drop —, tags, seguimiento, notas). El historial mezcla notas manuales con eventos
  automáticos del sistema (`logCrmEvent`: cambios de plan vía webhook de MP,
  activar/desactivar cuenta, cambios de template). Los seguimientos vencidos se
  destacan con un banner en el CRM y un badge en el sidebar del panel
  (`/overdue-count`), y el listado se puede exportar a Excel (`/export`). Los datos
  viven en `CrmProfile`, aislados del modelo User para no filtrarse por ningún endpoint
  público; solo se acceden vía `/api/admin/crm` (protect + isAdmin).
