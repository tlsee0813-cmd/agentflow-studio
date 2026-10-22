import { API_SCHEMA, SCHEMA, V5_SCHEMA, V4_SCHEMA, V3_SCHEMA, PREVIOUS_SCHEMA, LEGACY_SCHEMA, RESULT_SCHEMA, RESULT2_SCHEMA, RESULT_BYTES, RESULT_TEXT_LIMIT, TEXT_LIMIT, FILE_LIMIT, ITEM_LIMIT, REQUEST_BYTES, GUIDE_SCHEMA } from './types.js';
export class ContextError extends Error {
    constructor(code) { super(code); this.name = 'ContextError'; }
}
export function ensure(condition, code = 'INVALID_DATA') { if (!condition)
    throw new ContextError(code); }
function obj(v, keys) {
    ensure(v !== null && typeof v === 'object' && !Array.isArray(v));
    ensure(Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k)));
}
export function text(v, max = TEXT_LIMIT, empty = false) {
    ensure(typeof v === 'string' && v.length <= max && (empty || !!v.trim()) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v));
}
function list(v, max = ITEM_LIMIT) { ensure(Array.isArray(v) && v.length <= max); }
function integer(v) { ensure(Number.isSafeInteger(v) && v >= 0); }
function id(v) { text(v, 100); ensure(/^[A-Za-z0-9_-]+$/.test(v)); }
function date(v) { text(v, 30); ensure(Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v); }
function unique(items) { ensure(new Set(items.map(x => x.id)).size === items.length); }
/** A file is untrusted data, not an authenticated execution receipt. Never repair/truncate it. */
export function parseResultFile(raw) {
    ensure(typeof raw === 'string' && new TextEncoder().encode(raw).length <= RESULT_BYTES, 'RESULT_TOO_LARGE');
    ensure(!raw.startsWith('\uFEFF'), 'INVALID_RESULT_FILE');
    const v = JSON.parse(raw);
    // AREA17: return.2 = return.1 + one required 'understanding' key (null or an organised area description).
    const two = !!v && typeof v === 'object' && v.schemaVersion === RESULT2_SCHEMA;
    obj(v, ['schemaVersion', 'projectId', 'taskId', 'returnId', 'report', 'evidence', ...(two ? ['understanding'] : [])]);
    ensure(v.schemaVersion === RESULT_SCHEMA || two, 'INVALID_RESULT_FILE');
    if (two && v.understanding !== null)
        understandingInput(v.understanding);
    id(v.projectId);
    id(v.taskId);
    id(v.returnId);
    text(v.report, RESULT_TEXT_LIMIT);
    if (v.evidence !== null)
        text(v.evidence, RESULT_TEXT_LIMIT);
    return v;
}
/** AREA17 limits: a short current description, at most three key changes, one optional proposal. Never repaired. */
export const SUMMARY_LIMIT = 2000, CHANGE_LIMIT = 300, PROPOSAL_LIMIT = 1000;
function understandingInput(v) {
    obj(v, ['version', 'areaId', 'basedOn', 'summary', 'changes', 'proposal', 'origin']);
    ensure(v.version === 'understanding.1');
    id(v.areaId);
    integer(v.basedOn);
    text(v.summary, SUMMARY_LIMIT);
    list(v.changes, 3);
    for (const c of v.changes)
        text(c, CHANGE_LIMIT);
    if (v.proposal !== null)
        text(v.proposal, PROPOSAL_LIMIT);
    text(v.origin, 200);
}
/** Prefix is Studio metadata; the following external field remains character-for-character intact. */
export function resultSourceText(f, revision, kind) {
    const prefix = `[Studio 연결 표지 — 외부 파일의 주장과 구분]\n이 자료는 작업 ${f.taskId}의 인계 ${f.returnId} / r${revision}에 대한 반환이다. 현재 조건 충족·사용자 결정·실제 완료를 뜻하지 않는다.\n[외부 ${kind} 원문]\n`;
    ensure(prefix.length <= TEXT_LIMIT - RESULT_TEXT_LIMIT);
    const value = f[kind];
    ensure(value !== null);
    const result = prefix + value;
    text(result);
    return result;
}
function source(v) {
    obj(v, ['id', 'kind', 'text', 'at', 'taskId', 'replyTo', 'disposition']);
    id(v.id);
    id(v.taskId);
    text(v.text);
    date(v.at);
    ensure(['request', 'report', 'evidence', 'test_answer', 'answer', 'manual_decision'].includes(v.kind));
    ensure(['provided', 'unknown', 'deferred'].includes(v.disposition));
    if (v.replyTo !== null)
        text(v.replyTo, 2000);
}
const STATUSES = ['requested', 'answered', 'confirmed', 'deferred'];
function basis(v) {
    obj(v, ['id', 'text', 'status', 'sourceId', 'revision', 'history']);
    id(v.id);
    text(v.text);
    id(v.sourceId);
    integer(v.revision);
    ensure(STATUSES.includes(v.status));
    list(v.history);
    for (const h of v.history) {
        obj(h, ['text', 'status', 'sourceId', 'revision']);
        text(h.text);
        id(h.sourceId);
        integer(h.revision);
        ensure(['requested', 'answered', 'confirmed', 'deferred'].includes(h.status));
    }
}
/** FLOW091-C: a fixed plan copy. Same length limits as the plan itself; empty values are null, never placeholder words.
 * The area may since have been renamed, archived or moved: the copy does not refer to the current area list. */
