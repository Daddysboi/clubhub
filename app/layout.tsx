import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteNav } from "@/components/SiteNav";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "ClubHub — Tournament Hub",
    template: "%s · ClubHub",
  },
  description:
    "Run end-of-year cups and company tournaments: player signups, team assignment, fixtures, live scores and standings.",
  manifest: "/site.webmanifest",
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
        <SiteNav />
        {/* pb-24 clears the fixed mobile bottom dock; the dock is hidden on
            sm+ so desktop returns to natural spacing. */}
        <main className="flex-1 pb-24 sm:pb-0">{children}</main>
        <footer className="border-t border-[var(--rule)] py-8 text-center text-sm text-[var(--ink-3)]">
          <p className="px-4">
            Built by{" "}
            {/* Not a link yet: codebyte.ng is not live, so this renders as
                static text. Swap the <span> for an <a href> when it launches. */}
            <span title="codebyte.ng — coming soon">
              <span className="underline decoration-dotted underline-offset-4">
                Codebyte
              </span>{" "}
              <span aria-hidden>→</span>
            </span>
          </p>
        </footer>
      </body>
    </html>
  );
}