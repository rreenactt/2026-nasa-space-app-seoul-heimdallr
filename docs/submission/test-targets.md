# 테스트 대상 검증 결과 (draft)

> 챌린지 필수 항목인 테스트 대상 5개 검증 결과 표의 초안이다. 2026-11-15 Claude Code가 측정했고, 아직 사람이 검토하지 않았다.
> 쓰이는 곳: `details.md` Test targets 절, 슬라이드 6장. 숫자는 이 문서의 값만 쓴다.
> 측정 방법:
> - 로컬 프로덕션 빌드(`docs/deliverables-schedule`, main `fa402b4` 병합 상태)에서 앱의 API를 그대로 불렀다.
>   - `/api/blink/plan`: 방문, 검출기, 파장 선택
>   - `/api/fpl/frame`: 노출별 원래 픽셀 컷아웃
> - 측정은 앱의 `measureAt`(`app/_lib/fpl/checks.ts`)으로 했다.
>   - 조리개 반지름 2픽셀, 배경 고리 6–12픽셀
>   - 같은 함수로 FLAGS도 읽었다.
> - 위치 비교: 측정 위치 주변 5×5 픽셀의 빛 가중 중심을 구했다. 기준 위치와의 차이는 각초로 적는다.
> - 예측 위치:
>   - Gaia DR3 위치(2016.0)를 고유운동으로 각 노출 시각까지 옮겼다(시차 무시, 결정 #27과 같음).
>   - WISE 0855는 Luhman & Esplin 2014 값을 썼다(`app/_lib/nim/catalog.ts`와 같음).
> - IRSA DataLink와 SIA가 간헐적으로 502를 내는 중이었다. 실패한 요청은 성공할 때까지 다시 받았다.
> - 측정 스크립트는 레포에 넣지 않았다. 필요하면 정리해서 `scripts/`에 넣는다.
> - 2026-11-15 갱신: RW Aurigae와 R Draconis는 중심 조리개로는 포화로 잴 수 없지만, 그 뒤 들어간 Fake Planet Lab 밝기 탭(중심 바깥 고리 측정, 같은 파장끼리 방문 비교)으로 잰 결과를 더했다. 숫자 출처는 `docs/analyses/fake-planet-lab.md` 7장(검증)이다. 아래 노출별 표(중심 조리개)는 그대로 둔다.

---

## Summary table (English, for the submission)

| Target | What it tests | SPHEREx DR1 data used | Result |
| --- | --- | --- | --- |
| Barnard's Star | Fast proper motion (10.4″/yr) | 3 visits | Moves north in the blink and lines up with Gaia's predicted positions. Sky Time Machine measures 10.39″/yr over 23.81 years (247.4″), matching Gaia DR3. |
| Epsilon Indi B | Faint nearby brown dwarf, 4.7″/yr | D2, 1.107–1.112 µm, 6 exposures in 3 visits (Apr 2025 – Apr 2026) | Detected in every exposure (S/N 97–102) about 44–48″ from its 2016 Gaia position, within 1.1″ (0.2 pixel) of where Gaia's motion predicts. Nothing is left at the 2016 position (S/N −2.4 to 1.1). Over one year it moves 0.75 pixel, so the blink alone shows little; the match with Gaia is the evidence. |
| WISE 0855−0714 | Coldest known brown dwarf, not in Gaia, 8.1″/yr | D6, 4.61–4.63 µm, 4 exposures in 3 visits (Oct 2025 – Apr 2026) | Too faint in the default detector (D2, 1.45 µm). At 4.6 µm a faint signal sits at the predicted position (S/N 3.6–5.4 in three exposures, 2.9 in one), centered within 1.8″. A Gaia star (G = 16.3) lies 7.3″ away, so the two blend. The light peaks closer to WISE 0855's predicted position than to the star, but at this S/N we call it consistent with WISE 0855, not a confirmed detection. |
| RW Aurigae | Young star that varies in brightness | Core aperture: D1, 0.852–0.859 µm, 3 exposures in 2 visits. Ring: D1 and D4, 57 exposures | The center pixel is saturated (OVERFLOW) in every exposure, so a small aperture cannot be trusted (two exposures a week apart differ by 25%). Fake Planet Lab's brightness tab measures a ring outside the core instead and compares visits at the same wavelength: from September 2025 to March 2026 the 6–10 pixel ring changed by +2% (−0.024 ± 0.027 mag, 23 pairs) and the 10–15 pixel ring by −0.5%, so the result is "No change found". Its close companion RW Aur B is not resolved by SPHEREx's 6.2″ pixels. |
| R Draconis | Mira variable (bright) | Core aperture: D3, 2.17–2.23 µm, 6 exposures in 3 visits. Ring: D1, 0.75–1.1 µm, 27 exposures | Every pixel in a small aperture is flagged OVERFLOW and BLOOM, so the core cannot be measured. The core is saturated over more than 6 pixels, so the brightness tab picks a 6–10 pixel ring: from July to October 2025 the star faded by 0.62 ± 0.10 mag (ratio 0.57, 4 pairs), and the 10–15 pixel ring agrees (0.64 ± 0.09 mag, 5 pairs). A rerun in the app, which read more exposures, gave 0.83 ± 0.14 mag (7 pairs), the same direction. A Mira variable dimming over months is expected. Comparisons with the first visit have only 1–2 pairs and are reported as "Too few pairs to say". |

## What we learned (English)

- **Motion works where SPHEREx can see the object.** For Barnard's Star and Epsilon Indi B, SPHEREx positions agree with Gaia's predictions to a fraction of a pixel.
- **The blink needs time.** Between SPHEREx visits these stars move less than one pixel. Gaia predictions and the 25-year Sky Time Machine make the motion clear.
- **The detector matters.** WISE 0855 shows up only at 4.6 µm. The default detector (the one with the most exposures) does not show it.
- **Pins need dates.** The WISE 0855 pin uses its AllWISE position (about 2010). By late 2025 the object is 126″ (2.1′) away, outside the 3′ × 3′ analysis grid around the pin.
- **Bright variables saturate, but a ring can still compare them.** The cores of RW Aurigae and R Draconis are saturated, so a small aperture gives no reliable number and the tool shows the saturation flags instead. Measuring a ring outside the core, at the same wavelength in each visit, finds no change in RW Aurigae and a clear fading of R Draconis. Ring brightness follows the PSF size, so the slope across wavelengths is not the star's spectrum, and bloom left in the ring can change the value; we check that two rings agree.

## 측정 기록 (노출별)

### Epsilon Indi B: Gaia DR3 6412596012146801152

- Gaia DR3 (2016.0): RA 331.076453, Dec −56.793812, pmRA 3981.98, pmDec −2466.83 mas/yr, G 18.03
- 계획: `comparable`, D2, 기준 1.107 µm ± 0.013

| 방문 | 노출 | 연도 | 파장 (µm) | 플럭스 (mJy) | S/N | 예측 위치와의 차이 (RA, Dec) | 2016 위치 S/N |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 2025W17_4B_0027_3 | 2025.313 | 1.1070 | 14.19 ± 0.14 | 98.3 | +0.6″, −0.4″ | −2.4 |
| 1 | 2025W23_2B_0241_2 | 2025.430 | 1.1070 | 14.13 ± 0.14 | 102.2 | +0.5″, −0.3″ | 1.1 |
| 2 | 2025W40_1A_0603_1 | 2025.750 | 1.1099 | 13.66 ± 0.14 | 96.9 | 0.0″, −1.1″ | −2.3 |
| 2 | 2025W40_2B_0304_1 | 2025.756 | 1.1087 | 13.71 ± 0.14 | 99.7 | −0.3″, −0.5″ | −1.2 |
| 2 | 2025W41_2B_0173_1 | 2025.773 | 1.1087 | 13.73 ± 0.14 | 99.4 | 0.0″, −0.8″ | 0.0 |
| 3 | 2026W17_2A_0308_3 | 2026.312 | 1.1069 | 14.13 ± 0.14 | 100.5 | +0.7″, −0.2″ | −0.2 |

- 2번째 방문의 첫 노출은 조리개 안 2픽셀에 PERSIST 플래그가 있다. 나머지 노출은 SOURCE만 있다.
- 플럭스는 방문 사이에 약 3% 다르다(13.7–14.2 mJy). 파장이 0.003 µm 다른 영향과 측정 오차 수준이라 변광으로 보지 않는다.

### WISE 0855−0714: Gaia에 없음

- Luhman & Esplin 2014: MJD 56839.7(2014.4967) 위치 RA 133.7858505, Dec −7.2443176, pmRA −8100, pmDec +700 mas/yr
- 2025.9 예측 위치 RA 133.75999, Dec −7.24210. 핀(AllWISE 명칭 좌표, 2010년경)에서 126″ 떨어져 있다.
- 기본 계획(핀 좌표, 검출기 자동): `comparable`, D2, 1.447 µm. 이 파장에서는 너무 어둡고, 3′ 격자도 천체를 담지 못한다.
- D6 계획(핀 좌표, `detector=D6`): `comparable`, 기준 4.621 µm ± 0.018. 첫 방문(2025-05)은 허용치 안의 노출이 없다.

| 방문 | 노출 | 연도 | 파장 (µm) | 플럭스 (mJy) | S/N | 예측 위치와의 차이 | 핀 위치 S/N | Gaia 별 위치 S/N |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2 | 2025W46_1A_0090_3 | 2025.859 | 4.6130 | 0.49 ± 0.17 | 2.9 (low-snr) | −13.5″, −7.6″ | 2.1 | 2.9 |
| 2 | 2025W46_1A_0238_1 | 2025.860 | 4.6337 | 0.78 ± 0.18 | 4.5 | +0.1″, +0.3″ | 0.3 | 3.5 |
| 3 | 2025W50_2A_0232_1 | 2025.946 | 4.6336 | 0.78 ± 0.14 | 5.4 | −1.1″, +1.4″ | −1.4 | 4.7 |
| 4 | 2026W17_1B_0634_1 | 2026.308 | 4.6173 | 0.54 ± 0.15 | 3.6 | +0.6″, 0.0″ | 2.7 | 2.5 |

- 가까운 Gaia 별: Gaia DR3 5756956644387831296, G 16.31. 예측 위치에서 7.3″ 떨어져 있다(SPHEREx 픽셀 약 1.2개).
  - 이 별 위치에서 재면, 노출 4개 중 2개(2025W46_1A_0238_1, 2025W50_2A_0232_1)에서 빛 가중 중심이 WISE 0855 예측 위치 쪽(동쪽 +6.5″, 남쪽 −3.4″ 방향)으로 2–3″ 끌린다.
  - 노출 4개 중 3개에서 플럭스가 예측 위치보다 작다.
- AllWISE로 같은 자리를 확인하려 했지만 IRSA TAP이 응답하지 않아 확인하지 못했다.
- 결론: 후보 수준이다. 확정하려면 더 긴 시간 간격이나 PSF 맞춤으로 두 원천을 분리해야 한다.
- 이전 기록 "D6 5.0 µm 노출 하나에서 S/N 1.7"은 다른 노출과 다른 위치에서 잰 값이다. 이 표로 대체한다.

### RW Aurigae: Gaia DR3 156430822114424576 (RW Aur A)

- Gaia DR3: pmRA 2.64, pmDec −27.40 mas/yr, G 12.18
- 계획: `comparable`, D1, 기준 0.859 µm ± 0.011

| 방문 | 노출 | 연도 | 파장 (µm) | 플럭스 (mJy) | S/N | 품질 | 조리개 안 플래그 (픽셀 수) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 2025W36_1A_0606_1 | 2025.673 | 0.8587 | 42.0 ± 0.2 | 188 | flagged (masked) | SOURCE 20, OVERFLOW 1, BLOOM 2, TRANSIENT 1, SUR_ERROR 1 |
| 2 | 2026W10_1A_0445_1 | 2026.171 | 0.8582 | 105.6 ± 0.3 | 304 | ok | SOURCE 19, OVERFLOW 1, HALO 2, TRANSIENT 1, SUR_ERROR 1 |
| 2 | 2026W11_1A_0645_1 | 2026.192 | 0.8519 | 83.1 ± 0.3 | 269 | ok | SOURCE 20, OVERFLOW 1 |

- 세 노출 모두 중심 픽셀이 OVERFLOW다. 같은 방문 안 두 노출이 25% 다르므로, 방문 사이 차이(42 → 83–106 mJy)를 변광으로 주장하지 않는다.
- 다른 검출기는 확인하지 않았다. 긴 파장일수록 이 별(적외선 초과가 있는 젊은 별)이 더 밝아 포화가 심할 것으로 보이지만 확인하지 않은 추정이다.
- **고리 측정 (Fake Planet Lab 밝기 탭, 2026-11-15, `docs/analyses/fake-planet-lab.md` 7장):** D1·D4 57장. 중심 픽셀이 빠진 노출이 있어 고리로 잼. 방문 1(2025-09) → 방문 2(2026-03): 6–10px 고리 +2%(−0.024 ± 0.027등급, 짝 23개), 10–15px 고리 −0.5% → `No change found`. 3–6px 고리는 검출기별로 값이 갈려(D1 +26%, D4 −9%) 변화로 보지 않는다.

### R Draconis: Gaia DR3 1648328016354496384

- Gaia DR3: pmRA −20.64, pmDec 6.15 mas/yr, G 6.37
- 계획: `comparable`, D3, 기준 2.200 µm ± 0.028

| 방문 | 연도 | 파장 (µm) | 결과 | 조리개 안 플래그 (픽셀 수) |
| --- | --- | --- | --- | --- |
| 1 | 2025.417 | 2.1960 | 측정 불가 (masked) | OVERFLOW 21, BLOOM 21, SUR_ERROR 21 |
| 2 | 2025.999 | 2.1741 | 측정 불가 | OVERFLOW 19, BLOOM 18, NONFUNC 1 |
| 2 | 2026.007 | 2.1743 | 측정 불가 | OVERFLOW 21, BLOOM 20, NONFUNC 1 |
| 3 | 2026.306 | 2.1756 | 측정 불가 | OVERFLOW 21, BLOOM 21 |
| 3 | 2026.362 | 2.1751 | 측정 불가 | OVERFLOW 19, BLOOM 19 |
| 3 | 2026.362 | 2.2254 | 측정 불가 | OVERFLOW 21, BLOOM 20, TRANSIENT 1 |

- 중심 조리개로는 다른 검출기를 확인하지 않았다.
- **고리 측정 (Fake Planet Lab 밝기 탭, 2026-11-15, `docs/analyses/fake-planet-lab.md` 7장):** D1(0.75–1.1µm) 27장. 중심이 6px 넘게 포화되어 3–6px 고리는 못 잼 → 6–10px 고리 자동 선택. 방문 2(2025-07) → 방문 3(2025-10): 나중 ÷ 먼저 0.57, +0.62 ± 0.10등급 어두워짐(짝 4개, `Brightness changed`). 10–15px 고리도 0.55, +0.64 ± 0.09등급(짝 5개)으로 일치. 화면에서 다시 돌렸을 때(읽힌 노출이 더 많음)는 짝 7개, 0.47, +0.83 ± 0.14등급으로 같은 방향. 방문 1과의 비교는 짝이 1–2개라 `Too few pairs to say`. 보관소 502로 일부 노출은 읽지 못한 상태의 측정이다.

## 팀이 정할 것 (제안)

1. **WISE 0855 핀 좌표.** 지금은 AllWISE 2010년경 위치라 2025년 분석 격자 밖에 있다. 방법은 둘이다.
   - 핀을 SPHEREx 관측 시점의 예측 위치로 바꾼다. 절대 원칙 6에 따라 시점을 함께 표시한다.
   - 핀은 그대로 두고, 패널에 "이 천체는 지금 핀에서 2′ 서쪽에 있다"고 안내한다.
2. **WISE 0855 기본 검출기.** 테스트 대상을 열면 D6를 기본으로 하거나, 검출기 선택을 안내한다.
3. **포화 안내.** 밝은 변광성에서 FLAGS가 OVERFLOW이면 패널에 "포화로 중심 밝기 비교 불가, Fake Planet Lab 밝기 탭의 고리 측정을 보라"를 눈에 띄게 보여줄지 정한다.
