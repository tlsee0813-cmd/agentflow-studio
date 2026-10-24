export const NODE_W = 188, NODE_H = 56, PAD = 14, HEAD = 36, GAP = 14, COL_GAP = 100, ROW_GAP = 36;
export function layoutMap(v) {
    const byId = new Map(v.parts.map(p => [p.id, p]));
    const sizes = new Map();
    const cols = (n) => n <= 4 ? 1 : n <= 8 ? 2 : 3;
    const chunk = (ids) => {
        const c = cols(ids.length), per = Math.ceil(ids.length / c), out = [];
        for (let i = 0; i < ids.length; i += per)
            out.push(ids.slice(i, i + per));
        return out;
    };
    const size = (id, depth = 0) => {
        const cached = sizes.get(id);
        if (cached)
            return cached;
        const kids = byId.get(id)?.childIds ?? [];
        let s;
        if (!kids.length || depth > 30)
            s = { w: NODE_W, h: NODE_H };
        else {
            const columns = chunk(kids).map(c => c.map(k => size(k, depth + 1)));
            const w = columns.reduce((a, c) => a + Math.max(...c.map(x => x.w)), 0) + GAP * (columns.length - 1);
            const h = Math.max(...columns.map(c => c.reduce((a, x) => a + x.h, 0) + GAP * (c.length - 1)));
            s = { w: Math.max(w + PAD * 2, NODE_W + PAD * 2), h: h + HEAD + PAD };
        }
        sizes.set(id, s);
        return s;
    };
    // Root order: longest-path layers over relations lifted to their roots.
    const rootOf = (id) => { let cur = byId.get(id), guard = 0; while (cur?.parentId && guard++ < 64)
        cur = byId.get(cur.parentId); return cur?.id ?? id; };
    const roots = v.roots, out = new Map(roots.map(r => [r, new Set()]));
    const reaches = (a, b) => {
        const seen = new Set(), st = [a];
        while (st.length) {
            const x = st.pop();
            if (x === b)
                return true;
            if (seen.has(x))
                continue;
            seen.add(x);
            st.push(...(out.get(x) ?? []));
        }
        return false;
    };
    for (const r of v.relations) {
        const a = rootOf(r.from), b = rootOf(r.to);
        if (a !== b && out.has(a) && out.has(b) && !reaches(b, a))
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
    roots.forEach(r => depthOf(r));
    const columns = [];
    for (const r of roots)
        (columns[layer.get(r)] ??= []).push(r);
    const used = columns.filter(Boolean);
    const heights = used.map(c => c.reduce((a, id) => a + size(id).h, 0) + ROW_GAP * (c.length - 1));
    const tallest = Math.max(0, ...heights);
    const boxes = new Map();
    const place = (id, x, y, depth = 0) => {
        const s = size(id), kids = byId.get(id)?.childIds ?? [];
        boxes.set(id, { id, x, y, w: s.w, h: s.h, group: kids.length > 0 && depth <= 30 });
        if (!kids.length || depth > 30)
            return;
        let cx = x + PAD;
        for (const c of chunk(kids)) {
            let cy = y + HEAD;
            const w = Math.max(...c.map(k => size(k).w));
            for (const k of c) {
                place(k, cx, cy, depth + 1);
                cy += size(k).h + GAP;
            }
            cx += w + GAP;
        }
    };
    let x = 0;
    used.forEach((c, i) => {
        const w = Math.max(...c.map(id => size(id).w));
        let y = (tallest - heights[i]) / 2;
        for (const id of c) {
            const s = size(id);
            place(id, x + (w - s.w) / 2, y);
            y += s.h + ROW_GAP;
        }
        x += w + COL_GAP;
    });
    return { boxes, width: Math.max(0, x - COL_GAP), height: tallest };
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
