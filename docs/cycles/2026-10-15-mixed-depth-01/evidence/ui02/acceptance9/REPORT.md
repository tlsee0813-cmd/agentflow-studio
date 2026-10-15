# Acceptance 9 independent regression

Status: **fix3 generated-markup/event/state regression PASS**. This package contains independent Node observations with synthetic element and geometry stubs. It contains no independent browser execution and cannot establish actual visibility, clipping, hit testing or mobile scroll reachability.

## Version and provenance

- Frozen v1 checker: `check.v1-frozen.cjs`, SHA256 `8B2E536D82D73FA0E72B76EC07082DA1BFEBB36B02008117177055A103443F2B`.
- Expanded v2 checker: `check.v2-L3.cjs`, SHA256 `9F51C7507BB2CE901613B808AEB8461C9BFFE0F9EF97AFF49257DAF2F124A2FF`.
- Fix1 source SHA256: `869C76A45F16042EC0A5063C81D1E638D21A2A3E87CE079B6BC5A60843632157`; historical source is recoverable at commit `666437a427b3039fb6321dfec41edd6eb24e164f`.
- Fix2 source SHA256: `8E6BE6B02A711F525941FE4408E7679C58696BD99C64C6A2D020BA23C1E78A1C`.
- Fix3 source SHA256: `0AEEDD515E7F80F4B091BA1B395F90E0D19355A9EB3CA6C7E1174AD48FA2898C`.
- Existing I1–I5 fix3-bound checker: `check.I1-I5.fix3.cjs`, SHA256 `2CEEEA4775ABD6052DF98CBF9C960F14B9E2912663D959ECABBB418EA704812F`. Only candidate SHA and input/output path bindings were adapted; the original assertions were retained.

The first v1 console observation was 13 cases: 3 pass, 10 fail; 90 atomic assertions: 72 pass, 18 fail. Its original JSON was overwritten during expansion before the freeze request arrived. The exact checker was recovered and its hash matched. `results.fix1.v1-reexecution.json` is a newly timestamped reproduction of those counts, **not the original timestamped result**.

`MANIFEST.json` records the original raw-result hashes and packaged-result hashes. Only JSON `sourcePath` was semantically changed, to a version/hash identifier. Checkers were copied byte for byte. Execution timestamps and observations are retained. Baseline HTML is not duplicated in this package.

## Scope

- C: collapsed A summary, excluding its nested endpoint list.
- L1: A2 button inside collapsed A's endpoint list (`cl-A2`).
- L2: A2 button inside B's endpoint list (`ins-ep-A2`).
- L3, added in v2: A2 button in the outline's relationships section (`ol-rel-A2`). It is an actual endpoint list and is mandatory.
- B: B's `미결 참조` section. Its unresolved text and owner are INPUT 9 content checks. A direct A2 action in that section is an additional coordinator usability requirement, separately attributed in the JSON.

The generic outline structure row `ol-A2` is an optional discoverability observation. A separate unresolved badge there is not required for INPUT 9. No global HTML string search can substitute for a missing local reference.

## Results

| Source / checker | Cases passed / total | Atomic assertions passed / total | Failed scope |
|---|---:|---:|---|
| Fix1 / frozen v1 re-execution | 3 / 13 | 72 / 90 | Original narrowed contract |
| Fix1 / expanded v2 | 3 / 15 | 86 / 108 | 18 INPUT 9 reference/regression + 4 coordinator B direct action |
| Fix2 / expanded v2 | 9 / 15 | 104 / 112 | 4 INPUT 9 L3 reference + 4 coordinator B direct action |
| Fix3 / identical expanded v2 | 15 / 15 | 118 / 118 | None |
| Fix3 / existing I1–I5 assertions | 5 / 5 | 14 / 14 | None |

Fix2 passes C, L1 and L2 in S2 and S3. L3 still lacks decision change and A2-owned unresolved references. B's existing unresolved policy and owner A2 pass; its direct unresolved-navigation action is absent. S1 does not expose the E04 unresolved policy; A4/A6 own changes are not invented; exactly A2–B, A4–B and A6–B remain; current A2 unresolved data and view restoration pass.

Fix3 passes C/L1/L2/L3/B in both S2/S3, including A2-owned unresolved references and local A2 navigation. Its 118 assertions comprise 108 INPUT 9 reference/regression assertions and 10 separately attributed coordinator B direct-action usability assertions. S1 future-information checks, A4/A6 non-propagation, three relationships, collapse/focus/overview return, L3 outline scroll return, and mobile B generated-detail navigation all pass. Generic `ol-A2` still lacks an unresolved badge in S2/S3; this remains an optional discoverability observation, not an acceptance failure.

The five existing regressions pass separately: relationship endpoint counts, nested A4→A2→B return, independent focus/overview state, handoff/baseline content, and outline scroll restoration. These results do not replace the newer regional acceptance 9 checks.

Case counts and atomic assertions are distinct. Conditional navigation assertions run only when a local control exists, so assertion totals may increase after a repair.

## Browser and limitations

Independent browser: **NOT_RUN by this verifier**. Separate cloud browser observations must establish 1440/390 actual visibility, mobile C/L1/L2/L3/B access, and clickability. Author self-checks must not be combined with these independent Node results.

No implementation file or pre-existing `evidence/ui02/independent/` artifact was edited by this verifier. No remote write was performed.

To repeat a candidate run from the cycle directory, pass explicit source and output paths to the packaged checker: `node evidence/ui02/acceptance9/check.v2-L3.cjs canvas-study.html <new-output.json>`. The I1–I5 copy uses the same two arguments and is pinned to the fix3 source hash. Default paths inside the byte-identical v1/v2 checkers refer to the original local working arrangement; use explicit arguments when sharing.
