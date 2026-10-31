/* AF114: a provided code or check file kept as a normal record (PastedRecord) with the person's declaration of what it is (code or
 * check record) and of its name, version and origin. Pure: the exact metadata shape, its identity for duplicates, the words a reading
 * and a source view show for it, and the one projection kind. The declaration is the person's: the app never ran, fetched or
 * verified the file, and nothing here derives a kind from the text, the name or an extension. No storage, owner or job. */
import { PASTED_TEXT_LIMIT } from './types.js';
import { secretLike } from './secret.js';
export const EVIDENCE_NAME_MAX = 120, EVIDENCE_VERSION_MAX = 80, EVIDENCE_ORIGIN_MAX = 300;
export const EVIDENCE_KINDS = ['code', 'test'];
export const EVIDENCE_KIND_LABEL = { code: '코드 자료', test: '검사 자료' };
/** The one statement a provided source carries wherever it is shown or sent. */
export const NOT_EXECUTED = '사용자 분류·제공 원문 · 앱이 실행·검증하지 않음';
export const NOT_RECORDED = '기록 없음';
/** One line of plain text: no control character, tab, line break or line separator; no space at either end. */
const LINE_BAD = /[\u0000-\u001f\u007f\u2028\u2029]/;
const line = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max && v.trim() === v && !LINE_BAD.test(v) && !secretLike(v);
/** The stored time of a record is a full ISO instant (24 characters); the map's basis is bounded with that length. */
const AT_LENGTH = 24, BASIS_MAX = 300, NOTE_MAX = 600;
/** What a map request's note may add after the declaration (an excerpt range and the requests made after it): kept free here so
 * the declaration is never cut to make room. */
export const NOTE_RESERVE = 160;
export const isTyped = (r) => r.evidence !== undefined;
/** Exactly {kind,name,version,origin}: a known kind, a name, and a version and origin that are a line or null. */
export function validEvidence(v) {
    if (!v || typeof v !== 'object' || Array.isArray(v))
        return false;
    const keys = Object.keys(v), e = v;
    if (keys.length !== 4 || !['kind', 'name', 'version', 'origin'].every(k => Object.hasOwn(v, k)))
        return false;
    if (!EVIDENCE_KINDS.includes(e.kind) || !line(e.name, EVIDENCE_NAME_MAX))
        return false;
    if (e.version !== null && !line(e.version, EVIDENCE_VERSION_MAX))
        return false;
    if (e.origin !== null && !line(e.origin, EVIDENCE_ORIGIN_MAX))
        return false;
    // Shown in full where a map request carries it: within the existing basis and note bounds, never cut to fit.
    const d = e;
    return mapBasis(d, 'T'.repeat(AT_LENGTH)).length <= BASIS_MAX && mapNoteHead(d).length + NOTE_RESERVE <= NOTE_MAX;
}
/** The canonical metadata, in a fixed key order. */
export const canonicalEvidence = (e) => ({ kind: e.kind, name: e.name, version: e.version, origin: e.origin });
/** A record's identity for duplicates: a pasted record by its exact text; a provided source by its exact text and exact declaration
 * (the part looked at when adding it is context, not identity). The two never meet: the same bytes pasted and provided are two. */
export const recordIdentity = (r) => r.evidence ? `e${JSON.stringify([r.evidence.kind, r.evidence.name, r.evidence.version, r.evidence.origin, r.text])}` : `p${r.text}`;
/** How a normal record is read into the map: pasted as it came, or a provided source (kind evidence) whatever its letters look like. */
export const recordKind = (r) => (r.evidence ? 'evidence' : 'pasted');
export const recordLabel = (r) => (r.evidence ? `사용자 제공 ${EVIDENCE_KIND_LABEL[r.evidence.kind]}` : '붙여넣은 기록');
/** The map request's basis: what it is, its name and declared version, and when it was added here (never a version). */
export function mapBasis(e, at) {
    return `사용자 제공 ${EVIDENCE_KIND_LABEL[e.kind]} · 이름 ${e.name} · 사용자 기재 판본 ${e.version ?? NOT_RECORDED} · ${at} (가져온 시각이며 원문 작성·판본 시각이 아님)`;
}
/** The map request's note opens with the declaration's status and declared origin. */
export const mapNoteHead = (e) => `${NOT_EXECUTED} · 사용자 기재 출처 ${e.origin ?? NOT_RECORDED}`;
/** One line for a source list or view: kind, name, version and origin as declared. */
export const provenanceLine = (e) => `${EVIDENCE_KIND_LABEL[e.kind]} · ${e.name} · 판본 ${e.version ?? NOT_RECORDED} · 출처 ${e.origin ?? NOT_RECORDED} (사용자 기재)`;
/** A provided file is bounded by its bytes before it is read: no text within the record limit (60000 UTF-16 units) needs more than
 * three UTF-8 bytes per unit, plus a byte order mark. */
export const PROVIDED_FILE_BYTES = PASTED_TEXT_LIMIT * 3 + 3;
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
/** The file's bytes as its text, exactly: strict UTF-8 (any invalid sequence refuses the file), a leading byte order mark kept as
 * U+FEFF, CRLF and every space kept. Then the rules every record has (not blank, within the limit, no control character but tab,
 * CR and LF, nothing that looks like a key). Nothing is stripped, normalised or cut. */
export function decodeProvided(bytes) {
    if (bytes.length > PROVIDED_FILE_BYTES)
        return { problem: 'TOO_LARGE' };
    let text;
    try {
        text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    }
    catch {
        return { problem: 'NOT_UTF8' };
    }
    if (!text.trim())
        return { problem: 'EMPTY' };
    if (text.length > PASTED_TEXT_LIMIT)
        return { problem: 'TOO_LONG' };
    if (CONTROL.test(text))
        return { problem: 'CHARACTERS' };
    if (secretLike(text))
        return { problem: 'SECRET' };
    return { text };
}
/** Which declared field cannot be kept, if any (the form says it before anything is saved). */
export function evidenceProblem(e) {
    if (!line(e.name, EVIDENCE_NAME_MAX))
        return 'name';
    if (e.version !== null && !line(e.version, EVIDENCE_VERSION_MAX))
        return 'version';
    if (e.origin !== null && !line(e.origin, EVIDENCE_ORIGIN_MAX))
        return 'origin';
    return validEvidence(e) ? null : 'origin';
}