export function background(v, maxRevision) {
    if (v === null)
        return;
    obj(v, ['version', 'revision', 'brief', 'area']);
    ensure(v.version === 'background.1');
    integer(v.revision);
    if (maxRevision !== undefined)
        ensure(v.revision <= maxRevision);
    if (v.brief !== null)
        text(v.brief, TEXT_LIMIT);
    if (v.area !== null) {
        obj(v.area, ['id', 'name', 'note']);
        id(v.area.id);
        text(v.area.name, 60);
        if (v.area.note !== null)
            text(v.area.note, 2000);
    }
}
function ticket(v) { obj(v, ['projectId', 'revision', 'requestId', 'taskId']); id(v.projectId); integer(v.revision); id(v.requestId); id(v.taskId); }
export function validateIntent(v) {
    obj(v, ['version', 'relation', 'goal', 'conditions', 'retired', 'basisRefs']);
    ensure(v.version === 'intent.1');
    ensure(['start', 'continue', 'revise', 'separate', 'uncertain'].includes(v.relation));
    text(v.goal, 2000);
    for (const key of ['conditions', 'retired']) {
        list(v[key], 12);
        for (const value of v[key])
            text(value, 1000);
    }
    list(v.basisRefs);
    const seen = new Set();
    for (const ref of v.basisRefs) {
        obj(ref, ['basisId', 'sourceId', 'revision']);
        id(ref.basisId);
        id(ref.sourceId);
        integer(ref.revision);
        ensure(!seen.has(ref.basisId));
        seen.add(ref.basisId);
    }
    return structuredClone(v);
}
function checkIntentRefs(value, bases) {
    for (const ref of value.basisRefs)
        ensure(bases.some(b => b.id === ref.basisId && b.sourceId === ref.sourceId && b.revision === ref.revision && !b.partial));
}
/** Old eight-key advice remains readable; new wire responses use intent.1. */
export function validateAdvice(v, basisIds, request) {
    const hasIntent = !!v && typeof v === 'object' && Object.hasOwn(v, 'intent');
    obj(v, ['understanding', 'scope', 'next', 'checks', 'question', 'relatedBasisIds', 'reviewBasisIds', 'suggestions', ...(hasIntent ? ['intent'] : [])]);
    if (request)
        ensure(hasIntent);
    if (hasIntent) {
        const value = validateIntent(v.intent);
        for (const ref of value.basisRefs)
            ensure(basisIds.includes(ref.basisId));
        if (request) {
            checkIntentRefs(value, request.bases);
            // Structural contradictions: an independent purpose replaces nothing; one sentence cannot be both kept and retired.
            ensure(value.relation !== 'separate' || value.retired.length === 0);
            const kept = new Set(value.conditions.map(c => c.trim()));
            ensure(value.retired.every(r => !kept.has(r.trim())));
            // All current user basis versions must be acknowledged, including unknown/deferred answers.
            for (const b of request.bases.filter(b => request.appFacts.inputs.some(s => s.sourceId === b.sourceId)))
                ensure(value.basisRefs.some(ref => ref.basisId === b.id));
        }
    }
    for (const k of ['understanding', 'scope', 'next', 'checks'])
        text(v[k], 6000);
    for (const k of ['relatedBasisIds', 'reviewBasisIds']) {
        list(v[k]);
        const refs = v[k];
        ensure(new Set(refs).size === refs.length);
        for (const ref of refs)
            ensure(typeof ref === 'string' && basisIds.includes(ref));
    }
    list(v.suggestions, 8);
    for (const s of v.suggestions) {
        obj(s, ['text', 'why']);
        text(s.text, 2000);
        text(s.why, 2000);
    }
    if (v.question !== null)
        question(v.question);
    return structuredClone(v);
}
function question(q) {
    obj(q, ['kind', 'text', 'why', 'options']);
    ensure(['fact', 'choice'].includes(q.kind));
    text(q.text, 2000);
    text(q.why, 2000);
    list(q.options, 3);
    ensure(q.kind !== 'fact' || q.options.length === 0);
    for (const o of q.options) {
        obj(o, ['label', 'consequence']);
        text(o.label, 500);
        text(o.consequence, 1000);
    }
}
export function validateEnvelope(v, req) {
    obj(v, ['mode', 'ticket', 'advice']);
    ensure(['mock', 'deepseek'].includes(v.mode));
    ticket(v.ticket);
    ensure(Object.keys(req.ticket).every(k => req.ticket[k] === v.ticket[k]));
    return { mode: v.mode, ticket: { ...v.ticket }, advice: validateAdvice(v.advice, req.bases.map(b => b.id), req) };
}
function contextBasis(v) {
    obj(v, ['id', 'text', 'status', 'sourceId', 'revision', 'previousVersions', 'partial']);
    id(v.id);
    text(v.text);
    id(v.sourceId);
    integer(v.revision);
    integer(v.previousVersions);
    ensure(STATUSES.includes(v.status));
    ensure(typeof v.partial === 'boolean');
}
/** Validate the projection's shape and all references available in this request. The server does not
 * have prior snapshot texts; this is not re-execution, provenance authentication or semantic checking. */
