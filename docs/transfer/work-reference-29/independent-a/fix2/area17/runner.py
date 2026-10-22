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
  with (R/'diagnostic.jsonl').open('a') as f:f.write(json.dumps({'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'test':ACTIVE.id(),'label':label,'raw':v},ensure_ascii=False)+'\n')
originalSetup=M.Area17.setUp


def setup(self):
 global ACTIVE
 originalSetup(self);ACTIVE=self
M.Area17.setUp=setup
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
  # Separate normal recovery AFTER the untouched assertion has already failed.
  try:
   if test.page.locator('#work-locate-return').count():
    test.page.evaluate("""()=>{window.__home29=new Promise(resolve=>{let activated=false,timer;const events=[];const done=ok=>{clearTimeout(timer);document.removeEventListener('keydown',key,true);document.removeEventListener('scrollend',end,true);resolve({ok,events,y:scrollY})},key=e=>{if(e.isTrusted&&e.key==='Home'){activated=true;events.push({type:'keydown',key:e.key})}},end=e=>{if(activated&&e.target===document){events.push({type:'scrollend'});done(true)}};document.addEventListener('keydown',key,true);document.addEventListener('scrollend',end,true);timer=setTimeout(()=>done(false),4000)})}""")
    test.page.keyboard.press('Home');keyResult=test.page.evaluate('async()=>await window.__home29');test.page.evaluate('()=>delete window.__home29');capture('POSTFAILURE native Home completion '+str(keyResult));read=test.page.evaluate(M.READABLE_JS,'#work-locate-return')
    if read['readable']:
     state=test.state();task=next(t for t in state['tasks'] if t['id']==state['currentTaskId']);area=task.get('areaId');test.page.locator('#work-locate-return').click();returned=test.snap('POSTFAILURE normal Home and explicit return',area);test.page.screenshot(path=str(R/('postfailure-return-'+str(test.WIDTH)+'.png')))
     with (R/'recovery.jsonl').open('a') as f:f.write(json.dumps({'test':test.id(),'nativeHome':keyResult,'buttonReadableAfterHome':read,'return':returned,'currentBefore':state['currentTaskId'],'currentAfter':test.state()['currentTaskId']},ensure_ascii=False)+'\n')
    else:
     with (R/'recovery.jsonl').open('a') as f:f.write(json.dumps({'test':test.id(),'nativeHome':keyResult,'buttonReadableAfterHome':read,'return':'NOT_RUN: still not readable, no repair'},ensure_ascii=False)+'\n')
  except Exception:
   with (R/'recovery-error.log').open('a') as f:f.write(traceback.format_exc())
suite=unittest.TestSuite([M.Area17('test_06_locate_new_request_copy_and_return'),M.Area17Wide('test_06_locate_new_request_copy_and_return')]);result=unittest.TextTestRunner(verbosity=2,resultclass=Result).run(suite)
(R/'result.json').write_text(json.dumps({'scope':'exact AREA17 test06 only, read-only post-click observations','testsRun':result.testsRun,'failures':[{'test':str(t),'traceback':e} for t,e in result.failures],'errors':[{'test':str(t),'traceback':e} for t,e in result.errors],'plannedExit':int(not result.wasSuccessful())},ensure_ascii=False,indent=2));sys.exit(int(not result.wasSuccessful()))
