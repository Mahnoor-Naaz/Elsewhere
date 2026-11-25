import { beforeEach, describe, expect, test } from "bun:test";
import { app, postJson, resetDb, signUp, users } from "./test/helpers";

beforeEach(resetDb);

const get = (path: string, cookie?: string) =>
  app.request(path, { headers: cookie ? { Cookie: cookie } : {} });
const patch = (path: string, body: unknown, cookie?: string) => postJson(path, body, cookie, "PATCH");
const del = (path: string, cookie?: string) =>
  app.request(path, { method: "DELETE", headers: cookie ? { Cookie: cookie } : {} });

/** Creates a world as the given user and returns the world object. */
const makeWorld = async (cookie: string, body: Record<string, unknown> = { name: "Raffauzer" }) =>
  (await (await postJson("/worlds", body, cookie)).json()).world;

describe("create", () => {
  test("requires login", async () => {
    expect((await postJson("/worlds", { name: "X" })).status).toBe(401);
  });

  test("creates a private world with defaults, a slug, and the owner's name", async () => {
    const cookie = await signUp(users.alice);
    const res = await postJson("/worlds", { name: "The World of the Saints" }, cookie);
    expect(res.status).toBe(201);
    const { world } = await res.json();
    expect(world).toMatchObject({
      name: "The World of the Saints",
      slug: "the-world-of-the-saints",
      description: "",
      coverImage: null,
      timePeriod: null,
      genre: null,
      visibility: "private",
      owner: { name: "Alice" },
    });
  });

  test("gives a second world with the same name a numbered slug", async () => {
    const cookie = await signUp(users.alice);
    const slugs = [];
    for (let i = 0; i < 3; i++) slugs.push((await makeWorld(cookie)).slug);
    expect(slugs).toEqual(["raffauzer", "raffauzer-2", "raffauzer-3"]);
  });

  test("two different users can use the same slug", async () => {
    const a = await makeWorld(await signUp(users.alice));
    const b = await makeWorld(await signUp(users.bob));
    expect(a.slug).toBe("raffauzer");
    expect(b.slug).toBe("raffauzer");
  });

  test("handles non-Latin and symbol-only names", async () => {
    const cookie = await signUp(users.alice);
    expect((await makeWorld(cookie, { name: "長い午後" })).slug).toBe("長い午後");
    expect((await makeWorld(cookie, { name: "!!!" })).slug).toBe("world");
  });

  test("turns blank optional text into null", async () => {
    const cookie = await signUp(users.alice);
    const world = await makeWorld(cookie, { name: "X", genre: "  ", timePeriod: "", coverImage: "" });
    expect(world).toMatchObject({ genre: null, timePeriod: null, coverImage: null });
  });

  test("rejects bad input with field-level errors", async () => {
    const cookie = await signUp(users.alice);
    const res = await postJson(
      "/worlds",
      { name: " ", coverImage: "javascript:alert(1)", visibility: "secret" },
      cookie,
    );
    expect(res.status).toBe(400);
    const fields = (await res.json()).issues.map((i: { field: string }) => i.field);
    expect(fields).toEqual(expect.arrayContaining(["name", "coverImage", "visibility"]));
  });
});

describe("list mine", () => {
  test("requires login", async () => {
    expect((await get("/worlds/mine")).status).toBe(401);
  });

  test("returns only my worlds, most recently updated first", async () => {
    const alice = await signUp(users.alice);
    const bob = await signUp(users.bob);
    const first = await makeWorld(alice, { name: "First" });
    await makeWorld(alice, { name: "Second" });
    await makeWorld(bob, { name: "Bob's" });
    await patch(`/worlds/${first.id}`, { description: "touched" }, alice); // bumps updatedAt

    const { worlds } = await (await get("/worlds/mine", alice)).json();
    expect(worlds.map((w: { name: string }) => w.name)).toEqual(["First", "Second"]);
  });
});

