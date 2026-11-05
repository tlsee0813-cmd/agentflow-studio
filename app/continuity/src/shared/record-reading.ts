/* Pipeline .43 (map-reading.18, RECORD_ASKS_V4_KO.md 4.3–4.6): the program's reading of a 기록 v4 record's tables into the fields of a
 * checked reply, after the reply is read. Never the model's words: each value is a cell of a row the record writes, with that row as its
 * quote; the same records read the same way in every reading of the same wire. A v3 record gives its rules' deciders only (who decided is
 * never what keeps a rule: its devices stay as .41/.42 read them). Parts are matched to the records' C-PART rows by name, steps, lines,
 * claims, conditions and file-map rows to the rows their own quotes stand on. */
import { readRecordTables, recordRefs, rowsOf, fixedWord, STEP_REF, IMPLEMENTATION_WORDS, TYPE_WORDS, GROUP_WORDS, CADENCE_WORDS, CROSS_WORDS, STATUS_DIMENSIONS,
  STATUS_VALUES, DEVICE_WORDS, ENTRY_WORDS, TOGETHER_WORDS, SELECT_WORDS, DONE_WORDS, DATA_WORDS, WRITE_WORDS, WITHDRAW_WORDS, PHASE_WORDS, ROLE_WORDS,
  WITHDRAW_WORDS_V5, TOGETHER_WORDS_V5, SCOPE_WORDS, FOUND_WORDS, NATURE_WORDS, CHECK_WORDS, V4_TYPE_FAMILY, readFamily, roleType, partStructure, foldPages, partRefs, loopRefs, rowKey,
  type TableRow, type RecordTables, type FoldedRecord, type FoldRow, type Cite } from './record-table.js';
import type { PartState, PartType, PartImplementation, ReadingStatusClaim, ReadingProjectStatus, ReadingRecordLoop, ReadingMembers, GroupAxis, ReadingVariant,
  ReadingEntryPoint, ReadingContract, ReadingStepBranch, ReadingActor, ActorKind, ReadingContractChange, ReadingShippedIn, WithdrawalMethod, ReadingDecider,
  ConditionPhase, ReadingCoverage, ReadingArtifact, ReadingProfileTable, ReadingRecordExtra, ReadingRecordDiagnostic, ReadingFocus, EnforcerKind, CadenceKind,
  CrossKind, StatusDimension, ClaimTopic, RecordFamily, FamilyReason, ClaimNature, FoundBy, StatusScopeKind, VariantTogether, ReadingPage, ReadingObligation,
  ReadingPageEnd, ReadingCheck, ReadingDefault, ReadingPartState, EvidenceGrade } from './types.js';
import { RECORD_DIAGNOSTIC_CATEGORIES } from './types.js';
import { secretLike } from './secret.js';
/** Recipe .46: the fold's own categories (page-replaced, row-id-prefix, drop-ambiguous) are never stored (map-reading.19 keeps its list). */
const STORED_DIAGNOSTICS: ReadonlySet<string> = new Set(RECORD_DIAGNOSTIC_CATEGORIES);

/** A quote of a row: where it stands in the excerpt sent ([from, to) of the ask's record text), cut at 600 (the stored bound). */
export interface Record43Quote { record: string; quote: string; from: number; to: number }
type Texts = Map<string, { text: string }>;
/** The fields .43 adds, on the reply's own items (the checked reply's parts, claims, steps, conditions, file-map rows and lines). */
interface Step43 { name?: string; does?: string | null; uses?: string[]; program?: true; quote: Record43Quote | { record: string; quote: string; from?: number; to?: number }; recordRef?: string | null; loopIds?: string[]; alt?: { group: string; branch: string } | null; branch?: ReadingStepBranch[]; model?: string | null; cites?: Cite[] }
interface Claim43 { topic?: ClaimTopic | null; record: string; from?: number; to?: number; enforcedBy?: { kind: EnforcerKind; text: string; quote: Record43Quote | null; program?: true }[];
  decidedBy?: ReadingDecider | null; actors?: ReadingActor[]; mergedWhen?: string | null; contractChange?: ReadingContractChange | null; shippedIn?: ReadingShippedIn | null; withdrawalMethod?: WithdrawalMethod | null;
  cites?: Cite[]; foundBy?: FoundBy | null; evidence?: EvidenceGrade | null; when?: string | null; kind?: string; text?: string }
export interface Part43 { ref: string; name: string | null; state?: PartState | null; stateQuote?: unknown; stateWhen?: string | null; type?: PartType | null; typeQuote?: unknown;
  parent?: string | null; role?: string | null; basis?: { record: string; quote: string; from?: number; to?: number }[]; config?: string[];
  steps?: Step43[]; claims: Claim43[]; conditions?: { when?: string; then?: string; else?: string | null; quote: { record: string; quote?: string; from?: number; to?: number }; phase?: ConditionPhase | null }[];
  fileRoles?: { quote: { record: string; from?: number; to?: number }; runtime?: boolean }[];
  loop?: { unit: string | null; stop: string | null; resume: string | null; quote: unknown; program?: true } | null;
  recordRef?: string | null; implementation?: PartImplementation | null; implementationQuote?: Record43Quote | null; members?: ReadingMembers | null; groupAxis?: GroupAxis | null;
  groupAxisQuote?: Record43Quote | null; statusClaims?: ReadingStatusClaim[]; loops?: ReadingRecordLoop[]; variants?: ReadingVariant[]; entries?: ReadingEntryPoint[]; contracts?: ReadingContract[];
  /** Recipe .45 (map-reading.19): set by the program only (record45). */
  family?: RecordFamily | null; familyRole?: string | null; familyReason?: FamilyReason | null; familyQuote?: Record43Quote | null; familyUnclear?: boolean; added?: boolean;
  states?: ReadingPartState[]; cites?: Cite[] }
export interface Line43 { from: string; to: string; kind: string; note: string; record: string; quote: string; span?: { from: number; to: number }; payload?: string | null; cadence?: string | null;
  mode?: 'design' | 'observed' | null; channel?: 'data' | 'control' | 'uses' | null; payloadFields?: string[];
  when?: string | null; optional?: boolean; variantRef?: string | null; crosses?: CrossKind | null; cadenceKind?: CadenceKind | null; payloadRef?: string | null; via?: string | null; member?: string | null;
  claimNature?: ClaimNature | null; cites?: Cite[] }
/** The reading's own fields .43 adds. */
export interface Reading43 { basisScope: { text: string; quote: Record43Quote } | null; focus: ReadingFocus | null; projectStatus: ReadingProjectStatus[];
  gatesNone: { reason: string; quote: Record43Quote } | null; coverage: ReadingCoverage[]; artifacts: ReadingArtifact[]; profileTables: ReadingProfileTable[];
  recordExtras: ReadingRecordExtra[]; recordDiagnostics: ReadingRecordDiagnostic[] }
/** Recipe .45 (map-reading.19): the reading's own fields record45 adds (a reading of no v5 record: level null, every list empty). */
export interface Reading45 { level: 0 | 1 | 2 | null; pages: ReadingPage[]; obligations: ReadingObligation[]; pageEnds: (Omit<ReadingPageEnd, 'quote'> & { quote: Record43Quote })[];
  checks: (Omit<ReadingCheck, 'quote'> & { quote: Record43Quote })[]; defaults: (Omit<ReadingDefault, 'quote'> & { quote: Record43Quote })[]; firstLines: string[] }
/** map-reading.18 bounds (4.7 PART_LIST_MAX and the reading's lists). */
export const RECORD43_MAX = Object.freeze({ statusClaims: 8, loops: 8, variants: 12, entries: 12, contracts: 8, body: 16, branch: 4, actors: 6, projectStatus: 16, coverage: 128,
  artifacts: 48, profileTables: 24, profileRows: 12, profileCells: 12, recordExtras: 8, recordDiagnostics: 64, members: 24,
  // Recipe .45: the part lists the supplementary rows land on (map-reading.17 bounds), and the map-reading.19 lists.
  steps: 24, conditions: 24, config: 12, cites: 6, states: 5, pages: 16, obligations: 64, pageEnds: 128, checks: 6, defaults: 9, firstLines: 3, sharedBy: 8 });

