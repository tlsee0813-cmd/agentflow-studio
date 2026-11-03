/* The status-report request: the words a person pastes into the AI session that knows their project (a supervising session,
 * one that can read the files, or a chat that only heard about it), so that session writes the report the map reads best:
 * the units the project names, what holds what, every arrow with what it hands over, the state of each unit with the kind of
 * evidence behind it, withdrawn decisions, the next gate, and what it does not know. Three shapes: with file access, chat only,
 * and the delta since the last report (built from the current map, so the names match). Beside it the two other records of the
 * map design spec §8.1: the design record (six tables read from the code) and the scenario record (spec §8.2 verbatim, with the
 * current map's ID ledger attached). Nothing here is sent to any model: the person carries the words. */
import type { StudioView } from './studio.js';
import { STATUS_SHORT } from './studio.js';
import { stateLabel } from './map-reading.js';
import type { ReadingEntry } from './types.js';
import { isMapReading } from './types.js';
import { claimTopic } from './claim-topic.js';

/** The tags the report marks its sentences with; the map reads [실행] as checked and [보고] as reported. */
export const REPORT_TAGS = ['[파일: 경로]', '[보고: 출처·날짜]', '[실행: 명령]', '[추정]', '[모름]'] as const;
/** The status report's own version (v3: every section after the one-line summary is a table with fixed columns, as the KORU
 * report of 2026-11-03 has them). The chat, delta and reflect requests keep their v2 layout and label. */
export const REPORT_ASK_VERSION = 'v3';
const PROSE_ASK_VERSION = 'v2';
export const DESIGN_RECORD_ASK_VERSION = 'v1';
export const SCENARIO_RECORD_ASK_VERSION = 'v2';

/** With file access: the full report (현황 보고 v3). Twelve sections in the order the map reads them, each after the summary a
 * table whose header row is given verbatim; a withdrawal table before the cut (the first reading takes the first 12,000
 * characters); an upper bound only, since a lower bound makes an AI fill the room. No example values: an example is copied. */
export const PROJECT_REPORT_ASK = `[AgentFlow 현황 기록 요청 ${REPORT_ASK_VERSION}]
이 프로젝트를 처음 보는 사람이 이어서 일할 수 있게 지금 상태를 아래 0~11절로 써 줘. 1절만 문장이고 나머지는 모두 마크다운 표다(머리 줄 다음에 |---| 줄). 절 제목·순서·열 이름을 아래 그대로 쓰고 12,000자를 넘기지 마. 할 말이 적으면 짧아도 된다. 모르는 것은 지어내지 말고 [모름]으로 남겨. 빈 칸이 꾸민 칸보다 낫다.
첫 줄은 「프로젝트 이름 현황 보고서 (v3 표 형식, 쓴 세션, 기준 시각)」.

근거 표시 — 표 줄마다 하나(꼬리표 칸이 있으면 그 칸에, 없으면 마지막 칸 끝에), 1절은 문장마다:
[파일: 경로] 지금 직접 읽은 파일 / [보고: 출처·날짜] 다른 세션·문서·사람의 말을 옮김 / [실행: 명령] 네가 이 대화에서 직접 돌린 것과 그 결과 / [추정] 네 판단 / [모름]
‘통과·OK·완료’는 [실행]이 아니면 모두 인용이다. 여러 작업 세션을 감독하는 세션이면 각 세션의 말은 [보고: 세션 이름 문서 시각]으로.
「부분 이름」 칸에는 2절의 이름을 그대로 쓴다. 프로젝트 전체에 걸린 줄은 「전체」.

0. 기준
| 오늘 날짜·시각 | 브랜치·커밋 sha | 파일을 읽을 수 있는지 | 이 대화의 앞부분이 요약됐는지 |
한 줄, 칸마다 꼬리표.
1. 한 줄 요약
무엇을 위한 것이고 지금 어디까지 왔나.
2. 부분
| 이름 | 하는 일 한 줄 | 담당 파일·폴더 | 상태 단어 | 상태의 기준 시각 | 꼬리표 |
이름은 프로젝트가 부르는 그대로. 파일 하나하나가 아니라 맡은 일 단위로 5~25개. 사람(소유자 등)·외부 시스템·설계만 있는 것·폐기된 것도 넣어. 상태 단어는 돌고 있음/작업 중/미구현/멈춤/폐기/모름 중 하나. 기준 시각은 그 상태를 마지막으로 확인한 때, 모르면 [모름].
3. 묶음
| 부모 이름 | 자식 이름들 |
자식은 「·」로 잇는다. 마지막 줄은 「그 밖 | 없음」(묶음이 하나도 없으면 그 줄만).
4. 연결
| 보내는 부분 | 받는 부분 | 넘기는 것 | 언제·얼마나 자주 | 설계/관찰 | 꼬리표 |
한 줄에 화살표 하나. 설계는 코드·문서상의 흐름, 관찰은 실제로 돈 것을 본 경우. 둘이 다르면 두 줄. 사람에게 보고하거나 사람이 지시하는 화살표도 넣어.
5. 최근 소유자 요청과 실제 변화
| 날짜 | 원한 것 | 바뀐 부분 이름 | 실제로 바뀐 것 | 확인 방법 |
원한 것은 원문을 짧게 「」로. 확인 방법 칸에 꼬리표.
6. 철회·변경
| 부분 이름 | 옛 결정 | 지금 | 근거·날짜 |
철회·폐기·채택 안 함을 빠뜨리지 마.
7. 지켜야 할 것과 하지 않기로 한 것
| 부분 이름 | 규칙 한 줄 | 누가 정했나·언제 |
8. 오류·미해결·할 일
| 부분 이름 | 무엇이 | 언제부터·근거 |
9. 다음 관문
| 부분 이름 | 무엇이 확인되면 | 무엇을 한다 | 언제쯤 |
2~5줄.
10. 모르는 것
| 부분 이름 | 무엇을 | 어떻게 확인할 수 있나 |
11. 가장 자신 없는 것
| 부분 이름 | 내용 |
3줄.

키·토큰·비밀번호·접속 주소의 비밀 부분·경로 속 사용자 이름은 [가림]으로 바꿔. .env 같은 비밀 파일은 열지 마. 이 요청문은 옮기지 말고 보고서 밖의 말은 쓰지 마.`;

