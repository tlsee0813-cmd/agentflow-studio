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
import { isMapReading, latestMapSummary } from './types.js';
import { claimTopic } from './claim-topic.js';
import { TABLE_DEFS, V4_TABLES, PROFILE_TABLES, headerLine, splitRecordChunks, readRecordTables, recordVersion, fixedWord, DONE_WORDS, CHUNK_HEAD, PAGE_HEAD, V5_TABLE_DEFS, Q1_TABLES, Q2_TABLES,
  PAGE_END_TABLES, latestFold, foldTexts, readFamily, supplementFix, rowIdForm, rowKey, END_WORDS, type TableDef, type FoldedRecord, type Obligation } from './record-table.js';

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
export const SCENARIO_RECORD_EXPLAIN = '지금 지도의 ID 대장을 붙인 요청이라 그 AI가 동작 경로 하나(시작·방문·이어짐·끝·근거·빈칸)를 대장의 ID로 써 주고, 그 시나리오 기록을 따로 붙여 넣어 보관하면 앱이 AI 없이 같은 대장과 맞춰 길로 읽어 지도 위에 방문 번호와 경로로 보여 줘요(맞지 않는 행은 제외해 따로 보여요).';
/** The three requests' explanations in the order the screens offer them. */
export const RECORD_ASK_EXPLAIN = { status: REPORT_ASK_EXPLAIN, design: DESIGN_RECORD_EXPLAIN, scenario: SCENARIO_RECORD_EXPLAIN } as const;

/* ---------- 기록 요청 v4 (docs/design/RECORD_ASKS_V4_KO.md 3.1–3.4), as v4.1 from eight recording sessions on open-source clones:
 * one request answered in two chunks (current state, design and the supplementary tables the session chooses), tables keyed by fixed
 * IDs, and continuation requests the app builds from the chunks' C-DONE tables. The header rows come from record-table.ts (the parser's
 * own table definitions), so the request, the continuation and the parser share one source. v4.1 over the spec's v4 text: no ~9,000
 * target (12,000 stays the cap), shorter caps once C-PART holds more than 20 rows, 「[=]」 for evidence that is the part's own files,
 * compact 「|」, several continuations as the normal case, a C-LOOP body with no step rows, 봇 among the types, 릴리스 없음 and a tagless
 * clone's one C-STATUS line, 이슈 본문 미확인(#n), 「고른 보충 표 ID」 on the focus line, a child supplementary table without its parent,
 * one chunk-head form, carried rows keeping their IDs, 정정 rows and a set order of carried tables. ---------- */
export const RECORD_ASK_V4_VERSION = 'v4.1';
const ID_SLOT = '{기록 ID}';
/** A new record ID (「AF4-」 and 8 hex digits) for a copied request. */
export function newRecordId(random: () => number = Math.random): string {
  return `AF4-${Array.from({ length: 8 }, () => Math.floor(random() * 16).toString(16)).join('')}`;
}
/** Each common table's lines under its header row in the request (the continuation repeats them as written). */
export const TABLE_NOTES: Readonly<Record<string, string>> = Object.freeze({
  'C-BASIS': '한 줄, 칸마다 꼬리표. 읽은 범위는 무엇을 읽었고 무엇을 못 읽었나(클론 깊이, 빠진 폴더, 실행 여부. 대화가 요약된 세션이면 그것도).\n표 아래 한 줄: 「이번 기록의 초점: P?, P? / 선택 이유 / 고른 보충 표 ID」. 이 프로젝트를 이해하려면 아래 여섯 질문 묶음 가운데 무엇을 먼저 더 물어야 하는지다. 프로젝트의 분류가 아니다. 1~3개, 범위가 다르면 범위를 괄호로. 근거가 모자라면 「초점: 없음 / 이유」. 쓴 표는 C-DONE이 말한다.',
  'C-SUMMARY': '두 문장, 문장마다 꼬리표: 무엇이고 누가 어떻게 쓰나 / 핵심 흐름 한 줄. 계획·추정은 C-GATE·C-DOUBT에.',
  'C-PART': '이름은 프로젝트가 부르는 그대로. 파일 하나하나가 아니라 맡은 일 단위로 5~30개(목록 한 줄은 하나로 센다). 결정하거나 일하는 사람(소유자·메인테이너·기여자)·봇·CI·외부 시스템·설계만 있는 것·제거된 것도 넣어. 남의 코드가 부르는 라이브러리·SDK면 「사용자 코드」도 한 줄(구체 소비자를 확인 못했으면 하는 일에 「구체 대상 모름」).\n유형 하나: 사람 / 봇 / 세션 / 루프·엔진 / 행 파일·저장소 / AI 판단 / 타이머·일정 / 계산 / 수집기 / 집행·외부 호출 / 화면 / 빌드·배포 자동화 / 외부 시스템 / 모름. 이름이 아니라 하는 일로 고른다. 진입점·어댑터·확장 지점·계약·신호는 유형이 아니라 C-ENTRY·C-VARIANT·C-CONTRACT와 보충 표에 쓴다. 자료형·오류 객체·메시지는 부분이 아니라 C-DATA·C-CONTRACT에 둔다(따로 맡은 일이 있을 때만 부분).\n구현 상태 하나: 구현됨(이 판본에 구현이 있음. 작동·시험 통과의 뜻은 없음) / 일부 구현 / 미구현 / 제거됨 / 모름 / 해당 없음(사람·봇·외부). 릴리스·배포·활성·유지·운영은 C-STATUS에.\n같은 일을 하는 항목의 목록은 한 줄로 두고 하는 일 끝에 「항목 N · 순서 있음」 또는 「항목 N · 순서 없음」(정확히 셌을 때만 N, 아니면 「항목 여럿」). 항목 이름은 C-GROUP에 두고, 따로 연결을 가진 항목만 자기 행을 갖는다.',
  'C-GROUP': '자식은 「·」로 잇는다. 묶음 뜻 하나: 실행 위치(어디서 도나) / 구성(무엇의 일부) / 참여자(밖에서 판단·입력을 주는 사람·봇) / 외부 / 목록(목록 줄의 항목. 순서 있는 목록은 순서대로) / 모름. 실행 위치 묶음의 부모는 C-PART에 없는 이름이어도 된다. 한 부분의 부모는 하나(목록은 빼고 센다): 실행 위치를 바깥에, 구성을 안쪽에 둔다.',
  'C-LINK': '한 줄에 화살표 하나. 목록의 항목이 보내거나 받으면 「목록 이름: 항목」. 넘기는 것은 C-DATA에 행이 있으면 앞에 그 ID(「D03 …」), 통로가 있으면 그다음에 「통로: …」. 박자 하나에 글자를 붙일 수 있다: 한 번 / 호출마다 / 항목마다 / 주기 / 사건 때 / 끝에 한 번(「주기: 간격 그대로」). 조건·선택: 늘 흐르면 —, 조건이 있을 때만 흐르면 그 조건을 글자 그대로, 고른 변형일 때만 흐르면 「변형 X02」. 경계 하나: 같은 프로세스 / 자식 프로세스 / 프로세스 사이 / 네트워크 / 사람 / 모름. 설계는 코드·문서상의 흐름, 관찰은 실제로 돈 것을 본 경우이고 둘이 다르면 두 줄. 사람·사용자 코드가 부르거나 지시하는 화살표와, 결과가 그쪽으로 돌아가는 화살표도 넣어.',
  'C-CHANGE': '새것부터 15줄까지. 봇의 의존성 갱신이나 같은 종류의 잔수정은 한 줄에 묶고 개수를 쓴다. 실은 기간은 C-DONE 수록 범위에. 날짜는 작성일과 병합일이 다르면 「작성 / 병합」.\n관련 주체·역할: 「역할: 주체」를 「+」로 잇는다. 역할은 요청 / 제안 / 작성 / 검토·승인 / 병합, 주체는 소유자 / 메인테이너(계정) / 기여자(계정) / 봇(이름) / 이슈 #번호(작성자, 모르면 「작성자 모름」) / 모름. 「요청:」은 따로 적힌 요청(대화·이슈)이 있을 때만. PR 작성자가 스스로 낸 변화는 「작성: 그 사람」뿐이다.\n원한 것: 요청 원문을 짧게 「」로. 따로 적힌 요청이 없으면 —(커밋·PR 제목을 옮기지 마). 이슈 번호는 아는데 본문을 못 읽었으면 「이슈 본문 미확인(#번호)」.\n계약 변화: —(외부 계약이 안 바뀜) / 깨짐: K ID 또는 무엇 / 호환: K ID 또는 무엇 / 모름. 깨짐은 깨짐 표시·BREAKING 문구·메이저 판본·제거된 인자·이주 안내 같은 근거가 있을 때만.\n실린 판본: 그 변화가 실린 릴리스 / 미릴리스(마지막 릴리스 뒤라는 근거가 있을 때) / 모름. C-STATUS에 「태그 없음·얕은 클론」 줄을 썼으면 —.',
  'C-WITHDRAW': '철회·폐기·채택 안 함을 빠뜨리지 마. 방식 하나: 되돌림 / 제거 / 폐기 예정(경고 후 유지) / 옮김 / 기본값 바꿈 / 채택 안 함 / 다시 도입. 옛 동작을 지키는 장치(호환 스위치, 제거된 인자의 안내)가 있으면 지금 칸에. 계약 변화는 C-CHANGE와 같다.',
  'C-RULE': '정한 이는 규칙을 정한 사람·문서(모르면 모름). 지키는 장치는 코드 / 검사(시험·CI) / 사람 / 없음 / 모름, 여럿이면 「+」로. 코드의 검사·assert가 막으면 정한 이가 사람이어도 장치는 코드다. 장치 위치는 파일·함수 또는 사람 이름(장치가 없음·모름이면 —). 믿지 않는 입력·권한·비밀을 지키는 규칙도 넣어.',
  'C-STATUS': '할 말이 있는 대상만, 8줄까지(넘치면 C-DONE에). 대상은 부분 이름·배포 단위(패키지·서비스)·「전체」. 차원마다 값 하나:\n- 릴리스: 릴리스됨 / 미릴리스 / 회수됨 / 릴리스 없음 / 모름. 이용자에게 낸 판본·채널(적용 범위에 채널·판본). 릴리스 없음은 한 번도 내지 않았다는 근거가 있을 때만. 태그가 없거나 얕은 클론이라 판본을 못 가리면 「전체 | 릴리스 | 모름 | 태그 없음·얕은 클론 | — | 근거」 한 줄.\n- 배포: 배포됨 / 미배포 / 철회됨 / 모름. 특정 환경에 특정 판본이 반영됐나(적용 범위에 환경).\n- 활성 방식: 항상 적용 / 조건부 / 비활성 / 모름. 조건부·비활성이면 켜지는 조건이나 꺼진 위치를 적용 범위에 글자 그대로(기본 설정에서 켜지는지도).\n- 유지 방침: 기능 개발 / 수정만 / 사용 중단 권고 / 유지 종료 / 모름. 명시된 방침만(활동량으로 추정하지 마). 대체·후속이 있으면 값 뒤에 「(후속: 이름)」.\n- 운영 상태: 실행 중 / 유휴·대기 / 정지 / 실패 / 모름. 특정 실행·서비스 인스턴스를 보거나 보고받았을 때만.\n기준은 그 주장이 선 판본·sha·시각(C-BASIS와 같으면 —).\n근거 규칙: 매니페스트의 판본은 선언된 판본만, Git 태그는 태그가 있다는 것만 증명한다. 릴리스 기록·배포된 패키지는 그 판본·채널의 릴리스 근거다(저장소 안의 CHANGELOG·릴리스 노트는 [보고]). 배포됨에는 판본 + 대상 환경 + 반영을 보여 주는 기록이나 명시적 보고가 필요하다. 배포 설정·스크립트가 있다는 것은 배포 근거가 아니다. 보고만 있으면 [보고]로 두고 [실행]으로 올리지 마. 병합은 C-CHANGE에 쓰고, 미배포를 뜻하지 않는다.',
  'C-ISSUE': '저장소에 평문 비밀이 있으면 위치만 쓴다(값은 [가림]).',
  'C-GATE': '0~5줄. 열린 PR·판본 경계·막고 있는 외부 의존처럼 근거 있는 관문만. 없음을 확인했으면 「없음: 이유 [근거]」 한 줄.',
  'C-UNKNOWN': '',
  'C-DOUBT': '1~3줄.',
  'C-DATA': '부분 사이를 오가는 자료·파일·테이블·메시지마다 한 줄. 종류 하나: 외부 계약(명세는 C-CONTRACT에 쓰고 여기는 이름과 K ID) / 내부 자료 / 저장(파일·테이블) / 메시지·신호. 필드·모양은 코드의 이름 그대로. 필드 없는 배열은 형식·모양·크기, 넓은 테이블은 키 필드 몇 개와 「그 밖 N개」. 만드는·읽는 부분은 직접 만들고 직접 읽는 부분만(지나가게만 하는 부분은 빼). 있는 곳은 경로(파일이 아니면 메모리·DB 이름). 쓰기 방식은 확인했을 때만 괄호로: 덧붙임 / 통째 교체 / 원자 교체(어디까지가 한 번에 바뀌나).',
  'C-DESIGN': '받는·내는 산출물은 C-DATA의 이름 그대로. 안의 단계는 C-STEP에 있으면 「C-STEP」, 짧으면 「→」로 이은 한 줄, 못 읽었으면 모름. 설정은 동작을 바꾸는 것 6개까지 「키=값」을 「,」로(더 있으면 P6-01·P6-02에, 못 쓰면 C-DONE에). 커밋 sha·판본은 설정이 아니다.',
  'C-STEP': '지도의 중심인 부분 3~8개를 골라 그 부분의 단계를 실행 순서대로 쓴다(부분당 16줄까지. 넘으면 하위 부분으로 나누거나 남은 단계를 C-DONE에). 한 줄에 한 단계. 코드에 없는 단계를 지어내거나 두 단계를 한 줄로 합치지 마.\n- 소속 반복 ID는 그 단계가 도는 가장 안쪽 반복(C-LOOP)이고 반복 밖이면 —. 두 반복이 같은 단계를 부르면 그 단계는 한 번만 쓰고 두 반복 ID를 「+」로.\n- 조건·분기: 갈리거나 멈추는 조건과 결과를 「→ S06」, 거부 사유 코드 그대로, 되돌아가면 「→ S02, 최대 3번」으로. 없으면 —.\n- 쓰는 파일·함수에 AI 모델이나 학습 대상 모델이 있으면 그 이름 앞에 「모델:」.\n- 순서 있는 목록이 20개를 넘으면 단계로 펼치지 말고 C-GROUP의 목록으로.',
  'C-LOOP': '코드에 반복문·재귀·주기 실행이 있는 것만. 부모 반복 ID는 바로 바깥 반복(다른 부분의 반복이어도 된다), 없으면 —. 몸통 단계 ID는 반복마다 도는 단계(「B03:S04–S06」). 그 부분의 C-STEP 행이 없으면 「단계 미기록(함수 이름)」, 다른 부분의 단계를 부르면 「B11의 단계」. 한 번만 도는 준비·마무리는 몸통에 넣지 마. 반복 단위는 무엇마다 도나. 횟수·계속 조건은 확인한 식 그대로(값을 읽지 않았으면 숫자로 계산해 넣지 마).',
  'C-COND': '한 줄에 조건 하나. 조건은 코드의 식을 적힌 그대로(길면 뜻이 바뀌지 않게 줄여). 참이면·거짓이면은 결과·사유 코드·가는 곳이고, 다음 검사로 넘어가면 「다음」. 갈래가 셋 이상이면 갈래마다 한 줄. 갈리는 때 하나: 실행 시 / 설정 읽을 때 / 빌드·컴파일 시. 프로그램 전체를 바꾸는 모드 스위치도 여기에.',
  'C-VARIANT': '같은 계약·접점의 여러 구현(어댑터·드라이버·실행 전략·플랫폼 구현·저장 백엔드·실행 모드)마다 한 줄. 공통 계약·접점 ID는 K ID, 부분 안의 자리면 「B03: 자리 이름」(P2-02를 쓴 경우에만 그 행 ID). 사용자가 바꿔 끼우는 자리면 구현 부분이 「사용자 지정」인 줄. 선택 주체·시점은 누가(사용자 설정 / 코드 / 플랫폼·빌드), 어떻게(지정 / 우선순위로 첫 가능 항목 / 실패하면 다음), 언제(빌드 시 / 시작 시 / 호출마다). 함께 사용 가능 여부: 배타 / 병용 가능 / 모름, 범위를 괄호로(「배타(호출마다)」).',
  'C-ENTRY': '프로그램이 시작되거나 불리는 곳마다 한 줄(많으면 기능 묶음마다 한 줄에 정확히 센 개수). 소비자·호출 주체: 사람 / 사용자 코드 / 외부 시스템 / 일정 / 다른 부분 이름. 호출 방식 하나: 명령 / 함수·클래스 호출 / HTTP·WS 요청 / 메시지·사건 / 일정 / 상주(시작 후 계속 돎) / 손으로 돌리는 스크립트. 사람이 차례로 돌리는 스크립트면 진입점 앞에 순서(「1) 」). 계약 ID는 C-CONTRACT 행, 없으면 —.',
  'C-CONTRACT': '그 부분·패키지 경계 바깥(사용자 코드·사람·다른 프로그램)이 의존하는 약속만: 공개 함수·명령의 입출력, 파일·응답 형식, 종료 코드·오류 코드, 프로토콜. 바뀌면 소비자가 깨지는 것이다. 내부 구조체를 공개 계약으로 올리지 마. 구체 소비자를 확인 못했으면 「사용자 코드—구체 대상 모름」. 적용 판본은 형식·스키마 판본이 있을 때만, 없으면 —.',
  'C-FILES': '폴더 단위로 써도 된다. 생성물·시험·문서·예제는 한 줄씩 묶는다. 실행 때 생기는 디스크 배치는 경로 끝에 「(실행 시)」. 읽지 않은 것은 역할 끝에 「(이번에 안 읽음)」과 [모름].',
  'C-DONE': '덩이마다 끝에, 그 덩이에 속한 표마다 한 줄(덩이 2는 고른 보충 표도). 작성 상태 하나: 작성 완료 / 일부 작성 / 해당 없음 / 확인 못함 / 분량상 이월. 수록 범위는 실은 행의 범위(「최근 15건」, 「중심 부분 B03·B05」), 남은 범위는 남은 것과 그 위치(없으면 —). 표가 없다는 것만으로 해당 없음이 되지 않는다.'
});
/** The five sentences against invention (K14), in the request and in every continuation. */
export const NO_INVENTION = ['- 확인하지 못한 값은 모름으로 적어라. 없음, 미구현, 미배포는 부재를 확인한 범위와 근거가 있을 때만 사용하라.',
  '- 파일·함수·변수 이름은 동작의 증거가 아니다. 연결·실행 순서·조건은 실제 호출, 등록, 분기 또는 이를 명시한 기록으로 확인하라. 확인되지 않은 관계를 그럴듯하게 연결하지 마라.',
  '- 소스에 구현이 있음, 시험을 통과함, 릴리스됨, 특정 환경에 배포됨, 현재 실행 중임을 별개의 주장으로 작성하라. 한 주장의 근거를 다른 주장에 재사용하려면 그 사실도 실제로 증명하는지 확인하라.',
  '- 기본값·우선순위·반복 횟수·배타성·재시도·보안 보장을 관례로 채우지 마라. 확인한 식과 조건을 그대로 기록하고, 미확정 부분을 표시하라.',
  '- 표를 채우기 위해 예시·권고·계획을 구현 사실로 바꾸지 마라. 분량 때문에 생략한 내용은 완료표에 남겨라. 해당 없음은 빈칸을 없애기 위한 값이 아니다.'] as const;
