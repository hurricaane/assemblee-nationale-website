# Data pipeline and explanations: design

Date: 2026-11-01
Status: draft, awaiting approval

## Intent

The site explains, in plain French, the laws voted by the Assemblée nationale: what each law changes, how each political group voted, and the final outcome. Credibility is the product: facts must be exact and traceable, and the explanations must read like careful human writing, not AI output.

The maintainer is one person with a new full-time job. Their only recurring task is a **weekly review session on a laptop, on the weekend**: read a short batch of AI drafts, fix the wording, merge. Everything else runs unattended.

The architecture must last for years with near-zero maintenance and a running cost of **10 € per month at most**, using free tiers for hosting.

## Goals

- Import official vote and legislative data automatically, every night.
- Show every vote (result, totals, breakdown by political group) and every law's path (Assemblée, Sénat, CMP, Conseil constitutionnel, promulgation) without human work.
- Produce plain-language explanations of laws as AI drafts, delivered weekly as one GitHub pull request, published only after the maintainer merges.
- Keep facts (numbers, results, group positions, dates) out of the AI's hands entirely: they come from the official data at render time.
- Survive changes in the official data format, the AI model market, and free-tier offers without the site breaking.

## Non-goals (v1)

- Pages per deputy or per political group (groups appear only inside each vote's breakdown).
- Senate per-group vote breakdowns.
- Explanations of individual amendments or procedural votes (they appear as data only).
- Previous legislatures (v1 covers the current one, the 17e).
- Real-time updates, user accounts, comments, an admin interface, a database.

## Anti-goals (failure even if it works)

- The AI writes or alters any number, result, group position or date.
- An explanation is published without the maintainer's review.
- Writing that reads as AI-generated, or framing that suggests a political side.
- The site depends on a single third-party aggregator (e.g. CIVIX) that could disappear.
- Any infrastructure that can pause, expire or start billing without a deliberate decision.
- The explanation pretends to be human-written or official.

## Constraints

- Stack already in place: Nuxt 4, Nuxt UI v4, TailwindCSS v4, TypeScript, Zod, pnpm. Hosting on Vercel (free Hobby tier), repository on GitHub, CI on GitHub Actions.
- The repository (`hurricaane/assemblee-nationale-website`) is **public**: GitHub Actions minutes are free and unlimited, and Vercel builds commits pushed by the CI bot.
- Budget: 10 € / month maximum, almost entirely AI usage.
- Data license: Licence Ouverte (Etalab 2.0). Every page credits "Source : Assemblée nationale" with a link to the original record.
- Tooling secrets (AI API key) live in GitHub Actions secrets, never in the app's `.env` (consistent with CLAUDE.md).
- Accessibility (RGAA 4.1) and product rules from PRODUCT.md and DESIGN.md apply to every page this pipeline feeds. In particular: vote positions are never encoded by color alone.

## Research findings the design relies on

Verified on 2026-11-01 by downloading and inspecting the files.

**Official open data (data.assemblee-nationale.fr), the source of truth.**

- Votes: `https://data.assemblee-nationale.fr/static/openData/repository/17/loi/scrutins/Scrutins.json.zip` (28 MB zipped, one JSON file per vote, 9,459 votes for the 17e legislature as of 2026-10-31, refreshed daily). Each vote (`scrutin`) has `uid`, `numero`, `dateScrutin`, `typeVote` (SPO ordinary / SPS solemn / MOC censure motion), `sort.code` (`adopté` / `rejeté`), `titre`, `objet.dossierLegislatif`, `syntheseVote.decompte` (pour, contre, abstentions, nonVotants), and `ventilationVotes.organe.groupes.groupe[]` with, per group, `organeRef`, `nombreMembresGroupe`, `vote.positionMajoritaire` and `vote.decompteVoix`, plus per-deputy nominative votes.
- Legislative files: `https://data.assemblee-nationale.fr/static/openData/repository/17/loi/dossiers_legislatifs/Dossiers_Legislatifs.json.zip` (10.6 MB zipped; 3,380 `dossierParlementaire` files and 7,574 `document` files). Each file nests `actesLegislatifs` with stage codes: `AN1`, `SN1`, `AN2`, `SN2`, `CMP`, `ANNLEC`, `SNNLEC`, `ANLDEF`, `ANLUNI`, `CC`, `PROM`. The `PROM` act carries `codeLoi` (e.g. `2025-531`), `dateActe`, and `infoJO.urlLegifrance`.
- Full text of adopted texts is served as HTML at `https://www.assemblee-nationale.fr/dyn/opendata/<texte uid>.html` (e.g. `PIONANR5L17BTA0103`), returned 200.
- Group names: vote files only carry group codes (`organeRef`, e.g. `PO845401`). Names and abbreviations come from the "acteurs / organes" dataset on the same portal.

**Known data gaps the design must handle.**

- Only 38% of votes (3,633 of 9,459) carry `objet.dossierLegislatif`. Some legislative files carry `voteRefs` on their acts (571 files contain the key, often null). Linking votes to laws needs our own matching.
- Only 221 votes are final votes on a whole text (title starting `l'ensemble du/de la ...`). Many laws pass by show of hands, which produces no recorded vote and therefore no group breakdown.
- The file format has changed between legislatures in the past.

**Volume.** 152 laws of the 17e legislature were promulgated between July 2024 and October 2026 (about 5 per month): 29 approve international treaties or agreements, 8 are budget or social security financing laws, 115 are other laws.

**Alternatives considered and rejected as foundations.**

- CIVIX API (civix.fr): independent, run by one person, same underlying official data, schema dated 2026-04-29. Adds a point of failure without adding data. Acceptable for occasional manual cross-checks only.
- NosDéputés.fr / NosParlementaires (Regards Citoyens): current-legislature API status unclear; ODbL license adds share-alike obligations.
- Tricoteuses: mature open-source cleaner of this exact data, but AGPL. Use as a reference for data quirks, do not depend on its library.
- Légifrance API (PISTE): requires registration; not needed in v1 because the promulgation act already gives the Légifrance link.

## Architecture

### Everything lives in the repository

No database. Three kinds of files, all in the main GitHub repository:

| Path                                | Content                                                                                                                                                                                                           | Written by                                               |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `data/votes/<uid>.json`             | One vote: date, title, type, result, totals, per-group positions and counts, linked law uid if known                                                                                                              | Nightly import bot                                       |
| `data/laws/<uid>.json`              | One law (legislative file): title, procedure, ordered stages with dates and bodies, linked vote uids, adopted text refs, promulgation (law number, date, Légifrance URL), Conseil constitutionnel decision if any | Nightly import bot                                       |
| `data/groups.json`                  | Political groups of the legislature: code, name, abbreviation                                                                                                                                                     | Nightly import bot                                       |
| `data/meta.json`                    | Last successful import time and source file dates                                                                                                                                                                 | Nightly import bot                                       |
| `content/explanations/<law uid>.md` | Reviewed explanation of one law (frontmatter + Markdown body)                                                                                                                                                     | Weekly drafting bot, edited and merged by the maintainer |
| `content/style-guide.md`            | The voice rules the drafting bot follows                                                                                                                                                                          | Maintainer                                               |
| `content/examples/*.md`             | 2–3 reference explanations written or approved by the maintainer                                                                                                                                                  | Maintainer                                               |

Per-deputy nominative votes are **not** stored in v1 (they would multiply the size by about 50 and no v1 page needs them). Trimmed vote data measured at 19.5 MB for 9,459 votes, about 45 MB for a full legislature: acceptable for git, and only diffs are committed each night.

Raw official zip files are **not** kept. The official portal keeps them; our trimmed copy is versioned by git.

### Nightly import (GitHub Actions, scheduled)

1. Download the votes, legislative files and groups datasets for the configured legislature.
2. Parse and validate every record with Zod schemas. If validation fails (format change), the job fails, GitHub notifies the maintainer, and nothing is committed: the site keeps serving the last good data.
3. Transform into the trimmed files above. Output must be deterministic (stable key order, stable formatting) so unchanged records produce no diff.
4. Link votes to laws: use `objet.dossierLegislatif` when present, then `voteRefs` from legislative acts, then a matching strategy on titles and dates (builder's design). Unlinked votes are still published as standalone votes.
5. Commit changed files to the default branch as a bot commit (commits by CI are intended; the "never commit" rule in CLAUDE.md concerns the AI assistant, not this bot). The commit triggers a Vercel production build.

The legislature number (`17`) is a configuration value, not hard-coded: a dissolution or a new legislature must only require changing it (and the previous legislature's files stay in place).

### Weekly drafting (GitHub Actions, scheduled Saturday morning)

1. **Select candidates:** laws whose stages include a new "final" event since their explanation was last reviewed (or that have no explanation yet). Final events: definitive adoption by Parliament, a Conseil constitutionnel decision, promulgation. This includes laws adopted by show of hands. Cap the number of drafts per run (configurable, default 15) to protect the budget.
   - **In scope for a full explanation:** all laws except treaty and agreement approvals, including budget and social security financing laws.
   - **Treaty and agreement approvals** ("autorisant l'approbation / la ratification de …") get no AI explanation. Their page shows a one-line summary built from the official title by a fixed template (no AI, so nothing unreviewed is published).
   - **Backlog at launch:** every law of the 17e legislature that already reached a final event is a candidate (about 120 full explanations as of 2026-10). With the cap of 15, the first runs catch up over about 10 weekends, most recent laws first, then the regular pace of about 5 laws per month takes over.
2. **Gather sources** for each law: the adopted text, the original bill's explanatory statement (exposé des motifs), and the committee report if needed for context. Official public pages outside the Assemblée are allowed as sources: senat.fr (explanatory statement of bills first filed at the Sénat) and conseil-constitutionnel.fr (decision text, so censured articles are never described as law). Légifrance is linked, not fetched. Laws already in an unmerged drafting pull request are skipped.
3. **Draft** with the AI, following `content/style-guide.md` and the examples. Fixed structure:
   - plain-language title;
   - "En bref": 2–3 sentences;
   - "Ce qui change": short list, every item citing the article(s) it comes from;
   - "Qui est concerné";
   - "Et maintenant": next steps after final adoption (Conseil constitutionnel review if referred, promulgation, décrets d'application), based on the law's current stage.
     The draft never contains vote numbers, results or group positions.
4. **Verify** in a second AI pass: for each claim, find the supporting passage in the source text. Claims without support are listed in the pull request description.
5. **Style check** (deterministic, no AI): flag banned phrases and AI tics (stock phrases, em dashes, rule-of-three lists, empty intensifiers). The list lives in the repository and grows over time.
6. **Open one pull request** ("Explications de la semaine du …") with one file per law, and a description listing, per law: a link to the official file, the verifier's unsupported claims, the style flags.
7. For a law that already has an explanation and changed status (e.g. partial censure by the Conseil constitutionnel), the bot edits the existing file and records an update note; the change is visible in the pull request diff.

The maintainer edits in the pull request or locally, deletes any draft they reject, and merges. Merge triggers a build; the explanations go live.

**Explanation file frontmatter** (minimum): law uid, status (`published`), `reviewedAt` date, stage covered by the explanation, model used, sources used (text uids). The page shows the review date and an "updated on" date when relevant.

### Voice

- `content/style-guide.md` describes the target voice, modeled on Le Monde Décodeurs traits: short sentences, concrete examples, every claim attributed, no judgment adjectives, explains why it matters. It does not copy or paste Décodeurs articles (copyright, paywall).
- 2–3 reference explanations in `content/examples/`, written or approved by the maintainer during the first weeks, are given to the AI as examples.
- Later, the most recent reviewed explanations (the maintainer's edited versions) are added as examples, so the voice converges on the maintainer's.

### AI model

- Accessed through an OpenAI-compatible multi-model gateway (OpenRouter, or equivalent) so the model is a single configuration value.
- Maintainer's initial choice: Kimi (version named by the maintainer: "kimi 3.1 pro"). Before going live, draft 3 real laws of the 17e legislature with Kimi and one or two alternatives and compare blind; choose on quality, since the expected volume (about 10 laws per month, drafting plus verification) fits the budget with most models.
- A monthly spend limit is set on the gateway account as a hard cap.

### Website rendering

- Nuxt reads `data/` and `content/` at build time and prerenders all pages as static files served by Vercel's free tier.
- **Static, not server-side rendering.** Data changes at most once a night and every visitor sees the same page, so nothing needs to run at request time. Static output means no server functions (no quotas, cold starts or runtime to maintain), no secrets in the deployed app, the fastest load on low-end phones, and a site that any static host can serve if Vercel's offer changes.
- Features that usually call for a server stay static: search uses a build-time index searched in the browser (e.g. Pagefind); list filters and sorting run in the browser on a small JSON index generated at build; OG images are generated at build by Nuxt SEO's og-image module.
- **Build time is the one limit to watch.** Every nightly import triggers a full rebuild: about 9,500 vote pages today, possibly 20,000 by the end of the legislature, against the 45-minute build cap of Vercel's Hobby plan. Measure it in the first implementation step. **Fallback if it gets too slow:** switch only the vote pages to on-demand generation with Vercel ISR (`routeRules: { '/votes/**': { isr: true } }`, the route name being illustrative): each vote page is built on first visit and cached until the next deploy. Law pages and explanations stay prerendered.
- A law page combines: the explanation (from `content/`), the vote facts and stages (from `data/`), source links (Assemblée record, adopted text, Légifrance), and the label stating it was drafted with AI and reviewed by the maintainer, with the review date.
- A law without a reviewed explanation still has a page with its data and stages, and states that an explanation is in preparation.
- A law adopted without a public vote states that no per-group breakdown exists (show of hands), rather than showing an empty or guessed breakdown.
- Votes not linked to any law have a standalone page with their data.
- A legislative file gets a page only if it has at least one recorded vote or an adoption stage; bills filed and never examined (most of the 3,380 files) get no page.

## Decided by the maintainer

- Official Assemblée open data as the source; no dependency on CIVIX or other aggregators.
- Explanations: AI draft, human review, labeled as such.
- Review via a weekly GitHub pull request on a laptop.
- Voice modeled on Le Monde Décodeurs.
- Budget: 10 € / month max; free tiers for hosting.
- No database: data and explanations as files in the repository.
- AI model: Kimi as the starting choice.
- Full explanations for every law except treaty and agreement approvals (budget laws included); treaty approvals get a one-line summary.
- Catch up on the whole 17e legislature backlog at launch.

## Calls made by the designer (check these)

- Explanations only for laws reaching a final event; individual amendment and procedural votes are data-only.
- Fixed explanation structure (the five sections above).
- Per-deputy votes not stored in v1.
- Raw official files not kept.
- Verifier pass and deterministic style check in the pull request.
- Nightly import, Saturday drafting; cap of 15 drafts per run.
- Model test on 3 real laws before go-live; spend cap on the gateway.
- senat.fr and conseil-constitutionnel.fr allowed as sources; Légifrance only linked.
- Pages only for legislative files with a vote or an adoption stage.
- Laws already in an unmerged drafting pull request are skipped by the next run.
- Treaty one-line summaries built from the title by a template, not by the AI.
- Backlog drafted most recent first.
- Fully static site; ISR for vote pages only as a fallback if build time becomes a problem.

## Left to the builder

- Exact Zod schemas, file shapes and naming beyond what is specified above.
- Vote-to-law matching strategy beyond the two official links.
- Which Nuxt mechanism reads the files (Nuxt Content or plain imports) and how routes are prerendered.
- Prompt wording, the initial banned-phrase list, the exact pull request template.
- Groups dataset URL and parsing.
- Error reporting beyond the default GitHub Actions failure email.
