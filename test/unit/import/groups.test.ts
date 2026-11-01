import type { Vote } from "../../../shared/data/types.ts";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "vitest";

import { RawOrganeFileSchema, toGroups } from "../../../scripts/import/groups.ts";

const organes = [
  "group-rn.json",
  "group-udr-dissolved.json",
  "group-ni.json",
  "committee.json",
]
  .map(name => JSON.parse(readFileSync(new URL(`./fixtures/organes/${name}`, import.meta.url), "utf8")))
  .map(json => RawOrganeFileSchema.parse(json).organe);

function voteWithGroups(groupIds: string[]): Vote {
  const tally = {
    pour: 0,
    contre: 0,
    abstentions: 0,
    nonVotants: 0,
    nonVotantsVolontaires: 0,
  };
  return {
    uid: "VT1",
    number: 1,
    date: "2025-01-01",
    title: "t",
    type: "SPO",
    result: "adopté",
    isFinalVote: false,
    tally,
    groups: groupIds.map(groupId => ({
      groupId,
      members: 1,
      position: "pour",
      tally,
    })),
    lawUid: null,
  };
}

it("toGroups keeps legislature groups, including dissolved ones", () => {
  const { groups, unresolvedGroupIds } = toGroups(organes, 17, []);
  assert.deepEqual(groups.map(g => g.id), ["PO840056", "PO845401", "PO847173"]);
  assert.deepEqual(groups.find(g => g.id === "PO847173"), {
    id: "PO847173",
    name: "UDR",
    shortName: "UDR",
    startDate: "2024-09-12",
    endDate: "2025-09-04",
  });
  assert.deepEqual(unresolvedGroupIds, []);
});

it("toGroups ignores groups of another legislature", () => {
  assert.deepEqual(toGroups(organes, 16, []).groups, []);
});

it("unresolved group codes", () => {
  const { groups, unresolvedGroupIds } = toGroups(organes, 17, [
    voteWithGroups(["PO845401", "PO0"]),
  ]);
  assert.deepEqual(unresolvedGroupIds, ["PO0"]);
  assert.deepEqual(groups.find(g => g.id === "PO0"), {
    id: "PO0",
    name: null,
    shortName: null,
    startDate: null,
    endDate: null,
  });
  assert.deepEqual(groups.map(g => g.id), [
    "PO0",
    "PO840056",
    "PO845401",
    "PO847173",
  ]);
});
