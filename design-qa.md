# Design QA — Editor de menú, opción 3

Revisión documental: **30-08-2026**. Este archivo conserva un reporte visual del
29-08-2026; **no es una certificación del editor actual**. Se revisaron las rutas
de evidencia y el código, sin abrir una nueva sesión de navegador ni repetir
capturas, interacciones o pruebas de consola.

Las seis imágenes referenciadas existen en esta máquina, fuera del repositorio;
no viajan al clonar ni al desplegar. El resultado histórico `passed` no se traslada
al checkout actual, que presenta las diferencias detalladas al final.

## Evidencia histórica — 29-08-2026

- Fuente visual: `C:\Users\Thomas\.codex\generated_images\01a04dfd-743d-7111-8a10-9c5ea37e81ae\exec-e911eb7d-018d-40d7-9094-9b0c40a9e6c3.png`
- Captura del formulario: `C:\Users\Thomas\.codex\visualizations\2026\08\29\01a04dfd-743d-7111-8a10-9c5ea37e81ae\menu-editor-form-final-390.png`
- Captura de acciones y bottom bar: `C:\Users\Thomas\.codex\visualizations\2026\08\29\01a04dfd-743d-7111-8a10-9c5ea37e81ae\menu-editor-actions-final-390.png`
- Captura del buscador a 390 px: `C:\Users\Thomas\.codex\visualizations\2026\08\29\01a04dfd-743d-7111-8a10-9c5ea37e81ae\menu-editor-search-390.png`
- Captura responsive a 320 px: `C:\Users\Thomas\.codex\visualizations\2026\08\29\01a04dfd-743d-7111-8a10-9c5ea37e81ae\menu-editor-search-320.png`
- Comparación conjunta final: `C:\Users\Thomas\.codex\visualizations\2026\08\29\01a04dfd-743d-7111-8a10-9c5ea37e81ae\menu-editor-design-comparison-final.png`

## Normalización

- Viewport solicitado al navegador: 390 × 844 CSS px; breakpoint adicional: 320 × 700 CSS px.
- La captura de contenido del navegador integrado resultó de 375 × 812 px, con densidad efectiva 1:1.
- Fuente original: 853 × 1844 px. Para la comparación conjunta se normalizó a 375 × 812 px.
- Las capturas comparan el contenido de la aplicación sin marco de dispositivo ni chrome del navegador.
- Estado: tema oscuro, producto existente, sección principal abierta, secciones secundarias cerradas, acciones finales visibles y bottom bar activo en Menú.

## Comparación visual registrada en la prueba anterior

La comparación conjunta final conserva la dirección elegida: fondo negro, jerarquía crema/dorado, encabezado editorial, resumen del producto, formulario progresivo numerado, acciones de guardar/cancelar y navegación inferior intacta.

Se usaron dos regiones de implementación porque los controles táctiles accesibles de 48–52 px hacen que el formulario real sea más alto que el mock generado. La captura del formulario valida tipografía, orden, campos y uploader; la captura de acciones valida los acordeones, botones y la separación respecto del bottom bar.

### Superficies obligatorias

- Tipografía: serif para el título y la sección activa; sans para campos, estados y acciones. La jerarquía y los pesos se mantienen legibles a 320 px.
- Espaciado y ritmo: controles con objetivos táctiles de al menos 44 px, separación consistente y acciones alcanzables por scroll sin quedar debajo del dock.
- Colores y tokens: todos los estilos nuevos usan `--admin-*`; dorado para acción/foco, rojo semántico para peligro y estados existentes para disponible/pausado.
- Imágenes: no se agregó una imagen ficticia. El producto de prueba sin imagen muestra el uploader real; cuando un producto tiene imagen se usa su asset dinámico con vista previa y acciones separadas.
- Copy: etiquetas y ayudas en español, consistentes con el producto. Los resúmenes cerrados explican variantes, ofertas, disponibilidad y visibilidad.
- Iconos: se reutilizaron los iconos existentes del editor; no se incorporaron assets aproximados ni una dependencia nueva.

## Historial de iteraciones P0/P1/P2

### Iteración 1

- [P2] Los productos con variantes o estado especial abrían todas las secciones, perdiendo la progresión de la referencia.
  - Corrección reportada entonces: al editar se abre solo “Información y precio”; validaciones abren automáticamente la sección que requiere atención. El código actual volvió a abrir secciones según los datos del producto (ver revisión abajo).
