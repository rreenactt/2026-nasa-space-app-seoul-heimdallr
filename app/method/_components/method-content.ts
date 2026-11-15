/**
 * Method page content. Each section has a plain explanation anyone can follow, and a full explanation (formulas,
 * reasons, measured checks) that opens on demand. The numbers come from docs/analyses/ and docs/PLAN.md; keep them
 * in step with those documents. All text except formulas is a translation key (app/_i18n/messages.csv); the references
 * stay in English.
 */

import type { MessageKey } from "@/app/_i18n/message-keys";

/** Text fields are translation keys; a formula and the first two table cells (band, wavelength) stay literal. */
export type MethodBlock =
  | { kind: "h"; text: MessageKey }
  | { kind: "p"; text: MessageKey }
  | { kind: "formula"; text: string; where?: MessageKey }
  | { kind: "list"; items: MessageKey[] }
  | { kind: "table"; head: MessageKey[]; rows: [string, string, MessageKey, MessageKey][]; note?: MessageKey };

export interface MethodReference {
  text: string;
  href?: string;
}

export interface MethodSection {
  id: string;
  /** Section heading (translated). */
  titleKey: MessageKey;
  /** Plain words, no formulas (translated, one key per paragraph). */
  simpleKeys: MessageKey[];
  detail: MethodBlock[];
  references: MethodReference[];
}

const SPHEREX_DOCS: MethodReference = {
  text: "IRSA, SPHEREx archive documentation: data products, FLAGS bit definitions, spectral WCS",
  href: "https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-products/",
};
const GAIA_DR3: MethodReference = { text: "Gaia Collaboration, Vallenari, A., et al. 2023, A&A 674, A1 (Gaia Data Release 3)", href: "https://gea.esac.esa.int/archive/documentation/GDR3/" };
const TWOMASS: MethodReference = { text: "Skrutskie, M. F., et al. 2006, AJ 131, 1163 (The Two Micron All Sky Survey)" };
const WISE: MethodReference = { text: "Wright, E. L., et al. 2010, AJ 140, 1868 (The Wide-field Infrared Survey Explorer)" };
const NEOWISE: MethodReference = { text: "Mainzer, A., et al. 2014, ApJ 792, 30 (NEOWISE reactivation mission)" };
const WCS_PAPERS: MethodReference = { text: "Greisen, E. W. & Calabretta, M. R. 2002, A&A 395, 1061; Calabretta, M. R. & Greisen, E. W. 2002, A&A 395, 1077 (FITS world coordinate systems)" };

