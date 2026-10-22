// Independent narrow negative boundary; no server or product writes.
import assert from 'node:assert/strict';
import * as D from '../product18-author/app/continuity/dist/public/shared/domain.js';
import {subtreeSignals} from '../product18-author/app/continuity/dist/public/shared/attention.js';
import {mockAdvice} from '../product18-author/app/continuity/server/mock.mjs';
let p=D.addArea(D.createProject(),'Area','Synthetic boundary');
const area=p.space.areas[0].id;
p=D.submit(D.editDraft(D.setKind(p,'test_answer'),'Synthetic test answer'),undefined,area);
const started=D.begin(p),advice=mockAdvice(started.request);
advice.question={kind:'fact',text:'Synthetic test-only question?',why:'Not a real requirement',options:[]};
p=D.receive(started.project,started.request,{mode:'mock',ticket:started.request.ticket,advice});
const status=D.taskStatus(p,D.taskOf(p)),questions=subtreeSignals(p,area).flatMap(s=>s.questions);
console.log(JSON.stringify({node:process.version,status,questions},null,2));
assert.equal(status,'시험 문맥 · 실제 요구 아님');
assert.equal(questions.length,0,'A test_answer task must not become an unmarked real question signal');
