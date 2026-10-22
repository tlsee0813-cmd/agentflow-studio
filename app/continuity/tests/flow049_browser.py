"""FLOW049 native UI -> localhost -> explicit mock. Synthetic reports, no executor/AI quality claim.
No storage/state injection. Uses the existing server/browser test helpers.
Run from app/: python continuity/tests/flow049_browser.py
"""
import json, unittest
from playwright.sync_api import expect
import browser as base

class OutcomeHome(unittest.TestCase):
    setUpClass=classmethod(base.Browser.setUpClass.__func__)
    tearDownClass=classmethod(base.Browser.tearDownClass.__func__)
    setUp=base.Browser.setUp;tearDown=base.Browser.tearDown
    state=base.Browser.state;compose=base.Browser.compose;send=base.Browser.send

    def download(self,button,name):
        if button=='#backup':base.reveal_management(self.page,button)
        with self.page.expect_download() as event:self.page.locator(button).click()
        path=base.OUT/name;event.value.save_as(path);return path

    def test_01_idea_exact_return_changed_direction_and_recovery(self):
        calls=[];self.page.on('request',lambda r:calls.append(r.post_data_json) if r.method=='POST' and r.url.endswith('/api/continuity') else None)
        initial='동네 사람들이 남는 재료를 나눌 작은 서비스를 생각 중이에요. 저장소는 없고 우선 간단한 접근안을 제안해 주세요. 결제는 넣지 않습니다.'
        self.send(initial)
        before=self.state();origin=before['sources'][0]['id'];task=before['currentTaskId']
        expect(self.page.locator('#outcome-home')).to_have_attribute('data-outcome-id',origin)
        expect(self.page.locator('#outcome-purpose')).to_have_text(initial)
        expect(self.page.locator('#work-authorship')).to_contain_text('모의 제안')
        self.page.locator('#file-return-options > summary').click()
        first=self.download('#download-file-work','flow049-first-handoff.md').read_text(encoding='utf-8')
        exported=self.state();record=exported['tasks'][0]['handoffs'][-1]
        self.assertIn(initial,first);self.assertIn(origin,first)
        # A public synthetic executor report, not an actual implementation or inspected repository.
        report='합성 로컬 도구 보고: 접근안 두 가지를 정리했습니다. 저장소·코드는 없으며 파일 수정이나 실행 검사는 하지 않았습니다. 공개 게시와 신청 접수 중 무엇을 먼저 할지는 미정입니다.'
        raw=json.dumps({'schemaVersion':'agentflow.return.1','projectId':exported['id'],'taskId':task,'returnId':record['returnId'],'report':report,'evidence':None},ensure_ascii=False,indent=2)
        # Preserve the exact expected UTF-8 bytes; Windows text writes would translate LF to CRLF.
        returned=base.OUT/'flow049-synthetic-return.json';returned.write_bytes(raw.encode('utf-8'))
        with self.page.expect_file_chooser() as chooser:self.page.locator('#home-file-result').click()
        chooser.value.set_files(str(returned));expect(self.page.locator('#result-file-preview')).to_have_attribute('data-return-id',record['returnId'])
        self.page.locator('#accept-result-file').click()
        received=self.state();self.assertEqual(len(calls),1,'import does not call AI')
        self.assertEqual(received['tasks'][-1]['resultFile']['rawText'],raw)
        self.assertEqual(received['tasks'][-1]['parentTaskId'],task)
        self.assertEqual(received['bases'],exported['bases']);self.assertEqual(received['sources'][:-1],exported['sources'])
        expect(self.page.locator('#outcome-home')).to_have_attribute('data-outcome-id',origin)
        expect(self.page.locator('#outcome-last-report')).to_contain_text(report)
        self.page.locator('#change-direction').click();expect(self.page.locator('#draft')).to_be_focused()
        direction='공개 게시만 먼저 구현해 주세요. 신청 접수는 보류합니다. 결제를 넣지 않는 조건은 유지해 주세요. 필요한 기술 선택은 로컬 도구에 맡깁니다.'
        self.page.locator('#draft').fill(direction);self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        expect(self.page.locator('#outcome-purpose')).to_have_text(direction)
        expect(self.page.locator('#outcome-home')).to_have_attribute('data-outcome-id',origin)
        text=self.download('#download-work','flow049-next-handoff.md').read_text(encoding='utf-8')
        for value in [text,json.dumps(calls[-1],ensure_ascii=False)]:
            self.assertIn(initial,value);self.assertIn(direction,value);self.assertIn(report,value)
        self.assertEqual(len(calls),2,'one preparation for each explicit request, no mandatory extra approach cycle')
        backup=self.download('#backup','flow049-recovery.json');saved=self.state()
        self.page.reload();expect(self.page.locator('#mode')).to_contain_text('MOCK');self.assertEqual(self.state(),saved)
        self.page.once('dialog',lambda d:d.accept());self.page.locator('#import-file').set_input_files(str(backup))
        expect(self.page.locator('#outcome-home')).to_have_attribute('data-outcome-id',origin)
        self.assertEqual(self.state()['sources'],saved['sources']);self.assertEqual(len(calls),2)
        self.page.locator('#outcome-home').scroll_into_view_if_needed()
        self.page.screenshot(path=str(base.OUT/'flow049-home-desktop.png'),full_page=True)
        self.page.set_viewport_size({'width':390,'height':844})
        self.page.screenshot(path=str(base.OUT/'flow049-home-mobile.png'),full_page=True)
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),390)
        (base.OUT/'flow049-http-requests.json').write_text(json.dumps(calls,ensure_ascii=False,indent=2),encoding='utf-8')

    def test_02_clear_change_keeps_direct_handoff_and_manual_report(self):
        self.send('버튼 문구만 “저장”에서 “보관”으로 바꿔줘. 저장 방식과 권한은 그대로 유지해줘.')
        expect(self.page.locator('#question-box')).to_have_count(0)
        origin=self.state()['sources'][0]['id'];self.download('#download-work','flow049-clear-handoff.md')
        self.page.locator('#home-paste-result').click()
        self.page.locator('#draft').fill('합성 보고: 문구를 바꿨다고 보고함. 실행 환경과 검사는 제공되지 않음.')
        self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        expect(self.page.locator('#outcome-home')).to_have_attribute('data-outcome-id',origin)
        self.assertIsNone(self.state()['tasks'][-1]['resultFile'])
        expect(self.page.locator('#outcome-results')).to_contain_text('판본 미확인')
        self.send('합성 관찰 자료: 실제 화면 검사는 수행하지 않았음.','evidence')
        expect(self.page.locator('#outcome-results')).to_contain_text('문구를 바꿨다고 보고함')
        expect(self.page.locator('#outcome-results')).to_contain_text('실제 화면 검사는 수행하지 않았음')

    def test_03_performance_request_uses_same_home_without_a_screen_template(self):
        request='기존 배치의 메모리 사용량을 줄여줘. 출력 순서와 결과 값은 유지해야 해. 저장소에서 병목을 측정하고 필요한 최소 변경과 검증까지 진행해줘.'
        self.send(request);expect(self.page.locator('#outcome-purpose')).to_have_text(request)
        text=self.download('#download-work','flow049-performance-handoff.md').read_text(encoding='utf-8')
        self.assertIn(request,text);self.assertEqual(len(self.state()['tasks']),1)

    def test_04_direction_three_turns_correction_and_recovery(self):
        calls=[];self.page.on('request',lambda r:calls.append(r.post_data_json) if r.method=='POST' and r.url.endswith('/api/continuity') else None)
        first='회원가입한 고객만 예약을 취소할 수 있게 해줘'
        direction='방향을 바꿀게: 회원가입 없이도 예약 링크로 취소할 수 있게 해줘'
        small='취소 버튼 색만 빨간색으로 바꿔줘'
        for request in [first,direction,small]:self.send(request)
        expect(self.page.locator('#outcome-purpose')).to_have_text(small)
        expect(self.page.locator('#outcome-direction')).to_contain_text(direction)
        self.assertEqual(self.state()['sources'][0]['text'],first)
        self.assertNotIn(first,json.dumps(calls[-1]['sources'],ensure_ascii=False))
        self.assertEqual(self.page.locator('#direction-proposals').count(),0)
        for width in [1440,390]:
            self.page.set_viewport_size({'width':width,'height':900})
            self.page.locator('#outcome-home').scroll_into_view_if_needed()
            self.page.screenshot(path=str(base.OUT/f'fix051-direction-{width}.png'),full_page=True)
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
        self.page.locator('#outcome-correction > summary').click()
        correction='예약 링크로 취소하되 만료 기간은 유지한다.'
        self.page.locator('#outcome-correction-text').fill(correction)
        self.page.locator('#correct-outcome').click()
        expect(self.page.locator('#outcome-direction')).to_contain_text(correction)
        backup=self.download('#backup','fix051-direction-backup.json')
        self.page.reload();expect(self.page.locator('#outcome-direction')).to_contain_text(correction)
        self.page.once('dialog',lambda d:d.accept());self.page.locator('#import-file').set_input_files(str(backup))
        expect(self.page.locator('#outcome-direction')).to_contain_text(correction)
        self.assertEqual(self.state()['bases'][1]['history'][0]['text'],direction)
        self.assertEqual(len(calls),3,'correction and recovery do not auto-call AI')

    def test_05_long_requests_and_return_continuation(self):
        calls=[];self.page.on('request',lambda r:calls.append(r.post_data_json) if r.method=='POST' and r.url.endswith('/api/continuity') else None)
        for request in ['가'*11000,'짧은 중간 요청','나'*11000]:self.send(request)
        self.assertEqual(len(calls),3)
        self.assertLessEqual(len(json.dumps(calls[-1],ensure_ascii=False,separators=(',',':')).encode('utf-8')),131072)
        self.assertEqual(len(self.state()['sources'][0]['text']),11000)
        for width in [1440,390]:
            self.page.set_viewport_size({'width':width,'height':900})
            expect(self.page.locator('#outcome-purpose')).to_have_text('나'*11000)
            self.assertLess(self.page.locator('#outcome-purpose').bounding_box()['height'],120)
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
            self.page.locator('#outcome-home').scroll_into_view_if_needed()
            self.page.screenshot(path=str(base.OUT/f'fix051-long-{width}.png'))
        self.download('#download-work','fix051-long-handoff.md')
        A=self.state()['currentTaskId']
        self.send('B 별도 통계 차트 색 변경');self.download('#download-work','fix051-B-handoff.md')
        self.page.locator('#home-paste-result').click()
        self.page.locator('#return-task').select_option(A)
        self.page.locator('#draft').fill('합성 A 늦은 보고. 실제 실행 검사는 하지 않음.')
        self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        # FIX088: the late A report is filed under A without an AI run on B; continuing A is an explicit choice.
        self.assertEqual(len(calls),4);expect(self.page.locator('#outcome-elsewhere')).to_contain_text('합성 A 늦은 보고')
        self.page.locator('#outcome-elsewhere button').click()
        self.send('A 결과에서 이어갈 다음 문구 수정')
        expect(self.page.locator('#outcome-other-request > summary')).to_have_text('현재 경로 밖 요청 1개')
        expect(self.page.locator('#outcome-other-request')).to_contain_text('B 별도 통계 차트 색 변경')
        self.assertEqual(self.state()['tasks'][-2]['parentTaskId'],A)
        self.assertNotIn('B 별도 통계 차트 색 변경',json.dumps(calls[-1]['sources'],ensure_ascii=False))
        self.assertIn('합성 A 늦은 보고',json.dumps(calls[-1]['sources'],ensure_ascii=False))
        self.download('#download-work','fix051-after-return.md')
        for width in [1440,390]:
            self.page.set_viewport_size({'width':width,'height':900})
            self.page.locator('#outcome-home').scroll_into_view_if_needed()
            self.assertLess(self.page.locator('#outcome-direction p').bounding_box()['height'],120)
            self.page.screenshot(path=str(base.OUT/f'fix051-return-{width}.png'),full_page=True)
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
        (base.OUT/'fix051-http-requests.json').write_bytes(json.dumps(calls,ensure_ascii=False,indent=2).encode('utf-8'))

    def test_06_late_report_keeps_the_current_request_and_never_becomes_the_goal(self):
        """FIX088: receiving a report for A is not choosing A. B (scope, goal, export) stays; the A result is findable."""
        calls=[];self.page.on('request',lambda r:calls.append(r.post_data_json) if r.method=='POST' and r.url.endswith('/api/continuity') else None)
        a_text,b_text,report='A: 예약 화면 전체 문구와 배치 정리','B: 취소 버튼 문구만 바꿔 줘','늦게 온 A 보고: 전체 문구와 배치를 고쳤다고 주장. 실제 검사 없음.'
        self.send(a_text);A=self.state()['currentTaskId'];self.download('#download-work','fix088-A.md')
        self.send(b_text);B=self.state()['currentTaskId'];before=self.download('#download-work','fix088-B.md').read_text(encoding='utf-8')
        expect(self.page.locator('#intent-goal')).to_have_text(b_text)
        self.page.locator('#home-paste-result').click();self.page.locator('#return-task').select_option(A)
        self.page.locator('#draft').fill(report);self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        saved=self.state();self.assertEqual(saved['currentTaskId'],B);self.assertEqual(saved['tasks'][-1]['parentTaskId'],A)
        self.assertEqual(len(calls),2,'no AI run on B for the A report')
        expect(self.page.locator('#notice')).to_contain_text('그대로');expect(self.page.locator('#outcome-purpose')).to_have_text(b_text)
        expect(self.page.locator('#intent-goal')).to_have_text(b_text);expect(self.page.locator('#outcome-elsewhere')).to_contain_text(report)
        after=self.download('#download-work','fix088-B-after.md').read_text(encoding='utf-8')
        self.assertNotIn(report,after);import re;self.assertEqual(re.sub(r'기준 r\d+','',after),re.sub(r'기준 r\d+','',before),'B export: only the header revision may differ')
        self.page.reload();expect(self.page.locator('#mode')).to_contain_text('MOCK');self.assertEqual(self.state()['currentTaskId'],B)
        expect(self.page.locator('#outcome-elsewhere')).to_contain_text(report)
        # Opening the A result explicitly continues A; B stays visible as the latest request, not an old one.
        self.page.locator('#outcome-elsewhere button').click();R=self.state()['currentTaskId'];self.assertEqual(self.state()['tasks'][-1]['id'],R)
        expect(self.page.locator('#outcome-purpose')).to_have_text(a_text);expect(self.page.locator('#outcome-latest-request')).to_contain_text(b_text)
        self.page.locator('#retry-work').click();expect(self.page.locator('#working')).to_have_text('')
        self.assertEqual(calls[-1]['ticket']['taskId'],R);expect(self.page.locator('#intent-goal')).to_have_text(a_text)
        self.assertNotIn(report,self.page.locator('#intent-goal').inner_text())
        self.page.locator('#resume-latest').click();self.assertEqual(self.state()['currentTaskId'],B)
        expect(self.page.locator('#outcome-purpose')).to_have_text(b_text);expect(self.page.locator('#outcome-latest-request')).to_have_count(0)

if __name__=='__main__':unittest.main(verbosity=2)
