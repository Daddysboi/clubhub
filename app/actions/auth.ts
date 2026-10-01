"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

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

const COOKIE_MAX_AGE = 60 * 60 * 8; // refresh token lifetime hint

export async function adminSignIn(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin");

  if (!email || !password) {
    return { error: "Enter your email and password.", lastEmail: email };
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
      const invalid = res.status === 400;
      return {
        error: invalid
          ? "Wrong email or password."
          : (session.error_description ?? session.error ?? "Could not sign in. Try again."),
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
  const maxAge = session.expires_in ?? COOKIE_MAX_AGE;
  const userId = session.user?.id ?? "";

  const cookieStore = await cookies();
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };

  cookieStore.set("sb-access-token", session.access_token, { ...cookieOptions, maxAge });
  cookieStore.set("sb-refresh-token", session.refresh_token, { ...cookieOptions, maxAge });
  if (userId) cookieStore.set("sb-user-id", userId, { ...cookieOptions, maxAge });

  // Only redirect to a path on this site — never to an absolute URL, which
  // would turn the sign-in form into an open redirect.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/admin";
  redirect(safeNext);
}

export async function adminSignOut() {
  const cookieStore = await cookies();
  cookieStore.delete("sb-access-token");
  cookieStore.delete("sb-refresh-token");
  cookieStore.delete("sb-user-id");
  redirect("/admin");
}