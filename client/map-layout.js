/** Frames are a little wider than a node so the head keeps its name beside the fold and go-inside controls. */
export const FRAME_MIN_W = 228;
/** NODE_W: a row's width (long names widen it). NODE_H: the least height of a unit card. */
export const NODE_W = 200, NODE_H = 52, UNIT_W = 240, PAD = 14, GAP = 8, COL_GAP = 76, ROW_GAP = 22, GHOST_W = 168, GHOST_H = 34;
/** Head of a group inside a region: one line, or two when the name needs them (names never shrink). */
export const HEAD = 34, HEAD_2 = 52;
/** A planned change line under a part's name in the preview (12px). */
export const PLAN_LINE = 15;
/** Between wrapped columns of one layer (no relation runs between them, so they sit closer than relation layers). */
export const WRAP_GAP = 36;
/** Between relation layers inside a group: room for converging lines to stay apart. */
export const FLOW_GAP = 44;
/** A list: columns of short rows. */
export const LIST_GAP = 18, LIST_ROW_GAP = 2;
/** Between an open group and a sibling: a lane wide enough for a line to pass between them. */
export const FRAME_GUTTER = 40;
export const ROOT = 'root';
export const ghostId = (id) => `ghost:${id}`;
/** The head over the scope's own boundary end (see placeEnds). */
export const SELF_HEAD = '이 범위';
const GHOST_GAP = 8, RUN_GAP = 14, GHOST_MIN_W = 112, GHOST_MAX_W = 300;
/** Where a partner outside the scope belongs, as the map says it under its name: its own ancestors that are not the scope's
 * (outermost first), else the parent it shares with the scope, else the top of the project (''). Read from the structure only. */
export function ghostContext(v, scope, id) {
    const byId = new Map(v.parts.map(p => [p.id, p])), mine = new Set();
    for (let c = scope ? byId.get(scope) : undefined, g = 0; c && g < 64; c = c.parentId ? byId.get(c.parentId) : undefined, g++)
        mine.add(c.id);
    const up = [];
    for (let c = byId.get(byId.get(id)?.parentId ?? ''), g = 0; c && g < 64; c = c.parentId ? byId.get(c.parentId) : undefined, g++)
        up.unshift(c.id);
    const own = up.filter(x => !mine.has(x));
    return (own.length ? own : up.slice(-1)).map(x => byId.get(x).name).join(' › ');
}
/** Lines a text takes in a box of this room: one when it fits whole, else as many as it needs, with the share left for word ends
 * that the other wrapped texts of the map keep. Never capped: the box is as tall as what the browser draws. */
const wrapLines = (need, room) => (need <= room ? 1 : Math.ceil((need * 1.12 + 6) / Math.max(40, room)));
/** An outside partner's card: its whole name, as wide as the name (at least GHOST_MIN_W, so a short name keeps a target) up to
 * 300px, then wrapping (an identifier may break anywhere), so it is never cut. 12.5px name lines of 17px; padding 6+7, borders 2.
 * Where it belongs reads once over its run (GhostHead). */
export function ghostSize(name, measure = estimate) {
    const need = measure(name, 'item') * 1.02 + 2, chrome = 22, w = Math.min(GHOST_MAX_W, Math.max(GHOST_MIN_W, Math.ceil(need) + chrome));
    return { w, h: Math.max(GHOST_H, 15 + wrapLines(need, w - chrome) * 17) };
}
/** The head over a run of outside partners as styles.css draws it (.ghost-head: 600 11px, 16px lines, letter-spacing .04em = 0.44px
 * after every character), with 4px under it; as wide as its column, wrapping as it needs. Measured in that font and tracking,
 * never through another text's proxy: a proxy that happens to match one system font wraps in another (two lines drawn where one
 * was kept). */
export const HEAD_TRACK = 0.44;
export const headNeed = (text, measure) => measure(text, 'where') + HEAD_TRACK * [...text].length + 2;
const CJK = 'ᄀ-ᇿ㄰-㆏가-힯一-鿿';
const UNITS = new RegExp(`\\s+|[${CJK}]|[^\\s${CJK}]+`, 'g');
/** Lines a caption takes in a column of this width, broken as the browser breaks it (.ghost-head: normal word-break, overflow-wrap
 * anywhere): after spaces and between Hangul or CJK characters, a run longer than a whole line anywhere; greedy, line by line.
 * A total width over the column misses the room left at the end of each line (two long words that do not share a line), so the
 * lines are counted where they really break. A line is full a pixel early, so a measuring tie keeps a line more, never one less. */