function appFacts(v, req) {
    obj(v, ['taskId', 'inputs', 'records']);
    id(v.taskId);
    ensure(v.taskId === req.ticket.taskId);
    list(v.inputs);
    list(v.records);
    const sources = new Map(req.sources.map(s => [s.id, s])), bases = new Map(req.bases.map(b => [b.id, b]));
    const currentInputs = req.sources.filter(s => s.taskId === req.ticket.taskId), inputIds = new Set();
    for (const input of v.inputs) {
        obj(input, ['sourceId', 'kind']);
        id(input.sourceId);
        const s = sources.get(input.sourceId);
        ensure(s && s.taskId === req.ticket.taskId && input.kind === s.kind && !inputIds.has(s.id));
        inputIds.add(s.id);
    }
    ensure(inputIds.size === currentInputs.length && currentInputs.every(s => inputIds.has(s.id)));
    ensure(inputIds.size > 0);
    const seen = new Set(), currentRecords = new Set();
    for (const f of v.records) {
        obj(f, ['basisId', 'sourceId', 'revision', 'status', 'versionIndex', 'isCurrent', 'kind', 'previousRevision', 'changedFields']);
        id(f.basisId);
        id(f.sourceId);
        integer(f.revision);
        integer(f.versionIndex);
        ensure(STATUSES.includes(f.status));
        ensure(typeof f.isCurrent === 'boolean');
        ensure(['input-retained', 'basis-recorded', 'version-only'].includes(f.kind));
        const b = bases.get(f.basisId), s = sources.get(f.sourceId);
        ensure(b && s && inputIds.has(s.id));
        const index = f.versionIndex, revision = f.revision, key = `${b.id}:${index}`;
        ensure(!seen.has(key));
        seen.add(key);
        ensure(index <= b.previousVersions && f.isCurrent === (index === b.previousVersions));
        ensure(revision <= req.ticket.revision);
        if (f.isCurrent) {
            ensure(revision === b.revision && f.sourceId === b.sourceId && f.status === b.status);
            currentRecords.add(b.id);
        }
        else if (f.kind !== 'version-only')
            ensure(revision < b.revision);
        if (f.previousRevision === null)
            ensure(f.changedFields === null);
        else {
            integer(f.previousRevision);
            ensure(index > 0 && f.previousRevision < revision && f.kind === 'basis-recorded');
            list(f.changedFields, 2);
            ensure(new Set(f.changedFields).size === f.changedFields.length);
            for (const k of f.changedFields)
                ensure(k === 'text' || k === 'status');
        }
        if (f.kind === 'version-only')
            ensure(f.previousRevision === null);
        if (f.kind === 'input-retained') {
            ensure(index === 0 && f.previousRevision === null);
            ensure((s.kind === 'request' && f.status === 'requested') || (s.kind === 'answer' && f.status === 'answered'));
            if (f.isCurrent && s.kind === 'request')
                ensure(!b.partial && b.text === s.text);
        }
        if (f.kind === 'basis-recorded') {
            ensure((s.kind === 'manual_decision' && ['confirmed', 'deferred'].includes(f.status)) ||
                (s.kind === 'request' && index > 0 && f.status !== 'answered'));
            ensure(index === 0 ? f.previousRevision === null : f.previousRevision !== null);
            if (f.isCurrent && s.kind === 'manual_decision')
                ensure(!b.partial && b.text === s.text);
        }
    }
    // Current versions are present in full in this request, so their coverage can be checked exactly.
    for (const b of req.bases)
        if (inputIds.has(b.sourceId))
            ensure(currentRecords.has(b.id));
}
export function validateRequest(v) {
    obj(v, ['schemaVersion', 'ticket', 'projectName', 'sources', 'bases', 'previousWork', 'appFacts', 'previousIntent', 'purposeIntent', 'background']);
    ensure(v.schemaVersion === API_SCHEMA);
    ticket(v.ticket);
    text(v.projectName, 120);
    background(v.background, v.ticket.revision);
    list(v.sources);
    list(v.bases);
    for (const s of v.sources)
        source(s);
    for (const b of v.bases)
        contextBasis(b);
    ensure(v.sources.length > 0);
    unique(v.sources);
    unique(v.bases);
    if (v.previousIntent !== null) {
        obj(v.previousIntent, ['taskId', 'value', 'manualGoal', 'manualConditions']);
        id(v.previousIntent.taskId);
        if (v.previousIntent.value === null)
            text(v.previousIntent.manualGoal, 6000); // A correction only; no AI interpretation is implied.
        else
            checkIntentRefs(validateIntent(v.previousIntent.value), v.bases);
        for (const key of ['manualGoal', 'manualConditions'])
            if (v.previousIntent[key] !== null)
                text(v.previousIntent[key], 6000, true);
    }
    if (v.purposeIntent !== null) {
        ensure(v.previousIntent !== null && v.previousIntent.value?.relation === 'separate');
        obj(v.purposeIntent, ['taskId', 'value', 'manualGoal', 'manualConditions']);
        id(v.purposeIntent.taskId);
        const value = validateIntent(v.purposeIntent.value);
        ensure(value.relation !== 'separate');
        checkIntentRefs(value, v.bases);
        for (const key of ['manualGoal', 'manualConditions'])
            if (v.purposeIntent[key] !== null)
                text(v.purposeIntent[key], 6000, true);
    }
    appFacts(v.appFacts, { ticket: v.ticket, sources: v.sources, bases: v.bases });
    ensure(new TextEncoder().encode(JSON.stringify(v)).length <= REQUEST_BYTES, 'CONTEXT_TOO_LARGE');
    // Bases carry current values; prior versions stay local. Old-request excerpts are budget-dependent.
    if (v.previousWork !== null) {
        obj(v.previousWork, ['taskId', 'understanding', 'scope', 'next', 'checks', 'aiTextExcluded', 'manualConditionFields']);
        id(v.previousWork.taskId);
        ensure(typeof v.previousWork.aiTextExcluded === 'boolean');
        for (const k of ['understanding', 'scope', 'next', 'checks'])
            text(v.previousWork[k], 6000, true);
        list(v.previousWork.manualConditionFields, 2);
        ensure(new Set(v.previousWork.manualConditionFields).size === v.previousWork.manualConditionFields.length);
        for (const k of v.previousWork.manualConditionFields)
            ensure(k === 'scope' || k === 'checks');
    }
    return structuredClone(v);
}
/** Same checks as validateProject without the defensive copy; used on freshly parsed JSON. */
function assertProject(v) {
    obj(v, ['schemaVersion', 'id', 'revision', 'name', 'sources', 'bases', 'tasks', 'currentTaskId', 'draft', 'answerDraft', 'basisDraft', 'basisEdits', 'draftKind', 'pending', 'notice', 'space']);
    ensure(v.schemaVersion === SCHEMA, 'UNSUPPORTED_SCHEMA');
    id(v.id);
    integer(v.revision);
    text(v.name, 120);
    text(v.draft, TEXT_LIMIT, true);
    text(v.answerDraft, TEXT_LIMIT, true);
    text(v.basisDraft, TEXT_LIMIT, true);
    ensure(['request', 'report', 'evidence', 'test_answer'].includes(v.draftKind));
    if (v.notice !== null)
        text(v.notice, 2000);
    list(v.sources);
    list(v.bases);
    list(v.tasks);
    for (const s of v.sources)
        source(s);
    for (const b of v.bases)
        basis(b);
    unique(v.sources);
    unique(v.bases);
    ensure(v.basisEdits !== null && typeof v.basisEdits === 'object' && !Array.isArray(v.basisEdits));
    // Lookups use Map/Set so validation stays linear up to ITEM_LIMIT (no nested scans).
    const basisIds = new Set(v.bases.map(b => b.id));
    for (const [key, value] of Object.entries(v.basisEdits)) {
        ensure(basisIds.has(key));
        text(value, TEXT_LIMIT, true);
    }
    const sources = new Map(v.sources.map(s => [s.id, s]));
    const bids = [...basisIds], basisMap = new Map(v.bases.map(b => [b.id, b]));
    const tasks = new Set(), returns = new Map();
    const areaIds = space(v.space);
    for (const t of v.tasks) {
        const optional = ['intentEdit', 'areaId'].filter(k => t && typeof t === 'object' && Object.hasOwn(t, k));
        obj(t, ['id', 'sourceIds', 'parentTaskId', 'advice', 'adviceRevision', 'mode', 'manual', 'suggestions', 'handoffs', 'resultFile', 'background', ...optional]);
        id(t.id);
        background(t.background, v.revision);
        list(t.sourceIds);
        ensure(t.sourceIds.length > 0);
        for (const s of t.sourceIds)
            ensure(sources.has(s));
        ensure(new Set(t.sourceIds).size === t.sourceIds.length);
        if (t.parentTaskId !== null)
            ensure(tasks.has(t.parentTaskId)); // Ordered, acyclic.
        if (t.areaId !== undefined) { // Only a request task is placed; a returned report follows its parent's area.
            ensure(typeof t.areaId === 'string' && areaIds.has(t.areaId));
            ensure(!['report', 'evidence'].includes(sources.get(t.sourceIds[0]).kind));
        }
        if (t.intentEdit !== undefined) {
            const legacy = !!t.intentEdit && typeof t.intentEdit === 'object' && t.intentEdit.version === 'intent-edit.1';
            obj(t.intentEdit, legacy ? ['version', 'revision'] : ['version', 'revision', 'goal', 'conditions']);
            ensure(legacy || t.intentEdit.version === 'intent-edit.2');
            integer(t.intentEdit.revision);
            ensure(t.intentEdit.revision <= v.revision);
            if (!legacy && t.intentEdit.goal === null)
                ensure(t.intentEdit.conditions === null);
            else if (!legacy) {
                text(t.intentEdit.goal, 6000);
                text(t.intentEdit.conditions, 6000, true);
            }
        }
        if (t.advice !== null) {
            const advice = validateAdvice(t.advice, bids);
            for (const ref of advice.intent?.basisRefs ?? []) {
                const b = basisMap.get(ref.basisId);
                ensure([b, ...b.history].some(b => b.sourceId === ref.sourceId && b.revision === ref.revision));
                if (t.adviceRevision !== null)
                    ensure(ref.revision <= t.adviceRevision);
            }
        }
        ensure([null, 'mock', 'deepseek'].includes(t.mode));
        // null with advice = imported from project.1, when the basis revision behind the advice was not recorded.
        if (t.adviceRevision !== null) {
            ensure(t.advice !== null);
            integer(t.adviceRevision);
            ensure(t.adviceRevision <= v.revision);
        }
        obj(t.manual, ['understanding', 'scope', 'next', 'checks']);
        for (const k of Object.keys(t.manual))
            if (t.manual[k] !== null)
                text(t.manual[k], 6000, true);
        if (t.suggestions !== null) {
            list(t.suggestions, 8);
            for (const s of t.suggestions) {
                obj(s, ['text', 'why']);
                text(s.text, 2000, true);
                text(s.why, 2000, true);
            }
        }
        list(t.handoffs);
        for (const h of t.handoffs) {
            obj(h, ['at', 'method', 'revision', 'chars', 'digest', 'work', 'aiExcluded', 'legacyText', 'returnId', 'background', 'anchor']);
            date(h.at);
            background(h.background, v.revision);
            if (h.anchor !== null) {
                ensure(h.returnId !== null);
                obj(h.anchor, ['version', 'areaId', 'understanding', 'stamp']);
                ensure(h.anchor.version === 'anchor.1');
                ensure(areaIds.has(h.anchor.areaId));
                integer(h.anchor.understanding);
                planStamp(h.anchor.stamp);
            }
            ensure(['clipboard', 'download'].includes(h.method));
            integer(h.revision);
            ensure(h.revision <= v.revision);
            integer(h.chars);
            ensure(typeof h.digest === 'string' && /^[0-9a-f]{8}$/.test(h.digest));
            ensure(typeof h.aiExcluded === 'boolean');
            if (h.work !== null) {
                obj(h.work, ['understanding', 'scope', 'next', 'checks']);
                for (const k of Object.keys(h.work))
                    text(h.work[k], 6000, true);
            }
            if (h.legacyText !== null)
                text(h.legacyText, 250000);
            if (h.returnId !== null) {
                id(h.returnId);
                ensure(h.work !== null && h.legacyText === null && !returns.has(h.returnId));
                returns.set(h.returnId, { taskId: t.id, record: h });
            }
        }
        if (t.resultFile !== null) {
            obj(t.resultFile, ['returnId', 'rawText']);
            id(t.resultFile.returnId);
            ensure(typeof t.resultFile.rawText === 'string');
            const f = parseResultFile(t.resultFile.rawText), target = returns.get(f.returnId);
            ensure(target && tasks.has(target.taskId) && f.projectId === v.id && f.taskId === t.parentTaskId && f.taskId === target.taskId && f.returnId === t.resultFile.returnId);
            const kinds = f.evidence === null ? ['report'] : ['report', 'evidence'];
            for (const [index, kind] of kinds.entries()) {
                const s = sources.get(t.sourceIds[index]);
                ensure(s && s.taskId === t.id && s.kind === kind && s.replyTo === null && s.disposition === 'provided' && s.text === resultSourceText(f, target.record.revision, kind));
            }
            // Later real answers/manual decisions on this task remain legal; never require an exact source count.
        }
        ensure(!tasks.has(t.id));
        tasks.add(t.id);
    }
    for (const s of sources.values())
        ensure(tasks.has(s.taskId));
    understandingRefs(v.space, v.tasks, sources);
    // Imported reports or synthetic answers cannot masquerade as an authoritative decision.
    for (const b of v.bases) {
        ensure(/^D[1-9]\d*$/.test(b.id));
        for (const value of [...b.history, b]) {
            const s = sources.get(value.sourceId);
            ensure(s && ['request', 'manual_decision', 'answer'].includes(s.kind));
            if (value.status === 'confirmed' || value.status === 'deferred')
                ensure(['manual_decision', 'request'].includes(s.kind));
            if (value.status === 'requested')
                ensure(s.kind === 'request');
            if (value.status === 'answered')
                ensure(s.kind === 'answer');
            ensure(value.revision <= v.revision);
        }
    }
    if (v.currentTaskId !== null)
        ensure(tasks.has(v.currentTaskId));
    if (v.pending !== null) {
        ticket(v.pending);
        ensure(v.pending.projectId === v.id && tasks.has(v.pending.taskId) && v.pending.revision <= v.revision);
    }
}
/** FLOW090 plan data: the user's purpose text, areas and typed relations. Returns the area IDs. */
function space(v) {
    obj(v, ['brief', 'areas', 'relations', 'draftTarget', 'layout', 'understanding']);
    if (v.brief !== null) {
        obj(v.brief, ['text', 'at', 'previous']);
        text(v.brief.text, TEXT_LIMIT);
        date(v.brief.at);
        list(v.brief.previous, 200);
        for (const old of v.brief.previous) {
            obj(old, ['text', 'at']);
            text(old.text, TEXT_LIMIT);
            date(old.at);
        }
    }
    list(v.areas, 500);
    list(v.relations, 2000);
    for (const a of v.areas) {
        obj(a, ['id', 'name', 'note', 'archived', 'createdAt']);
        id(a.id);
        text(a.name, 60);
        text(a.note, 2000, true);
        ensure(typeof a.archived === 'boolean');
        date(a.createdAt);
    }
    unique(v.areas);
    const ids = new Set(v.areas.map(a => a.id));
    for (const r of v.relations) {
        obj(r, ['id', 'from', 'to', 'kind', 'note']);
        id(r.id);
        ensure(ids.has(r.from) && ids.has(r.to) && r.from !== r.to);
        ensure(['flow', 'needs', 'shares', 'related'].includes(r.kind));
        text(r.note, 200, true);
    }
    unique(v.relations);
    if (v.draftTarget !== null) {
        obj(v.draftTarget, ['area']);
        ensure(v.draftTarget.area === null || ids.has(v.draftTarget.area));
    }
    obj(v.layout, ['version', 'positions']);
    ensure(v.layout.version === 'layout.1');
    const positions = v.layout.positions;
    ensure(!!positions && typeof positions === 'object' && !Array.isArray(positions));
    for (const [key, point] of Object.entries(positions)) {
        ensure(ids.has(key));
        obj(point, ['x', 'y']);
        for (const n of [point.x, point.y])
            ensure(Number.isSafeInteger(n) && Math.abs(n) <= POSITION_LIMIT);
    }
    areaUnderstanding(v.understanding, ids);
    return ids;
}
export const POSITION_LIMIT = 200000;
function planStamp(v) {
    obj(v, ['name', 'note', 'brief', 'decisions', 'work']);
    text(v.name, 60);
    text(v.note, 2000, true);
    integer(v.brief);
    list(v.decisions, ITEM_LIMIT);
    list(v.work, ITEM_LIMIT);
    // One fixed-length entry per task with user-written work values or a purpose correction: '<task id>:<sha256>'. Never the
    // values themselves, so an allowed text (any quotes or backslashes, up to its own limit) cannot make the stamp invalid.
    for (const w of v.work)
        ensure(typeof w === 'string' && /^[A-Za-z0-9_-]{1,100}:[0-9a-f]{64}$/.test(w));
    ensure(new Set(v.work).size === v.work.length);
    for (const d of v.decisions)
        ensure(typeof d === 'string' && /^D[1-9]\d*@\d+$/.test(d));
    ensure(new Set(v.decisions).size === v.decisions.length);
}
const HELD = ['no-anchor', 'area-moved', 'area-mismatch', 'area-archived', 'file-basis', 'superseded', 'plan-changed'];
/** AREA17 shape: per area, a revision counter and its entries in arrival order. Exactly one entry holds each applied revision
 * 1..revision, in increasing order; held entries have no revision and no stamp. References are checked after the tasks. */
