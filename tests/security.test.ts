import {
  ACCESS_TOKEN_FALLBACK_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
  safeInternalPath,
  sessionCookieMaxAges,
} from "@/lib/security";
import { likeContains } from "@/lib/search";

describe("safeInternalPath", () => {
  it("keeps ordinary same-site paths", () => {
    expect(safeInternalPath("/admin/tournaments/123")).toBe("/admin/tournaments/123");
    expect(safeInternalPath("/players?q=ada#top")).toBe("/players?q=ada#top");
  });

  it("falls back for missing or non-string values", () => {
    expect(safeInternalPath(undefined)).toBe("/admin");
    expect(safeInternalPath(null)).toBe("/admin");
    expect(safeInternalPath("")).toBe("/admin");
    expect(safeInternalPath(42)).toBe("/admin");
  });

  it("rejects absolute URLs and network-path tricks", () => {
    expect(safeInternalPath("https://evil.test/steal")).toBe("/admin");
    expect(safeInternalPath("//evil.test/steal")).toBe("/admin");
    expect(safeInternalPath("/\\evil.test/steal")).toBe("/admin");
    expect(safeInternalPath("/%2f%2fevil.test/steal")).toBe("/admin");
    expect(safeInternalPath("/admin\nLocation: https://evil.test")).toBe("/admin");
  });
});

describe("sessionCookieMaxAges", () => {
  it("keeps access and refresh lifetimes separate", () => {
    expect(sessionCookieMaxAges(3600)).toEqual({ access: 3600, refresh: REFRESH_TOKEN_MAX_AGE });
  });

  it("falls back when the provider gives no usable lifetime", () => {
    expect(sessionCookieMaxAges(undefined)).toEqual({
      access: ACCESS_TOKEN_FALLBACK_MAX_AGE,
      refresh: REFRESH_TOKEN_MAX_AGE,
    });
    expect(sessionCookieMaxAges(-1).access).toBe(ACCESS_TOKEN_FALLBACK_MAX_AGE);
  });
});

describe("likeContains", () => {
  it("wraps a normal term for a containment search", () => {
    expect(likeContains("  Ada  ")).toBe("%Ada%");
  });

  it("escapes LIKE wildcards and backslashes", () => {
    expect(likeContains("100%")).toBe("%100\\%%");
    expect(likeContains("a_b")).toBe("%a\\_b%");
    expect(likeContains("a\\b")).toBe("%a\\\\b%");
  });
});