export function captionLines(text, room, measure = estimate) {
    const width = (t) => (t ? measure(t, 'where') + HEAD_TRACK * [...t].length : 0), fits = (t) => width(t.trimEnd()) <= room - 1;
    let lines = 1, line = '';
    for (const unit of text.match(UNITS) ?? []) {
        if (fits(line + unit) || /^\s+$/.test(unit)) {
            line += unit;
            continue;
        } // spaces hang at a line's end
        if (line.trim()) {
            lines++;
            line = '';
        }
        let rest = unit;
        while (!fits(rest) && rest.length > 1) {
            let n = 1;
            while (n < rest.length - 1 && fits(rest.slice(0, n + 1)))
                n++;
            lines++;
            rest = rest.slice(n);
        }
        line = rest;
    }
    return lines;
}
const headSize = (text, w, measure) => 4 + captionLines(text, w, measure) * 16;
/** Rough rendered width of a frame name (13px, semibold): wide for CJK, narrower for Latin. Only decides one or two head lines. */
export function textWidth(text) {
    let w = 0;
    for (const ch of text)
        w += /[ᄀ-ᇿ⺀-꓏가-힯豈-﫿＀-￯]/.test(ch) ? 13.4 : /[A-Z@]/.test(ch) ? 8.8 : /[ .,:;'|il!]/.test(ch) ? 4.2 : 7.6;
    return w;
}
const SCALE = { node: 13.5 / 13, item: 0.98, head: 15 / 13, sub: 1, note: 12.5 / 13 * 0.92, plan: 12 / 13 * 0.95, where: 11 / 13 };
const estimate = (text, kind) => textWidth(text) * SCALE[kind];
/** The first sentence of a note: what a region or unit says about itself on the map. The rest belongs to the selection. */
export function lead(note) {
    const t = note.replace(/\s+/g, ' ').trim(), m = /^(.+?[.!?。])(?=\s|$)/.exec(t);
    return m ? m[1] : t;
}
/** The note's first sentence as the map shows it: empty when a sibling says the very same sentence (a shared label such as
 * "a real source file" read once per sibling is noise); the full note stays with the selection. */
export function mapLead(v, id) {
    const p = v.parts.find(x => x.id === id);
    if (!p)
        return '';
    const own = lead(p.note);
    if (!own)
        return '';
    const sibs = p.parentId ? v.parts.find(x => x.id === p.parentId)?.childIds ?? [] : v.roots;
    return sibs.some(s => s !== id && lead(v.parts.find(x => x.id === s)?.note ?? '') === own) ? '' : own;
}
/** Long part names widen their card (never the short ones) so the name fits two lines: room beside the name is the card
 * minus its paddings, and with an inside also the fold toggle and the go-inside count. */
export const NODE_MAX_W = 320;
/** A list item's horizontal padding and border without an inside (styles.css .node.item). */
const ITEM_SIDES = 10 + 8 + 2;
const nodeChrome = (kids, extra = 0) => (kids ? 5 + 22 + 4 + 4 + 40 + 8 + 2 + extra : 13 + 8 + 2);
/** extra: room a part with an inside gives its boundary count beside the name (linkChipW). */
export function nodeWidth(name, kids, measure = estimate, extra = 0) {
    // Lines break at word ends, not mid-word: leave a share of each line unused.
    const need = measure(name, 'node') * 1.12 + 8, one = measure(name, 'node') + 2;
    // A name that reads on one line beside the toggle and the way in keeps its one line beside the count too: the card widens.
    if (extra && one <= NODE_W - nodeChrome(kids))
        return Math.min(NODE_MAX_W, Math.max(NODE_W, Math.ceil(one) + nodeChrome(kids, extra)));
    const w = need <= (NODE_W - nodeChrome(kids, extra)) * 2 ? NODE_W : Math.min(NODE_MAX_W, Math.ceil(need / 2) + nodeChrome(kids, extra));
    // A name on two lines keeps its longest word whole ('JSContext.eval', never 'JSContext.eva|l'), up to NODE_MAX_W.
    const word = Math.max(0, ...name.split(/\s+/).map(x => measure(x, 'node') + 2));
    return one > w - nodeChrome(kids, extra) && word > w - nodeChrome(kids, extra) ? Math.min(NODE_MAX_W, Math.ceil(word) + nodeChrome(kids, extra) + 4) : w;
}
export function boundaryCounts(v) {
    const byId = new Map(v.parts.map(p => [p.id, p])), m = new Map();
    const up = (id) => { const out = []; for (let c = byId.get(id), g = 0; c && g < 64; c = c.parentId ? byId.get(c.parentId) : undefined, g++)
        out.push(c.id); return out; };
    for (const r of v.relations) {
        const a = up(r.from), b = up(r.to), sa = new Set(a), sb = new Set(b);
        const bump = (id, side) => { const c = m.get(id) ?? { all: 0, in: 0, out: 0, plain: 0 }; c.all++; if (r.kind === 'related')
            c.plain++;
        else
            c[side]++; m.set(id, c); };
        for (const id of a)
            if (!sb.has(id))
                bump(id, 'out');
        for (const id of b)
            if (!sa.has(id))
                bump(id, 'in');
    }
    return m;
}
/** The boundary count beside a head's name ('↔ 12', 11px with its border and padding) and the gap before it; 0 when none. */
export const linkChipW = (n) => (n > 0 ? 4 + 30 + 6 * String(n).length : 0);
/** A first view over its count budget folds every group with an inside alike (the person's own fold or unfold excepted), so
 * no group reads as singled out by its size; each folded head still says how many relations cross it. */
export function budgetFold(groups, own, budget) {
    const shown = groups.reduce((n, g) => n + 1 + g.size, 0);
    return new Set(shown <= budget ? [] : groups.filter(g => g.size > 0 && !own(g.id)).map(g => g.id));
}
/** Siblings (direct children of a container) that a relation between their subtrees links to another sibling. */
function linkedSiblings(v, ids) {
    const byId = new Map(v.parts.map(p => [p.id, p])), set = new Set(ids), out = new Set();
    const lift = (id) => { let cur = byId.get(id), g = 0; while (cur && !set.has(cur.id) && g++ < 64)
        cur = cur.parentId ? byId.get(cur.parentId) : undefined; return cur && set.has(cur.id) ? cur.id : null; };
    for (const r of v.relations) {
        const a = lift(r.from), b = lift(r.to);
        if (a && b && a !== b) {
            out.add(a);
            out.add(b);
        }
    }
    return out;
}
/** A long run of siblings, mostly without an inside and rarely linked to each other, reads as a list (rows in columns):
 * a command catalogue, a folder of files. Decided from the structure alone. */
export function isListGroup(v, container) {
    const byId = new Map(v.parts.map(p => [p.id, p])), ids = container ? byId.get(container)?.childIds ?? [] : v.roots;
    if (ids.length < 8)
        return false;
    const leaves = ids.filter(id => !(byId.get(id)?.childIds.length)).length;
    return leaves >= ids.length * 0.7 && linkedSiblings(v, ids).size <= Math.floor(ids.length / 5);
}
/** planned: only while a change preview reads on the map, the lines a part's own row will show under its name (each text it can
 * show; the longest, up to two lines, decides). Only these parts take that room; every other box keeps its current size.
 * aspect: width/height of the window's map (not of what a reading pane leaves of it): the scope's own unlinked parts are set in
 * as many columns as make their block closest to that shape, instead of one tall column. */
export function layoutScope(v, scope, expanded, pos, measureText = estimate, planned, aspect = 1.6) {
    const byId = new Map(v.parts.map(p => [p.id, p]));
    const kidsOf = (id) => (id ? byId.get(id)?.childIds ?? [] : v.roots);
    const open = (id, depth) => depth < 12 && kidsOf(id).length > 0 && expanded(id, depth);
    const memo = new Map();
    const listMemo = new Map();
    const listOf = (container) => { const k = container ?? ROOT; if (!listMemo.has(k))
        listMemo.set(k, isListGroup(v, container)); return listMemo.get(k); };
    const names = new Map();
    for (const p of v.parts)
        names.set(p.name, (names.get(p.name) ?? 0) + 1);
    // A part with an inside keeps room beside its name for its boundary count.
    const cross = boundaryCounts(v), chip = (id) => (kidsOf(id).length ? linkChipW(cross.get(id)?.all ?? 0) : 0);
    // Automatic arrangement of siblings: longest-path columns over relations lifted to the siblings; long columns wrap.
    const autoArrange = (container, sizes) => {
        const ids = kidsOf(container), set = new Set(ids);
        const lift = (id) => { let cur = byId.get(id), guard = 0; while (cur && !set.has(cur.id) && guard++ < 64)
            cur = cur.parentId ? byId.get(cur.parentId) : undefined; return cur && set.has(cur.id) ? cur.id : null; };
        if (listOf(container)) {
            // A list keeps its own order in columns. Rows linked outward sit in the last column and rows linked from outside in the
            // first, so their lines leave the list at its edge instead of running under other rows.
            const outward = new Set(), inward = new Set();
            for (const r of v.relations) {
                const a = lift(r.from), b = lift(r.to);
                if (a && !b)
                    outward.add(a);
                if (b && !a)
                    inward.add(b);
            }
            const order = [...ids.filter(i => inward.has(i) && !outward.has(i)), ...ids.filter(i => !inward.has(i) && !outward.has(i)), ...ids.filter(i => outward.has(i))];
            const cols = Math.min(4, Math.max(1, Math.ceil(order.length / 8))), per = Math.ceil(order.length / cols);
            const at = new Map();
            let x = 0;
            for (let c = 0; c < cols; c++) {
                const col = order.slice(c * per, (c + 1) * per);
                if (!col.length)
                    break;
                let y = 0;
                const w = Math.max(...col.map(i => sizes.get(i).w));
                for (const i of col) {
                    const sz = sizes.get(i);
                    at.set(i, { x: x - sz.ox, y: y - sz.oy });
                    y += sz.h + LIST_ROW_GAP;
                }
                x += w + LIST_GAP;
            }
            return at;
        }
        const out = new Map(ids.map(i => [i, new Set()]));
        const reaches = (a, b) => { const seen = new Set(), st = [a]; while (st.length) {
            const x = st.pop();
            if (x === b)
                return true;
            if (seen.has(x))
                continue;
            seen.add(x);
            st.push(...out.get(x));
        } return false; };
        for (const r of v.relations) {
            const a = lift(r.from), b = lift(r.to);
            if (a && b && a !== b && !reaches(b, a))
                out.get(a).add(b);
        }
        const layer = new Map();
        const depthOf = (id, guard = 0) => {
            if (layer.has(id))
                return layer.get(id);
            let d = 0;
            for (const [from, tos] of out)
                if (tos.has(id) && guard < 64)
                    d = Math.max(d, depthOf(from, guard + 1) + 1);
            layer.set(id, d);
            return d;
        };
        ids.forEach(i => depthOf(i));
        // Parts linked to a sibling come first, by relation layer; siblings with no link here follow as their own block, so a line
        // never has to pass an unrelated part between its ends. Inside a group a plain chain (one part per layer) runs top to bottom.
        const linked = new Set();
        for (const [x, tos] of out)
            if (tos.size) {
                linked.add(x);
                tos.forEach(t => linked.add(t));
            }
        const layers = [];
        for (const i of ids)
            if (linked.has(i))
                (layers[layer.get(i)] ??= []).push(i);
        // A part the scope's outside refers to and nothing inside links (a shared definition) opens the scope's order, as rows linked
        // from outside open a list: its outside partners then sit beside it. The order is the scope's own; nothing here depends on
        // what is selected, and a stored position still wins.
        const fromOut = container !== null && container === scope ? ids.filter(i => !linked.has(i) && v.relations.some(r => lift(r.to) === i && !lift(r.from))) : [];
        if (fromOut.length)
            layers.unshift(fromOut);
        const flow = layers.filter(Boolean), lone = ids.filter(i => !linked.has(i) && !fromOut.includes(i)), inFrame = container !== scope;
        const maxPer = Math.max(4, Math.min(8, Math.ceil(Math.sqrt(ids.length * 1.3))));
        const wrap = (c) => { if (c.length <= maxPer)
            return [c]; const per = Math.ceil(c.length / Math.ceil(c.length / maxPer)), o = []; for (let i = 0; i < c.length; i += per)
            o.push(c.slice(i, i + per)); return o; };
        // Each column: its parts, the gap after it, and whether it is centred against the tallest relation column.
        const cols = [];
        if (inFrame && flow.length && flow.every(l => l.length === 1))
            cols.push(...wrap(flow.map(l => l[0])).map(c => ({ ids: c, gap: GAP, centre: false })));
        else
            flow.forEach(l => { const w = wrap(l); w.forEach((c, i) => cols.push({ ids: c, gap: i < w.length - 1 ? (inFrame ? GAP : WRAP_GAP) : inFrame ? FLOW_GAP : COL_GAP, centre: w.length === 1 })); });
        if (cols.length && lone.length)
            cols.at(-1).gap = inFrame ? (cols.at(-1).gap === GAP ? GAP : FLOW_GAP) : WRAP_GAP;
        // The scope's own unlinked parts: no order between them to keep, so they go where the whole block needs the least zoom in a
        // window of this shape: as columns beside the linked block, or in rows under it (never inside a relation layer, which would
        // read as a step). Parts inside a group keep their one readable column.
        const colW = (c) => Math.max(...c.map(i => sizes.get(i).w)), colH = (c) => c.reduce((a, i) => a + sizes.get(i).h, 0) + ROW_GAP * (c.length - 1);
        const flowCols = cols.length, flowW = cols.reduce((a, x) => a + colW(x.ids) + x.gap, 0), flowH = Math.max(0, ...cols.map(x => colH(x.ids)));
        const need = (W, H) => Math.max(W, H * aspect);
        let side = wrap(lone), below = null;
        if (!inFrame && lone.length) {
            let score = Infinity;
            for (let per = 1; per <= lone.length; per++) {
                const cs = [];
                for (let i = 0; i < lone.length; i += per)
                    cs.push(lone.slice(i, i + per));
                const sc = need(flowW + cs.reduce((a, x) => a + colW(x), 0) + WRAP_GAP * (cs.length - 1), Math.max(flowH, ...cs.map(colH)));
                if (sc < score - 1e-6) {
                    score = sc;
                    side = cs;
                }
            }
            if (flowCols) {
                // Rows under the linked block are a grid: one cell width (the widest unlinked part), so the rows' left edges line up.
                const cell = Math.max(...lone.map(i => sizes.get(i).w)), room = Math.max(flowW - WRAP_GAP, cell), rows = [];
                const per = Math.max(1, Math.floor((room + WRAP_GAP) / (cell + WRAP_GAP)));
                for (let i = 0; i < lone.length; i += per)
                    rows.push(lone.slice(i, i + per));
                const rowH = (r) => Math.max(...r.map(i => sizes.get(i).h));
                const sc = need(Math.max(flowW - WRAP_GAP, room), flowH + ROW_GAP * 2 + rows.reduce((a, r) => a + rowH(r), 0) + ROW_GAP * (rows.length - 1));
                if (sc < score - 1e-6)
                    below = rows;
            }
        }
        if (below)
            cols.at(-1).gap = inFrame ? FLOW_GAP : COL_GAP;
        else
            cols.push(...side.map(c => ({ ids: c, gap: inFrame ? GAP : WRAP_GAP, centre: false })));
        const gapY = inFrame ? GAP : ROW_GAP;
        // An open group beside or under another sibling keeps a lane (FRAME_GUTTER) so lines can pass between them instead of under one.
        const isFrame = (i) => sizes.get(i).head > 0, pairGap = (p, q) => (isFrame(p) || isFrame(q) ? Math.max(gapY, FRAME_GUTTER) : gapY);
        cols.forEach((c, ci) => { const n = cols[ci + 1]; if (n && (c.ids.some(isFrame) || n.ids.some(isFrame)))
            c.gap = Math.max(c.gap, FRAME_GUTTER); });
        // Relation layers centre against the tallest relation layer only: a tall block of unlinked parts beside them does not
        // push them down.
        const heights = cols.map(c => c.ids.reduce((acc, i, k) => acc + sizes.get(i).h + (k ? pairGap(c.ids[k - 1], i) : 0), 0)), tallest = Math.max(0, ...heights.slice(0, flowCols));
        const at = new Map();
        let x = 0;
        cols.forEach((c, ci) => {
            const w = Math.max(...c.ids.map(i => sizes.get(i).w));
            let y = c.centre ? (tallest - heights[ci]) / 2 : 0;
            c.ids.forEach((i, k) => { const sz = sizes.get(i); if (k)
                y += pairGap(c.ids[k - 1], i); at.set(i, { x: x - sz.ox, y: y - sz.oy }); y += sz.h; });
            x += w + c.gap;
        });
        if (below) {
            let y = tallest + ROW_GAP * 2;
            for (const r of below) {
                const cell = Math.max(...lone.map(i => sizes.get(i).w));
                let rx = 0;
                for (const i of r) {
                    const sz = sizes.get(i);
                    at.set(i, { x: rx - sz.ox, y: y - sz.oy });
                    rx += cell + WRAP_GAP;
                }
                y += Math.max(...r.map(i => sizes.get(i).h)) + ROW_GAP;
            }
        }
        return at;
    };
    const anchors = (container, depth) => {
        const ids = kidsOf(container), sizes = new Map(ids.map(i => [i, measure(i, depth, container)]));
        const auto = autoArrange(container, sizes), stored = pos[container ?? ROOT] ?? {};
        return { sizes, at: new Map(ids.map(i => [i, stored[i] ? { ...stored[i] } : auto.get(i)])) };
    };
    const hasRecords = (id, guard = 0) => { const p = byId.get(id); return !!p && guard < 64 && (!!p.lastAt || p.childIds.some(c => hasRecords(c, guard + 1))); };
    // Korean text breaks between words (keep-all): leave a share of each line unused.
    // A text that fits whole on one line, as measured in its own font, takes one line (the browser lays it out with the same
    // measure; they agree to within hundredths of a pixel). Only a text that must wrap keeps the share left for word ends.
    const lines = (text, kind, room, max = 2) => {
        if (!text)
            return 0;
        const w = measureText(text, kind);
        if (w + 0.25 <= room)
            return 1;
        return Math.min(max, Math.max(2, Math.ceil((w * 1.15 + 6) / Math.max(40, room))));
    };
    // Planned lines are short phrases measured in their own font: a smaller share is left for word ends than for notes.
    const plannedLines = (id, room) => Math.max(0, ...(planned?.get(id) ?? []).map(t => Math.min(2, Math.ceil((measureText(t, 'plan') * 1.06 + 4) / Math.max(40, room)))));
    // A folded part standing for a planned part inside it reads one line naming that inner part.
    const plannedInside = (id) => !!planned && [...planned.keys()].some(k => { for (let p = byId.get(k)?.parentId, g = 0; p && g < 64; p = byId.get(p)?.parentId, g++)
        if (p === id)
            return true; return false; });
    const nodeLines = (id, room) => plannedLines(id, room) || (plannedInside(id) ? 1 : 0);
    /** Region head: the name (one or two lines; a longer name widens the region rather than being cut) and the first sentence of
     * the note under it. Head row: toggle 28, go-inside ~44, paddings ~12, and the latest-record time ~52 when there is one. */
    const regionHead = (id, w) => {
        const p = byId.get(id), room = (x) => x - 84 - (hasRecords(id) ? 52 : 0) - chip(id), chrome = w - room(w);
        // A region keeps its name on one line when it can (up to 320px), and on two lines otherwise (up to 380px).
        const need = measureText(p.name, 'head') * 1.08 + 4;
        if (need > room(w))
            w = Math.max(w, Math.min(320, Math.ceil(need) + chrome));
        if (need > room(w) * 2)
            w = Math.max(w, Math.min(380, Math.ceil(need / 2) + chrome + 12));
        // The note runs under the whole head row; a region widens (up to 340px) rather than cut its sentence after two lines.
        const note = mapLead(v, id), noteNeed = note ? measureText(note, 'note') * 1.15 + 6 : 0;
        if (noteNeed > (w - 44) * 2)
            w = Math.max(w, Math.min(340, Math.ceil(noteNeed / 2) + 44));
        const nl = need > room(w) ? 2 : 1, ll = lines(note, 'note', w - 44), pl = plannedLines(id, room(w));
        // In a preview the planned lines sit under the name in place of the note (hidden there); the head never shrinks.
        return { w, head: 12 + nl * 22 + Math.max(ll ? 3 + ll * 17 : 0, pl ? 3 + pl * PLAN_LINE : 0) + 14 };
    };
    /** Group head inside a region: its name only. A name keeps one line when the group can widen to hold it (up to 300px, as a
     * region keeps its own up to 320px); else it takes a second line, broken between words (styles.css: keep-all), the group
     * widening (up to 360px) so its longest word fits a line and no last letter is left alone. */
    const groupHead = (id, w) => {
        const name = byId.get(id)?.name ?? '', need = measureText(name, 'sub') * 1.08, room = (x) => x - 88 - (hasRecords(id) ? 52 : 0) - chip(id), chrome = w - room(w);
        if (need > room(w) && need + chrome <= 300)
            w = Math.ceil(need + chrome);
        if (need > room(w) * 2)
            w = Math.max(w, Math.min(360, Math.ceil(need / 2) + chrome + 12));
        const word = Math.max(0, ...name.split(/\s+/).map(x => measureText(x, 'sub') * 1.08));
        if (need > room(w) && word > room(w))
            w = Math.max(w, Math.min(360, Math.ceil(word) + chrome + 4));
        const pl = plannedLines(id, room(w));
        return { w, head: (need > room(w) ? HEAD_2 : HEAD) + (pl ? 3 + pl * PLAN_LINE : 0) };
    };
    function measure(id, depth, container) {
        const cached = memo.get(id);
        if (cached)
            return cached;
        const p = byId.get(id), kids = kidsOf(id).length > 0, extraW = chip(id), chrome = nodeChrome(kids, extraW);
        // The extra line under a name: the state when there is one, else the parent beside a name that repeats in the project.
        const extra = p.status !== 'plan' || !!p.reading?.state || (names.get(p.name) ?? 0) > 1 ? 1 : 0;
        let m;
        if (open(id, depth)) {
            const { sizes, at } = anchors(id, depth + 1);
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const [k, q] of at) {
                const s = sizes.get(k);
                minX = Math.min(minX, q.x + s.ox);
                minY = Math.min(minY, q.y + s.oy);
                maxX = Math.max(maxX, q.x + s.ox + s.w);
                maxY = Math.max(maxY, q.y + s.oy + s.h);
            }
            const { w, head } = (depth === 0 ? regionHead : groupHead)(id, Math.max(maxX - minX + PAD * 2, FRAME_MIN_W));
            m = { ox: minX, oy: minY, w, h: maxY - minY + head + PAD, head };
        }
        else if (listOf(container)) {
            // Planned lines keep the item's own padding (7 above and below), for one line as for two.
            // A list item's own sides (styles.css .node.item: 10 + 8 padding, 1 + 1 border) are narrower than a row's: its name's
            // room is measured with them, so a name that fits on one line is not given a second, empty one.
            const w = nodeWidth(p.name, kids, measureText, extraW), room = w - (kids ? chrome : ITEM_SIDES), nl = lines(p.name, 'item', room, 3), pl = nodeLines(id, room);
            m = { w, h: Math.max(14 + (nl + extra) * 17, pl ? 14 + nl * 17 + 2 + pl * PLAN_LINE : 0), ox: 0, oy: 0, head: 0, face: 'item' };
        }
        else if (depth === 0) {
            // A folded group reads by its name and count; its note is the selection's. A part without an inside keeps its sentence.
            const note = kids ? '' : mapLead(v, id), need = measureText(p.name, 'head') * 1.1 + 6;
            let w = note ? UNIT_W : NODE_W;
            // A folded group's name keeps one line when a card up to NODE_MAX_W holds it beside its count and the way in.
            if (kids && need > w - chrome && need <= NODE_MAX_W - chrome)
                w = Math.ceil(need) + chrome;
            if (need > (w - chrome) * 2)
                w = Math.min(NODE_MAX_W + 40, Math.ceil(need / 2) + chrome);
            // Lines break between words: a name on two lines keeps its longest word whole ('JSContext.eval', never 'JSContext.eva|l').
            const word = Math.max(0, ...p.name.split(/\s+/).map(x => measureText(x, 'head') * 1.1));
            if (need > w - chrome && word > w - chrome)
                w = Math.min(NODE_MAX_W + 40, Math.max(w, Math.ceil(word) + chrome + 4));
            const nl = need > w - chrome ? (need > (w - chrome) * 2 ? 3 : 2) : 1, ll = lines(note, 'note', w - chrome), pl = nodeLines(id, w - chrome);
            m = { w, h: Math.max(NODE_H, 24 + nl * 20 + (ll ? 2 + ll * 17 : 0) + extra * 19, pl ? 24 + nl * 20 + 3 + pl * PLAN_LINE : 0), ox: 0, oy: 0, head: 0, face: 'unit' };
        }
        else {
            // Planned lines keep the row's own padding (10 above and below): this row only, for one line as for two.
            const w = nodeWidth(p.name, kids, measureText, extraW), nl = lines(p.name, 'node', w - chrome, 3), pl = nodeLines(id, w - chrome);
            m = { w, h: Math.max(20 + (nl + extra) * 18, pl ? 20 + nl * 18 + 2 + pl * PLAN_LINE : 0), ox: 0, oy: 0, head: 0, face: 'row' };
        }
        memo.set(id, m);
        return m;
    }
    const boxes = new Map();
    const place = (id, anchor, rel, depth, container) => {
        const m = measure(id, depth, container), kids = kidsOf(id).length, isOpen = open(id, depth);
        boxes.set(id, { id, x: anchor.x + m.ox, y: anchor.y + m.oy, w: m.w, h: m.h, kind: isOpen ? 'frame' : 'node', depth, container: container ?? ROOT, kids, rel, head: m.head,
            ...(isOpen ? { list: listOf(id) } : { face: m.face ?? 'row' }) });
        if (!isOpen)
            return;
        const { at } = anchors(id, depth + 1);
        // One column of rows fills the group's width, so a region widened for its name or note keeps an even edge.
        const single = !listOf(id) && new Set([...at.values()].map(q => q.x)).size === 1;
        for (const [k, p] of at) {
            place(k, { x: anchor.x + PAD + p.x, y: anchor.y + m.head + p.y }, p, depth + 1, id);
            const kb = boxes.get(k);
            if (single && kb.kind === 'node')
                kb.w = Math.max(kb.w, m.w - PAD * 2);
        }
    };
    const top = anchors(scope, 0);
    for (const [k, p] of top.at)
        place(k, p, p, 0, scope);
    // Visible representative of any part: itself or its nearest visible ancestor; null when outside this scope.
    const rep = (id) => { let cur = byId.get(id), guard = 0; while (cur && guard++ < 64) {
        if (boxes.has(cur.id))
            return cur.id;
        cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    } return null; };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const b of boxes.values()) {
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.w);
        maxY = Math.max(maxY, b.y + b.h);
    }
    if (!boxes.size) {
        minX = minY = 0;
        maxX = maxY = 0;
    }
    // Relations: drawn between representatives; a partner outside the scope is a small ghost at the side (incoming left, outgoing right).
    const edges = new Map(), ghostsIn = [], ghostsOut = [];
    for (const r of v.relations) {
        let a = rep(r.from), b = rep(r.to);
        if (!a && !b)
            continue;
        if (!a) {
            a = ghostId(r.from);
            if (!ghostsIn.includes(r.from))
                ghostsIn.push(r.from);
        }
        if (!b) {
            b = ghostId(r.to);
            if (!ghostsOut.includes(r.to))
                ghostsOut.push(r.to);
        }
        if (a === b)
            continue;
        const key = `${a}|${b}|${r.kind}`, e = edges.get(key) ?? { key, from: a, to: b, kind: r.kind, notes: [], ids: [], agg: false };
        if (r.note)
            e.notes.push(r.note);
        e.ids.push(r.id);
        if ((a !== r.from && a !== ghostId(r.from)) || (b !== r.to && b !== ghostId(r.to)))
            e.agg = true;
        edges.set(key, e);
    }
    // A partner outside the scope reads by its own name under where it belongs, and sits next to the parts it actually meets, on
    // the free side nearest to them (outgoing to the right first, incoming to the left first). Placing it never moves a part;
    // without a free lane beside them it keeps the scope's edge as before.
    const size = new Map(ghostsIn.concat(ghostsOut).map(id => [id, ghostSize(byId.get(id)?.name ?? '', measureText)]));
    const heads = [];
    const placeEnds = (list, out, fallbackX) => {
        if (!list.length)
            return;
        // Partners that belong to the same place run together under one head, in the order the place first appears.
        // The scope itself (the end of a relation between it and one of its own parts) is this scope's boundary, not a part outside
        // it: it reads as '이 범위', in a run of its own. Decided by id: another part with the same name stays outside.
        const where = new Map(list.map(id => [id, id === scope ? SELF_HEAD : `밖 · ${ghostContext(v, scope, id) || '최상위'}`])), runs = [...new Set(where.values())];
        const ids = runs.flatMap(t => list.filter(id => where.get(id) === t));
        const near = [...new Set([...edges.values()].filter(e => ids.some(g => (out ? e.to : e.from) === ghostId(g))).map(e => (out ? e.from : e.to)))].map(id => boxes.get(id)).filter((b) => !!b);
        const colW = Math.max(...ids.map(id => size.get(id).w), ...runs.map(t => Math.min(GHOST_MAX_W, Math.ceil(headNeed(t, measureText)))));
        const headH = new Map(runs.map(t => [t, headSize(t, colW, measureText)]));
        const colH = ids.reduce((a, id) => a + size.get(id).h + GHOST_GAP, 0) - GHOST_GAP + runs.reduce((a, t) => a + headH.get(t), 0) + RUN_GAP * (runs.length - 1);
        const cy = near.length ? (Math.min(...near.map(b => b.y)) + Math.max(...near.map(b => b.y + Math.min(b.h, 120)))) / 2 : minY + colH / 2;
        const y = Math.max(minY, cy - colH / 2), all = [...boxes.values()];
        const free = (x) => all.every(b => b.x > x + colW + 24 || b.x + b.w < x - 24 || b.y > y + colH + 12 || b.y + b.h < y - 12);
        const right = near.length ? Math.max(...near.map(b => b.x + b.w)) + 90 : NaN, left = near.length ? Math.min(...near.map(b => b.x)) - 90 - colW : NaN;
        const found = (out ? [right, left] : [left, right]).find(x => Number.isFinite(x) && free(x));
        const x = found ?? fallbackX - (out ? 0 : colW), leftOf = near.length > 0 && x < near[0].x;
        let at = found === undefined ? minY : y;
        for (const t of runs) {
            heads.push({ key: `${out ? 'out' : 'in'}|${t}`, x, y: at, w: colW, h: headH.get(t), text: t });
            at += headH.get(t);
            for (const id of ids.filter(i => where.get(i) === t)) {
                const { w, h } = size.get(id); // a column left of its parts keeps its lines' ends even
                boxes.set(ghostId(id), { id: ghostId(id), x: leftOf ? x + colW - w : x, y: at, w, h, kind: 'ghost', depth: 0, container: '', kids: 0, rel: { x: 0, y: 0 }, head: 0 });
                at += h + GHOST_GAP;
            }
            at += RUN_GAP - GHOST_GAP;
        }
    };
    placeEnds(ghostsIn.filter(id => !ghostsOut.includes(id)), false, minX - 90);
    placeEnds(ghostsOut, true, maxX + 90);
    let bx = Infinity, by = Infinity, bx2 = -Infinity, by2 = -Infinity;
    for (const b of [...boxes.values(), ...heads]) {
        bx = Math.min(bx, b.x);
        by = Math.min(by, b.y);
        bx2 = Math.max(bx2, b.x + b.w);
        by2 = Math.max(by2, b.y + b.h);
    }
    if (!boxes.size) {
        bx = by = bx2 = by2 = 0;
    }
    return { boxes, edges: [...edges.values()], heads, bounds: { x: bx, y: by, w: bx2 - bx, h: by2 - by } };
}
/** Rounded orthogonal path through points (corners of radius up to r). */
function rounded(pts, r = 8) {
    const p = pts.filter((q, i) => i === 0 || Math.abs(q.x - pts[i - 1].x) + Math.abs(q.y - pts[i - 1].y) > 0.5);
    let d = `M${p[0].x},${p[0].y}`;
    for (let i = 1; i < p.length - 1; i++) {
        const A = p[i - 1], B = p[i], C = p[i + 1];
        const r1 = Math.min(r, Math.hypot(B.x - A.x, B.y - A.y) / 2, Math.hypot(C.x - B.x, C.y - B.y) / 2);
        const u = (P, Q) => { const l = Math.hypot(Q.x - P.x, Q.y - P.y) || 1; return { x: (Q.x - P.x) / l, y: (Q.y - P.y) / l }; };
        const ua = u(B, A), uc = u(B, C);
        d += ` L${B.x + ua.x * r1},${B.y + ua.y * r1} Q${B.x},${B.y} ${B.x + uc.x * r1},${B.y + uc.y * r1}`;
    }
    const last = p[p.length - 1];
    return `${d} L${last.x},${last.y}`;
}
/** Edge path between two boxes. A group end meets the group at its head row (the group's port), never beside an inner part.
 * The usual soft curve is kept when it crosses nothing; when it would pass under an unrelated part or group, the line takes an
 * outside corridor through the gaps (out from the side, along a free row gap, into the other side).
 * Frames are obstacles like parts, except the frames around either end (the line has to reach inside them, but not across their
 * heads) and the inside of a frame end. A corridor keeps LANE_CLEAR from every obstacle, so the hairline between two stacked
 * rows is not a lane. clear: the path crosses no obstacle (a fallback curve that has to cross one is not clear). */
