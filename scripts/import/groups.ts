import type { Group, Vote } from "../../shared/data/types.ts";

import { z } from "zod";

// The archive holds every kind of body (committees, delegations…); only groups (codeType "GP") are kept
const RawOrganeSchema = z.object({
  uid: z.string(),
  codeType: z.string(),
  libelle: z.string().nullish(),
  libelleAbrev: z.string().nullish(),
  legislature: z.string().nullish(),
  viMoDe: z.object({
    dateDebut: z.iso.date().nullish(),
    dateFin: z.iso.date().nullish(),
  }).nullish(),
});

export const RawOrganeFileSchema = z.object({ organe: RawOrganeSchema });

export type RawOrgane = z.output<typeof RawOrganeSchema>;

export function toGroups(
  organes: RawOrgane[],
  legislature: number,
  votes: Vote[],
): { groups: Group[]; unresolvedGroupIds: string[] } {
  const groups = new Map<string, Group>();
  for (const organe of organes) {
    if (organe.codeType !== "GP" || organe.legislature !== String(legislature))
      continue;
    groups.set(organe.uid, {
      id: organe.uid,
      name: organe.libelle ?? null,
      shortName: organe.libelleAbrev ?? null,
      startDate: organe.viMoDe?.dateDebut ?? null,
      endDate: organe.viMoDe?.dateFin ?? null,
    });
  }

  // Votes can cite codes the source doesn't describe (e.g. "PO0"): keep them, flagged by an empty name
  const unresolved = new Set<string>();
  for (const vote of votes) {
    for (const { groupId } of vote.groups) {
      if (!groups.has(groupId))
        unresolved.add(groupId);
    }
  }
  for (const id of unresolved) {
    groups.set(id, {
      id,
      name: null,
      shortName: null,
      startDate: null,
      endDate: null,
    });
  }

  return {
    groups: [
      ...groups.values(),
    ].toSorted((a, b) => a.id.localeCompare(b.id)),
    unresolvedGroupIds: [...unresolved].toSorted(),
  };
}
