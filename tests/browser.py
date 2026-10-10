"""Real Chromium + local HTTP integration; all AI responses are MOCKS.
Run after npm run build. Set BROWSER_EXECUTABLE only for an already installed
browser. CI uses the pinned Playwright browser. No external service is contacted.
"""
from __future__ import annotations
import json
import base64
import asyncio
import re
import urllib.request
import urllib.error
import os
from pathlib import Path
import subprocess
import time
import unittest
from importlib.metadata import version
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / os.getenv('EVIDENCE_DIR','test-results')
OUT.mkdir(exist_ok=True)
VERSIONS = {}

class BrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw = sync_playwright().start()
        options = {'headless': True}
        if os.getenv('BROWSER_EXECUTABLE'):
            options['executable_path'] = os.environ['BROWSER_EXECUTABLE']
        cls.browser = cls.pw.chromium.launch(**options)
        VERSIONS.update(playwright_python=version('playwright'), chromium=cls.browser.version,
                        transport=os.getenv('BROWSER_TRANSPORT','direct-http'),
                        browser_executable=os.getenv('BROWSER_EXECUTABLE', 'Playwright bundled Chromium'),
                        verification='Compiled UI + local HTTP; dom-bridge mode mocks browser fetch, not a real browser network integration; all AI responses simulated')

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()
        (OUT/'browser-environment.json').write_text(json.dumps(VERSIONS,ensure_ascii=False,indent=2))

    def setUp(self):
        self.processes = []
        self.context = self.browser.new_context(viewport={'width': 1360, 'height': 960})
        self.page = self.context.new_page()
        self.page.set_default_timeout(5000)
        self.errors = []
        self.http_responses = []
        self.page.on('response', lambda response: self.http_responses.append((response.url, response.status)))
        self.page.on('pageerror', lambda e: self.errors.append(str(e)))
        # Block unexpected external requests, including accidental AI provider calls.
        self.external = []
        def route(r):
            if r.request.url.startswith(('http://127.0.0.1:', 'http://localhost:')):
                r.continue_()
            else:
                self.external.append(r.request.url)
                r.abort()
        self.context.route('**/*', route)

    def tearDown(self):
        self.context.close()
        for p in self.processes:
            p.terminate()
            try: p.wait(timeout=3)
            except subprocess.TimeoutExpired: p.kill(); p.wait()
        for p in self.processes:
            p.stdout.close(); p.stderr.close()
        self.assertEqual(self.errors, [])
        self.assertEqual(self.external, [])

    def launch(self, scenario='mock'):
        env = {k: os.environ[k] for k in ['PATH','HOME','SYSTEMROOT','TMPDIR'] if k in os.environ}
        proc = subprocess.Popen(['node','tests/browser-server.mjs',scenario],cwd=ROOT,env=env,
                                stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        self.processes.append(proc)
        url = proc.stdout.readline().strip().removeprefix('TEST_URL=')
        self.assertTrue(url.startswith('http://127.0.0.1:'))
        if os.getenv('BROWSER_TRANSPORT') == 'dom-bridge':
            # Offline UI verification without changing browser policy. DOM and JS are
            # loaded from build files; fetch is mocked through a Python->local HTTP
            # bridge. This does NOT verify browser navigation, CSP or same-origin IO.
            def api_sync(path, init):
                if path not in ['/api/config','/api/interview']:
                    raise ValueError('Unexpected test request')
                headers = {**init.get('headers', {}), 'Origin': url}
                body = init.get('body')
                req = urllib.request.Request(url+path, data=body.encode() if body else None,
                                             headers=headers, method=init.get('method','GET'))
                try:
                    with urllib.request.urlopen(req, timeout=5) as response:
                        return {'status':response.status,'body':response.read().decode()}
                except urllib.error.HTTPError as error:
                    return {'status':error.code,'body':error.read().decode()}
            async def api(path, init):
                return await asyncio.to_thread(api_sync,path,init)
            self.page.expose_function('__test_local_api',api)
            self.page.evaluate("""() => {
              // about:blank is not a secure context; deterministic UUID shim is test-only.
              let sequence = 0;
              crypto.randomUUID = () => '00000000-0000-4000-8000-' + String(++sequence).padStart(12,'0');
              window.fetch = async (path, init = {}) => {
                const data = await window.__test_local_api(String(path), {
                  method: init.method || 'GET', headers: init.headers || {}, body: init.body || null
                });
                return new Response(data.body, {status:data.status,headers:{'Content-Type':'application/json'}});
            }; }""")
            html = (ROOT/'dist/public/index.html').read_text()
            html = re.sub(r'<script.*?</script>', '', html, flags=re.S)
            html = re.sub(r'<link rel="stylesheet"[^>]*>', '', html)
            self.page.set_content(html)
            self.page.add_style_tag(content=(ROOT/'dist/public/styles.css').read_text())
            cache = {}
            def module_uri(path):
                path = path.resolve()
                if path in cache: return cache[path]
                text = path.read_text()
                pattern = r"(from\s+['\"])(\.[^'\"]+)(['\"])"
                def replace(match):
                    return match[1]+module_uri(path.parent/match[2])+match[3]
                text = re.sub(pattern, replace, text)
                uri = 'data:text/javascript;base64,' + base64.b64encode(text.encode()).decode()
                cache[path] = uri
                return uri
            entry = module_uri(ROOT/'dist/public/client/app.js')
            self.page.add_script_tag(type='module',content='import '+json.dumps(entry)+';')
        else:
            self.page.goto(url)
        expect(self.page.locator('#start')).to_be_enabled()
        if scenario != 'mock': self.page.locator('#consent').check()
        return url

    def start(self, idea='나만 쓸 개인 할 일 서비스. 할 일을 등록하고 완료 표시를 하고 싶다.'):
        self.page.locator('#idea').fill(idea)
        self.page.locator('#tools').select_option('codex-only')
        self.page.locator('#start').click()

    def test_B01_real_mock_flow_browser_only_confirm_and_edit(self):
        self.launch()
        self.page.screenshot(path=str(OUT/'01-basic.png'),full_page=True)
        self.start()
        expect(self.page.locator('.option')).to_have_count(2)
        self.page.locator('#conversation').screenshot(path=str(OUT/'02-question.png'))
        self.page.get_by_role('button',name='이 브라우저 한 곳에서만',exact=False).click()
        storage = self.page.locator('[data-requirement-id$=":REQ-storage"]')
        expect(storage).to_contain_text('동기화는 첫 범위에서 제외')
        expect(self.page.locator('#conversation .option')).to_have_count(0)
        proposal = self.page.locator('[data-requirement-id$="REQ-proposal-core-flow"]')
        expect(proposal).to_have_attribute('data-status','proposed')
        proposal.get_by_role('button',name='이 요구 확인').click()
        expect(proposal).to_have_attribute('data-status','confirmed')
        proposal.get_by_role('button',name='직접 수정').click()
        proposal.locator('textarea').fill('고객이 수정한 할 일의 등록 및 완료 요구')
        proposal.get_by_role('button',name='수정 내용 확인').click()
        expect(proposal).to_contain_text('고객이 수정한')
        self.page.locator('#summary').screenshot(path=str(OUT/'03-summary-local.png'))
        self.page.locator('#start').click()
        expect(self.page.locator('#start')).to_be_enabled()
        expect(proposal).to_contain_text('고객이 수정한')
        expect(self.page.locator('#mode')).to_contain_text('실제 AI 호출·비용은 없습니다')

    def test_B02_multi_device_changes_requirement_not_studio(self):
        self.launch(); self.start()
        self.page.get_by_role('button',name='여러 기기에서 이어서',exact=False).click()
        storage=self.page.locator('[data-requirement-id$=":REQ-storage"]')
        expect(storage).to_contain_text('설계할 서비스는 여러 기기')
        expect(self.page.locator('#summary')).to_contain_text('접근 제어')
        expect(self.page.locator('#summary')).to_contain_text('Studio 자체의 클라우드 동기화')
        self.page.locator('#summary').screenshot(path=str(OUT/'04-summary-multi.png'))

    def test_B03_unknown_is_deferred_not_confirmed(self):
        self.launch(); self.start()
        self.page.get_by_role('button',name='잘 모르겠어요',exact=True).click()
        storage=self.page.locator('[data-requirement-id$=":REQ-storage"]')
        expect(storage).to_have_attribute('data-status','deferred')
        expect(self.page.locator('#summary')).to_contain_text('보류를 브라우저 저장 동의로 처리하지 않았습니다')

    def test_B04_server_invalid_response_keeps_customer_answer_and_input(self):
        self.launch('invalid-after-question'); self.start()
        self.page.get_by_role('button',name='여러 기기에서 이어서',exact=False).click()
        expect(self.page.locator('#error')).to_contain_text('덮어쓰지 않았습니다')
        expect(self.page.locator('#idea')).to_have_value('나만 쓸 개인 할 일 서비스. 할 일을 등록하고 완료 표시를 하고 싶다.')
        expect(self.page.locator('[data-requirement-id$=":REQ-storage"]')).to_contain_text('여러 기기')
        self.page.screenshot(path=str(OUT/'05-invalid-response.png'),full_page=True)

    def test_B05_missing_key_no_fallback(self):
        self.launch('missing-key'); self.start()
        expect(self.page.locator('#error')).to_contain_text('모의 응답으로 바꾸지 않았습니다')
        expect(self.page.locator('#idea')).not_to_have_value('')
        expect(self.page.locator('#conversation .option')).to_have_count(0)
        expect(self.page.locator('#mode')).to_contain_text('서버 키 미설정')

    def test_B06_edit_during_pending_response_rejects_old_data(self):
        self.launch('delayed'); self.start()
        expect(self.page.locator('#cancel')).to_be_visible()
        self.page.locator('#idea').fill('수정한 새 프로젝트 구상')
        self.page.wait_for_timeout(1100)  # wait beyond injected 700ms transport delay
        expect(self.page.locator('#idea')).to_have_value('수정한 새 프로젝트 구상')
        expect(self.page.locator('#conversation .option')).to_have_count(0)
        expect(self.page.locator('#summary')).to_be_hidden()
        expect(self.page.locator('#start')).to_be_enabled()

    def test_B07_mobile_custom_answer_and_text_rendering(self):
        self.page.set_viewport_size({'width':390,'height':844})
        self.launch(); self.start()
        self.page.locator('#custom-answer').fill('오프라인을 먼저 원해요. <img src=x onerror=alert(1)>')
        self.page.get_by_role('button',name='직접 답변하고 요약 보기').click()
        storage=self.page.locator('[data-requirement-id$=":REQ-storage"]')
        expect(storage).to_have_attribute('data-status','proposed')
        expect(storage).to_contain_text('<img src=x')
        self.assertEqual(self.page.locator('#summary img').count(),0)
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth > innerWidth'))
        self.page.screenshot(path=str(OUT/'06-mobile.png'),full_page=True)

    def test_B08_known_storage_is_not_asked_again_in_explicit_mock(self):
        self.launch(); self.start('나만 쓸 개인 할 일. 여러 기기에서 사용할 예정이다.')
        expect(self.page.locator('#summary')).to_be_visible()
        expect(self.page.locator('#conversation .option')).to_have_count(0)
        expect(self.page.locator('[data-requirement-id$="REQ-proposal-data-scope"]')).to_have_attribute('data-status','proposed')

    def test_B09_manual_edit_buffer_survives_late_response(self):
        self.launch('delayed'); self.start()
        proposal=self.page.locator('[data-requirement-id$="REQ-proposal-core-flow"]')
        expect(proposal).to_be_visible()
        self.page.locator('#start').click()
        expect(self.page.locator('#cancel')).to_be_visible()
        proposal.get_by_role('button',name='직접 수정').click()
        proposal.locator('textarea').fill('아직 확인하지 않은 수동 수정 초안')
        self.page.wait_for_timeout(1100)
        expect(proposal.locator('textarea')).to_have_value('아직 확인하지 않은 수동 수정 초안')
        expect(self.page.locator('#start')).to_be_disabled()
        proposal.get_by_role('button',name='수정 내용 확인').click()
        expect(proposal).to_contain_text('아직 확인하지 않은 수동 수정 초안')
        expect(proposal).to_have_attribute('data-status','confirmed')

    def test_B10_tool_reversion_and_undecided_current_requirement(self):
        self.launch(); self.start('동네 가게 비교 서비스')
        req = self.page.locator('[data-requirement-id$=":REQ-tools"]')
        expect(req).to_contain_text('Codex만')
        self.page.locator('#tools').select_option('claude-only')
        expect(req).to_contain_text('Claude만')
        self.page.locator('#start').click()
        expect(self.page.locator('#start')).to_be_enabled()
        self.page.locator('#tools').select_option('codex-only')
        self.page.locator('#start').click()
        expect(self.page.locator('#start')).to_be_enabled()
        expect(req).to_contain_text('Codex만')
        expect(req).to_have_attribute('data-status','confirmed')
        self.page.locator('#tools').select_option('undecided')
        expect(req).to_have_attribute('data-status','deferred')
        expect(req).to_contain_text('개발 도구는 미정')

    def test_B11_generic_answer_refines_requirement_not_only_summary(self):
        self.launch(); self.start('동네 가게 비교 서비스')
        req = self.page.locator('[data-requirement-id$="REQ-proposal-core-flow"]')
        expect(req).to_contain_text('TBD')
        original_id = req.get_attribute('data-requirement-id')
        self.page.get_by_role('button',name='내용을 기록하고 다시 확인하기',exact=False).click()
        expect(req).to_contain_text('첫 핵심 장면을 구현한다: 내용을 기록하고 다시 확인하기')
        expect(req).to_contain_text('내용을 입력해 보관한 뒤 다시 조회')
        expect(req).to_have_attribute('data-status','proposed')
        self.assertEqual(req.get_attribute('data-requirement-id'), original_id)
        req.locator('summary').click()
        expect(req).to_contain_text('customer-answer')

    def test_B12_long_answer_failure_then_edit_and_retry_keeps_original(self):
        self.launch('recover-after-question'); self.start()
        raw = '가' * 1500
        self.page.locator('#custom-answer').fill(raw)
        self.page.get_by_role('button',name='직접 답변하고 요약 보기').click()
        expect(self.page.locator('#error')).to_contain_text('덮어쓰지 않았습니다')
        expect(self.page.locator('.source-summary')).to_contain_text(raw)
        storage=self.page.locator('[data-requirement-id$=":REQ-storage"]')
        expect(storage).to_contain_text('전체 보존')
        self.page.get_by_role('button',name='답변 수정',exact=True).click()
        expect(self.page.locator('#edit-answer')).to_have_value(raw)
        self.page.locator('#edit-answer').fill('동료와 공유하되 집에서는 오프라인으로 본다.')
        self.page.get_by_role('button',name='답변 수정 후 요약 다시 요청').click()
        expect(self.page.locator('#start')).to_be_enabled()
        expect(self.page.locator('#error')).to_be_hidden()
        expect(storage).to_contain_text('오프라인')
        storage.locator('summary').click()
        expect(storage).to_contain_text(raw)

    def test_B13_invalid_custom_answer_is_editable_without_loss(self):
        self.launch(); self.start()
        raw = '나' * 1501
        self.page.locator('#custom-answer').fill(raw)
        self.page.get_by_role('button',name='직접 답변하고 요약 보기').click()
        expect(self.page.locator('#error')).to_contain_text('1,500자')
        expect(self.page.locator('#custom-answer')).to_have_value(raw)
        self.page.locator('#custom-answer').fill('나' * 1500)
        self.page.get_by_role('button',name='직접 답변하고 요약 보기').click()
        expect(self.page.locator('#start')).to_be_enabled()
        expect(self.page.locator('#error')).to_be_hidden()
        expect(self.page.locator('[data-requirement-id$=":REQ-storage"]')).to_contain_text('전체 보존')

    def test_B14_locked_tool_conflict_is_visible_and_cannot_be_dismissed_by_confirmation(self):
        self.launch(); self.start('동네 가게 비교 서비스')
        req=self.page.locator('[data-requirement-id$=":REQ-tools"]')
        req.get_by_role('button',name='직접 수정').click()
        req.locator('textarea').fill('고객이 잠근 Codex 도구 요구')
        req.get_by_role('button',name='수정 내용 확인').click()
        self.page.locator('#tools').select_option('claude-only')
        expect(req).to_contain_text('선택 충돌')
        expect(req).to_contain_text('Claude만')
        expect(req).to_contain_text('고객이 잠근 Codex 도구 요구')
        req.get_by_role('button',name='이 요구 확인').click()
        expect(req).to_contain_text('선택 충돌')

    def storage_conflict(self):
        self.launch(); self.start()
        self.page.get_by_role('button',name='이 브라우저 한 곳에서만').click()
        req=self.page.locator('[data-requirement-id$=":REQ-storage"]')
        expect(self.page.locator('#start')).to_be_enabled()
        req.get_by_role('button',name='직접 수정').click()
        req.get_by_role('button',name='수정 내용 확인').click()
        req.locator('summary').click()
        # The requirement version advances; the existing source paragraphs must not change.
        original_trace=req.locator('details p').all_text_contents()[1:]
        self.page.get_by_text('고객 답변 원문 보기',exact=True).click()
        self.page.get_by_role('button',name='답변 수정',exact=True).click()
        self.page.locator('#edit-answer').fill('여러 기기에서 사용하고 싶다.')
        self.page.get_by_role('button',name='답변 수정 후 요약 다시 요청').click()
        expect(self.page.locator('#start')).to_be_enabled()
        expect(req).to_contain_text('선택 충돌')
        return req, original_trace

    def test_B16_R5_apply_cancel_and_uncertain_paired_resolution(self):
        req, old_trace=self.storage_conflict()
        original_id=req.get_attribute('data-requirement-id')
        before=req.inner_text(); revision=self.page.locator('#revision').inner_text()
        req.get_by_role('button',name='새 답변 반영',exact=True).click()
        preview=req.locator('.resolution-preview')
        expect(preview).to_contain_text('현재 완료 조건: 브라우저를 새로 열어도')
        expect(preview).to_contain_text('적용할 요구: 데이터 보관 범위: 여러 기기에서 사용하고 싶다.')
        expect(preview).to_contain_text('적용할 완료 조건: TBD:')
        expect(preview).to_contain_text('적용 후 상태: 제안 · 추가 확인 필요')
        self.page.screenshot(path=str(OUT/'16-r5-resolution-preview.png'),full_page=True)
        req.get_by_role('button',name='해결 취소').click()
        self.assertEqual(req.inner_text(),before)
        self.assertEqual(self.page.locator('#revision').inner_text(),revision)
        req.get_by_role('button',name='새 답변 반영',exact=True).click()
        req.get_by_role('button',name='해결안 확인').click()
        expect(req).to_have_attribute('data-status','proposed')
        expect(req.locator('.warning-text')).to_have_count(1)
        expect(req.locator('.warning-text')).to_contain_text('완료 조건 확인이 필요')
        expect(req).not_to_contain_text('선택 충돌:')
        expect(req).to_contain_text('관찰할 완료 조건: TBD:')
        expect(req).not_to_contain_text('기기 간 연결 기능은 요구하지 않는다')
        req.locator('summary').click()
        for source in old_trace:
            self.assertIn(source,req.locator('details p').all_text_contents())
        expect(req.locator('details')).to_contain_text('customer-answer')
        expect(req.locator('details')).to_contain_text('여러 기기에서 사용하고 싶다.')
        expect(req.locator('details')).to_contain_text('선택 충돌 해결')
        expect(req.locator('details')).to_contain_text('수동 수정 보존')
        self.page.screenshot(path=str(OUT/'16-r5-resolved-proposed.png'),full_page=True)
        self.page.locator('#start').click()
        expect(self.page.locator('#start')).to_be_enabled()
        self.assertEqual(req.get_attribute('data-requirement-id'),original_id)
        expect(req).to_have_attribute('data-status','proposed')
        expect(req).not_to_contain_text('선택 충돌:')
        req.get_by_role('button',name='이 요구 확인').click()
        expect(self.page.locator('#error')).to_contain_text('완료 조건이 미정')
        expect(req).to_have_attribute('data-status','proposed')

    def test_B17_R5_keep_cancel_and_repeat_summary_preserve_old_pair_and_new_answer(self):
        req, _=self.storage_conflict()
        before=req.inner_text(); revision=self.page.locator('#revision').inner_text()
        req.get_by_role('button',name='기존 요구 유지',exact=True).click()
        expect(req.locator('.resolution-preview')).to_contain_text('적용 후 상태: 확정')
        expect(req.locator('.resolution-preview')).to_contain_text('적용할 완료 조건: 브라우저를 새로 열어도')
        req.get_by_role('button',name='해결 취소').click()
        self.assertEqual(req.inner_text(),before)
        self.assertEqual(self.page.locator('#revision').inner_text(),revision)
        req.get_by_role('button',name='기존 요구 유지',exact=True).click()
        req.get_by_role('button',name='해결안 확인').click()
        expect(req).to_have_attribute('data-status','confirmed')
        expect(req).to_contain_text('기기 간 연결 기능은 요구하지 않는다')
        expect(req.locator('.warning-text')).to_have_count(0)
        req.locator('summary').click()
        expect(req.locator('details')).to_contain_text('기존 요구 유지 (새 선택을 이 요구에는 적용하지 않음)')
        expect(req.locator('details')).to_contain_text('여러 기기에서 사용하고 싶다.')
        expect(self.page.locator('.source-summary')).to_contain_text('여러 기기에서 사용하고 싶다.')
        self.page.locator('#start').click()
        expect(self.page.locator('#start')).to_be_enabled()
        expect(req).to_have_attribute('data-status','confirmed')
        expect(req.locator('.warning-text')).to_have_count(0)
        expect(req).to_contain_text('이 브라우저 한 곳에만 보관한다')

    def test_B18_R5_resolving_storage_keeps_an_unrelated_locked_tool_conflict(self):
        req, _=self.storage_conflict()
        tool=self.page.locator('[data-requirement-id$=":REQ-tools"]')
        tool.get_by_role('button',name='직접 수정').click()
        tool.locator('textarea').fill('고객 수동 도구 값')
        tool.get_by_role('button',name='수정 내용 확인').click()
        self.page.locator('#tools').select_option('claude-only')
        expect(tool).to_contain_text('선택 충돌:')
        before=tool.inner_text()
        req.get_by_role('button',name='새 답변 반영',exact=True).click()
        req.get_by_role('button',name='해결안 확인').click()
        self.assertEqual(tool.inner_text(),before)
        expect(req).not_to_contain_text('선택 충돌:')
        expect(tool).to_contain_text('고객 수동 도구 값')

    def test_B15_direct_network_assets_and_request_no_fetch_replacement(self):
        # This is an ADDITIONAL check: dom-bridge runs must not claim a pass here.
        if os.getenv('BROWSER_TRANSPORT','direct-http') != 'direct-http':
            self.skipTest('Direct network requirement not tested by DOM bridge')
        url=self.launch(); self.start()
        expect(self.page.locator('.option')).to_have_count(2)
        for resource in ['/', '/styles.css', '/client/app.js', '/api/config', '/api/interview']:
            self.assertIn((url+resource,200),self.http_responses)
        self.assertIn('[native code]',self.page.evaluate('window.fetch.toString()'))
        self.assertEqual(self.page.evaluate('typeof window.__test_local_api'),'undefined')
        self.assertEqual(self.page.url,url+'/')

if __name__ == '__main__':
    unittest.main(verbosity=2)
