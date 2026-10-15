# GUIDE098 actual retest — EXECUTION HOLD

Tested exact source: **`ec9011d3aea3fd5182d239b8f38b113382f7dd96`**, branch `feat/area-guidance097`; evidence branch is based on that exact commit. Contract guidance.2. Structural review/CI acceptance was reported as confirmed by the coordinating reviewer; not rerun here.

**No actual model response was received.** There were 6 protected transport attempts (5 primary initial cases plus 1 C1 diagnostic), 0 upstream HTTP responses, and 6 product HTTP504 AI_TIMEOUT errors. Requests reaching the remote provider, remote processing or billing cannot be established from these attempts. Do not label these as model-auth rejection, token-limit failure, semantic regression, or successful evaluation.

## Start here

- [run.json](run.json): settings, conservative attempt counts and response limits.
- [assessment.json](assessment.json): facts, untested branches, prior comparison and next steps.
- [fixtures.json](fixtures.json): original four unchanged cases and the heldout rhythm input, separate from model requests/criteria.
- [diagnostic.json](diagnostic.json): same-material check and the one declared setting change.
- [holdout-A-not-executed.json](holdout-A-not-executed.json): frozen semantics and real input-representation limit.
- `calls/*.json`: every attempted actual product request, received product error and safe transport/timing data. `actualModelResponse` and upstream HTTP status are null because they do not exist; no successful raw reply is hidden.

## Shipped defaults and diagnostic change

| Option | Product default | Primary calls | Single C1 diagnostic |
|---|---|---|---|
| model | deepseek-flash | requested same | requested same |
| timeout | 15000ms | 15000ms | **60000ms only** |
| output limit | 2048 | 2048 | **2048 unchanged** |
| thinking | disabled in buildGuideBody | disabled | disabled |
| temperature | omitted | not sent | not sent |
| rate / product cap | 6/minute /20 | unchanged, sequential | same persistent server/limiter |

