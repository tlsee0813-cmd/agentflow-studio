import json,hashlib,threading,functools,traceback,sys,argparse,collections
from pathlib import Path
from datetime import datetime,timezone
from importlib.metadata import version
import playwright
from playwright.sync_api import sync_playwright
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
ROOT=Path(__file__).parent;ap=argparse.ArgumentParser();ap.add_argument('--out',default='run-01');ap.add_argument('--probe',action='store_true');ap.add_argument('--only-wide',action='store_true');args=ap.parse_args();OUT=ROOT/args.out;OUT.mkdir(exist_ok=True)
HASH='5e937f9e9cab6143f7eee68aac90d9ae0d457513d82ec0ebd450daff797831d6';TARGET='10d1f03f6944a2787079cdb49cf009c6b1fbd302'
ENDS={'R1':('G1','C21'),'R2':('C21','C31'),'R3':('C21','C32'),'R4':('C32','G5'),'R5':('G5','C42'),'R6':('C21','C41')};PARENTS={'C21':'G2','C22':'G2','C31':'G3','C32':'G3','C41':'G4','C42':'G4'}
NAMES={'G1':'구상과 목적','G2':'요청 맥락','G3':'전달할 내용','G4':'결과 연결','G5':'저장·복구','C21':'새 요청의 배경 고정','C31':'AI 입력','C32':'작업문과 미리보기','C41':'일반 보고 연결','C42':'파일 반환 연결'}
KINDS={'R1':'명시 새 요청 때만 사본 고정','R2':'요청 사본','R3':'요청 사본','R4':'내보내기 기록의 사본','R5':'일치하는 반환 식별자','R6':'정확히 연결된 대상 작업의 사본'}
PLAN=[f'{w}/S{i}' for w in [1440,390] for i in range(1,7)]+['390/G3-nested','390/G1-prep']
if args.only_wide:PLAN=[i for i in PLAN if i.startswith('1440/')]
R={'source':'https://raw.githubusercontent.com/tlsee0813-cmd/agentflow-studio/'+TARGET+'/docs/transfer/composition-05/author-v0/composition-study.html','target_commit':TARGET,'started_utc':datetime.now(timezone.utc).isoformat(),'environment':{'python':sys.executable,'playwright':version('playwright'),'playwright_module':str(playwright.__file__),'browser_executable':'/usr/bin/chromium'},'probe':args.probe,'expected':PLAN,'stages':[],'actions':[],'HTTP':[],'server':[],'console':[],'pageerrors':[],'fatal':None,'cleanup_errors':[],'unrun':['official Folding access retry','previous cycles','author checker','human usability/comprehension','actual AI compliance','touch/pinch','external original roundtrip','actual transmission/acceptance']}
server=None;page=None;width=0;label='';active='setup';edits={};base=None
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,fmt,*a):R['server'].append(fmt%a)
def note(kind,data):R['actions'].append({'case':label,'kind':kind,'data':data})
def geom(selector):
 return page.locator(selector).evaluate('''e=>{let r=e.getBoundingClientRect(),l=0,t=0,rr=innerWidth,b=innerHeight,anc=[];for(let p=e.parentElement;p;p=p.parentElement){let s=getComputedStyle(p),q=p.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(s.overflow+s.overflowX+s.overflowY)){l=Math.max(l,q.left);t=Math.max(t,q.top);rr=Math.min(rr,q.right);b=Math.min(b,q.bottom)}if(/auto|scroll/.test(s.overflow+s.overflowX+s.overflowY))anc.push({id:p.id,rect:{x:q.x,y:q.y,right:q.right,bottom:q.bottom},left:p.scrollLeft,top:p.scrollTop,maxX:p.scrollWidth-p.clientWidth,maxY:p.scrollHeight-p.clientHeight})}let h=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);return {box:{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom},hasBox:r.width>0&&r.height>0,full:r.width>0&&r.height>0&&r.left>=l-1&&r.right<=rr+1&&r.top>=t-1&&r.bottom<=b+1,clip:{l,t,r:rr,b},hit:!!h&&(h===e||e.contains(h)),cover:h?{id:h.id,tag:h.tagName,class:h.className}:null,scrollAncestors:anc,display:getComputedStyle(e).display}}''')
