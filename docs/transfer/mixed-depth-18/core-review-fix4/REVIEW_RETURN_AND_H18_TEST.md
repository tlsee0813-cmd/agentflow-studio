# PC13 복귀 수정·H18 검사 정정 — 독립 정적 검토

2026-10-22. 제품을 수정하거나 서버·브라우저·검사를 실행하지 않았다. 아래 파일을 직접 읽고 SHA256을 확인했다.

- app.ts: `b5a6fde628584d85097840b61ebf918f2e609ff08b060bc540f72a4ef2695c4a`
- hierarchy18_browser.py: `1b7890adc9dc1b7c7c674398bdc6f5c1679c191e37505c716ac7380c13d31d2f`

## Cloud 관측값 정정과 원인 추론의 구분

직접 읽은 고정 [Cloud REPORT](https://github.com/tlsee0813-cmd/agentflow-studio/blob/ebcd3947032000bdce086469f695ec884a71db06/docs/transfer/mixed-depth-18/independent-fix3/REPORT.md)는 제품 9fb311의 동일 RB-A 호출 전후를 다음과 같이 기록한다.

| 항목 | 출발 | 복귀 |
|---|---|---|
| 패널 본문 top / height | 601.703125 / 228.296875 | 동일 |
| scroll / max | 128 / 218 | 70 / 300 |
| 호출행 Y | 789.3125–825.3125 | 847.3125–883.3125 |
| 3점 hit | true | false, panel-open이 가림 |

footer는 y830–883. 같은 호출 ID·초점·matrix와 카드 좌표는 유지됐다. **관측된 동일 쌍의 최종 본문 높이는 바뀌지 않았다.** 앞선 진행 메시지의 R-edit와 RB-A 단계 높이 비교를 동일 호출 before/after 원인으로 해석한 설명은 철회한다. 실제 실패는 scroll이 128에서 70으로 돌아가 호출행이 58px 아래로 밀리고 footer에 가려진 것이다.

중간 render에서 records가 닫힌 상태의 작은 scroll 한계로 먼저 clamp된 뒤, 원래 disclosure가 복원되면서 최종 크기가 결정된다는 설명은 **소스 순서에 근거한 정적 원인 추론**이다. 위 최종 before/after 값만으로 중간 max70을 직접 관측했다고 주장하지 않는다. 이번 수정은 그 순서상의 문제를 해결한다. 수정 후 실제 hit/좌표 성공은 아직 이 검토에서 확인하지 않았다.

## B5A6 복귀 수정

app.ts:361은 o.panels의 독립 복사를 확보한다. :366의 render(false,false)는 중간 DOM의 읽기 위치 캡처와 조기 읽기 복원을 모두 건너뛴다. :368에서 원래 disclosures, :369/:373에서 페이지 위치와 외부 페이지 anchor를 복원한 다음 :374에서 최종 sizeWorkspace → 원래 panels 복사 재설정 → restorePanelReading → rememberMap을 수행한다.

restorePanelReading(:96–101)은 최종 높이에서 숫자 위치를 적용하고 살아 있는 실제 호출 anchor의 상대 offset을 다시 맞춘다. :376의 초점 복귀는 그 뒤 preventScroll로 실행된다. Origin 객체에는 변경 가능한 참조가 공유되지 않는다. 함수 중 await/비동기 경계가 없으며 queued toggle/scroll handlers는 함수가 끝난 뒤 현재 DOM을 읽는다. 외부 toggle의 sizeWorkspace는 이미 적용된 disclosure 상태를 다시 측정한다.

render(:2164/:2190)의 두 번째 인수 기본값은 true이며 false 호출은 이 복귀 경로 한 곳이다. 일반 렌더의 읽기 복원은 유지된다. 기존 카메라를 강제 fit하는 변경도 없다. 요청된 범위에서 추가 actionable 결함은 찾지 못했다. 이 결론은 정적 검토이며 실제 동일 호출 복귀의 합격은 Cloud 재실행으로 확인해야 한다.

## H18 test-only 정정

hierarchy18_browser.py:243–269를 읽었다. :249는 최초 nav-context 직후 work-view와 context의 실제 가시성을 확인한다. :250은 지도 복귀 후 work-view가 숨고 지도가 보이는 것을 확인한다. :251–253의 retained 검사는 context의 자체 hidden=false와 nav-context aria-expanded=true를 구별해 읽는다. 지도에서 컨텍스트가 물리적으로 보인다고 요구하지 않는다.

:258/:261/:262는 일반 입력 Escape·명시 합성 isComposing·명시 합성 defaultPrevented 뒤 실제 name/body 초점, 미저장 이름/구상, 저장된 Areas 불변, retained 상태와 연결 팝업을 확인한다. :264–269의 일반 Escape 순서는 패널 → 연결 팝업 → 컨텍스트이며 마지막에는 자체 hidden=true와 aria-expanded=false를 검사한다. 지도에서 항상 숨는 컨텍스트의 to_be_hidden만으로 성공 처리하지 않는다.

원래 closeContext 오류는 자체 hidden/aria를 바꾸고 초점을 빼앗으므로 수정된 단언은 원반례를 계속 검출한다. nav-work는 컨텍스트를 명시적으로 닫는 기존 정책이므로 보존 상태의 실제 가시성 재검증 경로로 사용하지 않는다. 새 이동 경로나 제품 동작 변경이 필요하지 않다. 이 test-only 정정에서 추가 문제를 찾지 못했으며 실제 실행 통과·실제 OS IME 검증으로 확대하지 않는다.
