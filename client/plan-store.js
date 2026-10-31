import { parsePersistedPlan, compareResults } from '../shared/change-plan.js';
import { parseAuthoringRecord, openRecord, legacyRecord } from '../shared/authoring-context.js';
export const PLANS_KEY = 'agentflow.studio.plans.1';
export const UNREADABLE_KEY = 'agentflow.studio.plans.1.unreadable';
/* .3 / studio.plans.3: a bundle may carry its draft's authoring context, and its plan may hold an analysis that proposed no change
 * (items=[], same shape). Earlier files and envelopes are still read as they are; their writers never kept an empty analysis. An
 * app from before empty analyses refuses such a bundle as unreadable and leaves its raw text as it was (its own boundary).
 * .4 / studio.plans.4: a request document made from now on may carry its reading (request-reading). A .1-.3 writer never kept
 * one, so a bundle read as one of those versions that claims a reading is not read. An app from before .4 refuses the .4
 * envelope and file as unreadable and leaves the raw text as it was. */
const FILE_FORMAT = 'agentflow.change-plan-file.4';
const ENVELOPE = 'studio.plans.4';
/** A new draft: its first edit takes the context of the screen. */
export const emptyBundle = (draft = '') => ({ draft, extra: [], plan: null, by: null, snapshots: [], labels: {}, origins: {}, observations: [], attached: {}, authoring: openRecord() });
export const authoringOf = (b) => b.authoring ?? legacyRecord(!!b.plan);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
function fail() { throw new Error('INVALID_PLAN_BUNDLE'); }
/** from: the version it was read from; an earlier writer's bundle never carries what that writer did not keep. */
export function parseBundle(v, projectId, from = 4) {
    const legacy = from <= 2;
    if (!isObj(v))
        fail();
    if (legacy && Object.hasOwn(v, 'authoring'))
        fail();
    const keys = ['draft', 'extra', 'plan', 'by', 'snapshots', 'labels', 'origins', 'observations', 'attached', ...(Object.hasOwn(v, 'authoring') ? ['authoring'] : [])];
    if (Object.keys(v).length !== keys.length || !keys.every(k => Object.hasOwn(v, k)))
        fail();
    if (typeof v.draft !== 'string' || v.draft.length > 6000)
        fail();
    if (!Array.isArray(v.extra) || v.extra.length > 20)
        fail();
    for (const e of v.extra) {
        if (!isObj(e) || Object.keys(e).length !== 5 || typeof e.id !== 'string' || !/^U\d{2}$/.test(e.id) || !['report', 'code', 'test'].includes(e.kind))
            fail();
        for (const [k, max] of [['title', 200], ['text', 12000], ['basis', 2000]]) {
            const t = e[k];
            if (typeof t !== 'string' || !t.trim() || t.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(t))
                fail();
        }
    }
    if (new Set(v.extra.map(e => e.id)).size !== v.extra.length)
        fail();
    let plan = null;
    if (v.plan !== null) {
        plan = parsePersistedPlan(v.plan);
        if (!plan || plan.projectId !== projectId || (legacy && !plan.analysis.items.length))
            fail();
    }
    let by = null;
    if (v.by !== null) {
        const b = v.by;
        if (!isObj(b))
            fail();
        if (b.kind === 'example' && Object.keys(b).length === 1)
            by = { kind: 'example' };
        else if (b.kind === 'ai' && typeof b.model === 'string' && b.model.length <= 80 && typeof b.at === 'string' && Number.isFinite(Date.parse(b.at))
            && isObj(b.records) && Number.isSafeInteger(b.records.total) && Number.isSafeInteger(b.records.sent)) {
            by = { kind: 'ai', model: b.model, at: b.at, records: { total: b.records.total, sent: b.records.sent } };
        }
        else
            fail();
    }
    if (!Array.isArray(v.snapshots) || v.snapshots.length > 60)
        fail();
    const snapshots = v.snapshots;
    for (const s of snapshots) {
        try {
            compareResults(s, []);
            if (s.scope && s.scope.projectId !== projectId)
                fail();
        }
        catch {
            fail();
        }
    }
    if (from < 4 && snapshots.some(s => isObj(s) && Object.hasOwn(s, 'reading')))
        fail();
    if (new Set(snapshots.map(s => s.id)).size !== snapshots.length)
        fail();
    if (!isObj(v.labels))
        fail();
    for (const [sid, m] of Object.entries(v.labels)) {
        if (!snapshots.some(s => s.id === sid) || !isObj(m) || !Object.values(m).every(t => typeof t === 'string' && t.length <= 200))
            fail();
    }
    if (!isObj(v.origins) || Object.keys(v.origins).length !== snapshots.length || !snapshots.every(s => ['example', 'ai', 'reviewed'].includes(v.origins[s.id])))
        fail();
    if (!Array.isArray(v.observations) || v.observations.length > 256 || !isObj(v.attached))
        fail();
    const observations = v.observations, attached = v.attached;
    if (Object.keys(attached).length !== observations.length)
        fail();
    for (const s of snapshots) {
        try {
            compareResults(s, observations.filter(o => attached[o.id] === s.id));
        }
        catch {
            fail();
        }
    }
    if (!observations.every(o => snapshots.some(s => s.id === attached[o.id])))
        fail();
    let authoring;
    if (Object.hasOwn(v, 'authoring')) {
        try {
            authoring = parseAuthoringRecord(v.authoring, !!plan);
        }
        catch {
            fail();
        }
    }
    // A kept context belongs to the bundle's own project: one naming another project (a copied or mixed file) is not read, rather
    // than shown as 'nothing selected · whole project' of this one. Parts gone from the same project stay unresolved, as before.
    const owned = (a) => !a || a.state !== 'set' || a.context.projectId === projectId;
    if (authoring && (!owned(authoring.draft) || !owned(authoring.analyzed?.authoring)))
        fail();
    return structuredClone({ draft: v.draft, extra: v.extra, plan, by, snapshots, labels: v.labels, origins: v.origins, observations, attached, ...(authoring ? { authoring } : {}) });
}
const LEGACY_VERSIONS = ['studio.plans.1', 'studio.plans.2', 'studio.plans.3'];
/** Maps keyed by project id hold own entries only: an id such as toString, constructor or __proto__ is an ordinary entry, never
 * something inherited (read as a marker) or a prototype (written as one). */
