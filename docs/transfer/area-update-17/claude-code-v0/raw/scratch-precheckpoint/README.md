Scratch browser regression run on an UNCOMMITTED working tree between 6ea2915 and 98bc009 (Node 22.16.0, Chromium 1194).
Kept as the first raw failures; not reproducible byte-for-byte because the tree was not committed.
- suite-exit-codes.txt: per suite exit code. 'browser 2' = the loop wrongly called browser_browser.py (no such file; the
  continuity browser.py suite was not run in this scratch pass) — a runner mistake, not a product result.
- connect039.log: FAIL test_02 — expected 'idea015.project.5' after migration; current schema is project.6 (expectation).
- pc12.log / pc12-observations.jsonl / pc13.log: return-to-origin card y differed (47px / 15px) because the existing fix2 anchor
  re-scroll saw the clicked request control at a different page position. Cause in this tree: every area panel rendered a new
  'no description yet' block. Fixed in 98bc009 by rendering nothing for areas without a received description (also a
  reading-load requirement); pc12 15/15 and pc13 14/14 pass after it. Likely mechanism (inferred from the numbers, not
  separately proven): the taller panel put the request control below the 720px fold, Playwright scrolled the page by 47px to
  click it, the app recorded that post-scroll place as the origin and returned to it, while the test compares with its
  snapshot taken before the click ('back' windowY 187 vs 'depart' 140; docHeight equal). So the app restored where the click
  happened; the visible difference was the added height, which the fix removes for areas without descriptions.
