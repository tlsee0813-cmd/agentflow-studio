# Cycle27 v0 좁은 재현
제품 5dcf269bd7f25dec3f6432fb3386adb23c89d526, 1280×720 한 흐름. 정상 UI로 A/B·수동4값·실제 H 기반 명시 합성 외부 설명 준비 후 A 작업 읽기에서 편집 열기→취소.
취소 직후 details.open=true와 실제 textarea 노출을 확인했다. 남은 편집 저장은 inline stale 경고로 거절됐다. 접기/명시 재열기 후에도 앞 경고는 남았다. 프로젝트 저장값·current·A·기존 이력은 전후 동일. 기대 제품 FAIL로 child1/외부collector1, fatal/pageerror/cleanup0. 실행환경 Chromium154/PW1.57, 실제 loopback HTTP/disk hash는 runtime.json.
최초 앱 하위 빌드 누락과 숨은 textbox role/불필요 parent disclosure 검사 준비 오류는 각각 원본 보존. 이들은 제품 실패 수와 합산하지 않는다. 정상 실행 ui.jsonl.gz는 이전 준비 실패 로그도 append되어 UTC/단계로 구별; 정확 최종관측은 result.json.
소스는 pinned git bytes 확인, 제품 수정 없음. 서버 명시 종료 -15는 검사 exit와 별개. 전체27 통과/사람이해/실제 AI 검증 아님. PNG는 원본.
