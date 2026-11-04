/* Pipeline .43 (map-reading.18, RECORD_ASKS_V4_KO.md 4.3–4.6): the program's reading of a 기록 v4 record's tables into the fields of a
 * checked reply, after the reply is read. Never the model's words: each value is a cell of a row the record writes, with that row as its
 * quote; the same records read the same way in every reading of the same wire. A v3 record gives its rules' deciders only (who decided is
 * never what keeps a rule: its devices stay as .41/.42 read them). Parts are matched to the records' C-PART rows by name, steps, lines,
 * claims, conditions and file-map rows to the rows their own quotes stand on. */
import { readRecordTables, recordRefs, rowsOf, fixedWord, STEP_REF, IMPLEMENTATION_WORDS, TYPE_WORDS, GROUP_WORDS, CADENCE_WORDS, CROSS_WORDS, STATUS_DIMENSIONS,
  STATUS_VALUES, DEVICE_WORDS, ENTRY_WORDS, TOGETHER_WORDS, SELECT_WORDS, DONE_WORDS, DATA_WORDS, WRITE_WORDS, WITHDRAW_WORDS, PHASE_WORDS, ROLE_WORDS,
  type TableRow, type RecordTables } from './record-table.js';
import type { PartState, PartType, PartImplementation, ReadingStatusClaim, ReadingProjectStatus, ReadingRecordLoop, ReadingMembers, GroupAxis, ReadingVariant,
  ReadingEntryPoint, ReadingContract, ReadingStepBranch, ReadingActor, ActorKind, ReadingContractChange, ReadingShippedIn, WithdrawalMethod, ReadingDecider,
  ConditionPhase, ReadingCoverage, ReadingArtifact, ReadingProfileTable, ReadingRecordExtra, ReadingRecordDiagnostic, ReadingFocus, EnforcerKind, CadenceKind,
  CrossKind, StatusDimension, ClaimTopic } from './types.js';
import { secretLike } from './secret.js';

/** A quote of a row: where it stands in the excerpt sent ([from, to) of the ask's record text), cut at 600 (the stored bound). */
export interface Record43Quote { record: string; quote: string; from: number; to: number }
type Texts = Map<string, { text: string }>;
/** The fields .43 adds, on the reply's own items (the checked reply's parts, claims, steps, conditions, file-map rows and lines). */
interface Step43 { quote: Record43Quote | { record: string; quote: string; from?: number; to?: number }; recordRef?: string | null; loopIds?: string[]; alt?: { group: string; branch: string } | null; branch?: ReadingStepBranch[]; model?: string | null }
interface Claim43 { topic?: ClaimTopic | null; record: string; from?: number; to?: number; enforcedBy?: { kind: EnforcerKind; text: string; quote: Record43Quote | null; program?: true }[];
  decidedBy?: ReadingDecider | null; actors?: ReadingActor[]; mergedWhen?: string | null; contractChange?: ReadingContractChange | null; shippedIn?: ReadingShippedIn | null; withdrawalMethod?: WithdrawalMethod | null }
export interface Part43 { ref: string; name: string | null; state?: PartState | null; stateQuote?: unknown; stateWhen?: string | null; type?: PartType | null; typeQuote?: unknown;
  steps?: Step43[]; claims: Claim43[]; conditions?: { quote: { record: string; from?: number; to?: number }; phase?: ConditionPhase | null }[];
  fileRoles?: { quote: { record: string; from?: number; to?: number }; runtime?: boolean }[];
  loop?: { unit: string | null; stop: string | null; resume: string | null; quote: unknown; program?: true } | null;
  recordRef?: string | null; implementation?: PartImplementation | null; implementationQuote?: Record43Quote | null; members?: ReadingMembers | null; groupAxis?: GroupAxis | null;
  groupAxisQuote?: Record43Quote | null; statusClaims?: ReadingStatusClaim[]; loops?: ReadingRecordLoop[]; variants?: ReadingVariant[]; entries?: ReadingEntryPoint[]; contracts?: ReadingContract[] }
export interface Line43 { from: string; to: string; kind: string; note: string; record: string; quote: string; span?: { from: number; to: number }; payload?: string | null; cadence?: string | null;
  mode?: 'design' | 'observed' | null; channel?: 'data' | 'control' | 'uses' | null; payloadFields?: string[];
  when?: string | null; optional?: boolean; variantRef?: string | null; crosses?: CrossKind | null; cadenceKind?: CadenceKind | null; payloadRef?: string | null; via?: string | null; member?: string | null }
