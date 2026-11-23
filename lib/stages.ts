/**
 * Competition structure: formats + stages.
 *
 * A round number alone cannot tell a group game from a final — that ambiguity
 * is how the demo tournament ended up with its final filed under round 1.
 * Stage is explicit data, and the tournament's format decides which stages
 * exist and how they are named. A plain league has no final at all.
 */

export const MATCH_STAGES = ["group", "quarter", "semi", "final"] as const;
export type MatchStage = (typeof MATCH_STAGES)[number];

export function isMatchStage(value: string | null | undefined): value is MatchStage {
  return !!value && (MATCH_STAGES as readonly string[]).includes(value);
}

export function stageOrder(stage: string | null | undefined): number {
  if (stage === "quarter") return 2;
  if (stage === "semi") return 3;
  if (stage === "final") return 4;
  return 1;
}

export const FORMAT_IDS = ["league", "tri_series", "knockout"] as const;
export type FormatId = (typeof FORMAT_IDS)[number];

export const FORMATS: Record<
  FormatId,
  { label: string; hint: string; groupPrefix: string; hasGroups: boolean; hasKnockout: boolean }
> = {
  league: {
    label: "League",
    hint: "Round-robin only. No final.",
    groupPrefix: "Round",
    hasGroups: true,
    hasKnockout: false,
  },
  tri_series: {
    label: "Tri-series",
    hint: "Round-robin group phase, then 1st vs 2nd in a final.",
    groupPrefix: "Group stage · Round",
    hasGroups: true,
    hasKnockout: true,
  },
  knockout: {
    label: "Knockout",
    hint: "Knockout ties only. No group phase.",
    groupPrefix: "Round",
    hasGroups: false,
    hasKnockout: true,
  },
};

export function formatLabel(value: string | null | undefined): string {
  return FORMATS[value as FormatId]?.label ?? FORMATS.league.label;
}

export function stageLabel(
  stage: string | null | undefined,
  round: number,
  format: string | null | undefined = "league",
): string {
  if (stage === "final") return "Final";
  if (stage === "semi") return "Semi-final";
  if (stage === "quarter") return "Quarter-final";
  const prefix = FORMATS[format as FormatId]?.groupPrefix ?? FORMATS.league.groupPrefix;
  return `${prefix} ${round}`;
}