/** The design record (설계 기록 v1), asked of the same session after the status report: what each part is, the rows and messages
 * between parts with their fields, what each part receives, does inside and hands over, its steps in execution order, its
 * conditions, and the files. Six tables with the KORU design record's columns verbatim; a path-alias line first; every row
 * tagged; [모름] where the code was not read; no invented step; no re-summary of the status report; a size cap whose cut is
 * named on the last line. */
export const DESIGN_RECORD_ASK = `[AgentFlow 설계 기록 요청 ${DESIGN_RECORD_ASK_VERSION}]
이 프로젝트의 설계를 코드·스키마·설정에서 읽어 아래 여섯 표로 써 줘. 현황 보고를 다시 요약하지 마: 상태·이력·철회·관문은 현황 보고의 몫이고, 여기는 무엇이 무엇을 받아 어떤 단계로 무엇을 내는지만 쓴다. 표는 마크다운(머리 줄 다음에 |---| 줄), 절 제목·순서·열 이름은 아래 그대로. 12,000자를 넘기지 마. 넘칠 것 같으면 뒤 표의 덜 중요한 줄부터 빼고, 뺀 것을 맨 끝 「생략한 것: …」 한 줄에 적어(뺀 것이 없으면 「생략한 것: 없음」). 짧아도 된다.
첫 줄은 「프로젝트 이름 설계 기록 v1 (쓴 세션, 날짜·시각; 코드를 어떻게 읽었는지)」.
둘째 줄은 「경로 약속: 별칭 = 경로 · 별칭 = 경로 …」 — 자주 쓰는 파일·폴더에 짧은 별칭을 붙이고, 특정 커밋·브랜치를 읽었으면 그 경로 앞에 함께 적어. 표에서는 별칭으로 쓴다([파일: 별칭], 별칭/하위 경로).

근거 표시 — 표 줄마다 하나(꼬리표 칸이 있으면 그 칸에, 없으면 마지막 칸 끝에):
[파일: 경로] 이번에 직접 읽은 코드·스키마·설정 / [보고: 출처·날짜] 다른 세션·문서의 말 / [실행: 명령] 이 대화에서 직접 돌린 읽기 명령 / [추정] 네 판단 / [모름]
코드를 읽지 않은 칸·줄은 [모름]. 이 기록을 쓰려고 코드를 고치거나 검사·프로그램을 새로 돌리지 마(읽기 명령만).

1. 부분 유형
| 이름 | 유형 | 한 줄 |
이름은 현황 보고의 부분 이름 그대로(현황 보고가 없으면 프로젝트가 부르는 그대로). 유형은 다음 중 하나만: 사람 / 세션 / 루프·엔진 / 행 파일·저장소 / AI 판단 / 타이머·일정 / 계산 / 수집기 / 외부 시스템. 맞는 것이 없으면 [모름]. 한 줄 끝에 꼬리표.
2. 산출물
| 이름 | 필드 | 만드는 부분 | 읽는 부분 | 있는 곳 | 꼬리표 |
부분 사이를 오가는 행 파일·큐·메시지·주문·문서마다 한 줄. 필드는 코드·스키마에 적힌 이름 그대로 「·」로 잇고 하위 필드의 괄호는 그대로 둔다. 다 옮기지 못했으면 끝에 「…」, 읽지 못했으면 [모름]. 한 칸에 넘치면 다음 줄에 「이름(이어서)」. 있는 곳은 경로 그대로, 파일이 아니면 어디에 있는지 한 낱말.
3. 부분별 설계
| 이름 | 받는 산출물 | 안의 단계 | 내는 산출물 | 설정 | 꼬리표 |
받는·내는 산출물은 2절의 이름 그대로. 안의 단계는 4절에 줄이 있으면 「4절」, 짧으면 「→」로 이은 한 줄, 읽지 못했으면 [모름]. 설정은 코드·설정 파일의 값을 적힌 그대로 「,」로 잇는다. 커밋 sha·판본은 설정이 아니다: 경로 약속이나 꼬리표에 둔다.
4. 안의 단계
| 부분 이름 | 순번 | 단계 이름 | 하는 일 한 줄 | 쓰는 파일·함수·모델 | 조건·분기 | 꼬리표 |
코드를 읽은 부분만, 한 줄에 한 단계를 실행 순서대로(순번 1부터). 쓰는 파일·함수·모델은 코드의 이름 그대로 「·」로. 조건·분기는 그 단계에서 갈리거나 멈추는 조건과 결과(거부 사유 코드 그대로), 없으면 —. 코드에 없는 단계를 지어내거나 두 단계를 한 줄로 합치지 마. 읽지 않은 단계는 [모름].
5. 조건·거부·분기
| 부분 이름 | 조건 | 참이면 | 거짓이면 | 꼬리표 |
한 줄에 조건 하나. 조건은 코드의 식·조건문을 적힌 그대로(길면 뜻이 바뀌지 않게 줄여). 참이면·거짓이면은 결과·사유 코드·가는 곳, 다음 검사로 넘어가면 「다음」.
6. 파일 지도
| 경로 | 속한 부분 | 역할 한 줄 | 꼬리표 |
설계에 쓰인 파일·폴더마다 한 줄. 읽지 않은 파일은 역할 끝에 「(이번에 안 읽음)」과 [모름].

키·토큰·비밀번호·접속 주소의 비밀 부분·경로 속 사용자 이름은 [가림]으로 바꿔. .env 같은 비밀 파일은 열지 마. 이 요청문은 옮기지 말고 기록 밖의 말은 쓰지 마.`;

