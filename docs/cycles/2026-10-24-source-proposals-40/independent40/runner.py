import os,sys,json,subprocess,time,hashlib
from pathlib import Path
HERE=Path(__file__).resolve().parent
APP=HERE.parent/'product-handoff-20261024/app'
RUNTIME=Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies'
NODE=RUNTIME/'node/bin/node.exe'
PYTHON=RUNTIME/'python/python.exe'
TSC=HERE.parent/'product17-author/app/node_modules/typescript/bin/tsc'
env=dict(os.environ)
env.update(PATH=str(HERE)+';'+str(NODE.parent)+';'+env['PATH'],PYTHONDONTWRITEBYTECODE='1',PYTHONUTF8='1',PYTHONIOENCODING='utf-8',PYTHONPATH=str(HERE.parent/'product36-independent-evidence-20261024/python-packages'),BROWSER_EXECUTABLE=r'C:\Program Files\Google\Chrome\Application\chrome.exe',BROWSER_TRANSPORT='direct-http',AI_MODE='mock',ALLOW_PAID_AI='false',DEEPSEEK_API_KEY='')
(HERE/'tsc.cmd').write_text('@"'+str(NODE)+'" "'+str(TSC)+'" %*\n',encoding='utf-8')
mode=sys.argv[1]
if mode=='build':
 commands=[('root-type',[NODE,TSC,'--noEmit']),('root-boundary',[NODE,'scripts/check.mjs']),('root-build',[NODE,'scripts/build.mjs']),('continuity-check',[NODE,'continuity/scripts/check.mjs']),('continuity-build',[NODE,'continuity/scripts/build.mjs']),('continuity-unit',[NODE,'--test',*[str(x.relative_to(APP)) for x in sorted((APP/'continuity/tests').glob('*.test.mjs'))]]),('static-build',[NODE,'continuity/scripts/build-static.mjs']),('preview-build',[NODE,'continuity/scripts/build-static.mjs','--preview'])]
elif mode=='final-build':
 commands=[('final-continuity-check',[NODE,'continuity/scripts/check.mjs']),('final-continuity-build',[NODE,'continuity/scripts/build.mjs']),('final-static-build',[NODE,'continuity/scripts/build-static.mjs']),('final-preview-build',[NODE,'continuity/scripts/build-static.mjs','--preview'])]
elif mode=='final-browsers':
 commands=[('final-'+name,[PYTHON,HERE/'run-author.py',APP/'continuity/tests'/file]) for name,file in [('source40','source-proposals40_browser.py'),('static','static_browser.py')]]
elif mode=='browsers':
 commands=[(name,[PYTHON,HERE/'run-author.py',APP/'continuity/tests'/file]) for name,file in [('source40','source-proposals40_browser.py'),('entry37','entry37_browser.py'),('map36','map-priority36_browser.py'),('home15','home15_browser.py'),('static','static_browser.py')]]
elif mode=='probe':commands=[('independent-probe',[PYTHON,HERE/'probe.py'])]
else:raise ValueError(mode)
for name,cmd in commands:
 out=HERE/'raw'/name;out.mkdir(parents=True,exist_ok=True)
 runenv={**env,'IDEA015_EVIDENCE_DIR':str(out),'EVIDENCE_DIR':str(out)}
 start=time.monotonic()
 with (out/'command.log').open('wb') as log:
  p=subprocess.run([str(x) for x in cmd],cwd=APP,env=runenv,stdout=log,stderr=subprocess.STDOUT,timeout=480)
 item={'name':name,'command':[str(x) for x in cmd],'exit':p.returncode,'seconds':round(time.monotonic()-start,3)}
 f=HERE/'execution.json';all=json.loads(f.read_text('utf-8')) if f.exists() else [];all.append(item);f.write_text(json.dumps(all,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(json.dumps(item,ensure_ascii=False),flush=True)
 if p.returncode:
  print((out/'command.log').read_text('utf-8',errors='replace')[-6500:],flush=True)
  sys.exit(p.returncode)
