import json,hashlib,threading,functools,traceback,sys
from pathlib import Path
from datetime import datetime,timezone
from importlib.metadata import version
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).parent;OUT=ROOT/'output';OUT.mkdir(exist_ok=True)
SHA='af748df1dfacb7ed6b4ae3709d5ced26ef43f96bc45a9e6c2c05cdc02e9cc77e';COMMIT='34b4124098fe6242b34e16e23532ceb3e0fe91ad'
R={'target_commit':COMMIT,'source':'https://raw.githubusercontent.com/tlsee0813-cmd/agentflow-studio/'+COMMIT+'/docs/cycles/2026-10-16-return-flow-03/author-fix1/return-flow-study.html','input_contract_commit':COMMIT,'started_utc':datetime.now(timezone.utc).isoformat(),'expected_steps':16,'cases':[],'actions':[],'server':[],'console':[],'pageerrors':[],'fatal':None,'cleanup_errors':[],'playwright':version('playwright'),'browser_path':'/usr/bin/chromium','unrun':['author flow_check.py (reference only)','previous reading-study tests','actual touch swipe','human comprehension','external original roundtrip','real sending'],'plan':['1 map summary, distinct depths and user change, zoom/help','2 purpose select and pre-entry baseline','3 actual evidence p3 open','4 button close, same evidence reopen, Escape','5 handoff prep and actual wheel to lower conditions/unknowns','6 prep close and reading/focus restore','7 map return with immediate geometry comparison','8 repeat small flow once']}
server=None;page=None;label=None
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,fmt,*args):R['server'].append(fmt%args)
def note(kind,data):R['actions'].append({'case':label,'kind':kind,'data':data})
def geo(loc):
 return loc.evaluate('''e=>{let r=e.getBoundingClientRect(),l=0,t=0,rr=innerWidth,bb=innerHeight;let ancestors=[];for(let p=e.parentElement;p;p=p.parentElement){let c=getComputedStyle(p),q=p.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(c.overflow+c.overflowX+c.overflowY)){l=Math.max(l,q.left);t=Math.max(t,q.top);rr=Math.min(rr,q.right);bb=Math.min(bb,q.bottom);ancestors.push({id:p.id,overflow:c.overflow})}}let h=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);return {box:{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right},full:r.width>0&&r.height>0&&r.left>=l-1&&r.right<=rr+1&&r.top>=t-1&&r.bottom<=bb+1,hit:!!h&&(h===e||e.contains(h)),cover:h?(h.id||h.className||h.tagName):null,ancestors,clip:{l,t,r:rr,b:bb}}}''')
def overview():
 return page.evaluate('''()=>{let m=document.querySelector('#mapScroll'),c=document.querySelector('#canvas');let rect=e=>{let r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};return {selected:[...document.querySelectorAll('.part.is-selected')].map(e=>e.dataset.id),depths:Object.fromEntries([...document.querySelectorAll('.area')].map(e=>[e.dataset.id,{depth:e.dataset.depth,expanded:e.querySelector('.area-head').getAttribute('aria-expanded'),bodyHidden:e.querySelector('.area-body').hidden}])),mapScroll:{left:m.scrollLeft,top:m.scrollTop,maxX:m.scrollWidth-m.clientWidth,maxY:m.scrollHeight-m.clientHeight},windowY:scrollY,zoomLabel:document.querySelector('#zoomVal').innerText,appliedTransform:getComputedStyle(c).transform,canvasScale:{x:c.getBoundingClientRect().width/c.offsetWidth,y:c.getBoundingClientRect().height/c.offsetHeight},nodes:Object.fromEntries([...document.querySelectorAll('.part,.area-head')].map(e=>[(e.dataset.id||e.closest('.area').dataset.id),{rect:rect(e),layoutWidth:e.offsetWidth,layoutHeight:e.offsetHeight}])),helpOpen:document.querySelector('.help').open,related:[...document.querySelectorAll('.area.is-related')].map(e=>e.dataset.id),active:document.activeElement.dataset.id||document.activeElement.id||document.activeElement.className,mapHidden:document.querySelector('#mapView').hidden,focusHidden:document.querySelector('#focusView').hidden,peekCount:document.querySelectorAll('.peek').length,prepOpen:document.querySelector('#prep').open,devicePixelRatio,overflow:{sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}}}''')
