import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { it } from "vitest";

import { runImport } from "../../../scripts/import/run.ts";

const fixtures = fileURLToPath(new URL("./fixtures", import.meta.url));
const now = new Date("2026-11-01T04:30:00Z");

// Same layout as download.sh produces
async function sourceTree(): Promise<string> {
  const src = await mkdtemp(join(tmpdir(), "an-source-"));
  await cp(join(fixtures, "scrutins"), join(src, "scrutins/json"), { recursive: true });
  await cp(join(fixtures, "dossiers"), join(src, "dossiers/json/dossierParlementaire"), { recursive: true });
  await cp(join(fixtures, "documents"), join(src, "dossiers/json/document"), { recursive: true });
  await cp(join(fixtures, "organes"), join(src, "amo/json/organe"), { recursive: true });
  return src;
}

it("end to end on fixtures", async () => {
  const out = await mkdtemp(join(tmpdir(), "an-out-"));
  const result = await runImport({
    legislature: 17,
    sourceDir: await sourceTree(),
    outDir: out,
    now,
  });
  assert.equal(result.meta.counts.votes, 3);
  assert.equal(result.meta.counts.laws, 3);
  const groups = JSON.parse(await readFile(join(out, "17/groups.json"), "utf8"));
  assert.ok(groups.some((group: { id: string }) => group.id === "PO845401"));
  assert.ok(existsSync(join(out, "17/votes/VTANR5L17V5646.json")));
  assert.ok(existsSync(join(out, "17/laws/DLR5L17N51078.json")));
});

it("invalid record aborts before writing", async () => {
  const src = await sourceTree();
  const bad = JSON.parse(await readFile(join(fixtures, "scrutins/amendment-vote.json"), "utf8"));
  bad.scrutin.sort.code = "reporté";
  await writeFile(join(src, "scrutins/json/VTBAD.json"), JSON.stringify(bad));
  const out = await mkdtemp(join(tmpdir(), "an-out-"));
  await assert.rejects(
    runImport({
      legislature: 17,
      sourceDir: src,
      outDir: out,
      now,
    }),
    /VTBAD\.json/,
  );
  assert.equal(existsSync(join(out, "17")), false);
});

it("malformed JSON names the file", async () => {
  const src = await sourceTree();
  await writeFile(join(src, "scrutins/json/VTBROKEN.json"), "{ not json");
  const out = await mkdtemp(join(tmpdir(), "an-out-"));
  await assert.rejects(
    runImport({
      legislature: 17,
      sourceDir: src,
      outDir: out,
      now,
    }),
    /VTBROKEN\.json: invalid JSON/,
  );
  assert.equal(existsSync(join(out, "17")), false);
});