/** The scenario record request (시나리오 기록 요청 v2): the text of MAP_DESIGN_SPEC_KO.md §8.2 verbatim, after one line saying the
 * ID ledger is attached below. The app does not read the reply yet (the next cycle); it is kept as a record like any other. */
export const SCENARIO_RECORD_ASK = `[AgentFlow 시나리오 기록 요청 ${SCENARIO_RECORD_ASK_VERSION}]
이 요청 아래에 지금 지도의 ID 대장과 대장 판본이 붙어 있다.

목적은 현재 자료로 설명할 수 있는 동작 경로를 소프트웨어 지도에 연결하는 것이다. 설계를 개선하거나 빠진 동작을 완성하는 요청이 아니다. 아래 여섯 묶음을 표로 작성하라.

입력: 현황 보고 v3 / 설계 기록 v1 / 이번 요청에 첨부된 ID 대장과 대장 판본 / 현재 세션에서 실제로 확인 가능한 기존 기록·파일 발췌·실행 자료.

공통 규칙:
1. P=부분, O=포트, S=단계, R=연결, A=산출물, F=필드, Q=규칙이다. 첨부 대장의 ID를 그대로 참조하라. 이름으로 ID를 추정하거나 기존 ID의 뜻을 바꾸지 마라.
2. 이번 응답에서 새로 발급할 수 있는 ID는 시나리오 C01, 방문 V01…, 이어짐 L01…, 근거 E01…, 빈칸 G01…뿐이다. 모두 이번 보고 안에서만 유효하다.
3. 기존 두 기록을 재요약하지 마라. 경로를 설명하는 데 필요한 참조와 새로 확인한 근거만 적어라.
4. 핵심 시나리오 하나를 선택하라. 명시된 소유자 요청이 있으면 그것을 기준으로 고른다. 없으면 요청 참조는 '모름', 선택 이유는 '설명 목적'으로 적어라.
5. 종류는 '설계 경로 / 관측 실행 / 설명용 투어' 중 하나다. 관측 실행은 같은 실행에 속한다는 식별 근거가 있을 때만 사용한다. 시간상 가깝다는 이유만으로 서로 다른 로그를 하나의 실행으로 합치지 마라.
6. 모르면 '모름'이라고 적어라. '없음'은 실제로 없다는 근거가 있을 때만 사용한다. 표에서 생략한 것을 없다고 주장하지 마라.
7. 한 행에는 하나의 방문 또는 하나의 이어짐만 적어라. 같은 단계를 다시 방문하면 S는 유지하고 V만 새로 발급한다.
8. 보기 좋은 완결 경로를 위해 빠진 연결·포트·단계·조건·종료·재개를 만들지 마라. A와 B가 각각 기록되어 있다는 사실만으로 A 다음 B라고 쓰지 마라.
9. 파일·큐에 쓰는 동작과 나중에 읽는 동작을 직접 호출로 합치지 마라. 별도 촉발이면 그 경계를 표시하라.
10. 분기 조건·반복·병렬·합류·대기는 기록에 명시된 의미만 적어라. '모두 기다림', '먼저 끝난 것', '즉시 재개' 등을 상식으로 보충하지 마라.
11. 새 P/O/S/R/A/F/Q가 필요하지만 대장에 없으면, 해당 연결을 작성하지 말고 여섯째 묶음의 빈칸 표에 원문과 함께 보고하라.
12. 파일을 확인했다는 보고와 실제 파일 발췌, 실행했다고 한 보고와 실제 실행 자료를 구별하라. 이번 보고를 만들기 위해 새 코드 변경·새 실행·새 검사를 하지 마라.
13. 각 사실 행에 E 근거 ID를 붙여라. 기존 자료를 찾을 수 없는 기억이나 보고자 판단은 '보고' 또는 '추정'으로 표시한다. 원문 인용을 만들어 내지 마라.
14. 방문·연결·결과의 사실과 바라는 결과를 구별하라. 결과를 알 수 없으면 마지막으로 확인 가능한 지점에서 멈춰라.

분량 상한: 시나리오 1개, 방문 최대 16개, 이어짐 최대 20개. 전체 표 데이터 행은 최대 80개, 전체 응답은 12,000자 이내. 상한 때문에 빠지는 갈래·범위는 빈칸 표에 기록한다. 두 단계를 합치거나 중간 저장소를 없애서 상한을 맞추지 마라. 설명 셀은 가급적 100자 이내. 정확 인용은 240자 이내의 연속 발췌로 적는다. 짧게 자르면 뜻이 달라지는 인용은 요약으로 바꾸지 말고 자료 위치와 누락 사유를 남긴다.

**① 기준과 목적** — 시나리오 ID | 이름 | 관련 요청 ID 또는 원문 위치 | ID 대장 판본 | 설계 판본 | 현황 기준 시각 | 종류 | 실행 ID·실행 범위 또는 모름 | 선택 이유 | 근거 E

**② 시작** — 시작 ID | 촉발 사건 | 시작 대상 P/O/S | 시작 조건 원문·Q 참조 | 필요한 이전 상태 | 이 촉발이 다른 동작과 독립적인지 | 근거 E

**③ 방문** — 방문 V | 부분 P | 단계 S 또는 모름 | 포트 O 또는 모름 | 필요한 입력 A | 이 방문이 내놓는 출력 A | 관측 실행일 때 사건 식별자 | 근거 E
행 순서는 보기 위한 순서다. 실행 순서는 다음 표에 근거가 있는 이어짐으로만 표현한다. 부분만 확인되면 단계·포트를 추정하지 마라.

**④ 이어짐** — 이어짐 L | 출발 V | 도착 V | 기존 연결 R | 뜻: next/branch/parallel/loop/wait | 조건 원문·Q 참조 | 반복 단위·합류 정책·재개 사건 중 해당 내용 | 근거 E
기존 연결 R이 없거나 이어짐의 근거가 없으면 이 표에 쓰지 말고 빈칸 표에 적어라. 설명용 투어의 읽기 순서는 '투어 읽기 순서'라고 따로 표시하며 실행 연결 R을 요구하거나 새로 만들지 않는다.

**⑤ 끝** — 끝 ID | 도달 방문 V 또는 모름 | 설계가 내놓는 결과 | 바라는 결과·요청 참조 | 이탈·거절·중단 결과 | 마지막 확인 지점 | 두 결과의 차이·미정 | 근거 E
설계가 내놓는 결과, 바라는 결과, 실제 관측 결과를 서로 복사하지 마라. 경로가 중간에서 끊겼으면 끝까지 도달했다고 쓰지 마라.

**⑥ 근거와 빈칸**
근거: E | 뒷받침하는 행·열 | 제공된 자료 종류: 파일/실행/보고 | 원문 자료·위치 | 판본·실행 ID | 정확 인용 또는 원문 미제공 | 명시적 내용/보고자 추정
외부↔내부 대응(확인된 것만): 대응 ID | 외부 연결 R | 경계 포트 O | 내부 단계 S | 들어감/나감 | 근거 E
빈칸·충돌·상한으로 생략한 범위: G | 관련 P/O/S/R/V/Q | 모르는 내용 또는 충돌 | 관련 원문·E | 이유: 미언급/자료없음/대장없음/충돌/분량상한 | 확인하려면 필요한 자료

ID 대장 자체가 없으면 P/O/S/R/A/F/Q를 새로 만들지 마라. 첫째 표에 대장 미제공을 적고 여섯째 표에 필요한 대응을 남겨라. 완결 경로 대신 정확한 부분 경로를 반환하라.`;

