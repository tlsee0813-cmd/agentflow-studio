"""FLOW083 native journeys: first visit, project list, switching, legacy upgrade, trash/restore, backup copies and
the copy -> external result handoff. Real Chromium -> real local HTTP -> explicit MOCK. Automated wiring checks only;
they are not evidence that people can use the product without help.
"""
import json, subprocess, unittest
from pathlib import Path
from playwright.sync_api import expect
import browser as base

LEGACY_BACKUP='agentflow.idea015.project.v1.legacy-original'
WORKSPACE='agentflow.idea015.workspace'

class Flow083(unittest.TestCase):
    setUpClass=classmethod(base.Browser.setUpClass.__func__);tearDownClass=classmethod(base.Browser.tearDownClass.__func__)
    setUp=base.Browser.setUp;tearDown=base.Browser.tearDown;state=base.Browser.state;compose=base.Browser.compose;send=base.Browser.send
    def keys(self,page=None):return sorted((page or self.page).evaluate('Object.keys(localStorage)'))
    def raw(self,key,page=None):return (page or self.page).evaluate('(k)=>localStorage.getItem(k)',key)
    def current_entry(self,page=None):return (page or self.page).evaluate('document.documentElement.dataset.entryId')
    def envelope(self,page=None):
        base.saved(page or self.page);raw=self.raw(WORKSPACE,page);return json.loads(raw) if raw else None
    def entry(self,entry_id,page=None):return next(e for e in self.envelope(page)['entries'] if e['entryId']==entry_id)
    def new_tab(self):
        tab=self.ctx.new_page();tab.on('pageerror',lambda e:self.errors.append(str(e)));tab.set_default_timeout(6000)
        tab.goto(self.url);expect(tab.locator('#mode')).to_contain_text('MOCK');return tab
    def fit(self,name,page=None):
        page=page or self.page
        for width in [1440,390]:
            page.set_viewport_size({'width':width,'height':1000 if width>800 else 844});page.evaluate('window.scrollTo(0,0)')
            page.screenshot(path=str(base.OUT/f'flow083-{name}-{width}.png'),full_page=True)
            self.assertLessEqual(page.evaluate('document.documentElement.scrollWidth'),width)
        page.set_viewport_size({'width':1440,'height':1050})
    def clipboard(self,ok=True):
        self.page.evaluate('(ok)=>Object.defineProperty(navigator,"clipboard",{value:{writeText:t=>ok?(window.__copied=t,Promise.resolve()):Promise.reject(new Error("denied"))},configurable:true})',ok)

    def test_01_first_visit_starts_without_naming_and_the_example_is_never_saved(self):
        expect(self.page.locator('#empty')).to_be_visible();expect(self.page.locator('#projects-view')).to_be_hidden()
        expect(self.page.locator('#entry-limits')).to_contain_text('AI 연결 없음');expect(self.page.locator('#entry-limits')).to_contain_text('이 브라우저에만')
        expect(self.page.locator('#draft')).to_be_visible();expect(self.page.locator('#nav-history')).to_be_hidden()
        self.fit('first-visit')
        self.page.locator('#open-example').click()
        expect(self.page.locator('#example-banner')).to_be_visible();expect(self.page.locator('#saved')).to_have_text('예제 · 저장하지 않음')
        expect(self.page.locator('#copy-work')).to_be_visible();self.page.locator('#edit-work').evaluate('(e)=>e.open=true')
        self.page.locator('#work-next').fill('예제 안에서 고친 문장');self.fit('example')
        self.assertEqual(self.keys(),[],'nothing from the example is written')
        self.page.locator('#example-close').click();expect(self.page.locator('#example-banner')).to_be_hidden()
        expect(self.page.locator('#empty')).to_be_visible();self.assertEqual(self.keys(),[])
        self.page.locator('#draft').fill('동네 빵집 픽업 주문 사이트를 만들고 싶어요');self.page.locator('#send').click()
        expect(self.page.locator('#working')).to_have_text('');expect(self.page.locator('#current-work')).to_be_visible()
        expect(self.page.locator('#project-name')).to_have_value('동네 빵집 픽업 주문 사이트를 만들고 싶어요')
        state=self.state();self.assertEqual([s['text'] for s in state['sources']],['동네 빵집 픽업 주문 사이트를 만들고 싶어요'])
        self.assertNotIn('예제',json.dumps(state,ensure_ascii=False))
        env=self.envelope();self.assertEqual([(e['origin'],e['state']) for e in env['entries']],[('new','active')])
        self.assertIsNone(self.raw(base.KEY),'the old single-project key is not used for new projects')

    def test_02_revisit_lists_projects_switches_and_never_mixes_them(self):
        self.send('예약 확정 문구를 바꿔줘.');self.page.reload();expect(self.page.locator('#current-work')).to_be_visible() # a reload keeps its place
        tab=self.new_tab();expect(tab.locator('#projects-view')).to_be_visible();expect(tab.locator('#current-work')).to_have_count(0)
        card=tab.locator('.project-card').first
        expect(card).to_contain_text('예약 확정 문구를 바꿔줘.');expect(card).to_contain_text('최근 활동');expect(card).to_contain_text('요청 1개')
        self.fit('project-list',tab)
        tab.locator('#new-project').click();expect(tab.locator('#welcome-title')).to_contain_text('새 프로젝트')
        tab.locator('#draft').fill('두 번째 프로젝트: 문의 접수 페이지');tab.locator('#send').click();expect(tab.locator('#working')).to_have_text('')
        first=self.envelope(tab)['entries'][0]['entryId'];second=self.current_entry(tab);self.assertNotEqual(second,first)
        tab.locator('#to-projects').click();expect(tab.locator('#project-list .project-card')).to_have_count(2)
        tab.locator(f'.project-card[data-entry-id="{first}"] .project-open').click()
        self.assertEqual([s['text'] for s in self.state(tab)['sources']],['예약 확정 문구를 바꿔줘.'])
        tab.locator('#nav-projects').click();tab.locator(f'.project-card[data-entry-id="{second}"] .project-open').click()
        self.assertEqual([s['text'] for s in self.state(tab)['sources']],['두 번째 프로젝트: 문의 접수 페이지'])
        expect(tab.locator('#breadcrumb-project')).to_contain_text('두 번째 프로젝트');tab.close()

    def test_03_a_saved_older_project_is_migrated_once_and_its_key_is_never_written(self):
        subprocess.run(['node',str(base.ROOT/'tests/fixtures.mjs'),str(base.OUT)],check=True)
        raw=(base.OUT/'legacy-68.json').read_text(encoding='utf-8')
        self.page.evaluate('(raw)=>localStorage.setItem("agentflow.idea015.project.v1",raw)',raw)
        tab=self.new_tab();expect(tab.locator('#projects-view')).to_be_visible()
        expect(tab.locator('.project-card')).to_have_count(1);expect(tab.locator('.project-card')).not_to_contain_text('예제')
        env=self.envelope(tab);self.assertEqual([(e['origin'],e['state']) for e in env['entries']],[('legacy','active')]);self.assertTrue(env['migratedFromLegacy'])
        self.assertEqual(self.raw(base.KEY,tab),raw,'the old key is never written');self.assertEqual(self.raw(LEGACY_BACKUP,tab),raw,'original bytes kept')
        tab.locator('.project-open').click();expect(tab.locator('#current-work')).to_be_visible();expect(tab.locator('#example-banner')).to_be_hidden()
        expect(tab.locator('#notice')).to_contain_text('project.1')
        tab.locator('#nav-projects').click();tab.once('dialog',lambda d:d.accept());tab.locator('.project-trash').click()
        expect(tab.locator('#trash-count')).to_have_text('1');tab.close()
        again=self.new_tab();expect(again.locator('#projects-view')).to_be_visible()
        self.assertEqual(len(self.envelope(again)['entries']),1,'all trashed and nothing selected: still not migrated again')
        expect(again.locator('.project-card[data-entry-id="legacy"]')).to_have_count(0);self.assertEqual(self.raw(base.KEY,again),raw);again.close()

    def test_04_trash_restore_and_backup_copy_keep_the_whole_project(self):
        self.send('예약 취소 기능을 만들어줘.');self.clipboard();self.page.locator('#copy-work').click()
        self.send('취소 버튼을 추가했다고 보고받음. 실제 클릭 검사는 아직.','report');saved=self.state();key=self.current_entry()
        with self.page.expect_download() as d:self.page.locator('#backup').click()
        backup=base.OUT/'flow083-backup.json';d.value.save_as(backup)
        self.page.locator('#nav-projects').click();self.page.once('dialog',lambda dlg:(self.assertIn('원문·기준·요청·돌아온 결과',dlg.message),self.assertIn('취소되지는 않아요',dlg.message),dlg.accept()))
        self.page.locator(f'.project-card[data-entry-id="{key}"] .project-trash').click()
        expect(self.page.locator('#list-notice')).to_contain_text('휴지통으로 옮겼어요');expect(self.page.locator('#project-list .project-card')).to_have_count(0)
        expect(self.page.locator('#trash-count')).to_have_text('1');self.assertEqual(self.entry(key)['project'],saved,'trash changes the wrapper only')
        self.page.locator('#undo-trash').click();expect(self.page.locator('#project-list .project-card')).to_have_count(1)
        self.page.once('dialog',lambda dlg:dlg.accept());self.page.locator('.project-trash').click()
        tab=self.new_tab();expect(tab.locator('#trash-section')).to_be_visible();self.fit('trash',tab)
        tab.locator('#trash-section').evaluate('(e)=>e.open=true');tab.locator('.project-restore').click()
        expect(tab.locator('#list-notice')).to_contain_text('되살렸어요');tab.locator(f'.project-card[data-entry-id="{key}"] .project-open').click()
        self.assertEqual(self.state(tab),saved,'restored byte-equal: sources, bases, requests, results, edits')
        tab.locator('#nav-projects').click()
        with tab.expect_event('dialog') as event:tab.locator('#import-file').set_input_files(str(backup))
        self.assertIn('새 프로젝트 사본으로 불러올까요?',event.value.message);self.assertIn('바뀌지 않아요',event.value.message);event.value.accept()
        expect(tab.locator('#notice')).to_contain_text('새 프로젝트 사본');copy=self.current_entry(tab);self.assertNotEqual(copy,key)
        self.assertEqual(self.state(tab),saved,'new entryId only: same Project.id, tasks, sources, returnIds');self.assertEqual(self.entry(key,tab)['project'],saved)
        self.assertEqual(self.entry(copy,tab)['origin'],'import')
        tab.locator('#nav-projects').click();expect(tab.locator('#project-list .project-card')).to_have_count(2);tab.close()

    def test_05_an_older_tab_cannot_save_into_a_project_trashed_or_restored_elsewhere(self):
        self.send('문구 하나 바꿔줘.');key=self.current_entry();before=self.entry(key)['project']
        tab=self.new_tab();tab.once('dialog',lambda dlg:dlg.accept());tab.locator('.project-trash').click();expect(tab.locator('#trash-count')).to_have_text('1')
        self.compose();self.page.locator('#draft').fill('오래된 탭에서 쓴 입력')
        expect(self.page.locator('#storage-error')).to_contain_text('휴지통');self.assertEqual(self.entry(key)['project'],before)
        expect(self.page.locator('#draft')).to_have_value('오래된 탭에서 쓴 입력');self.assertEqual(self.entry(key)['state'],'trashed','not listed back')
        tab.locator('#trash-section').evaluate('(e)=>e.open=true');tab.locator('.project-restore').click();expect(tab.locator('#list-notice')).to_contain_text('되살렸어요')
        self.page.locator('#draft').fill('되살린 뒤에도 오래된 탭의 지연 저장');expect(self.page.locator('#storage-error')).to_contain_text('되살려')
        self.assertEqual(self.entry(key)['project'],before,'restored, but this tab opened an older lifecycle');self.assertEqual(self.entry(key)['lifecycle'],3)
        tab.close()

    def test_06_request_input_stays_separate_and_each_handoff_step_says_what_happened(self):
        self.send('결제 실패 안내 문구를 바꿔줘.')
        expect(self.page.locator('#stage-label')).to_have_attribute('data-stage','ready')
        self.assertTrue(self.page.locator('#next-actions #copy-work').evaluate('(e)=>e.classList.contains("primary")'))
        self.assertEqual(self.page.locator('#work #draft').count(),0,'the request input is not inside the output card')
        self.page.locator('#next-new-request').click();expect(self.page.locator('#draft')).to_be_focused()
        expect(self.page.locator('#request-tab')).to_have_attribute('aria-pressed','true')
        self.page.locator('#next-preview').click();expect(self.page.locator('#handoff-text')).to_be_visible()
        self.assertEqual(len(self.state()['tasks'][0]['handoffs']),0,'viewing is not a handoff')
        self.clipboard(False);self.page.locator('#copy-work').click();expect(self.page.locator('#notice')).to_contain_text('클립보드를 사용할 수 없습니다')
        self.assertEqual(len(self.state()['tasks'][0]['handoffs']),0,'a failed copy records nothing')
        self.clipboard();self.page.locator('#copy-work').click();expect(self.page.locator('#notice')).to_contain_text('전송·실행된 것은 아닙니다')
        expect(self.page.locator('#stage-label')).to_have_attribute('data-stage','exported');expect(self.page.locator('#bring-report')).to_be_visible()
        self.assertTrue(self.page.locator('#bring-report').evaluate('(e)=>e.classList.contains("primary")'))
        expect(self.page.locator('#handoff-ready')).to_contain_text('실행됐는지는 이 앱이 알 수 없어요')
        with self.page.expect_download():self.page.locator('#download-work').click()
        expect(self.page.locator('#notice')).to_contain_text('Markdown 파일로 저장했어요')
        self.assertEqual([h['method'] for h in self.state()['tasks'][0]['handoffs']],['clipboard','download'])
        for text in [self.page.locator('#context-bar, .context-bar').first.inner_text(),self.page.locator('#handoff-ready').inner_text()]:
            self.assertNotIn('완료했',text);self.assertNotIn('실행 중',text)
        self.page.locator('#bring-report').click();expect(self.page.locator('#report-tab')).to_have_attribute('aria-pressed','true')
        self.page.locator('#draft').fill('문구를 바꿨다고 보고받음.');self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        self.page.locator('#nav-history').click();items=self.page.locator('.history-item')
        expect(items).to_have_count(2);expect(items.first).to_have_attribute('data-kind','report')
        expect(items.first).to_contain_text('가져온 결과 · 구현 보고');expect(items.first).to_contain_text('#1')
        expect(items.nth(1)).to_have_attribute('data-kind','request');expect(items.nth(1)).to_contain_text('1번 복사')
        self.fit('history')

    def test_07_a_late_answer_after_switching_to_a_same_id_copy_changes_neither(self):
        self.send('예약 문구를 바꿔줘.');first=self.current_entry()
        with self.page.expect_download() as d:self.page.locator('#backup').click()
        path=base.OUT/'flow083-same-id.json';d.value.save_as(path)
        parked=[];self.page.route('**/api/continuity',lambda route:parked.append((route,route.fetch())))
        self.page.locator('#retry-work').click();self.page.wait_for_function('document.querySelector("#working").textContent.length>0')
        self.page.wait_for_timeout(100);self.assertEqual(len(parked),1)
        with self.page.expect_event('dialog') as event:self.page.locator('#import-file').set_input_files(str(path))
        event.value.accept();expect(self.page.locator('#notice')).to_contain_text('새 프로젝트 사본');copy=self.current_entry();self.assertNotEqual(copy,first)
        copy_before=self.entry(copy)['project'];first_before=self.entry(first)['project']
        self.assertEqual(copy_before['id'],first_before['id'],'the copies share Project.id')
        route,response=parked.pop();route.fulfill(response=response);self.page.unroute('**/api/continuity');self.page.wait_for_timeout(300)
        self.assertEqual(self.entry(copy)['project'],copy_before);self.assertEqual(self.entry(first)['project'],first_before)
        expect(self.page.locator('#working')).to_have_text('')

    def test_08_without_web_locks_nothing_is_written_and_input_stays(self):
        tab=self.ctx.new_page();tab.on('pageerror',lambda e:self.errors.append(str(e)));tab.set_default_timeout(6000)
        tab.add_init_script('Object.defineProperty(Navigator.prototype,"locks",{get(){return undefined},configurable:true})')
        tab.goto(self.url);expect(tab.locator('#mode')).to_contain_text('MOCK')
        expect(tab.locator('#storage-error')).to_contain_text('Web Locks')
        tab.locator('#draft').fill('잠금 없이 쓴 입력');expect(tab.locator('#saved')).to_have_text('저장되지 않은 변경 있음')
        expect(tab.locator('#draft')).to_have_value('잠금 없이 쓴 입력');self.assertEqual(self.keys(tab),[])
        with tab.expect_download() as d:tab.locator('#backup').click()
        self.assertEqual(json.loads(Path(d.value.path()).read_text(encoding='utf-8'))['draft'],'잠금 없이 쓴 입력');tab.close()

if __name__=='__main__':unittest.main(verbosity=2)
