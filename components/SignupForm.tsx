"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { ChoiceCards, Field, Input } from "@/components/ui/input";
import { Card, Stamp } from "@/components/ui/card";
import { POSITION_ORDER } from "@/lib/tones";
import type { ActionState } from "@/app/actions/players";
import { cn } from "@/lib/cn";

export function SignupForm({
  action,
  tournamentId = "",
  tournamentName,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  tournamentId?: string;
  tournamentName?: string;
}) {
  const [state, formAction] = useActionState(action, { ok: false });

  // On success we swap the whole form for a confirmation card, so the inputs
  // never need resetting here.
  if (state.ok) {
    return (
      <Card className="p-8 text-center">
        <Stamp tone="pitch">Registered</Stamp>
        <h2 className="mt-4 text-2xl font-bold text-[var(--ink)]">You&apos;re in!</h2>
        <p className="mt-2 text-[var(--ink-2)]">
          You&apos;re registered
          {tournamentName ? ` for ${tournamentName}` : ""}. The organiser will assign you to a
          squad, and your name appears on the team sheet from then on.
        </p>
        {/* The public roster only lists squad players, so say that plainly rather
            than implying the name is already visible on the site. */}
        <p className="mt-3 text-sm text-[var(--ink-3)]">
          Your name is not published until you join a squad.
        </p>
        <p className="mt-6 text-sm text-[var(--ink-3)]">
          Your phone number is stored for the organiser only and is never shown publicly.
        </p>
        <RegisterAnother
          onClick={() => window.location.reload()}
          label="Register another person"
        />
      </Card>
    );
  }

  return (
    <Card className="p-6 sm:p-8">
      <form action={formAction} className="space-y-5" noValidate>
        {tournamentId ? <input type="hidden" name="tournamentId" value={tournamentId} /> : null}

        <Field
          label="Full name"
          htmlFor="fullName"
          required
          hint="Exactly as it should appear on the team sheet"
          error={state.fieldErrors?.fullName?.[0]}
        >
          <Input
            id="fullName"
            name="fullName"
            defaultValue=""
            placeholder="e.g. Ahmed Yusuf"
            autoComplete="name"
            required
            aria-invalid={Boolean(state.fieldErrors?.fullName)}
          />
        </Field>

        <Field
          label="Nickname / known name"
          htmlFor="nickname"
          hint="What people call you on the pitch — optional, but must be unique"
          error={state.fieldErrors?.nickname?.[0]}
        >
          <Input
            id="nickname"
            name="nickname"
            defaultValue=""
            placeholder="e.g. Sharp Shooter"
            autoComplete="off"
            aria-invalid={Boolean(state.fieldErrors?.nickname)}
          />
        </Field>

        <Field
          label="Position"
          htmlFor="position"
          required
          hint="Pick the role you usually play"
          error={state.fieldErrors?.position?.[0]}
        >
          <div id="position">
            <ChoiceCards name="position" options={POSITION_ORDER} defaultValue="Midfielder" />
          </div>
        </Field>

        <Field
          label="Phone number"
          htmlFor="phone"
          hint="For match alerts only. Never displayed on the site."
          error={state.fieldErrors?.phone?.[0]}
        >
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            placeholder="e.g. 0803 123 4567"
            autoComplete="tel"
            aria-invalid={Boolean(state.fieldErrors?.phone)}
          />
        </Field>

        {state.message ? (
          <p
            role="alert"
            className={cn(
              "rounded-lg border px-3 py-2.5 text-sm font-medium",
              "border-[var(--live)]/40 bg-[var(--live-tint)] text-[var(--live)]",
            )}
          >
            {state.message}
          </p>
        ) : null}

        <SubmitButton label={tournamentName ? "Register to play" : "Register"} />
      </form>
    </Card>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" block disabled={pending}>
      {pending ? "Registering…" : label}
    </Button>
  );
}

function RegisterAnother({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button variant="secondary" onClick={onClick} className="mt-6">
      {label}
    </Button>
  );
}