export const LANE_CLEAR = 3;
export function edgePath(a, b, others = []) {
    const all = [...others], byId = new Map(all.map(o => [o.id, o]));
    const within = (o, f) => { for (let c = o.container, g = 0; c && g < 64; c = byId.get(c)?.container ?? '', g++)
        if (c === f.id)
            return true; return false; };
    const blocks = all.filter(o => o !== a && o !== b && !(o.kind === 'frame' && (within(a, o) || within(b, o))) && !(a.kind === 'frame' && within(o, a)) && !(b.kind === 'frame' && within(o, b)));
    for (const o of all)
        if (o.kind === 'frame' && o !== a && o !== b && o.head > 0 && (within(a, o) || within(b, o)))
            blocks.push({ x: o.x, y: o.y, w: o.w, h: o.head });
    const inside = (x, y) => blocks.some(o => x > o.x + 1 && x < o.x + o.w - 1 && y > o.y + 1 && y < o.y + o.h - 1);
    const segFree = (x1, y1, x2, y2, m = LANE_CLEAR) => !blocks.some(o => Math.max(x1, x2) > o.x - m && Math.min(x1, x2) < o.x + o.w + m && Math.max(y1, y2) > o.y - m && Math.min(y1, y2) < o.y + o.h + m);
    const free = (pts) => pts.every((p, i) => !i || segFree(pts[i - 1].x, pts[i - 1].y, p.x, p.y, -1));
    const portY = (x) => (x.kind === 'frame' ? x.y + x.head / 2 : x.y + x.h / 2);
    // One end holds the other (a group and a part or group inside it): the line leaves the group under its head and runs down the
    // group's own margin to the side of the inner end (its head row when it is a group), so it never crosses a head or the parts
    // between them. Reversed when the inner end is where the line starts.
    // What lies between them inside the group is in the way: every box inside it but the inner end and the groups that hold the
    // inner end, whose heads are in the way all the same. When that margin route would cross one, the line takes the gaps inside
    // the group instead (from under its head, into a side of the inner end, or a part's top or bottom).
    const outer = a.kind === 'frame' && within(b, a) ? a : b.kind === 'frame' && within(a, b) ? b : null;
    if (outer) {
        const inner = outer === a ? b : a, lx = outer.x + PAD / 2, top = outer.y + outer.head, iy = Math.max(top + 10, portY(inner));
        const holds = (o) => o.kind === 'frame' && within(inner, o), inGroup = all.filter(o => o !== outer && o !== inner && within(o, outer));
        const stop = [...inGroup.filter(o => !holds(o)), ...inGroup.filter(o => holds(o) && o.head > 0).map(o => ({ x: o.x, y: o.y, w: o.w, h: o.head }))];
        const open = (x1, y1, x2, y2, m = LANE_CLEAR) => !stop.some(o => Math.max(x1, x2) > o.x - m && Math.min(x1, x2) < o.x + o.w + m && Math.max(y1, y2) > o.y - m && Math.min(y1, y2) < o.y + o.h + m);
        const draw = (pts, mid) => ({ d: rounded(outer === a ? pts : [...pts].reverse(), 6), mx: mid.x, my: mid.y, detour: true, clear: true });
        const lane = [{ x: lx, y: top }, { x: lx, y: iy }, { x: inner.x, y: iy }];
        if (lane.every((p, i) => !i || open(lane[i - 1].x, lane[i - 1].y, p.x, p.y, -1)))
            return draw(lane, { x: lx, y: (top + iy) / 2 });
        const LEAD = 12, starts = new Set([lx, outer.x + outer.w - PAD / 2, inner.x + inner.w / 2, inner.x - PAD / 2, inner.x + inner.w + PAD / 2]);
        const from = [...starts].filter(x => x > outer.x && x < outer.x + outer.w).map(x => ({ at: { x, y: top }, lead: { x, y: top + LEAD }, cost: 0 }));
        const icx = inner.x + inner.w / 2, to = [{ at: { x: inner.x, y: iy }, lead: { x: inner.x - LEAD, y: iy }, cost: 0 }, { at: { x: inner.x + inner.w, y: iy }, lead: { x: inner.x + inner.w + LEAD, y: iy }, cost: 0 },
            ...(inner.kind === 'frame' ? [] : [{ at: { x: icx, y: inner.y }, lead: { x: icx, y: inner.y - LEAD }, cost: 0 }, { at: { x: icx, y: inner.y + inner.h }, lead: { x: icx, y: inner.y + inner.h + LEAD }, cost: 0 }])];
        const seg = (x1, y1, x2, y2) => open(x1, y1, x2, y2);
        const r = searchRoute(from.filter(p => seg(p.at.x, p.at.y + 1, p.lead.x, p.lead.y)), to.filter(p => seg(p.at.x + Math.sign(p.lead.x - p.at.x), p.at.y + Math.sign(p.lead.y - p.at.y), p.lead.x, p.lead.y)), stop, seg, { x0: outer.x + 2, x1: outer.x + outer.w - 2, y0: top, y1: outer.y + outer.h - 2 }, true);
        if (r)
            return draw(r.pts, r.mid);
        // No free way inside the group: the margin route, said to cross (never claimed clear).
        return { ...draw(lane, { x: lx, y: (top + iy) / 2 }), clear: false };
    }
    const acx = a.x + a.w / 2, bcx = b.x + b.w / 2, acy = portY(a), bcy = portY(b);
    const overlapX = a.x < b.x + b.w && b.x < a.x + a.w;
    if (overlapX) {
        const down = b.y + b.h / 2 > a.y + a.h / 2, y1 = down ? a.y + a.h : a.y, y2 = down ? b.y : b.y + b.h;
        const x1 = Math.max(a.x, b.x) + (Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) / 2, k = Math.max(24, Math.abs(y2 - y1) / 2) * (down ? 1 : -1);
        if (segFree(x1, y1, x1, y2, -1))
            return { d: `M${x1},${y1} C${x1},${y1 + k} ${x1},${y2 - k} ${x1},${y2}`, mx: x1, my: (y1 + y2) / 2, clear: true };
        // A part between them in the same column would read as an end: go round the right side instead.
        const ax = a.x + a.w, bx = b.x + b.w, xs = Math.max(ax, bx) + 14, pts = [{ x: ax, y: acy }, { x: xs, y: acy }, { x: xs, y: bcy }, { x: bx, y: bcy }];
        return { d: rounded(pts), mx: xs, my: (acy + bcy) / 2, detour: true, clear: free(pts) };
    }
    const right = bcx > acx, dir = right ? 1 : -1, x1 = right ? a.x + a.w : a.x, x2 = right ? b.x : b.x + b.w;
    const k = Math.max(40, Math.abs(x2 - x1) / 2) * dir;
    const curve = { d: `M${x1},${acy} C${x1 + k},${acy} ${x2 - k},${bcy} ${x2},${bcy}`, mx: (x1 + x2) / 2, my: (acy + bcy) / 2, clear: false };
    const at = (t) => { const u = 1 - t; return { x: u * u * u * x1 + 3 * u * u * t * (x1 + k) + 3 * u * t * t * (x2 - k) + t * t * t * x2, y: u * u * u * acy + 3 * u * u * t * acy + 3 * u * t * t * bcy + t * t * t * bcy }; };
    let crosses = false;
    for (let i = 1; i < 24 && !crosses; i++) {
        const q = at(i / 24);
        crosses = inside(q.x, q.y);
    }
    if (!crosses)
        return { ...curve, clear: true };
    // Half of the free gap beside an end (at most 14px): where the line turns.
    const room = (x, y, d) => Math.min(28, ...blocks.filter(o => y >= o.y && y <= o.y + o.h && (d > 0 ? o.x >= x : o.x + o.w <= x)).map(o => (d > 0 ? o.x - x : x - (o.x + o.w)))) / 2;
    const xa = x1 + dir * room(x1, acy, dir), xb = x2 - dir * room(x2, bcy, -dir);
    // Past the one-corridor routes, the line goes through the gaps with more turns, or into a part from above or below.
    const around = () => { const r = gapRoute(a, b, dir, blocks, segFree); return r ? { d: rounded(r.pts), mx: r.mid.x, my: r.mid.y, detour: true, clear: true } : curve; };
    if ((xb - xa) * dir <= 0)
        return around();
    const lo = Math.min(xa, xb), hi = Math.max(xa, xb);
    const ys = [acy, bcy, ...blocks.filter(o => o.x < hi && lo < o.x + o.w).flatMap(o => [o.y - 6, o.y + o.h + 6])]
        .sort((p, q) => Math.abs(p - acy) + Math.abs(p - bcy) - (Math.abs(q - acy) + Math.abs(q - bcy)));
    for (const yc of ys) {
        if (!segFree(xa, acy, xa, yc) || !segFree(xa, yc, xb, yc) || !segFree(xb, yc, xb, bcy))
            continue;
        return { d: rounded([{ x: x1, y: acy }, { x: xa, y: acy }, { x: xa, y: yc }, { x: xb, y: yc }, { x: xb, y: bcy }, { x: x2, y: bcy }]), mx: (xa + xb) / 2, my: yc, detour: true, clear: true };
    }
    return around();
}
/** The last route before a curve that would cross: an orthogonal path through the gaps near both ends (fewest turns, then
 * shortest), kept LANE_CLEAR from every obstacle. It leaves a by the side facing b (or, failing that, its top or bottom) and
 * meets b on the side facing a, or on its top or bottom when that side is shut in; a group end only at its head row, as
 * everywhere. Only boxes near the two ends are searched; null when no such path is found, and the crossing curve stays. */
