"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isUuid } from "@/lib/format";
import { safeInternalPath, sessionCookieMaxAges } from "@/lib/security";
import { loginSchema } from "@/lib/validation";

/**
 * Organiser sign-in.
 *
 * Exchanges email + password for a session through the Supabase Auth REST
 * API, then writes the session to cookies by hand. Doing it here rather than
 * in the browser means the app needs only the service key on the server and
 * does not depend on a publishable key being exposed to the client.
 *
 * The cookies written below are the same ones @supabase/ssr reads on the
 * next request, so proxy.ts and getCurrentAdmin() see the session normally.
 */

type ActionState = { error: string | null; lastEmail?: string };

export async function adminSignIn(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeInternalPath(formData.get("next"), "/admin");

  const parsed = loginSchema.safeParse({ email, password });
  if (!parsed.success) {
    return { error: "Enter a valid email and password.", lastEmail: email };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return { error: "Supabase is not configured on the server." };
  }

  let session: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    expires_at?: number;
    user?: { id?: string };
    error?: string;
    error_description?: string;
  };

  try {
    const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });

    session = await res.json();

    if (!res.ok || !session.access_token) {
      // Provider details can contain internal context; log server-side only.
      if (res.status !== 400) console.error("[auth] sign-in failed", res.status);
      return {
        error: res.status === 400 ? "Wrong email or password." : "Could not sign in. Try again.",
        lastEmail: email,
      };
    }
  } catch {
    return { error: "Could not reach the sign-in service. Try again.", lastEmail: email };
  }

  if (!session.access_token || !session.refresh_token) {
    return { error: "Sign-in did not return a session.", lastEmail: email };
  }

  // Keep the service role out of the cookies: the session token is a user
  // token, and the admins table is what actually grants organiser access.
  const { access, refresh } = sessionCookieMaxAges(session.expires_in);
  const userId = session.user?.id ?? "";

  const cookieStore = await cookies();
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };

  cookieStore.set("sb-access-token", session.access_token, { ...cookieOptions, maxAge: access });
  cookieStore.set("sb-refresh-token", session.refresh_token, {
    ...cookieOptions,
    maxAge: refresh,
  });
  if (userId && isUuid(userId)) {
    cookieStore.set("sb-user-id", userId, { ...cookieOptions, maxAge: refresh });
  }

  // `next` was already constrained to a same-origin path on the way in.
  redirect(next);
}

export async function adminSignOut() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("sb-access-token")?.value;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Best effort: revoke the refresh token server-side before dropping cookies,
  // so a stolen copy cannot be exchanged for a new session.
  if (accessToken && url && key) {
    await fetch(`${url}/auth/v1/logout`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }).catch(() => null);
  }

  cookieStore.delete("sb-access-token");
  cookieStore.delete("sb-refresh-token");
  cookieStore.delete("sb-user-id");
  redirect("/admin");
}