def positions():return page.evaluate('''()=>({map:[mapScroll.scrollLeft,mapScroll.scrollTop],main:main.scrollTop,focus:focusView.scrollTop,prep:prepScroll.scrollTop,active:{id:document.activeElement.id,sel:document.activeElement.dataset.sel||null,key:document.activeElement.dataset.key||null}})''')
def wheel(dx,dy,over):
 before=positions();page.mouse.move(*over);page.mouse.wheel(dx,dy);page.wait_for_timeout(160);note('actual-wheel',{'dx':dx,'dy':dy,'point':over,'before':before,'after':positions()})
def ensure(selector):
 for _ in range(40):
  g=geom(selector)
  if g['full'] and g['hit']:return g
  box=g['box'];clip=g['clip'];dx=160 if box['right']>clip['r'] else (-160 if box['x']<clip['l'] else 0);dy=min(260,max(65,box['bottom']-clip['b']+20)) if box['bottom']>clip['b'] else -min(260,max(65,clip['t']-box['y']+20))
  if g['full'] and not g['hit']:dy=-100 if box['y']<500 else 100
  candidates=[a for a in g['scrollAncestors'] if (a['maxX']>1 if dx else a['maxY']>1)]
  if not candidates:raise AssertionError({'cannotExpose':selector,'geometry':g})
  a=candidates[0];r=a['rect'];x=min(389 if width==390 else 1439,r['right']-8);y=min(843 if width==390 else 899,r['bottom']-25);y=max(r['y']+30,y)
  wheel(dx,dy,(x,y))
 raise AssertionError({'unreachable':selector,'geometry':geom(selector)})
def click(selector,assist=True):
 g=ensure(selector) if assist else geom(selector);assert g['full'] and g['hit'],{'selector':selector,'geometry':g};before=positions();page.mouse.click(g['box']['x']+g['box']['width']/2,g['box']['y']+g['box']['height']/2);page.wait_for_timeout(200);note('actual-click',{'selector':selector,'geometryBefore':g,'before':before,'after':positions()})
def snapshot():
 s=page.evaluate('''()=>{let ids=['G1','G2','G3','G4','G5'];let w=world.getBoundingClientRect();return {pressed:[...document.querySelectorAll('[data-sel][aria-pressed="true"]')].map(e=>e.dataset.sel),depth:Object.fromEntries(['G2','G3','G4'].map(g=>[g,document.querySelector('#n-'+g).dataset.depth])),map:{left:mapScroll.scrollLeft,top:mapScroll.scrollTop,maxX:mapScroll.scrollWidth-mapScroll.clientWidth,maxY:mapScroll.scrollHeight-mapScroll.clientHeight},main:main.scrollTop,focusTop:focusView.scrollTop,transform:getComputedStyle(world).transform,scale:{x:w.width/world.offsetWidth,y:w.height/world.offsetHeight},active:{id:document.activeElement.id,sel:document.activeElement.dataset.sel||null,key:document.activeElement.dataset.key||null},focusing:app.classList.contains('focusing'),prepHidden:prep.hidden,peekCount:document.querySelectorAll('.peek').length}}''')
 s['stable']={i:geom('#n-'+i+' .ghead') if i.startswith('G') else geom('#n-'+i) for i in ['G1','G2','G3','G4','G5','C32']};return s
def compare(before,after,sel):
 assert set(before['stable'])==set(after['stable'])=={'G1','G2','G3','G4','G5','C32'}
 assert before['pressed']==after['pressed']==[sel] and before['depth']==after['depth'] and before['transform']==after['transform'] and before['scale']==after['scale'];assert before['map']['left']==after['map']['left'] and before['map']['top']==after['map']['top'] and before['main']==after['main'];assert not after['focusing'] and after['prepHidden'] and after['peekCount']==0;assert after['active']['sel']==sel or after['active']['id']=='n-'+sel
 delta={}
 for i,a in before['stable'].items():
  b=after['stable'][i];delta[i]={k:b['box'][k]-a['box'][k] for k in ['x','y','width','height']};assert all(abs(v)<=1 for v in delta[i].values()),delta
  assert a['hasBox']==b['hasBox'] and a['full']==b['full'],(i,a,b)
 return delta
