/* The same small request/return reading in the plan and beside a current part. No second status model. */
import { isMapReading, type Project } from '../shared/types.js';
import { requestMatches, itemReading, recordTexts, matchGroup, MATCH_LABEL, ITEM_STATE_LABEL, type FrozenRequest, type EffectiveMatch, type RequestTarget, type StoredRequestMatch } from '../shared/request-return.js';
import { EVIDENCE_KIND_LABEL, NOT_EXECUTED, NOT_RECORDED } from '../shared/record-source.js';
import { h, fullTime, quotedText } from './plan-dom.js';

/** A passage's label: what kind of material it is, and for a change report what it says of the change (stored before stances:
 * the kind alone, never read as made). */
export function matchLabel(m: StoredRequestMatch): string {
  if (m.kind === 'reported' || m.kind === 'code') return m.stance === 'made' ? `${MATCH_LABEL[m.kind]} · 변경` : m.stance === 'not-made' ? `${MATCH_LABEL[m.kind]} · 미구현` : MATCH_LABEL[m.kind];
  return MATCH_LABEL[m.kind];
}
/** Shorten only a pure full SHA, for display. The stored wording and title stay exact. */
export const displayAbout = (about: string) => /^[a-f0-9]{40}$/i.test(about) ? about.slice(0, 8) : about;
/** Only reading position, never a copy of the request or its reported contents. Exact frozen identities keep a later
 * request (even with the same title/item id) from inheriting another one's disclosure or keyboard position. */
