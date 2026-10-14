import { BASIS_LABEL, SOURCE_LABEL, FILE_LIMIT, RESULT_BYTES, type Basis, type Project, type Task, type Source, type Area, type RelationKind, type Point } from '../shared/types.js';
import { createProject, restore, returnTargets, editDraft, editAuxDraft, editBasisDraft, setKind, rename, submit, recordBasis, editTask, editSuggestion,
  currentIntent, previousIntent, correctIntent, intentCorrection, continuingIntent, answer, begin, receive, failed, cancel, taskOf, taskSuggestions, relatedBases, taskStatus, handoffText, markHandoff, currentWork, questionApplicability, staleText, inspectResultFile, importResultFile, focusTask,
  areaOf, isReturnTask, setBrief, setDraftTarget, areaPosition, moveArea, undoMove, NODE_W, NODE_H, addArea, editArea, setAreaArchived, addRelation, removeRelation, placeTask } from '../shared/domain.js';
import { parseProject, parseResultFile, validateRequest, validateAdvice } from '../shared/validation.js';
import { WorkspaceStore, serializeProject, storageErrorCode, type EntryRef, type WorkspaceEntry } from '../shared/storage.js';
import { mockAdvice } from '../shared/mock.js';
import { sourceName, sourceOf, taskTitle, shortText, dateLabel, basisDraftChanged, stageOf, exportNeedsRefresh, workOrigin, returnPreview, exportPreview, fitViewport, FIT_MIN, ZOOM_MIN, ZOOM_MAX } from './presentation.js';
import { loadConfig, requestAdvice, runtimeStorage, runtimeFailure, type RuntimeConfig } from './runtime.js';
import { outcomeOf } from '../shared/outcome.js';
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
function node<K extends keyof HTMLElementTagNameMap>(tag:K,content='',cls=''):HTMLElementTagNameMap[K] {
  const e=document.createElement(tag);e.textContent=content;if(cls)e.className=cls;return e;
}
function btn(label:string,act:()=>void,cls='quiet',id='') {const b=node('button',label,cls);b.type='button';if(id)b.id=id;b.addEventListener('click',()=>guard(act));return b;}
function tag(content:string,cls=''){return node('span',content,`tag ${cls}`);}
function details(title:string,id:string):HTMLDetailsElement {const d=node('details');d.id=id;d.append(node('summary',title));return d;}
let project:Project=createProject(),storageError='';
// FLOW083: what this tab edits. 'entry' = a saved project (with the lifecycle/seq this tab read), 'new' = not saved
// yet (created on its first change), 'legacy' = the pre-workspace value shown read-only, 'example' = never saved.
// The selection is per tab (sessionStorage); another tab choosing a different project never changes this one.
type Target={kind:'entry';ref:EntryRef}|{kind:'new'}|{kind:'legacy';error:string}|{kind:'example'};
let route:'project'|'projects'|'example'='project',target:Target={kind:'new'};
let listNotice='',undoEntry:string|null=null;
const OPEN_KEY='agentflow.workspace.open';
const session=(()=>{try{return runtimeStorage(window.sessionStorage);}catch{return null;}})();
function rememberOpen(id:string|null){try{session?.setItem(OPEN_KEY,id??'');}catch{/* Per-tab convenience only. */}
  document.documentElement.dataset.entryId=id??'';}
const locks=(()=>{try{return navigator.locks??null;}catch{return null;}})();
// Even reading window.localStorage can throw (SecurityError); every access then fails as STORAGE_DENIED.
const denied=():never=>{throw new Error('STORAGE_DENIED');};
const local=(()=>{try{return runtimeStorage(window.localStorage);}catch{return {getItem:denied,setItem:denied};}})();
const workspace=new WorkspaceStore(local,locks?{request:(name,callback)=>locks.request(name,callback as ()=>Promise<unknown>)}:null);
let config:RuntimeConfig|null=null;
let controller:AbortController|null=null;
// View preferences are ephemeral. They never enter the persisted project or request schema.
let view:'work'|'history'|'space'|'area'='work',contextOpen=false,hasSaved=false,memoryDirty=false;
// FLOW090: where this tab looks in the plan space, and which area the next request is written for. Per tab, never
// project data; looking around never changes currentTaskId (the work the user continues).
let viewArea:string|null=null;
// FLOW090-B1: map viewport and selection are this tab's view of one project; positions are project data.
type MapView={x:number;y:number;s:number};
let mapView:MapView|null=null,mapSelected:string|null=null,sheetOpen=false;
// One move = one command. Undo re-applies only that position, only while it is still where the move put it.
let posUndo:{id:string;from:Point|null;to:Point;at:number;key:boolean}[]=[];
const MAP_KEY='agentflow.workspace.map';
function rememberMap(){try{session?.setItem(MAP_KEY,JSON.stringify({project:project.id,view:mapView,selected:mapSelected}));}catch{/* Per-tab convenience only. */}}
function recallMap() {
  try {const v=JSON.parse(session?.getItem(MAP_KEY)||'null') as {project?:unknown;view?:MapView|null;selected?:unknown}|null;
    if(!v||v.project!==project.id)return;const w=v.view;
    mapView=w&&[w.x,w.y,w.s].every(n=>typeof n==='number'&&Number.isFinite(n))&&w.s>=FIT_MIN&&w.s<=ZOOM_MAX?w:null;
    mapSelected=typeof v.selected==='string'&&project.space.areas.some(a=>a.id===v.selected&&!a.archived)?v.selected:null;
  } catch {/* none */}
}
const spaceInputs:Record<string,string>={};
const PLACE_KEY='agentflow.workspace.place';
const hasSpace=(p:Project)=>!!p.space.brief||p.space.areas.length>0;
function rememberPlace(){try{session?.setItem(PLACE_KEY,JSON.stringify({entry:target.kind==='entry'?target.ref.entryId:'',view,area:viewArea}));}catch{/* Per-tab convenience only. */}}
function recallPlace(entryId:string) {
  try {
    const v=JSON.parse(session?.getItem(PLACE_KEY)||'null') as {entry?:unknown;view?:unknown;area?:unknown}|null;
    if(!v||v.entry!==entryId)return null;
    const areaOk=(id:unknown)=>typeof id==='string'&&(id==='unassigned'||project.space.areas.some(a=>a.id===id));
    const placed=['work','history','space','area'].includes(v.view as string)?v.view as typeof view:'work';
    return {view:placed==='area'&&!areaOk(v.area)?'space' as const:placed,area:areaOk(v.area)?v.area as string:null};
  } catch {return null;}
}
let selectedReturnTaskId:string|undefined;
// Local file reads/clipboard are not tickets or durable project data. Replacement invalidates both.
let projectEpoch=0,resultRead=0,recoveryRead=0,resultMessage='';
let resultSelection:{rawText:string;projectId:string;revision:number;epoch:number}|null=null;
let lastFileExport:{taskId:string;text:string}|null=null;
function returnChoiceRequired():boolean {
  return (project.draftKind==='report'||project.draftKind==='evidence')&&returnTargets(project).length>1&&
    !returnTargets(project).some(t=>t.id===selectedReturnTaskId);
}
function changeKind(kind:Project['draftKind']) {selectedReturnTaskId=undefined;commit(setKind(project,kind));}
let contextReturn:HTMLElement|null=null;
const unreadable='기존 저장 내용을 읽지 못했습니다. 덮어쓰지 않습니다. 이 화면의 입력은 메모리에 남으며 복구 파일로 저장할 수 있습니다.';
function resetEphemeral() {
  controller?.abort();controller=null;selectedReturnTaskId=undefined;projectEpoch++;resultRead++;recoveryRead++;
  resultSelection=null;resultMessage='';lastFileExport=null;view='work';viewArea=null;
  mapView=null;mapSelected=null;sheetOpen=false;posUndo=[];
  for(const k of Object.keys(spaceInputs))delete spaceInputs[k];
}
function openEntry(entry:WorkspaceEntry) {
  resetEphemeral();route='project';target={kind:'entry',ref:{entryId:entry.entryId,lifecycle:entry.lifecycle,seq:entry.seq}};
  // A just-migrated older value keeps its one-time conversion notice; otherwise the usual restore applies.
  project=entry.origin==='legacy'&&entry.seq===1?{...restore(entry.project),notice:entry.project.notice}:restore(entry.project);
  storageError=workspace.writable?'':storageMessages[workspace.readError??'LOCKS_UNAVAILABLE']!;memoryDirty=false;hasSaved=true;
  rememberOpen(entry.entryId);contextOpen=project.bases.some(b=>basisDraftChanged(project,b))||!!project.basisDraft.trim();
  // A reload keeps this tab's place; opening from the list starts at the space once the project has one.
  const place=recallPlace(entry.entryId);
  recallMap();
  if(place){view=place.view;viewArea=place.area;} else view=hasSpace(project)?'space':'work';
}
/** The pre-workspace value while it is not migrated: shown read-only, never written. */
function openLegacy() {
  const legacy=workspace.legacy;resetEphemeral();route='project';memoryDirty=false;hasSaved=!!legacy?.project;
  const error=legacy?.error??(workspace.writable?'LEGACY_READONLY':'LOCKS_UNAVAILABLE');target={kind:'legacy',error};
  project=legacy?.project?restore(legacy.project):createProject();
  storageError=legacy?.project?storageMessages[error]!:unreadable;rememberOpen('legacy');
  contextOpen=project.bases.some(b=>basisDraftChanged(project,b))||!!project.basisDraft.trim();
}
/** A new project lives in memory and is added to the workspace on its first change. */
function startNew() {resetEphemeral();route='project';target={kind:'new'};project=createProject();storageError=workspace.writable?'':storageMessages[workspace.readError??'LOCKS_UNAVAILABLE']!;memoryDirty=false;hasSaved=false;contextOpen=false;rememberOpen(null);}
function activeEntries(){return workspace.entries().filter(e=>e.state==='active');}
const storageMessages:Record<string,string>={
  STORAGE_BLOCKED:'기존 저장 내용을 읽지 못해 덮어쓰지 않고 있습니다. 이 탭의 입력은 메모리에 있습니다. 백업 파일을 저장한 뒤 ‘백업 파일 불러오기’로 새 사본을 만들면 그 사본은 자동 저장됩니다.',
  LEGACY_UNPRESERVED:'이전 형식 저장 내용의 원본을 브라우저에 따로 보관하지 못해 덮어쓰지 않도록 자동 저장을 멈췄습니다. 백업 파일을 저장한 뒤 ‘백업 파일 불러오기’로 새 사본을 만들면 그 사본은 자동 저장됩니다.',
  STORAGE_CONFLICT:'다른 탭에서 저장한 내용이 있어 덮어쓰지 않았습니다. 이 탭의 입력은 남아 있습니다. 닫기 전에 복구 파일을 저장하세요.',
  FILE_TOO_LARGE:'프로젝트가 자동 저장 한도를 넘었습니다. 입력은 이 탭에 남아 있습니다. 복구 파일을 저장하세요.',
  INVALID_DATA:'저장 형식 검사를 통과하지 못해 저장하지 않았습니다. 다시 열 수 없는 상태를 덮어쓰지 않았고, 입력은 이 탭에 남아 있습니다. 복구 파일을 저장하세요.',
  QUOTA:'브라우저 저장 공간이 부족해 자동 저장하지 못했습니다. 입력은 이 탭에 남아 있습니다. 복구 파일을 저장하세요.',
  WRITE_FAILED:'자동 저장하지 못했습니다. 저장 권한을 확인하세요. 입력은 이 탭에 남아 있습니다. 닫기 전에 복구 파일을 저장하세요.',
  TRASHED:'다른 탭에서 이 프로젝트를 휴지통으로 옮겼거나 휴지통에서 되살려, 이 탭이 연 뒤의 상태와 달라졌습니다. 이 탭의 변경은 저장하지 않았고 입력은 이 탭에 남아 있습니다. 백업 파일로 저장하거나 목록에서 다시 여세요.',
  ENTRY_MISSING:'저장할 프로젝트를 목록에서 찾지 못해 저장하지 않았습니다. 입력은 이 탭에 남아 있습니다. 백업 파일로 저장하세요.',
  STORAGE_DENIED:'브라우저가 이 페이지의 저장소 접근을 막아 기존 저장 내용을 읽지도 저장하지도 못했습니다. 비어 있는 것으로 보고 덮어쓰지 않았습니다. 입력은 이 탭에만 있으니 닫기 전에 백업 파일을 저장하세요.',
  LOCKS_UNAVAILABLE:'이 브라우저에서는 여러 탭이 동시에 저장하지 않도록 막는 기능(Web Locks)을 쓸 수 없어 저장하지 않았습니다. 기존 저장 내용은 읽을 수 있고, 입력은 이 탭에 남아 있습니다. 백업 파일로 저장하세요.',
  LEGACY_READONLY:'이전 형식으로 저장된 이 내용은 새 저장 형식으로 옮기지 않은 읽기 전용 자료라 저장하지 않았습니다. 백업 파일로 저장한 뒤 ‘백업 파일 불러오기’로 사본을 만들면 이어갈 수 있어요.'};