def relations():
 raw=page.evaluate('''()=>[...document.querySelectorAll('#edges g[data-k]')].map(g=>{let p=g.querySelector('.vis'),m=p.getScreenCTM(),a=p.getPointAtLength(0),b=p.getPointAtLength(p.getTotalLength());a=new DOMPoint(a.x,a.y).matrixTransform(m);b=new DOMPoint(b.x,b.y).matrixTransform(m);function r(id){let q=document.querySelector('#n-'+id).getBoundingClientRect();return {x:q.x,y:q.y,right:q.right,bottom:q.bottom,width:q.width,height:q.height}}return {ids:g.dataset.rels.split(' '),from:g.dataset.from,to:g.dataset.to,title:g.querySelector('title').textContent,start:{x:a.x,y:a.y},end:{x:b.x,y:b.y},fromRect:r(g.dataset.from),toRect:r(g.dataset.to),rings:g.querySelectorAll('.ring').length}})''')
 ids=[rid for g in raw for rid in g['ids']];counts=collections.Counter(ids);assert len(ids)==6 and set(ids)==set(ENDS) and all(v==1 for v in counts.values()),{'rawIDs':ids,'counts':dict(counts)}
 depth=snapshot()['depth'];checks=[]
 for g in raw:
  for rid in g['ids']:
   a,b=ENDS[rid];aRep=PARENTS[a] if a in PARENTS and depth[PARENTS[a]]=='0' else a;bRep=PARENTS[b] if b in PARENTS and depth[PARENTS[b]]=='0' else b
   assert (g['from'],g['to'])==(aRep,bRep),(rid,g);assert f'{rid} {NAMES[a]} → {NAMES[b]} · {KINDS[rid]}' in g['title'],g
   checks.append({'id':rid,'originalFrom':a,'originalTo':b,'kind':KINDS[rid],'drawnRepresentatives':[aRep,bRep]})
  for p,r in [(g['start'],g['fromRect']),(g['end'],g['toRect'])]:assert abs(p['y']-(r['y']+r['bottom'])/2)<=1 and min(abs(p['x']-r['x']),abs(p['x']-r['right']))<=1,g
 return {'rawGroups':raw,'rawFlattenedIDs':ids,'IDCountsBeforeAnyDictionary':dict(counts),'contractChecks':checks,'depth':depth}
def bundle_click():
 for _ in range(12):
  point=page.evaluate('''()=>{let g=[...document.querySelectorAll('#edges g[data-k]')].find(g=>g.dataset.rels==='R2 R3');if(!g)return null;let p=g.querySelector('.vis'),m=p.getScreenCTM(),clip=mapScroll.getBoundingClientRect();for(let i=1;i<20;i++){let a=p.getPointAtLength(p.getTotalLength()*i/20),q=new DOMPoint(a.x,a.y).matrixTransform(m);if(q.x<clip.left||q.x>clip.right||q.y<clip.top||q.y>clip.bottom||q.y<0||q.y>innerHeight)continue;let h=document.elementFromPoint(q.x,q.y);if(h&&h.closest('g')===g)return {x:q.x,y:q.y,fraction:i/20,hitTag:h.tagName,group:g.dataset.k}}return null}''')
  if point:
   page.mouse.click(point['x'],point['y']);page.wait_for_timeout(180);note('actual-SVG-bundle-click',point);break
  g=geom('#mapScroll');wheel(0,100,(g['box']['right']-10,g['box']['bottom']-20))
 else:raise AssertionError('No actual hit-test-visible R2/R3 bundle sample found')
 readings=[]
 for rid in ['R2','R3']:
  sel='#panel button[data-rel="'+rid+'"]';ensure(sel);parent=page.locator(sel).locator('..').locator('..');text=parent.inner_text();a,b=ENDS[rid];assert NAMES[a] in text and NAMES[b] in text and KINDS[rid] in text,text;readings.append({'id':rid,'text':text,'controlGeometry':geom(sel)})
 return {'click':point,'actualEndpointsUI':readings}
