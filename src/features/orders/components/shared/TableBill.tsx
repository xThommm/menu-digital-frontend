import { formatMoney } from "../../lib/format";
import type { Order } from "../../types";
import p from "../panel/panel.module.css";

// Cuenta de una mesa: todos los productos de sus pedidos, agrupados, con el
// total. No suma lo cancelado ni lo devuelto. La usan el panel (Mesas) y el
// tomador del operador (Mis mesas) para cobrar.

interface BillLine {
  key: string;
  title: string;
  option: string | null;
  quantity: number;
  amount: number;
}

const BILLED = (order: Order) => order.status !== "cancelled" && order.status !== "returned";

function billLines(orders: Order[]): BillLine[] {
  const lines = new Map<string, BillLine>();
  for (const order of orders.filter(BILLED)) {
    for (const item of order.items) {
      const key = `${item.itemId}|${item.option ?? ""}|${item.unitPrice}`;
      const line = lines.get(key) ?? { key, title: item.title, option: item.option, quantity: 0, amount: 0 };
      line.quantity += item.quantity;
      line.amount += item.quantity * item.unitPrice;
      lines.set(key, line);
    }
  }
  return [...lines.values()];
}

export default function TableBill({ orders, total }: { orders: Order[]; total: number }) {
  const lines = billLines(orders);
  if (lines.length === 0) return <p className={p.switchHint}>Todavía no hay consumos.</p>;
  return (
    <div className={p.bill}>
      <ul className={p.billLines}>
        {lines.map(line => (
          <li key={line.key} className={p.billLine}>
            <span className={p.billQty}>{line.quantity}×</span>
            <span className={p.billTitle}>{line.title}{line.option && <em> · {line.option}</em>}</span>
            <span className={p.billAmount}>{formatMoney(line.amount)}</span>
          </li>
        ))}
      </ul>
      <div className={p.billTotal}>
        <span>Total</span>
        <strong>{formatMoney(total)}</strong>
      </div>
    </div>
  );
}
