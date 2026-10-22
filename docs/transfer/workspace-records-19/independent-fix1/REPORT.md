# Cycle19 fix1 독립 실행

고정 제품 **acfafd2dd6426e3fa6fa5443bd2e67d8461608c9**. 실행 중 제품/작성자검사 수정·새 설치·배포 없음. `SOURCE_BINDING.json`의 실제 원격 object↔disk app **C3A8E77A…**, CSS **F97FED78…**, HTML **190C02C6…**, W19 **E1FCE56C…**는 전달값과 정확히 일치. 원본 app/필수fixture 소스 전체 before/after 불변. Node22.16/TS5.8.3/Playwright1.57/Chromium154.0.8037.57 기존 환경. PATH compiler 재사용이며 npm-ci 아님.

## 결과

- **높이 결함 개선 확인**: 정상 이름 입력으로 안내 제거 직후1280 지도411.515625→479.109375,1440은591.515625→659.109375. 다음 records render 전에도 이미 올바른 높이이며 native 대기 표본에서 유지된다. 같은 v2 검사를 구제품81d의 별도 사본에 적용하면6실행 중 test01만 양PC 실패/exit1이고, test03은 양PC 통과. 새 제품 exact W19는6/6,child0/외부collector0. 두 제품 사이에 테스트 기대값을 바꾸지 않았다. W19 v1→v2의 test_01/02/03 source segment가 정확 동일함을 AST로 확인했다(준비 helper만 변경).
- **관련 exact 회귀**: check/build/continuity check/build/domain261/261/static-build 각0. PC12 15,PC13 14,HOME15 21,REPORT16 13,AREA17 12,H18 12 각각 child0. 전체 author collector도 실제0. 작성자 suite 실행을 독립 장면수로 합산하지 않는다.
- **원 독립 core4**: PowerToys/product13 재서술2입력×양PC. 1→5/8기록의 지도 높이, native zoom/fit/pan, 기록 native wheel/key→정확 보고/소유부분→관계 실제끝점→정확한 새request count/id/area/body→실제clipboard/다운로드→FIRST records caller복귀와새작업/미저장구상 보존, pre/post raw 카드/path/computedmatrix/focus/scroll을 같은 logic으로 확인(child0).
- **독립 경계4**: missing-row fixedhead/원문보존/실제 branch-toggle 뒤 안내 유지, 살아있는 R1 excursion에서 unrelated B info/명시nav/records재열기 세 reset 경로와 Abuffer격리(child0). **390 최소2입력**, **같은프로젝트 records 목록읽기 왕복2PC**, **layout phase2PC**도 각각 child0.
- **목적창 보완과 첫 실패 구분**: 최초 독립 batch는 wide Home목적창 닫기 직후 focus 즉시읽기1건 때문에 실제 collector1이다. 실패 직후 raw에는 이미 정상 more focus가 남아 있었다. 첫 코드/raw/log를 `first-purpose-home-close-timing/`에 그대로 보존. 별도 `purpose-event-ready.py`는 정상 click 뒤 앱 handler 다음의 native close 이벤트만 관측하고 같은 focus 단언을 유지해 양PC2실행/child0·외부tool관측0. 원본6프로그램 batch를 통과로 덮거나 모든 프로그램을 다시 실행했다고 쓰지 않는다. records+native scroll>0에서 목적 전문 tail Range/clip/hit, close/Escape 후 mode/selected/body scroll/행rect/caller/저장/미저장구상, management backup/import, Homefullread도 이 전용 경로에 포함됐다. 한 부분의 가독성은 Range/clip/hit 표본 관측이며 사람 이해/전체잉크 평가가 아니다.

## 실제 scroll clamp

