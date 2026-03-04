// Welcome to Keystone!
//
// This file is what Keystone uses as the entry-point to your headless backend
//
// Keystone imports the default export of this file, expecting a Keystone configuration object
//   you can find out more at https://keystonejs.com/docs/apis/config

import { config } from "@keystone-6/core";
// to keep this file tidy, we define our schema in a different file
import { lists } from "./schema";

// authentication is configured separately here too, but you might move this elsewhere
// when you write your list-level access control functions, as they typically rely on session data
import { withAuth, session } from "./auth";
import { PrismaClient } from "@prisma/client";
import { mergeSchemas } from "@graphql-tools/schema";
import { v4 as uuidv4 } from "uuid";
import { recoveryEmail } from "./lib/email";
import extendExpressApp from "./expressApp";
import getGroupOrders from "./queries/GetGroupsOrders";
import { setupCronJobs } from "./cron-setup";
import * as Sentry from "@sentry/node";
import { createFirstUser } from "./lib/utils";
import { properextendGraphqlSchema } from "./expressApp/graphql/schema";

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

Sentry.init({
  dsn: process.env.SENTRY_DSN, // usa una variable de entorno segura
  tracesSampleRate: 0.0, // si no necesitas performance monitoring
});

export const prisma = new PrismaClient();

const isProduction = process.env.NODE_ENV === "production";
const configuredOrigins = (process.env.ALLOWED_HOSTS || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const defaultOrigins = isProduction
  ? ["https://app.lamojarreria.com", "https://api.lamojarreria.com"]
  : [
      "http://localhost:3001",
      "http://127.0.0.1:3001",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ];
const origin =
  configuredOrigins.length > 0 ? configuredOrigins : defaultOrigins;

// Solo inicializa WhatsApp y cron jobs si no es un comando de Prisma (ej. migrate, generate)

export default withAuth(
  config({
    lists,
    session,
    db: {
      provider: "postgresql",
      url: process.env.DATABASE_URL || "",
      shadowDatabaseUrl: process.env.DATABASE_URL_SHADOW || "",
      idField: { kind: "uuid" },
      onConnect: async (context) => {
        console.log("🚀 Keystone server is starting...");
        console.log("📂 Environment:", process.env.NODE_ENV);
        console.log("📦 Keystone argv:", process.argv);
        const isPrismaCommand = process.argv.some((arg) =>
          arg.includes("prisma"),
        );
        const isBuildCommand = process.argv.some((arg) =>
          arg.includes("build"),
        );
        if (isPrismaCommand || isBuildCommand) return; // prevents running this logic during Prisma commands like migrate or generate

        // if there is no users, we will create one default admin user
        const admin = await createFirstUser(context);
        // instantiate WhatsApp client lazily to avoid ESM/CJS conflicts during build
        const { waClient } = await import(
          "./expressApp/src/whatsAppServer/lib/WhatsAppInit"
        );
        await waClient.init(context);
      },
    },
    server: {
      extendExpressApp: (app, context) => {
        console.log("🚀 Keystone server is starting...");
        console.log("📂 Environment:", process.env.NODE_ENV);
        console.log("📦 Keystone argv:", process.argv);
        const isPrismaCommand = process.argv.some((arg) =>
          arg.includes("prisma"),
        );
        const isBuildCommand = process.argv.some((arg) =>
          arg.includes("build"),
        );
        if (isPrismaCommand || isBuildCommand) return; // prevents running this logic during Prisma commands like migrate or generate

        if (extendExpressApp) {
          extendExpressApp(app, context);
        }
        setupCronJobs(context);
      },
      cors: {
        origin,
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
      },
    },
    graphql: {
      extendGraphqlSchema: (schema) =>
        mergeSchemas({
          schemas: [schema, properextendGraphqlSchema(schema)],
          typeDefs: `
            type Query {
              updatePassword(recoveryId: String!, password: String!): Boolean
              getRecoveryEmail(email: String!): Boolean
              getGroupOrders: [[ExtendedOrder]]
            }

            type ExtendedOrder {
            id: ID!
            client: User
            products: [Product]
            productsWithAmount: JSON
            isDelivery: Boolean!
            address: String
            deliveryCost: Float
            deliveryTime: String
            notes: String
            relatedOrders: [RelatedOrder]
            status: String!
            createdAt: String!
          }

          type RelatedOrder {
            id: ID!
            status: String!
          }

          scalar JSON
`,
          resolvers: {
            Query: {
              updatePassword: async (
                root,
                { recoveryId, password },
                context: any,
              ) => {
                const iam = await context.db.Auth.findMany({
                  where: { recoveryId: { startsWith: recoveryId } },
                });
                if (!iam.length) return false;

                await context.db.Auth.updateOne({
                  where: { id: iam[0].id },
                  data: {
                    recoveryId: "",
                    password,
                  },
                });
                return true;
              },
              getRecoveryEmail: async (root, { email }, context: any) => {
                const recoveryId = uuidv4();

                const user = await context.db.Auth.updateOne({
                  where: { email },
                  data: {
                    recoveryId,
                  },
                });
                if (!user) return false;

                await recoveryEmail(user);
                return true;
              },
              getGroupOrders,
            },
          },
        }),
    },
  }),
);
