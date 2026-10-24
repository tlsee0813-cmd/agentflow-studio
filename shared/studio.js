import { areaOf, isReturnTask, areaDescription } from './domain.js';
import { parseResultFile } from './validation.js';
export const STATUS_LABEL = { plan: '구상', active: '진행 중', reported: '보고 받음', check: '확인 필요' };
export const RECORD_LABEL = { request: '요청', report: '작업 보고', evidence: '확인 자료', answer: '답변', decision: '결정' };
const KIND = {
    request: 'request', report: 'report', evidence: 'evidence', answer: 'answer', manual_decision: 'decision', test_answer: null
};
function recordText(t, s) {
    if (t.resultFile && (s.kind === 'report' || s.kind === 'evidence')) {
        const f = parseResultFile(t.resultFile.rawText);
        return (s.kind === 'report' ? f.report : f.evidence) ?? s.text;
    }
    return s.text;
}
export function studioView(p) {
    const active = p.space.areas.filter(a => !a.archived), ids = new Set(active.map(a => a.id));
    const parentOf = (id) => { const parent = p.space.containment.parents[id]; return parent && ids.has(parent) ? parent : null; };
    const tasks = new Map(p.tasks.map(t => [t.id, t]));
    const records = [];
    for (const s of p.sources) {
        const kind = KIND[s.kind], t = tasks.get(s.taskId);
        if (!kind || !t)
            continue;
        const area = areaOf(p, t), u = t.resultFile ? parseResultFile(t.resultFile.rawText).understanding : null;
        records.push({ id: s.id, kind, at: s.at, partId: area && ids.has(area) ? area : null, taskId: t.id, text: recordText(t, s), origin: kind === 'report' ? u?.origin ?? null : null });
    }
    records.sort((a, b) => b.at.localeCompare(a.at));
    const parts = active.map(a => {
        let depth = 0;
        for (let x = parentOf(a.id), guard = 0; x && guard < 64; x = parentOf(x), guard++)
            depth++;
        const own = records.filter(r => r.partId === a.id);
        const requests = p.tasks.filter(t => t.areaId === a.id && !isReturnTask(p, t));
        const latest = requests.at(-1);
        const returned = latest ? p.tasks.some(t => t.parentTaskId === latest.id && isReturnTask(p, t)) : false;
        const d = areaDescription(p, a.id), cur = d.current?.valid ? d.current : null;
        const status = d.held.length && !cur ? 'check' : !latest ? 'plan' : returned ? 'reported' : 'active';
        return { id: a.id, name: a.name, note: a.note, parentId: parentOf(a.id), depth, childIds: active.filter(c => parentOf(c.id) === a.id).map(c => c.id),
            status, lastAt: own[0]?.at ?? null, recordIds: own.map(r => r.id),
            summary: cur?.summary ?? null, changes: cur?.changes ?? [], origin: cur?.origin ?? null, proposal: cur?.proposal ?? null };
    });
    // A part with no request of its own reads its inside: the most pressing status among its descendants (check > active > reported).
    const rank = ['plan', 'reported', 'active', 'check'], byId = new Map(parts.map(x => [x.id, x]));
    const inner = (x, guard = 0) => x.status !== 'plan' || guard > 64 ? x.status
        : x.childIds.map(id => inner(byId.get(id), guard + 1)).reduce((a, b) => rank.indexOf(b) > rank.indexOf(a) ? b : a, 'plan');
    const aggregated = parts.map(x => inner(x));
    parts.forEach((x, i) => { x.status = aggregated[i]; });
    return {
        parts, roots: parts.filter(x => x.parentId === null).map(x => x.id),
        relations: p.space.relations.filter(r => ids.has(r.from) && ids.has(r.to)).map(r => ({ id: r.id, from: r.from, to: r.to, kind: r.kind, note: r.note })),
        records
    };
}
/** Records of a part and everything inside it, newest first. */
export function subtreeRecords(v, partId) {
    const inside = new Set(), stack = [partId];
    while (stack.length) {
        const id = stack.pop();
        if (inside.has(id))
            continue;
        inside.add(id);
        stack.push(...(v.parts.find(x => x.id === id)?.childIds ?? []));
    }
    return v.records.filter(r => r.partId !== null && inside.has(r.partId));
}
export function partPath(v, partId) {
    const out = [];
    let cur = v.parts.find(x => x.id === partId);
    while (cur && out.length < 64) {
        out.unshift(cur);
        cur = cur.parentId ? v.parts.find(x => x.id === cur.parentId) : undefined;
    }
    return out;
}
/* ---------- studio.1: ask about one part. Stateless: the browser sends the part's material, the server forwards it. ---------- */
export const STUDIO_SCHEMA = 'studio.1';
export const ASK_BYTES = 65536;
export const ASK_RECORDS = 14;
export const RECORD_CHARS = 2400;
export function buildAsk(p, v, partId, intent, question) {
    const part = v.parts.find(x => x.id === partId);
    if (!part)
        throw new Error('PART_MISSING');
    const name = (id) => v.parts.find(x => x.id === id)?.name ?? '';
    const refs = new Map();
    const records = subtreeRecords(v, partId).slice(0, ASK_RECORDS).map((r, i) => {
        const ref = `R${i + 1}`;
        refs.set(ref, r.id);
        return { ref, kind: r.kind, at: r.at, part: name(r.partId), text: r.text.slice(0, RECORD_CHARS), cut: r.text.length > RECORD_CHARS };
    });
    return { refs, ask: {
            version: STUDIO_SCHEMA, intent, question: intent === 'question' ? question : null,
            project: { name: p.name, purpose: p.space.brief?.text.slice(0, 2000) ?? null },
            part: { name: part.name, note: part.note.slice(0, 2000), path: partPath(v, partId).map(x => x.name),
                children: part.childIds.map(id => ({ name: name(id), status: v.parts.find(x => x.id === id).status })),
                links: v.relations.filter(r => r.from === partId || r.to === partId).map(r => ({ other: name(r.from === partId ? r.to : r.from), direction: r.from === partId ? 'to' : 'from', kind: r.kind, note: r.note.slice(0, 300) })) },
            current: { summary: part.summary?.slice(0, 2000) ?? null, changes: part.changes.slice(0, 6) },
            records
        } };
}
export class StudioError extends Error {
    constructor(code) { super(code); this.name = 'StudioError'; }
}
const fail = (code = 'INVALID_INPUT') => { throw new StudioError(code); };
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
function keys(v, allowed, code) {
    if (!isObj(v))
        fail(code);
    const o = v;
    if (Object.keys(o).length !== allowed.length || !allowed.every(k => k in o))
        fail(code);
    return o;
}
function str(v, max, empty = false, code) {
    if (typeof v !== 'string' || v.length > max || (!empty && !v.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))
        fail(code);
    return v;
}
function arr(v, max, code) { if (!Array.isArray(v) || v.length > max)
    fail(code); return v; }
