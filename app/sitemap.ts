import type { MetadataRoute } from "next";
import { listTournaments } from "@/lib/db/queries";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE_URL.replace(/\/$/, "");
  const routes: MetadataRoute.Sitemap = ["/", "/tournaments", "/players", "/join"].map(
    (path) => ({ url: `${base}${path}`, changeFrequency: "weekly", priority: 0.7 }),
  );

  try {
    const cups = await listTournaments();
    for (const cup of cups) {
      // Drafts must stay undiscoverable until an organiser publishes them.
      if (cup.status === "draft") continue;
      routes.push({
        url: `${base}/tournaments/${cup.slug}`,
        lastModified: cup.createdAt,
        changeFrequency: "daily",
        priority: 0.9,
      });
    }
  } catch {
    // A sitemap request must not fail the whole site when the database is
    // briefly unavailable; static routes are still accurate.
  }

  return routes;
}