/** Chat only: the session cannot read the files, so [파일] and [실행] are not allowed; whoever said "done" is named. */
export const CHAT_REPORT_ASK = `[AgentFlow 대화 기록 요청 ${PROSE_ASK_VERSION}]
너는 이 프로젝트의 파일을 볼 수 없다고 가정하고, 이 대화에서 오간 내용만으로 지금 상태를 보고서로 써 줘. 12,000자 이하, 지어내지 말고 모르면 [모름].
근거 표시 — 줄마다 하나: [대화: 언제쯤·누가] 이 대화에서 나온 말 / [붙임] 내가 붙여 준 코드·로그 / [추정] / [모름]. [파일]·[실행]은 쓰지 마. ‘됐다·통과’는 누가 말했는지 적어.
0. 기준: 오늘 날짜, 이 대화가 시작된 때, 앞부분이 요약·잘렸는지.
1. 한 줄 요약.
2. 부분(표): 이름(대화에서 부른 그대로) | 하는 일 | 언급된 파일 이름(없으면 [모름]) | 상태 | 근거. 묶음은 “A 안에 B·C”.
3. 연결: A → B: 넘기는 것 (언제) — 대화에서 설명된 것만.
4. 내가 원한 것(원문 짧게) | 네가 했다고 한 것 | 내가 확인했다고 말한 것.
5. 철회·변경(표): 옛 결정 → 지금 → 언제·누가.
6. 지켜야 할 것. 7. 미해결·할 일. 8. 다음 관문(무엇이 확인되면 → 무엇을). 9. 모르는 것.
비밀값은 [가림]. 이 요청문은 옮기지 마.`;

