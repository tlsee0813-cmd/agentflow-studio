from pathlib import Path
import shutil,json,subprocess,hashlib
R=Path(__file__).parent;V=R.parent/'cycle16-v0-evidence';D=R/'delivery';D.mkdir(exist_ok=True);repo='/workspace/agentflow-studio';sha=lambda b:hashlib.sha256(b).hexdigest()
# Exact evidence subsets: all results/logs/code; no old author screenshots, fixture download artifacts or cache.
for root,label in [(V,'v0'),(R,'fix1')]:
 dest=D/label;dest.mkdir(exist_ok=True)
 for f in root.rglob('*'):
  if not f.is_file() or 'delivery' in f.relative_to(root).parts or '__pycache__' in f.parts:continue
  rel=f.relative_to(root)
  if f.suffix=='.png':
   keep=(label=='v0' and str(rel) in ['independent/1280-different-report.png','independent/1440-different-report.png']) or (label=='fix1' and str(rel) in ['visual/1280-F10.png','visual/1440-F10.png'])
   if not keep:continue
  if rel.parts[0]=='commands' and len(rel.parts)>2 and rel.parts[1]=='browser-outputs' and f.name not in ['report16-observations.jsonl','browser-environment.json']:continue
  if 'fixture' in rel.parts and f.name!='browser-environment.json':continue
  to=dest/rel;to.parent.mkdir(exist_ok=True,parents=True);shutil.copy2(f,to)
S='a0f0ae786c580a8919cede07db48d4397b58b114';A=R.parent/'cycle16-fix1/app';rows=[]
for path in subprocess.check_output(['git','-C',repo,'ls-tree','-r','--name-only',S,'--','app','experiments/idea016/cases.mjs']).decode().splitlines():
 before=subprocess.check_output(['git','-C',repo,'show',S+':'+path]);after=(R.parent/'cycle16-fix1'/path).read_bytes();assert before==after;rows.append({'path':path,'bytes':len(before),'pinned_beforeSHA256':sha(before),'disk_afterSHA256':sha(after)})
(D/'SOURCE_BINDING.json').write_text(json.dumps({'source':S,'contract':'b818e45ded8f7fc73ddd3ac497c94b42d11f1273','source_files':rows,'scope':'git archive pinned source blob before hash vs final scratch file byte equality; independent fixture builder reused via pinned author test helper, not author assertions rebranded','v0':'c7fa5b0740b8de562119fbcd4f90410815d6f7df'},indent=2))
a=(V/'repro.py').read_bytes();b=(R/'repro.py').read_bytes();assert a.replace(b'cycle16-v0/app',b'cycle16-fix1/app')==b
(D/'COMPARISON.json').write_text(json.dumps({'checker_logic_equal_except_candidate_path':True,'v0_codeSHA':sha(a),'fix1_codeSHA':sha(b),'v0':json.loads((V/'independent/result.json').read_text()),'fix1':json.loads((R/'independent/result.json').read_text())},ensure_ascii=False,indent=2))
P=D/'preview';P.mkdir(exist_ok=True)
for name in ['client/app.js','styles.css']:
 dst=P/name;dst.parent.mkdir(exist_ok=True);shutil.copy2(A/'continuity/static-dist'/name,dst)