- [P2] El orden inicial mostraba descripción e imagen antes de precio/código, distinto del flujo visible en la referencia.
  - Corrección reportada entonces: nombre → precio → código → imagen → descripción. Ese no es el orden actual del JSX.
- [P2] El texto secundario del buscador tenía poco contraste y el input mostraba dos acciones de limpieza.
  - Corrección: se usó `--admin-text-warm` y se ocultó el control nativo duplicado conservando el botón accesible “Limpiar”.

### Evidencia posterior

- La comparación `menu-editor-design-comparison-final.png` muestra las correcciones de orden, acordeones cerrados, jerarquía, acciones y dock.
- `menu-editor-search-390.png` y `menu-editor-search-320.png` confirman búsqueda, estado y adaptación responsive.
- El reporte anterior cerró sin hallazgos P0/P1/P2; esa conclusión se limita a la
  versión y a los datos de aquella prueba.

## Interacciones y accesibilidad reportadas en la prueba anterior

- Búsqueda por término parcial y texto de varias palabras sin distinguir mayúsculas
  ni tildes. El código actual busca una frase contigua, no palabras independientes.
- Resultado completo como botón y acceso directo a edición.
- Expandir/contraer secciones con `aria-expanded` y `aria-controls`.
- Indicador de cambios sin guardar y confirmación al cancelar o volver.
- Modal con foco inicial, roles y etiquetas visibles.
- Estados disponible/pausado, botón limpiar, botones de formulario y acciones de imagen.
- Layout a 390 px y 320 px; bottom bar no fue modificado y las acciones finales quedan por encima de su espacio reservado.
- Preferencia de movimiento reducido contemplada para las animaciones nuevas.
- Consola del navegador: 0 errores y 0 warnings durante la prueba.

## Diferencias aceptadas

- El mock contiene una foto ilustrativa; la implementación no inventa imágenes y usa la imagen real de cada producto.
- La implementación requiere más scroll que el mock porque mantiene objetivos táctiles accesibles de 44–52 px.
- La prueba visual usó datos locales temporales sobre el componente real; el fixture fue retirado del código final.

## Contraste con el código local — 30-08-2026

Fuentes: `src/components/User/Panel/MenuEditor/MenuEditor.tsx` y su CSS Module;
backend `src/controllers/itemController.js` y `test/itemController.test.js`.

| Aspecto | Estado comprobado por lectura/pruebas |
|---|---|
| Orden de campos | Nombre → descripción → imagen → precio → código; difiere de la corrección histórica |
| Apertura al editar | `openEditItem` abre promociones si hay oferta/variantes y disponibilidad si hay programación o flags especiales; no abre únicamente la primera sección |
| Búsqueda | `normalizeSearchValue` elimina tildes y normaliza mayúsculas; `includes` busca la frase completa en título, descripción, código, categoría y sección |
| Requisitos del formulario | Nombre, precio positivo y código obligatorios; el backend admite precio nulo, por lo que no debe prometerse alta “sin precio” desde esta UI |
| Guardado de estados | `saveItem` manda `available`/`hidden` por PUT, pero `editItem` no los incluye en su whitelist; fallan dos tests. Los PATCH específicos son un flujo distinto |
| Accesibilidad visual/interacciones | Atributos y handlers presentes no sustituyen una nueva prueba de foco, contraste, teclado, scroll y tamaños táctiles |

## Revalidación pendiente

- Repetir comparación a 390 × 844 y 320 × 700 con el componente actual y datos
  identificados, sin atribuirle capturas de otra revisión.
- Acordar si se mantiene el orden/apertura actual o la referencia histórica.
- Validar búsqueda de frases y resultados sin coincidencias.
- Tras resolver el contrato de guardado, cambiar disponible/oculto/recomendado,
  guardar y recargar para verificar persistencia real.
- Probar errores, imágenes, descarte de cambios, navegación, foco y dock con el
  backend correspondiente; la evidencia anterior usó un fixture local.

Validación técnica general actual: frontend lint/build pasan; typecheck falla en
`AdminPlans.tsx` (módulo distinto). Backend 93/95 tests pasan; los dos fallos están
relacionados con el guardado de estados indicado arriba. No se modificó código
durante esta revisión documental.

Resultado histórico: **passed**. Estado actual: **pendiente de revalidación**.

Contexto: [arquitectura](ARCHITECTURE.md) y [blueprint](BLUEPRINT.md).