function gapRoute(a, b, dir, blocks, segFree) {
    const LEAD = 12, SIDE = 0, END = 34;
    const ports = (x, face) => {
        const cy = x.kind === 'frame' ? x.y + x.head / 2 : x.y + x.h / 2, cx = x.x + x.w / 2, sx = face > 0 ? x.x + x.w : x.x;
        const out = [{ at: { x: sx, y: cy }, lead: { x: sx + face * LEAD, y: cy }, cost: SIDE }];
        if (x.kind !== 'frame')
            out.push({ at: { x: cx, y: x.y + x.h }, lead: { x: cx, y: x.y + x.h + LEAD }, cost: END }, { at: { x: cx, y: x.y }, lead: { x: cx, y: x.y - LEAD }, cost: END });
        return out.filter(p => segFree(p.at.x + (p.lead.x - p.at.x) / LEAD, p.at.y + (p.lead.y - p.at.y) / LEAD, p.lead.x, p.lead.y));
    };
    const from = ports(a, dir), to = ports(b, -dir);
    if (!from.length || !to.length)
        return null;
    const x0 = Math.min(a.x, b.x) - 160, x1 = Math.max(a.x + a.w, b.x + b.w) + 160, y0 = Math.min(a.y, b.y) - 160, y1 = Math.max(a.y + a.h, b.y + b.h) + 160;
    return searchRoute(from, to, blocks, segFree, { x0, x1, y0, y1 });
}
/** The search behind gapRoute: an orthogonal path from one of the from ports to one of the to ports through the lanes between
 * the blocks near the bounds (fewest turns, then shortest), every step tested with segFree. null when none is found. clip: no
 * lane past the bounds (a line kept inside its group); gapRoute's lanes are never clipped (a lane just past its search edge
 * may be the free way round). */
