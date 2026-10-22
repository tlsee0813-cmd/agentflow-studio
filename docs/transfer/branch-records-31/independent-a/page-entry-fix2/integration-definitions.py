from pathlib import Path
import os,json,sys,traceback
R0=Path(__file__).parent
exec(compile((R0/'base-definitions.py').read_text(),str(R0/'base-definitions.py'),'exec'))
# Read-only event-task capture: no app state/API calls or scroll/focus correction.
ARM=r'''()=>{window.__integrationEntry={first:null,frames:[]};const read=()=>{const r=s=>document.querySelector(s)?.getBoundingClientRect().toJSON();return {y:scrollY,viewport:[innerWidth,innerHeight],map:r('#space-map'),layout:r('.map-layout'),height:document.querySelector('.map-layout')?.style.height,transform:getComputedStyle(document.querySelector('#space-plane')).transform,saving:document.documentElement.dataset.saving??null,focus:document.activeElement?.id}};const f=e=>{if(e.isTrusted&&e.target.closest('#nav-space')){document.removeEventListener('click',f);window.__integrationEntry.first=read();requestAnimationFrame(()=>{window.__integrationEntry.frames.push(read());requestAnimationFrame(()=>window.__integrationEntry.frames.push(read()))})}};document.addEventListener('click',f)}'''
class Integration(Independent):
 def panelLong(self):
  self.detail('panel-more');self.detail('panel-edit')
  for q in self.p.locator('#area-panel-body details[id^="panel-name-full-"]').all():
   if not q.evaluate('e=>e.open'):self.click(q.locator(':scope > summary'),'normal long name disclosure')
  b=self.p.locator('#area-panel-body');pre=self.readState()
  if pre['panel']['max']>pre['panel']['top']+5:self.wheel(min(120,pre['panel']['max']-pre['panel']['top']),b)
  self.log('actual long panel native reading',{'before':pre,'after':self.readState()})
 def report(self,label):
  ret=next(t for t in self.project()['tasks'] if t.get('resultFile') and t['resultFile']['returnId']==json.loads((R0/'actual-P-return2.json').read_text())['returnId']);q=self.p.locator('#subtree-task-'+ret['id']);self.reach(q);pre=self.readState();g=q.evaluate(GEO);q.click()
  self.check(self.p.locator('#task-pointed').get_attribute('data-report-task-id')==ret['id'],'exact P report, not other same-name branch '+label,{'task':ret['id'],'return':ret['resultFile'],'before':pre,'caller':g})
  return ret,q.get_attribute('id') if False else 'subtree-task-'+ret['id'],pre,g
 def deepReader(self):
  for id in ['task-report-path','task-report-export-work','task-view-work','task-view-request']:
   q=self.p.locator('#'+id)
   if q.count() and q.is_visible():self.detail(id)
  before=self.p.evaluate(SNAP);extent=before['document']['maxScroll']-before['windowY']
  if extent>5:self.wheel(min(1200,extent))
  self.log('actual deep report/work native read',{'before':before,'after':self.p.evaluate(SNAP)})
 def invariant(self,pre,post,label):
  for key in ['view','collapsed','selected']:
   self.check(pre['screen']['projectMapMemo'][key]==post['screen']['projectMapMemo'][key],label+' map '+key,{'before':pre['screen']['projectMapMemo'][key],'after':post['screen']['projectMapMemo'][key]})
  self.check(pre['panel']['open']==post['panel']['open'] and abs(pre['panel']['top']-post['panel']['top'])<=1,label+' panel disclosures and reading',{'before':pre['panel'],'after':post['panel']})
 def run(self,w,h):
  self.configure(w,h)
  # Flow1: signal -> long subtree report -> deep reader -> ordinary map, no helper saved wait/fit/resize after baseline.
  self.click(self.p.locator('#branch-records-'+self.P),'parent signal flow1');self.panelLong();ret,cid,pre,g=self.report('general entry');self.deepReader();self.p.evaluate(ARM);self.p.locator('#nav-space').click();first=self.p.evaluate('()=>window.__integrationEntry');post=self.readState();self.log('FLOW1 FIRST synchronous and subsequent automation snapshot',{'event':first,'immediate':post,'callerBefore':g});self.invariant(pre,post,'general map entry');self.check(first['first']['map']['bottom']<=h-16+.5,'general first synchronous map bottom16',first);self.check(self.project()==self.baseline,'flow1 full project snapshot unchanged',{'hash':sha(json.dumps(self.project(),sort_keys=True).encode())});self.p.screenshot(path=str(R/f'{w}-flow1-general-map.png'));self.click(self.p.locator('#area-panel-close'),'general entry close clears previous signal lifetime');focus=self.p.evaluate('document.activeElement.id');self.check(focus=='node-info-'+self.P,'general entry close returns normal info not old branch signal',{'focus':focus,'snapshot':self.p.evaluate(SNAP)});self.log('FLOW1 later frames separate',self.p.evaluate('()=>window.__integrationEntry'))
  # Flow2: real page wheel120 before signal, then explicit report origin. Reach only before capture; no correction after return.
  y=self.p.evaluate('scrollY')
  if y>0:self.wheel(-y)
  extent=self.p.evaluate('document.documentElement.scrollHeight-innerHeight');self.log('flow2 real page scroll capacity',{'extent':extent})
  if extent<120:raise AssertionError('SETUP: native space page extent <120; do not fabricate scroll')
  self.wheel(120);y=self.p.evaluate('scrollY');self.check(abs(y-120)<=1,'flow2 real pageY120 before parent signal',{'y':y,'extent':extent})
  self.click(self.p.locator('#branch-records-'+self.P),'parent signal flow2 at actual page120');self.panelLong();ret,cid,pre,g=self.report('explicit origin');self.deepReader();self.reach(self.p.locator('#task-return-origin'));self.p.locator('#task-return-origin').click();post=self.readState();after=self.p.locator('#'+cid).evaluate(GEO);focus=self.p.evaluate('document.activeElement.id');self.log('FLOW2 explicit origin IMMEDIATE before correction',{'before':pre,'after':post,'callerBefore':g,'callerAfter':after,'focus':focus});self.invariant(pre,post,'explicit report origin');self.check(focus==cid and after['hit'] and after['full'] and abs(after['rect']['top']-g['rect']['top'])<=2,'explicit exact caller line position focus and hit',{'before':g,'after':after,'focus':focus});self.check(abs(post['screen']['windowY']-pre['screen']['windowY'])<=1,'explicit origin actual page memory preserved',{'before':pre['screen']['windowY'],'after':post['screen']['windowY']});self.check(self.project()==self.baseline,'flow2 full project including current B draft Q unchanged',{'hash':sha(json.dumps(self.project(),sort_keys=True).encode())});self.p.screenshot(path=str(R/f'{w}-flow2-explicit-origin.png'));self.closePanel('branch-records-'+self.P,'explicit origin close retains actual parent signal lifetime');(R/f'{w}-final.json').write_text(json.dumps(self.project(),ensure_ascii=False,indent=2));self.rows.append({'viewport':[w,h],'flows':2,'complete':True,'P':self.P,'Q':self.Q,'differentSameNameParent':self.D,'currentB':self.B})
