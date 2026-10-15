# cycle10 목록 표현 출처·적용 경계 감사

2026-10-16 공식 문서·지정 고정 코드·cycle09 fix1 HTML만 읽었다. 데모/브라우저 조작·구현 변경은 하지 않았다.

**DataTables 주장은 조건부로 정확하다.** [Class control 문서](https://datatables.net/examples/responsive/column-control/classes.html)와 [고정 classes.xml](https://github.com/DataTables/Responsive/blob/935c1f4efc8aa7b8c63e83921a693fe806279e36/examples/column-control/classes.xml)은 Name에 `class="all"`을 지정한다. 이는 Responsive의 모든 breakpoint에 포함한다는 뜻이다([고정 코드 606–612행](https://github.com/DataTables/Responsive/blob/935c1f4efc8aa7b8c63e83921a693fe806279e36/js/dataTables.responsive.js#L606-L612)). viewport 밖/가림/다른 API까지 포함해 항상 읽힌다는 보장은 아니다. `none`은 열에서는 숨기고 상세에, `never`는 상세에서도 제외하는 구별이 있다.

[renderer 공식 문서](https://datatables.net/ref/core/option/responsive.details.renderer)는 기본 `listHidden`이 숨긴 셀만 상세 목록으로 만들고, `tableAll`은 숨김 여부와 관계없이 열을 출력한다고 설명한다. [고정 코드 1556–1632행](https://github.com/DataTables/Responsive/blob/935c1f4efc8aa7b8c63e83921a693fe806279e36/js/dataTables.responsive.js#L1556-L1632)도 `listHidden`의 `col.hidden` 조건과 `tableAll`의 무조건 순회를 확인해 준다. **단, tableAll의 ‘모두’는 전달받은 columns 범위다.** 앞선 `_detailsObj`(849–869행)는 never/control 열을 제외하고, hidden은 `dt.column(i).visible() && !current[i]`로 만든다. API로 숨긴 모든 열을 복구하거나 실제 픽셀 가시성을 판정하는 규칙은 아니다. 숨김 항목이 없으면 listHidden은 false를 반환한다. listHiddenNodes는 DOM 노드 이동을 쓰는 별도 선택지이며 같은 구현으로 취급하지 않는다.

고정 JS는 헤더상 **Responsive 3.0.3**이다. 반면 현재 공식 classes.html의 HTML `dt_demo` 로더 설정은 `responsive`의 CSS/JS 경로로 **CDN 4.1.1**을 지정한다. 현행 데모와 고정 코드가 같은 버전이라는 주장은 지지되지 않는다. 이는 HTML 로더 설정 관측이며 실제 실행·최종 로딩 바이트 확인은 아니다. 문서는 현행 자료이고 renderer 옵션 자체는 since1.0.0, 내장 renderer 선택지는 since2.1.0으로 설명한다.

**우리 코드의 실제 누락:** [cycle09 fix1 HTML 501–549행](https://github.com/tlsee0813-cmd/agentflow-studio/blob/08a04afb7515efc5f4007b5d9bf5bb787c908c20/docs/transfer/mixed-reading-09/author-fix1/mixed-reading-study.html#L501-L549)의 G3 선택은 `ids=[G3,C31,C32]`다. R2=C21→C31과 R3=C21→C32 모두 `inn=true/out=false/other=C21`이어서 504행 목록이 같은 ‘받음 ← 새 요청의 배경 고정 / 요청 사본 · 요청 맥락 안’으로 축약된다. 실제 받는 C31/C32는 목록에서 빠지고 참고의 양끝(517행)을 열어야 나온다.

이것을 모든 항목의 단일 규칙으로 일반화하면 안 된다. 일반 세부의 받음은 선택 대상이 실제 to이고 보냄은 실제 from이다. 예컨대 C21 선택의 R2/R3은 other=C31/C32라 이미 구별된다. 묶음은 선택 이름이 실제 끝이 아닐 수 있고, 방향에 따라 묶음 안의 보내는/받는 세부가 생략된다. 양끝이 같은 묶음 안에 있으면 `안에서` 분기가 되며 현재 helper는 to만 other로 고른다. 현재 R1–R6에 그런 내부 관계가 없다는 점과, 이를 처리하는 일반 엔진이 검증됐다는 주장은 다르다.

DataTables는 필드의 구조적 숨김 상태로 상세 중복을 줄이는 사례다. 우리 xref에서 상대·소속·조건을 생략하려면 **동일 대상·동일 의미의 정보가 현재 실제로 읽히는지** 먼저 구분해야 한다. 접힌 G2 대표, 스크롤 밖 선택 설명, G3 이름으로 실제 세부를 추론한 경우는 그 조건을 충족했다고 볼 수 없다. R2/R3의 대상 차이와 요청 당시 사본 조건을 중복으로 오인해 지우는 근거가 아니다. 구체 표현·생략 규칙은 이번 감사에서 결정하지 않았다.

