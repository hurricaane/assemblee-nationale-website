// Records written by the nightly import (scripts/import) and read by the site

export type VotePosition = "pour" | "contre" | "abstention";

export type Tally = {
  pour: number;
  contre: number;
  abstentions: number;
  nonVotants: number;
  nonVotantsVolontaires: number;
};

export type GroupVote = {
  groupId: string;
  members: number;
  position: VotePosition;
  tally: Tally;
};

export type Vote = {
  uid: string;
  number: number;
  // YYYY-MM-DD
  date: string;
  title: string;
  type: "SPO" | "SPS" | "MOC";
  result: "adopté" | "rejeté";
  isFinalVote: boolean;
  tally: Tally;
  // Sorted by groupId
  groups: GroupVote[];
  lawUid: string | null;
};

export type LawKind = "law" | "treaty" | "budget" | "other";

export type LawAct = {
  uid: string;
  code: string;
  label: string;
  date: string | null;
  bodyId: string | null;
  outcome: string | null;
  voteUids: string[];
  textRefs: string[];
};

export type Law = {
  uid: string;
  legislature: number;
  title: string;
  procedure: { code: string; label: string };
  kind: LawKind;
  // Every act, depth-first, in source order
  acts: LawAct[];
  // Sorted, unique
  voteUids: string[];
  promulgation: { lawNumber: string; date: string; legifranceUrl: string | null } | null;
  // decision looks like "2025-884 DC"
  constitutionalCouncil: { decision: string; date: string | null; outcome: string; url: string | null } | null;
};

export type Group = {
  id: string;
  name: string | null;
  shortName: string | null;
  startDate: string | null;
  endDate: string | null;
};

export type DatasetMeta = {
  legislature: number;
  // ISO timestamp
  updatedAt: string;
  counts: { votes: number; laws: number; linkedVotes: number; finalVotes: number; linkedFinalVotes: number };
  unresolvedGroupIds: string[];
};
