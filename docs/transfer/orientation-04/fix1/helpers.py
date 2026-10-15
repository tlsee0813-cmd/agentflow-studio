# Independent helper functions reused from return-flow verification; no former main flow.
def geo(loc):
 return loc.evaluate('''e=>{let r=e.getBoundingClientRect(),l=0,t=0,rr=innerWidth,bb=innerHeight;let ancestors=[];for(let p=e.parentElement;p;p=p.parentElement){let c=getComputedStyle(p),q=p.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(c.overflow+c.overflowX+c.overflowY)){l=Math.max(l,q.left);t=Math.max(t,q.top);rr=Math.min(rr,q.right);bb=Math.min(bb,q.bottom);ancestors.push({id:p.id,overflow:c.overflow})}}let h=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);return {box:{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right},full:r.width>0&&r.height>0&&r.left>=l-1&&r.right<=rr+1&&r.top>=t-1&&r.bottom<=bb+1,hit:!!h&&(h===e||e.contains(h)),cover:h?(h.id||h.className||h.tagName):null,ancestors,clip:{l,t,r:rr,b:bb}}}''')

def overview():
 return page.evaluate('''()=>{let m=document.querySelector('#mapScroll'),c=document.querySelector('#canvas');let rect=e=>{let r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};return {selected:[...document.querySelectorAll('.part.is-selected')].map(e=>e.dataset.id),depths:Object.fromEntries([...document.querySelectorAll('.area')].map(e=>[e.dataset.id,{depth:e.dataset.depth,expanded:e.querySelector('.area-head').getAttribute('aria-expanded'),bodyHidden:e.querySelector('.area-body').hidden}])),mapScroll:{left:m.scrollLeft,top:m.scrollTop,maxX:m.scrollWidth-m.clientWidth,maxY:m.scrollHeight-m.clientHeight},windowY:scrollY,zoomLabel:document.querySelector('#zoomVal').innerText,appliedTransform:getComputedStyle(c).transform,canvasScale:{x:c.getBoundingClientRect().width/c.offsetWidth,y:c.getBoundingClientRect().height/c.offsetHeight},nodes:Object.fromEntries([...document.querySelectorAll('.part,.area-head')].map(e=>[(e.dataset.id||e.closest('.area').dataset.id),{rect:rect(e),layoutWidth:e.offsetWidth,layoutHeight:e.offsetHeight}])),helpOpen:document.querySelector('.help').open,related:[...document.querySelectorAll('.area.is-related')].map(e=>e.dataset.id),active:document.activeElement.dataset.id||document.activeElement.id||document.activeElement.className,mapHidden:document.querySelector('#mapView').hidden,focusHidden:document.querySelector('#focusView').hidden,peekCount:document.querySelectorAll('.peek').length,prepOpen:document.querySelector('#prep').open,devicePixelRatio,overflow:{sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}}}''')

def scrollstate():return page.evaluate('''()=>({windowY:scrollY,reading:document.querySelector('#reading').scrollTop,prep:document.querySelector('#prepBody').scrollTop,focus:document.activeElement.id||document.activeElement.dataset.claim||document.activeElement.className})''')

def wheel(dx,dy,over=None):
 x,y=over or ((width*.7,height*.55) if width>900 else (width*.5,height*.65));before=scrollstate();page.mouse.move(x,y);page.mouse.wheel(dx,dy);page.wait_for_timeout(180);note('actual-wheel',{'dx':dx,'dy':dy,'pointer':[x,y],'before':before,'after':scrollstate()})

def ensure(selector,container=None):
 loc=page.locator(selector)
 for _ in range(45):
  d=geo(loc)
  if d['full'] and d['hit']:return d
  r=d['box'];clip=d['clip'];dy=min(300,max(70,r['bottom']-clip['b']+25)) if r['bottom']>clip['b'] else -min(300,max(70,clip['t']-r['y']+25))
  if d['full'] and not d['hit']:
   # Fixed top rail or bottom selection strip can occlude an otherwise in-viewport target.
   dy=-100 if r['y']<height*.4 else 130
  dx=180 if r['right']>clip['r'] else (-180 if r['x']<clip['l'] else 0)
  over=container
  if over is None and width>900:
   if page.locator('#mapView').is_visible():over=(1000,500)
   else:over=(900,500)
  wheel(dx,dy,over)
 raise AssertionError({'unreachable':selector,'geometry':geo(loc)})

def click(selector,assist=True,container=None):
 d=ensure(selector,container) if assist else geo(page.locator(selector));assert d['full'] and d['hit'],{'selector':selector,**d}
 before=scrollstate();page.mouse.click(d['box']['x']+d['box']['width']/2,d['box']['y']+d['box']['height']/2);page.wait_for_timeout(220);note('actual-click',{'selector':selector,'geometryBefore':d,'before':before,'after':scrollstate()})

