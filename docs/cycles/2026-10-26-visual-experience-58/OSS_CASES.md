# UI58 source-grounded OSS cases

These are read-only, fixed-commit repository extracts for reviewing AgentFlow Studio's map and inside navigation. They are selected subsets with reviewer-chosen placement, **not official architecture diagrams or executed OSS workflows**. No repository was cloned, installed, built, or run. No invented agent report, completed task, evidence result, or successful test is seeded.

| Case | Source commit | Parts / depth / links | What it exercises |
| --- | --- | --- | --- |
| Joplin desktop and shared packages | [0c9e457](https://github.com/laurent22/joplin/commit/0c9e457db81108660b96effbc767aea599d6ca90) | 30 / 4 / 8 | Desktop editor hierarchy; one shared lib/editor/renderer identity used by several apps; sparse roots |
| restic commands | [dd09b6b](https://github.com/restic/restic/commit/dd09b6bd01af220b1d5d95c0d4d7d472e05e05c4) | 29 / 3 / 4 | Many same-prefix command names; root list vs key list; root snapshots vs repair snapshots |
| Node-RED built-in nodes and runtime | [df0a87c](https://github.com/node-red/node-red/commit/df0a87cce1a243e21a2e0eb0fdbdbb8c4732392f) | 32 / 4 / 8 | Network/MQTT/TCP/UDP, data parsers, sequence and file automation; shared TLS configuration |

## Input contract

`OSS_CASES.json` contains `cases[i].spec`, which directly matches the existing `buildExample(spec)` outline in `app/continuity/src/shared/studio-examples.ts`: `id`, `name`, `brief`, `parts[{key,name,note,parent?}]`, `relations[[from,to,kind,note]]`, and `records: []`. Use `buildExample(case.spec)` through the existing application build; do not pass the surrounding research metadata. Keys remain stable even when names are changed for stress tests. Preserve parent-before-child insertion order.

`sources` contains immutable source URLs. `provenance.parts[key]` and `provenance.relations[index]` cite those IDs and distinguish official names/facts from reviewer grouping. Reading file existence is sufficient evidence for a filename, but not for an uninspected implementation dependency.

## Source fidelity

Joplin's [architecture document](https://github.com/laurent22/joplin/blob/0c9e457db81108660b96effbc767aea599d6ca90/readme/dev/spec/architecture.md) explicitly describes shared application backend, services, models, SQLite and a typical server deployment. The [desktop](https://github.com/laurent22/joplin/blob/0c9e457db81108660b96effbc767aea599d6ca90/packages/app-desktop/package.json), [mobile](https://github.com/laurent22/joplin/blob/0c9e457db81108660b96effbc767aea599d6ca90/packages/app-mobile/package.json), and [CLI](https://github.com/laurent22/joplin/blob/0c9e457db81108660b96effbc767aea599d6ca90/packages/app-cli/package.json) manifests establish the eight selected package links. GUI nesting follows actual directory listings. Putting settings/SQLite under a conceptual lib branch and typical deployment elements under Server is explicitly reviewer grouping; PostgreSQL/S3/Nginx are not asserted to be mandatory.

restic's [main command registry](https://github.com/restic/restic/blob/dd09b6bd01af220b1d5d95c0d4d7d472e05e05c4/cmd/restic/main.go), [key registration](https://github.com/restic/restic/blob/dd09b6bd01af220b1d5d95c0d4d7d472e05e05c4/cmd/restic/cmd_key.go), and [repair registration](https://github.com/restic/restic/blob/dd09b6bd01af220b1d5d95c0d4d7d472e05e05c4/cmd/restic/cmd_repair.go) establish actual CLI nesting. Every selected command's Use declaration was read. The four links expose the shared global.Options argument in constructors; no backup→forget→prune execution chain is invented.

Node-RED nesting follows the [core source directories](https://github.com/node-red/node-red/tree/df0a87cce1a243e21a2e0eb0fdbdbb8c4732392f/packages/node_modules/@node-red/nodes/core). Leaves are actual source files, **not a claim that each file defines exactly one node type**. Package links come from [runtime dependencies](https://github.com/node-red/node-red/blob/df0a87cce1a243e21a2e0eb0fdbdbb8c4732392f/packages/node_modules/@node-red/runtime/package.json#L18) and [node-red dependencies](https://github.com/node-red/node-red/blob/df0a87cce1a243e21a2e0eb0fdbdbb8c4732392f/packages/node_modules/node-red/package.json#L33). MQTT, HTTP request and WebSocket source each look up a configured TLS node; these are `related`, explicitly optional, with line citations in JSON. There is no fabricated sensor/data execution flow.

## Derived stress inputs

These stay separate from the source cases, with exact recipes under `derivedStress` in JSON:

- **Sparse Joplin:** retain four real roots and only links whose endpoints remain. No synthetic source fact.
- **Long-prefix restic:** use the synthetic template `restic repository review / {originalName}` on three repair leaf names. The resulting names share a 41-character prefix and are 46/46/50 JavaScript characters, within the existing 60-character limit. Original source names stay unchanged in the base case; the added prefix is not an official command.
- **Repeated Node-RED subparts:** append three children named 설정 under network/parsers/storage, each with a unique key. Notes state that these are synthetic. No extra links or reports.

## Review matrix and evidence boundary

For each base and derived case, inspect **1280×720 and 1440×900**: overview density/overflow, selection, inside navigation, folding/unfolding, back/breadcrumb context, relationship endpoints across focus boundaries, label wrapping and repeated-name identity. The JSON includes a concrete checklist. A click to select must be distinguishable from entering a child view; folded descendants must not corrupt endpoints or selection.

Dataset structure was checked for unique keys, parent-before-child order, existing relation endpoints, and resolvable part provenance references. Counts above are calculated from the written payload. This extraction **does not claim browser checks passed**. UI reviewers must record case, viewport, action, observed result and screenshot path in their own evidence. Input/output AI connectors are outside this review.