(P/'BUILD.json').write_text(json.dumps({'source':S,'command':'node continuity/scripts/build-static.mjs','actual_child_exit':0,'overlay':'client/app.js + styles.css over HOME15 fix2 static MOCK runtime; unchanged index/shared/runtime adapter retained','no_deployment':True},indent=2))
(D/'REPORT.md').write_text('''# Report-area16 fix1 independent execution

Exact candidate a0f0ae786c580a8919cede07db48d4397b58b114, fixed contract b818e45. No product edits/new dependencies/user data/paid AI or deployment. All browser activity used real system Chromium/local HTTP, except explicitly labelled response timing hold/release against real local MOCK endpoint.

## Conclusion
The narrowed same-tab integration gates passed: v0 report-path disclosure leak reproduced at both PC widths; same independent12 observations now pass with logic unchanged except candidate path. Boundary run26 observations pass (two PC widths), visual12 pass plus two existing live-refresh counterexamples, late-MOCK-render1 pass. These separate runs/counts are NOT summed into a single suite or ACCEPTANCE12 completion. Author suite exact fix1 independently invoked13 tests OK; v0 independently invoked12 OK; check/build/static-build each exit0.

Raw exits: v0 reproduction child/collector1; fix1 reproduction0, boundaries0, late timing child/collector0. Visual script and aggregate collector deliberately remain exit1 because cross-tab archived-origin fallback counterexamples are retained. No fatal/pageerror in final runs. Collector.json records each actual subprocess result and JSON match; tool execution returned1 for aggregate. It is incorrect to call the entire unfiltered collection exit0.

## Confirmed independent scope
Current Area.note and actual F10 report sentence simultaneously visible at1280×720/1440×900 with text Range/axis clipping/representative hit; all R1 sourceIds match both report/evidence; nested R2 text separated; normal wheel reaches full report end, closing full text removes visible body. Real keyboard Tab/Enter between report choices and focused button bounds recorded. Raw geometry is not human usability/ink legibility proof.

Explicit UI target choices preserve request body/kind/target for another area, null-follow, explicit {area:null}; report/evidence chosen-return selector remains A while selected reading report is R2. New empty request changes target only, not task count/current/report insertion. Normal map zoom/pan, raw card rect/computed matrix/selection and return focus preserved; saved draft/manual4 survive returns. RB→A explicit continue does not edit selected R2; a newly submitted local-MOCK direct report remains current when continuing A. No real AI execution claim.

Other-tab normal archive UI saves archived=true. The stale tab still shows the old area on return: NOT_SUPPORTED/KNOWN_LIMIT (existing no storage/BroadcastChannel live subscription), not a new fix1 regression or PASS. Stale new-draft and stale manual saves both reject conflict and preserve exact external envelope, with visible memory input/error. No live synchronization engine added. No valid ordinary same-tab disappearance while retaining origin was found/verified; original ACCEPTANCE12 disappearance fallback remains NOT_RUN, not author conditional fallback success.

## Limits and preservation
Missing-source browser path is not injected: public parseProject rejects offline invalid sourceIds probe. Defensive display code is static only. Stale/foreign/nonreport tab-memory variants and archived/unassigned permutations were exercised by exact author suite but are not claimed as additional independent UI coverage; no hidden app-state injection was used to manufacture coverage. Long current-idea full-disclosure plus noninitial area-anchor case12 was not independently completed; existing same-tab map return and shorter current idea are distinct evidence. Selection of report preserves common request disclosure. The second-tab unchanged-storage probe in repro is not evidence of live redraw; actual delayed local response commit/render was tested separately.

First visual measurement over-wheeled past the visible report tail into outer document; raw and first checker preserved, correction stops once tail is visible via normal wheel. First boundary attempt filled a hidden composer: raw fatal/code retained; corrected by normal existing composer UI. No product correction. Original author-reported historical pc12/flow090 failed runs were NOT supplied; no claim to have preserved them.

Artifacts: fixed source hashes before/after, runtime HTTP byte equality audit, exact subprocess commands/times/log hashes, environment, raw results/code and four PNGs (v0 failure2/fix1 F10 comparison2). Preview is two-file static MOCK overlay only over existing HOME15 fix2 runtime, no public deployment. Manifest lists exact recursive payload excluding itself; preview manifest excludes itself. All integration judgment remains with root; no human understanding/PowerToys execution/external handoff acceptance claim.
''')
for root in [P,D]:
 fs=sorted(f for f in root.rglob('*') if f.is_file() and f!=root/'MANIFEST.tsv');(root/'MANIFEST.tsv').write_text('path\tbytes\tsha256\n'+''.join(f'{f.relative_to(root)}\t{f.stat().st_size}\t{sha(f.read_bytes())}\n' for f in fs))
print(len(list(D.rglob('*.png'))),'PNGs')
