import "server-only";
import { z } from "zod";

/**
 * Server-only environment variables. They must never reach the client bundle,
 * so only server code (Route Handlers, Server Actions, RSC) imports this module.
 *
 * Public variables (`NEXT_PUBLIC_*`) belong in `config/env.ts`. A server secret placed
 * there would leak into the client bundle, so always add secrets here.
 * Add each variable a feature needs to the schema and expose it through `serverEnv`.
 */
const serverEnvSchema = z.object({
  // Example: API_KEY: z.string().min(1),
});

const parsed = serverEnvSchema.safeParse({
  // Treat an empty string (`FOO=`) as unset, such as `API_KEY: process.env.API_KEY || undefined`.
});

if (!parsed.success) {
  throw new Error(
    `Invalid server environment variables:\n${z.prettifyError(parsed.error)}`,
  );
}

export const serverEnv = {
  ...parsed.data,
} as const;
