/* 공통 부분 지도 렌더러 (연구용).
   입력(fixture)의 구조와 필드 존재만 보고 그린다. 사례 이름·노드 ID·사업 문구로 갈라지는 코드는 두지 않는다.
   허용 구조: 루트와 그 직접 자식의 두 층. parent는 보기의 포함이며 relations와 별개다. */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const STEPS = [0.6, 0.75, 0.9, 1, 1.15, 1.3];
const app = $('#app'), main = $('#main'), ms = $('#mapScroll'), sizer = $('#sizer'), world = $('#world'), svg = $('#edges');
const panel = $('#panel'), head = $('#caseHead'), sel = $('#caseSel'), legend = $('#legend'), errBox = $('#inputErrors');
const draftEl = $('#draft'), draftText = $('#draftText');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- 상태 ----------
   cases[i] = {fx, ok, errors, ix}
   views[caseKey] = {depth, scale, sl, st, mainSt, panelSt, sel}  (사례별 보기)
   drafts: Map(caseKey + '\u0000' + nodeId → 문자열)               (사례+대상별 초안, 메모리만) */
const S = { cases: [], cur: -1, views: {}, drafts: new Map(), layout: null, xref: null, detail: null, draft: null };
const caseKey = i => 'case:' + i + ':' + (S.cases[i].fx && S.cases[i].fx.caseId);

/* ---------- 입력 검사 (조용히 고치지 않고 오류로 보여 준다) ---------- */
function validate(fx) {
  const E = [];
  if (!fx || typeof fx !== 'object') return ['입력이 JSON 객체가 아닙니다.'];
  if (fx.schemaVersion !== 1) E.push(`지원하지 않는 schemaVersion: ${fx.schemaVersion}`);
  if (!fx.caseId || typeof fx.caseId !== 'string') E.push('caseId가 없습니다.');
  for (const k of ['title', 'scope', 'nature', 'basisTime']) if (!fx[k]) E.push(`${k}가 없습니다.`);
  const nodes = Array.isArray(fx.nodes) ? fx.nodes : (E.push('nodes 배열이 없습니다.'), []);
  const rels = Array.isArray(fx.relations) ? fx.relations : (E.push('relations 배열이 없습니다(없으면 빈 배열).'), []);
  const evs = Array.isArray(fx.evidence) ? fx.evidence : (E.push('evidence 배열이 없습니다(없으면 빈 배열).'), []);
  const ids = new Map(), evIds = new Set(), relIds = new Set();
  for (const n of nodes) {
    if (!n || !n.id) { E.push('id가 없는 node가 있습니다.'); continue; }
    if (ids.has(n.id)) E.push(`중복 node ID: ${n.id}`); else ids.set(n.id, n);
    if (!n.name) E.push(`node ${n.id}: name이 없습니다.`);
    if (!n.role) E.push(`node ${n.id}: role이 없습니다.`);
  }
  for (const e of evs) { if (!e || !e.id) { E.push('id가 없는 evidence가 있습니다.'); continue; } if (evIds.has(e.id)) E.push(`중복 evidence ID: ${e.id}`); evIds.add(e.id); if (!e.source || !e.source.url) E.push(`evidence ${e.id}: source.url이 없습니다.`); }
  for (const n of nodes) {
    if (!n || !n.id) continue;
    const p = n.parent;
    if (p === undefined) E.push(`node ${n.id}: parent 필드가 없습니다(루트는 null).`);
    else if (p !== null) {
      if (p === n.id) E.push(`node ${n.id}: 자기 자신을 parent로 가리킵니다(순환).`);
      else if (!ids.has(p)) E.push(`node ${n.id}: parent ${p}가 없습니다.`);
      else {
        // 순환 검사
        const seen = new Set([n.id]); let q = p, cyc = false;
        while (q !== null && q !== undefined && ids.has(q)) { if (seen.has(q)) { cyc = true; break; } seen.add(q); q = ids.get(q).parent; }
        if (cyc) E.push(`node ${n.id}: parent 연결이 순환합니다.`);
        else if (ids.get(p).parent !== null) E.push(`node ${n.id}: 지원하지 않는 깊이(3층 이상). 이 화면은 루트와 직접 자식 두 층만 지원합니다.`);
      }
    }
    for (const r of (n.evidence || [])) if (!evIds.has(r)) E.push(`node ${n.id}: 없는 evidence ${r}`);
    if (n.change) {
      if (!n.change.summary) E.push(`node ${n.id}: change.summary가 없습니다.`);
      if (!Array.isArray(n.change.evidence) || !n.change.evidence.length) E.push(`node ${n.id}: change에 근거(evidence)가 없습니다.`);
      for (const r of (n.change.evidence || [])) if (!evIds.has(r)) E.push(`node ${n.id}: change의 없는 evidence ${r}`);
    }
  }
  for (const r of rels) {
    if (!r || !r.id) { E.push('id가 없는 relation이 있습니다.'); continue; }
    if (relIds.has(r.id)) E.push(`중복 relation ID: ${r.id}`); relIds.add(r.id);
    if (ids.has(r.id) || evIds.has(r.id)) E.push(`ID ${r.id}가 다른 종류와 겹칩니다.`);
    if (!ids.has(r.from)) E.push(`relation ${r.id}: 끝점 from ${r.from}이 없습니다.`);
    if (!ids.has(r.to)) E.push(`relation ${r.id}: 끝점 to ${r.to}가 없습니다.`);
    if (r.from === r.to) E.push(`relation ${r.id}: 양끝이 같습니다.`);
    if (!r.kind || !r.condition) E.push(`relation ${r.id}: kind/condition이 없습니다.`);
    for (const x of (r.evidence || [])) if (!evIds.has(x)) E.push(`relation ${r.id}: 없는 evidence ${x}`);
  }
  for (const id of evIds) if (ids.has(id)) E.push(`ID ${id}가 node와 evidence에 함께 쓰였습니다.`);
  const iv = fx.initialView || {};
  for (const g of (iv.expanded || [])) if (!ids.has(g)) E.push(`initialView.expanded: 없는 node ${g}`);
  const pl = (iv.layout && iv.layout.place) || {};
  for (const k of Object.keys(pl)) { if (!ids.has(k)) E.push(`initialView.layout.place: 없는 node ${k}`); else if (ids.get(k).parent !== null) E.push(`initialView.layout.place: 루트가 아닌 node ${k}`); }
  return E;
}
function indexCase(fx) {
  const nodes = new Map(fx.nodes.map(n => [n.id, n]));
  const kids = new Map(); const roots = [];
  for (const n of fx.nodes) { if (n.parent === null) roots.push(n.id); else { if (!kids.has(n.parent)) kids.set(n.parent, []); kids.get(n.parent).push(n.id); } }
  return { nodes, kids, roots, rels: fx.relations, ev: new Map(fx.evidence.map(e => [e.id, e])) };
}

