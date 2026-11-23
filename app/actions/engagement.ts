"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/db/auth";
import { getMemoryEngagement, getTournamentById } from "@/lib/db/queries";
import { memoryComments, memoryLikes, tournamentMemories } from "@/lib/db/schema";
import {
  COMMENT_WINDOW_MS,
  MAX_COMMENTS_PER_WINDOW,
  type EngagementResult,
} from "@/lib/engagement";
import { isUuid } from "@/lib/format";
import { firstError, memoryCommentSchema, memoryLikeSchema } from "@/lib/validation";
import { getOrCreateVisitorId } from "@/lib/visitor-server";
import type { ActionState } from "./players";

async function memoryContext(memoryId: string) {
  if (!isUuid(memoryId)) return null;
  const rows = await db
    .select({ id: tournamentMemories.id, tournamentId: tournamentMemories.tournamentId })
    .from(tournamentMemories)
    .where(eq(tournamentMemories.id, memoryId))
    .limit(1);
  const memory = rows[0];
  if (!memory) return null;
  const tournament = await getTournamentById(memory.tournamentId);
  // A draft cup has no public page, so it cannot receive public engagement.
  if (!tournament || tournament.status === "draft") return null;
  return { memory, slug: tournament.slug };
}

async function publishedTournament(tournamentId: string) {
  if (!isUuid(tournamentId)) return null;
  const tournament = await getTournamentById(tournamentId);
  if (!tournament || tournament.status === "draft") return null;
  return tournament;
}

function refresh(slug: string | null) {
  revalidatePath("/tournaments", "layout");
  revalidatePath("/admin");
  if (slug) revalidatePath(`/tournaments/${slug}`);
}

/** Engagement for the current browser; the visitor id is an HttpOnly cookie. */
export async function getMemoryEngagementAction(
  tournamentId: string,
): Promise<EngagementResult> {
  const tournament = await publishedTournament(tournamentId);
  if (!tournament) return { ok: false, message: "Tournament not found" };
  const visitorId = await getOrCreateVisitorId();
  return { ok: true, message: "", snapshot: await getMemoryEngagement(tournamentId, visitorId) };
}

/** Like is a toggle: the same visitor clicking twice removes their like. */
export async function toggleMemoryLike(formData: FormData): Promise<EngagementResult> {
  // Never trust a visitor id submitted by the browser: it is an identity claim.
  const visitorId = await getOrCreateVisitorId();
  const parsed = memoryLikeSchema.safeParse({
    memoryId: String(formData.get("memoryId") ?? ""),
    visitorId,
  });
  if (!parsed.success) {
    return { ok: false, message: firstError(parsed.error.flatten().fieldErrors) };
  }
  const { memoryId } = parsed.data;
  const context = await memoryContext(memoryId);
  if (!context) return { ok: false, message: "Photo not found" };

  const existing = await db
    .select({ memoryId: memoryLikes.memoryId })
    .from(memoryLikes)
    .where(and(eq(memoryLikes.memoryId, memoryId), eq(memoryLikes.visitorId, visitorId)))
    .limit(1);

  if (existing[0]) {
    await db
      .delete(memoryLikes)
      .where(and(eq(memoryLikes.memoryId, memoryId), eq(memoryLikes.visitorId, visitorId)));
  } else {
    await db.insert(memoryLikes).values({ memoryId, visitorId }).onConflictDoNothing();
  }

  refresh(context.slug);
  return {
    ok: true,
    message: existing[0] ? "Like removed" : "Liked",
    snapshot: await getMemoryEngagement(context.memory.tournamentId, visitorId),
  };
}

export async function addMemoryComment(formData: FormData): Promise<EngagementResult> {
  const visitorId = await getOrCreateVisitorId();
  const parsed = memoryCommentSchema.safeParse({
    memoryId: String(formData.get("memoryId") ?? ""),
    visitorId,
    authorName: String(formData.get("authorName") ?? ""),
    body: String(formData.get("body") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, message: firstError(parsed.error.flatten().fieldErrors) };
  }
  const { memoryId, authorName, body } = parsed.data;
  const context = await memoryContext(memoryId);
  if (!context) return { ok: false, message: "Photo not found" };

  // Anonymous comments are cheap to spam, so cap how many one visitor can post
  // across a single cup in a short window.
  const recent = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(memoryComments)
    .innerJoin(tournamentMemories, eq(memoryComments.memoryId, tournamentMemories.id))
    .where(
      and(
        eq(tournamentMemories.tournamentId, context.memory.tournamentId),
        eq(memoryComments.visitorId, visitorId),
        gte(memoryComments.createdAt, new Date(Date.now() - COMMENT_WINDOW_MS)),
      ),
    );
  if ((recent[0]?.n ?? 0) >= MAX_COMMENTS_PER_WINDOW) {
    return { ok: false, message: "Slow down — try again in a few minutes." };
  }

  await db.insert(memoryComments).values({ memoryId, visitorId, authorName, body });

  refresh(context.slug);
  return {
    ok: true,
    message: "Comment added",
    snapshot: await getMemoryEngagement(context.memory.tournamentId, visitorId),
  };
}

export async function deleteMemoryComment(formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const commentId = String(formData.get("commentId") ?? "");
  if (!isUuid(commentId)) return { ok: false, message: "Invalid comment" };

  const rows = await db
    .select({ memoryId: memoryComments.memoryId })
    .from(memoryComments)
    .where(eq(memoryComments.id, commentId))
    .limit(1);
  if (!rows[0]) return { ok: false, message: "Comment not found" };

  const memory = await db
    .select({ tournamentId: tournamentMemories.tournamentId })
    .from(tournamentMemories)
    .where(eq(tournamentMemories.id, rows[0].memoryId))
    .limit(1);
  const tournament = memory[0] ? await getTournamentById(memory[0].tournamentId) : null;

  await db.delete(memoryComments).where(eq(memoryComments.id, commentId));
  refresh(tournament?.slug ?? null);
  return { ok: true, message: "Comment removed" };
}

/** Single-argument wrapper for <form action>. */
export async function deleteMemoryCommentForm(formData: FormData): Promise<void> {
  await deleteMemoryComment(formData);
}
