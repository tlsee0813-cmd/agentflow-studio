/* studio.map.1: reading records into the map. The browser sends the map as it is (parts by alias, the person's own words, what
 * earlier readings understood) and the records not yet read; the model answers with parts, claims and relations, each resting on
 * an exact quote of what was sent. applyReading is the only write: it adds parts and relations and keeps one MapReading with the
 * derived understanding. It never renames, moves, archives or re-describes an existing part, never writes Area.note and never
 * touches space.understanding (return.2 and its anchors). What is unclear stays a candidate; nothing asks for approval per part. */
import { CLAIM_KINDS, READINGS_LIMIT, isMapReading } from './types.js';
import { addArea, addChildArea, addRelation, addReading } from './domain.js';
import { parseProject } from './validation.js';
import { quoteAt } from './digest-api.js';
import { secretLike } from './secret.js';
import { validateFrozenRequest, validateRequestContext, requestContext, validateRequestMatch, requestMatches, hasTarget, sameTarget, canReplace, MATCH_STANCES } from './request-return.js';
export const MAP_SCHEMA = 'studio.map.1';
export const MAP2_SCHEMA = 'studio.map.2';
/** studio.map.2 with a stance on each match and the explicit withdrawal of an earlier one (priors). map.2 stays readable. */
export const MAP3_SCHEMA = 'studio.map.3';
/** At most this many earlier matches go as priors, within PRIOR_BYTES (records keep the rest of MAP_BYTES). */
export const MAP_PRIORS = 24;
const PRIOR_BYTES = 12000;
/** The server reads at most this many bytes of a request (the studio routes share one limit). */
export const MAP_BYTES = 65536;
export const MAP_RECORDS = 4;
export const MAP_RECORD_CHARS = 12000;
const MIN_RECORD_CHARS = 1500, META_BYTES = 30000;
export const CLAIM_LABEL = {
    // A report of work says what it says: it may say something was not built. Neither label reads as built.
    want: '원함', idea: '구상', reported: '작업 보고', checked: '확인 보고', describes: '설명', open: '남은 선택', differs: '다른 근거'
};
/** One short state for a part that has no request of its own yet, from what was read (never a verified status). */
export const STATE_LABEL = { reported: '작업 보고 있음', checked: '확인 보고 있음', want: '요구', idea: '구상', describes: '설명만 있음' };
/** The part's short state, saying when its current report took an earlier one back (the corrected report is read first). */
export const stateLabel = (u) => u.state ? (u.revised && (u.state === 'reported' || u.state === 'checked') ? '보고 정정됨' : STATE_LABEL[u.state] ?? null) : null;
const STATE_ORDER = ['reported', 'checked', 'want', 'idea', 'describes'];
const RELS = ['flow', 'needs', 'shares', 'related'];
const PART = /^P\d{2,3}$/, NEW = /^new:[a-z0-9_-]{1,24}$/, RECORD = /^[NR]\d{2,3}$/, CLAIM = /^C\d{2,3}$/, PRIOR = /^M\d{2}$/;
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const bytes = (v) => new TextEncoder().encode(JSON.stringify(v)).length;
/** Where a quote stands in a record, as the record's own text. Exactly (white space read loosely, as quoteAt); else, narrowly, when
 * the quote only leaves out the delimiters of paired Markdown strong emphasis ('**Error handling**', '__x__') that the record
 * really has: on one line, opening before a non-space and not after a word character, closing after a non-space and not before
 * one, outside fenced and inline code. Then the one place it matches with those delimiters set aside is returned as the record's
 * span with its marks. A single or unpaired '*' or '_' (a * b, *value, snake_case, 2 ** 3, a**b**c) is never set aside; two
 * places, changed characters or joined pieces give null. */
