from pathlib import Path
import subprocess,os,re,json,hashlib
from importlib.metadata import version
from playwright.sync_api import sync_playwright
r=Path(__file__).parent;env={k:os.environ[k] for k in ['PATH','HOME','TMPDIR'] if k in os.environ};env['PATH']='/workspace/browser-env/tools/node_modules/.bin:'+env['PATH'];env.update(AI_MODE='mock',ALLOW_PAID_AI='false',PORT='0')
p=subprocess.Popen(['node','continuity/server/index.mjs','--mock'],cwd=r/'source/app',env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True);result={};code=1
try:
 line=p.stdout.readline();url=re.search(r'http://127\.0\.0\.1:\d+',line).group();result['server_start']=line.strip();result['url']=url
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True);page=b.new_page(viewport={'width':1280,'height':720});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));resp=page.goto(url);body=resp.body();page.locator('#mode').wait_for();result.update(status=resp.status,body_sha256=hashlib.sha256(body).hexdigest(),bytes=len(body),mode=page.locator('#mode').inner_text(),pageerrors=errors,playwright=version('playwright'),browser=b.version,node=subprocess.check_output(['node','--version'],env=env,text=True).strip());code=int(resp.status!=200 or bool(errors) or 'MOCK' not in result['mode']);b.close()
finally:
 p.terminate();result['server_shutdown_exit']=p.wait(timeout=10);result['stderr']=p.stderr.read();result['child_exit']=code;(r/'evidence/smoke.json').write_text(json.dumps(result,indent=2));print(json.dumps(result));
raise SystemExit(code)