def scrollstate():return page.evaluate('''()=>({windowY:scrollY,reading:document.querySelector('#reading').scrollTop,prep:document.querySelector('#prepBody').scrollTop,focus:document.activeElement.id||document.activeElement.dataset.claim||document.activeElement.className})''')
def wheel(dx,dy,over=None):
 x,y=over or ((width*.7,height*.55) if width>900 else (width*.5,height*.65));before=scrollstate();page.mouse.move(x,y);page.mouse.wheel(dx,dy);page.wait_for_timeout(180);note('actual-wheel',{'dx':dx,'dy':dy,'pointer':[x,y],'before':before,'after':scrollstate()})
def ensure(selector,container=None):
 loc=page.locator(selector)
 for _ in range(45):
  d=geo(loc)
  if d['full'] and d['hit']:return d
  r=d['box'];clip=d['clip'];dy=min(300,max(70,r['bottom']-clip['b']+25)) if r['bottom']>clip['b'] else -min(300,max(70,clip['t']-r['y']+25))
  if d['full'] and not d['hit']:
   # Fixed top rail or bottom selection strip can occlude an otherwise in-viewport target.
   dy=-100 if r['y']<height*.4 else 130
  dx=180 if r['right']>clip['r'] else (-180 if r['x']<clip['l'] else 0)
  over=container
  if over is None and width>900:
   if page.locator('#mapView').is_visible():over=(1000,500)
   else:over=(900,500)
  wheel(dx,dy,over)
 raise AssertionError({'unreachable':selector,'geometry':geo(loc)})
def click(selector,assist=True,container=None):
 d=ensure(selector,container) if assist else geo(page.locator(selector));assert d['full'] and d['hit'],{'selector':selector,**d}
 before=scrollstate();page.mouse.click(d['box']['x']+d['box']['width']/2,d['box']['y']+d['box']['height']/2);page.wait_for_timeout(220);note('actual-click',{'selector':selector,'geometryBefore':d,'before':before,'after':scrollstate()})
def edges():
 d=page.evaluate('''()=>{let c=document.querySelector('#canvas'),cr=c.getBoundingClientRect(),svg=document.querySelector('#edges'),n=document.querySelector('.part.is-selected'),nr=n.getBoundingClientRect();let paths=[...svg.querySelectorAll('path')].filter(p=>!p.getAttribute('stroke-dasharray'));let areas=[...document.querySelectorAll('.area.is-related')].map(e=>{let r=e.querySelector('.area-head').getBoundingClientRect();return {id:e.dataset.id,x:r.left,y:(r.top+r.bottom)/2}});return {display:getComputedStyle(svg).display,paths:paths.map(p=>{let m=p.getScreenCTM(),a=p.getPointAtLength(0),b=p.getPointAtLength(p.getTotalLength());let s=new DOMPoint(a.x,a.y).matrixTransform(m),t=new DOMPoint(b.x,b.y).matrixTransform(m);return {start:{x:s.x,y:s.y},end:{x:t.x,y:t.y},d:p.getAttribute('d')}}),origin:{x:nr.right,y:(nr.top+nr.bottom)/2},targets:areas}}''')
 if width>900:
  assert len(d['paths'])==len(d['targets'])==4,d
  for p,a in zip(d['paths'],d['targets']):assert abs(p['start']['x']-d['origin']['x'])<=1 and abs(p['start']['y']-d['origin']['y'])<=1 and abs(p['end']['x']-a['x'])<=1 and abs(p['end']['y']-a['y'])<=1,d
 else:assert d['display']=='none' and len(d['targets'])==4,d
 return d