const own = (o) => Object.assign(Object.create(null), o);
/** The version an entry is read by: its own marker, by an explicit mapping; no marker is .4. Anything else is not a marker. */
function fromMarker(env, id) {
    if (!env.legacy || !Object.hasOwn(env.legacy, id))
        return 4;
    switch (env.legacy[id]) {
        case 'studio.plans.1': return 1;
        case 'studio.plans.2': return 2;
        case 'studio.plans.3': return 3;
        default: fail();
    }
}
function readEnvelope(kv) {
    let raw;
    try {
        raw = kv.getItem(PLANS_KEY);
    }
    catch {
        return { ok: false, raw: '' };
    }
    if (raw === null)
        return { ok: true, env: { version: ENVELOPE, projects: own({}) }, raw };
    try {
        const v = JSON.parse(raw);
        if (!isObj(v) || !isObj(v.projects))
            return { ok: false, raw };
        // v1 snapshots keep their original text and have no structured scope; v1/v2 bundles have no authoring context; no snapshot
        // before .4 has a reading. Never backfill any of them from today's plan or screen. Other projects' entries are written back
        // exactly as they were read, with their provenance.
        if (v.version === 'studio.plans.1' || v.version === 'studio.plans.2') {
            const projects = own(v.projects);
            return { ok: true, env: { version: ENVELOPE, projects, legacy: own(Object.fromEntries(Object.keys(projects).map(id => [id, v.version]))) }, raw };
        }
        // A .3 envelope could mark only .1/.2 entries; .4 also .3 ones.
        const three = v.version === 'studio.plans.3', marks = three ? LEGACY_VERSIONS.slice(0, 2) : LEGACY_VERSIONS;
        if ((!three && v.version !== ENVELOPE) || !Object.keys(v).every(k => ['version', 'projects', 'legacy'].includes(k)))
            return { ok: false, raw };
        const legacy = v.legacy ?? {};
        if (!isObj(legacy) || !Object.entries(legacy).every(([id, ver]) => Object.hasOwn(v.projects, id) && marks.includes(ver)))
            return { ok: false, raw };
        const kept = three ? Object.fromEntries(Object.keys(v.projects).map(id => [id, (Object.hasOwn(legacy, id) ? legacy[id] : 'studio.plans.3')])) : legacy;
        return { ok: true, env: { version: ENVELOPE, projects: own(v.projects), legacy: own(kept) }, raw };
    }
    catch {
        return { ok: false, raw };
    }
}
/** The envelope as written: its legacy markers only while there are any. */
function written(env) {
    const legacy = env.legacy && Object.keys(env.legacy).length ? env.legacy : null;
    return JSON.stringify({ version: env.version, projects: env.projects, ...(legacy ? { legacy } : {}) });
}
export function loadBundle(kv, projectId) {
    const r = readEnvelope(kv);
    if (!r.ok)
        return { bundle: emptyBundle(), unreadable: true };
    if (!Object.hasOwn(r.env.projects, projectId))
        return { bundle: emptyBundle(), unreadable: false };
    try {
        return { bundle: parseBundle(r.env.projects[projectId], projectId, fromMarker(r.env, projectId)), unreadable: false };
    }
    catch {
        return { bundle: emptyBundle(), unreadable: true };
    }
}
const writeChecked = (kv, key, value) => { kv.setItem(key, value); if (kv.getItem(key) !== value)
    throw new Error('LOST_WRITE'); };
