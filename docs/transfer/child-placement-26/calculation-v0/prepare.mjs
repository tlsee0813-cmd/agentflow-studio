// Small isolated source preparation. No installs, network, server, browser or product source writes.
import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync,copyFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=fileURLToPath(new URL('.',import.meta.url)),source=path.resolve(here,'../product23-author/app/continuity/src');
const gitBlob=b=>createHash('sha1').update(Buffer.from(`blob ${b.length}\0`)).update(b).digest('hex');
const manifest=JSON.parse(readFileSync(path.join(here,'source-tree.json'),'utf8'));
for(const flavor of ['baseline','candidate']){
  assert.equal(existsSync(path.join(here,flavor+'-src')),false,'refuse overwrite');
  for(const entry of manifest){const relative=entry.path.split('/src/')[1],bytes=readFileSync(path.join(source,relative));assert.equal(gitBlob(bytes),entry.sha);assert.equal(bytes.length,entry.size);
    const out=path.join(here,flavor+'-src',relative);mkdirSync(path.dirname(out),{recursive:true});writeFileSync(out,bytes);
  }
  writeFileSync(path.join(here,flavor+'-tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2022',module:'NodeNext',moduleResolution:'NodeNext',lib:['ES2022','DOM','DOM.Iterable'],strict:true,noUncheckedIndexedAccess:true,exactOptionalPropertyTypes:true,noFallthroughCasesInSwitch:true,noEmitOnError:true,rootDir:flavor+'-src',outDir:flavor+'-dist',sourceMap:false,declaration:false,types:[]},include:[flavor+'-src/**/*.ts']},null,2)+'\n');
}
writeFileSync(path.join(here,'package.json'),'{"type":"module","private":true}\n');
const candidate=path.join(here,'candidate-src/shared/domain.ts'),old=readFileSync(candidate,'utf8');
const before='const at=near??areaPosition(p,parent),n=addArea(p,name,note,{x:at.x+GRID_X,y:at.y+GRID_Y});';
const after='const at=near??areaPosition(p,parent),n=addArea(p,name,note,{x:at.x+(near?GRID_X:0),y:at.y+GRID_Y});';
assert.equal(old.split(before).length,2);writeFileSync(candidate,old.replace(before,after));
writeFileSync(path.join(here,'candidate-one-line.patch'),`--- baseline-src/shared/domain.ts\n+++ candidate-src/shared/domain.ts\n@@ -646 +646 @@\n-  ${before}\n+  ${after}\n`);
const rawRoot=path.resolve(here,'../product24-evidence-review/remote'),download=JSON.parse(readFileSync(path.resolve(here,'../product24-evidence-review/download-receipt.json'),'utf8'));
assert.equal(download.fixedCommit,'b1f291c630708a89fe0db08f23008ff1262b7604');
for(const name of ['result.json.gz','1280-baseline-project.json','1440-baseline-project.json']){const row=download.files.find(x=>x.path===name),b=readFileSync(path.join(rawRoot,name));assert.equal(gitBlob(b),row.gitBlob);}
const raw=JSON.parse(gunzipSync(readFileSync(path.join(rawRoot,'result.json.gz'))));
const geometry=raw.rows.map(row=>({viewport:row.viewport,map:row.fitted.map,controls:row.fitted.controls,plane:row.fitted.snapshot.plane}));
writeFileSync(path.join(here,'raw24-fit-geometry.json'),JSON.stringify(geometry,null,2)+'\n');
for(const width of [1280,1440])copyFileSync(path.join(rawRoot,`${width}-baseline-project.json`),path.join(here,`${width}-baseline-project.json`));
console.log(JSON.stringify({sources:manifest.length,change:'Only default addChildArea x offset: parent.x instead of parent.x+300; supplied near retains +300/+200',geometry:geometry.map(g=>({viewport:g.viewport,mapKeys:Object.keys(g.map),mapRect:g.map.rect,controlsRect:g.controls.rect,mapOwn:g.map.ownClient,mapClient:g.map.client}))},null,2));
