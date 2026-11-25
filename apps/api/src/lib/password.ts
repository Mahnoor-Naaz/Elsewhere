import { hash, verify } from "@node-rs/argon2";

// argon2id via @node-rs/argon2: prebuilt native binaries that work under both
// Node (Next.js) and Bun. The library's own defaults are weak (4 MiB of
// memory), so the cost is set explicitly. 64 MiB / 2 passes / 1 lane is the
// same strength Bun.password used, and well above OWASP's minimum.
//
// Hashes use the standard "$argon2id$..." format with the settings stored
// inside, so hashes made earlier by Bun.password still verify, and these
// settings can be raised later without locking anyone out.
const OPTIONS = { memoryCost: 65536, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (password: string) => hash(password, OPTIONS);

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    return await verify(stored, password);
  } catch {
    // A malformed or unsupported stored hash is just "not a match".
    return false;
  }
}

// Used when a login email doesn't exist, so "unknown email" and "wrong
// password" cost about the same time and can't be told apart by timing.
// Computed on first use rather than at import, so importing is cheap.
let dummyHash: Promise<string> | undefined;
export const getDummyHash = () => (dummyHash ??= hashPassword("not-a-real-password"));
