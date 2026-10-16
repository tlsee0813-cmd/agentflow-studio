// 페이지 안 관측 도구(window.__t). 렌더러 내부 상태가 아니라 DOM·실제 rect·hit만 본다.
(() => {
  const r1 = v => Math.round(v * 10) / 10;
  const rr = r => r ? { x: r1(r.x), y: r1(r.y), w: r1(r.width), h: r1(r.height) } : null;
  function desc(e) {
    if (!e || e.nodeType !== 1) return e ? String(e.nodeName) : null;
    let s = e.tagName.toLowerCase(); if (e.id) s += '#' + e.id;
    if (e.classList && e.classList.length) s += '.' + [...e.classList].join('.');
    for (const k of ['node', 'sel', 'tog', 'goto', 'act', 'xref', 'rel', 'k', 'mv']) if (e.dataset && e.dataset[k] !== undefined) s += `[data-${k}=${e.dataset[k]}]`;
    return s;
  }
  function clipAncestors(el) {
    const out = [];
    for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') { const b = a.getBoundingClientRect(); const l = b.left + a.clientLeft, t = b.top + a.clientTop; out.push({ d: desc(a), r: { l, t, r: l + a.clientWidth, b: t + a.clientHeight } }); }
    }
    return out;
  }
  function scaleOf(el) { const w = document.getElementById('world'); if (w && w.contains(el)) { const m = new DOMMatrix(getComputedStyle(w).transform); return m.a || 1; } return 1; }
  // 글자마다 Range rect → 뷰포트 안 → 잘라내는 조상 안 → 중심 hit가 같은 요소 안
  function textVis(sel) {
    const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (!el) return { found: false, chars: 0, ok: 0, pass: false, fails: [{ reason: 'no-element' }] };
    const res = { found: true, text: el.innerText, chars: 0, ok: 0, fails: [], minFontPx: null };
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n;
    while ((n = tw.nextNode())) {
      const par = n.parentElement, cs = getComputedStyle(par); const fpx = parseFloat(cs.fontSize) * scaleOf(par); const clips = clipAncestors(par);
      if (par.closest('details:not([open])') && !par.closest('summary')) continue; // 접힌 details 안은 관측 대상 아님
      for (let i = 0; i < n.data.length; i++) {
        const ch = n.data[i]; if (/\s/.test(ch)) continue;
        res.chars++; if (res.minFontPx === null || fpx < res.minFontPx) res.minFontPx = r1(fpx);
        const rg = document.createRange(); rg.setStart(n, i); rg.setEnd(n, i + 1);
        const rect = rg.getClientRects()[0]; const fail = x => { if (res.fails.length < 10) res.fails.push({ i, ch, x }); };
        if (!rect || rect.width < .5 || rect.height < .5) { fail('no-rect'); continue; }
        if (rect.left < -.5 || rect.top < -.5 || rect.right > innerWidth + .5 || rect.bottom > innerHeight + .5) { fail('outside-viewport'); continue; }
        const c = clips.find(c => rect.left < c.r.l - .5 || rect.top < c.r.t - .5 || rect.right > c.r.r + .5 || rect.bottom > c.r.b + .5); if (c) { fail('clipped ' + c.d); continue; }
        const h = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        if (!h || !(el === h || el.contains(h))) { fail('hit ' + desc(h)); continue; }
        res.ok++;
      }
    }
    res.pass = res.chars > 0 && res.ok === res.chars; return res;
  }
  function nodes() { const o = {}; document.querySelectorAll('#world [data-node]').forEach(e => { o[e.dataset.node] = e.getClientRects().length ? rr(e.getBoundingClientRect()) : null; }); return o; }
  function edges() { return [...document.querySelectorAll('#edges g[data-k]')].map(g => ({ k: g.dataset.k, rels: g.dataset.rels, cls: g.getAttribute('class') || '', d: g.querySelector('path.vis').getAttribute('d') })); }
  function view() {
    const ms = document.getElementById('mapScroll'), main = document.getElementById('main'), panel = document.getElementById('panel'), w = document.getElementById('world');
    const depth = {}; document.querySelectorAll('#world .grp[data-depth]').forEach(e => depth[e.dataset.node] = Number(e.dataset.depth));
    return {
      caseSel: document.getElementById('caseSel').value, title: (document.querySelector('#caseHead h1') || {}).textContent || null,
      depth, scale: { label: document.getElementById('zVal').textContent, computed: getComputedStyle(w).transform },
      map: { sl: ms.scrollLeft, st: ms.scrollTop, sw: ms.scrollWidth, sh: ms.scrollHeight, cw: ms.clientWidth, ch: ms.clientHeight },
      main: { st: main.scrollTop, sh: main.scrollHeight, ch: main.clientHeight }, panelSt: panel.scrollTop,
      sel: [...document.querySelectorAll('#world [data-sel][aria-pressed=true]')].map(e => e.dataset.sel),
      panelH2: (panel.querySelector('h2') || {}).textContent || null, active: desc(document.activeElement),
      detailOpen: !!document.getElementById('detail'), xrefOpen: !!document.getElementById('xref'), draftOpen: !document.getElementById('draft').hidden,
      nodes: nodes(), edges: edges()
    };
  }
  function pointOf(sel) { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const h = document.elementFromPoint(x, y); return { x, y, inView: r.width > 0 && x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight, hit: desc(h), hitInside: !!h && (e === h || e.contains(h)), rect: rr(r) }; }
  function overlaps() { const g = [...document.querySelectorAll('#world > .grp')]; const out = []; for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) { const a = g[i].getBoundingClientRect(), b = g[j].getBoundingClientRect(); const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); if (ox > .5 && oy > .5) out.push([g[i].dataset.node, g[j].dataset.node]); } return out; }
  window.__t = { textVis, view, pointOf, overlaps, desc, rr };
})();
