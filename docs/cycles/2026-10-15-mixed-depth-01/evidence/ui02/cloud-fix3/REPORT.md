# UI02 fix3 — 클라우드 실제 브라우저 증거 원본 감사

**원본 회수·무결성·검사범위 감사 완료.** 고정 공유 커밋의 14개 파일을 GitHub connector로 읽어 임시 로컬 사본을 만들고, 코드·최초/최종 JSON·로그·원본 PNG 5장을 대조했다. manifest가 열거한 13개 파일의 바이트수와 SHA256은 모두 일치한다. 최종 JSON의 **86개 검사 그룹 통과 / 실패 0개**, 최초 JSON의 **85개 통과 / 실패 1개**도 직접 재집계했다. 이는 아래 한계를 가진 해당 정적 HTML 실행의 증거이며, acceptance 9 전체 세부 항목 또는 최종 제품 품질의 포괄 승인이 아니다.

감사자: cloud_setup_sol. 감사 시각: 2026-10-15 14:55 UTC 이후. 이번 단계에서는 수신 원본을 감사했으며 브라우저 검사를 로컬에서 다시 실행하지 않았다. 원격 원본·제품 코드를 수정하거나 원격 게시하지 않았다.

## 1. 고정 원본과 전달 무결성

- 검증 대상 commit: `3847a9b267d43dcc16bd1b999af446ad5cc38c91`
- 대상 파일: `docs/cycles/2026-10-15-mixed-depth-01/canvas-study.html`
- 전달 commit: [`9afe18444d92cf5930e0af5406ad7efce309d7c7`](https://github.com/tlsee0813-cmd/agentflow-studio/commit/9afe18444d92cf5930e0af5406ad7efce309d7c7)
- 전달 경로: [`docs/transfer/ui02-fix3/`](https://github.com/tlsee0813-cmd/agentflow-studio/tree/9afe18444d92cf5930e0af5406ad7efce309d7c7/docs/transfer/ui02-fix3)
- 공유 commit의 변경 파일은 해당 경로의 14개다. 회수된 14개 총 크기 `566,086 bytes`와 보고된 전달 크기가 일치한다. manifest 본체는 `2,100 bytes`; manifest에 열거된 나머지 13개 합계는 `563,986 bytes`다.
- connector의 `fetch_file(encoding=base64, ref=고정commit)`로 받은 원본을 디코딩해 SHA256과 크기를 계산했다. PNG 변환본이나 화면 캡처를 원본 대신 해싱하지 않았다.
- 로컬 감사용 사본: `work/cloud-fix3/raw/`. 내구 증거의 기준은 위 GitHub 고정 commit이다.

| 원본 | 직접 확인한 SHA256 |
|---|---|
| `check.py` | `457b850078129479f4c85f148385122ab6519ba7ec3f7da139f5ad437680ddab` |
| `site/canvas-study.html` | `0aeedd515e7f80f4b091ba1b395f90e0d19355a9eb3ca6c7e1174ad48fa2898c` |
| `evidence/result.json` | `643d389d654d5e39ff5bee423e2f0e066cb190806ece0d3474e87f6bc52b2fc9` |
| `evidence/initial-result.json` | `d7b28f054d20a5903247f8c38b80d7a4a60b913a74e5d0d36f67ee8557a4e58c` |

HTML 해시는 요청된 fix3 바이트 해시와 일치한다. 초기/최종 JSON도 동일한 대상 hash를 기록한다. `check.py`의 commit 문자열은 하드코딩되어 있으므로 Git checkout 절차의 독립 증명으로 쓰지 않았다. 정확한 콘텐츠 식별은 수신 HTML의 바이트 해시 일치로 확인했다. 모든 파일의 해시는 고정 원본 [MANIFEST.json](https://github.com/tlsee0813-cmd/agentflow-studio/blob/9afe18444d92cf5930e0af5406ad7efce309d7c7/docs/transfer/ui02-fix3/MANIFEST.json)에 있다.

[TRANSFER.md](https://github.com/tlsee0813-cmd/agentflow-studio/blob/9afe18444d92cf5930e0af5406ad7efce309d7c7/docs/transfer/ui02-fix3/TRANSFER.md)는 검증 후 승인된 증거 전용 commit/push를 구분한다. 원본 보고서의 ‘소스 commit/push 없음’은 검증 실행 당시의 범위이며, 이후 증거 파일 전달 commit이 없었다는 뜻으로 읽지 않는다. 원본 보고서는 수정하지 않고 보존돼 있다.

## 2. 실제 실행과 수치 대조

기존 `agentflow-studio` setup 세션의 Python Playwright `1.57.0`, 시스템 Chromium `154.0.8037.57`, 실행 경로 `/usr/bin/chromium`을 사용한 기록이다. `ThreadingHTTPServer`로 `site/`를 제공하고 `page.goto(http://127.0.0.1:포트/canvas-study.html)`로 실제 Chromium을 접속시킨다. `set_content` 또는 fetch/DOM 대역은 사용하지 않는다. 전체 제품 앱 설치·빌드나 추가 의존성 설치도 하지 않았다.

- 최종 HTTP URL: `http://127.0.0.1:36387/canvas-study.html`
- 최초 HTTP URL: `http://127.0.0.1:41583/canvas-study.html`
- 최종 HTTP 요청 기록: HTML GET `200` 9회, favicon GET `404` 1회. URL은 종료된 임시 서버의 실행 증거이며 공개 미리보기가 아니다.
- 최종 `pageerrors=[]`; console error 1건은 favicon 404와 맞는다.
- 실행 시각·각 단계 timestamp·각 클릭 전체 이벤트 로그는 JSON에 없다. 전달 commit 시각은 실행 시각으로 대체하지 않는다.

| viewport | S1 그룹 | S2 그룹 | S3 그룹 | 최종 통과/실패 |
|---|---:|---:|---:|---:|
| 1440×900 | 2 | 12 | 12 | 26 / 0 |
| 390×664 | 2 | 14 | 14 | 30 / 0 |
| 390×844 | 2 | 14 | 14 | 30 / 0 |
| 합계 | 6 | 40 | 40 | 86 / 0 |

최종 JSON의 개별 `checks` 86개와 `counts`, 최종 로그의 `{"passed":86,"failed":0}`이 일치한다. 최초 JSON도 86개이며 85/1이다. 이 수는 이 독립 Python 검사기의 그룹 수다. 작성자 검사나 acceptance9 Node 합성 검사 통과 수를 합산하지 않았다. JSON의 viewport 표기는 `new_context(viewport=...)`의 실제 설정과 일치하며, touch/mobile context를 켠 검사는 아니다.

## 3. 요구사항별 확인 범위

아래 ‘관측 확인’은 코드와 저장된 JSON/화면의 일치를 뜻한다. 새로 브라우저를 재실행했다는 의미가 아니다.

| 범위 | 원본에서 확인한 내용 | 한계 |
|---|---|---|
| S1 미래 미결 | 세 viewport에서 전역 `.chip.open`, `open-ref`, `b-open-ref` 부재와 A2 상세의 ‘실패 알림 정책’ 비노출을 assertion | S1의 모든 화면 상태 조합을 탐색한 것은 아님 |
| C: 접힌 A 요약 | S2/S3×3 viewport의 `cv-open` 실제 클릭→A2→복귀. JSON 6개 모두 ‘A2 소유 미결 1건 · 실패 알림 정책’ text, full/hit=true. 복귀 시 overview snapshot 일치 | 별도 `cv-chg` 결정 변경 참조의 존재·문구·별도 요소 여부를 assertion하지 않음. 1440 S2 PNG에서는 별도 결정 변경과 미결 참조가 함께 보임. S3 C 결정 변경의 별도 런타임 관측은 누락 |
| L1: 접힌 A 실제 끝점 목록 | S2/S3×3 viewport에서 `cv-list`로 목록을 연 뒤 `cl-A2`의 ‘결정 변경 1 / 미결 1 / 소유 A2’와 개별 `.chg`, `.open` 표시·hit 검사를 하고 실제 A2 클릭/복귀. overview snapshot 비교 | 이 코드의 비전파 검사와 결합해 A4/A6의 모든 목록 행까지 assertion했다고 확대하면 안 됨 |
| L2: B 끝점 A2 행 | S2/S3×3 viewport의 `ins-ep-A2`에 동일 지역 배지와 실제 A2 클릭/복귀, B 선택 복원 | A4/A6 끝점행 배지 부재의 전수 assertion은 없음 |
| L3: 390 관계 행 | 두 높이 S2/S3에서 `ol-rel-A2` 지역 배지·클릭/복귀, `ol-rel-A6` full/hit 및 실제 클릭/복귀. 일반 `ol-A2`와 구분됨 | 관계 A4 행의 비전파를 별도 assertion하지 않음 |
| B 미결 직접 이동 | S2/S3×3 viewport에서 `ins-bopen`의 ‘소유 A2’와 저장된 정책명 확인, 클릭→A2→B 복귀 및 snapshot 비교. L2 경유를 대체 동작으로 사용하지 않음 | 정책명 중복 횟수, B 소유 오표현 전역 부재를 별도 assertion하지 않음 |
| A4/A6 비전파 | S2/S3×3 viewport에서 각 상세의 `.chip.open` 0개, 상세 헤더 `.ins-tags .chg` 0개 assertion | 카드·C 내부 각 끝점행·B 끝점행·L3 각 행 전체의 미결/변경 부재는 assertion 범위 밖. S2 대표 PNG에서는 해당 행에 A2 배지만 있고 A4/A6에는 없는 모습 관찰 |
| 관계 3개 | S2/S3 각 실행의 전/후 `path[data-state="confirmed"]` 개수 3 assertion | 이 assertion은 정확한 edge ID 집합을 비교하지 않음. PNG에서는 A2/A4/A6–B 표기가 보임 |
| A4→A2→B→A2→A4 | 여섯 실행에서 실제 버튼 클릭과 각 `data-sel`, 최종 `data-overview` snapshot 일치 | snapshot은 선택·펼침·목록·캔버스 x/y/배율이며 inspector DOM scroll이나 전체 앱 상태를 모두 포함하지 않음 |
| 가로 넘침·표시 | 각 실행 전/후 document scrollWidth≤innerWidth, 대상 컨트롤의 viewport/overflow ancestor clipping bounds, full/hit 및 scrollWidth 검사를 수행 | 모든 텍스트/조작 요소 전수 검사가 아니며 helper가 먼저 DOM 스크롤함 |

따라서 L1/L2/L3/B의 실제 브라우저 지역 참조와 클릭/복귀 증거는 확보되었다. C 결정 변경의 별도 assertion 및 전 지역 A4/A6 비전파까지 모두 독립 브라우저로 검증했다고 선언할 근거는 부족하다. 합성 Node 검사에 그 검사가 있어도 이번 브라우저 미관측을 소급하여 채우지 않는다.

## 4. 최초 실패와 최종 helper의 한계

최초 완주 기록의 유일한 실패는 `390x664/S3/A4-A2-B-back-A2-back-A4`다. 오류는 A2→B 버튼의 rect가 전체 clipping bounds 안에 있으나 `hit=false`였음을 기록한다. sticky inspector header가 가렸다는 설명은 원격 보고에 있고, 최초 JSON 자체는 가린 요소의 정체나 `elementFromPoint` 대상 노드를 기록하지 않는다.

최종 `shown()`은 `scroll_into_view_if_needed()` 후 hit=false일 때 한 번 `scrollIntoView({block:'end'})`를 적용하고 다시 full/hit·가로 크기를 검사한다. 그 뒤 Playwright 실제 click을 한다. 제품 HTML을 바꾸거나 assertion을 삭제하지는 않는다. 이는 추가 DOM 스크롤 후 조작 가능성의 증거이며, sticky header 가림이 모든 위치에서 해소됐거나 일반 사용자가 같은 동작을 쉽게 찾는다는 증거는 아니다.

초기 JSON/로그는 원본으로 남았지만 **최초 harness 코드 스냅샷은 보존되지 않았다.** 최초→최종 코드 diff와 개발 중 중단된 실행은 원본으로 감사할 수 없다. 최종 chain 함수가 각 helper 반환값을 버려, 해당 경로의 최종 fallback 사용 지점·횟수도 JSON에 모두 남지 않는다.

검증기 재사용 위험도 확인했다. 원본 `finally`의 `sys.exit(1 if failed or errors else 0)`는 `run()` 밖의 setup/navigation 예외를 별도 실패로 기록하지 않고 기존 실패/페이지오류가 없으면 exit 0으로 덮을 수 있다. **이번 기록에는 예상 그룹 86개와 9개 HTML GET이 모두 있으므로 이 결함으로 조기중단이 통과로 기록됐다는 정황은 없다.** 다만 원본 exit code 하나로 성공 판정하는 재사용은 부적절하다. 원본을 보존한 별도 `check.hardened.py`의 fatal 기록·완주 검사 및 실제 subprocess 정상/음성 실행에 대한 추가 감사를 완료했다. 결과는 8절에 분리했다.

## 5. 실제 스크롤 관측과 입력 방식

목록 위치는 DOM `scrollTop=120`으로 설정했다. 실제 Chromium 레이아웃에서 clamp된 위치와 탭 왕복 후 복원을 비교한다. 물리 휠·터치 입력 검증이 아니다.

| viewport / scene | 요청 | actual / max | 상세 탭 왕복 후 |
|---|---:|---:|---:|
| 390×664 / S2 | 120 | 120 / 254 | 120 |
| 390×664 / S3 | 120 | 120 / 302 | 120 |
| 390×844 / S2 | 120 | 74 / 74 | 74 |
| 390×844 / S3 | 120 | 120 / 122 | 120 |

L3 A2 클릭→A2 상세→복귀→구조 목록의 별도 `scrollBefore/After`는 순서대로 `254→254`, `232→232`, `0→0`, `0→0`이다. 390×844 S2의 요청120은 실제 최대74로 clamp되며 실패로 꾸미거나120으로 보고하지 않았다. S2↔S3 장면 간 스크롤 분리, 휠/터치로 하단 도달, 스크롤값을 설정한 직후 A4 중첩 왕복까지 이어서 복원하는 결합 경로는 이 코드에서 검사하지 않는다.

## 6. 원본 PNG 5장 직접 열람

다섯 PNG 모두 원본 바이트 해시를 확인한 후 `view_image`로 열었다. 전부 S2 대표 화면이다. S3 시각 품질은 JSON의 대상 geometry/hit 관측 범위를 넘겨 대표 PNG로 주장하지 않는다.

| 고정 원본 PNG | 크기 | 직접 확인한 화면 |
|---|---:|---|
| [1440-L1.png](https://github.com/tlsee0813-cmd/agentflow-studio/blob/9afe18444d92cf5930e0af5406ad7efce309d7c7/docs/transfer/ui02-fix3/evidence/1440-L1.png) | 1440×900 | 접힌 A의 ‘연결된 하위 3곳’ 목록이 열림. A2 행의 결정 변경·A2 소유 미결, A4/A6 행, 아래 별도 C 결정 변경·미결 참조가 함께 보임. 필수 L1 증거 충족 |
| [1440-B-open.png](https://github.com/tlsee0813-cmd/agentflow-studio/blob/9afe18444d92cf5930e0af5406ad7efce309d7c7/docs/transfer/ui02-fix3/evidence/1440-B-open.png) | 1440×900 | B 선택, B 실제 끝점 A2 배지, 별도 미결 참조 버튼과 소유 A2 표시 |
| [390x664-L3-A2.png](https://github.com/tlsee0813-cmd/agentflow-studio/blob/9afe18444d92cf5930e0af5406ad7efce309d7c7/docs/transfer/ui02-fix3/evidence/390x664-L3-A2.png) | 390×664 | 구조 목록 하단 관계 A2/A4/A6까지 완전히 보임. A2만 결정 변경·A2 소유 미결 배지. 하단 A6 확인에는 이 화면이 가장 명료 |
| [390x844-L3-A6.png](https://github.com/tlsee0813-cmd/agentflow-studio/blob/9afe18444d92cf5930e0af5406ad7efce309d7c7/docs/transfer/ui02-fix3/evidence/390x844-L3-A6.png) | 390×844 | 구조 A6와 관계 A2/A4/A6가 보이나 관계 A6 행은 viewport 하단에 매우 가까움. JSON rect y806.734375+h37=843.734375, full/hit=true. 여유 있는 하단 배치라고 확대하지 않음 |
| [390x664-B-open.png](https://github.com/tlsee0813-cmd/agentflow-studio/blob/9afe18444d92cf5930e0af5406ad7efce309d7c7/docs/transfer/ui02-fix3/evidence/390x664-B-open.png) | 390×664 | B 상세의 끝점 A2 및 별도 미결 버튼이 보임. inspector가 아래로 스크롤된 상태이며 위 섹션 일부가 header 아래로 가려져 있음. 전체 상세가 동시에 무가림이라는 증거는 아님 |

기존 작성자 summary-only PNG를 L1 열린 목록 증거로 재사용하지 않았다. 대표 화면은 읽을 수 있는 배지와 별도 미결 소유 표시를 보이나, 레이아웃의 넓은 여백·고정 header·읽기 흐름이 실제 사용자에게 좋은지는 이 검사에서 판정하지 않았다.

## 7. 최종 판정과 남은 범위

원본 전달 무결성, 정확한 HTML 해시, 실제 Chromium→HTTP 실행 방식, 최종 86개 기록과 최초85/1 보존, L1/L2/L3/B의 지정 지역 참조와 실제 클릭/복귀는 **증거 감사 완료**다. 원본 결과를 ‘모든 세부 요구사항/사용성 검사 완료’로 확장하지 않고 3·4·5절의 누락을 유지한다.

- 환경의 게시 완료는 보조 운영자가 setup UI에서 직접 확인했던 사실이다. 이번 브라우저 검사와 분리한다. **게시된 환경으로 새 Cloud 작업 복원은 미실행**이다.
- 일반 휠·터치 입력, 전체 키보드/스크린리더 접근성, 실제 사람 사용성, 전체 제품 빌드/회귀, 실제 AI 호출·인계·수신·수락은 미실행이다.
- 초기 harness 코드, 개발 중 중단 로그, per-step timestamp·전체 action log는 미보존/미제공이다.
- C 별도 결정 변경 assertion, 모든 지역의 A4/A6 비전파, 정확 edge ID 집합, 장면 간 스크롤 분리·복합 스크롤 경로는 이번 cloud 코드의 검사 범위가 아니다.
- 원본 검증기의 fatal 예외 종료코드 위험은 역사적 한계로 남긴다. 별도 hardened 검증기의 보완·음성 실행 감사는 8절에서 완료했으며 기존 원본이나 이전 결과를 덮어쓰지 않았다.

원본 읽기 링크: [실행 코드](https://github.com/tlsee0813-cmd/agentflow-studio/blob/9afe18444d92cf5930e0af5406ad7efce309d7c7/docs/transfer/ui02-fix3/check.py), [최종 JSON](https://github.com/tlsee0813-cmd/agentflow-studio/blob/9afe18444d92cf5930e0af5406ad7efce309d7c7/docs/transfer/ui02-fix3/evidence/result.json), [최초 JSON](https://github.com/tlsee0813-cmd/agentflow-studio/blob/9afe18444d92cf5930e0af5406ad7efce309d7c7/docs/transfer/ui02-fix3/evidence/initial-result.json), [원본 보고서](https://github.com/tlsee0813-cmd/agentflow-studio/blob/9afe18444d92cf5930e0af5406ad7efce309d7c7/docs/transfer/ui02-fix3/REPORT.md).

## 8. 별도 검증기 hardening 추가 감사 — 완료

추가 공유 commit: [`b03f908c9a1ac23b56218d0fccc43fa3747fe061`](https://github.com/tlsee0813-cmd/agentflow-studio/commit/b03f908c9a1ac23b56218d0fccc43fa3747fe061). 2026-10-16 KST에 추가 코드·manifest·정상/음성 JSON·프로세스 로그·driver를 connector로 읽어 감사했다. 새 브라우저 테스트나 PNG 시각 감사를 수행하지 않았다. 임시 사본은 `work/cloud-fix3/raw-hardening/`이다.

고정 원본 commit→추가 commit 비교는 `ahead_by=1`, 추가 파일15개만 반환한다. 기존 `check.py`, 원본 `evidence/`, `REPORT.md`, `MANIFEST.json`, `site/canvas-study.html`을 포함한 원본14개는 이 commit에서 수정되지 않았다. 새 파일은 `check.hardened.py`와 `evidence-hardening/` 아래에 분리돼 있다.

manifest 본체와 추가 비PNG 파일8개를 회수했다. 해당 8개의 바이트수·SHA256은 [MANIFEST.hardening.json](https://github.com/tlsee0813-cmd/agentflow-studio/blob/b03f908c9a1ac23b56218d0fccc43fa3747fe061/docs/transfer/ui02-fix3/evidence-hardening/MANIFEST.hardening.json)과 모두 일치한다. 새 PNG6개는 이번 추가 감사에서 회수·해시·시각 검사를 하지 않았으며, 이 절의 판정에 사용하지 않았다.

| 추가 원본 | 직접 확인한 SHA256 |
|---|---|
| `check.hardened.py` | `70fc8cb54f380c4a7b58f5255e10f4c8ef28c10457359570ed6dcc83926c6dce` |
| `evidence-hardening/normal/result.json` | `70cc8d403ddcb710e5ceb1c0a9b7a6d8b841e0c42be46145c1e6b5f672eafe2a` |
| `evidence-hardening/probe/result.json` | `f2a8548f8aeec78dbcb0d16c1dd3bce7e77e3da7ac124b08b5e9b860620ae3ac` |
| `evidence-hardening/process-results.json` | `be06c47b264086e7b3ef692d716f77b8892501cb9cf00fdd5ff84e16cd10e606` |

### 보완 코드 범위

원본과 hardened의 `def run`부터 browser 실행 직전까지 helper 본문, `with sync_playwright`부터 browser.close까지 브라우저 검사 루프를 문자열로 비교했고 각각 동일했다. 정상 JSON의 검사명86개 순서도 원본과 동일하다. 제품 UI assertion이나 coverage를 바꾸어 수치를 통과시킨 보완이 아니다. C 결정 별도 assertion 누락, A4/A6 상세 한정 비전파 검사, DOM 스크롤 사용과 나머지 3~7절 제한은 그대로 남는다.

새 코드에서는 guarded configuration 단계 안에서 HTML hash 확인·Playwright import·HTTP 서버·브라우저 실행을 수행하며, `except BaseException`이 fatal의 type/message/phase/traceback을 기록한다. `finally`에서는 서버 cleanup만 수행하고 실패를 `cleanup_errors`에 기록한다. `sys.exit`는 finally 밖에 있고 fatal·cleanup error·검사 실패·pageerror·실행수≠86 중 하나라도 있으면1을 선택한다. 따라서 원본의 ‘검사 전 예외가 finally의 exit0에 덮임’ 경로는 hardened 코드에서 제거됐다.

argparse·출력 폴더 생성 등 guarded 구역 전 오류와 최종 JSON 쓰기 자체의 오류는 자연스러운 Python nonzero로 끝날 수 있으나 구조화 JSON 저장은 보장하지 않는다. 모든 OS/저장소 실패가 JSON에 남는다고 확대하지 않는다.

### 정상/의도적 시작 예외의 별도 프로세스 기록

[run-validation.py](https://github.com/tlsee0813-cmd/agentflow-studio/blob/b03f908c9a1ac23b56218d0fccc43fa3747fe061/docs/transfer/ui02-fix3/evidence-hardening/run-validation.py)는 정상과 `--probe-fatal`을 각각 새 subprocess로 실행하고 실제 `returncode`를 수집한다. 이 외부 관측을 checker JSON의 `exit_code`와 대조했다.

| 실행 | 실제 subprocess 종료코드 | JSON/로그 관측 | 감사 판정 |
|---|---:|---|---|
| normal | 0 | 86개 실행·86통과·0실패, expected86, complete=true, fatal=null, cleanup_errors=[], pageerrors=[] | 코드·JSON·로그·외부 returncode 일치 |
| `--probe-fatal` | 1 | configuration 단계의 의도적 RuntimeError, checks0, counts0/0, complete=false, fatal 기록, cleanup_errors=[], HTTP 요청0, actualHTTPURL=null, chromium=null | 검사실패0·pageerror0이어도 시작 예외가 nonzero로 보고됨 |

정상 실행은 같은 HTML hash `0aeedd…2898c`, Playwright1.57.0·Chromium154.0.8037.57, 실제 URL `http://127.0.0.1:40583/canvas-study.html`을 기록한다. 86개 그룹 배분도 2절과 동일하다. 음성 probe는 서버/브라우저/검사를 시작하기 전에 발생하며, JSON의 하드코딩된 `viewports`·`transport` 설명을 실제 브라우저 실행 증거로 세지 않았다. probe의 URL/hash/browser 값은 null이고 HTTP 요청과 checks는 비어 있다.

이는 정상 완주와 명시적인 configuration RuntimeError 한 종류를 실제 별도 프로세스에서 확인한 결과다. hash mismatch, 브라우저 실행 실패, cleanup 실패, fatal 없는 단독 검사수 부족 등을 각각 주입한 추가 음성 테스트는 없다. 검사수 guard 자체는 코드에서 확인했지만 이번 probe는 fatal과 미완주가 함께 발생하므로 두 조건을 독립적으로 실험한 것으로 세지 않는다.

전달된 driver는 실행 당시 `/workspace/browser-env/hardening`에 있던 원본을 `evidence-hardening/run-validation.py`에 보존한 것이다. 현재 저장 위치에서 그대로 실행하면 driver의 `root`가 한 단계 깊어지므로, 재사용 시 [README](https://github.com/tlsee0813-cmd/agentflow-studio/blob/b03f908c9a1ac23b56218d0fccc43fa3747fe061/docs/transfer/ui02-fix3/evidence-hardening/README.md)의 안내대로 root를 부모로 조정해야 한다. 이 전달 위치 차이를 제품/브라우저 검사 실패로 분류하지 않는다.

추가 판정: **검증기 fatal 처리 보완과 명시적 시작 예외 nonzero의 증거 감사 완료.** 원본85/1→86/0 이력·최초 harness 미보존·sticky header 및 DOM 스크롤 제한은 보존한다. UI 요구사항 coverage가 추가로 넓어졌거나 휠/터치·새 Cloud 작업 복원이 검증된 것은 아니다.

고정 추가 근거: [hardened 코드](https://github.com/tlsee0813-cmd/agentflow-studio/blob/b03f908c9a1ac23b56218d0fccc43fa3747fe061/docs/transfer/ui02-fix3/check.hardened.py), [정상 JSON](https://github.com/tlsee0813-cmd/agentflow-studio/blob/b03f908c9a1ac23b56218d0fccc43fa3747fe061/docs/transfer/ui02-fix3/evidence-hardening/normal/result.json), [probe JSON](https://github.com/tlsee0813-cmd/agentflow-studio/blob/b03f908c9a1ac23b56218d0fccc43fa3747fe061/docs/transfer/ui02-fix3/evidence-hardening/probe/result.json), [외부 프로세스 결과](https://github.com/tlsee0813-cmd/agentflow-studio/blob/b03f908c9a1ac23b56218d0fccc43fa3747fe061/docs/transfer/ui02-fix3/evidence-hardening/process-results.json).
