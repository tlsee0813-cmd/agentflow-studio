import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import {recordFacts,subtreeSignals} from '../dist/public/shared/attention.js';
import {map34Fixture} from './map-signals34-fixtures.mjs';

// The two results received later in the open tab, through the same import the file chooser uses.
function received(options) {
  const s=map34Fixture(options);let p=s.p;for(const k of ['B','P'])p=D.importResultFile(p,JSON.stringify(s.late[k]));
  return {...s,p,tab:new Set([s.ids.B,s.ids.P])};
}
const facts=(s,k,parent=k==='P')=>recordFacts(s.p,s.ids[k],s.tab,parent);

test('MAP34 card facts: owned totals, current unanswered, and description states kept apart', () => {
  const s=received();
  assert.deepEqual(facts(s,'P'),['기록된 질문 4','현재 답변 기록 없음 1','현재 설명 3','이번 탭 설명 갱신 2','설명 보류 1','이전 기준 설명 1']);
  assert.deepEqual(facts(s,'A'),['기록된 질문 1','현재 설명 1']);
  assert.deepEqual(facts(s,'B'),['기록된 질문 1','현재 답변 기록 없음 1','현재 설명 1','설명 보류 1']);
  assert.deepEqual(facts(s,'S'),['기록된 질문 1','이전 기준 설명 1']);
  assert.deepEqual(facts(s,'T'),['기록된 질문 1']);
  assert.deepEqual(facts(s,'R'),['기록된 질문 1','현재 답변 기록 없음 1']);
});

test('MAP34 the total is the existing subtree total; answered, test-answered and older-basis questions stay in it', () => {
  const s=received();
  for(const k of Object.keys(s.ids)){
    const qs=subtreeSignals(s.p,s.ids[k]).flatMap(x=>x.questions),total=facts(s,k)[0];
    if(qs.length||facts(s,k).length)assert.equal(total,`기록된 질문 ${qs.length}`,k);
  }
  const [a,t,st]=['A','T','S'].map(k=>subtreeSignals(s.p,s.ids[k])[0].questions[0]);
  assert.deepEqual([a.applicability,a.answered],['answered',true]);
  assert.deepEqual([t.applicability,t.answered,t.status],['answered',true,'시험 답변 기록 · 실제 답변 아님']);
  assert.deepEqual([st.applicability,st.answered],['stale',false]);
  // R's current question is outside P: the B→R relation does not widen P's owned set.
  assert.ok(!subtreeSignals(s.p,s.ids.P).some(x=>x.areaId===s.ids.R));
});

test('MAP34 a leaf never counts this-tab updates; reading facts writes nothing', () => {
  const s=received(),before=JSON.stringify(s.p);
  assert.deepEqual(facts(s,'B',false),facts(s,'B',false).filter(f=>!f.startsWith('이번 탭')));
  assert.ok(facts(s,'P').includes('이번 탭 설명 갱신 2'));
  assert.deepEqual(recordFacts(s.p,s.ids.P,new Set(),true),['기록된 질문 4','현재 답변 기록 없음 1','현재 설명 3','설명 보류 1','이전 기준 설명 1']);
  assert.equal(JSON.stringify(s.p),before);
});

test('MAP34 without the later plan change S keeps a current description; nothing recorded gives no line', () => {
  const s=received({stale:false});
  assert.deepEqual(facts(s,'P'),['기록된 질문 4','현재 답변 기록 없음 1','현재 설명 4','이번 탭 설명 갱신 2','설명 보류 1']);
  assert.deepEqual(facts(s,'S'),['기록된 질문 1','현재 설명 1']);
  let p=D.addArea(D.createProject(),'빈 부분');assert.deepEqual(recordFacts(p,p.space.areas[0].id,new Set(),false),[]);
});
