// Handover documents: made from the map and the session records only, scoped to the project or one part, and folded back to one
// line when a new session that started from one is taken in (so that session is known to have taken the work over).
// Written replies (no AI call): contract and storage evidence, not AI quality or browser evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import { studioView } from '../dist/public/shared/studio.js';
import { sessionText } from '../dist/public/shared/session-import.js';
import { handoverText, handoverCode, foldHandover, receivedHandovers, sessionOrigin, partSessions } from '../dist/public/shared/handover.js';

const ID = 'claude-0123456789abcdef01234567', NEXT = 'codex-89abcdef0123456789abcdef';
const session = (id, turns, extra = {}) => ({ id, tool: id.startsWith('codex') ? 'codex' : 'claude', label: '', title: '휴무일 연결', cwd: '/work/salon', branch: 'main', startedAt: '2026-10-28T09:00:00.000Z', turns, omitted: 0, ...extra });
const TURNS = [
  { role: 'user', at: '2026-10-28T09:00:00.000Z', text: '예약 화면에서 휴무일을 영업시간 설정과 연결해 줘' },
  { role: 'assistant', at: '2026-10-28T09:05:00.000Z', text: '휴무일이면 예약 버튼을 막았어요.', files: ['src/hours.ts', 'tests/hours.test.ts'] }
];
let n = 0;
const meta = () => ({ id: `R_h_${++n}`, at: new Date().toISOString(), model: 'stub', prompt: 'm-000000000000', hash: String(n).padStart(64, 'd') });

function mapped() {
  let p = D.pasteRecord(D.createProject(), sessionText(session(ID, TURNS)).text, null).project;
  const inp = M.buildMapAsk(p, studioView(p)), rec = inp.ask.records[0].id;
  const q1 = '예약 화면에서 휴무일을 영업시간 설정과 연결해 줘', q2 = '휴무일이면 예약 버튼을 막았어요.';
  const reply = { summary: '미용실 예약 프로그램이에요.', relations: [{ from: 'new:p0', to: 'new:p1', kind: 'needs', note: '휴무일', record: rec, quote: q1 }], candidates: [], gaps: ['결제 방식은 기록에 없어요.'],
    parts: [
      { ref: 'new:p0', name: '예약 화면', parent: null, role: '손님이 시간을 골라 예약해요.', roleAbout: null, roleReplaces: null, basis: [{ record: rec, quote: q1 }],
        claims: [{ kind: 'want', text: '휴무일과 영업시간 연결', record: rec, quote: q1, about: null, replaces: null }, { kind: 'reported', text: '휴무일 예약 막음', record: rec, quote: q2, about: null, replaces: null }] },
      { ref: 'new:p1', name: '영업시간 설정', parent: null, role: '가게가 여는 시간을 정해요.', roleAbout: null, roleReplaces: null, basis: [{ record: rec, quote: q1 }], claims: [] }
    ] };
  p = M.applyReading(p, inp, M.validateMapReply(reply, inp.ask), meta()).project;
  return { p, booking: p.space.areas.find(a => a.name === '예약 화면').id, hours: p.space.areas.find(a => a.name === '영업시간 설정').id };
}

test('HANDOVER-W1 whole project: rules, summary, each part with its claims and relations, sessions, open things, recent requests', () => {
  const { p } = mapped(), code = handoverCode();
  assert.match(code, /^[A-Z2-9]{6}$/);
  const t = handoverText(p, { scope: null, code, at: '2026-10-30T05:00:00.000Z' });
  assert.ok(t.startsWith(`──────── AgentFlow 인수인계 문서 · af-handover:${code} ────────\n# 인수인계: `), t.slice(0, 120));
  assert.ok(t.endsWith(`──────── 인수인계 문서 끝 · af-handover:${code} ────────`));
  for (const s of ['## 이어받는 방법', '혼자 정하지 말고 사용자에게', '## 프로젝트 한눈에\n미용실 예약 프로그램이에요.', '### 예약 화면', '역할: 손님이 시간을 골라 예약해요.',
    '- 원함: 휴무일과 영업시간 연결', '- 작업 보고: 휴무일 예약 막음', '관련: → 영업시간 설정 (필요로 함 · 휴무일)', '다룬 세션: Claude Code 「휴무일 연결」',
    '- Claude Code 「휴무일 연결」 · 작업 폴더 /work/salon · 브랜치 main', '- 기록에서 알 수 없었음: 결제 방식은 기록에 없어요.',
    '- 예약 화면에서 휴무일을 영업시간 설정과 연결해 줘 → 바꾼 파일: src/hours.ts, tests/hours.test.ts'])
    assert.ok(t.includes(s), `missing: ${s}\n${t}`);
});

