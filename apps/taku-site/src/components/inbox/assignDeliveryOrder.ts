import {
  createConversation,
  fetchConversation,
  sendConversationMessage,
} from "./api";
import { rememberDriverPhone } from "./drivers";
import { digitsPhone, isGroupConversation } from "./helpers";
import {
  customerAssignmentMessage,
  driverAssignmentMessage,
} from "./orderMessages";
import {
  addOrderToToday,
  assignLatestOrder,
  type DeliveryOrder,
} from "./pendingOrders";
import {
  SEND_CUSTOMER_ASSIGNMENT_MESSAGE,
  SEND_DRIVER_ASSIGNMENT_MESSAGE,
} from "./raiseOrder";
import type { InboxConversation } from "./types";

async function sendAndConfirm(conversationId: string, body: string) {
  const message = await sendConversationMessage(conversationId, body);
  if (message.status === "failed") {
    throw new Error("WhatsApp no pudo entregar el mensaje.");
  }
  return message;
}

async function openDirectChat(params: {
  phone: string;
  name?: string | null;
  whatsappAccountId?: string | null;
}) {
  const conversation = await createConversation({
    phoneNumber: params.phone,
    name: params.name ?? undefined,
    whatsappAccountId: params.whatsappAccountId ?? undefined,
  });
  if (isGroupConversation(conversation)) {
    throw new Error("No se pudo abrir un chat directo.");
  }
  return conversation;
}

async function resolveCustomerConversation(order: DeliveryOrder) {
  const phone = digitsPhone(order.customerPhone ?? "");
  const accountId = order.whatsappAccountId ?? undefined;

  if (phone) {
    return openDirectChat({
      phone,
      whatsappAccountId: accountId,
    });
  }

  if (order.customerConversationId) {
    const existing = await fetchConversation(order.customerConversationId);
    if (!isGroupConversation(existing)) {
      const existingPhone = digitsPhone(existing.contact?.phoneNumber ?? "");
      if (existingPhone) {
        return openDirectChat({
          phone: existingPhone,
          name: existing.contact?.name,
          whatsappAccountId: accountId ?? existing.whatsappAccount?.id,
        });
      }
      return existing;
    }
  }

  throw new Error("El pedido no tiene el telefono del cliente.");
}

async function sendDriverAssignment(order: DeliveryOrder, body: string) {
  const driverPhone = digitsPhone(order.assignedDriver?.phone ?? "");
  if (!driverPhone) {
    throw new Error("El pedido no tiene el telefono del repartidor.");
  }
  const conversation = await openDirectChat({
    phone: driverPhone,
    name: order.assignedDriver?.name,
    whatsappAccountId: order.whatsappAccountId,
  });
  await sendAndConfirm(conversation.id, body);
}

export async function sendAssignmentNotifications(order: DeliveryOrder) {
  const customerBody = customerAssignmentMessage(order);
  const driverBody = driverAssignmentMessage(order);

  if (SEND_CUSTOMER_ASSIGNMENT_MESSAGE) {
    const conversation = await resolveCustomerConversation(order);
    await sendAndConfirm(conversation.id, customerBody);
  }

  if (SEND_DRIVER_ASSIGNMENT_MESSAGE) {
    await sendDriverAssignment(order, driverBody);
  }

  return addOrderToToday(order.id) ?? order;
}

export async function completeOrderAssignment(params: {
  driverPhone: string;
  driverName?: string | null;
}) {
  const assigned = assignLatestOrder({
    phone: params.driverPhone,
    name: params.driverName,
  });
  if (assigned?.assignedDriver?.phone) {
    rememberDriverPhone(assigned.assignedDriver.phone);
  }
  if (!assigned) {
    return {
      ok: false as const,
      error: "No hay un pedido pendiente para asignar.",
      order: null,
    };
  }
  try {
    const listed = await sendAssignmentNotifications(assigned);
    return { ok: true as const, error: null, order: listed };
  } catch (caught) {
    return {
      ok: false as const,
      error:
        caught instanceof Error
          ? caught.message
          : "No se pudo avisar al cliente.",
      order: assigned,
    };
  }
}

export function customerFromConversation(
  conversation: InboxConversation | null,
  message: { senderPhone?: string | null } | null,
  fallbackPhone?: string | null,
) {
  if (conversation && !isGroupConversation(conversation)) {
    return {
      customerPhone: digitsPhone(
        conversation.contact?.phoneNumber ?? fallbackPhone ?? "",
      ),
      customerConversationId: conversation.id,
    };
  }
  return {
    customerPhone: digitsPhone(message?.senderPhone ?? fallbackPhone ?? ""),
    customerConversationId: null as string | null,
  };
}
