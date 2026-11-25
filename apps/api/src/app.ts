import { Hono } from "hono";
import { authRoutes } from "./routes/auth";
import { worldRoutes } from "./routes/worlds";

export const app = new Hono();

app.get("/health", (c) => c.json({ ok: true }));
app.route("/auth", authRoutes);
app.route("/worlds", worldRoutes);

app.notFound((c) => c.json({ error: "not_found" }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "internal_error" }, 500);
});
