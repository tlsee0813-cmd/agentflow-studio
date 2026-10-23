# 34 지도 기록 신호 — 후보 보류로 종료
2026-10-23 KST · 총괄 판단. 제품 소스는 이번 후보로 바꾸지 않았다.

말단에도 자기 기록 입구를 두고 현재 답변 없는 질문과 설명 상태를 구별하는 방향은 유효하다. 그러나 후보 `e059ec6d90e195263121c21817a39ea9ad0534a7`는 상태가 겹친 부모에서 기존 요청/결과 수 줄을 완전히 숨긴다. [INPUT](INPUT.md)의 기존 정보 보존 계약에 미달하므로 통합하지 않는다. 같은 카드에 모든 정보를 동시에 넣으라는 요구도 과했으며, 조건부 배치를 더 쌓아 해결하지 않는다.

## 실제 확인
- [작성자 구현·검사·원측정](https://github.com/tlsee0813-cmd/agentflow-studio/blob/e059ec6d90e195263121c21817a39ea9ad0534a7/docs/cycles/2026-10-23-map-signals-34/AUTHOR.md): 기존 질문 전체 N과 active이며 답변 기록 없는 M을 구별한다. 부모는 자기+포함 후손, 말단은 자기이며 관계가 범위를 넓히지 않는다. 현재/보류/이전 기준 설명을 따로 남긴다.
- [기준 양PC 관측](https://github.com/tlsee0813-cmd/agentflow-studio/blob/26f5e8500b9d917e94882bd865d5d07582dd1518/docs/transfer/map-signals-34/baseline-a/v0/REPORT.md): T2와 별도 혼합 입력의 읽기, 부모 기록 복귀, 명시 수신을 구분했다. Sol은 네 읽기 저장본 쌍과 두 수신 결과의 정확 H/원문·과거 자료·현재 B·Q 초안 보존을 독립 대조했다. 기준의 말단 신호 부재·긴 이름 말줄임은 한계다.
- [후보의 좁은 독립 반례](https://github.com/tlsee0813-cmd/agentflow-studio/blob/f1e49599fc02f87a3d5018c34ce1a2b609984a7d/docs/transfer/map-signals-34/residual-check/v0/REPORT.md): 1280×720에서 같은 공개 fixture와 보이는 파일 선택/명시 수신으로 부모 자기 현재작업+자기 갱신+두 줄 이름+여섯 사실을 만들었다. 구상 미기재 때 후보의 기존 수 줄 linebox 12.5px/글자 metric 10.5px가 가려지고 실제 PNG에서도 사라진다. 구상 있음은 linebox 4px/metric 2px 일부 가림이다. 지도 배율을 나눈 layout px이며 직접 픽셀 분할 수치라고 하지 않는다.
- 기준575bb745의 같은 수 줄은 말줄임으로 보이고, 대신 현재작업/갱신 표지가 가려졌다. 숨기는 정보가 바뀐 것이므로 원본도 나쁘다는 이유로 후보를 통과시키지 않는다. 총괄은 [기준 카드](https://github.com/tlsee0813-cmd/agentflow-studio/blob/f1e49599fc02f87a3d5018c34ce1a2b609984a7d/docs/transfer/map-signals-34/residual-check/v0/baseline-no-note.png)와 [후보 카드](https://github.com/tlsee0813-cmd/agentflow-studio/blob/f1e49599fc02f87a3d5018c34ce1a2b609984a7d/docs/transfer/map-signals-34/residual-check/v0/candidate-no-note.png)를 직접 대조했다.

## 검사 해석
작성자 최종 단위279개, 새 browser10개 중4개는 알려진 가림의 준비/측정일 뿐 가시성 합격이 아니다. expectedFailure가 무관한 준비 실패를 숨기던 방식을 제거했다. 추출 전 부분 회귀13개를 최종 소스 결과로 세지 않는다. 새 부모 입구 검사는 owner가 비어 있지 않은 부분집합임만 확인하므로 모든 자식 기록 보존의 강한 증거가 아니다.

Sol 정적 대조에서 가림은 fixed180px/진입부 overflow/줄어들지 않는 하단 줄 구조와 일치했다. 순수 집계 `recordFacts`는 배치와 분리해 재사용할 수 있지만 이번에 따로 제품에 넣지는 않았다. workflow의 큰 diff는 CRLF 정규화이며 실제 추가는9줄이다.

독립 실행은 Node22.16·Playwright1.57·Chromium154, 작성자는 Node22.22·Chromium141이며 같은 잔여를 얻었다. 수집 종료0과 [가림 반증 종료1](https://github.com/tlsee0813-cmd/agentflow-studio/blob/f1e49599fc02f87a3d5018c34ce1a2b609984a7d/docs/transfer/map-signals-34/residual-check/v0/gate.exit.json)을 구별한다. 환경/빌드/숨은 파일입구 준비 오류는 원자료에 보존됐다. 반례가 충분해 후보1440·전체 A/B·전체 회귀·PR/양OS CI는 실행하지 않았다.

## 이어갈 판단
이 후보는 별도 브랜치에 보존한다. 다음 표시 개선은 먼저 기본 지도에서 **어느 부분인지와 왜 읽을 만한지**를 구별하고, 본문·일반 수량은 기존 상세에서 읽는 우선순위 변경을 명시해야 한다. 현재성·보류·미답의 공존을 숨기거나 갱신을 완료로 표현하지 않는다. 크기/글자 축소나 새 줌 엔진으로 먼저 풀지 않는다.

지금은35의 최신 수용 제품 미리보기를 진행한다. 사용자가 프로젝트→지도→한 부분 이해→작업 수정/인계→복귀를 이어 체험할 수 있는 범위를 우선한다. 사람 연구를 새 관문으로 요구하지 않으며 Dify의 정보 단계 비교와 실제 사람 결과는 혼동하지 않는다. 공개 배포는 아직 결정하지 않았다.
