# Cycle27 독립 정상 UI — fix1

제품 `6b96543fdf980ff45f0e1b67f83e8a0a561a1542`, app SHA256 `55be6a0a47f4a116a3a19593320e09d3820bb5c46b07250dfda25efd78ccb691`. 계약 `4afe1ef.../INPUT.md`. Node22.16 / TS5.8.3 PATH 재사용(설치/npm ci 아님), 실제 Playwright1.57.0 / Chromium154.0.8037.57. loopback HTTP, MOCK만 사용. 정상 UI 격리 context, 실제 H/template 기반 명시 합성 보고, 저장소 주입 없음.

## 결과
- v0 한PC 취소 실패 원본은 별도 `3fda6dff.../independent-a/v0-cancel/` 그대로. 동일 의미/절차의 fix1 한PC는 취소 직후 `open=false`, textarea 실제 숨김, 정상 재열기. child0/외부0. v0 제품 기대 FAIL child1/외부1과 분리.
- 최신 단일 실행 PC1280×720·1440×900 **2/2 완주**. 작업 읽기와 지도 패널에서 취소/성공저장 직후 편집기 실제 닫힘 및 재열기 확인.
- 25의 A 표시30(U/N), 실제 보관7/배포금지(S/C)를 정상 UI로 준비. current=B인 동안 A stale 편집 안에서 A 소유 작업의 실제 네 값/직접 수정 표기와 구상·목적을 펼쳐 읽음. 네 값 각각 viewport/clip/hit 원시는 ui.jsonl. B를 A로 바꾸지 않음.
- 설명 편집을 열고 **입력 없이**, A 실제 작업 화면에서 next를 정상 편집한 뒤 돌아와 저장: inline 경고 실제 보임, 저장 전체 project 불변, 원래 설명 초안 보존. 취소→명시 재열기 후 동일 문장 저장은 r2→사용자r3(corrects2, 새 stamp), 지도에서 동일문장 성공저장은 r4(corrects3). 취소/기록 전후 대상 task/bases/sources/Area/소속/관계/구상 보존. broad work fingerprint가 r2를 stale로 만든 것을 유지하며 자동 stamp 덮어쓰지 않음.
- 실제 A 재정리 POST `currentAreaDescription={taskId:A,areaId:A,revision:4,by:user,corrects:3,source:null,text:정정문}` 확인. 실제 clipboard H의 A anchor/revision4와 work 네 값 대조, 표시30·동작7/배포금지 유지. MOCK 응답의 의미품질/AI 충돌 해결을 증명하지 않음.
- 이전 r1/r2 entry, H0/H1 네 값, 원보고, bases/sources/B는 불변. 정상 복귀 raw 두 쌍은 computed matrix/선택 동일, 2카드 x/y/w/h delta 모두0. 원시 scroll/focus도 `return-geometry.json`에 보존. 비초기 pan/zoom 전범위 시험이 아님.

최신 UI child0 / 외부collector0, fatal/pageerror/cleanup0. 서버 명시 종료 **-15**는 검증프로세스 종료와 별개. 30개 실제 HTTP 응답의 bodySHA=disk실행파일SHA=종료후diskSHA, 모든 추출 source는 pinned bytes와 전후 동일. 별도 typecheck child0, 기존 root/continuity build와 continuity check shell0. 개별 build의 별도 collector는 미제공이며 tool shell receipt와 구분한다. 전체 CI/역사 회귀는 실행하지 않음.

## 최초 검사 오류와 범위
첫 양PC 검사 시도는 1280에서 위 저장/충돌 경로까지 수행 후 POST의 실제 필드 `text`를 검사기가 `summary`로 읽어 KeyError/exit1. 코드/raw/PNG는 `first-transport-field-name-error/` 원형 보존. 그 필드명 및 exact A/task 대조만 보완한 최신 실행 2/2를 과거 부분 성공과 합산하지 않음. v0/fix1 좁은 probe의 source path/commit 교체 외 절차는 유지됐다.

보관/보류-only 우회채택·프로젝트간 draft·migration/restore·늦은 외부 수신 전체 순열·S/C/소속의 별도 후속 변경은 이 정상 UI 실행에서 미실행(별도 단위/CI 담당). UI 자동 의미판정·사람/초행 사용성·실제 AI·운영 성공을 주장하지 않음. 실제 summary의 open과 textarea visibility/화면을 함께 보며 단순 open property만 성공으로 세지 않았다. 화면에 보이는 '사용자 정정'도 앱 검증이나 정책 승격으로 해석하지 않는다.

## 회수
`result.json`: 최신 양PC만. `same-cancel-probe/`: fix1 동일 취소 장면. `first-transport-field-name-error/`: 첫 검사 오류. 큰 원시 JSONL만 무손실 gzip(mtime0), `RAW_INDEX.json`에 원/압축 bytes/SHA. PNG4는 원본, 마지막 지도 PNG는 패널의 당시 스크롤 위치이며 전문 전체가 한 화면에 보인다는 뜻이 아니다. `MANIFEST.tsv`는 자신을 제외한 payload 정확집합. `outer-exit.json`은 외부 tool completion 발췌이며 전체 tool transcript가 아님.
