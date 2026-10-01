import { forwardRef } from "react";
import { cn } from "@/lib/cn";

/**
 * Form control surfaces. Every input, select and textarea shares this
 * treatment so no screen re-derives it.
 */
const controlBase =
  "w-full rounded-lg border border-[var(--rule-strong)] bg-[var(--paper)] px-3 py-2.5 " +
  "text-base text-[var(--ink)] outline-none transition placeholder:text-[var(--ink-3)] " +
  "focus:border-[var(--pitch)] focus:ring-2 focus:ring-[var(--pitch)]/30 " +
  "disabled:opacity-50 min-h-11";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(controlBase, className)} {...props} />;
  },
);

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & {
    /** Classes for the positioning wrapper, e.g. `flex-1` inside a row. */
    wrapperClassName?: string;
  }
>(function Select({ className, wrapperClassName, children, ...props }, ref) {
  return (
    // The wrapper, not the select, is the flex child when a Select sits in a
    // row. Exposing it lets callers size the row without the icon drifting
    // outside a w-auto select.
    <div className={cn("relative w-full min-w-0", wrapperClassName)}>
      <select
        ref={ref}
        className={cn(
          controlBase,
          // The chevron sits inside the border, so padding only has to clear
          // the icon itself, not a large gutter.
          "appearance-none pr-7",
          // Native option lists on iOS inherit these; a transparent control
          // renders as white-on-white text in the picker.
          "[&>option]:bg-[var(--surface)] [&>option]:text-[var(--ink)]",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {/* Stands in for the OS arrow that appearance-none removes, so the
          control still reads as a dropdown. pointer-events-none keeps the
          whole surface clickable, not just around the icon. */}
      <span
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 size-2 -translate-y-[60%] rotate-45 border-r-2 border-b-2 border-[var(--ink-3)] opacity-70"
      />
    </div>
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(controlBase, "min-h-24", className)} {...props} />;
});

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="block">
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-sm font-medium leading-tight text-[var(--ink-2)]"
      >
        {label}
        {required ? <span className="ml-0.5 text-[var(--live)]">*</span> : null}
      </label>
      {children}
      {error ? (
        <p role="alert" className="mt-1.5 text-xs font-medium text-[var(--live)]">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs leading-snug text-[var(--ink-3)]">{hint}</p>
      ) : null}
    </div>
  );
}

/** Radio group rendered as large tap targets — the position picker. */
export function ChoiceCards({
  name,
  options,
  defaultValue,
}: {
  name: string;
  options: readonly string[];
  defaultValue?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {options.map((option) => (
        <label
          key={option}
          className={cn(
            "flex min-h-13 cursor-pointer select-none items-center justify-center rounded-lg border px-2 py-3",
            "text-center text-sm font-semibold leading-tight transition active:scale-[0.98]",
            "border-[var(--rule-strong)] text-[var(--ink-2)] hover:border-[var(--pitch)]/60 hover:text-[var(--ink)]",
            "has-checked:border-[var(--pitch)] has-checked:bg-[var(--pitch-a12)] has-checked:text-[var(--pitch)]",
          )}
        >
          <input
            type="radio"
            name={name}
            value={option}
            defaultChecked={option === defaultValue}
            className="sr-only"
          />
          {option}
        </label>
      ))}
    </div>
  );
}