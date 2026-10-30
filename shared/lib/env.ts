import { z } from "zod";

import tryParseEnv from "./try-parse-env";

// Required for production builds, optional in development
const REQUIRED_IN_PRODUCTION = ["NUXT_SITE_URL", "NUXT_APP_SECRET"] as const;
// `nuxt prepare` (run by postinstall) also sets NODE_ENV=production, but doesn't need them
const isPrepare = process.argv.includes("prepare");

// Server-only: import it in nuxt.config.ts and server/, never in app/ code
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  // Public URL of the site, used by Nuxt SEO (canonical URLs, sitemap, OG images)
  NUXT_SITE_URL: z.url().optional(),
  // Signs OG image URLs; without it every SSR request returns 500 in production.
  // Generate one with `pnpx nuxt-og-image generate-secret`
  NUXT_APP_SECRET: z.string().min(32).optional(),
}).superRefine((env, ctx) => {
  if (env.NODE_ENV !== "production" || isPrepare)
    return;
  for (const key of REQUIRED_IN_PRODUCTION) {
    if (!env[key]) {
      ctx.addIssue({
        code: "custom",
        path: [key],
        message: "Required for production builds",
      });
    }
  }
});

export type Env = z.infer<typeof EnvSchema>;

export default tryParseEnv(EnvSchema);
