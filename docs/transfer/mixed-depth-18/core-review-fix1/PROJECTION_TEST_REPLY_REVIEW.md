# AREA18 original question / synthetic reply — independent narrow review

2026-10-22. Read-only product review; no server/browser/product writes. Supplementary local Node v24.19.0 execution, not the required Cloud/Node22 or visual acceptance.

Reviewed `attention.ts:74-82` and new `hierarchy18.test.mjs:118-127`. The projection preserves a question only when the first source is a real request and every synthetic-answer source explicitly replies to the current question text. It adds `시험 답변 기록 · 실제 답변 아님`; it retains the existing `answered`/`applicability` meaning of a recorded reply. The row renderers include this status. This does not claim that the original question was answered with real evidence. First-input test context and a different regenerated question remain excluded. Same-text regenerated generations cannot be separated by existing task/text provenance; the source states that limitation rather than inferring a generation.

Independent local execution:

```
node v24.19.0; TypeScript 5.8.3
attentionTranspileEqualsDist: true
node --test --test-name-pattern='original question retains attributed synthetic reply' continuity/tests/hierarchy18.test.mjs
powertoys: pass
product13: pass
tests 2; pass 2; fail 0; exit 0
```

Both tests exercise public submit/receive/answer/begin APIs; assert original-question preservation and explicit synthetic status; verify unchanged bases/global question status semantics; exclude a different post-test question and a test-created original; and round-trip saved state. These are two fixture variants of the same boundary, not independent external semantic samples. No additional important defect identified in this narrow projection.

Reviewed attention SHA256: `affaa930475942a73535ee4c995931ae5853ef308423175cfbd3835489ff770d` (same before/after execution).
Reviewed test SHA256: `b1b000e1ebbd1610c0ce777bb97fb1681a3e9875937f596bbecf73e819875ff9` (same before/after execution).
