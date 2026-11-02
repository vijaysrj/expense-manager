// Single-user passcode login. Works in both the Edge (middleware) and Node runtimes.

export const SESSION_COOKIE = "em_session";
/** "Keep me signed in": the cookie lasts a year and is renewed while the app is in use. */
export const REMEMBER_DAYS = 365;
/** Otherwise the cookie ends with the browser session, and the token itself expires after a day. */
export const SESSION_HOURS = 24;
const DAY_MS = 24 * 60 * 60 * 1000;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface Session {
  expires: number;
  remember: boolean;
}

export async function createSessionToken(remember: boolean): Promise<string> {
  const expires = Date.now() + (remember ? REMEMBER_DAYS * DAY_MS : SESSION_HOURS * 60 * 60 * 1000);
  const payload = `${expires}-${remember ? 1 : 0}`;
  return `${payload}.${await hmac(payload)}`;
}

export async function readSession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if (!safeEqual(sig, await hmac(payload))) return null;
  const [exp, flag] = payload.split("-");
  const expires = Number(exp);
  if (!Number.isFinite(expires) || expires <= Date.now()) return null;
  return { expires, remember: flag === "1" };
}

/** A remembered session with less than this left gets a fresh year on the next visit. */
export function needsRenewal(s: Session): boolean {
  return s.remember && s.expires - Date.now() < (REMEMBER_DAYS - 30) * DAY_MS;
}

export function cookieOptions(remember: boolean) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    ...(remember ? { maxAge: REMEMBER_DAYS * 24 * 60 * 60 } : {}),
  };
}

export async function checkPassword(input: string): Promise<boolean> {
  const expected = process.env.APP_PASSWORD;
  if (!expected) throw new Error("APP_PASSWORD is not set");
  // Compare HMACs so the comparison is constant-length.
  return safeEqual(await hmac(`pw:${input}`), await hmac(`pw:${expected}`));
}