export function resolveQuote(text, quote) {
    const q = quote.trim();
    if (!q)
        return null;
    const at = quoteAt(text, q);
    if (at)
        return text.slice(at.at, at.at + at.length);
    const marks = (t) => {
        const out = new Set();
        let pos = 0, fenced = false;
        for (const line of t.split('\n')) {
            if (/^\s*(```|~~~)/.test(line)) {
                fenced = !fenced;
                pos += line.length + 1;
                continue;
            }
            if (!fenced) {
                // Inline code keeps its characters: masked so no delimiter is found inside it.
                const masked = line.replace(/`[^`]*`/g, m => ' '.repeat(m.length));
                for (const m of masked.matchAll(/(\*\*|__)(?=\S)(.+?)(?<=\S)\1/g)) {
                    const a = m.index, b = a + m[0].length;
                    if (/[\p{L}\p{N}]/u.test(masked[a - 1] ?? '') || /[\p{L}\p{N}]/u.test(masked[b] ?? ''))
                        continue;
                    for (const k of [a, a + 1, b - 2, b - 1])
                        out.add(pos + k);
                }
            }
            pos += line.length + 1;
        }
        return out;
    };
    const strip = (t) => { const drop = marks(t), keep = []; let plain = ''; for (let k = 0; k < t.length; k++)
        if (!drop.has(k)) {
            keep.push(k);
            plain += t[k];
        } return { keep, plain }; };
    const { keep, plain } = strip(text), bare = strip(q).plain.trim();
    if (!bare || plain === text)
        return null;
    const pattern = new RegExp(bare.split(/\s+/).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'), 'g');
    // Unique counts every start, overlapping ones too ('very very' in 'very very very' is two places).
    const found = [];
    for (let m = pattern.exec(plain); m && found.length < 2; m = pattern.exec(plain)) {
        found.push(m);
        pattern.lastIndex = m.index + 1;
    }
    if (found.length !== 1)
        return null;
    const m = found[0], start = keep[m.index], end = keep[m.index + m[0].length - 1] + 1;
    return text.slice(start, end);
}
const clean = (t) => t.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ');
const cut = (t, n) => { if (t.length <= n)
    return t; const c = t.charCodeAt(n - 1); return t.slice(0, c >= 0xd800 && c <= 0xdbff ? n - 1 : n); };
export const normName = (n) => n.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
function check(ok, code = 'INVALID_INPUT') { if (!ok)
    throw new Error(code); }
function obj(v, keys, code) {
    check(!!v && typeof v === 'object' && !Array.isArray(v), code);
    check(Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k)), code);
}
function str(v, max, empty = false, code) {
    check(typeof v === 'string' && v.length <= max && (empty || !!v.trim()) && !CONTROL.test(v), code);
}
function arr(v, max, code) { check(Array.isArray(v) && v.length <= max, code); }
/** The whole request within MAP_BYTES of UTF-8 JSON; known aliases, parents and claim keys; nothing is clipped here. */
export function validateMapAsk(value) {
    const version = !!value && typeof value === 'object' ? value.schemaVersion : null;
    const three = version === MAP3_SCHEMA, two = three || version === MAP2_SCHEMA;
    obj(value, ['schemaVersion', 'project', 'parts', 'relations', 'records', ...(two ? ['requests'] : []), ...(three ? ['priors'] : [])]);
    if (value.schemaVersion !== MAP_SCHEMA && !two)
        throw new Error('UNSUPPORTED_VERSION');
    if (bytes(value) > MAP_BYTES)
        throw new Error('INPUT_TOO_LARGE');
    obj(value.project, ['name', 'purpose']);
    str(value.project.name, 120);
    if (value.project.purpose !== null)
        str(value.project.purpose, 2000);
    arr(value.parts, 200);
    const parts = new Set(), claims = new Set();
    for (const p of value.parts) {
        obj(p, ['id', 'name', 'note', 'parentId', 'readAs', 'role', 'roleBy', 'roleAbout', 'current']);
        check(typeof p.id === 'string' && PART.test(p.id) && !parts.has(p.id));
        parts.add(p.id);
        str(p.name, 60);
        str(p.note, 2000, true);
        if (p.readAs !== null)
            str(p.readAs, 60);
        str(p.role, 300, true);
        check(p.roleBy === null ? p.role === '' : (p.roleBy === 'reading' || p.roleBy === 'person') && !!p.role.trim());
        if (p.roleAbout !== null) {
            str(p.roleAbout, 80);
            check(p.roleBy === 'reading');
        }
        arr(p.current, 8);
        for (const c of p.current) {
            obj(c, ['key', 'kind', 'text', 'about']);
            if (c.about !== null)
                str(c.about, 80);
            check(typeof c.key === 'string' && CLAIM.test(c.key) && !claims.has(c.key));
            claims.add(c.key);
            check(CLAIM_KINDS.includes(c.kind));
            str(c.text, 240);
        }
    }
    for (const p of value.parts)
        check(p.parentId === null || (parts.has(p.parentId) && p.parentId !== p.id));
    arr(value.relations, 400);
    for (const r of value.relations) {
        obj(r, ['from', 'to', 'kind', 'note']);
        check(parts.has(r.from) && parts.has(r.to) && r.from !== r.to && RELS.includes(r.kind));
        str(r.note, 200, true);
    }
    arr(value.records, MAP_RECORDS);
    check(value.records.length > 0);
    const records = new Set();
    for (const r of value.records) {
        const hasTime = !!r && typeof r === 'object' && Object.hasOwn(r, 'addedAt');
        obj(r, ['id', 'kind', 'text', 'note', 'basis', ...(hasTime ? ['addedAt'] : [])]);
        check(typeof r.id === 'string' && RECORD.test(r.id) && !records.has(r.id));
        records.add(r.id);
        check(['pasted', 'request', 'report', 'evidence', 'answer', 'decision'].includes(r.kind));
        str(r.text, MAP_RECORD_CHARS);
        str(r.note, 600, true);
        str(r.basis, 300);
        if (hasTime) {
            str(r.addedAt, 30);
            check(Number.isFinite(Date.parse(r.addedAt)) && new Date(r.addedAt).toISOString() === r.addedAt);
        }
    }
    const requests = [];
    if (two) {
        arr(value.requests, 8);
        const ids = new Set();
        for (const r of value.requests) {
            const req = r && typeof r === 'object' && r.version === 'request-scope.1' ? validateFrozenRequest(r) : validateRequestContext(r);
            check(!ids.has(req.id));
            ids.add(req.id);
            requests.push(req);
        }
    }
    if (three) {
        arr(value.priors, MAP_PRIORS);
        const keys = new Set();
        for (const x of value.priors) {
            obj(x, ['key', 'quote', 'text', 'kind', 'stance', 'about', 'target']);
            check(typeof x.key === 'string' && PRIOR.test(x.key) && !keys.has(x.key));
            keys.add(x.key);
            str(x.quote, 300);
            str(x.text, 240);
            check(['reported', 'checked', 'code', 'test', 'open'].includes(x.kind));
            check(x.stance === null || MATCH_STANCES.includes(x.stance));
            if (x.about !== null)
                str(x.about, 200);
            obj(x.target, ['requestId', 'itemId']);
            check(hasTarget(requests, x.target));
        }
    }
    return structuredClone(value);
}
/** Exact keys and bounds; every part, claim and relation rests on a quote found in what was sent; known aliases only; new parts
 * named and grounded, with parents among known or new parts and no cycle; nothing in the reply looks like a key. Containment is
 * all this checks: not that a reading is right. */
