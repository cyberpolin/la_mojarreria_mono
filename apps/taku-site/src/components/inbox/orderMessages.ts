import { orderNumber, type DeliveryOrder } from "./pendingOrders";
import { ESTIMATED_DELIVERY_MINUTES, formatMxn } from "./raiseOrder";

export function orderFoodTotal(
  order: Pick<DeliveryOrder, "mojarraTotal" | "empanadaTotal">,
) {
  return order.mojarraTotal + order.empanadaTotal;
}

export function driverAssignmentMessage(order: DeliveryOrder) {
  const customer = order.customerPhone?.trim() || "-";
  if (order.payment === "transferencia") {
    return [
      `Cliente : ${customer}`,
      `A pagar: ${formatMxn(0)}`,
      `A cobrar: ${formatMxn(order.delivery)}`,
    ].join("\n");
  }
  return [
    `Cliente : ${customer}`,
    `A pagar: ${formatMxn(orderFoodTotal(order))}`,
    `A cobrar: ${formatMxn(order.total)}`,
  ].join("\n");
}

export function ownerOverdueMessage(order: DeliveryOrder, stepMinutes: number) {
  const number = orderNumber(order.customerPhone) || "----";
  if (stepMinutes <= 0) {
    return `Pedido ${number} se vencio.`;
  }
  return `Pedido ${number} lleva ${stepMinutes} minutos de retraso.`;
}

export function customerAssignmentMessage(order: DeliveryOrder) {
  const driver = order.assignedDriver?.phone?.trim() || "-";
  return [
    `Repartidor: ${driver}`,
    `Total: ${formatMxn(order.total)}`,
    `Tiempo estimado : ${ESTIMATED_DELIVERY_MINUTES} minutos`,
  ].join("\n");
}
