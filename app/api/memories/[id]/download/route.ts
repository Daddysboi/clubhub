import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tournamentMemories } from "@/lib/db/schema";
import { storagePathFromPublicUrl, supabaseAdmin, STORAGE_BUCKETS } from "@/lib/db/supabase";
import { getTournamentById } from "@/lib/db/queries";
import { isUuid } from "@/lib/format";
import { safeDownloadName, type MemoryImageExtension } from "@/lib/share";

export const dynamic = "force-dynamic";

const MEMORY_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/i;

/**
 * Streams a memory photo as an attachment.
 *
 * A plain <a download> cannot force a download for a cross-origin Supabase
 * URL, so the file is fetched server-side and re-served with a safe filename.
 * Only photos on published cups are reachable here: a draft album must not be
 * downloadable by guessing its photo id.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isUuid(id)) return new Response("Not found", { status: 404 });

  const rows = await db
    .select()
    .from(tournamentMemories)
    .where(eq(tournamentMemories.id, id))
    .limit(1);
  const memory = rows[0];
  if (!memory) return new Response("Not found", { status: 404 });

  const tournament = await getTournamentById(memory.tournamentId);
  if (!tournament || tournament.status === "draft") {
    return new Response("Not found", { status: 404 });
  }

  const path = storagePathFromPublicUrl(memory.url, STORAGE_BUCKETS.memories);
  const match = path ? MEMORY_PATH.exec(path) : null;
  if (!match) return new Response("Invalid image reference", { status: 500 });
  const extension = match[1]!.toLowerCase() as MemoryImageExtension;

  const { data, error } = await supabaseAdmin()
    .storage.from(STORAGE_BUCKETS.memories)
    .download(path!);
  if (error || !data) return new Response("Image unavailable", { status: 502 });

  return new Response(data, {
    headers: {
      "Content-Type": data.type || "image/jpeg",
      "Content-Disposition": `attachment; filename="${safeDownloadName(memory.caption, memory.id, extension)}"`,
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
