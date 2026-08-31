import { useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { listAdminPlans, updateAdminPlan } from "../../../api/adminPlans";
import { isPlanFeatures, isPeriodMultipliers, type PlanDefinition, type PlanBillingOption } from "../../../api/plans";
import { useFeedbackMessage } from "../../../hooks/useFeedbackMessage";
import { PLANS_QUERY_KEY } from "../../../hooks/usePlans";
import { useNotifications } from "../../../context/useNotifications";
import { formatPaymentAmount, formatPaymentDate } from "../../../lib/adminPayments";
import { getPlanFeatureLabels, BOOLEAN_FEATURES, FEATURE_LABELS } from "../../../lib/plans";
import Spinner from "../../Common/Spinner";
import s from "./AdminPlans.module.css";

const ADMIN_PLANS_QUERY_KEY = ["admin-plans"] as const;

function parsePrice(value: string): number | null {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 100000000 ? parsed : null;
}

type PeriodDraft = Record<PlanBillingOption["months"], string>;

function readPeriodDraft(plan: PlanDefinition): PeriodDraft {
  return Object.fromEntries(plan.billingOptions.map(({ months }) => (
    [months, String(plan.periodMultipliers[months])]
  ))) as PeriodDraft;
}

function parseMultiplier(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export default function AdminPlans() {
  const queryClient = useQueryClient();
  const plans = useQuery({
    queryKey: ADMIN_PLANS_QUERY_KEY,
    queryFn: ({ signal }) => listAdminPlans(signal),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 0,
    gcTime: 0,
  });

  const replacePlan = (updated: PlanDefinition) => {
    queryClient.setQueryData<PlanDefinition[]>(ADMIN_PLANS_QUERY_KEY, (current) => (
      current?.map((plan) => plan.name === updated.name ? updated : plan)
    ));
    void queryClient.invalidateQueries({ queryKey: PLANS_QUERY_KEY });
  };

  return (
    <main className={s.page}>
      <div className={s.inner}>
        <header className={s.header}>
          <p className={s.eyebrow}>Administración de MenuDigital</p>
          <h1>Planes y precios</h1>
          <p>Gestioná precios, funciones, límites y diseños desde el catálogo de MongoDB.</p>
        </header>

        <aside className={s.notice}>
          <strong>Los cambios se publican al guardar cada plan.</strong>
          <p>Se aplican a nuevas contrataciones y renovaciones. Las compras y los checkouts ya creados conservan su importe original.</p>
          <p>Las funciones y límites se aplican a todos los usuarios del plan en su próxima consulta, incluidos los que ya pagaron. Reducir el límite no borra productos; impide agregar más cuando se supera.</p>
        </aside>

        {plans.isPending ? (
          <div className={s.loading}><Spinner size={28} label="Cargando planes" /></div>
        ) : plans.isError ? (
          <div className={s.error} role="alert">
            <p>No se pudieron cargar los planes. No se muestran precios de respaldo.</p>
            <button className={s.secondaryButton} onClick={() => void plans.refetch()} disabled={plans.isFetching}>
              {plans.isFetching ? "Reintentando…" : "Reintentar"}
            </button>
          </div>
        ) : plans.data.length === 0 ? (
          <div className={s.error} role="alert">No hay planes configurados. Revisá la inicialización del catálogo en el backend.</div>
        ) : (
          <section className={s.plans} aria-label="Catálogo de planes">
            {[...plans.data.filter((plan) => plan.name !== "free"), ...plans.data.filter((plan) => plan.name === "free")].map((plan) => (
              <PlanCard key={`${plan.name}-${plan.version}`} plan={plan} onUpdated={replacePlan} />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function PlanCard({ plan, onUpdated }: { plan: PlanDefinition; onUpdated: (plan: PlanDefinition) => void }) {
  const [label, setLabel] = useState(plan.label);
  const [description, setDescription] = useState(plan.description);
  const [features, setFeatures] = useState(() => structuredClone(plan.features));
  const [price, setPrice] = useState(String(plan.price));
  const [discountPrice, setDiscountPrice] = useState(plan.discountPrice === null ? "" : String(plan.discountPrice));
  const [periodMultipliers, setPeriodMultipliers] = useState(() => readPeriodDraft(plan));
  const [error, setError] = useFeedbackMessage("error");
  const [validationError, setValidationError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reloading, setReloading] = useState(false);
  const submitting = useRef(false);
  const notifications = useNotifications();
  const free = plan.name === "free";
  const parsedPrice = free ? 0 : parsePrice(price);
  const parsedDiscount = discountPrice.trim() ? parsePrice(discountPrice) : null;
  const parsedMultipliers = Object.fromEntries(plan.billingOptions.map(({ months }) => (
    [months, parseMultiplier(periodMultipliers[months])]
  ))) as Record<PlanBillingOption["months"], number | null>;
  const draftPrice = free ? 0 : parsedDiscount ?? parsedPrice;
  const invalidMultipliers = !isPeriodMultipliers(parsedMultipliers)
    || (!free && draftPrice !== null && Object.values(parsedMultipliers).some(multiplier => Math.round(draftPrice * multiplier) < 1));
  const invalidDraft = !label.trim() || label.trim().length > 60
    || !description.trim() || description.trim().length > 280 || !isPlanFeatures(features)
    || invalidMultipliers
    || parsedPrice === null
    || (discountPrice.trim() !== "" && parsedDiscount === null)
    || (parsedDiscount !== null && parsedPrice !== null && parsedDiscount >= parsedPrice);
  const dirty = parsedPrice !== plan.price || parsedDiscount !== plan.discountPrice || invalidDraft
    || label !== plan.label || description !== plan.description
    || JSON.stringify(features) !== JSON.stringify(plan.features)
    || plan.billingOptions.some(({ months }) => parsedMultipliers[months] !== plan.periodMultipliers[months]);
  const busy = saving || reloading;
  const errorID = `${plan.name}-price-error`;
  const hintID = `${plan.name}-price-hint`;
  const periodsHintID = `${plan.name}-periods-hint`;
  const limits = `${plan.features.item_limit === null ? "Productos ilimitados" : `Hasta ${plan.features.item_limit} productos`} · ${plan.features.templateIds.length} ${plan.features.templateIds.length === 1 ? "plantilla" : "plantillas"}`;
  const featureLabels = getPlanFeatureLabels(plan.features);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current || !dirty || conflict) return;
    if (invalidDraft || parsedPrice === null || !isPeriodMultipliers(parsedMultipliers)) {
      setValidationError(invalidMultipliers
        ? "Revisá los multiplicadores: 1 mes debe valer 1; los demás deben ser mayores a cero y no superar la cantidad de meses. Cada período pago debe costar al menos un peso."
        : "Revisá los textos, precios, límite positivo o ilimitado y al menos un diseño. El promocional debe ser menor al regular, o quedar vacío.");
      return;
    }
    submitting.current = true;
    setSaving(true);
    setError("");
    setValidationError("");
    try {
      const updated = await updateAdminPlan(plan.name, {
        version: plan.version,
        label, description, features,
        price: parsedPrice,
        discountPrice: parsedDiscount,
        periodMultipliers: parsedMultipliers,
      });
      notifications.success(`Plan ${plan.label} actualizado.`);
      onUpdated(updated);
    } catch (cause) {
      if (isAxiosError(cause) && cause.response?.status === 409) {
        setConflict(true);
        setError("Este plan cambió desde que abriste el módulo. Tu edición se conserva; cargá la versión vigente antes de volver a editar.");
      } else {
        const serverMessage = isAxiosError<{ message?: string }>(cause) ? cause.response?.data?.message : null;
        setError(serverMessage || "No se pudo confirmar el guardado. Tu edición se conserva; intentá nuevamente.");
      }
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  const reloadPlan = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setReloading(true);
    try {
      const current = (await listAdminPlans()).find((item) => item.name === plan.name);
      if (!current) throw new Error("Plan no encontrado");
      setLabel(current.label);
      setDescription(current.description);
      setFeatures(structuredClone(current.features));
      setPrice(String(current.price));
      setDiscountPrice(current.discountPrice === null ? "" : String(current.discountPrice));
      setPeriodMultipliers(readPeriodDraft(current));
      setConflict(false);
      setError("");
      setValidationError("");
      onUpdated(current);
    } catch {
      setError("No se pudo cargar la versión vigente. Tu edición se conserva.");
    } finally {
      submitting.current = false;
      setReloading(false);
    }
  };

  const resetDraft = () => {
    setLabel(plan.label);
    setDescription(plan.description);
    setFeatures(structuredClone(plan.features));
    setPrice(String(plan.price));
    setDiscountPrice(plan.discountPrice === null ? "" : String(plan.discountPrice));
    setPeriodMultipliers(readPeriodDraft(plan));
    setValidationError("");
    setError("");
  };

  return (
    <article className={`${s.card}${free ? ` ${s.freeCard}` : ""}`} aria-labelledby={`${plan.name}-title`}>
      <header className={s.cardHeader}>
        <div>
          <p className={s.eyebrow}>{plan.name}</p>
          <h2 id={`${plan.name}-title`}>{plan.label}</h2>
        </div>
        <span className={dirty ? s.unsaved : s.status}>{dirty ? "Sin guardar" : free ? "Siempre gratis" : "Publicado"}</span>
      </header>
      {free ? (
        <p className={s.freeSummary}>{formatPaymentAmount(0, plan.currency)} ARS · {limits}</p>
      ) : <>
        <p className={s.description}>{plan.description}</p>
        <p className={s.currentPrice}>
          {formatPaymentAmount(plan.effectivePrice, plan.currency)} <span>ARS / mes vigente</span>
        </p>
      </>}

      {
        <form className={s.priceForm} onSubmit={submit} noValidate>
          <div className={s.fields}>
            <label htmlFor={`${plan.name}-label`}>Nombre visible
              <input id={`${plan.name}-label`} value={label} maxLength={60} disabled={busy} onChange={event => setLabel(event.target.value)} />
            </label>
            <label htmlFor={`${plan.name}-description`}>Descripción
              <input id={`${plan.name}-description`} value={description} maxLength={280} disabled={busy} onChange={event => setDescription(event.target.value)} />
            </label>
            <label htmlFor={`${plan.name}-price`}>
              Precio regular mensual (ARS)
              <input id={`${plan.name}-price`} type="text" inputMode="numeric" value={price}
                disabled={busy || free} aria-describedby={`${hintID}${validationError ? ` ${errorID}` : ""}`}
                aria-invalid={validationError ? true : undefined}
                onChange={(event) => { setPrice(event.target.value); setValidationError(""); }} />
            </label>
            <label htmlFor={`${plan.name}-discount`}>
              Precio promocional mensual (ARS)
              <input id={`${plan.name}-discount`} type="text" inputMode="numeric" value={discountPrice}
                disabled={busy || free} placeholder="Sin promoción" aria-describedby={`${hintID}${validationError ? ` ${errorID}` : ""}`}
                aria-invalid={validationError ? true : undefined}
                onChange={(event) => { setDiscountPrice(event.target.value); setValidationError(""); }} />
            </label>
          </div>
          <p className={s.hint} id={hintID}>Pesos enteros, sin separadores de miles. Dejá el promocional vacío para quitar la promoción.</p>
          <fieldset className={s.featureFields} disabled={busy}>
            <legend>Multiplicadores por período</legend>
            <div className={s.fields}>
              {plan.billingOptions.map(({ months }) => (
                <label key={months} htmlFor={`${plan.name}-multiplier-${months}`}>
                  {months} {months === 1 ? "mes" : "meses"}
                  <input id={`${plan.name}-multiplier-${months}`} type="text" inputMode="decimal"
                    value={periodMultipliers[months]} disabled={months === 1}
                    aria-describedby={`${periodsHintID}${validationError ? ` ${errorID}` : ""}`}
                    aria-invalid={validationError && invalidMultipliers ? true : undefined}
                    onChange={event => { setPeriodMultipliers(current => ({ ...current, [months]: event.target.value })); setValidationError(""); }} />
                </label>
              ))}
            </div>
            <p className={s.hint} id={periodsHintID}>Total = precio mensual vigente × multiplicador. Un mes conserva el valor 1; para cambiarlo, editá el precio mensual. Los otros valores admiten coma o punto decimal y no pueden superar la cantidad de meses.</p>
          </fieldset>
          <fieldset className={s.featureFields} disabled={busy}>
            <legend>Funciones incluidas</legend>
            {BOOLEAN_FEATURES.map(feature => <label key={feature}>
              <input type="checkbox" checked={features[feature]} onChange={event => setFeatures(current => ({ ...current, [feature]: event.target.checked }))} />
              {FEATURE_LABELS[feature]}
            </label>)}
          </fieldset>
          <fieldset className={s.featureFields} disabled={busy}>
            <legend>Límite de productos</legend>
            <label><input type="checkbox" checked={features.item_limit === null} onChange={event => setFeatures(current => ({ ...current, item_limit: event.target.checked ? null : plan.features.item_limit ?? 1 }))} />Productos ilimitados</label>
            {features.item_limit !== null && <div className={s.fields}><label htmlFor={`${plan.name}-limit`}>Cantidad máxima
              <input id={`${plan.name}-limit`} type="number" min="1" step="1" value={features.item_limit} onChange={event => setFeatures(current => ({ ...current, item_limit: Number(event.target.value) }))} />
            </label></div>}
          </fieldset>
          <fieldset className={s.featureFields} disabled={busy}>
            <legend>Diseños disponibles</legend>
            <p className={s.hint}>Elegí al menos uno. Si quitás un diseño en uso, se mostrará el primer diseño permitido sin borrar la selección guardada.</p>
            <div className={s.templateFields}>{Array.from({ length: 15 }, (_, i) => i + 1).map(id => <label key={id}>
              <input type="checkbox" checked={features.templateIds.includes(id)} onChange={event => setFeatures(current => ({ ...current, templateIds: event.target.checked ? [...current.templateIds, id].sort((a,b) => a-b) : current.templateIds.filter(template => template !== id) }))} />Diseño {id}
            </label>)}</div>
          </fieldset>
          {validationError && <p className={s.error} id={errorID} role="alert">{validationError}</p>}
          {error && <div className={s.error} role="alert">
            <p>{error}</p>
            {conflict && <button className={s.secondaryButton} type="button" disabled={busy} onClick={() => void reloadPlan()}>
              {reloading ? "Cargando…" : "Descartar edición y cargar versión vigente"}
            </button>}
          </div>}

          <div className={s.preview}>
            <h3>{dirty ? "Vista previa · sin guardar" : "Totales publicados"}</h3>
            {invalidDraft || draftPrice === null || parsedPrice === null ? (
              <p className={s.hint}>Completá precios y multiplicadores válidos para ver los totales por período.</p>
            ) : (
              <div className={s.tableScroll}>
                <table>
                  <caption className={s.tableCaption}>Pago único en ARS por período de {plan.label}</caption>
                  <thead><tr><th scope="col">Período</th><th scope="col">Total a cobrar</th><th scope="col">Ahorro total</th></tr></thead>
                  <tbody>{plan.billingOptions.map((option) => {
                    const total = dirty ? Math.round(draftPrice * parsedMultipliers[option.months]!) : option.total;
                    const savings = dirty ? parsedPrice * option.months - total : option.savings;
                    return <tr key={option.months}>
                      <th scope="row">{option.months} {option.months === 1 ? "mes" : "meses"}</th>
                      <td>{formatPaymentAmount(total, plan.currency)}</td>
                      <td>{formatPaymentAmount(savings, plan.currency)}</td>
                    </tr>;
                  })}</tbody>
                </table>
              </div>
            )}
            <p className={s.hint}>El descuento por período se aplica sobre el promocional, si existe. El ahorro compara contra el precio regular × meses. Sin renovación automática.</p>
          </div>

          <div className={s.actions}>
            <button className={s.primaryButton} type="submit" disabled={busy || !dirty || conflict}>
              {saving && <Spinner />} {saving ? "Guardando…" : `Guardar ${plan.label}`}
            </button>
            <button className={s.secondaryButton} type="button" onClick={resetDraft} disabled={busy || !dirty || conflict}>Deshacer edición</button>
          </div>
        </form>
      }

      {free ? (
        <details className={s.freeBenefits}>
          <summary>Ver beneficios del plan gratuito</summary>
          <ul>{featureLabels.map((label) => <li key={label}>{label}</li>)}</ul>
        </details>
      ) : <>
        <section className={s.benefits} aria-label={`Beneficios de ${plan.label}`}>
          <h3>Incluido en el plan</h3>
          <p>{limits}</p>
          <ul>{featureLabels.map((label) => <li key={label}>{label}</li>)}</ul>
        </section>
        <footer className={s.updated}>Versión {plan.version} · Actualizado {formatPaymentDate(plan.updatedAt)}</footer>
      </>}
    </article>
  );
}
