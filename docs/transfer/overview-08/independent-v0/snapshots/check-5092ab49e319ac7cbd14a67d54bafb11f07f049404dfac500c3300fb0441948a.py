GEOM='s=>{const e=document.querySelector(s);if(!e)return {exists:false};const rr=r=>({x:r.x,y:r.y,width:r.width,height:r.height,top:r.top,bottom:r.bottom,left:r.left,right:r.right});let r=e.getBoundingClientRect(),c={left:0,top:0,right:innerWidth,bottom:innerHeight},clips=[];for(let p=e;p;p=p.parentElement){let st=getComputedStyle(p),b=p.getBoundingClientRect();let x=/(hidden|clip|scroll|auto)/.test(st.overflowX),y=/(hidden|clip|scroll|auto)/.test(st.overflowY);if(x||y){let sx=p.offsetWidth?b.width/p.offsetWidth:1,sy=p.offsetHeight?b.height/p.offsetHeight:1;let q={left:b.left+p.clientLeft*sx,top:b.top+p.clientTop*sy,right:b.left+(p.clientLeft+p.clientWidth)*sx,bottom:b.top+(p.clientTop+p.clientHeight)*sy};if(p===e)var ownClip=q;if(p!==e&&x){c.left=Math.max(c.left,q.left);c.right=Math.min(c.right,q.right)}if(p!==e&&y){c.top=Math.max(c.top,q.top);c.bottom=Math.min(c.bottom,q.bottom)}clips.push({id:p.id,tag:p.tagName,self:p===e,x,y,box:q})}}let v={left:Math.max(r.left,c.left),right:Math.min(r.right,c.right),top:Math.max(r.top,c.top),bottom:Math.min(r.bottom,c.bottom)};let samples=[];if(v.right>v.left&&v.bottom>v.top)for(let f of [.25,.5,.75]){let x=v.left+(v.right-v.left)*f,y=v.top+(v.bottom-v.top)*.5,h=document.elementFromPoint(x,y);samples.push({x,y,hit:!!h&&(e===h||e.contains(h)),cover:h?{id:h.id,tag:h.tagName,cls:h.className}:null})}let rg=document.createRange();rg.selectNodeContents(e);let ranges=[...rg.getClientRects()].slice(0,16).map(rr);let st=getComputedStyle(e);return {exists:true,text:e.innerText,value:e.value,rect:rr(r),selfContentClip:typeof ownClip!=="undefined"?ownClip:null,clip:c,visibleIntersection:v,clips,samples,rangeRects:ranges,display:st.display,visibility:st.visibility,hidden:e.hidden,full:r.width>0&&r.height>0&&r.left>=c.left-.1&&r.right<=c.right+.1&&r.top>=c.top-.1&&r.bottom<=c.bottom+.1,hit:samples.some(x=>x.hit)}}'
import sys,json,hashlib,datetime,threading,functools,http.server,traceback,importlib.metadata,argparse,re
from pathlib import Path
from playwright.sync_api import sync_playwright
SHA='85f07ee4159a6db825be2fa3163142b70b27c4fb56f090c934b3b41f1fe0eb81'
URL='https://raw.githubusercontent.com/tlsee0813-cmd/agentflow-studio/167f86b8ac783a15bc1b2991b73017ee2f1e0d6a/docs/transfer/overview-08/author-fix1/overview-study.html'
def utc():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--source',required=True);ap.add_argument('--out',required=True);args=ap.parse_args();source=Path(args.source);out=Path(args.out)
 r={'startedUTC':utc(),'sourceURL':URL,'expectedBytes':42025,'expectedSHA256':SHA,'plannedIDs':[f'{w}/flow{i}' for w in [1280,1440,390] for i in [1,2]],'completedIDs':[],'checks':[],'observations':[],'http':[],'console':[],'pageerrors':[],'fatal':None,'cleanupErrors':[],'notRun':['large maps','human understanding/usability','actual AI send/handoff','original project execution/CI','external source roundtrip','touch/pinch','all zoom levels'],'environment':{'python':sys.executable,'playwrightPackage':importlib.metadata.version('playwright'),'chromiumExecutable':'/usr/bin/chromium'}}
 server=browser=pw=None
 def record(id,data):r['observations'].append({'id':id,'data':data});print(id,flush=True);return data
 def check(id,ok,data=None):r['checks'].append({'id':id,'status':'PASS' if ok else 'FAIL','details':data});print(('PASS ' if ok else 'FAIL ')+id,flush=True)
 try:
  b=source.read_bytes();r['beforeSHA256']=hashlib.sha256(b).hexdigest();r['sourceBytes']=len(b)
  if len(b)!=42025 or r['beforeSHA256']!=SHA:raise ValueError('source mismatch')
  class H(http.server.SimpleHTTPRequestHandler):
   def log_message(self,f,*a):print('HTTP '+f%a,flush=True)
  server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(source.parent)));threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/overview-study.html';r['actualHTTPURL']=url
  pw=sync_playwright().start();browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);r['environment']['browserVersion']=browser.version
  for w,h in [(1280,720),(1440,900),(390,844)]:
   ctx=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=1);p=ctx.new_page();p.on('pageerror',lambda e:r['pageerrors'].append(str(e)));p.on('console',lambda m:r['console'].append({'type':m.type,'text':m.text}));res=p.goto(url,wait_until='networkidle');body=res.body();hp={'viewport':[w,h],'url':res.url,'status':res.status,'bodyBytes':len(body),'bodySHA256':hashlib.sha256(body).hexdigest()};r['http'].append(hp);check(f'{w}/HTTP',res.status==200 and len(body)==42025 and hp['bodySHA256']==SHA,hp)
   def geom(s):return p.evaluate(GEOM,s)
   def native(s):return p.locator(s).evaluate('(e)=>({left:e.scrollLeft,top:e.scrollTop,maxX:e.scrollWidth-e.clientWidth,maxY:e.scrollHeight-e.clientHeight,clientWidth:e.clientWidth,scrollWidth:e.scrollWidth,clientHeight:e.clientHeight,scrollHeight:e.scrollHeight})')
   def focus():return p.evaluate('()=>({id:document.activeElement.id,loc:document.activeElement.dataset.loc,peek:document.activeElement.dataset.peek,tag:document.activeElement.tagName})')
   def snap():return p.evaluate('''()=>{let rect=e=>{let r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}},sc=e=>({left:e.scrollLeft,top:e.scrollTop,maxX:e.scrollWidth-e.clientWidth,maxY:e.scrollHeight-e.clientHeight});return{view:document.querySelector('.seg button[aria-pressed="true"]').dataset.view,selected:[...document.querySelectorAll('.node[aria-pressed="true"]')].map(e=>e.dataset.id),transform:getComputedStyle(document.getElementById('world')).transform,scrolls:Object.fromEntries(['mapScroll','main','reader'].map(id=>[id,sc(document.getElementById(id))])),cards:[...document.querySelectorAll('.node')].map(e=>({id:e.dataset.id,rect:rect(e),text:e.innerText,chips:[...e.querySelectorAll('.c')].map(x=>({text:x.innerText,rect:rect(x)})),cue:e.querySelector('.cue')?.innerText??null})),edges:[...document.querySelectorAll('#edges g[data-rel]')].map(e=>{let path=e.querySelector('path.ln'),m=path.getScreenCTM(),L=path.getTotalLength(),pt=t=>{let q=path.getPointAtLength(t);return{x:m.a*q.x+m.c*q.y+m.e,y:m.b*q.x+m.d*q.y+m.f}};return{id:e.dataset.rel,from:e.dataset.from,to:e.dataset.to,d:path.getAttribute('d'),rect:rect(e),pathRect:rect(path),label:e.querySelector('text').textContent,matrix:{a:m.a,b:m.b,c:m.c,d:m.d,e:m.e,f:m.f},start:pt(0),end:pt(L)}}),summary:document.getElementById('summary').innerText,focus:document.activeElement.id}}''')
   def content(s):
    g=geom(s);g['font']=p.locator(s).evaluate('(e)=>({fontSize:getComputedStyle(e).fontSize,lineHeight:getComputedStyle(e).lineHeight,pointerEvents:getComputedStyle(e).pointerEvents})');return g
   def visible(s):g=geom(s);return g.get('full') and g.get('hit')
   def wheel(container,dy=90,dx=0):
    v=geom(container)['visibleIntersection'];before=native(container);p.mouse.move(v['right']-10,v['bottom']-10);p.mouse.wheel(dx,dy);p.wait_for_timeout(130);record(f'{w}/wheel/{container}',{'method':'page.mouse.wheel','dx':dx,'dy':dy,'before':before,'after':native(container)})
   def expose(s,container):
    for _ in range(16):
     g=geom(s)
     if g['full'] and g['hit']:return g
     v=geom(container)['visibleIntersection'];b=g['rect'];dx=dy=0
     if b['right']>v['right']+.1:dx=min(90,b['right']-v['right']+6)
     elif b['left']<v['left']-.1:dx=-min(90,v['left']-b['left']+6)
     if b['bottom']>v['bottom']+.1:dy=min(120,b['bottom']-v['bottom']+8)
     elif b['top']<v['top']-.1:dy=-min(120,v['top']-b['top']+8)
     # Hit can be blocked by the reader's sticky toolbar while the box is in clip.
     elif not g['hit']:dy=-75
     wheel(container,dy,dx)
    raise RuntimeError('cannot normally expose '+s+' '+json.dumps(g,ensure_ascii=False))
   def click(s,container=None):
    g=expose(s,container) if container else geom(s);record(f'{w}/click/{s}',g)
    if not g.get('full') or not g.get('hit'):raise RuntimeError('normal click unavailable '+s)
    pt=next(x for x in g['samples'] if x['hit']);p.mouse.click(pt['x'],pt['y']);p.wait_for_timeout(100)
   def edgeclose(a,b):
    for x,y in zip(a['edges'],b['edges']):
     n=lambda d:list(map(float,re.findall(r'-?\d+(?:\.\d+)?',d)))
     if x['id']!=y['id'] or len(n(x['d']))!=len(n(y['d'])) or any(abs(u-v)>.01 for u,v in zip(n(x['d']),n(y['d']))):return False
     if any(abs(x['pathRect'][k]-y['pathRect'][k])>.01 for k in x['pathRect']):return False
    return True
   def same(a,b):return all(all(abs(x['rect'][k]-y['rect'][k])<.01 for k in x['rect']) for x,y in zip(a['cards'],b['cards'])) and edgeclose(a,b) and a['transform']==b['transform'] and a['scrolls']['mapScroll']==b['scrolls']['mapScroll'] and a['scrolls']['main']==b['scrolls']['main']
   def exposure(id):
    s=snap();data={'snapshot':s,'content':{}}
    for n in ['P1','P2','P3']:
     for suffix in ['.nm','.role','.resp']:
      sel='#n-'+n+' '+suffix;data['content'][sel]=content(sel)
     for i in range(p.locator('#n-'+n+' .resp > span').count()):
      sel=f'#n-{n} .resp > span:nth-child({i+1})';data['content'][sel]=content(sel)
    data['edgeGeometry']={f'#e-{i}':{'path':geom(f'#e-{i} path.ln'),'label':content(f'#e-{i} text')} for i in ['R1','R2']};record(f'{w}/{id}',data)
    check(f'{w}/{id}-names-roles-cues',all(g['full'] and g['hit'] for g in data['content'].values()),{'definition':'target boxes inside all ancestor clips and viewport; representative hit separate from full glyph readability'})
    epok=True
    for e in s['edges']:
     a=next(c['rect'] for c in s['cards'] if c['id']==e['from']);b=next(c['rect'] for c in s['cards'] if c['id']==e['to']);cl=data['edgeGeometry']['#e-'+e['id']]['path']['clip']
     for point,card in [(e['start'],a),(e['end'],b)]:
      epok &= card['x']-1<=point['x']<=card['x']+card['width']+1 and card['y']-1<=point['y']<=card['y']+card['height']+1 and cl['left']-.1<=point['x']<=cl['right']+.1 and cl['top']-.1<=point['y']<=cl['bottom']+.1
    check(f'{w}/{id}-two-visible-call-endpoints',epok and all(v['label']['full'] for v in data['edgeGeometry'].values()),{'note':'SVG pointer-events:none, so labels have geometry + underlying hit cover recorded; do not require labels to be clickable.'})
    return s
   def panelobs(id):
    sels=['#panel h2','#panel .strip-l','#panel .strip-c','#panel .strip-r'] if w==390 else ['#panel h2','#panel .rt-tbl']
    d={s:content(s) for s in sels};record(f'{w}/panel-{id}',{'native':native('#panel'),'content':d,'text':p.locator('#panel').inner_text()});check(f'{w}/panel-{id}-text-boxes',all(x['full'] and x['hit'] for x in d.values()))
   # Flow 1: initial -> first actual selection -> before/after -> zoom/native movement -> fit.
   rawIDs=p.locator('[id]').evaluate_all('(es)=>es.map(e=>e.id)');check(f'{w}/raw-ID-unique',len(rawIDs)==len(set(rawIDs)),rawIDs)
   initial=exposure('initial');
   if w in [1280,390]:p.screenshot(path=str(out/f'initial-{w}.png'))
   pre=record(f'{w}/first-selection-pre',snap());click('#n-P3');post=record(f'{w}/first-selection-post',snap());check(f'{w}/first-selection-no-map-reflow',same(pre,post) and post['selected']==['P3'] and [x['text'] for x in pre['cards']]==[x['text'] for x in post['cards']]);panelobs('P3-after')
   click('#vBefore');before=record(f'{w}/comparison-before',snap());exposure('before-view');check(f'{w}/responsibility-before',all([c['text'] for c in card['chips']]==['표시 문구·분기','진행 정보 누락 확인','경과 시간 계산'] for card in before['cards'][:2]) and [x['text'] for x in before['cards'][2]['chips']]==['남은 시간 추정'] and '두 메뉴에서 함' in before['cards'][2]['cue'])
   click('#vAfter');after=record(f'{w}/comparison-after',snap());check(f'{w}/comparison-stable-existing-relations',same(before,after) and [(e['id'],e['from'],e['to']) for e in before['edges']]==[(e['id'],e['from'],e['to']) for e in after['edges']]==[('R1','P1','P3'),('R2','P2','P3')]);check(f'{w}/responsibility-after',all([c['text'] for c in card['chips']]==['표시 문구·분기'] for card in after['cards'][:2]) and [x['text'] for x in after['cards'][2]['chips']]==['남은 시간 추정','진행 정보 누락 확인','경과 시간 계산'])
   click('#zIn');click('#zIn');wheel('#mapScroll',90,60);manual=record(f'{w}/manual-zoom-boundary',{'snapshot':snap(),'commonCard':geom('#n-P3'),'map':native('#mapScroll'),'interpretation':'manual zoom may clip; not an all-zoom pass condition'});click('#fitAll');fit=exposure('after-fit');check(f'{w}/fit-preserves-selection-view',fit['selected']==manual['snapshot']['selected'] and fit['view']==manual['snapshot']['view']);r['completedIDs'].append(f'{w}/flow1')
   # Flow 2: independent nondefault entry snapshot, details, related context, edited preparation, return.
   for _ in range(5):
    scale=float(p.locator('#world').evaluate('(e)=>getComputedStyle(e).transform').split('(')[1].split(',')[0])
    if abs(scale-1.15)<.001:break
    click('#zIn' if scale<1.15 else '#zOut')
   wheel('#mapScroll',90,45);click('#n-P3','#mapScroll');entry=record(f'{w}/detail-entry-map-pre',snap());check(f'{w}/entry-is-nondefault',entry['transform'].startswith('matrix(1.15,'));panelobs('P3-entry')
   if w==1440:p.screenshot(path=str(out/'selected-detail-1440.png'))
   click('#panel [data-act="read"].narrow' if w==390 else '#panel .act.wide [data-act="read"]');expose('#p-code .rt-tbl','#reader');detail=record(f'{w}/explicit-reader-detail',{'text':p.locator('#p-code').inner_text(),'table':geom('#p-code .rt-tbl'),'cells':{f'cell{i+1}':content(f'#p-code .rt-tbl tbody tr:nth-child({i//3+1}) > :nth-child({i%3+1})') for i in range(9)},'lead':p.locator('.lead').inner_text(),'reader':native('#reader')});check(f'{w}/detail-two-responsibilities-input-remain',all(g['full'] and g['hit'] for g in detail['cells'].values()) and all(t in detail['text'] for t in ['진행 정보 누락 확인','경과 시간 계산','받는 입력','세 숫자','다운로드 상태','남는 역할','두 호출은 전후 모두']))
   wheel('#reader',100);expose('[data-loc="P2"]','#reader');rb=record(f'{w}/related-context-before',{'reader':native('#reader'),'row':geom('#row-P2'),'button':geom('[data-loc="P2"]'),'focus':focus()});click('[data-loc="P2"]');target=record(f'{w}/located-P2',geom('#n-P2 .face'));check(f'{w}/located-menu-access',target['full'] and target['hit'])
   if w==390:click('#backRead')
   ra=record(f'{w}/related-context-after-immediate',{'reader':native('#reader'),'row':geom('#row-P2'),'button':geom('[data-loc="P2"]'),'focus':focus()});delta={k:ra['row']['rect'][k]-rb['row']['rect'][k] for k in ['x','y','width','height']};check(f'{w}/related-row-scroll-focus',all(abs(v)<.01 for v in delta.values()) and abs(rb['reader']['top']-ra['reader']['top'])<.01 and ra['focus']['loc']=='P2',{'rawRowDelta':delta,'scrollDelta':ra['reader']['top']-rb['reader']['top']});
   if rb['reader']['maxY']==0:r['notRun'].append(f'{w}/noninitial reader scroll (natural max0)')
   click('#rPrep');defaults={f:p.locator('#pf-'+f).input_value() for f in ['purpose','target','ask','keep','unknown']};record(f'{w}/default-preparation',{'values':defaults,'ask':geom('#pf-ask'),'nativeTextarea':native('#pf-ask'),'outer':native('#prepScroll')});check(f'{w}/fix1-default-boundary',all(t in defaults['ask'] for t in ['지금 코드','입력과 두 화면의 호출','조정이 필요한지','선택지','범위 밖']) and '다운로드 남은 시간 계산' in defaults['target'] and '닫힌 이유' in defaults['unknown'] and '영향이 없다고 보장하지' in defaults['keep'])
   if w==390:p.screenshot(path=str(out/'default-preparation-390.png'))
   click('#pf-ask','#prepScroll');E='현재 공통 계산의 입력과 두 메뉴의 호출을 확인해 주세요. 남은 시간을 알리는 목적과 후속 되돌림 요청의 범위·반영 상태를 대조해 이 함수의 수정 선택지를 제안하고, 다른 파일 변경은 범위 밖 제안으로 구분해 주세요.';p.keyboard.press('Control+A');p.keyboard.insert_text(E);click('#prepClose');click('#rPrep');check(f'{w}/E-close-reopen',p.locator('#pf-ask').input_value()==E);click('#prepClose');click('#rBack');returned=record(f'{w}/detail-return-map-post-immediate',snap());check(f'{w}/entry-map-restored',same(entry,returned) and entry['view']==returned['view'] and entry['selected']==returned['selected'] and all(x['label']==y['label'] for x,y in zip(entry['edges'],returned['edges'])) and [c['text'] for c in entry['cards']]==[c['text'] for c in returned['cards']]);click('#panel [data-act="read"].narrow' if w==390 else '#panel .act.wide [data-act="read"]');click('#rPrep');check(f'{w}/E-after-whole-return',p.locator('#pf-ask').input_value()==E);click('#prepClose')
   if w==1440:
    click('#rBack');click('#n-P1','#mapScroll');panelobs('P1-representative');click('#panel .act.wide [data-act="read"]');click('#rPrep');other={f:p.locator('#pf-'+f).input_value() for f in ['target','ask']};record(f'{w}/other-target-default',other);check(f'{w}/other-target-not-E',other['ask']!=E and '네이티브 메뉴' in other['target'] and '네이티브 메뉴바 파일' in other['ask']);click('#prepClose');click('#rBack');click('#n-P3','#mapScroll');click('#panel .act.wide [data-act="read"]');click('#rPrep');check(f'{w}/E-survives-other-target',p.locator('#pf-ask').input_value()==E);click('#prepClose')
   if w==390:
    # One existing-flow selection observation covers the narrow P1 reserved strip too.
    click('#rBack');click('#n-P1','#mapScroll');panelobs('P1-after')
   r['completedIDs'].append(f'{w}/flow2');ctx.close()
 except BaseException as e:r['fatal']={'type':type(e).__name__,'message':str(e),'traceback':traceback.format_exc()};print(traceback.format_exc(),flush=True)
 finally:
  for label,obj,method in [('browser',browser,'close'),('playwright',pw,'stop'),('HTTP',server,'shutdown')]:
   if obj:
    try:getattr(obj,method)()
    except BaseException as e:r['cleanupErrors'].append({'component':label,'error':repr(e)})
  try:r['afterSHA256']=hashlib.sha256(source.read_bytes()).hexdigest()
  except BaseException as e:r['cleanupErrors'].append({'component':'afterHash','error':repr(e)})
  r['complete']=r['completedIDs']==r['plannedIDs'];r['finishedUTC']=utc();r['exitCode']=int(bool(r['fatal'] or r['cleanupErrors'] or r['pageerrors'] or not r['complete'] or r.get('afterSHA256')!=SHA or any(c['status']=='FAIL' for c in r['checks'])));(out/'result.json').write_text(json.dumps(r,ensure_ascii=False,indent=2));print('CHILD_EXIT',r['exitCode'],flush=True)
 return r['exitCode']
if __name__=='__main__':sys.exit(main())
