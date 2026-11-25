import { loginSchema, registerSchema } from "@elsewhere/shared";
import { Hono } from "hono";
import { prisma } from "../db";
import { endSession, startSession } from "../lib/auth";
import { readJson, validationError } from "../lib/http";
import { getDummyHash, hashPassword, verifyPassword } from "../lib/password";
import { type AuthEnv, requireAuth } from "../middleware/auth";

// Fields that are safe to send to the browser. passwordHash is not among them.
const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
} as const;

export const authRoutes = new Hono<AuthEnv>();

authRoutes.post("/register", async (c) => {
  const parsed = registerSchema.safeParse(await readJson(c));
  if (!parsed.success) return validationError(c, parsed.error);
  const { name, email, password } = parsed.data;

  try {
    const user = await prisma.user.create({
      data: { name, email, passwordHash: await hashPassword(password) },
      select: publicUserSelect,
    });
    await startSession(c, user.id);
    return c.json({ user }, 201);
  } catch (err) {
    // P2002 is Prisma's "unique constraint failed". The unique index on
    // email is the real guard, so two simultaneous sign-ups can't both win.
    if ((err as { code?: string }).code === "P2002") {
      return c.json({ error: "email_taken" }, 409);
    }
    throw err;
  }
});

authRoutes.post("/login", async (c) => {
  const parsed = loginSchema.safeParse(await readJson(c));
  if (!parsed.success) return validationError(c, parsed.error);
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });

  // Always run one hash verification, and always give one error, so an
  // attacker can't learn which emails have accounts.
  const valid = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !valid) return c.json({ error: "invalid_credentials" }, 401);

  await startSession(c, user.id);
  return c.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    },
  });
});

authRoutes.post("/logout", (c) => {
  endSession(c);
  return c.body(null, 204);
});

authRoutes.get("/me", requireAuth, async (c) => {
  const user = await prisma.user.findUnique({
    where: { id: c.get("userId") },
    select: publicUserSelect,
  });
  if (!user) {
    // A valid token for a user who no longer exists: clear it.
    endSession(c);
    return c.json({ error: "unauthorized" }, 401);
  }
  return c.json({ user });
});
