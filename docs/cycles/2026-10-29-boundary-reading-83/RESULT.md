# AF-UI83 boundary reading — RESULT

## 작성자 검증 (UI 작성자, 기준 05f64d0)

범위: `app/continuity/src/client/map-layout.ts`, `app.ts`, `public/styles.css`, 새 회귀 `tests/boundary83.test.mjs`. 원본 fixture,
source/API/schema/prompt, 저장 parent·관계는 바꾸지 않았다.

### 바뀐 것
1. **경계 이름(.ghost-head) 치수**: layout이 이 글을 12.5px/400 설명글 측정 × 0.96으로 재고 있었으나 CSS는 600 11px + 자간 .04em(글자마다
   0.44px)으로 그린다. Linux 글꼴에서는 우연히 일치(116.5 vs 116.2px)하고 Windows 글꼴에서는 어긋나 2줄로 그려졌다(layout은 1줄 20px만
   예약). 이제 `TextMeasure` 'where'(600 11px, 페이지 글꼴 canvas 측정) + `HEAD_TRACK` × 글자 수로 잰다. 이름 자르기·축소·ellipsis 없음;
   300px 넘는 긴 문맥은 이전처럼 줄바꿈하며 그 줄 수만큼 높이를 예약한다. 관계 동사 라벨도 경계 이름을 덮지 않게 장애물에 넣었다.
2. **현재 범위 자신**: 범위와 그 안쪽 부분 사이 관계의 끝이 범위 자신(id 동일)이면 '밖 · …' 대신 '이 범위' 머리 아래 실선 카드
   (`.ghost.self`)로 읽고, 누르면 범위를 벗어나지 않고 그 범위 설명(범위 읽기면)을 연다. 선택 중이면 선택만 닫힌다. 읽기면의 그 관계
   행도 위치를 '이 범위'로 적는다. 판정은 id로만: 같은 이름의 다른 부분은 여전히 '밖'. 관계 수·방향·종류는 그대로.

### 실제 검사 (Linux 컨테이너, Chromium/Playwright 기존 설치, mock 서버, 새 API 호출 없음)
- before 재현: 05f64d0에서 페이지 글꼴을 더 넓은 DejaVu Sans로 바꾸면 1280/1440 모두 오른쪽 머리 `h32`, 다음 카드와 `-12px`(보고된
  Windows 12px 겹침과 동일). 기본 글꼴에서는 우연히 1줄.
- after: 같은 두 글꼴·1280×720/1440×900 모두 머리 `h16`, 머리 하단 + 4px = 카드 상단, 이름 전체 유지(넓은 글꼴 `w135`, 기본 `w119`).
- 상호작용(1280): 범위 카드 클릭/키보드 Enter → 범위 설명, `/in/<scope>` 유지·선택 없음; 선택 상태에서도 동일; 읽기면 '이 범위' 행
  따라가기 → 범위 유지; 실제 바깥 '오류 처리' 클릭 → 그 자리로 이동, 브라우저 뒤로 → 범위 안 복귀. 페이지 오류 없음.
- UI75 보존: 주장 순서·근거 왕복(포커스/스크롤/카메라)·끝점 note·행↔선 강조·관계 따라가기와 복귀 19개 통과. 이전 '더 보기' 기대는
  기준의 eac7b08(전체 주장 표시)로 대체되어 제외. 75 외곽 우회(E75-5)·안쪽 선(E75-4)·전체 읽기 노트 검사 통과.
- Node: `node --test continuity/tests/*.test.mjs` 486 pass / 0 fail(신규 U83-1·U83-2 포함; 80 역할 근거 검사 포함).
  U83은 05f64d0에서 새 export가 없어 실패(행동상 before 증거는 위 브라우저 재현).

### 미실행·한계
- 고정 TypeScript 5.8.3 미설치: 환경의 TS 6.0.2로 빌드. `check.mjs` 타입 단계는 기존과 같이 손대지 않은 `bindNewProject`의 TS6 전용
  오류 1건에서 멈춘다. Python `studio_browser.py`(Python Playwright 미설치) 미실행. Windows 실제 글꼴·실PC는 root 담당.
