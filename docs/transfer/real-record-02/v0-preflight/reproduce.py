import json,sys,hashlib,threading,functools,traceback
from pathlib import Path
from datetime import datetime,timezone
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from importlib.metadata import version
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).parent
SOURCE='https://raw.githubusercontent.com/tlsee0813-cmd/agentflow-studio/4b396e8da9e01e3f9e3b2068c6d76d17848ffb3a/docs/cycles/2026-10-15-real-record-02/reading-v0/reading-study.html'
result={'source':SOURCE,'target_commit':'4b396e8da9e01e3f9e3b2068c6d76d17848ffb3a','started_at':datetime.now(timezone.utc).isoformat(),'playwright':version('playwright'),'browser_executable':'/usr/bin/chromium','cases':[],'fatal':None,'pageerrors':[],'console':[],'http':[],'scope':'Only initial / actual E09 #ab-f14 click / actual #pvClose click; no full author or A/B suite, external-source stubs or human reading'}
server=None
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,fmt,*args):result['http'].append(fmt%args)
def state(page):
 return page.evaluate('''()=>{function info(id){let e=document.getElementById(id),r=e.getBoundingClientRect(),s=getComputedStyle(e);let intersects=r.width>0&&r.height>0&&r.right>0&&r.bottom>0&&r.left<innerWidth&&r.top<innerHeight;let x=Math.max(0,Math.min(innerWidth-1,(r.left+r.right)/2)),y=Math.max(0,Math.min(innerHeight-1,(r.top+r.bottom)/2)),h=document.elementFromPoint(x,y);return {hidden:e.hidden,display:s.display,visibility:s.visibility,box:{x:r.x,y:r.y,width:r.width,height:r.height},hasBox:r.width>0&&r.height>0,inViewport:intersects,visible:intersects&&s.visibility!=='hidden'&&s.display!=='none',centerHit:!!h&&(e===h||e.contains(h)),text:e.innerText}}return {pvBody:info('pvBody'),pvClose:info('pvClose'),pvEmpty:info('pvEmpty'),activeElement:{id:document.activeElement.id,tag:document.activeElement.tagName}}}''')
try:
 sha=hashlib.sha256((ROOT/'site/reading-study.html').read_bytes()).hexdigest();result['sha256']=sha
 if sha!='500e0021045ae035beca9244d2f7ee59b048f969137777cf3e766655005c9da0':raise ValueError('Original byte hash mismatch')
 server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'site')));threading.Thread(target=server.serve_forever,daemon=True).start()
 result['actualHTTPURL']=f'http://127.0.0.1:{server.server_port}/reading-study.html'
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True);result['chromium']=browser.version
  for width,height in [(1280,720),(1440,900)]:
   context=browser.new_context(viewport={'width':width,'height':height});page=context.new_page();page.set_default_timeout(6000)
   page.on('pageerror',lambda e:result['pageerrors'].append(str(e)))
   page.on('console',lambda m:result['console'].append({'type':m.type,'text':m.text}))
   response=page.goto(result['actualHTTPURL']);page.wait_for_timeout(100)
   case={'viewport':[width,height],'documentHTTPStatus':response.status,'states':{},'checks':[]};result['cases'].append(case)
   case['states']['initial']=state(page)
   page.locator('#ab-f14').click();page.wait_for_timeout(100);case['states']['opened']=state(page)
   page.locator('#pvClose').click();page.wait_for_timeout(100);case['states']['closed']=state(page)
   for stage in ['initial','opened','closed']:
    s=case['states'][stage];should_open=stage=='opened';b=s['pvBody'];c=s['pvClose']
    ok=(not b['hidden'] and b['hasBox'] and c['visible']) if should_open else (b['hidden'] and not b['hasBox'] and not c['visible'])
    case['checks'].append({'name':stage+'-render-state','status':'passed' if ok else 'failed','expected':'body and close rendered' if should_open else 'body and close not rendered; hidden alone insufficient'})
   case['checks'].append({'name':'close-focus-return','status':'passed' if case['states']['closed']['activeElement']['id']=='ab-f14' else 'failed'})
   case['checks'].append({'name':'HTTP-200','status':'passed' if response.status==200 else 'failed'})
   if width==1440:page.screenshot(path=str(ROOT/'1440x900-after-close.png'))
   context.close()
  browser.close()
except BaseException as exc:
 result['fatal']={'type':type(exc).__name__,'message':str(exc),'traceback':traceback.format_exc()}
finally:
 if server:
  try:server.shutdown();server.server_close()
  except BaseException as exc:result['cleanup_error']=str(exc)
checks=[c for case in result['cases'] for c in case['checks']]
result['counts']={'passed':sum(c['status']=='passed' for c in checks),'failed':sum(c['status']=='failed' for c in checks)}
result['finished_at']=datetime.now(timezone.utc).isoformat()
result['exit_code']=1 if result['fatal'] or result.get('cleanup_error') or result['pageerrors'] or result['counts']['failed'] or len(checks)!=10 else 0
(ROOT/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'counts':result['counts'],'fatal':result['fatal'],'exit_code':result['exit_code']},ensure_ascii=False))
sys.exit(result['exit_code'])