def restore_compare(before,after):
 assert before['selected']==after['selected']==['purpose'];assert before['depths']==after['depths'];assert before['related']==after['related'];assert before['helpOpen']==after['helpOpen']
 for k in ['left','top']:assert abs(before['mapScroll'][k]-after['mapScroll'][k])<=1,(before,after)
 assert abs(before['windowY']-after['windowY'])<=1 and before['appliedTransform']==after['appliedTransform'] and before['canvasScale']==after['canvasScale'],(before,after)
 diffs={}
 for id,n in before['nodes'].items():
  diffs[id]={k:after['nodes'][id]['rect'][k]-n['rect'][k] for k in ['x','y','width','height']};assert all(abs(x)<=1 for x in diffs[id].values()),diffs
 assert after['active']=='purpose' and not after['mapHidden'] and after['focusHidden'] and after['peekCount']==0 and not after['prepOpen'],after
 return diffs
def peek_open():
 selector='.evbtn[data-claim="p3"]';ensure(selector);before={'scroll':scrollstate(),'button':geo(page.locator(selector))};click(selector,False)
 assert page.locator('#peek-p3').count()==1 and page.locator(selector).get_attribute('aria-expanded')=='true'
 text=page.locator('#peek-p3').inner_text();assert all(x in text for x in ['문서 보고','원문 전체가 아닙니다','이 설명이 읽은 방식','이 기록으로 알 수 없는 것','MOCK']),text
 panel=page.locator('#peek-p3').evaluate('e=>({scrollTop:e.scrollTop,clientHeight:e.clientHeight,scrollHeight:e.scrollHeight,overflow:getComputedStyle(e).overflow})');body=page.locator('#peek-p3 .peek-body').evaluate('e=>({clientHeight:e.clientHeight,scrollHeight:e.scrollHeight,overflow:getComputedStyle(e).overflow})')
 closegeo=ensure('#peek-p3 .peek-close');return {'before':before,'text':text,'panel':panel,'body':body,'closeGeometry':closegeo,'noInternalScrollablePane':body['scrollHeight']<=body['clientHeight']+1}
def peek_close(opened,mode):
 if mode=='button':click('#peek-p3 .peek-close',False)
 else:
  # Reopen leaves focus on origin button with its Escape handler; keyboard is real.
  page.keyboard.press('Escape');page.wait_for_timeout(200);note('actual-keyboard',{'key':'Escape'})
 after=scrollstate();g=geo(page.locator('.evbtn[data-claim="p3"]'));assert page.locator('#peek-p3').count()==0 and page.locator('.peek-close').count()==0 and page.locator('.peek a').count()==0
 assert after['focus']=='p3' and page.locator('.evbtn[data-claim="p3"]').get_attribute('aria-expanded')=='false',after
 assert abs(after['windowY']-opened['before']['scroll']['windowY'])<=1 and abs(after['reading']-opened['before']['scroll']['reading'])<=1,(opened['before'],after)
 assert g['full'] and g['hit'],g
 page.keyboard.press('Tab');tab=scrollstate();assert tab['focus'] not in ['peek-close'] and page.locator('.peek').count()==0;page.keyboard.press('Shift+Tab');page.wait_for_timeout(50)
 return {'afterImmediate':after,'originGeometry':g,'tabAfterClosed':tab,'removedPanelAndLinks':True}
