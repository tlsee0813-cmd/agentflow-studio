# 34 독립 경계 입력 준비

**UI 비교 전 입력 준비만 완료했다.** 고정 baseline `575bb7452044e0d987453a24e31680d2d8077b6c`, app subtree `adf88ae1d90bace46485175c531a46ab846a74d0`의 공개 domain/validation/attention API를 사용했다. 같은 app subtree로 이미 빌드한 shared 모듈을 재사용했고 source TS는 baseline Git object와 직접 대조했다. 제품/원검사/renderer 수정·설치·서버·브라우저·외부 AI 호출은 없다.

## 입력 한 개

`generated/mixed-long-title.json`은 명시 합성 4영역·9작업(원작업6+반환3)이다. 같은 긴 머리말 뒤 구별 단어가 다른 이름을 사용한다. P는 자기+실제 자식 Q/S를 포함하고 Q→B related 관계는 포함을 늘리지 않는다. 별도 현재 작업은 B, 미전송 대상은 Q다.

|부분|질문 전체 N|active && !answered인 M|설명 존재|
|---|---:|---:|---|
|P 자기+Q/S|4|1|현재1·이전 기준1·보류1|
|Q 자기|3|1|이전 기준1|
|S 자기|0|0|held-only1, current=null|
|B 자기|1|1|없음|

정확 실제답변 **역할** 기록/원 request의 정확 시험답변/이전 질문/현재 미답/시험문맥 생성 질문을 무관한 영역으로 늘리지 않고 모았다. 모두 합성이며 source kind=request를 실제 사람 발언으로 주장하지 않는다. 정확 `test_answer`는 기존 questionAnswered=true여서 N포함·M제외이지만 ‘시험 답변 기록 · 실제 답변 아님’을 유지한다. 새 시험문맥에서 생성된 질문은 N제외다. 행별 정확 ID·소유·기대값은 `FACTS.md`와 `generated/FACTS.json`에 있다.

## 생성과 검증

`generate.mjs`는 Project 상태 필드를 직접 바꾸지 않고 공개 API 반환값으로만 구성한다. 기존 mockAdvice를 사용하되, 시험문맥 생성 질문 하나만 명시 합성 provider-shaped 응답을 public receive로 넣었다. 유효한 model response 입력이지 기존 MOCK이 그 질문을 생성했다는 실행 증거가 아니다.

세 인계는 기존 `handoffText` template와 `exportAnchor`를 같은 상태에서 얻어 `markHandoff`로 묶었다. **이 단계의 clipboard method 기록도 합성 domain 인계이며 실제 OS clipboard 복사/전달이 아니다.** 원문 MD와 그 template를 바탕으로 만든 합성 return.2 JSON을 함께 제공한다. S는 실제 export 뒤 자기 구상을 editArea로 바꾸고 늦은 설명을 받아 `plan-changed` 보류를 만들었다. 틀린 basedOn 번호를 억지로 넣거나 JSON 상태를 직접 조작하지 않았다.

|실행|실제 child 종료|외부 수집 종료|
|---|---:|---:|
|baseline TypeScript noEmit|0|생성 수집기 전체0|
|Node22 공개 API 생성·strict parse roundtrip·literal 집계 대조|0|생성 수집기 전체0|
|별도 직렬화 재로딩·원시 ID 중복·정확 H/template/raw 반환·입력9파일 불변|0|0|

N/M 기대값은 생성한 source/task ID와 공개 명령의 의미로 별도 고정했다. 실제 subtreeSignals의 원배열 길이·각 ID·소유·answered/applicability를 대조했고 사전 덮어쓰기로 중복을 숨기지 않았다. 집계 읽기 전후 Project도 같다. T2는 고정 `584bca013cdfcb3383a028b54dc5158ca438f8690e4a7e4420fe9a11a8b68fc7` 원자료를 읽기 전용 해시 참조하며 이 payload에 복제하지 않았다.

## 재현

기존 Node22.16/TS5.8.3 빌드를 사용한다. 새 의존성은 필요 없다. 아래 출력은 반드시 별도 새 디렉터리를 택한다. 공개 API의 UUID/UTC가 새로 생성되므로 재생성한 해시/ID는 달라지며, 이번 고정 파일의 정확 해시는 MANIFEST 기준이다.

```sh
node generate.mjs --module-root "$BASELINE_APP/continuity/dist/public/shared" --outdir generated-new
node verify.mjs --module-root "$BASELINE_APP/continuity/dist/public/shared" --input-root generated-new --receipt verify-new.json
```

`collect-public.py`는 실제 사용한 수집기의 개인 실행 경로 상수만 `BASELINE_APP`/`TOOLCHAIN_BIN` 환경 선택으로 바꾼 공개 사본이다. 생성기/검증기 본문은 실제 실행 바이트 그대로다. 공개 수집기와 실제 수집기 해시/차이는 `PUBLIC_COPY.json`에 구분한다. stdout/stderr는 경로가 없어 원바이트 그대로 제공하며, 실행 메타데이터의 경로는 역할별 alias로 표기했다. 외부 종료 receipt는 실제 tool 반환값 전사이며 전체 tool 원문이 아니다.

## 미실행과 한계

카드180px/배율/위치/폰트/실제 글자 clip·hit·기록 첫 줄/닫기 복귀/저장 불변은 아직 **UI NOT_RUN**이다. 후보 SHA를 받으면 같은 renderer에서 T2와 이 입력을 비교한다. 단위 통과를 UI 성공이나 의미 충돌 자동 판정으로 바꾸지 않는다. legacy unknown·보관·모든 질문 순열은 새로 늘리지 않았다. baseline/T2/기존 증거는 불변이며 이번 Node 실행의 0 종료와 구분한다. payload는 작아 gzip을 사용하지 않았고, 모든 공개 파일과 JSON 내부 문자열까지 개인 로컬 경로 부재를 검사했다. MANIFEST는 자기 자신만 제외한 정확 집합이다.
