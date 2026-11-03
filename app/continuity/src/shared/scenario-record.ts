/* The scenario record (시나리오 기록 v2, map design spec §8.2–8.3) read by the program alone, no AI: its six tables become one
 * scenario object whose every P/O/S/R/A/F/Q reference is resolved against the ID ledger the request carried (buildLedger, the
 * same object scenarioAskWithLedger is written from). A wrong row, cell or reference is set aside as the unit the spec's table
 * names, with a diagnostic; nothing is repaired, renumbered or re-joined (V1→V2→V3 with V2 set aside never becomes V1→V3). The
 * record itself stays as pasted; the reading is kept beside the map readings as scenario-reading.1. */
import { isMapReading, isScenarioReading, type Project, type ScenarioArtifactRef, type ScenarioDiagnostic, type ScenarioEnd, type ScenarioEvidence,
  type ScenarioEvidenceWord, type ScenarioGap, type ScenarioGapReason, type ScenarioIdentity, type ScenarioKind, type ScenarioLink, type ScenarioLinkKind,
  type ScenarioPartRef, type ScenarioPathStatus, type ScenarioPortMapRow, type ScenarioPortRef, type ScenarioReading, type ScenarioRecord,
  type ScenarioRelationRef, type ScenarioRuleRef, type ScenarioSaid, type ScenarioStart, type ScenarioStatement, type ScenarioStepRef, type ScenarioTarget,
  type ScenarioVisit } from './types.js';
import { buildLedger, type ScenarioLedger } from './report-ask.js';
import { studioView } from './studio.js';
import { addReading } from './domain.js';
import { ensure, validateScenarioReading, SCENARIO_LIMITS } from './validation.js';
import { partUnderstanding } from './map-reading.js';

export { SCENARIO_LIMITS };
/** The ledger of the project's current map, exactly as the scenario request attaches it. */
export const projectLedger = (p: Project): ScenarioLedger => buildLedger(studioView(p), p.readings);

export interface ParsedScenario { record: ScenarioRecord; diagnostics: ScenarioDiagnostic[]; pathStatus: ScenarioPathStatus; ledgerVersion: string | null }

type TableKind = 'scenario' | 'start' | 'visits' | 'links' | 'end' | 'evidence' | 'portMaps' | 'gaps';
/** Each table by its first header cell (headings around it, ① or 1., are not needed) and its column count as §8.2 gives it. */
const TABLES: { kind: TableKind; head: RegExp; cols: number; category: string }[] = [
  { kind: 'scenario', head: /^시나리오\s*ID$/, cols: 10, category: 'scenario' },
  { kind: 'start', head: /^시작\s*ID$/, cols: 7, category: 'start' },
  { kind: 'visits', head: /^방문(\s*V)?$/, cols: 8, category: 'visit' },
  { kind: 'links', head: /^이어짐(\s*L)?$/, cols: 8, category: 'link' },
  { kind: 'end', head: /^끝(\s*ID)?$/, cols: 8, category: 'end' },
  { kind: 'evidence', head: /^(근거\s*:?\s*)?E$|^근거(\s*ID)?$/, cols: 7, category: 'evidence' },
  { kind: 'portMaps', head: /^대응(\s*ID)?$/, cols: 6, category: 'port-map' },
  { kind: 'gaps', head: /^(빈칸\s*:?\s*)?G$|^빈칸$/, cols: 6, category: 'gap' },
];
interface Row { kind: TableKind; index: number; cells: string[]; ok: boolean }

