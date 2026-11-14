# High-Level Summary (draft)

> 제출 항목: High-Level Summary, 영어 50–200단어. 초안 2026-11-15 (Claude Code 작성, 사람 검토 전).
> 기능 동결(15:00) 뒤 실제로 들어간 기능에 맞춰 다시 고친다. 아래 본문만 붙여넣는다.

---

HEIMDALLR is a public web tool for seeing how the sky changes in NASA's SPHEREx survey. Visitors explore an all-sky view, click any point or type its RA/Dec, and the tool plays the SPHEREx DR1 images of that patch as a blink animation, with difference and stack views beside it. Each comparison uses only exposures from the same detector at matching wavelengths, because SPHEREx's linear variable filters change wavelength across every image, and all frames sit on a fixed sky grid so real motion is never centered away. Gaia DR3 positions moved to each visit's date separate known stars from anything new, and quality flags warn about artifacts. Five additional analyses go further: a 25-year comparison with 2MASS, WISE and NEOWISE; a checker for defects that mimic moving objects; a 3D map of nearby stars; a sonification; and spectra of interstellar comet 3I/ATLAS. Machines suggest where to look and people check. Results are always called candidates, and missing data is shown as missing.

---

- 단어 수: 163 (50–200)
- [TODO] 기능 A(움직임 후보 추천)·기능 B(사용자 평가)가 동결 전에 들어가면 "Machines suggest where to look and people check" 문장을 실제 동작으로 구체화한다. 안 들어가면 이 문장을 "is designed so that"으로 낮추거나 뺀다.
