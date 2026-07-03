# MenuDigital — Arquitectura de la aplicación

Documentación técnica de los dos repositorios que componen **MenuDigital**, un
SaaS de menús/cartas digitales para bares y restaurantes de Argentina. Describe
cada archivo de código y cada función (se excluyen los `.css`).

- **Frontend** (`menu-digital-frontend`): React 19 + TypeScript + Vite. Deploy en Vercel.
- **Backend** (`menu-digital-backend`): Node + Express 4 + Mongoose 7 (MongoDB Atlas). Deploy en Koyeb.
- **Servicios externos**: Cloudinary (imágenes), MercadoPago (pagos).

Modelo de negocio: cada dueño de local se registra (plan `free`), carga su menú y
obtiene una carta pública en `menudigitalapp.com.ar/<slug>/menu`. Los planes pagos
(`starter` → `pro` → `premium`) desbloquean features de forma escalonada.

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
  (`starter/pro/premium`) al valor interno de `User.subscription`. Hoy 1:1; se
  mantiene como capa de validación (el webhook rechaza plan_ids desconocidos).
- **`PLAN_ORDER`** = `["free","starter","pro","premium"]`. El índice ES la jerarquía.
- **`PLAN_FEATURES`** — features que desbloquea cada nivel (acumulativo).
- **`FREE_ITEM_LIMIT`** = 15 (tope de productos del plan gratuito).
- **`TEMPLATE_MIN_PLAN`** — mapa `templateId → plan mínimo` (gating escalonado de
  templates). free: 1,3,5 · starter: 2,4,8,9 · pro: 10,11,12 · premium: 6,7,13.
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
(enum `free/starter/pro/premium`, default `free`), `menu` (bool, si ya creó menú),
`hasDelivery`, `template` (nº, default 1), `contactInfo` (objeto: businessName, mail,
number, address, social...), `media` (pictures[], backgroundPicture),
`acceptedTerms*`. `timestamps`. Incluye hook de hasheo de password con bcrypt.

### `models/Menu.js`
Cada documento es una **sección o categoría** del menú de un local. Campos: `userID`
(ref User), `sectionID` (ref a otro Menu, para anidar categorías dentro de secciones;
null si no tiene), `code`, `title` (requerido), `description`, `image`, `section`
(bool: true = sección contenedora, false = categoría con items), `hidden`. `timestamps`.

### `models/Item.js`
Un **producto** del menú. Campos: `menuID` (ref Menu), `code`, `title` (requerido),
`description`, `price` (null = sin precio), `offerPrice`, `offerRange` (`{from,to}`
fechas de vigencia de la oferta), `options` (Map string→number, ej variantes de
tamaño), `image`, `available`, `isExtra`, `recommended`, `hidden`, `apt` (objeto
libre: alérgenos, calorías...). `timestamps`.

### `models/PageView.js`
Agregado **diario** de visitas a la carta pública (una fila por local por día, con un
contador). `userID` (ref User), `date` (string `"YYYY-MM-DD"`), `count`. Índice único
`{userID, date}`. Se guarda como string (no Date) para hacer upsert por día sin lidiar
con husos horarios en la query.

## middleware/

### `middleware/auth.js`
- **`protect(req,res,next)`** — exige `Authorization: Bearer <jwt>`. Verifica el token
  (`jwt.verify` con `algorithms:["HS256"]` fijado como defensa contra confusión de
  algoritmo), carga el user en `req.user` (sin password), rechaza si no existe o si la
  cuenta está desactivada (salvo admins).
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
  `trackView`. Es lo que renderiza la landing pública.
- **`fetchOwnMenu`** `GET /api/users/me/menu` — menú del dueño autenticado, **sin**
  filtrar ocultos (para gestionarlos en el editor) + objeto `limits`
  (`itemCount`, `itemLimit`, `canImportExcel`) para la UI de gating.
- **`fetchStats`** `GET /api/users/me/stats` (plan pro+) — devuelve `totalViews` y la
  serie `last30Days` (30 puntos, rellenando días sin visitas con 0), con las fechas
  calculadas en horario de Buenos Aires.
- **`fetchUser`** `GET /api/users/:slug` — datos públicos de un local (landing por slug).
- **`editUser`** `PUT /api/users/me` — edita `contactInfo/hasDelivery/media` (whitelist;
  `template` queda afuera a propósito, va por `useTemplate`).
- **`uploadImage`** / **`uploadBackground`** — suben foto a la galería / de fondo del
  local (a Cloudinary).
