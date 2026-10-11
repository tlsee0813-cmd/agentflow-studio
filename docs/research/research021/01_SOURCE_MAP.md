# 출처 지도 · 열람 범위 · 접근 제한

열람일: **2026-10-12, Asia/Seoul**. 날짜가 없는 문서를 이 날짜에 출판된 문서로 간주하지 않는다. 웹 도구가 반환한 캐시/색인도 포함되므로, CLI 호환성은 실제 설치 버전을 별도로 고정해야 한다.

## 지도를 읽는 방법

`P` = 지정 제품 기준, `A/B/C` = 새 공식 문서·분야외 자료, `X` = 독립 작성자의 경험·열린 토론, `K` = 실제 고정 커밋 코드/테스트/라이선스. 강한 근거가 된 코드 범위는 [재사용 원장](evidence/CODE_REUSE_LEDGER.md), 사용자 경험의 집계와 반례는 [경험 원장](evidence/EXPERIENCE_LEDGER.md)에 있다.

읽기 전 가설(H1/H2/H3) → 제품 기준(P01–P08) → A의 화면·수정(P06/P07, A02–A09) → B의 인계·대사(B01–B07, X03–X07, K06–K10) → C의 실행 경계(C01–C07, K11–K22) → UI001/CONNECT001/IDEA020에 대한 제안. 가설을 외부 사실처럼 바꾸지 않았다.

## 기존 조사 재사용 범위

P09/P10은 접근하여 읽은 **기존 조사 요약**이다. Files의 conversation+library 검색과 지정 커밋의 `docs/research` 목록에서 B1~B5·REUSE010D 개별 원본 보고서를 확보하지 못했다. 이 요약에 있던 ‘기억 보관/발견/준수 구분’, ‘단순 CLI·문서 대조군’, ‘jsondiffpatch·effortless 좁은 재사용’은 출발 가설로만 재사용했다. 특히 effortless 평가기의 관대한 실패 판정은 K19를 새로 읽어 범위를 다시 확인했다. 과거 Promptfoo 버전/Node 제약과 Durable Streams 라이선스 문제는 이번에 재검증하지 않았고 신규 결론에 넣지 않았다.

## 중요한 접근 제한

- GitHub 연결로 지정 commit의 문서/코드 읽기는 성공했다. main을 고객 앱으로 읽지 않았다. 재귀 tree 응답 일부는 잘려 전체 목록 완독으로 세지 않았다.
- 컨테이너 직접 네트워크는 DNS 실패였다. clone/archive 다운로드·설치로 우회하지 않았다. 따라서 이번 코드 열람은 연결 도구가 반환한 원문에 한정된다.
- Instalanding 원페이지는 0행, `/SKILL.md`와 `/prompts.json`은 오류였다. 이름이 비슷한 다른 도메인으로 대체하지 않았다.
- Lovable 현행 history 문서 경로가 열리지 않아, 2025 공식 글/화면과 현재 Plan/Build 문서를 구분해 사용했다. 실제 계정 작업은 하지 않았다.
- Xero는 공식 검색 색인에 본문이 노출되지만 웹 open은 0행이었다. ‘직접 UI 사용’이나 원페이지 전체 완독으로 표시하지 않는다.
- OpenSpec의 추정 경로 `test/core/specs-apply.test.ts`는 404였다. tree에서 실제 near-miss 테스트를 찾아 K08로 대체했다.
- Zenn TOKIUM `designing-for-absence` 및 Figma Make 관련 `series-007-product-story`는 원문 열람 실패. 검색 요약만으로 핵심 권고를 만들지 않았다.
- Cline #13550 등 검색으로 발견했으나 원문/코드까지 확인하지 못한 글은 독립 실사용 증거 수에 넣지 않았다. 공개 글의 재게시·연결 이슈·번역도 새 사용자로 세지 않는다.
- Claude TS SDK 저장소에서는 README/목록만 읽었다. SDK 내부 코드나 테스트를 읽었다고 하지 않는다. Codex의 공개 TS 구현과 같은 수준으로 평가하지 않았다.

‘원문 읽음’은 실사용/실행 성공, 소스의 정확성 보증, 사용자가 주장한 원인 확정, 사용자 연구 수행을 뜻하지 않는다.

## 실제 사용한 출처 목록

