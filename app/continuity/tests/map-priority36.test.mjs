import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import {readingReasons,subtreeSignals} from '../dist/public/shared/attention.js';
import {map34Fixture} from './map-signals34-fixtures.mjs';

// The two results received later in the open tab, through the same import the file chooser uses.
function received(options) {
  const s=map34Fixture(options);let p=s.p;for(const k of ['B','P'])p=D.importResultFile(p,JSON.stringify(s.late[k]));
  return {...s,p,tab:new Set([s.ids.B,s.ids.P])};
}
const why=(s,k)=>readingReasons(s.p,s.ids[k],s.tab);

test('MAP36 reasons are presence only, in a fixed order, for the owned set', () => {
  const s=received();
  assert.deepEqual(why(s,'P'),{reasons:['open-question','held','stale','updated'],records:true});
  assert.deepEqual(why(s,'A'),{reasons:[],records:true});
  assert.deepEqual(why(s,'B'),{reasons:['open-question','held','updated'],records:true});
  assert.deepEqual(why(s,'S'),{reasons:['stale'],records:true});
  assert.deepEqual(why(s,'T'),{reasons:[],records:true});
  assert.deepEqual(why(s,'R'),{reasons:['open-question'],records:true});
});

test('MAP36 only an active question without a recorded reply is a current one; relations never widen a parent', () => {
  const s=received(),q=k=>subtreeSignals(s.p,s.ids[k])[0].questions[0];
  assert.deepEqual([q('A').applicability,q('A').answered],['answered',true]);
  assert.deepEqual([q('T').applicability,q('T').answered],['answered',true]);
  assert.deepEqual([q('S').applicability,q('S').answered],['stale',false]);
  assert.ok(!why(s,'S').reasons.includes('open-question')&&!why(s,'T').reasons.includes('open-question'));
  // B→R is only a relation: R's current question stays out of P, P's own current question count comes from B alone.
  assert.ok(!subtreeSignals(s.p,s.ids.P).some(x=>x.areaId===s.ids.R));
  const withoutB=new Set(subtreeSignals(s.p,s.ids.P).filter(x=>x.areaId!==s.ids.B).flatMap(x=>x.questions).map(x=>x.applicability));
  assert.ok(!withoutB.has('active'));
});

test('MAP36 a this-tab update is only an arrival in this tab; older-basis means a description; reading writes nothing', () => {
  const s=received(),before=JSON.stringify(s.p);
  assert.deepEqual(readingReasons(s.p,s.ids.B,new Set()).reasons,['open-question','held']);
  assert.deepEqual(readingReasons(s.p,s.ids.P,new Set([s.ids.A])).reasons,['open-question','held','stale','updated']);
  assert.deepEqual(readingReasons(s.p,s.ids.A,new Set([s.ids.B])).reasons,[]);
  assert.equal(JSON.stringify(s.p),before);
  const n=received({stale:false});
  assert.deepEqual(readingReasons(n.p,n.ids.S,n.tab),{reasons:[],records:true});
  assert.deepEqual(readingReasons(n.p,n.ids.P,n.tab).reasons,['open-question','held','updated']);
  const e=D.addArea(D.createProject(),'빈 부분');assert.deepEqual(readingReasons(e,e.space.areas[0].id,new Set()),{reasons:[],records:false});
});
