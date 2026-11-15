import "server-only";

import { HTTPError, TimeoutError } from "ky";
import { z } from "zod";
import { getT } from "@/app/_i18n/server";
import { NotFoundError } from "./irsa";

/** Parses URL search params with a strict schema; returns a 400 Response on failure. */
export function parseQuery<T extends z.ZodType>(url: URL, schema: T): { ok: true; data: z.infer<T> } | { ok: false; response: Response } {
  const parsed = schema.safeParse(Object.fromEntries(url.searchParams));
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, response: Response.json({ message: z.prettifyError(parsed.error) }, { status: 400 }) };
}

/** Names only the service whose request failed, rather than claiming all archives are down. */
function archiveService(url: string): string {
  const { hostname, pathname } = new URL(url);
  if (hostname === "irsa.ipac.caltech.edu") {
    if (pathname === "/SIA") return "IRSA SIA2";
    if (pathname.startsWith("/datalink/")) return "IRSA DataLink";
    if (pathname.startsWith("/TAP/")) return "IRSA TAP";
    if (pathname.startsWith("/ibe/")) return "IRSA IBE";
    return "IRSA";
  }
  if (hostname === "gea.esac.esa.int") return "ESA Gaia Archive";
  if (hostname === "ssd.jpl.nasa.gov") return "JPL Horizons";
  return hostname;
}

/** Maps upstream failures to a message in the selected language; no response is cached. */
export async function errorResponse(error: unknown): Promise<Response> {
  if (error instanceof NotFoundError) return Response.json({ message: error.message }, { status: 404 });
  if (error instanceof TimeoutError) return Response.json({ message: "Upstream archive timed out" }, { status: 504 });
  const t = await getT();
  if (error instanceof HTTPError) {
    return Response.json(
      { message: t("errors.archiveUnavailable", { service: archiveService(error.request.url) }) },
      { status: 502, headers: { ...NO_STORE, Vary: "Cookie" } },
    );
  }
  console.error(error);
  return Response.json({ message: t("errors.dataLookupFailed") }, { status: 502, headers: { ...NO_STORE, Vary: "Cookie" } });
}

export const NO_STORE = { "Cache-Control": "no-store" } as const;
