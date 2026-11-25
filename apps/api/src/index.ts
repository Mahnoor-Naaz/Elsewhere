import { app } from "./app";
import { env } from "./env";

// Standalone API server (used for local testing with curl). Fail fast if the
// secret is missing instead of waiting for the first login to crash.
void env.jwtSecret;

export default {
  port: 3000,
  fetch: app.fetch,
};
