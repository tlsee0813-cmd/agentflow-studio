# 21 Ubuntu CI 실패 좁은 계측

22 관측 공유(0db83d03) 뒤 실행했다. 정확 f7b25 제품·212163B1F4B7B6E328BC194676656EAED570A65179C6670DC6274E74D10A3117 검사 파일은 원문 그대로다. 별도 probe.py가 같은 두 원메서드의 키/reach/visible/wheel 주변에 읽기 전용 계측을 붙였다. 원래 assertion·PROBE·Enter 순서·제품/DOM scroll/style/storage를 수정하지 않았다. 임의 sleep/안정대기 추가 없음. 관측 자체의 시간 영향은 배제하지 않는다.

실제 결과: 1280×720/1440×900 원메서드 2개 통과, child=0, 외부 collector 실제 종료=0. 기존 Ubuntu CI 양PC ratio0 실패를 이번 Cloud에서는 재현하지 못했다. CI 실패를 지우거나 해결로 선언하지 않는다. CI 설치본 Chromium143.0.7499.4와 Cloud 실제 browser.version154.0.8037.57은 다르며 같은환경 재현이라고 쓰지 않는다. PW는1.57.0. CI actual browser.version artifact는 회수되지 않았다는 총괄 정보를 그대로 구분한다.

같은 summary identity2가 End/ShiftTab/reach 전후 유지됐다. 1280 ShiftTab 직후 windowY286 / summary y338.125였으나 reach 직전 Y1190 / y−565.875로 이동했다(추가 계측 시 Y1262도 관측). 원 helper의 실제 native wheel −220,−220,−203이 발생하여 Y620 / y4.125로 돌아왔고 원 expect가 통과했다. 1440은 ShiftTab 직후 Y587 / y37.125, reach 전 Y1419 / y−794.875; wheel −220,−220,−220,−139 뒤 Y620 / y4.125에서 통과했다. 즉 focus가 돌아온 순간과 후속 geometry가 같지 않았다. 무엇이 후속 스크롤을 일으켰는지 이 자료만으로 제품/브라우저/검사 원인을 확정하지 않는다.

실제 IntersectionObserver는 entry.time/observedAt/bounding/intersection/rootBounds/ratio와 같은 DOM identity를 기록했다. 1440은 ShiftTab 뒤 ratio1→reach 이전0→wheel 뒤1, 1280도 End후0→wheel 뒤1이 남는다. 원 PROBE는 가장 가까운 세로 스크롤 host border+중앙 hit이므로 ‘full clipping’ 라벨을 모든 축/조상 보장으로 해석하지 않는다. 별도 geometry는 자기/모든 조상의 client clip/overflow 축/transform 비율과 중앙 hit을 구분했다. 전체 글자 잉크 가독성/사람 이해 평가는 아니다.

해당 failure는 Enter 전에 발생하는 CI 장면이다. 이 실행은 failure 이전과 같은 원경로를 통과했고 원래 후속 receipt까지 완료했다. scene-summary.json은 표적 구간, diagnostics.jsonl은 원시 events/IO이며 timing/rAF 대기 보완으로 성공시킨 검사가 아니다. 새 전체7종 회귀/설치/제품 수정은 미실행. 이번 observer는 HTTP body를 새로 훅하지 않았으므로 직전22의 동일 runtime HTTP 바인딩을 참조하고 새 캡처로 주장하지 않는다. MANIFEST는 자기 자신 제외 정확 payload 집합이다.
