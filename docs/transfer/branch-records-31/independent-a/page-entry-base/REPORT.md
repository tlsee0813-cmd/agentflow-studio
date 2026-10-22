# P 기록 신호 진입의 page 이동 — 정확7c7 원본 반례

제품 `7c7bdfa8d244d83c2c776b91b6a3a669127ba2e9`, app `da2502c6a011578c77931a10f41a7fcd09f182ae3b8b186b26f640966b747c2b`. 기존 통합 검증의 동일 빌드/정상 UI 자료를 사용하고 소스 변경 0을 재검증했습니다. 새 설치·제품 수정·CI 조회는 없습니다. SOURCE_BINDING에 동결 checker/collector/fixture 해시가 있습니다.

이전463fa의 흐름1을 정상 UI로 재현한 뒤 일반 전체공간 진입→패널 닫기로 준비했습니다. 두 실제 부모 P/D가 있고 P의 기록을 사용했습니다. **테스트 직전 패널은 닫혀 있으며 같은 P의 긴 기록/펼침 메모는 남아 있습니다.** 닫기가 정상 info 버튼으로 초점을 돌린 것을 확인했습니다. 준비의 fit은 최초 baseline 전뿐이며 이후 native wheel로 pageY120을 만들었습니다. P 버튼은 별도 reach/fit/보정 없이 이미 full ancestor clip·중앙 hit·visible 양성인 상태에서 normal click했습니다.

| PC | 클릭 직전 XY | 같은 trusted click task 첫 XY | 다음 두 rAF | 관측 기한 종료 XY |
|---|---|---|---|---|
| 1280×720 | 0,120 | 0,116 | 0,116 / 0,116 | 0,116 |
| 1440×900 | 0,120 | 0,0 | 0,0 / 0,0 | 0,0 |

첫 pageXY 불변 단언 및 후속 위치 불변 단언은 양PC 모두 FAIL입니다. 최종 checker/실제 외부 collector **exit1/1**. 두 PC는 모두 완주했으며 fatal/pageerror/cleanup 오류0입니다. 관측된 문서 maxScroll은 1280 262→378,1440 262→262로 최종120 이동 여유가 있습니다. 이것만으로 중간 크기 변경이나 scroll 원인을 확정하지 않습니다. map/panel/disclosure/document/raw focus/transform/소유자/이벤트 순서는 ui.jsonl.gz에 보존했습니다.

정확 P 기록 열림과 실제 첫 소유자 두 글줄의 Range/fullclip/hit는 양PC 양성입니다. 신호 진입은 의도대로 선택을 P로 바꿉니다. 카메라 computed matrix·가지 접힘·전체 project(current B/미전송 Q 포함)는 그대로입니다. 글줄/owner 성공과 page 이동 실패를 합쳐 통과로 처리하지 않았습니다.

첫 수집은 panel scrollend를 문서 완료와 구분하지 않았고 선택 불변 단언도 의도된 P 선택을 오판했습니다. 해당 코드/로그/결과/exit1을 first-measurement-boundary에 보존했습니다. 최종 동결 checker는 문서/패널 scrollend를 구분하고 선택은 정확 P인지 확인합니다. page 불변의 원 의미 단언은 유지했습니다. 동일 최종 checker를 후속 후보에서 source/output 환경 선택만 바꾸어 재사용할 수 있습니다.

최종 수집에서는 **문서 scroll 이벤트는 발생했지만 문서 scrollend는5초 관측 기한 안에 없었습니다**. area-panel-body의 trusted scrollend만 있었습니다. 따라서 기한 종료값을 문서 scrollend 뒤 값으로 부르지 않습니다. 타이머는 이벤트 누락을 표시하는 관측 종료 deadline이며 sleep/레이아웃 수리가 아닙니다. 원인(예: focus/anchoring/render 호출)을 preventScroll 소스나 이 DOM 관측만으로 확정하지 않습니다.

실제 HTTP body↔실행 dist↔종료후 dist SHA, 동적 Node/PW/Chromium154 및 별도 서버 종료(-15)는 runtime/Source 기록에 있습니다. child와 collector 실제 종료는 process/OUTER_EXIT_RECEIPT를 구분했습니다. 대표 원 PNG2장, 정상 UI 준비 입력과 실제 H 기반 합성 파일, 첫 실패와 최종 raw를 보존합니다. 큰 JSON/JSONL은 RAW_INDEX의 원hash와 무손실 gzip 재해제 동등을 확인했습니다. MANIFEST는 자신을 제외한 payload 정확집합입니다.

제품18/29/30/31 전체 행렬이나 사람 사용성·실제AI는 실행하지 않았습니다. 기존 통합증거 및 타 prefix는 변경하지 않습니다.
