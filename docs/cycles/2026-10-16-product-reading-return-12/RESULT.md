# 제품 PC 읽기·편집·지도 복귀12 결과

2026-10-16 총괄 판정. 이 문서는 이번 수용 시점의 기록이며 현재 배정은 [ACTIVE](../ACTIVE.md)에서 갱신한다.

## 판정과 제품 변화

**PC의 좁은 읽기 → 명시 이어가기/기존 편집 → 출발 지도 복귀 흐름을 제품 기준에 수용한다.** 최종 소스는 [9613208f](https://github.com/tlsee0813-cmd/agentflow-studio/commit/9613208f40f1f7f8506504ac6025f06e421edd4d), 기준은 USE106 `618d9bd2`다. [PR #3](https://github.com/tlsee0813-cmd/agentflow-studio/pull/3)은 `checkpoint/2026-10-15`에 통합했다. 병합 커밋은 [ecf586c8](https://github.com/tlsee0813-cmd/agentflow-studio/commit/ecf586c8a2235e4f4c570cab13bf0dbdc4004003)이며 직전 checkpoint48b6fed와 최종 제품9613208f를 부모로 갖는다. 직전 checkpoint 대비 변경은 위5파일뿐이고 최종 후보의 Git blob과 일치한다. 공개 MOCK과 main 반영은 별도이며 이번 수용에 포함하지 않는다.

영역의 이름과 현재 구상을 먼저 읽고 관련 작업을 직접 고른다. 읽는 것만으로 현재 작업이나 미전송 보고를 바꾸지 않는다. 긴 이해·범위와 원문·조건·과거 배경은 필요할 때 펼친다. 직접 편집값, AI/MOCK 제안, 오래되어 현재 설명에서 제외된 값의 출처를 구분한다. 자동으로 최신 보고를 고르지 않는다.

읽는 요청 A와 실제 이어갈 기록은 다를 수 있다. 현재 기록 R이 A의 직접 보고이면 R을 유지하고 R의 기존 네 수동 필드만 편집한다. 현재 기록 RB가 다른 요청 B의 보고이면 명시 이어가기에서 A로 옮기고 A만 편집한다. 출발 지도 보기로 돌아가도 이 명시적 변경은 유지한다. 원래 영역·보기·확대·이동·선택·펼침과 호출 버튼으로 복귀한다. 내용 높이가 그대로면 스크롤을 유지하고, 편집으로 안내 높이가 달라졌으면 호출 버튼의 화면 위치를 보존한다. 과거 데이터나 안내를 억지로 되돌리거나 빈 여백을 만들지 않는다.

제품 변경은 app.ts/styles.css와 브라우저 검사 두 파일, CI 연결의 **5파일**이다. 기존 domain/schema/server/provider/의존성은 변경하지 않았다. 연구 엔진을 통째로 이식하거나 자동 기록 해석·일반 지도 생성기를 만든 것이 아니다.

## 검토가 바꾼 것

| 발견 | 보완과 확인 |
|---|---|
| v0 이해·범위를 200자로 자른 뒤 수동 전문을 읽을 길이 없음 | 읽기 전용 전체 펼침 추가. 원래 요청문을 수동 전문의 대체물로 보지 않음 |
| 새 PC12 검사가 CI에 빠짐 | Windows·Ubuntu 검증 흐름에 연결, 실패 종료 전파 확인 |
| 펼친 긴 구상에서 출발하면 돌아올 때 접힘 | 출발한 펼침 상태를 렌더 뒤·스크롤 복원 전에 복구 |
| fix1 편집 후 안내 높이가 바뀌어 호출 위치 이동 | 먼저 [복귀 계약](IMPLEMENTATION.md)을 명시하고 fix2에서 호출 지점의 문서 위치 변화만 보정 |
| 검사기가 새 전체 펼침을 누르지 않은 실패 | 제품 결함과 검사 조작 오류를 구별하고 동일 보완 검사로 구버전과 수정본을 비교 |
| 독립 보고의 연결 대상 B 선택 보존 주장이 실제 선택보다 넓음 | 최초 보고·원시 기록 보존, 명시 선택 UI가 반드시 존재하고 B를 선택하는 전체 재실행으로 보완. [정정문](https://github.com/tlsee0813-cmd/agentflow-studio/blob/398a91adf918113bd77dfbd3454fc3c85b00cc3d/docs/transfer/pc-reading-return-12/independent-fix2/target-selection-addendum/ERRATA.md) |

고정 v3 검사 SHA256은 `7bf48bcf6da764b80a493351e1cdfb9611bbd4f9d67711df06624451ee1b5077`이다. 같은 검사에서 v0 6실패 → fix1 4통과/2실패 → fix2 6통과다. v0/fix1 실패는 child·수집기 모두 실제1, 최종은 모두0이다. 기존 위치 기준을 통과시키려고 허용치를 넓힌 것이 아니라, 명시적 내용 변화 뒤 무엇을 보존할지 먼저 정한 계약에 따라 비교했다.

## 서로 다른 검증의 결과

검사 종류와 반복 실행의 수를 합산하지 않는다. 사람의 이해도·사용 성공률로 환산하지 않는다.

| 종류 | 고정 최종 소스에서 확인한 범위 |
|---|---|
| 작성자 회귀 | pc12 15, spatial102 11, flow090 18 각각 통과. 추가 영역 출발 2검사의 26 soft 조건은 전부 true이며 거짓이면 검사 종료1. 원시 204 condition 행 전체를 별도 204통과로 세지 않음 |
| 독립 고정 v3 | 6/6 장면, 실제 child0·collector0. 긴 전문·펼침·읽기/편집 후 복귀의 구버전 실패와 비교 |
| 독립 최종 UI | 1280×720·1440×900 × 읽기/직접 보고/다른 보고 6/6. 별도 1280 경계 묶음과 390 최소 접근 검사 완주. 최신 결과는 초기 run05가 아니라 target-selection-addendum/run01. 실제 child0·collector0 |
| 독립 저장소 회귀 | domain210/210, pc12 15, spatial102 11, flow090 18 및 check/build/static build 각각0. 독립 작성 장면 수에 합산하지 않음 |
| GitHub CI | [run38849696070](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/38849696070) Ubuntu·Windows 모두 success. 각 PC12 step26이 실제15개/OK이며 headRevision/job SHA/실제 checkout출력이 최종9613208f와 일치 |
| 총괄 실제 PC | 같은 정적 실행물의 정상 파일 가져오기 → 소개글 정보 → A읽기 → 현재 직접 보고R로 명시 이어가기 → 이해 문장 수동 수정 → 지도 복귀 → 호출 버튼 Enter로 다시 열기 → 수정값 유지 → 두 번째 복귀. 기본 브라우저 폭의 좁은 관측이며 독립 두 폭 전체검사에 합산하지 않음 |
| 정적 체험판 | 기존 build-static으로 만든 최소 MOCK 실행물의 실제 HTTP 불러오기·정상 파일 가져오기·읽기·복귀 확인. API 요청 없음. 공개 배포는 아님 |

독립 child 종료값은 process 측정이며 외부 collector 값은 실행 도구 출력의 전사 기록이다.

독립 원시는 실제 휠·빈 지도 배경 이동·행렬·카드 좌표·클립·hit·focus·출발/복귀 스크롤을 보존한다. 내용이 그대로인 읽기 경로는 windowY 동일, 편집 경로는 windowY−68px·호출 위치 오차+0.40625px이었다. 작성자 허용치1px, 독립 허용치2px를 구분한다. 다른 작업으로 현재 표시가 옮겨 생기는 카드 높이 변화는 실제 내용 변화이며 전체 rect 불변으로 주장하지 않는다. 초점 복귀는 **호출 버튼으로 복귀**이지 출발 전 activeElement와 무조건 동일하다는 뜻이 아니다.

최신 독립 원시에도 favicon 404 콘솔 1건은 있다. 중대 console/HTTP 오류 없음으로 판정하며 모든 콘솔 오류 0으로 쓰지 않는다. 공개 PNG4장은 초기 실행의 대표 장면이며 최신 B 선택 보완의 직접 증거는 최신 원시 결과다.

환경도 구분한다. 작성자 Node22.22/Playwright1.56, 독립 Node22.16/Playwright1.57 및 실제 Chromium154.0.8037.57, CI Node22.16/npm10.9.2/Python3.13.5/Playwright1.57 및 Chromium143.0.7499.4 설치 로그다. 독립은 기존 도구를 사용했고 npm ci 실행을 주장하지 않는다. CI 브라우저 번호는 설치 로그 확인이며 별도 browser.version 파일 감사와 같지 않다.

## 공유 증거와 남은 한계

- [최종 독립 결과](https://github.com/tlsee0813-cmd/agentflow-studio/blob/398a91adf918113bd77dfbd3454fc3c85b00cc3d/docs/transfer/pc-reading-return-12/independent-fix2/FINAL_RESULT.json)와 [전체 공유 묶음](https://github.com/tlsee0813-cmd/agentflow-studio/tree/398a91adf918113bd77dfbd3454fc3c85b00cc3d/docs/transfer/pc-reading-return-12/independent-fix2): 170파일·6,575,464B·대표 PNG4장. FINAL_MANIFEST SHA256 `2d01fa5a0c6c55536f2b6f37ada0d70af014ea1ee5481fc7d5aa613fc9d98cec`. 초기 REPORT/LATEST/MANIFEST는 당시 기록이며 FINAL_RESULT/FINAL_MANIFEST와 정정문을 우선 읽는다.
- [최종 두 OS CI 감사와 작은 원시 발췌](https://github.com/tlsee0813-cmd/agentflow-studio/blob/15299701c7e5079242c6146908459a256a29ffc3/docs/transfer/pc-reading-return-12/ci-final/AUDIT.md): 8파일·21,294B, Manifest SHA256 `bb0754463f071ecda575967603543f5d7423b77507c55f886f5648e26c93e1f2`. 전체 CI artifact 전수 감사는 아니다.
- [작성자 fix2](https://github.com/tlsee0813-cmd/agentflow-studio/tree/0d6061c511ea42057c329d5a216bb7fa30b49076/docs/transfer/pc-reading-return-12/author-fix2): 38파일·925,398B. [v0 감사](AUTHOR_AUDIT.md)의 초기 Node수 정정(145개 중139통과/6실패, 보완 후210/210)을 유지한다.
- [재현 가능한 정적 체험 파일과 실행 안내](https://github.com/tlsee0813-cmd/agentflow-studio/blob/398a91adf918113bd77dfbd3454fc3c85b00cc3d/docs/transfer/pc-reading-return-12/independent-fix2/preview/START.md). 합성 소개·알림 사례이며 실제 프로젝트 실행 기록이나 실제 AI가 아니다. GitHub만으로 회수 가능하며 로컬 ZIP에 의존하지 않는다.

읽는 중 삭제·보관은 실제 접근 가능한 UI가 없어 정적 확인/미실행이다. 새 프로젝트 전환·재로드는 실제로 확인했지만, 다른 프로젝트의 오래된 origin을 강제로 호출하는 검사는 하지 않았다. 390은 최소 접근·닫기·focus·overflow뿐이고 PC 전체 흐름을 모바일에 확대하지 않는다. 사람의 읽기 부담·큰 지도·층위 전체 경험·자동 기록 변환·실제 AI 품질·외부 작업 실행은 미입증이다. GUIDE107 HOLD는 유지한다.

## 다음에 개선할 한 가지

제품에서 읽고 편집하고 돌아오는 연결은 만들었다. 다음은 **PC 첫 화면에서 공간 지도가 충분히 보이고, 중요한 변화와 개입할 부분을 짧게 이해하는 경험**이다. 현재 큰 상단 설명·상태·보고 영역이 지도 공간을 차지한다. 상세 설명을 더 붙이거나 새 연구 시안을 늘리는 대신, 지금 제품의 공간 배분을 실제 PC 화면에서 비교한다.

Dify 등 기존 조사에서 참고할 수 있는 기제와 실제 조작 결과를 구분하고, 지도/보조 패널의 배치와 점진적 상세 공개에 필요한 좁은 추가 비교만 맡긴다. 최종 목표인 여러 층위·관계·변경의 이해를 유지하되, 이번 단계의 평면 저장 구조를 최종 확정으로 취급하지 않는다.
