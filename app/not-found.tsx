import Link from "next/link";
import { buttonVariants } from "@/lib/button-variants";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--ink-3)]">404</p>
      <h1 className="mt-3 text-3xl font-black tracking-tight text-[var(--ink)]">
        Page not found
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--ink-2)]">
        That link may have changed, or the tournament may no longer be published.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-2.5">
        <Link href="/" className={buttonVariants()}>
          Back to home
        </Link>
        <Link href="/tournaments" className={buttonVariants({ variant: "secondary" })}>
          Browse cups
        </Link>
      </div>
    </main>
  );
}