const plain = (s: string): string => s.normalize('NFC').replace(/[*`]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const DASH = /^[—–-]+$/;
const said = (s: string | undefined): string | null => { const t = (s ?? '').trim(); return !t || DASH.test(t) ? null : t; };
const cut = (s: string, n: number): string => { const t = s.replace(/\s+/g, ' ').trim(); return t.length <= n ? t : `${t.slice(0, n - 1)}…`; };
/** Recipe .47 review B1: every stored cite is cut to the contract (validation cites19), wherever a row's cites land: parts, loops,
 * lines, steps, claims; a cite holding a secret-like word is left out. */
const citesCut = (c: readonly Cite[]): Cite[] => c.filter(x => ![x.source, x.place, x.quote].some(w => w && secretLike(w))).slice(0, RECORD43_MAX.cites).map(x => ({ ...x, ref: cut(x.ref, 12), source: x.source ? cut(x.source, 120) : null, place: x.place ? cut(x.place, 80) : null, quote: x.quote ? cut(x.quote, 200) : null }));
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
  // Recipe .45: a v5 row's part name (its B ID's C-PART 이름) also names the part joined to that ID by its row (record45Parts), whatever the
  // model called it.
  let aliases: Map<string, string> | undefined;
  const aliasOf = (n: string) => (aliases ??= new Map(rowsOf(texts, ['C-PART']).filter(r => r.dialect === 'v5').map(r => [plain(bare(r.byColumn['이름'] ?? '')), (r.byColumn['행 ID'] ?? '').trim()] as [string, string]))).get(n);
  const byName = (name: string): Part43 | undefined => { const n = plain(bare(name)); if (!n) return undefined; const id = aliasOf(n);
    // Review N4 (8.3): a v5 row's part by its ID first (the part record45Parts joined to the row), its name only as a fallback.
    return (id ? parts.find(b => b.recordRef === id) : undefined) ?? parts.find(b => plain(nameOfPart(b)) === n); };
  const diag = (category: ReadingRecordDiagnostic['category'], table: string | null, record: string, from: number, to: number, column: string | null = null) => {
    if (out.recordDiagnostics.length < RECORD43_MAX.recordDiagnostics && from < to) out.recordDiagnostics.push({ category, table, column, record, from, to });
  };
  for (const [record, t] of read) for (const d of t.diagnostics) diag(d.category, d.table, record, d.from, d.to, d.column);
  // Recipe .45: a v5 row is read as a v4 row (its v4 view, record-table.ts v5View); a v3 row never.
  const v4 = (ids: string[]) => rowsOf(texts, ids).filter(r => r.dialect !== 'v3');
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
        // Recipe .45: a v5 change row's 찾은 길 (5.1).
        c.foundBy = row.dialect === 'v5' ? fixedWord(row.byColumn['찾은 길'] ?? '', FOUND_WORDS)?.value ?? null : null;
      }
    }
    if (c.topic === 'withdrawn') {
      const row = withdrawals.find(r => overlaps(c, r));
      if (row) { c.withdrawalMethod = (fixedWord(row.byColumn['방식'] ?? '', row.dialect === 'v5' ? WITHDRAW_WORDS_V5 : WITHDRAW_WORDS)?.value ?? null) as WithdrawalMethod | null; c.contractChange = contractChangeOf(row.byColumn['계약 변화'] ?? ''); }
    }
  }
  if (![...read.values()].some(t => t.version === 'v4' || t.version === 'v5' || t.tables.some(x => x.dialect === 'v4' || x.dialect === 'v5'))) return out;

  /* Parts: C-PART (type, 구현 상태, row ID, list items), C-GROUP, C-STATUS, then the state (4.6). */
  const groups = v4(['C-GROUP']);
  for (const r of v4(['C-PART'])) {
    const b = byName(r.byColumn['이름'] ?? ''), q = rowQuote(r); if (!b || !q || (b.recordRef && !(r.dialect === 'v5' && b.recordRef === (r.byColumn['행 ID'] ?? '').trim()))) continue;
    const id = (r.byColumn['행 ID'] ?? '').trim(); b.recordRef = /^B\d{1,3}$/.test(id) ? id : null;
    // .44: the row's 유형 decides a v4 part's type, on that row: a fixed word gives its value; 모름, a word outside the list or no word
    // gives none (the model's word for a part the record types otherwise, or not at all, is not kept).
    const word = fixedWord(r.byColumn['유형'] ?? '', TYPE_WORDS), typed = word?.value ?? null;
    // .44 (review N1): a model type left out for a 유형 word outside the list (not 모름, not empty) is said, on that row and column.
    if (b.type && !word && said(bare(r.byColumn['유형'] ?? ''))) diag('type-word', 'C-PART', r.record, r.from, r.to, '유형');
    b.type = typed as PartType | null; b.typeQuote = typed ? q : null;
    // Recipe .45 (map-reading.19): the row's family. A v5 row's 표현군·역할 as written; a v4 row's 유형 word through the unambiguous words
    // only (12.3: 루프·엔진, 봇, 외부 시스템 and 집행·외부 호출 keep their word, marked 대응 불명확).
    if (r.dialect === 'v5') familyOn(b, r.byColumn['표현군·역할'] ?? '', q, r.fold?.mark === 'add');
    else if (word && word.word in V4_TYPE_FAMILY) { const m = V4_TYPE_FAMILY[word.word]; b.family = m?.family ?? null; b.familyRole = m?.role ?? word.word; b.familyUnclear = !m; b.familyReason = null; b.familyQuote = q; }
    if (r.dialect === 'v5') b.cites = citesCut(r.fold?.cites ?? []);
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
    // Recipe .45 (13.2): a v5 row's range of a part partly off (기능 일부 · 기본 꺼짐); an 비활성 or 조건부 row with no range is 범위 미기재,
    // never the whole part. Every v4 row: null.
    const scopeKind: StatusScopeKind | null = r.dialect !== 'v5' ? null : fixedWord(r.byColumn['적용 범위·조건'] ?? '', SCOPE_WORDS)?.value
      ?? (dim === 'activation' && (val.value === 'inactive' || val.value === 'conditional') && !said(r.byColumn['적용 범위·조건']) ? 'unstated' : null);
    const claim: ReadingStatusClaim = { dimension: dim as StatusDimension, value: val.value, scope: said(r.byColumn['적용 범위·조건']) ? cut(r.byColumn['적용 범위·조건']!, 120) : null,
      basis: said(r.byColumn['기준']) ? cut(r.byColumn['기준']!, 60) : null, successor: successor ? cut(successor, 60) : null, quote: q, scopeKind };
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
    const body = bodyOf(r.byColumn['몸통 단계 ID'] ?? '', own);
    // Recipe .45 (3.5): a v5 loop's body is the C-STEP rows naming it (linked) or none yet (unexpanded: no step is made up).
    const loop: ReadingRecordLoop = { recordRef: id, parentRef, parentPart: parentPart ? cut(parentPart, 60) : null, body,
      unit: said(r.byColumn['반복 단위']) ? cut(r.byColumn['반복 단위']!, 80) : null, count: said(r.byColumn['횟수·계속 조건']) ? cut(r.byColumn['횟수·계속 조건']!, 120) : null,
      stop: said(r.byColumn['종료·탈출 조건']) ? cut(r.byColumn['종료·탈출 조건']!, 120) : null, quote: q,
      bodyState: r.dialect === 'v5' ? (body.length ? 'linked' : 'unexpanded') : null, bodyText: r.dialect === 'v5' ? opt(r.byColumn['몸통 설명'], 120) : null, cites: citesCut(r.fold?.cites ?? []) };
    if ((b.loops ??= []).length >= RECORD43_MAX.loops || b.loops.some(x => x.recordRef === id)) continue;
    b.loops.push(loop);
    for (const step of loop.body) {
      const row = stepRows.find(x => x.record === r.record && (x.byColumn['행 ID'] ?? '').trim() === step) ?? stepRows.find(x => (x.byColumn['행 ID'] ?? '').trim() === step);
      if (row && !(row.byColumn['소속 반복 ID'] ?? '').split(/\s*\+\s*/).map(x => x.trim()).includes(id)) diag('loop-body', 'C-LOOP', r.record, r.from, r.to);
    }
  }
  // .44: a part's C-LOOP rows decide its one loop (the outermost row of its own): a loop the model or an earlier program pass gave it
  // that stands on none of the part's own loop rows (a step of one branch that names a loop, another loop's text) gives way to that
  // row's unit and stop, on that row; one standing on such a row keeps its words and takes that row's unit or stop where it has none
  // (review B3: the row it stands on, never the outer one: a loop on an inner row is not given the outer row's words).
  for (const b of parts) {
    const own = b.loops ?? [], outer = own.find(l => !l.parentRef || l.parentPart !== null) ?? own[0];
    if (!outer || b.state === 'retired' || b.state === 'unbuilt') continue;
    const words = (l: ReadingRecordLoop) => ({ unit: l.unit ? cut(l.unit, 60) : null, stop: l.stop ? cut(l.stop, 60) : null });
    const on = b.loop ? own.find(l => overlaps(b.loop!.quote as { record: string; from?: number; to?: number }, l.quote as Record43Quote)) : undefined;
    if (b.loop && on) { if (b.loop.unit === null || b.loop.stop === null) { const w = words(on); b.loop = { ...b.loop, unit: b.loop.unit ?? w.unit, stop: b.loop.stop ?? w.stop, program: true }; } continue; }
    const { unit, stop } = words(outer); if (!unit && !stop) continue;
    // review N1: the model's own loop given way to the row is said (an earlier program loop is the program's to replace).
    if (b.loop && !b.loop.program) { const q = outer.quote as Record43Quote; diag('loop-replaced', 'C-LOOP', q.record, q.from, q.to); }
    b.loop = { unit, stop, resume: null, quote: outer.quote, program: true };
  }
  /* Recipe .45 (13.7c): the supplementary rows that say how a part works land on that part, each on its row, as the program's: a P1-02
   * chain's stages as steps of the part that owns the chain (its entry's or contract's part, or the part a stage names 「부분: 단계」), a
   * P2-02 extension point as a step of its owner, a P5-03 failure row as a condition (실패 조건 → 재시도, else the recovery place) of the
   * part its job or step names, P6-01 settings and P6-02 precedence as settings of the part they apply to. Words that read like a key never
   * land; nothing past the reading's bounds is added. */
  supplementary({ parts, v4, byName, rowQuote, partOfRef: (record, b) => partOfRef(record, b) });
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
    const together = fixedWord(r.byColumn['함께 사용 가능 여부'] ?? '', (r.dialect === 'v5' ? TOGETHER_WORDS_V5 : TOGETHER_WORDS) as Readonly<Record<string, VariantTogether>>), sel = r.byColumn['선택 주체·시점'] ?? '';
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
      mode: null, channel: 'control', payloadFields: [], when: null, optional: false, variantRef: null, crosses: null, cadenceKind: null, payloadRef: null, via: null, member: null });
  }
  /* .44: the record's own lines the reply left undrawn (a C-LINK row naming both ends; a C-DATA row's 만드는 부분 → 읽는 부분), each on its
   * row, so a line the record writes never goes missing between the stages: a stored file goes maker → its store part → reader, anything
   * else maker → reader. A line the reply draws between the same ends (or around the store) stands; a maker → reader pair the reply
   * already joins through a third part is not drawn again (product-shortcut); a store part is never the maker or reader of a memory
   * line. The 넘기는 것 or the row's name is the payload, the row's 필드·모양 the fields. */
  const links = v4(['C-LINK']), dataRows = v4(['C-DATA']);
  // review N5: a D ID names the C-DATA row of its own record (the same text first, then the other chunks of the same record ID), never
  // the same ID of another record (a later record's IDs start again at D01). The record ID is the chunk head's, or (a head the reader
  // does not take, 「〔기록 R-x · 덩이 2 · fb88a1b〕」 without 기준) the ID its first line opens with.
  const group = (record: string): string => {
    const id = read.get(record)?.chunk?.recordId ?? /^\s*〔\s*기록\s+([^\s·〕]+)/.exec(texts.get(record)?.text ?? '')?.[1];
    return id ? `id:${id}` : `record:${record}`;
  };
  const dataById = (id: string, record: string): TableRow | undefined => {
    const hit = (r: TableRow) => (r.byColumn['행 ID'] ?? '').trim() === id;
    return dataRows.find(r => r.record === record && hit(r)) ?? dataRows.find(r => group(r.record) === group(record) && hit(r));
  };
  programLines({ parts, relations, links, dataRows, byName, nameOfPart, rowQuote, dataById, maxLines: ctx.maxLines });
  /* Lines (C-LINK): 조건·선택, 경계, 박자, the D row named first, 통로, the list item. */
  // Review D2: whether a part's own C-STEP rows (their part by row ID) or C-COND rows (their 부분) write one of a condition's code words.
  let ownRows: { part: Part43; text: string }[] | undefined;
  const readerChecks = (b: Part43 | undefined, condition: string): boolean => {
    if (!b) return false;
    const words = codeWords(condition); if (!words.length) return false;
    ownRows ??= [...v4(['C-STEP']).flatMap(r => { const p = byName(r.cells[0] ?? ''); return p ? [{ part: p, text: r.cells.slice(1).join(' | ') }] : []; }),
      ...v4(['C-COND']).flatMap(r => partsInCell(r.byColumn['부분'] ?? '', byName).map(p => ({ part: p, text: [r.byColumn['조건'] ?? '', r.byColumn['참이면'] ?? '', r.byColumn['거짓이면'] ?? ''].join(' | ') })))];
    return ownRows.some(x => x.part === b && words.some(w => x.text.includes(w)));
  };
  for (const l of relations) {
    if (!l.span) continue;
    const r = links.find(x => overlaps({ record: l.record, from: l.span!.from, to: l.span!.to }, x)); if (!r) continue;
    const choice = said(r.byColumn['조건·선택']), variant = choice ? /^변형\s*(X\d{1,3})\b/.exec(choice) : null;
    // Recipe .45 (13.7b): a line out of a store part standing on a row that store does not send (the reader's half of a writer's row,
    // maker → store → reader) never takes the writer's condition: the 조건·선택 is the sender's.
    // A row whose sender is its receiver too (a part writing a file it reads back) keeps its condition on the read.
    const senders = partsInCell((r.byColumn['보내는 부분'] ?? '').replace(/\s*:\s*.+$/, ''), byName), receivers = partsInCell((r.byColumn['받는 부분'] ?? '').replace(/\s*:\s*.+$/, ''), byName);
    const from = parts.find(b => b.ref === l.from), self = senders.some(s => receivers.includes(s));
    const storeHalf = !!from && (from.type === 'store' || from.family === 'store') && !senders.includes(from) && !self;
    // Review D2: the reader's own check stays on its half: a condition whose code words (os.path.exists, plan_path) the reader's own
    // C-STEP or C-COND rows write is the reader's, not only the writer's (a planner's 「os.path.exists(plan_path)」 on its own step).
    const readerOwn = storeHalf && choice !== null && !variant && readerChecks(parts.find(b => b.ref === l.to), choice);
    const writerHalf = storeHalf && !readerOwn;
    l.optional = choice !== null && !writerHalf; l.variantRef = variant && !writerHalf ? variant[1]! : null; l.when = choice && !variant && !writerHalf ? cut(choice, 120) : null;
    // Recipe .45 (12.2): a v5 row's 주장 성격 and cites; its mode is observed only for 실행 관측 with a run-grade cite (the view's 설계/관찰).
    if (r.dialect === 'v5') {
      l.claimNature = fixedWord(r.fold?.row.byColumn['주장 성격'] ?? '', NATURE_WORDS)?.value ?? null; l.cites = citesCut(r.fold?.cites ?? []);
      l.mode = r.byColumn['설계/관찰'] === '관찰' ? 'observed' : r.byColumn['설계/관찰'] === '설계' ? 'design' : null;
    }
    l.crosses = fixedWord(r.byColumn['경계'] ?? '', CROSS_WORDS)?.value ?? null; l.cadenceKind = fixedWord(r.byColumn['박자'] ?? '', CADENCE_WORDS)?.value ?? null;
    const what = r.byColumn['넘기는 것'] ?? ''; l.payloadRef = /^\s*(D\d{1,3})\b/.exec(what)?.[1] ?? null;
    const via = /통로\s*[:：]\s*(.+)$/.exec(what)?.[1]; l.via = via ? cut(via, 80) : null;
    for (const [cell, ref] of [[r.byColumn['보내는 부분'] ?? '', l.from], [r.byColumn['받는 부분'] ?? '', l.to]] as const) {
      const m = /^(.+?)\s*:\s*(.+)$/.exec(cell.trim()), part = parts.find(b => b.ref === ref), name = part ? nameOfPart(part) : ctx.nameOf(ref);
      if (m && plain(m[1]!) === plain(name)) { l.member = cut(m[2]!, 60); break; }
    }
  }
  // .44: a data line with no fields of its own takes those of the C-DATA row it carries (its D ref) or stands on, as the row lists them.
  for (const l of relations) {
    if ((l.payloadFields ?? []).length || l.channel === 'control' || l.channel === 'uses') continue;
    const row = (l.payloadRef ? dataById(l.payloadRef, l.record) : undefined)
      ?? (l.span ? dataRows.find(r => overlaps({ record: l.record, from: l.span!.from, to: l.span!.to }, r)) : undefined);
    const fields = row ? fieldsOf(row.byColumn['필드·모양'] ?? '') : [];
    // review N4: a cell that reads like a key or token is never put on a line (the line's words are checked as the reply's).
    if (fields.length && !fields.some(f => secretLike(f))) l.payloadFields = fields;
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
          writeMode: mode ? fixedWord(mode[1]!, WRITE_WORDS)?.value ?? null : null, atomicScope: mode?.[2] ? cut(mode[2], 120) : null, quote: q, sharedBy: [] });
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

/* ==================== Recipe .45 (map-reading.19, RECORD_ASKS_V5_KO.md 8.3–8.4 as 12 and 13 amend them) ==================== */
/** A v5 record's parts are the program's (8.3): every current C-PART row is a part, joined to the model's part by name (record43) or by
 * the row its basis stands on (record45). A row no part of the reply takes is added before record43 runs, as the program's part: its
 * name and 하는 일 as written, the row its only basis, nothing else said for it (record43 then reads its row's fields like any part's).
 * Never past MAP6_NEW_PARTS new parts. Returns the parts added. */
export function record45Parts(ctx: { texts: Texts; parts: Part43[]; onMaterial: (q: Record43Quote) => boolean; maxNew: number }): Part43[] {
  // Review N5: the parts of the latest v5 record only (a record of an earlier basis no longer stands: a part its newer pages dropped stays out).
  const f = latestFold45(ctx.texts, foldPages([...ctx.texts].map(([record, { text }]) => ({ record, text })), 'newest-first')); if (!f) return [];
  const added: Part43[] = [], plainOf = (b: Part43) => plain(bare(b.name ?? ''));
  let fresh = ctx.parts.filter(b => /^new:/.test(b.ref)).length;
  const rows = (f.rows.get('C-PART') ?? []).flatMap(r => {
    const name = cut(bare(r.row.byColumn['이름'] ?? ''), 60); if (!name || secretLike(name)) return [];
    const text = ctx.texts.get(r.record)?.text; if (text === undefined) return [];
    const q: Record43Quote = { record: r.record, quote: text.slice(r.row.from, Math.min(r.row.to, r.row.from + 600)), from: r.row.from, to: Math.min(r.row.to, r.row.from + 600) };
    return ctx.onMaterial(q) ? [] : [{ r, name, q }];
  });
  // Any row the ID stood on (a row 교체 later replaced) is the ID's too.
  const stood = (r: FoldRow) => f.history.get(rowKey(r.table, r.id)) ?? [r];
  const within = (r: FoldRow) => (x: { record: string; from?: number; to?: number }) => x.from !== undefined && x.to !== undefined && stood(r).some(h => x.record === h.record && h.row.from <= x.from! && x.to! <= h.row.to + 1);
  const onRow = (r: FoldRow) => (x: { record: string; from?: number; to?: number }) => stood(r).some(h => overlaps(x, { record: h.record, from: h.row.from, to: h.row.to }));
  const taken = (id: string) => ctx.parts.some(b => b.recordRef === id);
  const open = (b: Part43) => b.name !== null && !b.recordRef;
  // 8.3 (review N4): a v5 part is joined to its C-PART row by ID first: the model's part whose basis stands within the row (the one of the
  // row's name first); then by name; then a part whose basis meets the row. A row no part takes becomes the program's part.
  for (const { r, name } of rows) {
    if (taken(r.id)) continue;
    const on = ctx.parts.filter(b => open(b) && (b.basis ?? []).some(within(r))), b = on.find(x => plainOf(x) === plain(name)) ?? on[0];
    if (b) b.recordRef = r.id;
  }
  for (const { r, name, q } of rows) {
    if (taken(r.id)) continue;
    const b = ctx.parts.find(x => open(x) && plainOf(x) === plain(name)) ?? ctx.parts.find(x => open(x) && (x.basis ?? []).some(onRow(r)));
    if (b) { b.recordRef = r.id; continue; }
    // A part of the row's name the ID join gave another row stays unjoined (record45 says it); the row is not added again under its name.
    if (ctx.parts.some(x => x.name !== null && plainOf(x) === plain(name))) continue;
    if (fresh >= ctx.maxNew) continue;
    const role = opt(r.row.byColumn['하는 일 한 줄'], 300);
    const ref = `new:rec-${r.id.toLowerCase()}`; if (ctx.parts.some(x => x.ref === ref)) continue;
    const p = { ref, name, parent: null, role: role && !secretLike(role) ? role : null, roleAbout: null, roleReplaces: null, basis: [q], claims: [], state: null, stateQuote: null, stateWhen: null,
      files: [], type: null, typeQuote: null, inputs: [], outputs: [], fields: [], config: [], steps: [], loop: null, stateVars: [], conditions: [], fileRoles: [], recordRef: r.id } as Part43;
    ctx.parts.push(p); added.push(p); fresh++;
  }
  return added;
}
/** A v5 record's level, pages and obligations as a reading keeps them (map-reading.19 bounds). Recipe .47: applyReading takes them from
 * the fold of every pasted text of the record in the project, so a reading whose ask left rows out still says the whole record's. */
export function foldLevel(f: FoldedRecord): Pick<Reading45, 'level' | 'pages' | 'obligations'> {
  return { level: f.level, pages: f.pages.slice(0, RECORD43_MAX.pages).map(p => ({ recordId: f.recordId, n: p.n, prev: p.prev, hash: p.hash, conflict: p.conflict })),
    obligations: f.obligations.slice(0, RECORD43_MAX.obligations).map(o => ({ kind: o.kind, table: o.table, ref: o.ref ? cut(o.ref, 40) : null, text: cut(o.text, 120), candidate: o.candidate })) };
}
/** Recipe .47: the fold's own diagnostics a reading may keep (row-cells is the table reader's too, and stays where record43 said it). */
export const FOLD_DIAGNOSTICS: ReadonlySet<string> = new Set([...STORED_DIAGNOSTICS].filter(c => ['page-conflict', 'page-gap', 'page-prev', 'duplicate-id', 'replace-unknown', 'id-reused', 'row-id',
  'out-of-order', 'reserve-unused', 'dangling-ref', 'ref-deleted', 'end-mismatch', 'level-mismatch', 'cite-missing', 'cite-equals', 'cite-unread', 'cite-word', 'grade-source', 'part-added', 'drop-unknown'].includes(c)));
export const RECORD_DIAGNOSTICS_MAX = RECORD43_MAX.recordDiagnostics;
/** The fold the newest of the texts belongs to: the v5 record that stands now. The ask lists its records newest first (N01 the newest,
 * buildMapAsk), so the fold with a page in the earliest-listed record. (Review N5: the .45 pass took the last-listed one, the oldest.) */
function latestFold45(texts: Texts, folds: FoldedRecord[]): FoldedRecord | null {
  const order = [...texts.keys()]; let best: FoldedRecord | null = null, at = Infinity;
  for (const f of folds) for (const p of f.pages) { const i = order.indexOf(p.record); if (i >= 0 && i < at) { at = i; best = f; } }
  return best;
}
/** The family a v3 or v4 part's type word gives (the generic tail of record45: a part no v5 or v4 row gave a family). */
const TYPE_FAMILY: Readonly<Record<PartType, { family: RecordFamily; role: string } | null>> = { person: { family: 'participant', role: '사람' }, session: { family: 'participant', role: '세션' },
  compute: { family: 'process', role: '계산' }, collector: { family: 'process', role: '수집' }, ai: { family: 'process', role: 'AI 판단' }, screen: { family: 'process', role: '화면' },
  store: { family: 'store', role: '행 파일' }, timer: { family: 'trigger', role: '타이머' }, automation: { family: 'trigger', role: '빌드·배포 자동화' }, loop: null, external: null, actor: null };
const TYPE_WORD: Readonly<Record<PartType, string>> = { loop: '루프·엔진', external: '외부 시스템', actor: '집행·외부 호출', person: '사람', session: '세션', compute: '계산', collector: '수집기', ai: 'AI 판단',
  screen: '화면', store: '행 파일·저장소', timer: '타이머·일정', automation: '빌드·배포 자동화' };
/** Recipe .45: the program's v5 pass over a checked reply after record43: the parts' joins by row, families, roles, C-STATE rows, list
 * items and cites; the steps', claims' and loops' cites; the v5 record's artifacts, gates-none line, supplementary tables and unknown tables
 * (into read43); and the reading's own .19 fields (level, pages, obligations, page ends, checks, defaults, first lines). A part of no v5
 * row takes its family from its type word (v4 and v3 records: only the unambiguous words; 루프·엔진, 외부 시스템, 집행·외부 호출 are kept
 * as written and marked unclear). */
export function record45(ctx: { texts: Texts; parts: Part43[]; relations: Line43[]; read43: Reading43 | null; onMaterial: (q: Record43Quote) => boolean }): Reading45 {
  const { texts, parts } = ctx;
  const out: Reading45 = { level: null, pages: [], obligations: [], pageEnds: [], checks: [], defaults: [], firstLines: [] };
  const quoteOf = (record: string, from: number, to: number): Record43Quote | null => {
    const text = texts.get(record)?.text; if (text === undefined || from >= to) return null;
    let end = Math.min(to, from + 600); if (end < to && /[\ud800-\udbff]/.test(text[end - 1] ?? '')) end--;
    const q = { record, quote: text.slice(from, end), from, to: end };
    return ctx.onMaterial(q) ? null : q;
  };
  const rowQ = (r: FoldRow) => quoteOf(r.record, r.row.from, r.row.to);
  const folds = foldPages([...texts].map(([record, { text }]) => ({ record, text })), 'newest-first');
  const latest = latestFold45(texts, folds);
  const cites6 = citesCut;
  for (const f of folds) {
    const nameOf = (id: string) => (f.byId.get(id)?.row.byColumn['이름'] ?? '').trim() || id;
    const byRef = (id: string) => parts.find(b => b.recordRef === id && f.byId.get(id)?.table === 'C-PART');
    // Parts: a row record43 did not join by name joins the model's part whose basis stands on it.
    for (const r of f.rows.get('C-PART') ?? []) {
      let b = byRef(r.id); const q = rowQ(r); if (!q) continue;
      if (!b) {
        b = parts.find(x => !x.recordRef && x.name !== null && (x.basis ?? []).some(y => (f.history.get(rowKey(r.table, r.id)) ?? [r]).some(h => overlaps(y, { record: h.record, from: h.row.from, to: h.row.to }))));
        if (!b) continue;
        b.recordRef = r.id; const t = roleType(r.row.byColumn['표현군·역할'] ?? '', partStructure(f, r.id)); b.type = t as PartType | null; b.typeQuote = t ? q : null;
        const impl = fixedWord(r.row.byColumn['구현 상태'] ?? '', IMPLEMENTATION_WORDS); b.implementation = impl?.value ?? null; b.implementationQuote = impl?.value ? q : null;
      }
      familyOn(b, r.row.byColumn['표현군·역할'] ?? '', q, r.mark === 'add'); b.cites = cites6(r.cites);
    }
    // C-STATE rows (13.6) on the part that owns them.
    for (const r of f.rows.get('C-STATE') ?? []) {
      const owner = partRefs(r.row.byColumn['소유 부분'])[0], b = owner ? byRef(owner) : undefined, q = rowQ(r), name = opt(r.row.byColumn['상태'], 60);
      if (!b || !q || !name || (b.states ??= []).length >= RECORD43_MAX.states || [name, r.row.byColumn['전이 사건'] ?? '', r.row.byColumn['다음 상태'] ?? ''].some(w => secretLike(w))) continue;
      b.states.push({ name, event: opt(r.row.byColumn['전이 사건'], 80), next: opt(r.row.byColumn['다음 상태'], 60), quote: q });
    }
    // 13.7d: a C-GROUP 목록 row is its parent's list of items, never parts (record43 reads C-PART's 「항목 N」 rows; a v5 row needs none).
    for (const r of f.rows.get('C-GROUP') ?? []) {
      if (fixedWord(r.row.byColumn['묶음 뜻'] ?? '', GROUP_WORDS)?.value !== 'members') continue;
      const owner = partRefs(r.row.byColumn['부모'])[0], b = owner ? byRef(owner) : undefined, q = rowQ(r); if (!b || !q || b.members) continue;
      const items = (r.row.byColumn['자식들'] ?? '').split(/\s*·\s*(?=B\d{1,3}\s*:)|\s+·\s+|\s*,\s*/).map(x => cut(x.replace(/^B\d{1,3}\s*:\s*/, '').trim(), 60)).filter(x => x && !secretLike(x));
      if (items.length) b.members = { count: items.length, ordered: null, items: [...new Set(items)].slice(0, RECORD43_MAX.members), quote: q };
    }
    // Cites of the steps, claims and lines on v5 rows (record43 gave lines theirs).
    // Recipe .48: the claim's own row: the one its quote opens on (a quote running into the next row never takes that row's cells).
    const rowAt = (q: { record: string; from?: number; to?: number }) => {
      const hits = [...f.byKey.values()].filter(r => overlaps(q, { record: r.record, from: r.row.from, to: r.row.to }));
      return hits.find(r => q.from !== undefined && r.row.from <= q.from && q.from < r.row.to) ?? hits.sort((a, b) => a.row.from - b.row.from)[0];
    };
    for (const b of parts) {
      for (const s of b.steps ?? []) { const r = s.recordRef ? f.byId.get(s.recordRef) : undefined; if (r) s.cites = cites6(r.cites); }
      for (const c of b.claims) { const r = rowAt(c); if (r) { c.cites = cites6(r.cites); ledgerOn(c, r); ruleStance(c, r); } }
    }
    // The v5 record's own artifacts (C-DATA, 13.3 shared data), gates checked as none, supplementary tables and unknown tables.
    const r43 = ctx.read43;
    if (r43) {
      for (const r of f.rows.get('C-DATA') ?? []) {
        const q = rowQ(r), c = r.row.byColumn, name = (c['이름'] ?? '').trim(); if (!q || !name || r43.artifacts.length >= RECORD43_MAX.artifacts) continue;
        const where = c['있는 곳·쓰기 방식'] ?? '', mode = /[(（]\s*(덧붙임|통째\s*교체|원자\s*교체)\s*(?:[:：,·]\s*([^)）]+))?[)）]\s*$/.exec(where), shape = c['필드·모양'] ?? '';
        const shared = /^\s*공유\s*[:：]\s*(.+)$/.exec(c['만드는 부분'] ?? '') ?? /^\s*공유\s*[:：]\s*(.+)$/.exec(c['읽는 부분'] ?? '');
        r43.artifacts.push({ recordRef: r.id, name: cut(name, 80), kind: fixedWord(c['종류'] ?? '', DATA_WORDS)?.value ?? null, contractRef: /\bK\d{1,3}\b/.exec(c['종류'] ?? '')?.[0] ?? null,
          shape: said(shape) && !/[·,]/.test(shape) ? cut(shape, 120) : null, fieldsMore: Number(/그\s*밖\s*(\d+)\s*개/.exec(shape)?.[1] ?? NaN) || null,
          where: said(mode ? where.slice(0, mode.index) : where) ? cut(mode ? where.slice(0, mode.index) : where, 120) : null,
          writeMode: mode ? fixedWord(mode[1]!, WRITE_WORDS)?.value ?? null : null, atomicScope: mode?.[2] ? cut(mode[2], 120) : null, quote: q,
          sharedBy: shared ? partRefs(shared[1]).map(id => cut(nameOf(id), 60)).slice(0, RECORD43_MAX.sharedBy) : [] });
      }
      for (const p of f.pages) {
        const t = readRecordTables(texts.get(p.record)?.text ?? '');
        for (const table of t.tables) {
          if (table.dialect !== 'v5' || table.from < p.from || table.from >= p.to) continue;
          if (table.id === 'C-GATE' && table.none && !r43.gatesNone) { const q = quoteOf(p.record, table.none.from, table.none.to); if (q) r43.gatesNone = { reason: cut(table.none.text || '없음', 200), quote: q }; }
          if (!table.known && r43.recordExtras.length < RECORD43_MAX.recordExtras) {
            const rows = table.rows.slice(0, RECORD43_MAX.profileRows).flatMap(r => { const q = quoteOf(p.record, r.from, r.to); return q ? [{ cells: r.cells.slice(0, RECORD43_MAX.profileCells).map(c => cut(c.text, 200)), quote: q }] : []; });
            r43.recordExtras.push({ table: table.id.slice(0, 12), header: table.header.slice(0, RECORD43_MAX.profileCells).map(h => cut(h || '—', 40)), rows });
          }
        }
      }
      for (const [table, rows] of f.rows) {
        if (!/^P\d-\d{2}$/.test(table) || r43.profileTables.length >= RECORD43_MAX.profileTables || r43.profileTables.some(x => x.table === table)) continue;
        const header = rows[0]!.source.header.slice(0, RECORD43_MAX.profileCells).map(h => cut(h || '—', 40));
        r43.profileTables.push({ table, header, none: null, rows: rows.slice(0, RECORD43_MAX.profileRows).flatMap(r => { const q = rowQ(r); return q ? [{ cells: r.row.cells.slice(0, RECORD43_MAX.profileCells).map(c => cut(c.text, 200)), recordRef: /^P\d-\d{2}\.\d{1,3}$/.test(r.id) ? r.id : null, quote: q }] : []; }) });
      }
      if (f === latest) {
        // C-HEAD: what the record says it read and could not read (basisScope), its defaults (never claims) and its first lines.
        const head = (item: string) => f.head.get(item), read = head('읽은 범위'), unread = head('못 읽은 범위');
        const rq = read ? rowQ(read) : null, scope = read ? said(read.row.byColumn['값']) : null, gap = unread ? said(unread.row.byColumn['값']) : null;
        if (rq && scope && !r43.basisScope) r43.basisScope = { text: cut(`${scope}${gap ? ` · 못 읽음: ${gap}` : ''}`, 200), quote: rq };
      }
      for (const d of f.diagnostics) if (r43.recordDiagnostics.length < RECORD43_MAX.recordDiagnostics && d.from < d.to && texts.has(d.record) && STORED_DIAGNOSTICS.has(d.category))
        r43.recordDiagnostics.push({ category: d.category as ReadingRecordDiagnostic['category'], table: d.table, column: null, record: d.record, from: d.from, to: d.to });
    }
    if (f !== latest) continue;
    Object.assign(out, foldLevel(f));
    for (const e of f.ends) { const q = quoteOf(e.record, e.from, e.to); if (q && out.pageEnds.length < RECORD43_MAX.pageEnds && /^(?:C-[A-Z]{2,12}|P\d(?:-\d{2})?)$/.test(e.table))
      out.pageEnds.push({ recordId: f.recordId, page: e.page, table: e.table, state: e.state, written: e.written.slice(0, 64).map(x => cut(x, 16)), reserved: e.reserved.map(x => cut(x.id, 16)).slice(0, 16), remaining: e.remaining ? cut(e.remaining, 120) : null, quote: q }); }
    for (const r of f.rows.get('C-CHECK') ?? []) {
      const q = rowQ(r); if (!q || out.checks.length >= RECORD43_MAX.checks) continue;
      const found = [...new Set((r.row.byColumn['찾은 것'] ?? '').match(/(?<![A-Za-z0-9])(?:B\d{1,3}(?::[SL]\d{1,3}[a-z]?)?|[A-Z]{1,2}\d{1,3})(?![\dA-Za-z])/g) ?? [])].slice(0, 16);
      const method = opt(r.row.byColumn['찾은 방법'], 120);
      out.checks.push({ id: r.id, result: fixedWord(r.row.byColumn['결과'] ?? '', CHECK_WORDS)?.value ?? null, found, method: method && !secretLike(method) ? method : null, quote: q });
    }
    for (const [item, r] of f.head) {
      const q = rowQ(r), value = opt(r.row.byColumn['값'], 120); if (!q || !value || secretLike(value)) continue;
      if (item === '첫 구조 줄') out.firstLines = value.split(/\s+·\s+|\s*\/\s*|\s*;\s*/).map(x => cut(x.trim(), 80)).filter(Boolean).slice(0, RECORD43_MAX.firstLines);
      else if (out.defaults.length < RECORD43_MAX.defaults) out.defaults.push({ item: cut(item, 20), value, quote: q });
    }
  }
  // Review N4 (8.3): in a v5 record the parts are the C-PART rows': a model part standing on no row (no row ID joined, by ID or name) is said
  // (part-no-row, where its first basis stands); a group's parent (a C-GROUP 부모, a part with children of its own) is no such part.
  if (latest && ctx.read43) {
    const parents = new Set([...(latest.rows.get('C-GROUP') ?? []).map(g => plain(bare(g.row.byColumn['부모'] ?? ''))), ...parts.flatMap(b => b.parent ? [b.parent] : [])]);
    for (const b of parts) {
      if (b.recordRef || b.name === null || /^new:rec-/.test(b.ref) || parents.has(b.ref) || parents.has(plain(bare(b.name)))) continue;
      const q = (b.basis ?? []).find(x => x.from !== undefined && x.to !== undefined && texts.has(x.record));
      if (q && ctx.read43.recordDiagnostics.length < RECORD43_MAX.recordDiagnostics && q.from! < q.to!)
        ctx.read43.recordDiagnostics.push({ category: 'part-no-row', table: 'C-PART', column: null, record: q.record, from: q.from!, to: q.to! });
    }
  }
  // Recipe .48 fix (A7): a C-GROUP 구성 or 목록 row (never 실행 위치, 참여자 or 외부: a place, the people taking part or a boundary is no
  // containment) whose 부모 is one part's B ID is its children's parent, over a parent the reply gave (a model parent never overrides an
  // explicit group); none is set for a child two rows give different parents, nor one that would make a part its own ancestor
  // (groupParentIssues says each of these, and where the reply's own parent was replaced).
  if (latest) {
    const links = groupParents(latest, parts), many = new Set(links.filter(g => links.some(h => h.child === g.child && h.parent !== g.parent)).map(g => g.child));
    for (const g of links) if (!many.has(g.child) && g.child.parent !== g.parent.ref && !ancestorOf(parts, g.child.ref, g.parent.ref)) {
      if (g.child.parent) REPLACED_PARENT.set(g.child, g.child.parent);
      g.child.parent = g.parent.ref;
    }
  }
  // Every part with no family yet: from its type word, the unambiguous ones only (a v4 or v3 record; 12.3).
  for (const b of parts) {
    if (b.family !== undefined || b.familyRole !== undefined || !b.type || !b.typeQuote) continue;
    const m = TYPE_FAMILY[b.type]; b.family = m?.family ?? null; b.familyRole = m?.role ?? TYPE_WORD[b.type]; b.familyUnclear = !m; b.familyReason = null; b.familyQuote = b.typeQuote as Record43Quote;
  }
  return out;
}
/** .44: the fields a C-DATA 필드·모양 cell lists (24 of 60 at most): its items split on 「,」 or 「·」 outside brackets, a leading 「type:」 left off,
 * each without a space outside its brackets and within 60; [] for a cell that names a shape, a contract (K02) or one thing.
 * Review N3: [] too for a list the record cut (「…, 그 밖 11개」: a line has no place for the count, and a part of a list read whole
 * would say the line carries those fields only) and for a list of file formats (「.md·.pdf·.docx」 are kinds of file, not fields). */
export function fieldsOf(cell: string): string[] {
  // An evidence tag (「[파일: …]」, 「[추정]」) is left off; a code bracket (「rows[]」, 「map[str]」) stays.
  const t0 = cell.replace(/\[[^\]]*[가-힣:：][^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim(); if (!said(t0) || /^K\d{1,3}$/.test(t0)) return [];
  if (/그\s*밖\s*\d+\s*개/.test(t0)) return [];
  let t = t0;
  const head = /^[^:：,·(){}\s]{1,40}[:：]\s*(?=\S)/.exec(t); if (head) t = t.slice(head[0].length);
  const items: string[] = []; let depth = 0, cur = '';
  for (const ch of t) {
    if ('([{'.includes(ch)) depth++; else if (')]}'.includes(ch)) depth = Math.max(0, depth - 1);
    if (depth === 0 && (ch === ',' || ch === '·')) { items.push(cur.trim()); cur = ''; } else cur += ch;
  }
  items.push(cur.trim());
  const outside = (s: string) => s.replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g, '');
  const list = [...new Set(items.filter(x => x && !/^\*?\.[a-z0-9]{1,6}$/i.test(x)))];
  if (list.length < 2 || list.some(x => x.length > 60 || /\s/.test(outside(x)) || /[{}]/.test(outside(x)))) return [];
  return list.slice(0, 24);
}
/** .44: what each C-VARIANT ID of a reading stands for, as its row writes it: the implementing part and the choice condition
 * (「펌프 · PUMP=relay」), by ID. The first row of an ID speaks for it. */
export function variantGloss(variants: Iterable<{ recordRef: string; implementer: string; condition: string | null }>): Map<string, string> {
  const out = new Map<string, string>();
  for (const v of variants) if (!out.has(v.recordRef)) out.set(v.recordRef, cut(`${v.implementer === 'user' ? '사용자 지정' : v.implementer}${v.condition ? ` · ${v.condition}` : ''}`, 80));
  return out;
}
/** .44: a text with every variant ID it names followed by what the variant is (「then=X01」 → 「X01(펌프 · PUMP=relay)」); an
 * ID the gloss does not know, and one already glossed, stay as written. Display only: the stored words are never changed. */
export function glossVariants(text: string, gloss: ReadonlyMap<string, string>): string {
  if (!gloss.size) return text;
  return text.replace(/\bX\d{1,3}\b(?!\s*[(（])/g, id => gloss.has(id) ? `${id}(${gloss.get(id)})` : id);
}
/** Recipe .48 fix: the axes a C-GROUP row may turn into parents (구성, 목록): containment; 실행 위치, 참여자, 외부 and 모름 never are. */
const PARENT_AXES: ReadonlySet<string> = new Set(['composition', 'members']);
/** Recipe .48 fix: the reply's own parent a C-GROUP row replaced (by part), for the diagnostic. */
const REPLACED_PARENT = new WeakMap<object, string>();
/** Recipe .48: the parent each v5 C-GROUP row gives its children: a 구성 or 목록 row (PARENT_AXES) whose 부모 cell is one B ID of a C-PART row,
 * each child B ID of its 자식들 cell (the parent itself left out), as the parts that stand on those rows ({ row, parent, child }). */
export function groupParents(f: FoldedRecord, parts: readonly Part43[]): { row: string; parent: Part43; child: Part43 }[] {
  const byRef = (id: string) => f.byId.get(id)?.table === 'C-PART' ? parts.find(b => b.recordRef === id) : undefined, out: { row: string; parent: Part43; child: Part43 }[] = [];
  for (const r of f.rows.get('C-GROUP') ?? []) {
    const axis = fixedWord(r.row.byColumn['묶음 뜻'] ?? '', GROUP_WORDS)?.value; if (!axis || !PARENT_AXES.has(axis)) continue;
    const cell = (r.row.byColumn['부모'] ?? '').replace(/\s*:\s*.+$/, '').trim();
    if (!/^B\d{1,3}$/.test(cell)) continue;
    const parent = byRef(cell); if (!parent) continue;
    // A 목록 row's items are its parent's items, not parts (「B06: serve(B07)」 names B07 inside an item): only an item that is a B ID whole
    // is a child.
    const kids = axis === 'members' ? (r.row.byColumn['자식들'] ?? '').split(/\s*[·,]\s*/).map(x => x.replace(/^B\d{1,3}\s*:\s*/, '').trim()).filter(x => /^B\d{1,3}$/.test(x))
      : partRefs(r.row.byColumn['자식들']);
    for (const id of new Set(kids)) { const child = id === cell ? undefined : byRef(id); if (child && child !== parent) out.push({ row: r.id, parent, child }); }
  }
  return out;
}
/** Recipe .48 fix (diagnostic, group-parent): what the latest v5 record's C-GROUP rows say of parents that the read reply does not simply
 * take: a row that lists its own parent among its children (「GR01: B03 안에 자기 자신」), a child two rows give different parents
 * (「B05: 부모 둘 B01(GR01) · B02(GR03)」, none set), a parent a cycle kept out (「GR02: B04 → B07 순환」), and a parent the reply gave that the
 * row replaced (「GR04: B09 → B03 (모델 부모 B12 대신)」). */
export function groupParentConflicts(texts: Texts, parts: readonly Part43[]): string[] {
  const latest = latestFold45(texts, foldPages([...texts].map(([record, { text }]) => ({ record, text })), 'newest-first')); if (!latest) return [];
  const out: string[] = [], links = groupParents(latest, parts);
  for (const r of latest.rows.get('C-GROUP') ?? []) {
    const axis = fixedWord(r.row.byColumn['묶음 뜻'] ?? '', GROUP_WORDS)?.value, cell = (r.row.byColumn['부모'] ?? '').replace(/\s*:\s*.+$/, '').trim();
    if (axis && PARENT_AXES.has(axis) && /^B\d{1,3}$/.test(cell) && axis !== 'members' && partRefs(r.row.byColumn['자식들']).includes(cell)) out.push(`${r.id}: ${cell} 안에 자기 자신`);
  }
  const seen = new Set<Part43>();
  for (const g of links) {
    const others = links.filter(h => h.child === g.child && h.parent !== g.parent);
    if (others.length) { if (!seen.has(g.child)) { seen.add(g.child); out.push(`${g.child.ref}: 부모 둘 ${[g, ...others].map(h => `${h.parent.ref}(${h.row})`).join(' · ')}`); } continue; }
    if (g.child.parent !== g.parent.ref) out.push(`${g.row}: ${g.child.ref} → ${g.parent.ref} 순환 (지도: ${g.child.parent ?? '없음'})`);
    else if (REPLACED_PARENT.has(g.child)) out.push(`${g.row}: ${g.child.ref} → ${g.parent.ref} (모델 부모 ${REPLACED_PARENT.get(g.child)} 대신)`);
  }
  return out;
}
/** Whether `ancestor` is `ref` or stands above it among the parts (by parent refs, a chain of at most the parts' count). */
function ancestorOf(parts: readonly Part43[], ancestor: string, ref: string): boolean {
  let at: string | null | undefined = ref;
  for (let k = 0; at && k <= parts.length; k++) { if (at === ancestor) return true; at = parts.find(b => b.ref === at)?.parent; }
  return false;
}
/** Recipe .48: the column of a v5 table that dates its row (C-CHANGE 날짜, C-RULE 정한 이·언제, C-ISSUE 언제부터, C-GATE 언제쯤). */
const DATE_COLUMNS: Readonly<Record<string, string>> = { 'C-CHANGE': '날짜', 'C-RULE': '정한 이·언제', 'C-ISSUE': '언제부터', 'C-GATE': '언제쯤' };
const DATE = /(?<!\d)(\d{4}-\d{2}(?:-\d{2})?)(?!\d)/;
/** Recipe .48 fix: how far each grade carries (a run and a file read alike; a report below them; a guess, then unknown, below that). */
const GRADE_RANK: Readonly<Record<EvidenceGrade, number>> = { run: 3, file: 3, report: 2, guess: 1, unknown: 0 };
/** Recipe .48 fix (review B1): what a v5 row's own cites give a claim on it. none: the row cites nothing (no cite); unresolved: a cite the
 * app could not read (a word no cite reads, an ID neither ledger holds, 「=」); mixed: graded cites (a read F, a graded E) beside a guess,
 * 모름 or an unread file, which gives no grade; graded: the lowest grade of its cites (all graded, or all guess and unknown). */
export type LedgerState = 'none' | 'unresolved' | 'mixed' | 'graded';
export function rowGrade(r: Pick<FoldRow, 'cites' | 'citeProblems'>): { state: LedgerState; grade: EvidenceGrade | null } {
  if ((r.citeProblems ?? []).some(k => k === 'cite-word' || k === 'cite-missing' || k === 'cite-equals')) return { state: 'unresolved', grade: null };
  if (!r.cites.length) return { state: 'none', grade: null };
  const strong = r.cites.filter(x => x.grade === 'file' || x.grade === 'run' || x.grade === 'report'), weak = r.cites.filter(x => x.grade === 'guess' || x.grade === 'unknown');
  if (strong.length && weak.length) return { state: 'mixed', grade: null };
  const grades = r.cites.map(x => x.grade as EvidenceGrade), low = Math.min(...grades.map(g => GRADE_RANK[g]));
  const at = grades.filter(g => GRADE_RANK[g] === low);
  return { state: 'graded', grade: at.every(g => g === at[0]) ? at[0]! : at.includes('file') ? 'file' : at[0]! };
}
/** Recipe .48 fix (N1): a claim that says the record could not confirm it (an open question, topic unknown, 「확인하지 못했다」, 「일부만
 * 읽」, 「읽지 못」, the claim one sentence): the ledger never gives it a file, run or report grade the reply did not. A detail left unknown
 * inside a claim that states something (「병합한 사람은 모른다」, 「계약 변화는 모름이다」, a second sentence 「이슈 본문은 확인하지 못했다」)
 * does not make the claim unconfirmed. */
const UNCONFIRMED = /확인하지\s*못|확인\s*못\s*했|확인되지\s*않았|확인\s*안\s*(?:함|됨|했)|일부만\s*읽|읽지\s*못/;
const unconfirmed = (c: Claim43): boolean => c.kind === 'open' || c.topic === 'unknown'
  || (UNCONFIRMED.test(c.text ?? '') && (c.text ?? '').trim().split(/(?<=[.。])\s+/).filter(Boolean).length === 1);
/** Recipe .48 fix: the ledger's outcome on each claim it read (by claim object), for the final diagnostics (grade-no-cite, grade-unresolved). */
const LEDGER = new WeakMap<object, { row: string; state: LedgerState; from: EvidenceGrade | null; to: EvidenceGrade | null }>();
export const ledgerOf = (c: object) => LEDGER.get(c) ?? null;
/** Recipe .48 fix (review B2): a date cell's date phrase whole: a pair (「2024-01-26 / 2024-02-27」, 작성 / 병합), a range (「2023-07-13 –
 * 2026-09-26」, 「~」), its qualifier (이후, 이전, 전, 경, 쯤, 부터, 까지) and a short bracketed note right after it (「(최근 2개)」), within the
 * claim's 40 (the words around it, 「메인테이너·」, are not the date); past 40 the first date with its qualifier only; null for no date. */
export function datePhrase(cell: string): string | null {
  const t = cell.replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim(); if (!DATE.test(t)) return null;
  const D = String.raw`(?<!\d)\d{4}-\d{2}(?:-\d{2})?(?!\d)`, Q = String.raw`(?:\s*(?:이후|이전|전|경|쯤|부터|까지))?`;
  const whole = new RegExp(`${D}${Q}(?:\\s*(?:/|~|～|–|—|\\s-\\s)\\s*${D}${Q})*(?:\\s*[(（][^)）]{1,20}[)）])?`).exec(t)?.[0]?.trim();
  if (whole && whole.length <= 40) return whole;
  return new RegExp(`${D}${Q}`).exec(t)?.[0]?.trim() ?? null;
}
/** Recipe .48 (the evidence ledger, as the .48 review's B1 and B2 fix it): a claim on a v5 row is checked against the row's own cites
 * (rowGrade) and may only be lowered or confirmed, never raised: a grade the reply gave stays when a cite of the row has it or the row's
 * grade is no lower; a lower row grade lowers it; a reply with no grade takes the row's (an unconfirmed claim only a guess or unknown);
 * a row citing nothing, one the app cannot resolve, or one mixing graded and guess or unknown cites sets nothing. Its when: the reply's
 * own when where its row writes it word for word; else, where the row's date column holds a date, that cell's date phrase whole
 * (datePhrase: a pair, a range and a qualifier kept); else none (a date the model took from another row is not kept). */
function ledgerOn(c: Claim43, r: FoldRow): void {
  if (c.topic === undefined) return;
  const model = c.evidence ?? null, { state, grade } = rowGrade(r);
  if (state === 'graded' && grade) {
    if (model === null) { if (!unconfirmed(c) || grade === 'guess' || grade === 'unknown') c.evidence = grade; }
    else if (!r.cites.some(x => x.grade === model) && GRADE_RANK[grade] <= GRADE_RANK[model]) c.evidence = grade;
  }
  LEDGER.set(c, { row: r.id, state, from: model, to: c.evidence ?? null });
  const column = DATE_COLUMNS[r.table], dated = column ? datePhrase(r.row.byColumn[column] ?? '') : null;
  const own = (w: string) => Object.values(r.row.byColumn).some(cell => plain(cell).includes(plain(w)));
  const when = typeof c.when === 'string' && c.when.trim() ? c.when : null;
  c.when = when && own(when) ? when : dated;
}
/** Recipe .48: a rule a code device keeps is what the code does, not a wish: a want claim on a v5 C-RULE row whose 지키는 장치 names 코드
 * or 검사 (alone or with 「+」) and whose cites hold a file read or a run describes (the judged maps showed such rules as [want]). */
function ruleStance(c: Claim43, r: FoldRow): void {
  if (r.table !== 'C-RULE' || c.kind !== 'want') return;
  const coded = (r.row.byColumn['지키는 장치'] ?? '').split('+').some(w => { const v = fixedWord(w.trim(), DEVICE_WORDS)?.value; return v === 'code' || v === 'gate'; });
  if (coded && r.cites.some(x => x.grade === 'file' || x.grade === 'run')) c.kind = 'describes';
}
/** Recipe .45: a part's family from a v5 C-PART 표현군·역할 cell, on its row (nothing for a cell outside the fixed words: the next page
 * asks for it). */
function familyOn(b: Part43, cell: string, q: Record43Quote, added: boolean): void {
  const f = readFamily(cell); b.added = added;
  if (!f.ok) { b.family = null; b.familyRole = null; b.familyReason = null; b.familyUnclear = false; b.familyQuote = null; return; }
  b.family = f.family; b.familyRole = f.role ? cut(f.role, 40) : null; b.familyReason = f.reason; b.familyUnclear = false; b.familyQuote = q;
}
/** Recipe .45 (13.7c, see record43): the supplementary rows that land on parts. */
function supplementary(ctx: { parts: Part43[]; v4: (ids: string[]) => TableRow[]; byName: (name: string) => Part43 | undefined; rowQuote: (r: TableRow) => Record43Quote | null;
  partOfRef: (record: string, b: string) => string | null }): void {
  const { v4, byName, rowQuote } = ctx;
  const p12 = v4(['P1-02']), p22 = v4(['P2-02']), p53 = v4(['P5-03']), p51 = v4(['P5-01']), p61 = v4(['P6-01']), p62 = v4(['P6-02']), entries = v4(['C-ENTRY']), contracts = v4(['C-CONTRACT']);
  const rid = (r: TableRow) => (r.byColumn['행 ID'] ?? '').trim();
  const clean = (s: string | undefined) => bare(s ?? '');
  // 「부분: 나머지」 naming a part, the part a cell names whole, or a step ID's part (B03:S02, a v4 record's own C-PART row ID).
  const partOf = (cell: string | undefined, record: string): { part: Part43 | undefined; rest: string | null } => {
    const t = clean(cell); if (!t) return { part: undefined, rest: null };
    const m = /^(.+?)\s*:\s*(.+)$/.exec(t), step = /^(B\d{1,3}):S\d/.exec(t);
    if (m && byName(m[1]!)) return { part: byName(m[1]!), rest: m[2]!.trim() };
    if (step) { const n = ctx.partOfRef(record, step[1]!); return { part: n ? byName(n) : undefined, rest: null }; }
    return { part: byName(t), rest: null };
  };
  const addStep = (b: Part43, name: string, does: string | null, r: TableRow) => {
    const q = rowQuote(r), steps = b.steps ??= [], n = cut(name, 60), d = does ? cut(does, 120) : null;
    if (!q || !n || steps.length >= RECORD43_MAX.steps || steps.some(s => s.name === n) || secretLike(n) || (d && secretLike(d))) return;
    steps.push({ name: n, does: d, uses: [], quote: q, program: true });
  };
  const addCondition = (b: Part43, when: string, then: string, otherwise: string | null, r: TableRow) => {
    const q = rowQuote(r), list = b.conditions ??= [];
    if (!q || !when || !then || list.length >= RECORD43_MAX.conditions || list.some(c => overlaps(c.quote, q)) || [when, then, otherwise ?? ''].some(w => secretLike(w))) return;
    list.push({ when: cut(when, 80), then: cut(then, 60), else: otherwise ? cut(otherwise, 60) : null, quote: q, phase: null });
  };
  const addConfig = (b: Part43, item: string) => { const c = b.config ??= [], x = cut(item, 80); if (x && c.length < RECORD43_MAX.config && !c.includes(x) && !secretLike(x)) c.push(x); };
  // P1-02: the chain's owner (the entry, contract or first stage it names), each stage a step in its order.
  const owner = (chain: string, record: string, seen = 0): Part43 | undefined => {
    const id = clean(chain);
    const e = /^N\d{1,3}$/.test(id) ? entries.find(x => rid(x) === id) : undefined; if (e) return byName(e.byColumn['소유 부분'] ?? '');
    const k = /^K\d{1,3}$/.test(id) ? contracts.find(x => rid(x) === id) : undefined; if (k) return byName(k.byColumn['제공 부분'] ?? '');
    const first = /^P1-02\.\d+$/.test(id) && seen < 2 ? p12.find(x => rid(x) === id) : undefined;
    if (first) { const s = partOf(first.byColumn['단계·부분'], record); return s.rest ? s.part : first.byColumn['사슬 ID'] && clean(first.byColumn['사슬 ID']) !== id ? owner(first.byColumn['사슬 ID']!, record, seen + 1) : undefined; }
    return byName(id);
  };
  const order = (r: TableRow) => Number(/\d+/.exec(r.byColumn['순서'] ?? '')?.[0] ?? NaN);
  for (const r of [...p12].sort((a, b) => (order(a) || 0) - (order(b) || 0))) {
    const stage = partOf(r.byColumn['단계·부분'], r.record), b = stage.rest ? stage.part : owner(r.byColumn['사슬 ID'] ?? '', r.record);
    const name = stage.rest ?? clean(r.byColumn['단계·부분']); if (!b || !name || stage.part === b && !stage.rest) continue;
    const pass = said(clean(r.byColumn['다음으로 넘김·중단 조건'])), got = said(clean(r.byColumn['받는 것']));
    addStep(b, name, [got, pass].filter(Boolean).join(' → ') || null, r);
  }
  for (const r of p22) {
    const b = byName(r.byColumn['소유 부분'] ?? ''), what = said(clean(r.byColumn['구현해야 할 계약'])); if (!b || !what) continue;
    addStep(b, `확장 접점: ${what}`, [said(clean(r.byColumn['등록·연결 방식'])), said(clean(r.byColumn['호출·해제 시점']))].filter(Boolean).join(' · ') || null, r);
  }
  for (const r of p53) {
    const job = clean(r.byColumn['작업·단계 ID']), viaJob = /^P5-01\.\d+$/.test(job) ? p51.find(x => rid(x) === job) : undefined;
    const b = viaJob ? byName(viaJob.byColumn['수행 부분'] ?? '') : partOf(job, r.record).part;
    const when = said(clean(r.byColumn['실패 조건'])), retry = said(clean(r.byColumn['재시도 조건·한도'])); if (!b || !when || !retry) continue;
    addCondition(b, when, `재시도: ${retry}`, said(clean(r.byColumn['복구 위치'])), r);
  }
  for (const r of p61) {
    const b = byName(r.byColumn['적용 대상'] ?? ''), key = said(clean(r.byColumn['설정 ID·키'])); if (!b || !key) continue;
    const value = said(clean(r.byColumn['기본값·식'])); addConfig(b, value ? `${key}=${value}` : key);
  }
  for (const r of p62) {
    const id = said(clean(r.byColumn['설정 ID'])); if (!id) continue;
    const def = p61.find(x => rid(x) === id || clean(x.byColumn['설정 ID·키']) === id), b = def ? byName(def.byColumn['적용 대상'] ?? '') : byName(r.byColumn['적용 범위·프리셋'] ?? '');
    if (!b) continue;
    const key = def ? said(clean(def.byColumn['설정 ID·키'])) ?? id : id, from = said(clean(r.byColumn['설정 출처'])), value = said(clean(r.byColumn['지정값'])), rank = said(clean(r.byColumn['우선 관계']));
    addConfig(b, `${key}${from ? ` ← ${from}` : ''}${value ? ` ${value}` : ''}${rank ? ` (${rank})` : ''}`);
  }
}
/** The parts a cell names: the whole cell, else its 「·」 pieces (the longest run naming a part first), a trailing 「(…)」 left off. */
function partsInCell(cell: string, byName: (name: string) => Part43 | undefined): Part43[] {
  const whole = said(bare(cell)); if (!whole) return [];
  const one = (s: string) => byName(s) ?? byName(s.replace(/\s*[(（][^)）]*[)）]\s*$/, ''));
  const all = one(whole); if (all) return [all];
  const pieces = whole.split(/\s*·\s*/), out: Part43[] = [];
  for (let i = 0; i < pieces.length;) {
    let hit: Part43 | undefined, j = pieces.length;
    for (; j > i && !hit; j--) hit = one(pieces.slice(i, j).join('·'));
    if (hit) { if (!out.includes(hit)) out.push(hit); i = j + 1; } else i++;
  }
  return out;
}
/** .44: the file names in a text (「log.csv」, 「a.json·b.json」), lower-cased. */
const fileNames = (t: string): string[] => (t.toLowerCase().match(/[a-z0-9_][a-z0-9_\-]*\.[a-z][a-z0-9]{0,5}\b/g) ?? []);
/** .44 (see record43): the record's own lines from its C-LINK and C-DATA rows that the reply left undrawn, pushed onto relations. */
function programLines(ctx: { parts: Part43[]; relations: Line43[]; links: TableRow[]; dataRows: TableRow[]; byName: (name: string) => Part43 | undefined;
  nameOfPart: (b: Part43) => string; rowQuote: (r: TableRow) => Record43Quote | null; dataById: (id: string, record: string) => TableRow | undefined; maxLines: number }): void {
  const { parts, byName } = ctx;
  // Recipe .48: the lines are gathered first and drawn within the cap after, one line of each row before any row's second (a stored
  // hand-over is two lines, maker → store and store → reader): a cap leaves later rows a line each, never earlier rows both and later none.
  const pending: { line: Line43; tier: number; order: number }[] = [], perRow = new Map<TableRow, number>();
  const put = (r: TableRow, line: Line43) => { const n = perRow.get(r) ?? 0; perRow.set(r, n + 1); pending.push({ line, tier: n, order: pending.length }); };
  const drawn = (fn: (l: Line43) => boolean) => ctx.relations.some(fn) || pending.some(p => fn(p.line));
  const partsIn = (cell: string): Part43[] => partsInCell(cell, byName);
  const has = (a: string, b: string) => drawn(l => l.from === a && l.to === b);
  const through = (a: string, b: string) => drawn(l => l.from === a && l.to !== b && has(l.to, b));
  const storeOf = (name: string): Part43 | undefined => {
    const n = plain(bare(name)), files = fileNames(name);
    return parts.find(b => (b.type === 'store' || b.family === 'store') && (plain(ctx.nameOfPart(b)) === n || (files.length > 0 && fileNames(ctx.nameOfPart(b)).some(f => files.includes(f)))));
  };
  // A line's 설계/관찰 is its row's: a C-LINK row's own cell (review B2); a C-DATA row has none, so its line says none (null).
  const modeOf = (r: TableRow): 'design' | 'observed' | null => r.id === 'C-LINK' ? fixedWord(r.byColumn['설계/관찰'] ?? '', { 설계: 'design', 관찰: 'observed' } as const)?.value ?? null : null;
  const add = (from: Part43, to: Part43, r: TableRow, payload: string, ref: string | null, fields: string[]) => {
    const q = ctx.rowQuote(r);
    if (!q || from === to || has(from.ref, to.ref) || secretLike(payload) || fields.some(f => secretLike(f))) return;
    put(r, { from: from.ref, to: to.ref, kind: 'flow', note: '', record: q.record, quote: q.quote, span: { from: q.from, to: q.to }, payload: payload ? cut(payload, 80) : null, cadence: null,
      mode: modeOf(r), channel: 'data', payloadFields: fields, when: null, optional: false, variantRef: null, crosses: null, cadenceKind: null, payloadRef: ref, via: null, member: null });
  };
  // An artifact handed from makers to readers on row r: through its store part when one holds it, else directly.
  const hand = (makers: Part43[], readers: Part43[], r: TableRow, name: string, payload: string, ref: string | null, fields: string[], stored: boolean) => {
    const s = storeOf(name);
    if (s) {
      for (const m of makers) if (m !== s && !has(m.ref, s.ref) && !readers.some(x => has(m.ref, x.ref))) add(m, s, r, payload, ref, fields);
      for (const x of readers) if (x !== s && !has(s.ref, x.ref) && !makers.some(m => has(m.ref, x.ref))) add(s, x, r, payload, ref, fields);
      return;
    }
    // A stored file no store part holds, or a row of several makers or readers (which maker hands which reader is the C-LINK rows'
    // to say; a cross product would draw shortcuts the record never wrote): the reply's own lines decide, none is made up.
    if (stored || makers.length !== 1 || readers.length !== 1) return;
    const m = makers[0]!, x = readers[0]!;
    if (m !== x && m.type !== 'store' && x.type !== 'store' && !has(m.ref, x.ref) && !through(m.ref, x.ref)) add(m, x, r, payload, ref, fields);
  };
  for (const r of ctx.links) {
    const from = partsIn(r.byColumn['보내는 부분']?.replace(/\s*:\s*.+$/, '') ?? ''), to = partsIn(r.byColumn['받는 부분']?.replace(/\s*:\s*.+$/, '') ?? '');
    const what = said(r.byColumn['넘기는 것']) ?? '', ref = /^\s*(D\d{1,3})\b/.exec(what)?.[1] ?? null, row = ref ? ctx.dataById(ref, r.record) : undefined;
    if (from.length !== 1 || to.length !== 1) continue;
    if (row) { hand(from, to, r, row.byColumn['이름'] ?? '', what, ref, fieldsOf(row.byColumn['필드·모양'] ?? ''), fixedWord(row.byColumn['종류'] ?? '', DATA_WORDS)?.value === 'store'); continue; }
    // A line with no artifact row: the row's own line, its channel unsaid (the record's 넘기는 것 words alone do not say data or control).
    const a = from[0]!, b = to[0]!, q = ctx.rowQuote(r);
    if (a === b || !q || has(a.ref, b.ref) || through(a.ref, b.ref) || secretLike(what)) continue;
    put(r, { from: a.ref, to: b.ref, kind: 'flow', note: '', record: q.record, quote: q.quote, span: { from: q.from, to: q.to }, payload: what ? cut(what, 80) : null, cadence: null,
      mode: modeOf(r), channel: null, payloadFields: [], when: null, optional: false, variantRef: null, crosses: null, cadenceKind: null, payloadRef: null, via: null, member: null });
  }
  for (const r of ctx.dataRows) {
    const name = (r.byColumn['이름'] ?? '').trim(), id = (r.byColumn['행 ID'] ?? '').trim(); if (!name) continue;
    // Recipe .45 (13.7a): a D row a C-LINK row carries draws no maker → reader line of its own: the C-LINK rows decide who hands it to
    // whom (the row gives the fields), so no maker × reader shortcut is made from it. A store part holding it keeps its write and read
    // halves (a store's own lines are never a shortcut).
    if (/^D\d{1,3}$/.test(id) && !storeOf(name) && ctx.links.some(l => /^\s*(D\d{1,3})\b/.exec(l.byColumn['넘기는 것'] ?? '')?.[1] === id && ctx.dataById(id, l.record) === r)) continue;
    // Recipe .45 (13.3): data shared with no direction (「공유: B05·B07」) draws no directed line; only the two-way lines between each
    // sharer and the store part that holds it, when one does.
    const sharers = partsIn(r.byColumn['공유 부분'] ?? '');
    if (sharers.length) {
      const s = storeOf(name);
      if (s) for (const x of sharers) if (x !== s) { add(x, s, r, name, /^D\d{1,3}$/.test(id) ? id : null, fieldsOf(r.byColumn['필드·모양'] ?? '')); add(s, x, r, name, /^D\d{1,3}$/.test(id) ? id : null, fieldsOf(r.byColumn['필드·모양'] ?? '')); }
      continue;
    }
    const makers = partsIn(r.byColumn['만드는 부분'] ?? ''), readers = partsIn(r.byColumn['읽는 부분'] ?? '');
    if (!makers.length && !readers.length) continue;
    hand(makers, readers, r, name, name, /^D\d{1,3}$/.test(id) ? id : null, fieldsOf(r.byColumn['필드·모양'] ?? ''), fixedWord(r.byColumn['종류'] ?? '', DATA_WORDS)?.value === 'store');
  }
  // Recipe .48: within the cap, each row's first line (C-LINK rows before C-DATA rows), then each row's second, in the rows' order.
  const rank = (p: { line: Line43; tier: number; order: number }) => p.tier * 2 + (ctx.links.some(r => r.record === p.line.record && p.line.span && r.from <= p.line.span.from && p.line.span.from < r.to) ? 0 : 1);
  for (const p of [...pending].sort((a, b) => rank(a) - rank(b) || a.order - b.order)) { if (ctx.relations.length >= ctx.maxLines) break; ctx.relations.push(p.line); }
}
/** C-CHANGE 관련 주체·역할: 「역할: 주체」 joined by 「+」. */
export function actorsOf(cell: string): ReadingActor[] {
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
/** Review D2: the code words of a condition as written: identifiers with 「_」 or 「.」 in them, camelCase ones, and calls (「exists(」), four
 * characters or more (os.path.exists, plan_path, GITHUB_REF, best_score); plain words are none. */
export function codeWords(condition: string): string[] {
  const out: string[] = [];
  for (const m of condition.matchAll(/[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*/g)) {
    const w = m[0], call = condition[m.index! + w.length] === '(';
    if (w.length >= 4 && (/[_.]/.test(w) || /[a-z][A-Z]/.test(w) || call) && !out.includes(w)) out.push(w);
  }
  return out;
}
