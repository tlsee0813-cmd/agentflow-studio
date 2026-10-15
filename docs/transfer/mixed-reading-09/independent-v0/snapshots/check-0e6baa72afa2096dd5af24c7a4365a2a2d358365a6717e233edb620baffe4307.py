GEOM='s=>{const e=document.querySelector(s);if(!e)return {exists:false};const rr=r=>({x:r.x,y:r.y,width:r.width,height:r.height,top:r.top,bottom:r.bottom,left:r.left,right:r.right});let r=e.getBoundingClientRect(),c={left:0,top:0,right:innerWidth,bottom:innerHeight},clips=[];for(let p=e;p;p=p.parentElement){let st=getComputedStyle(p),b=p.getBoundingClientRect();let x=/(hidden|clip|scroll|auto)/.test(st.overflowX),y=/(hidden|clip|scroll|auto)/.test(st.overflowY);if(x||y){let sx=p.offsetWidth?b.width/p.offsetWidth:1,sy=p.offsetHeight?b.height/p.offsetHeight:1;let q={left:b.left+p.clientLeft*sx,top:b.top+p.clientTop*sy,right:b.left+(p.clientLeft+p.clientWidth)*sx,bottom:b.top+(p.clientTop+p.clientHeight)*sy};if(p===e)var ownClip=q;if(p!==e&&x){c.left=Math.max(c.left,q.left);c.right=Math.min(c.right,q.right)}if(p!==e&&y){c.top=Math.max(c.top,q.top);c.bottom=Math.min(c.bottom,q.bottom)}clips.push({id:p.id,tag:p.tagName,self:p===e,x,y,box:q})}}let v={left:Math.max(r.left,c.left),right:Math.min(r.right,c.right),top:Math.max(r.top,c.top),bottom:Math.min(r.bottom,c.bottom)};let samples=[];if(v.right>v.left&&v.bottom>v.top)for(let f of [.25,.5,.75]){let x=v.left+(v.right-v.left)*f,y=v.top+(v.bottom-v.top)*.5,h=document.elementFromPoint(x,y);samples.push({x,y,hit:!!h&&(e===h||e.contains(h)),cover:h?{id:h.id,tag:h.tagName,cls:h.className}:null})}let rg=document.createRange();rg.selectNodeContents(e);let ranges=[...rg.getClientRects()].slice(0,16).map(rr);let st=getComputedStyle(e);return {exists:true,text:e.innerText,value:e.value,rect:rr(r),selfContentClip:typeof ownClip!=="undefined"?ownClip:null,clip:c,visibleIntersection:v,clips,samples,rangeRects:ranges,display:st.display,visibility:st.visibility,hidden:e.hidden,full:r.width>0&&r.height>0&&r.left>=c.left-.1&&r.right<=c.right+.1&&r.top>=c.top-.1&&r.bottom<=c.bottom+.1,hit:samples.some(x=>x.hit)}}'
import sys,json,hashlib,datetime,threading,functools,http.server,traceback,importlib.metadata,argparse,re
from pathlib import Path
from playwright.sync_api import sync_playwright
SHA='90141c4c5cfc509cafef3c038a9c1c14f0062f7e009e4359f5f97bd5541e3173'
URL='https://raw.githubusercontent.com/tlsee0813-cmd/agentflow-studio/08a04afb7515efc5f4007b5d9bf5bb787c908c20/docs/transfer/mixed-reading-09/author-fix1/mixed-reading-study.html'
NAMES={'G1':'구상과 목적','G2':'요청 맥락','G3':'전달할 내용','G4':'결과 연결','G5':'저장·복구','C21':'새 요청의 배경 고정','C22':'요청 범위 구분','C31':'AI 입력','C32':'작업문과 미리보기','C41':'일반 보고 연결','C42':'파일 반환 연결'}
PARENTS={'C21':'G2','C22':'G2','C31':'G3','C32':'G3','C41':'G4','C42':'G4'}
RELS=[('R1','G1','C21'),('R2','C21','C31'),('R3','C21','C32'),('R4','C32','G5'),('R5','G5','C42'),('R6','C21','C41')]
PHRASE='이번 확인은 배경 블록의 유무와 요청 당시 사본 유지까지만 다룬다.'
def utc():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--source',required=True);ap.add_argument('--out',required=True);args=ap.parse_args();source=Path(args.source);out=Path(args.out)
 r={'startedUTC':utc(),'sourceURL':URL,'expectedBytes':54524,'expectedSHA256':SHA,'plannedIDs':[f'{w}/{x}' for w in [1280,390] for x in ['A','B','C']]+['1440/initial'],'completedIDs':[],'checks':[],'observations':[],'http':[],'console':[],'pageerrors':[],'fatal':None,'cleanupErrors':[],'limits':['DOM interaction and rendering only; no human understanding/usability','no large-map generalization','no actual AI send/acceptance','no touch','no external source roundtrip'],'environment':{'python':sys.executable,'playwrightPackage':importlib.metadata.version('playwright'),'chromiumExecutable':'/usr/bin/chromium'},'independentExpectedRelations':RELS,'stateMethod':'No app state read. Typed selection inferred from visible aria selection, panel relationship rows/heading; focus target inferred from rendered focus heading and preparation title.'}
 server=browser=pw=None
 def record(id,data):r['observations'].append({'id':id,'data':data});print(id,flush=True);return data
 def check(id,ok,data=None):r['checks'].append({'id':id,'status':'PASS' if ok else 'FAIL','details':data});print(('PASS ' if ok else 'FAIL ')+id,flush=True)
 try:
  b=source.read_bytes();r['beforeSHA256']=hashlib.sha256(b).hexdigest();r['sourceBytes']=len(b)
  if len(b)!=54524 or r['beforeSHA256']!=SHA:raise ValueError('source mismatch')
  class H(http.server.SimpleHTTPRequestHandler):
   def log_message(self,f,*a):print('HTTP '+f%a,flush=True)
  server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(source.parent)));threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/mixed-reading-study.html';r['actualHTTPURL']=url
  pw=sync_playwright().start();browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);r['environment']['browserVersion']=browser.version
  for w,h in [(1280,720),(390,844),(1440,900)]:
   ctx=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=1);p=ctx.new_page();p.on('pageerror',lambda e:r['pageerrors'].append(str(e)));p.on('console',lambda m:r['console'].append({'type':m.type,'text':m.text}));res=p.goto(url,wait_until='networkidle');body=res.body();hp={'viewport':[w,h],'url':res.url,'status':res.status,'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest()};r['http'].append(hp);check(f'{w}/HTTP',res.status==200 and len(body)==54524 and hp['sha256']==SHA,hp)
   def geom(s):return p.evaluate(GEOM,s)
   def native(s):return p.locator(s).evaluate('(e)=>({left:e.scrollLeft,top:e.scrollTop,maxX:e.scrollWidth-e.clientWidth,maxY:e.scrollHeight-e.clientHeight,clientWidth:e.clientWidth,clientHeight:e.clientHeight,scrollWidth:e.scrollWidth,scrollHeight:e.scrollHeight})')
   def focus():return p.evaluate('()=>({id:document.activeElement.id,sel:document.activeElement.dataset.sel,act:document.activeElement.dataset.act,xref:document.activeElement.dataset.xref,key:document.activeElement.dataset.key,tag:document.activeElement.tagName,text:document.activeElement.innerText})')
   def snap():
    d=p.evaluate('''()=>{let rr=e=>{let r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}},sc=e=>({left:e.scrollLeft,top:e.scrollTop,maxX:e.scrollWidth-e.clientWidth,maxY:e.scrollHeight-e.clientHeight});return{view:document.getElementById('focusView').hidden?'map':'focus',depth:Object.fromEntries(['G2','G3','G4'].map(id=>[id,{value:document.getElementById('n-'+id).dataset.depth,expanded:document.querySelector('[data-tog="'+id+'"]').getAttribute('aria-expanded'),kidsDisplay:getComputedStyle(document.querySelector('#n-'+id+' .kids')).display}])),transform:getComputedStyle(document.getElementById('world')).transform,scrolls:Object.fromEntries(['main','mapScroll','panel','focusView'].map(id=>[id,sc(document.getElementById(id))])),nodeSelection:[...document.querySelectorAll('[data-sel][aria-pressed="true"]')].map(e=>e.dataset.sel),panelHeading:document.querySelector('#panel h2')?.textContent,panelKind:document.querySelector('#panel .pk')?.textContent,bundleRows:[...document.querySelectorAll('#panel [data-relrow]')].map(e=>e.dataset.relrow),focusHeading:document.querySelector('#focusView .fbody h2')?.textContent,prepTitle:document.getElementById('prepTitle').textContent,cards:[...document.querySelectorAll('#world .grp,#world .kid')].map(e=>({id:e.id,rect:rr(e),display:getComputedStyle(e).display,text:e.innerText})),edges:[...document.querySelectorAll('#edges g[data-rels]')].map(g=>{let path=g.querySelector('path.vis'),m=path.getScreenCTM(),L=path.getTotalLength(),point=t=>{let q=path.getPointAtLength(t);return{x:m.a*q.x+m.c*q.y+m.e,y:m.b*q.x+m.d*q.y+m.f}};return{ids:g.dataset.rels.split(' '),representativeFrom:g.dataset.from,representativeTo:g.dataset.to,aggregation:g.dataset.agg,title:g.querySelector('title').textContent,d:path.getAttribute('d'),rect:rr(path),matrix:{a:m.a,b:m.b,c:m.c,d:m.d,e:m.e,f:m.f},screenStart:point(0),screenEnd:point(L)}})}}''');d['activeElement']=focus()
    if d['nodeSelection']:d['typedSelectionDOM']={'t':'node','id':next((k for k,v in NAMES.items() if v==d['panelHeading']),d['nodeSelection'][0])}
    elif d['bundleRows']:d['typedSelectionDOM']={'t':'bundle','ids':d['bundleRows']}
    else:
     match=re.search(r'· (R[1-6])$',d['panelKind'] or '');d['typedSelectionDOM']={'t':'rel','id':match.group(1)} if match else None
    d['effectiveFocusIdDOM']=next((k for k,v in NAMES.items() if d['view']=='focus' and v==d['focusHeading']),None);return d
   def glyph(s):
    g=geom(s);result=p.evaluate('''({s,g})=>{let e=document.querySelector(s),c={...g.clip},own=g.selfContentClip;if(own){c.left=Math.max(c.left,own.left);c.top=Math.max(c.top,own.top);c.right=Math.min(c.right,own.right);c.bottom=Math.min(c.bottom,own.bottom)}let walk=document.createTreeWalker(e,NodeFilter.SHOW_TEXT),all=[],n;while(n=walk.nextNode()){let offset=0;for(let ch of n.textContent){let a=offset;offset+=ch.length;if(!ch.trim())continue;let rg=document.createRange();rg.setStart(n,a);rg.setEnd(n,offset);for(let z of rg.getClientRects()){let x=(z.left+z.right)/2,y=(z.top+z.bottom)/2,h=document.elementFromPoint(x,y);all.push({ch,rect:{x:z.x,y:z.y,width:z.width,height:z.height},inClip:z.width>0&&z.height>0&&z.left>=c.left-.1&&z.right<=c.right+.1&&z.top>=c.top-.1&&z.bottom<=c.bottom+.1,hit:!!h&&(e===h||e.contains(h)),cover:h?{id:h.id,tag:h.tagName,cls:h.className}:null})}}}let bad=all.filter(x=>!x.inClip||!x.hit),ix=[0,Math.floor(all.length/2),all.length-1];return{combinedClip:c,glyphRangeCount:all.length,badCount:bad.length,bad,samples:ix.filter((x,i)=>x>=0&&ix.indexOf(x)===i).map(x=>all[x]),font:getComputedStyle(e).fontSize}}''',{'s':s,'g':g});return {'geometry':g,'glyphObservation':result}
   def wheel(container,dy=100,dx=0):
    v=geom(container)['visibleIntersection']
    if v['right']<=v['left'] or v['bottom']<=v['top']:raise RuntimeError('wheel container not visible '+container)
    pre={x:native(x) for x in ['#main','#mapScroll','#panel','#focusView']};pt=[v['right']-9,v['bottom']-9];p.mouse.move(*pt);p.mouse.wheel(dx,dy);p.wait_for_timeout(170);record(f'{w}/wheel/{container}',{'method':'page.mouse.wheel','delta':[dx,dy],'point':pt,'before':pre,'after':{x:native(x) for x in pre}})
   def ensure(s,container):
    for _ in range(20):
     g=geom(s)
     if g.get('full') and g.get('hit'):return g
     b=g['rect'];v=geom(container)['visibleIntersection'];dy=dx=0
     if b['bottom']>v['bottom']+.1:dy=min(150,b['bottom']-v['bottom']+10)
     elif b['top']<v['top']-.1:dy=-min(150,v['top']-b['top']+10)
     elif not g['hit']:dy=-70
     if b['right']>v['right']+.1:dx=min(80,b['right']-v['right']+8)
     elif b['left']<v['left']-.1:dx=-min(80,v['left']-b['left']+8)
     wheel(container,dy,dx)
    raise RuntimeError('cannot expose '+s+' '+json.dumps(g,ensure_ascii=False))
   def click(s,container=None):
    g=ensure(s,container) if container else geom(s);record(f'{w}/click/{s}',g)
    if not g.get('full') or not g.get('hit'):raise RuntimeError('normal click unavailable '+s)
    pt=next(x for x in g['samples'] if x['hit']);p.mouse.click(pt['x'],pt['y']);p.wait_for_timeout(130)
   pc='#main' if w==390 else '#panel'
   def mapready():
    if w==390:ensure('#zIn','#main')
   def mapclick(s):mapready();click(s,'#mapScroll')
   def panelclick(s):click(s,pc)
   def enter():ensure('#panel [data-act="focus"]',pc);before=record(f'{w}/focus-entry',snap());click('#panel [data-act="focus"]');return before
   def back():click('#fBack');return record(f'{w}/map-return-immediate',snap())
   def depth():return {g:p.locator('#n-'+g).get_attribute('data-depth') for g in ['G2','G3','G4']}
   def original_relations(id):
    s=snap();flat=[z for e in s['edges'] for z in e['ids']];original=[]
    for e in s['edges']:
     for line in e['title'].splitlines():
      m=re.match(r'(R\d) (.*?) → (.*?) · (.*)',line)
      if m:original.append({'id':m[1],'fromName':m[2],'toName':m[3],'kind':m[4],'representativeFrom':e['representativeFrom'],'representativeTo':e['representativeTo'],'includedIDs':e['ids']})
    record(f'{w}/relations-{id}',{'rawIDArrayBeforeDedup':flat,'originalDOMTitleRows':original,'rawEdges':s['edges']});check(f'{w}/relations-{id}-six-originals',len(flat)==6 and len(set(flat))==6 and sorted(flat)==[x[0] for x in RELS] and all(any(row['id']==rid and row['fromName']==NAMES[a] and row['toName']==NAMES[b] and row['representativeFrom']==(PARENTS[a] if a in PARENTS and depth()[PARENTS[a]]=='0' else a) and row['representativeTo']==(PARENTS[b] if b in PARENTS and depth()[PARENTS[b]]=='0' else b) for row in original) for rid,a,b in RELS))
   def edgeclick(ids):
    mapready();sel='#edges g[data-rels="'+ids+'"] path.hit'
    for _ in range(8):
     points=p.locator(sel).evaluate('''e=>{let m=e.getScreenCTM(),L=e.getTotalLength(),g=e.parentElement;return [.1,.25,.4,.5,.65,.8,.9].map(f=>{let q=e.getPointAtLength(L*f),x=m.a*q.x+m.c*q.y+m.e,y=m.b*q.x+m.d*q.y+m.f,h=document.elementFromPoint(x,y);return{x,y,hit:!!h&&(h===e||g.contains(h)),cover:h?{tag:h.tagName,id:h.id}:null}})}''');record(f'{w}/edge-click-candidates-{ids}',points)
     ok=next((x for x in points if x['hit'] and 0<x['x']<w and 0<x['y']<h),None)
     if ok:p.mouse.click(ok['x'],ok['y']);p.wait_for_timeout(140);return
     wheel('#mapScroll',100,0)
    raise RuntimeError('no real hit on edge '+ids)
   def xopen(owner,label):
    before=snap();panelclick('#panel [data-xref="R3"]');text=p.locator('#xr-R3').inner_text();record(f'{w}/{label}-xref-open',{'snapshot':snap(),'text':text,'header':glyph('#xr-R3 .pkh'),'endRows':p.locator('#xr-R3 .xends > div:not(.arr)').all_inner_texts(),'geometry':geom('#xr-R3')});check(f'{w}/{label}-xref-meaning',f'지도 선택은 ‹{NAMES[owner]}› 그대로 · 참고는 준비문을 바꾸지 않음' in text and '준비 대상' not in text and NAMES['C21'] in text and NAMES['C32'] in text and '명시 새 요청 때 고정한 그 요청의 배경 사본' in text and snap()['typedSelectionDOM']=={'t':'node','id':owner} and depth()=={k:v['value'] for k,v in before['depth'].items()});return before
   def xclose(before,method,label):
    if method=='button':panelclick('#xr-R3 [data-act="xref-close"]')
    else:p.keyboard.press('Escape');p.wait_for_timeout(100)
    after=record(f'{w}/{label}-xref-closed-{method}',{'snapshot':snap(),'panelExists':p.locator('#xr-R3').count(),'anyXrefCount':p.locator('.xpeek').count(),'focus':focus(),'sourceButton':geom('#panel [data-xref="R3"]'),'expanded':p.locator('#panel [data-xref="R3"]').get_attribute('aria-expanded')});check(f'{w}/{label}-xref-close-{method}',after['panelExists']==after['anyXrefCount']==0 and after['focus']['xref']=='R3' and after['expanded']=='false' and after['snapshot']['typedSelectionDOM']==before['typedSelectionDOM'] and after['snapshot']['depth']==before['depth']);return after
   def prepvals():return {f:p.locator('#pf-'+f).input_value() for f in ['target','keep','evidence','unknown']}
   def openprep():click('#fPrep');v=prepvals();record(f'{w}/preparation',{'title':p.locator('#prepTitle').inner_text(),'values':v,'targetGeometry':geom('#pf-target'),'targetNative':native('#pf-target')});return v
   def assertE(E,label):enter();v=openprep();check(f'{w}/{label}-E',v['target']==E and p.locator('#prepTitle').inner_text()==NAMES['C32'],v);click('#prepClose');back()
   def peek(label,escape=False):
    s='[data-key="C32-F1"]';ensure(s,'#focusView');a=record(f'{w}/{label}-peek-before',{'scroll':native('#focusView'),'anchor':geom('#p-C32-F1'),'focus':focus()});click(s);record(f'{w}/{label}-peek-open',{'text':p.locator('#pk-C32-F1').inner_text(),'geometry':geom('#pk-C32-F1')})
    if escape:p.keyboard.press('Escape');p.wait_for_timeout(100)
    else:click('#pk-C32-F1 [data-act="peek-close"]','#focusView')
    z=record(f'{w}/{label}-peek-after',{'scroll':native('#focusView'),'anchor':geom('#p-C32-F1'),'focus':focus(),'count':p.locator('#pk-C32-F1').count(),'links':p.locator('.peek a').count(),'close':p.locator('.peek [data-act="peek-close"]').count()});check(f'{w}/{label}-peek-return',z['count']==z['links']==z['close']==0 and z['focus']['key']=='C32-F1' and z['scroll']['top']==a['scroll']['top'] and abs(z['anchor']['rect']['y']-a['anchor']['rect']['y'])<.1)
   def mapdiff(a,b):
    cards={x['id']:{k:y['rect'][k]-x['rect'][k] for k in x['rect']} for x,y in zip(a['cards'],b['cards'])};edges=[]
    for x,y in zip(a['edges'],b['edges']):
     nums=lambda s:list(map(float,re.findall(r'-?\d+(?:\.\d+)?',s)))
     dx=[v-u for u,v in zip(nums(x['d']),nums(y['d']))];edges.append({'ids':x['ids'],'worldNumericDeltas':dx,'maxAbsWorldDelta':max(map(abs,dx),default=0),'screenRectDelta':{k:y['rect'][k]-x['rect'][k] for k in x['rect']}})
    return {'cards':cards,'edges':edges}
   # A and 1440 initial.
   initial=record(f'{w}/initial',snap());samples={}
   for g in ['G1','G2','G3','G4','G5']:
    for cl in ['gname','gshort']:samples[f'#n-{g} .{cl}']=glyph(f'#n-{g} .{cl}')
   for kid in ['C31','C32']:
    for cl in ['kname','kshort']:samples[f'#n-{kid} .{cl}']=glyph(f'#n-{kid} .{cl}')
   samples['#n-C32 .kchg']=glyph('#n-C32 .kchg');record(f'{w}/initial-glyphs',samples);check(f'{w}/initial-names-roles-children-glyphs',all(v['glyphObservation']['glyphRangeCount']>0 and v['glyphObservation']['badCount']==0 for v in samples.values()));check(f'{w}/initial-depth',depth()=={'G2':'0','G3':'1','G4':'0'});original_relations('initial')
   # Screen endpoint samples against actual representative card rects, not data-ends alone.
   endpoints=[]
   for e in initial['edges']:
    for end,key in [('screenStart','representativeFrom'),('screenEnd','representativeTo')]:
     card=next(c for c in initial['cards'] if c['id']=='n-'+e[key]);q=e[end];b=card['rect'];endpoints.append({'ids':e['ids'],'representative':e[key],'end':end,'point':q,'rawCard':b,'onSide':min(abs(q['x']-b['x']),abs(q['x']-b['x']-b['width']))<=.7 and b['y']-.7<=q['y']<=b['y']+b['height']+.7})
   record(f'{w}/initial-screen-endpoint-samples',endpoints);check(f'{w}/screen-ends-match-representatives',all(e['onSide'] for e in endpoints))
   if w in [1280,390]:p.screenshot(path=str(out/f'initial-{w}.png'))
   if w==1440:r['completedIDs'].append('1440/initial');ctx.close();continue
   pre=record(f'{w}/first-selection-before',snap());mapclick('#n-C32');post=record(f'{w}/first-selection-after',snap());diff=mapdiff(pre,post);check(f'{w}/first-selection-no-geometry-depth-change',all(abs(v)<.1 for d in diff['cards'].values() for v in d.values()) and all(e['maxAbsWorldDelta']<=.5 for e in diff['edges']) and pre['depth']==post['depth'] and post['typedSelectionDOM']=={'t':'node','id':'C32'},diff);r['completedIDs'].append(f'{w}/A')
   # B bundle -> actual relation -> actual endpoint, group common-header fix, C32 xref/direct C21.
   mapclick('[data-tog="G3"]');record(f'{w}/collapsed-G3-change',{'snapshot':snap(),'aggregate':glyph('#n-G3 .agg'),'foldText':p.locator('#n-G3 .gfold').inner_text()});check(f'{w}/collapsed-change-owner',NAMES['C32'] in p.locator('#n-G3 .gfold').inner_text() and '묶음 전체 변경 아님' in p.locator('#n-G3 .gfold').inner_text());original_relations('collapsed');edgeclick('R2 R3');record(f'{w}/bundle-selected',snap());check(f'{w}/typed-bundle',snap()['typedSelectionDOM']=={'t':'bundle','ids':['R2','R3']});panelclick('[data-rel="R3"]');record(f'{w}/R3-selected',{'snapshot':snap(),'text':p.locator('#panel').inner_text()});check(f'{w}/typed-R3',snap()['typedSelectionDOM']=={'t':'rel','id':'R3'});panelclick('[data-goto="C32"]');check(f'{w}/endpoint-selection-depth',snap()['typedSelectionDOM']=={'t':'node','id':'C32'} and depth()=={'G2':'0','G3':'1','G4':'0'});original_relations('actual-C32')
   mapclick('#n-G3 .gsel');record(f'{w}/known-G3-reference-labels',p.locator('#panel [data-xref]').all_inner_texts());a=xopen('G3','G3-fix1');xclose(a,'button','G3-fix1');enter();check(f'{w}/G3-no-preparation',p.locator('#fPrep').count()==0 and '세부 부분에서 시작' in p.locator('#focusView').inner_text());back();mapclick('#n-C32')
   for method in ['button','Escape']:
    a=xopen('C32','C32-reference-'+method)
    if w==390 and method=='button':ensure('#xr-R3 .pkh',pc);p.screenshot(path=str(out/'R3-reference-390.png'))
    xclose(a,method,'C32-reference')
   a=xopen('C32','explicit-move');panelclick('#xr-R3 [data-goto="C21"]');check(f'{w}/explicit-only-C21-move',snap()['typedSelectionDOM']=={'t':'node','id':'C21'} and depth()=={'G2':'1','G3':'1','G4':'0'});r['completedIDs'].append(f'{w}/B')
   # C nondefault independent depth, actual native moves; focus/peek/edit/return/reentry/new xref.
   mapclick('[data-tog="G2"]');mapclick('[data-tog="G4"]');mapready();click('#zIn');wheel('#mapScroll',90,70);mapclick('#n-C32');ensure('#panel [data-act="focus"]',pc);entry=record(f'{w}/C-map-entry-before',snap());check(f'{w}/C-nondefault-scale-depth',entry['transform'].startswith('matrix(1.15,') and depth()=={'G2':'0','G3':'1','G4':'1'});enter();wheel('#focusView',100);peek('pre-edit');v=openprep();check(f'{w}/C32-four-fields-default',len(v)==4 and '分離' not in v['target'] and '분리된 배경 블록' in v['target'] and '실제 AI' in v['unknown']);E=v['target']+'\n'+PHRASE;click('#pf-target');p.keyboard.press('Control+End');p.keyboard.insert_text('\n'+PHRASE);edited=prepvals();check(f'{w}/meaningful-edit-only-target',edited['target']==E and all(edited[k]==v[k] for k in ['keep','evidence','unknown']));
   if w==1280:p.screenshot(path=str(out/'edited-preparation-1280.png'))
   click('#prepClose');returned=back();d=mapdiff(entry,returned);record(f'{w}/C-map-pre-post-deltas',d);check(f'{w}/C-restore-map',entry['typedSelectionDOM']==returned['typedSelectionDOM'] and entry['depth']==returned['depth'] and entry['transform']==returned['transform'] and all(entry['scrolls'][s]==returned['scrolls'][s] for s in ['main','mapScroll','panel']) and all(abs(v)<.5 for c in d['cards'].values() for v in c.values()) and all(e['maxAbsWorldDelta']<=.5 for e in d['edges']) and returned['activeElement']['act']=='focus',{'toleranceWorldPath':.5,'toleranceCardCSS':.5,'actual':d});enter();wheel('#focusView',100);peek('after-E-reentry',True);v2=openprep();check(f'{w}/E-after-focus-peek',v2['target']==E,v2);click('#prepClose');back()
   for method in ['button','Escape']:
    a=xopen('C32','new-panel-after-E-'+method);xclose(a,method,'new-panel-after-E');assertE(E,'after-new-panel-'+method)
   if w==1280:
    panelclick('#panel [data-xref="R3"]');panelclick('#xr-R3 [data-goto="C21"]');enter();other=openprep();check(f'{w}/C21-edit-isolation',PHRASE not in other['target'] and NAMES['C21'] in other['target'] and p.locator('#prepTitle').inner_text()==NAMES['C21']);click('#prepClose');back();mapclick('#n-C32');assertE(E,'after-C21')
   r['completedIDs'].append(f'{w}/C');ctx.close()
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
