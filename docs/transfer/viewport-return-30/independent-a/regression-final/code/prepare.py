from pathlib import Path
import subprocess,tarfile,io,hashlib,json
r=Path(__file__).parent;repo='/workspace/agentflow-studio';cand='e5a5bf40d544cad62b4644ab13cc2958671b0869';base='aa0938ecbe96ec5fdb15eb4783e865bf7ab70c7b'
def git(*args):return subprocess.check_output(['git','-C',repo,*args])
rows=[]
for name,head in [('base29',base),('candidate30',cand)]:
 d=r/name;d.mkdir(exist_ok=True)
 b=git('archive',head,'app','experiments/idea016/cases.mjs');tarfile.open(fileobj=io.BytesIO(b)).extractall(d,filter='data')
 for rel,sha in [('continuity/tests/viewport30_browser.py','43798ea3a9503690155cc461f0a2c2447f54fb2b635153460fc6696e0b8fcc4d'),('continuity/tests/fixtures/viewport30-normal-ui-six.json','c50eb43a7747e824a23ff8de87588e608dc5430046528d13878d15eb65239aaa')]:
  data=git('show',cand+':app/'+rel);assert hashlib.sha256(data).hexdigest()==sha
  p=d/'app'/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
 source=[]
 for p in sorted((d/'app').rglob('*')):
  if p.is_file():
   rel=str(p.relative_to(d));data=p.read_bytes();expected=git('show',(cand if rel in ['app/continuity/tests/viewport30_browser.py','app/continuity/tests/fixtures/viewport30-normal-ui-six.json'] else head)+':'+rel)
   assert data==expected;source.append({'path':rel,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
 rows.append({'name':name,'head':head,'tree':git('rev-parse',head+'^{tree}').decode().strip(),'overlay':['test','fixture'] if name=='base29' else [],'files':source})
(r/'SOURCE_BINDING.before.json').write_text(json.dumps(rows,indent=2))
print([(x['name'],len(x['files'])) for x in rows])