describe("read one", () => {
  test("the owner can read their private world", async () => {
    const alice = await signUp(users.alice);
    const world = await makeWorld(alice);
    expect((await get(`/worlds/${world.id}`, alice)).status).toBe(200);
  });

  test("a private world is 404 for strangers and anonymous visitors", async () => {
    const world = await makeWorld(await signUp(users.alice));
    const bob = await signUp(users.bob);
    expect((await get(`/worlds/${world.id}`, bob)).status).toBe(404);
    expect((await get(`/worlds/${world.id}`)).status).toBe(404);
  });

  test("a public world is readable by anyone, including anonymous visitors", async () => {
    const world = await makeWorld(await signUp(users.alice), { name: "Open", visibility: "public" });
    const res = await get(`/worlds/${world.id}`);
    expect(res.status).toBe(200);
    expect((await res.json()).world.owner.name).toBe("Alice");
  });

  test("an unknown id is 404", async () => {
    expect((await get("/worlds/does-not-exist")).status).toBe(404);
  });
});

describe("update", () => {
  test("requires login", async () => {
    const world = await makeWorld(await signUp(users.alice));
    expect((await patch(`/worlds/${world.id}`, { name: "Y" })).status).toBe(401);
  });

  test("the owner can change fields, and untouched fields stay as they were", async () => {
    const alice = await signUp(users.alice);
    const world = await makeWorld(alice, {
      name: "Raffauzer",
      description: "A river town.",
      genre: "Fantasy",
      visibility: "public",
    });

    const res = await patch(`/worlds/${world.id}`, { name: "Raffauzer Reborn" }, alice);
    expect(res.status).toBe(200);
    expect((await res.json()).world).toMatchObject({
      name: "Raffauzer Reborn",
      slug: "raffauzer", // the slug is stable across renames
      description: "A river town.", // not reset by a partial update
      genre: "Fantasy",
      visibility: "public",
    });
  });

  test("a field can be cleared with null, and visibility can be toggled", async () => {
    const alice = await signUp(users.alice);
    const world = await makeWorld(alice, { name: "X", genre: "Fantasy" });
    const res = await patch(`/worlds/${world.id}`, { genre: null, visibility: "public" }, alice);
    expect((await res.json()).world).toMatchObject({ genre: null, visibility: "public" });
  });

  test("an empty update is a 400", async () => {
    const alice = await signUp(users.alice);
    const world = await makeWorld(alice);
    expect((await patch(`/worlds/${world.id}`, {}, alice)).status).toBe(400);
  });

  test("someone else's public world is 403, and their private world is 404", async () => {
    const alice = await signUp(users.alice);
    const bob = await signUp(users.bob);
    const open = await makeWorld(alice, { name: "Open", visibility: "public" });
    const secret = await makeWorld(alice, { name: "Secret" });
    expect((await patch(`/worlds/${open.id}`, { name: "Hacked" }, bob)).status).toBe(403);
    expect((await patch(`/worlds/${secret.id}`, { name: "Hacked" }, bob)).status).toBe(404);
  });

  test("an unknown id is 404", async () => {
    const alice = await signUp(users.alice);
    expect((await patch("/worlds/nope", { name: "Y" }, alice)).status).toBe(404);
  });
});

describe("delete", () => {
  test("the owner can delete, and the world is gone afterwards", async () => {
    const alice = await signUp(users.alice);
    const world = await makeWorld(alice);
    expect((await del(`/worlds/${world.id}`, alice)).status).toBe(204);
    expect((await get(`/worlds/${world.id}`, alice)).status).toBe(404);
  });

  test("requires login", async () => {
    const world = await makeWorld(await signUp(users.alice));
    expect((await del(`/worlds/${world.id}`)).status).toBe(401);
  });

  test("a non-owner can't delete (403 for public, 404 for private) and nothing is lost", async () => {
    const alice = await signUp(users.alice);
    const bob = await signUp(users.bob);
    const open = await makeWorld(alice, { name: "Open", visibility: "public" });
    const secret = await makeWorld(alice, { name: "Secret" });
    expect((await del(`/worlds/${open.id}`, bob)).status).toBe(403);
    expect((await del(`/worlds/${secret.id}`, bob)).status).toBe(404);
    expect((await get(`/worlds/${open.id}`)).status).toBe(200);
    expect((await get(`/worlds/${secret.id}`, alice)).status).toBe(200);
  });
});
