import { config } from "./config.js";
import { JsonStore } from "./store/jsonStore.js";

const store = new JsonStore(config.dataFile);
const database = await store.read();
const superAdmin = database.adminUsers.find(
  (user) => user.email.toLowerCase() === config.superAdminEmail.toLowerCase(),
);

console.log(
  JSON.stringify(
    {
      ok: Boolean(superAdmin),
      environment: config.environment,
      dataFile: config.dataFile,
      superAdmin: superAdmin
        ? {
            id: superAdmin.id,
            email: superAdmin.email,
            role: superAdmin.role,
            status: superAdmin.status,
          }
        : null,
      demoSeed: {
        workspaces: database.workspaces.length,
        users: database.users.length,
        whatsappAccounts: database.whatsappAccounts.length,
      },
    },
    null,
    2,
  ),
);