/** null on success, else the text to show. Never overwrites an unreadable envelope. */
export function saveBundle(kv, projectId, bundle) {
    const r = readEnvelope(kv);
    if (!r.ok)
        return '저장된 변경안 묶음을 읽지 못해 새로 저장하지 않았어요. 원래 내용은 그대로예요.';
    r.env.projects[projectId] = bundle;
    if (r.env.legacy)
        delete r.env.legacy[projectId];
    try {
        writeChecked(kv, PLANS_KEY, written(r.env));
        return null;
    }
    catch {
        return '이 브라우저에 저장하지 못했어요. 이 탭을 닫으면 사라지니 파일로 내보내 두세요.';
    }
}
/** Starting over after an unreadable entry: the raw text is copied aside first, then only that entry (or the broken
 * envelope) is cleared. Returns an error text when the copy could not be made, in which case nothing is cleared. */
export function setAside(kv, projectId) {
    const r = readEnvelope(kv);
    const raw = r.ok ? JSON.stringify(r.env.projects[projectId] ?? null) : r.raw;
    try {
        let kept = [];
        try {
            const v = JSON.parse(kv.getItem(UNREADABLE_KEY) ?? '[]');
            if (Array.isArray(v))
                kept = v;
        }
        catch {
            return '읽지 못한 변경안을 따로 보관할 자리가 망가져 있어 아무것도 지우지 않았어요.';
        }
        writeChecked(kv, UNREADABLE_KEY, JSON.stringify([...kept, { at: new Date().toISOString(), projectId: r.ok ? projectId : null, raw }].slice(-20)));
        if (r.ok) {
            delete r.env.projects[projectId];
            if (r.env.legacy)
                delete r.env.legacy[projectId];
            writeChecked(kv, PLANS_KEY, written(r.env));
        }
        else
            writeChecked(kv, PLANS_KEY, JSON.stringify({ version: ENVELOPE, projects: {} }));
        return null;
    }
    catch {
        return '읽지 못한 변경안을 따로 보관하지 못해 아무것도 지우지 않았어요.';
    }
}
/* A plan file: the change plan, its request documents and attached results. Not a project backup. */
export function planFile(bundle, project) {
    return JSON.stringify({ format: FILE_FORMAT, note: '변경안 파일입니다. 프로젝트 백업이 아니며 프로젝트 기록은 들어 있지 않습니다.',
        project: { id: project.id, name: project.name }, exportedAt: new Date().toISOString(), bundle }, null, 2);
}
export function readPlanFile(text, projectId) {
    let v;
    try {
        v = JSON.parse(text);
    }
    catch {
        return '변경안 파일이 아니거나 읽을 수 없어요. 아무것도 바꾸지 않았어요.';
    }
    const formats = { [FILE_FORMAT]: 4, 'agentflow.change-plan-file.3': 3, 'agentflow.change-plan-file.2': 2, 'agentflow.change-plan-file.1': 1 };
    const from = isObj(v) && typeof v.format === 'string' && Object.hasOwn(formats, v.format) ? formats[v.format] : undefined;
    if (!isObj(v) || !from || !isObj(v.project))
        return '변경안 파일이 아니에요. 프로젝트 백업 파일은 홈의 ‘백업 가져오기’를 쓰세요.';
    if (v.project.id !== projectId)
        return `다른 프로젝트(‘${String(v.project.name ?? '').slice(0, 60)}’)의 변경안이에요. 가져오지 않았어요.`;
    // .1/.2 files were written before authoring contexts, .3 before request readings: one that claims either is not what that
    // version wrote.
    try {
        return parseBundle(v.bundle, projectId, from);
    }
    catch {
        return '변경안 파일의 내용이 맞지 않아 가져오지 않았어요. 지금 변경안은 그대로예요.';
    }
}
