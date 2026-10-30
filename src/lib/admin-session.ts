import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "o_admin_session";
export const ADMIN_SESSION_DURATION_SECONDS = 8 * 60 * 60;

const MIN_SECRET_BYTES = 32;

function getSessionSecret(): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret || Buffer.byteLength(secret, "utf8") < MIN_SECRET_BYTES) {
    return null;
  }

  return secret;
}

/** Both the shared password and the signing secret must be set. */
export function isAdminAccessConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD) && getSessionSecret() !== null;
}

function safeEqual(a: string, b: string): boolean {
  // Hashing first gives equal lengths, as timingSafeEqual requires.
  const left = createHash("sha256").update(a, "utf8").digest();
  const right = createHash("sha256").update(b, "utf8").digest();

  return timingSafeEqual(left, right);
}

export function verifyAdminPassword(candidate: unknown): boolean {
  const password = process.env.ADMIN_PASSWORD;

  if (
    !password ||
    !isAdminAccessConfigured() ||
    typeof candidate !== "string" ||
    candidate.length > 512
  ) {
    return false;
  }

  return safeEqual(candidate, password);
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`o-admin-session:${payload}`)
    .digest("base64url");
}

/** Token format: v1.<expiration in ms>.<signature>. */
export function createAdminSessionToken(now = Date.now()): string {
  const secret = getSessionSecret();

  if (!secret) {
    throw new Error("Admin access is not configured.");
  }

  const payload = `v1.${now + ADMIN_SESSION_DURATION_SECONDS * 1000}`;

  return `${payload}.${sign(payload, secret)}`;
}

export function verifyAdminSessionToken(
  token: unknown,
  now = Date.now(),
): boolean {
  const secret = getSessionSecret();

  if (!secret || !process.env.ADMIN_PASSWORD) {
    return false;
  }

  if (typeof token !== "string" || token.length > 200) {
    return false;
  }

  const parts = token.split(".");

  if (parts.length !== 3 || parts[0] !== "v1" || !/^\d{13}$/.test(parts[1])) {
    return false;
  }

  const expiresAt = Number(parts[1]);

  if (expiresAt <= now) {
    return false;
  }

  return safeEqual(parts[2], sign(`${parts[0]}.${parts[1]}`, secret));
}

/** Only relative paths inside /admin are accepted as redirect targets. */
export function safeAdminRedirect(target: unknown): string {
  if (
    typeof target === "string" &&
    /^\/admin(?:\/[\w\-/]*)?(?:\?[\w\-=&%]*)?$/.test(target) &&
    !target.startsWith("/admin/login")
  ) {
    return target;
  }

  return "/admin";
}
