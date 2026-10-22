from pathlib import Path
import subprocess,json,hashlib,shutil
R=Path(__file__).parent;D=R/'delivery';D.mkdir(exist_ok=True);A=R.parent/'cycle17-final-candidate';S='98bc0097af132410f75734ac692f9b7d3b42edcb';repo='/workspace/agentflow-studio';sha=lambda b:hashlib.sha256(b).hexdigest()
for f in R.rglob('*'):
 if not f.is_file() or 'delivery' in f.relative_to(R).parts or '__pycache__' in f.parts:continue
 rel=f.relative_to(R)
 if rel.parts[0]=='commands' and len(rel.parts)>1 and rel.parts[1]=='browser-outputs':continue
 if f.suffix=='.png' and str(rel) not in ['ui/powertoys-1280-clipboard-view.png','ui/p13-1440-clipboard-view.png','counter-ui/1280-lost-locate-origin.png','counter-ui/1440-lost-locate-origin.png']:continue
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
(D/'REPORT.md').write_text('''# Cycle17 candidate98bc009 independent execution — failures found

Exact source98bc0097af132410f75734ac692f9b7d3b42edcb, contract87a7a0329a2663dff2fcc537baa4484722e6f52a. Existing Node22.16/TS5.8.3/Playwright1.57/system Chromium154, real loopback HTTP and product MOCK. No product edits/install/paid provider/user data/main/checkpoint/deployment. This candidate is NOT an overall pass or final acceptance.

## Three concrete new failures
1. Valid explanation → normal same-area new request submission (no idea/condition edit) → next actual clipboard handoff loses current explanation. Domain beforeValid=true/afterValid=false, requested Basis1→2; actual browser reproduction at both1280×720 and1440×900 also omits UNIQUE_CONTINUITY. Old-return re-export is not used as a substitute. new-request-domain.json and counter-ui raw retain full before/after/text.
2. r1 external→explicit user correction r2→old-export modified return correctly held superseded. Recovery tamper sets only that held entry revision3/heldnull/stamp original export, area revision3. parseProject accepts a current external explanation despite correction history. recovery-correction.json contains valid original/tampered/accepted states. This is explicit malicious recovery validation probe, not runtime hidden-state injection or semantic detection.
3. Offscreen explicit locate→panel “영역 열기”→area task read→return. Locate origin/button is lost (count0). After map navigation1280 x=-32 vs original-786;1440 x=-32 vs original-706, scale remains1.2. Exact raw matrices/card rect/focus/scroll are retained; panel-task direct reading is a different route and not a substitute. Both actual UI failures child/collector1, no fatal.

## Separate successful evidence (not a combined pass count)
- Unchanged original frozen checker4 PASS, all actual children/collector0; SHA ab65a98de50e1e0277322cddcf4db7975e6e737a92483dbf06fbb4a7c58e6c02. It does not cover new failures above.
- Planned initial five-scene script completed two labelled restatement samples × two PC widths,15 observations/run, exit0. It covered receiving with another-area draft and unsaved area buffer, camera persistence, direct locate card inside axis clips/not panel-obscured, direct locate return restoring original view/buffer, basic roles, long summary tail native wheel, full-text collapse, A draft→B→A, r1 draft/r2 stale-save reject, valid-but-wrong body correction without note rewrite, old exact receipt no resurrection, and actual re-export of existing return context. It DID NOT implement the newly required normal next-request submit or panel-open-area path; these are now separately failing. Do not treat that earlier script as complete INPUT acceptance.
- roles.py separately confirms BOTH actual user-idea and received-description sentence snippets are within viewport/all ancestor clips with hits for both samples/widths; labels alone are insufficient. These are objective display snippets, not human understanding/whole-prose readability.
- Real clipboard8 captures: independently recomputed UTF16 length/FNV equal asynchronously completed export records. First export includes current user note/brief and old immutable Background; valid corrected external context is attributed as unverified reference on existing-return export. No concurrent edit was deliberately injected during clipboard async operation; that race remains NOT_RUN independently.
- state.mjs8 checks: exact duplicate object/revision unchanged, changed-plan description stale while normal report retained, return1 compatible, independently constructed historical v1–v5 structures migrate to v6 without invented understanding/anchors and restore roundtrip. These are schema-shaped synthetic historical inputs, not actual old user projects.
- Browser cross-tab stale UI save rejected and exact external envelope retained at1280. No live synchronization claim.
- npm check/build, continuity check/build and static build each actual exit0. No author236/8 counts are adopted; author whole suites were not rerun.

## Boundaries and artifacts
Raw planned UI/native helper routes use normal click/fill/wheel/pan, no force/app-state/DOM scroll injection. Offline fixtures use public domain APIs and product file import UI. Samples explicitly distinguish bounded public PowerToys code/review restatement from internal product13 AI assignment/diff restatement; synthetic proposals/wrong bodies/long padding are never attributed to real speakers. No semantic conflict detection or PowerToys execution success claim.

New counterexamples prioritized over further full-suite expansion. Remaining independent detail includes long proposal/history/original-report tail wheel for all permutations, clipboard-concurrent-edit race, and normal next-request continuity currently blocked by demonstrated failure. Basic long summary/full-body close is executed; do not silently expand it to all disclosure content. B has no explanation in this final fixture; absence of A disclosure under B is weaker than WIP’s two-described-area fixture. Original WIP evidence stays separate.

SOURCE_BINDING checks every pinned source file after execution; http-runtime.json separately verifies actual HTTP response bytes/status against compiled execution files before/after. It is a request audit, not first-page-goto status instrumentation. Browser environment/logs and exact subprocess times/exits are included. domain-process and counter-ui-process are nonzero; their results are not masked by successful build/initial UI/frozen suites. Initial domain tool observations are also preserved under first-domain-observations. No setup/fatal in final new-counterexample browser run.

Four representative PNGs: two initial-flow clipboard/work screens, two lost-origin map scenes; they are not labelled as first-screen role images. Preview contains static app/CSS plus changed shared modules necessary for project6/return2, over prior cycle16 static runtime, with hashes; not public deployment and candidate known failing. No compiled full app/node_modules/history copied. Manifest exact recursive payload excludes itself, preview manifest likewise. Root integrates judgment and fixes; next exact SHA needs distinct results.
''')
for root in [P,D]:
 fs=sorted(f for f in root.rglob('*') if f.is_file() and f!=root/'MANIFEST.tsv');(root/'MANIFEST.tsv').write_text('path\tbytes\tsha256\n'+''.join(f'{f.relative_to(root)}\t{f.stat().st_size}\t{sha(f.read_bytes())}\n' for f in fs))
print('files',len([f for f in D.rglob('*') if f.is_file()]))
