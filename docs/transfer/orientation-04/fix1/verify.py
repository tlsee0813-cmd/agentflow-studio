"""Narrow independent cycle04 fix1 scenes. Not author checker or human scoring."""
import json,hashlib,threading,functools,traceback,sys,argparse,math
from pathlib import Path
from datetime import datetime,timezone
from importlib.metadata import version
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright
from measurement import JS
ROOT=Path(__file__).parent;parser=argparse.ArgumentParser();parser.add_argument('--probe',action='store_true');args=parser.parse_args();OUT=ROOT/('probe' if args.probe else 'output');OUT.mkdir(exist_ok=True)
HASH='889317d56b5164495509821dfa7c8bbc498629507877b6d68fe9730edf36f08a';TARGET='fb87a21aed0ada58c637c7be7e878e6b459d70f6'
PLAN=[f'S1-{v}-{w}' for v in ['a','b'] for w in [390,1280,1440]]+['S2-a-390','S4-a-390','PREP-a-390','S5-a-390','S2-b-390','S4-b-390','S5-b-390','S3-a-1280','S5-a-1280','S3-b-1280','S5-b-1280']
R={'target_commit':TARGET,'source':'https://raw.githubusercontent.com/tlsee0813-cmd/agentflow-studio/'+TARGET+'/docs/cycles/2026-10-16-orientation-04/author-fix1/orientation-study.html','measurement_definition_commit':'165c15205a2f89d591ab431df47be5b9592676ff','started_utc':datetime.now(timezone.utc).isoformat(),'playwright':version('playwright'),'browser_path':'/usr/bin/chromium','probe':args.probe,'expected':PLAN,'stages':[],'initial':[],'actions':[],'pageerrors':[],'console':[],'server':[],'fatal':None,'cleanup_errors':[],'unrun':['cycle03 16-stage rerun','baseline rerun','author checker execution','actual finger swipe','human comprehension','external original roundtrip','real AI/sending']}
server=None;page=None;width=0;height=0;label='';baseline={};active='setup'
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,fmt,*a):R['server'].append(fmt%a)
def note(kind,data):R['actions'].append({'case':label,'kind':kind,'data':data})
exec((ROOT/'helpers.py').read_text(),globals())

def obs_state():
 d=overview();d['reference']=page.evaluate('''()=>({pointed:[...document.querySelectorAll('.is-pointed')].map(e=>(e.classList.contains('part')?'p:':'a:')+e.dataset.id),barHidden:document.querySelector('#refbar').hidden,text:document.querySelector('#refText').innerText,strip:document.querySelector('#stripWhat').innerText,focusRef:document.activeElement.dataset.ref||null,leadTop:document.querySelector('#lead').scrollTop})''');return d

def compact_measure(selector):
 d=page.evaluate(JS,selector);groups={}
 for c in d.pop('glyphs'):
  rect=c.get('rect');key=(rect['y'],rect['height']) if rect else ('no-box',0)
  group=groups.setdefault(key,{'y':key[0],'height':key[1],'glyphs':[]})
  group['glyphs'].append({'char':c['text'],'x':rect['x'] if rect else None,'width':rect['width'] if rect else None,'status':c['status'],'hitSamples':[{'unobscured':p['unobscured'],**({'cover':p['cover']} if not p['unobscured'] else {})} for p in c.get('probes',[])]})
 d['rangeLines']=list(groups.values());return d

def run(id,fn):
 global active
 active=id
 try:
  data=fn();R['stages'].append({'id':id,'status':'PASS','detail':data});print('PASS',id,flush=True);return data
 except Exception as exc:
  R['stages'].append({'id':id,'status':'FAIL','error':str(exc),'traceback':traceback.format_exc(),'state':obs_state() if page else None});print('FAIL',id,str(exc),flush=True)
  if page and len(list(OUT.glob('*.png')))<8:page.screenshot(path=str(OUT/(id+'-FAIL.png')))
  return None

