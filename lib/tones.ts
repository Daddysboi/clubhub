/**
 * Tone → colour bindings. The ONLY place a semantic colour meets a className.
 * Components must call toneClasses() and never re-derive a colour class.
 * Every value is a full literal string so Tailwind's scanner finds it.
 */

export type Tone = "neutral" | "pitch" | "warn" | "live" | "trophy" | "info";

export const TONE_SURFACE_CLASS: Record<Tone, string> = {
  neutral: "bg-white/5",
  pitch: "bg-[var(--pitch-a12)]",
  warn: "bg-[var(--warn-tint)]",
  live: "bg-[var(--live-tint)]",
  trophy: "bg-[var(--trophy-tint)]",
  info: "bg-[var(--info-tint)]",
};

export const TONE_TEXT_CLASS: Record<Tone, string> = {
  neutral: "text-[var(--ink-3)]",
  pitch: "text-[var(--pitch)]",
  warn: "text-[var(--warn)]",
  live: "text-[var(--live)]",
  trophy: "text-[var(--trophy)]",
  info: "text-[var(--info)]",
};

export const TONE_BORDER_CLASS: Record<Tone, string> = {
  neutral: "border-[var(--rule-strong)]",
  pitch: "border-[var(--pitch-a35)]",
  warn: "border-[var(--warn)]/40",
  live: "border-[var(--live)]/40",
  trophy: "border-[var(--trophy)]/40",
  info: "border-[var(--info)]/40",
};

/** 3px status spine — the signature element on rows and cards. */
export const TONE_ACCENT_BAR_CLASS: Record<Tone, string> = {
  neutral: "bg-[var(--rule-strong)]",
  pitch: "bg-[var(--pitch)]",
  warn: "bg-[var(--warn)]",
  live: "bg-[var(--live)]",
  trophy: "bg-[var(--trophy)]",
  info: "bg-[var(--info)]",
};

export const TONE_MEANING: Record<Tone, string> = {
  neutral: "Neutral",
  pitch: "Leading / winner / settled",
  warn: "Scheduled / awaiting",
  live: "In play",
  trophy: "Champion",
  info: "Information",
};

/**
 * Tournament status -> badge tone.
 *
 * "live" is an in-progress competition, which reads as green (the pitch
 * action colour) rather than the broadcast-red used for a match that is
 * currently being played. Red is reserved for a fixture that is under way.
 */
export const STATUS_TONE = {
  live: "pitch",
  done: "neutral",
  draft: "warn",
} as const satisfies Record<string, Tone>;

const STATUS_LABEL = {
  live: "Live",
  done: "Completed",
  draft: "Draft",
} as const satisfies Record<string, string>;

/** Narrowing helper for the status strings coming out of the database. */
export function statusTone(status: string): Tone {
  return STATUS_TONE[status as keyof typeof STATUS_TONE] ?? "neutral";
}

export function statusLabel(status: string): string {
  return STATUS_LABEL[status as keyof typeof STATUS_LABEL] ?? status;
}

export type TonePart =
  | "surface"
  | "text"
  | "border"
  | "accent"
  | "surfaceText"
  | "surfaceTextBorder";

export function toneClasses(tone: Tone, part: TonePart): string {
  if (part === "surfaceText") return `${TONE_SURFACE_CLASS[tone]} ${TONE_TEXT_CLASS[tone]}`;
  if (part === "surfaceTextBorder") {
    return `${TONE_SURFACE_CLASS[tone]} ${TONE_TEXT_CLASS[tone]} ${TONE_BORDER_CLASS[tone]}`;
  }
  return toneMap[part][tone];
}

const toneMap = {
  surface: TONE_SURFACE_CLASS,
  text: TONE_TEXT_CLASS,
  border: TONE_BORDER_CLASS,
  accent: TONE_ACCENT_BAR_CLASS,
} as const;

/** Position → tone, defined once and reused by badges everywhere. */
export const POSITION_TONE = {
  Goalkeeper: "warn",
  Defender: "info",
  Midfielder: "pitch",
  Forward: "live",
} as const satisfies Record<string, Tone>;

export const POSITION_ORDER = [
  "Goalkeeper",
  "Defender",
  "Midfielder",
  "Forward",
] as const;

/**
 * Kit colours offered when creating a team, in seed order.
 * Real hex values, not CSS variables: these are persisted to the database and
 * re-read on the server, so they must survive serialisation.
 */
export const KIT_COLORS = ["#16a34a", "#1d4ed8", "#b91c1c", "#a16207"] as const;

/**
 * Kit colour pairs offered when creating a squad. Distinct enough that four
 * teams from one club are tellable apart at a glance, including for players
 * who cannot read the team name.
 */
export const KIT_PRESETS = [
  { primary: "#16a34a", secondary: "#052e16", label: "Green" },
  { primary: "#1d4ed8", secondary: "#0c1e3a", label: "Blue" },
  { primary: "#b91c1c", secondary: "#2a0a0a", label: "Red" },
  { primary: "#a16207", secondary: "#241a03", label: "Amber" },
  { primary: "#7c3aed", secondary: "#1e1035", label: "Purple" },
  { primary: "#0f172a", secondary: "#020617", label: "Black" },
] as const;