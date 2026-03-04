import { Context } from ".keystone/types";

// GET /chats
export const getAllChats = async (
  req: Request,
  res: Response,
  ctx: Context,
) => {
  try {
    const chats = await ctx.prisma.chatSession.findMany({
      include: {
        user: true,
        agent: true,
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
    res.json(chats);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener los chats" });
  }
};

// GET /chats
// export const getAllChats = async (req: Request, res: Response, ctx: Context) => {
//   try {
//     const chats = await ctx.prisma.chatSession.findMany({
//       include: {
//         user: true,
//         agent: true,
//         messages: { orderBy: { createdAt: 'asc' } },

//       },
//     });
//     res.json(chats);
//   } catch (err) {
//     res.status(500).json({ error: 'Error al obtener los chats' });
//   }
// };

//GET /chats/by-phone/:phone
import { Request, Response } from "express";

export const getOrcreateChatByPhone = async (phone: string, ctx: Context) => {
  try {
    // 1. Buscar o crear usuario
    let user = await ctx.prisma.user.findUnique({ where: { phone } });

    if (!user) {
      user = await ctx.prisma.user.create({
        data: {
          phone,
          name: "Usuario nuevo",
        },
      });
    }

    // 2. Buscar o crear chat activo con status 'BOT'
    let chat = await ctx.prisma.chatSession.findFirst({
      where: {
        userId: user.id,
      },
    });

    if (!chat) {
      chat = await ctx.prisma.chatSession.create({
        data: {
          userId: user.id,
          status: "BOT",
          messages: {
            create: {
              content:
                "¡Hola! Bienvenido al chat, en breve un agente te atenderá.",
              sender: "BOT",
              userId: user.id,
            },
          },
        },
        include: { messages: true },
      });
    }
    return {
      userId: user.id,
      chatSessionId: chat.id,
      firstTime: !chat,
    };
  } catch (error) {
    console.warn("chatController:getOrCreateChatByPhone:83 >>> ", error);
    return {
      userId: null,
      chatSessionId: null,
      firstTime: false,
    };
  }
};

export const getChatByPhone = async (
  req: Request,
  res: Response,
  ctx: Context,
) => {
  const { phone } = req.params;

  if (!phone) return res.status(400).json({ error: "Phone is required" });

  const chatSession = await getOrcreateChatByPhone(phone, ctx);

  if (chatSession) {
    res.json(chatSession);
  } else {
    res.status(500).json({ error: "Internal server error" });
  }
};

// GET /chats/:id
export const getChatById = async (
  req: Request,
  res: Response,
  ctx: Context,
) => {
  const { id } = req.params;
  try {
    const chat = await ctx.prisma.chatSession.findUnique({
      where: { id },
      include: {
        user: true,
        agent: true,
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!chat) return res.status(404).json({ error: "Chat no encontrado" });
    res.json(chat);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener el chat" });
  }
};

// POST /chats
export const createChat = async (req: Request, res: Response, ctx: Context) => {
  const { userId, agentId } = req.body;
  try {
    const chat = await ctx.prisma.chatSession.create({
      data: {
        userId,
        agentId,
        status: "ACTIVE",
      },
    });
    res.status(201).json(chat);
  } catch (err) {
    res.status(500).json({ error: "Error al crear el chat" });
  }
};

// PATCH /chats/:id
export const updateChatStatus = async (
  req: Request,
  res: Response,
  ctx: Context,
) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const chat = await ctx.prisma.chatSession.update({
      where: { id },
      data: { status },
    });
    res.json(chat.status);
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar el chat" });
  }
};
// router.patch('/rest/chats/toggle-status/:id', toggleChatStatus);
//   router.patch('/rest/chats/:id/status', getChatStatus);

// GET /chats/:id
export const getChatStatus = async (
  req: Request,
  res: Response,
  ctx: Context,
) => {
  const { id } = req.params;
  try {
    const chat = await ctx.prisma.chatSession.findUnique({
      where: { id },
    });
    res.json(chat?.status);
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar el chat" });
  }
};
// PATCH /chats/:id
export const toggleChatStatus = async (
  req: Request,
  res: Response,
  ctx: Context,
) => {
  const { id } = req.params;

  console.log("Toggling chat status for id:", id);
  try {
    const currentChat = await ctx.prisma.chatSession.findUnique({
      where: { id },
    });
    const chat = await ctx.prisma.chatSession.update({
      where: { id },
      data: { status: currentChat?.status === "AGENT" ? "BOT" : "AGENT" },
    });
    res.json(chat.status);
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar el chat" });
  }
};