function searchRoute(from, to, blocks, segFree, bounds, clip = false) {
    const { x0, x1, y0, y1 } = bounds;
    const near = blocks.filter(o => o.x < x1 && x0 < o.x + o.w && o.y < y1 && y0 < o.y + o.h);
    // Lanes: just outside each nearby box, the middle of every gap between box edges, the ports' own lines and the search edge
    // (past the search edge only when not clipped).
    const lanes = (edges, extra, lo, hi) => {
        const e = [...new Set(edges)].sort((p, q) => p - q), out = new Set(extra), half = (v) => Math.round(v * 2) / 2;
        for (let i = 0; i < e.length; i++) {
            out.add(e[i] - 8);
            out.add(e[i] + 8);
            if (i)
                out.add((e[i - 1] + e[i]) / 2);
        }
        return [...new Set([...out].map(half))].filter(v => !clip || (v >= lo && v <= hi)).sort((p, q) => p - q);
    };
    const xs = lanes(near.flatMap(o => [o.x, o.x + o.w]), [x0, x1, ...from.map(p => p.lead.x), ...to.map(p => p.lead.x)], x0, x1);
    const ys = lanes(near.flatMap(o => [o.y, o.y + o.h]), [y0, y1, ...from.map(p => p.lead.y), ...to.map(p => p.lead.y)], y0, y1);
    const X = xs.length, Y = ys.length, N = X * Y, ix = new Map(xs.map((v, i) => [v, i])), iy = new Map(ys.map((v, i) => [v, i]));
    const key = (p) => { const i = ix.get(Math.round(p.x * 2) / 2), j = iy.get(Math.round(p.y * 2) / 2); return i === undefined || j === undefined ? -1 : j * X + i; };
    // Free steps between neighbouring lane crossings (right: 0, down: 1), each tested once.
    const step = new Uint8Array(N * 2);
    for (let j = 0; j < Y; j++)
        for (let i = 0; i < X; i++) {
            if (i + 1 < X && segFree(xs[i], ys[j], xs[i + 1], ys[j]))
                step[(j * X + i) * 2] = 1;
            if (j + 1 < Y && segFree(xs[i], ys[j], xs[i], ys[j + 1]))
                step[(j * X + i) * 2 + 1] = 1;
        }
    // Dijkstra over (crossing, heading); a turn costs as much as a long run, so the fewest-turn path wins and then the shortest.
    const TURN = 400, dist = new Float64Array(N * 4).fill(Infinity), prev = new Int32Array(N * 4).fill(-1), heap = [];
    const push = (d, s) => { heap.push([d, s]); for (let c = heap.length - 1; c > 0;) {
        const q = (c - 1) >> 1;
        if (heap[q][0] <= heap[c][0])
            break;
        [heap[q], heap[c]] = [heap[c], heap[q]];
        c = q;
    } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) {
        heap[0] = last;
        for (let c = 0;;) {
            const l = 2 * c + 1, r = l + 1;
            let m = c;
            if (l < heap.length && heap[l][0] < heap[m][0])
                m = l;
            if (r < heap.length && heap[r][0] < heap[m][0])
                m = r;
            if (m === c)
                break;
            [heap[m], heap[c]] = [heap[c], heap[m]];
            c = m;
        }
    } return top; };
    const heading = (p) => (p.lead.x > p.at.x ? 0 : p.lead.x < p.at.x ? 2 : p.lead.y > p.at.y ? 1 : 3); // 0 right, 1 down, 2 left, 3 up
    for (const p of from) {
        const k = key(p.lead);
        if (k >= 0) {
            const s = k * 4 + heading(p);
            if (p.cost < dist[s]) {
                dist[s] = p.cost;
                push(p.cost, s);
            }
        }
    }
    const goal = new Map();
    for (const p of to) {
        const k = key(p.lead);
        if (k >= 0)
            goal.set(k, p);
    }
    let best = Infinity, bestState = -1, bestPort = null;
    while (heap.length) {
        const [d, s] = pop();
        if (d > dist[s] || d >= best)
            continue;
        const k = s >> 2, hd = s & 3, i = k % X, j = (k - i) / X, g = goal.get(k);
        if (g) {
            const into = (g.at.x > g.lead.x ? 0 : g.at.x < g.lead.x ? 2 : g.at.y > g.lead.y ? 1 : 3), c = d + g.cost + (into === hd ? 0 : TURN);
            if (c < best) {
                best = c;
                bestState = s;
                bestPort = g;
            }
        }
        const moves = [[0, k + 1, i + 1 < X && !!step[k * 2]], [1, k + X, j + 1 < Y && !!step[k * 2 + 1]], [2, k - 1, i > 0 && !!step[(k - 1) * 2]], [3, k - X, j > 0 && !!step[(k - X) * 2 + 1]]];
        for (const [h, n, ok] of moves) {
            if (!ok || (h + 2) % 4 === hd)
                continue;
            const len = Math.abs(xs[n % X] - xs[i]) + Math.abs(ys[(n - (n % X)) / X] - ys[j]), nd = d + len + (h === hd ? 0 : TURN), ns = n * 4 + h;
            if (nd < dist[ns]) {
                dist[ns] = nd;
                prev[ns] = s;
                push(nd, ns);
            }
        }
    }
    if (bestState < 0 || !bestPort)
        return null;
    const mids = [];
    for (let s = bestState; s >= 0; s = prev[s]) {
        const k = s >> 2, i = k % X;
        mids.push({ x: xs[i], y: ys[(k - i) / X] });
    }
    mids.reverse();
    const start = from.find(p => key(p.lead) === key(mids[0]));
    // Only the corners: points on a straight run between two others are dropped.
    const raw = [start.at, ...mids, bestPort.at], pts = raw.filter((q, n) => n === 0 || n === raw.length - 1 || !((raw[n - 1].x === q.x && q.x === raw[n + 1].x) || (raw[n - 1].y === q.y && q.y === raw[n + 1].y)));
    const m = Math.floor((pts.length - 1) / 2), mid = { x: (pts[m].x + pts[m + 1].x) / 2, y: (pts[m].y + pts[m + 1].y) / 2 };
    return { pts, mid };
}
/** The overview of a busy map at rest: each relation drawn once between the outermost drawn boxes that hold its ends below the
 * group they share (two groups side by side, a group and an outside partner), merged by kind. Ids and notes are the relations'
 * own; a line that stands for relations of inner parts is agg, as a folded group's line is. */
