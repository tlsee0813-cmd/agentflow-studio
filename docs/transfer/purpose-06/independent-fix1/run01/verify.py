import argparse, hashlib, json, sys, traceback, threading, functools, http.server, importlib.metadata, datetime
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent
SHA='d3cc065a3f26f7f64a0d42c5fda9551d8ff3cd270f66badf7c262829375bc2cd'
URL='https://raw.githubusercontent.com/tlsee0813-cmd/agentflow-studio/fbea41f245c4020bc044c7e0c7502d106fc900ae/docs/transfer/purpose-06/author-fix1/purpose-study.html'
GEOM='''s=>{const e=document.querySelector(s);if(!e)return {exists:false};const rr=r=>({x:r.x,y:r.y,width:r.width,height:r.height,top:r.top,bottom:r.bottom,left:r.left,right:r.right});let r=e.getBoundingClientRect(),c={left:0,top:0,right:innerWidth,bottom:innerHeight},clips=[];for(let p=e;p;p=p.parentElement){let st=getComputedStyle(p),b=p.getBoundingClientRect();let x=/(hidden|clip|scroll|auto)/.test(st.overflowX),y=/(hidden|clip|scroll|auto)/.test(st.overflowY);if(x||y){let q={left:b.left+p.clientLeft,top:b.top+p.clientTop,right:b.left+p.clientLeft+p.clientWidth,bottom:b.top+p.clientTop+p.clientHeight};if(x){c.left=Math.max(c.left,q.left);c.right=Math.min(c.right,q.right)}if(y){c.top=Math.max(c.top,q.top);c.bottom=Math.min(c.bottom,q.bottom)}clips.push({id:p.id,tag:p.tagName,self:p===e,x,y,box:q})}}let v={left:Math.max(r.left,c.left),right:Math.min(r.right,c.right),top:Math.max(r.top,c.top),bottom:Math.min(r.bottom,c.bottom)};let samples=[];if(v.right>v.left&&v.bottom>v.top)for(let f of [.25,.5,.75]){let x=v.left+(v.right-v.left)*f,y=v.top+(v.bottom-v.top)*.5,h=document.elementFromPoint(x,y);samples.push({x,y,hit:!!h&&(e===h||e.contains(h)),cover:h?{id:h.id,tag:h.tagName,cls:h.className}:null})}let rg=document.createRange();rg.selectNodeContents(e);let ranges=[...rg.getClientRects()].slice(0,16).map(rr);let st=getComputedStyle(e);return {exists:true,text:e.innerText,value:e.value,rect:rr(r),clip:c,visibleIntersection:v,clips,samples,rangeRects:ranges,display:st.display,visibility:st.visibility,hidden:e.hidden,full:r.width>0&&r.height>0&&r.left>=c.left-.1&&r.right<=c.right+.1&&r.top>=c.top-.1&&r.bottom<=c.bottom+.1,hit:samples.some(x=>x.hit)}}'''
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--out',required=True);ap.add_argument('--wrong-sha-probe',action='store_true');args=ap.parse_args();out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
 result={'startedUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceURL':URL,'expectedSHA256':SHA,'expectedBytes':33944,'plannedSceneIDs':[f'{w}/P{i}' for w in (1440,390) for i in (1,2,3)],'scenes':[],'observations':[],'checks':[],'fatal':None,'cleanupErrors':[],'pageerrors':[],'console':[],'http':[],'environment':{'python':sys.executable,'playwright':importlib.metadata.version('playwright'),'chromiumPath':'/usr/bin/chromium'},'probe':args.wrong_sha_probe}
 server=None;browser=None;pw=None
 def record(name,data):result['observations'].append({'id':name,'data':data});print(name,flush=True);return data
 def check(name,ok,details=None):result['checks'].append({'id':name,'status':'PASS' if ok else 'FAIL','details':details});print(('PASS ' if ok else 'FAIL ')+name,flush=True)
 try:
  source=ROOT/'site/purpose-study.html';result['beforeSHA256']=hashlib.sha256(source.read_bytes()).hexdigest();result['sourceBytes']=source.stat().st_size
  expected='0'*64 if args.wrong_sha_probe else SHA
  if result['beforeSHA256']!=expected or result['sourceBytes']!=33944:raise ValueError('source byte/hash mismatch'+(' (isolated wrong-SHA probe)' if args.wrong_sha_probe else ''))
  class Handler(http.server.SimpleHTTPRequestHandler):
   def log_message(self,fmt,*a):print('HTTP '+fmt%a,flush=True)
  server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'site')));threading.Thread(target=server.serve_forever,daemon=True).start();actual=f'http://127.0.0.1:{server.server_port}/purpose-study.html';result['actualHTTPURL']=actual
  pw=sync_playwright().start();browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);result['environment']['browserVersion']=browser.version
  for width,height in [(1440,900),(390,844)]:
   ctx=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1);p=ctx.new_page();p.on('pageerror',lambda e:result['pageerrors'].append(str(e)));p.on('console',lambda m:result['console'].append({'type':m.type,'text':m.text}));response=p.goto(actual,wait_until='networkidle');body=response.body();result['http'].append({'viewport':[width,height],'url':response.url,'status':response.status,'bodyBytes':len(body),'bodySHA256':hashlib.sha256(body).hexdigest()});check(f'{width}/HTTP',response.status==200 and hashlib.sha256(body).hexdigest()==SHA)
   def geo(s):return p.evaluate(GEOM,s)
   def snap():return p.evaluate('''()=>({scrolls:Object.fromEntries(['mapScroll','main','reader'].map(id=>{let e=document.getElementById(id);return[id,{left:e.scrollLeft,top:e.scrollTop,maxX:e.scrollWidth-e.clientWidth,maxY:e.scrollHeight-e.clientHeight}]})),transform:getComputedStyle(document.getElementById('world')).transform,zoom:document.getElementById('zVal').textContent,selected:[...document.querySelectorAll('.node[aria-pressed="true"]')].map(e=>e.dataset.id),rects:Object.fromEntries(['P1','X1','X2'].map(id=>{let r=document.getElementById('n-'+id).getBoundingClientRect();return[id,{x:r.x,y:r.y,width:r.width,height:r.height}]})),focus:{id:document.activeElement.id,peek:document.activeElement.dataset.peek,loc:document.activeElement.dataset.loc},readerText:document.getElementById('reader').innerText})''')
   def wheel(container,dy=150,dx=0):
    g=geo(container);v=g['visibleIntersection'];x=(v['left']+v['right'])/2;y=v['bottom']-15;p.mouse.move(x,y);before=snap();p.mouse.wheel(dx,dy);p.wait_for_timeout(170);record(f'{width}/wheel/{container}',{'method':'mouse.wheel','dx':dx,'dy':dy,'before':before,'after':snap()})
   def expose(s,container):
    for _ in range(12):
     g=geo(s)
     if g.get('full') and g.get('hit'):return g
     cg=geo(container);r=g['rect'];v=cg['visibleIntersection'];dy=140 if r['bottom']>v['bottom']-8 else -140
     wheel(container,dy)
    raise RuntimeError('cannot expose '+s+' '+json.dumps(geo(s),ensure_ascii=False))
   def click(s,container=None):
    g=expose(s,container) if container else geo(s)
    record(f'{width}/click/{s}',g)
    if not g.get('full') or not g.get('hit'):raise RuntimeError('normal click unavailable '+s)
    t=next(x for x in g['samples'] if x['hit']);p.mouse.click(t['x'],t['y']);p.wait_for_timeout(100)
   def obs(name,selectors):return record(f'{width}/{name}',{s:geo(s) for s in selectors})
   def same_map(a,b):
    return a['selected']==b['selected'] and a['transform']==b['transform'] and all(abs(a['scrolls'][s][k]-b['scrolls'][s][k])<=1 for s in ['mapScroll','main'] for k in ['left','top']) and all(abs(a['rects'][n][k]-b['rects'][n][k])<=1 for n in ['P1','X1','X2'] for k in ['x','y','width','height'])
   raw=p.locator('[id]').evaluate_all('(es)=>es.map(e=>e.id)');check(f'{width}/rawIDs-unique',len(raw)==len(set(raw)),raw)
   obs('initial',['#purposeTxt','#n-P1','#n-X1','#n-X2']);p.screenshot(path=str(out/f'initial-{width}.png'))
   click('#zIn');wheel('#mapScroll',100,60);click('#panel [data-pick="P1"]');saved=record(f'{width}/map-entry-snapshot',snap());check(f'{width}/115%-computed',saved['transform'].startswith('matrix(1.15,'),saved)
   click('#panel [data-act="read"].narrow' if width==390 else '#panel [data-act="read"].wide' if False else '#panel .act.wide [data-act="read"]')
   # fixed target selectors above distinguish rendered mobile/wide controls
   obs('role-condition',['#p-role','#p-keep','#p-unk']);
   if width==390:p.screenshot(path=str(out/'role-condition-390.png'))
   text=p.locator('#reader').inner_text();check(f'{width}/role-boundaries',all(t in text for t in ['재입력','담당자가 내용을 확인하고 게시를 선택','운영 홈페이지에 바로 배포하지 않음','주어지지 않음','아직 정해지지 않았다거나','효과는 아직 확인하지 않았습니다']))
   result['scenes'].append(f'{width}/P1')
   for id in ['X1','X2','X1']:
    s=f'[data-loc="{id}"]';expose(s,'#reader');before=record(f'{width}/locate-{id}-before',snap());click(s);g=obs('located-'+id,['#n-'+id+' .face']);check(f'{width}/located-{id}-actual',g['#n-'+id+' .face']['full'] and g['#n-'+id+' .face']['hit']);check(f'{width}/selection-stays-P1',snap()['selected']==['P1'])
    if width==390:click('#backRead');after=record(f'{width}/read-return-'+id,snap());check(f'{width}/read-position-'+id,abs(after['scrolls']['reader']['top']-before['scrolls']['reader']['top'])<=1 and after['focus']['loc']==id)
   # natural reader scroll; use source button in keep condition, no DOM scrolling
   wheel('#reader',160);expose('[data-peek="keep"]','#reader');before=record(f'{width}/peek-before',{'snapshot':snap(),'anchor':geo('#p-keep')});click('[data-peek="keep"]');obs('peek-open',['#pk-keep','#pk-keep a','#pk-keep [data-act="peek-close"]']);click('#pk-keep [data-act="peek-close"]','#reader');after=record(f'{width}/peek-button-closed',{'snapshot':snap(),'anchor':geo('#p-keep'),'panel':geo('#pk-keep')});check(f'{width}/peek-button-removal-return',not after['panel']['exists'] and abs(after['snapshot']['scrolls']['reader']['top']-before['snapshot']['scrolls']['reader']['top'])<=1 and after['snapshot']['focus']['peek']=='keep' and abs(after['anchor']['rect']['y']-before['anchor']['rect']['y'])<=1)
   click('[data-peek="keep"]','#reader');p.keyboard.press('Escape');closed=record(f'{width}/peek-escape',{'snapshot':snap(),'panel':geo('#pk-keep'),'linkCount':p.locator('.peek a').count(),'closeCount':p.locator('.peek [data-act="peek-close"]').count(),'expanded':p.locator('[data-peek="keep"]').get_attribute('aria-expanded')});check(f'{width}/peek-Escape-removal',not closed['panel']['exists'] and closed['linkCount']==0 and closed['closeCount']==0 and closed['expanded']=='false' and closed['snapshot']['focus']['peek']=='keep')
   click('#rPrep');defaults=obs('prep-defaults',['#pf-ask','#pf-keep','#pf-unknown','#prepClose']);check(f'{width}/default-small-plan',all(t in defaults['#pf-ask']['value'] for t in ['같은 내용을 다시 입력하지','먼저 만들 작은 작업']) and all(t in defaults['#pf-keep']['value'] for t in ['담당자가 내용을 확인하고 게시를 선택','운영 홈페이지에 바로 배포하지 않는다']))
   if width==1440:p.screenshot(path=str(out/'prep-default-1440.png'))
   edit='먼저 받은 소개글 한 편으로 재입력을 줄이는 작은 작업을 정리해 주세요. 게시 여부는 담당자가 선택합니다.'
   click('#pf-ask');p.keyboard.press('Control+A');p.keyboard.insert_text(edit);click('#prepClose');click('#rPrep');check(f'{width}/edit-close-reopen',p.locator('#pf-ask').input_value()==edit);click('#prepClose');result['scenes'].append(f'{width}/P2')
   for repeat in [1,2]:
    click('#rBack');returned=record(f'{width}/whole-return-{repeat}',snap());check(f'{width}/whole-map-exact-{repeat}',same_map(saved,returned),{'before':saved,'after':returned,'deltas':{n:{k:returned['rects'][n][k]-saved['rects'][n][k] for k in saved['rects'][n]} for n in saved['rects']}});obs('returned-visibility-'+str(repeat),['#n-P1','#n-X1','#n-X2']);click('#panel [data-act="read"].narrow' if width==390 else '#panel .act.wide [data-act="read"]');click('#rPrep');check(f'{width}/edit-whole-roundtrip-{repeat}',p.locator('#pf-ask').input_value()==edit);click('#prepClose')
   result['scenes'].append(f'{width}/P3');ctx.close()
 except BaseException as e:
  result['fatal']={'type':type(e).__name__,'message':str(e),'traceback':traceback.format_exc()};print(traceback.format_exc(),flush=True)
 finally:
  for name,obj,method in [('browser',browser,'close'),('playwright',pw,'stop'),('HTTP',server,'shutdown')]:
   if obj:
    try:getattr(obj,method)()
    except BaseException as e:result['cleanupErrors'].append({'component':name,'error':repr(e)})
  result['afterSHA256']=hashlib.sha256((ROOT/'site/purpose-study.html').read_bytes()).hexdigest();result['complete']=result['scenes']==result['plannedSceneIDs'];result['finishedUTC']=datetime.datetime.now(datetime.timezone.utc).isoformat();result['exitCode']=int(bool(result['fatal'] or result['cleanupErrors'] or result['pageerrors'] or not result['complete'] or any(c['status']=='FAIL' for c in result['checks']) or result['afterSHA256']!=SHA));(out/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print('ACTUAL_CHILD_EXIT',result['exitCode'],flush=True)
 return result['exitCode']
if __name__=='__main__':sys.exit(main())
