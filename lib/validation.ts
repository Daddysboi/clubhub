import { z } from "zod";
import { POSITIONS, EVENT_TYPES } from "@/lib/db/schema";
import { FORMAT_IDS, MATCH_STAGES } from "@/lib/stages";

/**
 * Image fields are rendered straight into `<Image src>`, so a bare `z.string()`
 * is not enough. In production only this project's Supabase host is accepted;
 * when the env var is absent (tests, local scaffolding) any https host passes.
 */
export const optionalImageUrl = z.string().trim().refine((value) => {
  if (!value) return true;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && /^(localhost|127\.0\.0\.1)$/.test(parsed.hostname))) {
    return false;
  }

  const configured = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!configured) return true;
  try {
    return parsed.hostname === new URL(configured).hostname;
  } catch {
    return true;
  }
}, "Use an image URL from this site's storage");

export const signupSchema = z.object({
  tournamentId: z.string().uuid().optional().or(z.literal("")),
  fullName: z
    .string()
    .trim()
    .min(2, "Please enter your full name")
    .max(80, "Name is too long"),
  nickname: z
    .string()
    .trim()
    .max(40, "Nickname is too long")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{6,20}$/, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
  position: z.enum(POSITIONS, {
    error: "Choose a position",
  }),
  photoUrl: optionalImageUrl.optional().default(""),
});

export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(6, "Password too short"),
});

export const tournamentSchema = z.object({
  name: z.string().trim().min(3, "Tournament name is too short").max(80),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{3,60}$/, "Slug: lowercase letters, numbers and dashes only"),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  clubName: z.string().trim().max(80).optional().or(z.literal("")),
  venue: z.string().trim().max(120).optional().or(z.literal("")),
  startDate: z.string().optional().or(z.literal("")),
  format: z.enum(FORMAT_IDS).default("league"),
  status: z.enum(["draft", "live", "done"]),
});

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Colour must be a hex value like #16a34a");

export const teamSchema = z.object({
  tournamentId: z.string().uuid(),
  name: z.string().trim().min(1, "Team name required").max(40),
  shortName: z
    .string()
    .trim()
    .max(4, "Short code: up to 4 characters")
    .regex(/^[a-zA-Z0-9]*$/, "Short code: letters and numbers only")
    .optional()
    .or(z.literal("")),
  captainPlayerId: z.string().uuid().optional().or(z.literal("")),
  color: hexColor.optional(),
  primaryColor: hexColor.optional(),
  secondaryColor: hexColor.optional(),
  logoUrl: optionalImageUrl.optional().default(""),
});

/**
 * Captain or manager assignment. The role field picks which column is written,
 * so one action serves both pickers. The chosen player must actually play for
 * that team, so membership is checked in the action.
 */
export const roleSchema = z.object({
  teamId: z.string().uuid(),
  role: z.enum(["captain", "manager"]),
  playerId: z.string().uuid().optional().or(z.literal("")),
});

export const playerEditSchema = z.object({
  playerId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(80),
  nickname: z.string().trim().max(40).optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  position: z.enum(POSITIONS),
  tournamentId: z.string().uuid().optional().or(z.literal("")),
});

export const assignSchema = z.object({
  playerId: z.string().uuid(),
  teamId: z.string().uuid().optional().or(z.literal("")),
});

/** A kickoff must be an instant, never a bare local time the server guesses at. */
const optionalIsoInstant = z
  .string()
  .trim()
  .refine(
    (value) =>
      !value ||
      (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(value) &&
        !Number.isNaN(Date.parse(value))),
    "Use a valid kickoff date and time with a timezone",
  )
  .optional()
  .default("");

export const matchSchema = z.object({
  tournamentId: z.string().uuid(),
  homeTeamId: z.string().uuid("Pick a home team"),
  awayTeamId: z.string().uuid("Pick an away team"),
  round: z.coerce.number().int().min(1).max(99).default(1),
  stage: z.enum(MATCH_STAGES).default("group"),
  scheduledAt: optionalIsoInstant,
  venue: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(300).optional().or(z.literal("")),
}).refine((v) => v.homeTeamId !== v.awayTeamId, {
  message: "A team cannot play itself",
  path: ["awayTeamId"],
});

