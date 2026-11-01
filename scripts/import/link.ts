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
  classification: z.object({
    type: z.object({
      code: z.string().nullish(),
    }).nullish(),
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
    .replace(/ \([^)]*\)\.?$/, "")
    // Some titles have no "(lecture)" suffix but still end with a period
    .replace(/\.$/, "");
}

// Final votes whose title differs from every document of their file, checked by hand against the source
const LAW_UID_BY_VOTE_UID: Record<string, string> = {
  // "…du commerce et de l'industrie de Corse": the documents say "…de la collectivité de Corse"
  VTANR5L17V2900: "DLR5L17N52002",
  // "…relative à la sûreté dans les transports": the documents say "…relative au renforcement de la sûreté…"
  VTANR5L17V788: "DLR5L16N49176",
};

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

  // A text reaches a final vote after a committee report: this tells a debated file from an identical twin never debated
  const reportedLawUids = new Set(documents
    .filter(document => document.classification?.type?.code === "RAPP" && document.dossierRef)
    .map(document => document.dossierRef!));

  function matchByTitle(vote: Vote): string | null {
    if (!vote.isFinalVote)
      return null;
    const lawUids = [
      ...lawUidsByTitle.get(textTitleOfFinalVote(vote.title)) ?? [],
    ];
    const reported = lawUids.filter(uid => reportedLawUids.has(uid));
    // Only an unambiguous match links: a wrong link would show another law's vote
    if (lawUids.length === 1)
      return lawUids[0]!;
    return reported.length === 1
      ? reported[0]!
      : null;
  }

  for (const vote of votes) {
    const candidates = [
      vote.lawUid,
      lawUidByActVote.get(vote.uid),
      LAW_UID_BY_VOTE_UID[vote.uid],
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
