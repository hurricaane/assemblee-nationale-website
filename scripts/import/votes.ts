import type { Tally, Vote } from "../../shared/data/types.ts";

import { z } from "zod";

import { oneOrMany } from "./one-or-many.ts";

// Counts are published as digit strings ("45")
const Count = z.string().regex(/^\d+$/).transform(Number);

const RawTallySchema = z.object({
  pour: Count,
  contre: Count,
  abstentions: Count,
  nonVotants: Count,
  nonVotantsVolontaires: Count,
});

const RawGroupSchema = z.object({
  organeRef: z.string(),
  nombreMembresGroupe: Count,
  vote: z.object({
    positionMajoritaire: z.enum(["pour", "contre", "abstention"]),
    decompteVoix: RawTallySchema,
  }),
});

const RawScrutinSchema = z.object({
  // Becomes a file name: plain identifiers only
  uid: z.string().regex(/^[A-Z0-9]+$/),
  numero: Count,
  dateScrutin: z.iso.date(),
  typeVote: z.object({
    codeTypeVote: z.enum(["SPO", "SPS", "MOC"]),
  }),
  sort: z.object({
    code: z.enum(["adopté", "rejeté"]),
  }),
  titre: z.string(),
  objet: z.object({
    dossierLegislatif: z.object({
      dossierRef: z.string(),
    }).nullish(),
  }),
  syntheseVote: z.object({ decompte: RawTallySchema }),
  ventilationVotes: z.object({
    organe: z.object({
      groupes: z.object({
        groupe: oneOrMany(RawGroupSchema),
      }),
    }),
  }),
});

export const RawScrutinFileSchema = z.object({ scrutin: RawScrutinSchema });

export type RawScrutin = z.output<typeof RawScrutinSchema>;

function toTally(raw: z.output<typeof RawTallySchema>): Tally {
  return {
    pour: raw.pour,
    contre: raw.contre,
    abstentions: raw.abstentions,
    nonVotants: raw.nonVotants,
    nonVotantsVolontaires: raw.nonVotantsVolontaires,
  };
}

export function isFinalVoteTitle(title: string): boolean {
  const normalized = title.trim().toLowerCase().replaceAll("’", "'");
  // "l'ensemble de la première partie du projet de loi de finances…" votes on one part only
  return normalized.startsWith("l'ensemble") && !/^l'ensemble de la \S+ partie /.test(normalized);
}

export function toVote(raw: RawScrutin): Vote {
  const groups = raw.ventilationVotes.organe.groupes.groupe
    .map(group => ({
      groupId: group.organeRef,
      members: group.nombreMembresGroupe,
      position: group.vote.positionMajoritaire,
      tally: toTally(group.vote.decompteVoix),
    }))
    .toSorted((a, b) => a.groupId.localeCompare(b.groupId));

  return {
    uid: raw.uid,
    number: raw.numero,
    date: raw.dateScrutin,
    title: raw.titre,
    type: raw.typeVote.codeTypeVote,
    result: raw.sort.code,
    isFinalVote: isFinalVoteTitle(raw.titre),
    tally: toTally(raw.syntheseVote.decompte),
    groups,
    lawUid: raw.objet.dossierLegislatif?.dossierRef ?? null,
  };
}
