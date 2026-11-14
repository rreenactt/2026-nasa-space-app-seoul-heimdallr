# 김재현 (`rreenactt`) 현재 상태

> 본인 또는 본인의 AI만 고친다. 지난 작업은 쌓지 말고 최근 상태만 남긴다.
> 최종 갱신: 2026-11-14

## 담당

- 추가 분석: Comet Breath, Sky Time Machine, Fake Planet Lab (1차 구현)

## 진행 중

- 브랜치 `feat/comet-breath-sky-time-machine`: 세 분석을 홈의 독립 팝업으로 구현. 분석 패널(5장)과 연결 전

## 완료

- 세 분석 1차 구현, 실제 데이터 검증(Barnard's Star 25년 이동 10.39″/년 = Gaia, 3I/ATLAS 12월 스펙트럼 24점)
- DR1 컷아웃 경로 확인: AWS 공개 버킷 바이트 범위 읽기 (`PLAN.md` 14장 메모)
- 결정 #26–28 제안 (팀 확인 필요)

## 막힘

- 공식 unWISE 시간분해 이미지가 공개되어 있지 않음 → 자체 합성으로 대체 (#26)
- IRSA 응답이 들쭉날쭉(503, 수십 초) → 사전 저장 계층 필요

## 다음 할 일

- Comet Breath·Sky Time Machine 화면 문구 영어화
- Sky Time Machine: SPHEREx 채널을 비교 미션 파장에 자동 맞춤, URL을 `/?ra=&dec=&fov=`로 통일
- 분석 패널·3I/ATLAS 특별 핀과 연결
