import {received20Fixture} from '../app/continuity/tests/received20-fixtures.mjs';
import * as D from '../app/continuity/dist/public/shared/domain.js';
import {parseProject} from '../app/continuity/dist/public/shared/validation.js';
for(const cid of ['powertoys','product13'])for(const archived of [false,true]){
 const s=received20Fixture(cid,{archived}),p=D.importResultFile(s.p,s.raw),found=D.inspectResultFile(p,s.raw),q=D.importResultFile(p,JSON.stringify(s.variant));
 if(p.currentTaskId!==s.B||p.draft!==s.p.draft||!found.duplicate||D.importResultFile(p,s.raw)!==p||q.tasks.length!==p.tasks.length+1)throw Error('receipt identity/protection');
 if(JSON.stringify(parseProject(JSON.stringify(p)))!==JSON.stringify(p))throw Error('project roundtrip');
 const pasted=p.tasks.find(t=>t.id===s.pasted);if(pasted.resultFile!==null||cid==='product13'&&!pasted.handoffs.some(h=>h.returnId===s.H1))throw Error('no-snapshot precondition');
 console.log(JSON.stringify({cid,archived,currentB:true,draftRetained:true,duplicateT:found.duplicate.id,distinctRootAndExport:s.A!==s.exported,held:p.space.understanding[s.area]?.entries.at(-1)?.held??null,roundtrip:true}));
}
