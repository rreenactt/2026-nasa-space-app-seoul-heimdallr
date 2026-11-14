# 김재현 (`rreenactt`) 현재 상태

> 본인 또는 본인의 AI만 고친다. 지난 작업은 쌓지 말고 최근 상태만 남긴다.
> 최종 갱신: 2026-11-14

## 담당

- 추가 분석 5개 모두 1차 구현: Comet Breath, Sky Time Machine, Fake Planet Lab, Neighborhood in Motion, Sky Sonata

## 진행 중

- 분석 패널: 기본 분석 자료를 다 받은 뒤 표시(진행바), 추가 분석은 "Download data"로 하나씩 받고 진행바·남은 시간 표시 → "Open" (결정 #31 제안)
- 분석 패널 기본 분석(블링크·차분·합산) 1차 구현, 파장 허용치 결정 #30 제안

## 완료

- Sky Sonata: 규칙 시험(좌우·높이·밝기, 같은 A/B → 같은 소리) 통과, 키보드·정지 동작 확인
- Neighborhood in Motion: 21개 천체, Barnard's Star 최근접 11,736년·1.155 pc(문헌과 일치), SPHEREx D6에서 Ross 128·Barnard 중심이 모델과 1.5″·4.1″
- 세 분석 1차 구현, 실제 데이터 검증(Barnard's Star 25년 이동 10.39″/년 = Gaia, 3I/ATLAS 12월 스펙트럼 24점)
- DR1 컷아웃 경로 확인: AWS 공개 버킷 바이트 범위 읽기 (`PLAN.md` 14장 메모)
- 결정 #26–28 제안 (팀 확인 필요)

## 막힘

- 공식 unWISE 시간분해 이미지가 공개되어 있지 않음 → 자체 합성으로 대체 (#26)
- IRSA 응답이 들쭉날쭉(503, 수십 초) → 사전 저장 계층 필요

## 다음 할 일

- Comet Breath·Sky Time Machine 화면 문구 영어화
- Sky Time Machine: SPHEREx 채널을 비교 미션 파장에 자동 맞춤, URL을 `/?ra=&dec=&fov=`로 통일
- 3I/ATLAS 특별 핀과 Comet Breath 연결, 링크에 분석·컷아웃 크기 파라미터(팀이 이름 결정)
