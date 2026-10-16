# cycle11 fix1 감사

2026-10-16 판단 기록. 최신 진행은 [ACTIVE](../ACTIVE.md). [v0 원본](https://github.com/tlsee0813-cmd/agentflow-studio/tree/6643323316daefbe10625484bb1727a2c6a54716/docs/transfer/shared-map-11/author-v0)의 app/ 5개 파일에서 engine.js만 [fix1 overlay](https://github.com/tlsee0813-cmd/agentflow-studio/tree/c4354dccc6f693bf33d5157e7e8da566d152d9a1/docs/transfer/shared-map-11/author-fix1)의 app/engine.js로 교체하는 구성이다. 원본 실패 이력을 덮어쓰지 않았다.

## 총괄 수령·실제 조작

수령 ZIP364,550B/SHA256 `52c3178d614a8deb15b92af994d3190a3c4c2d98aac13793694f89c02946893d`. 22파일534,719B를 GitHub에 올렸으며 원격 정확 집합·크기·Git blob과 manifest가 일치한다. Manifest21 payload532,580B + 자신2,139B이며 SHA256 `f3d9a0deb20a0d7b715300224c1f0bfa6ab8aad04e3fd4bcf0c4e4bad7789644`. 대표 PNG2장과 작은 수정분만 전달해 v0 전체를 중복 보관하지 않았다.

총괄은 Windows IAB PC1280×720에서 정확 fix1을 새로 열었다. FLOW091 C32의 빈 초안→E1 입력/미리보기→E2 수정에서 화면과 DOM이 즉시 E2로 바뀌고 실제 복사문도 E2였다. 공백 입력은 미리보기를 지우고 두 버튼을 비활성화했다. E3 재입력/미리보기/복사도 일치했고, 닫으면 본문이 제거되고 원래 준비 버튼에 초점이 돌아왔다.

이어 PowerToys 검색 동작을 골라 짧은 설명→근거 열기/닫기를 수행하고 FLOW와 다른 E를 작성했다. 사례를 두 방향으로 바꿔 각각 초안을 다시 열었을 때 자기 문장이 유지됐다. 이 직접 확인은 자연 PC1280 한 폭이며 수치화한 전체 지도 복귀나 모든 대상·모바일 검증으로 확대하지 않는다. 외부 링크 이동·AI 송신도 하지 않았다. 아래는 별도 감사자의 코드/원시 증거 읽기이며 독립 Cloud 실행과 합산하지 않는다.

# cycle11 fix1 좁은 실행 증거 감사

work/sharedmap11-author-v0와 sharedmap11-author-fix1을 읽기 전용 대조했다. 원본/검사 코드·브라우저 실행, 원본 수정, 추가 추출·원격 쓰기는 없다.

**수정은 의도한 1줄뿐이며 P2를 직접 해결한다.** 실제 engine diff는 동봉 v0-to-fix1.diff와 정확히 같다. 354행 syncDraftBtns가 비공백·열린 미리보기를 draftPreviewText()로 갱신하고 빈/공백 입력은 숨기고 본문도 비운다. 복사 함수·대상별 키·사례 전환·배치/선·fixture는 바뀌지 않았다. fix1 engine은34004B/SHA256 d3699ac75671b000cb4561ae137073aa73a18c74fefe6fbaa0bd3489c438ff8f다.

패키지는 engine overlay이며 다른4 runtime은 중복 포함하지 않는다. 원본 v0의 index/style/두 JSON과 overlay engine의 실제 bytes/SHA를 f01 collector의 fix1 before/after 및 브라우저 received와 대조해5파일 모두 일치했다. 즉 base+overlay로 귀속을 확인했으며 원본 폴더에 적용하지 않았다.

## 결과와 수정 원인의 대응

동일 regress-preview.mjs SHA f991a155…7b0f5를 두 버전에 사용한다. 각 child는 FLOW091·PowerToys 편집2장면과 사례 왕복1장면, 총3장면을 마쳤다.

| 대상 | 1280×720 | 1440×900 |
|---|---|---|
| v0 |52검사/6FAIL, 실제 child1|52검사/6FAIL, 실제 child1|
| fix1 |52검사/0FAIL, 실제 child0|52검사/0FAIL, 실제 child0|

각52개 중30개는 클릭 지점의 화면 안·hit 전제이고,22개가 나머지 내용 검사다.52개의 사용자 과제나 독립 사례가 아니다. v0 실패는 두 사례 각각 열린 미리보기 재편집 단계2·복사문과 표시 비교·재편집 단계6의 세 항목이다. fatal이나 HTTP 실패를 결함 재현으로 바꾼 기록은 아니다. 네 child 모두 console/pageerror0·crash없음·시작 장면 미완주0이며 HTTP5파일 status200/SHA 일치, 실행 전후 불변이다. 실제 shell collector-exit0도 맞다. 여기서 수집기0은 v0 기대실패+fix1 정상의 조합이지 네 child 모두 통과라는 뜻이 아니다.

검사는 E1→열린 미리보기→E1+E2 편집·복사, 삭제, 공백, E3 재입력·복사·미리보기 재열기, E3+E4 편집·복사를 실제 키보드로 수행한다. 최신 raw는 열린 미리보기와 클립보드의 갱신을 확인한다. 공백 뒤에는 사용자가 재열기 전까지 미리보기가 닫힌 상태다. 390·권한 없는 복사·관계 href·지도 복귀는 이번 추가 검사 범위가 아니다.

## 보고를 한정할 부분

**단계7의 ‘사례 간 섞이지 않음’은 강한 검사가 아니다.** E3/E4가 두 사례에서 같은 문자열이므로 왕복 시 final.flow와 final.pt 모두 ‘빈칸 뒤 다시 쓴 요청. 마지막 덧붙임.’이다. 보존·재열림 상태는 확인하지만 서로 다른 값을 나누어 보존하는지 이 추가 결과만으로 판정할 수 없다. 기존 v0 r05의 서로 다른 E 격리 증거와 분리한다.

collector의 v0Reproduced는 정확한 세 실패명을 요구하지 않고 nonzero+하나 이상 실패명으로 판정한다. 현재 raw의 실제6FAIL 원인은 정확히 일치하므로 이번 결과를 폐기할 사유는 아니다. child 완주도 시작된 장면 기준이며 startup/cleanup은 구조화 raw 밖이다. REPORT의 ‘v0 299 계열’은 cycle11 v0 수치가 아니므로 재인용하지 않는다. 기존 결과/독립 Cloud/사람 검증과 합산하지 않는다.

