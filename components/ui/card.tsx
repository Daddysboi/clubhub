import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import { toneClasses, type Tone, type TonePart } from "@/lib/tones";

/** Surface primitive. Hairline border, never a heavy shadow. */
export const Card = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function Card({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl border border-[var(--rule)] bg-[var(--surface)]/70 backdrop-blur-sm",
          className,
        )}
        {...props}
      />
    );
  },
);

/**
 * Stamp — the status chip. Geometry only.
 * The tone → colour binding lives in lib/tones.ts.
 *
 * On a phone the base padding is halved: chips sit in dense meta rows and
 * the desktop padding pushes the label onto two lines at 375px.
 */
export function Stamp({
  tone = "neutral",
  children,
  className,
  spine = false,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
  spine?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold leading-tight sm:text-xs",
        toneClasses(tone, "surfaceTextBorder" as TonePart),
        spine && "border-l-[3px] pl-2.5",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** 3px status spine — applied to a row or card wrapper. */
export function StatusSpine({ tone, className }: { tone: Tone; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("absolute inset-y-0 left-0 w-[3px] rounded-l-xl", toneClasses(tone, "accent" as TonePart), className)}
    />
  );
}

export function SectionHeading({
  title,
  eyebrow,
  action,
}: {
  title: string;
  eyebrow?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--pitch)]">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-xl font-bold tracking-tight text-[var(--ink)] sm:text-2xl">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--rule-strong)] px-4 py-10 text-center sm:px-6 sm:py-12">
      <p className="font-semibold text-[var(--ink-2)]">{title}</p>
      {hint ? (
        <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-[var(--ink-3)]">{hint}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}