export function summaryEdges(boxes, edges) {
    const chain = (id) => { const out = [id]; for (let c = boxes.get(id)?.container, g = 0; c && boxes.has(c) && g < 64; c = boxes.get(c).container, g++)
        out.push(c); return out; };
    const out = new Map();
    for (const e of edges) {
        const ca = chain(e.from), cb = chain(e.to), sb = new Set(cb), common = ca.find(x => sb.has(x));
        // One end holds the other (a group and a part inside it): drawn as it is.
        const a = common === e.from || common === e.to ? e.from : common ? ca[ca.indexOf(common) - 1] : ca.at(-1);
        const b = common === e.from || common === e.to ? e.to : common ? cb[cb.indexOf(common) - 1] : cb.at(-1);
        const key = `sum:${a}|${b}|${e.kind}`, s = out.get(key) ?? { key, from: a, to: b, kind: e.kind, notes: [], ids: [], agg: false };
        s.notes.push(...e.notes);
        s.ids.push(...e.ids);
        s.agg ||= e.agg || a !== e.from || b !== e.to;
        out.set(key, s);
    }
    return [...out.values()];
}
/** The summary beside a selection: the same lines over the relations that are not drawn one by one (own: the selection's), each
 * holding only those. Every relation reads once, on its own line or in one summary; a line left with none is not returned. */
export function restSummary(boxes, edges, own) {
    return summaryEdges(boxes, edges.filter(e => !own(e)));
}
/** Verbs that would touch (one box grown by pad): the one nearer its own end keeps its place, the other takes its next free
 * place (spots may hold several per key, nearest first wins) or, with none left, is left off the map. */
export function resolveLabels(spots, pad = 6) {
    const kept = [], done = new Set();
    for (const s of [...spots].sort((p, q) => p.dist - q.dist)) {
        if (done.has(s.key) || kept.some(k => s.x - pad < k.x + k.w && k.x < s.x + s.w + pad && s.y - pad < k.y + k.h && k.y < s.y + s.h + pad))
            continue;
        kept.push(s);
        done.add(s.key);
    }
    return { kept, dropped: [...new Set(spots.map(s => s.key))].filter(k => !done.has(k)) };
}
