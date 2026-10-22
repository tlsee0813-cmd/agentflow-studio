from pathlib import Path
import json,hashlib,datetime
r=Path(__file__).parent;sha=lambda b:hashlib.sha256(b).hexdigest();before=json.load(open(r/'SOURCE.before.json'));out=[]
for src in before['sources']:
 changes=[]
 for row in src['files']:
  b=(r/src['name']/row['path']).read_bytes();h=sha(b)
  if h!=row['sha256']:changes.append({'path':row['path'],'beforeSHA256':row['sha256'],'afterSHA256':h,'afterBytes':len(b)})
 if src['name']=='candidate':assert not changes
 else:assert len(changes)==1 and changes[0]['path']=='app/continuity/tests/pc12_browser.py'
 out.append({'name':src['name'],'commit':src['commit'],'tree':src['tree'],'changes':changes,'productSourceUnchanged':True})
(r/'SOURCE.after.json').write_text(json.dumps({'afterAllProcessesUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sources':out},indent=2))
control=json.load(open(r/'controlled/runtime.json'));assert not control['pageerrors'];assert all(x['status']==200 and x['sha256']==x['diskSHA256']==x['diskAfterSHA256'] for x in control['HTTP'] if 'path' in x);assert not [x for x in control['HTTP'] if 'captureError' in x]
summary={'source':before['sources'][0]['commit'],'tree':before['sources'][0]['tree'],'independentFrozenChecker':json.load(open(r/'controlled/CHECKER_BINDING.json')),'controlledSameView':json.load(open(r/'controlled/sameview-release-comparison.json')),'controlledHistoryWork':json.load(open(r/'controlled/roundtrip-release-comparison.json')),'controlledHTTPCount':len(control['HTTP']),'controlledHTTPDiskBeforeAfterMatches':True,'environment':{k:control[k] for k in ['Node','PW','browser','pageerrors','serverExit','paidAI']},'sameViewStoredDataUnchanged':(r/'controlled/sameview-before-release-envelope.json').read_bytes()==(r/'controlled/sameview-after-release-envelope.json').read_bytes(),'roundtripStoredDataUnchanged':(r/'controlled/roundtrip-before-release-envelope.json').read_bytes()==(r/'controlled/roundtrip-after-release-envelope.json').read_bytes(),'testRuns':{}}
assert summary['sameViewStoredDataUnchanged'] and summary['roundtripStoredDataUnchanged']
for name in ['candidate','original673']:
 d=r/name/'execution';rows=[json.loads(x) for x in (d/'raw/http-console.jsonl').read_text().splitlines()];http=[x for x in rows if x['kind']=='HTTP'];assert all(x['bodyEqualsDisk'] and x['status']==200 for x in http);assert not [x for x in rows if x['kind'] in ['pageerror','capture-error'] or (x['kind']=='console' and x['type']=='error')]
 summary['testRuns'][name]={'process':json.load(open(d/'process.json')),'HTTPCount':len(http),'HTTPBodiesEqualDisk':True,'serverExits':[x for x in rows if x['kind']=='server-process'],'environment':json.load(open(d/'raw/browser-environment.json')),'exactTestSHA256':sha((r/name/'app/continuity/tests/pc12_browser.py').read_bytes())}
assert summary['testRuns']['candidate']['process']['actualChildExit']==0 and summary['testRuns']['original673']['process']['actualChildExit']==1
summary['priorCounterexampleCommit']='8ac357a4b77bab9eb70a7f9852c568aff84f898a';summary['priorHistoryWorkAfter']={'xy':[0,4005],'focus':'result-file-review-heading'}
(r/'SUMMARY.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
print('controlled old FAIL -> candidate PASS; exact test12 candidate 2 PASS / original673 2 FAIL; product sources unchanged')