def initial(v):
 response=page.goto(URL+'?v='+v);page.evaluate('document.fonts.ready');page.wait_for_timeout(180);got=hashlib.sha256(response.body()).hexdigest();assert response.status==200 and got==HASH,{'status':response.status,'hash':got}
 before=obs_state();assert before['selected']==[] and before['windowY']==0 and before['mapScroll']['left']==before['mapScroll']['top']==0
 targets=[('purpose','.top .aim'),('change','#briefTitle'),('keep','.core'),('report-basis','.basis'),('basis-detail-label','.about summary'),('scope','.framenote')]+[('action-'+id,'.part[data-id="'+id+'"] .nm') for id in ['purpose','instruction','decision']]+[('area-'+id,'.area[data-id="'+id+'"] .area-head .nm') for id in ['home','task','next','restore']]
 if v=='a':targets += [('chip-'+p+'-'+a,'.part[data-id="'+p+'"] .chip[data-area="'+a+'"]') for p in ['purpose','instruction','decision'] for a in ['home','task','next','restore']]
 else:
  for i in range(1,5):
   for j in range(1,page.locator(f'#explainBody p:nth-child({i}) .ref').count()+1):targets.append((f'prose-ref-{i}-{j}',f'#explainBody p:nth-child({i}) button.ref:nth-of-type({j})'))
 measures=[{'key':k,**compact_measure(s)} for k,s in targets];sentences=[]
 if v=='b':
  for p in page.locator('#explainBody p').all():sentences.append({'text':p.inner_text(),'geometry':geo(p)})
 filename=f'{v}-{width}x{height}-initial.png';page.screenshot(path=str(OUT/filename));after=obs_state();assert before==after
 d={'variant':v,'viewport':[width,height],'HTTPStatus':response.status,'firstResponseBodySHA256':got,'actualURL':response.url,'before':before,'after':after,'measurements':measures,'proseMetadataNotCharacterVisibility':sentences,'PNG':filename};R['initial'].append(d)
 return {'initialObservationIndex':len(R['initial'])-1,'descriptiveExposureNotUnderstanding':True}

def mobile_access(v):
 start=len(R['actions']);data={'initial':obs_state()}
 if v=='a':click('.part[data-id="purpose"]')
 else:
  origin='#explainBody p[data-part="purpose"] .ref[data-ref="p:purpose"]';ensure(origin);before=obs_state();originGeo=geo(page.locator(origin));click(origin,False);target=obs_state();assert target['selected']==['purpose'] and target['reference']['pointed']==['p:purpose'],target
  assert page.locator('.part[data-id="purpose"]').count()==1;data['partReference']={'before':before,'afterAutoMovement':target,'originGeometry':originGeo,'targetGeometry':geo(page.locator('.part[data-id="purpose"]'))};assert geo(page.locator('.part[data-id="purpose"] .nm'))['full']
  click('#refBack');back=obs_state();assert back['reference']['focusRef']=='p:purpose' and abs(back['windowY']-before['windowY'])<=1 and back['reference']['barHidden'],back;data['partReference']['backImmediate']=back
  click('.part[data-id="instruction"]');areaRef='#explainBody p[data-part="purpose"] .ref[data-ref="a:restore"]';ensure(areaRef);pre=obs_state();click(areaRef,False);mixed=obs_state();assert pre['selected']==mixed['selected']==['instruction'];assert mixed['reference']['pointed']==['a:restore'] and '미지정' in mixed['reference']['text'] and '작업 지시' in mixed['reference']['text'],mixed
  data['mixedSelectionAndPointing']={'before':pre,'afterAutoMovement':mixed,'targetGeometry':geo(page.locator('.area[data-id="restore"] .area-head'))};click('#refBack');back=obs_state();assert back['selected']==['instruction'] and back['reference']['focusRef']=='a:restore';data['mixedSelectionAndPointing']['backImmediate']=back;click('.part[data-id="purpose"]')
 related=[]
 for a in ['home','task','next','restore']:
  ensure('.area[data-id="'+a+'"] .area-head');g=geo(page.locator('.area[data-id="'+a+'"] .area-head .nm'));assert g['full'] and g['hit'],g
  related.append({'area':a,'actualName':page.locator('.area[data-id="'+a+'"] .area-head .nm').inner_text(),'geometry':g,'state':obs_state()})
 data['fourActualAreas']=related
 # Preserve distinct user depths before the map-return baseline is saved.
 click('.area[data-id="home"] .more');click('.area[data-id="next"] .area-head');click('.part[data-id="purpose"]');ensure('#enterFocus');baseline['preEntry']=obs_state();assert baseline['preEntry']['windowY']>0
 click('#enterFocus',False);assert page.locator('#focusTitle').is_visible();data['preEntry']=baseline['preEntry'];data['actionCounts']={'click':sum(a['kind']=='actual-click' for a in R['actions'][start:]),'wheel':sum(a['kind']=='actual-wheel' for a in R['actions'][start:])};return data

