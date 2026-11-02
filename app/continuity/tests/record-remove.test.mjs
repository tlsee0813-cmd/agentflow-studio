// A pasted record can be taken out again while nothing of the map rests on it; a second copy of the same text is the same record.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import { parseProject } from '../dist/public/shared/validation.js';
import { serializeProject } from '../dist/public/shared/storage.js';
import { studioView } from '../dist/public/shared/studio.js';

const TEXT = '입력기는 프로젝트 문서를 받아 작업 큐에 전달합니다.\n원문 기록은 변경 없이 보존합니다.';

test('the same record pasted again with other line endings, trailing blanks or a final newline is the same record', () => {
  const first = D.pasteRecord(D.createProject(), TEXT, null);
  assert.equal(first.duplicate, false);
  for (const again of [TEXT, `${TEXT}\n`, TEXT.replace(/\n/g, '\r\n'), `  ${TEXT}  `]) {
    const r = D.pasteRecord(first.project, again, null);
    assert.equal(r.duplicate, true, JSON.stringify(again));
    assert.equal(r.record.id, first.record.id);
    assert.equal(r.project.pasted.length, 1);
  }
  // White space inside the text (a trailing blank on a line, a tab) is another record, never merged; so are different words.
  for (const inner of [TEXT.replace('전달합니다.', '전달합니다.   '), TEXT.replace('\n', '\n\t')]) assert.equal(D.pasteRecord(first.project, inner, null).duplicate, false);
  const other = D.pasteRecord(first.project, `${TEXT}\n추가 조건: 개발 판본만.`, null);
  assert.equal(other.duplicate, false); assert.equal(other.project.pasted.length, 2);
  assert.equal(other.project.pasted[0].text, TEXT);
});

test('an unread record is removed with its own id only; the project stays valid and nothing else changes', () => {
  let p = D.pasteRecord(D.createProject(), TEXT, null).project;
  const second = D.pasteRecord(p, '정정: 앞 설명을 철회합니다.', null); p = second.project;
  const before = structuredClone(p);
  const next = D.removePastedRecord(p, second.record.id);
  assert.deepEqual(next.pasted.map(r => r.id), [before.pasted[0].id]);
  assert.equal(next.revision, before.revision + 1);
  assert.deepEqual(p, before, 'the project given is untouched');
  parseProject(serializeProject(next));
  assert.throws(() => D.removePastedRecord(next, second.record.id), /RECORD_MISSING/);
  assert.throws(() => D.removePastedRecord(next, 'N_nothing'), /RECORD_MISSING/);
});

test('a record a map reading has read stays: the reading quotes it', () => {
  let p = D.pasteRecord(D.createProject(), TEXT, null).project;
  const input = M.buildMapAsk(p, studioView(p), [], undefined, M.MAP6_SCHEMA);
  assert.equal(input.problem, null);
  const ask = input.ask, alias = ask.records[0].spans[0].s;
  const reply = M.validateMapReply({ summary: '입력 책임을 읽었습니다.', relations: [], candidates: [], gaps: [], matches: [], material: [],
    parts: [{ ref: 'new:input', name: '입력기', parent: null, role: '문서를 받아 작업 큐에 전달한다', roleAbout: null, roleReplaces: null, basis: [alias],
      claims: [{ kind: 'describes', text: '문서를 작업 큐에 전달합니다.', at: alias, about: null, replaces: null, key: 's1' }] }] }, ask);
  const applied = M.applyReading(p, input, reply, { id: `R_${crypto.randomUUID()}`, at: new Date().toISOString(), model: 'stub', prompt: 'm6-000000000001', hash: '7'.repeat(64) });
  p = applied.project;
  const id = p.pasted[0].id;
  assert.equal(D.recordReadIntoMap(p, id), true);
  assert.throws(() => D.removePastedRecord(p, id), /RECORD_READ/);
  // A record added after that reading is still free to go.
  const extra = D.pasteRecord(p, '다른 기록입니다.', null);
  assert.equal(D.recordReadIntoMap(extra.project, extra.record.id), false);
  parseProject(serializeProject(D.removePastedRecord(extra.project, extra.record.id)));
});
