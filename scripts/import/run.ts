import type { z } from "zod";
import type { DatasetMeta } from "../../shared/data/types.ts";

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { RawOrganeFileSchema, toGroups } from "./groups.ts";
import { RawDossierFileSchema, toLaw } from "./laws.ts";
import { linkVotes, RawDocumentFileSchema } from "./link.ts";
import { RawScrutinFileSchema, resolveUnknownGroups, toVote } from "./votes.ts";
import { writeDataset } from "./write-dataset.ts";

export type ImportOptions = {
  legislature: number;
  sourceDir: string;
  outDir: string;
  now: Date;
};

const MAX_REPORTED_ERRORS = 20;

// Parses every file of a folder; errors are collected so one run reports all broken files at once
async function parseFolder<T extends z.ZodType>(dir: string, schema: T, errors: string[]): Promise<z.output<T>[]> {
  const names = (await readdir(dir)).filter(name => name.endsWith(".json")).toSorted();
  const records: z.output<T>[] = [];
  for (const name of names) {
    const path = join(dir, name);
    let json: unknown;
    try {
      json = JSON.parse(await readFile(path, "utf8"));
    }
    catch (error) {
      errors.push(`${path}: invalid JSON: ${error instanceof Error
        ? error.message
        : String(error)}`);
      continue;
    }
    const result = schema.safeParse(json);
    if (result.success) {
      records.push(result.data);
      continue;
    }
    for (const issue of result.error.issues)
      errors.push(`${path}: ${issue.path.join(".")}: ${issue.message}`);
  }
  return records;
}

export async function runImport(options: ImportOptions): Promise<{ written: number; deleted: number; meta: DatasetMeta }> {
  const { legislature, sourceDir, outDir, now } = options;

  // Validate everything before writing anything: a format change must not leave half-updated data
  const errors: string[] = [];
  const scrutins = await parseFolder(join(sourceDir, "scrutins/json"), RawScrutinFileSchema, errors);
  const dossiers = await parseFolder(join(sourceDir, "dossiers/json/dossierParlementaire"), RawDossierFileSchema, errors);
  const documents = await parseFolder(join(sourceDir, "dossiers/json/document"), RawDocumentFileSchema, errors);
  const organes = await parseFolder(join(sourceDir, "amo/json/organe"), RawOrganeFileSchema, errors);
  if (errors.length > 0) {
    const shown = errors.slice(0, MAX_REPORTED_ERRORS).join("\n  ");
    throw new Error(`${errors.length} validation errors in the source data:\n  ${shown}`);
  }

  const votes = scrutins.map(file => toVote(file.scrutin));
  resolveUnknownGroups(votes);
  const laws = dossiers.map(file => toLaw(file.dossierParlementaire));
  linkVotes(votes, laws, documents.map(file => file.document));
  const { groups, unresolvedGroupIds } = toGroups(organes.map(file => file.organe), legislature, votes);

  return writeDataset(outDir, {
    legislature,
    votes,
    laws,
    groups,
    unresolvedGroupIds,
  }, now);
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      legislature: { type: "string" },
      source: { type: "string" },
      out: { type: "string" },
    },
  });
  if (!values.legislature || !/^\d+$/.test(values.legislature) || !values.source || !values.out) {
    console.error("Usage: node scripts/import/run.ts --legislature 17 --source .cache/an/17 --out data");
    process.exit(1);
  }

  const started = Date.now();
  try {
    const { written, deleted, meta } = await runImport({
      legislature: Number(values.legislature),
      sourceDir: values.source,
      outDir: values.out,
      now: new Date(),
    });
    const { counts } = meta;
    process.stdout.write(
      `Imported legislature ${meta.legislature}: ${counts.votes} votes, ${counts.laws} legislative files, `
      + `${counts.linkedFinalVotes}/${counts.finalVotes} final votes linked, `
      + `unresolved groups: ${meta.unresolvedGroupIds.join(", ") || "none"}. `
      + `${written} files written, ${deleted} deleted in ${((Date.now() - started) / 1000).toFixed(1)}s.\n`,
    );
  }
  catch (error) {
    console.error(error instanceof Error
      ? error.message
      : error);
    process.exit(1);
  }
}