def read_snap():
 return {'scroll':scrollstate(),'sentence':geo(page.locator('#c-p4')),'button':geo(page.locator('.evbtn[data-claim="p4"]')),'peekCount':page.locator('.peek').count(),'linksInsidePeek':page.locator('.peek a').count()}

def mobile_read():
 selector='.evbtn[data-claim="p4"]';wheel(0,120);ensure(selector);before=read_snap()
 if before['scroll']['windowY']<=0 and before['scroll']['reading']<=0:raise RuntimeError('UNOBSERVED: actual noninitial reading position not achieved; no DOM scroll/fake space')
 rounds=[]
 for mode in ['button','Escape']:
  pre=read_snap();click(selector,False);opened={'scroll':scrollstate(),'peek':geo(page.locator('#peek-p4')),'text':page.locator('#peek-p4').inner_text(),'pane':page.locator('#peek-p4 .peek-body').evaluate('e=>({top:e.scrollTop,clientHeight:e.clientHeight,scrollHeight:e.scrollHeight,overflow:getComputedStyle(e).overflow})')};assert page.locator('.peek').count()==1 and 'FIX058' in opened['text'];ensure('#peek-p4 .peek-close')
  if mode=='button':click('#peek-p4 .peek-close',False)
  else:page.keyboard.press('Escape');page.wait_for_timeout(220);note('actual-keyboard',{'key':'Escape'})
  after=read_snap() # First measurement after closing; no wheel assistance.
  assert after['peekCount']==after['linksInsidePeek']==0 and page.locator('.peek-close').count()==0;assert after['scroll']['focus']=='p4' and page.locator(selector).get_attribute('aria-expanded')=='false';assert after['button']['full'] and after['button']['hit']
  for k in ['windowY','reading']:assert abs(pre['scroll'][k]-after['scroll'][k])<=1,(pre,after)
  for k in ['x','y','width','height']:assert abs(pre['sentence']['box'][k]-after['sentence']['box'][k])<=1,(pre,after)
  rounds.append({'method':mode,'before':pre,'opened':opened,'closedImmediate':after,'noPostCloseWheel':True})
 return {'noninitialBefore':before,'rounds':rounds}

def prep_once():
 opened=prep_open();closed=prep_close(opened);return {'opened':opened,'closedImmediate':closed,'noSend':True}

def desktop_layout():
 click('.area[data-id="home"] .more');click('.area[data-id="next"] .area-head');click('.part[data-id="purpose"]');click('#zoomIn');wheel(30,70,(1000,500));d=obs_state();assert set(x['depth'] for x in d['depths'].values())=={'0','1','2'};assert abs(d['canvasScale']['x']-1.2)<=.001
 toggles=[]
 for selector in ['.help summary','.about summary']:
  for opened in [True,False]:
   click(selector,container=(250,350) if selector=='.about summary' and variant=='b' else None);assert page.locator(selector).evaluate('e=>e.parentElement.open')==opened
   line=edges();after=obs_state();assert after['selected']==['purpose'] and after['depths']==d['depths'];toggles.append({'selector':selector,'open':opened,'state':after,'actualLineEndpoints':line,'noReselection':True})
 ensure('#enterFocus');baseline['preEntry']=obs_state();click('#enterFocus',False);return {'depthChange':d,'toggles':toggles,'preEntry':baseline['preEntry']}

