"""Native UI -> actual product HTTP -> hand-authored semantic MOCK fixture.
Verifies wiring, not natural-language/model quality. No storage or response injection.
"""
import json, os, re, subprocess, unittest
from playwright.sync_api import expect
import browser as base

class IntentFlow(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        base.Browser.setUpClass.__func__(cls)
        cls.proc.terminate();cls.proc.wait(timeout=10);cls.proc.stdout.close();cls.proc.stderr.close()
        env={k:os.environ[k] for k in ['PATH','HOME','TEMP','TMP','TMPDIR','SYSTEMROOT','WINDIR'] if k in os.environ}
        cls.proc=subprocess.Popen(['node',str(base.ROOT/'tests/ai055-fixtures.mjs')],env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        line=cls.proc.stdout.readline();match=re.search(r'http://127\.0\.0\.1:\d+',line)
        if not match:raise RuntimeError('Synthetic mock server did not start')
        cls.url=match.group(0)
    tearDownClass=classmethod(base.Browser.tearDownClass.__func__)
    setUp=base.Browser.setUp;tearDown=base.Browser.tearDown
    state=base.Browser.state;compose=base.Browser.compose;send=base.Browser.send

    def test_01_four_turns_correction_http_handoff_restore(self):
        calls=[]
        self.page.on('request',lambda r:calls.append(r.post_data_json) if r.method=='POST' and r.url.endswith('/api/continuity') else None)
        turns=['가입한 고객만 예약 취소','가입시키는 건 번거롭네. 문자로 보낸 링크만 있으면 취소하게 하자. 환불은 이번에 빼고','취소 버튼만 빨갛게','오타도 고쳐줘']
        for text in turns:self.send(text)
        expect(self.page.locator('#intent-goal')).to_have_text('문자로 받은 링크로 가입 없이 예약을 취소한다.')
        expect(self.page.locator('#intent-home')).to_contain_text('환불은 이번 범위에서 제외한다.')
        self.assertEqual(len(calls),4)
        self.assertEqual(calls[-1]['previousIntent']['value']['goal'],'문자로 받은 링크로 가입 없이 예약을 취소한다.')
        self.assertEqual([s['text'] for s in self.state()['sources']],turns)
        with self.page.expect_download() as event:self.page.locator('#download-work').click()
        path=base.OUT/'ai055-handoff.md';event.value.save_as(path);text=path.read_text(encoding='utf-8')
        section=text.split('## 이어가는 목적')[1].split('##')[0]
        self.assertIn('가입 없이',section);self.assertIn('환불',section);self.assertIn('다시 실행하지 않음',section)
        for width in [1440,390]:
            self.page.set_viewport_size({'width':width,'height':1000})
            self.page.locator('#outcome-home').scroll_into_view_if_needed()
            self.page.screenshot(path=str(base.OUT/f'ai055-home-{width}.png'),full_page=True)
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
        # FIX058-B1: an ordinary edit of this task's work field is not a purpose correction.
        self.page.locator('#edit-work').evaluate('(e)=>e.open=true')
        self.page.locator('#work-understanding').fill('이번 작업은 오타 한 곳만 고친다')
        self.page.reload()
        expect(self.page.locator('#intent-goal')).to_have_text('문자로 받은 링크로 가입 없이 예약을 취소한다.')
        expect(self.page.locator('#intent-home h3')).to_have_text('이어갈 목적 · MOCK 정리')
        self.page.locator('#intent-details > summary').click()
        self.page.locator('#intent-edit-goal').fill('문자 링크로 취소, 12시간 만료')
        self.page.locator('#intent-edit-conditions').fill('환불은 제외한다.')
        self.page.locator('#intent-correct').click()
        expect(self.page.locator('#intent-goal')).to_have_text('문자 링크로 취소, 12시간 만료')
        saved=self.state();self.assertEqual(len(calls),4,'manual correction does not call AI')
        self.page.reload();expect(self.page.locator('#intent-goal')).to_have_text('문자 링크로 취소, 12시간 만료')
        self.assertEqual(self.state(),saved)
        # FIX058-B2: the correction lives apart from this task's work; its narrow instruction survives.
        self.assertEqual(saved['tasks'][-1]['manual']['understanding'],'이번 작업은 오타 한 곳만 고친다')
        self.assertEqual(saved['tasks'][-1]['intentEdit']['goal'],'문자 링크로 취소, 12시간 만료')
        with self.page.expect_download() as event:self.page.locator('#download-work').click()
        path=base.OUT/'fix058-corrected-handoff.md';event.value.save_as(path);corrected=path.read_text(encoding='utf-8')
        work=corrected.split('## 이번 작업')[1].split('\n## ')[0]
        self.assertIn('이번 작업은 오타 한 곳만 고친다',work);self.assertNotIn('12시간 만료',work)
        self.assertIn('12시간 만료',corrected.split('## 이어가는 목적')[1].split('\n## ')[0])
        self.page.locator('#retry-work').click();expect(self.page.locator('#working')).to_have_text('')
        self.assertEqual(calls[-1]['previousIntent']['manualGoal'],'문자 링크로 취소, 12시간 만료')
        expect(self.page.locator('#intent-goal')).to_have_text('문자 링크로 취소, 12시간 만료')
        with self.page.expect_download() as event:self.page.locator('#backup').click()
        event.value.save_as(base.OUT/'ai055-backup.json')
        self.page.locator('#intent-details').evaluate('(e)=>e.open=true')
        self.page.locator('#intent-undo').click()
        expect(self.page.locator('#intent-goal')).to_have_text('문자로 받은 링크로 가입 없이 예약을 취소한다.')
        self.assertEqual(len(calls),5,'undo does not call AI')
        self.assertEqual([s['text'] for s in self.state()['sources']],turns)
        (base.OUT/'ai055-requests.json').write_bytes(json.dumps(calls,ensure_ascii=False,indent=2).encode('utf-8'))

    def test_02_explicit_discard_old_purpose_is_reference_not_valid(self):
        # FIX071: explicit MOCK reads a follow-up as 'separate'; the older reading stays version-fresh.
        self.send('예약 취소 기능을 만들어줘.')
        self.send('예약 취소 기능은 폐기하고 고객 문의 접수 페이지를 만들자.')
        line=self.page.locator('#intent-continuing')
        expect(line).to_contain_text('참고 · 앞선 목적 (이전 해석, 현재 유효 여부는 이번 요청이 우선): 예약 취소 기능을 만들어줘.')
        self.assertNotIn('계속 유효',line.inner_text());self.assertNotIn('바꾸지 않음',line.inner_text())
        with self.page.expect_download() as event:self.page.locator('#download-work').click()
        path=base.OUT/'fix071-discard-handoff.md';event.value.save_as(path);text=path.read_text(encoding='utf-8')
        purpose=text.split('## 이어가는 목적')[1].split('\n## ')[0]
        self.assertIn('참고 · 앞선 목적 (앞선 작업의 MOCK 정리, 현재 유효 여부는 확정하지 않음)',purpose)
        self.assertIn('폐기·교체·변경을 말하면 그쪽이 우선합니다',purpose)
        self.assertNotIn('계속 유효',purpose);self.assertNotIn('이번 작업이 바꾸지 않음',purpose)
        self.assertTrue(all(b['status']=='requested' for b in self.state()['bases']))

    def notice(self):
        banner=self.page.locator('#stale-advice')
        return {'visible':banner.is_visible(),'causes':banner.get_attribute('data-causes'),'aiExcluded':banner.get_attribute('data-ai-excluded'),'manual':banner.get_attribute('data-manual'),'text':banner.inner_text()}
    def correct_purpose(self,goal,conditions='환불은 제외한다.'):
        self.page.locator('#intent-details').evaluate('(e)=>e.open=true')
        self.page.locator('#intent-edit-goal').fill(goal);self.page.locator('#intent-edit-conditions').fill(conditions)
        self.page.locator('#intent-correct').click();expect(self.page.locator('#intent-goal')).to_have_text(goal)
    def handoff(self,name):
        with self.page.expect_download() as event:self.page.locator('#download-work').click()
        path=base.OUT/name;event.value.save_as(path);return path.read_text(encoding='utf-8')

    def test_03_purpose_correction_without_own_work_explains_withheld_ai_text_until_regenerated(self):
        # FIX079: the work card says why AI text left the instruction and clears once a fresh reading arrives.
        self.send('가입한 고객만 예약 취소')
        ai=self.state()['tasks'][-1]['advice'];self.assertTrue(ai['next'])
        self.assertFalse(self.notice()['visible'])
        author=self.page.locator('#instruction-author').inner_text()
        self.correct_purpose('문자 링크로 가입 없이 예약을 취소한다')
        n=self.notice();self.assertTrue(n['visible'])
        self.assertEqual((n['causes'],n['aiExcluded'],n['manual']),('intent','true','none'))
        self.assertIn('목적',n['text']);self.assertNotIn('직접 쓴 내용은 그대로',n['text'])
        expect(self.page.locator('#instruction-preview')).not_to_contain_text(ai['next'])
        self.assertNotEqual(self.page.locator('#instruction-author').inner_text(),author,'withheld AI text is not labelled as the AI suggestion')
        self.page.locator('#edit-work').evaluate('(e)=>e.open=true')
        self.assertNotIn('기준 변경',self.page.locator('#manual-next').inner_text(),'no basis changed; the field note does not blame one')
        text=self.handoff('fix079-no-own-work.md')
        self.assertNotIn(ai['next'],text.split('### 다음 작업')[1].split('\n### ')[0])
        self.assertIn('문자 링크로 가입 없이',text.split('## 이어가는 목적')[1].split('\n## ')[0])
        self.page.locator('#retry-work').click();expect(self.page.locator('#working')).to_have_text('')
        self.assertFalse(self.notice()['visible'],'a fresh reading is not shown as stale')
        expect(self.page.locator('#instruction-author')).to_have_text(author)
        expect(self.page.locator('#intent-goal')).to_have_text('문자 링크로 가입 없이 예약을 취소한다')
        # Every work field is the user's own: nothing AI-written is said to be removed.
        for key in ['understanding','scope','next','checks']:self.page.locator(f'#work-{key}').fill(f'직접 쓴 {key}')
        self.correct_purpose('문자 링크로 가입 없이 예약을 취소하고 12시간 뒤 만료')
        n=self.notice();self.assertTrue(n['visible']);self.assertEqual((n['causes'],n['aiExcluded'],n['manual']),('intent','false','kept'))
        self.assertNotIn('뺐어요',n['text'])

    def test_04_purpose_correction_keeps_own_work_and_names_both_causes(self):
        # FIX079: a user-written instruction stays and goes out as written; regeneration never replaces it.
        self.send('가입한 고객만 예약 취소')
        self.page.locator('#edit-work').evaluate('(e)=>e.open=true')
        own='회원 로그인 후 예약 취소 버튼을 추가한다.'
        self.page.locator('#work-next').fill(own)
        self.correct_purpose('문자 링크로 가입 없이 예약을 취소한다')
        n=self.notice();self.assertTrue(n['visible']);self.assertEqual((n['causes'],n['aiExcluded'],n['manual']),('intent','true','kept'))
        self.assertIn('직접 쓴 내용은 그대로',n['text'])
        expect(self.page.locator('#instruction-preview')).to_have_text(own)
        expect(self.page.locator('#instruction-author')).to_have_text('사용자 직접 수정')
        text=self.handoff('fix079-own-work.md')
        self.assertIn(own,text.split('### 다음 작업')[1].split('\n### ')[0])
        self.assertIn('문자 링크로 가입 없이',text.split('## 이어가는 목적')[1].split('\n## ')[0])
        # A recorded basis change as well: both causes are named, not just one.
        self.page.locator('#outcome-correction').evaluate('(e)=>e.open=true')
        self.page.locator('#outcome-correction-text').fill('비회원도 문자 링크로 예약 취소');self.page.locator('#correct-outcome').click()
        n=self.notice();self.assertEqual(n['causes'],'basis intent');self.assertIn('D1',n['text'])
        self.page.locator('#retry-work').click();expect(self.page.locator('#working')).to_have_text('')
        self.assertFalse(self.notice()['visible'])
        saved=self.state()['tasks'][-1];self.assertEqual(saved['manual']['next'],own)
        expect(self.page.locator('#instruction-preview')).to_have_text(own)
        self.page.reload();expect(self.page.locator('#instruction-preview')).to_have_text(own);self.assertFalse(self.notice()['visible'])

if __name__=='__main__':unittest.main(verbosity=2)
