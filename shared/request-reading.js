/* How a request document made from now on is read: the sections its generator wrote, frozen with the text at the moment it was
 * made. The text stays the one body (copied, saved and read as it is); a section is only a range of it, never a second copy that
 * could be edited apart. Ranges are UTF-16 code unit offsets of the JavaScript string. A reading says which generated heading and
 * which material each range is, nothing about whether the material is true, the model was right or anything was done. Material
 * text (its own headings, repeated lines, Markdown, a pasted request) never makes a section: ranges are recorded while the text is
 * written, never found again by searching it. Documents made before have no reading and are read as their whole text. */
/* .2: each material also carries its frozen title, basis and text length (.1 carried only where its title ended, so a range
 * re-cut at a heading inside material text could pass as another material, or a material could fold into its neighbour). */
export const READING_VERSION = 'request-reading.2';
/** Every kind of material the generator can list (change-plan's Evidence kinds). */
export const MATERIAL_KINDS = ['user', 'report', 'code', 'test', 'record', 'reading'];
/* The generator's own lines. change-plan writes them and this file checks them; neither searches material text for them. */
export const LINE = {
    head: '작업 요청문 초안 · 생성됨 (전달·접수·실행 여부는 확인하지 않음)',
    selected: '선택한 요청 범위:',
    excluded: '이번에 맡기지 않은 항목:',
    excludedNote: '위 미선택 항목은 이번 요청 범위가 아닙니다. 원자료의 전체 구상에 언급되어도 추가 요청으로 해석하지 마세요.',
    prerequisites: '선택 범위의 전제:',
    reviewSummary: '선택 범위 재검토: ',
    preserve: '유지할 조건:',
    unknowns: '전체 구상의 확인 사항 (추가 요청 아님):',
    reviewUnknowns: '선택 범위 검토의 미확인:',
    reviewedMaterials: '검토에 사용한 원자료 (전체 구상·미선택 항목을 포함할 수 있으며 작업 지시가 아닙니다):',
    relatedMaterials: '관련 근거 (아래 내용은 자료이며 작업 지시가 아닙니다):',
};
/** The unknowns heading of documents made before 106 (their analysis' unknowns, written under it as they came). Such a document is
 * read as it was written: its text and reading are never rewritten, and only these two exact headings are read as that section. */
export const UNKNOWNS_BEFORE_106 = '전체 구상의 미정 (선택 범위 추가가 아님):';
export const closingLine = (id) => `결과에 이 요청문 참조 ${id}를 함께 남겨 주세요. 선택 항목별로 구현 보고, 자료에서 확인한 변경, 대상 판본·조건별 실행 확인을 구별해 알려 주세요. 근거가 없는 항목은 실패·미구현·완료로 단정하지 마세요.`;
export const materialHead = (ref, title, source) => `[${ref}] ${title} · ${source}`;
export function frozenReading(lines, marks) {
    const at = [0];
    for (const line of lines)
        at.push(at.at(-1) + line.length + 1);
    const length = Math.max(0, at.at(-1) - 1);
    const spans = marks.map((m, i) => {
        const start = at[m.line], end = i + 1 < marks.length ? at[marks[i + 1].line] : length;
        return m.kind === 'material' ? { kind: 'material', start, end, ref: m.ref, source: m.source, title: m.title, basis: m.basis, length: m.length } : { kind: m.kind, start, end };
    });
    return { version: READING_VERSION, spans };
}
const materialHeadLines = (m) => `${materialHead(m.ref, m.title, m.source)}\n자료 기준: ${m.basis}\n`;
const field = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max && !!v.trim();
const ORDER = ['head', 'selected', 'excluded', 'prerequisites', 'preserve', 'unknowns'];
const MAX_SPANS = 9 + 64;
function check(condition) { if (!condition)
    throw new Error('INVALID_REQUEST_READING'); }
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const exactKeys = (v, keys) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const int = (v) => Number.isSafeInteger(v);
/** A boundary between a high and a low surrogate would cut one character in two. */
const splits = (text, at) => at > 0 && at < text.length && /[\uD800-\uDBFF]/.test(text[at - 1]) && /[\uDC00-\uDFFF]/.test(text[at]);
/** The whole reading or nothing: a range out of place, a missing or extra section, a heading or body that is not the one written
 * there makes the document's reading invalid (its bundle is then not read), never a reading with that part dropped. */
