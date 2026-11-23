import type { StandingRow } from "@/lib/standings";
import { TeamCrest } from "@/components/TeamCrest";
import { cn } from "@/lib/cn";

/**
 * Full league table.
 *
 * The whole record is always visible — P, W, D, L, GF, GA, GD, Pts and form.
 * On wide screens it is a proper table. Below md the same data becomes stacked
 * rows, so nothing is hidden and the table never needs an x-axis scrollbar.
 */
export function StandingsTable({ standings }: { standings: StandingRow[] }) {
  if (standings.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-[var(--ink-3)]">No teams yet.</p>;
  }
  const leaderPlayed = standings[0].played > 0;

  return (
    <>
      {/* < md: every column, rearranged into a stack — no sideways scrolling */}
      <ul aria-label="League standings" className="divide-y divide-[var(--rule)] md:hidden">
        {standings.map((row) => (
          <li
            key={row.team.id}
            className={cn(
              "px-3 py-3",
              row.rank === 1 && leaderPlayed && "bg-[var(--pitch-a12)]",
            )}
          >
            <div className="flex items-center gap-2.5">
              <span className="w-4 shrink-0 text-center text-xs font-bold text-[var(--ink-3)]">
                {row.rank}
                {row.rank === 1 && leaderPlayed ? <span className="sr-only">, leaders</span> : null}
              </span>
              <TeamCrest team={row.team} size={30} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--ink)]" title={row.team.name}>
                  {row.team.name}
                </p>
                <FormDots form={row.form} />
              </div>
              <div className="shrink-0 text-right">
                <p className="text-lg font-black leading-none tabular-nums text-[var(--pitch)]">
                  {row.points}
                </p>
                <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--ink-3)]">
                  Pts
                </p>
              </div>
            </div>
            <dl className="mt-2.5 grid grid-cols-7 gap-1 rounded-lg bg-[var(--paper)]/60 px-1.5 py-2 text-center">
              <MiniStat label="P" value={row.played} />
              <MiniStat label="W" value={row.won} />
              <MiniStat label="D" value={row.drawn} />
              <MiniStat label="L" value={row.lost} />
              <MiniStat label="GF" value={row.goalsFor} />
              <MiniStat label="GA" value={row.goalsAgainst} />
              <MiniStat label="GD" value={signedValue(row.goalDiff)} />
            </dl>
          </li>
        ))}
      </ul>

      {/* >= md: the classic full-width league table */}
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">League standings</caption>
          <thead>
            <tr className="border-b border-[var(--rule)] text-[11px] uppercase tracking-wider text-[var(--ink-3)]">
              <th scope="col" className="w-9 py-3 pl-4 text-left font-semibold">
                #
              </th>
              <th scope="col" className="py-3 pl-1 text-left font-semibold">
                Team
              </th>
              <Column label="P" title="Played" />
              <Column label="W" title="Won" />
              <Column label="D" title="Drawn" />
              <Column label="L" title="Lost" />
              <Column label="GF" title="Goals for" />
              <Column label="GA" title="Goals against" />
              <Column label="GD" title="Goal difference" />
              <th scope="col" className="py-3 pr-2 text-center font-semibold">
                Pts
              </th>
              <th scope="col" className="py-3 pr-4 text-center font-semibold">
                Form
              </th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row) => (
              <tr
                key={row.team.id}
                className={cn(
                  "border-b border-[var(--rule)] last:border-0",
                  row.rank === 1 && leaderPlayed && "bg-[var(--pitch-a12)]",
                )}
              >
                <td className="py-3 pl-4 font-bold text-[var(--ink-3)]">
                  {row.rank}
                  {row.rank === 1 && leaderPlayed ? <span className="sr-only">, leaders</span> : null}
                </td>
                <th scope="row" className="min-w-0 py-3 pl-1 text-left">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <TeamCrest team={row.team} size={28} />
                    <span className="truncate font-semibold text-[var(--ink)]" title={row.team.name}>
                      {row.team.name}
                    </span>
                  </div>
                </th>
                <Cell value={row.played} />
                <Cell value={row.won} />
                <Cell value={row.drawn} />
                <Cell value={row.lost} />
                <Cell value={row.goalsFor} />
                <Cell value={row.goalsAgainst} />
                <Cell value={row.goalDiff} signed />
                <td className="py-3 pr-2 text-center">
                  <span className="text-base font-black tabular-nums text-[var(--pitch)]">
                    {row.points}
                  </span>
                </td>
                <td className="py-3 pr-4">
                  <FormDots form={row.form} centered />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Column({ label, title }: { label: string; title: string }) {
  return (
    <th scope="col" className="px-1 py-3 text-center font-semibold" title={title}>
      <abbr title={title} className="no-underline">
        {label}
      </abbr>
    </th>
  );
}

function Cell({ value, signed = false }: { value: number; signed?: boolean }) {
  return (
    <td className="px-1 py-3 text-center tabular-nums text-[var(--ink-2)]">
      {signed ? signedValue(value) : value}
    </td>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dt className="text-[9px] font-semibold uppercase tracking-wide text-[var(--ink-3)]">
        {label}
      </dt>
      <dd className="mt-0.5 text-xs font-bold tabular-nums text-[var(--ink-2)]">{value}</dd>
    </div>
  );
}

function FormDots({ form, centered = false }: { form: StandingRow["form"]; centered?: boolean }) {
  if (form.length === 0) return null;
  return (
    <ol
      aria-label="Recent form"
      className={cn("mt-1 flex gap-0.5", centered && "justify-center")}
    >
      {form.slice(-5).map((result, index) => {
        const label = result === "W" ? "Win" : result === "D" ? "Draw" : "Loss";
        return (
          <li
            key={index}
            title={label}
            className={cn(
              "grid size-3.5 place-items-center rounded-[3px] text-[9px] font-bold leading-none",
              result === "W" && "bg-[var(--pitch)] text-[var(--accent-ink)]",
              result === "D" && "bg-white/10 text-[var(--ink-2)]",
              result === "L" && "bg-[var(--live)]/25 text-[var(--live)]",
            )}
          >
            <span aria-hidden>{result}</span>
            <span className="sr-only">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function signedValue(value: number) {
  return value > 0 ? `+${value}` : value;
}
