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