test('HANDOVER-S1 one part: its path in the title, its scope rule, only it and what is inside it', () => {
  const { p, hours } = mapped();
  const t = handoverText(p, { scope: hours, code: 'ABC234', at: '2026-10-30T05:00:00.000Z' });
  assert.ok(t.startsWith(`──────── AgentFlow 인수인계 문서 · af-handover:ABC234:${hours} ────────\n# 인수인계: 나의 프로젝트 › 영업시간 설정\n`), t.slice(0, 200));
  assert.ok(t.includes('범위는 "영업시간 설정"'));
  assert.ok(t.includes('### 영업시간 설정') && !t.includes('### 예약 화면'));
  assert.ok(t.includes('관련: ← 예약 화면 (필요로 함'));
  assert.throws(() => handoverText(p, { scope: 'A_missing', code: 'ABC234', at: '2026-10-30T05:00:00.000Z' }), /HANDOVER_SCOPE/);
});

test('HANDOVER-F1 a new session that starts from the document: the document folds to one line, its own words stay, the part knows it', () => {
  const { p, booking } = mapped();
  const doc = handoverText(p, { scope: booking, code: 'QW3RTY', at: '2026-10-30T05:00:00.000Z' });
  const prompt = `이거 읽고 이어서 해 줘\n\n${doc}\n\n먼저 테스트부터 돌려 줘`;
  const folded = foldHandover(prompt);
  assert.equal(folded, `이거 읽고 이어서 해 줘\n\n[AgentFlow 인수인계 문서를 받아 이어감 · af-handover:QW3RTY:${booking} · 나의 프로젝트 › 예약 화면]\n\n먼저 테스트부터 돌려 줘`);
  assert.deepEqual(receivedHandovers(folded), [{ code: 'QW3RTY', areaId: booking }]);
  // The document without its end line (cut when pasted) still folds, to the end of the message.
  assert.ok(!foldHandover(doc.split('\n').slice(0, -1).join('\n')).includes('## 이어받는 방법'));
  // Taken in through the session import: the record is short, names the session, and the part lists it as having taken over.
  const next = sessionText(session(NEXT, [{ role: 'user', at: '2026-10-30T06:00:00.000Z', text: prompt }, { role: 'assistant', at: '2026-10-30T06:01:00.000Z', text: '테스트를 돌렸어요.' }], { title: null })).text;
  assert.ok(!next.includes('## 이어받는 방법') && next.includes('af-handover:QW3RTY'));
  assert.deepEqual(sessionOrigin(next), { id: NEXT, tool: 'codex', title: null, cwd: '/work/salon', branch: 'main' });
  const q = D.pasteRecord(p, next, null).project;
  const s = partSessions(q, booking);
  assert.deepEqual(s.map(x => [x.id, x.worked, x.tookOver]), [[NEXT, false, true], [ID, true, false]]);
  assert.deepEqual(partSessions(q, null).map(x => x.id).sort(), [ID, NEXT].sort());
  assert.ok(handoverText(q, { scope: booking, code: 'ZXC234', at: '2026-10-30T07:00:00.000Z' }).includes('Codex 세션 (인수인계로 이어받음)'));
});

test('HANDOVER-O1 session origin: header fields read back; other records are not sessions', () => {
  const text = sessionText(session(ID, TURNS, { title: '휴무일 · 연결' })).text;
  assert.deepEqual(sessionOrigin(text), { id: ID, tool: 'claude', title: '휴무일 · 연결', cwd: '/work/salon', branch: 'main' });
  assert.equal(sessionOrigin('요구: 예약 화면'), null);
  // An empty project still gets a usable document.
  const t = handoverText(D.createProject(), { scope: null, code: 'EMPTY2', at: '2026-10-30T05:00:00.000Z' });
  assert.ok(t.includes('아직 지도에 부분이 없어요.'));
});
