"""FRESH033 narrow native regression; original mock, HTTP, storage and import/export.
No provider calls or request/response substitution. Scripts click disabled controls only
for the no-effect check; their disabled attribute is never removed.
"""
from pathlib import Path
import json, os, unittest
from playwright.sync_api import expect
import browser as base

REQUEST='빈자리가 생기면 대기자를 자동으로 예약해줘.'
ORIGINAL='대기 순서는 먼저 신청한 사람 순으로 유지한다.'
CHANGED='예약은 참여 확인 뒤에만 확정한다. 대기 순서는 먼저 신청한 사람 순으로 유지한다.'
OLD_REPLY='바로 예약 확정 — 추가 응답 없이 예약이 성립합니다. 참여 의사를 별도로 확인하지 않습니다.'
OUT=Path(os.environ.get('FRESH033_EVIDENCE',str(base.OUT/'fresh033')))
OUT.mkdir(parents=True,exist_ok=True)

@unittest.skipIf(base.DOM,'FRESH033 requires native browser HTTP/storage')
class FRESH033(unittest.TestCase):
    setUpClass=classmethod(base.Browser.setUpClass.__func__)
    tearDownClass=classmethod(base.Browser.tearDownClass.__func__)
    setUp=base.Browser.setUp
    tearDown=base.Browser.tearDown
    state=base.Browser.state
    compose=base.Browser.compose
    context=base.Browser.context
    send=base.Browser.send
    basis=base.Browser.basis
    backup=base.Browser.backup
    download_work=base.Browser.download_work
    import_file=base.Browser.import_file

    def observe(self):
        self.wires=[]
        self.page.on('request',lambda r:self.wires.append(r.post_data_json) if r.url.endswith('/api/continuity') and r.method=='POST' else None)
    def save(self,name,value):
        (OUT/name).write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')
    def shot(self,name):
        self.page.mouse.move(1,1)
        self.page.evaluate('window.scrollTo(0,0)')
        self.page.screenshot(path=str(OUT/name),full_page=True)
    def assert_readonly(self,unknown=False):
        expect(self.page.locator('#question-box')).to_contain_text('이전 질문 · 참고 기록')
        expect(self.page.locator('#question-box')).to_contain_text('시점 확인 불가' if unknown else '기준 변경 전')
        expect(self.page.locator('#answer-draft')).to_have_attribute('readonly','')
        expect(self.page.locator('#answer-draft')).to_have_attribute('placeholder','')
        for selector in ['.option-button','#answer-send','#answer-unknown','#answer-defer']:
            for control in self.page.locator(selector).all():expect(control).to_be_disabled()
        expect(self.page.locator('#stage-label')).to_have_attribute('data-stage','stale')
        expect(self.page.locator('#stage-label')).not_to_have_text('답변이 필요해요')
        before=self.state();count=len(self.wires)
        for control in self.page.locator('.option-button,#answer-send,#answer-unknown,#answer-defer').all():control.evaluate('(e)=>e.click()')
        self.assertEqual(self.state(),before);self.assertEqual(len(self.wires),count)

    def test_f01_relay_stale_reply_never_enters_next_native_request(self):
        self.observe();self.send(REQUEST);self.basis(ORIGINAL)
        self.page.locator('#close-context').click()
        self.page.locator('#retry-work').click();expect(self.page.locator('#working')).to_have_text('')
        self.page.locator('#answer-draft').fill('미제출 답변 원문 보존')
        self.context();self.page.locator('#edit-D2').evaluate('(e)=>e.open=true')
        self.page.locator('#text-D2').fill(CHANGED)
        self.page.locator('#edit-D2').get_by_role('button',name='수정 기록',exact=True).click()
        self.page.locator('#close-context').click()
        before=self.state();count=len(self.wires)
        self.page.reload();expect(self.page.locator('#question-box')).to_be_visible()
        self.assertEqual(self.state(),before);self.assertEqual(len(self.wires),count)
        self.shot('relay-stale.png')
        # Before the fix this native click submits the old option and triggers HTTP.
        self.page.locator('.option-button').first.evaluate('(e)=>e.click()')
        expect(self.page.locator('#working')).to_have_text('')
        self.save('ui-relay.json',{'before':before,'after':self.state(),'requests':self.wires,'newRequests':len(self.wires)-count,'nextRequestIncludesOldReply':any(OLD_REPLY in json.dumps(r,ensure_ascii=False) for r in self.wires[count:])})
        self.assertEqual(self.state(),before,'stale option must not add an answer/source/basis')
        self.assertEqual(len(self.wires),count)
        self.assert_readonly();expect(self.page.locator('#answer-draft')).to_have_value('미제출 답변 원문 보존')
        backup=self.backup('fresh033-stale-recovery.json');self.import_file(backup);self.assert_readonly()
        self.assertEqual(self.state(),before);self.assertEqual(len(self.wires),count)
        handoff=self.download_work('fresh033-stale-handoff.md')
        self.assertIn('이전 질문 · 참고 기록',handoff);self.assertNotIn('### 남은 제품 선택',handoff)
        self.page.locator('#nav-history').click();expect(self.page.locator('#history-list')).to_contain_text('이전 질문')
        self.page.locator('#back-to-work').click();self.assert_readonly()
        self.page.set_viewport_size({'width':390,'height':844});self.shot('relay-stale-mobile.png')
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),390)
        self.page.set_viewport_size({'width':1440,'height':1050})
        self.page.locator('#retry-work').click();expect(self.page.locator('#working')).to_have_text('')
        self.assertEqual(len(self.wires),count+1)
        self.assertNotIn(OLD_REPLY,json.dumps(self.wires[-1],ensure_ascii=False))
        expect(self.page.locator('#answer-draft')).not_to_have_attribute('readonly','')
        expect(self.page.locator('.option-button').first).to_be_enabled()
        expect(self.page.locator('#stage-label')).to_have_attribute('data-stage','question')
        self.shot('relay-refreshed.png')
        self.page.locator('.option-button').nth(1).click();expect(self.page.locator('#working')).to_have_text('')
        self.assertEqual(len(self.wires),count+2)
        self.assertNotIn(OLD_REPLY,json.dumps(self.wires[-1],ensure_ascii=False))
        state=self.state();self.assertEqual(state['sources'][-1]['kind'],'answer')
        self.assertIn('참여 확인 뒤 확정',state['sources'][-1]['text'])
        self.assertEqual(state['bases'][:len(before['bases'])],before['bases'])
        self.save('ui-after-refresh.json',{'project':state,'requests':self.wires,'pageErrors':self.errors})

    def test_f02_legacy_unknown_and_fact_question_keep_records_readonly(self):
        self.observe();self.send('결제가 실패하는 오류가 있어요.')
        current=self.state();legacy=json.loads(json.dumps(current));legacy['schemaVersion']='idea015.project.1';legacy.pop('space',None)  # project.1 predates the plan space
        for b in legacy['bases']:b['locked']=True
        for t in legacy['tasks']:del t['adviceRevision'];del t['resultFile']
        path=OUT/'legacy-fixture.json';self.save(path.name,legacy);count=len(self.wires)
        self.import_file(path);self.assert_readonly(unknown=True)
        self.assertEqual(self.state()['sources'],current['sources']);self.assertEqual(self.state()['bases'],current['bases'])
        self.assertEqual(self.state()['tasks'][0]['advice'],current['tasks'][0]['advice'])
        self.page.reload();expect(self.page.locator('#question-box')).to_be_visible();self.assert_readonly(unknown=True)
        self.assertEqual(len(self.wires),count);self.shot('legacy-unknown.png')
        self.page.locator('#retry-work').click();expect(self.page.locator('#working')).to_have_text('')
        expect(self.page.locator('#answer-unknown')).to_be_enabled()
        self.page.locator('#answer-unknown').click();expect(self.page.locator('#working')).to_have_text('')
        self.assertEqual(self.state()['sources'][-1]['disposition'],'unknown')
        self.save('ui-legacy-after.json',{'project':self.state(),'requests':self.wires,'pageErrors':self.errors})

    def test_f03_rev1_import_history_then_reorganise_and_answer(self):
        self.observe();self.send(REQUEST)
        self.page.locator('#edit-work').evaluate('(e)=>e.open=true')
        self.page.locator('#work-next').fill('사용자가 직접 쓴 작업문을 보존한다.')
        self.page.locator('#edit-work').evaluate('(e)=>e.open=false')
        original=self.state();bad=json.loads(json.dumps(original));b=bad['bases'][0]
        b['history']=[{'text':'이전 요청 원문','status':b['status'],'sourceId':b['sourceId'],'revision':bad['revision']}]
        # Valid import shape, but history is later than both current basis and old advice.
        self.save('rev1-import-fixture.json',bad);calls=len(self.wires)
        self.import_file(OUT/'rev1-import-fixture.json');self.assert_readonly(unknown=True)
        self.assertEqual(self.state(),bad);self.assertEqual(len(self.wires),calls)
        self.shot('rev1-import-unknown.png')
        self.page.locator('#retry-work').click();expect(self.page.locator('#working')).to_have_text('')
        refreshed=self.state()
        self.save('rev1-after-reorganise.json',{'project':refreshed,'requests':self.wires,'pageErrors':self.errors})
        expect(self.page.locator('#stage-label')).to_have_attribute('data-stage','question')
        expect(self.page.locator('.option-button').first).to_be_enabled()
        self.assertEqual(len(self.wires),calls+1)
        self.assertEqual(refreshed['bases'],bad['bases']);self.assertEqual(refreshed['sources'],bad['sources'])
        self.assertEqual(refreshed['tasks'][0]['manual'],bad['tasks'][0]['manual'])
        self.assertEqual(refreshed['tasks'][0]['adviceRevision'],bad['revision'])
        self.shot('rev1-recovered.png')
        self.page.locator('#answer-draft').fill('참여 확인 뒤 확정한다.')
        self.page.locator('#answer-send').click();expect(self.page.locator('#working')).to_have_text('')
        final=self.state();self.assertEqual(len(self.wires),calls+2)
        self.assertEqual(final['sources'][-1]['text'],'참여 확인 뒤 확정한다.')
        self.assertEqual(final['sources'][-1]['kind'],'answer')
        self.assertEqual(final['bases'][:len(bad['bases'])],bad['bases'])
        self.assertEqual(final['sources'][:len(bad['sources'])],bad['sources'])
        self.assertEqual(final['tasks'][0]['manual'],bad['tasks'][0]['manual'])
        self.assertIn('참여 확인 뒤 확정한다.',json.dumps(self.wires[-1],ensure_ascii=False))
        self.save('rev1-final.json',{'project':final,'requests':self.wires,'pageErrors':self.errors})

if __name__=='__main__':unittest.main(verbosity=2)