def return_once():
 click('#returnAll');after=obs_state() # No post-return wheel/DOM positioning.
 delta=restore_compare(baseline['preEntry'],after);assert set(delta)=={'purpose','instruction','decision','home','task','next','restore'};return {'before':baseline['preEntry'],'afterImmediate':after,'sevenActualRectDeltas':delta,'edgeEndpoints':edges(),'noPostReturnPositioning':True}

try:
 R['fileHashBefore']=hashlib.sha256((ROOT/'site/orientation-study.html').read_bytes()).hexdigest()
 expected='0'*64 if args.probe else HASH
 if R['fileHashBefore']!=expected:raise ValueError('SYNTHETIC expected-hash mismatch probe (not a UI defect)' if args.probe else 'Target file hash mismatch')
 server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'site')));threading.Thread(target=server.serve_forever,daemon=True).start();URL=f'http://127.0.0.1:{server.server_port}/orientation-study.html';R['actualHTTPURL']=URL
 with sync_playwright() as p:
  br=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True);R['chromium']=br.version;contexts={}
  for variant in ['a','b']:
   for width,height in [(390,844),(1280,720),(1440,900)]:
    label=f'{variant}-{width}';ctx=br.new_context(viewport={'width':width,'height':height});page=ctx.new_page();page.set_default_timeout(6000);page.on('pageerror',lambda e:R['pageerrors'].append(str(e)));page.on('console',lambda m:R['console'].append({'type':m.type,'text':m.text}));contexts[(variant,width)]=(ctx,page);run('S1-'+label,lambda v=variant:initial(v))
  for variant in ['a','b']:
   width=390;height=844;label=f'{variant}-390';ctx,page=contexts[(variant,width)];baseline={}
   access=run('S2-'+label,lambda v=variant:mobile_access(v))
   if access:
    run('S4-'+label,mobile_read)
    if variant=='a':run('PREP-a-390',prep_once)
    run('S5-'+label,return_once)
  for variant in ['a','b']:
   width=1280;height=720;label=f'{variant}-1280';ctx,page=contexts[(variant,width)];baseline={}
   if run('S3-'+label,desktop_layout):run('S5-'+label,return_once)
  for ctx,_ in contexts.values():ctx.close()
  br.close()
except BaseException as exc:R['fatal']={'at':active,'type':type(exc).__name__,'message':str(exc),'traceback':traceback.format_exc()};print('FATAL',R['fatal'],flush=True)
finally:
 if server:
  for op in ['shutdown','server_close']:
   try:getattr(server,op)()
   except BaseException as exc:R['cleanup_errors'].append({'operation':op,'error':str(exc)})
R['fileHashAfter']=hashlib.sha256((ROOT/'site/orientation-study.html').read_bytes()).hexdigest();ids=[s['id'] for s in R['stages']];R['executed']=len(ids);R['complete']=len(ids)==len(PLAN) and set(ids)==set(PLAN);R['counts']={status:sum(s['status']==status for s in R['stages']) for status in ['PASS','FAIL']};R['exit_code']=1 if R['fatal'] or R['pageerrors'] or R['cleanup_errors'] or R['counts']['FAIL'] or not R['complete'] or R['fileHashAfter']!=HASH else 0;R['finished_utc']=datetime.now(timezone.utc).isoformat();(OUT/'result.json').write_text(json.dumps(R,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:R[k] for k in ['counts','executed','complete','fatal','exit_code']},ensure_ascii=False));sys.exit(R['exit_code'])
