# MenuDigital — Resumen ejecutivo

**Actualizado:** 22 de agosto de 2026

## 1. Producto y propuesta

MenuDigital es un servicio online argentino para bares, cafeterías y restaurantes independientes. Permite administrar desde el celular:

- Menú o carta digital con código QR.
- Página pública propia con imágenes y medios de contacto.
- Productos, precios, variantes, ofertas y horarios.
- Carrito que prepara el pedido y lo envía por WhatsApp.
- Reseñas de Google, estadísticas y exportaciones según el plan.

La propuesta no es vender solamente una carta QR, sino ayudar al local a verse profesional, actualizar precios rápidamente y generar más pedidos.

El producto está en producción en **menudigitalapp.com.ar** y apunta a dueños de locales con poco tiempo y conocimientos técnicos.

## 2. Funcionalidades actuales

- Cuentas y suscripciones Gratis, Basic y Pro.
- Editor de menú, productos, imágenes, ofertas y disponibilidad.
- Carta y landing pública, 15 diseños y QR descargable.
- Carrito y pedidos por WhatsApp.
- Importación/exportación por Excel y exportación PDF.
- Estadísticas de visitas y productos más vistos.
- Integración con reseñas de Google.
- Cobro de suscripciones mediante MercadoPago.
- Panel interno con indicadores y CRM para clientes y seguimientos.

Actualmente el pedido por WhatsApp no se cobra dentro de MenuDigital: el carrito permanece en el dispositivo del comensal y sólo prepara el mensaje. MenuDigital no interviene en el pago ni almacena sus datos.

## 3. Modelo de ingresos

El modelo actual es **freemium por suscripción**, sin comisión sobre las ventas del local.

| Plan | Precio base | Características principales |
|---|---:|---|
| Gratis | $0 | Hasta 15 productos, menú, landing, QR y WhatsApp. Incluye publicidad de MenuDigital. |
| Basic | $39.999/mes | Hasta 50 productos, sin publicidad, Excel, PDF, ofertas programadas y 5 diseños. |
| Pro | $59.999/mes | Productos ilimitados, estadísticas, reseñas, 15 diseños y todo Basic. |

Descuentos aproximados por pago anticipado:

- 3 meses: 10%.
- 6 meses: 17%.
- 12 meses: 25%.

Los precios están en pesos argentinos y se revisan trimestralmente por inflación. Cada cambio debe actualizarse de forma coordinada para evitar diferencias entre el precio publicado y el cobrado.

**Pendiente comercial:** el dominio propio está anunciado dentro de Pro, pero todavía no está implementado.

## 4. Proyección económica actualizada

### Supuestos de referencia

- Mezcla estimada: 70% de clientes Basic y 30% Pro.
- Ingreso promedio de lista: **$45.999 mensuales por cliente pago**.
- Previsión promedio por descuentos de prepago: 10%.
- Ingreso promedio efectivo estimado: **$41.399 mensuales**.
- Valores expresados en pesos constantes de agosto de 2026.
- No incluyen comisiones, impuestos, devoluciones ni inflación futura.

| Escenario a 24 meses | Clientes pagos | Ingreso mensual | Ingreso anualizado |
|---|---:|---:|---:|
| Piso | 300 | $12,42 millones | $149,04 millones |
| Base | 600 | $24,84 millones | $298,07 millones |
| Techo | 900 | $37,26 millones | $447,11 millones |

Referencias adicionales:

- Con una baja mensual del 3%, la permanencia media estimada es de aproximadamente 33 meses.
- El ingreso bruto acumulado estimado por cliente sería cercano a **$1,38 millones**.
- Costo máximo orientativo de adquisición: un mes de ingreso promedio para canales asociados y hasta tres meses para publicidad paga.
- El resultado neto debe recalcularse con comisiones de MercadoPago, impuestos, devoluciones, soporte, infraestructura y tipo de cambio reales.
- Los costos tecnológicos estimados en USD deben convertirse mensualmente y compararse contra el margen de contribución, no contra la facturación bruta.

## 5. Funcionamiento de las suscripciones

