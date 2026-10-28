import { requestMatches, MATCH_LABEL } from '../shared/request-return.js';
import { h, fullTime, quotedText } from './plan-dom.js';
/** Shorten only a pure full SHA, for display. The stored wording and title stay exact. */
export const displayAbout = (about) => /^[a-f0-9]{40}$/i.test(about) ? about.slice(0, 8) : about;
export function frozenRequests(project, scopes = []) {
    const by = new Map();
    for (const r of project.readings)
        if (r.version === 'map-reading.2')
            for (const q of r.requests ?? [])
                by.set(q.id, q);
    for (const q of scopes)
        by.set(q.id, q);
    return [...by.values()];
}
export function requestResults(project, scopes, options) {
    const all = frozenRequests(project, scopes), requests = all.filter(q => (!options.requestId || q.id === options.requestId) && (!options.partId || q.items.some(i => i.partIds.includes(options.partId))));
    if (!requests.length)
        return null;
    const matches = requestMatches(project), sec = h('section', { class: 'sec request-results', 'aria-label': '원한 것과 돌아온 범위' }, h('h3', {}, '원한 것과 돌아온 범위'));
    const caption = (q) => `요청 ${all.findIndex(r => r.id === q.id) + 1} · ${fullTime(q.createdAt)} · 판 ${q.planRevision}`;
    const source = (m) => {
        if (options.quote)
            return h('button', { type: 'button', class: 'cl-cite', title: m.match.quote, onclick: () => options.quote(m.match.record, m.match.quote) }, '근거');
        const text = project.pasted.find(r => r.id === m.match.record)?.text ?? project.sources.find(r => r.id === m.match.record)?.text ?? '';
        const details = h('details', { class: 'request-quote' }, h('summary', {}, '근거 원문'), h('pre', {}, ...quotedText(text, m.match.quote, { at: m.match.from, length: m.match.to - m.match.from })));
        details.addEventListener('toggle', () => { if (details.open)
            requestAnimationFrame(() => details.querySelector('mark')?.scrollIntoView({ block: 'nearest' })); });
        return details;
    };
    const correction = (x) => {
        const box = h('details', { class: 'request-fix' }, h('summary', {}, x.excluded ? '대응에서 제외함 · 다시 고치기' : '대응 고치기'));
        const select = h('select', { 'aria-label': '이 구절이 답하는 요청 항목' });
        select.append(h('option', { value: '' }, '요청 대응에서 제외'));
        const targets = [];
        for (const q of x.requests)
            for (const item of q.items) {
                const target = { requestId: q.id, itemId: item.id }, value = String(targets.push(target));
                select.append(h('option', { value, selected: !!x.target && x.target.requestId === q.id && x.target.itemId === item.id }, `${item.title} · ${caption(q)}`));
            }
        const msg = h('span', { role: 'status', class: 'form-msg' }), button = h('button', { type: 'button', class: 'link-button', onclick: async () => {
                button.disabled = true;
                const error = await options.correct(x.reading, x.index, select.value ? targets[Number(select.value) - 1] : null);
                if (error) {
                    msg.textContent = error;
                    button.disabled = false;
                }
            } }, '저장');
        box.append(select, button, msg);
        return box;
    };
    const passage = (x) => h('div', { class: 'request-passage' }, h('p', {}, h('span', { class: 'cl-kind' }, MATCH_LABEL[x.match.kind]), x.match.text, x.match.about ? h('small', { class: 'cl-about', title: x.match.about }, ` · ${displayAbout(x.match.about)}`) : null), source(x), correction(x));
    const belongs = (target, scopes = all) => requests.some(q => q.id === target.requestId) && (!options.partId || !!scopes.find(q => q.id === target.requestId)?.items.some(i => i.id === target.itemId && i.partIds.includes(options.partId)));
    const hasReport = (q) => matches.some(x => !x.excluded && x.target?.requestId === q.id && belongs(x.target, x.requests) && x.match.kind !== 'open');
    const ordered = requests.slice().reverse().sort((a, b) => Number(hasReport(b)) - Number(hasReport(a)));
    for (const q of ordered) {
        const group = h('div', { class: 'request-group' }, h('p', { class: 'request-at', title: `${q.id} · ${q.planId} / ${q.planRevision}` }, caption(q)));
        for (const item of q.items.filter(i => !options.partId || i.partIds.includes(options.partId))) {
            const own = matches.filter(x => !x.excluded && x.target?.requestId === q.id && x.target.itemId === item.id);
            const lead = own.find(x => x.match.kind === 'reported' || x.match.kind === 'code') ?? own[0];
            const detail = h('details', { class: `request-item${own.length ? ' has' : ''}`, open: !options.compact }, h('summary', {}, item.title, h('small', {}, lead ? ` · ${lead.match.text.slice(0, 90)}` : ' · 아직 받은 내용 없음')), h('p', { class: 'request-want' }, h('span', { class: 'cl-kind' }, '원함'), item.description));
            if (own.length)
                own.forEach(x => detail.append(passage(x)));
            else
                detail.append(h('p', { class: 'request-remains' }, '이 요청에 대응하는 내용은 아직 받지 못했어요.'));
            group.append(detail);
        }
        sec.append(group);
    }
    const ids = new Set(requests.map(q => q.id));
    for (const x of matches.filter(x => !x.excluded && !x.target && x.match.targets.length > 0 && x.match.targets.some(t => belongs(t, x.requests)))) {
        const pending = h('div', { class: 'request-ambiguous' }, h('p', {}, x.match.targets.length > 1 ? '어느 요청의 결과인지 남아 있어요' : '요청과의 대응이 아직 분명하지 않아요'), h('p', {}, x.match.text), h('p', { class: 'fine' }, x.match.why), source(x));
        if (x.prior) {
            const original = all.find(q => q.id === x.prior.target.requestId), item = original?.items.find(i => i.id === x.prior.target.itemId);
            pending.append(h('p', { class: 'fine' }, `이 구절은 앞서 ${original ? caption(original) : '다른 요청'}의 ‘${item?.title ?? '항목'}’으로 바로잡았어요. 원래 대응은 유지하고 이번 대조는 미정으로 남겼어요.`));
        }
        if (x.match.targets.length > 1 || x.prior)
            for (const t of x.match.targets) {
                const q = x.requests.find(q => q.id === t.requestId), item = q.items.find(i => i.id === t.itemId);
                const b = h('button', { type: 'button', class: 'link-button', title: `${q.id} · ${item.description}`, onclick: async () => {
                        b.disabled = true;
                        const error = await options.correct(x.reading, x.index, t);
                        if (error) {
                            b.disabled = false;
                            pending.append(h('p', { role: 'alert' }, error));
                        }
                    } }, `${item.title} · ${caption(q)}`);
                pending.append(b);
            }
        pending.append(correction(x));
        sec.append(pending);
    }
    const excluded = matches.filter(x => x.excluded && x.match.targets.some(t => belongs(t, x.requests)));
    if (excluded.length)
        sec.append(h('details', { class: 'request-excluded' }, h('summary', {}, `제외한 대응 ${excluded.length}개`), ...excluded.map(passage)));
    if (!options.partId) {
        const unrelated = matches.filter(x => !x.excluded && !x.target && !x.match.targets.length && x.requests.some(q => ids.has(q.id)));
        if (unrelated.length)
            sec.append(h('details', { class: 'request-unrelated' }, h('summary', {}, `요청에 대응하지 않은 구절 ${unrelated.length}개`), ...unrelated.map(x => h('div', { class: 'request-passage' }, h('p', {}, x.match.text), source(x)))));
    }
    return sec;
}
