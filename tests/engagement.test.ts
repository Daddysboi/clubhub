import { emptyEngagement, COMMENT_WINDOW_MS, MAX_COMMENTS_PER_WINDOW } from "@/lib/engagement";
import { memoryShareText, memoryShareUrl, safeDownloadName } from "@/lib/share";
import { memoryCommentSchema, memoryLikeSchema } from "@/lib/validation";

const UUID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const PHOTO = "1f2504e0-4f89-11d3-9a0c-0305e82c3302";

describe("memory likes", () => {
  it("accepts one photo id and one visitor id", () => {
    expect(memoryLikeSchema.safeParse({ memoryId: PHOTO, visitorId: UUID }).success).toBe(true);
  });

  it("rejects forged or missing ids", () => {
    expect(memoryLikeSchema.safeParse({ memoryId: "photo-1", visitorId: UUID }).success).toBe(false);
    expect(memoryLikeSchema.safeParse({ memoryId: PHOTO, visitorId: "guest" }).success).toBe(false);
    expect(memoryLikeSchema.safeParse({ memoryId: PHOTO }).success).toBe(false);
  });
});

describe("memory comments", () => {
  const base = { memoryId: PHOTO, visitorId: UUID, authorName: "Ada", body: "What a final!" };

  it("accepts a normal comment", () => {
    expect(memoryCommentSchema.safeParse(base).success).toBe(true);
  });

  it("trims whitespace and rejects empty fields", () => {
    const parsed = memoryCommentSchema.parse({ ...base, authorName: "  Ada  ", body: "  Nice  " });
    expect(parsed.authorName).toBe("Ada");
    expect(parsed.body).toBe("Nice");
    expect(memoryCommentSchema.safeParse({ ...base, body: "   " }).success).toBe(false);
    expect(memoryCommentSchema.safeParse({ ...base, authorName: " " }).success).toBe(false);
  });

  it("enforces the name and body length limits", () => {
    expect(memoryCommentSchema.safeParse({ ...base, authorName: "x".repeat(41) }).success).toBe(false);
    expect(memoryCommentSchema.safeParse({ ...base, body: "x".repeat(281) }).success).toBe(false);
    expect(memoryCommentSchema.safeParse({ ...base, body: "x".repeat(280) }).success).toBe(true);
  });

  it("keeps the anonymous anti-spam window small", () => {
    expect(COMMENT_WINDOW_MS).toBe(10 * 60 * 1000);
    expect(MAX_COMMENTS_PER_WINDOW).toBeGreaterThan(0);
  });

  it("starts with an empty engagement snapshot", () => {
    expect(emptyEngagement()).toEqual({ counts: {}, liked: [], comments: {} });
  });
});

describe("share links", () => {
  it("links directly to a photo in its tournament", () => {
    const url = new URL(
      memoryShareUrl("https://cups.example.com", "mastic-fc-2026", PHOTO),
    );
    expect(`${url.origin}${url.pathname}`).toBe(
      "https://cups.example.com/tournaments/mastic-fc-2026",
    );
    expect(url.searchParams.get("photo")).toBe(PHOTO);
  });

  it("builds readable share text with and without a caption", () => {
    expect(memoryShareText("Mastic Cup", "The final")).toBe(
      "A memory from Mastic Cup — The final",
    );
    expect(memoryShareText("Mastic Cup", null)).toBe("A memory from Mastic Cup");
  });
});

describe("download names", () => {
  it("strips headers and path characters from captions", () => {
    const name = safeDownloadName('Final day "../../etc/passwd"', PHOTO);
    expect(name).toMatch(/\.jpg$/);
    expect(name).not.toMatch(/[/\\"]/);
    expect(name).toContain(PHOTO.slice(0, 8));
  });

  it("falls back when a caption has no usable characters", () => {
    expect(safeDownloadName(null, PHOTO)).toBe(`tournament-memory-${PHOTO.slice(0, 8)}.jpg`);
    expect(safeDownloadName("🔥🔥", PHOTO)).toBe(`tournament-memory-${PHOTO.slice(0, 8)}.jpg`);
  });

  it("caps long captions", () => {
    const name = safeDownloadName("x".repeat(200), PHOTO);
    expect(name.length).toBeLessThan(80);
  });
});
