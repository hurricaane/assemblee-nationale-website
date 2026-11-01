<!-- SEED: re-run /impeccable document once there's code to capture the actual tokens and components. -->
---
name: "[Site name to be chosen]"
description: Independent tool that explains and compares the Assemblée nationale's decisions in plain French.
---

# Design System: [Site name to be chosen]

## 1. Overview

**Creative North Star: "The Annotated Record"**

The interface is a clean public record that someone sharp has annotated for you: printed-document calm, ink on paper, with precise marks in the margin that point at what matters. It borrows the sobriety of an archive and the clarity of a good product tool (Linear, Stripe docs), and the explanatory confidence of Le Monde Décodeurs and Our World in Data. Density is medium to high: people come to compare many votes, so tables, lists and charts are first-class, never hidden behind decoration.

Color is almost absent from the chrome. The data (vote outcomes, political groups) gets the color budget; the interface itself speaks in ink, paper and a single dry ochre mark. Motion is responsive, not choreographed: filters, chart updates and expanding details get short, eased transitions that confirm what changed; nothing enters the page for show.

Default theme is light, paper-toned: a citizen reading on a phone on the train or at a desk in daylight, checking a vote they heard about, wants a document, not a dashboard at 2am. A dark variant mirrors it (warm ink background, paper-toned text) and is resolved during implementation.

This system explicitly rejects: the DSFR / gov.fr look, partisan or activist styling, SaaS marketing pages, dense legal portals, and news clickbait.

**Key Characteristics:**
- Ink and paper neutrals, one ochre accent on 10% or less of any screen.
- Single technical sans with tabular figures; hierarchy by weight and scale, not color.
- Flat surfaces, separation by rules and spacing, not shadows or cards.
- Data carries the color; the interface stays neutral.
- Every figure, date and label is exact and traceable to its source.

## 2. Colors

A restrained ink-and-paper palette with one dry ochre accent; the data visualizations own every other hue.

### Primary
- **Dry Ochre** ([to be resolved during implementation], an OKLCH amber/ochre at moderate chroma): the annotation mark. Active filter, current navigation item, focus accents, the highlighted figure in a sentence, links on hover. Never a fill for large surfaces.

### Neutral
- **Record Ink** ([to be resolved during implementation], warm near-black, chroma ≈ 0.01 toward the ochre hue): body text, headings, rules.
- **Paper** ([to be resolved during implementation], warm off-white, chroma ≈ 0.005–0.01): page background.
- **Ledger Grays** ([to be resolved during implementation], 3–4 warm grays between ink and paper): secondary text, dividers, table stripes, disabled states.

### Data colors
Vote outcomes (pour / contre / abstention / non-votant) and political groups get their own palette, defined separately from the chrome during implementation. [to be resolved during implementation]

### Named Rules
**The Annotation Rule.** Ochre covers 10% or less of any screen. It marks; it never fills. If a screen looks yellow, it has failed.

**The Data Owns Color Rule.** Hue in the interface chrome is forbidden beyond the ochre accent. Group and outcome colors live only inside data views, and the ochre must never appear inside a chart, so it can't be mistaken for a party or an outcome.

**The Never-Color-Alone Rule.** Every color-coded value (outcome, group) also carries a text label, icon or pattern. A chart printed in grayscale must still be readable.

**The No-Tricolore Rule.** Blue, white and red are never combined in the chrome. The site must never read as State communication.

## 3. Typography

**Display Font:** [font to be chosen at implementation] (single technical sans, same family as body)
**Body Font:** [font to be chosen at implementation] (with system-ui fallback)
**Label/Mono Font:** none; the sans's tabular figures handle numbers.

**Character:** One precise, technical sans throughout, with tabular and lining figures. Sharpness comes from weight contrast and a confident scale, not from a second typeface. Must support French typography fully (accents, guillemets « », non-breaking spaces before : ; ? !).

### Hierarchy
- **Display** ([weight, size, line-height to be resolved]): the title of a vote or session page. One per page.
- **Headline** ([to be resolved]): section headings within a decision ("Ce que ça change", "Qui a voté quoi").
- **Title** ([to be resolved]): list item and table group headings.
- **Body** ([to be resolved]): plain-language explanations. Line length capped at 65–75ch.
- **Label** ([to be resolved]): table headers, filter labels, metadata (dates, article numbers). Sentence case, not uppercase.

Scale steps keep a ratio of at least 1.25.

### Named Rules
**The Tabular Figures Rule.** Every number that can be compared (vote counts, percentages, dates in tables) uses tabular figures so columns align.

**The One Family Rule.** No second typeface. Emphasis comes from weight and size, never from a decorative font.

## 4. Elevation

Flat by default. Depth comes from tonal layering (paper vs. a slightly darker ledger gray) and from thin ink rules, not shadows. The only exceptions are elements that float above the page because of state (a dropdown, a tooltip, a sticky filter bar), which get one small, low-contrast shadow, defined at implementation.

### Named Rules
**The Ruled Page Rule.** Separate content with spacing and 1px rules first; use a tinted surface second; use a shadow only when something actually floats.

## 5. Components

[No components exist yet. Re-run `/impeccable document` once there's code.]

## 6. Do's and Don'ts

### Do:
- **Do** keep the ochre accent at 10% of the screen or less, used as a mark (focus, active state, highlighted figure), never as a fill.
- **Do** give every group, party and vote outcome equal visual weight: same size, same shape, same type treatment.
- **Do** pair every color-coded value with a text label, icon or pattern.
- **Do** use tabular figures for every comparable number and show exact values (no misleading rounding).
- **Do** put a link to the official source next to each decision, one step away from the explanation.
- **Do** cap explanatory text at 65–75ch and write it in plain French.
- **Do** keep transitions short and eased out (exponential ease-out), and respect `prefers-reduced-motion`.
- **Do** separate content with spacing and 1px rules before reaching for a container.

### Don't:
- **Don't** use the DSFR / gov.fr look: no Marianne, no "République Française" header, no State branding of any kind, no blue-white-red combination.
- **Don't** look partisan or activist: no campaign colors, outrage framing, or political color coding that implies a side. Never use a party's color in the chrome.
- **Don't** look like SaaS marketing: no hero gradients, big metric tiles, "Get started" landing-page vibe.
- **Don't** look like a dense legal portal: no Légifrance-style walls of text or jargon tables.
- **Don't** look like news clickbait: no breaking-news urgency, red alert banners, sensational headlines, or ad-heavy layouts.
- **Don't** use a colored side-stripe border (more than 1px on one side) on cards, callouts or list items.
- **Don't** use gradient text, glassmorphism, or identical icon-heading-text card grids.
- **Don't** wrap content in cards by reflex, and never nest cards.
- **Don't** use bounce or elastic easing, or choreographed entrance animations.
