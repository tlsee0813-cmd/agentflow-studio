import functools,hashlib,json,threading,traceback,sys,argparse
from pathlib import Path
from datetime import datetime,timezone
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from importlib.metadata import version
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).parent
parser=argparse.ArgumentParser();parser.add_argument('--reuse-external',type=Path);args=parser.parse_args()
OUT=ROOT/'output';OUT.mkdir(exist_ok=True)
TARGET='4971cb51965a7c40b374ddf0210f51c8609ed20e';HASH='9add34fc341db08e6ef54e6e99d1fbfac6b39e7de61f5d8bd6415b32fa28ed1d'
SOURCE='https://raw.githubusercontent.com/tlsee0813-cmd/agentflow-studio/'+TARGET+'/docs/cycles/2026-10-15-real-record-02/reading-fix1/reading-study.html'
S03='https://github.com/tlsee0813-cmd/agentflow-studio/blob/666437a427b3039fb6321dfec41edd6eb24e164f/docs/cycles/2026-10-15-mixed-depth-01/canvas-study.html'
STEPS=['content','initial-closed','button-roundtrip','escape-roundtrip','switch-same-peek','reopen-f14','new-f19','P02-no-source','link-contract','overflow']
CASES=[(rep,w,h) for w,h in [(1440,900),(390,664),(390,844)] for rep in ['A','B']]
plan=[f'{rep}-{w}x{h}/{s}' for rep,w,h in CASES for s in STEPS]+['external/blob-read','external/blob-roundtrip']
(OUT/'PLAN.json').write_text(json.dumps({'expected_local':60,'expected_external':2,'steps':plan,'screenshots_max':4,'failure_policy':'local FAIL, fatal, incomplete local, pageerror or cleanup error => nonzero; external blocked NOT_RUN is coverage limitation'},indent=2)+'\n')
result={'target_commit':TARGET,'source':SOURCE,'expected_sha256':HASH,'started_utc':datetime.now(timezone.utc).isoformat(),'playwright':version('playwright'),'executable':'/usr/bin/chromium','expected_local':60,'expected_external':2,'observations':[],'stages':[],'console':[],'pageerrors':[],'http':[],'fatal':None,'cleanup_errors':[],'known_limitations':['B mobile sheet does not retain comparison counterpart row above it; no side-by-side success or regression failure claimed','No human reading or winner judgment','No full author suite, v0 rerun, mutation or new fatal probe','No new environment restoration validation']}
server=None
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,fmt,*args):result['http'].append(fmt%args)
def boxinfo(loc):
 return loc.evaluate('''e=>{let r=e.getBoundingClientRect(),s=getComputedStyle(e),v={left:0,top:0,right:innerWidth,bottom:innerHeight};let ancestors=[];for(let p=e.parentElement;p;p=p.parentElement){let c=getComputedStyle(p),q=p.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(c.overflow+c.overflowX+c.overflowY)){ancestors.push({id:p.id,overflow:c.overflow,rect:{x:q.x,y:q.y,width:q.width,height:q.height}});v.left=Math.max(v.left,q.left);v.top=Math.max(v.top,q.top);v.right=Math.min(v.right,q.right);v.bottom=Math.min(v.bottom,q.bottom)}}let x=(r.left+r.right)/2,y=(r.top+r.bottom)/2,h=document.elementFromPoint(x,y);return {hidden:e.hidden,display:s.display,visibility:s.visibility,rect:{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right},hasBox:r.width>0&&r.height>0,fullyInClip:r.left>=v.left-1&&r.top>=v.top-1&&r.right<=v.right+1&&r.bottom<=v.bottom+1,centerHit:!!h&&(e===h||e.contains(h)),cover:h?{id:h.id,tag:h.tagName,cls:h.className}:null,ancestors,clip:v,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth}}''')
def observe(name,data):result['observations'].append({'case':label,'stage':name,'data':data})
def overflow():
 d=page.evaluate('({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,innerWidth})');assert d['scrollWidth']<=d['clientWidth']+1,d;return d
def click(selector):
 loc=page.locator(selector);d=boxinfo(loc);assert d['hasBox'] and d['fullyInClip'] and d['centerHit'],{'selector':selector,**d}
 before=page.evaluate('scrollY');loc.click();page.wait_for_timeout(100)
 observe('actual-click',{'selector':selector,'geometryBefore':d,'bodyYBefore':before,'bodyYAfter':page.evaluate('scrollY'),'overflowAfter':overflow()})
