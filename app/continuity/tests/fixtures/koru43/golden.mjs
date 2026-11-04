// The golden reading of recipe .43 (RECORD_ASKS_V4_KO.md 4.5): the KORU 11-03 v3 status and v1 design records (the rows of
// map-blueprint.test.mjs DESIGN35·STATUS35·K38·KORU39, copied here as koru35-design.txt, koru35-status.txt, k38-status.txt and
// koru39-design.txt) and the R4 hand-kept rules of cli41 (fixtures/cli41), each read by the program with the author-written wires
// of those tests. golden42.json holds what recipe .42 (map-reading.17) made of them; .43 must make the same, a rule's decidedBy and the
// .18 keys that are empty for a v3 record (null or []) aside. No model quality is claimed.
import { readFileSync } from 'node:fs';

const text = name => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');
const cliText = name => readFileSync(new URL(`../cli41/${name}`, import.meta.url), 'utf8');
const empty = () => ({ summary: '', parts: [], relations: [], candidates: [], gaps: [], matches: [], material: [] });

export function goldenReadings({ D, M, studioView, B }) {
  const ofTexts = texts => {
    let project = D.createProject();
    for (const t of texts) project = D.pasteRecord(project, t, null).project;
    const input = M.buildMapAsk(project, studioView(project), [], undefined, M.MAP6_SCHEMA), spans = input.ask.records.flatMap(r => r.spans);
    const at = head => { const hit = spans.filter(s => s.t.startsWith(head)); if (hit.length !== 1) throw new Error(`span ${head}: ${hit.length}`); return hit[0].s; };
    return { project, input, ask: input.ask, at };
  };
  const meta = (id, n) => ({ id, at: '2026-11-05T00:00:00.000Z', model: 'stub', prompt: 'm6-000000000043', hash: n.repeat(64) });
  const part = (f, ref, name, head, extra = {}) => ({ ref, name, parent: null, role: `${name}의 책임`, roleAbout: null, roleReplaces: null, basis: [f.at(head)], claims: [], ...extra });
  const fragmentsOf = parts => Array.from({ length: Math.ceil(parts.length / 3) }, (_, i) => ({ ...empty(), parts: parts.slice(i * 3, i * 3 + 3) }));
  const planOf = parts => ({ global: [], parts: parts.map(p => ({ ref: p.ref, name: p.name, parent: null, at: [p.basis[0]], focus: `${p.name}의 책임` })) });
  const program = (f, parts, relations = []) => {
    const names = parts.map(p => p.name);
    return {
      conditionRows: M.conditionRows(f.ask), fileMapRows: M.fileMapRows(f.ask), artifactRows: M.artifactRows(f.ask),
      personNames: [...M.personNames(f.ask)], factRowNames: [...M.factRowNames([...M.askRecords(f.ask).values()].map(x => x.text))],
      programSteps: names.map(n => M.programSteps(f.ask, n)), ruleConditionRows: names.map(n => M.ruleConditionRows(f.ask, n)),
      factRows: B.factRows(f.ask), uncited: B.uncitedFacts(f.ask, parts), summarySentences: B.summarySentences(f.ask, names),
      connections: B.connectionPayloadRows(f.ask), loopRows: B.loopRows(f.ask, parts), versionFacts: B.versionFacts(f.ask, parts),
      diagnostics: B.readingDiagnostics({ ask: f.ask, summary: '', parts, relations, blueprint: planOf(parts) }),
    };
  };
  const readAll = (f, wire, plan, id, n, extra = {}) => {
    const plain = M.validateMapReply(structuredClone(wire), f.ask), aside = M.validateMapReply(structuredClone(wire), f.ask, { setAside: true, owners: plan.parts.map(p => p.name) });
    const applied = M.applyReading(f.project, f.input, plain, meta(id, n));
    return { plain, aside, asideExclusions: M.readingExclusions(aside), stored: applied.reading, ...extra };
  };
  const out = {};

  // A: the .35 records (design first, then status) with the .35 fragments and plan.
  {
    const f = ofTexts([text('koru35-design.txt'), text('koru35-status.txt')]);
    const claim = (key, head, x = {}) => ({ key, kind: 'reported', text: `원문 행을 옮긴다(${key}).`, at: f.at(head), about: null, replaces: null, ...x });
    const fragments = [{ ...empty(), parts: [
      part(f, 'new:owner', '소유자', '| 소유자 | 지시', { claims: [claim('s1', '| 소유자 | 지시', { topic: 'status' })] }),
      part(f, 'new:arm', 'ARM', '| ARM | e=1.00', { claims: [claim('s2', '| ARM | e=1.00', { topic: 'status' })], config: ['24 h 만료'] }),
      part(f, 'new:card', '카드 러너', '| 카드 러너 | 패킷 →', { claims: [claim('s3', '| 카드 러너 | 일일', { topic: 'withdrawn' }), claim('s4', '| 카드 러너 | 지출', { topic: 'rule' })],
        config: ['타이머 tick :00', 'dispatch :05', 'gate 01/16/31/46분 :02'] })] },
    { ...empty(), parts: [
      part(f, 'new:engine', '엔진', '| 엔진 | 행 셋', { claims: [claim('s61', '| 엔진 | 돈 안전', { topic: 'rule' }), claim('s62', '| 엔진 | 10 |', { topic: 'unknown' }), claim('s64', '| 엔진 | not 1', { topic: 'how' })],
        config: ['레버리지 20', '동시 1', 'j1_cadence 60 s'] }),
      part(f, 'new:sheet', '성적표', '| 성적표 | 하루', { claims: [claim('s63', '| 성적표 | 하루', { topic: 'status' })] })] }];
    const plan = { parts: [
      { ref: 'new:owner', name: '소유자', parent: null, at: [f.at('| 소유자 | 지시')], focus: '지시·잔고·전원' },
      { ref: 'new:arm', name: 'ARM', parent: null, at: [f.at('| ARM | e=1.00')], focus: 'e=1.00 노출 행' },
      { ref: 'new:card', name: '카드 러너', parent: null, at: [f.at('| 카드 러너 | 패킷 →')], focus: '세 팔 카드' },
      { ref: 'new:engine', name: '엔진', parent: null, at: [f.at('| 엔진 | 행 셋')], focus: '행 셋 → 주문' },
      { ref: 'new:sheet', name: '성적표', parent: null, at: [f.at('| 성적표 | 하루')], focus: '하루 장' }],
      global: [{ kind: 'condition', text: '노출은 잔고로만, e=1.00 고정 → new:owner', at: [f.at('| ARM | 노출은')] }] };
    const lines = [
      { from: 'new:card', to: 'new:engine', kind: 'flow', note: '', at: f.at('| 카드 러너 | 엔진'), channel: 'data', payload: 'review.jsonl watch·allowed_side·valid_until', cadence: 'K 23:37Z·U 14:07Z·GAP 06:35Z/21:05Z·깨우기', mode: 'observed' },
      { from: 'new:engine', to: 'new:sheet', kind: 'flow', note: '', at: f.at('| 엔진 | 성적표'), channel: 'data', payload: 'journal·outcomes 경주 행', cadence: '매일 02:15Z', mode: 'observed' }];
    const global = { ...empty(), summary: '엔진은 돌고 있다.', relations: lines };
    const { wire, exclusions } = B.combineRenderedReading(fragments, global, f.ask, plan);
    out.koru35 = { combineExclusions: exclusions, ...readAll(f, wire, plan, 'R_golden_35', 'a'), program: program(f, fragments.flatMap(x => x.parts), lines) };
  }

  // B: the .38 status record with the io and relations of the .38 io test.
  {
    const f = ofTexts([text('k38-status.txt')]);
    const parts = [part(f, 'new:owner', '소유자', '| 소유자 | 지시', { inputs: ['한 줄 보고', '결정 필요'], outputs: ['지시 한 줄', '감독자 보고 붙여 넣기', '평가 요청'] }),
      part(f, 'new:supervisor', '감독자 세션', '| 감독자 세션 | 세션', { inputs: ['읽기 한 쪽', '메모', '사전 등록'], outputs: ['한 줄 보고', '결정 필요'] }),
      part(f, 'new:design', 'design 세션', '| design 세션 | 매매', { outputs: ['읽기 한 쪽', '메모', '사전 등록'] }),
      part(f, 'new:review', '검토 세션', '| 검토 세션 | 감독자'), part(f, 'new:texture', '질감 v3', '| 질감 v3 | σ'),
      part(f, 'new:state', 'state.jsonl 행', '| 질감 v3 | 엔진', { type: 'store', typeAt: f.at('| 질감 v3 | 엔진') }),
      part(f, 'new:engine', '엔진', '| 엔진 | 행 셋')];
    const line = (from, to, head, x) => ({ from, to, kind: 'flow', note: '', at: f.at(head), channel: 'control', mode: 'observed', ...x });
    const lines = [line('new:supervisor', 'new:owner', '| 감독자 세션 | 소유자', { payload: '한 줄 보고 묶음·결정 필요', cadence: '사건·결정 때' }),
      line('new:owner', 'new:review', '| 소유자 | 검토 세션', { payload: '감독자 보고 붙여 넣기·평가 요청', cadence: '수시' }),
      line('new:design', 'new:supervisor', '| design 세션 | 감독자 세션', { payload: '읽기 한 쪽·메모·사전 등록', cadence: '하루 장 뒤' }),
      line('new:texture', 'new:state', '| 질감 v3 | 엔진', { payload: 'state.jsonl state_id·sigma_now_ticks', channel: 'data', cadence: '분마다' }),
      line('new:state', 'new:engine', '| 질감 v3 | 엔진', { payload: 'state.jsonl state_id·sigma_now_ticks', channel: 'data', cadence: null })];
    const plan = planOf(parts), global = { ...empty(), summary: '', relations: lines };
    const { wire, exclusions } = B.combineRenderedReading(fragmentsOf(parts), global, f.ask, plan);
    out.k38 = { combineExclusions: exclusions, ...readAll(f, wire, plan, 'R_golden_38', 'b'), program: program(f, parts, lines) };
  }

  // C: the .39 design record with the .39 wire (seven stores, eleven data lines, the engine's and card runner's steps).
  {
    const f = ofTexts([text('koru39-design.txt')]);
    const store = (ref, name, head, path) => part(f, ref, name, head, { type: 'store', typeAt: f.at(head), outputs: [name], files: [path] });
    const step = (name, does, uses, head) => ({ name, does, uses, at: f.at(head) });
    const parts = [
      part(f, 'new:supervisor', '감독자 세션', '| 감독자 세션 | 세션'), part(f, 'new:review', '검토 세션', '| 검토 세션 | 세션'),
      part(f, 'new:engine', '엔진', '| 엔진 | 루프', { inputs: ['review 행', 'policy 행', 'state 행', '패킷'], steps: [step('review 읽기', '마지막 행·나이', ['row_read', 'row_live(1800 s)', 'row_review'], '| 엔진 | 4 |'), step('policy·state', '상태별 정책 행과 신호 행', ['row_policy', 'row_state'], '| 엔진 | 6 |')],
        claims: [{ key: 's1', kind: 'want', text: '스탑은 1~250 bp 안에 상주해야 한다.', at: f.at('| 엔진 | not 1'), about: null, replaces: null, topic: 'rule', scope: 'part', scopeName: null, anchors: [], enforcedBy: [{ kind: 'unknown', text: '장치 미상', at: null }] }] }),
      part(f, 'new:card', '카드 러너', '| 카드 러너 | AI', { inputs: ['패킷 원천', 'plan', 'facts', 'posture'], outputs: ['cards', 'counter', 'review 행', 'LEDGER'],
        steps: [step('패킷', '원천 스냅샷 → build', ['packet_sources.snapshot', 'build'], '| 카드 러너 | 3 |'), step('카드 행', 'cards-<팔>.jsonl append', ['card_append'], '| 카드 러너 | 9 |'),
          step('review 행', 'CX만 review로', ['card_append', 'rung.row_append'], '| 카드 러너 | 10 |'), step('tick', '매분 checkpoint·kill·만료·trigger·pull', ['tick', 'checkpoint', 'kill', 'pull_due'], '| 카드 러너 | 11 |')] }),
      part(f, 'new:editor', '편집장', '| 편집장 | AI'), part(f, 'new:policy_writer', '정책 행 작성기', '| 정책 행 작성기 | 타이머'),
      part(f, 'new:texture', '질감 v3', '| 질감 v3 | 계산', { steps: [step('bar 열', 'σ20·fill15·slots15·spread·liq', ['Minute 계산'], '| 질감 v3 | 1 |'), step('classify', 'BROKEN 사유 → CALM/ACTIVE', ['classify'], '| 질감 v3 | 2 |')] }),
      part(f, 'new:sheet', '성적표', '| 성적표 | 계산'),
      store('new:review_rows', 'review.jsonl 행', '| review.jsonl 행', '/var/lib/koru-desk/race/review.jsonl'), store('new:policy_rows', 'policy.jsonl 행', '| policy.jsonl 행', '/var/lib/koru-desk/race/policy.jsonl'),
      store('new:state_rows', 'state.jsonl 행', '| state.jsonl 행', '/var/lib/koru-desk/race/state.jsonl'), store('new:texture_events', 'texture-events.jsonl', '| texture-events.jsonl', '/var/lib/koru-desk/sidecar/texture-events.jsonl'),
      store('new:cards', 'cards-{CX,CL,DS}.jsonl', '| cards-{CX', '/var/lib/koru-desk/cards/'), store('new:plan', 'plan.jsonl', '| plan.jsonl', '/var/lib/koru-desk/cards/'),
      store('new:facts', 'facts.jsonl', '| facts.jsonl', '/var/lib/koru-desk/cards/')];
    const line = (from, to, head, payload) => ({ from, to, kind: 'flow', note: '', at: f.at(head), channel: 'data', payload });
    const relations = [line('new:state_rows', 'new:engine', '| state.jsonl 행', 'state.jsonl 행'), line('new:policy_rows', 'new:engine', '| policy.jsonl 행', 'policy.jsonl 행'),
      line('new:review_rows', 'new:engine', '| review.jsonl 행', 'review.jsonl 행'), line('new:card', 'new:review_rows', '| review.jsonl 행', 'review.jsonl 행'),
      line('new:card', 'new:cards', '| cards-{CX', 'cards-{CX,CL,DS}.jsonl'), line('new:plan', 'new:card', '| plan.jsonl', 'plan.jsonl'),
      line('new:texture_events', 'new:card', '| texture-events.jsonl', 'texture-events.jsonl'), line('new:cards', 'new:card', '| cards-{CX', 'cards-{CX,CL,DS}.jsonl'),
      line('new:facts', 'new:card', '| facts.jsonl', 'facts.jsonl'), line('new:texture', 'new:state_rows', '| state.jsonl 행', 'state.jsonl 행'), line('new:editor', 'new:plan', '| plan.jsonl', 'plan.jsonl')];
    const plan = planOf(parts), global = { ...empty(), summary: '', relations };
    const { wire, exclusions } = B.combineRenderedReading(fragmentsOf(parts), global, f.ask, plan);
    out.koru39 = { combineExclusions: exclusions, ...readAll(f, wire, plan, 'R_golden_39', 'c'), program: program(f, parts, relations) };
  }

  // D: the R4 hand-kept rules (cli41 records: status, then design) — the person devices the program keeps.
  {
    const f = ofTexts([cliText('status.txt'), cliText('design.txt')]), unknown = [{ kind: 'unknown', text: '장치 미상', at: null }];
    const claim = (key, head, x = {}) => ({ key, kind: 'reported', text: `원문 행을 옮긴다(${key}).`, at: f.at(head), about: null, replaces: null, ...x });
    const rule = (key, head, t, x = {}) => claim(key, head, { kind: 'want', topic: 'rule', text: t, scope: 'part', enforcedBy: unknown, ...x });
    const parts = [
      part(f, 'new:owner', '소유자', '| 소유자 | 사람', { type: 'person', typeAt: f.at('| 소유자 | 사람'), claims: [
        rule('s1', '| 전체 | 매달 28일', '매달 28일~다음 달 3일에는 사무실 PC에 새 판본을 설치하지 않는다.', { scope: 'project' }),
        rule('s2', '| 전체 | 태그·설치는', '태그·설치는 릴리스 관문 통과 뒤에만 한다.', { scope: 'project' }),
        rule('s3', '| 전체 | 고객 이름', '고객 이름·전화번호는 ledger에 저장하지 않는다.', { scope: 'project' })] }),
      part(f, 'new:accountant', '경리 담당자', '| 경리 담당자 | 사람', { type: 'person', typeAt: f.at('| 경리 담당자 | 사람'), claims: [
        rule('s4', '| 경리 담당자 | 은행 거래내역은', '은행 거래내역은 경리 담당자만 내려받고 인증서는 사무실 PC 밖으로 옮기지 않는다.')] })];
    const w = { ...empty(), parts };
    const plain = M.validateMapReply(structuredClone(w), f.ask, { setAside: true });
    const applied = M.applyReading(f.project, f.input, plain, meta('R_golden_r4', 'd'));
    out.r4 = { aside: plain, asideExclusions: M.readingExclusions(plain), stored: applied.reading, program: program(f, parts) };
  }
  return JSON.parse(JSON.stringify(out));
}
/** The project's own ids (records, areas, relations) are new each run: each is named by its first appearance. */
export function normalizeIds(value) {
  const ids = new Map();
  return JSON.parse(JSON.stringify(value, (k, v) => typeof v === 'string' && /^[A-Z]{1,3}_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v) ? (ids.has(v) ? ids.get(v) : (ids.set(v, `#${v[0]}${ids.size + 1}`), ids.get(v))) : v));
}

