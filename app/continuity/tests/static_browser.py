"""One native static-build journey; no server AI/API or DOM bridge.
Server-key sentinels and the CSP fetch attempt are labelled synthetic probes.
PREVIEW35: the explicit preview build is served on the SAME origin under /agentflow-studio/preview/ and checked for
storage isolation from the existing demo (local, per-tab session, legacy backup keys). Synthetic legacy values are probes.
Run from app/ after both static builds: python continuity/tests/static_browser.py
"""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from urllib.parse import urlsplit, unquote
import hashlib, json, os, re, shutil, subprocess, tempfile, unittest
from importlib.metadata import version
from playwright.sync_api import sync_playwright, expect
import browser as base

ROOT = Path(__file__).resolve().parents[1]
OUT = base.OUT
STATIC_KEY = 'agentflow.studio.browser-demo:' + base.KEY
DEMO_PREFIX = 'agentflow.studio.browser-demo:'
PREVIEW_PREFIX = 'agentflow.studio.preview:'
PREVIEW_PATH = '/agentflow-studio/preview/'
LEGACY_BACKUP = base.KEY + '.legacy-original'
OPEN_KEY = 'agentflow.workspace.open'
# Every per-tab sessionStorage key the app uses (selection, list place, map view); each is prefixed per target.
SESSION_KEYS = {OPEN_KEY, 'agentflow.workspace.place', 'agentflow.workspace.map'}
EXPECTED_FILES = {'.nojekyll', 'index.html', 'styles.css', 'client/app.js',
                  # PREVIEW35: the build-selected target (storage prefix and short label) is one small module.
                  'client/presentation.js', 'client/runtime.js', 'client/static-target.js',
                  # SOURCE40 adds the home's proposal review (client UI, a pure shared helper and the 8-excerpt example; no network/storage).
                  'client/source-review.js', 'shared/source-proposals.js', 'shared/source-proposals-example.js',
                  *('shared/' + n + '.js' for n in
                    # GUIDE097 adds shared/guidance.js (area guidance, browser MOCK only); the network/key checks below cover it.
                    # SPATIAL102 adds shared/attention.js ('확인할 일', a pure read of the project; no network or storage).
                    ['types', 'domain', 'validation', 'storage', 'plan-facts', 'mock', 'outcome', 'guidance', 'attention', 'hierarchy'])}
PREFIXED_JS = '(p)=>Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith(p)).sort().map(k=>[k,localStorage.getItem(k)]))'


