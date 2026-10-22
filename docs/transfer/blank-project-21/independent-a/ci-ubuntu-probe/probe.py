from pathlib import Path
import json,sys,traceback,unittest,hashlib
import blank21_browser as original
import browser as base
R=Path(__file__).parent;L=R/'diagnostics.jsonl'
def emit(x):
 with L.open('a') as f:f.write(json.dumps(x,ensure_ascii=False)+'\n')
# Read-only geometry/observers. No focus/scroll/CSS/property repair. Reference identity is held outside product DOM.
INSTALL=r'''()=>{if(window.__ci21)return;const p=window.__ci21={events:[],entries:[],target:null,serial:0,ids:new WeakMap()};p.identity=e=>{if(!e)return null;if(!p.ids.has(e))p.ids.set(e,++p.serial);return p.ids.get(e)};
 p.geo=()=>{const e=document.querySelector('#file-handoff-preview > summary');if(!e)return null;const r=e.getBoundingClientRect(),anc=[];let clip={left:0,top:0,right:innerWidth,bottom:innerHeight};
 for(let a=e;a;a=a.parentElement){const s=getComputedStyle(a),b=a.getBoundingClientRect(),sx=a.offsetWidth?b.width/a.offsetWidth:1,sy=a.offsetHeight?b.height/a.offsetHeight:1,c={left:b.left+a.clientLeft*sx,top:b.top+a.clientTop*sy,right:b.left+(a.clientLeft+a.clientWidth)*sx,bottom:b.top+(a.clientTop+a.clientHeight)*sy};const x=/(hidden|clip|auto|scroll)/.test(s.overflowX),y=/(hidden|clip|auto|scroll)/.test(s.overflowY);if(x){clip.left=Math.max(clip.left,c.left);clip.right=Math.min(clip.right,c.right)}if(y){clip.top=Math.max(clip.top,c.top);clip.bottom=Math.min(clip.bottom,c.bottom)}anc.push({identity:p.identity(a),id:a.id,tag:a.tagName,rect:b.toJSON(),client:c,overflowX:s.overflowX,overflowY:s.overflowY,clipsX:x,clipsY:y,scale:[sx,sy],scroll:[a.scrollLeft,a.scrollTop],extent:[a.scrollWidth-a.clientWidth,a.scrollHeight-a.clientHeight]})}
 const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {time:performance.now(),identity:p.identity(e),sameObserved:e===p.target,rect:r.toJSON(),pageY:r.y+scrollY,documentY:scrollY,documentHeight:document.documentElement.scrollHeight,viewport:[innerWidth,innerHeight],active:{identity:p.identity(document.activeElement),id:document.activeElement?.id,tag:document.activeElement?.tagName,summary:document.activeElement===e},detailsOpen:e.parentElement.open,intersectionClip:clip,fullInAllClientClip:r.left>=clip.left&&r.right<=clip.right&&r.top>=clip.top&&r.bottom<=clip.bottom,hit:hit?.id||hit?.tagName,centerHit:!!hit&&(hit===e||e.contains(hit)),ancestors:anc,textarea:[...e.parentElement.querySelectorAll('textarea')].map(t=>({top:t.scrollTop,total:t.scrollHeight,client:t.clientHeight,selection:t.selectionStart,length:t.value.length}))}}
 p.watch=()=>{const e=document.querySelector('#file-handoff-preview > summary');if(e&&e!==p.target){p.target=e;p.io?.disconnect();p.io=new IntersectionObserver(es=>{for(const a of es)p.entries.push({time:a.time,observedAt:performance.now(),identity:p.identity(a.target),isIntersecting:a.isIntersecting,ratio:a.intersectionRatio,bounding:a.boundingClientRect.toJSON(),intersection:a.intersectionRect.toJSON(),rootBounds:a.rootBounds?.toJSON(),geometry:p.geo()})},{threshold:[0,.001,.25,.5,.75,.999,1]});p.io.observe(e)}};
 p.mo=new MutationObserver(()=>p.watch());p.mo.observe(document,{childList:true,subtree:true});p.watch();for(const type of ['keydown','keyup','focusin','scroll','scrollend','wheel'])document.addEventListener(type,e=>{if(!document.querySelector('#file-handoff-preview'))return;p.events.push({type,time:performance.now(),trusted:e.isTrusted,key:e.key,deltaY:e.deltaY,target:{identity:p.identity(e.target),id:e.target.id,tag:e.target.tagName},defaultPrevented:e.defaultPrevented,geo:p.geo()})},true)}'''
class Observed(original.Blank21):
 def log(self,label,extra=None):
  v=self.page.evaluate('()=>{const p=window.__ci21;return p?{geo:p.geo(),events:p.events.splice(0),entries:p.entries.splice(0)}:null}')
  emit({'test':self.id(),'label':label,'extra':extra,'raw':v})
 def setUp(self):
  original.Blank21.setUp(self);self.page.evaluate(INSTALL)
  self.page.on('console',lambda m:emit({'test':self.id(),'console':{'type':m.type,'text':m.text}}))
  press=self.page.keyboard.press
  def observed_press(key,*args,**kwargs):
   if key in ['Control+End','Shift+Tab']:self.log('before keyboard '+key)
   try:return press(key,*args,**kwargs)
   finally:
    if key in ['Control+End','Shift+Tab']:self.log('after keyboard '+key)
  self.page.keyboard.press=observed_press
 def reach(self,sel,marker=None):
  watch=sel=='#file-handoff-preview > summary'
  if watch:self.log('before reach',{'selector':sel})
  try:return original.Blank21.reach(self,sel,marker)
  except Exception:
   if watch:self.log('reach raised',{'traceback':traceback.format_exc()})
   raise
  finally:
   if watch:self.log('after reach',{'selector':sel})
 def visible(self,sel,marker=None):
  watch=sel=='#file-handoff-preview > summary'
  if watch:self.log('before original PROBE+expect visible',{'selector':sel})
  try:return original.Blank21.visible(self,sel,marker)
  except Exception:
   if watch:self.log('original visible raised; original assertion unchanged',{'traceback':traceback.format_exc()});self.page.screenshot(path=str(R/f'failure-{self.WIDTH}.png'))
   raise
  finally:
   if watch:self.log('after original visible',{'selector':sel})
 def wheel(self,sel,delta,marker=None):
  self.log('before actual helper wheel',{'selector':sel,'delta':delta})
  try:return original.Blank21.wheel(self,sel,delta,marker)
  finally:self.log('after actual helper wheel',{'selector':sel,'delta':delta})
 def tearDown(self):
  try:self.log('final before original teardown')
  finally:original.Blank21.tearDown(self)
class ObservedWide(Observed):WIDTH,HEIGHT=1440,900
if __name__=='__main__':
 h=hashlib.sha256((R/'blank21_browser.py').read_bytes()).hexdigest();assert h=='212163b1f4b7b6e328bc194676656eaed570a65179c6670dc6274e74d10a3117'
 suite=unittest.TestSuite([Observed('test_first_handoff_choice_and_long_read_return'),ObservedWide('test_first_handoff_choice_and_long_read_return')]);result=unittest.TextTestRunner(verbosity=2).run(suite);(R/'result.json').write_text(json.dumps({'expected':2,'executed':result.testsRun,'failures':len(result.failures),'errors':len(result.errors),'originalCheckerSHA256':h,'instrumentation':'read-only observers around original methods, original assertions unchanged','scope':'same native original methods; runtime system154 differs CI installed143; timing effect of observation not excluded'},indent=2));sys.exit(0 if result.wasSuccessful() and result.testsRun==2 else 1)
