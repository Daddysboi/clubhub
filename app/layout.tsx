import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteNav } from "@/components/SiteNav";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "ClubHub — Tournament Hub",
    template: "%s · ClubHub",
  },
  description:
    "Run end-of-year cups and company tournaments: player signups, team assignment, fixtures, live scores and standings.",
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    siteName: "ClubHub",
    locale: "en_NG",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* suppressHydrationWarning: browser extensions (colour pickers,
          accessibility tools) inject attributes onto <body> before React
          hydrates, which React cannot reconcile. The warning is noise from
          the environment, not from this app's markup. */}
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[var(--pitch)] focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-[var(--accent-ink)]"
        >
          Skip to content
        </a>
        <SiteNav />
        {/* pb-24 clears the fixed mobile bottom dock; the dock is hidden on
            sm+ so desktop returns to natural spacing. */}
        <main id="main-content" tabIndex={-1} className="flex-1 pb-24 sm:pb-0">
          {children}
        </main>
        <footer className="border-t border-[var(--rule)] py-8 text-center text-sm text-[var(--ink-3)]">
          <p className="px-4">Built by Codebyte — coming soon</p>
        </footer>
      </body>
    </html>
  );
}