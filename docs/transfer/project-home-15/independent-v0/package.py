from pathlib import Path
import shutil,json,hashlib,subprocess
R=Path(__file__).parent;D=R/'delivery';D.mkdir(exist_ok=True);A=R.parent/'home15-candidate/app';sha=lambda b:hashlib.sha256(b).hexdigest()
for n in ['commands.py','independent.py','independent-first.py','independent-second.py','independent-third.py']:shutil.copy2(R/n,D/n)
for n in ['independent','independent-first','independent-second','independent-third']:
 shutil.copytree(R/n,D/n,dirs_exist_ok=True,ignore=shutil.ignore_patterns('*.png') if n!='independent' else None)
C=D/'commands';C.mkdir(exist_ok=True)
for f in (R/'commands').glob('*'):
 if f.is_file():shutil.copy2(f,C/f.name)
# Existing suite measurements retained; screenshots limited to independent four.
B=C/'browser-outputs';B.mkdir(exist_ok=True)
for f in (R/'commands/browser-outputs').glob('*'):
 if f.suffix!='.png':shutil.copy2(f,B/f.name)
for n in ['collect.py','stdout.log','stderr.log','process.json']:shutil.copy2(R/n,D/n)
source='1e51f0f9b56ed51e9ec4c529ca518aa256ad1ecf';repo='/workspace/agentflow-studio';binding=[]
for f in sorted(A.rglob('*')):
 if not f.is_file():continue
 rel='app/'+str(f.relative_to(A))
 p=subprocess.run(['git','-C',repo,'show',source+':'+rel],capture_output=True)
 if p.returncode==0:
  assert p.stdout==f.read_bytes(),rel
  binding.append({'path':rel,'bytes':len(p.stdout),'sha256':sha(p.stdout),'disk_after_equal':True})
(D/'SOURCE_BINDING.json').write_text(json.dumps({'commit':source,'contract':'16f6b71fda204ce8b79a75e3af5460367704ed82','tracked_files_exact_after':binding,'source_extraction':'git archive exact commit into separate scratch; original checkout unchanged'},indent=2))
P=D/'preview';P.mkdir(exist_ok=True);base=R.parent/'product13-fix1-candidate/app/continuity/static-dist';new=A/'continuity/static-dist';changed=[]
for f in new.rglob('*'):
 if f.is_file():
  rel=f.relative_to(new);old=base/rel
  if not old.exists() or old.read_bytes()!=f.read_bytes():
   dest=P/rel;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(f,dest);changed.append(str(rel))
(P/'BUILD.json').write_text(json.dumps({'source':source,'command':'node continuity/scripts/build-static.mjs','actualreturncode':0,'overlay_base':'product13 fix1 static-dist (606120500eeea50a20f00fb4678bced7a7d93d98)','changed_files':changed,'usage':'Overlay onto existing product13 static MOCK runtime and serve index.html via localhost HTTP; not native server app.js alone. No public deployment.'},indent=2))
for root in [P,D]:
 files=sorted(f for f in root.rglob('*') if f.is_file() and f!=root/'MANIFEST.tsv');(root/'MANIFEST.tsv').write_text('path\tbytes\tsha256\n'+''.join(f'{f.relative_to(root)}\t{f.stat().st_size}\t{sha(f.read_bytes())}\n' for f in files))
print(changed)
