import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";
import { env } from "../env";

export const SESSION_COOKIE = "elsewhere_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7; // 7 days

/** Sign a JWT for this user and store it in an HTTP-only cookie. */
export async function startSession(c: Context, userId: string) {
  const now = Math.floor(Date.now() / 1000);
  const token = await sign(
    { sub: userId, iat: now, exp: now + SESSION_SECONDS },
    env.jwtSecret,
    "HS256",
  );
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true, // JavaScript in the page can't read it, which limits XSS damage
    secure: env.isProd, // HTTPS only in production
    sameSite: "Lax", // not sent on cross-site POSTs, which covers most CSRF
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export function endSession(c: Context) {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

/** Returns the user id from a valid session cookie, or null. */
export async function readSession(c: Context): Promise<string | null> {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;
  try {
    const payload = await verify(token, env.jwtSecret, "HS256");
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    // Bad signature, malformed, or expired.
    return null;
  }
}
