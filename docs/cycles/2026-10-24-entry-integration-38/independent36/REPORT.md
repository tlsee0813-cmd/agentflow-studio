# 36 fix2 독립 검증 — 2026-10-24

결론: 정확 `38beb55922e3e982f0f32fddacd5e18a5e157a15`의 좁은 코드·현재 Windows 실행·양PC 화면에서 수용을 막는 새 결함을 찾지 못했다. 37 결합의 수용 판단이 아니다. 작성자와 분리한 로컬 담당이 실행했고, 제품 소스를 수정·커밋·push하지 않았다.

## 환경과 실행

- worktree: `work/product36-independent-20261024`, detached exact SHA, 실행 후 git status clean. 원본 `product-handoff-20261024`도 clean 유지.
- Windows NT 10.0.26200.0; 지정 경로 Node **v24.19.0**; bundled Python 3.12.14; pnpm 11.25.0; TypeScript 5.8.3; Playwright 1.57.0; 기존 설치 Chrome 155.0.8059.85.
- 인계/CI의 Node22.16.0·Python3.13.5·Chromium143 환경과 일치하지 않는다. Node 지정 경로의 실제 버전을 기록했으며 버전을 조작하지 않았다.
- pnpm install --ignore-scripts --lockfile=false --no-frozen-lockfile: exit0, 엔진 불일치 warning. npm ci 실행 증거가 아니다. Python 브라우저 의존성은 제품 밖 증거 디렉터리에 --target 설치(exit0).
- 직접 localhost HTTP→제품 MOCK 서버 및 native localStorage/WebLocks·정상 복구/결과 파일 선택 경로. DOM bridge·저장소/제품 상태 주입 없음. 유료 AI 호출 없음. 현재 로컬 실행에서 승인 거절 없음. 테스트 서버는 각 harness가 정상 종료했다.

| 실행 | 결과 / exit |
|---|---|
| root scripts/build.mjs | 통과 / 0 (tool transcript) |
| continuity/scripts/check.mjs | 통과 / 0 (tool transcript) |
| continuity/scripts/build.mjs | 통과 / 0 (tool transcript) |
| map-priority36.test.mjs | 4/4 / 0 |
| map-priority36_browser.py | 12/12 / 0 |
| branch-records31_browser.py | 10/10 / 0 |
| hierarchy18_browser.py | 12/12 / 0 |
| 독립 이유/구상 측정 probe | 양PC 2/2 / 0 |

독립 probe 최초에는 1280의 계산값29.999990859와30을 exact equality로 비교해 한 건 실패했다. float 오차를 소수점3자리 비교로 수정한 뒤 재실행 통과했다. 제품 코드를 바꾸거나 가림 허용 기준을 낮춘 수정이 아니다. 같은 probe의 확대 캡처는 최종본에서 정상 빈캔버스 드래그로 고정 컨트롤 아래로 옮겼다.

## 코드 대조와 화면 관측

- fix2 자체는 CSS의 `.branch-signals>span {white-space:nowrap}` 제거와 부모 줄의 `word-break:keep-all` 추가다. 문구·순서·글자 크기·카드180px·좌표를 바꾸지 않았다.
- 후보 전체의 `readingReasons`는 기존 subtreeSignals 소유 범위를 재사용한다. active && !answered 질문, 보류·이전 기준·이번 탭 집합을 존재로 집계하며 관계를 소속으로 섞지 않는다. fix1 reports-only 말단/부모 입구도 테스트와 현재 실행에서 확인했다.
- PC1280×720/1440×900의 부모 현재작업+이번탭갱신+긴이름+네이유+구상 있음/미기재 장면을 포함해 카드·clip 내부 및 중심 hit 검사가 통과했다. 정확 기록 집합·소유·상세 수량·초점 복귀·저장자료 불변도 확인했다.
- 실제 기본 화면 PNG를 직접 열어 확인했다. 기본맞춤은 1280 약56%, 1440 약85%. 네이유와 하위포함을 포함한 이유 줄은 2줄이며, 구상 본문은2줄이고 부가 줄에 밀려 잘리지 않는다. 별도 확대 PNG에서도 이유·구상을 읽었다. 확대 판독을 기본맞춤 가독성 성공으로 세지 않는다.
- 양PC 독립 측정(layout px): 본문104, 이유28, 구상30, 구상 아래 여유 약4. 기본1280 `scale=.55645`, 1440 `.84677`. JSON에 실제 rect·문구·computed wrap style 기록.

## 수용 시 남는 위험 / 미실행

- 1280 기본56%에서는 이유 글씨가 화면 약6px로 매우 작다. 긴 이름3줄·구상2줄 밖 원문과 한 줄 소속은 의도한 clamp가 남는다. 특히 긴 동일접두어 부모 식별 한계는 해결되지 않았다.
- 남은 여유4px이고 이유 줄 수는 글꼴 폭에 여전히 의존한다. 임의 글꼴·125% 브라우저·모바일·대형지도·실제 OS IME·다른탭 live·사람 사용성·AI 의미 품질을 검증한 결과가 아니다.
- 전체 루트/continuity 단위검사와 나머지 브라우저군은 이번 좁은 검토에서 재실행하지 않았다. 과거 CI를 현재 화면 실행으로 대체하지 않았다. CI/Actions는 조회하지 않았다(총괄 Code Review 담당과 분리).
- 37의 반환20bffe5f 및 아직 작성중인 최종결합은 실행하지 않았다. 최종 SHA 회수 후 first home→비저장 예제→부분/작업→이어가기→지도복귀→예제닫기→내프로젝트시작을 양PC에서 수행한다. 특히 복귀 후 실제 지도 가용 높이와 하단2카드 노출을 판정하고, 카메라 좌표 일치만으로 통과시키지 않는다. 예제 비저장·실제 목록/지도기억12칸 오염·예제 ID/작업문 유출·초안/재방문 복원도 그때 확인해야 한다.

## 최소 증거

`minimal/`은 GitHub로 복사 가능한 공유용 사본이다. 네PNG, 환경/geometry2개, 간단한 실행 로그4개, 독립 probe, SHA256 manifest가 있다. recovery JSON·의존성·전체 observation JSONL은 로컬 raw에만 남겼다. 아직 GitHub 공유/업로드한 결과가 아니다.

산출물 SHA256:
- app.js `89695dd58162ab27c018aa521870734eb08c5d5496e3f695ccd66d34bca1f762`
- styles.css `0affbb51999412d5d9a0fc2de9636d25afc01086d09b10de4ee52ec407c8c1a4`
- attention.js `55182121cccdf9d54bd8bcb8626d559a199192501386a718a9adb3696198950c`
