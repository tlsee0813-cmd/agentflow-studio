from pathlib import Path
import os,sys,unittest,importlib.util
R=Path(__file__).parent;A=R.parent/'cycle18-fix2-candidate/app/continuity/tests';sys.path.insert(0,str(A));os.environ.update(IDEA015_EVIDENCE_DIR=str(R/'author-targeted'),BROWSER_EXECUTABLE='/usr/bin/chromium',BROWSER_TRANSPORT='direct-http');spec=importlib.util.spec_from_file_location('author18',A/'hierarchy18_browser.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);suite=unittest.TestSuite()
for klass in [m.Area18,m.Area18Wide]:
 for name in ['test_01_powertoys_complete','test_02_product13_complete','test_05_long_panel_scroll_reading_and_ime_escape']:suite.addTest(klass(name))
r=unittest.TextTestRunner(verbosity=2).run(suite);sys.exit(0 if r.wasSuccessful() else 1)