/** Recipe .45 (review N7): the same five for the v5 requests, whose page has no completion table: what was left out for length goes in C-END 남은 것. */
export const NO_INVENTION_V5 = [...NO_INVENTION.slice(0, 4), NO_INVENTION[4].replace('분량 때문에 생략한 내용은 완료표에 남겨라.', '분량 때문에 생략한 내용은 C-END 남은 것에 남겨라.')] as const;
/** A common table's section: its title line, its header row (none for C-SUMMARY) and its notes. */
const tableSection = (id: string): string => { const t = TABLE_DEFS.get(id)!, note = TABLE_NOTES[id] ?? ''; return [`${t.id} ${t.title}`, ...(t.columns.length ? [headerLine(t)] : []), ...(note ? [note] : [])].join('\n'); };
/** A supplementary table's line of the request: 「P4-02 상태 전이 (8행): 열 | … — 문장」. */
const profileLine = (t: TableDef): string => `${t.id} ${t.title} (${t.rows}행): ${t.columns.slice(0, -2).join(' | ')} — ${t.note}`;
const PROFILE_GROUPS: readonly [string, string][] = [['P1', '요청·명령 처리 — 무엇을 받아 어떤 순서로 처리하고 어떻게 끝나나'], ['P2', '계약·확장 — 소비자가 무엇에 의존하며 어디를 바꿔 끼울 수 있나'],
  ['P3', '자료 변환·산출물 — 무엇이 어떤 형태로 바뀌고 어디에 남나'], ['P4', '상태·반응 — 무엇을 기억하며 어떤 사건에 어떻게 바뀌나'], ['P5', '작업 실행·조정 — 무엇이 언제 실행되며 겹침·실패·반복을 어떻게 다루나'],
  ['P6', '자원·배치·변경 — 어떤 환경·설정·경계 아래에서 제공되고 유지되나']];
const CHUNK1 = V4_TABLES.filter(t => t.chunk === 1).map(t => t.id), CHUNK2 = V4_TABLES.filter(t => t.chunk === 2).map(t => t.id);
const PROFILE_HEAD = '보충 표 — 고른 것만\n공통 표만으로 설명이 모자란 곳의 표만 고른다. 초점 밖의 표도 고를 수 있고, 한 묶음의 표를 다 쓸 필요는 없다. 덩이 2의 C-FILES 다음에, 자리가 남는 만큼 중요한 표부터 쓰고 나머지는 C-DONE에 「분량상 이월」. 행 상한은 한 덩이에 싣는 상한이다. 머리 줄은 아래 열 목록 뒤에 「행 ID | 근거」를 붙인 것이다(「| 열 | … | 행 ID | 근거 |」). 첫 열이 그 표가 처음 정하는 것의 ID면 그 행의 행 ID를 그대로 쓰고, 다른 표의 것을 가리키면 그 ID를 쓴다(사슬 ID는 그 사슬 첫 행의 행 ID). 가리킬 부모 표를 고르지 않았으면(P6-01 없이 P6-02, P4-01 없이 P4-02) 그 칸에 원래 키나 상태 이름을 그대로 쓴다.\n정확히 센 목록만 「총 N개」라고 쓴다. 「개수 + 처음·끝」은 같은 모양의 반복 자료에만 쓰고, 중간의 분기·권한 검사·오류 처리·우선순위 예외를 감추는 압축에는 쓰지 마. 싣지 못한 목록은 총수·고른 기준·나머지 위치를 남긴다.\n흔히 놓치는 것도 해당 표에 쓴다: 앱 수명(전경·배경·복귀)·권한·오프라인, 실행 문맥 사이의 메시지, 인터럽트·시간 제한, 패키지 경계·릴리스 단위, 트랜잭션·격리·내구성 시점, 중간 표현·증분 무효화, 전달·순서 보장·역압력, 계획과 적용의 차이.';
const profileBlock = (): string => [PROFILE_HEAD, ...PROFILE_GROUPS.flatMap(([g, title]) => [`${g} ${title}`, ...PROFILE_TABLES.filter(t => t.id.startsWith(`${g}-`)).map(profileLine)])].join('\n');
/** The chunk head a session writes (one form for the request and every continuation). */
const CHUNK_HEAD_FORM = '「〔기록 {기록 ID} · 덩이 {n} · 기준 {sha}〕 {프로젝트 이름} 기록 v4 (쓴 세션, 날짜·시각)」';
/** 기본 기록 요청 v4.1: {기록 ID} filled with the given ID (left as the slot when none: the app gives one when the answer is pasted). */
export function recordAskV4(recordId: string = ID_SLOT): string {
  return `[AgentFlow 기록 요청 ${RECORD_ASK_V4_VERSION}]
이 프로젝트를 처음 보는 사람이 이어서 일할 수 있게, 지금 상태와 설계를 코드·문서·기록에서 읽어 아래 표로 써 줘. 표는 마크다운이다(머리 줄 다음에 |---| 줄). 표마다 제목 줄 「표 ID 제목」(예: 「C-PART 부분」)을 쓰고 바로 아래에 머리 줄을 글자 그대로 쓴다. 표 ID가 앱이 표를 찾는 열쇠다. 바꾸거나 새로 만들지 마.

덩이와 분량
- 기본 기록은 두 덩이다. 덩이 1은 C-BASIS부터 C-DOUBT까지, 덩이 2는 C-DATA부터 C-FILES까지와 고른 보충 표. 덩이마다 첫 줄은 ${CHUNK_HEAD_FORM.replace('{기록 ID}', recordId)}({n}은 덩이 번호, {sha}는 기준 커밋), 둘째 줄은 「경로 약속:」 줄(두 덩이에 같게), 마지막은 C-DONE 완료표.
- 덩이 1과 2를 한 답에 차례로 써. 한 답에 다 못 쓰면 덩이 1 끝에서 멈추고 마지막 줄에 「덩이 2는 「이어서」에」라고 써. 「이어서」를 받으면 덩이 2를 쓴다.
- 덩이마다 12,000자를 넘기지 마. 바이트가 아니라 글자 수다(셀 수 있으면 LC_ALL=C.UTF-8 wc -m 파일, 또는 PowerShell (Get-Content -Raw -Encoding UTF8 파일).Length. 바이트밖에 못 세면 바이트÷1.3). 정확한 수는 앱이 센다.
- 넘칠 것 같으면 덜 중요한 행부터 덜어 내되 말없이 빼지 마. 덜어 낸 표는 C-DONE에 「일부 작성」이나 「분량상 이월」로 적고 남은 범위를 쓴다. 앱이 그 범위로 이어쓰기 요청을 만든다(이어쓰기는 여러 번이어도 괜찮다). C-SUMMARY와 C-FILES는 끝까지 남겨.
- C-PART가 20행을 넘으면 C-LINK는 30줄, C-CHANGE는 8줄, C-STATUS는 5줄까지만 중요한 것부터 싣고 나머지는 C-DONE에.
- 칸을 줄이려면 표 줄의 「|」 양옆 공백을 빼도 된다(「|a|b|」). 근거가 그 부분의 담당 파일·폴더와 같으면 [=]로 써도 된다.
- 짧아도 된다. 빈 칸이 꾸민 칸보다 낫다.

공통 규칙
- 근거: 표마다 마지막 열 「근거」에 하나, C-SUMMARY는 문장마다. [파일: 경로] 이번에 직접 읽은 파일 / [보고: 출처·날짜] 다른 세션·문서·사람·커밋·PR·이슈의 말 / [실행: 명령] 이 대화에서 직접 돌린 것과 결과 / [추정] 네 판단 / [모름]. ‘통과·OK·완료’는 [실행]이 아니면 인용이다. 여러 작업 세션을 감독하는 세션이면 각 세션의 말은 [보고: 세션 이름 문서 시각]. 이 기록을 쓰려고 코드를 고치거나 검사·프로그램을 새로 돌리지 마(읽기 명령만).
- 칸 값의 모름은 대괄호 없이 「모름」이고 [모름]은 근거 꼬리표다. 「없음」은 찾아봤더니 없다는 뜻이고, 「해당 없음」은 그 질문이 그 대상에 성립하지 않는다는 뜻이다.
- 행이 하나도 없는 표: 찾아봤더니 없으면 제목 아래 머리 줄 대신 「없음: 확인한 범위 [근거]」 한 줄. 질문이 이 프로젝트에 성립하지 않으면 표를 쓰지 말고 C-DONE에 「해당 없음」. 확인하지 못했으면 C-DONE에 「확인 못함」.
- 칸 안의 | 글자는 &#124;로 쓴다(||는 &#124;&#124;). 코드 식은 그렇게 적힌 그대로 두고, 말로 풀 때만 「또는」「그리고」. 칸 안에 줄바꿈이나 긴 코드 전문을 넣지 마.
- 이름: 열 이름이 「부분」으로 끝나는 칸에는 C-PART의 이름을 글자 그대로, 「ID」로 끝나는 칸에는 ID를 쓴다. 프로젝트 전체에 걸린 줄은 「전체」. 여러 값은 「·」로 잇는다(「+」로 잇게 한 칸만 「+」). 이름에 「·」가 들어 있으면 그 칸의 여러 값은 「, 」로 잇는다.
- ID: 부분 B01…(C-PART 행 ID), 단계 B03:S01…(그 부분 안에서 실행 순서대로. 둘 중 하나만 도는 갈래는 B03:S04a·B03:S04b), 반복 B03:L01…, 산출물 D01…, 변형 X01…, 진입 N01…, 외부 계약 K01…, 보충 표의 행은 「표 ID.번호」(P4-01.2). ID는 이 기록 안에서만 뜻이 있고, 한 번 쓴 ID를 다른 것에 다시 쓰지 마.
- 경로: 「경로 약속:」의 별칭으로 써도 된다([파일: 별칭], 별칭/하위 경로). 형식은 「경로 약속: @기준 sha · 별칭 = 경로 · 별칭 = 경로」, 별칭은 로마자 1~4자.
- 키·토큰·비밀번호·접속 주소의 비밀 부분·경로 속 사용자 이름은 [가림]. .env 같은 비밀 파일은 열지 마. 이 요청문은 옮기지 말고 기록 밖의 말은 쓰지 마.

지어내지 마
${NO_INVENTION.join('\n')}

덩이 1 — 지금 상태

${CHUNK1.map(tableSection).join('\n\n')}

덩이 2 — 설계

${CHUNK2.map(tableSection).join('\n\n')}

${profileBlock()}

${tableSection('C-DONE')}

기록 ID: ${recordId}`;
}
/** The continuation's own wording (3.2): the same chunk head, the same rules, the tables still to write, the next IDs. */
export const CONTINUATION_CHARS = 8000;
export interface ContinuationPlan { recordId: string; basis: string; project: string; chunk: number; tables: { id: string; state: string; included: string; remaining: string }[]; next: string; text: string }
const DONE_LABEL: Readonly<Record<string, string>> = { done: '작성 완료', partial: '일부 작성', na: '해당 없음', unchecked: '확인 못함', deferred: '분량상 이월', missing: 'C-DONE에 없음' };
/** The continuation request (3.2–3.4, v4.1) for the latest v4 record among the given texts: its chunks gathered by record ID, their C-DONE rows
 * merged (the last chunk's state of a table wins), the tables to write: 일부 작성 and 분량상 이월 ones, 작성 완료 ones whose 남은 범위 says
 * something is left, supplementary tables the focus line chose that no chunk holds, and a common table neither C-DONE nor any chunk holds
 * (C-DONE에 없음); a missing chunk 2 asks for chunk 2 whole. In chunk then table order. The next IDs are one past the largest written. Null
 * when nothing is left, when the record is past chunk 5, or when no v4 record is given. */
