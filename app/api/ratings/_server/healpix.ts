import "server-only";

/** HEALPix order of the rating grid: order 11 (nside 2048) cells are about 1.7′ across, inside the 3′ cutout. */
export const RATING_HPX_ORDER = 11;

/**
 * HEALPix NESTED pixel index of an ICRS position (ang2pix_nest from Górski et al. 2005, healpix_base).
 * The grid is fixed on the sky, so the same point always lands in the same cell (absolute principle 2).
 */
export function ang2pixNest(order: number, raDeg: number, decDeg: number): number {
  const nside = 1 << order;
  const z = Math.sin((decDeg * Math.PI) / 180);
  const za = Math.abs(z);
  const phi = ((((raDeg % 360) + 360) % 360) * Math.PI) / 180;
  const tt = (phi * 2) / Math.PI; // [0, 4)

  let face: number;
  let ix: number;
  let iy: number;
  if (za <= 2 / 3) {
    const temp1 = nside * (0.5 + tt);
    const temp2 = nside * z * 0.75;
    const jp = Math.floor(temp1 - temp2);
    const jm = Math.floor(temp1 + temp2);
    const ifp = Math.floor(jp / nside);
    const ifm = Math.floor(jm / nside);
    face = ifp === ifm ? ifp | 4 : ifp < ifm ? ifp : ifm + 8;
    ix = jm & (nside - 1);
    iy = nside - (jp & (nside - 1)) - 1;
  } else {
    const ntt = Math.min(3, Math.floor(tt));
    const tp = tt - ntt;
    const tmp = nside * Math.sqrt(3 * (1 - za));
    const jp = Math.min(nside - 1, Math.floor(tp * tmp));
    const jm = Math.min(nside - 1, Math.floor((1 - tp) * tmp));
    if (z >= 0) {
      face = ntt;
      ix = nside - jm - 1;
      iy = nside - jp - 1;
    } else {
      face = ntt + 8;
      ix = jp;
      iy = jm;
    }
  }

  let interleaved = 0;
  for (let bit = 0; bit < order; bit++) {
    interleaved |= ((ix >> bit) & 1) << (2 * bit);
    interleaved |= ((iy >> bit) & 1) << (2 * bit + 1);
  }
  return face * nside * nside + interleaved;
}

const JRLL = [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4];
const JPLL = [1, 3, 5, 7, 0, 2, 4, 6, 1, 3, 5, 7];

/** Center of a HEALPix NESTED pixel as ICRS degrees (pix2ang_nest, the inverse of `ang2pixNest`). */
export function pix2angNest(order: number, pix: number): { ra: number; dec: number } {
  const nside = 1 << order;
  const npface = nside * nside;
  const face = Math.floor(pix / npface);
  const ipf = pix % npface;
  let ix = 0;
  let iy = 0;
  for (let bit = 0; bit < order; bit++) {
    ix |= ((ipf >> (2 * bit)) & 1) << bit;
    iy |= ((ipf >> (2 * bit + 1)) & 1) << bit;
  }

  const jr = JRLL[face] * nside - ix - iy - 1;
  let nr: number;
  let z: number;
  let kshift = 0;
  if (jr < nside) {
    nr = jr;
    z = 1 - (nr * nr) / (3 * npface);
  } else if (jr > 3 * nside) {
    nr = 4 * nside - jr;
    z = (nr * nr) / (3 * npface) - 1;
  } else {
    nr = nside;
    z = ((2 * nside - jr) * 2) / (3 * nside);
    kshift = (jr - nside) & 1;
  }
  let jp = (JPLL[face] * nr + ix - iy + 1 + kshift) / 2;
  if (jp > 4 * nside) jp -= 4 * nside;
  if (jp < 1) jp += 4 * nside;
  const phi = (jp - (kshift + 1) * 0.5) * (Math.PI / 2 / nr);
  return { ra: (phi * 180) / Math.PI, dec: (Math.asin(z) * 180) / Math.PI };
}
