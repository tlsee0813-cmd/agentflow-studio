# 시작 흐름과 AI 배치 구조

2026-11-02, `work/experience142-reading-delivery`의 8240b7d를 기준으로 코드에서 확인한 현재 동작을 정리한다. 경로 결정 한 곳 정리(`app/continuity/src/shared/map-route.ts`)도 함께 기록한다. 제품 완성 선언이 아니며, 실제 모델 품질이나 사람 사용성의 증거도 아니다.

## 1. 경로는 한 곳에서 정한다

지도 정리 요청 하나가 어떤 계약·처리 판본·모델·한도로 가는지는 `mapRoute(ask, offer)` 하나가 정한다. 브라우저는 `/api/studio/status`의 `map`을, PC 서버는 자기 파이프라인 설명을 `offer`로 넘긴다. 두 쪽이 같은 함수를 쓰므로 작업 결속(`binding.prompt`, `binding.model`)이 서버의 실행과 어긋나지 않는다. 어긋나면 서버는 `PROMPT_CHANGED`로 거절하고 아무것도 보내지 않는다.

| 경로 | 요청 모양 | 처리 판본(prompt id) | 모델 | 실행 |
| --- | --- | --- | --- | --- |
| `divided-first` | studio.map.6, 부분·요청·prior 없음 | `m6-` + 첫 지도 분할 recipe 해시 12자 | `deepseek-flash_gpt-6.1-sol_gpt-6.1-terra`(기본) | PC 분할 파이프라인 |
| `divided-later` | studio.map.7(항상 후속) | `m7-` + 후속 분할 recipe 해시 12자 | 위와 같음 | PC 분할 파이프라인 |
| `single` | 그 밖의 모든 요청, 분할을 제공하지 않는 호스트의 모든 요청 | map.7이면 `laterPrompt`, 아니면 `prompt` | plan 모델(`DEEPSEEK_PLAN_MODEL` 또는 기본) | DeepSeek 1회 호출(`callStudioModel`) 또는 미리보기 실행기 1회 |

요청 모양만으로 분할 계열을 정하는 규칙은 `dividedKind`/`isFirstMap`이다. 서버의 `/map` 거절(`MAP_PIPELINE_JOBS_REQUIRED`), 파이프라인 범위 검사(`eligible`), 작업 결속(`jobPrompt`/`jobModel`), 브라우저의 결속이 모두 이 규칙을 쓴다. 분할을 실제로 쓰는지는 호스트가 `first`/`later`를 광고하는지로 정한다. 광고했지만 `ready:false`이면(키 없음, 내구 저장소 없음) 브라우저는 보내지 않고 이유를 표시한다.

브라우저가 map.6과 map.7 중 무엇을 만들지는 `buildMapAsk`가 정한다. 서버가 `laterPrompt`(m7)를 광고하면 부분·요청·prior가 하나라도 있는 요청은 map.7이 된다. 따라서 현재 PC에서 **부분을 직접 추가한 뒤 기록을 붙여 넣은 경우**도 map.7 → `divided-later`로 간다.

## 2. 세 가지 시작 흐름

### A. 이미 진행한 프로젝트: 기록 붙여넣기(또는 백업 가져오기) → 첫 지도 → 후속 정리

| 단계 | 화면·버튼 | 코드 | 저장되는 것 | 경로 |
| --- | --- | --- | --- | --- |
| 1 | 내 프로젝트 만들기 → 빈 지도 카드 “기록으로 첫 지도를 만들어요” | `renderMapEntry` | 브라우저 저장소의 프로젝트 | — |
| 2 | **기록 붙여넣기**(또는 **코드·검사 자료 추가**) | `openPaste`/`openFile` → `pasteRecord` | 붙인 원문(키처럼 보이는 글은 거절). AI에 보내지 않음 | — |
| 3 | **기록으로 지도 정리** | `mapRun.run()` | PC: 작업 예약(브라우저) + 작업 기록(`.studio-data/map-jobs-<port>`) + 단계 결과·비용 장부(`…/first-map`) | 부분이 없으면 `divided-first`. OpenAI 설정이 없는 PC와 Worker는 `single` |
| 4 | 기다리는 동안 | `pendingLine` | — | “구간별 근거를 읽고…” 또는 단계 진행(`근거 읽기 n/N`, `전체 조건 대조 중…`, `부분 정리 n/N`, `관계·조건 마지막 확인 중…`, `정리 결과를 바로잡는 중…`) |
| 5 | 결과 도착 → 같은 프로젝트에서 반영 | `apply` → `applyReading` → `commit` | 지도 읽기(map-reading.6), 읽은 원문 구간 | — |
| 6 | 남은 기록·새 보고 → **기록 읽고 지도 갱신** / 제목 줄 **새 기록 N개 읽고 지도 갱신** | `mapBlock`, `understoodLine` | 같음 | map.7 → `divided-later` |