/** What .43 may add to a v3 record's reading: a rule's decidedBy (any value) and the map-reading.18 keys, each empty (null or []) for a
 * v3 record; the stored version. Everything else must stay as .42 read it. */
export const GOLDEN_NEW_KEYS = ['decidedBy', 'implementation', 'implementationQuote', 'statusClaims', 'loops', 'variants', 'entries', 'contracts', 'recordRef',
  'loopIds', 'alt', 'branch', 'model', 'members', 'groupAxis', 'groupAxisQuote', 'when', 'optional', 'variantRef', 'crosses', 'cadenceKind', 'payloadRef', 'via', 'member',
  'actors', 'mergedWhen', 'contractChange', 'shippedIn', 'withdrawalMethod', 'phase', 'runtime', 'projectStatus', 'basisScope', 'focus', 'coverage', 'gatesNone',
  'artifacts', 'profileTables', 'recordExtras', 'recordDiagnostics'];
/** A .43 key left empty: null, [] or false (a line that is not optional, a file-map row of no run-time layout). A .42 key absent or null
 * reads the same (a claim's or step's when: null in both). */
export function stripNew(value) {
  if (Array.isArray(value)) return value.map(stripNew);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (k === 'decidedBy') continue;
    if (GOLDEN_NEW_KEYS.includes(k) && (v === null || v === false || (Array.isArray(v) && !v.length))) continue;
    if (k === 'version' && typeof v === 'string' && /^map-reading\.1[78]$/.test(v)) continue;
    out[k] = stripNew(v);
  }
  return out;
}
