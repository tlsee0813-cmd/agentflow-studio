// SOURCE40: review of already made, sourced 'connection pending' proposals from ONE explicitly chosen source sample.
// Pure helpers only (no DOM, no storage). This is not a collector, an extractor or a receiver: nothing here reads a raw
// log, calls AI, or writes a project. The review state lives in the caller's tab memory.
//
// Identity rules (what counts as 'the same'):
// - Same INPUT: every field of the file is equal after ordering the excerpts by ref, the proposals by id and each refs /
//   missing list. Only the order of those arrays may differ. Re-importing such a file reuses the existing review.
// - Same source id or proposal id with ANY other difference (a quote, a ref, an interpretation, a hash) is a different
//   input: it gets its own review and never inherits exclusions, splits or recheck marks.
// - Same excerpt text (equal quote hash) is a fact about the text; it never means two proposals mean the same thing.
// - A proposal is never the same as an existing project part, task or handoff: no field links them.

export const PROPOSAL_SCHEMA='agentflow.source-proposals.1';
export const PROPOSAL_FILE_BYTES=64*1024;
export const MAX_PROPOSALS=3;
export const MAX_EXCERPTS=12;
export const MAX_REVIEWS=3;
export const QUOTE_LIMIT=8000;
export const FIELD_LIMIT=2000;

export type SourceRole='user_instruction'|'coordinator_interpretation'|'assignment_notice'|'execution_observation';
export const SOURCE_ROLES:SourceRole[]=['user_instruction','coordinator_interpretation','assignment_notice','execution_observation'];
export const ROLE_LABEL:Record<SourceRole,string>={user_instruction:'사용자 지시',coordinator_interpretation:'총괄 해석',assignment_notice:'배정 예고',execution_observation:'실행 관측'};

export interface ProposalSourceInfo {id:string;label:string;nature:string;rawSha256:string;totalLines:number|null}
export interface ProposalRange {label:string;omitted:string}
export interface ProposalExcerpt {ref:string;line:number;role:SourceRole;kind:string;lineSha256:string;quoteSha256:string;quote:string;truncated:boolean;note:string|null}
export interface SourceProposal {id:string;label:string;refs:string[];observed:string;fidelity:string;scope:string;identity:string;roleChange:string;missing:string[]}
export interface ProposalSample {schemaVersion:typeof PROPOSAL_SCHEMA;source:ProposalSourceInfo;range:ProposalRange;excerpts:ProposalExcerpt[];proposals:SourceProposal[]}

export class ProposalFileError extends Error {
  constructor(readonly code:string,message:string){super(message);}
}
const fail=(code:string,message:string):never=>{throw new ProposalFileError(code,message);};
const ID=/^[A-Za-z0-9_-]{1,32}$/,HEX=/^[0-9a-f]{64}$/;
// Line breaks and tabs are text; other control characters are not.
const CONTROL=/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

function object(v:unknown,where:string,keys:string[],optional:string[]=[]):Record<string,unknown> {
  if(!v||typeof v!=='object'||Array.isArray(v))fail('FIELD',`${where}: 객체가 아니에요.`);
  const o=v as Record<string,unknown>;
  for(const k of Object.keys(o))if(!keys.includes(k)&&!optional.includes(k))fail('KEYS',`${where}: 허용하지 않는 키 ‘${k}’가 있어요.`);
  for(const k of keys)if(!(k in o))fail('FIELD',`${where}: ‘${k}’가 없어요.`);
  return o;
}
function text(v:unknown,where:string,limit=FIELD_LIMIT,empty=false):string {
  if(typeof v!=='string')fail('FIELD',`${where}: 문자열이 아니에요.`);
  const s=v as string;
  if(!empty&&!s.trim())fail('FIELD',`${where}: 비어 있어요.`);
  if(s.length>limit)fail('TOO_LARGE',`${where}: ${limit}자를 넘어요.`);
  if(CONTROL.test(s))fail('FIELD',`${where}: 제어 문자가 있어요.`);
  return s;
}
function id(v:unknown,where:string):string {const s=text(v,where,32);if(!ID.test(s))fail('FIELD',`${where}: 영문·숫자·_·- 1~32자여야 해요.`);return s;}
function hex(v:unknown,where:string):string {if(typeof v!=='string'||!HEX.test(v))fail('HASH_FORMAT',`${where}: 소문자 SHA-256 16진수 64자가 아니에요.`);return v as string;}
function texts(v:unknown,where:string,max:number):string[] {
  if(!Array.isArray(v))fail('FIELD',`${where}: 배열이 아니에요.`);
  const a=v as unknown[];if(a.length>max)fail('TOO_MANY',`${where}: ${max}개를 넘어요.`);
  return a.map((x,i)=>text(x,`${where}[${i}]`));
}