await workspace.init();
{
  let remembered:string|null=null;try{remembered=session?.getItem(OPEN_KEY)||null;}catch{/* No per-tab memory. */}
  const entry=activeEntries().find(e=>e.entryId===remembered);
  // A reload keeps its place; a new visit (tab/session) starts from the list, never straight in the editor.
  // Trashed or unreadable saves count: the list is the only way back to them.
  if(entry)openEntry(entry);
  else if(remembered==='legacy'&&workspace.legacy)openLegacy();
  else if(workspace.readError==='STORAGE_DENIED')startNew(); // nothing to list: keep working in memory, with the reason shown
  else if(workspace.entries().length||workspace.legacy||workspace.readError)route='projects';
  else startNew();
}
const saveMessage=(e:unknown)=>(e instanceof Error&&storageMessages[e.message])||storageMessages[storageErrorCode(e)]||storageMessages.WRITE_FAILED!;
let pendingSave=false,draining:Promise<void>|null=null;
function markSaving(){if(pendingSave||draining)document.documentElement.dataset.saving='1';else delete document.documentElement.dataset.saving;}
/** Queued, locked saves of the latest state. Only the target captured with a snapshot is written. */
function persist() {
  if(target.kind==='example')return; // The sample is never saved and never enters the project list.
  pendingSave=true;markSaving();
  draining??=drainSaves().finally(()=>{draining=null;markSaving();if(pendingSave)persist();else renderStatus();});
}
async function drainSaves() {
  while(pendingSave) {
    pendingSave=false;const snapshot=project,captured=target,epoch=projectEpoch;let error='';
    try {
      if(captured.kind==='new'){const ref=await workspace.create(snapshot,'new');if(target===captured){target={kind:'entry',ref};rememberOpen(ref.entryId);}}
      else if(captured.kind==='entry')captured.ref=await workspace.save(captured.ref,snapshot);
      else throw new Error(captured.kind==='legacy'?captured.error:'WRITE_FAILED');
    } catch(e) {error=saveMessage(e);}
    if(epoch===projectEpoch){storageError=error;if(error)memoryDirty=true;else if(!pendingSave){hasSaved=true;memoryDirty=false;}}
  }
}
async function flushSaves(){while(draining)await draining;}
/** Before leaving a project view: finish queued saves; never drop unsaved input silently. */
async function leaveProject(message:string):Promise<boolean> {
  await flushSaves();
  return !(route!=='projects'&&target.kind!=='example'&&memoryDirty)||confirm(`이 탭에 저장되지 않은 변경이 있어요. ${message} 이 변경은 사라질 수 있어요. 먼저 백업 파일을 저장하세요.\n그래도 이동할까요?`);
}
function commit(p:Project,redraw=true) {project=p;persist();if(redraw)render();else renderStatus();}
function guard(action:()=>void) {try{action();}catch{project={...project,notice:'입력 또는 자료를 처리하지 못했습니다. 기존 내용은 그대로 보존했습니다. 길이·형식을 확인하세요.'};renderStatus();}}
function entryLimits():string {
  const handoff='작업문을 복사·저장해도 개발 도구가 실행되지는 않아요.';
  if(!config)return `입력은 이 브라우저에만 저장돼요. ${handoff}`;
  return config.mode==='mock'?`AI 연결 없음 · 규칙으로 흉내 내는 체험판이에요. 입력은 이 브라우저에만 저장되고 다른 곳으로 보내지 않아요. ${handoff}`
    :`${config.label} · 입력은 이 브라우저에 저장되고, 정리를 요청할 때만 서버로 보내요. ${handoff}`;
}
function readyForAI():boolean {return !!config&&(route==='example'?config.mode==='mock':config.mode==='mock'||(config.configured&&config.paidEnabled&&$<HTMLInputElement>('consent').checked));}
function displayView() {
  const inProject=route!=='projects',starting=inProject&&!project.tasks.length;
  document.body.dataset.route=route;document.body.dataset.starting=String(starting);
  $('projects-view').hidden=inProject;$('breadcrumb-project').hidden=!inProject;$('breadcrumb-sep').hidden=!inProject;$('example-banner').hidden=route!=='example';
  for(const id of ['nav-work','nav-context','nav-history'])$(id).hidden=!inProject||starting;
  // With a plan space, the work view (and an unsent draft) stays reachable before the first task.
  if(inProject&&starting&&hasSpace(project)&&route!=='example')$('nav-work').hidden=false;
  for(const id of ['backup','import','trash-current','new-project-top'])$(id).hidden=route==='example';
  // An empty new project has nothing to back up yet; restoring a backup stays reachable from the first screen.
  $('new-project-top').hidden=route==='example'||starting;
  $('trash-current').hidden=target.kind!=='entry';
  $('nav-projects').classList.toggle('active',!inProject);
  if(!inProject)$('nav-projects').setAttribute('aria-current','page');else $('nav-projects').removeAttribute('aria-current');
  document.querySelector<HTMLElement>('.project-head')!.hidden=!inProject;document.querySelector<HTMLElement>('.feedback-stack')!.hidden=!inProject;
  $('work-view').hidden=!inProject||view!=='work';$('history-view').hidden=!inProject||view!=='history';
  const spatial=view==='space'||view==='area';$('space-view').hidden=!inProject||!spatial;
  $('nav-space').hidden=!inProject||route==='example'||(starting&&!hasSpace(project));
  $('nav-space').classList.toggle('active',inProject&&spatial);if(inProject&&spatial)$('nav-space').setAttribute('aria-current','page');else $('nav-space').removeAttribute('aria-current');
  $('nav-area-count').textContent=String(project.space.areas.filter(a=>!a.archived).length);
  if(route!=='projects')rememberPlace();
  $('context-panel').hidden=!contextOpen;$('workspace').classList.toggle('details-open',contextOpen);
  $('nav-context').setAttribute('aria-expanded',String(contextOpen));
  for(const [id,active] of [['nav-work',inProject&&view==='work'&&!contextOpen],['nav-context',inProject&&view==='work'&&contextOpen],['nav-history',inProject&&view==='history']] as const){
    $(id).classList.toggle('active',active);if(active)$(id).setAttribute('aria-current','page');else $(id).removeAttribute('aria-current');
  }
}
function showWork() {view='work';displayView();}
function openSpace() {view='space';viewArea=null;render();$('space-title')?.focus({preventScroll:true});window.scrollTo({top:0});}
function openArea(id:string) {view='area';viewArea=id;render();$('space-title')?.focus({preventScroll:true});window.scrollTo({top:0});}
/** Explicit: continue this task (or go back to it when its return is what is open). Viewing never does this. */
function continueTask(id:string) {
  if(project.pending)return;
  const current=project.currentTaskId?taskOf(project):null,same=current&&(current.id===id||isReturnTask(project,current)&&current.parentTaskId===id);
  if(!same)commit(focusTask(project,id));view='work';render();$('outcome-home').focus({preventScroll:true});$('outcome-home').scrollIntoView({block:'start'});
}
function writeInArea(id:string) {
  // An unsent report or request keeps its kind and target: open it instead of relabelling or moving it.
  if(project.draft.trim()) {
    const where=project.space.draftTarget?.area?areaById(project.space.draftTarget.area)?.name:null;
    const message=project.draftKind==='request'?`작성 중인 요청이 있어 먼저 열었어요. 이 요청의 영역(${where??'지금 작업을 따라감'})은 그대로예요. 다른 영역에 쓰려면 이 요청을 보내거나 비운 뒤 다시 누르세요.`
      :'작성 중인 결과가 있어 먼저 열었어요. 종류와 연결할 작업은 바꾸지 않았어요. 이 입력을 마친 뒤 새 요청을 쓰세요.';
    view='work';render();project={...project,notice:message};renderStatus();
  } else {
    let n=project;if(n.draftKind!=='request')n=setKind(n,'request');selectedReturnTaskId=undefined;commit(setDraftTarget(n,id));view='work';render();
  }
  $<HTMLDetailsElement>('compose-panel').open=true;$('draft').focus();
}
/** Explicit navigation to another task (a received result, or back to the latest request). */
function openTask(id:string) {
  if(project.pending)return;
  commit(focusTask(project,id));showWork();$('outcome-home').focus({preventScroll:true});$('outcome-home').scrollIntoView({block:'start'});
}
function openComposer(kind:Project['draftKind']='request') {
  showWork();
  // A return CTA must not silently relabel an unsent request as an implementer's report.
  if(project.draftKind!==kind){
    if(project.draft.trim()){project={...project,notice:'작성 중인 입력이 있어 먼저 열었습니다. 내용과 출처 구분은 바꾸지 않았습니다. 이 입력을 마친 뒤 결과를 붙여넣으세요.'};renderStatus();}
    else changeKind(kind);
  }
  $<HTMLDetailsElement>('compose-panel').open=true;$('draft').focus();
}
function showContext() {
  contextReturn=document.activeElement as HTMLElement|null;view='work';contextOpen=true;displayView();
  $('panel-title').focus({preventScroll:true});$('context-panel').scrollIntoView({block:'nearest'});
}
function closeContext() {contextOpen=false;displayView();(contextReturn??$('nav-context')).focus({preventScroll:true});}
function reportBody(source:Source):string {
  const file=project.tasks.find(t=>t.id===source.taskId)?.resultFile;
  if(file&&(source.kind==='report'||source.kind==='evidence'))return parseResultFile(file.rawText)[source.kind]??source.text;
  return source.text;
}
function renderStatus() {
  $('notice').textContent=project.notice??'';$('notice').hidden=!project.notice;
  $('storage-error').textContent=storageError;$('storage-error').hidden=!storageError;
  $('saved').textContent=route==='example'?'예제 · 저장하지 않음':pendingSave||draining?'저장 중…':hasSaved?'이 브라우저에 저장됨':'이 브라우저에 자동 저장';
  $('saved').title='이 브라우저 안의 자동 저장입니다. 다른 기기로 옮기거나 따로 보관하려면 백업 파일을 저장하세요.';
  if(storageError)$('saved').textContent='저장되지 않은 변경 있음';
  $('saved').classList.toggle('failed',!!storageError);
  const ready=readyForAI(),pending=!!project.pending;
  $<HTMLButtonElement>('send').disabled=!ready||pending||!project.draft.trim()||returnChoiceRequired();
  $<HTMLButtonElement>('save-input').hidden=ready;$<HTMLButtonElement>('save-input').disabled=pending||!project.draft.trim()||returnChoiceRequired();
  $('cancel').hidden=!pending;$('pending-bar').hidden=!pending;
  $('working').textContent=pending?'정리 응답을 기다리는 중 · 입력은 계속 수정할 수 있어요.':'';
  $('work').setAttribute('aria-busy',String(pending));
  for(const b of document.querySelectorAll<HTMLButtonElement>('[data-ai-action]'))b.disabled=pending||!ready;
  const answerable=project.currentTaskId!==null&&questionApplicability(project,taskOf(project))==='active';
  for(const b of document.querySelectorAll<HTMLButtonElement>('.option-button, #answer-unknown, #answer-defer'))b.disabled=pending||!answerable;
  if($('answer-send'))$<HTMLButtonElement>('answer-send').disabled=pending||!answerable||!project.answerDraft.trim();
  if($('answer-draft'))$<HTMLTextAreaElement>('answer-draft').readOnly=!answerable;
  $('compose-draft-status').textContent=project.draft.trim()?'작성 중인 입력 있음':'';
  $('basis-draft-status').textContent=project.basisDraft.trim()?'작성 중 · 기록 버튼을 누르면 기준에 반영됩니다.':'';
  for(const basis of project.bases){const marker=$(`draft-status-${basis.id}`);if(marker){marker.textContent=basisDraftChanged(project,basis)?'작성 중 · 현재 기준에는 아직 반영되지 않았어요.':'';marker.hidden=!basisDraftChanged(project,basis);}}
  if($('basis-form'))$<HTMLButtonElement>('basis-form').querySelector('button')!.disabled=!project.currentTaskId||!project.basisDraft.trim();
  document.title=route==='projects'?'내 프로젝트 · AgentFlow Studio':`${route==='example'?'예제 · ':''}${project.name} · AgentFlow Studio`;
  $('sidebar-project').textContent=project.name;$('breadcrumb-project').textContent=project.name;
  const t=project.currentTaskId?taskOf(project):null,stage=stageOf(project,t);
  $('task-number').textContent=t?`현재 작업 ${String(project.tasks.indexOf(t)+1).padStart(2,'0')}`:'첫 작업';
  $('context-title').textContent=stage.title;$('context-sub').textContent=stage.next;$('stage-label').textContent=stage.label;
  $('stage-label').dataset.stage=stage.kind;
  const report=outcomeOf(project).reports.at(-1);
  $('last-result').hidden=!report;
  if(report){const reportTask=project.tasks.find(x=>x.id===report.taskId),parent=project.tasks.findIndex(x=>x.id===reportTask?.parentTaskId);
    $('last-result-summary').textContent=`최근 가져온 결과 · ${dateLabel(report.at)}${parent>=0?` · 작업 ${parent+1}에 연결`:''} · 앱 미검증`;
    $('last-result-text').textContent=reportBody(report);}
  $('sidebar-task').textContent=t?`작업 ${project.tasks.indexOf(t)+1} · ${taskTitle(project,t)}`:'첫 작업을 기다리고 있어요.';
  $('entry-limits').textContent=entryLimits();
  // Backup is offered as soon as there is anything to keep, including input that could not be saved.
  $('backup').hidden=route==='example'||(!project.tasks.length&&!project.draft.trim()&&!memoryDirty);
  if($('handoff-ready'))$('handoff-ready').hidden=stage.kind!=='exported';
  if($('bring-report'))$('bring-report').textContent=project.draft.trim()?'작성 중인 입력 이어쓰기':'결과 붙여넣기';
  if($('copy-work')){const copy=$<HTMLButtonElement>('copy-work');copy.className=stage.kind==='exported'||stage.kind==='question'?'secondary':'primary';copy.textContent=t&&exportNeedsRefresh(project,t)?'수정한 작업문 복사':'작업문 복사';}
}
function renderOutcome(t:Task|null) {
  const area=$('outcome-home');area.replaceChildren();area.hidden=!t;if(!t)return;
  const flow=outcomeOf(project,t.id);area.dataset.outcomeId=flow.id??'';
  const top=node('div','','outcome-heading'),title=node('div');
  title.append(node('p','PROJECT OUTCOME','eyebrow'),node('h2','지금 이어갈 작업'));
  const primary=btn(questionApplicability(project,t)==='active'?'필요한 선택 보기':'현재 작업문 보기',()=>{$('current-work').focus({preventScroll:true});$('current-work').scrollIntoView({block:'start'});},'secondary','home-work');
  const topActions=node('div','','outcome-actions');topActions.append(primary,btn('방향 수정 / 다음 요청',()=>openComposer('request'),'secondary','change-direction'));
  top.append(title,topActions);area.append(top);
  // FIX088: received results and the user's latest request are shown, never merged into or swapped with this flow.
  const latest=flow.otherLatestRequest;
  if(latest) {
    const box=node('section','','outcome-direction');box.id='outcome-latest-request';
    box.append(node('h3','가장 최근에 쓴 요청 · 지금 화면 밖'),node('p',latest.text,'outcome-purpose outcome-excerpt'),
      node('p',`작업 ${project.tasks.findIndex(x=>x.id===latest.taskId)+1} · ${dateLabel(latest.at)} · 다른 결과를 열었다고 이 요청이 바뀌거나 끝나지 않았어요.`,'hint'),
      btn('그 요청으로 돌아가기',()=>openTask(latest.taskId),'secondary','resume-latest'));
    area.append(box);
  }
  if(flow.elsewhere.length) {
    const box=node('section','','outcome-return');box.id='outcome-elsewhere';
    box.append(node('h3',`다른 작업에 도착한 결과 ${flow.elsewhere.length}개`));
    for(const s of flow.elsewhere) {
      const rt=project.tasks.find(x=>x.id===s.taskId)!,entry=node('div','','outcome-record');
      entry.append(tag(sourceName[s.kind]),node('p',`${dateLabel(s.at)} · 작업 ${project.tasks.findIndex(x=>x.id===rt.parentTaskId)+1}에 연결 · 앱 미검증`,'hint'),
        node('div',reportBody(s),'source-raw outcome-excerpt'),btn('이 결과 열어 이어가기',()=>openTask(rt.id),'quiet'));
      box.append(entry);
    }
    box.append(node('p','지금 이어가던 요청과 범위에는 합치지 않았어요. 열면 그 작업을 이어가고, 지금 요청으로는 언제든 돌아올 수 있어요.','hint'));
    area.append(box);
  }
  const interpreted=currentIntent(project,t),correction=intentCorrection(t);
  if(interpreted||correction) {
    // A user correction stays visible after the AI interpretation behind it went stale; AI-only parts need a fresh interpretation.
    const value=correction?null:interpreted!.value,card=node('section','','outcome-direction');card.id='intent-home';
    card.append(node('h3',correction?'이어갈 목적 · 직접 정정':t.mode==='mock'?'이어갈 목적 · MOCK 정리':'이어갈 목적 · AI 정리'));
    const goal=node('p',correction?.goal??value!.goal,'outcome-purpose outcome-excerpt');goal.id='intent-goal';card.append(goal);
    const conditions=correction?correction.conditions:value!.conditions.join(' / ');
    if(conditions)card.append(node('p',conditions,'source-raw'));
    if(value?.relation==='uncertain')card.append(node('p','아직 정하지 않은 관계는 미정으로 남겨 두었어요.','hint'));
    const earlier=value?.relation==='separate'?continuingIntent(project,t):null;
    if(earlier){const line=node('p',`참고 · 앞선 목적 (이전 해석, 현재 유효 여부는 이번 요청이 우선): ${earlier.manualGoal??earlier.value.goal}`,'hint');line.id='intent-continuing';card.append(line);}
    if(value&&project.bases.some(b=>['confirmed','deferred','answered'].includes(b.status)))card.append(node('p','직접 확정·답변·보류한 기준은 이 정리보다 우선해요.','hint'));
    const detail=details('정리 바로잡기 · 근거 보기','intent-details');
    const g=node('textarea');g.rows=2;g.maxLength=6000;g.value=correction?.goal??value!.goal;g.id='intent-edit-goal';g.setAttribute('aria-label','이어갈 목적 직접 정정');
    const c=node('textarea');c.rows=2;c.maxLength=6000;c.value=conditions;c.id='intent-edit-conditions';c.setAttribute('aria-label','유지할 조건 직접 정정');
    detail.append(node('label','이어갈 목적'),g,node('label','유지할 조건'),c,btn('정정 적용',()=>commit(correctIntent(project,t.id,g.value,c.value)),'secondary','intent-correct'));
    const prior=previousIntent(project,t);
    if(prior)detail.append(btn('직전 정리로 되돌리기',()=>commit(correctIntent(project,t.id,prior.manualGoal??prior.value.goal,prior.manualConditions??prior.value.conditions.join(' / '))),'quiet','intent-undo'));
    if(value?.retired.length)detail.append(node('p',`대체된 이전 요청 표현 · ${t.mode==='mock'?'MOCK 정리':'AI 해석'} (사용자 결정은 대체하지 않음): `+value.retired.join(' / '),'source-raw'));
    if(interpreted)detail.append(node('p',interpreted.value.basisRefs.map(ref=>`${ref.basisId} · r${ref.revision} · ${ref.sourceId}`).join(' / '),'source-id'));
    card.append(detail);area.append(card);
  }
  const origin=flow.origin;
  const request=flow.request;
  if(request) {
    area.append(node('p',flow.requestBasis?.status==='confirmed'?'이번 요청 · 사용자 직접 정정':flow.requestBasis&&flow.requestBasis.text!==request.text?'이번 요청 · 기준의 현재 값':'이번 요청 · 사용자 원문','source-meta'));
    const purpose=node('p',flow.requestBasis?.text??request.text,'outcome-purpose outcome-excerpt');purpose.id='outcome-purpose';area.append(purpose);
    const direction=node('section','','outcome-direction');direction.id='outcome-direction';
    if(flow.direction&&flow.direction.id!==request.id) {
      direction.append(node('h3',`${flow.directionDeclared?'앞서 바꾼 방향':'직전 사용자 요청'} · ${flow.directionBasis?.status==='confirmed'?'직접 정정':flow.directionBasis&&flow.directionBasis.text!==flow.direction.text?'기준의 현재 값':'원문 참조'}`),node('p',flow.directionBasis?.text??flow.direction.text,'outcome-excerpt'));
    }
    area.append(direction);
    const basis=flow.directionBasis??flow.requestBasis;
    if(basis) {
      const correction=details(flow.directionBasis?(flow.directionDeclared?'이 방향 바로잡기':'직전 요청 바로잡기'):'이번 요청 바로잡기','outcome-correction');
      const field=node('textarea');field.id='outcome-correction-text';field.rows=3;field.maxLength=12000;
      field.setAttribute('aria-label','이어갈 내용 직접 정정');field.value=project.basisEdits[basis.id]??basis.text;
      field.addEventListener('input',()=>guard(()=>commit(editBasisDraft(project,basis.id,field.value),false)));
      correction.append(field,btn('정정한 내용 기록',()=>commit(recordBasis(project,field.value,'confirmed',basis.id)),'secondary','correct-outcome'));
      area.append(correction);
    }
  }
  if(origin) {
    const source=details('출발 · 방향 · 이번 요청 원문 보기','outcome-origin');
    const visibleSources=new Map([origin,flow.direction,request].filter((s):s is Source=>s!==null).map(s=>[s.id,s]));
    for(const input of visibleSources.values())source.append(node('div',input.text,'source-raw'),node('p',`${input.id} · ${dateLabel(input.at)}`,'source-id'));
    source.append(btn('전체 작업 기록 보기',()=>$('nav-history').click(),'quiet'));
    source.append(node('p','원문 이력입니다. 후속 발언이 바꾼 부분은 새 요청을 따르며, 연결만으로 같은 목적이나 코드 영향을 판단하지 않습니다.','hint'));area.append(source);
  }
  if(flow.otherRequests.length) {
    const other=details(`현재 경로 밖 요청 ${flow.otherRequests.length}개`,'outcome-other-request');
    for(const request of flow.otherRequests)other.append(node('div',request.text,'source-raw'),node('p',`작업 ${project.tasks.findIndex(t=>t.id===request.taskId)+1} · ${dateLabel(request.at)}`,'source-id'));
    other.append(node('p','연결 기록만으로 진행·완료 여부를 알 수 없습니다. 이 요청이나 보고를 현재 작업에 자동 합치지 않습니다.','hint'));area.append(other);
  }
  const grid=node('div','','outcome-grid');
  const conditions=details(`선택 · 이유와 보존 기준 ${project.bases.length}개`,'outcome-conditions');
  conditions.append(node('p','이전 요청은 후속 변경과 함께 읽는 참고입니다. 답변·직접 기록은 해당 범위에서 유지합니다.','hint'));
  for(const b of project.bases) {
    const s=project.sources.find(s=>s.id===b.sourceId),entry=node('div','','outcome-record');
    entry.append(tag(BASIS_LABEL[b.status]),node('p',b.text,'source-raw'));
    if(s?.replyTo)entry.append(node('p',`답한 질문: ${s.replyTo}`,'hint'));
    entry.append(node('p',`${b.id} · ${b.sourceId} · r${b.revision}`,'source-id'));conditions.append(entry);
  }
  conditions.append(btn('기준 · 출처 자세히 조정',showContext,'quiet'));grid.append(conditions);
  const lastReport=flow.reports.at(-1);
  if(lastReport) {
    const preview=node('section','','outcome-return');preview.id='outcome-last-report';
    preview.append(node('h3','돌아온 내용 · 외부 원문'),node('p',reportBody(lastReport),'outcome-excerpt'),node('p','전체 원문과 연결 정보는 아래 보고·자료에서 볼 수 있어요.','hint'));area.append(preview);
  }
  const results=details(`이 흐름에서 받은 보고 · 자료 ${flow.reports.length}개`,'outcome-results');
  results.append(node('p','외부에서 가져온 원문입니다. 보고자·방법·환경·버전은 원문에 기재된 범위만 알 수 있고 나머지는 미상입니다. 파일이나 로그가 실행을 보증하지는 않습니다.','hint'));
  for(const s of [...flow.reports].reverse()) {
    const rt=project.tasks.find(x=>x.id===s.taskId)!,entry=node('div','','outcome-record');
    const parentIndex=project.tasks.findIndex(x=>x.id===rt.parentTaskId);
    entry.append(tag(sourceName[s.kind]),node('p',`${dateLabel(s.at)} · ${parentIndex<0?'연결된 이전 작업 없음':`연결 작업 ${parentIndex+1}`}${rt.resultFile?` · 내보내기 ${rt.resultFile.returnId}`:' · 붙여넣기 / 내보내기 판본 미확인'}`,'hint'),node('div',reportBody(s),'source-raw'));results.append(entry);
  }
  if(!flow.reports.length)results.append(node('p','아직 이 작업 연결에서 받은 결과가 없습니다. 다른 작업의 보고는 작업 기록에서 볼 수 있어요.','hint'));
  grid.append(results);area.append(grid);
  const actions=node('div','','outcome-actions');
  actions.append(btn('결과 붙여넣기',()=>openComposer('report'),'quiet','home-paste-result'),btn('결과 JSON 가져오기',()=>{showWork();$<HTMLDetailsElement>('compose-panel').open=true;$<HTMLDetailsElement>('result-file-panel').open=true;$('select-result-file').click();},'quiet','home-file-result'));
  area.append(actions);
  const limits=details('이 흐름의 범위','outcome-limits');limits.append(node('p','목적 변경, 필요한 선택, 의미 있는 결과가 있을 때 돌아오세요. 명확한 작업은 개발 도구에서 이어갑니다. AI 초안은 사용자 결정이 아니며, 보고 수신은 실행·완료 판정이 아닙니다.','hint'));area.append(limits);
}
const errorMessages:Record<string,string>={
  INVALID_RESPONSE:'응답 형식이 올바르지 않아 적용하지 않았습니다.',AI_TIMEOUT:'정리 요청 시간이 초과됐습니다.',
  AI_NOT_CONFIGURED:'서버에 AI 연결이 설정되지 않았습니다.',PAID_CALLS_DISABLED:'서버에서 유료 호출을 허용하지 않았습니다.',
  PROCESS_CALL_CAP:'이 서버 프로세스의 요청 한도에 도달했습니다.',LOCAL_RATE_LIMIT:'요청 간격 제한에 도달했습니다.',
  AI_BUSY:'서버가 다른 요청을 처리 중입니다.',DUPLICATE_REQUEST:'이미 접수한 요청입니다. 자동으로 다시 보내지 않습니다.',
  AI_RATE_LIMIT:'제공업체의 요청 제한 응답입니다.',AI_AUTH_FAILED:'AI 인증이 거절됐습니다.',AI_BALANCE_REQUIRED:'제공업체 잔액 관련 오류입니다.',
  AI_CONFIG_REJECTED:'제공업체가 요청 설정을 거절했습니다.',INPUT_TOO_LARGE:'문맥이 요청 크기 한도를 넘었습니다. 자동으로 기준을 잘라 보내지 않았습니다. 작업문 복사·저장과 복구 파일은 계속 쓸 수 있습니다.'};