function areaUnderstanding(v, ids) {
    ensure(!!v && typeof v === 'object' && !Array.isArray(v));
    for (const [areaId, state] of Object.entries(v)) {
        ensure(ids.has(areaId));
        obj(state, ['revision', 'entries']);
        integer(state.revision);
        list(state.entries, ITEM_LIMIT);
        let last = 0;
        for (const e of state.entries) {
            obj(e, ['by', 'at', 'revision', 'taskId', 'returnId', 'text', 'corrects', 'stamp', 'held']);
            date(e.at);
            ensure(e.by === 'external' || e.by === 'user');
            if (e.revision === null) {
                ensure(e.by === 'external' && e.stamp === null && HELD.includes(e.held));
            }
            else {
                integer(e.revision);
                ensure(e.revision === last + 1 && e.held === null);
                last = e.revision;
                planStamp(e.stamp);
            }
            if (e.by === 'external') {
                id(e.taskId);
                id(e.returnId);
                ensure(e.text === null && e.corrects === null);
            }
            else {
                ensure(e.taskId === null && e.returnId === null && e.revision !== null);
                text(e.text, SUMMARY_LIMIT);
                integer(e.corrects);
                ensure(e.corrects >= 1 && e.corrects === e.revision - 1);
            }
        }
        ensure(last === state.revision);
    }
}
/** External entries point at a received return task whose own return.2 file carries an organised description. An applied
 * one must describe the area it is filed under; one task is filed once. */