export function validateMapReply(value, ask) {
    const code = 'INVALID_RESPONSE';
    const three = ask.schemaVersion === MAP3_SCHEMA, two = three || ask.schemaVersion === MAP2_SCHEMA;
    obj(value, ['summary', 'parts', 'relations', 'candidates', 'gaps', ...(two ? ['matches'] : [])], code);
    const parts = new Map(ask.parts.map(p => [p.id, p])), records = new Map(ask.records.map(r => [r.id, r]));
    const quote = (rec, q) => {
        check(typeof rec === 'string' && records.has(rec), code);
        str(q, 300, false, code);
        const t = q.trim(), span = t.length >= 6 ? resolveQuote(records.get(rec).text, t) : null;
        check(!!span && span.length <= 300, code);
        return { record: rec, quote: span };
    };
    str(value.summary, 200, true, code);
    arr(value.parts, 24, code);
    const refs = new Set(), news = new Map();
    for (const p of value.parts) {
        obj(p, ['ref', 'name', 'parent', 'role', 'roleAbout', 'roleReplaces', 'basis', 'claims'], code);
        check(typeof p.ref === 'string' && (parts.has(p.ref) || NEW.test(p.ref)) && !refs.has(p.ref), code);
        refs.add(p.ref);
        if (NEW.test(p.ref))
            news.set(p.ref, p.parent);
    }
    check(news.size <= 12, code);
    const outParts = value.parts.map(p => {
        const ref = p.ref, fresh = news.has(ref);
        if (fresh) {
            str(p.name, 60, false, code);
            check(p.parent === null || (typeof p.parent === 'string' && (parts.has(p.parent) || (news.has(p.parent) && p.parent !== ref))), code);
        }
        else
            check(p.name === null && p.parent === null, code);
        if (p.role !== null)
            str(p.role, 300, false, code);
        if (p.roleAbout !== null) {
            check(p.role !== null, code);
            str(p.roleAbout, 80, false, code);
        }
        // Replacing the current description needs the record's own words that it supersedes it: only for a part with a description
        // read from records (never a new part, never the person's own correction).
        let roleReplaces = null;
        if (p.roleReplaces !== null) {
            check(p.role !== null, code);
            obj(p.roleReplaces, ['record', 'quote'], code);
            const q = quote(p.roleReplaces.record, p.roleReplaces.quote);
            // Nothing read to replace (a new part, a part without a read description, the person's own): the quote has no effect.
            roleReplaces = !fresh && parts.get(ref)?.roleBy === 'reading' ? q : null;
        }
        arr(p.basis, 4, code);
        check(!fresh || p.basis.length > 0, code);
        const basis = p.basis.map(b => { obj(b, ['record', 'quote'], code); return quote(b.record, b.quote); });
        arr(p.claims, 4, code);
        const own = new Set(parts.get(ref)?.current.map(c => c.key) ?? []);
        const claims = p.claims.map((c) => {
            obj(c, ['kind', 'text', 'record', 'quote', 'about', 'replaces'], code);
            check(CLAIM_KINDS.includes(c.kind), code);
            str(c.text, 240, false, code);
            const q = quote(c.record, c.quote);
            if (c.about !== null)
                str(c.about, 80, false, code);
            check(c.replaces === null || (typeof c.replaces === 'string' && own.has(c.replaces)), code);
            return { kind: c.kind, text: c.text.trim(), record: q.record, quote: q.quote, about: c.about === null ? null : c.about.trim(), replaces: c.replaces };
        });
        // A description, new or changed, rests on its own quote: an existing part's role never comes in without one.
        check(fresh || p.role !== null || claims.length > 0, code);
        check(p.role === null || basis.length > 0, code);
        return { ref, name: fresh ? p.name.trim() : null, parent: fresh ? p.parent : null, role: p.role === null ? null : p.role.trim(),
            roleAbout: p.roleAbout === null ? null : p.roleAbout.trim(), roleReplaces, basis, claims };
    });
    // New parts form a forest under known parts: no cycle among them.
    for (const ref of news.keys()) {
        const seen = new Set();
        for (let x = ref; x && news.has(x); x = news.get(x)) {
            check(!seen.has(x), code);
            seen.add(x);
        }
    }
    arr(value.relations, 12, code);
    const ends = new Set([...parts.keys(), ...news.keys()]);
    const relations = value.relations.map(r => {
        obj(r, ['from', 'to', 'kind', 'note', 'record', 'quote'], code);
        check(typeof r.from === 'string' && typeof r.to === 'string' && ends.has(r.from) && ends.has(r.to) && r.from !== r.to && RELS.includes(r.kind), code);
        str(r.note, 200, true, code);
        const q = quote(r.record, r.quote);
        return { from: r.from, to: r.to, kind: r.kind, note: r.note.trim(), record: q.record, quote: q.quote };
    });
    arr(value.candidates, 6, code);
    const candidates = value.candidates.map(c => {
        obj(c, ['text', 'parts', 'record', 'quote'], code);
        str(c.text, 240, false, code);
        // A candidate names known parts or parts this same reply adds (new:...); nothing else.
        arr(c.parts, 2, code);
        for (const x of c.parts)
            check(typeof x === 'string' && ends.has(x), code);
        check(new Set(c.parts).size === c.parts.length, code);
        check((c.record === null) === (c.quote === null), code);
        const q = c.record === null ? null : quote(c.record, c.quote);
        return { text: c.text.trim(), parts: [...c.parts], record: q?.record ?? null, quote: q?.quote ?? null };
    });
    arr(value.gaps, 2, code);
    const gaps = value.gaps.map(g => { str(g, 160, false, code); return g.trim(); });
    let matches = [];
    if (two) {
        arr(value.matches, 24, code);
        const priors = new Map((ask.priors ?? []).map(x => [x.key, x])), taken = new Set();
        matches = value.matches.map(v => {
            let m;
            try {
                m = validateRequestMatch(v, ask.requests, three);
            }
            catch {
                throw new Error(code);
            }
            // Request correspondence quotes the literal sent passage; it does not repair or join excerpts.
            const rec = records.get(m.record), at = rec ? quoteAt(rec.text, m.quote) : null;
            check(rec && at && at.length >= 6 && at.length <= 300, code);
            const explicit = new Set(rec.text.match(/\bRQ_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi) ?? []);
            check(!explicit.size || m.targets.every(t => explicit.has(t.requestId)), code);
            check(!['code', 'test'].includes(m.kind) || rec.kind === 'evidence', code);
            const about = m.about === null ? null : resolveQuote(rec.text, m.about);
            check(m.about === null || about !== null, code);
            check(!secretLike(`${m.text}\n${m.why}`), code);
            // Identical frozen demands cannot be separated by arrival order. Retain all competing RQ targets, unless the report
            // explicitly names the request id (or the plan id AND revision) itself.
            const targets = [...m.targets];
            const eligible = (request) => !rec.addedAt || Date.parse(rec.addedAt) >= Date.parse(request.createdAt);
            check(targets.every(t => eligible(ask.requests.find(r => r.id === t.requestId))), code);
            for (const t of m.targets) {
                const req = ask.requests.find(r => r.id === t.requestId), item = req.items.find(i => i.id === t.itemId);
                if (rec.text.includes(req.id) || new RegExp(`${req.planId}\\s*/\\s*${req.planRevision}(?!\\d)`).test(rec.text))
                    continue;
                for (const other of ask.requests)
                    for (const i of other.items)
                        if (eligible(other) && other.id !== req.id && norm(i.title) === norm(item.title) && norm(i.description) === norm(item.description) && !targets.some(x => x.requestId === other.id && x.itemId === i.id))
                            targets.push({ requestId: other.id, itemId: i.id });
            }
            check(targets.length <= 8, code);
            const quoted = rec.text.slice(at.at, at.at + at.length);
            if (!three)
                return { ...m, quote: quoted, about, targets };
            // A withdrawal names a prior that was sent, for the very item that prior answers: anything else was made up.
            const key = v.replaces;
            check(key === null || (typeof key === 'string' && priors.has(key)), code);
            const prior = key === null ? null : priors.get(key);
            check(!prior || (m.targets.length === 1 && sameTarget(m.targets[0], prior.target)), code);
            // Doubtful ones keep the passage and drop the link (the two reports then read side by side): a remark that does not say
            // made or not made, another nature, the prior's own words, a second take-back of the same prior, a target widened to
            // identical items of other requests, or another named version the record never names.
            const holds = !!prior && !taken.has(prior.key) && targets.length === 1 && canReplace({ target: prior.target, excluded: false, replaced: false, kind: prior.kind, quote: prior.quote, about: prior.about }, { ...m, quote: quoted, about }, rec.text);
            if (holds)
                taken.add(prior.key);
            return { ...m, quote: quoted, about, targets, stance: m.stance, replaces: holds ? prior.key : null };
        });
    }
    const reply = { summary: value.summary.trim(), parts: outParts, relations, candidates, gaps, ...(two ? { matches } : {}) };
    // Words the model wrote (never the quotes, which are the person's own records) must not look like a key.
    const written = [reply.summary, ...gaps, ...outParts.flatMap(p => [p.name ?? '', p.role ?? '', p.roleAbout ?? '', ...p.claims.flatMap(c => [c.text, c.about ?? ''])]), ...relations.map(r => r.note), ...candidates.map(c => c.text)];
    check(!written.some(w => w && secretLike(w)), code);
    return reply;
}
const norm = (t) => t.replace(/\s+/g, ' ').trim();
export function partUnderstanding(p, areaId) {
    const history = [];
    let createdName = null, role = null, roleAbout = null;
    const others = [];
    let roleBasis = [];
    let corrected = null;
    const all = [], replaced = new Set();
    for (const r of p.readings) {
        if (!isMapReading(r)) {
            if (r.version === 'map-correction.1' && r.areaId === areaId) {
                role = r.text;
                roleAbout = null;
                roleBasis = [];
                corrected = { id: r.id, at: r.at };
            }
            continue;
        }
        const part = r.parts.find(x => x.areaId === areaId);
        if (!part)
            continue;
        if (part.created)
            createdName = part.created.name;
        // A correction holds the description only: a later reading's description reads apart, its claims still come in.
        if (part.role) {
            if (!role || (!corrected && part.roleReplaces)) {
                if (role)
                    others.unshift({ text: role, about: roleAbout, at: r.at });
                role = part.role;
                roleAbout = part.roleAbout;
                roleBasis = part.basis;
            }
            else
                others.unshift({ text: part.role, about: part.roleAbout, at: r.at });
        }
        history.push({ reading: r.id, at: r.at, role: part.role, claims: part.claims, basis: part.basis });
        part.claims.forEach((c, index) => { all.push({ ...c, reading: r.id, index, at: r.at }); if (c.replaces)
            replaced.add(`${c.replaces.reading}:${c.replaces.index}`); });
    }
    if (!history.length)
        return null;
    const seen = new Set(), claims = [];
    for (const c of all.reverse()) {
        // The same words about another version are another claim: never merged across versions.
        const key = `${c.kind}|${norm(c.text)}|${c.about ?? ''}`;
        if (replaced.has(`${c.reading}:${c.index}`) || seen.has(key))
            continue;
        seen.add(key);
        claims.push(c);
    }
    const state = STATE_ORDER.find(k => claims.some(c => c.kind === k)) ?? null;
    const revised = claims.some(c => !!c.replaces && (c.kind === 'reported' || c.kind === 'checked'));
    const roleBasisRevised = !corrected && roleBasis.length > 0 && roleBasis.every(q => insideRevised(p, areaId, q));
    // The corrected report reads first (claims are newest first; a replacing one goes ahead of the rest).
    claims.sort((a, b) => Number(!!b.replaces) - Number(!!a.replaces));
    return { role, roleAbout, roleBasis, corrected, others: others.slice(0, 6), claims: claims.slice(0, 12), history, createdName, state, revised, roleBasisRevised };
}
const spanCache = new WeakMap();
const recordText = (p, id) => p.pasted.find(r => r.id === id)?.text ?? p.sources.find(r => r.id === id)?.text ?? null;
/** Where a quote stands in its record, only when it stands there once (otherwise which passage is meant is not certain). */
function spanOnce(p, q) {
    const t = recordText(p, q.record);
    if (t === null)
        return null;
    const at = t.indexOf(q.quote);
    return at >= 0 && t.indexOf(q.quote, at + 1) < 0 ? { record: q.record, from: at, to: at + q.quote.length } : null;
}
/** Per part: passages of its reports and checks that no longer stand. A map claim of that part a later claim of the same part
 * replaced (a claim is named by reading, part and index: index alone repeats across parts), and a request match a later record
 * explicitly withdrew as not made, for the parts of the item it answered. A passage a current report or check of that same part
 * still rests on is not among them. Derived only; nothing is stored, removed or archived. */
