// Fixed, synthetic geometry experiment. Public domain APIs; no UI readability or adoption claim.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import * as Old from './baseline-dist/shared/domain.js';
import * as Candidate from './candidate-dist/shared/domain.js';
import {parseProject,POSITION_LIMIT} from './baseline-dist/shared/validation.js';
import {fitViewport} from './baseline-dist/client/presentation.js';
import {descendantAreas} from './baseline-dist/shared/hierarchy.js';
const copy=v=>structuredClone(v),here=new URL('.',import.meta.url),W=240,H=180;
const rawGeometry=JSON.parse(readFileSync(new URL('raw24-fit-geometry.json',here),'utf8'));
const viewports=rawGeometry.map(g=>{
  // From saved observed border boxes + unchanged CSS border1. DOM client/offset dimensions are integers.
  const clientWidth=Math.round(g.map.rect.width-2),clientHeight=Math.round(g.map.rect.height-2);
  const controlOffsetTop=Math.round(g.controls.rect.top-g.map.rect.top-1),controlOffsetHeight=Math.round(g.controls.rect.height);
  const top=Math.max(0,controlOffsetTop+controlOffsetHeight+8-24);
  return {viewport:g.viewport,mapBorderBox:g.map.rect,clientWidth,clientHeight,controlOffsetTop,controlOffsetHeight,top,fitWidth:clientWidth-48,fitHeight:clientHeight-top-48,derivation:'Saved actual24 border boxes; unchanged1px border and integer DOM sizing. No new browser measurement.'};
});
function setup(defs){
  let p=Old.setBrief(Old.createProject(),'[合成26] 配置比較のみ。実利用/実行結果ではない。'),ids={};
  for(const d of defs){p=Old.addArea(p,d.name,'[합성26] 짧은 구상');const id=p.space.areas.at(-1).id;ids[d.name]=id;p=Old.moveArea(p,id,{x:d.x,y:d.y});}
  for(const d of defs){if(d.parent)p=Old.setAreaParent(p,ids[d.name],ids[d.parent]);if(d.archived)p=Old.setAreaArchived(p,ids[d.name],true);}
  // Non-layout data must also survive adding a child. This is not a model response or hidden UI setup.
  const root=defs.find(d=>!d.archived).name;p=Old.submit(Old.editDraft(p,'[합성26] 기존 요청을 보존한다.'),undefined,ids[root]);
  for(const key of ['understanding','scope','next','checks'])p=Old.editTask(p,p.currentTaskId,key,`[합성 직접 ${key}] 그대로`);
  p=Old.recordBasis(p,'[합성26] 기존 확정 기준 보존');p=Old.editDraft(p,'[합성26] 미전송 초안 보존');
  return {p,ids};
}
const named=(p,a)=>({name:a.name,id:a.id,x:p.space.layout.positions[a.id].x,y:p.space.layout.positions[a.id].y,archived:a.archived,parent:p.space.containment.parents[a.id]??null});
function boxOf(p){const areas=p.space.areas.filter(a=>!a.archived),points=areas.map(a=>p.space.layout.positions[a.id]);const minX=Math.min(...points.map(q=>q.x)),minY=Math.min(...points.map(q=>q.y)),maxX=Math.max(...points.map(q=>q.x+W)),maxY=Math.max(...points.map(q=>q.y+H));return {minX,minY,maxX,maxY,width:maxX-minX,height:maxY-minY};}
const overlap=(a,b)=>a.x<b.x+W&&b.x<a.x+W&&a.y<b.y+H&&b.y<a.y+H;
function frameProjection(p){
  const active=p.space.areas.filter(a=>!a.archived);return active.flatMap(a=>{
    const descendants=descendantAreas(p,a.id).filter(x=>!x.archived);if(!descendants.length)return [];
    const members=new Set([a.id,...descendants.map(x=>x.id)]),inside=active.filter(x=>members.has(x.id)).map(x=>p.space.layout.positions[x.id]);
    const x=Math.min(...inside.map(x=>x.x))-14,y=Math.min(...inside.map(x=>x.y))-14,right=Math.max(...inside.map(x=>x.x+W))+14,bottom=Math.max(...inside.map(x=>x.y+H))+14;
    const foreign=active.filter(x=>!members.has(x.id)).filter(a=>{const t=p.space.layout.positions[a.id];return x<t.x+W&&t.x<right&&y<t.y+H&&t.y<bottom;}).map(a=>a.name);
    return [{parent:a.name,frame:{x,y,width:right-x,height:bottom-y},foreignCardsIntersecting:foreign,omitted:foreign.length>0,meaning:'Hypothetical projection of unchanged frame omission logic with fixed240x180 card boxes. No actual DOM/frame observation.'}];
  });
}
function addAndInspect(D,p,parentId,name,near){
  const before=copy(p),n=D.addChildArea(p,parentId,name,'[합성26] 새 하위 부분',near),child=n.space.areas.at(-1),at=n.space.layout.positions[child.id];
  assert.deepEqual(p,before,'input never mutated');
  const restored=copy(n);restored.revision=before.revision;restored.space.areas.pop();delete restored.space.layout.positions[child.id];delete restored.space.containment.parents[child.id];delete restored.space.containment.revisions[child.id];
  assert.deepEqual(restored,before,'only new area/position/containment and normal revision increments differ');
  assert.deepEqual(parseProject(JSON.stringify(n)),n,'existing schema validation/roundtrip');
  for(const a of before.space.areas)assert.deepEqual(n.space.layout.positions[a.id],before.space.layout.positions[a.id],'every prior stored/manual/archived point preserved');
  const collisions=n.space.areas.filter(a=>a.id!==child.id).filter(a=>overlap(at,n.space.layout.positions[a.id])).map(a=>({name:a.name,archived:a.archived}));
  const reserveClashes=n.space.areas.filter(a=>a.id!==child.id).filter(a=>{const q=n.space.layout.positions[a.id];return Math.abs(at.x-q.x)<260&&Math.abs(at.y-q.y)<200;}).map(a=>a.name);
  const boxes=n.space.areas.filter(a=>!a.archived).map(a=>({...n.space.layout.positions[a.id],w:W,h:H}));
  const fits=viewports.map(v=>{const f=fitViewport(v.clientWidth,v.clientHeight-v.top,boxes,24);return {viewport:v.viewport,scale:f.s,x:f.x,y:f.y+v.top,effectiveTitle15px:15*f.s,limitingAxis:Math.abs(f.s-v.fitWidth/boxOf(n).width)<1e-9?'width':Math.abs(f.s-v.fitHeight/boxOf(n).height)<1e-9?'height':'cap'};});
  return {project:n,output:{newPosition:at,newName:name,areaCount:n.space.areas.length,activeCount:n.space.areas.filter(a=>!a.archived).length,bbox:boxOf(n),fits,collisions,reserveClashes,pointInsideLimit:Math.abs(at.x)<=POSITION_LIMIT&&Math.abs(at.y)<=POSITION_LIMIT,allOtherProjectFieldsUnchanged:true,priorStoredCoordinatesUnchanged:true,frames:frameProjection(n)}};
}
const cases=[];
function compare(label,setup,parentName,near,meta={}){
  const old=addAndInspect(Old,setup.p,setup.ids[parentName],'새 child',near),now=addAndInspect(Candidate,setup.p,setup.ids[parentName],'새 child',near);
  const row={label,synthetic:true,...meta,parent:parentName,explicitNear:near??null,input:setup.p.space.areas.map(a=>named(setup.p,a)),baseline:old.output,candidate:now.output,
    scaleChange:old.output.fits.map((f,i)=>({viewport:f.viewport,before:f.scale,after:now.output.fits[i].scale,ratio:now.output.fits[i].scale/f.scale,judgment:now.output.fits[i].scale>f.scale+1e-9?'larger':now.output.fits[i].scale<f.scale-1e-9?'smaller':'equal'}))};
  cases.push(row);return row;
}
for(const width of [1280,1440]){
  const p=JSON.parse(readFileSync(new URL(`${width}-baseline-project.json`,here),'utf8')),parent=p.space.areas.find(a=>a.name==='예약');
  const defs=p.space.areas.filter(a=>!p.space.containment.parents[a.id]).map(a=>({name:a.name,...p.space.layout.positions[a.id]}));
  const row=compare(`24 saved root coordinates ${width}`,setup(defs),'예약',undefined,{source:'b1f291 fixed baseline root coordinates, rebuilt with public APIs; existing original child/task removed by reconstruction, not by mutating source fixture',originalSavedChild:p.space.layout.positions[p.space.areas.find(a=>a.name==='예약 가능 여부').id]});
  assert.deepEqual(row.baseline.newPosition,row.originalSavedChild);
  assert.ok(Math.abs(row.baseline.fits[width===1280?0:1].scale-(width===1280?.469231:.592308))<1e-6);
}
for(const count of [4,6,8]){
  const roots=count/2,defs=[];for(let i=0;i<roots;i++)defs.push({name:`부모${i}`,x:40+300*i,y:40});
  for(let i=1;i<roots;i++)defs.push({name:`기존자식${i}`,x:40+300*i,y:240,parent:`부모${i}`});
  const row=compare(`fixed short structure total${count}`,setup(defs),'부모0');assert.equal(row.baseline.areaCount,count);assert.equal(row.candidate.areaCount,count);
}
{
  const seed=setup([{name:'깊이0',x:40,y:40}]);let old=seed.p,now=seed.p,oldParent=seed.ids['깊이0'],newParent=oldParent;
  for(let depth=1;depth<=4;depth++){
    const a=addAndInspect(Old,old,oldParent,`깊이${depth}`),b=addAndInspect(Candidate,now,newParent,`깊이${depth}`);
    old=a.project;now=b.project;oldParent=old.space.areas.at(-1).id;newParent=now.space.areas.at(-1).id;
    if(depth>=3)cases.push({label:`fixed chain depth${depth}`,synthetic:true,baseline:a.output,candidate:b.output,scaleChange:a.output.fits.map((f,i)=>({viewport:f.viewport,before:f.scale,after:b.output.fits[i].scale,ratio:b.output.fits[i].scale/f.scale,judgment:b.output.fits[i].scale>f.scale+1e-9?'larger':b.output.fits[i].scale<f.scale-1e-9?'smaller':'equal'}))});
  }
}
compare('archived card directly below parent',setup([{name:'부모',x:40,y:40},{name:'보관카드',x:40,y:240,archived:true}]),'부모');
compare('nearby other parent and reserved child; unfavorable left spill',setup([{name:'부모A',x:0,y:0},{name:'기존A자식',x:0,y:200,parent:'부모A'},{name:'다른부모B',x:300,y:200},{name:'외곽foreign',x:600,y:0}]),'부모A');
compare('POSITION_LIMIT upper corner',setup([{name:'부모',x:POSITION_LIMIT-100,y:POSITION_LIMIT-100}]),'부모');
const explicit=compare('explicit near far away remains legacy offset',setup([{name:'부모',x:40,y:40}]),'부모',{x:12000,y:-16000});assert.deepEqual(explicit.candidate.newPosition,explicit.baseline.newPosition);assert.deepEqual(explicit.candidate.newPosition,{x:12300,y:-15800});
compare('previous manual coordinates preserved',setup([{name:'수동부모',x:-730,y:410},{name:'수동다른부분',x:1143,y:-857},{name:'보관수동',x:-730,y:610,archived:true}]),'수동부모');
const report={basis:'689c47888fb7ab5040d184c2d36f2adff8f2a575 (source blobs verified against unchanged merged checkpoint)',candidate:'Only missing-near addChildArea x offset changed; explicit near path unchanged',node:process.version,cardAssumption:{width:W,height:H,source:'unchanged styles.css fixed border-box240x180'},viewports,cases,
  safety:{originalProjectsMutated:false,existingCoordinatesChanged:false,otherFieldsChanged:false,allRoundtripsValid:true,totalNewCollisions:cases.reduce((s,c)=>s+c.baseline.collisions.length+c.candidate.collisions.length,0),newPositionOutsideLimit:cases.some(c=>!c.baseline.pointInsideLimit||!c.candidate.pointInsideLimit)},
  limitations:['Pure geometry and actual isolated domain calculation; no browser/server, actual label legibility, native actions or user study.','Root-coordinate24 comparison reconstructs only the three saved roots via public APIs, plus explicitly synthetic existing manual work/draft/basis sentinel. It is not the original full saved project.','Frame projections mirror the current omitted-on-foreign-overlap rule using fixed card boxes. Group title collision lifting and actual DOM/text/line rendering are not simulated. Frames do not enter fit bounds.','Same observed24 map/control geometry reused for every scenario; different real UI header/content could change available space. No fitted minimum zoom or all-fit semantic change.','Candidate comparison is not product adoption. Unfavorable/equal cases remain evidence.']};
writeFileSync(new URL('RESULT.json',here),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({caseCount:cases.length,safety:report.safety,viewports,cases:cases.map(c=>({label:c.label,old:c.baseline.newPosition,candidate:c.candidate.newPosition,beforeBox:c.baseline.bbox,afterBox:c.candidate.bbox,scales:c.scaleChange,frame:c.candidate.frames}))},null,2));
