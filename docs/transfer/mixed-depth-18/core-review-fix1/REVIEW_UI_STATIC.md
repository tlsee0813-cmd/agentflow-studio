# AREA18 UI flow — independent static review

2026-10-22. Source-only review; no browser, server, product edit, commit or push. Cloud UI execution is separate.

The local frozen files were matched to GitHub product `ba9bf6e` by Git blob ID:

| File | Git blob |
|---|---|
| app/continuity/src/client/app.ts | 55ad0275163d7cdc66f44057629da8e468f08947 |
| app/continuity/public/styles.css | a13c4b6971c19933ad2febaaff596379f48bfa03 |
| app/continuity/tests/hierarchy18_browser.py | eb6d8e055d60e8cbcee65fc1b9605b6b612fb619 |

## P2 — recalled panel reading can be overwritten by hidden old DOM

Source: app.ts:81-87, 181-191, 1047-1051, 2143-2145.

Reproduction to confirm in the browser: open a long area panel, expand content and scroll it; go to the project list; reopen the same project.

The list transition resets ephemeral state but keeps the old space-view DOM hidden. openEntry then recalls the saved project MapMemo. The next render unconditionally calls capturePanelReading before rebuilding the view. That function accepts the hidden old panel and writes the same project:Area key: its hidden descendants have no client rectangles, so the saved anchor is replaced with null; a hidden element's scrollTop has no visible layout position to preserve. This can overwrite the recalled reading position before restorePanelReading uses it.

Expected: reopening uses the saved project/area reading anchor and position. Minimum correction: capture only a currently displayed panel from the active view, or suppress stale-DOM capture when opening/resetting a project. Preserve normal same-map A→B→A capture.

The author's test_05 (hierarchy18_browser.py:200-209) checks area switching inside one map, not the project-list/reopen route. Exact rendered scroll outcome is pending Cloud reproduction; the unconditional hidden-DOM overwrite path is visible in source.

## P2 — panel Escape protection does not protect against the outer listener

Source: app.ts:1250, 1546, 2322; closeContext at :432.

Reproduction: open the existing criteria/context panel, switch to the whole map (contextOpen remains true), then edit an area name/idea and send an IME-composing Escape or an Escape consumed with preventDefault by the inner control. Alternatively keep connection-details open while editing the area panel.

The new panel handler correctly returns for isComposing, defaultPrevented and editor controls. It does not stop propagation in those branches. The existing document Escape listener ignores all those conditions: it closes connection-details and focuses its summary, or closes the criteria panel and focuses contextReturn/nav-context. Thus an Escape intended to stay with the editor can move focus away even though the area panel itself remains visible.

Expected: a composing or consumed Escape keeps the editor/IME focus. Minimum correction: the outer listener must honor consumed/composing/editor Escape before closing another surface. This does not require changing the ordinary panel-close behavior.

The author's test_05:211-214 asserts that the area panel remains visible and its text survives. It does not open the outer context/details state or assert retained focus, so it cannot establish this boundary. This is a static event-flow finding, not an executed UI failure.

## Paths inspected without another concrete defect

From a fresh relation-reader excursion, endpoint buttons pass stored r.from/r.to to showReceivedArea; only required ancestors are expanded; the exact selected area reaches writeInArea and the new request target. Origin includes relation-reader state, collapsed branches and panel readings, and explicit return restores those without undoing the new task. Owner rows use their original Area/task/return IDs. Close and explicit camera return are separate actions. No pixel-level geometry, actual clipboard, focus or accessibility success is claimed here.
