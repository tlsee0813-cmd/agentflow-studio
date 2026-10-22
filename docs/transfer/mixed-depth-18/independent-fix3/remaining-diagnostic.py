from pathlib import Path
import sys,os,unittest,importlib.util,json
R=Path(__file__).parent;A=R.parent/'cycle18-fix3-candidate/app/continuity/tests';O=R/'remaining-diagnostic';O.mkdir(exist_ok=True);sys.path.insert(0,str(A));os.environ.update(IDEA015_EVIDENCE_DIR=str(O),BROWSER_EXECUTABLE='/usr/bin/chromium',BROWSER_TRANSPORT='direct-http')
def load(name,file):
 s=importlib.util.spec_from_file_location(name,A/file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
h=load('author18','hierarchy18_browser.py');c=load('author13','pc13_browser.py');records=[]
def record(value):records.append(value);(O/'raw.json').write_text(json.dumps(records,ensure_ascii=False,indent=2))
setup=h.Area18.setUp;teardown=h.Area18.tearDown
OBS=r'''()=>{const e=document.getElementById('context-panel');return {hidden:e.hidden,display:getComputedStyle(e).display,rect:e.getBoundingClientRect().toJSON(),aria:document.getElementById('nav-context').getAttribute('aria-expanded'),layer:document.body.dataset.layer,focus:document.activeElement.id}}'''
def hs(self):
 setup(self);self.page.on('console',lambda msg:record({'test':self.id(),'event':json.loads(msg.text[10:])}) if msg.text.startswith('CTX_PROBE:') else None);self.page.evaluate('''()=>document.addEventListener('click',e=>{const id=e.target.closest('button')?.id;if(['nav-context','nav-space','map-fit'].includes(id))queueMicrotask(()=>console.debug('CTX_PROBE:'+JSON.stringify({clicked:id,contextHidden:document.getElementById('context-panel').hidden,aria:document.getElementById('nav-context').getAttribute('aria-expanded'),layer:document.body.dataset.layer,focus:document.activeElement.id})))},true)''')
def ht(self):
 try:record({'test':self.id(),'phase':'after original failure, before teardown','context':self.page.evaluate(OBS)});self.page.screenshot(path=str(O/(self.id().split('.')[-2]+'-context.png')))
 finally:teardown(self)
h.Area18.setUp=hs;h.Area18.tearDown=ht
oldback=c.Pc13.assert_back
J=r'''id=>{const e=document.getElementById(id),b=document.getElementById('area-panel-body'),r=x=>x?.getBoundingClientRect().toJSON()??null,q=e.getBoundingClientRect(),pts=[[.1,.5],[.5,.5],[.9,.5]];return {target:id,rect:r(e),body:r(b),scroll:b.scrollTop,max:b.scrollHeight-b.clientHeight,head:r(document.querySelector('.panel-top')),footer:r(document.getElementById('panel-actions')),pageY:scrollY,focus:document.activeElement.id,matrix:getComputedStyle(document.getElementById('space-plane')).transform,points:pts.map(([fx,fy])=>{let x=q.x+q.width*fx,y=q.y+q.height*fy,h=document.elementFromPoint(x,y);return {x,y,hit:h===e||e.contains(h),top:h?{id:h.id,tag:h.tagName,text:h.textContent.slice(0,150)}:null}}),text:e.textContent}}'''
def cb(self,b,area,task,label):
 record({'test':self.id(),'phase':'immediate return before unchanged assert_back','label':label,'raw':self.page.locator('body').evaluate('(e,args)=>('+J+')(args)',f'panel-task-{task}'),'originalDeparture':b});self.page.screenshot(path=str(O/('pc13-'+label+'.png')));return oldback(self,b,area,task,label)
c.Pc13.assert_back=cb
suite=unittest.TestSuite([h.Area18('test_05_long_panel_scroll_reading_and_ime_escape'),h.Area18Wide('test_05_long_panel_scroll_reading_and_ime_escape'),c.Pc13Wide('test_05_R_edit_and_RB_to_A_from_the_new_layout')]);result=unittest.TextTestRunner(verbosity=2).run(suite);sys.exit(0 if result.wasSuccessful() else 1)
