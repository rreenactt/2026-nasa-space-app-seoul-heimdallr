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

/**
 * Unit vector for a sky position in scene space. +y points to the north celestial pole, RA 0 lies on +x,
 * and RA grows toward -z, so seen from the center of the sphere RA increases to the left as on the real sky.
 */
export function equatorialToVector(ra: number, dec: number): [number, number, number] {
  const r = ra * DEG;
  const d = dec * DEG;
  return [Math.cos(d) * Math.cos(r), Math.sin(d), -Math.cos(d) * Math.sin(r)];
}

export function vectorToEquatorial(x: number, y: number, z: number): EquatorialCoordinates {
  const length = Math.hypot(x, y, z);
  return {
    ra: normalizeRa(Math.atan2(-z, x) / DEG),
    dec: Math.asin(clamp(y / length, -1, 1)) / DEG,
  };
}

/** Converts a horizontal field of view to the vertical one a three.js PerspectiveCamera expects. */
export function horizontalToVerticalFov(horizontalFov: number, aspect: number) {
  return (2 * Math.atan(Math.tan((horizontalFov * DEG) / 2) / aspect)) / DEG;
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
