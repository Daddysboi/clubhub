import Image from "next/image";
import type { Player } from "@/lib/db/schema";
import { initials } from "@/lib/format";
import { Stamp } from "@/components/ui/card";
import { POSITION_TONE } from "@/lib/tones";
import { cn } from "@/lib/cn";

export function PositionBadge({ position }: { position: string }) {
  const tone = POSITION_TONE[position as keyof typeof POSITION_TONE] ?? "neutral";
  return <Stamp tone={tone}>{position}</Stamp>;
}

export function PlayerAvatar({
  player,
  size = 40,
}: {
  player: Pick<Player, "fullName" | "photoUrl">;
  size?: number;
}) {
  if (player.photoUrl) {
    return (
      <Image
        src={player.photoUrl}
        alt={player.fullName}
        width={size}
        height={size}
        unoptimized
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-[var(--sunken)] font-bold text-[var(--ink-3)]"
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}
    >
      {initials(player.fullName)}
    </span>
  );
}

/**
 * Public roster row. Phone is intentionally never rendered here —
 * the phone column is admin-only.
 */
export function PlayerRow({
  player,
  teamName,
  teamColor,
  action,
}: {
  player: {
    id: string;
    fullName: string;
    nickname: string | null;
    position: string;
    photoUrl: string | null;
  };
  teamName?: string | null;
  teamColor?: string | null;
  action?: React.ReactNode;
}) {
  return (
    // One player per line at every width. Name and nickname share a single
    // truncating line; position and squad sit right and never wrap, so a
    // long name shrinks instead of pushing the row onto two lines.
    <div className="flex items-center gap-2.5 border-b border-[var(--rule)] px-3 py-2.5 transition last:border-0 hover:bg-[var(--sunken)]/60 sm:gap-3 sm:px-4 sm:py-3">
      <PlayerAvatar player={player} size={36} />

      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--ink)] sm:text-[15px]">
        {player.fullName}
        {player.nickname ? (
          <span className="ml-1.5 font-normal text-[var(--ink-3)]">“{player.nickname}”</span>
        ) : null}
      </p>

      <span className="hidden shrink-0 sm:block">
        <PositionBadge position={player.position} />
      </span>
      {/* Position initials on mobile — too narrow for the full word. */}
      <span
        title={player.position}
        aria-label={player.position}
        className="grid size-7 shrink-0 place-items-center rounded-md border text-[10px] font-bold sm:hidden"
        style={{
          borderColor: teamColor ?? "var(--rule-strong)",
          color: teamColor ?? "var(--ink-3)",
        }}
      >
        {player.position.slice(0, 1)}
      </span>

      {teamName ? (
        <span
          className={cn(
            "max-w-[5.5rem] shrink-0 truncate rounded-md px-2 py-0.5 text-[11px] font-semibold text-white",
            "sm:max-w-none sm:px-2.5 sm:text-xs",
          )}
          style={{ background: teamColor ?? "var(--sunken)" }}
        >
          {teamName}
        </span>
      ) : (
        <span className="hidden shrink-0 rounded-md border border-dashed border-[var(--rule-strong)] px-2.5 py-0.5 text-xs text-[var(--ink-3)] sm:block">
          Unassigned
        </span>
      )}
      {action}
    </div>
  );
}