import { useMemo, useState } from "react";
import { SERVICE_LABEL, SOURCE_LABEL } from "../../../../features/orders/lib/format";
import type { OrderSource, ServiceType } from "../../../../features/orders/types";
import DataTable from "../../../Common/DataTable/DataTable";
import s from "./UserStats.module.css";
import { BarList, DailyChart, Donut, Hero, HourBars, Ring } from "./StatsCharts";
import { buildSalesInsights, type SalesGroup, type SalesProduct, type SalesReport } from "./salesReport";
import {
  formatCompact, formatCompactMoney, formatDay, formatDayLong, formatDecimal, formatMoney, formatPercent, hourRange, plural,
} from "./statsFormat";

// Orden fijo: cada tipo conserva su color aunque cambie su lugar en el ranking.
const SERVICE_ORDER: ServiceType[] = ["table", "delivery", "takeaway", "counter"];
const SOURCE_ORDER: OrderSource[] = ["panel", "waiter", "customer"];
const TOP_PRODUCTS = 8;

const ordersLabel = (count: number) => `${count.toLocaleString("es-AR")} ${plural(count, "pedido", "pedidos")}`;
const unitsLabel = (count: number) => `${count.toLocaleString("es-AR")} u.`;

const inOrder = <K extends string>(groups: SalesGroup[], order: K[], label: Record<K, string>) =>
  order.map(key => ({ key, group: groups.find(group => group.key === key) }))
    .map(({ key, group }) => ({ key, label: label[key], value: group?.amount ?? 0, detail: ordersLabel(group?.count ?? 0) }));

