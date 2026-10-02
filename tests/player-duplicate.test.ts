import { describe, expect, it } from "vitest";

import { classifyDuplicate } from "../lib/validation";

/**
 * Duplicate-registration contract.
 *
 * Names are not unique in the real world. The original guard treated any
 * name match as the same person, so a second "Temitope Yusuf" could never
 * register even though they were a different player entirely.
 *
 * The nickname is the unique handle instead, because the team sheet and
 * scorer board both key off it. A shared name is therefore fine; a shared
 * nickname is not.
 */
describe("classifyDuplicate", () => {
  it("allows a different name with a different nickname", () => {
    expect(
      classifyDuplicate({
        fullName: "Ahmed Yusuf",
        nickname: "Sharp Shooter",
        existing: { fullName: "Temitope Yusuf", nickname: "Temi" },
      }),
    ).toEqual({ kind: "allow" });
  });

  it("allows two people who share a name once both have distinct nicknames", () => {
    expect(
      classifyDuplicate({
        fullName: "Temitope Yusuf",
        nickname: "Big T",
        existing: { fullName: "Temitope Yusuf", nickname: "Temi" },
      }),
    ).toEqual({ kind: "allow" });
  });

  it("ignores case and surrounding whitespace when matching", () => {
    expect(
      classifyDuplicate({
        fullName: "  temitope   yusuf ",
        nickname: "Big T",
        existing: { fullName: "Temitope Yusuf", nickname: "temi" },
      }),
    ).toEqual({ kind: "allow" });
  });

  it("rejects the same nickname even when the names differ", () => {
    expect(
      classifyDuplicate({
        fullName: "Ahmed Yusuf",
        nickname: "Temi",
        existing: { fullName: "Temitope Yusuf", nickname: "Temi" },
      }),
    ).toEqual({ kind: "nickname-taken", nickname: "Temi" });
  });

  it("rejects a reused nickname on the same person", () => {
    expect(
      classifyDuplicate({
        fullName: "Temitope Yusuf",
        nickname: "Temi",
        existing: { fullName: "Temitope Yusuf", nickname: "Temi" },
      }),
    ).toEqual({ kind: "nickname-taken", nickname: "Temi" });
  });

  it("asks for a nickname when the name is taken and the newcomer has none", () => {
    expect(
      classifyDuplicate({
        fullName: "Temitope Yusuf",
        nickname: "",
        existing: { fullName: "Temitope Yusuf", nickname: "Temi" },
      }),
    ).toEqual({ kind: "name-taken", name: "Temitope Yusuf" });
  });

  it("asks for a nickname when the name is taken and the existing row has none", () => {
    expect(
      classifyDuplicate({
        fullName: "Temitope Yusuf",
        nickname: "Big T",
        existing: { fullName: "Temitope Yusuf", nickname: null },
      }),
    ).toEqual({ kind: "name-taken", name: "Temitope Yusuf" });
  });

  it("rejects a repeated name when neither side supplied a nickname", () => {
    expect(
      classifyDuplicate({
        fullName: "Temitope Yusuf",
        existing: { fullName: "Temitope Yusuf" },
      }),
    ).toEqual({ kind: "name-taken", name: "Temitope Yusuf" });
  });

  it("treats a whitespace-only nickname as absent", () => {
    expect(
      classifyDuplicate({
        fullName: "Temitope Yusuf",
        nickname: "   ",
        existing: { fullName: "Temitope Yusuf", nickname: "Temi" },
      }),
    ).toEqual({ kind: "name-taken", name: "Temitope Yusuf" });
  });
});
