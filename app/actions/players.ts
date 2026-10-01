"use server";

import { revalidatePath, refresh as refreshCurrentRoute } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/db/auth";
import { players, tournaments } from "@/lib/db/schema";
import { findDuplicatePlayer } from "@/lib/db/queries";
import { firstError, signupSchema } from "@/lib/validation";

export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  playerId?: string;
};

async function slugFor(tournamentId: string | null) {
  if (!tournamentId) return null;
  const rows = await db
    .select({ slug: tournaments.slug })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  return rows[0]?.slug ?? null;
}

function refresh(tournamentId: string | null) {
  // Refetch the current route's RSC payload so a signup shows its own write
  // immediately rather than the pre-signup roster.
  refreshCurrentRoute();
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/players");
  revalidatePath("/join", "layout");
  const slug = slugFor(tournamentId);
  if (slug) revalidatePath(`/tournaments/${slug}`);
}

/**
 * Core signup logic, shared by the tournament form and the standalone form.
 *
 * Duplicate guard: a case-insensitive, whitespace-trimmed match against
 * either the full name or the nickname, scoped to the same tournament.
 */
async function registerPlayer(formData: FormData): Promise<ActionState> {
  const raw = {
    fullName: String(formData.get("fullName") ?? ""),
    nickname: String(formData.get("nickname") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    position: String(formData.get("position") ?? ""),
    tournamentId: String(formData.get("tournamentId") ?? ""),
    photoUrl: String(formData.get("photoUrl") ?? ""),
  };

  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: firstError(parsed.error.flatten().fieldErrors),
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;
  const tournamentId = data.tournamentId || null;

  if (tournamentId) {
    const exists = await db
      .select({ id: tournaments.id })
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId))
      .limit(1);
    if (!exists[0]) return { ok: false, message: "That tournament does not exist." };
  }

  const duplicate = await findDuplicatePlayer({
    fullName: data.fullName,
    nickname: data.nickname || null,
    tournamentId,
  });

  if (duplicate) {
    const nicknameClash =
      duplicate.fullName.trim().toLowerCase() !== data.fullName.trim().toLowerCase();

    return {
      ok: false,
      message: nicknameClash
        ? `The nickname "${(data.nickname ?? "").trim()}" is already taken. Please choose another.`
        : `"${data.fullName.trim()}" is already registered. One entry per person.`,
      fieldErrors: { [nicknameClash ? "nickname" : "fullName"]: ["Already registered"] },
    };
  }

  const inserted = await db
    .insert(players)
    .values({
      fullName: data.fullName.trim(),
      nickname: data.nickname?.trim() || null,
      phone: data.phone?.trim() || null,
      position: data.position,
      tournamentId,
      photoUrl: data.photoUrl || null,
    })
    .returning({ id: players.id });

  refresh(tournamentId);

  return {
    ok: true,
    message: "You are registered. Welcome to the competition!",
    playerId: inserted[0]?.id,
  };
}

/** useActionState variant (two arguments). */
export async function signupPlayer(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return registerPlayer(formData);
}

/** Form-action variant for a specific tournament. */
export async function signupPlayerForm(formData: FormData): Promise<void> {
  await registerPlayer(formData);
}

/** Standalone player — registered once, not tied to any competition. */
export async function signupStandalonePlayer(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const copy = new FormData();
  copy.set("fullName", String(formData.get("fullName") ?? ""));
  copy.set("nickname", String(formData.get("nickname") ?? ""));
  copy.set("phone", String(formData.get("phone") ?? ""));
  copy.set("position", String(formData.get("position") ?? ""));
  copy.set("photoUrl", String(formData.get("photoUrl") ?? ""));
  return registerPlayer(copy);
}

export async function deletePlayer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const playerId = String(formData.get("playerId") ?? "");
  if (!playerId) return { ok: false, message: "Missing player" };

  const existing = await db
    .select({ tournamentId: players.tournamentId, fullName: players.fullName })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);
  if (!existing[0]) return { ok: false, message: "Player not found" };

  await db.delete(players).where(eq(players.id, playerId));

  revalidatePath("/admin");
  refresh(existing[0].tournamentId);

  return { ok: true, message: `${existing[0].fullName} removed` };
}

export async function deletePlayerForm(formData: FormData): Promise<void> { await deletePlayer({ ok: false }, formData); }
  
