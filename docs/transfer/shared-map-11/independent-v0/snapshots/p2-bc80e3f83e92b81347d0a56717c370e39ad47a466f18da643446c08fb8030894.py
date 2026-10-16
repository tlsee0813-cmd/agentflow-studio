GEOM='s=>{const e=document.querySelector(s);if(!e)return {exists:false};const rr=r=>({x:r.x,y:r.y,width:r.width,height:r.height,top:r.top,bottom:r.bottom,left:r.left,right:r.right});let r=e.getBoundingClientRect(),c={left:0,top:0,right:innerWidth,bottom:innerHeight},clips=[];for(let p=e;p;p=p.parentElement){let st=getComputedStyle(p),b=p.getBoundingClientRect();let x=/(hidden|clip|scroll|auto)/.test(st.overflowX),y=/(hidden|clip|scroll|auto)/.test(st.overflowY);if(x||y){let sx=p.offsetWidth?b.width/p.offsetWidth:1,sy=p.offsetHeight?b.height/p.offsetHeight:1;let q={left:b.left+p.clientLeft*sx,top:b.top+p.clientTop*sy,right:b.left+(p.clientLeft+p.clientWidth)*sx,bottom:b.top+(p.clientTop+p.clientHeight)*sy};if(p===e)var ownClip=q;if(p!==e&&x){c.left=Math.max(c.left,q.left);c.right=Math.min(c.right,q.right)}if(p!==e&&y){c.top=Math.max(c.top,q.top);c.bottom=Math.min(c.bottom,q.bottom)}clips.push({id:p.id,tag:p.tagName,self:p===e,x,y,box:q})}}let v={left:Math.max(r.left,c.left),right:Math.min(r.right,c.right),top:Math.max(r.top,c.top),bottom:Math.min(r.bottom,c.bottom)};let samples=[];if(v.right>v.left&&v.bottom>v.top)for(let f of [.25,.5,.75]){let x=v.left+(v.right-v.left)*f,y=v.top+(v.bottom-v.top)*.5,h=document.elementFromPoint(x,y);samples.push({x,y,hit:!!h&&(e===h||e.contains(h)),cover:h?{id:h.id,tag:h.tagName,cls:h.className}:null})}let rg=document.createRange();rg.selectNodeContents(e);let ranges=[...rg.getClientRects()].slice(0,16).map(rr);let st=getComputedStyle(e);return {exists:true,text:e.innerText,value:e.value,rect:rr(r),selfContentClip:typeof ownClip!=="undefined"?ownClip:null,clip:c,visibleIntersection:v,clips,samples,rangeRects:ranges,display:st.display,visibility:st.visibility,hidden:e.hidden,full:r.width>0&&r.height>0&&r.left>=c.left-.1&&r.right<=c.right+.1&&r.top>=c.top-.1&&r.bottom<=c.bottom+.1,hit:samples.some(x=>x.hit)}}'
import sys,json,hashlib,datetime,threading,functools,http.server,traceback,importlib.metadata,argparse
from pathlib import Path
from playwright.sync_api import sync_playwright

