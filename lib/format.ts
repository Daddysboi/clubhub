const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Route params arrive as free-form strings. Postgres rejects anything that is
 * not a UUID outright, so callers check this before querying — a URL like
 * `/admin/tournaments/your-tournament-id` should 404, not crash the page.
 */
export function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

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
    // A bare "10:30" is ambiguous when organisers and fans are in different
    // zones. Showing the viewer's offset makes DST and travel explicit.
    timeZoneName: "short",
  });
}

/**
 * Relative kickoff labels compare calendar days in the viewer's zone, not
 * rounded milliseconds. Rounding 13 hours to "Tomorrow" (or 13 hours ago to
 * "Yesterday") was wrong around midnight and across DST changes.
 */
export function relativeKickoff(value: string | Date | null | undefined) {
  if (!value) return null;
  const d = parseDateValue(value);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((target - today) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 1 && days < 7) return `In ${days} days`;
  if (days === -1) return "Yesterday";
  if (days < -1) return `${Math.abs(days)} days ago`;
  return null;
}

/** ISO instant -> the `YYYY-MM-DDTHH:mm` shape a `datetime-local` input needs. */
export function toLocalInputValue(value: string | Date | null | undefined) {
  if (!value) return "";
  const d = parseDateValue(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/**
 * `datetime-local` has no offset, so `new Date(value)` in a browser reads it in
 * the organiser's zone. Converting to an ISO instant here pins the moment
 * before it reaches the server (whose zone may be UTC).
 */
export function localInputToIso(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}