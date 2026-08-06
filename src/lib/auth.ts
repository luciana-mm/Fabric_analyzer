import { createHmac, randomBytes, scrypt as _scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import type { IncomingMessage } from "http";
import type { NextApiRequest, NextApiResponse } from "next";
import { query } from "@/lib/db";

const scrypt = promisify(_scrypt);
const SESSION_SECRET = process.env.SESSION_SECRET;
const COOKIE_NAME = "app_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

if (!SESSION_SECRET) {
  throw new Error(
    "Missing SESSION_SECRET environment variable. Configure a strong secret in .env.local.",
  );
}

export type AppRole = "operador" | "gestor";
export type AuthSession = { userId: string; role: AppRole };

function sign(value: string) {
  return createHmac("sha256", SESSION_SECRET!).update(value).digest("hex");
}

export function serializeCookie(
  name: string,
  value: string,
  options: {
    maxAge?: number;
    path?: string;
    httpOnly?: boolean;
    sameSite?: "lax" | "strict" | "none";
    secure?: boolean;
    expires?: Date;
  } = {},
) {
  const segments = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) {
    segments.push(`Max-Age=${Math.floor(options.maxAge)}`);
  }

  if (options.expires) {
    segments.push(`Expires=${options.expires.toUTCString()}`);
  }

  segments.push(`Path=${options.path ?? "/"}`);

  if (options.httpOnly) {
    segments.push("HttpOnly");
  }

  if (options.secure) {
    segments.push("Secure");
  }

  if (options.sameSite) {
    segments.push(`SameSite=${options.sameSite}`);
  }

  return segments.join("; ");
}

export function parseCookies(request: IncomingMessage) {
  const header = request.headers.cookie;
  if (!header) return {};

  return header.split(";").reduce<Record<string, string>>((cookies, cookieString) => {
    const [name, ...rest] = cookieString.trim().split("=");
    if (!name) return cookies;
    cookies[name] = decodeURIComponent(rest.join("="));
    return cookies;
  }, {});
}

export function createSessionToken(userId: string) {
  const expiresAt = Date.now() + COOKIE_MAX_AGE * 1000;
  const payload = `${userId}|${expiresAt}`;
  const signature = sign(payload);
  return `${payload}|${signature}`;
}

export function verifySessionToken(token: string) {
  const [userId, expiresAt, signature] = token.split("|");
  if (!userId || !expiresAt || !signature) {
    return null;
  }

  const payload = `${userId}|${expiresAt}`;
  const expectedSignature = sign(payload);

  try {
    const signatureBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return null;
    }
  } catch {
    return null;
  }

  const expires = Number(expiresAt);
  if (Number.isNaN(expires) || Date.now() > expires) {
    return null;
  }

  return userId;
}

export async function requireAuth(req: NextApiRequest, res: NextApiResponse) {
  const token = getSessionToken(req);
  const userId = token ? verifySessionToken(token) : null;

  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }

  try {
    const result = await query("SELECT role FROM user_roles WHERE user_id = $1", [userId]);
    const role = result.rows[0]?.role;

    if (role !== "operador" && role !== "gestor") {
      res.status(403).json({ error: "Access denied" });
      return null;
    }

    return { userId, role } as AuthSession;
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to verify session" });
    return null;
  }
}

export function normalizeRole(role: unknown): AppRole | null {
  return role === "gestor" ? "gestor" : role === "operador" ? "operador" : null;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}.${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [salt, key] = storedHash.split(".");
  if (!salt || !key) return false;
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  const keyBuffer = Buffer.from(key, "hex");
  if (keyBuffer.length !== derivedKey.length) {
    return false;
  }
  return timingSafeEqual(keyBuffer, derivedKey);
}

export function getSessionToken(request: IncomingMessage) {
  const cookies = parseCookies(request);
  return cookies[COOKIE_NAME] || null;
}

export function createSessionCookie(value: string) {
  return serializeCookie(COOKIE_NAME, value, {
    maxAge: COOKIE_MAX_AGE,
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
}

export function clearSessionCookie() {
  return serializeCookie(COOKIE_NAME, "", {
    maxAge: 0,
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(0),
  });
}
