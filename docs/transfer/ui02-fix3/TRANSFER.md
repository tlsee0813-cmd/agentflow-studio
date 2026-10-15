# Evidence transfer only

These original files were copied byte-for-byte from the existing setup session after validation, with explicit authorization to commit and push only docs/transfer/ui02-fix3/ on delivery/ui02-fix3-evidence. Base commit: ddd51361d82619ce6ad11e95b0cf1ae591fdd464.

REPORT.md is preserved unchanged. Its no-source-commits statement describes the validation run; this subsequent commit uploads evidence only. No tests were rerun, screenshots recaptured, or validation code/HTML modified during transfer. No main, gh-pages, checkpoint, product source, credentials or network-policy changes.

Target: 3847a9b267d43dcc16bd1b999af446ad5cc38c91. Initial complete run: 85 passed / 1 failed; final: 86 passed / 0 failed. Harness-development corrections and sticky-header occlusion are documented in the original report. The supplied check.py is the final harness; an initial-harness snapshot was not retained. Initial JSON and log are retained unchanged. Additional scrolling used DOM scrollIntoView({block:'end'}); outline preservation used DOM scrollTop assignment. Physical wheel/touch input was not tested. New Cloud-task environment restoration remains untested. Publication was directly observed by the auxiliary operator in the UI, not reverified in this test.

MANIFEST.json records byte counts and SHA256 of all files added here except the manifest itself. Existing README.md is preserved. No duplicate ZIP is uploaded.