백업 가져오기는 새 사본을 만들 뿐 AI를 부르지 않는다. 사본에 읽지 않은 기록이 있으면 3단계부터 같은 경로를 탄다.

실패하면(형식·근거 거절, 비용 상한, 시간 초과, 취소) 결과를 적용하지 않고 원문·기존 지도를 그대로 둔다. 같은 요청을 다시 맡기면 끝난 단계는 PC 저장소에서 재생하고 남은 단계만 보낸다. 전송·과금이 불명인 단계는 자동 재전송하지 않는다(`MAP_STAGE_UNCERTAIN`).

### B. 처음부터 자동 연결

| 단계 | 화면·버튼 | 코드 | 기록 출처 |
| --- | --- | --- | --- |
| 1 | 빈 지도 카드의 **내 AI 세션 자동 연결**(세션을 읽을 수 있고 지금 정리할 기록이 없을 때 주 버튼), 또는 상단 ‘자동 연결’ 표시 | `autoSync.toggle()` | — |
| 2 | 작업 폴더 선택 | `auto-sync.ts` 패널 | 로컬 서버 `sessions.mjs`(Claude Code `~/.claude/projects`, Codex `~/.codex/sessions`) 또는 브라우저가 고른 폴더(`session-source.ts`) |
| 3 | 첫 확인: 최근 14일, 세션 최대 10개를 세션당 기록 1개(최근 턴)로 저장 | `tick` (`BACKFILL_MS`, `BACKFILL_SESSIONS`) | 붙인 기록과 같은 `pasteRecord` |
| 4 | 이후 1분마다 확인, 2분 잠잠해진 세션의 새 턴만 저장(오래된 것 먼저) | `tick`, `SETTLE_MS` | 위와 같음 + AgentFlow 커넥터 우편함(`connector.mjs`, 웹 AI는 `cloud-pull.mjs`로 내려받음) |
| 5 | 저장 뒤 자동 지도 정리: 5분 간격, 하루 30회, 진행 중·결과 대기 중이면 시작하지 않음 | `canRead` → `mapRun.run()` | 첫 정리는 `divided-first`, 이후 `divided-later` |

자동 정리도 사람의 클릭과 같은 `mapRun.run()`을 쓴다. 경로·결속·비용 상한·실패 처리가 같다. 사용자가 취소하거나 결과를 버리면 새 기록이 들어올 때까지 자동으로 다시 시작하지 않는다(`held`).

### C. 붙여넣기로 먼저 정리하고 나중에 자동 연결

1. A의 1–5단계로 첫 지도를 만든다(`divided-first`).
2. 상단 ‘자동 연결’에서 작업 폴더를 연결한다. 빈 지도 카드가 이미 사라졌으므로 카드의 연결 버튼은 나오지 않는다.
3. 들어온 세션 기록은 읽지 않은 기록으로 쌓이고 다음 자동 정리가 map.7 → `divided-later`로 읽는다.

| 상황 | 현재 동작 |
| --- | --- |
| 분할 작업이 도는 중에 새 기록 도착 | 같은 탭의 자동 연결이 기록만 저장한다. `canRead`가 거짓이라 새 정리를 시작하지 않는다. 진행 중 결과는 이 탭이 직접 저장한 변경(`ownSave`) 위에 그대로 적용되고, 새 기록은 다음 정리에서 읽는다. |
| 다른 탭이 그사이 같은 프로젝트를 저장 | 결과를 적용하지 않는다(`SAVED_SINCE`). 다시 정리하면 새 기록이 포함된 다른 요청이 되므로 끝난 단계를 재생하지 못하고 새로 비용이 든다. |
| 부분이 이미 있는 지도(붙여넣기로 정리했거나 직접 추가)에 자동 기록 도착 | map.7 → `divided-later`. 부분 이름·메모와 직접 고친 역할(`roleBy: person`)이 요청에 실려 보존 대상이 된다. |

