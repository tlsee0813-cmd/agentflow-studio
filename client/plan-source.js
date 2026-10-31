import { createProject, rename, setBrief, addArea, addChildArea, addRelation } from '../shared/domain.js';
import { parseProject } from '../shared/validation.js';
import { partPath, RECORD_LABEL, clip } from '../shared/studio.js';
import { CONVERTER_PARTS, CONVERTER_RELATIONS, CONVERTER_INTENT, converterEvidence } from '../shared/change-plan-example.js';
import { parsePlanAnalysis } from '../shared/change-plan.js';
import { SCOPE_BYTES } from '../shared/scope-api.js';
import { PLAN_BYTES, allowsNoChange } from '../shared/plan-api.js';
import { fullTime } from './plan-dom.js';
import { CLAIM_LABEL } from '../shared/map-reading.js';
import { secretLike } from '../shared/secret.js';
import { EVIDENCE_KIND_LABEL, NOT_EXECUTED, provenanceLine } from '../shared/record-source.js';
import { authoringAsk } from '../shared/authoring-context.js';
export const CONVERTER_KEY = 'ex-converter';
export const CONDITION_LABEL = { A: '파일별 결과가 있는 코드', B: '파일별 결과가 없는 코드' };
/** The converter map: areas, children and relations only (no records, returns or anchors). */
export function buildConverterProject() {
    let p = setBrief(rename(createProject(), '문서 변환기'), '마크다운 문서를 PDF와 docx로 바꾸는 도구. 본문·표·문단 모양을 그대로 옮긴다.');
    const ids = {};
    for (const part of CONVERTER_PARTS) {
        p = part.parent ? addChildArea(p, ids[part.parent], part.name, part.note) : addArea(p, part.name, part.note);
        ids[part.key] = p.space.areas.at(-1).id;
    }
    for (const [from, to, kind, note] of CONVERTER_RELATIONS)
        p = addRelation(p, ids[from], ids[to], kind, note);
    return parseProject(JSON.stringify({ ...p, notice: null }));
}
/** Stable keys of the converter parts (CONVERTER_PARTS order is the area order). */
export function converterKeys(p) {
    const keys = new Map();
    CONVERTER_PARTS.forEach((part, i) => { const area = p.space.areas[i]; if (area)
        keys.set(part.key, area.id); });
    return keys;
}
const EVIDENCE_KIND = { request: 'user', answer: 'user', decision: 'user', report: 'report', evidence: 'test' };
export const EVIDENCE_LABEL = { user: '사용자 발언', report: '담당 보고', code: '코드 자료', test: '검사', record: '붙여넣은 기록', reading: '기록에서 읽은 이해' };
const TEXT_MAX = 12000;
/** The plan contract refuses control characters; records may carry them from pasted terminal output. */
const clean = (text) => text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ');
/** Looks like a credential: never sent, the person is told which text holds it (one rule, shared with the domain). */
export { secretLike } from '../shared/secret.js';
const bytes = (v) => new TextEncoder().encode(JSON.stringify(v)).length;
/** The draft sentence as its own source, so the model can ground items in what was written now rather than an older plan. */
export function intentEvidence(intent, example) {
    return { id: 'INTENT', kind: 'user', title: '지금 쓴 변경 구상', text: clip(clean(intent.trim()), TEXT_MAX),
        basis: example ? '변경 구상 초안 · 지금 입력한 문장이 이번 분석의 기준 · R03·R04는 예제에 앞서 기록된 구상' : '변경 구상 초안 · 지금 입력한 문장이 이번 분석의 기준' };
}
/** The person's added material (taken from the return reading) is read with the example's own, as in a saved project. */
export function exampleInput(o, condition, intent, keys, extra = [], authoring = { state: 'unrecorded' }) {
    const changed = intent.trim() !== CONVERTER_INTENT;
    const evidence = [...converterEvidence(condition), ...(changed ? [intentEvidence(intent, true)] : []), ...extra];
    const parts = new Map([...keys].map(([k, id]) => [k, id]));
    const toKey = new Map([...keys].map(([k, id]) => [id, k]));
    const ctx = authoringAsk(authoring, o.project.id, o.view.parts, toKey);
    const ask = { schemaVersion: 'studio.plan.3', intent: intent.trim(),
        parts: o.view.parts.map(p => ({ id: toKey.get(p.id), name: p.name, note: p.note, parentId: p.parentId ? toKey.get(p.parentId) : null })), evidence, authoring: ctx.ask };
    return finish({ evidence, ask, parts, records: { total: 0, sent: 0 }, problem: null, basis: `합성 예제 자료 · ${CONDITION_LABEL[condition]} · main@S0`, analyzed: { authoring, missing: ctx.missing } });
}
/** A saved project's own material, newest first, as whole sources until the request's byte limit: what the map readings understood
 * per part (derived, kind 'reading'), then records pasted as they came (kind 'record', never promoted to a request, report or
 * check) and the project's own records, by time. Nothing is cut silently: the count left out is shown before sending and kept. */
