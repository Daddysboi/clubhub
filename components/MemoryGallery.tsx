"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/components/ui/button";
import {
  addMemoryComment,
  getMemoryEngagementAction,
  toggleMemoryLike,
} from "@/app/actions/engagement";
import {
  emptyEngagement,
  type EngagementSnapshot,
  type GalleryComment,
} from "@/lib/engagement";
import { memoryShareText, memoryShareUrl } from "@/lib/share";

export type GalleryPhoto = {
  id: string;
  url: string;
  caption: string | null;
  label: string | null;
  width: number | null;
  height: number | null;
};

const NAME_KEY = "cupshub.comment-name";

function subscribeCommentName(onStoreChange: () => void): () => void {
  function onStorage(event: StorageEvent) {
    if (event.key === NAME_KEY) onStoreChange();
  }
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

function getCommentNameSnapshot(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

function getServerCommentNameSnapshot() {
  return "";
}

type LikeButtonProps = {
  liked: boolean;
  count: number;
  pending: boolean;
  disabled: boolean;
  onLike: () => void;
  tone?: "card" | "lightbox";
};

/** Presentational like control, shared by the cards and the lightbox. */
function LikeButton({
  liked,
  count,
  pending,
  disabled,
  onLike,
  tone = "card",
}: LikeButtonProps) {
  return (
    <button
      type="button"
      onClick={onLike}
      disabled={disabled || pending}
      aria-pressed={liked}
      aria-label={liked ? "Unlike this photo" : "Like this photo"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold transition disabled:opacity-50",
        tone === "lightbox"
          ? "min-h-11 px-3 text-white hover:text-[var(--live)]"
          : cn(
              "min-h-9 px-2",
              liked ? "text-[var(--live)]" : "text-[var(--ink-3)] hover:text-[var(--live)]",
            ),
      )}
    >
      <span aria-hidden className="text-base leading-none">
        {liked ? "♥" : "♡"}
      </span>
      <span className="tabular-nums">{count}</span>
    </button>
  );
}

type ActionRowProps = {
  photo: GalleryPhoto;
  liked: boolean;
  likeCount: number;
  likePending: boolean;
  canInteract: boolean;
  commentCount: number;
  onLike: () => void;
  onOpenComments: () => void;
  onShare: () => void;
};

/** The always-visible engagement bar beneath each thumbnail. */
function ActionRow({
  photo,
  liked,
  likeCount,
  likePending,
  canInteract,
  commentCount,
  onLike,
  onOpenComments,
  onShare,
}: ActionRowProps) {
  return (
    <div className="flex items-center gap-1 border-t border-[var(--rule)] px-2 py-1">
      <LikeButton
        liked={liked}
        count={likeCount}
        pending={likePending}
        disabled={!canInteract}
        onLike={onLike}
      />
      <button
        type="button"
        onClick={onOpenComments}
        aria-label="View comments"
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-[var(--ink-3)] transition hover:text-[var(--info)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pitch)]"
      >
        <span aria-hidden>✎</span>
        <span className="tabular-nums">{commentCount}</span>
      </button>
      <button
        type="button"
        onClick={onShare}
        aria-label="Share this photo"
        className="ml-auto inline-flex min-h-9 items-center rounded-lg px-2 text-base text-[var(--ink-3)] transition hover:text-[var(--pitch)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pitch)]"
      >
        <span aria-hidden>↗</span>
      </button>
      <a
        href={`/api/memories/${photo.id}/download`}
        download
        aria-label="Download this photo"
        className="inline-flex min-h-9 items-center rounded-lg px-2 text-base text-[var(--ink-3)] transition hover:text-[var(--pitch)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pitch)]"
      >
        <span aria-hidden>↓</span>
      </a>
    </div>
  );
}

/**
 * Tournament photo album. Photos sit in a horizontal snap rail so the album
 * stays one compact band instead of a tall masonry grid that shoves fixtures
 * and the table down the page. The lightbox carries likes, comments, sharing
 * and downloading, and is fully keyboard-operable (Esc, arrows).
 */
