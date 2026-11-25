import { createMiddleware } from "hono/factory";
import { readSession } from "../lib/auth";

export type AuthEnv = { Variables: { userId: string } };
export type MaybeAuthEnv = { Variables: { userId: string | undefined } };

/**
 * Rejects the request with 401 unless it carries a valid session cookie.
 * It only checks the token, not the database, so it's cheap. Routes that
 * need the user record (like /auth/me) load it themselves.
 */
export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const userId = await readSession(c);
  if (!userId) return c.json({ error: "unauthorized" }, 401);
  c.set("userId", userId);
  await next();
});

/**
 * For routes anyone can call, where a logged-in user may see more (for
 * example, their own private world). Sets userId if there's a valid
 * session and leaves it undefined otherwise.
 */
export const optionalAuth = createMiddleware<MaybeAuthEnv>(async (c, next) => {
  c.set("userId", (await readSession(c)) ?? undefined);
  await next();
});
