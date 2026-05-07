import { Request, Response } from "express";
import { Context } from ".keystone/types";

// GET /users
export const getAllUsers = async (
  req: Request,
  res: Response,
  ctx: Context,
) => {
  try {
    const users = await ctx.prisma.user.findMany();
    console.log(Object.keys(ctx));
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener usuarios" });
  }
};

// GET /users/:id
export const getUserById = async (
  req: Request,
  res: Response,
  ctx: Context,
) => {
  const { id } = req.params;
  try {
    const user = await ctx.prisma.user.findUnique({ where: { id: id } });
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener usuario" });
  }
};

// GET /users/:id/orders
export const getUserOrders = async (
  req: Request,
  res: Response,
  ctx: Context,
) => {
  const { id } = req.params;
  try {
    const orders = await ctx.prisma.order.findMany({ where: { userId: id } });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener pedidos del usuario" });
  }
};

// GET /users/:id/chats
export const getUserChats = async (
  req: Request,
  res: Response,
  ctx: Context,
) => {
  const { id } = req.params;
  try {
    const chats = await ctx.prisma.chat.findMany({
      where: { userId: parseInt(id) },
    });
    res.json(chats);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener chats del usuario" });
  }
};

// POST /users
export const createUser = async (req: Request, res: Response, ctx: Context) => {
  const { name, phone } = req.body;
  try {
    const user = await ctx.prisma.user.create({
      data: { name, phone },
    });
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: "Error al crear usuario" });
  }
};

// POST /users/promo
export const createPromoUser = async (
  req: Request,
  res: Response,
  ctx: Context,
) => {
  const { name, phone, latitude, longitude, address } = req.body;

  if (!name || !phone) {
    return res
      .status(400)
      .json({ error: "Faltan campos requeridos: name, phone" });
  }

  const latNum =
    latitude !== undefined && latitude !== null && latitude !== ""
      ? Number(latitude)
      : null;
  const lngNum =
    longitude !== undefined && longitude !== null && longitude !== ""
      ? Number(longitude)
      : null;

  if (
    (latNum !== null && Number.isNaN(latNum)) ||
    (lngNum !== null && Number.isNaN(lngNum))
  ) {
    return res
      .status(400)
      .json({ error: "Latitude/longitude deben ser numéricos" });
  }

  try {
    const existingUser = await ctx.prisma.user.findFirst({
      where: {
        OR: [{ phone }, { name }],
      },
    });

    if (existingUser) {
      // Si ya existe y no tiene promo, actualizar datos y marcar promo
      if (!existingUser.receivedPromo) {
        const updated = await ctx.prisma.user.update({
          where: { id: existingUser.id },
          data: {
            name,
            phone,
            address: address ?? "",
            latitude: latNum,
            longitude: lngNum,
            receivedPromo: true,
          },
        });
        return res
          .status(200)
          .json({ message: "ok", user: updated, updatedPromo: true });
      }

      // Si ya tiene promo, solo devolver ok
      return res
        .status(200)
        .json({ message: "ok", user: existingUser, updatedPromo: false });
    }

    const user = await ctx.prisma.user.create({
      data: {
        name,
        phone,
        address: address ?? "",
        latitude: latNum,
        longitude: lngNum,
        receivedPromo: true,
      },
    });

    res.status(201).json(user);
  } catch (err: any) {
    if (err?.code === "P2002") {
      return res
        .status(409)
        .json({ error: "El usuario ya existe con ese nombre o teléfono" });
    }
    res.status(500).json({ error: "Error al crear usuario" });
  }
};
