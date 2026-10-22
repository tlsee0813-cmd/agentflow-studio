from pathlib import Path
import json,hashlib,subprocess,os,datetime,urllib.request,re
R=Path(__file__).parent;sha=lambda b:hashlib.sha256(b).hexdigest();rows=[]
for manifest,folder in [(R/'SOURCE_BEFORE.json','cycle20-candidate'),(R/'final-head/SOURCE_BEFORE.json','cycle20-final-candidate')]:
 j=json.loads(manifest.read_text());root=R.parent/folder;out=[]
 for f in j['files']:
  b=(root/f['path']).read_bytes();out.append({'path':f['path'],'bytes':len(b),'sha256':sha(b),'unchanged':sha(b)==f['sha256']});assert out[-1]['unchanged'],f['path']
 rows.append({'source':j.get('source'), 'folder':folder,'files':out})
(R/'SOURCE_AFTER.json').write_text(json.dumps(rows,indent=2))
for folder in ['cycle20-candidate','cycle20-final-candidate']:
 A=R.parent/folder/'app';env=os.environ.copy();env.update(PORT='0',AI_MODE='mock',ALLOW_PAID_AI='false');p=subprocess.Popen(['/workspace/browser-env/tools/node_modules/.bin/node','continuity/server/index.mjs','--mock'],cwd=A,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True);audit=[]
 try:
  url=re.search(r'http://127\.0\.0\.1:\d+',p.stdout.readline()).group()
  for f in sorted((A/'continuity/dist/public').rglob('*')):
   if not f.is_file():continue
   rel=str(f.relative_to(A/'continuity/dist/public'));before=f.read_bytes()
   with urllib.request.urlopen(url+'/'+rel) as r:b=r.read();status=r.status
   audit.append({'url':url+'/'+rel,'status':status,'bytes':len(b),'httpSHA256':sha(b),'diskBeforeSHA256':sha(before),'diskAfterSHA256':sha(f.read_bytes())});assert status==200 and b==before==f.read_bytes()
 finally:p.terminate();p.wait(timeout=10)
 (R/(folder+'-HTTP.json')).write_text(json.dumps(audit,indent=2))
print('source files unchanged; compiled HTTP audits complete')
