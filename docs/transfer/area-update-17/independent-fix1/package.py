from pathlib import Path
import subprocess,json,hashlib,shutil
R=Path(__file__).parent;D=R/'delivery';D.mkdir(exist_ok=True);A=R.parent/'cycle17-fix1-candidate';S='d56eee9ac8233263d46a4e4c45755a80b471cc84';repo='/workspace/agentflow-studio';sha=lambda b:hashlib.sha256(b).hexdigest()
for f in R.rglob('*'):
 if not f.is_file() or 'delivery' in f.relative_to(R).parts or '__pycache__' in f.parts:continue
 rel=f.relative_to(R)
 if rel.parts[0]=='commands' and len(rel.parts)>1 and rel.parts[1]=='browser-outputs':continue
 if f.suffix=='.png' and str(rel) not in ['roles/powertoys-1280-basic-read.png','roles/p13-1440-basic-read.png','capture/1280-long-collapsed.png','locate-new-request/1440-new-request-no-origin.png']:continue
 to=D/rel;to.parent.mkdir(exist_ok=True,parents=True);shutil.copy2(f,to)
shutil.copy2(R.parent/'cycle17-counterexamples/check.mjs',D/'frozen-check.mjs');assert sha((D/'frozen-check.mjs').read_bytes())=='ab65a98de50e1e0277322cddcf4db7975e6e737a92483dbf06fbb4a7c58e6c02';rows=[]
for path in subprocess.check_output(['git','-C',repo,'ls-tree','-r','--name-only',S,'--','app','experiments/idea016/cases.mjs']).decode().splitlines():
 before=subprocess.check_output(['git','-C',repo,'show',S+':'+path]);after=(A/path).read_bytes();assert before==after;rows.append({'path':path,'bytes':len(before),'pinnedBlobSHA256':sha(before),'executionDiskAfterSHA256':sha(after)})
(D/'SOURCE_BINDING.json').write_text(json.dumps({'source':S,'contract':'87a7a0329a2663dff2fcc537baa4484722e6f52a','method':'git archive exact remote-fetched object; each pinned blob vs execution source file compared after tests; generated dist files served separately in HTTP audit','files':rows,'frozenCheckerSHA256':sha((D/'frozen-check.mjs').read_bytes())},indent=2))
P=D/'preview';P.mkdir(exist_ok=True)
for n in ['client/app.js','styles.css']:
 to=P/n;to.parent.mkdir(exist_ok=True);shutil.copy2(A/'app/continuity/static-dist'/n,to)
(P/'BUILD.json').write_text(json.dumps({'source':S,'command':'node continuity/scripts/build-static.mjs','exit':0,'overlay':'static MOCK client/app.js and styles.css over existing cycle16 static runtime; retain unchanged index/runtime/shared modules only if matching required module dependencies','warning':'candidate has reproduced failures; not approved preview or deployment'},indent=2))
# Include required changed shared static modules so overlay does not silently reuse old domain/schema.
base=R.parent/'cycle16-fix1/app/continuity/static-dist';changed=[]
for f in (A/'app/continuity/static-dist/shared').rglob('*'):
 if f.is_file():
  rel=f.relative_to(A/'app/continuity/static-dist');old=base/rel
  if not old.exists() or old.read_bytes()!=f.read_bytes():to=P/rel;to.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(f,to);changed.append(str(rel))
