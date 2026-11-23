/** Wire shapes shared by the public gallery, the engagement actions and tests. */

export type GalleryComment = {
  id: string;
  memoryId: string;
  authorName: string;
  body: string;
  createdAt: string;
  /** True when this comment was written by the current browser visitor. */
  mine: boolean;
};

export type EngagementSnapshot = {
  counts: Record<string, number>;
  liked: string[];
  comments: Record<string, GalleryComment[]>;
};

export type EngagementResult = {
  ok: boolean;
  message: string;
  snapshot?: EngagementSnapshot;
};

export function emptyEngagement(): EngagementSnapshot {
  return { counts: {}, liked: [], comments: {} };
}

/** Lightweight anti-spam window for anonymous comments. */
export const COMMENT_WINDOW_MS = 10 * 60 * 1000;
export const MAX_COMMENTS_PER_WINDOW = 5;
