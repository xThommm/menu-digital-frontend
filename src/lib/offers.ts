import type { Item } from "../types";

export function isOfferActive(item: Item, now = Date.now()): boolean {
  if (item.offerPrice == null || item.price == null) return false;

  const from = item.offerRange?.from ? new Date(item.offerRange.from).getTime() : null;
  const to = item.offerRange?.to ? new Date(item.offerRange.to).getTime() : null;

  if (from !== null && Number.isFinite(from) && now < from) return false;
  // Las fechas cargadas desde Excel representan días completos; el final es inclusivo.
  if (to !== null && Number.isFinite(to) && now >= to + 24 * 60 * 60 * 1000) return false;
  return true;
}