function understandingRefs(space, tasks, sources) {
    const byId = new Map(tasks.map(t => [t.id, t])), seen = new Set();
    const states = space.understanding;
    for (const t of tasks)
        for (const h of t.handoffs)
            if (h.anchor)
                ensure(h.anchor.understanding <= (states[h.anchor.areaId]?.revision ?? 0));
    for (const [areaId, state] of Object.entries(states)) {
        for (const e of state.entries) {
            if (e.by !== 'external')
                continue;
            const t = byId.get(e.taskId);
            ensure(t && t.resultFile && !seen.has(t.id) && ['report', 'evidence'].includes(sources.get(t.sourceIds[0])?.kind ?? ''));
            seen.add(t.id);
            const f = parseResultFile(t.resultFile.rawText);
            ensure(f.returnId === e.returnId && !!f.understanding);
            if (e.revision !== null) {
                const parent = byId.get(t.parentTaskId), record = parent?.handoffs.find(h => h.returnId === f.returnId), anchor = record?.anchor;
                ensure(f.understanding.areaId === areaId && anchor && anchor.areaId === areaId && f.understanding.basedOn === anchor.understanding && anchor.understanding < e.revision);
                ensure(JSON.stringify(e.stamp) === JSON.stringify(anchor.stamp));
                // History: an applied external description follows exactly the revision its export carried, or a revised interpretation of
                // that same export (same returnId) directly before it. Anything in between (a user correction, another return) means it
                // was never applicable; a file claiming otherwise contradicts its own history.
                const prev = state.entries.find(x => x.revision === e.revision - 1);
                ensure(anchor.understanding === e.revision - 1 || !!prev && prev.by === 'external' && prev.returnId === e.returnId);
            }
        }
    }
}
/** The project.4/5 shape of an empty space (project.6 adds 'understanding' in migrateV5). */
export const EMPTY_SPACE = () => ({ brief: null, areas: [], relations: [], draftTarget: null, layout: { version: 'layout.1', positions: {} } });
export function validateProject(v) { assertProject(v); return structuredClone(v); }
/** Identity check for an exported text (FNV-1a, 32 bit). Not a signature or security control. */
export function digest(value) {
    let h = 0x811c9dc5;
    for (let i = 0; i < value.length; i++) {
        h ^= value.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
}
/** AREA17: SHA-256 (FIPS 180-4) of the UTF-8 bytes, hex. Synchronous and dependency-free so the shared code computes the same
 * fixed-length fingerprint in the browser and in Node. Used where an exact-equality check must not grow with the text. */
const K256 = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
export function sha256(value) {
    const data = new TextEncoder().encode(value), n = ((data.length + 9 + 63) >> 6) << 6, m = new Uint8Array(n);
    m.set(data);
    m[data.length] = 0x80;
    const bits = data.length * 8;
    new DataView(m.buffer).setUint32(n - 4, bits >>> 0);
    new DataView(m.buffer).setUint32(n - 8, Math.floor(bits / 0x100000000));
    const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19], w = new Uint32Array(64), view = new DataView(m.buffer);
    const r = (x, k) => (x >>> k) | (x << (32 - k));
    for (let off = 0; off < n; off += 64) {
        for (let i = 0; i < 16; i++)
            w[i] = view.getUint32(off + i * 4);
        for (let i = 16; i < 64; i++) {
            const a = w[i - 15], b = w[i - 2];
            w[i] = (w[i - 16] + (r(a, 7) ^ r(a, 18) ^ (a >>> 3)) + w[i - 7] + (r(b, 17) ^ r(b, 19) ^ (b >>> 10))) >>> 0;
        }
        let [a, b, c, d, e, f, g, k] = h;
        for (let i = 0; i < 64; i++) {
            const t1 = (k + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K256[i] + w[i]) >>> 0, t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
            k = g;
            g = f;
            f = e;
            e = (d + t1) >>> 0;
            d = c;
            c = b;
            b = a;
            a = (t1 + t2) >>> 0;
        }
        [a, b, c, d, e, f, g, k].forEach((x, i) => { h[i] = (h[i] + x) >>> 0; });
    }
    return h.map(x => x.toString(16).padStart(8, '0')).join('');
}
export const MIGRATION_NOTICE = '이전 형식(project.1)에서 변환했습니다. 기록은 지우지 않았습니다. 이전 AI 정리는 어느 기준 시점에 작성됐는지 알 수 없어 현재 작업문에서 제외합니다.';
export const V2_MIGRATION_NOTICE = '이전 형식(project.2)을 최신 형식으로 변환했습니다. 기록은 유지하며 과거 내보내기에 파일 식별자를 만들지 않습니다.';
/** project.1 -> project.2. Nothing user-authored is dropped: old export texts move to legacyText. */
export function migrateLegacy(v) {
    obj(v, ['schemaVersion', 'id', 'revision', 'name', 'sources', 'bases', 'tasks', 'currentTaskId', 'draft', 'answerDraft', 'basisDraft', 'basisEdits', 'draftKind', 'pending', 'notice']);
    ensure(v.schemaVersion === LEGACY_SCHEMA);
    list(v.bases);
    list(v.tasks);
    const bases = v.bases.map(b => { obj(b, ['id', 'text', 'status', 'sourceId', 'locked', 'revision', 'history']); ensure(typeof b.locked === 'boolean'); const { locked: _unused, ...rest } = b; return rest; });
    const tasks = v.tasks.map(t => {
        obj(t, ['id', 'sourceIds', 'parentTaskId', 'advice', 'mode', 'manual', 'suggestions', 'handoffs']);
        list(t.handoffs);
        const handoffs = t.handoffs.map(h => {
            obj(h, ['at', 'text', 'revision', 'method']);
            text(h.text, 250000);
            return { at: h.at, method: h.method, revision: h.revision, chars: h.text.length, digest: digest(h.text), work: null, aiExcluded: false, legacyText: h.text };
        });
        return { ...t, adviceRevision: null, handoffs };
    });
    return migrateV2({ ...v, schemaVersion: PREVIOUS_SCHEMA, bases, tasks, notice: MIGRATION_NOTICE }, MIGRATION_NOTICE);
}
export function isLegacy(raw) { try {
    return JSON.parse(raw)?.schemaVersion === LEGACY_SCHEMA;
}
catch {
    return false;
} }
export function isPrevious(raw) { try {
    return JSON.parse(raw)?.schemaVersion === PREVIOUS_SCHEMA;
}
catch {
    return false;
} }
function migrateV2(v, notice = V2_MIGRATION_NOTICE) {
    obj(v, ['schemaVersion', 'id', 'revision', 'name', 'sources', 'bases', 'tasks', 'currentTaskId', 'draft', 'answerDraft', 'basisDraft', 'basisEdits', 'draftKind', 'pending', 'notice']);
    ensure(v.schemaVersion === PREVIOUS_SCHEMA);
    list(v.tasks);
    const tasks = v.tasks.map(t => {
        obj(t, ['id', 'sourceIds', 'parentTaskId', 'advice', 'adviceRevision', 'mode', 'manual', 'suggestions', 'handoffs']);
        list(t.handoffs);
        const handoffs = t.handoffs.map(h => { obj(h, ['at', 'method', 'revision', 'chars', 'digest', 'work', 'aiExcluded', 'legacyText']); return { ...h, returnId: null }; });
        return { ...t, resultFile: null, handoffs };
    });
    return migrateV4({ ...v, schemaVersion: V4_SCHEMA, tasks, notice, space: EMPTY_SPACE() });
}
/** project.3 -> project.4: nothing changes but an empty plan space (no areas are invented). */
function migrateV3(v) {
    obj(v, ['schemaVersion', 'id', 'revision', 'name', 'sources', 'bases', 'tasks', 'currentTaskId', 'draft', 'answerDraft', 'basisDraft', 'basisEdits', 'draftKind', 'pending', 'notice']);
    ensure(v.schemaVersion === V3_SCHEMA);
    return migrateV4({ ...v, schemaVersion: V4_SCHEMA, space: EMPTY_SPACE() });
}
/** project.4 -> project.5: no task or export had a background copy. They read null; the current plan is never backfilled. */
function migrateV4(v) {
    const p = v;
    ensure(p && p.schemaVersion === V4_SCHEMA);
    list(p.tasks);
    // The unreleased first project.4 candidate had no draft target ('follow the current work') and no stored positions.
    const space = p.space;
    if (space && typeof space === 'object') {
        if (!Object.hasOwn(space, 'draftTarget'))
            space.draftTarget = null;
        if (!Object.hasOwn(space, 'layout'))
            space.layout = { version: 'layout.1', positions: {} };
    }
    const tasks = p.tasks.map(t => {
        ensure(t !== null && typeof t === 'object' && !Array.isArray(t) && !Object.hasOwn(t, 'background'));
        const task = t;
        list(task.handoffs);
        return { ...task, background: null, handoffs: task.handoffs.map(h => { ensure(h !== null && typeof h === 'object' && !Array.isArray(h) && !Object.hasOwn(h, 'background')); return { ...h, background: null }; }) };
    });
    return migrateV5({ ...p, schemaVersion: V5_SCHEMA, tasks });
}
/** project.5 -> project.6 (AREA17): no area has a derived description and no export has an anchor. Nothing is backfilled:
 * the plan at the time of an older export is unknown, so a later return.2 to it is held, never applied by estimate. */
