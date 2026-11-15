import "client-only";

import constellationLines from "./data/constellation-lines.json";
import { normalizeRa } from "./sky-coordinates";

/** What the line layer needs from the view: a sky-to-screen projection (null beyond the view) and the view. */
export type LineFrame = {
  project: (ra: number, dec: number) => [number, number] | null;
  ra: number;
  dec: number;
  fov: number;
  width: number;
  height: number;
};

export type LineLayers = { constellations: boolean; constellationNames: boolean; grid: boolean };

type ConstellationData = {
  features: { id: string; properties: { rank: string }; geometry: { coordinates: number[][][] } }[];
};

const IAU_NAMES: Record<string, string> = {
  And: "Andromeda", Ant: "Antlia", Aps: "Apus", Aqr: "Aquarius", Aql: "Aquila", Ara: "Ara", Ari: "Aries",
  Aur: "Auriga", Boo: "Bootes", Cae: "Caelum", Cam: "Camelopardalis", Cnc: "Cancer", CVn: "Canes Venatici",
  CMa: "Canis Major", CMi: "Canis Minor", Cap: "Capricornus", Car: "Carina", Cas: "Cassiopeia", Cen: "Centaurus",
  Cep: "Cepheus", Cet: "Cetus", Cha: "Chamaeleon", Cir: "Circinus", Col: "Columba", Com: "Coma Berenices",
  CrA: "Corona Australis", CrB: "Corona Borealis", Crv: "Corvus", Crt: "Crater", Cru: "Crux", Cyg: "Cygnus",
  Del: "Delphinus", Dor: "Dorado", Dra: "Draco", Equ: "Equuleus", Eri: "Eridanus", For: "Fornax", Gem: "Gemini",
  Gru: "Grus", Her: "Hercules", Hor: "Horologium", Hya: "Hydra", Hyi: "Hydrus", Ind: "Indus", Lac: "Lacerta",
  Leo: "Leo", LMi: "Leo Minor", Lep: "Lepus", Lib: "Libra", Lup: "Lupus", Lyn: "Lynx", Lyr: "Lyra", Men: "Mensa",
  Mic: "Microscopium", Mon: "Monoceros", Mus: "Musca", Nor: "Norma", Oct: "Octans", Oph: "Ophiuchus", Ori: "Orion",
  Pav: "Pavo", Peg: "Pegasus", Per: "Perseus", Phe: "Phoenix", Pic: "Pictor", Psc: "Pisces", PsA: "Piscis Austrinus",
  Pup: "Puppis", Pyx: "Pyxis", Ret: "Reticulum", Sge: "Sagitta", Sgr: "Sagittarius", Sco: "Scorpius", Scl: "Sculptor",
  Sct: "Scutum", Ser: "Serpens", Sex: "Sextans", Tau: "Taurus", Tel: "Telescopium", Tri: "Triangulum",
  TrA: "Triangulum Australe", Tuc: "Tucana", UMa: "Ursa Major", UMi: "Ursa Minor", Vel: "Vela", Vir: "Virgo",
  Vol: "Volans", Vul: "Vulpecula",
};

/**
 * Constellation stick figures from d3-celestial (BSD-3-Clause, see data/LICENSE-d3-celestial.txt; positions J2000,
 * lines after the IAU constellation pages). Longitude in the file is RA in −180…180°. In the TAN projection a great
 * circle is a straight line, so straight segments between the stars are exact. Rank 1–2 lines are drawn (decision
 * #55); every star of the figure still places its name.
 */
const CONSTELLATIONS = (constellationLines as ConstellationData).features.map((feature) => {
  const lines = feature.geometry.coordinates.map((line) =>
    line.map(([ra, dec]): [number, number] => [normalizeRa(ra), dec]),
  );
  return {
    name: (IAU_NAMES[feature.id] ?? feature.id).toUpperCase(),
    drawn: Number(feature.properties.rank) <= 2,
    lines,
  };
});

/** Lines and names fade out between these fields of view and are gone in the aim zone (Figma "Proposal · 1.5°"). */
const FADE_START_FOV = 10;
const FADE_END_FOV = 5;
/** Gap left at each star so the line does not cover it. */
const STAR_GAP = 5;
/** Grid spacing: the smallest step that keeps lines at least this far apart (CSS pixels) at the view center. */
const GRID_MIN_SPACING = 200;
/** Steps in degrees: Dec in degrees and arcminutes, RA in hours and minutes of time. */
const DEC_STEPS = [45, 30, 15, 10, 5, 2, 1, 30 / 60, 20 / 60, 10 / 60, 5 / 60, 2 / 60, 1 / 60, 30 / 3600, 10 / 3600];
const RA_STEPS = [90, 45, 30, 15, 7.5, 5, 2.5, 1.25, 0.5, 0.25, 0.125, 1 / 24, 1 / 48, 1 / 240];