def edges():
 d=page.evaluate('''()=>{let c=document.querySelector('#canvas'),cr=c.getBoundingClientRect(),svg=document.querySelector('#edges'),n=document.querySelector('.part.is-selected'),nr=n.getBoundingClientRect();let paths=[...svg.querySelectorAll('path')].filter(p=>!p.getAttribute('stroke-dasharray'));let areas=[...document.querySelectorAll('.area.is-related')].map(e=>{let r=e.querySelector('.area-head').getBoundingClientRect();return {id:e.dataset.id,x:r.left,y:(r.top+r.bottom)/2}});return {display:getComputedStyle(svg).display,paths:paths.map(p=>{let m=p.getScreenCTM(),a=p.getPointAtLength(0),b=p.getPointAtLength(p.getTotalLength());let s=new DOMPoint(a.x,a.y).matrixTransform(m),t=new DOMPoint(b.x,b.y).matrixTransform(m);return {start:{x:s.x,y:s.y},end:{x:t.x,y:t.y},d:p.getAttribute('d')}}),origin:{x:nr.right,y:(nr.top+nr.bottom)/2},targets:areas}}''')
 if width>900:
  assert len(d['paths'])==len(d['targets'])==4,d
  for p,a in zip(d['paths'],d['targets']):assert abs(p['start']['x']-d['origin']['x'])<=1 and abs(p['start']['y']-d['origin']['y'])<=1 and abs(p['end']['x']-a['x'])<=1 and abs(p['end']['y']-a['y'])<=1,d
 else:assert d['display']=='none' and len(d['targets'])==4,d
 return d

def restore_compare(before,after):
 assert before['selected']==after['selected']==['purpose'];assert before['depths']==after['depths'];assert before['related']==after['related'];assert before['helpOpen']==after['helpOpen']
 for k in ['left','top']:assert abs(before['mapScroll'][k]-after['mapScroll'][k])<=1,(before,after)
 assert abs(before['windowY']-after['windowY'])<=1 and before['appliedTransform']==after['appliedTransform'] and before['canvasScale']==after['canvasScale'],(before,after)
 diffs={}
 for id,n in before['nodes'].items():
  diffs[id]={k:after['nodes'][id]['rect'][k]-n['rect'][k] for k in ['x','y','width','height']};assert all(abs(x)<=1 for x in diffs[id].values()),diffs
 assert after['active']=='purpose' and not after['mapHidden'] and after['focusHidden'] and after['peekCount']==0 and not after['prepOpen'],after
 return diffs

def prep_open():
 ensure('#prepBtn');before=scrollstate();g=geo(page.locator('#prepBtn'));click('#prepBtn',False);assert page.locator('#prep').evaluate('e=>e.open')
 text=page.locator('#prep').inner_text();assert all(t in text for t in ['準備' if False else '준비 제안','보내지 않습니다','현재 요청 원문','후속 보완','받을 담당자: 기록에 없음']),text
 readings=[]
 selectors=['#prepBody dd:nth-of-type(5) li:nth-child('+str(i)+')' for i in [1,2,3]]+['#prepBody dd:nth-of-type(6) li:nth-child('+str(i)+')' for i in [1,2,3,4]]+['#prepBody .nosend']
 r=page.locator('#prepBody').bounding_box();over=(r['x']+r['width']*.6,min(height-50,r['y']+r['height']*.6))
 for sel in selectors:
  geom=ensure(sel,over);readings.append({'selector':sel,'text':page.locator(sel).inner_text(),'geometry':geom,'scroll':scrollstate()})
 return {'before':before,'originGeometry':g,'text':text,'lowerReadings':readings,'bodyMetrics':page.locator('#prepBody').evaluate('e=>({top:e.scrollTop,max:e.scrollHeight-e.clientHeight,clientHeight:e.clientHeight,scrollHeight:e.scrollHeight})'),'closeGeometry':geo(page.locator('#prepClose'))}

def prep_close(opened):
 click('#prepClose',False);after=scrollstate();d=geo(page.locator('#prep'));origin=geo(page.locator('#prepBtn'))
 assert not page.locator('#prep').evaluate('e=>e.open') and d['box']['width']==0 and d['box']['height']==0 and not d['hit'];assert after['focus']=='prepBtn' and origin['full'] and origin['hit'],(after,origin)
 assert after['windowY']==opened['before']['windowY'] and after['reading']==opened['before']['reading'],(opened,after)
 return {'afterImmediate':after,'dialogGeometry':d,'originGeometry':origin}