def place(selector):
 before=page.evaluate('({y:scrollY,max:document.documentElement.scrollHeight-innerHeight})')
 page.locator(selector).evaluate('''e=>{let r=e.getBoundingClientRect(),h=document.querySelector('.hdr').getBoundingClientRect().bottom;window.scrollBy(0,r.top-(h+Math.min(100,(innerHeight-h)*.22)))}''')
 page.wait_for_timeout(80)
 after=page.evaluate('({y:scrollY,max:document.documentElement.scrollHeight-innerHeight})');observe('DOM-window.scrollBy-positioning',{'selector':selector,'before':before,'after':after,'geometry':boxinfo(page.locator(selector))})
def btn(rep,f='f14'):return '#'+('ab-' if rep=='A' else 'bb-')+f
def unit(rep,f='f14'):return '#'+('a-' if rep=='A' else 'b-')+f
def snap(rep,f='f14'):
 d=page.evaluate('''sel=>{let b=document.querySelector(sel),r=b.getBoundingClientRect(),sc=document.querySelector('#pvScroll'),q=document.querySelector('#pvOrigin blockquote'),p=q?q.getBoundingClientRect():null,s=sc.getBoundingClientRect();return {url:location.href,rep:document.querySelector('#repA').getAttribute('aria-pressed')==='true'?'A':'B',y:scrollY,maxY:Math.max(0,document.documentElement.scrollHeight-innerHeight),button:{top:r.top,bottom:r.bottom,height:r.height,expanded:b.getAttribute('aria-expanded')},focus:document.activeElement.id,selected:[...document.querySelectorAll('.sel')].map(n=>n.id),expanded:[...document.querySelectorAll('.evbtn[aria-expanded="true"]')].map(n=>n.id),previewTop:sc.scrollTop,previewMax:sc.scrollHeight-sc.clientHeight,heading:document.querySelector('#pvH').innerText,origin:document.querySelector('#pvOrigin')?.innerText||'',quote:q?.innerText||'',sources:[...sc.querySelectorAll('li[data-src]')].map(n=>n.dataset.src),originQuoteVisible:!!p&&p.top>=s.top-1&&p.top<s.bottom,bodyPad:document.body.style.paddingBottom}}''',btn(rep,f))
 d['panel']={id:boxinfo(page.locator('#'+id)) for id in ['pvBody','pvClose','pvEmpty','preview']};return d
def closed(rep,f='f14'):
 s=snap(rep,f);b=s['panel']['pvBody'];c=s['panel']['pvClose'];assert b['hidden'] and b['display']=='none' and not b['hasBox'] and not c['hasBox'] and not c['centerHit'],s
 if width==1440:assert s['panel']['pvEmpty']['hasBox'] and s['panel']['preview']['hasBox'],s
 else:assert s['panel']['preview']['display']=='none' and not s['panel']['preview']['hasBox'],s
 return s
def opening(rep,f='f14'):
 place(btn(rep,f));assert page.evaluate('scrollY')>0;click(btn(rep,f));s=snap(rep,f)
 assert s['focus']=='pvH' and s['button']['expanded']=='true' and not s['panel']['pvBody']['hidden'],s
 assert s['panel']['pvClose']['centerHit'] and s['panel']['pvClose']['fullyInClip'],s
 assert s['origin'].startswith('출발') and '표현 '+rep in s['origin'],s
 assert ('E10' if f=='f19' else 'E09') in s['heading'],s
 assert s['previewTop']==0 and s['originQuoteVisible'],s
 assert ('a-' if rep=='A' else 'b-')+f in s['selected'],s
 return s
def wheel_preview():
 sc=page.locator('#pvScroll');r=sc.bounding_box();before=page.evaluate('({body:scrollY,preview:document.querySelector("#pvScroll").scrollTop})')
 page.mouse.move(r['x']+r['width']*.55,r['y']+r['height']*.55);page.mouse.wheel(0,240);page.wait_for_timeout(250)
 after=page.evaluate('({body:scrollY,preview:document.querySelector("#pvScroll").scrollTop})');d={'method':'actual mouse.wheel(0,240) inside pvScroll','before':before,'after':after,'previewDelta':after['preview']-before['preview'],'bodyDelta':after['body']-before['body']};observe('actual-preview-wheel',d)
 assert after['preview']>before['preview'],d;assert after['body']==before['body'],d;return d
def run(name,fn):
 id=label+'/'+name
 try:
  data=fn();result['stages'].append({'id':id,'status':'PASS','detail':data})
 except Exception as exc:
  result['stages'].append({'id':id,'status':'FAIL','error':str(exc),'traceback':traceback.format_exc()});print('FAIL',id,str(exc),flush=True)
  # Normal keyboard close prevents an earlier local failure contaminating following independent paths.
  page.keyboard.press('Escape');page.wait_for_timeout(80)
  if len(list(OUT.glob('*.png')))<4:page.screenshot(path=str(OUT/('FAIL-'+label.replace('/','-')+'-'+name+'.png')))
