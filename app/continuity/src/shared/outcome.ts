import { type Project, type Source, type Task } from './types.js';

/** The existing adjacent handoff/return group, shared by transport and the home.
 * Sibling report and evidence belong together; unrelated branches do not. */
export function contextLinks(p:Project,t:Task) {
  const parent=p.tasks.find(x=>x.id===t.parentTaskId);
  const firstKind=parent?p.sources.find(s=>s.id===parent.sourceIds[0])?.kind:null;
  const anchor=parent&&['report','evidence'].includes(firstKind??'')?p.tasks.find(x=>x.id===parent.parentTaskId):parent;
  const sourceKinds=new Map(p.sources.map(s=>[s.id,s.kind]));
  const returns=anchor?p.tasks.filter(x=>x.parentTaskId===anchor.id&&['report','evidence'].includes(sourceKinds.get(x.sourceIds[0]!)??'')):[];
  return {parent,anchor,returns};
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
  const latestRequest=[...p.sources].reverse().find(s=>s.kind==='request')??null;
  return {id:origin?.id??null,origin,originBases,request,path,reports,
    // A late return can select an older branch. Never call that branch the latest project direction.
    otherLatestRequest:latestRequest&&!pathIds.has(latestRequest.taskId)?latestRequest:null};
}
