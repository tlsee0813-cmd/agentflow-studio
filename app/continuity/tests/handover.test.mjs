// Handover documents: made from the map and the session records only, scoped to the project or one part, and folded back to one
// line when a new session that started from one is taken in (so that session is known to have taken the work over).
// Written replies (no AI call): contract and storage evidence, not AI quality or browser evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import { studioView } from '../dist/public/shared/studio.js';
import { sessionText, sessionChunks, newTurns } from '../dist/public/shared/session-import.js';
import { handoverText, handoverDoc, handoverCode, foldHandover, foldRecord, receivedHandovers, sessionOrigin, partSessions, HANDOVER_CHARS } from '../dist/public/shared/handover.js';

const ID = 'claude-0123456789abcdef01234567', NEXT = 'codex-89abcdef0123456789abcdef';
const session = (id, turns, extra = {}) => ({ id, tool: id.startsWith('codex') ? 'codex' : 'claude', label: '', title: '휴무일 연결', cwd: '/work/salon', branch: 'main', startedAt: '2026-10-28T09:00:00.000Z', turns, omitted: 0, ...extra });
const TURNS = [
  { role: 'user', at: '2026-10-28T09:00:00.000Z', text: '예약 화면에서 휴무일을 영업시간 설정과 연결해 줘' },
  { role: 'assistant', at: '2026-10-28T09:05:00.000Z', text: '휴무일이면 예약 버튼을 막았어요.', files: ['src/hours.ts', 'tests/hours.test.ts'] }
];
let n = 0;
const meta = () => ({ id: `R_h_${++n}`, at: new Date().toISOString(), model: 'stub', prompt: 'm-000000000000', hash: String(n).padStart(64, 'd') });

/** The two-part map the tests share; candidates (their text and parts) are left open by the reading if given. */
function mapped(candidates = []) {
  let p = D.pasteRecord(D.createProject(), sessionText(session(ID, TURNS)).text, null).project;
  const inp = M.buildMapAsk(p, studioView(p)), rec = inp.ask.records[0].id;
  const q1 = '예약 화면에서 휴무일을 영업시간 설정과 연결해 줘', q2 = '휴무일이면 예약 버튼을 막았어요.';
  const reply = { summary: '미용실 예약 프로그램이에요.', relations: [{ from: 'new:p0', to: 'new:p1', kind: 'needs', note: '휴무일', record: rec, quote: q1 }],
    candidates: candidates.map(([text, parts]) => ({ text, parts, record: rec, quote: q1 })), gaps: ['결제 방식은 기록에 없어요.'],
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
  for (const s of ['## 이어받는 방법\n- 이 문서 앞이나 뒤에 사용자가 할 일을 적었다면 그것이 첫 할 일이에요.', '"구상"은 아직 하기로 정하지 않은 생각', '혼자 정하지 말고 사용자에게', '## 프로젝트 한눈에\n미용실 예약 프로그램이에요.', '### 예약 화면\n- 역할: 손님이 시간을 골라 예약해요.',
    '- 원함: 휴무일과 영업시간 연결', '- 작업 보고: 휴무일 예약 막음', '- 관련: 영업시간 설정 (이 부분이 필요로 함 · 휴무일)', '- 다룬 세션: Claude Code 「휴무일 연결」',
    '\n- Claude Code 「휴무일 연결」 · 작업 폴더 /work/salon · 브랜치 main\n', '- 기록에서 알 수 없었음: 결제 방식은 기록에 없어요.',
    '- 예약 화면에서 휴무일을 영업시간 설정과 연결해 줘 → 바꾼 파일: src/hours.ts, tests/hours.test.ts'])
    assert.ok(t.includes(s), `missing: ${s}\n${t}`);
  // A part is one list under its heading, so a Markdown viewer keeps its lines apart.
  const part = t.slice(t.indexOf('### 예약 화면\n')).split('\n\n')[0].split('\n').slice(1);
  assert.ok(part.length === 5 && part.every(l => l.startsWith('- ')), part.join('\n'));
});

test('HANDOVER-S1 one part: its path in the title, its scope rule, only it and what is inside it', () => {
  const { p, hours } = mapped();
  const t = handoverText(p, { scope: hours, code: 'ABC234', at: '2026-10-30T05:00:00.000Z' });
  assert.ok(t.startsWith(`──────── AgentFlow 인수인계 문서 · af-handover:ABC234:${hours} ────────\n# 인수인계: 나의 프로젝트 › 영업시간 설정\n`), t.slice(0, 200));
  assert.ok(t.includes('\n- 이 인수인계의 범위는 "영업시간 설정" 부분이에요. 범위 밖 부분을 바꿔야 하면 먼저 사용자에게 확인하세요.\n'), t);
  // A name that ends in a vowel reads as well: the sentence ends on a fixed word, not on a particle after the name.
  const pay = D.addArea(D.createProject(), '결제'), u = handoverText(pay, { scope: pay.space.areas[0].id, code: 'ABC234', at: '2026-10-30T05:00:00.000Z' });
  assert.ok(u.includes('범위는 "결제" 부분이에요.') && !u.includes('"결제"이에요'), u);
  assert.ok(t.includes('### 영업시간 설정') && !t.includes('### 예약 화면'));
  assert.ok(t.includes('- 관련: 예약 화면 (이 부분을 필요로 함 · 휴무일)'), t);
  assert.throws(() => handoverText(p, { scope: 'A_missing', code: 'ABC234', at: '2026-10-30T05:00:00.000Z' }), /HANDOVER_SCOPE/);
});

