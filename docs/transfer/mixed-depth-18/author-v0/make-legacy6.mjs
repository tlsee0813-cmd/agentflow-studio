import{execFileSync,spawnSync}from'node:child_process';
import{mkdirSync,writeFileSync}from'node:fs';
import{resolve}from'node:path';
import{pathToFileURL}from'node:url';
const base='7bea120983c3571b26164d6acd40f350611a7213',folder=resolve('../product18-author-evidence/baseline6');
mkdirSync(folder+'/src/shared',{recursive:true});writeFileSync(folder+'/package.json','{"type":"module"}');
const files=execFileSync('git',['ls-tree','-r','--name-only',base,'app/continuity/src/shared'],{encoding:'utf8'}).trim().split('\n');
for(const file of files)writeFileSync(folder+'/src/shared/'+file.split('/').at(-1),execFileSync('git',['show',`${base}:${file}`]));
const tsc=resolve('app/node_modules/typescript/bin/tsc');const r=spawnSync(process.execPath,[tsc,'--target','ES2022','--module','NodeNext','--moduleResolution','NodeNext','--strict','--skipLibCheck','--lib','ES2022,DOM','--rootDir',folder+'/src','--outDir',folder+'/dist',...files.map(f=>folder+'/src/shared/'+f.split('/').at(-1))],{encoding:'utf8'});process.stdout.write(r.stdout??'');process.stderr.write(r.stderr??'');if(r.status!==0)process.exit(r.status??1);
const D=await import(pathToFileURL(folder+'/dist/shared/domain.js'));
let p=D.setBrief(D.createProject(),'[합성 호환 경계] 실제 승인된 project.6 코드가 생성한 기존 기록');const ids={};
for(const name of ['유효한 기존 설명','사용자 정정된 기존 설명','보류된 기존 설명']){p=D.addArea(p,name,'기존 사용자 구상');ids[name]=p.space.areas.at(-1).id;}
for(const [name,area]of Object.entries(ids)){p=D.submit(D.editDraft(p,`${name}의 기존 요청`),undefined,area);const task=p.currentTaskId,Hid=`H_legacy_${Object.keys(ids).indexOf(name)}`,text=D.handoffText(p,task,Hid);p=D.markHandoff(p,task,text,'download',p.revision,Hid);
const f={schemaVersion:'agentflow.return.2',projectId:p.id,taskId:task,returnId:Hid,report:'[합성 호환 경계] 이전 보고 원문',evidence:null,understanding:{version:'understanding.1',areaId:area,basedOn:0,summary:`${name}의 전달 설명`,changes:[],proposal:null,origin:'고정 baseline6 코드 생성·합성 호환 경계'}};
if(name.startsWith('보류'))p=D.editArea(p,area,name,'수신 전에 바꾼 구상');p=D.importResultFile(p,JSON.stringify(f));if(name.startsWith('사용자'))p=D.correctUnderstanding(p,area,'이전 사용자가 정정한 설명');}
if(p.schemaVersion!=='idea015.project.6')throw Error('not actual old code');
const out=resolve('app/continuity/tests/fixtures/hierarchy18');mkdirSync(out,{recursive:true});writeFileSync(out+'/project6-accepted.json',JSON.stringify(p,null,2)+'\n');
writeFileSync(out+'/project6-origin.json',JSON.stringify({sourceCommit:base,generatedBy:'unchanged shared source compiled from git show, not version relabeling',nature:'synthetic compatibility boundary; three actual v6 state paths',areaIds:ids,expected:Object.fromEntries(Object.entries(ids).map(([name,id])=>{const d=D.areaDescription(p,id);return [id,{valid:d.current?.valid??null,summary:d.current?.summary??null,by:d.current?.entry.by??null,held:d.held.map(x=>x.entry.held)}]}))},null,2)+'\n');
console.log('Fixed actual project.6 fixture written from pinned original code; no server or provider.');