- Gratis crea la cuenta inmediatamente.
- Basic y Pro envían al cliente al checkout de MercadoPago.
- La cuenta paga se crea o actualiza únicamente cuando MercadoPago confirma el pago.
- Se registran plan, período, aprobación y vencimiento.
- Se admiten períodos de 1, 3, 6 y 12 meses, renovaciones y mejoras de plan.
- Si la confirmación demora, el registro permanece pendiente y puede completarse más tarde.
- Las contraseñas temporales quedan cifradas y se eliminan al finalizar el alta.

El circuito cuenta con pruebas automatizadas. Para cerrarlo falta validar en producción el recorrido completo: pago, confirmación, usuario, plan, vencimiento, acceso al panel y registro en el CRM.

## 6. Operación, datos y seguridad

Servicios principales:

- **Vercel:** aplicación visible para usuarios y comensales.
- **Koyeb:** operaciones internas y reglas del negocio.
- **MongoDB Atlas:** base de datos.
- **Cloudinary:** almacenamiento de imágenes.
- **MercadoPago:** pagos.

Las funciones de cada plan se controlan en el servidor para impedir accesos no autorizados.

- Se guardan datos del local, menú, estadísticas y relación comercial.
- El CRM está separado y sólo es accesible para administración.
- Existen Términos, Política de Privacidad y registro de aceptación con fecha y versión.
- Hoy casi no se almacenan datos personales de comensales.
- Las contraseñas están protegidas y las credenciales temporales de pago se cifran.
- La base de datos provee copias de seguridad, pero falta formalizar y ensayar un procedimiento de restauración.

El cobro futuro de pedidos podría incorporar nombre, teléfono y pago del comensal. Se propone conservar esos datos durante 90 días y permitir su borrado, sujeto a revisión legal previa.

## 7. Indicadores principales

- Ingresos mensuales y anuales.
- Clientes pagos y mezcla Basic/Pro.
- Conversión de Gratis a pago: objetivo inicial de 5–8% a 30 días.
- Bajas mensuales: objetivo menor al 3%.
- Costo de adquisición.
- Locales pagos activos: objetivo mayor al 70%.
- Nuevos usuarios que publican 5 productos en 72 horas: objetivo mayor al 40%.
- Locales con al menos un pedido por WhatsApp por semana.

## 8. Próximas etapas

1. Completar y monitorear las suscripciones; mejorar medición y alta de nuevos locales.
2. Incorporar MercadoPago Connect para que cada local cobre pedidos en su cuenta y MenuDigital aplique un fee opcional estimado entre 1% y 3%.
3. Crear un panel de pedidos, implementar dominio propio para Pro y mejorar posicionamiento en buscadores.
4. Más adelante: roles para empleados, inteligencia artificial, reservas, fidelización y multi-sucursal.

El cobro de pedidos online es un cambio importante: MenuDigital pasaría de cobrar suscripciones propias a intervenir en operaciones comerciales de terceros. Antes de ofrecerlo de forma general se necesitan conciliación, controles adicionales y definiciones financieras y legales.

## 9. Definiciones financieras y legales prioritarias

1. Facturación de suscripciones y pagos anticipados.
2. Tratamiento impositivo de descuentos, renovaciones, devoluciones y contracargos.
3. Políticas de cancelación, reembolso y vencimiento.
4. Revisión de Términos, Privacidad y consentimiento.
5. Responsabilidades, facturación y tratamiento del futuro fee por pedidos.
6. Conciliación mensual entre MercadoPago, planes activos y facturación.
7. Actualización periódica del modelo financiero con precios, costos, impuestos y tipo de cambio reales.

## 10. Riesgos principales

- Inflación y desactualización de precios.
- Dependencia de MercadoPago y de una sola persona técnica.
- Falta de monitoreo y procedimientos formales ante incidentes.
- Abandono de clientes que no perciban resultados concretos.
- Riesgos adicionales al procesar pagos de terceros.
- Diferencia entre beneficios anunciados y funcionalidades pendientes, especialmente dominio propio.

## Síntesis

**MenuDigital es un producto comercial en producción que cobra suscripciones y ayuda a locales gastronómicos a digitalizar su venta. La siguiente etapa requiere consolidar la operación, medir resultados y ordenar el marco financiero y legal antes de procesar pedidos y dinero de terceros.**

---

Fuentes: `ARCHITECTURE.md` y `BLUEPRINT.md`. Documento interno de referencia; no reemplaza asesoramiento contable, impositivo o legal profesional.
