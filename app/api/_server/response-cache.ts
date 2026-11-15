import "server-only";

import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import { serverEnv } from "@/config/env.server";
import { getObject, isStorageConfigured, putObject } from "@/lib/storage";

/**
 * Precomputed analysis responses (decision #55). A route's JSON answer for an input is kept in the object storage
 * under a hash of the route and its input, so a place computed before (test targets, survey candidates) opens without
 * reading the archives again. Production only reads; a server started with RESPONSE_CACHE_WRITE=1 (the precompute
 * script) also stores what it computes. Only successful answers are stored. What is stored is the route's own output
 * (small cutouts and catalog rows with their archive links), never an original FITS file (absolute principle 7).
 */

/** Bump to drop every stored answer at once, e.g. when a route's output format changes. */
const VERSION = "v1";

/** A slow storage read gives up and computes instead, so the cache never makes a request slower than the archive. */
const READ_TIMEOUT_MS = 8_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Positions are keyed to 1e-5° (0.036″), the precision of the page URL, so a reopened link finds the same answer. */
export function keyCoordinate(value: number): number {
  return Number(value.toFixed(5));
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined);
    return `{${entries
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function responseKey(route: string, input: unknown): string {
  return `responses/${VERSION}/${route}/${createHash("sha256").update(stableStringify(input)).digest("hex")}.json.gz`;
}

/**
 * Answers with the stored JSON for (route, input) when there is one, otherwise computes it. A storage failure never
 * fails the request: it falls back to computing.
 */
export async function cachedJson(route: string, input: unknown, compute: () => Promise<unknown>, headers: HeadersInit = {}): Promise<Response> {
  const key = responseKey(route, input);
  const respond = (body: string, state: "hit" | "miss") =>
    new Response(body, { headers: { ...headers, "Content-Type": "application/json", "X-Response-Cache": state } });

  if (isStorageConfigured()) {
    try {
      const stored = await withTimeout(getObject(key), READ_TIMEOUT_MS);
      if (stored) return respond(gunzipSync(Buffer.from(await new Response(stored.body).arrayBuffer())).toString("utf8"), "hit");
    } catch (error) {
      console.warn("Response cache read failed", error instanceof Error ? error.message : error);
    }
  }

  const body = JSON.stringify(await compute());
  if (isStorageConfigured() && serverEnv.responseCacheWrite) {
    try {
      await putObject(key, new Uint8Array(gzipSync(body)), { contentType: "application/gzip" });
    } catch (error) {
      console.warn("Response cache write failed", error instanceof Error ? error.message : error);
    }
  }
  return respond(body, "miss");
}
