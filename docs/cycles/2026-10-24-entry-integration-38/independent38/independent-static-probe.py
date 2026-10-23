import json,sys,unittest
from pathlib import Path
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parent/'product38-independent-20261024/app/continuity/tests'))
import static_browser as s
from playwright.sync_api import expect

GEOM=r'''()=>{const map=document.querySelector('#space-map'),clip=map.getBoundingClientRect(),n=document.querySelector('#notice');
const box=e=>{const r=e.getBoundingClientRect(),cs=getComputedStyle(e);return {text:e.textContent.trim(),x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right,fontSize:cs.fontSize,lineHeight:cs.lineHeight}};
return {viewport:[innerWidth,innerHeight],map:box(map),scale:document.querySelector('#map-scale').textContent,notice:!n.hidden?n.textContent:null,
cards:[...document.querySelectorAll('.area-node')].map(e=>{const r=e.getBoundingClientRect(),name=e.querySelector('.area-card-name'),nr=name.getBoundingClientRect(),hit=document.elementFromPoint(nr.left+Math.min(20,nr.width/2),nr.top+nr.height/2);return {id:e.dataset.areaId,...box(e),inside:r.top>=clip.top-.5&&r.bottom<=clip.bottom+.5&&r.left>=clip.left-.5&&r.right<=clip.right+.5,nameHit:!!hit&&name.contains(hit),name:box(name),note:e.querySelector('.area-card-note')?box(e.querySelector('.area-card-note')):null,reason:e.querySelector('.branch-signals')?box(e.querySelector('.branch-signals')):null}})}}'''

class Probe(s.StaticWeb):
    WIDTH,HEIGHT=1280,720
    def test_preview_entry_return_and_edited_example_to_own(self):
        self.ctx=self.browser.new_context(viewport={'width':self.WIDTH,'height':self.HEIGHT})
        self.errors=[];self.failures=[];requests=[]
        try:
            p=self.tab(self.url+'preview/','미리보기 · 브라우저 MOCK · AI 아님',requests)
            expect(p.locator('#projects-view')).to_be_visible()
            keys=lambda:p.evaluate('Object.keys(localStorage)')
            sessions=lambda:p.evaluate('Object.fromEntries(Object.entries(sessionStorage))')
            self.assertEqual(keys(),[])
            if self.WIDTH==1280:p.screenshot(path=str(HERE/'selected-1280-home.png'))
            p.locator('#example-list .example-open').click();expect(p.locator('#space-map')).to_be_visible()
            before=p.evaluate(GEOM)
            example_ids=[x['id'] for x in before['cards']]
            p.locator('#nav-work').click();p.locator('#compose-panel').evaluate('(e)=>e.open=true')
            p.locator('#draft').fill('예제 안에서만 남겨 둔 임시 초안 38')
            p.locator('#nav-space').click()
            p.locator('.node-enter[aria-label="시간 고르기 영역 열기"]').click()
            expect(p.locator('#area-tasks')).to_be_visible();p.locator('#area-tasks .task-open-link').first.click()
            expect(p.locator('#task-reports')).to_contain_text('예제 보고 · 실제로 실행한 결과가 아니에요')
            p.locator('#task-view-continue').click();expect(p.locator('#notice')).to_contain_text('이어가기')
            expect(p.locator('#draft')).to_have_value('예제 안에서만 남겨 둔 임시 초안 38')
            work={'notice':p.locator('#notice').inner_text(),'place':p.locator('#work-place').inner_text(),'title':p.locator('#context-title').inner_text()}
            if self.WIDTH==1280:p.screenshot(path=str(HERE/'selected-1280-continue.png'))
            p.locator('#place-space').click();expect(p.locator('#space-map')).to_be_visible()
            after=p.evaluate(GEOM)
            self.assertIsNone(after['notice']);self.assertAlmostEqual(after['map']['height'],before['map']['height'],delta=1)
            self.assertTrue(all(c['inside'] and c['nameHit'] for c in after['cards']))
            self.assertLessEqual(after['map']['bottom'],self.HEIGHT+.5)
            self.assertEqual(sorted(c['name']['text'] for c in before['cards']),sorted(c['name']['text'] for c in after['cards']))
            p.screenshot(path=str(HERE/f'selected-{self.WIDTH}-returned-map.png'))
            self.assertEqual(keys(),[])
            self.assertFalse(any('workspace.map' in k for k in sessions()))
            p.locator('#nav-work').click();expect(p.locator('#draft')).to_have_value('예제 안에서만 남겨 둔 임시 초안 38')
            p.locator('#edit-work').evaluate('(e)=>e.open=true');p.locator('#work-next').fill('예제 작업문 수정 38 내 프로젝트에 옮기지 않음')
            p.locator('#example-close').click();expect(p.locator('#projects-view')).to_be_visible();self.assertEqual(keys(),[])
            # Re-open, edit again, then start own: this exercises the published static runtime, beyond the server suite.
            p.locator('#example-list .example-open').click();p.locator('#nav-work').click()
            p.locator('#compose-panel').evaluate('(e)=>e.open=true');p.locator('#draft').fill('예제 새 임시 초안 38')
            p.locator('#example-start').click();expect(p.locator('#brief-input')).to_have_value('');expect(p.locator('#draft')).to_have_value('')
            self.assertEqual(keys(),[])
            p.locator('#brief-input').fill('독립 검증용 내 주문 프로젝트');p.locator('#brief-start').click();s.base.saved(p)
            p.locator('#nav-work').click();p.locator('#compose-panel').evaluate('(e)=>e.open=true');p.locator('#draft').fill('내 프로젝트의 미전송 요청 38');s.base.saved(p)
            prefix=s.PREVIEW_PREFIX
            own=s.base.read_state(p,prefix);raw=p.evaluate('(k)=>localStorage.getItem(k)',prefix+s.base.WORKSPACE)
            self.assertEqual([own['space']['areas'],own['space']['relations'],own['tasks'],own['sources'],own['bases']],[[],[],[],[],[]]);self.assertIsNone(own['currentTaskId'])
            for text in example_ids+['예제 새 임시 초안','미용실','예약하기','시간 고르기','예제 작업문 수정']:
                self.assertNotIn(text,raw)
            entry=p.evaluate('document.documentElement.dataset.entryId')
            p.reload();expect(p.locator('#draft')).to_have_value('내 프로젝트의 미전송 요청 38');s.base.saved(p)
            self.assertEqual(p.evaluate('document.documentElement.dataset.entryId'),entry)
            self.assertEqual(s.base.read_state(p,prefix),own)
            self.assertTrue(all(k.startswith(prefix) for k in keys()),keys())
            self.assertFalse(any('/api/' in r['path'] or r['method']!='GET' for r in requests))
            self.assertEqual(self.errors,[]);self.assertEqual(self.failures,[])
            (HERE/f'independent-static-{self.WIDTH}.json').write_text(json.dumps({'sha':'c7329aa8b941791633d5f22da4ca105188aab0be','transport':'native static-preview HTTP; browser MOCK; no storage/state injection','before':before,'work':work,'returned':after,'exampleKeysEmpty':True,'exampleMapMemoAbsent':True,'ownEmptyBeforeNewInput':True,'ownRestoredAfterReload':True,'onlyPrefixWritten':prefix,'requests':len(requests),'actualAI':0},ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
        finally:self.ctx.close()

class ProbeWide(Probe):WIDTH,HEIGHT=1440,900
if __name__=='__main__':
    result=unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite([Probe('test_preview_entry_return_and_edited_example_to_own'),ProbeWide('test_preview_entry_return_and_edited_example_to_own')]))
    sys.exit(not result.wasSuccessful())
