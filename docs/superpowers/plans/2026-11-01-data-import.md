# Nightly Data Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A nightly GitHub Action that downloads the Assemblée nationale's official open data, validates it, and commits a trimmed, deterministic copy (votes, legislative files, political groups) as JSON files in `data/`.

**Architecture:** A shell script downloads and unzips the three official archives. A Node script (TypeScript run directly by Node's type stripping, no build step) validates the raw records with Zod, transforms them into small typed records, links votes to legislative files, and writes only the files whose content changed. A scheduled workflow runs both and commits `data/` when something changed, which triggers the Vercel build.

**Tech Stack:** Node 26 (native TypeScript type stripping, `node:test`), Zod 4, GitHub Actions with `jdx/mise-action`, `curl` and `unzip`.

**Spec:** `docs/superpowers/specs/2026-11-01-data-and-explanations-design.md` (sections "Research findings", "Everything lives in the repository", "Nightly import"). This is plan 1 of 3; the website pages and the weekly drafting get their own plans once these file shapes exist.

## Global Constraints

- **Never commit or stage** (CLAUDE.md). Every task ends with changes left uncommitted for the maintainer. Only the CI workflow of Task 7 commits, as a bot.
- **Look up docs before coding** (CLAUDE.md): Zod 4 and `node:test` via context7 (`mcp__plugin_context7_context7__query-docs`), even for familiar APIs.
- Scripts run with plain `node` (no `tsx`, no build): relative imports carry the `.ts` extension, and only erasable TypeScript syntax is allowed (no `enum`, no parameter properties, no `namespace`).
- No new runtime dependency. Zod is already installed; tests use `node:test` and `node:assert/strict`.
- No `process.env` (ESLint `node/no-process-env`): configuration comes from CLI arguments. CLI output goes through `process.stdout.write` / `console.warn` / `console.error` (`no-console` allows warn and error only).
- `type`, not `interface`; double quotes; semicolons; kebab-case file names (CLAUDE.md ESLint rules).
- The legislature number is a CLI argument (`--legislature 17`), never hard-coded in the transform code.
- Facts are copied from the source, never computed or guessed: counts, results, positions and dates come straight from the official records.

## Review Focus

1. **The official server returns a truncated or empty archive.** Expected: the import refuses to delete hundreds of existing files and exits non-zero (Task 5, `refuses mass deletion`).
2. **A list with one element arrives as a bare object** (XML-to-JSON conversion: `groupe`, `acteLegislatif`, `voteRef`, `texteAssocie`). Expected: treated as a one-element list, never a crash or a silently dropped item (Task 1, `oneOrMany accepts a bare object`, and Task 3, `single act object`).
3. **A vote references a group code missing from the group list** (`PO0` in 146 votes, dissolved groups). Expected: the vote is kept, the group stored with `name: null`, and the code listed in `meta.json` `unresolvedGroupIds` (Task 2, `unresolved group codes`).
4. **A night where nothing changed upstream.** Expected: zero files written, including `meta.json`, so no commit and no rebuild (Task 5, `no-op run writes nothing`).
5. **One record in a new, unexpected format.** Expected: the whole run fails before writing anything, and the error names the file (Task 6, `invalid record aborts before writing`).

---

## File Structure

| Path | Responsibility |
|---|---|
| `shared/data/types.ts` | Output record types (`Vote`, `Law`, `Group`, `DatasetMeta`), shared with the future Nuxt pages and drafting scripts |
| `scripts/import/one-or-many.ts` | Zod helper: accept `T`, `T[]` or `null`, output `T[]` |
| `scripts/import/votes.ts` | Raw vote (`scrutin`) schema and `toVote` |
| `scripts/import/groups.ts` | Raw `organe` schema and `toGroups` |
| `scripts/import/laws.ts` | Raw `dossierParlementaire` schema and `toLaw` |
| `scripts/import/link.ts` | Raw `document` schema and `linkVotes` |
| `scripts/import/write-dataset.ts` | Deterministic serialization, changed-only writes, deletion guard, `meta.json` |
| `scripts/import/run.ts` | CLI: read extracted source folders, run everything, report |
| `scripts/import/download.sh` | Download and unzip the three archives |
| `scripts/import/fixtures/` | Trimmed real records used by the tests |
| `scripts/import/*.test.ts` | Tests, one file per module |
| `scripts/tsconfig.json` | Type checking for `scripts/` (editor and `tsc`) |
| `.github/workflows/import-data.yml` | Nightly schedule, commit `data/` |

Output layout (one folder per legislature, so a new legislature never touches the previous one's files):

```
data/17/votes/<vote uid>.json
data/17/laws/<legislative file uid>.json
data/17/groups.json
data/17/meta.json
```

This refines the spec's `data/votes/…` paths with a legislature folder.

## Source facts the code relies on

Verified on 2026-11-01 against the real archives.

- Votes archive: `https://data.assemblee-nationale.fr/static/openData/repository/{L}/loi/scrutins/Scrutins.json.zip`, files `json/*.json`, each `{ "scrutin": … }`. All counts are digit strings (`"45"`). `positionMajoritaire` ∈ `pour | contre | abstention`. `sort.code` ∈ `adopté | rejeté`. `typeVote.codeTypeVote` ∈ `SPO | SPS | MOC`. The group list is `ventilationVotes.organe.groupes.groupe`.
- Legislative files archive: `https://data.assemblee-nationale.fr/static/openData/repository/{L}/loi/dossiers_legislatifs/Dossiers_Legislatifs.json.zip`, files `json/dossierParlementaire/*.json` (`{ "dossierParlementaire": … }`) and `json/document/*.json` (`{ "document": … }`). Acts nest recursively under `actesLegislatifs.acteLegislatif`. Promulgation leaf: `codeActe: "PROM-PUB"` with `codeLoi`, `dateActe`, `infoJO.urlLegifrance`. Constitutional Council leaf: `@xsi:type: "ConclusionEtapeCC_Type"` with `statutConclusion.libelle`, `urlConclusion`, `numDecision`, `anneeDecision`, `dateActe`. Votes are referenced by `voteRefs.voteRef` (string or array). The archive includes some files from older legislatures still active in the 17e.
- Groups: `https://data.assemblee-nationale.fr/static/openData/repository/{L}/amo/tous_acteurs_mandats_organes_xi_legislature/AMO30_tous_acteurs_tous_mandats_tous_organes_historique.json.zip`, files `json/organe/*.json` (`{ "organe": … }`); groups have `codeType: "GP"`. This historical archive is required: the active-deputies archive misses dissolved groups such as `PO847173` (UDR, 2024-09-12 to 2025-09-04, present in 3,041 votes). `PO0` (146 votes) exists in no archive.
- Official vote-to-file links (`objet.dossierLegislatif.dossierRef` plus `voteRefs`) connect 3,805 of 9,459 votes, and 193 of the 221 final votes (title starting `l'ensemble`).
- Procedure codes (`procedureParlementaire.code`): `1, 2, 5, 7, 23` are laws; `6` is treaty ratification; `3, 4, 21, 33` are budget laws; everything else (resolutions, inquiries, reports, censure motions…) is `other`.

---

### Task 1: Tooling, output types, and vote transform

**Files:**
- Create: `shared/data/types.ts`, `scripts/tsconfig.json`, `scripts/import/one-or-many.ts`, `scripts/import/votes.ts`, `scripts/import/votes.test.ts`, `scripts/import/fixtures/scrutins/` (2 files)
- Modify: `package.json` (scripts), `eslint.config.mjs` (ignore `data/**`)

**Interfaces:**
- Produces, in `shared/data/types.ts`:

```ts
export type VotePosition = "pour" | "contre" | "abstention";
export type Tally = { pour: number; contre: number; abstentions: number; nonVotants: number; nonVotantsVolontaires: number };
export type GroupVote = { groupId: string; members: number; position: VotePosition; tally: Tally };
export type Vote = {
  uid: string; number: number; date: string; // YYYY-MM-DD
  title: string; type: "SPO" | "SPS" | "MOC"; result: "adopté" | "rejeté";
  isFinalVote: boolean; tally: Tally; groups: GroupVote[]; // sorted by groupId
  lawUid: string | null; // toVote sets the official link or null; linkVotes (Task 4) completes it
};
export type LawKind = "law" | "treaty" | "budget" | "other";
export type LawAct = { uid: string; code: string; label: string; date: string | null; bodyId: string | null; outcome: string | null; voteUids: string[]; textRefs: string[] };
export type Law = {
  uid: string; legislature: number; title: string;
  procedure: { code: string; label: string }; kind: LawKind;
  acts: LawAct[]; // every act, depth-first, source order
  voteUids: string[]; // sorted, unique; completed by linkVotes
  promulgation: { lawNumber: string; date: string; legifranceUrl: string | null } | null;
  constitutionalCouncil: { decision: string; date: string | null; outcome: string; url: string | null } | null; // decision like "2025-884 DC"
};
export type Group = { id: string; name: string | null; shortName: string | null; startDate: string | null; endDate: string | null };
export type DatasetMeta = {
  legislature: number; updatedAt: string; // ISO timestamp
  counts: { votes: number; laws: number; linkedVotes: number; finalVotes: number; linkedFinalVotes: number };
  unresolvedGroupIds: string[];
};
```

- Produces: `oneOrMany<T extends z.ZodType>(schema: T)` in `scripts/import/one-or-many.ts`: accepts a `T`, a `T[]` or `null`, outputs `T[]` (`null` gives `[]`).
- Produces: `RawScrutinFileSchema` (Zod, `{ scrutin: … }`), type `RawScrutin`, and `toVote(raw: RawScrutin): Vote` in `scripts/import/votes.ts`.

- [ ] **Step 1: Tooling.** Add to `package.json` scripts: `"test": "node --test \"scripts/**/*.test.ts\""` and `"import:data": "node scripts/import/run.ts"`. Add `"data/**"` to the ESLint `ignores` array. Create `scripts/tsconfig.json` with `strict`, `noEmit`, `module: "nodenext"`, `target: "esnext"`, `allowImportingTsExtensions`, `erasableSyntaxOnly`, `types: ["node"]`, including `**/*.ts` and `../shared/data/**/*.ts`.

- [ ] **Step 2: Fixtures.** Copy two real records from the votes archive into `scripts/import/fixtures/scrutins/`, removing every `decompteNominatif` subtree to keep them small: `VTANR5L17V5646.json` (amendment, rejeté, no file link in `objet`) and one final vote with `objet.dossierLegislatif` set (any vote whose `titre` starts with `l'ensemble` and has a `dossierRef`). Edit nothing else.

- [ ] **Step 3: Write the failing tests** in `scripts/import/votes.test.ts`:

```ts
test("toVote maps an amendment vote", () => {
  const vote = toVote(load("VTANR5L17V5646.json"));
  assert.equal(vote.uid, "VTANR5L17V5646");
  assert.equal(vote.number, 5646);
  assert.equal(vote.date, "2026-02-23");
  assert.equal(vote.type, "SPO");
  assert.equal(vote.result, "rejeté");
  assert.equal(vote.isFinalVote, false);
  assert.deepEqual(vote.tally, { pour: 45, contre: 59, abstentions: 2, nonVotants: 2, nonVotantsVolontaires: 0 });
  assert.equal(vote.lawUid, null);
  assert.deepEqual(vote.groups.map(g => g.groupId), vote.groups.map(g => g.groupId).toSorted());
});
test("toVote marks a final vote and keeps its official file link", () => {
  const vote = toVote(load("<final vote fixture>.json"));
  assert.equal(vote.isFinalVote, true);
  assert.match(vote.lawUid ?? "", /^DLR5L\d+N\d+$/);
});
test("oneOrMany accepts a bare object", () => {
  assert.deepEqual(oneOrMany(z.string()).parse("a"), ["a"]);
  assert.deepEqual(oneOrMany(z.string()).parse(["a", "b"]), ["a", "b"]);
  assert.deepEqual(oneOrMany(z.string()).parse(null), []);
});
test("a non-numeric count is rejected", () => {
  // copy of the amendment fixture with syntheseVote.decompte.pour = "quarante"
  assert.throws(() => RawScrutinFileSchema.parse(withBadCount));
});
```

`load(name)` reads the fixture and returns `RawScrutinFileSchema.parse(json).scrutin`.

- [ ] **Step 4: Run** `pnpm test`. Expected: FAIL (modules missing).

- [ ] **Step 5: Implement** `oneOrMany`, `RawScrutinFileSchema` and `toVote`. Counts: digit-string schema (`/^\d+$/`) transformed to `number`. `isFinalVote`: `titre`, trimmed and lower-cased, starts with `l'ensemble` (accept both `'` and `’`). The schema reads only the fields `toVote` needs; unknown keys are stripped.

- [ ] **Step 6: Run** `pnpm test` and `pnpm exec tsc -p scripts`. Expected: tests PASS, no type errors.

- [ ] **Step 7: Stop.** Leave changes uncommitted.

### Task 2: Groups

**Files:**
- Create: `scripts/import/groups.ts`, `scripts/import/groups.test.ts`, `scripts/import/fixtures/organes/` (`PO845401.json`, `PO847173.json`, `PO840056.json` from the AMO30 archive, plus one non-group organe such as a committee)

**Interfaces:**
- Consumes: `Group`, `Vote` from `shared/data/types.ts`.
- Produces: `RawOrganeFileSchema`, type `RawOrgane`, `toGroups(organes: RawOrgane[], legislature: number, votes: Vote[]): { groups: Group[]; unresolvedGroupIds: string[] }`. Keeps `codeType === "GP"` organes of that legislature; adds a `{ id, name: null, shortName: null, startDate: null, endDate: null }` entry for every group id referenced by a vote but absent from the source. Output sorted by `id`.

- [ ] **Step 1: Write the failing tests:**

```ts
test("toGroups keeps legislature groups, including dissolved ones", () => {
  const { groups } = toGroups(organes, 17, []);
  assert.deepEqual(groups.map(g => g.id), ["PO840056", "PO845401", "PO847173"]);
  assert.deepEqual(groups.find(g => g.id === "PO847173"),
    { id: "PO847173", name: "UDR", shortName: "UDR", startDate: "2024-09-12", endDate: "2025-09-04" });
});
test("unresolved group codes", () => {
  const { groups, unresolvedGroupIds } = toGroups(organes, 17, [voteWithGroups(["PO845401", "PO0"])]);
  assert.deepEqual(unresolvedGroupIds, ["PO0"]);
  assert.deepEqual(groups.find(g => g.id === "PO0"),
    { id: "PO0", name: null, shortName: null, startDate: null, endDate: null });
});
```

- [ ] **Step 2: Run** `pnpm test`. Expected: FAIL.
- [ ] **Step 3: Implement.** `name` from `libelle`, `shortName` from `libelleAbrev`, dates from `viMoDe.dateDebut` / `viMoDe.dateFin`. The source's `couleurAssociee` (party colors) is deliberately not stored: DESIGN.md forbids party colors in the chrome and the data palette is still undecided.
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS.
- [ ] **Step 5: Stop.** Leave changes uncommitted.

### Task 3: Legislative files

**Files:**
- Create: `scripts/import/laws.ts`, `scripts/import/laws.test.ts`, `scripts/import/fixtures/dossiers/` (`DLR5L17N51078.json`, which has `PROM-PUB`; one real file with a `ConclusionEtapeCC_Type` act; one resolution file, procedure code `8`)

**Interfaces:**
- Consumes: `Law`, `LawAct`, `LawKind`, `oneOrMany`.
- Produces: `RawDossierFileSchema`, type `RawDossier`, `toLaw(raw: RawDossier): Law`, `lawKind(procedureCode: string): LawKind`.

- [ ] **Step 1: Write the failing tests:**

```ts
test("toLaw reads promulgation", () => {
  const law = toLaw(load("DLR5L17N51078.json"));
  assert.equal(law.kind, "law");
  assert.equal(law.legislature, 17);
  assert.equal(law.promulgation?.lawNumber, "2025-531");
  assert.equal(law.promulgation?.date, "2025-06-13");
  assert.match(law.promulgation?.legifranceUrl ?? "", /legifrance\.gouv\.fr/);
});
test("toLaw reads the constitutional council decision", () => {
  const cc = toLaw(load("<file with CC conclusion>.json")).constitutionalCouncil;
  assert.ok(cc);
  assert.match(cc.decision, /^\d{4}-\d+ DC$/);
  assert.match(cc.url ?? "", /conseil-constitutionnel\.fr/);
});
test("acts are flattened depth-first and keep vote references", () => {
  const law = toLaw(load("DLR5L17N51078.json"));
  assert.ok(law.acts.length > 1);
  assert.ok(law.acts.every(a => a.date === null || /^\d{4}-\d{2}-\d{2}$/.test(a.date)));
  assert.deepEqual(law.voteUids, [...new Set(law.acts.flatMap(a => a.voteUids))].toSorted());
});
test("single act object", () => {
  // the resolution fixture with actesLegislatif.acteLegislatif rewritten as a bare object
  assert.ok(toLaw(singleActDossier).acts.length >= 1);
});
test("lawKind maps procedure codes", () => {
  assert.equal(lawKind("2"), "law");
  assert.equal(lawKind("6"), "treaty");
  assert.equal(lawKind("21"), "budget");
  assert.equal(lawKind("8"), "other");
  assert.equal(lawKind("999"), "other");
});
```

- [ ] **Step 2: Run** `pnpm test`. Expected: FAIL.
- [ ] **Step 3: Implement.** The act schema is recursive (`z.lazy`); `acteLegislatif`, `voteRefs.voteRef` and `textesAssocies.texteAssocie` use `oneOrMany`. Dates keep the `YYYY-MM-DD` prefix of `dateActe` (`"2025-06-13T00:00:00.000+02:00"` → `"2025-06-13"`). `LawAct.code` is the full `codeActe` (e.g. `CMP-DEBATS-AN-DEC`), `label` is `libelleActe.nomCanonique`, `bodyId` is `organeRef`, `outcome` is `statutConclusion.libelle`, `textRefs` lists the `texteAdopteRef`, `texteAssocie` and `textesAssocies` refs present on the act. Constitutional council `decision` is `` `${anneeDecision}-${numDecision} DC` ``. `legislature` is `Number(raw.legislature)`. `law.voteUids` is the sorted, unique set of act vote refs (Task 4 adds more).
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS.
- [ ] **Step 5: Stop.** Leave changes uncommitted.

### Task 4: Linking votes to legislative files

**Files:**
- Create: `scripts/import/link.ts`, `scripts/import/link.test.ts`, `scripts/import/fixtures/documents/` (one real `document` file whose `titrePrincipal` matches a final vote the official links miss, e.g. the bill "portant création de l'établissement public du commerce et de l'industrie de Corse")

**Interfaces:**
- Consumes: `Vote`, `Law`.
- Produces: `RawDocumentFileSchema`, type `RawDocument`, `normalizeTitle(text: string): string`, `linkVotes(votes: Vote[], laws: Law[], documents: RawDocument[]): void`. Mutates in place: sets `vote.lawUid` and adds to `law.voteUids` (kept sorted and unique).

Link order: (1) the vote's own official link (already in `vote.lawUid`); (2) a law whose `acts` reference the vote uid; (3) final votes only: title match. Title match drops the leading `l'ensemble du ` / `l'ensemble de la ` / `l'ensemble des ` and the trailing ` (…).` reading marker, normalizes, and compares with the normalized `titres.titrePrincipal` of every document; it links only when exactly one distinct `dossierRef` matches and that law exists. A vote link pointing to a law absent from the dataset is reset to `null`.

- [ ] **Step 1: Write the failing tests:**

```ts
test("normalizeTitle", () => {
  assert.equal(normalizeTitle("  Projet de loi portant  création de l’Établissement "),
    "projet de loi portant creation de l'etablissement");
});
test("act references link a vote", () => { // vote.lawUid null; law has an act with voteUids [vote.uid]
  linkVotes([vote], [law], []);
  assert.equal(vote.lawUid, law.uid);
  assert.deepEqual(law.voteUids, [vote.uid]);
});
test("final vote linked by unique title match", () => { // "l'ensemble du projet de loi portant création de … (première lecture)."
  linkVotes([vote], [law], [doc]);
  assert.equal(vote.lawUid, doc.dossierRef);
});
test("ambiguous title match links nothing", () => { // two documents, same title, different dossierRef
  linkVotes([vote], [lawA, lawB], [docA, docB]);
  assert.equal(vote.lawUid, null);
});
test("non-final votes never use title matching", () => {
  linkVotes([amendmentVote], [law], [doc]);
  assert.equal(amendmentVote.lawUid, null);
});
```

- [ ] **Step 2: Run** `pnpm test`. Expected: FAIL.
- [ ] **Step 3: Implement.** `normalizeTitle`: NFD, strip combining marks, `’` → `'`, lower case, collapse whitespace, trim.
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS.
- [ ] **Step 5: Stop.** Leave changes uncommitted.

### Task 5: Writing the dataset

**Files:**
- Create: `scripts/import/write-dataset.ts`, `scripts/import/write-dataset.test.ts` (temporary directories via `mkdtemp`)

**Interfaces:**
- Consumes: `Vote`, `Law`, `Group`, `DatasetMeta`.
- Produces: `writeDataset(outDir: string, dataset: { legislature: number; votes: Vote[]; laws: Law[]; groups: Group[]; unresolvedGroupIds: string[] }, now: Date): Promise<{ written: number; deleted: number; meta: DatasetMeta }>`.

Behavior: target folder `outDir/<legislature>/`. Each record is serialized as `JSON.stringify(record, null, 2) + "\n"` (key order fixed by the transform functions). A file is written only if its content differs from what is on disk. Vote and law files no longer in the dataset are deleted, unless the dataset has fewer than 95% of the existing vote files or of the existing law files: then nothing is written or deleted, and it throws an `Error` whose message contains `Refusing to delete`. `meta.json` is rewritten (with `updatedAt = now.toISOString()` and the counts) only if at least one other file was written or deleted. `linkedVotes` counts votes with a non-null `lawUid`.

- [ ] **Step 1: Write the failing tests:**

```ts
test("first run writes every file and meta", async () => {
  const r = await writeDataset(dir, dataset, new Date("2026-11-01T04:30:00Z"));
  assert.equal(r.written, dataset.votes.length + dataset.laws.length + 2); // + groups.json + meta.json
  assert.equal(JSON.parse(await readFile(join(dir, "17/meta.json"), "utf8")).updatedAt, "2026-11-01T04:30:00.000Z");
});
test("no-op run writes nothing", async () => {
  await writeDataset(dir, dataset, new Date("2026-11-01T04:30:00Z"));
  const r = await writeDataset(dir, dataset, new Date("2026-11-02T04:30:00Z"));
  assert.equal(r.written + r.deleted, 0);
  assert.match(await readFile(join(dir, "17/meta.json"), "utf8"), /2026-11-01T04:30/);
});
test("a changed vote rewrites that file and meta only", async () => { // change one vote title between runs
  assert.equal(r.written, 2);
  assert.equal(r.deleted, 0);
});
test("refuses mass deletion", async () => { // first run with 100 votes, second run with 10
  await assert.rejects(writeDataset(dir, small, now), /Refusing to delete/);
  assert.equal((await readdir(join(dir, "17/votes"))).length, 100);
});
```

- [ ] **Step 2: Run** `pnpm test`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS.
- [ ] **Step 5: Stop.** Leave changes uncommitted.

### Task 6: CLI and download script

**Files:**
- Create: `scripts/import/run.ts`, `scripts/import/run.test.ts`, `scripts/import/download.sh`
- Modify: `.gitignore` (add `.cache/`)

**Interfaces:**
- Consumes: everything above.
- Produces: `runImport(options: { legislature: number; sourceDir: string; outDir: string; now: Date }): Promise<{ written: number; deleted: number; meta: DatasetMeta }>`, exported for tests. The module calls it with the parsed CLI arguments only when executed directly (`import.meta.main`).
- CLI: `node scripts/import/run.ts --legislature 17 --source .cache/an/17 --out data` (parse with `node:util` `parseArgs`). Expected source layout, as unzipped by `download.sh`: `<source>/scrutins/json/*.json`, `<source>/dossiers/json/dossierParlementaire/*.json`, `<source>/dossiers/json/document/*.json`, `<source>/amo/json/organe/*.json`.
- `download.sh <legislature> <dir>`: `set -euo pipefail`; `curl -fsSL` the three archive URLs from "Source facts" into `<dir>`; `unzip -q -o` into `<dir>/scrutins`, `<dir>/dossiers` and `<dir>/amo` (for AMO30, extract only `json/organe/*`).

`runImport` order: read and validate **all** files first (collect up to 20 validation errors, each prefixed with its file name, then throw), then transform, `linkVotes`, `toGroups`, `writeDataset`. Any error exits non-zero. On success, print one summary line to stdout: votes, laws, linked final votes (`linkedFinalVotes/finalVotes`), unresolved group ids, files written and deleted.

- [ ] **Step 1: Write the failing tests** (build a source tree in a temp dir from the Task 1 to 4 fixtures):

```ts
test("end to end on fixtures", async () => {
  const r = await runImport({ legislature: 17, sourceDir: src, outDir: out, now });
  assert.equal(r.meta.counts.votes, 2);
  assert.ok(existsSync(join(out, "17/groups.json")));
});
test("invalid record aborts before writing", async () => { // add a scrutin file with sort.code "reporté"
  await assert.rejects(runImport({ legislature: 17, sourceDir: badSrc, outDir: out2, now }), /VT\w*\.json/);
  assert.equal(existsSync(join(out2, "17")), false);
});
```

- [ ] **Step 2: Run** `pnpm test`. Expected: FAIL.
- [ ] **Step 3: Implement** `run.ts` and `download.sh` (`chmod +x`).
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS.
- [ ] **Step 5: Real run.** `scripts/import/download.sh 17 .cache/an/17 && pnpm import:data --legislature 17 --source .cache/an/17 --out data`. Expected: about 9,500 vote files and about 3,400 law files under `data/17/`; the summary shows at least 193 linked final votes out of about 221, and `PO0` among unresolved group ids. Report `du -sh data/17` and the import duration. Run the same command again: expected 0 written, 0 deleted.
- [ ] **Step 6: Run** `pnpm lint`. Expected: no errors; `data/` is not linted.
- [ ] **Step 7: Stop.** Leave changes uncommitted; report the real-run figures to the maintainer.

### Task 7: Nightly workflow

**Files:**
- Create: `.github/workflows/import-data.yml`

**Interfaces:**
- Consumes: `scripts/import/download.sh`, `pnpm import:data`.

Workflow requirements:
- Triggers: `schedule: cron "30 4 * * *"` (04:30 UTC, after the archives' overnight refresh) and `workflow_dispatch`.
- `concurrency: { group: import-data, cancel-in-progress: false }`; `permissions: contents: write`; `timeout-minutes: 30`.
- Workflow-level `env: LEGISLATURE: 17`, used by the download and import steps (read by the workflow, passed to the scripts as arguments).
- Steps: `actions/checkout`; `jdx/mise-action` (installs Node and pnpm from `mise.toml`); `pnpm install --frozen-lockfile`; `scripts/import/download.sh "$LEGISLATURE" ".cache/an/$LEGISLATURE"`; `pnpm import:data --legislature "$LEGISLATURE" --source ".cache/an/$LEGISLATURE" --out data`; if `git status --porcelain data/` is non-empty, commit `data/` as `github-actions[bot]` (`41898283+github-actions[bot]@users.noreply.github.com`) with message `chore(data): import Assemblée nationale open data`, then push.
- Pin each action to its latest release tag; look the tags up before writing.

- [ ] **Step 1: Write the workflow.**
- [ ] **Step 2: Validate** with `actionlint` (`mise x actionlint -- actionlint`). Expected: no errors. If actionlint cannot be installed, say so in the report.
- [ ] **Step 3: Stop.** Leave changes uncommitted. Tell the maintainer: after they commit and push, run the workflow once by hand (`gh workflow run import-data.yml`) and check that it commits `data/17/` and that Vercel starts a build. The first real Nuxt build time with about 13,000 data files is measured in plan 2.
