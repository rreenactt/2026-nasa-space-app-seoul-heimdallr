import "server-only";

import { HTTPError, TimeoutError } from "ky";
import { z } from "zod";
import { NotFoundError } from "./irsa";

/** Parses URL search params with a strict schema; returns a 400 Response on failure. */
export function parseQuery<T extends z.ZodType>(url: URL, schema: T): { ok: true; data: z.infer<T> } | { ok: false; response: Response } {
  const parsed = schema.safeParse(Object.fromEntries(url.searchParams));
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, response: Response.json({ message: z.prettifyError(parsed.error) }, { status: 400 }) };
}

/** Maps upstream failures to a short message; no response is cached. */
export function errorResponse(error: unknown): Response {
  if (error instanceof NotFoundError) return Response.json({ message: error.message }, { status: 404 });
  if (error instanceof TimeoutError) return Response.json({ message: "Upstream archive timed out" }, { status: 504 });
  if (error instanceof HTTPError) {
    return Response.json({ message: `Upstream archive answered ${error.response.status}` }, { status: 502 });
  }
  console.error(error);
  return Response.json({ message: error instanceof Error ? error.message : "Unexpected error" }, { status: 502 });
}

export const NO_STORE = { "Cache-Control": "no-store" } as const;
