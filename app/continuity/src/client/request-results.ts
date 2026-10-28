/* The same small request/return reading in the plan and beside a current part. No second status model. */
import type { Project } from '../shared/types.js';
import { requestMatches, MATCH_LABEL, type FrozenRequest, type EffectiveMatch, type RequestTarget } from '../shared/request-return.js';
import { h, fullTime } from './plan-dom.js';

/** Shorten only a pure full SHA, for display. The stored wording and title stay exact. */
export const displayAbout = (about: string) => /^[a-f0-9]{40}$/i.test(about) ? about.slice(0, 8) : about;
export function frozenRequests(project: Project, scopes: FrozenRequest[] = []): FrozenRequest[] {
  const by = new Map<string, FrozenRequest>();
  for (const r of project.readings) if (r.version === 'map-reading.2') for (const q of r.requests ?? []) by.set(q.id, q);
  for (const q of scopes) by.set(q.id, q);
  return [...by.values()];
}
export function requestResults(project: Project, scopes: FrozenRequest[], options: {
  partId?: string; requestId?: string; compact?: boolean;
  correct(reading: string, index: number, target: RequestTarget | null): Promise<string | null>;
  quote?(record: string, quote: string): void;
}): HTMLElement | null {
  const all = frozenRequests(project, scopes), requests = all.filter(q => (!options.requestId || q.id === options.requestId) && (!options.partId || q.items.some(i => i.partIds.includes(options.partId!))));
  if (!requests.length) return null;
  const matches = requestMatches(project), sec = h('section', { class: 'sec request-results', 'aria-label': '원한 것과 돌아온 범위' }, h('h3', {}, '원한 것과 돌아온 범위'));
  const source = (m: EffectiveMatch) => {
    if (options.quote) return h('button', { type: 'button', class: 'cl-cite', title: m.match.quote, onclick: () => options.quote!(m.match.record, m.match.quote) }, '근거');
    const text = project.pasted.find(r => r.id === m.match.record)?.text ?? project.sources.find(r => r.id === m.match.record)?.text ?? '';
    return h('details', { class: 'request-quote' }, h('summary', {}, '근거 원문'), h('pre', {}, text.slice(0, m.match.from), h('mark', {}, text.slice(m.match.from, m.match.to)), text.slice(m.match.to)));
  };
  const correction = (x: EffectiveMatch) => {
    const box = h('details', { class: 'request-fix' }, h('summary', {}, x.excluded ? '대응에서 제외함 · 다시 고치기' : '대응 고치기'));
    const select = h('select', { 'aria-label': '이 구절이 답하는 요청 항목' }) as HTMLSelectElement;
    select.append(h('option', { value: '' }, '요청 대응에서 제외'));
    const targets: RequestTarget[] = [];
    for (const q of x.requests) for (const item of q.items) {
      const target = { requestId: q.id, itemId: item.id }, value = String(targets.push(target));
      select.append(h('option', { value, selected: !!x.target && x.target.requestId === q.id && x.target.itemId === item.id }, `${item.title} · ${fullTime(q.createdAt)} · 판 ${q.planRevision}`));
    }
    const msg = h('span', { role: 'status', class: 'form-msg' }), button = h('button', { type: 'button', class: 'link-button', onclick: async () => {
      (button as HTMLButtonElement).disabled = true;
      const error = await options.correct(x.reading, x.index, select.value ? targets[Number(select.value) - 1]! : null);
      if (error) { msg.textContent = error; (button as HTMLButtonElement).disabled = false; }
    } }, '저장');
    box.append(select, button, msg); return box;
  };
  const passage = (x: EffectiveMatch) => h('div', { class: 'request-passage' },
    h('p', {}, h('span', { class: 'cl-kind' }, MATCH_LABEL[x.match.kind]), x.match.text,
      x.match.about ? h('small', { class: 'cl-about', title: x.match.about }, ` · ${displayAbout(x.match.about)}`) : null),
    source(x), correction(x));
  for (const q of requests.slice().reverse()) {
    const group = h('div', { class: 'request-group' }, h('p', { class: 'request-at', title: `${q.id} · ${q.planId} / ${q.planRevision}` }, `${fullTime(q.createdAt)} 요청 · 판 ${q.planRevision}`));
    for (const item of q.items.filter(i => !options.partId || i.partIds.includes(options.partId))) {
      const own = matches.filter(x => !x.excluded && x.target?.requestId === q.id && x.target.itemId === item.id);
      const detail = h('details', { class: `request-item${own.length ? ' has' : ''}`, open: !options.compact },
        h('summary', {}, item.title, h('small', {}, own.length ? ` · ${own[0]!.match.text.slice(0, 90)}` : ' · 아직 받은 내용 없음')),
        h('p', { class: 'request-want' }, h('span', { class: 'cl-kind' }, '원함'), item.description));
      if (own.length) own.forEach(x => detail.append(passage(x)));
      else detail.append(h('p', { class: 'request-remains' }, '이 요청에 대응하는 내용은 아직 받지 못했어요.'));
      group.append(detail);
    }
    sec.append(group);
  }
  const ids = new Set(requests.map(q => q.id));
  for (const x of matches.filter(x => !x.excluded && !x.target && x.requests.some(q => ids.has(q.id)))) {
    const pending = h('div', { class: 'request-ambiguous' }, h('p', {}, x.match.targets.length > 1 ? '어느 요청의 결과인지 남아 있어요' : '요청과의 대응이 아직 분명하지 않아요'), h('p', {}, x.match.text), h('p', { class: 'fine' }, x.match.why), source(x));
    if (x.match.targets.length > 1) for (const t of x.match.targets) {
      const q = x.requests.find(q => q.id === t.requestId)!, item = q.items.find(i => i.id === t.itemId)!;
      const b = h('button', { type: 'button', class: 'link-button', title: `${q.id} · ${item.description}`, onclick: async () => {
        (b as HTMLButtonElement).disabled = true; const error = await options.correct(x.reading, x.index, t);
        if (error) { (b as HTMLButtonElement).disabled = false; pending.append(h('p', { role: 'alert' }, error)); }
      } }, `${item.title} · ${fullTime(q.createdAt)} · 판 ${q.planRevision}`); pending.append(b);
    }
    pending.append(correction(x)); sec.append(pending);
  }
  const excluded = matches.filter(x => x.excluded && x.requests.some(q => ids.has(q.id)));
  if (excluded.length) sec.append(h('details', { class: 'request-excluded' }, h('summary', {}, `제외한 대응 ${excluded.length}개`), ...excluded.map(passage)));
  return sec;
}