export interface RequestReading {
  items: { key: string; open: boolean }[];
  /** Each item's folded history of withdrawn reports, by that same exact item identity: whether it was open. */
  histories: { key: string; open: boolean }[];
  /** The folded excluded and unrelated passages (one each per reading surface): whether they were open. */
  folds?: { key: string; open: boolean }[];
  item: string | null;
  focus: string | null;
}
export function captureRequestReading(body: Element): RequestReading {
  const active = body.contains(document.activeElement) ? document.activeElement as HTMLElement : null;
  return {
    items: [...body.querySelectorAll<HTMLDetailsElement>('details[data-request-item]')].map(d => ({ key: d.dataset.requestItem!, open: d.open })),
    histories: [...body.querySelectorAll<HTMLDetailsElement>('details[data-request-history]')].map(d => ({ key: d.dataset.requestHistory!, open: d.open })),
    folds: [...body.querySelectorAll<HTMLDetailsElement>('details[data-request-fold]')].map(d => ({ key: d.dataset.requestFold!, open: d.open })),
    item: active?.closest<HTMLElement>('[data-request-item]')?.dataset.requestItem ?? null,
    focus: active?.dataset.requestFocus ?? null
  };
}
/** Apply to freshly rendered data. If the item being read no longer exists, leave the new reading at its own start. */
export function restoreRequestReading(body: Element, saved: RequestReading): boolean {
  const items = [...body.querySelectorAll<HTMLDetailsElement>('details[data-request-item]')];
  const by = new Map(items.map(d => [d.dataset.requestItem!, d]));
  if (saved.item && !by.has(saved.item)) return false;
  if (saved.items.length && !saved.items.some(d => by.has(d.key))) return false;
  for (const d of saved.items) { const current = by.get(d.key); if (current) current.open = d.open; }
  // A history fold opens again only where the fresh data still has one for that very item (never another request's or part's);
  // what it holds is the current data, and the quote being read is focused inside it.
  const histories = new Map([...body.querySelectorAll<HTMLDetailsElement>('details[data-request-history]')].map(d => [d.dataset.requestHistory!, d]));
  for (const d of saved.histories ?? []) { const current = histories.get(d.key); if (current) current.open = d.open; }
  // The excluded and unrelated folds hold passages outside any item: their quote buttons are focused inside them too.
  const folds = new Map([...body.querySelectorAll<HTMLDetailsElement>('details[data-request-fold]')].map(d => [d.dataset.requestFold!, d]));
  for (const d of saved.folds ?? []) { const current = folds.get(d.key); if (current) current.open = d.open; }
  const focus = saved.focus && [...body.querySelectorAll<HTMLElement>('[data-request-focus]')].find(e => e.dataset.requestFocus === saved.focus);
  (focus || (saved.item ? by.get(saved.item)?.querySelector<HTMLElement>('summary') : null))?.focus({ preventScroll: true });
  return true;
}
export function frozenRequests(project: Project, scopes: FrozenRequest[] = []): FrozenRequest[] {
  const by = new Map<string, FrozenRequest>();
  for (const r of project.readings) if (isMapReading(r)) for (const q of r.requests ?? []) by.set(q.id, q);
  for (const q of scopes) by.set(q.id, q);
  return [...by.values()];
}
export function requestResults(project: Project, scopes: FrozenRequest[], options: {
  partId?: string; requestId?: string; compact?: boolean;
  correct(reading: string, index: number, target: RequestTarget | null): Promise<string | null>;
  /** Undo a withdrawal link (the person's own act); absent where it cannot be saved. */
  unlink?(reading: string, index: number): Promise<string | null>;
  /** from: where the passage stands in its record (the stored interval), so a repeated sentence is marked where it was read. */
  quote?(record: string, quote: string, from?: number): void;
  /** Read this exact request (and item) in the wide reading; the opener is where the way back returns. */
  wide?(at: WideAt, opener: HTMLElement): void;
}): HTMLElement | null {
  const all = frozenRequests(project, scopes), requests = all.filter(q => (!options.requestId || q.id === options.requestId) && (!options.partId || q.items.some(i => i.partIds.includes(options.partId!))));
  if (!requests.length) return null;
  const matches = requestMatches(project), sec = h('section', { class: 'sec request-results', 'aria-label': '원한 것과 돌아온 범위' }, h('h3', {}, '원한 것과 돌아온 범위'));
  const caption = (q: FrozenRequest) => requestCaption(all, q);
  // Every quote button has its exact place: the item's identity, or the fold a passage outside any item reads in (ambiguous,
  // excluded, unrelated), then the stored reading, index and interval.
  const source = (m: EffectiveMatch, scope: string) => {
    if (options.quote) return h('button', { type: 'button', class: 'cl-cite', 'data-request-focus': JSON.stringify([scope, m.reading, m.index, m.match.record, m.match.from, m.match.to]), title: m.match.quote, onclick: () => options.quote!(m.match.record, m.match.quote, m.match.from) }, '근거');
    // The record as read, where every match stands (an earlier reading's places against the labelled text are read shifted).
    const text = recordTexts(project).get(m.match.record)?.read ?? '';
    const details = h('details', { class: 'request-quote' }, h('summary', {}, '근거 원문'), h('pre', {}, ...quotedText(text, m.match.quote, { at: m.match.from, length: m.match.to - m.match.from })));
    details.addEventListener('toggle', () => { if (details.open) requestAnimationFrame(() => details.querySelector('mark')?.scrollIntoView({ block: 'nearest' })); });
    return details;
  };
  const correction = (x: EffectiveMatch) => {
    const box = h('details', { class: 'request-fix' }, h('summary', {}, x.excluded ? '대응에서 제외함 · 다시 고치기' : '대응 고치기'));
    const select = h('select', { 'aria-label': '이 구절이 답하는 요청 항목' }) as HTMLSelectElement;
    select.append(h('option', { value: '' }, '요청 대응에서 제외'));
    const targets: RequestTarget[] = [];
    for (const q of x.requests) for (const item of q.items) {
      const target = { requestId: q.id, itemId: item.id }, value = String(targets.push(target));
      select.append(h('option', { value, selected: !!x.target && x.target.requestId === q.id && x.target.itemId === item.id }, `${item.title} · ${caption(q)}`));
    }
    const msg = h('span', { role: 'status', class: 'form-msg' }), button = h('button', { type: 'button', class: 'link-button', onclick: async () => {
      (button as HTMLButtonElement).disabled = true;
      const error = await options.correct(x.reading, x.index, select.value ? targets[Number(select.value) - 1]! : null);
      if (error) { msg.textContent = error; (button as HTMLButtonElement).disabled = false; }
    } }, '저장');
    box.append(select, button, msg); return box;
  };
  const passage = (x: EffectiveMatch, scope: string) => h('div', { class: 'request-passage' },
    h('p', {}, h('span', { class: 'cl-kind' }, matchLabel(x.match)), x.match.text,
      x.match.about ? h('small', { class: 'cl-about', title: x.match.about }, ` · ${displayAbout(x.match.about)}`) : null,
      x.replaces ? h('small', { class: 'cl-replaces' }, ' · 앞 보고를 철회·정정') : null),
    source(x, scope), correction(x));
  // An earlier report a later record took back: its words and source stay, with the passage that took it back and the one way
  // to undo that link. Excluding or retargeting either passage never brings it back.
  const withdrawn = (x: EffectiveMatch, itemKey: string) => {
    const by = x.replacedBy!, box = h('div', { class: 'request-passage request-withdrawn' },
      h('p', {}, h('span', { class: 'cl-kind' }, matchLabel(x.match)), x.match.text, x.match.about ? h('small', { class: 'cl-about', title: x.match.about }, ` · ${displayAbout(x.match.about)}`) : null),
      source(x, itemKey), h('p', { class: 'fine' }, `이후 원문이 이 보고를 철회·정정했어요: ${by.match.text}`));
    if (options.unlink) {
      const msg = h('span', { role: 'status', class: 'form-msg' }), b = h('button', { type: 'button', class: 'link-button', title: '이 연결이 잘못이면 앞 보고를 다시 현재 근거로 읽어요. 원문은 그대로예요.', onclick: async () => {
        (b as HTMLButtonElement).disabled = true; const error = await options.unlink!(by.reading, by.index);
        if (error) { msg.textContent = error; (b as HTMLButtonElement).disabled = false; }
      } }, '철회 연결 풀기');
      box.append(b, msg);
    }
    return box;
  };
  const belongs = (target: RequestTarget, scopes = all) => requests.some(q => q.id === target.requestId) && (!options.partId || !!scopes.find(q => q.id === target.requestId)?.items.some(i => i.id === target.itemId && i.partIds.includes(options.partId!)));
  const hasReport = (q: FrozenRequest) => matches.some(x => !x.excluded && !x.replacedBy && x.target?.requestId === q.id && belongs(x.target, x.requests) && x.match.kind !== 'open');
  const ordered = requests.slice().reverse().sort((a, b) => Number(hasReport(b)) - Number(hasReport(a)));
  // The wide reading of this very request (its id, plan and revision), at its item or at its first; its key brings focus back.
  const wide = (q: FrozenRequest, itemId: string | null, label: string) => options.wide ? h('button', { type: 'button', class: `request-wide${itemId ? ' item' : ''}`,
    'data-request-focus': JSON.stringify(['wide', q.id, q.planId, q.planRevision, itemId]), title: '원한 것과 돌아온 근거를 넓은 화면에서 읽어요. 원문도 그 안에서 열어요.',
    onclick: (e: Event) => options.wide!({ requestId: q.id, planId: q.planId, planRevision: q.planRevision, itemId }, e.currentTarget as HTMLElement) }, label) : null;
  for (const q of ordered) {
    const group = h('div', { class: 'request-group' }, h('p', { class: 'request-at', title: `${q.id} · ${q.planId} / ${q.planRevision}` }, h('span', {}, caption(q)), wide(q, null, '넓게 읽기')));
    for (const item of q.items.filter(i => !options.partId || i.partIds.includes(options.partId))) {
      // The same reading the map title counts (itemReading): the current lead, then the passages that stand, then history apart.
      const { state, lead, current, history } = itemReading(matches, { requestId: q.id, itemId: item.id });
      const itemKey = JSON.stringify([q.id, q.planId, q.planRevision, item.id]);
      const detail = h('details', { class: `request-item${current.length ? ' has' : ''} st-${state}`, 'data-request-item': itemKey, open: !options.compact },
        h('summary', { 'data-request-focus': itemKey }, item.title, h('small', {}, lead ? ` · ${ITEM_STATE_LABEL[state]} · ${lead.match.text.slice(0, 90)}` : history.length ? ` · ${ITEM_STATE_LABEL[state]}` : ' · 연결된 원문 구절 없음')),
        h('p', { class: 'request-want' }, h('span', { class: 'cl-kind' }, '원함'), item.description), options.wide ? h('p', { class: 'request-wide-row' }, wide(q, item.id, '이 항목 넓게 읽기')) : null);
      if (current.length) [...(lead ? [lead] : []), ...current.filter(x => x !== lead)].forEach(x => detail.append(passage(x, itemKey)));
      else detail.append(h('p', { class: 'request-remains' }, history.length ? '지금 서 있는 대응은 없어요. 앞 보고는 이후 원문이 철회했어요.' : '이 요청 항목에 연결된 프로젝트 원문 구절이 아직 없어요.'));
      if (history.length) detail.append(h('details', { class: 'request-history', 'data-request-history': itemKey }, h('summary', {}, `철회·정정된 앞 보고 ${history.length}개`), ...history.map(x => withdrawn(x, itemKey))));
      group.append(detail);
    }
    sec.append(group);
  }
  const ids = new Set(requests.map(q => q.id));
  for (const x of matches.filter(x => !x.excluded && !x.replacedBy && !x.target && x.match.targets.length > 0 && x.match.targets.some(t => belongs(t, x.requests)))) {
    const pending = h('div', { class: 'request-ambiguous' }, h('p', {}, x.match.targets.length > 1 ? '어느 요청의 결과인지 남아 있어요' : '요청과의 대응이 아직 분명하지 않아요'), h('p', {}, x.match.text), h('p', { class: 'fine' }, x.match.why), source(x, 'ambiguous'));
    if (x.prior) {
      const original = all.find(q => q.id === x.prior!.target.requestId), item = original?.items.find(i => i.id === x.prior!.target.itemId);
      pending.append(h('p', { class: 'fine' }, `이 구절은 앞서 ${original ? caption(original) : '다른 요청'}의 ‘${item?.title ?? '항목'}’으로 바로잡았어요. 원래 대응은 유지하고 이번 대조는 미정으로 남겼어요.`));
    }
    if (x.match.targets.length > 1 || x.prior) for (const t of x.match.targets) {
      const q = x.requests.find(q => q.id === t.requestId)!, item = q.items.find(i => i.id === t.itemId)!;
      const b = h('button', { type: 'button', class: 'link-button', title: `${q.id} · ${item.description}`, onclick: async () => {
        (b as HTMLButtonElement).disabled = true; const error = await options.correct(x.reading, x.index, t);
        if (error) { (b as HTMLButtonElement).disabled = false; pending.append(h('p', { role: 'alert' }, error)); }
      } }, `${item.title} · ${caption(q)}`); pending.append(b);
    }
    pending.append(correction(x)); sec.append(pending);
  }
  const excluded = matches.filter(x => x.excluded && x.match.targets.some(t => belongs(t, x.requests)));
  if (excluded.length) sec.append(h('details', { class: 'request-excluded', 'data-request-fold': 'excluded' }, h('summary', {}, `제외한 대응 ${excluded.length}개`), ...excluded.map(x => passage(x, 'excluded'))));
  if (!options.partId) {
    const unrelated = matches.filter(x => !x.excluded && !x.replacedBy && !x.target && !x.match.targets.length && x.requests.some(q => ids.has(q.id)));
    if (unrelated.length) sec.append(h('details', { class: 'request-unrelated', 'data-request-fold': 'unrelated' }, h('summary', {}, `요청에 대응하지 않은 구절 ${unrelated.length}개`), ...unrelated.map(x => h('div', { class: 'request-passage' }, h('p', {}, x.match.text), source(x, 'unrelated')))));
  }
  return sec;
}
/** A request as the reading names it: its place among the project's frozen requests, when it was made and the plan revision. */
export const requestCaption = (all: FrozenRequest[], q: FrozenRequest) => `요청 ${all.findIndex(r => r.id === q.id) + 1} · ${fullTime(q.createdAt)} · 판 ${q.planRevision}`;
/** The exact request (its frozen id, plan and revision) and item a wide reading opens on; null item: the request's first. */
export interface WideAt { requestId: string; planId: string; planRevision: number; itemId: string | null }