### P01 · 프로젝트 진입 문서
- 원문: [프로젝트 진입 문서](https://github.com/tlsee0813-cmd/agentflow-studio/blob/6666c6bd35a1a01419d3a082b6dfc776ce3db717/docs/START_HERE.md)
- 구분/열람: 기준선 · 프로젝트 문서 · 지정 커밋 신규 확인
- 읽은 범위: 본문. 015 시점 안내가 남아 있음
- 원문/커밋 날짜: 본문에서 확정하지 않음 · 확인일: 2026-10-12
- commit: `6666c6bd35a1a01419d3a082b6dfc776ce3db717`
- 한계: 이 조사에서 앱 테스트/배포를 실행하지 않음

### P02 · 현재 상태·017 유지·018/019 미채택
- 원문: [현재 상태·017 유지·018/019 미채택](https://github.com/tlsee0813-cmd/agentflow-studio/blob/6666c6bd35a1a01419d3a082b6dfc776ce3db717/docs/PROJECT_STATUS.md)
- 구분/열람: 기준선 · 프로젝트 문서 · 지정 커밋 신규 확인
- 읽은 범위: 본문. 독립 작업 배정 및 실험 결과 요약
- 원문/커밋 날짜: 본문에서 확정하지 않음 · 확인일: 2026-10-12
- commit: `6666c6bd35a1a01419d3a082b6dfc776ce3db717`
- 한계: 이 조사에서 앱 테스트/배포를 실행하지 않음

### P03 · 고객 앱 README
- 원문: [고객 앱 README](https://github.com/tlsee0813-cmd/agentflow-studio/blob/6666c6bd35a1a01419d3a082b6dfc776ce3db717/app/continuity/README.md)
- 구분/열람: 기준선 · 프로젝트 문서 · 지정 커밋 신규 확인
- 읽은 범위: 본문. 현재 코드와 구분한 설명·역사적 검사 기록
- 원문/커밋 날짜: 본문에서 확정하지 않음 · 확인일: 2026-10-12
- commit: `6666c6bd35a1a01419d3a082b6dfc776ce3db717`
- 한계: 이 조사에서 앱 테스트/배포를 실행하지 않음

### P04 · 공통 타입
- 원문: [공통 타입](https://github.com/tlsee0813-cmd/agentflow-studio/blob/6666c6bd35a1a01419d3a082b6dfc776ce3db717/app/continuity/src/shared/types.ts)
- 구분/열람: 기준선 · 코드 정적 열람 · 지정 커밋 신규 확인
- 읽은 범위: 전체 파일. Source/Basis/Task/Export/Advice 경계
- 원문/커밋 날짜: 본문에서 확정하지 않음 · 확인일: 2026-10-12
- commit: `6666c6bd35a1a01419d3a082b6dfc776ce3db717`
- 한계: 이 조사에서 앱 테스트/배포를 실행하지 않음

### P05 · 도메인 상태와 인계
- 원문: [도메인 상태와 인계](https://github.com/tlsee0813-cmd/agentflow-studio/blob/6666c6bd35a1a01419d3a082b6dfc776ce3db717/app/continuity/src/shared/domain.ts)
- 구분/열람: 기준선 · 코드 정적 열람 · 지정 커밋 신규 확인
- 읽은 범위: 1–230 요청 응답 일부 잘림; 190–365 별도 읽음. 주요 함수·후반 인계 읽음; 모든 행 완독 아님
- 원문/커밋 날짜: 본문에서 확정하지 않음 · 확인일: 2026-10-12
- commit: `6666c6bd35a1a01419d3a082b6dfc776ce3db717`
- 한계: 이 조사에서 앱 테스트/배포를 실행하지 않음

### P06 · 실제 고객 HTML
- 원문: [실제 고객 HTML](https://github.com/tlsee0813-cmd/agentflow-studio/blob/6666c6bd35a1a01419d3a082b6dfc776ce3db717/app/continuity/public/index.html)
- 구분/열람: 기준선 · 코드 정적 열람 · 지정 커밋 신규 확인
- 읽은 범위: 전체 텍스트. 브라우저 렌더링/클릭 실행 아님
- 원문/커밋 날짜: 본문에서 확정하지 않음 · 확인일: 2026-10-12
- commit: `6666c6bd35a1a01419d3a082b6dfc776ce3db717`
- 한계: 이 조사에서 앱 테스트/배포를 실행하지 않음

### P07 · 고객 클라이언트
- 원문: [고객 클라이언트](https://github.com/tlsee0813-cmd/agentflow-studio/blob/6666c6bd35a1a01419d3a082b6dfc776ce3db717/app/continuity/src/client/app.ts)
- 구분/열람: 기준선 · 코드 정적 열람 · 지정 커밋 신규 확인
- 읽은 범위: 1–165 응답 일부 잘림; 155–260 별도 읽음. 전체 파일 완독 주장 안 함
- 원문/커밋 날짜: 본문에서 확정하지 않음 · 확인일: 2026-10-12
- commit: `6666c6bd35a1a01419d3a082b6dfc776ce3db717`
- 한계: 이 조사에서 앱 테스트/배포를 실행하지 않음

### P08 · 저장·복원
- 원문: [저장·복원](https://github.com/tlsee0813-cmd/agentflow-studio/blob/6666c6bd35a1a01419d3a082b6dfc776ce3db717/app/continuity/src/shared/storage.ts)
- 구분/열람: 기준선 · 코드 정적 열람 · 지정 커밋 신규 확인
- 읽은 범위: 전체 파일. 비교 후 저장·legacy 백업·실패 처리
- 원문/커밋 날짜: 본문에서 확정하지 않음 · 확인일: 2026-10-12
- commit: `6666c6bd35a1a01419d3a082b6dfc776ce3db717`
- 한계: 이 조사에서 앱 테스트/배포를 실행하지 않음

### P09 · 기존 정성 조사 요약
- 원문: [기존 정성 조사 요약](https://github.com/tlsee0813-cmd/agentflow-studio/blob/6666c6bd35a1a01419d3a082b6dfc776ce3db717/docs/research/qualitative-findings.md)
- 구분/열람: 기준선 · 프로젝트 문서 · 기존 조사 요약의 재열람
- 읽은 범위: 본문. RESEARCH010/IDEA011–012 요약만 접근
- 원문/커밋 날짜: 본문에서 확정하지 않음 · 확인일: 2026-10-12
- commit: `6666c6bd35a1a01419d3a082b6dfc776ce3db717`
- 한계: 이 조사에서 앱 테스트/배포를 실행하지 않음

### P10 · 기존 재사용 조사 요약
- 원문: [기존 재사용 조사 요약](https://github.com/tlsee0813-cmd/agentflow-studio/blob/6666c6bd35a1a01419d3a082b6dfc776ce3db717/docs/research/reuse-findings.md)
- 구분/열람: 기준선 · 프로젝트 문서 · 기존 조사 요약의 재열람
- 읽은 범위: 본문. REUSE010D 요약만 접근
- 원문/커밋 날짜: 본문에서 확정하지 않음 · 확인일: 2026-10-12
- commit: `6666c6bd35a1a01419d3a082b6dfc776ce3db717`
- 한계: 이 조사에서 앱 테스트/배포를 실행하지 않음

### A01 · Instalanding
- 원문: [Instalanding](https://instalanding.ai/)
- 구분/열람: A · 검색 색인 일부 · RESEARCH021 신규 열람
- 읽은 범위: 원 도메인의 one-shot HTML 라이브러리 소개 텍스트
- 원문/커밋 날짜: 본문에서 확정하지 않음 · 확인일: 2026-10-12
- 한계: 직접 open 0행; SKILL.md/prompts.json 접근 오류. 작동 UI·데모·라이선스·소스 미검증

### A02 · Lovable versioning 2.0
- 원문: [Lovable versioning 2.0](https://lovable.dev/en/blog/versioning-with-lovable-two-point-zero)
- 구분/열람: A · 공식 글 + 공식 화면 이미지 · RESEARCH021 신규 열람
- 읽은 범위: 날짜 그룹/북마크/과거 버전 미리보기와 복원; versioning-2.jpeg 실제 시각 열람
- 원문/커밋 날짜: 2025-03-03 · 확인일: 2026-10-12
- 한계: 2025년 공개 화면. 현재 계정 UI 직접 사용 아님

### A03 · Lovable Plan mode
- 원문: [Lovable Plan mode](https://docs.lovable.dev/features/plan-mode)
- 구분/열람: A · 공식 문서 본문 · RESEARCH021 신규 열람
- 읽은 범위: 직접 계획 편집·선택 부분 수정·버전 차이·Build 전환
- 원문/커밋 날짜: 본문에서 확정하지 않음 · 확인일: 2026-10-12
- 한계: 계정에서 실행 안 함; 모바일 차이 보기 제한은 문서 기준

### A04 · Lovable Build/Agent mode
- 원문: [Lovable Build/Agent mode](https://docs.lovable.dev/features/agent-mode)
- 구분/열람: A · 공식 문서 본문 · RESEARCH021 신규 열람
- 읽은 범위: 진행 중 작업 상세·큐 수정·중단/부분 변경 경계
- 원문/커밋 날짜: 본문에서 확정하지 않음 · 확인일: 2026-10-12
- 한계: 실행·복원·사용성 검증 안 함

### A05 · Lovable 복원 장애와 복구
- 원문: [Lovable 복원 장애와 복구](https://status.lovable.dev/incidents/01KSMMXRR509AX8V5AMEY410Z3)
- 구분/열람: A · 공식 장애 기록 본문 · RESEARCH021 신규 열람
- 읽은 범위: 배포 호환성 문제로 restore 실패 후 배포 되돌려 해결
- 원문/커밋 날짜: 2026-05-27 · 확인일: 2026-10-12
- 한계: 시간 표기 불일치가 있어 장애 지속시간/전체 실패율 계산 안 함

### A06 · Linear agent interaction
- 원문: [Linear agent interaction](https://linear.app/developers/agent-interaction)
- 구분/열람: A/C · 공식 개발 문서 본문 · RESEARCH021 신규 열람
- 읽은 범위: AgentSession·activity·외부 링크·상태·ephemeral activity·AgentPlan preview
- 원문/커밋 날짜: 본문에서 확정하지 않음 · 확인일: 2026-10-12
- 한계: 개인 Linear 데이터/실제 앱 미사용; API 도입 추천 아님

### A07 · GOV.UK Check answers
- 원문: [GOV.UK Check answers](https://design-system.service.gov.uk/patterns/check-answers/)
- 구분/열람: A · 공식 패턴 + 예제 HTML · RESEARCH021 신규 열람
- 읽은 범위: 항목별 Change·기존 값으로 복귀·미입력 표시·접근 가능한 링크
- 원문/커밋 날짜: 본문에서 확정하지 않음 · 확인일: 2026-10-12
- 한계: 예제 코드/문서 읽음; 화면의 직접 입력·보조기술 테스트 안 함

### A08 · GOV.UK Task list
- 원문: [GOV.UK Task list](https://design-system.service.gov.uk/components/task-list/)
- 구분/열람: A · 공식 문서 본문 · RESEARCH021 신규 열람
- 읽은 범위: 복수 세션·복잡한 비순차 작업에 적합; 단순 순차 흐름 대안
- 원문/커밋 날짜: 본문에서 확정하지 않음 · 확인일: 2026-10-12
- 한계: 도입 여부 판단 자료이지 Studio 사용자 실증 아님

### A09 · DWP 실제 서비스의 요약 수정·다음 행동
- 원문: [DWP 실제 서비스의 요약 수정·다음 행동](https://dwpdigital.blog.gov.uk/2016/07/08/a-live-service-is-not-the-end-of-the-story/)
- 구분/열람: A/B · 담당자의 1차 사례 글 · RESEARCH021 신규 열람
- 읽은 범위: Mel Johnson: 답변 요약에서 직접 수정 후 돌아오기와 Next Action 운영
- 원문/커밋 날짜: 2016-07-08 · 확인일: 2026-10-12
- 한계: 시간 감소는 작성자 보고. 해당 기능 단독의 통제 실험/Studio 효과 아님

### B01 · Claude Code memory
- 원문: [Claude Code memory](https://code.claude.com/docs/en/memory)
- 구분/열람: B · 공식 문서 해당 절 · RESEARCH021 신규 열람
- 읽은 범위: CLAUDE.md는 문맥, 강제 설정 아님; AGENTS.md 공유는 명시적 import 경로
- 원문/커밋 날짜: 본문에서 확정하지 않음 · 확인일: 2026-10-12
- 한계: 저장/로딩/준수/구현 사실은 별개; 사용자 설치 버전 미검증

### B02 · Claude Code checkpoints
- 원문: [Claude Code checkpoints](https://code.claude.com/docs/en/checkpointing)
- 구분/열람: B · 공식 문서 본문 · RESEARCH021 신규 열람
- 읽은 범위: 대화/코드 복원과 요약; Bash·외부 변경 등 복원 범위 제한
- 원문/커밋 날짜: 본문에서 확정하지 않음 · 확인일: 2026-10-12
- 한계: 실제 복원 실행 안 함. Git 대체 아님

### B03 · Codex AGENTS.md
- 원문: [Codex AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- 구분/열람: B · 공식 문서 해당 절 · RESEARCH021 신규 열람
- 읽은 범위: run별 지침 발견·계층·크기 제한
- 원문/커밋 날짜: 본문에서 확정하지 않음 · 확인일: 2026-10-12
- 한계: developers.openai.com/codex/guides/agents-md/에서 공식 리디렉션. 같은 계정 전체 맥락 공유 보장 아님

### B04 · Xero bank reconciliation
- 원문: [Xero bank reconciliation](https://central.xero.com/0/article/Reconcile-your-bank-account)
- 구분/열람: B/분야외 · 공식 검색 색인 본문 · RESEARCH021 신규 열람
- 읽은 범위: 은행 내역과 장부를 대조·후보 일치/찾기/논의
- 원문/커밋 날짜: 본문에서 확정하지 않음 · 확인일: 2026-10-12
- 한계: 웹 open 0행. 계정 UI 직접 사용·시각 검증 안 함

### B05 · Xero transfer record
- 원문: [Xero transfer record](https://central.xero.com/0/article/Transfer-money-between-your-bank-accounts-in-Xero)
- 구분/열람: B/분야외 · 공식 검색 색인 본문 · RESEARCH021 신규 열람
- 읽은 범위: 기록된 이체와 실제 은행 이체 구분
- 원문/커밋 날짜: 본문에서 확정하지 않음 · 확인일: 2026-10-12
- 한계: 은행 연결/API 실행 안 함

### B06 · Xero auto reconciliation
- 원문: [Xero auto reconciliation](https://central.xero.com/s/article/About-auto-bank-reconciliation-powered-by-JAX)
- 구분/열람: B/분야외 · 공식 검색 색인 본문 · RESEARCH021 신규 열람
- 읽은 범위: beta 자동 대사와 검토 대상 분리
- 원문/커밋 날짜: 본문에서 확정하지 않음 · 확인일: 2026-10-12
- 한계: 대사 정확도·가용 계정·현재 베타 범위 직접 검증 안 함

### B07 · AHRQ I-PASS
- 원문: [AHRQ I-PASS](https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/ipass.html)
- 구분/열람: B/분야외 · 공식 문서 본문 · RESEARCH021 신규 열람
- 읽은 범위: 상황 요약·행동·비상 대응·수신자 요약 원리
- 원문/커밋 날짜: 본문 마지막 검토: 2023-07 · 확인일: 2026-10-12
- 한계: 의료 효과 수치/의학적 권고로 사용하지 않음; 소프트웨어 인계로 옮기는 것은 새 제안

### C01 · Codex SDK
- 원문: [Codex SDK](https://learn.chatgpt.com/docs/codex-sdk)
- 구분/열람: C · 공식 문서 해당 절 · RESEARCH021 신규 열람
- 읽은 범위: TS start/run/resume 및 Python SDK 존재
- 원문/커밋 날짜: 본문에서 확정하지 않음 · 확인일: 2026-10-12
- 한계: 설치·인증·유료 호출 안 함; npm 배포 버전은 별도 확인 필요

### C02 · Codex App Server
- 원문: [Codex App Server](https://learn.chatgpt.com/docs/app-server)
- 구분/열람: C · 공식 문서 해당 절 · RESEARCH021 신규 열람
- 읽은 범위: transport/initialize/thread read-resume/steer-interrupt/생성 스키마/승인 표면
- 원문/커밋 날짜: 본문에서 확정하지 않음 · 확인일: 2026-10-12
- 한계: 본문 전체 완독 아님. WebSocket experimental/unsupported. 재연결 무손실 보장 확인 안 됨

### C03 · Codex non-interactive
- 원문: [Codex non-interactive](https://learn.chatgpt.com/docs/non-interactive-mode)
- 구분/열람: C · 공식 문서 해당 절 · RESEARCH021 신규 열람
- 읽은 범위: exec JSONL·output schema·resume·기존 CLI 인증 경로
- 원문/커밋 날짜: 본문에서 확정하지 않음 · 확인일: 2026-10-12
- 한계: output schema는 사실 정확도 보장이 아님; 설치 버전 지원 미검증

### C04 · Claude Code hooks
- 원문: [Claude Code hooks](https://code.claude.com/docs/en/hooks)
- 구분/열람: C · 공식 문서 해당 절 · RESEARCH021 신규 열람
- 읽은 범위: 이벤트 표/설정 범위/SessionStart/매칭/FileChanged 상세
- 원문/커밋 날짜: 본문에서 확정하지 않음 · 확인일: 2026-10-12
- 한계: 전체 3천여 행 완독 아님. literal 파일 watch와 일반 regex 필터 혼동 금지; 실제 이벤트 미수신

### C05 · Claude Agent SDK overview
- 원문: [Claude Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)
- 구분/열람: C · 공식 문서 본문 · RESEARCH021 신규 열람
- 읽은 범위: 기능·언어·세션·권한·인증 제한·라이선스 안내
- 원문/커밋 날짜: 본문에서 확정하지 않음 · 확인일: 2026-10-12
- 한계: 제품이 claude.ai 로그인/한도를 제공하는 것은 사전 승인 없는 기본 허용 경로 아님

### C06 · Claude Code routines
- 원문: [Claude Code routines](https://code.claude.com/docs/en/routines)
- 구분/열람: C · 공식 문서 해당 절 · RESEARCH021 신규 열람
- 읽은 범위: 예약/이벤트 실행 및 green run과 실제 작업 성공의 구분
- 원문/커밋 날짜: 본문에서 확정하지 않음 · 확인일: 2026-10-12
- 한계: preview; 직접 사용/설정/가격 확인 안 함; 일반 claude.ai 모든 대화에 적용되는 것으로 해석 안 함

### C07 · Claude TS SDK 공개 저장소
- 원문: [Claude TS SDK 공개 저장소](https://github.com/anthropics/claude-agent-sdk-typescript)
- 구분/열람: C · README·루트 목록 · RESEARCH021 신규 열람
- 읽은 범위: examples/scripts/CHANGELOG/LICENSE.md 목록 및 README
- 원문/커밋 날짜: 본문에서 확정하지 않음 · 확인일: 2026-10-12
- 한계: SDK 내부 구현·배포 tarball·테스트·고정 커밋 미열람. 공개 저장소 이름만으로 MIT/오픈 코어라고 하지 않음

### X01 · Cline #2739
- 원문: [Cline #2739](https://github.com/cline/cline/issues/2739)
- 구분/열람: 경험/반례 · 원문 본문 · RESEARCH021 신규 열람
- 읽은 범위: morisono: Cline/Roo 사이 checkpoint 복원 실패
- 원문/커밋 날짜: 2025-04-08 · 확인일: 2026-10-12
- 한계: 작성자 환경의 보고. closed만으로 수정 입증 아님

### X02 · Cline #5863
- 원문: [Cline #5863](https://github.com/cline/cline/issues/5863)
- 구분/열람: 경험/반례 · 원문 본문 · RESEARCH021 신규 열람
- 읽은 범위: liu-jx18: 저장했다고 한 변경과 파일의 불일치, 간헐성·재시작 경험
- 원문/커밋 날짜: 2025-08-28 · 확인일: 2026-10-12
- 한계: 중국어 제목, 본문은 주로 영어. 원인/재현·수정 미확정

### X03 · 일본어 Claude 웹 UI 제작 경험
- 원문: [일본어 Claude 웹 UI 제작 경험](https://zenn.dev/botachan/articles/ec492aef5658e6)
- 구분/열람: 경험/반례 · 원문 본문 · RESEARCH021 신규 열람
- 읽은 범위: botachan: PTY에서 headless로 전환, 대화·파일 rewind 구현 경험
- 원문/커밋 날짜: 2025-12-09 · 확인일: 2026-10-12
- 한계: 개인 제작자 1건. 당시 SDK 한계 설명을 현재 사실로 전용하지 않음; 연결 소스/라이선스 미열람

### X04 · Claude #33026
- 원문: [Claude #33026](https://github.com/anthropics/claude-code/issues/33026)
- 구분/열람: 경험/반례 · 원문 본문 · RESEARCH021 신규 열람
- 읽은 범위: maboroshi-appdev: 압축 뒤 기록된 테스트명 규칙을 다시 읽지 않음
- 원문/커밋 날짜: 2026-03-11 · 확인일: 2026-10-12
- 한계: closed not planned. 압축이 유일 원인이라는 실험 아님

### X05 · Claude #21788
- 원문: [Claude #21788](https://github.com/anthropics/claude-code/issues/21788)
- 구분/열람: 경험/반례 · 원문 본문 · RESEARCH021 신규 열람
- 읽은 범위: campusitconsulting: 압축 요약에서 유지/손실 내용을 확인하려는 요구
- 원문/커밋 날짜: 2026-01-29 · 확인일: 2026-10-12
- 한계: 실사용 배경의 기능 요청; confirmed bug 아님. duplicate 연결 글은 별도 사용자 수로 세지 않음

### X06 · OpenSpec #1120
- 원문: [OpenSpec #1120](https://github.com/Fission-AI/OpenSpec/issues/1120)
- 구분/열람: 경험/반례 · 원문 본문 · RESEARCH021 신규 열람
- 읽은 범위: rChaoz: 누락된 sync skill 경로 때문에 delta가 main spec으로 복사되는 문제
- 원문/커밋 날짜: 2026-05-23 · 확인일: 2026-10-12
- 한계: closed/연결 PR 확인만으로 해결 코드를 읽었다고 하지 않음

### X07 · OpenSpec #2033 설계 토론
- 원문: [OpenSpec #2033 설계 토론](https://github.com/Fission-AI/OpenSpec/issues/2033)
- 구분/열람: 경험/반례 · 원문 본문 · RESEARCH021 신규 열람
- 읽은 범위: TabishB: 이름 기반 결정적 병합을 계속 유지할지에 대한 열린 질문
- 원문/커밋 날짜: 2026-10-02 (수정 10-11) · 확인일: 2026-10-12
- 한계: connector 본문 열람. 승인된 변경안 아님; 인용된 46개 수정 커밋은 재집계 안 함

### K01 · jsondiffpatch arrays
- 원문: [jsondiffpatch arrays](https://github.com/benjamine/jsondiffpatch/blob/a60db8a232f92ee4b987c14f43f77402885d1a5a/packages/jsondiffpatch/src/filters/arrays.ts)
- 구분/열람: 코드/재사용 · 고정 커밋 원문 · RESEARCH021 신규 열람
- 읽은 범위: 1–110: 객체 매칭과 objectHash
- 원문/커밋 날짜: 2026-05-14 · 확인일: 2026-10-12
- commit: `a60db8a232f92ee4b987c14f43f77402885d1a5a`
- 한계: 정적 읽기만. 설치/빌드/테스트 실행·보안 감사·유료 호출 없음

### K02 · jsondiffpatch DiffPatcher
- 원문: [jsondiffpatch DiffPatcher](https://github.com/benjamine/jsondiffpatch/blob/a60db8a232f92ee4b987c14f43f77402885d1a5a/packages/jsondiffpatch/src/diffpatcher.ts)
- 구분/열람: 코드/재사용 · 고정 커밋 원문 · RESEARCH021 신규 열람
- 읽은 범위: 전체: diff/patch/reverse/unpatch
- 원문/커밋 날짜: 2026-05-14 · 확인일: 2026-10-12
- commit: `a60db8a232f92ee4b987c14f43f77402885d1a5a`
- 한계: 정적 읽기만. 설치/빌드/테스트 실행·보안 감사·유료 호출 없음

### K03 · jsondiffpatch tests
- 원문: [jsondiffpatch tests](https://github.com/benjamine/jsondiffpatch/blob/a60db8a232f92ee4b987c14f43f77402885d1a5a/packages/jsondiffpatch/test/index.spec.ts)
- 구분/열람: 코드/재사용 · 고정 커밋 원문 · RESEARCH021 신규 열람
- 읽은 범위: 1–190: 왕복·cloneDiffValues 검사
- 원문/커밋 날짜: 2026-05-14 · 확인일: 2026-10-12
- commit: `a60db8a232f92ee4b987c14f43f77402885d1a5a`
- 한계: 정적 읽기만. 설치/빌드/테스트 실행·보안 감사·유료 호출 없음

### K04 · jsondiffpatch package
- 원문: [jsondiffpatch package](https://github.com/benjamine/jsondiffpatch/blob/a60db8a232f92ee4b987c14f43f77402885d1a5a/packages/jsondiffpatch/package.json)
- 구분/열람: 코드/재사용 · 고정 커밋 원문 · RESEARCH021 신규 열람
- 읽은 범위: 전체: 0.7.6, ESM/exports/engines/dependency
- 원문/커밋 날짜: 2026-05-14 · 확인일: 2026-10-12
- commit: `a60db8a232f92ee4b987c14f43f77402885d1a5a`
- 한계: 정적 읽기만. 설치/빌드/테스트 실행·보안 감사·유료 호출 없음

### K05 · jsondiffpatch license
- 원문: [jsondiffpatch license](https://github.com/benjamine/jsondiffpatch/blob/a60db8a232f92ee4b987c14f43f77402885d1a5a/MIT-LICENSE.txt)
- 구분/열람: 코드/재사용 · 고정 커밋 원문 · RESEARCH021 신규 열람
- 읽은 범위: 전체 MIT
- 원문/커밋 날짜: 2026-05-14 · 확인일: 2026-10-12
- commit: `a60db8a232f92ee4b987c14f43f77402885d1a5a`
- 한계: 정적 읽기만. 설치/빌드/테스트 실행·보안 감사·유료 호출 없음

### K06 · OpenSpec specs-apply
- 원문: [OpenSpec specs-apply](https://github.com/Fission-AI/OpenSpec/blob/9111a7654d7800391459431fff4eaf66e33a3d2e/src/core/specs-apply.ts)
- 구분/열람: 코드/재사용 · 고정 커밋 원문 · RESEARCH021 신규 열람
- 읽은 범위: 1–185,230–440: 경로/누락/중복/충돌 검증. 실제 write 후반 미열람
- 원문/커밋 날짜: 2026-10-06 · 확인일: 2026-10-12
- commit: `9111a7654d7800391459431fff4eaf66e33a3d2e`
- 한계: 정적 읽기만. 설치/빌드/테스트 실행·보안 감사·유료 호출 없음

### K07 · OpenSpec archive
- 원문: [OpenSpec archive](https://github.com/Fission-AI/OpenSpec/blob/9111a7654d7800391459431fff4eaf66e33a3d2e/src/core/archive.ts)
- 구분/열람: 코드/재사용 · 고정 커밋 원문 · RESEARCH021 신규 열람
- 읽은 범위: 1–110: isRetirableSpec/비기술자에게도 보이는 누락 경고
- 원문/커밋 날짜: 2026-10-06 · 확인일: 2026-10-12
- commit: `9111a7654d7800391459431fff4eaf66e33a3d2e`
- 한계: 정적 읽기만. 설치/빌드/테스트 실행·보안 감사·유료 호출 없음

### K08 · OpenSpec near-miss tests
- 원문: [OpenSpec near-miss tests](https://github.com/Fission-AI/OpenSpec/blob/9111a7654d7800391459431fff4eaf66e33a3d2e/test/core/specs-apply.requirement-name-near-miss.test.ts)
- 구분/열람: 코드/재사용 · 고정 커밋 원문 · RESEARCH021 신규 열람
- 읽은 범위: 1–165: 이름 유사 중복과 명시적 제거/rename 후 추가 대조
- 원문/커밋 날짜: 2026-10-06 · 확인일: 2026-10-12
- commit: `9111a7654d7800391459431fff4eaf66e33a3d2e`
- 한계: 정적 읽기만. 설치/빌드/테스트 실행·보안 감사·유료 호출 없음

### K09 · OpenSpec package
- 원문: [OpenSpec package](https://github.com/Fission-AI/OpenSpec/blob/9111a7654d7800391459431fff4eaf66e33a3d2e/package.json)
- 구분/열람: 코드/재사용 · 고정 커밋 원문 · RESEARCH021 신규 열람
- 읽은 범위: 전체: 1.14.1, Node 범위와 CLI dependencies
- 원문/커밋 날짜: 2026-10-06 · 확인일: 2026-10-12
- commit: `9111a7654d7800391459431fff4eaf66e33a3d2e`
- 한계: 정적 읽기만. 설치/빌드/테스트 실행·보안 감사·유료 호출 없음

### K10 · OpenSpec license
- 원문: [OpenSpec license](https://github.com/Fission-AI/OpenSpec/blob/9111a7654d7800391459431fff4eaf66e33a3d2e/LICENSE)
- 구분/열람: 코드/재사용 · 고정 커밋 원문 · RESEARCH021 신규 열람
- 읽은 범위: 전체 MIT
- 원문/커밋 날짜: 2026-10-06 · 확인일: 2026-10-12
- commit: `9111a7654d7800391459431fff4eaf66e33a3d2e`
- 한계: 정적 읽기만. 설치/빌드/테스트 실행·보안 감사·유료 호출 없음

### K11 · Codex Thread
- 원문: [Codex Thread](https://github.com/openai/codex/blob/27065a91ccbf5ba8532844be3777fcf83b77820d/sdk/typescript/src/thread.ts)
- 구분/열람: 코드/재사용 · 고정 커밋 원문 · RESEARCH021 신규 열람
- 읽은 범위: 전체: run/runStreamed/ID/오류/정리
- 원문/커밋 날짜: 2026-10-11 · 확인일: 2026-10-12
- commit: `27065a91ccbf5ba8532844be3777fcf83b77820d`
- 한계: 정적 읽기만. 설치/빌드/테스트 실행·보안 감사·유료 호출 없음

### K12 · Codex Exec
- 원문: [Codex Exec](https://github.com/openai/codex/blob/27065a91ccbf5ba8532844be3777fcf83b77820d/sdk/typescript/src/exec.ts)
- 구분/열람: 코드/재사용 · 고정 커밋 원문 · RESEARCH021 신규 열람
- 읽은 범위: 1–285: 실행 인수/env/spawn/줄 스트림/종료 정리. 뒤 직렬화·플랫폼 해결부 미열람
- 원문/커밋 날짜: 2026-10-11 · 확인일: 2026-10-12
- commit: `27065a91ccbf5ba8532844be3777fcf83b77820d`
- 한계: 정적 읽기만. 설치/빌드/테스트 실행·보안 감사·유료 호출 없음

### K13 · Codex events
- 원문: [Codex events](https://github.com/openai/codex/blob/27065a91ccbf5ba8532844be3777fcf83b77820d/sdk/typescript/src/events.ts)
- 구분/열람: 코드/재사용 · 고정 커밋 원문 · RESEARCH021 신규 열람
- 읽은 범위: 전체: turn/item 완료 의미
- 원문/커밋 날짜: 2026-10-11 · 확인일: 2026-10-12
- commit: `27065a91ccbf5ba8532844be3777fcf83b77820d`
- 한계: 정적 읽기만. 설치/빌드/테스트 실행·보안 감사·유료 호출 없음

### K14 · Codex abort tests
- 원문: [Codex abort tests](https://github.com/openai/codex/blob/27065a91ccbf5ba8532844be3777fcf83b77820d/sdk/typescript/tests/abort.test.ts)
- 구분/열람: 코드/재사용 · 고정 커밋 원문 · RESEARCH021 신규 열람
- 읽은 범위: 전체: 선행·도중 취소와 정상 대조
- 원문/커밋 날짜: 2026-10-11 · 확인일: 2026-10-12
- commit: `27065a91ccbf5ba8532844be3777fcf83b77820d`
- 한계: 정적 읽기만. 설치/빌드/테스트 실행·보안 감사·유료 호출 없음

### K15 · Codex SDK package
- 원문: [Codex SDK package](https://github.com/openai/codex/blob/27065a91ccbf5ba8532844be3777fcf83b77820d/sdk/typescript/package.json)
- 구분/열람: 코드/재사용 · 고정 커밋 원문 · RESEARCH021 신규 열람
- 읽은 범위: 전체: 0.0.0-dev, Node>=18, ESM. 배포 npm 버전 아님
- 원문/커밋 날짜: 2026-10-11 · 확인일: 2026-10-12
- commit: `27065a91ccbf5ba8532844be3777fcf83b77820d`
- 한계: 정적 읽기만. 설치/빌드/테스트 실행·보안 감사·유료 호출 없음

### K16 · Codex license
- 원문: [Codex license](https://github.com/openai/codex/blob/27065a91ccbf5ba8532844be3777fcf83b77820d/LICENSE)
- 구분/열람: 코드/재사용 · 고정 커밋 원문 · RESEARCH021 신규 열람
- 읽은 범위: 1–135: Apache2 및 재배포 조건. 나머지 조항 완독 아님
- 원문/커밋 날짜: 2026-10-11 · 확인일: 2026-10-12
- commit: `27065a91ccbf5ba8532844be3777fcf83b77820d`
- 한계: 정적 읽기만. 설치/빌드/테스트 실행·보안 감사·유료 호출 없음

### K17 · Codex NOTICE
- 원문: [Codex NOTICE](https://github.com/openai/codex/blob/27065a91ccbf5ba8532844be3777fcf83b77820d/NOTICE)
- 구분/열람: 코드/재사용 · 고정 커밋 원문 · RESEARCH021 신규 열람
- 읽은 범위: 전체: OpenAI/Ratatui 고지
- 원문/커밋 날짜: 2026-10-11 · 확인일: 2026-10-12
- commit: `27065a91ccbf5ba8532844be3777fcf83b77820d`
- 한계: 정적 읽기만. 설치/빌드/테스트 실행·보안 감사·유료 호출 없음

### K18 · effortless README
- 원문: [effortless README](https://github.com/HeyCubit/effortless/blob/0690b9cf12b6d1d286a7ceb40ee7e97ce47dd6d6/README.md)
- 구분/열람: 코드/재사용 · 고정 커밋 원문 · RESEARCH021 신규 열람
- 읽은 범위: 1–135: UX/수동 우선/인계/벤치 설명
- 원문/커밋 날짜: 2026-10-10 · 확인일: 2026-10-12
- commit: `0690b9cf12b6d1d286a7ceb40ee7e97ce47dd6d6`
- 한계: 정적 읽기만. 설치/빌드/테스트 실행·보안 감사·유료 호출 없음

### K19 · effortless A/B 평가기
- 원문: [effortless A/B 평가기](https://github.com/HeyCubit/effortless/blob/0690b9cf12b6d1d286a7ceb40ee7e97ce47dd6d6/bench/quality.mjs)
- 구분/열람: 코드/재사용 · 고정 커밋 원문 · RESEARCH021 신규 열람
- 읽은 범위: 전체: ask/GRADE/pool/verdict/집계
- 원문/커밋 날짜: 2026-10-10 · 확인일: 2026-10-12
- commit: `0690b9cf12b6d1d286a7ceb40ee7e97ce47dd6d6`
- 한계: 정적 읽기만. 설치/빌드/테스트 실행·보안 감사·유료 호출 없음

### K20 · effortless 런타임 진입
- 원문: [effortless 런타임 진입](https://github.com/HeyCubit/effortless/blob/0690b9cf12b6d1d286a7ceb40ee7e97ce47dd6d6/hooks/register.tsx)
- 구분/열람: 코드/재사용 · 고정 커밋 원문 · RESEARCH021 신규 열람
- 읽은 범위: 1–160 요청, 응답 말미 SVG 잘림. import/state/초기 정책까지만 읽음
- 원문/커밋 날짜: 2026-10-10 · 확인일: 2026-10-12
- commit: `0690b9cf12b6d1d286a7ceb40ee7e97ce47dd6d6`
- 한계: 정적 읽기만. 설치/빌드/테스트 실행·보안 감사·유료 호출 없음

### K21 · effortless tests
- 원문: [effortless tests](https://github.com/HeyCubit/effortless/blob/0690b9cf12b6d1d286a7ceb40ee7e97ce47dd6d6/tests/effortless.test.ts)
- 구분/열람: 코드/재사용 · 고정 커밋 원문 · RESEARCH021 신규 열람
- 읽은 범위: 1–165: helper 및 auto on/off 실제 송신값 mock 검사
- 원문/커밋 날짜: 2026-10-10 · 확인일: 2026-10-12
- commit: `0690b9cf12b6d1d286a7ceb40ee7e97ce47dd6d6`
- 한계: 정적 읽기만. 설치/빌드/테스트 실행·보안 감사·유료 호출 없음

### K22 · effortless license
- 원문: [effortless license](https://github.com/HeyCubit/effortless/blob/0690b9cf12b6d1d286a7ceb40ee7e97ce47dd6d6/LICENSE)
- 구분/열람: 코드/재사용 · 고정 커밋 원문 · RESEARCH021 신규 열람
- 읽은 범위: 전체 MIT
- 원문/커밋 날짜: 2026-10-10 · 확인일: 2026-10-12
- commit: `0690b9cf12b6d1d286a7ceb40ee7e97ce47dd6d6`
- 한계: 정적 읽기만. 설치/빌드/테스트 실행·보안 감사·유료 호출 없음
