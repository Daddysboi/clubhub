import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { isUuid } from "./format";
import { REFRESH_TOKEN_MAX_AGE } from "./security";

/**
 * Server-owned identity for anonymous engagement.
 *
 * The old browser-local id was just a value in localStorage, so any visitor
 * could read another visitor's id from the public engagement data and act as
 * them. The id now lives in an HttpOnly cookie: the browser still needs no
 * account, but JavaScript and other visitors cannot choose or copy it.
 */

const VISITOR_COOKIE = "cupshub.visitor";

function options() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: REFRESH_TOKEN_MAX_AGE,
  };
}

/** Read-only: safe to call while rendering a public page. */
export async function getVisitorId(): Promise<string | null> {
  const value = (await cookies()).get(VISITOR_COOKIE)?.value;
  return value && isUuid(value) ? value : null;
}

/** Creates the cookie when missing. Call only from a Server Action or Route Handler. */
export async function getOrCreateVisitorId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(VISITOR_COOKIE)?.value;
  if (existing && isUuid(existing)) return existing;

  const id = randomUUID();
  store.set(VISITOR_COOKIE, id, options());
  return id;
}
