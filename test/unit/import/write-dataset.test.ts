import type { Dataset } from "../../../scripts/import/write-dataset.ts";
import type { Group, Law, Vote } from "../../../shared/data/types.ts";

import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, it } from "vitest";

import { writeDataset } from "../../../scripts/import/write-dataset.ts";

const tally = {
  pour: 1,
  contre: 0,
  abstentions: 0,
  nonVotants: 0,
  nonVotantsVolontaires: 0,
};

function makeVote(n: number): Vote {
  return {
    uid: `VTANR5L17V${n}`,
    number: n,
    date: "2025-01-01",
    title: `vote ${n}`,
    type: "SPO",
    result: "adopté",
    isFinalVote: n === 1,
    tally,
    groups: [],
    lawUid: n === 1
      ? "DLR5L17N1"
      : null,
  };
}

const law: Law = {
  uid: "DLR5L17N1",
  legislature: 17,
  title: "law",
  procedure: {
    code: "2",
    label: "Proposition de loi ordinaire",
  },
  kind: "law",
  acts: [],
  voteUids: ["VTANR5L17V1"],
  promulgation: null,
  constitutionalCouncil: null,
};

const groups: Group[] = [
  {
    id: "PO0",
    name: null,
    shortName: null,
    startDate: null,
    endDate: null,
  },
];

function dataset(voteCount: number): Dataset {
  return {
    legislature: 17,
    votes: Array.from({ length: voteCount }, (_, i) => makeVote(i + 1)),
    laws: [law],
    groups,
    unresolvedGroupIds: ["PO0"],
  };
}

const first = new Date("2026-11-01T04:30:00Z");
const second = new Date("2026-11-02T04:30:00Z");
let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "an-data-"));
});

it("first run writes every file and meta", async () => {
  const data = dataset(3);
  const result = await writeDataset(dir, data, first);
  assert.equal(result.written, 3 + 1 + 2);
  assert.equal(result.deleted, 0);
  const meta = JSON.parse(await readFile(join(dir, "17/meta.json"), "utf8"));
  assert.deepEqual(meta, {
    legislature: 17,
    updatedAt: "2026-11-01T04:30:00.000Z",
    counts: {
      votes: 3,
      laws: 1,
      linkedVotes: 1,
      finalVotes: 1,
      linkedFinalVotes: 1,
    },
    unresolvedGroupIds: ["PO0"],
  });
  assert.equal(
    await readFile(join(dir, "17/votes/VTANR5L17V2.json"), "utf8"),
    `${JSON.stringify(makeVote(2), null, 2)}\n`,
  );
});

it("no-op run writes nothing", async () => {
  await writeDataset(dir, dataset(3), first);
  const result = await writeDataset(dir, dataset(3), second);
  assert.equal(result.written + result.deleted, 0);
  assert.match(await readFile(join(dir, "17/meta.json"), "utf8"), /2026-11-01T04:30/);
});

it("a changed vote rewrites that file and meta only", async () => {
  await writeDataset(dir, dataset(3), first);
  const changed = dataset(3);
  changed.votes[1]!.title = "renamed";
  const result = await writeDataset(dir, changed, second);
  assert.equal(result.written, 2);
  assert.equal(result.deleted, 0);
  assert.match(await readFile(join(dir, "17/meta.json"), "utf8"), /2026-11-02T04:30/);
});

it("a vote gone from the source is deleted", async () => {
  await writeDataset(dir, dataset(100), first);
  const result = await writeDataset(dir, dataset(99), second);
  assert.equal(result.deleted, 1);
  assert.equal((await readdir(join(dir, "17/votes"))).length, 99);
});

it("refuses mass deletion", async () => {
  await writeDataset(dir, dataset(100), first);
  await assert.rejects(writeDataset(dir, dataset(10), second), /Refusing to delete/);
  assert.equal((await readdir(join(dir, "17/votes"))).length, 100);
  assert.match(await readFile(join(dir, "17/meta.json"), "utf8"), /2026-11-01T04:30/);
});

it("refuses duplicate uids", async () => {
  const data = dataset(3);
  data.votes.push(makeVote(2));
  await assert.rejects(writeDataset(dir, data, first), /Duplicate vote uid VTANR5L17V2/);
});
