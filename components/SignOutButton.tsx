"use client";

import { useTransition } from "react";
import { adminSignOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const [pending, start] = useTransition();

  return (
    <form
      action={() =>
        start(async () => {
          await adminSignOut();
        })
      }
    >
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? "Signing out…" : "Sign out"}
      </Button>
    </form>
  );
}