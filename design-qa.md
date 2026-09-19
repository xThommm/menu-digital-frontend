# Bistró y Apariencia unificada — 2026-09-18

final result: passed

## Alcance

Adaptación del estilo de la referencia a la carta real de MenuDigital: fotos circulares,
tarjetas redondeadas, dos columnas en móvil, categorías compactas y ficha de producto
con imagen protagonista. La referencia es inspiración, no una copia exacta de sus
pantallas ficticias. Se mantienen los productos, precios, variantes y carrito existentes.

En **Mi negocio → Apariencia** conviven **Diseño de carta** (Clásico/Bistró) y
**Paleta de colores** (los 15 templates existentes, sujetos al catálogo del plan).

## Fuente y evidencia

- Fuente visual: `C:/Users/Thomas/AppData/Local/Temp/codex-clipboard-7748a645-1d11-41ae-af99-6ae713d880a1.png`, 899 × 777 px. Contiene dos pantallas en perspectiva.
- Pinterest no respondió; se utilizó la imagen adjunta del usuario.
- Implementación: `http://127.0.0.1:5178/bistro-demo/menu`.
- Directorio de capturas: `C:/Users/Thomas/.codex/visualizations/2026/09/18/01a0b5a0-8913-7e02-b2a6-47d310714924/`.
- `bistro-menu-390.png`: carta Aurora, carrito con dos productos; captura 375 × 812 px.
- `bistro-product-390.png`: ficha abierta; captura 390 × 844 px.
- `bistro-dark-320.png`: paleta Clásico, captura 305 × 705 px.
- `bistro-desktop-1280.png`: carta con resumen de pedido, captura 1265 × 889 px.
- `appearance-mobile.png` y `appearance-desktop.png`: selección de diseño y paleta en la misma pestaña.
- `classic-mobile.png`: cuenta sin el campo nuevo, diseño original.
- Viewports solicitados al navegador: 390 × 844, 320 × 740 y 1280 × 900 CSS px.
  La captura del navegador interno recorta parte de la superficie y las barras de scroll;
  no se hizo normalización ni comparación píxel a píxel contra las pantallas en perspectiva.
- La referencia y las capturas de carta/ficha se abrieron juntas en una misma entrada
  de comparación. La ficha completa permitió revisar en detalle imagen, título, descripción y controles.

La demo usa respuestas HTTP locales en memoria, sin MongoDB ni escrituras en producción.
Las fotos de prueba son imágenes remotas de Protein Chefs; no se añadieron a los assets
del producto. La implementación usa exclusivamente `Item.image` de cada local.

## Superficies visuales revisadas

- **Tipografía:** DM Sans existente para Bistró, títulos con mayor peso y nombres largos
  con salto de línea. Clásico conserva su tipografía original.
- **Espaciado:** grilla de dos tarjetas a 320/390 px, imágenes circulares que sobresalen
  del borde superior y resumen lateral en escritorio. Sin desborde horizontal observado.
- **Colores:** todos los colores del diseño derivan de tokens `--t-*`; se probaron Aurora,
  Clásico oscuro y el guardado de Natural. No se recorrieron visualmente las 15 paletas.
- **Imágenes:** fotos reales del fixture, recorte circular, fallback para imagen ausente
  o fallida. No se generan ni inventan fotos de los productos del local.
- **Contenido:** español y ARS, categorías/productos reales del contrato. No se añadieron
  favoritos, perfiles, tiempos de preparación ni navegación ficticia de la referencia.

## Historial de revisión

1. Primera comparación móvil: composición general correcta. Se detectaron dos problemas
   de interacción en la ficha: abrir variantes requería un segundo clic y el foco quedaba
   detrás del diálogo. Clasificados P2.
2. Corrección: Bistró abre las opciones desplegadas; foco inicial dentro del diálogo,
   recorrido Tab contenido en sus botones y restauración al cerrar. Los productos no
   disponibles no presentan un botón de título activable con teclado.
3. Revisión posterior: apertura directa de variantes, Escape y retorno de foco a
   “Elegir opciones” comprobados en navegador. Capturas finales de carta/ficha comparadas
   nuevamente con la referencia. Sin P0/P1/P2 pendientes dentro del alcance.
4. Ajuste de destacados a tarjeta horizontal, coherente con la referencia; el carrusel
   comparte los productos existentes y respeta el toggle de destacados.

## Interacciones y validaciones

