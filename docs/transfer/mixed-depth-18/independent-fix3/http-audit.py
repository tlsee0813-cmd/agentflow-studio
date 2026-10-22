from pathlib import Path
import subprocess,os,re,urllib.request,json,hashlib
R=Path(__file__).parent;A=R.parent/'cycle18-fix3-candidate/app';E={k:os.environ[k] for k in ['PATH','HOME','TMPDIR'] if k in os.environ};E.update(PORT='0',AI_MODE='mock',ALLOW_PAID_AI='false');p=subprocess.Popen(['node','continuity/server/index.mjs','--mock'],cwd=A,env=E,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True);url=re.search(r'http://127\.0\.0\.1:\d+',p.stdout.readline()).group();rows=[];sha=lambda b:hashlib.sha256(b).hexdigest()
try:
 for f in (A/'continuity/dist/public').rglob('*'):
  if not f.is_file():continue
  rel=str(f.relative_to(A/'continuity/dist/public'));before=f.read_bytes()
  with urllib.request.urlopen(url+'/'+rel) as response:body=response.read();status=response.status
  rows.append({'url':url+'/'+rel,'path':rel,'status':status,'bytes':len(body),'http_sha256':sha(body),'disk_before_sha256':sha(before),'disk_after_sha256':sha(f.read_bytes())});assert body==before==f.read_bytes()
finally:p.terminate();p.wait(timeout=10)
(R/'http-runtime.json').write_text(json.dumps(rows,indent=2))