const STATUSES = ['plan', 'active', 'reported', 'check'], KINDS = ['request', 'report', 'evidence', 'answer', 'decision'], RELS = ['flow', 'needs', 'shares', 'related'];
export function validateAsk(v) {
    const o = keys(v, ['version', 'intent', 'question', 'project', 'part', 'current', 'records']);
    if (o.version !== STUDIO_SCHEMA)
        fail('UNSUPPORTED_VERSION');
    if (!['summary', 'next', 'question'].includes(o.intent))
        fail();
    if (o.intent === 'question')
        str(o.question, 1000);
    else if (o.question !== null)
        fail();
    const pr = keys(o.project, ['name', 'purpose']);
    str(pr.name, 120);
    if (pr.purpose !== null)
        str(pr.purpose, 2000);
    const pa = keys(o.part, ['name', 'note', 'path', 'children', 'links']);
    str(pa.name, 60);
    str(pa.note, 2000, true);
    for (const x of arr(pa.path, 64))
        str(x, 60);
    for (const c of arr(pa.children, 200)) {
        const x = keys(c, ['name', 'status']);
        str(x.name, 60);
        if (!STATUSES.includes(x.status))
            fail();
    }
    for (const l of arr(pa.links, 200)) {
        const x = keys(l, ['other', 'direction', 'kind', 'note']);
        str(x.other, 60);
        if (!['to', 'from'].includes(x.direction) || !RELS.includes(x.kind))
            fail();
        str(x.note, 300, true);
    }
    const cu = keys(o.current, ['summary', 'changes']);
    if (cu.summary !== null)
        str(cu.summary, 2000);
    for (const c of arr(cu.changes, 6))
        str(c, 300);
    const seen = new Set();
    for (const r of arr(o.records, ASK_RECORDS)) {
        const x = keys(r, ['ref', 'kind', 'at', 'part', 'text', 'cut']);
        if (typeof x.ref !== 'string' || !/^R\d{1,2}$/.test(x.ref) || seen.has(x.ref))
            fail();
        seen.add(x.ref);
        if (!KINDS.includes(x.kind) || typeof x.cut !== 'boolean')
            fail();
        str(x.at, 30);
        str(x.part, 60);
        str(x.text, RECORD_CHARS);
    }
    return structuredClone(o);
}
/** The model's reply: exact keys, bounded strings, and refs only to records that were actually sent. */
export function validateReply(v, ask) {
    const code = 'INVALID_RESPONSE';
    const o = keys(v, ['headline', 'situation', 'changes', 'next', 'answer', 'refs'], code);
    const headline = str(o.headline, 160, false, code).trim();
    const list = (x, max, min = 0) => { const a = arr(x, max, code).map(s => str(s, 400, false, code).trim()); if (a.length < min)
        fail(code); return a; };
    const situation = list(o.situation, 4, ask.intent === 'summary' ? 1 : 0), changes = list(o.changes, 4), next = list(o.next, 3);
    const answer = o.answer === null ? null : str(o.answer, 1600, false, code).trim();
    if (ask.intent === 'question' && answer === null)
        fail(code);
    const known = new Set(ask.records.map(r => r.ref)), refs = arr(o.refs, ASK_RECORDS, code).map(r => str(r, 4, false, code));
    if (refs.some(r => !known.has(r)) || new Set(refs).size !== refs.length)
        fail(code);
    return { headline, situation, changes, next, answer, refs };
}