/** What the person gets, beside each copy button: one sentence per request (the button's title). */
export const REPORT_ASK_EXPLAIN = '프로젝트를 보고 있는 AI 대화(감독 세션 등)에 붙여 넣으면 그 AI가 부분·상태·연결·철회·규칙·관문·모르는 것을 줄마다 [파일]·[보고]·[실행]·[추정]·[모름] 꼬리표가 붙은 표로 써 주니, 키·토큰이 [가림]으로 바뀌었는지 보고 기록 붙여넣기에 넣으세요.';
export const DESIGN_RECORD_EXPLAIN = '같은 AI 대화에 붙여 넣으면 그 AI가 코드에서 읽은 부분 유형·산출물과 필드·받는 것과 내는 것·안의 단계·조건·파일 지도를 여섯 표로 써 주고, 지도는 그것으로 카드의 몸통·포트·장부·단계를 그려요.';
export const SCENARIO_RECORD_EXPLAIN = '지금 지도의 ID 대장을 붙인 요청이라 그 AI가 동작 경로 하나(시작·방문·이어짐·끝·근거·빈칸)를 대장의 ID로 써 주는데, 이 시나리오 기록은 다른 기록처럼 따로 붙여 넣어 보관할 뿐 앱이 아직 길로 읽지는 않아요(다음 단계).';
/** The three requests' explanations in the order the screens offer them. */
export const RECORD_ASK_EXPLAIN = { status: REPORT_ASK_EXPLAIN, design: DESIGN_RECORD_EXPLAIN, scenario: SCENARIO_RECORD_EXPLAIN } as const;