## 3. AI 배치

### 분할 경로(PC, `server/map-pipeline.mjs`)

| 단계 | 모델(기본) | 수 | 동시 | 시간 제한 | 교정 |
| --- | --- | --- | --- | --- | --- |
| 구간 추출 `extract-n` | DeepSeek(`DEEPSEEK_PLAN_MODEL`) | 구간 수(최대 12) | 2 | 60초 | 형식·영수증 거절 시 1회(OpenAI 작성 배치에서만) |
| 설계 `plan` | gpt-6.1-sol, reasoning high | 1 | — | 300초, 출력 16,384토큰(추론 포함) | 형식·원문 위치 거절 시 1회 |
| 부분 작성 `render-n` | gpt-6.1-terra(`STUDIO_MAP_RENDER_MODEL`) | 설계 부분 3개씩, 최대 24부분 = 8그룹 | 2 | 180초(DeepSeek 작성이면 60초) | 근거·형식 거절 시 1회 |
| 전역 대조 `global` | 전역 모델(`STUDIO_MAP_GLOBAL_MODEL`, 정하지 않으면 작성 모델) | 1 | — | 위와 같음 | 1회 |
| 의미 재작성 `render-n-semantic` → `global-final` | 작성 모델 → 전역 모델 | 지정 그룹 + 1 | 2 | 위와 같음 | 각 1회, 재작성 자체는 최대 1회 |

- 구간은 원문 span을 자르지 않고 순서대로 묶는다. 구간 핵심 글자 3,500자 안팎, 최대 12구간. 브라우저와 서버가 같은 묶음 함수(`partitionGroups`)를 쓴다.
- 추출 메모와 설계는 근거가 아니다. 최종 지도는 원래 요청 전체에 대해 기존 map.6/map.7 검증(`validateMapReply`)을 통과해야 적용된다.
- 단계마다 호출 전에 비용 예약을 PC에 기록하고, 완료 결과를 요청 전체·recipe 해시에 결속해 저장한다. 같은 요청의 재시도는 완료 단계를 재생한다.
- OpenAI 상한: 정리당 $1(`STUDIO_MAP_RUN_USD`), 월 $20(`STUDIO_MAP_MONTHLY_USD`). DeepSeek은 장부 밖이며 호출 수로 제한한다: 기본(OpenAI 작성) 12구간 × (1 + 교정 1) = 24회, DeepSeek 작성 선택 시 추출 교정 없이 12 + (1+1)×(1+1)×(8+1) = 48회.
- 첫 지도(`first-map-divided.6`)는 조각·전역 검증에서 항목 하나(근거 인용 하나, 주장 하나, 관계·후보·빈틈·예제 표시 하나, 개수 초과분)가 규칙에 어긋나면 그 항목만 제외하고 고정된 진단(경로·규칙·분류·원문 위치)을 남긴다. 부분 자체의 규칙 위반, 근거가 하나도 남지 않은 새 부분, 주장이 전부 제외된 부분, 모순, 키처럼 보이는 글, 응답 모양은 여전히 전체 거절이다. 서버는 제외 항목을 뺀 wire만 보내고 브라우저는 평범한 map.6 규칙으로 다시 검증한 뒤 제외 사유(`exclusions`)를 읽기 진단으로 저장한다. 후속 지도(map.7)는 기존대로 브라우저가 항목을 제외한다.
- 거절된 단계는 작업 오류 `detail`에 단계·국면·규칙(고정 분류만)을 남기고, `STUDIO_KEEP_REFUSED`가 켜져 있으면 가려진 원응답을 같은 폴더에 보관한다. 화면은 어느 단계가 어떤 규칙에 걸렸는지 말한다.
- 자동 재전송, 다른 공급자로의 대체, 교정의 재교정은 없다.

### 단일 경로(`callStudioModel`)

DeepSeek 1회. 지도 계약별 프롬프트(map.6 첫 지도/후속, map.7), 시간 제한 90초(`STUDIO_MAP_TIMEOUT_MS`), 출력 16,384토큰, `STUDIO_MAP_THINKING`을 정하지 않으면 24,000바이트를 넘는 요청은 추론을 끈다(`MAP_THINKING_BYTES`). 같은 요청 해시는 두 번 보내지 않는다. PC에 작업 저장소가 있으면 내구 작업으로, 없으면(Worker) 직접 `/api/studio/map`으로 보낸다.

