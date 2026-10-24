"""Chromium -> real localhost HTTP -> explicitly mocked AI.
Fault-injection cases are labelled separately; no paid provider or CLI is contacted.
Run from app/: python continuity/tests/browser.py
"""
from pathlib import Path
import json, os, re, subprocess, tempfile, unittest, sys
sys.dont_write_bytecode=True
import dom_harness
DOM=os.environ.get("BROWSER_TRANSPORT")=="dom-bridge"
from importlib.metadata import version
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('IDEA015_EVIDENCE_DIR',str(ROOT/'test-results')))
OUT.mkdir(parents=True,exist_ok=True)
KEY='agentflow.idea015.project.v1'
# FLOW083: a new tab/visit lands on the project list; opening the listed project is the old direct load.
WORKSPACE='agentflow.idea015.workspace'
def open_listed(page,entry=None):
    if page.locator('#projects-view').is_visible():
        # ENTRY37: a normal first visit lands on the (still empty) home; its '새 프로젝트' is the earlier first screen.
        if entry is None and not page.locator('#project-list .project-open').count():start_new(page);return
        (page.locator(f'.project-card[data-entry-id="{entry}"] .project-open') if entry else page.locator('.project-open').first).click()
def start_new(page):
    """ENTRY37: a normal fresh visit opens the project home. Journeys that begin by writing start from its existing
    '새 프로젝트' (the same in-memory start the first visit used to open); a home with real cards is left as it is."""
    if page.locator('#projects-view').is_visible() and not page.locator('#project-list .project-open').count():
        page.locator('#new-project').click();expect(page.locator('#projects-view')).to_be_hidden();expect(page.locator('#draft')).to_be_attached()
# FLOW083: projects live in one workspace envelope written asynchronously under a Web Lock. Read the project this
# tab has open once its queued save finished (the read-only older value is still read from its own key).
STATE_JS="""([prefix,wk,key])=>{const id=document.documentElement.dataset.entryId;
  if(id==='legacy')return JSON.parse(localStorage.getItem(prefix+key));
  const env=JSON.parse(localStorage.getItem(prefix+wk));const e=env&&env.entries.find(x=>x.entryId===id);return e?e.project:null}"""
def saved(page,timeout=6.0):
    # Polled from Python: the app's CSP forbids the string evaluation wait_for_function would need.
    import time;end=time.monotonic()+timeout
    while page.evaluate('()=>!!document.documentElement.dataset.saving'):
        if time.monotonic()>end:raise AssertionError('workspace save did not finish')
        page.wait_for_timeout(20)
def read_state(page,prefix=''):
    saved(page)
    return page.evaluate(STATE_JS,[prefix,WORKSPACE,KEY])
def reveal_management(page,selector):
    """WORKSPACE19 structural precondition: the same real control lives in the named map-only management menu."""
    control=page.locator(selector)
    if not control.is_visible():
        menu=page.locator('#project-management');expect(menu).to_be_visible()
        if not menu.evaluate('(e)=>e.open'):page.locator('#project-management-toggle').click()
    expect(control).to_be_visible()
def open_context(page):
    """WORK41: the work's goal, request, conditions and received reports are one disclosure under the work card. Tests that
    read or correct them open it first, as a user would; nothing else about those controls changed."""
    d=page.locator('#outcome-context')
    if d.count() and d.is_visible() and not d.evaluate('(e)=>e.open'):page.locator('#outcome-context > summary').click()
def open_records(page):
    """WORKSPACE19 keeps the exact record buttons, now in the existing bounded side reader."""
    if not page.locator('#area-panel[data-panel-mode="records"]').count():page.locator('#check-summary').click()
    body=page.locator('#area-panel-body');expect(body).to_have_attribute('data-area-id','@records');return body