- Cambiar Clásico → Bistró, cambiar paleta y recargar conserva ambas selecciones en el fixture.
- Añadir producto simple y variante Individual: total esperado $24.000 y enlace `wa.me`
  con ambos productos. No se envió el mensaje.
- Abrir/cerrar ficha, navegar secciones, abrir categorías desplegables y ver destacados.
- Menú sin precios: no aparecen importes en tarjetas ni en la barra del pedido.
- Cuenta sin `menuStyle`: se mantiene Clásico.
- Consola del navegador consultada: sin errores ni advertencias en la revisión final.
- Frontend: `npm run typecheck`, `npm run build`, lint dirigido de los componentes de
  carta/ficha y selector, y 17 pruebas existentes de precios/carrito/WhatsApp, aprobados.
- Backend: suite completa `node --test --test-reporter=dot` aprobada. Incluye seis pruebas
  nuevas de modelo, guardado, validación de estilos, compatibilidad y gating de paletas.
- `git diff --check` aprobado en ambos repositorios.
- Lint general: bloqueado por dos diagnósticos `react-hooks/refs` sobre la lectura de
  `initialFormRef.current.businessName` durante render de UserEditor (línea 357).
  La misma expresión existe en HEAD antes de este cambio; no se modificó ese flujo.

## Integración y límites

- `User.menuStyle`: `classic | bistro`, default `classic`; no requiere migración masiva.
- `template` sigue representando la paleta y se valida contra `plan.features.templateIds`.
- `PATCH /api/users/template` recibe `{ template, menuStyle? }`; clientes anteriores que
  omiten el estilo no lo sobrescriben. El backend valida el enum y registra cambios en CRM.
- `GET /api/users/me` y `GET /api/users/:slug/menu` devuelven el estilo normalizado.
- Ambos diseños están disponibles con las paletas permitidas del plan; no se añadieron
  nuevas features al catálogo ni se cambiaron sus asignaciones.
- La página del local conserva su estructura y comparte la paleta; el PDF conserva su diseño.
- Para publicar, desplegar backend y frontend; preferir backend primero. Un backend anterior
  no confirma falsamente el guardado de Bistró en el frontend actualizado.
- Persistencia real en Atlas, deploy y E2E de producción pendientes. No se hizo commit ni push.

## Seguimiento opcional

Revisar con las fotos de un local real: las imágenes cuyo plato ya es circular se acercan
más a la referencia. La imagen cuadrada original permanece intacta; el recorte es solo CSS.

## Corrección de paletas compartidas — 2026-09-18

final result: passed

- Se detectó que Bistró reasignaba colores de títulos a precios y botones, además de
  cambiar fondos de tarjetas, encabezado, ficha y carrito. Usar tokens de la misma
  paleta no alcanzaba: cada diseño los aplicaba a elementos diferentes.
- Se retiraron esas sustituciones. Ambos diseños heredan las mismas reglas de color
  y estados; Bistró conserva distribución, tipografía, formas y sombras. El fondo
  degradado de la paleta también se aplica a Clásico. Los botones de agregar y el
  acceso al carrito utilizan `--t-btn-text` sobre `--t-accent`.
- Comparación en navegador de las 15 paletas: igualdad de color, fondo e imagen de
  fondo en 14 elementos representativos de ambos diseños (630 comparaciones).
  Incluye tarjetas comunes, recomendadas y no disponibles, precios, textos,
  categorías, pestañas, ofertas y botones.
- Ficha de producto y barra de carrito: colores iguales en las paletas 1 y 6,
  comprobados al abrir la ficha y agregar un producto.
- Comparación visual lado a lado aprobada con Aurora y la paleta oscura 1.
  Evidencia en el mismo directorio de capturas: `palette-comparison-aurora.png`,
  `palette-comparison-dark.png` y `palette-verification.json`. Comparador local:
  `http://127.0.0.1:5178/__palettes`; cada carta se muestra en un iframe de 390 px.
- `npm run typecheck`, `npm run build` y `git diff --check`: aprobados.
- Validación con el fixture local. Esta corrección modifica CSS del frontend;
  no requiere cambios de datos ni backend. Sin commit, push o despliegue de esta corrección.


## 2026-09-19 — Editores y botones liquid glass