### 다른 AI 경로(이번 경로 결정 밖)

| 경로 | 모델 | 비고 |
| --- | --- | --- |
| `/ask` | `DEEPSEEK_MODEL` | 질문 답변 |
| `/plan`, `/scope`, `/digest` | plan 모델(`DEEPSEEK_PLAN_MODEL`, 없으면 `DEEPSEEK_MODEL`) | 변경안·범위·반환 읽기. 분할하지 않음 |

## 4. 한도

| 한도 | 값 | 위치 | 적용 경로 |
| --- | --- | --- | --- |
| 요청당 기록 | 4개(최신 순) | `MAP_RECORDS` | 모두 |
| 기록 발췌 | 12,000자 | `MAP_RECORD_CHARS` | 모두 |
| 요청 크기 | 65,536바이트(UTF-8 JSON) | `MAP_BYTES` | 모두 |
| 구간 | 최대 12개, 구간당 3,500자 안팎 | 파이프라인 설정, status `partitions`/`partitionChars` | 분할 |
| DeepSeek 호출 | 24(OpenAI 작성) 또는 48(DeepSeek 작성) | status `deepseekMaxCalls`(없으면 48로 읽음) | 분할 |
| OpenAI 비용 | 정리당 $1, 월 $20 | status `runUsd`/`monthlyUsd` | 분할 |
| 자동 정리 | 5분 간격, 하루 30회 | `AUTO_RUN_GAP_MS`, `AUTO_RUNS_PER_DAY` | 자동 연결 |

남은 기록은 다음 정리에서 읽는다. 정리 전에 “기록 N개를 AI에 보내요 · M개는 다음에”로 표시한다(`sendLine`).

## 5. Worker와 PC

| | PC(Node, `server/index.mjs`) | 공개 Worker(`server/worker.mjs`) | 기존 지도용 Worker(`worker-existing-map.mjs`) |
| --- | --- | --- | --- |
| 지도 정리 | OpenAI 설정이 있으면 분할, 없으면 단일 | 단일만 | 없음 |
| 작업 저장소 | 있음(창을 닫아도 계속) | 없음(창이 열린 동안의 요청) | 없음 |
| 세션 읽기·커넥터 우편함 | 있음 | 없음(웹 커넥터는 별도) | 없음 |
| 사용자에게 보이는 말 | 빈 지도 카드·지도 정리 칸에 분할 단계와 상한 | 같은 자리에 “AI 요청 한 번으로 읽어요 … 구간별로 나눠 읽는 정리는 OpenAI 설정을 둔 PC 실행기에서만 해요.” | “기존 지도 작업용 버전이에요” |

## 6. 확인한 불일치와 처리

