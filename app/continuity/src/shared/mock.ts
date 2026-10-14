import { type ContextRequest, type Advice } from './types.js';
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
/* FLOW094: the action the request itself asks for. A request whose own words forbid changing or running something, or that asks
 * only for a review/research/design output (with no change verb), stays that kind of work: the preview never adds code edits,
 * command runs, reproduction or deployment it did not ask for. A mentioned code path or incident is a topic, not an ask.
 * Still word rules, not comprehension: when unsure it keeps the request's own scope instead of widening it. */
const ACT='변경|수정|구현|설치|실행|배포|재현|커밋|푸시';
const NEG='없이|하지\\s*(?:마|말|않)|금지|말고|않고';
// The forbidden action may close a list ('코드·설치·실행·배포 변경 없이', '구현/배포 금지'): the whole list is a prohibition.
const FORBID=new RegExp(`(?:[^\\s·/,、]+\\s*[·/,、]\\s*)*(?:${ACT})\\s*(?:은|는|을|를|도)?\\s*(?:${NEG})|(?:고치|건드리|손대)지\\s*(?:마|말|않)`,'g');
const CHANGE_ASK=/수정|고쳐|고치|바꿔|바꾸어|변경해|구현|만들어|추가해|적용해|반영해|삭제해|없애/;
const REVIEW_ASK=/(?:검토|조사|설계|분석|비교|제안|계획|정리|평가)(?:만|\s*해\s*(?:주|줘)|하여\s*주|해서\s*(?:알려|정리|보고))/;
const REPRO_ASK=/재현|원인을?\s*(?:찾|확인|조사|파악|분석)/;
function actionOf(text:string):'review'|'other' {
  const forbids=new RegExp(FORBID.source).test(text),asked=text.replace(FORBID,' ');
  return !CHANGE_ASK.test(asked)&&(forbids||REVIEW_ASK.test(text))?'review':'other';
}
const REVIEW_WORK={understanding:'검토·조사·설계 범위의 요청으로 이어갑니다. 실행·변경 작업으로 바꾸지 않았습니다.',
  scope:'요청 원문이 정한 질문과 산출물만 다룹니다. 원문이 요청하지 않은 코드 수정·명령 실행·장애 재현·배포는 이번 범위가 아니며, 원문이 금지한 변경도 하지 않습니다.',
  next:'요청 원문이 요구한 항목만 검토·정리해 반환하세요. 필요한 읽기·확인은 원문이 허용한 범위에서만 하고, 모르는 값은 미확인으로 남기세요.',
  checks:'반환물이 원문이 요구한 항목을 다뤘는지, 원문이 금지하거나 요청하지 않은 변경·실행을 하지 않았는지, 미확인을 확정으로 쓰지 않았는지 확인해 보고하세요.'};
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
  const out:Advice={intent,understanding:'입력한 요청을 작은 작업으로 이어갑니다.',scope:'명시한 범위만 다루고, 나머지 저장 기준은 유지합니다.',
    next:'관련 구현 위치를 찾고 요청한 부분만 수정하세요. 새 정책이나 기술 선택은 임의로 추가하지 마세요.',
    checks:'요청한 변화가 보이는지 확인하고, 기존 동작을 바꾸지 않았는지 관련 검사를 실행해 결과를 따로 보고하세요.',
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
    // A return to a review-only request is compared and sorted, not turned into fixes or test runs.
    if(asked&&actionOf(asked.text)==='review')return {...out,understanding:initial.kind==='report'?'돌아온 구현 보고를 앞선 작업에 연결했습니다. 실제 검증 완료로 바꾸지는 않습니다.':'가져온 관찰·검사 자료를 연결했습니다. Studio가 실행한 검사는 아닙니다.',
      scope:'돌아온 결과를 앞선 검토·설계 요청과 대조합니다. 그 요청이 정하지 않은 수정·실행은 이번 범위가 아닙니다.',
      next:'돌아온 내용을 앞선 요청의 항목과 대조해 확인된 것과 미확인을 나눠 정리하세요. 수정·검사 실행·재현을 새로 더하지 마세요.',
      checks:REVIEW_WORK.checks};
    return {...out,understanding:initial.kind==='report'?'돌아온 구현 보고를 앞선 작업에 연결했습니다. 실제 검증 완료로 바꾸지는 않습니다.':'가져온 관찰·검사 자료를 연결했습니다. Studio가 실행한 검사는 아닙니다.',
      scope:'돌아온 결과와 이전 요청을 대조하는 작은 후속 작업. 관련 없는 기준이나 정책은 바꾸지 않습니다.',
      next:'보고한 변경을 이전 요청·관련 기준과 대조하세요. 제공한 자료로 확인되는 범위와 아직 확인하지 못한 동작을 분리하고, 필요한 수정 또는 검사를 진행하세요.',
      checks:'보고된 성공을 그대로 전체 완료로 인정하지 말고, 실제 실행한 검사·관찰 결과와 남은 한계를 구분해 보고하세요.'};
  }
  const input=latest.text;
  if(actionOf(input)==='review') {
    // Reproduction stays only when the request itself asks for it (e.g. to find a cause without changing code).
    if(/오류|실패|원인|안\s?돼|중복 결제/.test(input)&&REPRO_ASK.test(input))return {...out,understanding:'문제 현상은 입력됐지만 원인은 아직 확인되지 않았습니다. 요청한 확인 범위만 이어갑니다.',
      scope:'요청한 재현·기대/실제 동작 확인까지. 원문이 금지한 변경과 원인·운영 조치 추정은 하지 않습니다.',
      next:'요청한 범위에서 현상을 재현하고 기대값과 실제값을 비교하세요. 코드 수정·자동 복구·삭제·결제는 실행하지 마세요.',
      checks:'재현 여부와 기대/실제 차이, 영향 범위를 관찰 그대로 보고하고, 원인 추정은 확인된 사실과 구분하세요.'};
    return {...out,...REVIEW_WORK};
  }
  if(/CSV|debounce|디바운스|문구|라벨|D\d+(?:을|를|의)/i.test(input)) {
    return {...out,understanding:'요청한 작은 변경의 작업문을 바로 준비했습니다. 추가 제품 선택은 요구하지 않습니다.',
      scope:'요청한 값·문구·출력 범위만 변경합니다. 그 외 저장·권한·처리 순서 같은 기존 정책은 유지합니다.'};
  }
  if(/오류|실패|원인|안\s?돼|중복 결제/.test(input)) {
    return {...out,understanding:'문제 현상은 입력됐지만 원인은 아직 확인되지 않았습니다.',
      scope:'재현·기대/실제 동작과 이미 영향받은 항목의 상태 확인. 원인이나 운영 조치는 추정하지 않습니다.',
      next:'먼저 현상을 재현하고 기대값과 실제값을 비교하세요. 이미 영향받은 항목도 확인하되 자동 복구·삭제·결제를 실행하지 마세요.',
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
