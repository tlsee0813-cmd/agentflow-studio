/** Program inclusion only. Task.parentTaskId is never read here. All helpers are read-only. */
export function parentArea(p, id) { const parent = p.space.containment.parents[id]; return parent ? p.space.areas.find(a => a.id === parent) ?? null : null; }
/** Includes archived children; callers decide whether they are visible. */
export function childrenOf(p, id) { return p.space.areas.filter(a => p.space.containment.parents[a.id] === id); }
/** Root -> self, with each stable Area identity exactly once. Unknown ids return an empty path. */
export function areaPath(p, id) {
    const byId = new Map(p.space.areas.map(a => [a.id, a])), seen = new Set(), out = [];
    let a = byId.get(id);
    while (a && !seen.has(a.id)) {
        seen.add(a.id);
        out.unshift(a);
        a = byId.get(p.space.containment.parents[a.id] ?? '');
    }
    return out;
}
export function descendantAreas(p, id) {
    const out = [], seen = new Set([id]), stack = [...childrenOf(p, id)].reverse();
    while (stack.length) {
        const a = stack.pop();
        if (seen.has(a.id))
            continue;
        seen.add(a.id);
        out.push(a);
        stack.push(...childrenOf(p, a.id).reverse());
    }
    return out;
}
/** Hidden descendants project to the outermost collapsed ancestor. Archived targets have no representative. */
export function visibleRepresentative(p, id, collapsed) {
    const path = areaPath(p, id);
    if (!path.length || path.some(a => a.archived))
        return null;
    return path.find(a => collapsed.has(a.id))?.id ?? id;
}
export function visibleAreas(p, collapsed) { return p.space.areas.filter(a => visibleRepresentative(p, a.id, collapsed) === a.id); }
/** A view projection only: actual endpoints, ids, kinds, notes and storage order remain in relations. */
export function bundleRelations(p, collapsed) {
    const groups = new Map();
    for (const r of p.space.relations) {
        const from = visibleRepresentative(p, r.from, collapsed), to = visibleRepresentative(p, r.to, collapsed);
        if (!from || !to)
            continue;
        const key = JSON.stringify([from, to, r.kind]);
        let b = groups.get(key);
        if (!b) {
            b = { from, to, kind: r.kind, relations: [], directIds: [], hiddenIds: [], internal: from === to };
            groups.set(key, b);
        }
        b.relations.push(r);
        (from === r.from && to === r.to ? b.directIds : b.hiddenIds).push(r.id);
    }
    return [...groups.values()];
}
