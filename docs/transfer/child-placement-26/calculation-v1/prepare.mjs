import {readFileSync,writeFileSync,mkdirSync,existsSync,copyFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const here=fileURLToPath(new URL('.',import.meta.url)),up=path.resolve(here,'..');
const manifest=JSON.parse(readFileSync(path.join(up,'source-tree.json'),'utf8'));
assert.equal(existsSync(path.join(here,'candidate-src')),false,'refuse overwrite');
for(const e of manifest){const rel=e.path.split('/src/')[1],dest=path.join(here,'candidate-src',rel);mkdirSync(path.dirname(dest),{recursive:true});copyFileSync(path.join(up,'baseline-src',rel),dest);}
const domain=path.join(here,'candidate-src/shared/domain.ts');let source=readFileSync(domain,'utf8');
source=source.replace("import { areaPath, childrenOf } from './hierarchy.js';","import { areaPath, childrenOf, visibleAreas } from './hierarchy.js';");
const old="  const at=near??areaPosition(p,parent),n=addArea(p,name,note,{x:at.x+GRID_X,y:at.y+GRID_Y});";
const next=`  const at=near??areaPosition(p,parent);let target={x:at.x+GRID_X,y:at.y+GRID_Y};
  if(near===undefined) {
    // All-expanded visible card bounds only; archived cards still reserve slots in freeSlot.
    const right=freeSlot(p,target),below=freeSlot(p,{x:at.x,y:at.y+GRID_Y});
    const points=visibleAreas(p,new Set<string>()).map(a=>areaPosition(p,a));
    const bounds=(point:Point)=>{const all=[...points,point];return {
      w:Math.max(...all.map(a=>a.x+NODE_W))-Math.min(...all.map(a=>a.x)),
      h:Math.max(...all.map(a=>a.y+PLACEMENT_H))-Math.min(...all.map(a=>a.y))};};
    const r=bounds(right),b=bounds(below);
    if(b.w<=r.w&&b.h<=r.h&&(b.w<r.w||b.h<r.h))target=below;
  }
  const n=addArea(p,name,note,target);`;
assert.equal(source.split(old).length,2);writeFileSync(domain,source.replace(old,next));
writeFileSync(path.join(here,'candidate-change.txt'),next+'\n');
const config=JSON.parse(readFileSync(path.join(up,'candidate-tsconfig.json'),'utf8'));writeFileSync(path.join(here,'candidate-tsconfig.json'),JSON.stringify(config,null,2)+'\n');
copyFileSync(path.join(up,'run.mjs'),path.join(here,'run.mjs'));
let probe=readFileSync(path.join(up,'probe.mjs'),'utf8')
 .replaceAll("'./baseline-dist/","'../baseline-dist/")
 .replace("import * as Candidate from './candidate-dist/shared/domain.js';","import * as Candidate from './candidate-dist/shared/domain.js';\nimport * as Down from '../candidate-dist/shared/domain.js';")
 .replace("import {descendantAreas}","import {descendantAreas,visibleAreas}")
 .replace("new URL('raw24-fit-geometry.json',here)","new URL('../raw24-fit-geometry.json',here)")
 .replace("new URL(`${width}-baseline-project.json`,here)","new URL(`../${width}-baseline-project.json`,here)")
 .replace("const areas=p.space.areas.filter(a=>!a.archived),points=","const areas=visibleAreas(p,new Set()),points=")
 .replace("const boxes=n.space.areas.filter(a=>!a.archived).map(","const boxes=visibleAreas(n,new Set()).map(");
const insert=`
  let policyTrace=null;
  if(D===Candidate){
    const legacy=Old.addChildArea(p,parentId,name,'[합성26] 새 하위 부분',near),down=Down.addChildArea(p,parentId,name,'[합성26] 새 하위 부분',near);
    const rightPoint=legacy.space.layout.positions[legacy.space.areas.at(-1).id],belowPoint=down.space.layout.positions[down.space.areas.at(-1).id],rightBox=boxOf(legacy),belowBox=boxOf(down);
    const dominates=belowBox.width<=rightBox.width&&belowBox.height<=rightBox.height&&(belowBox.width<rightBox.width||belowBox.height<rightBox.height);
    const chosen=near===undefined&&dominates?'below':'legacy';assert.deepEqual(at,chosen==='below'?belowPoint:rightPoint);
    assert.ok(boxOf(n).width<=rightBox.width&&boxOf(n).height<=rightBox.height,'all-expanded bounding dimensions do not grow for this same input');
    const parentPoint=p.space.layout.positions[parentId];
    policyTrace={rightPoint,belowPoint,rightBox,belowBox,dominates,chosen,parentDelta:{x:at.x-parentPoint.x,y:at.y-parentPoint.y},rightFrames:frameProjection(legacy),belowFrames:frameProjection(down)};
  }
`;
probe=probe.replace("  return {project:n,output:{newPosition:at,",insert+"  return {project:n,output:{policyTrace,newPosition:at,");
const extra=`
compare('vertical tradeoff: narrower but taller below rejected',setup([{name:'부모A',x:0,y:0},{name:'아래점유',x:0,y:200},{name:'오른쪽점유',x:300,y:200},{name:'왼쪽점유',x:-300,y:200}]),'부모A');
const tie=compare('equal whole bounds keep legacy',setup([{name:'부모A',x:0,y:0},{name:'오른쪽외곽',x:600,y:0},{name:'아래외곽',x:0,y:600}]),'부모A');assert.equal(tie.candidate.policyTrace.chosen,'legacy');
const foreign=compare('below fits inside unrelated parent frame',setup([{name:'부모A',x:0,y:0},{name:'무관부모B',x:-300,y:200},{name:'B자식',x:0,y:600,parent:'무관부모B'}]),'부모A');assert.equal(foreign.candidate.policyTrace.chosen,'below');
`;
probe=probe.replace('const report={basis:',extra+'const report={basis:')
 .replace("candidate:'Only missing-near addChildArea x offset changed; explicit near path unchanged'","candidate:'v1: actual right/below freeSlot results; choose below only when both whole expanded-visible dimensions are no larger and at least one is smaller; explicit near unchanged'");
writeFileSync(path.join(here,'probe.mjs'),probe);
console.log('v1 isolated source/probe prepared; v0 untouched.');
