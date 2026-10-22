from pathlib import Path
import os,sys,json,datetime,unittest,traceback
R=Path(os.environ['DIAG_DIR']);R.mkdir(exist_ok=True);sys.path.insert(0,str(Path(os.environ['APP_SCRATCH'])/'continuity/tests'))
from playwright.sync_api import Locator
import understanding17_browser as M
ACTIVE=None
JS=r'''()=>{const sel=['#work-locate-return','#copy-work','#work','#current-work','#edit-work','.work-reference','.work-reference-body','#work-edit-fields','#notice','#compose-panel','#main','.work-footer','#work-place','#outcome-home','#pending','#working'];const out={windowY:scrollY,viewport:{width:innerWidth,height:innerHeight},readableOriginal:null,maxScroll:document.documentElement.scrollHeight-innerHeight,document:{scrollHeight:document.documentElement.scrollHeight,clientHeight:document.documentElement.clientHeight,scrollWidth:document.documentElement.scrollWidth},active:document.activeElement?.outerHTML.slice(0,300),items:{}};for(const k of sel){const e=document.querySelector(k);if(!e){out.items[k]=null;continue}const r=e.getBoundingClientRect(),s=getComputedStyle(e);let clip={left:0,top:0,right:innerWidth,bottom:innerHeight};const ancestors=[];for(let a=e;a;a=a.parentElement){const b=a.getBoundingClientRect(),st=getComputedStyle(a),sx=a.offsetWidth?b.width/a.offsetWidth:1,sy=a.offsetHeight?b.height/a.offsetHeight:1,c={left:b.left+a.clientLeft*sx,top:b.top+a.clientTop*sy,right:b.left+(a.clientLeft+a.clientWidth)*sx,bottom:b.top+(a.clientTop+a.clientHeight)*sy};if(/auto|scroll|hidden|clip/.test(st.overflowX)){clip.left=Math.max(clip.left,c.left);clip.right=Math.min(clip.right,c.right)}if(/auto|scroll|hidden|clip/.test(st.overflowY)){clip.top=Math.max(clip.top,c.top);clip.bottom=Math.min(clip.bottom,c.bottom)}ancestors.push({tag:a.tagName,id:a.id,class:a.className,rect:b.toJSON(),client:c,overflow:[st.overflowX,st.overflowY],display:st.display,visibility:st.visibility,transform:st.transform,scroll:[a.scrollLeft,a.scrollTop]})}const h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2),rg=document.createRange();rg.selectNodeContents(e);const first=[...rg.getClientRects()].find(x=>x.height>0),fh=first?document.elementFromPoint(first.x+Math.min(first.width/2,30),first.y+first.height/2):null;out.items[k]={rect:r.toJSON(),pageTop:r.top+scrollY,clip,centerHit:!!h&&(h===e||e.contains(h)),centerHitNode:h?.outerHTML.slice(0,300),firstRange:first?.toJSON(),firstRangeHit:!!fh&&(fh===e||e.contains(fh)),firstRangeHitNode:fh?.outerHTML.slice(0,300),ancestors,text:e.textContent?.slice(0,400),style:{display:s.display,position:s.position,font:s.fontSize,height:s.height},open:e.open,visible:e.checkVisibility({visibilityProperty:true}),scroll:{top:e.scrollTop,client:e.clientHeight,total:e.scrollHeight}}}return out}'''
def capture(label):
 if ACTIVE:
  v=ACTIVE.page.evaluate(JS)
  v['pendingTransitions']=ACTIVE.page.evaluate('()=>window.__cycle29PendingProbe??[]')
  with (R/'diagnostic.jsonl').open('a') as f:f.write(json.dumps({'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'test':ACTIVE.id(),'label':label,'raw':v},ensure_ascii=False)+'\n')

PENDING_JS=r"""(()=>{if(window.__cycle29PendingProbe)return;const rows=[];window.__cycle29PendingProbe=rows;let previous=null;const snap=()=>{const rect=k=>{const e=document.querySelector(k);if(!e)return null;const r=e.getBoundingClientRect(),st=getComputedStyle(e);return {rect:r.toJSON(),pageTop:r.top+scrollY,hidden:e.hidden,display:st.display,open:e.open,containerType:st.containerType,text:e.textContent.slice(0,160)}};const p=document.querySelector('#pending-bar');return {time:performance.now(),windowY:scrollY,documentHeight:document.documentElement.scrollHeight,maxScroll:document.documentElement.scrollHeight-innerHeight,pending:p?(!p.hidden&&getComputedStyle(p).display!=='none'):null,working:rect('#working'),pendingBar:rect('#pending-bar'),copy:rect('#copy-work'),back:rect('#work-locate-return'),editor:rect('#edit-work'),notice:rect('#notice')}};const collect=()=>{const current=snap();if(previous&&previous.pending!==current.pending)rows.push({label:'pending visibility transition (read-only MutationObserver)',before:previous,after:current});previous=current};new MutationObserver(collect).observe(document,{subtree:true,attributes:true,childList:true,characterData:true});collect()})()"""

originalSetup=M.Area17.setUp


def setup(self):
 global ACTIVE
 originalSetup(self);ACTIVE=self
 self.ctx.add_init_script(PENDING_JS);self.page.evaluate(PENDING_JS)
M.Area17.setUp=setup
originalTearDown=M.Area17.tearDown
def teardown(self):
 capture('before original tearDown')
 originalTearDown(self)
M.Area17.tearDown=teardown
originalClick=Locator.click
def clicked(self,*a,**k):
 result=originalClick(self,*a,**k)
 if self._impl_obj._selector in ['#send','#copy-work']:
  capture('immediately after normal click '+self._impl_obj._selector)
  if ACTIVE:
   with (R/'diagnostic.jsonl').open('a') as f:f.write(json.dumps({'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'test':ACTIVE.id(),'label':'original READABLE_JS same point','raw':ACTIVE.page.evaluate(M.READABLE_JS,'#work-locate-return')},ensure_ascii=False)+'\n')
 return result
Locator.click=clicked
class Result(unittest.TextTestResult):
 def addFailure(self,test,err):
  # Failure already occurred. Screenshot only, no focus/scroll recovery or rerun.
  try:test.page.screenshot(path=str(R/('failure-'+str(test.WIDTH)+'.png')))
  except Exception:pass
  super().addFailure(test,err)
suite=unittest.TestSuite([M.Area17('test_06_locate_new_request_copy_and_return'),M.Area17Wide('test_06_locate_new_request_copy_and_return')]);result=unittest.TextTestRunner(verbosity=2,resultclass=Result).run(suite)
(R/'result.json').write_text(json.dumps({'scope':'exact AREA17 test06 only, read-only post-click observations','testsRun':result.testsRun,'failures':[{'test':str(t),'traceback':e} for t,e in result.failures],'errors':[{'test':str(t),'traceback':e} for t,e in result.errors],'plannedExit':int(not result.wasSuccessful())},ensure_ascii=False,indent=2));sys.exit(int(not result.wasSuccessful()))