export function MemoryGallery({
  photos,
  tournamentId,
  slug,
  tournamentName,
  initialPhotoId,
}: {
  photos: GalleryPhoto[];
  tournamentId: string;
  slug: string;
  tournamentName: string;
  /** From ?photo=<id> on a shared link; resolved by the server for hydration. */
  initialPhotoId?: string | null;
}) {
  const [active, setActive] = useState<number | null>(() => {
    if (!initialPhotoId) return null;
    const index = photos.findIndex((photo) => photo.id === initialPhotoId);
    return index >= 0 ? index : null;
  });
  const [snapshot, setSnapshot] = useState<EngagementSnapshot>(emptyEngagement);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [body, setBody] = useState("");
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);

  function scrollRail(direction: -1 | 1) {
    const rail = railRef.current;
    if (!rail) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    rail.scrollBy({
      left: direction * Math.max(240, rail.clientWidth * 0.8),
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }

  const savedName = useSyncExternalStore(
    subscribeCommentName,
    getCommentNameSnapshot,
    getServerCommentNameSnapshot,
  );
  const name = nameOverride ?? savedName;

  // Identity is an HttpOnly cookie owned by the server; the client never sees
  // or submits it. The album itself stays server-rendered.
  useEffect(() => {
    let cancelled = false;
    getMemoryEngagementAction(tournamentId).then((result) => {
      if (!cancelled && result.ok && result.snapshot) setSnapshot(result.snapshot);
    });
    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  const syncUrl = useCallback(
    (index: number | null) => {
      const url = new URL(window.location.href);
      if (index === null) url.searchParams.delete("photo");
      else url.searchParams.set("photo", photos[index]!.id);
      window.history.replaceState(window.history.state, "", url);
    },
    [photos],
  );

  const close = useCallback(() => {
    setActive(null);
    setShowComments(false);
    syncUrl(null);
    openerRef.current?.focus();
  }, [syncUrl]);

  const step = useCallback(
    (direction: number) => {
      if (active === null || photos.length === 0) return;
      const next = (active + direction + photos.length) % photos.length;
      setActive(next);
      setShowComments(false);
      syncUrl(next);
    },
    [active, photos.length, syncUrl],
  );

  useEffect(() => {
    if (active === null) return;
    closeRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      // Keep Tab inside the lightbox. A plain aria-modal does not stop the
      // browser's native focus order from reaching the cards behind it.
      if (event.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        } else if (!dialogRef.current?.contains(document.activeElement)) {
          event.preventDefault();
          first.focus();
        }
        return;
      }

      const target = event.target as HTMLElement | null;
      const typing = Boolean(
        target?.closest("input, textarea, select, [contenteditable='true']"),
      );
      if (typing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        step(1);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        step(-1);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [active, close, step]);

  function open(index: number, event?: React.MouseEvent<HTMLButtonElement>) {
    if (event) openerRef.current = event.currentTarget;
    setActive(index);
    setShowComments(false);
    syncUrl(index);
  }

  function openComments(photoId: string) {
    const index = photos.findIndex((photo) => photo.id === photoId);
    if (index >= 0) open(index);
    setShowComments(true);
  }

  async function like(photoId: string) {
    if (busy) return;
    const data = new FormData();
    data.set("memoryId", photoId);
    setBusy(`like:${photoId}`);
    setNotice(null);
    const result = await toggleMemoryLike(data);
    if (result.ok && result.snapshot) setSnapshot(result.snapshot);
    else setNotice(result.message);
    setBusy(null);
  }

  async function comment(event: React.FormEvent<HTMLFormElement>, photoId: string) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData();
    data.set("memoryId", photoId);
    data.set("authorName", name);
    data.set("body", body);
    setBusy(`comment:${photoId}`);
    setNotice(null);
    const result = await addMemoryComment(data);
    if (result.ok && result.snapshot) {
      setSnapshot(result.snapshot);
      setBody("");
      try {
        window.localStorage.setItem(NAME_KEY, name.trim());
      } catch {
        // Non-fatal: the name just will not be remembered next visit.
      }
    } else {
      setNotice(result.message);
    }
    setBusy(null);
  }

  async function share(photo: GalleryPhoto) {
    const url = memoryShareUrl(window.location.origin, slug, photo.id);
    const text = memoryShareText(tournamentName, photo.caption);
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: tournamentName, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setNotice("Link copied to clipboard");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      window.prompt("Copy this link", url);
    }
  }

  const current = active === null ? null : photos[active];
  const currentComments: GalleryComment[] = current
    ? (snapshot.comments[current.id] ?? [])
    : [];

  return (
    <>
      {notice ? (
        <p role="status" className="mb-3 text-sm text-[var(--info)]">
          {notice}
        </p>
      ) : null}

      <div className="mb-2 flex justify-end gap-1">
        <button
          type="button"
          onClick={() => scrollRail(-1)}
          aria-label="Scroll memories left"
          className="grid size-9 place-items-center rounded-lg border border-[var(--rule-strong)] text-base text-[var(--ink-2)] transition hover:bg-[var(--sunken)] max-sm:size-11"
        >
          <span aria-hidden>‹</span>
        </button>
        <button
          type="button"
          onClick={() => scrollRail(1)}
          aria-label="Scroll memories right"
          className="grid size-9 place-items-center rounded-lg border border-[var(--rule-strong)] text-base text-[var(--ink-2)] transition hover:bg-[var(--sunken)] max-sm:size-11"
        >
          <span aria-hidden>›</span>
        </button>
      </div>

      <div
        ref={railRef}
        role="region"
        aria-label="Tournament memories"
        tabIndex={0}
        aria-hidden={active !== null}
        inert={active !== null}
        className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2"
      >
        {photos.map((photo, index) => {
          const width = photo.width || 1200;
          const height = photo.height || 900;
          return (
            <article
              key={photo.id}
              className="group w-[70%] shrink-0 snap-start overflow-hidden rounded-xl border border-[var(--rule)] bg-[var(--surface)] transition hover:border-[var(--pitch)]/60 sm:w-[46%] lg:w-[31%]"
            >
              <button
                type="button"
                onClick={(event) => open(index, event)}
                aria-label={`Open photo${photo.caption ? `: ${photo.caption}` : ""}`}
                className="block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pitch)]"
              >
                <span className="relative block overflow-hidden">
                  <Image
                    src={photo.url}
                    alt={photo.caption ?? "Tournament memory"}
                    width={width}
                    height={height}
                    sizes="(max-width: 640px) 70vw, (max-width: 1024px) 46vw, 31vw"
                    className="h-44 w-full object-cover transition duration-300 group-hover:scale-[1.03] sm:h-48"
                  />
                  <span
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-80"
                  />
                  <span className="absolute inset-x-2 bottom-2 line-clamp-2 text-xs font-semibold leading-snug text-white">
                    {photo.caption ?? photo.label ?? "Match day"}
                  </span>
                </span>
              </button>
              <ActionRow
                photo={photo}
                liked={snapshot.liked.includes(photo.id)}
                likeCount={snapshot.counts[photo.id] ?? 0}
                likePending={busy === `like:${photo.id}`}
                canInteract
                commentCount={snapshot.comments[photo.id]?.length ?? 0}
                onLike={() => like(photo.id)}
                onOpenComments={() => openComments(photo.id)}
                onShare={() => share(photo)}
              />
            </article>
          );
        })}
      </div>

      {current ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div className="flex items-center gap-2 px-3 py-3 text-white sm:px-6">
            <span aria-live="polite" className="mr-auto text-sm tabular-nums text-white/70">
              {active! + 1} / {photos.length}
            </span>
            <div className="flex items-center gap-1 rounded-xl bg-white/5 p-1">
              <LikeButton
                liked={snapshot.liked.includes(current.id)}
                count={snapshot.counts[current.id] ?? 0}
                pending={busy === `like:${current.id}`}
                disabled={busy !== null}
                onLike={() => like(current.id)}
                tone="lightbox"
              />
              <button
                type="button"
                onClick={() => share(current)}
                aria-label="Share this photo"
                className="grid min-h-11 min-w-11 place-items-center rounded-lg text-xl text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pitch)]"
              >
                ↗
              </button>
              <a
                href={`/api/memories/${current.id}/download`}
                download
                aria-label="Download this photo"
                className="grid min-h-11 min-w-11 place-items-center rounded-lg text-xl text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pitch)]"
              >
                ↓
              </a>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={close}
              aria-label="Close photo viewer"
              className="grid size-11 place-items-center rounded-lg text-3xl leading-none text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[var(--pitch)]"
            >
              ×
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-2">
            <Image
              src={current.url}
              alt={current.caption ?? "Tournament memory"}
              width={current.width || 1600}
              height={current.height || 1200}
              sizes="100vw"
              className="max-h-[68dvh] w-auto max-w-full rounded-lg object-contain"
            />
            {photos.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label="Previous photo"
                  className="absolute left-2 grid size-11 place-items-center rounded-full bg-black/50 text-2xl text-white transition hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-[var(--pitch)] sm:left-6"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label="Next photo"
                  className="absolute right-2 grid size-11 place-items-center rounded-full bg-black/50 text-2xl text-white transition hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-[var(--pitch)] sm:right-6"
                >
                  ›
                </button>
              </>
            ) : null}
          </div>

          <div className="mx-auto w-full max-w-2xl px-4 pb-6 pt-2 text-center">
            {current.caption ? (
              <p className="text-base font-semibold leading-snug text-white">{current.caption}</p>
            ) : null}
            {current.label ? (
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/60">
                {current.label}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => setShowComments((value) => !value)}
              aria-expanded={showComments}
              className="mt-3 min-h-11 rounded-lg px-3 py-1.5 text-sm font-semibold text-white/80 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pitch)]"
            >
              {showComments ? "Hide" : "Show"} comments ({currentComments.length})
            </button>

            {showComments ? (
              <div className="mt-3 max-h-52 overflow-y-auto rounded-xl border border-white/15 bg-white/5 p-3 text-left thin-scroll">
                {currentComments.length === 0 ? (
                  <p className="py-2 text-center text-sm text-white/60">
                    No comments yet. Start the conversation.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {currentComments.map((item) => (
                      <li key={item.id} className="rounded-lg bg-black/25 px-3 py-2">
                        <p className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-bold text-white">{item.authorName}</span>
                          <time
                            dateTime={item.createdAt}
                            className="text-[11px] text-white/50"
                          >
                            {new Date(item.createdAt).toLocaleDateString()}
                          </time>
                        </p>
                        <p className="mt-0.5 break-words text-sm leading-snug text-white/80">
                          {item.body}
                        </p>
                        {item.mine ? (
                          <span className="mt-1 inline-block text-[10px] uppercase tracking-widest text-[var(--pitch)]">
                            Yours
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}

                <form onSubmit={(event) => comment(event, current.id)} className="mt-3 space-y-2">
                  <label className="block">
                    <span className="sr-only">Your name</span>
                    <input
                      value={name}
                      onChange={(event) => setNameOverride(event.target.value)}
                      placeholder="Your name"
                      maxLength={40}
                      required
                      className="w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-[var(--pitch)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pitch)]"
                    />
                  </label>
                  <label className="block">
                    <span className="sr-only">Your comment</span>
                    <input
                      value={body}
                      onChange={(event) => setBody(event.target.value)}
                      placeholder="Write a comment…"
                      maxLength={280}
                      required
                      className="w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-[var(--pitch)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pitch)]"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={busy === `comment:${current.id}`}
                    className={cn(buttonVariants({ size: "sm" }), "w-full sm:w-auto")}
                  >
                    {busy === `comment:${current.id}` ? "Posting…" : "Post comment"}
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
