import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { answerTemplate, branchEvidence, submitAnswers } from './evaluator.mjs';
const json = value => JSON.stringify(value,null,2)+'\n';
function block(value) {
  const text=typeof value==='string'?value:JSON.stringify(value,null,2);
  const longest=Math.max(2,...[...text.matchAll(/`+/g)].map(m=>m[0].length));
  const fence='`'.repeat(longest+1);
  return `${fence}\n${text}\n${fence}\n`;
}
export function renderReview(session) {
  const sections=[`# ${session.persona.id}: ${session.persona.title}`,
    '고정 한국어 가상 고객 / 명시적 mock / HTTP·계약·상태 증거. 실제 고객 조사, 실제 모델 품질 또는 live 검증이 아닙니다.',
    `단계: ${session.phase}. 내용 품질: human_review_pending. 아래 기계 관찰은 내용 품질 PASS가 아닙니다.`,
    '## 고정 사실·직접 선택·미정·잠금·기대 변화',block(session.persona),
    '## 분기 관찰 (발생하지 않은 분기는 unevaluated)',block(branchEvidence(session)),
    '## 인간 검토 rubric',block(session.quality),
    '선택지의 결과, 실제 답변과 요구·완료 조건·출처의 변화를 비교하세요. factIds 일치는 의미 충실성을 증명하지 않습니다.',
    '## 초기 상태 (fixture 잠금은 합성 seed이며 이전 HTTP 대화 아님)',block(session.snapshots.initial)];
  for(const g of session.generations) {
    sections.push(`## 생성 ${g.turn}: ${g.status}`,
      block({transport:g.transport,httpStatus:g.httpStatus??null,requestId:g.request.requestId,
        projectId:g.request.projectId,baseVersion:g.request.baseVersion,errorCode:g.errorCode??null,diagnostics:g.diagnostics}));
    if(g.validatedEnvelope) sections.push('### 검증된 합성 출력 (거절 원문 없음)',block(g.validatedEnvelope));
    if(g.turn===1&&session.snapshots.first) sections.push('### 실제 표시 질문·이유·예시·선택 결과 (공통 상태 함수 적용 후)',
      block(session.snapshots.first.question),'### 첫 응답 후 상태',block(session.snapshots.first));
  }
  sections.push('## 답변·수정 원문과 전후 상태 (선택지 답은 공통 함수의 정규화 결과도 표시)',block(session.inputEvents),
    '## 잠금 충돌 미리보기·취소·명시적 확인',block(session.resolutionEvents),
    '## 둘째 생성 직후 실제 요약·요구 항목 (항목 확인 전)',block(session.snapshots.second??{status:'not_called'}),
    '## 명시적 항목 확인 (내용 품질 판정과 별개)',block(session.itemDecisions),
    '## 현재 요구·완료 조건·출처·상태',block(session.state),
    '## 미검증',
    '인간 내용 검토, 실제 모델의 질문 품질·악성 지시 저항성, live 제공업체, 비용·인증·재시작 복구, 전체 다중 대화는 미검증입니다.');
  return sections.join('\n\n')+'\n';
}
async function atomic(file, content) {
  await writeFile(file+'.tmp',content,{encoding:'utf8',mode:0o600});
  await rename(file+'.tmp',file);
}
/** New output directory only. Never silently resume/replay an earlier session. */
export async function createEvidenceStore(directory) {
  const root=resolve(directory);
  try {await mkdir(root,{recursive:false});} catch {throw new Error('OUTPUT_DIRECTORY_UNAVAILABLE');}
  return async session => {
    const dir=join(root,session.persona.id);
    await mkdir(dir,{recursive:true});
    // Dispatch awaits this write before every request. A crashed in_flight record is not resumable in 007A.
    await atomic(join(dir,'session.json'),json(session));
    await atomic(join(dir,'review.md'),renderReview(session));
    await atomic(join(dir,'question.json'),json({projectId:session.state.id,baseVersion:session.state.version,
      question:session.snapshots.first?.question??null,source:'validated first HTTP result after shared state application'}));
    await atomic(join(dir,'answer-template.json'),json(answerTemplate(session)));
  };
}
export async function submitAnswerFile(session,file) {
  let text;
  try {text=await readFile(file,'utf8');} catch {throw new Error('ANSWER_FILE_READ');}
  if(Buffer.byteLength(text,'utf8')>65536) throw new Error('ANSWER_FILE_SIZE');
  let document;
  try {document=JSON.parse(text);} catch {throw new Error('ANSWER_FILE_JSON');}
  return submitAnswers(session,document);
}
