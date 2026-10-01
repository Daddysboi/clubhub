import { STATUS_TONE, statusLabel, statusTone } from "@/lib/tones";

describe("tournament status badges", () => {
  it("shows an in-progress competition as green, not broadcast red", () => {
    // "live" status is a running competition, so it uses the pitch tone.
    // The red `live` tone is reserved for a fixture currently being played.
    expect(statusTone("live")).toBe("pitch");
    expect(statusTone("live")).not.toBe("live");
  });

  it("does not render an in-progress tournament in the red accent", () => {
    expect(STATUS_TONE.live).toBe("pitch");
  });

  it("marks a completed competition as settled, not as still in play", () => {
    expect(statusTone("done")).toBe("neutral");
  });

  it("marks a draft as pending", () => {
    expect(statusTone("draft")).toBe("warn");
  });

  it("falls back to neutral for an unknown status rather than guessing", () => {
    expect(statusTone("archived")).toBe("neutral");
    expect(statusTone("")).toBe("neutral");
  });

  it("labels each status in plain language", () => {
    expect(statusLabel("live")).toBe("Live");
    expect(statusLabel("done")).toBe("Completed");
    expect(statusLabel("draft")).toBe("Draft");
  });

  it("passes an unrecognised status through unchanged", () => {
    expect(statusLabel("archived")).toBe("archived");
  });

  it("covers every tone the badge can render", () => {
    const tones = Object.values(STATUS_TONE);
    expect(new Set(tones).size).toBe(tones.length);
  });
});