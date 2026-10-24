"""VIEWPORT30: four existing-camera return regressions, native HTTP/MOCK, two PCs.

The six-part fixture is the byte-exact backup made through normal UI in cycle28,
blob837b4d3ee03ba8e3098b2c06c7ef84ce64154ba8 (not a reconstructed project).
Import already creates a camera: these tests do NOT claim a missing-camera first fit.
No fit/resize/storage wait/reach repair between native map click and first assertion.
Author PC: syntax only; actual baseline/candidate runs belong to Cloud/CI.
"""
import hashlib,json,unittest
from pathlib import Path
from playwright.sync_api import expect
import browser as base
import received20_browser as reused

FIXTURE=Path(__file__).parent/'fixtures/viewport30-normal-ui-six.json'
OBS=base.OUT/'viewport30-observations.jsonl';OBS.write_text('',encoding='utf-8')
SNAP=r'''pid=>{const map=document.getElementById('space-map'),layout=document.querySelector('.map-layout'),plane=document.getElementById('space-plane');
 const store=JSON.parse(sessionStorage.getItem('agentflow.workspace.map')||'null'),memo=store?.project===pid?{view:store.view,selected:store.selected,collapsed:store.collapsed,panel:store.panel}:store?.others?.[pid]??null;
 const mr=map?.getBoundingClientRect(),left=mr?mr.left+map.clientLeft:0,top=mr?mr.top+map.clientTop:0,right=left+(map?.clientWidth??0),bottom=top+(map?.clientHeight??0);
 const cards=[...document.querySelectorAll('.area-node')].map(e=>{const r=e.getBoundingClientRect();return {id:e.dataset.areaId,rect:r.toJSON(),off:e.classList.contains('offscreen'),outside:r.left<left-.5||r.top<top-.5||r.right>right+.5||r.bottom>bottom+.5}});
 return {y:scrollY,viewport:[innerWidth,innerHeight],layer:document.body.dataset.layer,saving:document.documentElement.dataset.saving??null,
 layout:layout?.getBoundingClientRect().toJSON(),inlineHeight:layout?.style.height,map:mr?.toJSON(),client:[map?.clientWidth,map?.clientHeight],
 transform:plane?.style.transform,computed:plane?getComputedStyle(plane).transform:null,memo,cards,
 listOpen:document.getElementById('area-list')?.open,collapsed:[...document.querySelectorAll('.branch-toggle[aria-expanded="false"]')].map(e=>e.id),
 selected:document.querySelector('.area-node.selected')?.dataset.areaId??null,focus:document.activeElement.id,
 offscreen:{hidden:document.getElementById('map-offscreen')?.hidden,text:document.getElementById('map-offscreen')?.textContent}}}'''
ARM=r'''pid=>{const snap='''+SNAP+r''';let resolve,timer;const p={first:null,frames:[],done:null};
 p.done=new Promise(r=>resolve=r);const finish=ok=>{clearTimeout(timer);document.removeEventListener('click',clicked);resolve({ok,first:p.first,frames:p.frames})};
 const clicked=e=>{if(!e.isTrusted||!e.target.closest('#nav-space'))return;
   p.first=snap(pid);document.removeEventListener('click',clicked);
   requestAnimationFrame(()=>{p.frames.push(snap(pid));requestAnimationFrame(()=>{p.frames.push(snap(pid));finish(true)})})};
 document.addEventListener('click',clicked);timer=setTimeout(()=>finish(false),5000);window.__viewport30Entry=p}'''