async function generate(id:string) {
  if(project.pending||(route==='example'&&config?.mode!=='mock'))return;
  if(!config||!(config.mode==='mock'||config.configured&&config.paidEnabled&&$<HTMLInputElement>('consent').checked)) {commit({...project,notice:'실제 AI 모드는 서버 설정과 프로젝트 문맥 전송 동의가 필요합니다.'});return;}
  let started;
  try {started=begin(project,id);} catch {commit({...project,notice:'AI 전송 문맥이 한도를 넘거나 유효하지 않아 보내지 않았습니다. 확정 기준을 잘라 보내지 않았습니다. 작업문 복사·Markdown 저장과 복구 파일은 계속 쓸 수 있습니다.'});return;}
  controller?.abort();const active=new AbortController();controller=active;commit(started.project);
  // Copies can share a project ID: a late answer is applied only to the same entry in the same activation.
  // projectEpoch changes on every real switch; a new project's first save (new -> entry) is not a switch.
  const ownerEntry=target.kind==='entry'?target.ref.entryId:null,activation=projectEpoch;
  const current=()=>projectEpoch===activation&&(ownerEntry===null||target.kind==='entry'&&target.ref.entryId===ownerEntry);
  $('pending-bar').scrollIntoView({block:'nearest'});
  try {
    const data=await requestAdvice(started.request,active.signal);
    if(data?.mode!==config.mode)throw new Error('INVALID_RESPONSE');
    if(!current())return;
    commit(receive(project,started.request,data));
  } catch(e) {
    if(!active.signal.aborted&&current()) {
      const code=e instanceof Error?e.message:'';
      commit(failed(project,started.request.ticket,`${errorMessages[code]??'요청이 실패했습니다.'} 입력은 보존했습니다. 필요한 경우 이 작업만 다시 정리하세요.`));
    }
  } finally {if(controller===active)controller=null;renderStatus();}
}
function download(filename:string,value:string,mime:string) {
  const blob=new Blob([value],{type:mime}),url=URL.createObjectURL(blob),link=node('a');link.href=url;link.download=filename;
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function safeName(value:string){return value.replace(/[^a-zA-Z0-9가-힣_-]/g,'_').slice(0,50)||'project';}
async function exportWork(id:string,method:'clipboard'|'download',fileMode=false) {
  let text:string;const exportRevision=project.revision,exportProjectId=project.id,epoch=projectEpoch;
  const returnId=fileMode?`H_${crypto.randomUUID()}`:null;
  try {text=handoffText(project,id,returnId);}catch {project={...project,notice:'작업 문맥 데이터가 유효하지 않아 내보내지 않았습니다. 복구 파일로 내용을 보존하세요.'};renderStatus();return;}
  if(method==='download'){download(`${safeName(project.name)}-${fileMode?'파일반환-':''}작업문.md`,text,'text/markdown;charset=utf-8');if(fileMode)lastFileExport={taskId:id,text};commit({...markHandoff(project,id,text,method,exportRevision,returnId),notice:'작업문을 Markdown 파일로 저장했어요. 그 파일을 개발 도구에 전달하는 건 직접 해 주세요. 전달·실행된 것은 아니에요.'});
    // Saves are asynchronous (locked): judge the save record only after it finished, for the same project view.
    await flushSaves();if(memoryDirty&&projectEpoch===epoch){project={...project,notice:'Markdown 파일은 저장했지만 저장 기록은 브라우저에 남기지 못했습니다. 닫기 전에 백업 파일을 저장하세요.'};renderStatus();}return;}
  try {await navigator.clipboard.writeText(text);
    if(project.id!==exportProjectId||project.revision!==exportRevision||projectEpoch!==epoch){project={...project,notice:'작업문은 복사됐지만 그 사이 입력이 바뀌었습니다. 현재 내용의 내보내기 기록으로 표시하지 않았습니다. 최신 작업문이 필요하면 다시 복사하세요.'};renderStatus();return;}
    if(fileMode)lastFileExport={taskId:id,text};
    commit(markHandoff(project,id,text,method,exportRevision,returnId));await flushSaves();if(projectEpoch!==epoch)return;project={...project,notice:memoryDirty?'작업문은 복사됐지만 내보내기 기록은 브라우저에 저장되지 않았습니다. 닫기 전에 JSON 백업을 저장하세요.':'작업문을 클립보드에 복사했습니다. 실행 도구에 직접 붙여넣으세요. 전송·실행된 것은 아닙니다.'};renderStatus();}
  catch {
    project={...project,notice:'클립보드를 사용할 수 없습니다. 아래 작업문을 직접 선택해 복사하거나 파일로 저장하세요.'};render();
    const d=$<HTMLDetailsElement>('handoff-preview');d.open=true;const field=$<HTMLTextAreaElement>('handoff-text');field.focus();field.select();
  }
}
function rawFileDetails(rawText:string,returnId:string,id:string):HTMLDetailsElement {
  const d=details('수신 JSON 원문 · 파일 저장',id),field=node('textarea');field.readOnly=true;field.rows=5;field.className='export-preview';field.value=rawText;field.setAttribute('aria-label','수신 JSON 원문');
  d.append(field,btn('원문 파일 저장',()=>download(`agentflow-return-${returnId}.json`,rawText,'application/json'),'quiet'));return d;
}
function resultError(e:unknown):string {
  const code=e instanceof Error?e.message:'';
  return code==='RESULT_TARGET_MISSING'?'이 프로젝트에서 정확히 일치하는 내보내기를 찾지 못했습니다. 최근 작업에 대신 연결하지 않았습니다.':
    code==='FILE_TOO_LARGE'?'이 결과를 포함하면 프로젝트 저장 한도(8MB)를 넘습니다. 기존 기록은 변경하지 않았습니다.':
    code==='RESULT_TOO_LARGE'?'결과 파일은 128 KiB 이하이어야 합니다. 원문을 잘라 저장하지 않았습니다.':
    '결과 파일의 형식·버전·본문 길이를 확인할 수 없어 가져오지 않았습니다.';
}
function renderResultFile() {
  $('result-file-message').textContent=resultMessage;
  const area=$('result-file-preview');area.replaceChildren();if(!resultSelection)return;
  try {
    const {file,task,record,duplicate}=inspectResultFile(project,resultSelection.rawText),preview=exportPreview(project,task,record);
    resultSelection.revision=project.revision;
    area.dataset.targetTaskId=task.id;area.dataset.returnId=record.returnId!;
    area.append(node('h3',`연결할 작업 · ${taskTitle(project,task)}`),node('p',`내보낸 시점 · ${dateLabel(record.at)} · 원래 버전 r${record.revision}`,'hint'));
    if(task.handoffs.at(-1)!==record)area.append(node('p','이전 내보내기에 대한 보고입니다. 더 최근 내보내기로 옮기지 않습니다.','alert warning'));
    const bases=details(preview.recordedBases===null?'기준 기록 비교 불가':`이후 기록된 기준 ${preview.recordedBases.length}개`,'file-return-bases');
    bases.append(node('p','이 결과에 적용되는지는 직접 확인하세요. 기준·수동값을 자동으로 바꾸지 않습니다.','hint'));
    for(const b of preview.recordedBases??[])bases.append(node('div',`${b.id} · ${BASIS_LABEL[b.status]}\n${b.text}`,'source-raw'));
    const work=details('당시 작업문 내용','file-return-work');for(const [key,value] of Object.entries(record.work!))if(value)work.append(node('div',`${key}: ${value}`,'source-raw'));
    area.append(bases,work,node('p','외부 보고 원문 · 앱 미검증','source-meta'),node('div',file.report,'source-raw'));
    if(file.evidence!==null)area.append(node('p','외부 관찰·검사 원문 · 앱 미검증','source-meta'),node('div',file.evidence,'source-raw'));
    area.append(node('p','파일은 실행 증명이 아닙니다. 가져와도 AI 정리·명령·링크를 실행하지 않습니다.','hint'));
    if(duplicate)area.append(node('p','같은 인계의 같은 본문이 이미 있습니다. 다시 추가하지 않습니다.','hint'));
    area.append(btn(duplicate?'기존 기록 확인':'이 결과 가져오기',()=>void acceptResultFile(),'primary','accept-result-file'));
    area.append(rawFileDetails(resultSelection.rawText,file.returnId,'result-file-raw'));
  } catch(e) {
    area.dataset.targetTaskId='';area.dataset.returnId='';area.append(node('p',resultError(e),'alert warning'));
    const raw=details('선택 파일 원문 보기','result-file-raw'),field=node('textarea');field.readOnly=true;field.rows=5;field.value=resultSelection.rawText;field.setAttribute('aria-label','선택 파일 원문');raw.append(field);area.append(raw);
  }
  area.append(btn('닫고 기존 붙여넣기 이용',()=>{resultRead++;resultSelection=null;resultMessage='작성 중인 입력은 그대로입니다. 기존 입력란에 필요한 보고를 붙여넣으세요.';renderResultFile();$('draft').focus();},'quiet','cancel-result-file'));
}
async function acceptResultFile() {
  if(!resultSelection)return;
  if(resultSelection.projectId!==project.id||resultSelection.epoch!==projectEpoch){resultSelection=null;renderResultFile();return;}
  if(resultSelection.revision!==project.revision){resultMessage='입력이 바뀌어 현재 기준으로 미리보기를 갱신했습니다. 확인한 뒤 가져오세요.';renderResultFile();return;}
  try {
    const n=importResultFile(project,resultSelection.rawText);
    if(n===project){resultMessage=memoryDirty?'같은 본문은 이미 이 탭에 있습니다. 브라우저에는 저장되지 않았습니다. JSON 백업으로 보존하세요.':'같은 본문의 기존 기록을 확인했습니다. 새 기록은 추가하지 않았습니다.';renderResultFile();return;}
    controller?.abort();controller=null;resultRead++;resultSelection=null;resultMessage='';
    commit(n);const epoch=projectEpoch;await flushSaves();if(epoch!==projectEpoch)return;resultMessage=memoryDirty?'결과는 이 탭에만 있습니다. 브라우저에 저장하지 못했습니다. 닫기 전에 JSON 백업을 저장하세요.':'보고를 가져왔습니다 · 앱 미검증. 작성 중인 입력은 그대로입니다.';
    renderResultFile();showWork();
  }catch(e){resultMessage=resultError(e)+' 기존 붙여넣기도 계속 이용할 수 있습니다.';renderResultFile();}
}
function basisCard(b:Basis,focus=false):HTMLElement {
  const box=node('div','','basis');box.dataset.basisId=b.id;
  box.append(node('span',b.id,'basis-id'),' ',tag(BASIS_LABEL[b.status],focus?'purple':''),node('p',b.text));
  if(project.currentTaskId && taskOf(project).advice?.reviewBasisIds.includes(b.id))box.append(tag('재검토 제안 · 현재 기준 유지','amber'));
  const d=details('직접 수정 · 출처 · 이전 값',`edit-${b.id}`),label=node('label','이 기준의 현재 문구');label.htmlFor=`text-${b.id}`;
  const input=node('textarea');input.id=`text-${b.id}`;input.rows=3;input.maxLength=12000;input.value=project.basisEdits[b.id]??b.text;
  input.addEventListener('input',()=>guard(()=>commit(editBasisDraft(project,b.id,input.value),false)));
  const row=node('div','','row');row.append(btn('수정 기록',()=>commit(recordBasis(project,input.value,'confirmed',b.id)),'secondary'),btn('이 기준 보류',()=>commit(recordBasis(project,input.value,'deferred',b.id))));
  const draftMarker=node('p','','basis-status');draftMarker.id=`draft-status-${b.id}`;
  const origin=project.sources.find(s=>s.id===b.sourceId);
  d.append(label,input,draftMarker,row);
  if(origin){const source=details('이 기준의 출처 원문',`origin-${b.id}`);source.append(tag(sourceName[origin.kind]),node('p',dateLabel(origin.at),'source-meta'),node('div',origin.text,'source-raw'),node('p',origin.id,'source-id'));d.append(source);}
  d.append(node('p','직접 기록한 값만 반영됩니다. ID와 이전 값은 남습니다.','hint'));
  if(b.history.length){const h=node('div');for(const item of [...b.history].reverse())h.append(node('p',`이전 r${item.revision} · ${BASIS_LABEL[item.status]}\n${item.text}`,'hint'));d.append(h);}
  box.append(d);return box;
}
function renderBases(t:Task|null) {
  $('basis-count').textContent=String(project.bases.length);$('nav-basis-count').textContent=String(project.bases.length);
  const related=t?relatedBases(project,t):[],ids=new Set(related.map(b=>b.id));
  $('related-bases').replaceChildren(...related.map(b=>basisCard(b,true)));
  if(!project.bases.length)$('related-bases').append(node('p','요청을 보내면 원문을 보존합니다. 짧은 결정은 직접 기록할 수도 있습니다.','hint'));
  $('basis-list').replaceChildren(...project.bases.filter(b=>!ids.has(b.id)).map(b=>basisCard(b)));
  $<HTMLDetailsElement>('all-bases').hidden=project.bases.length===related.length;
  $<HTMLTextAreaElement>('basis-draft').value=project.basisDraft;
  $<HTMLButtonElement>('basis-form').querySelector('button')!.disabled=!t;
}
function renderHistory() {
  $('history-count').textContent=String(project.tasks.length);$('nav-history-count').textContent=String(project.tasks.length);const list=$('history-list');list.replaceChildren();
  for(const [index,t] of [...project.tasks.entries()].reverse()) {
    // FLOW083: say what each entry is (my request / an imported result) and what it links to; a count is not a run.
    const first=sourceOf(project,t),kind=first?.kind,e=node('div','','history-item');e.dataset.kind=kind??'';
    const label=kind==='report'?'가져온 결과 · 구현 보고':kind==='evidence'?'가져온 결과 · 관찰·검사 자료':kind==='test_answer'?'시험 자료':'내 요청';
    e.append(node('strong',label),node('small',` #${index+1}`,'history-number'),tag(taskStatus(project,t)));
    e.append(node('p',taskTitle(project,t),'history-task-title'));if(first)e.append(node('small',dateLabel(first.at)));
    const parentIndex=project.tasks.findIndex(x=>x.id===t.parentTaskId);
    const links:string[]=[];
    if((kind==='report'||kind==='evidence')&&parentIndex>=0)links.push(`#${parentIndex+1} ‘${taskTitle(project,project.tasks[parentIndex]!)}’의 작업문에 대해 가져온 결과`);
    const exported=t.handoffs.length;
    links.push(exported?`작업문 ${t.handoffs.filter(h=>h.method==='clipboard').length}번 복사 · ${t.handoffs.filter(h=>h.method==='download').length}번 저장 · 마지막 ${dateLabel(t.handoffs.at(-1)!.at)}`:'작업문을 아직 복사·저장하지 않았어요');
    const replies=project.tasks.filter(x=>x.parentTaskId===t.id&&['report','evidence'].includes(sourceOf(project,x)?.kind??''));
    if(replies.length)links.push(`이후 가져온 결과 ${replies.length}개`);
    e.append(node('p',links.join(' · '),'hint history-links'));
    const d=details('입력 원문 · 내보낸 기록',`history-${t.id}`);
    if(t.resultFile)d.append(rawFileDetails(t.resultFile.rawText,t.resultFile.returnId,`result-raw-${t.id}`));
    for(const id of t.sourceIds){const s=project.sources.find(s=>s.id===id)!;d.append(node('p',SOURCE_LABEL[s.kind]),node('div',s.text,'source-raw'));}
    for(const h of t.handoffs){d.append(node('p',`${h.at} · ${h.method==='clipboard'?'복사':'파일 생성'} · 당시 기준 r${h.revision} · ${h.chars}자 · 식별 ${h.digest}${h.aiExcluded?' · 낡은 AI 문구 제외':''} (실행 여부 모름)`,'hint'));
      if(h.work)for(const [k,value] of Object.entries(h.work))if(value)d.append(node('div',`${k}: ${value}`,'source-raw'));
      if(h.legacyText){const old=details('이전 형식에서 보존한 내보낸 전문',`legacy-${t.id}-${h.digest}`);old.append(node('div',h.legacyText,'source-raw'));d.append(old);}}
    e.append(d);list.append(e);
  }
  if(!project.tasks.length)list.append(node('p','아직 남긴 요청이 없습니다. 첫 요청을 남기면 이곳에서 다시 볼 수 있어요.','hint'));
}
function renderWork(t:Task|null) {
  // FLOW083: the stage's actions live in the '지금 할 일' card; this card is the output and its editing.
  const area=$('work'),actions=$('next-actions');area.replaceChildren();actions.replaceChildren();$('empty').hidden=!!t;if(!t)return;
  const w=currentWork(project,t),v=w.values,card=node('div','','card work-card');card.id='current-work';card.tabIndex=-1;
  const local=project.sources.filter(s=>t.sourceIds.includes(s.id));
  const heading=node('div','','work-heading'),h=node('div');h.append(node('p',`TASK ${String(project.tasks.indexOf(t)+1).padStart(2,'0')}`,'eyebrow'),node('h2','이어갈 작업'));
  const origin=tag(workOrigin(t),'purple');origin.id='work-authorship';heading.append(h,origin);card.append(heading);
  const first=sourceOf(project,t),raw=details(first?sourceName[first.kind]:'입력 원문','current-source');raw.className='task-source';
  raw.querySelector('summary')!.append(node('span',taskTitle(project,t),'task-source-title'));
  for(const source of local){raw.append(tag(sourceName[source.kind]),node('p',dateLabel(source.at),'source-meta'));if(source.replyTo)raw.append(node('p',`앞선 질문: ${source.replyTo}`,'hint'));raw.append(node('div',source.text,'source-raw'),node('p',source.id,'source-id'));}
  card.append(raw);
  if(t.resultFile)raw.append(rawFileDetails(t.resultFile.rawText,t.resultFile.returnId,'current-result-raw'));
  const next= node('div','','handoff-ready');next.id='handoff-ready';
  const exported=t.handoffs.at(-1),nextText=node('div');nextText.append(node('strong','작업 결과를 받으셨나요?'),node('p',exported?`${dateLabel(exported.at)} · ${exported.method==='clipboard'?'복사':'파일 저장'} 기록이 있어요. 개발 도구에 전달됐는지, 실행됐는지는 이 앱이 알 수 없어요.`:'작업문을 전달한 도구에서 받은 내용을 그대로 가져오세요.'));
  next.append(nextText,btn('결과 붙여넣기',()=>openComposer('report'),'primary','bring-report'));actions.append(next);
  const summary=node('p',v.understanding||(w.aiExcluded?'이전 AI 정리는 제외하고 원문과 현재 기준을 보존했어요.':'원문은 보관했습니다. 정리 결과가 없어도 직접 작업문을 작성할 수 있어요.'),'work-summary');summary.id='work-summary';card.append(summary);
  const banner=node('p','','alert warning');banner.id='stale-advice';card.append(banner);showStaleNotice(banner,t,w);
  const scope=node('p',v.scope||'이번 범위는 아래에서 직접 작성할 수 있습니다.','work-scope');scope.id='scope-preview';card.append(scope);
  if(local.some(s=>s.kind==='test_answer'))card.append(node('p','합성 시험 입력입니다. 실제 사용자 요구나 기존 확정 기준을 바꾸지 않습니다.','alert warning'));
  const q=t.advice?.question;
  const applicability=questionApplicability(project,t);
  if(q&&applicability==='answered') {
    const box=node('div','','question-box');box.id='question-answered';box.append(tag('답변 기록됨','purple'),node('h3',q.text),node('p','답변은 저장됐습니다. 정리가 갱신되지 않았다면 ‘이 입력 다시 정리’로 이어가세요. 같은 답을 다시 기록하지 않습니다.','hint'));card.append(box);
  } else if(q) {
    const active=applicability==='active';
    const box=node('div','','question-box');box.id='question-box';box.append(tag(active?(q.kind==='fact'?'모르는 사실 확인':'중요한 제품 선택'):'이전 질문 · 참고 기록','amber'),node('h3',q.text),node('p',q.why,'hint'));
    if(!active)box.append(node('p',`${applicability==='unknown'?'시점 확인 불가':staleCause(w)} · 이 질문에는 답변을 적용하지 않습니다.`,'hint'));
    const answerAndSend=(value:string,disposition:Source['disposition']='provided')=>{if(project.pending||!value.trim()||questionApplicability(project,taskOf(project,t.id))!=='active')return;commit(answer(project,t.id,value,disposition));void generate(t.id);};
    for(const o of q.options){const b=btn(o.label,()=>answerAndSend(`${o.label} — ${o.consequence}`),'option-button');b.append(node('small',o.consequence));box.append(b);}
    const lab=node('label',active?'직접 답하거나 다른 방향을 적어 주세요.':'작성 중이던 답변 · 읽기 전용');lab.htmlFor='answer-draft';
    const input=node('textarea');input.id='answer-draft';input.rows=2;input.maxLength=12000;input.value=project.answerDraft;input.placeholder=active?(q.kind==='fact'?'알고 있는 관찰만 적어 주세요. 모르면 아래 버튼으로 확인 작업만 이어갑니다.':'선택지 밖의 답도 그대로 남깁니다.'):'';
    input.addEventListener('input',()=>guard(()=>commit(editAuxDraft(project,'answerDraft',input.value),false)));
    const row=node('div','','question-actions');row.append(btn('이 답으로 이어가기',()=>answerAndSend(input.value),'primary','answer-send'),btn('잘 모르겠음',()=>answerAndSend('지금은 모릅니다. 확인할 항목만 남겨 주세요.','unknown'),'quiet','answer-unknown'),btn('이 질문은 보류',()=>answerAndSend('이 질문은 지금 보류합니다. 관련 없는 명확한 범위만 진행해 주세요.','deferred'),'quiet','answer-defer'));
    box.append(lab,input,row);card.append(box);
  }
  const letter=node('section','','work-letter'),letterHead=node('div','','work-letter-heading');
  letterHead.append(node('span','전달할 작업문'));const author=tag(workAuthor(t,v.next));author.id='instruction-author';letterHead.append(author);
  const instruction=node('p',v.next||'원문과 현재 기준이 전체 인계 문맥에 포함됩니다. 구체적인 작업은 아래에서 직접 작성할 수 있어요.','work-instruction');instruction.id='instruction-preview';
  const checks=details('완료 조건 · 확인할 동작','checks-preview');checks.className='checks-preview';const checksText=node('p',v.checks||'아직 작성된 완료 조건이 없습니다.');checksText.id='checks-text';checks.append(checksText);
  letter.append(letterHead,instruction,checks);card.append(letter);
  const edit=details('범위 · 제안 · 작업문 직접 다듬기','edit-work');edit.className='edit-area';
  for(const [key,label] of [['understanding','짧은 이해'],['scope','이번 범위와 유지할 것'],['next','실행 도구에 전달할 작업문'],['checks','확인할 동작 / 완료 조건']] as const) {
    const l=node('label',label);l.htmlFor=`work-${key}`;const field=node('textarea');field.id=`work-${key}`;field.rows=key==='next'?4:2;field.maxLength=6000;field.value=v[key];
    field.addEventListener('input',()=>guard(()=>{commit(editTask(project,t.id,key,field.value),false);const marker=$(`manual-${key}`);marker.textContent='직접 수정 · AI가 덮어쓰지 않음';refreshPreview();}));
    const old=t.manual[key]===null&&w.aiStale?t.advice?.[key]??'':'';
    const marker=node('p',t.manual[key]!==null?'직접 수정 · AI가 덮어쓰지 않음':old?'이전 AI 문구는 작업문에서 제외됨 · 직접 쓰면 그대로 들어갑니다':'제안 · 실제 실행 결과 아님','manual-note');marker.id=`manual-${key}`;edit.append(l,field,marker);
    if(old){const d=details('제외된 이전 AI 문구 보기 (현재 작업문 아님)',`stale-${key}`);d.append(node('div',old,'source-raw'),btn('이 문구로 시작해 직접 고치기',()=>commit(editTask(project,t.id,key,old)),'quiet',`stale-use-${key}`));edit.append(d);}
  }
  const suggestions=taskSuggestions(t);
  for(const [index,s] of suggestions.entries()) {
    const box=node('div','','suggestion');box.append(tag(w.aiStale&&t.suggestions===null?'이전 제안 · 작업문 제외 · 고치면 포함':'추가 제안 · 미확정'));
    for(const key of ['text','why'] as const){const l=node('label',key==='text'?'제안 문구':'이유와 대가');const f=node('textarea');f.rows=2;f.maxLength=2000;f.id=`suggestion-${index}-${key}`;l.htmlFor=f.id;f.value=s[key];f.addEventListener('input',()=>guard(()=>{commit(editSuggestion(project,t.id,index,key,f.value),false);refreshPreview();}));box.append(l,f);}
    box.append(btn('이 제안을 내 기준으로 기록',()=>{const value=taskSuggestions(taskOf(project,t.id))[index];if(value)commit(recordBasis(project,value.text));},'secondary'));edit.append(box);
  }
  edit.append(node('p','이 영역을 고쳐도 다른 기준·원문은 변하지 않습니다. AI 재정리 후에도 직접 쓴 값은 유지됩니다.','hint'));
  const foot=node('div','','work-footer'),row=node('div','','actions');
  const retry=btn('이 입력 다시 정리',()=>{void generate(t.id);},'quiet','retry-work');retry.dataset.aiAction='true';
  row.append(btn('작업문 복사',()=>{void exportWork(t.id,'clipboard');},'primary','copy-work'),btn('Markdown 저장',()=>{void exportWork(t.id,'download');},'secondary','download-work'),retry,
    btn('전체 작업문 보기',()=>{const d=$<HTMLDetailsElement>('handoff-preview');d.open=true;d.scrollIntoView({block:'nearest'});$('handoff-text').focus({preventScroll:true});},'quiet','next-preview'),
    btn('＋ 새 요청',()=>openComposer('request'),'quiet','next-new-request'));
  if(questionApplicability(project,t)==='active')row.prepend(btn('질문에 답하기',()=>{$('question-box').scrollIntoView({block:'center'});$('answer-draft')?.focus({preventScroll:true});},'primary','next-answer'));
  actions.append(row);
  foot.append(node('p','작업문에 코드 파일은 포함되지 않습니다. 작업에 필요하다면 실행자가 대상 저장소나 관련 파일을 볼 수 있게 준비하세요. 복사·저장은 자동 실행이 아닙니다.'));card.append(foot,edit);
  const fileOptions=details('결과를 파일로 받기 · 선택','file-return-options');fileOptions.className='file-return-options';
  fileOptions.append(node('p','외부 도구에 결과 JSON 한 개 생성을 요청합니다. 짧은 보고나 웹 전용 작업은 기존 붙여넣기가 더 간단할 수 있어요.','hint'));
  const fileActions=node('div','','actions');fileActions.append(btn('파일 결과용 작업문 복사',()=>{void exportWork(t.id,'clipboard',true);},'secondary','copy-file-work'),btn('파일 결과용 Markdown 저장',()=>{void exportWork(t.id,'download',true);},'quiet','download-file-work'));fileOptions.append(fileActions);
  fileOptions.append(node('p','같은 작업에서 받은 결과 JSON은 ‘결과 파일로 가져오기’에서 선택하세요. 실행 권한은 늘어나지 않으며, 파일 생성 금지와 충돌하면 일반 보고로 반환합니다.','hint'));
  if(lastFileExport?.taskId===t.id){const sent=details('이 탭에서 마지막으로 내보낸 파일용 전문','file-handoff-preview'),field=node('textarea');field.readOnly=true;field.rows=8;field.className='export-preview';field.value=lastFileExport.text;sent.append(field);fileOptions.append(sent);}
  foot.append(fileOptions);
  const preview=details('실제로 전달할 전체 문맥 보기','handoff-preview');const txt=node('textarea');txt.id='handoff-text';txt.readOnly=true;txt.rows=14;txt.className='export-preview';
  try{txt.value=handoffText(project,t.id);}catch{txt.value='문맥 크기 또는 데이터 오류로 자동 인계를 만들지 못했습니다. 복구 파일로 원문을 보존하세요.';}
  preview.append(node('p','관련 입력 + 직전 작업 + 모든 보존 기준. AI가 관련으로 고르지 않은 기준도 뒤에 남습니다.','hint'),txt);card.append(preview);area.append(card);
}
type Work=ReturnType<typeof currentWork>;
function workAuthor(t:Task,next:string){return t.manual.next!==null?'사용자 직접 수정':!next?'직접 작성 가능':t.mode==='mock'?'모의 제안':t.mode==='deepseek'?'AI 제안':'직접 작성 가능';}
/** Why older AI text is withheld: a basis change, a purpose correction, or both — never only one when both hold. */
function staleCause(w:Work){const basis=w.changed==='unknown'||w.changed.length>0;return basis&&w.intentCorrected?'기준 변경·목적 정정 전':w.intentCorrected?'목적 정정 전':'기준 변경 전';}
/** Uses currentWork's derived state. AI text is said to be removed only when some was; user-written fields are said to stay,
 * because regeneration never overwrites them. No claim is made that a user field conflicts with the corrected purpose. */
function showStaleNotice(banner:HTMLElement,t:Task,w:Work){
  const basis=staleText(project,t),manual=w.manualFields.length>0;
  const cause=basis?(w.intentCorrected?`${basis} 목적 직접 정정도 그 AI 정리 뒤에 있었어요.`:basis):w.intentCorrected&&w.aiExcluded?'목적을 직접 정정하기 전에 만든 AI 문구는 작업문에서 뺐어요.':'';
  const target=basis&&w.intentCorrected?'바뀐 기준과 정정한 목적':basis?'현재 기준':'정정한 목적';
  const next=!basis&&!w.intentCorrected?'':manual?`직접 쓴 내용은 그대로예요. ${target}에 맞는지 직접 확인해 주세요. ‘이 입력 다시 정리’를 해도 직접 쓴 내용은 바뀌지 않아요.`
    :cause?'‘이 입력 다시 정리’로 새로 정리하거나 아래에서 직접 쓰세요.':'';
  banner.textContent=[cause,next].filter(Boolean).join(' ');banner.hidden=!banner.textContent;
  Object.assign(banner.dataset,{causes:[basis&&'basis',w.intentCorrected&&'intent'].filter(Boolean).join(' '),aiExcluded:String(w.aiExcluded),manual:manual?'kept':'none'});
}
function refreshPreview(){
  if(!project.currentTaskId||!$('handoff-text'))return;
  const t=taskOf(project),w=currentWork(project,t),v=w.values;
  try{$<HTMLTextAreaElement>('handoff-text').value=handoffText(project);}catch{/* Never truncate or erase a manual draft. */}
  for(const [id,value] of [['work-summary',v.understanding],['scope-preview',v.scope],['instruction-preview',v.next],['checks-text',v.checks]])if($(id!))$(id!).textContent=value||'직접 작성한 내용이 없습니다. 원문은 그대로 보존됩니다.';
  $('work-authorship').textContent=workOrigin(t);
  $('instruction-author').textContent=workAuthor(t,v.next);
  if($('stale-advice'))showStaleNotice($('stale-advice'),t,w);
}
function renderReturnPreview() {
  const area=$('return-preview');
  area.replaceChildren();area.hidden=project.draftKind!=='report'&&project.draftKind!=='evidence';
  area.dataset.targetTaskId='';
  if(area.hidden)return;
  const targets=returnTargets(project);
  if(targets.length>1) {
    const label=node('label','결과를 연결할 작업');label.htmlFor='return-task';
    const select=node('select');select.id='return-task';
    const placeholder=node('option','작업을 선택하세요');placeholder.value='';select.append(placeholder);
    for(const task of targets) {
      const option=node('option',`${project.tasks.indexOf(task)+1} · ${taskTitle(project,task)} · ${dateLabel(task.handoffs.at(-1)!.at)}`);
      option.value=task.id;select.append(option);
    }
    select.value=selectedReturnTaskId??'';
    select.addEventListener('change',()=>{selectedReturnTaskId=select.value||undefined;renderReturnPreview();renderStatus();$('return-task').focus();});
    area.append(label,select);
    if(returnChoiceRequired()) {area.append(node('p','내보낸 작업이 여러 개입니다. 이 결과의 작업을 선택하세요.','hint'));return;}
  }
  const preview=returnPreview(project,targets.length>1?selectedReturnTaskId:undefined);
  const multipleExports=(targets.find(t=>t.id===preview.targetTaskId)?.handoffs.length??0)>1;
  area.dataset.targetTaskId=preview.targetTaskId??'';
  const target=node('p',preview.targetTitle?`연결 예정 · ${preview.targetTitle}`:'연결할 이전 작업 없음','hint');target.id='return-target';area.append(target);
  const when=node('p',preview.exportedAt?`${multipleExports?'이 작업의 마지막 내보내기':'내보낸 시점'} · ${dateLabel(preview.exportedAt)}`:'내보낸 기록 없음','hint');when.id='return-export';area.append(when);
  if(multipleExports)area.append(node('p','붙여넣은 보고가 어느 내보내기에 대한 것인지는 미확인입니다. 결과 JSON이 있으면 아래에서 가져오세요.','hint'));
  if(preview.kind==='comparable') {
    const bases=preview.recordedBases!,list=details(`${multipleExports?'마지막 내보내기 이후':'이후'} 기록된 기준 ${bases.length}개`,'return-records');
    list.append(node('p','이 결과에 적용되는지는 직접 확인하세요.','hint'));
    list.append(node('p',`${preview.targetTaskId} · ${multipleExports?'마지막 내보낸 기준':'내보낸 기준'} r${preview.exportRevision}`,'source-id'));
    for(const basis of bases) {
      const item=node('div','','basis');
      item.append(node('p',`${basis.id} · ${BASIS_LABEL[basis.status]}`,'basis-status'),node('div',basis.text,'source-raw'));
      list.append(item);
    }
    area.append(list);
  } else {
    const unavailable=node('p','기준 기록 비교 불가','hint');unavailable.id='return-unavailable';area.append(unavailable);
  }
}
/** FLOW083 list projections: derived from each saved payload, never stored separately. */
function lastActivity(p:Project):string|null {
  const times=[...p.sources.map(s=>s.at),...p.tasks.flatMap(t=>t.handoffs.map(h=>h.at))].filter(at=>!Number.isNaN(new Date(at).getTime()));
  return times.sort().at(-1)??null;
}
function projectSummary(li:HTMLElement,info:Project) {
  const requests=info.sources.filter(s=>s.kind==='request'),results=info.sources.filter(s=>s.kind==='report'||s.kind==='evidence');
  const last=requests.at(-1),at=lastActivity(info);
  li.append(node('strong',info.name,'project-card-name'),
    node('p',last?`마지막 요청 · ${shortText(last.text,80)}`:info.draft.trim()?'아직 보낸 요청 없음 · 작성 중인 입력 있음':'아직 보낸 요청 없음','project-card-summary'),
    node('p',`${at?`최근 활동 · ${dateLabel(at)}`:'활동 기록 없음'} · ${info.space.areas.some(a=>!a.archived)?`영역 ${info.space.areas.filter(a=>!a.archived).length}개 · `:''}요청 ${requests.length}개 · 가져온 결과 ${results.length}개`,'hint'));
}
function projectCard(entry:WorkspaceEntry):HTMLElement {
  const li=node('li','','project-card');li.dataset.entryId=entry.entryId;projectSummary(li,entry.project);
  const row=node('div','','row');
  if(entry.state==='trashed') {li.querySelector('strong')!.append(' ',tag('휴지통'));row.append(btn('되살리기',()=>void restoreProject(entry.entryId),'secondary project-restore'));}
  else row.append(btn('이어서 하기',()=>{const fresh=workspace.read()?.entries.find(e=>e.entryId===entry.entryId&&e.state==='active');
      if(!fresh){listNotice='다른 탭에서 바뀌어 이 프로젝트를 열지 않았어요. 목록을 새로 읽었어요.';render();return;}
      openEntry(fresh);render();restoreDraftPanels();$('main').focus({preventScroll:true});},'primary project-open'),
    btn('휴지통으로',()=>void trashProject(entry.entryId,entry.project.name),'quiet project-trash'));
  li.append(row);return li;
}
function legacyCard():HTMLElement {
  const legacy=workspace.legacy!,li=node('li','','project-card');li.dataset.entryId='legacy';
  if(legacy.project){projectSummary(li,legacy.project);li.querySelector('strong')!.append(' ',tag('이전 저장 · 읽기 전용'));}
  else li.append(node('strong','읽지 못한 이전 저장 내용','project-card-name'));
  li.append(node('p','이전 형식으로 이 브라우저에 남아 있는 내용이에요. 지우거나 덮어쓰지 않았고, 새 저장 형식으로 옮기지 않아 여기서는 저장되지 않아요.','hint'));
  const row=node('div','','row');row.append(btn('열어 보기',()=>{openLegacy();render();restoreDraftPanels();},'secondary project-open'));li.append(row);return li;
}
function renderProjects() {
  workspace.read();const list=$('project-list'),trash=$('trash-list');list.replaceChildren();trash.replaceChildren();
  const entries=workspace.entries(),active=entries.filter(e=>e.state==='active'),trashed=entries.filter(e=>e.state==='trashed');
  for(const e of [...active].sort((a,b)=>(lastActivity(b.project)??'').localeCompare(lastActivity(a.project)??'')))list.append(projectCard(e));
  if(workspace.legacy)list.append(legacyCard());
  // An empty list and a list that could not be read are different situations.
  if(!active.length&&!workspace.legacy&&!workspace.readError)list.append(node('li','아직 프로젝트가 없어요. ‘새 프로젝트’로 바로 시작하거나 예제를 둘러보세요.','hint'));
  for(const e of trashed)trash.append(projectCard(e));
  $('trash-section').hidden=!trashed.length;$('trash-count').textContent=String(trashed.length);
  const problem=workspace.readError?'저장된 프로젝트 목록을 읽지 못해 덮어쓰지 않고 있어요. 기존 내용은 그대로이며, 새로 만들기·휴지통 이동은 멈췄어요. 백업 파일이 있다면 보관하세요.'
    :!workspace.writable?storageMessages.LOCKS_UNAVAILABLE!:'';
  const message=[problem,listNotice].filter(Boolean).join(' ');
  $('list-notice').hidden=!message;$('list-notice-text').textContent=message;$('undo-trash').hidden=undoEntry===null;
  $('new-project').toggleAttribute('disabled',!workspace.writable);$('list-import').toggleAttribute('disabled',!workspace.writable);
}
async function showProjects(message='') {
  if(!await leaveProject('목록으로 가면'))return;
  resetEphemeral();route='projects';listNotice=message;if(!message)undoEntry=null;rememberOpen(null);render();$('projects-title').focus();
}
/** Completes only after the envelope is written; the open project's queued saves are flushed first. */
async function trashProject(entryId:string,name:string) {
  if(!confirm(`‘${name}’을(를) 휴지통으로 옮길까요?\n원문·기준·요청·돌아온 결과가 모두 함께 옮겨지고, 휴지통에서 그대로 되살릴 수 있어요.\n개발 도구에서 이미 한 작업이 취소되지는 않아요.`))return;
  const current=target.kind==='entry'&&target.ref.entryId===entryId;
  if(current&&!await leaveProject('휴지통으로 옮기면'))return;
  try {await workspace.trash(entryId);}
  catch(e) {listNotice=`휴지통으로 옮기지 못했어요. 프로젝트는 그대로예요. ${saveMessage(e)}`;undoEntry=null;if(current){project={...project,notice:listNotice};renderStatus();}else render();return;}
  undoEntry=entryId;if(current)memoryDirty=false;
  resetEphemeral();route='projects';listNotice=`‘${name}’을(를) 휴지통으로 옮겼어요.`;rememberOpen(null);render();$('projects-title').focus();
}
async function restoreProject(entryId:string,undo=false) {
  try {await workspace.restoreEntry(entryId);listNotice=undo?'되돌렸어요. 프로젝트가 목록에 다시 있어요.':'되살렸어요. 내용은 휴지통에 넣기 전 그대로예요.';}
  catch(e) {listNotice=`되살리지 못했어요. 휴지통의 프로젝트는 그대로예요. ${saveMessage(e)}`;}
  undoEntry=null;render();
}
/** In-memory sample made with the normal domain path and the explicit MOCK rules; never persisted.
 * Starting my own project from it starts empty: nothing from the sample becomes my record or result. */
function exampleProject():Project {
  let p=rename(createProject(),'예제 · 동네 미용실 예약 사이트');
  p=submit(editDraft(p,'동네 미용실 예약 사이트를 만들고 싶어요. 손님이 휴대폰으로 날짜와 시간을 고르고, 예약하면 문자로 확인을 받게 해 주세요.'));
  const started=begin(p,p.currentTaskId!),request=validateRequest(started.request);
  return {...receive(started.project,started.request,{mode:'mock',ticket:request.ticket,advice:validateAdvice(mockAdvice(request),request.bases.map(b=>b.id))}),notice:null};
}
async function openExample() {
  if(!await leaveProject('예제로 가면'))return;
  resetEphemeral();route='example';target={kind:'example'};storageError='';memoryDirty=false;hasSaved=false;contextOpen=false;
  try {project=exampleProject();} catch {project=createProject();}
  rememberOpen(null);render();
}
function closeExample(start:boolean) {
  if(start||!(workspace.entries().length||workspace.legacy||workspace.readError)){startNew();render();restoreDraftPanels();$('draft').focus();}
  else void showProjects();
}
/* ---------- FLOW090: the plan space (whole space -> one area). Reads the project; edits only plan data. ---------- */
const RELATION_LABEL:Record<RelationKind,string>={flow:'이어서 사용',needs:'먼저 필요',shares:'같은 요구 공유',related:'관련'};
function areaById(id:string|null){return project.space.areas.find(a=>a.id===id)??null;}
/** Request tasks of an area (or unplaced ones), newest first. Returned reports are shown under their task. */
function areaRequests(id:string|null):Task[] {return [...project.tasks].reverse().filter(t=>!isReturnTask(project,t)&&(t.areaId??null)===id);}
function returnsOf(t:Task):Task[] {return project.tasks.filter(x=>x.parentTaskId===t.id&&isReturnTask(project,x));}
function currentGroup(t:Task):boolean {
  const c=project.currentTaskId?taskOf(project):null;return !!c&&(c.id===t.id||isReturnTask(project,c)&&c.parentTaskId===t.id);
}
/** Unsaved plan inputs survive a redraw, keyed by project and (for area edits) area, never by DOM id alone. */
function spaceInput<T extends HTMLInputElement|HTMLTextAreaElement>(el:T,id:string,initial='',key=id):T {
  const k=`${project.id}:${key}`;el.id=id;el.value=spaceInputs[k]??initial;el.addEventListener('input',()=>{spaceInputs[k]=el.value;});return el;
}
function clearInputs(...keys:string[]){for(const key of keys)delete spaceInputs[`${project.id}:${key}`];}
function areaSummary(a:Area):string {
  const tasks=areaRequests(a.id),results=tasks.flatMap(returnsOf).length;
  return tasks.length?`요청 ${tasks.length}개${results?` · 돌아온 결과 ${results}개 · 앱 미검증`:''}`:'아직 요청 없음';
}
const scaleLabel=(s:number)=>s>=0.01?`${Math.round(s*100)}%`:'<1%';
function applyView(plane:HTMLElement){if(mapView)plane.style.transform=`translate(${mapView.x}px,${mapView.y}px) scale(${mapView.s})`;}
/** Fit changes only the viewport; stored positions stay as they are. */
function fitView(map:HTMLElement,active:Area[]):MapView {
  // Measured card sizes (long names/notes make cards taller), in plane units.
  const boxes=active.map(a=>{const pt=areaPosition(project,a),el=map.querySelector<HTMLElement>(`.area-node[data-area-id="${a.id}"]`);
    return {x:pt.x,y:pt.y,w:el?.offsetWidth||NODE_W,h:el?.offsetHeight||NODE_H};});
  return fitViewport(map.clientWidth||800,map.clientHeight||480,boxes);
}
function zoom(map:HTMLElement,plane:HTMLElement,factor:number) {
  // Buttons stay within a comfortable range, but never force a smaller fitted scale back up to it.
  const v=mapView??{x:0,y:0,s:1},s=Math.max(Math.min(ZOOM_MIN,v.s),Math.min(ZOOM_MAX,v.s*factor)),cx=map.clientWidth/2,cy=map.clientHeight/2;
  mapView={x:cx-(cx-v.x)*(s/v.s),y:cy-(cy-v.y)*(s/v.s),s};applyView(plane);rememberMap();
  $('map-scale').textContent=scaleLabel(s);
}
function commitMove(id:string,to:Point,key:boolean) {
  const a=areaById(id)!,stored=project.space.layout.positions[id]??null,from=stored?{...stored}:null;
  if(from&&from.x===Math.round(to.x)&&from.y===Math.round(to.y))return;
  const next=moveArea(project,id,to),placed=next.space.layout.positions[id]!,top=posUndo.at(-1);
  // Consecutive arrow-key nudges of one area within a moment count as one move.
  if(key&&top&&top.key&&top.id===id&&Date.now()-top.at<1500){top.to={...placed};top.at=Date.now();}
  else posUndo.push({id,from:from??(stored===null?null:areaPosition(project,a)),to:{...placed},at:Date.now(),key});
  if(posUndo.length>50)posUndo.shift();
  commit(next);
}
function undoPosition() {
  const step=posUndo.pop();if(!step)return;const a=areaById(step.id);
  try {commit(undoMove(project,step.id,step.from,step.to));project={...project,notice:`‘${a?.name??'영역'}’의 위치를 되돌렸어요. 다른 내용은 바뀌지 않았어요.`};renderStatus();}
  catch {posUndo=[];project={...project,notice:'그 뒤 위치가 다시 바뀌어(다른 이동이나 다른 탭) 되돌리지 않았어요. 지금 위치를 그대로 두었어요.'};render();}
}
function areaNode(a:Area,plane:HTMLElement,redraw:()=>void):HTMLElement {
  const pt=areaPosition(project,a),el=node('div','','area-node');el.dataset.areaId=a.id;
  el.style.left=`${pt.x}px`;el.style.top=`${pt.y}px`;el.classList.toggle('selected',mapSelected===a.id);
  const handle=node('button','⠿','node-handle');handle.type='button';handle.id=`node-move-${a.id}`;
  handle.setAttribute('aria-label',`${a.name} 위치 이동 (끌기 또는 방향키)`);handle.title='끌어서 위치 이동 · 방향키로도 옮길 수 있어요';
  const pick=node('button','','node-select');pick.type='button';pick.id=`node-select-${a.id}`;pick.setAttribute('aria-pressed',String(mapSelected===a.id));
  pick.append(node('strong',a.name,'area-card-name'),a.note?node('span',a.note,'area-card-note'):tag('미정','area-undecided'),node('span',areaSummary(a),'hint'));
  if(areaRequests(a.id).some(currentGroup))pick.append(tag('지금 이어가는 작업','purple'));
  // Selecting shows the short properties; it never opens the area or changes the open work.
  pick.addEventListener('click',()=>{mapSelected=a.id;sheetOpen=true;rememberMap();render();$(`node-select-${a.id}`)?.focus({preventScroll:true});});
  const open=btn('영역 열기 ↗',()=>openArea(a.id),'secondary area-open');open.id=`node-open-${a.id}`;
  el.append(handle,pick,open);
  // Dragging uses only the handle; a drag never ends as a click on open/select.
  handle.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;e.preventDefault();e.stopPropagation();handle.setPointerCapture(e.pointerId);
    const s=mapView?.s??1,sx=e.clientX,sy=e.clientY,ox=pt.x,oy=pt.y;let moved=false,cur={x:ox,y:oy};
    const move=(ev:PointerEvent)=>{const dx=(ev.clientX-sx)/s,dy=(ev.clientY-sy)/s;if(Math.abs(dx)+Math.abs(dy)>3)moved=true;
      cur={x:Math.round(ox+dx),y:Math.round(oy+dy)};el.style.left=`${cur.x}px`;el.style.top=`${cur.y}px`;el.classList.add('dragging');redraw();};
    const up=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',up);handle.removeEventListener('pointercancel',up);
      el.classList.remove('dragging');if(moved)guard(()=>commitMove(a.id,cur,false));};
    handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',up);handle.addEventListener('pointercancel',up);
  });
  handle.addEventListener('keydown',e=>{
    const step=e.shiftKey?60:20,d={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]}[e.key];if(!d)return;
    e.preventDefault();const p0=areaPosition(project,a);guard(()=>commitMove(a.id,{x:p0.x+d[0]!,y:p0.y+d[1]!},true));$(`node-move-${a.id}`)?.focus({preventScroll:true});
  });
  return el;
}
const RELATION_HINT:Record<RelationKind,string>={flow:'이어서 사용(기능 흐름)',needs:'먼저 필요(기능 의존)',shares:'같은 요구 공유',related:'관련(참고)'};
/** Read-only lines: what the user wrote about how areas relate. Not run order, messages or progress. */
function drawRelations(svg:SVGSVGElement,labels:HTMLElement,plane:HTMLElement) {
  const center=(id:string)=>{const el=plane.querySelector<HTMLElement>(`.area-node[data-area-id="${id}"]`);if(!el)return null;
    return {x:el.offsetLeft+el.offsetWidth/2,y:el.offsetTop+el.offsetHeight/2};};
  svg.replaceChildren();labels.replaceChildren();
  for(const r of project.space.relations) {
    const a=center(r.from),b=center(r.to);if(!a||!b)continue;
    const line=document.createElementNS('http://www.w3.org/2000/svg','line');
    for(const [k,v] of [['x1',a.x],['y1',a.y],['x2',b.x],['y2',b.y]] as const)line.setAttribute(k,String(v));
    line.setAttribute('class',`relation-line ${r.kind}`);line.setAttribute('marker-end','url(#relation-end)');svg.append(line);
    const chip=node('span',RELATION_LABEL[r.kind],'relation-chip');chip.title=`${areaById(r.from)?.name} → ${areaById(r.to)?.name} · ${RELATION_HINT[r.kind]}${r.note?` · ${r.note}`:''}`;
    chip.style.left=`${(a.x+b.x)/2}px`;chip.style.top=`${(a.y+b.y)/2}px`;labels.append(chip);
  }
}
function renderMap(root:HTMLElement,active:Area[]) {
  const section=node('section','','area-map');section.setAttribute('aria-label','영역 지도');
  const bar=node('div','','map-toolbar');bar.append(node('h2','영역'));
  const add=node('form','','area-add');add.id='area-add-form';add.setAttribute('aria-label','영역 추가');
  const name=spaceInput(node('input'),'area-name');name.maxLength=60;name.placeholder='영역 이름 (예: 예약)';name.setAttribute('aria-label','영역 이름');
  const note=spaceInput(node('input'),'area-note');note.maxLength=2000;note.placeholder='한 줄 구상 · 비워 두면 ‘미정’';note.setAttribute('aria-label','영역 설명');
  const submitArea=node('button','＋ 영역 추가','secondary');submitArea.type='submit';submitArea.id='area-add';add.append(name,note,submitArea);
  bar.append(add);
  const unplaced=areaRequests(null);
  if(unplaced.length){const b=btn(`영역 미지정 작업 · 요청 ${unplaced.length}개`,()=>openArea('unassigned'),'quiet','open-unplaced');bar.append(b);}
  section.append(bar);
  const layout=node('div','','map-layout'),map=node('div','','space-map');map.id='space-map';
  map.setAttribute('aria-label','영역 지도 · 빈 곳을 끌어 이동, 카드의 ⠿를 끌어 위치 이동');
  const plane=node('div','','space-plane');plane.id='space-plane';
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','relation-layer');svg.setAttribute('aria-hidden','true');
  const defs=document.createElementNS('http://www.w3.org/2000/svg','defs');defs.innerHTML='<marker id="relation-end" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z"/></marker>';
  const lines=document.createElementNS('http://www.w3.org/2000/svg','g');svg.append(defs,lines);
  const labels=node('div','','relation-labels');
  plane.append(svg,labels);const redraw=()=>drawRelations(lines as unknown as SVGSVGElement,labels,plane);
  for(const a of active)plane.append(areaNode(a,plane,redraw));
  map.append(plane);
  if(!active.length)map.append(node('p','아직 영역이 없어요. 위에서 큰 덩어리부터 추가해 보세요. 정하지 못한 것은 설명을 비워 두면 ‘미정’으로 남아요.','map-empty hint'));
  const controls=node('div','','map-controls');
  const scale=node('span','','map-scale');scale.id='map-scale';
  controls.append(btn('－',()=>zoom(map,plane,1/1.25),'quiet map-zoom-out','map-zoom-out'),scale,btn('＋',()=>zoom(map,plane,1.25),'quiet map-zoom-in','map-zoom-in'),
    btn('전체 맞춤',()=>{mapView=fitView(map,active);applyView(plane);rememberMap();scale.textContent=scaleLabel(mapView.s);},'quiet','map-fit'));
  const last=posUndo.at(-1);
  if(last)controls.append(btn(`위치 되돌리기 · ${areaById(last.id)?.name??''}`,undoPosition,'quiet','map-undo'));
  map.append(controls);layout.append(map);
  // Panning: only from the empty background, so cards, buttons and inputs keep their own behaviour.
  map.addEventListener('pointerdown',e=>{
    const t=e.target as HTMLElement;if(e.button!==0||t.closest('.area-node,.map-controls,button,input,textarea,select,a'))return;
    map.setPointerCapture(e.pointerId);const v=mapView??{x:0,y:0,s:1},sx=e.clientX,sy=e.clientY;map.classList.add('panning');
    const move=(ev:PointerEvent)=>{mapView={x:v.x+ev.clientX-sx,y:v.y+ev.clientY-sy,s:v.s};applyView(plane);};
    const up=()=>{map.removeEventListener('pointermove',move);map.removeEventListener('pointerup',up);map.removeEventListener('pointercancel',up);map.classList.remove('panning');rememberMap();};
    map.addEventListener('pointermove',move);map.addEventListener('pointerup',up);map.addEventListener('pointercancel',up);
  });
  const sel=mapSelected?areaById(mapSelected):null;
  if(sel&&!sel.archived)layout.append(areaPanel(sel));
  section.append(layout);root.append(section);
  if(!mapView)mapView=fitView(map,active);
  applyView(plane);scale.textContent=scaleLabel(mapView.s);redraw();
  add.addEventListener('submit',e=>{e.preventDefault();if(!name.value.trim())return;
    // Place the new area where the user is looking (free slot nearest to the map centre).
    const v=mapView??{x:0,y:0,s:1},near={x:(map.clientWidth/2-v.x)/v.s-NODE_W/2,y:(map.clientHeight/2-v.y)/v.s-NODE_H/2};
    guard(()=>{commit(addArea(project,name.value,note.value,near));const created=project.space.areas.at(-1)!;clearInputs('area-name','area-note');
      // Keep the new area in sight: move only the viewport when its slot is outside the visible map.
      const pt=areaPosition(project,created),w=$('space-map').clientWidth,h=$('space-map').clientHeight,s=v.s,sx=pt.x*s+v.x,sy=pt.y*s+v.y;
      if(sx<0||sy<0||sx+NODE_W*s>w||sy+NODE_H*s>h)mapView={x:w/2-(pt.x+NODE_W/2)*s,y:h/2-(pt.y+NODE_H/2)*s,s};
      mapSelected=created.id;rememberMap();render();$('area-name').focus();});});
}
/** Short properties of the selected area: name and one-line idea. Long work and reports live in the area screen. */
function areaPanel(a:Area):HTMLElement {
  const panel=node('aside','','area-panel');panel.id='area-panel';panel.setAttribute('aria-label',`${a.name} 속성`);panel.classList.toggle('sheet-open',sheetOpen);
  const head=node('div','','panel-top');head.append(node('strong',a.name),btn('닫기',()=>{mapSelected=null;sheetOpen=false;rememberMap();render();},'quiet','area-panel-close'));
  const nameKey=`area-edit-name:${a.id}`,noteKey=`area-edit-note:${a.id}`;
  const name=spaceInput(node('input'),'panel-name',a.name,nameKey);name.maxLength=60;name.setAttribute('aria-label','영역 이름');
  const note=spaceInput(node('textarea'),'panel-note',a.note,noteKey);note.rows=3;note.maxLength=2000;note.setAttribute('aria-label','한 줄 구상');note.placeholder='비워 두면 ‘미정’';
  const row=node('div','','row');
  row.append(btn('반영',()=>{if(!name.value.trim())return;commit(editArea(project,a.id,name.value,note.value));clearInputs(nameKey,noteKey);},'secondary','panel-save'),
    btn('취소',()=>{clearInputs(nameKey,noteKey);render();},'quiet','panel-cancel'));
  const go=node('div','','row');go.append(btn('영역 열기 ↗',()=>openArea(a.id),'primary','panel-open'),btn('이 영역에 새 요청',()=>writeInArea(a.id),'quiet','panel-new-request'));
  panel.append(head,node('label','이름'),name,node('label','한 줄 구상'),note,row,node('p',areaSummary(a),'hint'),go);
  return panel;
}
function renderSpace() {
  const root=$('space-view');root.replaceChildren();if(view!=='space'&&view!=='area')return;
  root.hidden=route==='projects'; // shown before building, so the map is measured at its real size (fit)
  const area=view==='area'?areaById(viewArea):null,crumb=node('nav','','space-crumb');crumb.setAttribute('aria-label','공간 경로');
  if(view==='area')crumb.append(btn('전체 공간',openSpace,'crumb-link','space-crumb-root'),node('span','›','crumb-sep'),node('strong',area?area.name:'영역 미지정 작업'));
  if(view==='area')root.append(crumb);
  if(view==='space')renderOverview(root);else if(area)renderArea(root,area);else renderUnplaced(root);
}
function renderOverview(root:HTMLElement) {
  const active=project.space.areas.filter(a=>!a.archived),archived=project.space.areas.filter(a=>a.archived),brief=project.space.brief;
  const head=node('div','','space-head'),title=node('h1','전체 공간');title.id='space-title';title.tabIndex=-1;
  head.append(node('p','PROJECT SPACE','eyebrow'),title);
  const purpose=node('p',brief?brief.text:'무엇을 만드는지 한두 문장으로 적어 두면 영역을 나누기 쉬워요.',brief?'space-brief':'hint');purpose.id='space-brief';head.append(purpose);
  const edit=details(brief?'목적 고치기':'목적 적기','brief-edit'),field=spaceInput(node('textarea'),'brief-edit-text',brief?.text??'');field.rows=2;field.maxLength=12000;
  field.setAttribute('aria-label','프로젝트 목적');
  edit.append(field,btn('목적 저장',()=>{if(!field.value.trim())return;commit(setBrief(project,field.value.trim()));clearInputs('brief-edit-text');},'secondary','brief-save'));
  if(brief?.previous.length)edit.append(node('p',`이전에 적은 목적 ${brief.previous.length}개는 그대로 보관돼요.`,'hint'));
  head.append(edit);root.append(head);
  renderMap(root,active);
  if(active.length>1||project.space.relations.length) {
    const rel=node('section','','area-relations');rel.id='area-relations';rel.append(node('h2','영역 사이 관계'),node('p','실행 순서나 자동 연결이 아니라, 영역끼리 어떤 사이인지 적어 두는 메모예요.','hint'));
    const list=node('ul','','relation-list');
    for(const r of project.space.relations){const li=node('li');li.append(node('span',`${areaById(r.from)?.name} → ${areaById(r.to)?.name} · ${RELATION_LABEL[r.kind]}${r.note?` · ${r.note}`:''}`),btn('지우기',()=>commit(removeRelation(project,r.id)),'quiet'));list.append(li);}
    rel.append(list);
    if(active.length>1) {
      const form=details('관계 적기','relation-add'),sel=(id:string,label:string)=>{const s=node('select');s.id=id;s.setAttribute('aria-label',label);for(const a of active){const o=node('option',a.name);o.value=a.id;s.append(o);}return s;};
      const from=sel('relation-from','어느 영역에서'),to=sel('relation-to','어느 영역으로');to.selectedIndex=1;
      const kind=node('select');kind.id='relation-kind';kind.setAttribute('aria-label','관계 유형');for(const [k,label] of Object.entries(RELATION_LABEL)){const o=node('option',label);o.value=k;kind.append(o);}
      const memo=spaceInput(node('input'),'relation-note');memo.maxLength=200;memo.placeholder='설명 (선택)';memo.setAttribute('aria-label','관계 설명');
      form.append(from,to,kind,memo,btn('관계 추가',()=>{commit(addRelation(project,from.value,to.value,kind.value as RelationKind,memo.value));clearInputs('relation-note');},'secondary','relation-save'));
      rel.append(form);
    }
    root.append(rel);
  }
  if(archived.length) {
    const box=details(`보관한 영역 ${archived.length}개`,'archived-areas');
    for(const a of archived){const row=node('div','','row');row.append(node('span',a.name),btn('열어 보기',()=>openArea(a.id),'quiet'),btn('되살리기',()=>commit(setAreaArchived(project,a.id,false)),'quiet'));box.append(row);}
    root.append(box);
  }
}
function taskEntry(t:Task,placing:boolean):HTMLElement {
  const item=node('article','','area-task');item.dataset.taskId=t.id;const first=sourceOf(project,t),results=returnsOf(t);
  item.append(node('h3',taskTitle(project,t)),node('p',`${first?dateLabel(first.at):''} · ${taskStatus(project,t)}`,'hint'));
  if(results.length){const last=results.at(-1)!,src=project.sources.find(s=>s.id===last.sourceIds[0]);
    item.append(node('p',`돌아온 결과 ${results.length}개 · 앱 미검증${src?` · 최근: ${shortText(reportBody(src),60)}`:''}`,'area-task-result'));}
  const row=node('div','','row');
  if(currentGroup(t)){row.append(tag('지금 이어가는 작업','purple'),btn('작업 화면으로',()=>continueTask(t.id),'secondary'));}
  else row.append(btn('이어서 작업',()=>continueTask(t.id),'secondary area-continue'));
  if(placing) {
    const choices=project.space.areas.filter(a=>!a.archived);
    if(choices.length){const sel=node('select');sel.setAttribute('aria-label','옮길 영역');for(const a of choices){const o=node('option',a.name);o.value=a.id;sel.append(o);}
      row.append(sel,btn('이 영역으로 옮기기',()=>commit(placeTask(project,t.id,sel.value)),'quiet area-place'));}
  }
  item.append(row);
  // Reading the originals never changes which work the user continues.
  const raw=details('원문 보기',`raw-${t.id}`);if(first)raw.append(node('div',first.text,'source-raw'));
  for(const r of results)for(const id of r.sourceIds){const src=project.sources.find(s=>s.id===id);if(src)raw.append(node('p',`${sourceName[src.kind]} · ${dateLabel(src.at)} · 앱 미검증`,'source-id'),node('div',reportBody(src),'source-raw'));}
  item.append(raw);return item;
}
function renderArea(root:HTMLElement,a:Area) {
  const head=node('div','','space-head'),title=node('h1',a.name);title.id='space-title';title.tabIndex=-1;
  head.append(node('p',a.archived?'AREA · 보관됨':'AREA','eyebrow'),title,a.note?node('p',a.note,'space-brief'):tag('미정','area-undecided'));
  const actions=node('div','','row');
  if(!a.archived)actions.append(btn('＋ 이 영역에 새 요청',()=>writeInArea(a.id),'primary','area-new-request'));
  actions.append(btn(a.archived?'영역 되살리기':'영역 보관',()=>{commit(setAreaArchived(project,a.id,!a.archived));if(!a.archived){project={...project,notice:`‘${a.name}’ 영역을 보관했어요. 연결된 요청과 결과는 그대로이며 ‘보관한 영역’에서 되살릴 수 있어요.`};openSpace();}},'quiet','area-archive'));
  head.append(actions);
  const nameKey=`area-edit-name:${a.id}`,noteKey=`area-edit-note:${a.id}`;
  const edit=details('이름·설명 고치기','area-edit'),name=spaceInput(node('input'),'area-edit-name',a.name,nameKey);name.maxLength=60;name.setAttribute('aria-label','영역 이름');
  const note=spaceInput(node('textarea'),'area-edit-note',a.note,noteKey);note.rows=2;note.maxLength=2000;note.setAttribute('aria-label','영역 설명');
  edit.append(name,note,btn('저장',()=>{if(!name.value.trim())return;commit(editArea(project,a.id,name.value,note.value));clearInputs(nameKey,noteKey);},'secondary','area-edit-save'),
    btn('취소',()=>{clearInputs(nameKey,noteKey);edit.open=false;render();},'quiet','area-edit-cancel'));
  head.append(edit);root.append(head);
  const tasks=areaRequests(a.id),list=node('section','','area-tasks');list.id='area-tasks';
  list.append(node('h2','이 영역의 요청과 작업'));
  for(const t of tasks)list.append(taskEntry(t,false));
  if(!tasks.length)list.append(node('p',a.archived?'이 영역에 연결된 요청이 없어요.':'아직 이 영역의 요청이 없어요. ‘이 영역에 새 요청’으로 시작하세요.','hint'));
  root.append(list);
  const own=new Set(tasks.flatMap(t=>[t.id,...returnsOf(t).map(r=>r.id)])),bases=project.bases.filter(b=>own.has(project.sources.find(s=>s.id===b.sourceId)?.taskId??''));
  const shared=project.bases.length-bases.length,box=details(`기준 · 이 영역 ${bases.length}개 · 프로젝트 공통 ${shared}개`,'area-bases');
  for(const b of bases)box.append(node('p',`${BASIS_LABEL[b.status]} · ${shortText(b.text,90)}`,'source-raw'));
  box.append(node('p','공통 기준은 영역에 복사하지 않아요. 모든 영역의 작업문에 함께 들어가요.','hint'),btn('기준 · 출처 전체 보기',showContext,'quiet'));
  root.append(box);
}
function renderUnplaced(root:HTMLElement) {
  const head=node('div','','space-head'),title=node('h1','영역 미지정 작업');title.id='space-title';title.tabIndex=-1;
  head.append(title,node('p','영역을 만들기 전에 쓴 요청이에요. 영역으로 옮겨도 원문·결과·작업 기록은 그대로예요.','hint'));root.append(head);
  const tasks=areaRequests(null),list=node('section','','area-tasks');list.id='area-tasks';
  for(const t of tasks)list.append(taskEntry(t,true));
  if(!tasks.length)list.append(node('p','영역 미지정 요청이 없어요.','hint'));
  if(!project.space.areas.some(a=>!a.archived))list.append(node('p','먼저 전체 공간에서 영역을 추가하면 여기서 옮길 수 있어요.','hint'));
  root.append(list);
}
/** Where the open work sits in the space; shown once the project has a space. */
function renderPlace(t:Task|null) {
  const bar=$('work-place');bar.replaceChildren();bar.hidden=!hasSpace(project)||route==='example';if(bar.hidden)return;
  const area=t?areaById(areaOf(project,t)):null;
  bar.append(btn('전체 공간',openSpace,'crumb-link','place-space'));
  if(area)bar.append(node('span','›','crumb-sep'),btn(area.name,()=>openArea(area.id),'crumb-link','place-area'));
  bar.append(node('span','›','crumb-sep'),node('strong',t?'지금 이어가는 작업':'새 요청'));
}
/** The area the next request goes to: explicit, visible and changeable. Shown once areas exist. */
function renderComposeArea(t:Task|null,returned:boolean) {
  const row=$('compose-area-row'),sel=$<HTMLSelectElement>('compose-area'),active=project.space.areas.filter(a=>!a.archived);
  const saved=project.space.draftTarget?.area?project.space.areas.find(a=>a.id===project.space.draftTarget!.area&&a.archived):undefined;
  row.hidden=returned||(!active.length&&!saved)||route==='example';if(row.hidden)return;
  const follow=t?areaById(areaOf(project,t)):null;
  const options:[string,string][]=[['@follow',`지금 작업을 따라감 (${follow?follow.name:'영역 없음'})`],...active.map(a=>[a.id,a.name] as [string,string]),['@none','영역 없이']];
  sel.replaceChildren(...options.map(([v,label])=>{const o=node('option',label);o.value=v;return o;}));
  // A saved target in an archived area is shown as it is; it is never swapped for another area automatically.
  const dt=project.space.draftTarget,parked=dt?.area?project.space.areas.find(a=>a.id===dt.area&&a.archived):undefined;
  if(parked){const o=node('option',`보관된 영역: ${parked.name} · 되살리거나 다른 영역을 고르세요`);o.value=parked.id;sel.append(o);}
  sel.value=dt===null?'@follow':dt.area===null?'@none':dt.area;
}
function render() {
  if(route==='projects'){renderProjects();renderStatus();displayView();return;}
  const open=new Map([...document.querySelectorAll<HTMLDetailsElement>('details[id]')].map(d=>[d.id,d.open]));
  const active=document.activeElement as HTMLTextAreaElement|HTMLInputElement|null;
  const focus=active&&active.id?{id:active.id,start:active.selectionStart,end:active.selectionEnd}:null;
  if(document.activeElement!==$('project-name'))$<HTMLInputElement>('project-name').value=project.name;
  $<HTMLTextAreaElement>('draft').value=project.draft;$<HTMLSelectElement>('source-kind').value=project.draftKind;
  const returned=project.draftKind==='report'||project.draftKind==='evidence';
  for(const [id,selected] of [['request-tab',project.draftKind==='request'],['report-tab',returned]] as const){$(id).classList.toggle('selected',selected);$(id).setAttribute('aria-pressed',String(selected));}
  $('compose-title').textContent=returned?'어떤 결과가 돌아왔나요?':project.tasks.length?'다음으로 바꾸고 싶은 것은?':project.space.brief||project.space.draftTarget?'첫 요청 · 무엇부터 만들까요?':'또는 바로 첫 요청 쓰기';
  const others=activeEntries().some(e=>target.kind!=='entry'||e.entryId!==target.ref.entryId);
  $('welcome-title').textContent=others?'새 프로젝트 · 무엇을 만들고 싶나요?':'AI 개발 도구에 맡길 일을, 매번 처음부터 설명하지 않게.';
  $('compose-eyebrow').textContent=returned?'CONTINUE WITH RESULTS':project.tasks.length?'NEXT REQUEST':"LET’S START";
  $('input-hint').textContent=returned?'받은 보고를 그대로 붙여넣고 연결할 작업을 확인하세요. 검증 완료로 바꾸지 않습니다.':project.draftKind==='test_answer'?'합성 시험자료로만 보관합니다. 실제 요청과 확정 기준은 바꾸지 않습니다.':'필요한 질문만 받고, 바로 전달할 작업문을 준비해요.';
  $<HTMLTextAreaElement>('draft').placeholder=returned?'받은 결과 요약이나 변경 내용, 실행한 검사와 남은 일을 그대로 붙여넣으세요. 정해진 양식은 없어요.':project.tasks.length?'이번에 바꿀 부분만 적어 주세요. 앞에서 정한 기준은 함께 이어갑니다.':'무엇을 만들고 싶나요? 이미 작업 중이라면, 지금 바꾸고 싶은 부분만 알려주세요.';
  $('send').replaceChildren(document.createTextNode(returned?'결과에서 이어가기':'작업문 준비하기'),node('span',' ↗'));
  $('starter-examples').hidden=!!project.tasks.length||returned;
  $('brief-form').hidden=!!project.space.brief||route==='example';
  $('compose-panel').classList.toggle('initial',!project.tasks.length);
  const t=project.currentTaskId?taskOf(project):null;
  renderOutcome(t);renderBases(t);renderHistory();renderWork(t);renderReturnPreview();renderResultFile();renderSpace();renderPlace(t);renderComposeArea(t,returned);renderStatus();displayView();
  for(const d of document.querySelectorAll<HTMLDetailsElement>('details[id]'))if(open.has(d.id))d.open=open.get(d.id)!;
  if(focus){const target=document.getElementById(focus.id) as HTMLTextAreaElement|HTMLInputElement|null;if(target){target.focus({preventScroll:true});if(focus.start!=null&&focus.end!=null)try{target.setSelectionRange(focus.start,focus.end);}catch{/* A button has no selection range. */}}}
}
function submitInput(withAI:boolean) {
  if(project.pending||!project.draft.trim()||returnChoiceRequired()||(withAI&&!readyForAI()))return;
  guard(()=>{
    // No naming step: a still-default name becomes the first request's opening words; it can be renamed any time.
    if(!project.tasks.length&&project.name===createProject().name&&project.draftKind==='request')project=rename(project,shortText(project.draft,30));
    const parked=project.draftKind==='request'&&project.space.draftTarget?.area?project.space.areas.find(a=>a.id===project.space.draftTarget!.area&&a.archived):undefined;
    if(parked){project={...project,notice:`이 요청의 영역 ‘${parked.name}’은 보관돼 있어요. 영역을 되살리거나 다른 영역을 고른 뒤 보내세요.`};renderStatus();return;}
    const next=submit(project,returnTargets(project).length>1?selectedReturnTaskId:undefined);selectedReturnTaskId=undefined;commit(next);$<HTMLDetailsElement>('compose-panel').open=false;showWork();$('outcome-home').focus({preventScroll:true});$('outcome-home').scrollIntoView({block:'start'});// FIX088: a result filed to another task leaves the current work as it was: no AI run on it, no edit panel.
    if(next.currentTaskId!==next.tasks.at(-1)!.id)return;
    if(withAI)void generate(project.currentTaskId!);else {$<HTMLDetailsElement>('edit-work').open=true;$('work-next').focus();}});
}
$('compose').addEventListener('submit',e=>{e.preventDefault();submitInput(true);});
$('save-input').addEventListener('click',()=>submitInput(false));
$('draft').addEventListener('input',()=>guard(()=>commit(editDraft(project,$<HTMLTextAreaElement>('draft').value),false)));
$('project-name').addEventListener('input',()=>{const value=$<HTMLInputElement>('project-name').value;if(value.trim())guard(()=>commit(rename(project,value),false));});
$('project-name').addEventListener('blur',()=>{$<HTMLInputElement>('project-name').value=project.name;});
$('request-tab').addEventListener('click',()=>{if(project.draftKind!=='request')changeKind('request');});
$('report-tab').addEventListener('click',()=>{if(project.draftKind!=='report')changeKind('report');});
$('source-kind').addEventListener('change',()=>{const kind=$<HTMLSelectElement>('source-kind').value as Project['draftKind'];if(project.draftKind!==kind)changeKind(kind);});
$('cancel').addEventListener('click',()=>{controller?.abort();controller=null;commit(cancel(project));});
$('consent')?.addEventListener('change',renderStatus);
$('basis-draft').addEventListener('input',()=>guard(()=>commit(editAuxDraft(project,'basisDraft',$<HTMLTextAreaElement>('basis-draft').value),false)));
$('basis-form').addEventListener('submit',e=>{e.preventDefault();guard(()=>commit(recordBasis(project,project.basisDraft)));});
$('backup').addEventListener('click',()=>guard(()=>{
  const raw=serializeProject(project);download(`${safeName(project.name)}-복구.json`,raw,'application/json');
  // Same acceptance test as import. The file is still saved (preservation), but never reported as importable when it is not.
  try {parseProject(raw);} catch(e) {
    project={...project,notice:e instanceof Error&&e.message==='FILE_TOO_LARGE'?'복구 파일은 저장했지만 가져오기 한도(8MB)를 넘어 이 앱으로 다시 가져올 수 없습니다. 이 파일을 보관하세요. 앱 안의 프로젝트 분리 기능은 없습니다.':'복구 파일은 저장했지만 가져오기 검사를 통과하지 못합니다. 이 파일을 보관하세요.'};renderStatus();
  }
}));
$('import').addEventListener('click',()=>$<HTMLInputElement>('import-file').click());
$('select-result-file').addEventListener('click',()=>$<HTMLInputElement>('result-file-input').click());
$('result-file-input').addEventListener('change',async()=>{
  const input=$<HTMLInputElement>('result-file-input'),file=input.files?.[0];input.value='';if(!file)return;
  const read=++resultRead,epoch=projectEpoch,projectId=project.id;
  resultSelection=null;resultMessage='선택한 파일을 읽는 중입니다. 아직 가져오지 않았습니다.';renderResultFile();
  try {
    if(file.size>RESULT_BYTES)throw new Error('RESULT_TOO_LARGE');
    const bytes=await file.arrayBuffer();
    if(read!==resultRead||epoch!==projectEpoch||project.id!==projectId)return;
    const rawText=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
    resultSelection={rawText,projectId,revision:project.revision,epoch};resultMessage='원문과 연결 대상을 확인한 뒤 가져오세요.';renderResultFile();
  }catch(e){if(read!==resultRead||epoch!==projectEpoch)return;resultMessage=resultError(e)+' 파일 수리나 재실행 없이 기존 붙여넣기를 이용할 수 있습니다.';renderResultFile();}
});
$('import-file').addEventListener('change',async()=>{
  const input=$<HTMLInputElement>('import-file'),file=input.files?.[0];input.value='';if(!file)return;
  // Choosing or cancelling a file is not a switch: a pending answer or result preview stays valid until a copy opens
  // (openEntry then resets them). Only a newer file choice supersedes this read.
  const read=++recoveryRead,epoch=projectEpoch,revision=project.revision,projectId=project.id;
  try {
    if(file.size>FILE_LIMIT)throw new Error();const raw=await file.text();
    if(read!==recoveryRead||epoch!==projectEpoch)return;
    if(project.id!==projectId||project.revision!==revision){project={...project,notice:'복구 파일을 읽는 동안 입력이 바뀌어 사본을 만들거나 교체하지 않았습니다. 현재 입력은 그대로입니다.'};renderStatus();return;}
    const imported=parseProject(raw);
    if(!confirm(`“${imported.name}” · 기준 ${imported.bases.length}개 · 작업 ${imported.tasks.length}개를 새 프로젝트 사본으로 불러올까요?\n지금 열려 있는 프로젝트는 바뀌지 않아요. 원문·반환 연결은 파일 그대로 유지됩니다.${memoryDirty?'\n이 탭에서 저장되지 않은 변경은 사본으로 옮기면 사라질 수 있어요.':''}\n파일의 출처 기록은 서명된 검증 증거가 아닙니다.`))return;
    // FLOW083: a recovery file becomes a separate entry with a NEW entryId only; Project.id, tasks, sources,
    // returnIds and result files stay as in the file, so an exact result file still matches inside that entry.
    // The open project is never replaced, and nothing changes screen until the copy is written.
    // The consent covers only what was on screen then: unsaved input at this revision.
    imported.pending=null;const warned=memoryDirty,agreed=project.revision;
    await flushSaves();
    if(read!==recoveryRead||epoch!==projectEpoch)return;
    // The flush may fail (another tab saved this project, quota), and input typed meanwhile was never agreed to:
    // unsaved changes beyond that consent are asked about again instead of being left behind.
    if(memoryDirty&&(!warned||project.revision!==agreed)&&!confirm('이 탭에 저장되지 않은 변경이 있어요. 사본을 열면 이 화면을 떠나 그 변경이 사라질 수 있어요. 먼저 백업 파일을 저장하세요.\n그래도 사본을 열까요?'))return;
    const shown=target.kind==='entry'?target.ref.entryId:target.kind,shownRevision=project.revision;
    let ref:EntryRef;
    try {ref=await workspace.create(imported,'import');}
    catch(e) {const message=`백업 파일을 새 프로젝트로 저장하지 못했습니다. ${saveMessage(e)} 지금 프로젝트와 입력은 그대로입니다.`;listNotice=message;if(read===recoveryRead&&epoch===projectEpoch)project={...project,notice:message};render();return;}
    // Edits or another selection while the copy was written win: the copy is listed, the current screen stays.
    if(read!==recoveryRead||epoch!==projectEpoch||project.revision!==shownRevision||(target.kind==='entry'?target.ref.entryId:target.kind)!==shown||pendingSave||draining) {
      project={...project,notice:`“${imported.name}” 사본은 ‘내 프로젝트’에 추가했어요. 그 사이 이 화면이 바뀌어 지금 화면은 그대로 두었어요.`};renderStatus();return;
    }
    const entry=workspace.entries().find(e=>e.entryId===ref.entryId)!;
    openEntry(entry);project={...project,notice:`${imported.notice?`${imported.notice} `:''}“${imported.name}”을(를) 새 프로젝트 사본으로 불러왔어요. 이전 프로젝트는 ‘내 프로젝트’에 그대로 있어요.`};
    render();restoreDraftPanels();
  } catch {if(read!==recoveryRead||epoch!==projectEpoch)return;project={...project,notice:'복구 파일의 형식·버전·참조가 올바르지 않습니다. 현재 프로젝트를 바꾸지 않았습니다.'};renderStatus();}
});
$('nav-projects').addEventListener('click',()=>void showProjects());
$('to-projects').addEventListener('click',()=>void showProjects());
for(const id of ['new-project','new-project-top'])$(id).addEventListener('click',()=>void (async()=>{
  if(!await leaveProject('새 프로젝트로 가면'))return;startNew();render();restoreDraftPanels();$('draft').focus();})());
