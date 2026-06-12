import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

function maskJid(value: string): string {
  const [local, domain] = value.split("@");
  if (!local) return value;

  const maskedLocal =
    local.length <= 6
      ? `${local.slice(0, 1)}***`
      : `${local.slice(0, 2)}***${local.slice(-4)}`;

  return domain ? `${maskedLocal}@${domain}` : maskedLocal;
}

function getCredsMeId(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const me = "me" in value ? value.me : null;
  if (!me || typeof me !== "object") {
    return null;
  }

  const id = "id" in me ? me.id : null;
  return typeof id === "string" && id.length > 0 ? id : null;
}

export type AuthHealth = Awaited<ReturnType<typeof getAuthHealth>>;

export async function getAuthHealth(authDir: string) {
  const credsPath = join(authDir, "creds.json");

  try {
    const [authDirStat, files] = await Promise.all([
      stat(authDir).catch(() => null),
      readdir(authDir).catch(() => [] as string[]),
    ]);
    const credsFileStat = await stat(credsPath).catch(() => null);
    const rawCreds = credsFileStat ? await readFile(credsPath, "utf8") : null;
    const creds = rawCreds ? (JSON.parse(rawCreds) as unknown) : null;
    const pairedJid = getCredsMeId(creds);

    return {
      authDir,
      authDirExists: authDirStat?.isDirectory() ?? false,
      authFileCount: files.length,
      credsFileExists: credsFileStat?.isFile() ?? false,
      credsFileBytes: credsFileStat?.size ?? 0,
      hasPairedAccount: pairedJid !== null,
      pairedAccount: pairedJid ? maskJid(pairedJid) : null,
    };
  } catch (error) {
    return {
      authDir,
      authDirExists: false,
      authFileCount: 0,
      credsFileExists: false,
      credsFileBytes: 0,
      hasPairedAccount: false,
      pairedAccount: null,
      error: error instanceof Error ? error.message : "Failed to inspect auth",
    };
  }
}

export function isAuthSessionMissing(auth: AuthHealth): boolean {
  return !auth.authDirExists || !auth.credsFileExists || !auth.hasPairedAccount;
}
