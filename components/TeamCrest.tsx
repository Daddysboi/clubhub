import Image from "next/image";
import { teamCode, type Team } from "@/lib/db/schema";
import { initials } from "@/lib/format";

/**
 * Kit crest: uploaded logo, or a two-tone colour block carrying the team's
 * short code. Uses `primaryColor`/`secondaryColor` so squads from one club can
 * still be told apart at a glance; falls back to the legacy `color` column.
 */
export function TeamCrest({
  team,
  size = 40,
  className,
}: {
  team: Pick<
    Team,
    "name" | "logoUrl" | "color" | "primaryColor" | "secondaryColor" | "shortName" | "seed"
  >;
  size?: number;
  className?: string;
}) {
  const primary = team.primaryColor || team.color;

  if (team.logoUrl) {
    return (
      <Image
        src={team.logoUrl}
        alt={`${team.name} crest`}
        width={size}
        height={size}
        unoptimized
        className={`shrink-0 rounded-lg object-cover ${className ?? ""}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className={`grid shrink-0 place-items-center rounded-lg font-black text-white ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(140deg, ${primary} 0%, ${primary} 55%, ${
          team.secondaryColor || "#0f172a"
        } 100%)`,
        fontSize: team.shortName ? Math.max(9, size * 0.34) : Math.max(11, size * 0.36),
        letterSpacing: "-0.02em",
      }}
    >
      {team.shortName ? teamCode(team) : initials(team.name)}
    </span>
  );
}