function migrateV5(v) {
    const p = v;
    ensure(p && p.schemaVersion === V5_SCHEMA);
    list(p.tasks);
    ensure(!!p.space && typeof p.space === 'object' && !Array.isArray(p.space) && !Object.hasOwn(p.space, 'understanding'));
    const tasks = p.tasks.map(t => {
        ensure(t !== null && typeof t === 'object' && !Array.isArray(t));
        const task = t;
        list(task.handoffs);
        return { ...task, handoffs: task.handoffs.map(h => { ensure(h !== null && typeof h === 'object' && !Array.isArray(h) && !Object.hasOwn(h, 'anchor')); return { ...h, anchor: null }; }) };
    });
    return { ...p, schemaVersion: SCHEMA, tasks, space: { ...p.space, understanding: {} } };
}
/** The single acceptance test for persisted bytes: autosave, recovery-file download and import all use it. */
/** intent-edit.1 (unreleased AI055 candidate) kept the correction in manual.*, where any later work edit
 * would rewrite it. Every one is converted on the first parse, so no later parse reads manual.* again:
 * a non-blank goal is copied out; otherwise no goal is invented (goal=null) and only the revision that
 * withholds the older AI text and question is kept. manual.* stays as written. The result is revalidated. */
function convertIntentEdits(p) {
    let converted = false;
    for (const t of p.tasks) {
        const e = t.intentEdit, goal = t.manual.understanding;
        if (e?.version !== 'intent-edit.1')
            continue;
        t.intentEdit = goal !== null && goal.trim() ? { version: 'intent-edit.2', revision: e.revision, goal, conditions: t.manual.scope ?? '' }
            : { version: 'intent-edit.2', revision: e.revision, goal: null, conditions: null };
        converted = true;
    }
    if (converted)
        assertProject(p);
    return p;
}
export function parseProject(raw) {
    ensure(new TextEncoder().encode(raw).length <= FILE_LIMIT, 'FILE_TOO_LARGE');
    const v = JSON.parse(raw);
    const schema = v?.schemaVersion;
    const project = schema === LEGACY_SCHEMA ? migrateLegacy(v) : schema === PREVIOUS_SCHEMA ? migrateV2(v) : schema === V3_SCHEMA ? migrateV3(v) : schema === V4_SCHEMA ? migrateV4(v) : schema === V5_SCHEMA ? migrateV5(v) : v;
    assertProject(project);
    return convertIntentEdits(project); // Freshly parsed, not shared: no defensive copy needed.
}
/* ---------- GUIDE097 ---------- */
function guideTicket(v) { obj(v, ['projectId', 'revision', 'requestId', 'areaId']); id(v.projectId); integer(v.revision); id(v.requestId); id(v.areaId); }
const GUIDE_WORK = 5;
/** Shape and size of the guidance material. It carries no sources, tasks or bases to write back. */
export function validateGuideRequest(v) {
    obj(v, ['schemaVersion', 'ticket', 'projectName', 'brief', 'area', 'decisions', 'areaWork', 'answer', 'currentInstruction']);
    ensure(v.schemaVersion === GUIDE_SCHEMA);
    if (v.currentInstruction !== null)
        text(v.currentInstruction); // Same limit as a request draft; blank means none (null), never ''.
    guideTicket(v.ticket);
    text(v.projectName, 120);
    if (v.brief !== null)
        text(v.brief);
    obj(v.area, ['id', 'name', 'note']);
    id(v.area.id);
    text(v.area.name, 60);
    if (v.area.note !== null)
        text(v.area.note, 2000);
    ensure(v.area.id === v.ticket.areaId);
    list(v.decisions);
    const ids = new Set();
    for (const d of v.decisions) {
        obj(d, ['id', 'text', 'status']);
        id(d.id);
        text(d.text);
        ensure(['confirmed', 'deferred', 'answered'].includes(d.status));
        ensure(!ids.has(d.id));
        ids.add(d.id);
    }
    list(v.areaWork, GUIDE_WORK);
    for (const w of v.areaWork) {
        obj(w, ['taskId', 'request', 'scope', 'checks']);
        id(w.taskId);
        text(w.request);
        if (w.scope !== null)
            text(w.scope, 6000, true);
        if (w.checks !== null)
            text(w.checks, 6000, true);
    } // Blank manual values are valid, as in editTask.
    if (v.answer !== null) {
        obj(v.answer, ['question', 'text', 'disposition']);
        question(v.answer.question);
        text(v.answer.text);
        ensure(['provided', 'unknown', 'deferred'].includes(v.answer.disposition));
    }
    ensure(new TextEncoder().encode(JSON.stringify(v)).length <= REQUEST_BYTES, 'CONTEXT_TOO_LARGE');
    return structuredClone(v);
}
/** Exactly one of question/proposal. Once the question is answered only a proposal is accepted: at most one question. */
export function validateGuideReply(v, req) {
    obj(v, ['question', 'proposal']);
    ensure((v.question === null) !== (v.proposal === null));
    if (v.question !== null) {
        ensure(req.answer === null);
        question(v.question);
    }
    if (v.proposal !== null) {
        const p = v.proposal;
        obj(p, ['goal', 'scope', 'checks', 'open', 'defaults']);
        text(p.goal, 2000);
        text(p.scope, 2000);
        text(p.checks, 2000);
        list(p.open, 6);
        for (const o of p.open)
            text(o, 500);
        list(p.defaults, 6);
        for (const d of p.defaults)
            text(d, 500);
        // One point is either still the user's to decide (open) or an editable suggestion (defaults), never both.
        const undecided = new Set(p.open.map(o => o.trim()));
        ensure(p.defaults.every(d => !undecided.has(d.trim())));
    }
    return structuredClone(v);
}
export function validateGuideEnvelope(v, req) {
    obj(v, ['mode', 'ticket', 'reply']);
    ensure(['mock', 'deepseek'].includes(v.mode));
    guideTicket(v.ticket);
    ensure(Object.keys(req.ticket).every(k => req.ticket[k] === v.ticket[k]));
    return { mode: v.mode, ticket: { ...v.ticket }, reply: validateGuideReply(v.reply, req) };
}
