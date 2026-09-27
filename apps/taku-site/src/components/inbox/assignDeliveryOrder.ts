import { createConversation, sendConversationMessage } from "./api";
import { rememberDriverPhone } from "./drivers";
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

async function sendToPhone(params: {
  phone: string;
  body: string;
  name?: string | null;
  conversationId?: string | null;
  whatsappAccountId?: string | null;
}) {
  if (params.conversationId) {
    try {
      return await sendConversationMessage(params.conversationId, params.body);
    } catch {
      // Fall through and open/create the chat by phone.
    }
  }
  const conversation = await createConversation({
    phoneNumber: params.phone,
    name: params.name ?? undefined,
    whatsappAccountId: params.whatsappAccountId ?? undefined,
  });
  return sendConversationMessage(conversation.id, params.body);
}

export async function sendAssignmentNotifications(order: DeliveryOrder) {
  const accountId = order.whatsappAccountId ?? undefined;
  const customerPhone = order.customerPhone?.trim() ?? "";
  const driverPhone = order.assignedDriver?.phone?.trim() ?? "";

  if (SEND_CUSTOMER_ASSIGNMENT_MESSAGE) {
    if (!customerPhone) {
      throw new Error("El pedido no tiene el telefono del cliente.");
    }
    await sendToPhone({
      phone: customerPhone,
      body: customerAssignmentMessage(order),
      conversationId: order.customerConversationId,
      whatsappAccountId: accountId,
    });
  }

  if (SEND_DRIVER_ASSIGNMENT_MESSAGE) {
    if (!driverPhone) {
      throw new Error("El pedido no tiene el telefono del repartidor.");
    }
    await sendToPhone({
      phone: driverPhone,
      name: order.assignedDriver?.name,
      body: driverAssignmentMessage(order),
      whatsappAccountId: accountId,
    });
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