def ensure_rep(rep):
 if page.locator('#rep'+rep).get_attribute('aria-pressed')!='true':click('#rep'+rep)
def initial():return closed(rep)
def content():
 a=page.locator('#viewA .unit').evaluate_all('(es)=>es.map(e=>e.dataset.fact)');b=page.locator('#viewB tr[data-fact]').evaluate_all('(es)=>es.map(e=>e.dataset.fact)');assert len(a)==len(b)==25 and a==b
 wanted={'f14':['위치 C','A2 소유 미결','없','새 요구 아님'],'f15':['H1','위치 L1','A2 소유 미결','없'],'f16':['H1','위치 L2','변경·미결 참조','없'],'f17':['위치 B','소유 A2','직접 A2','없','미결 내용 자체'],'f18':['H1','C/L1/L2/B','5사례','함께 성립'],'f19':['13','3 통과·10 실패','90','72 통과·18 실패','실제 DOM·브라우저','합산하지 않'],'f20':['동결 시점','완료·재검사 결과','없','후속 수정본']}
 readings={}
 for f,tokens in wanted.items():
  loc=page.locator(unit(rep,f));text=loc.inner_text();assert all(t in text for t in tokens),(f,text,tokens)
  # Read actual rendered sentence / individual table cells, position each for visual exposure.
  parts=[loc] if rep=='A' else loc.locator(':scope > th,:scope > td').all()
  readings[f]={'text':text,'parts':[]}
  for part in parts:
   part.evaluate("e=>window.scrollBy(0,e.getBoundingClientRect().top-document.querySelector('.hdr').getBoundingClientRect().bottom-12)");page.wait_for_timeout(25)
   g=boxinfo(part);assert g['hasBox'] and g['rect']['bottom']>g['clip']['top'] and g['rect']['y']<g['clip']['bottom'],g
   readings[f]['parts'].append({'text':part.inner_text(),'geometry':g,'bodyY':page.evaluate('scrollY'),'method':'DOM window.scrollBy for rendered sentence/cell scan'})
 return {'factIDsA':a,'factIDsB':b,'renderedReadings':readings,'overflow':overflow()}
def roundtrip(mode):
 ensure_rep(rep);page.keyboard.press('Escape');place(btn(rep));before=snap(rep);opened=opening(rep);wheel=wheel_preview()
 if mode=='button':click('#pvClose')
 else:page.keyboard.press('Escape');page.wait_for_timeout(100)
 after=closed(rep);assert after['focus']==btn(rep)[1:] and after['button']['expanded']=='false' and ('a-' if rep=='A' else 'b-')+'f14' in after['selected'],after
 dy=after['y']-before['y'];dt=after['button']['top']-before['button']['top'];clamp=after['y']<=0 or abs(after['y']-after['maxY'])<=1
 assert (abs(dy)<=1 and abs(dt)<=1) or clamp,{'before':before,'after':after,'dy':dy,'buttonTopDelta':dt,'clamp':clamp}
 if rep=='A' and width==1440 and mode=='button' and len(list(OUT.glob('*.png')))<4:page.screenshot(path=str(OUT/'1440-A-closed.png'))
 if rep=='B' and width==1440 and mode=='button':
  opening(rep)
  if len(list(OUT.glob('*.png')))<4:page.screenshot(path=str(OUT/'1440-B-E09-open.png'))
  click('#pvClose')
 return {'before':before,'opened':opened,'wheel':wheel,'after':after,'scrollYDelta':dy,'buttonTopDelta':dt,'clamped':clamp,'toleranceCSSpx':1}
def switching():
 ensure_rep(rep);page.keyboard.press('Escape');opened=opening(rep);wheel_preview();before=snap(rep);other='B' if rep=='A' else 'A';click('#rep'+other);after=snap(other)
 assert after['heading']==before['heading'] and after['sources']==before['sources'] and '표현 '+other in after['origin'],after
 assert after['previewTop']>0 and after['button']['expanded']=='true' and ('a-' if other=='A' else 'b-')+'f14' in after['selected'],after
 g=boxinfo(page.locator(btn(other)));assert g['fullyInClip'] and g['centerHit'],g
 click('#pvClose');end=closed(other);assert end['focus']==btn(other)[1:],end
 ensure_rep(rep)
 return {'before':before,'afterSwitch':after,'closedCurrentExpression':end,'absoluteBodyYEqualityRequired':False,'exactPreviewPixelEqualityRequired':False,'previewTopDelta':after['previewTop']-before['previewTop'],'originButtonGeometryAfterSwitch':g}