def enter_c32():
 global base
 if page.locator('#panel button[data-goto="C32"]').count()==0 and page.locator('#panel button[data-rel="R3"]').count():click('#panel button[data-rel="R3"]')
 click('#panel button[data-goto="C32"]' if page.locator('#panel button[data-goto="C32"]').count() else '#n-C32');click('#zIn')
 if width==1440:click('#zIn')
 assert abs(snapshot()['scale']['x']-1.15)<=.001
 r=geom('#mapScroll')['box'];wheel(60,140,(r['right']-10,r['bottom']-20));ensure('#panel [data-act="focus"]');base=snapshot();assert (base['map']['top']>0 or base['map']['left']>0) and base['pressed']==['C32'];click('#panel [data-act="focus"]',False)
 parent='#focusView .rail .parent';ensure(parent);ptext=page.locator(parent).inner_text();assert '전달할 내용' in ptext and 'AI 제안' in ptext
 rows=[]
 for rid in ['R3','R4']:
  sel='#focusView [data-xrel="'+rid+'"]';ensure(sel);g=geom(sel);assert g['full'] and g['hit'];text=page.locator(sel).inner_text();assert KINDS[rid] in text;rows.append({'id':rid,'text':text,'geometry':g})
 arr=page.locator('#focusView [data-xrel]').evaluate_all('es=>es.map(e=>e.dataset.xrel)');assert arr==['R3','R4']
 return {'preEntry':base,'parent':{'text':ptext,'geometry':geom(parent)},'externalRelationRawIDs':arr,'externalRelations':rows,'semantics':'AI composition parent vs original-contract external transmission, not ownership/sequence'}
def reading():
 selector='button[data-key="C32-F3"]';ensure(selector);before=positions();assert before['focus']>0,'Noninitial native focus scroll not achieved'
 rounds=[]
 for mode in ['button','Escape']:
  ensure(selector);pre={'position':positions(),'sentence':geom('#p-C32-F3'),'button':geom(selector)};click(selector,False);assert page.locator('#pk-C32-F3').count()==1;opened={'text':page.locator('#pk-C32-F3').inner_text(),'position':positions()};ensure('[data-act="peek-close"]')
  if mode=='button':click('[data-act="peek-close"]',False)
  else:page.keyboard.press('Escape');page.wait_for_timeout(150);note('actual-key',{'key':'Escape'})
  after={'position':positions(),'sentence':geom('#p-C32-F3'),'button':geom(selector),'peekCount':page.locator('.peek').count(),'peekLinks':page.locator('.peek a').count()}
  assert after['peekCount']==after['peekLinks']==0 and page.locator('[data-act="peek-close"]').count()==0 and after['position']['active']['key']=='C32-F3' and after['button']['full'] and after['button']['hit'];assert pre['position']['focus']==after['position']['focus']
  for k in ['x','y','width','height']:assert abs(pre['sentence']['box'][k]-after['sentence']['box'][k])<=1,(pre,after)
  rounds.append({'close':mode,'before':pre,'opened':opened,'closedImmediateNoAssist':after})
 return {'noninitial':before,'rounds':rounds}
