import { mock } from "bun:test";

// env.ts refuses to load without a secret, so set one before the app is imported.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-123";

// An in-memory stand-in for Prisma, covering only what the routes call.
// Importing this file replaces "../db" for the whole test run.
type Row = Record<string, any>;
type Args = {
  where?: Row;
  data?: Row;
  select?: Record<string, boolean>;
  include?: Row;
  orderBy?: Row;
};

export const db = { users: [] as Row[], worlds: [] as Row[] };
export const resetDb = () => {
  db.users = [];
  db.worlds = [];
};

// A clock that always moves forward, so "newest first" is deterministic.
let tick = Date.parse("2026-01-01T00:00:00Z");
const now = () => new Date((tick += 1000));

const pick = (row: Row, select?: Record<string, boolean>) =>
  select ? Object.fromEntries(Object.keys(select).map((k) => [k, row[k]])) : row;

const withOwner = (world: Row, include?: Row) => {
  if (!include?.owner) return world;
  const owner = db.users.find((u) => u.id === world.ownerId)!;
  return { ...world, owner: pick(owner, include.owner.select) };
};

const uniqueError = () =>
  Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

const fakePrisma = {
  user: {
    create: async ({ data, select }: Args) => {
      if (db.users.some((u) => u.email === data!.email)) throw uniqueError();
      const row = { id: crypto.randomUUID(), createdAt: now(), ...data };
      db.users.push(row);
      return pick(row, select);
    },
    findUnique: async ({ where, select }: Args) => {
      const row = db.users.find((u) => (where!.email ? u.email === where!.email : u.id === where!.id));
      return row ? pick(row, select) : null;
    },
  },
  world: {
    create: async ({ data, include }: Args) => {
      if (db.worlds.some((w) => w.ownerId === data!.ownerId && w.slug === data!.slug)) {
        throw uniqueError();
      }
      const stamp = now();
      const row = { id: crypto.randomUUID(), createdAt: stamp, updatedAt: stamp, ...data };
      db.worlds.push(row);
      return withOwner(row, include);
    },
    findUnique: async ({ where, select, include }: Args) => {
      const row = db.worlds.find((w) => w.id === where!.id);
      if (!row) return null;
      return select ? pick(row, select) : withOwner(row, include);
    },
    findMany: async ({ where, select, include, orderBy }: Args) => {
      let rows = db.worlds.filter(
        (w) =>
          (!where?.ownerId || w.ownerId === where.ownerId) &&
          (!where?.slug?.startsWith || w.slug.startsWith(where.slug.startsWith)),
      );
      if (orderBy?.updatedAt === "desc") {
        rows = [...rows].sort((a, b) => b.updatedAt - a.updatedAt);
      }
      return rows.map((w) => (select ? pick(w, select) : withOwner(w, include)));
    },
    update: async ({ where, data, include }: Args) => {
      const row = db.worlds.find((w) => w.id === where!.id)!;
      for (const [k, v] of Object.entries(data!)) if (v !== undefined) row[k] = v;
      row.updatedAt = now();
      return withOwner(row, include);
    },
    delete: async ({ where }: Args) => {
      db.worlds = db.worlds.filter((w) => w.id !== where!.id);
    },
  },
};

mock.module("../db", () => ({ prisma: fakePrisma }));

export const { app } = await import("../app");

export const postJson = (path: string, body: unknown, cookie?: string, method = "POST") =>
  app.request(path, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });

/** "elsewhere_session=abc; Max-Age=..." -> "elsewhere_session=abc" */
export const cookieFrom = (res: Response) => res.headers.get("set-cookie")!.split(";")[0]!;

export const users = {
  alice: { name: "Alice", email: "alice@example.com", password: "correct horse battery" },
  bob: { name: "Bob", email: "bob@example.com", password: "tr0ub4dor&3 staple" },
};

/** Registers a user and returns their session cookie. */
export const signUp = async (user: (typeof users)[keyof typeof users]) =>
  cookieFrom(await postJson("/auth/register", user));
