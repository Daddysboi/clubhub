"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, SectionHeading } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select, Textarea } from "@/components/ui/input";
import { deleteMemoryForm, uploadMemories } from "@/app/actions/memories";
import { deleteMemoryCommentForm } from "@/app/actions/engagement";
import type { GalleryComment } from "@/lib/engagement";
import { MAX_PHOTOS_PER_BATCH, ACCEPTED_IMAGE_TYPES } from "@/lib/images";
import { prepareMemoryImage } from "@/lib/resize-image";
import type { Match, Team, TournamentMemory } from "@/lib/db/schema";

type Draft = {
  id: string;
  preview: string;
  name: string;
  caption: string;
  matchId: string;
  file: File | null;
  width: number;
  height: number;
  preparing: boolean;
  error?: string;
};

export function AdminMemories({
  tournamentId,
  matches,
  teams,
  memories,
  comments,
}: {
  tournamentId: string;
  matches: Match[];
  teams: Team[];
  memories: TournamentMemory[];
  comments: Record<string, GalleryComment[]>;
}) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();
  const urls = useRef<Set<string>>(new Set());

  useEffect(() => {
    const tracked = urls.current;
    return () => tracked.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const matchLabel = new Map(
    matches.map((m) => [
      m.id,
      `Round ${m.round} · ${teamName.get(m.homeTeamId) ?? "?"} vs ${
        teamName.get(m.awayTeamId) ?? "?"
      }`,
    ]),
  );

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (picked.length === 0) return;

    const room = MAX_PHOTOS_PER_BATCH - drafts.length;
    if (room <= 0) {
      setNotice({
        text: `Up to ${MAX_PHOTOS_PER_BATCH} photos per batch. Upload these first.`,
        ok: false,
      });
      return;
    }
    const chosen = picked.slice(0, room);
    if (picked.length > room) {
      setNotice({ text: `Only ${room} photo${room === 1 ? "" : "s"} added to this batch.`, ok: false });
    } else {
      setNotice(null);
    }

    const next: Draft[] = chosen.map((file) => {
      const preview = URL.createObjectURL(file);
      urls.current.add(preview);
      return {
        id: crypto.randomUUID(),
        preview,
        name: file.name,
        caption: "",
        matchId: "",
        file: null,
        width: 0,
        height: 0,
        preparing: true,
      };
    });
    setDrafts((prev) => [...prev, ...next]);

    chosen.forEach(async (file, i) => {
      const id = next[i]!.id;
      try {
        const prepared = await prepareMemoryImage(file);
        setDrafts((prev) =>
          prev.map((d) =>
            d.id === id
              ? {
                  ...d,
                  file: prepared.file,
                  width: prepared.width,
                  height: prepared.height,
                  preparing: false,
                }
              : d,
          ),
        );
      } catch (error) {
        setDrafts((prev) =>
          prev.map((d) =>
            d.id === id
              ? {
                  ...d,
                  preparing: false,
                  error:
                    error instanceof Error
                      ? error.message
                      : "Could not read this image. Try a JPG, PNG or WebP.",
                }
              : d,
          ),
        );
      }
    });
  }

  function removeDraft(id: string) {
    const draft = drafts.find((d) => d.id === id);
    if (draft) {
      URL.revokeObjectURL(draft.preview);
      urls.current.delete(draft.preview);
    }
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  }

  function updateDraft(id: string, patch: Partial<Draft>) {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  function submit() {
    const ready = drafts.filter((d) => d.file && !d.error);
    if (ready.length === 0) {
      setNotice({ text: "Add at least one readable photo first.", ok: false });
      return;
    }

    const data = new FormData();
    data.set("tournamentId", tournamentId);
    for (const draft of ready) {
      data.append("photos", draft.file!);
      data.append("caption", draft.caption);
      data.append("matchId", draft.matchId);
      data.append("width", String(draft.width));
      data.append("height", String(draft.height));
    }

    startTransition(async () => {
      const result = await uploadMemories(data);
      setNotice({
        text: result.message ?? (result.ok ? "Photos uploaded." : "Upload failed."),
        ok: result.ok,
      });
      if (result.ok) {
        for (const draft of ready) {
          URL.revokeObjectURL(draft.preview);
          urls.current.delete(draft.preview);
        }
        setDrafts((prev) => prev.filter((d) => !ready.some((r) => r.id === d.id)));
      }
    });
  }

  return (
    <section className="space-y-8">
      <div>
        <SectionHeading
          title="Memories"
          eyebrow="Documentary"
          action={
            <span className="text-xs text-[var(--ink-3)]">
              {memories.length} {memories.length === 1 ? "photo" : "photos"} published
            </span>
          }
        />

        <Card className="p-5">
          <label
            htmlFor="memory-files"
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[var(--rule-strong)] bg-[var(--paper)]/50 px-4 py-8 text-center transition hover:border-[var(--pitch)]/70 hover:bg-[var(--pitch-a12)]"
          >
            <span className="text-2xl" aria-hidden>
              ＋
            </span>
            <span className="mt-2 font-semibold text-[var(--ink)]">
              Choose photos from this tournament
            </span>
            <span className="mt-1 text-sm text-[var(--ink-3)]">
              JPG, PNG or WebP · up to {MAX_PHOTOS_PER_BATCH} at a time · resized automatically
            </span>
            <input
              id="memory-files"
              type="file"
              multiple
              accept={ACCEPTED_IMAGE_TYPES.join(",")}
              onChange={onPick}
              className="sr-only"
            />
          </label>

          {notice ? (
            <p
              role="status"
              className={`mt-3 text-sm ${notice.ok ? "text-[var(--pitch)]" : "text-[var(--warn)]"}`}
            >
              {notice.text}
            </p>
          ) : null}

          {drafts.length > 0 ? (
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[var(--ink-2)]">
                  Ready to upload ({drafts.length}/{MAX_PHOTOS_PER_BATCH})
                </p>
                <Button
                  type="button"
                  size="sm"
                  onClick={submit}
                  disabled={isPending || drafts.some((d) => d.preparing) || !drafts.some((d) => d.file)}
                >
                  {isPending
                    ? "Uploading…"
                    : drafts.some((d) => d.preparing)
                      ? "Preparing…"
                      : `Upload ${drafts.length} ${drafts.length === 1 ? "photo" : "photos"}`}
                </Button>
              </div>

              <ul className="grid gap-3 sm:grid-cols-2">
                {drafts.map((draft) => (
                  <li key={draft.id} className="flex gap-3 rounded-xl border border-[var(--rule)] bg-[var(--paper)]/50 p-3">
                    <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-[var(--sunken)]">
                      {/* Blob URLs are local and cannot go through the image optimiser. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={draft.preview} alt="" className="size-full object-cover" />
                      {draft.preparing ? (
                        <span className="absolute inset-0 grid place-items-center bg-black/55 text-[11px] font-semibold text-white">
                          Preparing
                        </span>
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-start gap-2">
                        <p className="min-w-0 flex-1 truncate text-xs text-[var(--ink-3)]" title={draft.name}>
                          {draft.name}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeDraft(draft.id)}
                          className="shrink-0 rounded px-1.5 text-xs text-[var(--ink-3)] hover:text-[var(--live)]"
                          aria-label={`Remove ${draft.name}`}
                        >
                          ✕
                        </button>
                      </div>
                      <Textarea
                        aria-label={`Caption for ${draft.name}`}
                        placeholder="Caption (optional)"
                        value={draft.caption}
                        maxLength={140}
                        onChange={(e) => updateDraft(draft.id, { caption: e.target.value })}
                        className="min-h-11 resize-none py-2 text-sm"
                      />
                      <Select
                        aria-label={`Fixture for ${draft.name}`}
                        value={draft.matchId}
                        onChange={(e) => updateDraft(draft.id, { matchId: e.target.value })}
                        className="text-sm"
                      >
                        <option value="">Whole tournament</option>
                        {matches.map((m) => (
                          <option key={m.id} value={m.id}>
                            {matchLabel.get(m.id)}
                          </option>
                        ))}
                      </Select>
                      {draft.error ? (
                        <p role="alert" className="text-xs text-[var(--live)]">
                          {draft.error}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      </div>

      <div>
        <SectionHeading title="Published photos" eyebrow="Album" />
        {memories.length === 0 ? (
          <EmptyState
            title="No memories yet"
            hint="Upload the first photos above. They will appear in the tournament's Memories section."
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {memories.map((memory) => (
              <Card key={memory.id} className="overflow-hidden">
                <div className="relative aspect-[4/3] bg-[var(--sunken)]">
                  {/* Existing URLs are Supabase public objects; plain img keeps
                      the admin panel independent of the image optimiser. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={memory.url} alt={memory.caption ?? "Tournament memory"} className="size-full object-cover" />
                </div>
                <div className="flex items-start gap-2 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--ink)]">
                      {memory.caption || "Untitled memory"}
                    </p>
                    {memory.matchId ? (
                      <p className="mt-0.5 text-xs text-[var(--ink-3)]">
                        {matchLabel.get(memory.matchId) ?? "Match"}
                      </p>
                    ) : null}
                  </div>
                  <ConfirmDialog
                    action={deleteMemoryForm}
                    triggerLabel="Delete"
                    size="sm"
                    title="Delete this photo?"
                    body="It will disappear from the tournament's Memories section and be removed from storage. This cannot be undone."
                  >
                    <input type="hidden" name="memoryId" value={memory.id} />
                  </ConfirmDialog>
                </div>
                <details className="border-t border-[var(--rule)] px-3 py-2">
                  <summary className="cursor-pointer text-xs font-semibold text-[var(--ink-3)] hover:text-[var(--ink)]">
                    Comments ({(comments[memory.id] ?? []).length})
                  </summary>
                  {(comments[memory.id] ?? []).length === 0 ? (
                    <p className="py-2 text-xs text-[var(--ink-3)]">No comments yet.</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {(comments[memory.id] ?? []).map((item) => (
                        <li key={item.id} className="rounded-lg bg-[var(--paper)]/60 px-2.5 py-2">
                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-[var(--ink)]">
                                {item.authorName}
                                <span className="ml-2 font-normal text-[var(--ink-3)]">
                                  {new Date(item.createdAt).toLocaleDateString()}
                                </span>
                              </p>
                              <p className="mt-0.5 break-words text-xs leading-snug text-[var(--ink-2)]">
                                {item.body}
                              </p>
                            </div>
                            <ConfirmDialog
                              action={deleteMemoryCommentForm}
                              triggerLabel="Remove"
                              size="sm"
                              title="Remove this comment?"
                              body={`The comment from ${item.authorName} will be deleted permanently.`}
                            >
                              <input type="hidden" name="commentId" value={item.id} />
                            </ConfirmDialog>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
              </Card>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
