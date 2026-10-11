import { CASES, prepareCase } from './cases.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const parts=['# INIT-005 — 한국어 가상 고객 사례 6개',
  '생성 원본: `scripts/init005/cases.mjs`. 모든 사례는 가상 데이터이며 실제 사용자 조사 결과가 아니다. 각 사례의 실호출은 1회로 제한한다. 사전 대화가 있는 경우 기존 mock으로 구성하며 실제 AI 관찰로 기록하지 않는다.'];
for(const c of CASES){const f=prepareCase(c);parts.push(`## ${c.id}. ${c.name}`,`단계: ${c.phase} · 도구: ${f.request.brief.tools} · 모의 사전 응답: ${f.seededPriorTurns}회`,
  `초기 설명: ${f.request.brief.idea}`,`제약: ${f.request.brief.constraints || '이 사례에서 별도 제공하지 않음'}`,
  `### 판정할 고객 원문 (${c.input.length} UTF-16 단위)`,c.input,
  '### 기대 행동',...c.expected.map(x=>`- ${x}`),'### 실패 기준',...c.failure.map(x=>`- ${x}`));}
parts.push('## 공통 판정','EVALUATION.md의 5항목 점수와 근거를 별도로 기록한다. JSON 검증 통과, 모의 통과, 실제 모델의 고객 품질 통과를 혼동하지 않는다. 첫 질문만 보는 사례는 답변 반영 항목을 n/a로 표시할 수 있다. C3의 실제 호출 기본 disposition은 unknown이고 원문은 보류 의도를 포함한다. deferred 변형은 유료 호출 없이 단위 검사로 함께 확인한다.');
const dir=fileURLToPath(new URL('../../docs/init005/',import.meta.url));mkdirSync(dir,{recursive:true});
writeFileSync(`${dir}CASES.md`,parts.join('\n\n')+'\n');
console.log('Generated CASES.md from fictional case definitions. No provider calls.');
