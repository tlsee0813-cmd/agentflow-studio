import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const evidence=import.meta.dirname,root=resolve(evidence,'../product18-author'),old=JSON.parse(readFileSync(resolve(evidence,'CORE_FINAL.json'),'utf8'));
const sha=data=>createHash('sha256').update(data).digest('hex'),attention='app/continuity/src/shared/attention.ts',test='app/continuity/tests/hierarchy18.test.mjs';
const now=readFileSync(resolve(root,attention),'utf8'),before=now.replace(/    for\(const task of p.tasks\)\{if\(isReturnTask\(p,task\).*?if\(trial.length&&!syntheticReply\)continue;\n/s,"    for(const task of p.tasks){if(isReturnTask(p,task)||!task.advice?.question||areaOf(p,task)!==a.id||taskStatus(p,task)==='시험 문맥 · 실제 요구 아님')continue;\n").replace("status=syntheticReply?'시험 답변 기록 · 실제 답변 아님':answered?","status=answered?");
const testNow=readFileSync(resolve(root,test),'utf8'),testBefore=testNow.slice(0,testNow.indexOf('for(const c of hierarchyCases)test(`H18 ${c.id}: original question retains attributed synthetic reply'));
let patch='';for(const [path,original]of [[attention,before],[test,testBefore]]){
 const expected=old.coreFiles.find(f=>f.path===path).sha256;if(sha(original)!==expected)throw new Error(`Reconstructed pre-fix bytes do not match frozen core manifest: ${path}`);
 const saved=resolve(evidence,path===attention?'synthetic-reply-before-attention.ts':'synthetic-reply-before-hierarchy18.test.mjs');writeFileSync(saved,original);
 const diff=spawnSync('git',['diff','--no-index','--',saved,resolve(root,path)],{encoding:'utf8'});if(![0,1].includes(diff.status))throw new Error(diff.stderr);patch+=diff.stdout;
}
writeFileSync(resolve(evidence,'synthetic-reply-focused.patch'),patch);
const stable=old.combinedFiles.filter(f=>(f.path.includes('/src/')||f.path.includes('/public/'))&&f.path!==attention).map(f=>{const current=sha(readFileSync(resolve(root,f.path)));if(current!==f.sha256)throw new Error(`Unexpected other product edit: ${f.path}`);return f.path;});
const result={scope:'Only attention subtree projection + hierarchy18 unit tests since frozen core; existing global questionAnswered/taskStatus/schema/UI untouched',
 files:[attention,test].map(path=>({path,oldSha256:old.coreFiles.find(f=>f.path===path).sha256,newSha256:sha(readFileSync(resolve(root,path)))})),otherProductFilesVerifiedUnchanged:stable,
 rule:'Preserve current question only when the original first source is a request and every synthetic source is an exact replyTo for current question text; label synthetic reply, not a real answer. Synthetic original input or different regenerated question remains excluded.',
 label:'시험 답변 기록 · 실제 답변 아님',uiEvidence:['app.ts:1273 renders q.status unchanged','app.ts:1602 renders it.status unchanged'],
 limitation:'Question identity in existing records is task+exact question text. Advice generation history/time and a per-source project revision are not stored. A same-text re-generation cannot be distinguished as a separate question generation; no timestamp or semantic origin is inferred. Existing questionAnswered behavior stays unchanged.',
 checks:{node:process.version,typescript:'5.8.3',focusedBefore:'synthetic-reply-unit-before: exit1,0pass2fail',focusedAfter:'synthetic-reply-unit-after: exit0,2pass0fail',publicApiBefore:'question-synthetic-reply-original:exit1,4pass2fail',publicApiAfter:'question-synthetic-reply-fixed:exit0,6pass0fail',type:'synthetic-reply-check:exit0',build:'synthetic-reply-build:exit0',allUnits:'synthetic-reply-units:exit0,261/261 (H18 22)',static:'synthetic-reply-static:exit0',browser:'NOT RUN',server:'NOT STARTED',commitPush:'NOT RUN'},
 preservedBeforeProject:'question-synthetic-reply-probe.json',separateAfterProject:'question-synthetic-reply-after.json',focusedDiff:'synthetic-reply-focused.patch'};
writeFileSync(resolve(evidence,'SYNTHETIC_REPLY_FIX.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
