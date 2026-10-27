# UI·UX62 · 구조를 읽고 같은 자리에서 비교하는 PC 작업 화면

## 현재 수용본 · 2026-10-27

지도, 선택, 설명, 변경 비교를 **지도 + 오른쪽 한 읽기면**으로 정리했다. 큰 자료는 묶음·개수로 시작하고 실제 항목은 내부 목록에서 읽는다. 작은 자료를 큰 카드로 부풀리지 않는다. 입력 수집·출력 기능과 서버/모델 계약은 바꾸지 않았다.

- runtime source: `bcf88bbdcaa683b5d2e781a0ab97135ea6f00fb8`
- [PR34](https://github.com/tlsee0813-cmd/agentflow-studio/pull/34), merge `e25727e0f07f5341b64ddffcab08f3a5418231c5`
- source/merge app tree: `1ec4ff1c9e8deab3d989b8f9fdd1e717bf5e7d64`
- [최종 CI40442668481](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/40442668481): Ubuntu121986436149 · Windows121986436581 모두 성공.
- [주 체험본](https://agentflow-studio.tlsee0813.workers.dev/#/p/ex-converter) / [보조 Pages](https://tlsee0813-cmd.github.io/agentflow-studio/): 양쪽 공개 BUILD.txt가 위 source와 일치한다. Pages 게시 커밋은 `13a57b580c2c7301ba64212b8a1eb77baaa6c274`이며 기존 design 경로를 보존했다.

## 화면에서 달라지는 경험

1. **어디를 읽는지 유지한다.** 선택·설명·근거·변경 비교가 같은 오른쪽 면을 쓴다. 지도는 그 옆까지이며 선택 대상을 최소 이동으로 드러낸다. 근거를 읽고 돌아오면 카메라와 초안이 남는다.
2. **크기에 맞는 첫 윤곽을 준다.** 136부분의 VS Code 표본은 실제 9묶음과 개수로 시작하고 공통 항목43개는 목록으로 열린다. 사용자가 펼친 구성은 다시 자동으로 접지 않는다. 성긴5부분은 있는 만큼만 그린다.
3. **선택 전에도 이름을 구별한다.** 같은 부모의 Types 파일/디렉터리는 원명 `extHostTypes.ts` / `extHostTypes`를 찾기·지도 행·읽기면에 덧붙인다. 별개 대상을 합치지 않는다.
4. **같은 자리에서 변화를 이해한다.** 작은 변경안은 첫 열기에서 대상과 제목이 들어갈 때 한 번만 최소 이동한다. 항목·현재/미리보기 왕복은 같은 배치이며 현재에도 활성 대상의 중립 표시가 남는다. 큰 안은 억지 축소하지 않는다.
5. **관계와 층위를 섞지 않는다.** 안쪽 범위의 바깥 참조를 별도 입구로 보인다. 선택한 실제 관계만 강하게 드러내고 복잡한 개요의 우회선은 물러난다. 관계 종류·방향·대상은 바꾸지 않았다.
6. **읽기 마감을 맞춘다.** 한 줄 파일 이름의 불필요한 행 높이, 관계 원문 두 줄 잘림, 다른 프로젝트에 남는 다시 열기 안내, 이전 패널 때문에 다음 지도까지 축소되던 문제를 고쳤다.

Pro는 KNIME 경계 입구·Understand 선택 주변·OSGiViz 숨긴 관계·NDepend 밀집 관계 표현을 비교했다. 총괄은 안정된 읽기면·묶음/목록·선택 관계를 결합했고 전면 행렬, 모든 선의 상시 설명, 기존 점선을 불확실성으로 재해석하는 안은 채택하지 않았다. 독립 Claude의 추가 의견도 그대로 복사하지 않았다. Collector는 선택/기본 경로 계산이 원래 같았으므로 새 경로 엔진 대신 우회선 강약을 보정했다.

## 실제 OSS 자료 검토 범위

[정확 SHA·원출처·선택 범위](../2026-10-26-visual-experience-58/OSS_CASES.md)와 [고정 자료](../2026-10-26-visual-experience-58/OSS_CASES.json)를 사용한다. 이는 수작업으로 만든 출처 있는 부분지도이며 전체 저장소 자동 분석이나 OSS 실행 검증이 아니다. 표의 숫자는 부분/깊이/관계 수다.

| 사례 | 규모 | Cloud에서 실제 조작한 범위 | 하지 않은 것 |
|---|---|---|---|
| Joplin | 30 / 4 / 8 | desktop 내부·바깥 lib/editor/renderer·직전 장면 복귀 | 전체 최심부 |
| restic | 29 / 3 / 4 | 명령 목록·backup→Options·하위 탐색 | 모든 명령 개별 동작 |
| Node-RED | 32 / 4 / 8 | nodes/network·실제 응답 변경안·현재/미리보기 | 모든 노드 |
| Zephyr | 14 / 2 / 10 | 센서·I2C/GPIO·관련 관계 | 하드웨어 실행 |
| scikit-learn | 21 / 3 / 14 | 전처리·참조와 처리 순서 구별 | 학습·예측 실행 |
| VS Code | 136 / 2 / 7 | 9묶음·common43·동명 Types 두 원명 | 136항목 개별 검토 |
| Collector | 26 / 2 / 32 | traces/traces1 공유 receiver/exporter·processor 차이 | 실제 Collector 실행 |
| micro-javascript | 5 / 3 / 1 | 성긴 첫 구조·module/JSContext·접기 | 실제 라이브러리 실행 |

8종 모두 1280×720·1440×900에서 개요 PNG 열람, 선택·가능한 내부 진입·접기·복귀·휠 줌/이동을 실행했다. 별도 파생3종은 긴 접미사, 반복 이름의 부모 구별, 성긴 자료 크기만 대조했다. converter 합성3변경, Node-RED 실제 이전 모델 응답, Joplin 합성 배치안도 구별했다.

## 작성자 주장·독립 실행·총괄 판단

| 근거 | 결과와 한계 |
|---|---|
| 작성자 Claude | 335 continuity 검사·12브라우저 흐름과 영향 화면을 보고했다. 전체 제품 완성이나 실제 AI 품질의 증거로 확대하지 않는다. |
| Cloud request1 / 8c0e8cc | 8종·파생3·변경안 왕복 상태는 통과. 동명 Types 선택 전 구별과 VS Code/sklearn 초기 경계 잘림으로 시각 수용 보류. 두 건은 fa75727에서 수정했다. |
| 새 독립 Claude / fa75727 | 1280의5장면과1440핵심 장면을 직접 열어 읽기 순서·강약·크기 대응·복귀를 수용했다. 첫 비교의 타 대상 가림, 현재 대상 표시, 조밀 개요선과 작은 마감을 후속 개선으로 제안했고 최종 후보에 반영했다. |
| Cloud request2 / 753639a | 두 PC 크기에서 경계·동명 구별·작은 초안·비교 대상 전체/중립 표시·관계 원문·프로젝트 전환·Node-RED 회귀를 수용. |
| Cloud request3 / bcf88bb | 최종 후보의 기본 Noto Sans에서 1280·1440 실제 화면으로 VS Code 한 줄 행·Types 별칭, Joplin 짧은 행, 변환기 비교/닫기 복귀를 수용했다. 별도 DejaVu 강제 글꼴은 CSP로 적용되지 않아 미실행이며 작성자/CI의 넓은 글꼴 검사와 구별한다. |
| 총괄 Windows | 최초 미분석 변경안의 영역 충돌·Types 구별 문제, Collector 선/토스트 반례를 직접 재현했다. 최종 후보에서 변환기 1280 전체 비교 대상·현재 중립 표시·같은 지도 좌표, Collector98% 진입·관계 전문·토스트 제거를 확인했다. 배포 후 Workers1280에서 변환기 전체 비교 대상과 현재 전환, VS Code9묶음100% 개요·공통43개 내부 목록·Types 두 원명을 직접 확인했다. 아래 두 PNG는 그 공개 화면이다. |
| 최종 CI | 정확 source의 Windows/Ubuntu type/build/domain/HTTP/보안 경계/실제 브라우저 검사. paid provider 응답은 스텁이며 실제 AI 호출과 구별한다. |

최종 request3 ZIP은242406bytes, SHA256 `a656cd329402dd24f42fc838a856ce33795bde7a700dcdbbcc78d160fa836d00`이다. request2 ZIP은242207bytes, SHA256 `86bc6fd16ceffc80b740eaf66d429ce91d65766ca5681b961131bb0ff4550a2c`. GitHub에는 ZIP/전체 로그를 올리지 않는다. 독립 실행자의 PNG 열람과 총괄의 원본 회수는 구별하며, 아래 이미지는 총괄의 최종 공개 화면이다. DeepSeek 추출 작업은 오류·빈 반환으로 채택 결과가 없었고 출처 담당과 총괄의 원문 대조로 진행했다.

직전753639a의 CI는 Windows 성공·Ubuntu 행 높이 검사 실패였다. 실제 한 줄 이름에 과한 내부 여백과 줄바꿈 여유를 적용하던 원인을 수정했다. 최종 bcf88bb에서는 실제 글자 폭·줄 수·잘림을 확인하는 검사로 보강했고 양OS CI가 성공했다. 실패한 후보를 배포하지 않았다.

## 남는 대가

- 큰 변경안 전체가 현재 배율에 들어가지 않으면 활성 대상만 드러내고 다른 항목으로 옮길 때 최소 이동한다.
- 조밀한 개요의 선 다발은 옅게 남는다. 모든 관계를 개요에서 읽히게 만든 것은 아니며 선택한 관계와 원문으로 내려간다.
- 현재/미리보기의 대응 위치를 보존하므로 현재 모드에 비교용 행 높이가 일부 남는다.
- 첫 자동 접힘은 탭에서 프로젝트·범위별로 기억한다. 창 크기가 바뀔 때마다 사용자의 구성을 다시 정하지 않는다.
- 실제 AI 일반 이해 품질, 자동 수집/기억 갱신, OSS 자체 실행, 설계 전체 구현 완료, 실제 구매 의사는 이번 수용의 범위가 아니다.

## 최소 재현 자료와 화면

```sh
node app/continuity/scripts/build.mjs
node app/continuity/tests/visual58-fixtures.mjs --out <새 임시 폴더의 절대 경로>
```

홈의 백업 가져오기로 표본을 연다. Node-RED는 [기존 실제 모델 응답](node-red-real-plan.json), Joplin은 [배치 검토용 합성안](joplin-layout-plan.json)을 변경 구상에서 가져온다. 원본 요구·실제 응답·수작업 배치 자료를 혼동하지 않는다.

- [변환기 변경 비교 1280](converter-1280.png)
- [VS Code 136부분 첫 개요 1280](vscode-1280.png)

이전59–61 판단은 [PR31](https://github.com/tlsee0813-cmd/agentflow-studio/pull/31), [PR32](https://github.com/tlsee0813-cmd/agentflow-studio/pull/32), [PR33](https://github.com/tlsee0813-cmd/agentflow-studio/pull/33) 및 이 문서 Git 이력에 남긴다. 매번 증거 폴더를 늘리지 않고 현재 결과와 대표 이미지 두 장을 갱신했다.
