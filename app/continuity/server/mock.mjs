// Explicit deterministic preview. No language-model calls and no claim of general comprehension.
export function mockAdvice(request) {
  const local=request.sources.filter(s=>s.taskId===request.ticket.taskId && s.kind!=='manual_decision');
  const latest=local.at(-1) ?? request.sources.at(-1);
  const initial=local[0] ?? latest;
  const related=request.bases.filter(b=> {
    if(local.some(s=>s.id===b.sourceId) || latest.text.includes(b.id)) return true;
    const words=latest.text.match(/[가-힣A-Za-z0-9]{2,}/g) ?? [];
    return words.some(w=>b.text.includes(w));
  }).map(b=>b.id);
  const out={understanding:'입력한 요청을 작은 작업으로 이어갑니다.',scope:'명시한 범위만 다루고, 나머지 저장 기준은 유지합니다.',
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
    return {...out,understanding:initial.kind==='report'?'돌아온 구현 보고를 앞선 작업에 연결했습니다. 실제 검증 완료로 바꾸지는 않습니다.':'가져온 관찰·검사 자료를 연결했습니다. Studio가 실행한 검사는 아닙니다.',
      scope:'돌아온 결과와 이전 요청을 대조하는 작은 후속 작업. 관련 없는 기준이나 정책은 바꾸지 않습니다.',
      next:'보고한 변경을 이전 요청·관련 기준과 대조하세요. 제공한 자료로 확인되는 범위와 아직 확인하지 못한 동작을 분리하고, 필요한 수정 또는 검사를 진행하세요.',
      checks:'보고된 성공을 그대로 전체 완료로 인정하지 말고, 실제 실행한 검사·관찰 결과와 남은 한계를 구분해 보고하세요.'};
  }
  const input=latest.text;
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
