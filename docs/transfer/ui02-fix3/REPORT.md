# Independent fix3 actual-browser verification

Target: tlsee0813-cmd/agentflow-studio, commit 3847a9b267d43dcc16bd1b999af446ad5cc38c91.
File: docs/cycles/2026-10-15-mixed-depth-01/canvas-study.html.
Original byte SHA256: 0aeedd515e7f80f4b091ba1b395f90e0d19355a9eb3ca6c7e1174ad48fa2898c (matched requested hash before and after execution).
No HTML edits, source commits, pushes, site publication, real AI calls, credential reads or network-policy changes.

Existing setup session, not a restored new Cloud task. Environment publication was directly observed in the UI by the auxiliary operator; this test did not reverify publication. New-task restoration is untested.

Python Playwright 1.57.0; system Chromium 154.0.8037.57, /usr/bin/chromium. Node 22.16.0 was available but not needed. No application build or dependency installation performed for this test.
Actual final URL: http://127.0.0.1:36387/canvas-study.html. Temporary server and browser have stopped; this is evidence of the local test URL, not a public preview.

Run: /workspace/browser-env/venv/bin/python /workspace/browser-env/fix3/check.py
Exit rule: any executed failed check or pageerror returns 1. Final run exit 0, 86 passed / 0 failed. These are this independent script's check groups, not copied author/acceptance counts. All S1/S2/S3 at 1440x900, 390x664, 390x844 were exercised.

Checks cover S1 absence of future unresolved UI; S2/S3 collapsed A unresolved direct jump/return (C), collapsed actual endpoint list A2 badges + jump/return (L1), B endpoint A2 badges + jump/return (L2), B unresolved owner A2 direct jump/B return, A4/A6 lack of inherited unresolved/change badges, exactly three current relationship paths, A4→A2→B→back A2→back A4, mobile relationship rows (L3) A2/A6 visibility and real clicks, mobile outline scroll preservation and document horizontal overflow.
Visibility uses viewport + overflow-ancestor clipping bounds, scroll/client width, and elementFromPoint hit testing, then real Playwright clicks. Badges are checked individually, not just whole-element text. Five representative PNGs were opened and visually inspected: 1440 L1, 1440 B unresolved, 390x664 L3 A2 (also shows A6 relation), 390x844 L3 A6, 390x664 B unresolved. They show readable badges and reachable buttons without document horizontal overflow.

Initial complete run: exit 1, 85 passed / 1 failed. At 390x664 S3, the A2→B button was underneath the sticky inspector header after default scroll-into-view. The harness was corrected to scroll the target to the bottom of the visible inspector before hit testing/clicking; the unchanged HTML then completed the full path. This confirms reachability with additional scrolling, not absence of sticky-header occlusion at every scroll position. Initial result/log are retained. Earlier aborted harness-development runs corrected a misspelled selector and a collapsed-canvas prerequisite; they were not app defects and did not produce complete runs.

Scroll request 120: 390x664 S2 actual/max 120/254; S3 120/302. 390x844 S2 actual/max 74/74 (120 impossible), S3 120/122. Restored values exactly matched all four.

Console: one resource error for /favicon.ico HTTP 404; application document requests returned HTTP 200. JavaScript pageerrors: []. Full console and HTTP request log are in result.json.
Unrun: bundled Chromium; whole product build/tests; real AI; new Cloud task restoration. App behavior here refers only to the exact static HTML above.

ZIP includes this report, independent executable code, original HTML, original five PNGs, final JSON/log, and initial complete-run JSON/log.
