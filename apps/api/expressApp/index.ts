import { Context } from ".keystone/types";
import registerUserRoutes from "./src/routes/userRoutes";
import registerChatRoutes from "./src/routes/chatRoutes";
import registerMessagesRoutes from "./src/routes/messageRoutes";
import registerOrderRoutes from "./src/routes/orderRoutes";
import registerWhatsAppRoutes from "./src/routes/whatsAppRoutes";
import registerDailyClosesRoutes from "./src/routes/dailyClosesRoutes";
import registerProductUploadRoutes from "./src/routes/productUploadRoutes";
import registerRestaurantUploadRoutes from "./src/routes/restaurantUploadRoutes";
import express from "express";
import { Express } from "express";

const isPrismaCommand = process.argv.some((arg) => arg.includes("prisma"));
const colorize = (bgCode: string, msg: string) =>
  `\x1b[30;${bgCode}m${msg}\x1b[0m`;
const mapArgs = (bg: string | null, args: unknown[]) =>
  bg ? args.map((a) => (typeof a === "string" ? colorize(bg, a) : a)) : args;

if (isPrismaCommand) {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
} else {
  const rawWarn = console.warn.bind(console);
  const rawErr = console.error.bind(console);
  console.warn = (...args) => rawWarn(...mapArgs("103", args)); // light yellow
  console.error = (...args) => rawErr(...mapArgs("101", args)); // light red
}

export default async (app: Express, commonContext: Context) => {
  const router = express.Router();
  const isBuildCommand = process.argv.some((arg) => arg.includes("build"));

  registerUserRoutes(router, commonContext);
  registerChatRoutes(router, commonContext);
  registerMessagesRoutes(router, commonContext);
  registerOrderRoutes(router, commonContext);
  registerWhatsAppRoutes(router, commonContext);
  if (!isBuildCommand) {
    const { default: registerBaileysRoutes } =
      await import("./src/routes/baileysRoutes");
    registerBaileysRoutes(router, commonContext);
  }
  registerDailyClosesRoutes(router, commonContext);
  registerProductUploadRoutes(router, commonContext);
  registerRestaurantUploadRoutes(router, commonContext);

  app.use("/rest", router);
};
