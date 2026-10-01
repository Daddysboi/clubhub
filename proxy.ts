import { NextResponse, type NextRequest } from "next/server";

/**
 * Keeps the organiser session alive across requests.
 *
 * When the access token has expired but a refresh token is present, this
 * exchanges it for a fresh one and writes the new cookies onto the response.
 * Doing it here rather than during render is what lets the new cookies
 * actually persist — server components cannot write cookies.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.next();

  const accessToken = request.cookies.get("sb-access-token")?.value;
  const refreshToken = request.cookies.get("sb-refresh-token")?.value;

  // Nothing to do without a session.
  if (!accessToken && !refreshToken) return NextResponse.next();

  if (accessToken) {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }).catch(() => null);

    // Still valid — leave the request alone.
    if (res?.ok) return NextResponse.next();

    // A network blip should not sign the organiser out.
    if (!res || (res.status !== 401 && res.status !== 403)) {
      return NextResponse.next();
    }
  }

  if (!refreshToken) return NextResponse.next();

  const refreshed = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
  }).catch(() => null);

  // The refresh token is dead too — clear the session so the user gets the
  // sign-in form instead of a broken half-signed-in state.
  if (!refreshed?.ok) {
    const response = NextResponse.next();
    response.cookies.delete("sb-access-token");
    response.cookies.delete("sb-refresh-token");
    response.cookies.delete("sb-user-id");
    return response;
  }

  const data = await refreshed.json().catch(() => null);
  if (!data?.access_token) return NextResponse.next();

  const maxAge = data.expires_in ?? 3600;
  const response = NextResponse.next();
  response.cookies.set("sb-access-token", data.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  response.cookies.set("sb-refresh-token", data.refresh_token ?? refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: data.expires_in ?? 60 * 60 * 24 * 30,
  });

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and images, which never need auth.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};