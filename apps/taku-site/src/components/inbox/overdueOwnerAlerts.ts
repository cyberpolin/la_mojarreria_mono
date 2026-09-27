import { getWorkspaceSession } from "@/lib/taku-api";
import { createConversation, sendConversationMessage } from "./api";
import {
  assignmentRemainingMs,
  dueOwnerAlertSteps,
} from "./assignmentCountdown";
import { digitsPhone, isGroupConversation } from "./helpers";
import { ownerOverdueMessage } from "./orderMessages";
import {
  clearOwnerAlertSteps,
  listDeliveryOrders,
  orderStatus,
  recordOwnerAlertSteps,
  type DeliveryOrder,
} from "./pendingOrders";

export const OWNER_ALERT_PHONE = "9931175435";

const inFlight = new Set<string>();

function flightKey(orderId: string, step: number) {
  return `${orderId}:${step}`;
}

async function sendOwnerAlert(order: DeliveryOrder, body: string) {
  const conversation = await createConversation({
    phoneNumber: OWNER_ALERT_PHONE,
    name: "Dueno",
    whatsappAccountId: order.whatsappAccountId ?? undefined,
  });
  if (isGroupConversation(conversation)) {
    throw new Error("No se pudo abrir el chat del dueno.");
  }
  const message = await sendConversationMessage(conversation.id, body);
  if (message.status === "failed") {
    throw new Error("WhatsApp no pudo entregar la alerta.");
  }
}

export async function flushOverdueOwnerAlerts(now = Date.now()) {
  if (typeof window === "undefined") return;
  if (!getWorkspaceSession()) return;

  for (const order of listDeliveryOrders()) {
    if (orderStatus(order) !== "open") continue;
    const assignedAt = order.assignedDriver?.assignedAt;
    if (!assignedAt) continue;
    if (!digitsPhone(order.customerPhone ?? "")) continue;

    const remainingMs = assignmentRemainingMs(assignedAt, now);
    if (remainingMs == null) continue;

    const due = dueOwnerAlertSteps(remainingMs);
    if (due.length === 0) continue;

    const sent = new Set(order.ownerAlertStepsSent ?? []);
    const missing = due.filter((step) => !sent.has(step));
    if (missing.length === 0) continue;

    const locked = missing.filter((step) => {
      const key = flightKey(order.id, step);
      if (inFlight.has(key)) return false;
      inFlight.add(key);
      return true;
    });
    if (locked.length === 0) continue;

    recordOwnerAlertSteps(order.id, locked);
    const latest = locked[locked.length - 1];
    try {
      await sendOwnerAlert(order, ownerOverdueMessage(order, latest));
    } catch {
      clearOwnerAlertSteps(order.id, locked);
    } finally {
      for (const step of locked) {
        inFlight.delete(flightKey(order.id, step));
      }
    }
  }
}
