"""SELECT035 native HTTP/mock replay using an explicitly supplied fixture directory.
Fixtures may be operator replay materials or synthetic CI data; provenance is labelled separately.
SELECT035_MATERIALS=/path/to/fixtures SELECT035_MATERIALS_SOURCE='synthetic CI' python continuity/tests/select035_browser.py
No response interception or storage injection; UI imports/downloads are real.
"""
from pathlib import Path
import os,json,unittest
from playwright.sync_api import expect
import browser as base
OUT=base.OUT
M=Path(os.environ['SELECT035_MATERIALS'])
MATERIALS_SOURCE=os.environ.get('SELECT035_MATERIALS_SOURCE','external fixture; provenance not specified')
A='T_f3fc0bcb-7f10-402a-871f-245d68b3f9c6';B='T_a6c10b6d-52e8-447d-9007-8d194a667ecb'
class Selection(unittest.TestCase):
    setUpClass=classmethod(base.Browser.setUpClass.__func__)
    tearDownClass=classmethod(base.Browser.tearDownClass.__func__)
    setUp=base.Browser.setUp;tearDown=base.Browser.tearDown;state=base.Browser.state;compose=base.Browser.compose;send=base.Browser.send;basis=base.Browser.basis;context=base.Browser.context
    def import_file(self,path):
        self.page.once('dialog',lambda d:d.accept());self.page.locator('#import-file').set_input_files(str(path))
        expect(self.page.locator('#sidebar-project')).to_contain_text('USE034')
        expect(self.page.locator('#return-task')).to_have_value('')
    def material(self,name):return (M/name).read_text(encoding='utf-8')
    def shot(self,name):
        (OUT/'screens').mkdir(exist_ok=True);self.page.mouse.move(1,1);self.page.evaluate('window.scrollTo(0,0)')
        self.page.screenshot(path=str(OUT/'screens'/name),full_page=True)
    def download(self,button,name):
        with self.page.expect_download() as d:self.page.locator(button).click()
        d.value.save_as(OUT/name);return OUT/name
    def test_01_actual_A_B_replay(self):
        requests=[];responses=[]
        self.page.on('request',lambda r:requests.append(r.post_data_json) if r.method=='POST' and r.url.endswith('/api/continuity') else None)
        self.page.on('response',lambda r:responses.append(r.status) if r.request.method=='POST' and r.url.endswith('/api/continuity') else None)
        self.import_file(M/'01-before-A-report.json');before=self.state();self.compose()
        expect(self.page.locator('#send')).to_be_disabled();expect(self.page.locator('#return-target')).to_have_count(0)
        self.assertEqual(self.page.locator('#return-task option').evaluate_all('(es)=>es.map(e=>e.value)'),['',B,A])
        self.shot('01-multiple-unselected.png')
        self.page.locator('#return-task').select_option(A)
        expect(self.page.locator('#return-preview')).to_have_attribute('data-target-task-id',A)
        self.shot('02-A-selected.png');self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        # FIX088: the A report is filed under A without an AI run on the current work, which stays current.
        afterA=self.state();RA=afterA['tasks'][-1]['id'];self.assertEqual(afterA['tasks'][-1]['parentTaskId'],A);self.assertEqual(afterA['currentTaskId'],before['currentTaskId'])
        self.compose();self.page.locator('#draft').fill(self.material('B_report.txt'))
        expect(self.page.locator('#return-task')).to_have_value('');expect(self.page.locator('#send')).to_be_disabled()
        self.page.locator('#return-task').select_option(B);self.shot('03-B-selected.png')
        self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        both=self.state();RB=both['currentTaskId'];self.assertEqual(both['tasks'][-1]['parentTaskId'],B)
        self.assertEqual(both['sources'][-2]['text'],self.material('A_report.txt'));self.assertEqual(both['sources'][-1]['text'],self.material('B_report.txt'))
        self.assertEqual(both['sources'][:-2],before['sources']);self.assertEqual(both['bases'],before['bases']);self.assertEqual(both['tasks'][:-2],before['tasks'])
        restored=self.download('#backup','02-both-reports.json')
        self.send(self.material('NEXT_request.txt'))
        handoff=self.download('#download-work','03-B-next-handoff.md').read_text(encoding='utf-8')
        final=self.state();self.download('#backup','04-final-project.json');self.shot('04-B-next-work.png')
        # Check full report text, not just A names legitimately retained in global request bases.
        next_payload=json.dumps(requests[-1],ensure_ascii=False)
        for raw in [next_payload,handoff]:
            self.assertIn(self.material('B_report.txt').strip(),raw.replace('\\n','\n'))
            self.assertNotIn(self.material('A_report.txt').strip(),raw.replace('\\n','\n'))
        self.assertNotIn(both['sources'][-2]['id'],[s['id'] for s in requests[-1]['sources']])
        self.assertEqual(final['bases'][:len(before['bases'])],before['bases'])
        self.assertEqual(len(requests),2);self.assertEqual(responses,[200,200])  # FIX088: no AI run for the report filed under A
        (OUT/'replay.json').write_text(json.dumps({'requests':requests,'httpStatuses':responses,'A':A,'B':B,'A_report':RA,'B_report':RB,'pageErrors':self.errors,'claims':f'Actual UI replay using {MATERIALS_SOURCE}; native HTTP; mock AI; no human benefit measurement'},ensure_ascii=False,indent=2),encoding='utf-8')
        # Native JSON recovery preserves explicit parent links and resets selection.
        self.page.once('dialog',lambda d:d.accept());self.page.locator('#import-file').set_input_files(str(restored))
        expect(self.page.locator('#sidebar-task')).to_contain_text('작업 4')
        recovered=self.state();self.assertEqual(recovered['tasks'][-2]['parentTaskId'],A);self.assertEqual(recovered['tasks'][-1]['parentTaskId'],B)
        self.assertEqual(recovered['sources'],both['sources']);self.assertEqual(recovered['bases'],both['bases'])
    def test_02_ephemeral_selection_and_handler_boundaries(self):
        self.import_file(M/'01-before-A-report.json');self.compose();initial=self.state()
        # Invoke handlers directly as well as checking disabled UI: neither may silently submit B.
        self.page.locator('#compose').evaluate('(e)=>e.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}))')
        self.page.locator('#save-input').evaluate('(e)=>e.dispatchEvent(new MouseEvent("click",{bubbles:true}))')
        self.assertEqual(self.state(),initial)
        self.page.locator('#return-task').select_option(A)
        # Recording a basis triggers the full render while the same report draft remains.
        self.basis('SELECT035 수동 보존 기준');expect(self.page.locator('#return-task')).to_have_value(A)
        self.compose();expect(self.page.locator('#draft')).to_have_value(initial['draft'])
        expect(self.page.locator('#return-records > summary')).to_contain_text('이후 기록된 기준')
        before_reload=self.state();self.page.reload();expect(self.page.locator('#mode')).to_contain_text('MOCK');self.compose()
        expect(self.page.locator('#return-task')).to_have_value('');expect(self.page.locator('#send')).to_be_disabled();self.assertEqual(self.state(),before_reload)
        self.page.locator('#return-task').select_option(A)
        self.page.locator('#source-kind').evaluate('(e)=>e.closest("details").open=true')
        self.page.locator('#source-kind').select_option('evidence');expect(self.page.locator('#return-task')).to_have_value('')
        self.page.locator('#return-task').select_option(A);self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        self.assertEqual(self.state()['sources'][-1]['kind'],'evidence');self.assertEqual(self.state()['tasks'][-1]['parentTaskId'],A)
        self.compose();self.page.locator('#draft').fill('다음 미제출 결과');self.page.locator('#return-task').select_option(B)
        self.import_file(M/'01-before-A-report.json');self.compose();expect(self.page.locator('#draft')).to_have_value(initial['draft'])
        expect(self.page.locator('#send')).to_be_disabled()
        self.page.locator('#return-task').select_option(A);self.page.locator('#request-tab').click();expect(self.page.locator('#return-preview')).to_be_hidden()
        self.page.locator('#report-tab').click();expect(self.page.locator('#return-task')).to_have_value('')
    def test_03_zero_and_single_automatic_paths(self):
        self.send('내보내기 없는 결과 원문','report');self.assertIsNone(self.state()['tasks'][-1]['parentTaskId'])
        self.send('한 작업만 내보내기');T=self.state()['currentTaskId'];self.download('#download-work','single-handoff.md')
        self.compose();self.page.locator('#report-tab').click();self.page.locator('#draft').fill('단일 작업 보고')
        expect(self.page.locator('#return-task')).to_have_count(0);expect(self.page.locator('#return-preview')).to_have_attribute('data-target-task-id',T)
        self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('');self.assertEqual(self.state()['tasks'][-1]['parentTaskId'],T)
        self.send('단일 작업 증거','evidence');self.assertEqual(self.state()['tasks'][-1]['parentTaskId'],T)
if __name__=='__main__':unittest.main(verbosity=2)
