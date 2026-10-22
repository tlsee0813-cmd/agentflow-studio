# AREA17 — 2026-10-22 인계 시점 미완성 스냅샷

This document preserves the unfinished implementation handoff as of 2026-10-22. It is a historical snapshot for Claude Code continuation, not the current ACTIVE status or final product acceptance. Original handoff details follow; local absolute checkout paths are replaced with repository-relative paths.

2026-10-22. This is an unfinished author implementation, not an accepted product or independent final review. User requested moving implementation to Claude Code; Sol stopped after the current patch/check unit. No commit, push, PR, deployment, app server or browser session was started by this author.

## Exact locations and base

- Product checkout: `.`
- Detached HEAD: `87a7a0329a2663dff2fcc537baa4484722e6f52a`.
- Opus base `77aed39a4e2e32be40c370772ab4e7d048a02240` has the same app tree `50452de0…`; environment receipt verified all 178 baseline app files and exact 3-file WIP application.
- Contract: https://github.com/tlsee0813-cmd/agentflow-studio/blob/87a7a0329a2663dff2fcc537baa4484722e6f52a/docs/cycles/2026-10-22-area-update-17/INPUT.md
- Immutable received Opus checkpoint: sibling `work\area-update17-opus-checkpoint`; receipt `work\area-update17-opus-checkpoint-receipt.json`.
- Logs and this handoff: sibling `work\product17-author-evidence` (all paths below are relative to that folder).

## Changed product files (no generated dist or node_modules belongs in delivery)

1. `app/continuity/src/shared/types.ts` — project.6, return.2, export anchor, separate area description and history (Opus WIP plus PlanStamp enhancement).
2. `app/continuity/src/shared/validation.ts` — strict return.1/2, migration v1..v5 -> v6 without backfill, description references, historical export-anchor area/basis checks. Strengthened applied entry linkage against the actual returned task's parent/export anchor; wrong-target held entry cannot be moved to another area as applied.
3. `app/continuity/src/shared/domain.ts` — apply/hold/revise/correct, exact interpretation-aware dedup, separate export-time anchor and immutable request Background, attributed handoff. Added current user purpose/name/note in a separate handoff section so the anchor's basis is actually transmitted. Stamp includes area name, all this area's/unplaced user basis revisions, explicit manual/intent corrections. Unrelated-area work, unsent drafts and positions do not invalidate it. Same returnId supports successive interpretations while no different update intervenes. Same-text explicit user correction advances revision and blocks old inputs.
4. `app/continuity/src/client/app.ts` — current organised description beside separate user idea; concise summary/changes, unadopted proposal, collapsed evidence/history; correction; received area marker/location CTA; returned report's explanation status. Clipboard/download capture an anchor with text generation and pass it to markHandoff; existing async revision/project/epoch guard retained.
5. `app/continuity/public/styles.css` — quiet description/proposal/history blocks and update marker.
6. NEW `app/continuity/tests/understanding17-fixtures.mjs` — 2 bounded Korean restatements (PowerToys review/fixed code, product13 AI assignment/fix1), pinned links/limits, explicit synthetic proposals/conflicts, helper project/return setup. Not original user speech, automatic extraction, or real conflict evidence.
7. NEW `app/continuity/tests/understanding17.test.mjs` — 20 meaningful domain/roundtrip/strictrefs/duplicate/correction/stale-save tests.

## Tests actually executed (Node 24.19.0 supplementary only)

Each runner invocation preserves `.stdout.log`, `.stderr.log`, `.exit.json` with command/start/end/status. Node22 is the required final Cloud/CI environment; local Node24 is not substituted as final acceptance.

- `check-first` exit0 (before final reference/UI fixes).
- `build-first` exit0 (same intermediate point).
- `units-first` exit1: **145 reported tests, 129 pass, 16 fail**, not a valid 210-test acceptance run. The parent `app/dist` had not been built: flow091c/guide097/http/idea017/idea022/UI001 imports failed on missing parent `diagnostics.js`. Other failures include old schema fixtures/expectations and F095's old one-copy purpose count after adding the separate current-user-plan handoff section. Raw failure details are preserved; do not describe these as all product bugs or all schema-only failures. This run predates the new20 tests and latest fixes.
- `checkpoint-build` exit0 after final product patches.
- `units17-checkpoint` exit0: **20/20** new tests. Includes both source cases, repeated same-returnId corrections, same-text user correction, name/note/purpose/intent/manual/basis/request invalidation, unrelated-area isolation, current-plan/Background separation, held report preservation, semantic wrong-prose synthetic counterexample (not detection), forged recovery target, strict shapes/limits, v1..v5 migration, cross-tab seq rejection.
- `checkpoint-check` exit0 after final patches, including UI typing and all mjs syntax/client boundary checks.
- No browser script has been written or executed by this author. No persistent app server was started. The existing first unit suite includes its own temporary HTTP test harnesses, as part of the authorized unit invocation.
- Opus README claimed 198/210 with12 failures, but its ZIP did not contain that failing unit raw log. Preserve that lack; do not manufacture it.
- TypeScript5.8.3 was absent locally. An initial `npm.cmd ci` attempt failed because npm.cmd was not installed; that tool output was not saved as a raw process file (reported limitation). `setup-typescript` then restored ONLY the existing locked TypeScript5.8.3 tarball (4,250,436 bytes), verified exact package-lock SHA512 and extracted it under ignored app/node_modules. This is not npm ci evidence. `setup-typescript.*` logs are preserved. Existing compiler scripts emit Node24 DEP0190 warning; no script change was made.

