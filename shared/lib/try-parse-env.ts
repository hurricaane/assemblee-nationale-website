/* eslint-disable node/no-process-env */
import type { ZodObject, ZodRawShape } from "zod";

import { ZodError } from "zod";

export default function tryParseEnv<T extends ZodRawShape>(
  EnvSchema: ZodObject<T>,
  buildEnv: Record<string, string | undefined> = process.env,
) {
  try {
    return EnvSchema.parse(buildEnv);
  }
  catch (error) {
    if (error instanceof ZodError) {
      let message = "Missing or invalid values in .env:\n";
      error.issues.forEach((issue) => {
        message += `  - ${String(issue.path[0])}: ${issue.message}\n`;
      });
      console.error(message);
      process.exit(1);
      throw new Error("unreachable");
    }
    throw error;
  }
}
