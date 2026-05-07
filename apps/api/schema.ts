// Welcome to your schema
//   Schema driven development is Keystone's modus operandi
//
// This file is where we define the lists, fields and hooks for our data.
// If you want to learn more about how lists are configured, please read
// - https://keystonejs.com/docs/config/lists
import { list, graphql } from "@keystone-6/core";
import { cloudinaryImage } from "@keystone-6/cloudinary";
import { Products } from "./cloudinary";

// see https://keystonejs.com/docs/fields/overview for the full list of fields
//   this is a few common fields for an example
import {
  text,
  relationship,
  password,
  timestamp,
  select,
  json,
} from "@keystone-6/core/fields";
import { float, checkbox, integer, virtual } from "@keystone-6/core/fields";
// the document field is a more complicated field, so it has it's own package
import { document } from "@keystone-6/fields-document";
// if you want to make your own fields, see https://keystonejs.com/docs/guides/custom-fields

// when using Typescript, you can refine your types to a stricter subset by importing
// the generated types from '.keystone/types'
import { type Lists } from ".keystone/types";
import { allowAll } from "@keystone-6/core/access";
import {
  BaseAccessArgs,
  AccessOperation,
} from "@keystone-6/core/dist/declarations/src/types/config/access-control";
import { BaseListTypeInfo, MaybePromise } from "@keystone-6/core/types";
import { dispatchMessages } from "./expressApp/src/services/pollingManager";
import getGroupOrders from "./queries/GetGroupsOrders";
import { dispatchOrders } from "./expressApp/src/services/orderPollingManager";
import { v4 as uuidv4 } from "uuid";

// Lists
import { DailyCloseRaw } from "./lists/DailyCloseRaw";
import { DailyClose } from "./lists/DailyClose";
import { DailyCloseItem } from "./lists/DailyCloseItem";
import { SyncLog } from "./lists/SyncLog";
import { RawMaterial } from "./lists/RawMaterial";
import { RawMaterialPurchase } from "./lists/RawMaterialPurchase";
import { ProductRecipeItem } from "./lists/ProductRecipeItem";
import { FixedOperatingExpense } from "./lists/FixedOperatingExpense";
import { EmployeeSchedule } from "./lists/EmployeeSchedule";
import { Restaurant } from "./lists/Restaurant";
// Lists

//This will prevent all graphql
const access = allowAll;
const now = new Date();

const parseProductImages = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => {
    if (!item || typeof item !== "object") return false;
    const record = item as Record<string, unknown>;
    return (
      typeof record.secureUrl === "string" &&
      typeof record.publicId === "string"
    );
  });
};

const todayStart = new Date(
  Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0),
).toISOString();
const todayEnd = new Date(
  Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
).toISOString();

