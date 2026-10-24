/** Frames are a little wider than a node so the head keeps its name beside the fold and go-inside controls. */
export const FRAME_MIN_W = 252;
export const NODE_W = 188, NODE_H = 56, PAD = 14, HEAD = 36, GAP = 14, COL_GAP = 100, ROW_GAP = 36, GHOST_W = 168, GHOST_H = 34;
export const ROOT = 'root';
export const ghostId = (id) => `ghost:${id}`;
export function layoutScope(v, scope, expanded, pos) {
    const byId = new Map(v.parts.map(p => [p.id, p]));
    const kidsOf = (id) => (id ? byId.get(id)?.childIds ?? [] : v.roots);
    const open = (id, depth) => depth < 12 && kidsOf(id).length > 0 && expanded(id, depth);
    const memo = new Map();
    // Automatic arrangement of siblings: longest-path columns over relations lifted to the siblings; long columns wrap.
    const autoArrange = (container, sizes) => {
        const ids = kidsOf(container), set = new Set(ids);
        const lift = (id) => { let cur = byId.get(id), guard = 0; while (cur && !set.has(cur.id) && guard++ < 64)
            cur = cur.parentId ? byId.get(cur.parentId) : undefined; return cur && set.has(cur.id) ? cur.id : null; };
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
        const columns = [];
        for (const i of ids)
            (columns[layer.get(i)] ??= []).push(i);
        const cols = columns.filter(Boolean).flatMap(c => { if (c.length <= 4)
            return [c]; const per = Math.ceil(c.length / Math.ceil(c.length / 4)), o = []; for (let i = 0; i < c.length; i += per)
            o.push(c.slice(i, i + per)); return o; });
        const gapX = container === scope ? COL_GAP : GAP, gapY = container === scope ? ROW_GAP : GAP;
        const heights = cols.map(c => c.reduce((a, i) => a + sizes.get(i).h, 0) + gapY * (c.length - 1)), tallest = Math.max(0, ...heights);
        const at = new Map();
        let x = 0;
        cols.forEach((c, ci) => {
            const w = Math.max(...c.map(i => sizes.get(i).w));
            let y = container === scope ? (tallest - heights[ci]) / 2 : 0;
            for (const i of c) {
                const s = sizes.get(i);
                at.set(i, { x: x - s.ox, y: y - s.oy });
                y += s.h + gapY;
            }
            x += w + gapX;
        });
        return at;
    };
    const anchors = (container, depth) => {
        const ids = kidsOf(container), sizes = new Map(ids.map(i => [i, measure(i, depth)]));
        const auto = autoArrange(container, sizes), stored = pos[container ?? ROOT] ?? {};
        return { sizes, at: new Map(ids.map(i => [i, stored[i] ? { ...stored[i] } : auto.get(i)])) };
    };
    function measure(id, depth) {
        const cached = memo.get(id);
        if (cached)
            return cached;
        let m = { w: NODE_W, h: NODE_H, ox: 0, oy: 0 };
        if (open(id, depth)) {
            const { sizes, at } = anchors(id, depth + 1);
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const [k, p] of at) {
                const s = sizes.get(k);
                minX = Math.min(minX, p.x + s.ox);
                minY = Math.min(minY, p.y + s.oy);
                maxX = Math.max(maxX, p.x + s.ox + s.w);
                maxY = Math.max(maxY, p.y + s.oy + s.h);
            }
            m = { ox: minX, oy: minY, w: Math.max(maxX - minX + PAD * 2, FRAME_MIN_W), h: maxY - minY + HEAD + PAD };
        }
        memo.set(id, m);
        return m;
    }
    const boxes = new Map();
    const place = (id, anchor, rel, depth, container) => {
        const m = measure(id, depth), kids = kidsOf(id).length, isOpen = open(id, depth);
        boxes.set(id, { id, x: anchor.x + m.ox, y: anchor.y + m.oy, w: m.w, h: m.h, kind: isOpen ? 'frame' : 'node', depth, container, kids, rel });
        if (!isOpen)
            return;
        const { at } = anchors(id, depth + 1);
        for (const [k, p] of at)
            place(k, { x: anchor.x + PAD + p.x, y: anchor.y + HEAD + p.y }, p, depth + 1, id);
    };
    const top = anchors(scope, 0);
    for (const [k, p] of top.at)
        place(k, p, p, 0, scope ?? ROOT);
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
        const key = `${a}|${b}|${r.kind}`, e = edges.get(key) ?? { key, from: a, to: b, kind: r.kind, notes: [], ids: [] };
        if (r.note)
            e.notes.push(r.note);
        e.ids.push(r.id);
        edges.set(key, e);
    }
    const ghostColumn = (ids, x) => ids.forEach((id, i) => boxes.set(ghostId(id), { id: ghostId(id), x, y: minY + i * (GHOST_H + 12), w: GHOST_W, h: GHOST_H, kind: 'ghost', depth: 0, container: '', kids: 0, rel: { x: 0, y: 0 } }));
    ghostColumn(ghostsIn.filter(id => !ghostsOut.includes(id)), minX - GHOST_W - 90);
    ghostColumn(ghostsOut, maxX + 90);
    let bx = Infinity, by = Infinity, bx2 = -Infinity, by2 = -Infinity;
    for (const b of boxes.values()) {
        bx = Math.min(bx, b.x);
        by = Math.min(by, b.y);
        bx2 = Math.max(bx2, b.x + b.w);
        by2 = Math.max(by2, b.y + b.h);
    }
    if (!boxes.size) {
        bx = by = bx2 = by2 = 0;
    }
    return { boxes, edges: [...edges.values()], bounds: { x: bx, y: by, w: bx2 - bx, h: by2 - by } };
}
/** Edge path between two boxes: horizontal bezier between facing sides, vertical when they share a column. */
export function edgePath(a, b) {
    const acx = a.x + a.w / 2, bcx = b.x + b.w / 2, acy = a.y + a.h / 2, bcy = b.y + b.h / 2;
    const overlapX = a.x < b.x + b.w && b.x < a.x + a.w;
    if (overlapX) {
        const down = bcy > acy, y1 = down ? a.y + a.h : a.y, y2 = down ? b.y : b.y + b.h;
        const x1 = Math.max(a.x, b.x) + (Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) / 2, k = Math.max(24, Math.abs(y2 - y1) / 2) * (down ? 1 : -1);
        return { d: `M${x1},${y1} C${x1},${y1 + k} ${x1},${y2 - k} ${x1},${y2}`, mx: x1, my: (y1 + y2) / 2 };
    }
    const right = bcx > acx, x1 = right ? a.x + a.w : a.x, x2 = right ? b.x : b.x + b.w;
    const k = Math.max(40, Math.abs(x2 - x1) / 2) * (right ? 1 : -1);
    return { d: `M${x1},${acy} C${x1 + k},${acy} ${x2 - k},${bcy} ${x2},${bcy}`, mx: (x1 + x2) / 2, my: (acy + bcy) / 2 };
}
