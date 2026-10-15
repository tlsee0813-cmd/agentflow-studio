# cycle07 독립 Cloud 코드·원시기록 감사

고정 전달 커밋 `72f923ef9da6ab222427792959d17a9a4a74510d`, 수령 경로 `docs/transfer/change-record-07/independent-v0/`의 코드·세 실행 JSON/로그·종료 기록을 읽었다. 재실행·브라우저 조작·원본 수정은 하지 않았다. 최신 실행을 무효화할 중요 불일치는 발견하지 않았다.

**보고 경계 1개:** 실제 child와 외부 collector 종료 0은 각각 `collect.py:6–8`, `launch.py:4–6`의 subprocess returncode와 원시 기록으로 확인된다. 다만 `actual-exit.json.launcherExit`는 launcher가 자기 종료 전에 계산한 값이다. launcher 자체의 종료를 바깥 프로세스가 수집한 기록은 전달되지 않았다. 따라서 “child/collector 실제 0, launcher는 0 전파 코드·기록”으로 표현하는 것이 정확하다. 전파 누락 버그는 아니며 추가 실행이 필요한 제품 결함도 아니다.

| 실행 | 실제 기록 | 수정/실패 구분 |
|---|---|---|
| run01 | 3/6 경로 완료, 35 PASS/1 FAIL, fatal 1, child/collector 1 | 1440 P1 복귀의 SVG 문자열 차이와 390 P2 노출 중단. 후자는 카드 bottom 668.25 대 clip 668의 테두리 0.25px이며 이름/책임 내용 접근 실패와 같지 않다. |
| run02 | 6/6 완료, 57 PASS/3 FAIL, fatal 없음, child/collector 1 | 선 숫자·pathRect 비교 및 카드 이름/책임행 전체 노출+hit 허용으로 검사 조건을 변경했다. Ctrl+End 이후 390 요청칸 top이 P3 0/최대5, 메뉴 35/최대43이어서 끝접근 검사 3개가 실패했다. |
| run03 | **6/6 완료, 60 PASS/0 FAIL**, fatal/pageerror/cleanup 오류 없음, child/collector 0 | 판정 조건은 유지하고 overflow가 있는 요청칸 안 실제 wheel을 추가했다. 준비 PNG도 390 P1 편집 전·스크롤 뒤로 변경했다. 과거 실행이나 작성자 75개와 합산하지 않는다. |

세 실행 모두 최초 HTTP 두 응답이 200·42,420 bytes·SHA256 `d10e7dcac86bf4d569164ad9276a7686a92aec43ad4ec8bd68924e88ecf897cb`이며 파일 전후 해시도 일치한다. 최신 루트 검사 3파일은 run03 스냅샷과 같다. 로그의 PASS/FAIL 수는 JSON과 일치한다. console의 favicon 404 한 건은 보존됐으며 pageerror 없음과 구분된다. 새 의도 실패 probe는 없다.

핵심 상태 증거도 정합하다. `check.py:94–103`의 P1 A/B 및 P2 A2/B2를 각각 대조하면 두 폭 네 복귀 모두 실제 computed matrix가 `matrix(1.15, 0, 0, 1.15, 0, 0)`이고 세 카드 rect·native 지도 스크롤 차이는 전부 0이다. 1440 지도는 left34/top0(세로 이동 여유 없음), 390 P1은 left24/top0, P2는 left0/top535다. 두 선의 ID·끝점·matrix·라벨도 원시 전후 값에서 같고 pathRect 최대 차이는 약 0.0000153px, d 숫자 최대 차이는 약 0.0000425다. 비교 보기·책임 문구 복구와 P1 편집 E→P2 별도 기본문→P1 E 유지가 확인된다. 복귀 직후 보조 스크롤은 없다.

`check.py:83–91`의 관련 P2 경로는 두 폭 모두 reader 100→100, 관련 행 x/y/w/h 차이 0, P2 출발 버튼 초점·P3 선택 유지다. 코드/후속 peek 각각 버튼 닫기·재열기·Escape 뒤 실제 panel/링크/닫기 버튼 수 0, anchor y·reader top·출발 초점 복구가 원시값과 맞는다. `check.py:63–66`은 요청칸과 바깥 영역을 분리했다. 390 실제 wheel 뒤 P3 top5/최대5, P1/P2 top43/최대43, outer top0이다. 1440 내부 overflow는 없어 그 스크롤 경로를 실행한 것으로 세면 안 된다.

남은 범위: 카드 접근 조건은 모든 테두리의 동시 노출과 다르며, clip/hit는 대표점 접근이다. textarea 끝접근 검사는 caret·native 최대 스크롤·입력칸 박스를 확인하며 마지막 문자의 잉크를 직접 측정하지 않는다. 전체 지도 복귀 초점은 원시 스냅샷에서 각 카드로 돌아오지만 `stable()` 자체의 초점 단언은 아니다. E 보존은 편집한 ask 필드에 대한 확인이다. 원 프로젝트 실행/CI, 실제 AI 송신·수락, 외부 원문 왕복, 터치·사람 이해 성공으로 확대할 수 없다.

