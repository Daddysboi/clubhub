"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/tournaments", label: "Cups" },
  { href: "/players", label: "Players" },
  { href: "/join", label: "Join" },
  { href: "/admin", label: "Admin" },
] as const;

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      {/* next/image rather than an <img>: it ships the intrinsic size so the
          mark never shifts the wordmark while it decodes. */}
      <Image
        src="/logo-white-64.png"
        alt=""
        width={28}
        height={28}
        className="size-7 shrink-0"
        priority
      />
      {!compact ? (
        <span className="text-lg font-bold tracking-tight text-white">
          Club<span className="text-[var(--pitch)]">Hub</span>
        </span>
      ) : null}
    </span>
  );
}

export function SiteNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop / tablet: full horizontal nav. */}
      <header className="sticky top-0 z-40 hidden border-b border-[var(--rule)] bg-[var(--surface-a85)] backdrop-blur sm:block">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4">
          <Link href="/" aria-label="CupShub home">
            <Logo />
          </Link>
          <div className="flex items-center gap-1 text-sm">
            {LINKS.map((link) => (
              <NavLink key={link.href} href={link.href} active={isActive(pathname, link.href)}>
                {link.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      {/* Mobile: compact sticky bar. Labels live in the bottom dock instead,
          which frees the whole width for the wordmark and a CTA. */}
      <header className="sticky top-0 z-40 border-b border-[var(--rule)] bg-[var(--surface-a85)] pt-safe backdrop-blur sm:hidden">
        <div className="flex h-14 items-center justify-between gap-2 px-4">
          <Link href="/" aria-label="CupShub home">
            <Logo />
          </Link>
          <Link
            href="/join"
            className="flex min-h-11 items-center rounded-lg bg-[var(--pitch)] px-4 text-sm font-bold text-[var(--accent-ink)] transition active:scale-[0.98]"
          >
            Sign up
          </Link>
        </div>
      </header>

      {/* Mobile bottom dock — thumb reach, 44px targets, clears the
          home indicator. */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--rule)] bg-[var(--surface-a85)] pb-safe backdrop-blur sm:hidden"
      >
        <ul className="grid grid-cols-5">
          {LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-semibold transition active:scale-[0.96]",
                    active ? "text-[var(--pitch)]" : "text-[var(--ink-3)]",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 rounded-full transition",
                      active ? "bg-[var(--pitch)]" : "bg-transparent",
                    )}
                  />
                  <span className="leading-none">{link.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-lg px-3 py-2 font-medium transition hover:bg-[var(--sunken)] hover:text-[var(--ink)]",
        active ? "text-[var(--pitch)]" : "text-[var(--ink-2)]",
      )}
    >
      {children}
    </Link>
  );
}