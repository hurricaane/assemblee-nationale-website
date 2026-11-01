import type { Vote } from "../../../shared/data/types.ts";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "vitest";

import { z } from "zod";

import { oneOrMany } from "../../../scripts/import/one-or-many.ts";
import { isFinalVoteTitle, RawScrutinFileSchema, resolveUnknownGroups, toVote } from "../../../scripts/import/votes.ts";

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

function withGroups(number: number, groups: [string, number][]): Vote {
  const vote = toVote(load("amendment-vote.json"));
  const tally = vote.groups[0]!.tally;
  return {
    ...vote,
    uid: `V${number}`,
    number,
    groups: groups.map(([groupId, members]) => ({
      groupId,
      members,
      position: "pour",
      tally,
    })),
  };
}

const ids = (vote: Vote) => vote.groups.map(group => group.groupId);

it("resolveUnknownGroups takes codes from the nearest complete vote by group size", () => {
  const before = withGroups(10, [
    ["PO1", 121],
    ["PO2", 90],
    ["PO3", 10],
  ]);
  const allUnknown = withGroups(12, [
    ["PO0", 121],
    ["PO0", 90],
    ["PO0", 10],
  ]);
  // Its nearest vote (12) has unknown groups too, so 10 is the reference
  const oneUnknown = withGroups(20, [
    ["PO0", 121],
    ["PO2", 90],
    ["PO3", 10],
  ]);
  resolveUnknownGroups([oneUnknown, allUnknown, before]);
  assert.deepEqual(ids(allUnknown), ["PO1", "PO2", "PO3"]);
  assert.deepEqual(ids(oneUnknown), ["PO1", "PO2", "PO3"]);
});

it("resolveUnknownGroups uses the vote after when sizes changed since the vote before", () => {
  const before = withGroups(1, [
    ["PO1", 94],
    ["PO2", 10],
  ]);
  const unknown = withGroups(2, [
    ["PO0", 93],
    ["PO2", 10],
  ]);
  const after = withGroups(3, [
    ["PO1", 93],
    ["PO2", 10],
  ]);
  resolveUnknownGroups([before, unknown, after]);
  assert.deepEqual(ids(unknown), ["PO1", "PO2"]);
});

it("resolveUnknownGroups leaves a group unknown when the votes before and after disagree", () => {
  const before = withGroups(1, [
    ["PO1", 50],
    ["PO2", 10],
  ]);
  const unknown = withGroups(2, [
    ["PO0", 50],
    ["PO2", 10],
  ]);
  const after = withGroups(3, [
    ["PO3", 50],
    ["PO2", 10],
  ]);
  resolveUnknownGroups([before, unknown, after]);
  assert.deepEqual(ids(unknown), ["PO0", "PO2"]);
});

it("resolveUnknownGroups leaves ambiguous groups unknown", () => {
  const reference = withGroups(1, [
    ["PO1", 50],
    ["PO2", 50],
    ["PO3", 10],
  ]);
  // Two reference groups of 50 members; two unknown groups of 10 members
  const sameSize = withGroups(2, [
    ["PO0", 50],
    ["PO0", 10],
    ["PO0", 10],
  ]);
  // The only 10-member group is already present in the vote
  const taken = withGroups(3, [
    ["PO0", 10],
    ["PO3", 10],
  ]);
  resolveUnknownGroups([reference, sameSize, taken]);
  assert.deepEqual(ids(sameSize), ["PO0", "PO0", "PO0"]);
  assert.deepEqual(ids(taken), ["PO0", "PO3"]);
});
