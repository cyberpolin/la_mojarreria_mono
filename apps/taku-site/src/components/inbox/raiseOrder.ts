export const DRIVERS_ORDER_MESSAGE = "Pedido por favor";
export const SEND_DRIVERS_ORDER_MESSAGE = true;
export const SEND_CUSTOMER_ASSIGNMENT_MESSAGE = true;
export const SEND_DRIVER_ASSIGNMENT_MESSAGE = false;
export const ESTIMATED_DELIVERY_MINUTES = 40;

export const DELIVERY_BASE = 40;
export const DELIVERY_INCLUDED_KM = 4;
export const DELIVERY_PER_KM = 10;
export const MOJARRA_PRICE = 150;
export const EMPANADA_PRICE = 100;

export type RaiseOrderDraft = {
  kilometers: number;
  mojarras: number;
  empanadas: number;
};

export type RaiseOrderTotals = RaiseOrderDraft & {
  extraKilometers: number;
  delivery: number;
  mojarraTotal: number;
  empanadaTotal: number;
  total: number;
};

export function extraDeliveryKilometers(kilometers: number) {
  return Math.max(0, kilometers - DELIVERY_INCLUDED_KM);
}

export function deliveryCost(kilometers: number) {
  return DELIVERY_BASE + extraDeliveryKilometers(kilometers) * DELIVERY_PER_KM;
}

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
  const extraKilometers = extraDeliveryKilometers(kilometers);
  const mojarras = Math.max(0, Math.floor(draft.mojarras));
  const empanadas = Math.max(0, Math.floor(draft.empanadas));
  const delivery = deliveryCost(kilometers);
  const mojarraTotal = mojarras * MOJARRA_PRICE;
  const empanadaTotal = empanadas * EMPANADA_PRICE;
  return {
    kilometers,
    extraKilometers,
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
