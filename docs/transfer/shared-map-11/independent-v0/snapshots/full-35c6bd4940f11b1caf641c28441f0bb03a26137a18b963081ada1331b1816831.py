GEOM='s=>{const e=document.querySelector(s);if(!e)return {exists:false};const rr=r=>({x:r.x,y:r.y,width:r.width,height:r.height,top:r.top,bottom:r.bottom,left:r.left,right:r.right});let r=e.getBoundingClientRect(),c={left:0,top:0,right:innerWidth,bottom:innerHeight},clips=[];for(let p=e;p;p=p.parentElement){let st=getComputedStyle(p),b=p.getBoundingClientRect();let x=/(hidden|clip|scroll|auto)/.test(st.overflowX),y=/(hidden|clip|scroll|auto)/.test(st.overflowY);if(x||y){let sx=p.offsetWidth?b.width/p.offsetWidth:1,sy=p.offsetHeight?b.height/p.offsetHeight:1;let q={left:b.left+p.clientLeft*sx,top:b.top+p.clientTop*sy,right:b.left+(p.clientLeft+p.clientWidth)*sx,bottom:b.top+(p.clientTop+p.clientHeight)*sy};if(p===e)var ownClip=q;if(p!==e&&x){c.left=Math.max(c.left,q.left);c.right=Math.min(c.right,q.right)}if(p!==e&&y){c.top=Math.max(c.top,q.top);c.bottom=Math.min(c.bottom,q.bottom)}clips.push({id:p.id,tag:p.tagName,self:p===e,x,y,box:q})}}let v={left:Math.max(r.left,c.left),right:Math.min(r.right,c.right),top:Math.max(r.top,c.top),bottom:Math.min(r.bottom,c.bottom)};let samples=[];if(v.right>v.left&&v.bottom>v.top)for(let f of [.25,.5,.75]){let x=v.left+(v.right-v.left)*f,y=v.top+(v.bottom-v.top)*.5,h=document.elementFromPoint(x,y);samples.push({x,y,hit:!!h&&(e===h||e.contains(h)),cover:h?{id:h.id,tag:h.tagName,cls:h.className}:null})}let rg=document.createRange();rg.selectNodeContents(e);let ranges=[...rg.getClientRects()].slice(0,16).map(rr);let st=getComputedStyle(e);return {exists:true,text:e.innerText,value:e.value,rect:rr(r),selfContentClip:typeof ownClip!=="undefined"?ownClip:null,clip:c,visibleIntersection:v,clips,samples,rangeRects:ranges,display:st.display,visibility:st.visibility,hidden:e.hidden,full:r.width>0&&r.height>0&&r.left>=c.left-.1&&r.right<=c.right+.1&&r.top>=c.top-.1&&r.bottom<=c.bottom+.1,hit:samples.some(x=>x.hit)}}'
import sys,json,hashlib,datetime,threading,functools,http.server,traceback,importlib.metadata,argparse,re
from pathlib import Path
from playwright.sync_api import sync_playwright

