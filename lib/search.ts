/**
 * Builds a safe ILIKE containment pattern.
 *
 * LIKE treats `%` and `_` as wildcards and `\` as its escape character. User
 * input must be escaped before it is wrapped, otherwise a search for `%`
 * silently turns into "match everything" and can be used to scan the roster.
 */
export function likeContains(value: string): string {
  return `%${value.trim().replace(/[\\%_]/g, "\\$&")}%`;
}
