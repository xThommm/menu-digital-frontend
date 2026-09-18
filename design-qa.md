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