def utc():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--site',required=True);ap.add_argument('--manifest',required=True);ap.add_argument('--out',required=True);a=ap.parse_args();site=Path(a.site);root=site.parent;out=Path(a.out);expected=json.loads(Path(a.manifest).read_text());probes=json.loads((root/'test-input-manifest.json').read_text())['files'];allFiles={**expected,**probes};fixtures=[json.loads((site/'fixtures'/f).read_text()) for f in ['flow091.json','powertoys.json']];sem=json.loads((root/'EXPECTED_SEMANTICS.json').read_text())
 planned=[f'pc-{w}/{c}/main-lifecycle' for w in [1280,1440] for c in ['flow091','powertoys']]+[f'pc-{w}/cross-case-isolation' for w in [1280,1440]]+['test-input/'+n for n in ['id-renamed','changes-absent','same-node-id-across-cases','invalid-parent','invalid-depth','invalid-endpoint','invalid-duplicate','invalid-cycle']]+['smoke-390/'+c for c in ['flow091','powertoys']]
 r={'startedUTC':utc(),'scope':'Fix1 independent main PC paths + separate test-input probes + minimal mobile smoke. P2 regression is a separate run, not inherited counts.','plannedIDs':planned,'completedIDs':[],'checks':[],'observations':[],'http':[],'console':[],'pageerrors':[],'fatal':None,'cleanupErrors':[],'coverageLimits':['No human usability/understanding','No original project execution/CI','No actual AI send/acceptance','No full mobile regression','No external original source roundtrip','No reload/other-session persistence'],'environment':{'python':sys.executable,'playwrightPackage':importlib.metadata.version('playwright'),'chromiumExecutable':'/usr/bin/chromium'}}
 server=browser=pw=None
 def hashfiles():return {f:{'bytes':len((site/f).read_bytes()),'sha256':hashlib.sha256((site/f).read_bytes()).hexdigest()} for f in allFiles}
 def record(id,data):r['observations'].append({'id':id,'data':data});print(id,flush=True);return data
 def check(id,ok,data=None):r['checks'].append({'id':id,'status':'PASS' if ok else 'FAIL','details':data});print(('PASS ' if ok else 'FAIL ')+id,flush=True)
 try:
  r['beforeFiles']=hashfiles()
  if r['beforeFiles']!=allFiles:raise ValueError('Runtime/test-input source bytes/SHA mismatch')
  static=json.loads((root/'static-semantics.json').read_text());check('static-independent-literals',static['passed'],static)
  class H(http.server.SimpleHTTPRequestHandler):
   def log_message(self,f,*args):print('HTTP '+f%args,flush=True)
  server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(site)));threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}/';r['actualHTTPBase']=base
  pw=sync_playwright().start();browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);r['environment']['browserVersion']=browser.version
  class UI:
   def __init__(self,w,h,tag,files=None):
    self.w=w;self.h=h;self.tag=tag;self.pc='#main' if w==390 else '#panel';self.ctx=browser.new_context(viewport={'width':w,'height':h});self.p=self.ctx.new_page();self.responses=[];p=self.p;p.on('response',lambda z:self.responses.append(z));p.on('console',lambda m:r['console'].append({'scenario':tag,'type':m.type,'text':m.text}));p.on('pageerror',lambda e:r['pageerrors'].append({'scenario':tag,'error':str(e)}));paths=files or ['fixtures/flow091.json','fixtures/powertoys.json'];url=base+'index.html'+('?fixtures='+','.join(paths) if files else '');p.goto(url,wait_until='networkidle');p.wait_for_selector('#app[data-ready="1"]');wanted={'index.html','engine.js','style.css',*paths};seen=set()
    for res in self.responses:
     rel=res.url.split(base)[-1].split('?')[0]
     if rel in wanted:
      b=res.body();v={'path':rel,'url':res.url,'status':res.status,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'scenario':tag,'viewport':[w,h]};r['http'].append(v);seen.add(rel);check(tag+'/HTTP/'+rel,res.status==200 and {'bytes':len(b),'sha256':v['sha256']}==allFiles[rel],v)
    check(tag+'/all-runtime-http',seen==wanted,{'seen':sorted(seen),'expected':sorted(wanted)})
   def geo(self,s):return self.p.evaluate(GEOM,s)
   def native(self,s):return self.p.locator(s).evaluate('(e)=>({left:e.scrollLeft,top:e.scrollTop,maxX:e.scrollWidth-e.clientWidth,maxY:e.scrollHeight-e.clientHeight,clientWidth:e.clientWidth,clientHeight:e.clientHeight,scrollWidth:e.scrollWidth,scrollHeight:e.scrollHeight})')
   def focus(self):return self.p.evaluate('()=>({id:document.activeElement.id,act:document.activeElement.dataset.act,sel:document.activeElement.dataset.sel,xref:document.activeElement.dataset.xref,tag:document.activeElement.tagName})')
   def snap(self):
    d=self.p.evaluate('''()=>{let rr=e=>{let x=e.getBoundingClientRect();return{x:x.x,y:x.y,width:x.width,height:x.height}},sc=e=>({left:e.scrollLeft,top:e.scrollTop,maxX:e.scrollWidth-e.clientWidth,maxY:e.scrollHeight-e.clientHeight});return{caseDOM:{index:document.getElementById('caseSel').value,title:document.querySelector('#caseSel option:checked').textContent},selected:[...document.querySelectorAll('[data-sel][aria-pressed="true"]')].map(e=>e.dataset.sel),heading:document.querySelector('#panel h2')?.textContent,depth:[...document.querySelectorAll('#world .grp[data-depth]')].map(e=>({id:e.dataset.node,value:e.dataset.depth,expanded:e.querySelector('[data-tog]').getAttribute('aria-expanded')})),transform:getComputedStyle(document.getElementById('world')).transform,scrolls:Object.fromEntries(['mapScroll','main','panel'].map(id=>[id,sc(document.getElementById(id))])),cards:[...document.querySelectorAll('#world [data-node]')].map(e=>({id:e.dataset.node,rect:rr(e),display:getComputedStyle(e).display,text:e.innerText})),edges:[...document.querySelectorAll('#edges g[data-rels]')].map(g=>{let p=g.querySelector('.vis');return{ids:g.dataset.rels.split(' '),from:g.dataset.from,to:g.dataset.to,d:p.getAttribute('d'),rect:rr(p),title:g.querySelector('title')?.textContent}})}}''');d['activeElement']=self.focus();return d
   def wheel(self,c,dy=100,dx=0):
    g=self.geo(c);v=g['visibleIntersection']
    if v['right']<=v['left'] or v['bottom']<=v['top']:raise RuntimeError('wheel container out of viewport '+c)
    before={s:self.native(s) for s in ['#mapScroll','#main','#panel','#draftBody']};pt=[v['right']-10,v['bottom']-10];self.p.mouse.move(*pt);self.p.mouse.wheel(dx,dy);self.p.wait_for_timeout(150);return record(self.tag+'/wheel/'+c,{'method':'actual page.mouse.wheel','delta':[dx,dy],'point':pt,'before':before,'after':{s:self.native(s) for s in before}})
   def ensure(self,s,c):
    for _ in range(24):
     g=self.geo(s)
     if g.get('full') and g.get('hit'):return g
     if not g.get('exists'):raise RuntimeError('missing DOM target '+s)
     v=self.geo(c)['visibleIntersection'];b=g['rect'];dy=dx=0
     if b['bottom']>v['bottom']+.1:dy=min(140,b['bottom']-v['bottom']+10)
     elif b['top']<v['top']-.1:dy=-min(140,v['top']-b['top']+10)
     elif not g['hit']:dy=-70
     if b['right']>v['right']+.1:dx=min(100,b['right']-v['right']+10)
     elif b['left']<v['left']-.1:dx=-min(100,v['left']-b['left']+10)
     self.wheel(c,dy,dx)
    raise RuntimeError('normal access failed '+s+' '+json.dumps(g,ensure_ascii=False))
   def click(self,s,c=None):
    g=self.ensure(s,c) if c else self.geo(s);record(self.tag+'/click/'+s,g)
    if not g.get('full') or not g.get('hit'):raise RuntimeError('no ordinary hit '+s)
    pt=next(x for x in g['samples'] if x['hit']);self.p.mouse.click(pt['x'],pt['y']);self.p.wait_for_timeout(120)
   def mapclick(self,s):
    if self.w==390:self.ensure('#zIn','#main')
    self.click(s,'#mapScroll')
   def pick(self,node):self.mapclick('[data-sel="'+node+'"]')
   def case(self,index):
    self.click('#caseSel');self.p.keyboard.press('Home')
    for _ in range(index):self.p.keyboard.press('ArrowDown')
    self.p.keyboard.press('Enter');self.p.wait_for_timeout(180)
   def glyph(self,s):
    g=self.geo(s);x=self.p.evaluate('''({s,g})=>{let e=document.querySelector(s),c={...g.clip},walk=document.createTreeWalker(e,NodeFilter.SHOW_TEXT),rows=[],n;while(n=walk.nextNode()){let o=0;for(let ch of n.textContent){let a=o;o+=ch.length;if(!ch.trim())continue;let rg=document.createRange();rg.setStart(n,a);rg.setEnd(n,o);for(let b of rg.getClientRects()){let x=(b.left+b.right)/2,y=(b.top+b.bottom)/2,h=document.elementFromPoint(x,y);rows.push({ch,rect:{x:b.x,y:b.y,width:b.width,height:b.height},clip:b.left>=c.left-.1&&b.right<=c.right+.1&&b.top>=c.top-.1&&b.bottom<=c.bottom+.1,hit:!!h&&(e===h||e.contains(h)),cover:h?{id:h.id,tag:h.tagName}:null})}}}let bad=rows.filter(x=>!x.clip||!x.hit);return{rangeCount:rows.length,badCount:bad.length,bad,samples:[rows[0],rows[Math.floor(rows.length/2)],rows[rows.length-1]],font:getComputedStyle(e).fontSize}}''',{'s':s,'g':g});return {'geometry':g,'glyph':x}
   def visibleText(self,s,label,c=None):
    self.ensure(s,c or self.pc);g=self.glyph(s);record(self.tag+'/'+label,g);check(self.tag+'/'+label+'-glyph',g['glyph']['rangeCount']>0 and g['glyph']['badCount']==0);return g
   def draft(self):self.click('#panel [data-act="draft"]',self.pc);return self.p.locator('#draftText').input_value()
   def edit(self,text):self.click('#draftText','#draftBody');self.p.keyboard.press('Control+A');self.p.keyboard.insert_text(text);self.p.wait_for_timeout(100)
   def draftClose(self):self.click('#draftClose');return record(self.tag+'/draft-close-immediate-map',self.snap())
   def close(self):self.ctx.close()
  def delta(a,b):
   cd={x['id']:{k:y['rect'][k]-x['rect'][k] for k in x['rect']} for x,y in zip(a['cards'],b['cards'])};ed=[]
   for x,y in zip(a['edges'],b['edges']):
    nums=lambda d:list(map(float,re.findall(r'-?\d+(?:\.\d+)?',d)));vals=[v-u for u,v in zip(nums(x['d']),nums(y['d']))];ed.append({'ids':x['ids'],'numericWorldDelta':vals,'maxAbs':max(map(abs,vals),default=0)})
   return {'cards':cd,'edges':ed}
  def restored(u,a,b,label,includePanel=True):
   d=delta(a,b);ok=a['caseDOM']==b['caseDOM'] and a['selected']==b['selected'] and a['depth']==b['depth'] and a['transform']==b['transform'] and all(a['scrolls'][s]==b['scrolls'][s] for s in (['main','mapScroll','panel'] if includePanel else ['main','mapScroll'])) and all(abs(v)<.5 for row in d['cards'].values() for v in row.values()) and all(x['maxAbs']<=.5 for x in d['edges']);record(u.tag+'/'+label+'-raw-pair',{'before':a,'after':b,'deltas':d,'worldTolerance':.5});check(u.tag+'/'+label,ok)
  def evidence(u,fx,target,shot=False):
   u.click('#panel [data-act="detail"]',u.pc);before=record(u.tag+'/detail-open-before-wheel',{'map':u.snap(),'panel':u.native(u.pc),'text':u.p.locator('#detail').inner_text()});evs=u.p.locator('#detail [data-ev]').evaluate_all('(es)=>es.map(e=>e.dataset.ev)');expectedIDs=list(dict.fromkeys([*(next(n for n in fx['nodes'] if n['id']==target).get('change') or {}).get('evidence',[]),*next(n for n in fx['nodes'] if n['id']==target).get('evidence',[])]));check(u.tag+'/detail-evidence-IDs',evs==expectedIDs,{'actual':evs,'expected':expectedIDs});lookup={e['id']:e for e in fx['evidence']}
   for eid in evs:
    baseSel='#detail [data-ev="'+eid+'"]';u.visibleText(baseSel+' .evt','ev-'+eid+'-type');u.visibleText(baseSel+' p:first-of-type','ev-'+eid+'-summary');u.ensure(baseSel+' .src a',u.pc);href=u.p.locator(baseSel+' .src a').get_attribute('href');check(u.tag+'/ev-'+eid+'-exact-href',href==lookup[eid]['source']['url'],{'href':href,'expected':lookup[eid]['source']['url']})
   if shot:u.p.screenshot(path=str(out/'PC1440-selected-evidence.png'))
   readEnd=record(u.tag+'/detail-read-end',{'panel':u.native(u.pc),'lastEvidence':evs[-1] if evs else None});u.click('#detail [data-act="ref-close"]',u.pc);after=record(u.tag+'/detail-closed-immediate',{'map':u.snap(),'detailCount':u.p.locator('#detail').count(),'detailLinkCount':u.p.locator('#detail a').count(),'focus':u.focus(),'opener':u.geo('#panel [data-act="detail"]')});check(u.tag+'/detail-removal-focus',after['detailCount']==after['detailLinkCount']==0 and after['focus']['act']=='detail')
  def xref(u,rid,expectedHrefs):
   u.click('#panel [data-xref="'+rid+'"]',u.pc);u.visibleText('#xref .xcond','xref-'+rid+'-condition');links=u.p.locator('#xref .xmeta a').evaluate_all('(es)=>es.map(e=>e.href)');record(u.tag+'/xref-'+rid,{'text':u.p.locator('#xref').inner_text(),'hrefs':links,'map':u.snap()});check(u.tag+'/xref-'+rid+'-exact-hrefs',links==expectedHrefs,{'actual':links,'expected':expectedHrefs});u.click('#xref [data-act="ref-close"]',u.pc);check(u.tag+'/xref-'+rid+'-removed',u.p.locator('#xref').count()==0 and u.focus()['xref']==rid)
  for w,h in [(1280,720),(1440,900)]:
   u=UI(w,h,'pc-'+str(w));E={};saved={}
   for idx,(case,target,other) in enumerate([('flow091','C32','C21'),('powertoys','SR','RC')]):
    u.tag=f'pc-{w}/{case}';u.case(idx);fx=fixtures[idx];initial=record(u.tag+'/initial-map',u.snap());check(u.tag+'/initial-case-heading',fx['title']==u.p.locator('#caseHead h1').inner_text());check(u.tag+'/case-switch-removed-detail',u.p.locator('#detail').count()==0)
    if w==1280:u.p.screenshot(path=str(out/f'PC1280-{case}-whole.png'))
    if case=='flow091':u.mapclick('[data-tog="G2"]');u.mapclick('[data-tog="G4"]')
    u.click('#zIn');u.click('#zIn');g=u.geo('#mapScroll');v=g['visibleIntersection'];u.p.mouse.click(v['right']-8,v['bottom']-8);u.p.keyboard.press('Control+Home');u.p.wait_for_timeout(140);zero=record(u.tag+'/native-map-before-wheel',u.native('#mapScroll'));move=u.wheel('#mapScroll',100,120);record(u.tag+'/native-map-after-wheel',u.native('#mapScroll'))
    if case=='flow091':check(u.tag+'/FLOW-wheel-zero-to-nonzero',zero['left']==0 and zero['top']==0 and (u.native('#mapScroll')['left']>0 or u.native('#mapScroll')['top']>0),move)
    else:record(u.tag+'/PT-native-extent-limit',{'before':zero,'after':u.native('#mapScroll'),'note':'Axes with extent0 are not counted as moved.'})
    u.pick(target);node=next(n for n in fx['nodes'] if n['id']==target);u.visibleText('#panel .role','selected-role');u.visibleText('#panel .chgnote','selected-change');check(u.tag+'/role-change-literal-DOM',u.p.locator('#panel .role').inner_text()==node['role'] and node['change']['summary'] in u.p.locator('#panel .chgnote').inner_text());evidence(u,fx,target,shot=(w==1440 and case=='powertoys'))
    if case=='flow091':xref(u,'R3',[sem['FLOW091']['independentLiterals']['LINKBASE']+'#L16'])
    else:u.pick('RC');xref(u,'X1',sem['PowerToys']['X1Hrefs']);u.pick(target)
    u.ensure('#panel [data-act="draft"]',u.pc);entry=record(u.tag+'/draft-entry-map-before',u.snap());blank=u.draft();check(u.tag+'/explicit-initial-blank-draft',blank=='' and u.p.locator('#draftCopyBtn').is_disabled() and u.p.locator('#draftPreviewBtn').is_disabled());E[(idx,target)]=f'PC{w} {case} {target}: 이 부분의 현재 근거와 범위를 확인하고 가능한 다음 수정 선택지를 제안해 주세요. 다른 부분은 자동 변경하지 않습니다.';u.edit(E[(idx,target)]);u.click('#draftPreviewBtn','#draftBody');record(u.tag+'/draft-edited',{'target':u.p.locator('#draftTitle').inner_text(),'input':u.p.locator('#draftText').input_value(),'preview':u.p.locator('#draftPreview').inner_text(),'caseSelectGeometry':u.geo('#caseSel'),'topInert':u.p.locator('#top').evaluate('(e)=>e.inert'),'mainInert':u.p.locator('#main').evaluate('(e)=>e.inert')});check(u.tag+'/draft-preview-target-content',node['name'] in u.p.locator('#draftPreview').inner_text() and E[(idx,target)] in u.p.locator('#draftPreview').inner_text());check(u.tag+'/draft-target-protected-by-modal',u.p.locator('#top').evaluate('(e)=>e.inert') and u.p.locator('#main').evaluate('(e)=>e.inert'));r['coverageLimits'].append(u.tag+'/case switch/other map selection while draft open NOT_RUN: actual top/main inert and modal hit coverage; no bypass')
    if w==1280 and case=='powertoys':u.p.screenshot(path=str(out/'PC1280-PT-draft-E.png'))
    returned=u.draftClose();restored(u,entry,returned,'draft-map-return');check(u.tag+'/draft-close-source-focus',u.focus()['act']=='draft');again=u.draft();check(u.tag+'/primary-E-reentry',again==E[(idx,target)]);u.draftClose();u.pick(other);second=u.draft();check(u.tag+'/other-target-starts-blank',second=='' and u.p.locator('#draftTitle').inner_text()==next(n['name'] for n in fx['nodes'] if n['id']==other));E[(idx,other)]=f'PC{w} {case} {other}: 다른 대상의 별도 요청입니다. 이 대상에 연결된 기록만 확인하고 범위를 제안해 주세요.';u.edit(E[(idx,other)]);u.draftClose();u.pick(target);check(u.tag+'/primary-E-after-other',u.draft()==E[(idx,target)]);u.draftClose();saved[idx]=record(u.tag+'/saved-case-view-before-switch',u.snap());u.click('#panel [data-act="detail"]',u.pc);record(u.tag+'/case-switch-with-detail-open',{'detailCount':u.p.locator('#detail').count(),'caseSelect':u.geo('#caseSel')});r['completedIDs'].append(f'pc-{w}/{case}/main-lifecycle')
   u.tag=f'pc-{w}/cross-case-isolation'
   for idx,target,other in [(0,'C32','C21'),(1,'SR','RC')]:
    u.case(idx);back=record(u.tag+'/case-'+str(idx)+'-immediate',u.snap());restored(u,saved[idx],back,'case-'+str(idx)+'-map-restored',includePanel=False);check(u.tag+'/case-'+str(idx)+'-detail-removed',u.p.locator('#detail').count()==0)
    for n in [target,other]:u.pick(n);check(u.tag+'/case-'+str(idx)+'-'+n+'-E',u.draft()==E[(idx,n)]);u.draftClose()
   r['completedIDs'].append(f'pc-{w}/cross-case-isolation');u.close()
  # Independent static input-file probes through the real unchanged renderer.
  for name in ['id-renamed','changes-absent','invalid-parent','invalid-depth','invalid-endpoint','invalid-duplicate','invalid-cycle']:
   tag='test-input/'+name;path='test-inputs/'+name+'.json';u=UI(1280,720,tag,[path]);fx=json.loads((site/path).read_text())
   if name.startswith('invalid-'):
    text=u.p.locator('#inputErrors').inner_text();token={'invalid-parent':'parent','invalid-depth':'지원하지 않는 깊이','invalid-endpoint':'끝점','invalid-duplicate':'중복 node ID','invalid-cycle':'순환'}[name];record(tag+'/expected-error',{'text':text,'box':u.geo('#inputErrors'),'mapNodes':u.p.locator('#world [data-node]').count()});check(tag+'/explicit-no-silent-correction',u.p.locator('#inputErrors').is_visible() and token in text and u.p.locator('#world [data-node]').count()==0)
   else:
    check(tag+'/valid-input-rendered',u.p.locator('#inputErrors').is_hidden() and u.p.locator('#world [data-node]').count()==len(fx['nodes']));target='C32' if name=='changes-absent' else 'probe_1';u.pick(target);record(tag+'/selected',{'map':u.snap(),'text':u.p.locator('#panel').inner_text()});check(tag+'/role-works-without-case-branch',u.p.locator('#panel .role').inner_text()==next(n['role'] for n in fx['nodes'] if n['id']==target))
    if name=='changes-absent':check(tag+'/no-fake-change-row',u.p.locator('#caseHead .chgstrip').count()==0 and u.p.locator('#panel .chgnote').count()==0);check(tag+'/empty-draft-still-explicit',u.draft()=='');u.draftClose()
   r['completedIDs'].append(tag);u.close()
  u=UI(1280,720,'test-input/same-node-id-across-cases',['fixtures/flow091.json','test-inputs/same-node-id-across-cases.json']);texts=['충돌시험 FLOW C32의 별도 요청입니다.','충돌시험 PT C32의 다른 요청입니다.']
  for idx in [0,1]:u.case(idx);u.pick('C32');check(u.tag+'/initial-'+str(idx),u.draft()=='');u.edit(texts[idx]);u.draftClose()
  for idx in [0,1]:u.case(idx);u.pick('C32');actual=u.draft();record(u.tag+'/actual-'+str(idx),{'text':actual,'title':u.p.locator('#draftTitle').inner_text(),'sameFixtureCaseId':fixtures[0]['caseId'],'sharedNodeID':'C32'});check(u.tag+'/isolated-'+str(idx),actual==texts[idx]);u.draftClose()
  r['completedIDs'].append('test-input/same-node-id-across-cases');u.close()
  u=UI(390,844,'smoke-390')
  for idx,(case,target) in enumerate([('flow091','C32'),('powertoys','SR')]):
   u.tag='smoke-390/'+case;u.case(idx);u.pick(target);overflow=u.p.evaluate('()=>({viewport:innerWidth,htmlClient:document.documentElement.clientWidth,htmlScroll:document.documentElement.scrollWidth,bodyScroll:document.body.scrollWidth,bodyClient:document.body.clientWidth})');record(u.tag+'/document-overflow',overflow);check(u.tag+'/no-document-horizontal-overflow',overflow['htmlScroll']<=overflow['htmlClient']+1 and overflow['bodyScroll']<=overflow['bodyClient']+1);u.click('#panel [data-act="detail"]',u.pc);u.click('#detail [data-act="ref-close"]',u.pc);check(u.tag+'/detail-close-smoke',u.p.locator('#detail').count()==0 and u.focus()['act']=='detail');r['completedIDs'].append(u.tag)
  u.close()
 except BaseException as e:r['fatal']={'type':type(e).__name__,'message':str(e),'traceback':traceback.format_exc()};print(traceback.format_exc(),flush=True)
 finally:
  for name,obj,method in [('browser',browser,'close'),('playwright',pw,'stop'),('HTTP',server,'shutdown')]:
   if obj:
    try:getattr(obj,method)()
    except BaseException as e:r['cleanupErrors'].append({'component':name,'error':repr(e)})
  r['afterFiles']=hashfiles();r['missingIDs']=[x for x in planned if x not in r['completedIDs']];r['complete']=not r['missingIDs'] and len(r['completedIDs'])==len(planned);r['finishedUTC']=utc();r['majorConsoleErrors']=[x for x in r['console'] if x['type']=='error' and '404 (File not found)' not in x['text']];r['exitCode']=int(bool(r['fatal'] or r['cleanupErrors'] or r['pageerrors'] or r['majorConsoleErrors'] or not r['complete'] or r['afterFiles']!=allFiles or any(c['status']=='FAIL' for c in r['checks'])));(out/'result.json').write_text(json.dumps(r,ensure_ascii=False,indent=2));print('CHILD_EXIT',r['exitCode'],flush=True)
 return r['exitCode']
if __name__=='__main__':sys.exit(main())
