/* v13 (spec 2): the selection light. A picked card, the parts its recorded relations reach and those relations stay in the light; the
 * rest of the map recedes: cards lose half their colour (their words keep a 4.5:1 contrast: styles, 「v13 light」), and the lines the map
 * showed at rest stay where they were at a quarter of their strength, so the picture one picked from is still there, quieter. Hover
 * previews the same at half strength; a lens recolours the cards the same way; every change eases over LIGHT_MS.
 * The receded lines are a drawn copy (.lt-ghosts: no .edge, nothing to hover, aria-hidden), never the lines themselves: the map's own lines
 * beside a picked card stay as v12 drew them (its direct relations alone, counted in the top line), so labels, marks and chips are placed
 * exactly as before. Nothing here moves a card or a line. */

export const LIGHT_MS = 180;
/** The receded lines' strength (a quarter of what they had at rest). */
export const GHOST_OPACITY = 0.25;

/** The receded copy: the keys shown at rest (the snapshot taken as the pick began, else every single line the map draws), less those lit. */
export function ghostKeys(rest: readonly string[] | null, all: readonly string[], lit: ReadonlySet<string>): string[] {
  return (rest ?? all.filter(k => !k.startsWith('sum:'))).filter(k => !lit.has(k));
}
/** A computed length in map units as a multiple of one screen pixel (--u), so a copy keeps its screen width at any zoom. */
export const perU = (px: number, u: number): number => (u > 0 ? Math.round((px / u) * 100) / 100 : px);
/** A computed dash list ('none' or 「4px, 3px」) in multiples of one screen pixel. */
export function dashPerU(dash: string, u: number): string {
  if (!dash || dash === 'none') return 'none';
  return dash.split(/[\s,]+/).filter(Boolean).map(d => `calc(${perU(parseFloat(d), u)} * var(--u) * 1px)`).join(' ');
}

/** The light's state on the page: the rest picture (keys of the lines seen at rest, taken when a pick begins from rest). */
export function createLight() {
  let rest: string[] | null = null, picked = false, lastMe: string | null = null, easing = 0;
  const shownKeys = (world: Element) => [...world.querySelectorAll<SVGGElement>('.edge')].filter(g => !g.classList.contains('stub') && !g.classList.contains('hit') && getComputedStyle(g).display !== 'none').map(g => g.dataset.key!).filter(Boolean);
  const clear = (world: Element) => world.querySelectorAll('.lt-ghosts').forEach(el => el.remove());
  return {
    /** Before a pick is marked (markSelection): from rest, the lines seen now are the rest picture. */
    before(world: Element, me: string | null) { if (me && !picked) rest = shownKeys(world); if (!me) rest = null; },
    /** After it is marked: the receded copy of the rest picture (none without a pick, or when the map's own lines are all still drawn). */
    after(world: Element, me: string | null, folded: boolean) {
      clear(world);
      const sp = world.closest('.space'), from = !picked && !!me, moved = !!me && me !== lastMe; picked = !!me; lastMe = me;
      sp?.classList.toggle('lt-sel', !!me);
      // The change eases in once (a pick from rest: the rest recedes; another pick: its lines come up); a redraw of the same pick does not.
      if (sp && (from || moved)) { sp.classList.toggle('lt-from', from); sp.classList.add('lt-enter'); clearTimeout(easing); easing = window.setTimeout(() => sp.classList.remove('lt-enter', 'lt-from'), LIGHT_MS + 80); }
      if (!me || !folded) return;
      const base = world.querySelector('svg.edges:not(.edges-top)'); if (!base) return;
      const gs = new Map([...world.querySelectorAll<SVGGElement>('.edge')].map(g => [g.dataset.key!, g] as [string, SVGGElement]));
      const lit = new Set([...gs.values()].filter(g => getComputedStyle(g).display !== 'none').map(g => g.dataset.key!));
      const u = parseFloat(getComputedStyle(sp ?? world).getPropertyValue('--u')) || 1;
      const layer = document.createElementNS('http://www.w3.org/2000/svg', 'g'); layer.setAttribute('class', 'lt-ghosts'); layer.setAttribute('aria-hidden', 'true');
      for (const key of ghostKeys(rest, [...gs.keys()], lit)) {
        const g = gs.get(key), line = g?.querySelector<SVGPathElement>('.edge-line'), d = line?.getAttribute('d'); if (!g || !line || !d || g.classList.contains('stub')) continue;
        const cs = getComputedStyle(line), p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        p.setAttribute('d', d);
        // Through the style object (the page's policy refuses style attributes).
        const set = (k: string, v: string) => p.style.setProperty(k, v);
        set('stroke', cs.stroke); set('stroke-width', `calc(${perU(parseFloat(cs.strokeWidth) || 1, u)} * var(--u) * 1px)`); set('stroke-dasharray', dashPerU(cs.strokeDasharray, u));
        set('stroke-linecap', cs.strokeLinecap); set('stroke-opacity', cs.strokeOpacity); set('marker-end', cs.markerEnd); set('marker-start', cs.markerStart);
        layer.append(p);
      }
      if (layer.childNodes.length) base.insertBefore(layer, base.querySelector('.edge'));
    },
  };
}
export type Light = ReturnType<typeof createLight>;
