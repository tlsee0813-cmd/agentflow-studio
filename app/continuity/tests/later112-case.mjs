// AF112 test fixture (model-free, author-written): a full later studio.map.6 case on the existing contracts. A first reading of a
// report against a frozen request (its prior), then a returned evidence record and a correction; the later ask carries the part,
// its claim (C), the prior (M) with its target, the full frozen request with sources, and the evidence record. The reply is
// written for that very ask: the claim replaced, an open claim, code and test passages from the evidence record, and the prior
// withdrawn by the correction. Not a model reply and not evidence of generation quality.
import { readFileSync } from 'node:fs';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as C from '../dist/public/shared/change-plan.js';
import { studioView } from '../dist/public/shared/studio.js';

const SEQ = JSON.parse(readFileSync(new URL('../../../docs/cycles/2026-10-26-visual-experience-59/request72-sequential-sample.json', import.meta.url), 'utf8'));
const SAMPLE_RQ = 'RQ_efb368df-baa4-4668-ab7c-8e4f156daea8', REPORT71 = SEQ.pasted[1].text, CORRECTION72 = SEQ.pasted[2].text;
export const reply6 = o => ({ summary: '', parts: [], relations: [], candidates: [], gaps: [], matches: [], material: [], ...o });
export const part = (ref, o = {}) => ({ ref, name: null, parent: null, role: null, roleAbout: null, roleReplaces: null, basis: [], claims: [], ...o });
export const piece = (inp, words, rec = 'N01') => { const x = inp.ask.records.find(r => r.id === rec).spans.find(s => s.t.trimStart().startsWith(words)); if (!x) throw new Error(`no piece: ${words}`); return x.s; };
function plan(p, area, titles = ['폴더 안 마크다운 문서 일괄 변환', '파일 하나가 실패해도 나머지 계속 처리', '마지막에 파일별 성공·실패 요약 표시']) {
  const evidence = [{ id: 'INTENT', kind: 'user', title: '원함', text: titles.join(' / '), basis: '사용자 초안' }];
  const analysis = { summary: '폴더', items: titles.map((title, i) => ({ id: `change_${i + 1}`, title, description: `${title}을 원함`, partIds: [area], refs: ['INTENT'], dependsOn: [] })), impacts: [], preserve: [], unknowns: [] };
  return C.requestSnapshot(C.createPlan(p.id, '기준', evidence[0].text, evidence, analysis));
}
export function laterCase() {
  let s = D.addArea(D.createProject(), '폴더 일괄 처리', ''); const area = s.space.areas[0].id, q = plan(s, area).scope;
  s = D.pasteRecord(s, REPORT71.replace(SAMPLE_RQ, q.id), area).project;
  const a71 = M.buildMapAsk(s, studioView(s), [q], undefined, M.MAP6_SCHEMA), t = id => [{ requestId: q.id, itemId: id }];
  const mm = (at, item, o = {}) => ({ at, text: '범위', kind: 'reported', stance: 'made', about: null, targets: item ? t(item) : [], why: '스텁', replaces: null, ...o });
  const at71 = piece(a71, 'feature/folder 브랜치에서');
  s = M.applyReading(s, a71, M.validateMapReply(reply6({ parts: [part('P01', { claims: [{ kind: 'reported', text: '폴더 입력 보고', at: at71, about: null, replaces: null, key: 's1' }] })],
    matches: [mm(at71, 'change_1', { about: 'feature/folder 브랜치' }), mm(piece(a71, 'main에는'), 'change_1', { stance: 'unclear' })] }), a71.ask),
    { id: 'R_71', at: '2026-10-30T00:00:00.000Z', model: 'stub', prompt: 'm6-000000000000', hash: '7'.repeat(64) }).project;
  // A returned evidence record (after the request was frozen): code and test passages may only come from evidence.
  s = D.submit(D.editDraft(D.setKind(s, 'request'), '폴더 변환의 코드와 검사 결과를 보내 주세요.'), undefined, area);
  s = D.submit(D.editDraft(D.setKind(s, 'evidence'), 'src/input.ts: 폴더 목록을 읽는 함수를 추가했습니다.\ntests/folder.test.ts: 폴더 입력 검사 2개가 통과했습니다.'));
  s = D.pasteRecord(s, CORRECTION72.replace(SAMPLE_RQ, q.id), null).project;
  const a72 = M.buildMapAsk(s, studioView(s), [q], undefined, M.MAP6_SCHEMA);
  const ev = a72.ask.records.find(r => r.kind === 'evidence').id, key = a72.ask.priors.find(x => x.quote.startsWith('feature/folder 브랜치에서')).key;
  const p1 = piece(a72, '실제로는'), p2 = piece(a72, 'feature/folder의'), at72 = `${p1.split('.')[0]}.${p1.split('.')[1]}-${p2.split('.')[1]}`;
  const reply = reply6({
    parts: [part('P01', { claims: [
      { kind: 'reported', text: '폴더 입력 미구현으로 정정', at: at72, about: null, replaces: 'C01', key: 's1' },
      { kind: 'open', text: '실패 후 계속 처리는 아직 확인되지 않음', at: p2, about: null, replaces: null, key: 's2' }] })],
    matches: [mm(at72, 'change_1', { stance: 'not-made', about: 'feature/folder', replaces: key }),
      mm(piece(a72, 'src/input.ts', ev), 'change_2', { kind: 'code', text: '폴더 목록 읽기 코드', stance: 'unclear' }),
      mm(piece(a72, 'tests/folder.test.ts', ev), 'change_2', { kind: 'test', text: '폴더 입력 검사 통과', stance: 'unclear' })] });
  return { s, q, a72, reply, key, ev };
}
