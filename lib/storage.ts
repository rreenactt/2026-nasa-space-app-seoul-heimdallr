import "server-only";
import type { Readable } from "node:stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { serverEnv } from "@/config/env.server";

/**
 * Object storage on Cloudflare R2 through its S3-compatible API (server-only, Node.js runtime).
 *
 * - Uses the AWS SDK v3. Next.js keeps `@aws-sdk/client-s3` out of the server bundle by default
 *   (`serverExternalPackages`), so it loads from `node_modules` inside the Vercel function.
 * - Exception to "HTTP goes through `lib/ky.ts`": the SDK signs and sends its own requests. It retries a failed
 *   request up to 3 attempts in total, because one multipart part failing would otherwise fail the whole upload.
 *   Every storage call is idempotent for the same key, so a retry cannot duplicate anything.
 * - Checksums are sent only when R2 requires them; R2 does not support every checksum the SDK sends by default.
 * - Large files: `putObject` streams the body in parts (`PART_SIZE`), so a body far larger than the function's memory
 *   can be uploaded as long as it is a stream. Still bound by the function's `maxDuration`.
 * - A Vercel function accepts at most 4.5 MB in its own request body, so a file from the browser is never relayed
 *   through a Route Handler or Server Action. The server issues a presigned URL (`createUploadUrl`) and the browser
 *   PUTs the file straight to R2 (`uploadToSignedUrl` in `lib/upload.ts`). The bucket needs a CORS rule for that:
 *   AllowedOrigins = the app's origins, AllowedMethods = PUT, AllowedHeaders = content-type.
 * - Keys are made by server code, never taken verbatim from a client.
 * - Reading through the bucket's public URL (`R2_PUBLIC_URL`, an r2.dev or custom domain) is cheaper than
 *   `getObject`, which goes through a function. Use `objectPublicUrl` for anything the browser displays.
 */

/** Size of each multipart part. R2 needs at least 5 MiB for every part but the last. */
const PART_SIZE = 8 * 1024 * 1024;
/** Parts in flight at once. Memory held by one upload is about `QUEUE_SIZE * PART_SIZE` (32 MiB). */
const QUEUE_SIZE = 4;

const globalForStorage = globalThis as unknown as { storageClient?: S3Client };

function config() {
  const r2 = serverEnv.r2;
  if (!r2) throw new Error("R2 storage is not configured. Set the R2_* variables (see .env.example).");
  return r2;
}