- **`removeImage`** / **`deleteBackground`** — sacan una foto de la galería / el fondo.
- **`useTemplate`** `PATCH /api/users/template` — cambia el template; valida contra
  `TEMPLATE_MIN_PLAN` (id conocido + plan suficiente). **Barrera real** del gating de
  templates.
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
- **`newItem`** `POST /api/items` — crea producto; aplica el tope del plan free
  (`FREE_ITEM_LIMIT` sobre todos los menús del user) y unicidad de `code` **por
  usuario** (no global).
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
  cualquier cliente (no a sí mismo ni a otros admins).
- **`getStats`** `GET /api/admin/stats` — métricas globales de la plataforma (usuarios
  activos/inactivos/con menú, totales de menús/secciones/categorías/items, 5 usuarios
  recientes), todo en queries paralelas.

### `controllers/massiveController.js` (importar/exportar Excel — plan starter+)
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

### `controllers/paymentController.js` (MercadoPago)
- **`verifyMpSignature(req)`** — valida la firma HMAC-SHA256 del header `x-signature`
  contra `MP_WEBHOOK_SECRET` (con `timingSafeEqual`). Si el secret no está configurado,
  no bloquea pero avisa por consola.
- **`mpWebhook`** `POST /api/payments/webhook` — endpoint que llama MercadoPago. Verifica
  firma, consulta el estado **real** del pago contra la API de MP (nunca confía en el
  query string), y si está `approved` actualiza `User.subscription` según el
  `external_reference` (userId) y `metadata.plan_id`. Es la **única** vía legítima para
  cambiar de plan.

## routes/

Cada archivo define un `express.Router` y ata rutas → middlewares → controllers.

- **`routes/userRoutes.js`** — `/register` y `/login` (con `authLimiter`); rutas privadas
  `/me`, `/me/menu`, `/me/stats` (requirePlan "pro"), `PUT /me`, uploads, `/template`,
  `/active`; y al final las públicas por slug `/:slug/menu` y `/:slug` (van últimas para
  no interceptar las rutas fijas).
- **`routes/menuRoutes.js`** — CRUD de menús (todas `protect`).
- **`routes/itemRoutes.js`** — CRUD de items (todas `protect`).
- **`routes/adminRoutes.js`** — rutas admin (todas `protect + isAdmin`).
- **`routes/massiveRoutes.js`** — `template/preview/confirm`, todas gateadas con
  `requirePlan("starter")`; multer en memoria con límite de 5MB.
- **`routes/paymentRoutes.js`** — define `PLANES` (title/price/description de starter,
  pro, premium para MercadoPago), `POST /crear-preferencia` (protegido: crea la
  preferencia de pago y devuelve `init_point`), y `POST /webhook` → `mpWebhook`.

## utils/

- **`utils/handleError.js`** — **`handleError(res, error, status=500)`**: loguea el error
  real server-side y responde un mensaje genérico (nunca reenvía `error.message` para no
  filtrar internals).
- **`utils/dates.js`** — **`buenosAiresDateStr(date=now)`**: devuelve la fecha
  `"YYYY-MM-DD"` del instante leída en `America/Argentina/Buenos_Aires` (vía `Intl`, sin
  dependencias). Evita que las visitas después de las 21:00 se cuenten al día siguiente.
  También exporta `TIMEZONE_BA`.

---

# Frontend

Estructura: `src/{main.tsx, App.tsx, routes, context, hooks, lib, api, types,
components, pages, Utils, styles}`. Cada componente tiene su `.module.css` (no
documentado acá). Tokens de diseño centralizados en `styles/globals.css`.

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
  - Públicas: `/` (AdminHome = landing comercial), `/login`, `/register`, `/terminos`,
    `/privacidad`, `/contacto`.
  - Admin (protegidas por `AdminRoute`): `/admin` (CEODashboard).
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
  token, isLoading, login, logout, isAuthenticated). El tipo del user es `AuthUser`
  (definido en `types`).

### `context/AuthProvider.tsx`
- **`readAuthFromStorage()`** — lee token/user/expiry de localStorage; si el token venció
  o el JSON está corrupto, limpia y devuelve null.
- **`AuthProvider`** — provee el contexto. Estado combinado (una sola lectura de
  localStorage). Funciones:
  - **`login(username, password)`** — hace fetch a `/users/login`, adapta la
    `AuthResponse` a `AuthUser` (id/name/role/slug/subscription), guarda en state +
    localStorage (expiry 7 días).
  - **`logout()`** — limpia state y localStorage.

