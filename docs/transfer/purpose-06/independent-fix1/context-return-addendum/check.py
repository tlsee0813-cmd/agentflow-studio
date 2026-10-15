import sys,json,hashlib,datetime,threading,functools,http.server,traceback,importlib.metadata
from pathlib import Path
from playwright.sync_api import sync_playwright
from geometry import GEOM
ROOT=Path(__file__).resolve().parent
SOURCE=Path('/workspace/browser-env/purpose-fix1/site/purpose-study.html')
SHA='d3cc065a3f26f7f64a0d42c5fda9551d8ff3cd270f66badf7c262829375bc2cd'
URL='https://raw.githubusercontent.com/tlsee0813-cmd/agentflow-studio/fbea41f245c4020bc044c7e0c7502d106fc900ae/docs/transfer/purpose-06/author-fix1/purpose-study.html'
def utc():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def main():
 r={'startedUTC':utc(),'sourceURL':URL,'sourcePath':str(SOURCE),'expectedSHA256':SHA,'expectedBytes':33944,'plannedIDs':['1440/context-X2','390/context-X2'],'completedIDs':[],'observations':[],'checks':[],'http':[],'pageerrors':[],'console':[],'fatal':None,'cleanupErrors':[],'environment':{'python':sys.executable,'playwrightPackage':importlib.metadata.version('playwright'),'browserExecutable':'/usr/bin/chromium'}}
 server=browser=pw=None
 def record(id,data):r['observations'].append({'id':id,'data':data});print(id,flush=True);return data
 def check(id,ok,data=None):r['checks'].append({'id':id,'status':'PASS' if ok else 'FAIL','details':data});print(('PASS ' if ok else 'FAIL ')+id,flush=True)
 try:
  b=SOURCE.read_bytes();r['beforeSHA256']=hashlib.sha256(b).hexdigest();r['sourceBytes']=len(b)
  if r['beforeSHA256']!=SHA or len(b)!=33944:raise ValueError('source mismatch')
  class H(http.server.SimpleHTTPRequestHandler):
   def log_message(self,f,*args):print('HTTP '+f%args,flush=True)
  server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(SOURCE.parent)));threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/purpose-study.html';r['actualHTTPURL']=url
  pw=sync_playwright().start();browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);r['environment']['browserVersion']=browser.version
  for w,h in [(1440,900),(390,844)]:
   ctx=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=1);p=ctx.new_page();p.on('pageerror',lambda e:r['pageerrors'].append(str(e)));p.on('console',lambda m:r['console'].append({'type':m.type,'text':m.text}));res=p.goto(url,wait_until='networkidle');body=res.body();httpobs={'viewport':[w,h],'URL':res.url,'status':res.status,'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest()};r['http'].append(httpobs);check(f'{w}/HTTP',res.status==200 and httpobs['sha256']==SHA and len(body)==33944,httpobs)
   def geom(s):return p.evaluate(GEOM,s)
   def click(s):
    g=record(f'{w}/before-click/{s}',geom(s))
    if not g['full'] or not g['hit']:raise RuntimeError('target not fully accessible: '+s)
    pt=next(x for x in g['samples'] if x['hit']);p.mouse.click(pt['x'],pt['y']);p.wait_for_timeout(120)
   def snapshot():return {'reader':p.locator('#reader').evaluate('(e)=>({top:e.scrollTop,left:e.scrollLeft,max:e.scrollHeight-e.clientHeight,clientHeight:e.clientHeight,scrollHeight:e.scrollHeight})'),'row':geom('#row-X2'),'button':geom('[data-loc="X2"]'),'selection':p.locator('.node[aria-pressed="true"]').evaluate_all('(es)=>es.map(e=>e.dataset.id)'),'focus':p.evaluate('()=>({id:document.activeElement.id,loc:document.activeElement.dataset.loc,tag:document.activeElement.tagName,text:document.activeElement.innerText})')}
   click('#panel [data-pick="P1"]');click('#panel [data-act="read"].narrow' if w==390 else '#panel .act.wide [data-act="read"]')
   initial=record(f'{w}/reader-initial',snapshot());g=geom('#reader');v=g['visibleIntersection'];p.mouse.move((v['left']+v['right'])/2,v['bottom']-15);p.mouse.wheel(0,100);p.wait_for_timeout(200);before=record(f'{w}/before-location',snapshot());record(f'{w}/wheel',{'method':'page.mouse.wheel','deltaX':0,'deltaY':100,'beforeTop':initial['reader']['top'],'afterTop':before['reader']['top'],'note':'No DOM scroll, state injection, helper scroll, or target-value enforcement.'});check(f'{w}/natural-noninitial',before['reader']['top']>0)
   click('[data-loc="X2"]');target=record(f'{w}/located-target',geom('#n-X2 .face'));check(f'{w}/target-clip-hit',target['full'] and target['hit'],{'ancestorClip':target['clip'],'selfContentClip':target.get('selfContentClip'),'representativeHits':target['samples']})
   if w==390:click('#backRead')
   # No wheel or scroll after return and before this snapshot.
   after=record(f'{w}/immediate-after-location-return',snapshot());delta={k:after['row']['rect'][k]-before['row']['rect'][k] for k in ['x','y','width','height']};topdelta=after['reader']['top']-before['reader']['top'];record(f'{w}/deltas',{'rowRawDelta':delta,'readerTopDelta':topdelta,'measurement':'immediate after normal click/return; no auxiliary wheel'})
   check(f'{w}/reader-position',abs(topdelta)<=1,{'before':before['reader'],'after':after['reader']});check(f'{w}/row-position-size',all(abs(v)<=1 for v in delta.values()),delta);check(f'{w}/source-button-focus',after['focus'].get('loc')=='X2',after['focus']);check(f'{w}/P1-selection',before['selection']==after['selection']==['P1']);check(f'{w}/returned-button-access',after['button']['full'] and after['button']['hit']);r['completedIDs'].append(f'{w}/context-X2');ctx.close()
 except BaseException as e:r['fatal']={'type':type(e).__name__,'message':str(e),'traceback':traceback.format_exc()};print(traceback.format_exc(),flush=True)
 finally:
  for label,obj,method in [('browser',browser,'close'),('playwright',pw,'stop'),('HTTP',server,'shutdown')]:
   if obj:
    try:getattr(obj,method)()
    except BaseException as e:r['cleanupErrors'].append({'component':label,'error':repr(e)})
  try:r['afterSHA256']=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
  except BaseException as e:r['cleanupErrors'].append({'component':'afterHash','error':repr(e)})
  r['complete']=r['plannedIDs']==r['completedIDs'];r['finishedUTC']=utc();r['exitCode']=int(bool(r['fatal'] or r['cleanupErrors'] or r['pageerrors'] or not r['complete'] or r.get('afterSHA256')!=SHA or any(x['status']=='FAIL' for x in r['checks'])));(ROOT/'result.json').write_text(json.dumps(r,ensure_ascii=False,indent=2));print('CHILD_EXIT',r['exitCode'],flush=True)
 return r['exitCode']
if __name__=='__main__':sys.exit(main())