export function continuationAsk(texts: readonly string[]): ContinuationPlan | null {
  const chunks = texts.flatMap(t => splitRecordChunks(t)).map(text => ({ text, t: readRecordTables(text) })).filter(x => x.t.version === 'v4' && x.t.chunk);
  if (!chunks.length) return null;
  const recordId = chunks.at(-1)!.t.chunk!.recordId, own = chunks.filter(x => x.t.chunk!.recordId === recordId).sort((a, b) => a.t.chunk!.chunk - b.t.chunk!.chunk);
  const last = own.at(-1)!, chunk = Math.max(...own.map(x => x.t.chunk!.chunk)) + 1;
  if (chunk > 5) return null;
  const basis = own[0]!.t.chunk!.basis, project = (own[0]!.t.chunk!.title.replace(/\s*기록\s*v4.*$/, '').trim()) || '이 프로젝트';
  const done = new Map<string, { chunk: number; state: string; included: string; remaining: string }>();
  for (const x of own) for (const table of x.t.byId.get('C-DONE') ?? []) for (const r of table.rows) {
    const id = (r.byColumn['표 ID'] ?? '').trim(), state = fixedWord(r.byColumn['작성 상태'] ?? '', DONE_WORDS)?.value; if (!/^(?:C-[A-Z]{2,12}|P\d-\d{2})$/.test(id) || !state) continue;
    done.set(id, { chunk: x.t.chunk!.chunk, state, included: (r.byColumn['수록 범위'] ?? '').trim() || '—', remaining: (r.byColumn['남은 범위'] ?? '').trim() || '—' });
  }
  const written = new Set(own.flatMap(x => x.t.tables.filter(t => t.header.length || t.none || t.body.length).map(t => t.id)));
  const left = (s: string) => !!s && !/^[—–-]+$/.test(s.trim());
  const want: { id: string; state: string; included: string; remaining: string; order: number }[] = [];
  const order = (id: string, c: number) => c * 100 + Math.max(0, [...V4_TABLES, ...PROFILE_TABLES].findIndex(t => t.id === id));
  for (const [id, d] of done) if ((d.state === 'partial' || d.state === 'deferred' || (d.state === 'done' && left(d.remaining))) && TABLE_DEFS.has(id))
    want.push({ id, state: DONE_LABEL[d.state]!, included: d.included, remaining: left(d.remaining) ? d.remaining : '표 전체', order: order(id, d.chunk) });
  const has2 = own.some(x => x.t.chunk!.chunk >= 2);
  if (!has2) for (const id of CHUNK2) if (!want.some(w => w.id === id)) want.push({ id, state: '덩이 2 없음', included: '—', remaining: '표 전체', order: order(id, 2) });
  for (const t of V4_TABLES) if ((t.chunk === 1 || has2 && t.chunk === 2) && t.id !== 'C-DONE' && !done.has(t.id) && !written.has(t.id) && !want.some(w => w.id === t.id))
    want.push({ id: t.id, state: DONE_LABEL.missing!, included: '—', remaining: '표 전체', order: order(t.id, t.chunk) });
  const focus = own.map(x => x.t.focus).find(Boolean);
  for (const id of focus?.tables ?? []) if (!written.has(id) && !done.has(id) && !want.some(w => w.id === id)) want.push({ id, state: '초점 줄에 고름', included: '—', remaining: '표 전체', order: order(id, 2) });
  if (!want.length) return null;
  want.sort((a, b) => a.order - b.order);
  // The next ID of each kind: one past the largest any chunk wrote.
  const all = own.map(x => x.text).join('\n'), top = (re: RegExp) => Math.max(0, ...[...all.matchAll(re)].map(m => Number(m[1])));
  const pad = (n: number) => String(n).padStart(2, '0');
  const next = `부분 B${pad(top(/\bB(\d{1,3})\b(?!:)/g) + 1)} · 산출물 D${pad(top(/\bD(\d{1,3})\b/g) + 1)} · 변형 X${pad(top(/\bX(\d{1,3})\b/g) + 1)} · 진입 N${pad(top(/\bN(\d{1,3})\b/g) + 1)} · 외부 계약 K${pad(top(/\bK(\d{1,3})\b/g) + 1)} · 단계·반복은 부분마다 그다음 번호 · 보충 표는 「표 ID.{다음}」`;
  const section = (w: { id: string; state: string; included: string; remaining: string }) => {
    const t = TABLE_DEFS.get(w.id)!, note = t.profile ? `${t.id} ${t.title} (${t.rows}행). ${t.note}` : TABLE_NOTES[w.id] ?? '';
    return [`${t.id} ${t.title} — 앞 덩이: ${w.state} · 실은 범위: ${w.included} · 이번에 쓸 범위: ${w.remaining}`, ...(t.columns.length ? [headerLine(t)] : []), ...(note ? [note] : [])].join('\n');
  };
  const head = CHUNK_HEAD_FORM.replace('{기록 ID}', recordId).replace('{n}', String(chunk)).replace('{sha}', basis).replace('{프로젝트 이름}', project).replace('기록 v4 (', '기록 v4 이어서 (');
  const text = `[AgentFlow 기록 이어쓰기 요청 ${RECORD_ASK_V4_VERSION} · 기록 ${recordId} · 덩이 ${chunk}]
앞서 쓴 기록 ${recordId}(${project}, 기준 ${basis})를 이어 써 줘. 같은 기준 판본을 읽고 아래 「쓸 표」만 쓴다. 앞 덩이에 쓴 행은 다시 쓰지 마. 앞 덩이의 행이 틀렸으면 고치지 말고 같은 표에 행 ID 칸이 「정정 B03」처럼 「정정 」과 그 ID인 행을 새로 쓴다. 앞 덩이가 이미 정했거나 가리킨 ID는 그대로 쓰고, 새 행의 ID만 「다음 ID」부터 쓴다. 쓸 표는 아래 차례(덩이 순, 표 순)대로. 지금 읽을 수 있는 판본이 기준과 다르면 첫 줄 다음에 「기준 바뀜: 지금 sha」 한 줄만 쓰고 멈춰.
첫 줄은 ${head}, 둘째 줄은 앞 덩이와 같은 「경로 약속:」 줄, 마지막은 C-DONE 완료표.
${CONTINUATION_CHARS.toLocaleString('en-US')}자를 넘기지 마. 바이트가 아니라 글자 수이고 정확한 수는 앱이 센다. 다 못 쓰면 덜 중요한 행부터 덜어 내고, C-DONE에 「일부 작성」이나 「분량상 이월」과 남은 범위를 적어. 앱이 다음 이어쓰기를 만든다.
규칙은 기록 요청 ${RECORD_ASK_V4_VERSION}와 같다. 표마다 제목 줄 「표 ID 제목」 다음에 아래 머리 줄을 글자 그대로. 마지막 열 근거에 [파일: 경로] / [보고: 출처·날짜] / [실행: 명령] / [추정] / [모름] 하나(그 부분의 담당 파일이면 [=]). 칸 값의 모름은 대괄호 없이 「모름」. 찾아봤더니 없으면 머리 줄 대신 「없음: 확인한 범위 [근거]」. 칸 안의 |는 &#124;. 비밀은 [가림]. 읽기 명령만 쓰고 코드를 고치거나 새로 돌리지 마.
${NO_INVENTION.join('\n')}

쓸 표 (${want.length}개, 앞 덩이의 C-DONE에서)
${want.map(section).join('\n')}

다음 ID: ${next}

${TABLE_DEFS.get('C-DONE')!.id} ${TABLE_DEFS.get('C-DONE')!.title}
${headerLine(TABLE_DEFS.get('C-DONE')!)}
이번 덩이에 쓴 표마다 한 줄. 작성 상태 하나: 작성 완료 / 일부 작성 / 해당 없음 / 확인 못함 / 분량상 이월. 수록 범위는 이번 덩이에 실은 범위, 남은 범위는 남은 것과 그 위치(없으면 —).

기록 ID: ${recordId}`;
  return { recordId, basis, project, chunk, tables: want.map(({ order: _o, ...w }) => w), next, text };
}
/** What the record asks offer (the record-asks UI): one sentence for the v4 request and the continuation. */
export const RECORD_V4_EXPLAIN = '지금 상태와 설계를 표로, 길면 두 덩이로 한 답에 써 줘요. 답을 통째로 붙여 넣으면 앱이 덩이를 나눠 읽고, 모자란 표는 이어쓰기 요청을 만들어 줘요.';
export const CONTINUATION_EXPLAIN = '앞서 붙인 기록 v4의 완료표에서 남은 표만 모은 요청이에요. 같은 AI 대화에 붙여 넣고, 나온 답을 다시 기록 붙여넣기에 넣으세요.';

/* ---------- Recipe .45: 기록 요청 v5 (docs/design/RECORD_ASKS_V5_KO.md; sections 12 and 13 over the earlier ones): the base request (the
 * first structure Q1 and the detail Q2, page by page within 12,000 characters, the F and E ledgers cited by explicit ID, 표현군·역할 by
 * the part's main contract, C-CHECK, search-based history), the page request the app builds from the folded record (what to fix, what to
 * resolve, the remaining obligations and the next tables only, with only the rules they need) and, after level 2 only, the supplementary
 * request of the groups the record's own gaps call for. The supplementary tables are never named in the base request. Header rows come
 * from record-table.ts (the parser's own v5 definitions). ---------- */
