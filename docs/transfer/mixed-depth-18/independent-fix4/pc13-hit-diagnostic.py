from pathlib import Path
import os,sys,unittest,importlib.util,json
R=Path(__file__).parent;A=R.parent/'cycle18-fix4-candidate/app/continuity/tests';O=R/'pc13-hit-diagnostic';O.mkdir(exist_ok=True);sys.path.insert(0,str(A));os.environ.update(IDEA015_EVIDENCE_DIR=str(O),BROWSER_EXECUTABLE='/usr/bin/chromium',BROWSER_TRANSPORT='direct-http');spec=importlib.util.spec_from_file_location('author13',A/'pc13_browser.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);rows=[];original=m.Pc13.tearDown
JS=r'''()=>{const r=e=>e?.getBoundingClientRect().toJSON()??null,desc=e=>e?{id:e.id,tag:e.tagName,cls:typeof e.className==='string'?e.className:null,text:(e.textContent??'').slice(0,160)}:null;const inspect=e=>{if(!e)return null;let b=e.getBoundingClientRect(),clip={l:0,t:0,r:innerWidth,b:innerHeight},ancestors=[];for(let a=e;a;a=a.parentElement){let v=a.getBoundingClientRect(),s=getComputedStyle(a),sx=a.offsetWidth?v.width/a.offsetWidth:1,sy=a.offsetHeight?v.height/a.offsetHeight:1;let cx=/hidden|clip|auto|scroll/.test(s.overflowX),cy=/hidden|clip|auto|scroll/.test(s.overflowY);if(cx){clip.l=Math.max(clip.l,v.left+a.clientLeft*sx);clip.r=Math.min(clip.r,v.left+(a.clientLeft+a.clientWidth)*sx)}if(cy){clip.t=Math.max(clip.t,v.top+a.clientTop*sy);clip.b=Math.min(clip.b,v.top+(a.clientTop+a.clientHeight)*sy)}ancestors.push({id:a.id,rect:r(a),overflowX:s.overflowX,overflowY:s.overflowY,position:s.position,zIndex:s.zIndex,transform:s.transform,clipX:cx,clipY:cy})}return {element:desc(e),rect:r(e),clip,ancestors,samples:[[.1,.5],[.5,.5],[.9,.5]].map(([fx,fy])=>{let x=b.x+b.width*fx,y=b.y+b.height*fy,h=document.elementFromPoint(x,y);return {x,y,hit:e===h||e.contains(h),top:desc(h),stack:document.elementsFromPoint(x,y).slice(0,7).map(desc)}})}};return {viewport:[innerWidth,innerHeight],windowY:scrollY,map:inspect(document.getElementById('space-map')),toolbar:inspect(document.querySelector('.map-toolbar')),controls:inspect(document.querySelector('.map-controls')),panel:inspect(document.getElementById('area-panel')),computedTransform:document.getElementById('space-plane')?getComputedStyle(document.getElementById('space-plane')).transform:null,tools:['map-zoom-out','map-scale','map-zoom-in','map-fit'].map(id=>inspect(document.getElementById(id))),cards:[...document.querySelectorAll('.area-node')].map(e=>({id:e.dataset.areaId,rect:r(e),title:inspect(e.querySelector('.area-card-name')),info:inspect(e.querySelector('.node-info'))})),focus:document.activeElement.id}}'''
def capture(self,phase):
 label=self.id().split('.')[-1];raw=self.page.evaluate(JS);tag=f'{self.WIDTH}-{label}-{len(rows)}';rows.append({'test':self.id(),'phase':phase,'raw':raw});(O/'rect-hit.json').write_text(json.dumps({'source':'73fd6ff82ca035dd9b2e74385ce9194db0b57791','observations':rows},ensure_ascii=False,indent=2));self.page.screenshot(path=str(O/(tag+'.png')))
original_first=m.Pc13.assert_first_screen
original_tools=m.Pc13.tool_scenes
def first(self,g,label):
 capture(self,'original first-screen geometry immediately before unchanged assertion: '+label)
 return original_first(self,g,label)
def tools(self,area,prefix):
 if prefix=='no notice: ':capture(self,'immediately before original first info click in tool_scenes; no corrective motion')
 return original_tools(self,area,prefix)
m.Pc13.assert_first_screen=first;m.Pc13Boundaries.assert_first_screen=first;m.Pc13.tool_scenes=tools
class WideBoundaries(m.Pc13Boundaries):
 WIDTH,HEIGHT=1440,900
suite=unittest.TestSuite()
for regular,boundary in [(m.Pc13,m.Pc13Boundaries),(m.Pc13Wide,WideBoundaries)]:
 for name in ['test_01_default_and_selected_first_screen','test_02_one_normal_notice_stays_visible','test_08_map_tools_usable_in_the_first_screen']:suite.addTest(regular(name))
 suite.addTest(boundary('test_06_long_purpose_idea_and_title'))
result=unittest.TextTestRunner(verbosity=2).run(suite);sys.exit(0 if result.wasSuccessful() else 1)
