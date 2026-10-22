import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const visitorIdSchema = z.uuid();

export type RecognizedVisitor = {
  visitorId: string;
  expiresAt: number;
};

function getSigningKey(): string {
  const key = process.env.O_ANALYTICS_VISITOR_SECRET;

  if (!key || Buffer.byteLength(key, "utf8") < 32) {
    throw new Error(
      "O_ANALYTICS_VISITOR_SECRET must contain at least 32 bytes.",
    );
  }

  return key;
}

function signPayload(payload: string): Buffer {
  return createHmac("sha256", getSigningKey())
    .update(`o-analytics-visitor:${payload}`)
    .digest();
}

export function createVisitorToken(
  visitorId: string,
  expiresAt: number,
): string {
  visitorIdSchema.parse(visitorId);

  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) {
    throw new Error("Visitor token expiration must be in the future.");
  }

  const payload = `v1.${visitorId}.${expiresAt}`;
  const signature = signPayload(payload).toString("base64url");

  return `${payload}.${signature}`;
}

export function verifyVisitorToken(token: unknown): RecognizedVisitor | null {
  if (typeof token !== "string" || token.length > 200) {
    return null;
  }

  const parts = token.split(".");

  if (parts.length !== 4) {
    return null;
  }

  const [version, visitorId, expiration, signature] = parts;

  if (
    version !== "v1" ||
    !visitorIdSchema.safeParse(visitorId).success ||
    !/^[1-9]\d{0,15}$/.test(expiration) ||
    !/^[A-Za-z0-9_-]{43}$/.test(signature)
  ) {
    return null;
  }

  const expiresAt = Number(expiration);

  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) {
    return null;
  }

  try {
    const payload = `${version}.${visitorId}.${expiration}`;
    const expectedSignature = signPayload(payload);
    const receivedSignature = Buffer.from(signature, "base64url");

    if (
      receivedSignature.length !== expectedSignature.length ||
      !timingSafeEqual(receivedSignature, expectedSignature)
    ) {
      return null;
    }

    return { visitorId, expiresAt };
  } catch {
    return null;
  }
}