/** Recipe .48: v5.1 (the role words the app reads as a type in the C-PART note, and a setting that steers a step in the C-STEP note). */
export const RECORD_ASK_V5_VERSION = 'v5.1';
/** Recipe .50 step 5 (map-identity.ts): v5.2, asked only when the project has a map: the v5.1 request with the map's roster and the C-IDENT
 * table (the record's own correspondence of the roster's parts to its B rows). Without a map the request is v5.1, byte for byte; a v5 or
 * v5.1 record (no C-IDENT) reads as before. */
export const RECORD_ASK_V52_VERSION = 'v5.2';
/** Recipe .53 (ruling F6 Q3): v5.3, the v5.2 request whose C-IDENT also has 구현 바뀜 (the same part on another implementation, a bind with the
 * change noted, never a retirement) and says when to use which answer. A v5.2 record (no 구현 바뀜) reads as before. */
export const RECORD_ASK_V53_VERSION = 'v5.3';
/** A new v5 record ID (「AF5-」 and 8 hex digits). */
export function newRecordIdV5(random: () => number = Math.random): string {
  return `AF5-${Array.from({ length: 8 }, () => Math.floor(random() * 16).toString(16)).join('')}`;
}
/** Each v5 table's lines under its header row (the page request repeats them as written). */
export const TABLE_NOTES_V5: Readonly<Record<string, string>> = Object.freeze({
  'C-HEAD': '여덟 줄, 값이 없어도 줄은 쓴다: 기준 커밋(브랜치 · sha · 매니페스트 판본) / 작성 시각 / 읽은 범위 / 못 읽은 범위(빠진 폴더, 실행 안 함, 대화 요약 여부) / 클론(전체 · 얕은 클론 커밋 N개 · 태그 N개) / 실린 판본(확인됨 · 미확인(태그 없음·얕은 클론) · 릴리스 없음) / 기본 행위자(「작성: 메인테이너(계정)」, C-CHANGE 관련 주체가 비면 이것) / 첫 구조 줄(이 프로젝트에서 실제로 중요한 책임·흐름 1~3개, 종류 이름이 아니다). 고칠 때는 항목 칸에 「교체 항목」.',
  'C-SUMMARY': '행 ID·머리 줄 없이 두 문장, 문장 끝에 「(F02)」처럼 근거: 무엇이고 누가 어떻게 쓰나 / 핵심 흐름 한 줄. 연결은 C-LINK에 따로 쓴다.',
  'C-PART': '맡은 일 단위로 5~30개(목록 한 줄은 하나). 사람(소유자·메인테이너·기여자)·봇·CI·외부 시스템·사용자 코드·설계만 있는 것·제거된 것도. 남의 코드가 부르는 라이브러리면 「사용자 코드」도 한 줄(구체 소비자를 모르면 하는 일에 「구체 대상 모름」). 자료형·오류 객체·메시지는 부분이 아니라 C-DATA·C-CONTRACT에 둔다. 같은 일을 하는 항목의 목록은 한 줄로 두고 항목은 C-GROUP 목록 행에, 따로 연결을 가진 항목만 자기 행을 갖는다. 표현군·역할은 「표현군 · 역할」(역할은 짧은 명사구), 아래 기준으로. 앱이 유형으로 읽는 말의 예: 처리는 반복·실행 조정 / 수집 / AI 판단 / 화면 / 외부 호출 / 계산(변환·검증·측정), 참여는 사람(소유자·메인테이너·기여자) / 봇 / 외부 시스템 / AI 세션(제품 안의 것). 맞는 말이 없으면 짧은 자기 역할을 쓴다(앱은 그대로 둔다). 담당 F는 F ID(여럿이면 「+」). 구현 상태: 구현됨 / 일부 구현 / 미구현 / 제거됨 / 모름 / 해당 없음(사람·봇·외부). 뒤 쪽에서 더하면 「추가 B31」.',
  'C-GROUP': '부모는 B ID 또는 C-PART에 없는 실행 위치 이름, 자식들은 B ID를 「·」로. 묶음 뜻: 실행 위치 / 구성 / 참여자 / 외부 / 목록 / 모름. 한 부분의 부모는 하나(목록은 빼고 센다): 실행 위치를 바깥에, 구성을 안쪽에. 정확히 센 목록만 개수를 쓴다. 목록 행은 부모 B의 항목을 「B12: 항목」으로 잇는다(항목은 부분이 아니다).',
  'C-LINK': '한 줄에 화살표 하나. 넘기는 것은 C-DATA 행이 있으면 앞에 D ID. 박자: 한 번 / 호출마다 / 항목마다 / 주기 / 사건 때 / 끝에 한 번 / 사람이 할 때(사람이 넘기고 때는 모름). 조건·선택: — / 조건 그대로 / 「변형 X02」. 경계: 같은 프로세스 / 자식 프로세스 / 프로세스 사이 / 네트워크 / 사람 / 모름. 주장 성격: 정의된 관계(코드·문서상의 흐름) / 실행 보고 / 실행 관측(그 연결이 일어났음을 보이는 실행 E를 인용할 때만) / 추정. 사람·사용자 코드가 부르는 화살표와 결과가 돌아가는 화살표도.',
  'C-LOOP': '반복문·재귀·주기 실행이 있는 것만. 부모 반복은 바로 바깥 반복 ID(다른 부분 것이어도), 없으면 —. 몸통은 C-STEP 소속 반복이 정하니 여기는 한 줄 설명. 한 번만 도는 준비·마무리는 몸통이 아니다. 값을 읽지 않은 횟수를 숫자로 계산해 넣지 마. 횟수·계속 조건과 종료·탈출 조건은 확인한 식 그대로, 정지·취소 경로는 종료 칸에.',
  'C-STATE': '상태 기계가 흐름을 정할 때만 5행 이내(화면 상태, 실행 상태, 요청 생명주기): 상태, 그 상태를 떠나는 사건, 다음 상태. 상세 전이는 쓰지 않는다. 없으면 C-END에 해당 없음(남은 것에 이유).',
  'C-WITHDRAW': '철회·폐기·채택 안 함을 빠뜨리지 마. 방식: 되돌림 / 제거 / 폐기 예정 / 문서로만 폐기(실행 경고 없음) / 옮김 / 기본값 바꿈 / 채택 안 함 / 다시 도입. 계약 변화: — / 깨짐: K ID 또는 무엇 / 호환: 무엇 / 모름.',
  'C-STATUS': '할 말이 있는 대상만 8줄까지(B ID · 배포 단위 · 전체). 차원과 값: 릴리스(릴리스됨 / 미릴리스 / 회수됨 / 릴리스 없음 / 모름) · 배포(배포됨 / 미배포 / 철회됨 / 모름) · 활성 방식(항상 적용 / 조건부 / 비활성 / 모름) · 유지 방침(기능 개발 / 수정만 / 사용 중단 권고 / 유지 종료 / 모름, 「(후속: 이름)」) · 운영 상태(실행 중 / 유휴·대기 / 정지 / 실패 / 모름). 일부만 꺼졌으면 적용 범위에 「기능 일부(이름)」 또는 「기본 꺼짐(켜는 설정)」. 배포됨은 판본·환경·반영 기록이 있을 때만. 매니페스트의 판본은 선언된 판본만, Git 태그는 태그가 있다는 것만 증명한다. 배포 설정·스크립트가 있다는 것은 배포 근거가 아니고, 병합은 미배포를 뜻하지 않는다. 명시된 유지 방침만 쓴다(활동량으로 추정하지 마). 기준이 C-HEAD와 같으면 —.',
  'C-CHECK': '여섯 행 고정. 결과: 있음 / 없음 / 확인 못함(없음에는 찾은 방법이 꼭). 찾은 것은 결과를 담은 ID들이고, 표에 없으면 그 표에 행을 더한다.\nCK1 시간·배경 실행: 조사 범위에서 찾은 타이머·주기 작업·cron·스레드·워커·백그라운드 작업과 못 확인한 범위(전수 조사라는 뜻이 아니다)\nCK2 정지·취소 경로: 신호·취소 토큰·종료 훅·강제 종료\nCK3 사람 관문: 사람이 승인하거나 손으로 해야 흐름이 이어지는 곳\nCK4 사람 역할 분리: 권한이나 경로가 다른 사람 역할마다 참여 부분 하나\nCK5 이력 검색: 아래 검색의 검색어·대상(메시지/변경 내용)·맞은 수·가장 오래된 날짜·얕은 이력 여부(못 찾았으면 「접근 가능한 이력에서 이 검색으로 찾지 못함」)\nCK6 폴더 하나 = 부분 하나: 담당 F가 폴더 하나이고 C-LINK가 3행 이상이며 C-STEP이 없는 부분의 안을 읽었나(안 읽음이면 C-UNKNOWN에, 너무 크면 하위 부분 후보)',
  'C-STEP': '중심 부분부터 실행 순서대로(둘 중 하나만 도는 갈래 B03:S04a·b). 상한은 없고 넘치면 다음 쪽에 같은 부분을 이어 쓴다. 한 줄에 한 단계, 코드에 없는 단계를 지어내거나 합치지 마. 소속 반복은 가장 안쪽 반복 ID(둘이면 「+」), 밖이면 —. 조건·분기: 「→ B03:S06」, 거부 사유 코드 그대로, 「→ B03:S02, 최대 3번」. 모델이면 「모델:」. 단계를 바꾸는 기본값·설정은 하는 일 끝에 「(기본값: 키=값)」. 순서 있는 목록이 20개를 넘으면 단계로 펼치지 말고 C-GROUP 목록으로.',
  'C-DATA': '부분 사이를 오가는 자료·파일·테이블·메시지마다. 종류: 외부 계약(K ID) / 내부 자료 / 저장 / 메시지·신호. 필드·모양은 코드의 이름 그대로(넓으면 키 몇 개와 「그 밖 N개」). 만드는·읽는 부분은 직접 만들고 읽는 B ID만(지나가게만 하는 부분은 빼), 방향 없이 함께 쓰고 읽으면 두 칸 모두 「공유: B05·B07」. 있는 곳은 경로(메모리·DB 이름), 쓰기 방식은 확인했을 때만 괄호로: 덧붙임 / 통째 교체 / 원자 교체.',
  'C-COND': '한 줄에 조건 하나, 식은 적힌 그대로. 참이면·거짓이면은 결과·사유 코드·가는 곳(다음 검사면 「다음」). 갈리는 때: 실행 시 / 설정 읽을 때 / 빌드·컴파일 시(둘이면 「+」). 첫 구조를 바꾸는 행(지도의 부분이나 연결을 가르는 모드 스위치)은 첫 구조 쪽에 쓴다(쪽의 차례).',
  'C-CHANGE': '새것부터: 아래 검색에서 고른 큰 변화와 최근 6줄. 날짜는 작성과 병합이 다르면 「작성 / 병합」. 관련 주체·역할: 「역할: 주체」를 「+」로(요청 / 제안 / 작성 / 검토·승인 / 병합; 소유자 / 메인테이너(계정) / 기여자(계정) / 봇(이름) / 이슈 #번호(작성자) / 모름), 작성자와 커밋한 이가 다르면 「작성: A + 병합: B」(커밋한 이가 GitHub뿐이면 병합: 모름), 비면 C-HEAD 기본 행위자. 「요청:」은 따로 적힌 요청(대화·이슈)이 있을 때만이고, PR 작성자가 스스로 낸 변화는 「작성: 그 사람」뿐이다. 봇의 의존성 갱신 같은 잔수정은 한 줄에 묶고 개수를 쓴다. 원한 것은 적힌 요청 원문만 「」로, 없으면 —(본문을 못 읽었으면 「이슈 본문 미확인(#번호)」). 찾은 길: 검색 / 최근 / 변경 기록. 계약 변화는 C-WITHDRAW와 같고, 깨짐은 깨짐 표시·BREAKING 문구·메이저 판본·제거된 인자·이주 안내 같은 근거가 있을 때만. 실린 판본: 릴리스 / 미릴리스 / 모름(C-HEAD가 미확인이면 —).',
  'C-RULE': '정한 이는 정한 사람·문서(모르면 모름). 지키는 장치: 코드 / 검사 / 사람 / 없음 / 모름(「+」). 코드의 검사가 막으면 장치는 코드. 장치 위치는 파일·함수 또는 사람(없음·모름이면 —). 믿지 않는 입력·권한·비밀을 지키는 규칙도.',
  'C-ENTRY': '시작되거나 불리는 곳마다. 많으면 기능 묶음마다 한 줄에 정확히 센 개수. 소비자·호출 주체: B ID / 사람 / 사용자 코드 / 외부 시스템 / 일정. 호출 방식: 명령 / 함수·클래스 호출 / HTTP·WS 요청 / 메시지·사건 / 일정 / 상주 / 손으로 돌리는 스크립트(차례는 「1) 」). 계약 ID는 K ID 또는 —.',
  'C-VARIANT': '같은 계약·접점의 구현마다(어댑터·드라이버·실행 전략·플랫폼 구현·저장 백엔드·실행 모드). 접점은 K ID 또는 「B03: 자리 이름」, 사용자가 끼우는 자리면 구현 부분 「사용자 지정」. 선택 주체·시점: 누가(사용자 설정 / 코드 / 플랫폼·빌드)·어떻게(지정 / 우선순위로 첫 가능 항목 / 실패하면 다음)·언제(빌드 시 / 시작 시 / 호출마다). 함께 사용: 배타 / 병용 가능 / 자료마다(어떤 자료) / 모름, 범위는 괄호로. 첫 구조를 바꾸는 변형(실행 모드·저장 백엔드처럼 지도의 부분이나 연결이 갈리는 것)은 첫 구조 쪽에 쓴다(쪽의 차례).',
  'C-CONTRACT': '경계 바깥이 의존하는 약속만(공개 함수·명령의 입출력, 파일·응답 형식, 종료·오류 코드, 프로토콜). 내부 구조체는 아니다. 소비자를 모르면 「사용자 코드—구체 대상 모름」. 적용 판본은 형식 판본이 있을 때만.',
  'C-ISSUE': '평문 비밀은 위치만.',
  'C-GATE': '근거 있는 관문만 0~5줄. 없음을 확인했으면 머리 줄 대신 「없음: 이유 근거」.',
  'C-UNKNOWN': '',
  'C-DOUBT': '1~3줄.',
  'C-IDENT': 'C-PART 바로 다음에 쓴다(같은 쪽에 자리가 없으면 다음 쪽 첫머리). 제목 줄 바로 아래, 머리 줄 위에 한 줄 「대장: 」을 쓰고 그 뒤에 지도 대장 첫 줄의 「프로젝트 … · 판 … · 해시 … · P01–P…」를 글자 그대로 옮긴다. 대장의 부분마다 많아야 한 줄, 이 기록에서 확인한 것만 쓴다(쓰지 않은 부분은 앱이 그대로 둔다). 대응: 같음(같은 책임을 맡는 같은 대상) / 이름 바뀜(같은 대상을 이 기록이 다른 이름으로 부름) / 구현 바뀜(같은 책임이 이어지고 그 일을 하는 구현·도구·서비스만 바뀜) / 대신함(그 부분 자체가 끝나고 이 기록의 B가 그 일을 넘겨받음, 그 부분은 이 기준에서 더 쓰이지 않음) / 없어짐(대신하는 것 없이 더 쓰이지 않음) / 모름. 고르는 법: 대장의 부분이 이어지는 책임(OCR 단계, CI, 폴더 감시처럼 하는 일로 정한 부분)이면 같음이나 구현 바뀜이고, 엔진·라이브러리·서비스를 바꿨어도 대신함이 아니다. 대신함은 그 부분 자체가 끝나고 다른 것이 넘겨받았을 때만 쓴다. 새것이 더해졌다는 것만으로 옛것이 끝났다고 보지 않는다(옛것이 지워지거나 꺼진 커밋·파일이 근거로 있어야 한다). 이 기록 부분: 같음·이름 바뀜·구현 바뀜·대신함이면 B ID 하나, 없어짐·모름이면 —. 바뀐 때: 이름 바뀜·구현 바뀜·대신함·없어짐이 일어난 커밋·날짜(모르면 모름, 같음이면 —). 아직 계획이면 「계획」, 일부만 바뀌었으면 「일부: 무엇」을 앞에 쓴다(앱은 계획·일부로는 아무것도 없애지 않는다). 근거는 이 기록의 F·E ID만: 같은 파일·경로, git log --follow, 이름을 바꾸거나 지운 커밋·PR. 근거 없는 대응은 후보로만 읽힌다. 기준 커밋이 다르다는 것만으로 다른 대상이 아니고, 이름이 비슷하다는 것만으로 같은 대상도 아니다. 대장의 부분이 이 기준에 보이지 않으면 git log --follow나 git log -S 이름으로 지우거나 옮긴 커밋을 찾아 근거로 쓰고, 못 찾으면 모름. 하나가 둘로 나뉘었거나 둘이 하나로 합쳐졌으면 그 부분마다 모름으로 쓰고 C-DOUBT에 적는다. P ID는 이 표에만 쓴다.',
  'C-SRC': '기록 전체에서 이어 매기고, 쪽마다 그 쪽이 처음 인용하는 F만 쪽 머리 바로 뒤에(없으면 안 쓴다). 경로는 저장소 뿌리 기준(폴더는 끝에 /). 읽음: 읽음 / 일부(읽은 범위를 역할에) / 안 읽음. 실행 때 생기는 것은 역할에 「(실행 시)」, 생성물·시험·문서는 폴더 한 줄로.',
  'C-EVID': '파일보다 좁은 근거(함수, 명령 결과, 커밋·PR·릴리스 기록)가 필요할 때만, 쪽 머리 바로 뒤에. 등급: 파일(출처 칸에 F ID) / 실행(출처는 이 대화에서 돌린 읽기 명령) / 보고(커밋 sha · PR #n · 이슈 #n · 문서 이름 날짜 · 세션 이름 시각). 자리는 함수·줄 범위·절. 짧은 인용은 부정어와 조건을 자르지 않은 짧고 연속된 정확 인용이거나 —.',
  'C-DROP': '앞 쪽의 행을 지울 때만, 행 ID 칸에 쓴 ID 그대로(두 표에 같은 ID면 「C-STATE ST01」). 앱 형식 때문에 지우면 근거는 「앱 진단」. 지운 ID는 다시 쓰지 않는다.',
  'C-END': '이 쪽이 손댄 표와 다음에 쓸 표만. 상태: 끝남 / 이어짐(이 행에서 멈춤) / 아직 / 해당 없음(남은 것에 이유) / 확인 못함. 쓴 행은 ID 범위(LN01–LN09). 예약은 이 쪽 행이 가리키는데 아직 안 쓴 ID와 이름. 표 아래 두 줄: 「완료 단계: 진행 중 / 첫 구조 완료 / 상세 완료」와 「다음: 표 ID(시작 행)」. 완료는 앱이 다시 센다.'
});
/** 표현군 기준 (3.1 as 12.3 states it): the main-contract question and the criteria, in the base request and wherever C-PART is asked. */
export const FAMILY_RULES = `표현군 기준 — 「이 부분을 지도에서 어떤 책임의 단위로 다루나」(주된 계약)로 고른다. 이름이 아니라 하는 일로 고른다.
- 참여: 이 코드의 통제 밖에서 일·요청·판단을 주고받는다(사람·봇·외부 시스템·사용자 코드). 개발에 쓴 AI 세션은 부분이 아니다.
- 처리: 입력을 바꾸거나 판정하거나 나누거나 실행을 조정한다. 통과만 시키는 얇은 층은 부분이 아니다.
- 저장: 호출을 넘어 자료나 상태를 지니고 내준다. 내부 변수가 있다는 것만으로 저장이 아니다.
- 촉발: 시간·사건·감시로 스스로 실행 신호를 낸다. 시간 신호만 내는 스케줄러는 촉발이고, 작업 배정을 조정하면 처리다. 반복하거나 기다린다는 것만으로 촉발이 아니다.
- 관문: 통과·차단·허용을 실제로 집행하고 막으면 흐름이 멈춘다. 평가기는 처리이고, 그 결과로 막는 부분이 관문이다. 보고만 하는 검사는 관문이 아니다.
- 미정 · 이유(책임 설명 부족 / 서로 다른 역할 혼재(후보) / 대상 범위 불명확): 주된 계약을 정할 수 없을 때만. 주된 계약이 분명하면 역할이 섞여도 그 표현군이다. 표현군을 붙이려고 부분을 쪼개거나 그럴듯한 것을 억지로 붙이지 마.
반복은 표현군이 아니라 C-LOOP에, 진입점·어댑터·확장 지점·신호는 C-ENTRY·C-VARIANT에 쓴다.`;
/** The history search (5.1 as 13.1 widens it), in the base request and wherever C-WITHDRAW or C-CHANGE is asked. */
export const HISTORY_SEARCH = `이력 검색 — C-WITHDRAW와 C-CHANGE는 같은 검색에서 고른다: git log -i -E --grep='revert|remove|deprecat|breaking|drop|rollback|restore|reintroduc|rewrite|replace|migrat' --format='%h %ad %s' --date=short 전부, CHANGELOG·릴리스 노트의 Removed·Deprecated·Breaking 절. 맞은 것 중 철회·폐기·채택 안 함은 부분마다 묶어 C-WITHDRAW, 철회가 아닌 것(낱말만 맞은 것)은 C-CHANGE(찾은 길 검색)나 버리고, 큰 변화와 최근 변화 6줄도 C-CHANGE. 어떤 행의 근거 문구를 나중 커밋이 바꿨으면 C-DOUBT에.`;
/** The kinds of projects' first-structure lines (6, as 12.6 keeps them): reference sentences only, never a kind assigned. */
const FIRST_LINES_REF = `첫 구조에서 먼저 볼 것(참고일 뿐이고 C-HEAD에 종류를 적지 않는다. 섞인 프로젝트는 여럿을 본다):
- 라이브러리: 공개 진입·계약, 확장 지점, 사용자 코드의 책임. 모든 것을 한 실행 순서로 늘어놓지 마.
- 명령줄 도구: 명령 분배, 실행 단위, 종료·실패, 자식 프로세스. 모든 명령을 같은 깊이로 쓰지 마.
- 웹 앱·서비스: 화면·요청 진입, 서버와 클라이언트 경계, 인증 조건, 저장. 라우터 이름으로 업무 흐름을 정하지 마.
- 게임·실시간 화면: 상태와 사건 반응, 갱신 주기마다 하는 일, 공유 자원. 모든 기능을 한 반복 몸통에 넣지 마.
- 에이전트: 조정 책임, 도구·위임, 종료·재시도, 사람 개입. 개발에 쓴 AI 세션을 제품의 에이전트로 보지 마.
- 워크플로 엔진: 정의·일정·실행기 분리, 의존 조건, 실행 상태. 엔진 내부와 개별 워크플로를 섞지 마.
- 학습·자료 스크립트: 준비·학습·평가·추론의 관계, 중첩 반복, 체크포인트·옵션. 초기화·검증·기록을 모든 단계에 필수처럼 쓰지 마.
부분이 30개쯤이면 첫 구조만으로 12,000자에 가까워 두 쪽에 걸칠 수 있다.`;
const PAGE_HEAD_FORM = '「〔기록 {기록 ID} · 쪽 {n} · 기준 {sha} · 앞 쪽 {n-1}〕 {프로젝트 이름} 기록 v5 (쓴 세션, 날짜·시각)」';
/** The shared rules of every v5 request (the base request, the page and supplementary requests). */
const COMMON_V5 = `공통 규칙
- 근거: 마지막 열 「근거」에 F·E ID를 「+」로(F03+E04), 네 판단이면 「추정」 또는 「추정(F03)」, 모르면 「모름」. 「=」나 생략은 쓰지 않는다. 등급은 장부(C-SRC 읽음, C-EVID 등급)에만 둔다. ‘통과·OK·완료’는 실행 등급 E가 없으면 보고이고, 보고를 실행으로 올리지 마. 이 기록을 쓰려고 코드를 고치거나 검사·프로그램을 새로 돌리지 마(읽기 명령만).
- 「부분」으로 끝나는 칸과 부모·자식들·대상·소유 부분 칸에는 B ID(여럿이면 「·」), 프로젝트 전체는 「전체」. 칸 값의 모름은 「모름」, 없음은 찾아봤더니 없음, 해당 없음은 질문이 성립하지 않음.
- 행이 없는 표: 찾아봤더니 없으면 머리 줄 대신 「없음: 확인한 범위 근거」. 성립하지 않으면 C-END에 해당 없음과 이유, 확인 못했으면 확인 못함.
- 칸 안의 |는 &#124;, 칸 안에 줄바꿈이나 긴 코드 전문은 넣지 마. 「|」 양옆 공백은 빼도 된다.
- 키·토큰·비밀번호·접속 주소의 비밀 부분·경로 속 사용자 이름은 [가림]. .env 같은 비밀 파일은 열지 마. 이 요청문은 옮기지 말고 기록 밖의 말은 쓰지 마.`;
/** A v5 table's section: its title line, its header row (none for C-SUMMARY) and its notes, recipe .46: led by the row-ID form its rows take. */
const tableSection5 = (id: string, notes: Readonly<Record<string, string>> = TABLE_NOTES_V5): string => {
  const t = V5_TABLE_DEFS.get(id)!, form = rowIdForm(t), note = [form ? `${t.columns[0] === 'F ID' || t.columns[0] === 'E ID' ? t.columns[0] : '행 ID'} ${form}.` : '', notes[id] ?? (t.profile ? `(${t.rows}행) ${t.note}` : '')].filter(Boolean).join(' ');
  return [`${t.id} ${t.title}`, ...(t.columns.length ? [headerLine(t)] : []), ...(note ? [note] : [])].join('\n');
};
/** Recipe .54 (ruling F6 Q1): the notes of a v5.3 request (a project with a map): its C-HEAD 기준 커밋 line also asks for the base commit's
 * date, so a record's target time (map-reading.ts foldTarget) is known and a description is never replaced by a record whose order is unclear
 * for want of it. A v5.1 request (no map) keeps its notes byte for byte. */
