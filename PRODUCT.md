# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Curious citizens, students, journalists and civic-minded readers who want to explore and compare what the Assemblée nationale decides: many votes, sessions, deputies and political groups, side by side. Most have no legal or parliamentary background. They arrive from search, a shared link or out of curiosity, often on a phone, and dig across several decisions rather than reading a single page.

The job: find a decision, understand what it actually changes in plain French, then compare it with related votes, groups or representatives.

## Product Purpose

An independent, non-official tool that makes the Assemblée nationale's decisions readable for the general public. It turns parliamentary records into plain-language explanations and comparable data.

Success: a visitor leaves with neutral, trustworthy facts they could repeat to someone else, and can verify them against the source.

The site is **not affiliated** with the Assemblée nationale or the French government and must look clearly independent.

## Positioning

Explanation leads, comparison gives depth. Trackers like NosDéputés.fr show the raw parliamentary record; this site first explains each decision in plain French (what it actually changes), then makes it comparable with related votes, bills and groups. Every explanation stays tied to the official source so readers can check it.

## Operating Context

- Visitors reach a decision from search, a shared link or social media, mostly on phones, sometimes on slow connections.
- Typical path: land on one vote or bill, read the plain explanation, check the result and breakdown by group, follow links to related votes or the text's other stages, open the official source to verify.
- Content pipeline: vote and bill data is synced automatically from official open data; an LLM drafts the plain-language explanation from the official texts; the maintainer reviews and edits it before it is published.
- Freshness target: new votes and their explanations appear within a few days. Data can appear before its reviewed explanation.
- Run as a solo side project: maintenance effort must stay low.

## Capabilities and Constraints

- **v1 scope:** votes (scrutins: what was voted, result, breakdown by group) and bills / texts (projets and propositions de loi, followed through their stages).
- **Later, not v1:** dedicated pages for deputies and political groups. Groups still appear in v1 as part of each vote's breakdown.
- **Data source:** official open data, e.g. the CIVIX public API listed on data.gouv.fr (https://www.data.gouv.fr/dataservices/api-publique-civix). Exact source and license terms to confirm during implementation; attribution must follow the license.
- **Explanations:** AI-drafted, human-reviewed. They must be presented as such; never claim they are written by hand or officially endorsed.
- **Language:** French only. Parliamentary terms that must stay (scrutin, amendement, lecture, CMP…) are explained inline.
- **Undecided:** site name; whether unreviewed data is shown before its explanation is ready, and how that state is labeled.

## Brand Commitments

**Personality: clear, sharp, independent.**

- Clear: plain French over parliamentary jargon; every term that must stay is explained.
- Sharp: confident hierarchy and precise data presentation; no hedging, no filler.
- Independent: visibly its own voice, not an institutional portal, and not taking sides.

Tone is factual and neutral. Confidence comes from precision and sourcing, never from editorial angle or emotional framing.

References and what to take from each:

- **Le Monde Décodeurs**: explanatory, journalistic trust; explains the "so what".
- **NosDéputés.fr**: independent French parliamentary tracking; same domain and data depth.
- **Our World in Data**: neutral data storytelling, charts with visible sources.
- **Linear / Stripe docs**: dense but calm product UI, strong hierarchy, fast navigation.

Anti-references:

- **DSFR / gov.fr look**: no Marianne, no "République Française" header, no State branding of any kind.
- **Partisan or activist**: no campaign colors, outrage framing, or political color coding that implies a side.
- **SaaS marketing**: no hero gradients, big metric tiles, "Get started" landing-page vibe.
- **Dense legal portal**: no Légifrance-style walls of text or jargon tables.
- **News clickbait**: no breaking-news urgency, sensational headlines, or ad-heavy layouts.

## Evidence on Hand

- No content, data import or explanations exist yet; the app is a bare Nuxt starter.
- No logo, name, testimonials, user numbers, press or partnerships. Future work must not invent any of them.
- The only authority the site can claim is the official record itself, linked from every decision.

## Product Principles

1. **Neutrality is visible.** Every group, party and vote outcome gets equal treatment. Nothing suggests which side is right.
2. **Plain language first, source always one step away.** Explain in everyday French, then link to the official record so anyone can check.
3. **Honest about how it's made.** Explanations are AI-drafted and human-reviewed, and say so. Data, explanation and source are never blurred together.
4. **Built for comparison.** Votes and bills are easy to put side by side; consistent structures beat one-off layouts.
5. **Precision earns trust.** Exact numbers, dates and labels; no rounding or framing that distorts.
6. **Independent, not institutional.** The site has its own recognizable identity and never borrows the State's visual language.

## Accessibility & Inclusion

- Target: **RGAA 4.1, full compliance** (≈ WCAG 2.1 AA). `@nuxt/a11y` axe-core checks run in dev; fix what they report.
- Vote results, group membership and party data are **never encoded by color alone**: always pair with labels, patterns or icons.
- Respect `prefers-reduced-motion` (motion-v via `MotionConfig`; CSS animations need their own fallback).
- Works on low-end phones and slow connections: this is civic information meant for everyone.
- Plain-language content, with jargon explained inline.
