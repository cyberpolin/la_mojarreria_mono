import { Context } from ".keystone/types";
import { sendMessageToOpenAI } from "../services/openaiService";
import { registerPolling, dispatchMessages } from "../services/pollingManager";
import { UUIDTypes, v4 as uuidv4 } from "uuid";
import { registerPolling as orderPollingManager } from "../services/orderPollingManager";

import { Request, Response } from "express";

export async function findOrCreateClient(ctx, { phone, name }) {
  const existing = await ctx.prisma.user.findUnique({
    where: { phone },
  });

  if (existing) return existing;

  return await ctx.prisma.user.create({
    data: { name, phone },
  });
}

export const createOrder = async (
  req: Request,
  res: Response,
  ctx: Context,
) => {
  const {
    products,
    isDelivery,
    deliveryCost,
    deliveryTime,
    address,
    notes,
    client: { phone, name },
  } = req.body;
  console.log("arrived at createOrder", {
    products,
    isDelivery,
    deliveryCost,
    deliveryTime,
    address,
    notes,
    phone,
    name,
  });

  const client = await findOrCreateClient(ctx, { phone, name });

  if (!client) {
    res.status(400).json({ error: "Client not found or created" });
    return;
  }

  try {
    console.log(
      "products",
      products.map(({ id }: { id: UUIDTypes }) => ({ id })),
    );
    const order = await ctx.db.Order.createOne({
      data: {
        client: { connect: { id: client.id } },
        products: {
          connect: products.map(({ id }: { id: UUIDTypes }) => ({ id })),
        },
        isDelivery,
        deliveryCost,
        deliveryTime,
        address,
        notes,
      },
    });
    console.log("order", order);
    res.status(201).json(order);
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ error: "Error creating order" });
    return;
  }
};

//Messages polling
export const pollOrderById = async (
  req: Request,
  res: Response,
  ctx: Context,
) => {
  const { chatSessionId, listenerId } = req.params;
  if (!chatSessionId || !listenerId) {
    res.status(400).json({ error: "Missing chatSessionId or listenerId" });
    return;
  }
  registerPolling(chatSessionId, listenerId, res);
  console.log("pollOrderById", req.params);
};
//Messages polling

// helpers functions
const sendMessageAsAgent = async ({
  id,
  content,
  userId,
  internalId,
  sender,
  res,
  ctx,
}: {
  id: string;
  content: string;
  userId?: string;
  internalId?: string;
  sender: string;
  res: Response;
  ctx: Context;
}) => {
  // Implementar lógica para enviar mensaje como agente
  console.log("status: AGENT");

  await ctx.db.Message.createOne({
    data: {
      internalId,
      content,
      sender,
      chat: { connect: { id } },
      ...(userId && { user: { connect: { id: userId } } }),
    },
  });

  res && res.status(204).end();
};

const sendMessageAsBot = async ({
  id,
  content,
  userId,
  sender,
  internalId,
  res,
  ctx,
}: {
  id: string;
  content: string;
  sender: string;
  internalId?: string;
  userId: string;
  res: Response;
  ctx: Context;
}) => {
  console.log("status: BOT");
  // first add user message to db

  sendMessageAsAgent({
    id,
    sender,
    content,
    userId,
    internalId,
    res,
    ctx,
  });
  // this will send the message to the agent itself
  //Todo lo que sucede aqui es cuando no es agente, por tanto no contesta el bot

  try {
    //   // 1. Guarda el mensaje del usuario
    //   const userMessage = await ctx.prisma.message.create({
    //     data: {
    //       chat: {
    //         connect: { id },
    //       },
    //       user: {
    //         connect: { id: userId }, // Si deseas vincularlo explícitamente con el usuario
    //       },
    //       sender:
    //         'USER',
    //       content,
    //     },
    //   });

    // 2. Recupera el historial reciente (por ejemplo, últimos 10 mensajes)
    const recentMessages = await ctx.prisma.message.findMany({
      where: { chat: { id } },
      orderBy: { createdAt: "asc" },
      take: 15,
    });

    // 3. Arma el contexto como string
    const contextMessages = recentMessages.map((msg) => {
      const prefix =
        msg.sender === "BOT"
          ? "system"
          : msg.sender === "AGENT"
            ? "system"
            : "user";
      return { role: prefix, content: msg.content };
    });

    const instructionMessage = {
      role: "system",
      content: `
Eres un vendedor de mojarras de un local llamado "La Mojarrería".
Tu trabajo es responder preguntas sobre el menú, precios, promociones y horarios.
Hablas con amabilidad, cercanía , utilizas frases como: con todo gusto, es un placer atenderle, que lo disfrute.

Los productos actuales son:
{
  producto:Mojarra frita (grande): $150
  descripcion:Mojarra de 750gr (aprox), acompanada de ensalada, tortillas y una salsa picante de miedo
  foto:https://www.lamojarreria.com/img/mojarra-frita-la-mojarreria.png
}


Esta ubicado en Calle el Aguila 344, en Villahermosa Tabasco, y mandamos a domicilio desde 40 pesos el envio.

Responde como si estuvieras hablando con alguien en persona, y ofrece siempre a pedir su mojarra.
Si es alguien que ya a comprado agradece que nos permita atenderle de nuevo.

No ofrescas productos que no estan en el menu


Respuestas automáticas:
- Si te preguntan "¿aceptan tarjeta?", responde: "¡Sí! Aceptamos pagos con tarjeta y efectivo."
- Si preguntan por servicio a domicilio, responde: "Por ahora solo contamos con servicio para llevar."
- Si preguntan si abren entre semana, responde: "Solo abrimos de Miercoles a Domingo, de 11:00 a 5:00 p.m."

Usa estos formatos especificos cuando necesites enviar mensajes como:
-fotos
    [systemregexp]{url, description}

`,
    };
    // 4. Enviar a OpenAI
    const botReply = await sendMessageToOpenAI(content, [
      instructionMessage,
      ...contextMessages,
    ]);

    setTimeout(async () => {
      // 5. Guarda la respuesta del bot
      const botR = await ctx.db.Message.createOne({
        data: {
          internalId: uuidv4(),
          content: botReply,
          sender: "BOT",
          chat: { connect: { id } },
          ...(userId && { user: { connect: { id: userId } } }),
        },
      });
      console.log("botR", botR);
    }, 500);
    res.status(204).end();
  } catch (error) {
    console.error("Error al crear mensaje y responder con bot:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};
// helpers functions

export const pollingOrder = async (
  req: Request,
  res: Response,
  ctx: Context,
) => {
  const { listenerId } = req.params;
  if (!listenerId) {
    res.status(400).json({ error: "Missing listenerId" });
    return;
  }
  orderPollingManager(listenerId, res);
};
