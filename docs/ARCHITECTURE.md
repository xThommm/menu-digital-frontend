# MenuDigital — Arquitectura de la aplicación
> **Revisión vigente — 26-09-2026:** delivery y take away. El local elige qué
> modalidades ofrece (`hasDelivery` y el nuevo `hasTakeAway`) y carga un mensaje de
> pedido por modalidad (`contactInfo.orderMessage` para delivery, el nuevo
> `contactInfo.takeAwayMessage` para take away). Con las dos activas, "Pedir por
> WhatsApp" pregunta cuál quiere el cliente antes de la sucursal (`WaTargetPicker`
> con `choices`), y el mensaje arranca con la modalidad (`🛵 *DELIVERY*` / `🥡 *TAKE
> AWAY*`). Los controles de agregar (simples y de variantes) exigen al menos una
> modalidad activa. Backend 547/547 y frontend 78/78 y typecheck en la rama
> `take-away`. No se desplegó ni se corrió un E2E real.
>
> **Revisión anterior — 25-09-2026:** se documentan los cambios del 22 al 25-09:
> orden del menú arrastrando (`order` en Menu/Item, `utils/menuOrder.js`,
> `Reorder/` del editor); cambios del editor (duplicar producto, plegar, lotes sobre
> secciones y categorías, eliminar con contenido); los no disponibles vuelven a la
> carta v2 con `available: false`; el estilo tonal; WhatsApp por sucursal
> (`whatsappNumbers`, `utils/phone.js`, `WaTargetPicker`); el chip del hero del
> dashboard; la confirmación de "Vaciar pedido" (`ClearCartDialog`); el favicon
> propio del local; los diseños premium Neobrutalismo y Maximalismo táctil
> (`premium_menu_styles`); y el horario de atención con turnos cortados
> (`schedule.<día>.ranges`). Backend 540/540 y frontend 74/74 (`node --test
> test/*.test.ts`) y typecheck en la rama `horario-cortado`. No se desplegó ni se
> corrió un E2E real.
>
> **Revisión anterior — 02-09-2026:** catálogo y gating siguen conectados. El nuevo
> módulo de vendedores y códigos está montado y su vista administra métricas y
> clientes atribuidos. `discountPrice` se aplica únicamente al alta paga con un
> `sellerID` validado y `editItem` ya persiste/valida sus tres flags. Backend pasa
> 135/135; frontend pasó typecheck, lint y build en la revisión previa. PAY-05 quedó
> implementado localmente; los bloqueos de seguridad detallados abajo y el E2E real
> siguen pendientes. Ver [README](README.md#verificaciones).
> No se consultó Atlas ni se desplegó, y tampoco se ejecutó un E2E real.


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
  `REQUIRED_ENV_VARS`: `NODE_ENV`, `MONGODB_URI`, `JWT_SECRET`,
  `PENDING_REGISTRATION_SECRET`, `ACCEPTED_TERMS_VERSION`, `FRONTEND_URL`, `MP_ENV`,
  `MP_ACCESS_TOKEN`, `MP_WEBHOOK_URL` y `MP_WEBHOOK_SECRET`. `SMTP_USER`/`SMTP_PASS` no
  son obligatorias al arrancar, pero sin ellas no salen los códigos por email
  (verificación, cambio de mail, baja y arrepentimiento).
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
**`getSubscriptionState(user)`** devuelve el estado que consumen los paneles (plan
guardado, plan efectivo, vencimiento, prueba). **`isTrialCurrentlyActive(user)`** es
la única fuente de "¿está en la prueba gratis ahora?": combina `trialActive` con
`subscriptionExpiresAt`, porque `trialActive` queda en `true` como marca histórica.

### `config/sellerCommission.js`

Tabla **fija** de comisiones de vendedores ("Estructura de Comisiones v6"),
desacoplada a propósito del catálogo de planes: si se calculara con el precio
vigente, subir un precio cambiaría lo que se le debe a un vendedor por ventas
pasadas. `MONTHLY_PRICE` (Basic 29.999, Pro 49.999), `MULTIPLIER` por duración
(1→1, 3→3, 6→5, 12→9, que también son los **puntos** de la venta) y `TIERS` por puntos
del ciclo: Base 25% (0+), Avanzado 30% (50+), PRO 35% (100+). Funciones
`contractPrice`, `pointsForMonths`, `tierForPoints` y `commissionForSale` (redondea a
centavos). Espejo exacto en `src/lib/sellerCommission.ts` del front: si cambia uno,
cambia el otro.

### `config/paymentPlans.js`

Semillas iniciales y helper de referencia para tests: Basic 29.999, Pro 49.999 ARS,
períodos 1/3/6/12 con multiplicadores 1/2.7/5/9. `getCheckoutExpiration()` centraliza
la ventana de siete días usada por todos los checkouts. Los importes runtime se
cotizan con `services/planCatalog.js` desde MongoDB, sin fallback.

### `config/cloudinary.js`
- Configura el SDK `cloudinary.v2` con las credenciales del `.env`.
- Define 3 `CloudinaryStorage` (storage engine propio, ver abajo) para carpetas
  `menu-digital/{users,menus,items}`, con `allowed_formats` y `transformation`
  (límite de ancho).
- `IMAGE_SIZE_LIMIT` = 8MB, aplicado a las 3 instancias de `multer`.
- Storages extra: `menu-digital/sellers` (foto de perfil de vendedores, `uploadSeller`)
  y una segunda sobre `menu-digital/items` para el Gestor de imágenes
  (`uploadItemLibrary`, arma el `public_id` con el id del usuario).
- `faviconStorage` (`menu-digital/favicons`): convierte a PNG de hasta 256 px, que
  conserva la transparencia del logo. `FAVICON_MAX_BYTES` = 1MB; el front repite
  ese número.
- Exporta `cloudinary`, `uploadUser`, `uploadMenu`, `uploadItem`, `uploadItemLibrary`,
  `uploadSeller`, `uploadFavicon` (middlewares multer), `fileFilter` y
  `FAVICON_MAX_BYTES`.

### `config/menuStyles.js`

Familias visuales de la carta y la landing (`User.menuStyle`), independientes de la
paleta (`template`): `classic`, `bistro`, `coffee`, `fast-food`, `grill`, `premium`,
`bakery` y, desde el 25-09-2026, los **diseños premium** `neo-brutalism`
(Neobrutalismo) y `tactile` (Maximalismo táctil).

- `LEGACY_MENU_STYLES` (`classic`, `bistro`) quedan abiertos a todos los planes, porque
  ya había cuentas gratuitas usándolos antes del gating. El resto son
  `VISUAL_FAMILIES` y piden la feature `menu_styles`.
- `PREMIUM_MENU_STYLES` piden su propia feature, `premium_menu_styles`, para poder
  abrir las familias comunes en otro plan sin regalar estas. Al lanzarlas son solo
  de Pro (semilla en `services/planCatalog.js`). Espejo en `src/lib/menuStyles.ts`
  del front.
- **`getMenuStyleFeature(value)`** — feature que habilita un diseño, o null si está
  abierto a todos.
- **`getMenuStyleForFeatures(value, features)`** — recorte de lectura: sin la feature,
  la API responde `classic`. El valor elegido sigue guardado, así que al renovar la
  carta recupera su diseño sin volver a elegirlo.

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
`hasDelivery` y `hasTakeAway` (modalidades del pedido por WhatsApp; default false),
`template` (nº, default 1), `contactInfo` (objeto: businessName, mail,
number, `whatsappNumbers`, location, address, social,
`reservationMessage`, `orderMessage` y `takeAwayMessage` — texto extra del pedido
con delivery y con take away, hasta 500 caracteres cada uno), `media` (pictures[], backgroundPicture, `favicon`), `acceptedTerms*` y
`schedule` (horario del local por día, distinto de la programación de cada producto).
`slug` tiene índice único sparse. `timestamps`,
hook de hasheo con bcrypt y método `matchPassword`. Además:

- **Vendedores:** `sellerID` es el vendedor o influencer que trajo la cuenta (el
  código usado en el alta); es la atribución de las ventas y nunca cambia.
  `influencerReferral` (inmutable) marca que el código era de un influencer.
  `assignedSeller`/`assignedSellerAt` es el vendedor que hace el seguimiento de un
  referido de influencer en el CRM (reparto automático al alta o reasignación
  manual); no participa de la atribución de ventas.
- **Alta y cuenta:** `emailVerified` (default `true` para que las cuentas anteriores
  queden verificadas; las altas nuevas lo ponen en `false` hasta confirmar el
  código), `trialActive` (marca histórica de que la cuenta nació con la prueba
  gratis de 7 días; se resetea al pagar un plan real) y `lastConnectionAt` (último
  `GET /users/me`).
- **Apariencia:** `menuStyle` (familia visual, ver `config/menuStyles.js`).
- **Gestor de imágenes:** `pendingMenuImages` (URLs de Cloudinary subidas y todavía
  sin asignar a ningún producto; al asignarse pasan a `Item.image`, nunca quedan en
  los dos lados) y `presetImagesUser` (marca a mano, a lo sumo un usuario: sus
  pendientes son el banco de **imágenes prediseñadas** y su menú es el **menú
  plantilla** que los demás pueden copiar).
- **`panelSettings`** (panel de Configuración): `password` propia del panel
  (`select:false`, distinta de la de login), `autoGenerateCodes`, `disableMenuDelete`,
  `deleteMenusWithContent`, `landingVisibility` (qué datos de contacto muestra la
  landing; todo `true` por defecto) y `menuDisplay` (`featuredSection`,
  `collapsibleCategories`, `hidePrices`; todo `false` por defecto porque cambian cómo
  se ve una carta en uso).

- **`contactInfo.number`** se guarda como código de área + número (10 dígitos, sin
  54/9/0/15; ver `utils/phone.js`).
- **`contactInfo.whatsappNumbers`** (25-09-2026, "WhatsApp multisucursal"): hasta 10
  `{ name, number }`, uno por sucursal, `number` con el mismo formato de 10 dígitos
  y `name` de hasta 40 caracteres. Vacío = pedidos y reservas usan `number`. Con más
  de uno el nombre es obligatorio (lo valida `editUser`), porque el cliente elige
  a cuál escribir.
- **`media.favicon`**: URL del logo que la landing y la carta usan como ícono de
  la pestaña. Vacío = favicon de Menú Digital.
- **`schedule`** tiene un objeto por día: `{ enabled, open, close, ranges }`. Sin
  `default`: si el dueño nunca lo cargó queda `undefined`. `ranges` (25-09-2026,
  "horario cortado") son los turnos del día, hasta 4 `{from,to}`. `open`/`close`
  copian el primero y son lo único que tienen los horarios guardados antes, que se
  leen como un único turno. Las reglas son las de la programación de productos:
  un cierre menor o igual a la apertura termina al día siguiente, horas iguales
  son 24 h y los turnos no pueden superponerse (lo valida
  `utils/businessSchedule.js`).
- **`panelSettings.deleteMenusWithContent`** (22-09-2026, default false) permite
  eliminar secciones y categorías con todo lo que tienen adentro.

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
El DTO público expone `effectivePrice` y los totales de catálogo con `price`.
`discountPrice` es el precio de las cuentas que llegaron con un código de vendedor
(`User.sellerID`): lo pagan en **cada** pago real (la conversión después de la prueba
gratis, upgrades y renovaciones), sea cual sea el plan. Desde el 09-09-2026 el código
ya no da descuento en el alta paga: da la prueba gratis de 7 días de Pro
(`registerTrial`).

### `models/Seller.js`

Vendedores e influencers. `name`, `dni` y `code` obligatorios y únicos; `password`
(bcrypt, `select:false`, min 8) y `mail` obligatorios; `number`, `profilePicture`,
`startDate` (ancla del ciclo mensual de comisión), `active` (baja lógica), `admin`,
`influencer`, `receivesLeads` y `crmAlertsSeenAt`; timestamps. El código tiene
formato `AAA-999` (lo genera el controller) y es a la vez el **usuario de login**:
`loginUser` detecta el guion y busca en `Seller` en vez de `User` (por eso los
usernames de locales no pueden tener guion). Un influencer no puede recibir leads
(lo valida el schema). `receivesLeads` lo incluye en el reparto de referidos de
influencers. `crmAlertsSeenAt` marca cuándo revisó sus alertas del CRM, para contar
"asignaciones nuevas" entre dispositivos. Método `matchPassword`.

### `models/SellerSale.js`

Snapshot **inmutable** de cada venta atribuida, tomado cuando el pago se aplica:
`paymentID` (único; evita duplicar si el webhook reintenta), `userID`, `sellerID`
(el `User.sellerID` de ese momento), `plan` (`basic/pro`), `amount`, `months`
(1/3/6/12), `subscriptionDate`, `refundedAmount` y `paymentStatus`. Índice
`{sellerID, subscriptionDate}`. La comisión **nunca se guarda**: se recalcula desde
`amount`/`plan`/`months` en cada panel, así un cambio de precios no reescribe lo ya
vendido.

### `models/LeadAssignmentState.js`

Contador compartido (`_id: "influencer-leads"`, `sequence`) del reparto round-robin
de referidos de influencers. El `$inc` atómico evita asignar el mismo turno a dos
altas simultáneas, aunque haya varias instancias del backend.

### `models/PendingServiceAction.js`

Código de confirmación de un solo uso (6 dígitos, se guarda solo el hash) para
acciones que necesitan probar que se controla un email: `baja` y `arrepentimiento`
(públicas, sin login), `verificacion_email` y `cambio_email` (autenticadas). Guarda
`email` (el real de la cuenta, o el nuevo en `cambio_email`), `paymentID` (solo
arrepentimiento), `attempts` (máximo 5), `consumed` y `expiresAt` (15 minutos, índice
TTL que borra el documento al vencer).

### `models/Menu.js`
Cada documento es una **sección o categoría** del menú de un local. Campos: `userID`
(ref User), `sectionID` (ref a otro Menu, para anidar categorías dentro de secciones;
null si no tiene), `code`, `title` (requerido), `description`, `image`, `section`
(bool: true = sección contenedora, false = categoría con items), `hidden`, `order`.
`timestamps`. `order` es la posición de una sección entre las del local, o de una
categoría dentro de su sección (o entre las que no tienen sección). No tiene
`default`: lo creado antes de este campo se ordena primero y por orden de creación,
así que no hizo falta migrar (ver `utils/menuOrder.js`). Ocultar una sección o
categoría oculta también su contenido en la carta.

### `models/Item.js`
Un **producto** del menú. Campos: `menuID` (ref Menu), `code`, `title` (requerido),
`description`, `price` (null = sin precio), `offerPrice`, `offerRange` (`{from,to}`
con fecha y hora de vigencia de la oferta), `options` (Map string→number, ej variantes de
tamaño), `image`, `available`, `availabilitySchedule` (programación semanal
`enabled` + hasta 4 rangos `{from,to}` por día), `isExtra`, `recommended`, `hidden`,
`order` (posición dentro de su categoría; mismo criterio que en `Menu`), `apt` (objeto
libre: alérgenos, calorías...). `timestamps`.
`price` admite null para productos sin precio y rechaza valores negativos en modelo
y controllers de creación/edición.

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
Datos de **CRM** de un cliente (un local suscripto), de uso interno del CEO y de los
vendedores. Vive en su propia colección — NO se mete en User — a propósito: así estos datos internos
nunca se filtran por los endpoints públicos de usuario. `userID` (ref User, único),
`stage` (enum del pipeline: `lead/onboarding/activo/en_riesgo/baja`), `tags [String]`,
`nextFollowUp` (Date), `notes` (subdocs `{text, kind, author, authorLabel, createdAt}`;
`authorLabel` guarda como texto el nombre de un vendedor, porque `author` solo puede
apuntar a `User`). `kind`
distingue notas manuales (`"note"`) de **eventos automáticos del sistema** (`"event"`:
cambio de plan, activar/desactivar cuenta, cambio de template — ver `utils/crmEvents.js`).
Exporta también `STAGES`.

### `models/PendingRegistration.js`
Alta paga todavía no convertida en `User`. Guarda temporalmente los datos de
registro, plan y período, junto con el hash de un token opaco de activación,
`sellerID` opcional y
el `preferenceId/initPoint` de MercadoPago y la referencia al `PaymentCheckout`.
Un retry reutiliza la preferencia si el checkout está `ready`, vigente, conserva una
ventana exacta de siete días, plan, período, versión, importe, moneda y los mismos
`preferenceId/initPoint`. Devuelve el enlace guardado sin actualizar MercadoPago.
Si alguna condición falla crea otro snapshot y marca el anterior `superseded`,
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
Incluye `planVersion` inmutable en nuevos checkouts (opcional para documentos legados)
y `preferenceStartsAt/preferenceExpiresAt` inmutables y obligatorios para documentos
nuevos. Los snapshots legacy sin esas fechas siguen siendo legibles y se reemplazan
si el usuario solicita otra preferencia. No tiene TTL de auditoría.

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
- **Vendedores.** El token de un vendedor lleva `role: "seller"` y `protect` no lo
  reconoce, así que un vendedor nunca entra a `/users`, `/menus`, `/items` ni `/admin`.
  Todos releen el `Seller` en cada request (nunca confían en un flag del token) y
  rechazan cuentas dadas de baja:
  - **`protectSeller`** — solo vendedores; carga `req.seller` sin `dni`.
  - **`protectSellerOrAdminAny`** — vendedor (`req.seller`) o admin (`req.user`); lo
    usan el CRM y el panel general.
  - **`protectSellerOrAdmin`** — admin, o el propio vendedor solo para su `:id`.
  - **`denyInfluencer`** — corta a los influencers, que solo acceden a su panel.

### `middleware/rateLimiters.js`

- **`authLimiter`** — 10 req / 15 min. Para login y registro (anti brute-force).
- **`apiLimiter`** — 300 req / 15 min. Red de contención general en toda la API.
- **`imageUploadLimiter`** — 100 subidas / 10 min **por usuario** (no por IP), para el
  Gestor de imágenes: cada subida cuesta en Cloudinary y Pro no tiene tope de
  productos que lo frene.

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
  contraseñas comunes (vive en `utils/validators.js`).
- **`sendEmailVerificationCode(user)`** — crea el código `verificacion_email` y lo
  manda al mail de la cuenta. Lo usan el alta gratuita, la prueba gratis y el webhook
  que completa un alta paga.
- **`getLandingVisibility`** + **`hideContactInfo`** / **`hideItemPrices`** — aplican
  `landingVisibility` (datos de contacto que no viajan a la landing) y
  `menuDisplay.hidePrices` (la carta y el PDF sin precios; el editor sí los recibe).

Endpoints:

- **`newUser`** `POST /api/users/register` — valida tipos (anti NoSQL injection),
  username sin guion, email y teléfono válidos, términos aceptados y fuerza de
  password; crea el user (slug desde businessName o username) con
  `emailVerified: false`, manda el código de verificación y devuelve token.
- **`registerTrial`** `POST /api/users/register-trial` — **prueba gratis de 7 días del
  plan Pro**. Exige un código de vendedor válido y activo (`AAA-999`), que es lo único
  que la habilita. Crea el `User` definitivo sin pasar por MercadoPago, con
  `subscription: "pro"`, vencimiento a 7 días, `trialActive`, `sellerID` y
  `emailVerified: false`. Rechaza con 409 si el username **o el email** ya existen,
  porque reparte un recurso real. Si el código es de un influencer, marca
  `influencerReferral` y asigna el seguimiento con `nextLeadSeller()`.
- **`loginUser`** `POST /api/users/login` — valida credenciales, compara con bcrypt y
  devuelve la sesión completa (`slug`, plan/vencimiento y token), incluida la vía de
  recuperación manual después de un alta paga. Si el usuario tiene guion lo busca
  como **vendedor** por `Seller.code` y devuelve una sesión con `role: "seller"`,
  `influencer` y `profilePicture` (403 si está dado de baja).
- **`verifyEmail`** `POST /api/users/me/verify-email` y **`resendVerificationCode`**
  `POST /api/users/me/verify-email/resend` — confirman o reenvían el código de 6
  dígitos (vence a los 15 minutos; reenviar invalida el anterior). No bloquean el
  login: el front redirige a `/verificar-email` mientras `emailVerified` sea `false`.
- **`requestEmailChange`** `POST /api/users/me/email-change` y **`confirmEmailChange`**
  `POST /api/users/me/email-change/confirm` — el mail de contacto se cambia en dos
  pasos: primero se manda un código al mail **nuevo** y recién al confirmarlo se
  escribe `contactInfo.mail`. `editUser` rechaza cambiar el mail directamente.
- **`getAuthUser`** `GET /api/users/me` — datos del user autenticado + `itemCount` y
  `categoryCount`, `features` efectivas y template permitido (lo usa Mi negocio).
  Actualiza `lastConnectionAt`.
- **`getAuthUserSummary`** `GET /api/users/me/summary` — versión liviana de `/me` para
  el dashboard, que solo necesita unos pocos campos (entre ellos `hasDelivery` y
  `hasTakeAway`).
- **Configuración del panel** — `GET /api/users/me/settings` (si ya hay contraseña del
  panel y el valor de los toggles), `POST /me/settings/verify-password` (la crea la
  primera vez o la verifica), `PATCH /me/settings/password` (cambiarla, pide la
  actual) y `PATCH /me/settings` (guardar toggles sin volver a pedirla).
- **`fetchUserWithMenu`** `GET /api/users/:slug/menu` — carta **pública** por slug:
  arma el menú agrupado (secciones→categorías→items) y dispara `trackView`. Es lo que
  renderiza la carta pública. Tiene **dos contratos**, elegidos por el query `v`:
  - **v2 (`?v=2`)** — el que pide el front actual: la carta liviana, solo lo que se
    muestra. `user` trae `contactInfo` recortado por whitelist (`businessName`, `number`,
    `whatsappNumbers`, `address`, `orderMessage`, `takeAwayMessage`, sin las claves
    vacías; sin mail, redes, ubicación ni mensaje de reserva), `media` con
    `backgroundPicture`, `favicon` y **solo la primera** imagen de `pictures`,
    `hasDelivery`, `hasTakeAway` (siempre booleano), `template` y `menuStyle`
    ya recortados por plan,
    `features` con tres booleanos explícitos (`sin_publicidad`, `landing_page`,
    `pedido_whatsapp`) y `menuDisplay`; sin `_id`, `subscription` ni `schedule`.
    `menu` es `{ secciones: [{ title, categorias: [{ title, items }] }], sinSeccion:
    [{ title, items }] }`, sin `_id`, `description`, `image` ni `code` en secciones y
    categorías. El orden del JSON ya es el de la carta: secciones, categorías e items
    salen ordenados por `order` y después por `_id` (`MENU_ORDER_SORT`, ver
    `utils/menuOrder.js`). Cada item lleva `_id` (vistas
    por plato y carrito) y `title`, más `price`, `offerPrice`, `description`, `image`,
    `options`, `recommended` y `apt` **solo si tienen valor**; nunca `hidden`, `menuID`,
    `code`, `isExtra`, `offerRange`, `offerSchedule` ni `availabilitySchedule`.
    - **Los productos no disponibles viajan con `available: false`** (desde el
      22-09-2026). Son los que tienen el interruptor manual `available` apagado y, con
      `programacion_productos`, los que están fuera de su programación semanal en
      horario de Buenos Aires (el `now` se calcula una vez por request). La carta los
      muestra como "No disponible" y sin controles de pedido. Los disponibles **no
      llevan la clave**, así que en el front hay que preguntar con `isItemUnavailable()`
      (`lib/publicMenu.ts`), no con `!item.available`. Solo `hidden` saca un producto
      de la carta. Las categorías que quedan sin productos y las secciones sin
      categorías se podan (como ya hace el PDF).
    - **Las ofertas vienen resueltas por el backend.** `offerPrice` se manda solo si la
      oferta rige ahora (misma lógica que `getPublicItemForPlan`: sin
      `programacion_productos` una oferta con rango u horario se ignora) y siempre junto
      con `price`; el rango y el horario no viajan, así que el cliente muestra precio
      normal + `offerPrice` sin recalcular nada.
    - Con `menuDisplay.hidePrices` no viajan `price` ni `offerPrice`, y `options`
      conserva los **nombres** de las variantes con valor `0` (el pedido por variante
      depende de ellos).
  - **Legacy (sin `?v=2`)** — sigue vigente **por compatibilidad** y responde exactamente
    igual que antes (items completos con `available`, `offerRange`/`offerSchedule` y
    `_id` de categorías; filtra ocultos y combina `available` con la programación, pero
    el item fuera de horario o agotado permanece visible con `available: false`). Lo
    usan los bundles viejos del frontend: back y front se despliegan por separado y en
    cualquier orden, así que un front nuevo puede toparse con un back que ignora `?v=2`
    (y responde legacy) y un front viejo con un back nuevo. Se retira recién cuando no
    queden clientes sin `?v=2`.
- **`fetchOwnMenu`** `GET /api/users/me/menu` — menú del dueño autenticado, **sin**
  filtrar ocultos (para gestionarlos en el editor) y en el mismo orden que la carta,
  más un objeto `limits`
  (`itemCount`, `itemLimit`, `canEditMenu`, `canImportExcel`, `canExportPdf`, `canScheduleItems`,
  `canScheduleOffers`, `canUseImageManager`, `canUseTemplates`, `canReorder`, `canBulkMenus`,
  `autoGenerateCodes`, `disableMenuDelete`, `deleteMenusWithContent`) para la UI de gating.
  `canReorder` y `canBulkMenus` además avisan que el backend soporta esas funciones:
  un front nuevo contra un backend anterior no las recibe y oculta las manijas de
  arrastre y la selección de secciones y categorías, así que el orden de despliegue
  da igual.
- **`fetchStats`** `GET /api/users/me/stats?days=7|30` (permiso `estadisticas`) — con
  `days`, devuelve la ventana de días completos (`days`), la ventana anterior de igual
  duración para comparar (`previousDays`, `previousTotalViews`), las visitas de hoy
  por separado (`todayViews`) y `observedFrom`/`comparisonAvailable` (el día del alta
  es parcial y lo anterior no cuenta como cero). Lo arma `utils/statsPeriod.js`.
  Sin `days` responde el formato anterior (`totalViews` + `last30Days`) para clientes
  viejos. Fechas en horario de Buenos Aires.
- **`trackItemViewEndpoint`** `POST /api/users/:slug/menu/items/:itemID/view` (público) —
  registra que se tocó un producto de la carta. Resuelve el dueño desde el **slug** (no
  confía en un userID del cliente) y valida que el item sea realmente de ese local antes
  de contarlo. Responde siempre `204` (fire-and-forget, nunca rompe la experiencia).
- **`fetchItemStats`** `GET /api/users/me/item-stats?days=7|30` (permiso `estadisticas`) — top 10 de productos
  más vistos en la ventana pedida (30 días por defecto; agregación sobre `ItemView` + join contra `Item`
  para título/imagen; un producto borrado se muestra como "(producto eliminado)").
- **`fetchUser`** `GET /api/users/:slug` — datos públicos de un local activo
  (landing por slug), si `landing_page` está activa. Devuelve features y usa el template permitido
  por el plan efectivo; la publicidad sigue `features.sin_publicidad`. Respeta
  `landingVisibility`: ocultar `whatsappReserve` saca `whatsappNumbers`, y `number`
  deja de viajar solo si ya no lo usa nadie (teléfono oculto y reservas ocultas o
  resueltas con `whatsappNumbers`). `schedule` viaja con `ranges` si está visible.
- **`downloadMenuPdf`** `GET /api/users/:slug/menu/pdf` — genera el menú imprimible,
  requiere `features.menu_pdf` aunque la URL sea pública. Excluye productos
  manualmente pausados; además aplica el horario si `programacion_productos` está activa.
- **`editUser`** `PUT /api/users/me` — edita
  `contactInfo/hasDelivery/hasTakeAway/media/schedule` (whitelist; `template` va por
  `useTemplate`). Preserva los campos vigentes de contacto omitidos en ediciones
  parciales. `orderMessage` y `takeAwayMessage` se validan igual (string, recortado,
  hasta 500 caracteres; 400 con su propio mensaje), solo si llegan en la edición. Normaliza `number` con `toStoredPhone` y
  valida `whatsappNumbers` con `parseWhatsappNumbers` (hasta 10, número argentino
  válido, nombre obligatorio si hay más de uno). El horario pasa por
  `normalizeBusinessSchedule` (`utils/businessSchedule.js`), que devuelve 400 con el
  motivo si no es válido.
- **`uploadImage`** / **`uploadBackground`** — suben foto a la galería / de fondo del
  local (a Cloudinary).
- **`removeImage`** / **`deleteBackground`** — sacan una foto de la galería / el fondo.
- **`uploadFavicon`** `POST /api/users/upload-favicon` / **`deleteFavicon`**
  `DELETE /api/users/favicon` — suben o quitan el logo del favicon (`media.favicon`).
  La subida va por `uploadFavicon` de `config/cloudinary.js`: máximo 1 MB, se guarda
  como PNG de hasta 256 px en `menu-digital/favicons`. `acceptFavicon`, en la ruta,
  devuelve 400 con un mensaje claro si el archivo pesa de más o no es imagen. Quitar
  solo borra la referencia; el archivo queda en Cloudinary.
- **`useTemplate`** `PATCH /api/users/template` — cambia el template (paleta) y,
  opcionalmente, `menuStyle` (familia visual de la carta y la landing). Valida contra
  `TEMPLATE_IDS` y `features.templateIds` del catálogo. **Barrera real** del gating de
  templates y diseños: si el diseño pide una feature que el plan no tiene
  (`getMenuStyleFeature`) responde 403 con esa `feature` ("Tu plan no incluye los
  diseños premium" / "...las familias visuales"). Si el template o el diseño
  realmente cambiaron, loguea un evento de CRM (`logCrmEvent`).
- **`setActive`** `PATCH /api/users/active` — el dueño activa/desactiva su propia cuenta.

### `controllers/menuController.js`

- **`verifyOwnership(menuID, userID)`** — helper: 404 si no existe, 403 si el menú no es
  del user.
- **`newMenu`** `POST /api/menus` — crea sección/categoría (code único por usuario);
  marca `User.menu = true`. Con `panelSettings.autoGenerateCodes` y el código en
  blanco, lo genera `utils/autoCode.js` (igual que `newItem` y `duplicateItem`).
- Con `panelSettings.disableMenuDelete`, los borrados de secciones, categorías y
  productos (sueltos o en lote) responden 403.
- **`editMenu`** `PUT /api/menus/:menuID` — edita `title/description/code` (whitelist),
  revalida unicidad de code.
- **`moveMenu`** `PATCH /api/menus/:menuID/move` — mueve una categoría a otra sección (o
  la saca, `sectionID:null`) y la deja al final de la nueva.
- **`reorderMenus`** `PATCH /api/menus/reorder` — ordena arrastrando en el editor. Acepta
  `{ sectionIds }` (todas las secciones del local en el nuevo orden) o
  `{ sectionID, categoryIds }` (las categorías de esa sección; `sectionID: null` son
  las que no tienen sección). Una categoría que viene de otra sección se mueve a
  esta. Mismo criterio que `reorderItems`: lo que falta en la lista queda al final, y
  es todo o nada.
- **`hideMenu`** `PATCH /api/menus/:menuID/hidden` — oculta/muestra sin borrar. Ocultar
  una sección o categoría oculta también su contenido en la carta.
- **`deleteMenu`** `DELETE /api/menus/:menuID` — por defecto elimina **solo si está
  vacía** (sección sin categorías / categoría sin items). Con
  `panelSettings.deleteMenusWithContent` borra también todo lo que tiene adentro
  (`deleteMenusCascade`): las imágenes de los productos borrados vuelven a las
  pendientes del usuario.
- **`setMenusHiddenBulk`** `PATCH /api/menus/bulk/hidden` y **`deleteMenusBulk`**
  `POST /api/menus/bulk/delete` — lo mismo sobre varias secciones y categorías a la
  vez (selección múltiple del editor). Mismo tope y criterio que los lotes de
  productos. Sin `deleteMenusWithContent`, una sección se borra solo si todas sus
  categorías vienen en el lote y están vacías; si alguna no cumple, no se borra nada.
- **`uploadImage`** `POST /api/menus/:menuID/upload-image` — foto de la categoría.

### `controllers/itemController.js`

- **`verifyMenuOwnership(menuID, userID)`** — igual patrón que arriba.
- **`newItem`** `POST /api/items` — crea producto; consulta `features.item_limit`
  (`null` significa ilimitado) y exige `programacion_productos` para ofertas o
  disponibilidad programadas. Valida horarios/solapamientos y la unicidad de `code`
  **por usuario** (no global); los permisos no dependen del nombre del plan.
- **`editItem`** `PUT /api/items/:itemID` — edita campos de contenido (whitelist);
  unicidad de code por usuario solo si cambia. La whitelist incluye `available`,
  `hidden` y `recommended`, exige booleanos y los persiste en el mismo guardado del
  formulario. Los PATCH específicos se mantienen para los toggles aislados.
- **`moveItem`** `PATCH /api/items/:itemID/move` — mueve el item a otra categoría
  (verifica ownership de origen y destino) y lo deja al final de esa categoría.
- **`reorderItems`** `PATCH /api/items/reorder` — ordena los productos de una
  categoría arrastrando en el editor. `itemIds` es la categoría entera en el nuevo
  orden. Un id que hoy está en otra categoría del mismo usuario se mueve a esta, así
  que un solo pedido cubre ordenar y mover. Lo que ya estaba y no vino en la lista
  (algo creado desde otra pestaña) queda al final. Es todo o nada y no distingue
  "no existe" de "es de otro usuario".
- **`duplicateItem`** `POST /api/items/:itemID/duplicate` — la copia queda justo debajo
  del original, con el nombre "Copia de ..." y el código del original + `-COPIA`
  (`-COPIA2`, `-COPIA3`...; `buildCopyCode`). Respeta `item_limit` como `newItem`.
  Comparte la URL de la imagen: borrar uno de los dos no la recicla mientras el
  otro la use.
- **Acciones en lote** (selección múltiple del editor, hasta `MAX_BULK_ITEMS` = 200 ids
  por pedido): `PATCH /api/items/bulk/available`, `PATCH /api/items/bulk/hidden` y
  `POST /api/items/bulk/delete` (POST porque el lote viaja en el body). A diferencia
  de los lotes de secciones y categorías, **no son todo o nada**: los ids que no
  existen o no son del usuario se ignoran y vuelven en `failedIds`.
- **`uploadImage`** `POST /api/items/:itemID/upload-image` — foto del producto.
- **`uploadDraftImage`** `POST /api/items/upload-image` — sube la imagen de un producto
  que todavía no se creó. Reemplazó a la subida directa desde el navegador con un
  preset sin firmar, que dejaba una puerta de subida abierta sin autenticación.
- **Gestor de imágenes** (feature `image_manager`):
  - `GET /api/items/lite` (**`getLiteItems`**) — productos con solo nombre, código e
    imagen, para el buscador del gestor.
  - `GET /api/items/images/pending` (**`getPendingImages`**) — las pendientes del
    usuario (`pendingMenuImages`), sin prediseñadas ajenas.
  - `GET /api/items/images/presets` (**`getPresetImages`**) — el banco de imágenes
    prediseñadas (las pendientes del usuario con `presetImagesUser`).
  - `POST /api/items/images/upload` (**`uploadLibraryImage`**) — sube a Cloudinary sin
    asignar. Antes pasa por `imageUploadLimiter` y **`checkImageQuota`**, que corta
    antes de gastar la subida si se alcanzó el tope: `item_limit` en Free/Basic, y en
    Pro la cantidad de productos ya creados. Un update atómico cierra la carrera
    entre dos subidas simultáneas. Las prediseñadas asignadas no ocupan cupo.
  - `POST /api/items/images/assign` (**`assignImages`**) — guarda de una vez los
    cambios imagen → producto(s) (`{ changes: [{ imageUrl, itemIDs }] }`). Recalcula
    en el servidor quién tiene cada imagen hoy para no pisar cambios de otra pestaña.
    Asignar una prediseñada no la saca del banco.
  - `DELETE /api/items/images` (**`deleteLibraryImage`**) — borra la imagen de
    Cloudinary, de los productos que la tenían y de las pendientes. Las prediseñadas
    no se pueden borrar desde otra cuenta.
- **`setHidden`** / **`setAvailable`** — togglean visibilidad / disponibilidad.
- **`deleteItem`** `DELETE /api/items/:itemID` — elimina el producto. Su imagen vuelve
  a las pendientes del usuario (`recycleDeletedItemImages`), salvo que sea una
  prediseñada ajena o que otro producto la siga usando.

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
  usa tanto para **exportar** como para editar y reimportar. Las filas salen en el
  orden de la carta (`flattenMenusInOrder` + `sortByMenuOrder`).
- **`parseExcel(buffer)`** — parsea las hojas Categorías/Productos del Excel subido a
  arrays de filas.
- **`parseDate(val)`** — parsea `DD/MM/AAAA` a `Date` o null.
- **`previewMassive`** `POST /api/massive/preview` — procesa el Excel y devuelve el
  **resumen** de cambios (a crear / actualizar / errores) sin guardar nada.
- **`confirmMassive`** `POST /api/massive/confirm` — aplica los cambios fila por fila
  (categorías primero, después productos) e informa qué se creó/actualizó/falló. Lo que
  se crea, o cambia de sección o categoría, va al final de su contenedor, en el orden
  de las filas (`createOrderAllocator`). Las plantillas de menú
  (`menuTemplateController`) copian con el mismo criterio y en el orden de la
  plantilla.

### `controllers/crmController.js` (CRM — admin y vendedores)

Montado en `/api/sellers/crm` (ya no en `/api/admin/crm`). Todas las rutas pasan por
`protectSellerOrAdminAny` + `denyInfluencer`: un admin (`req.user`) ve todos los
clientes; un vendedor (`req.seller`) ve solo los suyos (`scopedUserMatch`: los que
trajo, `sellerID`, o los que tiene asignados, `assignedSeller`). Un cliente de otro
vendedor responde 404, para no confirmar que existe. Helpers `defaultProfile()`,
`isValidId()`, `buildOnboardingStatus`, `STAGE_LABEL`/`PLAN_LABEL` (Excel).

- **`buildClientsWithAttention`** — arma la vista 360 que comparten `listClients` y
  `getCrmSummary`: usuarios, perfiles, menús, productos, pagos, visitas (60 días,
  para comparar los últimos 30 contra los 30 previos) y vendedores, todo en consultas
  agrupadas, sin una por cliente. Cada cliente lleva sus códigos de `attention`:
  `payment_issue`, `subscription_expired`, `subscription_expiring` (30 días),
  `subscription_missing_expiry`, `follow_up_overdue`, `onboarding_incomplete` y
  `no_traffic` (paga, tiene la carta publicada y nadie la miró en 30 días).
  `summarizeAttention` los cuenta.
- **`listClients`** `GET /api/sellers/crm/clients` — la lista 360 con etapa, tags,
  seguimiento, plan/vencimiento, onboarding, último pago, tráfico, vendedor de
  origen y responsable, más `attentionSummary`.
- **`getClient`** `GET /api/sellers/crm/clients/:userID` — detalle con un DTO acotado
  (no el `User` completo): datos del local, perfil de CRM (o el default), onboarding,
  actividad, vendedor de origen y responsable. Rechaza IDs inválidos y cuentas admin.
- **`updateProfile`** `PATCH /.../clients/:userID` — etapa, tags, `nextFollowUp` y, solo
  para referidos de influencers, `assignedSeller` (tiene que ser un vendedor activo,
  no influencer, que reciba leads; o `null`). Crea el perfil si no existía.
- **`addNote`** `POST /.../clients/:userID/notes` — autor: el admin (`author`) o el
  nombre del vendedor (`authorLabel`).
- **`deleteNote`** `DELETE /.../clients/:userID/notes/:noteID` — elimina un subdocumento
  por ID. La UI oculta el borrado de eventos, pero el endpoint no filtra `kind`; no
  describir los eventos como inmutables a nivel servidor.
- **`getOverdueCount`** `GET /api/sellers/crm/overdue-count` — seguimientos vencidos
  (anteriores al día actual de Buenos Aires) y `newAssignments` (leads asignados al
  vendedor desde su último `crmAlertsSeenAt`; siempre 0 para un admin). Liviano, para
  el badge del sidebar.
- **`markAlertsSeen`** `POST /api/sellers/crm/alerts/seen` — el vendedor marcó sus
  alertas como vistas (resetea `newAssignments`).
- **`getCrmSummary`** `GET /api/sellers/crm/summary` (solo admin) — resumen del
  dashboard del CEO: totales, altas del mes (`startOfMonthBA`), clientes por plan, los
  5 más recientes y el mismo `attentionSummary`, sin mandar la lista completa.
- **`exportClients`** `GET /api/sellers/crm/export?stage=` (solo admin) — exporta el
  listado (opcionalmente filtrado por etapa) a `.xlsx` con ExcelJS.

El CRM conserva el plan almacenado y su vencimiento; no equivale al plan efectivo que
expone la API del dueño.

### `controllers/sellerController.js` (ABM de vendedores — `/api/admin/sellers`)

Solo los datos del equipo; comisiones y métricas viven en el panel de vendedores.
`sellerToDTO` devuelve nombre, mail, teléfono, `startDate`, DNI, código, `active`,
`admin`, `influencer`, `receivesLeads`, foto y timestamps (nunca la contraseña).

- **`getSellers`** `GET /` (admin) — el equipo vigente; `?includeInactive=true` suma
  los dados de baja.
- **`getSellerById`** `GET /:id` — admin, o el propio vendedor (`protectSellerOrAdmin`).
- **`createSeller`** `POST /` (admin) — genera el código `AAA-999` (reintenta si
  colisiona) y exige contraseña de 8+ caracteres. Un influencer no puede recibir leads.
- **`updateSeller`** `PUT /:id` (admin) — datos, rol (influencer), reparto de leads,
  `startDate` y estado.
- **`deleteSeller`** `DELETE /:id` (admin) — **baja lógica** (`active: false`): el
  vendedor no puede iniciar sesión, pero su historial sigue resolviendo nombre y
  código en el ranking y los paneles.
- **`resetSellerPassword`** `PATCH /:id/password` (admin) — sin pedir la actual.

### `controllers/sellerPanelController.js` (panel de vendedores — `/api/sellers`)

- **`getMyProfile`** `GET /me`, **`changeMyPassword`** `PATCH /me/password` (pide la
  actual) y **`uploadMyPhoto`** `POST /me/photo` — autoservicio del vendedor
  (`protectSeller`).
- **`getOverview`** `GET /overview` — panel general: clientes vendidos (totales y del
  ciclo actual) y comisión del ciclo. Un vendedor ve lo propio; un admin ve a todos o
  a uno con `?sellerID=`. La **facturación real solo la ve el admin**: `stripRevenue`
  la saca del payload en el servidor. Los influencers no entran (`denyInfluencer`).
- **`getSellersRanking`** `GET /ranking?period=current|previous|historic` (admin) —
  comisión y puntos por vendedor, separados por plan.
- **`getMyInfluencerOverview`** `GET /influencer/overview` — panel del influencer:
  sus referidos y su comisión.

### `controllers/menuTemplateController.js` (plantillas de menú — `/api/menu-templates`)

Feature `menu_templates` (Basic y Pro). El menú del usuario con `presetImagesUser`
(`getPresetMenuOwner`) es el **menú plantilla**: se carga a mano como cualquier menú.

- **`getMenuTemplates`** `GET /` — el catálogo de solo lectura, armado como
  `fetchOwnMenu` y en el orden de la plantilla. Excluye los productos cuyo código ya
  existe en el menú de quien consulta (ya importados) y las categorías o secciones sin
  nada pendiente. Sin banco configurado devuelve un menú vacío.
- **`copyMenuTemplates`** `POST /copy` — copia secciones y categorías enteras y/o
  productos sueltos (hasta `MAX_TEMPLATE_SELECTION` = 300) como contenido propio e
  independiente. Un producto suelto se copia dentro de una copia de su categoría. Las
  copias conservan el código de la plantilla para reconocer lo ya importado: una
  categoría o sección con ese código se reutiliza y un producto repetido se omite.
  Respeta `item_limit`, y sin `programacion_productos` no copia ofertas ni
  programación.

### `controllers/sitemapController.js`

**`getSitemap`** (`GET /sitemap.xml`, montado directo en `app.js`) — sitemap XML con las
páginas propias (landing, blog, legales) y, por cada local activo, su landing (si el
plan incluye `landing_page`) y su carta (solo si tiene contenido público), con
`lastmod`.

### `controllers/planController.js`

`listPlans` devuelve catálogo con `Cache-Control: no-store`. `updatePlan` exige
precio, promoción, nombre visible, descripción, objeto `features` completo y
`version`; valida tipos/campos y atribuye el cambio al admin. Devuelve 409 ante
versión vieja o carrera. Los routers están montados, con `protect + isAdmin`.
Free permite editar beneficios pero conserva precio cero. Acepta un objeto opcional
`periodMultipliers` con los cuatro factores; omitirlo conserva el mapa anterior.
Valida tipos numéricos, claves exactas, el mes base en 1 y totales pagos positivos.
No edita IDs ni agrega períodos. **`getPlanUsage`** `GET /api/admin/plans/usage` devuelve
por plan cuántas cuentas hay (y cuántas activas), cuántos pagos y cuánto se facturó
en 30 días y en total, para no editar precios a ciegas.

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
  Al aplicar un pago también guarda el **`SellerSale`** de la venta
  (`recordSaleFromTransaction`, con la atribución congelada en la transacción). Si
  ese paso falla, el siguiente webhook lo reconstruye sin volver a tocar la
  suscripción. Un pago real pone `trialActive` en `false`. Al completar un alta paga
  manda el código de verificación de email.
- **Derecho de arrepentimiento** (Ley 24.240 + Disp. 954/2025) y **baja del servicio**
  (Art. 10 ter): públicos y sin login, porque rescindir tiene que ser tan fácil como
  contratar. Como un email o un usuario tipeados no prueban identidad, cada flujo
  tiene dos pasos y el primero nunca ejecuta nada:
  - **`solicitarArrepentimiento`** `POST /api/payments/arrepentimiento` — busca la compra
    aprobada por número de operación de MercadoPago, email o usuario, controla el
    plazo de **10 días corridos** desde la aprobación y manda un código al email
    **real** de la cuenta. **`confirmarArrepentimiento`** `POST .../arrepentimiento/confirmar`
    — con el código, pide el **reembolso** a MercadoPago y baja el plan.
  - **`solicitarBaja`** `POST /api/payments/baja` — busca la cuenta paga por email o
    usuario y manda el código. **`confirmarBaja`** `POST .../baja/confirmar` — baja el
    plan a Free, **sin reembolso**.
  - Los mensajes de "no encontramos" son genéricos para no revelar si una cuenta
    existe. Pasan por `authLimiter` y usan `utils/serviceActionCodes.js`.

  **Correcciones del 01-09-2026:** se retiraron de
  `applyExistingUserEntitlement` las referencias fuera de alcance a `pending` y
  `paidMonths`; las ramas existentes vuelven a calcular recuperación, renovación o
  upgrade con `months`. Además, un alta con `sellerID` crea el usuario atribuido y
  suma los siete días de vendedor. Ambas rutas tienen cobertura automatizada local;
  la suite backend completa pasa 135/135, sin equivaler a un E2E real.


## routes/

Cada archivo define un `express.Router` y ata rutas → middlewares → controllers.

- **`routes/userRoutes.js`** — `/register` y `/login` (con `authLimiter`); rutas privadas
  `/me`, `/me/menu`, `/me/stats` y `/me/item-stats` (ambas `requireFeature("estadisticas")`), `PUT /me`,
  uploads (incluido `POST /upload-favicon` con `acceptFavicon` y `DELETE /favicon`),
  `/template`, `/active`, `/me/settings*`; y al final las públicas por slug
  `POST /:slug/menu/items/:itemID/view` (tracking por plato), `/:slug/menu` y `/:slug`
  (van últimas para no interceptar las rutas fijas).
- **`routes/menuRoutes.js`** — CRUD de menús más `PATCH /reorder`, `PATCH /bulk/hidden` y
  `POST /bulk/delete` (todas `protect` + `requireFeature("menu_editor")`). Las rutas
  fijas van antes de `/:menuID` para que "reorder" o "bulk" no se lean como un id.
- **`routes/itemRoutes.js`** — CRUD de items más `PATCH /reorder`, `/bulk/*` y
  `POST /:itemID/duplicate` (todas `protect` + `requireFeature("menu_editor")`); las del
  Gestor de imágenes piden `image_manager`.
- **`routes/adminRoutes.js`** — rutas admin (todas `protect + isAdmin`).
- **`routes/adminPaymentRoutes.js`** — `GET /` bajo `/api/admin/payments`, protegido
  por `protect + isAdmin`, montado antes del router admin genérico.
- **`routes/planRoutes.js`** / **`routes/adminPlanRoutes.js`** — lectura pública y
  lectura/edición admin montadas en `/api/plans` y `/api/admin/plans` (suma
  `GET /usage`).
- **`routes/sellerRoutes.js`** — ABM bajo `/api/admin/sellers`: todo `protect + isAdmin`
  salvo `GET /:id`, que también acepta al propio vendedor (`protectSellerOrAdmin`).
  Incluye `PATCH /:id/password`. La validación pública del código vive inline en
  `paymentRoutes.js`.
- **`routes/sellerPanelRoutes.js`** — panel de vendedores bajo `/api/sellers`:
  `GET /me`, `PATCH /me/password`, `POST /me/photo` y `GET /influencer/overview`
  (`protectSeller`); `GET /overview` (`protectSellerOrAdminAny` + `denyInfluencer`) y
  `GET /ranking` (`protect + isAdmin`).
- **`routes/menuTemplateRoutes.js`** — `GET /` y `POST /copy` bajo `/api/menu-templates`,
  con `protect + requireFeature("menu_templates")`.
- `GET /sitemap.xml` se monta directo en `app.js` (`sitemapController`).
- **`routes/massiveRoutes.js`** — `template/preview/confirm`, todas gateadas con
  `requireFeature("menu_editor")` y `requireFeature("carga_masiva_excel")`; multer en memoria con límite de 5MB.
- **`routes/crmRoutes.js`** — CRM bajo `/api/sellers/crm` (montado en app.js ANTES de
  `/api/sellers` para que su prefijo matchee primero). Todas pasan por
  `protectSellerOrAdminAny + denyInfluencer`: `GET /overdue-count`, `POST /alerts/seen`,
  `GET /summary` y `GET /export` (estos dos solo admin; de nombre fijo, van antes del
  param), `GET /clients`, `GET /clients/:userID`, `PATCH /clients/:userID`,
  `POST /clients/:userID/notes`, `DELETE /clients/:userID/notes/:noteID`.
- **`routes/paymentRoutes.js`** — usa la configuración central de precios y períodos.
  `POST /validate-seller-code` valida públicamente el formato y existencia del código;
  `POST /crear-preferencia-registro` crea o recupera el alta pendiente y persiste el
  snapshot de checkout, siempre a precio regular: si viene un código de vendedor
  responde 400 y lo manda a la prueba gratis (`/users/register-trial`). Rechaza con
  409 un username **o email** ya registrado. Reutiliza una preferencia `ready` únicamente si coinciden selección,
  versión, importe, moneda, enlaces y la ventana inmutable sigue vigente; devuelve
  `init_point` + token opaco sin llamar otra vez a MP. Checkouts vencidos, legacy o
  inconsistentes se reemplazan y el anterior queda `superseded`;
  `POST /registro/estado` permite esperar al webhook;
  `POST /crear-preferencia` (autenticado) valida plan/período, impide downgrades,
  crea el snapshot server-side y luego la preferencia de upgrade/renovación (con
  `discountPrice` si la cuenta tiene `sellerID`);
  `POST /webhook` crea la cuenta o acredita el cambio/renovación con vencimiento;
  `POST /arrepentimiento(/confirmar)` y `POST /baja(/confirmar)` (con `authLimiter`)
  llaman a los controllers de arrepentimiento y baja.
  Crea clientes del SDK e idempotency keys por operación, comprueba que MP devuelva
  id/init point y persiste el estado `ready` antes de redirigir. Registro, upgrade y
  renovación envían `expires`, `expiration_date_from`, `expiration_date_to` y
  `date_of_expiration` usando exactamente las fechas persistidas. El webhook no
  rechaza un pago aprobado por vencimiento o por estado `superseded`.
  Las rutas inline de pagos tienen respuestas `{error}` y manejo propio; no todas
  las respuestas de la API usan el formato `{message}` de los controllers. El alta
  paga valida `acceptedTerms` por truthiness, por lo que un valor no booleano como
  `"false"` puede pasar, y solo exige ocho caracteres de contraseña sin aplicar el
  blocklist de `isWeakPassword` usado por el alta Free. Ambos son bloqueos de release.

## services/

### `services/planCatalog.js`

- `initializePlans()` espera índices e inserta faltantes con `$setOnInsert`.
  Completa solo documentos legados sin `features`, incrementando `__v`; preserva
  precios/promociones/multiplicadores y valida el catálogo antes del arranque.
- `planToDTO()` / `listPlans()` exponen las features, multiplicadores, versión y
  totales regulares; `effectivePrice` coincide con `price`.
- `getPlan()` / `getPlanForUser()` leen MongoDB y resuelven plan efectivo;
  `getRequestPlan()` reutiliza la lectura solo dentro de la petición actual.
- Features de diseño en la semilla: `menu_styles` (20-09-2026) y
  `premium_menu_styles` (25-09-2026), las dos solo para Pro al lanzarlas.
  **Agregar una feature es un cambio en lock-step:** `isValidFeatures` (backend) e
  `isPlanFeatures` (`src/api/plans.ts`) exigen la cantidad **exacta** de claves.
  Ningún orden de despliegue evita la ventana en la que el catálogo se ve
  incompleto. Además, `initializePlans()` completa la clave en los documentos de
  `plans` al arrancar: un rollback del backend a una versión que no la conoce
  rompe el catálogo en toda la app (también en las cartas públicas), salvo que
  antes se saque la clave de esos documentos.
- `getCheckoutQuote()` cotiza desde MongoDB. El flag opcional
  `withSellerDiscount` usa `discountPrice ?? price`; lo activa
  `crear-preferencia` (conversión, upgrade y renovación) cuando la cuenta tiene
  `sellerID`. El alta paga siempre toma precio regular. Sin catálogo válido se bloquea el
  cobro, sin fallback. Las rutas validan `planVersion` y responden 409 antes de
  escribir o solicitar una preferencia.

### `services/sellerSaleService.js`

- **`attributionForUser(user)`** — el vendedor que comisiona una venta es siempre el
  `User.sellerID` de ese momento (vendedor o influencer); `assignedSeller` nunca
  participa.
- **`createSaleSnapshot`** / **`recordSaleFromTransaction(transaction)`** — arman y
  guardan (upsert por `paymentID`) el `SellerSale` de un pago aplicado, a partir de la
  atribución congelada en la transacción.

### `services/sellerPanelService.js`

Motor de cálculo del panel de vendedores. Todo se deriva de `SellerSale`, nunca de
`Plan` ni de `PaymentTransaction`, para no arrastrar precios en vivo.
- **Regla de elegibilidad** (definida por el negocio): la primera venta de un cliente
  siempre genera comisión y puntos. Una renovación solo cuenta si el contrato
  anterior de ese cliente era de 1 mes; renovar desde 3/6/12 meses no suma, porque ese
  período ya se pagó como una venta. **`computeEligibility`** la calcula con el
  historial **completo** del cliente (también las ventas de otro vendedor antes de una
  reasignación) y **`loadEligibleSalesForSellers`** filtra las de ciertos vendedores.
- **`summarizeCycle`** — resume un ciclo mensual: el nivel (tier) sale del total de
  puntos del ciclo y esa tasa se aplica a cada venta del ciclo.
- **`summarizeHistoric`** — suma ciclo por ciclo, porque cada ciclo tiene su propio
  nivel.
- **`getOverviewForSellers`** (panel general, sin N+1 por vendedor) y
  **`getRanking`** (`current`, `previous` o `historic`, separado por plan).

### `services/influencerPanelService.js`

El influencer cobra **15% fijo** (`INFLUENCER_RATE`) y solo sobre la **primera compra
aprobada** de cada referido (`influencerReferral`); las renovaciones no cuentan.
**`getInfluencerOverview(seller)`** lista sus referidos (convertidos o no) y
**`netInfluencerCommission`** calcula la comisión neta de reembolsos. Como en los
vendedores, la comisión no se guarda: se recalcula desde `SellerSale.amount`.

### `services/leadAssignmentService.js`

**`nextLeadSeller()`** — reparto **round-robin** de los referidos de influencers entre
los vendedores activos, no influencers, con `receivesLeads`. Usa el contador atómico
de `LeadAssignmentState`; devuelve null si no hay nadie que reciba leads.

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
  de meses cortos. **`startOfMonthBA`** da el inicio del mes en Buenos Aires (altas
  del mes del CRM). También exporta `TIMEZONE_BA`.
- **`utils/validators.js`** — única fuente de las validaciones que comparten las altas
  gratuita, de prueba y paga: **`isValidEmail`**, **`isWeakPassword`** (8+ caracteres y
  fuera de una lista de contraseñas triviales, sin reglas de complejidad, según NIST
  800-63B), **`isValidUsername`** (sin guion, porque el guion identifica a los
  vendedores en el login) e **`isValidPhone`** (criterio laxo).
- **`utils/regex.js`** — **`escapeRegex`** para búsquedas por texto del usuario.
- **`utils/imageUrl.js`** — **`isValidImageUrl`**: `image` de `Item`/`Menu` y
  `pendingMenuImages` solo aceptan URLs de Cloudinary. Cierra el SSRF de que una URL
  arbitraria termine pedida por el Chrome headless del PDF.
- **`utils/autoCode.js`** — **`generateAutoCode(name, id, existingCodes)`**: código de 4
  caracteres con el primero y el último del nombre y del ID de Mongo; si ya existe
  prueba con el segundo y el anteúltimo, y así. Con `panelSettings.autoGenerateCodes`.
- **`utils/statsPeriod.js`** — **`buildStatsPeriod(windowDays, createdAt)`**: ventanas de
  días completos para las estadísticas (actual y anterior de igual duración), hoy
  aparte, y si hay datos suficientes para comparar.
- **`utils/sellerCycle.js`** — ciclos mensuales de comisión anclados a
  `Seller.startDate` (o al alta si no tiene): **`cycleAnchor`**,
  **`cycleWindowAtOffset`** y **`currentCycleWindow`**, con el mismo recorte de meses
  cortos que `addCalendarMonths`.
- **`utils/mailer.js`** — **`sendMail`** y **`sendConfirmationCodeEmail`** por Gmail con
  nodemailer (`SMTP_USER`/`SMTP_PASS`). Resuelve la configuración recién en el primer
  envío, así la falta de SMTP no rompe el arranque: solo fallan las acciones que
  mandan mails.
- **`utils/serviceActionCodes.js`** — códigos de 6 dígitos por email compartidos por
  baja, arrepentimiento, verificación y cambio de email: **`generateNumericCode`**,
  **`hashCode`** (SHA-256), **`maskEmail`**, **`createPendingServiceAction`** (invalida
  el código anterior sin usar) y **`claimPendingServiceAction`** (valida vencimiento e
  intentos y lo consume de forma atómica, por `requestId` en los flujos públicos o
  por `userID` en los autenticados).
- **`utils/publicMenu.js`** — serializador **puro** de la carta v2 (sin mongoose; la
  hora se inyecta para testear con fechas fijas): **`buildPublicMenu`**,
  **`toPublicItem`**, **`isItemAvailableNow`**, **`resolveOfferPrice`**,
  **`getReachableCategoryIds`** y los recortes **`toPublicContactInfo`**,
  **`toPublicMedia`** y **`toPublicFeatures`**. Reusa las reglas de `offers.js` e
  `itemAvailability.js`. El camino legacy y el PDF no lo usan.
- **`utils/menuPdfFonts.js`** — Playfair Display (normal e itálica) en base64 para el
  PDF: el Chromium de producción (`@sparticuz/chromium`) solo trae Open Sans y los
  títulos caían a esa fuente.
- **`utils/offers.js`** — normaliza y valida precio/período de una oferta, y resuelve
  si está activa en el instante actual. Una oferta sin período es manual/permanente;
  una programada requiere inicio y fin y solo se expone públicamente dentro del rango.
- **`utils/itemAvailability.js`** — valida las franjas semanales de disponibilidad,
  detecta solapamientos y calcula el estado actual en horario de Buenos Aires.
  `validateAvailabilitySchedule` lo comparten la disponibilidad, la oferta programada
  y el horario del local: hasta 4 rangos por día, un cierre menor o igual a la
  apertura termina al día siguiente y horas iguales son 24 h. El mensaje de
  superposición es genérico ("Los horarios no pueden superponerse.").
- **`utils/businessSchedule.js`** (25-09-2026) — **`normalizeBusinessSchedule(value)`**:
  valida y normaliza `User.schedule`. Devuelve `{ schedule }` o `{ error }`. Si un día
  abierto no trae `ranges`, lo lee como un único turno `open–close` (clientes
  anteriores), y copia el primer turno en `open`/`close`. Un día cerrado queda con
  `ranges: []` y conserva sus horas. Las superposiciones, incluso entre el domingo
  y el lunes, se validan con `validateAvailabilitySchedule`.
- **`utils/menuOrder.js`** (22-09-2026) — orden de la carta. `order` es la posición
  dentro del contenedor: un producto en su categoría, una categoría en su sección
  (`sectionID` null = "sin sección") y una sección entre las del local. Se ordena
  por `order` y después por `_id` (`MENU_ORDER_SORT`, `compareMenuOrder`,
  `sortByMenuOrder`). Los documentos sin `order` quedan primero y por orden de
  creación, como antes, así que no hace falta migrar. Las altas van al final
  (`getNextOrder`, `createOrderAllocator`). Reordenar reescribe el contenedor entero
  con 0, 1, 2... (`buildReorder`), con tope de `MAX_REORDER_IDS` (2000) ids por
  pedido (`parseReorderIds`).
- **`utils/phone.js`** (23-09-2026) — teléfonos argentinos guardados como código de
  área + número (10 dígitos, sin 54, 9, 0 ni 15). **`normalizeArPhone`** acepta lo que
  la gente tipea ("+54 9 11 2345-6789", "011 2345-6789", "11 15 2345-6789"),
  **`isValidArLocalPhone`** lo valida y **`toStoredPhone`** lo deja como Number (o
  null) para `contactInfo.number`. El front repite la misma normalización en
  `lib/whatsapp.ts`.
- **`utils/pdfBrowser.js`** — `getBrowser()` reutiliza Chrome headless por proceso,
  recupera arranques fallidos/desconexiones y usa Puppeteer. Requiere el navegador
  y sus dependencias del sistema en el deploy; los tests unitarios no prueban ese runtime.
- **`utils/menuPdfTemplate.js`** — `buildMenuHTML()` genera HTML imprimible de
  secciones/categorías/productos, escapa texto y omite items ocultos/no disponibles.
  Las imágenes se escapan dentro de `<img src>` y los modelos solo aceptan URLs de
  Cloudinary (`utils/imageUrl.js`), lo que cerró el riesgo de inyección de atributo
  y SSRF que figuraba como bloqueo. **`buildFooterTemplate`** arma el pie de página.
  Usa las fuentes de `menuPdfFonts.js`.
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
  - Públicas: `/` (AdminHome = landing comercial), `/login`, `/blog`,
    `/blog/que-es-un-menu-digital-qr`, `/register`, `/register/plans`,
    `/register/success`, `/verificar-email`, `/terminos`, `/privacidad`, `/contacto`,
    `/arrepentimiento` y `/baja`.
  - Admin (protegidas por `AdminRoute` + `AdminLayout`, el shell con sidebar/bottomnav):
    `/admin` (CEODashboard), `/admin/payments` (AdminPayments), `/admin/plans`
    (AdminPlans) y `/admin/sellers` (AdminSellers). El CRM ya no está en `/admin/crm`:
    vive en `/sellers/crm`, compartido con los vendedores.
  - Vendedores (protegidas por `SellerRoute` + `SellerLayout`; también entra el admin):
    `/sellers` (SellerOverview), `/sellers/simulacion`, `/sellers/configuracion`,
    `/sellers/ranking`, `/sellers/crm` y `/sellers/influencer` (InfluencerOverview).
  - Dueño (protegidas por `UserRoute` + `DashboardLayout`): `/dashboard`,
    `/menu/editor`, `/user/editor`, `/estadisticas`, `/configuracion` (SettingsPanel).
  - Tenant público por slug (al final): `/:slug` (UserHome) y `/:slug/menu` (UserMenu).

### `routes/AdminRoutes.tsx`

- **`AdminRoute`** — guard: muestra loader mientras carga auth; redirige a `/login` si no
  está logueado, o a `/dashboard` si no es admin; si es admin renderiza `<Outlet/>`.
  Llama a `useSessionSync()`.

### `routes/UserRoutes.tsx`

- **`UserRoute`** — guard inverso: redirige a `/login` si no está logueado, a `/admin`
  si es admin o a `/sellers` si es vendedor; si es dueño renderiza `<Outlet/>`. Mientras `emailVerified` sea `false`
  manda a `/verificar-email`. Llama a `useSessionSync()`.

### `routes/SellerRoutes.tsx`

- **`SellerRoute`** — deja pasar a vendedores y admins (el resto va a `/login` o a
  `/dashboard`). Para un vendedor revalida la sesión contra `GET /sellers/me` en cada
  cambio de ruta (así una baja o un cambio de rol se aplica al instante) y muestra un
  error con "Reintentar" si no puede verificarla. Un influencer solo puede estar en
  `/sellers/influencer`.

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
    `AuthResponse` a `AuthUser` (id/name/role/slug/subscription/vencimiento,
    `emailVerified` e `influencer`), guarda en state + localStorage (expiry 7 días).
    `role` es `"admin" | "user" | "seller"`.
  - **`refreshUser()`** — relee `/users/me` (o `/sellers/me` en una sesión de vendedor)
    y sincroniza plan/vencimiento en state y localStorage. Descarta la respuesta si
    mientras tanto se cerró sesión o se entró con otra cuenta. Se usa al volver de MercadoPago para no conservar el plan anterior.
    `AuthProvider` **no** dispara solo esa lectura: envuelve toda la app, incluida la
    carta pública, y ahí un `GET /users/me` por carga no lo usaba nadie. La
    sincronización automática vive en `useSessionSync` (ver abajo).
  - **`completeLogin(data)`** — acepta la sesión entregada por el backend, también
    desde `RegisterSuccess`, sin necesitar volver a enviar la contraseña temporal.
  - **`logout()`** — limpia state y localStorage.

### `context/useAuth.ts`

- **`useAuth()`** — hook que devuelve el `AuthContext`; tira error si se usa fuera del
  `AuthProvider`.

### `context/useSessionSync.ts`

- **`useSessionSync()`** — mantiene la sesión del panel alineada con el servidor:
  llama a `refreshUser()` al entrar, al volver a la pestaña (`focus` /
  `visibilitychange`) y en el instante de vencimiento del plan (con chequeos diarios
  para fechas muy lejanas; las cuentas legacy sin fecha no generan timers). Lo llaman
  los guards **`UserRoute`** y **`AdminRoute`**, no `AuthProvider`: así **`/users/me`
  ya no se dispara en la carta pública** (`/:slug/menu`) ni en la landing, que no
  tienen panel que mantener. Los vendedores no pasan por acá: `SellerRoute` los
  sincroniza contra `/sellers/me`.

### `context/NotificationContext.ts`, `NotificationProvider.tsx` y `useNotifications.ts`

- Sistema global de feedback con mensajes `success`, `error` e `info`. El provider
  mantiene hasta cuatro avisos visibles, evita duplicados inmediatos, aplica tiempos
  de cierre según el tipo y limpia sus timers al desmontarse. Los avisos usan
  `role="alert"` para errores y `role="status"` para confirmaciones/información.
- **`useNotifications()`** expone `notify`, `success`, `error` e `info`; exige estar
  dentro de `NotificationProvider`.

### `context/MobileDockContext.tsx`, `MobileDockProvider.tsx` y `useMobileDock.ts`

Le permiten a una vista a pantalla completa dentro del panel del dueño (por ejemplo,
el Gestor de imágenes) pedirle a `DashboardLayout` que oculte el dock de navegación
mobile mientras está abierta: tiene su propio "volver" y el dock solo taparía
contenido.

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

### `hooks/useAuthTheme.ts`

Tema claro/oscuro de las páginas **públicas** (solo tokens `--auth-*`), independiente
del panel: storage key propia (`public-theme`) y el atributo `data-auth-theme` sobre el
contenedor de cada página en vez de `<html>`, así los dos sistemas no se pisan.

- **`useAuthTheme()`** — devuelve `{theme, toggle}`.
- Lo aplican la landing, el blog, las páginas legales y el flujo de auth
  (Login, Register, VerifyEmail, RegisterPlans, RegisterSuccess). El **toggle visible**
  está solo en la landing, el blog y las legales; las pantallas de auth leen la misma
  preferencia para no cortar el tema a mitad del alta, pero no la cambian.
- Los valores claros viven en un único bloque `[data-auth-theme="light"]` de
  `globals.css`. Los tokens pensados para fondo casi negro tienen su variante clara
  ahí (`--auth-error-text`, `--auth-success-text`) y el ámbar de marca se desdobla:
  `--auth-amber` sigue igual en los dos temas para rellenos, bordes y glows, y
  `--auth-amber-text` es el que se usa como color de texto porque en claro hay que
  oscurecerlo (el de marca da 2.17:1 sobre crema).

### `hooks/usePlans.ts`

React Query consulta `api/plans.ts` con `PLANS_QUERY_KEY`, `staleTime: 0` y refetch
al montar. Lo consumen landing, registro, suscripciones, dashboard y paywalls.
Un error se muestra con reintento; no hay copias de precios como fallback.

### `hooks/useCrmClients.ts` y `hooks/useCrmAlerts.ts`

- **`useCrmClients`** — trae `/sellers/crm/clients` con React Query, así `SellerCrm` y el
  panel general (`SellerOverview`) comparten la caché en vez de pedir la lista dos
  veces. El drawer y el kanban actualizan la caché al cambiar un cliente.
- **`useCrmAlerts`** — badge de alertas del sidebar y del panel: seguimientos vencidos +
  leads nuevos asignados. Polling liviano solo con la pestaña visible. No corre para
  influencers, que no tienen CRM.

### `hooks/useMediaQuery.ts`

**`useMediaQuery(query)`** — suscripción a una media query para cuando cambia **qué** se
renderiza, no solo el estilo (para eso alcanza el `@media` del CSS). Sin `window`
responde `false`.

## lib/

### `lib/plans.ts`

`PLAN_ORDER`/`PLAN_LABEL` son identificadores, orden y etiquetas técnicas de UI.
`FEATURE_LABELS`, `BOOLEAN_FEATURES` y `getPlanFeatureLabels()` convierten el objeto
del catálogo en textos visibles, incluyendo límite y cantidad de diseños.
No asignan permisos: el backend los resuelve desde MongoDB.

### `lib/dates.ts`

**`formatDateAR(value, options)`** — el único formateador de fechas del front. Muestra
los instantes en horario de Buenos Aires (`TIMEZONE_BA`) y conserva el día de las
fechas `YYYY-MM-DD`. Con `calendarDate` trata como día (no como instante) los campos
que son un día aunque lleguen como ISO a medianoche UTC (seguimientos, ingreso de
vendedores). Tiene salidas para `<input type="date">` y un `fallback`, y rechaza días
inexistentes.

### `lib/apiErrors.ts`

**`extractServerMessage(err, fallback)`** — devuelve el `message` que mandó el backend
en un error de axios, en vez de un texto fijo que esconde el motivo.

### `lib/landingVisibility.ts` y `lib/menuDisplay.ts`

Claves y resolución de `panelSettings.landingVisibility` y `panelSettings.menuDisplay`,
en el orden en que las lista el panel de Configuración. **`resolveLandingVisibility`**
completa lo que falte con "visible" (solo `false` explícito oculta).
**`resolveMenuDisplay`** es al revés: todo apagado salvo `true` explícito, porque esas
opciones cambian cómo se ve una carta que ya está en uso.

### `lib/templates.ts`

`TEMPLATES` (apariencia de las paletas implementadas) y **`templateName(id)`**. Los
permisos vienen del catálogo (`features.templateIds`), nunca de esta tabla. Lo usan el
grid de paletas y el selector de familias.

### `lib/sellerCommission.ts`

Espejo **exacto** de `config/sellerCommission.js` del backend: precios fijos,
multiplicadores/puntos, niveles y `commissionForSale`. Lo usa la simulación de ventas
del panel de vendedores. Si se cambia un número acá, hay que cambiarlo también allá.

### `lib/whatsapp.ts`
Helpers puros del **pedido por WhatsApp**, sin backend de pedidos. El permiso
`pedido_whatsapp` se aplica en la UI y en `CartProvider`, no dentro de estos helpers.
- **`normalizeArPhone(value)`** / **`isValidArLocalPhone(digits)`** — la misma
  normalización que `utils/phone.js` del backend (código de área + número, 10 dígitos,
  sin 54/9/0/15). Se repite acá para los números guardados antes y para validar el
  formulario sin ida y vuelta.
- **`sanitizePhoneForWa(number)`** — convierte el teléfono guardado al formato
  `54 9 <área><número>` que exige `wa.me` para celulares argentinos. Devuelve null si
  no hay número.
- **`getWaTargets(info)`** (WhatsApp multisucursal) — destinos posibles de un pedido o
  una reserva: uno por cada `contactInfo.whatsappNumbers` o, si no hay ninguno, el
  `number` de siempre. **`buildWaHref(phone, message)`** arma el link de cada uno.
- **`buildOrderMessage(cart, businessName, extraText?, { hidePrices, mode })`** — arma
  el texto legible del pedido (cantidad × producto, variante, subtotal por línea y
  total; sin montos con `hidePrices`) y suma `extraText` al final. Con `mode` la
  primera línea es la modalidad (`🛵 *DELIVERY*` o `🥡 *TAKE AWAY* (retiro en el
  local)`): es lo que WhatsApp muestra en la lista de chats, así el local distingue
  los pedidos sin abrirlos y los encuentra buscando "DELIVERY" o "TAKE AWAY".
- **`OrderMode`** (`"delivery" | "takeaway"`), **`ORDER_MODE_LABELS`** y
  **`getOrderModes(user)`** — las modalidades que ofrece el local, delivery primero.
  `hasTakeAway` ausente (backend anterior) cuenta como apagado.
- **`buildOrderChoices(cart, businessName, texts, { hidePrices, modes })`** — un
  `WaMessageChoice` (`key`, `label`, `detail`, `message`) por modalidad, para
  `WaTargetPicker`. Cada modalidad lleva su texto: `orderMessage` en delivery,
  `takeAwayMessage` en take away. Sin modalidades devuelve un único mensaje sin
  modalidad con `orderMessage` (un carrito guardado en un local que después apagó
  las dos).
- **`buildWaLink(number, message)`** — devuelve el link `https://wa.me/...?text=` (URL-
  encoded) o null si el número no sirve (el caller oculta el botón en ese caso).


### `lib/offers.ts`

`isOfferActive(item, now)` comprueba precio y rango temporal para mostrar ofertas
en la carta y el modal. El backend resuelve el permiso y el dato público. Con la
carta v2 el servidor ya resolvió la oferta (manda `offerPrice`, junto con `price`,
solo si rige ahora, y no manda `offerRange` ni `offerSchedule`): sin ellos
`isOfferActive` la da por vigente, y con precio o `offerPrice` ausentes devuelve
`false`. Con la respuesta legacy sí llegan el rango y el horario, y el front vuelve a
resolverlos por si la carta queda abierta cruzando un límite horario.
`isScheduleActiveAt(schedule, now)` resuelve una semana de rangos en horario de
Buenos Aires (el turno pertenece al día en que abre; un cierre menor o igual a la
apertura sigue al día siguiente). También la usa `getOpenStatus` para el
horario del local.

### `lib/menuStyles.ts`

Espejo de `config/menuStyles.js` del backend: `LEGACY_STYLES` (Clásico, Bistró) y
`VISUAL_FAMILIES`, que incluyen los diseños premium `neo-brutalism` y `tactile`
(`PREMIUM_MENU_STYLES`, 25-09-2026). **`getMenuStyleFeature(style)`** dice qué feature
pide cada diseño (`menu_styles`, `premium_menu_styles` o ninguna); `MenuStylePicker`
lo usa para mostrar el candado y el `UpgradeModal`. `resolveMenuStyle` y
`getVisualFamily` traducen el valor guardado; `buildAppearanceBody` arma el cuerpo
de `PATCH /api/users/template`.

### `lib/publicMenu.ts`

Helpers puros de la carta pública (con tests en `test/publicMenu.test.ts`):
- **`isItemUnavailable(item)`** — `true` solo si `available === false`. La v2 manda
  `available: false` solo en los no disponibles y omite la clave en el resto: por
  eso no se puede usar `!item.available`, que dejaría todos los productos v2 como "No
  disponible". Lo usan `UserMenu`, `ItemPreviewModal` y `cartPricing`.
- **`categoryKey(tabIndex, categoryIndex)`** — clave **posicional** de una categoría
  (`"<pestaña>:<categoría>"`): la v2 no manda `_id` de categorías, y esta clave es única
  entre pestañas (el estado de categorías abiertas sobrevive al cambio de pestaña).
  Sirve de `key` de React, de clave de `openCats` y de `aria-controls`.
- **`buildMenuTabs(menu)`** / **`tabHasItems(tab)`** — pestañas de la carta (una por
  sección, más "Otros" con lo que no tiene sección) y si una pestaña tiene al menos
  un producto.

### `lib/cartPricing.ts`

**`cartUnitPrice`** (precio con el que entra un producto al carrito) y
**`repriceCartLines`**, que pone al día el carrito guardado contra la carta cargada:
descarta las líneas cuyo producto ya no está (oculto o borrado) o quedó
`available === false` (pausado o fuera de horario, en v2 y legacy), cuya variante ya no
existe o que se quedaron sin precio, y actualiza precios (o 0 con precios ocultos).

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
**`fetchUserBySlug`**, **`getMe`**, **`verifyEmail`**, **`resendVerificationCode`**,
**`updateMe`**, **`uploadUserImage`**, **`setTemplate`**, **`setActive`**.

### `api/menus.ts`

**`fetchPublicMenu(slug)`**, **`createMenu`**, **`updateMenu`**, **`hideMenu`**,
**`uploadMenuImage`**.
`fetchPublicMenu` apunta a `/menus/public/:slug` y `hideMenu` a `PUT /menus/hide/:id`:
son wrappers desalineados con las rutas actuales. La carta real usa
`/users/:slug/menu` y el editor `PATCH /menus/:id/hidden`; no copiarlos como contratos.

### `api/items.ts`

**`createItem`**, **`updateItem`**, **`moveItem`**, **`deleteItem`**,
**`uploadItemImage`**, **`setItemHidden`**, **`setItemAvailable`** y las del Gestor de
imágenes: **`getLiteItems`**, **`getPendingImages`**, **`getPresetImages`**,
**`uploadLibraryImage`**, **`assignLibraryImages`** y **`deleteLibraryImage`**.

### `api/massive.ts`

**`downloadMassiveTemplate`** (blob), **`previewMassiveImport(file)`**,
**`confirmMassiveImport(file)`**, y **`triggerBlobDownload(blob, filename)`** (dispara la
descarga en el navegador).

### `api/crm.ts`

CRM bajo `/sellers/crm` (admin y vendedores): **`listCrmClients`**, **`getCrmSummary`**
(dashboard del CEO), **`getCrmClient`**, **`updateCrmProfile`** (incluye
`assignedSeller`), **`addCrmNote`**, **`deleteCrmNote`**, **`getCrmAlertCounts`**
(seguimientos vencidos + asignaciones nuevas, para el badge), **`markCrmAlertsSeen`** y
**`exportCrmClients(stage?)`** (descarga el listado como blob `.xlsx`, respetando el
filtro de etapa). Incluye **`setCrmClientActive`**, que usa el endpoint admin de estado
de cuenta.

### `api/sellers.ts`

Panel de vendedores (`/sellers`): **`getMySellerProfile`**, **`changeMySellerPassword`**,
**`uploadMySellerPhoto`**, **`getSellerOverview(sellerID?)`**,
**`getSellerRanking(period)`** e **`getInfluencerOverview`**, con sus tipos
(`SellerOverviewEntry`, `SellerCycleSummary`, `CommissionTierDTO`, `PlanBucket`,
`SellerRankingEntry`, `InfluencerLead`...). La facturación solo viene cuando pregunta
un admin.

### `api/menuTemplates.ts`

**`getMenuTemplates`** (`GET /menu-templates`) y **`copyMenuTemplates`**
(`POST /menu-templates/copy`).

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

Cliente axios tipado del ABM de vendedores: **`listAdminSellers(includeInactive)`**,
**`createAdminSeller`**, **`updateAdminSeller`**, **`deactivateAdminSeller`** (el
`DELETE`, que es una baja lógica) y **`resetAdminSellerPassword`**. El DTO `Seller` trae
datos de contacto, rol (`influencer`, `receivesLeads`), `startDate`, estado y foto;
las métricas ya no vienen acá sino del panel de vendedores.

## types/

### `types/index.ts`

Tipos espejo de los schemas del backend y de las respuestas de la API. Incluye:
`Subscription`, `ApiErrorType`, `ContactInfo`, `Media`, `User`, `AuthUser` (forma
normalizada del user logueado en el contexto), `Menu`, `Item`, respuestas
(`PublicMenuResponse`, `AuthResponse`, `TemplateResponse`, ...), el menú público
agrupado (`Categoria`, `Seccion`, `MenuData`, `Tab`, `UserMenuResponse`), los tipos de la
carta pública v2 (`PublicMenuItem`, `PublicMenuCategory`, `PublicMenuSection`,
`PublicMenuData`, `PublicMenuTab`, `PublicMenuUser`, `PublicMenuPayload`: aparte de los
espejos completos de arriba, con opcionales donde la v2 omite lo vacío y con
`available`/`hidden`/`offerRange`/`offerSchedule` opcionales solo por compatibilidad
con la respuesta legacy), el menú del
panel (`AdminItem/AdminCategoria/AdminSeccion/AdminMenuData`, con campos que solo usa el
editor), `DashData`, `DayCount`, `StatsData`, la analítica por plato (`TopItemStat`,
`ItemStatsData`), tipos de import masivo (`MassiveRowResult`, `MassivePreviewResponse`,
`MassiveConfirmResponse`), de admin (`AdminStats`) y de CRM (`CrmStage`,
`CrmNote` — con `kind: "note" | "event"` para distinguir notas manuales de eventos del
sistema —, `CrmProfile`, `CrmClient`, `CrmClientDetail`). `ContactInfo` incluye
datos del negocio, contacto, ubicación, redes, mensaje de reserva por WhatsApp y
`whatsappNumbers` (uno por sucursal). `Media` incluye `favicon`, opcional para
tolerar un backend anterior. También incluye horarios (`DayKey`, `DayHours`,
`Schedule`, `TimeRange`; `DayHours.ranges` es opcional porque los horarios guardados
antes solo traen `open`/`close`, y se lee con `getDayRanges`), programación de
productos, vencimientos, DTOs `AdminPayment`/`AdminPaymentsResponse` y los tipos de
onboarding/alertas CRM, `PlanFeatures` y `BooleanPlanFeature`. El DTO comercial `PlanDefinition` vive en `api/plans.ts`.

## components/

### `components/Common/`

- **`ErrorBoundary.tsx`** — **`class ErrorBoundary`**: error boundary de React (único
  modo de atrapar errores de render). `getDerivedStateFromError`, `componentDidCatch`
  (loguea, hook para Sentry), `handleReload` y un fallback con botón "Recargar".
- **`BrandMark.tsx`** — imagen decorativa compartida desde
  `public/brand/menu-digital-logo-mark.svg`, clase global `md-brand-mark`. Con
  `inline` dibuja el mismo SVG en el DOM con el fondo en `currentColor` (paneles CEO y
  vendedor). El logo es cuadrado: los contenedores van con ancho = alto. Los favicons
  (`favicon.ico`, `favicon-*.png`, `apple-touch-icon.png`) y
  `brand/menu-digital-logo-512.png` (og:image / logo de schema.org) son rasterizados
  de ese SVG; si cambia el logo, hay que regenerarlos. **A los favicons no se les
  suma el texto de marca**: ahí va solo el ícono.
- **`BrandWordmark.tsx`** — el texto del logo, "menudigital" en minúscula y sin
  espacio, con `<b>menu</b>` en bold y "digital" en regular. El contraste lo da el
  peso y no el color: hereda `color` del contexto, así queda tinta sobre claro y
  crema sobre oscuro con un solo token y sin reglas por tema. Estilos en la clase
  global `md-wordmark` (ver [styles/](#styles)), que además neutraliza itálica y
  `text-transform` heredados. Se combina con `BrandMark` en dos lockups:
  **vertical** (ícono arriba, wordmark centrado abajo) en las tarjetas de auth
  (Login, Register, VerifyEmail), y **horizontal** (ícono a la izquierda) en la nav
  y el footer de la landing, los sidebars de los paneles CEO y vendedor, el header
  del blog y las dos publicidades del plan gratuito. Las páginas legales lo usan
  solo (sin ícono), igual que la nav/footer de la landing de la que cuelgan. Cada
  lugar sigue poniendo el tamaño y el color; el componente no los define.
  El lockup vertical respeta la proporción del logo vertical: la tinta del wordmark
  mide exactamente el ancho del ícono (la "m" y la "l" caen sobre sus bordes) y el
  aire entre los dos es el 11% del ícono. Cada tarjeta fija solo `--lockup-icon`
  (112px) y el font-size y el gap se derivan de los tokens `--md-wordmark-ink` y
  `--md-lockup-gap` de `globals.css`, medidos sobre la tinta real de Poppins; si
  cambia la fuente, un peso o el tracking del wordmark, hay que volver a medirlos.
  El lockup horizontal es la clase global `.md-lockup` (ícono y wordmark como hijos
  directos): la base del texto apoya en el borde de abajo del ícono (`align-items:
  baseline`, que a la imagen le sintetiza la base ahí), el tope de la "m" cae a
  365/512 del ícono y de la tinta del ícono a la de la "m" hay un 19.27% del ícono.
  Cada lugar fija solo `--md-lockup-icon`: nav de la landing (40px), footer (34px),
  header del blog (32px), banner del plan gratuito del panel de usuario (34px, 32px
  en mobile) y la publicidad de las cartas (32px). En los dos anuncios el logo está
  adentro del copy, pegado al wordmark, y el resto de la línea se alinea por
  baseline con él. Los sidebars de los paneles CEO y vendedor no lo usan.
- **`FreePlanAd.tsx`** — publicidad reutilizable en la landing/carta cuando
  `features.sin_publicidad` no está activo, cualquiera sea el plan. Marca y CTA a
  `/`; estilos globales `t-free-plan-ad*`.
- **`DataTable/DataTable.tsx`** — **`DataTable<T>({rows, columns, getRowId, caption, ...})`**:
  tabla genérica del panel admin. Aporta el wrapper con scroll horizontal propio (la
  página nunca scrollea en horizontal), la barra de filtros, el orden por clic en el
  encabezado (`aria-sort` incluido), la búsqueda de texto en memoria sin acentos ni
  mayúsculas, las filas desplegables (una sola abierta a la vez) y los estados de
  carga/error/vacío/sin-resultados. Los vacíos se ordenan siempre al final, en las dos
  direcciones. **No** resuelve el filtrado que no sea texto ni la paginación a propósito:
  en Pagos ambos son del lado del servidor, así que cada pantalla arma sus controles y
  los pasa por `filters` (o los deja afuera, como el CRM, cuyos filtros también
  gobiernan el kanban). Cada columna define `render` y, si se puede ordenar,
  `sortValue` más un `initialDirection` opcional (cantidades, plata y fechas suelen
  querer "desc" al primer clic). `layout="fixed"` hace mandar al `width` de cada
  columna, para tablas con muchas columnas donde una celda larga desacomodaría el
  resto. Usado por `Admin/Sellers/AdminSellers`, `Admin/Sellers/SellerMetricsPanel` y
  `Admin/Crm/CrmClients`; Pagos sigue con su tabla propia. CSS en
  `DataTable.module.css`.
- **`RouteSeo.tsx`** — **`RouteSEO`**: pone título, descripción, `robots` y `canonical`
  según la ruta (landing, blog, legales, login, registro, verificación de email).
  Los paneles (`/admin`, `/sellers`, `/dashboard` y el resto del dueño) van con
  `noindex`, y si una página no tiene canonical borra el de la ruta anterior.
- **`GifClip/GifClip.tsx`** — clip en loop para el blog y la landing. Usa video
  (`.mp4`/`.webm`) cuando puede, porque pesa una fracción de un gif y se puede pausar
  con "reducir movimiento"; posterga la carga del video hasta que entra en pantalla.
  `alt` es obligatorio (es el único texto para lectores de pantalla) y sin `src`
  muestra un placeholder.
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
- **`WeeklySchedule/WeeklySchedule.tsx`** — editor semanal estilo "alarma del celular":
  se carga el horario una vez y se prenden los días en los que rige. Los días con
  otro horario se marcan como excepción ("Algún día tiene un horario distinto") sin
  salir de la pantalla, y cada día admite hasta `maxRangesPerDay` rangos (4, igual que
  el backend). Habla el shape plano `{ mon: [{from,to}], ... }`
  (`WeekRanges`). Abajo muestra un resumen agrupado ("Lun a Vie · 09:00 a 18:00 y
  20:00 a 00:00"). Lo usan la programación de ofertas y de disponibilidad
  (`MenuEditor`) y el horario de atención (`UserEditor`). Props de texto:
  `timeLabel`, `daysLabel`, `allDayLabel`, `addRangeLabel`, `emptyLabel` y
  `exceptionLabel`. `ScheduleDateRange.tsx` es el rango de fechas opcional de la
  programación de productos. La lógica pura (`readWeek`/`writeWeek`,
  `describeWeek`, presets de días) vive en `weekSchedule.ts`, con tests en
  `test/weekSchedule.test.ts`.
- **`BusinessSEO.tsx`** — metas de la landing y la carta de cada local. Con
  `media.favicon` reemplaza el favicon del sitio por el logo del local mientras se
  ve su página: reescribe los `<link rel="icon">` de `index.html` en vez de sumar uno
  (con varios, cada navegador elige otro) y los restaura al salir.

### `components/Admin/Home/AdminHome.tsx`

Landing comercial pública (la home de `/`). Presenta la propuesta, precios y CTA a
registrarse. Precios y beneficios vienen de `usePlans()`/MongoDB. Las tarjetas
viven en una sección inline —no hay modal de precios— y enlazan a `/register?plan=<id>`: Free muestra "Crear cuenta" y
Basic/Pro, "Pagar y crear cuenta". Los CTA generales desplazan hasta esa sección.
Componente principal **`HomePage`** con hooks de animación (`useParallax`,
`useReveal`, `useCounterOnView`, steam rings), `CustomCursor` y navegación mobile.

### `components/Admin/Panel/AdminLayout.tsx`

Shell del **panel CEO** (sidebar desktop colapsable + bottom nav mobile + `<Outlet/>`),
mismo patrón que el `DashboardLayout` del dueño.

- **`AdminLayout`** — nav items: Panel (`/admin`), Pagos, Planes y Vendedores. Vendedores
  despliega los accesos al panel de vendedores (Panel general, Simulación de ventas,
  CRM, Ranking y Configuración, todos bajo `/sellers`), porque el CRM y las métricas
  del equipo viven ahí. `useTheme` (toggle claro/oscuro), `handleLogout` y la
  preferencia de sidebar colapsada en `localStorage`.

### `components/Admin/Panel/CEODashboard.tsx`

Resumen ejecutivo interno (`/admin`). **`CEODashboard`** carga `/admin/stats`,
`getCrmSummary()` y los últimos pagos con `Promise.allSettled`: conserva los
indicadores disponibles si una fuente falla. Muestra clientes, menús y contenido,
cobros persistidos (aprobados, pendientes, fallidos, importe acreditado), la bandeja
operativa de atención de clientes, la cartera por plan y los últimos clientes
registrados. Los accesos llevan al CRM (`/sellers/crm`, con `?client=<id>` para abrir
una ficha) y a Pagos. No gestiona clientes aquí.
El importe es acumulado del historial local, **no MRR ni saldo de MercadoPago**.
La distribución de planes usa la suscripción almacenada del CRM, no el plan efectivo.
`KpiCard`, `ModuleShortcut`, `AttentionRow` y helpers de presentación usan su CSS
Module y tokens `--admin-*`; navegación/logout viven en `AdminLayout`.

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
existentes; los checkouts anteriores conservan su importe. Cada tarjeta muestra el
uso del plan (`GET /admin/plans/usage`): cuentas y activas, facturado en 30 días y
total, y cantidad de pagos.

### `components/Admin/Sellers/AdminSellers.tsx`

ABM de vendedores e influencers (`/admin/sellers`). React Query carga la lista y la
pinta con el `DataTable` común (búsqueda, orden por encabezado, filtro por rol —
Influencer, Vendedor que recibe leads o no — y fila desplegable). Por defecto muestra
el equipo vigente; se pueden incluir los dados de baja.

- **`CreateSellerModal`** — alta con nombre, DNI (normalizado), mail, teléfono, fecha
  de ingreso (`startDate`, ancla del ciclo de comisión), contraseña (8+) y rol:
  influencer, o vendedor que recibe o no leads (`SellerLeadOptions`). El código se
  genera en el backend y se muestra como inmutable.
- **`SellerEditPanel`** — edición en la fila desplegable, **"Dar de baja"** (baja
  lógica con confirmación: no puede iniciar sesión, conserva su historial) y
  **`ResetPasswordModal`** para poner una contraseña nueva sin pedir la actual.
- Informa 409 (duplicados) y actualiza el caché sin recargar. Las comisiones y
  métricas no están acá: están en el panel de vendedores.

### Panel de vendedores (`components/Seller/`)

Vendedores e influencers entran con su código (`AAA-999`) y contraseña. El admin
también puede entrar y ve a todo el equipo.

- **`SellerLayout.tsx`** — shell con sidebar colapsable propio (preferencia separada de
  la del admin) y dock mobile. Items: Panel general, Simulación de ventas, CRM,
  Ranking (solo admin) y Configuración; un influencer solo ve "Mis referidos". El
  ítem CRM lleva el badge de `useCrmAlerts` (seguimientos vencidos + asignaciones
  nuevas).
- **`Overview/SellerOverview.tsx`** (`/sellers`) — panel general: clientes vendidos
  (totales y del ciclo actual), comisión del ciclo con su nivel, clientes por plan,
  cartera del CRM por etapa (donut con `conic-gradient`, sin librería), alertas y
  últimas asignaciones. El admin ve al equipo completo, puede filtrar por vendedor y
  además ve la facturación.
- **`Simulation/SellerSimulation.tsx`** (`/sellers/simulacion`) — calculadora: cuánto
  cobraría según la cantidad de clientes vendidos por plan y duración, con los
  niveles de `lib/sellerCommission.ts`.
- **`Ranking/SellerRanking.tsx`** (`/sellers/ranking`, solo admin) — comisión y puntos
  por vendedor en tres gráficos (general, Básico y Pro), para el ciclo actual, el
  anterior o el histórico.
- **`Settings/SellerSettings.tsx`** (`/sellers/configuracion`) — cambiar la contraseña
  (pide la actual) y la foto de perfil.
- **`Influencer/InfluencerOverview.tsx`** (`/sellers/influencer`) — "Mis referidos":
  cada referido convertido o sin convertir y la comisión del 15% sobre su primera
  compra.
- **`Crm/SellerCrm.tsx`** (`/sellers/crm`) — **CRM** de clientes. El admin ve todos (y
  puede filtrar por vendedor); un vendedor ve los que trajo y los que tiene asignados.
  Dos vistas: lista (`DataTable` con contacto, plan/vencimiento, etapa, onboarding,
  visitas, último pago, seguimiento y alertas) y **Kanban** por etapa, con drag &
  drop nativo que llama a `updateCrmProfile` (`moveToStage`, optimista). En celular
  arranca en Kanban. Tiene filtros por etapa, plan, cuenta y origen del lead (de
  vendedor o de influencer; el admin ve además los referidos "sin encargado"), búsqueda,
  `AttentionInbox`/`TrafficTrend` (`AttentionWidgets.tsx`) y, solo para el admin,
  "Exportar a Excel". `?client=<id>` abre una ficha.
- **`Crm/ClientDrawer.tsx`** — ficha del cliente: perfil, actividad, link a la carta,
  etapa, tags, próximo seguimiento, checklist de onboarding e historial de
  **Actividad** (notas manuales mezcladas con eventos automáticos, que se ven
  discretos, con autor "Sistema" y sin borrar). En un referido de influencer, el
  admin elige el vendedor responsable (`assignedSeller`). Solo el admin ve los pagos
  del cliente y puede activar o desactivar la cuenta. Cierra con Escape.
- **`Crm/crmHelpers.ts`** / **`crmIcons.tsx`** — `STAGE_META`, `STAGE_ORDER`,
  `ATTENTION_META`, `ONBOARDING_ITEMS` y formateo de fechas y vencimientos.

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
  `/payments/validate-seller-code` y solo entonces muestra `discountPrice ?? price`
  y el precio anterior. Sin código aplicado muestra el precio regular. El backend
  vuelve a resolver el vendedor antes de cotizar y el webhook suma siete días al
  usuario creado con `sellerID`; hay cobertura local, no E2E real.

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
  `useAvatar`, título, badges de delivery y take away, lista de contacto, galería
  bento, botón "Ver menú"). Setea `document.title`.
- Sub-componentes: **`ContactList`** (chips de contacto con `useReveal`, sin reseñas integradas), **`Gallery`**
  (galería bento con foto destacada), **`Loader`** (skeleton con la silueta real),
  **`NotFound`** (clases globales `.t-notfound*`, compartidas con la carta).
- **`ReserveButton`** — reserva por WhatsApp con el mensaje del dueño. Con varios
  números (sucursales) usa **`WaTargetPicker`** para que el cliente elija a cuál
  escribir.
- **`ScheduleSection`** / **`OpenStatusBadge`** — horario desplegable ("Hoy · Viernes ·
  12:00 – 15:00 y 20:00 – 00:00 (día siguiente)") y el badge "Abierto/Cerrado ahora" del
  hero. Leen los turnos con `getDayRanges` y el estado con `getOpenStatus`
  (`Utils/businessSchedule.ts`), así que muestran horarios cortados. Un horario con
  los 7 días cerrados se trata como si no hubiera horario.
- El favicon del local (`media.favicon`) lo aplica `Common/BusinessSEO`.
- **`ImageViewer`** — lightbox a pantalla completa (se abre al tocar la foto de portada
  o una de la galería). Theme-agnóstico: backdrop con blur, imagen con zoom de entrada,
  botones glassmorphic (cerrar / prev / next con estado disabled en los extremos) y
  contador "N / total". Navegación por teclado (← → / Esc), bloqueo del scroll del fondo
  mientras está abierto, y `role="dialog"` + aria-labels. Responsive (tap targets
  cómodos en mobile).

### `components/User/Home/Menu/UserMenu.tsx`
**Carta pública** (`/:slug/menu`). Helpers: `minOption(options)` (precio mínimo entre
variantes), `fmt(n)` (formato de precio AR), `offerPct(orig, offer)` (% de descuento).
- **`MenuPage`** — trae `/users/:slug/menu?v=2` (contrato v2, ver `fetchUserWithMenu`
  arriba; con `AbortController`), arma tabs por sección (`buildMenuTabs`), aplica el template,
  scroll-reveal, `document.title`. **Tolera también la respuesta legacy**, por si el front
  nuevo se despliega antes que el back (un back viejo ignora `?v=2`): la disponibilidad se
  lee con `isItemUnavailable` (`available === false`, nunca `!available`), y una oferta
  legacy con rango/horario se sigue resolviendo en el cliente. En los dos contratos un
  producto pausado o fuera de programación llega con `available: false` y se ve con
  "No disponible", sin controles de pedido; solo los ocultos no viajan. Con v2 las
  ofertas llegan resueltas (precio normal + `offerPrice` vigente). La
  respuesta v2 no trae `_id` de secciones ni de categorías: cada categoría se identifica
  por su posición (`categoryKey(pestaña, categoría)`, por ejemplo `"1:0"`), que hace de
  `key`, de clave de categorías abiertas (`openCats`, que vive en `MenuPage` y sobrevive
  al cambio de pestaña) y de `aria-controls`. Como el componente no se remonta al
  navegar de una carta a otra, al cargar una carta nueva se reinician `openCats`, la
  pestaña activa y el preview (las claves posicionales de la anterior abrirían
  categorías al azar). Los productos siguen usando `_id` (vistas por plato y carrito).
  Esta pantalla ya **no dispara `/users/me`** (ver `useSessionSync`). La cabecera y las tabs viven en un **único wrapper
  sticky** (`.mpSticky`): las tabs quedan pegadas exactamente debajo del header sin
  acoplar un `top:` fijo a una altura que cambia entre mobile y desktop; al cambiar de
  tab se vuelve al tope de la página (el inicio visible del contenido). Envuelve todo en
  **`CartProvider`** (carrito por slug, habilitado por las features recibidas), renderiza el **`CartFab`** (botón flotante con
  badge de cantidad, solo si el carrito tiene algo), el **`CartDrawer`** y el
  **`ClearCartDialog`** — **dentro** del contenedor `[data-template]`, porque los
  tokens `--t-*` solo existen ahí. Los destinos del pedido salen de `getWaTargets` y
  las modalidades de `getOrderModes` (la cabecera muestra "Delivery" y/o "Take away").
  `features.pedido_whatsapp` controla el carrito y `sin_publicidad` los anuncios;
  `canOrder` (plan + al menos una modalidad) controla los botones de agregar. **Responsive**: columna única estilo mobile hasta 1024px;
  de ahí en adelante el contenedor crece (~1080px) y cada categoría pasa a una **grilla
  de 2 columnas** (título ocupando ambas; `align-items:start` para que expandir
  variantes en una tarjeta no estire a su vecina).
- **`ItemCard`** — tarjeta de producto (imagen con `loading="lazy"`, precio, badges).
  El precio muestra un solo estado a la vez: oferta (precio nuevo + tachado + badge de
  descuento) > variantes ("Desde" el mínimo) > precio simple. Control de **carrito**:
  `AddControl` simple si el producto no tiene variantes, o un `AddControl` por variante
  dentro del panel expandible (los dos, solo con `canOrder`; igual en
  `ItemPreviewModal`); el botón "Variantes" solo aparece cuando el panel
  realmente abre (con oferta activa el producto se agrega como ítem simple al precio de
  oferta). El primer tap sobre la tarjeta dispara el **tracking de vista por plato**
  (`POST /:slug/menu/items/:itemID/view`, fire-and-forget, una vez por montaje).
- **`AddControl`** — botón "+" que al agregar se convierte en stepper −/cantidad/+
  (sincronizado con el carrito vía `useCart`).
- **`CartFab`** — botón flotante del carrito (abre el drawer).
- Sub-componentes: **`MenuSkeleton`** (misma silueta que el contenido real, incluida la
  grilla de 2 columnas en desktop), **`NotFound`** (clases globales `.t-notfound*`),
  **`EmptyMenu`**, e íconos SVG (`BackIcon`, `PinIcon`, `DeliveryIcon`, `TakeAwayIcon`, `StarIcon`,
  `CartIcon`, `ImagePlaceholderIcon`).

### `components/User/Home/Menu/CartDrawer.tsx`
Panel deslizable del **pedido** (bottom-sheet en mobile, modal centrado en desktop),
tematizado con los tokens `--t-*` del template activo.
- **`CartDrawer({open, onClose, businessName, waTargets, orderTexts, orderModes, hidePrices, onRequestClear})`**
  — lista las líneas
  del carrito (título, variante, stepper de cantidad, subtotal, quitar) con scroll
  interno propio (en pantallas bajas el listado scrollea en vez de empujar el total y
  el checkout fuera del viewport), muestra el total, y la **zona de acciones de
  checkout**: hoy el botón "Pedir por WhatsApp" (arma un mensaje por modalidad con
  `buildOrderChoices` y se los pasa a `WaTargetPicker`, igual que el resumen de
  escritorio `OrderSummary` de `UserMenu`; si el local no cargó teléfono muestra un
  aviso en su lugar) y "Vaciar pedido", que pide confirmación con `onRequestClear`. La zona está
  separada a propósito para que sumar un botón de pago con
  MercadoPago después sea un cambio aislado. Debe renderizarse dentro del contenedor
  `[data-template]` (hereda los tokens `--t-*` de ahí). Íconos: `CloseIcon`,
  `TrashIcon`, `WhatsAppIcon`.

### `components/User/Home/Menu/ClearCartDialog.tsx`
Confirmación de "Vaciar pedido" (23-09-2026) con el estilo de la carta, en lugar del
`window.confirm` del navegador. Se dibuja dentro de `.mp`, sin portal, para heredar
los tokens `--t-*` y la familia visual del local. Por eso la monta `UserMenu` al lado
del `CartDrawer`, y tanto el drawer como el resumen de escritorio solo piden abrirla.
El foco arranca en "Cancelar" (la opción segura) y al cerrar vuelve al botón que la
abrió; Escape cierra y Tab queda dentro del diálogo.

### `components/User/Home/WaTargetPicker/WaTargetPicker.tsx`
Botón de WhatsApp para pedidos y reservas (23-09-2026, "WhatsApp multisucursal").
Con un solo número, o sin sucursales cargadas, es el link directo de siempre. Con
varios, despliega debajo la lista de sucursales y el cliente elige a cuál escribir.
Sin números no dibuja nada. Recibe la clase del botón de cada pantalla (carta,
drawer, landing): no cambia cómo se ve el botón, solo lo que pasa al tocarlo.
Para los pedidos recibe `choices` (26-09-2026, un mensaje por modalidad, ver
`buildOrderChoices`) en lugar de `message`. Con más de una, el primer paso es
"¿Cómo querés recibir tu pedido?" (Delivery / Take away): con un solo número esa
opción ya es el link al chat; con varios, elegirla muestra las sucursales, con la
modalidad elegida arriba y "Cambiar" para volver. Cerrar el panel olvida la
elección. Con una sola modalidad es el comportamiento de siempre, con su mensaje.

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
  y la vista previa en vivo. La pill de modalidades (`orderModesLabel`) dice "Delivery
  y take away", "Delivery activo", "Take away activo" o "Sin delivery ni take away".
  Al volver con `?payment=success` reintenta `refreshUser`
  unos segundos por la posible carrera con el webhook. QR menu con portal. En el hero
  con la portada del local, el nombre va en un chip de vidrio esmerilado
  (`.heroContent`, 23-09-2026): fondo translúcido del color base del tema +
  `backdrop-filter`, y un velo solo en la franja de abajo, así la foto se ve casi
  entera y el texto se lee con cualquier imagen. Sin soporte de `backdrop-filter`
  el chip usa un fondo más opaco.
- **`SpotlightCard`** — card de navegación con el efecto spotlight.
- **`PreviewCard`** — vista previa en vivo de la carta pública en un iframe escalado
  (solo móvil). Usa un `ResizeObserver` para calcular el `scale`: por ancho
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
  controles de disponibilidad/oculto/recomendado. `editItem` ya persiste los tres
  booleanos y rechaza valores no booleanos; la cobertura automatizada no equivale a
  una prueba E2E del guardado.
- **Programación de productos**: "Programar oferta" y "Programar disponibilidad"
  van en la misma sección del formulario y usan `Common/WeeklySchedule` (horario
  una vez + días prendidos + excepciones por día) más `ScheduleDateRange` para el
  rango de fechas opcional. `validateWeekSchedule` valida lo que el dueño puede
  corregir sin esperar al servidor; las superposiciones las rechaza el backend.
- **Tablero (`Workspace/MenuWorkspace.tsx`, 22-09-2026)**: secciones y categorías se
  pueden **plegar**. Cada producto tiene "Duplicar" (`POST /items/:id/duplicate`).
  Ocultar una sección o categoría avisa que también oculta su contenido. La
  **selección múltiple** marca productos, categorías (casilla vacía, a medias o
  marcada) o secciones enteras, y ofrece ocultar/mostrar y eliminar en lote
  (`/items/bulk/*` y, con `limits.canBulkMenus`, `/menus/bulk/*`).
- **Ordenar arrastrando (`Reorder/`, 22-09-2026)**: con `limits.canReorder` aparecen
  manijas (`DragHandle`) para ordenar secciones, categorías y productos, y para
  moverlos de contenedor. Usa `@dnd-kit/core` y `@dnd-kit/sortable`.
  `menuReorder.ts` es la lógica pura (qué se arrastra, dónde puede caer y cómo queda
  el menú); `useMenuReorder.ts` aplica el cambio al instante (optimista) y guarda en
  segundo plano con `PATCH /items/reorder` o `/menus/reorder`, un pedido por vez y
  solo el último si hay varios en cola para el mismo contenedor. Si un guardado
  falla, avisa y recarga el menú. `MenuReorderProvider`/`reorderContext` y
  `useReorderSortable` conectan cada tarjeta. Incluye anuncios para lector de
  pantalla.

### `components/User/Panel/UserEditor/UserEditor.tsx`
"Mi negocio" (`/user/editor`). Tabs info / media / template.
- `TEMPLATES` (los 15 diseños implementados), `EMPTY_FORM`. Sub-componentes `Toggle` y
  `LockIcon`; el spinner inline viene de `Common/Spinner`.
- **`UserEditorPage`** — edita datos de contacto vigentes (sin reseñas), delivery / take away, galería
  (subida múltiple a Cloudinary con progreso, drag & drop) y **selección de template**
  con `features.templateIds`: candado y etiqueta del plan del catálogo que ofrece
  el diseño; `Common/UpgradeModal` se filtra por template requerido.
- **Delivery / Take away** (26-09-2026): sección con un toggle por modalidad
  (`hasDelivery`, `hasTakeAway`) y una nota (`orderModesHint`) que explica cómo le
  llega el pedido al local con esa combinación. Debajo, un campo de mensaje por
  modalidad activa (`ORDER_MESSAGE_FIELDS`: "Mensaje para pedidos con delivery" →
  `orderMessage`, "Mensaje para pedidos take away" → `takeAwayMessage`); apagar una
  modalidad oculta su campo pero no borra el texto. Reemplaza al campo único
  "Mensaje de pedido (WhatsApp)". Si el plan no incluye `pedido_whatsapp`, cada
  campo avisa que se va a usar cuando lo incluya.
- **WhatsApp por sucursal** (23-09-2026): filas nombre + número (hasta 10). Los
  números se muestran y se guardan normalizados (`normalizeArPhone`), las filas
  vacías se descartan, y con más de uno el nombre es obligatorio. Mismos topes que
  `parseWhatsappNumbers` en el backend.
- **Logo del favicon** (23-09-2026): valida el archivo (máximo 1 MB, igual que
  `FAVICON_MAX_BYTES` del backend) y lo convierte en el navegador a un PNG cuadrado
  de 256 px con el logo centrado sobre fondo transparente (`prepareFaviconFile`)
  antes de subirlo a `POST /users/upload-favicon`. Quitarlo es optimista
  (`DELETE /users/favicon`).
- **Horario de atención**: usa `Common/WeeklySchedule` con hasta 4 turnos por día
  ("+ Agregar otro turno", 25-09-2026). `scheduleToWeek`/`weekToSchedule` convierten
  entre `Schedule` y `WeekRanges`: un día con turnos queda con `ranges` y copia el
  primero en `open`/`close`. `normalizeSchedule` completa `ranges` al cargar para
  que `isDirty` no marque cambios falsos. Valida el formato de cada turno; las
  superposiciones las rechaza el backend con su mensaje.
- **`MenuStylePicker.tsx`** — elige la familia visual de la carta y la landing.
  Muestra un candado según `getMenuStyleFeature` (`menu_styles` o
  `premium_menu_styles`) y abre `UpgradeModal` filtrado por esa feature, con la
  etiqueta del plan que la ofrece según el catálogo. Los diseños premium
  (Neobrutalismo, Maximalismo táctil) llevan la etiqueta "Premium".

### `components/User/Panel/Settings/SettingsPanel.tsx`
Configuración del panel del dueño, protegida por una contraseña propia
(`/users/me/settings*`). Agrupa las opciones de la carta (`menuDisplay`), qué se
muestra en la landing (`landingVisibility`) y las del editor: "Generar códigos
automáticamente", "Deshabilitar eliminar en el editor de menú" y, desde el
22-09-2026, "Eliminar secciones y categorías con contenido"
(`panelSettings.deleteMenusWithContent`).

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

### `Utils/businessSchedule.ts`

Horario de atención del local (con tests en `test/businessSchedule.test.ts`).
- **`getDayRanges(day)`** — turnos de un día: `ranges` si vienen, o un único turno
  `open–close` para los horarios guardados antes de los turnos cortados; `[]` si el
  día está cerrado.
- **`getOpenStatus(schedule, now)`** — "abierto ahora" en horario de Buenos Aires, con
  la misma función que las ofertas (`isScheduleActiveAt` de `lib/offers.ts`): un
  turno que cruza la medianoche sigue abierto al día siguiente aunque ese día esté
  cerrado.
- **`getBusinessDayIndex`**, **`JS_DAY_TO_KEY`** y **`BUSINESS_TIME_PATTERN`** (HH:mm),
  que también usa `MenuEditor` para validar la programación de productos.

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
- **Texto sobre imagen**: `--admin-text-on-overlay`. Los velos que tapan una foto
  (`.tileOverlay`, `.imageUploadingOverlay`, `.overlayEdit`) son `rgba(0,0,0,·)`
  fijos a propósito, así que su texto tampoco se invierte con el tema: con
  `--admin-text-primary` quedaba casi negro sobre negro en tema claro.
- **Marca y navegación mobile**: `.md-brand-mark` y `.md-wordmark` (las dos
  piezas del logo con texto; el wordmark fija familia, peso, itálica y
  `text-transform` en sí mismo para no depender del orden del bundle frente a las
  clases del módulo que lo aloja), `.md-lockup` (lockup horizontal) y los tokens de
  geometría del wordmark que lo encajan contra el ícono, `.t-free-plan-ad*`,
  `.admin-mobile-dock` y sus clases compartidas; los dos shells usan el mismo dock
  responsive con espacio para safe area.
- **Componentes de template `.t-*`** (hero, header con avatar, badges, info-rows,
  galería bento, botones, cards, stats) que consumen los tokens `--t-*` — el layout de
  `UserHome` se arma con estas clases.
- **Estilo tonal** (23-09-2026, reemplazó al "liquid glass"): jerarquía por tono al
  estilo Material 3, controles en píldora y sin bordes grises ni sombras en los
  controles.
  - Sección ESCALA TONAL: `--tone-low` … `--tone-highest` (contenedores),
    `--tone-secondary`/`--tone-on-secondary`, `--tone-primary-container`,
    `--tone-indicator`, `--tone-float`/`--tone-shadow` y `--tone-outline`. Se
    recalcula en `:root`, en tema claro, en `.admin-panel-graphite` y en
    `[data-template]`.
  - Sección CONTROLES Y SUPERFICIES FLOTANTES: recetas `md-button` y `md-surface`
    (antes `md-glass-*`), con `--control-radius` 24px y `--control-shape`. La receta
    de botón usa **clase doble a propósito** (`.md-button.md-button`): los módulos
    cargan después y su regla base no debe ganarle en radio o sombra, aunque sus
    `:hover`/`.active` sí ganan.
  - Los estilos nuevos usan `--tone-*` y componen `md-button`/`md-surface`. Quedaron
    afuera a propósito el brillo ámbar de los CTA de la landing y las tarjetas con
    contorno de la portada del local. El chip del hero del dashboard es la única
    excepción con `backdrop-filter`, para leer texto sobre una foto.
- **Familias visuales de la carta y la landing**: bloques `[data-menu-style]` y
  `[data-menu-family]` que cambian tipografía, radios, proporción de imágenes y
  sombras (`--t-family-*`). **No traen colores propios**: todo sale de la paleta
  (`[data-template]`). Los **diseños premium** (25-09-2026) son
  `[data-menu-family="neo-brutalism"]` (Archivo Black + Space Grotesk, bordes y sombras
  sólidas con la "tinta" `--t-title`, títulos en mayúscula) y
  `[data-menu-family="tactile"]` (Bagel Fat One + Figtree + Instrument Serif,
  relieve con la base `--tx-base`). Como la tinta es `--t-title`, se invierten solos
  en las paletas oscuras. Sus fuentes se importan con las demás, pero el navegador
  solo las descarga si alguna carta las usa.
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
  ocultos se ven en el editor pero no en la carta pública. El orden de secciones,
  categorías y productos lo elige el dueño arrastrando (`order`, `utils/menuOrder.js`)
  y es el mismo en el editor, la carta, el PDF y el Excel. También puede duplicar
  productos y ocultar o eliminar en lote.
- **Carta pública**: visitante entra a `/:slug/menu` → `fetchUserWithMenu` arma el menú
  agrupado y ordenado, filtra ocultos y calcula la disponibilidad semanal en horario
  BA solo si `programacion_productos` está activa. Los no disponibles se muestran con
  "No disponible". Registra la visita (`trackView`).
- **Horario de atención**: el dueño lo carga en `UserEditor` con `WeeklySchedule`,
  con hasta 4 turnos por día para horarios cortados. `editUser` lo valida con
  `normalizeBusinessSchedule`. La landing lo muestra y calcula "Abierto/Cerrado ahora"
  con `getOpenStatus`, con las mismas reglas que las ofertas programadas.
  **Despliegue:** el backend con `ranges` tiene que salir antes que el front, porque
  un backend anterior descarta los turnos extra sin avisar.
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
  intervención ni valida el Git actual. El DTO, upgrade y renovación conservan el
  precio regular; solo el alta con `sellerID` usa `discountPrice`.

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
  (`lib/whatsapp.ts`) al número del local. Si el local ofrece delivery y take away,
  primero el cliente elige la modalidad; el mensaje arranca con ella y lleva el texto
  extra de esa modalidad. Si el local cargó varios WhatsApp
  (sucursales), el cliente elige a cuál mandarlo con `WaTargetPicker`; lo mismo
  pasa con las reservas de la landing. "Vaciar pedido" pide confirmación con
  `ClearCartDialog`. Es client-side, sin backend de pedidos:
  la UI y `CartProvider` siguen `features.pedido_whatsapp` recibido del servidor.
  Esto no impide contactar al teléfono público por fuera de MenuDigital.
  Agregar productos (simples y variantes, en la tarjeta y en el preview) exige
  además delivery o take away activo (26-09-2026; antes las variantes no miraban
  `hasDelivery`). No hay gestión persistida de pedidos y falta regresión del flujo
  completo.
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

### Estado operativo del flujo de suscripciones — 02-09-2026

- **Implementado y conectado en código**: recuperación del alta paga y sesión final;
  `PendingRegistration`, `PaymentCheckout`, `PaymentTransaction`, catálogo dinámico,
  consulta admin de pagos y referencias desde CRM/CEO. Vendedores/códigos también
  tienen modelos, rutas y UI conectados, pero el estado actual no es liberable.
- **Resultado actual**: `npm test` pasa **135/135**. La suite cubre la cotización con
  y sin vendedor, upgrade/renovación con precio regular, los flags de `editItem` y
  el alta con `sellerID` más siete días. Son pruebas locales con mocks donde aplica.
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
  localmente. El precio regular alimenta el DTO, landing, upgrade y renovación;
  `discountPrice` se reserva al alta que resuelve un `sellerID` válido.
- **PAY-05 localmente completo**: `PaymentCheckout` guarda la ventana inmutable de
  siete días; registro, upgrade y renovación usan esas fechas. Los retries válidos
  no actualizan MP y los inválidos crean otro snapshot conservando el anterior. La
  cobertura confirma acreditación de pagos aprobados tardíos y checkouts
  `superseded`. No usa TTL de auditoría.
- **Bloqueos de producción**: la plantilla PDF inserta `Item.image` sin validar ni
  escapar (inyección/SSRF en Chrome headless); el alta paga no exige
  `acceptedTerms === true` ni aplica el blocklist de contraseñas. `npm audit`
  reporta 8 vulnerabilidades frontend (7 altas, 1 moderada)
  y 4 de runtime backend (2 altas, 1 moderada, 1 baja).
- **Pendiente de verificación productiva**: después de corregir esos bloqueos,
  confirmar deploy Vercel/Koyeb y un pago real
  con comprador distinto del vendedor, verificando preferencia, metadata,
  `PaymentCheckout`, `PaymentTransaction`, webhook, cuenta/plan/vencimiento, CRM,
  redirección y sincronización del dashboard. También falta validar Cloudinary en
  su ambiente real.
- **Pendiente operativo**: Pagos ya permite inspeccionar transacciones `not_applied`,
  pero no conciliarlas mediante acciones ni devolver dinero. Falta definir ese
  procedimiento y la política frente a reembolsos/contracargos.

## Verificación y documentación relacionada

- Frontend: `npm run typecheck`, `npm run lint`, `npm run build` (los tres pasan al
  01-09-2026; no existe una suite automatizada frontend configurada).
- Backend: `npm test` (`node --test`) pasa 135/135. Los archivos de tests cubren admin, pagos admin,
  CRM, entorno, disponibilidad, edición de items, ofertas, rutas de pagos, webhook,
  credenciales pendientes, catálogo, slug y auth. Mocks no prueban Atlas, transacciones
  reales, configuración del proxy, Cloudinary ni Checkout Pro.
- Desarrollo: proxy `/api` en `vite.config.ts`; producción: rewrite de API y SPA en
  `vercel.json`. La aplicación mezcla URLs `/api` con `VITE_API_URL`; ambas deben
  apuntar al mismo backend. No imprimir secretos al diagnosticar.
- [README](README.md), [BLUEPRINT](BLUEPRINT.md) y
  [dev log backend](../../menu-digital-backend/DEVLOG-LUCAS.md).