const BASIS_COMMIT_V5 = '기준 커밋(브랜치 · sha · 매니페스트 판본)', BASIS_COMMIT_V53 = '기준 커밋(브랜치 · sha · 기준 커밋 날짜(YYYY-MM-DD) · 매니페스트 판본)';
export const TABLE_NOTES_V53: Readonly<Record<string, string>> = Object.freeze({ ...TABLE_NOTES_V5, 'C-HEAD': TABLE_NOTES_V5['C-HEAD']!.replace(BASIS_COMMIT_V5, BASIS_COMMIT_V53) });
/** Recipe .46: every common table's row-ID form on one line (sessions invented G01, C01, W01 when the request named only some). */
export const ROW_ID_FORMS = `행 ID 꼴: ${[...Q1_TABLES, ...Q2_TABLES, 'C-SRC', 'C-EVID'].flatMap(id => { const f = rowIdForm(V5_TABLE_DEFS.get(id)!); return f ? [`${id} ${f}`] : []; }).join(' · ')}. C-HEAD·C-SUMMARY·C-END에는 행 ID가 없고, C-DROP의 행 ID는 지울 ID다.`;
/** Recipe .50 step 5: the roster block of a v5.2 request (map-identity.ts mapRoster's text, its first line the roster line the reply copies). */
const rosterSection = (text: string): string => `지도 대장
이 프로젝트에는 이미 지도가 있다. 아래 대장은 앱이 지금 지도에서 뽑은 부분 목록이다(한 줄에 「P ID 공식 이름 · 부모 · 상태 · 구별 말」, 옛 이름·지금 구현·기록이 부른 이름·옛 ID가 있으면 뒤에). P ID는 지도의 부분 번호로 이 기록의 B ID와 다르고, C-IDENT에만 쓴다(다른 표의 부분 칸에는 이 기록의 B ID). 대장은 앞선 이해일 뿐 이 기록의 근거가 아니다: 부분은 늘 코드에서 읽어 C-PART에 쓰고, 대장과의 대응은 C-IDENT에 이 기록의 F·E 근거로만 쓴다.
${text}`;
/** 기본 기록 요청 v5: {기록 ID} filled with the given ID (left as the slot when none). Recipe .50 step 5: with the map's roster (a project
 * that has a map), v5.2: the roster after the common rules and C-IDENT right after C-PART; without it, v5.1 as it was. */
