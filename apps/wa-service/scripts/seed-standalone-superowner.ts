import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const serviceRoot = resolve(scriptDir, "..");
const repoRoot = resolve(serviceRoot, "..", "..");

for (const envFile of [
  resolve(repoRoot, ".env"),
  resolve(repoRoot, "apps", "taku-wa-web-service", ".env"),
  resolve(serviceRoot, ".env"),
]) {
  loadDotenv({ path: envFile, override: true });
}

const [{ config }, { ensureStandaloneSuperownerAccount }] = await Promise.all([
  import("../src/config.js"),
  import("../src/services/standaloneAccountStore.js"),
]);

if (!config.takuSuperownerEmail || !config.takuSuperownerPassword) {
  throw new Error(
    "TAKU_SUPEROWNER_EMAIL and TAKU_SUPEROWNER_PASSWORD are required",
  );
}

const account = await ensureStandaloneSuperownerAccount({
  filePath: config.standaloneAccountsFile,
  email: config.takuSuperownerEmail,
  password: config.takuSuperownerPassword,
});

console.log(
  JSON.stringify(
    {
      ok: true,
      account: {
        id: account.id,
        email: account.email,
        plan: account.plan,
        connectionIds: account.connectionIds.length,
      },
    },
    null,
    2,
  ),
);