export function revisedSpans(p) {
    const hit = spanCache.get(p);
    if (hit)
        return hit;
    const replaced = new Set(), maps = p.readings.filter(isMapReading), gone = new Map(), live = new Map();
    const add = (m, area, s) => { const l = m.get(area) ?? []; l.push(s); m.set(area, l); };
    for (const r of maps)
        for (const part of r.parts)
            for (const c of part.claims)
                if (c.replaces)
                    replaced.add(`${c.replaces.reading}|${part.areaId}|${c.replaces.index}`);
    for (const r of maps)
        for (const part of r.parts)
            part.claims.forEach((c, i) => {
                if (c.kind !== 'reported' && c.kind !== 'checked')
                    return;
                const s = spanOnce(p, c);
                if (s)
                    add(replaced.has(`${r.id}|${part.areaId}|${i}`) ? gone : live, part.areaId, s);
            });
    for (const x of requestMatches(p))
        if (x.replacedBy?.match.stance === 'not-made' && x.target) {
            const t = x.target, item = x.requests.find(q => q.id === t.requestId)?.items.find(i => i.id === t.itemId);
            for (const area of item?.partIds ?? [])
                add(gone, area, { record: x.match.record, from: x.match.from, to: x.match.to });
        }
    const out = new Map();
    for (const [area, spans] of gone) {
        const kept = spans.filter(s => !(live.get(area) ?? []).some(l => l.record === s.record && l.from < s.to && s.from < l.to));
        if (kept.length)
            out.set(area, kept);
    }
    spanCache.set(p, out);
    return out;
}
function insideRevised(p, area, q) {
    const spans = revisedSpans(p).get(area);
    if (!spans)
        return false;
    const s = spanOnce(p, q);
    return !!s && spans.some(x => x.record === s.record && s.from >= x.from && s.to <= x.to);
}
/** Relations a reading added on a quote that lies inside a report one of its two ends took back: the line stays (the person's
 * map), but it is not read as a current, confirmed connection. A relation the person drew has no quote and is never among them. */
