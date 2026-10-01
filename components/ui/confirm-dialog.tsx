"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * Confirmation dialog for destructive actions.
 *
 * Renders a real <dialog> so the browser supplies the top layer, the backdrop
 * and Escape-to-close for free. The trigger keeps its own variant and size;
 * the confirm button matches `confirmVariant`.
 *
 * Every delete in the organiser panel uses this, so wording, layout and
 * keyboard behaviour stay identical across the app.
 */
export function ConfirmDialog({
  action,
  triggerLabel = "Delete",
  title,
  body,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  size = "sm",
  triggerVariant = "destructive",
  confirmVariant = "destructive",
  triggerClassName,
  children,
}: {
  /** Server action to run on confirm. */
  action: (formData: FormData) => void | Promise<void>;
  triggerLabel?: string;
  /** Short question, e.g. "Delete this team?". */
  title: string;
  /** What is lost. Names the thing so the risk is concrete. */
  body: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  size?: "sm" | "md" | "lg";
  triggerVariant?: React.ComponentProps<typeof Button>["variant"];
  confirmVariant?: React.ComponentProps<typeof Button>["variant"];
  triggerClassName?: string;
  /** Hidden form fields forwarded to the action. */
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  // A submit navigates/revalidates, but on a soft navigation the dialog would
  // otherwise stay open over the updated page. Close on unmount as a backstop.
  useEffect(() => {
    const el = dialogRef.current;
    return () => {
      if (el?.open) el.close();
    };
  }, []);

  return (
    <>
      <Button
        variant={triggerVariant}
        size={size}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={triggerClassName}
      >
        {triggerLabel}
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby="confirm-dialog-title"
        onClose={() => setOpen(false)}
        className={cn(
          "m-auto w-[calc(100vw-2rem)] max-w-sm rounded-xl border border-[var(--rule)]",
          "bg-[var(--surface)] p-0 text-[var(--ink)] shadow-xl backdrop:bg-black/50",
        )}
      >
        <div className="p-5">
          <h2 id="confirm-dialog-title" className="text-base font-bold leading-tight">
            {title}
          </h2>
          <div className="mt-2 text-sm leading-relaxed text-[var(--ink-2)]">{body}</div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--rule)] px-5 py-3">
          <Button variant="ghost" size="md" onClick={() => setOpen(false)}>
            {cancelLabel}
          </Button>

          <form action={action}>
            {children}
            <Button type="submit" variant={confirmVariant} size="md">
              {confirmLabel}
            </Button>
          </form>
        </div>
      </dialog>
    </>
  );
}