import { orderNumber, type DeliveryOrder } from "./pendingOrders";
import { ESTIMATED_DELIVERY_MINUTES, formatMxn } from "./raiseOrder";

export const DEFAULT_DRIVER_ASSIGNMENT_MESSAGE = [
  "Pedido: {noPedido}",
  "Cliente : {cliente}",
  "A pagar: {a_pagar}",
  "A cobrar: {a_cobrar}",
].join("\n");

export const DEFAULT_CUSTOMER_ASSIGNMENT_MESSAGE = [
  "Repartidor: {repartidor}",
  "Total: {total}",
  "Tiempo estimado : {tiempo} minutos",
].join("\n");

const TEMPLATE_TOKEN = /[{<]\s*([a-zA-Z0-9_]+)\s*[}>]/g;

export function orderFoodTotal(
  order: Pick<DeliveryOrder, "mojarraTotal" | "empanadaTotal">,
) {
  return order.mojarraTotal + order.empanadaTotal;
}

export function fillMessageTemplate(
  template: string,
  values: Record<string, string>,
) {
  return template.replace(TEMPLATE_TOKEN, (token, name: string) => {
    const key = name.toLowerCase();
    return key in values ? (values[key] ?? "") : token;
  });
}

export function assignmentTemplateValues(order: DeliveryOrder) {
  const transfer = order.payment === "transferencia";
  const food = orderFoodTotal(order);
  return {
    cliente: order.customerPhone?.trim() || "-",
    nopedido: orderNumber(order.customerPhone) || "-",
    repartidor: order.assignedDriver?.phone?.trim() || "-",
    nombre: order.assignedDriver?.name?.trim() || "",
    a_pagar: formatMxn(transfer ? 0 : food),
    a_cobrar: formatMxn(transfer ? order.delivery : order.total),
    envio: formatMxn(order.delivery),
    total: formatMxn(order.total),
    tiempo: String(ESTIMATED_DELIVERY_MINUTES),
    pago: transfer ? "Transferencia" : "Efectivo",
    mojarras: String(order.mojarras),
    empanadas: String(order.empanadas),
  };
}

export function driverAssignmentMessage(
  order: DeliveryOrder,
  template = DEFAULT_DRIVER_ASSIGNMENT_MESSAGE,
) {
  return fillMessageTemplate(template, assignmentTemplateValues(order));
}

export function ownerOverdueMessage(order: DeliveryOrder, stepMinutes: number) {
  const number = orderNumber(order.customerPhone) || "----";
  if (stepMinutes <= 0) {
    return `Pedido ${number} se vencio.`;
  }
  return `Pedido ${number} lleva ${stepMinutes} minutos de retraso.`;
}

export function customerAssignmentMessage(
  order: DeliveryOrder,
  template = DEFAULT_CUSTOMER_ASSIGNMENT_MESSAGE,
) {
  return fillMessageTemplate(template, assignmentTemplateValues(order));
}
