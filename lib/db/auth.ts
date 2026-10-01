import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { admins } from "./schema";

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

const COOKIE = { httpOnly: true, secure: false, sameSite: "lax" as const, path: "/" };

function authUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1${path}`;
}

function authHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return { apikey: key, Authorization: `Bearer ${key}` };
}

type Session = { userId: string } | null;

/** Trades a refresh token for a new access token. */
async function refreshSession(refreshToken: string): Promise<boolean> {
  const res = await fetch(authUrl("/token?grant_type=refresh_token"), {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
  }).catch(() => null);

  if (!res?.ok) return false;

  const data = await res.json().catch(() => null);
  if (!data?.access_token) return false;

  const options = {
    ...COOKIE,
    secure: process.env.NODE_ENV === "production",
    maxAge: data.expires_in ?? 3600,
  };

  try {
    const store = await cookies();
    store.set("sb-access-token", data.access_token, options);
    if (data.refresh_token) store.set("sb-refresh-token", data.refresh_token, options);
  } catch {
    // Cookies are read-only during render; proxy.ts persists refreshed tokens.
  }

  return true;
}

async function currentSessionUser(): Promise<Session> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  const store = await cookies();
  let token = store.get("sb-access-token")?.value;
  if (!token) return null;

  let res = await fetch(authUrl("/user"), {
    headers: { ...authHeaders(), Authorization: `Bearer ${token}` },
    cache: "no-store",
  }).catch(() => null);

  // An expired access token is normal mid-session; refresh and retry once.
  if (res?.status === 401) {
    const refreshToken = store.get("sb-refresh-token")?.value;
    if (!refreshToken) return null;

    const refreshed = await refreshSession(refreshToken);
    if (!refreshed) return null;

    token = (await cookies()).get("sb-access-token")?.value ?? token;
    res = await fetch(authUrl("/user"), {
      headers: { ...authHeaders(), Authorization: `Bearer ${token}` },
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