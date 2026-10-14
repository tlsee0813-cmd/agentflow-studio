import { type Project, type Source, type Task } from './types.js';

/** The existing adjacent handoff/return group, shared by transport and the home.
 * Sibling report and evidence belong together; unrelated branches do not. */
export function contextLinks(p:Project,t:Task) {
  const parent=p.tasks.find(x=>x.id===t.parentTaskId);
  const firstKind=parent?p.sources.find(s=>s.id===parent.sourceIds[0])?.kind:null;
  const anchor=parent&&['report','evidence'].includes(firstKind??'')?p.tasks.find(x=>x.id===parent.parentTaskId):parent;
  const sourceKinds=new Map(p.sources.map(s=>[s.id,s.kind]));
  const isReturn=(x:Task)=>['report','evidence'].includes(sourceKinds.get(x.sourceIds[0]!)??'');
  // FIX088: a request only carries the returns that existed when it was written. A report that arrives later for
  // the earlier task belongs to that task, not to this request's context or export.
  const created=p.tasks.indexOf(t),own=isReturn(t);
  const returns=anchor?p.tasks.filter(x=>x.parentTaskId===anchor.id&&isReturn(x)&&(own||p.tasks.indexOf(x)<created)):[];
  return {parent,anchor,returns};
}

/** An explicit direction declaration is a navigation cue, not permission to rewrite
 * another basis or infer which clauses were revoked. Unrecognised prose stays visible
 * as a request. The home always leads with this task's request, never the root. */
export function declaresDirection(value:string):boolean {
  return /^(?:방향|목적|목표)(?:을|를)?\s*(?:바꿀게|바꾸겠습니다|변경할게|변경하겠습니다|수정할게|바꿔줘|변경해줘|수정해줘)\s*[:：]/u.test(value.trim());
}
/** A navigation projection of existing provenance, not an inferred/confirmed goal.
 * The first request's Source ID stays stable across returns and later requests.
 * No second current-value store, migration, semantic merge or execution status. */
export function outcomeOf(p:Project, id=p.currentTaskId) {
  const tasks=new Map(p.tasks.map(t=>[t.id,t])),sources=new Map(p.sources.map(s=>[s.id,s]));
  const path:Task[]=[],seen=new Set<string>();
  let task=id?tasks.get(id):undefined;
  while(task&&!seen.has(task.id)) {seen.add(task.id);path.push(task);task=task.parentTaskId?tasks.get(task.parentTaskId):undefined;}
  path.reverse();
  const requests=path.flatMap(t=>t.sourceIds.map(s=>sources.get(s)).filter((s):s is Source=>s?.kind==='request'));
  const origin=requests[0]??null,request=requests.at(-1)??null;
  // A root request may have been replaced; preserve its immutable identity and show
  // every matching current basis rather than silently choosing among imported values.
  const originBases=origin?p.bases.filter(b=>b.sourceId===origin.id||b.history.some(h=>h.sourceId===origin.id)):[];
  const pathIds=new Set(path.map(t=>t.id));
  const current=id?tasks.get(id):undefined;
  const returnIds=new Set(current?contextLinks(p,current).returns.map(t=>t.id):[]);
  const reports=p.sources.filter(s=>(pathIds.has(s.taskId)||returnIds.has(s.taskId))&&(s.kind==='report'||s.kind==='evidence'));
  const otherRequests=p.sources.filter(s=>s.kind==='request'&&!pathIds.has(s.taskId));
  const declared=[...requests].reverse().find(s=>declaresDirection(s.text))??null;
  // Other wording needs no magic command: keep the preceding request visible as
  // attributed context, without claiming it is a semantic purpose/change classification.
  const direction=declared??requests.at(-2)??null;
  const basisFor=(s:Source|null)=>{
    const matches=s?p.bases.filter(b=>b.sourceId===s.id||b.history.some(h=>h.sourceId===s.id)):[];
    return matches.length===1?matches[0]!:null; // Imported ambiguity is not a choice made by the app.
  };
  const requestBasis=basisFor(request),directionBasis=basisFor(direction);
  // The latest request the user wrote, when it is not on this path (e.g. after explicitly opening an older result).
  const latestRequest=p.sources.filter(s=>s.kind==='request').at(-1)??null;
  // Results received for other tasks after this path's request: discoverable, never merged into this flow.
  const shown=new Set(reports.map(s=>s.id)),since=request?p.sources.indexOf(request):-1;
  const elsewhere=p.sources.filter((s,i)=>i>since&&(s.kind==='report'||s.kind==='evidence')&&!shown.has(s.id)&&!pathIds.has(s.taskId));
  return {elsewhere,id:origin?.id??null,origin,originBases,request,requestBasis,direction,directionDeclared:declared!==null,directionBasis,path,reports,otherRequests,
    // A late return can select an older branch. Never call that branch the latest project direction.
    otherLatestRequest:latestRequest&&!pathIds.has(latestRequest.taskId)?latestRequest:null};
}
