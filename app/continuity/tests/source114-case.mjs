// AF114 test fixture (model-free, author-written). A map with one part read from a pasted requirement, a frozen request (its
// change plan snapshot) and, after it, an ordinary pasted report holding both author prose and a code excerpt: the 113 shape. A
// provided code file and a provided check file then come in through the normal entry (provideRecord). replyFor writes a map.6
// reply for the very ask it is given: reported/checked prose from the old pasted report, a describes claim on its code, and code
// and test matches on the provided sources (or, with pastedCode, the old pasted occurrence of the same code, which must fail).
// Not a model reply and not evidence of generation quality. Modules are passed in so a pre-114 build can write the project.13 copy.
export const REQUIREMENT = '요구: 폴더 안의 마크다운 문서를 한 번에 PDF로 변환한다.\n한 파일이 실패해도 나머지 파일은 계속 변환한다.';
export const OLD_REPORT = ['작업 보고: feature/convert 브랜치에서 폴더 변환을 바꿨다고 보고합니다.', '', 'export function convert(dir) {', '  return listMarkdown(dir).map(toPdf);', '}', '',
  '검사: 폴더 변환 검사 2개를 실행했고 통과했다고 보고합니다.'].join('\n');
/** A provided code file as its bytes decode: a byte order mark, CRLF line ends, a non-ASCII comment and trailing spaces, kept. */
export const CODE_FILE = '﻿// src/convert.ts — 폴더 변환 🙂\r\nexport function convert(dir) {\r\n  return listMarkdown(dir).map(toPdf);\r\n}\r\n  \r\n';
export const TEST_FILE = 'tests/convert.test.ts\n✓ convert는 실패한 파일 다음 파일도 계속 변환한다\n2 passed, 0 failed\n';
export const CODE_META = { kind: 'code', name: 'convert.ts', version: 'commit 3f2a1c9', origin: 'https://github.com/example/converter/blob/3f2a1c9e0b7d4a6c8f1e2d3c4b5a69788776655/src/convert.ts' };
export const TEST_META = { kind: 'test', name: 'convert-test.log', version: null, origin: null };
const ITEMS = [['폴더 변환', '폴더 안 마크다운 문서를 한 번에 PDF로 변환한다.'], ['실패 후 계속', '한 파일이 실패해도 나머지를 계속 변환한다.']];

export const reply6 = o => ({ summary: '', parts: [], relations: [], candidates: [], gaps: [], matches: [], material: [], ...o });
export const part = (ref, o = {}) => ({ ref, name: null, parent: null, role: null, roleAbout: null, roleReplaces: null, basis: [], claims: [], ...o });
export const piece = (ask, rec, words) => { const x = ask.records.find(r => r.id === rec)?.spans.find(s => s.t.trimStart().startsWith(words)); if (!x) throw new Error(`no piece ${rec}: ${words}`); return x.s; };

/** The project.13-shaped map with its request: a part read from the requirement (one map-reading.5) and the bundle that froze it. */
export function mapWithRequest({ D, M, C, S, studioView, emptyBundle }) {
  let p = D.rename(D.createProject(), '변환기 114');
  p = D.pasteRecord(p, REQUIREMENT, null).project;
  const a0 = M.buildMapAsk(p, studioView(p), [], undefined, M.MAP6_SCHEMA);
  const r0 = reply6({ summary: '폴더 변환기의 요구를 읽었어요.', parts: [part('new:convert', { name: '폴더 변환', role: '폴더 안 문서를 한 번에 PDF로 바꾸는 부분이다.', basis: [piece(a0.ask, 'N01', '요구:')],
    claims: [{ kind: 'want', text: '실패한 파일 뒤에도 계속 변환하기를 원함', at: piece(a0.ask, 'N01', '한 파일이'), about: null, replaces: null, key: 's1' }] })] });
  p = M.applyReading(p, a0, M.validateMapReply(r0, a0.ask), { id: 'R_114-first', at: new Date().toISOString(), model: 'stub-114', prompt: 'm6-000000000114', hash: '1'.repeat(64) }).project;
  const area = p.space.areas[0].id;
  const evidence = [{ id: 'INTENT', kind: 'user', title: '원함', text: ITEMS.map(x => x[0]).join(' / '), basis: '사용자 초안' }];
  const analysis = { summary: '폴더 변환', items: ITEMS.map(([title, description], i) => ({ id: `change_${i + 1}`, title, description, partIds: [area], refs: ['INTENT'], dependsOn: [] })), impacts: [], preserve: [], unknowns: [] };
  const plan = C.createPlan(p.id, '기준', evidence[0].text, evidence, analysis), snap = C.requestSnapshot(plan);
  const bundle = { ...emptyBundle(''), plan, by: { kind: 'ai', model: 'stub-114', at: snap.createdAt, records: { total: 1, sent: 1 } }, snapshots: [snap],
    labels: { [snap.id]: Object.fromEntries(ITEMS.map(([t], i) => [`change_${i + 1}`, t])) }, origins: { [snap.id]: 'ai' } };
  // The report comes back after the request was frozen (a later map reading may compare it with that request).
  p = D.pasteRecord(p, OLD_REPORT, null).project;
  return { project: JSON.parse(S.serializeProject(p)), bundle, rq: snap.scope };
}

/** A map.6 reply written for this ask. pastedCode: cite the old pasted occurrence of the identical code as a code match. */
export function replyFor(ask, { pastedCode = false } = {}) {
  const rec = test => ask.records.find(test)?.id;
  const old = rec(r => r.kind === 'pasted' && r.spans.some(s => s.t.startsWith('작업 보고: feature/convert'))), code = rec(r => r.kind === 'evidence' && r.basis.includes('코드 자료')), check = rec(r => r.kind === 'evidence' && r.basis.includes('검사 자료'));
  if (!old || !code || !check) throw new Error('replyFor: the ask lacks the old report or a provided source');
  const q = ask.requests[0], t = item => [{ requestId: q.id, itemId: item }];
  const mm = (at, kind, item, o = {}) => ({ at, text: '범위', kind, stance: 'unclear', about: null, targets: t(item), why: '스텁', replaces: null, ...o });
  return reply6({
    parts: [part('P01', { claims: [
      { kind: 'reported', text: '폴더 변환을 바꿨다고 보고함', at: piece(ask, old, '작업 보고:'), about: 'feature/convert 브랜치', replaces: null, key: 's1' },
      { kind: 'checked', text: '폴더 변환 검사 2개 통과를 보고함', at: piece(ask, old, '검사:'), about: null, replaces: null, key: 's2' },
      { kind: 'describes', text: 'convert는 폴더의 마크다운 목록을 PDF로 바꾼다', at: piece(ask, old, 'export function convert'), about: null, replaces: null, key: 's3' }] })],
    matches: [
      mm(piece(ask, old, '작업 보고:'), 'reported', 'change_1', { stance: 'made', about: 'feature/convert 브랜치', text: '폴더 변환을 바꿨다고 보고함' }),
      mm(piece(ask, pastedCode ? old : code, 'export function convert'), 'code', 'change_1', { text: '폴더 목록을 PDF로 바꾸는 코드' }),
      mm(piece(ask, check, '✓ convert는'), 'test', 'change_2', { text: '실패 후 계속 변환 검사 기록' })]
  });
}
