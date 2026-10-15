# Six-switch continuity addendum

Scope: only the six missing f14 A→B/B→A observations at 1440x900, 390x664, 390x844. This supplements, and does not overwrite, the original two browser runs or 54 PASS / 6 local NOT_RUN / 2 external NOT_RUN assessment. No 60-stage rerun, external request, additional environment diagnosis, new PNG, source modification or UI development.

Exact original reading-fix1 HTML at research commit 4971cb51965a7c40b374ddf0210f51c8609ed20e. Before/after SHA256 both 9add34fc341db08e6ef54e6e99d1fbfac6b39e7de61f5d8bd6415b32fa28ed1d. Existing Playwright 1.57.0 / system Chromium 154.0.8037.57, existing venv Python. Real loopback HTTP navigation, normal hit-checked clicks, actual preview mouse.wheel(0,240), then normal expression-switch click. Initial body placement uses logged DOM window.scrollBy and is not called wheel. No force click or app API/state/CSS injection. No screenshot taken.

Expected 6 / executed 6 / complete true; 6 PASS / 0 FAIL. Actual subprocess exit 0 matches result exit_code=0. Fatal null, pageerrors [], cleanup_errors []. Console/favicon and server requests preserved in result.json. UTC execution timestamps and actual ephemeral HTTP URL are recorded; server/browser stopped afterward. This run establishes only the six continuity observations; previously blocked external original reading/roundtrip remain NOT_RUN.

## Simultaneous measurements and judgment

Each snapshot records pvScroll top/max/clientHeight/scrollHeight, pvOrigin text/height, immutable E09 .evdl heading and every dt/dd text with deterministic selector-based identity, reading-window-relative top/bottom, visible clipping interval, and text-node line rectangles. Each comparison requires identical immutable text, unchanged visible line indices, and corresponding relative positions/visible clips within 1 CSS px. A nonempty visible immutable reading region is required. Fact/source identity or equal scrollTop alone is insufficient.

| Direction / viewport | top before→after | max before→after | clientHeight | scrollHeight before→after | pvOrigin height before→after | invariant relative-position delta |
|---|---|---|---|---|---|---|
| A→B 1440x900 | 240→218 | 435→413 | 686 | 1121→1099 | 176.296875→154.03125 | −0.265625 |
| B→A 1440x900 | 240→262 | 413→435 | 686 | 1099→1121 | 154.03125→176.296875 | +0.265625 |
| A→B 390x664 | 240→217 | 715→693 | 317 | 1032→1010 | 154.03125→131.765625 | +0.734375 |
| B→A 390x664 | 240→262 | 693→715 | 317 | 1010→1032 | 131.765625→154.03125 | +0.265625 |
| A→B 390x844 | 240→217 | 604→582 | 428 | 1032→1010 | 154.03125→131.765625 | +0.734375 |
| B→A 390x844 | 240→262 | 582→604 | 428 | 1010→1032 | 131.765625→154.03125 | +0.265625 |

All measured invariant heading/dt/dd top and bottom deltas match the corresponding table delta; immutable text and visible line indices are unchanged, and visible clipping differs by no more than 0.734375 CSS px. At least eight immutable nodes were visible in each before snapshot. No transition reset to zero or hit max. Actual wheel moved preview by 240 and body by 0 in all six. The expression-specific origin changes height by ±22.265625; preview clientHeight is unchanged, while scrollHeight/max shift by ±22. Together with stable actual E09 text geometry, this supports browser anchoring compensating origin reflow and demonstrates preservation of the observed reading passage at this tested wheel position. The internal browser anchoring algorithm was not instrumented; no assertion extends to every possible reading position.

The prior pixel-equality assertion rejected valid compensating offsets; the second verifier's nonzero-only condition was insufficient proof on its own. This addendum supplies the missing text/line/clip evidence rather than retroactively relabeling either raw result. Original assessment files remain untouched. B mobile comparison-counterpart limitation and external GitHub TLS block remain unchanged.

## Reuse

Place the unchanged fixed target HTML at ../site/reading-study.html relative to observe.py (or adjust only local file location in a separate task), run /workspace/browser-env/venv/bin/python observe.py, and capture stdout/stderr and actual subprocess return code. Source HTML is not duplicated in this delivery. MANIFEST.json lists these new evidence files, not the historical evidence. V0_TIME_ADDENDUM.md records only the supplied audit correction; no v0 investigation/rerun was made.
