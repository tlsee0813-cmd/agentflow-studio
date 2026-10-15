# Independent reading fix1 — limited real-browser evidence

Target: research commit 4971cb51965a7c40b374ddf0210f51c8609ed20e, docs/cycles/2026-10-15-real-record-02/reading-fix1/reading-study.html. Original HTML extracted to read-only local site/reading-study.html; before/after SHA256 both 9add34fc341db08e6ef54e6e99d1fbfac6b39e7de61f5d8bd6415b32fa28ed1d. HTML not duplicated in this transfer.

Existing /workspace/browser-env/venv/bin/python, Playwright 1.57.0 and /usr/bin/chromium 154.0.8037.57. No environment setup, installation, credential inspection, permission/policy changes, HTML edits, application API/state/CSS injection or forced click. Read-only DOM observations and explicitly logged DOM scrolling were used; actual mouse.wheel inside pvScroll is separately identified. Author REPORT_FIX1 and checks were inspected, not executed/copied as independent counts. No full author 308 check target, v0 rerun, mutation or new fatal probe. No human reading/winner judgment.

## Plan and execution provenance

PLAN.json fixes ten local stages for each A/B × 1440x900,390x664,390x844 (60), plus actual external blob read/roundtrip coverage (2). Per-condition JSON contains stages and actual interaction/geometry records. Initial rendering precedes content scrolling. Reusable verifier uses the existing exact HTML in site/reading-study.html; run via existing venv Python. The retained final verify.py accepts --reuse-external <first-result.json> to avoid repeating an already-observed blocked external source. No request interception/fulfillment, raw-only fallback or authentication workaround.

Two browser runs are retained separately:
- harness-first/: exact initial verify.py, result.json, process.log, process-exit.json and external.json. Actual process exit 1; 54 PASS, 6 FAIL, 2 NOT_RUN. All 60 local stages executed, no fatal. Six switch failures were triggered by an overstrict numeric preview.scrollTop equality assertion. Initial failure strings/observations remain unchanged; some pre-switch metrics were not persisted in that failed-stage detail and must not be invented. Initial diagnostic PNGs were not retained; requested final four PNGs only are delivered.
- output/: exact second-run code is top-level verify.py. All 60 stages executed; raw checker 60 PASS, 0 FAIL, 2 NOT_RUN and actual process exit 0. It weakened preview pixel equality to nonzero scrollTop, which alone is insufficient to establish internal reading continuity. Raw result is preserved, but its six switch PASS labels are not accepted as full verification. External diagnosis is reused from the first run with explicit hash/path provenance, not reexecuted.
- assessment.json: offline adjudication from existing observations only, no new browser execution. 54 PASS, 0 confirmed app FAIL, 8 NOT_RUN (6 internal reading-continuity coverage gaps + 2 externally blocked). Expected/executed local 60/60, verified local completeness false. Actual assessment subprocess exit 1 matches JSON exit_code=1. This is the final conservative disposition; do not describe the complete requested scope as passed. assess-recorded.py/log/process-exit are included.

## Verified local observations

Both rendered representations contain the same ordered 25 facts. Actual A sentences/B cells f14–f20 were read and exposed through logged sentence/cell DOM scrolling: E09 C/L1/L2/B distinctions, existing five-case scope, E10 figures and frozen follow-up state remain distinct. A f15/f16 explicitly name H1 and their own L1/L2 locations. Rendered text and clipping geometry are retained in content stages.

At all six conditions, initial/after-close pvBody.hidden=true, computed display=none, body/close boxes zero, close not hittable. Wide empty placeholder remains; mobile preview sheet display=none. Actual #ab-f14/#bb-f14 clicks start from nonzero body scroll, open E09 with current-expression origin and focus pvH, expanded current button, selected clicked fact. After actual wheel(0,240) inside pvScroll: preview delta=240 and body delta=0 for all button and Escape roundtrips. After either close method: focus current source button, clicked-fact selection retained, aria-expanded false; same-expression scrollY delta=0 and button-top delta=0 in all twelve roundtrips, no clamp required. No prior-different selection restoration is claimed.

Same-fact A↔B switches retain heading/source IDs, selection, updated expression origin and current aria-expanded mapping; closing returns focus to the current expression button. Reopening f14 and opening new f19 reset previewTop to zero and show the new origin quote/fact; new f19 heading is E10. P02 has no anchor and visibly explains why no public fixed link is provided. Local button geometry includes viewport/overflow-ancestor bounds and center hit tests (sticky overlap appears as a failed hit); no document horizontal overflow observed. Four requested PNGs were opened for inspection. B mobile does not retain a comparison counterpart row above its sheet; this is a known limitation, neither side-by-side success nor a newly asserted regression.

## Internal reading-continuity limit

Corrected-run snapshots show previewTop / previewMax:
- 1440 A→B: 240→218 / 435→413; B→A: 240→262 / 413→435.
- 390x664 A→B: 240→217 / 715→693; B→A: 240→262 / 693→715.
- 390x844 A→B: 240→217 / 604→582; B→A: 240→262 / 582→604.

None resets to zero or reaches max. Offset change follows extent change exactly, or within 1 CSS px for mobile A→B; bottom-relative offset stays within 1 px. The original HTML updates only the expression-dependent origin on switch, consistent with browser scroll anchoring after reflow, but this is an explanation compatible with the numbers, not proof of retained evidence text. Semantic origin quote is recorded and changes appropriately; it is outside the visible preview after wheel. Actual visible text/range and pvScroll clientHeight/scrollHeight were not captured (pvBody height and previewMax were). Therefore actual passage continuity, content height and a definitive reset-versus-reading-loss judgment cannot be established from this evidence. Six switch internal-reading claims are NOT_RUN despite observed fact/source retention. No new browser run was made to fill the gap after clarification.

## External source

First-run actual S03 anchor has fixed GitHub blob href, target=_blank, rel=noopener noreferrer and explicit new-tab guidance. Real popup navigation failed with net::ERR_CERT_AUTHORITY_INVALID for github.com; final URL chrome-error://chromewebdata/, title Privacy error; no HTTP response code was received. Original source reading and successful source roundtrip are NOT_RUN. Popup close aftermath URL/rep/fact/selected/body/preview scroll is recorded but not credited as source roundtrip. TLS verification was not bypassed; no environment diagnostics or policy changes followed. Error body and failed request are retained in harness-first/external.json and output/external.json.

## Runtime evidence

First HTTP URL http://127.0.0.1:44859/reading-study.html; corrected local URL http://127.0.0.1:41967/reading-study.html. Servers stopped after runs. Exact UTC times in each result, no local-time conversion. Corrected run 2026-10-15T16:24:45.277668+00:00 through 2026-10-15T16:25:21.113636+00:00. Local document requests HTTP 200. pageerrors=[], fatal=null, cleanup_errors=[]; favicon 404 console resource error is retained separately and is not a JavaScript pageerror. Files include code, per-condition JSON, raw aggregate results, server/console/pageerror/process records, four PNGs, independent assessment and hashes. V0_TIME_ADDENDUM.md examines preserved v0 blobs only; no v0 originals changed.
