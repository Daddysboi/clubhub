export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

/**
 * A bare `YYYY-MM-DD` string is a calendar date, not an instant: `new Date()`
 * reads it as UTC midnight, which renders as the previous day anywhere west of
 * Greenwich. A tournament starting 1 Oct was showing as 31 Sep for those users.
 * Parsing those as local midnight keeps the day the organiser typed.
 */
function parseDateValue(value: string | Date): Date {
  if (typeof value !== "string") return value;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }
  return new Date(value);
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "TBC";
  const d = parseDateValue(value);
  if (Number.isNaN(d.getTime())) return "TBC";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "TBC";
  const d = parseDateValue(value);
  if (Number.isNaN(d.getTime())) return "TBC";
  return d.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function relativeKickoff(value: string | Date | null | undefined) {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  const diff = d.getTime() - Date.now();
  if (Number.isNaN(diff)) return null;
  const days = Math.round(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 1 && days < 7) return `In ${days} days`;
  if (days === -1) return "Yesterday";
  if (days < -1) return `${Math.abs(days)} days ago`;
  return null;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}