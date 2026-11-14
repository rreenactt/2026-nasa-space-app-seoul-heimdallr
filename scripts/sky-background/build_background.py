"""Build the 360-degree background image for the 3D sky from a HiPS Allsky preview.

The browser sphere needs one equirectangular (CAR) image. Instead of calling a remote service, this script
downloads the HiPS `Norder3/Allsky` preview (one static file holding every order-3 tile) and resamples it.

Column x of the output covers RA = 360 * (x + 0.5) / width - 180 (mod 360), increasing to the right, and row 0
is Dec +90. That matches the UV layout of three.js SphereGeometry once the sphere maps phi = RA + 180 degrees,
which app/_components/sky/celestial-sphere.tsx relies on.

Usage:
    python build_background.py --hips https://irsa.ipac.caltech.edu/data/hips/CDS/2MASS/Color \
        --out ../../public/sky/2mass-color-4096.jpg
"""

import argparse
import io
import urllib.request

import astropy.units as u
import numpy as np
from astropy_healpix import HEALPix
from PIL import Image

ALLSKY_ORDER = 3  # HiPS Allsky files hold the order-3 tiles (768 of them).


def download_allsky(hips_url: str) -> Image.Image:
    base = hips_url.rstrip("/")
    for name in ("Allsky.jpg", "Allsky.png"):
        try:
            with urllib.request.urlopen(f"{base}/Norder{ALLSKY_ORDER}/{name}", timeout=60) as response:
                return Image.open(io.BytesIO(response.read())).convert("RGB")
        except OSError:
            continue
    raise SystemExit(f"No Norder{ALLSKY_ORDER}/Allsky.jpg or .png under {base}")


def deinterleave(value: np.ndarray, bits: int) -> tuple[np.ndarray, np.ndarray]:
    """Splits a nested HEALPix sub-index into its even-bit and odd-bit coordinates."""
    even = np.zeros_like(value)
    odd = np.zeros_like(value)
    for i in range(bits):
        even |= ((value >> (2 * i)) & 1) << i
        odd |= ((value >> (2 * i + 1)) & 1) << i
    return even, odd


def build(allsky: Image.Image, width: int, gamma: float) -> Image.Image:
    pixels = np.asarray(allsky)
    tiles = 12 * 4**ALLSKY_ORDER
    columns = int(np.sqrt(tiles))  # HiPS Allsky layout: tiles in row-major order, floor(sqrt(n)) per row
    tile_width = pixels.shape[1] // columns
    bits = int(np.log2(tile_width))

    height = width // 2
    ra = (360 * (np.arange(width) + 0.5) / width - 180) % 360
    dec = 90 - 180 * (np.arange(height) + 0.5) / height
    ra_grid, dec_grid = np.meshgrid(ra, dec)

    healpix = HEALPix(nside=2 ** (ALLSKY_ORDER + bits), order="nested")
    index = healpix.lonlat_to_healpix(ra_grid * u.deg, dec_grid * u.deg)
    tile = index >> (2 * bits)
    even, odd = deinterleave(index & ((1 << (2 * bits)) - 1), bits)
    # Within a HiPS tile image, the odd bits give the column and the even bits the row. This was checked by
    # rendering all eight axis orders and flips: only this one gives a continuous Milky Way.
    column = (tile % columns) * tile_width + odd
    row = (tile // columns) * tile_width + even

    image = pixels[row, column].astype(np.float64) / 255
    if gamma != 1:
        image = image ** (1 / gamma)
    return Image.fromarray(np.clip(image * 255 + 0.5, 0, 255).astype(np.uint8))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--hips", required=True, help="HiPS base URL")
    parser.add_argument("--out", required=True, help="Output JPEG path")
    parser.add_argument("--width", type=int, default=4096, help="Output width in pixels (height is half)")
    parser.add_argument(
        "--gamma",
        type=float,
        default=1.0,
        help="Display brightening (>1 lifts faint areas). For the browsing background only, never for analysis.",
    )
    args = parser.parse_args()

    image = build(download_allsky(args.hips), args.width, args.gamma)
    image.save(args.out, quality=88, optimize=True, progressive=True)
    print(f"Wrote {args.out} ({image.width}x{image.height})")


if __name__ == "__main__":
    main()
