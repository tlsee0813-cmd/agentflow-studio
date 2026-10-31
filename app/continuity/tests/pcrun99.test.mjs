// The second run on a real PC (after #99) refused both readings whole again, each for one small fault in an otherwise sound reply:
//   1. the map: one claim carried a misspelled extra key ("aboutAtAt") beside the right one;
//   2. the reading of a returned report: three quotes ran 757–781 letters, past the 600-letter bound, all on one part.
// And the handover still showed a scratch folder under the person's profile, quoted from an answer.
// (A quote cut short is checked in pcrun98.test.mjs PCRUN98-3; this file checks map.7 and the handover.)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as C from '../dist/public/shared/change-plan.js';
import * as S from '../dist/public/shared/storage.js';
import { parseProject } from '../dist/public/shared/validation.js';
import { studioView } from '../dist/public/shared/studio.js';
import { emptyBundle } from '../dist/public/client/plan-store.js';
import { sessionText } from '../dist/public/shared/session-import.js';
import { handoverText } from '../dist/public/shared/handover.js';
import { corpus, outcome } from './contract137-corpus.mjs';

const mods = { D, M, C, S, studioView, emptyBundle, parseProject };

test('PCRUN99-1 map.7: a key not asked for is passed over and not kept; a key asked for and missing is still refused', () => {
  const lawful = corpus(mods).find(x => x.name === '7:lawful'), want = outcome(M.validateMapReply, lawful);
  assert.ok(want.ok);
  const stray = structuredClone(lawful.reply);
  stray.parts[1].claims[0].aboutAtAt = stray.parts[1].claims[0].aboutAt; stray.parts[1].EXTRA = 'SECRET_MARKER_99'; stray.EXTRA = 1;
  const got = outcome(M.validateMapReply, { ...lawful, reply: stray });
  assert.ok(got.ok, JSON.stringify(got)); assert.deepEqual(got.value, want.value);
  assert.ok(!JSON.stringify(got.value).includes('SECRET_MARKER_99') && !JSON.stringify(got.value).includes('aboutAtAt'));
  const missing = structuredClone(lawful.reply); delete missing.parts[1].claims[0].replaces;
  const no = outcome(M.validateMapReply, { ...lawful, reply: missing });
  assert.deepEqual([no.path, no.rule, no.target], ['parts[1].claims[0]', 'contract', 'keys']);
});

test('PCRUN99-2 the handover says a path outside the working folders as such, and keeps one inside them', () => {
  const at = '2026-10-31T06:00:00.000Z', cwd = 'C:\\work\\agentflow-studio';
  const said = '분석 스크립트는 제 임시 폴더 `C:\\Users\\이준혁\\AppData\\Local\\Temp\\claude\\scratchpad\\probe.mjs`에 있어요. 고친 파일은 C:\\work\\agentflow-studio\\app\\x.ts 예요.';
  const p = D.pasteRecord(D.createProject(), sessionText({ id: 'claude-0123456789abcdef01234567', tool: 'claude', label: '', title: null, cwd, branch: 'main', startedAt: at, omitted: 0,
    turns: [{ role: 'user', at, text: '확인해 줘' }, { role: 'assistant', at, text: said }] }).text, null).project;
  const doc = handoverText(p, { scope: null, code: 'PCR299', at });
  const line = doc.split('\n').find(l => l.startsWith('  - 답변: '));
  assert.ok(line.includes('`(작업 폴더 밖 경로)`') && !doc.includes('AppData') && line.includes('C:\\work\\agentflow-studio\\app\\x.ts'), line);
  // A web address is not a path.
  const web = D.pasteRecord(D.createProject(), sessionText({ id: 'claude-0123456789abcdef01234568', tool: 'claude', label: '', title: null, cwd, branch: 'main', startedAt: at, omitted: 0,
    turns: [{ role: 'user', at, text: '켜 줘' }, { role: 'assistant', at, text: 'http://127.0.0.1:4317/home/x 에서 켰어요.' }] }).text, null).project;
  assert.ok(handoverText(web, { scope: null, code: 'PCR299', at }).includes('http://127.0.0.1:4317/home/x'));
});
