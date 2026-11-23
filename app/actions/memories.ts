"use server";

import { revalidatePath, refresh as refreshCurrentRoute } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/db/auth";
import { getTournamentById } from "@/lib/db/queries";
import { matches, tournamentMemories } from "@/lib/db/schema";
import {
  supabaseAdmin,
  publicImageUrl,
  storagePathFromPublicUrl,
  STORAGE_BUCKETS,
} from "@/lib/db/supabase";
import { isUuid } from "@/lib/format";
import {
  contentTypeFor,
  detectImageExtension,
  MAX_PHOTOS_PER_BATCH,
  memoryFileError,
} from "@/lib/images";
import { firstError, memoryMetaSchema } from "@/lib/validation";
import type { ActionState } from "./players";

const BUCKET = STORAGE_BUCKETS.memories;

function refresh(tournamentId: string, slug?: string | null) {
  refreshCurrentRoute();
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/tournaments", "layout");
  if (slug) revalidatePath(`/tournaments/${slug}`);
  else revalidatePath(`/admin/tournaments/${tournamentId}`);
}

/**
 * Bulk upload for a tournament's memory album.
 *
 * The client sends parallel arrays — `photos`, `caption`, `matchId`, `width`,
 * `height` — where index n of each field belongs to photo n. Every field is
 * re-validated here; a malformed caption in one photo never blocks the rest.
 */
export async function uploadMemories(formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const tournamentId = String(formData.get("tournamentId") ?? "");
  if (!isUuid(tournamentId)) return { ok: false, message: "Invalid tournament" };

  const tournament = await getTournamentById(tournamentId);
  if (!tournament) return { ok: false, message: "Tournament not found" };

  const files = formData.getAll("photos").filter((value): value is File => {
    return typeof value !== "string" && typeof value.arrayBuffer === "function" && value.size > 0;
  });
  if (files.length === 0) return { ok: false, message: "Choose at least one photo." };
  if (files.length > MAX_PHOTOS_PER_BATCH) {
    return { ok: false, message: `Choose up to ${MAX_PHOTOS_PER_BATCH} photos at a time.` };
  }

  const captions = formData.getAll("caption");
  const matchIds = formData.getAll("matchId");
  const widths = formData.getAll("width");
  const heights = formData.getAll("height");

  // Only fixtures in this cup may be tagged, and a stale id from the client
  // must not be able to attach a photo to another competition.
  const requestedMatchIds = matchIds
    .map(String)
    .filter((id) => isUuid(id));
  const validMatchIds = new Set<string>();
  if (requestedMatchIds.length > 0) {
    const rows = await db
      .select({ id: matches.id })
      .from(matches)
      .where(eq(matches.tournamentId, tournamentId));
    const allowed = new Set(rows.map((r) => r.id));
    for (const id of requestedMatchIds) if (allowed.has(id)) validMatchIds.add(id);
  }

  const storage = supabaseAdmin().storage.from(BUCKET);
  const added: string[] = [];
  const failed: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    const name = file.name || `Photo ${i + 1}`;

    const parsed = memoryMetaSchema.safeParse({
      tournamentId,
      caption: String(captions[i] ?? ""),
      matchId: validMatchIds.has(String(matchIds[i] ?? "")) ? String(matchIds[i]) : "",
      width: String(widths[i] ?? ""),
      height: String(heights[i] ?? ""),
    });
    if (!parsed.success) {
      failed.push(`${name}: ${firstError(parsed.error.flatten().fieldErrors)}`);
      continue;
    }

    const fileError = memoryFileError(file);
    if (fileError) {
      failed.push(fileError);
      continue;
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const ext = detectImageExtension(bytes.slice(0, 16));
    if (!ext) {
      failed.push(`${name}: this is not a readable JPG, PNG or WebP image.`);
      continue;
    }

    const path = `${tournamentId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await storage.upload(path, bytes, {
      contentType: contentTypeFor(ext),
      upsert: false,
    });
    if (uploadError) {
      // Storage details are internal; the organiser only needs a retry hint.
      console.error("[memories] upload failed", uploadError.message);
      failed.push(`${name}: upload failed. Try again.`);
      continue;
    }

    const url = publicImageUrl(BUCKET, path);
    try {
      await db.insert(tournamentMemories).values({
        tournamentId,
        matchId: parsed.data.matchId || null,
        url,
        caption: parsed.data.caption || null,
        width: parsed.data.width,
        height: parsed.data.height,
      });
      added.push(name);
    } catch {
      // Never leave an orphaned object in storage when the row cannot be saved.
      await supabaseAdmin().storage.from(BUCKET).remove([path]);
      failed.push(`${name}: could not be saved. Try again.`);
    }
  }

  refresh(tournamentId, tournament.slug);

  if (added.length === 0) {
    return { ok: false, message: failed[0] ?? "No photos were uploaded." };
  }
  const suffix = failed.length > 0 ? ` ${failed.length} failed: ${failed.slice(0, 2).join("; ")}` : "";
  return {
    ok: true,
    message: `Added ${added.length} ${added.length === 1 ? "photo" : "photos"}.${suffix}`,
  };
}

export async function deleteMemory(formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const memoryId = String(formData.get("memoryId") ?? "");
  if (!isUuid(memoryId)) return { ok: false, message: "Invalid photo" };

  const rows = await db
    .select()
    .from(tournamentMemories)
    .where(eq(tournamentMemories.id, memoryId))
    .limit(1);
  const memory = rows[0];
  if (!memory) return { ok: false, message: "Photo not found" };

  const path = storagePathFromPublicUrl(memory.url, BUCKET);
  try {
    // Remove the row first. If storage cleanup fails we still have a consistent
    // public site and only an orphaned object, never a visible broken image.
    await db.delete(tournamentMemories).where(eq(tournamentMemories.id, memoryId));
  } catch {
    return { ok: false, message: "Could not remove the photo. Try again." };
  }

  let cleanupFailed = false;
  if (path) {
    const { error } = await supabaseAdmin().storage.from(BUCKET).remove([path]);
    cleanupFailed = Boolean(error);
    if (error) console.error("[memories] storage cleanup failed", error.message);
  }

  const tournament = await getTournamentById(memory.tournamentId);
  refresh(memory.tournamentId, tournament?.slug);
  return {
    ok: true,
    message: cleanupFailed
      ? "Photo removed from the album; the stored file could not be purged."
      : "Photo removed",
  };
}

/** Single-argument wrapper for <form action>. */
export async function deleteMemoryForm(formData: FormData): Promise<void> {
  await deleteMemory(formData);
}
