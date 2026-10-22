from pathlib import Path
import subprocess,json,hashlib,shutil
R=Path(__file__).parent;D=R/'delivery';D.mkdir(exist_ok=True);A=R.parent/'cycle17-fix2-candidate';S='e17370e83edccaf954b419054ee4748233752922';repo='/workspace/agentflow-studio';sha=lambda b:hashlib.sha256(b).hexdigest()
keepPNG={'whole/1-1280-located-short.png','whole/2-1440-new-request-return-button.png','whole/3-1440-after-map-return-new-current.png'}
for f in R.rglob('*'):
 if not f.is_file() or 'delivery' in f.relative_to(R).parts or '__pycache__' in f.parts:continue
 rel=f.relative_to(R)
 if f.suffix=='.png' and str(rel) not in keepPNG:continue
 if rel.parts[0]=='commands' and len(rel.parts)>1 and rel.parts[1]=='browser-outputs':continue
 to=D/rel;to.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(f,to)
shutil.copy2(R.parent/'cycle17-counterexamples/check.mjs',D/'frozen-check.mjs');assert sha((D/'frozen-check.mjs').read_bytes())=='ab65a98de50e1e0277322cddcf4db7975e6e737a92483dbf06fbb4a7c58e6c02';rows=[]
for path in subprocess.check_output(['git','-C',repo,'ls-tree','-r','--name-only',S,'--','app','experiments/idea016/cases.mjs']).decode().splitlines():
 before=subprocess.check_output(['git','-C',repo,'show',S+':'+path]);after=(A/path).read_bytes();assert before==after;rows.append({'path':path,'bytes':len(before),'pinnedSHA256':sha(before),'executionDiskAfterSHA256':sha(after)})
(D/'SOURCE_BINDING.json').write_text(json.dumps({'source':S,'files':rows,'method':'remote fetch fixed object, git archive separate scratch; each tracked source compared against exact blob after all execution. Generated HTTP bytes audited separately.'},indent=2))
reuse=subprocess.check_output(['git','-C',repo,'diff','--name-only','d56eee9ac8233263d46a4e4c45755a80b471cc84',S,'--','app/continuity/src/shared','app/continuity/public/styles.css']).decode().splitlines();assert not reuse
(D/'REUSE_SCOPE.json').write_text(json.dumps({'priorSource':'d56eee9ac8233263d46a4e4c45755a80b471cc84','priorEvidence':'f6dde37baf44469b6b2a6a2ec2c1bd2d9bcbe4ea','unchangedSharedCSSPathsDiff':reuse,'priorLongRoleTestsAreNotNewE173Executions':True,'thisExecution':'only frozen4/state8/build, actual new-request/location routes and narrow influence boundaries; no whole historical reruns'},indent=2))
P=D/'preview';P.mkdir(exist_ok=True)
for name in ['client/app.js','styles.css']:
 to=P/name;to.parent.mkdir(exist_ok=True);shutil.copy2(A/'app/continuity/static-dist'/name,to)
