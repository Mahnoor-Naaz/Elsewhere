import { z } from "zod";

export const visibilitySchema = z.enum(["private", "public"]);
export type Visibility = z.infer<typeof visibilitySchema>;

// --- Worlds -----------------------------------------------------------

/**
 * Turns a world name into a URL-friendly slug. Letters and digits from any
 * script are kept (so Japanese or accented names still produce a slug), and
 * everything else becomes a hyphen. Falls back to "world" if nothing is left.
 */
export function slugify(input: string): string {
  const slug = input
    .normalize("NFC") // NFC, not NFKD, so kana like が keep their dakuten
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || "world";
}

// Optional text: blank input becomes null, so a form can send "" to mean "none".
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable();

// Cover images are plain URLs for now; uploads come with the entries phase.
const coverImageSchema = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "Must be an http(s) URL")
  .transform((v) => (v === "" ? null : v))
  .nullable();

// Defaults are NOT set here on purpose. If they lived in this shape, the
// partial() used for updates could silently reset fields the client didn't send.
const worldFields = {
  name: z.string().trim().min(1, "Name is required").max(100),
  description: z.string().trim().max(2000),
  coverImage: coverImageSchema,
  timePeriod: optionalText(100),
  genre: optionalText(50),
  visibility: visibilitySchema,
};

export const createWorldSchema = z.object({
  name: worldFields.name,
  description: worldFields.description.optional(),
  coverImage: worldFields.coverImage.optional(),
  timePeriod: worldFields.timePeriod.optional(),
  genre: worldFields.genre.optional(),
  visibility: worldFields.visibility.optional(),
});
export type CreateWorldInput = z.infer<typeof createWorldSchema>;

export const updateWorldSchema = z
  .object(worldFields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field to update");
export type UpdateWorldInput = z.infer<typeof updateWorldSchema>;

/** What the API returns about a world. */
export type PublicWorld = {
  id: string;
  name: string;
  slug: string;
  description: string;
  coverImage: string | null;
  timePeriod: string | null;
  genre: string | null;
  visibility: Visibility;
  createdAt: string;
  updatedAt: string;
  owner: { id: string; name: string };
};

// --- Auth -------------------------------------------------------------

// Emails are trimmed and lowercased before validation so "Ahmed@X.com" and
// "ahmed@x.com" can never become two accounts.
const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

// The max length keeps hashing cost bounded; argon2 on a megabyte-long
// "password" is an easy way to tie up a server.
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters");

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: emailSchema,
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

// Login deliberately does not re-apply the password rules: an old account
// should always be able to attempt a login, and the answer is just yes or no.
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** What the API returns about a user. Never includes the password hash. */
export type PublicUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};
