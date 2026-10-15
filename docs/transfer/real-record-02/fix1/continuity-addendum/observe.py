"""Six f14 preview continuity observations only; read-only DOM metrics, real clicks/wheel."""
import functools,hashlib,json,sys,threading,traceback
from datetime import datetime,timezone
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from importlib.metadata import version
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).parent;HTML=ROOT.parent/'site/reading-study.html';EXPECTED_HASH='9add34fc341db08e6ef54e6e99d1fbfac6b39e7de61f5d8bd6415b32fa28ed1d'
result={'target_commit':'4971cb51965a7c40b374ddf0210f51c8609ed20e','started_utc':datetime.now(timezone.utc).isoformat(),'expected':6,'executed':0,'complete':False,'cases':[],'server_log':[],'console':[],'pageerrors':[],'fatal':None,'cleanup_errors':[],'playwright':version('playwright'),'executable':'/usr/bin/chromium','scope':'Only six f14 open→preview wheel→A/B switch continuity measurements; no other suite/external requests/new PNG'}
server=None
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,fmt,*args):result['server_log'].append(fmt%args)
def hit(page,selector):
 d=page.locator(selector).evaluate('''e=>{let r=e.getBoundingClientRect(),l=0,t=0,rr=innerWidth,bb=innerHeight,anc=[];for(let p=e.parentElement;p;p=p.parentElement){let c=getComputedStyle(p),q=p.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(c.overflow+c.overflowX+c.overflowY)){l=Math.max(l,q.left);t=Math.max(t,q.top);rr=Math.min(rr,q.right);bb=Math.min(bb,q.bottom);anc.push({id:p.id,overflow:c.overflow})}}let h=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);return {box:{x:r.x,y:r.y,width:r.width,height:r.height},inside:r.width>0&&r.height>0&&r.left>=l-1&&r.right<=rr+1&&r.top>=t-1&&r.bottom<=bb+1,hit:!!h&&(e===h||e.contains(h)),cover:h?(h.id||h.tagName):null,ancestors:anc}}''')
 assert d['inside'] and d['hit'],{'selector':selector,**d};return d
def click(page,selector):
 d=hit(page,selector);page.locator(selector).click();page.wait_for_timeout(150);return {'selector':selector,'before':d}
def metrics(page):
 return page.evaluate('''()=>{let s=document.querySelector('#pvScroll'),sr=s.getBoundingClientRect(),o=document.querySelector('#pvOrigin'),orr=o.getBoundingClientRect();let top=sr.top+s.clientTop,bottom=top+s.clientHeight;
 function rect(r){let relTop=r.top-top,relBottom=r.bottom-top,ct=Math.max(0,relTop),cb=Math.min(s.clientHeight,relBottom);return {top:relTop,bottom:relBottom,height:r.height,visibleClip:{top:ct,bottom:cb,height:Math.max(0,cb-ct)},visible:cb>ct&&r.right>sr.left&&r.left<sr.right}}
 let ev=document.querySelector('#pvScroll .evdl');let evHeading=ev.querySelector('.eh').innerText;let nodes=[ev.querySelector('.eh'),...ev.querySelectorAll('dt,dd')].map((e,i)=>{let walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT),n,lines=[];while(n=walker.nextNode()){let range=document.createRange();range.selectNodeContents(n);for(let r of range.getClientRects())lines.push({textNode:n.textContent,...rect(r)})}return {id:'E09/evdl[0]/'+e.tagName.toLowerCase()+'['+i+']',tag:e.tagName,text:e.innerText,...rect(e.getBoundingClientRect()),lines}});
 return {bodyY:scrollY,rep:document.querySelector('#repA').getAttribute('aria-pressed')==='true'?'A':'B',preview:{top:s.scrollTop,max:s.scrollHeight-s.clientHeight,clientHeight:s.clientHeight,scrollHeight:s.scrollHeight,box:{x:sr.x,y:sr.y,width:sr.width,height:sr.height}},origin:{text:o.innerText,height:orr.height,top:orr.top-top,bottom:orr.bottom-top},eventHeading:evHeading,immutableNodes:nodes,focus:document.activeElement.id,selected:[...document.querySelectorAll('.sel')].map(e=>e.id),expanded:[...document.querySelectorAll('.evbtn[aria-expanded="true"]')].map(e=>e.id),heading:document.querySelector('#pvH').innerText,sourceIDs:[...s.querySelectorAll('li[data-src]')].map(e=>e.dataset.src),documentOverflow:{scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth}}}''')
