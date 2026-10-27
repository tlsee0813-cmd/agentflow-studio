/* Coming back to a project: what changed in the program, which part to read now and what is still the person's to decide,
 * read in the right pane beside the same map. The reading is made by the model from prepared material (studio.digest.1) only
 * when the person asks; the same material is never sent again (the cache), and without a reading the material itself is
 * what one reads. Each sentence names its sources (one click to the exact quote and its version) and at most two parts,
 * which the map marks without changing their status or description. Nothing here writes a project, a plan or a record. */
import { DIGEST_KIND_LABEL, OUTCOME_KINDS } from '../shared/digest-api.js';
import { UI62_KEY, UI62_STAGES } from '../shared/return-material.js';
import { clip } from '../shared/studio.js';
import { ui62Reading, savedReading, readingInput } from './digest-source.js';
import { digestStore, askHash, makeReading } from './digest-store.js';
import { askDigest, AskError, ERROR_TEXT } from './studio-api.js';
import { secretLike } from './plan-source.js';
import { h, put, fullTime, codeGate, codeNote } from './plan-dom.js';
const STAGE_MEMORY = new Map();
const short = (text, n) => { const t = text.replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n)}…` : t; };
/** A version named in a source's basis (a commit), else nothing. */
const versionOf = (basis) => /\b[0-9a-f]{7}\b/.exec(basis)?.[0] ?? null;
export function createReturnView(host) {
    const saved = digestStore(host.kv), memory = digestStore(null);
    let s = null, seq = 0;
    const storeFor = () => (host.current()?.kind === 'saved' ? saved : memory);
    const partName = (id) => host.current()?.view.parts.find(p => p.id === id)?.name ?? '부분';
    /* ---------- material and the reading of it ---------- */
    function sources() {
        const o = host.current();
        return o.key === UI62_KEY ? ui62Reading(o.project, s.stage) : savedReading(o.view, host.bundle());
    }
    /** Recompute the request for the material as it is now and look up a reading of exactly it (no call). */
    async function refresh() {
        const o = host.current();
        if (!s || !o)
            return;
        const mine = ++seq, input = readingInput(o, sources(), o.key === UI62_KEY ? null : host.bundle());
        const hash = await askHash(input.ask);
        if (mine !== seq || !s)
            return;
        const st = host.status(), store = storeFor();
        if (s.hash !== hash)
            s.focus = null;
        s.input = input;
        s.hash = hash;
        s.reading = st.digest ? store.find(o.project.id, hash, input.ask, st.digest.model, st.digest.prompt) : null;
        s.previous = o.key === UI62_KEY ? null : store.previous(o.project.id, hash);
        render();
    }
    async function analyze() {
        const o = host.current();
        if (!s || !o || !s.input || !s.hash || s.pending)
            return;
        const st = host.status();
        if (st.ai !== 'deepseek' || !st.digest)
            return;
        const secret = s.input.ask.sources.find(x => secretLike(`${x.title}\n${x.text}\n${x.basis}`));
        if (secret) {
            s.error = `‘${secret.title}’에 키나 토큰처럼 보이는 글이 있어 보내지 않았어요.`;
            render();
            return;
        }
        const input = s.input, hash = s.hash, key = s.key, controller = new AbortController(), prompt = st.digest.prompt;
        s.pending = controller;
        s.error = null;
        render();
        try {
            const res = await askDigest(input.ask, controller.signal, host.accessCode());
            const reading = makeReading(input, hash, res.model, prompt, res.reply), msg = storeFor().keep(o.project.id, reading);
            if (s && s.key === key && s.hash === hash) {
                s.reading = reading;
                s.storeMsg = msg;
                s.focus = null;
                s.view = { kind: 'reading' };
            }
        }
        catch (e) {
            const code = e instanceof AskError ? e.code : 'NETWORK';
            if (s && s.key === key && code !== 'CANCELLED')
                s.error = ERROR_TEXT[code] ?? '정리하지 못했어요. 원자료는 그대로 읽을 수 있어요.';
        }
        finally {
            if (s && s.key === key)
                s.pending = null;
        }
        render();
    }
    /* ---------- open / close ---------- */
    function open() {
        const o = host.current();
        if (!o || o.kind === 'legacy')
            return;
        if (!s || s.key !== o.key) {
            s = { key: o.key, stage: STAGE_MEMORY.get(o.key) ?? UI62_STAGES[0].id, view: { kind: 'reading' }, focus: null, input: null, hash: null, reading: null, previous: null,
                pending: null, error: null, storeMsg: null, scroll: 0 };
        }
        host.chrome();
        render();
        void refresh();
    }
    function close() {
        if (!s)
            return;
        s.pending?.abort();
        s = null;
        host.mark([]);
        host.show(null);
        host.chrome();
    }
    function setStage(id) {
        if (!s || s.stage === id || s.pending)
            return;
        s.stage = id;
        STAGE_MEMORY.set(s.key, id);
        s.view = { kind: 'reading' };
        s.focus = null;
        s.reading = null;
        s.error = null;
        s.scroll = 0;
        render();
        void refresh();
    }
    /* ---------- reading ---------- */
    const shown = () => s?.reading ?? s?.previous ?? null;
    function sourceOf(r, id) {
        // A reading's citations stay as held when it was made, even if an unsent suffix has changed since.
        return r?.cited[id] ?? null;
    }
    function statements(r) {
        // Aliases of the request the reading was made from; a part no longer on the map is simply not named.
        const known = (aliases) => aliases.map(a => r.parts[a]).filter((id) => !!id && !!host.current()?.view.parts.some(p => p.id === id));
        const st = (x) => ({ text: x.text, partIds: known(x.partIds), refs: [...x.refs] });
        const read = r.reply.read ? known([r.reply.read.partId])[0] : undefined;
        return { changes: r.reply.changes.map(st), open: r.reply.open.map(st), read: r.reply.read && read ? { partId: read, why: r.reply.read.why, refs: [...r.reply.read.refs] } : null };
    }
    function focusParts() {
        const r = shown();
        if (!s || !r)
            return [];
        const st = statements(r);
        // Before a sentence is chosen, mark the suggested reading, or the first actual decision's known parts.
        if (!s.focus)
            return st.read ? [st.read.partId] : st.open[0]?.partIds ?? [];
        return (s.focus.list === 'changes' ? st.changes : st.open)[s.focus.n]?.partIds ?? [];
    }
    function chipFor(id, r, from) {
        const src = sourceOf(r, id);
        if (!src)
            return null;
        const v = versionOf(src.basis);
        const label = `${src.title} · ${DIGEST_KIND_LABEL[src.kind]} · ${src.basis}`;
        return h('button', { type: 'button', class: `rr-ref k-${src.kind}`, title: label, 'aria-label': label, onclick: (e) => { e.stopPropagation(); openSource(src, from); } }, h('span', { class: 'rr-ref-kind' }, DIGEST_KIND_LABEL[src.kind]), h('span', { class: 'rr-ref-title' }, src.title), v ? h('code', {}, v) : null);
    }
    function partChip(id) {
        return h('button', { type: 'button', class: 'rr-part', title: `지도에서 ‘${partName(id)}’ 보기`, onclick: (e) => { e.stopPropagation(); host.mark([id]); host.reveal([id]); } }, h('i', { 'aria-hidden': 'true' }), partName(id));
    }
    function statement(list, n, x, r, from, extra) {
        const active = s.focus?.list === list && s.focus.n === n;
        const compact = list === 'changes' && !active;
        const choose = (keyboard = false) => {
            s.focus = { list, n };
            render();
            if (x.partIds.length)
                host.reveal(x.partIds);
            // Rendering replaces the pane. Keep keyboard focus on the selected sentence, without scrolling the map or pane.
            if (keyboard)
                requestAnimationFrame(() => document.querySelector(`.rr-st-select[data-list="${list}"][data-index="${n}"]`)?.focus({ preventScroll: true }));
        };
        const el = h('article', { class: `rr-st${active ? ' on' : ''}${compact ? ' compact' : ''}`, 'aria-current': active ? 'true' : 'false', onclick: () => choose() }, h('button', { type: 'button', class: 'rr-st-select', 'data-list': list, 'data-index': String(n),
            ...(list === 'changes' ? { 'aria-expanded': String(active) } : {}),
            onclick: (e) => { e.stopPropagation(); choose(e.detail === 0); } }, h('span', { class: 'rr-text' }, x.text), compact ? h('span', { class: 'rr-expand' }, '펼쳐 읽기') : null), h('div', { class: 'rr-chips' }, ...(!compact ? x.partIds.map(partChip) : []), ...x.refs.map(id => chipFor(id, r, from))), compact ? null : extra);
        return el;
    }
    /** Where a change meets the open change plan: the same parts read current/preview on the same map. */
    function planMeet(parts) {
        const p = host.bundle()?.plan;
        if (!p || !parts.length)
            return null;
        if (!p.analysis.items.some(i => i.partIds.some(id => parts.includes(id))))
            return null;
        return h('p', { class: 'rr-meet' }, h('span', {}, `변경 구상 ‘${short(p.intent, 28)}’의 대상이에요`), h('button', { type: 'button', class: 'link-button', onclick: (e) => { e.stopPropagation(); host.compare(parts); } }, '같은 지도에서 비교 ›'));
    }
    function trialButton(x, r, from, label) {
        return h('button', { type: 'button', class: 'rr-try', onclick: (e) => {
                e.stopPropagation();
                // The plan sidecar accepts outcome evidence only. A direction or hypothetical plan must never become a report.
                const ev = x.refs.map(id => sourceOf(r, id)).filter((q) => !!q && OUTCOME_KINDS.includes(q.kind)).map(q => {
                    const text = clip(q.text, 12000), excerpt = text.length < q.text.length ? ` · 원자료 ${q.text.length}자 중 앞 ${text.length}자 발췌` : '';
                    return { id: q.id, kind: q.kind === 'code' || q.kind === 'test' ? q.kind : 'report', title: clip(q.title, 200), text,
                        basis: clip(`돌아와 읽기에서 가져온 ${DIGEST_KIND_LABEL[q.kind]}${excerpt} · ${q.basis}${q.note ? ` · ${q.note}` : ''}`, 2000) };
                });
                host.trial(x.text, ev);
            } }, label);
    }
    function header(o) {
        const ex = o.key === UI62_KEY;
        return h('header', { class: 'lens-head rr-head' }, h('h2', { id: 'lens-title' }, '돌아와 읽기', ex ? h('span', { class: 'tag', title: '공개 commit과 결과 문서에서 사후 편집한 자료예요. 당시 실시간으로 받은 기록이 아니에요.' }, '공개 자료 · 사후 편집') : null), ex ? stageSwitch() : null, h('div', { class: 'head-tools' }, h('button', { type: 'button', class: 'close', 'aria-label': '돌아와 읽기 닫기', title: '닫기 (Esc)', onclick: close }, '×')));
    }
    function stageSwitch() {
        const st = s, cur = UI62_STAGES.find(x => x.id === st.stage);
        return h('div', { class: 'rr-stage' }, h('div', { class: 'rr-steps', role: 'group', 'aria-label': '읽을 자료 단계' }, ...UI62_STAGES.map((x, i) => h('button', { type: 'button', 'aria-pressed': String(x.id === st.stage), disabled: !!st.pending,
            title: `${x.label} · 자료 ${x.sourceIds.length}개`, onclick: () => setStage(x.id) }, `${i + 1}단계`))), h('p', { class: 'rr-stage-note', title: '자료를 나누어 읽는 단계예요. 당시 받은 순서나 시각이 아니에요.' }, `${cur.label} · 자료 ${cur.sourceIds.length}개 · 기준 `, h('code', {}, cur.basis.slice(0, 7))));
    }
    function readingBody(o) {
        const st = s, r = st.reading, prev = !r ? st.previous : null, use = r ?? prev, from = r ? 'now' : 'previous';
        const out = [];
        const total = st.input?.coverage.total ?? 0, sent = st.input?.coverage.sent ?? 0;
        const outcome = !!st.input?.ask.sources.some(x => OUTCOME_KINDS.includes(x.kind));
        if (!st.input) {
            out.push(h('p', { class: 'fine' }, '자료를 읽는 중…'));
            return out;
        }
        if (prev)
            out.push(h('p', { class: 'rr-older', role: 'status' }, `앞서 보낸 자료 ${prev.coverage.sent}개로 만든 정리예요. 지금 원자료는 ${total}개이고, 새로 정리하면 ${sent}개를 보내요.`));
        if (use) {
            const m = statements(use);
            if (m.read)
                out.push(h('section', { class: 'rr-sec rr-read' }, h('h3', {}, '지금 읽을 부분'), h('div', { class: 'rr-readrow' }, h('button', { type: 'button', class: 'rr-go', onclick: () => host.selectPart(m.read.partId) }, partName(m.read.partId), h('span', { 'aria-hidden': 'true' }, ' ›')), h('p', {}, m.read.why), h('div', { class: 'rr-chips' }, ...m.read.refs.map(id => chipFor(id, use, from))), planMeet([m.read.partId]))));
            if (m.open.length)
                out.push(h('section', { class: 'rr-sec' }, h('h3', {}, '정할 것'), ...m.open.map((x, n) => statement('open', n, x, use, from, h('div', { class: 'rr-acts' }, trialButton(x, use, from, '이걸로 시험'))))));
            if (m.changes.length)
                out.push(h('section', { class: 'rr-sec' }, h('h3', {}, '달라진 점'), ...m.changes.map((x, n) => statement('changes', n, x, use, from, planMeet(x.partIds)))));
            else
                out.push(h('section', { class: 'rr-sec' }, h('h3', {}, '달라진 점'), h('p', { class: 'rr-none' }, outcome ? '이 자료에서 프로그램의 달라진 점을 말하지 않았어요.' : '돌아온 결과 자료가 아직 없어요. 반영 실패나 변화 없음이라는 뜻은 아니에요.')));
            if (use.reply.notCovered.length)
                out.push(h('section', { class: 'rr-sec rr-gaps' }, h('h3', {}, '이 자료로는 말할 수 없는 것'), h('ul', {}, ...use.reply.notCovered.map(t => h('li', {}, t)))));
            const f = st.focus && st.focus.list === 'changes' ? m.changes[st.focus.n] : null;
            if (f && !m.open.length)
                out.push(h('div', { class: 'rr-acts' }, trialButton(f, use, from, '이 변화에 이어 바꿀 모습 시험')));
        }
        else if (!st.pending) {
            out.push(h('p', { class: 'rr-lead' }, st.error ? '정리를 만들지 못했어요. 아래 원자료로 읽을 수 있어요.' : '아직 이 자료를 정리하지 않았어요.'));
            out.push(materialList(o, 5));
        }
        return out;
    }
    /** The material itself: kind, title and version per source; the quote one click away. */
    function materialList(o, max) {
        const all = sources();
        const list = all.slice(0, max);
        return h('section', { class: 'rr-sec rr-material' }, h('h3', {}, '원자료', h('small', {}, `${all.length}`)), h('ol', {}, ...list.map(x => h('li', {}, h('button', { type: 'button', class: 'rr-src', onclick: () => openSource(x, 'material') }, h('span', { class: `rr-kind k-${x.kind}` }, DIGEST_KIND_LABEL[x.kind]), h('strong', {}, x.title), h('small', {}, [versionOf(x.basis), x.partIds.map(partName).join(' · ')].filter(Boolean).join(' · ')))))), all.length > max ? h('button', { type: 'button', class: 'link-button', onclick: () => { s.view = { kind: 'material' }; render(); } }, `${all.length}개 모두 보기`) : null, !all.length ? h('p', { class: 'fine' }, '읽을 기록이나 붙인 자료가 아직 없어요.') : null);
    }
    function footer(o) {
        const state = s, status = host.status(), r = state.reading, out = h('footer', { class: 'lens-foot rr-foot' });
        if (state.pending) {
            out.append(h('div', { class: 'pending' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), h('span', {}, `${status.digest?.model ?? 'AI'}가 자료 ${state.input?.coverage.sent ?? 0}개를 읽고 있어요…`), h('button', { type: 'button', class: 'link-button', onclick: () => state.pending?.abort() }, '취소')));
            return out;
        }
        if (state.error)
            out.append(h('p', { class: 'pp-error', role: 'alert' }, state.error));
        if (state.storeMsg)
            out.append(h('p', { class: 'pp-error', role: 'status' }, state.storeMsg));
        const can = status.ai === 'deepseek' && !!status.digest && !!state.input?.ask.sources.length;
        if (r) {
            const cov = r.coverage.sent < r.coverage.total ? `자료 ${r.coverage.total}개 중 ${r.coverage.sent}개` : `자료 ${r.coverage.sent}개`;
            out.append(h('p', { class: 'rr-prov', title: `같은 자료는 다시 보내지 않아요. 정리는 지도 부분의 상태나 설명을 바꾸지 않아요. 정리 지시 ${r.prompt}` }, h('span', { class: 'tag ai' }, `AI 정리 · ${r.model}`), h('span', {}, `${cov} · ${fullTime(r.at)}`), state.view.kind === 'reading' ? h('button', { type: 'button', class: 'link-button quiet', onclick: () => { state.view = { kind: 'material' }; render(); } }, '원자료') : null));
            return out;
        }
        if (status.access === 'code' && can) {
            const code = h('input', { id: 'return-access', type: 'password', placeholder: '접속 코드', autocomplete: 'off', value: host.accessCode() });
            const keep = () => host.keepAccessCode(code.value);
            code.addEventListener('input', keep);
            code.addEventListener('change', keep);
            out.append(h('div', { class: 'access' }, h('label', { for: 'return-access' }, '접속 코드'), code));
        }
        const sent = state.input?.coverage.sent ?? 0, total = state.input?.coverage.total ?? 0;
        const gated = status.access === 'code' && can, go = codeGate(h('button', { type: 'button', class: 'primary small', onclick: () => void analyze() }, state.previous ? '지금 자료로 정리하기' : 'AI로 정리하기'), gated, !!host.accessCode(), !can);
        out.append(h('div', { class: 'pp-row' }, go, codeNote(gated, !!host.accessCode()), h('span', { class: 'fine' }, can ? `자료 ${sent < total ? `${total}개 중 ${sent}개` : `${sent}개`}를 보내요` : status.ai === 'off' ? '서버에 AI 키가 없어요 · 원자료로 읽어요' : status.ai === 'none' ? '이 주소에는 AI 서버가 없어요 · 원자료로 읽어요' : ''), state.view.kind === 'reading' ? h('button', { type: 'button', class: 'link-button quiet', onclick: () => { state.view = { kind: 'material' }; render(); } }, '원자료') : null));
        return out;
    }
    function sourceBody(src, from) {
        const v = versionOf(src.basis);
        return [h('article', { class: 'rr-source' }, h('p', { class: 'rr-source-kind' }, h('span', { class: `rr-kind k-${src.kind}` }, DIGEST_KIND_LABEL[src.kind]), v ? h('code', {}, v) : null, h('span', {}, src.id)), h('h3', {}, src.title), h('blockquote', { class: `rr-quote${src.kind === 'code' ? ' code' : ''}` }, src.text), from !== 'material' ? h('p', { class: 'fine' }, '이 정리를 만들 때 함께 보관한 자료예요.') : null, h('dl', { class: 'rr-meta' }, h('dt', {}, '판본·출처'), h('dd', {}, src.basis, src.url ? h('a', { href: src.url, target: '_blank', rel: 'noopener noreferrer' }, ' 공개 원문 ↗') : null), src.note ? h('dt', {}, '편집 설명') : null, src.note ? h('dd', {}, src.note) : null, src.partIds.length ? h('dt', {}, '다루는 부분') : null, src.partIds.length ? h('dd', { class: 'rr-chips' }, ...src.partIds.map(partChip)) : null))];
    }
    function render() {
        const o = host.current();
        if (!s || !o || o.key !== s.key)
            return;
        const back = (label) => h('button', { type: 'button', class: 'rr-back', onclick: backToReading }, h('span', { 'aria-hidden': 'true' }, '←'), label);
        const body = h('div', { class: 'lens-body rr-body' });
        if (s.view.kind === 'source')
            put(body, back('정리로'), ...sourceBody(s.view.source, s.view.from));
        else if (s.view.kind === 'material') {
            const all = sources();
            put(body, back('정리로'), h('section', { class: 'rr-sec rr-material' }, h('h3', {}, '원자료', h('small', {}, `${all.length}`)), h('ol', {}, ...all.map(x => h('li', {}, h('button', { type: 'button', class: 'rr-src', onclick: () => openSource(x, 'material') }, h('span', { class: `rr-kind k-${x.kind}` }, DIGEST_KIND_LABEL[x.kind]), h('strong', {}, x.title), h('small', {}, [versionOf(x.basis), x.partIds.map(partName).join(' · ')].filter(Boolean).join(' · '))))))));
        }
        else
            put(body, ...readingBody(o));
        host.show([header(o), body, footer(o)]);
        host.mark(s.view.kind === 'source' ? s.view.source.partIds : focusParts());
    }
    function openSource(source, from) {
        if (!s)
            return;
        if (s.view.kind === 'reading')
            s.scroll = document.querySelector('#lens .lens-body')?.scrollTop ?? 0;
        s.view = { kind: 'source', source: structuredClone(source), from };
        render();
        requestAnimationFrame(() => document.querySelector('#lens .rr-back')?.focus());
    }
    function backToReading() {
        if (!s)
            return;
        s.view = { kind: 'reading' };
        render();
        const body = document.querySelector('#lens .lens-body');
        if (body)
            body.scrollTop = s.scroll;
    }
    return {
        isOpen: () => !!s,
        open, close, toggle: () => (s ? close() : open()),
        /** Re-render (the pane came back after a part's reading, or the AI status arrived). */
        render: () => { if (s) {
            render();
            void refresh();
        } },
        /** Esc: from a source back to the reading, else close. */
        escape: () => { if (!s)
            return; if (s.view.kind !== 'reading')
            backToReading();
        else
            close(); },
        projectChanged: () => { if (s && host.current()?.key !== s.key) {
            s.pending?.abort();
            s = null;
            host.mark([]);
        } }
    };
}