def reopen():
 ensure_rep(rep);page.keyboard.press('Escape');s=opening(rep)
 if rep=='B' and width==390 and height==844 and len(list(OUT.glob('*.png')))<4:page.screenshot(path=str(OUT/'390x844-B-E09-open-known-limitation.png'))
 return s
def newpeek():
 # Reopen f14 first if previous stage failed, then wheel inside it before selecting new fact.
 if page.locator('#pvBody').get_attribute('hidden') is not None:opening(rep)
 wheel_preview();old=snap(rep);click('#pvClose');new=opening(rep,'f19');assert new['quote']!=old['quote'] and 'E10' in new['heading'] and new['previewTop']==0 and new['originQuoteVisible'],new
 click('#pvClose')
 if rep=='A' and width==390 and height==664:
  s=opening(rep,'f15');assert 'H1' in s['quote'] and '위치 L1' in s['quote'],s
  if len(list(OUT.glob('*.png')))<4:page.screenshot(path=str(OUT/'390x664-A-f15-open.png'))
  click('#pvClose')
 return {'previousF14':old,'newF19':new}
def p02():
 page.keyboard.press('Escape');opening(rep);li=page.locator('#pvScroll li[data-src="P02"]');before=page.locator('#pvScroll').evaluate('e=>e.scrollTop');li.locator('.nolink').scroll_into_view_if_needed();page.wait_for_timeout(80)
 text=li.inner_text();assert li.locator('a').count()==0 and '공개 고정 링크가 없' in text and '원문 링크 미제공' in text,text
 d=boxinfo(li.locator('.nolink'));assert d['hasBox'] and d['fullyInClip'],d
 return {'text':text,'geometry':d,'positioningMethod':'Playwright scroll_into_view_if_needed (DOM scrolling, not wheel)','previewBefore':before,'previewAfter':page.locator('#pvScroll').evaluate('e=>e.scrollTop')}
def link_contract():
 link=page.locator('#pvScroll li[data-src="S03"] a.srclink');link.scroll_into_view_if_needed();page.wait_for_timeout(100)
 d=link.evaluate('e=>({href:e.href,target:e.target,rel:e.rel,text:e.innerText,aria:e.getAttribute("aria-label")})');assert d['href']==S03 and d['target']=='_blank' and 'noopener' in d['rel'] and 'noreferrer' in d['rel'] and '새 탭' in d['text'] and '새 탭' in d['aria'],d
 d['geometry']=boxinfo(link);assert d['geometry']['centerHit'] and d['geometry']['fullyInClip'],d
 d['positioningMethod']='Playwright DOM scroll_into_view_if_needed';return d
