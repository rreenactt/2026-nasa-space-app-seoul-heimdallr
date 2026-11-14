/**
 * RICE_1 decompression for one tile of a tile-compressed FITS image (BYTEPIX 4), following
 * cfitsio's fits_rdecomp. Arithmetic is done with Numbers (not 32-bit bit ops) where values can reach 2³².
 */

const NONZERO_COUNT = (() => {
  const t = new Uint8Array(256);
  for (let i = 1; i < 256; i++) t[i] = 32 - Math.clz32(i);
  return t;
})();

const pow2 = (n: number) => 2 ** n;

/** Zig-zag mapping inverse: even → x/2, odd → -(x+1)/2. */
function unmap(diff: number): number {
  return diff % 2 === 0 ? diff / 2 : -(diff + 1) / 2;
}

export function riceDecompress32(input: Uint8Array, nx: number, blockSize = 32): Int32Array {
  const fsbits = 5;
  const fsmax = 25;
  const bbits = 32;
  const out = new Int32Array(nx);
  let pos = 0;
  const next = () => (pos < input.length ? input[pos++] : 0);

  let lastpix = ((input[0] << 24) | (input[1] << 16) | (input[2] << 8) | input[3]) | 0;
  pos = 4;
  let b = next();
  let nbits = 8;

  for (let i = 0; i < nx; i += blockSize) {
    nbits -= fsbits;
    while (nbits < 0) {
      b = b * 256 + next();
      nbits += 8;
    }
    const fs = Math.floor(b / pow2(nbits)) - 1;
    b %= pow2(nbits);
    const imax = Math.min(i + blockSize, nx);

    if (fs < 0) {
      for (let k = i; k < imax; k++) out[k] = lastpix;
    } else if (fs === fsmax) {
      for (let k = i; k < imax; k++) {
        let shift = bbits - nbits;
        let diff = b * pow2(shift);
        for (shift -= 8; shift >= 0; shift -= 8) {
          b = next();
          diff += b * pow2(shift);
        }
        if (nbits > 0) {
          b = next();
          diff += Math.floor(b / pow2(-shift));
          b %= pow2(nbits);
        } else {
          b = 0;
        }
        lastpix = (unmap(diff) + lastpix) | 0;
        out[k] = lastpix;
      }
    } else {
      for (let k = i; k < imax; k++) {
        while (b === 0) {
          nbits += 8;
          b = next();
        }
        const nzero = nbits - NONZERO_COUNT[b];
        nbits -= nzero + 1;
        b -= pow2(nbits); // clear the leading 1
        nbits -= fs;
        while (nbits < 0) {
          b = b * 256 + next();
          nbits += 8;
        }
        const diff = nzero * pow2(fs) + Math.floor(b / pow2(nbits));
        b %= pow2(nbits);
        lastpix = (unmap(diff) + lastpix) | 0;
        out[k] = lastpix;
      }
    }
  }
  return out;
}
