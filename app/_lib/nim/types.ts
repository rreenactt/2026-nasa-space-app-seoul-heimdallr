/**
 * Neighborhood in Motion — measured values for a nearby object, kept separate from model assumptions.
 */

export interface Measured {
  value: number;
  error: number | null;
}

export type ObjectSource =
  | { catalog: "Gaia DR3"; sourceId: string; service: string }
  | { catalog: "literature"; reference: string; url: string };

export interface NeighborObject {
  id: string;
  name: string;
  /** How the name was assigned (Gaia has no names). */
  nameBasis: string;
  kind: string;
  source: ObjectSource;
  /** Reference epoch of ra/dec (decimal year). */
  epoch: number;
  ra: number; // deg
  dec: number; // deg
  parallax: Measured; // mas
  pmra: Measured; // mas/yr, includes cos(dec)
  pmdec: Measured; // mas/yr
  /** null = not measured (never stored as 0). */
  radialVelocity: Measured | null; // km/s
  /** Gaia correlation coefficients (null for literature values). */
  correlations: { parallaxPmra: number; parallaxPmdec: number; pmraPmdec: number } | null;
  ruwe: number | null;
  gmag: number | null;
  notes: string[];
}

export interface NeighborCatalog {
  objects: NeighborObject[];
  queries: { service: string; query: string }[];
  fetchedAt: string;
}
