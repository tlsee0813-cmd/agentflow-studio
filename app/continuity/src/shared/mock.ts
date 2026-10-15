import { BASIS_LABEL, type ContextRequest, type Advice, type GuideRequest, type GuideReply, type Proposal } from './types.js';
/** A corrected condition text as response items (<=12 x 1000 chars, none blank), cut only between words/lines.
 * Joined they give the text back; blank text gives none. Only a whitespace run longer than one item can shrink. */
function conditionItems(value:string):string[] {
  if(!value.trim())return [];
  const tokens=value.match(/\s*\S+\s*$|\s*\S+/g)??[],items:string[]=[];let item='';
  for(let token of tokens) {
    while(token.length>1000) { // one unbroken word longer than an item: split it, never inside a surrogate pair
      let cut=1000;if(/[\uD800-\uDBFF]/.test(token[cut-1]!))cut--;
      if(item){items.push(item);item='';}
      if(token.slice(0,cut).trim())items.push(token.slice(0,cut));
      token=token.slice(cut);
    }
    if(item.length+token.length>1000){items.push(item);item='';}
    item+=token;
  }
  if(item.trim())items.push(item);else if(item&&items.length&&items.at(-1)!.length+item.length<=1000)items[items.length-1]+=item;
  return items;
}
/** The response goal holds 2000 chars; a longer continued goal is shortened visibly, never silently. */
function goalText(value:string):string {
  if(value.length<=2000)return value;
  let cut=1960;if(/[\uD800-\uDBFF]/.test(value[cut-1]!))cut--;
  return `${value.slice(0,cut)} … (길어서 앞부분만 · 원문은 해당 작업에 그대로 보존)`;
}
// Explicit deterministic preview. No language-model calls and no claim of general comprehension.
export function mockAdvice(request:ContextRequest):Advice {
  const local=request.sources.filter(s=>s.taskId===request.ticket.taskId && s.kind!=='manual_decision');
  const latest=(local.at(-1) ?? request.sources.at(-1))!;
  const initial=local[0] ?? latest;
  const related=request.bases.filter(b=> {
    if(local.some(s=>s.id===b.sourceId) || latest.text.includes(b.id)) return true;
    const words=latest.text.match(/[가-힣A-Za-z0-9]{2,}/g) ?? [];
    return words.some(w=>b.text.includes(w));
  }).map(b=>b.id);
  const refs=request.bases.filter(b=>request.appFacts.inputs.some(s=>s.sourceId===b.sourceId)).map(b=>({basisId:b.id,sourceId:b.sourceId,revision:b.revision}));
  // FIX088: a returned report is a claim about earlier work, never the user's goal. It continues the purpose of the
  // request it returns to (the previous interpretation, else that request's own words); with no request, none is set.
  const returned=initial.kind==='report'||initial.kind==='evidence',prior=request.previousIntent;
  const asked=request.sources.filter(s=>s.kind==='request'&&s.taskId!==request.ticket.taskId).at(-1);
  // Earlier refs by basis ID, then this task's own (a basis recorded here, current version wins): every input stays cited.
  const cite=(earlier:{basisId:string;sourceId:string;revision:number}[])=>[...new Map([...earlier,...refs].map(r=>[r.basisId,r])).values()];
  const intent:Advice['intent']=!returned?{version:'intent.1',relation:prior?'separate':'start',goal:initial.text.slice(0,2000),conditions:[],retired:[],basisRefs:refs}
    :prior?{version:'intent.1',relation:'continue',goal:goalText(prior.manualGoal??prior.value!.goal),
      conditions:prior.manualGoal!==null?conditionItems(prior.manualConditions??''):prior.value!.conditions,retired:[],basisRefs:cite(prior.value?.basisRefs??[])}
    :{version:'intent.1',relation:asked?'continue':'uncertain',goal:asked?goalText(asked.text):'요청 원문이 없어 목적을 정하지 않았어요. 돌아온 보고는 목적이 아니에요.',conditions:[],retired:[],basisRefs:cite([])};
  // FLOW094-R1: the default follows the request's own words. Whatever the request asks or forbids (implement, reproduce, only
  // read, no deploy) stays in the original text the executor reads; this preview neither adds an action nor takes one away.
  const out:Advice={intent,understanding:'입력한 요청을 원문 범위 그대로 이어갑니다. MOCK은 요청의 의미를 해석해 할 일을 정하지 않습니다.',
    scope:'요청 원문이 정한 행동과 범위만 다룹니다. 원문의 요청과 금지를 그대로 따르고, 나머지 저장 기준은 유지합니다.',
    next:'요청 원문이 요청한 행동만 하세요. 원문에 없는 코드 수정·명령 실행·재현·배포를 새로 더하지 말고, 새 정책이나 기술 선택도 임의로 추가하지 마세요. 모르는 값은 미확인으로 남기세요.',
    checks:'원문이 요청한 결과를 다뤘는지, 원문이 요청하지 않았거나 금지한 변경·실행을 하지 않았는지 확인하고, 실제로 확인한 것과 못 한 것을 구분해 보고하세요.',
    question:null,relatedBasisIds:related,reviewBasisIds:[],suggestions:[]};
  if(latest.kind==='test_answer') {
    return {...out,understanding:'합성 시험답변을 별도 조건으로 보존했습니다. 실제 요구를 바꾸지 않습니다.',
      scope:'가정한 시험 장면만. 기존 확정 기준과 실제 구현 완료 상태는 유지합니다.',next:'시험 조건에서 다음 작업의 차이를 검토하세요. 실제 변경 승인으로 사용하지 마세요.'};
  }
  if(latest.disposition!=='provided') {
    return {...out,understanding:latest.disposition==='unknown'?'답을 모른다는 사용자 입력을 보존했습니다.':'이 질문에 대한 사용자의 보류를 보존했습니다.',
      scope:'미확인 부분은 결정하거나 구현하지 않고 확인할 항목만 준비합니다. 기존 기준은 폐기하지 않습니다.',
      next:'빠진 사실 또는 선택을 아래 원문에서 구분하고 확인할 자료를 적으세요. 새로운 운영 조치나 정책을 더하지 마세요.',checks:'확인되지 않은 부분이 사실/확정으로 쓰이지 않았는지 검토하세요.'};
  }
  if(latest.kind==='answer') {
    return {...out,understanding:'사용자의 답변을 앞선 질문과 함께 작업 문맥에 연결했습니다.',
      next:'질문과 답변 원문을 기준으로 이번 범위의 작업을 준비하세요. 답변으로 정하지 않은 조건과 원인은 미확인으로 유지하세요.'};
  }
  if(initial.kind==='report' || initial.kind==='evidence') {
    return {...out,understanding:initial.kind==='report'?'돌아온 구현 보고를 앞선 작업에 연결했습니다. 실제 검증 완료로 바꾸지는 않습니다.':'가져온 관찰·검사 자료를 연결했습니다. Studio가 실행한 검사는 아닙니다.',
      scope:'돌아온 결과와 이전 요청을 대조하는 작은 후속 작업. 관련 없는 기준이나 정책은 바꾸지 않습니다.',
      next:'보고한 변경을 이전 요청·관련 기준과 대조하세요. 제공한 자료로 확인되는 범위와 아직 확인하지 못한 동작을 분리해 정리하세요. 이전 요청이 정하지 않은 수정·실행은 새로 더하지 마세요.',
      checks:'보고된 성공을 그대로 전체 완료로 인정하지 말고, 실제 실행한 검사·관찰 결과와 남은 한계를 구분해 보고하세요.'};
  }
  const input=latest.text;
  // A fact question only when the user says the cause is unknown; a mentioned failure or error is not assumed to be an incident.
  if(/원인(?:은|을|이)?\s*(?:아직\s*)?(?:잘\s*)?(?:모르|모른|몰라)/.test(input)) {
    return {...out,understanding:'문제 현상과 원인을 모른다는 점이 입력됐습니다. 원인은 확인되지 않았습니다.',
      scope:'요청 원문이 정한 행동과 범위만 다룹니다. 원인이나 운영 조치는 추정하지 않습니다.',
      question:{kind:'fact',text:'문제가 생긴 한 번의 상황에서 기대한 결과와 실제로 보인 결과는 무엇인가요?',why:'원인을 단정하지 않고 확인 범위를 좁히기 위한 관찰 정보입니다. 모르면 확인 작업만 넘길 수 있습니다.',options:[]}};
  }
  if(/자동|알아서/.test(input) && /예약|대기/.test(input) && !/참여 확인|수락|즉시 확정|자동 확정/.test(input)) {
    return {...out,understanding:'빈자리가 생겼을 때 대기자를 이어주는 기능으로 이해했습니다.',
      scope:'예약 성립 방식만 정합니다. 대기 순서·응답 시간·미응답 처리는 임의로 추가하지 않습니다.',
      question:{kind:'choice',text:'자리가 생기면 예약을 바로 확정할까요, 참여 의사를 확인한 뒤 확정할까요?',why:'고객에게 확정 예약이 생기는 시점이 달라집니다.',options:[
        {label:'바로 예약 확정',consequence:'추가 응답 없이 예약이 성립합니다. 참여 의사를 별도로 확인하지 않습니다.'},
        {label:'참여 확인 뒤 확정',consequence:'참여 의사를 받은 뒤 예약이 성립합니다. 응답을 기다리는 과정이 필요합니다.'}]}};
  }
  return out;
}
/* GUIDE097: deterministic guidance preview. It knows one question (how a reservation is confirmed) and maps only its own
 * option labels to a branch. It never reads a choice out of free sentences (an idea, a decision, a request, a free or quoted
 * answer): those are quoted as they are, with what they are, and the draft defers to them. No language-model call. */