/* ---------- the wide reading ----------
 * The same stored correspondence as the narrow list (requestMatches, itemReading), read over the whole window: the request's
 * items on the left, the chosen item's wish, its current lead and every passage that stands (kind, stance, its condition or
 * scope as stored, the exact quote) at a paragraph's width, the withdrawn history apart, and the passages outside any item
 * (ambiguous, excluded, unrelated) as their own sections. A passage's original opens in the same place, marked where it was
 * read; coming back finds the same section, fold, scroll and button. Reading writes nothing: no project, plan or request.
 * Closing goes back to where it was opened from (the map's return pane, a part, the change plan's results), to the same opener,
 * or (re-rendered meanwhile) to the same request items, folds, scroll and button by their identities. Another project or
 * address meanwhile: it simply closes, never restoring into what is read now. */
export interface WideHost { current(): { key: string; project: Project } | null }
export interface WideOpen extends WideAt {
  /** The requests the opener reads (the plan's frozen scopes): the same set the narrow list was made from. */
  scopes: FrozenRequest[];
  /** Where closing returns, named: '돌아와 읽기', a part's name, '변경 구상'. */
  label: string;
}
/** surface: which reading the opener's pane held (its kind and title), so a pane that shows something else since is never restored. */
interface WideOrigin { entry: string; label: string; opener: HTMLElement; selector: string | null; surface: string; scroll: number; reading: RequestReading | null; focus: string | null }
interface WideState {
  entry: string; scopes: FrozenRequest[]; request: { id: string; planId: string; planRevision: number };
  /** item:<id>, or a fold outside the items: ambiguous, excluded, unrelated. */
  section: string;
  /** The original being read in place of the section, by its passage's exact key; back: the section's scroll and button. */
  source: { key: string; reading: string; index: number } | null; back: { scroll: number; focus: string | null } | null;
  /** History folds left open, by section. */
  open: Set<string>;
  origin: WideOrigin;
  /** The control last focused in the dialog (by its identity), restored on every render, also after the page moved focus. */
  focus: string | null;
  /** What the stored correspondence of this request was at the last render; a change while open is said (notice). */
  sig: { request: string; value: string } | null; notice: string | null;
}
/** The pane holding an opener: its id, the kind of reading it shows and its title. */
const surfaceOf = (pane: HTMLElement | null) => !pane ? '' : JSON.stringify([pane.id, ['return-read', 'compare', 'scope-read', 'work'].filter(c => pane.classList.contains(c)), pane.dataset.rail ?? '',
  pane.querySelector('#lens-title, #panel-title, #plan-title')?.textContent ?? '']);
