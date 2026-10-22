// Independent narrow AREA18 probe. No server, storage writes, or product changes.
import assert from 'node:assert/strict';
import * as D from '../product18-author/app/continuity/dist/public/shared/domain.js';
import {subtreeSignals} from '../product18-author/app/continuity/dist/public/shared/attention.js';
import {mockAdvice} from '../product18-author/app/continuity/server/mock.mjs';

let p=D.createProject();
p=D.addArea(p,'Parent','Synthetic parent context');
const parent=p.space.areas.at(-1).id;
p=D.addChildArea(p,parent,'Child','Synthetic child context');
const child=p.space.areas.at(-1).id;
p=D.submit(D.editDraft(p,'Synthetic child request'),undefined,child);
const task=p.currentTaskId,started=D.begin(p),advice=mockAdvice(started.request);
advice.question={kind:'fact',text:'Synthetic unanswered question?',why:'Independent signal boundary',options:[]};
p=D.receive(started.project,started.request,{mode:'mock',ticket:started.request.ticket,advice});
const read=()=>({applicability:D.questionApplicability(p,D.taskOf(p,task)),questions:subtreeSignals(p,parent).flatMap(s=>s.questions).map(q=>({taskId:q.taskId,areaId:q.areaId,answered:q.answered}))});
const before=read();
p=D.markHandoff(p,task,D.handoffText(p,task),'clipboard');
const after=read();
console.log(JSON.stringify({node:process.version,before,after},null,2));
assert.equal(before.applicability,'active');
assert.equal(before.questions.length,1);
assert.equal(after.applicability,'active');
assert.equal(after.questions.length,1,'Export alone must not hide the unanswered child question from its parent');
assert.equal(after.questions[0].taskId,task);
assert.equal(after.questions[0].areaId,child);
