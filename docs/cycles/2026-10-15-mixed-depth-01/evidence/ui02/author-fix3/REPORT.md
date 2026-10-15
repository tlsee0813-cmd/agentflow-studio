# UI-02 fix3 작성자 근거와 공유 화면

기존 INPUT 합격 기준 9의 표시 누락을 보완한 작성자 반환본이다. 접힌 A, 접힌 A의 끝점 목록, B의 끝점 목록, 모바일 구조 목록의 관계 행에서 A2 소유 미결과 결정 변경을 구분한다. B 미결 문단의 직접 A2 이동은 총괄이 추가한 조작 보완이다.

HTML SHA256: `0AEEDD515E7F80F4B091BA1B395F90E0D19355A9EB3CA6C7E1174AD48FA2898C`. [현재 시안](../../../canvas-study.html). [작성자 실행 환경·명령](VERSION_AND_RUN.txt).

## 작성자가 반환한 실행 근거

| 검사 | 결과 | 구분 |
|---|---|---|
| Chromium 합격 9 위치별 | 112 PASS / 0 FAIL, INFO 2, exit 0 | 단언 수; 실제 사용자 과업 수 아님 |
| 중간 fix2 음성 대조 | 88 PASS / 20 FAIL, exit 1 | [중간 HTML](versions/canvas-study.fix2.html), 새 지역 검사의 누락 검출 |
| jsdom 의미 회귀 | 84 PASS / 0 FAIL | 상태 검사, 렌더링 아님 |
| 기존 Chromium 렌더 | 36 PASS / 0 FAIL, INFO 1 | 작성자 실행 |
| 390×664 / 390×844 스크롤 | 각 10 PASS / 0 FAIL | 두 화면 높이를 따로 검사 |

원본 검사 4개와 로그 6개를 `tests/`, `outputs/`에 보존했다. 작성자 검사와 [독립 상태 검사](../acceptance9/REPORT.md)는 합산하지 않는다. Safari/Firefox, 실제 모바일·터치·화면 판독기·사람 사용성은 미검증이다. 별도 클라우드 실제 화면 검증은 이 패키지 자체로 증명하지 않는다.

## 다른 세션에서 회수할 수 있는 대표 화면

PNG 원본 4개만 공유한다. 합성 연구 입력의 화면이며 로컬 ZIP 경로에 의존하지 않는다. 같은 커밋의 파일 링크로 내려받을 수 있다.

| 화면 | 원본 SHA256 |
|---|---|
| [1440_S2_B_endpoints_open_ref.png](screenshots/1440_S2_B_endpoints_open_ref.png) | `CCB73CC762A1CAB03B207193ECBCE42F0F524DBE87BA1E59BB7314026C70C2AB` |
| [1440_S2_collapsed_open_ref.png](screenshots/1440_S2_collapsed_open_ref.png) | `D868DFB682EB7B8CDF57C222F38C22705D787B5347A7E936712C21DB482146B3` |
| [390_S2_B_detail.png](screenshots/390_S2_B_detail.png) | `67CEE6ED0505A4C0D5055BBE6E2CA92BF7C70F59384DA4F1A351DA468DE4E100` |
| [390_S2_outline_relations.png](screenshots/390_S2_outline_relations.png) | `10E88E499E247EF8785B9B2A9CC131C09421C1002716F6497B65BC8BF31C9C6E` |

접힌 A의 대표 캡처는 끝점 목록을 닫은 상태다. 열린 목록 자체의 시각 검토나 화면 아래에 가린 모바일 A6 행의 접근성은 해당 캡처만으로 통과시키지 않는다. [독립 정적 이미지 검토](../../../UI02_FIX3_VISUAL_REVIEW.md)와 후속 독립 실행을 구분해 읽는다.

