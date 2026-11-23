/** Shared, framework-independent security helpers used by server code and tests. */

/** Supabase access tokens are short-lived; refresh cookies must outlive them. */
export const ACCESS_TOKEN_FALLBACK_MAX_AGE = 60 * 60;
export const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 30;

/** Returns separate lifetimes for the access and refresh session cookies. */
export function sessionCookieMaxAges(expiresIn?: number | null) {
  const access =
    typeof expiresIn === "number" && Number.isFinite(expiresIn) && expiresIn > 0
      ? Math.floor(expiresIn)
      : ACCESS_TOKEN_FALLBACK_MAX_AGE;
  return { access, refresh: Math.max(access, REFRESH_TOKEN_MAX_AGE) };
}

/**
 * Resolves a sign-in `next` value to a same-origin path.
 *
 * A leading slash alone is not enough: browsers treat `//host` and `/\host`
 * as network paths, and percent-encoded separators can decode into the same
 * shape. Everything is parsed against a dummy origin and decoded once more so
 * encoded tricks are rejected too.
 */
export function safeInternalPath(value: unknown, fallback = "/admin"): string {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const raw = value.trim();
  if (!raw.startsWith("/") || /[\u0000-\u001f\u007f\\]/.test(raw)) return fallback;

  try {
    const parsed = new URL(raw, "http://internal.invalid");
    if (parsed.origin !== "http://internal.invalid") return fallback;

    let decodedPath = parsed.pathname;
    try {
      decodedPath = decodeURIComponent(decodedPath);
    } catch {
      return fallback;
    }
    if (!decodedPath.startsWith("/") || decodedPath.startsWith("//")) return fallback;
    if (/[\u0000-\u001f\u007f\\]/.test(decodedPath)) return fallback;

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
