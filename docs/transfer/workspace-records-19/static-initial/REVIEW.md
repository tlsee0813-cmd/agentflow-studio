# Cycle19 UI — 독립 정적 검토 진행 기록

2026-10-22. 제품/검사 수정, 서버/브라우저/검사 실행, commit/push 없음. UI 세 파일만 읽었다. 이 문서는 첫 구현의 정적 발견이며 최종 수용 판정이 아니다.

첫 동결 통보값: app.ts SHA256 `500697f7058e15b068b2d7644c72859f1fd1392edfd709ef280362cd0ad1fb23`, styles.css `d74ca5b8f3d75251687520c9de7484bf46dfc1eabf4ee096de0a520a631b9d0a`, index.html `aa70436d574777a83f909824be910c1f03e67884cdb334a27723f6d432fa7d28`.

첫 소스 읽기 후 app.ts가 `a0a030e93d6622b503e43339aac8fd6a950d7c8b3eeb44fcb9d5bad8f8f7bfbb`로 변경됐다. 아래 첫 발견의 해당 소스 줄은 변경 전 도구 출력으로 읽었지만, 이 검토자가 500697 전체 파일 사본을 별도로 보관하지는 않았다. 전체 실패 버전을 역으로 재구성하지 않는다. CSS/HTML 해시는 동일했다.

## P2 — 과거 기록 출발점이 새 탐색까지 유지됨

첫 소스 app.ts:327,335,343,417. 기록 R1에서 소유 부분 A를 찾은 뒤 현재 작업 → 일반 전체 공간 → 다른 B의 영역/작업을 읽어도, `located.origin.panel === 'records'` 예외가 located를 보존하고 markOrigin이 과거 Origin을 그대로 사용한다. 새 B에서 출발한 읽기·복귀가 이전 R1에 묶인다.

최소 정책: 명시적인 새 탐색과 기존 excursion 계속을 구분한다. 일반 nav-space/work/history는 새 탐색으로 끝내고, 동일 소유 부분에서 새 요청·인계 또는 실제 관계 끝점의 명시 선택은 해당 chain을 유지한다. 단순한 모든 records 예외는 없애야 한다. root와 작성자에게 전달했다.

추가로 **A0A030을 직접 읽어 확인한 경로**: R1 → 소유 B → toolbar에서 기록 다시 열기 → R2 보기. openRecords(:1685)는 located/origin을 비우지 않으며 markOrigin(:343)이 여전히 R1을 우선하므로 R2 행의 새 출발 위치가 기록되지 않는다. 명시 openRecords는 기존 목록 읽기 memo를 보존하면서 이전 excursion을 종료하는 새 읽기로 구분할 것을 전달했다. 부분/연결의 중간 보기 전환과 실제 관계 끝점 선택을 무조건 초기화하라는 뜻은 아니다.

## P2 — 사라진 호출행의 안내가 숨거나 다음 렌더에서 사라짐

첫 소스 app.ts:386–390,1692. fallback 안내는 스크롤 본문 첫 p에 생성된다. 복귀에서 안내를 보인 뒤 기존 깊은 scroll을 복원하므로 안내는 본문 위쪽 클립 밖에 남을 수 있다. 고정 records-heading의 preventScroll focus는 그 안내를 보이게 하지 않는다. 이후 일반 render는 notice를 hidden 빈 요소로 다시 만들므로 같은 기록 보기에서도 안내가 소실된다.

최소 정책: 읽기 위치를 강제로 맨 위로 되돌리지 않고, 고정 머리의 짧은 상태 또는 동등하게 항상 보이는 위치에서 이유를 설명한다. 한정된 탭 보기 상태로 다음 필요한 렌더에도 유지하고, 최종 머리 높이를 확정한 뒤 원래 읽기 위치를 복원한다. 가짜 기록행 복원이나 다른 보고로 초점 대체는 하지 않는다.

## 작성자 자체 발견과 A0A030 확인

panelMode는 지도 보기의 기억이므로 기록을 연 뒤 일반 카드로 영역 화면에 가도 값이 records일 수 있다. 영역 화면의 Origin까지 records로 표기하면 recordGone fallback이 없는 records DOM을 찾을 수 있다. 작성자가 먼저 보고한 경계에 동의했다. A0A030 :349의 `view==='space'?panelMode:'area'`와 :386의 `o.view==='space'` guard를 직접 확인했다. 기존 명시 기록 excursion은 located.origin에 보존되므로 이 scope 한정과 충돌하지 않는다.

## 다른 요청 범위

읽은 첫 구현에서 기록 footer는 ‘지도에서 계속 보기’만 제공하여 이전 선택 Area의 새 요청 행동을 기록의 행동처럼 노출하지 않는다. 실제 기록의 소유 부분 CTA는 해당 Area ID를 사용한다. 부분/연결/기록은 각 읽기 키를 사용하며 관리 메뉴는 기존 버튼과 명시 summary를 재사용한다. 일반 render의 관리 details 복원 제외와 전역 Escape의 consumed/IME/editor guard를 읽었고 이 범위에서 별도 actionable 결함을 확인하지 못했다. 실제 메뉴 노출·클릭·키보드·지도 기하는 브라우저 수용에서 확인해야 한다.

## 042B 재검토

직접 읽기/SHA 확인: app `042b6c1cc2cecda35fd2e3bd69febe9a0f153c54726b93b7939eb679376b3fa3`, CSS `f97fed78d87fbd7edf15e8556894ba023ba3b01463d54730796904e36c37408d`, HTML 동일.

- nav-space/work/history와 place-space의 endRecordsExcursion, 명시 openRecords의 located/origin 초기화로 앞서 제시한 해당 새 출발 경로는 해소됐다. 목록 memo는 지우지 않는다.
- openArea/writeInArea의 넓은 records 예외가 제거됐다. 실제 관계 끝점 선택은 showReceivedArea에서 located.area를 갱신하므로 같은 chain을 계속할 수 있다.
- missing notice는 고정 panel head에 옮겨졌고 recordsReturnNotice 탭 변수로 같은 records-mode 렌더에서 유지된다. 복귀에서 안내를 보인 뒤 최종 sizeWorkspace와 원래 읽기 복원을 수행한다. 새 모드/새 기록 읽기/새 탐색/프로젝트 변경에는 해제한다. 이전의 본문 밖 안내 문제는 정적으로 해소됐다.
- **수명 결함의 남은 P2 경로:** R1 → 소유 A → 일반 지도에서 B의 정보 버튼(:1211, 좁은 목록 :1424) → B 패널의 작업 읽기 → markOrigin(:344). 일반 정보 선택은 located.area A를 그대로 두고, markOrigin은 origin.panel===records만 확인해 과거 R1을 계속 복사한다. openArea(B)/writeInArea(B)의 새 guard를 거치지 않는 경로다. 일반 다른 부분 정보 선택이 새 탐색이라는 정책에 맞춰 해당 선택에서 이전 records excursion을 종료하거나 markOrigin을 실제 소유 문맥으로 한정해야 한다. 관계 끝점의 명시 탐색은 located.area를 갱신하므로 별개로 보존할 수 있다. root/작성자에게 전달했으며 수정 확인 전이다.