$('trash-current').addEventListener('click',()=>{if(target.kind==='entry')void trashProject(target.ref.entryId,project.name);});
$('undo-trash').addEventListener('click',()=>{if(undoEntry!==null)void restoreProject(undoEntry,true);});
$('list-import').addEventListener('click',()=>$<HTMLInputElement>('import-file').click());
for(const id of ['list-example','open-example'])$(id).addEventListener('click',()=>void openExample());
$('example-start').addEventListener('click',()=>closeExample(true));
$('example-close').addEventListener('click',()=>closeExample(false));
$('nav-space').addEventListener('click',openSpace);
document.addEventListener('keydown',e=>{
  if(!(e.ctrlKey||e.metaKey)||e.shiftKey||e.key.toLowerCase()!=='z')return;
  const t=e.target as HTMLElement|null;if(t&&(t.closest('input,textarea,select')||t.isContentEditable))return; // text undo first
  if(view==='space'&&posUndo.length){e.preventDefault();undoPosition();}
});
$('compose-area').addEventListener('change',()=>{const v=$<HTMLSelectElement>('compose-area').value;guard(()=>commit(setDraftTarget(project,v==='@follow'?undefined:v==='@none'?null:v)));});
$('brief-input').addEventListener('input',()=>{$<HTMLButtonElement>('brief-start').disabled=!$<HTMLTextAreaElement>('brief-input').value.trim();});
$('brief-form').addEventListener('submit',e=>{e.preventDefault();const value=$<HTMLTextAreaElement>('brief-input').value.trim();if(!value)return;
  guard(()=>{let n=setBrief(project,value);if(!n.tasks.length&&n.name===createProject().name)n=rename(n,shortText(value,30));
    $<HTMLTextAreaElement>('brief-input').value='';commit(n);openSpace();$('area-name')?.focus();});});
