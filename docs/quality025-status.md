# QUALITY025 — 실제 기술 실행 완료·품질 미평가

2026-10-12 기준. **준비 검증 후 실제28회 송신·앱 수용을 완료했다. 실패·미실행·재시도0이며 내용 품질은 아직 미평가**다. 제품은 IDEA022 + UI001 rev1을 유지하며 QUALITY025는 미승격이다.

## 후보와 확인 범위

후보 source190은 T1의188 중186불변·2변경·2추가다. 제품 변경은 `app/continuity/server/prompt.mjs` 하나이며 나머지는 실험 identity/bind·검사다. 제약 대상의 확대·전체 제한 축소, 미정 정책과 checks의 모순, 현행 유지와 신규 구현을 구분하는 최소 문구를 보완했다. 입력·저장·8키 출력·provider body의 계약을 새 기능으로 확장하지 않는다.

패키지 정적 검사(manifest310/source190)와 독립 Sol 좁은 리뷰를 수용했다. Windows Node24.19.0의 신규6/6은 가짜 키·mock/local HTTP로 실행한 보호 경계 검사이며 실제 AI 품질 검증이 아니다. source manifest SHA256은 `f4f70bc6826e3bcfdb9bf42af76190d7cf3f110ce7d37af2bf99876ee2c78522`다.

Cloud Node22.16.0/npm10.9.2/TS5.8.3에서 설치·부모/continuity check/build, 신규6 + IDEA0233 + 실제 T1 mock 접착3 + 선택 오류 차단1을 통과했다(fail/cancel/skip0). 최초 npm 캐시 오류는 기존 쓰기 가능한 캐시 사용으로 해결했고 검증을 완화하지 않았다. 전체 suite·브라우저·60초 벽시계 검사는 반복하지 않았다.

실제 원본 T1 identity로 bind하고 runtime16파일의 재빌드 바이트 일치,14pair·7seed의 원문/ticket/사전 순서 보존을 확인했다. 원본 T1 **2801파일 불변**, 보호 wrapper 변경0이다. 새 sampleId·후보 identity/연결 메타데이터만 분리했다.

**28mock 슬롯**은 candidate localhost → provider → 기존 보호 접착 → 폐쇄 fakecurl → 엄격 검증 → receive/handoff 경로다. system prompt만 T1과 다르고 기록body/실제 curl child 수신hash가 일치했다. 완료 resume 추가송신0·중복 새out 거절·오류 후 차단을 확인했다. 무상 검증 당시 실제 DeepSeek 송신·키 읽기0, paid=false였으며 간격 검사는 모의 시계였다.

## 실제 실행 결과와 다음 단계

Cloud에서 같은7가상입력 × OFF/ON-high ×2사전반복,28회(arm14씩)를 실행했다. 공통8192토큰·60000ms·전역 직렬10167ms 이상, 기존 요청/응답 한도·원장·키결속 writer·반향 보호를 유지한다. 오류 시 중단·남은 슬롯 미실행이며 재시도·대체 모델·한도 완화·새 경로 우회는 없다. **실송신28·앱 수용28·실패/미실행/재시도0**으로 완료했다. 모두HTTP200·deepseek-flash·finish_reason stop였고 사용량 누락·보호 오류0이다. 최소 실제 송신 간격10170ms, 관측 지연2627–41168ms이며 이 실행의 기술 관측이다.

송신 body hash와 상태 보존28/28, T1 대비 system prompt만 변경됨을 확인했다. 소스·frozen·보호 의존 해시와 기존3341파일은 불변이며 요청·응답·handoff 누락이 없다. 종료 후 ALLOW_PAID_AI=false로 복원했다. 추가 호출·제품/lab 수정은 없다.

결과 ZIP은 원격 Cloud 산출물의 보고된 SHA256 `38f676aff372636fd8688d747f0b8f32382c3747135b96b54f75cd8229b6b97e`,932314바이트다. 전체 ZIP을 로컬에서 검증했다는 뜻은 아니다. 익명 입력·8키 응답28개(90083문자)를 회수했고 Luna 패키징 및 Pro·Claude 익명 평가 전달을 준비 중이다. 아직 접수 완료·의미 품질 합격·제품 승격을 기록하지 않는다. 조건·사용량·지연·추론·대응표는 blind 자료에서 분리한다.

transfer2는 별도 보호 연결·배정이 필요해 이번28슬롯에 포함하지 않는다. 과거 T1 응답·평가·추론은 새 입력에 주입하지 않는다. 이 결과는7입력의 반복 탐색이며 시간차·공급자 변화·비결정성 한계가 있다. 코드 PASS·mock 완료를 AI 내용 합격·통계적 우월성으로 표현하지 않는다.

공유에는 준비 상태와 사실 요약만 보존하고 raw/operator·대응표·추론·ZIP·개인 자료·비밀은 게시하지 않는다. 제품 소스·CI·main·PR 설정은 변경하지 않는다.
