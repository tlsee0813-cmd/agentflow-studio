import { BASIS_LABEL, SOURCE_LABEL, FILE_LIMIT, type Basis, type Project, type Task, type Source } from '../shared/types.js';
import { createProject, editDraft, editAuxDraft, editBasisDraft, setKind, rename, submit, recordBasis, editTask, editSuggestion,
  answer, begin, receive, failed, cancel, taskOf, taskSuggestions, relatedBases, taskStatus, handoffText, markHandoff, currentWork, questionAnswered, staleText } from '../shared/domain.js';
import { parseProject } from '../shared/validation.js';
import { ProjectStore, serializeProject, storageErrorCode } from '../shared/storage.js';
import { sourceName, sourceOf, taskTitle, dateLabel, basisDraftChanged, stageOf, exportNeedsRefresh, workOrigin } from './presentation.js';
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
function node<K extends keyof HTMLElementTagNameMap>(tag:K,content='',cls=''):HTMLElementTagNameMap[K] {
  const e=document.createElement(tag);e.textContent=content;if(cls)e.className=cls;return e;
}
function btn(label:string,act:()=>void,cls='quiet',id='') {const b=node('button',label,cls);b.type='button';if(id)b.id=id;b.addEventListener('click',()=>guard(act));return b;}
function tag(content:string,cls=''){return node('span',content,`tag ${cls}`);}
function details(title:string,id:string):HTMLDetailsElement {const d=node('details');d.id=id;d.append(node('summary',title));return d;}
let project:Project=createProject(),store:ProjectStore|null=null,storageError='';
let config:{mode:'mock'|'deepseek';configured:boolean;paidEnabled:boolean}|null=null;
let controller:AbortController|null=null;
// View preferences are ephemeral. They never enter the persisted project or request schema.
let view:'work'|'history'='work',contextOpen=false,hasSaved=false,memoryDirty=false;
let contextReturn:HTMLElement|null=null;
try {store=new ProjectStore(window.localStorage);const restored=store.load();if(restored){project=restored;hasSaved=true;}}
catch {storageError='기존 저장 내용을 읽지 못했습니다. 덮어쓰지 않습니다. 이 화면의 입력은 메모리에 남으며 복구 파일로 저장할 수 있습니다.';}
const storageMessages:Record<string,string>={
  STORAGE_BLOCKED:'기존 저장 내용을 읽지 못해 덮어쓰지 않고 있습니다. 이 탭의 입력은 메모리에 있습니다. 복구 파일을 저장하고, 필요하면 ‘가져오기’로 교체하면 자동 저장이 다시 켜집니다.',
  LEGACY_UNPRESERVED:'이전 형식 저장 내용의 원본을 브라우저에 따로 보관하지 못해 덮어쓰지 않도록 자동 저장을 멈췄습니다. 복구 파일을 저장한 뒤 ‘가져오기’로 교체하면 다시 켜집니다.',
  STORAGE_CONFLICT:'다른 탭에서 저장한 내용이 있어 덮어쓰지 않았습니다. 이 탭의 입력은 남아 있습니다. 닫기 전에 복구 파일을 저장하세요.',
  FILE_TOO_LARGE:'프로젝트가 자동 저장 한도를 넘었습니다. 입력은 이 탭에 남아 있습니다. 복구 파일을 저장하세요.',
  INVALID_DATA:'저장 형식 검사를 통과하지 못해 저장하지 않았습니다. 다시 열 수 없는 상태를 덮어쓰지 않았고, 입력은 이 탭에 남아 있습니다. 복구 파일을 저장하세요.',
  QUOTA:'브라우저 저장 공간이 부족해 자동 저장하지 못했습니다. 입력은 이 탭에 남아 있습니다. 복구 파일을 저장하세요.',
  WRITE_FAILED:'자동 저장하지 못했습니다. 저장 권한을 확인하세요. 입력은 이 탭에 남아 있습니다. 닫기 전에 복구 파일을 저장하세요.'};