/** Structure check of one file's bytes. Throws ProposalFileError with a Korean message; never repairs or trims. */
export function checkProposalSize(bytes:number):void {
  if(bytes>PROPOSAL_FILE_BYTES)fail('TOO_LARGE',`파일이 ${PROPOSAL_FILE_BYTES/1024} KiB를 넘어요. 한 출처의 최소 발췌와 제안 3개까지만 가져올 수 있어요.`);
}
export function parseProposalFile(bytes:Uint8Array):ProposalSample {
  checkProposalSize(bytes.byteLength);
  if(bytes[0]===0xef&&bytes[1]===0xbb&&bytes[2]===0xbf)fail('BOM','파일 앞에 BOM이 있어요. BOM 없는 UTF-8 JSON만 가져와요.');
  let raw:string;
  try {raw=new TextDecoder('utf-8',{fatal:true}).decode(bytes);} catch {return fail('NOT_UTF8','올바른 UTF-8 파일이 아니에요.');}
  let value:unknown;
  try {value=JSON.parse(raw);} catch {return fail('NOT_JSON','JSON으로 읽을 수 없어요.');}
  return parseProposalValue(value);
}
export function parseProposalValue(value:unknown):ProposalSample {
  // The kind of file first: a project backup or a result file gets that explanation, not a list of unknown keys.
  if(value&&typeof value==='object'&&!Array.isArray(value)&&(value as Record<string,unknown>).schemaVersion!==PROPOSAL_SCHEMA)fail('SCHEMA',`schemaVersion이 ${PROPOSAL_SCHEMA}가 아니에요. 다른 종류의 JSON(프로젝트 백업·결과 파일 등)은 여기서 가져오지 않아요.`);
  const root=object(value,'파일',['schemaVersion','source','range','excerpts','proposals']);
  const s=object(root.source,'source',['id','label','nature','rawSha256','totalLines']);
  const totalLines=s.totalLines===null?null:Number.isSafeInteger(s.totalLines)&&(s.totalLines as number)>0?s.totalLines as number:fail('FIELD','source.totalLines: 양의 정수 또는 null이어야 해요.');
  const source:ProposalSourceInfo={id:id(s.id,'source.id'),label:text(s.label,'source.label',200),nature:text(s.nature,'source.nature'),rawSha256:hex(s.rawSha256,'source.rawSha256'),totalLines};
  const r=object(root.range,'range',['label','omitted']);
  const range:ProposalRange={label:text(r.label,'range.label',300),omitted:text(r.omitted,'range.omitted')};
  if(!Array.isArray(root.excerpts)||!root.excerpts.length)fail('FIELD','excerpts: 발췌가 1개 이상 있어야 해요.');
  if((root.excerpts as unknown[]).length>MAX_EXCERPTS)fail('TOO_MANY',`excerpts: 발췌는 ${MAX_EXCERPTS}개까지예요.`);
  const excerpts=(root.excerpts as unknown[]).map((v,i):ProposalExcerpt=>{
    const where=`excerpts[${i}]`,e=object(v,where,['ref','line','role','kind','lineSha256','quoteSha256','quote','truncated','note']);
    if(!Number.isSafeInteger(e.line)||(e.line as number)<1)fail('FIELD',`${where}.line: 양의 정수가 아니에요.`);
    if(totalLines!==null&&(e.line as number)>totalLines)fail('FIELD',`${where}.line: 원본 전체 행 수보다 커요.`);
    if(!SOURCE_ROLES.includes(e.role as SourceRole))fail('FIELD',`${where}.role: ${SOURCE_ROLES.join(', ')} 중 하나여야 해요.`);
    if(typeof e.truncated!=='boolean')fail('FIELD',`${where}.truncated: true 또는 false여야 해요.`);
    return {ref:id(e.ref,`${where}.ref`),line:e.line as number,role:e.role as SourceRole,kind:text(e.kind,`${where}.kind`,80),lineSha256:hex(e.lineSha256,`${where}.lineSha256`),
      quoteSha256:hex(e.quoteSha256,`${where}.quoteSha256`),quote:text(e.quote,`${where}.quote`,QUOTE_LIMIT),truncated:e.truncated as boolean,note:e.note===null?null:text(e.note,`${where}.note`)};
  });
  const refs=new Set<string>();
  for(const e of excerpts){if(refs.has(e.ref))fail('DUPLICATE_REF',`발췌 ref ‘${e.ref}’가 두 번 있어요.`);refs.add(e.ref);}
  if(!Array.isArray(root.proposals)||!root.proposals.length)fail('FIELD','proposals: 제안이 1개 이상 있어야 해요.');
  if((root.proposals as unknown[]).length>MAX_PROPOSALS)fail('TOO_MANY',`proposals: 한 출처 표본의 제안은 ${MAX_PROPOSALS}개까지예요.`);
  const proposals=(root.proposals as unknown[]).map((v,i):SourceProposal=>{
    const where=`proposals[${i}]`,p=object(v,where,['id','label','refs','observed','fidelity','scope','identity','roleChange','missing']);
    if(!Array.isArray(p.refs)||!p.refs.length)fail('FIELD',`${where}.refs: 근거 발췌가 1개 이상 있어야 해요.`);
    const own=(p.refs as unknown[]).map((x,j)=>id(x,`${where}.refs[${j}]`));
    const seen=new Set<string>();
    for(const ref of own){
      if(seen.has(ref))fail('DUPLICATE_PROPOSAL_REF',`${where}: 근거 ref ‘${ref}’가 중복돼요.`);seen.add(ref);
      if(!refs.has(ref))fail('MISSING_REF',`${where}: 근거 ref ‘${ref}’에 해당하는 원문 발췌가 파일에 없어요.`);
    }
    return {id:id(p.id,`${where}.id`),label:text(p.label,`${where}.label`,200),refs:own,observed:text(p.observed,`${where}.observed`),fidelity:text(p.fidelity,`${where}.fidelity`),
      scope:text(p.scope,`${where}.scope`),identity:text(p.identity,`${where}.identity`),roleChange:text(p.roleChange,`${where}.roleChange`),missing:texts(p.missing,`${where}.missing`,12)};
  });
  const ids=new Set<string>();
  for(const p of proposals){if(ids.has(p.id))fail('DUPLICATE_PROPOSAL',`제안 id ‘${p.id}’가 두 번 있어요.`);ids.add(p.id);}
  return {schemaVersion:PROPOSAL_SCHEMA,source,range,excerpts,proposals};
}