def text_metrics(sel):return page.locator(sel).evaluate('e=>({value:e.value,top:e.scrollTop,max:e.scrollHeight-e.clientHeight,clientHeight:e.clientHeight,scrollHeight:e.scrollHeight,selectionStart:e.selectionStart,selectionEnd:e.selectionEnd})')
def prep_edit(marker):
 click('#fPrep');assert not page.locator('#prep').is_hidden();assert geom('#prepClose')['full'] and geom('#prepClose')['hit'];data={'opener':positions(),'before':{},'after':{},'scrollTests':[]}
 for sel,tail in [('#pf-target','\n독립 확인: '+marker+' — 원래 선택 기능만.'),('#pf-keep','\n독립 보존: '+marker+' — 기존 사본 유지.')]:
  ensure(sel);data['before'][sel]=text_metrics(sel);assert geom(sel)['full'] and geom(sel)['hit'];click(sel,False);page.keyboard.press('Control+End');page.keyboard.insert_text(tail);page.wait_for_timeout(100);data['after'][sel]=text_metrics(sel);assert data['after'][sel]['value']==data['before'][sel]['value']+tail
  before=text_metrics(sel);outer=positions();g=geom(sel)['box'];wheel(0,160,(g['x']+g['width']/2,g['y']+g['height']/2));after=text_metrics(sel);data['scrollTests'].append({'selector':sel,'internalBefore':before,'internalAfter':after,'outerBefore':outer,'outerAfter':positions(),'scrollable':before['max']>0,'method':'actual wheel inside actual edited textarea; Control+End puts caret at appended tail'})
 edits['target']=page.locator('#pf-target').input_value();edits['keep']=page.locator('#pf-keep').input_value();data['values']=dict(edits);data['outerPrep']=page.locator('#prepScroll').evaluate('e=>({top:e.scrollTop,max:e.scrollHeight-e.clientHeight,clientHeight:e.clientHeight,scrollHeight:e.scrollHeight})')
 ensure('#sendNote');data['noSend']={'text':page.locator('#sendNote').inner_text(),'geometry':geom('#sendNote')};assert '전달·수락·완료 상태가 아닙니다' in data['noSend']['text'];click('#prepClose');assert page.locator('#prep').is_hidden() and geom('#prep')['box']['width']==0;assert positions()['active']['id']=='fPrep'
 click('#fPrep');assert page.locator('#pf-target').input_value()==edits['target'] and page.locator('#pf-keep').input_value()==edits['keep'];data['reopenedValues']={k:page.locator('#pf-'+k).input_value() for k in ['target','keep']};click('#prepClose');return data
def return_map(expected='C32',baseline=None):
 before=baseline or base;click('#fBack');after=snapshot();d=compare(before,after,expected);return {'before':before,'afterImmediateNoAssist':after,'rectDeltas':d,'relations':relations()}
def repeat_short():
 global base
 first=return_map();ensure('#panel [data-act="focus"]');base=snapshot();click('#panel [data-act="focus"]',False);ensure('button[data-key="C32-F3"]');click('button[data-key="C32-F3"]',False);page.keyboard.press('Escape');page.wait_for_timeout(150)
 click('#fPrep');vals={k:page.locator('#pf-'+k).input_value() for k in ['target','keep']};assert vals==edits;click('#prepClose');second=return_map();return {'firstReturn':first,'prepAfterMapReentry':vals,'secondReturn':second}
def nested():
 click('#n-G3 .gsel');ensure('#panel [data-act="focus"]');baseline=snapshot();assert baseline['pressed']==['G3'];click('#panel [data-act="focus"]',False);assert page.locator('#fPrep').count()==0;click('[data-fgo="C32"]');assert '작업문과 미리보기' in page.locator('.fbody h2').inner_text();change=prep_edit('G3 경유 추가');back=return_map('G3',baseline)
 ensure('#panel [data-act="focus"]');again=snapshot();click('#panel [data-act="focus"]',False);click('[data-fgo="C32"]');click('#fPrep');val={k:page.locator('#pf-'+k).input_value() for k in ['target','keep']};assert val==edits;click('#prepClose');back2=return_map('G3',again);return {'entryG3':baseline,'C32Edit':change,'returnG3':back,'C32PrepVerifiedAfterMap':val,'finalReturn':back2}
def leaf_prep():
 click('#n-G1 .gsel');click('#panel [data-act="focus"]');click('#fPrep');target=page.locator('#pf-target').input_value();assert '아래 원문 조건대로' in target and '다른 기능을 구현하라는 요청이 아니다' in target;d={'text':target,'title':page.locator('#prepTitle').inner_text(),'controlGeometry':geom('#pf-target'),'closeGeometry':geom('#prepClose'),'knownScope':'Groups without kids can prepare; group with kids cannot. Not a newly discovered bug.'};click('#prepClose');click('#fBack');return d
def run(id,fn):
 global active
 active=id
 try:data=fn();R['stages'].append({'id':id,'status':'PASS','detail':data});print('PASS',id,flush=True);return True
 except Exception as e:
  R['stages'].append({'id':id,'status':'FAIL','error':str(e),'traceback':traceback.format_exc(),'position':positions()});print('FAIL',id,str(e),flush=True)
  if len(list(OUT.glob('*.png')))<5:page.screenshot(path=str(OUT/(id.replace('/','-')+'-FAIL.png')))
  return False
