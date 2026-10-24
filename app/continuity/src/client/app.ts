import { BASIS_LABEL, SOURCE_LABEL, FILE_LIMIT, RESULT_BYTES, TEXT_LIMIT, type Basis, type Project, type Task, type Source, type Area, type RelationKind, type Point, type Question, type GuideAnswer, type GuideReply, type Proposal } from '../shared/types.js';
import { createProject, restore, returnTargets, editDraft, editAuxDraft, editBasisDraft, setKind, rename, submit, recordBasis, editTask, editSuggestion,
  currentIntent, previousIntent, correctIntent, intentCorrection, continuingIntent, answer, begin, receive, failed, cancel, taskOf, taskSuggestions, relatedBases, taskStatus, handoffText, markHandoff, currentWork, questionApplicability, staleText, inspectResultFile, importResultFile, focusTask,
  areaOf, isReturnTask, setBrief, setDraftTarget, areaPosition, moveArea, undoMove, NODE_W, NODE_H, addArea, addChildArea, setAreaParent, editArea, setAreaArchived, addRelation, removeRelation, placeTask,
  exportAnchor, areaDescription, returnUnderstanding, planStamp, beginUnderstandingReview, understandingReviewMatches, recordUnderstandingReview, understandingReviewWork, type UnderstandingReviewToken, type DescriptionView } from '../shared/domain.js';
import { parseProject, parseResultFile, validateRequest, validateAdvice, validateGuideEnvelope } from '../shared/validation.js';
import { buildGuideRequest, guideDigest, readOf, proposalText, adoptProposal, instructionOf } from '../shared/guidance.js';
import { WorkspaceStore, serializeProject, storageErrorCode, type EntryRef, type WorkspaceEntry } from '../shared/storage.js';
import { mockAdvice } from '../shared/mock.js';
import { sourceName, sourceOf, taskTitle, shortText, dateLabel, basisDraftChanged, stageOf, exportNeedsRefresh, workOrigin, returnPreview, exportPreview, fitViewport, FIT_MIN, ZOOM_MIN, ZOOM_MAX } from './presentation.js';
import { loadConfig, requestAdvice, requestGuidance, runtimeStorage, runtimeFailure, type RuntimeConfig } from './runtime.js';
import { outcomeOf } from '../shared/outcome.js';
import { checkItems, pointedReturn, readingReasons, returnPath, rootRequest, subtreeSignals, type CheckItem, type ReadingReason } from '../shared/attention.js';
import { childrenOf, areaPath, descendantAreas, visibleAreas, visibleRepresentative, bundleRelations } from '../shared/hierarchy.js';
import { initSourceReview } from './source-review.js';
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
let view:'work'|'history'|'space'|'area'|'task'='work',contextOpen=false,hasSaved=false,memoryDirty=false;
// ENTRY37-F1: the 'continue' notice explains the work view it was given on and ends when that view is left (map, part,
// request, history, list), so it never takes room from the map, whose height follows what sits above it. Other notices
// keep their own life; typing already ends any notice (domain change()). In memory only, like the notice itself.
let workNotice:string|null=null;
// VISUAL42: the continue notice's short first line (which work text is edited); the exact sentence stays one click away.
let workNoticeLead='';
// WORK41: where the work view was left (scroll, open disclosures, the field and caret). Tab memory only; restored only for the
// same project, activation and current task.
let lastWorkField:string|null=null;
$('work-view').addEventListener('focusin',e=>{const t=e.target as HTMLElement;if(t.id&&t.matches('textarea,input'))lastWorkField=t.id;});
let workMemo:{project:string;epoch:number;task:string;y:number;open:Record<string,boolean>;focus:{id:string;start:number|null;end:number|null}|null}|null=null;
// FLOW090: where this tab looks in the plan space, and which area the next request is written for. Per tab, never
// project data; looking around never changes currentTaskId (the work the user continues).
let viewArea:string|null=null;
// SPATIAL102: the request shown read-only (view 'task'). Looking at it never changes currentTaskId or the request target.
let viewTask:string|null=null;
// SPATIAL102-R1: the report a '확인할 일' item pointed to, shown on the task screen (may be a report to a follow-up handoff).
// REPORT16: also the report the user picked on that screen. Never chosen for the user (no latest-report default).
let viewReturn:string|null=null;
// Received in this open project only; this is not tracking changes since a previous visit.
const receivedAreas=new Set<string>();
const understandingEdits=new Map<string,{token:UnderstandingReviewToken;epoch:number}>();
// Display-only reading choice. It never changes a description's validity or what goes into an export.
type WorkReference={project:string;epoch:number;task:string;area:string|null;revision:number|null;openedAt:string;reading:{y:number;open:Record<string,boolean>};restore:boolean};
let workReference:WorkReference|null=null;
// AREA17: the last result file with an organised description imported in this tab (work view line with the location action).
type ResultReceipt={project:string;epoch:number;taskId:string;requestId:string;exportTaskId:string;handoffId:string;duplicate:boolean;save:'pending'|'saved'|'memory'};
let lastReceipt:ResultReceipt|null=null;
// AREA17: an explicit 'where is it' moved only the map viewport to this area's card. origin = the view before that move, kept
// apart from the reading origin (reading a task from the located view and coming back must not lose it). Tab memory only.
type MapLocated={area:string;origin:MapOrigin;moved?:boolean;scaled?:boolean};
type Located={area:string;origin:Origin;moved?:boolean;scaled?:boolean};
let located:Located|null=null;
// REPORT16: which disclosures of the task screen are open, for that request and that picked report only (tab memory).
// Ids starting with 'task-report-' belong to the picked report and are dropped when another report is picked.
let readOpen:{task:string;ret:string|null;open:Record<string,boolean>}|null=null;
// SPATIAL102: this tab's memory of each layer of the open project (scroll, the card or request the user came back from).
type LayerMemo={space:number|null;from:string|null;areas:Record<string,{y:number;task:string|null}>};
let layerMemo:LayerMemo={space:null,from:null,areas:{}};
// FLOW090-B1: map viewport and selection are this tab's view of one project; positions are project data.
type MapView={x:number;y:number;s:number};
let mapView:MapView|null=null,mapSelected:string|null=null,sheetOpen=false,areaListOpen:boolean|null=null;
/** The automatic pan of a selection is undone when its panel closes, unless the user moved the map since. Tab memory only. */
let autoPan:{from:MapView;to:MapView}|null=null;
const sameView=(a:MapView|null,b:MapView|null)=>!!a&&!!b&&Math.abs(a.x-b.x)<.5&&Math.abs(a.y-b.y)<.5&&a.s===b.s;
let initialMapFitPending=false;
const MAP_CARD_HEIGHT=180; // Matches the bounded card footprint in styles.css and new-slot collision checks.
let collapsed=new Set<string>();
type SidePanel='area'|'relations'|'records';
let panelMode:SidePanel='area',relationCaller='map-relations-open';
let branchRecordCaller:{project:string;epoch:number;area:string;id:string}|null=null;
let compactMapHeader=false;
let recordsReturnNotice='';
type PanelReading={y:number;anchor:{id:string;top:number}|null;open:Record<string,boolean>};
let panelReadings:Record<string,PanelReading>={};
function safePanelReadings(raw:unknown):Record<string,PanelReading> {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return {};
  const out:Record<string,PanelReading>={};
  for(const [key,value] of Object.entries(raw).slice(-100)){if(!value||typeof value!=='object')continue;const v=value as Partial<PanelReading>;
    if(typeof v.y!=='number'||!Number.isFinite(v.y)||v.y<0||!v.open||typeof v.open!=='object'||Array.isArray(v.open))continue;
    const anchor=v.anchor&&typeof v.anchor.id==='string'&&typeof v.anchor.top==='number'&&Number.isFinite(v.anchor.top)?{id:v.anchor.id,top:v.anchor.top}:null;
    out[key]={y:v.y,anchor,open:Object.fromEntries(Object.entries(v.open).filter(([id,on])=>id.length<=250&&typeof on==='boolean'))};
  }return out;
}
const panelKey=(area:string)=>`${project.id}:${area}`;
function capturePanelReading(preferredId:string|null=null) {
  const body=document.getElementById('area-panel-body'),id=body?.dataset.areaId;
  // A previous project's hidden DOM can remain while the list/open-entry transition recalls its saved reading memo.
  if(!body||!id||route==='projects'||body.dataset.projectId!==project.id||!body.getClientRects().length)return;
  const rect=body.getBoundingClientRect(),items=[...body.querySelectorAll<HTMLElement>('[id]')];
  const visible=items.filter(el=>el.getClientRects().length&&el.getBoundingClientRect().bottom>rect.top+1&&el.getBoundingClientRect().top<rect.bottom);
  const preferred=preferredId?document.getElementById(preferredId):null;
  // An explicit navigation returns to its surviving caller, even when an earlier report row legitimately disappears.
  const anchor=preferred&&visible.includes(preferred)&&getComputedStyle(preferred).visibility==='visible'?preferred:
    visible.find(el=>el.getBoundingClientRect().top>=rect.top)??visible.at(-1);
  panelReadings[`${body.dataset.projectId}:${id}`]={y:body.scrollTop,anchor:anchor?{id:anchor.id,top:anchor.getBoundingClientRect().top-rect.top}:null,
    open:Object.fromEntries([...body.querySelectorAll<HTMLDetailsElement>('details[id]')].map(d=>[d.id,d.open]))};
}
function restorePanelReading() {
  const body=document.getElementById('area-panel-body'),id=body?.dataset.areaId,memo=id?panelReadings[panelKey(id)]:null;if(!body||!memo)return;
  for(const d of body.querySelectorAll<HTMLDetailsElement>('details[id]'))if(d.id in memo.open)d.open=memo.open[d.id]!;
  body.scrollTop=memo.y;
  const anchor=memo.anchor?document.getElementById(memo.anchor.id):null;
  if(anchor&&body.contains(anchor)&&anchor.getClientRects().length)body.scrollTop+=anchor.getBoundingClientRect().top-body.getBoundingClientRect().top-memo.anchor!.top;
}
// PC12: the one map/area view this tab left to read a task (and maybe continue it). Only parts the view already has:
// project, layer, area, viewport, selection, sheet, scroll and the control that was used. Never project data.
// fix1: open = which disclosures (details with an id) of that view were open or closed, so a long text the user had opened
// is open again and the page is as tall as it was before the scroll is restored. Tab memory only.
// fix2: anchor = where the calling control was (its viewport top and page position), so a return can bring back the reading
// place when content above it changed for a real reason (e.g. a notice from an explicit continue); it never rolls that back.
type MapOrigin={project:string;view:'space'|'area';area:string|null;map:MapView|null;selected:string|null;sheet:boolean;y:number;focus:string|null;open:Record<string,boolean>;
  anchor:{id:string;top:number;page:number}|null;collapsed:string[];panels:Record<string,PanelReading>;panel:SidePanel};
type WorkOrigin=Omit<MapOrigin,'view'>&{view:'work';work:{taskId:string|null;receiptId:string|null;context:boolean;upstream:MapOrigin|null;located:MapLocated|null}};
type Origin=MapOrigin|WorkOrigin;
let origin:Origin|null=null;
/** GUIDE097: area guidance per project and area, in this tab's memory only (declared early: resets use it). */
/** gen counts the user's edits of the draft; a reply that arrives after one is held in incoming, never applied over it. */
/** digest = the material the reply was made from; a held reply is applied only while the current material still matches it. */
type GuideApply={reply:GuideReply;mode:'mock'|'deepseek';read:string[];areaName:string;first:boolean;answer:GuideAnswer|null;instruction:string|null;digest:string};
/** GUIDE099: instruction = the optional 'work to hand over or change' input as typed (tab memory only); used = the instruction the
 * current question/answer/draft were made with. When they differ, that state is shown as made before the change and not reused. */
type Guide={question:Question|null;answer:GuideAnswer|null;proposal:Proposal|null;mode:'mock'|'deepseek'|null;read:string[];text:string;base:string;
  answerDraft:string;pending:{requestId:string;controller:AbortController}|null;notice:string|null;gen:number;incoming:GuideApply|null;instruction:string;used:string|null};
const guides=new Map<string,Guide>();
/** FLOW091-C: the task whose background preview the user opened (survives redraws such as an autosave). */
let backgroundOpen:string|null=null;
// One move = one command. Undo re-applies only that position, only while it is still where the move put it.
let posUndo:{id:string;from:Point|null;to:Point;at:number;key:boolean}[]=[];
const MAP_KEY='agentflow.workspace.map';
// HOME15: the tab also keeps the last view of a few other projects, so opening one from the list again reuses its own
// viewport and selection instead of a fresh fit. Per tab, never project data.
type MapMemo={view?:MapView|null;selected?:unknown;collapsed?:unknown;panels?:Record<string,PanelReading>|undefined;panel?:unknown;relations?:boolean|undefined};
function mapMemos():Record<string,MapMemo> {
  try {const v=JSON.parse(session?.getItem(MAP_KEY)||'null') as {project?:unknown;view?:MapView|null;selected?:unknown;others?:unknown}|null;if(!v)return {};
    const others=v.others&&typeof v.others==='object'?{...v.others as Record<string,MapMemo>}:{};
    if(typeof v.project==='string')others[v.project]={view:v.view??null,selected:v.selected??null,collapsed:(v as MapMemo).collapsed,panels:(v as MapMemo).panels,panel:(v as MapMemo).panel,relations:(v as MapMemo).relations};return others;
  } catch {return {};}
}
function rememberMap(){if(target.kind==='example')return; // ENTRY37: the unsaved example never takes a real project's memo slot.
  try{const others=Object.entries(mapMemos()).filter(([id])=>id!==project.id).slice(-11);
  session?.setItem(MAP_KEY,JSON.stringify({project:project.id,view:mapView,selected:mapSelected,collapsed:[...collapsed],panels:panelReadings,panel:panelMode,others:Object.fromEntries(others)}));}catch{/* Per-tab convenience only. */}}
function recallMap() {
  try {const v=mapMemos()[project.id];
    if(!v)return;const w=v.view;
    mapView=w&&[w.x,w.y,w.s].every(n=>typeof n==='number'&&Number.isFinite(n))&&w.s>=FIT_MIN&&w.s<=ZOOM_MAX?w:null;
    mapSelected=typeof v.selected==='string'&&project.space.areas.some(a=>a.id===v.selected&&!a.archived)?v.selected:null;
    collapsed=new Set(Array.isArray(v.collapsed)?v.collapsed.filter((id):id is string=>typeof id==='string'&&project.space.areas.some(a=>a.id===id&&!a.archived)):[]);
    panelReadings=safePanelReadings(v.panels);panelMode=v.panel==='records'||v.panel==='relations'?v.panel:v.relations===true?'relations':'area';
  } catch {/* none */}
}
const spaceInputs:Record<string,string>={};
const PLACE_KEY='agentflow.workspace.place';
const hasSpace=(p:Project)=>!!p.space.brief||p.space.areas.length>0;
function rememberPlace(){try{session?.setItem(PLACE_KEY,JSON.stringify({entry:target.kind==='entry'?target.ref.entryId:'',view,area:viewArea,task:viewTask,ret:viewReturn}));}catch{/* Per-tab convenience only. */}}
function recallPlace(entryId:string) {
  try {
    const v=JSON.parse(session?.getItem(PLACE_KEY)||'null') as {entry?:unknown;view?:unknown;area?:unknown;task?:unknown;ret?:unknown}|null;
    if(!v||v.entry!==entryId)return null;
    const areaOk=(id:unknown)=>typeof id==='string'&&(id==='unassigned'||project.space.areas.some(a=>a.id===id));
    const placed=['work','history','space','area','task'].includes(v.view as string)?v.view as typeof view:'work';
    // SPATIAL102: a remembered task that no longer exists (or is a return) falls back to its area, then to the whole space.
    if(placed==='task') {
      const t=typeof v.task==='string'?project.tasks.find(x=>x.id===v.task&&!isReturnTask(project,x)):undefined;
      // The pointed report is checked when shown (a stale one is reported, never swapped for another report).
      if(t)return {view:'task' as const,area:areaOf(project,t)??'unassigned',task:t.id,ret:typeof v.ret==='string'?v.ret:null};
      return {view:areaOk(v.area)?'area' as const:'space' as const,area:areaOk(v.area)?v.area as string:null,task:null,ret:null};
    }
    return {view:placed==='area'&&!areaOk(v.area)?'space' as const:placed,area:areaOk(v.area)?v.area as string:null,task:null,ret:null};
  } catch {return null;}
}
let selectedReturnTaskId:string|undefined;
// Local file reads/clipboard are not tickets or durable project data. Replacement invalidates both.
let projectEpoch=0,resultRead=0,recoveryRead=0,resultMessage='';
// Only the pending file read's automatic reveal is cancelled by leaving its work view.
// The selected bytes and the existing read/import guards keep their separate lifetime.
let resultRevealToken:{context:boolean}|null=null;
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
  branchRecordCaller=null;
  // USE106: this unsubmitted entry field belongs to the project being left, never to the next project.
  $<HTMLTextAreaElement>('brief-input').value='';$<HTMLButtonElement>('brief-start').disabled=true;
  controller?.abort();controller=null;for(const g of guides.values())g.pending?.controller.abort();guides.clear();selectedReturnTaskId=undefined;projectEpoch++;resultRead++;recoveryRead++;
  resultSelection=null;resultMessage='';lastFileExport=null;workNotice=null;view='work';viewArea=null;viewTask=null;viewReturn=null;layerMemo={space:null,from:null,areas:{}};
  receivedAreas.clear();
  understandingEdits.clear();workReference=null;workMemo=null;lastWorkField=null;lastReceipt=null;located=null;
  mapView=null;autoPan=null;mapSelected=null;initialMapFitPending=false;sheetOpen=false;areaListOpen=null;collapsed=new Set();panelReadings={};panelMode='area';recordsReturnNotice='';backgroundOpen=null;posUndo=[];origin=null;readOpen=null;
  for(const k of Object.keys(spaceInputs))delete spaceInputs[k];
}
function openEntry(entry:WorkspaceEntry,fromList=false) {
  resetEphemeral();route='project';target={kind:'entry',ref:{entryId:entry.entryId,lifecycle:entry.lifecycle,seq:entry.seq}};
  // A just-migrated older value keeps its one-time conversion notice; otherwise the usual restore applies.
  project=entry.origin==='legacy'&&entry.seq===1?{...restore(entry.project),notice:entry.project.notice}:restore(entry.project);
  storageError=workspace.writable?'':storageMessages[workspace.readError??'LOCKS_UNAVAILABLE']!;memoryDirty=false;hasSaved=true;
  rememberOpen(entry.entryId);contextOpen=project.bases.some(b=>basisDraftChanged(project,b))||!!project.basisDraft.trim();
  // A reload keeps this tab's place; opening from the list starts at the space once the project has one.
  // HOME15: a card in the list is 'go to this project', not 'resume the last screen of this tab'. Only a reload keeps it.
  const place=fromList?null:recallPlace(entry.entryId);
  recallMap();
  if(place){view=place.view;viewArea=place.area;viewTask=place.task;viewReturn=place.ret;} else view=hasSpace(project)?'space':'work';
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
  // ENTRY37: a normal first visit starts at the project home (its space example included). Without Web Locks nothing can be
  // saved, so the in-memory start stays as before instead of a home whose '새 프로젝트' is disabled.
  else if(workspace.writable)route='projects';
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
  if(view!=='work'||route==='projects'||resultRevealToken&&resultRevealToken.context!==contextOpen)resultRevealToken=null;
  const inProject=route!=='projects',starting=inProject&&!project.tasks.length;
  document.body.dataset.route=route;document.body.dataset.starting=String(starting);
  // FLOW091: inside a project (past the welcome) the head is one compact line so the map / next action come first.
  document.body.dataset.compact=String(inProject&&(view==='space'||view==='area'||view==='task'||!starting));
  // PC13: which layer is shown, so the whole space alone can use tighter spacing (other screens, notices and errors unchanged).
  document.body.dataset.layer=inProject?view:'';
  syncProjectHeader();
  const chip=$('connection-details'),host=$(inProject?'topbar-actions':'home-actions');if(chip.parentElement!==host)host.prepend(chip);
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
  const spatial=view==='space'||view==='area'||view==='task';$('space-view').hidden=!inProject||!spatial;
  $('nav-space').hidden=!inProject||(starting&&!hasSpace(project));
  $('nav-space').classList.toggle('active',inProject&&spatial);if(inProject&&spatial)$('nav-space').setAttribute('aria-current','page');else $('nav-space').removeAttribute('aria-current');
  $('nav-area-count').textContent=String(project.space.areas.filter(a=>!a.archived).length);
  if(route!=='projects')rememberPlace();
  // WORK41: the edit-place memo serves one return; once the work view is shown again it is spent (never replayed later).
  if(inProject&&view==='work')workMemo=null;
  $('context-panel').hidden=!contextOpen;$('workspace').classList.toggle('details-open',contextOpen);
  $('nav-context').setAttribute('aria-expanded',String(contextOpen));fitNameField();
  for(const [id,active] of [['nav-work',inProject&&view==='work'&&!contextOpen],['nav-context',inProject&&view==='work'&&contextOpen],['nav-history',inProject&&view==='history']] as const){
    $(id).classList.toggle('active',active);if(active)$(id).setAttribute('aria-current','page');else $(id).removeAttribute('aria-current');
  }
}
/** VISUAL42: the header's name field is as wide as its text (measured with its own computed font, plus a small margin for
 * caret and rounding), up to the CSS max-width; a longer name scrolls inside the field. View only, nothing is stored. */
