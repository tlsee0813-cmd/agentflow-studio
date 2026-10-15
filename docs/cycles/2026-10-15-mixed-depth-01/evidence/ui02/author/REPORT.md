# UI-02 작성자 증거 보관

2026-10-15. 작성자의 `/mnt/data` 실행환경에서 생성되어 전달된 결과를 보관한다. 이 경로는 작성자의 원래 환경이며 현재 로컬 작업공간이나 앞선 ChatGPT Work 클라우드 검사 환경을 뜻하지 않는다. 원본 테스트·로그를 수정하거나 재실행하지 않았다.

- 대상: `canvas-study.html` (원본과 사이클 내 복사본 해시 일치).
- HTML SHA256: `D0F3B7D378563B620AAA0EBFEC34397F416B5D62B8D2F9D14DF576B4F507840A`.
- 작성자 상태 검사 로그: jsdom 24 / Node 22, **84 PASS, 0 FAIL**. 렌더링 검사는 아니다.
- 작성자 렌더 검사 로그: Playwright 1.56.0 / Chromium 1194, **37 PASS, 0 FAIL**. 1440×900 및 390×844를 포함한다. 다만 `tests/render_check.py:97`의 `ok(True, …)` 안내 1행도 PASS에 포함된다. 이를 37개의 실질 검증으로 간주하지 않으며, 테스트의 타당성 및 화면에 대한 **독립 검토는 미완료**다.
- 실제 PNG는 **13개**다(1440 접두사 10개, 390 접두사 3개). 작성자의 14개 주장을 정정한다. PNG는 저장소에 복사하지 않고 아래 ZIP에 보존한다.

보관 파일은 원본 `tests/check_canvas.js`, `tests/render_check.py`, `outputs/state_check_jsdom.txt`, `outputs/render_check_chromium.txt` 4개이며 복사 전후 SHA256이 모두 일치한다. 원래 `tests/RUN.txt` 실행 안내도 ZIP에 남아 있다. 여기서 수행한 독립 확인은 파일 해시·파일 수·로그 및 위 안내 항목 확인이며, 브라우저 재실행이나 UI 독립 검증 완료를 의미하지 않는다.

사용자용 원본 묶음: 로컬 작업공간의 `outputs/AgentFlow_UI02_Research.zip`.

ZIP SHA256: `6EBDC414DB88D481463445C90EA7A82669F6801A7263E60A53FC84C07725C8D6`.

보존 안내: 위 해시는 초도 원본 `ui02_canvas_study.zip`의 해시다. 현재 사용자 출력 `outputs/AgentFlow_UI02_Research.zip`은 fix1으로 갱신되었으며, 현재 해시와 증거는 `../author-fixed/REPORT.md`를 따른다. 위 초도 검사 결과는 과거 근거로 유지한다.

이 HTML은 UI-02 연구 시안이며 `347465e`의 `prototype.html`과 별도다. 작성자 실행 증거를 앞선 클라우드 브라우저 실행환경의 복구 증거로 사용하지 않는다. 제품 소스 및 원격 저장소는 변경하지 않았다.
