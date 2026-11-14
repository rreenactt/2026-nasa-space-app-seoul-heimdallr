import type { MissionId } from "./types";

export interface MissionConfig {
  id: MissionId;
  label: string;
  /** IRSA SIA2 / ObsCore collections searched for this mission. */
  collections: string[];
  product: string;
  bands: { id: string; label: string; wavelength: string }[];
  defaultBand: string;
  /** Exposures combined per observing window (spread over the window). */
  maxStack: number;
  /** Gap (days) that starts a new observing window. */
  windowGapDays: number;
  years: string;
}

export const MISSIONS: Record<MissionId, MissionConfig> = {
  "2mass": {
    id: "2mass",
    label: "2MASS",
    collections: ["twomass_allsky"],
    product: "2MASS All-Sky Atlas Image (같은 밤 겹치는 타일은 함께 사용)",
    bands: [
      { id: "J", label: "J", wavelength: "1.25 µm" },
      { id: "H", label: "H", wavelength: "1.65 µm" },
      { id: "K", label: "Ks", wavelength: "2.16 µm" },
    ],
    defaultBand: "K",
    maxStack: 4,
    windowGapDays: 1,
    years: "1997–2001",
  },
  wise: {
    id: "wise",
    label: "WISE",
    collections: ["wise_allsky", "wise_3bandcryo", "wise_2bandcryo"],
    product: "WISE L1b 단일 노출 → 관측 통과별 중앙값 합성 (이 도구에서 계산)",
    bands: [
      { id: "W1", label: "W1", wavelength: "3.4 µm" },
      { id: "W2", label: "W2", wavelength: "4.6 µm" },
    ],
    defaultBand: "W1",
    maxStack: 5,
    windowGapDays: 20,
    years: "2010–2011",
  },
  neowise: {
    id: "neowise",
    label: "NEOWISE",
    collections: ["neowiser"],
    product: "NEOWISE-R L1b 단일 노출 → 관측 통과별 중앙값 합성 (이 도구에서 계산)",
    bands: [
      { id: "W1", label: "W1", wavelength: "3.4 µm" },
      { id: "W2", label: "W2", wavelength: "4.6 µm" },
    ],
    defaultBand: "W1",
    maxStack: 5,
    windowGapDays: 20,
    years: "2013–2024",
  },
  spherex: {
    id: "spherex",
    label: "SPHEREx",
    collections: ["spherex_dr1"],
    product: "SPHEREx L2b 분광 영상 (관측 통과마다 노출 1장, 파장은 위치마다 다름)",
    bands: [
      { id: "D1", label: "D1", wavelength: "0.75–1.1 µm" },
      { id: "D2", label: "D2", wavelength: "1.1–1.6 µm" },
      { id: "D3", label: "D3", wavelength: "1.6–2.4 µm" },
      { id: "D4", label: "D4", wavelength: "2.4–3.8 µm" },
      { id: "D5", label: "D5", wavelength: "3.8–4.4 µm" },
      { id: "D6", label: "D6", wavelength: "4.4–5.0 µm" },
    ],
    defaultBand: "D4",
    maxStack: 1,
    windowGapDays: 20,
    years: "2025–",
  },
};

export const MISSION_ORDER: MissionId[] = ["2mass", "wise", "neowise", "spherex"];

export interface SkyExample {
  id: string;
  name: string;
  /** Field center (deg). */
  ra: number;
  dec: number;
  fovArcmin: number;
  note: string;
  /** Where the coordinates come from. */
  source: string;
}

/**
 * Centers are chosen so the expected motion over 2000–2025 stays inside the field.
 * Barnard's Star / ε Indi A: Gaia DR3 position at 2016.0 (queried from IRSA gaia_dr3_source).
 */
export const EXAMPLES: SkyExample[] = [
  {
    id: "barnard",
    name: "Barnard's Star",
    ra: 269.44850252544,
    dec: 4.73942005111,
    fovArcmin: 8,
    note: "고유운동이 가장 큰 별 중 하나(Gaia DR3 약 10.4″/년, 북쪽). 25년이면 약 4′ 이동합니다. 밝아서 2MASS·WISE에서 포화될 수 있습니다.",
    source: "Gaia DR3 4472832130942575872 (2016.0)",
  },
  {
    id: "eps-ind",
    name: "ε Indi A",
    ra: 330.8724078796,
    dec: -56.79725466123,
    fovArcmin: 8,
    note: "Gaia DR3 약 4.7″/년. 주성은 매우 밝아(G≈4.3) 포화됩니다. 갈색왜성 동반성 ε Indi Ba/Bb는 약 7′ 떨어져 있어 이 시야 밖일 수 있습니다.",
    source: "Gaia DR3 6412595290592307840 (2016.0)",
  },
  {
    id: "wise0855",
    name: "WISE 0855−0714",
    ra: 133.795125,
    dec: -7.245139,
    fovArcmin: 5,
    note: "매우 차가운 갈색왜성으로 W2에서 주로 보입니다. Gaia에 없어 예상 경로는 표시되지 않습니다. 2MASS·SPHEREx에서 보이지 않을 수 있으며, 이는 감도·파장 차이이지 '없던 천체가 생겼다'는 뜻이 아닙니다.",
    source: "AllWISE 명칭 좌표 J085510.83−071442.5 (2010년경 위치)",
  },
];

export const PROCESSING_VERSION = "stm-1: SIA2 검색 → IBE/S3 잘라 받기 → TAN 공통 격자 쌍선형 재투영 → 배경 중앙값 차감·MAGZP 22.5 정규화 → 중앙값 합성";
