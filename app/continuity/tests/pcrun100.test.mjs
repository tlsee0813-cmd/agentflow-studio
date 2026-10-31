// The third run on a real PC (after #102) refused both readings whole once more, each for one item of an otherwise sound reply:
//   1. the map: one claim's condition (aboutAt) was a passage of another record than its own quote;
//   3. the reading of a returned report: 13 new parts where 12 are read, the report's match to its request inside it.
// Four runs in a row, a different rule each time. map.7 now sets such an item aside (the refusal it would have been, kept for the
// screen to count), reads the rest, and refuses the whole reply only for its own shape, a contradiction, a key-like word, or when
// nothing is left. map.1–6 are as they were.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as C from '../dist/public/shared/change-plan.js';
import * as S from '../dist/public/shared/storage.js';
import * as K from './condition116-case.mjs';
import { parseProject } from '../dist/public/shared/validation.js';
import { studioView } from '../dist/public/shared/studio.js';
import { emptyBundle } from '../dist/public/client/plan-store.js';
import { corpus } from './contract137-corpus.mjs';

const mods = { D, M, C, S, studioView, emptyBundle, parseProject };
const lawful = () => { const x = corpus(mods).find(c => c.name === '7:lawful'); return { ask: x.ask, reply: structuredClone(x.reply), al: K.aliases(x.ask, M.askRecords(x.ask)) }; };
const said = r => M.setAside(r).map(e => [e.path, e.rule, e.target]);

test('PCRUN100-1 a claim whose condition comes from another record is set aside; every other item stands', () => {
  const { ask, reply, al } = lawful(), whole = M.validateMapReply(structuredClone(reply), ask);
  reply.parts[1].claims[1].aboutAt = K.piece(ask, al.code, 'export function');
  const got = M.validateMapReply(reply, ask);
  assert.deepEqual(said(got), [['parts[1].claims[1].aboutAt', 'condition-source', al.code]]);
  assert.deepEqual(got.parts[1].claims.map(c => c.key), whole.parts[1].claims.map(c => c.key).filter(k => k !== 's2'));
  assert.deepEqual([got.parts.length, got.relations.length, got.candidates.length, got.matches.length, got.material.length],
    [whole.parts.length, whole.relations.length, whole.candidates.length, whole.matches.length, whole.material.length]);
  assert.deepEqual(said(whole), [], 'a reply read whole sets nothing aside');
});

test('PCRUN100-2 new parts past 12 are set aside with what rests on them; the match to the request stands', () => {
  const { ask, reply, al } = lawful(), basis = reply.parts[0].basis;
  for (let i = 1; i <= 12; i++) reply.parts.push(K.part7(`new:extra${i}`, { name: `부분 ${i}`, parent: null, basis }));
  // The 13th new part (the last pushed), a part under it and a relation to it go; the rest of the reply is read.
  reply.parts.push(K.part7('new:under', { name: '아래', parent: 'new:extra12', basis }));
  reply.relations.push({ from: 'new:extra12', to: 'P01', kind: 'uses', note: '', at: basis[0] });
  const got = M.validateMapReply(reply, ask), refs = got.parts.map(p => p.ref);
  assert.equal(refs.filter(r => r.startsWith('new:')).length, 12);
  assert.ok(!refs.includes('new:extra12') && !refs.includes('new:under') && refs.includes('new:webp') && refs.includes('P01'), refs.join());
  assert.deepEqual(said(got).map(x => x.slice(1)), [['contract', 'new-count'], ['contract', 'new-count'], ['contract', 'ends']]);
  assert.ok(!got.relations.some(r => r.from === 'new:extra12'));
  assert.equal(got.matches.length, 4, 'the matches to the request are read');
  assert.ok(al.report);
});

test('PCRUN100-3 the whole reply is still refused for its shape, a contradiction, a key-like word, or nothing left', () => {
  const base = lawful(), refused = (change, rule) => {
    const { ask, reply } = lawful(); change(reply);
    assert.throws(() => M.validateMapReply(reply, ask), e => e.rule === rule, rule);
  };
  refused(r => { r.summary = 7; }, 'contract');
  refused(r => { r.parts = {}; }, 'contract');
  refused(r => { r.parts[1].claims[1].key = 's1'; }, 'duplicate-key');
  refused(r => { r.gaps = [`키 sk-${'A'.repeat(24)}`]; }, 'contract');
  // Every item set aside: the first one's refusal.
  const { ask, reply } = base;
  for (const p of reply.parts) p.claims = p.claims.map(c => ({ ...c, kind: 'nope' }));
  reply.parts[0].basis = ['N99.01']; reply.relations = []; reply.candidates = []; reply.matches = []; reply.material = [];
  assert.throws(() => M.validateMapReply(reply, ask), e => e.message === 'INVALID_RESPONSE' && e.path.startsWith('parts['));
});