/* ---------- 현재 사례 접근 ---------- */
let C = null, V = null; // C: index, V: 현재 보기
const N = id => C.nodes.get(id);
const nm = id => N(id).name;
const kidsOf = id => C.kids.get(id) || [];
const isGroup = id => kidsOf(id).length > 0;
const parentOf = id => N(id).parent;
const isHidden = id => { const p = parentOf(id); return !!(p !== null && !V.depth[p]); };
const rep = id => isHidden(id) ? parentOf(id) : id;
const where = id => { const p = parentOf(id); return p !== null ? `‹${nm(p)}› 안` : (N(id).tag || '최상위 부분'); };
const familyOf = id => isGroup(id) ? [id, ...kidsOf(id)] : [id];
const relsTouching = id => { const f = familyOf(id); return C.rels.filter(r => f.includes(r.from) || f.includes(r.to)); };
const changed = () => [...C.nodes.values()].filter(n => n.change);
const nodeEls = new Map();
const nodeEl = id => nodeEls.get(id);

/* ---------- 사례 머리 ---------- */
function renderHead() {
  const fx = S.cases[S.cur].fx;
  let h = `<h1>${esc(fx.title)}</h1><dl class="meta">
   <div><dt>범위</dt><dd>${esc(fx.scope)}</dd></div>
   <div><dt>자료 성격</dt><dd>${esc(fx.nature)}</dd></div>
   <div><dt>기준 시점</dt><dd>${esc(fx.basisTime)}</dd></div>
   ${fx.groupingNote ? `<div><dt>묶음</dt><dd>${esc(fx.groupingNote)}</dd></div>` : ''}</dl>`;
  const ch = changed();
  if (ch.length) h += `<div class="chgstrip" aria-label="이 기록에서 달라진 부분"><span class="chglab">이 기록에서 달라진 부분</span>${ch.map(n => `<button class="chgchip" data-goto="${esc(n.id)}"><b>${esc(n.name)}</b><span>${esc(n.change.label || '변경')}</span></button>`).join('')}</div>`;
  head.innerHTML = h;
  const tags = [...C.nodes.values()].some(n => n.tag);
  legend.innerHTML = `<span><i class="lg-box"></i>묶음 · 보기 구분</span>
   <span><svg width="30" height="12" aria-hidden="true"><path d="M1 6H24" stroke="#2c5a86" stroke-width="1.8"/><path d="M22 2L28 6L22 10" fill="none" stroke="#2c5a86" stroke-width="1.8"/></svg>기록에 적힌 관계 (순서 아님)</span>
   <span><svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="#fffdf8" stroke="#2c5a86" stroke-width="1.6"/></svg>접힌 묶음 안으로 모음 · 숫자는 관계 수</span>
   ${ch.length ? '<span><i class="lg-chg"></i>이 기록에서 달라진 부분</span>' : ''}
   ${tags ? '<span><i class="lg-ext"></i>묶음 밖 부품</span>' : ''}`;
}

