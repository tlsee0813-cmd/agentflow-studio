# cycle09 재사용 코드 경계

읽기 전용 감사·검증 제안이며 구현/브라우저/검사 실행 결과가 아니다. cycle05 캐시 [cycle05 HTML](https://github.com/tlsee0813-cmd/agentflow-studio/blob/10d1f03f6944a2787079cdb49cf009c6b1fbd302/docs/transfer/composition-05/author-v0/composition-study.html)은 고정 `10d1f03f6944a2787079cdb49cf009c6b1fbd302` 원본과 지정 bytes/SHA(46,924B·`5e937f9e…797831d6`)가 일치한다. cycle08 [cycle08 HTML](https://github.com/tlsee0813-cmd/agentflow-studio/blob/167f86b8ac783a15bc1b2991b73017ee2f1e0d6a/docs/transfer/overview-08/author-fix1/overview-study.html)도 고정 `167f86b8ac783a15bc1b2991b73017ee2f1e0d6a`의 42,025B·`85f07ee4…1fe0eb81`과 일치한다. 아래 행 번호는 이 파일들 기준이다.

**05의 상태·관계 엔진을 유지하고 08의 정보 배치 원칙을 적용할 수 있다. 두 엔진을 그대로 합칠 수는 없다.**

| 실제 지점 | 재사용할 계약 / 그대로 옮길 수 없는 가정 |
|---|---|
| 05 `N/ORDER/RELS` 287–330행, `#n-G1`…`#n-G5`, `#n-C32` | 5묶음은 AI 제안, R1–R6는 원문 계약의 실제 전달이다. R1 G1→C21, R2 C21→C31, R3 C21→C32, R4 C32→G5, R5 G5→C42, R6 C21→C41을 유지한다. 08의 P1/P2/P3·두 호출·누락 확인 이동 문장은 가져오지 않는다. 05의 `changed`는 C32 변경 소유이며 미결 모델이 아니다. |
| 05 `buildMap/applyDepth` 333–381행, `[data-tog=G2/G3/G4]`, `.gfold/.kids` | 기본 depth 0/1/0, 묶음별 독립 펼침을 유지한다. 접힌 G3의 “안에 바뀐 부분”은 C32 소유를 요약하며 묶음 전체 변경으로 올리지 않는다. 08의 기본 이름·역할·짧은 변화→선택 상세 원칙은 적용 가능하나 `.face` 고정 높이 3노드 표현을 붙여 자식 DOM/실제 깊이를 대체하면 안 된다. |
| 05 `rep/bundles/drawEdges` 323–330,387–415행, `#edges g[data-rels] path.hit`; 패널 446–481행 | 표시 대표와 실제 끝을 분리한다. 접힘으로 합쳐진 선은 R ID 목록을 보존하고 `[data-rel]`→`[data-goto]`로 실제 끝을 선택한다. `selectNode`(440행)는 그 끝의 부모만 펼친다. 08의 고정 두 선·`.lab`·pointer-events:none 방식으로 바꾸면 집계선 선택/관계별 상세가 사라진다. 높이 변화는 기존 group ResizeObserver(648행)의 재계산과 결합된다. |
| 05 `state` 320행, 선택 429–443행, 집중 542–558행 | typed `sel={t:node/rel/bundle,…}`와 `focusId`를 구분한다. 진입 snapshot의 depth·scale·map scroll·390 main scroll·지도 선택을 복원하고 `focusTarget(rep(id))`로 초점을 돌린다. `switchFocus`는 새 지도 snapshot을 만들지 않는다. 08의 문자열 sel과 깊이/mainSt 없는 snapshot은 대체 불가다. 특히 05 `view=map/focus`, 08 `view=before/after`는 뜻이 다르다. |
| 05 `#panel`, `#focusView`, `#p-C32-F1`/`#pk-C32-F1`, `#fPrep`, 준비 579–610행 | 08처럼 세부 근거/준비를 명시 상세에 둘 수 있으나 05의 FACTS·고정 출처·외부 rail·4개 준비 필드와 per-focusId 편집을 유지한다. 근거는 실제 삽입/제거 후 fv scroll·버튼 초점 복구다. 08의 `#reader`, `data-peek`와 5필드 prepDefaults를 복사하면 대상/조건/출처가 바뀐다. 준비≠송신·수락·완료 경계도 유지한다. |
| 08 `fitAll/applyScale` 283–304행 vs 05 `POS/zoom` 312–368행 | 08 맞춤은 고정 W/H·최소배율0.5·중앙 margin을 쓰며 임의 배율을 만든다. 05는 실제 DOM 높이가 깊이에 따라 바뀌고 우회선도 고정 world 경계를 넘을 수 있어 같은 식이 현재 노출 전체를 보장하지 않는다. 05 zoom은 `STEPS.indexOf`라 1.019 같은 새 배율을 넣으면 다음 조작이 fallback 단계로 뛴다. 맞춤을 넣는다면 별도 설계/검증 대상이며 복귀 snapshot과 혼합하지 않는다. 08의 `locate`도 선택을 유지한 가리킴이므로 05의 실제 끝 선택과 동일 동작이 아니다. |

최소 검증은 다음 **3흐름 제안·미실행**이다. 1440×900/390×844에서 같은 작은 기록을 쓰고 기존 통과 수는 승계하지 않는다.

1. **혼합 깊이에서 조망→실제 첫 선택:** 기본 깊이와 이름·역할·C32 변경 단서를 기록하고 한 묶음만 토글한다. 다른 깊이 보존, 재선택 없이 바뀐 선 끝, 첫 선택 전후 카드/선 raw 쌍과 선택 상세 노출을 본다. 전체 동시 노출/맞춤은 실제 제공될 경우만 별도 새 보기로 관측하고 작은 글자·clip/hit를 이해 성공과 구분한다.
2. **집계선→원래 관계→실제 끝:** G2/G3가 접혀 R2/R3가 모인 선을 실제 클릭→R3만 보기→C32 끝 선택. 원래 R1–R6의 중복 없는 ID/양끝을 확인하고, G3만 열리며 G2/G4 깊이·C32 소유가 유지되는지 본다. 관계 수만 같음이나 표시 대표 G3를 실제 끝으로 바꾸는 결과는 실패다.
3. **비초기 집중·근거·준비→진입 지도:** 사용자 조정 깊이·배율·지도/main scroll과 선택을 raw 저장한 뒤 집중한다. 실제 휠 위치에서 근거 버튼닫기→재열기→Escape의 제거/행 rect/초점을 확인하고 C32 준비문 E를 편집해 닫는다. 필요하면 묶음 집중→C32 `data-fgo`로 내부 대상만 바꾼 뒤 복귀해 **진입 지도 선택**과 **C32 편집**을 각각 확인한다. 즉시 computed transform/native scroll·대표 노드 여러 개/선 raw를 대조하고 재진입 E 보존을 확인한다. 보조 스크롤로 복귀 오차를 상쇄하지 않는다.

실제 HTTP body SHA를 새 원본에 결합하고 child/외부 collector 종료·미완주를 남기는 방식은 재사용하되 새 실행의 증거로 받아야 한다. 과거 기록의 실제 관측 범위, 원문 미리보기와 외부 왕복, MOCK 계약과 실제 사람/AI 인계는 서로 구분한다.