export function recordAskV5(recordId: string = ID_SLOT, roster: { text: string } | null = null): string {
  const q1 = Q1_TABLES.flatMap(id => roster && id === 'C-PART' ? [id, 'C-IDENT'] : [id]);
  return `[AgentFlow 기록 요청 ${roster ? RECORD_ASK_V53_VERSION : RECORD_ASK_V5_VERSION}]
이 프로젝트를 처음 보는 사람이 이어서 일할 수 있게, 지금 상태와 설계를 코드·문서·기록에서 읽어 아래 표로 써 줘. 표는 마크다운이다(머리 줄 다음에 |---| 줄). 표마다 제목 줄 「표 ID 제목」을 쓰고 바로 아래에 머리 줄을 글자 그대로 쓴다. 표 ID가 앱이 표를 찾는 열쇠다.

쪽
- 기록은 쪽으로 쓴다. 쪽마다 첫 줄은 ${PAGE_HEAD_FORM.replace('{기록 ID}', recordId)}(쪽 1이면 앞 쪽 —), 끝은 C-END 표와 그 아래 두 줄. 쪽마다 12,000자 이하다(바이트가 아니라 글자 수, 셀 수 있으면 LC_ALL=C.UTF-8 wc -m). 한 답에 여러 쪽을 이어 써도 된다.
- 차례: 첫 구조(C-HEAD부터 C-CHECK까지)를 먼저 다 쓰고, 그다음 상세(C-STEP부터 C-DOUBT까지). 다음 행이 12,000자를 넘기면 그 행 앞에서 쪽을 끝내고 C-END에 이어짐, 다음 쪽 첫머리에서 잇는다. C-PART는 쪽 1에 통째로 쓰고, 첫 구조가 끝나면 그 쪽도 끝낸다. 다만 첫 구조를 바꾸는 C-COND·C-VARIANT 행은 첫 구조 쪽에 함께 쓰고, 그 쪽 C-END에서 그 표는 이어짐.
- 쪽 머리 바로 뒤에 그 쪽이 처음 인용하는 C-SRC·C-EVID 행만 둔다(앞 쪽에 있으면 다시 쓰지 않고, 없으면 그 표도 없다).
- 모든 행 첫 열은 행 ID다(C-HEAD는 항목, C-END는 표 ID). ${ROW_ID_FORMS}
- ID는 표마다 번호를 늘리기만 하고, 한 번 쓴 ID는 지운 뒤에도 다시 쓰지 않는다. 앞 쪽 행을 고치려면 행 ID 칸에 「교체 B07」로 행 전체를 다시 쓰고, 지우려면 C-DROP, ID를 바꾸려면 새 ID로 쓰고 옛 ID를 C-DROP. 같은 쪽을 고쳐 다시 보낼 때는 그 쪽 전체를 다시 쓴다: 나중 글이 앞 글을 통째로 대신한다(같은 글이면 바뀌지 않는다).
- 이 쪽 행이 아직 안 쓴 행을 가리키면(C-LINK가 D02를) C-END 예약 칸에 「D02 이름」.
- 짧아도 된다. 빈 칸이 꾸민 칸보다 낫다. 읽을 수 있는 판본이 기준과 다르면 머리 줄 다음에 「기준 바뀜: sha」만 쓰고 멈춘다.

${COMMON_V5}
${roster ? `
${rosterSection(roster.text)}
` : ''}
지어내지 마
${NO_INVENTION_V5.join('\n')}

${FAMILY_RULES}

${HISTORY_SEARCH}

${FIRST_LINES_REF}

첫 구조

${q1.map(id => tableSection5(id, roster ? TABLE_NOTES_V53 : TABLE_NOTES_V5)).join('\n\n')}

상세

${Q2_TABLES.map(id => tableSection5(id)).join('\n\n')}

쪽마다

${PAGE_END_TABLES.map(id => tableSection5(id)).join('\n\n')}

기록 ID: ${recordId}`;
}
/** What the v5 asks offer (record-asks.ts). */
export const RECORD_V5_EXPLAIN = '첫 구조(부분·연결·반복·철회·상태·점검)를 먼저, 상세를 쪽으로 이어 쓰게 하는 요청이에요. 답을 통째로 붙여 넣으면 앱이 쪽을 접어 읽고, 남은 의무가 있으면 쪽 요청을 만들어 줘요.';
export const PAGE_ASK_EXPLAIN = '붙여 넣은 기록 v5의 쪽을 접어 앱이 센 남은 의무(고칠 것, 예약, 다음 표)만 모은 요청이에요. 같은 AI 대화에 붙여 넣고, 나온 쪽을 다시 기록 붙여넣기에 넣으세요.';
export const SUPPLEMENT_ASK_EXPLAIN = '상세까지 끝난 기록 v5에 기록의 공백이 부르는 보충 묶음만 청하는 요청이에요. 같은 AI 대화에 붙여 넣으세요.';
/** The ranges of IDs (「LN01–LN09」) a list holds, consecutive runs joined. */
function idRanges(ids: readonly string[]): string {
  const out: string[] = [];
  for (let i = 0; i < ids.length;) {
    const m = /^(.*?)(\d+)$/.exec(ids[i]!); let j = i;
    if (m) while (j + 1 < ids.length) { const n = /^(.*?)(\d+)$/.exec(ids[j + 1]!); if (!n || n[1] !== m[1] || Number(n[2]) !== Number(/\d+$/.exec(ids[j]!)![0]) + 1) break; j++; }
    out.push(j > i ? `${ids[i]}–${ids[j]}` : ids[i]!); i = j + 1;
  }
  return out.join(', ');
}
/** The next free number of each table's own ID form in a folded record (deleted ones count: an ID is never written again). Recipe .46: each
 * named with its table (「C-STATE SM03」: sessions read a bare SM01 as C-SUMMARY's), the ledgers first, numbered within the table. */
function nextIds(f: FoldedRecord): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const next = (table: string, p: string) => {
    const used = [...(f.rows.get(table) ?? []).map(r => r.id), ...(f.dropped.get(table) ?? []), ...f.extras.filter(r => r.table === table).map(r => r.id), ...f.superseded.filter(r => r.table === table).map(r => r.id)];
    return `${table} ${p}${pad(Math.max(0, ...used.map(id => Number(new RegExp(`^${p}(\\d+)$`).exec(id)?.[1] ?? 0))) + 1)}`;
  };
  return ['C-SRC', 'C-EVID', 'C-PART', ...[...Q1_TABLES, ...Q2_TABLES].filter(t => t !== 'C-PART')].flatMap(t => { const p = V5_TABLE_DEFS.get(t)!.rowId; return p && /^[A-Z]{1,2}$/.test(p) && !['CK', 'S', 'L'].includes(p) ? [next(t, p)] : []; }).join(' · ')
    + ' · 단계·반복은 부분마다 그다음 번호';
}
/** Recipe .46: why a table is still open, in the app's words (its page's C-END word and 남은 것, or never written). */
function openReason(f: FoldedRecord, o: Obligation): string {
  const st = o.table ? f.states.get(o.table) : undefined, word = (e: string | null) => Object.entries(END_WORDS).find(([, v]) => v === e)?.[0] ?? e ?? '';
  if (o.kind === 'table-open' && st) return st.end ? `쪽 ${st.page} C-END ${word(st.end)}${st.remaining ? `: ${st.remaining}` : ''}` : `쪽 ${st.page}에 ${st.remaining ?? '일부만'}`;
  if (o.kind === 'table-skipped') return '뒤 표가 먼저 왔는데 C-END에도 쪽에도 없음';
  if (o.kind === 'table-next') return '아직 안 씀';
  return o.text;
}
/** Recipe .46: every obligation, grouped by table with a count per group, same kind and text joined with their IDs as ranges, within budget
 * characters (a group past it says how many it left out). Before level 1, one line says what holds the first structure. */
function obligationLines(f: FoldedRecord, budget = 5200): string[] {
  const groups = new Map<string, Obligation[]>();
  for (const o of f.obligations) { const k = o.table ?? '기록'; groups.set(k, [...groups.get(k) ?? [], o]); }
  const order = [...Q1_TABLES, ...Q2_TABLES], rank = (t: string) => { const i = order.indexOf(t); return i < 0 ? order.length + (t === '기록' ? 1 : 0) : i; };
  const lines: string[] = [];
  if (f.level === 0) {
    // The fixes that hold level 1 (record-table.ts recordLevel): a family word, a row's cells or ID, a missing C-CHECK row.
    const blocks = (o: Obligation) => o.kind === 'fix' && (o.text.startsWith('표현군') || /칸 수|행 ID|행 없음/.test(o.text));
    const open = Q1_TABLES.filter(t => f.states.get(t)?.state !== 'closed'), fixes = Q1_TABLES.filter(t => (groups.get(t) ?? []).some(blocks));
    lines.push(`첫 구조를 막는 것: ${[open.length ? `안 닫힌 표 ${open.join('·')}` : '', fixes.length ? `고칠 것이 있는 표 ${fixes.join('·')}` : ''].filter(Boolean).join(' / ') || '없음'}`);
  }
  let used = lines.join('\n').length;
  const sorted = [...groups].sort((a, b) => rank(a[0]) - rank(b[0]));
  sorted.forEach(([table, list], gi) => {
    const subs = new Map<string, { o: Obligation; refs: string[] }>();
    for (const o of list) { const k = `${o.kind}\u0000${o.kind.startsWith('table-') ? '' : o.text}\u0000${o.candidate}`; const s = subs.get(k) ?? { o, refs: [] }; if (o.ref) s.refs.push(o.ref); subs.set(k, s); }
    let tail = false;
    const parts = [...subs.values()].map(({ o, refs }) => {
      // A ref 「LN04·F99」 is a row and what is wrong in it: rows of the same tail as ranges, the tail once (「LN10–LN59(=)」).
      const shown = refs.slice(0, 160), more = refs.length - shown.length, tails = new Map<string, string[]>();
      for (const r of shown) { const at = r.indexOf('·'), id = at > 0 ? r.slice(0, at) : r, tail = at > 0 ? r.slice(at + 1) : ''; tails.set(tail, [...tails.get(tail) ?? [], id]); }
      const ids = shown.length ? ` ${[...tails].map(([tail, list]) => `${idRanges(list)}${tail ? `(${tail})` : ''}`).join(', ')}${more ? ` 외 ${more}개` : ''}` : '';
      return `${OBLIGATION_WORD[o.kind] ?? o.kind}${ids}: ${o.kind.startsWith('table-') ? openReason(f, o) : o.text}${o.candidate ? (tail ? ' (후보)' : (tail = true, ' (후보: 확인하고 맞으면 쓰고, 아니면 C-END 남은 것에 이유)')) : ''}`;
    });
    const line = `- ${table} (${list.length}): ${parts.join(' · ')}`;
    if (used + line.length > budget) { const left = sorted.slice(gi).reduce((n, [, l]) => n + l.length, 0); if (!lines.at(-1)?.startsWith('- … ')) lines.push(`- … 길이 때문에 ${left}개를 줄였다(다음 쪽 요청에 다시 나온다)`); used = Infinity; return; }
    lines.push(line); used += line.length + 1;
  });
  return lines;
}
const OBLIGATION_WORD: Readonly<Record<string, string>> = { fix: '고칠 것', reservation: '예약 풀기', 'table-skipped': '건너뛴 표', 'table-open': '이어 쓸 표', 'table-next': '아직 안 쓴 표',
  'loop-body': '단계 미전개 반복', 'entry-unlinked': '연결 후보', 'folder-part': '폴더 부분 후보', 'page-gap': '빠진 쪽', 'page-conflict': '같은 쪽 다른 글' };
/** Review N7: the count every screen says: the obligations that are no candidate, the candidates apart (「5개 · 후보 1개」). */
export const obligationCount = (list: readonly Obligation[]): string => { const c = list.filter(o => o.candidate).length; return `${list.length - c}개${c ? ` · 후보 ${c}개` : ''}`; };
export interface PageAskPlan { recordId: string; basis: string; project: string; page: number; level: 0 | 1 | 2; obligations: Obligation[]; tables: string[]; text: string }
/** The page request (1.4 as 12.1 and 12.7 amend it) for the latest v5 record among the texts, below level 2: the fixes, the reservations
 * to resolve, the remaining obligations (candidates said as candidates), the rows written (never to write again), the next IDs and the
 * definitions of the tables still to write, with only the rules they need. A missing page asks for that page first; another text for a
 * folded page asks which it is. Null at level 2 (the supplementary request then), past the page cap (pageCapReached says so), or with no
 * v5 record. Recipe .46: every obligation grouped by table (why each table is open), the pages a later text replaced said once, each next
 * ID with its table. */
