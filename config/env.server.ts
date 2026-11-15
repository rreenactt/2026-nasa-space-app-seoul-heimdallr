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
  /**
   * PostgreSQL connection string for the app runtime (Prisma Client).
   * `DIRECT_URL` for migrations is read only by the Prisma CLI, so it is not here.
   */
  DATABASE_URL: z.url().optional(),
  /**
   * Connections each app instance may open (`lib/db.ts`). Defaults to 3. Every instance has its own
   * pool, so the number of instances times this value must stay within the pooler's client limit.
   */
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).optional(),
  /** Cloudflare account ID; the S3 endpoint is `https://<id>.r2.cloudflarestorage.com` (`lib/storage.ts`). */
  R2_ACCOUNT_ID: z.string().regex(/^[0-9a-f]{32}$/, "a 32-character hex Cloudflare account ID").optional(),
  /** R2 API token's S3 access key ID. Scope the token to the one bucket with Object Read & Write. */
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  /** R2 API token's S3 secret access key. */
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  /** Bucket name. */
  R2_BUCKET: z.string().regex(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/, "an R2 bucket name").optional(),
  /** Public base URL of the bucket (r2.dev or a custom domain). Optional. */
  R2_PUBLIC_URL: z.url({ protocol: /^https$/ }).optional(),
});

const parsed = serverEnvSchema.safeParse({
  // Treat an empty string (`FOO=`) as unset.
  DATABASE_URL: process.env.DATABASE_URL || undefined,
  DATABASE_POOL_MAX: process.env.DATABASE_POOL_MAX || undefined,
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID || undefined,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || undefined,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || undefined,
  R2_BUCKET: process.env.R2_BUCKET || undefined,
  R2_PUBLIC_URL: process.env.R2_PUBLIC_URL || undefined,
});

if (!parsed.success) {
  throw new Error(
    `Invalid server environment variables:\n${z.prettifyError(parsed.error)}`,
  );
}

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL } = parsed.data;
const r2Required = [R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET];
// Half a configuration is a mistake, not "storage off": fail at load rather than on the first upload.
if (r2Required.some(Boolean) && !r2Required.every(Boolean)) {
  throw new Error(
    "Invalid server environment variables: set all of R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET, or none.",
  );
}

export const serverEnv = {
  databaseUrl: parsed.data.DATABASE_URL,
  databasePoolMax: parsed.data.DATABASE_POOL_MAX ?? 3,
  /** Cloudflare R2 object storage (`lib/storage.ts`); `undefined` when not configured. */
  r2:
    R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET
      ? {
          accountId: R2_ACCOUNT_ID,
          accessKeyId: R2_ACCESS_KEY_ID,
          secretAccessKey: R2_SECRET_ACCESS_KEY,
          bucket: R2_BUCKET,
          publicUrl: R2_PUBLIC_URL?.replace(/\/+$/, ""),
        }
      : undefined,
} as const;