def prep_open():
 ensure('#prepBtn');before=scrollstate();g=geo(page.locator('#prepBtn'));click('#prepBtn',False);assert page.locator('#prep').evaluate('e=>e.open')
 text=page.locator('#prep').inner_text();assert all(t in text for t in ['準備' if False else '준비 제안','보내지 않습니다','현재 요청 원문','후속 보완','받을 담당자: 기록에 없음']),text
 readings=[]
 selectors=['#prepBody dd:nth-of-type(5) li:nth-child('+str(i)+')' for i in [1,2,3]]+['#prepBody dd:nth-of-type(6) li:nth-child('+str(i)+')' for i in [1,2,3,4]]+['#prepBody .nosend']
 r=page.locator('#prepBody').bounding_box();over=(r['x']+r['width']*.6,min(height-50,r['y']+r['height']*.6))
 for sel in selectors:
  geom=ensure(sel,over);readings.append({'selector':sel,'text':page.locator(sel).inner_text(),'geometry':geom,'scroll':scrollstate()})
 return {'before':before,'originGeometry':g,'text':text,'lowerReadings':readings,'bodyMetrics':page.locator('#prepBody').evaluate('e=>({top:e.scrollTop,max:e.scrollHeight-e.clientHeight,clientHeight:e.clientHeight,scrollHeight:e.scrollHeight})'),'closeGeometry':geo(page.locator('#prepClose'))}
def prep_close(opened):
 click('#prepClose',False);after=scrollstate();d=geo(page.locator('#prep'));origin=geo(page.locator('#prepBtn'))
 assert not page.locator('#prep').evaluate('e=>e.open') and d['box']['width']==0 and d['box']['height']==0 and not d['hit'];assert after['focus']=='prepBtn' and origin['full'] and origin['hit'],(after,origin)
 assert after['windowY']==opened['before']['windowY'] and after['reading']==opened['before']['reading'],(opened,after)
 return {'afterImmediate':after,'dialogGeometry':d,'originGeometry':origin}
def enter():
 click('.part[data-id="purpose"]');ensure('#enterFocus');before=overview();baseline['preEntry']=before;baseline['edgeGeometry']=edges();click('#enterFocus',False)
 assert page.locator('#focusTitle').inner_text().startswith('목적 정정') and page.locator('#mapView').is_hidden();return before
def return_map():
 click('#returnAll');after=overview() # No wheel/DOM positioning between return and this snapshot.
 diffs=restore_compare(baseline['preEntry'],after);return {'afterImmediate':after,'nodeCoordinateDeltas':diffs,'edgeGeometry':edges(),'measurementBeforeAnyPostReturnScroll':True}
