import assert from 'node:assert/strict';
import * as D from '../product18-author/app/continuity/dist/public/shared/domain.js';
import {parseProject} from '../product18-author/app/continuity/dist/public/shared/validation.js';
let p=D.addArea(D.createProject(),'부모','부모 맥락');const parent=p.space.areas[0].id;
p=D.addChildArea(p,parent,'자식','자식 구상');const child=p.space.areas.at(-1).id;
p=D.submit(D.editDraft(p,'부모 작업 요청'),undefined,parent);const parentTask=p.currentTaskId;
const common='모든 하위 화면은 키보드로 조작 가능해야 한다';
const local='부모 관리 화면만 읽기 전용으로 둔다';
p=D.recordBasis(p,common);const commonBasis=p.bases.at(-1);
p=D.recordBasis(p,local);const localBasis=p.bases.at(-1);
p=D.submit(D.editDraft(p,'자식의 버튼 문구를 바꾼다'),undefined,child);
const before=JSON.stringify(p),text=D.handoffText(p),start=text.indexOf('## 다른 영역에서 기록한 사용자 기준');
assert.ok(start>0);const next=text.indexOf('\n## ',start+3),section=text.slice(start,next<0?undefined:next);
for(const b of [commonBasis,localBasis]) {
  assert.ok(section.includes(b.text));assert.ok(section.includes(`[${b.id}]`));
  assert.ok(section.includes(`r${b.revision}`));assert.ok(section.includes(b.sourceId));
  assert.ok(!text.slice(text.indexOf('## 이어갈 기준'),start).includes(b.text));
}
assert.ok(section.includes(parent)&&section.includes(parentTask));
assert.ok(section.includes('원문이 명시한 공통 조건은 해당 범위에서 유지'));
assert.ok(section.includes('기록 위치로 실제 적용 범위를 판정하지'));
assert.ok(section.includes('이 자식의 실행 범위로 자동 상속하지'));
assert.ok(section.includes('사용자의 직접 결정 권위는 유지'));
assert.equal(JSON.stringify(p),before);assert.deepEqual(parseProject(before),p);
console.log(JSON.stringify({node:process.version,commonPreserved:true,parentOnlyPreserved:true,ownerPreserved:true,scopeGuidancePresent:true,modelUnchanged:true},null,2));
console.log(section);
