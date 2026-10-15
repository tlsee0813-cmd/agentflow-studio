import subprocess,json
from pathlib import Path
root=Path(__file__).parent; out=root/'evidence-hardening';out.mkdir(exist_ok=True)
results=[]
for name,options in [('normal',[]),('probe',['--probe-fatal'])]:
 with (out/(name+'.log')).open('wb') as log:
  run=subprocess.run(['/workspace/browser-env/venv/bin/python',str(root/'check.hardened.py'),*options],stdout=log,stderr=subprocess.STDOUT)
 data=json.loads((out/name/'result.json').read_text())
 results.append({'run':name,'process_exit_code':run.returncode,'expected_exit':0 if name=='normal' else 'nonzero','executed_checks':data['executed_checks'],'complete':data['complete'],'fatal':data['fatal']})
 if name=='normal':assert run.returncode==0 and data['executed_checks']==86 and data['complete'] and data['fatal'] is None
 else:assert run.returncode!=0 and data['fatal'] and data['executed_checks']==0 and not data['complete']
(out/'process-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(results,ensure_ascii=False,indent=2))
