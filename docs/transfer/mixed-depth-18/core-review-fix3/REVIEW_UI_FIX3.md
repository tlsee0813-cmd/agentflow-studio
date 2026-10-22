# AREA18 UI fix3 — narrow independent static recheck

2026-10-22. Reviewed frozen local `app/continuity/src/client/app.ts`, SHA256 `c777d4a7cddd1f3fb4d512689763e60507d461f2cfb789192c97a1c6a9e2dfe0`. Source only; no browser, server, product edit or test execution. Cloud reruns remain the acceptance evidence.

No additional actionable defect found within the four requested changes:

- **Active/current panel capture (:81–92):** rejects project-list routes, another project's retained DOM and panels without layout rectangles before changing the memo. Ordinary visible same-project capture still records the existing body's Area key, including the outgoing A panel before B is rendered.
- **Surviving actual caller (:87–90, :330–337):** `markOrigin` passes the explicit caller (or focused control) to capture. A caller is preferred only if it belongs to the visible descendants of this panel and is CSS-visible. Outside, absent or offscreen callers fall back to the original first-visible anchor selection. Thus a surviving caller can retain its offset when an earlier report row legitimately disappears.
- **Snapshot/return (:336–337, :360–373):** the preferred reading is captured before the Origin deep clone. Later normal render/scroll captures cannot mutate that snapshot. Return clones it back, uses `render(false)` to avoid overwriting it with outgoing DOM, restores surviving disclosures and the panel anchor, and restores focus without scrolling. Current work remains separate from this view restoration.
- **Protected/default Escape (:1255, :1551, :2325–2328):** global handlers now respect already-consumed events, composition/keyCode229 and editable controls. Ordinary unprotected panel Escape still prevents default and stops propagation before closing; ordinary unprotected connection/context Escape still closes and returns focus. The project-card menu's ordinary Escape path remains intact.

This review establishes static flow consistency, not actual scroll geometry, IME behavior or browser acceptance. It does not claim that disappearing callers can be restored; existing numeric-scroll fallback still applies when no saved anchor survives.
