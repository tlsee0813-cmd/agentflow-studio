// 페이지 안에서 실행하는 관측 도구. window.__t 로 노출한다.
// 원칙: DOM 존재나 컨테이너 bounds만으로 '보임'을 판정하지 않는다.
//  글자 하나하나의 Range rect → 뷰포트 안 → 잘라내는 조상(overflow≠visible)의 내부 → 그 중심점 elementFromPoint가 같은 요소 안인지 본다.
(() => {
  const r1 = v => Math.round(v * 10) / 10;
  const rr = r => r ? { x: r1(r.x), y: r1(r.y), w: r1(r.width), h: r1(r.height) } : null;
  function clipAncestors(el) {
    const out = [];
    for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
        const b = a.getBoundingClientRect();
        // client 영역(테두리·스크롤막대 제외)
        const left = b.left + a.clientLeft, top = b.top + a.clientTop;
        out.push({ el: a, desc: desc(a), r: { l: left, t: top, r: left + a.clientWidth, b: top + a.clientHeight } });
      }
    }
    return out;
  }
  function desc(e) {
    if (!e) return null;
    if (e.nodeType !== 1) return String(e.nodeName);
    let s = e.tagName.toLowerCase();
    if (e.id) s += '#' + e.id;
    if (e.classList && e.classList.length) s += '.' + [...e.classList].join('.');
    for (const k of ['sel', 'tog', 'goto', 'act', 'xref', 'rel', 'ev', 'key', 'k', 'mv']) if (e.dataset && e.dataset[k] !== undefined) s += `[data-${k}=${e.dataset[k]}]`;
    return s;
  }
  function worldScale(el) {
    const w = document.getElementById('world');
    if (w && w.contains(el)) { const m = new DOMMatrix(getComputedStyle(w).transform); return m.a || 1; }
    return 1;
  }
  // 요소 안 모든 글자를 개별 관측
  function textVis(sel, root = document) {
    const el = typeof sel === 'string' ? root.querySelector(sel) : sel;
    if (!el) return { sel, found: false, chars: 0, ok: 0, fails: [{ reason: 'no-element' }] };
    const res = { sel: typeof sel === 'string' ? sel : desc(sel), found: true, text: el.innerText, chars: 0, ok: 0, fails: [], minFontPx: null, rect: rr(el.getBoundingClientRect()) };
    const vw = innerWidth, vh = innerHeight;
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = tw.nextNode())) {
      const par = n.parentElement;
      const cs = getComputedStyle(par);
      const fpx = parseFloat(cs.fontSize) * worldScale(par);
      const clips = clipAncestors(par);
      for (let i = 0; i < n.data.length; i++) {
        const ch = n.data[i];
        if (/\s/.test(ch)) continue;
        res.chars++;
        if (res.minFontPx === null || fpx < res.minFontPx) res.minFontPx = r1(fpx);
        const rg = document.createRange(); rg.setStart(n, i); rg.setEnd(n, i + 1);
        const rects = rg.getClientRects();
        const fail = reason => { if (res.fails.length < 12) res.fails.push({ i, ch, reason }); };
        if (!rects.length) { fail('no-rect'); continue; }
        const r = rects[0];
        if (r.width < .5 || r.height < .5) { fail('zero-size'); continue; }
        if (cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) { fail('invisible-style'); continue; }
        if (r.left < -0.5 || r.top < -0.5 || r.right > vw + .5 || r.bottom > vh + .5) { fail(`outside-viewport ${r1(r.left)},${r1(r.top)},${r1(r.right)},${r1(r.bottom)}`); continue; }
        let clipped = null;
        for (const c of clips) if (r.left < c.r.l - .5 || r.top < c.r.t - .5 || r.right > c.r.r + .5 || r.bottom > c.r.b + .5) { clipped = c.desc; break; }
        if (clipped) { fail('clipped-by ' + clipped); continue; }
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        const h = document.elementFromPoint(x, y);
        if (!h || !(el.contains(h) || h === el)) { fail('hit ' + desc(h)); continue; }
        if (!(h === par || par.contains(h) || h.contains(par))) { fail('hit-other ' + desc(h)); continue; }
        res.ok++;
      }
    }
    res.pass = res.chars > 0 && res.ok === res.chars;
    return res;
  }
  const ids = ['G1', 'G2', 'C21', 'C22', 'G3', 'C31', 'C32', 'G4', 'C41', 'C42', 'G5'];
  function nodes() {
    const o = {};
    for (const id of ids) {
      const e = document.getElementById('n-' + id);
      o[id] = e && e.getClientRects().length ? rr(e.getBoundingClientRect()) : null;
    }
    return o;
  }
  function edges() {
    return [...document.querySelectorAll('#edges g[data-k]')].map(g => ({
      k: g.dataset.k, rels: g.dataset.rels, repFrom: g.dataset.from, repTo: g.dataset.to, ends: g.dataset.ends, agg: g.dataset.agg,
      cls: g.getAttribute('class') || '', d: g.querySelector('path.vis').getAttribute('d'),
      title: g.querySelector('title').textContent
    }));
  }
  function raw() {
    const ms = document.getElementById('mapScroll'), main = document.getElementById('main'), panel = document.getElementById('panel');
    const fv = document.getElementById('focusView'), world = document.getElementById('world'), sizer = document.getElementById('sizer');
    const depth = {};
    for (const g of ['G2', 'G3', 'G4']) { const e = document.getElementById('n-' + g); depth[g] = e ? Number(e.dataset.depth) : null; }
    const a = document.activeElement;
    return {
      viewport: [innerWidth, innerHeight],
      view: fv.hidden ? 'map' : 'focus',
      depth,
      scale: { data: sizer.dataset.scale, label: document.getElementById('zVal').textContent, style: world.style.transform, computed: getComputedStyle(world).transform },
      map: { sl: ms.scrollLeft, st: ms.scrollTop, sw: ms.scrollWidth, sh: ms.scrollHeight, cw: ms.clientWidth, ch: ms.clientHeight },
      main: { st: main.scrollTop, sh: main.scrollHeight, ch: main.clientHeight },
      panelSt: panel.scrollTop,
      fvSt: fv.scrollTop,
      sel: [...document.querySelectorAll('[data-sel][aria-pressed=true]')].map(e => e.dataset.sel),
      isSel: [...document.querySelectorAll('.is-sel')].map(e => e.id),
      panelH2: (panel.querySelector('h2') || {}).textContent || null,
      panelPk: (panel.querySelector('.pk') || {}).textContent || null,
      active: desc(a), activeText: a ? (a.innerText || a.value || '').slice(0, 60) : null,
      nodes: nodes(), edges: edges()
    };
  }
  function rectOf(sel) { const e = document.querySelector(sel); return e && e.getClientRects().length ? rr(e.getBoundingClientRect()) : null; }
  // 실제 누를 점: 요소 중심(또는 지정 비율)과 그 점의 hit 요소
  function pointOf(sel, fx = .5, fy = .5) {
    const e = document.querySelector(sel); if (!e) return null;
    const r = e.getBoundingClientRect(); const x = r.left + r.width * fx, y = r.top + r.height * fy;
    const h = document.elementFromPoint(x, y);
    return { x, y, inView: x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight, hit: desc(h), hitInside: !!h && (e === h || e.contains(h)) };
  }
  // 묶음선의 누름 경로 위 한 점(화면 좌표)과 그 점의 실제 hit
  function edgePoint(k, frac = .5) {
    const g = document.querySelector(`#edges g[data-k="${k}"]`); if (!g) return null;
    const p = g.querySelector('path.hit'); const L = p.getTotalLength(); const q = p.getPointAtLength(L * frac);
    const m = p.getScreenCTM(); const x = m.a * q.x + m.c * q.y + m.e, y = m.b * q.x + m.d * q.y + m.f;
    const h = document.elementFromPoint(x, y);
    return { x, y, hit: desc(h), hitIsPath: h === p, hitInEdge: !!h && h.closest && h.closest('g[data-k]') === g };
  }
  function overlaps() {
    const shown = ids.map(id => [id, document.getElementById('n-' + id)]).filter(([, e]) => e && e.getClientRects().length);
    const groups = shown.filter(([id]) => id.startsWith('G')), out = [];
    for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
      const a = groups[i][1].getBoundingClientRect(), b = groups[j][1].getBoundingClientRect();
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > .5 && oy > .5) out.push([groups[i][0], groups[j][0], r1(ox), r1(oy)]);
    }
    return out;
  }
  // 집중 화면에서 실제로 보이는 근거 버튼(고정 상단 막대 아래, 집중 화면 안)
  function visibleEv() {
    const fv = document.getElementById('focusView'), fr = fv.getBoundingClientRect(), bar = fv.querySelector('.fbar').getBoundingClientRect();
    const b = [...fv.querySelectorAll('.ev')].find(b => { const r = b.getBoundingClientRect(); return r.top > bar.bottom + 4 && r.bottom < Math.min(innerHeight, fr.bottom) - 4; });
    return b ? `#focusView .ev[data-key="${b.dataset.key}"]` : null;
  }
  window.__t = { visibleEv, textVis, raw, nodes, edges, rectOf, pointOf, edgePoint, overlaps, desc };
})();
