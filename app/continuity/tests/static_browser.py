"""One native static-build journey; no server AI/API or DOM bridge.
Server-key sentinels and the CSP fetch attempt are labelled synthetic probes.
Run from app/: python continuity/tests/static_browser.py
"""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from urllib.parse import urlsplit
import hashlib, json, os, re, shutil, subprocess, tempfile, unittest
from importlib.metadata import version
from playwright.sync_api import sync_playwright, expect
import browser as base

ROOT = Path(__file__).resolve().parents[1]
OUT = base.OUT
STATIC_KEY = 'agentflow.studio.browser-demo:' + base.KEY


class StaticWeb(unittest.TestCase):
    compose = base.Browser.compose
    send = base.Browser.send
    download_work = base.Browser.download_work
    backup = base.Browser.backup
    import_file = base.Browser.import_file

    @classmethod
    def setUpClass(cls):
        if base.DOM:
            raise RuntimeError('Static verification requires native HTTP/localStorage')
        cls.temp = tempfile.TemporaryDirectory(prefix='web046-static-')
        site = Path(cls.temp.name) / 'agentflow-studio'
        shutil.copytree(ROOT / 'static-dist', site)
        cls.site = site
        cls.received = []

        class Handler(SimpleHTTPRequestHandler):
            def do_GET(self):
                cls.received.append({'method': 'GET', 'path': urlsplit(self.path).path})
                super().do_GET()

            def do_POST(self):
                cls.received.append({'method': 'POST', 'path': urlsplit(self.path).path})
                self.send_error(405)

            def log_message(self, *_):
                pass

        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=cls.temp.name))
        cls.thread = Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = 'http://127.0.0.1:' + str(cls.server.server_port) + '/agentflow-studio/'
        cls.pw = sync_playwright().start()
        options = {'headless': True}
        if os.environ.get('BROWSER_EXECUTABLE'):
            options['executable_path'] = os.environ['BROWSER_EXECUTABLE']
        try:
            cls.browser = cls.pw.chromium.launch(**options)
        except Exception:
            cls.server.shutdown(); cls.server.server_close(); cls.temp.cleanup(); cls.pw.stop()
            raise

    @classmethod
    def tearDownClass(cls):
        cls.browser.close(); cls.pw.stop()
        cls.server.shutdown(); cls.server.server_close(); cls.thread.join(); cls.temp.cleanup()

    def state(self, page=None):
        # FLOW083: the project this tab has open, from the (prefixed) workspace envelope.
        return base.read_state(page or self.page, 'agentflow.studio.browser-demo:')

    def test_static_subpath_exchange_reload_and_isolation(self):
        expected_files = {'.nojekyll', 'index.html', 'styles.css', 'client/app.js',
                          'client/presentation.js', 'client/runtime.js',
                          *('shared/' + n + '.js' for n in
                            # GUIDE097 adds shared/guidance.js (area guidance, browser MOCK only); the network/key checks below cover it.
                            ['types', 'domain', 'validation', 'storage', 'plan-facts', 'mock', 'outcome', 'guidance'])}
        files = {str(p.relative_to(self.site)).replace('\\', '/') for p in self.site.rglob('*') if p.is_file()}
        self.assertEqual(files, expected_files, 'publish only UI/shared/browser-MOCK modules')
        for p in self.site.rglob('*.js'):
            source = p.read_text(encoding='utf-8')
            self.assertNotRegex(source, r'\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\s*\(')
            for forbidden in ['DEEPSEEK_API_KEY', 'Authorization', '/api/', 'serviceWorker', 'api.deepseek.com']:
                self.assertNotIn(forbidden, source)
            for ref in re.findall(r'^\s*(?:import|export)\s+[^\n]*?\sfrom\s+[\'"]([^\'"]+)[\'"]', source, re.M):
                self.assertTrue(ref.startswith('./') or ref.startswith('../'))
                target = (p.parent / ref).resolve()
                self.assertTrue(target.is_relative_to(self.site.resolve()))
                self.assertTrue(target.is_file(), ref)
        self.assertIn("connect-src 'none'", (self.site / 'index.html').read_text(encoding='utf-8'))

        sentinels = {base.KEY: 'WEB046_SYNTHETIC_SERVER_SENTINEL',
                     base.KEY + '.legacy-original': 'WEB046_SYNTHETIC_V1_BACKUP',
                     'agentflow.idea015.project.v2.legacy-original': 'WEB046_SYNTHETIC_V2_BACKUP'}
        self.ctx = self.browser.new_context(viewport={'width': 1440, 'height': 1050}, accept_downloads=True,
                                            permissions=['clipboard-read', 'clipboard-write'])
        self.errors = []; requests = []; failures = []
        self.page = self.ctx.new_page()
        self.page.on('pageerror', lambda e: self.errors.append(str(e)))
        self.page.on('request', lambda r: requests.append({'method': r.method, 'path': urlsplit(r.url).path}))
        self.page.on('requestfailed', lambda r: failures.append(urlsplit(r.url).path))
        self.page.add_init_script('if(localStorage.getItem("web046.synthetic.sentinels-installed")!=="1"){for(const [k,v] of Object.entries(' + json.dumps(sentinels) + ')) localStorage.setItem(k,v);localStorage.setItem("web046.synthetic.sentinels-installed","1");}')
        self.page.set_default_timeout(6000)
        try:
            self.page.goto(self.url)
            expect(self.page.locator('#mode')).to_have_text('브라우저 MOCK · AI 아님')
            self.assertEqual(self.page.locator('#consent-area').count(), 0)
            self.send('빈자리가 생기면 대기자를 자동으로 예약해줘.')
            origin = self.state()['sources'][0]['id']
            expect(self.page.locator('#outcome-home')).to_have_attribute('data-outcome-id', origin)
            expect(self.page.locator('#question-box')).to_be_visible()
            expect(self.page.locator('.option-button')).to_have_count(2)
            self.page.locator('.option-button', has_text='참여 확인 뒤 확정').click()
            expect(self.page.locator('#question-box')).to_have_count(0)
            self.assertEqual(self.state()['sources'][-1]['kind'], 'answer')
            self.page.locator('#edit-work').evaluate('(e)=>e.open=true')
            self.page.locator('#work-scope').fill('사용자가 직접 보존한 합성 범위')
            task = self.state()['currentTaskId']
            self.assertEqual(self.state()['tasks'][-1]['manual']['scope'], '사용자가 직접 보존한 합성 범위')
            self.page.locator('#copy-work').click()
            self.assertIn('사용자가 직접 보존한 합성 범위', self.page.evaluate('navigator.clipboard.readText()'))
            self.assertIn('사용자가 직접 보존한 합성 범위', self.download_work('static-handoff.md'))
            self.page.locator('#file-return-options').evaluate('(e)=>e.open=true')
            with self.page.expect_download() as download:
                self.page.locator('#download-file-work').click()
            handoff = OUT / 'static-file-handoff.md'; download.value.save_as(handoff)
            before = self.state(); export = before['tasks'][-1]['handoffs'][-1]
            self.assertIn(export['returnId'], handoff.read_text(encoding='utf-8'))
            project_file = self.backup('static-before-result.json')
            result_file = OUT / 'static-result.json'
            # Reuse the existing synthetic fileFor fixture with state made by UI, not injected project JSON.
            code = "import fs from 'node:fs';import {fileFor} from './continuity/tests/connect039-fixtures.mjs';const p=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));const t=p.tasks.at(-1);fs.writeFileSync(process.argv[2],JSON.stringify(fileFor(p,t.id,t.handoffs.at(-1).returnId),null,2)+'\\n');"
            subprocess.run(['node', '--input-type=module', '-e', code, str(project_file.resolve()), str(result_file.resolve())], check=True)
            raw = result_file.read_text(encoding='utf-8')
            self.compose()
            if not self.page.locator('#result-file-panel').evaluate('(e)=>e.open'):
                self.page.locator('#result-file-panel > summary').click()
            self.page.locator('#result-file-input').set_input_files(str(result_file))
            expect(self.page.locator('#result-file-preview')).to_have_attribute('data-return-id', export['returnId'])
            self.assertEqual(self.state(), before)
            self.page.locator('#accept-result-file').click()
            after = self.state()
            self.assertEqual(after['tasks'][-1]['parentTaskId'], task)
            self.assertEqual(after['tasks'][-1]['resultFile']['rawText'], raw)
            self.assertEqual(after['tasks'][:-1], before['tasks'])
            self.assertEqual(after['bases'], before['bases'])
            self.assertEqual(self.page.evaluate('(keys)=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]))', list(sentinels)), sentinels)
            backup = self.backup('static-after-result.json')
            self.assertEqual(json.loads(backup.read_text(encoding='utf-8')), after)
            self.page.reload(); expect(self.page.locator('#mode')).to_have_text('브라우저 MOCK · AI 아님')
            self.assertEqual(self.state(), after)
            self.compose(); self.page.locator('#draft').fill('복구로 되돌릴 합성 초안')
            self.import_file(backup)
            self.assertEqual(self.state(), after)
            for width, name in [(1440, 'static-desktop.png'), (390, 'static-narrow.png')]:
                expect(self.page.locator('#outcome-home')).to_have_attribute('data-outcome-id', origin)
                self.page.set_viewport_size({'width': width, 'height': 1050 if width == 1440 else 844})
                self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), width)
                self.page.screenshot(path=str(OUT / name), full_page=True)
            self.assertEqual(self.page.evaluate('(keys)=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]))', list(sentinels)), sentinels)
            ordinary = list(requests)
            self.assertEqual([r for r in ordinary if r['method'] != 'GET' or '/api/' in r['path']], [])
            self.assertEqual(failures, [])
            # Explicit CSP probe, separated from ordinary customer traffic. No fetch replacement.
            blocked = self.page.evaluate("async()=>{try{await fetch('./api/web046-csp-probe');return false}catch{return true}}")
            self.assertTrue(blocked)
            self.assertEqual([r for r in self.received if '/api/' in r['path'] or r['method'] != 'GET'], [])
            self.assertEqual(self.errors, [])
            (OUT / 'static-result.json.summary').write_text(json.dumps({
                'transport': 'native Chromium -> static HTTP /agentflow-studio/; browser MOCK, AI0',
                'playwright': version('playwright'), 'chromium': self.browser.version,
                'ordinaryRequests': ordinary, 'ordinaryAPIRequests': 0, 'serverAPIReceived': 0,
                'syntheticProbes': ['server/legacy-key sentinels', 'CSP-blocked fetch'],
                'serverStorageUnchanged': True, 'importClosure': True, 'providerPromptFiles': False,
                'exactResultParent': task, 'rawResultSHA256': hashlib.sha256(raw.encode()).hexdigest(),
                'backupReloadImportEqual': True, 'viewportWidths': [1440, 390], 'actualAI': 0
            }, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        finally:
            self.ctx.close()


if __name__ == '__main__':
    unittest.main(verbosity=2)