try:
 result['hash_before']=hashlib.sha256((ROOT/'site/reading-study.html').read_bytes()).hexdigest();assert result['hash_before']==HASH
 server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'site')));threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/reading-study.html';result['actualHTTPURL']=url
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True);result['chromium']=browser.version
  for rep,width,height in CASES:
   label=f'{rep}-{width}x{height}';ctx=browser.new_context(viewport={'width':width,'height':height});page=ctx.new_page();page.set_default_timeout(6000)
   page.on('pageerror',lambda e:result['pageerrors'].append(str(e)));page.on('console',lambda m:result['console'].append({'type':m.type,'text':m.text}))
   response=page.goto(url);assert response.status==200;ensure_rep(rep)
   # Initial rendering must precede content positioning.
   run('initial-closed',initial);run('content',content)
   run('button-roundtrip',lambda:roundtrip('button'));run('escape-roundtrip',lambda:roundtrip('escape'));run('switch-same-peek',switching);run('reopen-f14',reopen);run('new-f19',newpeek);run('P02-no-source',p02);run('link-contract',link_contract);run('overflow',overflow)
   (OUT/(label+'.json')).write_text(json.dumps({'case':label,'stages':[s for s in result['stages'] if s['id'].startswith(label+'/')],'observations':[o for o in result['observations'] if o['case']==label]},ensure_ascii=False,indent=2)+'\n');ctx.close()
  if args.reuse_external:
   earlier=json.loads(args.reuse_external.read_text());assert earlier['target_commit']==TARGET and earlier['hash_before']==HASH
   external_stages=[s for s in earlier['stages'] if s['id'].startswith('external/')];assert len(external_stages)==2 and all(s['status']=='NOT_RUN' for s in external_stages)
   result['stages'].extend(external_stages);result['externalEvidenceReusedFrom']={'file':str(args.reuse_external),'sha256':hashlib.sha256(args.reuse_external.read_bytes()).hexdigest(),'reason':'One actual popup attempt already established blocked source; not repeating same access diagnosis','originalHTTPURL':earlier['actualHTTPURL']}
   browser.close()
  else:
   # One real popup attempt; no stubbing/interception, raw GET or repeated access diagnosis.
   rep='A';width=1440;height=900;label='external';ctx=browser.new_context(viewport={'width':width,'height':height});page=ctx.new_page();page.set_default_timeout(12000);page.goto(url);opening(rep);link_contract();before=snap(rep)
   popup=None;external={'requestedURL':S03,'before':before,'responses':[],'requestFailures':[]}
   ctx.on('response',lambda r:external['responses'].append({'url':r.url,'status':r.status}) if 'github.com' in r.url else None)
   ctx.on('requestfailed',lambda r:external['requestFailures'].append({'url':r.url,'failure':r.failure}))
   try:
    with page.expect_popup(timeout=15000) as pop:click('#pvScroll li[data-src="S03"] a.srclink')
    popup=pop.value
    try:popup.wait_for_load_state('domcontentloaded',timeout=25000)
    except Exception as exc:external['loadError']=str(exc)
    external['finalURL']=popup.url;external['title']=popup.title();external['bodyTextSample']=popup.locator('body').inner_text(timeout=5000)[:2500]
    readable=popup.url==S03 and any(x['status']==200 and x['url'].split('?')[0]==S03 for x in external['responses']) and popup.locator('[data-testid="code-cell"],.react-code-text,.blob-code').count()>0
    if not readable:
     external['reason']='Actual GitHub blob source rendering not established; see actual responses/body/errors. No policy/auth changes attempted.'
     result['stages'] += [{'id':'external/blob-read','status':'NOT_RUN','detail':external},{'id':'external/blob-roundtrip','status':'NOT_RUN','reason':'Original reading not established; closing blocked tab is recorded but not credited as source roundtrip'}]
    else:
     result['stages'].append({'id':'external/blob-read','status':'PASS','detail':external})
    popup.close();popup=None;page.bring_to_front();after=snap(rep);external['afterTabClose']=after
    if readable:
     ok=all(after[k]==before[k] for k in ['url','rep','selected','quote','heading','sources']) and abs(after['y']-before['y'])<=1 and abs(after['previewTop']-before['previewTop'])<=1
     result['stages'].append({'id':'external/blob-roundtrip','status':'PASS' if ok else 'FAIL','detail':{'before':before,'after':after}})
   except Exception as exc:
    external['error']=str(exc)
    result['stages'] += [{'id':'external/blob-read','status':'NOT_RUN','detail':external},{'id':'external/blob-roundtrip','status':'NOT_RUN','reason':'Actual popup/source blocked or unavailable'}]
   finally:
    if popup:popup.close()
   (OUT/'external.json').write_text(json.dumps(external,ensure_ascii=False,indent=2)+'\n');ctx.close();browser.close()
except BaseException as exc:result['fatal']={'type':type(exc).__name__,'message':str(exc),'traceback':traceback.format_exc()};print('FATAL',result['fatal'],flush=True)
finally:
 if server:
  for op in ['shutdown','server_close']:
   try:getattr(server,op)()
   except BaseException as exc:result['cleanup_errors'].append({'operation':op,'error':str(exc)})
result['hash_after']=hashlib.sha256((ROOT/'site/reading-study.html').read_bytes()).hexdigest()
local=[s for s in result['stages'] if not s['id'].startswith('external/')];ids=[s['id'] for s in result['stages']]
result['executed_local']=len(local);result['complete_local']=len(local)==60 and all(id in ids for id in plan if not id.startswith('external/'))
result['complete']=len(ids)==len(plan) and set(ids)==set(plan)
result['counts']={s:sum(c['status']==s for c in result['stages']) for s in ['PASS','FAIL','NOT_RUN']}
result['exit_code']=1 if result['fatal'] or result['cleanup_errors'] or result['pageerrors'] or result['counts']['FAIL'] or not result['complete'] or not result['complete_local'] or result['hash_after']!=HASH else 0
result['finished_utc']=datetime.now(timezone.utc).isoformat();(OUT/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:result[k] for k in ['counts','executed_local','complete_local','complete','fatal','exit_code']},ensure_ascii=False),flush=True);sys.exit(result['exit_code'])
