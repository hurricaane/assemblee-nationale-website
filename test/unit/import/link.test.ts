import type { RawDocument } from "../../../scripts/import/link.ts";
import type { Law, Vote } from "../../../shared/data/types.ts";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "vitest";

import { linkVotes, normalizeTitle, RawDocumentFileSchema } from "../../../scripts/import/link.ts";
import { RawScrutinFileSchema, toVote } from "../../../scripts/import/votes.ts";

function fixture(path: string) {
  return JSON.parse(readFileSync(new URL(`./fixtures/${path}`, import.meta.url), "utf8"));
}

function vote(name: string): Vote {
  return toVote(RawScrutinFileSchema.parse(fixture(`scrutins/${name}`)).scrutin);
}

function law(uid: string, actVoteUids: string[] = []): Law {
  return {
    uid,
    legislature: 17,
    title: uid,
    procedure: {
      code: "2",
      label: "Proposition de loi ordinaire",
    },
    kind: "law",
    acts: [
      {
        uid: `${uid}-ACT`,
        code: "AN1-DEBATS-DEC",
        label: "Décision",
        date: null,
        bodyId: null,
        outcome: null,
        voteUids: actVoteUids,
        textRefs: [],
      },
    ],
    voteUids: [...actVoteUids],
    promulgation: null,
    constitutionalCouncil: null,
  };
}

const document: RawDocument = RawDocumentFileSchema.parse(fixture("documents/matching-bill.json")).document;

it("normalizeTitle", () => {
  assert.equal(
    normalizeTitle("  Projet de loi portant  création de l’Établissement "),
    "projet de loi portant creation de l'etablissement",
  );
});

it("keeps the official link of the vote", () => {
  const final = vote("final-vote.json");
  const target = law("DLR5L17N51346");
  linkVotes([final], [target], []);
  assert.equal(final.lawUid, "DLR5L17N51346");
  assert.deepEqual(target.voteUids, [final.uid]);
});

it("act references link a vote", () => {
  const amendment = vote("amendment-vote.json");
  const target = law("DLR5L17N00001", [amendment.uid]);
  linkVotes([amendment], [target], []);
  assert.equal(amendment.lawUid, "DLR5L17N00001");
  assert.deepEqual(target.voteUids, [amendment.uid]);
});

it("final vote linked by unique title match", () => {
  const final = vote("unlinked-final-vote.json");
  const target = law(document.dossierRef!);
  linkVotes([final], [target], [document]);
  assert.equal(final.lawUid, document.dossierRef);
  assert.deepEqual(target.voteUids, [final.uid]);
});

it("ambiguous title match links nothing", () => {
  const final = vote("unlinked-final-vote.json");
  const twin = { ...document, uid: "OTHER", dossierRef: "DLR5L17N99999" };
  linkVotes([final], [
    law(document.dossierRef!),
    law(twin.dossierRef),
  ], [document, twin]);
  assert.equal(final.lawUid, null);
});

it("non-final votes never use title matching", () => {
  const amendment = vote("amendment-vote.json");
  const sameTitle = {
    ...document,
    titres: { titrePrincipal: amendment.title },
  };
  linkVotes([amendment], [
    law(document.dossierRef!),
  ], [sameTitle]);
  assert.equal(amendment.lawUid, null);
});

it("stub documents without a file reference are ignored", () => {
  // Seen in PIONANR5L17BTC2806: only uid and metadatas
  const stub = RawDocumentFileSchema.parse({
    document: { uid: "PIONANR5L17BTC2806" },
  }).document;
  const final = vote("unlinked-final-vote.json");
  linkVotes([final], [
    law(document.dossierRef!),
  ], [stub, document]);
  assert.equal(final.lawUid, document.dossierRef);
});

it("a link to a file missing from the dataset is dropped", () => {
  const final = vote("final-vote.json");
  linkVotes([final], [], []);
  assert.equal(final.lawUid, null);
});

it("final vote title ending with a period still matches", () => {
  const final = vote("unlinked-final-vote.json");
  final.title = `l'ensemble de la ${document.titres!.titrePrincipal!}.`;
  linkVotes([final], [
    law(document.dossierRef!),
  ], [document]);
  assert.equal(final.lawUid, document.dossierRef);
});

it("ambiguous title match picks the only file with a committee report", () => {
  const final = vote("unlinked-final-vote.json");
  const twin = { ...document, uid: "OTHER", dossierRef: "DLR5L17N99999" };
  const report = RawDocumentFileSchema.parse({
    document: {
      uid: "RAPPANR5L17B0001",
      dossierRef: twin.dossierRef,
      classification: {
        type: { code: "RAPP" },
      },
    },
  }).document;
  linkVotes([final], [
    law(document.dossierRef!),
    law(twin.dossierRef),
  ], [document, twin, report]);
  assert.equal(final.lawUid, twin.dossierRef);
});

it("votes listed by hand link to their file", () => {
  const final = {
    ...vote("unlinked-final-vote.json"),
    uid: "VTANR5L17V788",
  };
  const target = law("DLR5L16N49176");
  linkVotes([final], [target], []);
  assert.equal(final.lawUid, "DLR5L16N49176");
  assert.deepEqual(target.voteUids, ["VTANR5L17V788"]);
});