/** Recomputes each excerpt string's SHA-256 (digest is injected: WebCrypto in the page, node:crypto in tests).
 * This checks only the excerpt strings. It never checks the raw source or its lines, which this app does not read. */
export async function verifyExcerptHashes(sample:ProposalSample,digest:(text:string)=>Promise<string>):Promise<void> {
  for(const e of sample.excerpts)if(await digest(e.quote)!==e.quoteSha256)
    fail('HASH_MISMATCH',`발췌 ${e.ref}의 문자열이 기록된 quoteSha256과 맞지 않아요. 발췌가 바뀌었거나 해시가 다른 문자열의 것이에요.`);
}

const sorted=(a:string[])=>[...a].sort();
/** Canonical form for 'same input': array order of excerpts/proposals/refs/missing ignored, every other byte counts. */
export function sampleKey(sample:ProposalSample):string {
  return JSON.stringify({schemaVersion:sample.schemaVersion,source:sample.source,range:sample.range,
    excerpts:[...sample.excerpts].sort((a,b)=>a.ref.localeCompare(b.ref)).map(e=>[e.ref,e.line,e.role,e.kind,e.lineSha256,e.quoteSha256,e.quote,e.truncated,e.note]),
    proposals:[...sample.proposals].sort((a,b)=>a.id.localeCompare(b.id)).map(p=>[p.id,p.label,sorted(p.refs),p.observed,p.fidelity,p.scope,p.identity,p.roleChange,sorted(p.missing)])});
}
/** Same recorded raw source and the same excerpt set (ref, line and excerpt hash). Says nothing about meaning. */
export function sameSourceRange(a:ProposalSample,b:ProposalSample):boolean {
  const set=(s:ProposalSample)=>JSON.stringify(s.excerpts.map(e=>`${e.ref}|${e.line}|${e.quoteSha256}`).sort());
  return a.source.rawSha256===b.source.rawSha256&&set(a)===set(b);
}
/** Proposal ids that already exist for the same source id or raw hash in `other` but with different content. */
export function changedSameIds(sample:ProposalSample,other:ProposalSample):string[] {
  if(sample.source.id!==other.source.id&&sample.source.rawSha256!==other.source.rawSha256)return [];
  const key=(s:ProposalSample,p:SourceProposal)=>JSON.stringify([p,sorted(p.refs).map(r=>s.excerpts.find(e=>e.ref===r))]);
  return sample.proposals.filter(p=>{const q=other.proposals.find(x=>x.id===p.id);return !!q&&key(sample,{...p,refs:sorted(p.refs),missing:sorted(p.missing)})!==key(other,{...q,refs:sorted(q.refs),missing:sorted(q.missing)});}).map(p=>p.id);
}