/** Per-photo metadata submitted alongside a bulk memory upload. */
export const memoryMetaSchema = z.object({
  tournamentId: z.string().uuid("Invalid tournament"),
  caption: z.string().trim().max(140, "Caption is too long").optional().or(z.literal("")),
  matchId: z.string().uuid().optional().or(z.literal("")),
  width: z.coerce.number().int().min(1).max(20000),
  height: z.coerce.number().int().min(1).max(20000),
});

export const memoryLikeSchema = z.object({
  memoryId: z.string().uuid("Invalid photo"),
  visitorId: z.string().uuid("Invalid visitor"),
});

export const memoryCommentSchema = z.object({
  memoryId: z.string().uuid("Invalid photo"),
  visitorId: z.string().uuid("Invalid visitor"),
  authorName: z
    .string()
    .trim()
    .min(2, "Add your name")
    .max(40, "Name is too long"),
  body: z
    .string()
    .trim()
    .min(1, "Write a comment")
    .max(280, "Keep it under 280 characters"),
});

export const scoreSchema = z.object({
  matchId: z.string().uuid(),
  homeScore: z.coerce.number().int().min(0).max(99),
  awayScore: z.coerce.number().int().min(0).max(99),
  status: z.enum(["scheduled", "live", "finished"]),
});

export const eventSchema = z.object({
  matchId: z.string().uuid("Invalid match"),
  playerId: z.string().uuid("Choose a player"),
  teamId: z.string().uuid("Choose a team"),
  type: z.enum(EVENT_TYPES, { error: "Choose an event type" }),
  minute: z
    .string()
    .trim()
    .regex(/^(\d{1,3})$/, "Minute must be a whole number between 0 and 130")
    .refine((v) => Number(v) <= 130, "Minute must be 130 or less")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? null : Number(v))),
  note: z.string().trim().max(120).optional().or(z.literal("")),
});

export type EventInput = z.infer<typeof eventSchema>;

export type DuplicateVerdict =
  | { kind: "allow" }
  | { kind: "nickname-taken"; nickname: string }
  | { kind: "name-taken"; name: string };

/**
 * Decide whether a submitted player collides with an existing row.
 *
 * Names are not unique in the real world, so a shared name is allowed. The
 * nickname is the unique handle instead: the team sheet and scorer board both
 * key off it, so two players must never share one.
 *
 * When the name is taken and either side has no nickname, the two rows cannot
 * be told apart, so the entry is rejected and the person is asked for a
 * nickname. Supplying a different one clears the clash.
 */
export function classifyDuplicate(input: {
  fullName: string;
  nickname?: string | null;
  existing: { fullName: string; nickname?: string | null };
}): DuplicateVerdict {
  // Collapse internal runs of whitespace so "Temitope   Yusuf" is recognised
  // as the same person as "Temitope Yusuf" even though storage only trims.
  const norm = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

  const name = norm(input.fullName);
  const nick = input.nickname ? norm(input.nickname) : null;
  const theirName = norm(input.existing.fullName);
  const theirNick = input.existing.nickname ? norm(input.existing.nickname) : null;

  // Same nickname is the same person, regardless of how the name is spelled.
  if (nick && theirNick && nick === theirNick) {
    return { kind: "nickname-taken", nickname: input.nickname?.trim() ?? "" };
  }

  if (name === theirName) {
    // Both sides carry a nickname and they differ, so these are two different
    // people who happen to share a name. Allowed.
    if (nick && theirNick) return { kind: "allow" };
    return { kind: "name-taken", name: input.fullName.trim() };
  }

  // Neither field actually collides. Unreachable when the caller only passes a
  // row it matched on name or nickname, but kept so the helper is total.
  return { kind: "allow" };
}

export function firstError(errors: Record<string, string[] | undefined>) {
  for (const message of Object.values(errors)) {
    if (message && message[0]) return message[0];
  }
  return "Something went wrong";
}