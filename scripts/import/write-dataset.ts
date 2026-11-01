import type { DatasetMeta, Group, Law, Vote } from "../../shared/data/types.ts";

import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type Dataset = {
  legislature: number;
  votes: Vote[];
  laws: Law[];
  groups: Group[];
  unresolvedGroupIds: string[];
};

// A truncated download must not wipe the site: below this share of the existing files, stop
const MIN_SHARE_OF_EXISTING = 0.95;

function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function readIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return null;
    throw error;
  }
}

async function listJson(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).filter(name => name.endsWith(".json"));
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return [];
    throw error;
  }
}

function assertNotShrinking(kind: string, existing: number, next: number): void {
  if (existing > 0 && next < existing * MIN_SHARE_OF_EXISTING) {
    throw new Error(
      `Refusing to delete ${existing - next} ${kind} files: the source has ${next}, the repository ${existing}. `
      + "Check the download before importing.",
    );
  }
}

// Two records with the same uid would silently overwrite each other's file
function assertUnique(kind: string, uids: string[]): void {
  const seen = new Set<string>();
  for (const uid of uids) {
    if (seen.has(uid))
      throw new Error(`Duplicate ${kind} uid ${uid} in the source data.`);
    seen.add(uid);
  }
}

function computeMeta(dataset: Dataset, updatedAt: string): DatasetMeta {
  const finalVotes = dataset.votes.filter(vote => vote.isFinalVote);
  return {
    legislature: dataset.legislature,
    updatedAt,
    counts: {
      votes: dataset.votes.length,
      laws: dataset.laws.length,
      linkedVotes: dataset.votes.filter(vote => vote.lawUid !== null).length,
      finalVotes: finalVotes.length,
      linkedFinalVotes: finalVotes.filter(vote => vote.lawUid !== null).length,
    },
    unresolvedGroupIds: dataset.unresolvedGroupIds,
  };
}

export async function writeDataset(
  outDir: string,
  dataset: Dataset,
  now: Date,
): Promise<{ written: number; deleted: number; meta: DatasetMeta }> {
  const base = join(outDir, String(dataset.legislature));
  const folders = {
    votes: join(base, "votes"),
    laws: join(base, "laws"),
  };

  const existingVotes = await listJson(folders.votes);
  const existingLaws = await listJson(folders.laws);
  assertNotShrinking("vote", existingVotes.length, dataset.votes.length);
  assertNotShrinking("law", existingLaws.length, dataset.laws.length);

  assertUnique("vote", dataset.votes.map(vote => vote.uid));
  assertUnique("law", dataset.laws.map(law => law.uid));

  const files = new Map<string, string>();
  for (const vote of dataset.votes)
    files.set(join(folders.votes, `${vote.uid}.json`), serialize(vote));
  for (const law of dataset.laws)
    files.set(join(folders.laws, `${law.uid}.json`), serialize(law));
  files.set(join(base, "groups.json"), serialize(dataset.groups));

  await mkdir(folders.votes, { recursive: true });
  await mkdir(folders.laws, { recursive: true });

  let written = 0;
  for (const [path, content] of files) {
    if (await readIfExists(path) !== content) {
      await writeFile(path, content);
      written++;
    }
  }

  let deleted = 0;
  const stale = [
    ...existingVotes.map(name => join(folders.votes, name)),
    ...existingLaws.map(name => join(folders.laws, name)),
  ].filter(path => !files.has(path));
  for (const path of stale) {
    await unlink(path);
    deleted++;
  }

  // meta.json changes only with the data, so a quiet night produces no commit and no rebuild
  const metaPath = join(base, "meta.json");
  const previousMeta = await readIfExists(metaPath);
  if (written + deleted === 0 && previousMeta !== null) {
    return {
      written,
      deleted,
      meta: JSON.parse(previousMeta) as DatasetMeta,
    };
  }

  const meta = computeMeta(dataset, now.toISOString());
  await writeFile(metaPath, serialize(meta));
  return { written: written + 1, deleted, meta };
}
