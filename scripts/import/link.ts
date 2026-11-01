import type { Law, Vote } from "../../shared/data/types.ts";

import { z } from "zod";

const RawDocumentSchema = z.object({
  uid: z.string(),
  // Stub documents carry only uid and metadata
  dossierRef: z.string().nullish(),
  // A few documents carry no title
  titres: z.object({
    titrePrincipal: z.string().nullish(),
  }).nullish(),
});

export const RawDocumentFileSchema = z.object({ document: RawDocumentSchema });

export type RawDocument = z.output<typeof RawDocumentSchema>;

export function normalizeTitle(text: string): string {
  return text
    .normalize("NFD")
    .replaceAll(/\p{M}/gu, "")
    .replaceAll("’", "'")
    .toLowerCase()
    .replaceAll(/\s+/g, " ")
    .trim();
}

// "l'ensemble du projet de loi … (première lecture)." → "projet de loi …"
function textTitleOfFinalVote(voteTitle: string): string {
  return normalizeTitle(voteTitle)
    .replace(/^l'ensemble (?:du|de la|des) /, "")
    .replace(/ \([^)]*\)\.?$/, "");
}

export function linkVotes(votes: Vote[], laws: Law[], documents: RawDocument[]): void {
  const lawsByUid = new Map(laws.map(law => [law.uid, law]));

  const lawUidByActVote = new Map<string, string>();
  for (const law of laws) {
    for (const act of law.acts) {
      for (const voteUid of act.voteUids) {
        if (!lawUidByActVote.has(voteUid))
          lawUidByActVote.set(voteUid, law.uid);
      }
    }
  }

  const lawUidsByTitle = new Map<string, Set<string>>();
  for (const document of documents) {
    const title = document.titres?.titrePrincipal;
    if (!title || !document.dossierRef)
      continue;
    const key = normalizeTitle(title);
    const lawUids = lawUidsByTitle.get(key) ?? new Set<string>();
    lawUids.add(document.dossierRef);
    lawUidsByTitle.set(key, lawUids);
  }

  function matchByTitle(vote: Vote): string | null {
    if (!vote.isFinalVote)
      return null;
    const lawUids = lawUidsByTitle.get(textTitleOfFinalVote(vote.title));
    // Only an unambiguous match links: a wrong link would show another law's vote
    return lawUids?.size === 1
      ? [...lawUids][0]!
      : null;
  }

  for (const vote of votes) {
    const candidates = [
      vote.lawUid,
      lawUidByActVote.get(vote.uid),
      matchByTitle(vote),
    ];
    const lawUid = candidates.find(uid => uid != null && lawsByUid.has(uid)) ?? null;
    vote.lawUid = lawUid;
    if (lawUid)
      lawsByUid.get(lawUid)!.voteUids.push(vote.uid);
  }

  for (const law of laws) {
    law.voteUids = [
      ...new Set(law.voteUids),
    ].toSorted();
  }
}
