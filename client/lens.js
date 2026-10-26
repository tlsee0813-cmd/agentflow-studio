export const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
/** A note may only occupy clear map space. Clamp candidates before checking them: clamping a rejected place afterwards
 * can put it over a title or another note. No place is also an answer; the caller then reads the note outside the map. */
export function placeCallout(target, group, size, area, blockers) {
    const { w, h } = size, gap = 10, right = area.x + area.w - w, bottom = area.y + area.h - h;
    if (right < area.x || bottom < area.y || overlap(target, area) < 1)
        return null;
    const at = (x, y) => ({ x: Math.max(area.x, Math.min(x, right)), y: Math.max(area.y, Math.min(y, bottom)), w, h });
    const distance = (r) => Math.max(target.x - r.x - w, r.x - target.x - target.w, 0) ** 2 + Math.max(target.y - r.y - h, r.y - target.y - target.h, 0) ** 2;
    const clear = (r) => distance(r) <= 160 ** 2 && blockers.every(b => overlap(r, { x: b.x - 5, y: b.y - 5, w: b.w + 10, h: b.h + 10 }) < 1);
    const around = (r) => [at(r.x + r.w + gap, target.y - 4), at(r.x - w - gap, target.y - 4), at(r.x, r.y + r.h + gap), at(r.x, r.y - h - gap)];
    for (const r of [...around(target), ...(group ? around(group) : [])])
        if (clear(r))
            return r;
    // Obstacle edges supply the remaining free lanes, nearest the target first. This also finds gaps above a long title or
    // between unrelated groups without pretending that a note is a part of the map's layout.
    // Bound the search even on dense maps. All obstacles still participate in collision checks. A remote gap does not count
    // as beside the target; that note belongs in the named reading row instead.
    const nearest = (values, center) => [...new Set(values)].sort((a, b) => Math.abs(a - center) - Math.abs(b - center)).slice(0, 24);
    const xs = nearest([area.x, right, ...blockers.flatMap(b => [Math.max(area.x, Math.min(b.x - w - gap, right)), Math.max(area.x, Math.min(b.x + b.w + gap, right))])], target.x + (target.w - w) / 2);
    const ys = nearest([area.y, bottom, ...blockers.flatMap(b => [Math.max(area.y, Math.min(b.y - h - gap, bottom)), Math.max(area.y, Math.min(b.y + b.h + gap, bottom))])], target.y + (target.h - h) / 2);
    const candidates = xs.flatMap(x => ys.map(y => at(x, y)));
    candidates.sort((a, b) => distance(a) - distance(b));
    return candidates.find(clear) ?? null;
}
const GAP = 14;
/** The least height a surface may be given beside its part before its body scrolls instead of the place being refused. */
const MIN_H = 240;
/** The docked place: the bottom of the map area, its full width. */
export const dockPlace = (h, area) => ({ x: area.x, y: area.y + area.h - h });
/** Where the surface goes after the camera moved (or the part was dragged), in the arrangement chosen for this selection. */
export function follow(place, part, beside, w, h, area) {
    if (place.side === 'dock')
        return dockPlace(h, area);
    if (place.side === 'below')
        return { x: beside.x, y: beside.y + beside.h + GAP };
    if (place.side === 'above')
        return { x: beside.x, y: beside.y - GAP - h };
    return { x: place.side === 'right' ? beside.x + beside.w + GAP : beside.x - GAP - w, y: part.y + place.dy };
}
/**
 * part: the selected part (or the parts a change touches) on screen. beside: what the surface stands next to: the group the
 * part sits in, so its own group stays readable. protect: the part, its group, the other ends of its lines and the scope's
 * title. Places are tried in order: right, then left of the group (at the part's height, under a protected head above it, or
 * at the top), then below or above the group. The whole height wins first; else the tallest clear place beside it, down to
 * MIN_H (its body scrolls). others: every other part on screen; a place that would hide one of them is not clear.
 * Otherwise the dock.
 */
export function placeLens(part, beside, protect, size, area, others = []) {
    // Clear: covers nothing protected, and hides no other part on the map whole (most of it under the surface).
    const hides = (r) => others.some(q => q.w * q.h > 0 && overlap(r, q) > q.w * q.h * 0.6);
    const bottom = area.y + area.h, clear = (r) => protect.every(q => overlap(r, q) < 1) && !hides(r);
    const inArea = (r) => r.x >= area.x - 0.5 && r.y >= area.y - 0.5 && r.x + r.w <= area.x + area.w + 0.5 && r.y + r.h <= bottom + 0.5;
    const above = protect.filter(q => q.y + q.h <= part.y + 1 && q.x < part.x + part.w && part.x < q.x + q.w).map(q => q.y + q.h + 8);
    const tops = [...new Set([part.y - 6, ...above, area.y].map(y => Math.max(area.y, Math.round(y))))];
    let best = null;
    for (const side of ['right', 'left']) {
        const x = side === 'right' ? beside.x + beside.w + GAP : beside.x - GAP - size.w;
        if (x < area.x - 0.5 || x + size.w > area.x + area.w + 0.5)
            continue;
        for (const y of tops) {
            const h = Math.min(size.h, bottom - y);
            if (h < Math.min(size.h, MIN_H) || !clear({ x, y, w: size.w, h }))
                continue;
            if (h >= size.h)
                return { side, x, y, h, dy: y - part.y };
            if (!best || h > best.h)
                best = { side, x, y, h, dy: y - part.y };
        }
    }
    if (best)
        return best;
    const x = Math.min(Math.max(beside.x, area.x), area.x + area.w - size.w);
    for (const [side, y] of [['below', beside.y + beside.h + GAP], ['above', beside.y - GAP - size.h]]) {
        const r = { x, y, w: size.w, h: size.h };
        if (inArea(r) && clear(r))
            return { side, x, y, h: size.h, dy: y - part.y };
    }
    return { side: 'dock', x: area.x, y: area.y, h: 0, dy: 0 };
}