const ASH = "176, 176, 169";
const PAPER = "240, 240, 250";
/** Room the screen's own controls take; grid labels and names stay out of it. */
const LABEL_TOP = 72;
const LABEL_LEFT_CLEAR = 420;
const LABEL_RIGHT_CLEAR = 80;
const LABEL_BOTTOM_CLEAR = 140;

/**
 * Coordinate grid, constellation lines and constellation names (Figma "I · Sky lines · C · Grid first", decision
 * #55): the grid leads in paper with its RA and Dec at the edges; the constellation lines sit quieter in ash. Drawn on
 * our own canvas, not as an Aladin Lite overlay: in 3.8.2 a polyline with a point outside the TAN projection throws
 * inside Aladin's draw loop, and its own grid could not be styled or labelled to match.
 */
export function drawSkyLines(context: CanvasRenderingContext2D, frame: LineFrame, layers: LineLayers, font: string) {
  if (layers.grid) drawGrid(context, frame, font);
  const fade = Math.min(Math.max((frame.fov - FADE_END_FOV) / (FADE_START_FOV - FADE_END_FOV), 0), 1);
  if (layers.constellations && fade > 0) drawConstellations(context, frame, layers.constellationNames, fade, font);
}

function drawConstellations(
  context: CanvasRenderingContext2D,
  { project, width, height }: LineFrame,
  names: boolean,
  fade: number,
  font: string,
) {
  context.strokeStyle = `rgba(${ASH}, ${0.22 * fade})`;
  context.lineWidth = 1;
  context.beginPath();
  const labels: { name: string; x: number; y: number }[] = [];
  for (const constellation of CONSTELLATIONS) {
    let sumX = 0;
    let sumY = 0;
    let seen = 0;
    for (const line of constellation.lines) {
      let previous: [number, number] | null = null;
      for (const [ra, dec] of line) {
        // Points more than 90° from the view center have no TAN position; the segment to them is skipped.
        const point = project(ra, dec);
        if (point && point[0] >= 0 && point[0] <= width && point[1] >= 0 && point[1] <= height) {
          sumX += point[0];
          sumY += point[1];
          seen += 1;
        }
        if (constellation.drawn && previous && point) segment(context, previous, point);
        previous = point;
      }
    }
    if (names && seen >= 3) labels.push({ name: constellation.name, x: sumX / seen, y: sumY / seen });
  }
  context.stroke();
  if (labels.length === 0) return;
  context.font = font;
  context.textAlign = "center";
  context.textBaseline = "middle";
  setLetterSpacing(context, "1.2px");
  shadow(context);
  context.fillStyle = `rgba(${ASH}, ${0.75 * fade})`;
  for (const { name, x, y } of labels) {
    if (y < LABEL_TOP + 40 || y > height - LABEL_BOTTOM_CLEAR || x < 40 || x > width - LABEL_RIGHT_CLEAR) continue;
    context.fillText(name, x, y);
  }
  resetText(context);
}

/** A segment between two stars, shortened by STAR_GAP at each end. */
function segment(context: CanvasRenderingContext2D, [x1, y1]: [number, number], [x2, y2]: [number, number]) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  if (length <= STAR_GAP * 2 + 2) return;
  const ux = (x2 - x1) / length;
  const uy = (y2 - y1) / length;
  context.moveTo(x1 + ux * STAR_GAP, y1 + uy * STAR_GAP);
  context.lineTo(x2 - ux * STAR_GAP, y2 - uy * STAR_GAP);
}

