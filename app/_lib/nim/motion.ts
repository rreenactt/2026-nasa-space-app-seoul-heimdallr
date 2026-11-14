import type { NeighborObject } from "./types";

/**
 * Straight-line (constant velocity) motion in the barycentric ICRS frame:
 *   r(t) = r(t0) + v (t − t0)
 * Units: positions in pc, velocities in km/s, times in Julian years. Directions are as seen from the
 * solar-system barycenter (no observer parallax). No Galactic potential, no binary orbits.
 */

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
/** km/s per (arcsec/yr × pc). */
export const K_AU_PER_YR = 4.740470446;
/** pc per year for 1 km/s. */
export const PC_PER_YR_PER_KMS = 1 / 977_792.221;

export type Vec3 = [number, number, number];

export interface MotionModel {
  t0: number;
  r0: Vec3; // pc
  v: Vec3; // km/s
  distancePc: number;
  /** Radial velocity actually used, and whether it is an assumption. */
  rvUsed: number;
  rvAssumed: boolean;
  /** Tangential speed (km/s) from proper motion and distance. */
  vTan: number;
}

export function unitVectors(raDeg: number, decDeg: number) {
  const a = raDeg * D2R;
  const d = decDeg * D2R;
  const r: Vec3 = [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
  const east: Vec3 = [-Math.sin(a), Math.cos(a), 0];
  const north: Vec3 = [-Math.sin(d) * Math.cos(a), -Math.sin(d) * Math.sin(a), Math.cos(d)];
  return { r, east, north };
}

/** Builds the model. `assumedRv` is used only when the object has no measured radial velocity. */
export function buildModel(o: Pick<NeighborObject, "epoch" | "ra" | "dec" | "parallax" | "pmra" | "pmdec" | "radialVelocity">, assumedRv = 0, override?: { parallax: number; pmra: number; pmdec: number; rv: number }): MotionModel {
  const plx = override?.parallax ?? o.parallax.value; // mas
  const pmra = override?.pmra ?? o.pmra.value; // mas/yr
  const pmdec = override?.pmdec ?? o.pmdec.value;
  const measuredRv = o.radialVelocity?.value;
  const rv = override?.rv ?? measuredRv ?? assumedRv;
  const d = 1000 / plx;
  const { r, east, north } = unitVectors(o.ra, o.dec);
  const ve = (K_AU_PER_YR * pmra * d) / 1000;
  const vn = (K_AU_PER_YR * pmdec * d) / 1000;
  const v: Vec3 = [0, 1, 2].map((i) => ve * east[i] + vn * north[i] + rv * r[i]) as Vec3;
  return {
    t0: o.epoch,
    r0: [r[0] * d, r[1] * d, r[2] * d],
    v,
    distancePc: d,
    rvUsed: rv,
    rvAssumed: measuredRv == null && override === undefined,
    vTan: Math.hypot(ve, vn),
  };
}

export function positionAt(m: MotionModel, year: number): Vec3 {
  const dt = (year - m.t0) * PC_PER_YR_PER_KMS;
  return [m.r0[0] + m.v[0] * dt, m.r0[1] + m.v[1] * dt, m.r0[2] + m.v[2] * dt];
}

/** Barycentric direction and distance at a given year. */
export function skyAt(m: MotionModel, year: number): { ra: number; dec: number; distancePc: number } {
  const [x, y, z] = positionAt(m, year);
  const dist = Math.hypot(x, y, z);
  const ra = ((Math.atan2(y, x) * R2D) % 360 + 360) % 360;
  return { ra, dec: Math.asin(z / dist) * R2D, distancePc: dist };
}

/** Time and distance of closest approach to the barycenter under the straight-line model. */
export function closestApproach(m: MotionModel): { year: number; distancePc: number } {
  const vv = m.v[0] ** 2 + m.v[1] ** 2 + m.v[2] ** 2;
  if (vv === 0) return { year: m.t0, distancePc: m.distancePc };
  const rv = m.r0[0] * m.v[0] + m.r0[1] * m.v[1] + m.r0[2] * m.v[2];
  const dtYears = -rv / vv / PC_PER_YR_PER_KMS;
  const p = positionAt(m, m.t0 + dtYears);
  return { year: m.t0 + dtYears, distancePc: Math.hypot(...p) };
}

/** Deterministic PRNG (mulberry32) so the uncertainty spread is reproducible. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(r: () => number) {
  const u = Math.max(1e-12, r());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

/**
 * Draws parameter sets from the measurement errors. Parallax and proper motion use Gaia's correlation
 * coefficients when available (Cholesky of the 3×3 covariance); radial velocity is drawn independently.
 * Objects without a measured radial velocity are NOT varied in that direction (the assumption stays fixed).
 */
export function sampleModels(o: NeighborObject, assumedRv: number, n = 300, seed = 7): MotionModel[] {
  const s = [o.parallax.error ?? 0, o.pmra.error ?? 0, o.pmdec.error ?? 0];
  const c = o.correlations ?? { parallaxPmra: 0, parallaxPmdec: 0, pmraPmdec: 0 };
  const C = [
    [s[0] * s[0], c.parallaxPmra * s[0] * s[1], c.parallaxPmdec * s[0] * s[2]],
    [c.parallaxPmra * s[0] * s[1], s[1] * s[1], c.pmraPmdec * s[1] * s[2]],
    [c.parallaxPmdec * s[0] * s[2], c.pmraPmdec * s[1] * s[2], s[2] * s[2]],
  ];
  // Cholesky (3×3)
  const L = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = C[i][j];
      for (let k = 0; k < j; k++) sum -= L[i][k] * L[j][k];
      L[i][j] = i === j ? Math.sqrt(Math.max(0, sum)) : L[j][j] > 0 ? sum / L[j][j] : 0;
    }
  }
  const r = rng(seed);
  const out: MotionModel[] = [];
  for (let k = 0; k < n; k++) {
    const z = [gauss(r), gauss(r), gauss(r)];
    const d = [0, 1, 2].map((i) => L[i][0] * z[0] + L[i][1] * z[1] + L[i][2] * z[2]);
    const rvm = o.radialVelocity;
    const rv = rvm ? rvm.value + (rvm.error ?? 0) * gauss(r) : assumedRv;
    out.push(buildModel(o, assumedRv, { parallax: o.parallax.value + d[0], pmra: o.pmra.value + d[1], pmdec: o.pmdec.value + d[2], rv }));
  }
  return out;
}

export function percentile(values: number[], p: number) {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))))];
}

/** Model quality class shown in the UI. */
export function modelStatus(o: NeighborObject): { level: "full-3d" | "assumed-rv" | "distance-uncertain"; text: string } {
  const snr = o.parallax.error ? o.parallax.value / o.parallax.error : Infinity;
  if (!(o.parallax.value > 0) || snr < 10) return { level: "distance-uncertain", text: "Parallax too uncertain for a reliable 3D position." };
  if (!o.radialVelocity) return { level: "assumed-rv", text: "Radial velocity not measured. The 3D path uses an assumed value (default 0 km/s)." };
  return { level: "full-3d", text: "Distance, proper motion and radial velocity all measured: full 3D straight-line model." };
}

export const decimalYearToMjd = (y: number) => 51544.5 + (y - 2000) * 365.25;
export const mjdToDecimalYear = (mjd: number) => 2000 + (mjd - 51544.5) / 365.25;
