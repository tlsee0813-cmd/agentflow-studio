/* AF100: a map reading kept as a durable job by the local Node server. Shared by the browser (which reserves, sends and later
 * applies it) and the server (which checks, keeps and runs it), so both read one contract.
 * map-input.1 carries a MapInput across JSON without losing what applyReading needs: its Maps go as ordered pairs exactly as built
 * (nothing is rebuilt from the project as it is now), the record excerpts with their original coordinates, the full frozen
 * requests (ask.requests holds only their request-context.1 projection, without sources) and the priors with the correction each
 * had when it was asked. Every alias the ask refers to must be in its Map with the value it stands for; a claim alias the ask no
 * longer shows (buildMapAsk maps claims before it trims ask.parts[].current) is kept as it was, never refused or dropped. */
import { validateMapAsk, askRecords, MAP4_SCHEMA, MAP5_SCHEMA, MAP6_SCHEMA, MAP7_SCHEMA } from './map-reading.js';
import { validateFrozenRequest, requestContext, sameTarget } from './request-return.js';
export const MAP_INPUT_CODEC = 'map-input.1';
export const MAP_JOB_VERSION = 'map-job.1';
/** Only the anchored wires go as jobs: their reply is a wire of references, checked again against the very request (map.7: later
 * readings only, bound to its own m7 recipe). */