- Referencia: [Liquid Glass Generator](https://design.dev/tools/liquid-glass-generator/?blur=22&sat=140&tint=%23ca6412&opacity=55&radius=24&hl=24&border=14&shadow=36&text=%23ffffff&sheen=55&scene=mono&format=css). Se adapta el acabado al coral de MenuDigital, sin copiar el naranja de la referencia.
- Receta compartida en globals.css: reflejo, borde interior, sombra suave, estados de foco/pulsación/deshabilitado, movimiento reducido y colores forzados. Integración explícita mediante CSS Modules (100 clases), además de los botones globales de carta y las acciones de importación. No se aplica un selector genérico a todos los botones, interruptores, filas o enlaces.
- Los fondos y la tinta siguen definidos por cada variante --admin-*, --auth-* o --t-*. La capa óptica no agrega saturación a los botones; evita alterar el color de marca. Las 15 definiciones de paleta y sus degradados premium se mantienen.
- MenuEditor y UserEditor: ancho máximo de 880px, cabeceras con vidrio, mejor contraste secundario, tarjetas y pestañas. El formulario de producto separa cancelar/guardar de eliminar; se completa el estilo de cancelBtn y dangerZone, ya referenciados por el TSX.
- Cascada revisada: la posición compartida del botón usa :where para respetar las posiciones absolutas/fijas de cada módulo; el reflejo ocupa ::after sin tapar el contenido ni interceptar clics. No se modificaron estilos del dock móvil ni su espacio reservado.

### Comprobación local

- Build, TypeScript, lint del TSX modificado (MassiveImport) y git diff --check: correctos.
- Lint global: dos diagnósticos previos de react-hooks/refs en UserEditor.tsx:357. El archivo TSX no se modificó.
- Navegador con componentes reales y datos simulados: editores, categorías desplegadas, formulario de producto, pestañas Información/Imágenes/Apariencia; temas claro y oscuro; anchos de 320, 390 y 1280px. Revisión visual y de foco, sin afirmar auditoría completa de accesibilidad.
- Carta pública: agregar al carrito funciona en la vista local. Verificación de fondo/tinta y capa óptica en las 15 paletas; sin desbordamiento horizontal en las vistas revisadas.
- Sin validación autenticada de producción, sin pagos, sin escrituras en backend, sin commit/push/deploy.

### Archivos de implementación

- src/Utils/MassiveImport.tsx
- src/components/Admin/Home/AdminHome.module.css
- src/components/Admin/Payments/AdminPayments.module.css
- src/components/Admin/Plans/AdminPlans.module.css
- src/components/Admin/Sellers/AdminSellers.module.css
- src/components/Common/DataTable/DataTable.module.css
- src/components/Common/ErrorBoundary.module.css
- src/components/Common/UpgradeModal.module.css
- src/components/Common/WeeklySchedule/WeeklySchedule.module.css
- src/components/Login/Login.module.css
- src/components/Register/Register.module.css
- src/components/Register/RegisterPlans.module.css
- src/components/Register/RegisterSuccess.module.css
- src/components/Register/VerifyEmail.module.css
- src/components/Seller/Crm/SellerCrm.module.css
- src/components/Seller/sellerPanel.module.css
- src/components/User/Home/Menu/CartDrawer.module.css
- src/components/User/Home/Menu/ItemPreviewModal.module.css
- src/components/User/Home/Menu/UserMenu.module.css
- src/components/User/Panel/Dashboard/UserDashboard.module.css
- src/components/User/Panel/DashboardLayout/DashboardLayout.module.css
- src/components/User/Panel/MenuEditor/ImageManager/ImageManager.module.css
- src/components/User/Panel/MenuEditor/MenuEditor.module.css
- src/components/User/Panel/MenuEditor/MenuTemplatePicker/MenuTemplatePicker.module.css
- src/components/User/Panel/Settings/SettingsPanel.module.css
- src/components/User/Panel/Stats/UserStats.module.css
- src/components/User/Panel/UserEditor/UserEditor.module.css
- src/pages/Blog/Blog.module.css
- src/pages/Legal/Legal.module.css
- src/styles/globals.css

## 2026-09-19 — Editor de menú en escritorio y vidrio en el resto de la app

final result: passed

### Alcance

Dos cambios sobre el commit anterior (`a783177`, «cambios de diseño en menu y user
editor»), que había introducido el acabado liquid glass en botones (clase global
`md-glass-button`) y en las cabeceras de los dos editores.

1. **Editor de menú, escritorio (≥1024px).** Deja de ser una columna centrada de
   880px donde el formulario reemplaza la lista. Ahora hay un espacio de trabajo
   con tres zonas: estructura del menú (desde 1280px), tablero de categorías y
   panel de edición. Debajo de 1024px no cambia nada: sigue el flujo móvil de una
   vista por vez.
2. **Liquid glass en el resto de la app.** Se agrega la receta de superficie
   (`md-glass-surface` en globals.css), hermana de la de botones, y se aplica a
   las superficies que flotan sobre el contenido. Se completa el acabado en los
   controles que habían quedado afuera.

### Espacio de trabajo (escritorio)

- **Estructura** (columna izquierda, sticky): secciones y categorías con su
  conteo. Al hacer clic lleva a la categoría; la actual se resalta con un
  observador de intersección. Es zona de drop: arrastrar un producto sobre una
  categoría lo mueve, igual que sobre el tablero.
- **Tablero** (centro): categorías con sus productos en filas de foto, nombre,
  descripción, etiquetas (variantes, programación, código), precio —con el
  original tachado si hay oferta— y estado. Cada fila abre el producto en el
  panel, con ojo para ocultar/mostrar y pastilla para activar/pausar.
  Filtros rápidos: Todos, Activos, Pausados, Ocultos, Sin foto, En oferta.
- **Panel** (derecha, sticky): el formulario de producto, categoría o sección,
  con guardar y cancelar siempre visibles abajo. Sin nada abierto muestra el
  resumen del menú (los mismos filtros como accesos), el enlace a la carta
  pública y los atajos.
- Atajos: `/` busca, `Ctrl/⌘ + S` guarda, `Esc` cierra el panel.
- Al crear productos, «Crear y seguir» guarda y deja listo el siguiente en la
  misma categoría. El producto guardado se resalta un momento en el tablero.
- Cambiar de producto con cambios sin guardar pide confirmación (el mismo modal
  de descarte que ya existía) y continúa con la acción pedida.
- Disponibilidad y visibilidad se sincronizan con el formulario abierto si es el
  mismo producto, así guardar después no revierte el cambio hecho en la fila.

### Liquid glass

- `md-glass-surface`: velo translúcido del color de la superficie, desenfoque del
  fondo, filo de luz arriba y sombra suave. El contorno va como anillo interior
  para no chocar con los bordes propios de cada módulo. Tono y sombra se ajustan
  por variables (`--md-glass-tint`, `--md-glass-border`, `--md-glass-shadow`,
  `--md-glass-opacity`), que se resuelven en el elemento y siguen el tema vigente
  (panel, grafito, auth o la paleta `--t-*` del local).
- Aplicado a: dock móvil y su menú «Más» (panel de usuario, CEO y vendedor),
  modales y hojas del editor de menú, modal de Mi negocio, modal de planes,
  confirmación del gestor de imágenes, barra de selección múltiple, avisos
  (toasts), cajón de CRM, y —con la paleta del local— el carrito y la ficha de
  producto de la carta pública.
- Botones: se completó el acabado en pasos de cantidad del carrito y de la ficha,
  quitar producto del pedido, visor de fotos de la landing, gestor de imágenes,
  selector de plantillas, cerrar aviso, CRM, reenviar código, toggle de tema
  móvil de la landing, ítem activo y toggle de las barras laterales de CEO y
  vendedor. Cobertura: 205 de 298 botones.
- Sin vidrio a propósito: interruptores, enlaces de texto, filas de listas y
  acordeones, tarjetas de contenido y botones que son una imagen (portada,
  avatar, galería). El vidrio marca controles, no contenido.

### Comprobación local

- `npm run typecheck`, `npm run build` y `npx eslint src`: correctos. Lint deja
  los dos diagnósticos previos de `react-hooks/refs` en UserEditor.tsx:357, que
  ya estaban antes de este cambio y no se tocaron.
- Navegador con datos simulados (servidor local en memoria, sin MongoDB ni
  producción): editor a 1440, 1280 y 390px, temas claro y oscuro; filtros,
  búsqueda, selección múltiple, alta de producto, edición de categoría, ir a una
  categoría desde la estructura, atajos de teclado y aviso de guardado.
- Carta pública, panel del dueño y dock móvil revisados con la paleta Aurora.
- No se revisaron: arrastrar y soltar con mouse real, las 15 paletas una por una,
  panel de CEO y de vendedor con datos, ni lectores de pantalla.
- Sin validación contra el backend real, sin pagos, sin escrituras en producción
  y sin commit, push ni deploy.
