import { parsePersistedPlan, compareResults } from '../shared/change-plan.js';
export const PLANS_KEY = 'agentflow.studio.plans.1';
export const UNREADABLE_KEY = 'agentflow.studio.plans.1.unreadable';
const FILE_FORMAT = 'agentflow.change-plan-file.2';
export const emptyBundle = (draft = '') => ({ draft, extra: [], plan: null, by: null, snapshots: [], labels: {}, origins: {}, observations: [], attached: {} });
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
function fail() { throw new Error('INVALID_PLAN_BUNDLE'); }
export function parseBundle(v, projectId) {
    if (!isObj(v))
        fail();
    const keys = ['draft', 'extra', 'plan', 'by', 'snapshots', 'labels', 'origins', 'observations', 'attached'];
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
        if (!plan || plan.projectId !== projectId)
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
    return structuredClone({ draft: v.draft, extra: v.extra, plan, by, snapshots, labels: v.labels, origins: v.origins, observations, attached });
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
        return { ok: true, env: { version: 'studio.plans.2', projects: {} }, raw };
    try {
        const v = JSON.parse(raw);
        if (!isObj(v) || !['studio.plans.1', 'studio.plans.2'].includes(v.version) || !isObj(v.projects))
            return { ok: false, raw };
        // v1 snapshots keep their original text and have no structured scope. Never backfill from today's plan.
        return { ok: true, env: { version: 'studio.plans.2', projects: v.projects }, raw };
    }
    catch {
        return { ok: false, raw };
    }
}
export function loadBundle(kv, projectId) {
    const r = readEnvelope(kv);
    if (!r.ok)
        return { bundle: emptyBundle(), unreadable: true };
    if (!Object.hasOwn(r.env.projects, projectId))
        return { bundle: emptyBundle(), unreadable: false };
    try {
        return { bundle: parseBundle(r.env.projects[projectId], projectId), unreadable: false };
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
    try {
        writeChecked(kv, PLANS_KEY, JSON.stringify(r.env));
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
            writeChecked(kv, PLANS_KEY, JSON.stringify(r.env));
        }
        else
            writeChecked(kv, PLANS_KEY, JSON.stringify({ version: 'studio.plans.2', projects: {} }));
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
    if (!isObj(v) || ![FILE_FORMAT, 'agentflow.change-plan-file.1'].includes(v.format) || !isObj(v.project))
        return '변경안 파일이 아니에요. 프로젝트 백업 파일은 홈의 ‘백업 파일 가져오기’를 쓰세요.';
    if (v.project.id !== projectId)
        return `다른 프로젝트(‘${String(v.project.name ?? '').slice(0, 60)}’)의 변경안이에요. 가져오지 않았어요.`;
    try {
        return parseBundle(v.bundle, projectId);
    }
    catch {
        return '변경안 파일의 내용이 맞지 않아 가져오지 않았어요. 지금 변경안은 그대로예요.';
    }
}
