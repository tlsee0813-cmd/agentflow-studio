import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const here=fileURLToPath(new URL('.',import.meta.url)),root=path.resolve(here,'../product23-author');
const git=(...a)=>execFileSync('git',a,{cwd:root}),sha=b=>createHash('sha256').update(b).digest('hex').toUpperCase();
const files=['app/continuity/src/shared/types.ts','app/continuity/src/shared/domain.ts','app/continuity/src/shared/validation.ts','app/continuity/server/prompt.mjs','app/continuity/tests/description23.test.mjs'];
const head=git('rev-parse','HEAD').toString().trim();assert.equal(head,'f7b25a586dca42466f07c7db2bedb9c59703deda');
const changed=git('diff','--name-only').toString().trim().split('\n');assert.deepEqual(changed.sort(),files.slice(0,4).sort());
git('diff','--check');
const prompt=readFileSync(path.join(root,'app/continuity/server/prompt.mjs')),oldPrompt=git('show','HEAD:app/continuity/server/prompt.mjs');
const guide=b=>Buffer.from(b.toString().slice(b.toString().indexOf('// GUIDE097:')));
assert.equal(guide(prompt).equals(guide(oldPrompt)),true,'GUIDE prompt and builder byte-identical');
const hashes=files.map(f=>{const b=readFileSync(path.join(root,f)),dest=path.join(here,'frozen-source',f);mkdirSync(path.dirname(dest),{recursive:true});writeFileSync(dest,b);return {path:f,bytes:b.length,sha256:sha(b)};});
const patch=git('diff','--binary','HEAD');
let addition;try {addition=execFileSync('git',['diff','--no-index','--binary','--','NUL',files[4]],{cwd:root,encoding:null,maxBuffer:2e6,stdio:['ignore','pipe','pipe']});}
catch(e){assert.equal(e.status,1);addition=e.stdout;}
writeFileSync(path.join(here,'product23.patch'),Buffer.concat([patch,addition]));
const execution=readdirSync(here).filter(f=>f.endsWith('.exit.json')).sort().map(f=>({raw:f,...JSON.parse(readFileSync(path.join(here,f),'utf8'))}));
const ui=['app/continuity/src/client/app.ts','app/continuity/public/styles.css','app/continuity/public/index.html'].map(f=>{
  const current=readFileSync(path.join(root,f)),base=git('show',`HEAD:${f}`);assert.equal(current.equals(base),true);return {path:f,sha256:sha(current),byteIdenticalToBase:true};
});
const receipt={head,detached:git('branch','--show-current').toString().trim()==='',contract:{ref:'01aa3cbb80b44bca51e17301f6de6ecd7dae5513',path:'docs/cycles/2026-10-23-correction-context-23',INPUTblob:'eede0e579947e4303e6a6a0330ad6c4a7cb55b46',RESEARCHblob:'b61ff54c2496666ea419312504f3793c9ef78df3'},node:process.version,typescript:'5.8.3 reused locked dependency',files:hashes,patchSHA256:sha(Buffer.concat([patch,addition])),unchangedUI:ui,guideByteIdentical:true,guideSHA256:sha(guide(prompt)),diffCheckExit:0,execution,
  expectedFailures:[{label:'unit-description23-first',reason:'Provider dependency approot dist absent before test bodies ran'},{label:'unit-description23-after-runtime',reason:'Same dependency absent after failed build setup'},{label:'build-approot-provider-dependency',reason:'Existing script tsc command unavailable; no product fix'},{label:'build-approot-pinned-path',reason:'No executable tsc shim; direct existing pinned TS invocation later succeeded'},{label:'unit-description23-ready',reason:'5 pass/1 fail: overbroad archived=null test expectation. Existing valid-reference archive policy retained and positive boundary added; original failure preserved'}],
  compatibility:'New validator accepts old absent-key requests without injecting null. New generator adds nullable currentAreaDescription; old strict server rejects that key. Same client/server bundle required; project/return/API schema constants unchanged.',
  limits:['No local server/browser, real AI, paid call, remote write, commit or push','Node24 supplementary only; Node22 CI and independent PC UI not run here','7/30 evidence is synthetic exact-payload transport proof, not AI semantic conflict resolution','Archived valid-description reading follows existing areaDescription.valid; no reactivation or new execution permission','Provider strict validation checks structural provenance; external source IDs/origin/text are not authenticated truth','Existing seven-day work and reports intentionally remain; no new automatic stale/delete/copy-block policy'],
  focusedRegression:'90/90 domain + understanding17 + hierarchy18 + ai055; new description23 6/6; check/build 0; before-after probe 0'};
writeFileSync(path.join(here,'FINAL_RECEIPT.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({head,files:hashes,patchSHA256:receipt.patchSHA256,diffCheckExit:0,guideByteIdentical:true,unchangedUI:ui,execution:execution.map(x=>({raw:x.raw,status:x.status}))},null,2));