/* The draft's authoring context goes as its own field (studio.plan.2, sent now as studio.plan.3): every part is still sent, and the context's parts under this
 * request's aliases. It counts toward the byte limit before any record is added. */
export function projectInput(o, intent, extra = [], authoring = { state: 'unrecorded' }) {
    const v = o.view, parts = new Map(), alias = new Map();
    v.parts.forEach((p, i) => { const a = `P${String(i + 1).padStart(2, '0')}`; parts.set(a, p.id); alias.set(p.id, a); });
    const ctx = authoringAsk(authoring, o.project.id, v.parts, alias);
    const ask = { schemaVersion: 'studio.plan.3', intent: intent.trim(),
        parts: v.parts.map(p => ({ id: alias.get(p.id), name: clip(p.name, 200), note: clip(p.note, 3000), parentId: p.parentId ? alias.get(p.parentId) : null })),
        evidence: [intentEvidence(intent, false)], authoring: ctx.ask };
    const brief = o.project.space.brief?.text?.trim();
    if (brief)
        ask.evidence.push({ id: 'BRIEF', kind: 'user', title: '프로젝트 목적', text: clip(clean(brief), TEXT_MAX), basis: `프로젝트에 적힌 목적 · ${fullTime(o.project.space.brief.at)}` });
    ask.evidence.push(...extra);
    const pasted = [...o.project.pasted].reverse(), total = v.records.length + pasted.length;
    const input = { evidence: ask.evidence, ask, parts, records: { total, sent: 0 }, problem: null,
        basis: `프로젝트 기록 ${total}개 · 판 ${o.project.revision} · ${fullTime(new Date().toISOString())}`, analyzed: { authoring, missing: ctx.missing } };
    if (bytes(ask) > PLAN_BYTES)
        return finish({ ...input, problem: 'TOO_LARGE' });
    // What was read per part: small, so it goes first; each line keeps its kind, its version as the record named it, its quote and
    // the id of the record it quotes in this same request (N.. pasted, E.. project records), and says it is not verified.
    const recordRef = new Map([...pasted.map((r, i) => [r.id, `N${String(i + 1).padStart(2, '0')}`]), ...v.records.map((r, i) => [r.id, `E${String(i + 1).padStart(2, '0')}`])]);
    input.origins = Object.fromEntries([...recordRef].map(([record, ref]) => [ref, [{ record, reading: null, quote: null }]]));
    const cite = (q) => `“${q.quote}”${recordRef.has(q.record) ? ` (${recordRef.get(q.record)})` : ''}`;
    let m = 0;
    for (const p of v.parts) {
        const u = p.reading;
        if (!u || ask.evidence.length >= 24)
            continue;
        const lines = [
            u.role ? `설명${u.corrected ? '(사용자가 바로잡음)' : ''}${u.roleAbout ? ` · ${u.roleAbout} 기준` : u.corrected ? '' : ' · 판본 미기재'}: ${u.role}${u.roleBasis.length ? ` — ${u.roleBasis.slice(0, 2).map(cite).join(' / ')}` : ''}` : '',
            ...u.others.slice(0, 2).map(x => `다른 기록의 설명(현재 설명을 대체한다는 근거 없음)${x.about ? ` · ${x.about}` : ''}: ${x.text}`),
            ...u.claims.slice(0, 6).map(c => `- [${CLAIM_LABEL[c.kind]}${c.about ? ` · ${c.about}` : ''}] ${c.text} — ${cite(c)}`)
        ].filter(Boolean);
        if (!lines.length)
            continue;
        const e = { id: `M${String(++m).padStart(2, '0')}`, kind: 'reading', title: clip(`${partPath(v, p.id).map(x => x.name).join(' › ')} · 기록에서 읽은 이해`, 200),
            text: clip(clean(lines.join('\n')), 3000), basis: clip(`붙여넣은 기록을 AI가 읽어 정리한 이해 · 앱이 확인한 사실 아님 · ${fullTime(u.history.at(-1).at)}`, 2000) };
        ask.evidence.push(e);
        if (bytes(ask) > PLAN_BYTES - 64) {
            ask.evidence.pop();
            m--;
            break;
        }
        input.origins[e.id] = [...(u.corrected ? [{ record: null, reading: u.corrected.id, quote: null }] : []), ...u.roleBasis.map(q => ({ record: q.record, reading: null, quote: q.quote })), ...u.claims.slice(0, 6).map(c => ({ record: c.record, reading: c.reading, quote: c.quote }))].slice(0, 16);
    }
    const items = [
        // A provided source stays a record here too: its kind, name, version and origin are the person's declaration, never a check.
        ...pasted.map((r, i) => ({ at: r.at, e: { id: `N${String(i + 1).padStart(2, '0')}`, kind: 'record', title: clip(r.evidence ? `사용자 제공 ${EVIDENCE_KIND_LABEL[r.evidence.kind]} · ${r.evidence.name}` : `붙여넣은 기록 · ${r.text.split('\n').find(l => l.trim())?.trim() ?? ''}`, 200),
                text: clip(clean(r.text), TEXT_MAX), basis: clip(`${r.evidence ? `${NOT_EXECUTED} · ${provenanceLine(r.evidence)} · 가져온 시각` : '붙여넣은 원문 그대로 · 요구·보고·검사가 섞일 수 있음 · 붙여넣은 시각'} ${fullTime(r.at)}(원문 작성·판본 시각 아님)${r.text.length > TEXT_MAX ? ` · 앞 ${TEXT_MAX}자` : ''}`, 2000) } })),
        ...v.records.map((r, i) => {
            const part = r.partId ? partPath(v, r.partId).map(x => x.name).join(' › ') : '부분 미지정';
            return { at: r.at, e: { id: `E${String(i + 1).padStart(2, '0')}`, kind: EVIDENCE_KIND[r.kind], title: clip(`${part.split(' › ').at(-1)} · ${RECORD_LABEL[r.kind]}`, 200),
                    text: clip(clean(r.text), TEXT_MAX), basis: clip(`프로젝트 기록 · ${fullTime(r.at)} · ${part}${r.text.length > TEXT_MAX ? ` · 앞 ${TEXT_MAX}자` : ''}`, 2000) } };
        })
    ].sort((a, b) => b.at.localeCompare(a.at));
    for (const { e } of items) {
        if (ask.evidence.length >= 48)
            break;
        ask.evidence.push(e);
        if (bytes(ask) > PLAN_BYTES - 64) {
            ask.evidence.pop();
            break;
        }
        input.records.sent++;
    }
    input.basis = `프로젝트 기록 ${input.records.sent === total ? `${total}개` : `${total}개 중 최신 ${input.records.sent}개`}${m ? ` + 읽은 이해 ${m}개` : ''}${extra.length ? ` + 붙인 자료 ${extra.length}개` : ''} · 판 ${o.project.revision} · ${fullTime(new Date().toISOString())}`;
    input.origins = Object.fromEntries(Object.entries(input.origins).filter(([ref]) => ask.evidence.some(e => e.id === ref)));
    return finish(input);
}
function finish(input) {
    if (input.problem)
        return input;
    if (bytes(input.ask) > PLAN_BYTES)
        return { ...input, problem: 'TOO_LARGE' };
    if (secretLike(input.ask.intent))
        return { ...input, problem: { secret: '변경 구상 문장' } };
    const ctx = input.ask.authoring;
    if (ctx?.state === 'recorded' && [ctx.selection, ctx.scope].some(r => r && secretLike(r.nameThen)))
        return { ...input, problem: { secret: '작성 맥락' } };
    const leak = input.ask.evidence.find(e => secretLike(e.text) || secretLike(e.title));
    return leak ? { ...input, problem: { secret: leak.title } } : input;
}
/** Validates the reply against what was sent, then maps aliases back to the real part ids (sources keep their aliases). */
export function mapReply(reply, input) {
    const sent = parsePlanAnalysis(reply, [...input.parts.keys()], input.evidence.map(e => e.id));
    if (!sent.items.length && !allowsNoChange(input.ask))
        throw new Error('INVALID_CHANGE_PLAN');
    const real = (a) => input.parts.get(a);
    const mapped = { ...sent, items: sent.items.map(i => ({ ...i, partIds: i.partIds.map(real),
            ...(i.presentation ? { presentation: i.presentation.map(p => ({ ...p, partId: real(p.partId) })) } : {}) })), impacts: sent.impacts.map(x => ({ ...x, partId: real(x.partId) })) };
    return parsePlanAnalysis(mapped, [...input.parts.values()], input.evidence.map(e => e.id));
}
/** The request-scope review: the plan's own evidence and only the chosen items (their parts under the same aliases as an
 * analysis of the map as it is now), plus the titles left out. Same refusals as an analysis: nothing is cut or hidden. */
