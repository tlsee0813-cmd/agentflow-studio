// Read-only f7b25 domain probe. All scenario text/advice is explicitly synthetic.
// Public domain APIs only; no server/browser/provider, storage injection or product edits.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import * as D from '../product21-author/app/continuity/dist/public/shared/domain.js';
import {mockAdvice} from '../product21-author/app/continuity/dist/public/shared/mock.js';
import {parseProject} from '../product21-author/app/continuity/dist/public/shared/validation.js';

const here=new URL('./',import.meta.url),author=new URL('../product21-author/app/',import.meta.url);
const require=createRequire(import.meta.url),ts=require(fileURLToPath(new URL('node_modules/typescript/lib/typescript.js',author)));
const sha=b=>createHash('sha256').update(b).digest('hex').toUpperCase();
const blob=b=>createHash('sha1').update(Buffer.from(`blob ${b.length}\0`)).update(b).digest('hex');
// Git blob identities returned by GitHub fetch_file at exact f7b25, not branch-name assumptions.
const expected={domain:'3a413f1da04eff073449534000cc4b0d3a567ba5',types:'62a75bf2cd80bd1ae31ca1eb1ccbeccd4ed77dec',validation:'bc757a30e23878e6a4352ef6aa11dd44a3d7b0fa','plan-facts':'6766c24cae83a8b68417c06e61c3df95fb373f18',hierarchy:'3548ad1f1b6ab44742daad2ca0f5ea4a0354d6cd',outcome:'4d64d4ad7213b7aaff2adc9dfd9859835a961574',mock:'fede7bb924608c1a73eb5c97db63001b0ff12906'};
const provenance=Object.entries(expected).map(([name,expectedBlob])=>{
  const source=readFileSync(new URL(`continuity/src/shared/${name}.ts`,author)),dist=readFileSync(new URL(`continuity/dist/public/shared/${name}.js`,author));
  assert.equal(blob(source),expectedBlob,`${name} exact f7b25 source`);
  const matches=[ts.NewLineKind.LineFeed,ts.NewLineKind.CarriageReturnLineFeed].filter(newLine=>{
    const emitted=ts.transpileModule(source.toString('utf8'),{fileName:`${name}.ts`,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,newLine}}).outputText;
    return Buffer.from(emitted).equals(dist);
  });assert.ok(matches.length,`${name} in-memory TS output equals imported dist bytes`);
  return {path:`app/continuity/src/shared/${name}.ts`,gitBlob:expectedBlob,sourceSHA256:sha(source),distSHA256:sha(dist),inMemoryTranspileEqualsDist:true,newLine:matches[0]===ts.NewLineKind.LineFeed?'LF':'CRLF'};
});
const inputs={
 brief:'[합성] 문서 보관 안내를 정리하는 한 부분. 보관기간 자체를 여기서 새 정책으로 결정하지 않는다.',
 note:'[합성] 문서 보관 안내의 현재 자료를 확인한다. 이 구상은 설명 정정 전후 그대로다.',
 firstRequest:'[합성] 현재 문서 보관 안내를 정리해줘. 확인한 자료와 미확인 부분을 구분해줘.',
 report:'[합성 외부 보고 · 검증 아님] SYNTH_REPORT_7_DAYS: 안내문에 보관기간이 7일로 적혀 있다고 보고했다.',
 externalDescription:'[합성 외부 설명] SYNTH_EXTERNAL_7_DAYS: 현재 안내문 표시는 보관기간 7일이다.',
 oldAIWork:{understanding:'[합성 응답 주입] 보고된 안내문 표시는 7일이라는 이해다.',scope:'[합성 응답 주입] 문서 보관 안내문만 다룬다.',next:'[합성 응답 주입] SYNTH_OLD_NEXT_7_DAYS: 안내문의 보관기간 7일 표기를 유지해 문구를 정리하라.',checks:'[합성 응답 주입] 보관기간이 7일로 표시되는지 확인하라.'},
 correction:'[합성 사용자 설명 정정] SYNTH_CORRECTED_30_DAYS: 현재 안내문 표시는 보관기간 30일이다. 앞선 설명의 7일은 잘못 적혔다.',
 nextRequest:'[합성 새 요청] 같은 부분의 현재 자료에 맞춰 안내 문구를 확인해줘.'
};
let p=D.setBrief(D.createProject(),inputs.brief);p=D.addArea(p,'문서 보관 안내 · 합성',inputs.note);
const area=p.space.areas[0].id;p=D.submit(D.editDraft(p,inputs.firstRequest),undefined,area);const A=p.currentTaskId;
let started=D.begin(p);p=D.receive(started.project,started.request,{mode:'mock',ticket:started.request.ticket,advice:mockAdvice(started.request)});
const H='H_SYNTH_DESCRIPTION_CORRECTION_PROBE',anchor=D.exportAnchor(p,D.taskOf(p,A)),initialText=D.handoffText(p,A,H);
p=D.markHandoff(p,A,initialText,'clipboard',p.revision,H,anchor); // Domain export simulation, not an actual OS copy.
const file={schemaVersion:'agentflow.return.2',projectId:p.id,taskId:A,returnId:H,report:inputs.report,evidence:null,
 understanding:{version:'understanding.1',areaId:area,basedOn:anchor.understanding,summary:inputs.externalDescription,changes:[],proposal:null,origin:'합성 API 경계 probe. 실제 자료/외부 AI/실행 증거 아님.'}};