function client(): S3Client {
  if (globalForStorage.storageClient) return globalForStorage.storageClient;
  const r2 = config();
  const created = new S3Client({
    region: "auto",
    endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey },
    // `<endpoint>/<bucket>/<key>`: presigned URLs stay on the one account host the bucket's CORS rule answers for.
    forcePathStyle: true,
    maxAttempts: 3,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  // Keep one client (and its connection pool) across HMR re-evaluation in development and warm invocations.
  globalForStorage.storageClient = created;
  return created;
}

/** Whether every R2 variable is set, so callers can fall back (for example, skip caching) instead of failing. */
export function isStorageConfigured(): boolean {
  return serverEnv.r2 !== undefined;
}

function checkKey(key: string): string {
  if (!key || key.startsWith("/") || key.split("/").some((part) => part === "" || part === "." || part === "..")) {
    throw new Error(`Invalid storage key: ${JSON.stringify(key)}`);
  }
  return key;
}

function isNotFound(error: unknown): boolean {
  return error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404;
}

export type StorageBody = Uint8Array | string | Blob | ReadableStream<Uint8Array> | Readable;

export type PutObjectOptions = {
  /** MIME type stored with the object and returned when it is read, e.g. `image/png`. */
  contentType: string;
  /** `Cache-Control` served with the object, e.g. `public, max-age=31536000, immutable` for content-addressed keys. */
  cacheControl?: string;
  /** Called as parts finish, with the bytes sent so far and the total when it is known. */
  onProgress?: (progress: { loaded: number; total?: number }) => void;
  /** Aborts the upload; parts already sent are removed. */
  signal?: AbortSignal;
};

/**
 * Uploads (or replaces) one object. A body smaller than one part goes in a single request; a larger one, or a stream
 * of unknown length, goes as a multipart upload. A failed or aborted multipart upload deletes its parts.
 */
export async function putObject(
  key: string,
  body: StorageBody,
  { contentType, cacheControl, onProgress, signal }: PutObjectOptions,
): Promise<void> {
  const upload = new Upload({
    client: client(),
    params: { Bucket: config().bucket, Key: checkKey(key), Body: body, ContentType: contentType, CacheControl: cacheControl },
    partSize: PART_SIZE,
    queueSize: QUEUE_SIZE,
    leavePartsOnError: false,
    abortController: signal ? abortControllerFor(signal) : undefined,
  });
  if (onProgress) upload.on("httpUploadProgress", ({ loaded, total }) => onProgress({ loaded: loaded ?? 0, total }));
  await upload.done();
}

function abortControllerFor(signal: AbortSignal): AbortController {
  const controller = new AbortController();
  if (signal.aborted) controller.abort(signal.reason);
  else signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  return controller;
}

/** Largest object one presigned PUT may carry (R2's single-request upload limit). */
export const MAX_SIGNED_UPLOAD_BYTES = 5_000_000_000;
const DEFAULT_UPLOAD_URL_TTL_S = 10 * 60;
const MAX_UPLOAD_URL_TTL_S = 60 * 60;

export type CreateUploadUrlOptions = {
  /** MIME type the browser must send; it is signed, so another type is rejected by R2. */
  contentType: string;
  /** Exact size in bytes of the file the browser will send; it is signed, so any other size is rejected by R2. */
  contentLength: number;
  /** Seconds the URL stays valid. Defaults to 10 minutes, at most 1 hour. */
  expiresIn?: number;
};

/** What the browser needs to upload one file; pass it to `uploadToSignedUrl` (`lib/upload.ts`). */
export type SignedUpload = {
  url: string;
  method: "PUT";
  headers: { "content-type": string };
  /** ISO time after which R2 refuses the URL. */
  expiresAt: string;
};

/**
 * Presigns one PUT of exactly `contentLength` bytes of `contentType` to `key`. The URL is a write credential for that
 * key until it expires, so the caller decides the key and checks the type and size against its own limits first.
 * An upload to an existing key replaces it; give each upload a fresh key (for example, a random ID) unless replacing
 * is intended.
 */
export async function createUploadUrl(
  key: string,
  { contentType, contentLength, expiresIn = DEFAULT_UPLOAD_URL_TTL_S }: CreateUploadUrlOptions,
): Promise<SignedUpload> {
  if (!Number.isSafeInteger(contentLength) || contentLength < 1 || contentLength > MAX_SIGNED_UPLOAD_BYTES) {
    throw new Error(`Upload size must be 1 to ${MAX_SIGNED_UPLOAD_BYTES} bytes, got ${contentLength}.`);
  }
  if (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > MAX_UPLOAD_URL_TTL_S) {
    throw new Error(`Upload URL lifetime must be 1 to ${MAX_UPLOAD_URL_TTL_S} seconds, got ${expiresIn}.`);
  }
  const command = new PutObjectCommand({
    Bucket: config().bucket,
    Key: checkKey(key),
    ContentType: contentType,
    ContentLength: contentLength,
  });
  // content-length is signed by default; content-type is not unless named here.
  const url = await getSignedUrl(client(), command, {
    expiresIn,
    signableHeaders: new Set(["content-type", "content-length"]),
  });
  return {
    url,
    method: "PUT",
    headers: { "content-type": contentType },
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  };
}

export type StoredObject = {
  /** The object's bytes as a stream; read it once (or cancel it) so the connection is released. */
  body: ReadableStream<Uint8Array>;
  contentType: string | undefined;
  contentLength: number | undefined;
};

/** Opens one object as a stream, or returns `null` when the key does not exist. */
export async function getObject(key: string): Promise<StoredObject | null> {
  try {
    const result = await client().send(new GetObjectCommand({ Bucket: config().bucket, Key: checkKey(key) }));
    if (!result.Body) return null;
    return {
      body: result.Body.transformToWebStream() as ReadableStream<Uint8Array>,
      contentType: result.ContentType,
      contentLength: result.ContentLength,
    };
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

/** Whether the key exists, without downloading it. */
export async function hasObject(key: string): Promise<boolean> {
  try {
    await client().send(new HeadObjectCommand({ Bucket: config().bucket, Key: checkKey(key) }));
    return true;
  } catch (error) {
    if (isNotFound(error)) return false;
    throw error;
  }
}

/** Deletes one object. Deleting a key that does not exist also succeeds. */
export async function deleteObject(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: config().bucket, Key: checkKey(key) }));
}

/** The browser-facing URL of an object, or `undefined` when the bucket has no public URL configured. */
export function objectPublicUrl(key: string): string | undefined {
  const base = serverEnv.r2?.publicUrl;
  return base ? `${base}/${checkKey(key).split("/").map(encodeURIComponent).join("/")}` : undefined;
}