const relationCache = new WeakMap();
export function revisedRelations(p) {
    const hit = relationCache.get(p);
    if (hit)
        return hit;
    const out = new Set();
    if (revisedSpans(p).size)
        for (const r of p.readings)
            if (isMapReading(r))
                for (const x of r.relations)
                    if (insideRevised(p, x.from, x.quote) || insideRevised(p, x.to, x.quote))
                        out.add(x.relationId);
    relationCache.set(p, out);
    return out;
}
/** Records of a project with text no map reading has read yet, newest first: pasted records as pasted, and the project's own
 * records. A record sent only in part comes back with its unread tail (from the end of what was read). */
export function unreadRecords(p, view) {
    const readTo = new Map();
    for (const r of p.readings)
        if (isMapReading(r))
            for (const x of r.records)
                readTo.set(x.id, Math.max(readTo.get(x.id) ?? 0, x.to));
    const pasted = p.pasted.map(r => ({ id: r.id, kind: 'pasted', text: r.text, at: r.at, label: '붙여넣은 기록', from: readTo.get(r.id) ?? 0 }));
    const own = view.records.map(r => ({ id: r.id, kind: r.kind, text: r.text, at: r.at, label: '프로젝트 기록', from: readTo.get(r.id) ?? 0 }));
    return [...pasted, ...own].filter(r => r.from < r.text.length).sort((a, b) => b.at.localeCompare(a.at));
}
export function buildMapAsk(p, view, requests = [], selectedRequestId) {
    const parts = new Map(), alias = new Map(), claims = new Map();
    view.parts.slice(0, 200).forEach((x, i) => { const a = `P${String(i + 1).padStart(2, '0')}`; parts.set(a, x.id); alias.set(x.id, a); });
    let c = 0;
    const askParts = view.parts.slice(0, 200).map(x => {
        const u = partUnderstanding(p, x.id);
        const current = (u?.claims ?? []).slice(0, 6).map(cl => { const key = `C${String(++c).padStart(2, '0')}`; claims.set(key, { reading: cl.reading, index: cl.index }); return { key, kind: cl.kind, text: cut(cl.text, 240), about: cl.about }; });
        return { id: alias.get(x.id), name: x.name, note: cut(clean(x.note), 2000), parentId: x.parentId ? alias.get(x.parentId) ?? null : null,
            readAs: u?.createdName && normName(u.createdName) !== normName(x.name) ? u.createdName : null, role: cut(u?.role ?? '', 300), roleBy: u?.role ? (u.corrected ? 'person' : 'reading') : null, roleAbout: u?.role && !u.corrected ? u.roleAbout : null, current };
    });
    const ask = {
        schemaVersion: MAP_SCHEMA,
        project: { name: cut(p.name, 120), purpose: p.space.brief ? cut(clean(p.space.brief.text), 2000) : null },
        parts: askParts,
        relations: view.relations.filter(r => alias.has(r.from) && alias.has(r.to)).slice(0, 400).map(r => ({ from: alias.get(r.from), to: alias.get(r.to), kind: r.kind, note: cut(r.note, 200) })),
        records: []
    };
    let unread = unreadRecords(p, view);
    if (selectedRequestId) {
        if (!requests.some(r => r.id === selectedRequestId))
            throw new Error('INVALID_REQUEST_SCOPE');
        // Explicit recovery may compare a report previously read without this RQ. Coverage is per RQ, from its contiguous
        // compared prefix, so an earlier map-only read or a sent tail does not hide an uncompared head forever.
        const compared = p.readings.filter(isMapReading).filter(r => r.requests?.some(q => q.id === selectedRequestId)).flatMap(r => r.records);
        const prefix = (id) => { let end = 0; for (const r of compared.filter(r => r.id === id).sort((a, b) => a.from - b.from))
            if (r.from <= end)
                end = Math.max(end, r.to); return end; };
        unread = [...p.pasted.map(r => ({ id: r.id, kind: 'pasted', text: r.text, at: r.at, label: '붙여넣은 기록', from: prefix(r.id) })),
            ...view.records.map(r => ({ id: r.id, kind: r.kind, text: r.text, at: r.at, label: '프로젝트 기록', from: prefix(r.id) }))].filter(r => r.from < r.text.length).sort((a, b) => b.at.localeCompare(a.at));
    }
    const records = new Map();
    const input = { ask, parts, records, claims, coverage: { fresh: unread.length, sent: 0, partial: 0 }, after: p.readings.filter(isMapReading).at(-1)?.id ?? null, problem: null };
    if (!unread.length)
        return { ...input, problem: 'NOTHING_NEW' };
    // All comparable contexts or a request the person explicitly chose. Full origins are never sent repeatedly per item.
    if (requests.length) {
        for (const r of requests) {
            validateFrozenRequest(r);
            if (r.projectId !== p.id)
                throw new Error('INVALID_REQUEST_SCOPE');
        }
        const chosen = selectedRequestId ? requests.filter(r => r.id === selectedRequestId) : requests, contexts = chosen.map(requestContext);
        input.requestCoverage = { total: requests.length, sent: 0 };
        if (chosen.length > 8 || bytes(contexts) > 28000)
            return { ...input, problem: 'REQUEST_CONTEXT_TOO_LARGE' };
        ask.schemaVersion = MAP3_SCHEMA;
        ask.requests = contexts;
        input.fullRequests = structuredClone(chosen);
        input.requestCoverage.sent = chosen.length;
        // What the records may take back: current matches of a single item of these requests, newest first, within their own budget.
        const ids = new Set(chosen.map(q => q.id)), priors = [], refs = new Map();
        for (const x of requestMatches(p)) {
            if (priors.length >= MAP_PRIORS)
                break;
            if (x.excluded || x.replacedBy || !x.target || !ids.has(x.target.requestId) || x.match.kind === 'open' || secretLike(`${x.match.quote}\n${x.match.text}`))
                continue;
            const key = `M${String(priors.length + 1).padStart(2, '0')}`, prior = { key, quote: x.match.quote, text: x.match.text, kind: x.match.kind, stance: x.match.stance ?? null, about: x.match.about, target: { ...x.target } };
            if (bytes([...priors, prior]) > PRIOR_BYTES)
                break;
            priors.push(prior);
            refs.set(key, { reading: x.reading, index: x.index, target: { ...x.target }, correction: x.correction });
        }
        ask.priors = priors;
        input.priors = refs;
    }
    // Structure first, bounded: the earlier understanding of each part shrinks before any record is left out.
    const mapBytes = () => bytes({ ...ask, ...(ask.requests ? { requests: [] } : {}), ...(ask.priors ? { priors: [] } : {}) });
    if (mapBytes() > META_BYTES)
        for (const x of ask.parts) {
            x.current = x.current.slice(0, 2);
            x.role = cut(x.role, 120);
            if (mapBytes() <= META_BYTES)
                break;
        }
    if (mapBytes() > META_BYTES)
        return { ...input, problem: 'TOO_LARGE' };
    // Priors give way first (the oldest go): they never keep a report from being read.
    while (ask.priors?.length && bytes(ask) > MAP_BYTES - MIN_RECORD_CHARS * 3)
        input.priors.delete(ask.priors.pop().key);
    if (bytes(ask) > MAP_BYTES - MIN_RECORD_CHARS * 3)
        return { ...input, problem: 'REQUEST_CONTEXT_TOO_LARGE' };
    let n = { N: 0, R: 0 };
    for (const r of unread) {
        if (ask.records.length >= MAP_RECORDS)
            break;
        const letter = r.kind === 'pasted' ? 'N' : 'R', id = `${letter}${String(++n[letter]).padStart(2, '0')}`;
        // Only the unread part goes: what is quoted is checked against exactly this excerpt.
        const rest = r.text.slice(r.from);
        let text = cut(clean(rest), MAP_RECORD_CHARS);
        const rec = { id, kind: r.kind, text, note: '', basis: `${r.label} · ${r.at} (가져온 시각이며 원문 작성·판본 시각이 아님)`, ...(ask.requests ? { addedAt: r.at } : {}) };
        const earlier = ask.requests?.filter(q => Date.parse(r.at) < Date.parse(q.createdAt)).map(q => q.id) ?? [];
        const note = () => [r.from > 0 || text.length < rest.length ? `원문 ${r.text.length}자 중 ${r.from + 1}~${r.from + text.length}자 구간만 보냄${r.from > 0 ? ' (앞 구간은 앞선 정리에서 읽음)' : ''}` : '',
            earlier.length ? `다음 요청문 생성 전에 붙인 이전 자료이며 후속 반환 근거가 아님: ${earlier.join(', ')}` : ''].filter(Boolean).join(' · ');
        rec.note = note();
        ask.records.push(rec);
        // A record takes the room that is left, down to a readable excerpt; one that cannot is left for the next reading.
        for (let g = 0; bytes(ask) > MAP_BYTES - 256 && text.length > MIN_RECORD_CHARS && g < 40; g++) {
            text = cut(text, Math.floor(text.length * 0.9));
            rec.text = text;
            rec.note = note();
        }
        if (bytes(ask) > MAP_BYTES - 256) {
            ask.records.pop();
            n[letter]--;
            break;
        }
        records.set(id, { id: r.id, from: r.from, to: r.from + text.length, total: r.text.length, text });
    }
    input.coverage = { fresh: unread.length, sent: ask.records.length, partial: [...records.values()].filter(x => x.to < x.total || x.from > 0).length };
    if (!ask.records.length)
        return { ...input, problem: 'TOO_LARGE' };
    const leak = ask.records.find(x => secretLike(x.text));
    if (leak)
        return { ...input, problem: { secret: leak.id } };
    return input;
}
/** Applies a validated reply on top of the project it was asked about, atomically: either every part, relation and the reading
 * are kept, or nothing is (the result is re-read by parseProject). Refused when another reading was applied meanwhile or a part
 * the reply names has gone; edits the person made meanwhile (names, notes, places, plans, records) are kept as they are. */
