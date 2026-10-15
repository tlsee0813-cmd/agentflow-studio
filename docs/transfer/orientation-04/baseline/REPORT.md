# Cycle04 independent initial-view baseline

Descriptive baseline only: not human comprehension PASS/FAIL, a winner judgment or confirmation of a cycle03 defect. No new candidate exists in this run. No prior 16-stage flow was repeated.

Target fixed HTML: https://raw.githubusercontent.com/tlsee0813-cmd/agentflow-studio/34b4124098fe6242b34e16e23532ceb3e0fe91ad/docs/cycles/2026-10-16-return-flow-03/author-fix1/return-flow-study.html . File before/after and each first browser navigation HTTP response body SHA256: af748df1dfacb7ed6b4ae3709d5ced26ef43f96bc45a9e6c2c05cdc02e9cc77e. HTML not duplicated in delivery. Reference first-entry question/fact boundary: BRIEF.md at 1bba6f339acf5874ceb81874c4c8b70e37fbc8c0, docs/cycles/2026-10-16-orientation-04/BRIEF.md (read, not executed as an expanded test contract).

## Environment and method

Existing /workspace/browser-env/venv/bin/python, Python Playwright 1.57.0, system /usr/bin/chromium 154.0.8037.57. Fresh browser contexts at 390x844, 1280x720, 1440x900, default device scale1/visual viewport scale1. Actual local HTTP URL http://127.0.0.1:35233/return-flow-study.html. UTC 2026-10-15T17:57:45.546678+00:00 to 2026-10-15T17:57:48.642166+00:00. All three document responses HTTP200. Servers stopped afterward. No environment installation/settings/publication/TLS diagnosis.

No mouse/keyboard/touch, selection, scroll, focus manipulation, DOM/CSS/state mutation or app API calls. Waited for load/fonts, read DOM geometry and captured one viewport PNG per fresh context. State equality before/after confirms no scroll or selection changed. This is not an interaction, swipe, reading-comprehension or external-navigation test. Existing evidence, shared README, product/research branches are untouched.

## Observation definition (fixed targets, not a general framework)

Targets are the header program-purpose sentence; brief change title, change description, named impact summary, report-basis phrase, core limitation and visit/no-decision context; relationship-scope note and help summary; the three actual .part .nm labels; four actual .area-head .nm labels. Exact selectors/text are in observe.py and result.json. Closed help contents and hidden full text are not credited as visible.

For each target, record its element rect, computed display/visibility, viewport and overflow-ancestor clipping rectangle, and per-non-whitespace-character Range layout rect. Intersect character rect with viewport and ancestor clip; probe 15/50/85% of the surviving horizontal span at its mid-height with elementFromPoint to distinguish another element covering it from offscreen/overflow clipping. FULL means every non-whitespace character layout rect is fully within the effective clip and sampled points hit the target/descendant; PARTIAL means some visible but incomplete geometry; NONE means no visible characters. Original full text is metadata, not a visibility claim. visibleGlyphText omits whitespace deliberately and is not a substitute screenshot/OCR. Range boxes include font metrics, so this is conservative layout completeness, not pixel-perfect glyph-ink reconstruction. Sampling is not proof that every pixel is unoccluded. All targets' own computed overflow is retained; the header purpose's character boxes fit its own bounds in these observations. Screenshots were opened and visually checked. No sampled OCCLUDED characters were found; partial names here are clipping cases.

Keep the same target semantics, fresh states, viewport, fonts/device scale and clipping/occlusion definition when comparing future candidates. Candidate-specific selectors may need explicit matching; this run implements only the fixed baseline.

## Initial exposure

| Viewport | Complete actual action names | Complete actual impact-node names | Partial / offscreen notes |
|---|---|---|---|
| 390x844 | 2/3 | 0/4 | 목적 정정 and 작업 지시 FULL; 사용자 결정 표시 PARTIAL at viewport bottom. All four impact-node names below viewport. |
| 1280x720 | 3/3 | 3/4 | 저장 복구 PARTIAL at the map scroll clip bottom; 홈/작업문/다음 AI 요청 FULL. |
| 1440x900 | 3/3 | 4/4 | All seven actual node names FULL. |

The header program-purpose sentence, core change title and description, prose summary naming all four impacts, report-basis phrase, core limitation and visit/no-decision context are FULL at all three sizes under this definition. In particular, mobile's actual impact-node names are offscreen but the upper prose already names 홈/작업문/다음 AI 요청/저장 복구; do not report the area names as wholly absent from the initial screen.

The report basis is literally “이 개발 기록에서 보고한 변경”; the quiet context says no visit history and uses the record's change point. No explicit calendar report date or fixed commit identifier is displayed in these measured default sentences. This observation does not upgrade the sample to live product state, an actual user event, AI compliance, approval or handoff acceptance. The core limitation explicitly says actual AI compliance unverified and user original request/handoff result absent.

Relationship-scope note and help summary are NONE at mobile's initial position, FULL on both desktops. Help remains closed, no selection exists, no relation paths are drawn (edgePaths0). Lack of an initial selection/edges is a recorded baseline state, not a new defect verdict.

## Position, ranges and scale

All initial window/map/brief scroll offsets are0 and all selected/pressed lists empty; all remain unchanged after capture. Initial depths home1/task2/next0/restore1.

- 390x844: document max scroll x0/y819; map internal max x0/y0 (overflow visible); brief max0/0. Brief rect starts y84.6875, height439.6875 and ends at524.375. Canvas starts y587.171875. Transform none, scaleX1 (small scaleY ratio rounding from integer offsetHeight is recorded); zoom label100% but control display none.
- 1280x720: document max0/0; map max x10/y135, brief max0/0. Canvas computed matrix(1,0,0,1,0,0), scaleX1. Map clip bottom657.796875 intersects the 저장 복구 character layout rectangles.
- 1440x900: document max0/0; map max0/0; brief max0/0. Canvas computed matrix(1,0,0,1,0,0), scaleX1. Zoom control visible. Integer offsetHeight vs fractional rect yields scaleY≈0.999676, not a different CSS transform.

Ranges are reported as scrollHeight/clientHeight or scrollWidth/clientWidth differences plus computed overflow, not a claim that touch/drag behavior was tested.

## Completion and evidence

Expected/executed observations3/3, complete true, actual subprocess exit0 matches JSON exit_code0. No fatal/pageerrors/cleanup errors. One favicon404 console resource error is retained; it is not JavaScript pageerror. Exit status covers execution/source-integrity/completion, not exposure or understanding ratings. No new fatal probe requested/performed.

observe.py, result.json (all glyph/rect/clip/cover and initial state data), process.log, process-exit.json, server.log, console.json, pageerrors.json, three original PNGs and this report are delivered. MANIFEST.json records byte sizes/SHA256. Original fixed HTML is referenced only, not uploaded again. No candidate comparison or adoption conclusion is made.