$('nav-work').addEventListener('click',()=>{contextOpen=false;showWork();$('context-title').scrollIntoView({block:'nearest'});});
$('nav-context').addEventListener('click',()=>{if(contextOpen&&view==='work')closeContext();else showContext();});
$('close-context').addEventListener('click',closeContext);
$('nav-history').addEventListener('click',()=>{view='history';displayView();$<HTMLDetailsElement>('history').open=true;$('history-title').focus();});
$('back-to-work').addEventListener('click',()=>{showWork();$('nav-work').focus();});
for(const example of document.querySelectorAll<HTMLButtonElement>('[data-example]'))example.addEventListener('click',()=>guard(()=>{commit(editDraft(project,example.dataset.example!));$('draft').focus();}));
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if($<HTMLDetailsElement>('connection-details').open){$<HTMLDetailsElement>('connection-details').open=false;$('connection-details').querySelector('summary')!.focus();}else if(contextOpen)closeContext();}});
window.addEventListener('beforeunload',e=>{if(memoryDirty||pendingSave||draining){e.preventDefault();e.returnValue='';}});
function restoreDraftPanels() {
  $<HTMLDetailsElement>('compose-panel').open=!project.tasks.length||!!project.draft.trim();
  if(project.basisDraft.trim())$<HTMLDetailsElement>('add-basis').open=true;
  for(const b of project.bases)if(basisDraftChanged(project,b)){const editor=$<HTMLDetailsElement>(`edit-${b.id}`);editor.open=true;const all=editor.closest<HTMLDetailsElement>('#all-bases');if(all)all.open=true;}
  displayView();
}
contextOpen=project.bases.some(b=>basisDraftChanged(project,b))||!!project.basisDraft.trim();
render();restoreDraftPanels();
try {
  config=await loadConfig();
  $('mode').textContent=config.label;
  $('mode-description').textContent=config.description;
  const consentArea=$('consent-area');if(consentArea)consentArea.hidden=!config.consentVisible;
  if(config.consentVisible&&config.configured&&config.paidEnabled)$<HTMLDetailsElement>('connection-details').open=true;
  if(config.notice)project={...project,notice:config.notice};
} catch {project={...project,notice:runtimeFailure.notice};$('mode').textContent=runtimeFailure.label;$('mode-description').textContent=runtimeFailure.description;}
renderStatus();