| # | 내용 | 위치(8240b7d) | 처리 |
| --- | --- | --- | --- |
| 1 | 첫 지도 조건이 브라우저(`dividedFirst`)와 서버(`isFirstMap`)에 따로 있었다. 하나만 바뀌면 모든 작업이 `PROMPT_CHANGED`가 된다. | `map-run.ts:136-139`, `map-pipeline.mjs:67-68`, `studio.mjs:291-295` | `map-route.ts`로 합쳤다. 이전 두 규칙을 그대로 옮긴 비교 시험을 추가했다. |
| 2 | 부분이 있는 map.6은 첫 지도도 map.7도 아니다. | `studio.mjs:294`, 시험 “legacy later map.6” | 현재 브라우저는 m7을 광고하는 서버에 이 모양을 보내지 않는다(부분 직접 추가 후 기록도 map.7). 옛 탭·m7 없는 실행기만 보낸다. 단일 경로를 유지하고, 화면에 “이 요청 형식은 나눠 읽지 않고 AI 요청 한 번으로 읽어요”를 표시한다. 분할 설계 계약은 바꾸지 않았다. |
| 3 | 브라우저의 `deepseekMaxCalls ?? 48`과 서버 기본 12(추출 교정 추가 뒤 24) | `app.ts:2190`, `studio.mjs:320-321`, `studio-api.ts:55,58` | 불일치는 아니다. 12는 실제 기본 배치이고 48은 서버가 말하지 않을 때 가정하는 최대치다. 서버의 `?? 48`은 도달하지 않는 분기였다. 상수 `DEEPSEEK_CALLS_UNSTATED`로 이름을 붙이고 한 곳에서 읽는다. |
| 4 | 긴 영문·코드 기록 4개는 65,536바이트 안에 들어가도 12구간을 넘을 수 있다. 작업 수락 뒤 `MAP_PARTITION_LIMIT`로 거절되고 같은 요청은 매번 거절된다. 자동 연결이면 5분마다 반복된다. | `map-partition.mjs:36`, `map-reading.ts:907` | 브라우저가 보내기 전에 같은 묶음 함수로 구간을 세고, 넘치면 끝의 기록을 통째로 다음 정리로 미룬다(`fitMapInput`). 최소 1개는 보낸다. 미룬 수는 “M개는 다음에”로 표시된다. |
| 5 | 분할 배치 안내가 빈 지도 카드에만 있었다. 후속 정리(B·C의 대부분)에는 상한이 보이지 않았다. 카드 문구의 “기존 지도와 직접 고친 내용도 함께 확인”은 첫 지도에 맞지 않았다. | `app.ts:2189-2190`, `mapBlock` | 문구를 경로에서 만든다(`mapBatchLines`). 지도 정리 칸에도 표시하고, 기존 지도 문구는 후속 경로에만 넣는다. 구간 수·동시 수를 함께 적는다. |
| 6 | 대기 문구가 status에 `first`가 있는지로 정해져, 단일 경로 작업도 “구간별 근거를 읽고…”로 표시될 수 있었다. | `app.ts:2178` | 작업이 결속된 recipe로 경로를 판단한다(`routeOfPrompt`). 새로고침 뒤 되찾은 작업도 같다. |
| 7 | Worker에서는 단일 호출이라는 사실과 기록 4개 한도가 보이지 않았다. | `renderMapEntry` | 같은 자리에 단일 경로 문구를 표시한다. |
| 8 | 기록은 가져온 시각의 최신 순으로 4개씩 읽는다. 자동 연결은 오래된 세션부터 저장하므로, 첫 확인의 세션 10개 중 최신 4개가 첫 지도가 되고 나머지 과거 기록은 후속(map.7)으로 읽힌다. | `map-reading.ts:825`, `auto-sync.ts:177` | 남김. 기록 basis에 “가져온 시각이며 원문 작성·판본 시각이 아님”이 실린다. 순서 정책 변경은 지도 의미에 영향이 있어 별도 판단이 필요하다. |
| 9 | 자동 정리 하루 30회와 월 $20 상한 | `session-import.ts:206-208` | 남김. 상한에 닿으면 각 시도는 보내기 전에 `MAP_BUDGET_EXCEEDED`로 끝나 비용은 없지만 오류가 반복된다. 상수 주석의 “한 번의 유료 호출”은 분할 경로에서는 단계 여러 개다. |
| 10 | 다른 탭 저장으로 결과가 버려지면 새 기록이 섞인 다른 요청이 되어 완료 단계를 재생하지 못한다. | `map-run.ts` `onItsSave` | 남김(2절 C 표). |
| 11 | 미리보기 실행기(AF102)는 `promptFor`와 자기 모델로 결속한다. | `studio.mjs` `runJob`(executor) | 남김. 분할 파이프라인과 함께 쓸 수 없으며(생성 시 거절) 브라우저에는 `single`로 보인다. |

## 7. 바뀐 파일

- `app/continuity/src/shared/map-route.ts`: 경로 결정, 구간 묶음, 기록 맞춤, 안내 문구.
- `server/studio.mjs`: 분할 광고·작업 결속을 경로 모듈로. status에 `partitions`, `partitionChars`를 추가(파이프라인이 알려 줄 때만).
- `server/map-pipeline.mjs`: `isFirstMap`·`eligible` 정의를 공용 규칙으로 대체, 설명에 `targetChars` 추가. 단계 실행·검증은 그대로다.
- `server/map-partition.mjs`: 묶음 반복문을 공용 `partitionGroups`로 대체.
- `src/client/map-run.ts`, `studio-api.ts`, `app.ts`: 경로·맞춤·문구 사용.
- `tests/map-route.test.mjs`: 이전 규칙과의 동일성, 서버 수락, 구간 일치, 맞춤, 문구.

프롬프트 원문, 근거 규칙, 비용 상한, 자동 재시도·대체 금지는 바꾸지 않았다.
