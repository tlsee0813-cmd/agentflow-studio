from pathlib import Path
import sys,os,json,ast,unittest
R=Path(__file__).parent;A=R.parent.parent/'cycle20-final-candidate/app';O=R/'received20-failure-diagnostic';O.mkdir(exist_ok=True);os.environ.update(IDEA015_EVIDENCE_DIR=str(O),BROWSER_EXECUTABLE='/usr/bin/chromium',BROWSER_TRANSPORT='direct-http');sys.path.insert(0,str(A/'continuity/tests'));import received20_browser as r
raw=[];old=r.Received20.yes
JS=r'''()=>{const q=e=>e?.getBoundingClientRect().toJSON()??null;let e=document.getElementById('received-result-open'),anc=[];for(let a=e;a;a=a.parentElement)anc.push({id:a.id,tag:a.tagName,open:a instanceof HTMLDetailsElement?a.open:null,hidden:a.hidden,visibility:getComputedStyle(a).visibility,display:getComputedStyle(a).display,rect:q(a)});const pt=document.getElementById('task-next-action');return {windowY:scrollY,maxY:document.documentElement.scrollHeight-innerHeight,focus:document.activeElement.id,receipt:{rect:q(e),checkVisible:e?.checkVisibility({visibilityProperty:true}),ancestors:anc},taskAction:{rect:q(pt),hit:pt?(()=>{let b=pt.getBoundingClientRect(),h=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return !!h&&(h===pt||pt.contains(h))})():null},workVisible:document.getElementById('work-view').checkVisibility({visibilityProperty:true}),taskVisible:!!document.getElementById('task-view')?.checkVisibility({visibilityProperty:true}),docWidth:document.documentElement.scrollWidth}}'''
def yes(self,label,ok,actual=None):
 if not ok:
  row={'test':self.id(),'label':label,'originalActual':actual,'raw':self.page.evaluate(JS)};raw.append(row);self.page.screenshot(path=str(O/(str(self.WIDTH)+'-failure-'+str(len(raw))+'.png')));(O/'failure-geometry.json').write_text(json.dumps(raw,ensure_ascii=False,indent=2))
 return old(self,label,ok,actual)
r.Received20.yes=yes
suite=unittest.TestSuite([r.Received20('test_01_two_inputs_exact_receipt_and_B_draft_readonly'),r.Received20Wide('test_04_pending_save_navigation_and_records_origin_C')]);result=unittest.TextTestRunner(verbosity=2).run(suite);sys.exit(not result.wasSuccessful())
