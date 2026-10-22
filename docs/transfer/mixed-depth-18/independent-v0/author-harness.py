from pathlib import Path
import sys,os,importlib.util,unittest
A=Path('/workspace/browser-env/cycle18-candidate/app/continuity/tests');sys.path.insert(0,str(A));os.environ.update(IDEA015_EVIDENCE_DIR='/workspace/browser-env/cycle18-independent/author-supported',BROWSER_EXECUTABLE='/usr/bin/chromium',BROWSER_TRANSPORT='direct-http');spec=importlib.util.spec_from_file_location('author18',A/'hierarchy18_browser.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);original=m.Area18.receive
# TEST harness adaptation only: normal UI opens composer before original result-file helper. Product unchanged.
def receive(self,s):
 self.page.locator('#nav-work').click()
 if not self.page.locator('#compose-panel').evaluate('(e)=>e.open'):self.page.locator('#compose-summary').click()
 return original(self,s)
m.Area18.receive=receive;suite=unittest.TestSuite()
for klass in [m.Area18,m.Area18Wide]:
 for name in ['test_01_powertoys_complete','test_02_product13_complete','test_04_relation_bundle_counts_direction_kind_and_internal_list','test_06_manual_child_parent_roundtrip_and_unsent_request_protection']:suite.addTest(klass(name))
r=unittest.TextTestRunner(verbosity=2).run(suite);sys.exit(0 if r.wasSuccessful() else 1)