function drawGrid(context: CanvasRenderingContext2D, frame: LineFrame, font: string) {
  const { project, ra, dec, fov, width, height } = frame;
  const scale = width / 2 / Math.tan(((fov / 2) * Math.PI) / 180);
  const pixelsPerDegree = (scale * Math.PI) / 180;
  const cosDec = Math.max(Math.cos((dec * Math.PI) / 180), 0.05);
  const decStep = pick(DEC_STEPS, (step) => step * pixelsPerDegree >= GRID_MIN_SPACING);
  const raStep = pick(RA_STEPS, (step) => step * cosDec * pixelsPerDegree >= GRID_MIN_SPACING);
  // Angular radius of the screen from its center: the half diagonal.
  const radius = Math.min((Math.atan(Math.hypot(width, height) / 2 / scale) * 180) / Math.PI + decStep, 90);
  const decMin = Math.max(dec - radius, -90);
  const decMax = Math.min(dec + radius, 90);
  const fullCircle = Math.abs(dec) + radius >= 89 || radius / cosDec >= 180;
  const raSpan = fullCircle ? 180 : radius / cosDec + raStep;
  const sample = Math.max(radius / 90, 1e-4);

  const lines: { points: ([number, number] | null)[]; strong: boolean; kind: "ra" | "dec"; value: number }[] = [];
  for (let value = Math.ceil(decMin / decStep) * decStep; value <= decMax + 1e-9; value += decStep) {
    if (Math.abs(value) >= 90 - 1e-9) continue;
    const points: ([number, number] | null)[] = [];
    for (let offset = -raSpan; offset <= raSpan + 1e-9; offset += sample / cosDec) points.push(project(normalizeRa(ra + offset), value));
    lines.push({ points, strong: Math.abs(value) < 1e-9, kind: "dec", value });
  }
  const raFrom = fullCircle ? 0 : Math.ceil((ra - raSpan) / raStep) * raStep;
  const raTo = fullCircle ? 360 - raStep / 2 : ra + raSpan;
  for (let value = raFrom; value <= raTo + 1e-9; value += raStep) {
    const points: ([number, number] | null)[] = [];
    for (let at = Math.max(decMin, -89.9); at <= Math.min(decMax, 89.9) + 1e-9; at += sample) points.push(project(normalizeRa(value), at));
    const normalized = normalizeRa(value);
    lines.push({ points, strong: normalized < 1e-9 || normalized > 360 - 1e-9, kind: "ra", value: normalized });
  }

  context.lineWidth = 1;
  for (const strong of [false, true]) {
    context.strokeStyle = `rgba(${PAPER}, ${strong ? 0.34 : 0.16})`;
    context.beginPath();
    for (const line of lines) {
      if (line.strong !== strong) continue;
      let previous: [number, number] | null = null;
      for (const point of line.points) {
        if (previous && point) {
          context.moveTo(previous[0], previous[1]);
          context.lineTo(point[0], point[1]);
        }
        previous = point;
      }
    }
    context.stroke();
  }

  // RA where each meridian crosses the top label line, Dec where each circle meets the left edge.
  context.font = font;
  context.textBaseline = "middle";
  setLetterSpacing(context, "0.4px");
  shadow(context);
  context.fillStyle = `rgba(${PAPER}, 0.85)`;
  for (const line of lines) {
    const hit =
      line.kind === "ra" ? crossing(line.points, 1, LABEL_TOP) : crossing(line.points, 0, 8);
    if (!hit) continue;
    if (line.kind === "ra") {
      if (hit < LABEL_LEFT_CLEAR || hit > width - LABEL_RIGHT_CLEAR) continue;
      context.textAlign = "center";
      context.fillText(formatRaStep(line.value, raStep), hit, LABEL_TOP);
    } else {
      if (hit < LABEL_TOP + 90 || hit > height - LABEL_BOTTOM_CLEAR) continue;
      context.textAlign = "left";
      context.fillText(formatDecStep(line.value, decStep), 12, hit);
    }
  }
  resetText(context);
}

function pick(steps: number[], fits: (step: number) => boolean) {
  for (let index = steps.length - 1; index >= 0; index -= 1) if (fits(steps[index])) return steps[index];
  return steps[0];
}

/** Where a polyline crosses x = at (axis 0) or y = at (axis 1): the other coordinate, or null. */
function crossing(points: ([number, number] | null)[], axis: 0 | 1, at: number) {
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1];
    const b = points[index];
    if (!a || !b || (a[axis] - at) * (b[axis] - at) > 0 || a[axis] === b[axis]) continue;
    const t = (at - a[axis]) / (b[axis] - a[axis]);
    return a[1 - axis] + t * (b[1 - axis] - a[1 - axis]);
  }
  return null;
}

function formatRaStep(ra: number, step: number) {
  const totalSeconds = Math.round((ra / 15) * 3600);
  const hours = Math.floor(totalSeconds / 3600) % 24;
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  if (step >= 15) return `${pad(hours)}h`;
  if (step >= 0.25) return `${pad(hours)}h ${pad(minutes)}m`;
  return `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
}

function formatDecStep(dec: number, step: number) {
  const sign = dec < -1e-9 ? "−" : dec > 1e-9 ? "+" : "";
  const totalSeconds = Math.round(Math.abs(dec) * 3600);
  const degrees = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  if (step >= 1) return `${sign}${pad(degrees)}°`;
  if (step >= 1 / 60) return `${sign}${pad(degrees)}° ${pad(minutes)}′`;
  return `${sign}${pad(degrees)}° ${pad(minutes)}′ ${pad(seconds)}″`;
}

function shadow(context: CanvasRenderingContext2D) {
  context.shadowColor = "rgba(0, 0, 0, 0.9)";
  context.shadowBlur = 3;
  context.shadowOffsetY = 1;
}

function setLetterSpacing(context: CanvasRenderingContext2D, value: string) {
  // letterSpacing is missing from older browsers; the labels still read without it.
  if ("letterSpacing" in context) context.letterSpacing = value;
}

function resetText(context: CanvasRenderingContext2D) {
  context.shadowColor = "transparent";
  context.shadowBlur = 0;
  context.shadowOffsetY = 0;
  setLetterSpacing(context, "0px");
}
