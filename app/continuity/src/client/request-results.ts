/* The same small request/return reading in the plan and beside a current part. No second status model. */
import { isMapReading, type Project } from '../shared/types.js';
import { requestMatches, itemReading, MATCH_LABEL, ITEM_STATE_LABEL, type FrozenRequest, type EffectiveMatch, type RequestTarget, type StoredRequestMatch } from '../shared/request-return.js';
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
  item: string | null;
  focus: string | null;
}
export function captureRequestReading(body: Element): RequestReading {
  const active = body.contains(document.activeElement) ? document.activeElement as HTMLElement : null;
  return {
    items: [...body.querySelectorAll<HTMLDetailsElement>('details[data-request-item]')].map(d => ({ key: d.dataset.requestItem!, open: d.open })),
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
  quote?(record: string, quote: string): void;
}): HTMLElement | null {
  const all = frozenRequests(project, scopes), requests = all.filter(q => (!options.requestId || q.id === options.requestId) && (!options.partId || q.items.some(i => i.partIds.includes(options.partId!))));
  if (!requests.length) return null;
  const matches = requestMatches(project), sec = h('section', { class: 'sec request-results', 'aria-label': '원한 것과 돌아온 범위' }, h('h3', {}, '원한 것과 돌아온 범위'));
  const caption = (q: FrozenRequest) => `요청 ${all.findIndex(r => r.id === q.id) + 1} · ${fullTime(q.createdAt)} · 판 ${q.planRevision}`;
  const source = (m: EffectiveMatch, itemKey?: string) => {
    if (options.quote) return h('button', { type: 'button', class: 'cl-cite', ...(itemKey ? { 'data-request-focus': JSON.stringify([itemKey, m.reading, m.index, m.match.record, m.match.from, m.match.to]) } : {}), title: m.match.quote, onclick: () => options.quote!(m.match.record, m.match.quote) }, '근거');
    const text = project.pasted.find(r => r.id === m.match.record)?.text ?? project.sources.find(r => r.id === m.match.record)?.text ?? '';
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
  const passage = (x: EffectiveMatch, itemKey?: string) => h('div', { class: 'request-passage' },
    h('p', {}, h('span', { class: 'cl-kind' }, matchLabel(x.match)), x.match.text,
      x.match.about ? h('small', { class: 'cl-about', title: x.match.about }, ` · ${displayAbout(x.match.about)}`) : null,
      x.replaces ? h('small', { class: 'cl-replaces' }, ' · 앞 보고를 철회·정정') : null),
    source(x, itemKey), correction(x));
  // An earlier report a later record took back: its words and source stay, with the passage that took it back and the one way
  // to undo that link. Excluding or retargeting either passage never brings it back.
  const withdrawn = (x: EffectiveMatch, itemKey?: string) => {
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
  for (const q of ordered) {
    const group = h('div', { class: 'request-group' }, h('p', { class: 'request-at', title: `${q.id} · ${q.planId} / ${q.planRevision}` }, caption(q)));
    for (const item of q.items.filter(i => !options.partId || i.partIds.includes(options.partId))) {
      // The same reading the map title counts (itemReading): the current lead, then the passages that stand, then history apart.
      const { state, lead, current, history } = itemReading(matches, { requestId: q.id, itemId: item.id });
      const itemKey = JSON.stringify([q.id, q.planId, q.planRevision, item.id]);
      const detail = h('details', { class: `request-item${current.length ? ' has' : ''} st-${state}`, 'data-request-item': itemKey, open: !options.compact },
        h('summary', { 'data-request-focus': itemKey }, item.title, h('small', {}, lead ? ` · ${ITEM_STATE_LABEL[state]} · ${lead.match.text.slice(0, 90)}` : history.length ? ` · ${ITEM_STATE_LABEL[state]}` : ' · 아직 받은 내용 없음')),
        h('p', { class: 'request-want' }, h('span', { class: 'cl-kind' }, '원함'), item.description));
      if (current.length) [...(lead ? [lead] : []), ...current.filter(x => x !== lead)].forEach(x => detail.append(passage(x, itemKey)));
      else detail.append(h('p', { class: 'request-remains' }, history.length ? '지금 서 있는 대응은 없어요. 앞 보고는 이후 원문이 철회했어요.' : '이 요청에 대응하는 내용은 아직 받지 못했어요.'));
      if (history.length) detail.append(h('details', { class: 'request-history' }, h('summary', {}, `철회·정정된 앞 보고 ${history.length}개`), ...history.map(x => withdrawn(x, itemKey))));
      group.append(detail);
    }
    sec.append(group);
  }
  const ids = new Set(requests.map(q => q.id));
  for (const x of matches.filter(x => !x.excluded && !x.replacedBy && !x.target && x.match.targets.length > 0 && x.match.targets.some(t => belongs(t, x.requests)))) {
    const pending = h('div', { class: 'request-ambiguous' }, h('p', {}, x.match.targets.length > 1 ? '어느 요청의 결과인지 남아 있어요' : '요청과의 대응이 아직 분명하지 않아요'), h('p', {}, x.match.text), h('p', { class: 'fine' }, x.match.why), source(x));
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
  if (excluded.length) sec.append(h('details', { class: 'request-excluded' }, h('summary', {}, `제외한 대응 ${excluded.length}개`), ...excluded.map(x => passage(x))));
  if (!options.partId) {
    const unrelated = matches.filter(x => !x.excluded && !x.replacedBy && !x.target && !x.match.targets.length && x.requests.some(q => ids.has(q.id)));
    if (unrelated.length) sec.append(h('details', { class: 'request-unrelated' }, h('summary', {}, `요청에 대응하지 않은 구절 ${unrelated.length}개`), ...unrelated.map(x => h('div', { class: 'request-passage' }, h('p', {}, x.match.text), source(x)))));
  }
  return sec;
}
