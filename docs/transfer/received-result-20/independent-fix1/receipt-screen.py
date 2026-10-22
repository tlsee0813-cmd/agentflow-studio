from pathlib import Path
import os,json,traceback,sys
R=Path(__file__).parent;O=R/'receipt-screen';O.mkdir(exist_ok=True);os.environ['IDEA015_EVIDENCE_DIR']=str(O)
from helpers import H,UI
x=H();x.setUpClass();x.setUp();r={'checks':[]};code=1
try:
 u=UI(x,1440,900,r);u.load(R.parent/'cycle20-independent/fixtures/powertoys-draft.json');r['receipt']=u.receive(R.parent/'cycle20-independent/fixtures/powertoys-plain.json');r['buttonGeometry']=u.geom('#received-result-open');r['buttonText']=x.page.locator('#received-result-open').inner_text();x.page.screenshot(path=str(O/'1440-work-receipt-before-review.png'));code=0
except Exception:r['fatal']=traceback.format_exc()
finally:
 r['pageerrors']=list(x.errors)
 try:x.tearDown();x.tearDownClass()
 except Exception:r['cleanupError']=traceback.format_exc();code=1
 code=int(code or bool(r['pageerrors']));r['exit']=code;(O/'result.json').write_text(json.dumps(r,ensure_ascii=False,indent=2));sys.exit(code)
