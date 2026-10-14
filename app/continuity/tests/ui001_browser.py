"""UI001 changed journeys only. Reuses the existing browser fixture, NOT its tests.
Default: native Chromium -> HTTP. Explicit DOM bridge: substitute storage/config/network as labelled.
No keys, external provider requests, external resources or CLI execution.
"""
from pathlib import Path
import json, os, sys, unittest
sys.dont_write_bytecode=True
from playwright.sync_api import expect
import browser as base
import dom_harness

SHOTS=Path(os.environ.get('UI001_SCREENSHOTS',str(base.OUT/'screenshots')))
SHOTS.mkdir(parents=True,exist_ok=True)

class UI001(unittest.TestCase):
    # Shared fixture only; no inheritance/duplication of the 13 baseline tests.
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

    def snapshot(self,name,width=1440):
        self.page.set_viewport_size({'width':width,'height':1000 if width>800 else 844})
        self.page.mouse.move(1,1)
        self.page.evaluate('window.scrollTo(0,0)')
        self.page.screenshot(path=str(SHOTS/name),full_page=True)
    def calls(self):
        return self.bridge_calls.count('/api/continuity') if base.DOM else len(self.sent)
    def track(self):
        self.sent=[]
        self.page.on('request',lambda r:self.sent.append(r.url) if '/api/continuity' in r.url else None)
    def remount(self,raw=None,config=None):
        self.page.close();self.page=self.ctx.new_page();self.page.on('pageerror',lambda e:self.errors.append(str(e)))
        self.config_override=config
        if base.DOM:dom_harness.mount(self,self.page,raw)
        else:
            if config is not None:self.page.route('**/api/config',lambda route:route.fulfill(status=200,content_type='application/json',body=json.dumps(config)))
            if raw is not None:self.page.add_init_script('localStorage.setItem('+json.dumps(base.KEY)+','+json.dumps(raw)+');')
            self.page.goto(self.url)
            base.open_listed(self.page) # FLOW083: a new tab lists projects first; open the seeded one as before.
        self.track()
        expect(self.page.locator('#mode')).not_to_have_text('모드 확인 중')

    def test_ui01_empty_examples_and_real_event_next_action(self):
        self.track();expect(self.page.locator('#send')).to_be_disabled()
        expect(self.page.locator('#context-panel')).to_be_hidden();expect(self.page.locator('#empty')).to_be_visible()
        self.page.locator('#project-name').fill('수업 예약 서비스')
        self.page.locator('#compose-title').click();self.snapshot('01-empty-desktop.png')
        before=self.calls();self.page.locator('.example').first.click()
        self.assertEqual(self.calls(),before)
        self.assertIn('예약 완료',self.page.locator('#draft').input_value());expect(self.page.locator('#send')).to_be_enabled()
        self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        expect(self.page.locator('#stage-label')).to_have_attribute('data-stage','ready')
        self.assertFalse(self.page.locator('#compose-panel').evaluate('(e)=>e.open'))
        self.assertTrue(self.page.locator('#copy-work').evaluate('(e)=>e.classList.contains("primary")'))
        before_revision=self.state()['revision'];self.page.locator('#nav-context').click()
        self.assertEqual(self.state()['revision'],before_revision);expect(self.page.locator('#context-panel')).to_be_visible()
        self.page.keyboard.press('Escape');expect(self.page.locator('#nav-context')).to_be_focused()
        text=self.download_work('ui001-first-handoff.md');self.assertIn('예약 완료',text)
        expect(self.page.locator('#bring-report')).to_be_visible();expect(self.page.locator('#stage-label')).to_have_text('작업문 내보냄')
        self.page.locator('#bring-report').click();expect(self.page.locator('#report-tab')).to_have_attribute('aria-pressed','true')
        expect(self.page.locator('#draft')).to_be_focused();self.page.locator('#draft').fill('문구 변경을 완료했다고 보고받음. 실제 클릭 검사는 아직 하지 않음.')
        self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        state=self.state();self.assertEqual(state['sources'][-1]['kind'],'report');self.assertEqual(state['tasks'][-1]['parentTaskId'],state['tasks'][0]['id'])
        expect(self.page.locator('#last-result-summary')).to_contain_text('앱 미검증')
        expect(self.page.locator('#current-source > summary')).to_contain_text('구현자 보고 · 미검증')
        before=self.state();self.page.locator('#nav-history').click();expect(self.page.locator('#history-view')).to_be_visible()
        self.assertEqual(self.state(),before);expect(self.page.locator('#history-list')).to_contain_text('구현 보고 도착 · 앱 미검증');expect(self.page.locator('#history-list')).to_contain_text('파일 생성')
        self.page.locator('#back-to-work').click();expect(self.page.locator('#work-view')).to_be_visible()

    def test_ui02_question_priority_and_pending_cancel_preserves_typing(self):
        self.send('빈자리가 생기면 대기자를 자동으로 예약해줘.')
        expect(self.page.locator('#stage-label')).to_have_attribute('data-stage','question')
        expect(self.page.locator('#answer-send')).to_be_disabled();self.assertFalse(self.page.locator('#compose-panel').evaluate('(e)=>e.open'))
        self.assertLess(self.page.locator('#question-box').bounding_box()['y'],self.page.locator('#compose-panel').bounding_box()['y'])
        self.snapshot('04-question-desktop.png')
        parked=[]
        if base.DOM:self.page.evaluate("window.__testFault='delay'")
        else:self.page.route('**/api/continuity',lambda route:parked.append((route,route.fetch())))
        self.page.locator('#answer-draft').fill('참여 확인 뒤에만 예약을 확정해줘.')
        self.page.locator('#answer-send').click()
        if base.DOM:self.page.wait_for_function('!!window.__releaseTest')
        else:self.page.wait_for_timeout(200)
        expect(self.page.locator('#retry-work')).to_be_disabled();expect(self.page.locator('#stage-label')).to_have_attribute('data-stage','pending')
        expect(self.page.locator('#pending-bar')).to_be_in_viewport()
        self.compose();self.page.locator('#draft').fill('다음 요청으로 쓸 작성 중 문장')
        expect(self.page.locator('#send')).to_be_disabled();self.page.locator('#cancel').click()
        expect(self.page.locator('#working')).to_have_text('');expect(self.page.locator('#notice')).to_contain_text('중단')
        if base.DOM:self.page.evaluate('window.__releaseTest()');self.page.evaluate('window.__testFault=null')
        else:
            for route,response in parked:route.fulfill(response=response)
            self.page.unroute('**/api/continuity')
        expect(self.page.locator('#draft')).to_have_value('다음 요청으로 쓸 작성 중 문장')
        self.assertEqual(len([s for s in self.state()['sources'] if s['kind']=='answer']),1)
        self.page.locator('#retry-work').click();expect(self.page.locator('#working')).to_have_text('')
        expect(self.page.locator('#question-box')).to_have_count(0)
        self.assertEqual(len([s for s in self.state()['sources'] if s['kind']=='answer']),1)

    def test_ui03_manual_live_preview_and_unapplied_basis_draft_reopen(self):
        self.send('예약 완료 문구만 바꿔줘.');self.basis('예약 성립 방식과 대기 순서는 그대로 유지한다.')
        self.page.locator('#edit-work').evaluate('(e)=>e.open=true')
        self.page.locator('#work-next').fill('예약 완료 화면의 문구만 수정한다. 기존 예약 처리에는 손대지 않는다.')
        expect(self.page.locator('#instruction-preview')).to_have_text('예약 완료 화면의 문구만 수정한다. 기존 예약 처리에는 손대지 않는다.')
        expect(self.page.locator('#instruction-author')).to_have_text('사용자 직접 수정')
        expect(self.page.locator('#work-authorship')).to_contain_text('직접 수정 포함')
        self.page.locator('#edit-D2').evaluate('(e)=>e.open=true');self.page.locator('#text-D2').fill('아직 반영하지 않은 기준 초안')
        expect(self.page.locator('#draft-status-D2')).to_contain_text('아직 반영되지')
        before=self.state();self.assertEqual(before['bases'][1]['text'],'예약 성립 방식과 대기 순서는 그대로 유지한다.')
        calls_before=self.calls() if base.DOM else 0
        self.remount(json.dumps(before,ensure_ascii=False))
        expect(self.page.locator('#context-panel')).to_be_visible();expect(self.page.locator('#text-D2')).to_be_visible()
        expect(self.page.locator('#text-D2')).to_have_value('아직 반영하지 않은 기준 초안');expect(self.page.locator('#draft-status-D2')).to_be_visible()
        self.assertEqual(self.state()['bases'],before['bases']);self.assertEqual(self.calls(),calls_before)
        # Confirming the field is its direct edit, not a second permission gate.
        self.page.locator('#edit-D2 button',has_text='수정 기록').click()
        self.assertEqual(self.state()['bases'][1]['text'],'아직 반영하지 않은 기준 초안');expect(self.page.locator('#draft-status-D2')).to_be_hidden()

    def test_ui04_actual_roundtrip_keeps_drafts_and_restore_does_not_resend(self):
        self.send('CSV 내려받기를 추가해줘.');self.compose();self.page.locator('#draft').fill('아직 보내지 않은 다음 작업')
        original=self.state();path=self.backup('ui001-roundtrip.json')
        self.page.locator('#draft').fill('가져오기로 교체할 현재 입력')
        self.page.once('dialog',lambda d:d.accept());self.page.locator('#import-file').set_input_files(path)
        expect(self.page.locator('#draft')).to_have_value('아직 보내지 않은 다음 작업')
        self.assertEqual(self.state(),original)
        before=self.calls() if base.DOM else 0
        self.remount(json.dumps(original,ensure_ascii=False));expect(self.page.locator('#draft')).to_be_visible()
        expect(self.page.locator('#compose-draft-status')).to_have_text('작성 중인 입력 있음')
        self.assertEqual(self.calls(),before);self.assertEqual(self.state()['sources'],original['sources'])

    def test_ui05_storage_error_labels_survive_import_and_input_stays_recoverable(self):
        self.send('문구만 바꿔줘.');path=self.backup('ui001-before-storage-failure.json')
        self.page.evaluate('()=>{window.__originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException("full","QuotaExceededError")}}')
        self.compose();self.page.locator('#draft').fill('저장 실패 중에 입력한 내용을 지키기')
        expect(self.page.locator('#saved')).to_have_text('저장되지 않은 변경 있음');expect(self.page.locator('#storage-error')).to_be_visible()
        recovery=self.backup('ui001-memory-recovery.json');self.assertEqual(json.loads(recovery.read_text())['draft'],'저장 실패 중에 입력한 내용을 지키기')
        # FLOW083 (Sol storage boundary): a copy that cannot be written is not opened; the unsaved input stays here.
        self.page.once('dialog',lambda d:d.accept());self.page.locator('#import-file').set_input_files(path)
        expect(self.page.locator('#notice')).to_contain_text('새 프로젝트로 저장하지 못했습니다')
        expect(self.page.locator('#draft')).to_have_value('저장 실패 중에 입력한 내용을 지키기')
        expect(self.page.locator('#saved')).to_have_text('저장되지 않은 변경 있음')
        self.page.evaluate('()=>{Storage.prototype.setItem=window.__originalSet}')
        self.compose();self.page.locator('#draft').fill('저장 가능해진 뒤의 입력')
        expect(self.page.locator('#saved')).to_have_text('이 브라우저에 저장됨');expect(self.page.locator('#storage-error')).to_be_hidden()

    def test_ui06_config_display_does_not_fake_connection_and_local_edit_needs_no_ai(self):
        self.remount(config={'mode':'deepseek','configured':False,'paidEnabled':False})
        expect(self.page.locator('#mode')).to_have_text('DeepSeek · 호출 꺼짐')
        self.page.locator('#draft').fill('외부 연결 없이 원문만 보관할 요청')
        expect(self.page.locator('#send')).to_be_disabled();expect(self.page.locator('#save-input')).to_be_enabled()
        before=self.calls();self.page.locator('#save-input').click();expect(self.page.locator('#edit-work')).to_have_attribute('open','')
        self.assertEqual(self.calls(),before);expect(self.page.locator('#work-next')).to_be_focused()
        self.page.locator('#work-next').fill('원문 범위 안에서만 작은 작업을 준비한다.')
        text=self.download_work('ui001-offline-handoff.md');self.assertIn('원문 범위 안에서만 작은 작업을 준비한다.',text)
        expect(self.page.locator('#work-authorship')).to_have_text('사용자 직접 작성')
        # Reopen the saved task in both transports; the DOM storage double is per page.
        self.remount(raw=json.dumps(self.state(),ensure_ascii=False),config={'mode':'deepseek','configured':True,'paidEnabled':True})
        expect(self.page.locator('#draft')).to_be_hidden()
        expect(self.page.locator('#mode')).to_have_text('DeepSeek · 요청 가능');expect(self.page.locator('#consent')).to_be_visible()
        self.compose();self.page.locator('#draft').fill('동의 전에 전송하지 않을 요청');expect(self.page.locator('#send')).to_be_disabled()
        before=self.calls();self.page.locator('#consent').check();expect(self.page.locator('#send')).to_be_enabled()
        self.assertEqual(self.calls(),before);self.page.locator('#consent').uncheck();expect(self.page.locator('#send')).to_be_disabled()
        self.assertEqual(self.calls(),before)

    def test_ui07_responsive_work_context_and_keyboard_no_horizontal_overflow(self):
        self.page.locator('#project-name').fill('수업 예약 서비스')
        self.send('예약 확정 문구를 ‘신청 완료’에서 ‘예약 완료’로 바꿔줘. 예약 방식은 그대로 유지해줘.')
        self.basis('기존 예약 방식과 대기 순서는 유지한다. 이번에는 안내 문구만 바꾼다.')
        self.page.locator('#retry-work').click();expect(self.page.locator('#working')).to_have_text('')
        self.page.locator('#edit-work').evaluate('(e)=>e.open=true')
        self.page.locator('#work-next').fill('예약 완료 화면에서 ‘신청 완료’를 ‘예약 완료’로 바꾼다.\n예약 확정 로직과 대기 순서는 변경하지 않는다.\n바꾼 문구가 화면과 접근성 이름에 함께 반영되는지 확인한다.')
        self.page.locator('#work-checks').fill('예약 후 ‘예약 완료’가 표시된다. 기존 예약 성립 방식과 대기 순서는 그대로다.')
        self.page.locator('#edit-work').evaluate('(e)=>e.open=false');self.page.locator('#add-basis').evaluate('(e)=>e.open=false')
        self.snapshot('02-work-desktop.png')
        self.page.locator('#close-context').click();self.snapshot('03-work-narrow.png',390)
        for width in [320,390,768,1024,1440]:
            self.page.set_viewport_size({'width':width,'height':900})
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
            self.page.locator('#nav-context').click();expect(self.page.locator('#context-panel')).to_be_visible()
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
            self.page.keyboard.press('Escape');expect(self.page.locator('#nav-context')).to_be_focused()
        self.page.locator('#nav-history').click();self.page.keyboard.press('Tab')
        self.assertIsNotNone(self.page.evaluate('document.activeElement.id'))

    def test_ui08_delayed_clipboard_and_return_cta_do_not_mislabel_unsent_draft(self):
        self.send('예약 안내 문구만 바꿔줘.')
        # A clipboard permission delay is injected; this is not native clipboard permission evidence.
        self.page.evaluate('()=>{Object.defineProperty(navigator,"clipboard",{value:{writeText:()=>new Promise(resolve=>window.__resolveCopy=resolve)},configurable:true})}')
        self.page.locator('#copy-work').click();self.page.wait_for_function('!!window.__resolveCopy')
        self.compose();self.page.locator('#draft').fill('이어서 보낼 새 요청. 아직 전송하지 않았어요.')
        self.page.evaluate('window.__resolveCopy()');expect(self.page.locator('#notice')).to_contain_text('그 사이 입력이 바뀌었습니다')
        self.assertEqual(len(self.state()['tasks'][0]['handoffs']),0)
        expect(self.page.locator('#stage-label')).to_have_attribute('data-stage','ready')
        self.download_work('ui001-copy-after-edit.md')
        expect(self.page.locator('#bring-report')).to_have_text('작성 중인 입력 이어쓰기')
        self.page.locator('#bring-report').click();expect(self.page.locator('#draft')).to_be_focused()
        expect(self.page.locator('#draft')).to_have_value('이어서 보낼 새 요청. 아직 전송하지 않았어요.')
        self.assertEqual(self.state()['draftKind'],'request');expect(self.page.locator('#notice')).to_contain_text('출처 구분은 바꾸지 않았습니다')

    def test_ui09_rev1_suggestion_changes_require_reexport_without_draft_false_positive(self):
        self.track();self.send('안내 문구만 바꿔줘.')
        # Explicit synthetic project fixture via the real JSON import UI. No provider change/call.
        fixture=self.state()
        fixture['tasks'][0]['advice']['suggestions']=[{'text':'전달 전 문구를 읽어보세요.','why':'오탈자를 찾는 데 도움이 됩니다.'}]
        path=base.OUT/'ui001-rev1-suggestions-fixture.json'
        path.write_text(json.dumps(fixture,ensure_ascii=False),encoding='utf-8')
        before=self.calls();self.page.once('dialog',lambda d:d.accept())
        self.page.locator('#import-file').set_input_files(path)
        expect(self.page.locator('#edit-work')).to_be_visible()
        self.assertEqual(self.calls(),before)
        self.download_work('ui001-rev1-suggestions-original.md')
        expect(self.page.locator('#stage-label')).to_have_text('작업문 내보냄')
        self.page.locator('#edit-work > summary').click()
        for key,value in [('text','전달 전에 바뀐 문구와 범위를 확인하세요.'),('why','누락된 조건을 전달 전에 발견할 수 있습니다.')]:
            self.page.locator('#suggestion-0-'+key).fill(value)
            expect(self.page.locator('#stage-label')).to_have_text('내보낸 뒤 수정됨')
            expect(self.page.locator('#stage-label')).to_have_attribute('data-stage','ready')
            expect(self.page.locator('#copy-work')).to_have_text('수정한 작업문 복사')
            expect(self.page.locator('#bring-report')).to_be_hidden()
            self.assertIn(value,self.page.locator('#handoff-text').input_value())
            text=self.download_work('ui001-rev1-suggestions-'+key+'.md')
            self.assertIn(value,text)
            expect(self.page.locator('#stage-label')).to_have_text('작업문 내보냄')
            expect(self.page.locator('#copy-work')).to_have_text('작업문 복사')
            expect(self.page.locator('#bring-report')).to_be_visible()
        # Unsubmitted input increments project revision but changes no delivered handoff content.
        self.compose();self.page.locator('#draft').fill('아직 전송하지 않은 다음 요청')
        expect(self.page.locator('#stage-label')).to_have_text('작업문 내보냄')
        expect(self.page.locator('#copy-work')).to_have_text('작업문 복사')
        expect(self.page.locator('#bring-report')).to_have_text('작성 중인 입력 이어쓰기')
        self.assertEqual(self.calls(),before,'local suggestion edits, exports and draft typing do not call AI')

    @unittest.skipIf(base.DOM,'RETURN032 walkthrough requires native HTTP, downloads and localStorage')
    def test_ui10_return032_recorded_bases_drafts_recovery_reexport_and_real_parent(self):
        self.track();self.send('결과 연결 안내 문구만 바꿔줘.')
        self.basis('기존 결과 저장 방식은 유지한다.')
        self.page.locator('#edit-work').evaluate('(e)=>e.open=true')
        self.page.locator('#work-scope').fill('읽기 전용 안내만 추가한다.')
        self.page.locator('#work-checks').fill('기존 결과 원문과 출처는 그대로 보존한다.')
        self.download_work('return032-h0.md')
        original=self.state();target=original['currentTaskId'];before=self.calls()
        self.compose();self.page.locator('#report-tab').click()
        expect(self.page.locator('#return-target')).to_have_text('연결 예정 · 결과 연결 안내 문구만 바꿔줘.')
        expect(self.page.locator('#return-export')).to_contain_text('내보낸 시점')
        expect(self.page.locator('#return-records > summary')).to_have_text('이후 기록된 기준 0개')
        self.page.locator('#draft').fill('작성 중인 결과 원문 <b>보존</b>')
        self.page.locator('#project-name').fill('RETURN032 기능 walkthrough')
        self.context();self.page.locator('#add-basis').evaluate('(e)=>e.open=true')
        self.page.locator('#basis-draft').fill('아직 기록하지 않은 새 기준')
        self.page.locator('#edit-D2').evaluate('(e)=>e.open=true')
        self.page.locator('#text-D2').fill('내보낸 시점과 이후 기준 기록도 표시한다.')
        expect(self.page.locator('#return-records > summary')).to_have_text('이후 기록된 기준 0개')
        self.page.locator('#edit-D2 button',has_text='수정 기록').click()
        expect(self.page.locator('#return-records > summary')).to_have_text('이후 기록된 기준 1개')
        self.page.locator('#close-context').click();self.page.locator('#edit-work').evaluate('(e)=>e.open=false')
        self.page.locator('#return-records > summary').click()
        expect(self.page.locator('#return-records')).to_contain_text('D2 · 사용자 확정')
        expect(self.page.locator('#return-records .source-raw')).to_have_text('내보낸 시점과 이후 기준 기록도 표시한다.')
        self.assertEqual(self.page.locator('#return-preview input, #return-preview button').count(),0)
        self.snapshot('return032-recorded-desktop.png')
        self.snapshot('return032-recorded-mobile.png',390)
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),390)
        self.page.set_viewport_size({'width':1440,'height':1050})
        expected=self.state();path=self.backup('return032-recovery.json')
        self.page.reload();expect(self.page.locator('#mode')).to_contain_text('MOCK')
        self.compose();expect(self.page.locator('#return-records > summary')).to_have_text('이후 기록된 기준 1개')
        self.assertEqual(self.state(),expected);self.assertEqual(self.calls(),before)
        self.page.locator('#draft').fill('다른 초안')
        self.page.once('dialog',lambda d:d.accept());self.page.locator('#import-file').set_input_files(path)
        self.compose();expect(self.page.locator('#draft')).to_have_value('작성 중인 결과 원문 <b>보존</b>')
        expect(self.page.locator('#return-records > summary')).to_have_text('이후 기록된 기준 1개')
        self.assertEqual(self.state(),expected)
        self.page.locator('#source-options').evaluate('(e)=>e.open=true')
        for kind in ['request','test_answer']:
            self.page.locator('#source-kind').select_option(kind);expect(self.page.locator('#return-preview')).to_be_hidden()
            expect(self.page.locator('#draft')).to_have_value('작성 중인 결과 원문 <b>보존</b>')
        self.page.locator('#source-kind').select_option('evidence')
        expect(self.page.locator('#return-records > summary')).to_have_text('이후 기록된 기준 1개')
        self.download_work('return032-h1.md')
        expect(self.page.locator('#return-records > summary')).to_have_text('마지막 내보내기 이후 기록된 기준 0개')
        self.assertEqual(self.calls(),before,'preview, editing, recovery and export add no AI calls')
        observed=self.state();self.assertEqual(observed['tasks'][0]['manual'],original['tasks'][0]['manual'])
        self.assertEqual(observed['sources'][:len(original['sources'])],original['sources'])
        self.assertEqual(observed['bases'][1]['history'][0]['text'],original['bases'][1]['text'])
        self.assertEqual(self.page.locator('#return-preview').get_attribute('data-target-task-id'),target)
        self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        result=self.state();self.assertEqual(result['tasks'][-1]['parentTaskId'],target)
        self.assertEqual(result['sources'][-1]['kind'],'evidence');self.assertEqual(result['sources'][-1]['text'],'작성 중인 결과 원문 <b>보존</b>')
        self.assertEqual(result['bases'],observed['bases']);self.assertEqual(result['tasks'][0]['manual'],original['tasks'][0]['manual'])
        expect(self.page.locator('#last-result-summary')).to_contain_text('앱 미검증')
        self.assertEqual(self.page.locator('#return-preview b').count(),0)
        self.snapshot('return032-result-linked.png')

    def test_ui11_return032_no_target_no_export_and_legacy_remain_submittable(self):
        self.track();self.compose();self.page.locator('#report-tab').click()
        expect(self.page.locator('#return-target')).to_have_text('연결할 이전 작업 없음')
        expect(self.page.locator('#return-export')).to_have_text('내보낸 기록 없음')
        expect(self.page.locator('#return-unavailable')).to_have_text('기준 기록 비교 불가')
        self.send('처음 들어온 보고 원문','report');self.assertIsNone(self.state()['tasks'][-1]['parentTaskId'])
        target=self.state()['currentTaskId'];self.compose()
        expect(self.page.locator('#return-target')).to_contain_text('처음 들어온 보고 원문')
        expect(self.page.locator('#return-export')).to_have_text('내보낸 기록 없음')
        self.send('이어 온 관찰 자료','evidence');self.assertEqual(self.state()['tasks'][-1]['parentTaskId'],target)
        self.download_work('return032-before-legacy.md')
        fixture=self.state();fixture['schemaVersion']='idea015.project.1';fixture.pop('space',None)  # project.1 predates the plan space
        for b in fixture['bases']:b['locked']=False
        for t in fixture['tasks']:
            t.pop('adviceRevision');t.pop('resultFile')
            t['handoffs']=[{'at':h['at'],'method':h['method'],'revision':h['revision'],'text':'이전 형식 작업문 원문'} for h in t['handoffs']]
        path=base.OUT/'return032-legacy-fixture.json';path.write_text(json.dumps(fixture,ensure_ascii=False),encoding='utf-8')
        calls=self.calls();self.page.once('dialog',lambda d:d.accept());self.page.locator('#import-file').set_input_files(path)
        self.compose();expect(self.page.locator('#return-unavailable')).to_have_text('기준 기록 비교 불가')
        expect(self.page.locator('#return-records')).to_have_count(0)
        expect(self.page.locator('#return-export')).to_contain_text('내보낸 시점')
        self.assertEqual(self.calls(),calls)
        self.snapshot('return032-legacy.png')
        target=self.state()['currentTaskId'];self.send('이전 형식이어도 보고는 보존한다.','report')
        self.assertEqual(self.state()['tasks'][-1]['parentTaskId'],target)
        expect(self.page.locator('#last-result-summary')).to_contain_text('앱 미검증')

if __name__=='__main__':unittest.main(verbosity=2)
