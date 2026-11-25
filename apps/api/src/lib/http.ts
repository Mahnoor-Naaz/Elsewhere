import type { Context } from "hono";

/** Parse a JSON body, returning undefined (instead of throwing) if it's invalid. */
export async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
}

type Issue = { path: PropertyKey[]; message: string };

/** A 400 response in one consistent shape for every validation failure. */
export function validationError(c: Context, error: { issues: Issue[] }) {
  return c.json(
    {
      error: "validation_failed",
      issues: error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    },
    400,
  );
}
