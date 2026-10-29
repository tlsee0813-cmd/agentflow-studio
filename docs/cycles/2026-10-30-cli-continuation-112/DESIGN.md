# 112 결정 — 소유 CLI의 map.6 후속 읽기를 명시 opt-in으로 허용

[111](../2026-10-30-return-reading-111/RESULT.md)의 후속 대조는 DeepSeek 경로에서 완결 응답 없이 반려됐고, 102 소유 CLI는 첫 지도만 받았다. 112는 102의 실행·보관·검증 경로를 그대로 두고 **실행 범위(scope)** 하나만 정책에 더한다. 새 worker·store·codec·queue·lifecycle은 없다. 기준 83d545dc5192a86556cfaffb70a6ec86526eda14(app 5736b7949d50ba92c07ae583ff22c618c25c3e94).

## 범위 선택

- 정책 파일의 `scope`: 없거나 `"first"`면 기존과 같다(첫 지도만, 정책 hash도 112 이전과 동일). `"map6-later"`면 studio.map.6의 후속 읽기(부분·고정 요청·prior가 있는 ask)도 받는다. 다른 값은 정책 오류로 실행자를 열지 않는다. `map6-later`는 정책 hash에 포함된다.
- 범위는 서버 정책 파일에서만 정한다. 브라우저 입력은 범위·실행 파일·인자·권한·시간·model을 고를 수 없다. 기본 DeepSeek·Worker·공개 경로는 바뀌지 않는다.
- 거절: first 범위에서 첫 지도가 아닌 ask는 `EXECUTOR_SCOPE`(기존), map6-later 범위에서 map.6이 아닌 ask는 `EXECUTOR_SCHEMA`. 모두 접수(기록) 전이며 child는 0이다.

## 접수 결속과 실행 직전 재확인

- 접수(prepare) 때 실행 binding에 정책 hash와 `scope`, 그리고 그 ask에 대해 `map6Prompt(ask)`가 실제로 고른 지침의 종류(`promptKind` first/later), 전체 SHA-256(`promptSha256`), 짧은 id(`prompt`, 첫 지도는 112 이전과 같은 값), ask JSON의 SHA-256(`askSha256`)을 원 operation과 함께 저장한다. 후속 읽기를 첫 지도 지침 hash로 기록하지 않는다.
- 실행(call) 직전, lease·child 전에 같은 ask에서 지침을 다시 골라 binding과 비교하고, 정책 hash·scope·범위 허용을 다시 본다. 하나라도 다르면 `EXECUTOR_CHANGED`로 lease 없이 끝낸다.
- stdin은 96 wrapper 그대로: prefix + `map6Prompt(ask)` + suffix + `JSON.stringify(ask)`. 지침·recipe·원문·요청·prior를 줄이거나 고치지 않는다.

## 그대로 둔 것

- map-input.1 codec(fullRequests·priors·alias 보존), AF100 job store, `validateMapReply`·원 ask 대조, exit 0·final 일치·허용 event·tool/error 0·완결·byte 상한, 102의 lease·cancel·deadline·fence·재시작 fail-closed.
- 원자료 종류: code/test 대응은 evidence 원자료만 인용할 수 있다(map-reading 기존 계약). 정상 붙여넣기 기록(N)은 reported/checked/open만 된다. 112는 source kind·validator·prompt·입력 UI를 바꾸지 않는다.

## 상태와 안내

- status `jobs.executor.scope`(first|map6-later). 헤더 title의 지도 실행기 설명이 범위를 따른다(첫 지도만 / 첫 지도와 이후 기록·요청 대조까지). `EXECUTOR_SCOPE` 문구(첫 지도만)는 first 범위에서만 나오고, `EXECUTOR_SCHEMA`에 별도 문구를 둔다. 레이아웃·설정 흐름은 바꾸지 않았다. 생성 품질이나 공개/Worker 가용성을 뜻하지 않는다.
