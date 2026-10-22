# 사이클21 A 후보 — 독립 실행

정확 제품 `922848c0957992f84b8a0e2696a86b98d5f51c0d`, app SHA256 `5370d0a6acd3a1b60e3f5c81e8e3a4be647665d23c18667f810b6df7634f9f58`. CSS/HTML은 `df726e58`와 동일. 제품 diff는 기존 native fileOptions의 부모 foot→actions 한 줄이며 제품/검사는 수정하지 않았다. 계약 `7099735067d77e0599b4e14b7e9664e0353cdf99`. 기존 관측 b0c2c933과 모든 최초 실패는 불변. 20 양OS CI/수용/병합은 별도이며 완료로 선언하지 않는다.

## 결과

같은 정상 새 프로젝트 UI 경로(목적 한 번, 예약/알림/실제 자식/명시 관계/첫 요청)를 수정 전·후 양 PC에서 실행했다. 알려진 경로 재현이며 사람·블라인드 평가가 아니다. 프로젝트 JSON/저장소/숨은 state 주입은 독립 blank 경로에 없었다.

| 최초 준비 화면 | 1280×720 summary y | 1440×900 summary y | 주 복사 + 접힌 파일 선택 전체 clip/hit |
|---|---:|---:|---|
| df726e58 수정 전 | 1782.015625 | 1760.578125 | 양PC FAIL, child exit1 |
| 922848c0 수정 후 | 262.078125 | 262.078125 | 양PC PASS, child exit0 |

viewport·bbox·자신/모든 overflow 조상과 축별 배율 clip·대표점 elementFromPoint·문자 Range를 `before/result.json`, `after/result.json`에 보존했다. Range는 잉크/사람 이해의 증명이 아니다. 수정 전도 스크롤하면 실제 인계가 가능했다. 초기 노출 실패를 접근 불능으로 바꾸지 않았다. 초기 비교 collector는 예상 before1/after0을 기록하고 실제0으로 종료했다.

수정 후 `flow-v4`는 양 PC의 각 한 정상 흐름을 완주/exit0했다. summary click/Enter/Space/Tab native 동작과 펼침만으로 전체 저장 project/H/export/current/draft 불변, 일반 복사는 file H 없음, 파일 복사에서만 실제 H/anchor/template 생성, 실제 readonly 전문 textarea 내부 wheel→tail→native 키 닫힘, 실제 H 기반 명시 합성 return.2 수신, exact receipt T/H와 당시 네 값·현재 사용자 note/외부 설명 구분, 동일 child 새 C·새 H·실제 clipboard, 일반 지도 breadcrumb 이동 후 C/목적/포함/관계/다른 부분 보존을 확인했다. 일반 지도 이동을 exact origin 복원이라고 부르지 않았다.

전문을 읽고 닫은 뒤 작업문/current/draft 전체는 같고 summary 초점·hit를 확인했다. pageY는 읽기·키 조작에 따라 1280 114→354, 1440 114→264였고, 열기 직전 절대 Y 복원을 주장하지 않는다. native readonly textarea의 Ctrl+End는 caret을 값 끝으로 옮기는 보장이 아니었고 문서 스크롤도 움직였다. 내부 wheel max와 실제 tail PNG로 읽기를 관측했다. tail 화면은 Ctrl+End **이전** 실제 wheel 완료 후 촬영한 별도 대표 장면이다.

## 질문 상태와 회귀

기존 모르는 사실 확인 대표 상태를 수정 전·후 정상 UI로 각각 만들었다. `질문에 답하기`는 y177.984375로 주 동작에 남고, 파일 묶음을 열어도 저장 상태가 변하지 않았다. 이 상태의 파일 복사는 원래도 허용된다. 복사 금지를 새 기대값으로 만들지 않고, 실제 인계문에서 남은 질문과 ‘임의로 결정하지 말고 관련 없는 명확 범위만 계속’ 제한이 전후 모두 유지됨을 확인했다. 주 답변 행동→실제 답 입력 hit→‘잘 모르겠음’ 정상 처리를 통해 기존 task/unknown 답 기록을 대조했다. 기존 native role/aria 중복 추가 없음. 기존 fact/choice 질문 회귀2개도 별도 child0.

