export function requestContext(r) {
    const { items, ...head } = r;
    return structuredClone({ ...head, version: 'request-context.1', items: items.map(({ sources: _sources, ...item }) => item) });
}
export const MATCH_LABEL = { reported: '구현 보고', checked: '확인 보고', code: '코드 자료', test: '검사 자료', open: '남은 것' };
const ID = /^[A-Za-z0-9_-]{1,100}$/;
const object = (v, keys) => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const text = (v, max) => typeof v === 'string' && !!v.trim() && v.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);
const id = (v) => typeof v === 'string' && ID.test(v);
function fail() { throw new Error('INVALID_REQUEST_SCOPE'); }
export function validateOrigins(v) {
    if (!Array.isArray(v) || v.length > 16)
        fail();
    for (const x of v)
        if (!object(x, ['record', 'reading', 'quote']) || (x.record !== null && !id(x.record)) || (x.reading !== null && !id(x.reading)) || (x.quote !== null && (!text(x.quote, 300) || x.record === null)))
            fail();
}
export function validateFrozenRequest(v) {
    if (!object(v, ['version', 'id', 'projectId', 'planId', 'planRevision', 'createdAt', 'basis', 'intent', 'items']) || v.version !== 'request-scope.1' || !id(v.id) || !id(v.projectId) || !id(v.planId) || !Number.isSafeInteger(v.planRevision) || v.planRevision < 1 || !text(v.basis, 2000) || !text(v.intent, 12000) || typeof v.createdAt !== 'string' || !Number.isFinite(Date.parse(v.createdAt)) || new Date(v.createdAt).toISOString() !== v.createdAt || !Array.isArray(v.items) || !v.items.length || v.items.length > 32)
        fail();
    const seen = new Set();
    for (const x of v.items) {
        if (!object(x, ['id', 'title', 'description', 'partIds', 'sources']) || !id(x.id) || seen.has(x.id) || !text(x.title, 200) || !text(x.description, 4000) || !Array.isArray(x.partIds) || x.partIds.length > 32 || !x.partIds.every(id) || new Set(x.partIds).size !== x.partIds.length || !Array.isArray(x.sources) || x.sources.length > 48)
            fail();
        seen.add(x.id);
        for (const s of x.sources) {
            if (!object(s, ['id', 'title', 'basis', 'origins']) || !id(s.id) || !text(s.title, 200) || !text(s.basis, 2000))
                fail();
            validateOrigins(s.origins);
        }
    }
    return structuredClone(v);
}
export function validateRequestContext(v) {
    if (!object(v, ['version', 'id', 'projectId', 'planId', 'planRevision', 'createdAt', 'basis', 'intent', 'items']) || v.version !== 'request-context.1' || !Array.isArray(v.items))
        fail();
    const items = v.items.map(x => {
        if (!object(x, ['id', 'title', 'description', 'partIds']))
            fail();
        return { ...x, sources: [] };
    });
    return requestContext(validateFrozenRequest({ ...v, version: 'request-scope.1', items }));
}
export const sameTarget = (a, b) => a.requestId === b.requestId && a.itemId === b.itemId;
export function hasTarget(requests, t) { return requests.some(r => r.id === t.requestId && r.items.some(i => i.id === t.itemId)); }
export function validateRequestMatch(v, requests) {
    if (!object(v, ['record', 'quote', 'text', 'kind', 'about', 'targets', 'why']) || !id(v.record) || !text(v.quote, 300) || !text(v.text, 240) || !['reported', 'checked', 'code', 'test', 'open'].includes(v.kind) || (v.about !== null && !text(v.about, 200)) || !text(v.why, 240) || !Array.isArray(v.targets) || v.targets.length > 8)
        fail();
    const seen = new Set();
    for (const t of v.targets) {
        if (!object(t, ['requestId', 'itemId']) || !id(t.requestId) || !id(t.itemId) || !hasTarget(requests, t))
            fail();
        const key = `${t.requestId}/${t.itemId}`;
        if (seen.has(key))
            fail();
        seen.add(key);
    }
    return structuredClone(v);
}
const targetKey = (targets) => targets.map(t => `${t.requestId}/${t.itemId}`).sort().join('|');
export function requestMatches(p) {
    const out = [];
    for (const r of p.readings) {
        if (r.version === 'request-correction.1') {
            const x = out.find(x => x.reading === r.reading && x.index === r.index);
            if (x) {
                x.target = r.target;
                x.excluded = r.target === null;
                x.corrected = true;
                delete x.prior;
            }
        }
        else if (r.version === 'map-reading.2')
            r.matches.forEach((match, index) => {
                // An explicit earlier correction of the same quote survives reading that passage again.
                const previous = [...out].reverse().find(x => x.corrected && x.match.record === match.record && x.match.from === match.from && x.match.to === match.to);
                const earlier = previous && targetKey(previous.match.targets) === targetKey(match.targets) && (!previous.target || hasTarget(r.requests, previous.target)) ? previous : null;
                const proposed = match.targets.length === 1 ? match.targets[0] : null;
                const conflict = !earlier && previous?.target && proposed && !sameTarget(previous.target, proposed) ? previous : null;
                out.push({ reading: r.id, index, match, target: earlier ? earlier.target : conflict ? null : proposed,
                    excluded: earlier?.excluded ?? false, corrected: earlier?.corrected ?? false, requests: r.requests,
                    ...(conflict?.target ? { prior: { reading: conflict.reading, index: conflict.index, target: conflict.target } } : {}) });
            });
    }
    // A replay of the same passage and scope is one correspondence, with the correction kept above.
    const seen = new Set();
    const recent = out.reverse().filter(x => { const key = `${x.match.record}/${x.match.from}/${x.match.to}/${targetKey(x.match.targets)}`; if (seen.has(key))
        return false; seen.add(key); return true; });
    const order = new Map(p.readings.map((r, i) => [r.id, i]));
    return recent.sort((a, b) => (order.get(b.reading) - order.get(a.reading)) || a.index - b.index);
}
/** A brief comparison of one stored read, counting item occurrences within their exact RQ, never product completion. */
export function requestComparison(p, reading) {
    if (!reading.requests?.length)
        return null;
    const requests = reading.requests, matches = requestMatches(p).filter(x => x.reading === reading.id && !x.excluded);
    const pending = matches.filter(x => !x.target && x.match.targets.length > 1).length;
    if (requests.length > 1) {
        const withReport = requests.filter(q => matches.some(x => x.target?.requestId === q.id && x.match.kind !== 'open')).length;
        return `요청문 ${requests.length}개 대조 · ${withReport}개 요청에 보고${pending ? ` · 요청 대응 미정 ${pending}구절` : ''}`;
    }
    const q = requests[0], changed = new Set(matches.filter(x => x.target?.requestId === q.id && ['reported', 'code'].includes(x.match.kind)).map(x => x.target.itemId));
    return `원한 항목 ${q.items.length}개 · 변경 보고 ${changed.size}개 · 변경 근거 아직 없는 항목 ${q.items.length - changed.size}개${pending ? ` · 대응 미정 ${pending}구절` : ''}`;
}
export function correctRequestMatch(p, reading, index, target) {
    const r = p.readings.find((r) => r.version === 'map-reading.2' && r.id === reading), m = r?.matches?.[index];
    if (!r || !m || (target && !hasTarget(r.requests, target)) || p.readings.length >= 500)
        throw new Error('INVALID_REQUEST_CORRECTION');
    const entry = { version: 'request-correction.1', id: `Q_${crypto.randomUUID()}`, at: new Date().toISOString(), reading, index, target: structuredClone(target) };
    return { ...p, revision: p.revision + 1, readings: [...p.readings, entry] };
}
/** Stored origins are checked against the exact received interval, including offsets into a long record. */
export function validateStoredMatch(v, requests, intervals, texts, materialIds) {
    if (!v || typeof v !== 'object')
        fail();
    const { from, to, ...base } = v;
    const m = validateRequestMatch(base, requests), source = texts.get(m.record);
    if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 0 || to <= from || !source || source.slice(from, to) !== m.quote || !intervals.some(r => r.id === m.record && from >= r.from && to <= r.to))
        fail();
    if (m.about !== null && !intervals.some(r => r.id === m.record && source.slice(r.from, r.to).includes(m.about)))
        fail();
    if (['code', 'test'].includes(m.kind) && !materialIds.has(m.record))
        fail();
    return { ...m, from, to };
}
