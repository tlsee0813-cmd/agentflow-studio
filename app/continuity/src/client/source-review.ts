// SOURCE40: '기록 제안 검토' — a separate full-window reader for already made, sourced proposals of one source sample.
// Tab memory only: it never reads or writes localStorage/sessionStorage, the open project, its draft or the map memo,
// and it has no apply/receive action (there is no real link to a project, task or handoff). Closing keeps the review in
// this tab's memory; a reload clears it. All file text is shown with textContent (never parsed as HTML).
import { ROLE_LABEL, SOURCE_ROLES, ProposalFileError, checkProposalSize, parseProposalFile, parseProposalValue, verifyExcerptHashes, addReview, reviewItems, setExcluded, toggleRecheck,
  splitGroup, undoSplit, roleCounts, excerptOf, unusedExcerpts, proposalsUsing, type ProposalReview, type ReviewItem, type ProposalSample, type ProposalExcerpt } from '../shared/source-proposals.js';
import { PROPOSAL_EXAMPLE } from '../shared/source-proposals-example.js';

const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
function el<K extends keyof HTMLElementTagNameMap>(tag:K,content='',cls=''):HTMLElementTagNameMap[K] {
  const e=document.createElement(tag);e.textContent=content;if(cls)e.className=cls;return e;
}
function button(label:string,act:()=>void,cls='quiet',id=''):HTMLButtonElement {
  const b=el('button',label,cls);b.type='button';if(id)b.id=id;b.addEventListener('click',()=>{error='';act();});return b; // A new action ends an old error.
}
const chip=(content:string,cls='')=>el('span',content,`tag ${cls}`.trim());
const short=(hash:string)=>`${hash.slice(0,12)}…`;

type Screen={kind:'item';key:string}|{kind:'excerpt';ref:string;from:string};
let reviews:ProposalReview[]=[];
let openKey:string|null=null;
let screen:Screen|null=null;
let splitting:{key:string;moving:Set<string>}|null=null;
let notice:{text:string;undo:string|null}|null=null;
let error='';
let opener:HTMLElement|null=null;
let busy=false;
// Where the proposal reading was when an excerpt was opened from it (main scroll and the control used), for the way back.
let itemReturn:{key:string;y:number;control:string}|null=null;

// Wide screens scroll the reading column; narrow ones scroll the whole body (styles.css).
const scroller=()=>{const m=document.getElementById('sr-main');return m&&getComputedStyle(m).overflowY!=='visible'?m:$('sr-body');};
/** A new reading starts at its title: top of the reading column, or (narrow) the reading column scrolled into view. */
function readTop(){const sc=scroller(),m=$('sr-main');if(sc===m)m.scrollTop=0;else m.scrollIntoView({block:'start'});$('sr-main-title').focus({preventScroll:true});}
const current=()=>reviews.find(r=>r.key===openKey)??null;
function replace(next:ProposalReview){reviews=reviews.map(r=>r.key===next.key?next:r);}
async function sha256(text:string):Promise<string> {
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));
  return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
}
/** Checks before any state changes; an error leaves the open review exactly as it was. */
async function admit(load:()=>ProposalSample|Promise<ProposalSample>,origin:'example'|'file') {
  if(busy)return;busy=true;error='';
  try {
    const sample=await load();
    if(!globalThis.crypto?.subtle)throw new ProposalFileError('NO_DIGEST','이 브라우저에서 발췌 해시를 계산할 수 없어 가져오지 않았어요.');
    await verifyExcerptHashes(sample,sha256);
    const result=addReview(reviews,sample,origin);
    if(result.outcome==='full'){error='이 탭에서는 표본 3개까지 검토할 수 있어요. 다른 표본을 ‘이 검토 내리기’로 내린 뒤 가져오세요. 지금 검토는 그대로예요.';return;}
    const same=result.outcome==='reused'&&openKey===result.open;
    reviews=result.reviews;openKey=result.open;splitting=null;
    if(!same)screen={kind:'item',key:reviewItems(current()!)[0]!.key}; // The same review stays where it was read.
    const what=origin==='example'?'검토 예제':'가져온 파일';
    notice={text:result.outcome==='reused'?`같은 출처·범위·제안의 입력이 이미 이 탭에서 검토 중이에요. 새로 만들지 않고 그 검토(제외·분리 표시 포함)를 그대로 보여 드려요.`
      :result.changedIds.length?`${what}을 열었어요. 같은 출처 ID·제안 ID(${result.changedIds.join(', ')})가 다른 내용으로 이미 검토 중이에요. 원문·근거·해석이 달라 이전 제외·분리 표시를 이어받지 않았어요.`
      :`${what}을 열었어요. 발췌 문자열 해시를 다시 계산해 기록값과 맞는지 확인했어요.`,undo:null};
  } catch(e) {
    notice=null;error=`${e instanceof ProposalFileError?e.message:'파일을 읽지 못했어요.'} 지금 검토는 바뀌지 않았어요.`;
  } finally {busy=false;render();focusAfterLoad();}
}
function focusAfterLoad(){if(error)$('sr-error').focus();else $('sr-main-title')?.focus();}