export const METHOD_SECTIONS: MethodSection[] = [
  {
    id: "blink",
    titleKey: "method.blinkTitle",
    simpleKeys: ["method.blinkSimple1", "method.blinkSimple2"],
    detail: [
      { kind: "h", text: "method.blinkDetail01" },
      { kind: "p", text: "method.blinkDetail02" },
      { kind: "h", text: "method.blinkDetail03" },
      { kind: "formula", text: "S(x, y) = IMAGE(x, y) − ZODI(x, y)", where: "method.blinkDetail04" },
      { kind: "formula", text: "V_k(x, y) = median over the exposures of visit k of S(x, y)", where: "method.blinkDetail05" },
      { kind: "formula", text: "Difference_k = V_k − V_1        Stack = mean over k of V_k", where: "method.blinkDetail06" },
      { kind: "p", text: "method.blinkDetail07" },
      { kind: "h", text: "method.blinkDetail08" },
      { kind: "formula", text: "Δθ = μ · Δt", where: "method.blinkDetail09" },
      { kind: "p", text: "method.blinkDetail10" },
      { kind: "h", text: "method.blinkDetail11" },
      { kind: "formula", text: "α(t) = α₀ + μα* · (t − t₀) / cos δ₀        δ(t) = δ₀ + μδ · (t − t₀)", where: "method.blinkDetail12" },
      { kind: "h", text: "method.blinkDetail13" },
      { kind: "p", text: "method.blinkDetail14" },
      { kind: "h", text: "method.blinkDetail15" },
      { kind: "p", text: "method.blinkDetail16" },
    ],
    references: [SPHEREX_DOCS, GAIA_DR3, WCS_PAPERS, { text: "Shupe, D. L., et al. 2005, ASP Conf. Ser. 347, 491 (the SIP distortion convention)" }],
  },
  {
    id: "same-detector",
    titleKey: "method.sameDetectorTitle",
    simpleKeys: ["method.sameDetectorSimple1", "method.sameDetectorSimple2", "method.sameDetectorSimple3"],
    detail: [
      { kind: "h", text: "method.sameDetectorDetail01" },
      { kind: "p", text: "method.sameDetectorDetail02" },
      { kind: "formula", text: "λ = λ(x, y)        Δλ = Δλ(x, y)        R = λ / Δλ", where: "method.sameDetectorDetail03" },
      { kind: "h", text: "method.sameDetectorDetail04" },
      {
        kind: "table",
        head: ["method.sameDetectorDetail05", "method.sameDetectorDetail06", "method.sameDetectorDetail07", "method.sameDetectorDetail08"],
        rows: [
          ["1 (D1)", "0.75–1.11", "method.sameDetectorDetail09", "method.sameDetectorDetail10"],
          ["2 (D2)", "1.11–1.64", "method.sameDetectorDetail11", "method.sameDetectorDetail12"],
          ["3 (D3)", "1.64–2.42", "method.sameDetectorDetail13", "method.sameDetectorDetail14"],
          ["4 (D4)", "2.42–3.82", "method.sameDetectorDetail15", "method.sameDetectorDetail16"],
          ["5 (D5)", "3.82–4.42", "method.sameDetectorDetail17", "method.sameDetectorDetail18"],
          ["6 (D6)", "4.42–5.00", "method.sameDetectorDetail19", "method.sameDetectorDetail20"],
        ],
        note: "method.sameDetectorDetail21",
      },
      { kind: "h", text: "method.sameDetectorDetail22" },
      { kind: "formula", text: "| λ_exposure − λ_reference | ≤ 0.5 · Δλ", where: "method.sameDetectorDetail23" },
      { kind: "h", text: "method.sameDetectorDetail24" },
      { kind: "p", text: "method.sameDetectorDetail25" },
      { kind: "h", text: "method.sameDetectorDetail26" },
      { kind: "p", text: "method.sameDetectorDetail27" },
    ],
    references: [
      { text: "Doré, O., et al. 2014, arXiv:1412.4872 (Cosmology with the SPHEREx All-Sky Spectral Survey)", href: "https://arxiv.org/abs/1412.4872" },
      { text: "Crill, B. P., et al. 2020, Proc. SPIE 11443, 114430I (SPHEREx: NASA's near-infrared spectrophotometric all-sky survey)" },
      { text: "Boogert, A. C. A., Gerakines, P. A. & Whittet, D. C. B. 2015, ARA&A 53, 541 (Observations of the Icy Universe: wavelengths of the ice absorption features)" },
      SPHEREX_DOCS,
    ],
  },
  {
    id: "one-visit",
    titleKey: "method.oneVisitTitle",
    simpleKeys: ["method.oneVisitSimple1", "method.oneVisitSimple2"],
    detail: [
      { kind: "p", text: "method.oneVisitDetail01" },
      { kind: "p", text: "method.oneVisitDetail02" },
      { kind: "p", text: "method.oneVisitDetail03" },
    ],
    references: [SPHEREX_DOCS],
  },
  {
    id: "sky-time-machine",
    titleKey: "method.skyTimeMachineTitle",
    simpleKeys: ["method.skyTimeMachineSimple1", "method.skyTimeMachineSimple2"],
    detail: [
      { kind: "h", text: "method.skyTimeMachineDetail01" },
      { kind: "formula", text: "σ_μ ≈ √(σ₁² + σ₂²) / Δt", where: "method.skyTimeMachineDetail02" },
      { kind: "h", text: "method.skyTimeMachineDetail03" },
      { kind: "formula", text: "Δθ = √( (Δα · cos δ)² + Δδ² )        μ = Δθ / Δt", where: "method.skyTimeMachineDetail04" },
      { kind: "p", text: "method.skyTimeMachineDetail05" },
      { kind: "h", text: "method.skyTimeMachineDetail06" },
      { kind: "list", items: [
        "method.skyTimeMachineDetail07",
        "method.skyTimeMachineDetail08",
        "method.skyTimeMachineDetail09",
        "method.skyTimeMachineDetail10",
        "method.skyTimeMachineDetail11",
      ] },
      { kind: "h", text: "method.skyTimeMachineDetail12" },
      { kind: "p", text: "method.skyTimeMachineDetail13" },
      { kind: "h", text: "method.skyTimeMachineDetail14" },
      { kind: "p", text: "method.skyTimeMachineDetail15" },
    ],
    references: [
      TWOMASS,
      WISE,
      NEOWISE,
      { text: "Meisner, A. M., et al. 2018, AJ 156, 69 (time-resolved unWISE coadds)" },
      { text: "Kuchner, M. J., et al. 2017, ApJL 841, L19 (Backyard Worlds: Planet 9, people blinking WISE epochs)" },
      { text: "Kirkpatrick, J. D., et al. 2014, ApJ 783, 122 (The AllWISE Motion Survey)" },
      GAIA_DR3,
    ],
  },
  {
    id: "fake-planet-lab",
    titleKey: "method.fakePlanetLabTitle",
    simpleKeys: ["method.fakePlanetLabSimple1", "method.fakePlanetLabSimple2"],
    detail: [
      { kind: "h", text: "method.fakePlanetLabDetail01" },
      { kind: "p", text: "method.fakePlanetLabDetail02" },
      { kind: "list", items: [
        "method.fakePlanetLabDetail03",
        "method.fakePlanetLabDetail04",
        "method.fakePlanetLabDetail05",
      ] },
      { kind: "h", text: "method.fakePlanetLabDetail06" },
      { kind: "formula", text: "F = Ω · Σ w_i · (I_i − B)", where: "method.fakePlanetLabDetail07" },
      { kind: "formula", text: "B = median of the 6–12 px ring after 3σ clipping        σ_B = its standard deviation", where: "method.fakePlanetLabDetail08" },
      { kind: "formula", text: "σ_F = Ω · √( Σ w_i² · VAR_i + A² · σ_B² / N_ring )        S/N = F / σ_F", where: "method.fakePlanetLabDetail09" },
      { kind: "h", text: "method.fakePlanetLabDetail10" },
      { kind: "p", text: "method.fakePlanetLabDetail11" },
      { kind: "h", text: "method.fakePlanetLabDetail12" },
      { kind: "p", text: "method.fakePlanetLabDetail13" },
      { kind: "h", text: "method.fakePlanetLabDetail14" },
      { kind: "p", text: "method.fakePlanetLabDetail15" },
      { kind: "h", text: "method.fakePlanetLabDetail16" },
      { kind: "p", text: "method.fakePlanetLabDetail17" },
    ],
    references: [
      SPHEREX_DOCS,
      { text: "Howell, S. B. 1989, PASP 101, 616 (two-dimensional aperture photometry and its signal-to-noise ratio)" },
      { text: "Merline, W. J. & Howell, S. B. 1995, Experimental Astronomy 6, 163 (a realistic model for the noise of aperture photometry)" },
      { text: "Pence, W. D., Seaman, R. & White, R. L. 2009, PASP 121, 414 (Rice compression of FITS images, used by the FLAGS plane)" },
      GAIA_DR3,
    ],
  },
  {
    id: "brightness",
    titleKey: "method.brightnessTitle",
    simpleKeys: ["method.brightnessSimple1", "method.brightnessSimple2"],
    detail: [
      { kind: "h", text: "method.brightnessDetail01" },
      { kind: "formula", text: "F_core = Ω · Σ_{d ≤ 2 px} (I_i − B)", where: "method.brightnessDetail02" },
      { kind: "formula", text: "F_ring = Ω · Σ_j N_j · ( mean of usable (I_i − B) in sub-ring j )", where: "method.brightnessDetail03" },
      { kind: "p", text: "method.brightnessDetail04" },
      { kind: "h", text: "method.brightnessDetail05" },
      { kind: "p", text: "method.brightnessDetail06" },
      { kind: "h", text: "method.brightnessDetail07" },
      { kind: "formula", text: "pair (a, b):  same detector,  | λ_a − λ_b | < 0.5 · Δλ        r = F_b / F_a", where: "method.brightnessDetail08" },
      { kind: "formula", text: "Δm = −2.5 · log₁₀( median r )", where: "method.brightnessDetail09" },
      { kind: "formula", text: "σ_Δm = max( 1.4826 · MAD , formal error ) / √N", where: "method.brightnessDetail10" },
      { kind: "p", text: "method.brightnessDetail11" },
      { kind: "h", text: "method.brightnessDetail12" },
      { kind: "list", items: [
        "method.brightnessDetail13",
        "method.brightnessDetail14",
      ] },
      { kind: "h", text: "method.brightnessDetail15" },
      { kind: "p", text: "method.brightnessDetail16" },
    ],
    references: [
      SPHEREX_DOCS,
      { text: "Howell, S. B. 1989, PASP 101, 616 (aperture photometry)" },
      { text: "Rousseeuw, P. J. & Croux, C. 1993, Journal of the American Statistical Association 88, 1273 (robust scale estimates; the 1.4826 factor of the MAD)" },
      { text: "Pogson, N. 1856, MNRAS 17, 12 (the magnitude scale, 5 mag = a factor of 100)" },
    ],
  },
  {
    id: "neighborhood",
    titleKey: "method.neighborhoodTitle",
    simpleKeys: ["method.neighborhoodSimple1", "method.neighborhoodSimple2"],
    detail: [
      { kind: "h", text: "method.neighborhoodDetail01" },
      { kind: "formula", text: "d [pc] = 1000 / ϖ [mas]", where: "method.neighborhoodDetail02" },
      { kind: "formula", text: "v_t [km/s] = 4.74 · μ [″/yr] · d [pc]", where: "method.neighborhoodDetail03" },
      { kind: "formula", text: "r(t) = r(t₀) + v · (t − t₀)", where: "method.neighborhoodDetail04" },
      { kind: "h", text: "method.neighborhoodDetail05" },
      { kind: "p", text: "method.neighborhoodDetail06" },
      { kind: "h", text: "method.neighborhoodDetail07" },
      { kind: "p", text: "method.neighborhoodDetail08" },
      { kind: "h", text: "method.neighborhoodDetail09" },
      { kind: "list", items: [
        "method.neighborhoodDetail10",
        "method.neighborhoodDetail11",
      ] },
      { kind: "h", text: "method.neighborhoodDetail12" },
      { kind: "p", text: "method.neighborhoodDetail13" },
    ],
    references: [
      GAIA_DR3,
      { text: "Lindegren, L., et al. 2021, A&A 649, A2 (Gaia EDR3 astrometric solution; RUWE and correlations)" },
      { text: "Luhman, K. L. 2014, ApJ 786, L18 (discovery of WISE J085510.83−071442.5)" },
      { text: "Luhman, K. L. & Esplin, T. L. 2014, arXiv:1409.5899 (parallax and proper motion of WISE 0855)", href: "https://arxiv.org/abs/1409.5899" },
    ],
  },
  {
    id: "sky-sonata",
    titleKey: "method.skySonataTitle",
    simpleKeys: ["method.skySonataSimple1", "method.skySonataSimple2"],
    detail: [
      { kind: "h", text: "method.skySonataDetail01" },
      { kind: "p", text: "method.skySonataDetail02" },
      { kind: "h", text: "method.skySonataDetail03" },
      { kind: "formula", text: "pan = 2x − 1", where: "method.skySonataDetail04" },
      { kind: "formula", text: "f = f_min · (f_max / f_min)^(1 − y)", where: "method.skySonataDetail05" },
      { kind: "formula", text: "t = x · T_scan", where: "method.skySonataDetail06" },
      { kind: "p", text: "method.skySonataDetail07" },
      { kind: "h", text: "method.skySonataDetail08" },
      { kind: "p", text: "method.skySonataDetail09" },
      { kind: "h", text: "method.skySonataDetail10" },
      { kind: "p", text: "method.skySonataDetail11" },
      { kind: "h", text: "method.skySonataDetail12" },
      { kind: "p", text: "method.skySonataDetail13" },
    ],
    references: [
      { text: "Zanella, A., et al. 2022, Nature Astronomy 6, 1241 (Sonification and sound design for astronomy research, education and public engagement)" },
      { text: "Web Audio API, W3C Recommendation", href: "https://www.w3.org/TR/webaudio/" },
      SPHEREX_DOCS,
    ],
  },
  {
    id: "comet-breath",
    titleKey: "method.cometBreathTitle",
    simpleKeys: ["method.cometBreathSimple1", "method.cometBreathSimple2"],
    detail: [
      { kind: "h", text: "method.cometBreathDetail01" },
      { kind: "p", text: "method.cometBreathDetail02" },
      { kind: "h", text: "method.cometBreathDetail03" },
      { kind: "formula", text: "F(λ) = Ω · Σ_{aperture} w_i · (I_i − B)", where: "method.cometBreathDetail04" },
      { kind: "p", text: "method.cometBreathDetail05" },
      { kind: "h", text: "method.cometBreathDetail06" },
      { kind: "p", text: "method.cometBreathDetail07" },
      { kind: "h", text: "method.cometBreathDetail08" },
      { kind: "p", text: "method.cometBreathDetail09" },
      { kind: "h", text: "method.cometBreathDetail10" },
      { kind: "p", text: "method.cometBreathDetail11" },
      { kind: "h", text: "method.cometBreathDetail12" },
      { kind: "p", text: "method.cometBreathDetail13" },
    ],
    references: [
      { text: "Lisse, C. M., et al. 2025, arXiv:2512.07318 (SPHEREx observations of 3I/ATLAS)", href: "https://arxiv.org/abs/2512.07318" },
      { text: "Lisse, C. M., et al. 2026, arXiv:2601.06759 (post-perihelion SPHEREx observations of 3I/ATLAS)", href: "https://arxiv.org/abs/2601.06759" },
      { text: "Lisse, C. M., et al. 2025, arXiv:2508.15469 (first analysis, superseded)", href: "https://arxiv.org/abs/2508.15469" },
      { text: "IRSA, SPHEREx observations of comet 3I/ATLAS", href: "https://irsa.ipac.caltech.edu/data/SPHEREx/docs/comet3iatlas/index.html" },
      { text: "JPL Horizons (distances at each observation time)", href: "https://ssd.jpl.nasa.gov/horizons/" },
    ],
  },
  {
    id: "candidates",
    titleKey: "method.candidatesTitle",
    simpleKeys: ["method.candidatesSimple1", "method.candidatesSimple2"],
    detail: [
      { kind: "h", text: "method.candidatesDetail01" },
      { kind: "p", text: "method.candidatesDetail02" },
      { kind: "h", text: "method.candidatesDetail03" },
      { kind: "list", items: [
        "method.candidatesDetail04",
        "method.candidatesDetail05",
        "method.candidatesDetail06",
        "method.candidatesDetail07",
      ] },
      { kind: "formula", text: "μ = separation / (t_SPHEREx − t_2MASS)", where: "method.candidatesDetail08" },
      { kind: "h", text: "method.candidatesDetail09" },
      { kind: "list", items: [
        "method.candidatesDetail10",
        "method.candidatesDetail11",
        "method.candidatesDetail12",
      ] },
      { kind: "p", text: "method.candidatesDetail13" },
      { kind: "h", text: "method.candidatesDetail14" },
      { kind: "p", text: "method.candidatesDetail15" },
      { kind: "h", text: "method.candidatesDetail16" },
      { kind: "p", text: "method.candidatesDetail17" },
    ],
    references: [
      TWOMASS,
      GAIA_DR3,
      { text: "Kirkpatrick, J. D., et al. 2014, ApJ 783, 122 (The AllWISE Motion Survey: finding moving objects from multi-epoch infrared positions)" },
      { text: "Luhman, K. L. 2014, ApJ 781, 4 (a search for a distant companion to the Sun with WISE)" },
      { text: "Batygin, K. & Brown, M. E. 2016, AJ 151, 22 (evidence for a distant giant planet in the Solar System)" },
      { text: "Górski, K. M., et al. 2005, ApJ 622, 759 (HEALPix, the sky cells used to pool ratings)" },
    ],
  },
  {
    id: "limits",
    titleKey: "method.limitsTitle",
    simpleKeys: ["method.limitsSimple1"],
    detail: [
      { kind: "list", items: [
        "method.limitsDetail01",
        "method.limitsDetail02",
        "method.limitsDetail03",
        "method.limitsDetail04",
        "method.limitsDetail05",
        "method.limitsDetail06",
      ] },
    ],
    references: [SPHEREX_DOCS],
  },
  {
    id: "sources",
    titleKey: "method.sourcesTitle",
    simpleKeys: ["method.sourcesSimple1", "method.sourcesSimple2"],
    detail: [
      { kind: "list", items: [
        "method.sourcesDetail01",
        "method.sourcesDetail02",
        "method.sourcesDetail03",
        "method.sourcesDetail04",
        "method.sourcesDetail05",
        "method.sourcesDetail06",
      ] },
      { kind: "h", text: "method.sourcesDetail07" },
      { kind: "list", items: [
        "method.sourcesDetail08",
        "method.sourcesDetail09",
        "method.sourcesDetail10",
        "method.sourcesDetail11",
        "method.sourcesDetail12",
      ] },
      { kind: "p", text: "method.sourcesDetail13" },
    ],
    references: [
      { text: "NASA/IPAC Infrared Science Archive (IRSA)", href: "https://irsa.ipac.caltech.edu/" },
      SPHEREX_DOCS,
      TWOMASS,
      WISE,
      NEOWISE,
      GAIA_DR3,
      { text: "Fernique, P., et al. 2015, A&A 578, A114 (HiPS, hierarchical progressive surveys)" },
      { text: "Dowler, P., et al. 2015, IVOA Recommendation: Simple Image Access 2.0", href: "https://www.ivoa.net/documents/SIA/" },
    ],
  },
];
