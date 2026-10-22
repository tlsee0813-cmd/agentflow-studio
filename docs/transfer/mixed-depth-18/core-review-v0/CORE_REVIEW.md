# AREA18 independent core review — pre-fix question signal

2026-10-22. Reviewer: Astra subagent. Product: work/product18-author, uncommitted core candidate over 7bea120983c3571b26164d6acd40f350611a7213. No product files changed. UI not reviewed.

## Confirmed P2: exporting work hides an unanswered child question

Input: create Parent and its Child; submit a request to Child; receive mock advice with an explicit synthetic fact question; inspect subtreeSignals(Parent); markHandoff the same work to clipboard without answering, editing or changing the task; inspect again.

Expected: the same active question and its Child/task ownership remain in Parent's signals. Export records delivery preparation, not an answer or resolution.

Observed in the first independent Node24.19.0 supplementary probe:

```json
{"case":"question_before_export","applicability":"active","count":1}
{"case":"question_after_export","applicability":"active","count":0}
```

Cause in the reviewed source:
- app/continuity/src/shared/attention.ts:69 takes questions only from checkItems.
- attention.ts:54 admits only taskStatus values in DECISION.
- app/continuity/src/shared/domain.ts:402 returns the handoff status before the active-question status at :403.
- New hierarchy18.test.mjs:68-72 covers question creation and answering, but not exporting while the question remains active.

Minimal repair: derive hierarchy question signals from the recorded question/applicability/owner, independently of the taskStatus display priority. No new issue ledger is necessary. Retain the honest distinction between a recorded answer and an externally resolved problem.

The companion question-export-probe.mjs encodes this expectation and exits nonzero against the pre-fix code. Its new execution output is recorded separately; the output above is the first exploratory execution, not a fabricated run of the companion script.

### Independent follow-up

By the time the companion probe ran, the author had fixed the projection. It exited 0 and preserved the same active task/area question after export. `question-export-current-pass.log` is that real supplementary run; it is not a pre-fix failure. The post-fix attention.ts SHA256 was 371d1b5e730f37f08d89b8569673776bbd05ba673c13c9a5d2e820c669848afe. The author separately reports preserving their pre-fix failing and post-fix passing regression logs.

The post-fix direct task loop omitted checkItems' existing test_answer exclusion. Independent reproduction: submit a test_answer task, receive a synthetic question, then inspect taskStatus and subtreeSignals. taskStatus remained `시험 문맥 · 실제 요구 아님`, but subtreeSignals returned one unmarked `사실 확인 항목 있음` question with applicability=active. This is a second P2 authority regression at attention.ts:74-77, distinct from export persistence. The minimal repair is preserving the synthetic-task exclusion, not introducing a new question ledger. It was sent to root and the author immediately.

The author corrected that omission before the companion synthetic probe's first run. `question-synthetic-first-run.log` therefore records a genuine post-fix pass (questions=[]), not a pre-fix failure. The exploratory failing observation above came from the earlier inline Node execution. Attention source SHA256 at this pass: 9c506ed0a3acdad68a49a16733f2f8984bbee9ee7681a7ec00c56fb1cfc743e2; its TypeScript transpile output again matched dist byte-for-byte. Domain source at this comparison was 4c65bbe1cf38a3b2acddafcaec676fbe4e452658d9c334bf3788d8498e91f985 and also matched dist.

## Source identity and execution limits

Before the exploratory probe, TypeScript 5.8.3 transpile output (ES2022) was byte-equal to the existing dist JavaScript for all five reviewed shared modules. Source SHA256 values at that comparison:

| File | SHA256 |
|---|---|
| types.ts | 6b5865ab6e85ee19187bfe62748cd073cc90e3e7e96595da0423c46869180316 |
| domain.ts | f239b46a21478153d287d2a17377630958cdbc4f124b592d51e0dd2b48c362b4 |
| validation.ts | a6fa118a7ac14f286ddac9fad34cf8af7c65eb3bead451b7e2acd876ba242aa8 |
| hierarchy.ts | c9e5a4d9679e6720bc5cd3b86e624904d17a5a7d22b8806d574640ddad605ffa |
| attention.ts | 3574b9b784f915b18f07323717b46ee6c3e4a4e6b89a78c7f1f57c3afa5316e1 |

During subsequent compatibility probes domain.ts changed to 4c65bbe1cf38a3b2acddafcaec676fbe4e452658d9c334bf3788d8498e91f985; root identified a concurrent freeSlot spacing adjustment. The other four hashes stayed equal. This is not a whole-candidate freeze or a Node22/browser acceptance result.

## Narrow compatibility observations

Independent supplementary probes passed: fixed project6-accepted.json tasks and explanation history preserved; expected valid/user/held descriptions preserved; root parent attach-detach followed by reparse remains stale; anchor.2 recovery cannot promote an external entry across a user correction; old project.6 future keys rejected; return.1 understanding forbidden and return.2 understanding required (null allowed); project.5 export late return.2 retains exact formatted rawText while its description remains no-anchor. These are specific domain observations, not a full regression or screen acceptance.

## Authority question sent to coordinator, not yet classified as a defect

An explicit decision recorded on a parent-area task still appears in a child handoff under '나머지 보존 기준 (현재 값)' via existing domain.ts:477-478, although the new ancestor-note block forbids automatic inheritance. This all-bases behavior predates AREA18. Coordinator should determine whether owner/role labelling is needed to satisfy the new child-scope contract; no source was changed and no semantic-conflict detector is proposed.

### Coordinator-approved scope qualification: independent follow-up

The coordinator approved a distinct other-area record section while preserving user authority in the scope stated by the original text. The author implemented it. Domain source SHA256 b7218594345f34c4d9343b5cb75100da50acb0c650ac7370e8263984db5c3a43 matched its dist transpile output.

`basis-scope-probe.mjs` / `basis-scope-current.log` independently check two decisions recorded in the same parent task: all child screens must support keyboard operation; only the parent administration screen is read-only. Both exact texts, basis IDs, revisions, source IDs and recording owner survive in the separate section. Neither is printed as a direct child basis; the section explicitly preserves common requirements in their original scope and forbids deriving scope from the recording task or automatically inheriting into the child. The project is unchanged and reparses. This is a successful handoff representation boundary, not evidence that a downstream model will always interpret natural language correctly. Requested items in the same section retain their '요청 원문 · 해석 미확정' label.

`legacy-boundary-probe.mjs` and `legacy-boundary-current.log` preserve the reproducible narrow legacy checks described above. No full suite, Node22, browser or UI acceptance is claimed by this review.