/* ---------- 지도 ---------- */
function buildMap() {
  for (const el of [...world.children]) if (el !== svg) el.remove();
  nodeEls.clear();
  const L = (S.cases[S.cur].fx.initialView || {}).layout || {};
  world.style.gridTemplateColumns = (L.columns || []).join(' ');
  world.style.gridTemplateAreas = (L.areas || []).map(a => `"${a}"`).join(' ');
  for (const id of C.roots) {
    const n = N(id), g = isGroup(id), d = document.createElement('div');
    d.className = 'grp' + (g ? '' : ' leaf') + (n.tag ? ' ext' : '') + (n.change ? ' chg' : '');
    d.dataset.node = id;
    const pl = (L.place || {})[id];
    if (pl) { d.style.gridArea = pl.area; if (pl.align) d.style.alignSelf = pl.align; }
    let h = `<div class="ghead"><button class="gsel" data-sel="${esc(id)}" aria-pressed="false">${n.tag ? `<span class="gtag">${esc(n.tag)}</span>` : ''}<span class="gname">${esc(n.name)}</span>${n.change ? `<span class="kchg">${esc(n.change.label || '변경')}</span>` : ''}<span class="gshort">${esc(n.short || '')}</span></button>`;
    if (g) h += `<button class="gtog" data-tog="${esc(id)}" aria-expanded="false"></button>`;
    h += '</div>';
    if (g) h += '<div class="gfold"></div><div class="kids">' + kidsOf(id).map(k => { const c = N(k); return `<button class="kid${c.change ? ' chg' : ''}" data-node="${esc(k)}" data-sel="${esc(k)}" aria-pressed="false"><span class="kname">${esc(c.name)}</span>${c.change ? `<span class="kchg">${esc(c.change.label || '변경')}</span>` : ''}<span class="kshort">${esc(c.short || '')}</span></button>`; }).join('') + '</div>';
    d.innerHTML = h; world.appendChild(d); nodeEls.set(id, d);
    for (const k of kidsOf(id)) nodeEls.set(k, d.querySelector(`.kid[data-node="${CSS.escape(k)}"]`));
  }
}
function syncSize() {
  const w = world.offsetWidth, h = world.offsetHeight, s = V ? V.scale : 1;
  sizer.style.width = w * s + 'px'; sizer.style.height = h * s + 'px';
  svg.setAttribute('width', w); svg.setAttribute('height', h);
}
function applyScale() {
  world.style.transform = `scale(${V.scale})`; syncSize(); sizer.dataset.scale = V.scale;
  $('#zVal').textContent = Math.round(V.scale * 100) + '%';
  $('#zOut').disabled = V.scale <= STEPS[0]; $('#zIn').disabled = V.scale >= STEPS[STEPS.length - 1];
}
function zoom(dir) {
  const i = STEPS.indexOf(V.scale), j = Math.max(0, Math.min(STEPS.length - 1, (i < 0 ? 3 : i) + dir));
  const s0 = V.scale, s1 = STEPS[j]; if (s0 === s1) return;
  const cx = (ms.scrollLeft + ms.clientWidth / 2) / s0, cy = (ms.scrollTop + ms.clientHeight / 2) / s0;
  V.scale = s1; applyScale();
  ms.scrollLeft = cx * s1 - ms.clientWidth / 2; ms.scrollTop = cy * s1 - ms.clientHeight / 2;
}
function applyLayout() {
  const L = matchMedia('(max-width:700px)').matches ? 'narrow' : 'wide';
  S.layout = L; world.classList.toggle('narrow', L === 'narrow'); world.classList.toggle('wide', L === 'wide');
}
function applyDepth() {
  for (const id of C.roots) {
    if (!isGroup(id)) continue;
    const el = nodeEl(id), open = !!V.depth[id], n = N(id), ks = kidsOf(id);
    el.classList.toggle('collapsed', !open); el.dataset.depth = open ? 1 : 0;
    const t = el.querySelector('.gtog'); t.textContent = open ? '접기' : '펼치기'; t.setAttribute('aria-expanded', open); t.setAttribute('aria-label', `${n.name} ${open ? '접기' : '펼치기'}`);
    const ch = ks.filter(k => N(k).change);
    el.querySelector('.gfold').innerHTML = ch.length
      ? `<div class="agg"><span class="dot"></span>안에 달라진 부분 · ${ch.map(k => esc(nm(k))).join(', ')}</div><div class="sub">세부 ${ks.length}개 접힘 · 묶음 전체 변경 아님</div>`
      : `<div class="sub">세부 ${ks.length}개 접힘 · ${ks.map(k => esc(nm(k))).join(', ')}</div>`;
  }
  syncSize(); markSel(); drawEdges();
}
function wrect(el) { const w = world.getBoundingClientRect(), r = el.getBoundingClientRect(), s = V.scale; return { x: (r.left - w.left) / s, y: (r.top - w.top) / s, w: r.width / s, h: r.height / s }; }
function bundles() {
  const m = new Map();
  for (const r of C.rels) { const a = rep(r.from), b = rep(r.to), k = a + '>' + b; if (!m.has(k)) m.set(k, { k, a, b, rels: [] }); m.get(k).rels.push(r); }
  return [...m.values()];
}
function drawEdges() {
  if (!C || !world.offsetWidth) return;
  const NS = 'http://www.w3.org/2000/svg';
  svg.innerHTML = `<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="10" markerHeight="10" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#2c5a86"/></marker></defs>`;
  const W = world.offsetWidth; let laneL = 0, laneR = 0;
  const q = v => Math.round(v * 10) / 10, qr = o => ({ x: q(o.x), y: q(o.y), w: q(o.w), h: q(o.h) });
  for (const b of bundles()) {
    const A = qr(wrect(nodeEl(b.a))), B = qr(wrect(nodeEl(b.b)));
    let sx, sy, ex, ey, d;
    const ov = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y), mid = (Math.max(A.y, B.y) + Math.min(A.y + A.h, B.y + B.h)) / 2;
    if (B.x >= A.x + A.w + 8) { sx = A.x + A.w; ex = B.x; if (ov >= 24) { sy = ey = mid; } else { sy = A.y + A.h / 2; ey = B.y + B.h / 2; } const m = (ex - sx) / 2; d = `M${sx} ${sy}C${sx + m} ${sy} ${ex - m} ${ey} ${ex} ${ey}`; }
    else if (A.x >= B.x + B.w + 8) { sx = A.x; ex = B.x + B.w; if (ov >= 24) { sy = ey = mid; } else { sy = A.y + A.h / 2; ey = B.y + B.h / 2; } const m = (sx - ex) / 2; d = `M${sx} ${sy}C${sx - m} ${sy} ${ex + m} ${ey} ${ex} ${ey}`; }
    else {
      const left = (A.x + A.w / 2 + B.x + B.w / 2) / 2 < W / 2;
      sy = A.y + A.h * .62; ey = B.y + B.h * .38;
      if (left) { sx = A.x; ex = B.x; const lx = Math.max(2, Math.min(sx, ex) - 12 - laneL * 5); laneL++; d = `M${sx} ${sy}C${lx} ${sy} ${lx} ${ey} ${ex} ${ey}`; }
      else { sx = A.x + A.w; ex = B.x + B.w; const lx = Math.min(W - 2, Math.max(sx, ex) + 12 + laneR * 5); laneR++; d = `M${sx} ${sy}C${lx} ${sy} ${lx} ${ey} ${ex} ${ey}`; }
    }
    const aggFrom = b.rels.some(r => r.from !== b.a), aggTo = b.rels.some(r => r.to !== b.b);
    const g = document.createElementNS(NS, 'g');
    g.dataset.k = b.k; g.dataset.rels = b.rels.map(r => r.id).join(' '); g.dataset.from = b.a; g.dataset.to = b.b;
    g.dataset.agg = (aggFrom ? 'from ' : '') + (aggTo ? 'to' : '');
    const t = document.createElementNS(NS, 'title'); t.textContent = b.rels.map(r => `${nm(r.from)} → ${nm(r.to)} · ${r.kind}`).join('\n'); g.appendChild(t);
    const vis = document.createElementNS(NS, 'path'); vis.setAttribute('d', d); vis.setAttribute('class', 'vis'); if (!aggTo) vis.setAttribute('marker-end', 'url(#ah)'); g.appendChild(vis);
    svg.appendChild(g);
    const L = vis.getTotalLength(), pts = [], tr = Math.min(12, L * .2);
    for (let i = 0; i <= 24; i++) { const p = vis.getPointAtLength(tr + (L - 2 * tr) * i / 24); pts.push(`${p.x.toFixed(1)} ${p.y.toFixed(1)}`); }
    const hit = document.createElementNS(NS, 'path'); hit.setAttribute('d', 'M' + pts.join('L')); hit.setAttribute('class', 'hit'); g.appendChild(hit);
    for (const [on, x, y] of [[aggFrom, sx, sy], [aggTo, ex, ey]]) if (on) { const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 4.5); c.setAttribute('class', 'ring'); g.appendChild(c); }
    if (b.rels.length > 1) { const p = vis.getPointAtLength(L * .5), cc = document.createElementNS(NS, 'circle'), tx = document.createElementNS(NS, 'text'); cc.setAttribute('cx', p.x); cc.setAttribute('cy', p.y); cc.setAttribute('r', 7.5); cc.setAttribute('class', 'cntc'); tx.setAttribute('x', p.x); tx.setAttribute('y', p.y + .5); tx.setAttribute('class', 'cnt'); tx.textContent = b.rels.length; g.appendChild(cc); g.appendChild(tx); }
  }
  markEdges();
}
function selRelIds() { const s = V.sel; if (!s) return null; if (s.t === 'rel') return [s.id]; if (s.t === 'bundle') return s.ids; return relsTouching(s.id).map(r => r.id); }
function markEdges() {
  const ids = selRelIds();
  svg.querySelectorAll('g[data-k]').forEach(g => { const on = ids && g.dataset.rels.split(' ').some(r => ids.includes(r)); g.classList.toggle('on', !!on); g.classList.toggle('dim', !!ids && !on); });
}
function selTarget(id) { const r = rep(id), el = nodeEl(r); return isGroup(r) || parentOf(r) === null ? el.querySelector('.gsel') : el; }
function markSel() {
  world.querySelectorAll('.is-sel').forEach(e => e.classList.remove('is-sel'));
  world.querySelectorAll('[data-sel][aria-pressed=true]').forEach(e => e.setAttribute('aria-pressed', 'false'));
  const s = V.sel;
  if (s && s.t === 'node') { const r = rep(s.id); nodeEl(r).classList.add('is-sel'); selTarget(s.id).setAttribute('aria-pressed', 'true'); }
  markEdges();
}
function select(s, fromPanel) {
  closeRef(false); V.sel = s; markSel(); renderPanel();
  if (fromPanel) { const h = panel.querySelector('h2'); h && h.focus({ preventScroll: true }); }
}
function selectNode(id, fromPanel) { if (isHidden(id)) { V.depth[parentOf(id)] = 1; applyDepth(); } select({ t: 'node', id }, fromPanel); }

