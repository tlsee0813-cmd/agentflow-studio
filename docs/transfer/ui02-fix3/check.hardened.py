import functools,threading,json,hashlib,traceback,sys,time
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from importlib.metadata import version
import argparse
ROOT=Path(__file__).parent
parser=argparse.ArgumentParser()
parser.add_argument('--probe-fatal', action='store_true', help='Isolated negative test: raise configuration exception before server/browser/checks')
args=parser.parse_args()
OUT=ROOT/'evidence-hardening'/('probe' if args.probe_fatal else 'normal')
OUT.mkdir(parents=True,exist_ok=True)
EXPECTED_CHECKS=86
requests=[]; checks=[]; errors=[]; consoles=[]
server=None; server_started=False; url=None; sha=None; fatal=None; cleanup_errors=[]
phase='configuration'
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,fmt,*args): requests.append(fmt%args)
def run(name,fn):
 try:
  detail=fn(); checks.append(dict(name=name,status='passed',detail=detail))
 except Exception as e:
  checks.append(dict(name=name,status='failed',error=str(e))); print('FAIL',name,str(e),flush=True)
def key(k): return page.locator('[data-key="'+k+'"]')
def visible(loc):
 loc.scroll_into_view_if_needed(); page.wait_for_timeout(60)
 return loc.evaluate('''e=>{const r=e.getBoundingClientRect();let l=0,t=0,rr=innerWidth,b=innerHeight;for(let p=e.parentElement;p;p=p.parentElement){let s=getComputedStyle(p),q=p.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(s.overflow+s.overflowX+s.overflowY)){l=Math.max(l,q.left);t=Math.max(t,q.top);rr=Math.min(rr,q.right);b=Math.min(b,q.bottom)}}let x=(Math.max(l,r.left)+Math.min(rr,r.right))/2,y=(Math.max(t,r.top)+Math.min(b,r.bottom))/2;let hit=document.elementFromPoint(x,y);return {rect:{x:r.x,y:r.y,width:r.width,height:r.height},clip:{l,t,r:rr,b},full:r.left>=l-1&&r.top>=t-1&&r.right<=rr+1&&r.bottom<=b+1,hit:!!hit&&(e.contains(hit)||hit===e),text:e.innerText,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth}}''')
def shown(loc):
 d=visible(loc)
 if not d['hit']:
  loc.evaluate("e=>e.scrollIntoView({block:'end'})"); d=visible(loc); d['repositionedBelowStickyHeader']=True
 assert d['full'] and d['hit'],d; assert d['scrollWidth']<=d['clientWidth']+1,d; return d
def click(k):
 d=shown(key(k)); key(k).click(); return d
def sel(s): assert page.locator('#app').get_attribute('data-sel')==s

def snap(): return page.locator('#app').get_attribute('data-overview')
def back(): click('ins-back')
def detail():
 if width==390: click('pane-detail')
def outline(): click('pane-outline')
def badges(k):
 loc=key(k); d=shown(loc)
 for token in ['결정 변경 1','미결 1','소유 A2']: assert token in loc.inner_text(),d
 for badge in ['.chg','.open']: shown(loc.locator(badge))
 return d

def a2return(k):
 before=snap(); d=click(k); detail(); sel('A2'); shown(page.locator('#insp .ins-t')); back(); assert snap()==before,(before,snap()); return d

def count_rel(): assert page.locator('path[data-state="confirmed"]').count()==3

def no_propagation(id):
 if width==390: outline(); click('ol-'+id)
 else:
  if page.locator('#app').get_attribute('data-expanded')=='false': click('cv-toggleA')
  click('node-'+id)
 sel(id); assert page.locator('#insp .chip.open').count()==0; assert page.locator('#insp .ins-tags .chg').count()==0
 return shown(page.locator('#insp .ins-t'))