/** The ID ledger's cap: past it the remaining items are counted on one line. */
export const LEDGER_MAX_CHARS = 8000;
const one = (s: string, n: number) => { const t = s.replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
/** The current map's ID ledger for the scenario request: P parts with their app ids, R relations (from → to: what is handed
 * over), A stores and handed-over names, F a store's row fields, O what parts receive and hand over, S steps, Q rule claims;
 * one line per item, P and R first so a cap drops the finer items; a 대장 판본 line names the latest reading. The ids live only
 * in this text (P01 is the first part listed, not a stored id); the app id beside each part is the stable one. */
export function scenarioLedger(view: StudioView, readings: readonly ReadingEntry[], max = LEDGER_MAX_CHARS): string {
  const l = buildLedger(view, readings, max);
  return [...l.head, ...l.items.slice(0, l.items.length - l.cut).map(x => x.line), ...(l.cut ? [`…대장 ${l.cut}개 생략`] : [])].join('\n');
}
/** One ledger item as the scenario request lists it: its ledger id (P01, R03, …) and its line. */
export interface LedgerItem { id: string; line: string }
/** The structured ID ledger the scenario request is built from (and the scenario record is read against): every item with the
 * app's own target behind its ledger id, and which ids the text actually showed (an item past the cap was never sent, so a
 * record that cites it cites nothing it was given). Names are kept whole here; the text shortens them. */
export interface ScenarioLedger {
  /** The newest map reading's id (the 대장 판본), null when there is none; versionLine is how the text says it. */
  version: string | null; versionLine: string;
  parts: { id: string; areaId: string; name: string; parent: string | null }[];
  relations: { id: string; relationId: string; from: string; to: string; payload: string | null }[];
  /** A store part (store = its area id) or a handed-over name (relations: the R ids that hand it over). */
  artifacts: { id: string; name: string; store: string | null; relations: string[] }[];
  fields: { id: string; artifact: string; name: string }[];
  ports: { id: string; areaId: string; direction: 'in' | 'out'; name: string }[];
  steps: { id: string; areaId: string; name: string; does: string | null }[];
  rules: { id: string; areaId: string; text: string }[];
  head: string[]; items: LedgerItem[];
  /** Items left off the text by the cap (the last ones), and the ids the text did list. */
  cut: number; shown: string[];
}
export function buildLedger(view: StudioView, readings: readonly ReadingEntry[], max = LEDGER_MAX_CHARS): ScenarioLedger {
  const maps = [...readings].filter(isMapReading), last = maps.at(-1) ?? null;
  const pad = (n: number) => String(n).padStart(2, '0');
  const pid = new Map(view.parts.map((p, i) => [p.id, `P${pad(i + 1)}`]));
  const pn = (id: string) => `${pid.get(id) ?? '?'} ${one(view.parts.find(p => p.id === id)?.name ?? id, 40)}`;
  // What each relation hands over: the newest reading that names it, else the relation's own note.
  const said = new Map<string, string>();
  for (const r of maps) for (const x of r.relations) if (x.payload) said.set(x.relationId, x.payload);
  const l: ScenarioLedger = { version: last?.id ?? null, versionLine: last ? `${last.id} · ${last.at}` : '지도 읽기 없음', parts: [], relations: [], artifacts: [], fields: [], ports: [], steps: [], rules: [], head: [], items: [], cut: 0, shown: [] };
  const items = l.items, push = (id: string, line: string) => items.push({ id, line });
  view.parts.forEach(p => { const id = pid.get(p.id)!, parent = p.parentId && pid.has(p.parentId) ? pid.get(p.parentId)! : null;
    l.parts.push({ id, areaId: p.id, name: p.name, parent }); push(id, `${id} ${one(p.name, 60)} (${p.id})${parent ? ` · ${parent} 안` : ''}`); });
  const pay = new Map<string, string[]>();
  view.relations.forEach((r, i) => {
    const named = said.get(r.id) ?? null, what = named ?? (r.note.trim() || null), rid = `R${pad(i + 1)}`;
    l.relations.push({ id: rid, relationId: r.id, from: r.from, to: r.to, payload: what });
    push(rid, `${rid} ${pn(r.from)} → ${pn(r.to)}: ${what ? one(what, 120) : '넘기는 것 미기재'}`);
    // A handed-over name is what a reading named as the payload; a relation's own note is a description, not a name.
    if (named) { const k = one(named, 80); pay.set(k, [...(pay.get(k) ?? []), rid]); }
  });
  const stores = view.parts.filter(p => p.reading?.typeRead?.type === 'store');
  let a = 0; const aid = () => `A${pad(++a)}`, fields: [string, string][] = [];
  for (const p of stores) { const id = aid(); l.artifacts.push({ id, name: p.name, store: p.id, relations: [] }); push(id, `${id} ${one(p.name, 60)} (${pid.get(p.id)} 저장소)`); for (const f of p.reading!.fields) fields.push([id, f]); }
  for (const [k, rids] of pay) { const id = aid(); l.artifacts.push({ id, name: k, store: null, relations: rids }); push(id, `${id} ${k} (${rids.join('·')})`); }
  fields.forEach(([art, f], i) => { const id = `F${pad(i + 1)}`; l.fields.push({ id, artifact: art, name: f }); push(id, `${id} ${art} ${one(f, 40)}`); });
  let o = 0, s = 0, q = 0;
  for (const p of view.parts) { const u = p.reading; if (!u) continue;
    for (const x of u.inputs) { const id = `O${pad(++o)}`; l.ports.push({ id, areaId: p.id, direction: 'in', name: x }); push(id, `${id} ${pid.get(p.id)} 받음: ${one(x, 60)}`); }
    for (const x of u.outputs) { const id = `O${pad(++o)}`; l.ports.push({ id, areaId: p.id, direction: 'out', name: x }); push(id, `${id} ${pid.get(p.id)} 냄: ${one(x, 60)}`); } }
  for (const p of view.parts) for (const x of p.reading?.steps ?? []) { const id = `S${pad(++s)}`; l.steps.push({ id, areaId: p.id, name: x.name, does: x.does }); push(id, `${id} ${pid.get(p.id)} ${one(x.name, 40)}${x.does ? `: ${one(x.does, 80)}` : ''}`); }
  for (const p of view.parts) for (const c of p.reading?.claims ?? []) if (claimTopic(c) === 'rule') { const id = `Q${pad(++q)}`; l.rules.push({ id, areaId: p.id, text: c.text }); push(id, `${id} ${pid.get(p.id)}: ${one(c.text, 140)}`); }
  l.head = [`[ID 대장] 대장 판본: ${l.versionLine}`,
    'P 부분 (앱 id) · R 연결 보내는 → 받는: 넘기는 것 · A 저장소·넘기는 것 (연결) · F 저장소 행 필드 · O 받음/냄 · S 단계 · Q 규칙'];
  let len = l.head.join('\n').length;
  for (let i = 0; i < items.length; i++) {
    const room = max - len - 1 - (i < items.length - 1 ? 24 : 0);
    if (items[i]!.line.length > room) { l.cut = items.length - i; break; }
    l.shown.push(items[i]!.id); len += items[i]!.line.length + 1;
  }
  return l;
}
/** The scenario request with the current map's ledger attached below it. */
export function scenarioAskWithLedger(view: StudioView, readings: readonly ReadingEntry[]): string {
  return `${SCENARIO_RECORD_ASK}\n\n${scenarioLedger(view, readings)}`;
}

/** The delta request, built from the current map so the names match: each part with the state the map holds, the gaps and
 * unsettled statements of the last reading as the open questions, with "still unknown" and "could not check" as answers the
 * session may give (a pointed question invites an invented answer). */
export function deltaReportAsk(view: StudioView, readings: readonly ReadingEntry[], at: Date = new Date()): string {
  const last = [...readings].filter(isMapReading).at(-1) ?? null;
  const name = (id: string) => view.parts.find(p => p.id === id)?.name ?? id;
  // The state as the map shows it: what the records said (a reported state) before the bare "planned" of a part without a request.
  const state = (id: string) => { const p = view.parts.find(x => x.id === id); return !p ? '모름' : p.status === 'plan' ? (p.reading ? stateLabel(p.reading) : null) ?? STATUS_SHORT.plan : STATUS_SHORT[p.status]; };
  const roots = view.roots.map(id => `- ${name(id)} — ${state(id)}${(view.parts.find(p => p.id === id)?.childIds.length ?? 0) ? ` (안에 ${view.parts.find(p => p.id === id)!.childIds.map(name).join('·')})` : ''}`);
  const open = [...(last?.gaps ?? []), ...(last?.candidates.map(c => c.text) ?? [])].slice(0, 8).map(t => `- ${t}`);
  const when = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
  return `[AgentFlow 변경 기록 요청 ${PROSE_ASK_VERSION} · 지난 기준: ${last ? last.at.slice(0, 10) : when}]
지난 보고 이후 바뀐 것만 써 줘. 6,000자 이하. 근거 표시는 지난번과 같다: [파일: 경로] [보고: 출처] [실행: 명령] [추정] [모름]. ‘통과’는 [실행]이 아니면 인용.
아래 부분 이름을 그대로 써. 이름이 바뀌었으면 “옛 이름 → 새 이름”.
${roots.join('\n') || '- (아직 부분이 없음)'}
부분마다 한 줄: 상태 전→후 (근거) / 바뀐 것 없음 / 확인 못 함 중 하나.
그다음:
- 새 부분: 이름 — 어디 안에 — 담당 파일
- 없어진 부분·연결
- 새 연결: A → B: 넘기는 것 [설계]/[관찰]
- 철회·변경: 옛 결정 → 지금 → 근거·날짜
- 지난번 비어 있던 것: 풀렸으면 무엇으로·근거, 아니면 “여전히 모름”
${open.join('\n')}
- 다음 관문: 지난 관문은 어떻게 됐나, 새 관문
- 새 기준: 날짜·sha
비밀값은 [가림]. 지난 보고를 다시 쓰지 마.`;
}

/** The first reading takes this many characters of a record; a report longer than that is read in later passes. */
export const REPORT_FIRST_CHARS = 12000;
const TAG = /\[(파일|보고|실행|추정|모름|대화|붙임)(:[^\]]*)?\]/g;
/** An arrow line is marked [설계] or [관찰] in place of an evidence tag: it counts as tagged. */
const LINE_TAG = /\[(파일|보고|실행|추정|모름|대화|붙임|설계|관찰)(:[^\]]*)?\]/;
const PASS = /통과|\bOK\b|rc 0|완료|성공/;
const SECTIONS: [string, RegExp][] = [['부분', /부분/], ['연결', /연결|→/], ['철회·변경', /철회|변경/], ['다음 관문', /다음 관문/], ['모르는 것', /모르는 것|\[모름\]/]];
/** A design record (설계 기록 v1) is checked against its own six tables, not the status report's sections. */
const DESIGN_SECTIONS: [string, RegExp][] = [['부분 유형', /부분 유형/], ['산출물', /산출물/], ['부분별 설계', /부분별 설계/], ['안의 단계', /안의 단계/], ['조건·거부·분기', /조건/], ['파일 지도', /파일 지도/]];
const isDesignRecord = (text: string) => /^경로 약속\s*:/m.test(text) || /설계 기록/.test(text.trimStart().split(/\r?\n/, 1)[0] ?? '');
export interface ReportCheck {
  /** Which record the text reads as: the status report, or the design record (checked against its six tables). */
  kind: 'status' | 'design';
  chars: number;
  /** Lines of content with at least one evidence tag, and without one (headings, table rules and short lines are not counted). */
  tagged: number; untagged: number;
  /** Lines that say a pass (통과·OK·rc 0·완료·성공) with no [실행] and no [보고] tag: a pass nobody vouches for. */
  passesUnrun: number;
  /** Sections the request asked for that the text does not seem to have. */
  missing: string[];
  /** Sections that begin past the first reading's cut. */
  cut: string[];
}
/** What a pasted report looks like against the request, or null when the text does not read as one (fewer than five tags): a
 * transcript or a plain note is checked by nothing here. */
