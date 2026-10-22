# PC13 regression — static diagnosis and Cloud attribution

2026-10-22. Read-only analysis of app.ts SHA256 `c777d4a7cddd1f3fb4d512689763e60507d461f2cfb789192c97a1c6a9e2dfe0` and styles.css `a427a2d4d52bc061d2d42d747a8dd30e09bd475df9860c66dce3f96bcc51431c`. No server/browser/product changes. No assertions or fixtures changed.

Root reports Cloud exact9330 failures: initial/notice/long first-info centre hit failures and a 1280 click intercepted by map-fit. Actual raw rectangles/PNG are pending; the following source paths are not yet a claim that each causes a particular observed failure.

Follow-up from root: Cloud's four actual scenes all identify `map-fit` as the element hit at the info-button centre, with scrollY 0; the info button can remain partly exposed at the right. Raw evidence is published at commit `c5c7558b`. Therefore the observed failures are attributed to controls/card overlap. The initial-fit ordering below is a separate consistency concern, not an observed cause of these failures. This reviewer has read the source but has not independently opened those Cloud pixels.

## Initial fit uses an intermediate layout

- PC13 `fresh_tab` opens the project from the project list. `renderSpace` app.ts:1615 explicitly unhides its own root, so a claim that this route necessarily measures a hidden map and uses the 800×480 fallback would be incorrect.
- Nevertheless, `renderOverview` app.ts:1361–1363 calls sizeWorkspace and initializes mapView before render calls displayView (:2169). Only displayView (:271–289) switches the body route/layer, hides the old project list and shows the project header/feedback/topbar layout. A final sizeWorkspace (:2174) then changes the map height without recomputing that initial fit.
- sizeWorkspace (:1242) depends on the map-layout's current viewport top, with a 240px floor. Thus the first fit and final display can use different widths/heights. CSS also changes project-list/project padding and the PC space sizing.
- Minimum correction: establish final display/layout and size first, then initialize mapView once when absent. Preserve every existing mapView on ordinary renders, panel open/close, receive and origin restoration. Do not introduce automatic ongoing fit.

## Fit ignores the controls' occupied rectangle

- fitView (:1135–1139) measures card boxes and fits against the entire map client rectangle. fitViewport presentation.ts:103–108 has only a uniform 24px edge margin.
- Controls stay top-right on PC (styles.css:2421), with size derived from buttons and wrapping; they are inside the map (:2295). The info button is at its card's top-right (:2288). Mixed-depth cards have a fixed 180px height (:2552). Controls z-index4 (:2566) is above cards z-index2 (:2552).
- Consequently the fit calculation does not guarantee that a fitted info/title target is outside the controls. Changing z-index alone merely chooses which control loses the click.
- Minimum correction: account for the measured controls plus spacing in the initial/explicit-fit usable region, or give controls a dedicated row inside the map while excluding that row from the card canvas. Keep controls inside the map: PC13 explicitly asserts that. Do not move stored cards, reserve an always-absent side panel, or weaken centre-hit/non-overlap assertions.

Needed to tie each Cloud failure to these paths: final map rect/transform, first info rect, the actual element at that centre, and controls rect for default/notice/long. A surviving initial-height problem and a controls collision must not be conflated merely because they occur in the same suite.