### `context/useAuth.ts`
- **`useAuth()`** — hook que devuelve el `AuthContext`; tira error si se usa fuera del
  `AuthProvider`.

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
editor), `DashData`, `DayCount`, `StatsData`, tipos de import masivo (`MassiveRowResult`,
`MassivePreviewResponse`, `MassiveConfirmResponse`) y de admin (`Plan`, `AdminStats`).

## components/

### `components/Common/`
- **`ErrorBoundary.tsx`** — **`class ErrorBoundary`**: error boundary de React (único
  modo de atrapar errores de render). `getDerivedStateFromError`, `componentDidCatch`
  (loguea, hook para Sentry), `handleReload` y un fallback con botón "Recargar".
- **`FullScreenLoader.tsx`** — **`FullScreenLoader`**: spinner a pantalla completa (guard
  de rutas).

### `components/Admin/Home/AdminHome.tsx`
Landing comercial pública (la home de `/`). Presenta la propuesta, precios y CTA a
registrarse. Datos locales: `PLANS` (grilla Gratis/Starter/Pro/Premium con
precio/features/badge) y `REVIEWS`. Componente principal **`HomePage`** con varios
hooks de animación (`useParallax`, `useReveal`, `useCounterOnView`, steam rings), un
modal de billing, `CustomCursor`, y navegación mobile. `goRegister()` manda a
`/register` (el cobro real se dispara ya logueado desde el panel).

### `components/Admin/Panel/CEODashboard.tsx`
Panel interno del CEO (`/admin`). Helpers: `SUBSCRIPTION_LABEL`, `SUBSCRIPTION_COLOR`,
`timeAgo(date)`. Componente **`CEODashboard`**: trae `/admin/stats` y `/admin/allUsers`,
muestra KPIs, breakdown de suscripciones (free/starter/pro/premium), buscador de
clientes y toggle activar/desactivar. Sub-componente **`KpiCard`** y varios íconos SVG.

### `components/Login/Login.tsx`
- **`Login`** — formulario de login. Usa `useAuth().login`, muestra errores, redirige
  según rol al entrar. Toggle de ver/ocultar contraseña, "recordarme".

### `components/Register/Register.tsx`
- **`Register`** — formulario de registro. Valida username/password (min 8 chars,
  coincidencia) y aceptación de términos; llama al registro y entra.

### `components/User/Home/Home/UserHome.tsx`
**Landing pública por slug** (`/:slug`). Núcleo del sistema de templates.
- **`TemplateId`** / **`TemplateTokens`** (types), **`SLUG_REGEX`**, y
  **`TEMPLATE_TOKENS`** — mapa de config por template (heroClass, overlayClass,
  titleClass, showDeliveryRow, galleryRadius, btnLabel, useAvatar) para los 13 templates.
- **`BusinessLandingPage`** — componente de ruta: valida el slug, hace fetch de
  `/users/:slug`, maneja loading/notFound, y renderiza `<Template>` con los tokens del
  template elegido.