try:
 R['fileHashBefore']=hashlib.sha256((ROOT/'site/return-flow-study.html').read_bytes()).hexdigest();assert R['fileHashBefore']==SHA
 server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'site')));threading.Thread(target=server.serve_forever,daemon=True).start();R['actualHTTPURL']=f'http://127.0.0.1:{server.server_port}/return-flow-study.html'
 with sync_playwright() as p:
  br=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True);R['chromium']=br.version
  for width,height in [(1440,900),(390,844)]:
   label=f'{width}x{height}';case={'viewport':[width,height],'steps':[]};R['cases'].append(case);ctx=br.new_context(viewport={'width':width,'height':height});page=ctx.new_page();page.set_default_timeout(6000);baseline={};stage=1
   page.on('pageerror',lambda e:R['pageerrors'].append(str(e)));page.on('console',lambda m:R['console'].append({'case':label,'type':m.type,'text':m.text}))
   try:
    response=page.goto(R['actualHTTPURL']);case['httpStatus']=response.status;case['httpResponseSHA256']=hashlib.sha256(response.body()).hexdigest();assert response.status==200 and case['httpResponseSHA256']==SHA
    case['initialMap']=overview();assert geo(page.locator('.top .aim'))['full'] and geo(page.locator('#briefTitle'))['full'];case['defaultGoal']={'text':page.locator('.top .aim').inner_text(),'geometry':geo(page.locator('.top .aim'))}
    click('.part[data-id="instruction"]');case['beforeUserDepthChange']=overview();click('.area[data-id="home"] .more');case['afterUserDepthChange']=overview();assert case['beforeUserDepthChange']['depths']['home']!=case['afterUserDepthChange']['depths']['home'];assert len(set(x['depth'] for x in case['afterUserDepthChange']['depths'].values()))>=2
    if width>900:click('#zoomIn');wheel(40,100,(1000,500));assert overview()['canvasScale']['x']!=1
    click('.help summary');case['helpGeometry']=geo(page.locator('.help p'));case['helpText']=page.locator('.help p').inner_text()
    assert '실행 순서' in case['helpText'];case['steps'].append({'stage':1,'status':'PASS','mapAfterSetup':overview()})
    stage=2;before=enter();case['steps'].append({'stage':2,'status':'PASS','preEntry':before,'edges':baseline['edgeGeometry']})
    if width>900 and len(list(OUT.glob('*.png')))<3:
     # First representative is captured when actually back on map below; no view manipulation for screenshots.
     pass
    stage=3;opened=peek_open();case['steps'].append({'stage':3,'status':'PASS','opened':opened})
    stage=4;closed1=peek_close(opened,'button');opened2=peek_open();closed2=peek_close(opened2,'escape');case['steps'].append({'stage':4,'status':'PASS','buttonClosed':closed1,'reopened':opened2,'escapeClosed':closed2})
    stage=5;prep=prep_open();case['steps'].append({'stage':5,'status':'PASS','prep':prep})
    if width==390 and len(list(OUT.glob('*.png')))<3:page.screenshot(path=str(OUT/'390-prep-lower-conditions.png'))
    stage=6;case['steps'].append({'stage':6,'status':'PASS','closed':prep_close(prep)})
    stage=7;case['steps'].append({'stage':7,'status':'PASS','returned':return_map()})
    if len(list(OUT.glob('*.png')))<3:page.screenshot(path=str(OUT/(label+'-returned-map.png')))
    stage=8;secondBefore=enter();secondPeek=peek_open();secondClosed=peek_close(secondPeek,'button');secondPrep=prep_open();secondPrepClosed=prep_close(secondPrep);secondReturn=return_map();case['steps'].append({'stage':8,'status':'PASS','preEntry':secondBefore,'peek':secondPeek,'peekClosed':secondClosed,'prep':secondPrep,'prepClosed':secondPrepClosed,'returned':secondReturn})
   except Exception as exc:
    case['steps'].append({'stage':stage,'status':'FAIL','error':str(exc),'traceback':traceback.format_exc(),'scroll':scrollstate()});print('FAIL',label,stage,str(exc),flush=True)
    if len(list(OUT.glob('*.png')))<3:page.screenshot(path=str(OUT/(label+'-FAIL-stage'+str(stage)+'.png')))
   finally:ctx.close()
  br.close()
except BaseException as exc:R['fatal']={'type':type(exc).__name__,'message':str(exc),'traceback':traceback.format_exc()}
finally:
 if server:
  for op in ['shutdown','server_close']:
   try:getattr(server,op)()
   except BaseException as exc:R['cleanup_errors'].append({'operation':op,'error':str(exc)})
R['fileHashAfter']=hashlib.sha256((ROOT/'site/return-flow-study.html').read_bytes()).hexdigest();steps=[s for c in R['cases'] for s in c['steps']];R['executed_steps']=len(steps);R['complete']=len(steps)==16 and all(set(s['stage'] for s in c['steps'])==set(range(1,9)) for c in R['cases']);R['counts']={s:sum(x['status']==s for x in steps) for s in ['PASS','FAIL']};R['exit_code']=1 if R['fatal'] or R['pageerrors'] or R['cleanup_errors'] or not R['complete'] or R['counts']['FAIL'] or R['fileHashAfter']!=SHA else 0;R['finished_utc']=datetime.now(timezone.utc).isoformat();(OUT/'result.json').write_text(json.dumps(R,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:R[k] for k in ['counts','expected_steps','executed_steps','complete','fatal','exit_code']}));sys.exit(R['exit_code'])
