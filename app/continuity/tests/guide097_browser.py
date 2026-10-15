"""GUIDE097 native UI -> localhost -> explicit MOCK. Area guidance: one question, a reviewable draft, adoption into the area's
existing request draft; edits survive area switches, cancel, failure and late replies. Wiring, not AI quality (MOCK rules).
Run from app/: python continuity/tests/guide097_browser.py
"""
import unittest
from playwright.sync_api import expect
import browser as base

class AreaGuidance(unittest.TestCase):
    setUpClass=classmethod(base.Browser.setUpClass.__func__)
    tearDownClass=classmethod(base.Browser.tearDownClass.__func__)
    setUp=base.Browser.setUp;tearDown=base.Browser.tearDown;state=base.Browser.state

    def start(self,areas):
        self.page.locator('#brief-input').fill('도자기 공방 원데이 클래스 온라인 예약 사이트');self.page.locator('#brief-start').click()
        for name,note in areas:
            self.page.locator('#area-name').fill(name);self.page.locator('#area-note').fill(note);self.page.locator('#area-add').click()
            expect(self.page.locator('.area-node',has_text=name)).to_be_visible()
        return [next(a['id'] for a in self.state()['space']['areas'] if a['name']==n) for n,_ in areas]
    def open_area(self,name):
        self.page.locator('#nav-space').click();self.page.locator('.area-node',has_text=name).first.locator('.area-open').click()
        expect(self.page.locator('#space-title')).to_have_text(name)
    def calls(self,path):
        out=[];self.page.on('request',lambda r:out.append(r.post_data_json) if r.method=='POST' and r.url.endswith(path) else None);return out
    def hold(self):
        held=[];self.page.route('**/api/guidance',lambda route:held.append(route));return held

    def test_01_question_answer_edit_switch_adopt_and_send(self):
        guide,organise=self.calls('/api/guidance'),self.calls('/api/continuity')
        booking,works=self.start([('예약','예약받기'),('작품','사진으로 작품 소개')]);self.open_area('예약')
        expect(self.page.locator(f'#guide-{booking}')).to_have_attribute('open','')  # an empty area shows the option
        before=self.state();self.page.locator('#guide-start').click()
        q=self.page.locator('#guide-question');expect(q).to_contain_text('바로 확정할까요, 공방이 확인한 뒤 확정할까요?');expect(q).to_contain_text('MOCK 규칙 · AI 아님')
        self.assertEqual(guide[0]['area'],{'id':booking,'name':'예약','note':'예약받기'});self.assertEqual(guide[0]['brief'],'도자기 공방 원데이 클래스 온라인 예약 사이트')
        self.page.locator('#guide-option-1').click();text=self.page.locator('#guide-text');expect(text).to_have_value(__import__('re').compile('확인 대기'))
        self.assertEqual(guide[1]['answer']['text'],'공방 확인 뒤 확정');self.assertIsNone(guide[0]['answer'])
        self.assertEqual(self.state(),before,'asking and answering write nothing to the project')
        edited=text.input_value()+'\n(사용자 메모: 주말 클래스만 먼저)';text.fill(edited);expect(self.page.locator('#guide-edited')).to_contain_text('직접 고친')
        # Another area and back: the edit stays with its area and never shows in the other one.
        self.open_area('작품');expect(self.page.locator('#guide-text')).to_have_count(0);self.open_area('예약');expect(self.page.locator('#guide-text')).to_have_value(edited)
        self.page.screenshot(path=str(base.OUT/'guide097-proposal.png'),full_page=True)
        self.page.set_viewport_size({'width':390,'height':844});self.page.screenshot(path=str(base.OUT/'guide097-proposal-390.png'),full_page=True)
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),390);expect(self.page.locator('#guide-adopt')).to_be_visible()
        self.page.set_viewport_size({'width':1440,'height':1050})
        self.page.locator('#guide-adopt').click();expect(self.page.locator('#draft')).to_have_value(edited)
        expect(self.page.locator('#compose-area')).to_have_value(booking);expect(self.page.locator('#notice')).to_contain_text('아직 보내지 않았어요')
        s=self.state();self.assertEqual(s['space']['areas'],before['space']['areas'],'area ideas untouched');self.assertEqual(s['tasks'],[]);self.assertEqual(s['bases'],[])
        self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        s=self.state();self.assertEqual(s['tasks'][0]['areaId'],booking);self.assertEqual(s['sources'][0]['text'],edited);self.assertEqual(s['tasks'][0]['background']['area']['note'],'예약받기')
        self.assertEqual((len(guide),len(organise)),(2,1))
        with self.page.expect_download() as d:self.page.locator('#download-work').click()
        path=base.OUT/'guide097-handoff.md';d.value.save_as(path);self.assertEqual(path.read_text(encoding='utf-8').count(edited),1)
        # Back in the area: it now has a request, so the option is folded and the request is listed as before.
        self.open_area('예약');expect(self.page.locator(f'#guide-{booking}')).not_to_have_attribute('open','');expect(self.page.locator('#area-tasks')).to_contain_text('예약')

    def test_02_unknown_then_change_answer(self):
        (booking,)=self.start([('예약','예약받기')]);self.open_area('예약');self.page.locator('#guide-start').click()
        self.page.locator('#guide-unknown').click();expect(self.page.locator('#guide-text')).to_have_value(__import__('re').compile('예약 확정 방식 — 사용자 모름'))
        self.page.locator('#guide-change-answer').click();self.page.locator('#guide-option-0').click()
        expect(self.page.locator('#guide-text')).to_have_value(__import__('re').compile('그 자리에서 예약이 확정'))
        expect(self.page.locator('#guide-proposal')).to_contain_text('바로 확정')

    def test_03_failure_cancel_late_reply_and_unsent_draft(self):
        booking,works=self.start([('예약','예약받기'),('작품','사진으로 작품 소개')]);self.open_area('예약')
        self.page.locator('#guide-start').click();self.page.locator('#guide-option-0').wait_for()
        # Failure after answering: the answer stays and is sent again; the question is not asked again.
        self.page.route('**/api/guidance',lambda route:route.abort());self.page.locator('#guide-option-1').click()
        expect(self.page.locator('#guide-notice')).to_contain_text('입력·답·초안은 그대로');expect(self.page.locator('#guide-question')).to_contain_text('보낸 답: 공방 확인 뒤 확정')
        self.page.unroute('**/api/guidance');sent=self.calls('/api/guidance');self.page.locator('#guide-retry').click()
        expect(self.page.locator('#guide-text')).to_have_value(__import__('re').compile('확인 대기'));self.assertEqual(sent[0]['answer']['text'],'공방 확인 뒤 확정')
        mine=self.page.locator('#guide-text').input_value()+' 직접 수정';self.page.locator('#guide-text').fill(mine)
        held=self.hold()
        # Late reply for another area: B's guide is filled only in B, never in A.
        self.open_area('작품');self.page.locator('#guide-start').click();self.page.wait_for_function('()=>document.querySelector("#guide-stop")')
        self.open_area('예약');expect(self.page.locator('#guide-text')).to_have_value(mine)
        held[0].continue_();self.page.wait_for_timeout(300);expect(self.page.locator('#guide-text')).to_have_value(mine)
        self.open_area('작품');expect(self.page.locator('#guide-text')).to_have_value(__import__('re').compile('사진으로 작품 소개'))
        # A late reply after the area idea changed is not applied; the new idea is kept.
        self.page.locator('#guide-discard').click();self.page.locator('#guide-start').click();self.page.wait_for_function('()=>document.querySelector("#guide-stop")')
        self.page.locator('#area-edit').evaluate('(e)=>e.open=true');self.page.locator('#area-edit-note').fill('작품 사진과 가격 소개');self.page.locator('#area-edit-save').click()
        held[1].continue_();expect(self.page.locator('#guide-notice')).to_contain_text('바뀌어 이 응답은 적용하지 않았어요');expect(self.page.locator('#guide-text')).to_have_count(0)
        self.assertEqual(self.state()['space']['areas'][1]['note'],'작품 사진과 가격 소개')
        # Stop while waiting: input kept, later delivery ignored.
        self.page.locator('#guide-start').click();self.page.locator('#guide-stop').click();expect(self.page.locator('#guide-notice')).to_contain_text('중단했어요')
        try:held[2].continue_()
        except Exception:pass
        self.page.wait_for_timeout(200);expect(self.page.locator('#guide-text')).to_have_count(0);expect(self.page.locator('#guide-start')).to_be_enabled()
        self.page.unroute('**/api/guidance')
        # An unsent request is never replaced by adoption.
        self.open_area('예약');self.page.locator('#area-new-request').click();self.page.locator('#draft').fill('작성 중인 내 요청')
        self.open_area('예약');self.page.locator('#guide-adopt').click()
        expect(self.page.locator('#guide-notice')).to_contain_text('작성 중인 요청이 있어 초안을 넣지 않았어요');self.assertEqual(self.state()['draft'],'작성 중인 내 요청')
        expect(self.page.locator('#guide-text')).to_have_value(mine);self.assertEqual(self.state()['tasks'],[])

    # ---------- GUIDE097-R1 (R1): a reply that arrives after the user edited the draft never replaces the edit ----------
    def test_04_edit_while_waiting_is_never_overwritten(self):
        import json,re
        booking,works=self.start([('예약','예약받기'),('작품','사진으로 작품 소개')]);self.open_area('예약')
        self.page.locator('#guide-start').click();self.page.locator('#guide-option-0').click()
        first=self.page.locator('#guide-text');expect(first).to_have_value(re.compile('그 자리에서'));original=first.input_value()
        # Real delayed HTTP: the request is held in the browser, then sent to the real local MOCK server.
        held=self.hold();self.page.locator('#guide-again').click();self.page.wait_for_function('()=>document.querySelector("#guide-stop")')
        mine=original+'\n(기다리는 동안 직접 고침)';first.fill(mine);held[0].continue_()
        self.page.wait_for_function('()=>!document.querySelector("#guide-stop")')
        self.assertEqual(first.input_value(),mine,'the reply must not replace the edit made while waiting')
        expect(self.page.locator('#guide-notice')).to_contain_text('직접 고친 내용이 있어 새 초안으로 바꾸지 않았어요');expect(self.page.locator('#guide-take-incoming')).to_be_visible()
        self.page.screenshot(path=str(base.OUT/'guide097-r1-held.png'),full_page=True)
        # Keeping the edit is the default; replacing it is an explicit choice.
        self.page.locator('#guide-keep-mine').click();expect(first).to_have_value(mine);expect(self.page.locator('#guide-take-incoming')).to_have_count(0)
        # An edit that returns to the same value is still the user's: the reply is held, not applied.
        self.page.locator('#guide-revert').click();expect(first).to_have_value(original)
        self.page.locator('#guide-again').click();self.page.wait_for_function('()=>document.querySelector("#guide-stop")')
        first.fill(original+'x');first.fill(original);held[1].continue_()
        expect(self.page.locator('#guide-take-incoming')).to_be_visible();expect(first).to_have_value(original)
        self.page.locator('#guide-take-incoming').click();expect(first).to_have_value(re.compile('그 자리에서'));expect(self.page.locator('#guide-edited')).to_have_text('')
        # Area switch while waiting: the edit stays with its area; the reply is held there.
        self.page.locator('#guide-again').click();self.page.wait_for_function('()=>document.querySelector("#guide-stop")')
        first.fill('다른 영역으로 가기 전에 고친 초안');self.open_area('작품');held[2].continue_();self.page.wait_for_timeout(300)
        self.open_area('예약');expect(self.page.locator('#guide-text')).to_have_value('다른 영역으로 가기 전에 고친 초안');expect(self.page.locator('#guide-take-incoming')).to_be_visible()
        self.page.locator('#guide-keep-mine').click()
        # A question reply while edited (a draft with no answer yet: 작품 gets a draft directly). The reply is a labelled
        # browser-side fake carrying the request's own ticket, since MOCK never asks there; it is held, the draft stays.
        held2=self.hold();self.open_area('작품');self.page.locator('#guide-start').click();self.page.wait_for_function('()=>document.querySelector("#guide-stop")')
        held2[0].continue_();expect(self.page.locator('#guide-text')).to_have_value(re.compile('사진으로 작품 소개'))
        self.page.locator('#guide-again').click();self.page.wait_for_function('()=>document.querySelector("#guide-stop")')
        self.page.locator('#guide-text').fill('질문이 와도 남아야 하는 초안')
        req=json.loads(held2[1].request.post_data);self.assertIsNone(req['answer'])
        held2[1].fulfill(status=200,content_type='application/json',body=json.dumps({'mode':'mock','ticket':req['ticket'],'reply':{'question':{'kind':'fact','text':'확인할 점?','why':'시험','options':[]},'proposal':None}}))
        expect(self.page.locator('#guide-notice')).to_contain_text('직접 고친 내용이 있어');expect(self.page.locator('#guide-text')).to_have_value('질문이 와도 남아야 하는 초안')
        expect(self.page.locator('#guide-question')).to_have_count(0)
        # Cancel while waiting after an edit: the edit stays.
        held3=self.hold();self.page.locator('#guide-keep-mine').click();self.page.locator('#guide-revert').click();self.page.locator('#guide-again').click()
        self.page.wait_for_function('()=>document.querySelector("#guide-stop")');self.page.locator('#guide-text').fill('중단해도 남는 초안');self.page.locator('#guide-stop').click()
        try:held3[0].continue_()
        except Exception:pass
        self.page.wait_for_timeout(200);expect(self.page.locator('#guide-text')).to_have_value('중단해도 남는 초안')
        self.assertEqual(self.state()['tasks'],[],'nothing written before adoption')

    # ---------- GUIDE097-R2: a long free answer survives draft -> adoption -> request -> handoff, closing ban included ----------
    def test_05_long_free_answer_kept_whole_after_adoption(self):
        end='예약 확정 처리는 금지하고 접수만 받으세요.'
        long='주말 클래스는 인원이 적어서 공방 사정에 따라 시작 시간이 바뀔 수 있으니 고객에게 그 점을 예약 화면에서 충분히 알려 주세요. '*6+end
        (booking,)=self.start([('예약','예약받기')]);self.open_area('예약');self.page.locator('#guide-start').click()
        self.page.locator('#guide-answer').fill(long);self.page.locator('#guide-answer-send').click()
        text=self.page.locator('#guide-text');text.wait_for();self.assertIn(long,text.input_value(),'the draft holds the whole answer')
        self.page.locator('#guide-adopt').click();expect(self.page.locator('#draft')).to_have_value(text_re(long))
        self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        s=self.state();self.assertIn(long,s['sources'][0]['text'],'the request record keeps it');self.assertEqual(s['tasks'][0]['areaId'],booking)
        with self.page.expect_download() as d:self.page.locator('#download-work').click()
        path=base.OUT/'guide097-r2-long-answer.md';d.value.save_as(path);self.assertIn(end,path.read_text(encoding='utf-8'))

    # ---------- GUIDE099: optional current instruction in the open panel ----------
    def test_06_instruction_visible_neutral_draft_and_composer_untouched(self):
        import json
        instr='예약 확정 방식은 정하지 말고, 접수 화면의 입력 항목 설계만 정리해 주세요.\n코드 수정과 배포는 하지 마세요.'
        (booking,)=self.start([('예약','예약받기')]);self.open_area('예약')
        self.page.locator('#area-new-request').click();self.page.locator('#draft').fill('작성 중인 내 요청');self.open_area('예약')
        panel=self.page.locator(f'#guide-{booking}');expect(self.page.locator('#guide-instruction')).to_be_visible();expect(self.page.locator('#guide-start')).to_be_visible()
        self.assertEqual(panel.locator('details').count(),0,'no folded box inside the panel');self.assertEqual(self.page.locator('#guide-instruction').input_value(),'','composer text is not copied')
        sent=self.calls('/api/guidance');self.page.locator('#guide-instruction').fill(instr);self.page.locator('#guide-start').click()
        text=self.page.locator('#guide-text');text.wait_for();self.assertEqual(sent[0]['currentInstruction'],instr);self.assertIsNone(sent[0]['answer'])
        self.assertEqual(sent[0]['area']['note'],'예약받기');expect(self.page.locator('#guide-question')).to_have_count(0)
        self.assertEqual(text.input_value().count(instr),1,'the instruction appears whole, once')
        self.assertEqual(self.state()['draft'],'작성 중인 내 요청');self.page.locator('#guide-adopt').click()
        expect(self.page.locator('#guide-notice')).to_contain_text('작성 중인 요청이 있어');self.assertEqual(self.state()['draft'],'작성 중인 내 요청')
        self.page.screenshot(path=str(base.OUT/'guide099-instruction.png'),full_page=True)
        # Over the request limit: refused with an explicit notice, the input is not shortened, nothing is sent.
        n=len(sent);self.page.locator('#guide-instruction').fill('가'*12001);self.page.locator('#guide-fresh').click()
        expect(self.page.locator('#guide-notice')).to_contain_text('12,000자를 넘어 보내지 않았어요');self.assertEqual(len(sent),n)
        self.assertEqual(len(self.page.locator('#guide-instruction').input_value()),12001)

    def test_07_changed_instruction_is_not_reused_edits_kept_and_late_reply_dropped(self):
        (booking,)=self.start([('예약','예약받기')]);self.open_area('예약');sent=self.calls('/api/guidance')
        self.page.locator('#guide-start').click();self.page.locator('#guide-option-0').wait_for()
        self.page.locator('#guide-instruction').fill('접수 화면 설계만 해 주세요.')
        expect(self.page.locator('#guide-stale')).to_be_visible();expect(self.page.locator('#guide-option-0')).to_have_count(0)
        self.page.locator('#guide-fresh').click();text=self.page.locator('#guide-text');text.wait_for()
        self.assertIsNone(sent[-1]['answer'],'the earlier question and answer are not sent again');self.assertEqual(sent[-1]['currentInstruction'],'접수 화면 설계만 해 주세요.')
        expect(self.page.locator('#guide-stale')).to_have_count(0);self.assertIn('접수 화면 설계만 해 주세요.',text.input_value())
        # An edited draft survives a changed instruction: the new reply is held until the user chooses.
        mine=text.input_value()+'\n(직접 메모)';text.fill(mine);self.page.locator('#guide-instruction').fill('입력 항목 목록만 정리해 주세요.')
        expect(self.page.locator('#guide-stale')).to_be_visible();self.page.locator('#guide-fresh').click()
        expect(self.page.locator('#guide-take-incoming')).to_be_visible();expect(text).to_have_value(mine)
        self.page.locator('#guide-take-incoming').click();expect(text).to_have_value(text_re('입력 항목 목록만 정리해 주세요.'))
        # Late reply after the instruction was edited while waiting: not applied; the screen stays as it was.
        before=text.input_value();held=self.hold();self.page.locator('#guide-instruction').fill('다른 지시 C');self.page.locator('#guide-fresh').click()
        self.page.wait_for_function('()=>document.querySelector("#guide-stop")');self.page.locator('#guide-instruction').fill('다른 지시 D');held[0].continue_()
        expect(self.page.locator('#guide-notice')).to_contain_text('바뀌어 이 응답은 적용하지 않았어요');expect(text).to_have_value(before)
        self.page.unroute('**/api/guidance')
        # Discarding the draft keeps what was typed as the instruction.
        self.page.locator('#guide-discard').click();expect(self.page.locator('#guide-instruction')).to_have_value('다른 지시 D');expect(self.page.locator('#guide-start')).to_be_visible()
        self.assertEqual(self.state()['tasks'],[],'nothing written before adoption')

    # ---------- GUIDE099-R1: a draft or held reply made for another instruction is never adopted or applied ----------
    def force_click(self,sel):
        # Defence check of the handler itself: a disabled button is re-enabled in the page and clicked.
        self.page.locator(sel).evaluate('(b)=>{b.disabled=false;b.click();}')
    def test_08_stale_draft_and_held_reply_follow_the_current_instruction(self):
        A='접수 화면 입력 항목만 정리해 주세요.';B='접수 화면 입력 항목과 안내 문구까지 정리해 주세요.';C='세 번째 지시'
        (booking,)=self.start([('예약','예약받기')]);self.open_area('예약')
        ins=self.page.locator('#guide-instruction');ins.fill(A);self.page.locator('#guide-start').click();text=self.page.locator('#guide-text');text.wait_for()
        self.assertIn(A,text.input_value())
        # A -> B: the draft made for A cannot be adopted (button and handler), and stays on screen.
        ins.fill(B);expect(self.page.locator('#guide-stale')).to_be_visible();expect(self.page.locator('#guide-adopt')).to_be_disabled()
        self.force_click('#guide-adopt');expect(self.page.locator('#guide-notice')).to_contain_text('바뀌어 이 초안은 넣지 않았어요')
        self.assertEqual(self.state()['draft'],'');self.assertIn(A,text.input_value())
        # B -> A (ABA): the draft matches the input again and can be adopted.
        ins.fill(A);expect(self.page.locator('#guide-stale')).to_have_count(0);expect(self.page.locator('#guide-adopt')).to_be_enabled()
        # A manual edit is kept across a change; the reply for B is held, and is not applied once the input moved on to C.
        mine=text.input_value()+'\n(직접 메모)';text.fill(mine);ins.fill(B);self.page.locator('#guide-fresh').click()
        expect(self.page.locator('#guide-take-incoming')).to_be_visible();expect(text).to_have_value(mine)
        ins.fill(C);expect(self.page.locator('#guide-take-incoming')).to_be_disabled()
        self.force_click('#guide-take-incoming');expect(self.page.locator('#guide-notice')).to_contain_text('지금 입력과 다른 기준으로 만든 것이라 적용하지 않았어요');expect(text).to_have_value(mine)
        expect(self.page.locator('#guide-adopt')).to_be_disabled()
        # Back to B: the held reply matches again, is applied on request, and that valid draft is adopted with B, not A.
        ins.fill(B);expect(self.page.locator('#guide-take-incoming')).to_be_enabled();self.page.locator('#guide-take-incoming').click()
        expect(text).to_have_value(text_re(B));self.assertNotIn(A,text.input_value());self.page.locator('#guide-adopt').click()
        expect(self.page.locator('#draft')).to_have_value(text_re(B));self.assertNotIn(A,self.state()['draft']);self.assertEqual(self.state()['tasks'],[])
        self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        s=self.state();self.assertIn(B,s['sources'][0]['text']);self.assertEqual([b['status'] for b in s['bases']],['requested'],'a request record, not a decision')

def text_re(fragment):
    import re;return re.compile(re.escape(fragment))

if __name__=='__main__':unittest.main(verbosity=2)