export function roleCounts(sample:ProposalSample):Record<SourceRole,number> {
  const out={user_instruction:0,coordinator_interpretation:0,assignment_notice:0,execution_observation:0};
  for(const e of sample.excerpts)out[e.role]++;return out;
}
export const excerptOf=(sample:ProposalSample,ref:string)=>sample.excerpts.find(e=>e.ref===ref)??null;
export const unusedExcerpts=(sample:ProposalSample)=>sample.excerpts.filter(e=>!sample.proposals.some(p=>p.refs.includes(e.ref)));
export const proposalsUsing=(sample:ProposalSample,ref:string)=>sample.proposals.filter(p=>p.refs.includes(ref));

/* ---------- Review state: tab memory only. Every change returns a new value. ---------- */
/** groups: the proposal's refs partitioned into evidence groups (one group = not split). States are keyed per item. */
export interface ProposalReview {key:string;sample:ProposalSample;origin:'example'|'file';groups:Record<string,string[][]>;excluded:string[];recheck:string[]}
export interface ReviewItem {key:string;proposal:SourceProposal;refs:string[];part:{index:number;count:number}|null;excluded:boolean;recheck:boolean}

export function newReview(sample:ProposalSample,origin:'example'|'file'):ProposalReview {
  return {key:sampleKey(sample),sample,origin,groups:Object.fromEntries(sample.proposals.map(p=>[p.id,[[...p.refs]]])),excluded:[],recheck:[]};
}
/** An unsplit proposal is keyed by its id; a split part by its id and its own refs (so a part never inherits the whole's state). */
export const itemKey=(proposalId:string,refs:string[],whole:boolean)=>whole?proposalId:`${proposalId}:${sorted(refs).join('+')}`;
export function reviewItems(review:ProposalReview):ReviewItem[] {
  return review.sample.proposals.flatMap(p=>{const groups=review.groups[p.id]??[p.refs];
    return groups.map((refs,i)=>{const key=itemKey(p.id,refs,groups.length===1);
      return {key,proposal:p,refs,part:groups.length>1?{index:i+1,count:groups.length}:null,excluded:review.excluded.includes(key),recheck:review.recheck.includes(key)};});});
}
const known=(review:ProposalReview,key:string)=>reviewItems(review).some(i=>i.key===key);
export function setExcluded(review:ProposalReview,key:string,on:boolean):ProposalReview {
  if(!known(review,key))return review;
  return {...review,excluded:on?[...new Set([...review.excluded,key])]:review.excluded.filter(k=>k!==key)};
}
export function toggleRecheck(review:ProposalReview,key:string):ProposalReview {
  if(!known(review,key))return review;
  return {...review,recheck:review.recheck.includes(key)?review.recheck.filter(k=>k!==key):[...review.recheck,key]};
}
/** Moves some refs of one group into a new group right after it. Only partitions the proposal's own refs: a group needs
 * two or more refs, at least one ref stays and one moves, so a proposal has at most as many parts as refs (no copies). */
