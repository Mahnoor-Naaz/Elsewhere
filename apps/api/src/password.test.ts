import { describe, expect, test } from "bun:test";
import { hashPassword, verifyPassword } from "./lib/password";

// Produced by Bun.password.hash("correct horse battery") before the move to
// @node-rs/argon2. Accounts created back then must keep working.
const LEGACY_BUN_HASH =
  "$argon2id$v=19$m=65536,t=2,p=1$ZW/8a7vVVeQ3x6z14VwQP7mGm6Qqy+tllD2iYZ41ND8$+Dt+uDg27ISZsRZ42mTMbXXlLck95M4gGVo57omSBYs";

describe("password hashing", () => {
  test("round-trips, and rejects a wrong password", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });

  test("uses argon2id at 64 MiB, and salts every hash differently", async () => {
    const a = await hashPassword("same password");
    const b = await hashPassword("same password");
    expect(a).toStartWith("$argon2id$v=19$m=65536,t=2,p=1$");
    expect(a).not.toBe(b);
  });

  test("still verifies hashes made by Bun.password", async () => {
    expect(await verifyPassword("correct horse battery", LEGACY_BUN_HASH)).toBe(true);
    expect(await verifyPassword("wrong password", LEGACY_BUN_HASH)).toBe(false);
  });

  test("treats a malformed stored hash as a non-match instead of throwing", async () => {
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
    expect(await verifyPassword("anything", "scrypt$32768$8$1$AAAA$BBBB")).toBe(false);
  });
});