/* ---------- 선택 설명 ---------- */
function evLink(eid) { const e = C.ev.get(eid); return `<a href="${esc(e.source.url)}" target="_blank" rel="noopener">${esc(e.source.label)} ↗</a>`; }
function endBtn(id) { return `<button class="rbtn" data-goto="${esc(id)}">${esc(nm(id))}<small>${esc(where(id))}${isHidden(id) ? ' · 지금 접혀 있음, 눌러서 펼쳐 선택' : ''}</small></button>`; }
function relSide(r, ids) { const inn = ids.includes(r.to), out = ids.includes(r.from); return { other: inn && !out ? r.from : r.to, mine: inn && !out ? r.to : r.from, dir: inn && out ? '안에서' : inn ? '받음 ←' : '보냄 →' }; }
function xBtn(r, ids, desc) { const x = relSide(r, ids); return `<button class="xbtn" data-xref="${esc(r.id)}" aria-expanded="false"${desc ? ` aria-describedby="${esc(desc)}"` : ''}><span class="dir">${x.dir}</span> ${esc(nm(x.other))}<small>${esc(r.kind)} · ${esc(where(x.other))}</small></button>`; }
function relList(id, rels) {
  const ids = familyOf(id);
  if (!isGroup(id)) return `<div class="list">${rels.map(r => xBtn(r, ids)).join('')}</div>`;
  let h = '', i = 0;
  for (const k of [id, ...kidsOf(id)]) {
    const mine = rels.filter(r => relSide(r, ids).mine === k); if (!mine.length) continue;
    const gid = `xg-${i++}`;
    h += `<div class="xgrp" id="${gid}"><b>${esc(nm(k))}</b> · ${k === id ? '이 묶음 자체' : '이 묶음 안 세부'}</div>` + mine.map(r => xBtn(r, ids, gid)).join('');
  }
  return `<div class="list">${h}</div>`;
}
function renderPanel() {
  const s = V.sel; let h = ''; S.xref = null; S.detail = null;
  if (!s) {
    const ch = changed();
    h = `<div class="pk">선택 설명</div><h2 tabindex="-1">한 부분을 골라 보세요</h2>
     <p>지도의 카드 하나를 고르면 그 부분의 역할${ch.length ? '과 이 기록에서 달라진 점' : ''}을 먼저 보여 줍니다. 근거 원문과 관계 조건은 필요할 때 엽니다.</p>
     ${ch.length ? `<div class="act">${ch.map(n => `<button class="btn" data-goto="${esc(n.id)}">${esc(n.name)} 고르기</button>`).join('')}</div>` : ''}`;
  } else if (s.t === 'node') {
    const n = N(s.id), g = isGroup(s.id), rels = relsTouching(s.id), p = parentOf(s.id);
    h = `<div class="pk">${p !== null ? `‹${esc(nm(p))}› 안 세부` : esc(n.tag || (g ? '묶음 · 보기 구분' : '최상위 부분'))}</div><h2 tabindex="-1">${esc(n.name)}</h2>`;
    h += `<p class="role">${esc(n.role)}</p>`;
    if (isHidden(s.id)) h += `<p class="note">지금 접힌 ‹${esc(nm(p))}› 안에 있어 지도에는 묶음 자리로 보입니다.</p>`;
    if (n.change) h += `<div class="chgnote"><span class="chgk">이 기록에서 달라진 부분 · ${esc(n.change.label || '변경')}</span>${esc(n.change.summary)}</div>`;
    if (g) { const ck = kidsOf(s.id).filter(k => N(k).change); if (ck.length) h += `<div class="chgnote soft"><span class="chgk">안에 달라진 부분</span>${ck.map(k => esc(nm(k))).join(', ')}. 묶음 전체가 바뀐 것은 아닙니다.</div>`; }
    h += `<div class="act"><button class="btn primary" data-act="detail" aria-expanded="false" aria-controls="detail">근거·전체 조건 읽기</button>${g ? '' : '<button class="btn" data-act="draft">내 다음 요청 준비</button>'}</div>`;
    if (g) h += `<h3>세부 ${kidsOf(s.id).length}개</h3><div class="list">${kidsOf(s.id).map(endBtn).join('')}</div>`;
    h += `<h3>기록에 적힌 관계</h3>`;
    h += rels.length ? relList(s.id, rels) : `<p class="muted">이 입력에는 이 부분의 관계가 적혀 있지 않습니다. 무관하다는 뜻은 아닙니다.</p>`;
  } else {
    const ids = s.t === 'rel' ? [s.id] : s.ids, rs = C.rels.filter(r => ids.includes(r.id));
    if (rs.length === 1) {
      const r = rs[0], a = rep(r.from) !== r.from || rep(r.to) !== r.to;
      h = `<div class="pk">기록에 적힌 관계 · 실행 순서 아님 · ${esc(r.id)}</div><h2 tabindex="-1">${esc(r.kind)}</h2>
       <div class="ends">${endBtn(r.from)}<div class="arr">↓ ${esc(r.short || '')}</div>${endBtn(r.to)}</div>
       ${a ? '<p class="note">한쪽 끝이 접힌 묶음 안이라 지도에서는 묶음 자리로 모아 그렸습니다. 실제 끝은 위 두 부분입니다.</p>' : ''}
       <p>${esc(r.condition)}</p><p class="muted">근거 ${(r.evidence || []).map(evLink).join(' · ')}</p>`;
    } else {
      h = `<div class="pk">모아 그린 선 · 관계 ${rs.length}개</div><h2 tabindex="-1">이 선에 담긴 실제 관계</h2>
       <p class="muted">접힌 묶음 때문에 같은 자리로 모였을 뿐, 관계는 각각 따로입니다.</p>
       <div class="list">${rs.map(r => `<div class="rbtn" style="cursor:default" data-relrow="${esc(r.id)}">${esc(r.kind)}<small>실제 끝: ${esc(nm(r.from))} (${esc(where(r.from))}) → ${esc(nm(r.to))} (${esc(where(r.to))})</small><span class="act" style="margin-top:6px"><button class="btn sm" data-rel="${esc(r.id)}">이 관계만 보기</button></span></div>`).join('')}</div>`;
    }
  }
  panel.innerHTML = h;
}

