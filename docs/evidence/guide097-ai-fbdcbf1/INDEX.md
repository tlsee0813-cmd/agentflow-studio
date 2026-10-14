# GUIDE097 actual-model evidence — meaning quality HOLD

Original tested source: **`fbdcbf1e3624f654f5ce5abbe274f2b8ebded9f1`**, branch `feat/area-guidance097`. New publication branch is evidence-only, based on this exact source. All 11 actual model responses are included, including the rejected one. No new AI calls or success-only selection.

## Files and fidelity

- [run.json](run.json): actual model, options, call counts, timing and usage.
- [fixtures.json](fixtures.json): frozen synthetic user inputs and answer branches; expected criteria never sent to model.
- [assessment.json](assessment.json): observations versus interpretation, limits and next changes proposed only.
- `calls/*.json`: complete actual product context request, original received model message/content, product HTTP acceptance/rejection, draft text, adoption outcome and safe metadata.

`actualModelResponse.message.content` is the unchanged received string, not corrected JSON. `productResponse.body` is parsed HTTP JSON. Provider wrapper completion IDs/created timestamps are omitted; model/usage/finish/content are retained. No headers, secret values/placeholders, session tokens, environment, protected-adapter code, source/runner files, packages or binaries are published. Synthetic project/ticket/basis IDs are app data, not session credentials.

## Product defaults versus experiment overrides

| Option | Exact product default / behavior | Actual test |
|---|---|---|
| model | deepseek-flash | same |
| timeout | **15000 ms** in readConfig | **60000 ms experiment override** |
| max_tokens | **2048** in readConfig | **4096 experiment override** |
| thinking | disabled hardcoded in buildGuideBody | same product behavior |
| temperature | omitted by buildGuideBody | not sent |
| stream / response_format | false / json_object | same |
| rate / product cap | 6/minute / 20 | unchanged; sequential test cap11 |

**60s and output4096 are test settings, not product defaults. Thinking-off is product body-builder behavior.** No price research.
[Config at tested SHA](https://github.com/tlsee0813-cmd/agentflow-studio/blob/fbdcbf1e3624f654f5ce5abbe274f2b8ebded9f1/app/server/config.mjs) · [Body builder at tested SHA](https://github.com/tlsee0813-cmd/agentflow-studio/blob/fbdcbf1e3624f654f5ce5abbe274f2b8ebded9f1/app/continuity/server/prompt.mjs)

## All 11 calls

| Slot / original evidence | Provider HTTP | Product HTTP | finish | ms |
|---|---:|---:|---|---:|
| [C1-INITIAL](calls/C1-INITIAL.json) | 200 | 200 | stop | 2846 |
| [C1-A](calls/C1-A.json) | 200 | 200 | stop | 3052 |
| [C1-B](calls/C1-B.json) | 200 | 200 | stop | 3232 |
| [C2-INITIAL](calls/C2-INITIAL.json) | 200 | 502 | stop | 2421 |
| [C3-INITIAL](calls/C3-INITIAL.json) | 200 | 200 | stop | 2417 |
| [C3-UNKNOWN](calls/C3-UNKNOWN.json) | 200 | 200 | stop | 2916 |
| [C3-DEFERRED](calls/C3-DEFERRED.json) | 200 | 200 | stop | 3296 |
| [C3-LATEST](calls/C3-LATEST.json) | 200 | 200 | stop | 3193 |
| [C4-INITIAL](calls/C4-INITIAL.json) | 200 | 200 | stop | 2747 |
| [C4-A](calls/C4-A.json) | 200 | 200 | stop | 3180 |
| [C4-B](calls/C4-B.json) | 200 | 200 | stop | 3110 |

Provider HTTP200/stop=11; product200=10, product502 INVALID_RESPONSE=1. Local-unsent429=0; native rate window waited once; provider retry/regeneration0. All actual model IDs are deepseek-flash. Product latency2.417–3.296s, median3.052s.

## Summary quote → original mapping

| Summary claim / quote | Exact call and JSON location | Judgment |
|---|---|---|
| “남은 재료를 어떤 화면으로 보고 싶으세요?” | [C1-INITIAL](calls/C1-INITIAL.json), actualModelResponse.message.content → question | Presentation-first question; not shopping vs first-to-eat purpose. |
| A line-list versus B visually choosing what to eat first | [C1-A](calls/C1-A.json), [C1-B](calls/C1-B.json): productResponse.body.reply.proposal and draft | Real scope/check differences; no assumed expiry data. Practical adequacy partial/uncertain; A selects unchosen phone/list details. |
| fact with two options | [C2-INITIAL](calls/C2-INITIAL.json): actualModelResponse.message.content, contractDiagnosis, productResponse | FAIL: provider200/product502, fact requires options=[]. Unnecessary format question. Dotfile edit/adoption NOT_EXECUTED because no accepted proposal. |
| Unknown proceeds to ID frequencies; deferred excludes duplicate judgment | [C3-UNKNOWN](calls/C3-UNKNOWN.json), [C3-DEFERRED](calls/C3-DEFERRED.json): proposal.scope/checks | Unknown useful; deferral overly conservative. No destructive policy invented. |
| “제외된 행 수 합계가 원본 행 수와 맞는지” | [C3-LATEST](calls/C3-LATEST.json): proposal.checks | Flawed arithmetic; retained + excluded should equal input. Maximal retained timestamp not explicitly checked. |
| “이번에 만들 결과물은 어느 쪽에 더 가까운가요?” | [C4-INITIAL](calls/C4-INITIAL.json): question | Deliverable-format question misses important permission conflict. |
| Offline/file-based/design-only preserved | [C4-A](calls/C4-A.json): proposal and draft | A core constraints PASS. |
| Explicit notice-only network allowance ignored | [C4-B](calls/C4-B.json): request.decisions + request.answer; proposal.goal/scope; draft.formatterText | FAIL: proposal still bans network. Full answer appended, but contradictory draft remains. |

## Critical provenance and adoption

C4-B actual request retains confirmed “네트워크 사용은 금지합니다.” together with the actual provided amendment “공지 전달용 네트워크만 허용하도록 기존 네트워크 금지 조건을 바꿀게요…”. No original basis was edited or retired. Speculative phone idea is area.note; explicit change is request.answer.text. Read both alongside proposal and draft in the same C4-B JSON. Text preservation does not establish semantic consistency.

Seven valid proposals used actual candidate `proposalText(areaName,proposal,first,request.answer)` then `adoptProposal`. They became exact unsent drafts with full actual question/answer and existing Source/Task/Basis preserved. User term guideDraftText denotes this role; it is not the exported function name. No subsequent submit/continuity/handoff AI. CLI dotfile editing untested due rejected response. These short cases do not re-exercise 12000-character or native UI preservation boundaries.

Construction: normal createProject/rename/setBrief/addArea → unplaced condition-recording request → recordBasis → selected-area buildGuideRequest. The original requested basis remains in Project but is excluded by normal guidance builder; areaWork is empty. No prior AI response was seeded. Later branches reuse the actual initial question unchanged and frozen free-text answers. Criteria were never placed in product request/prompt. Initial preparation metadata was 6fae21a; actual source for these results is fbdcbf1.

## Scope and limits

Only INDEX, fixtures, assessment, run, eleven call JSONs and hashes under docs/evidence/guide097-ai-fbdcbf1/. All four cases and all eleven outcomes, including model/product failure, are present. No content sentence was edited to fit the verdict. No source/prompt/adapter/runner/env/header/binary files. No new calls, prompt tuning, CI, PR, deployment or main/dev/gh-pages edits. Synthetic evidence is not human evaluation or overall quality assurance.