export function splitGroup(review:ProposalReview,proposalId:string,groupIndex:number,move:string[]):ProposalReview {
  const groups=review.groups[proposalId],group=groups?.[groupIndex];
  if(!groups||!group||group.length<2)fail('SPLIT','근거 발췌가 2개 이상인 묶음만 분리할 수 있어요.');
  const moving=new Set(move);
  if(!moving.size||[...moving].some(r=>!group!.includes(r))||moving.size>=group!.length)fail('SPLIT','옮길 발췌를 1개 이상 고르고, 1개 이상은 남겨 두세요.');
  const whole=itemKey(proposalId,group!,groups!.length===1);
  const next=[...groups!.slice(0,groupIndex),group!.filter(r=>!moving.has(r)),group!.filter(r=>moving.has(r)),...groups!.slice(groupIndex+1)];
  // The split group's own marks belonged to the whole group; they are not copied to either new part.
  return {...review,groups:{...review.groups,[proposalId]:next},excluded:review.excluded.filter(k=>k!==whole),recheck:review.recheck.filter(k=>k!==whole)};
}
/** Back to one group in the proposal's original ref order. Marks on the parts are dropped (they belonged to the parts). */
export function undoSplit(review:ProposalReview,proposalId:string):ProposalReview {
  const p=review.sample.proposals.find(x=>x.id===proposalId);if(!p)return review;
  const prefix=`${proposalId}:`;
  return {...review,groups:{...review.groups,[proposalId]:[[...p.refs]]},excluded:review.excluded.filter(k=>!k.startsWith(prefix)),recheck:review.recheck.filter(k=>!k.startsWith(prefix))};
}

export type ImportOutcome={reviews:ProposalReview[];open:string|null;outcome:'new'|'reused'|'full';changedIds:string[]};
/** Adds a checked sample to the tab's reviews. The same input reuses its review (no duplicate); anything else is new. */
export function addReview(reviews:ProposalReview[],sample:ProposalSample,origin:'example'|'file'):ImportOutcome {
  const key=sampleKey(sample),same=reviews.find(r=>r.key===key);
  if(same)return {reviews,open:same.key,outcome:'reused',changedIds:[]};
  if(reviews.length>=MAX_REVIEWS)return {reviews,open:null,outcome:'full',changedIds:[]};
  const changedIds=[...new Set(reviews.flatMap(r=>changedSameIds(sample,r.sample)))];
  const review=newReview(sample,origin);
  return {reviews:[...reviews,review],open:review.key,outcome:'new',changedIds};
}