/* ---------- 관계 참고 (읽기 전용) ---------- */
function whereLine(id, role) {
  const me = V.sel && V.sel.t === 'node' && V.sel.id === id;
  return `<li><b>${role}</b> ${esc(where(id))}${isHidden(id) ? ` · 지도에선 접힌 ‹${esc(nm(parentOf(id)))}› 자리` : ''}${me ? ' · 지금 선택' : ''}</li>`;
}
function openXref(btn) {
  closeRef(false);
  const r = C.rels.find(x => x.id === btn.dataset.xref), s = V.sel, ids = familyOf(s.id), other = relSide(r, ids).other;
  const d = document.createElement('div'); d.className = 'xpeek'; d.id = 'xref'; d.setAttribute('role', 'region'); d.setAttribute('aria-label', `관계 참고 · ${nm(r.from)}에서 ${nm(r.to)}로`);
  d.innerHTML = `<div class="xhd"><span class="pkh">관계 참고 · 읽기 전용</span><button class="btn sm" data-act="ref-close">참고 닫기</button></div>
   <p class="xflow"><b>${esc(nm(r.from))}</b><span class="xar"> → </span><b>${esc(nm(r.to))}</b></p>
   <p class="xkind">관계: ${esc(r.kind)}</p>
   <ul class="xwh">${whereLine(r.from, '보내는 쪽')}${whereLine(r.to, '받는 쪽')}</ul>
   <p class="xcond">${esc(r.condition)}</p>
   <p class="xmeta">지도 선택은 ‹${esc(nm(s.id))}› 그대로 · 참고는 초안을 바꾸지 않음<br>근거 ${(r.evidence || []).map(evLink).join(' · ')} · 관계 ${esc(r.id)}</p>
   <div class="mv"><button class="btn sm" data-goto="${esc(other)}" data-mv="1">지도에서 ‘${esc(nm(other))}’ 선택</button><small>선택만 옮깁니다. 요청을 보내거나 초안을 바꾸지 않습니다.</small></div>`;
  btn.after(d); btn.setAttribute('aria-expanded', 'true'); S.xref = { opener: btn };
}
/* ---------- 근거·전체 조건 (명시적으로 여는 상세) ---------- */
function evBlock(eid) {
  const e = C.ev.get(eid);
  return `<div class="evb" data-ev="${esc(eid)}"><div class="evt">${esc(e.type || '근거')}</div><p>${esc(e.summary || '')}</p>
   ${e.quote ? `<details class="quote"><summary>정확 원문</summary><pre>${esc(e.quote)}</pre></details>` : ''}
   ${e.limits ? `<p class="lim"><b>확인 한계</b> ${esc(e.limits)}</p>` : ''}
   <p class="src">${evLink(eid)}${e.source.pin ? ` <span class="pin">${esc(e.source.pin)}</span>` : ''}</p></div>`;
}
function openDetail(btn) {
  closeRef(false);
  const id = V.sel.id, n = N(id), rels = relsTouching(id);
  const evIds = [...new Set([...(n.change ? n.change.evidence : []), ...(n.evidence || [])])];
  let h = `<div class="xhd"><span class="pkh">근거·전체 조건 · ${esc(n.name)}</span><button class="btn sm" data-act="ref-close">근거 닫기</button></div>`;
  h += `<section><h4>역할</h4><p>${esc(n.role)}</p></section>`;
  if (n.change) {
    const c = n.change;
    h += `<section><h4>이 기록에서 달라진 부분 · ${esc(c.label || '변경')}</h4>
      ${c.before || c.after ? `<div class="ba"><div class="b"><small>전</small>${esc(c.before || '')}</div><div class="a"><small>후</small>${esc(c.after || '')}</div></div>` : ''}
      ${c.basis ? `<p class="muted">비교 기준 · ${esc(c.basis)}</p>` : ''}</section>`;
  }
  if (rels.length) h += `<section><h4>관계 전체 조건</h4>${rels.map(r => `<div class="rc"><p><b>${esc(nm(r.from))} → ${esc(nm(r.to))}</b> · ${esc(r.kind)}</p><p>${esc(r.condition)}</p></div>`).join('')}</section>`;
  h += `<section><h4>근거 기록</h4>${evIds.length ? evIds.map(evBlock).join('') : '<p class="muted">이 부분에 연결된 근거 기록이 입력에 없습니다.</p>'}</section>`;
  const d = document.createElement('div'); d.className = 'detail'; d.id = 'detail'; d.setAttribute('role', 'region'); d.setAttribute('aria-label', `근거·전체 조건 · ${n.name}`); d.innerHTML = h;
  btn.closest('.act').after(d); btn.setAttribute('aria-expanded', 'true'); S.detail = { opener: btn };
}
function closeRef(restore = true) {
  const x = S.xref || S.detail; if (!x) return;
  const d = $('#xref') || $('#detail'); if (d) d.remove();
  x.opener.setAttribute('aria-expanded', 'false');
  S.xref = null; S.detail = null;
  if (restore && x.opener.isConnected) x.opener.focus({ preventScroll: true });
}

