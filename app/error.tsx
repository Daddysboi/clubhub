"use client";

import { useEffect } from "react";
import Link from "next/link";
import { buttonVariants } from "@/lib/button-variants";

/** Catches render errors below the root layout, so navigation stays usable. */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // No error-reporting service is wired up yet; keep the digest in the
    // console so a screenshot or log can still be traced to a request.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--live)]">
        Something went wrong
      </p>
      <h1 className="mt-3 text-3xl font-black tracking-tight text-[var(--ink)]">
        This page could not load
      </h1>
      <p role="alert" className="mt-3 max-w-md text-sm leading-relaxed text-[var(--ink-2)]">
        The rest of ClubHub is still available. Try again, or head back to the tournament list.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-2.5">
        <button type="button" onClick={retry} className={buttonVariants()}>
          Try again
        </button>
        <Link href="/tournaments" className={buttonVariants({ variant: "secondary" })}>
          Browse cups
        </Link>
      </div>
    </main>
  );
}