const SCROLLERS = ['lens-body', 'panel-body', 'pw-rail-body', 'pp-body'];
const GROUP_TITLE: Record<string, string> = { ambiguous: '대응이 정해지지 않은 구절', excluded: '대응에서 제외한 구절', unrelated: '요청에 대응하지 않은 구절' };
export function createWideReading(host: WideHost) {
  let st: WideState | null = null;
  const el = () => {
    let d = document.getElementById('request-wide');
    if (!d) {
      d = h('div', { id: 'request-wide', class: 'rw', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'rw-title', tabindex: '-1', hidden: true });
      d.addEventListener('keydown', keys); document.body.append(d);
      d.addEventListener('focusin', e => { const t = e.target as HTMLElement; if (st) st.focus = t.dataset.rwFocus ? `f:${t.dataset.rwFocus}` : t.dataset.rwSection ? `s:${t.dataset.rwSection}` : t.dataset.rwPart ? `p:${t.dataset.rwPart}` : st.focus; });
    }
    return d;
  };
  function keys(e: KeyboardEvent) {
    if (!st) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); escape(); return; }
    if (e.key !== 'Tab') return;
    // A modal reading: Tab stays inside it.
    const d = el(), all = [...d.querySelectorAll<HTMLElement>('button:not([disabled]), select, summary, [tabindex="0"]')].filter(x => x.offsetParent !== null);
    if (!all.length) return;
    const first = all[0]!, last = all.at(-1)!;
    if (e.shiftKey && (document.activeElement === first || document.activeElement === d)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function open(at: WideOpen, opener: HTMLElement) {
    const o = host.current(); if (!o) return;
    const all = frozenRequests(o.project, at.scopes), q = all.find(r => r.id === at.requestId && r.planId === at.planId && r.planRevision === at.planRevision);
    if (!q) return;
    // Where the opener reads: its scrolling body, by the pane that holds it (found again after a re-render).
    const box = opener.closest<HTMLElement>(SCROLLERS.map(c => `.${c}`).join(',')), pane = box?.closest<HTMLElement>('[id]');
    const cls = box ? SCROLLERS.find(c => box.classList.contains(c))! : null;
    const origin: WideOrigin = { entry: o.key, label: at.label, opener, selector: box && pane && cls ? `#${CSS.escape(pane.id)} .${cls}` : null, surface: surfaceOf(pane ?? null), scroll: box?.scrollTop ?? 0,
      reading: box ? { ...captureRequestReading(box), focus: opener.dataset.requestFocus ?? null } : null, focus: opener.dataset.requestFocus ?? null };
    const item = at.itemId && q.items.some(i => i.id === at.itemId) ? at.itemId : firstItem(o.project, q);
    st = { entry: o.key, scopes: at.scopes, request: { id: q.id, planId: q.planId, planRevision: q.planRevision }, section: item ? `item:${item}` : 'ambiguous', source: null, back: null, open: new Set(), origin, focus: null, sig: null, notice: null };
    render();
    el().querySelector<HTMLElement>('.rw-pick[aria-current="true"]')?.focus({ preventScroll: true });
  }
  /** The first item with a passage standing (as the narrow list reads them), else the first. */
  function firstItem(p: Project, q: FrozenRequest): string | null {
    const m = requestMatches(p);
    return (q.items.find(i => itemReading(m, { requestId: q.id, itemId: i.id }).current.length) ?? q.items[0])?.id ?? null;
  }
  /** The place it was opened from, as it is now: the opener itself, or the same pane showing the same reading (re-rendered); null
   * when that reading is gone (the pane closed or shows another one). */
  function originNow(o: WideOrigin): { opener: HTMLElement } | { box: HTMLElement } | null {
    if (host.current()?.key !== o.entry) return null;
    if (o.opener.isConnected && o.opener.offsetParent !== null) return { opener: o.opener };
    const box = o.selector ? document.querySelector<HTMLElement>(o.selector) : null, pane = box?.closest<HTMLElement>('[id]') ?? null;
    return box && pane && !pane.hidden && surfaceOf(pane) === o.surface ? { box } : null;
  }
  /** Close and go back to where it was opened from; when that place is gone, to the map (nothing restored into another reading). */
  function close() {
    if (!st) return;
    const o = st.origin, at = originNow(o); st = null; const d = el(); d.hidden = true; d.replaceChildren();
    if (host.current()?.key !== o.entry) return;
    if (!at) { document.getElementById('viewport')?.focus({ preventScroll: true }); return; }
    if ('opener' in at) { at.opener.focus({ preventScroll: true }); return; }
    // The place re-rendered meanwhile (fresh data): the same request items, folds, scroll and button by their identities.
    const box = at.box;
    if (!o.reading || restoreRequestReading(box, o.reading)) box.scrollTop = o.scroll;
    [...box.querySelectorAll<HTMLElement>('[data-request-focus]')].find(x => x.dataset.requestFocus === o.focus)?.focus({ preventScroll: true });
  }
  /** Another address or project: close without restoring anything into what is read now. */
  function drop() { if (!st) return; st = null; const d = el(); d.hidden = true; d.replaceChildren(); }
  function escape() { if (!st) return; if (st.source) back(); else close(); }
  function back() {
    if (!st || !st.source) return;
    const b = st.back; st.source = null; st.back = null; render();
    const main = el().querySelector<HTMLElement>('.rw-main'); if (main && b) main.scrollTop = b.scroll;
    if (b?.focus) focusKey(`f:${b.focus}`);
  }
  /** Focus a control by its identity; one inside a fold closed meanwhile (a passage withdrawn while it was read) opens the fold. */
  function focusKey(key: string): boolean {
    const at = key.indexOf(':'), kind = key.slice(0, at), id = key.slice(at + 1);
    const [attr, data] = kind === 'f' ? ['data-rw-focus', 'rwFocus'] : kind === 's' ? ['data-rw-section', 'rwSection'] : ['data-rw-part', 'rwPart'];
    const x = [...el().querySelectorAll<HTMLElement>(`[${attr}]`)].find(e => e.dataset[data!] === id);
    if (!x) return false;
    const fold = x.closest<HTMLDetailsElement>('details'); if (fold && !fold.open && x.tagName !== 'SUMMARY') fold.open = true;
    x.focus({ preventScroll: true }); if (st) st.focus = key; return true;
  }
  function pick(section: string) {
    if (!st) return;
    st.section = section; st.source = null; st.back = null; render();
    const main = el().querySelector<HTMLElement>('.rw-main'); if (main) main.scrollTop = 0;
    [...el().querySelectorAll<HTMLElement>('.rw-pick')].find(x => x.dataset.rwSection === section)?.focus({ preventScroll: true });
  }
  function render() {
    if (!st) return;
    const o = host.current(); if (!o || o.key !== st.entry) { drop(); return; }
    const all = frozenRequests(o.project, st.scopes), q = all.find(r => r.id === st!.request.id && r.planId === st!.request.planId && r.planRevision === st!.request.planRevision);
    if (!q) { close(); return; }
    const s = st, d = el(), matches = requestMatches(o.project), texts = recordTexts(o.project);
    // Saved while it was open (a later map reading of this visit, a correction being saved): read again from the data as it is now,
    // and said so. The same section, fold, button and scroll are kept by identity.
    const reqKey = JSON.stringify([q.id, q.planId, q.planRevision]);
    const sig = JSON.stringify(matches.filter(x => x.requests.some(r => r.id === q.id) || x.match.targets.some(t => t.requestId === q.id)).map(x => [x.reading, x.index, x.excluded,
      x.replacedBy ? [x.replacedBy.reading, x.replacedBy.index] : null, x.target ? [x.target.requestId, x.target.itemId] : null]));
    if (s.sig && s.sig.request === reqKey && s.sig.value !== sig) s.notice = '읽는 동안 이 프로젝트에 새 읽기나 대응 정정이 저장되어 지금 저장된 내용으로 다시 읽었어요. 앞에 읽던 구절이 철회되었거나 다른 자리로 옮겨졌을 수 있어요.';
    s.sig = { request: reqKey, value: sig };
    const alive = !!originNow(s.origin);
    const items = q.items.map((item, n) => ({ item, n, key: `item:${item.id}`, r: itemReading(matches, { requestId: q.id, itemId: item.id }) }));
    const groups: { key: string; list: EffectiveMatch[] }[] = [
      { key: 'ambiguous', list: matches.filter(x => !x.excluded && !x.replacedBy && !x.target && x.match.targets.some(t => t.requestId === q.id)) },
      { key: 'excluded', list: matches.filter(x => x.excluded && x.match.targets.some(t => t.requestId === q.id)) },
      { key: 'unrelated', list: matches.filter(x => !x.excluded && !x.replacedBy && !x.target && !x.match.targets.length && x.requests.some(r => r.id === q.id)) }].filter(g => g.list.length);
    if (!items.some(x => x.key === s.section) && !groups.some(g => g.key === s.section)) { s.section = items[0]?.key ?? groups[0]?.key ?? ''; s.source = null; }
    const record = (id: string) => {
      const kept = o.project.pasted.find(x => x.id === id) ?? null, e = kept?.evidence ?? null;
      const first = (texts.get(id)?.read ?? '').split('\n').find(l => l.trim())?.trim() ?? '';
      return { kept, e, name: e ? `${EVIDENCE_KIND_LABEL[e.kind]} · ${e.name}` : kept ? `붙인 기록 · ${first.slice(0, 60)}${first.length > 60 ? '…' : ''}` : `프로젝트 기록 · ${first.slice(0, 60)}` };
    };
    const target = (t: RequestTarget, x: EffectiveMatch) => { const r = x.requests.find(r => r.id === t.requestId) ?? all.find(r => r.id === t.requestId), i = r?.items.find(i => i.id === t.itemId);
      return `${i?.title ?? t.itemId} · ${r ? requestCaption(all, r) : '다른 요청'}`; };
    const keyOf = (scope: string, x: EffectiveMatch) => JSON.stringify([scope, x.reading, x.index, x.match.record, x.match.from, x.match.to]);
    const tag = (t: string, c = '') => h('span', { class: `rw-tag${c ? ` ${c}` : ''}` }, t);
    /** One passage, whole: what kind of material and what it says of the change, its words, its condition as stored, its quote. */
    const card = (x: EffectiveMatch, scope: string, lead = false, ...extra: (Node | null)[]) => {
      const key = keyOf(scope, x), r = record(x.match.record);
      return h('article', { class: `rw-card g-${matchGroup(x.match.kind)}${lead ? ' lead' : ''}${x.replacedBy ? ' withdrawn' : ''}` },
        h('p', { class: 'rw-card-k' }, h('span', { class: 'rw-kind' }, matchLabel(x.match)), x.replaces ? tag('앞 보고를 철회·정정') : null,
          x.corrected ? tag('직접 고친 대응') : null, x.excluded ? tag('대응에서 제외함') : null, x.replacedBy ? tag('이후 철회·정정됨', 'off') : null),
        h('p', { class: 'rw-card-text' }, x.match.text),
        x.match.about ? h('p', { class: 'rw-cond' }, h('span', {}, '범위·조건'), h('span', {}, x.match.about)) : null,
        h('blockquote', { class: 'rw-q' }, x.match.quote), ...extra,
        h('p', { class: 'rw-card-foot' }, h('button', { type: 'button', class: 'rw-src', 'data-rw-focus': key, onclick: () => openSource(x, key) }, '근거 원문 열기'),
          h('span', { class: 'rw-where', title: r.name }, r.name)));
    };
    // The sentence the request was made from, whole on request (the request's own words; never summarised here).
    const said = h('details', { class: 'rw-said', open: s.open.has('said') }, h('summary', { 'data-rw-part': 'said' }, '요청할 때 적은 문장'), h('p', {}, q.intent));
    said.addEventListener('toggle', () => { if (said.open) s.open.add('said'); else s.open.delete('said'); });
    const nav = h('nav', { class: 'rw-nav', 'aria-label': '원한 항목과 구절 묶음' }, q.intent ? said : null,
      h('h3', {}, `원한 항목 ${items.length}`),
      h('ul', {}, ...items.map(({ item, key, r }) => {
        const kinds = new Map<string, number>(); for (const x of r.current) kinds.set(matchLabel(x.match), (kinds.get(matchLabel(x.match)) ?? 0) + 1);
        const counts = [...kinds].map(([k, n]) => `${k} ${n}`).concat(r.history.length ? [`철회·정정 ${r.history.length}`] : []).join(' · ');
        return h('li', {}, h('button', { type: 'button', class: `rw-pick st-${r.state}`, 'data-rw-section': key, 'aria-current': String(key === s.section), onclick: () => pick(key) },
          h('span', { class: 'rw-pick-title' }, item.title),
          h('span', { class: 'rw-pick-state' }, r.lead || r.history.length ? ITEM_STATE_LABEL[r.state] : '연결된 원문 구절 없음'),
          counts ? h('span', { class: 'rw-pick-counts' }, counts) : null));
      })),
      groups.length ? h('h3', {}, '항목 밖의 구절') : null,
      groups.length ? h('ul', {}, ...groups.map(g => h('li', {}, h('button', { type: 'button', class: 'rw-pick', 'data-rw-section': g.key, 'aria-current': String(g.key === s.section), onclick: () => pick(g.key) },
        h('span', { class: 'rw-pick-title' }, GROUP_TITLE[g.key]!), h('span', { class: 'rw-pick-counts' }, `${g.list.length}개`))))) : null);
    const main = h('div', { class: 'rw-main', tabindex: '-1' });
    const it = items.find(x => x.key === s.section), group = groups.find(g => g.key === s.section);
    const found = s.source ? matches.find(x => x.reading === s.source!.reading && x.index === s.source!.index) : null;
    if (s.source && !found) { s.source = null; s.back = null; }
    if (s.source && found) main.append(...sourceView(found, record, texts.get(found.match.record)?.read ?? null, it ? it.item.title : GROUP_TITLE[s.section] ?? '목록'));
    else if (it) {
      const { item, n, r } = it, itemKey = JSON.stringify([q.id, q.planId, q.planRevision, item.id]);
      const rest = r.current.filter(x => x !== r.lead), fold = `history:${itemKey}`;
      const hist = r.history.length ? h('details', { class: 'rw-history', open: s.open.has(fold) }, h('summary', { 'data-rw-part': `history:${item.id}` }, `철회·정정된 앞 보고 ${r.history.length}개`),
        h('p', { class: 'fine' }, '이후 원문이 거둬들인 보고예요. 원래 말과 근거는 그대로 남아요.'),
        ...r.history.map(x => card(x, itemKey, false, h('p', { class: 'rw-by' }, h('span', {}, '철회·정정한 구절'), x.replacedBy!.match.text)))) : null;
      hist?.addEventListener('toggle', () => { if (hist.open) s.open.add(fold); else s.open.delete(fold); });
      main.append(h('article', { class: 'rw-item', 'aria-labelledby': 'rw-item-title' },
        h('p', { class: 'rw-kick' }, `원한 항목 ${n + 1}/${items.length}`, r.lead || r.history.length ? h('span', { class: `rw-state st-${r.state}` }, ITEM_STATE_LABEL[r.state]) : null),
        h('h3', { id: 'rw-item-title' }, item.title),
        h('section', { class: 'rw-want' }, h('h4', {}, '원한 것'), h('p', {}, item.description)),
        r.lead ? h('section', { class: 'rw-sec' }, h('h4', {}, '지금 앞에 읽는 구절', h('small', {}, '이 항목의 현재 대표 · 완료 표시 아님')), card(r.lead, itemKey, true)) : null,
        rest.length ? h('section', { class: 'rw-sec' }, h('h4', {}, `함께 서 있는 구절 ${rest.length}`), ...rest.map(x => card(x, itemKey))) : null,
        !r.current.length ? h('p', { class: 'rw-none' }, r.history.length ? '지금 서 있는 대응은 없어요. 앞 보고는 이후 원문이 철회했어요.' : '이 요청 항목에 연결된 프로젝트 원문 구절이 아직 없어요. 미구현이나 실패라는 뜻은 아니에요.') : null,
        hist));
    } else if (group) {
      main.append(h('article', { class: 'rw-item' }, h('p', { class: 'rw-kick' }, '항목 밖의 구절'), h('h3', { id: 'rw-item-title' }, GROUP_TITLE[group.key]!),
        h('p', { class: 'fine' }, group.key === 'ambiguous' ? '저장된 대조가 한 항목으로 정하지 않은 구절이에요. 후보는 대조가 남긴 그대로예요.'
          : group.key === 'excluded' ? '사람이 요청 대응에서 뺀 구절이에요. 원문과 원래 대조는 그대로 남아요.' : '대조가 이 요청의 어느 항목에도 대응하지 않는다고 남긴 구절이에요.'),
        ...group.list.map(x => {
          const prior = x.prior ? (() => { const r = all.find(q => q.id === x.prior!.target.requestId), i = r?.items.find(i => i.id === x.prior!.target.itemId);
            return h('p', { class: 'fine' }, `이 구절은 앞서 ${r ? requestCaption(all, r) : '다른 요청'}의 ‘${i?.title ?? '항목'}’으로 바로잡았어요. 원래 대응은 유지하고 이번 대조는 미정으로 남겼어요.`); })() : null;
          return card(x, group.key, false,
            group.key === 'ambiguous' ? h('p', { class: 'rw-by' }, h('span', {}, x.match.targets.length > 1 ? '어느 요청의 결과인지 남음' : '대응이 아직 분명하지 않음'), x.match.targets.map(t => target(t, x)).join(' / ')) : null,
            group.key === 'excluded' && x.match.targets.length ? h('p', { class: 'rw-by' }, h('span', {}, '원래 대조'), x.match.targets.map(t => target(t, x)).join(' / ')) : null,
            x.match.why ? h('p', { class: 'rw-why' }, x.match.why) : null, prior);
        })));
    }
    // Writing stays where it was read: the narrow list keeps the correction and the unlink.
    if (!s.source) main.append(h('p', { class: 'rw-foot fine' }, `저장된 대응을 읽기만 해요. 대응 고치기·철회 연결 풀기는 ${alive ? `‘${s.origin.label}’의 ` : '원래 '}목록에서 할 수 있어요. 보고는 앱이 실행·확인한 결과가 아니에요.`));
    const multi = all.length > 1 ? (() => {
      const sel = h('select', { class: 'rw-request', 'aria-label': '읽을 요청', 'data-rw-part': 'request' }) as HTMLSelectElement;
      all.forEach((r, i) => sel.append(h('option', { value: String(i), selected: r === q }, `${requestCaption(all, r)} · ${r.items.length}항목`)));
      sel.addEventListener('change', () => { const r = all[Number(sel.value)]; if (!r || !st) return; st.request = { id: r.id, planId: r.planId, planRevision: r.planRevision }; const f = firstItem(o.project, r);
        st.section = f ? `item:${f}` : 'ambiguous'; st.source = null; st.back = null; st.notice = null; render(); el().querySelector<HTMLSelectElement>('.rw-request')?.focus(); });
      return sel;
    })() : null;
    // The way back names where it goes now: the reading it was opened from, or the map when that reading closed meanwhile.
    const backTo = alive ? s.origin.label : '지도';
    const head = h('header', { class: 'rw-head' },
      h('button', { type: 'button', class: 'rw-back', 'data-rw-part': 'back', title: `‘${backTo}’(으)로 돌아가기 (Esc)`, onclick: close }, h('span', { 'aria-hidden': 'true' }, '‹ '), backTo),
      h('div', { class: 'rw-titles' }, h('h2', { id: 'rw-title' }, '돌아온 결과 넓게 읽기'),
        h('p', { class: 'rw-req', title: `${q.id} · ${q.planId} / ${q.planRevision}` }, multi ?? requestCaption(all, q), h('span', {}, `원한 항목 ${q.items.length}개 · 요청 전체`))),
      h('button', { type: 'button', class: 'close', 'data-rw-part': 'close', 'aria-label': '넓게 읽기 닫기', title: '닫기 (Esc)', onclick: close }, '×'),
      s.notice || !alive ? h('p', { class: 'rw-notice', role: 'status' }, [s.notice, alive ? null : `원래 읽던 ‘${s.origin.label}’ 화면은 그 사이 닫혔어요. 닫으면 지도로 돌아가요.`].filter(Boolean).join(' ')) : null);
    // Re-rendering the same view keeps where it was read (the column, and the list for the same request); another request,
    // section or original starts at its top. The control that had focus keeps it.
    const view = JSON.stringify([reqKey, s.section, s.source?.key ?? null]), was = d.hidden ? null : d;
    const keepMain = was && was.dataset.view === view ? was.querySelector<HTMLElement>('.rw-main')?.scrollTop ?? 0 : 0;
    const keepNav = was && was.dataset.request === reqKey ? was.querySelector<HTMLElement>('.rw-nav')?.scrollTop ?? 0 : 0;
    d.replaceChildren(head, h('div', { class: 'rw-body' }, nav, main)); d.hidden = false; d.dataset.view = view; d.dataset.request = reqKey;
    main.scrollTop = keepMain; nav.scrollTop = keepNav;
    if (s.focus && !focusKey(s.focus)) s.focus = null;
  }
  function sourceView(x: EffectiveMatch, record: (id: string) => { kept: Project['pasted'][number] | null; e: Project['pasted'][number]['evidence'] | null; name: string }, text: string | null, from: string): Node[] {
    const r = record(x.match.record), e = r.e;
    return [h('div', { class: 'rw-backbar' }, h('button', { type: 'button', class: 'rw-src-back', 'data-rw-part': 'src-back', title: '읽던 구절로 돌아가기 (Esc)', onclick: back }, h('span', { 'aria-hidden': 'true' }, '← '), from)),
      h('article', { class: 'rr-source rw-source' },
        h('p', { class: 'rr-source-kind' }, h('span', { class: `rr-kind k-record${e ? ' k-provided' : ''}` }, e ? `사용자 제공 ${EVIDENCE_KIND_LABEL[e.kind]}` : r.kept ? '붙여넣은 기록' : '프로젝트 기록'),
          r.kept ? h('span', {}, `${e ? '가져옴' : '붙여넣음'} ${fullTime(r.kept.at)}`) : null),
        h('h3', {}, e ? e.name : r.name),
        e ? h('p', { class: 'rr-provided-note', role: 'note' }, `${NOT_EXECUTED}. 자료 종류·판본·출처는 사용자가 적은 것이에요.`) : null,
        e ? h('dl', { class: 'rr-meta rw-meta' }, h('dt', {}, '판본'), h('dd', {}, e.version ?? NOT_RECORDED, e.version ? ' (사용자 기재)' : null),
          h('dt', {}, '출처'), h('dd', {}, e.origin ?? NOT_RECORDED, e.origin ? ' (사용자 기재 · 앱이 열거나 가져오지 않음)' : null)) : null,
        h('p', { class: 'rw-reading' }, h('span', { class: 'rw-kind' }, matchLabel(x.match)), x.replacedBy ? h('span', { class: 'rw-tag off' }, '이후 철회·정정됨') : null, x.excluded ? h('span', { class: 'rw-tag' }, '대응에서 제외함') : null, x.match.text, x.match.about ? h('span', { class: 'rw-cond-inline' }, ` · ${x.match.about}`) : null),
        text !== null ? h('blockquote', { class: `rr-quote rr-raw rw-raw${e?.kind === 'code' ? ' code' : ''}`, tabindex: '0', 'aria-label': '근거 원문' }, ...quotedText(text, x.match.quote, { at: x.match.from, length: x.match.to - x.match.from }))
          : h('p', { class: 'rw-none' }, '이 구절의 원문을 지금 프로젝트에서 찾지 못했어요. 원문이 없다는 것이 미구현이라는 뜻은 아니에요.'))];
  }
  function openSource(x: EffectiveMatch, key: string) {
    if (!st) return;
    st.back = { scroll: el().querySelector<HTMLElement>('.rw-main')?.scrollTop ?? 0, focus: key };
    st.source = { key, reading: x.reading, index: x.index }; render();
    const main = el().querySelector<HTMLElement>('.rw-main'); if (main) main.scrollTop = 0;
    el().querySelector<HTMLElement>('.rw-src-back')?.focus({ preventScroll: true });
    // The original opens at its head (kind, name, declared version and origin); only a mark out of sight is brought to a third.
    requestAnimationFrame(() => { const m = el().querySelector<HTMLElement>('.rw-main .rr-mark'), box = el().querySelector<HTMLElement>('.rw-main'); if (!m || !box) return;
      const r = m.getBoundingClientRect(), b = box.getBoundingClientRect();
      if (r.top < b.top + 48 || r.bottom > b.bottom) box.scrollTop += r.top - b.top - box.clientHeight / 3; });
  }
  return { open, close, drop, escape, isOpen: () => !!st, render: () => { if (st) render(); } };
}