`status-scroll-diagnostic` 양PC에서 이름 초점 유지 후 실제 pagewheel0→300, 이어 실제 이름 입력을 실행했다. 브라우저가 input capture 전에 pageY를56으로 옮겼다(capture와bubble 모두56): 이를 앱의 갑작스런 scroll로 오인하지 않는다. 앱 handler 뒤 notice제거/height 재계산으로 recordsTop/max는1280 **758→635**,1440 **578→455**로 실제 새max에 clamp됐다. viewport/page/card raw와 computedmatrix, 선택, native event timestamps 및 저장 전후 전체 상태를 보존했다. world/layout·sources/tasks/current/draft는 불변. 출발복귀를 시험한 장면은 아니며 이 확대 여유에서의 자연스런 extent clamp를 origin row 보존 성공으로 확대하지 않는다.

## HOME15 CI 불일치 — 미해결

CI81d Ubuntu39790388931/job119865109890의 narrow test08 **272≠120** 실패는 그대로 미해결이다. 이 Cloud exact81d 원본 narrow 재현2회와 별도 읽기전용 event관측 narrow/wide는0. narrow에서 y0→메뉴→read-open pointerdown/click→dialog→PageDown/End/Home/wheel→닫기는 전부120,wide는92. 새acf HOME15 전체21개도0지만 CI 실패를 취소하지 않는다. 원본/이벤트 raw는 [v0 c140a628](https://github.com/tlsee0813-cmd/agentflow-studio/tree/c140a62822f53bab16a8bd94d146efaec90e897a/docs/transfer/workspace-records-19/independent-v0/home15-ci-discrepancy)에 있다. 원인을 확정하지 않았으며 실제 CI 환경과 관측의 영향 가능성을 남긴다.

## 실행과 증거 경계

모든 새 실행은 실제 localhost HTTP/Chromium,격리 합성 fixture/MOCK이다. core 최초 page.goto200의실제body와실행disk전후SHA 및 compiled runtime16개 실제HTTP binding을 연결했다. paid provider0. core console/pageerror raw와 각 독립 teardown(pageerror/외부요청guard)을 보존한다. 전 suite의 미관측console을0으로 발명하지 않는다.

정적 공개domain API로 만든 원18 재서술fixture를 그대로 UI import했으며 추가보고는 합성 표식이 있다. author 회귀의 기존 테스트fixture설치는 사용자조작과 구분한다. 독립은 hidden state/API·forceclick·DOMscroll주입·복귀뒤보정 없이 normal click/key/wheel과 native drag만 사용. composing/consumed 이벤트는 합성이고 실제 OS IME는 미실행이다. 관계 원ID/기대배열/현재대표 끝점 raw를 보존했으며 자동 검사는 count/중복/실제 선택 끝점이다. 모든 종류·방향 전수 자동 대조나 자동 의미판단 성공을 주장하지 않는다.

원본v0의4실패/진단/검사준비 오류는 [c140a628 independent-v0](https://github.com/tlsee0813-cmd/agentflow-studio/tree/c140a62822f53bab16a8bd94d146efaec90e897a/docs/transfer/workspace-records-19/independent-v0)에 불변 보존하고 여기로 복제하지 않는다. old-product-v2-control은 별도 테스트 overlay 사본이며 원본81d 소스는 변경하지 않았다. 첫 purpose timing실패와 좁은 보완후 결과를 하나의완주횟수로 합산하지 않는다.

대표PNG4는 `representative/`에 원본바이트 그대로 있다. `PNG_BINDING.json`은 실행 출력명과 전달명/SHA를 연결한다(기존 phase probe의 stale 파일명을 현재 고친 상태에 맞게 전달명만 분명히 했다). 비대표 자동PNG는 local 원형보존/SHA목록, 필요한 원시JSON/JSONL/입력/로그는 원격전달한다. `MANIFEST.tsv`는 자신만 제외한 정확 payload 집합이다. source fullclone/node_modules/build/cache는 포함하지 않는다.

실행 범위의 높이 결함은 개선됐고 새 중요 제품 결함은 독립 장면에서 확인하지 못했다. HOME15 외부CI불일치는 미해결이며 최종수용/CI/병합은 총괄 판단이다. Windows/실제AI/사람사용성/무한지도/전체모바일 성공을 주장하지 않는다.