export function applyReading(project, input, reply, meta) {
    if (input.problem)
        throw new Error(input.problem === 'REQUEST_CONTEXT_TOO_LARGE' ? 'REQUEST_CONTEXT_TOO_LARGE' : 'INVALID_INPUT');
    const withRequests = input.ask.schemaVersion !== MAP_SCHEMA, three = input.ask.schemaVersion === MAP3_SCHEMA;
    const frozen = withRequests ? input.fullRequests ?? input.ask.requests.map(validateFrozenRequest) : [];
    if (frozen.some(r => r.projectId !== project.id) || JSON.stringify(frozen.map(requestContext)) !== JSON.stringify((input.ask.requests ?? []).map(r => r.version === 'request-scope.1' ? requestContext(r) : r)))
        throw new Error('INVALID_REQUEST_SCOPE');
    const done = project.readings.filter(isMapReading);
    if ((done.at(-1)?.id ?? null) !== input.after)
        throw new Error('MAP_CHANGED');
    if (done.some(r => r.hash === meta.hash))
        throw new Error('ALREADY_APPLIED');
    if (project.readings.length >= READINGS_LIMIT)
        throw new Error('READINGS_FULL');
    const addedAt = new Map([...project.pasted.map(r => [r.id, r.at]), ...project.sources.map(r => [r.id, r.at])]);
    for (const m of reply.matches ?? [])
        for (const t of m.targets) {
            const record = input.records.get(m.record), request = frozen.find(r => r.id === t.requestId);
            if (!record || !request || !addedAt.has(record.id) || Date.parse(addedAt.get(record.id)) < Date.parse(request.createdAt))
                throw new Error('INVALID_RESPONSE');
        }
    // A comparison may re-read an old interval. Only quotes containing previously unread bytes can change the map again.
    // Request matches still use the full reply below and are saved with their frozen context in the same write.
    const covered = done.flatMap(r => r.records);
    const freshQuote = (q) => {
        const source = input.records.get(q.record), at = source ? quoteAt(source.text, q.quote) : null;
        if (!source || !at)
            return false;
        let end = source.from + at.at;
        const limit = end + at.length;
        for (const r of covered.filter(r => r.id === source.id && r.to > end && r.from < limit).sort((a, b) => a.from - b.from)) {
            if (r.from > end)
                return true;
            end = Math.max(end, r.to);
            if (end >= limit)
                return false;
        }
        return end < limit;
    };
    const mapParts = reply.parts.flatMap(x => {
        const basis = x.basis.filter(freshQuote), claims = x.claims.filter(freshQuote), role = basis.length ? x.role : null;
        if (x.name !== null ? !basis.length : !role && !claims.length)
            return [];
        return [{ ...x, basis, claims, role, roleAbout: role ? x.roleAbout : null, roleReplaces: role && x.roleReplaces && freshQuote(x.roleReplaces) ? x.roleReplaces : null }];
    });
    const mapRelations = reply.relations.filter(freshQuote);
    const comparisonOnly = frozen.length > 0 && [...input.records].every(([record, source]) => !freshQuote({ record, quote: source.text }));
    const active = (id) => project.space.areas.some(a => a.id === id && !a.archived);
    for (const id of input.parts.values())
        if (!active(id))
            throw new Error('MAP_CHANGED');
    const real = (q) => ({ record: input.records.get(q.record).id, quote: q.quote });
    const claimOf = (c) => ({ kind: c.kind, text: c.text, ...real(c), about: c.about, replaces: c.replaces ? input.claims.get(c.replaces) : null });
    let p = project;
    const ids = new Map(input.parts), skipped = [], candidates = [], parts = [], created = [];
    const parentOf = (id) => p.space.containment.parents[id] ?? null;
    const madeBefore = done.flatMap(r => r.parts.filter(x => x.created).map(x => ({ areaId: x.areaId, ...x.created })));
    // New parts, parents first (the reply's own order otherwise).
    const queue = mapParts.filter(x => x.name !== null), dropped = new Set(reply.parts.filter(x => x.name !== null && !mapParts.some(p => p.ref === x.ref)).map(x => x.ref));
    for (let guard = 0; queue.length && guard < 64; guard++) {
        for (let i = 0; i < queue.length; i++) {
            const x = queue[i];
            if (x.parent && !ids.has(x.parent) && !dropped.has(x.parent))
                continue;
            queue.splice(i--, 1);
            if (x.parent && dropped.has(x.parent)) {
                dropped.add(x.ref);
                skipped.push({ what: 'part', name: x.name, reason: 'parent-skipped' });
                continue;
            }
            const parentId = x.parent ? ids.get(x.parent) : null, key = normName(x.name);
            const same = p.space.areas.find(a => !a.archived && parentOf(a.id) === parentId && normName(a.name) === key)
                ?? madeBefore.map(m => p.space.areas.find(a => a.id === m.areaId && !a.archived && m.parentId === parentId && normName(m.name) === key)).find(Boolean);
            if (same) {
                // Not the same thing by its name alone: the new one is not added, and nothing is attached to the existing one.
                dropped.add(x.ref);
                skipped.push({ what: 'part', name: x.name, reason: 'same-name' });
                candidates.push({ text: `‘${x.name}’: 같은 이름의 부분이 이미 있어 새로 만들지 않았어요. 같은 대상인지는 원문으로 확인해 주세요.`, areaIds: [same.id], quote: real(x.basis[0]) });
                continue;
            }
            if (madeBefore.some(m => m.parentId === parentId && normName(m.name) === key && p.space.areas.some(a => a.id === m.areaId && a.archived))) {
                dropped.add(x.ref);
                skipped.push({ what: 'part', name: x.name, reason: 'archived' });
                continue;
            }
            p = parentId ? addChildArea(p, parentId, x.name, '') : addArea(p, x.name, '');
            const id = p.space.areas.at(-1).id;
            ids.set(x.ref, id);
            created.push(id);
            parts.push({ areaId: id, created: { name: p.space.areas.at(-1).name, parentId }, role: x.role, roleAbout: x.roleAbout, roleReplaces: null, basis: x.basis.map(real), claims: x.claims.map(claimOf) });
        }
    }
    // What the reply itself leaves undecided between parts is not also settled on one of them: a claim on a part a candidate names,
    // resting on the same quote as that candidate, stays with the candidate only.
    const unsure = reply.candidates.filter(c => c.quote && c.parts.length).map(c => ({ parts: new Set(c.parts.map(a => ids.get(a))), record: input.records.get(c.record).id, quote: c.quote }));
    const overlaps = (a, b) => a.includes(b) || b.includes(a);
    const settled = (areaId, c) => !unsure.some(u => u.parts.has(areaId) && u.record === c.record && overlaps(u.quote, c.quote));
    for (const x of mapParts)
        if (x.name === null)
            parts.push({ areaId: ids.get(x.ref), created: null, role: x.role, roleAbout: x.roleAbout, roleReplaces: x.roleReplaces ? real(x.roleReplaces) : null, basis: x.basis.map(real), claims: x.claims.map(claimOf) });
    for (const part of parts)
        part.claims = part.claims.filter(c => settled(part.areaId, c));
    for (let i = parts.length - 1; i >= 0; i--)
        if (!parts[i].created && !parts[i].role && !parts[i].claims.length)
            parts.splice(i, 1);
    const relations = [];
    const madeRelations = done.flatMap(r => r.relations);
    for (const r of mapRelations) {
        const from = ids.get(r.from), to = ids.get(r.to), name = `${r.from}→${r.to}`;
        if (!from || !to) {
            skipped.push({ what: 'relation', name, reason: 'parent-skipped' });
            continue;
        }
        if (p.space.relations.some(x => x.from === from && x.to === to && x.kind === r.kind)) {
            skipped.push({ what: 'relation', name, reason: 'exists' });
            continue;
        }
        if (madeRelations.some(x => x.from === from && x.to === to && x.kind === r.kind && !p.space.relations.some(y => y.id === x.relationId))) {
            skipped.push({ what: 'relation', name, reason: 'removed' });
            continue;
        }
        p = addRelation(p, from, to, r.kind, r.note);
        relations.push({ relationId: p.space.relations.at(-1).id, from, to, kind: r.kind, quote: real(r) });
    }
    // A candidate naming a part this reply wanted to add but that was not added keeps its words, without that part.
    for (const c of reply.candidates)
        candidates.push({ text: c.text, areaIds: c.parts.map(a => ids.get(a)).filter((x) => !!x), quote: c.record ? real({ record: c.record, quote: c.quote }) : null });
    // A withdrawal holds only for the match it was asked about as it still is: the person may have retargeted or excluded it (or
    // another record taken it back) while this was being read. Then the passage is kept and the link is not.
    const now = three ? requestMatches(project) : [];
    const matches = (reply.matches ?? []).map(m => {
        const source = input.records.get(m.record), at = quoteAt(source.text, m.quote), stored = { ...m, record: source.id, from: source.from + at.at, to: source.from + at.at + at.length };
        if (!three)
            return stored;
        const { replaces: key, ...rest } = stored;
        const ref = key === null ? undefined : input.priors?.get(key), cur = ref && now.find(x => x.reading === ref.reading && x.index === ref.index);
        const holds = !!cur && !cur.excluded && !cur.replacedBy && !!cur.target && sameTarget(cur.target, ref.target) && cur.correction === ref.correction;
        return { ...rest, replaces: holds ? { reading: ref.reading, index: ref.index } : null };
    });
    const reading = { version: three ? 'map-reading.3' : withRequests ? 'map-reading.2' : 'map-reading.1', id: meta.id, at: meta.at, model: meta.model, prompt: meta.prompt, hash: meta.hash,
        records: [...input.records.values()].map(r => ({ id: r.id, from: r.from, to: r.to, total: r.total })),
        summary: comparisonOnly ? '이미 지도에 읽은 원문을 고른 요청과 다시 대조했어요.' : reply.summary, parts, relations, candidates: candidates.slice(0, 16), gaps: reply.gaps, skipped: skipped.slice(0, 64),
        ...(withRequests ? { requests: structuredClone(frozen), matches } : {}) };
    p = addReading(p, reading);
    const next = parseProject(JSON.stringify(p));
    const corresponding = matches.filter(m => m.targets.length === 1).flatMap(m => {
        const target = m.targets[0], req = input.ask.requests?.find(q => q.id === target.requestId);
        return req?.items.find(i => i.id === target.itemId)?.partIds.filter(active) ?? [];
    });
    return { project: next, reading, created, touched: [...new Set([...parts.map(x => x.areaId), ...corresponding])] };
}
