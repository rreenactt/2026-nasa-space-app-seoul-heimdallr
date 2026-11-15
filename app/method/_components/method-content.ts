/**
 * Method page content. Each section has a plain explanation anyone can follow, and a full explanation (formulas,
 * reasons, measured checks) that opens on demand. The numbers come from docs/analyses/ and docs/PLAN.md; keep them
 * in step with those documents.
 */

export type MethodBlock =
  | { kind: "h"; text: string }
  | { kind: "p"; text: string }
  | { kind: "formula"; text: string; where?: string }
  | { kind: "list"; items: string[] };

export interface MethodReference {
  text: string;
  href?: string;
}

export interface MethodSection {
  id: string;
  title: string;
  /** Plain words, no formulas. */
  simple: string[];
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
    title: "Blink on a fixed sky grid",
    simple: [
      "SPHEREx photographs the same patch of sky again about every six months. We place those photos exactly on top of each other and flip between them, like a flip book. Stars that stay put look still. Something that moved, or changed brightness, seems to jump or flicker.",
      "The photos are always lined up on the sky itself, never on the object. If we re-centred each photo on the object, it would sit in the middle every time and its motion would disappear.",
    ],
    detail: [
      { kind: "h", text: "The grid" },
      { kind: "p", text: "Every exposure is resampled onto one grid fixed by the coordinates you chose: 3′ × 3′, 96 × 96 cells (1.875″ per cell), north up and east left. A SPHEREx pixel is 6.15″, so each native pixel covers about 3 × 3 cells. Values are interpolated bilinearly from the four nearest native pixels using the TAN-SIP world coordinate system written in each file." },
      { kind: "h", text: "What is shown" },
      { kind: "formula", text: "S(x, y) = IMAGE(x, y) − ZODI(x, y)", where: "ZODI is the zodiacal-light model delivered with each exposure. Sunlight scattered by dust in the Solar System changes with the season, so it is removed before visits are compared." },
      { kind: "formula", text: "V_k(x, y) = median over the exposures of visit k of S(x, y)", where: "A visit is a run of exposures with no gap longer than 20 days. The median rejects a cosmic-ray hit that appears in only one exposure." },
      { kind: "formula", text: "Difference_k = V_k − V_1        Stack = mean over k of V_k", where: "In the difference, an object that moved leaves a negative spot where it was and a positive spot where it is now. Zero is drawn grey." },
      { kind: "p", text: "All visits share one display range (the 1st to 99.5th percentile of all visits together). If each visit were stretched separately, a contrast change could look like a brightness change." },
      { kind: "h", text: "How far something must move" },
      { kind: "formula", text: "Δθ = μ · Δt", where: "μ is the proper motion (arcseconds per year) and Δt the time between visits. Barnard's Star, the fastest star in the sky, moves 10.4″ per year: about 5″, less than one SPHEREx pixel, between two visits." },
      { kind: "p", text: "We measured the position scatter between SPHEREx visits at about 9″, so SPHEREx alone cannot prove a motion of a few arcseconds. That is why the longer baselines of Sky Time Machine and the candidate search exist." },
      { kind: "h", text: "Known stars" },
      { kind: "formula", text: "α(t) = α₀ + μα* · (t − t₀) / cos δ₀        δ(t) = δ₀ + μδ · (t − t₀)", where: "Gaia DR3 stars (t₀ = 2016.0) are moved to the date of each visit and drawn as circles, so a known moving star is not mistaken for a new one. μα* already includes the cos δ factor. Parallax is ignored: it is far below one pixel." },
      { kind: "h", text: "Pixels that are hidden" },
      { kind: "p", text: "Only pixels flagged NONFUNC, MISSING_DATA, HOT, COLD, SUR_ERROR, TRANSIENT or SNOWBALL are masked. OUTLIER is kept on purpose: the pipeline marks anything that differs from its reference sky as an outlier, and a moving object is exactly that." },
      { kind: "h", text: "Checked on" },
      { kind: "p", text: "Barnard's Star: three visits, the star steps north between them and lands on the Gaia circle of each date." },
    ],
    references: [SPHEREX_DOCS, GAIA_DR3, WCS_PAPERS, { text: "Shupe, D. L., et al. 2005, ASP Conf. Ser. 347, 491 (the SIP distortion convention)" }],
  },
  {
    id: "same-detector",
    title: "Same detector, close wavelengths",
    simple: [
      "SPHEREx does not take one colour per photo. Its filter changes colour smoothly from one edge of the picture to the other, like a rainbow laid across the sensor. The same star is recorded in a different colour each time the telescope shifts.",
      "A star is not equally bright in every colour. So we only compare photos in which the spot you chose was seen in nearly the same colour. Otherwise a colour difference would look like the star changing.",
    ],
    detail: [
      { kind: "h", text: "The instrument" },
      { kind: "p", text: "SPHEREx has six detectors (D1 to D6) covering 0.75 to 5.0 µm. Each sits behind a linear variable filter (LVF): the wavelength that reaches a pixel depends on where the pixel is on the detector. One exposure is therefore not an image at one wavelength, and a full spectrum of a source is built up from many exposures as the sky drifts across the filter." },
      { kind: "formula", text: "λ = λ(x, y)        Δλ = Δλ(x, y)        R = λ / Δλ", where: "Both come from the WCS-WAVE lookup table in each file, interpolated bilinearly at the pixel of the chosen position. R, the resolving power, is roughly 40 on D1 to D4 and above 100 on D5 and D6." },
      { kind: "h", text: "The rule" },
      { kind: "formula", text: "| λ_exposure − λ_reference | ≤ 0.5 · Δλ", where: "Only exposures of one detector that satisfy this are compared. The reference wavelength is the one that keeps the largest number of visits. Up to three exposures per visit are used, nearest in wavelength first." },
      { kind: "h", text: "Why half a bandwidth" },
      { kind: "p", text: "Two exposures half a bandwidth apart still pass mostly the same light, so the flux of a smooth spectrum differs by a few percent at most. A full bandwidth apart they pass almost independent light, and a spectral line or a steep slope would appear as a false change. The value 0.5 is our working choice, not a published standard." },
      { kind: "h", text: "Knowing the wavelength before downloading" },
      { kind: "p", text: "The archive lists the four sky corners of every exposure. We project the chosen position onto the tangent plane, invert the bilinear map between those corners and the detector corners by Newton iteration, and read λ at that pixel from the table. The estimate agrees with the value read later from the file to about 0.001 µm, far inside the tolerance of 0.01 to 0.03 µm. Each downloaded file is checked again and dropped if it falls outside." },
    ],
    references: [
      { text: "Doré, O., et al. 2014, arXiv:1412.4872 (Cosmology with the SPHEREx All-Sky Spectral Survey)", href: "https://arxiv.org/abs/1412.4872" },
      { text: "Crill, B. P., et al. 2020, Proc. SPIE 11443, 114430I (SPHEREx: NASA's near-infrared spectrophotometric all-sky survey)" },
      SPHEREX_DOCS,
    ],
  },
  {
    id: "one-visit",
    title: "When there is only one visit",
    simple: [
      "One photo cannot show motion: there is nothing to compare it with. When SPHEREx has seen a place only once, we say so (\"Additional analysis needed\") instead of guessing.",
      "You can still compare that place with older sky surveys taken up to 25 years ago. Those comparisons use positions only, never brightness, because every survey sees different colours.",
    ],
    detail: [
      { kind: "p", text: "A position has a state: comparable (two or more usable visits on the chosen detector within the wavelength tolerance), additional analysis needed (one), or no observations (none). The count is of usable visits, not of exposures: twenty exposures taken within two weeks are still one visit." },
      { kind: "p", text: "Missing visits are never filled in. No frame is interpolated between dates, and a visit with no exposure inside the tolerance is listed as missing with the reason (off the detector, outside the wavelength tolerance)." },
      { kind: "p", text: "Brightness comparisons across surveys are not made, because 2MASS (1.2, 1.6, 2.2 µm), WISE (3.4, 4.6 µm) and a SPHEREx channel measure different light with different pixels and point-spread functions. A difference image between them would show the instruments, not the sky." },
    ],
    references: [SPHEREX_DOCS],
  },
  {
    id: "sky-time-machine",
    title: "Sky Time Machine: 25 years of the same sky",
    simple: [
      "The same patch of sky was photographed by 2MASS around 2000, by WISE in 2010, by NEOWISE from 2014 to 2024, and by SPHEREx from 2025. Sky Time Machine shows these photos in the order they were really taken.",
      "A slow star barely moves in six months, but over 25 years it travels far enough to see. You can click the star in each photo and the tool tells you how fast it crosses the sky.",
    ],
    detail: [
      { kind: "h", text: "Why a long baseline" },
      { kind: "formula", text: "σ_μ ≈ √(σ₁² + σ₂²) / Δt", where: "σ₁, σ₂ are the position errors at the two dates. The same position error gives a 50 times smaller motion error over 25 years than over six months." },
      { kind: "h", text: "Measuring a motion" },
      { kind: "formula", text: "Δθ = √( (Δα · cos δ)² + Δδ² )        μ = Δθ / Δt", where: "Δα, Δδ are the differences of the positions you marked; cos δ converts a difference in right ascension into a true angle on the sky." },
      { kind: "p", text: "Checked on Barnard's Star: 247.4″ in 23.81 years gives 10.39″ per year; Gaia DR3 gives 10.36″ per year." },
      { kind: "h", text: "Making the frames" },
      { kind: "list", items: [
        "Dates are the real observation times from the archive (t_min, t_max), not release dates.",
        "Exposures of one band are grouped into passes with the 20-day rule.",
        "WISE and NEOWISE: time-resolved coadded images are not published as images, so for each pass up to five single exposures are scaled to a common zero point (MAGZP 22.5), their median background is removed, and the per-pixel median is taken. The screen labels this as a coadd computed by this tool.",
        "2MASS: up to four Atlas tiles of the same night. SPHEREx: one exposure per pass, with its wavelength at the field centre shown.",
        "Every frame is resampled from its own TAN or SIN (with SIP) world coordinate system onto one 256 × 256 grid, north up. Cells with no data are hatched, not painted black.",
      ] },
      { kind: "h", text: "Alignment check" },
      { kind: "p", text: "Gaia stars moved to each date land within 0.06″ (2MASS, 2000.4), 0.2″ (WISE, 2010.2), 0.5″ (NEOWISE) and 0.35″ (SPHEREx, 2025.6) of the image positions, with a scatter of 0.3 to 1.0″ on a 1.88″ grid." },
      { kind: "h", text: "Limits" },
      { kind: "p", text: "Positions only. Star images differ in size between missions (2″ to 6″ pixels), which is not motion. Bright stars saturate in 2MASS and WISE and their centre can be off by several arcseconds (about 9″ for Barnard's Star in W1)." },
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
    title: "Fake Planet Lab: real dot or defect?",
    simple: [
      "Not every dot in a space photo is a star. A particle from space can hit the sensor and leave a bright speck. A very bright star can overflow its pixels, leave a faint ghost elsewhere, or leave an after-image in the next photo.",
      "Fake Planet Lab runs a checklist on the dot you click: did the camera mark this pixel as bad, is the dot clearly brighter than the noise, is it shaped like a star, and does it show up again in another photo? A clean checklist does not prove the dot is a real object. It only means these checks found no problem.",
    ],
    detail: [
      { kind: "h", text: "Quality flags" },
      { kind: "p", text: "Each pixel carries a bit field (FLAGS). Bit numbers are read from each file's header (MSKNnnnn, MSKDnnnn), not hard-coded, and unknown bits are reported as unknown. They are grouped by what they mean for a measurement:" },
      { kind: "list", items: [
        "Left out of the measurement: NONFUNC, MISSING_DATA, HOT, COLD, SUR_ERROR.",
        "Contamination warnings: saturation, cosmic rays, ghosts, persistence, crosstalk, streaks.",
        "Context only: OUTLIER. A moving object is also an outlier, so it is never counted as a defect.",
      ] },
      { kind: "h", text: "Signal against noise" },
      { kind: "formula", text: "F = Ω · Σ w_i · (I_i − B)", where: "Sum over the pixels of a circular aperture of radius 2 px. w_i is the fraction of pixel i inside the circle, I_i the surface brightness (MJy/sr), B the background, Ω the solid angle of a pixel. MJy/sr × sr gives a flux density, shown in mJy." },
      { kind: "formula", text: "B = median of the 6–12 px ring after 3σ clipping        σ_B = its standard deviation", where: "Clipping removes other stars that happen to sit in the ring." },
      { kind: "formula", text: "σ_F = Ω · √( Σ w_i² · VAR_i + A² · σ_B² / N_ring )        S/N = F / σ_F", where: "VAR_i is the per-pixel variance delivered by the pipeline, A the aperture area in pixels, N_ring the number of ring pixels. The second term is the uncertainty of the background itself. S/N below 3 is reported as not significant." },
      { kind: "h", text: "Shape" },
      { kind: "p", text: "For S/N ≥ 10 the second moments of the background-subtracted light within 3 px give a size (FWHM) and an elongation, compared with the point-spread function size in the header. A cosmic ray is usually sharper than a star; a ghost or a blend is wider or stretched. Ratios above 1.6 raise a caution." },
      { kind: "h", text: "Repetition" },
      { kind: "p", text: "A real fixed source is in every exposure; a cosmic-ray hit is in one. The tool measures the same sky position in other exposures and reports the S/N found there, and whether the comparison is fair (same detector, wavelength within the bandwidth, time apart)." },
      { kind: "h", text: "Bright neighbours" },
      { kind: "p", text: "Gaia DR3 stars brighter than G = 10 within 2′, moved to the date of the exposure, are listed because they cause ghosts and bleeding." },
      { kind: "h", text: "Verdict" },
      { kind: "p", text: "Quality issue found, Needs further review, or No issue found in current checks. A check that could not be run is shown as Not checked, never as passed. On the core of Barnard's Star the tool reports saturation and transient flags and finds the star itself (G 8.2) as the bright neighbour. Four ordinary stars nearby measure 7.4 to 11.0″ across against a 7.4″ point-spread function." },
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
    title: "Brightness between visits",
    simple: [
      "Some stars get brighter and dimmer over months. To see that, we measure how much light arrives from the star in every photo, and compare photos from two visits that saw it in the same colour.",
      "Very bright stars overflow the middle of their image, like an overexposed photo, so the middle cannot be measured. For those we measure the faint glow around the star instead. The glow gets brighter and dimmer together with the star.",
    ],
    detail: [
      { kind: "h", text: "Two measurements" },
      { kind: "formula", text: "F_core = Ω · Σ_{d ≤ 2 px} (I_i − B)", where: "All usable pixels within 2 px of the position. B is the 3σ-clipped median of a ring 20–28 px away." },
      { kind: "formula", text: "F_ring = Ω · Σ_j N_j · ( mean of usable (I_i − B) in sub-ring j )", where: "The ring is split into 1-px-wide sub-rings j with N_j pixels each. Using the mean times the full pixel count keeps a few masked pixels from shifting the sum toward the fainter outer part. A sub-ring with fewer than half of its pixels usable is not measured." },
      { kind: "p", text: "Rings of 3–6, 6–10 and 10–15 px are tried. If any exposure lost a pixel within 1 px of the centre, the core is only a lower limit, and the innermost ring that works in at least 80% of the exposures is used instead." },
      { kind: "h", text: "Why the ring works" },
      { kind: "p", text: "A point source is spread over the detector by the point-spread function (PSF). For a fixed wavelength and detector the PSF has a fixed shape, so the light in any ring is a fixed fraction f of the total: F_ring = f · F_total. The ratio of two ring measurements at the same wavelength therefore equals the ratio of the total fluxes, even though f itself is unknown. This is also why ring brightness is relative and cannot be compared across wavelengths: f changes with wavelength." },
      { kind: "h", text: "Comparing two visits" },
      { kind: "formula", text: "pair (a, b):  same detector,  | λ_a − λ_b | < 0.5 · Δλ        r = F_b / F_a", where: "Each exposure is used once, closest wavelengths first." },
      { kind: "formula", text: "Δm = −2.5 · log₁₀( median r )", where: "The change in magnitudes. Positive means fainter in the later visit. 0.1 mag is about 10%." },
      { kind: "formula", text: "σ_Δm = max( 1.4826 · MAD , formal error ) / √N", where: "MAD is the median absolute deviation of the pairs' magnitudes; 1.4826 · MAD estimates the standard deviation without being pulled by a few bad pairs. Using the scatter of the pairs themselves includes errors the formal variance misses, such as leftover saturation." },
      { kind: "p", text: "The result reads Brightness changed only with at least 3 pairs, |Δm| ≥ 0.05 mag and |Δm| ≥ 3 σ_Δm. Otherwise it reads No change found or Too few pairs to say. It states what was measured at this position, not the cause." },
      { kind: "h", text: "Checked on (15 November 2026)" },
      { kind: "list", items: [
        "R Draconis, a Mira variable, detector D1 (0.75–1.1 µm): saturated beyond 6 px, so the 6–10 px ring was chosen. July 2025 to October 2025: ratio 0.57, +0.62 ± 0.10 mag fainter over 4 pairs; the 10–15 px ring gives 0.55, +0.64 ± 0.09 mag. A later run with more exposures gave +0.83 ± 0.14 mag over 7 pairs, the same direction.",
        "RW Aurigae, detectors D1 and D4: September 2025 to March 2026, +2% (−0.024 ± 0.027 mag) over 23 pairs: no change found. The innermost ring disagreed between detectors and was not taken as a change.",
      ] },
      { kind: "h", text: "Limits" },
      { kind: "p", text: "No aperture correction and no PSF fitting. Bleeding from a saturated core can reach a ring, so a change is more convincing when a second ring shows it too. A neighbour inside the ring changes the number as well." },
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
    title: "Neighborhood in Motion: the nearest stars in 3D",
    simple: [
      "The stars closest to the Sun are not fixed. Each one travels through space in its own direction. This tool places the 21 nearest known stars and brown dwarfs in a 3D map using their measured distances and speeds, and lets you run time forward and backward.",
      "It also works out where one of these stars should be on the day SPHEREx looked, and shows whether the SPHEREx photo has light at that spot.",
    ],
    detail: [
      { kind: "h", text: "From measurements to a position in space" },
      { kind: "formula", text: "d [pc] = 1000 / ϖ [mas]", where: "ϖ is the parallax: the small yearly shift of a nearby star caused by the Earth going around the Sun. One parsec is 3.26 light-years." },
      { kind: "formula", text: "v_t [km/s] = 4.74 · μ [″/yr] · d [pc]", where: "The speed across the sky from the proper motion μ. The factor 4.74 converts one astronomical unit per year into km/s. The speed along the line of sight, v_r, comes from the Doppler shift of the spectrum." },
      { kind: "formula", text: "r(t) = r(t₀) + v · (t − t₀)", where: "Straight-line motion at constant velocity in the barycentric ICRS frame, with t₀ = 2016.0 for Gaia DR3. Closest approach to the Sun is the minimum of |r(t)|." },
      { kind: "h", text: "What is measured and what is assumed" },
      { kind: "p", text: "Six objects have no measured radial velocity (WISE 0855, Wolf 359, Sirius B, ε Eridani, Ross 128, ε Indi B). The value is not stored as zero: an assumed value (0 km/s by default, adjustable) is used only to draw the path, and that path is dashed." },
      { kind: "h", text: "Uncertainty" },
      { kind: "p", text: "Parallax and proper motion from Gaia are correlated. The covariance matrix is built from Gaia's errors and correlation coefficients, samples are drawn from it, and the spread of the resulting paths gives the 5–95% range. Objects with a large RUWE (a sign that a single-star fit is poor, often a binary) carry a warning." },
      { kind: "h", text: "Checked on" },
      { kind: "list", items: [
        "Barnard's Star: closest approach in the year 11,736 at 1.155 pc (3.77 light-years), range 11,732 to 11,740.",
        "SPHEREx detector D6: Ross 128 with S/N 338 and a centroid 1.5″ from the model; Barnard's Star with S/N 242 at 4.1″ (one pixel is 6.15″). WISE 0855 gave S/N 1.7 in one exposure and no centroid, and is shown that way.",
      ] },
      { kind: "h", text: "Limits" },
      { kind: "p", text: "No Galactic gravity and no binary orbits, so paths thousands of years away are for illustration. The observer's own parallax (up to 0.77″) is left out because it is far below a SPHEREx pixel. Light at the model position is not proof that this object was detected: another source can sit there." },
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
    title: "Sky Sonata: listening to an image",
    simple: [
      "Sky Sonata turns a SPHEREx image into sound so the sky can be explored by ear. A line sweeps across the image from left to right. Each light source plays a note as the line passes it: higher in the image is a higher note, brighter is louder, and left or right decides which ear hears it.",
      "These are not sounds recorded in space. Space is silent. It is the image translated by fixed rules, which the page shows in full.",
    ],
    detail: [
      { kind: "h", text: "Finding the sources" },
      { kind: "p", text: "On native pixels, independent of the display contrast: IMAGE − ZODI minus the 3σ-clipped sky median; a peak counts when it is at least 5σ and its 3 × 3 sum also has S/N ≥ 5. Brightness is the 3 × 3 sum in mJy. Connected saturated pixels are merged into one saturated source." },
      { kind: "h", text: "The rules (sonata-rules-1)" },
      { kind: "formula", text: "pan = 2x − 1", where: "x is the horizontal position from 0 (left) to 1 (right); pan −1 is the left ear, +1 the right." },
      { kind: "formula", text: "f = f_min · (f_max / f_min)^(1 − y)", where: "y is the vertical position from 0 (top) to 1 (bottom); by default 220 to 1760 Hz, three octaves. The scale is exponential because hearing judges pitch by ratios: equal steps on the image become equal musical intervals." },
      { kind: "formula", text: "t = x · T_scan", where: "The time of the note within the sweep (6 s by default). Scan time is not observation time." },
      { kind: "p", text: "Loudness is a logarithmic compression of the flux with an upper limit, because stars span factors of thousands in brightness while comfortable loudness does not. A saturated source plays a square wave (its brightness cannot be trusted), and missing data plays a low double click." },
      { kind: "h", text: "Comparing two exposures" },
      { kind: "p", text: "Exposures A and B are played with the same rules and one shared brightness range computed from both. Normalising each separately would make a fainter exposure sound as loud as a brighter one. A warning is given when their wavelengths at the field centre differ by more than the bandwidth." },
      { kind: "h", text: "Checked on" },
      { kind: "p", text: "Two points that differ only left and right give pan −0.8 and +0.8 with equal pitch and loudness; only up and down, 1430 and 271 Hz; only brightness, loudness 0.07 and 0.29. The same image given as A and B produces identical sound events." },
      { kind: "h", text: "Limits" },
      { kind: "p", text: "The number of sources played is capped, so silence is not an empty sky. Changes between A and B are not detected automatically; the listener judges." },
    ],
    references: [
      { text: "Zanella, A., et al. 2022, Nature Astronomy 6, 1241 (Sonification and sound design for astronomy research, education and public engagement)" },
      { text: "Web Audio API, W3C Recommendation", href: "https://www.w3.org/TR/webaudio/" },
      SPHEREX_DOCS,
    ],
  },
  {
    id: "comet-breath",
    title: "Comet Breath: gases from an interstellar comet",
    simple: [
      "3I/ATLAS is a comet that came from another star system. As it nears the Sun its ice turns to gas. Each gas glows in its own infrared colours, like a fingerprint, and SPHEREx sees 102 colours.",
      "This tool shows SPHEREx images and spectra of the comet from before (August 2025) and after (December 2025) its closest pass to the Sun, next to the gas release rates that researchers published.",
    ],
    detail: [
      { kind: "h", text: "A moving target" },
      { kind: "p", text: "A comet has no fixed coordinates. For every exposure the predicted position of the comet at that time, from IRSA's dedicated 3I/ATLAS observation list, is used." },
      { kind: "h", text: "Photometry" },
      { kind: "formula", text: "F(λ) = Ω · Σ_{aperture} w_i · (I_i − B)", where: "Aperture radius 2 px (12″, as in the published analysis), background from a 10–29 px ring (1′ to 3′) with 3σ clipping. Each measurement is placed at the wavelength of the comet's pixel, read from the WCS-WAVE table." },
      { kind: "p", text: "The points of many dates form a period-composite spectrum. They are not interpolated or joined into one curve." },
      { kind: "h", text: "The OUTLIER lesson" },
      { kind: "p", text: "The pipeline flags the comet's bright centre as OUTLIER because a moving coma is not in its reference sky. Masking those pixels made our first CO₂ flux about 93% too low. They are now kept inside the aperture and masked only in the background ring." },
      { kind: "h", text: "The molecular bands" },
      { kind: "p", text: "Molecules absorb sunlight and re-emit it at the wavelengths of their vibrations: H₂O near 2.7 µm, CO₂ at 4.26 µm, CO near 4.7 µm. In December the measured flux rises above the neighbouring continuum at 4.21 µm (39 mJy) and 4.65 µm (46 mJy), the same direction as the published CO₂ and CO emission." },
      { kind: "h", text: "Production rates" },
      { kind: "p", text: "The rates Q (molecules released per second) are quoted from the papers, not computed here. Turning a band flux into Q needs a fluorescence efficiency and a coma model. Each published value is tied to the period it was derived for, and upper limits are drawn as arrows." },
      { kind: "h", text: "Limits" },
      { kind: "p", text: "Fluxes are not scaled to a standard distance (1 au from the Sun and from the observer), so their absolute values cannot be compared directly with the figures in the papers. SPHEREx observed the comet only on 1–15 August and 8–14 December 2025; nothing is shown for the time around perihelion." },
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
    title: "How candidates are found, and how they are rated",
    simple: [
      "A program compares where things are in SPHEREx images today with where the 2MASS survey saw them about 25 years ago. If a source seems to have left one spot and appeared at another nearby, that pair becomes a candidate.",
      "Most pairs have an ordinary explanation, so each is checked against the Gaia star catalogue. What is left is only a candidate for people to look at. It is not a discovery. People then rate what they see, and other ratings stay hidden until you have given yours.",
    ],
    detail: [
      { kind: "h", text: "Why SPHEREx against 2MASS" },
      { kind: "p", text: "Between SPHEREx visits the position scatter is about 9″, more than even Barnard's Star moves in a year. Over the 25 years back to 2MASS the same star moves about 260″." },
      { kind: "h", text: "The pipeline (sx2mass-4)" },
      { kind: "list", items: [
        "SPHEREx: the detector nearest the 2MASS Ks band (D3 first), exposures within ±0.5 × bandwidth, IMAGE − ZODI, a fixed 8′ grid, the median per visit. Only 5σ sources found in every visit are kept.",
        "2MASS: the Point Source Catalog with the observation date of each source. Bright stars seen in both are used to align the SPHEREx positions.",
        "Minimum motion for a field: the larger of 8″ and 2.5 times the remaining alignment scatter.",
        "A pair: a SPHEREx source with S/N ≥ 20 that has no 2MASS source at its position, and a 2MASS source (Ks ≤ 14.5, quality A or B) with nothing at its position in SPHEREx now, separated by the minimum motion up to 90″, with brightness within a factor of 3.",
      ] },
      { kind: "formula", text: "μ = separation / (t_SPHEREx − t_2MASS)", where: "With a 25-year baseline, 8″ to 90″ corresponds to roughly 0.3 to 3.6″ per year." },
      { kind: "h", text: "Checking both ends against Gaia" },
      { kind: "list", items: [
        "Known moving star: one Gaia DR3 star, moved to both dates, explains both ends. An independent re-detection, not a new object.",
        "Chance pair: a Gaia star sits at only one end, for example a fixed star that SPHEREx missed.",
        "Unidentified: no Gaia star explains either end. A candidate for human review.",
      ] },
      { kind: "p", text: "For each field the expected number of chance pairs, from the density of sources there, is stored with the result." },
      { kind: "h", text: "What it found so far" },
      { kind: "p", text: "Control sample: of 12 stars with proper motions of 0.5 to 3″ per year, 8 were recovered as known moving stars, with speeds within 1 to 8% of Gaia; two faster than 1.4″ per year and some bright stars were missed. First survey (15 November 2026): 75,756 random fields, 41 failed; 5,384 pairs, of which 262 known moving stars (median speed difference from Gaia 4.3%), 5,081 chance pairs and 41 unidentified. 23 of the 41 lie near the Galactic plane, where chance pairs are most likely, and some may be Gaia stars without a published proper motion." },
      { kind: "h", text: "Rating" },
      { kind: "p", text: "Ratings are Moving, Not moving, or Noise or artifact, one per browser, pooled over a fixed sky cell about 1.7′ across. Other people's ratings appear only after you rate, so they cannot sway you. Candidates with low ratings leave the list but are never deleted." },
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
    title: "Limits of the search",
    simple: [
      "This tool cannot see everything. Something that moves very slowly, is very faint, or sits in a crowded part of the sky can be missed. When nothing is found, that means nothing was found above these limits, not that nothing is there.",
    ],
    detail: [
      { kind: "list", items: [
        "SPHEREx alone: pixels of 6.15″ and a position scatter of about 9″ between visits. Motions of a few arcseconds per year are not measurable from SPHEREx visits only.",
        "Candidate search: motions between the field's minimum (at least 8″ in 25 years, about 0.3″ per year) and 90″ (about 3.6″ per year). Sources must reach S/N ≥ 20 in SPHEREx and Ks ≤ 14.5 in 2MASS.",
        "A distant planet beyond Neptune: this tool has not searched for one in a way that could rule it out, and makes no claim about it.",
        "Brightness changes: at least 3 matched pairs, 0.05 mag and 3σ. In our tests the scatter set the limit near 0.1 mag.",
        "Saturated stars: the core cannot be measured; positions from 2MASS and WISE can be off by several arcseconds.",
        "Coverage: SPHEREx DR1 spans about a year, so a place has a few visits at most and some have one. The first candidate survey sampled 75,756 random fields, not the whole sky.",
      ] },
    ],
    references: [SPHEREX_DOCS],
  },
  {
    id: "sources",
    title: "Data sources and credits",
    simple: [
      "SPHEREx images come from NASA's infrared archive IRSA (data release DR1, or QR3 where DR1 has nothing). Older images come from the 2MASS, WISE and NEOWISE surveys, and star positions and motions from ESA's Gaia mission. The original image files are linked, never stored here.",
      "The sky you browse is, for now, a 2MASS picture, not SPHEREx: the SPHEREx colour map we planned to use is offline. It is only there to find your way around. The blink and every analysis use SPHEREx images.",
    ],
    detail: [
      { kind: "list", items: [
        "SPHEREx DR1: found with IRSA SIA2 and DataLink; pixels are read by HTTP byte range from the public AWS copy of the L2b files (IMAGE, FLAGS, VARIANCE, ZODI, WCS-WAVE), only the rows around the chosen position.",
        "Background sky of the 3D view: for now the 2MASS J, H, Ks colour HiPS mirrored by IRSA, used for browsing only and never for analysis.",
        "2MASS Atlas images and Point Source Catalog; WISE, AllWISE and NEOWISE single exposures; all from IRSA.",
        "Gaia DR3 from the ESA Gaia Archive, with IRSA as fallback.",
        "Known asteroids: JPL and the Minor Planet Center (reference; an overlay on the images is not built yet).",
        "Comet 3I/ATLAS: IRSA's dedicated observation list and JPL Horizons.",
      ] },
      { kind: "h", text: "Why the background is 2MASS" },
      { kind: "list", items: [
        "The plan: the SPHEREx QR2 colour HiPS published by CDS (Strasbourg). CDS has been offline since a cybersecurity incident on 9 November 2026, and no other archive mirrors that map.",
        "IRSA's own SPHEREx DR1 all-sky map is reachable, but it shows one wavelength at a time, without colour, and its finest level is about 13″ per pixel, which turns blurry when you zoom in.",
        "2MASS (1.2–2.2 µm) covers the whole sky in colour, stays sharp when zoomed in, and lies inside the SPHEREx range (0.75–5 µm), so dusty regions look like they do in the SPHEREx panels. DSS2 colour from the same mirror looks more familiar but is visible light (0.4–0.6 µm), outside that range.",
        "2MASS was observed in 1997–2001. A star with a large proper motion, such as Barnard's Star, sits in the background where it was then, not where SPHEREx saw it in 2025.",
        "When CDS serves the SPHEREx tiles again, the background switches back.",
      ] },
      { kind: "p", text: "This project is not affiliated with or endorsed by NASA. It uses public data from the missions and archives listed here." },
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