function persist() {
  try {if(!store)throw new Error();store.save(project);storageError='';hasSaved=true;memoryDirty=false;}
  catch(e) {storageError=storageMessages[store?storageErrorCode(e):'WRITE_FAILED']!;memoryDirty=true;}
}
function commit(p:Project,redraw=true) {project=p;persist();if(redraw)render();else renderStatus();}
function guard(action:()=>void) {try{action();}catch{project={...project,notice:'입력 또는 자료를 처리하지 못했습니다. 기존 내용은 그대로 보존했습니다. 길이·형식을 확인하세요.'};renderStatus();}}
function readyForAI():boolean {return !!config&&(config.mode==='mock'||(config.configured&&config.paidEnabled&&$<HTMLInputElement>('consent').checked));}
function displayView() {
  $('work-view').hidden=view!=='work';$('history-view').hidden=view!=='history';
  $('context-panel').hidden=!contextOpen;$('workspace').classList.toggle('details-open',contextOpen);
  $('nav-context').setAttribute('aria-expanded',String(contextOpen));
  for(const [id,active] of [['nav-work',view==='work'&&!contextOpen],['nav-context',view==='work'&&contextOpen],['nav-history',view==='history']] as const){
    $(id).classList.toggle('active',active);if(active)$(id).setAttribute('aria-current','page');else $(id).removeAttribute('aria-current');
  }
}
function showWork() {view='work';displayView();}
function openComposer(kind:Project['draftKind']='request') {
  showWork();
  // A return CTA must not silently relabel an unsent request as an implementer's report.
  if(project.draftKind!==kind){
    if(project.draft.trim()){project={...project,notice:'작성 중인 입력이 있어 먼저 열었습니다. 내용과 출처 구분은 바꾸지 않았습니다. 이 입력을 마친 뒤 결과를 붙여넣으세요.'};renderStatus();}
    else commit(setKind(project,kind));
  }
  $<HTMLDetailsElement>('compose-panel').open=true;$('draft').focus();
}
function showContext() {
  contextReturn=document.activeElement as HTMLElement|null;view='work';contextOpen=true;displayView();
  $('panel-title').focus({preventScroll:true});$('context-panel').scrollIntoView({block:'nearest'});
}
function closeContext() {contextOpen=false;displayView();(contextReturn??$('nav-context')).focus({preventScroll:true});}
function renderStatus() {
  $('notice').textContent=project.notice??'';$('notice').hidden=!project.notice;
  $('storage-error').textContent=storageError;$('storage-error').hidden=!storageError;
  $('saved').textContent=hasSaved?'이 브라우저에 저장됨':'이 브라우저에 자동 저장';
  if(storageError)$('saved').textContent='저장되지 않은 변경 있음';
  $('saved').classList.toggle('failed',!!storageError);
  const ready=readyForAI(),pending=!!project.pending;
  $<HTMLButtonElement>('send').disabled=!ready||pending||!project.draft.trim();
  $<HTMLButtonElement>('save-input').hidden=ready;$<HTMLButtonElement>('save-input').disabled=pending||!project.draft.trim();
  $('cancel').hidden=!pending;$('pending-bar').hidden=!pending;
  $('working').textContent=pending?'정리 응답을 기다리는 중 · 입력은 계속 수정할 수 있어요.':'';
  $('work').setAttribute('aria-busy',String(pending));
  for(const b of document.querySelectorAll<HTMLButtonElement>('[data-ai-action]'))b.disabled=pending||!ready;
  for(const b of document.querySelectorAll<HTMLButtonElement>('.option-button, #answer-unknown, #answer-defer'))b.disabled=pending;
  if($('answer-send'))$<HTMLButtonElement>('answer-send').disabled=pending||!project.answerDraft.trim();
  $('compose-draft-status').textContent=project.draft.trim()?'작성 중인 입력 있음':'';
  $('basis-draft-status').textContent=project.basisDraft.trim()?'작성 중 · 기록 버튼을 누르면 기준에 반영됩니다.':'';
  for(const basis of project.bases){const marker=$(`draft-status-${basis.id}`);if(marker){marker.textContent=basisDraftChanged(project,basis)?'작성 중 · 현재 기준에는 아직 반영되지 않았어요.':'';marker.hidden=!basisDraftChanged(project,basis);}}
  if($('basis-form'))$<HTMLButtonElement>('basis-form').querySelector('button')!.disabled=!project.currentTaskId||!project.basisDraft.trim();
  document.title=`${project.name} · AgentFlow Studio`;
  $('sidebar-project').textContent=project.name;$('breadcrumb-project').textContent=project.name;
  const t=project.currentTaskId?taskOf(project):null,stage=stageOf(project,t);
  $('task-number').textContent=t?`현재 작업 ${String(project.tasks.indexOf(t)+1).padStart(2,'0')}`:'첫 작업';
  $('context-title').textContent=stage.title;$('context-sub').textContent=stage.next;$('stage-label').textContent=stage.label;
  $('stage-label').dataset.stage=stage.kind;
  const report=[...project.sources].reverse().find(s=>s.kind==='report'||s.kind==='evidence');
  $('last-result').hidden=!report;
  if(report){const reportTask=project.tasks.find(x=>x.id===report.taskId),parent=project.tasks.findIndex(x=>x.id===reportTask?.parentTaskId);
    $('last-result-summary').textContent=`최근 가져온 결과 · ${dateLabel(report.at)}${parent>=0?` · 작업 ${parent+1}에 연결`:''} · 앱 미검증`;
    $('last-result-text').textContent=report.text;}
  $('sidebar-task').textContent=t?`작업 ${project.tasks.indexOf(t)+1} · ${taskTitle(project,t)}`:'첫 작업을 기다리고 있어요.';
  for(const [i,id] of ['journey-request','journey-handoff','journey-report'].entries()){$(id).classList.toggle('current',i+1===stage.step);$(id).classList.toggle('past',i+1<stage.step);if(i+1===stage.step)$(id).setAttribute('aria-current','step');else $(id).removeAttribute('aria-current');}
  if($('handoff-ready'))$('handoff-ready').hidden=stage.kind!=='exported';
  if($('bring-report'))$('bring-report').textContent=project.draft.trim()?'작성 중인 입력 이어쓰기':'결과 붙여넣기';
  if($('copy-work')){const copy=$<HTMLButtonElement>('copy-work');copy.className=stage.kind==='exported'||stage.kind==='question'?'secondary':'primary';copy.textContent=t&&exportNeedsRefresh(project,t)?'수정한 작업문 복사':'작업문 복사';}
}
const errorMessages:Record<string,string>={
  INVALID_RESPONSE:'응답 형식이 올바르지 않아 적용하지 않았습니다.',AI_TIMEOUT:'정리 요청 시간이 초과됐습니다.',
  AI_NOT_CONFIGURED:'서버에 AI 연결이 설정되지 않았습니다.',PAID_CALLS_DISABLED:'서버에서 유료 호출을 허용하지 않았습니다.',
  PROCESS_CALL_CAP:'이 서버 프로세스의 요청 한도에 도달했습니다.',LOCAL_RATE_LIMIT:'요청 간격 제한에 도달했습니다.',
  AI_BUSY:'서버가 다른 요청을 처리 중입니다.',DUPLICATE_REQUEST:'이미 접수한 요청입니다. 자동으로 다시 보내지 않습니다.',
  AI_RATE_LIMIT:'제공업체의 요청 제한 응답입니다.',AI_AUTH_FAILED:'AI 인증이 거절됐습니다.',AI_BALANCE_REQUIRED:'제공업체 잔액 관련 오류입니다.',
  AI_CONFIG_REJECTED:'제공업체가 요청 설정을 거절했습니다.',INPUT_TOO_LARGE:'문맥이 요청 크기 한도를 넘었습니다. 자동으로 기준을 잘라 보내지 않았습니다. 작업문 복사·저장과 복구 파일은 계속 쓸 수 있습니다.'};