- **`Template`** — layout unificado (hero con foto/overlay o header con avatar según
  `useAvatar`, título, badge de delivery, lista de contacto, galería bento, botón "Ver
  menú"). Setea `document.title`.
- Sub-componentes: **`ContactList`** (chips de contacto con `useReveal`), **`Gallery`**
  (galería con foto destacada), **`Loader`**, **`NotFound`**, y un visor de imágenes.

### `components/User/Home/Menu/UserMenu.tsx`
**Carta pública** (`/:slug/menu`). Helpers: `minOption(options)` (precio mínimo entre
variantes), `fmt(n)` (formato de precio AR), `offerPct(orig, offer)` (% de descuento).
- **`MenuPage`** — trae `/users/:slug/menu`, arma tabs por sección, aplica el template,
  scroll-reveal, `document.title`.
- **`ItemCard`** — tarjeta de producto (imagen, precio/oferta, badges recomendado/apto).
- Sub-componentes: **`MenuSkeleton`**, **`NotFound`**, **`EmptyMenu`**, e íconos SVG
  (`BackIcon`, `PinIcon`, `DeliveryIcon`, `StarIcon`, `ImagePlaceholderIcon`).

### `components/User/Panel/DashboardLayout/DashboardLayout.tsx`
Shell del panel del dueño (sidebar desktop + bottom nav mobile + `<Outlet/>`).
- **`DashboardLayout`** — nav items, `useTheme` (toggle claro/oscuro con `themeLabel`),
  `handleLogout`. Íconos: `HomeIcon`, `DocIcon`, `StoreIcon`, `ChartIcon`, `LogoutIcon`,
  `SunIcon`, `MoonIcon`.

### `components/User/Panel/Dashboard/UserDashboard.tsx`
Home del panel (`/dashboard`). Layout de dos columnas en desktop.
- **`useSpotlight(ref)`** — hook: luz que sigue al cursor en las cards.
- **`UserDashboard`** — trae `/users/me`, muestra bienvenida, tarjeta "storefront" (URL
  pública, copiar link, ver página, descargar QR con `qrcode`+`jsPDF`), cards de
  navegación y la vista previa en vivo. QR menu con portal.
- **`SpotlightCard`** — card de navegación con el efecto spotlight.
- **`PreviewCard`** — vista previa en vivo de la carta pública en un iframe escalado
  (toggle Móvil/Escritorio). Usa un `ResizeObserver` para calcular el `scale`: por ancho
  siempre, y por alto **solo** en el layout de dos columnas (evita el bucle de
  realimentación del layout apilado). Íconos `RefreshIcon`, etc.

### `components/User/Panel/MenuEditor/MenuEditor.tsx`
Editor del menú (`/menu/editor`). El componente más grande.
- Tipos importados de `types` como `Item/Categoria/Seccion/MenuData` (alias de los
  `Admin*`). `EMPTY_ITEM`, `icons`, constantes de Cloudinary.
- Sub-componentes: **`Toggle`**, **`TopBar`**, **`Spinner`**, **`CategoriaAcordeon`**
  (memoizado — acordeón de categoría con items, drag & drop).
- **`MenuEditorPage`** — estado del editor (menú, límites, vistas item/categoría/sección/
  massive-import, modales de borrado y de upgrade). Fetch a `/users/me/menu`, `refetch`,
  handlers CRUD de items/categorías/secciones, drag & drop, subida de imágenes directo a
  Cloudinary, **exportar/importar Excel** (gateado a plan Pro con modal de upsell).

### `components/User/Panel/UserEditor/UserEditor.tsx`
"Mi negocio" (`/user/editor`). Tabs info / media / template.
- `TEMPLATES` (los 13 con `minPlan`), `EMPTY_FORM`. Sub-componentes `Toggle`, `Spinner`,
  `LockIcon`.
- **`UserEditorPage`** — edita datos de contacto, delivery, galería (subida múltiple a
  Cloudinary con progreso, drag & drop) y **selección de template** con gating por plan
  (`planMeetsMin`): candado + badge del plan requerido + modal de upsell que dispara el
  pago del plan exacto (`handleUpgrade`).

### `components/User/Panel/Stats/UserStats.tsx`
Estadísticas de visitas (`/estadisticas`, plan pro+).
- **`requestStats(token)`** — fetch puro (sin React) de `/users/me/stats`; devuelve
  `{kind:"locked"|"data"|"none"}`.
- **`UserStats`** — carga inicial (con spinner) + **auto-refresh en tiempo real**
  (polling cada 45s solo con la pestaña visible + refresco al volver el foco). Muestra
  total y gráfico de los últimos 30 días. Si el plan no incluye stats (403), muestra
  paywall con `handleUpgrade` (pago del plan Pro).

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

---

# Flujos clave

- **Registro y sesión**: `Register/Login` → `POST /users/register|login` → JWT en
  localStorage (`AuthProvider`). Los guards `UserRoute`/`AdminRoute` protegen las rutas.
- **Carga del menú**: el dueño usa `MenuEditor` → `/menus` y `/items` (CRUD). Las
  imágenes van directo a Cloudinary. Los ocultos se ven en el editor pero no en la carta
  pública.
- **Carta pública**: visitante entra a `/:slug/menu` → `fetchUserWithMenu` arma el menú
  agrupado, filtra ocultos y registra la visita (`trackView`, horario BA).
- **Planes y pagos**: desde el panel, el upsell dispara `POST /payments/crear-preferencia`
  → MercadoPago → al aprobarse, el **webhook** (`mpWebhook`) verifica el pago real y
  actualiza `User.subscription`. El gating de features (límite de items, Excel, stats,
  templates) se valida en el backend (`requirePlan` / `TEMPLATE_MIN_PLAN`) y se refleja
  en la UI (`lib/plans.ts`).
- **Estadísticas**: cada visita incrementa `PageView` del día (BA). Los planes pro+ ven
  la serie de 30 días en `UserStats`, con auto-refresh en tiempo real.
- **Import/export Excel** (plan starter+): `getTemplate` genera el `.xlsx`;
  `previewMassive`/`confirmMassive` procesan la reimportación fila por fila.