export default function SalesView({ report, serviceType, onServiceType, pending }: {
  report: SalesReport;
  // Filtro por tipo de pedido; null = todos.
  serviceType: ServiceType | null;
  onServiceType: (value: ServiceType | null) => void;
  // true mientras llegan los datos del filtro recién elegido.
  pending: boolean;
}) {
  const [metric, setMetric] = useState<"amount" | "orders">("amount");
  const insights = useMemo(() => buildSalesInsights(report), [report]);
  const { totals, previousTotals, windowDays } = report;
  const byAmount = metric === "amount";
  const comparison = previousTotals.orders > 0;
  const namedWaiters = report.byWaiter.filter(group => group.key !== "");
  const online = report.byPayment.find(group => group.key === "mercadopago");
  const hasSales = totals.orders > 0;
  // Los rótulos salen del reporte en pantalla, que puede ser todavía el del filtro anterior.
  const shownService = (report.serviceType ?? null) as ServiceType | null;
  const filterLabel = shownService ? SERVICE_LABEL[shownService] : null;
  const categories = useMemo(
    () => [...new Set(report.topProducts.map(product => product.category || "Sin categoría"))].sort((a, b) => a.localeCompare(b, "es")),
    [report.topProducts],
  );
  const productsTotal = report.topProducts.reduce((sum, product) => sum + product.amount, 0);
  const toggleService = (key: string) => onServiceType(serviceType === key ? null : key as ServiceType);

  return (
    <>
      <fieldset className={`${s.filterBar} ${pending ? s.filterBarPending : ""}`}>
        <legend>Tipo de pedido</legend>
        <button type="button" aria-pressed={serviceType === null} onClick={() => onServiceType(null)}>Todos</button>
        {SERVICE_ORDER.map(key => (
          <button key={key} type="button" aria-pressed={serviceType === key} onClick={() => onServiceType(key)}>
            {SERVICE_LABEL[key]}
          </button>
        ))}
        {pending && <span className={s.filterStatus} role="status">Actualizando…</span>}
      </fieldset>

      <Hero
        label={`Vendido en ${windowDays} días completos${filterLabel ? ` · ${filterLabel}` : ""}`}
        value={formatMoney(totals.amount)}
        trend={insights.amountTrend}
        foot={comparison ? `${formatMoney(previousTotals.amount)} en el período anterior` : "Sin ventas en el período anterior para comparar"}
        series={report.days.map(day => day.amount)}
        stats={[
          { label: "Pedidos", value: totals.orders.toLocaleString("es-AR"), trend: insights.ordersTrend },
          { label: "Ticket promedio", value: formatMoney(totals.averageTicket), trend: insights.ticketTrend },
          { label: "Promedio por día", value: formatMoney(insights.dailyAverage) },
        ]}
        aside={(
          // "Hoy" contra un día promedio del período: el día está a medio
          // transcurrir, así que es una referencia y no una comparación.
          <Ring
            size="lg"
            value={insights.dailyAverage > 0 ? report.today.amount / insights.dailyAverage : 0}
            label={`Hoy: ${formatMoney(report.today.amount)} en ${ordersLabel(report.today.orders)}`}
          >
            <small>Hoy · {formatDay(report.todayDate)}</small>
            <strong>{formatMoney(report.today.amount)}</strong>
            <span>{ordersLabel(report.today.orders)}</span>
            {insights.dailyAverage > 0 && (
              <span>{formatPercent(report.today.amount / insights.dailyAverage)} de un día promedio</span>
            )}
          </Ring>
        )}
      />

      {!hasSales && (
        <div className={s.emptyCard}>
          <p className={s.emptyTitle}>No hubo ventas{filterLabel ? ` de ${filterLabel.toLowerCase()}` : ""} en este período</p>
          <p className={s.emptyDesc}>
            Acá aparecen los pedidos cargados en Gestión de pedidos: los de las mesas, los del mostrador,
            take away y delivery. Las ventas de hoy se muestran por separado.
          </p>
        </div>
      )}

      <section className={`${s.card} ${s.span8}`}>
        <div className={`${s.cardHead} ${s.cardHeadSplit}`}>
          <div>
            <p className={s.cardLabel}>{byAmount ? "Ventas por día" : "Pedidos por día"}</p>
            {insights.best && (
              <p className={s.cardNote}>
                Tu mejor día fue el <strong>{formatDayLong(insights.best.date)}</strong>, con{" "}
                {formatMoney(insights.best.amount)} en {ordersLabel(insights.best.orders)}
              </p>
            )}
          </div>
          <fieldset className={s.segmented}>
            <legend>Qué muestra el gráfico</legend>
            <button type="button" aria-pressed={byAmount} onClick={() => setMetric("amount")}>Importe</button>
            <button type="button" aria-pressed={!byAmount} onClick={() => setMetric("orders")}>Pedidos</button>
          </fieldset>
        </div>
        <DailyChart
          key={`${windowDays}-${metric}-${serviceType}`}
          days={report.days.map(day => ({ date: day.date, value: day[metric] }))}
          previousDays={comparison ? report.previousDays.map(day => ({ date: day.date, value: day[metric] })) : null}
          average={byAmount ? insights.dailyAverage : totals.orders / windowDays}
          format={byAmount ? formatMoney : formatDecimal}
          formatAxis={byAmount ? formatCompactMoney : formatCompact}
          noun={byAmount ? () => "" : count => plural(count, "pedido", "pedidos")}
          valueHeader={byAmount ? "Vendido" : "Pedidos"}
          detailLabel="Ver detalle de ventas por día"
        />
      </section>

      <section className={`${s.card} ${s.span4}`}>
        <div className={s.cardHead}>
          <p className={s.cardLabel}>Tipo de pedido</p>
          <p className={s.cardNote}>Dónde se sirvió lo vendido. Tocá uno para filtrar todo el panel.</p>
        </div>
        <Donut
          slices={inOrder(report.byServiceType, SERVICE_ORDER, SERVICE_LABEL)}
          format={formatMoney}
          centerLabel="vendido"
          selectedKey={serviceType}
          onSelect={toggleService}
          label="Importe vendido por tipo de pedido. El detalle está en la lista siguiente."
        />
      </section>

      {hasSales && (
        <>
          <section className={`${s.card} ${s.span4}`}>
            <div className={s.cardHead}>
              <p className={s.cardLabel}>Categorías</p>
              <p className={s.cardNote}>Importe de los productos vendidos de cada una</p>
            </div>
            <Donut
              slices={report.byCategory.map(category => ({
                key: category.name || "-",
                label: category.name || "Sin categoría",
                value: category.amount,
                detail: unitsLabel(category.quantity),
              }))}
              format={formatMoney}
              centerLabel="en productos"
              label="Importe vendido por categoría. El detalle está en la lista siguiente."
            />
          </section>

          <section className={`${s.card} ${s.span4}`}>
            <div className={s.cardHead}>
              <p className={s.cardLabel}>Quién cargó los pedidos</p>
              <p className={s.cardNote}>Importe según el origen de cada pedido</p>
            </div>
            <Donut
              slices={inOrder(report.bySource, SOURCE_ORDER, SOURCE_LABEL)}
              format={formatMoney}
              centerLabel="vendido"
              label="Importe vendido según quién cargó el pedido. El detalle está en la lista siguiente."
            />
          </section>

          <section className={`${s.card} ${s.span4}`}>
            <div className={s.cardHead}>
              <p className={s.cardLabel}>Horarios de venta</p>
              <p className={s.cardNote}>
                {insights.peak
                  ? <>El <strong>{formatPercent(insights.peak.share)}</strong> de los pedidos entra {hourRange(insights.peak.start, insights.peak.end)}.</>
                  : "Pedidos por hora del día, sumados en el período."}
              </p>
            </div>
            <HourBars
              values={report.hours.map(hour => hour.count)}
              peakStart={insights.peak?.start ?? null}
              format={ordersLabel}
              label="Pedidos por hora del día, sumados en el período"
            />
            {namedWaiters.length > 0 && (
              <>
                <p className={s.subLabel}>Operadores</p>
                <BarList
                  rows={namedWaiters.map(group => ({ key: group.key, label: group.key, value: group.amount, detail: ordersLabel(group.count) }))}
                  format={formatMoney}
                  total={totals.amount}
                />
              </>
            )}
          </section>

          <section className={`${s.card} ${s.span7}`}>
            <div className={s.cardHead}>
              <p className={s.cardLabel}>Productos más vendidos</p>
              <p className={s.cardNote}>Por unidades, con lo que facturó cada uno. La lista completa está más abajo.</p>
            </div>
            <BarList
              ranked
              rows={report.topProducts.slice(0, TOP_PRODUCTS).map(product => ({
                key: `${product.title}|${product.option ?? ""}`,
                label: product.title,
                hint: [product.option, product.category].filter(Boolean).join(" · ") || undefined,
                value: product.quantity,
                detail: formatMoney(product.amount),
              }))}
              format={unitsLabel}
            />
          </section>

          <section className={`${s.card} ${s.span5} ${s.cardAccent}`}>
            <div className={s.cardHead}>
              <p className={s.cardLabel}>Operación</p>
              <p className={s.cardNote}>Lo que no llegó a venderse y los tiempos del servicio</p>
            </div>
            <dl className={s.statList}>
              <Stat label="Anulados" value={formatMoney(totals.cancelledAmount)} foot={ordersLabel(totals.cancelledCount)} />
              <Stat label="Devueltos" value={formatMoney(totals.returnedAmount)} foot={ordersLabel(totals.returnedCount)} />
              {totals.discounts > 0 && (
                <Stat label="Descuentos" value={formatMoney(totals.discounts)} foot="en pedidos vendidos" />
              )}
              {report.averagePrepMinutes !== null && (
                <Stat label="Preparación" value={`${report.averagePrepMinutes} min`} foot="de confirmado a listo" />
              )}
              {report.averageServiceMinutes !== null && (
                <Stat label="Entrega" value={`${report.averageServiceMinutes} min`} foot="del pedido a la entrega" />
              )}
            </dl>
            {/* Una sola proporción (online contra el total): anillo y no donut. */}
            {online && (
              <div className={s.ringRow}>
                <Ring value={online.amount / totals.amount} label={`${formatPercent(online.amount / totals.amount)} del importe se pagó online`}>
                  <strong>{formatPercent(online.amount / totals.amount)}</strong>
                </Ring>
                <p>
                  <strong>Pagado online</strong>
                  {formatMoney(online.amount)} por Mercado Pago en {ordersLabel(online.count)}. El resto se cobró en el local.
                </p>
              </div>
            )}
          </section>

          <section className={`${s.card} ${s.cardWide}`}>
            <div className={s.cardHead}>
              <p className={s.cardLabel}>Todos los productos vendidos</p>
              <p className={s.cardNote}>
                {formatDay(report.periodStart)} al {formatDay(report.periodEnd)}
                {filterLabel && ` · Solo ${filterLabel.toLowerCase()}`} · Buscá un producto o filtrá por categoría
              </p>
            </div>
            <div className={s.tableWrap}>
              <DataTable<SalesProduct>
                caption="Productos vendidos en el período"
                rows={report.topProducts}
                getRowId={product => `${product.title}|${product.option ?? ""}`}
                defaultSort={{ columnId: "quantity", direction: "desc" }}
                search={{ accessor: product => `${product.title} ${product.option ?? ""}`, placeholder: "Buscar producto…", label: "Buscar producto" }}
                countLabel={(visible, total) => (visible === total ? `${total} productos` : `${visible} de ${total} productos`)}
                noResultsMessage="Ningún producto coincide con la búsqueda."
                minWidth={640}
                columns={[
                  { id: "title", header: "Producto", sortValue: row => row.title, render: row => row.title },
                  { id: "option", header: "Variante", sortValue: row => row.option ?? "", render: row => row.option || "—" },
                  {
                    id: "category", header: "Categoría", sortValue: row => row.category ?? "",
                    render: row => row.category || "Sin categoría",
                    filter: {
                      accessor: row => row.category || "Sin categoría",
                      options: categories.map(category => ({ value: category, label: category })),
                      label: "Categoría", placeholder: "Todas",
                    },
                  },
                  { id: "quantity", header: "Unidades", align: "right", initialDirection: "desc", sortValue: row => row.quantity, render: row => row.quantity.toLocaleString("es-AR") },
                  { id: "amount", header: "Importe", align: "right", initialDirection: "desc", sortValue: row => row.amount, render: row => formatMoney(row.amount) },
                  {
                    id: "share", header: "% del importe", align: "right", initialDirection: "desc", sortValue: row => row.amount,
                    render: row => (productsTotal > 0 ? formatPercent(row.amount / productsTotal) : "—"),
                  },
                ]}
              />
            </div>
          </section>
        </>
      )}

      <p className={s.measurementNote}>
        Las ventas son los pedidos de Gestión de pedidos que no están anulados ni devueltos, contados el día en
        que se cargaron (hora de Buenos Aires). Incluye pedidos todavía sin entregar.
      </p>
    </>
  );
}

function Stat({ label, value, foot }: { label: string; value: string; foot: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {value}
        <small>{foot}</small>
      </dd>
    </div>
  );
}
