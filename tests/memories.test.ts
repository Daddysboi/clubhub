import {
  contentTypeFor,
  detectImageExtension,
  MAX_MEMORY_FILE_BYTES,
  memoryFileError,
} from "@/lib/images";
import { memoryMetaSchema } from "@/lib/validation";

const UUID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

function pngHeader() {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
}

describe("memory image validation", () => {
  it("recognises the three supported formats by magic bytes", () => {
    expect(detectImageExtension(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpg");
    expect(detectImageExtension(pngHeader())).toBe("png");
    const webp = new Uint8Array(12);
    webp.set(new TextEncoder().encode("RIFF"), 0);
    webp.set(new TextEncoder().encode("WEBP"), 8);
    expect(detectImageExtension(webp)).toBe("webp");
  });

  it("rejects a file whose name lies about its type", () => {
    const disguised = new TextEncoder().encode("MZ this is not an image");
    expect(detectImageExtension(disguised)).toBeNull();
  });

  it("rejects short or truncated headers", () => {
    expect(detectImageExtension(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(detectImageExtension(new Uint8Array())).toBeNull();
  });

  it("maps an extension back to a safe content type", () => {
    expect(contentTypeFor("jpg")).toBe("image/jpeg");
    expect(contentTypeFor("png")).toBe("image/png");
    expect(contentTypeFor("webp")).toBe("image/webp");
  });

  it("rejects unsupported, empty and oversized files", () => {
    expect(memoryFileError({ name: "a.gif", type: "image/gif", size: 100 })).toMatch(/JPG/);
    expect(memoryFileError({ name: "a.jpg", type: "image/jpeg", size: 0 })).toMatch(/empty/);
    expect(
      memoryFileError({
        name: "big.jpg",
        type: "image/jpeg",
        size: MAX_MEMORY_FILE_BYTES + 1,
      }),
    ).toMatch(/5 MB/);
  });

  it("accepts a normal photo", () => {
    expect(
      memoryFileError({ name: "final.jpg", type: "image/jpeg", size: 400_000 }),
    ).toBeNull();
  });
});

describe("memory metadata", () => {
  const base = {
    tournamentId: UUID,
    caption: "",
    matchId: "",
    width: 1800,
    height: 1200,
  };

  it("accepts an uncaptured photo with no fixture tag", () => {
    expect(memoryMetaSchema.safeParse(base).success).toBe(true);
  });

  it("accepts a caption and a fixture tag", () => {
    expect(memoryMetaSchema.safeParse({ ...base, caption: "The final", matchId: UUID }).success).toBe(
      true,
    );
  });

  it("rejects a bad tournament id and an overlong caption", () => {
    expect(memoryMetaSchema.safeParse({ ...base, tournamentId: "mastic-fc" }).success).toBe(false);
    expect(memoryMetaSchema.safeParse({ ...base, caption: "x".repeat(141) }).success).toBe(false);
  });

  it("rejects impossible dimensions from a crafted request", () => {
    expect(memoryMetaSchema.safeParse({ ...base, width: 0 }).success).toBe(false);
    expect(memoryMetaSchema.safeParse({ ...base, height: 99999 }).success).toBe(false);
  });
});