async function generate(id:string) {
  if(project.pending)return;
  if(!config||!(config.mode==='mock'||config.configured&&config.paidEnabled&&$<HTMLInputElement>('consent').checked)) {commit({...project,notice:'실제 AI 모드는 서버 설정과 프로젝트 문맥 전송 동의가 필요합니다.'});return;}
  let started;
  try {started=begin(project,id);} catch {commit({...project,notice:'AI 전송 문맥이 한도를 넘거나 유효하지 않아 보내지 않았습니다. 확정 기준을 잘라 보내지 않았습니다. 작업문 복사·Markdown 저장과 복구 파일은 계속 쓸 수 있습니다.'});return;}
  controller?.abort();const active=new AbortController();controller=active;commit(started.project);
  $('pending-bar').scrollIntoView({block:'nearest'});
  try {
    const response=await fetch('/api/continuity',{method:'POST',headers:{'Content-Type':'application/json','X-AgentFlow-Request':'1'},body:JSON.stringify(started.request),signal:active.signal});
    const raw=await response.text();let data;
    try {data=JSON.parse(raw);}catch {throw new Error('INVALID_RESPONSE');}
    if(!response.ok)throw new Error(typeof data?.error?.code==='string'?data.error.code:'REQUEST_FAILED');
    if(data?.mode!==config.mode)throw new Error('INVALID_RESPONSE');
    commit(receive(project,started.request,data));
  } catch(e) {
    if(!active.signal.aborted) {
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
async function exportWork(id:string,method:'clipboard'|'download') {
  let text:string;const exportRevision=project.revision,exportProjectId=project.id;
  try {text=handoffText(project,id);}catch {project={...project,notice:'작업 문맥 데이터가 유효하지 않아 내보내지 않았습니다. 복구 파일로 내용을 보존하세요.'};renderStatus();return;}
  if(method==='download'){download(`${safeName(project.name)}-작업문.md`,text,'text/markdown;charset=utf-8');commit(markHandoff(project,id,text,method,exportRevision));return;}
  try {await navigator.clipboard.writeText(text);
    if(project.id!==exportProjectId||project.revision!==exportRevision){project={...project,notice:'작업문은 복사됐지만 그 사이 입력이 바뀌었습니다. 현재 내용의 내보내기 기록으로 표시하지 않았습니다. 최신 작업문이 필요하면 다시 복사하세요.'};renderStatus();return;}
    commit(markHandoff(project,id,text,method,exportRevision));project={...project,notice:'작업문을 클립보드에 복사했습니다. 실행 도구에 직접 붙여넣으세요. 전송·실행된 것은 아닙니다.'};renderStatus();}
  catch {
    project={...project,notice:'클립보드를 사용할 수 없습니다. 아래 작업문을 직접 선택해 복사하거나 파일로 저장하세요.'};render();
    const d=$<HTMLDetailsElement>('handoff-preview');d.open=true;const field=$<HTMLTextAreaElement>('handoff-text');field.focus();field.select();
  }
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
    const e=node('div','','history-item');e.append(node('strong',`작업 ${String(index+1).padStart(2,'0')}`),tag(taskStatus(project,t)));
    e.append(node('p',taskTitle(project,t),'history-task-title'));const first=sourceOf(project,t);if(first)e.append(node('small',`${sourceName[first.kind]} · ${dateLabel(first.at)}`));
    const d=details('입력 원문 · 내보낸 기록',`history-${t.id}`);
    for(const id of t.sourceIds){const s=project.sources.find(s=>s.id===id)!;d.append(node('p',SOURCE_LABEL[s.kind]),node('div',s.text,'source-raw'));}
    for(const h of t.handoffs){d.append(node('p',`${h.at} · ${h.method==='clipboard'?'복사':'파일 생성'} · 당시 기준 r${h.revision} · ${h.chars}자 · 식별 ${h.digest}${h.aiExcluded?' · 낡은 AI 문구 제외':''} (실행 여부 모름)`,'hint'));
      if(h.work)for(const [k,value] of Object.entries(h.work))if(value)d.append(node('div',`${k}: ${value}`,'source-raw'));
      if(h.legacyText){const old=details('이전 형식에서 보존한 내보낸 전문',`legacy-${t.id}-${h.digest}`);old.append(node('div',h.legacyText,'source-raw'));d.append(old);}}
    e.append(d);list.append(e);
  }
  if(!project.tasks.length)list.append(node('p','아직 작업 기록이 없습니다. 첫 요청을 남기면 이곳에서 다시 볼 수 있어요.','hint'));
}
function renderWork(t:Task|null) {
  const area=$('work');area.replaceChildren();$('empty').hidden=!!t;if(!t)return;
  const w=currentWork(project,t),v=w.values,card=node('div','','card work-card');card.id='current-work';card.tabIndex=-1;
  const local=project.sources.filter(s=>t.sourceIds.includes(s.id));
  const heading=node('div','','work-heading'),h=node('div');h.append(node('p',`TASK ${String(project.tasks.indexOf(t)+1).padStart(2,'0')}`,'eyebrow'),node('h2','이어갈 작업'));
  const origin=tag(workOrigin(t),'purple');origin.id='work-authorship';heading.append(h,origin);card.append(heading);
  const first=sourceOf(project,t),raw=details(first?sourceName[first.kind]:'입력 원문','current-source');raw.className='task-source';
  raw.querySelector('summary')!.append(node('span',taskTitle(project,t),'task-source-title'));
  for(const source of local){raw.append(tag(sourceName[source.kind]),node('p',dateLabel(source.at),'source-meta'));if(source.replyTo)raw.append(node('p',`앞선 질문: ${source.replyTo}`,'hint'));raw.append(node('div',source.text,'source-raw'),node('p',source.id,'source-id'));}
  card.append(raw);
  const next= node('div','','handoff-ready');next.id='handoff-ready';
  const exported=t.handoffs.at(-1),nextText=node('div');nextText.append(node('strong','작업 결과를 받으셨나요?'),node('p',exported?`${dateLabel(exported.at)} · ${exported.method==='clipboard'?'복사':'파일 저장'} 기록이 있어요. 외부 실행 여부는 알 수 없습니다.`:'작업문을 전달한 도구에서 받은 내용을 그대로 가져오세요.'));
  next.append(nextText,btn('결과 붙여넣기',()=>openComposer('report'),'primary','bring-report'));card.append(next);
  const summary=node('p',v.understanding||(w.aiStale?'이전 AI 정리는 제외하고 원문과 현재 기준을 보존했어요.':'원문은 보관했습니다. 정리 결과가 없어도 직접 작업문을 작성할 수 있어요.'),'work-summary');summary.id='work-summary';card.append(summary);
  const stale=staleText(project,t);
  if(stale){const banner=node('p',`${stale} 직접 고쳐 내보내거나 ‘이 입력 다시 정리’로 이어가세요.`,'alert warning');banner.id='stale-advice';card.append(banner);}
  const scope=node('p',v.scope||'이번 범위는 아래에서 직접 작성할 수 있습니다.','work-scope');scope.id='scope-preview';card.append(scope);
  if(local.some(s=>s.kind==='test_answer'))card.append(node('p','합성 시험 입력입니다. 실제 사용자 요구나 기존 확정 기준을 바꾸지 않습니다.','alert warning'));
  const q=t.advice?.question;
  if(q&&questionAnswered(project,t)) {
    const box=node('div','','question-box');box.id='question-answered';box.append(tag('답변 기록됨','purple'),node('h3',q.text),node('p','답변은 저장됐습니다. 정리가 갱신되지 않았다면 ‘이 입력 다시 정리’로 이어가세요. 같은 답을 다시 기록하지 않습니다.','hint'));card.append(box);
  } else if(q) {
    const box=node('div','','question-box');box.id='question-box';box.append(tag(q.kind==='fact'?'모르는 사실 확인':'중요한 제품 선택','amber'),node('h3',q.text),node('p',q.why,'hint'));
    const answerAndSend=(value:string,disposition:Source['disposition']='provided')=>{if(project.pending||!value.trim())return;commit(answer(project,t.id,value,disposition));void generate(t.id);};
    for(const o of q.options){const b=btn(o.label,()=>answerAndSend(`${o.label} — ${o.consequence}`),'option-button');b.append(node('small',o.consequence));box.append(b);}
    const lab=node('label','직접 답하거나 다른 방향을 적어 주세요.');lab.htmlFor='answer-draft';
    const input=node('textarea');input.id='answer-draft';input.rows=2;input.maxLength=12000;input.value=project.answerDraft;input.placeholder=q.kind==='fact'?'알고 있는 관찰만 적어 주세요. 모르면 아래 버튼으로 확인 작업만 이어갑니다.':'선택지 밖의 답도 그대로 남깁니다.';
    input.addEventListener('input',()=>guard(()=>commit(editAuxDraft(project,'answerDraft',input.value),false)));
    const row=node('div','','question-actions');row.append(btn('이 답으로 이어가기',()=>answerAndSend(input.value),'primary','answer-send'),btn('잘 모르겠음',()=>answerAndSend('지금은 모릅니다. 확인할 항목만 남겨 주세요.','unknown'),'quiet','answer-unknown'),btn('이 질문은 보류',()=>answerAndSend('이 질문은 지금 보류합니다. 관련 없는 명확한 범위만 진행해 주세요.','deferred'),'quiet','answer-defer'));
    box.append(lab,input,row);card.append(box);
  }
  const letter=node('section','','work-letter'),letterHead=node('div','','work-letter-heading');
  letterHead.append(node('span','전달할 작업문'));const author=tag(t.manual.next!==null?'사용자 직접 수정':t.mode==='mock'?'모의 제안':t.mode==='deepseek'?'AI 제안':'직접 작성 가능');author.id='instruction-author';letterHead.append(author);
  const instruction=node('p',v.next||'원문과 현재 기준이 전체 인계 문맥에 포함됩니다. 구체적인 작업은 아래에서 직접 작성할 수 있어요.','work-instruction');instruction.id='instruction-preview';
  const checks=details('완료 조건 · 확인할 동작','checks-preview');checks.className='checks-preview';const checksText=node('p',v.checks||'아직 작성된 완료 조건이 없습니다.');checksText.id='checks-text';checks.append(checksText);
  letter.append(letterHead,instruction,checks);card.append(letter);
  const edit=details('범위 · 제안 · 작업문 직접 다듬기','edit-work');edit.className='edit-area';
  for(const [key,label] of [['understanding','짧은 이해'],['scope','이번 범위와 유지할 것'],['next','실행 도구에 전달할 작업문'],['checks','확인할 동작 / 완료 조건']] as const) {
    const l=node('label',label);l.htmlFor=`work-${key}`;const field=node('textarea');field.id=`work-${key}`;field.rows=key==='next'?4:2;field.maxLength=6000;field.value=v[key];
    field.addEventListener('input',()=>guard(()=>{commit(editTask(project,t.id,key,field.value),false);const marker=$(`manual-${key}`);marker.textContent='직접 수정 · AI가 덮어쓰지 않음';refreshPreview();}));
    const old=t.manual[key]===null&&w.aiStale?t.advice?.[key]??'':'';
    const marker=node('p',t.manual[key]!==null?'직접 수정 · AI가 덮어쓰지 않음':old?'기준 변경 전 AI 문구는 작업문에서 제외됨 · 직접 쓰면 그대로 들어갑니다':'제안 · 실제 실행 결과 아님','manual-note');marker.id=`manual-${key}`;edit.append(l,field,marker);
    if(old){const d=details('기준 변경 전 AI 문구 보기 (현재 작업문 아님)',`stale-${key}`);d.append(node('div',old,'source-raw'),btn('이 문구로 시작해 직접 고치기',()=>commit(editTask(project,t.id,key,old)),'quiet',`stale-use-${key}`));edit.append(d);}
  }
  const suggestions=taskSuggestions(t);
  for(const [index,s] of suggestions.entries()) {
    const box=node('div','','suggestion');box.append(tag(w.aiStale&&t.suggestions===null?'기준 변경 전 제안 · 작업문 제외 · 고치면 포함':'추가 제안 · 미확정'));
    for(const key of ['text','why'] as const){const l=node('label',key==='text'?'제안 문구':'이유와 대가');const f=node('textarea');f.rows=2;f.maxLength=2000;f.id=`suggestion-${index}-${key}`;l.htmlFor=f.id;f.value=s[key];f.addEventListener('input',()=>guard(()=>{commit(editSuggestion(project,t.id,index,key,f.value),false);refreshPreview();}));box.append(l,f);}
    box.append(btn('이 제안을 내 기준으로 기록',()=>{const value=taskSuggestions(taskOf(project,t.id))[index];if(value)commit(recordBasis(project,value.text));},'secondary'));edit.append(box);
  }
  edit.append(node('p','이 영역을 고쳐도 다른 기준·원문은 변하지 않습니다. AI 재정리 후에도 직접 쓴 값은 유지됩니다.','hint'));
  const foot=node('div','','work-footer'),row=node('div','','actions');
  const retry=btn('이 입력 다시 정리',()=>{void generate(t.id);},'quiet','retry-work');retry.dataset.aiAction='true';
  row.append(btn('작업문 복사',()=>{void exportWork(t.id,'clipboard');},'primary','copy-work'),btn('Markdown 저장',()=>{void exportWork(t.id,'download');},'secondary','download-work'),retry);
  foot.append(row,node('p','복사·저장은 자동 실행이 아닙니다. 사용 중인 개발 도구에 직접 전달하세요.'));card.append(foot,edit);
  const preview=details('실제로 전달할 전체 문맥 보기','handoff-preview');const txt=node('textarea');txt.id='handoff-text';txt.readOnly=true;txt.rows=14;txt.className='export-preview';
  try{txt.value=handoffText(project,t.id);}catch{txt.value='문맥 크기 또는 데이터 오류로 자동 인계를 만들지 못했습니다. 복구 파일로 원문을 보존하세요.';}
  preview.append(node('p','관련 입력 + 직전 작업 + 모든 보존 기준. AI가 관련으로 고르지 않은 기준도 뒤에 남습니다.','hint'),txt);card.append(preview);area.append(card);
}
function refreshPreview(){
  if(!project.currentTaskId||!$('handoff-text'))return;
  const t=taskOf(project),v=currentWork(project,t).values;
  try{$<HTMLTextAreaElement>('handoff-text').value=handoffText(project);}catch{/* Never truncate or erase a manual draft. */}
  for(const [id,value] of [['work-summary',v.understanding],['scope-preview',v.scope],['instruction-preview',v.next],['checks-text',v.checks]])if($(id!))$(id!).textContent=value||'직접 작성한 내용이 없습니다. 원문은 그대로 보존됩니다.';
  $('work-authorship').textContent=workOrigin(t);
  $('instruction-author').textContent=t.manual.next!==null?'사용자 직접 수정':t.mode==='mock'?'모의 제안':'AI 제안';
}
function render() {
  const open=new Map([...document.querySelectorAll<HTMLDetailsElement>('details[id]')].map(d=>[d.id,d.open]));
  const active=document.activeElement as HTMLTextAreaElement|HTMLInputElement|null;
  const focus=active&&active.id?{id:active.id,start:active.selectionStart,end:active.selectionEnd}:null;
  if(document.activeElement!==$('project-name'))$<HTMLInputElement>('project-name').value=project.name;
  $<HTMLTextAreaElement>('draft').value=project.draft;$<HTMLSelectElement>('source-kind').value=project.draftKind;
  const returned=project.draftKind==='report'||project.draftKind==='evidence';
  for(const [id,selected] of [['request-tab',project.draftKind==='request'],['report-tab',returned]] as const){$(id).classList.toggle('selected',selected);$(id).setAttribute('aria-pressed',String(selected));}
  $('compose-title').textContent=returned?'어떤 결과가 돌아왔나요?':project.tasks.length?'다음으로 바꾸고 싶은 것은?':'어떤 작업부터 시작할까요?';
  $('compose-eyebrow').textContent=returned?'CONTINUE WITH RESULTS':project.tasks.length?'NEXT REQUEST':"LET’S START";
  $('input-hint').textContent=returned?'받은 보고를 그대로 붙여넣으세요. 마지막으로 내보낸 작업에 연결하며, 검증 완료로 바꾸지 않습니다.':project.draftKind==='test_answer'?'합성 시험자료로만 보관합니다. 실제 요청과 확정 기준은 바꾸지 않습니다.':'필요한 질문만 받고, 바로 전달할 작업문을 준비해요.';
  $<HTMLTextAreaElement>('draft').placeholder=returned?'받은 결과 요약이나 변경 내용, 실행한 검사와 남은 일을 그대로 붙여넣으세요. 정해진 양식은 없어요.':project.tasks.length?'이번에 바꿀 부분만 적어 주세요. 앞에서 정한 기준은 함께 이어갑니다.':'무엇을 만들고 싶나요? 이미 작업 중이라면, 지금 바꾸고 싶은 부분만 알려주세요.';
  $('send').replaceChildren(document.createTextNode(returned?'결과에서 이어가기':'작업문 준비하기'),node('span',' ↗'));
  $('starter-examples').hidden=!!project.tasks.length||returned;
  $('compose-panel').classList.toggle('initial',!project.tasks.length);
  const t=project.currentTaskId?taskOf(project):null;
  renderBases(t);renderHistory();renderWork(t);renderStatus();displayView();
  for(const d of document.querySelectorAll<HTMLDetailsElement>('details[id]'))if(open.has(d.id))d.open=open.get(d.id)!;
  if(focus){const target=document.getElementById(focus.id) as HTMLTextAreaElement|HTMLInputElement|null;if(target){target.focus({preventScroll:true});if(focus.start!=null&&focus.end!=null)try{target.setSelectionRange(focus.start,focus.end);}catch{/* A button has no selection range. */}}}
}
function submitInput(withAI:boolean) {
  if(project.pending||!project.draft.trim()||(withAI&&!readyForAI()))return;
  guard(()=>{commit(submit(project));$<HTMLDetailsElement>('compose-panel').open=false;showWork();$('current-work').focus({preventScroll:true});$('current-work').scrollIntoView({block:'start'});if(withAI)void generate(project.currentTaskId!);else {$<HTMLDetailsElement>('edit-work').open=true;$('work-next').focus();}});
}
$('compose').addEventListener('submit',e=>{e.preventDefault();submitInput(true);});
$('save-input').addEventListener('click',()=>submitInput(false));
$('draft').addEventListener('input',()=>guard(()=>commit(editDraft(project,$<HTMLTextAreaElement>('draft').value),false)));
$('project-name').addEventListener('input',()=>{const value=$<HTMLInputElement>('project-name').value;if(value.trim())guard(()=>commit(rename(project,value),false));});
$('project-name').addEventListener('blur',()=>{$<HTMLInputElement>('project-name').value=project.name;});
$('request-tab').addEventListener('click',()=>{if(project.draftKind!=='request')commit(setKind(project,'request'));});
$('report-tab').addEventListener('click',()=>{if(project.draftKind!=='report')commit(setKind(project,'report'));});
$('source-kind').addEventListener('change',()=>{const kind=$<HTMLSelectElement>('source-kind').value as Project['draftKind'];if(project.draftKind!==kind)commit(setKind(project,kind));});
$('cancel').addEventListener('click',()=>{controller?.abort();controller=null;commit(cancel(project));});
$('consent').addEventListener('change',renderStatus);
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
$('import-file').addEventListener('change',async()=>{
  const input=$<HTMLInputElement>('import-file'),file=input.files?.[0];input.value='';if(!file)return;
  try {
    if(file.size>FILE_LIMIT)throw new Error();const imported=parseProject(await file.text());
    if(!confirm(`“${imported.name}” · 기준 ${imported.bases.length}개 · 작업 ${imported.tasks.length}개를 복구할까요?\n현재 화면의 프로젝트를 바꿉니다. 필요한 현재 내용은 먼저 복구 파일로 저장하세요.\n파일의 출처 기록은 서명된 검증 증거가 아닙니다.`))return;
    controller?.abort();controller=null;imported.pending=null;
    try {if(!store)throw new Error();store.replace(imported);storageError='';hasSaved=true;memoryDirty=false;}catch{storageError='가져온 내용은 이 탭에 복구했지만 브라우저에 저장하지 못했습니다. 닫기 전에 복구 파일을 저장하세요.';memoryDirty=true;}
    project=imported;view='work';contextOpen=project.bases.some(b=>basisDraftChanged(project,b))||!!project.basisDraft.trim();render();restoreDraftPanels();
  } catch {project={...project,notice:'복구 파일의 형식·버전·참조가 올바르지 않습니다. 현재 프로젝트를 바꾸지 않았습니다.'};renderStatus();}
});
$('nav-work').addEventListener('click',()=>{contextOpen=false;showWork();$('context-title').scrollIntoView({block:'nearest'});});
$('nav-context').addEventListener('click',()=>{if(contextOpen&&view==='work')closeContext();else showContext();});
$('close-context').addEventListener('click',closeContext);
$('nav-history').addEventListener('click',()=>{view='history';displayView();$<HTMLDetailsElement>('history').open=true;$('history-title').focus();});
$('back-to-work').addEventListener('click',()=>{showWork();$('nav-work').focus();});
for(const example of document.querySelectorAll<HTMLButtonElement>('[data-example]'))example.addEventListener('click',()=>guard(()=>{commit(editDraft(project,example.dataset.example!));$('draft').focus();}));
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if($<HTMLDetailsElement>('connection-details').open){$<HTMLDetailsElement>('connection-details').open=false;$('connection-details').querySelector('summary')!.focus();}else if(contextOpen)closeContext();}});
window.addEventListener('beforeunload',e=>{if(memoryDirty){e.preventDefault();e.returnValue='';}});
function restoreDraftPanels() {
  $<HTMLDetailsElement>('compose-panel').open=!project.tasks.length||!!project.draft.trim();
  if(project.basisDraft.trim())$<HTMLDetailsElement>('add-basis').open=true;
  for(const b of project.bases)if(basisDraftChanged(project,b)){const editor=$<HTMLDetailsElement>(`edit-${b.id}`);editor.open=true;const all=editor.closest<HTMLDetailsElement>('#all-bases');if(all)all.open=true;}
  displayView();
}
contextOpen=project.bases.some(b=>basisDraftChanged(project,b))||!!project.basisDraft.trim();
render();restoreDraftPanels();
try {
  const response=await fetch('/api/config');if(!response.ok)throw new Error();const value=await response.json();
  if(!['mock','deepseek'].includes(value.mode)||typeof value.configured!=='boolean'||typeof value.paidEnabled!=='boolean')throw new Error();
  config=value;
  $('mode').textContent=config!.mode==='mock'?'MOCK · 체험 모드':config!.configured&&config!.paidEnabled?'DeepSeek · 요청 가능':'DeepSeek · 호출 꺼짐';
  $('mode-description').textContent=config!.mode==='mock'?'규칙 기반 모의 정리입니다. 실제 AI 해석이나 외부 전송 없이 화면 흐름을 시험합니다.':config!.configured&&config!.paidEnabled?'서버에 요청 설정이 있습니다. 실제 연결 성공은 아직 확인하지 않았으며, 아래 전송 동의 후 요청할 수 있습니다.':'서버에서 실제 AI 호출이 비활성화되어 있습니다. 원문 보관·직접 편집·파일 저장은 사용할 수 있습니다.';
  $('consent-area').hidden=config!.mode!=='deepseek';
  if(config!.mode==='deepseek'&&config!.configured&&config!.paidEnabled)$<HTMLDetailsElement>('connection-details').open=true;
  if(config!.mode==='deepseek'&&(!config!.configured||!config!.paidEnabled))project={...project,notice:'실제 AI 호출은 서버에서 잠겨 있습니다. 원문 보관·문맥 편집·저장·복구는 사용할 수 있습니다.'};
} catch {project={...project,notice:'서버 모드를 확인하지 못했습니다. 자동 AI 호출 없이 입력을 보존합니다.'};$('mode').textContent='서버 연결 미확인';$('mode-description').textContent='서버 모드를 확인하지 못했습니다. 원문만 보관하거나 연결 설정을 확인한 뒤 새로고침하세요.';}
renderStatus();