export const PAGE_CAP = 20;
/** The next page a v5 record's page request would ask, or null (a missing page first). */
function nextPage(f: FoldedRecord): { page: number; gap: number | null } {
  const gap = f.held.length ? Math.max(...f.pages.map(p => p.n)) + 1 : null;
  return { gap, page: gap ?? Math.max(...f.pages.map(p => p.n), ...f.held.map(p => p.n)) + 1 };
}
/** Recipe .46: the record stopped short at the page cap (obligations left, no page request past PAGE_CAP): the next page and what is left;
 * null when the cap is not what stops it. */
export function pageCapReached(texts: readonly string[]): { page: number; cap: number; obligations: number } | null {
  const f = latestFold(texts); if (!f || !f.pages.length || f.level === 2) return null;
  const { page } = nextPage(f);
  return page > PAGE_CAP ? { page, cap: PAGE_CAP, obligations: f.obligations.filter(o => !o.candidate).length } : null;
}
export function pageAsk(texts: readonly string[]): PageAskPlan | null {
  const f = latestFold(texts); if (!f || !f.pages.length || f.level === 2) return null;
  const { gap, page } = nextPage(f);
  if (page > PAGE_CAP) return null;
  const project = f.title.replace(/\s*기록\s*v5.*$/, '').trim() || '이 프로젝트';
  const tables = [...new Set(f.obligations.filter(o => o.table && (o.kind === 'table-open' || o.kind === 'table-skipped' || o.kind === 'table-next' || o.kind === 'fix' || o.kind === 'loop-body')).map(o => o.table!)
    .map(t => t === 'C-LOOP' && f.obligations.some(o => o.kind === 'loop-body') ? 'C-STEP' : t))]
    .filter(t => V5_TABLE_DEFS.has(t)).sort((a, b) => [...Q1_TABLES, ...Q2_TABLES].indexOf(a) - [...Q1_TABLES, ...Q2_TABLES].indexOf(b));
  // The pages the newest text replaced (said once: on the request that follows that text).
  const lastRecord = `#${texts.length - 1}`, swapped = f.pages.filter(p => p.record === lastRecord && f.replaced.some(r => r.n === p.n)).map(p => p.n);
  const written = [...f.rows].filter(([, rows]) => rows.length).map(([t, rows]) => `${t} ${idRanges(rows.map(r => r.id))}`).join(' / ');
  const head = PAGE_HEAD_FORM.replace('{기록 ID}', f.recordId).replace('{n}', String(page)).replace('{sha}', f.basis).replace('{n-1}', String(page - 1)).replace('{프로젝트 이름}', project);
  const needs = new Set(tables), rules = [needs.has('C-PART') ? FAMILY_RULES : '', needs.has('C-WITHDRAW') || needs.has('C-CHANGE') ? HISTORY_SEARCH : ''].filter(Boolean);
  const text = `[AgentFlow 기록 쪽 요청 ${RECORD_ASK_V5_VERSION} · 기록 ${f.recordId} · 쪽 ${page}]
앞서 쓴 기록 ${f.recordId}(${project}, 기준 ${f.basis})를 쪽 ${page}부터 이어 써 줘. 같은 기준 판본만 읽는다(다르면 머리 줄 다음에 「기준 바뀜: sha」만 쓰고 멈춤). ${gap ? `쪽 ${gap}이 앱에 없다: 쪽 ${gap}을 다시 보내거나 쪽 ${gap}부터 다시 써.` : ''}
첫 줄은 ${head}, 그다음 이 쪽이 처음 인용하는 C-SRC·C-EVID 행(없으면 안 쓴다), 끝은 C-END 표와 그 아래 두 줄. 쪽마다 12,000자 이하(글자 수), 한 답에 여러 쪽을 이어 써도 된다. 앞 쪽 행을 고치면 「교체 ID」로 행 전체를, 지우면 C-DROP(행 ID 칸에 쓴 ID 그대로), ID를 바꾸려면 새 ID로 쓰고 옛 ID를 C-DROP. 앞 쪽을 고쳐 다시 보낼 때는 그 쪽 전체를 다시 쓴다(나중 글이 그 쪽을 통째로 대신한다). 쓴 ID는 다시 쓰지 마.
${swapped.length ? `쪽 ${swapped.join('·')}은 나중에 온 글로 바꿔 읽었다(앞 글은 이력에 남김).\n` : ''}
앱이 센 남은 의무 (${obligationCount(f.obligations)}, 첫 구조 ${f.level >= 1 ? '완료' : '미완료'})
${obligationLines(f).join('\n') || '- 없음'}

쓴 행(다시 쓰지 마): ${written}
다음 ID: ${nextIds(f)}

${COMMON_V5}

지어내지 마
${NO_INVENTION_V5.join('\n')}
${rules.length ? `\n${rules.join('\n\n')}\n` : ''}
쓸 표 (${tables.length}개)
${tables.map(id => tableSection5(id)).join('\n\n')}

${tableSection5('C-SRC')}

${tableSection5('C-EVID')}

${tableSection5('C-END')}

기록 ID: ${f.recordId}`;
  return { recordId: f.recordId, basis: f.basis, project, page, level: f.level, obligations: f.obligations, tables, text };
}
/** The supplementary groups a level-2 record's own gaps call for (12.4 (a)): P1 for command or request entries, P2 for outside contracts
 * or variants, P3 for artifacts that change shape, P4 for state rows, P5 for loops or background work (CK1 있음), P6 for conditions read
 * from settings or variants chosen by settings. A group the record already wrote is not asked again. */
export function supplementGroups(f: FoldedRecord): string[] {
  const rows = (t: string) => f.rows.get(t) ?? [], has = (t: string) => rows(t).length > 0, col = (t: string, c: string, re: RegExp) => rows(t).some(r => re.test(r.row.byColumn[c] ?? ''));
  const want: string[] = [];
  if (col('C-ENTRY', '호출 방식', /명령|HTTP|메시지/)) want.push('P1');
  if (has('C-CONTRACT') || has('C-VARIANT')) want.push('P2');
  if (col('C-DATA', '종류', /저장|외부 계약/)) want.push('P3');
  if (has('C-STATE')) want.push('P4');
  if (has('C-LOOP') || /있음/.test(f.byId.get('CK1')?.row.byColumn['결과'] ?? '')) want.push('P5');
  if (col('C-COND', '갈리는 때', /설정/) || col('C-VARIANT', '선택 주체·시점', /설정/)) want.push('P6');
  return want.filter(g => ![...f.rows.keys()].some(t => t.startsWith(`${g}-`)) && !f.ends.some(e => e.table === g));
}
export interface SupplementPlan { recordId: string; page: number; groups: string[]; text: string }
/** The supplementary page request (1.4 4, as 12.4 (a)): only after level 2, only the groups the gaps call for, each group's state on C-END
 * (썼음 · 해당 없음 · 미조사 · 후속 필요, 표 ID 칸에 「P4」). Null below level 2 or when no group is called for. */
