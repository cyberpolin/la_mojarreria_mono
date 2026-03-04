import { Context } from ".keystone/types";
import { sendMessageToOpenAI } from "../services/openaiService";
import { registerPolling, dispatchMessages } from "../services/pollingManager";
import { v4 as uuidv4 } from "uuid";
import { Request, Response } from "express";
import {
  FRIDAY_INSTRUCTIONS,
  MONDAY_INSTRUCTIONS,
  SATURDAY_INSTRUCTIONS,
  SUNDAY_INSTRUCTIONS,
  THURSDAY_INSTRUCTIONS,
  TUESDAY_INSTRUCTIONS,
  WEDNESDAY_INSTRUCTIONS,
} from "../constants";

const dayOfWeek = new Date().getDay(); // 0 (Domingo) a 6 (Sábado)
const weeklyInstructions = [
  SUNDAY_INSTRUCTIONS,
  MONDAY_INSTRUCTIONS,
  TUESDAY_INSTRUCTIONS,
  WEDNESDAY_INSTRUCTIONS,
  THURSDAY_INSTRUCTIONS,
  FRIDAY_INSTRUCTIONS,
  SATURDAY_INSTRUCTIONS,
];

// const botInstructions =  weeklyInstructions[dayOfWeek+1] || SUNDAY_INSTRUCTIONS
const botInstructions = `
Eres un vendedor de mojarras de un local llamado "La Mojarrería". Tu trabajo es responder preguntas sobre el menú, precios, promociones y horarios. Hablas con amabilidad y cercanía, utilizando frases como: "con todo gusto", "es un placer atenderle", "que lo disfrute".
Hoy por causas de fuerza mayor, no abrimos el día de hoy, y le pedimos que vuelva a contactarnos el Jueves, que es cuando abrimos de nuevo.
Los horarios de atención son de Jueves a Domingo, de 11:00 a 5:00 p.m.
Recuerda que los Miercoles y Jueves esta la mojarra a $130 pesos`;

export const getMessagesById = async (
  req: Request,
  res: Response,
  ctx: Context,
) => {
  const { chatSessionId } = req.params;

  try {
    const messages = await ctx.prisma.message.findMany({
      where: {
        chat: { id: chatSessionId },
      },
      orderBy: {
        createdAt: "asc", // Para mantener orden cronológico
      },
      include: {
        user: true, // Opcional, si quieres incluir info del usuario
      },
    });

    res.json(messages);
  } catch (error) {
    console.error("Error al obtener los mensajes:", error);
    res.status(500).json({ error: "Error al obtener los mensajes" });
  }
};

// POST /messages

export const createMessageMethod = async (
  { chatId, userId, content, internalId, sender },
  res,
  ctx,
) => {
  const { status } =
    (await ctx.prisma.chatSession.findFirst({
      where: { id: chatId },
    })) || {};

  if (status === "AGENT") {
    return await sendMessageAsAgent({
      id: chatId,
      sender,
      content,
      userId,
      internalId,
      res,
      ctx,
    });
  }
  // else
  return await sendMessageAsBot({
    id: chatId,
    sender,
    content,
    internalId,
    userId,
    res,
    ctx,
  });
};

export const createMessage = async (
  req: Request,
  res: Response,
  ctx: Context,
) => {
  const { chatId, userId, content, internalId, sender } = req.body;

  return await createMessageMethod(
    { chatId, userId, content, internalId, sender },
    res,
    ctx,
  );
};

//Messages polling
export const chatPollById = async (
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

  console.log(">>>", {
    id,
    content,
    userId,
    internalId,
    sender,
    res,
    ctx,
  });
  try {
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
  } catch (error) {
    console.log("error", error);
    res && res.status(404).end();
  }
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
      content: botInstructions,

      // `Eres un vendedor de mojarras de un local llamado "La Mojarrer\xEDa". Tu trabajo es responder preguntas sobre el men\xFA, precios, promociones y horarios. Hablas con amabilidad y cercan\xEDa, utilizando frases como: "con todo gusto", "es un placer atenderle", "que lo disfrute".
      //   Hoy es dia del padre, por lo que siendo una ociasion especial, no abrimos el dia de hoy, y le pedimos que vuelva a contactarnos el miercoles, que es cuando abrimos de nuevo.
      //   Los horarios de atenci\xF3n son de Miercoles a Domingo, de 11:00 a 5:00 p.m.
      // Si el cliente se comunica fuera de horario, le dices que estamos cerrados y que vuelva en horario de atenci\xF3n. O que si nos lo permite nosotros nos comunicaremos con el cuando estemos de vuelta.
      // Recuerda que es importante que nos guarde como contacto para que pueda recibir nuestras promociones y novedades.
      // Evita mandar emoticones relacionados con romances, amor o corazones, ya que no es un servicio de citas ni de relaciones personales.
      // Atiende a los clientes con profesionalismo y cercan\xEDa, pero sin caer en la informalidad excesiva.
      // `
    };
    // 4. Enviar a OpenAI
    const botReply = await sendMessageToOpenAI(content, [
      instructionMessage,
      ...contextMessages,
    ]);
    setTimeout(async () => {
      try {
        console.log("botReply", botReply);
        const content = JSON.parse(botReply).response_text;
        const internalId = uuidv4();
        // 5. Guarda la respuesta del bot
        console.log("internalId", internalId);
        console.log("content", content);

        const botR = await ctx.db.Message.createOne({
          data: {
            internalId,
            content,
            sender: "BOT",
            chat: { connect: { id } },
            ...(userId && { user: { connect: { id: userId } } }),
          },
        });
      } catch (error) {
        console.error("Error al guardar el mensaje del bot:", error);
      }
    }, 500);
    res && res.status(204).end();
  } catch (error) {
    console.error("Error al crear mensaje y responder con bot:", error);
    res && res.status(500).json({ error: "Error interno del servidor" });
  }
};
// helpers functions
