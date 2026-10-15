# Baseline measurement-definition correction

Original baseline commit 62d59d7ed6f4f460831ae88685bde5b7e2dac703 and all its files remain unchanged. This addendum corrects one narrow visibility definition; no HTML/UI/environment change and no prior 16-step flow or new feature test.

## Definition change

Original observe.py used p!==e when collecting overflow clipping and omitted the target's own overflow. The new fixed-target observer records three distinct layers:
1. ancestorClip and overflowAncestors: existing viewport/ancestor clip calculation;
2. selfClip: target overflowX/Y and its fractional padding-box bounds (actual rect minus CSS borders), applied per axis when hidden/clip/auto/scroll;
3. effective clip: intersection of the above. Per-character Range boxes and the existing three sampled elementFromPoint probes remain separate records. Hit probes detect sampled overlays; they do not substitute for clipping or prove every pixel is unoccluded.

PARTIAL is now named PARTIAL_LAYOUT to emphasize layout-boundary classification. FULL requires complete non-whitespace text Range boxes inside effective clipping and unobscured sampled probes. Range font metrics are not glyph ink outlines. Neither FULL nor PARTIAL_LAYOUT measures human understanding, and a 1px Range-boundary mismatch is not confirmed visible-ink clipping or a UI defect. measurement.diff preserves the narrow code change and omission of duplicate screenshot capture.

## Correction and unchanged observations

At 390x844 only project-purpose changes substantively: FULL → PARTIAL_LAYOUT. Own overflow is hidden on both axes, own clip x16..374 / y36..73.6875; the first text-row Range begins at y35, outside its top boundary by1 CSS px. 26 non-whitespace Range boxes are classified clipped and17 full. The prior REPORT statement that the header's character boxes fit its own bounds is inaccurate for this mobile case and is corrected here. Original report/data are preserved, not rewritten.

1280x720 and1440x900 project-purpose remain FULL. Previously partial action-decision (390) and area-restore (1280) receive only the clearer PARTIAL_LAYOUT name; their measured glyph counts are unchanged. classification-diff.json marks naming-only changes separately.

Actual node-name full counts remain:
- 390x844: actions2/3, impact nodes0/4;
- 1280x720: actions3/3, impact nodes3/4;
- 1440x900: actions3/3, impact nodes4/4.

Other target exposure classifications are unchanged. Prose impact-name mentions are still distinguished from actual node-label exposure. No selection, scroll or other input was performed; before/after state equality is checked.

## Execution and artifacts

Unchanged target: 34b4124098fe6242b34e16e23532ceb3e0fe91ad/docs/cycles/2026-10-16-return-flow-03/author-fix1/return-flow-study.html. File before/after and all three new first-navigation HTTP response body hashes match af748df1dfacb7ed6b4ae3709d5ced26ef43f96bc45a9e6c2c05cdc02e9cc77e. No HTML duplicate is delivered.

Same existing Playwright1.57.0 and /usr/bin/chromium154.0.8037.57, default device/visual viewport scale1. Final observation URL http://127.0.0.1:40311/return-flow-study.html; UTC2026-10-15T18:05:30.017590+00:00 to2026-10-15T18:05:32.838035+00:00. Three fresh initial views complete3/3, document HTTP200, actual subprocess exit0 matches JSON exit0. pageerrors[], fatal null, cleanup errors[]. Favicon404 console resource error is retained in result JSON. Exit status concerns execution/source integrity/completion only. Server stopped afterward. Fractional own clipping bounds avoid clientHeight integer rounding at this boundary.

No new PNG was captured; unchanged-layout original screenshots are referenced from each observation and here:
- https://github.com/tlsee0813-cmd/agentflow-studio/blob/62d59d7ed6f4f460831ae88685bde5b7e2dac703/docs/transfer/orientation-04/baseline/390x844-initial.png
- https://github.com/tlsee0813-cmd/agentflow-studio/blob/62d59d7ed6f4f460831ae88685bde5b7e2dac703/docs/transfer/orientation-04/baseline/1280x720-initial.png
- https://github.com/tlsee0813-cmd/agentflow-studio/blob/62d59d7ed6f4f460831ae88685bde5b7e2dac703/docs/transfer/orientation-04/baseline/1440x900-initial.png

Only definition-addendum files are added to the delivery branch. Script, exact observation JSON, classification difference, actual process log/exit, code diff, report and byte/SHA256 manifest are included. Original evidence/shared README/research/main/gh-pages unchanged. No environment diagnostics, installation, TLS work or additional research framework.