class Viewport30(unittest.TestCase):
    WIDTH,HEIGHT=1280,720
    setUpClass=classmethod(base.Browser.setUpClass.__func__);tearDownClass=classmethod(base.Browser.tearDownClass.__func__)
    state=base.Browser.state
    wheel=reused.Received20.wheel;yes=reused.Received20.yes
    def record(self,kind,label,actual,expected=None):
        with OBS.open('a',encoding='utf-8') as f:f.write(json.dumps({'test':self.id(),'pc':[self.WIDTH,self.HEIGHT],'kind':kind,'label':label,'actual':actual,'expected':expected},ensure_ascii=False)+'\n')
    def setUp(self):
        base.Browser.setUp(self);self.assertFalse(base.DOM,'VIEWPORT30 requires native browser/storage')
        self.page.set_viewport_size({'width':self.WIDTH,'height':self.HEIGHT})
        raw=FIXTURE.read_bytes();self.assertEqual(hashlib.sha256(raw).hexdigest(),'c50eb43a7747e824a23ff8de87588e608dc5430046528d13878d15eb65239aaa')
        self.record('source','normal UI cycle28 backup',{'bytes':len(raw),'gitBlob':'837b4d3ee03ba8e3098b2c06c7ef84ce64154ba8','synthetic':True})
        self.page.locator('#nav-projects').click();expect(self.page.locator('#projects-view')).to_be_visible()
        with self.page.expect_file_chooser() as chooser:self.page.locator('#list-import').click()
        self.page.once('dialog',lambda d:d.accept());chooser.value.set_files(str(FIXTURE))
        expect(self.page.locator('#notice')).to_contain_text('사본으로 불러왔어요');base.saved(self.page)
        # Normal rename clears the import notice, before either condition's saved preparation.
        self.page.locator('#project-name').fill('[합성30] 같은 여섯 부분의 지도 복귀');expect(self.page.locator('#notice')).to_be_hidden();base.saved(self.page)
        self.pid=self.state()['id'];self.assertEqual(len(self.state()['space']['areas']),6)
        self.page.locator('.branch-toggle[aria-expanded="true"]').first.click()
        expect(self.page.locator('.branch-toggle[aria-expanded="false"]')).to_have_count(1)
        self.map_before=self.page.evaluate(SNAP,self.pid)
        self.assertIsNotNone(self.map_before['memo']['view'],'normal import created an existing camera')
        self.assertFalse(self.map_before['listOpen'],'six-part closed-list condition; no later default-open repair')
        self.page.locator('#nav-work').click()
        if not self.page.locator('#edit-work').evaluate('e=>e.open'):self.page.locator('#edit-work > summary').click()
        # WORK41: the goal/request/conditions/reports that made the work page deep are one disclosure now; the user opens it.
        base.open_context(self.page)
        self.before=self.state()
        self.record('preparation','existing camera/fold and unchanged saved input',{'map':self.map_before,'project':self.before})
    def tearDown(self):
        try:self.page.screenshot(path=str(base.OUT/f'viewport30-{self.WIDTH}-{self._testMethodName}-final.png'))
        finally:base.Browser.tearDown(self)
    def geometry(self,label,v):
        self.record('actual',label,v)
        self.assertEqual(v['layer'],'space');self.assertAlmostEqual(v['y'],0,delta=1)
        expected=max(240,v['viewport'][1]-max(0,v['layout']['top'])-16)
        self.assertAlmostEqual(v['layout']['height'],expected,delta=1,msg='final available height, before any repair')
        self.assertAlmostEqual(v['map']['height'],expected,delta=1)
        self.assertLessEqual(v['map']['bottom'],v['viewport'][1]-.5,'container fits viewport; not a claim every card is visible')
        self.assertEqual(v['transform'],self.map_before['transform']);self.assertEqual(v['memo']['view'],self.map_before['memo']['view'])
        self.assertEqual(v['collapsed'],self.map_before['collapsed']);self.assertEqual(v['memo']['collapsed'],self.map_before['memo']['collapsed'])
        self.assertEqual(v['selected'],self.map_before['selected'])
        self.assertEqual([c['id'] for c in v['cards']],[c['id'] for c in self.map_before['cards']])
        self.assertEqual([c['off'] for c in v['cards']],[c['outside'] for c in v['cards']],'offscreen classes use final map client clip')
        count=sum(c['outside'] for c in v['cards']);self.assertEqual(v['offscreen']['hidden'],count==0)
        self.assertIn(f'화면 밖 영역 {count}개',v['offscreen']['text'])
    def return_from_work(self,deep):
        if self.page.evaluate('scrollY')>0:self.wheel('#work-view',-10000)
        self.assertLessEqual(self.page.evaluate('scrollY'),1)
        if deep:
            self.assertGreaterEqual(self.page.evaluate('document.documentElement.scrollHeight-innerHeight'),1200,'deep preparation is real document space')
            self.wheel('#work-view',1200)
            self.assertGreaterEqual(self.page.evaluate('scrollY'),1199)
        departure=self.page.evaluate('()=>({y:scrollY,layer:document.body.dataset.layer,saving:document.documentElement.dataset.saving??null})')
        self.record('preparation','native wheel completed before entry observer',departure);self.assertEqual(departure['layer'],'work');self.assertIsNone(departure['saving'])
        self.page.evaluate(ARM,self.pid)
        try:
            self.page.locator('#nav-space').click()
            first=self.page.evaluate('()=>window.__viewport30Entry.first')
            self.assertIsNotNone(first,'trusted click bubble captured after product target handler in the same event task')
            self.geometry('same native click task: first map geometry',first)
        finally:
            later=self.page.evaluate('async()=>{const p=window.__viewport30Entry;const v=await p.done;delete window.__viewport30Entry;return v}')
            self.record('actual','separate two native frames; never replace first failure',later)
        self.assertTrue(later['ok']);self.assertEqual(len(later['frames']),2)
        for i,v in enumerate(later['frames']):self.geometry(f'later native frame {i+1}',v)
        self.assertEqual(self.state(),self.before,'navigation leaves current/draft/coordinates/relations/descriptions/exports/raw reports unchanged')
    def test_01_zero_work_scroll_return(self):self.return_from_work(False)
    def test_02_deep_work_scroll_return(self):self.return_from_work(True)

class Viewport30Wide(Viewport30):WIDTH,HEIGHT=1440,900
if __name__=='__main__':unittest.main(verbosity=2)