const plain = (c: string) => c.replace(/[*`]/g, '').trim();
const UNKNOWN = /^\[?모름\]?(?=$|[\s(:,.·—–-])/, NONE = /^\[?없음\]?(?=$|[\s(:,.·—–-])/;
/** '모름' (and an empty cell: not stated) is 'unknown', '없음' is null, anything else the cell as written. */
function said(c: string): ScenarioSaid {
  const p = plain(c); if (!p || /^[-—–]$/.test(p) || UNKNOWN.test(p)) return 'unknown'; if (NONE.test(p)) return null; return c.trim();
}
const known = (s: ScenarioSaid): s is string => s !== null && s !== 'unknown';
const cellOk = (c: string) => c.length <= SCENARIO_LIMITS.cell && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(c);
const TOKEN = /(?<![A-Za-z0-9_])([A-Z])(\d{1,3})(?![A-Za-z0-9_])/g;
const norm = (letter: string, digits: string) => `${letter}${String(Number(digits)).padStart(2, '0')}`;
/** The ids of these letters a cell writes, normalised (P1 and P01 are both P01), in order, each once. */
function tokens(c: string, letters: string): string[] {
  const out: string[] = [];
  for (const m of plain(c).matchAll(TOKEN)) if (letters.includes(m[1]!)) { const t = norm(m[1]!, m[2]!); if (!out.includes(t)) out.push(t); }
  return out;
}
const one = (c: string, letter: string): string | null => { const t = tokens(c, letter); return t.length === 1 ? t[0]! : null; };

function splitRow(line: string): string[] {
  let t = line.trim(); if (t.startsWith('|')) t = t.slice(1); if (t.endsWith('|') && !t.endsWith('\\|')) t = t.slice(0, -1);
  return t.split(/(?<!\\)\|/).map(x => x.replace(/\\\|/g, '|').trim());
}
const isRule = (line: string) => /^[|:\-\s]+$/.test(line.trim()) && line.includes('-');

export function parseScenarioRecord(text: string, ledger: ScenarioLedger): ParsedScenario {
  const diagnostics: ScenarioDiagnostic[] = [];
  const diag = (path: string, category: string, explanation: string) => { diagnostics.push({ path, rule: 'contract', category, explanation: explanation.slice(0, 200) }); };
  if (text.length > SCENARIO_LIMITS.chars) diag('record', 'cap', `응답이 ${text.length.toLocaleString()}자로 상한 ${SCENARIO_LIMITS.chars.toLocaleString()}자를 넘음`);

  // Tables by their header rows; rows of the same table written in two pieces are one table, numbered as written.
  const rows: Record<TableKind, Row[]> = { scenario: [], start: [], visits: [], links: [], end: [], evidence: [], portMaps: [], gaps: [] };
  const lines = text.split(/\r?\n/); let current: (typeof TABLES)[number] | null = null, inTable = false, unknownTables = 0, dataRows = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line.startsWith('|')) { inTable = false; current = null; continue; }
    if (!inTable) {
      inTable = true; const head = plain(splitRow(line)[0] ?? '');
      current = TABLES.find(t => t.head.test(head)) ?? null;
      if (current && splitRow(line).length !== current.cols) { diag(`tables.${current.kind}`, current.category, `${head} 표의 열이 ${splitRow(line).length}개로 요청의 ${current.cols}개와 다름: 표 전체 제외`); current = null; }
      else if (!current) { unknownTables++; diag(`tables[${unknownTables - 1}]`, 'table', `머리 칸 '${head.slice(0, 40)}'은 여섯 묶음의 표가 아님`); }
      if (isRule(lines[i + 1] ?? '')) i++;
      continue;
    }
    if (isRule(line) || !current) continue;
    const cells = splitRow(line), list = rows[current.kind], index = list.length;
    const row: Row = { kind: current.kind, index, cells, ok: true }; list.push(row); dataRows++;
    const path = `${current.kind}[${index}]`;
    if (dataRows > SCENARIO_LIMITS.rows) { row.ok = false; diag(path, 'cap', `표 데이터 행 상한 ${SCENARIO_LIMITS.rows}개를 넘은 행`); continue; }
    if (cells.length !== current.cols) { row.ok = false; diag(path, current.category, `칸이 ${cells.length}개로 ${current.cols}개가 아님`); continue; }
    if (!cells.every(cellOk)) { row.ok = false; diag(path, current.category, `${SCENARIO_LIMITS.cell}자를 넘거나 제어 문자가 든 칸`); }
  }

  // The ledger, by id: only the ids the request text showed (an item past its cap was never given).
  const shown = new Set(ledger.shown), cut = new Set(ledger.items.map(x => x.id).filter(id => !shown.has(id)));
  const pick = <T extends { id: string }>(xs: T[], id: string | null) => (id && shown.has(id) ? xs.find(x => x.id === id) ?? null : null);
  const why = (id: string) => (cut.has(id) ? `${id}는 대장 상한으로 요청에 실리지 않은 ID` : `${id}는 대장에 없는 ID`);
  const partRef = (id: string): ScenarioPartRef | null => { const p = pick(ledger.parts, id); return p ? { ref: p.id, areaId: p.areaId, name: p.name } : null; };

  // ⑥ evidence first: every other row cites it.
  const evidence: ScenarioEvidence[] = [], evidenceIds = new Set<string>();
  const dupes = (list: Row[], letter: string | null) => { const n = new Map<string, number>(); for (const r of list) { const id = letter ? one(r.cells[0] ?? '', letter) : plain(r.cells[0] ?? ''); if (id) n.set(id, (n.get(id) ?? 0) + 1); } return n; };
  const evCount = dupes(rows.evidence, 'E');
  for (const r of rows.evidence) {
    if (!r.ok) continue; const path = `evidence[${r.index}]`, [idc, supports, material, source, version, quote, stance] = r.cells as [string, string, string, string, string, string, string];
    const id = one(idc, 'E'); if (!id) { diag(path, 'evidence', 'E ID가 하나가 아님'); continue; }
    if (evCount.get(id)! > 1) { diag(path, 'evidence', `${id}가 두 행 이상: 모두 제외`); continue; }
    const m = plain(material), kinds = (['file', 'run', 'report'] as const).filter((_, k) => m.includes(['파일', '실행', '보고'][k]!));
    if (kinds.length !== 1) { diag(path, 'evidence', '자료 종류가 파일/실행/보고 중 하나가 아님'); continue; }
    const q = plain(quote), noQuote = !q || /원문\s*미제공/.test(q) || UNKNOWN.test(q) || NONE.test(q);
    if (!noQuote && quote.trim().length > SCENARIO_LIMITS.quote) { diag(path, 'evidence', `정확 인용이 ${SCENARIO_LIMITS.quote}자를 넘음`); continue; }
    const s = plain(stance), st = /명시/.test(s) && !/추정/.test(s) ? 'stated' : /추정/.test(s) && !/명시/.test(s) ? 'guess' : /^보고/.test(s) ? 'report' : null;
    if (!st) { diag(path, 'evidence', '명시적 내용/보고/추정 중 하나가 아님'); continue; }
    evidence.push({ id, supports: said(supports), material: kinds[0]!, source: said(source), versionOrRun: said(version), quote: noQuote ? null : quote.trim(), stance: st });
    evidenceIds.add(id);
  }
  /** A row's E cell: the E ids that hold (one that does not is dropped, with a diagnostic) and '보고'/'추정' written in place of one. */
  const cites = (c: string, path: string): { evidence: string[]; evidenceWord: ScenarioEvidenceWord | null } => {
    const out: string[] = [];
    tokens(c, 'E').forEach((e, k) => { if (evidenceIds.has(e)) out.push(e); else diag(`${path}.evidence[${k}]`, 'evidence', `근거 ${e}는 받아들인 근거 표에 없음`); });
    const p = plain(c); return { evidence: out.slice(0, 16), evidenceWord: /추정/.test(p) ? 'guess' : /보고/.test(p) ? 'report' : null };
  };
  /** Q ids in a condition: every one must hold, or the row they condition is set aside. */
  const rulesOf = (c: string): { rules: ScenarioRuleRef[]; bad: string | null } => {
    const rules: ScenarioRuleRef[] = [];
    for (const q of tokens(c, 'Q')) { const r = pick(ledger.rules, q); if (!r) return { rules, bad: q }; rules.push({ ref: r.id, areaId: r.areaId, text: r.text }); }
    return { rules: rules.slice(0, 8), bad: null };
  };
  const stepOf = (id: string, areaId: string): ScenarioStepRef | null => { const s = pick(ledger.steps, id); return s && s.areaId === areaId ? { ref: s.id, name: s.name } : null; };
  const portOf = (id: string, areaId: string): ScenarioPortRef | null => { const o = pick(ledger.ports, id); return o && o.areaId === areaId ? { ref: o.id, name: o.name, direction: o.direction } : null; };
  const relationOf = (id: string | null) => pick(ledger.relations, id);

  // ① identity: exactly one row, C01, a kind among the three, the ledger version this record was asked with, a run for an observed one.
  let scenario: ScenarioIdentity | null = null, identityOk = true;
  const failIdentity = (path: string, explanation: string) => { identityOk = false; diag(path, 'scenario', explanation); };
  if (rows.scenario.length !== 1) failIdentity('scenario', rows.scenario.length ? `시나리오 행이 ${rows.scenario.length}개: 시나리오는 하나` : '기준과 목적 표(시나리오 행)가 없음');
  else {
    const r = rows.scenario[0]!, [idc, name, request, ledgerVersion, design, basisAt, kindc, run, reason, ev] = r.cells as string[] as [string, string, string, string, string, string, string, string, string, string];
    if (!r.ok) failIdentity('scenario[0]', '시나리오 행을 읽을 수 없음');
    else {
      const kp = plain(kindc), kinds = (['designed', 'observed', 'tour'] as ScenarioKind[]).filter((_, k) => [/설계/, /관측/, /투어/][k]!.test(kp));
      const kind = kinds.length === 1 ? kinds[0]! : null;
      scenario = { id: plain(idc).slice(0, 40) || '?', name: said(name), requestRef: said(request), ledgerVersion: said(ledgerVersion), designVersion: said(design), basisAt: said(basisAt), kind, runRef: said(run), reason: said(reason), ...cites(ev, 'scenario[0]') };
      if (one(idc, 'C') !== 'C01' || tokens(idc, 'ABDEFGHIJKLMNOPQRSTUVWXYZ').length) failIdentity('scenario[0].id', '시나리오 ID가 C01이 아님');
      if (!kind) failIdentity('scenario[0].kind', kinds.length ? '종류가 둘 이상' : '종류가 설계 경로/관측 실행/설명용 투어 중 하나가 아님');
      const lv = plain(ledgerVersion);
      if (ledger.version ? !lv.includes(ledger.version) : !lv.includes('지도 읽기 없음')) failIdentity('scenario[0].ledgerVersion', `ID 대장 판본이 요청의 대장(${ledger.versionLine.slice(0, 80)})과 다름`);
      if (kind === 'observed' && !known(scenario.runRef)) failIdentity('scenario[0].runRef', '관측 실행인데 같은 실행의 식별 근거(실행 ID)가 없음');
    }
  }
  const tour = scenario?.kind === 'tour';

  // ③ visits: a bad part, step or port sets the visit aside (and, below, every link attached to it); a bad input or output only itself.
  const visits: ScenarioVisit[] = [], droppedVisits = new Set<string>(), writtenVisits = new Set<string>();
  let visitsSetAside = 0;
  const vCount = dupes(rows.visits, 'V');
  const artifacts = (c: string, path: string, category: string): ScenarioArtifactRef[] | 'unknown' => {
    const s = said(c); if (s === 'unknown') return 'unknown'; if (s === null) return [];
    const out: ScenarioArtifactRef[] = []; let k = 0, bad = 0;
    for (const piece of c.split(/[,;、]|<br\s*\/?>/).map(x => x.trim()).filter(x => plain(x))) {
      const ids = tokens(piece, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
      if (!ids.length) { diag(`${path}[${k++}]`, category, `'${plain(piece).slice(0, 40)}'는 대장의 A ID가 아님`); bad++; continue; }
      for (const id of ids) { const a = id.startsWith('A') ? pick(ledger.artifacts, id) : null;
        if (a && out.length < 16 && !out.some(x => x.ref === a.id)) out.push({ ref: a.id, name: a.name }); else if (!a) { diag(`${path}[${k}]`, category, id.startsWith('A') ? why(id) : `${id}는 산출물(A) ID가 아님`); bad++; } k++; }
    }
    return out.length || !bad ? out : 'unknown';
  };
  for (const r of rows.visits) {
    const path = `visits[${r.index}]`, id = one(r.cells[0] ?? '', 'V');
    if (id) writtenVisits.add(id);
    const setAside = (explanation: string) => { visitsSetAside++; if (id) droppedVisits.add(id); diag(path, 'visit', explanation); };
    if (!r.ok) { visitsSetAside++; if (id) droppedVisits.add(id); continue; }
    if (!id) { setAside('방문 V ID가 하나가 아님'); continue; }
    if (vCount.get(id)! > 1) { setAside(`${id}가 두 행 이상: 모두 제외`); continue; }
    if (r.index >= SCENARIO_LIMITS.visits) { visitsSetAside++; droppedVisits.add(id); diag(path, 'cap', `방문 상한 ${SCENARIO_LIMITS.visits}개를 넘은 ${id}`); continue; }
    const [, pc, sc, oc, inc, outc, event, ev] = r.cells as [string, string, string, string, string, string, string, string];
    const pid = one(pc, 'P'), part = pid ? partRef(pid) : null;
    if (!part) { setAside(`${id}의 부분: ${pid ? why(pid) : 'P ID가 하나가 아님'}`); continue; }
    let step: ScenarioVisit['step'] = said(sc) === 'unknown' ? 'unknown' : said(sc) === null ? null : 'unknown';
    if (known(said(sc))) { const sid = one(sc, 'S'), s = sid ? stepOf(sid, part.areaId) : null;
      if (!s) { setAside(`${id}의 단계: ${!sid ? 'S ID가 하나가 아님' : pick(ledger.steps, sid) ? `${sid}는 ${part.ref}의 단계가 아님` : why(sid)}`); continue; } step = s; }
    let port: ScenarioVisit['port'] = said(oc) === null ? null : 'unknown';
    if (known(said(oc))) { const oid = one(oc, 'O'), o = oid ? portOf(oid, part.areaId) : null;
      if (!o) { setAside(`${id}의 포트: ${!oid ? 'O ID가 하나가 아님' : pick(ledger.ports, oid) ? `${oid}는 ${part.ref}의 포트가 아님` : why(oid)}`); continue; } port = o; }
    visits.push({ id, part, step, port, in: artifacts(inc, `${path}.in`, 'visit-input'), out: artifacts(outc, `${path}.out`, 'visit-output'), event: said(event), ...cites(ev, path) });
  }
  const visitIds = new Set(visits.map(v => v.id)), visitOf = (id: string) => visits.find(v => v.id === id)!;

  // ④ links: a link to a set-aside or unknown visit, an unknown R, an R whose ends are not the two visits' parts, an unknown kind
  // or an unknown Q in its condition is set aside, alone; the two visits stay and nothing is drawn between them in its place.
  const links: ScenarioLink[] = []; let linksSetAside = 0;
  const lCount = dupes(rows.links, 'L');
  // The kind is the cell's first word (next or 다음, …): a word later in the cell is a description, not the kind.
  const KINDS: [ScenarioLinkKind, RegExp][] = [['next', /^(next|다음)$/i], ['branch', /^(branch|분기)$/i], ['parallel', /^(parallel|병렬)$/i], ['loop', /^(loop|반복)$/i], ['wait', /^(wait|대기)$/i]];
  for (const r of rows.links) {
    const path = `links[${r.index}]`, id = one(r.cells[0] ?? '', 'L');
    const setAside = (explanation: string, category = 'link') => { linksSetAside++; diag(path, category, explanation); };
    if (!r.ok) { linksSetAside++; continue; }
    if (!id) { setAside('이어짐 L ID가 하나가 아님'); continue; }
    if (lCount.get(id)! > 1) { setAside(`${id}가 두 행 이상: 모두 제외`); continue; }
    if (r.index >= SCENARIO_LIMITS.links) { setAside(`이어짐 상한 ${SCENARIO_LIMITS.links}개를 넘은 ${id}`, 'cap'); continue; }
    const [, fc, tc, rc, kc, cond, policy, ev] = r.cells as [string, string, string, string, string, string, string, string];
    const from = one(fc, 'V'), to = one(tc, 'V');
    const end = (v: string | null, side: string) => !v ? `${side} V ID가 하나가 아님` : droppedVisits.has(v) ? `${side} 방문 ${v}가 제외되어 함께 제외` : !visitIds.has(v) ? `${side} 방문 ${v}가 방문 표에 없음` : null;
    const bad = end(from, '출발') ?? end(to, '도착'); if (bad) { setAside(`${id}: ${bad}`); continue; }
    const first = plain(kc).split(/[\s(:/·,]+/)[0] ?? '', kinds = KINDS.filter(([, re]) => re.test(first));
    if (kinds.length !== 1) { setAside(`${id}: 뜻이 next/branch/parallel/loop/wait 중 하나가 아님`); continue; }
    let relation: ScenarioRelationRef | null = null;
    if (tour && /투어\s*읽기\s*순서/.test(plain(rc))) relation = null;
    else {
      const rid = one(rc, 'R'), rel = relationOf(rid);
      if (!rel) { setAside(`${id}: ${rid ? why(rid) : '기존 연결 R ID가 하나가 아님'}`); continue; }
      const a = visitOf(from!).part.areaId, b = visitOf(to!).part.areaId;
      if (!(rel.from === a && rel.to === b) && !(rel.from === b && rel.to === a)) { setAside(`${id}: ${rel.id}의 양 끝이 ${from}·${to}의 부분과 다름`); continue; }
      relation = { ref: rel.id, relationId: rel.relationId, along: rel.from === a && rel.to === b };
    }
    const q = rulesOf(cond); if (q.bad) { setAside(`${id}: 조건의 ${why(q.bad)}`); continue; }
    links.push({ id, from: from!, to: to!, relation, kind: kinds[0]![0], condition: said(cond), rules: q.rules, policy: said(policy), ...cites(ev, path) });
  }

  // ② start: one row; its target's P, O and S must agree (a port or step names its part; nothing is guessed from a name).
  let start: ScenarioStart | null = null;
  if (rows.start.length > 1) diag('start', 'start', `시작 행이 ${rows.start.length}개: 모두 제외`);
  else if (rows.start.length === 1 && rows.start[0]!.ok) {
    const [idc, trigger, tc, cond, prior, independent, ev] = rows.start[0]!.cells as [string, string, string, string, string, string, string];
    let target: ScenarioStart['target'] = said(tc) === null ? null : 'unknown', problem: string | null = null;
    if (known(said(tc))) {
      const ps = tokens(tc, 'P'), os = tokens(tc, 'O'), ss = tokens(tc, 'S');
      if (ps.length > 1 || os.length > 1 || ss.length > 1 || !(ps.length || os.length || ss.length)) problem = '시작 대상에 P/O/S가 하나씩이 아님';
      else {
        const area = ps[0] ? partRef(ps[0])?.areaId : os[0] ? pick(ledger.ports, os[0])?.areaId : pick(ledger.steps, ss[0]!)?.areaId;
        const part = area ? partRef(ledger.parts.find(p => p.areaId === area)!.id) : null;
        const port = os[0] && part ? portOf(os[0], part.areaId) : null, step = ss[0] && part ? stepOf(ss[0], part.areaId) : null;
        if (!part || (os[0] && !port) || (ss[0] && !step)) problem = `시작 대상 ${[...ps, ...os, ...ss].join('·')}가 대장에 없거나 한 부분에 속하지 않음`;
        else target = { part, port, step } satisfies ScenarioTarget;
      }
    }
    const q = rulesOf(cond); if (!problem && q.bad) problem = `시작 조건의 ${why(q.bad)}`;
    if (!plain(idc)) problem = problem ?? '시작 ID가 없음';
    if (problem) diag('start[0]', 'start', problem);
    else start = { id: plain(idc).slice(0, 40), trigger: said(trigger), target, condition: said(cond), rules: q.rules, prior: said(prior), independent: said(independent), ...cites(ev, 'start[0]') };
  }

  // ⑤ end: one row; a reached visit or last confirmed point that is no visit of this record is not known (said so in a diagnostic).
  let end: ScenarioEnd | null = null;
  if (rows.end.length > 1) diag('end', 'end', `끝 행이 ${rows.end.length}개: 모두 제외`);
  else if (rows.end.length === 1 && rows.end[0]!.ok) {
    const [idc, rc, produced, desired, exitsc, lastc, gap, ev] = rows.end[0]!.cells as [string, string, string, string, string, string, string, string];
    if (!plain(idc)) diag('end[0]', 'end', '끝 ID가 없음');
    else {
      let reached: ScenarioEnd['reached'] = said(rc) === null ? null : 'unknown';
      if (known(said(rc))) { const v = one(rc, 'V'); if (v && visitIds.has(v)) reached = v; else diag('end[0].reached', 'end', `도달 방문: ${!v ? 'V ID가 하나가 아님' : droppedVisits.has(v) ? `${v}가 제외됨` : `${v}가 방문 표에 없음`}`); }
      const lv = tokens(lastc, 'V'); let lastConfirmedVisit: string | null = null;
      if (lv.length === 1 && visitIds.has(lv[0]!)) lastConfirmedVisit = lv[0]!;
      else if (lv.length) diag('end[0].lastConfirmed', 'end', `마지막 확인 지점: ${lv.length > 1 ? 'V가 둘 이상' : droppedVisits.has(lv[0]!) ? `${lv[0]}가 제외됨` : `${lv[0]}가 방문 표에 없음`}`);
      let exits: ScenarioEnd['exits'] = said(exitsc) === 'unknown' ? 'unknown' : [];
      if (known(said(exitsc))) { const xs = exitsc.split(/;|<br\s*\/?>/).map(x => x.trim()).filter(x => plain(x));
        if (xs.length > SCENARIO_LIMITS.exits) diag('end[0].exits', 'cap', `이탈 결과가 ${xs.length}개로 ${SCENARIO_LIMITS.exits}개를 넘음: 이탈 결과 모름`); else exits = xs; }
      end = { id: plain(idc).slice(0, 40), reached, produced: said(produced), desired: said(desired), exits, lastConfirmed: said(lastc), lastConfirmedVisit, gap: said(gap), ...cites(ev, 'end[0]') };
    }
  }

  // ⑥ the port map (explicit correspondences only) and the gaps.
  const portMaps: ScenarioPortMapRow[] = [], mCount = dupes(rows.portMaps, null);
  for (const r of rows.portMaps) {
    if (!r.ok) continue; const path = `portMaps[${r.index}]`, [idc, rc, oc, sc, dc, ev] = r.cells as [string, string, string, string, string, string];
    const id = plain(idc).slice(0, 40); if (!id) { diag(path, 'port-map', '대응 ID가 없음'); continue; }
    if (mCount.get(plain(idc))! > 1) { diag(path, 'port-map', `${id}가 두 행 이상: 모두 제외`); continue; }
    const rel = relationOf(one(rc, 'R')), o = pick(ledger.ports, one(oc, 'O')), s = pick(ledger.steps, one(sc, 'S'));
    const d = plain(dc), direction = /들어감|^in$/i.test(d) && !/나감/.test(d) ? 'in' as const : /나감|^out$/i.test(d) && !/들어감/.test(d) ? 'out' as const : null;
    const problem = !rel ? '외부 연결 R이 대장에 없음' : !o ? '경계 포트 O가 대장에 없음' : !s ? '내부 단계 S가 대장에 없음' : !direction ? '들어감/나감이 아님'
      : o.areaId !== s.areaId ? `${o.id}와 ${s.id}가 한 부분에 속하지 않음` : o.direction !== direction ? `${o.id}의 방향(${o.direction === 'in' ? '받음' : '냄'})과 다름`
      : (direction === 'in' ? rel.to : rel.from) !== o.areaId ? `${rel.id}의 ${direction === 'in' ? '받는' : '보내는'} 쪽이 ${o.id}의 부분이 아님` : null;
    if (problem) { diag(path, 'port-map', problem); continue; }
    portMaps.push({ id, relation: { ref: rel!.id, relationId: rel!.relationId, along: true }, areaId: o!.areaId, port: { ref: o!.id, name: o!.name, direction: o!.direction }, step: { ref: s!.id, name: s!.name }, direction: direction!, evidence: cites(ev, path).evidence });
  }
  const gaps: ScenarioGap[] = [], gCount = dupes(rows.gaps, 'G');
  const REASONS: [ScenarioGapReason, RegExp][] = [['unmentioned', /미언급/], ['no-material', /자료\s*없음/], ['not-in-ledger', /대장\s*없음/], ['conflict', /충돌/], ['cap', /상한/]];
  for (const r of rows.gaps) {
    if (!r.ok) continue; const path = `gaps[${r.index}]`, [idc, rel, what, source, reasonc, needed] = r.cells as [string, string, string, string, string, string];
    const id = one(idc, 'G'); if (!id) { diag(path, 'gap', 'G ID가 하나가 아님'); continue; }
    if (gCount.get(id)! > 1) { diag(path, 'gap', `${id}가 두 행 이상: 모두 제외`); continue; }
    const reasons = REASONS.filter(([, re]) => re.test(plain(reasonc)));
    if (reasons.length !== 1) { diag(path, 'gap', '이유가 미언급/자료없음/대장없음/충돌/분량상한 중 하나가 아님'); continue; }
    const refs: string[] = [];
    tokens(rel, 'POSRAFQV').forEach((t, k) => {
      const ok = t.startsWith('V') ? writtenVisits.has(t) : shown.has(t);
      if (ok && refs.length < 16) refs.push(t); else if (!ok) diag(`${path}.refs[${k}]`, 'gap', t.startsWith('V') ? `${t}가 방문 표에 없음` : why(t));
    });
    gaps.push({ id, refs, related: said(rel), what: said(what), source: said(source), reason: reasons[0]![0], needed: said(needed) });
  }

  // The path's status, as the app computes it (never as the record claims it).
  const rejected = !identityOk || !scenario || visits.length === 0;
  if (identityOk && scenario && !visits.length) diag('visits', 'scenario', '받아들인 방문이 하나도 없음: 경로 전체 제외');
  const reachedVisit = end && end.reached !== null && end.reached !== 'unknown' ? end.reached : null;
  const pathStatus: ScenarioPathStatus = rejected ? 'rejected'
    : visitsSetAside || linksSetAside || !reachedVisit || !end!.lastConfirmedVisit || end!.lastConfirmedVisit !== reachedVisit ? 'partial' : 'complete';
  // A rejected path keeps the end's sentences that stand on their own, as statements apart from any path.
  const statements: ScenarioStatement[] = [];
  if (rejected && end) {
    if (known(end.produced)) statements.push({ kind: 'produced', text: end.produced, evidence: end.evidence });
    if (known(end.desired)) statements.push({ kind: 'desired', text: end.desired, evidence: end.evidence });
    if (end.exits !== 'unknown') for (const x of end.exits) statements.push({ kind: 'exit', text: x, evidence: end.evidence });
  }
  if (diagnostics.length > SCENARIO_LIMITS.diagnostics) { const more = diagnostics.length - SCENARIO_LIMITS.diagnostics + 1; diagnostics.length = SCENARIO_LIMITS.diagnostics - 1; diag('record', 'cap', `진단 ${more}개 더 있음(생략)`); }
  return { record: { scenario, start, visits, links, end, evidence, portMaps, gaps, statements }, diagnostics, pathStatus, ledgerVersion: ledger.version };
}

/** Keeps a parsed scenario record beside the map readings (scenario-reading.1): the pasted record it came from, the ledger version
 * it was read against, its diagnostics and the computed pathStatus. Checked exactly before it is added. */
export function applyScenario(p: Project, recordId: string, parsed: ParsedScenario, meta: { id?: string; at?: string } = {}): Project {
  ensure(p.pasted.some(r => r.id === recordId), 'RECORD_MISSING');
  const entry: ScenarioReading = { version: 'scenario-reading.1', id: meta.id ?? `SC_${crypto.randomUUID()}`, at: meta.at ?? new Date().toISOString(), record: recordId,
    ledgerVersion: parsed.ledgerVersion, pathStatus: parsed.pathStatus, scenario: structuredClone(parsed.record), diagnostics: structuredClone(parsed.diagnostics) };
  validateScenarioReading(entry, new Set(p.space.areas.map(a => a.id)), new Set(p.pasted.map(r => r.id)), new Set(p.readings.filter(isMapReading).map(r => r.id)));
  return addReading(p, entry);
}

/** A visit as the map draws it now: its part (current name, whether it is still on the map), and whether the step and port it
 * names are still what the part's current understanding holds. Nothing is re-resolved by name: a step that is gone is shown gone. */
export interface ScenarioVisitView extends Omit<ScenarioVisit, 'step' | 'port'> {
  areaId: string; partName: string; partOnMap: boolean;
  step: (ScenarioStepRef & { current: boolean }) | 'unknown' | null;
  port: (ScenarioPortRef & { current: boolean }) | 'unknown' | null;
}
export interface ScenarioUnderstanding {
  id: string; at: string; record: string; ledgerVersion: string | null; pathStatus: ScenarioPathStatus;
  scenario: ScenarioIdentity | null; start: ScenarioStart | null;
  /** Empty when the path is rejected: no path is drawn; the end's sentences are in statements. */
  visits: ScenarioVisitView[]; links: (ScenarioLink & { relationOnMap: boolean })[];
  end: ScenarioEnd | null; statements: ScenarioStatement[];
  /** Visit ids per area id, in visit order: where the badges go ([03 · 07]). */
  byArea: Record<string, string[]>;
  diagnostics: number;
}
/** The scenario reading with this id (or the newest one), resolved against the project as it is now; null when there is none. */
export function scenarioUnderstanding(p: Project, scenarioId?: string): ScenarioUnderstanding | null {
  const all = p.readings.filter(isScenarioReading), e = scenarioId ? all.find(x => x.id === scenarioId) : all.at(-1);
  if (!e) return null;
  const rejected = e.pathStatus === 'rejected', areas = new Map(p.space.areas.map(a => [a.id, a])), seen = new Map<string, ReturnType<typeof partUnderstanding>>();
  const u = (id: string) => { if (!seen.has(id)) seen.set(id, areas.get(id) && !areas.get(id)!.archived ? partUnderstanding(p, id) : null); return seen.get(id)!; };
  const visits: ScenarioVisitView[] = rejected ? [] : e.scenario.visits.map(v => {
    const a = areas.get(v.part.areaId), pu = u(v.part.areaId);
    const step = v.step === null || v.step === 'unknown' ? v.step : { ...v.step, current: !!pu?.steps.some(s => s.name === (v.step as ScenarioStepRef).name) };
    const port = v.port === null || v.port === 'unknown' ? v.port : { ...v.port, current: !!(v.port.direction === 'in' ? pu?.inputs : pu?.outputs)?.includes(v.port.name) };
    return { ...structuredClone(v), areaId: v.part.areaId, partName: a?.name ?? v.part.name, partOnMap: !!a && !a.archived, step, port };
  });
  const rels = new Set(p.space.relations.map(r => r.id));
  const links = rejected ? [] : e.scenario.links.map(l => ({ ...structuredClone(l), relationOnMap: l.relation === null || rels.has(l.relation.relationId) }));
  const byArea: Record<string, string[]> = {};
  for (const v of visits) (byArea[v.areaId] ??= []).push(v.id);
  return { id: e.id, at: e.at, record: e.record, ledgerVersion: e.ledgerVersion, pathStatus: e.pathStatus, scenario: structuredClone(e.scenario.scenario), start: structuredClone(e.scenario.start),
    visits, links, end: rejected ? null : structuredClone(e.scenario.end), statements: structuredClone(e.scenario.statements), byArea, diagnostics: e.diagnostics.length };
}