try:
 R['fileHashBefore']=hashlib.sha256((ROOT/'site/composition-study.html').read_bytes()).hexdigest();R['fileBytes']=(ROOT/'site/composition-study.html').stat().st_size
 if R['fileHashBefore']!=('0'*64 if args.probe else HASH):raise ValueError('SYNTHETIC expected hash mismatch' if args.probe else 'Wrong source bytes')
 assert R['fileBytes']==46924
 server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'site')));threading.Thread(target=server.serve_forever,daemon=True).start();URL=f'http://127.0.0.1:{server.server_port}/composition-study.html';R['actualHTTPURL']=URL
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True);R['environment']['browser_version']=browser.version
  for width,height in ([(1440,900)] if args.only_wide else [(1440,900),(390,844)]):
   label=str(width);ctx=browser.new_context(viewport={'width':width,'height':height});page=ctx.new_page();page.set_default_timeout(5000);page.on('pageerror',lambda e:R['pageerrors'].append(str(e)));page.on('console',lambda m:R['console'].append({'type':m.type,'text':m.text}));edits={}
   def initial():
    res=page.goto(URL);page.evaluate('document.fonts.ready');page.wait_for_timeout(180);h=hashlib.sha256(res.body()).hexdigest();assert res.status==200 and h==HASH;d={'viewport':[width,height],'HTTPStatus':res.status,'firstResponseBodySHA256':h,'bodyBytes':len(res.body()),'initial':snapshot(),'headerText':page.locator('#top').inner_text(),'headerGeometry':geom('#top')};R['HTTP'].append({k:v for k,v in d.items() if k!='initial'});page.screenshot(path=str(OUT/(label+'-initial.png')));return d
   def setup_rel():
    initial=relations();click('[data-tog="G4"]');click('[data-tog="G3"]');assert snapshot()['depth']=={'G2':'0','G3':'0','G4':'1'};agg=page.locator('#n-G3 .gfold').inner_text();assert '작업문과 미리보기' in agg and 'AI 입력' not in agg and '묶음 전체 변경 아님' in agg;assert page.locator('.kid.chg').evaluate_all('es=>es.map(e=>e.dataset.sel)')==['C32'];geometry=relations();bundle=bundle_click();return {'initialRelations':initial,'collapsedChangeAggregation':agg,'afterDepths':geometry,'bundleClicked':bundle}
   ok=run(label+'/S1',initial)
   if ok:ok=run(label+'/S2',setup_rel)
   if ok:ok=run(label+'/S3',enter_c32)
   if ok:ok=run(label+'/S4',reading)
   if ok:ok=run(label+'/S5',lambda:prep_edit('독립 '+label))
   if ok:ok=run(label+'/S6',repeat_short)
   if ok and width==390:
    ok=run('390/G3-nested',nested)
    if ok:run('390/G1-prep',leaf_prep)
   ctx.close()
  browser.close()
except BaseException as e:R['fatal']={'at':active,'type':type(e).__name__,'message':str(e),'traceback':traceback.format_exc()}
finally:
 if server:
  for op in ['shutdown','server_close']:
   try:getattr(server,op)()
   except BaseException as e:R['cleanup_errors'].append({'operation':op,'error':str(e)})
R['fileHashAfter']=hashlib.sha256((ROOT/'site/composition-study.html').read_bytes()).hexdigest();ids=[s['id'] for s in R['stages']];R['executed']=len(ids);R['missing']=[i for i in PLAN if i not in ids];R['complete']=len(ids)==len(PLAN) and set(ids)==set(PLAN);R['counts']={k:sum(s['status']==k for s in R['stages']) for k in ['PASS','FAIL']};R['exit_code']=1 if R['fatal'] or R['cleanup_errors'] or R['pageerrors'] or R['counts']['FAIL'] or not R['complete'] or R['fileHashAfter']!=HASH else 0;R['finished_utc']=datetime.now(timezone.utc).isoformat();(OUT/'result.json').write_text(json.dumps(R,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:R[k] for k in ['counts','executed','complete','missing','fatal','exit_code']},ensure_ascii=False));sys.exit(R['exit_code'])