const TOPIC=/확정|승인|수락|참여\s*확인/;
export const GUIDE_QUESTION={kind:'choice' as const,text:'예약이 들어오면 바로 확정할까요, 공방이 확인한 뒤 확정할까요?',why:'고객에게 예약 확정이 보이는 시점과 이번에 만들 화면 범위가 달라집니다. 모르면 접수까지만 만들 수 있어요.',options:[
  {label:'바로 확정',consequence:'고객이 시간을 고르면 그 자리에서 예약이 확정됩니다. 공방의 승인 단계는 없습니다.'},
  {label:'공방 확인 뒤 확정',consequence:'예약은 ‘확인 대기’로 접수되고, 공방이 승인해야 확정됩니다.'}]};
/** GUIDE097-R2: nothing is cut. A short original is quoted whole; a longer one, or one that no longer fits a field, is named by
 * where its whole text actually is (a basis ID, the area idea in the background copy, the answer section of the draft). */
const QUOTE=300,FIELD=2000,OPEN_ITEM=500;
/** Join entries in order while they fit max; the rest are counted and named by their short refs (or only counted, if even that cannot fit). */
function fitted(head:string,entries:{full:string;ref:string}[],max:number,where:string):string {
  let out=head,i=0;
  for(;i<entries.length;i++){const next=`${i?' / ':''}${entries[i]!.full}`;if(out.length+next.length>max-120)break;out+=next;}
  if(i===entries.length)return out;
  const rest=entries.slice(i),refs=` / 외 ${rest.length}건: ${rest.map(e=>e.ref).join(', ')} (각 원문은 ${where})`;
  return out.length+refs.length<=max?out+refs:`${out} / 외 ${rest.length}건 (모두 ${where})`;
}
export function mockGuidance(req:GuideRequest):GuideReply {
  const a=req.area,idea=a.note??a.name;
  const reservation=/예약|대기/.test(`${a.name}\n${a.note??''}`);
  const open:string[]=[...(a.note===null?['영역 구상이 비어 있어 무엇을 만들지 — 초안을 직접 고쳐 적어 주세요']:[]),...(req.areaWork.length?['이 영역의 이전 요청과 겹치는지 — 직접 확인']:[])];
  // MOCK picks no defaults: it never fills in details on the user's behalf.
  const proposal=(scope:string,checks:string,more:string[]=[]):GuideReply=>({question:null,proposal:{goal:idea,scope,checks,open:[...more,...open],defaults:[]} satisfies Proposal});
  // GUIDE099: a typed instruction is the user's current request. MOCK cannot read it, so it neither asks nor designs anything:
  // the draft defers to the instruction as written (it travels whole in the draft's own section).
  if(req.currentInstruction!==null)return proposal('이번 요청은 아래 ‘이번에 맡기거나 바꿀 일’ 원문을 그대로 따릅니다. MOCK은 그 뜻을 해석하거나 범위를 새로 정하지 않습니다. 원문이 명시적으로 바꾸지 않은 저장된 결정은 그대로이며, 원문에 없는 구현·실행·배포·정책은 더하지 않습니다.',
    '이번 요청 원문이 요청한 행동과 범위만 다뤘는지, 원문이 요청하지 않은 구현·실행·배포나 정책을 새로 하지 않았는지 확인하고, 실제로 확인한 것과 못 한 것을 나눠 보고합니다.');
  if(reservation) {
    const ans=req.answer,said=ans?.disposition==='provided'?ans.text:null;
    // Only this MOCK's own option, by its exact label. Anything else the user wrote is followed as written.
    const option=said===null?-1:GUIDE_QUESTION.options.findIndex(o=>o.label===said);
    if(option===0)return proposal('고객이 빈 시간을 고르면 그 자리에서 예약이 확정됩니다. 공방의 승인 단계는 만들지 않습니다. 결제·알림·취소 정책은 이번에 더하지 않습니다.',
      '예약 직후 고객 화면에 ‘예약 확정’이 보이는지, 이미 확정된 같은 시간에 두 번째 예약이 확정되지 않는지 확인합니다.');
    if(option===1)return proposal('고객 예약은 ‘확인 대기’로 접수되고, 공방이 승인하면 확정됩니다. 승인 기한·거절 안내는 정하지 않았으므로 임의로 정하지 않습니다. 결제·알림은 이번에 더하지 않습니다.',
      '접수 직후에는 ‘확인 대기’로 보이고 확정으로 보이지 않는지, 공방이 승인한 뒤에만 ‘예약 확정’으로 바뀌는지 확인합니다.',['승인 기한과 거절 안내']);
    // A long answer is not copied into this field: the draft carries the whole answer in its own section (proposalText).
    if(said!==null)return proposal(`${said.length<=QUOTE?`예약 확정 방식은 사용자 답변 원문을 따릅니다: ‘${said}’.`:'예약 확정 방식은 이 요청 끝의 ‘안내 질문과 사용자 답변 원문’ 전문을 그대로 따릅니다(답이 길어 이 줄에는 옮기지 않음).'} MOCK은 이 답의 뜻을 해석하지 않으며, 답변에 없는 정책은 더하지 않습니다.`,
      // GUIDE098-M: MOCK cannot read a free answer, so the check names no action of its own (no build, run or behaviour test).
      '답변 원문이 요청한 행동과 범위만 다뤘는지, 원문이 요청하지 않은 구현·실행·배포나 정책을 새로 하지 않았는지 확인하고, 실제로 확인한 것과 못 한 것을 나눠 보고합니다.');
    if(ans)return proposal('고객이 원하는 시간을 골라 예약 요청을 남기는 접수까지만 만듭니다. 확정 방식(바로/확인 뒤)은 사용자가 아직 정하지 않았으므로 확정 처리는 만들지 않습니다.',
      '예약 요청이 접수 기록으로 남는지 확인하고, 확정·승인 동작이 새로 생기지 않았는지 확인합니다.',[`예약 확정 방식 — 사용자 ${ans.disposition==='unknown'?'모름':'보류'}`]);
    // Existing material that already speaks about confirmation is respected as written, never re-asked or read as a choice.
    // ref = where the whole original is in every handoff: a basis by ID, the area idea in the background copy, a task's own fields.
    const cited=[...(a.note!==null?[{label:'영역 구상',text:a.note,ref:'영역 구상(배경 사본)',deferred:null}]:[]),
      ...req.decisions.map(d=>({label:`${d.id} ${BASIS_LABEL[d.status]}`,text:d.text,ref:`기준 ${d.id}`,deferred:d.status==='deferred'?d.id:null})),
      ...req.areaWork.flatMap(w=>[{label:'이 영역의 요청 원문',text:w.request,ref:`작업 ${w.taskId}의 요청`,deferred:null},
        ...(w.scope?[{label:'직접 고친 범위',text:w.scope,ref:`작업 ${w.taskId}의 범위`,deferred:null}]:[]),...(w.checks?[{label:'직접 고친 완료 조건',text:w.checks,ref:`작업 ${w.taskId}의 완료 조건`,deferred:null}]:[])])]
      .filter(c=>TOPIC.test(c.text));
    if(!cited.length)return {question:structuredClone(GUIDE_QUESTION),proposal:null};
    const scope=fitted('예약 확정 방식은 아래 기존 기록 원문을 그대로 따릅니다. MOCK은 그 뜻을 해석하거나 새로 정하지 않습니다: ',
      cited.map(c=>({full:c.text.length<=QUOTE?`[${c.label}] ‘${c.text}’`:`[${c.label}] 원문이 길어 ${c.ref}의 전문을 따름`,ref:c.ref})),FIELD,'앱 기록(기준 목록·배경 사본·영역 화면의 원문 보기)에 그대로 있음');
    // R2-1: every deferral is named in ONE open item (the contract allows 6), never one item each.
    const deferred=cited.flatMap(c=>c.deferred?[c.deferred]:[]);
    const held=deferred.length?[fitted('확정 방식 관련 사용자 보류 — 정하지 않음: ',deferred.map(id=>({full:id,ref:id})),OPEN_ITEM,'작업문의 기준 목록에서 ‘사용자 보류’로 확인')]:[];
    return proposal(scope,'기존 기록 원문의 조건을 어기지 않았는지, 원문이 정하지 않은 확정 방식을 새로 만들지 않았는지 확인합니다.',held);
  }
  return proposal(`‘${idea.slice(0,300)}’에 필요한 가장 작은 화면·동작 하나만 만듭니다. 구상에 없는 정책·외부 연동·결제는 더하지 않습니다.`,
    '그 동작을 실제로 한 번 해 볼 수 있는지 확인하고, 확인한 것과 못 한 것을 나눠 보고합니다.');
}
