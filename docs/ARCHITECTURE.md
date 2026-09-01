# MenuDigital — Arquitectura de la aplicación
> **Revisión vigente — 01-09-2026:** catálogo y gating siguen conectados. El nuevo
> módulo de vendedores y códigos está montado y su vista administra métricas y
> clientes atribuidos. La regresión del webhook de cuentas existentes fue corregida
> y sus 44 pruebas pasan; backend 120/125 y pruebas de vendedores 6/6. Frontend pasa
> typecheck, lint y build. Ver [README](README.md#verificaciones).
> No se consultó Atlas ni se desplegó.


Documentación técnica de los dos repositorios que componen **MenuDigital**, un
SaaS de menús/cartas digitales para bares y restaurantes de Argentina. Describe
los archivos de código, sus responsabilidades y funciones principales (los
`.module.css` por componente no se documentan; `styles/globals.css` sí, por ser la fuente compartida de tokens,
keyframes y utilidades — ver [styles/](#styles)).

- **Frontend** (`menu-digital-frontend`): React 19 + TypeScript + Vite. Deploy en Vercel.
- **Backend** (`menu-digital-backend`): Node + Express 4 + Mongoose 7 (MongoDB Atlas). Deploy en Koyeb.
- **Servicios externos**: Cloudinary (imágenes), MercadoPago (pagos).

Modelo de negocio: el dueño elige `free`, `basic` o `pro` antes del alta.
Free crea la cuenta sin checkout; Basic/Pro crean un registro pendiente y pasan por
MercadoPago antes de crear el `User`. La carta vive en `menudigitalapp.com.ar/<slug>/menu`.
Los beneficios de cada plan se definen explícitamente en MongoDB, sin herencia.

> **Etapa previa del 31-08-2026 — retiro de funciones:** se retiraron dominio propio y reseñas
> integradas de la oferta, los permisos y la interfaz. Se conservan dirección,
> enlace a Maps por dirección y contacto/reservas por WhatsApp. Los campos antiguos
> no se exponen en las respuestas de contacto del panel/carta ni se aceptan al editar.
> No se ejecutó una migración de MongoDB ni se desplegaron estos cambios.
> Validación histórica de esa limpieza, anterior a integrar el catálogo: 3/3 pruebas nuevas de contacto pasan; suite backend
> 96/98, con los mismos dos fallos previos. Frontend lint/build pasan y typecheck
> conserva sus errores previos. Se revisaron las pantallas afectadas y el guardado
> de contacto en navegador local con API simulada, sin conexión a datos reales.

> **Antecedente histórico — 30-08-2026:** el catálogo todavía estaba sin integrar.
> Ese estado quedó superado por la conexión local del 31-08; no equivale a despliegue.

---

## Índice

- [Backend](#backend)
  - [Entry point](#entry-point)
  - [config/](#config)
  - [models/](#models)
  - [middleware/](#middleware)
  - [controllers/](#controllers)
  - [services/](#services)
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

Estructura: `src/{app.js, config, models, middleware, controllers, routes, services, utils}`.
La convención es capturar errores con `handleError` y no filtrar internals;
`sellerController.js` ya fue alineado y conserva respuestas específicas solo para
validación, duplicados y recursos inexistentes.

## <a id="entry-point"></a>Entry point — `src/app.js`

Arma la app Express y arranca el servidor.

- Valida entorno (`validateEnvironment()`), espera `connectDB()` e
  `initializePlans()` antes de `app.listen`; falla el arranque con catálogo inválido.
- `app.set("trust proxy", 1)` — necesario detrás del balanceador de Koyeb para que
  `req.ip` sea la IP real del cliente (lo usa el rate limiter).
- Middlewares globales, en orden:
  - `helmet(...)` con `crossOriginResourcePolicy: "cross-origin"` (la API se consume
    desde otro origen: el frontend en Vercel).
  - `cors(...)` con allowlist exacta: `https://www.menudigitalapp.com.ar`,
    `http://localhost:5173` y `http://localhost:3000`, sin barra final. No incluye
    el apex ni el dominio antiguo de Vercel. También declara `app.options('*', cors())`.
  - `express.json()` + `express.urlencoded()`.
  - `express-mongo-sanitize` — **solo** en `/api/users|menus|items|admin|massive`
    (excluye `/api/payments` a propósito: el webhook de MercadoPago manda un query
    param `data.id` con punto, que el sanitizer eliminaría).
  - `apiLimiter` en `/api`.
- Monta `/api/admin/crm`, `/api/admin/payments`, `/api/admin/plans` y
  `/api/admin/sellers` antes de `/api/admin`; también `/api/plans`, usuarios,
  menús, items, massive y pagos.
- Rutas sueltas: `GET /ping` (health check con log), `GET /:businessName/menu`
  (redirect legacy), `GET /` (status JSON). El redirect legacy apunta a
  `/api/menus/public/:slug`, que no está definido en `menuRoutes.js`; la carta
  vigente consulta `/api/users/:slug/menu`.
- Handler 404 y, al final, el **error middleware** `(err, req, res, next)` que
  centraliza en `handleError` cualquier error no atrapado (ej: JSON malformado).

## config/

### `config/environment.js`

- **`validateEnvironment()`** — se ejecuta al iniciar el backend y corta el proceso si
  falta una variable crítica de autenticación, altas pagas o MercadoPago. Exige
  `MP_ENV=test|production`, URLs HTTPS en producción y que `NODE_ENV`/`MP_ENV`
  coincidan para impedir un deploy productivo con pagos de prueba.
- **`getExpectedPaymentLiveMode()`** — traduce `MP_ENV` al `live_mode` esperado del
  pago consultado a MercadoPago. El webhook audita pero no acredita un pago de otro
  ambiente.
- **`.env.example`** — contrato versionado de variables sin credenciales reales.

### `config/db.js`

- **`connectDB()`** — conecta Mongoose a `MONGODB_URI`. Antes fuerza los DNS a
  Google/Cloudflare (`dns.setServers(["8.8.8.8","1.1.1.1"])`) porque el resolver
  de c-ares bloquea las consultas SRV de Atlas. Si falla, corta el proceso.

### `config/plans.js`

Reglas técnicas: `PLAN_MAP`, `PLAN_ORDER`, `BOOLEAN_FEATURES`, `TEMPLATE_IDS`,
`isValidFeatures`, `isValidPeriodMultipliers`, `getTemplateForFeatures` y `getEffectivePlan`.
El orden solo gobierna upgrade/renovación; **no hay herencia de beneficios**.
Las asignaciones, límites y diseños permitidos viven en `Plan.features`.
Una suscripción vencida usa Free; un template retirado se presenta con el primer
ID permitido sin modificar la selección persistida.

### `config/paymentPlans.js`

Semillas iniciales y helper de referencia para tests: Basic 29.999, Pro 49.999 ARS,
períodos 1/3/6/12 con multiplicadores 1/2.7/5/9. No determina cobros runtime:
las rutas cotizan con `services/planCatalog.js` desde MongoDB, sin fallback.

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
number, location, address, social,
`reservationMessage`), `media` (pictures[], backgroundPicture), `acceptedTerms*` y
`schedule` (horario del local por día: enabled/open/close, distinto de la
programación de cada producto). `slug` tiene índice único sparse. `timestamps`,
hook de hasheo con bcrypt y método `matchPassword`. `sellerID` referencia al
vendedor atribuido durante un alta paga con código; es null para el resto.

### `models/Plan.js`

Colección `plans`, un documento por `free/basic/pro`: `name` único/inmutable,
`label`, `description`, `price`, `discountPrice`, moneda ARS, `periodMultipliers`,
`features`, `updatedBy` y timestamps. Concurrencia optimista con `__v`.
`features` es un objeto obligatorio idéntico en los tres planes: booleanos explícitos,
`item_limit` positivo o null y `templateIds` no vacío de IDs 1–15 sin duplicados.
Free cuesta cero; planes pagos positivos, promociones menores al precio regular.
`periodMultipliers` es un Map numérico con exactamente 1/3/6/12 meses: un mes vale
1 y el resto debe ser positivo y no superar la cantidad de meses. Cada total pago
debe redondear a al menos un peso; API y modelo validan estas restricciones.
La semántica de `discountPrice` quedó inconsistente desde el cambio de vendedores:
el DTO público lo expone como `effectivePrice`, pero upgrade/renovación cotizan
`price`; el alta paga solo lo aplica con un código válido. Es un bloqueo de release.

### `models/Seller.js`

Colección global de vendedores: `name`, `dni` y `code` obligatorios, únicos y con
trim; timestamps. El código se genera con formato `AAA-999` en el controller. No
hay estado activo/inactivo ni borrado lógico. `PendingRegistration` y `User`
referencian el `_id`; MongoDB no impide que un borrado deje referencias históricas.

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
registro, plan y período, junto con el hash de un token opaco de activación,
`sellerID` opcional y
el `preferenceId/initPoint` de MercadoPago y la referencia al `PaymentCheckout`.
Un retry reutiliza la preferencia si el checkout está `ready`, conserva plan,
período, versión del catálogo, importe y moneda, y tiene `preferenceId/initPoint`.
Si esas condiciones cambian crea otro snapshot y marca el anterior `superseded`,
incluso cuando solo cambió un multiplicador y la selección sigue siendo la misma.
La contraseña temporal se cifra con AES-256-GCM en
`passwordCiphertext/passwordIV/passwordAuthTag`; los tres campos son `select:false`
y requieren un `PENDING_REGISTRATION_SECRET` estable de al menos 32 caracteres en
el backend. `password` queda oculto y se lee únicamente como compatibilidad transitoria
para altas creadas antes de este cambio.
`status` recorre el ciclo interno `pending/completed/failed`; el último estado real
de MercadoPago vive separado en `paymentID/paymentStatus/paymentStatusDetail` y
`paymentUpdatedAt`. `completed` implica que el `User` asociado ya existe y recibió
el plan/vencimiento comprado; recién entonces elimina la contraseña y enlaza
`userID`. Un índice TTL limpia el documento vencido y la consulta por token también
filtra `expiresAt` para no depender de la demora del monitor TTL de MongoDB.

### `models/PaymentCheckout.js`
Snapshot durable creado **antes** de enviar al usuario a MercadoPago. Sus condiciones
de negocio son inmutables: operación, `User` o `PendingRegistration` asociado, plan,
período, importe esperado, moneda y plan/vencimiento de origen. Después solo avanza
el estado operativo (`creating/ready/superseded/failed/payment_received`) y se enlazan
`preferenceId/initPoint`. No tiene TTL. Su `_id` viaja como `metadata.checkout_id` y
permite demostrar qué ofreció el backend aunque los precios cambien más adelante.
Incluye `planVersion` inmutable en nuevos checkouts (opcional para documentos legados).
`preferenceExpiresAt` sigue pendiente en PAY-05.

### `models/PaymentTransaction.js`
Historial **durable** de cada pago consultado a MercadoPago. `paymentID` es único y
cada reintento del webhook actualiza el mismo documento; no usa TTL y por eso
sobrevive a la limpieza de `PendingRegistration`. Conserva `preferenceId` (nullable
en los flujos que todavía no lo exponen), `merchantOrderID`, `externalReference`,
referencias opcionales a `User`/`PendingRegistration`, operación
(`registration/upgrade/renewal/unknown`), plan, período, importe, importe
reembolsado, moneda, estado/detalle, modo live y las fechas informadas por MP.
Además registra el resultado interno de la acreditación en
`entitlementStatus` (`pending/not_applied/applied`), su motivo, plan/período
efectivamente otorgados, fecha de aplicación y
`subscriptionExpiresAtBefore/subscriptionExpiresAtAfter`. El vencimiento anterior
se captura una sola vez antes de modificar `User`: campo ausente significa “todavía
no capturado” y `null` significa “la cuenta realmente no tenía vencimiento”. En
altas también conserva el `preferenceId` de `PendingRegistration` y enlaza el
`User` definitivo cuando se crea.
También enlaza `PaymentCheckout`, registra si la validación fue `strict`, `legacy` o
`failed`, el motivo del rechazo y el instante del intento de aplicar el entitlement.
No guarda el payload completo ni datos del comprador o de la tarjeta. Los campos de
metadata externa no usan enums de negocio: aun un pago con metadata inválida debe
quedar auditado sin convertir el webhook en un ciclo permanente de respuestas 500.


## middleware/

### `middleware/auth.js`

- **`protect(req,res,next)`** — exige `Authorization: Bearer <jwt>`. Verifica el token
  (`jwt.verify` con `algorithms:["HS256"]` fijado como defensa contra confusión de
  algoritmo), carga el user en `req.user` (sin password), rechaza si no existe o si la
  cuenta está desactivada (salvo admins), y expone `free` como plan efectivo si la
  suscripción paga ya venció.
- **`isAdmin(req,res,next)`** — 403 si `req.user.admin` no es true. Se usa después de
  `protect`.
- **`requireFeature(feature)`** consulta `getRequestPlan()` y exige el booleano
  activo en MongoDB (403 si está desactivado; 503 ante catálogo indisponible).

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
- Importa **`generateAuthToken`** de `utils/authToken.js` y **`generateSlug`**,
  **`createUserWithUniqueSlug`** y **`updateUserWithUniqueSlug`** de `utils/slug.js`.
- **`getContactInfo`** — limita lecturas y ediciones a los campos vigentes de contacto;
  evita exponer o volver a guardar campos retirados de documentos/clientes antiguos.
- **`getPublicItemForPlan`** — normaliza ofertas/disponibilidad según el plan
  efectivo antes de exponer datos.
- **`isWeakPassword(password)`** — `true` si tiene < 8 chars o está en un blocklist de
  contraseñas comunes.

Endpoints:

- **`newUser`** `POST /api/users/register` — valida tipos (anti NoSQL injection),
  términos aceptados, fuerza de password; crea el user (slug desde businessName o
  username), devuelve token.
- **`loginUser`** `POST /api/users/login` — valida credenciales, compara con bcrypt y
  devuelve la sesión completa (`slug`, plan/vencimiento y token), incluida la vía de
  recuperación manual después de un alta paga.
- **`getAuthUser`** `GET /api/users/me` — datos del user autenticado + `itemCount` y
  `categoryCount`, `features` efectivas y template permitido (para el dashboard).
- **`fetchUserWithMenu`** `GET /api/users/:slug/menu` — carta **pública** por slug:
  arma el menú agrupado (secciones→categorías→items), filtra ocultos, y dispara
  `trackView`. Si `programacion_productos` está activo, combina el interruptor manual `available` con la programación
  semanal del producto en horario de Buenos Aires; fuera de horario el item permanece
  visible como no disponible. Es lo que renderiza la carta pública.
- **`fetchOwnMenu`** `GET /api/users/me/menu` — menú del dueño autenticado, **sin**
  filtrar ocultos (para gestionarlos en el editor) + objeto `limits`
  (`itemCount`, `itemLimit`, `canEditMenu`, `canImportExcel`, `canExportPdf`, `canScheduleItems`, `canScheduleOffers`) para
  la UI de gating.
- **`fetchStats`** `GET /api/users/me/stats` (permiso `estadisticas`) — devuelve `totalViews` y la
  serie `last30Days` (30 puntos, rellenando días sin visitas con 0), con las fechas
  calculadas en horario de Buenos Aires.
- **`trackItemViewEndpoint`** `POST /api/users/:slug/menu/items/:itemID/view` (público) —
  registra que se tocó un producto de la carta. Resuelve el dueño desde el **slug** (no
  confía en un userID del cliente) y valida que el item sea realmente de ese local antes
  de contarlo. Responde siempre `204` (fire-and-forget, nunca rompe la experiencia).
- **`fetchItemStats`** `GET /api/users/me/item-stats` (permiso `estadisticas`) — top 10 de productos
  más vistos en los últimos 30 días (agregación sobre `ItemView` + join contra `Item`
  para título/imagen; un producto borrado se muestra como "(producto eliminado)").
- **`fetchUser`** `GET /api/users/:slug` — datos públicos de un local activo
  (landing por slug), si `landing_page` está activa. Devuelve features y usa el template permitido
  por el plan efectivo; la publicidad sigue `features.sin_publicidad`.
- **`downloadMenuPdf`** `GET /api/users/:slug/menu/pdf` — genera el menú imprimible,
  requiere `features.menu_pdf` aunque la URL sea pública. Excluye productos
  manualmente pausados; además aplica el horario si `programacion_productos` está activa.
- **`editUser`** `PUT /api/users/me` — edita `contactInfo/hasDelivery/media/schedule`
  (whitelist; `template` va por `useTemplate`). Preserva los campos vigentes de
  contacto omitidos en ediciones parciales y valida el horario del local.
- **`uploadImage`** / **`uploadBackground`** — suben foto a la galería / de fondo del
  local (a Cloudinary).
- **`removeImage`** / **`deleteBackground`** — sacan una foto de la galería / el fondo.
- **`useTemplate`** `PATCH /api/users/template` — cambia el template; valida contra
  `TEMPLATE_IDS` y `features.templateIds` del catálogo. **Barrera real** del gating de
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
- **`newItem`** `POST /api/items` — crea producto; consulta `features.item_limit`
  (`null` significa ilimitado) y exige `programacion_productos` para ofertas o
  disponibilidad programadas. Valida horarios/solapamientos y la unicidad de `code`
  **por usuario** (no global); los permisos no dependen del nombre del plan.
- **`editItem`** `PUT /api/items/:itemID` — edita campos de contenido (whitelist);
  unicidad de code por usuario solo si cambia.
  **Pendiente comprobado:** la whitelist no incluye `available` ni `hidden`, aunque
  `MenuEditor.saveItem` los envía. Los PATCH específicos sí los manejan; dos tests
  locales fallan por persistencia/validación de esos flags en el PUT.
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
  recientes), todo en queries paralelas. Los conteos de usuarios excluyen admins;
  “con menú publicado” usa `User.menu`, no una comprobación en vivo de su contenido.

### `controllers/adminPaymentController.js` (pagos admin, solo lectura)

- **`listPayments`** `GET /api/admin/payments` — pagina de a 25 (máximo 100), filtra
  por búsqueda, estado financiero, acreditación, operación y `userID`. Valida el
  cliente, escapa búsquedas y lee exclusivamente `PaymentTransaction` local.
- **`paymentToDTO`** — limita la respuesta a datos operativos y referencias de
  usuario/pending/checkout; no expone credenciales, token de activación ni init point.
- **`getSummary`** — cuenta aprobados, pendientes, fallidos, reembolsados, aplicados
  y alertas; suma importes aprobados con plan aplicado. El resumen es global o por
  cliente, no cambia con los filtros de la tabla ni normaliza a MRR. No consulta
  MercadoPago ni ejecuta devoluciones, reintentos o acreditaciones manuales.

### `controllers/massiveController.js` (importar/exportar Excel — feature `carga_masiva_excel`)

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
  con etapa/tags/próximo seguimiento, plan/vencimiento, onboarding, último pago y
  alertas. Usa consultas agrupadas a usuarios, perfiles, menús, productos y pagos,
  sin una consulta por cliente. Devuelve `attentionSummary` para CRM y dashboard.
- **`getClient`** `GET /api/admin/crm/clients/:userID` — detalle: datos del local + su
  perfil de CRM (o default), onboarding y resumen de actividad. Rechaza IDs inválidos
  y cuentas admin. El onboarding se deriva de datos existentes, no es otra colección.
- **`updateProfile`** `PATCH /.../:userID` — actualiza etapa/tags/nextFollowUp (upsert;
  valida la etapa y que el user exista).
- **`addNote`** `POST /.../:userID/notes` — agrega una nota (autor = admin logueado).
- **`deleteNote`** `DELETE /.../:userID/notes/:noteID` — elimina un subdocumento por
  ID. La UI oculta el borrado de eventos, pero el endpoint no filtra `kind`; no
  describir los eventos como inmutables a nivel servidor.
- **`getOverdueCount`** `GET /api/admin/crm/overdue-count` — cantidad de clientes con
  seguimiento anterior al día actual de Buenos Aires (hoy no cuenta como vencido).
  Endpoint liviano para el badge de
  alerta del sidebar del panel.
- **`exportClients`** `GET /api/admin/crm/export?stage=` — exporta el listado (opcional
  filtrado por etapa) a un `.xlsx` con ExcelJS (mismo patrón que el exportador de menús).
Las alertas separan problemas de pago, plan vencido, vencimiento en 30 días, plan
pago sin fecha, seguimiento vencido y onboarding incompleto. CRM conserva el plan
almacenado y su vencimiento; no equivale al plan efectivo que expone la API del dueño.

### `controllers/sellerController.js`

CRUD admin de vendedores: lista ordenada por creación, detalle por ID, alta,
edición y eliminación. Nombre, DNI y código tienen unicidad en MongoDB; el alta
genera el código aleatorio `AAA-999` y reintenta si colisiona. Listado y detalle
consultan los `User` atribuidos en lote, excluyen admins y calculan en servidor plan
efectivo, totales, cuentas activas, altas y vencimientos a 30 días, Basic/Pro, menú
creado y última alta. El detalle expone un DTO acotado sin mail, teléfono ni otros
datos de contacto; la UI enlaza al CRM/Pagos para operar cada cliente. Usa
`handleError` sin filtrar internals. Pendientes de hardening: no valida
formato/longitud de nombre y DNI en el servidor con el mismo rigor que la UI y el
borrado físico puede dejar referencias desde `User`.

### `controllers/planController.js`

`listPlans` devuelve catálogo con `Cache-Control: no-store`. `updatePlan` exige
precio, promoción, nombre visible, descripción, objeto `features` completo y
`version`; valida tipos/campos y atribuye el cambio al admin. Devuelve 409 ante
versión vieja o carrera. Los routers están montados, con `protect + isAdmin`.
Free permite editar beneficios pero conserva precio cero. Acepta un objeto opcional
`periodMultipliers` con los cuatro factores; omitirlo conserva el mapa anterior.
Valida tipos numéricos, claves exactas, el mes base en 1 y totales pagos positivos.
No edita IDs ni agrega períodos.

### `controllers/paymentController.js` (MercadoPago)
- **`verifyMpSignature(req)`** — valida la firma HMAC-SHA256 del header `x-signature`
  contra `MP_WEBHOOK_SECRET` (con `timingSafeEqual`). Falla cerrado con `401` si falta
  el secreto o la firma no coincide; además la validación de arranque impide iniciar
  el backend con ese secreto ausente.
- **`getRegistrationStatus`** `POST /api/payments/registro/estado` — consulta con el
  token opaco si el alta paga sigue pendiente, se completó o falló. Cuando está
  completada devuelve también la sesión del `User` asociado, para recuperar el login
  automático aunque la acreditación se haya demorado. Solo acepta registros cuyo
  `expiresAt` sigue vigente.
- **`mpWebhook`** `POST /api/payments/webhook` — endpoint que llama MercadoPago. Verifica
  firma, consulta el estado **real** del pago contra la API de MP (nunca confía en el
  query string) y hace upsert de `PaymentTransaction` antes de cualquier validación
  o cambio de plan. Así también persiste pagos pendientes, rechazados o con metadata
  inválida; si Mongo falla en ese punto responde 500 sin modificar el usuario para
  que MP reintente. Compara `paymentData.live_mode` con `MP_ENV`; una discrepancia
  queda `not_applied` con motivo `payment_environment_mismatch`. Además guarda el
  estado/detalle en las altas pendientes y, si
  está `approved`, crea el `User` o actualiza una cuenta existente. Si una alta
  encuentra un `User` con las mismas credenciales (recovery de un fallo intermedio),
  primero reconcilia el beneficio de forma monotónica: no degrada un plan activo ni
  acorta un vencimiento posterior. Solo después deja `PendingRegistration` en
  `completed`. En altas nuevas fija `subscriptionExpiresAt`, elimina la contraseña
  temporal y habilita el login automático. En upgrades fija la vigencia desde la
  aprobación. Para pagos nuevos exige que asociación, operación, plan, período,
  importe y moneda coincidan con el `PaymentCheckout` original; los checkouts
  desplegados antes de este snapshot quedan identificados como `legacy` para no
  abandonar cobros que ya estaban abiertos. Upgrades y renovaciones se aplican en
  una transacción MongoDB: releen el estado vigente, suman cada `paymentID` distinto
  desde el vencimiento actual y conservan un vencimiento posterior. Un checkout
  antiguo nunca baja el plan; si intentaría hacerlo queda `not_applied` para
  conciliación/reembolso. Antes del efecto captura una sola vez los vencimientos
  anterior/nuevo; después de completar
  `User`/`PendingRegistration` marca la transacción `applied`. Una nueva entrega del
  mismo `paymentID` refresca el estado financiero pero no reaplica el plan ni duplica
  el evento CRM. Un reembolso o contracargo queda reflejado en el estado de MP sin
  revocar automáticamente un beneficio históricamente aplicado. Es la **única** vía
  legítima para cambiar/renovar un plan y registra el evento en el CRM.

  **Corrección del 01-09-2026 — Punto 1:** se retiraron de
  `applyExistingUserEntitlement` las referencias fuera de alcance a `pending` y
  `paidMonths`; las ramas existentes vuelven a calcular recuperación, renovación o
  upgrade con `months`. `paymentWebhook.test.js` pasa 44/44. Sigue separado el Punto
  2: en el alta paga se persiste `sellerID`, pero `subscriptionExpiresAt` se calcula
  solo con los meses comprados y no agrega los siete días prometidos.


## routes/

Cada archivo define un `express.Router` y ata rutas → middlewares → controllers.

- **`routes/userRoutes.js`** — `/register` y `/login` (con `authLimiter`); rutas privadas
  `/me`, `/me/menu`, `/me/stats` y `/me/item-stats` (ambas `requireFeature("estadisticas")`), `PUT /me`,
  uploads, `/template`, `/active`; y al final las públicas por slug
  `POST /:slug/menu/items/:itemID/view` (tracking por plato), `/:slug/menu` y `/:slug`
  (van últimas para no interceptar las rutas fijas).
- **`routes/menuRoutes.js`** — CRUD de menús (todas `protect` + `requireFeature("menu_editor")`).
- **`routes/itemRoutes.js`** — CRUD de items (todas `protect` + `requireFeature("menu_editor")`).
- **`routes/adminRoutes.js`** — rutas admin (todas `protect + isAdmin`).
- **`routes/adminPaymentRoutes.js`** — `GET /` bajo `/api/admin/payments`, protegido
  por `protect + isAdmin`, montado antes del router admin genérico.
- **`routes/planRoutes.js`** / **`routes/adminPlanRoutes.js`** — lectura pública y
  lectura/edición admin montadas en `/api/plans` y `/api/admin/plans`.
- **`routes/sellerRoutes.js`** — CRUD bajo `/api/admin/sellers`, siempre con
  `protect + isAdmin`. La validación pública del código vive inline en
  `paymentRoutes.js`.
- **`routes/massiveRoutes.js`** — `template/preview/confirm`, todas gateadas con
  `requireFeature("menu_editor")` y `requireFeature("carga_masiva_excel")`; multer en memoria con límite de 5MB.
- **`routes/crmRoutes.js`** — CRM interno bajo `/api/admin/crm` (montado en app.js
  ANTES de `/api/admin` para que su prefijo matchee primero). Todas `protect + isAdmin`:
  `GET /overdue-count` y `GET /export` (de nombre fijo, van antes del param),
  `GET /clients`, `GET /clients/:userID`, `PATCH /clients/:userID`,
  `POST /clients/:userID/notes`, `DELETE /clients/:userID/notes/:noteID`.
- **`routes/paymentRoutes.js`** — usa la configuración central de precios y períodos.
  `POST /validate-seller-code` valida públicamente el formato y existencia del código;
  `POST /crear-preferencia-registro` crea o recupera el alta pendiente, persiste el
  snapshot de checkout y, con código válido, usa `discountPrice ?? price` y enlaza
  `sellerID`. Reutiliza una preferencia `ready` si coinciden selección,
  versión, importe y moneda y existen `preferenceId/initPoint`, y devuelve
  `init_point` + token opaco; `POST /registro/estado` permite esperar al webhook;
  `POST /crear-preferencia` (autenticado) valida plan/período, impide downgrades,
  crea el snapshot server-side y luego la preferencia de upgrade/renovación;
  `POST /webhook` crea la cuenta o acredita el cambio/renovación con vencimiento.
  Crea clientes del SDK e idempotency keys por operación, comprueba que MP devuelva
  id/init point y persiste el estado `ready` antes de redirigir. Registro envía
  vencimiento explícito de preferencia; upgrade/renovación todavía no (PAY-05).
  Las rutas inline de pagos tienen respuestas `{error}` y manejo propio; no todas
  las respuestas de la API usan el formato `{message}` de los controllers. La
  búsqueda del vendedor está duplicada en el alta y `sameSeller` se calcula después
  de sobrescribir `pending.sellerID`, por lo que hoy no demuestra que la atribución
  original coincida al decidir reutilizar un checkout.

## services/

### `services/planCatalog.js`

- `initializePlans()` espera índices e inserta faltantes con `$setOnInsert`.
  Completa solo documentos legados sin `features`, incrementando `__v`; preserva
  precios/promociones/multiplicadores y valida el catálogo antes del arranque.
- `planToDTO()` / `listPlans()` exponen las features, multiplicadores, versión y totales.
- `getPlan()` / `getPlanForUser()` leen MongoDB y resuelven plan efectivo;
  `getRequestPlan()` reutiliza la lectura solo dentro de la petición actual.
- `getCheckoutQuote()` cotiza desde MongoDB. El flag opcional
  `withSellerDiscount` selecciona promoción, pero ninguna ruta lo usa: registro
  recalcula inline y upgrade/renovación toman lista. A la vez, `planToDTO()` calcula
  `effectivePrice`/`billingOptions` con promoción para todos los consumidores. Esta
  divergencia explica dos pruebas fallidas y puede mostrar un total distinto del que
  crea el backend. Sin catálogo válido se bloquea el cobro, sin fallback. Las rutas validan
  `planVersion` y responden 409 antes de escribir o solicitar una preferencia.

## utils/

- **`utils/authToken.js`** — **`generateAuthToken(userID)`**: genera el JWT de sesión
  compartido por el login tradicional y la recuperación de un alta paga completada.
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
- **`utils/pdfBrowser.js`** — `getBrowser()` reutiliza Chrome headless por proceso,
  recupera arranques fallidos/desconexiones y usa Puppeteer. Requiere el navegador
  y sus dependencias del sistema en el deploy; los tests unitarios no prueban ese runtime.
- **`utils/menuPdfTemplate.js`** — `buildMenuHTML()` genera HTML imprimible de
  secciones/categorías/productos, escapa texto y omite items ocultos/no disponibles.
- **`utils/pendingCredentials.js`** — cifra y autentica con AES-256-GCM la contraseña
  que debe sobrevivir hasta la aprobación del pago; también descifra registros legacy
  mientras sigan dentro de su TTL.
- **`utils/slug.js`** — centraliza la normalización y asignación única de slugs para
  registro gratuito, alta paga y edición. Si el nombre ya existe usa sufijos legibles
  (`cafe-roma-2`, `cafe-roma-3`) y reintenta si el índice `unique` detecta una carrera.
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

- **`App`** — envuelve la app en `BrowserRouter` → `NotificationProvider` →
  `AuthProvider` → `Suspense` → `AppRoutes` (todas las páginas se cargan lazy). El
  fallback de Suspense usa `FullScreenLoader`.

## <a id="frontend-routes"></a>routes/

### `routes/AppRoutes.tsx`

- **`AppRoutes`** — declara todas las rutas con `lazy()`:
  - Públicas: `/` (AdminHome = landing comercial), `/login`, `/register`,
    `/register/plans`, `/register/success`, `/terminos`, `/privacidad`, `/contacto`.
  - Admin (protegidas por `AdminRoute` + `AdminLayout`, el shell con sidebar/bottomnav):
    `/admin` (CEODashboard), `/admin/crm` (CrmClients), `/admin/payments` (AdminPayments).
    `/admin/plans` (AdminPlans) y `/admin/sellers` (AdminSellers), disponibles
    también en la navegación.
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
  token, isLoading, login, `completeLogin`, `refreshUser`, logout, isAuthenticated). El tipo del user es `AuthUser`
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
  - **`completeLogin(data)`** — acepta la sesión entregada por el backend, también
    desde `RegisterSuccess`, sin necesitar volver a enviar la contraseña temporal.
  - **`logout()`** — limpia state y localStorage.

### `context/useAuth.ts`

- **`useAuth()`** — hook que devuelve el `AuthContext`; tira error si se usa fuera del
  `AuthProvider`.

### `context/NotificationContext.ts`, `NotificationProvider.tsx` y `useNotifications.ts`

- Sistema global de feedback con mensajes `success`, `error` e `info`. El provider
  mantiene hasta cuatro avisos visibles, evita duplicados inmediatos, aplica tiempos
  de cierre según el tipo y limpia sus timers al desmontarse. Los avisos usan
  `role="alert"` para errores y `role="status"` para confirmaciones/información.
- **`useNotifications()`** expone `notify`, `success`, `error` e `info`; exige estar
  dentro de `NotificationProvider`.

### `context/CartContext.tsx`

- **`CartLine`** (interface: itemId, title, unitPrice, quantity, selectedOption?) y
  **`CartContextType`** / **`CartContext`** — el contexto del **carrito de la carta
  pública** (enabled, items, addItem, removeItem, updateQuantity, clearCart, totalItems,
  totalPrice). Dos variantes distintas del mismo producto son líneas separadas.

### `context/CartProvider.tsx`

- **`lineKey(itemId, selectedOption)`** — clave única de línea (producto + variante).
- **`readCart(slug)`** — lee el carrito de localStorage (tolerante a JSON corrupto).
- **`CartProvider({slug, enabled, children})`** — provee el carrito. Persiste en localStorage
  bajo `cart:<slug>` (un carrito **por local**, no global); si el slug cambia por
  navegación SPA recarga el carrito de ese local (ajuste de estado durante el render,
  sin efecto). Si localStorage no está disponible sigue funcionando en memoria.
  `enabled` viene de `features.pedido_whatsapp`; si está desactivado, no permite
  agregar productos ni cambiar cantidades, sin borrar el carrito guardado.

### `context/useCart.ts`

- **`useCart()`** — hook consumidor del `CartContext` (mismo patrón que `useAuth`).

## hooks/

### `hooks/useReveal.tsx`

- **`useReveal<T>()`** — devuelve `{ref, revealed}`. Con un `IntersectionObserver`,
  marca `revealed=true` la primera vez que el elemento entra al viewport y deja de
  observar. Usado para scroll-reveal en la landing pública.

### `hooks/useFeedbackMessage.ts`

- **`useFeedbackMessage(type, initialValue?)`** conserva un string para los banners
  inline existentes y publica cada valor no vacío en el sistema global. Se usa en
  formularios, editores, pagos y paneles para migrar feedback sin duplicar estado.

### `hooks/useAsyncAction.tsx`

- **`useAsyncAction()`** — abstrae el boilerplate `setLoading/try/catch/setError` de las
  acciones async. Devuelve `{loading, error, success, setError, setSuccess, run,
  mountedRef}`. **`run(fn, opts)`** ejecuta la acción, maneja `ApiError` (mensajes
  reales según tipo), respeta `successMessage`/`onError`, publica el resultado en las
  notificaciones globales y soporta acciones concurrentes. `mountedRef` se activa al
  montar y se invalida en el cleanup para no pisar estado tras el desmontaje.

### `hooks/useTheme.ts`

Tema claro/oscuro del **panel** (solo tokens `--admin-*`).

- **`readTheme()`** — lee la preferencia de localStorage (default `"dark"`).
- **`applyTheme(theme)`** — pone/saca `data-theme="light"` en `<html>`.
- **`useTheme()`** — devuelve `{theme, toggle, setTheme}`; persiste en localStorage. La
  primera aplicación (anti-flash) la hace un script inline en `index.html`.

### `hooks/usePlans.ts`

React Query consulta `api/plans.ts` con `PLANS_QUERY_KEY`, `staleTime: 0` y refetch
al montar. Lo consumen landing, registro, suscripciones, dashboard y paywalls.
Un error se muestra con reintento; no hay copias de precios como fallback.

## lib/

### `lib/plans.ts`

`PLAN_ORDER`/`PLAN_LABEL` son identificadores, orden y etiquetas técnicas de UI.
`FEATURE_LABELS`, `BOOLEAN_FEATURES` y `getPlanFeatureLabels()` convierten el objeto
del catálogo en textos visibles, incluyendo límite y cantidad de diseños.
No asignan permisos: el backend los resuelve desde MongoDB.

### `lib/whatsapp.ts`
Helpers puros del **pedido por WhatsApp**, sin backend de pedidos. El permiso
`pedido_whatsapp` se aplica en la UI y en `CartProvider`, no dentro de estos helpers.
- **`sanitizePhoneForWa(number)`** — convierte el teléfono guardado (dígitos locales
  sin código de país) al formato `54 9 <área><número>` que exige `wa.me` para celulares
  argentinos; saca un `0` inicial de discado si lo hubiera. Devuelve null si no hay número.
- **`buildOrderMessage(cart, businessName)`** — arma el texto legible del pedido
  (cantidad × producto, variante, subtotal por línea y total).
- **`buildWaLink(number, message)`** — devuelve el link `https://wa.me/...?text=` (URL-
  encoded) o null si el número no sirve (el caller oculta el botón en ese caso).


### `lib/offers.ts`

`isOfferActive(item, now)` comprueba precio y rango temporal para mostrar ofertas
en la carta y el modal. El backend resuelve el permiso y el dato público.

### `lib/adminPayments.ts`

Etiquetas financieras, formateo ARS/fecha y `humanizePaymentCode`, compartidos por
Pagos, CRM y CEO.

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
`fetchPublicMenu` apunta a `/menus/public/:slug` y `hideMenu` a `PUT /menus/hide/:id`:
son wrappers desalineados con las rutas actuales. La carta real usa
`/users/:slug/menu` y el editor `PATCH /menus/:id/hidden`; no copiarlos como contratos.

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
Incluye **`setCrmClientActive`**, que usa el endpoint admin de estado de cuenta.

### `api/adminPayments.ts`

**`listAdminPayments(params)`** — consulta paginada/filtrada al historial local,
incluido `userID` para el detalle de un cliente. No modifica datos en MercadoPago.

### `api/plans.ts` y `api/adminPlans.ts`

Contrato `PlanDefinition`/`PlanBillingOption`; `parsePlanCatalog` valida tres planes,
objeto `features`, `periodMultipliers`, versión y totales por período; comprueba que
cada opción de facturación coincida con el multiplicador guardado.
`listAdminPlans` y `updateAdminPlan`
consumen los endpoints protegidos montados. La UI no decide el importe de cobro.

### `api/adminSellers.ts`

Cliente axios tipado para `GET/POST /admin/sellers` y
`GET/PUT /admin/sellers/:id`. La lista recibe identidad, timestamps y métricas; el
detalle suma clientes con plan efectivo, estado, menú, alta y vencimiento. Alta y
edición conservan su DTO básico. La UI no expone el DELETE que sí existe en backend.

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
`MassiveConfirmResponse`), de admin (`AdminStats`) y de CRM (`CrmStage`,
`CrmNote` — con `kind: "note" | "event"` para distinguir notas manuales de eventos del
sistema —, `CrmProfile`, `CrmClient`, `CrmClientDetail`). `ContactInfo` incluye
datos del negocio, contacto, ubicación, redes y mensaje de reserva por WhatsApp.
También incluye horarios (`DayKey`, `DayHours`, `Schedule`), programación de
productos, vencimientos, DTOs `AdminPayment`/`AdminPaymentsResponse` y los tipos de
onboarding/alertas CRM, `PlanFeatures` y `BooleanPlanFeature`. El DTO comercial `PlanDefinition` vive en `api/plans.ts`.

## components/

### `components/Common/`

- **`ErrorBoundary.tsx`** — **`class ErrorBoundary`**: error boundary de React (único
  modo de atrapar errores de render). `getDerivedStateFromError`, `componentDidCatch`
  (loguea, hook para Sentry), `handleReload` y un fallback con botón "Recargar".
- **`BrandMark.tsx`** — imagen decorativa compartida desde
  `public/brand/menu-digital-app-brand-mark.png`, clase global `md-brand-mark`.
- **`FreePlanAd.tsx`** — publicidad reutilizable en la landing/carta cuando
  `features.sin_publicidad` no está activo, cualquiera sea el plan. Marca y CTA a
  `/`; estilos globales `t-free-plan-ad*`.
- **`FullScreenLoader.tsx`** — **`FullScreenLoader({label})`**: contenedor
  `.pageLoaderScreen` con `Spinner` de 36 px; guards y fallback de Suspense.
- **`Spinner.tsx`** — **`Spinner({size, label})`**: spinner SVG inline para botones y overlays
  ("Guardando...", subiendo imagen, etc). Hereda color vía `currentColor` y gira con la
  clase global `.iconSpinner`. Antes estaba copiado idéntico en UserEditor y MenuEditor.
  Si recibe `label` usa `role="status"`; si no, es decorativo. Algunas pantallas
  aún usan directamente `.pageLoaderRing`: no toda carga está migrada al componente.
- **`UpgradeModal.tsx`** — selector compartido de suscripción para dashboard y
  paywalls. Filtra upgrades/renovaciones válidos según plan actual, ofrece Basic/Pro y
  períodos 1/3/6/12, muestra total/ahorro del catálogo y envía `planId/months/planVersion`;
  filtra por función, template o límite requerido. Ante 409 recarga sin cobrar
  automáticamente. El backend vuelve a consultar y validar el precio real. CSS en su módulo homónimo.

### `components/Admin/Home/AdminHome.tsx`

Landing comercial pública (la home de `/`). Presenta la propuesta, precios y CTA a
registrarse. Precios y beneficios vienen de `usePlans()`/MongoDB. Las tarjetas
viven en una sección inline —no hay modal de precios— y enlazan a `/register?plan=<id>`: Free muestra "Crear cuenta" y
Basic/Pro, "Pagar y crear cuenta". Los CTA generales desplazan hasta esa sección.
Componente principal **`HomePage`** con hooks de animación (`useParallax`,
`useReveal`, `useCounterOnView`, steam rings), `CustomCursor` y navegación mobile.

### `components/Admin/Panel/AdminLayout.tsx`

Shell del **panel CEO** (sidebar desktop + bottom nav mobile + `<Outlet/>` para `/admin`
y `/admin/crm`/`/admin/payments`/`/admin/plans`/`/admin/sellers`), mismo patrón que el `DashboardLayout` del dueño.

- **`AdminLayout`** — nav items (Panel / CRM / Pagos / Planes / Vendedores), `useTheme` (toggle claro/oscuro),
  `handleLogout`, y un **badge de alerta** en el ítem CRM con la cantidad de clientes
  con seguimiento vencido (`getCrmOverdueCount`, se refresca en cada cambio de ruta).
  Íconos: `GridIcon`, `UsersIcon`, `LogoutIcon`, `SunIcon`, `MoonIcon`.

### `components/Admin/Panel/CEODashboard.tsx`

Resumen ejecutivo interno (`/admin`). **`CEODashboard`** carga `/admin/stats`, CRM y
pagos con `Promise.allSettled`: conserva indicadores disponibles si una fuente falla.
Muestra cuentas, menús, productos, importe aprobado con plan aplicado, alertas de
clientes/pagos, distribución de planes y cinco altas recientes. Los accesos llevan
a CRM/Pagos; las altas enlazan a `/admin/crm?client=<id>`. No gestiona clientes aquí.
El importe es acumulado del historial local, **no MRR ni saldo de MercadoPago**.
La distribución de planes usa la suscripción almacenada del CRM, no el plan efectivo.
`KpiCard`, `ModuleShortcut`, `AttentionRow` y helpers de presentación usan su CSS
Module y tokens `--admin-*`; navegación/logout viven en `AdminLayout`.

### `components/Admin/Crm/CrmClients.tsx`

**CRM interno** del CEO (`/admin/crm`). Helpers: `STAGE_META` (etiqueta+color por etapa),
`STAGE_ORDER`, `fmtDate`, `isOverdue`, `timeAgo`, `dateInputValue`.

- **`CrmClients`** — trae la lista (`listCrmClients`), la filtra por etapa (chips con
  contadores) y búsqueda, con **dos vistas alternables**: lista y **Kanban** (columnas
  por etapa, tarjetas arrastrables con drag & drop nativo que llaman a
  `updateCrmProfile` al soltarlas — `moveToStage`, optimista). Arriba, un **banner de
  seguimientos vencidos** (clickeable: filtra solo esos clientes) y un botón
  **"Exportar a Excel"** (`exportCrmClients`, respeta el filtro de etapa activo). Al
  seleccionar un cliente abre el drawer. La tabla 360 incluye contacto, estado,
  plan/vencimiento, onboarding, último pago y alertas, con ordenamiento y bandeja
  de atención. `?client=<id>` abre una ficha desde el dashboard.
- **`ClientDrawer`** — panel lateral de detalle: trae `getCrmClient`, muestra perfil +
  actividad + link a la carta, y permite cambiar etapa, editar tags, setear el próximo
  seguimiento y gestionar el historial de **Actividad**: notas manuales mezcladas
  cronológicamente con los eventos automáticos del sistema (`kind:"event"` — estilo
  discreto, autor "Sistema", sin botón de borrar). Los cambios se guardan al backend y
  se sincronizan con el listado. Incluye activación/desactivación con confirmación,
  checklist de onboarding y consulta de pagos del cliente. Cierra con Escape.

### `components/Admin/Payments/AdminPayments.tsx`

Historial operativo (`/admin/payments`): búsqueda, filtros, paginación, resumen y
detalle de IDs/validación/acreditación. Admite `?userID=<id>` y navega al CRM.
Separa el estado financiero del estado del plan; solo consulta datos persistidos,
sin pedir pagos a MP, devolver dinero ni modificar suscripciones.

### `components/Admin/Plans/AdminPlans.tsx`

Editor `/admin/plans` registrado en rutas y navegación CEO: nombres, descripciones,
precios, multiplicadores por período, booleanos, límite y templates por plan.
Free tiene precio fijo cero; el factor mensual es 1. La vista previa calcula con
los factores editados, admite coma/punto decimal y deshacer los restaura.
Guardado individual, deshacer, totales, conflicto 409 e invalidación de la query
pública. Advierte que los cambios de beneficios afectan también a usuarios pagos
existentes; los checkouts anteriores conservan su importe.

### `components/Admin/Sellers/AdminSellers.tsx`

ABM parcial de `/admin/sellers`: React Query carga la lista; formularios separados
crean y editan nombre/DNI; el código generado se muestra como inmutable. Normaliza
el DNI a ocho dígitos en frontend, informa 409 y actualiza el caché sin recargar.
Agrega resumen global, búsqueda por nombre/código/DNI, orden por clientes/última
alta/nombre y copia del código. Cada tarjeta muestra métricas actuales y carga bajo
demanda el detalle responsive de clientes, con acceso directo a su ficha CRM y a
Pagos. No ofrece eliminación, paginación ni activación/desactivación. Los estilos
viven en su CSS Module; los íconos del shell requieren `lucide-react`.

### `components/Login/Login.tsx`
- **`Login`** — formulario de login. Usa `useAuth().login`, muestra errores, redirige
  según rol al entrar. Toggle de ver/ocultar contraseña, "recordarme".

### `components/Register/Register.tsx`
- **`Register`** — formulario común para altas gratuitas y pagas. Valida
  username/password (min 8 chars, coincidencia) y aceptación de términos; guarda los
  datos temporalmente en `sessionStorage` como `pendingRegister` y navega a
  `/register/plans`. Si recibe `?plan=free|basic|pro`, conserva esa elección en la URL.
  Si la pestaña anterior se cerró pero existe `pendingRegistrationToken`, reanuda
  `/register/success` en lugar de sobrescribir el alta pendiente.

### `components/Register/RegisterPlans.tsx`

Consume precios, beneficios y períodos del catálogo; envía `planVersion`.
Bloquea pagos ante catálogo inválido y exige reconfirmación tras un 409.
- **`RegisterPlans`** — confirma el plan elegido (Basic por defecto si no vino uno
  válido) y ofrece períodos de 1/3/6/12 meses para planes pagos. Free llama a
  `POST /users/register`, inicia sesión y redirige al dashboard. Basic/Pro llaman a
  `POST /payments/crear-preferencia-registro`, guardan el token opaco y redirigen al
  checkout de MercadoPago. Si ya no existen los datos de la pestaña pero sobrevive
  el token persistido, reanuda la pantalla de activación en vez de iniciar otro pago.
  Para Basic/Pro acepta un código opcional `AAA-999`, lo valida contra
  `/payments/validate-seller-code` y muestra `discountPrice ?? price`. El backend lo
  vuelve a validar antes de cotizar. La pantalla afirma “precio promocional y 7 días
  de regalo”, pero la rama vigente del webhook no suma esos días; además muestra
  “Antes” incluso sin código. Ambos puntos requieren corrección antes de liberar.

### `components/Register/RegisterSuccess.tsx`
- **`RegisterSuccess`** — pantalla de retorno del alta paga. Consulta
  `POST /payments/registro/estado` hasta que el webhook complete la cuenta; luego hace
  un único login, limpia `pendingRegister` y redirige a `/dashboard`. Reintenta
  respuestas transitorias (`408`, `429`, `5xx` y errores de red), conserva un copy
  específico mientras el pago sigue pendiente y ofrece salidas a login, soporte o
  un nuevo registro para estados terminales o tokens vencidos.

### `components/User/Home/Home/UserHome.tsx`
**Landing pública por slug** (`/:slug`). Núcleo del sistema de templates.
- **`TemplateId`** / **`TemplateTokens`** (types), **`SLUG_REGEX`**, y
  **`TEMPLATE_TOKENS`** — mapa de config por template (heroClass, overlayClass,
  titleClass, showDeliveryRow, galleryRadius, btnLabel, useAvatar) para los 15 templates.
- **`BusinessLandingPage`** — componente de ruta: valida el slug, hace fetch de
  `/users/:slug`, maneja loading/notFound, y renderiza `<Template>` con los tokens del
  template elegido. Si `landing_page` está desactivada, redirige a la carta;
  diferencia una caída temporal del servicio de un 404 y permite reintentar.
- **`Template`** — layout unificado (hero con foto/overlay o header con avatar según
  `useAvatar`, título, badge de delivery, lista de contacto, galería bento, botón "Ver
  menú"). Setea `document.title`.
- Sub-componentes: **`ContactList`** (chips de contacto con `useReveal`, sin reseñas integradas), **`Gallery`**
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
  **`CartProvider`** (carrito por slug, habilitado por las features recibidas), renderiza el **`CartFab`** (botón flotante con
  badge de cantidad, solo si el carrito tiene algo), el **`CartDrawer`** — **dentro** del
  contenedor `[data-template]`, porque los tokens `--t-*` solo existen ahí.
  `features.pedido_whatsapp` controla el carrito y `sin_publicidad` los anuncios. **Responsive**: columna única estilo mobile hasta 1024px;
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
  plan”** (plan efectivo, beneficios del catálogo, vencimiento y CTA de suscripción), cards de navegación
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
  Cloudinary, **exportar/importar Excel** y **exportar PDF**. Cada permiso llega
  independientemente desde `/users/me/menu`; `canEditMenu` puede bloquear el editor.
  La programación semanal/de ofertas depende de `programacion_productos`. El upsell
  busca planes que ofrezcan la función o el límite requerido, sin topes hardcodeados.
- Búsqueda local normalizada por título, descripción, código, categoría y sección;
  formularios progresivos y validación accesible. Conserva navegación inferior y
  controles de disponibilidad/oculto/recomendado. Dos regresiones previas de `editItem`
  con `available`/`hidden` siguen pendientes; no equivalen a una prueba E2E del guardado.

### `components/User/Panel/UserEditor/UserEditor.tsx`
"Mi negocio" (`/user/editor`). Tabs info / media / template.
- `TEMPLATES` (los 15 diseños implementados), `EMPTY_FORM`. Sub-componentes `Toggle` y
  `LockIcon`; el spinner inline viene de `Common/Spinner`.
- **`UserEditorPage`** — edita datos de contacto vigentes (sin reseñas), delivery, galería
  (subida múltiple a Cloudinary con progreso, drag & drop) y **selección de template**
  con `features.templateIds`: candado y etiqueta del plan del catálogo que ofrece
  el diseño; `Common/UpgradeModal` se filtra por template requerido.

### `components/User/Panel/Stats/UserStats.tsx`
Estadísticas de visitas (`/estadisticas`, permiso `features.estadisticas`).
- **`requestStats(token)`** — fetch puro (sin React) de `/users/me/stats`; devuelve
  `{kind:"locked"|"data"|"none"}`.
- **`requestItemStats(token)`** — ídem para `/users/me/item-stats` (mismo gate de plan;
  se pide después de stats para no duplicar el manejo del 403).
- **`UserStats`** — carga inicial (con spinner) + **auto-refresh en tiempo real**
  (polling cada 45s solo con la pestaña visible + refresco al volver el foco). Muestra
  total y gráfico de los últimos 30 días, más la sección **"Productos más vistos"**
  (ranking top 10 con barra proporcional al más visto, solo si hay datos). Si el plan
  no incluye stats (403), muestra paywall con planes que incluyan `estadisticas`;
  no presupone que Pro la ofrezca.


## pages/

### `pages/Legal/`

Páginas legales estáticas:

- **`Terms.tsx`** — **`Terms`**: términos y condiciones.
- **`Privacy.tsx`** — **`Privacy`**: política de privacidad.
- **`Contact.tsx`** — **`Contact`**: formulario de contacto con validación local
  (`FormState`, `validate()`, `handleChange`, `handleSubmit`). Abre un `mailto:`;
  no hay endpoint de envío ni confirmación real de entrega de correo.

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
- **Marca y navegación mobile**: `.md-brand-mark`, `.t-free-plan-ad*`,
  `.admin-mobile-dock` y sus clases compartidas; los dos shells usan el mismo dock
  responsive con espacio para safe area.
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
  `/payments/registro/estado`, entrega la sesión a `completeLogin` cuando el webhook
  completa la cuenta y redirige a `/dashboard`. Si se cierra la pestaña, el token persistido
  permite reanudar esa activación sin repetir el pago. El JWT queda en localStorage
  (`AuthProvider`). Los guards `UserRoute`/`AdminRoute` protegen las rutas.
- **Carga del menú**: el dueño usa `MenuEditor` → `/menus` y `/items` (CRUD). Las
  imágenes de productos se suben directo a Cloudinary desde el editor; también
  existen uploads autenticados vía Multer para negocio/categorías/productos. Los
  ocultos se ven en el editor pero no en la carta pública.
- **Carta pública**: visitante entra a `/:slug/menu` → `fetchUserWithMenu` arma el menú
  agrupado, filtra ocultos y calcula la disponibilidad semanal en horario BA solo
  si `programacion_productos` está activa. Registra la visita (`trackView`).
- **Planes y pagos**: hay dos entradas. El alta paga usa
  `POST /payments/crear-preferencia-registro` antes de que exista el usuario; el upsell
  desde el panel usa `POST /payments/crear-preferencia` sobre una cuenta autenticada.
  En ambos casos el **webhook** (`mpWebhook`) verifica el pago real antes de crear la
  cuenta o actualizar `User.subscription`/`subscriptionExpiresAt`. Los checkouts
  nuevos llevan un snapshot durable y el webhook compara asociación, plan, período,
  importe y moneda. Cada cobro distinto extiende una sola vez desde el estado vigente;
  una preferencia antigua que implicaría downgrade no modifica la cuenta y queda para
  conciliación. El panel abre el
  `Common/UpgradeModal` compartido (plan + 1/3/6/12 meses) desde la tarjeta “Tu plan”
  y desde cada paywall. El gating de features (límite de items, Excel, PDF,
  ofertas y disponibilidad programadas, stats y templates) se valida en el backend
  (`requireFeature` / `Plan.features`) y se refleja en la UI desde el catálogo.
  Landing, publicidad y pedidos siguen los booleanos efectivos recibidos.

- **Vendedor y código promocional**: el CEO administra vendedores en
  `/admin/sellers`. Un alta Basic/Pro puede validar un código público; el backend
  vuelve a consultar `Seller`, cotiza el precio promocional si existe y conserva
  `sellerID` hasta el `User`. La administración deriva de esa referencia los clientes
  vendidos y su estado operativo actual; no presenta ingresos/comisiones históricas
  porque Checkout/Transaction no guardan un snapshot inmutable del vendedor. Las
  métricas tienen 6/6 pruebas focalizadas. El responsable del producto informó E2E
  exitoso del alta y los siete días en el despliegue probado; no se repitió en esta
  intervención. La semántica promocional todavía difiere entre DTO,
  upgrade/renovación y alta.

- **Validación de pagos**: `test/paymentWebhook.test.js` simula MercadoPago/Mongoose y
  cubre upgrades, renovaciones vigentes/vencidas, reintentos idempotentes, cobros
  distintos que acumulan exactamente una vez, validación de checkout/importe/moneda,
  checkouts antiguos que no degradan plan o vigencia, pagos
  pendientes, metadata inválida, preferencias legacy, firma inválida, usuario
  inexistente y alta paga. También verifica el upsert durable por `paymentID`, el
  índice único sin TTL, el vínculo a alta/preferencia/usuario, los vencimientos antes
  y después, la recuperación ante fallos intermedios y que una falla de auditoría
  ocurra antes de tocar la suscripción. Incluye un flujo encadenado
  `pending → approved → completed → JWT`, updates críticos nulos y la reconciliación
  que evita degradar planes/vencimientos. `test/pendingCredentials.test.js` verifica
  cifrado, manipulación y compatibilidad legacy; `test/slug.test.js` cubre colisiones
  y carreras; `test/userAuth.test.js` fija que el login manual entregue el `slug`
  requerido por `AuthProvider`. No reemplaza la prueba real end-to-end pendiente.

- **Pedido por WhatsApp**: en la carta pública el cliente arma un carrito
  (`CartProvider`, persistido en localStorage por slug) tocando "+" en cada producto
  (con selección de variante si tiene opciones). El `CartDrawer` muestra el pedido y
  el botón "Pedir por WhatsApp" abre `wa.me` con el mensaje prearmado
  (`lib/whatsapp.ts`) al número del local. Es client-side, sin backend de pedidos:
  la UI y `CartProvider` siguen `features.pedido_whatsapp` recibido del servidor.
  Esto no impide contactar al teléfono público por fuera de MenuDigital.
  El agregado simple también depende de `hasDelivery`; el código de variantes no
  aplica ese flag de forma uniforme. Este pendiente es independiente del permiso
  del catálogo; no hay gestión persistida de pedidos y falta regresión del flujo completo.
- **Estadísticas**: cada visita incrementa `PageView` del día (BA), y cada tap sobre un
  producto incrementa `ItemView` (mismo esquema, a nivel plato). Con `estadisticas` activo se ve en
  `UserStats` la serie de 30 días con auto-refresh en tiempo real más el ranking de
  "Productos más vistos" (top 10 de la misma ventana).
- **Import/export Excel** (permisos `menu_editor` y `carga_masiva_excel`): `getTemplate` genera el `.xlsx`;
  `previewMassive`/`confirmMassive` procesan la reimportación fila por fila y rechazan
  el archivo completo antes de mutar si las altas superan `features.item_limit`.
  Editar productos existentes sigue permitido aunque el total ya exceda un tope rebajado.
- **CRM interno** (solo CEO/admin): desde `/admin/crm` se gestiona a los locales
  suscriptos como clientes (etapa del pipeline — en vista lista o Kanban con drag &
  drop —, tags, seguimiento, notas). El historial mezcla notas manuales con eventos
  automáticos del sistema (`logCrmEvent`: cambios de plan vía webhook de MP,
  activar/desactivar cuenta, cambios de template). Los seguimientos vencidos se
  destacan con un banner en el CRM y un badge en el sidebar del panel
  (`/overdue-count`), y el listado se puede exportar a Excel (`/export`). Los datos
  viven en `CrmProfile`, aislados del modelo User para no filtrarse por ningún endpoint
  público; solo se acceden vía `/api/admin/crm` (protect + isAdmin).

### Estado operativo del flujo de suscripciones — 01-09-2026

- **Implementado y conectado en código**: recuperación del alta paga y sesión final;
  `PendingRegistration`, `PaymentCheckout`, `PaymentTransaction`, catálogo dinámico,
  consulta admin de pagos y referencias desde CRM/CEO. Vendedores/códigos también
  tienen modelos, rutas y UI conectados, pero el estado actual no es liberable.
- **Resultado actual**: backend 125 tests, 120 pasan y 5 fallan. Dos son de
  `editItem`; tres esperan la promoción histórica al cotizar. La corrección del
  Punto 1 recuperó las diez pruebas del webhook: el
  archivo específico del webhook en **44/44**. La vista/métricas de vendedores tiene
  **6/6**; no existe una prueba automatizada local específica del bonus.
- **Frontend actual**: typecheck, lint y build pasan después de restaurar localmente
  `lucide-react` con la versión ya fijada en package y lockfile, sin cambios
  rastreados de dependencias.
- **Hardening de ambiente**: el backend falla al arrancar si faltan variables críticas,
  exige firma de webhook y solo acredita pagos cuyo `live_mode` coincide con
  `MP_ENV`. En Koyeb deben quedar `NODE_ENV=production` y `MP_ENV=production`.
- **Compatibilidad**: preferencias anteriores a `PaymentCheckout` se auditan como
  `legacy`; no pueden degradar plan o vigencia, aunque no permiten demostrar el
  importe original porque ese snapshot todavía no existía.
- **Catálogo**: modelo, arranque, rutas, checkout, features y UI están integrados
  localmente, pero la nueva distinción entre precio de lista y promocional no está
  alineada entre todos los consumidores y rompió pruebas existentes.
- **PAY-05**: falta expiración explícita en upgrade/renovación y snapshot de esa
  fecha. Registro tiene siete días de checkout más tres días de margen del pending.
  No usar TTL para borrar la evidencia durable ni descartar un pago aprobado solo
  porque su webhook llegue tarde.
- **Pendiente de verificación productiva**: primero recuperar las suites; luego
  confirmar deploy Vercel/Koyeb y un pago real
  con comprador distinto del vendedor, verificando preferencia, metadata,
  `PaymentCheckout`, `PaymentTransaction`, webhook, cuenta/plan/vencimiento, CRM,
  redirección y sincronización del dashboard.
- **Pendiente operativo**: Pagos ya permite inspeccionar transacciones `not_applied`,
  pero no conciliarlas mediante acciones ni devolver dinero. Falta definir ese
  procedimiento y la política frente a reembolsos/contracargos.

## Verificación y documentación relacionada

- Frontend: `npm run typecheck`, `npm run lint`, `npm run build`.
- Backend: `npm test` (`node --test`). Los archivos de tests cubren admin, pagos admin,
  CRM, entorno, disponibilidad, edición de items, ofertas, rutas de pagos, webhook,
  credenciales pendientes, catálogo, slug y auth. Mocks no prueban Atlas, transacciones
  reales, configuración del proxy, Cloudinary ni Checkout Pro.
- Desarrollo: proxy `/api` en `vite.config.ts`; producción: rewrite de API y SPA en
  `vercel.json`. La aplicación mezcla URLs `/api` con `VITE_API_URL`; ambas deben
  apuntar al mismo backend. No imprimir secretos al diagnosticar.
- [README](README.md), [BLUEPRINT](BLUEPRINT.md) y
  [dev log backend](../../menu-digital-backend/DEVLOG-LUCAS.md).