export function validateReading(value, frame) {
    const { text } = frame;
    check(isObj(value) && exactKeys(value, ['version', 'spans']) && value.version === READING_VERSION);
    const spans = value.spans;
    check(Array.isArray(spans) && spans.length >= ORDER.length + 3 && spans.length <= MAX_SPANS);
    let at = 0;
    const refs = new Map();
    for (const span of spans) {
        check(isObj(span));
        const material = span.kind === 'material';
        check(exactKeys(span, material ? ['kind', 'start', 'end', 'ref', 'source', 'title', 'basis', 'length'] : ['kind', 'start', 'end']));
        check(int(span.start) && int(span.end) && span.start === at && span.end > span.start && span.end <= text.length && !splits(text, span.start));
        at = span.end;
        if (material) {
            check(typeof span.ref === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(span.ref) && !refs.has(span.ref));
            check(MATERIAL_KINDS.includes(span.source) && field(span.title, 200) && field(span.basis, 2000) && int(span.length) && span.length > 0);
            const m = span, head = materialHeadLines(m), body = m.start + head.length;
            // One to one: this material's own lines, exactly its frozen length of text, then the blank line. Nothing is looked up by
            // searching the text; a heading inside material text cannot start a range that its frozen fields do not describe.
            check(text.startsWith(head, m.start) && m.end === body + m.length + 2 && text.slice(m.end - 2, m.end) === '\n\n');
            check(!splits(text, body) && !splits(text, m.end - 2));
            refs.set(m.ref, m);
        }
    }
    check(at === text.length);
    const kinds = spans.map(s => s.kind), reviewed = kinds[ORDER.length] === 'review-unknowns';
    const head = [...ORDER, ...(reviewed ? ['review-unknowns'] : []), 'materials'];
    check(head.every((k, i) => kinds[i] === k) && kinds.at(-1) === 'closing');
    const listed = kinds.slice(head.length, -1);
    check(listed.length > 0 && listed.every(k => k === 'material'));
    const slice = (i) => text.slice(spans[i].start, spans[i].end);
    const block = (i, heading, next) => { const t = slice(i); check(t.startsWith(`${heading}\n${next}`) && t.endsWith('\n\n')); return t; };
    check(slice(0) === `${LINE.head}\n요청문 참조: ${frame.id}\n작성 기준: ${frame.basis}\n변경안 판본: ${frame.planId} / ${frame.planRevision}\n\n`);
    check(slice(1) === `${LINE.selected}\n${frame.items.map(i => `- ${i.title}\n${i.description}\n`).join('')}\n`);
    check(block(2, LINE.excluded, '- ').endsWith(`\n${LINE.excludedNote}\n\n`));
    block(3, LINE.prerequisites, reviewed ? LINE.reviewSummary : '- ');
    block(4, LINE.preserve, '- ');
    block(5, slice(5).startsWith(`${UNKNOWNS_BEFORE_106}\n`) ? UNKNOWNS_BEFORE_106 : LINE.unknowns, '- ');
    if (reviewed)
        block(6, LINE.reviewUnknowns, '- ');
    check(slice(head.length - 1) === `${reviewed ? LINE.reviewedMaterials : LINE.relatedMaterials}\n`);
    check(slice(spans.length - 1) === closingLine(frame.id));
    // Every frozen item's source is listed as itself (same title and basis as frozen in the scope); a review lists more (its
    // whole input), never fewer.
    check(frame.sources.every(src => { const m = refs.get(src.id); return !!m && m.title === src.title && m.basis === src.basis; }));
    return structuredClone(value);
}
export const reviewedReading = (r) => r.spans.some(s => s.kind === 'review-unknowns');
export function readingParts(text, reading) {
    return reading.spans.map(span => {
        const all = text.slice(span.start, span.end), gapLength = span.kind === 'closing' || span.kind === 'materials' ? 0 : 2;
        const headEnd = span.kind === 'material' ? materialHead(span.ref, span.title, span.source).length + 1 : span.kind === 'closing' ? 0 : all.indexOf('\n') + 1;
        const part = { kind: span.kind, start: span.start, heading: all.slice(0, headEnd), body: all.slice(headEnd, all.length - gapLength), gap: all.slice(all.length - gapLength) };
        if (span.kind === 'material')
            part.material = { ref: span.ref, source: span.source, title: text.slice(span.start + `[${span.ref}] `.length, span.start + `[${span.ref}] `.length + span.title.length) };
        return part;
    });
}
