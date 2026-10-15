const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const sourcePath = path.resolve(process.argv[2] || 'work/cycle/docs/cycles/2026-10-15-mixed-depth-01/canvas-study.html');
const reportPath = path.resolve(process.argv[3] || 'work/acceptance9/results.candidate.json');
const source = fs.readFileSync(sourcePath);
const sha = data => crypto.createHash('sha256').update(data).digest('hex').toUpperCase();
const copy = value => JSON.parse(JSON.stringify(value));
const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const script = source.toString('utf8').match(/<script>([\s\S]*?)<\/script>/)[1];

// Only a generated-markup tree: no browser DOM, CSS, layout, visibility or hit testing.
function parse(html) {
  const root = {tag:'root',attrs:{},children:[]}, stack=[root];
  for (const token of html.matchAll(/<!--[\s\S]*?-->|<\/?[^>]+>|[^<]+/g)) {
    const raw=token[0];
    if(raw.startsWith('<!--')) continue;
    if(raw.startsWith('</')) { const name=raw.match(/^<\/([^\s>]+)/)[1]; while(stack.length>1) if(stack.pop().tag===name) break; continue; }
    if(raw.startsWith('<')) {
      const tag=raw.match(/^<([^\s/>]+)/)?.[1]; if(!tag) continue;
      const attrs=Object.fromEntries([...raw.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
      const node={tag,attrs,children:[]}; stack.at(-1).children.push(node);
      if(!/\/>$/.test(raw) && !['br','hr','input','img','meta','link'].includes(tag)) stack.push(node);
    } else stack.at(-1).children.push({tag:'#text',text:raw,attrs:{},children:[]});
  }
  return root;
}
function all(node,predicate) { return !node?[]:[...(predicate(node)?[node]:[]),...node.children.flatMap(n=>all(n,predicate))]; }
function text(node,skip=()=>false) { return !node||skip(node)?'':node.tag==='#text'?node.text:node.children.map(n=>text(n,skip)).join(' '); }
const attr=(node,name,value)=>all(node,n=>n.attrs[name]===value)[0];
const hasClass=(node,name)=>(node.attrs.class||'').split(' ').includes(name);
const sections=node=>all(node,n=>n.tag==='section'&&hasClass(n,'sec'));
const section=(node,title)=>sections(node).find(n=>text(n.children.find(c=>c.tag==='h3')).trim()===title);
const keyNode=(tree,key)=>attr(tree,'data-key',key);
const actions=node=>all(node,n=>n.tag==='button'&&n.attrs['data-val']==='A2'&&['jump','select'].includes(n.attrs['data-action']));
const pending=n=>/미결/.test(text(n));
const ownedPending=n=>pending(n)&&/A2/.test(text(n));
const changed=n=>/결정 변경\s*(?:1(?:건)?|$)|Δ\s*결정 변경/.test(text(n));
const snapshot=t=>{const d=t.current();return copy({sel:d.sel,expanded:d.expanded,listOpen:d.listOpen,vp:d.vp,stack:d.stack});};

function boot(width=1440) {
  let elements={},html='',tree;
  const handlers={},app={dataset:{},attrs:{}};
  const doc={activeElement:null,getElementById:id=>id==='app'?app:elements[id]||null};
  function button(key) { const n=keyNode(tree,key); if(!n||n.tag!=='button') return null; return {disabled:false,getAttribute:k=>n.attrs[k]??null,classList:{contains:k=>hasClass(n,k)},focus(){doc.activeElement=this;}}; }
  app.querySelector=selector=>button(selector.match(/^\[data-key="([^"]+)"\]$/)?.[1]);
  doc.querySelector=app.querySelector;
  app.addEventListener=(name,fn)=>handlers[name]=fn;
  app.setAttribute=(name,value)=>{app.attrs[name]=String(value);if(name.startsWith('data-')) app.dataset[name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(value);};
  Object.defineProperty(app,'innerHTML',{get:()=>html,set:value=>{html=value;tree=parse(html);elements={};for(const n of all(tree,n=>!!n.attrs.id))elements[n.attrs.id]={id:n.attrs.id,style:{},scrollTop:0,clientWidth:width===390?390:1080,clientHeight:width===390?600:820,textContent:'',focus(){doc.activeElement=this;}};}});
  const win={innerWidth:width,addEventListener(){}};
  vm.runInNewContext(script,{document:doc,window:win},{filename:sourcePath});
  return {app,doc,win,tree:()=>tree,click:key=>{const b=button(key);if(!b)throw Error('Missing action '+key);handlers.click({target:{closest:()=>b}});},scene:()=>win.__canvasStudy.state.scenes[win.__canvasStudy.state.scene],current:()=>{const sc=win.__canvasStudy.state.scenes[win.__canvasStudy.state.scene];return sc[sc.dest];}};
}
const C=t=>all(t.tree(),n=>n.attrs['data-collapsed']==='true'&&n.attrs['data-box']==='A')[0];
const inspector=t=>attr(t.tree(),'id','insp');
const Csummary=t=>{const node=C(t);return node?{...node,children:node.children.filter(n=>n.tag!=='ul')}:null;};
const edges=t=>all(t.tree(),n=>n.tag==='path'&&!!n.attrs['data-edge']).map(n=>n.attrs['data-edge']+':'+n.attrs['data-state']).sort();
const expectedEdges=['A2-B:confirmed','A4-B:confirmed','A6-B:confirmed'];
const a2Arrival=t=>t.current().sel==='A2'&&/실패 알림 정책/.test(text(section(inspector(t),'변경 전후 · E04')))&&/아직 결정하지 않음/.test(text(section(inspector(t),'변경 전후 · E04')));
const results=[];
function run(id,scene,location,fn) { const checks={},observed={}; try{fn(checks,observed);}catch(e){checks.execution=false;observed.error=e.message;}results.push({id,scene,location,status:Object.values(checks).every(Boolean)?'PASS':'FAIL',checks,observed}); }
function enter(scene,width=1440){const t=boot(width);t.click('scene-'+scene);return t;}
function goLocal(t,region,checks,observed,{pendingAction=false}={}){
  const candidates=actions(region).filter(n=>!pendingAction||pending(n));
  checks.localA2Action=candidates.length>0;
  observed.actionKeys=candidates.map(n=>n.attrs['data-key']);
  if(!candidates.length)return;
  const before=snapshot(t);t.click(candidates[0].attrs['data-key']);checks.arrivesAtCurrentA2Unresolved=a2Arrival(t);t.click('ins-back');checks.viewRestored=equal(before,snapshot(t));
}

run('A9-01',1,'C / B / A2 / focus / 390 outline',(c,o)=>{
  const t=boot();t.click('cv-toggleA');const summary=Csummary(t);c.noFutureInCollapsed=!pending(summary)&&!/실패 알림|E04/.test(text(summary));c.unconfirmedOnly=equal(edges(t),['A-B-area:unconfirmed']);
  t.click('node-B');c.noFutureInB=!pending(inspector(t))&&!/실패 알림|E04/.test(text(inspector(t)));
  t.click('cv-toggleA');t.click('node-A2');c.noFutureInA2=!pending(inspector(t))&&!/실패 알림/.test(text(inspector(t)));t.click('ins-focusA');c.noFutureInFocus=!pending(inspector(t));
  const m=boot(390);c.narrowDefaultsToOutline=m.app.dataset.pane==='outline';c.noFutureInOutline=!pending(attr(m.tree(),'id','outline'))&&!/E04|실패 알림/.test(text(attr(m.tree(),'id','outline')));o.edges=edges(t);
});
for(const scene of [2,3]) {
  run('A9-02',scene,'C collapsed summary, excluding endpoint list',(c,o)=>{const t=enter(scene);t.click('cv-selA');t.click('cv-toggleA');const summary=Csummary(t);o.localText=text(summary).trim();c.changed=changed(summary);c.A2OwnedPending=ownedPending(summary);goLocal(t,summary,c,o,{pendingAction:true});c.pendingSurvivesReturn=ownedPending(Csummary(t));c.staysCollapsed=!t.current().expanded;const before=snapshot(t);t.click('cv-focusA');t.click('crumb-root');c.collapsedFocusRoundtrip=equal(before,snapshot(t));c.pendingSurvivesFocusRoundtrip=ownedPending(Csummary(t));});
  for(const surface of ['L1','L2','L3'])run('A9-03',scene,surface+' A2 row only',(c,o)=>{const t=enter(scene,surface==='L3'?390:1440);if(surface==='L1'){t.click('cv-toggleA');t.click('cv-list');}else if(surface==='L2')t.click('node-B');else t.doc.getElementById('outline').scrollTop=120;const prefix=surface==='L1'?'cl-':surface==='L2'?'ins-ep-':'ol-rel-';const row=keyNode(t.tree(),prefix+'A2');o.localText=text(row).trim();c.changed=changed(row);c.A2OwnedPending=ownedPending(row);goLocal(t,row,c,o);for(const id of ['A4','A6']){const sibling=keyNode(t.tree(),prefix+id);c[id+'NoPropagation']=!!sibling&&!pending(sibling)&&!changed(sibling);}c.threeRelations=equal(edges(t),expectedEdges);if(surface==='L3'){t.click('ins-to-outline');c.outlineScrollRestored=t.doc.getElementById('outline').scrollTop===120;} });
  run('A9-04',scene,'B unresolved section only',(c,o)=>{const t=enter(scene);t.click('node-B');const region=section(inspector(t),'미결 참조');o.localText=text(region).trim();c.policyReferenced=/실패 알림 정책/.test(text(region))||/미결\s*(?:참조\s*)?1/.test(text(region));c.ownerA2=/소유\s*[:：]?\s*A2|A2\s*(?:소유|미결)/.test(text(region));goLocal(t,region,c,o,{pendingAction:true});c.returnsB=t.current().sel==='B';c.noRelationMutation=equal(edges(t),expectedEdges);});
  run('A9-05',scene,'A4/A6 own fields, view roundtrip and A2',(c,o)=>{
    const t=enter(scene);for(const id of ['A4','A6']){const card=keyNode(t.tree(),'node-'+id);c[id+'CardNoPropagation']=!pending(card)&&!changed(card);t.click('node-'+id);const ins=inspector(t);c[id+'OwnFieldsUnchanged']=/없음/.test(text(section(ins,'변경')))&&!/실패 알림 정책/.test(text(section(ins,'현재')));}
    const before=snapshot(t);t.click('cv-toggleA');t.click('cv-toggleA');c.expandRoundtrip=equal(before,snapshot(t));t.click('ins-focusA');t.click('node-A2');c.focusA2Unresolved=a2Arrival(t);c.focusThreeRelations=equal(edges(t),expectedEdges);t.click('crumb-root');c.overviewRestored=equal(before,snapshot(t));t.click('node-A2');c.unresolvedNotResolved=a2Arrival(t);c.overviewThreeRelations=equal(edges(t),expectedEdges);o.edges=edges(t);
  });
  run('A9-06-state-only',scene,'390 generated outline/detail route; no visibility assertion',(c,o)=>{
    const t=enter(scene,390);c.defaultPaneOutline=t.app.dataset.pane==='outline';const outline=attr(t.tree(),'id','outline');const route=actions(outline).filter(n=>n.attrs['data-key']==='ol-A2'&&ownedPending(n));o.outlineOwnedPendingRoutePresent=route.length>0;o.outlineObservationScope='Optional generic structure row ol-A2 observation only, excluded from mandatory acceptance 9 assertions. Relation row ol-rel-A2 is separately required as L3.';o.routeKeys=route.map(n=>n.attrs['data-key']);
    if(route.length){t.doc.getElementById('outline').scrollTop=120;t.click(route[0].attrs['data-key']);c.routeArrivesA2=a2Arrival(t)&&t.app.dataset.pane==='detail';t.click('ins-to-outline');c.outlineScrollRestored=t.doc.getElementById('outline').scrollTop===120;}
    t.click('ol-B');const bOpen=section(inspector(t),'미결 참조');c.bOwnerA2=ownedPending(bOpen);const bRoute=actions(bOpen).filter(pending);c.bDirectA2Route=bRoute.length>0;if(bRoute.length){t.click(bRoute[0].attrs['data-key']);c.bArrivesA2=a2Arrival(t);}
    if(scene===3)c.baselineFixed=/합성 열람 E03 \/ 반영 E04/.test(text(all(t.tree(),n=>n.attrs['data-testid']==='baseline')[0]));o.limit='Generated markup and event state only; does not establish visible or scroll-reachable access.';
  });
}
const bUsabilityKeys=new Set(['localA2Action','arrivesAtCurrentA2Unresolved','viewRestored','bDirectA2Route','bArrivesA2']);
for(const r of results)r.assertionScopes=Object.fromEntries(Object.keys(r.checks).map(k=>[k,(r.id==='A9-04'||r.id==='A9-06-state-only')&&bUsabilityKeys.has(k)?'coordinator-usability-B-direct-action':'input9-reference-and-regression']));
const atomicChecks=results.flatMap(r=>Object.values(r.checks));
const failedScopeCounts={};for(const r of results)for(const [key,value]of Object.entries(r.checks))if(!value)failedScopeCounts[r.assertionScopes[key]]=(failedScopeCounts[r.assertionScopes[key]]||0)+1;
const summary={cases:{total:results.length,passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length},atomicAssertions:{total:atomicChecks.length,passed:atomicChecks.filter(Boolean).length,failed:atomicChecks.filter(v=>!v).length},failedScopeCounts,discoveryObservations:results.filter(r=>r.id==='A9-06-state-only').map(r=>({scene:r.scene,outlineOwnedPendingRoutePresent:r.observed.outlineOwnedPendingRoutePresent,mandatory:false}))};
const report={sourcePath,sourceSha256:sha(source),checkerSha256:sha(fs.readFileSync(__filename)),timestampUTC:new Date().toISOString(),environment:'Node '+process.version+'; synthetic event/element stubs and local generated-markup tree; no DOM or browser',summary,results,browser:{status:'NOT_RUN',reason:'State/markup checker cannot establish actual 1440/390 visibility, clipping or clickability.'}};
fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({sourceSha256:report.sourceSha256,checkerSha256:report.checkerSha256,reportPath,summary,results:results.map(r=>({id:r.id,scene:r.scene,location:r.location,status:r.status,failed:Object.entries(r.checks).filter(([,v])=>!v).map(([k])=>k)})),browser:report.browser},null,2));
if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
