# PC13 fit patch — independent static review

2026-10-22. Frozen app.ts SHA256 `651d9e85e4e3a24090f887f8d3a91750182f5a6c8fe218dec34e9ce59e2d128c`. Source only; no browser/server/test execution or product edits.

## Observed regression's correction

The root relayed Cloud confirmation that `map-fit` intercepted the first-info centre in all four failing scenes. app.ts:1141–1145 now reserves the measured PC controls bottom plus 8px. It subtracts the existing 24px fit margin from the extra top band, so the earliest fitted card top is at least controls-bottom + 8px without adding two full margins. The reservation affects initial and explicit fit only; a pre-existing camera is not automatically shifted. Fallback card height now agrees with the 180px CSS footprint.

## Initial camera / explicit actions

- :1377 marks missing-camera initialization instead of fitting during intermediate layout. :2184–2189 applies display/disclosures and final workspace size first, then finishes initialization synchronously.
- :1148–1154 gives any recalled/user/returned mapView priority and cancels pending initialization. It requires an active space and measurable map, so an inactive route does not invent a fitted camera.
- Fresh explicit locate from work renders the whole map and finishes its initial camera before markOrigin (:1440). Its selected-area render then keeps that camera; revealCard and rememberMap run afterward (:1445–1446). Pending initialization cannot overwrite the explicit locate result.
- Existing add-area handlers read the camera, synchronously commit/render, perform their explicit out-of-view centering and save it (:1381–1386). Child addition similarly reveals and saves after commit. Because a usable map already has mapView, the initialization helper cannot replace these action results.
- Origin restoration assigns the saved map and uses render(false); its existing camera therefore wins. Ordinary panel opens/closes, incoming updates and resize do not acquire an automatic fit.

No new actionable camera-priority regression found in these paths. Cloud geometry and full interaction reruns remain necessary.

## Existing initial-memo gap, not introduced by this patch

finishInitialMapFit (:1154) does not call rememberMap. The previous C777 renderMap initialization also did not save its initial fit. showProjects (:1054–1058) clears ephemeral state without an independent map save. Most explicit map actions do save, but not an untouched initial view.

Concrete source-derived boundary: open a project in a fresh tab, do no map action, resize the window (existing camera stays fixed), go to the project list and reopen. With no earlier map memo, that initial camera is lost and a new fit is computed for the resized layout. This is an inherited gap rather than evidence of a newly failing Cloud case.

Small bounded remedy proposed to root: call rememberMap once immediately after a successful initial fit/application. Do not add unconditional fit or camera replacement on normal renders. Preserve the helper's existing-map early return.

## Final one-line correction reviewed

Final app.ts SHA256 `2309f23a52a522bd96d5da9f2280fa3e333908e611448a6fce9be8c66579db4c` adds `rememberMap()` at the end of :1154, after the successfully fitted camera is applied. Read directly and hash-confirmed. The existing-camera early return at :1150 remains before it. `rememberMap` (:135–136) serializes the current selection, panel readings, collapsed state and relation-reader state without mutating them, preserving other-project memos under the existing 11-other-project limit. Thus the final camera is saved once without replacing a recalled/user/Origin camera or discarding its associated panel state. The initial-memo concern above is resolved statically; no remaining actionable concern found within this patch's requested scope. Cloud reruns remain acceptance evidence.