정확 후보의 기존 검사 실행(독립 UI 숫자와 합산 안 함): RECEIVED20 11/11, REPORT16 13/13, AREA17 12/12, AREA18 12/12, WORKSPACE19 6/6, HOME15 21/21, SPATIAL102 11/11. 각 child0, 외부 collector0. check/build0. author21 최소 검사는 아직 전달되지 않아 NOT_RUN이다.

RECEIVED20의 late A/Bdraft/newC/receipt/Origin 전체 매트릭스는 **이번 정확 후보의 원본 작성자 검사 실행**으로 확인했다. 이전 f099a48d의 독립 core8/저장 경계는 df726 근거를 재사용하며 새 SHA 실행으로 합산하지 않는다. receipt/Origin/domain/schema/CSS 불변과 이번 제품 표시 diff를 분리한다. HOME15 pass는 cycle19 원인 미상의 CI 불일치 해결 선언이 아니다.

## 최초 오류와 측정 경계

- 첫 flow: textarea 자신의 client clip과 바깥 border box를 같은 ‘전체’로 비교한 도우미 오류. 두 번째는 접근 delta에도 self clip을 사용해 위로 가려는 오류와 readonly caret 끝 동등 조건이 있었다. 코드/원시 fatal/actual exit1을 각 보존했다. 컨트롤 border 접근과 실제 본문 clip 관측을 분리했으며 초기 summary의 노출 단언은 바꾸지 않았다.
- flow-v3의 전문 닫힘 hit 실패2개/exit1도 그대로 보존했다. readonly Ctrl+End·ShiftTab·Space 후 아직 진행 중인 native scroll을 측정한 값이었다. 같은 before/after narrow probe에서 **특정 좌표를 요구하지 않고 6개 연속 animation frame의 실제 scroll/textarea 위치 안정**을 관측한 뒤 전후 모두 caller hit/state 보존/exit0을 확인했다. 무조건 sleep·DOMscroll·위치 교정으로 통과시키지 않았다. 최종 flow-v4에도 같은 완료 관측을 사용했고 동일 의미 단언을 유지했다.
- 질문 확장 검사 초안의 IndentationError는 브라우저 실행 전 setup 실패1이며 원본 보존 후 들여쓰기만 수정했다. 첫 질문 시각 probe의 잘못 추측한 unknown 버튼 이름 count0도 제품 실패/접근 불능으로 해석하지 않는다. 이후 실제 화면 이름 ‘잘 모르겠음’을 사용했다.

이전 실패 부분성공과 최신 결과를 합쳐 한 완주라고 쓰지 않는다. `CODE_BINDING.json`은 실제 사용한 helper 버전을 매핑한다. 최초 노출 비교 뒤 전문 textarea와 질문 동작을 진단하려고 app.ts/domain.ts/기존 검사 문구를 읽은 시점은 명시한다. 정상 UI 경로는 기존 관측에서 배운 것이다. DOM 읽기/측정 외 내부 app API/state 호출·변조, force click, DOM scroll 주입은 없다. author 원본 검사의 fixture/보조 동작은 독립 native 조작과 구분한다.

## 증거/한계

`SOURCE_BEFORE/AFTER`, `PRODUCT_DELTA.patch`, 실제 browser response.body↔disk 전후 SHA와 URL/status, 동적 Node22.16/TS5.8.3/PW1.57/Chromium154, 명령별 actual child와 외부 완료, stdout/stderr, raw JSON/행동 기록/합성 파일/실제 clipboard를 포함했다. 실제 관측 UTC 원문 보존. paidAI0·외부 구현0·console/pageerror0. 사용자 자료와 기존 preview/storage는 격리되어 있다.

대표 PNG6장: 수정 전후 양 PC 첫 화면4, 실제 wheel 전문 tail1, 질문+파일 선택 펼침1. 나머지는 로컬 원본 보존/bytesSHA 목록으로 구분한다. 특히 flow의 `long-preview-tail.png` 중 Ctrl+End 뒤 문서가 아래로 간 장면은 tail 가시성 대표로 쓰지 않는다. 전체 tool transcript가 아닌 선택된 외부 tool 완료 전사와 실제 프로세스 파일이다.

MANIFEST.tsv는 이 prefix의 정확 전체 payload bytes/SHA256이며 자기 자신만 제외. 기존 증거 덮어쓰기·제품/checkpoint/main/공개 배포 없음. 사람 사용성/자동 의미 이해·AI 수락·Windows 실조작·OS IME·모든 길이와 viewport는 미검증이다. 최종 수용은 총괄이 판단한다.
