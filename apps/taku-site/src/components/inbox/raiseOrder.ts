export const DELIVERY_BASE = 40;
export const DELIVERY_PER_KM = 10;
export const MOJARRA_PRICE = 150;
export const EMPANADA_PRICE = 100;

export type RaiseOrderDraft = {
  kilometers: number;
  mojarras: number;
  empanadas: number;
};

export type RaiseOrderTotals = RaiseOrderDraft & {
  delivery: number;
  mojarraTotal: number;
  empanadaTotal: number;
  total: number;
};

export function parseNonNegativeNumber(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

export function parseQuantity(value: string) {
  return Math.floor(parseNonNegativeNumber(value));
}

export function raiseOrderTotals(draft: RaiseOrderDraft): RaiseOrderTotals {
  const kilometers = Math.max(0, draft.kilometers);
  const mojarras = Math.max(0, Math.floor(draft.mojarras));
  const empanadas = Math.max(0, Math.floor(draft.empanadas));
  const delivery = DELIVERY_BASE + kilometers * DELIVERY_PER_KM;
  const mojarraTotal = mojarras * MOJARRA_PRICE;
  const empanadaTotal = empanadas * EMPANADA_PRICE;
  return {
    kilometers,
    mojarras,
    empanadas,
    delivery,
    mojarraTotal,
    empanadaTotal,
    total: delivery + mojarraTotal + empanadaTotal,
  };
}

export function formatMxn(amount: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(amount);
}
