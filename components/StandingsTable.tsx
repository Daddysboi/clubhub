import type { StandingRow } from "@/lib/standings";
import { TeamCrest } from "@/components/TeamCrest";
import { cn } from "@/lib/cn";

export function StandingsTable({ standings }: { standings: StandingRow[] }) {
  if (standings.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-[var(--ink-3)]">No teams yet.</p>;
  }
  const leaderPlayed = standings[0].played > 0;

  return (
    <>
      {/* >= md: real table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">League standings</caption>
          <thead>
            <tr className="border-b border-[var(--rule)] text-[11px] uppercase tracking-wider text-[var(--ink-3)]">
              <th scope="col" className="px-4 py-3 text-left font-semibold">#</th>
              <th scope="col" className="px-2 py-3 text-left font-semibold">Team</th>
              <th scope="col" className="px-2 py-3 text-center font-semibold">P</th>
              <th scope="col" className="px-2 py-3 text-center font-semibold">W</th>
              <th scope="col" className="px-2 py-3 text-center font-semibold">D</th>
              <th scope="col" className="px-2 py-3 text-center font-semibold">L</th>
              <th scope="col" className="px-2 py-3 text-center font-semibold">GF</th>
              <th scope="col" className="px-2 py-3 text-center font-semibold">GA</th>
              <th scope="col" className="px-2 py-3 text-center font-semibold">GD</th>
              <th scope="col" className="px-2 py-3 text-center font-semibold">Pts</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Form</th>
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
                <td className="px-4 py-3 font-bold text-[var(--ink-3)]">{row.rank}</td>
                <td className="px-2 py-3">
                  <span className="flex items-center gap-2.5">
                    <TeamCrest team={row.team} size={26} />
                    <span className="font-semibold text-[var(--ink)]">{row.team.name}</span>
                  </span>
                </td>
                <Cell value={row.played} />
                <Cell value={row.won} />
                <Cell value={row.drawn} />
                <Cell value={row.lost} />
                <Cell value={row.goalsFor} />
                <Cell value={row.goalsAgainst} />
                <Cell value={row.goalDiff} signed />
                <td className="px-2 py-3 text-center">
                  <span className="text-base font-black tabular-nums text-[var(--pitch)]">
                    {row.points}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="flex justify-end gap-1">
                    {row.form.length === 0 ? (
                      <span className="text-xs text-[var(--ink-3)]">—</span>
                    ) : (
                      row.form.slice(-5).map((f, i) => (
                        <span
                          key={i}
                          title={`${f === "W" ? "Win" : f === "D" ? "Draw" : "Loss"}`}
                          className={cn(
                            "grid size-5 place-items-center rounded text-[10px] font-bold",
                            f === "W" && "bg-[var(--pitch)] text-[var(--accent-ink)]",
                            f === "D" && "bg-white/10 text-[var(--ink-2)]",
                            f === "L" && "bg-[var(--live)]/25 text-[var(--live)]",
                          )}
                        >
                          {f}
                        </span>
                      ))
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* < md: stacked cards */}
      <div className="divide-y divide-[var(--rule)] md:hidden">
        {standings.map((row) => (
          <div
            key={row.team.id}
            className={cn(
              "flex items-center gap-2.5 px-3 py-3 sm:gap-3 sm:px-4",
              row.rank === 1 && leaderPlayed && "bg-[var(--pitch-a12)]",
            )}
          >
            <span className="w-4 shrink-0 text-sm font-bold text-[var(--ink-3)]">{row.rank}</span>
            <TeamCrest team={row.team} size={30} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--ink)]">{row.team.name}</p>
              <p className="mt-0.5 text-[11px] tabular-nums text-[var(--ink-3)]">
                {row.played} played · {row.won}W {row.drawn}D {row.lost}L · GD {row.goalDiff}
              </p>
              {row.form.length > 0 ? (
                <span className="mt-1.5 flex gap-1">
                  {row.form.slice(-5).map((f, i) => (
                    <span
                      key={i}
                      className={cn(
                        "grid size-4 place-items-center rounded text-[9px] font-bold leading-none",
                        f === "W" && "bg-[var(--pitch)] text-[var(--accent-ink)]",
                        f === "D" && "bg-white/10 text-[var(--ink-2)]",
                        f === "L" && "bg-[var(--live)]/25 text-[var(--live)]",
                      )}
                    >
                      {f}
                    </span>
                  ))}
                </span>
              ) : null}
            </div>
            <span className="shrink-0 text-xl font-black tabular-nums text-[var(--pitch)]">
              {row.points}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function Cell({ value, signed = false }: { value: number; signed?: boolean }) {
  return (
    <td className="px-2 py-3 text-center tabular-nums text-[var(--ink-2)]">
      {signed && value > 0 ? `+${value}` : value}
    </td>
  );
}