export const lists = {
  // Handles daily reports from kiosks/tablets
  DailyCloseRaw,
  DailyClose,
  DailyCloseItem,
  SyncLog,
  RawMaterial,
  RawMaterialPurchase,
  ProductRecipeItem,
  FixedOperatingExpense,
  EmployeeSchedule,
  Restaurant,
  Auth: list({
    fields: {
      email: text({ validation: { isRequired: true }, isIndexed: "unique" }),
      password: password({
        validation: { isRequired: true },
      }),
      recoveryId: text({ db: { isNullable: true } }),
      createdAt: timestamp({
        defaultValue: { kind: "now" },
      }),
      user: relationship({
        ref: "User.auth", // Relación con el modelo 'User', si existe un usuario
        many: false, // Relación de uno a uno
      }),
      sing: relationship({
        ref: "Sing.auth",
        many: false,
      }),
      closedRegisters: relationship({
        ref: "CashRegister.closedBy",
        many: false,
      }),
      openedRegisters: relationship({
        ref: "CashRegister.openedBy",
        many: false,
      }),
      pin: text({
        validation: {
          length: { min: 4, max: 4 },
        },
        db: { isNullable: true },
        isFilterable: true,
      }),
      clockCard: relationship({
        ref: "ClockCard",
      }),
    },
    access,
  }),
  User: list({
    fields: {
      name: text({ validation: { isRequired: true }, isIndexed: "unique" }),
      phone: text({ validation: { isRequired: true }, isIndexed: "unique" }),
      address: text({ validation: { isRequired: false } }),
      latitude: float({ db: { isNullable: true } }),
      longitude: float({ db: { isNullable: true } }),
      receivedPromo: checkbox({ defaultValue: false }),
      createdAt: timestamp({ defaultValue: { kind: "now" } }),
      messages: relationship({ ref: "Message.user", many: true }),
      orders: relationship({ ref: "Order.client", many: true }),
      chatSessions: relationship({ ref: "ChatSession.user", many: true }),
      auth: relationship({
        ref: "Auth.user", // Relación con el modelo Auth
        many: false, // Relación de uno a uno
      }),
      role: select({
        options: [
          { label: "agent", value: "AGENT" },
          { label: "client", value: "CLIENT" },
          { label: "delivery", value: "DELIVERY" },
          { label: "cook", value: "COOK" },
          { label: "assistant", value: "ASSISTANT" },
          { label: "owner", value: "OWNER" },
          { label: "admin", value: "ADMIN" },
        ],
      }),
      schedule: relationship({
        ref: "EmployeeSchedule.user",
        many: false,
      }),
      dailyCloses: relationship({
        ref: "DailyClose.closedBy",
        many: true,
      }),
      active: checkbox({
        defaultValue: true,
      }),
    },
    access,
  }),

  Agent: list({
    fields: {
      name: text({ validation: { isRequired: true } }),
      active: checkbox({ defaultValue: true }),
      assignedChats: relationship({ ref: "ChatSession.agent", many: true }),
    },
    access,
  }),

  ChatSession: list({
    fields: {
      user: relationship({ ref: "User.chatSessions", many: false }),
      agent: relationship({ ref: "Agent.assignedChats" }),
      status: select({
        options: [
          { label: "Bot", value: "BOT" },
          { label: "Agente", value: "AGENT" },
        ],
        defaultValue: "BOT",
        ui: { displayMode: "segmented-control" },
      }),
      messages: relationship({ ref: "Message.chat", many: true }),
      createdAt: timestamp({ defaultValue: { kind: "now" } }),
      updatedAt: timestamp({
        db: { updatedAt: true },
      }),
      hasOrder: checkbox({ defaultValue: false }),
    },
    access,
  }),

  Message: list({
    fields: {
      content: text({ validation: { isRequired: true } }),
      sender: select({
        options: [
          { label: "Cliente", value: "USER" },
          { label: "Bot", value: "BOT" },
          { label: "Agente", value: "AGENT" },
        ],
        defaultValue: "USER",
        ui: { displayMode: "segmented-control" },
      }),
      createdAt: timestamp({ defaultValue: { kind: "now" } }),
      internalId: text({}),
      chat: relationship({ ref: "ChatSession.messages", many: false }),
      user: relationship({ ref: "User.messages", many: false }),
    },
    access,
    hooks: {
      afterOperation: {
        create: async ({ operation, item, context }) => {
          if (operation !== "create") return;

          if (item.sender === "BOT" || item.sender === "AGENT") {
            const { chatId } = item || { chatId: "" };
            const chat = await context.prisma.chatSession.findFirst({
              where: { id: chatId },
              include: {
                user: true, // Incluye el usuario relacionado
              },
            });
            await context.prisma.chatSession.update({
              where: { id: chatId },
              data: { updatedAt: new Date() }, // Actualiza el timestamp
            });
            // Actualiza el timestamp de la sesión de chat

            try {
              // if (process.env.STOP_BOT === "true") {
              //   console.log("Bot desactivado, no se enviará mensaje de WhatsApp.");
              //   return; // Si el bot está desactivado, no envía el mensaje
              // }

              // if (chat?.user?.phone !== '5219931175435') {
              //   console.log("No se encontró el número de teléfono del usuario.", chat?.user?.phone);
              //   return; // Si no hay número de teléfono, no envía el mensaje
              // } else {
              //   waClient.sendText(
              //     `${chat?.user?.phone}@s.whatsapp.net`,
              //     item.content
              //   );

              // }
              const isBuildCommand = process.argv.some((arg) =>
                arg.includes("build"),
              );
              if (isBuildCommand) {
                console.log(
                  "🚧 Modo build detectado, no se enviará mensaje de WhatsApp.",
                );
                return; // Si está en modo build, no envía el mensaje
              }
              const { waClient } =
                await import("./expressApp/src/whatsAppServer/lib/WhatsAppInit");
              await waClient.sendText(
                `${chat?.user?.phone}@s.whatsapp.net`,
                item.content,
              );
              // sendWhatsAppMessage(chat?.user?.phone, item.content)
            } catch (error) {
              console.log("----------------------------------------");
              console.log("Error al enviar mensaje de WhatsApp:", error);
            }
          }

          try {
            const chatId = item.chatId; // Prisma guarda el id de la relación en item

            if (chatId) {
              dispatchMessages(chatId, [item]); // Enviamos el mensaje
            }
          } catch (error) {
            console.error("Error en afterOperation de Message:", error);
          }
        },
      },
    },
  }),

  // Client: list({
  //   access,
  //   fields: {
  //     name: text({ validation: { isRequired: true } }),
  //     phone: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
  //     orders: relationship({ ref: 'Order.client', many: true }),
  //   },
  // }),

  Product: list({
    access,
    fields: {
      name: text({ validation: { isRequired: true } }),
      price: float({ validation: { isRequired: true } }),
      rawCost: float({ validation: { isRequired: true }, defaultValue: 0 }),
      salePrice: float(),
      finalPrice: virtual({
        field: graphql.field({
          type: graphql.Float,
          resolve(item) {
            const today = new Date();
            const isThursday = today.getDay() === 5;
            return isThursday && item.salePrice != null
              ? item.salePrice
              : item.price;
          },
        }),
        ui: { itemView: { fieldMode: "read" } },
      }),
      grossProfitUnit: virtual({
        field: graphql.field({
          type: graphql.Float,
          resolve(item) {
            const today = new Date();
            const isThursday = today.getDay() === 5;
            const finalPrice =
              isThursday && item.salePrice != null
                ? item.salePrice
                : item.price;
            return finalPrice - (item.rawCost ?? 0);
          },
        }),
        ui: { itemView: { fieldMode: "read" } },
      }),
      description: text(),
      active: checkbox({ defaultValue: true }),
      images: json({
        ui: {
          description:
            "1 to 5 product images. Each image should contain publicId and secureUrl.",
        },
      }),
      image: cloudinaryImage({ cloudinary: Products }),
      orders: relationship({ ref: "Order.products", many: true }),
      stock: relationship({ ref: "Stock.product", many: true }),
      recipeItems: relationship({
        ref: "ProductRecipeItem.product",
        many: true,
      }),
      timeProcess: select({
        options: [
          { label: "30 minutos", value: "30" },
          { label: "15 minutos", value: "15" },
          { label: "10 minutos", value: "10" },
          { label: "5 minutos", value: "5" },
          { label: "30 minutos (legacy)", value: "30 minutos" },
          { label: "15 minutos (legacy)", value: "15 minutos" },
          { label: "10 minutos (legacy)", value: "10 minutos" },
          { label: "5 minutos (legacy)", value: "5 minutos" },
        ],
        defaultValue: "30",
        ui: { displayMode: "segmented-control" },
      }),
    },
    hooks: {
      validateInput: async ({ resolvedData, item, addValidationError }) => {
        const sourceImages =
          resolvedData.images !== undefined
            ? resolvedData.images
            : (item as Record<string, unknown> | undefined)?.images;

        const images = parseProductImages(sourceImages);

        if (images.length < 1) {
          addValidationError("Product must include at least 1 image.");
        }

        if (images.length > 5) {
          addValidationError("Product can include up to 5 images.");
        }
      },
    },
  }),

  Order: list({
    access,
    fields: {
      client: relationship({ ref: "User.orders", many: false }),
      products: relationship({ ref: "Product.orders", many: true }),
      relatedOrders: relationship({
        ref: "Order",
        many: true,
        ui: {
          displayMode: "select",
          labelField: "id",
        },
      }),
      productsWithAmount: text({
        ui: { displayMode: "textarea" },
      }),
      isDelivery: checkbox({ defaultValue: false }),
      address: text({ ui: { displayMode: "textarea" } }),
      deliveryCost: float(),
      deliveryTime: text({ validation: { isRequired: false } }), // formato 'HH:mm'
      notes: text({ ui: { displayMode: "textarea" } }),
      status: select({
        options: [
          { label: "Pendiente", value: "pending" },
          { label: "En preparación", value: "inProgress" },
          { label: "Listo", value: "completed" },
          { label: "Entregado", value: "delivered" },
          { label: "Cancelado", value: "canceled" },
        ],
        defaultValue: "pending",
        ui: { displayMode: "segmented-control" },
      }),
      createdAt: timestamp({ defaultValue: { kind: "now" } }),
      active: checkbox({ defaultValue: true }),
    },
    hooks: {
      afterOperation: async ({ operation, item, context }) => {
        if (["create", "update"].includes(operation)) {
          const ListenerId = await context.query.Listener.findMany({
            where: {},
            query: `id listenerId`,
          });
          const listenerIds = ListenerId.map((l) => l.listenerId);

          const groupedOrders = await getGroupOrders(null, {}, context);
          await dispatchOrders(groupedOrders, listenerIds);

          await context.prisma.listener.deleteMany({
            where: {
              id: {
                in: ListenerId.map((l) => l.id),
              },
            },
          });
          console.log("listener deleted");
        }
      },
    },
  }),

  Stock: list({
    access,
    fields: {
      product: relationship({ ref: "Product.stock", many: false }),
      quantity: integer({ validation: { isRequired: true }, defaultValue: 0 }),
      // location can be add in the future for branches
      lastUpdated: timestamp({
        defaultValue: { kind: "now" },
      }),
    },
    hooks: {
      validateInput: ({ resolvedData, addValidationError }) => {
        if (resolvedData.quantity < 0) {
          addValidationError("Stock no puede ser negativo");
        }
      },
    },
  }),
  CashRegister: list({
    access,
    fields: {
      date: timestamp({
        defaultValue: { kind: "now" },
        isIndexed: true,
      }),

      status: select({
        options: [
          { label: "Apertura", value: "open" },
          { label: "Cierre", value: "closed" },
        ],
        defaultValue: "open",
        ui: { displayMode: "segmented-control" },
      }),

      openingBalance: float({
        validation: { isRequired: true },
        defaultValue: 500.0,
      }),

      closingBalance: float({
        validation: { isRequired: false },
      }),

      openedBy: relationship({
        ref: "Auth.openedRegisters",
        many: false,
        ui: { hideCreate: true },
      }),

      closedBy: relationship({
        ref: "Auth.closedRegisters",
        many: false,
        ui: { hideCreate: true },
      }),

      notes: text({
        ui: { displayMode: "textarea" },
        label: "Observaciones",
      }),
    },
  }),
  Listener: {
    access,
    fields: {
      listenerId: text({ validation: { isRequired: true } }),
    },
  },
  Sing: list({
    access,
    fields: {
      auth: relationship({
        ref: "Auth.sing",
        many: false,
      }),
      phones: text({
        ui: { displayMode: "textarea" },
      }),
      modeDeveloper: checkbox({ defaultValue: false }),
    },
  }),
  QRStaff: list({
    access,
    fields: {
      token: text({
        db: { isNullable: true },
        hooks: {
          resolveInput: ({ operation, resolvedData }) => {
            if (operation === "create" && !resolvedData.token) {
              return uuidv4();
            }
            return resolvedData.token;
          },
        },
      }),
      createdAt: timestamp({
        defaultValue: { kind: "now" },
      }),
    },
  }),
  ClockCard: list({
    access: allowAll,
    fields: {
      auth: relationship({
        ref: "Auth",
      }),
      getIn: timestamp(),
      getOut: timestamp(),
    },
  }),
} satisfies Lists;
