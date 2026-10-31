/* The marker a handover document carries (handover.ts writes it): af-handover:CODE[:part] on its first and last line. A session
 * whose person pasted that document is known by it, and the document itself is folded to one line when the session is taken in. */
export const HANDOVER_TAG = 'af-handover';
const CODE = '[A-Z0-9]{6}', AREA = '[A-Za-z0-9_-]{1,80}';
const START = new RegExp(`^─+ AgentFlow 인수인계 문서 · ${HANDOVER_TAG}:(${CODE})(?::(${AREA}))? ─+$`, 'm');
// The end line names the part too (older documents name only the code), so a document copied without its first line still folds.
const END = (code) => new RegExp(`^─+ 인수인계 문서 끝 · ${HANDOVER_TAG}:(${code})(?::(${AREA}))? ─+$`, 'm');
const RECEIVED = `\\[AgentFlow 인수인계 문서를 받아 이어감 · ${HANDOVER_TAG}:(${CODE})(?::(${AREA}))?(?: · ([^\\]\\n]*))?\\]`;
/** The one line a folded document leaves (RECEIVED reads it back). */
const received = (code, area, title) => `[AgentFlow 인수인계 문서를 받아 이어감 · ${HANDOVER_TAG}:${code}${area ? `:${area}` : ''}${title ? ` · ${title.replace(/[\]\n]/g, ' ')}` : ''}]`;
/** The headings of a document's sections, as handover.ts writes them (a part's own heading is ### or deeper). */
export const HANDOVER_SECTIONS = ['## 이어받는 방법', '## 프로젝트 한눈에', '## 작업 장소와 세션', '## 부분별 현재 상태', '## 이 범위의 현재 상태', '## 아직 정하지 않은 것', '## 최근 흐름'];
/** The other lines a document starts a paragraph with (after a blank line, or under a heading). */
const OPENERS = ['이 문서는 AgentFlow Studio가', '아직 지도에 부분이 없어요', '최근에 바뀐 파일: ', '그 밖의 부분 ', '(지도는 ', '(문서가 길어서 '];
/** Where a document whose end line was not copied ends: after its last line of a document's shape. Each of its lines is a heading,
 * a list item, the one line under a heading (the time it was made, the project's summary) or one of its own paragraph openers, and
 * after a blank line only a heading or an opener follows. The first line of any other shape is the person's own (what they wrote
 * under the document), and from there on nothing is folded. from: just after the start line. */
function documentEnd(text, from) {
    const lines = text.slice(from).split('\n');
    let end = from, at = from + lines[0].length, prev = 'head';
    for (const line of lines.slice(1)) {
        at += 1;
        if (!line.trim()) {
            prev = 'blank';
            at += line.length;
            continue;
        }
        const head = /^#{3,6} \S/.test(line) || /^# 인수인계: /.test(line) || HANDOVER_SECTIONS.some(h => line.startsWith(h)), opener = OPENERS.some(o => line.startsWith(o));
        if (!(head || opener || (prev !== 'blank' && (/^ *- /.test(line) || prev === 'head'))))
            break;
        at += line.length;
        end = at;
        prev = head ? 'head' : 'item';
    }
    return end;
}
/** A fresh six-character code (no 0/O/1/I to misread). */
export function handoverCode() {
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', b = new Uint8Array(6);
    globalThis.crypto.getRandomValues(b);
    return [...b].map(x => abc[x % abc.length]).join('');
}
/** A person's message that carries a handover document: the document (start marker to its end marker, or to its last line of a
 * document's shape when the end was not pasted: documentEnd; from its title line when the start line was not copied) becomes one line
 * naming it, the person's own words around it stay as written. */
export function foldHandover(text) {
    let out = text;
    for (let guard = 0; guard < 8; guard++) {
        let from, to, code, area;
        const m = START.exec(out);
        if (m) {
            const end = END(m[1]).exec(out.slice(m.index + m[0].length));
            // Its end line not copied: folded to its last line, so what the person wrote under it stays; the blank lines after it stay too
            // (in a pasted record they set off the next block's head).
            from = m.index;
            to = end ? from + m[0].length + end.index + end[0].length : documentEnd(out, from + m[0].length);
            code = m[1];
            area = m[2];
        }
        else {
            const end = END(CODE).exec(out), head = end ? [...out.slice(0, end.index).matchAll(/^# 인수인계: /gm)].at(-1) : undefined;
            if (!end || !head)
                break;
            from = head.index;
            to = end.index + end[0].length;
            code = end[1];
            area = end[2];
        }
        const title = /^# 인수인계: (.+)$/m.exec(out.slice(from, to))?.[1]?.trim();
        out = `${out.slice(0, from)}${received(code, area, title)}${out.slice(to)}`;
    }
    return out;
}
/** Handovers a session record says it started from: the code and, for a part's handover, the part. Only the person's requests count,
 * each folded as the import folds it, and only a marker that starts a line there: one quoted inside a request (an older document's
 * recent flow) or written in an answer is not how this session started. */
export function receivedHandovers(text) {
    if (!text.includes(HANDOVER_TAG))
        return []; // most records: read for every part of a map, so this stays one plain search
    const asks = text.split(/^── /m).slice(1).filter(b => b.startsWith('사용자 요청')).map(b => foldHandover(b.slice(b.indexOf('\n') + 1)));
    return asks.flatMap(a => [...a.matchAll(new RegExp(`^${RECEIVED}`, 'gm'))].map(m => ({ code: m[1], areaId: m[2] ?? null })));
}
/** A request as a later document quotes it: a handover it started from is named in words, without its code, so the quote is never
 * read as a takeover again. */
export const quoteReceived = (text) => foldHandover(text).replace(new RegExp(RECEIVED, 'g'), (_m, _code, _area, title) => `(인수인계 문서로 시작${title ? ` · ${title}` : ''})`);
