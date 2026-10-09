import OrdersHistory from "../panel/OrdersHistory";
import DeliveryTabs from "./DeliveryTabs";

// Historial de envíos: no es un historial paralelo, es el historial general de
// pedidos filtrado a delivery, con el repartidor que entregó, las horas de
// retiro y entrega, la duración real y los responsables anteriores.
export default function DeliveryHistory() {
  return <OrdersHistory deliveryOnly tabs={<DeliveryTabs />} />;
}