def utc():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--site',required=True);ap.add_argument('--manifest',required=True);ap.add_argument('--out',required=True);ap.add_argument('--label',required=True);a=ap.parse_args();site=Path(a.site);out=Path(a.out);out.mkdir(exist_ok=True);expected=json.loads(Path(a.manifest).read_text())
 r={'label':a.label,'scope':'Known P2 preview regression only; NOT final independent acceptance','startedUTC':utc(),'plannedIDs':[f'{w}/{c}/P2' for w in [1280,1440] for c in ['flow091','powertoys']],'completedIDs':[],'checks':[],'observations':[],'http':[],'console':[],'pageerrors':[],'fatal':None,'cleanupErrors':[],'environment':{'python':sys.executable,'playwrightPackage':importlib.metadata.version('playwright'),'chromiumExecutable':'/usr/bin/chromium'}}
 server=browser=pw=None
 def hashes():return {f:{'bytes':len((site/f).read_bytes()),'sha256':hashlib.sha256((site/f).read_bytes()).hexdigest()} for f in expected}
 def check(id,ok,data=None):r['checks'].append({'id':id,'status':'PASS' if ok else 'FAIL','details':data});print(('PASS ' if ok else 'FAIL ')+id,flush=True)
 def record(id,data):r['observations'].append({'id':id,'data':data});print(id,flush=True);return data
 try:
  r['beforeFiles']=hashes()
  if r['beforeFiles']!=expected:raise ValueError('runtime file bytes/SHA mismatch')
  class H(http.server.SimpleHTTPRequestHandler):
   def log_message(self,f,*args):print('HTTP '+f%args,flush=True)
  server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(site)));threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/index.html';r['actualHTTPURL']=url
  pw=sync_playwright().start();browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);r['environment']['browserVersion']=browser.version
  for w,h in [(1280,720),(1440,900)]:
   for case,index,node in [('flow091',0,'C32'),('powertoys',1,'SR')]:
    tag=f'{w}/{case}';ctx=browser.new_context(viewport={'width':w,'height':h});p=ctx.new_page();responses=[];p.on('response',lambda res:responses.append(res));p.on('pageerror',lambda e,t=tag:r['pageerrors'].append({'scenario':t,'error':str(e)}));p.on('console',lambda m,t=tag:r['console'].append({'scenario':t,'type':m.type,'text':m.text}));p.goto(url,wait_until='networkidle');p.wait_for_selector('#app[data-ready="1"]')
    for res in responses:
     rel=res.url.split(f':{server.server_port}/')[-1].split('?')[0]
     if rel in expected:
      b=res.body();data={'scenario':tag,'url':res.url,'path':rel,'status':res.status,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()};r['http'].append(data);check(tag+'/HTTP/'+rel,res.status==200 and {'bytes':len(b),'sha256':data['sha256']}==expected[rel],data)
    seen={x['path'] for x in r['http'] if x['scenario']==tag};check(tag+'/all-runtime-responses',seen==set(expected),{'seen':sorted(seen),'expected':sorted(expected)})
    def geom(s):return p.evaluate(GEOM,s)
    def ensure(s,container):
     for _ in range(15):
      g=geom(s)
      if g.get('full') and g.get('hit'):return g
      v=geom(container)['visibleIntersection'];b=g['rect'];dy=min(130,b['bottom']-v['bottom']+10) if b['bottom']>v['bottom'] else -min(130,v['top']-b['top']+10);p.mouse.move(v['right']-10,v['bottom']-10);p.mouse.wheel(0,dy);p.wait_for_timeout(120)
     raise RuntimeError('cannot access '+s)
    def click(s,container=None):
     g=ensure(s,container) if container else geom(s);record(tag+'/click/'+s,g)
     if not g.get('full') or not g.get('hit'):raise RuntimeError('normal click unavailable '+s)
     pt=next(x for x in g['samples'] if x['hit']);p.mouse.click(pt['x'],pt['y']);p.wait_for_timeout(100)
    def value(text):
     click('#draftText','#draftBody');p.keyboard.press('Control+A')
     if text:p.keyboard.insert_text(text)
     else:p.keyboard.press('Backspace')
     p.wait_for_timeout(100)
    def snap(stage):return record(tag+'/'+stage,{'draftTitle':p.locator('#draftTitle').inner_text(),'caseTitle':p.locator('#caseSel option:checked').inner_text(),'input':p.locator('#draftText').input_value(),'previewText':p.locator('#draftPreview').text_content(),'previewHidden':p.locator('#draftPreview').get_attribute('hidden') is not None,'previewGeometry':geom('#draftPreview'),'copyDisabled':p.locator('#draftCopyBtn').is_disabled(),'previewDisabled':p.locator('#draftPreviewBtn').is_disabled(),'copyStatus':p.locator('#draftStatus').inner_text()})
    click('#caseSel');p.keyboard.press('Home')
    if index:p.keyboard.press('ArrowDown')
    p.keyboard.press('Enter');p.wait_for_timeout(150);click('[data-node="'+node+'"]',' #mapScroll'.strip());click('#panel [data-act="draft"]','#panel');empty=snap('initial-empty');check(tag+'/initial-empty',empty['input']=='' and empty['copyDisabled'] and empty['previewDisabled'])
    e1='E1 '+case+' 이 부분의 현재 근거와 선택 범위를 먼저 확인해 주세요.';e2='E2 '+case+' 수정 선택지를 제안하고 다른 부분은 자동 변경하지 말아 주세요.';e3='E3 '+case+' 비어 있던 초안을 다시 적었습니다. 실제 송신은 하지 않습니다.'
    value(e1);click('#draftPreviewBtn','#draftBody');first=snap('E1-preview');check(tag+'/E1-preview',not first['previewHidden'] and e1 in first['previewText'])
    value(e2);second=snap('E2-after-edit');check(tag+'/P2-open-preview-current',not second['previewHidden'] and e2 in second['previewText'] and e1 not in second['previewText'],{'classification':'UI_P2 if input E2 while visible preview retains E1','actual':second})
    click('#draftCopyBtn','#draftBody');p.wait_for_timeout(200);click('#draftText','#draftBody');p.keyboard.press('Control+A');p.keyboard.press('Control+V');p.wait_for_timeout(120);paste=snap('actual-copy-then-keyboard-paste');check(tag+'/copy-actual-target-content',e2 in paste['input'] and paste['draftTitle'] in paste['input'] and '대상:' in paste['input'],paste)
    value('  \n  ');white=snap('whitespace');check(tag+'/whitespace-disabled-hidden',white['previewHidden'] and white['copyDisabled'] and white['previewDisabled'])
    value('');zero=snap('empty');check(tag+'/empty-disabled-hidden',zero['previewHidden'] and zero['copyDisabled'] and zero['previewDisabled'])
    value(e3);retype=snap('retype-before-preview');check(tag+'/retype-enabled',not retype['copyDisabled'] and not retype['previewDisabled']);click('#draftPreviewBtn','#draftBody');last=snap('retype-preview');check(tag+'/retype-current',not last['previewHidden'] and e3 in last['previewText'] and e1 not in last['previewText'] and e2 not in last['previewText']);r['completedIDs'].append(tag+'/P2');ctx.close()
 except BaseException as e:r['fatal']={'type':type(e).__name__,'message':str(e),'traceback':traceback.format_exc()};print(traceback.format_exc(),flush=True)
 finally:
  for name,obj,method in [('browser',browser,'close'),('playwright',pw,'stop'),('HTTP',server,'shutdown')]:
   if obj:
    try:getattr(obj,method)()
    except BaseException as e:r['cleanupErrors'].append({'component':name,'error':repr(e)})
  r['afterFiles']=hashes();r['complete']=r['completedIDs']==r['plannedIDs'];r['finishedUTC']=utc();major=[x for x in r['console'] if x['type']=='error' and '404 (File not found)' not in x['text']];r['majorConsoleErrors']=major;r['exitCode']=int(bool(r['fatal'] or r['cleanupErrors'] or r['pageerrors'] or major or not r['complete'] or r['afterFiles']!=expected or any(c['status']=='FAIL' for c in r['checks'])));(out/'result.json').write_text(json.dumps(r,ensure_ascii=False,indent=2));print('CHILD_EXIT',r['exitCode'],flush=True)
 return r['exitCode']
if __name__=='__main__':sys.exit(main())
