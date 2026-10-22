from pathlib import Path
import os,sys,json,traceback
R=Path(__file__).parent;A=R.parent/'cycle18-fix4-candidate/app';O=R/'question-ui';O.mkdir(exist_ok=True);os.environ.update(IDEA015_EVIDENCE_DIR=str(O),BROWSER_EXECUTABLE='/usr/bin/chromium',BROWSER_TRANSPORT='direct-http');sys.path.insert(0,str(A/'continuity/tests'));import browser as base
from playwright.sync_api import expect
class H(base.Browser):
 def runTest(self):pass
z=json.loads((R/'test-answer-transition.json').read_text());fixture=O/'original-question-with-test-answer.json';fixture.write_text(json.dumps(z['testAnswerProject'],ensure_ascii=False));x=H();x.setUpClass();rows=[];fatal=None
try:
 for w,h in [(1280,720),(1440,900)]:
  x.setUp();p=x.page;p.set_viewport_size({'width':w,'height':h});p.on('dialog',lambda d:d.accept())
  try:
   p.locator('#import-file').set_input_files(str(fixture));expect(p.locator('#space-map')).to_be_visible();p.locator('#map-fit').click();p.locator('#node-info-'+z['ids']['parent']).click();d=p.locator('#subtree-records-'+z['ids']['parent']);d.locator('> summary').click();row=d.locator('.subtree-record').filter(has_text='기록된 질문');text=d.inner_text();raw=row.evaluate_all('(es)=>es.map(e=>({owner:e.dataset.ownerArea,text:e.textContent,rect:e.getBoundingClientRect().toJSON()}))');rows.append({'viewport':[w,h],'pass':row.count()==1 and raw[0]['owner']==z['ids']['owner'] and '시험 답변 기록 · 실제 답변 아님' in text,'text':text,'rows':raw,'questionAnsweredIsNotPromotion':True})
  finally:x.tearDown()
except Exception:fatal=traceback.format_exc()
finally:x.tearDownClass()
code=int(bool(fatal or any(not r['pass'] for r in rows)));(O/'result.json').write_text(json.dumps({'source':'73fd6ff82ca035dd9b2e74385ce9194db0b57791','rows':rows,'fatal':fatal,'exit':code},ensure_ascii=False,indent=2));print(json.dumps({'exit':code,'fatal':fatal}));sys.exit(code)
