import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromBase64url(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64");
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(
  password: string,
  passwordHash: string,
): boolean {
  const [algorithm, salt, hash] = passwordHash.split(":");
  if (algorithm !== "scrypt" || !salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return (
    expected.length === candidate.length && timingSafeEqual(expected, candidate)
  );
}

export function hashToken(token: string, secret: string): string {
  return createHmac("sha256", secret).update(token).digest("hex");
}

export function signToken(
  payload: Record<string, unknown>,
  secret: string,
  expiresInSeconds: number,
): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const body = { ...payload, iat: now, exp: now + expiresInSeconds };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedBody = base64url(JSON.stringify(body));
  const signature = base64url(
    createHmac("sha256", secret)
      .update(`${encodedHeader}.${encodedBody}`)
      .digest(),
  );
  return `${encodedHeader}.${encodedBody}.${signature}`;
}

export function verifyToken<T extends Record<string, unknown>>(
  token: string,
  secret: string,
): T | null {
  const [encodedHeader, encodedBody, signature] = token.split(".");
  if (!encodedHeader || !encodedBody || !signature) return null;
  const expected = base64url(
    createHmac("sha256", secret)
      .update(`${encodedHeader}.${encodedBody}`)
      .digest(),
  );
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    return null;
  }
  const payload = JSON.parse(fromBase64url(encodedBody).toString("utf8")) as T;
  const exp = typeof payload.exp === "number" ? payload.exp : 0;
  if (exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function createOpaqueToken(): string {
  return base64url(randomBytes(48));
}