export function checkReport(text: string): ReportCheck | null {
  const tags = text.match(TAG); if (!tags || tags.length < 5) return null;
  const kind = isDesignRecord(text) ? 'design' as const : 'status' as const, sections = kind === 'design' ? DESIGN_SECTIONS : SECTIONS;
  const raw = text.split(/\r?\n/).map(l => l.trim()), rule = (l: string) => /^[|\-:\s]+$/.test(l) && l.includes('-');
  let tagged = 0, untagged = 0, passesUnrun = 0, section = '', first = true;
  raw.forEach((l, i) => {
    if (!l) return;
    const title = first && !LINE_TAG.test(l); first = false;
    if (/^(#+\s|\d+\.\s)/.test(l)) { section = l; return; }
    // Not counted: the title line, a table's header row (the next line is its rule), table rules, the path-alias and omission
    // lines, and the rows of the containment and unknowns tables (a name list; an unknown is its own evidence).
    if (title || l.length < 12 || rule(l) || /^(경로 약속|생략한 것)\s*:/.test(l)) return;
    if (l.startsWith('|') && rule(raw.slice(i + 1).find(x => x) ?? '')) return;
    if (l.startsWith('|') && kind === 'status' && /묶음|모르는 것/.test(section)) return;
    if (LINE_TAG.test(l)) tagged++; else untagged++;
    if (PASS.test(l) && !/\[실행/.test(l) && !/\[보고/.test(l) && !/\[대화/.test(l)) passesUnrun++;
  });
  const missing = sections.filter(([, re]) => !re.test(text)).map(([n]) => n);
  const cut = text.length > REPORT_FIRST_CHARS ? sections.filter(([, re]) => { const m = re.exec(text); return !!m && m.index >= REPORT_FIRST_CHARS; }).map(([n]) => n) : [];
  return { kind, chars: text.length, tagged, untagged, passesUnrun, missing, cut };
}
/** The check in one quiet line, and the line to paste back into the AI chat when something should be written again. */
export function reportCheckLine(c: ReportCheck): { text: string; again: string | null } {
  const parts = [`꼬리표 있는 줄 ${c.tagged}`, c.untagged ? `없는 줄 ${c.untagged}` : '', c.passesUnrun ? `[실행]·[보고] 없는 통과 ${c.passesUnrun}` : '', c.missing.length ? `빠진 절: ${c.missing.join('·')}` : '', c.cut.length ? `${REPORT_FIRST_CHARS.toLocaleString()}자 넘음: ${c.cut.join('·')}은 첫 읽기 밖` : ''].filter(Boolean);
  const again = [c.untagged > c.tagged / 4 ? '꼬리표 없는 문장마다 [파일]/[보고]/[실행]/[추정]/[모름] 하나를 붙여 다시 써 줘.' : '', c.passesUnrun ? '네가 직접 돌리지 않은 통과·OK·완료는 [보고: 출처]로 표시해 줘.' : '', c.missing.length ? `${c.missing.join('·')} 절을 채워 줘(없으면 없다고).` : '', c.cut.length ? `${REPORT_FIRST_CHARS.toLocaleString()}자 안에 들도록 줄이되 ${c.cut.join('·')}은 남겨 줘.` : ''].filter(Boolean).join(' ');
  return { text: `${c.kind === 'design' ? '설계 기록 점검' : '보고서 점검'} · ${parts.join(' · ')}`, again: again || null };
}

/** The three lines only the person can write (no AI knows them): what they want next, which report they do not trust, which
 * decision they themselves reversed. Saved as a record of its own, marked as the person's own words, so a reading gives them
 * the authority of a request. */
export const OWN_LINES = ['다음에 원하는 것', '믿지 못하는 보고', '직접 뒤집은 결정'] as const;
export function ownLinesTemplate(at: Date = new Date()): string {
  const when = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
  return [`[프로젝트 소유자가 직접 적음 · ${when}]`, ...OWN_LINES.map(l => `${l}: `)].join('\n');
}

/** A relation the record states as a plan (its note says so): drawn as planned, never as a flow that runs. */
export const plannedNote = (note: string) => /계획|예정|할 것이다|지시할/.test(note);

/** The map's understanding, numbered, for the AI that knows the project to correct line by line: the summary, each part with
 * its description, each relation with what it hands over, the gaps. Only wrong lines come back, with the record behind the
 * correction; nothing new is asked for, so nothing new is invented. */
export function reflectAsk(view: StudioView, readings: readonly ReadingEntry[]): string {
  const last = [...readings].filter(isMapReading).at(-1) ?? null, name = (id: string) => view.parts.find(p => p.id === id)?.name ?? id;
  const lines: string[] = [];
  if (last?.summary) lines.push(`요약: ${last.summary}`);
  for (const p of view.parts) { const role = p.reading?.role ?? p.summary ?? p.note; lines.push(`부분 ${name(p.id)}${p.parentId ? ` (${name(p.parentId)} 안)` : ''}: ${role ? role.replace(/\s+/g, ' ').slice(0, 160) : '설명 없음'}`); }
  for (const rel of view.relations) lines.push(`연결 ${name(rel.from)} → ${name(rel.to)}: ${rel.note || rel.kind}`);
  for (const g of last?.gaps ?? []) lines.push(`빈틈: ${g}`);
  const body = lines.slice(0, 60).map((l, i) => `${i + 1}. ${l}`).join('\n');
  return `[AgentFlow 이해 확인 요청 ${PROSE_ASK_VERSION}]
아래는 지도가 기록에서 읽은 것이다. 틀린 줄만 「번호: 맞는 내용 (근거: [파일]/[보고]/[실행]/[모름])」로 고쳐 답하고, 맞는 줄은 쓰지 마. 모르면 「번호: 확인 못 함」. 새로 지어내거나 없는 줄을 더하지 마. 비밀값은 [가림].
${body}`;
}
