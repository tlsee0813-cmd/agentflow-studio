# Narrow verifier hardening

Original check.py, evidence/, REPORT.md, MANIFEST.json and site HTML remain byte-for-byte unchanged. Original final 86-check JSON remains historical evidence. check.hardened.py retains the same browser checks and assertions; changes are limited to fatal handling, expected completion count (86), isolated negative probe, and separate output paths.

Configuration/hash/browser exceptions outside run() are recorded as fatal (type/message/phase/traceback). Failed checks, pageerrors, cleanup errors, fatal errors or a count other than 86 yield exit 1. Cleanup runs in finally without sys.exit/return; it records errors without replacing the primary fatal. Result persistence and sys.exit happen after finally. Standard Python import/argument-parser/output-path errors before the guarded run still exit nonzero naturally; no structured JSON is promised if output creation itself is impossible.

Validation commands from the transfer directory (using the existing setup session):
- /workspace/browser-env/venv/bin/python check.hardened.py
- /workspace/browser-env/venv/bin/python check.hardened.py --probe-fatal

The isolated probe intentionally raises RuntimeError in configuration before HTTP server/browser/checks. It does not change the HTML or any check. normal/result.json and probe/result.json are distinct. normal.log/probe.log preserve stdout+stderr. process-results.json records actual subprocess return codes independently of the checker JSON. run-validation.py is the exact local driver used (its local root is /workspace/browser-env/hardening); when reusing from this evidence subdirectory, adjust root to its parent as needed.

Audit limitations retained: C's decision display has no separate assertion; A4/A6 non-propagation assertions are inspector-detail-only. Test coverage was not expanded to address these limitations. Scrolling uses DOM scrollIntoView/scrollTop; wheel/touch remain untested. New Cloud task restoration, product build and real AI remain untested. New PNGs, if any, are only in evidence-hardening/normal/ and do not replace original evidence.

Observed actual subprocess outcomes: normal exit 0, 86 executed / 86 passed, complete=true, fatal=null; probe exit 1, zero executed, complete=false, fatal RuntimeError at configuration. The probe therefore demonstrates nonzero despite zero failed checks and zero pageerrors, and also exercises the incomplete-count condition. This is checker hardening evidence, not a product/HTML modification.