def site_files(site):
    return {str(p.relative_to(site)).replace('\\', '/') for p in site.rglob('*') if p.is_file()}


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
        # PREVIEW35: a separate copy, served at a subpath of the same origin (the demo folder itself stays unchanged).
        if not (ROOT / 'static-preview-dist' / 'index.html').is_file():
            raise RuntimeError('Run node continuity/scripts/build-static.mjs --preview first')
        cls.preview_site = Path(cls.temp.name) / 'preview-site'
        shutil.copytree(ROOT / 'static-preview-dist', cls.preview_site)
        cls.received = []

        class Handler(SimpleHTTPRequestHandler):
            def translate_path(self, path):
                route = unquote(urlsplit(path).path)
                if route.startswith(PREVIEW_PATH):
                    rest = [part for part in route[len(PREVIEW_PATH):].split('/') if part not in ('', '.', '..')]
                    return str(cls.preview_site.joinpath(*rest))
                return super().translate_path(path)

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

    def check_published(self, site):
        self.assertEqual(site_files(site), EXPECTED_FILES, 'publish only UI/shared/browser-MOCK modules')
        for p in site.rglob('*.js'):
            source = p.read_text(encoding='utf-8')
            self.assertNotRegex(source, r'\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\s*\(')
            for forbidden in ['DEEPSEEK_API_KEY', 'Authorization', '/api/', 'serviceWorker', 'api.deepseek.com']:
                self.assertNotIn(forbidden, source)
            for ref in re.findall(r'^\s*(?:import|export)\s+[^\n]*?\sfrom\s+[\'"]([^\'"]+)[\'"]', source, re.M):
                self.assertTrue(ref.startswith('./') or ref.startswith('../'))
                target = (p.parent / ref).resolve()
                self.assertTrue(target.is_relative_to(site.resolve()))
                self.assertTrue(target.is_file(), ref)
        self.assertIn("connect-src 'none'", (site / 'index.html').read_text(encoding='utf-8'))

    def test_preview_write_failure_keeps_existing_values(self):
        """PREVIEW35 narrow labelled fault injection. The prefix separates keys, NOT the origin's one localStorage quota
        (or the shared Web Lock name). Existing migration order: own legacy read -> own backup write -> own envelope write;
        no remove and no legacy overwrite. Only one preview setItem is made to throw; demo/server values stay exact."""
        code = "import fs from 'node:fs';import {cycles,toLegacy} from './continuity/tests/fixtures.mjs';fs.writeFileSync(process.argv[1],JSON.stringify(toLegacy(cycles(2))));"
        subprocess.run(['node', '--input-type=module', '-e', code, str((OUT / 'preview35-legacy-2.json').resolve())], check=True)
        legacy = json.loads((OUT / 'preview35-legacy-2.json').read_text(encoding='utf-8'))
        demo_legacy = json.dumps({**legacy, 'name': 'DEMO35 합성 이전 저장'}, ensure_ascii=False)
        preview_legacy = json.dumps({**legacy, 'name': 'PREVIEW35 합성 이전 저장'}, ensure_ascii=False)
        probes = {base.KEY: 'WEB046_SYNTHETIC_SERVER_SENTINEL', LEGACY_BACKUP: 'WEB046_SYNTHETIC_V1_BACKUP',
                  base.WORKSPACE: 'PREVIEW35_SYNTHETIC_SERVER_WORKSPACE',
                  DEMO_PREFIX + base.KEY: demo_legacy, PREVIEW_PREFIX + base.KEY: preview_legacy}
        snapshot = lambda page, keep: page.evaluate('(p)=>Object.fromEntries(Object.keys(localStorage).filter(k=>!k.startsWith(p)).sort().map(k=>[k,localStorage.getItem(k)]))', keep)
        # (key whose write throws, error name, exact backup expected, whether a new write is attempted while failing)
        cases = [(PREVIEW_PREFIX + base.WORKSPACE, 'QuotaExceededError', preview_legacy, True),
                 (PREVIEW_PREFIX + LEGACY_BACKUP, 'QuotaExceededError', None, False)]
        observed = []
        for failing, name, backup_expected, write_attempt in cases:
            with self.subTest(failing=failing):
                self.ctx = self.browser.new_context(viewport={'width': 1440, 'height': 1050})
                self.ctx.add_init_script('if(localStorage.getItem("preview35.synthetic.installed")!=="1"){for(const [k,v] of Object.entries(' + json.dumps(probes) + ')) localStorage.setItem(k,v);localStorage.setItem("preview35.synthetic.installed","1");}')
                # Labelled fault injection: only this one preview key's write throws, as a full shared quota would.
                self.ctx.add_init_script('(()=>{const key=' + json.dumps(failing) + ',name=' + json.dumps(name) + ',set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(this===window.localStorage&&k===key){document.documentElement.dataset.preview35Injected=String(Number(document.documentElement.dataset.preview35Injected||0)+1);throw new DOMException("PREVIEW35 injected",name);}return set.call(this,k,v);};})();')
                self.errors = []; self.failures = []; requests = []
                try:
                    demo = self.tab(self.url, '브라우저 MOCK · AI 아님', requests)
                    expect(demo.locator('#project-list')).to_contain_text('DEMO35 합성 이전 저장'); self.migrated(demo, DEMO_PREFIX)
                    outside = snapshot(demo, PREVIEW_PREFIX)
                    preview = self.tab(self.url + 'preview/', '미리보기 · 브라우저 MOCK · AI 아님', requests)
                    card = preview.locator('.legacy-card'); expect(card).to_contain_text('PREVIEW35 합성 이전 저장'); base.saved(preview)
                    self.assertGreaterEqual(int(preview.evaluate('document.documentElement.dataset.preview35Injected||"0"')), 1, 'the fault was hit')
                    own = preview.evaluate(PREFIXED_JS, PREVIEW_PREFIX)
                    self.assertEqual(own.get(PREVIEW_PREFIX + base.KEY), preview_legacy, 'own older value kept, never rewritten')
                    self.assertNotIn(PREVIEW_PREFIX + base.WORKSPACE, own, 'no envelope written')
                    self.assertEqual(own.get(PREVIEW_PREFIX + LEGACY_BACKUP), backup_expected, 'backup is absent or the exact original')
                    self.assertEqual(snapshot(preview, PREVIEW_PREFIX), outside, 'demo and server values unchanged')
                    expect(card).to_contain_text('읽기 전용')
                    card.locator('.project-open').click()
                    # Existing behaviour (also server/demo): the list's fresh read drops the migration's QUOTA /
                    # LEGACY_UNPRESERVED cause, so the read-only notice is the generic one. Recorded, not changed here.
                    expect(preview.locator('#storage-error')).to_contain_text('읽기 전용 자료라 저장하지 않았습니다')
                    shown = preview.locator('#storage-error').inner_text()
                    self.assertEqual(preview.evaluate(PREFIXED_JS, PREVIEW_PREFIX), own, 'opening it read-only writes nothing')
                    quota_shown = None
                    if write_attempt:
                        # One explicit new-project write while the envelope write fails: reported as QUOTA, nothing written.
                        preview.locator('#to-projects').click(); expect(preview.locator('#projects-view')).to_be_visible()
                        preview.locator('#new-project').click()
                        preview.locator('#draft').fill('PREVIEW35 저장 실패 중 새 요청'); preview.locator('#send').click()
                        expect(preview.locator('#storage-error')).to_contain_text('저장 공간이 부족'); base.saved(preview)
                        quota_shown = preview.locator('#storage-error').inner_text()
                        self.assertEqual(preview.evaluate(PREFIXED_JS, PREVIEW_PREFIX), own, 'a failed write adds or rewrites nothing')
                    self.assertEqual(snapshot(preview, PREVIEW_PREFIX), outside)
                    self.assertEqual([r for r in requests if r['method'] != 'GET' or '/api/' in r['path']], [])
                    self.assertEqual(self.failures, []); self.assertEqual(self.errors, [])
                    observed.append({'injectedKey': failing, 'error': name, 'previewBackup': 'exact original' if backup_expected else 'absent',
                                     'previewEnvelope': 'absent', 'ownLegacyKept': True, 'demoAndServerUnchanged': True,
                                     'legacyOpenShown': shown, 'newWriteShown': quota_shown})
                finally:
                    self.ctx.close()
        (OUT / 'preview35-write-failure.summary').write_text(json.dumps({
            'kind': 'labelled fault injection (one preview localStorage.setItem throws); not a real quota measurement',
            'chromium': self.browser.version, 'sharedOriginQuota': True, 'sharedWebLockName': 'agentflow.idea015.workspace',
            'cases': observed, 'actualAI': 0}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    def test_static_subpath_exchange_reload_and_isolation(self):
        self.check_published(self.site)

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


    def tab(self, url, label, requests):
        page = self.ctx.new_page()
        page.on('pageerror', lambda e: self.errors.append(str(e)))
        page.on('request', lambda r: requests.append({'method': r.method, 'path': urlsplit(r.url).path}))
        page.on('requestfailed', lambda r: self.failures.append(urlsplit(r.url).path))
        page.set_default_timeout(6000)
        page.goto(url)
        expect(page.locator('#mode')).to_have_text(label)
        return page

    def new_project(self, page, text):
        expect(page.locator('#projects-view')).to_be_visible()
        page.locator('#new-project').click()
        page.locator('#draft').fill(text); page.locator('#send').click()
        expect(page.locator('#working')).to_have_text(''); expect(page.locator('#current-work')).to_be_visible()
        base.saved(page)
        return page.evaluate('document.documentElement.dataset.entryId')

    def migrated(self, page, prefix):
        # The once-only legacy migration runs asynchronously under the Web Lock; poll its two written keys.
        import time; end = time.monotonic() + 6
        while not page.evaluate('(ks)=>ks.every(k=>localStorage.getItem(k)!==null)', [prefix + base.WORKSPACE, prefix + LEGACY_BACKUP]):
            if time.monotonic() > end: raise AssertionError('legacy migration did not finish: ' + prefix)
            page.wait_for_timeout(20)
        base.saved(page)

    def envelope(self, page, prefix):
        base.saved(page)
        return json.loads(page.evaluate('(k)=>localStorage.getItem(k)', prefix + base.WORKSPACE))

    def test_source_review_example_under_the_static_csp_writes_nothing(self):
        """SOURCE40: the published preview opens the explicit review example (excerpt hashes recomputed with WebCrypto under the
        static CSP) and closes back to the home with every key of the origin unchanged."""
        self.check_published(self.preview_site)
        ctx = self.browser.new_context(viewport={'width': 1280, 'height': 720}); errors = []
        try:
            page = ctx.new_page(); page.on('pageerror', lambda e: errors.append(str(e))); page.set_default_timeout(6000)
            page.goto(self.url.replace('/agentflow-studio/', PREVIEW_PATH)); expect(page.locator('#projects-view')).to_be_visible()
            stores = '()=>[Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]),Object.keys(sessionStorage).sort().map(k=>[k,sessionStorage.getItem(k)])]'
            before = page.evaluate(stores)
            page.locator('#proposal-review-open').click(); expect(page.locator('#source-review')).to_be_visible()
            page.locator('#sr-example').click(); expect(page.locator('#sr-notice')).to_contain_text('해시를 다시 계산해')
            expect(page.locator('#sr-side .sr-item')).to_have_count(3); page.locator('#sr-read-E01').click()
            expect(page.locator('#sr-quote')).to_contain_text('dify')
            page.keyboard.press('Escape'); expect(page.locator('#proposal-review-open')).to_be_focused()
            self.assertEqual(page.evaluate(stores), before); self.assertEqual(errors, [])
        finally:
            ctx.close()

    def test_preview_same_origin_storage_isolation(self):
        """PREVIEW35: demo and preview on one origin never read, write or swap each other's keys."""
        self.check_published(self.preview_site)
        differing = sorted(f for f in EXPECTED_FILES if (self.site / f).read_bytes() != (self.preview_site / f).read_bytes())
        self.assertEqual(differing, ['client/static-target.js'], 'only the build-selected target differs')
        for site, own, other in [(self.site, DEMO_PREFIX, PREVIEW_PREFIX), (self.preview_site, PREVIEW_PREFIX, DEMO_PREFIX)]:
            sources = ''.join(p.read_text(encoding='utf-8') for p in site.rglob('*') if p.is_file())
            self.assertIn(own, sources); self.assertNotIn(other, sources, 'no fallback to the other target')

        # A small project.1 value from the existing fixture helpers: both targets' copies must fit one origin's shared quota.
        code = "import fs from 'node:fs';import {cycles,toLegacy} from './continuity/tests/fixtures.mjs';fs.writeFileSync(process.argv[1],JSON.stringify(toLegacy(cycles(2))));"
        subprocess.run(['node', '--input-type=module', '-e', code, str((OUT / 'preview35-legacy-2.json').resolve())], check=True)
        legacy = json.loads((OUT / 'preview35-legacy-2.json').read_text(encoding='utf-8'))
        demo_legacy = json.dumps({**legacy, 'name': 'DEMO35 합성 이전 저장'}, ensure_ascii=False)
        preview_legacy = json.dumps({**legacy, 'name': 'PREVIEW35 합성 이전 저장'}, ensure_ascii=False)
        probes = {base.KEY: 'WEB046_SYNTHETIC_SERVER_SENTINEL',
                  LEGACY_BACKUP: 'WEB046_SYNTHETIC_V1_BACKUP',
                  'agentflow.idea015.project.v2.legacy-original': 'WEB046_SYNTHETIC_V2_BACKUP',
                  base.WORKSPACE: 'PREVIEW35_SYNTHETIC_SERVER_WORKSPACE',
                  DEMO_PREFIX + base.KEY: demo_legacy, PREVIEW_PREFIX + base.KEY: preview_legacy}
        server_keys = [k for k in probes if not k.startswith(('agentflow.studio.'))]
        self.ctx = self.browser.new_context(viewport={'width': 1440, 'height': 1050}, accept_downloads=True)
        self.ctx.add_init_script('if(localStorage.getItem("preview35.synthetic.installed")!=="1"){for(const [k,v] of Object.entries(' + json.dumps(probes) + ')) localStorage.setItem(k,v);localStorage.setItem("preview35.synthetic.installed","1");}')
        self.errors = []; self.failures = []; demo_requests = []; preview_requests = []
        demo_url, preview_url = self.url, self.url + 'preview/'
        demo_label, preview_label = '브라우저 MOCK · AI 아님', '미리보기 · 브라우저 MOCK · AI 아님'
        prefixed = lambda page, p: page.evaluate(PREFIXED_JS, p)
        try:
            demo = self.tab(demo_url, demo_label, demo_requests)
            # Each target migrates only its own older value once; the older key itself is never written.
            expect(demo.locator('#project-list .project-card')).to_have_count(1)
            expect(demo.locator('#project-list')).to_contain_text('DEMO35 합성 이전 저장'); self.migrated(demo, DEMO_PREFIX)
            demo_keys = prefixed(demo, DEMO_PREFIX)
            self.assertEqual(sorted(demo_keys), sorted(DEMO_PREFIX + k for k in [base.KEY, LEGACY_BACKUP, base.WORKSPACE]))
            self.assertEqual(demo_keys[DEMO_PREFIX + LEGACY_BACKUP], demo_legacy)
            self.assertEqual(prefixed(demo, PREVIEW_PREFIX), {PREVIEW_PREFIX + base.KEY: preview_legacy}, 'opening the demo never touches preview keys')
            demo_entry = self.new_project(demo, 'DEMO35 합성 요청: 예약 확정 문구만 바꿔줘.')
            demo_after_create = prefixed(demo, DEMO_PREFIX)

            preview = self.tab(preview_url, preview_label, preview_requests)
            expect(preview.locator('#project-list .project-card')).to_have_count(1)
            expect(preview.locator('#project-list')).to_contain_text('PREVIEW35 합성 이전 저장')
            expect(preview.locator('#project-list')).not_to_contain_text('DEMO35'); self.migrated(preview, PREVIEW_PREFIX)
            self.assertEqual(prefixed(preview, PREVIEW_PREFIX)[PREVIEW_PREFIX + LEGACY_BACKUP], preview_legacy)
            self.assertEqual(prefixed(preview, DEMO_PREFIX), demo_after_create, 'the preview neither reads into nor copies the demo')
            first = self.new_project(preview, 'PREVIEW35 합성 요청 1: 대기자 알림 문구')
            preview.locator('#to-projects').click()
            second = self.new_project(preview, 'PREVIEW35 합성 요청 2: 문의 접수 화면')
            self.assertEqual(prefixed(preview, DEMO_PREFIX), demo_after_create)

            # Per-tab selection: a second preview tab opens another project; each tab keeps its own after reloads.
            other = self.tab(preview_url, preview_label, preview_requests)
            expect(other.locator('#project-list .project-card')).to_have_count(3)
            other.locator(f'.project-card[data-entry-id="{first}"] .project-open').click()
            expect(other.locator('#current-work')).to_be_visible()
            for page, entry, label in [(demo, demo_entry, demo_label), (preview, second, preview_label), (other, first, preview_label)]:
                page.reload(); expect(page.locator('#mode')).to_have_text(label)
                expect(page.locator('#current-work')).to_be_visible()
                self.assertEqual(page.evaluate('document.documentElement.dataset.entryId'), entry)
            for page, entry, prefix in [(demo, demo_entry, DEMO_PREFIX), (preview, second, PREVIEW_PREFIX), (other, first, PREVIEW_PREFIX)]:
                session_keys = set(page.evaluate('Object.keys(sessionStorage)'))
                self.assertIn(prefix + OPEN_KEY, session_keys)
                self.assertLessEqual(session_keys, {prefix + k for k in SESSION_KEYS}, 'per-tab keys carry only this target prefix')
                self.assertEqual(page.evaluate('(k)=>sessionStorage.getItem(k)', prefix + OPEN_KEY), entry)

            # Interleaved saves on one origin: no conflict notice and no change to the other target's bytes.
            before_preview = prefixed(demo, PREVIEW_PREFIX)
            demo.locator('#project-name').fill('DEMO35 이름 직접 수정'); base.saved(demo)
            self.assertEqual(prefixed(demo, PREVIEW_PREFIX), before_preview)
            before_demo = prefixed(preview, DEMO_PREFIX)
            preview.locator('#project-name').fill('PREVIEW35 이름 직접 수정'); base.saved(preview)
            other.locator('#project-name').fill('PREVIEW35 다른 탭 이름'); base.saved(other)
            self.assertEqual(prefixed(preview, DEMO_PREFIX), before_demo)
            for page in [demo, preview, other]:
                expect(page.locator('#storage-error')).to_be_hidden()
                page.reload(); expect(page.locator('#current-work')).to_be_visible()
            self.assertEqual(demo.locator('#project-name').input_value(), 'DEMO35 이름 직접 수정')
            self.assertEqual(preview.locator('#project-name').input_value(), 'PREVIEW35 이름 직접 수정')
            self.assertEqual(other.locator('#project-name').input_value(), 'PREVIEW35 다른 탭 이름')
            demo_env, preview_env = self.envelope(demo, DEMO_PREFIX), self.envelope(preview, PREVIEW_PREFIX)
            self.assertEqual([(e['origin'], e['project']['name']) for e in demo_env['entries']],
                             [('legacy', 'DEMO35 합성 이전 저장'), ('new', 'DEMO35 이름 직접 수정')])
            self.assertEqual([(e['origin'], e['project']['name']) for e in preview_env['entries']],
                             [('legacy', 'PREVIEW35 합성 이전 저장'), ('new', 'PREVIEW35 다른 탭 이름'), ('new', 'PREVIEW35 이름 직접 수정')])

            # The only way across: an explicit backup file from the demo, imported in the preview as a new copy.
            self.page = demo
            backup = self.backup('preview35-demo-backup.json')
            demo_before_import = prefixed(demo, DEMO_PREFIX)
            self.page = preview
            preview.locator('#to-projects').click(); self.compose()
            self.import_file(backup)
            imported = self.envelope(preview, PREVIEW_PREFIX)['entries'][-1]
            self.assertEqual(imported['origin'], 'import')
            self.assertEqual(imported['project']['name'], 'DEMO35 이름 직접 수정')
            self.assertEqual(json.dumps(imported['project'], ensure_ascii=False, sort_keys=True),
                             json.dumps(json.loads(backup.read_text(encoding='utf-8')), ensure_ascii=False, sort_keys=True))
            self.assertEqual(prefixed(preview, DEMO_PREFIX), demo_before_import, 'importing never writes the demo')
            demo.reload(); demo.locator('#to-projects').click()
            expect(demo.locator('#project-list .project-card')).to_have_count(2)

            # Older keys are read once, never written; server-mode keys stay untouched by both targets.
            final = demo.evaluate('()=>Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)]))')
            for k in server_keys + [DEMO_PREFIX + base.KEY, PREVIEW_PREFIX + base.KEY]:
                self.assertEqual(final[k], probes[k], k)
            self.assertEqual(final[DEMO_PREFIX + LEGACY_BACKUP], demo_legacy)
            self.assertEqual(final[PREVIEW_PREFIX + LEGACY_BACKUP], preview_legacy)
            allowed = set(probes) | {'preview35.synthetic.installed'} | {p + k for p in [DEMO_PREFIX, PREVIEW_PREFIX] for k in [LEGACY_BACKUP, base.WORKSPACE]}
            self.assertEqual(set(final), allowed, 'no other key is written')

            for width in [1280, 1440]:
                preview.set_viewport_size({'width': width, 'height': 900})
                if not preview.locator('#projects-view').is_visible(): preview.locator('#to-projects').click()
                expect(preview.locator('#projects-view')).to_be_visible(); expect(preview.locator('#mode')).to_be_visible()
                self.assertLessEqual(preview.evaluate('document.documentElement.scrollWidth'), width)
                preview.screenshot(path=str(OUT / f'preview35-projects-{width}.png'))
            # Subpath imports stay inside each target; no API or non-GET request from either.
            self.assertTrue(preview_requests and all(r['method'] == 'GET' and r['path'].startswith(PREVIEW_PATH) for r in preview_requests), preview_requests)
            self.assertTrue(demo_requests and all(r['method'] == 'GET' and r['path'].startswith('/agentflow-studio/') and not r['path'].startswith(PREVIEW_PATH) for r in demo_requests), demo_requests)
            self.assertEqual([r for r in self.received if '/api/' in r['path'] or r['method'] != 'GET'], [])
            self.assertEqual(self.failures, []); self.assertEqual(self.errors, [])
            (OUT / 'preview35-isolation.summary').write_text(json.dumps({
                'transport': 'native Chromium -> one static HTTP origin; demo /agentflow-studio/, preview ' + PREVIEW_PATH + '; browser MOCK, AI0',
                'playwright': version('playwright'), 'chromium': self.browser.version,
                'demoPrefix': DEMO_PREFIX, 'previewPrefix': PREVIEW_PREFIX,
                'differingFiles': differing, 'tabs': {'demo': 1, 'preview': 2},
                'demoRequests': len(demo_requests), 'previewRequests': len(preview_requests), 'ordinaryAPIRequests': 0,
                'syntheticProbes': ['server-key sentinels', 'per-target synthetic legacy project.1 values'],
                'explicitBackupImport': True, 'viewportWidths': [1280, 1440], 'actualAI': 0
            }, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        finally:
            self.ctx.close()


if __name__ == '__main__':
    unittest.main(verbosity=2)
