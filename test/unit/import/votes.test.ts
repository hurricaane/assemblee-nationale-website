import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "vitest";

import { z } from "zod";

import { oneOrMany } from "../../../scripts/import/one-or-many.ts";
import { isFinalVoteTitle, RawScrutinFileSchema, toVote } from "../../../scripts/import/votes.ts";

function readFixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`./fixtures/scrutins/${name}`, import.meta.url), "utf8"));
}

function load(name: string) {
  return RawScrutinFileSchema.parse(readFixture(name)).scrutin;
}

it("toVote maps an amendment vote", () => {
  const vote = toVote(load("amendment-vote.json"));
  assert.equal(vote.uid, "VTANR5L17V5646");
  assert.equal(vote.number, 5646);
  assert.equal(vote.date, "2026-02-23");
  assert.equal(vote.type, "SPO");
  assert.equal(vote.result, "rejeté");
  assert.equal(vote.isFinalVote, false);
  assert.deepEqual(vote.tally, {
    pour: 45,
    contre: 59,
    abstentions: 2,
    nonVotants: 2,
    nonVotantsVolontaires: 0,
  });
  assert.equal(vote.lawUid, null);
  assert.ok(vote.groups.length > 0);
  assert.deepEqual(vote.groups.map(g => g.groupId), vote.groups.map(g => g.groupId).toSorted());
});

it("toVote marks a final vote and keeps its official file link", () => {
  const vote = toVote(load("final-vote.json"));
  assert.equal(vote.isFinalVote, true);
  assert.equal(vote.lawUid, "DLR5L17N51346");
});

it("oneOrMany accepts a bare object", () => {
  assert.deepEqual(oneOrMany(z.string()).parse("a"), ["a"]);
  assert.deepEqual(oneOrMany(z.string()).parse(["a", "b"]), ["a", "b"]);
  assert.deepEqual(oneOrMany(z.string()).parse(null), []);
});

it("a non-numeric count is rejected", () => {
  const withBadCount = readFixture("amendment-vote.json") as { scrutin: { syntheseVote: { decompte: { pour: string } } } };
  withBadCount.scrutin.syntheseVote.decompte.pour = "quarante";
  assert.throws(() => RawScrutinFileSchema.parse(withBadCount));
});

it("a vote on one part of a budget is not a final vote", () => {
  // Real titles: only the whole text's vote is final
  assert.equal(isFinalVoteTitle("l'ensemble de la deuxième partie du projet de loi de financement de la sécurité sociale pour 2025 (première lecture)."), false);
  assert.equal(isFinalVoteTitle("l’ensemble de la première partie du projet de loi de finances de fin de gestion pour 2024 (première lecture)."), false);
  assert.equal(isFinalVoteTitle("l'ensemble du projet de loi de finances pour 2025 (première lecture)."), true);
});

it("a uid that is not a plain identifier is rejected", () => {
  // uids become file names: "../" must never reach the file system
  const json = readFixture("amendment-vote.json") as { scrutin: { uid: string } };
  json.scrutin.uid = "../../etc/x";
  assert.throws(() => RawScrutinFileSchema.parse(json));
});