(P/'BUILD.json').write_text(json.dumps({'source':S,'command':'node continuity/scripts/build-static.mjs','exit':0,'overlay':'client/app.js and styles.css over exact d56 cycle17 static MOCK runtime including its shared modules; shared/CSS source unchanged, no deployment','priorSharedRuntime':'f6dde37baf44469b6b2a6a2ec2c1bd2d9bcbe4ea docs/transfer/area-update-17/independent-fix1/preview/'},indent=2))
(D/'REPORT.md').write_text('''# Cycle17 e173 fix2 — narrow final independent execution

Exact source e17370e83edccaf954b419054ee4748233752922. Previous d56 failures unchanged at f6dde37baf44469b6b2a6a2ec2c1bd2d9bcbe4ea. No product edits/install/paid AI/user data/main/checkpoint/deployment. Existing Node22.16/TS5.8.3/PW1.57/system Chromium154, real localhost official MOCK. This is a narrowed final execution, not all historic UI tests on this source.

## Latest result
Latest same old locate-new-request path at both PC widths passes after selecting the new actual #work-locate-return. The original meaning remains: NEW Task count+1, new currentId, first source=request with exact submitted body, real clipboard contains current explanation, explicit restoration of original map state. The selector addition is recorded in code; no product source change.

Then whole.py executes eight independent complete routes: PowerToys/p13 restatement samples x1280x720/1440x900 x direct panel-new-request / panel-open→area-new-request. Every route actually submits a new request, copies it, and returns with new currentTask and handoff digest retained. Eight routes/four checks each, latest child/collector0, no fatal/pageerrors. Counts are not combined with old d56 runs. CLIPBOARD_RECORD independently verifies actual copied UTF16 length/FNV against all8 completed export records; concurrent clipboard-edit injection NOT_RUN.

Restoration uses the SAME received-area caller, not whichever card happens to line up. ANCHOR_POLICY.json includes before/after caller rect/pageY, map pageY, native window scroll, maxScroll, matrix, world positions/selection, disclosures and focus/hit. New-task top content changes page height: caller pageY increases67.59375, requested clamped scroll=67.59375, actual=68; caller viewport delta=-0.40625 in all8. Policy requires actual scroll≈clamp(afterCallerPageY - beforeCallerViewportY), actual caller viewport±2px, restored caller focus/hit, exact matrix/world positions/selection/disclosures. There is NO “old scroll OR cardY” shortcut. Raw full card rects remain available even when content geometry changes. New draft/current/handoff are not rolled back.

Narrow1280 boundaries: A locate with existing B draft opens B type/target/body unchanged, no incorrect A return control; other-area request is new start without A return; real new project clears locate. All3 pass, child/collector0. The empty-input core routes and protected existing-draft route are separate fixtures/actions.

Frozen original4 unchanged SHA ab65a98de50e1e0277322cddcf4db7975e6e737a92483dbf06fbb4a7c58e6c02 all0. Extra new-request/correction-recovery domain probes and state8(return1, duplicate, changed-plan stale/report preservation, v1-v5 migration/restore) all0. npm check/build, continuity check/build/static build each actual0. No author counts used.

## Preserved failed runs / checker adjustments
First same-checker execution on e173 retained old absolute scroll/card-rect equality, produced exit1 despite original matrix/selection restored. Raw/code/process/stdout are preserved in locate-new-request-first-absolute/ and whole-first-absolute/. After new top content, source policy is anchor restoration, so updated instrumentation and assertion use the actual received-area button and clamped page offset as specified above; failure was not deleted or silently called pass.

Normal short summary/changes are used in final representative screenshots; no repeated-condition or tail scaffold in base explanation. A subsequent whole-route fixture retry accidentally imported an exact duplicate (same report/summary), so no received CTA appeared: setup fatal exit1 retained under whole-duplicate-setup/. Fixture repair adds clearly synthetic evidence to make a genuine new receipt, without changing the sample’s normal short summary. Latest eight-route run is complete and distinct; partial runs not combined into it.

## Reuse and limits
Shared domain and CSS are byte-unchanged from d56 (REUSE_SCOPE). d56 long role/disclosure/wheel tests are historical supporting evidence, NOT rerun or counted as e173 passes. Current e173 actual products are shown in3 PNGs: normal short PowerToys map/detail, p13 submitted-request work-return button, and new current work still present after original-map restoration (then deliberate navigation back to work for that screenshot). No test-list image. Header/purpose/tool height and following-action folding remain observed reading burden, not redesigned here.

No automatic meaning/target extraction, human research, external execution acceptance, live cross-tab sync, Windows or unrestricted zoom claim. Cross-tab stale save was not rerun on e173; prior independent d56 support remains separate. Source binding compares all pinned source bytes after execution, http-runtime.json verifies real compiled HTTP responses against disk before/after (separate HTTP audit, not initial goto-status instrumentation). Logs/actual child and collector exits are separate, including first failed runs. Preview is two-file static MOCK overlay over d56 static shared runtime, no public deployment. Manifest exact recursive payload excludes itself; preview manifest likewise.

Conclusion: this narrow explicit-new-request return fix passes latest requested routes and influence checks; root integrates with CI and prior bounded evidence.
''')
for root in [P,D]:
 fs=sorted(f for f in root.rglob('*') if f.is_file() and f!=root/'MANIFEST.tsv');(root/'MANIFEST.tsv').write_text('path\tbytes\tsha256\n'+''.join(f'{f.relative_to(root)}\t{f.stat().st_size}\t{sha(f.read_bytes())}\n' for f in fs))
print(len([f for f in D.rglob('*') if f.is_file()]))