/* ---------- 내 다음 요청 (빈 자유문 한 칸, 메모리) ---------- */
const dkey = id => caseKey(S.cur) + '\u0000' + id;
function openDraft(btn) {
  closeRef(false);
  const id = V.sel.id, n = N(id), rels = relsTouching(id);
  S.draft = { id, opener: btn };
  $('#draftTitle').textContent = n.name;
  let r = `<dl class="meta"><div><dt>사례</dt><dd>${esc(S.cases[S.cur].fx.title)}</dd></div><div><dt>대상</dt><dd>${esc(n.name)} · ${esc(where(id))}</dd></div><div><dt>역할</dt><dd>${esc(n.role)}</dd></div>`;
  if (n.change) r += `<div><dt>달라진 부분</dt><dd>${esc(n.change.summary)} (${esc(n.change.label || '변경')})</dd></div>`;
  if (rels.length) r += `<div><dt>관계</dt><dd>${rels.map(x => `${esc(nm(x.from))} → ${esc(nm(x.to))} · ${esc(x.kind)}`).join('<br>')}</dd></div>`;
  const evIds = [...new Set([...(n.change ? n.change.evidence : []), ...(n.evidence || [])])];
  if (evIds.length) r += `<div><dt>참고 기록</dt><dd>${evIds.map(e => `${esc(C.ev.get(e).type)} · ${evLink(e)}`).join('<br>')}</dd></div>`;
  $('#draftRefBody').innerHTML = r + '</dl>';
  $('#draftRef').open = false;
  draftText.value = S.drafts.get(dkey(id)) || '';
  $('#draftPreview').hidden = true; $('#draftPreview').textContent = ''; $('#draftStatus').textContent = '';
  syncDraftBtns();
  draftEl.hidden = false; app.querySelector('#main').inert = true; $('#top').inert = true;
  draftText.focus({ preventScroll: true });
}
function syncDraftBtns() { const empty = !draftText.value.trim(), p = $('#draftPreview'); $('#draftPreviewBtn').disabled = empty; $('#draftCopyBtn').disabled = empty; if (empty) { p.hidden = true; p.textContent = ''; } else if (!p.hidden) p.textContent = draftPreviewText(); /* 열린 미리보기는 입력과 함께 최신화: 보이는 내용 = 복사할 내용 */ }
function draftPreviewText() { const id = S.draft.id; return `대상: ${S.cases[S.cur].fx.title} › ${nm(id)} (${where(id)})\n\n${draftText.value.trim()}`; }
function closeDraft(restore = true) {
  if (!S.draft) return;
  const o = S.draft.opener; S.draft = null;
  draftEl.hidden = true; app.querySelector('#main').inert = false; $('#top').inert = false;
  if (restore && o && o.isConnected) o.focus({ preventScroll: true });
}
draftText.addEventListener('input', () => { if (!S.draft) return; const k = dkey(S.draft.id); if (draftText.value === '') S.drafts.delete(k); else S.drafts.set(k, draftText.value); syncDraftBtns(); $('#draftStatus').textContent = ''; });
$('#draftPreviewBtn').addEventListener('click', () => { if (!draftText.value.trim()) return; const p = $('#draftPreview'); p.textContent = draftPreviewText(); p.hidden = false; });
$('#draftCopyBtn').addEventListener('click', async () => {
  if (!draftText.value.trim()) return;
  try { await navigator.clipboard.writeText(draftPreviewText()); $('#draftStatus').textContent = '복사했습니다 · 보내지는 않았습니다'; }
  catch { $('#draftStatus').textContent = '이 브라우저에서 복사할 수 없습니다. 미리보기에서 직접 선택해 복사하세요.'; }
});
$('#draftClose').addEventListener('click', () => closeDraft());

