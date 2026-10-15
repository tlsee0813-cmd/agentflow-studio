# reading-v0 narrow independent preflight

Target commit: 4b396e8da9e01e3f9e3b2068c6d76d17848ffb3a; docs/cycles/2026-10-15-real-record-02/reading-v0/reading-study.html. Original SHA256 matched 500e0021045ae035beca9244d2f7ee59b048f969137777cf3e766655005c9da0. Original HTML was served unchanged by a temporary local HTTP server; it is not duplicated in this transfer.

Existing system Chromium 154.0.8037.57 at /usr/bin/chromium and Python Playwright 1.57.0. No installation/environment settings/publication changes. Real browser navigation and actual locator clicks #ab-f14 then #pvClose. No set_content/fetch bridge, whole 203-check author suite, expanded A/B suite, external-source stub or human-reading evaluation. No product/source fix or fix1 test.

Reproduced at both 1280x720 and 1440x900. Initial pvBody.hidden=true but computed display:flex, visible body box and clickable/visible close button. Open state renders E09 and focuses pvH. After actual close click, pvBody.hidden=true but display:flex persists, body has a visible/hittable box, old E09 contents and close button remain alongside pvEmpty. Focus correctly returns to ab-f14. The 1440x900 after-close PNG was opened for inspection and shows the empty instruction and retained E09 panel concurrently.

Result: 10 narrow check groups, 6 passed / 4 failed (initial and closed rendering at both sizes). Actual child-process exit 1, fatal=null, pageerrors=[]. Both document navigations HTTP 200. Console resource error for favicon 404 is retained. Expected v0 application defect, not execution fatal. Exact URL, timestamps, all stage DOM hidden/computed style/boxes/visibility/hit/focus/text, browser version, console and HTTP log are in result.json. Process-exit.json independently records actual subprocess exit; run.log captures stdout/stderr.

Reproduce using the existing venv: place the byte-identical target from the fixed source URL in site/reading-study.html beside reproduce.py, then run /workspace/browser-env/venv/bin/python reproduce.py. This intentionally exits nonzero when closed content remains. Server/browser stop after execution. No claim of new Cloud task restoration. Original UI02 transfer files are unchanged.
