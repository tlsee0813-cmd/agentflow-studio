# Sol WIP preliminary independent observations

Exact source6ea2915e6483076710840883de8891a197464386. This is a preliminary snapshot run, NOT final implementation approval, full cycle17 flow coverage, or all-UI-pass. No product edits, dependency installation, provider calls, user data or preview modifications. Isolated browser contexts; real localhost MOCK server and Chromium. SOURCE_BINDING verifies every extracted source remains equal to pinned git bytes after execution.

## Frozen domain cases
Unchanged frozen-check.mjs SHA256 ab65a98de50e1e0277322cddcf4db7975e6e737a92483dbf06fbb4a7c58e6c02. Four cases now PASS; each actual child exit0, collector0. Original failing snapshot remains independently preserved at3426c566c22f524719a2d5302e8de249ce7b05e5. No assertions changed to match WIP. Build uses existing Node22.16/TS5.8.3. continuity build log and process actual exit0 retained. Official mock server additionally required the normal app npm build (tool execution exit0); that command's output was observed in tool transcript, not captured as a raw log file here.

## UI observations at1280×720 and1440×900
Fixture generation uses public domain APIs offline for labelled synthetic A/B descriptions and valid export/return records. Project imported through normal product file UI; r2 imported through normal result-file UI. No hidden app functions/state mutation or DOM scroll injection during browser actions.

- A evidence opened → close → B first opened: B evidence not open. Correct per-area separation.
- A r1 correction draft typed → r2 receipt → attempted stale save: saved project unchanged and original typed text preserved, stale notice shown. Correct rejection at both widths; actual screen PNG2 retained.
- User panned map until target cards were offscreen. Explicit received-area CTA opened the correct understanding panel but LEFT TARGET CARD OFFSCREEN (x=-473 at1280 /-393 at1440), despite showing the selected part's description. This is the location CTA limitation/defect sent to implementation, not card visibility PASS. Panel visibility assertion is distinct from target card being visible; screenshot/raw documents both.

## Preserved nonzero and measurement boundaries
ui.py final raw run remains exit1: two map-view equality assertions compared the pre-receipt map with post-receipt map. Receipt adds the “이번에 받은 설명” row44px high and updates A card label/height, so raw screen y differs by44 while computed matrix is unchanged. This is not evidence of pan/zoom loss by itself. Do not silently convert this run to exit0.

same-content-map-comparison.json separately re-evaluates ALREADY RECORDED raw beforeCTA vs afterClose, both after the receipt: both widths have equal matrix, exact card rect/selection arrays and windowY. It is post-hoc comparison, not a new browser rerun or replacement of the original assertion. This narrower view-return result does not repair offscreen-card location failure. Do not combine into all UI pass.

Setup errors also retained: initial server attempt lacked normal app build (exit1 stderr/process); next UI attempt addressed hidden result-file panel without opening the composer (exit1 fatal, ui-first.py/raw/stdout/process). Latest checker uses the normal home-paste-result control before importing. No product changes. No historical tests or full author suite rerun at this WIP stage.

## Reuse
For frozen domain rerun: SOURCE_APP=/path/to/compiled/app OUTPUT_DIR=/separate/results node frozen-check.mjs 1 (then2/3/4). The original collector references the unchanged checker at its original scratch path; the identical source is included here for remote recovery. UI scripts preserve exact original paths as provenance; fixtures.mjs assumes sibling cycle17-sol-wip compiled app. Adapt paths only for a future exact candidate and keep assertions/raw histories. Full final-candidate PC cycle flow remains PENDING.

Manifest lists every payload recursively with bytes/SHA256, excluding MANIFEST.tsv itself. No node_modules, compiled app, full clone or source product copies are included.