build=json.loads((P/'BUILD.json').read_text());build.update(requiredChangedSharedOverlay=changed);(P/'BUILD.json').write_text(json.dumps(build,indent=2))
(D/'REPORT.md').write_text("""# Cycle17 d56 fix1 independent execution — additional whole-path failure

Exact product d56eee9ac8233263d46a4e4c45755a80b471cc84. Parent98bc009 original evidence remains unchanged at975009a01ce67dd4c7d1c26aebe0a76b24943c87. Fixed INPUT87a7a0329a2663dff2fcc537baa4484722e6f52a. Real loopback HTTP/system Chromium154/Playwright1.57/Node22.16/TS5.8.3. No product changes/install/paid calls/user data/main/checkpoint/public deployment. Candidate is NOT a complete integration pass.

## Still failing: explicit locate to real new request
locate-new-request.py at both1280x720/1440x900: user pans target offscreen, receives a legitimate updated explanation, explicitly locates A, presses panel “이 영역에 새 요청”, fills and submits a genuinely NEW request, then copies its handoff. Verified task count+1, new currentId, source kind=request, exact input body, current explanation in actual clipboard. But there are0 explicit origin-return controls after copying. Ordinary nav-space is observed only as fallback, NOT considered restoration. Matrix x remains-32 rather than pre-locate-786/-706 (scale1.2). Raw pre-locate/located/prepared/after-copy/return cards, selection, focus, scroll and stored draft/current are preserved. Both failures, child/outer collector1, JSON1, no fatal. This is distinct from the old existing-task reading path and from ordinary navigation policy.

## Fixed original failures / separate results
- Frozen original4 checker unchanged SHA ab65a98de50e1e0277322cddcf4db7975e6e737a92483dbf06fbb4a7c58e6c02:4PASS, children/collector0.
- Same additional new-request domain and correction-recovery probes now0; state8/migration/return1/restore0. New same-area requested Basis no longer invalidates explanation; actual browser next-request clipboard includes it. Forged external current after explicit correction is rejected.
- Old locate→panel-open-area→task-understanding route now has explicit locate-return on the AREA screen after task-return. Counter UI path was adjusted to press that new real control; old expectation “button must exist during task reading” is replaced with viable area return path, not removal of original-camera assertion. The checker additionally enters the existing protected draft via task-next-action, edits it, returns through work-origin→area locate-return, verifies stored input retained and original map matrix restored. Both PC widths child/collector0. No panel-task shortcut substituted for panel-open.
- Initial two restatement samples(PowerToys public-code/review vs product13 internal AI assignment/diff) x both PC widths,15 observations/run, all0 in this exact source. Not combined with prior executions or author counts. Direct locate card all-overflow clips/hits and panel nonoverlap, same-content origin return card rect/matrix/focus/scroll/other-area draft buffer; roles/compatible explanation/valid-but-wrong correction; r1 correction draft→B→A and r2 stale rejection/body retention; exact old input no resurrection all recorded.
- Roles UI separately confirms real user-idea and description sentence snippets visible inside viewport/all axis clips with hits across both samples/widths, not just labels.
- Strong supplemental fixture has CURRENT descriptions in both A and B. A full/evidence opened → B first opened: B's full/evidence stay closed. At1280, long unadopted-proposal, original report, and history tails reached with real native wheel; each collapsed body actually hidden. All supplementary assertions0, no programmatic DOM scroll. Long strings explicitly synthetic scaffolding, not real claims.
- Manual/intent/note/new confirmed decision/explicit revision of existing Basis each keeps stale protection (five public-API probes0). Answer-specific UI question branch NOT_RUN independently; no fake advice/state injected for coverage.
- Actual clipboard8 strings independently match asynchronously completed record UTF16 chars/FNV and anchor/current-note vs immutable old Background text. Concurrent edit during clipboard is NOT_RUN. Protected B draft type/target/body, note/name/Basis/manual/Background/other relations/world positions measured in raw. Cross-tab stale UI save rejects and preserves exact external envelope(1280); no live-sync claim.
- npm check/build, continuity check/build/static build each0. Author unit/browser counts not adopted; no historical whole-suite replay.

## Interpretation / evidence boundaries
The successful existing-task export path is NOT the failing real-new-request path. Neither old98bc failures nor Sol WIP partial successes are merged into this result. Remaining live synchronization/semantic extraction/human comprehension/external handoff execution/Windows are unverified. Synthetic misinterpretation is expected to be structurally accepted but attributed and user-correctable, never reported as automatic meaning detection.

All current logs/code/raw are included with separate process exits. Source binding verifies pinned remote blob bytes against execution files after tests; actual HTTP audit verifies compiled response bytes/status/disk before/after. It is separate HTTP request audit, not first page.goto status instrumentation. Four representative actual-product PNGs:1280 PowerToys and1440 p13 base map+user/received prose,1280 long-content collapsed,1440 missing-origin after new-request. No test-list screenshot.

Preview is known-failing static MOCK overlay app/CSS plus required changed shared modules; no deployment. No repo/build/node_modules/fullsource copy. Manifest lists exact recursive payload excluding itself (preview manifest likewise). Root decides next fix. Final source and all results belong only to d56, older evidence remains by fixed link.
""")
for root in [P,D]:
 fs=sorted(f for f in root.rglob('*') if f.is_file() and f!=root/'MANIFEST.tsv');(root/'MANIFEST.tsv').write_text('path\tbytes\tsha256\n'+''.join(f'{f.relative_to(root)}\t{f.stat().st_size}\t{sha(f.read_bytes())}\n' for f in fs))
print('files',len([f for f in D.rglob('*') if f.is_file()]))