export function supplementaryAsk(texts: readonly string[]): SupplementPlan | null {
  const f = latestFold(texts); if (!f || f.level !== 2) return null;
  // Review N3: the supplementary rows to fix (a P row with no row ID, or its cells off its header) are asked here, never by a page request.
  const groups = supplementGroups(f), fixes = f.obligations.filter(supplementFix); if (!groups.length && !fixes.length) return null;
  const page = Math.max(...f.pages.map(p => p.n)) + 1, project = f.title.replace(/\s*기록\s*v5.*$/, '').trim() || '이 프로젝트';
  const head = PAGE_HEAD_FORM.replace('{기록 ID}', f.recordId).replace('{n}', String(page)).replace('{sha}', f.basis).replace('{n-1}', String(page - 1)).replace('{프로젝트 이름}', project);
  const lines = groups.flatMap(g => [`${g} ${PROFILE_GROUPS.find(([x]) => x === g)?.[1] ?? ''}`, ...PROFILE_TABLES.filter(t => t.id.startsWith(`${g}-`)).map(t => [`${t.id} ${t.title}`, headerLine(t), `(${t.rows}행) ${t.note}`].join('\n'))]);
  const fixLines = [...new Set(fixes.map(o => o.table!))].filter(id => !groups.some(g => id.startsWith(`${g}-`))).flatMap(id => PROFILE_TABLES.filter(t => t.id === id))
    .map(t => [`${t.id} ${t.title}`, headerLine(t), `(${t.rows}행) ${t.note}`].join('\n'));
  const fixSection = fixes.length ? [`고칠 보충 행 (${fixes.length}개: 행 ID가 없거나 형식 밖이면 새 행 ID로, 칸 수가 머리 줄과 다르면 「교체 P4-02.1」처럼 행 전체를 다시)`,
    ...fixes.slice(0, 40).map(o => `- ${o.table}${o.ref ? ` ${o.ref}` : ''}: ${o.text}`), ...(fixLines.length ? ['', fixLines.join('\n\n')] : [])].join('\n') : '';
  const groupSection = groups.length ? `보충 묶음 (${groups.length}개: ${groups.join('·')})\n${lines.join('\n\n')}` : '';
  const text = `[AgentFlow 기록 보충 쪽 요청 ${RECORD_ASK_V5_VERSION} · 기록 ${f.recordId} · 쪽 ${page}]
기록 ${f.recordId}(${project}, 기준 ${f.basis})의 상세까지 앱이 받았다. ${groups.length ? `공통 표만으로 설명이 모자란 아래 묶음만 보충 쪽으로 써 줘${fixes.length ? '(앞 보충 쪽의 고칠 행도 함께)' : ''}` : '앞 보충 쪽에서 앱이 읽지 못한 행만 고쳐 써 줘'}. 행이 있는 표만 쓰고, 묶음마다 C-END에 한 줄: 표 ID 칸에 「P4」처럼 묶음, 상태는 썼음 / 해당 없음 / 미조사 / 후속 필요.
첫 줄은 ${head}, 그다음 이 쪽이 처음 인용하는 C-SRC·C-EVID 행, 마지막은 C-END. 12,000자 이하. 첫 열이 다른 표의 것을 가리키면 그 ID(B·N·K·P6-01.1)를 쓰고, 행 ID는 「표 ID.번호」(P4-02.1).

${COMMON_V5}

지어내지 마
${NO_INVENTION_V5.join('\n')}

${[fixSection, groupSection].filter(Boolean).join('\n\n')}

${tableSection5('C-SRC')}

${tableSection5('C-EVID')}

${tableSection5('C-END')}

기록 ID: ${f.recordId}`;
  return { recordId: f.recordId, page, groups, text };
}

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
  // Review of .51 (6b): another relation kept under the line (also) is said beside it, never as what the line hands over.
  for (const r of maps) for (const x of r.relations) if (x.payload && !x.also) said.set(x.relationId, x.payload);
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
// v4.1: 「[=]」 is the part's own files (the evidence of a row whose part's 담당 파일 it is).
const TAG = /\[(파일|보고|실행|추정|모름|대화|붙임)(:[^\]]*)?\]|\[=\]/g;
/** An arrow line is marked [설계] or [관찰] in place of an evidence tag: it counts as tagged. */
const LINE_TAG = /\[(파일|보고|실행|추정|모름|대화|붙임|설계|관찰)(:[^\]]*)?\]|\[=\]/;
const PASS = /통과|\bOK\b|rc 0|완료|성공/;
/** v4 (4.8): the fixed value words that say 완료·성공 without saying a pass (a C-DONE state, a 완료 표시 field), never counted. */
// Recipe .45: and C-END's 끝남 (a table written to its end, never a pass) and a page's 「완료 단계:」 words.
const PASS_WORDS = /작성\s*완료|완료\s*표시|완료\s*판정|시작·완료\s*판정|완료\s*상태|끝남|첫\s*구조\s*완료|상세\s*완료/g;
const SECTIONS: [string, RegExp][] = [['부분', /부분/], ['연결', /연결|→/], ['철회·변경', /철회|변경/], ['다음 관문', /다음 관문/], ['모르는 것', /모르는 것|\[모름\]/]];
/** A design record (설계 기록 v1) is checked against its own six tables, not the status report's sections. */
const DESIGN_SECTIONS: [string, RegExp][] = [['부분 유형', /부분 유형/], ['산출물', /산출물/], ['부분별 설계', /부분별 설계/], ['안의 단계', /안의 단계/], ['조건·거부·분기', /조건/], ['파일 지도', /파일 지도/]];
// .43 (4.1): told apart by the first line only (every v4 chunk has a 「경로 약속:」 line); a v1 design record without the title but with the
// path line still reads as one when no v3 status heading stands in it.
const isDesignRecord = (text: string) => /설계 기록/.test(text.trimStart().split(/\r?\n/, 1)[0] ?? '') || (/^경로 약속\s*:/m.test(text) && !/^\s*\d{1,2}\.\s*부분\s*$/m.test(text) && !/현황\s*보고서/.test(text.slice(0, 200)));
export interface ReportCheck {
  /** Which record the text reads as: a 기록 v4 answer (one or more chunks), the status report, or the design record (its six tables). */
  kind: 'record-v5' | 'record-v4' | 'status' | 'design';
  /** Recipe .45 (v5): each page: its record ID and number, characters against 12,000, whether it has a head and C-END, its C-PART rows with no
   * fixed family word, rows whose cells do not fit the header, cites no ledger resolves (or 「=」); and the folded record's level. */
  pages?: { recordId: string | null; page: number | null; chars: number; limit: number; end: boolean; family: number; badRows: number; badCites: number }[];
  level?: 0 | 1 | 2 | null;
  /** v4: each chunk as the app splits it: its record ID and number, its characters (not bytes) against its cap (12,000 for chunks 1 and 2,
   * 8,000 for a continuation), whether it has a C-DONE table and its rows whose cells do not fit the header. */
  chunks?: { recordId: string | null; chunk: number | null; chars: number; limit: number; done: boolean; badRows: number }[];
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
  // Recipe .45: a v5 record cites ledger IDs, never bracket tags: it is told by its page heads.
  if (recordVersion(text) === 'v5') return checkRecordV5(text);
  const tags = text.match(TAG); if (!tags || tags.length < 5) return null;
  if (recordVersion(text) === 'v4') return checkRecordV4(text);
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
/** v4 (4.8): the check of a 기록 v4 answer, chunk by chunk (split at the chunk heads): characters (a JS string's length, never bytes)
 * against 12,000 (chunks 1–2) or 8,000 (a continuation); a missing chunk head, chunk 2 or C-DONE; a common table neither written nor in C-DONE;
 * rows whose cells do not fit their header. Not counted as lines: chunk heads, title lines, the 경로 약속, focus and 「덩이 2는」 lines, header
 * rows and the rows of C-DONE and C-UNKNOWN. A pass word on a C-DONE, C-STATUS or supplementary row, or a fixed value word (작성 완료,
 * 완료 표시), is no pass. */
function checkRecordV4(text: string): ReportCheck {
  const pieces = splitRecordChunks(text), chunks: NonNullable<ReportCheck['chunks']> = [], missing: string[] = [], cut: string[] = [];
  let tagged = 0, untagged = 0, passesUnrun = 0;
  const seen = new Set<number>(), written = new Set<string>(), listed = new Set<string>();
  for (const piece of pieces) {
    const t = readRecordTables(piece), n = t.chunk?.chunk ?? null, limit = n !== null && n >= 3 ? CONTINUATION_CHARS : REPORT_FIRST_CHARS;
    if (n !== null) seen.add(n);
    for (const x of t.tables) if (x.header.length || x.none || x.body.length) written.add(x.id);
    for (const x of t.byId.get('C-DONE') ?? []) for (const r of x.rows) listed.add((r.byColumn['표 ID'] ?? '').trim());
    chunks.push({ recordId: t.chunk?.recordId ?? null, chunk: n, chars: piece.length, limit, done: (t.byId.get('C-DONE') ?? []).length > 0, badRows: t.diagnostics.filter(d => d.category === 'row-cells').length });
    if (piece.length > limit) cut.push(`덩이 ${n ?? '?'} ${piece.length.toLocaleString('en-US')}자`);
    // Which table each line stands in, for the lines not counted.
    const owner = (at: number) => t.tables.find(x => x.from <= at && at <= x.to)?.id ?? null;
    let offset = 0;
    for (const raw of piece.split('\n')) {
      const start = offset; offset += raw.length + 1;
      const l = raw.trim(), at = start + raw.indexOf(l);
      if (!l || l.length < 12 || CHUNK_HEAD.test(l) || /^(?:#{1,4}\s*)?(?:C-[A-Z]{2,12}|P\d-\d{2})\s+\S/.test(l) || /^(경로 약속|이번 기록의 초점|초점)\s*[:：]/.test(l) || /덩이\s*2는/.test(l)) continue;
      if (l.startsWith('|') && /^[|\-:\s]+$/.test(l)) continue;
      // A table line that is no data row (a header row, a row its header cannot fit) is not counted.
      const table = owner(at);
      if (l.startsWith('|') && !t.tables.some(x => x.rows.some(r => r.from === at))) continue;
      if (l.startsWith('|') && (table === 'C-DONE' || table === 'C-UNKNOWN')) continue;
      if (LINE_TAG.test(l)) tagged++; else untagged++;
      const quiet = table === 'C-DONE' || table === 'C-STATUS' || /^P\d-\d{2}$/.test(table ?? '');
      if (!quiet && PASS.test(l.replace(PASS_WORDS, ' ')) && !/\[실행/.test(l) && !/\[보고/.test(l) && !/\[대화/.test(l)) passesUnrun++;
    }
    if (!t.chunk) missing.push('덩이 머리 줄');
    else if (!(t.byId.get('C-DONE') ?? []).length) missing.push(`덩이 ${n} C-DONE`);
  }
  const ids = new Set(chunks.map(c => c.recordId).filter(Boolean));
  if (ids.size > 1) missing.push('같은 기록 ID');
  if (seen.has(1) && !seen.has(2) && !pieces.some(p => readRecordTables(p).awaitsNext)) missing.push('덩이 2');
  for (const def of V4_TABLES) if (def.id !== 'C-DONE' && (def.chunk === 1 ? seen.has(1) : def.chunk === 2 && seen.has(2)) && !written.has(def.id) && !listed.has(def.id)) missing.push(def.id);
  return { kind: 'record-v4', chunks, chars: text.length, tagged, untagged, passesUnrun, missing, cut };
}
/** Recipe .45 (8.5): the check of a 기록 v5 answer, page by page (split at the page heads): characters (never bytes) against 12,000, the
 * page head and C-END, C-PART rows with no fixed family word, rows whose cells do not fit their header, cites no ledger resolves or
 * written 「=」 (the fold's), and the level the app computes; a pass word not on a C-END or C-CHECK row with no run-grade cite. */
function checkRecordV5(text: string): ReportCheck {
  const pieces = splitRecordChunks(text), pages: NonNullable<ReportCheck['pages']> = [], missing: string[] = [], cut: string[] = [];
  let tagged = 0, untagged = 0, passesUnrun = 0;
  const folds = foldTexts(pieces), fold = folds.at(-1) ?? null;
  pieces.forEach((piece, i) => {
    const t = readRecordTables(piece), head = t.page, record = `#${i}`, f = folds.find(x => x.pages.some(p => p.record === record) || x.held.some(p => p.record === record));
    const own = (d: { record: string }) => d.record === record;
    const family = (t.byId.get('C-PART') ?? []).flatMap(x => x.rows).filter(r => !readFamily(r.byColumn['표현군·역할'] ?? '').ok).length;
    const badRows = t.diagnostics.filter(d => d.category === 'row-cells').length, badCites = (f?.diagnostics ?? []).filter(d => own(d) && (d.category === 'cite-missing' || d.category === 'cite-equals')).length;
    pages.push({ recordId: head?.recordId ?? null, page: head?.n ?? null, chars: piece.length, limit: REPORT_FIRST_CHARS, end: (t.byId.get('C-END') ?? []).length > 0, family, badRows, badCites });
    if (piece.length > REPORT_FIRST_CHARS) cut.push(`쪽 ${head?.n ?? '?'} ${piece.length.toLocaleString('en-US')}자`);
    if (!head) missing.push('쪽 머리 줄'); else if (!(t.byId.get('C-END') ?? []).length) missing.push(`쪽 ${head.n} C-END`);
    // Rows count as cited when their 근거 holds an ID, 추정 or 모름; C-END, C-SRC, C-EVID, C-HEAD and C-UNKNOWN rows are not counted.
    for (const table of t.tables) {
      if (['C-END', 'C-SRC', 'C-EVID', 'C-HEAD', 'C-UNKNOWN', 'C-DROP'].includes(table.id)) continue;
      for (const r of table.rows) {
        const cell = r.byColumn['근거'] ?? '';
        if (/(?<![A-Za-z0-9])[FE]\d{1,3}(?!\d)|추정|모름|\[(?:파일|보고|실행|추정|모름)/.test(cell)) tagged++; else untagged++;
        const line = r.cells.map(c => c.text).join(' | ');
        // A state's event (「로그인 성공」) or a condition's outcome is no pass.
        if (!['C-CHECK', 'C-STATE', 'C-COND'].includes(table.id) && !/^P\d/.test(table.id) && PASS.test(line.replace(PASS_WORDS, ' ')) && !(f?.byKey.get(rowKey(table.id, (r.byColumn['행 ID'] ?? '').replace(/^(?:교체|정정|추가)\s*/, '').trim()))?.cites ?? []).some(c => c.grade === 'run' || c.grade === 'report')) passesUnrun++;
      }
    }
  });
  const ids = new Set(pages.map(p => p.recordId).filter(Boolean)); if (ids.size > 1) missing.push('같은 기록 ID');
  return { kind: 'record-v5', pages, level: fold?.level ?? null, chars: text.length, tagged, untagged, passesUnrun, missing, cut };
}
/** The check in one quiet line, and the line to paste back into the AI chat when something should be written again. */
export function reportCheckLine(c: ReportCheck): { text: string; again: string | null } {
  if (c.kind === 'record-v5') {
    const ps = c.pages ?? [], sum = (k: 'family' | 'badRows' | 'badCites') => ps.reduce((n, x) => n + x[k], 0);
    const level = c.level === 2 ? '상세 완료' : c.level === 1 ? '첫 구조 완료' : '진행 중';
    const parts = [`쪽 ${ps.length}개 · ${ps.map(x => `${x.page ?? '?'}: ${x.chars.toLocaleString('en-US')}자`).join(' · ')}`, `앱이 센 완료: ${level}`, c.untagged ? `근거 없는 행 ${c.untagged}` : '',
      sum('family') ? `표현군·역할 밖 ${sum('family')}` : '', sum('badRows') ? `칸 수가 머리 줄과 다른 줄 ${sum('badRows')}` : '', sum('badCites') ? `장부에 없는 인용 ${sum('badCites')}` : '',
      c.passesUnrun ? `실행·보고 근거 없는 통과 ${c.passesUnrun}` : '', c.missing.length ? `빠진 것: ${c.missing.join('·')}` : '', c.cut.length ? `넘음: ${c.cut.join('·')}` : ''].filter(Boolean);
    const again = [sum('family') ? 'C-PART 표현군·역할을 참여·처리·저장·촉발·관문·미정 가운데 하나로 「교체 B07」 행으로 다시 써 줘.' : '', sum('badRows') ? '칸 안의 |를 &#124;로 바꿔 그 줄만 다시 써 줘.' : '',
      sum('badCites') ? '근거 칸의 F·E ID를 그 쪽 C-SRC·C-EVID에 두고, 「=」 대신 ID를 써 줘.' : '', c.cut.length ? '12,000자를 넘은 쪽은 그 행 앞에서 끝내고 다음 쪽으로 이어 써 줘.' : ''].filter(Boolean).join(' ');
    return { text: `기록 v5 점검 · ${parts.join(' · ')}`, again: again || null };
  }
  if (c.kind === 'record-v4') {
    const bad = (c.chunks ?? []).reduce((n, x) => n + x.badRows, 0);
    const parts = [`덩이 ${(c.chunks ?? []).length}개 · ${(c.chunks ?? []).map(x => `${x.chunk ?? '?'}: ${x.chars.toLocaleString('en-US')}자`).join(' · ')}`, `꼬리표 있는 줄 ${c.tagged}`, c.untagged ? `없는 줄 ${c.untagged}` : '',
      c.passesUnrun ? `[실행]·[보고] 없는 통과 ${c.passesUnrun}` : '', bad ? `칸 수가 머리 줄과 다른 줄 ${bad}` : '', c.missing.length ? `빠진 것: ${c.missing.join('·')}` : '',
      c.cut.length ? `넘음: ${c.cut.join('·')} — 앱은 처음 ${REPORT_FIRST_CHARS.toLocaleString('en-US')}자만 첫 정리에서 읽어요` : ''].filter(Boolean);
    const again = [c.untagged > c.tagged / 4 ? '근거 칸이 빈 줄마다 [파일]/[보고]/[실행]/[추정]/[모름] 하나를 붙여 다시 써 줘.' : '', c.passesUnrun ? '네가 직접 돌리지 않은 통과·OK·완료는 [보고: 출처]로 표시해 줘.' : '',
      bad ? '칸 안의 |를 &#124;로 바꿔 그 줄만 다시 써 줘.' : '', c.missing.includes('덩이 2') ? '「이어서」' : ''].filter(Boolean).join(' ');
    return { text: `기록 v4 점검 · ${parts.join(' · ')}`, again: again || null };
  }
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
  // Review of .51: a reading that wrote no summary (a final review's verdict) leaves the newest one that did.
  const summary = latestMapSummary(readings);
  if (summary) lines.push(`요약: ${summary}`);
  for (const p of view.parts) { const role = p.reading?.role ?? p.summary ?? p.note; lines.push(`부분 ${name(p.id)}${p.parentId ? ` (${name(p.parentId)} 안)` : ''}: ${role ? role.replace(/\s+/g, ' ').slice(0, 160) : '설명 없음'}`); }
  for (const rel of view.relations) lines.push(`연결 ${name(rel.from)} → ${name(rel.to)}: ${rel.note || rel.kind}`);
  for (const g of last?.gaps ?? []) lines.push(`빈틈: ${g}`);
  const body = lines.slice(0, 60).map((l, i) => `${i + 1}. ${l}`).join('\n');
  return `[AgentFlow 이해 확인 요청 ${PROSE_ASK_VERSION}]
아래는 지도가 기록에서 읽은 것이다. 틀린 줄만 「번호: 맞는 내용 (근거: [파일]/[보고]/[실행]/[모름])」로 고쳐 답하고, 맞는 줄은 쓰지 마. 모르면 「번호: 확인 못 함」. 새로 지어내거나 없는 줄을 더하지 마. 비밀값은 [가림].
${body}`;
}
