import { existsSync, readFileSync } from "node:fs";

/** Production-config guards. These fail loudly if a hardening header or
 *  fallback page is removed during an unrelated UI change. */
describe("production configuration", () => {
  it("sets baseline security headers and hides the framework header", () => {
    const config = readFileSync("next.config.ts", "utf8");
    expect(config).toContain("poweredByHeader: false");
    for (const header of [
      "X-Content-Type-Options",
      "Referrer-Policy",
      "X-Frame-Options",
      "Permissions-Policy",
      "Content-Security-Policy-Report-Only",
      "Strict-Transport-Security",
    ]) {
      expect(config).toContain(header);
    }
  });

  it("ships accessible error and fallback pages", () => {
    for (const file of ["error.tsx", "global-error.tsx", "not-found.tsx"]) {
      expect(existsSync(`app/${file}`)).toBe(true);
    }
    const globalError = readFileSync("app/global-error.tsx", "utf8");
    expect(globalError).toContain('<html lang="en">');
    expect(globalError).toContain("retry: () => void");
    expect(globalError).toContain("onClick={retry}");
  });

  it("keeps streaming loading UI away from 404-sensitive routes", () => {
    expect(existsSync("app/loading.tsx")).toBe(false);
  });

  it("publishes robots and sitemap rules that exclude drafts and admin", () => {
    const robots = readFileSync("app/robots.ts", "utf8");
    const sitemap = readFileSync("app/sitemap.ts", "utf8");
    expect(robots).toContain('"/admin"');
    expect(sitemap).toContain('cup.status === "draft"');
    expect(sitemap).toContain("${base}/tournaments/${cup.slug}");
  });

  it("uses a server-safe module for link button styles", () => {
    const page = readFileSync("app/tournaments/[slug]/page.tsx", "utf8");
    expect(page).toContain('from "@/lib/button-variants"');
    expect(page).not.toContain('from "@/components/ui/button"');
  });
});
