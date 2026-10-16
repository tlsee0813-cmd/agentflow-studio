# AgentFlow Studio 제품 기준과 공개 버전

2026-10-16 홈15 전체문구 읽기 fix2 통합 시점의 사실 기준. 현재 연구·배정은 [ACTIVE](cycles/ACTIVE.md) 한곳에서 갱신한다. 과거 종료·예약 PAUSED는 이전 인계 당시 기록이며 사용자의 이후 재개 지시를 대체하지 않는다.

**제품 기준 checkpoint에 PC 읽기·명시 편집·지도 복귀·지도 공간 개선과 프로젝트 카드 홈과 진입 전 전체 이름·목적 읽기를 반영했다.** [PR #6](https://github.com/tlsee0813-cmd/agentflow-studio/pull/6) · [홈15 결과](cycles/2026-10-16-project-home-15/RESULT.md). [PR #4](https://github.com/tlsee0813-cmd/agentflow-studio/pull/4) · [제품13 결과·검증·남은 조건](cycles/2026-10-16-pc-map-space-13/RESULT.md). 현재 공개 MOCK은 여전히 USE106이다. 제품 소스와 공개 배포를 혼동하지 않는다.

## 제품 목적과 현재 범위

외부 AI 개발 과정에서 목적·요청·작업문·결과·변경을 잃지 않고 이어 가도록 돕는다. 공간형 진행 화면에서 영역과 작업을 살펴보고, 외부 도구에 전달할 작업문과 돌아온 보고를 연결한다. 자동 실행 서비스가 아니며 실행 자동화·계정 동기화·실작업 자동 진행은 구현하지 않았다.

현재 제품은 PC의 영역 구상·선택 요청 읽기, 명시 이어가기·기존 수동 편집, 출발 지도 복귀를 연결한다. 읽기만으로 작업을 바꾸지 않고 필요한 원문은 펼쳐 읽는다. 기존 continuity의 목적·요청·기준·작업·결과 연결 위에 이 흐름을 추가했다. USE106은 첫 목적과 요청을 함께 제출할 때 목적을 배경으로 보존하고, 검토 화면에서 원문·별도 조건·열린 질문·다음 행동을 구분한다. 빈 조건란은 원문 조건의 부재를 뜻하지 않는다. 원문 보존·수동 편집·확정사항 보호는 AI의 의미 정확성과 별개다.

## 어떤 버전인가

| 구분 | 정확한 기준 | 상태 |
|---|---|---|
| 제품 기준 checkpoint | [병합 4393fcc7](https://github.com/tlsee0813-cmd/agentflow-studio/commit/4393fcc77d71b9c51492e8dfd2701545caf17e5c), 제품소스 [a5a48a71](https://github.com/tlsee0813-cmd/agentflow-studio/commit/a5a48a715c41d1f8ea928af48a33d264c295a128) | 제품12·13 위 홈15 프로젝트카드·목적·공간진입/목록복귀·진입 전 전체문구 읽기. [결과·남은보완](cycles/2026-10-16-project-home-15/RESULT.md) |
| 현재 공개 MOCK | [gh-pages `63f5540d`](https://github.com/tlsee0813-cmd/agentflow-studio/commit/63f5540d062861439f0932cd7311c6c5510e227c) · [BUILD.txt](https://github.com/tlsee0813-cmd/agentflow-studio/blob/63f5540d062861439f0932cd7311c6c5510e227c/BUILD.txt) | 위 USE106 소스의 정적 browser MOCK. 실제 AI 없음 |
| 이전 공개 기준 | 소스 [`2931b509`](https://github.com/tlsee0813-cmd/agentflow-studio/commit/2931b50938af037a43e20ed7aba69b96ab79843d) · 배포 [`d7b0bf85`](https://github.com/tlsee0813-cmd/agentflow-studio/commit/d7b0bf8541ba0b5ecca914f8d6f412f44af24127) | 비교·되돌리기 기준이며 현재 공개 버전 아님 |
| GUIDE107 병렬 후보 | [`3fd4b305`](https://github.com/tlsee0813-cmd/agentflow-studio/commit/3fd4b3055328862c8b8471b356ee5f3772a8deee), 부모 `2931b509` | 소스 검토·CI 통과, 실제 AI 의미 품질 **HOLD**. USE106·공개 소스에 미통합 |
| main / dev | [main `896dcf38`](https://github.com/tlsee0813-cmd/agentflow-studio/commit/896dcf3848fec70357d0f9bd4fd6c09cab70db37) / dev 없음 | main은 초기 커밋이며 최신 제품 아님 |
| [과거 Draft PR #1](https://github.com/tlsee0813-cmd/agentflow-studio/pull/1) | `init-003/fix-review-regressions@61c3b2f0` → `main@896dcf38` | closed·미병합. 본문·댓글 보존 |
| [과거 Draft PR #2](https://github.com/tlsee0813-cmd/agentflow-studio/pull/2) | `flow049/outcome-home@f0fa5326` → `init-003/fix-review-regressions@61c3b2f0` | 과거 목적 홈 단계, closed·미병합. 본문·댓글 보존. 최신 제품 통합 PR 아님 |

USE106과 GUIDE107은 같은 이전 공개 소스에서 갈라진 병렬 작업이다. 문서 정리가 두 제품 소스를 합쳤다는 뜻은 아니다. main·gh-pages는 그대로 유지하고, 기존22개 브랜치는 [태그 보관·SHA 검증 후 정리](REPOSITORY_ARCHIVE.md)했다. PR #1·#2는 미병합으로 닫았다. 이전 인계 당시 사용자 개편안 대기 상태였으며, 이후 연구는 [ACTIVE](cycles/ACTIVE.md)에 기록한다.

## 홈15 검증과 수용 경계

PC 프로젝트 카드 홈을 제품13 위에 통합했다. Windows·Ubuntu CI와 독립 조작·이미지/코드 검토를 통과했다. [홈15 결과와 공유 증거](cycles/2026-10-16-project-home-15/RESULT.md)에 정확한 범위와 한계를 기록했다. 긴 공통 접두사의 전체 이름·목적은 기존 더보기의 읽기창에서 확인하고 같은 카드로 닫는다. 독립검사에서 발견한 닫기초점 키보드 배경스크롤 결함은 fix2에서 고쳤다. 같은50관측4실패→전부통과, HOME15 21검사·별도판단·최종양OS CI를 구분해 수용했다. 카드 자체만으로 같은접두사 구별이 끝났다는 뜻은 아니다. [현재 PC 체험](http://127.0.0.1:8765/product15-read-full-preview/runtime/index.html)은 로컬 정적 MOCK이며 공개 배포가 아니다.

## 제품13 검증과 수용 경계

최종60612050의 Windows·Ubuntu CI가 성공했다. 독립 고정8장면에서 같은 도구 검사가 v0 6실패, fix1 전부 통과했다. 안내·기록 펼침·선택상세·긴 내용 표본과 실제 확대/축소/맞춤을 확인했고 대표 복귀4경로를 재확인했다. 원래 ‘선택 카드 자체 접근’ strict 조건은 여전히 실패하며, 패널에서 읽고 닫아 복귀하는 통과와 섞지 않는다. 첫 화면 지도 공간·도구 접근 개선을 한정 수용했다. [결과와 공유 증거](cycles/2026-10-16-pc-map-space-13/RESULT.md).

사용자의 현재 평가 기준은 Dify 실제 조작 비교다. 사람 사용 기록 제출을 추가 관문으로 두지 않는다. Dify의 실행 워크플로와 우리의 구성·변경·인계 지도 목적을 구분하며, 이 비교를 사람 대상 연구를 수행했다는 뜻으로 기록하지 않는다.

## 제품12 검증

최종9613208f의 CI는 Windows·Ubuntu 모두 성공했고 각 PC12 15개가 실제 실행됐다. 독립 고정6장면, 별도 PC6장면·경계·390최소 검사를 구분해 수용했다. 최초 결함·검사 오류·과장 문구의 정정과 실제 종료값, 공유 원시 자료는 [제품12 결과](cycles/2026-10-16-product-reading-return-12/RESULT.md)에 연결한다. 사람 사용성·큰 지도·전체 모바일·실제 AI 품질 수용은 아니다.

## 이전 USE106 UI와 현재 공개 MOCK 검증

- 제품 구현은 [`a84f83a7`](https://github.com/tlsee0813-cmd/agentflow-studio/commit/a84f83a77a9115d45a2a38a77c5d10f018d05901)에서 수용했다. 첫 [CI38702330366](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/38702330366)은 Ubuntu 성공·Windows 새 test07 실패였고, 이 상태로 게시하지 않았다. 실패는 native clipboard의 CRLF와 textarea의 LF 전문 비교였다.
- [최종 소스 `618d9bd2`](https://github.com/tlsee0813-cmd/agentflow-studio/commit/618d9bd2b99ad433df35107d8902b15f45e30000)는 검사·증거만 보완했다. CRLF 쌍만 LF로 정규화하고 전문 동등 비교·Markdown·ID·권한 검사를 유지했으며 제품 코드 변경은 없다. [수리 기록](https://github.com/tlsee0813-cmd/agentflow-studio/blob/618d9bd2b99ad433df35107d8902b15f45e30000/docs/reviews/use106/windows-ci-repair.md). 좁은 독립 검토 수용, [exact CI38703882455](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/38703882455)는 Ubuntu·Windows 모두 success다.
- [구현·로컬 검사 기록](https://github.com/tlsee0813-cmd/agentflow-studio/blob/618d9bd2b99ad433df35107d8902b15f45e30000/docs/reviews/use106/README.md): continuity Node210/210, 기존 browser66/66, USE106 browser11/11 및 check/build. 합성 자료·MOCK 기반 구현 회귀이며 사람 사용성·AI 의미 품질 평가가 아니다.
- 공개 실행 자산15개는 수용된 `a84f83a7` 산출물과 동일하다. BUILD를 포함한16개 원격 파일의 해시 대조와 독립 공개 HTTPS 확인이 통과했다. [exact Pages38705109869](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/38705109869)는 배포 `63f5540d`로 completed/success다. BUILD SHA256: `a49029bad1a3cc2ab12eca70663218063194b58cc55115824508e206d7f32f4b`.
- 공개 화면의 좁은 native smoke에서 새로고침 뒤 기존 합성 프로젝트의 목적·영역·요청2·기준2가 유지됐고 현재 작업의 검토 영역·다음 행동 안내를 확인했다. console error0. 전체 검사의 재실행이나 사람 대상 사용성 평가로 세지 않는다.
- 공개 화면은 정적 MOCK이며 CSP도 이에 맞춰 제한된다. 공개 AI backend·외부 개발 도구 자동 실행·계정 동기화의 검증이나 구현을 뜻하지 않는다.

## GUIDE107 실제 AI — HOLD·미통합

[후보 소스](https://github.com/tlsee0813-cmd/agentflow-studio/commit/3fd4b3055328862c8b8471b356ee5f3772a8deee)의 좁은 독립 검토는 ACCEPT, [exact CI38700663131](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/38700663131)는 양OS success다. 하지만 제품/provider HTTP200·finish stop17·retry0과 의미 품질 수용은 별개다.

실제17회는 초기8 + 실제 질문에 대한 답변2 + direct currentInstruction7이다. 출력은 question1/proposal16, 제품 내 미전송 채택16이었다. 실제 질문 경로는 HB 한 곳이며 direct7을 질문·답변 검증으로 세지 않는다. 제품 내 채택은 외부 개발 도구 전달·실행·완료가 아니다.

총괄과 별도 독립 의미 검토는 **HOLD를 수용**했다. 차단점은 다음 두 가지다.

- CSV 보류 direct 응답: 입력 행 수와 결과 행 수의 합이 다시 입력과 같아야 한다는 불가능한 완료 조건을 만들었다.
- 리듬 보류 응답: 기존 대응 관계를 다시 짝짓는 AI 기본값이 이른 입력을 놓칠 수 있고 음수 차이 표시 약속과도 충돌했다.

C2는 해당 표본 통과, C1은 부분 개선이나 전체 흐름 미입증, C3/HB는 HOLD다. C4/HA와 비공개2사례는 핵심 조건 보존을 관측했지만 전체 수용으로 확대하지 않는다. 비공개 사례 원문은 옮기지 않는다. 원문 보존·기존 수동 편집·확정사항 보호 및 실제 통신 완료는 의미 정확성·실사용자 효용·서비스 완성의 증거가 아니다.

고정 증거: [FINAL-REPORT](https://github.com/tlsee0813-cmd/agentflow-studio/blob/b8940d415c5d3afe20aaf4302286ea59f24496e5/docs/evidence/guide107-ai-3fd4b305/FINAL-REPORT.txt) · [INDEX](https://github.com/tlsee0813-cmd/agentflow-studio/blob/b8940d415c5d3afe20aaf4302286ea59f24496e5/docs/evidence/guide107-ai-3fd4b305/INDEX.txt) · [semantic-assessment](https://github.com/tlsee0813-cmd/agentflow-studio/blob/b8940d415c5d3afe20aaf4302286ea59f24496e5/docs/evidence/guide107-ai-3fd4b305/semantic-assessment.json). 추가 수정·재평가 사이클은 시작하지 않는다.

## 남은 제약

- 개별 결과 원문 수정·삭제·제외·연결 해제는 미구현이다. 정정 요청을 남겨도 기존 결과와 연결은 남고 전달문에 포함될 수 있다.
- 브라우저 로컬 저장·백업/복구는 있으나 계정 간 동기화는 없다. quota 오류 뒤 메모리에만 남은 변경을 영구 저장으로 약속하지 않는다.
- MOCK의 의미 오해와 원문 조건·미정의 완전한 자동 추출은 해결됐다고 주장하지 않는다. 실제 AI 후보도 위 의미 품질 한계가 남았다.
- 실제 고객의 시간 절감·효용, 일반 모델 정확도·운영 준비는 미검증이다. AI의 역할 수행 검사와 사람의 실제 개발 사용성 검사는 다르다.
- PC 첫 화면 공간과 도구 접근은 제품13에서 한정 개선했다. 선택 카드의 화면 내 접근, 상세 읽기 부담, 새 외부 기록과 사용자 수정의 통합은 남아 있다. 현재 배정·진행 여부는 [ACTIVE](cycles/ACTIVE.md)를 본다. 이전 정지 문구와 별개로 사용자가 연구·개발 재개를 지시했다.

## 근거와 과거 기록

현재 상태를 과거 문서의 머리말과 혼동하지 않는다. 다른 역사·연구·실패 기록은 삭제하지 않았다.

- [이전 집계 문서](https://github.com/tlsee0813-cmd/agentflow-studio/blob/618d9bd2b99ad433df35107d8902b15f45e30000/docs/PROJECT_STATUS.md), [이전 진입 안내](https://github.com/tlsee0813-cmd/agentflow-studio/blob/618d9bd2b99ad433df35107d8902b15f45e30000/docs/START_HERE.md)
- [USE106 검토](https://github.com/tlsee0813-cmd/agentflow-studio/blob/618d9bd2b99ad433df35107d8902b15f45e30000/docs/reviews/use106/README.md), [GUIDE097](https://github.com/tlsee0813-cmd/agentflow-studio/blob/618d9bd2b99ad433df35107d8902b15f45e30000/docs/guide097-area-guidance.md), [SPATIAL102](https://github.com/tlsee0813-cmd/agentflow-studio/blob/618d9bd2b99ad433df35107d8902b15f45e30000/docs/spatial102-enter-first.md)
- [목적 홈 이력](https://github.com/tlsee0813-cmd/agentflow-studio/blob/618d9bd2b99ad433df35107d8902b15f45e30000/docs/flow049-outcome-home.md), [초기 앱 단계별 기록](https://github.com/tlsee0813-cmd/agentflow-studio/blob/618d9bd2b99ad433df35107d8902b15f45e30000/app/docs/PROJECT_STATUS.md), [초기 탐색·진단 이력](https://github.com/tlsee0813-cmd/agentflow-studio/blob/618d9bd2b99ad433df35107d8902b15f45e30000/docs/quality026-design.md)