let nameMeasure:CanvasRenderingContext2D|null=null;
function fitNameField() {
  const field=$<HTMLInputElement>('project-name'),cs=getComputedStyle(field);
  nameMeasure??=document.createElement('canvas').getContext('2d');if(!nameMeasure)return;
  nameMeasure.font=`${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const edges=['paddingLeft','paddingRight','borderLeftWidth','borderRightWidth'].reduce((n,k)=>n+(parseFloat(cs[k as 'paddingLeft'])||0),0);
  field.style.width=`${Math.ceil(nameMeasure.measureText(field.value||field.placeholder).width+edges+6)}px`;
}
/** VISUAL42: on PC every project layer shares the one header row, so project management is its menu there; narrow screens keep the inline buttons. */
function syncProjectHeader() {
  const compact=route!=='projects'&&innerWidth>760,menu=$<HTMLDetailsElement>('project-management');
  if(compact!==compactMapHeader){menu.open=!compact;compactMapHeader=compact;}
  document.body.dataset.mapHeader=String(compact);
}
function showWork() {view='work';displayView();refreshWorkReference();restoreWorkReferenceReading();}
/** SPATIAL102: remember the layer being left (scroll; in an area also which request was opened). Tab memory only. */
function leaveLayer() {
  if(view==='work')rememberWork();
  if(view==='space')layerMemo.space=window.scrollY;
  else if(view==='area'&&viewArea)layerMemo.areas[viewArea]={y:window.scrollY,task:layerMemo.areas[viewArea]?.task??null};
}
function rememberWork() {
  if(route==='projects'||!project.currentTaskId||$('work-view').hidden)return;
  // The field last edited in this view (a click on a way out moves the focus off it; its caret stays on the element).
  const active=document.activeElement as HTMLElement|null,field=active?.matches?.('textarea,input')&&$('work-view').contains(active)?active:lastWorkField?document.getElementById(lastWorkField):null;
  const a=field as HTMLTextAreaElement|HTMLInputElement|null,inWork=!!a?.id&&$('work-view').contains(a);
  workMemo={project:project.id,epoch:projectEpoch,task:project.currentTaskId,y:window.scrollY,
    open:Object.fromEntries([...$('work-view').querySelectorAll<HTMLDetailsElement>('details[id]')].map(d=>[d.id,d.open])),
    focus:inWork?{id:a!.id,start:'selectionStart' in a!?a!.selectionStart:null,end:'selectionEnd' in a!?a!.selectionEnd:null}:null};
}
/** Focus the first of these that is shown (the map card on wide screens, the list row where the map is hidden). */
function focusFirst(...ids:string[]):boolean {
  for(const id of ids){const el=document.getElementById(id);if(el&&el.offsetParent!==null){el.focus({preventScroll:true});return true;}}
  return false;
}
/** Coming back restores this layer's scroll and the card the user entered; an ID that no longer exists is just skipped. */
function openSpace() {
  branchRecordCaller=null;
  // PC12: arriving at the map by any other way makes it the new starting point; the earlier one is dropped.
  // AREA17: back to the whole space from the located area's own screens keeps the way back to the view before 'where is it';
  // arriving from anywhere else (the work view, another area) is a new start.
  if(!(located&&(view==='space'||(view==='area'||view==='task')&&viewArea===located.area)))located=null;
  origin=null;leaveLayer();view='space';viewArea=null;viewTask=null;viewReturn=null;sheetOpen=false;
  render(true,true,()=>window.scrollTo({top:layerMemo.space??0}));
  const plane=document.getElementById('space-plane');if(plane)markOffscreen(plane);
  const from=layerMemo.from;
  if(!(from&&focusFirst(`node-enter-${from}`,`list-enter-${from}`)))$('space-title')?.focus({preventScroll:true});
}
function openArea(id:string) {
  branchRecordCaller=null;
  if(view==='space')layerMemo.from=id;
  // AREA17: opening the located area itself (its panel's '영역 열기', its crumb) keeps the way back; any other area is a new start.
  if(!(located&&located.area===id&&(view==='space'||viewArea===id)))located=null;
  origin=null;leaveLayer();view='area';viewArea=id;viewTask=null;viewReturn=null;render();
  const memo=layerMemo.areas[id];window.scrollTo({top:memo?.y??0});
  if(!(memo?.task&&focusFirst(`task-open-${memo.task}`)))$('space-title')?.focus({preventScroll:true});
}
/** PC12: leaving the map or an area screen to read (or continue) a task records where the user was. Tab memory only. */
function markOrigin(focus:string|null=null) {
  if(view!=='space'&&view!=='area'&&view!=='work')return;
  if(view==='work'){
    const id=focus??(document.activeElement as HTMLElement|null)?.id??null,el=id?document.getElementById(id):null,r=el?.getClientRects().length?el.getBoundingClientRect():null;
    const upstream=origin?.view==='work'?origin.work.upstream:origin;
    const priorLocation=located&&located.origin.view!=='work'?{...located,origin:located.origin}:null;
    origin={project:project.id,view:'work',area:null,map:mapView?{...mapView}:null,selected:mapSelected,sheet:sheetOpen,y:window.scrollY,focus:id,
      open:Object.fromEntries([...$('work-view').querySelectorAll<HTMLDetailsElement>('details[id]')].map(d=>[d.id,d.open])),anchor:id&&r?{id,top:r.top,page:r.top+window.scrollY}:null,
      collapsed:[...collapsed],panels:structuredClone(panelReadings),panel:panelMode,work:{taskId:project.currentTaskId,receiptId:lastReceipt?.taskId??null,context:contextOpen,upstream:upstream?structuredClone(upstream):null,located:priorLocation?structuredClone(priorLocation):null}};
    located=null; // The one prior map excursion is held by value, not left as this new reading's active locator.
    return;
  }
  if(located&&(located.origin.view==='work'||located.origin.panel==='records')){origin=located.origin;return;}
  const active=document.activeElement as HTMLElement|null,used=active?.id&&$('space-view').contains(active)?active.id:null;
  const id=focus??used;capturePanelReading(id);
  const open=Object.fromEntries([...$('space-view').querySelectorAll<HTMLDetailsElement>('details[id]')].map(d=>[d.id,d.open]));
  const el=id?document.getElementById(id):null,r=el&&el.getClientRects().length?el.getBoundingClientRect():null;
  origin={project:project.id,view,area:view==='area'?viewArea:null,map:mapView?{...mapView}:null,selected:mapSelected,sheet:sheetOpen,y:window.scrollY,focus:id,open,
    anchor:id&&r&&!el?.closest('#area-panel-body')?{id,top:r.top,page:r.top+window.scrollY}:null,collapsed:[...collapsed],panels:structuredClone(panelReadings),panel:view==='space'?panelMode:'area'};
}
function originLabel(o:Origin):string {
  if(o.view==='work')return '검토 전 작업 화면';
  if(o.view==='space'&&o.panel==='records')return '전체 공간 · 이어 볼 기록';
  if(o.view==='space'&&o.panel==='relations')return '전체 공간 · 연결';
  if(o.view==='area')return o.area==='unassigned'?'영역 미지정 작업':areaById(o.area)?.name??'영역';
  const sel=o.selected?areaById(o.selected):null;return sel?`전체 공간 · ${sel.name} 정보`:'전체 공간';
}
function originButton(id:string):HTMLButtonElement|null {
  const o=origin;if(!o||o.project!==project.id)return null;
  const b=btn(o.view==='work'?'← 검토 전 작업 화면으로':`← 출발한 지도 보기로 · ${originLabel(o)}`,returnToOrigin,'secondary origin-return',id);
  b.title='읽기를 시작한 보기·선택·위치로 돌아가요. 이어가는 작업과 저장한 수정은 그대로예요.';return b;
}
/** PC12: back to the view this reading started from. It restores only the view (layer, area, viewport, selection, scroll,
 * the control used); the continued work and saved edits stay as they are now. A starting point that no longer exists
 * (area archived/removed, another project) falls back to the whole space without choosing anything else. */
function returnToOrigin() {const o=origin;origin=null;if(o?.panel==='records')located=null;restoreOrigin(o);}
/** AREA17: back to the view before an explicit 'where is it' moved the map (also after reading a task from there). */
function returnFromLocate() {const o=located?.origin??null;located=null;origin=null;restoreOrigin(o);}
function restoreOrigin(o:Origin|null) {
  if(!o||o.project!==project.id){openSpace();return;}
  if(o.view==='work'){
    const same=project.currentTaskId===o.work.taskId,sameReceipt=(lastReceipt?.taskId??null)===o.work.receiptId;
    const upstream=o.work.upstream??(!same?o.work.located?.origin??null:null);
    origin=upstream?structuredClone(upstream):null;located=same&&o.work.located?structuredClone(o.work.located):null;
    mapView=o.map?{...o.map}:null;initialMapFitPending=false;mapSelected=o.selected&&areaById(o.selected)&&!areaById(o.selected)!.archived?o.selected:null;
    sheetOpen=o.sheet&&!!mapSelected;collapsed=new Set(o.collapsed);panelReadings=structuredClone(o.panels);panelMode=o.panel;rememberMap();
    leaveLayer();view='work';viewArea=null;viewTask=null;viewReturn=null;contextOpen=o.work.context;render(false,false);
    if(same)for(const [id,open] of Object.entries(o.open)){const d=document.getElementById(id);if(d instanceof HTMLDetailsElement&&$('work-view').contains(d))d.open=open;}
    window.scrollTo({top:same?o.y:0});
    const a=same&&sameReceipt?o.anchor:null,el=a?document.getElementById(a.id):null;
    if(a&&el?.getClientRects().length){const page=el.getBoundingClientRect().top+window.scrollY;if(Math.abs(page-a.page)>=1)window.scrollTo({top:page-a.top});}
    if(!same){project={...project,notice:'지금 이어가는 작업은 그대로 두고 작업 화면으로 돌아왔어요. 검토 전 작업으로 바꾸지 않았어요.'};renderStatus();}
    if(same&&!sameReceipt){resultMessage='출발한 수신 안내가 달라져 입력 위치로 돌아왔어요. 다른 보고를 대신 고르지 않았어요.';const message=$('result-file-message');message.textContent=resultMessage;message.tabIndex=-1;message.focus({preventScroll:true});}
    else if(!same||!(o.focus&&focusFirst(o.focus)))$('context-title').focus({preventScroll:true});
    return;
  }
  const area=o.area&&o.area!=='unassigned'?areaById(o.area):null;
  const areaGone=o.view==='area'&&o.area!=='unassigned'&&(!area||area.archived);
  const sel=o.selected?areaById(o.selected):null,selGone=!!o.selected&&(!sel||sel.archived);
  const panels=structuredClone(o.panels);
  leaveLayer();
  view=areaGone?'space':o.view;viewArea=view==='area'?o.area:null;viewTask=null;viewReturn=null;
  if(o.map)mapView={...o.map};mapSelected=selGone?null:o.selected;sheetOpen=o.sheet&&!!mapSelected;
  collapsed=new Set(o.collapsed);panelReadings=structuredClone(panels);panelMode=o.panel;recordsReturnNotice='';
  // Reading waits until the original disclosures and final workspace height are restored.
  // fix1: disclosures that still exist get the open state they had; ones that are gone are skipped. Then the scroll.
  // WORK41: both happen before the PC map is sized, so its height is measured at the departure scroll (not the work view's).
  render(false,false,()=>{
    if(!areaGone)for(const [id,open] of Object.entries(o.open)){const d=document.getElementById(id);if(d instanceof HTMLDetailsElement&&$('space-view').contains(d))d.open=open;}
    window.scrollTo({top:areaGone?0:o.y});
  });
  // fix2: same content above the control = the scroll above is already the reading place. If the control moved on the page,
  // scroll so it is where it was in the viewport (the browser may clamp at the page end). Without the control: the plain scroll.
  const a=!areaGone?o.anchor:null,el=a?document.getElementById(a.id):null;
  if(a&&el&&el.getClientRects().length){const page=el.getBoundingClientRect().top+window.scrollY;if(Math.abs(page-a.page)>=1)window.scrollTo({top:page-a.top});}
  const recordGone=o.view==='space'&&o.panel==='records'&&!!o.focus&&!document.getElementById(o.focus);
  if(recordGone){recordsReturnNotice='출발한 버튼이 현재 목록에 없어 기록 머리로 돌아왔어요. 후속 요청 등으로 목록이 달라져도 원 기록은 지난 요청과 결과에 남아 있어요.';const note=$('records-return-notice');note.textContent=recordsReturnNotice;note.hidden=false;}
  sizeWorkspace();panelReadings=panels;restorePanelReading();rememberMap();
  if(areaGone||selGone){project={...project,notice:'출발한 영역이 보관되었거나 없어져 그 위의 보기로 돌아왔어요. 다른 영역이나 작업을 대신 고르지 않았어요.'};renderStatus();}
  if(recordGone)$('records-heading')?.focus({preventScroll:true});
  else if(areaGone||!(o.focus&&focusFirst(o.focus)))$('space-title')?.focus({preventScroll:true});
}
/** SPATIAL102: the read-only task screen. Opening it never changes the continued work or the request target.
 * returnId (SPATIAL102-R1): the report a check item points to, shown on that screen. */
function openTaskView(id:string,returnId:string|null=null,focus:string|null=null) {
  const t=project.tasks.find(x=>x.id===id);if(!t)return;
  const area=areaOf(project,t)??'unassigned';
  markOrigin(focus);leaveLayer();layerMemo.areas[area]={y:layerMemo.areas[area]?.y??0,task:id};readOpen=null;
  view='task';viewArea=area;viewTask=id;viewReturn=returnId;render();window.scrollTo({top:0});$('space-title')?.focus({preventScroll:true});
}
/** Explicit: continue this task (or go back to it when its return is what is open). Viewing never does this. */
function continueTask(id:string) {
  if(project.pending)return;
  markOrigin();
  const current=project.currentTaskId?taskOf(project):null,same=current&&(current.id===id||isReturnTask(project,current)&&current.parentTaskId===id);
  if(!same)commit(focusTask(project,id));view='work';render();
  // WORK41: continuing shows the work; the separate new-request box stays folded unless it holds an unsent input, a selected
  // result file or the receipt of a just-imported result (those are read there).
  if(!project.draft.trim()&&!resultSelection&&!receivedReceiptTarget())$<HTMLDetailsElement>('compose-panel').open=false;
  // PC12: say which record is now edited when it is not the request that was read.
  const read=project.tasks.find(x=>x.id===id),no=(x:Task)=>`작업 ${pad(project.tasks.findIndex(t=>t.id===x.id)+1)}`;
  if(read&&current&&same&&current.id!==id){project={...project,notice:`${no(read)} 요청에서 이어가기 · 이 요청에 받은 현재 보고 ${no(current)}에서 계속해요. 고치는 작업문은 ${no(current)}의 후속 확인 작업문이고, ${no(read)}의 작업문은 그대로예요.`};workNotice=project.notice;workNoticeLead=`${no(current)}의 후속 확인 작업문을 고쳐요 · ${no(read)}의 작업문은 그대로`;renderStatus();}
  else if(read&&current&&!same){project={...project,notice:`${no(read)}로 이어가기 · 고치는 작업문은 ${no(read)}의 것이에요. 전에 이어가던 ${no(current)}은 그대로 남아요.`};workNotice=project.notice;workNoticeLead=`${no(read)}의 작업문을 고쳐요 · ${no(current)}은 그대로`;renderStatus();}
  // ENTRY37-F1: the work's place bar (its way back to the map) starts below the sticky notice instead of under it; the
  // title keeps the focus. Without a place bar (no space yet) the title is the start, as before.
  const title=$('context-title'),place=$('work-place'),start=place.hidden?title:place;
  start.style.scrollMarginTop=`${(document.querySelector('.feedback-stack')?.getBoundingClientRect().height??0)+(start===title?24:12)}px`;
  title.focus({preventScroll:true});start.scrollIntoView({block:'start'});
}
/** WORK41: back to the work being continued, at the place it was left (scroll, the field and caret being edited). Nothing is
 * retargeted: the same current task, its draft and the unsent input stay as they are. */
function resumeWork(focusTitle=true,fromMap=false) {
  if(!project.currentTaskId)return;const memo=workMemo;
  // From the map panel the map view is the new starting point (the way back is offered on the work); from the side navigation
  // the earlier excursion ends as before. Either way the edit place below is restored, never the target.
  if(fromMap){markOrigin();leaveLayer();}else endRecordsExcursion();
  contextOpen=false;view='work';render(false,false);refreshWorkReference();
  if(memo&&memo.project===project.id&&memo.epoch===projectEpoch&&memo.task===project.currentTaskId){
    for(const [id,open] of Object.entries(memo.open)){const d=document.getElementById(id);if(d instanceof HTMLDetailsElement&&$('work-view').contains(d))d.open=open;}
    window.scrollTo({top:memo.y});
    const f=memo.focus?document.getElementById(memo.focus.id) as HTMLTextAreaElement|HTMLInputElement|null:null;
    if(f&&f.getClientRects().length){f.focus({preventScroll:true});if(memo.focus!.start!==null&&'setSelectionRange' in f)try{f.setSelectionRange(memo.focus!.start,memo.focus!.end??memo.focus!.start);}catch{/* not a text field */}return;}
  } else window.scrollTo({top:0});
  // From the side navigation the focus stays on the control that was used; from the map panel it moves to the work.
  if(focusTitle)$('context-title').focus({preventScroll:true});
}
/** Explicit: write the next request for this area (null = no area). The only way, besides the composer's own choice, to set the target. */
function writeInArea(id:string|null) {
  // AREA17: '이 영역에 새 요청' for the located area, from its map panel or its own screens, continues that reading: the work view
  // keeps the explicit way back to the view before locating. Writing anywhere else is a new start.
  if(!(located&&located.area===id&&(view==='space'||(view==='area'||view==='task')&&viewArea===id)))located=null;
  // An unsent report or request keeps its kind and target: open it instead of relabelling or moving it.
  if(project.draft.trim()) {
    // REPORT16: null = follows the current work; {area:null} = explicitly no area. Never the same words.
    const where=draftTargetLabel();
    const message=project.draftKind==='request'?`작성 중인 요청이 있어 먼저 열었어요. 이 요청의 대상(${where})은 그대로예요. 다른 영역에 쓰려면 이 요청을 보내거나 비운 뒤 다시 누르세요.`
      :'작성 중인 결과가 있어 먼저 열었어요. 종류와 연결할 작업은 바꾸지 않았어요. 이 입력을 마친 뒤 새 요청을 쓰세요.';
    view='work';render();project={...project,notice:message};renderStatus();
  } else {
    let n=project;if(n.draftKind!=='request')n=setKind(n,'request');selectedReturnTaskId=undefined;commit(setDraftTarget(n,id));view='work';render();
  }
  $<HTMLDetailsElement>('compose-panel').open=true;$('draft').focus();
}
/** REPORT16: where the unsent request goes, in the composer's own words (renderComposeArea). */
function draftTargetLabel():string {
  const dt=project.space.draftTarget;
  if(dt===null){const t=project.currentTaskId?taskOf(project):null,f=t?areaById(areaOf(project,t)):null;return `지금 작업을 따라감 · ${f?f.name:'영역 없음'}`;}
  if(dt.area===null)return '영역 없이';
  const a=areaById(dt.area);return a?`영역 ‘${a.name}’${a.archived?' · 보관됨':''}`:'없어진 영역';
}
/** Explicit navigation to another task (a received result, or back to the latest request). */
function openTask(id:string) {
  if(project.pending)return;
  commit(focusTask(project,id));showWork();focusWorkTop();
}
/** WORK41: an empty new project opens at its start: the page top with the optional purpose input focused (the direct first
 * request stays right below). Only when that input is not shown does the request field take the focus. */
function focusNewStart(){window.scrollTo({top:0});const brief=$<HTMLTextAreaElement>('brief-input');if(brief.getClientRects().length&&!$('brief-form').hidden)brief.focus({preventScroll:true});else $('draft').focus();}
/** WORK41: a newly opened work starts at its top (place, title, the work card); the context section is below it. */
function focusWorkTop(){$('context-title').focus({preventScroll:true});window.scrollTo({top:0});}
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
  if(workNotice!==null&&(route==='projects'||view!=='work')){if(project.notice===workNotice)project={...project,notice:null};workNotice=null;}
  const notice=$('notice');notice.hidden=!project.notice;
  if(project.notice&&project.notice===workNotice&&workNoticeLead){
    // Rebuilt only when the notice changes, so an opened '자세히' stays open across status updates.
    if(notice.dataset.text!==project.notice||!notice.querySelector('.notice-more')){
      const more=node('details','','notice-more');more.append(node('summary','자세히'),node('p',project.notice));
      notice.replaceChildren(node('span',workNoticeLead,'notice-lead'),more);
    }
  } else notice.textContent=project.notice??'';
  notice.dataset.text=project.notice??'';
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
  // WORK41: an unsent input says what it is and where it goes, so it is never mistaken for the work being continued.
  $('compose-draft-status').textContent=project.draft.trim()?`작성 중인 ${DRAFT_NAME[project.draftKind]} 있음 · ${unsentTarget()}`:'';
  $('basis-draft-status').textContent=project.basisDraft.trim()?'작성 중 · 기록 버튼을 누르면 기준에 반영됩니다.':'';
  for(const basis of project.bases){const marker=$(`draft-status-${basis.id}`);if(marker){marker.textContent=basisDraftChanged(project,basis)?'작성 중 · 현재 기준에는 아직 반영되지 않았어요.':'';marker.hidden=!basisDraftChanged(project,basis);}}
  if($('basis-form'))$<HTMLButtonElement>('basis-form').querySelector('button')!.disabled=!project.currentTaskId||!project.basisDraft.trim();
  document.title=route==='projects'?'내 프로젝트 · AgentFlow Studio':`${route==='example'?'예제 · ':''}${project.name} · AgentFlow Studio`;
  $('sidebar-project').textContent=project.name;$('breadcrumb-project').textContent=project.name;
  const t=project.currentTaskId?taskOf(project):null,stage=stageOf(project,t);
  const receipt=t?receiptOf(t):null;
  $('task-number').textContent=!t?'첫 작업':receipt!==null?`작업 ${pad(project.tasks.indexOf(t)+1)} · ${receipt>=0?`작업 ${pad(receipt+1)}에 받은 보고 보관`:'받은 보고 보관'} · 후속 확인 작업문 초안`
    :`현재 작업 ${pad(project.tasks.indexOf(t)+1)}`;
  $('context-title').textContent=stage.title;$('context-sub').textContent=stage.next;$('stage-label').textContent=stage.label;
  $('stage-label').dataset.stage=stage.kind;
  const report=outcomeOf(project).reports.at(-1);
  $('last-result').hidden=!report||report.taskId===t?.id;
  if(report){const reportTask=project.tasks.find(x=>x.id===report.taskId),parent=project.tasks.findIndex(x=>x.id===reportTask?.parentTaskId);
    $('last-result-summary').textContent=`최근 가져온 결과 · ${dateLabel(report.at)}${parent>=0?` · 작업 ${parent+1}에 연결`:''} · 앱 미검증`;
    $('last-result-text').textContent=reportBody(report);}
  $('sidebar-task').textContent=!t?'첫 작업을 기다리고 있어요.':`작업 ${project.tasks.indexOf(t)+1} · ${receipt!==null?`${receipt>=0?`작업 ${receipt+1}에 받은 보고 · `:''}후속 확인 작업문 초안`:taskTitle(project,t)}`;
  $('entry-limits').textContent=entryLimits();
  // Backup is offered as soon as there is anything to keep, including input that could not be saved.
  $('backup').hidden=route==='example'||(!project.tasks.length&&!project.draft.trim()&&!memoryDirty);
  if($('handoff-ready'))$('handoff-ready').hidden=stage.kind!=='exported';
  if($('bring-report'))$('bring-report').textContent=project.draft.trim()?'작성 중인 입력 이어쓰기':'결과 붙여넣기';
  if($('copy-work')){const copy=$<HTMLButtonElement>('copy-work');copy.className=stage.kind==='exported'||stage.kind==='question'?'secondary':'primary';copy.textContent=t&&exportNeedsRefresh(project,t)?'수정한 작업문 복사':'작업문 복사';}
  renderResultReceipt();
  // Status-only edits can remove an alert above the map without a render or a details toggle.
  // Measure only the displayed PC map; do not capture/restore panel memo or refit its camera here.
  const map=document.getElementById('space-map');
  if(route!=='projects'&&view==='space'&&innerWidth>760&&document.body.dataset.layer==='space'&&!$('space-view').hidden&&map?.getClientRects().length)sizeWorkspace();
}
function renderOutcome(t:Task|null) {
  const area=$('outcome-home');area.replaceChildren();area.hidden=!t;if(!t)return;
  const flow=outcomeOf(project,t.id);area.dataset.outcomeId=flow.id??'';
  const top=node('div','','outcome-heading'),title=node('div');
  // WORK41: below the work card, the context it was made from. Kept, never repeated by default: one disclosure holds the goal,
  // the request, conditions and the reports; signals that something else changed stay visible.
  title.append(node('h2','이 작업의 맥락'));
  const topActions=node('div','','outcome-actions');topActions.append(btn('방향 수정 / 다음 요청',()=>openComposer('request'),'secondary','change-direction'));
  top.append(title,topActions);area.append(top);
  const receipt=receiptLine();if(receipt)area.append(receipt);
  const ctx=details(`목표 · 이번 요청 · 조건 ${project.bases.length}개 · 받은 보고 ${flow.reports.length}개${flow.reports.length?' · 앱 미검증':''} 보기`,'outcome-context');ctx.className='outcome-context';
  ctx.append(handoffReview(t));
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
    card.append(node('h3',`이 작업의 목표 · ${correction?'직접 정정':t.mode==='mock'?'MOCK 정리':'AI 정리'}`));
    const goal=node('p',correction?.goal??value!.goal,'outcome-purpose outcome-excerpt');goal.id='intent-goal';card.append(goal);
    const conditions=correction?correction.conditions:value!.conditions.join(' / ');
    if(conditions)card.append(node('p',conditions,'source-raw'));
    if(value?.relation==='uncertain')card.append(node('p','아직 정하지 않은 관계는 미정으로 남겨 두었어요.','hint'));
    const earlier=value?.relation==='separate'?continuingIntent(project,t):null;
    if(earlier){const line=node('p',`참고 · 앞선 작업의 목표 (이전 해석, 현재 유효 여부는 이번 요청이 우선): ${earlier.manualGoal??earlier.value.goal}`,'hint');line.id='intent-continuing';card.append(line);}
    if(value&&project.bases.some(b=>['confirmed','deferred','answered'].includes(b.status)))card.append(node('p','직접 확정·답변·보류한 기준은 이 정리보다 우선해요.','hint'));
    const detail=details('정리 바로잡기 · 근거 보기','intent-details');
    const g=node('textarea');g.rows=2;g.maxLength=6000;g.value=correction?.goal??value!.goal;g.id='intent-edit-goal';g.setAttribute('aria-label','이 작업의 목표 직접 정정');
    const c=node('textarea');c.rows=2;c.maxLength=6000;c.value=conditions;c.id='intent-edit-conditions';c.setAttribute('aria-label','유지할 조건 직접 정정');
    detail.append(node('label','이 작업의 목표'),g,node('label','유지할 조건'),c,btn('정정 적용',()=>commit(correctIntent(project,t.id,g.value,c.value)),'secondary','intent-correct'));
    const prior=previousIntent(project,t);
    if(prior)detail.append(btn('직전 정리로 되돌리기',()=>commit(correctIntent(project,t.id,prior.manualGoal??prior.value.goal,prior.manualConditions??prior.value.conditions.join(' / '))),'quiet','intent-undo'));
    if(value?.retired.length)detail.append(node('p',`대체된 이전 요청 표현 · ${t.mode==='mock'?'MOCK 정리':'AI 해석'} (사용자 결정은 대체하지 않음): `+value.retired.join(' / '),'source-raw'));
    if(interpreted)detail.append(node('p',interpreted.value.basisRefs.map(ref=>`${ref.basisId} · r${ref.revision} · ${ref.sourceId}`).join(' / '),'source-id'));
    card.append(detail);ctx.append(card);
  }
  const origin=flow.origin;
  const request=flow.request;
  if(request) {
    const label=flow.requestBasis?.status==='confirmed'?'이번 요청 · 사용자 직접 정정':flow.requestBasis&&flow.requestBasis.text!==request.text?'이번 요청 · 기준의 현재 값':'이번 요청 · 사용자 원문';
    const purpose=node('p',flow.requestBasis?.text??request.text,'outcome-purpose outcome-excerpt');purpose.id='outcome-purpose';
    // FLOW091: when the goal above is the same sentence, the original is folded (one click away), never dropped.
    const goal=interpreted||correction?(correction?.goal??interpreted!.value.goal):null;
    if(goal!==null&&goal.trim()===purpose.textContent!.trim()){const same=details(`${label} 보기 · 위 목표와 같은 문장`,'outcome-request-raw');same.append(purpose);ctx.append(same);}
    else ctx.append(node('p',label,'source-meta'),purpose);
    const direction=node('section','','outcome-direction');direction.id='outcome-direction';
    if(flow.direction&&flow.direction.id!==request.id) {
      direction.append(node('h3',`${flow.directionDeclared?'앞서 바꾼 방향':'직전 사용자 요청'} · ${flow.directionBasis?.status==='confirmed'?'직접 정정':flow.directionBasis&&flow.directionBasis.text!==flow.direction.text?'기준의 현재 값':'원문 참조'}`),node('p',flow.directionBasis?.text??flow.direction.text,'outcome-excerpt'));
    }
    ctx.append(direction);
    const basis=flow.directionBasis??flow.requestBasis;
    if(basis) {
      const correction=details(flow.directionBasis?(flow.directionDeclared?'이 방향 바로잡기':'직전 요청 바로잡기'):'이번 요청 바로잡기','outcome-correction');
      const field=node('textarea');field.id='outcome-correction-text';field.rows=3;field.maxLength=12000;
      field.setAttribute('aria-label','이어갈 내용 직접 정정');field.value=project.basisEdits[basis.id]??basis.text;
      field.addEventListener('input',()=>guard(()=>commit(editBasisDraft(project,basis.id,field.value),false)));
      correction.append(field,btn('정정한 내용 기록',()=>commit(recordBasis(project,field.value,'confirmed',basis.id)),'secondary','correct-outcome'));
      ctx.append(correction);
    }
  }
  if(origin) {
    const source=details('출발 · 방향 · 이번 요청 원문 보기','outcome-origin');
    const visibleSources=new Map([origin,flow.direction,request].filter((s):s is Source=>s!==null).map(s=>[s.id,s]));
    for(const input of visibleSources.values())source.append(node('div',input.text,'source-raw'),node('p',`${input.id} · ${dateLabel(input.at)}`,'source-id'));
    source.append(btn('전체 작업 기록 보기',()=>$('nav-history').click(),'quiet'));
    source.append(node('p','원문 이력입니다. 후속 발언이 바꾼 부분은 새 요청을 따르며, 연결만으로 같은 목적이나 코드 영향을 판단하지 않습니다.','hint'));ctx.append(source);
  }
  if(flow.otherRequests.length) {
    const other=details(`현재 경로 밖 요청 ${flow.otherRequests.length}개`,'outcome-other-request');
    for(const request of flow.otherRequests)other.append(node('div',request.text,'source-raw'),node('p',`작업 ${project.tasks.findIndex(t=>t.id===request.taskId)+1} · ${dateLabel(request.at)}`,'source-id'));
    other.append(node('p','연결 기록만으로 진행·완료 여부를 알 수 없습니다. 이 요청이나 보고를 현재 작업에 자동 합치지 않습니다.','hint'));ctx.append(other);
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
    preview.append(node('h3','돌아온 내용 · 외부 원문'),node('p',reportBody(lastReport),'outcome-excerpt'),node('p','전체 원문과 연결 정보는 아래 보고·자료에서 볼 수 있어요.','hint'));ctx.append(preview);
  }
  const results=details(`이 흐름에서 받은 보고 · 자료 ${flow.reports.length}개`,'outcome-results');
  results.append(node('p','외부에서 가져온 원문입니다. 보고자·방법·환경·버전은 원문에 기재된 범위만 알 수 있고 나머지는 미상입니다. 파일이나 로그가 실행을 보증하지는 않습니다.','hint'));
  for(const s of [...flow.reports].reverse()) {
    const rt=project.tasks.find(x=>x.id===s.taskId)!,entry=node('div','','outcome-record');
    const parentIndex=project.tasks.findIndex(x=>x.id===rt.parentTaskId);
    entry.append(tag(sourceName[s.kind]),node('p',`${dateLabel(s.at)} · ${parentIndex<0?'연결된 이전 작업 없음':`연결 작업 ${parentIndex+1}`}${rt.resultFile?` · 내보내기 ${rt.resultFile.returnId}`:' · 붙여넣기 / 내보내기 판본 미확인'}`,'hint'),node('div',reportBody(s),'source-raw'),reportCorrectionHelp());results.append(entry);
  }
  if(!flow.reports.length)results.append(node('p','아직 이 작업 연결에서 받은 결과가 없습니다. 다른 작업의 보고는 작업 기록에서 볼 수 있어요.','hint'));
  grid.append(results);ctx.append(grid);
  const actions=node('div','','outcome-actions');
  actions.append(btn('결과 붙여넣기',()=>openComposer('report'),'quiet','home-paste-result'),btn('결과 JSON 가져오기',()=>{showWork();$<HTMLDetailsElement>('compose-panel').open=true;$<HTMLDetailsElement>('result-file-panel').open=true;$('select-result-file').click();},'quiet','home-file-result'));
  area.append(actions); // explicit result actions stay visible; they are not repeated content
  const limits=details('이 흐름의 범위','outcome-limits');limits.append(node('p','목적 변경, 필요한 선택, 의미 있는 결과가 있을 때 돌아오세요. 명확한 작업은 개발 도구에서 이어갑니다. AI 초안은 사용자 결정이 아니며, 보고 수신은 실행·완료 판정이 아닙니다.','hint'));ctx.append(limits);
  area.append(ctx);
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
  try {started=begin(project,id);} catch {commit({...project,notice:'AI 전송 문맥이 한도(128 KiB)를 넘거나 유효하지 않아 보내지 않았습니다. 확정 기준과 프로젝트 배경·영역 구상을 잘라 보내지 않았고, 입력과 저장 내용은 그대로입니다. 작업문 복사·Markdown 저장과 복구 파일은 계속 쓸 수 있습니다.'});return;}
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
  const anchor=fileMode?exportAnchor(project,taskOf(project,id)):null;
  try {text=handoffText(project,id,returnId);}catch {project={...project,notice:'작업 문맥 데이터가 유효하지 않아 내보내지 않았습니다. 복구 파일로 내용을 보존하세요.'};renderStatus();return;}
  if(method==='download'){download(`${safeName(project.name)}-${fileMode?'파일반환-':''}작업문.md`,text,'text/markdown;charset=utf-8');if(fileMode)lastFileExport={taskId:id,text};commit({...markHandoff(project,id,text,method,exportRevision,returnId,anchor),notice:'작업문을 Markdown 파일로 저장했어요. 그 파일을 개발 도구에 전달하는 건 직접 해 주세요. 전달·실행된 것은 아니에요.'});
    // Saves are asynchronous (locked): judge the save record only after it finished, for the same project view.
    await flushSaves();if(memoryDirty&&projectEpoch===epoch){project={...project,notice:'Markdown 파일은 저장했지만 저장 기록은 브라우저에 남기지 못했습니다. 닫기 전에 백업 파일을 저장하세요.'};renderStatus();}return;}
  try {await navigator.clipboard.writeText(text);
    if(project.id!==exportProjectId||project.revision!==exportRevision||projectEpoch!==epoch){project={...project,notice:'작업문은 복사됐지만 그 사이 입력이 바뀌었습니다. 현재 내용의 내보내기 기록으로 표시하지 않았습니다. 최신 작업문이 필요하면 다시 복사하세요.'};renderStatus();return;}
    if(fileMode)lastFileExport={taskId:id,text};
    commit(markHandoff(project,id,text,method,exportRevision,returnId,anchor));await flushSaves();if(projectEpoch!==epoch)return;project={...project,notice:memoryDirty?'작업문은 복사됐지만 내보내기 기록은 브라우저에 저장되지 않았습니다. 닫기 전에 JSON 백업을 저장하세요.':'작업문을 클립보드에 복사했습니다. 실행 도구에 직접 붙여넣으세요. 전송·실행된 것은 아닙니다.'};renderStatus();}
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
/** One tab-local receipt, pinned to the actual return task as well as its exact export. Never a latest-report lookup. */
function receivedReceiptTarget() {
  const r=lastReceipt;if(!r||r.project!==project.id||r.epoch!==projectEpoch)return null;
  const report=project.tasks.find(t=>t.id===r.taskId),request=project.tasks.find(t=>t.id===r.requestId),target=project.tasks.find(t=>t.id===r.exportTaskId);
  if(!report?.resultFile||!request||!target||report.parentTaskId!==target.id||!pointedReturn(project,request.id,report.id))return null;
  try{const file=parseResultFile(report.resultFile.rawText),record=target.handoffs.find(h=>h.returnId===r.handoffId);
    if(file.projectId!==project.id||file.taskId!==target.id||file.returnId!==r.handoffId||!record)return null;
    return {receipt:r,report,request,target,file,record};
  }catch{return null;}
}
function renderResultReceipt() {
  const host=document.getElementById('received-result-host');if(!host)return;
  const value=receivedReceiptTarget();if(!value){host.replaceChildren();document.getElementById('outcome-received-area')?.remove();return;}
  const {receipt:r,report,request,file}=value;
  const description=document.getElementById('outcome-received-area');if(description&&description.dataset.reportTaskId!==report.id)description.remove();
  if(r.save==='pending'&&!pendingSave&&!draining)r.save=memoryDirty||!hasSaved?'memory':'saved';
  else if(r.save==='memory'&&!pendingSave&&!draining&&!memoryDirty&&hasSaved)r.save='saved';
  let box=host.firstElementChild as HTMLElement|null;
  const key=`${r.epoch}:${r.project}:${report.id}`;
  if(box?.dataset.receiptKey!==key){
    box=node('section','','outcome-received');box.id='received-result-receipt';box.dataset.receiptKey=key;box.setAttribute('aria-label','받은 결과');
    const status=node('p','','hint');status.id='received-result-status';status.setAttribute('role','status');
    const label=node('p',`연결 요청 · ${taskTitle(project,request)}`,'hint');label.id='received-result-target';
    const proof=details('연결 근거','received-result-identity');proof.append(node('p',`요청 ${request.id}\n내보낸 작업 ${r.exportTaskId}\n인계 ${r.handoffId}\n받은 보고 ${report.id}`,'source-id'));
    box.append(status,label,btn('이 결과 검토',()=>openReceivedReport(report.id),'secondary','received-result-open'),proof);host.replaceChildren(box);
  }
  box.dataset.reportTaskId=report.id;box.dataset.requestTaskId=request.id;box.dataset.exportTaskId=r.exportTaskId;box.dataset.handoffId=file.returnId;box.dataset.duplicate=String(r.duplicate);box.dataset.saveState=r.save;
  const status=$('received-result-status');status.textContent=r.duplicate?(r.save==='memory'?'이미 받은 같은 보고예요 · 현재 변경은 저장되지 않았어요.':'이미 받은 같은 보고예요 · 새 기록을 추가하지 않았어요.'):
    r.save==='pending'?'보고를 가져왔어요 · 저장 중 · 앱 미검증':r.save==='memory'?'보고는 이 탭에만 있어요 · JSON 백업으로 보존하세요 · 앱 미검증':'보고를 가져왔어요 · 이 브라우저에 저장됨 · 앱 미검증';
}
function openReceivedReport(reportId:string) {
  const value=receivedReceiptTarget();
  if(view!=='work'||!value||value.report.id!==reportId){resultMessage='이 수신 안내의 보고를 지금 열 수 없어요. 다른 보고를 대신 열지 않았어요.';$('result-file-message').textContent=resultMessage;return;}
  openTaskView(value.request.id,value.report.id,'received-result-open');
}
function renderResultFile() {
  renderResultReceipt();
  $('result-file-message').textContent=resultMessage;
  const area=$('result-file-preview');area.replaceChildren();area.dataset.selectionState='none';if(!resultSelection)return;
  try {
    const {file,task,record,duplicate}=inspectResultFile(project,resultSelection.rawText),preview=exportPreview(project,task,record);
    resultSelection.revision=project.revision;
    area.dataset.selectionState='review';
    area.dataset.targetTaskId=task.id;area.dataset.returnId=record.returnId!;
    const heading=node('h3','선택한 결과 확인');heading.id='result-file-review-heading';heading.tabIndex=-1;
    area.append(heading,node('p',duplicate?'이미 가져온 결과입니다. 기존 기록을 확인할 수 있습니다.':'아직 가져오지 않았습니다.','hint'));
    area.append(node('h3',`연결할 작업 · ${taskTitle(project,task)}`),node('p',`내보낸 시점 · ${dateLabel(record.at)} · 원래 버전 r${record.revision}`,'hint'));
    if(task.handoffs.at(-1)!==record)area.append(node('p','이전 내보내기에 대한 보고입니다. 더 최근 내보내기로 옮기지 않습니다.','alert warning'));
    const bases=details(preview.recordedBases===null?'기준 기록 비교 불가':`이후 기록된 기준 ${preview.recordedBases.length}개`,'file-return-bases');
    bases.append(node('p','이 결과에 적용되는지는 직접 확인하세요. 기준·수동값을 자동으로 바꾸지 않습니다.','hint'));
    for(const b of preview.recordedBases??[])bases.append(node('div',`${b.id} · ${BASIS_LABEL[b.status]}\n${b.text}`,'source-raw'));
    const work=details('당시 작업문 내용','file-return-work');for(const [key,value] of Object.entries(record.work!))if(value)work.append(node('div',`${key}: ${value}`,'source-raw'));
    area.append(bases,work,node('p','외부 보고 원문 · 앱 미검증','source-meta'),node('div',file.report,'source-raw'));
    if(file.evidence!==null)area.append(node('p','외부 관찰·검사 원문 · 앱 미검증','source-meta'),node('div',file.evidence,'source-raw'));
    area.append(node('p','파일은 실행 증명이 아닙니다. 가져와도 AI 정리·명령·링크를 실행하지 않습니다.','hint'));
    if(file.understanding){const u=details('함께 받은 영역 설명','result-understanding-preview');u.append(node('p',file.understanding.summary,'source-raw'),node('p',`외부 정리 · ${file.understanding.origin} · 앱 미검증`,'hint'));area.append(u);}
    if(duplicate)area.append(node('p','같은 인계의 보고와 정리가 이미 있습니다. 다시 추가하지 않습니다.','hint'));
    area.append(btn(duplicate?'기존 기록 확인':'이 결과 가져오기',()=>void acceptResultFile(),'primary','accept-result-file'));
    area.append(rawFileDetails(resultSelection.rawText,file.returnId,'result-file-raw'));
  } catch(e) {
    area.dataset.selectionState='invalid';area.dataset.targetTaskId='';area.dataset.returnId='';
    const error=node('p',resultError(e),'alert warning');error.id='result-file-error';error.tabIndex=-1;area.append(error);
    const raw=details('선택 파일 원문 보기','result-file-raw'),field=node('textarea');field.readOnly=true;field.rows=5;field.value=resultSelection.rawText;field.setAttribute('aria-label','선택 파일 원문');raw.append(field);area.append(raw);
  }
  area.append(btn('닫고 기존 붙여넣기 이용',()=>{resultRead++;resultSelection=null;resultMessage='작성 중인 입력은 그대로입니다. 기존 입력란에 필요한 보고를 붙여넣으세요.';renderResultFile();$('draft').focus();},'quiet','cancel-result-file'));
}
async function acceptResultFile() {
  if(!resultSelection)return;
  if(resultSelection.projectId!==project.id||resultSelection.epoch!==projectEpoch){resultSelection=null;renderResultFile();return;}
  if(resultSelection.revision!==project.revision){resultMessage='입력이 바뀌어 현재 기준으로 미리보기를 갱신했습니다. 확인한 뒤 가져오세요.';renderResultFile();return;}
  try {
    const inspected=inspectResultFile(project,resultSelection.rawText),beforeIds=new Set(project.tasks.map(t=>t.id));
    const n=importResultFile(project,resultSelection.rawText);
    const added=n.tasks.filter(t=>!beforeIds.has(t.id)),report=inspected.duplicate??(added.length===1?added[0]:null);
    if(!report?.resultFile||report.parentTaskId!==inspected.task.id)throw new Error('RESULT_TARGET_MISSING');
    const received=parseResultFile(report.resultFile.rawText),request=rootRequest(n,report);
    if(received.taskId!==inspected.file.taskId||received.returnId!==inspected.file.returnId||!pointedReturn(n,request.id,report.id))throw new Error('RESULT_TARGET_MISSING');
    const receipt:ResultReceipt={project:project.id,epoch:projectEpoch,taskId:report.id,requestId:request.id,exportTaskId:inspected.task.id,handoffId:inspected.file.returnId,duplicate:!!inspected.duplicate,save:n===project?(memoryDirty?'memory':pendingSave||draining?'pending':'saved'):'pending'};
    lastReceipt=receipt;
    if(n===project){resultMessage='같은 보고의 기존 기록이에요. 새 기록을 추가하지 않았어요.';renderResultFile();return;}
    for(const a of n.space.areas)if(n.space.understanding[a.id]?.revision!==(project.space.understanding[a.id]?.revision??0)&&n.space.understanding[a.id]?.revision)receivedAreas.add(a.id);
    controller?.abort();controller=null;resultRead++;resultSelection=null;resultMessage='';
    resultMessage='보고를 이 탭에 가져왔어요 · 저장 중 · 앱 미검증. 작성 중인 입력은 그대로예요.';
    commit(n);const epoch=projectEpoch;await flushSaves();if(epoch!==projectEpoch||lastReceipt!==receipt)return;
    receipt.save=memoryDirty?'memory':'saved';resultMessage=memoryDirty?'결과는 이 탭에만 있습니다. 브라우저에 저장하지 못했습니다. 닫기 전에 JSON 백업을 저장하세요.':'보고를 가져왔습니다 · 앱 미검증. 작성 중인 입력은 그대로입니다.';
    // A completed save updates the receipt, never the screen the user has since chosen.
    $('result-file-message').textContent=resultMessage;renderResultReceipt();
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
    if(kind==='report'||kind==='evidence')d.append(reportCorrectionHelp());
    e.append(d);list.append(e);
  }
  if(!project.tasks.length)list.append(node('p','아직 남긴 요청이 없습니다. 첫 요청을 남기면 이곳에서 다시 볼 수 있어요.','hint'));
}
/** Read-only guidance: there is no per-report removal or unlink operation in this version. */
function reportCorrectionHelp():HTMLElement {
  const help=node('aside','','report-correction-help');help.setAttribute('aria-label','잘못 가져온 결과 안내');
  help.append(node('strong','잘못 가져온 결과인가요?'),
    node('p','현재는 저장된 결과 원문을 직접 고치거나 한 건만 삭제·제외·연결 해제할 수 없어요.'),
    node('p','현재 작업의 ‘방향 수정 / 다음 요청’에서 잘못된 보고의 작업 번호와 정정 내용을 새 요청으로 남길 수 있어요. 기존 보고와 연결은 그대로 남고 전달문에 포함될 수 있으니, 전달 전에 전체 문맥을 확인하세요.'),
    node('p','입력 중인 초안을 비워도 저장된 결과는 바뀌지 않아요. ‘휴지통으로 옮기기’는 요청·결과를 포함한 프로젝트 전체에 적용돼요.'));
  return help;
}
/** Existing records only. No extraction of conditions or unresolved choices from prose. */
function handoffReview(t:Task):HTMLElement {
  const flow=outcomeOf(project,t.id),intent=currentIntent(project,t),correction=intentCorrection(t);
  const box=node('section','','handoff-review');box.id='handoff-review';box.setAttribute('aria-label','전달 전 확인');
  box.append(node('h3','요청과 다음 행동 먼저 확인하기'),node('p','아래는 기록의 앞부분이에요. 의미 요약이나 새 결정을 만들지 않으며, 전체 원문·기준은 아래와 전체 전달문에 그대로 남아요.','hint'));
  const grid=node('dl','','review-grid');
  const item=(label:string,text:string)=>{const cell=node('div');cell.append(node('dt',label),node('dd',text));grid.append(cell);};
  const changed=!!flow.requestBasis&&flow.requestBasis.text!==flow.request?.text;
  item(changed?'이번 요청 · 현재 기준 값 앞부분':'이번 요청 · 원문 앞부분',shortText(flow.requestBasis?.text??flow.request?.text??'연결된 사용자 요청 없음. 가져온 보고를 새 요구로 바꾸지 않아요.',240));
  const conditions=correction?.conditions??intent?.value.conditions.join(' / ')??'';
  item(`별도 조건란 · ${correction?'직접 정정':intent?t.mode==='mock'?'MOCK 정리 값':'AI 정리 값':'기록 상태'}`,conditions?shortText(conditions,160):'별도 조건 값이 비어 있어요. 원문 속 조건·금지가 없다는 뜻은 아니에요.');
  const unresolved=project.bases.filter(b=>b.status==='deferred'||project.sources.some(s=>s.id===b.sourceId&&(s.disposition==='unknown'||s.disposition==='deferred')));
  const question=questionApplicability(project,t)==='active'?t.advice?.question:null;
  const unresolvedText=unresolved.length?`프로젝트의 보류·모름 기록 ${unresolved.length}개 · ${unresolved.slice(0,2).map(b=>shortText(b.text,90)).join(' / ')} · 전체는 아래 기준·출처에서 확인하세요.`:'';
  item('미정 · 열린 질문·보류·모름 기록',[question?`답변할 질문: ${shortText(question.text,180)}`:'',unresolvedText].filter(Boolean).join('\n')||'열린 질문이나 별도 보류·모름 기록은 없어요. 원문에 적힌 미정 사항은 자동 추출하지 않아요.');
  const stage=stageOf(project,t);
  item(`다음 행동 · ${stage.label}`,stage.kind==='ready'?'요청과 조건을 확인한 뒤 ‘작업문 복사’ 또는 ‘Markdown 저장’으로 가져가 쓰던 개발 도구에 붙여넣으세요. 복사·저장은 자동 실행이 아니에요.':stage.kind==='question'?'아래 질문에 답하거나 ‘잘 모르겠음’·‘이 질문은 보류’를 선택해 이어가세요.':stage.next);
  box.append(grid);return box;
}
function referenceMatches(t:Task,pin:WorkReference):boolean {
  return pin.project===project.id&&pin.epoch===projectEpoch&&pin.task===t.id&&pin.area===areaOf(project,t);
}
function pickedWorkDescription(pin:WorkReference):DescriptionView|null {
  if(pin.area===null||pin.revision===null||!areaById(pin.area))return null;
  const state=areaDescription(project,pin.area);
  return [state.current,...state.previous].find((d):d is DescriptionView=>!!d&&d.entry.revision===pin.revision)??null;
}
function workReferenceState(pin:WorkReference):{kind:string;text:string;newer:boolean} {
  if(pin.area===null)return {kind:'unassigned',text:'이 작업은 소유 부분이 미지정이에요. 다른 부분의 설명을 대신 보여 주지 않아요.',newer:false};
  if(!areaById(pin.area))return {kind:'missing',text:'이 작업의 소유 부분을 찾을 수 없어요.',newer:false};
  const state=areaDescription(project,pin.area),selected=pickedWorkDescription(pin),newer=!!state.current&&(pin.revision===null||state.current.entry.revision!>pin.revision);
  if(pin.revision===null)return {kind:'none',text:'읽기 시작할 때 적용된 설명은 없었어요.'+(state.held.length?' 반영하지 않은 정리는 아래에서 따로 읽을 수 있어요.':''),newer};
  if(!selected)return {kind:'missing',text:'읽던 설명이 지금 기록에 없어요. 다른 설명으로 바꾸지 않았어요. 닫고 다시 열어 확인하세요.',newer};
  if(selected.valid)return {kind:'current',text:'현재 인계에 참고하는 설명이에요. 앱이 검증한 사실은 아니에요.',newer};
  return {kind:newer?'previous':'stale',text:newer?'이후 새 설명이 있어 이전 기록을 읽고 있어요. 현재 인계 참고에는 포함되지 않아요.':'이전 기준의 설명 · 현재 인계 참고에는 포함되지 않아요. 구상·조건·직접 쓴 작업문 또는 포함 맥락의 기준이 바뀌었어요.',newer};
}
function captureWorkReferenceReading() {
  const body=document.querySelector<HTMLElement>('.work-reference-body'),pin=workReference;
  if(!pin||!body||body.dataset.taskId!==pin.task||body.dataset.projectId!==pin.project||!body.getClientRects().length)return;
  pin.reading={y:body.scrollTop,open:Object.fromEntries([...body.querySelectorAll<HTMLDetailsElement>('details[id]')].map(d=>[d.id,d.open]))};
}
function restoreWorkReferenceReading() {
  const body=document.querySelector<HTMLElement>('.work-reference-body'),pin=workReference;
  if(!pin?.restore||!body||body.dataset.taskId!==pin.task||body.dataset.projectId!==pin.project||!body.getClientRects().length)return;
  for(const d of body.querySelectorAll<HTMLDetailsElement>('details[id]'))if(d.id in pin.reading.open)d.open=pin.reading.open[d.id]!;
  body.scrollTop=pin.reading.y;pin.restore=false;
}
function fillWorkReference(body:HTMLElement,pin:WorkReference) {
  const id=body.id,a=areaById(pin.area),selected=pickedWorkDescription(pin);body.replaceChildren();
  body.dataset.selectedRevision=pin.revision===null?'':String(pin.revision);body.dataset.entryPresent=String(!!selected);
  if(a){body.append(areaIdea(a,`${id}-idea`,120,`현재 사용자 구상 · ${a.name}${a.archived?' (보관된 부분)':''}`));}
  if(selected){body.append(node('p',`읽기 시작할 때의 설명 · ${dateLabel(pin.openedAt)} · ${selected.entry.by==='user'?'사용자 정정':'외부 정리'} · 앱 미검증`,'source-meta'),node('div',selected.summary,'source-raw work-reference-summary'));
    if(selected.changes.length||selected.proposal){const more=details('함께 남긴 변화·미채택 제안 읽기',`${id}-changes-${pin.revision}`);
      for(const change of selected.changes)more.append(node('p',change,'source-raw'));
      if(selected.proposal)more.append(node('p','구상 변경 제안 · 미채택 · 실행 지시 아님','source-meta'),node('div',selected.proposal,'source-raw'));body.append(more);}
    body.append(descriptionEvidence(selected,`${id}-evidence-${pin.revision}`));
  }
  if(a){const state=areaDescription(project,a.id),older=pin.revision===null?[]:state.previous.filter(d=>d.entry.revision!<pin.revision!);
    if(older.length){const history=details('이전 설명 기록 읽기',`${id}-history`);for(const d of older)history.append(node('div',d.summary,'source-raw'),descriptionEvidence(d,`${id}-old-${d.entry.revision}`));body.append(history);}
    if(state.held.length){const held=details(`반영하지 않은 정리 ${state.held.length}개 읽기`,`${id}-held`);for(const [i,d] of state.held.entries())held.append(node('p',heldMessage[d.entry.held!]??'현재 설명으로 반영하지 않은 기록이에요.','hint'),node('div',d.summary,'source-raw'),descriptionEvidence(d,`${id}-held-${i}`));body.append(held);}
  }
  const live=workReferenceState(pin),ref=body.closest('.work-reference')!;
  ref.querySelector<HTMLElement>('[data-reference-status]')!.textContent=live.text;ref.querySelector<HTMLElement>('[data-reference-new]')!.hidden=!live.newer;body.dataset.referenceState=live.kind;
}
/** Manual typing updates only the live caption. The chosen body, disclosures, reading scroll and all inputs stay in place. */
function refreshWorkReference() {
  const body=document.querySelector<HTMLElement>('.work-reference-body'),pin=workReference,t=project.currentTaskId?taskOf(project):null;
  if(!body||!pin||!t||!referenceMatches(t,pin)||body.dataset.taskId!==t.id)return;
  if(body.dataset.entryPresent!==String(!!pickedWorkDescription(pin)))fillWorkReference(body,pin);
  const live=workReferenceState(pin),ref=body.closest('.work-reference')!,status=ref.querySelector<HTMLElement>('[data-reference-status]'),newer=ref.querySelector<HTMLElement>('[data-reference-new]');
  if(status&&status.textContent!==live.text)status.textContent=live.text;
  if(newer&&newer.hidden===live.newer)newer.hidden=!live.newer;
  if(body.dataset.referenceState!==live.kind)body.dataset.referenceState=live.kind;
}
function workReferenceReader(t:Task):HTMLDetailsElement {
  const area=areaOf(project,t),owner=project.id,epoch=projectEpoch,id=`work-reference-${owner}-${t.id}-${area??'unassigned'}-${epoch}`;
  const ref=details('참고 맥락 · 이 작업의 부분 구상·설명 읽기',id);ref.className='work-reference';ref.dataset.projectId=owner;ref.dataset.taskId=t.id;ref.dataset.areaId=area??'';
  const caption=node('div','','work-reference-caption'),status=node('p','참고를 닫고 다시 열어 읽을 설명을 선택하세요.','hint'),newer=node('p','새 설명이 있어요. 읽던 본문은 그대로예요. 닫고 다시 열면 새 설명을 읽을 수 있어요.','hint');status.dataset.referenceStatus='';status.setAttribute('role','status');newer.dataset.referenceNew='';newer.hidden=true;caption.append(status,newer);ref.append(caption);
  const body=node('div','','work-reference-body');body.id=`${id}-body`;body.tabIndex=0;body.setAttribute('role','region');body.setAttribute('aria-label','이 작업의 부분 구상과 선택한 설명 읽기');body.dataset.projectId=owner;body.dataset.taskId=t.id;body.dataset.areaId=area??'';ref.append(body);
  if(workReference&&referenceMatches(t,workReference)){ref.open=true;fillWorkReference(body,workReference);workReference.restore=true;}
  ref.querySelector('summary')!.addEventListener('click',e=>{
    if(!ref.isConnected||!ref.getClientRects().length||owner!==project.id||epoch!==projectEpoch||project.currentTaskId!==t.id||areaOf(project,taskOf(project))!==area)return;
    if(ref.open){workReference=null;return;}
    e.preventDefault();ref.open=true;
    const revision=area&&areaById(area)?areaDescription(project,area).current?.entry.revision??null:null;
    workReference={project:owner,epoch,task:t.id,area,revision,openedAt:new Date().toISOString(),reading:{y:0,open:{}},restore:false};fillWorkReference(body,workReference);body.scrollTop=0;
  });
  body.addEventListener('scroll',captureWorkReferenceReading,{passive:true});body.addEventListener('toggle',captureWorkReferenceReading,true);
  return ref;
}
function jumpWorkControl(id:string,part:'next'|'file') {
  if(view!=='work'||project.currentTaskId!==id||$('work-edit-fields')?.dataset.taskId!==id)return;
  const box=$<HTMLDetailsElement>(part==='next'?'edit-work':'file-return-options');box.open=true;
  const control=part==='next'?$('work-next'):box.querySelector('summary');
  control?.scrollIntoView({block:'center'});control?.focus({preventScroll:true});
}
/** WORK41: the start of the record this work follows up (a returned report, or the request), shown once in the work card: its
 * opening lines as written (not a summary) with who wrote it and that the app did not verify it. The whole text is one click
 * away; its end offers the way back to the owning part, so expanding a long report never loses the place. */
function workSource(t:Task):HTMLElement {
  const first=sourceOf(project,t),local=project.sources.filter(s=>t.sourceIds.includes(s.id)),receipt=receiptOf(t),owner=areaById(areaOf(project,t));
  const box=node('section','','work-source');box.id='work-source';
  const returned=!!first&&(first.kind==='report'||first.kind==='evidence');
  // One line: whose words, unverified, and the opening words as written (not a summary). The whole text is one click away.
  const line=node('p','','work-source-line');
  line.append(node('span',first?`${returned&&receipt!==null&&receipt>=0?`작업 ${pad(receipt+1)}에 받은 `:''}${sourceName[first.kind]}${returned?' · 외부 원문':''}`:'입력 원문','work-source-meta'));
  if(first){const text=returned?reportBody(first):first.text;line.append(node('span',text.replace(/\s+/g,' ').trim(),'work-source-lead'));line.title=dateLabel(first.at);}
  const raw=details(`${first?sourceName[first.kind]:'입력 원문'} · 원문 전체`,'current-source');raw.className='task-source';
  for(const source of local){raw.append(tag(sourceName[source.kind]),node('p',dateLabel(source.at),'source-meta'));if(source.replyTo)raw.append(node('p',`앞선 질문: ${source.replyTo}`,'hint'));raw.append(node('div',returned?reportBody(source):source.text,'source-raw'),node('p',source.id,'source-id'));}
  if(t.resultFile)raw.append(rawFileDetails(t.resultFile.rawText,t.resultFile.returnId,'current-result-raw'));
  const end=node('div','','work-source-end');
  end.append(node('span',`여기까지 원문 · 작업 ${pad(project.tasks.indexOf(t)+1)} · ${owner?.name??'영역 미지정'}${returned?' · 앱 미검증':''}${route==='example'?' · 예제 · 저장 안 됨':''}`,'hint'),
    btn('원문 접기',()=>{raw.open=false;raw.querySelector('summary')!.focus({preventScroll:true});raw.scrollIntoView({block:'nearest'});},'quiet','current-source-close'));
  const back=originButton('work-source-return');if(back)end.append(back);
  raw.append(end);box.append(line,raw);
  return box;
}
function renderWork(t:Task|null) {
  captureWorkReferenceReading();if(!t||workReference&&!referenceMatches(t,workReference))workReference=null;
  // WORK41: the work card is the screen's centre: what is edited, the text itself and its copy/save, in that order. The goal,
  // request, conditions and reports that were repeated above it are one disclosure in the context section below.
  const area=$('work');area.replaceChildren();$('empty').hidden=!!t;if(!t)return;
  const w=currentWork(project,t),v=w.values,card=node('div','','card work-card work-focus');card.id='current-work';card.tabIndex=-1;
  const owner=areaById(areaOf(project,t)),receipt=receiptOf(t);
  const heading=node('div','','work-heading'),jumps=node('div','','work-jumps');jumps.id='work-context-jumps';jumps.dataset.taskId=t.id;
  jumps.append(Object.assign(node('span',`작업 ${pad(project.tasks.findIndex(x=>x.id===t.id)+1)} · ${owner?.name??'영역 미지정'}`,'work-jumps-label'),{title:owner?.name??''}),
    btn('다음 행동 고치기',()=>jumpWorkControl(t.id,'next'),'quiet','work-edit-next'),
    btn('파일 결과용 작업문으로',()=>jumpWorkControl(t.id,'file'),'quiet','work-file-handoff'));
  const origin=tag(workOrigin(t),'purple');origin.id='work-authorship';
  const h=node('div','','work-title');h.append(node('h2',receipt!==null?'후속 확인 작업문 초안':'이어갈 작업'),jumps);heading.append(h,origin);card.append(heading);
  card.append(workSource(t));
  const banner=node('p','','alert warning');banner.id='stale-advice';card.append(banner);showStaleNotice(banner,t,w);
  if(project.sources.some(s=>t.sourceIds.includes(s.id)&&s.kind==='test_answer'))card.append(node('p','합성 시험 입력입니다. 실제 사용자 요구나 기존 확정 기준을 바꾸지 않습니다.','alert warning'));
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
  // The text and its actions together: copy/save sit directly above the editor whose first field is the work text itself.
  const actions=node('div','','next-actions');actions.id='next-actions';
  const row=node('div','','actions work-actions');
  const retry=btn('이 입력 다시 정리',()=>{void generate(t.id);},'quiet','retry-work');retry.dataset.aiAction='true';
  row.append(btn('작업문 복사',()=>{void exportWork(t.id,'clipboard');},'primary','copy-work'),btn('Markdown 저장',()=>{void exportWork(t.id,'download');},'secondary','download-work'),retry,
    btn('전달할 작업문 전체 보기',()=>{const d=$<HTMLDetailsElement>('handoff-preview');d.open=true;d.scrollIntoView({block:'nearest'});$('handoff-text').focus({preventScroll:true});},'quiet','next-preview'));
  if(questionApplicability(project,t)==='active')row.prepend(btn('질문에 답하기',()=>{$('question-box').scrollIntoView({block:'center'});$('answer-draft')?.focus({preventScroll:true});},'primary','next-answer'));
  const author=tag(workAuthor(t,v.next));author.id='instruction-author';row.append(author);
  actions.append(row);
  const next=node('div','','handoff-ready');next.id='handoff-ready';
  const exported=t.handoffs.at(-1),nextText=node('div');nextText.append(node('strong','작업 결과를 받으셨나요?'),node('p',exported?`${dateLabel(exported.at)} · ${exported.method==='clipboard'?'복사':'파일 저장'} 기록이 있어요. 개발 도구에 전달됐는지, 실행됐는지는 이 앱이 알 수 없어요.`:'작업문을 전달한 도구에서 받은 내용을 그대로 가져오세요.'));
  next.append(nextText,btn('결과 붙여넣기',()=>openComposer('report'),'primary','bring-report'));actions.append(next);
  card.append(actions);
  const edit=details('작업문 편집 · 범위 · 완료 조건','edit-work');edit.className='edit-area work-reference-editor';edit.open=true;
  const layout=node('div','','work-edit-layout'),fields=node('div','','work-edit-fields');fields.id='work-edit-fields';fields.dataset.taskId=t.id;
  layout.append(fields,workReferenceReader(t));edit.append(layout);
  for(const [key,label] of [['next','실행 도구에 전달할 작업문'],['scope','이번 범위와 유지할 것'],['checks','확인할 동작 / 완료 조건'],['understanding','짧은 이해']] as const) {
    const l=node('label',label);l.htmlFor=`work-${key}`;const field=node('textarea');field.id=`work-${key}`;field.rows=key==='next'?9:2;field.maxLength=6000;field.value=v[key];
    if(key==='next')field.placeholder='원문과 현재 기준은 전체 인계 문맥에 들어가요. 실행 도구가 할 일을 여기에 직접 적을 수 있어요.';
    field.addEventListener('input',()=>guard(()=>{commit(editTask(project,t.id,key,field.value),false);const marker=$(`manual-${key}`);marker.textContent='직접 수정 · AI가 덮어쓰지 않음';refreshPreview();}));
    const old=t.manual[key]===null&&w.aiStale?t.advice?.[key]??'':'';
    const marker=node('p',t.manual[key]!==null?'직접 수정 · AI가 덮어쓰지 않음':old?'이전 AI 문구는 작업문에서 제외됨 · 직접 쓰면 그대로 들어갑니다':'제안 · 실제 실행 결과 아님','manual-note');marker.id=`manual-${key}`;fields.append(l,field,marker);
    if(old){const d=details('제외된 이전 AI 문구 보기 (현재 작업문 아님)',`stale-${key}`);d.append(node('div',old,'source-raw'),btn('이 문구로 시작해 직접 고치기',()=>commit(editTask(project,t.id,key,old)),'quiet',`stale-use-${key}`));fields.append(d);}
  }
  const suggestions=taskSuggestions(t);
  for(const [index,s] of suggestions.entries()) {
    const box=node('div','','suggestion');box.append(tag(w.aiStale&&t.suggestions===null?'이전 제안 · 작업문 제외 · 고치면 포함':'추가 제안 · 미확정'));
    for(const key of ['text','why'] as const){const l=node('label',key==='text'?'제안 문구':'이유와 대가');const f=node('textarea');f.rows=2;f.maxLength=2000;f.id=`suggestion-${index}-${key}`;l.htmlFor=f.id;f.value=s[key];f.addEventListener('input',()=>guard(()=>{commit(editSuggestion(project,t.id,index,key,f.value),false);refreshPreview();}));box.append(l,f);}
    box.append(btn('이 제안을 내 기준으로 기록',()=>{const value=taskSuggestions(taskOf(project,t.id))[index];if(value)commit(recordBasis(project,value.text));},'secondary'));fields.append(box);
  }
  fields.append(node('p','여기를 고쳐도 다른 기준·원문은 변하지 않습니다. AI 재정리 후에도 직접 쓴 값은 유지됩니다. 작업문에 코드 파일은 포함되지 않고, 복사·저장은 자동 실행이 아닙니다.','hint'));
  card.append(edit);
  const more=node('div','','work-more');
  const fileOptions=details('결과를 파일로 받기 · 선택','file-return-options');fileOptions.className='file-return-options';
  fileOptions.append(node('p','외부 도구에 결과 JSON 한 개 생성을 요청합니다. 짧은 보고나 웹 전용 작업은 기존 붙여넣기가 더 간단할 수 있어요.','hint'));
  const fileActions=node('div','','actions');fileActions.append(btn('파일 결과용 작업문 복사',()=>{void exportWork(t.id,'clipboard',true);},'secondary','copy-file-work'),btn('파일 결과용 Markdown 저장',()=>{void exportWork(t.id,'download',true);},'quiet','download-file-work'));fileOptions.append(fileActions);
  fileOptions.append(node('p','같은 작업에서 받은 결과 JSON은 ‘결과 파일로 가져오기’에서 선택하세요. 실행 권한은 늘어나지 않으며, 파일 생성 금지와 충돌하면 일반 보고로 반환합니다.','hint'));
  if(lastFileExport?.taskId===t.id){const sent=details('이 탭에서 마지막으로 내보낸 파일용 전문','file-handoff-preview'),field=node('textarea');field.readOnly=true;field.rows=8;field.className='export-preview';field.value=lastFileExport.text;sent.append(field);fileOptions.append(sent);}
  const preview=details('실제로 전달할 전체 문맥 보기','handoff-preview');const txt=node('textarea');txt.id='handoff-text';txt.readOnly=true;txt.rows=14;txt.className='export-preview';
  try{txt.value=handoffText(project,t.id);}catch{txt.value='문맥 크기 또는 데이터 오류로 자동 인계를 만들지 못했습니다. 복구 파일로 원문을 보존하세요.';}
  preview.append(node('p','관련 입력 + 직전 작업 + 모든 보존 기준. AI가 관련으로 고르지 않은 기준도 뒤에 남습니다.','hint'),txt);
  // The optional file-return choice stays a folded line in the action row, as on the first prepared screen before (BLANK21).
  actions.append(fileOptions);more.append(backgroundPreview(t),preview);card.append(more);area.append(card);
}
/** FLOW091-C: which plan copy goes out with this task. Fixed at the request; later plan edits are not applied to it. */
/** PC12: the task reading screen shows the same copy under its own id (id); only the work card keeps its open state across views. */
function backgroundPreview(t:Task,id='background-preview'):HTMLElement {
  const b=t.background,own=!isReturnTask(project,t),box=details('',id);box.className='background-preview';
  const summary=box.querySelector('summary')!;
  if(id==='background-preview'){box.open=backgroundOpen===t.id;box.addEventListener('toggle',()=>{backgroundOpen=box.open?t.id:null;});}
  if(!b){summary.textContent='작업문에 넣을 프로젝트 배경 · 이 작업에는 없음';
    box.append(node('p','이 작업에는 저장된 배경 사본이 없어요(배경을 저장하기 전에 쓴 작업이거나, 사본 없이 내보낸 작업에 돌아온 결과). 지금 전체 공간의 구상을 소급해 넣지 않아요.','hint'));return box;}
  if(b.brief===null&&b.area===null){summary.textContent='작업문에 넣을 프로젝트 배경 · 요청 당시 저장된 구상 없음';
    box.append(node('p','요청을 쓸 때 프로젝트 목적도, 대상 영역도 없었어요. 작업문에 배경 부분을 넣지 않아요.','hint'));return box;}
  summary.textContent=`작업문에 넣을 프로젝트 배경·영역 구상 보기 · r${b.revision} 사본`;
  box.append(node('p',`${own?'이 작업의 요청을 쓸 때':'이 보고가 돌아간 작업의 요청을 쓸 때'} 고정한 사본이에요. 작업문에 ‘이번 요청 범위와 구분’된 배경으로 들어가며, 지시나 확정 기준이 아니에요.`,'hint'));
  if(b.brief!==null)box.append(node('p','프로젝트 목적 원문','source-meta'),node('div',b.brief,'source-raw'));
  if(b.area){box.append(node('p',`요청 대상 영역 · ${b.area.name}`,'source-meta'));if(b.area.note!==null)box.append(node('div',b.area.note,'source-raw'));}
  const area=b.area?project.space.areas.find(a=>a.id===b.area!.id):undefined;
  const changed=(project.space.brief?.text??null)!==b.brief||(!!b.area&&(!area||area.name!==b.area.name||(area.note||null)!==b.area.note));
  if(changed)summary.append(node('span',' · 그 뒤 구상이 바뀜 (이 사본은 그대로)','background-changed-tag'));
  if(changed){const line=node('p','전체 공간의 목적이나 이 영역의 이름·구상이 그 뒤 바뀌었어요. 이미 준비된 이 작업의 사본은 그대로이고, 다음에 쓰는 새 요청부터 최신 구상이 들어가요.','hint');line.id=id==='background-preview'?'background-changed':`${id}-changed`;box.append(line);}
  return box;
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
  $('work-authorship').textContent=workOrigin(t);
  $('instruction-author').textContent=workAuthor(t,v.next);
  if($('stale-advice'))showStaleNotice($('stale-advice'),t,w);
  refreshWorkReference();
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
/** HOME15: what a card says. Name and the user's own purpose (space.brief) first; a request is never shown as the purpose.
 * The time is lastActivity: request/result originals and work-text exports only, so it is not called 'last edit'. */
const ACTIVITY_SCOPE='요청·가져온 결과 원문과 작업문 복사·저장 시각 기준이에요. 이름·목적·영역 수정은 포함하지 않아요.';
function projectSummary(li:HTMLElement,info:Project,open:(()=>void)|null,label:string,openClass='project-open') {
  const head=node('div','','project-card-head'),mark=node('span',[...info.name.trim()][0]??'·','project-mark');mark.setAttribute('aria-hidden','true');
  // The name is the card's one open control (Enter/Space); the rest of the card opens on click. No control inside another.
  const name=open?btn(info.name,open,`${openClass} project-card-name`):node('strong',info.name,'project-card-name');
  name.title=info.name;if(open)name.setAttribute('aria-label',`${info.name} · ${label}`);
  head.append(mark,name);li.append(head);
  const brief=info.space.brief?.text.trim();
  const purpose=node('p',brief??'목적을 아직 적지 않았어요','project-card-purpose');purpose.classList.toggle('missing',!brief);if(brief)purpose.title=brief;
  li.append(purpose);
  const meta=node('p','','project-card-meta'),at=lastActivity(info),areas=info.space.areas.filter(a=>!a.archived).length;
  const time=node('span',at?`작업 기록 · ${dateLabel(at)}`:'작업 기록 없음','project-card-time');time.title=ACTIVITY_SCOPE;meta.append(time);
  if(areas)meta.append(node('span',`영역 ${areas}개`,'project-card-areas'));
  li.append(meta);
}
/** SPATIAL102: a card opens when its body is clicked, like the space cards. Its own buttons (and selecting text) do not.
 * HOME15: neither does anything inside a part marked data-no-open (the card's '더보기' menu). */
function openOnClick(card:HTMLElement,open:()=>void) {
  card.classList.add('openable');
  card.addEventListener('click',e=>{if((e.target as HTMLElement).closest('button,a,input,select,textarea,summary,[data-no-open]'))return;if(window.getSelection()?.toString())return;guard(open);});
}
/** HOME15: the card's secondary actions, apart from opening it. A disclosure, so the menu is never inside the open control. */
function cardMenu(name:string,...items:HTMLButtonElement[]):HTMLDetailsElement {
  const menu=node('details','','project-more');menu.dataset.noOpen='';
  const summary=node('summary','','project-more-button');summary.setAttribute('aria-label',`‘${name}’ 더보기`);summary.title='더보기';
  summary.append(node('span','⋯','project-more-dots'));summary.firstElementChild!.setAttribute('aria-hidden','true');
  const list=node('div','','project-more-menu');list.append(...items);menu.append(summary,list);
  // A chosen (or declined) action closes the menu and leaves the focus on its button, never on the card's open control.
  for(const item of items)item.addEventListener('click',()=>{menu.open=false;if(summary.isConnected&&!$<HTMLDialogElement>('project-read').open)summary.focus({preventScroll:true});});
  menu.addEventListener('toggle',()=>{if(menu.open)for(const other of document.querySelectorAll<HTMLDetailsElement>('.project-more[open]'))if(other!==menu)other.open=false;});
  return menu;
}
/** HOME15 follow-up: the full name and purpose before entering, read-only. Text only (never parsed as HTML), never saved.
 * It shows the saved project read fresh at the moment it opens; one that another tab trashed or removed is not shown. */
let reading:{kind:'home';entryId:string;y:number}|{kind:'map';caller:string;y:number}|null=null;
function readProject(entryId:string) {
  const fresh=workspace.read()?.entries.find(e=>e.entryId===entryId&&e.state==='active');
  if(!fresh){listNotice='다른 탭에서 바뀌어 이 프로젝트를 보여주지 않았어요. 목록을 새로 읽었어요.';render();focusListCard(null);return;}
  const brief=fresh.project.space.brief?.text.trim();
  $('project-read-name').textContent=fresh.project.name;
  const purpose=$('project-read-purpose');purpose.textContent=brief||'목적을 아직 적지 않았어요';purpose.classList.toggle('missing',!brief);
  reading={kind:'home',entryId,y:window.scrollY};
  $('project-read-note').textContent='읽기만 해요. 프로젝트를 열거나 바꾸지 않아요.';
  // Order: close the card menu first, then open the window, so the menu neither keeps the first Escape nor takes the focus back.
  for(const m of document.querySelectorAll<HTMLDetailsElement>('.project-more[open]'))m.open=false;
  const dialog=$<HTMLDialogElement>('project-read');dialog.showModal();
  const body=$('project-read-body');body.scrollTop=0; // after showModal: a closed dialog is not laid out, so its old scroll would survive
  // Focus starts at the top of the text (the name), so PageDown/End/arrow keys scroll it at once; Tab reaches '닫기'.
  body.focus({preventScroll:true});
}
/** A bounded read of the current project's text; an unsubmitted purpose editor remains a separate draft. */
function readMapPurpose() {
  $('project-read-name').textContent=project.name;
  const purpose=$('project-read-purpose'),brief=project.space.brief?.text??'';purpose.textContent=brief||'목적을 아직 적지 않았어요';purpose.classList.toggle('missing',!brief);
  $('project-read-note').textContent='현재 프로젝트의 이름과 목적을 읽어요. ‘목적 고치기’에 작성 중인 초안은 바꾸지 않아요.';
  reading={kind:'map',caller:'brief-read',y:window.scrollY};
  $<HTMLDialogElement>('project-read').showModal();const body=$('project-read-body');body.scrollTop=0;body.focus({preventScroll:true});
}
/** Back to the same card's '더보기' button and the same list position; nothing in the dialog is kept. */
function closeReading() {
  const back=reading;reading=null;
  $('project-read-name').textContent='';$('project-read-purpose').textContent='';
  if(!back)return;window.scrollTo({top:back.y});
  if(back.kind==='map'){document.getElementById(back.caller)?.focus({preventScroll:true});return;}
  const more=document.querySelector<HTMLElement>(`#project-list .project-card[data-entry-id="${CSS.escape(back.entryId)}"] .project-more-button`);
  if(more)more.focus({preventScroll:true});else $('projects-title').focus({preventScroll:true});
}
/** HOME15: where the list was when a project was opened from it, so coming back finds the same card. Tab memory only. */
let listReturn:{entryId:string;y:number}|null=null;
function projectCard(entry:WorkspaceEntry):HTMLElement {
  const li=node('li','','project-card');li.dataset.entryId=entry.entryId;
  if(entry.state==='trashed') {
    projectSummary(li,entry.project,null,'');li.querySelector('.project-card-name')!.append(' ',tag('휴지통'));
    const row=node('div','','row project-card-actions');row.append(btn('되살리기',()=>void restoreProject(entry.entryId),'secondary project-restore'));li.append(row);
    return li;
  }
  const open=()=>{const fresh=workspace.read()?.entries.find(e=>e.entryId===entry.entryId&&e.state==='active');
    if(!fresh){listNotice='다른 탭에서 바뀌어 이 프로젝트를 열지 않았어요. 목록을 새로 읽었어요.';render();return;}
    listReturn={entryId:entry.entryId,y:window.scrollY};
    openEntry(fresh,true);render();restoreDraftPanels();window.scrollTo({top:0});
    if(!(view==='space'&&focusFirst('space-title')))$('main').focus({preventScroll:true});};
  projectSummary(li,entry.project,open,hasSpace(entry.project)?'프로젝트 공간 열기':'프로젝트 열기');
  li.querySelector('.project-card-head')!.append(cardMenu(entry.project.name,btn('이름·목적 전체 보기',()=>readProject(entry.entryId),'quiet project-read-open'),btn('휴지통으로 옮기기',()=>void trashProject(entry.entryId,entry.project.name),'quiet project-trash')));
  openOnClick(li,open);return li;
}
function legacyCard():HTMLElement {
  const legacy=workspace.legacy!,li=node('li','','project-card legacy-card');li.dataset.entryId='legacy';
  const open=()=>{listReturn={entryId:'legacy',y:window.scrollY};openLegacy();render();restoreDraftPanels();};
  if(legacy.project){projectSummary(li,legacy.project,open,'읽기 전용으로 열기');li.querySelector('.project-card-head')!.append(tag('이전 저장 · 읽기 전용'));}
  else {li.append(node('strong','읽지 못한 이전 저장 내용','project-card-name'));const row=node('div','','row project-card-actions');row.append(btn('열어 보기',open,'secondary project-open'));li.append(row);}
  li.append(node('p','이전 형식으로 이 브라우저에 남아 있는 내용이에요. 지우거나 덮어쓰지 않았고, 새 저장 형식으로 옮기지 않아 여기서는 저장되지 않아요.','hint project-card-note'));
  openOnClick(li,open);return li;
}
function renderProjects() {
  workspace.read();const list=$('project-list'),trash=$('trash-list');list.replaceChildren();trash.replaceChildren();
  const entries=workspace.entries(),active=entries.filter(e=>e.state==='active'),trashed=entries.filter(e=>e.state==='trashed');
  for(const e of [...active].sort((a,b)=>(lastActivity(b.project)??'').localeCompare(lastActivity(a.project)??'')))list.append(projectCard(e));
  if(workspace.legacy)list.append(legacyCard());
  $('example-list').replaceChildren(exampleCard());
  // An empty list and a list that could not be read are different situations.
  // VISUAL42: an empty list is one compact start group: a short title and line, then two aligned start rows (a new project,
  // the unsaved example), with restoring a backup as the secondary action below. '새 프로젝트' in the header stays the same path.
  const empty=!active.length&&!workspace.legacy&&!workspace.readError;$('projects-view').classList.toggle('empty-home',empty);
  if(empty){
    const title=node('li','','start-heading');title.append(node('h2','첫 프로젝트 시작하기'));
    const row=node('li','','start-row'),start=btn('',()=>$('new-project').click(),'start-option','start-new-project');
    start.disabled=!workspace.writable;start.setAttribute('aria-label','새 프로젝트 만들기');
    const text=node('span','','start-text');text.append(node('strong','새 프로젝트'),node('span','무엇을 만들지 적고, 영역으로 나눠 첫 작업문을 준비해요.'));
    start.append(node('span','','start-icon'),text);
    row.append(start);
    list.append(title,node('li','아직 프로젝트가 없어요. ‘새 프로젝트’로 바로 시작하거나 아래에서 예제를 둘러보세요.','hint project-empty'),row);
  }
  $('projects-count').textContent=active.length?String(active.length):'';
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
  // HOME15: the project being left (however it was reached) is the card to come back to.
  const left=route==='project'?target.kind==='entry'?target.ref.entryId:target.kind==='legacy'?'legacy':null:null;
  resetEphemeral();route='projects';listNotice=message;if(!message)undoEntry=null;rememberOpen(null);render();focusListCard(left);
}
function focusListCard(entryId:string|null) {
  const back=listReturn&&listReturn.entryId===entryId?listReturn:null;listReturn=null;
  const card=entryId?document.querySelector<HTMLElement>(`#project-list .project-card[data-entry-id="${CSS.escape(entryId)}"]`):null;
  const control=card?.querySelector<HTMLElement>('.project-open')??null;
  if(!control){window.scrollTo({top:0});$('projects-title').focus();return;}
  window.scrollTo({top:back?.y??0});control.focus({preventScroll:true});
  const r=card!.getBoundingClientRect();if(r.top<0||r.bottom>window.innerHeight)card!.scrollIntoView({block:'nearest'});
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
 * ENTRY37: a purpose, two top parts (one with two inner parts) and one request in an inner part, handed off and answered
 * by a written sample report through the normal result-file path. Nothing here is a real run or a real user's record.
 * Starting my own project from it starts empty: nothing from the sample becomes my record or result. */
function exampleProject():Project {
  let p=rename(createProject(),'예제 · 동네 미용실 예약');
  p=setBrief(p,'동네 미용실 손님이 휴대폰으로 날짜와 시간을 골라 예약하고, 예약이 확정되면 문자로 안내받는 사이트.');
  p=addArea(p,'예약하기','손님이 시술과 날짜·시간을 고르고 예약을 확정한다.');const book=p.space.areas.at(-1)!.id;
  p=addArea(p,'알림','예약 확정과 변경을 손님에게 문자로 알린다.');const notify=p.space.areas.at(-1)!.id;
  p=addChildArea(p,book,'시간 고르기','영업시간 안의 빈 시간만 고를 수 있게 보여 준다.');const slots=p.space.areas.at(-1)!.id;
  p=addChildArea(p,book,'예약 확인','고른 시술·날짜·시간을 다시 보여 주고 확정 버튼을 둔다.');
  p=addRelation(p,book,notify,'flow','예약이 확정되면 알림을 보낸다.');
  p=submit(editDraft(p,'예약 화면에서 영업시간 안의 빈 시간만 고를 수 있게 해 주세요. 이미 예약된 시간은 흐리게 보여 주세요.'),undefined,slots);
  const started=begin(p,p.currentTaskId!),request=validateRequest(started.request);
  p=receive(started.project,started.request,{mode:'mock',ticket:request.ticket,advice:validateAdvice(mockAdvice(request),request.bases.map(b=>b.id))});
  const task=p.currentTaskId!,returnId=`H_${crypto.randomUUID()}`,anchor=exportAnchor(p,taskOf(p,task));
  p=markHandoff(p,task,handoffText(p,task,returnId),'clipboard',p.revision,returnId,anchor);
  const summary='영업시간 안의 빈 시간만 목록에 보여 주고, 이미 예약된 시간은 흐리게 표시한다. 휴무일은 아직 따로 다루지 않는다.';
  p=importResultFile(p,JSON.stringify({schemaVersion:'agentflow.return.2',projectId:p.id,taskId:task,returnId,
    report:'예제 보고 · 실제로 실행한 결과가 아니에요.\n빈 시간 목록을 영업시간 기준으로 거르고, 예약된 시간은 흐리게 표시했어요. 휴무일 처리는 아직 하지 않았어요.',evidence:null,
    understanding:{version:'understanding.1',areaId:slots,basedOn:anchor?.understanding??null,summary,changes:['예약된 시간은 고를 수 없게 흐리게 표시한다.'],proposal:null,origin:'예제 · 직접 쓴 보고'}}));
  return {...p,notice:null};
}
let exampleInfo:Project|null=null;
/** ENTRY37: the home's way into the sample, apart from the real list (own list and classes; same card reading order). */
function exampleCard():HTMLElement {
  const li=node('li','','example-card');
  try {exampleInfo??=exampleProject();} catch {li.append(node('p','예제를 준비하지 못했어요.','hint project-card-note'));return li;}
  const open=()=>void openExample();
  projectSummary(li,exampleInfo,open,'공간 예제 열기 · 저장 안 됨','example-open');
  // The name already says 예제; the meta line says what it is not (no head tag, so the name keeps its full width).
  li.querySelector('.project-card-time')!.textContent='저장 안 됨 · 실제 실행 아님';
  openOnClick(li,open);return li;
}
async function openExample() {
  if(!await leaveProject('예제로 가면'))return;
  resetEphemeral();route='example';target={kind:'example'};storageError='';memoryDirty=false;hasSaved=false;contextOpen=false;
  try {project=exampleProject();} catch {project=createProject();}
  // ENTRY37: the sample opens at its whole space, like a project card does.
  view=hasSpace(project)?'space':'work';
  rememberOpen(null);render();window.scrollTo({top:0});$<HTMLDetailsElement>('compose-panel').open=!project.tasks.length;
  if(!(view==='space'&&focusFirst('space-title')))$('main').focus({preventScroll:true});
}
function closeExample(start:boolean) {
  // ENTRY37: closing goes back to the home; only a browser that cannot save at all keeps the in-memory start as before.
  const home=workspace.writable||workspace.entries().length||workspace.legacy||workspace.readError;
  if(start||!home){startNew();render();restoreDraftPanels();focusNewStart();}
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
const pad=(n:number)=>String(n).padStart(2,'0');
/** FLOW091: a returned report task is stored under its original task. Index of that task (-1 if none), or null when t is not a return. */
function receiptOf(t:Task):number|null {return isReturnTask(project,t)?project.tasks.findIndex(x=>x.id===t.parentTaskId):null;}
function appTag():HTMLElement {const el=tag('앱에서 이어갈 작업','purple');el.title='이 앱에서 열어 둔 작업이에요. 외부 도구의 실시간 실행 상태가 아니에요.';return el;}
function noNote():HTMLElement {const el=tag('구상 미기재','area-undecided');el.title='설명이 비어 있어요. 아이디어도, 아직 못 정한 점도 적을 수 있어요.';return el;}
const READING_LABEL:Record<ReadingReason,string>={'open-question':'답변 기록 없는 현재 질문',held:'설명 보류',stale:'이전 기준 설명',updated:'이번 탭 설명 갱신'};
function areaSummary(a:Area):string {
  const tasks=areaRequests(a.id),results=tasks.flatMap(returnsOf).length;
  return tasks.length?`요청 ${tasks.length}개${results?` · 돌아온 결과 ${results}개 · 앱 미검증`:''}`:'아직 요청 없음';
}
const scaleLabel=(s:number)=>s>=0.01?`${Math.round(s*100)}%`:'<1%';
function applyView(plane:HTMLElement){if(mapView){plane.style.transform=`translate(${mapView.x}px,${mapView.y}px) scale(${mapView.s})`;fitReading(plane);}markOffscreen(plane);}
/** WORK41 (Q13 B): below 100% the names, ideas and reading reasons keep a readable screen size (up to READ_MAX of their plane
 * size) while the cards, their positions, the lines and the structure stay exactly as they are. A card whose text would not fit
 * its fixed footprint first shortens or leaves out its idea on the card (the whole idea is in the panel), then takes a smaller
 * boost; a name is never cut. View-only: nothing is stored, and the zoom never folds, unfolds or regroups anything. */
const READ_MAX=1.6;
/** The end kept whole: the last two words (more when they are very short; the last six characters when they are long or there
 * are no spaces), where sibling names usually differ. */
function nameEnd(full:string):string {
  const words=full.trim().split(/\s+/);let n=Math.min(2,words.length),end=words.slice(-n).join(' ');
  while(end.length<4&&n<words.length){n++;end=words.slice(-n).join(' ');}
  // A name without usable spaces (or with very long last words) keeps a fixed number of its last characters.
  return end.length>16?full.trim().slice(-6):end;
}
function shortenName(name:HTMLElement,full:string,over:()=>boolean,card:HTMLElement) {
  const end=nameEnd(full),room=full.length-end.length;if(room<6)return;
  const sep=full.trim().endsWith(` ${end}`)?' … ':'…';
  for(let head=room-3;head>=4;head-=3){name.textContent=`${full.slice(0,head).trimEnd()}${sep}${end}`;if(!over())break;}
  card.dataset.cut='1';name.title=full;
}
function fitReading(plane:HTMLElement) {
  const s=mapView?.s??1,want=Math.min(READ_MAX,Math.max(1,1/s)),key=`${want}`;
  const cards=[...plane.querySelectorAll<HTMLElement>('.area-node')];
  if(plane.dataset.read===key&&cards.every(c=>c.dataset.readFor===key))return;
  plane.dataset.read=key;plane.style.setProperty('--read',String(want));
  const label=document.getElementById('map-read');if(label)label.hidden=want===1;
  for(const card of cards){
    card.dataset.readFor=key;card.style.removeProperty('--read');delete card.dataset.note;delete card.dataset.cut;
    const pick=card.querySelector<HTMLElement>('.node-select'),name=card.querySelector<HTMLElement>('.area-card-name');if(!pick||!name)continue;
    const full=name.dataset.full??name.textContent??'';name.dataset.full=full;name.textContent=full;name.removeAttribute('title');
    // Overflow by layout boxes (scrollHeight rounds to whole pixels and can hide a part-line cut at the bottom).
    const over=()=>{const pr=pick.getBoundingClientRect();return pick.scrollHeight>pick.clientHeight+1||[...pick.children].some(c=>c instanceof HTMLElement&&getComputedStyle(c).display!=='none'&&c.getBoundingClientRect().bottom>pr.bottom+0.25);};
    // The name comes first: a long idea gives way (fewer lines, then left to the panel, where it is whole).
    for(const lines of ['2','1','hidden']){if(!over())break;card.dataset.note=lines;}
    // A name still too long for a readable size keeps its start and its distinguishing end ('… 예약 취소'); only the middle
    // gives way. The whole name is the panel title, the button's label and this element's title.
    if(over())shortenName(name,full,over,card);
    let r=want;while(over()&&r>1){r=Math.max(1,Math.round((r-0.05)*100)/100);card.style.setProperty('--read',String(r));}
  }
}
/** FLOW091: counts cards not fully inside the visible map. Only tells; moving the view is the user's 'fit'. */
function markOffscreen(plane:HTMLElement) {
  const map=plane.parentElement,chip=map?.querySelector<HTMLButtonElement>('#map-offscreen');if(!map||!chip||!mapView)return;
  const v=mapView,W=map.clientWidth,H=map.clientHeight;let out=0;
  for(const el of plane.querySelectorAll<HTMLElement>('.area-node')) {
    const x=el.offsetLeft*v.s+v.x,y=el.offsetTop*v.s+v.y,off=x<0||y<0||x+el.offsetWidth*v.s>W||y+el.offsetHeight*v.s>H;
    el.classList.toggle('offscreen',off);if(off)out++;
  }
  chip.hidden=!out;chip.textContent=`화면 밖 영역 ${out}개 · 모두 보기`;
}
/** Fit changes only the viewport; stored positions stay as they are. */
function fitView(map:HTMLElement,active:Area[]):MapView {
  // Measured card sizes (long names/notes make cards taller), in plane units.
  const boxes=active.map(a=>{const pt=areaPosition(project,a),el=map.querySelector<HTMLElement>(`.area-node[data-area-id="${a.id}"]`);
    return {x:pt.x,y:pt.y,w:el?.offsetWidth||NODE_W,h:el?.offsetHeight||MAP_CARD_HEIGHT};});
  const controls=map.querySelector<HTMLElement>('.map-controls'),margin=24;
  // PC controls remain inside the map. Reserve only their measured top band beyond the existing fit margin.
  const top=innerWidth>760&&controls?Math.max(0,controls.offsetTop+controls.offsetHeight+8-margin):0;
  const fitted=fitViewport(map.clientWidth||800,Math.max(1,(map.clientHeight||480)-top),boxes,margin);
  return {...fitted,y:fitted.y+top};
}
function finishInitialMapFit() {
  if(!initialMapFitPending)return;
  // A recalled/user/return viewport always wins. Only a genuinely missing initial viewport is fitted here.
  if(mapView){initialMapFitPending=false;return;}
  if(route==='projects'||view!=='space')return;
  const map=document.getElementById('space-map'),plane=document.getElementById('space-plane');
  if(!map||!plane||!map.clientWidth||!map.clientHeight)return;
  mapView=fitView(map,visibleAreas(project,collapsed));initialMapFitPending=false;applyView(plane);$('map-scale').textContent=scaleLabel(mapView.s);rememberMap();
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
/** Only the branch-record close path: focus a control at a visible, unobscured point inside the map. */
function focusBranchRecordControl(id:string):boolean {
  const el=document.getElementById(id),map=document.getElementById('space-map');
  if(!el||!map?.contains(el)||!el.checkVisibility({visibilityProperty:true}))return false;
  const r=el.getBoundingClientRect(),m=map.getBoundingClientRect(),sx=m.width/(map.offsetWidth||1),sy=m.height/(map.offsetHeight||1);
  const left=Math.max(0,r.left,m.left+map.clientLeft*sx),top=Math.max(0,r.top,m.top+map.clientTop*sy);
  const right=Math.min(innerWidth,r.right,m.left+(map.clientLeft+map.clientWidth)*sx),bottom=Math.min(innerHeight,r.bottom,m.top+(map.clientTop+map.clientHeight)*sy);
  if(right<=left||bottom<=top)return false;
  const hit=document.elementFromPoint((left+right)/2,(top+bottom)/2);if(!hit||!el.contains(hit))return false;
  el.focus({preventScroll:true});return document.activeElement===el;
}
function openBranchRecords(id:string) {
  const a=areaById(id);if(!a||a.archived||view!=='space')return;
  const page={x:window.scrollX,y:window.scrollY};
  capturePanelReading();
  if(located&&(located.origin.view==='work'||located.origin.panel==='records')&&located.area!==id)endRecordsExcursion();
  branchRecordCaller={project:project.id,epoch:projectEpoch,area:id,id:`branch-records-${id}`};
  mapSelected=id;sheetOpen=true;panelMode='area';rememberMap();render(true,true,()=>window.scrollTo({left:page.x,top:page.y}));
  // The explicit record entry wins only after render has restored the old panel reading.
  const body=document.getElementById('area-panel-body'),box=document.getElementById(`subtree-records-${id}`) as HTMLDetailsElement|null;
  const summary=document.getElementById(`subtree-records-heading-${id}`);
  if(body?.dataset.areaId===id&&box&&summary&&body.contains(box)){
    box.open=true;summary.focus({preventScroll:true});
    body.scrollTop+=summary.getBoundingClientRect().top-body.getBoundingClientRect().top;
    capturePanelReading(summary.id);rememberMap();
  }
}
/** WORK41: select a part from its card (or a neighbour link in the panel). Only the tab's view changes: the selection, the
 * open panel and, when the panel would hide it, a pan (never a zoom or a fit) that keeps the card and, if they fit, its
 * parent, children and related parts in sight. */
function selectArea(id:string) {
  const a=areaById(id);if(!a||a.archived)return;
  branchRecordCaller=null;capturePanelReading();
  if(located&&(located.origin.view==='work'||located.origin.panel==='records')&&located.area!==id)endRecordsExcursion();
  for(const p of areaPath(project,id).slice(0,-1))collapsed.delete(p.id);
  mapSelected=id;sheetOpen=true;panelMode='area';rememberMap();render();
  if(innerWidth>760)revealNeighbours(id);
  rememberMap();$(`node-info-${id}`)?.focus({preventScroll:true});
}
function neighbourIds(id:string):string[] {
  const parent=project.space.containment.parents[id]??null,own=new Set([id,...descendantAreas(project,id).map(x=>x.id)]);
  const rel=project.space.relations.flatMap(r=>own.has(r.from)?[r.to]:own.has(r.to)?[r.from]:[]);
  return [...new Set([...(parent?[parent]:[]),...childrenOf(project,id).map(x=>x.id),...rel].map(x=>visibleRepresentative(project,x,collapsed)).filter((x):x is string=>!!x&&x!==id))];
}
function revealNeighbours(id:string) {
  const map=document.getElementById('space-map'),plane=document.getElementById('space-plane');if(!map||!plane||!mapView)return;
  const box=(x:string)=>{const el=plane.querySelector<HTMLElement>(`.area-node[data-area-id="${x}"]`);return el?{l:el.offsetLeft,t:el.offsetTop,r:el.offsetLeft+el.offsetWidth,b:el.offsetTop+el.offsetHeight}:null;};
  const own=box(id);if(!own)return;
  const v=mapView,pad=16,controls=map.querySelector<HTMLElement>('.map-controls'),top=controls?controls.offsetTop+controls.offsetHeight+8:pad;
  const W=map.clientWidth,H=map.clientHeight;
  // The largest set (the card first, then each neighbour) whose box fits the visible map at the current scale.
  let want=own;
  for(const n of neighbourIds(id)){const b=box(n);if(!b)continue;const u={l:Math.min(want.l,b.l),t:Math.min(want.t,b.t),r:Math.max(want.r,b.r),b:Math.max(want.b,b.b)};
    if((u.r-u.l)*v.s<=W-2*pad&&(u.b-u.t)*v.s<=H-top-pad)want=u;}
  const shift=(lo:number,hi:number,min:number,max:number)=>hi-lo>max-min?min-lo:lo<min?min-lo:hi>max?max-hi:0;
  const dx=shift(want.l*v.s+v.x,want.r*v.s+v.x,pad,W-pad),dy=shift(want.t*v.s+v.y,want.b*v.s+v.y,top,H-pad);
  if(dx||dy){const to={x:v.x+dx,y:v.y+dy,s:v.s};autoPan={from:autoPan&&sameView(autoPan.to,v)?autoPan.from:{...v},to};mapView={...to};applyView(plane);}
}
function areaNode(a:Area,plane:HTMLElement,redraw:()=>void):HTMLElement {
  const pt=areaPosition(project,a),el=node('div','','area-node');el.dataset.areaId=a.id;
  el.style.left=`${pt.x}px`;el.style.top=`${pt.y}px`;el.classList.toggle('selected',mapSelected===a.id);
  const handle=node('button','⠿','node-handle');handle.type='button';handle.id=`node-move-${a.id}`;
  handle.setAttribute('aria-label',`${a.name} 위치 이동 (끌기 또는 방향키)`);handle.title='끌어서 위치 이동 · 방향키로도 옮길 수 있어요';
  // WORK41: the card body selects the part: its meaning, place, records and work open in the side panel, and the map stays.
  // Selecting changes no project data and never the work being continued. Going one structure level in is the explicit
  // '열기' in the card's bottom row (the former card-body click keeps its id and label), so the zoom and the structure depth never share a gesture.
  // The selection button keeps the id of the former '정보' button it replaces.
  const pick=node('button','','node-select');pick.type='button';pick.id=`node-info-${a.id}`;pick.setAttribute('aria-pressed',String(mapSelected===a.id));
  pick.setAttribute('aria-label',`${a.name} 선택 · 옆에 이 부분의 맥락 보기 (들어가지 않음)`);
  pick.append(node('strong',a.name,'area-card-name'),node('span',areaPath(project,a.id).length>1?`소속 · ${areaPath(project,a.id).slice(0,-1).map(x=>x.name).join(' › ')}`:'독립 영역','area-card-path'),a.note?node('span',a.note,'area-card-note'):noNote());
  pick.addEventListener('click',()=>guard(()=>selectArea(a.id)));
  el.classList.toggle('located',located?.area===a.id&&view==='space');
  const enter=node('button','열기','quiet node-enter');enter.type='button';enter.id=`node-enter-${a.id}`;
  enter.setAttribute('aria-label',`${a.name} 영역 열기`);enter.title='이 부분의 요청과 작업 화면으로 들어가요 (구조 한 단계 안)';
  enter.addEventListener('click',()=>guard(()=>openArea(a.id)));
  el.append(handle,pick);
  const children=childrenOf(project,a.id).filter(x=>!x.archived),reading=readingReasons(project,a.id,receivedAreas);
  // MAP36: why reading this part's records may help (presence only; the counts and texts are in the same owner's records reader).
  if(reading.records){const parent=children.length>0,said=reading.reasons.map(r=>READING_LABEL[r]);
    const text=parent?(said.length?['하위 포함',...said]:['하위 포함 기록 읽기']):(said.length?said:['기록 읽기']);
    const signal=btn('',()=>openBranchRecords(a.id),'branch-signals',`branch-records-${a.id}`);
    text.forEach((t,i)=>{if(i)signal.append(' ');signal.append(node('span',i<text.length-1?`${t} ·`:t));});
    signal.title=text.join(' · ');signal.setAttribute('aria-label',`${a.name} · ${text.join(' · ')} · ${parent?'이 부분과 하위 기록 읽기':'이 부분 기록 읽기'}`);
    signal.setAttribute('aria-controls','area-panel-body');el.append(signal);}
  const foot=node('div','','area-node-foot');
  if(children.length){const folded=collapsed.has(a.id),toggle=btn(folded?`하위 ${descendantAreas(project,a.id).filter(x=>!x.archived).length}개 펼치기`:'하위 접기',()=>toggleBranch(a.id),'quiet branch-toggle',`branch-toggle-${a.id}`);
    toggle.setAttribute('aria-expanded',String(!folded));foot.append(toggle);}
  if(areaRequests(a.id).some(currentGroup))foot.append(appTag());
  foot.append(enter);el.append(foot);
  // Dragging uses only the handle (outside the enter button); a drag never ends as a click on enter or information.
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
function toggleBranch(id:string) {
  capturePanelReading();if(collapsed.has(id))collapsed.delete(id);else {collapsed.add(id);if(mapSelected&&descendantAreas(project,id).some(a=>a.id===mapSelected)){mapSelected=id;sheetOpen=true;}}
  rememberMap();render();$(`branch-toggle-${id}`)?.focus({preventScroll:true});
}
/** Boundaries are derived view geometry. A boundary that would enclose/cross an unrelated card is omitted;
 * explicit parent paths and thin parent-child links remain, rather than inventing membership by rectangle. */
function drawContainment(layer:HTMLElement,plane:HTMLElement) {
  layer.replaceChildren();
  const cards=[...plane.querySelectorAll<HTMLElement>('.area-node')].map(el=>({el,id:el.dataset.areaId!,x:el.offsetLeft,y:el.offsetTop,w:el.offsetWidth,h:el.offsetHeight}));
  const overlap=(a:{x:number;y:number;w:number;h:number},b:{x:number;y:number;w:number;h:number})=>a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h;
  const headers:{x:number;y:number;w:number;h:number}[]=[];
  for(const parent of visibleAreas(project,collapsed)) {
    const children=childrenOf(project,parent.id).filter(a=>cards.some(c=>c.id===a.id));if(!children.length||collapsed.has(parent.id))continue;
    const members=new Set([parent.id,...descendantAreas(project,parent.id).map(a=>a.id)]),inside=cards.filter(c=>members.has(c.id));
    const x=Math.min(...inside.map(c=>c.x))-14,y=Math.min(...inside.map(c=>c.y))-14,right=Math.max(...inside.map(c=>c.x+c.w))+14,bottom=Math.max(...inside.map(c=>c.y+c.h))+14;
    const box={x,y,w:right-x,h:bottom-y},ambiguous=cards.some(c=>!members.has(c.id)&&overlap(box,c));
    const marker=node('div','','containment-group');marker.dataset.parentId=parent.id;marker.dataset.frameOmitted=String(ambiguous);
    if(!ambiguous) {
      const frame=node('div','','containment-frame');Object.assign(frame.style,{left:`${x}px`,top:`${y}px`,width:`${box.w}px`,height:`${box.h}px`});marker.append(frame);
      const width=240;let titleBox={x,y:y-30,w:width,h:26};
      while(cards.some(c=>overlap(titleBox,c))||headers.some(h=>overlap(titleBox,h)))titleBox={...titleBox,y:titleBox.y-30};
      headers.push(titleBox);const label=btn(`${parent.name} 안의 부분 · 접기`,()=>toggleBranch(parent.id),'containment-title',`frame-toggle-${parent.id}`);
      label.title=areaPath(project,parent.id).map(a=>a.name).join(' › ');Object.assign(label.style,{left:`${titleBox.x}px`,top:`${titleBox.y}px`,width:`${width}px`});marker.append(label);
    } else {
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','containment-links');
      const p=cards.find(c=>c.id===parent.id)!;
      for(const a of children){const c=cards.find(c=>c.id===a.id)!,line=document.createElementNS('http://www.w3.org/2000/svg','line');
        for(const [k,v] of [['x1',p.x+p.w/2],['y1',p.y+p.h/2],['x2',c.x+c.w/2],['y2',c.y+c.h/2]] as const)line.setAttribute(k,String(v));svg.append(line);}
      marker.append(svg);
    }
    layer.append(marker);
  }
}
function sizeWorkspace() {
  const layout=document.querySelector<HTMLElement>('.map-layout');if(!layout)return;
  const map=document.getElementById('space-map');
  // WORK41: measured from the layout's place in the document, not in the window, so the page scroll (a wheel, a restored
  // return) never changes the map height; content above it (a notice, the purpose row) and the window size still do.
  if(innerWidth>760){const top=layout.getBoundingClientRect().top+window.scrollY;layout.style.height=`${Math.max(240,innerHeight-Math.max(0,top)-16)}px`;if(map){map.style.height='100%';map.style.minHeight='0';}}
  else {layout.style.removeProperty('height');map?.style.removeProperty('height');map?.style.removeProperty('min-height');}
}
window.addEventListener('resize',()=>{capturePanelReading();syncProjectHeader();sizeWorkspace();restorePanelReading();});
document.addEventListener('toggle',e=>{if(e.target instanceof HTMLDetailsElement&&e.target.closest('#space-view')&&!e.target.closest('#area-panel'))sizeWorkspace();},true);
function openRelations(from='map-relations-open') {branchRecordCaller=null;capturePanelReading();relationCaller=from;panelMode='relations';rememberMap();render();$('area-panel-body')?.focus({preventScroll:true});}
function relationBrowser():HTMLElement {
  const panel=node('aside','','area-panel relation-panel sheet-open');panel.id='area-panel';panel.dataset.panelMode='relations';panel.setAttribute('aria-label','연결의 실제 부분과 기록 읽기');
  const close=()=>{capturePanelReading();panelMode='area';rememberMap();render();(document.getElementById(relationCaller)??$('map-relations-open'))?.focus({preventScroll:true});};
  const head=node('div','','panel-top');head.append(node('strong',`연결 ${project.space.relations.length}건`),btn('닫기',close,'quiet','area-panel-close'));
  const body=node('div','','panel-body');body.id='area-panel-body';body.dataset.areaId='@relations';body.dataset.projectId=project.id;body.tabIndex=0;body.setAttribute('role','region');body.setAttribute('aria-label','연결과 소유 기록 읽기');
  body.addEventListener('scroll',()=>{capturePanelReading();rememberMap();},{passive:true});body.addEventListener('toggle',()=>{capturePanelReading();rememberMap();},true);
  body.addEventListener('wheel',e=>{e.stopPropagation();if(e.deltaY<0&&body.scrollTop<=0||e.deltaY>0&&body.scrollTop+body.clientHeight>=body.scrollHeight-1)e.preventDefault();},{passive:false});
  panel.addEventListener('keydown',e=>{if(e.key!=='Escape'||e.defaultPrevented||e.isComposing||e.keyCode===229||(e.target as HTMLElement).closest('input,textarea,select,[contenteditable="true"],[role="combobox"]'))return;e.preventDefault();e.stopPropagation();close();});
  body.addEventListener('keydown',e=>{if(e.defaultPrevented||e.isComposing||e.target!==body)return;
    if(['ArrowDown','ArrowUp','PageDown','PageUp',' ','Home','End'].includes(e.key)){e.preventDefault();body.scrollTop=e.key==='Home'?0:e.key==='End'?body.scrollHeight:body.scrollTop+(e.key==='ArrowDown'?40:e.key==='ArrowUp'?-40:e.key==='PageUp'||e.key===' '&&e.shiftKey?-body.clientHeight*.8:body.clientHeight*.8);}});
  const list=node('section','','map-relation-list');list.id='map-relation-list';
  list.append(node('p','화살표는 실제 관계, 점선은 포함이에요. 접힌 부분의 연결도 실제 출발·도착 부분으로 찾아갈 수 있어요.','hint'));
  for(const [i,b] of bundleRelations(project,collapsed).entries()) {
    const group=node('section','','relation-bundle');group.dataset.from=b.from;group.dataset.to=b.to;group.dataset.kind=b.kind;
    group.append(node('p',`${areaById(b.from)?.name} ${b.internal?'안의 연결':'→ '+(areaById(b.to)?.name??'')} · ${RELATION_LABEL[b.kind]} · ${b.relations.length}건`,'source-meta'),
      node('p',`직접 연결 ${b.directIds.length} · 접힌 안쪽 연결 ${b.hiddenIds.length}`,'hint'));
    for(const r of b.relations){const row=node('div','','relation-endpoints');row.dataset.relationId=r.id;
      row.append(btn(areaById(r.from)?.name??'출발 부분',()=>showReceivedArea(r.from,`relation-from-${r.id}`,true),'quiet',`relation-from-${r.id}`),node('span','→'),
        btn(areaById(r.to)?.name??'도착 부분',()=>showReceivedArea(r.to,`relation-to-${r.id}`,true),'quiet',`relation-to-${r.id}`),node('span',`${RELATION_LABEL[r.kind]}${r.note?` · ${r.note}`:''}`,'hint'));
      for(const [owner,label] of [[r.from,'출발 기록'],[r.to,'도착 기록']] as const)row.append(btn(label,()=>{const el=$(`relation-owner-${owner}`);body.scrollTop+=el.getBoundingClientRect().top-body.getBoundingClientRect().top;el.focus({preventScroll:true});},'quiet'));
      group.append(row);}
    group.id=`relation-bundle-${i}`;list.append(group);
  }
  const owners=[...new Set(project.space.relations.flatMap(r=>[r.from,r.to]))],records=node('section','','relation-owner-records');
  records.append(node('h3','실제 부분에 남은 기록'),node('p','각 소유 부분을 한 번씩 표시해요. 질문 기록은 새로운 미결이나 개발 완료 수가 아니에요.','hint'));
  for(const id of owners){const signal=subtreeSignals(project,id).find(s=>s.areaId===id),owner=areaById(id);if(!signal||!owner)continue;
    const row=node('section','','relation-owner');row.id=`relation-owner-${id}`;row.dataset.ownerArea=id;row.tabIndex=-1;
    row.append(node('h4',owner.name),node('p',`기록된 질문 ${signal.questions.length} · 후속 작업문 없는 보고 ${signal.reports.length}`,'hint'),
      node('p',`${signal.description.current?.valid?'현재 설명 있음':signal.description.current?'이전 기준 설명 있음':'현재 설명 없음'} · 보류 ${signal.description.held.length}건`,'hint'),
      btn('소유 부분과 설명 찾기',()=>showReceivedArea(id,`relation-owner-find-${id}`,true),'quiet',`relation-owner-find-${id}`));
    for(const q of signal.questions)row.append(node('p',`${q.answered?'질문에 답변 기록 있음':'질문에 답변 기록 없음'} · ${q.status}`,'hint'),btn('질문 기록 읽기',()=>openTaskView(q.taskId,null,`relation-question-${q.taskId}`),'quiet',`relation-question-${q.taskId}`));
    for(const report of signal.reports)row.append(btn('보고 기록 읽기',()=>openTaskView(report.taskId,report.returnId,`relation-report-${report.returnId}`),'quiet',`relation-report-${report.returnId}`));records.append(row);
  }
  body.append(list,records);const actions=node('div','','panel-actions');actions.id='panel-actions';actions.append(btn('지도에서 계속 보기',close,'secondary','relations-close'));
  panel.append(head,body,actions);return panel;
}
const RELATION_HINT:Record<RelationKind,string>={flow:'이어서 사용(기능 흐름)',needs:'먼저 필요(기능 의존)',shares:'같은 요구 공유',related:'관련(참고)'};
/** Read-only lines: what the user wrote about how areas relate. Not run order, messages or progress. */
function drawRelations(svg:SVGSVGElement,labels:HTMLElement,plane:HTMLElement) {
  const center=(id:string)=>{const el=plane.querySelector<HTMLElement>(`.area-node[data-area-id="${id}"]`);if(!el)return null;
    return {x:el.offsetLeft+el.offsetWidth/2,y:el.offsetTop+el.offsetHeight/2,w:el.offsetWidth,h:el.offsetHeight};};
  svg.replaceChildren();labels.replaceChildren();
  const chips=new Map<string,{from:string;to:string;count:number}>();
  for(const r of bundleRelations(project,collapsed)) {
    if(r.internal)continue;
    const a=center(r.from),b=center(r.to);if(!a||!b)continue;
    const line=document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('data-from',r.from);line.setAttribute('data-to',r.to);line.setAttribute('data-kind',r.kind);
    const edge=(p:typeof a,q:typeof b)=>{const dx=q.x-p.x,dy=q.y-p.y,t=Math.min(dx?((p.w/2+8)/Math.abs(dx)):Infinity,dy?((p.h/2+8)/Math.abs(dy)):Infinity);return {x:p.x+dx*Math.min(t,.49),y:p.y+dy*Math.min(t,.49)};};
    const start=edge(a,b),end=edge(b,a);
    for(const [k,v] of [['x1',start.x],['y1',start.y],['x2',end.x],['y2',end.y]] as const)line.setAttribute(k,String(v));
    line.setAttribute('class',`relation-line ${r.kind}`);line.setAttribute('marker-end','url(#relation-end)');svg.append(line);
    const key=[r.from,r.to].sort().join(':');const old=chips.get(key);if(old)old.count+=r.relations.length;else chips.set(key,{from:r.from,to:r.to,count:r.relations.length});
  }
  const occupied:{x:number;y:number}[]=[];
  const cardBoxes=[...plane.querySelectorAll<HTMLElement>('.area-node')].map(e=>({x:e.offsetLeft,y:e.offsetTop,w:e.offsetWidth,h:e.offsetHeight}));
  for(const [i,r] of [...chips.values()].entries()) {
    const a=center(r.from)!,b=center(r.to)!;const x=(a.x+b.x)/2;let y=(a.y+b.y)/2;
    let conflict;while((conflict=cardBoxes.find(c=>x+55>c.x&&x-55<c.x+c.w&&y+12>c.y&&y-12<c.y+c.h))||occupied.some(c=>Math.abs(c.x-x)<110&&Math.abs(c.y-y)<28))y=conflict?conflict.y+conflict.h+16:y+28;occupied.push({x,y});
    const id=`relation-chip-${i}`,chip=btn(`연결 ${r.count}건`,()=>openRelations(id),'relation-chip',id);chip.title='방향·종류와 실제 부분은 연결 목록에서 읽기';
    chip.style.left=`${x}px`;chip.style.top=`${y}px`;labels.append(chip);
  }
}
function renderMap(root:HTMLElement,active:Area[],extra:HTMLElement[]=[]) {
  if(panelMode!=='records')recordsReturnNotice='';
  const shown=visibleAreas(project,collapsed);
  const section=node('section','','area-map');section.setAttribute('aria-label','영역 지도');
  const bar=node('div','','map-toolbar');bar.append(node('h2','영역'));
  // PC13: adding an area is an explicit disclosure. It starts open when there is no area yet or an unsent name/idea is kept.
  const addPanel=details('영역 추가','area-add-panel');addPanel.classList.add('toolbar-disclosure');
  addPanel.open=!active.length||!!(spaceInputs[`${project.id}:area-name`]||spaceInputs[`${project.id}:area-note`]);
  const add=node('form','','area-add');add.id='area-add-form';add.setAttribute('aria-label','영역 추가');
  const name=spaceInput(node('input'),'area-name');name.maxLength=60;name.placeholder='영역 이름 (예: 예약)';name.setAttribute('aria-label','영역 이름');
  const note=spaceInput(node('input'),'area-note');note.maxLength=2000;note.placeholder='한 줄 구상 · 아이디어나 아직 못 정한 점 (선택)';note.setAttribute('aria-label','영역 설명');
  const submitArea=node('button','추가','secondary');submitArea.type='submit';submitArea.id='area-add';add.append(name,note,submitArea);
  addPanel.append(add);bar.append(addPanel,...extra);
  bar.append(btn(`연결 ${project.space.relations.length}건`,()=>openRelations(),'quiet','map-relations-open'));
  const areaTab=btn('선택 부분',()=>{branchRecordCaller=null;capturePanelReading();panelMode='area';sheetOpen=true;rememberMap();render();$('area-panel-body')?.focus({preventScroll:true});},'quiet','map-area-open');
  areaTab.disabled=!mapSelected;bar.append(areaTab);
  for(const [id,mode] of [['check-summary','records'],['map-relations-open','relations'],['map-area-open','area']] as const)bar.querySelector(`#${id}`)?.setAttribute('aria-pressed',String(panelMode===mode));
  const unplaced=areaRequests(null);
  if(unplaced.length){const b=btn(`영역 미지정 작업 · 요청 ${unplaced.length}개`,()=>openArea('unassigned'),'quiet','open-unplaced');bar.append(b);}
  section.append(bar);
  if(active.length)section.append(areaList(active));
  const layout=node('div','','map-layout'),map=node('div','','space-map');map.id='space-map';
  map.setAttribute('aria-label','영역 지도 · 빈 곳을 끌어 이동, 카드 오른쪽 위 손잡이를 끌어 위치 이동');
  const plane=node('div','','space-plane');plane.id='space-plane';
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','relation-layer');svg.setAttribute('aria-hidden','true');
  const defs=document.createElementNS('http://www.w3.org/2000/svg','defs');defs.innerHTML='<marker id="relation-end" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z"/></marker>';
  const lines=document.createElementNS('http://www.w3.org/2000/svg','g');svg.append(defs,lines);
  const labels=node('div','','relation-labels');
  const containment=node('div','','containment-layer');containment.id='containment-layer';
  plane.append(containment,svg,labels);const redraw=()=>{drawRelations(lines as unknown as SVGSVGElement,labels,plane);drawContainment(containment,plane);};
  for(const a of shown)plane.append(areaNode(a,plane,redraw));
  map.append(plane);
  if(!active.length)map.append(node('p','아직 영역이 없어요. 위에서 큰 덩어리부터 추가해 보세요. 설명에는 아이디어도, 아직 못 정한 점도 적을 수 있고 비워 둬도 돼요.','map-empty hint'));
  const controls=node('div','','map-controls');
  const scale=node('span','','map-scale');scale.id='map-scale';
  const read=node('span','글자 보정','map-read');read.id='map-read';read.hidden=true;read.title='축소해도 이름·구상·읽을 이유는 읽을 크기로 보여요. 카드 크기·배치·연결과 구조는 그대로예요.';
  controls.append(btn('－',()=>zoom(map,plane,1/1.25),'quiet map-zoom-out','map-zoom-out'),scale,read,btn('＋',()=>zoom(map,plane,1.25),'quiet map-zoom-in','map-zoom-in'),
    btn('전체 맞춤',()=>{mapView=fitView(map,shown);applyView(plane);rememberMap();scale.textContent=scaleLabel(mapView.s);},'quiet','map-fit'));
  const last=posUndo.at(-1);
  if(last)controls.append(btn(`위치 되돌리기 · ${areaById(last.id)?.name??''}`,undoPosition,'quiet','map-undo'));
  const offscreen=btn('',()=>$('map-fit').click(),'secondary map-offscreen','map-offscreen');offscreen.hidden=true;map.append(offscreen);
  // FLOW091: after returning from an area the mobile sheet is closed; unsaved settings stay and can be reopened.
  const sel0=mapSelected?areaById(mapSelected):null;
  if(sel0&&!sel0.archived&&!sheetOpen&&panelDirty(sel0))map.append(btn(`작성 중인 ‘${sel0.name}’ 설정 다시 열기`,()=>{sheetOpen=true;render();$('panel-name')?.focus({preventScroll:true});},'secondary sheet-reopen','map-sheet-reopen'));
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
  if(panelMode==='records')layout.append(recordsBrowser());else if(panelMode==='relations')layout.append(relationBrowser());else if(sel&&!sel.archived)layout.append(areaPanel(sel));
  section.append(layout);root.append(section);sizeWorkspace();
  if(!mapView)initialMapFitPending=true;
  applyView(plane);scale.textContent=scaleLabel(mapView?.s??1);redraw();
  add.addEventListener('submit',e=>{e.preventDefault();if(!name.value.trim())return;
    // Place the new area where the user is looking (free slot nearest to the map centre).
    const v=mapView??{x:0,y:0,s:1},near={x:(map.clientWidth/2-v.x)/v.s-NODE_W/2,y:(map.clientHeight/2-v.y)/v.s-NODE_H/2};
    guard(()=>{commit(addArea(project,name.value,note.value,near));const created=project.space.areas.at(-1)!;clearInputs('area-name','area-note');
      // Keep the new area in sight: move only the viewport when its slot is outside the visible map.
      const pt=areaPosition(project,created),w=$('space-map').clientWidth,h=$('space-map').clientHeight,s=v.s,sx=pt.x*s+v.x,sy=pt.y*s+v.y;
      if(sx<0||sy<0||sx+NODE_W*s>w||sy+NODE_H*s>h)mapView={x:w/2-(pt.x+NODE_W/2)*s,y:h/2-(pt.y+NODE_H/2)*s,s};
      mapSelected=created.id;rememberMap();render();$('area-name').focus();});});
}
/** FLOW091: unsaved name/idea edits of an area (shared by the panel and the area screen's edit form). */
function panelDirty(a:Area):boolean {
  const n=spaceInputs[`${project.id}:area-edit-name:${a.id}`],d=spaceInputs[`${project.id}:area-edit-note:${a.id}`];
  return (n!==undefined&&n!==a.name)||(d!==undefined&&d!==a.note);
}
/** FLOW091: the same areas as the map, by the same IDs, as a plain list zoom never shrinks (shown on narrow screens). */
function areaList(active:Area[]):HTMLElement {
  const box=details(`영역 목록 ${active.length}개 · 지도 확대와 상관없이 열기`,'area-list');box.className='area-list';
  box.open=areaListOpen??active.length<=5;box.addEventListener('toggle',()=>{areaListOpen=box.open;});
  for(const a of active) {
    const row=node('div','','area-list-row');row.dataset.areaId=a.id;row.classList.toggle('selected',mapSelected===a.id);
    // SPATIAL102: same contract as the map card: the row enters, '정보' selects (opens the properties sheet).
    const enter=btn('',()=>openArea(a.id),'quiet area-list-enter',`list-enter-${a.id}`);
    enter.append(node('strong',`${a.name} ↘`),node('span',a.note?shortText(a.note,40):'구상 미기재','hint'));
    if(areaRequests(a.id).some(currentGroup))enter.append(appTag());
    const info=btn('정보',()=>{branchRecordCaller=null;capturePanelReading();if(located&&(located.origin.view==='work'||located.origin.panel==='records')&&located.area!==a.id)endRecordsExcursion();mapSelected=a.id;sheetOpen=true;panelMode='area';rememberMap();render();},'secondary area-list-info',`list-info-${a.id}`);
    info.setAttribute('aria-pressed',String(mapSelected===a.id));info.setAttribute('aria-label',`${a.name} 정보 (들어가지 않음)`);
    row.append(enter,info);box.append(row);
  }
  return box;
}
/** PC12: a user's idea longer than this is shown as its opening words, with the whole text one click away. */
const NOTE_SHORT=160;
/** The user's own idea for an area, read first: an excerpt says so and links the whole text; an empty idea stays empty. */
function areaIdea(a:Area,id:string,limit=NOTE_SHORT,label='사용자 구상'):HTMLElement {
  const box=node('section','','area-idea');box.id=id;box.append(node('p',label,'source-meta'));
  if(!a.note){box.append(noNote(),node('p','비어 있어요. 아이디어도, 아직 못 정한 점도 직접 적을 수 있어요.','hint'));return box;}
  if(a.note.length<=limit){box.append(node('p',a.note,'area-idea-text'));return box;}
  const full=details(`구상 전체 보기 · 위는 앞부분 · ${a.note.length}자`,`${id}-full`);full.append(node('div',a.note,'source-raw'));
  box.append(node('p',shortText(a.note,limit),'area-idea-text'),full);return box;
}
const PANEL_TASKS=5;
/** AREA17: the work view line for the result file just imported in this tab: which area's description it was, and the explicit
 * location action. Not a count, not 'since the last visit'. */
function receiptLine():HTMLElement|null {
  const r=receivedReceiptTarget(),u=r?returnUnderstanding(project,r.report.id):null,a=u?.areaId?areaById(u.areaId):null;if(!r||!a||!u)return null;
  const box=node('section','','outcome-received');box.id='outcome-received-area';
  box.dataset.reportTaskId=r.report.id;
  box.append(node('p',u.entry?.held?`받은 결과의 영역 설명 · ‘${a.name}’ · 현재 설명에는 반영하지 않았어요`:`받은 결과로 ‘${a.name}’의 현재 설명이 바뀌었어요 · 앱 미검증`,'hint'));
  if(!a.archived)box.append(btn('지도에서 이 부분 보기',()=>{if(receivedReceiptTarget()?.report.id===r.report.id)showReceivedArea(a.id,'result-show-area');},'secondary','result-show-area'));
  return box;
}
/** AREA17: explicit 'where is it'. Opens the whole space with this area selected and its panel open, and moves only the map
 * viewport (the smallest pan; a zoom-out only when the card is larger than the free part) so the card is inside the part of
 * the map the panel and tools do not cover. Never a whole-map fit. Stored
 * positions and other areas never move, and receiving a description never does this. The view before it is kept: '← 위치 찾기
 * 전 보기로' brings back its layer, viewport, selection, panel, open disclosures, scroll and focus. */
function showReceivedArea(id:string,from:string|null=null,keepScale=false) {
  const a=areaById(id);if(!a||a.archived)return;
  if(!located) {
    if(origin){located={area:id,origin:structuredClone(origin)};}
    else if(view==='space'||view==='area')markOrigin(from);
    else {
      // From the work (or task) screen the starting point is the whole space as this tab would show it.
      origin=null;leaveLayer();view='space';viewArea=null;viewTask=null;viewReturn=null;render();window.scrollTo({top:layerMemo.space??0});markOrigin(null);
    }
    if(!located&&origin)located={area:id,origin:structuredClone(origin)};
  } else located.area=id;
  for(const a of areaPath(project,id).slice(0,-1))collapsed.delete(a.id);
  origin=null;leaveLayer();view='space';viewArea=null;viewTask=null;viewReturn=null;mapSelected=id;sheetOpen=true;panelMode='area';render();
  revealCard(id,keepScale);rememberMap();const line=locatedLine();if(line)document.getElementById('located-note')?.replaceWith(line);
  const card=document.querySelector<HTMLElement>(`.area-node[data-area-id="${id}"]`);
  if(card){const r=card.getBoundingClientRect(),note=document.getElementById('located-note'),top=(note??$('space-map')).getBoundingClientRect().top;
    // Page scroll (never the map's own box): the card in the window, with the line that offers the way back above it when both fit.
    if(r.top<0||r.bottom>innerHeight||top<0)window.scrollBy({top:r.bottom-top<=innerHeight-16?top-8:r.top-16});}
  const panel=$('area-panel');panel.tabIndex=-1;panel.focus({preventScroll:true});
}
/** The smallest viewport pan that puts the card inside the map part not covered by the panel (a sheet on narrow screens)
 * or the map tools. The scale stays unless the card cannot fit at it (then only as much zoom-out as it needs, around the
 * card). No stored position changes; the starting viewport is restored by the explicit return. */
function revealCard(id:string,keepScale=false) {
  const map=document.getElementById('space-map'),plane=document.getElementById('space-plane'),card=plane?.querySelector<HTMLElement>(`.area-node[data-area-id="${id}"]`);
  if(!map||!plane||!card||!mapView)return;
  const m=map.getBoundingClientRect();let free={left:0,top:0,right:map.clientWidth,bottom:map.clientHeight};
  for(const el of [document.getElementById('area-panel'),map.querySelector('.map-controls')]) {
    const r=el?.getBoundingClientRect();if(!r||!r.width||r.right<=m.left||r.left>=m.right||r.bottom<=m.top||r.top>=m.bottom)continue;
    const l=r.left-m.left,t=r.top-m.top,rr=r.right-m.left,b=r.bottom-m.top,f=free;
    // Drop the covered band on the side that keeps the largest free rectangle.
    free=[{...f,bottom:Math.min(f.bottom,t)},{...f,top:Math.max(f.top,b)},{...f,right:Math.min(f.right,l)},{...f,left:Math.max(f.left,rr)}]
      .reduce((x,y)=>(y.right-y.left)*(y.bottom-y.top)>(x.right-x.left)*(x.bottom-x.top)?y:x);
  }
  const pad=16,v0=mapView,cw=card.offsetWidth,ch=card.offsetHeight,cx=card.offsetLeft+cw/2,cy=card.offsetTop+ch/2;
  // Same scale unless the card cannot fit in the free part at it; then zoom out around the card only as far as it needs.
  const s=keepScale?v0.s:Math.max(FIT_MIN,Math.min(v0.s,(free.right-free.left-2*pad)/cw,(free.bottom-free.top-2*pad)/ch));
  const v={x:cx*v0.s+v0.x-cx*s,y:cy*v0.s+v0.y-cy*s,s},x=card.offsetLeft*s+v.x,y=card.offsetTop*s+v.y,w=cw*s,h=ch*s;
  const shift=(pos:number,size:number,lo:number,hi:number)=>size>hi-lo-2*pad?lo+pad-pos:pos<lo+pad?lo+pad-pos:pos+size>hi-pad?hi-pad-(pos+size):0;
  const dx=shift(x,w,free.left,free.right),dy=shift(y,h,free.top,free.bottom),scaled=s!==v0.s;
  if(dx||dy||scaled){mapView={x:v.x+dx,y:v.y+dy,s};applyView(plane);$('map-scale').textContent=scaleLabel(s);}
  if(located){located.moved=located.moved||!!(dx||dy)||scaled;located.scaled=located.scaled||scaled;}
}
function locatedLine():HTMLElement|null {
  const l=located;if(!l||l.origin.project!==project.id)return null;const a=areaById(l.area);if(!a||a.archived)return null;
  if(view==='area'&&viewArea===l.area){const box=node('div','','located-note');box.id='located-note';
    box.append(node('span','지도에서 위치를 찾아 연 영역이에요','hint'),btn(`← 위치 찾기 전 보기로 · ${originLabel(l.origin)}`,returnFromLocate,'secondary origin-return','locate-return'));return box;}
  if(view!=='space')return null;
  const box=node('div','','located-note');box.id='located-note';
  box.append(node('span',l.scaled?`‘${a.name}’ 카드가 다 보이도록 지도 보기를 옮기고 축소했어요 · 배치는 그대로예요`:l.moved?`‘${a.name}’ 카드가 보이도록 지도 보기만 옮겼어요 · 배치와 배율은 그대로예요`:`‘${a.name}’ 카드는 지금 지도에 보여요`,'hint'),
    btn(`← 위치 찾기 전 보기로 · ${originLabel(l.origin)}`,returnFromLocate,'secondary origin-return','locate-return'));
  return box;
}
const heldMessage:Record<string,string>={
  'no-anchor':'이전 인계에 설명 기준이 없어 현재 설명으로 쓰지 않았어요.',
  'area-moved':'인계 뒤 작업의 영역이 달라져 현재 설명으로 쓰지 않았어요.',
  'area-mismatch':'설명에 적힌 영역과 연결된 작업의 영역이 달라요.',
  'area-archived':'보관된 영역이라 현재 설명으로 쓰지 않았어요.',
  'file-basis':'파일의 설명 기준이 실제 인계 기록과 달라요.',
  'superseded':'그 뒤 설명이나 사용자 정정이 있어 이전 입력을 적용하지 않았어요.',
  'plan-changed':'인계 뒤 구상·조건·직접 쓴 작업문 또는 포함 맥락의 참고 기준이 바뀌어 적용하지 않았어요.'
};
/** Evidence opens here, without selecting a report or changing the work the user continues. */
function descriptionEvidence(d:DescriptionView,id:string):HTMLElement {
  const box=details('근거 보기',id);box.append(node('p',`${d.origin} · ${dateLabel(d.entry.at)} · 앱 미검증`,'hint'));
  if(d.returnTask){for(const sid of d.returnTask.sourceIds){const s=project.sources.find(x=>x.id===sid);if(s)box.append(node('p',sourceName[s.kind],'source-meta'),node('div',reportBody(s),'source-raw'));}
    if(d.returnTask.resultFile)box.append(rawFileDetails(d.returnTask.resultFile.rawText,d.returnTask.resultFile.returnId,`${id}-file`));
  }else box.append(node('p','사용자가 이전 설명을 직접 정정했어요. 이전 설명과 근거는 아래 기록에 남아요.','hint'));
  return box;
}
/** Current read-only comparison material, only inside the explicitly opened stale-description editor. */
function understandingReviewContext(a:Area,id:string):HTMLElement {
  const box=node('div'),context=details('현재 구상·조건 보기',`${id}-context`);
  context.append(node('p','현재 기록을 읽어 설명과 대조하세요. 앱이 차이의 의미를 판단하지 않아요.','hint'));
  if(project.space.brief)context.append(node('p','프로젝트 목적','source-meta'),node('div',project.space.brief.text,'source-raw'));
  for(const part of areaPath(project,a.id))context.append(node('p',`${part.id===a.id?'이 부분':'상위 부분의 참고 구상'} · ${part.name}`,'source-meta'),node('div',part.note||'아직 구상이 적혀 있지 않아요.','source-raw'));
  const ids=new Set(planStamp(project,a.id).decisions.map(x=>x.slice(0,x.lastIndexOf('@'))));
  for(const basis of project.bases.filter(b=>ids.has(b.id)))context.append(node('p',BASIS_LABEL[basis.status],'source-meta'),node('div',basis.text,'source-raw'));
  const work=details('관련 작업문 보기',`${id}-work`),related=understandingReviewWork(project,a.id);
  work.append(node('p','현재 작업문을 읽고 설명과 대조하세요.','hint'));
  for(const {task,changed} of related){
    const owner=areaById(areaOf(project,task)),place=owner?`부분 · ${owner.name}${owner.archived?' (보관됨)':''}`:'부분 미지정 · 함께 참고하는 작업';
    const row=related.length>1?details(`${taskTitle(project,task)} · ${place}`,`${id}-task-${task.id}`):node('section');row.dataset.taskId=task.id;row.dataset.changed=String(changed);
    if(related.length===1)row.append(node('p',taskTitle(project,task),'source-meta'),node('p',place,'hint'));
    const grid=node('dl','','review-grid task-context-grid');
    if(fieldRows(task,currentWork(project,task),grid,[['understanding','짧은 이해'],['scope','이번 범위와 유지할 것'],['next','실행 도구에 전달할 작업문'],['checks','확인할 동작 / 완료 조건']],null,`${id}-${task.id}`))row.append(grid);
    else row.append(node('p','아직 적힌 작업문이 없어요.','hint'));
    const correction=intentCorrection(task);
    if(correction)row.append(node('p','사용자 직접 정정한 작업 목적·유지 조건','source-meta'),node('div',correction.goal,'source-raw'),node('div',correction.conditions||'(조건을 직접 비워 둠)','source-raw'));
    work.append(row);
  }
  if(!related.length)work.append(node('p','관련된 직접 작성 작업문이 없어요.','hint'));
  box.append(context,work);return box;
}
/** AREA17 default reading: a short current description, the first key change and the one judgement it may need (an
 * unadopted proposal), each cut to its opening words; the whole description, every change, the proposal, its source, the
 * evidence, the earlier descriptions and the correction are one disclosure away. Nothing stored is cut or changed.
 * compact: the map's side panel and the task screen, where the user's idea and the requests share the space. */
function understandingPanel(a:Area,id:string,compact=false):HTMLElement|null {
  id=`${id}-${a.id}`; // Disclosure state belongs to this area, never to another selected area's panel.
  const state=areaDescription(project,a.id),d=state.current;
  // An area that never received an organised description shows nothing new (no empty-state line on every panel).
  if(!d&&!state.previous.length&&!state.held.length)return null;
  const box=node('section','','area-understanding');box.id=id;box.setAttribute('aria-label','영역 현재 설명');
  // The disclosures share one wrapping row of links; an opened one takes the whole width below the short reading.
  const more=node('div','','understanding-more');
  box.append(node('p',d?.entry.by==='user'?'전달 기록에서 정리한 설명 · 사용자 정정':'전달 기록에서 정리한 설명 · 앱 미검증','source-meta'));
  if(d?.valid){
    const [S,C,P]=compact?[80,50,40]:[160,90,80],first=d.changes[0];
    box.append(node('p',shortText(d.summary,S),'understanding-summary'));
    if(first)box.append(node('p',`달라진 점 · ${shortText(first,C)}`,'understanding-change'));
    if(d.proposal){const pr=node('p','','understanding-proposal');pr.append(node('strong','구상 변경 제안 · 미채택'),node('span',` ${shortText(d.proposal,P)}`));
      box.append(pr,node('p',compact?'사용자 구상은 그대로예요.':'사용자 구상은 그대로예요. 받아들일 때만 구상을 직접 고치세요.','hint'));}
    const cut=d.summary.length>S||d.changes.length>1||!!first&&first.length>C||!!d.proposal&&d.proposal.length>P;
    const full=details(cut?'설명 전체 보기':'정리한 곳 보기',`${id}-full`);
    if(cut){full.append(node('div',d.summary,'source-raw'));
      if(d.changes.length){const changes=node('ul','','understanding-changes');for(const text of d.changes)changes.append(node('li',text));full.append(node('p','직전 정리에서 달라진 점','source-meta'),changes);}
      if(d.proposal)full.append(node('p','구상 변경 제안 · 미채택 · 실행 지시 아님','source-meta'),node('div',d.proposal,'source-raw'));}
    full.append(node('p',`정리: ${d.origin} · 앱 미검증`,'hint'));more.append(full);
  }else box.append(node('p',d?'구상·조건·직접 쓴 작업문 또는 포함 맥락의 참고 기준이 바뀌어 이전 설명은 현재 설명으로 쓰지 않아요.':'아직 현재 설명은 없어요. 받은 정리는 아래 기록에 있어요.','hint'));
  if(d){more.append(descriptionEvidence(d,`${id}-evidence`));
    if(!a.archived){
      const key=`understanding-edit:${a.id}`,sessionKey=`${project.id}:${key}`,epoch=projectEpoch,owner=project.id;
      const edit=details(d.valid?'설명 오류 고치기':'현재 상황과 대조해 설명 고치기',`${id}-edit`);edit.open=understandingEdits.has(sessionKey);
      const field=spaceInput(node('textarea'),`${id}-text`,d.summary,key);field.rows=3;field.maxLength=2000;field.setAttribute('aria-label','영역 설명 정정');
      const warning=node('p','편집을 연 뒤 설명이나 구상·조건·작업문 등의 기준이 바뀌었어요. 초안은 남겼지만 저장하지 않아요. 취소한 뒤 최신 내용을 읽고 다시 열어 주세요.','alert warning');
      warning.id=`${id}-stale`;warning.setAttribute('role','status');
      const matches=()=>{const session=understandingEdits.get(sessionKey);return !!session&&owner===project.id&&epoch===projectEpoch&&session.epoch===projectEpoch&&understandingReviewMatches(project,a.id,session.token);};
      warning.hidden=!understandingEdits.has(sessionKey)||matches();
      // Only native summary activation starts a review. Render/restored disclosures and typing cannot refresh its token.
      edit.querySelector('summary')!.addEventListener('click',()=>{
        if(edit.open||understandingEdits.has(sessionKey)||!edit.isConnected||!edit.getClientRects().length||owner!==project.id||epoch!==projectEpoch)return;
        const token=beginUnderstandingReview(project,a.id);understandingEdits.set(sessionKey,{token,epoch});
        field.value=areaDescription(project,a.id).current!.summary;spaceInputs[sessionKey]=field.value;
      });
      edit.append(field,node('p','이전 설명은 남습니다. 작업문과 조건은 바뀌지 않으며, 앱이 사실을 검증한 것은 아닙니다.','hint'));
      if(!d.valid)edit.append(understandingReviewContext(a,`${id}-review`));
      const endEdit=()=>{
        edit.open=false;
        // Native toggle is asynchronous; the task reader must not restore the just-ended editor as still open.
        if(view==='task'&&readOpen?.task===viewTask&&readOpen.ret===viewReturn)readOpen.open[edit.id]=false;
        clearInputs(key);understandingEdits.delete(sessionKey);
      };
      edit.append(warning,btn(d.valid?'정정 저장':'현재 설명으로 기록',()=>{
        if(owner!==project.id||epoch!==projectEpoch||!edit.isConnected)return;
        if(!matches()){spaceInputs[sessionKey]=field.value;warning.hidden=false;return;}
        const n=recordUnderstandingReview(project,a.id,field.value,understandingEdits.get(sessionKey)!.token);
        endEdit();commit(n);
      },'secondary',`${id}-save`),btn('취소',()=>{
        if(owner!==project.id||epoch!==projectEpoch||!edit.isConnected)return;
        endEdit();render();
      },'quiet',`${id}-cancel`));more.append(edit);
    }
  }
  if(state.previous.length||state.held.length||d&&!d.valid){const history=details('이전 설명 · 반영하지 않은 정리',`${id}-history`);
    for(const old of [...(d&&!d.valid?[d]:[]),...state.previous,...state.held]){const row=node('section','','understanding-record');row.append(node('p',old.entry.held?heldMessage[old.entry.held]!:old===d?'구상·조건·직접 쓴 작업문 등의 이전 기준 설명 · 지금은 현재 설명이 아니에요':old.entry.by==='user'?'사용자 정정 기록':'이전 정리 설명','source-meta'),node('div',old.summary,'source-raw'),descriptionEvidence(old,`${id}-history-${old.returnTask?.id??old.entry.revision}`));if(old.proposal)row.append(node('p',`미채택 제안: ${old.proposal}`,'source-raw'));history.append(row);}more.append(history);
  }
  if(more.childElementCount)box.append(more);
  return box;
}
/** WORK41: where the selected part sits: its parent path, its children and the parts it is related to, each a selection. */
function panelPlace(a:Area):HTMLElement {
  const box=node('section','','panel-section');box.id='panel-place';box.append(node('h3','소속과 이웃','panel-section-title'));
  const path=areaPath(project,a.id).slice(0,-1),list=node('ul','','panel-neighbours');
  const go=(x:Area,label:string,id:string)=>{const li=node('li');li.append(node('span',label,'hint'),btn(x.name,()=>selectArea(x.id),'quiet panel-neighbour',id));list.append(li);};
  if(path.length){const parent=path.at(-1)!;go(parent,path.length>1?`소속 · ${path.slice(0,-1).map(x=>x.name).join(' › ')} ›`:'소속',`panel-parent-${parent.id}`);}
  else list.append(node('li','독립 부분 · 위에 속한 부분이 없어요','hint'));
  for(const c of childrenOf(project,a.id).filter(x=>!x.archived))go(c,'하위',`panel-child-${c.id}`);
  for(const r of project.space.relations.filter(r=>r.from===a.id||r.to===a.id)){
    const other=areaById(r.from===a.id?r.to:r.from);if(!other||other.archived)continue;
    go(other,`${r.from===a.id?'→':'←'} ${RELATION_LABEL[r.kind]}${r.note?` · ${shortText(r.note,40)}`:''}`,`panel-related-${r.id}`);}
  box.append(list);return box;
}
/** Short properties of the selected area, read first: name, the user's idea, and this area's requests for the user to pick.
 * Editing opens explicitly. No report is picked for the user; reports are read inside the task the user chose. */
function areaPanel(a:Area):HTMLElement {
  if(branchRecordCaller&&(branchRecordCaller.project!==project.id||branchRecordCaller.epoch!==projectEpoch||branchRecordCaller.area!==a.id))branchRecordCaller=null;
  const panel=node('aside','','area-panel');panel.id='area-panel';panel.dataset.panelMode='area';panel.setAttribute('aria-label',`${a.name} 속성`);panel.classList.toggle('sheet-open',sheetOpen);
  const close=()=>{capturePanelReading();const caller=branchRecordCaller;branchRecordCaller=null;mapSelected=null;sheetOpen=false;
    if(autoPan&&sameView(autoPan.to,mapView))mapView={...autoPan.from};autoPan=null;rememberMap();render();
    if(caller){if(caller.project===project.id&&caller.epoch===projectEpoch&&caller.area===a.id&&(focusBranchRecordControl(caller.id)||focusBranchRecordControl(`node-info-${a.id}`)))return;$('space-title')?.focus({preventScroll:true});return;}
    if(!focusFirst(`node-info-${visibleRepresentative(project,a.id,collapsed)??a.id}`))$('space-title')?.focus({preventScroll:true});};
  const head=node('div','','panel-top'),heading=node('strong',a.name);heading.id='area-panel-title';
  heading.title=a.name;
  const path=node('p',areaPath(project,a.id).map(x=>x.name).join(' › '),'panel-path');path.id='panel-path';
  path.title=path.textContent??'';
  head.append(heading,btn('닫기',close,'quiet','area-panel-close'),path,btn('행동으로 건너뛰기',()=>{const b=$('panel-open');b.focus({preventScroll:true});},'panel-skip','panel-skip-actions'));
  const body=node('div','','panel-body');body.id='area-panel-body';body.dataset.areaId=a.id;body.dataset.projectId=project.id;body.tabIndex=0;body.setAttribute('role','region');body.setAttribute('aria-label',`${a.name} 내용 읽기`);
  body.addEventListener('scroll',()=>{capturePanelReading();rememberMap();},{passive:true});
  body.addEventListener('toggle',()=>{capturePanelReading();rememberMap();},true);
  body.addEventListener('wheel',e=>{e.stopPropagation();if((e.deltaY<0&&body.scrollTop<=0)||(e.deltaY>0&&body.scrollTop+body.clientHeight>=body.scrollHeight-1))e.preventDefault();},{passive:false});
  body.addEventListener('keydown',e=>{if((e.target as HTMLElement).closest('input,textarea,select,button,summary,[contenteditable="true"]'))return;
    const n=({ArrowDown:40,ArrowUp:-40,PageDown:body.clientHeight*.8,PageUp:-body.clientHeight*.8,' ':body.clientHeight*.8} as Record<string,number>)[e.key];
    if(n!==undefined){e.preventDefault();e.stopPropagation();body.scrollTop+=e.shiftKey&&e.key===' '?-n:n;}
    else if(e.key==='Home'||e.key==='End'){e.preventDefault();e.stopPropagation();body.scrollTop=e.key==='Home'?0:body.scrollHeight;}});
  panel.addEventListener('keydown',e=>{if(e.key!=='Escape'||e.defaultPrevented||e.isComposing||e.keyCode===229||(e.target as HTMLElement).closest('input,textarea,select,[contenteditable="true"],[role="combobox"]'))return;e.preventDefault();e.stopPropagation();close();});
  const nameKey=`area-edit-name:${a.id}`,noteKey=`area-edit-note:${a.id}`;
  const edit=details('이름·구상 고치기','panel-edit');edit.classList.add('panel-edit');edit.open=panelDirty(a);
  const name=spaceInput(node('input'),'panel-name',a.name,nameKey);name.maxLength=60;name.setAttribute('aria-label','영역 이름');
  const note=spaceInput(node('textarea'),'panel-note',a.note,noteKey);note.rows=3;note.maxLength=2000;note.setAttribute('aria-label','한 줄 구상');
  const row=node('div','','row');
  row.append(btn('반영',()=>{if(!name.value.trim())return;const next=editArea(project,a.id,name.value,note.value);edit.open=false;clearInputs(nameKey,noteKey);commit(next);},'secondary','panel-save'),
    btn('취소',()=>{clearInputs(nameKey,noteKey);render();},'quiet','panel-cancel'));
  edit.append(node('label','이름'),name,node('label','한 줄 구상'),note,node('p','아이디어도, 아직 못 정한 점도 적을 수 있어요.','hint'),row);
  const go=node('div','','row panel-actions');go.id='panel-actions';go.setAttribute('role','group');go.setAttribute('aria-label','선택한 영역의 행동');const continued=areaRequests(a.id).some(currentGroup);
  go.append(btn('부분 열기',()=>openArea(a.id),continued?'secondary':'primary','panel-open'),btn('새 요청',()=>writeInArea(a.id),'quiet','panel-new-request'));
  go.querySelector('#panel-new-request')!.setAttribute('aria-label','이 부분에 새 요청');
  if(a.name.length>24){const full=details('영역 이름 전체 보기',`panel-name-full-${a.id}`);full.append(node('p',a.name));body.append(full);}
  // WORK41: the selected part reads in short, labelled parts. When the app already continues a work here, that work comes first:
  // its short gist, exactly which record an explicit continue edits (continueTarget, the same rule as the task screen) and the
  // pinned primary action. Then what the part is for, where it sits (neighbours one click away) and what is recorded.
  const requests=areaRequests(a.id),cur=requests.find(currentGroup),curTask=cur&&project.currentTaskId?taskOf(project):null;
  if(cur&&curTask){
    const work=node('section','','panel-section panel-continue');work.id='panel-work';work.append(node('h3','이어갈 작업','panel-section-title'));
    const next=currentWork(project,curTask).values.next.trim(),target=continueTarget(cur);
    const what=node('p',`작업 ${pad(project.tasks.indexOf(curTask)+1)} · ${receiptOf(curTask)!==null?'받은 보고의 후속 확인 작업문':'작업문'}`,'panel-continue-what');
    const gist=node('p',next?shortText(next,90):'작업문은 아직 비어 있어요. 이어가서 직접 쓸 수 있어요.',next?'panel-continue-gist':'hint');gist.id='panel-continue-gist';
    // Same rule as continueTarget: a current report of this request stays the edited record; the request's own text stays.
    const edited=`작업 ${pad(project.tasks.indexOf(curTask)+1)}`,own=`작업 ${pad(project.tasks.indexOf(cur)+1)}`;
    const why=node('p',curTask.id===cur.id?`고치는 대상 · ${edited}의 작업문`:`고치는 대상 · ${edited} (${own}에 받은 보고의 후속 확인 작업문) · ${own}의 작업문은 그대로`,'hint');why.id='panel-continue-target';why.title=target.text;
    work.append(what,appTag(),gist,why);body.append(work);
    go.prepend(btn('이어가기',()=>{if(workMemo?.task===project.currentTaskId)resumeWork(true,true);else continueTask(cur.id);},'primary','panel-continue'));
  }
  const meaning=node('section','','panel-section');meaning.id='panel-meaning';meaning.append(node('h3','이 부분','panel-section-title'),areaIdea(a,'panel-idea',100),...[understandingPanel(a,'panel-understanding',true)].filter(x=>!!x));
  body.append(meaning,panelPlace(a));
  const recorded=node('section','','panel-section');recorded.id='panel-records';recorded.append(node('h3','현재 기록','panel-section-title'),node('p',areaSummary(a),'hint'),subtreePanel(a));body.append(recorded);
  const more=details('더보기 · 하위 부분과 소속','panel-more');more.append(hierarchyEditor(a),btn('무엇을 요청할지 같이 정하기',()=>{guideOf(a.id);openArea(a.id);document.getElementById(`guide-${a.id}`)?.scrollIntoView({block:'start'});},'quiet','panel-guide'));
  const list=node('section','','panel-tasks');list.id='panel-tasks';
  if(requests.length) {
    list.append(node('p',`이 영역의 요청 ${requests.length}개 · 골라서 읽기`,'source-meta'));
    const ul=node('ul','','panel-task-list');
    for(const t of requests.slice(0,2)) {
      const li=node('li'),open=btn(taskTitle(project,t),()=>openTaskView(t.id,null,`panel-task-${t.id}`),'quiet panel-task',`panel-task-${t.id}`);
      li.append(open,node('span',`작업 ${pad(project.tasks.indexOf(t)+1)} · ${taskStatus(project,t)}`,'hint'));if(currentGroup(t))li.append(appTag());ul.append(li);
    }
    list.append(ul);
    if(requests.length>2){const rest=details(`요청 ${requests.length-2}개 더 보기`,`panel-tasks-more-${a.id}`);
      for(const t of requests.slice(2))rest.append(btn(taskTitle(project,t),()=>openTaskView(t.id,null,`panel-task-${t.id}`),'quiet panel-task',`panel-task-${t.id}`));list.append(rest);}
    list.append(node('p','읽기만으로는 이어가는 작업이나 새 요청의 영역이 바뀌지 않아요.','hint'));
  } else list.append(node('p','아직 이 영역의 요청이 없어요.','hint'));
  recorded.append(list);
  if(cur)body.append(node('p','‘앱에서 이어갈 작업’은 앱 안의 표시이며, 외부 도구의 실행 상태는 아니에요.','hint'));
  // The edit and structure disclosures read after the labelled parts.
  body.append(edit,more);
  panel.append(head,body,go);
  return panel;
}
function hierarchyEditor(a:Area):HTMLElement {
  const box=node('section','','hierarchy-editor'),form=node('form');form.id='child-add-form';
  const name=spaceInput(node('input'),'child-name','',`child-name:${a.id}`),note=spaceInput(node('textarea'),'child-note','',`child-note:${a.id}`);name.maxLength=60;note.maxLength=2000;note.rows=2;
  name.placeholder='새 하위 부분 이름';name.setAttribute('aria-label','새 하위 부분 이름');note.placeholder='하위 부분의 구상 (선택)';note.setAttribute('aria-label','하위 부분의 구상');
  const add=node('button','하위 부분 추가','secondary');add.type='submit';add.id='child-add';form.append(name,note,add);
  form.addEventListener('submit',e=>{e.preventDefault();if(!name.value.trim())return;guard(()=>{const next=addChildArea(project,a.id,name.value,note.value),created=next.space.areas.at(-1)!;collapsed.delete(a.id);clearInputs(`child-name:${a.id}`,`child-note:${a.id}`);mapSelected=created.id;sheetOpen=true;commit(next);revealCard(created.id);rememberMap();});});
  const select=node('select');select.id='area-parent';select.setAttribute('aria-label','이 영역의 상위 부분');const no=node('option','독립 영역');no.value='';select.append(no);
  const blocked=new Set([a.id,...descendantAreas(project,a.id).map(x=>x.id)]);
  for(const candidate of project.space.areas.filter(x=>!x.archived&&!blocked.has(x.id))){const op=node('option',areaPath(project,candidate.id).map(x=>x.name).join(' › '));op.value=candidate.id;select.append(op);}
  const key=`parent-choice:${a.id}`,stored=spaceInputs[`${project.id}:${key}`];select.value=stored??project.space.containment.parents[a.id]??'';
  select.addEventListener('change',()=>{spaceInputs[`${project.id}:${key}`]=select.value;});
  const error=node('p','','hint');error.id='area-parent-message';error.setAttribute('role','status');
  box.append(node('h3','하위 부분과 소속'),form,node('label','이 영역의 상위 부분'),select,btn('소속 반영',()=>{try {const next=setAreaParent(project,a.id,select.value||null);for(const parent of areaPath(next,a.id).slice(0,-1))collapsed.delete(parent.id);clearInputs(key);commit(next);revealCard(a.id,true);rememberMap();}catch{error.textContent='소속을 바꾸지 않았어요. 자기 자신·하위 부분·보관된 영역은 상위 부분으로 고를 수 없어요.';}},'secondary','area-parent-save'),error,node('p','카드를 옮겨도 소속은 바뀌지 않아요. 공유하는 부분은 복제하지 않고 연결로 나타내세요.','hint'));
  return box;
}
function subtreePanel(a:Area):HTMLElement {
  const signals=subtreeSignals(project,a.id),items=signals.flatMap(s=>[...s.questions,...s.reports]);
  const descriptions=signals.map(s=>({id:s.areaId,state:s.description})).filter(x=>x.state.current||x.state.held.length);
  const box=details(`이 부분과 하위 기록 · 질문 ${items.filter(it=>it.kind==='decision').length} · 설명 ${descriptions.length}`,`subtree-records-${a.id}`);box.className='subtree-records';
  box.querySelector('summary')!.id=`subtree-records-heading-${a.id}`;
  box.append(node('p','앱에 기록된 질문·보고·설명이에요. 답변 기록이 있는 질문도 포함하며, 개발의 모든 미결이나 완료 수는 아니에요.','hint'));
  for(const it of items){const task=project.tasks.find(t=>t.id===it.taskId),owner=areaById(it.areaId),row=node('div','','subtree-record');row.dataset.ownerArea=it.areaId??'';
    row.append(node('p',`${owner?.name??'영역 미지정'} · ${it.kind==='decision'?'기록된 질문':'후속 작업문 없는 보고'}`,'source-meta'),
      btn(task?taskTitle(project,task):'기록 보기',()=>openTaskView(it.taskId,it.returnId,`subtree-task-${it.returnId??it.taskId}`),'quiet',`subtree-task-${it.returnId??it.taskId}`));
    if(it.kind==='decision')row.append(node('p',`${'answered' in it&&it.answered?'답변 기록 있음':'답변 기록 없음'} · ${it.status}`,'hint'));
    if(owner)row.append(btn('소유 부분 찾기',()=>showReceivedArea(owner.id,`subtree-owner-${it.returnId??it.taskId}`,true),'quiet',`subtree-owner-${it.returnId??it.taskId}`));box.append(row);}
  for(const {id,state} of descriptions){const row=node('div','','subtree-description');row.dataset.ownerArea=id;row.append(node('span',`${areaById(id)?.name} · ${state.current?.valid?'현재 설명 있음':state.current?'이전 기준 설명':''}${state.held.length?` · 보류 ${state.held.length}건`:''}`),btn('설명 읽을 부분 찾기',()=>showReceivedArea(id,`subtree-description-${id}`,true),'quiet',`subtree-description-${id}`));box.append(row);}
  if(!items.length&&!descriptions.length)box.append(node('p','이 범위에 해당하는 앱 기록이 없어요. 일반적인 개발 미결이 없다는 뜻은 아니에요.','hint'));
  return box;
}
function renderSpace() {
  const root=$('space-view');root.replaceChildren();if(view!=='space'&&view!=='area'&&view!=='task')return;
  root.hidden=route==='projects'; // shown before building, so the map is measured at its real size (fit)
  // A task that is gone (another tab, a restored backup) falls back to its area screen.
  const t=view==='task'?project.tasks.find(x=>x.id===viewTask&&!isReturnTask(project,x))??null:null;
  if(view==='task'&&!t){view=viewArea?'area':'space';viewTask=null;viewReturn=null;}
  // SPATIAL102: one path on all three layers, ending with the layer's name.
  const area=view!=='space'?areaById(viewArea):null,crumb=node('nav','','space-crumb');crumb.id='space-crumb';crumb.setAttribute('aria-label','공간 경로');
  const layer=(label:string)=>node('span',label,'layer-chip');
  if(view==='space')crumb.append(node('strong','전체 공간'),layer('프로젝트 전체'));
  else {
    const areaLabel=area?area.name:'영역 미지정 작업';
    crumb.append(btn('전체 공간',openSpace,'crumb-link','space-crumb-root'),node('span','›','crumb-sep'));
    if(view==='area')crumb.append(node('strong',areaLabel),layer('영역'));
    else crumb.append(btn(areaLabel,()=>openArea(viewArea??'unassigned'),'crumb-link','space-crumb-area'),node('span','›','crumb-sep'),node('strong',taskTitle(project,t!)),layer('작업'));
  }
  crumb.querySelector('strong')!.setAttribute('aria-current','location');
  root.append(crumb);
  if(view==='space')renderOverview(root);else if(view==='task')renderTaskView(root,t!);else if(area)renderArea(root,area);else renderUnplaced(root);
}
/* ---------- SPATIAL102: '확인할 일' (read-only, from existing records) ---------- */
function checkRow(it:CheckItem):HTMLElement {
  const li=node('li','','check-item');li.dataset.kind=it.kind;const t=project.tasks.find(x=>x.id===it.taskId),a=areaById(it.areaId);
  li.append(node('span',`${a?a.name:'영역 미지정'}${a?.archived?' · 보관됨':''}`,'check-area'),node('strong',t?taskTitle(project,t):''),node('span',it.kind==='decision'?`${it.status} · 답을 기다려요`:`${it.status} · 아직 다음 요청이나 확인 작업문 없음`,'hint'));
  li.append(btn('보기',()=>openTaskView(it.taskId,it.returnId,`check-open-${it.returnId??it.taskId}`),'quiet',`check-open-${it.returnId??it.taskId}`));
  if(a&&!a.archived)li.append(btn('소유 부분 보기',()=>showReceivedArea(a.id,`check-area-${it.returnId??it.taskId}`,true),'quiet',`check-area-${it.returnId??it.taskId}`));return li;
}
/** Shown once the project has requests. Items with evidence only: an open question, a report nothing was done with yet. */
const CHECK_KIND:Record<CheckItem['kind'],string>={decision:'답 기다림',report:'후속 작업문 없는 보고'};
/** Records reuse the existing task/report identities; only their reading container is different. */
function checkSection():HTMLElement|null {
  if(!project.tasks.length)return null;
  const items=checkItems(project),box=btn('',openRecords,'quiet records-open','check-summary');
  const kinds=(['decision','report'] as const).map(k=>[k,items.filter(i=>i.kind===k).length] as const).filter(([,n])=>n>0);
  box.append(node('span',`이어 볼 기록 ${items.length}개`,'check-count'),...kinds.map(([k,n])=>node('span',` · ${CHECK_KIND[k]} ${n}`,'check-kind')));
  box.setAttribute('aria-controls','area-panel');box.setAttribute('aria-pressed',String(panelMode==='records'));
  return box;
}
function openRecords() {branchRecordCaller=null;capturePanelReading();located=null;origin=null;panelMode='records';recordsReturnNotice='';rememberMap();render();$('records-heading')?.focus({preventScroll:true});}
function recordsBrowser():HTMLElement {
  const panel=node('aside','','area-panel records-panel sheet-open');panel.id='area-panel';panel.dataset.panelMode='records';panel.setAttribute('aria-label','이어 볼 기록 읽기');
  const close=()=>{capturePanelReading();panelMode='area';rememberMap();render();$('check-summary')?.focus({preventScroll:true});};
  const items=checkItems(project),head=node('div','','panel-top'),heading=node('strong',`이어 볼 기록 ${items.length}개`);heading.id='records-heading';heading.tabIndex=-1;
  head.append(heading,btn('닫기',close,'quiet','area-panel-close'));
  const notice=node('p',recordsReturnNotice,'hint records-return-notice');notice.id='records-return-notice';notice.hidden=!recordsReturnNotice;notice.setAttribute('role','status');head.append(notice);
  const body=node('div','','panel-body');body.id='area-panel-body';body.dataset.areaId='@records';body.dataset.projectId=project.id;body.tabIndex=0;body.setAttribute('role','region');body.setAttribute('aria-label','이어 볼 기록 목록');
  body.append(node('p',items.length?'답을 기다리는 질문과, 받은 뒤 아직 다음 요청이나 확인 작업문이 없는 보고예요. 앱 기록 기준이며 개발 도구의 실행 상태나 완료 여부는 아니에요.':'이어 볼 질문이나 보고가 지금은 없어요. 원래 요청과 보고는 지난 요청과 결과에서 볼 수 있어요.','hint'));
  const list=node('ul','','check-items');list.id='check-list';for(const it of items)list.append(checkRow(it));body.append(list);
  body.addEventListener('scroll',()=>{capturePanelReading();rememberMap();},{passive:true});body.addEventListener('toggle',()=>{capturePanelReading();rememberMap();},true);
  body.addEventListener('wheel',e=>{e.stopPropagation();if(e.deltaY<0&&body.scrollTop<=0||e.deltaY>0&&body.scrollTop+body.clientHeight>=body.scrollHeight-1)e.preventDefault();},{passive:false});
  body.addEventListener('keydown',e=>{if(e.defaultPrevented||e.isComposing||e.keyCode===229||(e.target as HTMLElement).closest('input,textarea,select,[contenteditable="true"]')||e.key===' '&&e.target!==body)return;if(['ArrowDown','ArrowUp','PageDown','PageUp',' ','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();body.scrollTop=e.key==='Home'?0:e.key==='End'?body.scrollHeight:body.scrollTop+(e.key==='ArrowDown'?40:e.key==='ArrowUp'?-40:e.key==='PageUp'||e.key===' '&&e.shiftKey?-body.clientHeight*.8:body.clientHeight*.8);}});
  panel.addEventListener('keydown',e=>{if(e.key!=='Escape'||protectedEscape(e))return;e.preventDefault();e.stopPropagation();close();});
  const actions=node('div','','panel-actions');actions.id='panel-actions';actions.append(btn('지도에서 계속 보기',close,'secondary','records-close'));
  panel.append(head,body,actions);return panel;
}
function renderOverview(root:HTMLElement) {
  const active=project.space.areas.filter(a=>!a.archived),archived=project.space.areas.filter(a=>a.archived),brief=project.space.brief;
  // PC13: the path above already names this layer, so the overview's own title is kept for focus and screen readers only;
  // the program's purpose (one line) and its full text/edit stay on the first line.
  const head=node('div','','space-head compact overview-head'),title=node('h1','전체 공간','sr-only');title.id='space-title';title.tabIndex=-1;
  const line=node('div','','space-head-line');line.append(title);
  const purpose=node('p',brief?brief.text:'무엇을 만드는지 한두 문장으로 적어 두면 영역을 나누기 쉬워요.',brief?'space-brief':'hint');purpose.id='space-brief';
  if(brief)line.append(node('span','프로젝트 목적','space-brief-label'));line.append(purpose);head.append(line);
  if(brief)line.append(btn('목적 전체 보기',readMapPurpose,'quiet','brief-read'));
  const edit=details(brief?'목적 고치기':'목적 적기','brief-edit'),field=spaceInput(node('textarea'),'brief-edit-text',brief?.text??'');field.rows=4;field.maxLength=12000;
  field.setAttribute('aria-label','프로젝트 목적');
  edit.append(field,btn('목적 저장',()=>{if(!field.value.trim())return;commit(setBrief(project,field.value.trim()));clearInputs('brief-edit-text');},'secondary','brief-save'));
  if(brief?.previous.length)edit.append(node('p',`이전에 적은 목적 ${brief.previous.length}개는 그대로 보관돼요.`,'hint'));
  edit.classList.add('brief-disclosure');line.append(edit);
  // WORK41: the path and the purpose share one row, so the map starts higher on a PC screen.
  const top=node('div','','overview-top'),crumb=root.querySelector('#space-crumb');if(crumb)top.append(crumb);top.append(head);root.append(top);
  if(!active.length&&route!=='example') {
    const start=node('div','','row space-start');start.id='space-start';
    start.append(btn('영역 추가',()=>{$<HTMLDetailsElement>('area-add-panel').open=true;$('area-name').focus();},'secondary','start-add-area'),btn('바로 첫 요청 쓰기 · 영역 없이',()=>writeInArea(null),'quiet','start-first-request'));
    root.append(start);
  }
  if(receivedAreas.size){const recent=node('div','','received-areas');recent.id='received-areas';recent.append(node('span','이 탭에서 받은 설명 · 위치 보기'));for(const id of receivedAreas){const a=areaById(id);if(a&&!a.archived)recent.append(btn(a.name,()=>showReceivedArea(id,`received-area-${id}`),'quiet',`received-area-${id}`));}root.append(recent);}
  const loc=locatedLine();if(loc)root.append(loc);
  const records=checkSection();renderMap(root,active,records?[records]:[]);
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
  // SPATIAL102: the title enters the read-only task screen; continuing stays the explicit button below.
  const title=node('h3');title.append(btn(taskTitle(project,t),()=>openTaskView(t.id,null,`task-open-${t.id}`),'task-open-link',`task-open-${t.id}`));
  item.append(title,node('p',`${first?dateLabel(first.at):''} · ${taskStatus(project,t)}`,'hint'));
  if(results.length){const last=results.at(-1)!,src=project.sources.find(s=>s.id===last.sourceIds[0]);
    item.append(node('p',`돌아온 결과 ${results.length}개 · 앱 미검증${src?` · 최근: ${shortText(reportBody(src),60)}`:''}`,'area-task-result'));}
  const row=node('div','','row');
  if(currentGroup(t)){row.append(appTag(),btn('작업 화면으로',()=>continueTask(t.id),'secondary'));}
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
/* ---------- GUIDE097: area guidance. Per tab, in memory, keyed by project and area; nothing is saved until the user adopts. ---------- */
const guideKey=(areaId:string)=>`${project.id}:${areaId}`;
function guideOf(areaId:string):Guide {
  let g=guides.get(guideKey(areaId));
  if(!g){g={question:null,answer:null,proposal:null,mode:null,read:[],text:'',base:'',answerDraft:'',pending:null,notice:null,gen:0,incoming:null,instruction:'',used:null};guides.set(guideKey(areaId),g);}
  return g;
}
const guideEdited=(g:Guide)=>g.proposal!==null&&g.text!==g.base;
const guideStale=(g:Guide)=>(g.question!==null||g.proposal!==null)&&instructionOf(g.instruction)!==g.used;
/** GUIDE099-R1: a held reply still matches what is on screen now (purpose, area, decisions, area requests, its answer, the instruction). */
function incomingCurrent(areaId:string,g:Guide):boolean {
  if(!g.incoming)return false;
  try{return guideDigest(buildGuideRequest(project,areaId,g.incoming.answer,instructionOf(g.instruction)))===g.incoming.digest;}catch{return false;}
}
function applyGuide(g:Guide,x:GuideApply) {
  g.mode=x.mode;g.read=x.read;g.incoming=null;g.answer=x.answer;g.used=x.instruction;
  if(x.reply.question){g.question=x.reply.question;g.proposal=null;}
  else {const prop=x.reply.proposal!;g.proposal=prop;g.text=g.base=proposalText(x.areaName,prop,x.first,x.answer,x.instruction);}
}
/** One request for this area. A reply is applied only to the same project activation, the same pending request, and only
 * while the material it was built from (purpose, this area, decisions, this area's requests, the answer) is unchanged. */
/** fresh: the instruction changed, so the earlier question and answer are not sent again. */
async function askGuide(areaId:string,fresh=false) {
  const g=guideOf(areaId);if(g.pending||route==='example')return;
  if(g.instruction.length>TEXT_LIMIT){g.notice=`‘이번에 맡기거나 바꿀 일’이 ${TEXT_LIMIT.toLocaleString()}자를 넘어 보내지 않았어요. 자르지 않았으니 줄인 뒤 다시 누르세요.`;render();return;}
  if(!readyForAI()){g.notice=config?.mode==='deepseek'?'실제 AI 안내는 서버 설정과 위 연결 메뉴의 전송 동의가 필요해요. 직접 쓰는 요청은 그대로 쓸 수 있어요.':'정리 방식을 확인하지 못했어요.';render();return;}
  let req;
  const instruction=instructionOf(g.instruction),protect=guideEdited(g);
  try {req=buildGuideRequest(project,areaId,fresh?null:g.answer,instruction);} catch {g.notice='보낼 자료가 한도(128 KiB)를 넘거나 유효하지 않아 보내지 않았어요. 사용자 결정은 잘라 보내지 않아요. 직접 요청을 쓸 수 있어요.';render();return;}
  const active=new AbortController(),key=guideKey(areaId),digest=guideDigest(req),epoch=projectEpoch,gen=g.gen;
  g.pending={requestId:req.ticket.requestId,controller:active};g.notice=null;render();
  const mine=()=>epoch===projectEpoch&&guides.get(key)===g&&g.pending?.requestId===req.ticket.requestId;
  try {
    const data=validateGuideEnvelope(await requestGuidance(req,active.signal),req);
    if(!mine())return;
    if(data.mode!==config!.mode)throw new Error('INVALID_RESPONSE');
    let now:string|null=null;try{now=guideDigest(buildGuideRequest(project,areaId,req.answer,instructionOf(g.instruction)));}catch{/* area archived or removed, or input over the limit */}
    if(now!==digest){g.notice='기다리는 동안 목적·영역 구상·결정이나 ‘이번에 맡기거나 바꿀 일’이 바뀌어 이 응답은 적용하지 않았어요. 입력과 초안은 그대로예요. 다시 받을 수 있어요.';return;}
    const x:GuideApply={reply:data.reply,mode:data.mode,read:readOf(req),areaName:areaById(areaId)?.name??req.area.name,first:!req.areaWork.length,answer:req.answer,instruction:req.currentInstruction,digest};
    // GUIDE097-R1: any edit after the request was sent (even one back to the same text) keeps the screen as it is.
    // GUIDE099: so does a draft the user had already edited when asking again after changing the instruction.
    if(g.proposal!==null&&(g.gen!==gen||protect)){g.incoming=x;g.notice='기다리는 동안 직접 고친 내용이 있어 새 초안으로 바꾸지 않았어요. 화면의 초안은 그대로예요. 새 응답을 쓰려면 ‘새 응답으로 바꾸기’를 누르세요(지금 초안은 버려져요).';return;}
    applyGuide(g,x);
  } catch(e) {
    if(!active.signal.aborted&&mine()){const code=e instanceof Error?e.message:'';g.notice=`${errorMessages[code]??(e instanceof Error&&e.name==='ContextError'?errorMessages.INVALID_RESPONSE:'요청이 실패했어요.')} 입력·답·초안은 그대로예요. 다시 받을 수 있어요.`;}
  } finally {if(guides.get(key)===g&&g.pending?.requestId===req.ticket.requestId)g.pending=null;if(epoch===projectEpoch)render();}
}
function stopGuide(areaId:string){const g=guideOf(areaId);g.pending?.controller.abort();g.pending=null;g.notice='중단했어요. 입력·답·초안은 그대로예요. 이미 보낸 유료 요청의 과금 취소를 뜻하지는 않아요.';render();}
function answerGuide(areaId:string,value:string,disposition:GuideAnswer['disposition']) {
  const g=guideOf(areaId);if(g.pending||!g.question||!value.trim()||guideStale(g))return;
  g.answer={question:g.question,text:value,disposition};g.answerDraft='';void askGuide(areaId);
}
function adoptGuide(a:Area) {
  const g=guideOf(a.id);if(!g.text.trim())return;
  // GUIDE099-R1: a draft made for another instruction is not adopted; it stays on screen, nothing is removed.
  if(guideStale(g)){g.notice='‘이번에 맡기거나 바꿀 일’이 바뀌어 이 초안은 넣지 않았어요. 초안은 그대로 두었어요. ‘바뀐 입력으로 새로 받기’로 지금 입력에 맞는 초안을 받거나, 입력을 이 초안을 만들 때로 되돌리세요.';render();return;}
  try {commit(adoptProposal(project,a.id,g.text));}
  catch(e){g.notice=e instanceof Error&&e.message==='DRAFT_IN_USE'?'작성 중인 요청이 있어 초안을 넣지 않았어요. 작업 화면에서 그 요청을 보내거나 비운 뒤 다시 누르세요. 이 초안은 여기 그대로예요.'
    :g.text.length>TEXT_LIMIT?`초안이 요청 한 건의 한도(${TEXT_LIMIT.toLocaleString()}자)를 넘어 넣지 않았어요. 자르지 않았으니 직접 줄인 뒤 다시 누르세요. 이 초안은 여기 그대로예요.`:'초안을 넣지 못했어요. 이 초안은 여기 그대로예요.';render();return;}
  guides.delete(guideKey(a.id));view='work';render();
  project={...project,notice:`초안을 ‘${a.name}’ 영역의 요청 입력칸에 넣었어요. 아직 보내지 않았어요. 확인·수정한 뒤 ‘작업문 준비하기’를 누르세요.`};renderStatus();
  $<HTMLDetailsElement>('compose-panel').open=true;$('draft').focus();
}
function guidePanel(a:Area,hasRequests:boolean):HTMLElement {
  const g=guides.get(guideKey(a.id)),box=details(hasRequests?'다음 요청 같이 정하기 · 선택':'무엇을 요청할지 같이 정하기 · 선택',`guide-${a.id}`);
  box.classList.add('guide-panel');box.dataset.areaId=a.id;box.open=!!g||!hasRequests;
  const mock=config?.mode!=='deepseek',label=mock?'MOCK 규칙 · AI 아님':'DeepSeek 초안 · 검토 전';
  box.append(node('p',`목적·이 영역의 구상·사용자 결정·이 영역의 요청을 읽고, 꼭 필요할 때만 질문 하나를 한 뒤 요청 초안을 보여줘요. 초안은 고치거나 버릴 수 있고, ‘이 초안으로 요청 쓰기’를 누르기 전에는 구상·작업·결정이 바뀌지 않아요. ${mock?'지금은 MOCK 규칙이라 예약 확정 방식 한 가지만 묻고, 그 밖에는 중립적인 첫 단계를 만들어요.':'서버의 DeepSeek에 이 자료를 보내요.'}`,'hint'));
  // GUIDE099: optional current instruction, visible as soon as the panel is open (not another folded box).
  const ins=node('textarea');ins.id='guide-instruction';ins.rows=3;ins.value=g?.instruction??'';ins.setAttribute('aria-label','이번에 맡기거나 바꿀 일 (선택)');
  ins.placeholder='예: 이번에는 무엇만 하거나, 어떤 조건을 바꿀지 적어 주세요. 비워 두어도 돼요.';
  ins.addEventListener('input',()=>{const gg=guideOf(a.id),was=[guideStale(gg),incomingCurrent(a.id,gg)].join();gg.instruction=ins.value;if([guideStale(gg),incomingCurrent(a.id,gg)].join()!==was)render();});
  box.append(node('label','이번에 맡기거나 바꿀 일 (선택)','guide-instruction-label'),ins,
    node('p','영역 구상은 그대로 두고, 이번 요청이나 바뀐 조건만 적으세요. 비워 두면 목적과 구상으로 시작해요. 적은 내용은 이 탭에만 있고 새로고침하면 사라져요. 요청 입력칸에 쓴 내용은 가져오지 않아요.','hint'));
  if(g?.notice){const n=node('p',g.notice,'guide-notice');n.id='guide-notice';n.setAttribute('role','status');box.append(n);}
  if(g?.pending){const row=node('div','','row');row.append(node('span','받는 중…','hint'),btn('중단',()=>stopGuide(a.id),'quiet','guide-stop'));box.append(row);}
  const busy=!!g?.pending,stale=!!g&&guideStale(g);
  if(stale) {
    const n=node('div','','guide-stale');n.id='guide-stale';
    const fresh=btn('바뀐 입력으로 새로 받기',()=>void askGuide(a.id,true),'secondary','guide-fresh');fresh.disabled=busy;
    n.append(node('p','‘이번에 맡기거나 바꿀 일’이 바뀌었어요. 아래 질문·답·초안은 바뀌기 전 입력으로 만든 것이라 새 요청에 다시 쓰지 않아요. 직접 고친 초안은 그대로 두고, 새 응답이 오면 바꿀지 고르게 해요.','hint'),fresh);box.append(n);
  }
  if(!g||(!g.question&&!g.proposal)) {
    const start=btn(mock?'질문 또는 초안 받기 (MOCK)':'질문 또는 초안 받기',()=>void askGuide(a.id),'secondary','guide-start');start.disabled=busy;box.append(start);
    return box;
  }
  if(g.question&&!g.proposal) {
    const q=g.question,sec=node('section','','guide-question');sec.id='guide-question';
    sec.append(node('p',`${label} · ${q.kind==='fact'?'사실 확인':'선택'} 질문 하나`,'eyebrow'),node('strong',q.text),node('p',q.why,'hint'));
    if(stale) sec.append(node('p','바뀌기 전 입력으로 받은 질문이에요. 새로 받으면 이 질문과 답은 다시 보내지 않아요.','hint'));
    else if(g.answer) {
      // The answer is kept after a failure, cancel or discarded late reply: asking again sends it, never the question again.
      sec.append(node('p',`보낸 답: ${g.answer.disposition==='provided'?g.answer.text:g.answer.disposition==='unknown'?'모름':'보류'}`,'hint'));
      const row=node('div','','row'),again=btn('이 답으로 다시 받기',()=>void askGuide(a.id),'secondary','guide-retry'),change=btn('답 바꾸기',()=>{g.answer=null;render();},'quiet','guide-change-answer');
      again.disabled=change.disabled=busy;row.append(again,change);sec.append(row);
    }
    else {
      const opts=node('div','','row');for(const [i,o] of q.options.entries()){const b=btn(o.label,()=>answerGuide(a.id,o.label,'provided'),'quiet guide-option',`guide-option-${i}`);b.title=o.consequence;b.disabled=busy;opts.append(b);}
      const field=node('input');field.id='guide-answer';field.value=g.answerDraft;field.placeholder='직접 답하기';field.setAttribute('aria-label','질문에 직접 답하기');field.maxLength=2000;
      field.addEventListener('input',()=>{g.answerDraft=field.value;});
      const row=node('div','','row');
      for(const [text,id,act] of [['이 답으로','guide-answer-send',()=>answerGuide(a.id,field.value,'provided')],['모름','guide-unknown',()=>answerGuide(a.id,'모름','unknown')],['보류','guide-defer',()=>answerGuide(a.id,'보류','deferred')]] as const){const b=btn(text,act,'quiet',id);b.disabled=busy;row.append(b);}
      for(const o of q.options)sec.append(node('p',`${o.label}: ${o.consequence}`,'hint'));
      sec.append(opts,field,row);
    }
    box.append(sec);return box;
  }
  const sec=node('section','','guide-proposal');sec.id='guide-proposal';
  sec.append(node('p',`${label} · 요청 초안 · 아직 보내지 않음`,'eyebrow'),node('p',`읽은 자료: ${g.read.join(' · ')}`,'hint'));
  if(g.answer)sec.append(node('p',`질문: ${g.answer.question.text} → ${g.answer.disposition==='provided'?g.answer.text:g.answer.disposition==='unknown'?'모름':'보류'}`,'hint'));
  const area=node('textarea');area.id='guide-text';area.rows=8;area.maxLength=12000;area.value=g.text;area.setAttribute('aria-label','요청 초안');
  const edited=node('p',guideEdited(g)?'직접 고친 초안이에요.':'','hint');edited.id='guide-edited';
  area.addEventListener('input',()=>{g.text=area.value;g.gen++;edited.textContent=guideEdited(g)?'직접 고친 초안이에요.':'';});
  if(g.incoming){const hold=node('div','','row');hold.id='guide-incoming';
    // GUIDE099-R1: the held reply is re-checked against the current input before it may replace the draft.
    const take=btn('새 응답으로 바꾸기 · 지금 초안 버림',()=>{
      if(!incomingCurrent(a.id,g)){g.notice='보관된 새 응답은 지금 입력과 다른 기준으로 만든 것이라 적용하지 않았어요. 초안은 그대로예요. 입력을 그때로 되돌리거나 ‘바뀐 입력으로 새로 받기’를 누르세요.';render();return;}
      applyGuide(g,g.incoming!);g.notice=null;render();},'quiet','guide-take-incoming');take.disabled=busy||!incomingCurrent(a.id,g);
    hold.append(btn('내 초안 유지',()=>{g.incoming=null;g.notice=null;render();},'secondary','guide-keep-mine'),take);
    if(take.disabled&&!busy)hold.append(node('span','지금 입력과 다른 기준의 응답이라 바꿀 수 없어요.','hint'));
    sec.append(hold);}
  const row=node('div','','row'),use=btn('이 초안으로 요청 쓰기',()=>adoptGuide(a),'primary','guide-adopt');use.disabled=busy||stale;row.append(use);
  if(stale)row.append(node('span','입력이 바뀌어 이 초안은 쓸 수 없어요. 고친 내용은 그대로 남아요.','hint'));
  if(guideEdited(g))row.append(btn('고친 내용 되돌리기',()=>{g.text=g.base;g.gen++;render();},'quiet','guide-revert'));
  else if(!stale) {
    const again=btn('다시 받기',()=>void askGuide(a.id),'quiet','guide-again');again.disabled=busy;row.append(again);
    if(g.answer){const change=btn('질문 답 바꾸기',()=>{g.question=g.answer!.question;g.answer=null;g.proposal=null;g.text=g.base='';render();},'quiet','guide-change-answer');change.disabled=busy;row.append(change);}
  }
  // Discarding the draft keeps what the user typed as the instruction.
  row.append(btn('초안 버리기',()=>{g.pending?.controller.abort();Object.assign(g,{question:null,answer:null,proposal:null,text:'',base:'',pending:null,notice:null,incoming:null,used:null});render();},'quiet','guide-discard'));
  sec.append(area,edited,row,node('p','쓰면 이 영역의 요청 입력칸에 들어가고, 거기서 다시 고친 뒤 ‘작업문 준비하기’로 보내요. 영역 구상·기존 작업·결정은 바뀌지 않아요.','hint'));
  box.append(sec);return box;
}
function renderArea(root:HTMLElement,a:Area) {
  const head=node('div','','space-head'),title=node('h1',a.name);title.id='space-title';title.tabIndex=-1;
  // PC12: the user's idea is read first; a long one shows its opening words and says where the whole text is.
  head.append(node('p',a.archived?'영역 · 보관됨':'영역','eyebrow'),title,!a.note?noNote():a.note.length<=NOTE_SHORT*2?node('p',a.note,'space-brief'):areaIdea(a,'area-idea',NOTE_SHORT*2));
  const actions=node('div','','row');
  if(!a.archived)actions.append(btn('이 영역에 새 요청',()=>writeInArea(a.id),'primary','area-new-request'));
  actions.append(btn(a.archived?'영역 되살리기':'영역 보관',()=>{if(!a.archived&&childrenOf(project,a.id).some(x=>!x.archived)){project={...project,notice:'하위 부분이 남아 있어 보관하지 않았어요. 먼저 하위 부분의 소속을 바꾸거나 하위 부분부터 보관하세요.'};renderStatus();return;}commit(setAreaArchived(project,a.id,!a.archived));if(!a.archived){project={...project,notice:`‘${a.name}’ 영역을 보관했어요. 연결된 요청과 결과는 그대로이며 ‘보관한 영역’에서 되살릴 수 있어요.`};openSpace();}},'quiet','area-archive'));
  head.append(actions);
  const nameKey=`area-edit-name:${a.id}`,noteKey=`area-edit-note:${a.id}`;
  const edit=details('이름·설명 고치기','area-edit'),name=spaceInput(node('input'),'area-edit-name',a.name,nameKey);name.maxLength=60;name.setAttribute('aria-label','영역 이름');
  const note=spaceInput(node('textarea'),'area-edit-note',a.note,noteKey);note.rows=2;note.maxLength=2000;note.setAttribute('aria-label','영역 설명');
  edit.append(name,note,btn('저장',()=>{if(!name.value.trim())return;commit(editArea(project,a.id,name.value,note.value));clearInputs(nameKey,noteKey);},'secondary','area-edit-save'),
    btn('취소',()=>{clearInputs(nameKey,noteKey);edit.open=false;render();},'quiet','area-edit-cancel'));
  const back=locatedLine();if(back)root.append(back);
  head.append(edit);root.append(head);const described=understandingPanel(a,'area-understanding');if(described)root.append(described);
  const checks=checkItems(project),here=checks.filter(c=>c.areaId===a.id).length,elsewhere=checks.length-here;
  if(here||elsewhere) {
    const line=node('p',`이어 볼 기록 · 이 영역 ${here}개${elsewhere?` · 다른 영역 ${elsewhere}개`:''} `,'hint area-checks');line.id='area-checks';
    line.append(btn('전체 공간에서 보기',()=>{openSpace();openRecords();},'crumb-link','area-checks-open'));root.append(line);
  }
  const tasks=areaRequests(a.id),list=node('section','','area-tasks');list.id='area-tasks';
  if(!a.archived&&route!=='example')root.append(guidePanel(a,tasks.length>0));
  list.append(node('h2','이 영역의 요청과 작업'));
  for(const t of tasks)list.append(taskEntry(t,false));
  if(!tasks.length&&a.archived)list.append(node('p','이 영역에 연결된 요청이 없어요.','hint'));
  else if(!tasks.length) {
    const start=node('div','','row area-start');start.id='area-start';
    start.append(btn('이 영역에 새 요청',()=>writeInArea(a.id),'secondary','area-start-request'));
    if(route!=='example')start.append(btn('무엇을 요청할지 같이 정하기',()=>{guideOf(a.id);render();const g=document.getElementById(`guide-${a.id}`);g?.scrollIntoView({block:'start'});$('guide-instruction')?.focus({preventScroll:true});},'quiet','area-start-guide'));
    list.append(node('p','아직 이 영역의 요청이 없어요.','hint'),start);
  }
  root.append(list);
  const own=new Set(tasks.flatMap(t=>[t.id,...returnsOf(t).map(r=>r.id)])),bases=project.bases.filter(b=>own.has(project.sources.find(s=>s.id===b.sourceId)?.taskId??''));
  const shared=project.bases.length-bases.length,box=details(`기준 · 이 영역 ${bases.length}개 · 다른 영역·미분류 기준 ${shared}개`,'area-bases');
  for(const b of bases)box.append(node('p',`${BASIS_LABEL[b.status]} · ${shortText(b.text,90)}`,'source-raw'));
  box.append(node('p','다른 영역·미분류 기준은 다른 영역의 요청에서 나왔거나 어느 영역에서 나왔는지 기록이 없는 기준이에요. 모두가 합의한 공통 기준이라는 뜻은 아니에요. 이 영역에 복사하지 않고, 기준 전체가 지금처럼 모든 작업문에 함께 들어가요.','hint'),btn('기준 · 출처 전체 보기',showContext,'quiet'));
  root.append(box);
}
/** PC12: which record an explicit continue would edit. Mirrors continueTask: a current report of this request stays current;
 * otherwise the request itself becomes current (never one of its older reports). */
function continueTarget(t:Task):{button:string;text:string} {
  const cur=project.currentTaskId?project.tasks.find(x=>x.id===project.currentTaskId)??null:null,no=(x:Task)=>`작업 ${pad(project.tasks.indexOf(x)+1)}`;
  if(cur?.id===t.id)return {button:'작업 화면으로',text:`지금 이어가는 작업이에요. 고치면 이 요청(${no(t)})의 작업문이 바뀌어요.`};
  if(cur&&isReturnTask(project,cur)&&cur.parentTaskId===t.id)return {button:'작업 화면으로',text:`이어가면 이 요청에 받은 현재 보고(${no(cur)})에서 계속해요. 고치는 대상은 ${no(cur)}의 후속 확인 작업문이고, 읽고 있는 ${no(t)}의 작업문은 바뀌지 않아요.`};
  return {button:'이 작업 이어서 하기',text:`이어가면 이 요청(${no(t)})으로 바꾸고 ${no(t)}의 작업문을 고쳐요.${cur?` 지금 이어가는 ${no(cur)}은 그대로 남아요.`:''}${returnsOf(t).length?' 이 요청에 돌아온 이전 보고를 대신 고르지 않아요.':''}`};
}
/** PC12: one field of the task being read (never the current task), with where it comes from. Stale AI text is named, not shown as current. */
function fieldOf(t:Task,w:Work,key:keyof Task['manual']):{text:string;label:string;state:'manual'|'ai'|'stale'|'empty'} {
  const manual=t.manual[key],ai=t.advice?.[key]??'',who=t.mode==='mock'?'MOCK':'AI';
  if(manual!==null)return {text:manual,label:'사용자 직접 수정',state:'manual'};
  if(ai&&!w.aiStale)return {text:ai,label:`${who} 제안 · 원문과 다를 수 있음`,state:'ai'};
  if(ai)return {text:ai,label:`이전 ${who} 문구 · ${staleCause(w)}이라 작업문에서 제외됨`,state:'stale'};
  return {text:'',label:'',state:'empty'};
}
function fieldRows(t:Task,w:Work,grid:HTMLElement,keys:[keyof Task['manual'],string][],limit:number|null,prefix='task-view'):number {
  let shown=0;
  for(const [key,label] of keys) {
    const f=fieldOf(t,w,key);if(f.state==='empty')continue;shown++;
    const cell=node('div');cell.dataset.field=key;cell.dataset.origin=f.state;
    const dt=node('dt',`${label} · `);dt.append(node('span',f.label,`field-origin ${f.state}`));cell.append(dt);
    if(f.state==='stale'){const old=details('제외된 이전 문구 보기 (현재 작업문 아님)',`${prefix}-stale-${key}`);old.append(node('div',f.text,'source-raw'));cell.append(node('dd','지금 작업문에는 들어가지 않아요.'),old);}
    else if(limit!==null&&f.text.length>limit) {
      // fix1: a long field shows its opening words, and its whole text (with the same origin) one explicit click away. Read-only.
      const whole=details(`${label} 전문 보기 · ${f.text.length}자 · ${f.label}`,`${prefix}-full-${key}`);whole.append(node('div',f.text,'source-raw'));
      cell.append(node('dd',`${shortText(f.text,limit)} · 앞부분`),whole);
    }
    else cell.append(node('dd',!f.text?'(직접 비워 둠)':f.text));
    grid.append(cell);
  }
  return shown;
}
/** PC12: what this request is and its existing short understanding/scope. Nothing is generated when they are empty. */
function taskContext(t:Task):HTMLElement {
  const w=currentWork(project,t),area=areaById(areaOf(project,t)),box=node('section','','task-context');box.id='task-view-context';
  box.append(node('p',`요청 · 작업 ${pad(project.tasks.indexOf(t)+1)} · ${area?`영역 ‘${area.name}’${area.archived?' (보관됨)':''}`:'영역 미지정'}`,'source-meta'));
  const grid=node('dl','','review-grid task-context-grid');
  if(fieldRows(t,w,grid,[['understanding','짧은 이해'],['scope','이번 범위와 유지할 것']],200))box.append(grid);
  else box.append(node('p','이 작업에는 아직 짧은 이해·범위 기록이 없어요. 만들어 넣지 않았어요. 필요하면 아래 요청 원문을 열어 보세요.','hint'));
  return box;
}
/** PC12: the work text, completion conditions and kept conditions, opened when needed. Labels say whose words they are. */
function taskWorkDetails(t:Task):HTMLDetailsElement {
  const w=currentWork(project,t),box=details('현재 작업문 · 완료 조건 · 유지할 조건 보기','task-view-work'),grid=node('dl','','review-grid task-context-grid');
  let shown=fieldRows(t,w,grid,[['next','실행 도구에 전달할 작업문'],['checks','확인할 동작 / 완료 조건']],null);
  const correction=intentCorrection(t),intent=currentIntent(project,t),conditions=correction?.conditions??intent?.value.conditions.join(' / ')??'';
  if(conditions){shown++;const cell=node('div');const dt=node('dt','현재 기록의 유지할 조건 · ');dt.append(node('span',correction?'사용자 직접 정정':`${t.mode==='mock'?'MOCK':'AI'} 정리 · 원문과 다를 수 있음`,`field-origin ${correction?'manual':'ai'}`));cell.append(dt,node('dd',conditions));grid.append(cell);}
  if(shown)box.append(grid);
  else box.append(node('p','작성된 작업문·완료 조건·유지할 조건 값이 없어요. 원문 속 조건이나 금지가 없다는 뜻은 아니니 요청 원문을 확인하세요.','hint'));
  return box;
}
/** REPORT16: the reports on this request's return path (direct, or through follow-up handoffs), in record order.
 * Same membership rule as pointedReturn, so the list offers exactly the reports a pointed id may name. */
function reportsOf(t:Task):Task[] {return project.tasks.filter(x=>isReturnTask(project,x)&&pointedReturn(project,t.id,x.id)!==null);}
/** REPORT16: the user picks which report of this request to read. Looking only: no project data, current work, unsent
 * input or starting point changes. Disclosures of the previously picked report do not carry over to this one. */
function pickReport(id:string) {
  if(view!=='task'||!viewTask)return;
  // fix1: the same report picked again keeps all of its open parts; another report keeps only the request-wide ones.
  const same=readOpen&&readOpen.task===viewTask&&readOpen.ret===id;
  const keep=same?{...readOpen!.open}:readOpen&&readOpen.task===viewTask?Object.fromEntries(Object.entries(readOpen.open).filter(([k])=>!k.startsWith('task-report-'))):{};
  viewReturn=id;readOpen={task:viewTask,ret:id,open:keep};
  const y=window.scrollY;render();window.scrollTo({top:y});focusFirst(`task-report-pick-${id}`);
}
/** REPORT16: disclosures of the task screen keep their open state across redraws of the same request and the same picked
 * report; a different request starts closed, and a different report starts with its own parts closed. Tab memory only. */
function keepReadOpen(root:HTMLElement,t:Task) {
  if(!readOpen||readOpen.task!==t.id||readOpen.ret!==viewReturn)
    readOpen={task:t.id,ret:viewReturn,open:readOpen&&readOpen.task===t.id?Object.fromEntries(Object.entries(readOpen.open).filter(([k])=>!k.startsWith('task-report-'))):{}};
  const memo=readOpen;
  for(const d of root.querySelectorAll<HTMLDetailsElement>('details[id]')) {
    const open=memo.open[d.id];if(open!==undefined)d.open=open;
    d.addEventListener('toggle',()=>{if(readOpen===memo)memo.open[d.id]=d.open;});
  }
}
/** REPORT16: the area's idea as it is now (Area.note, the user's words), not the copy saved with the request. */
function currentIdea(t:Task,a:Area|null):HTMLElement {
  if(!a){const box=node('section','','area-idea task-idea');box.id='task-view-idea';box.append(node('p','지금의 영역 구상','source-meta'),node('p','영역 미지정 요청이라 영역 구상이 없어요.','hint'));return box;}
  const box=areaIdea(a,'task-view-idea',NOTE_SHORT,`지금의 영역 구상 · ${a.name}${a.archived?' (보관됨)':''}`);box.classList.add('task-idea');
  const copy=t.background?.area;
  if(copy&&copy.id===a.id&&(copy.note??'')!==a.note)box.append(node('p','이 요청을 쓸 때의 구상 사본과 달라요. 당시 사본은 아래 배경에 그대로 있어요.','hint task-idea-changed'));
  const described=understandingPanel(a,'task-understanding',true);if(described)box.append(described);
  if(!a.archived)box.append(btn('지도에서 소유 부분 보기',()=>showReceivedArea(a.id,'task-view-find-area',true),'quiet','task-view-find-area'));
  return box;
}
const DRAFT_NAME:Record<Project['draftKind'],string>={request:'요청',report:'보고',evidence:'관찰',test_answer:'시험자료'};
/** REPORT16: what the unsent input keeps, said before the click (the composer's own target/return rules). */
function unsentTarget():string {
  const kind=project.draftKind;
  if(kind==='request')return `대상 그대로 · ${draftTargetLabel()}`;
  if(kind==='report'||kind==='evidence') {
    if(returnChoiceRequired())return '연결할 작업은 입력칸에서 아직 고르지 않았어요';
    const p=returnPreview(project,returnTargets(project).length>1?selectedReturnTaskId:undefined);
    return p.targetTitle?`연결 예정 그대로 · ${p.targetTitle}`:'연결할 이전 작업 없음';
  }
  return '종류·내용 그대로';
}
/** REPORT16: open the unsent input exactly as it is (kind, text, target, chosen return task). Never relabels or retargets it. */
function openUnsent() {
  if(!project.draft.trim()){render();project={...project,notice:'작성 중인 입력이 없어져 아무것도 열지 않았어요. 다시 골라 주세요.'};renderStatus();return;}
  writeInArea(null); // with an unsent input this only opens it; the id is not used
}
/** REPORT16: the one next action of this screen, named by what it really does, and the existing continue kept apart. */
function nextAction(t:Task,a:Area|null):HTMLElement {
  const box=node('section','','task-next');box.id='task-next';box.setAttribute('aria-label','다음 동작');
  const draft=project.draft.trim(),row=node('div','','row'),what=node('p','','hint');what.id='task-next-target';
  if(draft) {
    row.append(btn(`작성 중인 ${DRAFT_NAME[project.draftKind]} 열기`,openUnsent,'primary','task-next-action'));
    what.textContent=`‘${shortText(draft,48)}’ · ${unsentTarget()}`;box.append(row,what);
    if(a&&!a.archived)box.append(node('p','이 영역의 새 요청은 이 입력을 보내거나 비운 뒤에 쓸 수 있어요.','hint'));
  } else if(a&&!a.archived) {
    row.append(btn('이 영역에 새 요청',()=>writeInArea(a.id),'primary','task-next-action'));
    what.textContent=`영역 ‘${a.name}’에 쓸 빈 요청 입력칸을 열어요. 보내기 전에는 작업이 생기지 않아요.`;box.append(row,what);
  } else {
    const b=btn('이 영역에 새 요청',()=>{},'primary','task-next-action');b.disabled=true;b.setAttribute('aria-describedby','task-next-target');
    what.textContent=a?'보관된 영역이라 여기서 새 요청을 쓰지 않아요. 영역을 되살리면 쓸 수 있어요.':'영역 미지정 요청이라 이 화면에서는 영역 새 요청을 쓰지 않아요.';
    row.append(b);box.append(row,what);
  }
  return box;
}
/** The existing explicit continue stays separate from the unsent draft and names the record actually edited. */
function taskContinueAction(t:Task):HTMLElement {
  const target=continueTarget(t),edit=node('div','','task-continue-context');
  const cur=project.currentTaskId?project.tasks.find(x=>x.id===project.currentTaskId):null;
  const edited=cur&&isReturnTask(project,cur)&&cur.parentTaskId===t.id?cur:t,owner=areaById(areaOf(project,edited));
  edit.id='task-continue-context';edit.dataset.taskId=edited.id;
  const current=cur&&cur.id!==edited.id?`현재 작업 ${pad(project.tasks.findIndex(x=>x.id===cur.id)+1)}에서 바꿀 대상 · `:'고칠 대상 · ';
  const label=node('span',`${current}작업 ${pad(project.tasks.findIndex(x=>x.id===edited.id)+1)} · ${owner?.name??'영역 미지정'}${edited.id!==t.id?' · 현재 보고의 후속 작업문':''}`,'hint');label.id='task-continue-label';edit.append(label);
  if(currentGroup(t))edit.append(appTag());
  edit.append(btn(target.button,()=>continueTask(t.id),'secondary','task-view-continue'));
  const detail=details('이어갈 대상 확인','task-continue-details'),which=node('p',target.text,'hint task-view-target');which.id='task-view-target';detail.append(which);
  edit.append(detail);
  return edit;
}
/** REPORT16: the picked report's own words first, level with the current idea beside it; then this request's reports as a
 * short pick list (existing title, source kind, time). Nothing is picked for the user; no unpicked report's text is listed. */
function reportsSection(t:Task,reports:Task[]):HTMLElement {
  const box=node('section','','task-reports');box.id='task-reports';box.setAttribute('aria-label','돌아온 보고');
  if(viewReturn!==null)box.append(pointedSection(t,viewReturn));
  const picker=node('div','','report-picker');
  picker.append(node('h2',`돌아온 결과 ${reports.length}개${reports.length?' · 외부 원문 · 앱 미검증':''}`,'report-picker-head'));
  if(!reports.length)picker.append(node('p',t.handoffs.length?'작업문을 내보낸 기록은 있지만 돌아온 결과는 아직 없어요. 개발 도구에서 실행됐는지는 앱이 알 수 없어요.':'아직 돌아온 결과가 없어요.','hint'));
  else {
    if(viewReturn===null){const none=node('p',reports.length>1?'읽을 보고를 골라 주세요. 최신 보고를 대신 고르지 않아요.':'읽을 보고를 골라 주세요.','hint');none.id='task-report-none';picker.append(none);}
    const list=node('ul','','report-pick-list');list.id='task-report-list';list.setAttribute('aria-label','읽을 보고 고르기');
    for(const r of reports) {
      const src=project.sources.find(s=>s.id===r.sourceIds[0]),path=returnPath(project,r),li=node('li');
      const b=btn('',()=>pickReport(r.id),'report-pick',`task-report-pick-${r.id}`);b.setAttribute('aria-pressed',String(r.id===viewReturn));
      b.append(node('span',taskTitle(project,r),'report-pick-title'),
        node('span',`작업 ${pad(project.tasks.indexOf(r)+1)} · ${src?sourceName[src.kind]:'원문 없음'} · ${src?dateLabel(src.at):'시각 미확인'}${path.length>2?' · 이전 보고에 연결':''}`,'report-pick-meta'));
      li.append(b);list.append(li);
    }
    picker.append(list);
  }
  box.append(picker);
  if(viewReturn!==null&&pointedReturn(project,t.id,viewReturn)){const help=details('잘못 가져온 보고라면','task-view-report-help');help.append(reportCorrectionHelp());box.append(help);}
  return box;
}
/** SPATIAL102 + REPORT16: one request, read-only. First: the area's current idea and the next action beside the report the user
 * picks. Editing this task stays the separate continue. Short context, original, work text, background copy and bases follow. */
function renderTaskView(root:HTMLElement,t:Task) {
  const area=areaById(areaOf(project,t)),first=sourceOf(project,t),reports=reportsOf(t);
  const head=node('div','','space-head task-view-head'),title=node('h1',taskTitle(project,t));title.id='space-title';title.tabIndex=-1;
  const top=node('div','','task-view-head-line');
  top.append(node('p',`요청 · ${area?`영역 ‘${area.name}’${area.archived?' · 보관됨':''}`:'영역 미지정'}`,'eyebrow'));
  // PC12: back to the view the reading started from; without one (e.g. after a reload) only a plain way to the whole space.
  top.append(originButton('task-return-origin')??btn('전체 공간으로',openSpace,'secondary','task-to-space'));
  const context=node('div','','task-view-head-line');
  context.append(node('p',`작업 ${pad(project.tasks.indexOf(t)+1)} · ${taskStatus(project,t)}`,'hint task-view-status'),taskContinueAction(t));
  head.append(top,title,context);
  root.append(head);
  const body=node('section','','area-tasks task-view');body.id='task-view';
  const read=node('div','','task-read'),side=node('div','','task-read-side');
  side.append(currentIdea(t,area),nextAction(t,area));read.append(side,reportsSection(t,reports));body.append(read);
  // PC12: this request's short context (each line says where it comes from); the original and conditions open when needed.
  const more=node('section','','task-more');more.append(node('h2','이 요청 자세히'),taskContext(t));
  const original=details(`요청 원문 보기 · 사용자 원문${first?` · ${first.text.length}자`:''}`,'task-view-request');
  if(first)original.append(node('p',`${sourceName[first.kind]} · ${dateLabel(first.at)}`,'source-id'),node('div',first.text,'source-raw'));
  else original.append(node('p','이 작업의 원문을 찾지 못했어요.','hint'));
  more.append(original,taskWorkDetails(t),backgroundPreview(t,'task-view-background'));
  body.append(more);root.append(body);
  const own=new Set([t.id,...returnsOf(t).map(r=>r.id)]),bases=project.bases.filter(b=>own.has(project.sources.find(s=>s.id===b.sourceId)?.taskId??''));
  const box=details(`이 작업의 기준 ${bases.length}개`,'task-view-bases');
  for(const b of bases)box.append(node('p',`${BASIS_LABEL[b.status]} · ${shortText(b.text,90)}`,'source-raw'));
  if(!bases.length)box.append(node('p','이 작업에서 나온 기준이 없어요.','hint'));
  box.append(btn('기준 · 출처 전체 보기',showContext,'quiet'));root.append(box);
  keepReadOpen(root,t);
}
/** REPORT16: the opening of a report as written: at most six lines and REPORT_LEAD characters, line breaks kept. */
const REPORT_LEAD=300;
const KIND_SHORT:Record<Source['kind'],string>={...sourceName,report:'구현자 보고',evidence:'관찰·검사 자료'};
function reportExportWork(r:Task):HTMLElement|null {
  if(!r.resultFile)return null;
  const box=details('이 결과를 요청할 때 내보낸 작업문','task-report-export-work');
  const missing=()=>box.append(node('p','이 보고에는 정확한 내보내기 작업문 사본이 없어요. 현재 작업문으로 대신하지 않았어요.','hint'));
  const file=parseResultFile(r.resultFile.rawText),target=project.tasks.find(t=>t.id===file.taskId),record=target?.handoffs.find(h=>h.returnId===file.returnId);
  box.dataset.handoffId=file.returnId;box.dataset.exportTaskId=file.taskId;
  if(!record?.work){missing();return box;}
  box.append(node('p',`${dateLabel(record.at)}에 내보낸 작업문이에요. 지금의 작업문이나 현재 기준과는 다를 수 있어요.`,'hint'));
  const labels:[keyof Task['manual'],string][]=[['understanding','짧은 이해'],['scope','이번 범위와 유지할 것'],['next','실행 도구에 전달할 작업문'],['checks','확인할 동작 / 완료 조건']];
  for(const [key,label] of labels){const row=node('section');row.dataset.exportField=key;row.append(node('p',label,'source-meta'),node('div',record.work[key]||'(비어 있음)','source-raw'));box.append(row);}
  const proof=details('인계 연결 · 수신 원문','task-report-export-proof');proof.append(node('p',`내보낸 작업 ${file.taskId}\n인계 ${file.returnId}\n받은 보고 ${r.id}\n내보낸 버전 r${record.revision}`,'source-id'),rawFileDetails(r.resultFile.rawText,file.returnId,'task-report-result-raw'));box.append(proof);return box;
}
function leadOf(text:string,count=6,limit=REPORT_LEAD):string {
  const lines=text.split('\n');let lead=lines.slice(0,count).join('\n');
  if(lead.length>limit)lead=lead.slice(0,limit);
  return lead.length<text.length?`${lead.trimEnd()}…`:text;
}
/** SPATIAL102-R1 + REPORT16: the picked report (or the one a check item pointed to). Every source of that report task is reachable
 * in full; a missing source is said, never replaced or skipped. A stale or foreign id is said plainly, never swapped. */
function pointedSection(t:Task,returnId:string):HTMLElement {
  const box=node('section','','task-pointed');box.id='task-pointed';
  const r=pointedReturn(project,t.id,returnId);
  if(!r){box.append(node('p','고른 보고','source-meta'),node('p','가리킨 보고를 찾을 수 없어요. 지워졌거나(다른 탭·백업 복원) 이 요청의 보고가 아니에요. 다른 보고로 대신 보여 주지 않았어요. 아래에서 직접 고를 수 있어요.','alert warning'));return box;}
  box.dataset.reportTaskId=r.id;
  const no=(x:Task)=>`작업 ${pad(project.tasks.indexOf(x)+1)}`,path=returnPath(project,r),first=project.sources.find(s=>s.id===r.sourceIds[0]);
  // One low-emphasis line, level with the idea's own label: which report, whose words, unverified.
  const one=r.sourceIds.length===1&&first?` · ${KIND_SHORT[first.kind]}`:'';
  box.append(node('p',`고른 보고 · ${no(r)}${one} · ${first?dateLabel(first.at):'시각 미확인'} · 외부 원문 · 앱 미검증`,'source-meta'));
  const update=returnUnderstanding(project,r.id);
  if(update){const status=update.entry?.held?'설명은 현재 기준에 적용하지 않았어요.':update.current?'이 보고의 정리가 현재 영역 설명에 반영됐어요.':'이 보고에 붙은 정리는 이전 기록으로 보관돼요.';box.append(node('p',status,'hint'));const detail=details('이 보고의 정리 설명','task-report-understanding');detail.append(node('p',update.input.summary,'source-raw'),node('p',`정리: ${update.input.origin} · 앱 미검증`,'hint'));if(update.input.proposal)detail.append(node('p','미채택 제안','source-meta'),node('p',update.input.proposal,'source-raw'));box.append(detail);}
  for(const id of r.sourceIds) {
    const src=project.sources.find(s=>s.id===id);
    if(!src){box.append(node('p',`이 보고의 원문 하나(${id})를 찾지 못했어요. 다른 원문으로 대신하지 않았어요.`,'alert warning'));continue;}
    const text=reportBody(src),part=node('div','','report-source');part.dataset.sourceId=src.id;
    if(r.sourceIds.length>1)part.append(node('p',KIND_SHORT[src.kind],'source-meta'));
    // Read with the idea beside it: a short report is shown whole; a long one shows its opening lines as written (not a
    // summary), says so, and the whole text is one explicit click away.
    const lead=leadOf(text);
    if(lead===text)part.append(node('div',text,'report-lead whole'));
    else {
      const full=details(`${src.kind==='evidence'?'관찰·검사 자료':'보고'} 전문 보기 · ${text.length}자`,`task-report-src-${src.id}`);
      full.append(node('div',text,'source-raw'));
      part.append(node('div',lead,'report-lead'),node('p','위는 앞부분이에요 · 요약이 아니에요','report-lead-note'),full);
    }
    box.append(part);
  }
  // SPATIAL102-R2: only the recorded links. A link is not an export, a delivery or a run, so the wording never infers one.
  const exported=reportExportWork(r);if(exported)box.append(exported);
  const hops=path.map((x,i)=>i===0?`${no(x)} 요청`:i===path.length-1?`${no(x)} 이 보고`:`${no(x)} 보고`);
  const link=details(`연결 경로 보기 · ${path.length>2?'이전 보고에 연결된 보고':'이 요청에 바로 연결된 보고'}`,'task-report-path');
  link.append(node('p',`연결: ${hops.join(' › ')}`,'hint'));
  if(!r.resultFile){const note=node('p','이 보고와 정확히 연결된 당시 자료 사본은 없어요. 현재 내용으로 대신하지 않아요.','hint');note.id='task-report-context-missing';link.append(note);}
  box.append(link);
  return box;
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
  const bar=$('work-place');bar.replaceChildren();bar.hidden=!hasSpace(project);if(bar.hidden)return;
  const area=t?areaById(areaOf(project,t)):null;
  bar.append(btn('전체 공간',()=>{endRecordsExcursion();openSpace();},'crumb-link','place-space'));
  if(area){bar.append(node('span','›','crumb-sep'),btn(area.name,()=>openArea(area.id),'crumb-link','place-area'));$('place-area').title=area.name;}
  const receipt=t?receiptOf(t):null;
  bar.append(node('span','›','crumb-sep'),node('strong',!t?'새 요청':receipt!==null?`${receipt>=0?`작업 ${pad(receipt+1)}의 보고 · `:''}후속 확인 작업문 초안`:'앱에서 이어갈 작업'),node('span','이어가는 작업','layer-chip'));
  if(route==='example')bar.append(node('span','예제 · 저장 안 됨','layer-chip example-chip'));
  // PC12: after reading a task from the map, the way back to that view (the edits made here stay).
  const back=originButton('work-return-origin');if(back)bar.append(back);
  // AREA17: writing (and sending, copying) the located area's next request keeps the way back to the view before locating,
  // only while that request or work is in the located area.
  const l=located,target=project.space.draftTarget?project.space.draftTarget.area:t?areaOf(project,t):null;
  if(l&&l.origin.project===project.id&&target===l.area&&!areaById(l.area)?.archived)
    bar.append(btn(`← 위치 찾기 전 보기로 · ${originLabel(l.origin)}`,returnFromLocate,'secondary origin-return','work-locate-return'));
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
function render(capturePanel=true,restoreReading=true,beforeWorkspaceSizing?:()=>void) {
  if(capturePanel)capturePanelReading();
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
  $('input-hint').textContent=returned?'받은 보고를 그대로 붙여넣고 연결할 작업을 확인하세요. 검증 완료로 바꾸지 않습니다.':project.draftKind==='test_answer'?'합성 시험자료로만 보관합니다. 실제 요청과 확정 기준은 바꾸지 않습니다.':config?.mode==='mock'?'MOCK은 정해진 규칙으로 작업문을 준비해요. 요청의 의미를 이해해 요약하거나 필요한 질문을 모두 찾아 주지는 않아요.':'필요한 질문만 받고, 바로 전달할 작업문을 준비해요.';
  $<HTMLTextAreaElement>('draft').placeholder=returned?'받은 결과 요약이나 변경 내용, 실행한 검사와 남은 일을 그대로 붙여넣으세요. 정해진 양식은 없어요.':project.tasks.length?'이번에 바꿀 부분만 적어 주세요. 앞에서 정한 기준은 함께 이어갑니다.':'무엇을 만들고 싶나요? 이미 작업 중이라면, 지금 바꾸고 싶은 부분만 알려주세요.';
  $('send').replaceChildren(document.createTextNode(returned?'결과에서 이어가기':'작업문 준비하기'),node('span',''));
  $('starter-examples').hidden=!!project.tasks.length||returned;
  $('brief-form').hidden=!!project.space.brief||route==='example';
  $('compose-panel').classList.toggle('initial',!project.tasks.length);
  const t=project.currentTaskId?taskOf(project):null;
  renderOutcome(t);renderBases(t);renderHistory();renderWork(t);renderReturnPreview();renderResultFile();renderSpace();renderPlace(t);renderComposeArea(t,returned);renderStatus();displayView();
  // REPORT16-fix1: on the task screen, readOpen alone decides its disclosures (per request; a picked report's own parts per report).
  // Restoring them from the old DOM by id would carry one report's open part (e.g. task-report-path) over to another report.
  const taskScreen=view==='task'?$('space-view'):null;
  for(const d of document.querySelectorAll<HTMLDetailsElement>('details[id]'))if(open.has(d.id)&&d.id!=='project-management'&&!taskScreen?.contains(d)&&!d.closest('#area-panel'))d.open=open.get(d.id)!;
  // A layer entry may restore page scroll after its final DOM/disclosures, before sizing or its first camera/reading restore.
  beforeWorkspaceSizing?.();sizeWorkspace();finishInitialMapFit();if(restoreReading)restorePanelReading();restoreWorkReferenceReading();
  if(focus){const target=document.getElementById(focus.id) as HTMLTextAreaElement|HTMLInputElement|null;if(target){target.focus({preventScroll:true});if(focus.start!=null&&focus.end!=null)try{target.setSelectionRange(focus.start,focus.end);}catch{/* A button has no selection range. */}}}
}
function submitInput(withAI:boolean) {
  if(project.pending||!project.draft.trim()||returnChoiceRequired()||(withAI&&!readyForAI()))return;
  guard(()=>{
    const parked=project.draftKind==='request'&&project.space.draftTarget?.area?project.space.areas.find(a=>a.id===project.space.draftTarget!.area&&a.archived):undefined;
    if(parked){project={...project,notice:`이 요청의 영역 ‘${parked.name}’은 보관돼 있어요. 영역을 되살리거나 다른 영역을 고른 뒤 보내세요.`};renderStatus();return;}
    // USE106: validate the visible first-purpose input and request together before changing live state.
    // submit captures this existing brief as background, not as a source/decision; old task copies stay untouched.
    let candidate=project;
    const brief=$<HTMLTextAreaElement>('brief-input');
    const firstRequest=!project.tasks.length&&project.draftKind==='request';
    const entryBrief=firstRequest&&!$('brief-form').hidden?brief.value.trim():'';
    if(entryBrief)candidate=setBrief(candidate,entryBrief);
    // A rejected input event may leave invalid visible text beside the last valid draft. Never submit that older draft.
    if(firstRequest&&$<HTMLTextAreaElement>('draft').value!==candidate.draft)candidate=editDraft(candidate,$<HTMLTextAreaElement>('draft').value);
    // No naming step: a still-default name becomes the first request's opening words.
    if(firstRequest&&candidate.name===createProject().name)candidate=rename(candidate,shortText(candidate.draft,30));
    const next=submit(candidate,returnTargets(project).length>1?selectedReturnTaskId:undefined);
    selectedReturnTaskId=undefined;commit(next);
    if(firstRequest){brief.value='';$<HTMLButtonElement>('brief-start').disabled=true;}
    $<HTMLDetailsElement>('compose-panel').open=false;showWork();focusWorkTop();// FIX088: a result filed to another task leaves the current work as it was: no AI run on it, no edit panel.
    if(next.currentTaskId!==next.tasks.at(-1)!.id)return;
    if(withAI)void generate(project.currentTaskId!);else {$<HTMLDetailsElement>('edit-work').open=true;$('work-next').focus();}});
}
$('compose').addEventListener('submit',e=>{e.preventDefault();submitInput(true);});
$('save-input').addEventListener('click',()=>submitInput(false));
$('draft').addEventListener('input',()=>guard(()=>commit(editDraft(project,$<HTMLTextAreaElement>('draft').value),false)));
$('project-name').addEventListener('input',()=>{fitNameField();const value=$<HTMLInputElement>('project-name').value;if(value.trim())guard(()=>commit(rename(project,value),false));});
$('project-name').addEventListener('blur',()=>{$<HTMLInputElement>('project-name').value=project.name;fitNameField();});
void document.fonts?.ready.then(fitNameField);
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
  const read=++resultRead,epoch=projectEpoch,projectId=project.id,revision=project.revision,current=project.currentTaskId,from=view;
  const entry=target.kind==='entry'?target.ref.entryId:null;
  const revealToken={context:contextOpen};resultRevealToken=revealToken;
  const reveal=()=>{
    if(resultRevealToken!==revealToken||read!==resultRead||epoch!==projectEpoch||project.id!==projectId||entry!==(target.kind==='entry'?target.ref.entryId:null)||from!=='work'||view!=='work'||route==='projects'||revision!==project.revision||current!==project.currentTaskId)return;
    const focus=document.getElementById('result-file-review-heading')??document.getElementById('result-file-error')??document.getElementById('result-file-message');if(!focus)return;
    $<HTMLDetailsElement>('compose-panel').open=true;$<HTMLDetailsElement>('result-file-panel').open=true;
    focus.tabIndex=-1;focus.scrollIntoView({block:'center'});focus.focus({preventScroll:true});
  };
  lastReceipt=null;resultSelection=null;resultMessage='선택한 파일을 읽는 중입니다. 아직 가져오지 않았습니다.';renderResultFile();
  try {
    if(file.size>RESULT_BYTES)throw new Error('RESULT_TOO_LARGE');
    const bytes=await file.arrayBuffer();
    if(read!==resultRead||epoch!==projectEpoch||project.id!==projectId||entry!==(target.kind==='entry'?target.ref.entryId:null))return;
    const rawText=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
    resultSelection={rawText,projectId,revision:project.revision,epoch};resultMessage='원문과 연결 대상을 확인한 뒤 가져오세요.';renderResultFile();
    reveal();
  }catch(e){if(read!==resultRead||epoch!==projectEpoch)return;resultMessage=resultError(e)+' 파일 수리나 재실행 없이 기존 붙여넣기를 이용할 수 있습니다.';renderResultFile();reveal();}
  finally{if(resultRevealToken===revealToken)resultRevealToken=null;}
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
  if(!await leaveProject('새 프로젝트로 가면'))return;startNew();render();restoreDraftPanels();focusNewStart();})());
$('trash-current').addEventListener('click',()=>{if(target.kind==='entry')void trashProject(target.ref.entryId,project.name);});
$('undo-trash').addEventListener('click',()=>{if(undoEntry!==null)void restoreProject(undoEntry,true);});
$('list-import').addEventListener('click',()=>$<HTMLInputElement>('import-file').click());
$('open-example').addEventListener('click',()=>void openExample());
$('example-start').addEventListener('click',()=>closeExample(true));
$('example-close').addEventListener('click',()=>closeExample(false));
// SOURCE40: the home's separate proposal review (tab memory only; never the project, its draft or the map memo).
initSourceReview();
/** Explicit navigation starts a new excursion. Part/endpoint locators and same-part actions keep their first caller. */
function endRecordsExcursion(){
  branchRecordCaller=null;
  let ended=false;
  if(origin?.view==='work'){origin=origin.work.upstream;ended=true;}
  if(located?.origin.view==='work'){located=null;ended=true;}
  if(located?.origin.panel==='records'){located=null;ended=true;}
  if(origin?.panel==='records'){origin=null;ended=true;}
  recordsReturnNotice='';if(ended)renderPlace(project.currentTaskId?taskOf(project):null);
}
$('nav-space').addEventListener('click',()=>{endRecordsExcursion();openSpace();});
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
$('nav-work').addEventListener('click',()=>{if(project.currentTaskId&&workMemo?.task===project.currentTaskId){resumeWork(false);return;}endRecordsExcursion();contextOpen=false;showWork();$('context-title').scrollIntoView({block:'nearest'});});
$('nav-context').addEventListener('click',()=>{if(contextOpen&&view==='work')closeContext();else showContext();});
$('close-context').addEventListener('click',closeContext);
$('nav-history').addEventListener('click',()=>{endRecordsExcursion();view='history';displayView();$<HTMLDetailsElement>('history').open=true;$('history-title').focus();});
$('back-to-work').addEventListener('click',()=>{showWork();$('nav-work').focus();});
for(const example of document.querySelectorAll<HTMLButtonElement>('[data-example]'))example.addEventListener('click',()=>guard(()=>{commit(editDraft(project,example.dataset.example!));$('draft').focus();}));
{
  const dialog=$<HTMLDialogElement>('project-read');
  $('project-read-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',closeReading);
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();}); // the backdrop
  // The list behind stays where it was: the wheel scrolls only the text (which does not hand its overscroll to the page).
  dialog.addEventListener('wheel',e=>{if(!$('project-read-body').contains(e.target as Node))e.preventDefault();},{passive:false});
  dialog.addEventListener('keydown',e=>{
    if(e.defaultPrevented)return;
    if(e.key==='Escape'&&(e.isComposing||e.keyCode===229)){e.preventDefault();return;}
    // Keyboard scrolling is not stopped by overscroll-behavior: a scroll key would scroll the list behind. In the text it scrolls
    // the text and is stopped only at its end (or top); anywhere else in the window (e.g. on '닫기') it scrolls nothing.
    // Space/Enter on a button keep their own action (close).
    const body=$('project-read-body');
    if(['PageDown','PageUp','End','Home','ArrowDown','ArrowUp',' '].includes(e.key)){
      if(e.target===body){
        const down=['PageDown','End','ArrowDown'].includes(e.key)||(e.key===' '&&!e.shiftKey);
        if(down?body.scrollTop+body.clientHeight>=body.scrollHeight-1:body.scrollTop<=0)e.preventDefault();
      } else if(!(e.key===' '&&(e.target as HTMLElement).closest('button')))e.preventDefault();
      return;
    }
    if(e.key!=='Tab')return;
    const stops=[$('project-read-close'),$('project-read-body')];const i=stops.indexOf(document.activeElement as HTMLElement);
    e.preventDefault();stops[(i<0?0:i+(e.shiftKey?stops.length-1:1))%stops.length]!.focus();
  });
}
// HOME15: a click elsewhere closes an open card menu. On a card that click only closes the menu; it does not open a project.
document.addEventListener('click',e=>{
  const open=[...document.querySelectorAll<HTMLDetailsElement>('.project-more[open]')].filter(m=>!m.contains(e.target as Node));if(!open.length)return;
  for(const m of open)m.open=false;
  const t=e.target as HTMLElement;if(t.closest?.('.project-card')&&!t.closest('.project-more')){e.preventDefault();e.stopPropagation();}
},true);
// HOME15: Escape closes an open card menu wherever the focus is (e.g. after a click on the menu's own padding).
function protectedEscape(e:KeyboardEvent):boolean {return e.defaultPrevented||e.isComposing||e.keyCode===229||!!(e.target as HTMLElement|null)?.closest?.('input,textarea,select,[contenteditable="true"],[role="combobox"]');}
document.addEventListener('keydown',e=>{if(e.key!=='Escape'||protectedEscape(e)||$<HTMLDialogElement>('project-read').open)return;const m=document.querySelector<HTMLDetailsElement>('.project-more[open]');if(!m)return;
  e.stopImmediatePropagation();m.open=false;m.querySelector('summary')?.focus({preventScroll:true});},true);
document.addEventListener('click',e=>{const menu=$<HTMLDetailsElement>('project-management');if(compactMapHeader&&menu.open&&!menu.contains(e.target as Node))menu.open=false;});
document.addEventListener('keydown',e=>{if(e.key!=='Escape'||protectedEscape(e)||$<HTMLDialogElement>('project-read').open)return;const menu=$<HTMLDetailsElement>('project-management');if(compactMapHeader&&menu.open){e.preventDefault();menu.open=false;$('project-management-toggle').focus({preventScroll:true});}else if($<HTMLDetailsElement>('connection-details').open){e.preventDefault();$<HTMLDetailsElement>('connection-details').open=false;$('connection-details').querySelector('summary')!.focus();}else if(contextOpen){e.preventDefault();closeContext();}});
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
