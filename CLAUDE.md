# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Independent side project that makes the decisions of the Assemblée nationale's sessions easier to understand for the general public. It is **not affiliated** with the Assemblée nationale or the French government:

- Never use official State branding: no Marianne, no "République Française" header, no DSFR look.
- The site must stay clearly recognizable as an independent project.
- Content is in French, aimed at citizens without legal background: plain language over parliamentary jargon.
- Accessibility matters (RGAA as the reference): this is civic information meant for everyone. `@nuxt/a11y` runs axe-core checks in dev (results in Nuxt DevTools); fix what it reports.

Stack: **Nuxt 4**, **Nuxt UI v4**, **TailwindCSS v4**, TypeScript, **motion-v**, **Zod**, **Nuxt SEO**. Package manager: **pnpm**.

## Documentation Lookup (Do This First)

Before writing any code touching a framework, library, or service, consult the relevant MCP or context7 — even for things you think you know. APIs change across versions and training data goes stale.

| Technology | Source |
|---|---|
| Nuxt (config, modules, composables, routing) | `mcp__nuxt-remote__*` tools |
| Nuxt UI components | `mcp__nuxt-ui-remote__*` tools |
| Nuxt SEO (robots, sitemap, og-image, schema) | `mcp__nuxt-seo__*` tools |
| Everything else (Zod, motion-v, TailwindCSS v4, etc.) | `mcp__plugin_context7_context7__query-docs` |

**Workflow:** resolve the library ID with `resolve-library-id` first, then call `query-docs` with a focused question. For Nuxt-specific tools, prefer the dedicated MCP over context7 — it has module-aware documentation.

### Nuxt SEO Skills

For any Nuxt SEO task, use the matching skill in `.claude/skills/` **before** the `nuxt-seo` MCP: the skills ship inside the installed packages, so they match the installed versions and list the known traps. Use the MCP afterwards for deeper docs.

| Skill | Covers |
|---|---|
| `nuxtjs-seo` | The `@nuxtjs/seo` bundle: setup, which config key belongs to which submodule, v5 → v6 changes |
| `nuxt-site-config` | The `site` key, `NUXT_SITE_*` env vars |
| `nuxt-seo-utils` | Title template, canonical URLs, default meta tags, favicons |
| `nuxt-og-image` | OG images, Takumi renderer, `NUXT_APP_SECRET` |
| `nuxtjs-sitemap` | `sitemap.xml` |
| `nuxtjs-robots` | `robots.txt`, `noindex`, AI crawlers |
| `nuxt-schema-org` | JSON-LD structured data |
| `nuxt-link-checker` | Broken links |
| `nuxt-ai-ready` | `llms.txt`, Markdown versions of pages, Content Signals |
| `nuxt-skew-protection` | Old build chunks kept after a deploy |

How they are installed:

- `nuxtjs-seo` is linked by pnpm: `pnpm-workspace.yaml` approves its skill (`permissions`) and sets `skills.dirs` to `.claude/skills`. The `pnpm-*` link is gitignored and recreated on `pnpm install`.
- The submodule skills are **manual symlinks**, because pnpm only links skills from direct dependencies. They point to `node_modules/.pnpm/node_modules/<package>/skills/<name>` (a path without version numbers, so they follow updates). Do not approve the submodules in `pnpm-workspace.yaml` `permissions`: pnpm grants a package everything it requests, which also enables its install scripts.
- If `@nuxtjs/seo` drops or renames a submodule, its link breaks: `ls -L .claude/skills/*/SKILL.md` reports the broken ones.

Never rely solely on training-data knowledge for: Nuxt 4 app directory conventions, Nuxt UI v4 component APIs, Nuxt SEO v6 options, TailwindCSS v4 utility syntax, or motion-v APIs.

## Commands

```bash
pnpm dev          # dev server at localhost:3000
pnpm build        # production build
pnpm preview      # preview production build
pnpm lint         # ESLint check
pnpm lint:fix     # ESLint auto-fix
```

Pre-commit hook (husky, `.husky/pre-commit`): gitleaks secret scan on staged changes, then lint-staged runs `eslint --fix` on staged files.

## Git Workflow

**Never commit or stage changes.** The user commits themselves, with an AI commit script in their lazygit configuration. Leave all changes uncommitted; read-only git commands (`status`, `diff`, `log`) are fine.

## Architecture

Nuxt 4 layout — source lives under `app/`, server-side under `server/`, cross-boundary utilities under `shared/`:

- `app/` — pages, components, composables, assets
- `server/` — Nitro API routes and server utilities
- `shared/` — code importable by both app and server (Zod schemas, utilities)

### Environment Variables

All env vars are validated at startup via a Zod schema in `shared/lib/env.ts`. The schema is imported in `nuxt.config.ts`, so a missing or invalid var stops the dev/build process immediately with the list of problems.

- **Never access `process.env` directly** — the `node/no-process-env` ESLint rule enforces this. Add new vars to the schema in `shared/lib/env.ts` and to `.env.example`, then import the validated object where needed.
- `shared/lib/env.ts` is **server-only**: import it from `nuxt.config.ts` and `server/`, never from `app/`. Values the browser needs go through `runtimeConfig.public`.

### TypeScript (Non-obvious)

TypeScript 6 and 7 are installed side by side on purpose (see `package.json`):

- `@typescript/native` is TypeScript 7 and provides the `tsc` command.
- `typescript` is an alias for `@typescript/typescript6`, because typescript-eslint, vue-tsc and the Vue language tools need TypeScript's JavaScript API, which TypeScript 7.0 doesn't ship.

Do not "fix" the alias. Remove both aliases only once typescript-eslint supports TypeScript 7.1+ (typescript-eslint issue #10940).

### Styling

TailwindCSS v4 via `@tailwindcss/vite` (not PostCSS). Global styles in `app/assets/css/main.css`. Nuxt UI v4 is the component library.

Fonts: Nuxt UI ships its own `@nuxt/fonts` 0.14, but Nuxt SEO's og-image needs 1.x. The project installs `@nuxt/fonts` 1.x itself and registers it in `modules` before `@nuxt/ui`, so that version is the one used. Keep it registered there; once Nuxt UI depends on `@nuxt/fonts` 1.x, the explicit entry can go.

### Animations

motion-v, registered through the `motion-v/nuxt` module (components auto-imported). Keep animations subtle. `app.vue` wraps the app in `<MotionConfig reduced-motion="user">`, so motion-v animations already respect the OS "reduce motion" setting; CSS animations still need their own `prefers-reduced-motion` fallback.

### pnpm Supply-chain Policy

`pnpm-workspace.yaml` sets `trustPolicy: no-downgrade`: installs fail when a package version lost the publish provenance its other versions have. Don't add a `trustPolicyExclude` entry without checking the package's publish history first (`npm view <pkg>@<version> dist.attestations _npmUser`); prefer updating to a version that has provenance.

## ESLint Rules (Non-obvious)

Base: `@antfu/eslint-config` combined with `@nuxt/eslint` (`withNuxt`).

- `type` not `interface` for TypeScript type definitions
- Double quotes, semicolons, 2-space indent
- Imports sorted with antfu's default groups (type imports, built-ins, packages, then local files)
- `no-console` is a warning (`console.warn` / `console.error` allowed) — remove debug logs before committing
- Filenames: kebab-case, camelCase, or PascalCase (no snake_case)
- Vue accessibility rules are on (`vue: { a11y: true }`)
- Markdown files are not linted
