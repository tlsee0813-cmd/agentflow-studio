/** A short chip label that never ends inside a surrogate pair; the passage itself opens whole and exact. */
const short = (t, n = 40) => { if (t.length <= n)
    return `“${t}”`; const c = t.charCodeAt(n - 1); return `“${t.slice(0, c >= 0xd800 && c <= 0xdbff ? n - 1 : n)}…”`; };
export function roleEvidence(part, u) {
    if (!u.role || u.corrected || !u.roleBasis.length)
        return null;
    // The key names the passage where it stands (part, position in the basis, record, place), so the way back focuses this very one.
    const items = u.roleBasis.map((q, i) => ({ key: JSON.stringify(['role', part, i, q.record, q.from ?? null, q.to ?? null]), quote: q, label: short(q.quote) }));
    return { count: items.length, items };
}
