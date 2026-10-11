# 현재 제품의 소스 지도와 조사 적용 경계

## 고정한 기준

`tlsee0813-cmd/agentflow-studio` / `init-003/fix-review-regressions` / `6666c6bd35a1a01419d3a082b6dfc776ce3db717`을 읽었다. 이것은 사용자 지정 문서 스냅샷이며, 다른 세션의 미반영 작업까지 포함한 ‘실시간 최신 전체 코드’라는 주장이 아니다. 고객 앱 경로는 `app/continuity`다. 별도 INIT 앱이나 main 브랜치가 아니다. [P01][P02]

상태 문서는 IDEA017 유지, 018/019 미채택을 명시한다. START_HERE와 고객 README/HTML에는 더 이른 IDEA015 표시가 남아 있다. **문서 제목의 숫자·소스 반영 사실·실험 채택 여부가 일치한다고 가정하면 안 된다.** 이번 조사에서는 상태 문서를 채택 판단에, 코드 원문을 기능 판단에 사용했다. 과거 018/019 실행 결과는 P02의 요약만 읽었으며 Cloud 로그를 직접 감사하지 않았다. [P01][P02][P03][P06]

사용자 보충 지시는 큰 그래프/자동 모델 조절을 이미 확정된 다음 기능으로 다루지 말라는 뜻으로 반영했다. 초기 MASTER_SPEC의 넓은 방향을 삭제하거나 재승인하지 않고, 이 조사의 작은 적용 범위를 현재 고객 앱에 한정했다.

## 파일 → 책임 → 지금 활용할 접점

| 파일/범위 | 실제 읽은 책임 | 조사 결과를 적용할 접점 | 건드리지 않을 경계 |
|---|---|---|---|
| `public/index.html`, `src/client/app.ts` | 입력, 작업 표시, 상세 열기, 복사/파일 대안, 보고와 이력, 저장 상태 | 현재 행동의 시각적 우선순위, 현 작업 근거, 실패 뒤 재개 | UI001이 도메인·AI 계약을 임의 변경하지 않음 |
| `src/shared/types.ts` | Source/Basis/Task/Advice/ExportRecord/요청 ticket의 서로 다른 의미 | 요구·인계·보고·관측을 섞지 않는 표시 계약 | 새 거대 상태 enum을 UI가 먼저 고정하지 않음 |
| `src/shared/domain.ts` | `currentWork`, `buildRequest`, `taskStatus`, `handoffText`, `markHandoff`, 기준 수정과 버전 검사 | 안정 ID·수동 필드·낡은 조언 배제와 현재 인계의 연결 | IDEA020과 중복한 상태 구현/프롬프트 재작성 금지 |
| `src/shared/storage.ts` | `ProjectStore` 비교 후 저장, legacy 백업, 손상·충돌 처리 | 복구 화면과 데이터 손실 방지 안내 | 구조화 저장을 Markdown 원본으로 대체하지 않음 |
| `src/server/` | 경로 존재/README의 Node 경계만 확인; 이번에 서버 내부 완독 안 함 | 향후 CONNECT001이 승인받은 어댑터를 붙일 경계 후보 | 현재 연결이 이미 구현됐다고 하지 않음 |

행별 근거: [P04][P05][P06][P07][P08]. 현재 앱은 native DOM TypeScript + Node HTTP 구조이며 React 앱으로 재해석하지 않았다. 고객 앱 README는 외부 패키지를 TypeScript로 제한한 상태를 설명한다. 외부 라이브러리의 Node engines가 맞는다는 것만으로 현재 브라우저 모듈 로딩·타입 검사·빌드가 맞는 것은 아니다. [P03]

## 이미 있으므로 다시 만들면 안 되는 것

수동 수정 보존, revision 기반 늦은 응답 배제, 낡은 AI 문구 제외, 기준의 출처·수정 이력, 인계 내용 스냅샷, 보고/증거 미검증 표시, JSON 백업과 가져오기 실패 보호가 코드에 있다. 단순히 ‘출처/상태 관리가 전혀 없다’는 전제는 틀리다. 문제는 이 구분이 사용자의 결정 순간에 충분히 드러나는지와, 앱 밖 관측이 아직 없는 상황을 어떻게 정확히 말할지다. [P04][P05][P07][P08]

`markHandoff`의 복사/파일 기록은 실행 영수증이 아니다. `taskStatus`도 인계 후 외부 실행을 확정하지 않는다. 반환 보고는 최신 인계 등 제한된 기존 연결 맥락에 묶이므로, 여러 외부 세션이 동시에 돌아오는 경우까지 완성된 다중 작업 조정기로 취급하지 않는다. [P03][P05]

`ProjectStore`의 저장 전 문자열 비교는 다른 탭 변경을 탐지하려는 보호다. 비교와 `setItem`을 합친 원자적 compare-and-swap이나 CRDT 병합은 아니다. ‘협업 충돌 해결이 이미 끝났다’고 홍보할 근거가 없다. [P08]

## 이 조사에서 새로 확인하지 않은 것

앱 단위/HTTP/브라우저 테스트, DeepSeek 실제 응답 품질, 비용 절감, CLI 설치·인증·운영 보안, 실제 고객 사용성은 실행하지 않았다. 기존 상태 문서에 기록된 검사 결과는 과거 기록이다. UI001·CONNECT001·IDEA020의 미회수 결과를 읽었다고 하지 않으며, 해당 세션/브랜치에 쓰지 않았다. 제품을 출시 가능으로 승격하는 자료가 아니다.


---
출처 링크(열람 범위·한계는 `01_SOURCE_MAP.md` 참조)

[P01]: https://github.com/tlsee0813-cmd/agentflow-studio/blob/6666c6bd35a1a01419d3a082b6dfc776ce3db717/docs/START_HERE.md
[P02]: https://github.com/tlsee0813-cmd/agentflow-studio/blob/6666c6bd35a1a01419d3a082b6dfc776ce3db717/docs/PROJECT_STATUS.md
[P03]: https://github.com/tlsee0813-cmd/agentflow-studio/blob/6666c6bd35a1a01419d3a082b6dfc776ce3db717/app/continuity/README.md
[P04]: https://github.com/tlsee0813-cmd/agentflow-studio/blob/6666c6bd35a1a01419d3a082b6dfc776ce3db717/app/continuity/src/shared/types.ts
[P05]: https://github.com/tlsee0813-cmd/agentflow-studio/blob/6666c6bd35a1a01419d3a082b6dfc776ce3db717/app/continuity/src/shared/domain.ts
[P06]: https://github.com/tlsee0813-cmd/agentflow-studio/blob/6666c6bd35a1a01419d3a082b6dfc776ce3db717/app/continuity/public/index.html
[P07]: https://github.com/tlsee0813-cmd/agentflow-studio/blob/6666c6bd35a1a01419d3a082b6dfc776ce3db717/app/continuity/src/client/app.ts
[P08]: https://github.com/tlsee0813-cmd/agentflow-studio/blob/6666c6bd35a1a01419d3a082b6dfc776ce3db717/app/continuity/src/shared/storage.ts
