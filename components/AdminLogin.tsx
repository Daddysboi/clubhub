"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { adminSignIn } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Card, Stamp } from "@/components/ui/card";
import { Logo } from "@/components/SiteNav";

const initialState: { error: string | null; lastEmail?: string } = { error: null };

export function AdminLogin({ next = "/admin" }: { next?: string }) {
  const [state, action, pending] = useActionState(adminSignIn, initialState);
  const [showPassword, setShowPassword] = useState(false);

  // Keep the email across a failed attempt so only the password is retyped.
  // The password is deliberately never echoed back into the DOM.
  const lastEmail = state.error ? (state.lastEmail ?? "") : "";

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <Logo />
      </div>

      <Card className="p-6 sm:p-8">
        <form action={action} className="space-y-4">
          <input type="hidden" name="next" value={next} />

          <Field label="Email" htmlFor="email" required>
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              defaultValue={lastEmail}
              key={lastEmail}
              required
            />
          </Field>

          <Field label="Password" htmlFor="password" required>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                className="pr-11"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-[var(--ink-3)] transition hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pitch)]"
              >
                {showPassword ? (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-5"
                    aria-hidden
                  >
                    <path d="M3 3l18 18" />
                    <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                    <path d="M9.4 5.3A9.6 9.6 0 0 1 12 5c5 0 9 4.5 9 7a11.6 11.6 0 0 1-2.4 3.3" />
                    <path d="M6.2 6.7A11.9 11.9 0 0 0 3 12c0 2.5 4 7 9 7a9.7 9.7 0 0 0 4-.85" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-5"
                    aria-hidden
                  >
                    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </Field>

          {state.error ? (
            <Stamp tone="live" className="w-full justify-center py-2">
              {state.error}
            </Stamp>
          ) : null}

          <Button type="submit" block disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>

          <p className="text-center text-sm text-[var(--ink-3)]">
            <Link href="/" className="underline underline-offset-2">
              Back to CupShub
            </Link>
          </p>
        </form>
      </Card>
    </div>
  );
}