test('HANDOVER-F1 a new session that starts from the document: the document folds to one line, its own words stay, the part knows it', () => {
  const { p, booking } = mapped();
  const doc = handoverText(p, { scope: booking, code: 'QW3RTY', at: '2026-10-30T05:00:00.000Z' });
  const prompt = `이거 읽고 이어서 해 줘\n\n${doc}\n\n먼저 테스트부터 돌려 줘`;
  const folded = foldHandover(prompt);
  assert.equal(folded, `이거 읽고 이어서 해 줘\n\n[AgentFlow 인수인계 문서를 받아 이어감 · af-handover:QW3RTY:${booking} · 나의 프로젝트 › 예약 화면]\n\n먼저 테스트부터 돌려 줘`);
  assert.deepEqual(receivedHandovers(`[Codex 세션 기록]\n\n── 사용자 요청 ──\n${folded}`), [{ code: 'QW3RTY', areaId: booking }]);
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
  // The part's next document shows what that session did, though no reading has quoted it yet: the request it started with, and
  // those of a later record of it, which does not repeat the marker.
  const later = sessionText(session(NEXT, [{ role: 'user', at: '2026-10-30T06:10:00.000Z', text: '실패한 테스트 고쳐 줘' }, { role: 'assistant', at: '2026-10-30T06:20:00.000Z', text: '고쳤어요.', files: ['src/booking.ts'] }], { title: null })).text;
  const again = handoverText(D.pasteRecord(q, later, null).project, { scope: booking, code: 'ZXC234', at: '2026-10-30T07:00:00.000Z' });
  for (const s of ['\n- 이거 읽고 이어서 해 줘 (인수인계 문서로 시작 · 나의 프로젝트 › 예약 화면) 먼저 테스트부터 돌려 줘\n', '\n- 실패한 테스트 고쳐 줘 → 바꾼 파일: src/booking.ts\n'])
    assert.ok(again.includes(s), `missing: ${s}\n${again}`);
  // Its part reads as the map last saw it, and the document says the map is behind and where those records are.
  assert.match(again, /\n## 이 범위의 현재 상태\n\(지도는 \d{4}-\d\d-\d\d \d\d:\d\d에 읽은 기록까지예요\. 아직 지도에 담기지 않은 기록이 2개 있어요\. 그 기록의 요청과 바꾼 파일은 아래 최근 흐름에 있어요\.\)\n\n### 예약 화면\n/);
  assert.ok(!handoverText(p, { scope: booking, code: 'ZXC234', at: '2026-10-30T07:00:00.000Z' }).includes('지도에 담기지 않은'), 'all read: no note');
});

test('HANDOVER-O1 session origin: header fields read back; other records are not sessions', () => {
  const text = sessionText(session(ID, TURNS, { title: '휴무일 · 연결' })).text;
  assert.deepEqual(sessionOrigin(text), { id: ID, tool: 'claude', title: '휴무일 · 연결', cwd: '/work/salon', branch: 'main' });
  assert.equal(sessionOrigin('요구: 예약 화면'), null);
  // An empty project still gets a usable document, which points to nothing that is not in it.
  const t = handoverText(D.createProject(), { scope: null, code: 'EMPTY2', at: '2026-10-30T05:00:00.000Z' });
  assert.ok(t.includes('\n아직 지도에 부분이 없어요. 사용자의 설명에서 시작하세요.\n\n') && !t.includes('최근 흐름'), t);
});

test('HANDOVER-B1 a web chat writes its own record from the request text: the record reads as that session and its requests', async () => {
  const { WEB_RECORD_ASK } = await import('../dist/public/shared/handover.js');
  assert.ok(WEB_RECORD_ASK.includes('[웹 AI 세션 기록 · ') && WEB_RECORD_ASK.includes('── 사용자 요청 ──'));
  const answer = '[웹 AI 세션 기록 · 결제 연결 · 브랜치 pay]\n\n── 사용자 요청 ──\n결제 버튼을 붙여 줘\n\n── 웹 AI 답변 ──\n결제 버튼을 붙였어요.\n(바꾼 파일: src/pay.ts)';
  assert.deepEqual(sessionOrigin(answer), { id: null, tool: 'web', title: '결제 연결', cwd: null, branch: 'pay' });
  const p = D.pasteRecord(D.createProject(), answer, null).project;
  const t = handoverText(p, { scope: null, code: 'WEB234', at: '2026-10-30T05:00:00.000Z' });
  assert.ok(t.includes('\n- 웹 AI 「결제 연결」 · 브랜치 pay\n') && t.includes('- 결제 버튼을 붙여 줘 → 바꾼 파일: src/pay.ts'), t);
  // A chat that changed nothing may still write the files line, with nothing in it: no file is named 없음.
  const talk = '[웹 AI 세션 기록 · 결제 방식 고민]\n\n── 사용자 요청 ──\n현장 결제랑 선결제 중에 뭐가 나을까?\n\n── 웹 AI 답변 ──\n노쇼가 많으면 선결제가 나아요.\n(바꾼 파일: 없음)';
  const u = handoverText(D.pasteRecord(p, talk, null).project, { scope: null, code: 'WEB234', at: '2026-10-30T05:00:00.000Z' });
  assert.ok(u.includes('\n- 현장 결제랑 선결제 중에 뭐가 나을까?\n') && !u.includes('파일: 없음') && !/바뀐 파일: .*없음/.test(u), u);
  // Asked to write a handover document it was given as its first and end line only, the chat's record still names that handover.
  assert.ok(WEB_RECORD_ASK.includes('af-handover가 적힌 첫 줄과 끝 줄만') && WEB_RECORD_ASK.includes('이 기록 요청은 넣지 마'));
  const lines = t.split('\n'), short = `[웹 AI 세션 기록 · 이어받기]\n\n── 사용자 요청 ──\n${lines[0]}\n${lines.at(-1)}\n\n이어서 해 줘\n\n── 웹 AI 답변 ──\n이어서 했어요.`;
  assert.equal(foldRecord(short), '[웹 AI 세션 기록 · 이어받기]\n\n── 사용자 요청 ──\n[AgentFlow 인수인계 문서를 받아 이어감 · af-handover:WEB234]\n\n이어서 해 줘\n\n── 웹 AI 답변 ──\n이어서 했어요.');
  assert.deepEqual(receivedHandovers(short), [{ code: 'WEB234', areaId: null }]);
});

test('HANDOVER-B2 a web record pasted back keeps a handover document its request started from as one line, as the import does', () => {
  const { p, booking } = mapped();
  const doc = handoverText(p, { scope: booking, code: 'QW3RTY', at: '2026-10-30T05:00:00.000Z' });
  const line = `[AgentFlow 인수인계 문서를 받아 이어감 · af-handover:QW3RTY:${booking} · 나의 프로젝트 › 예약 화면]`;
  const web = `[웹 AI 세션 기록 · 결제 연결]\n\n── 사용자 요청 ──\n${doc}\n\n결제 버튼을 붙여 줘\n\n── 웹 AI 답변 ──\n문서의 ${doc.split('\n')[0]} 줄을 보고 이어서 붙였어요.\n(바꾼 파일: src/pay.ts)`;
  const kept = foldRecord(web);
  assert.equal(kept, `[웹 AI 세션 기록 · 결제 연결]\n\n── 사용자 요청 ──\n${line}\n\n결제 버튼을 붙여 줘\n\n── 웹 AI 답변 ──\n문서의 ${doc.split('\n')[0]} 줄을 보고 이어서 붙였어요.\n(바꾼 파일: src/pay.ts)`);
  assert.equal(foldRecord(kept), kept, 'folding again changes nothing');
  assert.deepEqual(receivedHandovers(kept), [{ code: 'QW3RTY', areaId: booking }]);
  // Copied without its end line, the document folds to the end of the request: the answer's head still starts its own line, so the
  // answer stays the AI's and its files stay its files.
  const cut = foldRecord(`[웹 AI 세션 기록 · 취소 마감]\n\n── 사용자 요청 ──\n${doc.split('\n').slice(0, -1).join('\n').trimEnd()}\n\n── 웹 AI 답변 ──\n고쳤어요.\n(바꾼 파일: src/cancel.ts)`);
  assert.equal(cut, `[웹 AI 세션 기록 · 취소 마감]\n\n── 사용자 요청 ──\n${line}\n\n── 웹 AI 답변 ──\n고쳤어요.\n(바꾼 파일: src/cancel.ts)`);
  assert.equal(foldRecord(cut), cut);
  assert.deepEqual(receivedHandovers(cut), [{ code: 'QW3RTY', areaId: booking }]);
  assert.ok(handoverText(D.pasteRecord(p, cut, null).project, { scope: null, code: 'CUT234', at: '2026-10-30T05:00:00.000Z' }).includes('\n- (인수인계 문서로 시작 · 나의 프로젝트 › 예약 화면) → 바꾼 파일: src/cancel.ts\n'));
  // Such a record an older page saved with the answer's head glued to the folded line is still read so, though it stays as stored.
  const glued = '[웹 AI 세션 기록 · 취소 마감]\n\n── 사용자 요청 ──\n[AgentFlow 인수인계 문서를 받아 이어감 · af-handover:QW3RTY · 나의 프로젝트]── 웹 AI 답변 ──\n고쳤어요.\n(바꾼 파일: src/cancel.ts)';
  const old = handoverText(D.pasteRecord(p, glued, null).project, { scope: null, code: 'CUT234', at: '2026-10-30T05:00:00.000Z' });
  assert.ok(old.includes('\n- (인수인계 문서로 시작 · 나의 프로젝트) → 바꾼 파일: src/cancel.ts\n') && !old.includes('웹 AI 답변') && foldRecord(glued) === glued, old);
  // Text that is not a session record (the document kept on its own, a note) stays as written.
  assert.equal(foldRecord(doc), doc);
  assert.equal(foldRecord(`메모\n${doc}`), `메모\n${doc}`);
});

const AT = '2026-10-30T05:00:00.000Z';
const ask = (id, text, reply = '네') => session(id, [{ role: 'user', at: '2026-10-30T06:00:00.000Z', text }, { role: 'assistant', at: '2026-10-30T06:01:00.000Z', text: reply }], { title: null });
/** A map reading whose parts quote the records holding these words (each part: a name, or the alias P01… of a part already on the
 * map, the words its basis quotes, and claims of it as [kind, the words they quote]), and relations between them as [from, to (parts
 * by place), kind, note, the words quoted]. */
function readAs(p, parts, relations = []) {
  const inp = M.buildMapAsk(p, studioView(p)), rec = q => inp.ask.records.find(r => (r.text ?? '').includes(q)).id;
  const reply = { summary: '시험 프로젝트예요.', relations: relations.map(([from, to, kind, note, q]) => ({ from: `new:p${from}`, to: `new:p${to}`, kind, note, record: rec(q), quote: q })), candidates: [], gaps: [],
    parts: parts.map(([name, quotes, claims = []], i, _, had = /^P\d\d$/.test(name)) => ({ ref: had ? name : `new:p${i}`, name: had ? null : name, parent: null, role: had ? null : `${name}을 맡아요.`, roleAbout: null, roleReplaces: null, basis: quotes.map(q => ({ record: rec(q), quote: q })),
      claims: claims.map(([kind, q]) => ({ kind, text: q, record: rec(q), quote: q, about: null, replaces: null })) })) };
  return M.applyReading(p, inp, M.validateMapReply(reply, inp.ask), meta()).project;
}

test('HANDOVER-O2 a title that starts like a header field or holds " · " stays the title: the fields are read back from the end', () => {
  for (const title of ['세션 만료 처리', '브랜치 정리하고 PR 만들기', '로그인 · 세션 유지 기능', '작업 폴더 정리', '2026-10-28 09:00 시작'])
    assert.deepEqual(sessionOrigin(sessionText(session(ID, TURNS, { title, cwd: 'C:\\work\\salon' })).text), { id: ID, tool: 'claude', title, cwd: 'C:\\work\\salon', branch: 'main' }, title);
  // Fields that are not known are not written: what is there is still read in its place.
  assert.deepEqual(sessionOrigin(sessionText(session(ID, TURNS, { title: '브랜치 정리하고 PR 만들기', branch: null, startedAt: null })).text), { id: ID, tool: 'claude', title: '브랜치 정리하고 PR 만들기', cwd: '/work/salon', branch: null });
  assert.deepEqual(sessionOrigin(sessionText(session(ID, TURNS, { title: '세션 만료 처리', cwd: null, branch: null, startedAt: null })).text), { id: ID, tool: 'claude', title: '세션 만료 처리', cwd: null, branch: null });
  assert.deepEqual(sessionOrigin('[웹 AI 세션 기록 · 세션 정리 · 브랜치 pay]'), { id: null, tool: 'web', title: '세션 정리', cwd: null, branch: 'pay' });
  // Two sessions of one folder, both titled '세션 …', stay two sessions.
  let p = D.createProject();
  for (const [id, title] of [[ID, '세션 만료 처리'], ['claude-89abcdef0123456789abcdef', '세션 저장 방식 바꾸기']]) p = D.pasteRecord(p, sessionText(session(id, TURNS, { title })).text, null).project;
  assert.deepEqual(partSessions(p, null).map(s => [s.id, s.title]).sort(), [[ID, '세션 만료 처리'], ['claude-89abcdef0123456789abcdef', '세션 저장 방식 바꾸기']]);
});

test('HANDOVER-R1 a takeover counts only where a request starts from it: an older one quoted by a later document or by an answer does not', () => {
  const { p, booking } = mapped(), X = 'claude-111111111111111111111111', Y = 'claude-222222222222222222222222';
  const old = handoverText(p, { scope: booking, code: 'OLD234', at: AT });
  const q = D.pasteRecord(p, sessionText(ask(X, `${old}\n\n예약 화면 이어서`)).text, null).project;
  // The later document names the earlier start in words, without its code.
  const doc = handoverText(q, { scope: null, code: 'NEW234', at: AT });
  assert.ok(!doc.includes('OLD234') && doc.includes('\n- (인수인계 문서로 시작 · 나의 프로젝트 › 예약 화면) 예약 화면 이어서\n'), doc);
  const NEW = [{ code: 'NEW234', areaId: null }], got = (text, reply) => receivedHandovers(sessionText(ask(Y, text, reply)).text);
  assert.deepEqual(got(`${doc}\n\n이어서 해 줘`), NEW);
  // Copied without its first line: folded from its title line, and still known by its end line.
  const noStart = sessionText(ask(Y, `${doc.split('\n').slice(1).join('\n')}\n\n이어서 해 줘`)).text;
  assert.ok(!noStart.includes('## 이어받는 방법') && noStart.includes('[AgentFlow 인수인계 문서를 받아 이어감 · af-handover:NEW234 · 나의 프로젝트]\n\n이어서 해 줘'), noStart);
  assert.deepEqual(receivedHandovers(noStart), NEW);
  // Written back by a web chat with the document unfolded in the request: the new one only.
  assert.deepEqual(receivedHandovers(`[웹 AI 세션 기록 · 웹 이어받기]\n\n── 사용자 요청 ──\n${doc}\n\n── 웹 AI 답변 ──\n이어서 했어요`), NEW);
  // A marker in an answer, or quoted inside a request (a document made before quotes were put in words), is not a takeover.
  const marker = `[AgentFlow 인수인계 문서를 받아 이어감 · af-handover:OLD234:${booking} · 나의 프로젝트 › 예약 화면]`;
  assert.deepEqual(got(`${doc}\n\n이어서`, `이해한 상태:\n${marker}`), NEW);
  assert.deepEqual(receivedHandovers(`[Claude Code 세션 기록]\n\n── 사용자 요청 ──\n## 최근 흐름\n- ${marker} 예약 화면 이어서`), []);
  assert.deepEqual(receivedHandovers(`[Claude Code 세션 기록]\n\n── Claude Code 답변 ──\n${marker}`), []);
  // A part's document names its part on its last line too, so copied without its first line it still names the part.
  const part = handoverText(p, { scope: booking, code: 'PRT234', at: AT });
  assert.ok(part.endsWith(`──────── 인수인계 문서 끝 · af-handover:PRT234:${booking} ────────`));
  assert.deepEqual(got(part.split('\n').slice(1).join('\n')), [{ code: 'PRT234', areaId: booking }]);
  const r = D.pasteRecord(q, noStart, null).project;
  assert.deepEqual(partSessions(r, booking).filter(s => s.tookOver).map(s => s.id), [X]);
  assert.deepEqual(partSessions(r, null).filter(s => s.tookOver).map(s => s.id), [Y]);
});

test('HANDOVER-L1 a document for a large map stays within HANDOVER_CHARS: parts are written briefly from the last one back, the rest named, and it says so', () => {
  const note = '손님이 예약 시간을 고르고 휴무일과 영업시간을 확인한 뒤 결제까지 마치는 흐름을 맡아요. '.repeat(5).trim();
  const big = n => { let p = D.createProject(); for (let i = 0; i < n; i++) p = D.addArea(p, `부분 ${i}`, note); return handoverDoc(p, { scope: null, code: 'BIG234', at: AT }); };
  const { p } = mapped();
  assert.equal(handoverDoc(p, { scope: null, code: 'SML234', at: AT }).trimmed, 0);
  assert.equal(handoverDoc(p, { scope: null, code: 'SML234', at: AT }).text, handoverText(p, { scope: null, code: 'SML234', at: AT }));
  // Somewhat over: the first parts in full, the later ones briefly, every part still there.
  const mid = big(60), lines = mid.text.split('\n');
  assert.ok(mid.text.length <= HANDOVER_CHARS && mid.trimmed > 0 && mid.trimmed < 60, `${mid.text.length} ${mid.trimmed}`);
  assert.ok(lines.includes(`(문서가 길어서 부분 ${mid.trimmed}개는 줄여 적었어요. 어느 부분을 더 알아야 하면, 그 부분만 담은 인수인계 문서를 사용자에게 따로 부탁하세요.)`));
  assert.equal(lines[lines.indexOf('### 부분 0') + 1], `- 사용자 메모: ${note}`);
  assert.ok(lines[lines.indexOf('### 부분 59') + 1].endsWith('…') && lines[lines.indexOf('### 부분 59') + 1].length < note.length);
  assert.ok(mid.text.endsWith('──────── 인수인계 문서 끝 · af-handover:BIG234 ────────'));
  // Far over: brief parts, then the rest by name only.
  const far = big(100);
  assert.ok(far.text.length <= HANDOVER_CHARS && far.trimmed === 100, `${far.text.length} ${far.trimmed}`);
  assert.match(far.text, /\n그 밖의 부분 \d+개 \(이름만\): 부분 \d+, .*부분 99\n/);
  // Pasted with the person's words after it, the whole message is read: it folds to one line and the words stay.
  const prompt = `${far.text}\n\n결제 화면부터 이어서 해 줘`;
  assert.ok(sessionText(ask(NEXT, prompt)).text.includes('[AgentFlow 인수인계 문서를 받아 이어감 · af-handover:BIG234 · 나의 프로젝트]\n\n결제 화면부터 이어서 해 줘'));
});

test('HANDOVER-U1 what is left to ask stays: a part written briefly keeps its open choice first; a part put away takes its candidates along', () => {
  const note = '손님이 예약 시간을 고르고 휴무일과 영업시간을 확인한 뒤 결제까지 마치는 흐름을 맡아요. '.repeat(5).trim();
  const said = ['예약 확인 문자를 보내 줘', '문자 업체는 아직 못 정했어', '나중에 알림톡도 생각 중', '문자 보내는 자리만 만들었어요'];
  let p = D.pasteRecord(D.createProject(), sessionText(session(ID, [{ role: 'user', at: AT, text: `${said[0]}. ${said[1]}. ${said[2]}.` }, { role: 'assistant', at: AT, text: `${said[3]}.` }])).text, null).project;
  p = readAs(p, [['문자', [said[0]], [['want', said[0]], ['idea', said[2]], ['reported', said[3]], ['open', said[1]]]]]);
  for (let i = 0; i < 99; i++) p = D.addArea(p, `부분 ${i}`, note); // so many that every part is written briefly
  const doc = handoverDoc(p, { scope: null, code: 'ASK234', at: AT }), block = doc.text.slice(doc.text.indexOf('### 문자\n')).split('\n\n')[0];
  assert.ok(doc.trimmed > 0 && block.includes('\n- (그 밖에 1개는 이 문서에 넣지 않았어요)'), block);
  assert.ok(block.includes('\n- 남은 선택: 문자 업체는 아직 못 정했어\n'), block);
  // Written in full, a part with more claims than it has room for still keeps its open choice: what is left out is of the kinds
  // asked about last (구상, 확인 보고), and what is kept is written in the full order. Three readings of one part, four claims each.
  const kinds = ['want', 'want', 'want', 'want', 'reported', 'reported', 'reported', 'reported', 'want', 'idea', 'checked', 'open'];
  let q = D.createProject();
  for (let r = 0; r < 3; r++) {
    const say = kinds.slice(r * 4, r * 4 + 4).map((_, i) => `말 ${r * 4 + i}번이에요`);
    q = D.pasteRecord(q, sessionText(session(ID, [{ role: 'user', at: AT, text: say.join('. ') }, { role: 'assistant', at: AT, text: '네' }])).text, null).project;
    q = readAs(q, [[r ? 'P01' : '문자', [say[0]], say.map((x, i) => [kinds[r * 4 + i], x])]]);
  }
  const full = handoverDoc(q, { scope: null, code: 'ASK234', at: AT }), part = full.text.slice(full.text.indexOf('### 문자\n')).split('\n\n')[0];
  assert.ok(full.trimmed === 0 && part.includes('\n- 남은 선택: 말 11번이에요\n- (그 밖에 2개는 이 문서에 넣지 않았어요)\n'), part);
  assert.ok(!part.includes('- 구상:') && !part.includes('- 확인 보고:') && part.indexOf('- 원함:') < part.indexOf('- 작업 보고:'), part);
  // A candidate is listed with its part's name until that part is put away; then it goes, as it does from the map's own list.
  const { p: m, hours } = mapped([['휴무일을 매주 같은 요일로 둘지 정하지 않았어요.', ['new:p1']]]);
  assert.ok(handoverText(m, { scope: null, code: 'ASK234', at: AT }).includes('\n- 휴무일을 매주 같은 요일로 둘지 정하지 않았어요. (영업시간 설정)\n'));
  assert.ok(!handoverText(D.setAreaArchived(m, hours, true), { scope: null, code: 'ASK234', at: AT }).includes('매주 같은 요일'));
});

test('HANDOVER-P1 changed files whose names hold ")" (route groups) are read whole', () => {
  const p = D.pasteRecord(D.createProject(), sessionText(session(ID, [
    { role: 'user', at: '2026-10-29T09:01:00.000Z', text: '로그인 페이지 만들어 줘' }, { role: 'assistant', at: '2026-10-29T09:02:00.000Z', text: '만들었어요 (테스트는 아직)', files: ['app/(auth)/login/page.tsx', 'lib/auth.ts'] }])).text, null).project;
  const t = handoverText(p, { scope: null, code: 'PAR234', at: AT });
  // One request's files are not listed again under it.
  assert.ok(t.includes('- 로그인 페이지 만들어 줘 → 바꾼 파일: app/(auth)/login/page.tsx, lib/auth.ts\n') && !t.includes('최근에 바뀐 파일'), t);
  // The files of all requests are listed once only when that names a file their own lines leave out (one list was cut short), not
  // when it would repeat them, a file changed twice included.
  const ten = Array.from({ length: 10 }, (_, i) => `src/f${i}.ts`), files = (asks, ...lists) => handoverText(D.pasteRecord(D.createProject(), sessionText(session(ID,
    asks.flatMap((text, i) => [{ role: 'user', at: AT, text }, { role: 'assistant', at: AT, text: '했어요', files: lists[i] }]))).text, null).project, { scope: null, code: 'PAR234', at: AT });
  const cut = files(['파일 정리해 줘', '하나 더 고쳐 줘'], ten, ['src/f0.ts']);
  assert.ok(cut.includes(`\n- 파일 정리해 줘 → 바꾼 파일: ${ten.slice(0, 8).join(', ')}\n`) && cut.includes(`\n최근에 바뀐 파일: ${ten.join(', ')}\n`), cut);
  assert.ok(!files(['결제 고쳐 줘', '결제 다시 고쳐 줘'], ['src/pay.ts', 'src/a.ts'], ['src/pay.ts']).includes('최근에 바뀐 파일'));
});

test('HANDOVER-X1 an answer\'s files go to the request of its own session, even when another session\'s record came in between', () => {
  const T = m => `2026-10-29T09:${m}:00.000Z`, at = (id, turns) => session(id, turns, { title: null, startedAt: T('00') }), Y = 'claude-222222222222222222222222', X = 'claude-333333333333333333333333';
  const y1 = at(Y, [{ role: 'user', at: T('01'), text: '결제 모듈 리팩터링' }]);
  const x = at(X, [{ role: 'user', at: T('05'), text: '로그인 화면 문구만 바꿔 줘, 결제 버튼 글자도' }, { role: 'assistant', at: T('06'), text: '바꿨어요', files: ['src/login.tsx'] }]);
  const y2 = at(Y, [...y1.turns, { role: 'assistant', at: T('09'), text: '리팩터링 끝', files: ['src/pay.ts', 'src/pay.test.ts'] }]);
  // The prompt is taken while its long build runs, another session settles, then the reply comes.
  let p = D.createProject();
  for (const [s, mark] of [[y1, null], [x, null], [y2, { lastAt: T('01'), count: 1, updatedAt: T('01') }]]) for (const t of sessionChunks(s, newTurns(s, mark))) p = D.pasteRecord(p, t, null).project;
  const t = handoverText(p, { scope: null, code: 'XRS234', at: AT });
  assert.ok(t.includes('- 결제 모듈 리팩터링 → 바꾼 파일: src/pay.ts, src/pay.test.ts\n- 로그인 화면 문구만 바꿔 줘, 결제 버튼 글자도 → 바꾼 파일: src/login.tsx\n'), t);
  assert.ok(!t.includes('최근에 바뀐 파일'), 'each file is named above: not listed again');
  // A part's document leaves out the record holding the prompt: the reply's files go nowhere rather than to another request.
  const q = readAs(p, [['결제', ['결제 버튼 글자도', '리팩터링 끝']]]), pay = q.space.areas.find(a => a.name === '결제').id;
  const s = handoverText(q, { scope: pay, code: 'XRS234', at: AT });
  assert.ok(s.includes('- 로그인 화면 문구만 바꿔 줘, 결제 버튼 글자도 → 바꾼 파일: src/login.tsx\n') && !s.includes('src/pay.ts'), s);
});

test('HANDOVER-B3 a web record header is read by the shape of its fields, in any order; its files line may follow a bullet', () => {
  const o = t => { const x = sessionOrigin(t); return [x.title, x.cwd, x.branch]; };
  assert.deepEqual(o('[웹 AI 세션 기록 · 브랜치 전략 정하기]'), ['브랜치 전략 정하기', null, null], 'a branch name has no spaces');
  assert.deepEqual(o('[웹 AI 세션 기록 · 작업 폴더 구조 정리]'), ['작업 폴더 구조 정리', null, null], 'a folder is a path');
  assert.deepEqual(o('[웹 AI 세션 기록 · 로그인 수정 · 작업 폴더 C:\\work\\salon · 브랜치 main · 2026-10-29]'), ['로그인 수정 · 2026-10-29', 'C:\\work\\salon', 'main']);
  assert.deepEqual(o('[웹 AI 세션 기록 · 로그인 수정 · 브랜치 main · 작업 폴더 /work/바탕 화면/salon]'), ['로그인 수정', '/work/바탕 화면/salon', 'main']);
  const answer = '[웹 AI 세션 기록 · 로그인 수정]\n\n── 사용자 요청 ──\n로그인 버튼 고쳐 줘\n\n── 웹 AI 답변 ──\n고쳤어요\n- (바꾼 파일: src/login.tsx, app/(auth)/page.tsx)';
  const p = D.pasteRecord(D.createProject(), answer, null).project;
  assert.ok(handoverText(p, { scope: null, code: 'WEB345', at: '2026-10-30T05:00:00.000Z' }).includes('- 로그인 버튼 고쳐 줘 → 바꾼 파일: src/login.tsx, app/(auth)/page.tsx'));
});

test('HANDOVER-K1 a shared relation has no direction: both parts read it the same way, with no arrow', () => {
  const said = '결제 기록을 정산에서 같이 써요';
  let p = D.pasteRecord(D.createProject(), sessionText(session(ID, [{ role: 'user', at: AT, text: said }, { role: 'assistant', at: AT, text: '네' }])).text, null).project;
  p = readAs(p, [['결제', [said]], ['정산', [said]]], [[0, 1, 'shares', '결제 기록', said]]);
  const t = handoverText(p, { scope: null, code: 'SHR234', at: AT });
  assert.ok(t.includes('\n- 관련: 정산 (이 부분과 함께 씀 · 결제 기록)\n') && t.includes('\n- 관련: 결제 (이 부분과 함께 씀 · 결제 기록)\n') && !t.split('\n').some(l => l.startsWith('- 관련:') && /[←→]/.test(l)), t);
});

test('HANDOVER-N1 records the map has not read: a part shows those of its own sessions, and the note says truly where each one is', () => {
  const PAY = 'codex-89abcdef0123456789abcdef', SETTLE = 'claude-222222222222222222222222', OTHER = 'claude-333333333333333333333333';
  const rec = (id, asks, files) => sessionText(session(id, asks.flatMap(text => [{ role: 'user', at: AT, text }, { role: 'assistant', at: AT, text: '했어요.', files }]), { title: null })).text;
  const add = (p, ...texts) => texts.reduce((q, t) => D.pasteRecord(q, t, null).project, p);
  const p = readAs(add(D.createProject(), rec(PAY, ['결제 화면에서 토스 결제창을 열어 줘'], ['src/pay/checkout.ts']), rec(SETTLE, ['월말 정산표 만들어 줘'], ['src/settle.ts'])),
    [['결제', ['토스 결제창을 열어 줘']], ['정산', ['월말 정산표 만들어 줘']]]);
  const pay = p.space.areas.find(a => a.name === '결제').id, doc = (q, scope = null) => handoverText(q, { scope, code: 'NEW234', at: AT });
  const note = t => /\n\(지도는 [^)]*\)\n/.exec(t)?.[0].trim() ?? null, AT_MAP = /^\(지도는 \d{4}-\d\d-\d\d \d\d:\d\d에 읽은 기록까지예요\. /;
  // A document that sends the reader to the recent flow has one.
  const sends = t => assert.ok(!t.includes('아래 최근 흐름') || t.includes('\n## 최근 흐름 '), t);
  assert.equal(note(doc(p, pay)), null, 'all read: no note');
  // The same session goes on after the reading: the part's document has its new request, and says that is where it is.
  const q = add(p, rec(PAY, ['결제 실패하면 다시 시도 버튼을 보여 줘'], ['src/pay/retry.ts']));
  const one = doc(q, pay);
  assert.ok(one.includes('\n- 결제 화면에서 토스 결제창을 열어 줘 → 바꾼 파일: src/pay/checkout.ts\n- 결제 실패하면 다시 시도 버튼을 보여 줘 → 바꾼 파일: src/pay/retry.ts\n') && !one.includes('정산표'), one);
  assert.ok(AT_MAP.test(note(one)) && note(one).endsWith(' 아직 지도에 담기지 않은 기록이 1개 있어요. 그 기록의 요청과 바꾼 파일은 아래 최근 흐름에 있어요.)'), note(one));
  // Another session's record and a pasted note, not read either: counted, and said not to be in the part's document.
  const r = add(q, rec(OTHER, ['예약 화면 취소 버튼 고쳐 줘'], ['src/booking/cancel.ts']), '결제는 현장 결제로 정했어요. 선결제는 하지 않아요.');
  const part = doc(r, pay), whole = doc(r);
  assert.ok(note(part).endsWith(' 아직 지도에 담기지 않은 기록이 3개 있어요. 그중 이 범위를 다룬 세션의 기록 1개는 요청과 바꾼 파일이 아래 최근 흐름에 있고, 나머지 2개는 이 문서에 없어요. 필요하면 사용자에게 물어보세요.)'), note(part));
  assert.ok(part.includes('src/pay/retry.ts') && !part.includes('취소 버튼') && !part.includes('현장 결제'), part);
  assert.ok(note(whole).endsWith(' 아직 지도에 담기지 않은 기록이 3개 있어요. 그중 2개는 요청과 바꾼 파일이 아래 최근 흐름에 있고, 나머지 1개는 이 문서에 없어요. 필요하면 사용자에게 물어보세요.)'), note(whole));
  assert.ok(whole.includes('\n- 예약 화면 취소 버튼 고쳐 줘 → 바꾼 파일: src/booking/cancel.ts\n') && !whole.includes('현장 결제'), whole);
  // Only a pasted note not read: nothing in the document holds it, and the note does not send the reader below for it.
  const n = add(p, '결제는 현장 결제로 정했어요.');
  for (const t of [doc(n), doc(n, pay)]) { assert.ok(note(t).endsWith(' 아직 지도에 담기지 않은 기록이 1개 있어요. 그 내용은 이 문서에 없으니, 필요하면 사용자에게 물어보세요.)'), note(t)); sends(t); }
  // A record of more requests than the recent flow holds: the note says only its latest ones are below.
  const many = doc(add(p, rec(PAY, Array.from({ length: 7 }, (_, i) => `결제 문구 ${i + 1}번 고쳐 줘`), ['src/pay/text.ts'])), pay);
  assert.ok(note(many).endsWith(' 그 기록의 최근 요청과 바꾼 파일은 아래 최근 흐름에 있어요.)') && !many.includes('결제 문구 1번') && many.includes('결제 문구 7번'), many);
  // Parts drawn by hand, nothing read yet: the note says so, and that the records are not in the document.
  const hand = doc(add(D.addArea(D.createProject(), '결제'), '결제는 현장 결제로 정했어요.'));
  assert.ok(hand.includes('\n(지도는 아직 기록을 읽지 않았어요. 아직 지도에 담기지 않은 기록이 1개 있어요. 그 내용은 이 문서에 없으니, 필요하면 사용자에게 물어보세요.)\n'), hand);
  // No part yet: the document starts from the recent flow only when it has one, and says what it leaves out.
  const none = doc(add(D.createProject(), '예약 화면에서 휴무일에는 예약을 막고 싶어요.'));
  assert.ok(none.includes('\n아직 지도에 부분이 없어요. 기록이 1개 있지만 이 문서에는 없으니, 사용자에게 지금까지의 상황을 먼저 물어보세요.\n'), none);
  const both = doc(add(D.createProject(), rec(PAY, ['결제창 열어 줘'], ['src/pay.ts']), '결제는 현장 결제로 정했어요.'));
  assert.ok(both.includes('\n아직 지도에 부분이 없어요. 아래 최근 흐름과 사용자의 설명에서 시작하세요. 다른 기록 1개는 이 문서에 없으니, 필요하면 사용자에게 물어보세요.\n'), both);
  for (const t of [one, part, whole, many, hand, none, both]) sends(t);
});
