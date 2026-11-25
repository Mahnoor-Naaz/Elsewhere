// Read lazily (on first use), not at import time. Next.js imports every route
// module during `next build`, when no secrets exist, and that must not crash.
export const env = {
  get jwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error(
        "JWT_SECRET must be set to a random string of at least 32 characters.\n" +
          'Generate one with: bun -e "console.log(crypto.randomUUID() + crypto.randomUUID())"',
      );
    }
    return secret;
  },
  get isProd(): boolean {
    return process.env.NODE_ENV === "production";
  },
};
