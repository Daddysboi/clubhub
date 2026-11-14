// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The real module is a "use server" action that writes to Supabase. The UI test
// only exercises rendering, so it is replaced with an inert stub — nothing here
// can reach the database.
vi.mock("@/app/actions/events", () => ({
  addMatchEvent: vi.fn(),
  deleteMatchEventForm: vi.fn(),
}));

import { AdminMatchEvents, type EventView } from "@/components/admin/AdminMatchEvents";
import type { Match, Team } from "@/lib/db/schema";

const TOURNAMENT_ID = "11111111-1111-4111-8111-111111111111";
const MATCH_ID = "22222222-2222-4222-8222-222222222222";
const HOME_ID = "33333333-3333-4333-8333-333333333333";
const AWAY_ID = "44444444-4444-4444-8444-444444444444";
const OTHER_ID = "55555555-5555-4555-8555-555555555555";

function team(id: string, name: string): Team {
  return {
    id,
    tournamentId: TOURNAMENT_ID,
    name,
    shortName: null,
    captainPlayerId: null,
    managerPlayerId: null,
    seed: null,
    color: "#16a34a",
    primaryColor: "#16a34a",
    secondaryColor: "#0f172a",
    logoUrl: null,
    createdAt: new Date(0),
  };
}

const match: Match = {
  id: MATCH_ID,
  tournamentId: TOURNAMENT_ID,
  round: 1,
  homeTeamId: HOME_ID,
  awayTeamId: AWAY_ID,
  scheduledAt: null,
  venue: null,
  homeScore: 1,
  awayScore: 0,
  status: "finished",
  photoUrl: null,
  notes: null,
  createdAt: new Date(0),
};

const teams = [team(HOME_ID, "Barrister FC"), team(AWAY_ID, "Jude FC"), team(OTHER_ID, "Toks FC")];

const players = [
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", fullName: "Praiz Igho", nickname: "AI", teamId: HOME_ID },
  { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", fullName: "Jude", nickname: "Mastic", teamId: AWAY_ID },
  { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", fullName: "George Shoes", nickname: "george", teamId: OTHER_ID },
];

const goal: EventView = {
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  matchId: MATCH_ID,
  tournamentId: TOURNAMENT_ID,
  playerId: players[0].id,
  teamId: HOME_ID,
  type: "goal",
  minute: 34,
  note: null,
  createdAt: new Date(0),
  playerName: "Praiz Igho",
  teamName: "Barrister FC",
};

function renderEvents(events: EventView[] = []) {
  return render(
    createElement(AdminMatchEvents, { match, teams, players, events }),
  );
}

afterEach(cleanup);

describe("admin match events panel", () => {
  it("renders the record-event form for a match that has kicked off", () => {
    renderEvents();

    expect(screen.getByRole("heading", { name: "Record an event" })).toBeTruthy();
    expect(screen.getByText("No events recorded for this match.")).toBeTruthy();
  });

  it("offers only players from the two sides in the fixture", () => {
    renderEvents();

    const options = screen
      .getAllByRole("option")
      .map((option) => option.textContent ?? "")
      .join("|");

    expect(options).toContain("Praiz Igho (AI)");
    expect(options).toContain("Jude (Mastic)");
    expect(options).not.toContain("George Shoes");
  });

  it("enables recording and fills the team once a player is picked", () => {
    const { container } = renderEvents();

    const submit = screen.getByRole("button", { name: "Record event" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    const playerSelect = screen.getByLabelText(/player/i) as HTMLSelectElement;
    fireEvent.change(playerSelect, { target: { value: players[0].id } });

    const teamInput = container.querySelector('input[name="teamId"]') as HTMLInputElement;
    expect(teamInput.value).toBe(HOME_ID);

    const matchInput = container.querySelector('input[name="matchId"]') as HTMLInputElement;
    expect(matchInput.value).toBe(MATCH_ID);
  });

  it("lists goals already recorded, with minute and scorer", () => {
    renderEvents([goal]);

    expect(screen.getByText("34′")).toBeTruthy();
    expect(screen.getByText("Praiz Igho")).toBeTruthy();
    // "Goal" also appears as an <option> in the form's event picker, so the
    // timeline badge is the second match.
    expect(screen.getAllByText("Goal").length).toBeGreaterThan(1);
    expect(screen.queryByText("No events recorded for this match.")).toBeNull();
  });
});
