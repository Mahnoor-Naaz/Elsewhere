import { createWorldSchema, slugify, updateWorldSchema } from "@elsewhere/shared";
import { type Context, Hono } from "hono";
import { prisma } from "../db";
import { readJson, validationError } from "../lib/http";
import {
  type AuthEnv,
  type MaybeAuthEnv,
  optionalAuth,
  requireAuth,
} from "../middleware/auth";

// Every world response includes who made it, for the world card.
const worldInclude = { owner: { select: { id: true, name: true } } } as const;

const isUniqueViolation = (err: unknown) =>
  (err as { code?: string }).code === "P2002";

/** Picks "base", or "base-2", "base-3"... whichever this owner hasn't used. */
async function freeSlug(ownerId: string, base: string) {
  const existing = await prisma.world.findMany({
    where: { ownerId, slug: { startsWith: base } },
    select: { slug: true },
  });
  const taken = new Set(existing.map((w: { slug: string }) => w.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * Checks that the caller may change this world. A world they can't even see
 * (someone else's private world) is a 404, so its existence isn't leaked.
 * One they can see but don't own is a 403. Returns a response to send, or
 * null if the caller is the owner.
 */
async function denyUnlessOwner(c: Context, worldId: string, userId: string) {
  const world = await prisma.world.findUnique({
    where: { id: worldId },
    select: { ownerId: true, visibility: true },
  });
  if (!world || (world.visibility !== "public" && world.ownerId !== userId)) {
    return c.json({ error: "not_found" }, 404);
  }
  if (world.ownerId !== userId) return c.json({ error: "forbidden" }, 403);
  return null;
}

// --- Routes that need a logged-in user ---------------------------------
// requireAuth is attached to each route instead of using a blanket
// use("*"), so it can never leak onto the public routes mounted below.

const owned = new Hono<AuthEnv>();

owned.post("/", requireAuth, async (c) => {
  const parsed = createWorldSchema.safeParse(await readJson(c));
  if (!parsed.success) return validationError(c, parsed.error);
  const input = parsed.data;
  const ownerId = c.get("userId");
  const baseSlug = slugify(input.name);

  // The (ownerId, slug) unique index is the real guard. If two requests pick
  // the same free slug at once, one hits P2002 and simply tries again.
  for (let attempt = 0; ; attempt++) {
    try {
      const world = await prisma.world.create({
        data: {
          ownerId,
          slug: await freeSlug(ownerId, baseSlug),
          name: input.name,
          description: input.description ?? "",
          coverImage: input.coverImage ?? null,
          timePeriod: input.timePeriod ?? null,
          genre: input.genre ?? null,
          visibility: input.visibility ?? "private",
        },
        include: worldInclude,
      });
      return c.json({ world }, 201);
    } catch (err) {
      if (!isUniqueViolation(err) || attempt >= 2) throw err;
    }
  }
});

owned.get("/mine", requireAuth, async (c) => {
  const worlds = await prisma.world.findMany({
    where: { ownerId: c.get("userId") },
    orderBy: { updatedAt: "desc" },
    include: worldInclude,
  });
  return c.json({ worlds });
});

owned.patch("/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const denied = await denyUnlessOwner(c, id, c.get("userId"));
  if (denied) return denied;

  const parsed = updateWorldSchema.safeParse(await readJson(c));
  if (!parsed.success) return validationError(c, parsed.error);

  // The slug is not touched on rename, so links to a world keep working.
  const world = await prisma.world.update({
    where: { id },
    data: parsed.data,
    include: worldInclude,
  });
  return c.json({ world });
});

owned.delete("/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const denied = await denyUnlessOwner(c, id, c.get("userId"));
  if (denied) return denied;

  await prisma.world.delete({ where: { id } });
  return c.body(null, 204);
});

// --- Routes anyone can call ---------------------------------------------

const readable = new Hono<MaybeAuthEnv>();

readable.get("/:id", optionalAuth, async (c) => {
  const world = await prisma.world.findUnique({
    where: { id: c.req.param("id") },
    include: worldInclude,
  });
  const canView =
    world && (world.visibility === "public" || world.ownerId === c.get("userId"));
  if (!world || !canView) return c.json({ error: "not_found" }, 404);
  return c.json({ world });
});

export const worldRoutes = new Hono();
// Order matters: "/mine" must be registered before "/:id" or it would be
// read as a world id.
worldRoutes.route("/", owned);
worldRoutes.route("/", readable);
