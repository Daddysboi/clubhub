/**
 * Proves the duplicate-registration rule against the real schema, inside a
 * rolled-back transaction so live data is never touched.
 *
 * Checks the three outcomes that matter:
 *   1. a second player sharing a name is allowed once nicknames differ
 *   2. the same nickname is refused even under a different name
 *   3. a shared name with no nickname on either side is refused
 *
 * Run with: npx tsx scripts/test-duplicate-names.ts
 * Exits non-zero if any rule is wrong.
 */

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Add it to .env.local first.");
    process.exit(1);
  }
  return url;
}

async function main() {
  const postgres = (await import("postgres")).default;
  const sql = postgres(databaseUrl(), { prepare: false, connect_timeout: 15, max: 1 });

  const { classifyDuplicate } = await import("../lib/validation");

  let failures = 0;
  const check = (label: string, actual: unknown, expected: unknown) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (!ok) failures++;
    console.log(`  ${ok ? "pass" : "FAIL"}  ${label}`);
    if (!ok) {
      console.log(`        expected ${JSON.stringify(expected)}`);
      console.log(`        actual   ${JSON.stringify(actual)}`);
    }
  };

  await sql.begin(async (tx) => {
    // Seed a collision partner inside the transaction so the rule can be
    // exercised whatever state the live database is in. Rolled back below.
    const fullName = "Script Collision Test";
    const theirNick = "ScriptExisting";
    await tx`
      insert into players (full_name, nickname, position)
      values (${fullName}, ${theirNick}, 'Midfielder')
    `;

    console.log(`\nColliding with ${fullName} (nickname: ${theirNick})\n`);

    const verdict = (nickname: string | null, name = fullName) =>
      classifyDuplicate({
        fullName: name,
        nickname,
        existing: { fullName, nickname: theirNick },
      }).kind;

    check("same name, no nickname -> refused, asks for one", verdict(null), "name-taken");
    check(
      "same name, different nickname -> allowed",
      verdict("Script Distinct Nick"),
      "allow",
    );
    check(
      "same name, irregular spacing -> still recognised, asks for one",
      verdict(null, "  script   collision   TEST "),
      "name-taken",
    );
    check(
      "same nickname, different name -> refused",
      verdict(theirNick, "Totally Different Name"),
      "nickname-taken",
    );
    check(
      "different name and different nickname -> allowed",
      verdict("Script Nick", "Totally Different Name"),
      "allow",
    );

    // Throws to roll the transaction back.
    throw new Error("__ROLLBACK__");
  }).catch((error: unknown) => {
    if (error instanceof Error && error.message === "__ROLLBACK__") return;
    throw error;
  });

  await sql.end();

  console.log(
    failures === 0
      ? "\nAll duplicate-name rules hold. Transaction rolled back, no rows written."
      : `\n${failures} rule(s) wrong. Transaction rolled back, no rows written.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
