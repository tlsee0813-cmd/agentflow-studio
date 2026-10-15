"""Offline accounting of completed scoped browser observations, not another UI run."""
from pathlib import Path
import json,hashlib,sys,traceback
ROOT=Path(__file__).parent;EXPECTED=[f'{w}/S{i}' for w in [1440,390] for i in range(1,7)]+['390/G3-nested','390/G1-prep'];H='5e937f9e9cab6143f7eee68aac90d9ae0d457513d82ec0ebd450daff797831d6'
out={'kind':'Offline exact coverage accounting of scoped UI runs; not wrapper-only success','expected':EXPECTED,'selected':[],'sources':{},'fatal':None}
try:
 for name,prefix in [('run-02','390/'),('run-04','1440/')]:
  path=ROOT/name/'result.json';d=json.loads(path.read_text());p=json.loads((path.parent/'process-exit.json').read_text());assert p['matches'] and p['actual_child_exit']==d['exit_code'];assert d['fileHashBefore']==d['fileHashAfter']==H and d['fileBytes']==46924 and not d['fatal'] and not d['pageerrors'] and not d['cleanup_errors']
  selected=[s for s in d['stages'] if s['id'].startswith(prefix)];assert len(selected)==(8 if prefix=='390/' else 6) and all(s['status']=='PASS' for s in selected)
  for s in selected:out['selected'].append({'id':s['id'],'status':s['status'],'source':name+'/result.json','environment':d['environment']})
  out['sources'][name]={'raw_result_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'actual_child_exit':p['actual_child_exit'],'whole_run_complete':d['complete'],'raw_counts':d['counts'],'selected_scope':prefix,'selected_count':len(selected),'note':'run-02 full child exit1 is retained: only its completed 390 scope is accepted; its failed 1440 harness stage is superseded by run-04, not hidden'}
 ids=[s['id'] for s in out['selected']];assert len(ids)==len(EXPECTED) and set(ids)==set(EXPECTED)
 probe=json.loads((ROOT/'probe/process-exit.json').read_text());assert probe['actual_child_exit']!=0 and probe['matches'];out['syntheticProbeExit']=probe['actual_child_exit']
except BaseException as e:out['fatal']={'type':type(e).__name__,'message':str(e),'traceback':traceback.format_exc()}
out['executed_unique_accepted']=len(out['selected']);out['complete']=not out['fatal'] and out['executed_unique_accepted']==len(EXPECTED);out['exit_code']=0 if out['complete'] else 1
(ROOT/'coverage.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:out[k] for k in ['executed_unique_accepted','complete','fatal','exit_code']}));sys.exit(out['exit_code'])
