from pathlib import Path
import sys,os,json,unittest,hashlib
R=Path(__file__).parent;A=R.parent.parent/'cycle19-final-candidate/app';O=R/'w19-diagnostic';O.mkdir(exist_ok=True);os.environ.update(IDEA015_EVIDENCE_DIR=str(O),BROWSER_EXECUTABLE='/usr/bin/chromium',BROWSER_TRANSPORT='direct-http');sys.path.insert(0,str(A/'continuity/tests'));import workspace19_browser as w
raw=[]
JS='''()=>{const r=e=>e?.getBoundingClientRect().toJSON()??null;return {windowY:scrollY,focus:document.activeElement.id,viewport:[innerWidth,innerHeight],map:r(document.getElementById('space-map')),layout:{rect:r(document.querySelector('.map-layout')),inline:document.querySelector('.map-layout')?.getAttribute('style')},notice:{hidden:document.getElementById('notice').hidden,rect:r(document.getElementById('notice')),text:document.getElementById('notice').textContent},brief:{open:document.getElementById('brief-edit')?.open,rect:r(document.getElementById('brief-edit'))},rootChildren:[...document.getElementById('space-view').children].map(e=>({id:e.id,class:e.className,rect:r(e),hidden:e.hidden})),panelMode:document.getElementById('area-panel')?.dataset.panelMode}}'''
def capture(self,name):
 row={'test':self.id(),'name':name,'snapshots':[{'phase':'at-original-failure','raw':self.page.evaluate(JS)}]};raw.append(row)
 if self.WIDTH==1440:self.page.screenshot(path=str(O/('1440-'+('height' if 'height' in name else 'long')+'-failure.png')))
 for delay in [100,300,700]:
  self.page.wait_for_timeout(delay);row['snapshots'].append({'phase':'after-native-event-wait-'+str(delay),'raw':self.page.evaluate(JS)})
 (O/'failure-geometry.json').write_text(json.dumps(raw,ensure_ascii=False,indent=2))
oldEqual=w.Workspace19.equal;oldYes=w.Workspace19.yes
def eq(self,name,value,expected):
 if value!=expected:capture(self,name)
 return oldEqual(self,name,value,expected)
def yes(self,name,value,actual=None):
 if not value:capture(self,name)
 return oldYes(self,name,value,actual)
w.Workspace19.equal=eq;w.Workspace19.yes=yes
suite=unittest.TestSuite([c(n) for c in [w.Workspace19,w.Workspace19Wide] for n in ['test_01_default_record_growth_and_unsaved_owner_isolation','test_03_long_originals_and_vanished_report_caller']]);result=unittest.TextTestRunner(verbosity=2).run(suite);sys.exit(not result.wasSuccessful())