class Browser(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        env={k:os.environ[k] for k in ['PATH','HOME','TEMP','TMP','TMPDIR','SYSTEMROOT','WINDIR'] if k in os.environ}
        env.update(AI_MODE='mock',ALLOW_PAID_AI='false',DEEPSEEK_API_KEY='',PORT='0',AI_REQUESTS_PER_MINUTE='60',AI_PROCESS_CALL_CAP='100')
        cls.proc=subprocess.Popen(['node',str(ROOT/'server/index.mjs'),'--mock'],env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        line=cls.proc.stdout.readline()
        if not re.search(r'http://127\.0\.0\.1:\d+',line):raise RuntimeError('Mock server did not start: '+line)
        cls.url=re.search(r'http://127\.0\.0\.1:\d+',line).group(0)
        cls.pw=sync_playwright().start()
        kwargs={'headless':True}
        if os.environ.get('BROWSER_EXECUTABLE'):kwargs['executable_path']=os.environ['BROWSER_EXECUTABLE']
        try:cls.browser=cls.pw.chromium.launch(**kwargs)
        except Exception:
            cls.proc.terminate();cls.proc.wait(timeout=10);cls.pw.stop();raise
        (OUT/'browser-environment.json').write_text(json.dumps({'node':subprocess.check_output(['node','--version'],text=True).strip(),'playwright':version('playwright'),'chromium':cls.browser.version,'transport':'DOM bridge + test storage double; Python -> local HTTP -> mock; not native browser transport/storage' if DOM else 'real browser -> real local HTTP -> mock; injected faults in named tests','paidCalls':0},ensure_ascii=False,indent=2),encoding='utf-8')
    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.pw.stop();cls.proc.terminate();cls.proc.wait(timeout=10);cls.proc.stdout.close();cls.proc.stderr.close()
    def setUp(self):
        self.ctx=self.browser.new_context(viewport={'width':1440,'height':1050},accept_downloads=True)
        self.errors=[];self.external=[]
        def safe_route(route):
            if route.request.url.startswith(self.url):route.continue_()
            else:self.external.append(route.request.url);route.abort()
        self.ctx.route('**/*',safe_route)
        self.page=self.ctx.new_page();self.page.on('pageerror',lambda e:self.errors.append(str(e)))
        self.page.set_default_timeout(6000);self.bridge_calls=[]
        if DOM:dom_harness.mount(self,self.page)
        else:self.page.goto(self.url)
        expect(self.page.locator('#mode')).to_contain_text('MOCK')
        if not getattr(self,'start_at_home',False):start_new(self.page)
    def tearDown(self):
        self.assertEqual(self.external,[]);self.assertEqual(self.errors,[]);self.ctx.close()
    def state(self,page=None):return read_state(page or self.page)
    def open_listed(self,page=None):open_listed(page or self.page)
    # UI001: the composer and context are now disclosed on demand; assertions stay unchanged.
    def compose(self,page=None):
        page=page or self.page
        open_listed(page)
        if not page.locator('#work-view').is_visible():page.locator('#nav-work').click()
        if not page.locator('#compose-panel').evaluate('(e)=>e.open'):page.locator('#compose-summary').click()
    def context(self):
        if not self.page.locator('#context-panel').is_visible():self.page.locator('#nav-context').click()
    def send(self,text,kind='request'):
        self.compose()
        self.page.locator('#source-kind').evaluate('(e)=>e.closest("details").open=true')
        self.page.locator('#source-kind').select_option(kind)
        self.compose();self.page.locator('#draft').fill(text);self.page.locator('#send').click()
        expect(self.page.locator('#working')).to_have_text('');expect(self.page.locator('#current-work')).to_be_visible()
    def basis(self,text):
        self.context()
        self.page.locator('#add-basis').evaluate('(e)=>e.open=true');self.page.locator('#basis-draft').fill(text);self.page.locator('#basis-form button').click()
    def test_01_end_to_end_second_change_and_reload(self):
        self.page.locator('#project-name').fill('수업 예약 · 문구 개선')
        self.send('예약 확정 문구를 “신청 완료”에서 “예약 완료”로 바꿔줘. 예약 방식은 그대로 둬.')
        expect(self.page.locator('#question-box')).to_have_count(0)
        self.basis('탈퇴 유예는 30일. 유예 동안 로그인은 제한한다.')
        self.page.locator('#edit-work').evaluate('(e)=>e.open=true')
        self.page.locator('#work-next').fill('예약 완료 문구만 수정하고 배정 순서와 예약 성립 방식은 유지한다.')
        with self.page.expect_download() as d:self.page.locator('#download-work').click()
        d.value.save_as(OUT/'browser-handoff.md');self.assertIn('배정 순서',(OUT/'browser-handoff.md').read_text(encoding='utf-8'))
        self.send('문구 구현 완료라고 보고받음. 변경 파일은 화면 한 곳이며 실제 클릭 검사는 아직 하지 않음.','report')
        state=self.state();self.assertEqual(len(state['bases']),2);self.assertEqual(state['sources'][-1]['kind'],'report')
        self.send('D2을 60일로 변경해줘')
        state=self.state();self.assertEqual(state['bases'][1]['text'],'탈퇴 유예는 60일. 유예 동안 로그인은 제한한다.')
        self.assertEqual(state['bases'][1]['history'][0]['text'],'탈퇴 유예는 30일. 유예 동안 로그인은 제한한다.')
        self.assertEqual(state['tasks'][0]['manual']['next'],'예약 완료 문구만 수정하고 배정 순서와 예약 성립 방식은 유지한다.')
        expect(self.page.locator('#question-box')).to_have_count(0)
        count=len(state['sources']);calls=[];self.page.on('request',lambda req:calls.append(req.url) if '/api/continuity' in req.url else None)
        if DOM:
            raw=json.dumps(state,ensure_ascii=False);self.page.close();self.page=self.ctx.new_page();self.page.on('pageerror',lambda e:self.errors.append(str(e)));dom_harness.mount(self,self.page,raw)
        else:self.page.reload()
        expect(self.page.locator('#current-work')).to_be_visible();self.assertEqual(len(self.state()['sources']),count);self.assertEqual(calls,[])
        self.page.locator('#edit-work').evaluate('(e)=>e.open=false')
        self.page.screenshot(path=str(OUT/'desktop.png'),full_page=True)
        self.page.set_viewport_size({'width':390,'height':844});self.page.screenshot(path=str(OUT/'mobile.png'),full_page=True)
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),390)
    def test_02_fact_question_and_user_unknown(self):
        self.send('결제가 실패하는 오류가 있는데 원인은 아직 모르겠어요.')
        expect(self.page.locator('#question-box')).to_contain_text('모르는 사실 확인')
        expect(self.page.locator('.option-button')).to_have_count(0)
        before=self.state()['bases'];self.page.locator('#answer-unknown').click();expect(self.page.locator('#working')).to_have_text('')
        expect(self.page.locator('#question-box')).to_have_count(0);state=self.state();self.assertEqual(state['bases'][:len(before)],before);self.assertEqual(state['bases'][-1]['status'],'answered')
        self.assertEqual(state['sources'][-1]['disposition'],'unknown')
    def test_03_choice_custom_answer_and_synthetic_source(self):
        self.send('빈자리가 생기면 대기자를 자동으로 예약해줘.')
        expect(self.page.locator('#question-box')).to_contain_text('중요한 제품 선택');expect(self.page.locator('.option-button')).to_have_count(2)
        self.page.locator('#answer-draft').fill('참여 확인 뒤에만 예약을 확정해줘.')
        self.page.locator('#answer-send').click();expect(self.page.locator('#working')).to_have_text('')
        expect(self.page.locator('#question-box')).to_have_count(0)
        self.send('D1을 60일로 변경해줘','test_answer');state=self.state();self.assertEqual(state['sources'][-1]['kind'],'test_answer');self.assertEqual(len(state['bases']),2)
        expect(self.page.locator('#current-work')).to_contain_text('합성 시험 입력')
    def test_04_invalid_response_and_retry_preserves_source(self):
        def invalid(route):route.fulfill(status=200,content_type='application/json',body='{"mode":"mock","advice":{"status":"confirmed"}}')
        if DOM:self.page.evaluate("window.__testFault='invalid'")
        else:self.page.route('**/api/continuity',invalid)
        self.send('문구만 수정해줘.')
        expect(self.page.locator('#notice')).to_contain_text('형식');before=self.state();self.assertEqual(len(before['sources']),1)
        if DOM:self.page.evaluate('window.__testFault=null')
        else:self.page.unroute('**/api/continuity',invalid)
        self.page.locator('#retry-work').click();expect(self.page.locator('#working')).to_have_text('')
        self.assertEqual(len(self.state()['sources']),1);self.assertIsNotNone(self.state()['tasks'][0]['advice'])
    def test_05_edit_during_response_fault_injection(self):
        self.send('예약 문구만 수정해줘.')
        parked=[]
        def delayed(route):parked.append((route,route.fetch()))
        if DOM:self.page.evaluate("window.__testFault='delay'")
        else:self.page.route('**/api/continuity',delayed)
        self.page.locator('#retry-work').click()
        if DOM:self.page.wait_for_function('!!window.__releaseTest')
        else:self.page.wait_for_timeout(100);self.assertEqual(len(parked),1)
        self.compose();self.page.locator('#draft').fill('응답 도착 전에 작성한 다음 요청')
        self.page.locator('#edit-work').evaluate('(e)=>e.open=true');self.page.locator('#work-scope').fill('사용자가 직접 고친 현재 범위')
        if DOM:self.page.evaluate('window.__releaseTest()')
        else:
            route,response=parked.pop();route.fulfill(response=response)
        expect(self.page.locator('#working')).to_have_text('');expect(self.page.locator('#notice')).to_contain_text('이전 응답')
        expect(self.page.locator('#draft')).to_have_value('응답 도착 전에 작성한 다음 요청')
        expect(self.page.locator('#work-scope')).to_have_value('사용자가 직접 고친 현재 범위')
        if DOM:self.page.evaluate('window.__testFault=null')
        else:self.page.unroute('**/api/continuity',delayed)
        self.page.locator('#retry-work').click();expect(self.page.locator('#working')).to_have_text('')
        self.assertEqual(self.state()['tasks'][0]['manual']['scope'],'사용자가 직접 고친 현재 범위')
    def test_06_storage_failure_backup_and_invalid_import(self):
        self.send('CSV 내려받기를 추가해줘.')
        before=self.state()
        self.page.evaluate('()=>{Storage.prototype.setItem=function(){throw new DOMException("Quota","QuotaExceededError")}}')
        self.compose();self.page.locator('#draft').fill('저장 실패 중에도 보존할 새 입력')
        expect(self.page.locator('#storage-error')).to_be_visible();expect(self.page.locator('#draft')).to_have_value('저장 실패 중에도 보존할 새 입력')
        self.assertEqual(self.state(),before)
        reveal_management(self.page,'#backup')
        with self.page.expect_download() as d:self.page.locator('#backup').click()
        path=OUT/'browser-recovery.json';d.value.save_as(path);self.assertEqual(json.loads(path.read_text(encoding='utf-8'))['draft'],'저장 실패 중에도 보존할 새 입력')
        bad=OUT/'invalid-import.json';bad.write_text('{"schemaVersion":"future"}',encoding='utf-8')
        self.page.locator('#import-file').set_input_files(bad)
        expect(self.page.locator('#notice')).to_contain_text('바꾸지 않았습니다')
        expect(self.page.locator('#draft')).to_have_value('저장 실패 중에도 보존할 새 입력')
    def test_07_valid_import_roundtrip_and_clipboard_failure(self):
        self.send('문구만 바꿔줘.');self.basis('기존 예약 순서는 유지한다.')
        original=self.state()
        reveal_management(self.page,'#backup')
        with self.page.expect_download() as d:self.page.locator('#backup').click()
        path=OUT/'valid-recovery.json';d.value.save_as(path)
        self.import_file(path);expect(self.page.locator('#basis-count')).to_have_text('2')
        self.assertEqual(self.state()['bases'],original['bases'])
        self.page.evaluate('Object.defineProperty(navigator,"clipboard",{value:{writeText:()=>Promise.reject(new Error("denied"))},configurable:true})')
        self.page.locator('#copy-work').click();expect(self.page.locator('#notice')).to_contain_text('클립보드를 사용할 수 없습니다')
        expect(self.page.locator('#handoff-text')).to_be_visible();self.assertEqual(len(self.state()['tasks'][0]['handoffs']),0)
    def test_08_cross_tab_conflict_no_overwrite_and_html_is_text(self):
        self.send('문구를 <img src=x onerror=alert(1)> 로 바꿔줘.')
        self.assertEqual(self.page.locator('img').count(),0)
        other=self.ctx.new_page()
        if DOM:dom_harness.mount(self,other,json.dumps(self.state(),ensure_ascii=False))
        else:other.goto(self.url)
        self.open_listed(other) # FLOW083: a second tab starts at the list; open the same project as before.
        expect(other.locator('#current-work')).to_be_visible()
        self.compose();self.page.locator('#draft').fill('첫 탭의 새 입력')
        if DOM:other.evaluate('(raw)=>localStorage.setItem("agentflow.idea015.project.v1",raw)',json.dumps(self.state(),ensure_ascii=False))
        self.compose(other);other.locator('#draft').fill('둘째 탭에 보존할 입력')
        expect(other.locator('#storage-error')).to_be_visible();expect(other.locator('#draft')).to_have_value('둘째 탭에 보존할 입력')
        self.assertEqual(self.state()['draft'],'첫 탭의 새 입력');other.close()

    # --- IDEA015-R2: native-browser regressions (real Chromium -> real local HTTP, native localStorage) ---
    def instruction(self,text):
        start=text.index('## 이번 작업');end=text.find('\n## ',start+5);return text[start:end if end>0 else None]
    def download_work(self,name):
        with self.page.expect_download() as d:self.page.locator('#download-work').click()
        path=OUT/name;d.value.save_as(path);return path.read_text(encoding='utf-8')
    def import_file(self,path):
        def accept(dialog):dialog.accept()
        self.page.on('dialog',accept)
        probe='()=>[document.documentElement.dataset.entryId||"",document.getElementById("notice").textContent||""]'
        try:
            before=self.page.evaluate(probe)
            # A backup reimport can already match every state/count assertion: await this import's dialog.
            with self.page.expect_event('dialog') as event:
                self.page.locator('#import-file').set_input_files(path)
            self.assertEqual(event.value.type,'confirm')
            # FLOW083: a backup is now added as a separate copy; the open project is not replaced.
            self.assertIn('새 프로젝트 사본으로 불러올까요?',event.value.message)
            # The copy is written asynchronously (flush, then a locked create): wait for this import's outcome,
            # i.e. the copy opened, or a new notice says it was listed only or could not be written.
            import time;end=time.monotonic()+6
            while True:
                entry,notice=self.page.evaluate(probe)
                if entry!=before[0] or notice!=before[1] and ('사본' in notice or '저장하지 못했' in notice):break
                if time.monotonic()>end:raise AssertionError('import did not finish')
                self.page.wait_for_timeout(20)
            saved(self.page)
        finally:
            self.page.remove_listener('dialog',accept)
    def backup(self,name):
        reveal_management(self.page,'#backup')
        with self.page.expect_download() as d:self.page.locator('#backup').click()
        path=OUT/name;d.value.save_as(path);return path
    @unittest.skipIf(DOM,'needs native routing/localStorage')
    def test_09_basis_change_after_ai_text_is_not_exported_as_current_instruction(self):
        def advice(route):
            body=route.request.post_data_json;ids=[b['id'] for b in body['bases']]
            route.fulfill(status=200,content_type='application/json',body=json.dumps({'mode':'mock','ticket':body['ticket'],'advice':{
                'understanding':'탈퇴 30일 뒤 계정 삭제 배치','scope':'삭제 배치만','next':'30일 지난 계정을 삭제하는 nightly job 구현',
                'checks':'30일 경과 계정만 삭제되는지 확인','question':None,'relatedBasisIds':ids,'reviewBasisIds':[],'suggestions':[],
                # Synthetic success envelope for context.5; the stale-instruction assertions below are unchanged.
                'intent':{'version':'intent.1','relation':'start','goal':'탈퇴 30일 뒤 계정 삭제 배치','conditions':[],'retired':[],
                          'basisRefs':[{'basisId':b['id'],'sourceId':b['sourceId'],'revision':b['revision']} for b in body['bases']]}}},ensure_ascii=False))
        self.page.route('**/api/continuity',advice)
        self.send('탈퇴 30일 뒤 계정 삭제 배치를 추가해줘.')
        self.assertIn('30일 지난 계정',self.instruction(self.page.locator('#handoff-text').input_value()))
        self.page.unroute('**/api/continuity',advice);calls=[];self.page.on('request',lambda r:calls.append(r.url) if '/api/continuity' in r.url else None)
        self.context();self.page.locator('#edit-D1').evaluate('(e)=>e.open=true');self.page.locator('#text-D1').fill('탈퇴 14일 뒤 계정 삭제')
        self.page.locator('#edit-D1 button',has_text='수정 기록').click()
        expect(self.page.locator('#stale-advice')).to_contain_text('D1')
        for label in ['before-reload','after-reload']:
            text=self.download_work(f'stale-{label}.md');part=self.instruction(text)
            self.assertNotIn('30일',part);self.assertIn('14일',text.split('## 이어갈 기준')[1]);self.assertNotIn('30일',text.split('## 이어갈 기준')[1])
            self.assertIn('이후 바뀌었습니다',text)
            if label=='before-reload':
                self.page.reload();expect(self.page.locator('#stale-advice')).to_contain_text('D1')
        self.assertEqual(calls,[]);state=self.state();self.assertEqual(state['tasks'][0]['advice']['next'],'30일 지난 계정을 삭제하는 nightly job 구현')
        self.assertTrue(all('text' not in h for h in state['tasks'][0]['handoffs']));self.assertTrue(state['tasks'][0]['handoffs'][-1]['aiExcluded'])
        self.page.locator('#edit-work').evaluate('(e)=>e.open=true');self.page.locator('#work-next').fill('14일 지난 계정을 삭제하는 nightly job 구현')
        text=self.download_work('stale-manual.md');self.assertIn('14일 지난 계정',self.instruction(text));self.assertNotIn('30일',self.instruction(text))
        self.assertEqual(self.state()['tasks'][0]['handoffs'][-1]['work']['next'],'14일 지난 계정을 삭제하는 nightly job 구현')
    @unittest.skipIf(DOM,'needs native downloads/localStorage')
    def test_10_long_use_fixtures_import_edit_export_backup_reimport(self):
        subprocess.run(['node',str(ROOT/'tests/fixtures.mjs'),str(OUT)],check=True)
        legacy=OUT/'legacy-68.json';self.assertGreater(legacy.stat().st_size,2_000_000)
        for name in ['cycles-68.json','legacy-68.json','long-54.json']:
            source=json.loads((OUT/name).read_text(encoding='utf-8'));self.import_file(OUT/name)
            expect(self.page.locator('#basis-count')).to_have_text(str(len(source['bases'])))
            state=self.state();self.assertEqual(state['schemaVersion'],'idea015.project.7');self.assertEqual(state['sources'],source['sources'])
            self.assertEqual([b['history'] for b in state['bases']],[b['history'] for b in source['bases']])
            if name=='legacy-68.json':
                expect(self.page.locator('#notice')).to_contain_text('project.1')
                self.assertEqual([h['legacyText'] for t in state['tasks'] for h in t['handoffs']],[h['text'] for t in source['tasks'] for h in t['handoffs']])
            self.compose();self.page.locator('#draft').fill(f'{name} 이후에도 계속 편집');expect(self.page.locator('#saved')).to_have_text('이 브라우저에 저장됨')
            self.basis(f'{name} 새 제약');text=self.download_work(f'{name}-work.md');self.assertIn(f'{name} 새 제약',text)
            if name=='long-54.json':
                self.assertTrue(all(b['text'] in text for b in state['bases']))
                self.page.locator('#retry-work').click();expect(self.page.locator('#working')).to_have_text('');expect(self.page.locator('#notice')).to_be_hidden()
            backup=self.backup(f'{name}-backup.json');saved=self.state();self.assertEqual(json.loads(backup.read_text(encoding='utf-8')),saved)
            self.import_file(backup);expect(self.page.locator('#basis-count')).to_have_text(str(len(saved['bases'])));self.assertEqual(self.state(),saved)
        self.assertEqual(self.page.locator('#storage-error').is_hidden(),True)
    @unittest.skipIf(DOM,'needs native routing')
    def test_11_failed_reorganisation_after_answer_does_not_duplicate_the_answer(self):
        self.send('결제가 실패하는 오류가 있는데 원인은 아직 모르겠어요.')
        def fail(route):route.fulfill(status=503,content_type='application/json',body='{"error":{"code":"AI_UNAVAILABLE"}}')
        self.page.route('**/api/continuity',fail)
        self.page.locator('#answer-draft').fill('어제 오후부터 카드 결제만 실패');self.page.locator('#answer-send').click()
        expect(self.page.locator('#notice')).to_contain_text('실패');expect(self.page.locator('#question-answered')).to_be_visible();expect(self.page.locator('#answer-send')).to_have_count(0)
        self.page.unroute('**/api/continuity',fail);self.page.locator('#retry-work').click();expect(self.page.locator('#working')).to_have_text('')
        state=self.state();self.assertEqual(len([s for s in state['sources'] if s['kind']=='answer']),1);self.assertEqual(len([b for b in state['bases'] if b['status']=='answered']),1)
    @unittest.skipIf(DOM,'needs native localStorage')
    def test_12_unreadable_saved_data_keeps_its_specific_message_while_typing(self):
        self.page.evaluate('(key)=>localStorage.setItem(key,"broken")',KEY);self.page.reload()
        self.open_listed() # FLOW083: listed as unreadable (never repaired); opening it shows the same specific message.
        expect(self.page.locator('#storage-error')).to_contain_text('읽지 못')
        self.compose();self.page.locator('#draft').fill('새 입력');expect(self.page.locator('#storage-error')).to_contain_text('읽지 못해 덮어쓰지 않고')
        self.assertEqual(self.page.evaluate('(key)=>localStorage.getItem(key)',KEY),'broken')

    @unittest.skipIf(DOM,'needs native localStorage/reload')
    def test_13_more_than_1000_items_save_and_reopen_after_reload(self):
        subprocess.run(['node',str(ROOT/'tests/fixtures.mjs'),str(OUT)],check=True)
        path=OUT/'requests-1001.json';source=json.loads(path.read_text(encoding='utf-8'));self.assertEqual(len(source['tasks']),1001)
        self.import_file(path);expect(self.page.locator('#basis-count')).to_have_text('1001')
        self.compose();self.page.locator('#draft').fill('1001개 뒤에도 저장되는 입력');expect(self.page.locator('#saved')).to_have_text('이 브라우저에 저장됨')
        self.page.reload();expect(self.page.locator('#basis-count')).to_have_text('1001');expect(self.page.locator('#storage-error')).to_be_hidden()
        expect(self.page.locator('#draft')).to_have_value('1001개 뒤에도 저장되는 입력');state=self.state();self.assertEqual(state['sources'],source['sources'])
        backup=self.backup('requests-1001-backup.json');expect(self.page.locator('#notice')).to_be_hidden()
        self.import_file(backup);expect(self.page.locator('#basis-count')).to_have_text('1001');self.assertEqual(self.state(),state)

if __name__=='__main__':unittest.main(verbosity=2)
