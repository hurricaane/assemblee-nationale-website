import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "vitest";

import { lawKind, RawDossierFileSchema, toLaw } from "../../../scripts/import/laws.ts";

function readFixture(name: string) {
  return JSON.parse(readFileSync(new URL(`./fixtures/dossiers/${name}`, import.meta.url), "utf8"));
}

function load(name: string) {
  return RawDossierFileSchema.parse(readFixture(name)).dossierParlementaire;
}

it("toLaw reads promulgation", () => {
  const law = toLaw(load("promulgated-law.json"));
  assert.equal(law.uid, "DLR5L17N51078");
  assert.equal(law.kind, "law");
  assert.equal(law.legislature, 17);
  assert.equal(law.promulgation?.lawNumber, "2025-531");
  assert.equal(law.promulgation?.date, "2025-06-13");
  assert.match(law.promulgation?.legifranceUrl ?? "", /legifrance\.gouv\.fr/);
});

it("toLaw reads the constitutional council decision", () => {
  const cc = toLaw(load("promulgated-law.json")).constitutionalCouncil;
  assert.deepEqual(cc, {
    decision: "2025-884 DC",
    date: "2025-06-05",
    outcome: "Conforme",
    url: "http://www.conseil-constitutionnel.fr/decision/2025/2025884DC.htm",
  });
  assert.match(toLaw(load("law-with-cc-decision.json")).constitutionalCouncil?.decision ?? "", /^\d{4}-\d+ DC$/);
});

it("acts are flattened depth-first and keep vote references", () => {
  const law = toLaw(load("promulgated-law.json"));
  assert.ok(law.acts.length > 1);
  assert.ok(law.acts.every(a => a.date === null || /^\d{4}-\d{2}-\d{2}$/.test(a.date)));
  assert.deepEqual(law.voteUids, [
    ...new Set(law.acts.flatMap(a => a.voteUids)),
  ].toSorted());
  assert.ok(law.acts.some(a => a.code === "PROM-PUB"));
});

it("single act object", () => {
  const json = readFixture("resolution.json");
  const acts = json.dossierParlementaire.actesLegislatifs.acteLegislatif;
  json.dossierParlementaire.actesLegislatifs.acteLegislatif = Array.isArray(acts)
    ? acts[0]
    : acts;
  const law = toLaw(RawDossierFileSchema.parse(json).dossierParlementaire);
  assert.ok(law.acts.length >= 1);
  assert.equal(law.kind, "other");
});

it("an act whose conclusion has no label keeps a null outcome", () => {
  // Seen in DLR5L17N50588: "statutConclusion": { "fam_code": "TSORTFnull" }
  const json = readFixture("promulgated-law.json");
  const acts = json.dossierParlementaire.actesLegislatifs.acteLegislatif;
  const first = Array.isArray(acts)
    ? acts[0]
    : acts;
  first.statutConclusion = { fam_code: "TSORTFnull" };
  const law = toLaw(RawDossierFileSchema.parse(json).dossierParlementaire);
  assert.equal(law.acts[0]!.outcome, null);
});

it("lawKind maps procedure codes", () => {
  assert.equal(lawKind("2"), "law");
  assert.equal(lawKind("6"), "treaty");
  assert.equal(lawKind("21"), "budget");
  assert.equal(lawKind("8"), "other");
  assert.equal(lawKind("999"), "other");
});

it("a legislative file uid that is not a plain identifier is rejected", () => {
  const json = readFixture("resolution.json");
  json.dossierParlementaire.uid = "DLR5L17N1/../../x";
  assert.throws(() => RawDossierFileSchema.parse(json));
});
