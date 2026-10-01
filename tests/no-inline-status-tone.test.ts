import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The status→tone ternary was originally copy-pasted into three separate
 * pages. Two were fixed and one was missed, which is exactly how this test
 * exists: a page that hard-codes the mapping is a page that can drift.
 */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx$/.test(entry)) out.push(full);
  }
  return out;
}

const files = [...sourceFilePaths("app"), ...sourceFilePaths("components")];

function sourceFilePaths(dir: string): string[] {
  return sourceFiles(dir).map((p) => p.replace(/\\/g, "/"));
}

describe("status badge mapping", () => {
  it("finds the page files it is checking", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files)("%s does not inline the status-to-tone mapping", (file) => {
    const source = readFileSync(file, "utf8");
    expect(source).not.toMatch(/status\s*===\s*"live"\s*\?/);
    expect(source).not.toMatch(/status\s*===\s*"done"\s*\?/);
  });
});