/** The reading's own fields .43 adds. */
export interface Reading43 { basisScope: { text: string; quote: Record43Quote } | null; focus: ReadingFocus | null; projectStatus: ReadingProjectStatus[];
  gatesNone: { reason: string; quote: Record43Quote } | null; coverage: ReadingCoverage[]; artifacts: ReadingArtifact[]; profileTables: ReadingProfileTable[];
  recordExtras: ReadingRecordExtra[]; recordDiagnostics: ReadingRecordDiagnostic[] }
/** map-reading.18 bounds (4.7 PART_LIST_MAX and the reading's lists). */
export const RECORD43_MAX = Object.freeze({ statusClaims: 8, loops: 8, variants: 12, entries: 12, contracts: 8, body: 16, branch: 4, actors: 6, projectStatus: 16, coverage: 128,
  artifacts: 48, profileTables: 24, profileRows: 12, profileCells: 12, recordExtras: 8, recordDiagnostics: 64, members: 24 });

const plain = (s: string): string => s.normalize('NFC').replace(/[*`]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const DASH = /^[—–-]+$/;
const said = (s: string | undefined): string | null => { const t = (s ?? '').trim(); return !t || DASH.test(t) ? null : t; };
const cut = (s: string, n: number): string => { const t = s.replace(/\s+/g, ' ').trim(); return t.length <= n ? t : `${t.slice(0, n - 1)}…`; };
const bare = (s: string): string => s.replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
const overlaps = (q: { record: string; from?: number; to?: number }, r: { record: string; from: number; to: number }): boolean => q.record === r.record && q.from !== undefined && q.to !== undefined && q.from < r.to && r.from < q.to;

/** The program's .43 pass over a checked reply (parts, lines and the reply's own fields), given the ask's record texts. Returns the
 * reading's own fields; mutates the reply's items. nameOf names a part of the map the reply refers to by ref. maxLines bounds the lines
 * (an entry's control line is added only below it). */
export function record43(ctx: { texts: Texts; parts: Part43[]; relations: Line43[]; nameOf: (ref: string) => string; onMaterial: (q: Record43Quote) => boolean; maxLines: number }): Reading43 {
  const { texts, parts, relations } = ctx;
  const out: Reading43 = { basisScope: null, focus: null, projectStatus: [], gatesNone: null, coverage: [], artifacts: [], profileTables: [], recordExtras: [], recordDiagnostics: [] };
  const read = new Map<string, RecordTables>([...texts].map(([record, { text }]) => [record, readRecordTables(text)]));
  const quoteOf = (record: string, from: number, to: number): Record43Quote | null => {
    const text = texts.get(record)?.text; if (text === undefined) return null;
    let end = Math.min(to, from + 600); if (end < to && /[\ud800-\udbff]/.test(text[end - 1] ?? '')) end--;
    const q = { record, quote: text.slice(from, end), from, to: end };
    return ctx.onMaterial(q) ? null : q;
  };
  const rowQuote = (r: TableRow): Record43Quote | null => quoteOf(r.record, r.from, r.to);
  const nameOfPart = (b: Part43): string => b.name ?? ctx.nameOf(b.ref);
  const byName = (name: string): Part43 | undefined => { const n = plain(bare(name)); return n ? parts.find(b => plain(nameOfPart(b)) === n) : undefined; };
  const diag = (category: ReadingRecordDiagnostic['category'], table: string | null, record: string, from: number, to: number, column: string | null = null) => {
    if (out.recordDiagnostics.length < RECORD43_MAX.recordDiagnostics && from < to) out.recordDiagnostics.push({ category, table, column, record, from, to });
  };
  for (const [record, t] of read) for (const d of t.diagnostics) diag(d.category, d.table, record, d.from, d.to, d.column);
  const v4 = (ids: string[]) => rowsOf(texts, ids).filter(r => r.dialect === 'v4');
  const refs = recordRefs(texts);
  const partOfRef = (record: string, b: string): string | null => refs.get(record)?.parts.get(b) ?? null;

  /* Rules (every dialect): who decided. A v4 rule's devices are its row's 지키는 장치 and 장치 위치 (4.5); a v3 rule's stay as read. */
  const rules = rowsOf(texts, ['C-RULE']), changes = v4(['C-CHANGE']), withdrawals = v4(['C-WITHDRAW']);
  for (const b of parts) for (const c of b.claims) {
    if (c.topic === 'rule') {
      const row = rules.find(r => overlaps(c, r)), who = row ? said(bare(row.byColumn['정한 이·언제'] ?? '').replace(/^모름$/, '')) : null, q = row ? rowQuote(row) : null;
      if (row && who && q) c.decidedBy = { text: cut(who, 80), when: /\d{4}-\d{2}-\d{2}|\d{1,2}-\d{1,2}(?:\s+\d{1,2}:\d{2}Z?)?/.exec(who)?.[0] ?? null, quote: q };
      if (row && row.dialect === 'v4' && q) {
        const kinds = (row.byColumn['지키는 장치'] ?? '').split('+').map(x => fixedWord(x, DEVICE_WORDS)?.value ?? null);
        const where = said(bare(row.byColumn['장치 위치'] ?? ''));
        if (kinds.includes('none')) c.enforcedBy = [{ kind: 'none', text: '기록상 미설계', quote: q, program: true }];
        else if (kinds.every(k => k === 'unknown' || k === null)) c.enforcedBy = [];
        else c.enforcedBy = [...new Set(kinds.filter((k): k is 'code' | 'gate' | 'person' => k === 'code' || k === 'gate' || k === 'person'))]
          .map(kind => ({ kind, text: cut(where ?? (kind === 'person' ? '사람' : kind === 'gate' ? '검사' : '코드'), 80), quote: q, program: true as const }));
      }
    }
    if (c.topic === 'change') {
      const row = changes.find(r => overlaps(c, r));
      if (row) {
        c.actors = actorsOf(row.byColumn['관련 주체·역할'] ?? '');
        const dates = (row.byColumn['날짜'] ?? '').split(/\s+\/\s+/); c.mergedWhen = dates.length > 1 && said(dates[1]) ? cut(dates[1]!, 40) : null;
        c.contractChange = contractChangeOf(row.byColumn['계약 변화'] ?? ''); c.shippedIn = shippedOf(row.byColumn['실린 판본'] ?? '');
      }
    }
    if (c.topic === 'withdrawn') {
      const row = withdrawals.find(r => overlaps(c, r));
      if (row) { c.withdrawalMethod = fixedWord(row.byColumn['방식'] ?? '', WITHDRAW_WORDS)?.value ?? null; c.contractChange = contractChangeOf(row.byColumn['계약 변화'] ?? ''); }
    }
  }
  if (![...read.values()].some(t => t.version === 'v4' || t.tables.some(x => x.dialect === 'v4'))) return out;

  /* Parts: C-PART (type, 구현 상태, row ID, list items), C-GROUP, C-STATUS, then the state (4.6). */
  const groups = v4(['C-GROUP']);
  for (const r of v4(['C-PART'])) {
    const b = byName(r.byColumn['이름'] ?? ''), q = rowQuote(r); if (!b || !q || b.recordRef) continue;
    const id = (r.byColumn['행 ID'] ?? '').trim(); b.recordRef = /^B\d{1,3}$/.test(id) ? id : null;
    const typed = fixedWord(r.byColumn['유형'] ?? '', TYPE_WORDS);
    if (typed) { b.type = typed.value as PartType | null; b.typeQuote = typed.value ? q : null; }
    const impl = fixedWord(r.byColumn['구현 상태'] ?? '', IMPLEMENTATION_WORDS);
    b.implementation = impl?.value ?? null; b.implementationQuote = impl?.value ? q : null;
    const m = /항목\s*(\d+|여럿)\s*·\s*순서\s*(있음|없음)/.exec(r.byColumn['하는 일 한 줄'] ?? '');
    if (m) {
      const items = groups.filter(g => fixedWord(g.byColumn['묶음 뜻'] ?? '', GROUP_WORDS)?.value === 'members' && plain(bare(g.byColumn['부모 이름'] ?? '')) === plain(nameOfPart(b)))
        .flatMap(g => (g.byColumn['자식 이름들'] ?? '').split('·').map(x => cut(x, 60)).filter(Boolean));
      b.members = { count: m[1] === '여럿' ? null : Number(m[1]), ordered: m[2] === '있음', items: [...new Set(items)].slice(0, RECORD43_MAX.members), quote: q };
    }
  }
  for (const g of groups) {
    const b = byName(g.byColumn['부모 이름'] ?? ''), q = rowQuote(g); if (!b || !q || b.groupAxis) continue;
    const axis = fixedWord(g.byColumn['묶음 뜻'] ?? '', GROUP_WORDS)?.value ?? null; if (axis) { b.groupAxis = axis; b.groupAxisQuote = q; }
  }
  for (const r of v4(['C-STATUS'])) {
    const dim = fixedWord(r.byColumn['상태 차원'] ?? '', STATUS_DIMENSIONS)?.value, q = rowQuote(r); if (!dim || !q) continue;
    const val = fixedWord(r.byColumn['값'] ?? '', STATUS_VALUES[dim]); if (!val) continue;
    const successor = /\(\s*후속\s*[:：]\s*([^)]+)\)/.exec(val.rest)?.[1]?.trim() ?? null;
    const claim: ReadingStatusClaim = { dimension: dim as StatusDimension, value: val.value, scope: said(r.byColumn['적용 범위·조건']) ? cut(r.byColumn['적용 범위·조건']!, 120) : null,
      basis: said(r.byColumn['기준']) ? cut(r.byColumn['기준']!, 60) : null, successor: successor ? cut(successor, 60) : null, quote: q };
    const target = (r.byColumn['대상'] ?? '').trim(), b = /^전체$/.test(target) ? undefined : byName(target);
    if (b) { if ((b.statusClaims ??= []).length < RECORD43_MAX.statusClaims) b.statusClaims.push(claim); }
    else if (out.projectStatus.length < RECORD43_MAX.projectStatus && target) out.projectStatus.push({ target: cut(target, 80), ...claim });
  }
  // 4.6: a v4 part's state is the program's: 운영 상태 (실행 중 → running, 정지·실패 → stopped, 모름 → unknown; 유휴·대기 decides nothing), else
  // 구현 상태 (미구현 → unbuilt, 제거됨 → retired, 모름 → unknown), else none. running stands only on a 「실행 중」 row.
  for (const b of parts) {
    if (!b.recordRef) continue;
    const op = (b.statusClaims ?? []).find(s => s.dimension === 'operation' && s.value !== 'idle');
    const from: [PartState | null, Record43Quote | null, string | null] = op ? [op.value === 'running' ? 'running' : op.value === 'unknown' ? 'unknown' : 'stopped', op.quote as Record43Quote, op.basis]
      : b.implementation === 'unbuilt' ? ['unbuilt', b.implementationQuote ?? null, null] : b.implementation === 'removed' ? ['retired', b.implementationQuote ?? null, null]
      : b.implementation === 'unknown' ? ['unknown', b.implementationQuote ?? null, null] : [null, null, null];
    b.state = from[1] ? from[0] : null; b.stateQuote = from[0] && from[1] ? from[1] : null; b.stateWhen = from[0] && from[1] && from[2] ? cut(from[2], 40) : null;
  }

  /* Steps: C-STEP row ID, loops, branch group, 조건·분기 clauses, model. */
  const stepRows = v4(['C-STEP']);
  for (const b of parts) for (const s of b.steps ?? []) {
    const r = stepRows.find(x => overlaps(s.quote, x)); if (!r) continue;
    const id = (r.byColumn['행 ID'] ?? '').trim(), ref = STEP_REF.exec(id);
    s.recordRef = ref ? id : null;
    s.loopIds = (said(r.byColumn['소속 반복 ID']) ?? '').split(/\s*\+\s*/).map(x => x.trim()).filter(x => /^B\d{1,3}:L\d{1,3}$/.test(x));
    s.alt = ref?.[3] ? { group: `S${ref[2]}`, branch: ref[3] } : null;
    s.branch = ref ? branchesOf(r.byColumn['조건·분기'] ?? '', ref[1]!) : [];
    const model = /모델\s*[:：]\s*([^·,;|]+)/.exec(r.byColumn['쓰는 파일·함수'] ?? ''); s.model = model ? cut(model[1]!, 60) : null;
  }
  /* Loops (C-LOOP): on the owning part, the outermost one also its loop where it has none. */
  for (const r of v4(['C-LOOP'])) {
    const b = byName(r.byColumn['소유 부분'] ?? ''), q = rowQuote(r), id = (r.byColumn['행 ID'] ?? '').trim(); if (!b || !q || !/^B\d{1,3}:L\d{1,3}$/.test(id)) continue;
    const own = id.split(':')[0]!, parentRef = /^B\d{1,3}:L\d{1,3}$/.test((r.byColumn['부모 반복 ID'] ?? '').trim()) ? r.byColumn['부모 반복 ID']!.trim() : null;
    const parentPart = parentRef && parentRef.split(':')[0] !== own ? partOfRef(r.record, parentRef.split(':')[0]!) : null;
    const loop: ReadingRecordLoop = { recordRef: id, parentRef, parentPart: parentPart ? cut(parentPart, 60) : null, body: bodyOf(r.byColumn['몸통 단계 ID'] ?? '', own),
      unit: said(r.byColumn['반복 단위']) ? cut(r.byColumn['반복 단위']!, 80) : null, count: said(r.byColumn['횟수·계속 조건']) ? cut(r.byColumn['횟수·계속 조건']!, 120) : null,
      stop: said(r.byColumn['종료·탈출 조건']) ? cut(r.byColumn['종료·탈출 조건']!, 120) : null, quote: q };
    if ((b.loops ??= []).length >= RECORD43_MAX.loops || b.loops.some(x => x.recordRef === id)) continue;
    b.loops.push(loop);
    for (const step of loop.body) {
      const row = stepRows.find(x => x.record === r.record && (x.byColumn['행 ID'] ?? '').trim() === step) ?? stepRows.find(x => (x.byColumn['행 ID'] ?? '').trim() === step);
      if (row && !(row.byColumn['소속 반복 ID'] ?? '').split(/\s*\+\s*/).map(x => x.trim()).includes(id)) diag('loop-body', 'C-LOOP', r.record, r.from, r.to);
    }
  }
  for (const b of parts) {
    const outer = (b.loops ?? []).find(l => !l.parentRef || l.parentPart !== null);
    if (!outer || (b.loop && b.loop.unit !== null) || b.state === 'retired' || b.state === 'unbuilt') continue;
    const unit = outer.unit ? cut(outer.unit, 60) : null, stop = outer.stop ? cut(outer.stop, 60) : null;
    if (b.loop) b.loop = { ...b.loop, unit, stop: b.loop.stop ?? stop, program: true };
    else if (unit || stop) b.loop = { unit, stop, resume: null, quote: outer.quote, program: true };
  }
  /* Contracts (C-CONTRACT) on the providing part; variants (C-VARIANT) on the part owning the interface; entries (C-ENTRY) on the owning
   * part, with a control line from a consumer that is a part (none is made up). */
  const contracts = v4(['C-CONTRACT']), profile22 = v4(['P2-02']);
  for (const r of contracts) {
    const b = byName(r.byColumn['제공 부분'] ?? ''), q = rowQuote(r), id = (r.byColumn['행 ID'] ?? '').trim(); if (!b || !q || !/^K\d{1,3}$/.test(id)) continue;
    if ((b.contracts ??= []).length < RECORD43_MAX.contracts) b.contracts.push({ recordRef: id, consumer: opt(r.byColumn['외부 소비자'], 80), surface: opt(r.byColumn['접점·방향'], 120),
      spec: opt(r.byColumn['자료·응답·종료·오류 명세'], 200), version: opt(r.byColumn['적용 판본'], 60), quote: q });
  }
  for (const r of v4(['C-VARIANT'])) {
    const q = rowQuote(r), id = (r.byColumn['행 ID'] ?? '').trim(), iface = (r.byColumn['공통 계약·접점 ID'] ?? '').trim(); if (!q || !/^X\d{1,3}$/.test(id) || !iface) continue;
    const k = /^K\d{1,3}/.exec(iface)?.[0], spot = /^(B\d{1,3})\s*:\s*\S/.exec(iface)?.[1], p22 = /^P2-02\.\d+/.exec(iface)?.[0];
    const ownerName = k ? contracts.find(c => (c.byColumn['행 ID'] ?? '').trim() === k)?.byColumn['제공 부분'] : spot ? partOfRef(r.record, spot) : p22 ? profile22.find(c => (c.byColumn['행 ID'] ?? '').trim() === p22)?.byColumn['소유 부분'] : undefined;
    const implementer = (r.byColumn['구현 부분'] ?? '').trim(), b = (ownerName ? byName(ownerName) : undefined) ?? byName(implementer);
    if (!b) { diag('variant-owner', 'C-VARIANT', r.record, r.from, r.to); continue; }
    const together = fixedWord(r.byColumn['함께 사용 가능 여부'] ?? '', TOGETHER_WORDS), sel = r.byColumn['선택 주체·시점'] ?? '';
    if ((b.variants ??= []).length < RECORD43_MAX.variants) b.variants.push({ recordRef: id, interfaceRef: cut(iface, 80), implementer: /^사용자\s*지정/.test(implementer) ? 'user' : cut(implementer || '모름', 60),
      selector: { who: /사용자\s*설정|플랫폼·빌드|플랫폼|빌드(?!\s*시)|코드/.exec(sel)?.[0] ?? null, how: Object.entries(SELECT_WORDS).find(([w]) => sel.includes(w))?.[1] ?? null, when: /빌드\s*시|시작\s*시|호출마다/.exec(sel)?.[0] ?? null },
      condition: opt(r.byColumn['선택 조건'], 120), together: together?.value ?? 'unknown', togetherScope: /^\((.+)\)$/.exec(together?.rest ?? '')?.[1]?.trim().slice(0, 60) ?? null, quote: q });
  }
  for (const r of v4(['C-ENTRY'])) {
    const b = byName(r.byColumn['소유 부분'] ?? ''), q = rowQuote(r), id = (r.byColumn['행 ID'] ?? '').trim(); if (!b || !q || !/^N\d{1,3}$/.test(id)) continue;
    const written = (r.byColumn['진입점'] ?? '').trim(), order = /^(\d{1,2})\)\s*/.exec(written), consumer = said(r.byColumn['소비자·호출 주체']);
    if ((b.entries ??= []).length < RECORD43_MAX.entries) b.entries.push({ recordRef: id, name: cut(order ? written.slice(order[0].length) : written, 120), kind: fixedWord(r.byColumn['호출 방식'] ?? '', ENTRY_WORDS)?.value ?? null,
      order: order ? Number(order[1]) : null, consumer: consumer ? cut(consumer, 80) : null, contractRef: /^K\d{1,3}$/.test((r.byColumn['계약 ID'] ?? '').trim()) ? r.byColumn['계약 ID']!.trim() : null, quote: q });
    const by = consumer ? byName(consumer) : undefined;
    if (!by) { diag('entry-consumer', 'C-ENTRY', r.record, r.from, r.to); continue; }
    if (by === b || relations.length >= ctx.maxLines || relations.some(l => l.from === by.ref && l.to === b.ref) || secretLike(written)) continue;
    relations.push({ from: by.ref, to: b.ref, kind: 'flow', note: '', record: q.record, quote: q.quote, span: { from: q.from, to: q.to }, payload: cut(order ? written.slice(order[0].length) : written, 80), cadence: null,
      mode: 'design', channel: 'control', payloadFields: [], when: null, optional: false, variantRef: null, crosses: null, cadenceKind: null, payloadRef: null, via: null, member: null });
  }
  /* Lines (C-LINK): 조건·선택, 경계, 박자, the D row named first, 통로, the list item. */
  const links = v4(['C-LINK']);
  for (const l of relations) {
    if (!l.span) continue;
    const r = links.find(x => overlaps({ record: l.record, from: l.span!.from, to: l.span!.to }, x)); if (!r) continue;
    const choice = said(r.byColumn['조건·선택']), variant = choice ? /^변형\s*(X\d{1,3})\b/.exec(choice) : null;
    l.optional = choice !== null; l.variantRef = variant ? variant[1]! : null; l.when = choice && !variant ? cut(choice, 120) : null;
    l.crosses = fixedWord(r.byColumn['경계'] ?? '', CROSS_WORDS)?.value ?? null; l.cadenceKind = fixedWord(r.byColumn['박자'] ?? '', CADENCE_WORDS)?.value ?? null;
    const what = r.byColumn['넘기는 것'] ?? ''; l.payloadRef = /^\s*(D\d{1,3})\b/.exec(what)?.[1] ?? null;
    const via = /통로\s*[:：]\s*(.+)$/.exec(what)?.[1]; l.via = via ? cut(via, 80) : null;
    for (const [cell, ref] of [[r.byColumn['보내는 부분'] ?? '', l.from], [r.byColumn['받는 부분'] ?? '', l.to]] as const) {
      const m = /^(.+?)\s*:\s*(.+)$/.exec(cell.trim()), part = parts.find(b => b.ref === ref), name = part ? nameOfPart(part) : ctx.nameOf(ref);
      if (m && plain(m[1]!) === plain(name)) { l.member = cut(m[2]!, 60); break; }
    }
  }
  /* Conditions (C-COND 갈리는 때) and file-map rows (「(실행 시)」). */
  const conds = v4(['C-COND']), files = rowsOf(texts, ['C-FILES']);
  for (const b of parts) {
    for (const c of b.conditions ?? []) { const r = conds.find(x => overlaps(c.quote, x)); c.phase = r ? fixedWord(r.byColumn['갈리는 때'] ?? '', PHASE_WORDS)?.value ?? null : null; }
    for (const f of b.fileRoles ?? []) { const r = files.find(x => overlaps(f.quote, x)); f.runtime = !!r && /\(\s*실행\s*시\s*\)\s*$/.test(r.byColumn['경로'] ?? ''); }
  }
  /* The reading's own fields. */
  const basis = v4(['C-BASIS'])[0], basisQ = basis ? rowQuote(basis) : null, scope = basis ? said(basis.byColumn['읽은 범위']) : null;
  if (basisQ && scope) out.basisScope = { text: cut(scope, 200), quote: basisQ };
  for (const [record, t] of read) {
    if (!out.focus && t.focus) { const q = quoteOf(record, t.focus.from, t.focus.to); if (q) out.focus = { profiles: t.focus.profiles, reason: t.focus.reason ? cut(t.focus.reason, 200) : null, tables: t.focus.tables, quote: q }; }
    for (const table of t.tables) {
      if (table.dialect !== 'v4') continue;
      if (table.id === 'C-GATE' && table.none && !out.gatesNone) { const q = quoteOf(record, table.none.from, table.none.to); if (q) out.gatesNone = { reason: cut(table.none.text || '없음', 200), quote: q }; }
      if (table.id === 'C-DONE') for (const r of table.rows) {
        const id = (r.byColumn['표 ID'] ?? '').trim(), state = fixedWord(r.byColumn['작성 상태'] ?? '', DONE_WORDS)?.value, q = quoteOf(record, r.from, r.to);
        if (!/^(?:C-[A-Z]{2,12}|P\d-\d{2})$/.test(id) || !state || !q || out.coverage.length >= RECORD43_MAX.coverage) continue;
        out.coverage.push({ recordId: t.chunk?.recordId ?? null, chunk: t.chunk?.chunk ?? null, table: id, state, included: opt(r.byColumn['수록 범위'], 120), remaining: opt(r.byColumn['남은 범위'], 200), quote: q });
      }
      if (table.id === 'C-DATA') for (const r of table.rows) {
        const q = quoteOf(record, r.from, r.to), name = (r.byColumn['이름'] ?? '').trim(); if (!q || !name || out.artifacts.length >= RECORD43_MAX.artifacts) continue;
        const kind = r.byColumn['종류'] ?? '', shape = r.byColumn['필드·모양'] ?? '', where = r.byColumn['있는 곳·쓰기 방식'] ?? '';
        const mode = /[(（]\s*(덧붙임|통째\s*교체|원자\s*교체)\s*(?:[:：,·]\s*([^)）]+))?[)）]\s*$/.exec(where), id = (r.byColumn['행 ID'] ?? '').trim();
        out.artifacts.push({ recordRef: /^D\d{1,3}$/.test(id) ? id : null, name: cut(name, 80), kind: fixedWord(kind, DATA_WORDS)?.value ?? null, contractRef: /\bK\d{1,3}\b/.exec(kind)?.[0] ?? null,
          shape: said(shape) && !/[·,]/.test(shape) ? cut(shape, 120) : null, fieldsMore: Number(/그\s*밖\s*(\d+)\s*개/.exec(shape)?.[1] ?? NaN) || null,
          where: said(mode ? where.slice(0, mode.index) : where) ? cut(mode ? where.slice(0, mode.index) : where, 120) : null,
          writeMode: mode ? fixedWord(mode[1]!, WRITE_WORDS)?.value ?? null : null, atomicScope: mode?.[2] ? cut(mode[2], 120) : null, quote: q });
      }
      if (/^P\d-\d{2}$/.test(table.id) && table.known && out.profileTables.length < RECORD43_MAX.profileTables) {
        const none = table.none ? quoteOf(record, table.none.from, table.none.to) : null;
        const rows = table.rows.slice(0, RECORD43_MAX.profileRows).flatMap(r => { const q = quoteOf(record, r.from, r.to); if (!q) return [];
          const ref = (r.byColumn['행 ID'] ?? '').trim();
          return [{ cells: r.cells.slice(0, RECORD43_MAX.profileCells).map(c => cut(c.text, 200)), recordRef: /^P\d-\d{2}\.\d{1,3}$/.test(ref) ? ref : null, quote: q }]; });
        out.profileTables.push({ table: table.id, header: table.header.slice(0, RECORD43_MAX.profileCells).map(h => cut(h || '—', 40)), rows, none: table.none && none ? { text: cut(table.none.text || '없음', 200), quote: none } : null });
      }
      if (!table.known && out.recordExtras.length < RECORD43_MAX.recordExtras) {
        const rows = table.rows.slice(0, RECORD43_MAX.profileRows).flatMap(r => { const q = quoteOf(record, r.from, r.to); return q ? [{ cells: r.cells.slice(0, RECORD43_MAX.profileCells).map(c => cut(c.text, 200)), quote: q }] : []; });
        out.recordExtras.push({ table: table.id.slice(0, 12), header: table.header.slice(0, RECORD43_MAX.profileCells).map(h => cut(h || '—', 40)), rows });
      }
    }
  }
  return out;
}
const opt = (s: string | undefined, n: number): string | null => { const t = said(s); return t ? cut(t, n) : null; };
/** C-CHANGE 관련 주체·역할: 「역할: 주체」 joined by 「+」. */
function actorsOf(cell: string): ReadingActor[] {
  const out: ReadingActor[] = [];
  for (const piece of cell.split('+')) {
    const m = /^\s*([^:：]+?)\s*[:：]\s*(.+?)\s*$/.exec(piece); if (!m) continue;
    const role = fixedWord(m[1]!, ROLE_WORDS)?.value; if (!role) continue;
    const who = m[2]!;
    const issue = /이슈\s*(#\d+)\s*(?:\(([^)]*)\))?/.exec(who), named = /(메인테이너|기여자|봇)\s*\(([^)]+)\)/.exec(who);
    const kind: ActorKind = issue ? 'issue' : /소유자/.test(who) ? 'owner' : named ? (named[1] === '메인테이너' ? 'maintainer' : named[1] === '기여자' ? 'contributor' : 'bot') : /^메인테이너/.test(who) ? 'maintainer' : /^기여자/.test(who) ? 'contributor' : /^봇/.test(who) ? 'bot' : 'unknown';
    const name = issue ? (issue[2] && !/모름/.test(issue[2]) ? issue[2].trim() : null) : named ? named[2]!.trim() : kind === 'owner' ? null : /^모름$/.test(who) ? null : who.trim();
    if (out.length < RECORD43_MAX.actors) out.push({ role, kind, name: name ? cut(name, 60) : null, ref: issue ? issue[1]! : null });
  }
  return out;
}
function contractChangeOf(cell: string): ReadingContractChange | null {
  const t = cell.trim(); if (!t) return null;
  if (DASH.test(t)) return { kind: 'none', ref: null };
  if (/^모름/.test(t)) return { kind: 'unknown', ref: null };
  const m = /^(깨짐|호환)\s*[:：]?\s*(.*)$/.exec(t); if (!m) return null;
  const ref = /\bK\d{1,3}\b/.exec(m[2]!)?.[0] ?? (said(m[2]) ? cut(m[2]!, 80) : null);
  return { kind: m[1] === '깨짐' ? 'breaking' : 'compatible', ref };
}
function shippedOf(cell: string): ReadingShippedIn | null {
  const t = cell.trim(); if (!t || DASH.test(t)) return null;
  if (/^미릴리스/.test(t)) return { kind: 'unreleased', version: null };
  if (/^모름/.test(t)) return { kind: 'unknown', version: null };
  return { kind: 'released', version: cut(bare(t), 60) };
}
/** C-LOOP 몸통 단계 ID: refs and ranges (「B03:S04–S06」, 「S05」 of the loop's own part), spelled out, once each. */
function bodyOf(cell: string, own: string): string[] {
  const out: string[] = [];
  for (const m of cell.matchAll(/(?:(B\d{1,3})\s*:\s*)?S(\d{1,3})([a-z]?)(?:\s*[–—~-]\s*(?:B\d{1,3}\s*:\s*)?S?(\d{1,3})([a-z]?))?/g)) {
    const b = m[1] ?? own, a = Number(m[2]), z = m[4] !== undefined ? Number(m[4]) : null, width = Math.max(2, m[2]!.length);
    const ref = (n: number, x = '') => `${b}:S${String(n).padStart(width, '0')}${x}`;
    if (z === null || m[3] || m[5] || z < a || z - a > RECORD43_MAX.body) out.push(ref(a, m[3]), ...(z !== null ? [ref(z, m[5])] : []));
    else for (let n = a; n <= z; n++) out.push(ref(n));
  }
  return [...new Set(out)].slice(0, RECORD43_MAX.body);
}
/** C-STEP 조건·분기: clauses split on 「;」 (or a line of its own), each its condition before the arrow, the steps after it (「→ S06」 of the
 * same part, 「→ B05:S01」 of another), a bound 「최대 N번」 and the outcome words left. */
function branchesOf(cell: string, own: string): ReadingStepBranch[] {
  const t = cell.trim(); if (!t || DASH.test(t)) return [];
  return t.split(/\s*;\s*|\s+\/\s+/).filter(Boolean).slice(0, RECORD43_MAX.branch).map(clause => {
    const arrow = clause.search(/→|->/), when = arrow > 0 ? clause.slice(0, arrow).trim() : null, after = arrow >= 0 ? clause.slice(arrow).replace(/^(?:→|->)\s*/, '') : clause;
    const to = [...after.matchAll(/(?:(B\d{1,3})\s*:\s*)?S(\d{1,3}[a-z]?)/g)].map(m => `${m[1] ?? own}:S${m[2]}`);
    const max = /최대\s*\d+\s*(?:번|회)/.exec(after)?.[0] ?? null;
    const outcome = after.replace(/(?:(B\d{1,3})\s*:\s*)?S\d{1,3}[a-z]?/g, ' ').replace(/최대\s*\d+\s*(?:번|회)/, ' ').replace(/^[\s,·]+|[\s,·]+$/g, '').replace(/\s+/g, ' ');
    return { when: when ? cut(when, 120) : null, to: [...new Set(to)].slice(0, 4), max, outcome: outcome ? cut(outcome, 80) : null };
  });
}
