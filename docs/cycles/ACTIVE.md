# AgentFlow 활성 연구·검증 배정

2026-10-15 · 단일 총괄: 현재 Codex 대화 · 사이클 2026-10-15-mixed-depth-01 · Q03·Q04

첫 연구 판단과 UI-02 연구 시안의 수정·회수를 완료했다. 전체의 부분별 펼침을 기본 후보로 두고 집중은 읽기 공간을 구별하는 다음 비교안으로 좁혔다. 최종 UI 선택이나 Dify 수준 달성 판정이 아니다. 다음 구현 UI-03은 범위 정리 완료·미배정이다. 별도 클라우드 브라우저 재검증은 사용자가 환경을 확인 중이다.

## 기준과 최신 사용자 지시

- 시작 문서 SHA 73fc284026f2f5140e9c972a496c77ca0931eabf. 제품 소스 618d9bd2b99ad433df35107d8902b15f45e30000. 공개 배포 63f5540d062861439f0932cd7311c6c5510e227c.
- 통합 대상 checkpoint/2026-10-15. 시작 시 branch 3개/open PR 0개와 push 권한 확인. main은 최신 제품이 아니다. GUIDE107은 HOLD 유지.
- 사용자는 여러 Pro·Opus·클라우드 세션과 작은 병렬 배정을 허용했다. 총괄은 세부 조사·구현을 독점하지 않고 배정·근거 평가·판단·통합을 맡는다.
- Dify는 UI 디테일의 주요 비교 대상이다. 목적·실행 노드 체계를 복사하지 않고 계층·다른 깊이·변경·인계에 맞춘 반복 연구를 이어간다.
- 최신 사용자 지시: 클라우드/브라우저 환경 문제는 별도 서브에이전트가 해결하고 총괄은 메인 프로젝트에 집중한다. 해결되지 않으면 정확한 막힘과 필요한 사용자 조치를 보고한다.
- 실제 웹 모델 표시: Pro, Claude Opus 5.5 높음. 클라우드 모델명은 별도 확인하지 못했다. 인계 문서의 총괄 모델명은 현재 실행 모델의 증거가 아니다.

## 배정과 회수

| 담당·실제 세션 | 범위·산출물 | 상태·다음 행동 |
|---|---|---|
| 총괄 현재 대화 | INPUT·RESEARCH·RESULT·ACTIVE | 근거 평가·선택·단독 checkpoint 반영 |
| [Pro 탐색 조사](https://chatgpt.com/c/6ad0c892-93c4-83e8-98a8-e1a1e1750525) | 4사례·Dify 3파일·UI-03 집중 읽기 대안 | 회수·판단 완료, 실행 작업 없음 |
| [Pro 변경 표시](https://chatgpt.com/c/6ad0ca77-f02c-83e8-ac1e-316a3ed8e47b) | 열람/새 반영 분리 | 회수·원문 대조 완료. 의무 확인 클릭 정책 미채택 |
| [Pro 인계 기준](https://chatgpt.com/c/6ad0ca8d-2cb0-83ec-97b8-0774874bbe4d) | 고정 버전과 읽음 보장 차이 | 회수·독립 원문 대조 완료 |
| [Pro Blender/yEd](https://chatgpt.com/c/6ad0cd45-3d04-83ee-9728-260039420b2d) | 펼침·부분 진입·복귀만 | 회수. yEd 원문 독립 대조, Blender 구버전 검색본문은 보조 참고로 제한 |
| [Claude Opus](https://claude.ai/chat/6253f2e8-4c9a-4ae6-81e1-76250803bd93) | prototype.html; canvas-study.html·작성자 실행 근거 | 의미 fix3·UI02 fix1 회수 완료. 작성자 Chromium 화면 증거 포함. 실행 작업 없음 |
| [Work 클라우드 검증](https://chatgpt.com/c/6ad0cd0a-84a4-83ee-990a-d049b6cc234e) | 정확 SHA의 독립 실행·화면 증거 | 원본5323 상태검사 회수. 브라우저 경로 확보 실패, 사용자 환경 조치 요청 |
| 내부 /root/input_scope | 입력·OSS·근거·환경·작성자 증거 패키지 | 완료. 사용자가 환경 확인 후 알려주겠다고 응답함 |
| 내부 /root/acceptance_review | 독립 코드·상태 검토·재현 패키지 | 의미 fix3 4통과, UI02 fix1 5통과. 각각의 버전별 결과, 독립 브라우저 재실행 없음 |
| 내부 /root/hierarchy_review | 계층 원문·UI 평가 기준·정적 화면 검토 | 완료. 초도 캡처 7장 검토, 집중 읽기/전체 현재 설명 개선 제안 |

작업자는 원격 쓰기·다른 세션 배정 권한이 없다. 세션 주소는 현재 관측한 실제 주소이며 타 환경 재접속을 보장하지 않는다. agentflow-studio-dev가 설정 화면에 있는 것과 실행 작업에서 연결되는 것은 별개다. 클라우드 작업에서는 연결 도구가 없었다.

## 산출물·다음 경계

[입력](2026-10-15-mixed-depth-01/INPUT.md), [관측 범위](2026-10-15-mixed-depth-01/INPUT_SCOPE.md), [탐색 판단](2026-10-15-mixed-depth-01/RESEARCH.md), [UI 연구](2026-10-15-mixed-depth-01/UI_RESEARCH.md), [OSS](2026-10-15-mixed-depth-01/UI_OSS.md), [근거 확인](2026-10-15-mixed-depth-01/EVIDENCE_CROSSCHECK.md), [결과·제한](2026-10-15-mixed-depth-01/RESULT.md).

현재 시안은 [UI02_RESULT](2026-10-15-mixed-depth-01/UI02_RESULT.md), 다음 한 구현은 [UI03_RESEARCH](2026-10-15-mixed-depth-01/UI03_RESEARCH.md)에 기록했다. 환경이 제공되면 정확한 저장소 SHA와 HTML 해시를 지정해 독립 브라우저 재검증부터 배정한다. 기존 작업자들은 결과 회수 완료 상태이므로 실행 중으로 오인하지 않는다. main/gh-pages 배포, 전체 수집기·DB·연결기, 과거 HOLD 통합, 유료 API·예약 생성은 배정하지 않았다.