/* ---------- 사례 전환 ---------- */
function saveView() { if (S.cur < 0 || !V) return; V.sl = ms.scrollLeft; V.st = ms.scrollTop; V.mainSt = main.scrollTop; V.panelSt = panel.scrollTop; }
function defaultView(fx) { const d = {}; for (const id of indexCase(fx).roots) d[id] = 0; for (const g of ((fx.initialView || {}).expanded || [])) d[g] = 1; return { depth: d, scale: 1, sl: 0, st: 0, mainSt: 0, panelSt: 0, sel: null }; }
function showCase(i) {
  closeDraft(false); closeRef(false); saveView();
  S.cur = i; const cs = S.cases[i]; sel.value = String(i);
  if (!cs.ok) {
    C = null; V = null; head.innerHTML = `<h1>${esc((cs.fx && cs.fx.title) || cs.file)}</h1>`; legend.innerHTML = '';
    for (const el of [...world.children]) if (el !== svg) el.remove(); svg.innerHTML = ''; sizer.style.width = sizer.style.height = '0px';
    errBox.hidden = false; errBox.innerHTML = `<h2>이 입력을 표시할 수 없습니다</h2><p class="muted">${esc(cs.file)} · 자동으로 고치지 않습니다.</p><ul>${cs.errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul>`;
    panel.innerHTML = '<div class="pk">선택 설명</div><h2 tabindex="-1">입력 오류</h2><p class="muted">입력 검사에서 오류가 있어 지도를 그리지 않았습니다.</p>';
    return;
  }
  errBox.hidden = true; errBox.innerHTML = '';
  C = cs.ix; const k = caseKey(i); if (!S.views[k]) S.views[k] = defaultView(cs.fx); V = S.views[k];
  renderHead(); buildMap(); applyLayout(); applyDepth(); applyScale();
  ms.scrollLeft = V.sl; ms.scrollTop = V.st; main.scrollTop = V.mainSt;
  renderPanel(); panel.scrollTop = V.panelSt; drawEdges();
}

