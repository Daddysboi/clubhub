/** Pure helpers for sharing and downloading memory photos. */

export type MemoryImageExtension = "jpg" | "png" | "webp";

export function memoryShareUrl(origin: string, slug: string, memoryId: string): string {
  const url = new URL(`/tournaments/${slug}`, origin);
  url.searchParams.set("photo", memoryId);
  return url.toString();
}

export function memoryShareText(tournamentName: string, caption?: string | null): string {
  const note = caption?.trim() ? ` — ${caption.trim()}` : "";
  return `A memory from ${tournamentName}${note}`;
}

/**
 * Turns a caption into a safe attachment name. Keeps it readable but never
 * lets caption text introduce path separators, quotes or header characters.
 */
export function safeDownloadName(
  caption: string | null,
  memoryId: string,
  extension: MemoryImageExtension = "jpg",
): string {
  const stem = (caption ?? "tournament-memory")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${stem || "tournament-memory"}-${memoryId.slice(0, 8)}.${extension}`;
}
