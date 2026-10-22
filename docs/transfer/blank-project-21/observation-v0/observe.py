from pathlib import Path
import subprocess,os,sys,re,json,hashlib,datetime,traceback
from playwright.sync_api import sync_playwright
R=Path(__file__).parent;A=R.parent/'cycle20-fix1-candidate/app';log=R/'actions.jsonl';now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat();sha=lambda b:hashlib.sha256(b).hexdigest();env=os.environ.copy();env.update(PORT='0',AI_MODE='mock',ALLOW_PAID_AI='false');server=subprocess.Popen(['/workspace/browser-env/tools/node_modules/.bin/node','continuity/server/index.mjs','--mock'],cwd=A,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True);url=re.search(r'http://127\.0\.0\.1:\d+',server.stdout.readline()).group();pw=sync_playwright().start();browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);ctx=None;p=None;errors=[];console=[];resources=[];seq=0;code=0

def emit(d):
 with log.open('a') as f:f.write(json.dumps(d,ensure_ascii=False)+'\n')
 print(json.dumps(d,ensure_ascii=False),flush=True)
def loc(c):
 if 'role' in c:return p.get_by_role(c['role'],name=c.get('name'),exact=c.get('exact',True))
 if 'label' in c:return p.get_by_label(c['label'],exact=True)
 if 'text' in c:return p.get_by_text(c['text'],exact=True)
 if 'selector' in c:return p.locator(c['selector'])
 raise ValueError('missing accessible target')
def snap():return p.evaluate('''()=>({url:location.href,viewport:[innerWidth,innerHeight],scrollY,scrollMax:document.documentElement.scrollHeight-innerHeight,focus:document.activeElement?.outerHTML.slice(0,500),docWidth:document.documentElement.scrollWidth,visibleButtons:[...document.querySelectorAll('button,summary,a')].filter(e=>e.checkVisibility({visibilityProperty:true})).map(e=>({text:e.textContent.trim().slice(0,110),rect:e.getBoundingClientRect().toJSON()}))})''')
def response(r):
 if not r.url.startswith(url):return
 try:
  rel=r.url[len(url):].split('?')[0].lstrip('/') or 'index.html';f=A/'continuity/dist/public'/rel;b=r.body();resources.append({'url':r.url,'status':r.status,'bytes':len(b),'bodySHA256':sha(b),'diskSHA256':sha(f.read_bytes()) if f.is_file() else None})
 except Exception as e:resources.append({'url':r.url,'error':str(e)})
emit({'event':'environment','UTC':now(),'url':url,'source':'df726e5898f24e23d69e47651d3bf6cbea302412','browserVersion':browser.version,'policy':'existing loopback MOCK; isolated contexts, no fixture/storage injection'})
try:
 for line in sys.stdin:
  try:c=json.loads(line)
  except Exception:continue
  seq+=1;rec={'seq':seq,'UTC':now(),'command':c}
  try:
   if c['action']=='new':
    if ctx:ctx.close()
    ctx=browser.new_context(viewport={'width':c['width'],'height':c['height']},permissions=['clipboard-read','clipboard-write']);p=ctx.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.on('console',lambda m:console.append({'type':m.type,'text':m.text}));p.on('response',response);p.on('dialog',lambda d:d.accept());ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(url) else r.abort());res=p.goto(url);rec['firstHTTP']={'url':res.url,'status':res.status};rec['AX']=p.locator('body').aria_snapshot();rec['screen']=snap()
   elif c['action']=='observe':rec['AX']=p.locator('body').aria_snapshot();rec['screen']=snap()
   elif c['action']=='click':rec['before']=snap();loc(c).click(timeout=5000);rec['AX']=p.locator('body').aria_snapshot();rec['after']=snap()
   elif c['action']=='fill':loc(c).fill(c['value']);rec['after']=snap()
   elif c['action']=='key':p.keyboard.press(c['key']);rec['AX']=p.locator('body').aria_snapshot();rec['after']=snap()
   elif c['action']=='wheel':p.mouse.move(c.get('x',p.viewport_size['width']-10),c.get('y',p.viewport_size['height']//2));p.mouse.wheel(c.get('dx',0),c['dy']);p.wait_for_timeout(80);rec['after']=snap()
   elif c['action']=='select':loc(c).select_option(label=c['value']);rec['AX']=p.locator('body').aria_snapshot();rec['after']=snap()
   elif c['action']=='screenshot':p.screenshot(path=str(R/c['file']));rec['screen']=snap()
   elif c['action']=='clipboard':rec['text']=p.evaluate('navigator.clipboard.readText()');(R/c['file']).write_text(rec['text']);rec['screen']=snap()
   elif c['action']=='download':
    with p.expect_download() as d:loc(c).click()
    d.value.save_as(R/c['file']);rec['file']=c['file'];rec['sha256']=sha((R/c['file']).read_bytes());rec['screen']=snap()
   elif c['action']=='file':
    with p.expect_file_chooser() as f:loc(c).click()
    f.value.set_files(str(R/c['file']));rec['AX']=p.locator('body').aria_snapshot();rec['after']=snap()
   elif c['action']=='storage':rec['storage']=p.evaluate('Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)]))');(R/c['file']).write_text(json.dumps(rec['storage'],ensure_ascii=False,indent=2));rec['screen']=snap()
   elif c['action']=='read':rec['text']=loc(c).inner_text();rec['rect']=loc(c).bounding_box()
   elif c['action']=='quit':emit(rec);break
   else:raise ValueError(c)
  except Exception:rec['actionError']=traceback.format_exc()
  emit(rec)
finally:
 try:
  if ctx:ctx.close()
  browser.close();pw.stop();server.terminate();server.wait(timeout=10)
 except Exception:errors.append(traceback.format_exc())
 (R/'runtime.json').write_text(json.dumps({'source':'df726e5898f24e23d69e47651d3bf6cbea302412','resources':resources,'console':console,'pageerrors':errors,'actualServerExitAfterTerminate':server.returncode},ensure_ascii=False,indent=2));code=int(bool(errors));sys.exit(code)