/* ---------- 이벤트 ---------- */
world.addEventListener('click', e => {
  const tog = e.target.closest('[data-tog]'); if (tog) { const g = tog.dataset.tog; V.depth[g] = V.depth[g] ? 0 : 1; closeRef(false); applyDepth(); renderPanel(); return; }
  const s = e.target.closest('[data-sel]'); if (s) select({ t: 'node', id: s.dataset.sel });
});
svg.addEventListener('click', e => { const g = e.target.closest('g[data-k]'); if (!g) return; const ids = g.dataset.rels.split(' '); select(ids.length === 1 ? { t: 'rel', id: ids[0] } : { t: 'bundle', ids }); });
head.addEventListener('click', e => { const b = e.target.closest('[data-goto]'); if (b) selectNode(b.dataset.goto, true); });
panel.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.xref) { b.getAttribute('aria-expanded') === 'true' ? closeRef() : openXref(b); }
  else if (b.dataset.act === 'ref-close') closeRef();
  else if (b.dataset.act === 'detail') { b.getAttribute('aria-expanded') === 'true' ? closeRef() : openDetail(b); }
  else if (b.dataset.act === 'draft') openDraft(b);
  else if (b.dataset.rel) select({ t: 'rel', id: b.dataset.rel }, true);
  else if (b.dataset.goto) selectNode(b.dataset.goto, true);
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (S.draft) { e.preventDefault(); closeDraft(); }
  else if (S.xref || S.detail) { e.preventDefault(); closeRef(); }
});
sel.addEventListener('change', () => showCase(Number(sel.value)));
$('#zIn').addEventListener('click', () => zoom(1));
$('#zOut').addEventListener('click', () => zoom(-1));
matchMedia('(max-width:700px)').addEventListener('change', () => { if (C) { applyLayout(); applyDepth(); } });
new ResizeObserver(() => { if (C) { syncSize(); drawEdges(); } }).observe(world);

/* ---------- 시작: 입력 목록 읽기 ---------- */
async function start() {
  const q = new URLSearchParams(location.search).get('fixtures');
  const files = (q || app.dataset.fixtures).split(',').map(s => s.trim()).filter(Boolean);
  for (const f of files) {
    let fx = null, errors = [];
    try { const r = await fetch(f, { cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status); fx = await r.json(); }
    catch (err) { errors = [`입력을 읽지 못했습니다: ${err.message}`]; }
    if (fx) errors = validate(fx);
    S.cases.push({ file: f, fx, ok: !errors.length, errors, ix: errors.length ? null : indexCase(fx) });
  }
  sel.innerHTML = S.cases.map((c, i) => `<option value="${i}">${esc((c.fx && c.fx.title) || c.file)}${c.ok ? '' : ' · 입력 오류'}</option>`).join('');
  showCase(0);
  if (document.fonts) document.fonts.ready.then(() => C && drawEdges());
  app.dataset.ready = '1';
}
start();
})();
