import "server-only";

import { api } from "@/lib/ky";

/**
 * Gaia DR3 cone queries. ESA's Gaia Archive is tried first (seconds); IRSA's copy is the fallback
 * (it has been taking 20–90 s). `{table}` in the query is replaced with each service's table name.
 */
const SERVICES = [
  { name: "ESA Gaia Archive", url: "https://gea.esac.esa.int/tap-server/tap/sync", table: "gaiadr3.gaia_source", timeout: 25_000 },
  { name: "IRSA", url: "https://irsa.ipac.caltech.edu/TAP/sync", table: "gaia_dr3_source", timeout: 30_000 },
] as const;

export async function gaiaQuery(template: string): Promise<{ csv: string; service: string; query: string }> {
  let lastError: unknown;
  for (const s of SERVICES) {
    const query = template.replaceAll("{table}", s.table);
    try {
      const body = new URLSearchParams({ REQUEST: "doQuery", LANG: "ADQL", FORMAT: "csv", QUERY: query });
      const csv = await api.post(s.url, { body, timeout: s.timeout }).text();
      return { csv, service: s.name, query };
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}