export function scopeInput(o, plan) {
    const toAlias = new Map();
    if (o.key === CONVERTER_KEY && o.alias)
        for (const [k, id] of o.alias.toId)
            toAlias.set(id, k);
    else
        o.view.parts.forEach((p, i) => toAlias.set(p.id, `P${String(i + 1).padStart(2, '0')}`));
    const chosen = plan.analysis.items.filter(i => plan.selected.includes(i.id));
    const ask = { schemaVersion: 'studio.scope.1', intent: plan.intent,
        parts: o.view.parts.map(p => ({ id: toAlias.get(p.id), name: clip(p.name, 200), note: clip(p.note, 3000), parentId: p.parentId ? toAlias.get(p.parentId) : null })),
        evidence: plan.evidence,
        // A part removed from the map since the analysis has no alias now; the item keeps its words and sources.
        selected: chosen.map(i => ({ id: i.id, title: i.title, description: i.description, partIds: i.partIds.map(id => toAlias.get(id)).filter((x) => !!x), refs: i.refs })),
        excluded: [...new Set(plan.analysis.items.filter(i => !plan.selected.includes(i.id)).map(i => i.title))] };
    if (bytes(ask) > SCOPE_BYTES)
        return { ask, problem: 'TOO_LARGE' };
    if (secretLike(plan.intent) || chosen.some(i => secretLike(i.title) || secretLike(i.description)))
        return { ask, problem: { secret: '변경안 항목' } };
    const leak = plan.evidence.find(e => secretLike(e.text) || secretLike(e.title));
    return { ask, problem: leak ? { secret: leak.title } : null };
}
