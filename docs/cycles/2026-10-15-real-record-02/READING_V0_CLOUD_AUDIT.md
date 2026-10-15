# reading-v0 Cloud preflight 원본 감사

2026-10-16 · **닫힘 렌더링 결함 재현 근거 확인 / 원본 시각 일치 확인·감사자의 시각 오판 정정**

고정 [공유 commit `7e793920…aa7b`](https://github.com/tlsee0813-cmd/agentflow-studio/commit/7e79392080157be693429da40d54c2a206b8aa7b)의 `docs/transfer/real-record-02/v0-preflight/` 7파일을 GitHub connector로 읽었다. `fetch_file(encoding=base64, ref=정확commit)` 결과를 원본 바이트로 디코딩해 임시 사본에 보관하고, PNG는 `view_image(detail=original)`로 직접 열었다. **이번 감사자는 브라우저를 재실행하지 않았다.** CUA로 화면을 조작했다고 보고하지 않는다. 임시 회수 위치는 `work/reading-v0-preflight-audit/raw/`이며 내구 근거는 고정 GitHub 원본이다.

## 무결성·변경 범위

- 해당 commit 자체의 변경 파일은 위 전달 경로의 7개뿐이다. 작성자 원본 commit과 전달 branch는 분기되어 있어 두 SHA의 단순 비교에 나타나는 과거 UI02 증거 추가를 이번 commit의 변경으로 오인하지 않았다.
- [MANIFEST.json](https://github.com/tlsee0813-cmd/agentflow-studio/blob/7e79392080157be693429da40d54c2a206b8aa7b/docs/transfer/real-record-02/v0-preflight/MANIFEST.json)이 열거한 6파일의 bytes·SHA256은 모두 직접 계산값과 일치한다. manifest 본체는 자기 자신을 열거하지 않는다.
- 원본 HTML도 작성자 commit `4b396e8da9e01e3f9e3b2068c6d76d17848ffb3a`에서 connector로 별도 회수했다. SHA256은 요청값 `500e0021045ae035beca9244d2f7ee59b048f969137777cf3e766655005c9da0`과 일치하며 검사 코드의 시작 hash assertion·JSON 값과 같다. HTML은 전달 패키지에 중복 수록되지 않았다.
- 검사 코드 SHA256: `16d699d65804a377af292c484e2e3455fe9b603d188853e81fa7beee01fed19f`; PNG SHA256: `602c2e0b2e2c38b033c29b9b79de62bc54a6468eff73c7f41a15d3a0652a3784`.

## 실제 검사 순서와 결과

[reproduce.py](https://github.com/tlsee0813-cmd/agentflow-studio/blob/7e79392080157be693429da40d54c2a206b8aa7b/docs/transfer/real-record-02/v0-preflight/reproduce.py)는 기존 Playwright1.57.0·`/usr/bin/chromium`154.0.8037.57로 임시 HTTP에 실제 접속한다. 각 1280×720/1440×900에서 초기 DOM/computed/box 관측→정상 `locator.click('#ab-f14')`→열림 관측→실제 `#pvClose` 클릭→닫힘 관측 순서다. 직접 앱 핸들러 호출, set_content, 외부 스텁, 원본 HTML 변경은 이 코드에 없다. locator의 내장 스크롤 가능성은 물리 휠 입력 검사로 세지 않는다.

실제 URL은 `http://127.0.0.1:40891/reading-study.html`; 문서 GET200 두 번이 기록됐다. pageerrors는 비어 있고, console resource error1건은 favicon404와 대응한다. 최초/열림/닫힘 각 표시 검사와 초점·HTTP 검사를 직접 집계하면 **10그룹 중 6통과/4실패**다. 실패는 두 viewport의 initial/closed 렌더 상태다.

| viewport | 초기 body | 실제 닫기 후 body | 닫기 버튼/초점 |
|---|---|---|---|
| 1280×720 | hidden=true, display=flex, 358×118.5 | hidden=true, display=flex, 358×436.40625, visible/hit=true | 버튼 visible/hit=true, 초점 ab-f14 |
| 1440×900 | hidden=true, display=flex, 358×118.5 | hidden=true, display=flex, 358×616.40625, visible/hit=true | 버튼 visible/hit=true, 초점 ab-f14 |

[원본 PNG](https://github.com/tlsee0813-cmd/agentflow-studio/blob/7e79392080157be693429da40d54c2a206b8aa7b/docs/transfer/real-record-02/v0-preflight/1440x900-after-close.png)에서 빈자리 안내와 이전 E09 제목·닫기 버튼·본문이 동시에 보인다. 즉 **초점 복귀는 성공했지만 미리보기는 실제로 닫히지 않았다.** hidden 속성만으로 닫힘을 판정한 작성자 검사의 한계와 구분되며, 작성자203 전부가 실패했다는 뜻은 아니다.

`fatal=null`, JSON exit_code1, run.log의6/4·exit1, [process-exit.json](https://github.com/tlsee0813-cmd/agentflow-studio/blob/7e79392080157be693429da40d54c2a206b8aa7b/docs/transfer/real-record-02/v0-preflight/process-exit.json)의 실제 subprocess exit1이 일치한다. 코드도 fatal/cleanup/pageerror/검사실패/10개 미완주에서 nonzero를 선택하며 finally에서 exit0으로 덮지 않는다. 별도 process 측정 driver는 패키지에 없어 그 구현 자체나 새로운 fatal 주입은 감사하지 않았다. 이 실행은 제품 동작 FAIL이며 실행 fatal이 아니다.

## 시각 감사 오류 정정·범위

**정정:** 앞선 ‘코드는 UTC, 원본 JSON은+09’라는 감사 지적은 잘못됐다. 최초 회수한 raw파일을 날짜 파싱 없이 직접 읽고, 같은 고정 commit의 GitHub UTF-8 본문과 새 base64 원본 디코드 사본을 다시 대조했다. 모두 started_at=`2026-10-15T16:09:04.344441+00:00`, finished_at=`2026-10-15T16:09:07.831683+00:00`이며 코드의 UTC 출력과 일치한다. 기존 raw·새 디코드 사본의 SHA256도 모두 `3951b1cee0ef36a4934f25ec7abf77c2470d89124db8dcfe85c178a2f5858147`로 같다. +09 시각은 감사자가 `ConvertFrom-Json | Select-Object | ConvertTo-Json`으로 날짜를 파싱·재출력한 관측 표시에서 생겼다. 이를 원문 변경으로 오인한 감사자의 오류이며 Cloud 원본·전달 사본의 불일치가 아니다. 관련 불일치 주장과 Cloud 설명 요청을 철회한다. 원본은 변경하지 않았으며 이 사안의 재실행은 필요 없다. 이후 원본 시각 대조에는 파싱·재직렬화를 사용하지 않는다. 이 정정은 box/PNG·실제 클릭·6/4·종료코드에 근거한 닫힘 결함 판정을 바꾸지 않는다.

이번 범위는 **A의 E09 버튼 클릭과 닫기 버튼, 두 넓은 viewport의 초기/열림/닫힘뿐**이다. B, Escape, 390 두 높이, 미리보기/본문 wheel, A/B전환·선택복귀·원문 GitHub 왕복, 작성자203 전체, fix1, 사람 읽기·이해도는 미실행이다. 독립 결함 재현을 기존 입력 E10 당시의 사실로 소급하지 않는다. 다음 수정본은 정확한 새 commit/hash로 예정된 Cloud 본검사를 수행하며 v0 결과를 덮어쓰지 않는다. 새 검사·환경 변경·원격 쓰기는 하지 않았다.