try:
 if args.probe_fatal:
  raise RuntimeError('Intentional pre-check configuration exception (--probe-fatal)')
 sha=hashlib.sha256((ROOT/'site/canvas-study.html').read_bytes()).hexdigest()
 if sha!='0aeedd515e7f80f4b091ba1b395f90e0d19355a9eb3ca6c7e1174ad48fa2898c':
  raise ValueError('Target HTML byte hash mismatch')
 from playwright.sync_api import sync_playwright,expect
 server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'site')))
 threading.Thread(target=server.serve_forever,daemon=True).start(); server_started=True
 url=f'http://127.0.0.1:{server.server_port}/canvas-study.html'
 phase='browser-checks'
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
  browser_version=browser.version
  for width,height in [(1440,900),(390,664),(390,844)]:
   for scene in [1,2,3]:
    context=browser.new_context(viewport={'width':width,'height':height}); page=context.new_page(); page.set_default_timeout(3500)
    label=f'{width}x{height}/S{scene}'
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda m: consoles.append({'type':m.type,'text':m.text}))
    response=page.goto(url); assert response.status==200; click('scene-'+str(scene))
    def overflow():
     d=page.evaluate('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})'); assert d['scrollWidth']<=d['width'],d; return d
    run(label+'/document-no-horizontal-overflow',overflow)
    if scene==1:
     def s1():
      assert page.locator('.chip.open').count()==0
      assert page.locator('[data-testid="open-ref"],[data-testid="b-open-ref"]').count()==0
      if width==390: click('ol-A2')
      else: click('node-A2')
      assert '실패 알림 정책' not in page.locator('#insp').inner_text()
      return shown(page.locator('#insp .ins-t'))
     run(label+'/no-future-unresolved',s1); context.close(); continue
    run(label+'/three-current-relations',count_rel)
    if width==390: click('pane-canvas')
    def collapsed():
     click('cv-toggleA'); return a2return('cv-open')
    run(label+'/C-collapsed-A-open-direct-A2-return',collapsed)
    def l1():
     if width==390: click('pane-canvas')
     click('cv-list'); d=badges('cl-A2')
     if width==1440 and scene==2: page.screenshot(path=str(OUT/'1440-L1.png'))
     a2return('cl-A2'); return d
    run(label+'/L1-collapsed-endpoint-A2-badges-jump-return',l1)
    def bselect():
     if width==390: outline(); click('ol-B')
     else: click('node-B')
     sel('B')
    run(label+'/select-B',bselect)
    run(label+'/L2-B-endpoint-A2-badges-jump-return',lambda:(badges('ins-ep-A2'),a2return('ins-ep-A2')))
    def bopen():
     d=shown(key('ins-bopen')); assert '소유 A2' in d['text'];
     if scene==2:
      page.screenshot(path=str(OUT/('1440-B-open.png' if width==1440 else f'390x{height}-B-open.png')))
     a2return('ins-bopen'); sel('B'); return d
    run(label+'/B-unresolved-direct-A2-B-return',bopen)
    for id in ['A4','A6']: run(label+'/'+id+'-no-unresolved-propagation',lambda id=id:no_propagation(id))
    def chain():
     no_propagation('A4'); original=snap(); click('ins-peer-A2'); sel('A2'); click('ins-toB'); sel('B'); back(); sel('A2'); back(); sel('A4'); assert snap()==original
    run(label+'/A4-A2-B-back-A2-back-A4',chain)
    if width==390:
     def l3():
      outline(); d=badges('ol-rel-A2');
      if height==664 and scene==2: page.screenshot(path=str(OUT/'390x664-L3-A2.png'))
      before=page.locator('#outline').evaluate('e=>e.scrollTop'); a2return('ol-rel-A2'); outline(); after=page.locator('#outline').evaluate('e=>e.scrollTop'); assert abs(before-after)<=1,(before,after)
      a6=shown(key('ol-rel-A6'))
      if height==844 and scene==2: page.screenshot(path=str(OUT/'390x844-L3-A6.png'))
      click('ol-rel-A6'); sel('A6'); back(); outline()
      return {'A2':d,'A6':a6,'scrollBefore':before,'scrollAfter':after}
     run(label+'/L3-relation-A2-and-A6-visible-click-return-scroll',l3)
     def scroll120():
      outline(); state=page.locator('#outline').evaluate('e=>{e.scrollTop=120;return {requested:120,actual:e.scrollTop,max:e.scrollHeight-e.clientHeight}}')
      click('pane-detail'); outline(); actual=page.locator('#outline').evaluate('e=>e.scrollTop'); assert actual==state['actual'],(state,actual)
      state['restored']=actual; return state
     run(label+'/outline-scroll120-or-actual-max-preserved',scroll120)
    run(label+'/final-three-current-relations',count_rel); run(label+'/final-document-no-horizontal-overflow',overflow)
    context.close()
  browser.close()
except BaseException as exc:
 fatal={'type':type(exc).__name__,'message':str(exc),'phase':phase,'traceback':traceback.format_exc()}
 print('FATAL '+json.dumps(fatal,ensure_ascii=False),file=sys.stderr,flush=True)
finally:
 # Cleanup records its own failures without returning/exiting or replacing the primary failure.
 if server is not None:
  for operation in (['shutdown'] if server_started else [])+['server_close']:
   try: getattr(server,operation)()
   except BaseException as exc:
    cleanup_errors.append({'operation':operation,'type':type(exc).__name__,'message':str(exc)})
failed=sum(c['status']=='failed' for c in checks)
complete=len(checks)==EXPECTED_CHECKS
exit_code=1 if fatal or cleanup_errors or failed or errors or not complete else 0
result={'commit':'3847a9b267d43dcc16bd1b999af446ad5cc38c91','sha256':sha,'actualHTTPURL':url,'playwright':version('playwright'),'chromium':locals().get('browser_version'),'executable':'/usr/bin/chromium','viewports':[[1440,900],[390,664],[390,844]],'checks':checks,'counts':{'passed':len(checks)-failed,'failed':failed},'pageerrors':errors,'console':consoles,'http_requests':requests,'unrun':['new Cloud task environment restoration','bundled Chromium','whole product build','real AI'],'environmentPublication':'UI directly observed by auxiliary operator; not reverified here','transport':'real Chromium navigation over HTTP; no fetch/DOM substitutes'}
result.update({'fatal':fatal,'cleanup_errors':cleanup_errors,'expected_checks':EXPECTED_CHECKS,'executed_checks':len(checks),'complete':complete,'exit_code':exit_code,'probe_fatal':args.probe_fatal,'limitations':['C decision display has no separate assertion','A4/A6 non-propagation assertions cover inspector detail only','DOM scrollIntoView and scrollTop used; wheel/touch not tested']})
(OUT/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps({'counts':result['counts'],'expected':EXPECTED_CHECKS,'executed':len(checks),'fatal':fatal,'exit_code':exit_code},ensure_ascii=False),flush=True)
sys.exit(exit_code)