function open(from:HTMLElement) {
  const dialog=$<HTMLDialogElement>('source-review');if(dialog.open)return;
  opener=from;document.documentElement.classList.add('source-review-open');
  dialog.showModal();render();
  (document.getElementById('sr-main-title')??$('sr-title')).focus();
}
function close(){const dialog=$<HTMLDialogElement>('source-review');if(dialog.open)dialog.close();}
function closed() {
  document.documentElement.classList.remove('source-review-open');
  const back=opener;opener=null;if(back&&back.isConnected)back.focus({preventScroll:true});
}

function render() {
  const review=current();
  $('sr-error').hidden=!error;$('sr-error').textContent=error;
  const n=$('sr-notice');n.hidden=!notice;n.replaceChildren();
  if(notice){n.append(el('span',notice.text));if(notice.undo){const key=notice.undo;n.append(' ',button('되돌리기',()=>{const r=current();if(r){replace(setExcluded(r,key,false));notice={text:'제외를 되돌렸어요.',undo:null};render();$('sr-main-title')?.focus();}},'quiet sr-undo'));}}
  const body=$('sr-body');
  if(!review){body.replaceChildren(empty());return;}
  const side=document.getElementById('sr-side'),y=side?.scrollTop??0,by=body.scrollTop;
  const grid=el('div','','sr-grid'),s=el('aside','','sr-side'),m=el('section','','sr-main');
  s.id='sr-side';s.setAttribute('aria-label','출처와 제안 목록');m.id='sr-main';m.setAttribute('aria-label','읽는 내용');
  s.append(samplePicker(review),itemList(review),sourceFacts(review.sample)); // The proposals first; the source facts follow.
  if(screen?.kind==='excerpt'){const e=excerptOf(review.sample,screen.ref);if(e)m.append(excerptReader(review,e,screen.from));else screen=null;}
  if(screen?.kind!=='excerpt'){const items=reviewItems(review),item=items.find(i=>i.key===(screen as {key:string}|null)?.key)??items.find(i=>!i.excluded)??items[0]!;screen={kind:'item',key:item.key};m.append(itemReader(review,item));}
  grid.append(s,m);body.replaceChildren(grid);s.scrollTop=y;body.scrollTop=by;
}
function empty():HTMLElement {
  const box=el('div','','sr-empty');
  box.append(el('h3','검토할 표본을 고르세요','sr-empty-title'),
    el('p','이미 만들어진 제안을 검토하는 화면이에요. 기록을 새로 모으거나 AI로 추출하지 않아요. 한 출처 표본의 제안 3개까지 원문 발췌와 함께 봐요.','hint'),
    el('p','검토 예제는 실제 총괄 기록 한 파일에서 고른 8발췌와 독립 검토로 보정한 제안 3개예요. 직접 열 때만 열리고, 내 프로젝트에는 들어가지 않아요.','hint'));
  return box;
}
function samplePicker(review:ProposalReview):HTMLElement {
  const box=el('div','','sr-picker');
  if(reviews.length>1){
    const label=el('label','이 탭의 검토 표본','sr-label');label.htmlFor='sr-sample';const select=el('select');select.id='sr-sample';
    reviews.forEach((r,i)=>{const o=el('option',`${i+1}. ${r.origin==='example'?'검토 예제':'가져온 파일'} · ${r.sample.source.label} (${r.sample.proposals.length}개 제안)`);o.value=String(i);o.selected=r.key===review.key;select.append(o);});
    select.addEventListener('change',()=>{const r=reviews[Number(select.value)];if(!r)return;openKey=r.key;screen=null;splitting=null;notice=null;error='';render();});
    box.append(label,select);
  }
  const line=el('div','','sr-picker-line');
  line.append(chip(review.origin==='example'?'검토 예제':'가져온 파일','purple'),chip('이 탭 메모리 · 새로고침하면 사라짐'));
  line.append(button('이 검토 내리기',()=>{
    if(!confirm('이 표본의 검토(제외·분리·다시 검토 표시)를 이 탭에서 내릴까요? 프로젝트에는 원래 아무 영향이 없어요.'))return;
    reviews=reviews.filter(r=>r.key!==review.key);openKey=reviews.at(-1)?.key??null;screen=null;splitting=null;notice={text:'검토를 내렸어요.',undo:null};render();$('sr-title').focus();
  },'quiet sr-remove'));
  box.append(line);return box;
}
function sourceFacts(sample:ProposalSample):HTMLElement {
  const box=el('section','','sr-source');box.setAttribute('aria-label','출처와 선택 범위');
  box.append(el('h3',`${sample.source.label} · ${sample.source.id}`,'sr-source-title'),el('p',sample.source.nature,'sr-source-nature'));
  const dl=el('dl','','sr-facts');
  const row=(k:string,v:string,title='')=>{const dt=el('dt',k),dd=el('dd',v);if(title)dd.title=title;dl.append(dt,dd);};
  row('선택된 사건 범위',sample.range.label);
  row('들어 있지 않은 것',sample.range.omitted);
  row('원본 전체',`SHA-256 ${short(sample.source.rawSha256)}${sample.source.totalLines?` · ${sample.source.totalLines.toLocaleString('ko-KR')}행`:''} — 기록된 값이에요. 이 앱은 원본을 읽지 않아 확인하지 않았어요.`,sample.source.rawSha256);
  box.append(dl);
  const counts=roleCounts(sample),roles=el('ul','','sr-roles');roles.setAttribute('aria-label','발췌의 출처 역할');
  for(const role of SOURCE_ROLES){const li=el('li','',`sr-role role-${role}`);li.append(el('span',ROLE_LABEL[role]),el('strong',`${counts[role]}`));if(!counts[role])li.classList.add('none');roles.append(li);}
  box.append(roles);
  if(!counts.execution_observation)box.append(el('p','이 표본에는 실제 실행 관측 발췌가 없어요. 재현·수정·성공은 확인되지 않은 상태로 둬요.','sr-warn'));
  const unused=unusedExcerpts(sample);
  if(unused.length)box.append(el('p',`어느 제안에도 쓰이지 않은 발췌: ${unused.map(e=>e.ref).join(', ')}`,'hint'));
  return box;
}
function itemLabel(item:ReviewItem):string {return `${item.proposal.id}${item.part?` · 묶음 ${item.part.index}/${item.part.count}`:''}`;}
function itemList(review:ProposalReview):HTMLElement {
  const box=el('nav','','sr-items');box.setAttribute('aria-label','제안');
  const items=reviewItems(review),live=items.filter(i=>!i.excluded),out=items.filter(i=>i.excluded);
  box.append(el('h3',`제안 ${review.sample.proposals.length}개 · 모두 연결 대기`,'sr-items-title'));
  const list=el('ul','','sr-item-list');
  for(const item of live){
    const li=el('li'),b=button('',()=>{screen={kind:'item',key:item.key};splitting=null;notice=null;render();$('sr-main-title').focus();},'sr-item');
    b.dataset.item=item.key;if(screen?.kind==='item'&&screen.key===item.key)b.setAttribute('aria-current','true');
    b.append(el('span',itemLabel(item),'sr-item-id'),el('span',item.proposal.label,'sr-item-label'),el('span',item.refs.join(' · '),'sr-item-refs'));
    const tags=el('span','','sr-item-tags');tags.append(chip('연결 대기','amber'));if(item.recheck)tags.append(chip('다시 검토','purple'));b.append(tags);
    li.append(b);list.append(li);
  }
  if(!live.length)list.append(el('li','남은 제안이 없어요. 아래에서 제외를 되돌릴 수 있어요.','hint'));
  box.append(list);
  if(out.length){
    const d=el('details','','sr-excluded');d.id='sr-excluded';d.open=true;d.append(el('summary',`제외한 제안 ${out.length}`));
    const ul=el('ul');for(const item of out){const li=el('li','','sr-excluded-item');li.append(el('span',`${itemLabel(item)} ${item.proposal.label}`),button('되돌리기',()=>{replace(setExcluded(review,item.key,false));screen={kind:'item',key:item.key};notice={text:`${itemLabel(item)} 제외를 되돌렸어요.`,undo:null};render();$('sr-main-title').focus();},'quiet sr-restore'));ul.append(li);}
    d.append(ul);box.append(d);
  }
  return box;
}
function field(dl:HTMLElement,k:string,v:string){dl.append(el('dt',k),el('dd',v));}
function interpretation(item:ReviewItem):HTMLElement {
  const dl=el('dl','','sr-reading');const p=item.proposal;
  field(dl,'관측',p.observed);field(dl,'보정·미확인',p.fidelity);field(dl,'범위',p.scope);field(dl,'이름·동일성',p.identity);field(dl,'담당 변화',p.roleChange);
  return dl;
}
function missingList(item:ReviewItem,heading:string):HTMLElement {
  const box=el('section','','sr-missing');box.append(el('h4',heading));
  const ul=el('ul');for(const m of item.proposal.missing)ul.append(el('li',m));
  if(!item.proposal.missing.length)ul.append(el('li','기록된 빠진 연결이 없어요. 없다는 뜻이 아니라 적혀 있지 않다는 뜻이에요.','hint'));
  box.append(ul);return box;
}
function itemReader(review:ProposalReview,item:ReviewItem):HTMLElement {
  const box=el('article','','sr-reader');box.dataset.item=item.key;
  const head=el('div','','sr-reader-head');
  const h=el('h3',`${itemLabel(item)} · ${item.proposal.label}`,'sr-main-title');h.id='sr-main-title';h.tabIndex=-1;
  const tags=el('div','','sr-reader-tags');tags.append(chip('연결 대기','amber'),chip('기존 작업·부분과 같다고 보지 않음'));
  if(item.excluded)tags.append(chip('제외됨'));if(item.recheck)tags.append(chip('다시 검토','purple'));
  head.append(h,tags);box.append(head);
  if(item.part){
    const all=item.proposal.refs;
    box.append(el('p',`원래 ${item.proposal.id}(${all.join('·')})를 근거별로 나눈 묶음이에요. 원래 묶음의 해석은 ${all.length}개 발췌를 함께 본 제안이라, 이 묶음(${item.refs.join('·')})만의 사실로 옮기지 않아요. 이 묶음의 새 해석도 만들지 않았어요.`,'sr-part-note'));
  } else box.append(interpretation(item));
  box.append(evidence(review,item));
  if(item.part){
    box.append(missingList(item,'원래 묶음에서 확인되지 않은 것 · 분리해도 그대로'));
    const d=el('details','','sr-parent');d.id=`sr-parent-${item.proposal.id}`;d.append(el('summary',`원래 ${item.proposal.id} 묶음의 해석 · 참고용 (이 묶음의 사실 아님)`),interpretation(item));box.append(d);
  } else box.append(missingList(item,'빠진 연결 · 확인되지 않은 것'));
  box.append(actions(review,item));
  box.append(el('p','적용·수신 버튼이 없는 이유: 이 제안과 실제 프로젝트·작업·인계 사이의 연결 정보가 없어요. 검토는 이 탭에서만 하고 프로젝트를 바꾸지 않아요.','hint sr-no-apply'));
  return box;
}
function evidence(review:ProposalReview,item:ReviewItem):HTMLElement {
  const box=el('section','','sr-evidence');box.append(el('h4',`근거 발췌 ${item.refs.length}개`));
  const ul=el('ul','','sr-evidence-list');
  for(const ref of item.refs){
    const e=excerptOf(review.sample,ref)!;const li=el('li','','sr-excerpt');li.dataset.ref=ref;
    const meta=el('div','','sr-excerpt-meta');meta.append(el('strong',ref),el('span',`행 ${e.line.toLocaleString('ko-KR')}`),chip(ROLE_LABEL[e.role],`role-${e.role}`));if(e.truncated)meta.append(chip('발췌 잘림','amber'));
    li.append(meta,el('p',e.quote,'sr-excerpt-preview'));
    if(e.note)li.append(el('p',e.note,'sr-excerpt-note'));
    li.append(button(`원문 읽기 · ${ref}`,()=>{
      itemReturn={key:item.key,y:scroller().scrollTop,control:`sr-read-${ref}`};screen={kind:'excerpt',ref,from:item.key};splitting=null;notice=null;render();readTop();
    },'secondary sr-read',`sr-read-${ref}`));
    ul.append(li);
  }
  box.append(ul);return box;
}
function actions(review:ProposalReview,item:ReviewItem):HTMLElement {
  const box=el('div','','sr-actions');box.setAttribute('role','group');box.setAttribute('aria-label','이 제안 검토');
  if(item.excluded)box.append(button('제외 되돌리기',()=>{replace(setExcluded(review,item.key,false));notice={text:`${itemLabel(item)} 제외를 되돌렸어요.`,undo:null};render();$('sr-main-title').focus();},'secondary','sr-exclude'));
  else box.append(button('제외',()=>{replace(setExcluded(review,item.key,true));notice={text:`${itemLabel(item)}을(를) 제외했어요. 목록 아래 ‘제외한 제안’에서도 되돌릴 수 있어요.`,undo:item.key};render();$('sr-main-title').focus();},'secondary','sr-exclude'));
  box.append(button(item.recheck?'다시 검토 표시 해제':'다시 검토 표시',()=>{replace(toggleRecheck(review,item.key));render();$('sr-recheck').focus();},'secondary','sr-recheck'));
  const groups=review.groups[item.proposal.id]!,index=item.part?item.part.index-1:0;
  if(item.refs.length>1&&!item.excluded){
    if(splitting?.key===item.key)box.append(splitForm(review,item,index));
    else box.append(button('근거별로 분리…',()=>{splitting={key:item.key,moving:new Set()};render();document.querySelector<HTMLInputElement>('#sr-split input')?.focus();},'secondary','sr-split-open'));
  }
  if(groups.length>1)box.append(button(`${item.proposal.id} 분리 되돌리기`,()=>{
    replace(undoSplit(review,item.proposal.id));screen={kind:'item',key:item.proposal.id};notice={text:`${item.proposal.id}을(를) 원래 한 묶음으로 되돌렸어요. 나뉜 묶음의 제외·다시 검토 표시는 지웠어요.`,undo:null};render();$('sr-main-title').focus();
  },'quiet','sr-unsplit'));
  return box;
}
function splitForm(review:ProposalReview,item:ReviewItem,index:number):HTMLElement {
  const form=el('fieldset','','sr-split');form.id='sr-split';
  form.append(el('legend','새 묶음으로 옮길 발췌'),el('p','인과가 확인되지 않은 발췌를 따로 검토할 때 써요. 원래 근거 안에서 나누기만 하고 복제하지 않아요. 해석은 새로 만들지 않아요.','hint'));
  for(const ref of item.refs){
    const label=el('label','','sr-split-option'),box=el('input');box.type='checkbox';box.value=ref;box.checked=splitting!.moving.has(ref);
    box.addEventListener('change',()=>{if(box.checked)splitting!.moving.add(ref);else splitting!.moving.delete(ref);go.disabled=!splitting!.moving.size||splitting!.moving.size>=item.refs.length;});
    label.append(box,el('span',`${ref} · 행 ${excerptOf(review.sample,ref)!.line.toLocaleString('ko-KR')} · ${ROLE_LABEL[excerptOf(review.sample,ref)!.role]}`));form.append(label);
  }
  const row=el('div','','row');
  const go=button('분리',()=>{
    try {const next=splitGroup(review,item.proposal.id,index,[...splitting!.moving]);replace(next);
      const moved=[...splitting!.moving];splitting=null;
      const part=reviewItems(next).find(i=>i.proposal.id===item.proposal.id&&moved.every(r=>i.refs.includes(r))&&i.refs.length===moved.length)!;
      screen={kind:'item',key:part.key};notice={text:`${item.proposal.id}에서 ${moved.join('·')}를 별도 묶음으로 나눴어요. 원래 해석은 참고로만 보여요.`,undo:null};
    } catch(e){error=e instanceof ProposalFileError?e.message:'분리하지 못했어요.';}
    render();$('sr-main-title').focus();
  },'primary','sr-split-go');go.disabled=!splitting!.moving.size||splitting!.moving.size>=item.refs.length;
  row.append(go,button('취소',()=>{splitting=null;render();$('sr-split-open').focus();},'quiet','sr-split-cancel'));
  form.append(row);return form;
}
function excerptReader(review:ProposalReview,e:ProposalExcerpt,from:string):HTMLElement {
  const box=el('article','','sr-reader sr-source-reader');box.dataset.ref=e.ref;
  const item=reviewItems(review).find(i=>i.key===from);
  const back=()=>{const ret=itemReturn;screen={kind:'item',key:from};render();
    if(ret&&ret.key===from){scroller().scrollTop=ret.y;const c=document.getElementById(ret.control);if(c){c.focus({preventScroll:true});return;}}
    $('sr-main-title').focus();};
  const backLabel=`← ${item?itemLabel(item):'제안'}으로 돌아가기`;
  box.append(button(backLabel,back,'quiet sr-back','sr-back'));
  const h=el('h3',`${e.ref} 원문 · 행 ${e.line.toLocaleString('ko-KR')}`,'sr-main-title');h.id='sr-main-title';h.tabIndex=-1;box.append(h);
  const meta=el('div','','sr-reader-tags');meta.append(chip(ROLE_LABEL[e.role],`role-${e.role}`),chip(`원래 분류 ${e.kind}`));if(e.truncated)meta.append(chip('발췌 잘림','amber'));box.append(meta);
  const text=el('div',e.quote,'sr-quote');text.id='sr-quote';text.tabIndex=0;text.setAttribute('role','region');text.setAttribute('aria-label',`${e.ref} 원문 발췌`);box.append(text);
  if(e.truncated)box.append(el('p','이 발췌는 원문 일부가 잘린 상태예요. 잘린 내용을 추측해 채우지 않았어요.','sr-warn'));
  if(e.note)box.append(el('p',e.note,'sr-excerpt-note'));
  const dl=el('dl','','sr-facts sr-hashes');
  dl.append(el('dt','발췌 문자열 SHA-256'),el('dd',`${e.quoteSha256} · 이 문자열로 다시 계산해 기록값과 일치해요.`));
  dl.append(el('dt','원본 행 SHA-256'),el('dd',`${e.lineSha256} · 원본을 읽지 않아 확인하지 않았어요.`));
  box.append(dl);
  const users=proposalsUsing(review.sample,e.ref),uses=el('section','','sr-uses');uses.append(el('h4','이 발췌를 근거로 쓰는 제안'));
  const ul=el('ul');
  for(const p of users){const target=reviewItems(review).find(i=>i.proposal.id===p.id&&i.refs.includes(e.ref))!;
    const li=el('li');li.append(button(`${itemLabel(target)} · ${p.label}${target.excluded?' (제외됨)':''}`,()=>{screen={kind:'item',key:target.key};render();readTop();},'quiet sr-use'));ul.append(li);}
  uses.append(ul);box.append(uses);
  box.append(button(backLabel,back,'secondary sr-back-bottom','sr-back-bottom'));
  return box;
}

/** Wires the home entry and the dialog once. */
export function initSourceReview() {
  const dialog=$<HTMLDialogElement>('source-review');
  $('proposal-review-open').addEventListener('click',e=>open(e.currentTarget as HTMLElement));
  $('sr-close').addEventListener('click',close);
  dialog.addEventListener('close',closed);
  dialog.addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;
    if(e.isComposing||e.keyCode===229){e.preventDefault();return;}
    e.stopPropagation(); // The dialog's own cancel closes it; the page's Escape handlers behind it must not act too.
  });
  $('sr-example').addEventListener('click',()=>void admit(()=>parseProposalValue(structuredClone(PROPOSAL_EXAMPLE)),'example'));
  const input=$<HTMLInputElement>('sr-file');
  $('sr-import').addEventListener('click',()=>{input.value='';input.click();});
  input.addEventListener('change',()=>{
    const file=input.files?.[0];if(!file)return;
    // An oversized file is refused by its size, before its content is read.
    void admit(async()=>{checkProposalSize(file.size);return parseProposalFile(new Uint8Array(await file.arrayBuffer()));},'file').then(()=>{input.value='';});
  });
}
