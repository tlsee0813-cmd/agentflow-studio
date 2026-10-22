# Exact df726 CI observation

Run39805110367. Ubuntu119916130389 completed/success. Windows119916216667 status provider still says in_progress while recovered job log has RECEIVED20 Ran11/11failures+2errors and process exit1 at15:41:54UTC, artifact finalized15:41:57, cleanup15:41:59. Do not count Windows as passing or silently reconcile provider disagreement. No merge.

Correction after direct source inspection: the first hypothesis about Python read_text was inaccurate. select() generated an LF JSON string, Path.write_text wrote CRLF on Windows, then returned the pre-write LF string. The product reads arrayBuffer with TextDecoder(fatal:true, ignoreBOM:true) and preserves CRLF. Both raw equality failures and test04 rawText==raw lookup errors follow from the fixture expectation. The original hypothesis remains in immutable ce42f7ba. Fix69b478 returns path.read_bytes().decode('utf-8'); only textarea.input_value compares the HTML API LF representation. Saved rawText, exact T lookup and downloaded UTF-8 bytes retain exact equality. Product source stays3431CB.

Both job responses logTruncated:true; these are provider response windows, not complete logs. Windows first two log attempts HTTP502; same CodeReview endpoint later succeeded. No CLI/GitHubCI fallback or rerun/cancel.