## Astra findings: disposition

- Latest current user plan missing from handoff while anchor captured latest plan: fixed by separate current-user-plan section, old Background unchanged; new domain test covers this.
- correctIntent missing from stamp: fixed together with area name, relevant user requested basis, manual conditions. Test covers late response holding.
- Only one same-returnId interpretation revision allowed: fixed; test applies four successive interpretations.
- Correction edit buffer can accidentally correct a newer received revision: UI now captures its starting description revision on first edit and refuses save after a different revision arrives, preserving text. The user can explicitly cancel and reopen from the current text. **Static/type checked only; needs browser verification.**
- Disclosure expansion can carry between areas: new description details IDs now include area ID. **Static/type checked only; needs browser verification.**

## Remaining work, in order

1. Review the WIP against INPUT and the five audit risks. Do not call this continuation's self-tests an independent final review. Root/Astra and Cloud remain separate reviewers.
2. Build parent app with its existing build script before running the entire continuity unit suite; then repair genuine regressions and explicitly update old schema fixture conversions/expected values. Down-converting a newly created v6 object to an older format must REMOVE `space.understanding` and each export's `anchor` (and Background for <=v4), rather than relabeling a v6 object. Do not weaken strict production parsing to accept fake old shapes. Browser hardcoded project.5 expectations also need updating where they mean the current schema. Old `connect039`, `domain`, `flow049`, `flow090`, `flow091c`, `idea022` expectations are described in Opus README; inspect exact failing assertion before changing.
3. Investigate F095 duplicate handoff text: current purpose/idea is now correctly transmitted, but when identical to Background it can repeat exact prose. A clear attributed reference to the identical earlier displayed text may avoid duplicate reading while preserving the current-basis meaning. Do not remove the current-user-plan section or mutate Background merely to satisfy the old assertion.
4. Inspect PlanStamp representation boundaries. It currently serializes relevant task manual/intent values into string entries validated at30,000 chars each; pathological quote/backslash-rich four6000-char fields could exceed that due to JSON escaping. Either represent those fields structurally or use a sound exact snapshot representation consistent with real allowed lengths; add boundary coverage. This limit is not yet tested. The stamp conservatively includes relevant user requested criteria, not unsent text; unrelated-area requests/manual are excluded and tested.
5. Export-anchor API: actual UI captures and passes the anchor with text; domain default still computes anchor when markHandoff is called without an explicit captured value (legacy/unit callers). Consider an invariant check for an explicitly passed anchor versus the same project snapshot. Existing clipboard async guard is preserved. Confirm actual browser clipboard text, return.2 template basis, recorded anchor and chars/digest match, for normal and file-return clipboard/download.
6. Browser implementation/Cloud plan: two sample cases through real result-file selection -> apply/hold -> change location on existing map -> concise area read -> evidence disclosure (does NOT pick/change report/current work) -> explicit report read -> correction (including stale buffer) -> next request/handoff -> origin return. Check 1280x720/1440x900, short/long content and actual wheel/close/focus/state preservation; do not auto-fit/rearrange. Newly generated UI IDs for description blocks include the area ID; e.g. `area-understanding-<areaId>-text/save`, `panel-understanding-<areaId>-...`, `result-show-area`, `received-area-<areaId>`. No browser success has been claimed.
7. UI review: imported-result location CTA is prepended to outcome-home after successful import and is ephemeral until another full render; overview also retains a tab-only received-area list. Decide whether that is sufficiently discoverable without adding counts/approval work. Map markers are this-open-project receipts, NOT last-visit tracking. CSS/layout/visibility remain unverified in a browser.
8. Add browser script/workflow step only if needed by the agreed Cloud execution path. Run final check, parent/continuity builds, static-build and appropriate unit/regression suites with raw logs; exact final SHA must receive Cloud/CI Node22 results. Preserve failures, not only final summaries.

## Hard boundaries to preserve

- Source premise: already organised input, stable Area identity. No collector/provider/schema-prompt/semantic contradiction detector/alias inference/graph dependency/parent hierarchy/live tab sync implementation.
- User name/note/Basis/manual/Background, other areas/relations/layout, unsent kind/body/target, area editing buffer remain protected. Existing placeReturn is separate behavior.
- Valid report with unsuitable derivation must remain preserved/readable; hold only the derivation. No unchecked adopt-held shortcut.
- Normal source evidence is app-unverified. Synthetic wrong-area/opposing prose may pass structural checking; present role/source and let the user correct description separately. No semantic detection claim.
- Exact retransmission is no-op; same returnId revised understanding is distinct; user correction and prior text/receipt survive. Old export Background is not export-time basis.
- Handoff includes valid description as attributed reference only; proposals unadopted and excluded from instructions; stale description text excluded; current user criteria prevail.
- No main/gh-pages changes, no app-server/browser execution on this PC, no new dependencies, no remote write by this author. Everything here remains WIP until final review.

Product file writes stopped after this handoff/checkpoint. Root may snapshot/upload these7 changed files and the evidence; do not include ignored build artifacts or restored node_modules.
