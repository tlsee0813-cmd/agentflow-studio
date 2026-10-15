import re
import sys,json,hashlib,datetime,threading,functools,http.server,traceback,importlib.metadata,argparse
from pathlib import Path
from playwright.sync_api import sync_playwright
from geometry import GEOM
ROOT=Path(__file__).resolve().parent
SOURCE=ROOT/'site/change-record-study.html'
SHA='d10e7dcac86bf4d569164ad9276a7686a92aec43ad4ec8bd68924e88ecf897cb'
URL='https://raw.githubusercontent.com/tlsee0813-cmd/agentflow-studio/0dfadba788e0f2f035bbe51b899b9c02e4260e45/docs/transfer/change-record-07/author-fix1/change-record-study.html'
NAMES={'P1':'네이티브 메뉴의 업데이트 표시','P2':'설정 메뉴의 업데이트 표시','P3':'다운로드 남은 시간 계산'}
def utc():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--out',required=True);args=ap.parse_args();out=Path(args.out);out.mkdir(exist_ok=True)
 r={'startedUTC':utc(),'sourceURL':URL,'expectedBytes':42420,'expectedSHA256':SHA,'plannedIDs':[f'{w}/path{i}' for w in [1440,390] for i in [1,2,3]],'completedIDs':[],'observations':[],'checks':[],'http':[],'console':[],'pageerrors':[],'fatal':None,'cleanupErrors':[],'notRun':['human understanding/usability','original project execution/CI/acceptance/handoff success','actual AI send','external source roundtrip','touch/pinch'],'environment':{'python':sys.executable,'playwrightPackage':importlib.metadata.version('playwright'),'chromiumExecutable':'/usr/bin/chromium'}}
 server=browser=pw=None
 def record(id,data):r['observations'].append({'id':id,'data':data});print(id,flush=True);return data
 def check(id,ok,data=None):r['checks'].append({'id':id,'status':'PASS' if ok else 'FAIL','details':data});print(('PASS ' if ok else 'FAIL ')+id,flush=True)
 try:
  b=SOURCE.read_bytes();r['beforeSHA256']=hashlib.sha256(b).hexdigest();r['sourceBytes']=len(b)
  if len(b)!=42420 or r['beforeSHA256']!=SHA:raise ValueError('source mismatch')
  class H(http.server.SimpleHTTPRequestHandler):
   def log_message(self,f,*args):print('HTTP '+f%args,flush=True)
  server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(SOURCE.parent)));threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/change-record-study.html';r['actualHTTPURL']=url
  pw=sync_playwright().start();browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);r['environment']['browserVersion']=browser.version
  for w,h in [(1440,900),(390,844)]:
   ctx=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=1);p=ctx.new_page();p.on('pageerror',lambda e:r['pageerrors'].append(str(e)));p.on('console',lambda m:r['console'].append({'type':m.type,'text':m.text}));res=p.goto(url,wait_until='networkidle');body=res.body();resp={'viewport':[w,h],'url':res.url,'status':res.status,'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest()};r['http'].append(resp);check(f'{w}/HTTP',res.status==200 and len(body)==42420 and resp['sha256']==SHA,resp)
   def geom(s):return p.evaluate(GEOM,s)
   def native(s):return p.locator(s).evaluate('(e)=>({left:e.scrollLeft,top:e.scrollTop,maxX:e.scrollWidth-e.clientWidth,maxY:e.scrollHeight-e.clientHeight,clientHeight:e.clientHeight,scrollHeight:e.scrollHeight})')
   def focus():return p.evaluate('()=>({id:document.activeElement.id,loc:document.activeElement.dataset.loc,peek:document.activeElement.dataset.peek,tag:document.activeElement.tagName,text:document.activeElement.innerText})')
   def snap():return p.evaluate('''()=>{let rect=e=>{let r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}},scroll=e=>({left:e.scrollLeft,top:e.scrollTop,maxX:e.scrollWidth-e.clientWidth,maxY:e.scrollHeight-e.clientHeight});return{view:document.querySelector('.seg button[aria-pressed="true"]').dataset.view,selected:[...document.querySelectorAll('.node[aria-pressed="true"]')].map(e=>e.dataset.id),transform:getComputedStyle(document.getElementById('world')).transform,zoom:document.getElementById('zVal').textContent,scrolls:Object.fromEntries(['mapScroll','main','reader'].map(id=>[id,scroll(document.getElementById(id))])),cards:[...document.querySelectorAll('.node')].map(e=>({id:e.dataset.id,rect:rect(e),text:e.innerText,rows:[...e.querySelectorAll('.r')].map(x=>({text:x.innerText,cls:x.className,rect:rect(x)}))})),edges:[...document.querySelectorAll('#edges g[data-rel]')].map(e=>{let path=e.querySelector('path.ln');let m=path.getScreenCTM();return{id:e.dataset.rel,from:e.dataset.from,to:e.dataset.to,rect:rect(e),d:path.getAttribute('d'),pathRect:rect(path),matrix:{a:m.a,b:m.b,c:m.c,d:m.d,e:m.e,f:m.f},label:e.querySelector('text').textContent}}),summary:document.getElementById('summary').innerText,scope:document.getElementById('scope').innerText,follow:document.getElementById('followTxt').innerText,focus:{id:document.activeElement.id,loc:document.activeElement.dataset.loc,peek:document.activeElement.dataset.peek}}}''')
   def wheel(container,dy=120,dx=0):
    g=geom(container);v=g['visibleIntersection'];x=v['right']-12;y=v['bottom']-12
    before={s:native(s) for s in ['#mapScroll','#reader','#prepScroll']};p.mouse.move(x,y);p.mouse.wheel(dx,dy);p.wait_for_timeout(150);record(f'{w}/wheel/{container}',{'method':'page.mouse.wheel','dy':dy,'dx':dx,'pointer':[x,y],'before':before,'after':{s:native(s) for s in before}})
   def accessible(s,g):
    if g.get("full") and g.get("hit"):return True
    if s.startswith("#n-") and " " not in s and g.get("hit"):
     name=geom(s+" .nm");rows=geom(s+" .rows")
     return name["full"] and rows["full"]
    return False
   def expose(s,container):
    for _ in range(18):
     g=geom(s)
     if accessible(s,g):return g
     v=geom(container)['visibleIntersection'];b=g['rect'];dy=120 if b['bottom']>v['bottom']-2 else -120;dx=0
     if b['right']>v['right']+1:dx=60
     elif b['left']<v['left']-1:dx=-60
     wheel(container,dy,dx)
    raise RuntimeError('cannot normally expose '+s+' '+json.dumps(g,ensure_ascii=False))
   def click(s,container=None):
    g=expose(s,container) if container else geom(s);record(f'{w}/click/{s}',g)
    if not accessible(s,g):raise RuntimeError('normal click unavailable '+s)
    point=next(x for x in g['samples'] if x['hit']);p.mouse.click(point['x'],point['y']);p.wait_for_timeout(120)
   def enter(id):click('#n-'+id,'#mapScroll');click('#panel [data-act="read"].narrow' if w==390 else '#panel .act.wide [data-act="read"]')
   def screenshot(name):p.screenshot(path=str(out/name))
   def stable(a,b,id):
    diffs={'cards':{x['id']:{k:y['rect'][k]-x['rect'][k] for k in x['rect']} for x,y in zip(a['cards'],b['cards'])},'mapScroll':{k:b['scrolls']['mapScroll'][k]-a['scrolls']['mapScroll'][k] for k in ['left','top']}}
    check(f'{w}/{id}',a['view']==b['view'] and a['selected']==b['selected'] and a['transform']==b['transform'] and all(abs(v)<=1 for d in diffs['cards'].values() for v in d.values()) and all(abs(v)<=1 for v in diffs['mapScroll'].values()) and all(x['label']==y['label'] and max(abs(u-v) for u,v in zip(map(float,re.findall(r'-?\d+(?:\.\d+)?',x['d'])),map(float,re.findall(r'-?\d+(?:\.\d+)?',y['d']))))<.01 and all(abs(x['pathRect'][k]-y['pathRect'][k])<.01 for k in x['pathRect']) for x,y in zip(a['edges'],b['edges'])) and [x['text'] for x in a['cards']]==[x['text'] for x in b['cards']],{'rawBefore':a,'rawAfter':b,'deltas':diffs})
   def defaults(id):
    vals={f:p.locator('#pf-'+f).input_value() for f in ['purpose','target','ask','keep','unknown']};record(f'{w}/default-prep-{id}',{'values':vals,'geometry':{f:geom('#pf-'+f) for f in vals},'prepScroll':native('#prepScroll'),'askNative':native('#pf-ask')});check(f'{w}/{id}-default-purpose-target',NAMES[id] in vals['target'] and '1月' not in vals['purpose'] and '推定' not in vals['purpose'] and '추정할 수 있을 때' in vals['purpose'] and '1월' in vals['target'] and '닫힌 이유' in vals['unknown'])
    if id=='P3':check(f'{w}/P3-not-predetermined',all(t in vals['ask'] for t in ['지금 코드','입력과 두 화면의 호출','조정이 필요한지','선택지','범위 밖']) and '영향이 없다고 보장하지' in vals['keep'])
    else:check(f'{w}/{id}-not-predetermined',all(t in vals['ask'] for t in ['지금 코드','정확히 무엇','반영 상태','현재 목적','선택지','되돌릴 범위를 미리 정하지']))
    return vals
   def textarea_tail(id):
    expose('#pf-ask','#prepScroll');click('#pf-ask');before={'textarea':native('#pf-ask'),'outer':native('#prepScroll')};p.keyboard.press('Control+End');p.wait_for_timeout(120);keyState={'textarea':native('#pf-ask'),'outer':native('#prepScroll')};g=geom('#pf-ask');v=g['visibleIntersection'];p.mouse.move((v['left']+v['right'])/2,(v['top']+v['bottom'])/2);didWheel=keyState['textarea']['maxY']>0
    if didWheel:p.mouse.wheel(0,120);p.wait_for_timeout(160)
    after={'textarea':native('#pf-ask'),'outer':native('#prepScroll'),'caret':p.locator('#pf-ask').evaluate('(e)=>({start:e.selectionStart,end:e.selectionEnd,length:e.value.length,tail:e.value.slice(-120)})'),'geometry':geom('#pf-ask')};record(f'{w}/{id}-request-tail',{'method':'native textarea focus + Control+End; mouse.wheel(0,120) inside textarea only when native overflow exists; no DOM scroll','before':before,'afterKey':keyState,'actualTextareaWheel':didWheel,'after':after});check(f'{w}/{id}-request-end-access',after['caret']['end']==after['caret']['length'] and (after['textarea']['maxY']==0 or abs(after['textarea']['top']-after['textarea']['maxY'])<=2) and after['geometry']['full'] and after['geometry']['hit'])
   # Path 1: raw same-position comparison, then actual access to three cards in both views.
   ids=p.locator('[id]').evaluate_all('(es)=>es.map(e=>e.id)');check(f'{w}/raw-dom-ID-unique',len(ids)==len(set(ids)),ids)
   if w==1440:screenshot('initial-1440.png')
   header=record(f'{w}/initial-header',{s:geom(s) for s in ['#purposeTxt','#scope','#followTxt','#followOpen']});check(f'{w}/header-access',header['#purposeTxt']['full'] and header['#followOpen']['full'] and header['#followOpen']['hit'])
   after=record(f'{w}/comparison-after',snap());click('#vBefore');before=record(f'{w}/comparison-before',snap())
   if w==1440:screenshot('comparison-before-1440.png')
   check(f'{w}/same-three-targets-two-relations',all([x['id'] for x in s['cards']]==['P1','P2','P3'] and [x['id'] for x in s['edges']]==['R1','R2'] and len(set(x['id'] for x in s['edges']))==2 and [(x['from'],x['to']) for x in s['edges']]==[('P1','P3'),('P2','P3')] for s in [before,after]))
   check(f'{w}/comparison-geometry-stable',all(x['rect']==y['rect'] for x,y in zip(before['cards'],after['cards'])) and all(x['d']==y['d'] for x,y in zip(before['edges'],after['edges'])))
   check(f'{w}/responsibility-content',all('표시 문구·분기 고르기' in c['text'] and '세 숫자로 계산 요청' in c['text'] for c in before['cards'][:2]) and '메뉴에서' in before['cards'][2]['text'] and all('옮겨 감' in c['text'] and '다운로드 상태로 계산 요청' in c['text'] for c in after['cards'][:2]) and '옮겨 옴' in after['cards'][2]['text'] and before['edges'][0]['label']=='세 숫자로 계산 요청' and after['edges'][0]['label']=='다운로드 상태로 계산 요청' and after['edges'][1]['label']=='다운로드 상태로 같은 계산 사용')
   for view in ['before','after']:
    if p.locator('#v'+view.title()).get_attribute('aria-pressed')!='true':click('#v'+view.title())
    for id in ['P1','P2','P3']:
     expose('#n-'+id,'#mapScroll');record(f'{w}/{view}/actual-card-{id}',{'card':geom('#n-'+id),'rows':geom('#n-'+id+' .rows')})
    click('#followOpen');record(f'{w}/{view}/follow-dialog',{'text':p.locator('#followDlg').inner_text(),'geometry':geom('#followDlg'),'close':geom('#fClose')});check(f'{w}/{view}-follow-boundary',all(t in p.locator('#followDlg').inner_text() for t in ['워크벤치 업데이트 파일','네이티브 메뉴바 파일','merged=false','확인하지 않았습니다']));click('#fClose')
   r['completedIDs'].append(f'{w}/path1')
   # Path 2: P3 reader -> related P2 -> return; narrow natural scroll only.
   enter('P3');wheel('#reader',100);expose('[data-loc="P2"]','#reader');pre=record(f'{w}/related-before',{'reader':native('#reader'),'row':geom('#row-P2'),'button':geom('[data-loc="P2"]'),'focus':focus()});click('[data-loc="P2"]');target=record(f'{w}/related-map-target',geom('#n-P2 .face'));check(f'{w}/related-target-clip-hit',target['full'] and target['hit'])
   if w==390:click('#backRead')
   post=record(f'{w}/related-after-immediate',{'reader':native('#reader'),'row':geom('#row-P2'),'button':geom('[data-loc="P2"]'),'focus':focus(),'selected':p.locator('.node[aria-pressed="true"]').evaluate_all('(es)=>es.map(e=>e.dataset.id)')});rd={k:post['row']['rect'][k]-pre['row']['rect'][k] for k in ['x','y','width','height']};check(f'{w}/related-reader-row-focus',abs(post['reader']['top']-pre['reader']['top'])<=1 and all(abs(v)<=1 for v in rd.values()) and post['focus']['loc']=='P2' and post['selected']==['P3'],{'rowDelta':rd,'scrollDelta':post['reader']['top']-pre['reader']['top'],'naturalNoninitial':pre['reader']['top']>0})
   if pre['reader']['maxY']==0:r['notRun'].append(f'{w}/noninitial related-reader scroll (no natural overflow)')
   for key,anchor in [('code','#p-code'),('follow','#p-follow')]:
    expose(f'[data-peek="{key}"]','#reader');pkbefore=record(f'{w}/{key}-before',{'reader':native('#reader'),'anchor':geom(anchor),'focus':focus()});click(f'[data-peek="{key}"]');record(f'{w}/{key}-open',{'panel':geom('#pk-'+key),'text':p.locator('#pk-'+key).inner_text(),'linkCount':p.locator('#pk-'+key+' a').count()})
    if w==390 and key=='follow':screenshot('390-P3-follow.png')
    click('#pk-'+key+' [data-act="peek-close"]','#reader');pkafter=record(f'{w}/{key}-closed',{'reader':native('#reader'),'anchor':geom(anchor),'focus':focus(),'panel':geom('#pk-'+key),'links':p.locator('.peek a').count(),'closeButtons':p.locator('.peek [data-act="peek-close"]').count()});check(f'{w}/{key}-close-return',not pkafter['panel']['exists'] and pkafter['links']==pkafter['closeButtons']==0 and pkafter['focus']['peek']==key and abs(pkafter['reader']['top']-pkbefore['reader']['top'])<=1 and abs(pkafter['anchor']['rect']['y']-pkbefore['anchor']['rect']['y'])<=1)
    click(f'[data-peek="{key}"]','#reader');p.keyboard.press('Escape');p.wait_for_timeout(100);esc=record(f'{w}/{key}-Escape',{'reader':native('#reader'),'anchor':geom(anchor),'focus':focus(),'panel':geom('#pk-'+key),'links':p.locator('.peek a').count(),'closeButtons':p.locator('.peek [data-act="peek-close"]').count()});check(f'{w}/{key}-Escape-return',not esc['panel']['exists'] and esc['links']==esc['closeButtons']==0 and esc['focus']['peek']==key and abs(esc['reader']['top']-pkafter['reader']['top'])<=1 and abs(esc['anchor']['rect']['y']-pkafter['anchor']['rect']['y'])<=1)
   click('#rPrep');defaults('P3');textarea_tail('P3');click('#prepClose');click('#rBack');r['completedIDs'].append(f'{w}/path2')
   # Path 3: independent P1 and P2 map baselines, edits retained per target.
   click('#vBefore');click('#zIn');wheel('#mapScroll',110,60);click('#n-P1','#mapScroll');A=record(f'{w}/P1-entry-map-A',snap());check(f'{w}/actual-115%',A['transform'].startswith('matrix(1.15,'));click('#panel [data-act="read"].narrow' if w==390 else '#panel .act.wide [data-act="read"]');click('#rPrep');d1=defaults('P1')
   # Default preparation screenshot recorded after native tail access on 390, before editing.
   textarea_tail('P1')
   if w==390:screenshot('prep-default-P1-390.png')
   E='현재 네이티브 메뉴가 공통 계산에 넘기는 입력과 1월 21일 되돌림 요청의 범위·반영 상태를 확인해 주세요. 다운로드 남은 시간을 알리는 목적에 맞춰 이 메뉴의 수정 선택지를 제안하고, 다른 파일 변경은 범위 밖 제안으로 구분해 주세요.';click('#pf-ask');p.keyboard.press('Control+A');p.keyboard.insert_text(E);click('#prepClose')
   if w==390:click('[data-loc="P3"]','#reader')
   click('#vAfter')
   if w==390:click('#backRead')
   click('#rPrep');check(f'{w}/P1-edit-after-compare',p.locator('#pf-ask').input_value()==E);click('#prepClose');click('#rBack');B=record(f'{w}/P1-return-map-B-immediate',snap());stable(A,B,'P1-map-restoration');check(f'{w}/P1-return-before-responsibility',B['view']=='before' and all('세 숫자' in x['label'] for x in B['edges']) and all('여기서' in x['text'] for x in B['cards'][:2]))
   click('#n-P2','#mapScroll');A2=record(f'{w}/P2-entry-map-A2',snap());click('#panel [data-act="read"].narrow' if w==390 else '#panel .act.wide [data-act="read"]');click('#rPrep');d2=defaults('P2');check(f'{w}/P2-specific-default-no-E',d2['ask']!=E and '워크벤치 업데이트 파일' in d2['ask'] and '네이티브 메뉴바 파일' not in d2['ask'] and NAMES['P2'] in d2['target']);textarea_tail('P2');click('#prepClose');click('#rBack');B2=record(f'{w}/P2-return-map-B2-immediate',snap());stable(A2,B2,'P2-map-restoration');enter('P1');click('#rPrep');check(f'{w}/P1-E-survives-P2',p.locator('#pf-ask').input_value()==E);record(f'{w}/P1-final-edited-values',{f:p.locator('#pf-'+f).input_value() for f in ['purpose','target','ask','keep','unknown']});click('#prepClose');r['completedIDs'].append(f'{w}/path3');ctx.close()
 except BaseException as e:
  r['fatal']={'type':type(e).__name__,'message':str(e),'traceback':traceback.format_exc()};print(traceback.format_exc(),flush=True)
 finally:
  for label,obj,method in [('browser',browser,'close'),('playwright',pw,'stop'),('HTTP',server,'shutdown')]:
   if obj:
    try:getattr(obj,method)()
    except BaseException as e:r['cleanupErrors'].append({'component':label,'error':repr(e)})
  try:r['afterSHA256']=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
  except BaseException as e:r['cleanupErrors'].append({'component':'afterHash','error':repr(e)})
  r['complete']=r['completedIDs']==r['plannedIDs'];r['finishedUTC']=utc();r['exitCode']=int(bool(r['fatal'] or r['cleanupErrors'] or r['pageerrors'] or not r['complete'] or r.get('afterSHA256')!=SHA or any(c['status']=='FAIL' for c in r['checks'])));(out/'result.json').write_text(json.dumps(r,ensure_ascii=False,indent=2));print('CHILD_EXIT',r['exitCode'],flush=True)
 return r['exitCode']
if __name__=='__main__':sys.exit(main())
