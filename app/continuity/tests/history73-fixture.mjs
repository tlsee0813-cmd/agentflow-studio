// Browser fixture (written replies, no AI call): the 71 partial report and the 72 correction from the saved sequential sample,
// read with stances, the 72 correction explicitly withdrawing the 71 input claim. Prints a plain project backup on stdout.
// One RQ item answers two parts, so a second part can show that a history fold opened in one part does not open there.
import { readFileSync } from 'node:fs';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as C from '../dist/public/shared/change-plan.js';
import { studioView } from '../dist/public/shared/studio.js';

const raw = JSON.parse(readFileSync(new URL('../../../docs/cycles/2026-10-26-visual-experience-59/request72-sequential-sample.json', import.meta.url), 'utf8'));
const SAMPLE_RQ = 'RQ_efb368df-baa4-4668-ab7c-8e4f156daea8', REPORT71 = raw.pasted[1].text, CORRECTION72 = raw.pasted[2].text;
let n = 0;
const meta = () => ({ id: `R_h73_${++n}`, at: new Date().toISOString(), model: 'stub', prompt: 'm3-000000000000', hash: String(n).padStart(64, 'd') });
const reply = matches => ({ summary: '[스텁] 요청 대조', parts: [], relations: [], candidates: [], gaps: [], matches });
const m = (q, item, quote, opts = {}) => ({ record: 'N01', quote, text: `[스텁] ${quote.slice(0, 50)}`, kind: 'reported', about: null, targets: [{ requestId: q.id, itemId: item }], why: '[스텁] 대응', stance: 'made', replaces: null, ...opts });
const apply = (p, inp, r) => M.applyReading(p, inp, M.validateMapReply(r, inp.ask), meta()).project;

const note = Array.from({ length: 12 }, (_, i) => `폴더 처리 설계 메모 ${i + 1}: 원본과 기존 출력은 덮어쓰지 않고, 파일마다 결과를 따로 남긴다.`).join(' ');
let p = D.addArea(D.createProject(), '폴더 일괄 처리', note); p = D.addArea(p, '터미널 명령 실행', '');
const [area, other] = p.space.areas.map(a => a.id);
const titles = ['폴더 안 마크다운 문서 일괄 변환', '파일 하나가 실패해도 나머지 계속 처리', '마지막에 파일별 성공·실패 요약 표시'];
const evidence = [{ id: 'INTENT', kind: 'user', title: '원함', text: titles.join(' / '), basis: '사용자 초안' }];
const analysis = { summary: '폴더', items: titles.map((title, i) => ({ id: `change_${i + 1}`, title, description: `${title}을 원함`, partIds: i === 0 ? [area, other] : [area], refs: ['INTENT'], dependsOn: [] })), impacts: [], preserve: [], unknowns: [] };
const q = C.requestSnapshot(C.createPlan(p.id, '기준', evidence[0].text, evidence, analysis)).scope;
p = D.pasteRecord(p, REPORT71.replace(SAMPLE_RQ, q.id), area).project;
let inp = M.buildMapAsk(p, studioView(p), [q]);
p = apply(p, inp, reply([
  m(q, 'change_1', 'feature/folder 브랜치에서 폴더 경로를 받아 바로 아래의 .md 파일 목록을 기존 단일 문서 변환기에 넘기는 입력 처리만 바꿨습니다.', { about: 'feature/folder 브랜치', text: '[스텁] feature/folder 입력 처리를 바꿨다고 보고함' }),
  m(q, 'change_1', 'main에는 병합하지 않았습니다.', { stance: 'unclear' }),
  m(q, 'change_1', '기존 단일 문서 한 개의 PDF 출력만 확인했다고 보고합니다.', { kind: 'checked', stance: 'unclear' })]));
p = D.pasteRecord(p, CORRECTION72.replace(SAMPLE_RQ, q.id), null).project;
inp = M.buildMapAsk(p, studioView(p), [q]);
const key = inp.ask.priors.find(x => x.about === 'feature/folder 브랜치').key, still = '한 파일 실패 후 계속 처리와 파일별 성공·실패 요약은 여전히 구현하지 않았습니다.';
p = apply(p, inp, reply([
  m(q, 'change_1', '실제로는 그 입력 처리를 구상만 했으며 아직 구현하지 않았습니다. feature/folder의 폴더 입력은 미구현 상태입니다. main에도 반영되지 않았습니다.', { stance: 'not-made', about: 'feature/folder', replaces: key, text: '[스텁] 입력 처리는 구상만 했고 미구현이라고 정정함' }),
  m(q, 'change_2', still, { stance: 'not-made' }), m(q, 'change_3', still, { stance: 'not-made' })]));
process.stdout.write(JSON.stringify({ project: p, area, other, request: q.id }));
