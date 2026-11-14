/** ICRS equatorial coordinates in degrees. */
export type EquatorialCoordinates = { ra: number; dec: number };

/** Where the viewer looks: the center of the view and its horizontal field of view, in degrees. */
export type SkyView = EquatorialCoordinates & { fov: number };

const DEG = Math.PI / 180;

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function normalizeRa(ra: number) {
  return ((ra % 360) + 360) % 360;
}

/** Angle between two sky positions, in degrees (haversine, stable for small separations). */
export function angularDistance(a: EquatorialCoordinates, b: EquatorialCoordinates) {
  const dDec = (b.dec - a.dec) * DEG;
  const dRa = (b.ra - a.ra) * DEG;
  const h = Math.sin(dDec / 2) ** 2 + Math.cos(a.dec * DEG) * Math.cos(b.dec * DEG) * Math.sin(dRa / 2) ** 2;
  return (2 * Math.asin(Math.min(1, Math.sqrt(h)))) / DEG;
}

/** Splits a positive value into whole units, minutes, and seconds (rounded to `secondDigits`). */
function toSexagesimal(value: number, secondDigits: number) {
  const scale = 10 ** secondDigits;
  const totalSeconds = Math.round(value * 3600 * scale) / scale;
  const units = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds - units * 3600) / 60);
  const seconds = totalSeconds - units * 3600 - minutes * 60;
  return { units, minutes, seconds: seconds.toFixed(secondDigits) };
}

const pad = (value: number | string, length = 2) => String(value).padStart(length, "0");

/** Formats RA as hours, e.g. "17h 45m 40.0s". */
export function formatRa(ra: number) {
  const { units, minutes, seconds } = toSexagesimal(normalizeRa(ra) / 15, 1);
  return `${pad(units % 24)}h ${pad(minutes)}m ${pad(seconds, 4)}s`;
}

/** Formats Dec as signed degrees, e.g. "−29° 00′ 28″". */
export function formatDec(dec: number) {
  const { units, minutes, seconds } = toSexagesimal(Math.abs(dec), 0);
  const sign = dec < 0 ? "−" : "+";
  return `${sign}${pad(units)}° ${pad(minutes)}′ ${pad(seconds)}″`;
}