Prior fbdcbf1 used 60s/4096 evaluation overrides. Those were not inherited. Primary config was produced by current readConfig without timeout/output overrides. The only diagnostic followed a primary timeout: timeout alone was temporarily changed and restored; its failure does not replace the primary result. There was one diagnostic total, no further repeats. First/diagnostic material matched exactly apart from ticket, shown in diagnostic.json. No token-limit finish was seen because no provider response arrived.
[Source defaults](https://github.com/tlsee0813-cmd/agentflow-studio/blob/ec9011d3aea3fd5182d239b8f38b113382f7dd96/app/server/config.mjs) · [Product body builder](https://github.com/tlsee0813-cmd/agentflow-studio/blob/ec9011d3aea3fd5182d239b8f38b113382f7dd96/app/continuity/server/prompt.mjs)

## All attempted calls

| Actual request / outcome | Timeout ms | Output cap | Product | Provider HTTP/model/finish | Latency ms |
|---|---:|---:|---|---|---:|
| [C1-INITIAL](calls/C1-INITIAL.json) | 15000 | 2048 | 504 AI_TIMEOUT | not received | 15024 |
| [C1-INITIAL-DIAG](calls/C1-INITIAL-DIAG.json) | 60000 | 2048 | 504 AI_TIMEOUT | not received | 60006 |
| [C2-INITIAL](calls/C2-INITIAL.json) | 15000 | 2048 | 504 AI_TIMEOUT | not received | 15004 |
| [C3-INITIAL](calls/C3-INITIAL.json) | 15000 | 2048 | 504 AI_TIMEOUT | not received | 15004 |
| [C4-INITIAL](calls/C4-INITIAL.json) | 15000 | 2048 | 504 AI_TIMEOUT | not received | 15006 |
| [HB-INITIAL](calls/HB-INITIAL.json) | 15000 | 2048 | 504 AI_TIMEOUT | not received | 15004 |

All six complete request/response-error records are preserved. Native rate/local429=0, hidden mock=0, provider raw response files=0. The script exited0 because orchestration completed, not because calls or quality passed. Product timeout triggers cancellation: adapter event CANCELLED follows the product AI_TIMEOUT. The actual upstream error/status is unknown.

## Case comparison with previous evidence

| Case | Previous fbdcbf1 observation | Current ec9011d3 result |
|---|---|---|
| C1 food | Real A/B replies differed but presentation-first question and practical adequacy were partial | Initial15s and diagnostic60s timeout; no actual question, A/B unexecuted |
| C2 CLI | Provider200 but product502 for fact/options mix; dotfile edit blocked | Initial15s timeout; no proposal, dotfile edit/adoption untested |
| C3 CSV | Unknown useful; deferral overly narrow; latest completion arithmetic flawed | Initial15s timeout; unknown/deferred/latest branches unexecuted |
| C4 kiosk | A core constraints preserved; explicit B amendment contradicted by proposal | Initial15s timeout; A/B unexecuted, no new semantic verdict |
| HB rhythm heldout | New frozen generalization case | Initial15s timeout; defer/100ms comparison unexecuted |
| HA PNG heldout | New frozen generalization case | No call: request representation missing |

[Previous complete GUIDE097 evidence](https://github.com/tlsee0813-cmd/agentflow-studio/blob/f03e0594e07a2ec090653f44a14b4390c2c78aa8/docs/evidence/guide097-ai-fbdcbf1/INDEX.md). No current improvement/failure rate is inferred from previous outputs or new source text.

## Input, defaults and boundary honesty

Current buildGuideRequest generated every attempted request; no old guidance.1 JSON was relabelled by hand. Original four Project fixtures and user phrases were reused. HB used normal createProject/setBrief/addArea/recordBasis operations from the separately frozen input meaning. Expected answers/criteria were not sent in requests or product prompt.

The current contract still lacks a dedicated current explicit request. HA amendment cannot be silently placed in area.note as an authoritative instruction, put into an invented question answer, or tested after pre-editing its old rule. HA is NOT_EXECUTED_INPUT_REPRESENTATION, not a model failure.

guidance.2 proposal.defaults is mandatory, limited to6 items of500 characters and kept apart from open/user decisions; exact duplicate open/default text is rejected. The current formatter labels defaults as AI suggestions and keeps full question/answer. **None of those response/adoption semantics was exercised because no model reply arrived.** No schema success, defaults safety, CLI edit preservation or new permission handling is claimed.

## Narrow no-cost follow-up and remaining cause

One TCP-only connect to the already configured protected proxy succeeded; zero HTTP requests/credentials were sent by that probe. Native local product HTTP succeeded (returned504). This narrows only socket reachability. It does not prove protected HTTP/TLS, upstream availability, secret substitution, authentication or model readiness. Proxy/CA/TLS/settings were not changed. No further AI calls were attempted after the bounded run.

## Next minimum action

First restore/verify response delivery through the supported protected HTTP path or upstream service. Do not bypass proxy/TLS/domain controls, disclose secrets, silently raise shipped defaults or tune prompts from this result. 60s did not restore a response, so a timeout increase is not demonstrated to solve it. After response delivery is restored, rerun the same frozen inputs with shipped defaults, then only actual-question branches and actual-proposal adoption. Treat HA as a separate real UI/contract capability gap if still unrepresentable.

## Publication scope

Small text/JSON only under docs/evidence/guide098-ai-ec9011d3/: all six attempted requests and received product errors, declared settings/diagnostic, input fixtures, assessment and hashes. No secret values/placeholders, auth headers, environment configuration, protected-adapter/source/runner files, personal data, binary, packages or ZIP. The publication adds no AI calls. Synthetic ticket/project IDs are app data, not session tokens. Main/dev/gh-pages/PR and deployment untouched. Source/prompt and frozen inputs unchanged.
