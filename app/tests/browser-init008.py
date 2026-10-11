"""INIT-008 narrow compiled-UI regressions. All provider responses are SYNTHETIC.
Reuses the existing harness, including its explicit direct-http / dom-bridge split.
Run only these three cases by default; do not rerun the inherited full suite.
"""
from pathlib import Path
import json
import unittest
import sys
# Keep imported harness bytecode out of source-identity roots.
sys.dont_write_bytecode = True
from playwright.sync_api import expect
import browser as baseline

FIXTURES = json.loads((baseline.ROOT / 'fixtures/init008/dialogue-regressions.json').read_text())

class Init008BrowserTests(baseline.BrowserTests):
    def start_fixture(self, persona):
        f = FIXTURES[persona]['brief']
        self.page.locator('#idea').fill(f['idea'])
        self.page.locator('#tools').select_option(f['tools'])
        self.page.locator('#start').click()
        expect(self.page.locator('#conversation .option')).to_have_count(2)

    def test_I8_U1_deferred_current_summary_not_misleading_ai_prose(self):
        self.launch('init008-p03'); self.start_fixture('p03')
        self.page.get_by_role('button', name='나중에 결정', exact=True).click()
        storage = self.page.locator('[data-requirement-id$=":REQ-storage"]')
        proposal = self.page.locator('[data-requirement-id$=":REQ-proposal-reading-core"]')
        expect(storage).to_have_attribute('data-status','deferred')
        expect(storage).to_contain_text('TBD:')
        expect(storage).to_contain_text('고객 발언 · 보류 (미확정)')
        expect(self.page.locator('.decision-summary')).to_contain_text('확정 1개 · 제안 1개 · 보류 1개')
        expect(self.page.locator('[data-group="confirmed"]')).not_to_contain_text('보관 범위')
        expect(self.page.locator('.interpretation-history .narrative')).to_be_hidden()
        expect(self.page.locator('.interpretation-history .narrative')).to_have_text(FIXTURES['p03']['misleadingSummary'])
        self.assertNotIn(FIXTURES['p03']['misleadingSummary'],self.page.locator('#summary').inner_text())
        self.assertEqual(self.page.locator('.interpretation-history').get_attribute('open'),None)
        self.page.locator('#summary').screenshot(path=str(baseline.OUT/'init008-p03-current-summary.png'))
        proposal.get_by_role('button',name='이 요구 확인',exact=True).click()
        expect(self.page.locator('.decision-summary')).to_contain_text('확정 2개 · 제안 0개 · 보류 1개')
        expect(storage).to_have_attribute('data-status','deferred')
        self.page.locator('.interpretation-history > summary').click()
        expect(self.page.locator('.interpretation-history')).to_contain_text('현재 결정 아님')
        expect(self.page.locator('.interpretation-history .narrative')).to_be_visible()
        self.assertNotIn('sourceFingerprint',self.page.locator('#summary').inner_text())
        self.assertNotIn('ledger',self.page.locator('#summary').inner_text())

    def test_I8_U2_success_answer_to_proposed_requirement_and_current_decision(self):
        self.launch('init008-p01'); self.start_fixture('p01')
        raw = FIXTURES['p01']['answer']
        self.page.locator('#custom-answer').fill(raw)
        self.page.get_by_role('button',name='직접 답변하고 요약 보기',exact=True).click()
        req = self.page.locator('[data-requirement-id$=":REQ-proposal-reading-core"]')
        expect(req).to_have_attribute('data-status','proposed')
        expect(req).to_contain_text(FIXTURES['p01']['text'])
        expect(req).to_contain_text(FIXTURES['p01']['acceptance'])
        expect(self.page.locator('.decision-summary')).to_contain_text('확정 0개 · 제안 1개')
        self.page.get_by_text('고객 답변 원문 보기',exact=True).click()
        self.assertEqual(self.page.locator('.source-summary').text_content(),'[answered] '+raw)
        req.get_by_role('button',name='직접 수정',exact=True).click()
        req.locator('textarea').fill('고객이 직접 고친 독서 기록 요구')
        req.get_by_role('button',name='수정 내용 확인',exact=True).click()
        expect(req).to_have_attribute('data-status','confirmed')
        expect(req).to_contain_text(FIXTURES['p01']['acceptance'])
        expect(self.page.locator('.decision-summary')).to_contain_text('확정 1개 · 제안 0개')
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth > innerWidth'))

    def test_I8_U3_contract_rejection_keeps_answer_and_no_hidden_mock_success(self):
        self.page.set_viewport_size({'width':390,'height':844})
        self.launch('init008-p01-rejected'); self.start_fixture('p01')
        raw = FIXTURES['p01']['answer']
        self.page.locator('#custom-answer').fill(raw)
        self.page.get_by_role('button',name='직접 답변하고 요약 보기',exact=True).click()
        expect(self.page.locator('#error')).to_contain_text('출처를 검증하지 못했습니다')
        expect(self.page.locator('#idea')).to_have_value(FIXTURES['p01']['brief']['idea'])
        self.assertEqual(self.page.locator('.source-summary').text_content(),'[answered] '+raw)
        expect(self.page.locator('[data-requirement-id$=":REQ-proposal-reading-core"]')).to_have_count(0)
        expect(self.page.locator('.decision-summary')).to_contain_text('확정 0개 · 제안 0개')
        expect(self.page.locator('.interpretation-history .narrative')).to_have_text(FIXTURES['p01']['firstSummary'])
        expect(self.page.locator('.interpretation-history .narrative')).to_be_hidden()
        expect(self.page.locator('#start')).to_be_enabled()
        self.page.screenshot(path=str(baseline.OUT/'init008-p01-rejected-input-preserved.png'),full_page=True)
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth > innerWidth'))

if __name__ == '__main__':
    unittest.main(verbosity=2,defaultTest=[
        'Init008BrowserTests.test_I8_U1_deferred_current_summary_not_misleading_ai_prose',
        'Init008BrowserTests.test_I8_U2_success_answer_to_proposed_requirement_and_current_decision',
        'Init008BrowserTests.test_I8_U3_contract_rejection_keeps_answer_and_no_hidden_mock_success'])