export const JOB_SCHEMAS = [MAP4_SCHEMA, MAP5_SCHEMA, MAP6_SCHEMA, MAP7_SCHEMA];
export const JOB_ID = /^MJ_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** 32 random bytes, base64url without padding. Sent only as a header; the server keeps its SHA-256. */
export const JOB_CAPABILITY = /^[A-Za-z0-9_-]{43}$/;
const ENTRY = /^E_[A-Za-z0-9-]{8,64}$/, HEX64 = /^[0-9a-f]{64}$/, SAFE_ID = /^[A-Za-z0-9_.:-]{1,120}$/;
const PART = /^P\d{2,3}$/, RECORD = /^[NR]\d{2,3}$/, CLAIM = /^C\d{2,3}$/, PRIOR = /^M\d{2}$/;
function check(ok) { if (!ok)
    throw new Error('INVALID_INPUT'); }
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
function keys(v, list) { check(isObj(v) && Object.keys(v).length === list.length && list.every(k => Object.hasOwn(v, k))); }
const nat = (v, min = 0) => Number.isSafeInteger(v) && v >= min;
const sid = (v) => typeof v === 'string' && SAFE_ID.test(v);
/** SHA-256 (hex) of a value's JSON: the reading hash of an ask, and the binding of an input. */
export async function jobHash(value) {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
export function encodeMapInput(inp) {
    if (inp.problem)
        throw new Error('INVALID_INPUT');
    return structuredClone({
        version: MAP_INPUT_CODEC, ask: inp.ask, parts: [...inp.parts], records: [...inp.records], claims: [...inp.claims],
        coverage: inp.coverage, after: inp.after, requestCoverage: inp.requestCoverage ?? null, fullRequests: inp.fullRequests ?? null,
        priors: inp.priors ? [...inp.priors] : null
    });
}
/** The MapInput a wire stands for, or INVALID_INPUT. The ask is checked as the server checks any map ask; every alias it refers to
 * resolves to what was sent (parts and records exactly: an extra one would change what is applied), and the full requests project
 * exactly onto ask.requests. Nothing is rebuilt; the Maps keep their order. */
export function decodeMapInput(value) {
    keys(value, ['version', 'ask', 'parts', 'records', 'claims', 'coverage', 'after', 'requestCoverage', 'fullRequests', 'priors']);
    check(value.version === MAP_INPUT_CODEC);
    const ask = validateMapAsk(value.ask);
    check(JOB_SCHEMAS.includes(ask.schemaVersion) && JSON.stringify(ask) === JSON.stringify(value.ask));
    const pairs = (v, alias, item, max) => {
        check(Array.isArray(v) && v.length <= max);
        const out = new Map();
        for (const x of v) {
            check(Array.isArray(x) && x.length === 2 && typeof x[0] === 'string' && alias.test(x[0]) && !out.has(x[0]) && item(x[1]));
            out.set(x[0], x[1]);
        }
        return out;
    };
    const parts = pairs(value.parts, PART, sid, 200);
    check(new Set(parts.values()).size === parts.size);
    check(parts.size === ask.parts.length && ask.parts.every((p, i) => [...parts.keys()][i] === p.id));
    const records = pairs(value.records, RECORD, (x) => {
        try {
            keys(x, ['id', 'from', 'to', 'total', 'text']);
        }
        catch {
            return false;
        }
        return sid(x.id) && nat(x.from) && nat(x.to, 1) && nat(x.total, 1) && x.from < x.to && x.to <= x.total && typeof x.text === 'string' && x.text.length === x.to - x.from;
    }, 8);
    const sent = askRecords(ask);
    check(records.size === ask.records.length && ask.records.every((r, i) => [...records.keys()][i] === r.id && sent.get(r.id)?.text === records.get(r.id).text));
    const claims = pairs(value.claims, CLAIM, (x) => {
        try {
            keys(x, ['reading', 'index']);
        }
        catch {
            return false;
        }
        return sid(x.reading) && nat(x.index);
    }, 1200);
    for (const p of ask.parts)
        for (const c of p.current)
            check(claims.has(c.key));
    keys(value.coverage, ['fresh', 'sent', 'partial']);
    check(nat(value.coverage.fresh) && nat(value.coverage.sent) && nat(value.coverage.partial) && value.coverage.sent === ask.records.length);
    check(value.after === null || sid(value.after));
    let requestCoverage = null;
    if (value.requestCoverage !== null) {
        keys(value.requestCoverage, ['total', 'sent']);
        check(nat(value.requestCoverage.total) && nat(value.requestCoverage.sent));
        requestCoverage = { total: value.requestCoverage.total, sent: value.requestCoverage.sent };
    }
    let fullRequests = null;
    if (value.fullRequests !== null) {
        check(Array.isArray(value.fullRequests) && value.fullRequests.length <= 8);
        fullRequests = value.fullRequests.map(r => { validateFrozenRequest(r); return r; });
        check(JSON.stringify(fullRequests.map(requestContext)) === JSON.stringify(ask.requests ?? []));
    }
    else
        check(!ask.requests?.length);
    let priors = null;
    if (value.priors !== null) {
        check(fullRequests !== null);
        priors = pairs(value.priors, PRIOR, (x) => {
            try {
                keys(x, ['reading', 'index', 'target', 'correction']);
                keys(x.target, ['requestId', 'itemId']);
            }
            catch {
                return false;
            }
            return sid(x.reading) && nat(x.index) && sid(x.target.requestId) && sid(x.target.itemId) && (x.correction === null || sid(x.correction));
        }, 64);
        for (const p of ask.priors ?? [])
            check(priors.has(p.key) && sameTarget(priors.get(p.key).target, p.target));
    }
    else
        check(!ask.priors?.length);
    const out = { ask, parts, records, claims, coverage: { ...value.coverage }, after: value.after, problem: null };
    if (requestCoverage)
        out.requestCoverage = requestCoverage;
    if (fullRequests)
        out.fullRequests = structuredClone(fullRequests);
    if (priors)
        out.priors = new Map(structuredClone([...priors]));
    return out;
}
export function validateBinding(v) {
    keys(v, ['entryId', 'projectId', 'lifecycle', 'seq', 'after', 'schemaVersion', 'prompt', 'model', 'askHash', 'inputHash']);
    check(typeof v.entryId === 'string' && ENTRY.test(v.entryId) && sid(v.projectId) && nat(v.lifecycle, 1) && (v.seq === null || nat(v.seq, 1)) && (v.after === null || sid(v.after)));
    check(typeof v.schemaVersion === 'string' && JOB_SCHEMAS.includes(v.schemaVersion) && typeof v.prompt === 'string' && /^m[4-7]-[0-9a-f]{12}$/.test(v.prompt) && typeof v.model === 'string' && /^[\w.-]{1,80}$/.test(v.model));
    check(typeof v.askHash === 'string' && HEX64.test(v.askHash) && typeof v.inputHash === 'string' && HEX64.test(v.inputHash));
    return { ...v };
}
/** A submission whose binding is the input's own: the same ask hash, input hash, map position, schema and project. */
export async function validateSubmit(v) {
    keys(v, ['version', 'id', 'binding', 'input']);
    check(v.version === MAP_JOB_VERSION && typeof v.id === 'string' && JOB_ID.test(v.id));
    const binding = validateBinding(v.binding), input = decodeMapInput(v.input);
    check(binding.after === input.after && binding.schemaVersion === input.ask.schemaVersion);
    check((input.fullRequests ?? []).every(r => r.projectId === binding.projectId));
    check(binding.askHash === await jobHash(input.ask) && binding.inputHash === await jobHash(v.input));
    return { submit: v, input };
}
