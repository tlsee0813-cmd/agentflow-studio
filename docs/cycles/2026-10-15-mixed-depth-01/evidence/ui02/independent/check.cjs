const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const source = fs.readFileSync(path.join(root, 'canvas-study.html'));
const sha256 = crypto.createHash('sha256').update(source).digest('hex').toUpperCase();
if (sha256 !== '869C76A45F16042EC0A5063C81D1E638D21A2A3E87CE079B6BC5A60843632157') throw new Error('Source changed');
const script = source.toString('utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const copy = o => JSON.parse(JSON.stringify(o));
const eq = (a,b) => JSON.stringify(a) === JSON.stringify(b);

// Minimal event/markup/state harness, not a DOM or rendering engine.
function boot(width=1440) {
  let elements = {}, html = '';
  const handlers = {}, app = {dataset:{},attrs:{}};
  const doc = {activeElement:null, getElementById:id => id === 'app' ? app : elements[id] || null};
  function button(key) {
    const tag = html.match(new RegExp('<button\\b[^>]*data-key="'+key+'"[^>]*>'))?.[0];
    if (!tag) return null;
    const attrs = Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(x => [x[1],x[2]]));
    return {disabled:/\sdisabled(?:\s|>)/.test(tag), getAttribute:n=>attrs[n]??null,
      classList:{contains:n=>(attrs.class||'').split(' ').includes(n)},
      focus(){doc.activeElement=this;}};
  }
  app.querySelector = selector => button(selector.match(/^\[data-key="([^"]+)"\]$/)?.[1]);
  doc.querySelector = app.querySelector;
  app.addEventListener = (name,fn) => { handlers[name]=fn; };
  app.setAttribute = (name,value) => {app.attrs[name]=String(value); if(name.startsWith('data-')) app.dataset[name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(value);};
  Object.defineProperty(app,'innerHTML',{get:()=>html,set:v=>{
    html=v; elements={};
    for(const m of html.matchAll(/\bid="([^"]+)"/g)) elements[m[1]]={id:m[1],style:{},scrollTop:0,clientWidth:width===390?390:1080,clientHeight:width===390?600:820,textContent:'',focus(){doc.activeElement=this;}};
  }});
  const win={innerWidth:width,addEventListener(){}};
  vm.runInNewContext(script,{document:doc,window:win},{filename:'canvas-study.html'});
  return {app,doc,win,click:key=>{
    const b=button(key); if(!b) throw new Error('Missing key: '+key);
    handlers.click({target:{closest:()=>b}});
  }, scene:()=>win.__canvasStudy.state.scenes[win.__canvasStudy.state.scene],
  state:()=>{const s=win.__canvasStudy.state.scenes[win.__canvasStudy.state.scene];return s[s.dest];}, html:()=>html};
}
const results=[];
function record(id,checks,observed){results.push({id,status:Object.values(checks).every(Boolean)?'PASS':'FAIL',checks,observed});}
const edgeKeys=t=>[...t.html().matchAll(/<path data-edge="([^"]+)" data-state="([^"]+)"/g)].map(m=>m[1]+':'+m[2]).sort();
{
 const t=boot(); const s1=edgeKeys(t); t.click('cv-toggleA'); const s1c=edgeKeys(t);
 t.click('scene-2');const s2=edgeKeys(t);t.click('cv-toggleA'); const s2c=edgeKeys(t);
 record('I1-relationship-endpoints',{s1OnlyUnconfirmed:eq(s1,['A-B-area:unconfirmed'])&&eq(s1,s1c),s2ExactlyThree:eq(s2,['A2-B:confirmed','A4-B:confirmed','A6-B:confirmed'])&&eq(s2,s2c)}, {s1,s1c,s2,s2c});
}
{
 const t=boot(); t.click('scene-2');t.click('node-A4');t.click('pan-d');t.click('pan-r');
 const before=copy(t.state());t.click('ins-peer-A2'); const changed=t.html();t.click('ins-toB'); const atB=t.state().sel;
 t.click('ins-back'); const back1=t.state().sel;t.click('ins-back'); const after=copy(t.state());
 t.click('node-A2');const current=t.html();
 record('I2-A4-A2-B-nested-return',{atB:atB==='B',firstBackA2:back1==='A2',backA4Restores:eq(before,after),currentDataNotReverted:current.includes('D2')&&current.includes('대여 확정 후 알림')&&changed.includes('관계 자체의 변경이 아님')},{before,atB,back1,after});
}
{
 const t=boot();t.click('scene-2');t.click('node-A4');t.click('zoom-in');t.click('pan-r');
 const overview=copy(t.scene().overview);t.click('ins-focusA');t.click('node-A2');t.click('pan-l');const focused=copy(t.scene().focus);
 t.click('crumb-root');const back=copy(t.state());t.click('dest-focus');
 record('I3-overview-focus-independent',{overviewUnchanged:eq(overview,back),focusRetained:eq(focused,t.state())},{overview,back,focused});
}
{
 const t=boot();t.click('scene-3');t.click('bn-chg');t.click('ins-handoff');
 const ho=t.html().match(/<article class="handoff"[\s\S]*?<\/article>/)?.[0]||'';
 t.click('scene-1');t.click('scene-2');t.click('scene-3');
 record('I4-handoff-and-baseline',{projectPurpose:ho.includes('작은 도서 대여 서비스'),scopeA2:ho.includes('A2 대여 신청만')&&ho.includes('A4·A6는 범위 아님'),priorAndOpen:ho.includes('D2 신청 시 알림')&&ho.includes('실패 알림 정책'),candidateAndUnsent:ho.includes('후보, 배정·전달 아님')&&ho.includes('준비·미전달'),fixedBaseline:t.html().includes('합성 열람 E03 / 반영 E04')},{handoffFound:!!ho});
}
{
 const t=boot(390);t.click('scene-2');t.doc.getElementById('outline').scrollTop=120;t.click('ol-A4');
 const savedOnExit=t.scene().olScroll;t.click('ins-to-outline');const actual=t.doc.getElementById('outline').scrollTop;
 record('I5-outline-scroll-return',{scrollPreserved:actual===120},{expected:120,savedOnExit,actual,limitation:'DOM replacement resets scrollTop in harness, matching normal element replacement; no real browser observation'});
}
const checkerSha256=crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex').toUpperCase();
const report={sourcePath:path.relative(__dirname,path.join(root,'canvas-study.html')).split(path.sep).join('/'),sha256,checkerSha256,timestampUTC:new Date().toISOString(),environment:'Node '+process.version+'; synthetic DOM/event/geometry stubs; no browser',results};
fs.writeFileSync(path.resolve(__dirname,'results.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(results.some(r=>r.status==='FAIL')) process.exitCode=1;