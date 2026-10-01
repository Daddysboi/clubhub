"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { saveTournament } from "@/app/actions/admin";
import { slugify } from "@/lib/format";
import { cn } from "@/lib/cn";

export function NewTournamentForm() {
  const [state, formAction] = useActionState(saveTournament, { ok: false });
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const shownSlug = slugTouched ? slug : slugify(name);

  return (
    <Card className="p-6">
      <form action={formAction} className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Tournament name" htmlFor="name" required error={state.fieldErrors?.name?.[0]}>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mastic End of Year Cup"
              required
            />
          </Field>
        </div>

        <Field
          label="URL slug"
          htmlFor="slug"
          required
          hint={`Public link: /tournaments/${shownSlug || "…"}`}
          error={state.fieldErrors?.slug?.[0]}
        >
          <Input
            id="slug"
            name="slug"
            value={shownSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
            placeholder="mastic-end-of-year-cup"
            required
          />
        </Field>

        <Field label="Start date" htmlFor="startDate">
          <Input id="startDate" name="startDate" type="date" />
        </Field>

        <Field
          label="Club name"
          htmlFor="clubName"
          hint="Shown in the public header, e.g. A Mastic FC competition"
        >
          <Input id="clubName" name="clubName" placeholder="e.g. Mastic FC" />
        </Field>

        <Field label="Venue" htmlFor="venue">
          <Input id="venue" name="venue" placeholder="e.g. Mastic Community Field" />
        </Field>

        <Field label="Status" htmlFor="status" hint="Only live/done tournaments are public.">
          <select
            id="status"
            name="status"
            defaultValue="draft"
            className="min-h-11 w-full rounded-lg border border-[var(--rule-strong)] bg-[var(--paper)] px-3 py-2.5 text-base text-[var(--ink)] outline-none focus:border-[var(--pitch)]"
          >
            <option value="draft">Draft — hidden from public</option>
            <option value="live">Live — visible and open for signups</option>
            <option value="done">Done — visible as completed</option>
          </select>
        </Field>

        <div className="sm:col-span-2">
          <Field label="Description" htmlFor="description">
            <Textarea
              id="description"
              name="description"
              placeholder="What is this competition? When does it kick off?"
            />
          </Field>
        </div>

        {state.message ? (
          <p
            role="alert"
            className={cn(
              "rounded-lg border px-3 py-2.5 text-sm font-medium sm:col-span-2",
              state.ok
                ? "border-[var(--pitch)]/40 bg-[var(--pitch-a12)] text-[var(--pitch)]"
                : "border-[var(--live)]/40 bg-[var(--live-tint)] text-[var(--live)]",
            )}
          >
            {state.message}
          </p>
        ) : null}

        <div className="sm:col-span-2">
          <Submit />
        </div>
      </form>
    </Card>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating…" : "Create tournament"}
    </Button>
  );
}
