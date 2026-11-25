import { beforeEach, describe, expect, test } from "bun:test";
import { app, cookieFrom, db, postJson as json, resetDb, users } from "./test/helpers";

const alice = users.alice;

beforeEach(resetDb);

describe("register", () => {
  test("creates a user, sets an HTTP-only cookie, and hides the hash", async () => {
    const res = await json("/auth/register", alice);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.user).toMatchObject({ name: "Alice", email: "alice@example.com" });
    expect(body.user.passwordHash).toBeUndefined();

    const setCookie = res.headers.get("set-cookie")!;
    expect(setCookie).toContain("elsewhere_session=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
  });

  test("stores a hash, not the password", async () => {
    await json("/auth/register", alice);
    expect(db.users[0]!.passwordHash).not.toContain("correct horse");
    expect(db.users[0]!.passwordHash).toStartWith("$argon2id$");
  });

  test("normalizes email, so different casing is a duplicate", async () => {
    await json("/auth/register", alice);
    const res = await json("/auth/register", { ...alice, email: "  ALICE@Example.com " });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("email_taken");
  });

  test("rejects invalid input with field-level errors", async () => {
    const res = await json("/auth/register", { name: "", email: "nope", password: "short" });
    expect(res.status).toBe(400);
    const fields = (await res.json()).issues.map((i: { field: string }) => i.field);
    expect(fields).toEqual(expect.arrayContaining(["name", "email", "password"]));
  });

  test("rejects a non-JSON body", async () => {
    const res = await app.request("/auth/register", { method: "POST", body: "not json" });
    expect(res.status).toBe(400);
  });
});

describe("login", () => {
  beforeEach(async () => {
    await json("/auth/register", alice);
  });

  test("succeeds with the right password and sets a cookie", async () => {
    const res = await json("/auth/login", { email: "alice@example.com", password: alice.password });
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("elsewhere_session=");
    expect((await res.json()).user.email).toBe("alice@example.com");
  });

  test("wrong password and unknown email give the same response", async () => {
    const wrongPassword = await json("/auth/login", { email: "alice@example.com", password: "wrong password" });
    const unknownEmail = await json("/auth/login", { email: "nobody@example.com", password: "whatever123" });
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(await wrongPassword.json()).toEqual(await unknownEmail.json());
  });
});

describe("session", () => {
  test("/me returns the current user when logged in", async () => {
    const cookie = cookieFrom(await json("/auth/register", alice));
    const res = await app.request("/auth/me", { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    expect((await res.json()).user.email).toBe("alice@example.com");
  });

  test("/me is 401 without a cookie", async () => {
    expect((await app.request("/auth/me")).status).toBe(401);
  });

  test("/me is 401 with a tampered cookie", async () => {
    const cookie = cookieFrom(await json("/auth/register", alice));
    const res = await app.request("/auth/me", { headers: { Cookie: `${cookie}x` } });
    expect(res.status).toBe(401);
  });

  test("/me is 401 and clears the cookie if the user was deleted", async () => {
    const cookie = cookieFrom(await json("/auth/register", alice));
    db.users = [];
    const res = await app.request("/auth/me", { headers: { Cookie: cookie } });
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toContain("elsewhere_session=;");
  });

  test("logout clears the cookie", async () => {
    const res = await app.request("/auth/logout", { method: "POST" });
    expect(res.status).toBe(204);
    expect(res.headers.get("set-cookie")).toContain("elsewhere_session=;");
  });
});
