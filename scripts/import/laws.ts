import type { Law, LawAct, LawKind } from "../../shared/data/types.ts";

import { z } from "zod";

import { oneOrMany } from "./one-or-many.ts";

// "2025-06-13T00:00:00.000+02:00" → "2025-06-13"
const ActDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/).transform(value => value.slice(0, 10));

type RawAct = {
  "@xsi:type"?: string | null;
  "uid": string;
  "codeActe": string;
  "libelleActe": { nomCanonique: string };
  "organeRef"?: string | null;
  "dateActe"?: string | null;
  "statutConclusion"?: { libelle?: string | null } | null;
  "voteRefs"?: { voteRef: string[] } | null;
  "texteAdopteRef"?: string | null;
  "texteAssocie"?: string | null;
  "textesAssocies"?: { texteAssocie: { refTexteAssocie: string }[] } | null;
  "codeLoi"?: string | null;
  "infoJO"?: { urlLegifrance?: string | null } | null;
  "urlConclusion"?: string | null;
  "numDecision"?: string | null;
  "anneeDecision"?: string | null;
  "actesLegislatifs"?: { acteLegislatif: RawAct[] } | null;
};

const RawActSchema: z.ZodType<RawAct, unknown> = z.lazy(() => z.object({
  "@xsi:type": z.string().nullish(),
  "uid": z.string(),
  "codeActe": z.string(),
  "libelleActe": z.object({
    nomCanonique: z.string(),
  }),
  "organeRef": z.string().nullish(),
  "dateActe": ActDate.nullish(),
  // Sometimes only a code is present, e.g. { "fam_code": "TSORTFnull" }
  "statutConclusion": z.object({
    libelle: z.string().nullish(),
  }).nullish(),
  "voteRefs": z.object({
    voteRef: oneOrMany(z.string()),
  }).nullish(),
  "texteAdopteRef": z.string().nullish(),
  "texteAssocie": z.string().nullish(),
  "textesAssocies": z.object({
    texteAssocie: oneOrMany(z.object({
      refTexteAssocie: z.string(),
    })),
  }).nullish(),
  "codeLoi": z.string().nullish(),
  "infoJO": z.object({
    urlLegifrance: z.string().nullish(),
  }).nullish(),
  "urlConclusion": z.string().nullish(),
  "numDecision": z.string().nullish(),
  "anneeDecision": z.string().nullish(),
  "actesLegislatifs": z.object({
    acteLegislatif: oneOrMany(RawActSchema),
  }).nullish(),
}));

const RawDossierSchema = z.object({
  // Becomes a file name: plain identifiers only
  uid: z.string().regex(/^[A-Z0-9]+$/),
  legislature: z.string().regex(/^\d+$/),
  titreDossier: z.object({
    titre: z.string(),
  }),
  procedureParlementaire: z.object({
    code: z.string(),
    libelle: z.string(),
  }),
  actesLegislatifs: z.object({
    acteLegislatif: oneOrMany(RawActSchema),
  }).nullish(),
});

export const RawDossierFileSchema = z.object({ dossierParlementaire: RawDossierSchema });

export type RawDossier = z.output<typeof RawDossierSchema>;

const KIND_BY_PROCEDURE: Record<string, LawKind> = {
  1: "law",
  2: "law",
  5: "law",
  7: "law",
  23: "law",
  6: "treaty",
  3: "budget",
  4: "budget",
  21: "budget",
  33: "budget",
};

export function lawKind(procedureCode: string): LawKind {
  return KIND_BY_PROCEDURE[procedureCode] ?? "other";
}

function flatten(acts: RawAct[]): RawAct[] {
  return acts.flatMap(act => [
    act,
    ...flatten(act.actesLegislatifs?.acteLegislatif ?? []),
  ]);
}

function textRefs(act: RawAct): string[] {
  const refs = [
    act.texteAdopteRef,
    act.texteAssocie,
    ...(act.textesAssocies?.texteAssocie ?? []).map(text => text.refTexteAssocie),
  ];
  return [
    ...new Set(refs.filter(ref => ref != null)),
  ];
}

function toAct(act: RawAct): LawAct {
  return {
    uid: act.uid,
    code: act.codeActe,
    label: act.libelleActe.nomCanonique,
    date: act.dateActe ?? null,
    bodyId: act.organeRef ?? null,
    outcome: act.statutConclusion?.libelle ?? null,
    voteUids: act.voteRefs?.voteRef ?? [],
    textRefs: textRefs(act),
  };
}

export function toLaw(raw: RawDossier): Law {
  const rawActs = flatten(raw.actesLegislatifs?.acteLegislatif ?? []);

  const promulgationAct = rawActs.find(act => act.codeActe === "PROM-PUB" && act.codeLoi && act.dateActe);
  // Several referrals are possible: the last conclusion is the one that stands
  const ccAct = rawActs.findLast(act => act["@xsi:type"] === "ConclusionEtapeCC_Type");

  return {
    uid: raw.uid,
    legislature: Number(raw.legislature),
    title: raw.titreDossier.titre,
    procedure: { code: raw.procedureParlementaire.code, label: raw.procedureParlementaire.libelle },
    kind: lawKind(raw.procedureParlementaire.code),
    acts: rawActs.map(toAct),
    voteUids: [
      ...new Set(rawActs.flatMap(act => act.voteRefs?.voteRef ?? [])),
    ].toSorted(),
    promulgation: promulgationAct
      ? {
          lawNumber: promulgationAct.codeLoi!,
          date: promulgationAct.dateActe!,
          legifranceUrl: promulgationAct.infoJO?.urlLegifrance ?? null,
        }
      : null,
    constitutionalCouncil: ccAct
      ? {
          decision: `${ccAct.anneeDecision}-${ccAct.numDecision} DC`,
          date: ccAct.dateActe ?? null,
          outcome: ccAct.statutConclusion?.libelle ?? "",
          url: ccAct.urlConclusion ?? null,
        }
      : null,
  };
}
