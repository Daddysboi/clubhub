import { isUuid } from "@/lib/format";

describe("route id guard", () => {
  it("accepts a real tournament UUID", () => {
    expect(isUuid("3f2504e0-4f89-11d3-9a0c-0305e82c3301")).toBe(true);
    expect(isUuid("3F2504E0-4F89-11D3-9A0C-0305E82C3301")).toBe(true);
  });

  it("rejects the placeholder slug that used to reach Postgres", () => {
    // This is the exact param that produced
    // "invalid input syntax for type uuid" on the admin tournament page.
    expect(isUuid("your-tournament-id")).toBe(false);
  });

  it("rejects other malformed ids", () => {
    expect(isUuid("")).toBe(false);
    expect(isUuid("mastic-fc")).toBe(false);
    expect(isUuid("3f2504e0-4f89-11d3-9a0c")).toBe(false);
    expect(isUuid("3f2504e0-4f89-11d3-9a0c-0305e82c3301x")).toBe(false);
    expect(isUuid(" 3f2504e0-4f89-11d3-9a0c-0305e82c3301")).toBe(false);
  });
});
