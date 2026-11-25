import { app } from "@elsewhere/api/app";
import { Hono } from "hono";
import { handle } from "hono/vercel";

// Hono uses Node-only APIs (crypto, the database driver), and its responses
// depend on cookies, so this route must run on Node and never be cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The API app is written with root-relative paths (/auth, /worlds). Mounting
// it under "/api" here is all it takes to serve it from inside Next.
const api = new Hono();
api.route("/api", app);
api.notFound((c) => c.json({ error: "not_found" }, 404));
api.onError((err, c) => {
  console.error(err);
  return c.json({ error: "internal_error" }, 500);
});

const handler = handle(api);
export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const DELETE = handler;