p=D.importResultFile(p,JSON.stringify(file));const R=p.currentTaskId;
assert.equal(D.areaDescription(p,area).current?.summary,inputs.externalDescription);
// Explicit synthetic older response: construct a possible stored four-value instruction without claiming a real model generated it.
started=D.begin(p,A);const advice={...mockAdvice(started.request),...inputs.oldAIWork};
p=D.receive(started.project,started.request,{mode:'mock',ticket:started.request.ticket,advice});
assert.deepEqual(D.currentWork(p,D.taskOf(p,A)).values,inputs.oldAIWork);
const before=structuredClone(p),oldWork=D.currentWork(p,D.taskOf(p,A)),oldRequest=D.begin(p,A).request;
p=D.correctUnderstanding(p,area,inputs.correction);
const description=D.areaDescription(p,area),newWork=D.currentWork(p,D.taskOf(p,A)),newRequest=D.begin(p,A).request;
const withoutTicket=({ticket,...rest})=>rest;
assert.equal(description.current.entry.by,'user');assert.equal(description.current.valid,true);assert.equal(description.current.entry.revision,2);
assert.deepEqual(p.sources,before.sources);assert.deepEqual(p.bases,before.bases);assert.deepEqual(p.tasks,before.tasks);assert.deepEqual(p.space.areas,before.space.areas);
assert.deepEqual(newWork,oldWork);assert.equal(newWork.aiStale,false);
assert.deepEqual(withoutTicket(newRequest),withoutTicket(oldRequest));
const correctedMarker='SYNTH_CORRECTED_30_DAYS',oldMarker='SYNTH_OLD_NEXT_7_DAYS';
assert.equal(JSON.stringify(newRequest).includes(correctedMarker),false);
const handoffA=D.handoffText(p,A),currentSection=handoffA.split('\n## 이번 작업')[1]?.split('\n## ')[0]??'';
assert.ok(handoffA.includes(correctedMarker));assert.ok(currentSection.includes(oldMarker));
assert.ok(handoffA.includes('사용자가 설명 r1을 직접 고친 값'));
p=D.markHandoff(p,A,handoffA,'clipboard');const simulatedCopyRecord=D.taskOf(p,A).handoffs.at(-1);
assert.equal(simulatedCopyRecord.work.next,inputs.oldAIWork.next);
p=D.submit(D.editDraft(p,inputs.nextRequest),undefined,area);const C=p.currentTaskId,requestC=D.begin(p,C).request,handoffC=D.handoffText(p,C);
assert.equal(requestC.previousWork?.taskId,A);assert.equal(requestC.previousWork?.next,inputs.oldAIWork.next);
assert.equal(JSON.stringify(requestC).includes(correctedMarker),false);assert.ok(handoffC.includes(correctedMarker));
assert.equal(D.areaDescription(p,area).current.valid,true);assert.equal(D.taskOf(p,R).resultFile.rawText,JSON.stringify(file));
const round=parseProject(JSON.stringify(p));assert.deepEqual(D.currentWork(round,D.taskOf(round,A)),newWork);assert.equal(D.areaDescription(round,area).current.summary,inputs.correction);
// No product source/dist writes occurred; byte identities remain unchanged after all API calls.
for(const item of provenance){const local=readFileSync(new URL(item.path.slice(4),author));assert.equal(sha(local),item.sourceSHA256);}
const observed={
 byUserRevision:description.current.entry.revision,currentDescriptionValid:description.current.valid,
 correctionChangesTasksSourcesBasesOrAreaIdea:false,oldFourValuesUnchanged:true,oldAIStaleAfterCorrection:newWork.aiStale,
 sameTaskRegenerationPayloadEqualExceptTicket:true,correctionMarkerInSameTaskRequest:false,
 newRequestParentTaskId:D.taskOf(p,C).parentTaskId,newRequestPreviousWorkStillOld7DayInstruction:requestC.previousWork?.next===inputs.oldAIWork.next,
 correctionMarkerInNewRequest:false,correctionMarkerInExistingTaskHandoff:true,old7DayInstructionInCurrentWorkSection:true,
 correctionAttributedAsUserEditedReference:true,correctionMarkerInNewTaskHandoff:true,
 originalReportRetained:true,originalReturnRawRetained:true,roundtripPreservesCurrentDescriptionAndOldWork:true
};
const result={basis:'f7b25a586dca42466f07c7db2bedb9c59703deda',node:process.version,typescript:ts.version,provenance,
 scenario:'Fully synthetic one-part in-memory API probe; return.2 pattern matches existing understanding17-fixtures sample. Old model-like work explicitly injected through validated receive(mode:mock), not actual AI output.',
 inputs,ids:{project:p.id,area,A,R,C,H},observed,
 factualConflict:'A valid user-edited current description says30days while the same existing task handoff still contains the explicit synthetic7day instruction in its current-work section. The old report itself remaining is not counted as an error.',
 contractLimit:'Description is attributed reference, not an automatically adopted user decision/instruction. This reproduces simultaneous incompatible text and a transport/freshness boundary, not a settled policy violation. No automatic meaning/conflict detection claimed.',
 aiQuality:'No provider or real semantic regeneration was run. Whether an AI would produce/follow/correct the synthetic7day instruction is unverified. New request body carries only what the public domain buildRequest actually constructs.',
 sourceFacts:{beforeTicket:oldRequest.ticket,afterTicket:newRequest.ticket,sameTaskRequestAfterCorrection:newRequest,newRequest:requestC,
  beforeWork:oldWork,afterWork:newWork,currentDescription:description.current,oldExternalDescription:description.previous[0],simulatedCopyRecord},
 scope:'No source/test/dist edits, server/browser, external execution, clipboard call, remote writes or adopted follow-up-cycle contract.'};
writeFileSync(new URL('probe-evidence.json',here),JSON.stringify(result,null,2)+'\n');
writeFileSync(new URL('existing-A-handoff.txt',here),handoffA);writeFileSync(new URL('new-C-handoff.txt',here),handoffC);
console.log(JSON.stringify({basis:result.basis,node:process.version,typescript:ts.version,observed,scenario:result.scenario,limits:[result.contractLimit,result.aiQuality]},null,2));
