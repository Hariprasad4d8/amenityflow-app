
import { createHmac, timingSafeEqual } from "crypto";

export type SessionData = {
  organizationId: string;
  email: string;
  iat: number;
  exp: number;
};

export function verifySession(
  token: string | undefined
): SessionData | null {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32 || !token) {
    return null;
  }

  const parts = token.split(".");

  if (parts.length !== 2) {
    return null;
  }

  const [payload, suppliedSignature] = parts;

  try {
    const expectedSignature = createHmac("sha256", secret)
      .update(payload)
      .digest();

    const actualSignature = Buffer.from(
      suppliedSignature,
      "base64url"
    );

    if (
      actualSignature.length !== expectedSignature.length ||
      !timingSafeEqual(actualSignature, expectedSignature)
    ) {
      return null;
    }

    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as SessionData;

    const now = Math.floor(Date.now() / 1000);

    if (
      typeof session.organizationId !== "string" ||
      typeof session.email !== "string" ||
      !Number.isSafeInteger(session.iat) ||
      !Number.isSafeInteger(session.exp) ||
      session.iat > now ||
      session.exp <= now ||
      session.exp <= session.iat ||
      session.exp - session.iat > 7 * 24 * 60 * 60
    ) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}
