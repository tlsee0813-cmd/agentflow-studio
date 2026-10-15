"""USE106: native browser -> localhost HTTP -> explicit MOCK; no paid AI.
Storage quota and over-limit fields are labelled fault injections, not usability evidence.
Run from app/: python continuity/tests/use106_browser.py
"""
import json, os, unittest
from playwright.sync_api import expect
import browser as base


class EntryReview(unittest.TestCase):
    setUpClass = classmethod(base.Browser.setUpClass.__func__)
    tearDownClass = classmethod(base.Browser.tearDownClass.__func__)
    tearDown = base.Browser.tearDown
    state = base.Browser.state
    compose = base.Browser.compose
    send = base.Browser.send
    backup = base.Browser.backup
    download_work = base.Browser.download_work

    def setUp(self):
        base.Browser.setUp(self)
        self.page.set_viewport_size({'width':1280,'height':900})

    def shot(self, name):
        self.page.screenshot(path=str(base.OUT / name), full_page=True)

    def test_01_direct_first_request_captures_visible_purpose(self):
        purpose = '공방 안내. 휠체어 접근 정보와 쉬운 글씨를 고려한다. 결제·회원은 미정.'
        request = '첫 화면에 운영시간만 표시해 주세요. 자동 예약은 구현하지 마세요.'
        calls = []
        self.page.on('request', lambda r: calls.append(r.post_data_json)
                     if r.method == 'POST' and r.url.endswith('/api/continuity') else None)
        self.page.locator('#brief-input').fill(purpose)
        self.send(request)
        self.shot(os.environ.get('USE106_PHASE', 'after') + '-direct-1280.png')
        state = self.state()
        self.assertIsNotNone(state['space']['brief'], 'visible purpose must enter the existing brief field')
        self.assertEqual(state['space']['brief']['text'], purpose)
        bg = state['tasks'][0]['background']
        self.assertEqual(bg['brief'], purpose)
        self.assertEqual(calls[0]['background'], bg)
        self.assertEqual([s['text'] for s in state['sources']], [request])
        self.assertEqual([b['text'] for b in state['bases']], [request], 'background is not a decision')
        text = self.page.locator('#handoff-text').input_value()
        self.assertIn(purpose, text)
        self.assertIn('이번 요청 범위와 구분', text)
        self.assertIn(request, text)
        self.page.reload()
        self.assertEqual(self.state()['tasks'][0]['background'], bg)

    def test_02_area_path_and_later_plan_keep_old_background(self):
        self.page.locator('#brief-input').fill('도예 수업 안내 · 회원 여부 미정')
        self.page.locator('#brief-start').click()
        self.page.locator('#area-name').fill('수업 소개')
        self.page.locator('#area-add').click()
        self.page.locator('#panel-new-request').click()
        self.send('수업명과 소요시간을 안내해 주세요.')
        first = self.state()['tasks'][0]
        before_text = self.page.locator('#handoff-text').input_value()
        self.page.locator('#nav-space').click()
        self.page.locator('#brief-edit > summary').click()
        self.page.locator('#brief-edit-text').fill('목공·도예 수업 안내 · 회원 미정')
        self.page.locator('#brief-save').click()
        self.send('전화 문의 방법을 추가해 주세요.')
        state = self.state()
        self.assertEqual(state['tasks'][0], first, 'old task, advice and background stay immutable')
        self.assertEqual(state['tasks'][-1]['background']['brief'], '목공·도예 수업 안내 · 회원 미정')
        self.assertEqual(first['background']['area']['name'], '수업 소개')
        self.assertIn('도예 수업 안내 · 회원 여부 미정', before_text)
        self.assertEqual(len(state['sources']), 2)

    def test_03_blank_purpose_is_optional_and_double_submit_is_not_a_second_request(self):
        self.page.locator('#brief-input').fill('   ')
        self.page.locator('#draft').fill('도서관 소식 한 줄만 바꿔 주세요.')
        # Synthetic rapid double-submit through the actual form handler (no HTTP substitution).
        self.page.locator('#compose').evaluate('(f)=>{f.requestSubmit();f.requestSubmit();}')
        expect(self.page.locator('#working')).to_have_text('')
        state = self.state()
        self.assertIsNone(state['space']['brief'])
        self.assertIsNone(state['tasks'][0]['background']['brief'])
        self.assertEqual(len(state['tasks']), 1)
        self.assertEqual(len(state['sources']), 1)

    def test_04_invalid_purpose_preserves_both_inputs_then_retries_once(self):
        request = '전시 관람 시간을 안내해 주세요.'
        # Labelled validation fault: bypass HTML maxlength to reach the domain validator.
        self.page.locator('#brief-input').evaluate('(e)=>e.maxLength=13000')
        bad = '긴 목적 ' * 2600
        self.page.locator('#brief-input').fill(bad)
        self.page.locator('#draft').fill(request)
        before = self.state()
        self.page.locator('#send').click()
        expect(self.page.locator('#notice')).to_contain_text('길이·형식')
        expect(self.page.locator('#brief-input')).to_have_value(bad)
        expect(self.page.locator('#draft')).to_have_value(request)
        self.assertEqual(self.state(), before, 'validation must not partially commit a name, purpose or task')
        self.page.locator('#brief-input').fill('작은 전시 안내 · 주차 방식은 미정')
        self.page.locator('#draft').evaluate('(e)=>e.maxLength=13000')
        self.page.locator('#draft').fill('x' * 12001)
        self.page.locator('#send').click()
        expect(self.page.locator('#draft')).to_have_value('x' * 12001)
        expect(self.page.locator('#brief-input')).to_have_value('작은 전시 안내 · 주차 방식은 미정')
        self.assertEqual(self.state(), before, 'rejected visible request must not submit the older valid draft or purpose')
        self.page.locator('#draft').fill(request)
        self.page.locator('#send').click()
        expect(self.page.locator('#working')).to_have_text('')
        state = self.state()
        self.assertEqual(len(state['tasks']), 1)
        self.assertEqual(state['tasks'][0]['background']['brief'], '작은 전시 안내 · 주차 방식은 미정')

    def test_05_quota_failure_keeps_existing_save_and_recoverable_input_without_duplicate(self):
        self.page.locator('#project-name').fill('저장 보호 확인')
        self.state()
        old = self.page.evaluate('(k)=>localStorage.getItem(k)', base.WORKSPACE)
        self.page.evaluate('''()=>{window.__use106Set=Storage.prototype.setItem;
          Storage.prototype.setItem=function(){throw new DOMException('synthetic quota','QuotaExceededError')}}''')
        purpose = '야외 체험 안내 · 우천 일정은 미정'
        request = '준비물 목록만 작성해 주세요.'
        self.page.locator('#brief-input').fill(purpose)
        self.page.locator('#draft').fill(request)
        self.page.locator('#compose').evaluate('(f)=>{f.requestSubmit();f.requestSubmit();}')
        expect(self.page.locator('#working')).to_have_text('')
        expect(self.page.locator('#saved')).to_have_text('저장되지 않은 변경 있음')
        self.assertEqual(self.page.evaluate('(k)=>localStorage.getItem(k)', base.WORKSPACE), old)
        recovery = json.loads(self.backup('use106-quota-memory.json').read_text(encoding='utf-8'))
        self.assertEqual(recovery['space']['brief']['text'], purpose)
        self.assertEqual(recovery['sources'][0]['text'], request)
        self.assertEqual(recovery['tasks'][0]['background']['brief'], purpose)
        self.assertEqual(len(recovery['tasks']), 1)
        self.page.evaluate('()=>Storage.prototype.setItem=window.__use106Set')
        self.page.locator('#project-name').fill('저장 보호 확인 · 복구 후')
        expect(self.page.locator('#saved')).to_have_text('이 브라우저에 저장됨')
        self.page.reload()
        self.assertEqual(len(self.state()['tasks']), 1)
        self.assertEqual(self.state()['sources'], recovery['sources'])

    def test_06_report_guidance_is_read_only_and_does_not_offer_individual_deletion(self):
        self.send('공방 위치만 안내해 주세요.')
        self.send('합성 실수: 다른 프로젝트의 결과를 잘못 가져왔습니다. 실제 구현 없음.', 'report')
        before = self.state()
        self.page.locator('#outcome-results > summary').click()
        guidance = self.page.locator('#outcome-results .report-correction-help')
        expect(guidance).to_contain_text('한 건만 삭제')
        expect(guidance).to_contain_text('새 요청')
        expect(guidance).to_contain_text('전체')
        self.page.locator('#nav-history').click()
        self.page.locator('.history-item[data-kind="report"] > details > summary').click()
        expect(self.page.locator('.history-item[data-kind="report"] .report-correction-help')).to_be_visible()
        self.assertEqual(self.state(), before, 'reading cleanup guidance changes no record or link')
        self.shot('after-report-help-1280.png')

    def test_07_review_hierarchy_keeps_full_export_and_narrow_layout(self):
        request = '수업 소개를 검토해 주세요. 코드 수정·배포는 금지합니다. 결제는 아직 미정입니다.'
        self.page.locator('#brief-input').fill('공방 안내 · 계획은 배경이며 확정 요구 아님')
        self.send(request)
        review = self.page.locator('#handoff-review')
        expect(review).to_contain_text('이번 요청')
        expect(review).to_contain_text('별도 조건')
        expect(review).to_contain_text('미정')
        expect(review).to_contain_text('자동 실행')
        before = self.state()
        full = self.page.locator('#handoff-text').input_value()
        self.assertIn(request, full)
        self.assertIn(before['id'], full)
        self.assertIn(before['tasks'][0]['id'], full)
        self.assertIn('권한', full)
        self.assertNotIn('명시된 추가 조건 없음', full)
        self.assertIn('원문 속 조건', full)
        self.assertEqual(self.download_work('use106-handoff.md'), full)
        self.ctx.grant_permissions(['clipboard-read', 'clipboard-write'])
        full_after_download = self.page.locator('#handoff-text').input_value()
        self.page.locator('#copy-work').click()
        # Windows' native clipboard returns CRLF for writeText's LF. Normalize only that OS representation;
        # keep every content character, line break, ID and authority line in the full-text equality check.
        clipboard = self.page.evaluate('navigator.clipboard.readText()')
        self.assertEqual(clipboard.replace('\r\n', '\n'), full_after_download)
        self.assertEqual(self.state()['tasks'][0]['background'], before['tasks'][0]['background'])
        self.page.set_viewport_size({'width':1280,'height':900})
        review.scroll_into_view_if_needed(); self.shot('after-review-1280.png')
        self.page.set_viewport_size({'width':390,'height':844})
        review.scroll_into_view_if_needed(); self.shot('after-review-390.png')
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), 390)

    def test_08_unsubmitted_purpose_does_not_cross_project_boundary(self):
        self.page.locator('#project-name').fill('목적 초안 A')
        self.page.locator('#brief-input').fill('A에만 해당하는 아직 제출하지 않은 목적')
        first_id = self.state()['id']
        self.page.locator('#nav-projects').click()
        self.page.locator('#new-project').click()
        expect(self.page.locator('#brief-input')).to_have_value('')
        self.send('B의 첫 요청만 기록해 주세요.')
        state = self.state()
        self.assertNotEqual(state['id'], first_id)
        self.assertIsNone(state['space']['brief'])
        self.assertIsNone(state['tasks'][0]['background']['brief'])
        self.assertNotIn('A에만', self.page.locator('#handoff-text').input_value())

    def test_09_review_uses_current_stage_and_actual_question(self):
        self.send('빈자리가 생기면 대기자를 자동으로 예약해줘.')
        review = self.page.locator('#handoff-review')
        question = self.page.locator('#question-box h3').inner_text()
        expect(review).to_contain_text(question)
        expect(review).to_contain_text('아래 질문에 답하거나')
        self.assertNotIn('쓰던 개발 도구에 붙여넣으세요', review.inner_text())
        self.page.locator('#answer-defer').click()
        expect(self.page.locator('#working')).to_have_text('')
        expect(review).to_contain_text('프로젝트의 보류·모름 기록')
        self.assertNotIn('답변할 질문:', review.inner_text())

    def test_10_review_labels_corrected_basis_as_current_value_not_original(self):
        original = '공방 수업 소개 문구를 검토해 주세요.'
        correction = '수업 소개가 아니라 위치 안내 문구만 검토해 주세요.'
        self.send(original)
        self.page.locator('#outcome-correction > summary').click()
        self.page.locator('#outcome-correction-text').fill(correction)
        self.page.locator('#correct-outcome').click()
        review = self.page.locator('#handoff-review')
        expect(review).to_contain_text('이번 요청 · 현재 기준 값 앞부분')
        expect(review).to_contain_text(correction)
        self.assertEqual(self.state()['sources'][0]['text'], original)
        full = self.page.locator('#handoff-text').input_value()
        self.assertIn(original, full)
        self.assertIn(correction, full)

    def test_11_saved_only_request_does_not_claim_ready_for_external_handoff(self):
        # Labelled config fault: an unconfigured, disabled provider exposes the existing save-only path.
        # The real server remains MOCK; this case must issue no generation request.
        self.page.route('**/api/config', lambda route: route.fulfill(status=200, content_type='application/json',
                        body=json.dumps({'mode':'deepseek','configured':False,'paidEnabled':False})))
        calls = []
        self.page.on('request', lambda r: calls.append(r.url) if r.method == 'POST' else None)
        self.page.reload()
        expect(self.page.locator('#mode')).to_contain_text('호출 꺼짐')
        self.page.locator('#brief-input').fill('동네 행사 안내 · 운영 방식은 미정')
        self.page.locator('#draft').fill('행사 시간 안내 문구를 검토해 주세요.')
        self.page.locator('#save-input').click()
        review = self.page.locator('#handoff-review')
        expect(review).to_contain_text('원문 보관됨')
        expect(review).to_contain_text('작업문을 직접 작성하세요')
        self.assertNotIn('쓰던 개발 도구에 붙여넣으세요', review.inner_text())
        state = self.state()
        self.assertEqual(calls, [])
        self.assertIsNone(state['tasks'][0]['advice'])
        self.assertEqual(state['tasks'][0]['background']['brief'], '동네 행사 안내 · 운영 방식은 미정')


if __name__ == '__main__':
    if base.DOM:
        raise RuntimeError('USE106 requires native HTTP; no DOM bridge')
    unittest.main(verbosity=2)
