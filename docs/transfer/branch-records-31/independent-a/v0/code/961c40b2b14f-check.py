from pathlib import Path
import os,json,sys,traceback
R0=Path(__file__).parent
exec(compile((R0/'phase.py').read_text().rsplit('u=None;fatal=None;cleanup=[];code=1',1)[0],str(R0/'phase.py'),'exec'))
TEXT=r'''e=>{const r=document.createRange();r.selectNodeContents(e);let clip={left:0,top:0,right:innerWidth,bottom:innerHeight};const ancestors=[];for(let a=e;a;a=a.parentElement){const b=a.getBoundingClientRect(),s=getComputedStyle(a),sx=a.offsetWidth?b.width/a.offsetWidth:1,sy=a.offsetHeight?b.height/a.offsetHeight:1,c={left:b.left+a.clientLeft*sx,top:b.top+a.clientTop*sy,right:b.left+(a.clientLeft+a.clientWidth)*sx,bottom:b.top+(a.clientTop+a.clientHeight)*sy};if(/auto|scroll|hidden|clip/.test(s.overflowX)){clip.left=Math.max(clip.left,c.left);clip.right=Math.min(clip.right,c.right)}if(/auto|scroll|hidden|clip/.test(s.overflowY)){clip.top=Math.max(clip.top,c.top);clip.bottom=Math.min(clip.bottom,c.bottom)}ancestors.push({id:a.id,rect:b.toJSON(),client:c,overflow:[s.overflowX,s.overflowY],transform:s.transform})}return {text:e.textContent,element:e.getBoundingClientRect().toJSON(),clip,font:getComputedStyle(e).fontSize,ancestors,lines:[...r.getClientRects()].map(b=>{const x=Math.max(clip.left,b.left),y=Math.max(clip.top,b.top),rr=Math.min(clip.right,b.right),bb=Math.min(clip.bottom,b.bottom),positive:undefined;return null})}}'''
# The small text probe stores exact Range/ancestor clips/hit; no character-dump engine.
TEXT=TEXT[:TEXT.index('lines:[...r.getClientRects()]')]+'''lines:[...r.getClientRects()].map(b=>{const c={left:Math.max(clip.left,b.left),top:Math.max(clip.top,b.top),right:Math.min(clip.right,b.right),bottom:Math.min(clip.bottom,b.bottom)},positive=c.right>c.left&&c.bottom>c.top,h=positive?document.elementFromPoint((c.left+c.right)/2,(c.top+c.bottom)/2):null;return {rect:b.toJSON(),visibleClip:c,positive,full:b.left>=clip.left-.5&&b.right<=clip.right+.5&&b.top>=clip.top-.5&&b.bottom<=clip.bottom+.5,hit:!!h&&e.contains(h),cover:h?.outerHTML.slice(0,180)}})}}'''
class Independent(Phase):
 def check(self,ok,label,raw):self.checks.append({'pass':bool(ok),'label':label,'viewport':self.w,'rawReference':'ui.jsonl CHECK '+label});self.log('CHECK '+label,{'pass':bool(ok),'raw':raw})
 def map0(self):
  self.p.locator('#nav-work').click();self.state();y=self.p.evaluate('scrollY')
  if y>0:self.wheel(-y)
  self.p.locator('#nav-space').click();self.snapshot('31 entry geometry before prep (30 absent)')
 def prepInfo(self,aid):
  self.map0();g=self.p.locator('#node-info-'+aid).evaluate(GEO)
  if not(g['visible'] and g['full'] and g['hit']):
   q=self.p.locator('#area-panel-close')
   if q.is_visible():self.click(q,'preparation previous panel close')
   self.click(self.p.locator('#map-fit'),'preparation explicit fit to reach actual owner')
  self.click(self.p.locator('#node-info-'+aid),'preparation actual owner info')
 def receiveFile(self,path):self.receive(path)
 def configure(self,w,h):
  self.restoreOnly(w,h,6);p=self.project();self.P=p['space']['areas'][0]['id'];self.Q=p['space']['areas'][1]['id'];self.S=p['space']['areas'][2]['id'];self.R=p['space']['areas'][4]['id'];self.D=p['space']['areas'][5]['id']
  # Actual reparenting: Q's recorded question is now two levels below P, without fabricating a question.
  self.prepInfo(self.Q);self.detail('panel-more');self.reach(self.p.locator('#area-parent'));self.p.locator('#area-parent').select_option(self.S);self.click(self.p.locator('#area-parent-save'),'normal UI Q parent becomes S');self.state()
  self.prepInfo(self.D);self.detail('panel-more');self.fill(self.p.locator('#child-name'),'다른 가지의 설명 소유 부분');self.fill(self.p.locator('#child-note'),'[명시 합성31] 같은 이름인 다른 부모 아래의 보고를 구별한다.');self.click(self.p.locator('#child-add'),'normal UI grandchild for other same-name parent');self.L=self.state()['space']['areas'][-1]['id'];self.click(self.p.locator('#panel-new-request'),'actual other-branch child request');self.Ltask,_=self.send('[명시 합성31] 다른 가지의 안내 표현만 정리해 주세요. 정책·배포 변경은 하지 마세요.');f,u,H,text=self.exportFile('other-branch-actual-H')
  raw={**f,'report':'[명시 합성31 보고] 다른 가지의 소유 부분 안내를 읽었다. 실제 구현·AI 실행 기록이 아니다.','evidence':None,'understanding':{**u,'summary':'[명시 합성31 다른 가지 설명] 같은 이름의 다른 부모 아래에서만 읽는 참고다. 실제 실행 결과나 확정 조건이 아니다.','changes':['받은 설명의 소유 부분을 구별한다.'],'proposal':None,'origin':'독립 관측자가 실제 UI 파일용 H/template에 쓴 합성31'}};path=R/f'{w}-actual-other-branch-return2.json';path.write_text(json.dumps(raw,ensure_ascii=False,indent=2));self.receiveFile(path)
  self.prepInfo(self.R);self.click(self.p.locator('#panel-new-request'),'separate current task B normal UI');self.B,_=self.send('[명시 합성31 B] 다른 자료 안내의 표현을 준비해 주세요. 기록 읽기의 작업 대상과 구별합니다.');self.detail('compose-panel');self.reach(self.p.locator('#compose-area'));self.p.locator('#compose-area').select_option(self.Q);self.fill(self.p.locator('#draft'),'[명시 합성31 미전송 Q 초안] 현재 B와 기록 P의 대상을 섞지 않는다.');self.state()
  self.map0();self.click(self.p.locator('#node-info-'+self.P),'P info before native preparation fit')
  for aid in [self.P,self.D]:
   q=self.p.locator('#branch-toggle-'+aid)
   # These preparations precede all camera/fold preservation comparisons.
   if q.get_attribute('aria-expanded')=='true':
    g=q.evaluate(GEO)
    if not(g['full'] and g['hit']):self.click(self.p.locator('#map-fit'),'preparation fit before second fold')
    self.click(q,'normal parent fold preparation')
  self.click(self.p.locator('#map-fit'),'preparation fit with panel occupying actual width');self.click(self.p.locator('#area-panel-close'),'preparation info close -> actual focus start');self.log('PREPARED actual data and IDs',{'P':self.P,'D':self.D,'Q':self.Q,'S':self.S,'R':self.R,'L':self.L,'actualH':H,'project':self.project(),'snapshot':self.p.evaluate(SNAP)});self.baseline=self.project();(R/f'{w}-prepared.json').write_text(json.dumps(self.baseline,ensure_ascii=False,indent=2))
 def readState(self):
  b=self.p.locator('#area-panel-body');return {'screen':self.p.evaluate(SNAP),'panel':b.evaluate('e=>({owner:e.dataset.areaId,top:e.scrollTop,max:e.scrollHeight-e.clientHeight,open:[...e.querySelectorAll("details[id]")].map(d=>({id:d.id,open:d.open})),text:e.textContent})') if b.count() and b.is_visible() else None}
 def signalCheck(self,aid,label):
  v=self.readState();box=self.p.locator('#subtree-records-'+aid);row=box.locator('.subtree-record').first;owner=row.get_attribute('data-owner-area') if row.count() else None;text=row.locator('p.source-meta').evaluate(TEXT) if row.count() else None;g=self.p.locator('#branch-records-'+aid).evaluate(GEO);raw={'state':v,'firstOwner':owner,'firstOwnerText':text,'buttonGeometry':g,'visibleSignal':self.p.locator('#branch-records-'+aid).inner_text(),'accessibleName':self.p.locator('#branch-records-'+aid).get_attribute('aria-label')}
  self.check(box.evaluate('e=>e.open') and v['panel']['owner']==aid and text is not None and any(l['positive'] and l['full'] and l['hit'] for l in text['lines']),'signal first owner actual visible line '+label,raw)
  self.check(self.project()==self.baseline and self.p.locator('#branch-records-'+aid).inner_text() in self.p.locator('#branch-records-'+aid).get_attribute('aria-label'),'signal read preserves current draft target and all project data '+label,raw)
  return raw
 def close(self):return super().close()
 def closePanel(self,expectId,label):
  pre=self.p.evaluate(SNAP);self.click(self.p.locator('#area-panel-close'),label);post=self.p.evaluate(SNAP);self.check(pre['projectMapMemo']['view']==post['projectMapMemo']['view'] and pre['projectMapMemo']['collapsed']==post['projectMapMemo']['collapsed'] and self.p.evaluate('document.activeElement.id')==expectId,'close lifetime focus/camera '+label,{'before':pre,'after':post,'focusTarget':self.p.locator('#'+expectId).evaluate(GEO)})
 def run(self,w,h):
  self.configure(w,h);sig='#branch-records-'+self.P;start=self.p.evaluate(SNAP);tabs=[]
  # Start at actual returned node-info P focus, not injected DOM focus.
  for i in range(30):
   if self.p.evaluate('document.activeElement.id')==sig[1:]:break
   before=self.p.evaluate('document.activeElement.outerHTML');self.p.keyboard.press('Tab');tabs.append({'index':i+1,'before':before,'after':self.p.evaluate('document.activeElement.outerHTML'),'windowY':self.p.evaluate('scrollY')})
  self.log('actual Tab sequence from normal info-close focus',{'start':start,'tabs':tabs,'target':self.p.locator(sig).evaluate(GEO)});self.check(self.p.evaluate('document.activeElement.id')==sig[1:],'native Tab reaches real branch signal',tabs);self.p.keyboard.press('Enter');self.signalCheck(self.P,'Tab then Enter');self.p.screenshot(path=str(R/f'{w}-P-first-owner-after-Tab-Enter.png'))
  # Close record memo and read panel deep, then native close restores real signal focus; Space must override old memo.
  self.click(self.p.locator('#subtree-records-heading-'+self.P),'old memo records close');self.detail('panel-more');self.detail('panel-edit');body=self.p.locator('#area-panel-body');g=body.evaluate(GEO);self.wheel(180,body);self.log('old closed subtree/deep body actual memo',self.readState());self.closePanel(sig[1:],'old deep memo close');self.p.keyboard.press('Space');self.signalCheck(self.P,'Space overrides prior closed/deep memo')
  # First root's real question now has exact two-level ownership, not a synthetic authored fixture question.
  rows=self.p.locator('#subtree-records-'+self.P+' [data-owner-area]').evaluate_all('(es)=>es.map(e=>({owner:e.dataset.ownerArea,text:e.textContent}))');self.check(any(x['owner']==self.Q for x in rows) and self.project()['space']['containment']['parents'][self.Q]==self.S and self.project()['space']['containment']['parents'][self.S]==self.P,'actual UI two-level owner remains in exact P scope',rows)
  self.check(all(x['owner']!=self.L for x in rows),'same-name other parent child excluded from P records',rows)
  ret=next(t for t in self.project()['tasks'] if t.get('resultFile',{} ) and t['resultFile']['returnId']==json.loads((R0/'actual-P-return2.json').read_text())['returnId']);caller=self.p.locator('#subtree-task-'+ret['id']);self.reach(caller);pre=self.readState();cg=caller.evaluate(GEO);caller.click();self.check(self.p.locator('#task-pointed').get_attribute('data-report-task-id')==ret['id'] and self.project()==self.baseline,'exact H report reader and current B/draft Q unchanged',{'reportTask':ret['id'],'actualH':ret['resultFile'],'screen':self.p.evaluate(SNAP)});self.click(self.p.locator('#task-return-origin'),'report exact caller return');post=self.readState();afterG=self.p.locator('#subtree-task-'+ret['id']).evaluate(GEO);self.check(post['panel']['owner']==self.P and self.p.evaluate('document.activeElement.id')=='subtree-task-'+ret['id'] and abs(afterG['rect']['top']-cg['rect']['top'])<=2 and pre['screen']['projectMapMemo']['view']==post['screen']['projectMapMemo']['view'],'report returns exact owner caller line camera',{'before':pre,'after':post,'callerBefore':cg,'callerAfter':afterG});self.closePanel(sig[1:],'report then close to original signal')
  # Same name under a different real parent has a different actual owner list/path.
  self.click(self.p.locator('#branch-records-'+self.D),'other same-name branch records');d=self.signalCheck(self.D,'other same-name parent');self.check(self.p.locator('#area-panel-title').inner_text()==self.p.locator('#branch-records-'+self.P).get_attribute('aria-label').split(' · ')[0] and self.L in self.p.locator('#subtree-records-'+self.D+' [data-owner-area]').evaluate_all('(es)=>es.map(e=>e.dataset.ownerArea)'),'same full name different parent actual child scope',{'D':d,'path':self.p.locator('#panel-path').inner_text()});self.p.keyboard.press('Escape');self.check(self.p.evaluate('document.activeElement.id')=='branch-records-'+self.D,'Escape returns other actual same-name caller',self.p.evaluate(SNAP))
  # Signal P -> other owner info/modes must clear old signal close lifetime.
  self.click(self.p.locator(sig),'P signal before other info');self.click(self.p.locator('#node-info-'+self.D),'different same-name owner info');self.closePanel('node-info-'+self.D,'different info clears old signal caller')
  for id,focus in [('map-relations-open','map-relations-open'),('check-summary','check-summary')]:
   self.click(self.p.locator(sig),'P before other mode');self.click(self.p.locator('#'+id),'other existing read mode');self.closePanel(focus,'mode '+id+' clears P caller')
  self.click(self.p.locator(sig),'P before project switch');entry=self.p.evaluate('document.documentElement.dataset.entryId');preProj=self.project();self.p.locator('#nav-projects').click();self.p.locator('#new-project').click();self.p.locator('#nav-projects').click();self.p.locator('.project-card[data-entry-id="'+entry+'"] .project-open').click();returned=self.readState();self.log('project original card reentry immediate BEFORE any nav/info/close',returned);self.check(returned['panel'] is not None and returned['panel']['owner']==self.P and self.p.locator('#area-panel').get_attribute('data-panel-mode')=='area','original card reentry retains actual mode/owner',returned);self.closePanel('node-info-'+self.P,'reentry immediate close without clearing navigation');self.check(self.project()==preProj,'project reentry preserves original current draft and source records',{'beforeHash':sha(json.dumps(preProj,sort_keys=True).encode()),'afterHash':sha(json.dumps(self.project(),sort_keys=True).encode())})
  # Actual native pan moves caller out of view. No locate/fit to manufacture a close target.
  self.click(self.p.locator(sig),'P signal before offscreen native pan')
  for _ in range(4):
   pt=self.p.evaluate('''()=>{const m=document.querySelector('#space-map'),r=m.getBoundingClientRect();for(let y=Math.max(0,r.top)+20;y<Math.min(innerHeight,r.bottom)-20;y+=35)for(let x=Math.min(innerWidth,r.right)-25;x>r.left+r.width*.6;x-=35){const e=document.elementFromPoint(x,y);if(e&&m.contains(e)&&!e.closest('.area-node,.map-controls,button,input,textarea,select,a'))return{x,y,dx:-Math.min(450,r.width*.55)}}return null}''');assert pt is not None;self.p.mouse.move(pt['x'],pt['y']);self.p.mouse.down();self.p.mouse.move(pt['x']+pt['dx'],pt['y'],steps=10);self.p.mouse.up()
  beforeOff=self.p.evaluate(SNAP);geo=[self.p.locator(q).evaluate(GEO) for q in [sig,'#node-info-'+self.P]];self.check(all(x['rect']['right']<=x['clip']['left'] or x['rect']['left']>=x['clip']['right'] or x['rect']['bottom']<=x['clip']['top'] or x['rect']['top']>=x['clip']['bottom'] for x in geo),'actual pan caller and owner info outside clip',geo);self.closePanel('space-title','offscreen fallback no movement');fallback=self.p.locator('#space-title').evaluate(GEO);self.log('fallback title focus is sr-only, not visible emphasis',fallback);self.p.screenshot(path=str(R/f'{w}-offscreen-fallback.png'));self.check(self.project()==self.baseline,'all reading/navigation/pan data current draft exact unchanged',{'before':self.briefState(self.baseline),'after':self.briefState(self.project())});(R/f'{w}-final.json').write_text(json.dumps(self.project(),ensure_ascii=False,indent=2));self.rows.append({'viewport':[w,h],'complete':True,'P':self.P,'sameNameOther':self.D,'questionOwner2Levels':self.Q,'otherActualH':H if False else 'see prepared actual H log','currentB':self.B,'draftTargetQ':self.Q})
u=None;fatal=None;cleanup=[];code=1
try:
 u=Independent();u.checks=[]
 for w,h in [(1280,720),(1440,900)]:u.run(w,h)
except Exception:fatal=traceback.format_exc();print(fatal,file=sys.stderr)
finally:
 if u:cleanup=u.close()
 bad=[x['label'] for x in u.checks if not x['pass']] if u else [];code=int(bool(fatal or not u or len(u.rows)!=2 or bad or u.errors or cleanup))
 (R/'result.json').write_text(json.dumps({'sourceCommit':'0d9831b1141fe14ba0ce91dfc762ce9119041348','expectedPC':2,'completed':u.rows if u else [],'checks':u.checks if u else [],'failedChecks':bad,'fatal':fatal,'pageerrors':u.errors if u else [],'cleanup':cleanup,'plannedChildExit':code,'notRun':['same-session signal truly disappears through normal UI','actual OS IME','paid AI/human usability/full29 regression/30 fix injection']},ensure_ascii=False,indent=2))
sys.exit(code)
