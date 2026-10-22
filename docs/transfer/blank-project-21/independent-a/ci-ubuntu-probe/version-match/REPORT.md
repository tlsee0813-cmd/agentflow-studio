# 21 계측 없는 재현 / 143 버전 비교 한계

정확 f7b25 / 원212163 검사를 계측 없이 system Chromium154.0.8037.57에서 한 번 실행했다. PW1.57.0 / Node22.16.0 / 기존 실제 loopback MOCK 환경을 재사용했다. 제품·원검사·기대값·CSS·DOM scroll/storage를 수정하지 않았다. 별도 sleep/안정대기/관측 래퍼를 붙이지 않았다. 두 원메서드를 끝까지 개별 실행했고 둘 모두 같은 line111→toggle.reach→visible→to_be_in_viewport의 ratio0 실패, child=1 / 실제 외부collector=1이다. Shift+Tab summary focus는 통과했으며 Enter 접기 전 실패다. 최종 실패 PNG2와 원 stdout/stderr/JSONL을 보존했다.

바로 앞 원 PROBE는 양PC summary top4.125/bottom47.921875, inside=true/hit=true를 기록했다. 이 PROBE의 'full clipping'이라는 라벨은 실제 모든 clipping 조상을 계산한다는 뜻이 아니다. 이전 e5ea1fb의 읽기 전용 관측 래퍼에서는 같은154 원단언이2통과였으나 이번 계측 없는 실행은2실패다. 따라서 143에만 있는 문제라는 가설은 성립하지 않는다. 관측에 따른 시간 영향 가능성이 드러났지만 반복성·정확원인·제품 대 검사 귀책은 미확정이다. 앞선 성공이나 이번 실패를 서로 삭제하지 않는다.

기본 bundled chromium-1200 캐시 실행파일과 .links가 없었다. 보존 로그에서 같은 다운로드 차단 기록을 찾지 못해, 사용자 허용에 따라 별도 bundled-cache로 공식 `python -m playwright install --only-shell chromium` CLI를 딱 한 번 호출했다. 시스템154/PWvenv를 덮어쓰지 않았다. CLI 내부5회 fallback은 원로그 그대로이며 수동 재시도는 하지 않았다. cdn.playwright.dev와 playwright.download.prss.microsoft.com이 모두 HTTP403 'Domain forbidden'으로 차단됐다. 기대143.0.7499.4/build1200은 다운로드 대상 버전이며 실제 실행 버전이 아니다. 143 실행 및 실패시 관측래퍼 비교는 NOT_RUN이다. 우회·네트워크/보안설정 변경 없음.

기존 제품·helper 파일은 pinned 원격 바이트와 실행 후에도 동일하다. 새 HTTP body 캡처는 이 원검사에 추가하지 않았고 직전 동일 런타임의22 HTTP바인딩과 구분한다. 전체7종 회귀·새환경/의존성설치·실제AI는 미실행. MANIFEST.tsv는 자기 자신 제외 정확 payload 집합이다. 미해결 CI 원본은 58ce753708e2afd5abc6130fb22397bb43e483a3/docs/transfer/blank-project-21/ci-f7b25에서 총괄이 보존 중이다.
