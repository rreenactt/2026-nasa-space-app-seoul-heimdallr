import { z } from "zod";

/**
 * The single entry point for public environment variables.
 *
 * App code never reads `process.env` directly; it uses `env` from this module.
 * A bad setting fails when the module loads, not deep inside the runtime.
 *
 * Note: Next.js replaces `process.env.NEXT_PUBLIC_*` with static text at build time.
 * Each variable must be written out in full as below; dynamic access such as
 * `process.env[key]` is undefined in the client bundle.
 */
const envSchema = z.object({
  /** App name in page titles and anywhere the UI shows it. Defaults to "Web App". */
  NEXT_PUBLIC_APP_NAME: z.string().trim().min(1).optional(),
  /** `1` opens the /design-system showcase. The development server always opens it. */
  NEXT_PUBLIC_DESIGN_SYSTEM: z.literal("1").optional(),
});

const parsed = envSchema.safeParse({
  // Treat an empty string (`FOO=`) as unset so the default applies.
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || undefined,
  NEXT_PUBLIC_DESIGN_SYSTEM: process.env.NEXT_PUBLIC_DESIGN_SYSTEM || undefined,
});

if (!parsed.success) {
  throw new Error(`Invalid environment variables:\n${z.prettifyError(parsed.error)}`);
}

export const env = {
  appName: parsed.data.NEXT_PUBLIC_APP_NAME ?? "Web App",
} as const;

/**
 * Whether the /design-system showcase is open. It is closed by default so production does not expose it,
 * and opens only on the development server (`pnpm dev`) or in a build with `NEXT_PUBLIC_DESIGN_SYSTEM=1`.
 * Both are fixed at build time.
 */
export const isDesignSystemEnabled =
  process.env.NODE_ENV === "development" || parsed.data.NEXT_PUBLIC_DESIGN_SYSTEM === "1";