def compare(before,after):
 assert len(before['immutableNodes'])==len(after['immutableNodes'])
 items=[];visible_before=0
 for a,b in zip(before['immutableNodes'],after['immutableNodes']):
  visible_before+=int(a['visible'])
  same=a['id']==b['id'] and a['text']==b['text'];dtop=b['top']-a['top'];dbottom=b['bottom']-a['bottom']
  clipdelta={k:b['visibleClip'][k]-a['visibleClip'][k] for k in ['top','bottom','height']}
  visible_a=[i for i,l in enumerate(a['lines']) if l['visible']];visible_b=[i for i,l in enumerate(b['lines']) if l['visible']]
  line_ok=len(a['lines'])==len(b['lines']) and all(x['textNode']==y['textNode'] and abs(x['top']-y['top'])<=1.001 and abs(x['bottom']-y['bottom'])<=1.001 for x,y in zip(a['lines'],b['lines']))
  # Offscreen clip coordinates are not reading ranges; compare visible clips only.
  clip_ok=a['visible']==b['visible'] and (not a['visible'] or all(abs(v)<=1.001 for v in clipdelta.values()))
  ok=same and abs(dtop)<=1.001 and abs(dbottom)<=1.001 and clip_ok and visible_a==visible_b and line_ok
  items.append({'id':a['id'],'textSHA256':hashlib.sha256(a['text'].encode()).hexdigest(),'sameText':same,'relativeTopDelta':dtop,'relativeBottomDelta':dbottom,'visibleClipDelta':clipdelta,'visibleLinesBefore':visible_a,'visibleLinesAfter':visible_b,'sameLineTextAndRelativePosition':line_ok,'preserved':ok})
 preserved=visible_before>0 and all(x['preserved'] for x in items)
 return {'status':'PASS' if preserved else 'FAIL','interpretation':'Immutable E09 dt/dd text, line indices, reading-window relative positions and visible clips preserved within 1 CSS px' if preserved else 'Observed immutable E09 reading region differs; see raw text/line/clip metrics','visibleImmutableNodesBefore':visible_before,'toleranceCSSpx':1,'nodes':items,'scrollTopDelta':after['preview']['top']-before['preview']['top'],'maxDelta':after['preview']['max']-before['preview']['max'],'originHeightDelta':after['origin']['height']-before['origin']['height'],'atTopAfter':after['preview']['top']==0,'atMaxAfter':abs(after['preview']['top']-after['preview']['max'])<=1}
try:
 result['hash_before']=hashlib.sha256(HTML.read_bytes()).hexdigest();assert result['hash_before']==EXPECTED_HASH
 server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(HTML.parent)));threading.Thread(target=server.serve_forever,daemon=True).start();result['actualHTTPURL']=f'http://127.0.0.1:{server.server_port}/reading-study.html'
 with sync_playwright() as p:
  br=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True);result['chromium']=br.version
  for width,height in [(1440,900),(390,664),(390,844)]:
   for rep in ['A','B']:
    c={'id':f'{rep}-{width}x{height}','from':rep,'to':'B' if rep=='A' else 'A','viewport':[width,height],'status':'FAIL'};result['cases'].append(c)
    ctx=br.new_context(viewport={'width':width,'height':height});page=ctx.new_page();page.set_default_timeout(6000)
    page.on('pageerror',lambda e:result['pageerrors'].append(str(e)));page.on('console',lambda m:result['console'].append({'type':m.type,'text':m.text}))
    try:
     response=page.goto(result['actualHTTPURL']);c['HTTPStatus']=response.status;assert response.status==200
     c['clicks']=[]
     if rep=='B':c['clicks'].append(click(page,'#repB'))
     selector='#'+('ab-' if rep=='A' else 'bb-')+'f14';y0=page.evaluate('scrollY')
     page.locator(selector).evaluate("e=>window.scrollBy(0,e.getBoundingClientRect().top-document.querySelector('.hdr').getBoundingClientRect().bottom-100)");page.wait_for_timeout(100)
     c['positioning']={'method':'DOM window.scrollBy; not wheel','beforeY':y0,'afterY':page.evaluate('scrollY')};c['clicks'].append(click(page,selector))
     initial=metrics(page);c['beforeWheel']=initial
     r=page.locator('#pvScroll').bounding_box();page.mouse.move(r['x']+r['width']*.55,r['y']+r['height']*.55);page.mouse.wheel(0,240);page.wait_for_timeout(300)
     before=metrics(page);c['beforeSwitch']=before;c['wheel']={'method':'actual mouse.wheel(0,240) within pvScroll','previewDelta':before['preview']['top']-initial['preview']['top'],'bodyDelta':before['bodyY']-initial['bodyY']};assert before['preview']['top']>0 and c['wheel']['previewDelta']>0 and c['wheel']['bodyDelta']==0,c['wheel']
     c['clicks'].append(click(page,'#rep'+c['to']));after=metrics(page);c['afterSwitch']=after
     assert 'E09' in before['eventHeading'] and after['eventHeading']==before['eventHeading'];assert before['sourceIDs']==after['sourceIDs'] and before['selected']==after['selected'];assert '표현 '+c['to'] in after['origin']['text'];assert after['expanded']==[('ab-' if c['to']=='A' else 'bb-')+'f14']
     c['comparison']=compare(before,after);c['status']=c['comparison']['status'];assert after['documentOverflow']['scrollWidth']<=after['documentOverflow']['clientWidth']+1
    except Exception as exc:c['status']='FAIL';c['error']=str(exc);c['traceback']=traceback.format_exc()
    finally:ctx.close()
    print(c['id'],c['status'],json.dumps(c.get('comparison',{}),ensure_ascii=False),flush=True)
  br.close()
except BaseException as exc:result['fatal']={'type':type(exc).__name__,'message':str(exc),'traceback':traceback.format_exc()}
finally:
 if server:
  for op in ['shutdown','server_close']:
   try:getattr(server,op)()
   except BaseException as exc:result['cleanup_errors'].append({'operation':op,'error':str(exc)})
result['hash_after']=hashlib.sha256(HTML.read_bytes()).hexdigest();result['executed']=len(result['cases']);result['complete']=result['executed']==6 and all('comparison' in c for c in result['cases']);result['counts']={k:sum(c['status']==k for c in result['cases']) for k in ['PASS','FAIL']}
result['exit_code']=1 if result['fatal'] or result['cleanup_errors'] or result['pageerrors'] or result['counts']['FAIL'] or not result['complete'] or result['hash_after']!=EXPECTED_HASH else 0
result['finished_utc']=datetime.now(timezone.utc).isoformat();(ROOT/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:result[k] for k in ['counts','expected','executed','complete','fatal','exit_code']}));sys.exit(result['exit_code'])
