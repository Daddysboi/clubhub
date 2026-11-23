import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { admins } from "./schema";
import { sessionCookieMaxAges } from "../security";

/**
 * Returns the signed-in organiser, or null.
 *
 * Two independent checks:
 *   1. Supabase Auth confirms the access token is valid (refreshing it
 *      first if it has expired).
 *   2. The `admins` table confirms this user is on the organiser allowlist.
 *
 * A valid session alone is not enough, and an admins row alone is not enough.
 * Both are required.
 */

const COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

function authUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1${path}`;
}

/** `apikey` identifies the project; `Authorization` carries the user's token. */
function authHeaders(accessToken?: string) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return { apikey: key, Authorization: `Bearer ${accessToken ?? key}` };
}

type Session = { userId: string } | null;

/** Trades a refresh token for a new access token, returning it for immediate use. */
async function refreshSession(refreshToken: string): Promise<string | null> {
  const res = await fetch(authUrl("/token?grant_type=refresh_token"), {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
  }).catch(() => null);

  if (!res?.ok) return null;

  const data = await res.json().catch(() => null);
  if (!data?.access_token || typeof data.access_token !== "string") return null;

  const ages = sessionCookieMaxAges(data.expires_in);

  try {
    const store = await cookies();
    store.set("sb-access-token", data.access_token, { ...COOKIE, maxAge: ages.access });
    if (data.refresh_token) {
      store.set("sb-refresh-token", data.refresh_token, { ...COOKIE, maxAge: ages.refresh });
    }
  } catch {
    // Cookies are read-only during render; proxy.ts persists refreshed tokens.
  }

  // Do not read the token back from the cookie store: during render the write
  // above is intentionally swallowed, so the old expired value would remain.
  return data.access_token;
}

async function currentSessionUser(): Promise<Session> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  const store = await cookies();
  let token = store.get("sb-access-token")?.value;
  if (!token) return null;

  let res = await fetch(authUrl("/user"), {
    headers: authHeaders(token),
    cache: "no-store",
  }).catch(() => null);

  // An expired access token is normal mid-session; refresh and retry once.
  if (res?.status === 401) {
    const refreshToken = store.get("sb-refresh-token")?.value;
    if (!refreshToken) return null;

    const refreshedToken = await refreshSession(refreshToken);
    if (!refreshedToken) return null;

    token = refreshedToken;
    res = await fetch(authUrl("/user"), {
      headers: authHeaders(token),
      cache: "no-store",
    }).catch(() => null);
  }

  if (!res?.ok) return null;

  const user = await res.json().catch(() => null);
  return user?.id ? { userId: user.id } : null;
}

export const getCurrentAdmin = cache(async () => {
  const session = await currentSessionUser();
  if (!session) return null;

  const rows = await db
    .select({ userId: admins.userId, email: admins.email })
    .from(admins)
    .where(eq(admins.userId, session.userId))
    .limit(1);

  return rows[0] ?? null;
});

export async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) throw new Error("Not authorised");
  return admin;
}