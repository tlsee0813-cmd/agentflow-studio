import { createPlan, selectItems, requestSnapshot, compareResults, parseScopeReview } from '../shared/change-plan.js';
import { CONVERTER_INTENT, converterEvidence, converterExampleAnalysis, converterObservations } from '../shared/change-plan-example.js';
import { AskError, ERROR_TEXT } from './studio-api.js';
import { h, put, $, ago, fullTime, inspectorWidth } from './plan-dom.js';
import { CONVERTER_KEY, CONDITION_LABEL, EVIDENCE_LABEL, exampleInput, projectInput, mapReply, secretLike, scopeInput } from './plan-source.js';
import { requestPlan, requestScope } from './plan-request.js';
import { emptyBundle, loadBundle, saveBundle, setAside, planFile, readPlanFile } from './plan-store.js';
const MEMORY = new Map();
const memoryKey = (o, c) => (o.key === CONVERTER_KEY ? `${o.key}#${c}` : o.project.id);
const short = (text, n) => { const t = text.replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n)}…` : t; };
export function createPlanView(host) {
    let s = null;
    let moveTarget = false;
    /** The whole plan just came to read: frame all its changed parts once (then the camera is the person's). */
    let frameWhole = false;
    /* ---------- bundles ---------- */
    function keysOf(o) { return Object.fromEntries(o.alias?.toId ?? []); }
    function exampleBundle(o, c) {
        let plan = createPlan(o.project.id, `합성 예제 자료 · ${CONDITION_LABEL[c]} · main@S0`, CONVERTER_INTENT, converterEvidence(c), converterExampleAnalysis(keysOf(o), c));
        // Condition B's prerequisite is a separate item: first selection is what the person asked for directly.
        if (c === 'B')
            plan = selectItems(plan, plan.analysis.items.filter(i => i.id !== 'outcomes').map(i => i.id));
        return { ...emptyBundle(CONVERTER_INTENT), plan, by: { kind: 'example' } };
    }
    function bundleFor(o, c) {
        const k = memoryKey(o, c), cached = MEMORY.get(k);
        if (cached)
            return { bundle: cached, unreadable: false };
        if (o.kind === 'example') {
            const b = o.key === CONVERTER_KEY ? exampleBundle(o, c) : emptyBundle();
            MEMORY.set(k, b);
            return { bundle: b, unreadable: false };
        }
        const loaded = loadBundle(host.kv, o.project.id);
        if (!loaded.unreadable)
            MEMORY.set(k, loaded.bundle);
        return loaded;
    }
    /** Saved projects: every change goes to the plan key and is read back; a failed write stays visible until one succeeds. */
    function persist() {
        const o = host.current();
        if (!s || !o)
            return;
        MEMORY.set(memoryKey(o, s.condition), s.bundle);
        if (o.kind !== 'saved')
            return;
        if (s.unreadable) {
            s.storeMsg = '읽지 못한 변경안이 있어 이 탭에서만 유지하고 저장하지 않아요.';
            return;
        }
        s.storeMsg = saveBundle(host.kv, o.project.id, s.bundle);
    }
    /* ---------- open / close ---------- */
    function open() {
        const o = host.current();
        if (!o || o.kind === 'legacy')
            return;
        if (s && s.key === o.key)
            return;
        const condition = 'A', { bundle, unreadable } = bundleFor(o, condition);
        s = { key: o.key, projectId: o.project.id, example: o.kind === 'example', condition, bundle, unreadable, storeMsg: null,
            focus: firstFocus(bundle.plan), targets: {}, mode: bundle.plan ? 'preview' : 'current', editing: !bundle.plan, detail: false, strip: null, evidenceFor: null, explain: false, pending: null, error: null, scoping: null, scopeError: null,
            sheet: null, sources: false, adding: false, resultFor: bundle.snapshots.at(-1)?.id ?? null, addForm: false, copyMsg: null, fileMsg: null, ret: host.capture() };
        if (unreadable)
            s.storeMsg = null;
        moveTarget = true;
        frameWhole = true;
        host.chrome();
        render();
        requestAnimationFrame(() => (document.getElementById('plan-intent') ?? document.getElementById('plan-title'))?.focus());
    }
    /** Closing keeps the draft and the plan; the map goes back to the latest current view with the earlier selection and camera. */
    function close(restore = true) {
        if (!s)
            return;
        s.pending?.controller.abort();
        s.scoping?.controller.abort();
        const ret = s.ret;
        s = null;
        host.rows(null);
        host.targetContext(null, false);
        $('plan-panel').hidden = true;
        $('plan-panel').replaceChildren();
        $('plan-mode').hidden = true;
        $('plan-sheet').hidden = true;
        $('plan-strip').hidden = true;
        $('plan-strip').replaceChildren();
        host.surface(null, [], false);
        lastFocusKey = '';
        lastShown = '';
        host.chrome();
        overlay();
        if (restore) {
            host.restore(ret);
            host.notice('변경 구상을 닫았어요. 초안과 변경안은 그대로 남아 있어요.', { label: '다시 열기', run: open });
        }
    }
    /** A different project was opened: the plan of the previous one is kept, nothing to restore. */
    function projectChanged() { if (s && host.current()?.key !== s.key)
        close(false); }
    /* ---------- derived ---------- */
    /** The comparison opens on one change: the first one handed over, else the first. */
    function firstFocus(p) {
        const first = p?.analysis.items.find(i => p.selected.includes(i.id)) ?? p?.analysis.items[0];
        return first ? { kind: 'item', id: first.id } : null;
    }
    const plan = () => s?.bundle.plan ?? null;
    const items = () => plan()?.analysis.items ?? [];
    const itemOf = (id) => items().find(i => i.id === id) ?? null;
    const partName = (id) => host.current()?.view.parts.find(p => p.id === id)?.name ?? null;
    function itemTargets(item) {
        const parts = host.current()?.view.parts ?? [], ids = new Set(item.partIds);
        for (const id of [...ids])
            for (let p = parts.find(x => x.id === id)?.parentId, g = 0; p && g < 64; p = parts.find(x => x.id === p)?.parentId, g++)
                ids.delete(p);
        // Presentation is optional per part: an excerpt enriches its target without dropping other explicit targets or
        // reordering them (the change's own order, as on the map).
        return [...new Set([...ids, ...(item.presentation ?? []).map(x => x.partId)])];
    }
    function activeTarget(item) {
        const ids = itemTargets(item), previous = s.targets[item.id];
        const id = previous && ids.includes(previous) ? previous : ids[0] ?? null;
        if (id)
            s.targets[item.id] = id;
        return id;
    }
    function chooseTarget(item, id, keyboard = false) {
        if (!s)
            return;
        s.targets[item.id] = id;
        s.focus = { kind: 'item', id: item.id };
        s.mode = 'preview';
        s.evidenceFor = null;
        if (host.selected())
            host.selectPart(null);
        moveTarget = true;
        render();
        const at = visibleRep(id, host.boxes());
        if (!at)
            host.showPart(id);
        requestAnimationFrame(() => {
            const tab = document.querySelector(`.ps-target[data-target="${CSS.escape(id)}"]`);
            tab?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            if (keyboard)
                tab?.focus({ preventScroll: true });
        });
    }
    const stale = () => { const p = plan(); return !!p && !!s && s.bundle.draft.trim() !== p.intent; };
    function input() {
        const o = host.current();
        if (!o || !s || !s.bundle.draft.trim())
            return null;
        return o.key === CONVERTER_KEY ? exampleInput(o, s.condition, s.bundle.draft, o.alias.toId) : projectInput(o, s.bundle.draft, s.bundle.extra);
    }
    /** Parts linked to an item's parts: same part, a recorded relation, or a parent/child. Used to show an item's impacts. */
    function nearImpacts(item) {
        const o = host.current(), mine = new Set(item.partIds), rel = o.view.relations;
        const parentOf = (id) => o.view.parts.find(p => p.id === id)?.parentId ?? null;
        return (plan()?.analysis.impacts ?? []).filter(x => !mine.has(x.partId) && [...mine].some(m => rel.some(r => (r.from === m && r.to === x.partId) || (r.to === m && r.from === x.partId)) || parentOf(m) === x.partId || parentOf(x.partId) === m));
    }
    const missingDeps = (item) => item.dependsOn.filter(d => !plan().selected.includes(d));
    const latestSnapshot = () => s?.bundle.snapshots.at(-1) ?? null;
    const snapshotOf = (id) => s?.bundle.snapshots.find(x => x.id === id) ?? null;
    /** Per actual target part, every change that names it, with its own text: from the plan alone, independent of the layout. */
    function rowChanges(p) {
        const out = new Map();
        for (const item of p.analysis.items)
            for (const id of itemTargets(item)) {
                const pres = item.presentation?.find(x => x.partId === id) ?? null;
                out.set(id, [...(out.get(id) ?? []), { item, text: pres ? pres.wanted.text : item.title, pres }]);
            }
        return out;
    }
    const kindWord = (c) => (!c.pres ? '변경' : c.pres.origin === 'suggestion' ? '제안' : '');
    const manyLine = (list) => list.map(c => c.item.title).join(', ');
    /** The impact candidates the map names for what is being read: near the focused change, or all when reading the impacts. */
    function shownImpacts(p) {
        const focusItem = s?.focus?.kind === 'item' ? itemOf(s.focus.id) : null;
        return focusItem ? nearImpacts(focusItem) : s?.focus?.kind === 'impacts' ? p.analysis.impacts : [];
    }
    /** What the comparison scene shows on parts' rows (every target's change line, whichever change is being read, and the
     * candidates named for the current reading): the same set the overlay draws, so no row keeps an empty line. The map holds
     * these sizes in both the current view and the preview while the plan is open. */
    function rowLines(p) {
        const out = new Map();
        for (const [id, list] of rowChanges(p))
            out.set(id, [...list.map(c => `${kindWord(c)} ${c.text}${list.length > 1 ? ` 외 ${list.length - 1}건` : ''}`), ...(list.length > 1 ? [`변경 ${list.length}건 ${manyLine(list)}`] : [])]);
        for (const x of shownImpacts(p))
            if (!out.has(x.partId))
                out.set(x.partId, ['영향 후보']);
        return out;
    }
    /* Existing relations read as context of the change being read: lines already on the map between its actual targets and the
       candidates named here, and from those candidates to other parts the analysis names as candidates (a shared node's other
       users). They move above the group surfaces and keep their own kind and hover meaning; nothing is drawn or inferred, and
       no line is restyled as required or verified. */
    function contextEdges(p, rep, targets, shown) {
        document.querySelectorAll('#world .edge.ctx').forEach(e => e.classList.remove('ctx'));
        document.querySelectorAll('#world .plan-ctx').forEach(e => e.classList.remove('plan-ctx'));
        const anchors = new Set([...targets, ...shown.map(x => x.partId)].map(rep).filter((x) => !!x));
        const named = new Set(shown.map(x => rep(x.partId)).filter((x) => !!x));
        const others = new Set(p.analysis.impacts.map(x => rep(x.partId)).filter((x) => !!x));
        const top = document.querySelector('#world .edges-top');
        document.querySelectorAll('#world .edge').forEach(e => {
            const a = e.dataset.from, b = e.dataset.to;
            const ctx = a !== b && ((anchors.has(a) && anchors.has(b) && (named.has(a) || named.has(b))) || (named.has(a) && others.has(b)) || (named.has(b) && others.has(a)));
            if (!ctx)
                return;
            e.classList.add('ctx');
            if (top && e.parentNode !== top)
                top.append(e);
            // Both ends stay readable (not dimmed with the rest); an end gets no label it does not already have.
            for (const id of [a, b])
                document.querySelector(`#world [data-box="${CSS.escape(id)}"]`)?.classList.add('plan-ctx');
        });
        // Lines no longer in context go back under the groups unless the selection holds them.
        const base = document.querySelector('#world .edges:not(.edges-top)');
        document.querySelectorAll('#world .edges-top .edge:not(.ctx):not(.on):not(.inner)').forEach(e => base?.append(e));
    }
    function overlay() {
        document.querySelectorAll('.plan-direct,.plan-impact,.plan-focus,.plan-reading,.plan-reading-now').forEach(el => { el.classList.remove('plan-direct', 'plan-impact', 'plan-focus', 'plan-reading', 'plan-reading-now'); el.removeAttribute('data-plan-title'); });
        document.querySelectorAll('.plan-note').forEach(el => { el.replaceChildren(); el.removeAttribute('title'); el.className = 'plan-note'; });
        document.querySelectorAll('.plan-badge').forEach(el => el.remove());
        $('space').classList.toggle('planning', !!s);
        $('space').classList.toggle('preview', !!s && s.mode === 'preview' && !!plan());
        $('space').classList.toggle('focusing', !!s && s.mode === 'preview' && !!s.focus);
        const p = plan();
        if (!s || !p) {
            document.querySelectorAll('#world .edge.ctx').forEach(e => e.classList.remove('ctx'));
            document.querySelectorAll('#world .plan-ctx').forEach(e => e.classList.remove('plan-ctx'));
            return;
        }
        const o = host.current(), boxes = host.boxes(), rep = (id) => visibleRep(id, boxes);
        // Drawn part → its own changes (the part itself is the target) and the inner targets it stands for.
        const own = rowChanges(p), marks = new Map();
        for (const [id, list] of own) {
            const r = rep(id);
            if (!r)
                continue;
            const m = marks.get(r) ?? { items: [], inner: [] };
            for (const c of list)
                if (!m.items.includes(c.item))
                    m.items.push(c.item);
            if (r !== id)
                m.inner.push(id);
            marks.set(r, m);
        }
        const focusItem = s.focus?.kind === 'item' ? itemOf(s.focus.id) : null;
        const focused = new Set((focusItem ? itemTargets(focusItem) : []).map(rep).filter((x) => !!x));
        const reading = focusItem ? rep(activeTarget(focusItem) ?? '') : null;
        const impacts = shownImpacts(p).filter(x => !marks.has(rep(x.partId) ?? ''));
        // Existing relations read the same in the current view and the preview; only the change marks below are the preview's.
        contextEdges(p, rep, focusItem ? itemTargets(focusItem) : [], impacts);
        const el = (id) => document.querySelector(`.node[data-box="${CSS.escape(id)}"], .frame[data-box="${CSS.escape(id)}"]`);
        // The current view keeps only where the pane is reading (a neutral mark, no change words): the comparison and the map stay
        // matched while the change itself is hidden.
        if (s.mode !== 'preview') {
            if (reading)
                el(reading)?.classList.add('plan-reading-now');
            return;
        }
        const kind = (word) => (word ? h('span', { class: 'pn-k' }, word) : null), gap = (word) => (word ? ' ' : null);
        for (const [id, m] of marks) {
            const e = el(id);
            if (!e)
                continue;
            e.classList.add('plan-direct');
            if (focused.has(id))
                e.classList.add('plan-focus');
            if (reading === id)
                e.classList.add('plan-reading');
            e.dataset.planTitle = m.items.map(i => i.title).join('\n');
            const note = e.querySelector('.plan-note');
            if (!note)
                continue;
            const list = own.get(id) ?? [];
            if (list.length) {
                const mine = list.length > 1 && focusItem ? list.find(c => c.item === focusItem) ?? null : list.length === 1 ? list[0] : null;
                if (mine)
                    put(note, kind(kindWord(mine)), gap(kindWord(mine)), mine.text, list.length > 1 ? h('span', { class: 'pn-more' }, ` 외 ${list.length - 1}건`) : null);
                else
                    put(note, kind(`변경 ${list.length}건`), ' ', manyLine(list));
                note.title = list.map(c => `${c.item.title}${c.pres ? ` · ${c.pres.origin === 'suggestion' ? '분석 제안' : '바꿀 모습'}: ${c.text}` : ' (이 부분의 바꿀 모습 자료 없음)'}`).join('\n') + '\n아직 적용 안 됨';
                if (m.inner.length)
                    note.title += `\n안쪽에도 변경: ${m.inner.map(partName).join(', ')}`;
            }
            else {
                note.classList.add('inner');
                put(note, kind('안쪽'), ' ', `‘${m.inner.map(partName).join('’, ‘')}’ 변경`);
                note.title = `안쪽 부분을 바꾸려는 변경(아직 적용 안 됨): ${m.items.map(i => i.title).join(', ')}\n이 부분 전체를 바꾸는 것은 아니에요.`;
            }
        }
        for (const x of impacts) {
            const r = rep(x.partId), e = r ? el(r) : null;
            if (!e || e.classList.contains('plan-impact'))
                continue;
            e.classList.add('plan-impact');
            const note = e.querySelector('.plan-note');
            if (note) {
                note.classList.add('inner');
                note.textContent = `${r !== x.partId ? `안쪽 ‘${partName(x.partId)}’ · ` : ''}영향 후보`;
                note.title = `영향 후보: ${x.reason}`;
            }
        }
    }
    /* ---------- notes beside the parts: what a part is now → the difference wanted ----------
       Outside the structure: no node, no port, no relation, no place in the layout. With presentation data, its short quotes on
       the same side and where they come from (the map's description, or a cited source: '자료에서', not the product as it is).
       Without, no pair: the change's name for this part, and the part's own description apart as its role in the map, never as
       what it does now. One target reads at a time; all targets of the change remain marked on the map and named in the target
       navigation. */
    /** The part's own description as its role on the map (first sentence), with where it comes from; never a current state. */
    function partRole(o, id) {
        const part = o.view.parts.find(x => x.id === id), firstSentence = (t) => { const m = /^(.+?[.!?。])(?=\s|$)/.exec(t.replace(/\s+/g, ' ').trim()); return m ? m[1] : t.trim(); };
        return part?.note ? { text: firstSentence(part.note), from: '지도 설명', label: '이 부분의 역할' } : part?.summary ? { text: firstSentence(part.summary), from: '받은 정리', label: '이 부분의 맥락' } : null;
    }
    function calloutNote(o, p, item, partId, pres, at) {
        const st = s, name = o.view.parts.find(x => x.id === partId)?.name ?? '부분';
        const kind = pres?.origin ?? null;
        const head = h('p', { class: 'co-head' }, h('span', { class: 'co-kind' }, kind === 'intent' ? '원하는 차이' : kind === 'suggestion' ? '분석 제안' : '변경 항목'), h('strong', {}, name), at !== partId ? h('small', {}, `‘${partName(at)}’ 안쪽`) : null);
        if (!pres) {
            const role = partRole(o, partId);
            return h('div', { class: 'callout plain', 'data-box': at, 'data-target': partId, role: 'note', 'aria-label': `${name} · 변경 항목` }, head, h('div', { class: 'co-fallback' }, h('div', { class: 'co-row want' }, h('span', { class: 'co-label' }, '바꿀 내용'), h('p', {}, item.title)), role ? h('div', { class: 'co-role' }, h('span', { class: 'co-label' }, role.label), h('p', {}, role.text, h('small', {}, role.from))) : null, h('p', { class: 'co-gap' }, '현재와의 비교는 아직 정리 전이에요.')));
        }
        let from = '지도 설명';
        if (pres.current.source === 'evidence') {
            const ev = p.evidence.filter(e => pres.current.refs.includes(e.id));
            from = h('button', { type: 'button', class: 'co-src', title: ev.map(e => `${e.id} · ${e.title} · ${e.basis}`).join('\n'), onclick: () => { st.evidenceFor = item.id; render(); } }, `자료에서 · ${pres.current.refs.join(', ')}`);
        }
        return h('div', { class: `callout ${kind}`, 'data-box': at, 'data-target': partId, role: 'note', 'aria-label': `${name} · 변경 구상` }, head, h('div', { class: 'co-pair' }, h('div', { class: 'co-row now' }, h('span', { class: 'co-label' }, pres.current.source === 'evidence' ? '자료상' : '현재 설명'), h('p', {}, pres.current.text, h('small', {}, from))), h('div', { class: 'co-row want' }, h('span', { class: 'co-label' }, kind === 'suggestion' ? '제안' : '바꿀 모습'), h('p', {}, pres.wanted.text))));
    }
    /** The part itself when it is drawn in this view, else its nearest drawn ancestor; null outside the view. */
    function visibleRep(id, boxes) {
        const o = host.current();
        for (let cur = id, g = 0; cur && g < 64; cur = o.view.parts.find(x => x.id === cur)?.parentId ?? null, g++) {
            const b = boxes.get(cur);
            if (b && b.kind !== 'ghost')
                return cur;
        }
        return null;
    }
    /** Where the request's changes sit on the map: what opening frames at a readable size. */
    function changedParts() {
        const p = plan();
        if (!p)
            return [];
        const chosen = p.analysis.items.filter(i => p.selected.includes(i.id)), from = chosen.length ? chosen : p.analysis.items, boxes = host.boxes();
        return [...new Set(from.flatMap(i => i.partIds).map(id => visibleRep(id, boxes)).filter((x) => !!x))];
    }
    function focusItem(next) {
        if (!s)
            return;
        const same = JSON.stringify(s.focus) === JSON.stringify(next);
        if (next?.kind === 'item' && host.selected())
            host.selectPart(null);
        s.focus = same ? null : next;
        s.evidenceFor = null;
        if (s.focus && plan())
            s.mode = 'preview';
        moveTarget = !!s.focus;
        render();
    }
    /* ---------- actions ---------- */
    const needsCode = () => host.status().access === 'code' && !host.accessCode();
    async function analyze() {
        if (!s || s.pending)
            return;
        const o = host.current(), inp = input();
        s.error = null;
        if (!inp) {
            s.error = '바꾸고 싶은 모습을 먼저 적어 주세요.';
            render();
            return;
        }
        if (inp.problem === 'TOO_LARGE') {
            s.error = '보낼 자료가 요청 한도보다 커서 보내지 않았어요. 문장과 초안은 그대로예요.';
            render();
            return;
        }
        if (inp.problem) {
            s.error = `‘${inp.problem.secret}’에 키나 토큰처럼 보이는 문자열이 있어 보내지 않았어요. 그 부분을 지운 뒤 다시 살펴보세요.`;
            render();
            return;
        }
        if (host.status().ai !== 'deepseek') {
            s.error = host.status().ai === 'off' ? ERROR_TEXT.AI_NOT_CONFIGURED : ERROR_TEXT.NO_SERVER;
            render();
            return;
        }
        if (needsCode()) {
            s.error = '접속 코드를 입력해 주세요.';
            render();
            document.getElementById('plan-access')?.focus();
            return;
        }
        const controller = new AbortController(), session = s;
        s.pending = { controller, input: inp };
        render();
        try {
            const res = await requestPlan(inp.ask, controller.signal, host.accessCode());
            let analysis;
            try {
                analysis = mapReply(res.reply, inp);
            }
            catch {
                throw new AskError('INVALID_RESPONSE');
            }
            const next = createPlan(o.project.id, inp.basis, inp.ask.intent, inp.evidence, analysis);
            session.bundle = { ...session.bundle, plan: next, by: { kind: 'ai', model: res.model, at: new Date().toISOString(), records: inp.records } };
            session.mode = 'preview';
            session.focus = firstFocus(next);
            session.targets = {};
            session.editing = false;
            session.detail = false;
            moveTarget = true;
            frameWhole = true;
            if (s === session)
                persist();
        }
        catch (e) {
            const code = e instanceof AskError ? e.code : 'REQUEST_FAILED';
            if (code !== 'CANCELLED')
                session.error = ERROR_TEXT[code] ?? `분석을 받지 못했어요 (${code}). 문장과 초안은 그대로예요.`;
        }
        session.pending = null;
        if (s === session)
            render();
    }
    function toggleItem(id, on) {
        const p = plan();
        if (!s || !p)
            return;
        const next = on ? [...p.selected, id] : p.selected.filter(x => x !== id);
        s.bundle = { ...s.bundle, plan: selectItems(p, next) };
        s.scopeError = null;
        persist();
        render();
    }
    /** Authored example: its fixed, checked dependencies and the static document. AI analysis: the chosen scope is reviewed
     * once, here and only here; its global dependsOn is not treated as settled. */
    function makeRequest() {
        const p = plan();
        if (!s || !p || !p.selected.length || s.scoping)
            return;
        s.scopeError = null;
        if (s.bundle.by?.kind === 'example') {
            keepSnapshot(p, requestSnapshot(p));
            return;
        }
        void reviewScope(p);
    }
    async function reviewScope(p) {
        const st = s, o = host.current(), notMade = '전제 검토를 마치지 못해 새 요청문은 만들지 않았어요. 초안과 이전 요청문은 그대로예요.';
        const say = (text) => { st.scopeError = text; render(); };
        if (host.status().ai !== 'deepseek')
            return say(`${host.status().ai === 'off' ? ERROR_TEXT.AI_NOT_CONFIGURED : ERROR_TEXT.NO_SERVER} ${notMade}`);
        if (needsCode()) {
            st.editing = false;
            say(`접속 코드를 입력한 뒤 다시 만들어 주세요. ${notMade}`);
            document.getElementById('plan-access')?.focus();
            return;
        }
        const inp = scopeInput(o, p);
        if (inp.problem === 'TOO_LARGE')
            return say(`검토할 자료가 요청 한도보다 커요. ${notMade}`);
        if (inp.problem)
            return say(`‘${inp.problem.secret}’에 키나 토큰처럼 보이는 문자열이 있어 보내지 않았어요. ${notMade}`);
        const start = { key: st.key, projectId: p.projectId, id: p.id, revision: p.revision, basis: p.basis };
        const controller = new AbortController();
        st.scoping = { controller, count: p.selected.length };
        render();
        try {
            const res = await requestScope(inp.ask, controller.signal, host.accessCode());
            let review;
            try {
                review = parseScopeReview(res.reply, p.evidence.map(e => e.id));
            }
            catch {
                throw new AskError('INVALID_RESPONSE');
            }
            // Apply only to the plan and view it was asked for: same open plan, same project, plan id, revision and basis.
            const now = s === st ? plan() : null;
            if (!now || host.current()?.key !== start.key || now.projectId !== start.projectId || now.id !== start.id || now.revision !== start.revision || now.basis !== start.basis || stale()) {
                st.scopeError = '검토하는 동안 변경안이나 고른 항목이 바뀌어 이 검토는 쓰지 않았어요. 요청문을 다시 만들어 주세요.';
            }
            else {
                st.scoping = null;
                keepSnapshot(now, requestSnapshot(now, review), 'reviewed');
                return;
            }
        }
        catch (e) {
            const code = e instanceof AskError ? e.code : 'REQUEST_FAILED';
            st.scopeError = code === 'CANCELLED' ? `취소했어요. ${notMade}` : `${ERROR_TEXT[code] ?? `검토 응답을 받지 못했어요 (${code}).`} ${notMade}`;
        }
        st.scoping = null;
        if (s === st)
            render();
    }
    function keepSnapshot(p, snap, origin = 'example') {
        if (!s)
            return;
        s.bundle = { ...s.bundle, snapshots: [...s.bundle.snapshots, snap].slice(-60),
            labels: { ...s.bundle.labels, [snap.id]: Object.fromEntries(p.analysis.items.map(i => [i.id, i.title])) },
            origins: { ...s.bundle.origins, [snap.id]: origin } };
        // Keep the bundle within its limit: an observation goes with the snapshot it was read against.
        const kept = new Set(s.bundle.snapshots.map(x => x.id));
        for (const k of Object.keys(s.bundle.labels))
            if (!kept.has(k))
                delete s.bundle.labels[k];
        for (const k of Object.keys(s.bundle.origins))
            if (!kept.has(k))
                delete s.bundle.origins[k];
        s.bundle.observations = s.bundle.observations.filter(x => kept.has(s.bundle.attached[x.id]));
        for (const k of Object.keys(s.bundle.attached))
            if (!kept.has(s.bundle.attached[k]))
                delete s.bundle.attached[k];
        s.sheet = snap.id;
        s.resultFor = snap.id;
        s.copyMsg = null;
        persist();
        render();
        requestAnimationFrame(() => document.getElementById('plan-copy')?.focus());
    }
    function attach(snapshot, obs) {
        if (!s)
            return;
        s.bundle = { ...s.bundle, observations: [...s.bundle.observations, ...obs], attached: { ...s.bundle.attached, ...Object.fromEntries(obs.map(x => [x.id, snapshot.id])) } };
        persist();
        render();
    }
    /** Authored example results, for snapshots of the authored analysis only; matched by the authored item ids, nothing else. */
    function loadExampleResults(snapshot) {
        const n = s.bundle.snapshots.indexOf(snapshot) + 1;
        attach(snapshot, converterObservations().map(x => ({ ...x, id: `${x.id}-${n}` })));
    }
    async function copy(text) {
        if (!s)
            return;
        try {
            await navigator.clipboard.writeText(text);
            s.copyMsg = '복사했어요. 작업 AI에 붙여 넣어 전달하세요.';
        }
        catch {
            s.copyMsg = '자동 복사가 막혀 있어요. 글을 선택해 직접 복사하세요.';
            const pre = document.querySelector('#plan-sheet pre');
            if (pre) {
                const r = document.createRange();
                r.selectNodeContents(pre);
                const sel = getSelection();
                sel?.removeAllRanges();
                sel?.addRange(r);
            }
        }
        renderSheet();
    }
    function exportPlan() {
        const o = host.current();
        if (!s || !o)
            return;
        const blob = new Blob([planFile(s.bundle, o.project)], { type: 'application/json' }), a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${o.project.name.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60) || 'project'}-변경안.json`;
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        s.fileMsg = '변경안 파일을 내려받았어요. 프로젝트 백업과는 따로예요.';
        render();
    }
    function importPlan() { $('plan-import-file').click(); }
    {
        const file = $('plan-import-file');
        file.addEventListener('change', async () => {
            const f = file.files?.[0];
            file.value = '';
            const o = host.current();
            if (!f || !s || !o)
                return;
            if (f.size > 4_000_000) {
                s.fileMsg = '파일이 너무 커요. 아무것도 바꾸지 않았어요.';
                render();
                return;
            }
            const read = readPlanFile(await f.text(), o.project.id);
            if (typeof read === 'string') {
                s.fileMsg = read;
                render();
                return;
            }
            if ((s.bundle.plan || s.bundle.snapshots.length) && !confirm('지금 변경안을 가져온 파일의 내용으로 바꿀까요? 지금 안을 남기려면 먼저 파일로 내보내 두세요.'))
                return;
            s.bundle = read;
            s.focus = firstFocus(read.plan);
            s.targets = {};
            s.mode = read.plan ? 'preview' : 'current';
            s.editing = !read.plan;
            s.resultFor = read.snapshots.at(-1)?.id ?? null;
            moveTarget = true;
            frameWhole = true;
            persist();
            s.fileMsg = s.storeMsg ? null : '변경안 파일을 가져왔어요.';
            render();
        });
    }
    function startOver() {
        const o = host.current();
        if (!s || !o)
            return;
        const failed = setAside(host.kv, o.project.id);
        if (failed) {
            s.storeMsg = failed;
            render();
            return;
        }
        s.unreadable = false;
        persist();
        render();
    }
    function setCondition(c) {
        const o = host.current();
        if (!s || !o || s.condition === c)
            return;
        MEMORY.set(memoryKey(o, s.condition), s.bundle);
        s.condition = c;
        s.bundle = bundleFor(o, c).bundle;
        s.focus = firstFocus(s.bundle.plan);
        s.targets = {};
        s.error = null;
        s.mode = s.bundle.plan ? 'preview' : 'current';
        moveTarget = true;
        frameWhole = true;
        s.resultFor = s.bundle.snapshots.at(-1)?.id ?? null;
        s.editing = !s.bundle.plan;
        render();
    }
    /* ---------- rendering ---------- */
    function render() {
        if (!s)
            return;
        const o = host.current();
        if (!o)
            return;
        // The comparison scene (the target's path and the rows' sizes) is the same in the current view and the preview: switching
        // the mode shows or hides the change marks only. Closing the plan gives the map back its own folds and sizes.
        const item = s.focus?.kind === 'item' ? itemOf(s.focus.id) : null, p = plan();
        host.rows(p ? rowLines(p) : null);
        host.targetContext(item ? activeTarget(item) : null, moveTarget);
        renderMode();
        renderStrip(o);
        if (panelOpen())
            renderPanel(o);
        else {
            $('plan-panel').hidden = true;
            $('plan-panel').replaceChildren();
        }
        renderSheet();
        overlay();
        renderCompare(o);
        host.area();
    }
    /** The right panel opens for writing (no plan yet, editing, a stale sentence, work in progress) or when asked for the whole
     * plan; otherwise the plan reads on the map: its strip and one comparison. */
    const panelOpen = () => !!s && (!plan() || s.editing || stale() || !!s.pending || !!s.scoping || s.detail);
    const width = () => (s && panelOpen() ? inspectorWidth() : 0);
    /* ---------- the plan's strip: what is being tried, the changes, and the way to the whole plan ---------- */
    function renderStrip(o) {
        const strip = $('plan-strip'), st = s, p = plan();
        strip.hidden = false;
        const close = h('button', { type: 'button', class: 'close ps-close', 'aria-label': '변경 구상 닫기', title: '변경 구상 닫기 (Esc) · 초안은 남아요', onclick: () => closePlan() }, '×');
        if (!p) {
            strip.replaceChildren();
            put(strip, h('div', { class: 'ps-head' }, h('span', { class: 'ps-kicker' }, '변경 구상'), st.example ? h('span', { class: 'tag' }, '예제') : null, h('span', { class: 'ps-intent' }, '오른쪽에 바꾸고 싶은 모습을 적어 주세요')), close);
            return;
        }
        const by = st.bundle.by, basis = by?.kind === 'example' ? '작성된 예제 분석' : by?.kind === 'ai' ? `AI 분석 · ${ago(by.at)}` : '분석';
        const focusId = st.focus?.kind === 'item' ? st.focus.id : null;
        const conds = p.analysis.preserve.length + p.analysis.unknowns.length;
        strip.replaceChildren();
        put(strip, h('div', { class: 'ps-head' }, h('span', { class: 'ps-kicker', title: by?.kind === 'ai' ? `${by.model} · ${fullTime(by.at)}` : '' }, '변경 구상', h('small', {}, basis)), h('button', { type: 'button', class: 'ps-intent', title: `${p.intent}\n\n문장 고치기·근거·요청문은 ‘자세히’`, onclick: () => { st.detail = true; render(); } }, p.intent)), h('div', { class: 'ps-row' }, h('div', { class: 'ps-items', role: 'group', 'aria-label': '바꾸려는 것' }, ...p.analysis.items.map(i => h('button', { type: 'button', class: 'ps-item', 'aria-pressed': String(focusId === i.id), title: p.selected.includes(i.id) ? '이번 요청에 맡기는 변경' : '이번 요청에서 빠진 변경', onclick: () => focusItem({ kind: 'item', id: i.id }) }, h('span', { class: `ps-hand${p.selected.includes(i.id) ? ' on' : ''}`, 'aria-hidden': 'true' }), i.title))), conds ? conditions(p) : null), h('button', { type: 'button', class: 'ps-more', 'aria-pressed': String(st.detail), onclick: () => { st.detail = !st.detail; render(); } }, st.detail ? '지도 비교로' : '자세히'), close);
    }
    function targetNav(item) {
        const ids = itemTargets(item), active = activeTarget(item);
        if (ids.length < 2)
            return null;
        const tabs = h('div', { class: 'ps-target-tabs', role: 'tablist', 'aria-label': `‘${item.title}’에서 바뀌는 부분` }, ...ids.map(id => h('button', { type: 'button', class: 'ps-target', role: 'tab', 'data-target': id, 'aria-selected': String(id === active), tabindex: id === active ? '0' : '-1',
            title: `${partName(id) ?? '부분'}${visibleRep(id, host.boxes()) !== id ? ' · 안쪽의 실제 부분' : ''}`, onclick: () => chooseTarget(item, id) }, partName(id) ?? '부분')));
        tabs.addEventListener('keydown', e => {
            const at = ids.indexOf(active ?? '');
            const next = e.key === 'ArrowRight' ? (at + 1) % ids.length : e.key === 'ArrowLeft' ? (at + ids.length - 1) % ids.length : e.key === 'Home' ? 0 : e.key === 'End' ? ids.length - 1 : -1;
            if (next < 0)
                return;
            e.preventDefault();
            chooseTarget(item, ids[next], true);
        });
        return h('nav', { class: 'ps-targets', 'aria-label': '읽을 변경 대상' }, h('span', { class: 'ps-target-label' }, `바뀌는 부분 ${ids.length}`), tabs);
    }
    /** The change being read: hand it over or not, read its explanation, open its sources. */
    function focusControls(p, item) {
        const st = s, refs = p.evidence.filter(e => item.refs.includes(e.id)).length, box = h('input', { type: 'checkbox', id: `ps-hand-${item.id}` });
        box.checked = p.selected.includes(item.id);
        box.addEventListener('change', () => toggleItem(item.id, box.checked));
        return h('div', { class: 'ps-focus', role: 'group', 'aria-label': `‘${item.title}’` }, h('label', { class: 'cmp-hand', for: `ps-hand-${item.id}` }, box, h('span', {}, '맡기기')), h('button', { type: 'button', class: 'ps-link', 'aria-pressed': String(st.explain), onclick: () => { st.explain = !st.explain; st.evidenceFor = null; render(); } }, st.explain ? '짧게 보기' : '설명'), refs ? h('button', { type: 'button', class: 'ps-link', 'aria-pressed': String(st.evidenceFor === item.id), onclick: () => { st.evidenceFor = st.evidenceFor === item.id ? null : item.id; render(); } }, `근거 ${refs}`) : null);
    }
    /** Conditions with no part of their own (to keep, not yet decided): read here, never pinned to a part on the map. */
    function conditions(p) {
        const st = s, open = st.strip === 'conditions';
        const pop = open ? h('div', { class: 'ps-pop', role: 'dialog', 'aria-label': '대상을 정하지 않은 조건' }, p.analysis.preserve.length ? h('section', {}, h('h3', {}, '지킬 것'), h('ul', {}, ...p.analysis.preserve.map(x => h('li', {}, x)))) : null, p.analysis.unknowns.length ? h('section', {}, h('h3', {}, '아직 정하지 않은 것'), h('ul', {}, ...p.analysis.unknowns.map(x => h('li', {}, x)))) : null, h('p', { class: 'fine' }, '특정 부분에 걸린 조건이 아니라 이 변경안 전체의 조건이에요.')) : null;
        return h('div', { class: 'ps-conds' }, h('button', { type: 'button', class: 'ps-cond-btn', 'aria-expanded': String(open), onclick: () => { st.strip = open ? null : 'conditions'; render(); } }, `지킬 것 ${p.analysis.preserve.length} · 정할 것 ${p.analysis.unknowns.length}`), pop);
    }
    /* ---------- the comparison in the reading pane: what a change wants next to what each of its parts is now ----------
       One place for the whole reading: the short pair for the target being read (current → wanted), the long reading on request,
       and the change's sources in its place. The pane stays the same in the current view and the preview; only the map's marks
       change with the mode. The words carry the roles: 지금 (the part's current description and where it comes from), 구상
       (what the change wants; not applied, not a result), 살펴볼 것 (an impact candidate's reason, on the part it names). */
    let lastFocusKey = '', lastShown = '';
    function renderCompare(o) {
        const st = s, p = plan();
        if (!p || !st.focus || st.focus.kind === 'impacts' || panelOpen() || st.sheet) {
            host.surface(null, [], false);
            lastFocusKey = '';
            lastShown = '';
            moveTarget = false;
            frameWhole = false;
            return;
        }
        const boxes = host.boxes(), rep = (id) => visibleRep(id, boxes), active = st.focus.kind === 'item' ? activeTarget(itemOf(st.focus.id)) : st.focus.id;
        const key = `${JSON.stringify(st.focus)}|${active ?? ''}`;
        let content, parts;
        const shown = `${key}|${st.evidenceFor ?? ''}|${st.explain}`;
        if (st.focus.kind === 'item') {
            const item = itemOf(st.focus.id);
            if (!item) {
                host.surface(null, [], false);
                return;
            }
            content = st.evidenceFor === item.id ? itemEvidence(p, item) : st.explain ? itemCompare(o, p, item) : itemBrief(o, p, item);
            parts = active && rep(active) ? [rep(active)] : [];
        }
        else {
            const id = st.focus.id;
            content = partCompare(o, p, id);
            parts = [rep(id) ?? id];
        }
        // An explicit new target (opening the plan, another change, another named target) is brought beside the pane by the
        // smallest pan. The long reading, its sources and the way back only change the pane; they keep the person's camera.
        const place = moveTarget || (lastFocusKey && key !== lastFocusKey) ? true : shown !== lastShown ? 'refit' : false;
        const whole = frameWhole && place === true;
        moveTarget = false;
        frameWhole = false;
        host.surface(content, parts, whole ? 'refit' : place);
        lastFocusKey = key;
        lastShown = shown;
        if (whole)
            host.frame([...new Set([...changedParts(), ...parts])], parts);
    }
    /** The short reading of one change: its targets by name, the pair for the target being read, and what to do with it. */
    function itemBrief(o, p, item) {
        const st = s, items = p.analysis.items, n = items.indexOf(item), boxes = host.boxes();
        const by = st.bundle.by, basis = by?.kind === 'example' ? '작성된 예제 분석' : by?.kind === 'ai' ? 'AI 분석' : '분석';
        const step = (d) => focusItem({ kind: 'item', id: items[(n + d + items.length) % items.length].id });
        const tools = [
            items.length > 1 ? h('button', { type: 'button', class: 'cmp-step', 'aria-label': '앞 변경', onclick: () => step(-1) }, '‹') : null,
            items.length > 1 ? h('span', { class: 'cmp-count' }, `${n + 1}/${items.length}`) : null,
            items.length > 1 ? h('button', { type: 'button', class: 'cmp-step', 'aria-label': '다음 변경', onclick: () => step(1) }, '›') : null,
            h('button', { type: 'button', class: 'close', 'aria-label': '이 변경 읽기 닫기', title: '닫기 (Esc)', onclick: () => { st.focus = null; render(); } }, '×')
        ].filter((x) => !!x);
        const id = activeTarget(item), at = id ? visibleRep(id, boxes) : null;
        const note = id ? calloutNote(o, p, item, id, item.presentation?.find(x => x.partId === id) ?? null, at ?? id) : h('p', { class: 'cmp-none' }, '지금 지도에 없는 새 부분을 더하는 변경이에요.');
        return [
            compareHead(`변경 구상 · ${basis}`, item.title, tools),
            h('div', { class: 'lens-body cmp-body' }, targetNav(item), note, at && at !== id ? h('p', { class: 'cmp-src' }, `지도에서는 ‘${partName(at)}’ 안에 접혀 있어요.`) : null),
            h('footer', { class: 'lens-foot' }, focusControls(p, item))
        ];
    }
    /** A part's own descriptions as its context (its role in the map, a received summary), each with where it comes from. They
     * are not set against a change as its 'before': that needs presentation data on the same side. */
    function roleBlock(o, id) {
        const part = o.view.parts.find(x => x.id === id);
        if (!part)
            return [h('p', { class: 'cmp-none' }, '지금 지도에 없는 부분이에요.')];
        const out = [];
        if (part.note)
            out.push(h('h3', { class: 'cmp-label' }, '이 부분의 역할'), h('p', { class: 'cmp-text cmp-role' }, part.note), h('p', { class: 'cmp-src' }, '지도 설명'));
        if (part.summary)
            out.push(h('h3', { class: 'cmp-label' }, '받은 정리'), h('p', { class: 'cmp-text cmp-role' }, part.summary), h('p', { class: 'cmp-src' }, part.origin ?? '전달받은 정리'));
        return out;
    }
    const row = (label, cls, ...children) => h('div', { class: `cmp-row ${cls}` }, h('span', { class: 'cmp-label' }, label), h('div', { class: 'cmp-val' }, ...children.filter((c) => !!c)));
    function compareHead(kicker, title, tools) {
        return h('header', { class: 'lens-head cmp-head' }, h('div', { class: 'lens-path' }, h('span', {}, kicker)), h('h2', { id: 'lens-title' }, title), h('div', { class: 'head-tools' }, ...tools));
    }
    /* A change reads as pairs: on the left each part it targets as it is now (with where that comes from), on the right what the
       change wants, once for all of them, after an arrow. Impact candidates follow below, their reasons only, apart from the pair. */
    function pair(left, right, currentLabel = '현재 설명') {
        return h('div', { class: 'cmp-pair' }, h('div', { class: 'cmp-now' }, h('h3', { class: 'cmp-label' }, currentLabel), ...left), h('div', { class: 'cmp-arrow', 'aria-hidden': 'true' }, '→'), h('div', { class: 'cmp-want' }, h('h3', { class: 'cmp-label' }, '구상 ', h('small', {}, '바라는 모습 · 적용 안 됨')), ...right));
    }
    function impactList(o, list, named = true) {
        return list.length ? h('section', { class: 'cmp-impacts' }, h('h3', { class: 'cmp-label' }, '살펴볼 것 ', h('small', {}, '영향 후보 · 분석이 든 이유')), h('ul', {}, ...list.map(x => h('li', {}, named ? h('button', { type: 'button', class: 'link-button', onclick: () => locate(x.partId) }, partName(x.partId) ?? '부분') : null, h('span', {}, x.reason))))) : null;
    }
    function itemCompare(o, p, item) {
        const st = s, items = p.analysis.items, n = items.indexOf(item), boxes = host.boxes();
        const by = st.bundle.by, basis = by?.kind === 'example' ? '작성된 예제 분석' : by?.kind === 'ai' ? 'AI 분석' : '분석';
        const step = (d) => focusItem({ kind: 'item', id: items[(n + d + items.length) % items.length].id });
        const tools = [
            items.length > 1 ? h('button', { type: 'button', class: 'cmp-step', 'aria-label': '앞 변경', onclick: () => step(-1) }, '‹') : null,
            items.length > 1 ? h('span', { class: 'cmp-count' }, `${n + 1}/${items.length}`) : null,
            items.length > 1 ? h('button', { type: 'button', class: 'cmp-step', 'aria-label': '다음 변경', onclick: () => step(1) }, '›') : null,
            h('button', { type: 'button', class: 'close', 'aria-label': '설명 닫기', title: '닫기 (Esc)', onclick: () => { st.explain = false; render(); } }, '×')
        ].filter((x) => !!x);
        const active = activeTarget(item), pres = item.presentation?.find(x => x.partId === active), at = new Set(active ? [active] : []);
        const nameLine = (id) => {
            const r = visibleRep(id, boxes), where = r && r !== id ? `‘${partName(r)}’ 안쪽` : !r ? '이 범위 밖' : null;
            return h('p', { class: 'cmp-name' }, h('button', { type: 'button', class: 'link-button', onclick: () => locate(id) }, partName(id) ?? '지금 지도에 없는 부분'), where ? h('small', {}, where) : null);
        };
        const targets = pres ? [...at].map(id => h('div', { class: 'cmp-part' }, nameLine(id), h('p', { class: 'cmp-text' }, pres.current.text), h('p', { class: 'cmp-src' }, pres.current.source === 'evidence' ? `자료에서 · ${pres.current.refs.join(', ')}` : '지도 설명'))) : [];
        // Without same-side data for this target: what the change wants, then the part's role apart from it; no before/after.
        const fallback = () => h('div', { class: 'cmp-only cmp-fallback' }, ...[...at].map(nameLine), h('h3', { class: 'cmp-label' }, '바꿀 내용 ', h('small', {}, '변경 전체의 설명 · 적용 안 됨')), h('p', { class: 'cmp-text' }, item.description), ...(active ? roleBlock(o, active) : []), h('p', { class: 'cmp-gap' }, '현재와의 비교는 아직 정리 전이에요.'));
        const own = p.analysis.impacts.filter(x => at.has(x.partId)), near = nearImpacts(item);
        const box = h('input', { type: 'checkbox', id: `cmp-hand-${item.id}` });
        box.checked = p.selected.includes(item.id);
        box.addEventListener('change', () => toggleItem(item.id, box.checked));
        const refs = p.evidence.filter(e => item.refs.includes(e.id)).length;
        return [
            compareHead(`변경 구상 · ${basis}`, item.title, tools),
            h('div', { class: 'lens-body cmp-body' }, targetNav(item), h('div', { class: 'cmp-main' }, pres ? pair(targets, [h('p', { class: 'cmp-text' }, pres.wanted.text)], pres.current.source === 'evidence' ? '자료상' : '현재 설명') : fallback(), impactList(o, [...own, ...near])), item.dependsOn.length && by?.kind === 'example' ? h('p', { class: 'cmp-dep' }, h('span', {}, '전제'), item.dependsOn.map(d => itemOf(d)?.title ?? d).join(', ')) : null),
            h('footer', { class: 'lens-foot' }, h('label', { class: 'cmp-hand', for: `cmp-hand-${item.id}` }, box, h('span', {}, '이번 요청에 맡기기')), refs ? h('button', { type: 'button', class: 'lens-more', onclick: () => { st.evidenceFor = item.id; render(); requestAnimationFrame(() => document.getElementById('cmp-back')?.focus()); } }, `근거 ${refs}`, h('span', { 'aria-hidden': 'true' }, ' ›')) : null)
        ];
    }
    /** The sources this change cites, read in the comparison's place: each original text with where it comes from. */
    function itemEvidence(p, item) {
        const st = s, by = st.bundle.by, refs = p.evidence.filter(e => item.refs.includes(e.id));
        const back = () => { st.evidenceFor = null; render(); requestAnimationFrame(() => document.querySelector('#lens .cmp-hand input, #lens .lens-more, .ps-focus button')?.focus()); };
        return [
            compareHead(`근거 ${refs.length} · ${by?.kind === 'example' ? '예제 원자료' : '이 변경안이 읽은 자료'}`, item.title, [h('button', { type: 'button', class: 'close', 'aria-label': '비교로 돌아가기', title: '비교로 (Esc)', onclick: back }, '×')]),
            h('div', { class: 'lens-body cmp-body cmp-evidence' }, sourceList(refs, true)),
            h('footer', { class: 'lens-foot' }, h('button', { type: 'button', id: 'cmp-back', class: 'lens-more', onclick: back }, h('span', { 'aria-hidden': 'true' }, '‹ '), st.explain ? '비교로 돌아가기' : '지도로 돌아가기'))
        ];
    }
    function partCompare(o, p, id) {
        const boxes = host.boxes(), r = visibleRep(id, boxes) ?? id;
        const touching = p.analysis.items.filter(i => i.partIds.some(x => x === id || visibleRep(x, boxes) === r));
        const impacts = p.analysis.impacts.filter(x => x.partId === id);
        return [
            compareHead('변경 구상 · 이 부분', partName(id) ?? '부분', [h('button', { type: 'button', class: 'close', 'aria-label': '선택 해제', title: '닫기 (Esc)', onclick: () => host.selectPart(null) }, '×')]),
            h('div', { class: 'lens-body cmp-body' }, h('div', { class: 'cmp-main' }, h('div', { class: 'cmp-only' }, touching.length ? h('h3', { class: 'cmp-label' }, '이 부분에 걸친 변경 ', h('small', {}, '적용 안 됨')) : null, ...touching.map(i => h('div', { class: 'cmp-item' }, h('p', { class: 'cmp-name' }, h('button', { type: 'button', class: 'link-button', onclick: () => focusItem({ kind: 'item', id: i.id }) }, i.title), i.partIds.includes(id) ? null : h('small', {}, '이 부분 안쪽')), h('p', { class: 'cmp-text clamp3' }, i.description))), ...roleBlock(o, id), touching.length || impacts.length ? null : h('p', { class: 'cmp-none' }, '이 변경안이 바꾸거나 영향 후보로 본 부분은 아니에요.')), impactList(o, impacts, false)))
        ];
    }
    function closePlan() { close(); }
    function renderMode() {
        const box = $('plan-mode'), p = plan();
        box.hidden = !s || !p;
        if (!s || !p)
            return;
        const b = (mode, label) => h('button', { type: 'button', 'aria-pressed': String(s.mode === mode), onclick: () => { s.mode = mode; moveTarget = false; render(); } }, label);
        box.replaceChildren(b('current', '현재'), b('preview', '변경 미리보기'));
    }
    /** Same inspector grammar as a part: kicker → title (what is wanted) → one basis line → the change list first. Writing and
     * source tools come after the list; with no plan yet, writing is the only content. */
    function renderPanel(o) {
        const panel = $('plan-panel'), prev = panel.querySelector('.pp-body'), keep = prev?.scrollTop ?? 0, p = plan(), st = s;
        panel.hidden = false;
        const head = h('header', { class: 'panel-head pp-head' }, h('div', { class: 'panel-path' }, h('span', {}, '변경 구상'), st.example ? h('span', { class: 'tag' }, '예제') : null), p ? h('h2', { id: 'plan-title', class: 'pp-want', tabindex: '-1', title: p.intent }, p.intent) : h('h2', { id: 'plan-title', tabindex: '-1' }, '새 변경안'), p ? h('p', { class: 'pp-basis', title: p.basis }, `기준 · ${short(p.basis, 64)}`) : h('p', { class: 'pp-basis' }, '적은 문장으로 같은 지도에서 달라질 곳을 살펴봐요.'), newerNote(o, p), h('div', { class: 'head-tools' }, p && !st.editing && !stale()
            ? h('button', { type: 'button', class: 'close', 'aria-label': '자세히 닫고 지도 비교로', title: '지도 비교로 (Esc)', onclick: () => { st.detail = false; render(); } }, '×')
            : h('button', { type: 'button', class: 'close', 'aria-label': '변경 구상 닫고 현재 지도로', title: '닫기 (Esc) · 초안은 남아요', onclick: () => close() }, '×')));
        const body = h('div', { class: 'pp-body panel-body' });
        put(body, partContext(o), p && !st.editing && !stale() ? planSection(o, p) : null, intentSection(o), p && (st.editing || stale()) ? planSection(o, p) : null, st.bundle.snapshots.length ? resultSection() : null);
        // What goes into this request stays in view under the scrolling body, next to the button that makes it.
        panel.replaceChildren(head, body, ...(p ? [requestSection(p)] : []), footer(o));
        body.scrollTop = keep;
    }
    /** The plan's basis is fixed; newer records are announced, never merged into it. */
    function newerNote(o, p) {
        if (!p || o.kind !== 'saved')
            return null;
        const newer = o.view.records.filter(r => r.at > p.createdAt).length;
        return newer ? h('p', { class: 'pp-newer' }, `만든 뒤 새 기록 ${newer}개 · 이 안의 기준은 그대로예요`) : null;
    }
    function partContext(o) {
        const id = host.selected(), p = plan();
        if (!id || !p)
            return null;
        const part = o.view.parts.find(x => x.id === id);
        if (!part)
            return null;
        const touching = p.analysis.items.filter(i => i.partIds.includes(id)), impacts = p.analysis.impacts.filter(x => x.partId === id);
        return h('section', { class: 'pp-sec pp-part' }, h('p', { class: 'pp-part-name' }, h('span', {}, '선택한 부분'), h('strong', {}, part.name), h('button', { type: 'button', class: 'link-button', onclick: () => host.selectPart(null) }, '해제')), touching.length ? h('p', {}, '바꾸는 항목 · ', ...touching.flatMap((i, n) => [n ? ', ' : '', h('button', { type: 'button', class: 'link-button', onclick: () => focusItem({ kind: 'item', id: i.id }) }, i.title)])) : null, impacts.map(x => h('p', { class: 'pp-muted clamp2', title: x.reason }, `영향 후보 · ${x.reason}`))[0] ?? null, !touching.length && !impacts.length ? h('p', { class: 'pp-muted' }, '이 변경안에서 직접 바꾸거나 영향 후보로 본 부분은 아니에요.') : null);
    }
    function intentSection(o) {
        const st = s, p = plan(), sec = h('section', { class: 'pp-sec pp-intent' });
        const status = host.status(), canAsk = status.ai === 'deepseek';
        if (p && !st.editing && !stale()) {
            sec.classList.add('compact');
            put(sec, h('h3', {}, '문장과 자료'), h('div', { class: 'pp-row pp-acts' }, h('button', { type: 'button', class: 'link-button', onclick: () => { st.editing = true; render(); requestAnimationFrame(() => document.getElementById('plan-intent')?.focus()); } }, '문장 고치기'), sourcesToggle(o), st.pending ? null : h('button', { type: 'button', class: 'link-button', disabled: !canAsk, title: canAsk ? reachText() : 'AI 서버가 연결된 주소에서 쓸 수 있어요', onclick: () => void analyze() }, 'AI로 다시 살펴보기')), conditionSwitch(o));
            if (st.sources)
                put(sec, sourceList(p.evidence.filter(e => !st.bundle.extra.some(x => x.id === e.id))), addSource(o));
            put(sec, ...askLine(canAsk, p, true));
            return sec;
        }
        const area = h('textarea', { id: 'plan-intent', rows: '3', maxlength: '6000', placeholder: '어떻게 바뀌면 좋을지 두세 줄로 적어 주세요. 예: 폴더째 변환하고, 실패한 파일은 모아서 보고 싶어.', 'aria-label': '바꾸고 싶은 모습', disabled: !!st.pending });
        area.value = st.bundle.draft;
        const staleLine = h('p', { class: 'pp-stale', role: 'status' });
        const setStale = () => { staleLine.textContent = stale() ? '고친 문장은 아직 살펴보지 않았어요. 아래 변경안은 앞 문장 기준이에요.' : ''; staleLine.hidden = !stale(); };
        area.addEventListener('input', () => { st.bundle = { ...st.bundle, draft: area.value }; persist(); setStale(); syncFoot(); });
        area.addEventListener('keydown', e => { if (e.key === 'Escape') {
            e.stopPropagation();
            area.blur();
        } if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void analyze();
        } });
        setStale();
        sec.append(h('label', { for: 'plan-intent', class: 'pp-label' }, '바꾸고 싶은 모습'), area, staleLine, h('div', { class: 'pp-row' }, sourcesToggle(o), p ? h('button', { type: 'button', class: 'link-button', onclick: () => { st.editing = false; render(); } }, '접기') : null));
        put(sec, conditionSwitch(o));
        if (st.sources)
            put(sec, sourceList((input() ?? { evidence: [] }).evidence.filter(e => !st.bundle.extra.some(x => x.id === e.id))), addSource(o));
        put(sec, ...askLine(canAsk, p));
        return sec;
    }
    /** compact: the plan is shown and the ask is the small link above; only progress, errors and a needed code appear here. */
    function askLine(canAsk, p, compact = false) {
        const st = s, out = [];
        if (st.pending) {
            out.push(h('div', { class: 'pending' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), h('span', {}, `${host.status().model ?? 'AI'}가 자료 ${st.pending.input.evidence.length}개와 지도를 읽고 있어요…`), h('button', { type: 'button', class: 'link-button', onclick: () => st.pending?.controller.abort() }, '취소')));
            return out;
        }
        if (st.error)
            out.push(h('p', { class: 'pp-error', role: 'alert' }, st.error));
        if (host.status().access === 'code' && canAsk && (!compact || !host.accessCode() || st.error)) {
            const code = h('input', { id: 'plan-access', type: 'password', placeholder: '접속 코드', autocomplete: 'off', value: host.accessCode() });
            const keep = () => host.keepAccessCode(code.value);
            code.addEventListener('input', keep);
            code.addEventListener('change', keep);
            out.push(h('div', { class: 'access' }, h('label', { for: 'plan-access' }, '접속 코드'), code));
        }
        if (compact)
            return out;
        const label = p ? (stale() ? '고친 문장으로 살펴보기' : 'AI로 다시 살펴보기') : 'AI로 살펴보기';
        const reach = h('p', { class: 'fine', id: 'plan-reach' }, reachText());
        out.push(h('div', { class: 'pp-row pp-ask' }, h('button', { type: 'button', class: p && !stale() ? 'secondary small' : 'primary small', disabled: !canAsk || !st.bundle.draft.trim(), onclick: () => void analyze() }, label), reach));
        if (!canAsk)
            out.push(h('p', { class: 'fine' }, host.status().ai === 'off' ? '서버에 AI 키가 없어 살펴볼 수 없어요. 초안은 남아요.' : 'AI 서버가 연결된 주소에서 살펴볼 수 있어요. 초안은 남아요.'));
        return out;
    }
    /** What the next analysis would read, before anything is sent. */
    function reachText() {
        const inp = input();
        if (!inp)
            return '';
        if (inp.problem === 'TOO_LARGE')
            return '자료가 요청 한도보다 커요';
        if (inp.problem)
            return `‘${inp.problem.secret}’에 키처럼 보이는 글이 있어요`;
        if (s.example)
            return `예제 원자료 ${inp.evidence.filter(e => e.id !== 'INTENT').length}개${inp.evidence.some(e => e.id === 'INTENT') ? ' + 고친 문장' : ''} · 작성된 분석은 보내지 않아요`;
        const added = s.bundle.extra.length ? ` + 붙인 자료 ${s.bundle.extra.length}개` : '';
        return inp.records.total ? `이 문장${added} + 기록 ${inp.records.sent === inp.records.total ? `${inp.records.total}개` : `${inp.records.total}개 중 최신 ${inp.records.sent}개`}` : `${added ? `이 문장${added}` : '이 문장과 지도'} · 아직 기록 없음`;
    }
    function syncFoot() { const r = document.getElementById('plan-reach'); if (r)
        r.textContent = reachText(); const btn = r?.previousElementSibling; if (btn)
        btn.disabled = host.status().ai !== 'deepseek' || !s.bundle.draft.trim(); }
    function sourcesToggle(_o) {
        const st = s, n = (plan() && !stale() && !st.editing ? plan().evidence : input()?.evidence ?? []).length;
        return h('button', { type: 'button', class: 'link-button quiet', 'aria-expanded': String(st.sources), onclick: () => { st.sources = !st.sources; render(); } }, `${st.example ? '예제 원자료' : '읽는 자료'} ${n}개`);
    }
    function conditionSwitch(o) {
        if (o.key !== CONVERTER_KEY)
            return null;
        const st = s, b = (c, label) => h('button', { type: 'button', 'aria-pressed': String(st.condition === c), title: CONDITION_LABEL[c], disabled: !!st.pending, onclick: () => setCondition(c) }, label);
        return h('div', { class: 'pp-cond', role: 'group', 'aria-label': '예제 자료 바꾸기' }, h('span', {}, '자료 바꾸기 · 코드에 파일별 결과가'), b('A', '있음'), b('B', '없음'));
    }
    function sourceList(evidence, open = false) {
        return h('ol', { class: 'pp-sources' }, ...evidence.map(e => h('li', {}, h('details', { open }, h('summary', {}, h('span', { class: `pp-kind k-${e.kind}` }, EVIDENCE_LABEL[e.kind]), h('span', {}, e.title)), h('p', {}, e.text), h('p', { class: 'pp-ref' }, `${e.id} · ${e.basis}`)))));
    }
    /** The person's own material for a project with few records: kept in the plan's sidecar, sent with the next analysis. */
    function addSource(o) {
        if (o.kind !== 'saved')
            return null;
        const st = s, extra = st.bundle.extra;
        const list = extra.length ? h('ul', { class: 'pp-extra' }, ...extra.map(e => h('li', {}, h('span', { class: `pp-kind k-${e.kind}` }, EVIDENCE_LABEL[e.kind]), h('span', {}, e.title), h('button', { type: 'button', class: 'link-button', 'aria-label': `‘${e.title}’ 자료 빼기`, onclick: () => { st.bundle = { ...st.bundle, extra: st.bundle.extra.filter(x => x.id !== e.id) }; persist(); render(); } }, '빼기')))) : null;
        if (!st.adding)
            return h('div', { class: 'pp-addsrc' }, list, extra.length < 20 ? h('button', { type: 'button', class: 'link-button', onclick: () => { st.adding = true; render(); requestAnimationFrame(() => document.getElementById('src-title')?.focus()); } }, '+ 자료 추가') : null);
        const kind = h('select', { id: 'src-kind', 'aria-label': '자료 종류' });
        for (const [v, l] of [['report', '받은 작업 보고'], ['code', '프로젝트 자료·코드'], ['test', '검사 기록']])
            kind.append(h('option', { value: v }, l));
        const title = h('input', { id: 'src-title', maxlength: '120', placeholder: '제목 · 예: 변환 함수 발췌', autocomplete: 'off' });
        const text = h('textarea', { id: 'src-text', rows: '4', maxlength: '12000', placeholder: '원문을 붙여 넣으세요' });
        const basis = h('input', { id: 'src-basis', maxlength: '200', placeholder: '자료 기준 · 예: main 브랜치 convert.ts, 10월 26일', autocomplete: 'off' });
        const msg = h('p', { class: 'form-msg', role: 'status' });
        const strip = (t) => t.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').trim();
        return h('form', { class: 'pp-add', onsubmit: (e) => {
                e.preventDefault();
                const t = strip(title.value), x = strip(text.value), b = strip(basis.value).replace(/[\n\r\t]/g, ' ');
                if (!t || !x || !b) {
                    msg.textContent = '제목, 원문, 자료 기준을 모두 적어 주세요.';
                    return;
                }
                if (secretLike(`${t}\n${x}\n${b}`)) {
                    msg.textContent = '키나 토큰처럼 보이는 문자열이 있어 추가하지 않았어요. 그 부분을 지워 주세요.';
                    return;
                }
                let n = 1;
                while (st.bundle.extra.some(e => e.id === `U${String(n).padStart(2, '0')}`))
                    n++;
                const ev = { id: `U${String(n).padStart(2, '0')}`, kind: kind.value, title: t, text: x, basis: `사용자가 붙인 자료 · ${b}` };
                st.bundle = { ...st.bundle, extra: [...st.bundle.extra, ev] };
                st.adding = false;
                persist();
                render();
            } }, list, kind, title, text, basis, msg, h('div', { class: 'pp-row' }, h('button', { type: 'submit', class: 'primary small' }, '추가'), h('button', { type: 'button', class: 'link-button', onclick: () => { st.adding = false; render(); } }, '취소'), h('span', { class: 'fine' }, '붙인 자료는 다음 분석에 쓰여요. 실행해 확인한 결과로 보지 않아요.')));
    }
    function planSection(o, p) {
        const st = s, by = st.bundle.by;
        const origin = by?.kind === 'example' ? h('span', { class: 'tag', title: '사람이 작성한 합성 예시 분석이에요. AI에 보낸 적이 없어요.' }, '작성된 예제 분석')
            : by?.kind === 'ai' ? h('span', { class: 'tag ai', title: `${fullTime(by.at)}${by.records.total ? ` · 기록 ${by.records.total}개 중 ${by.records.sent}개를 읽음` : ''}` }, `AI 분석 · ${by.model} · ${ago(by.at)}`) : null;
        const sec = h('section', { class: `pp-sec pp-plan${stale() ? ' is-stale' : ''}` }, h('div', { class: 'pp-sec-head' }, h('h3', {}, `바뀌는 것 ${p.analysis.items.length}`), origin));
        const list = h('ul', { class: 'pp-items' });
        for (const item of p.analysis.items) {
            const authored = st.bundle.by?.kind === 'example';
            const on = p.selected.includes(item.id), focused = st.focus?.kind === 'item' && st.focus.id === item.id, missing = on && authored ? missingDeps(item) : [];
            const parts = item.partIds.map(partName).filter(Boolean);
            const box = h('input', { type: 'checkbox', id: `pi-${item.id}`, 'aria-label': `‘${item.title}’ 이번 요청에 맡기기` });
            box.checked = on;
            box.addEventListener('change', () => toggleItem(item.id, box.checked));
            // Reading an item (its places on the map and its detail) is the row; handing it over is the separate toggle on the right.
            const li = h('li', { class: `pp-item${focused ? ' focused' : ''}${on ? ' on' : ''}` }, h('div', { class: 'pp-item-row' }, h('button', { type: 'button', class: 'pp-item-title', 'aria-expanded': String(focused), title: focused ? '지도 표시 해제' : '지도에서 이 변경 보기', onclick: () => focusItem({ kind: 'item', id: item.id }) }, h('span', {}, item.title), h('small', {}, parts.length ? parts.join(' · ') : '지금 지도에 없는 새 부분')), h('label', { class: 'pp-hand', for: `pi-${item.id}`, title: on ? '이번 요청문에 들어가요' : '이번 요청문에서 빠져요' }, box, h('span', {}, '맡기기'))));
            if (missing.length)
                li.append(h('p', { class: 'pp-warn' }, `‘${missing.map(d => itemOf(d)?.title ?? d).join('’, ‘')}’이 이 항목의 전제예요. `, h('button', { type: 'button', class: 'link-button', onclick: () => { s.bundle = { ...s.bundle, plan: selectItems(plan(), [...plan().selected, ...missing]) }; persist(); render(); } }, '함께 맡기기'), h('span', {}, ' · 빼 두면 요청문에 미선택 전제로 적혀요.')));
            if (focused)
                li.append(itemDetail(o, item));
            list.append(li);
        }
        sec.append(list);
        const nImp = p.analysis.impacts.length;
        const folds = h('div', { class: 'pp-folds' }, nImp ? h('button', { type: 'button', class: `pp-fold-btn${st.focus?.kind === 'impacts' ? ' on' : ''}`, 'aria-pressed': String(st.focus?.kind === 'impacts'), onclick: () => focusItem({ kind: 'impacts' }) }, `영향 후보 ${nImp}곳`) : null, p.analysis.preserve.length ? fold(`유지할 조건 ${p.analysis.preserve.length}`, p.analysis.preserve) : null, p.analysis.unknowns.length ? fold(`정하지 않은 것 ${p.analysis.unknowns.length}`, p.analysis.unknowns) : null);
        sec.append(folds);
        // The analysis in a few words, after the list it explains.
        if (p.analysis.summary)
            sec.append(h('p', { class: 'pp-summary' }, p.analysis.summary));
        if (st.focus?.kind === 'impacts')
            sec.append(h('ul', { class: 'pp-impacts' }, ...p.analysis.impacts.map(x => h('li', {}, h('button', { type: 'button', class: 'link-button', onclick: () => locate(x.partId) }, partName(x.partId) ?? '지금 지도에 없는 부분'), h('span', {}, x.reason)))));
        return sec;
    }
    const fold = (label, lines) => h('details', { class: 'pp-fold' }, h('summary', {}, label), h('ul', {}, ...lines.map(l => h('li', {}, l))));
    function locate(partId) { if (host.boxes().has(partId)) {
        host.reveal(partId);
        host.selectPart(partId);
    }
    else
        host.showPart(partId); }
    function itemDetail(o, item) {
        const p = plan(), impacts = nearImpacts(item), refs = p.evidence.filter(e => item.refs.includes(e.id));
        return h('div', { class: 'pp-detail' }, h('p', {}, item.description), item.partIds.length ? h('p', { class: 'pp-line' }, h('span', {}, '바꿀 곳'), h('span', {}, ...item.partIds.flatMap((id, n) => [n ? ', ' : '', h('button', { type: 'button', class: 'link-button', onclick: () => locate(id) }, partName(id) ?? '지금 지도에 없는 부분')]))) : h('p', { class: 'pp-line' }, h('span', {}, '바꿀 곳'), '지금 지도에 없는 새 부분'), impacts.length ? h('div', { class: 'pp-line' }, h('span', {}, '함께 볼 곳'), h('ul', {}, ...impacts.map(x => h('li', {}, h('button', { type: 'button', class: 'link-button', onclick: () => locate(x.partId) }, partName(x.partId) ?? '부분'), ` — ${x.reason}`)))) : null, item.dependsOn.length ? (s.bundle.by?.kind === 'example'
            ? h('p', { class: 'pp-line' }, h('span', {}, '전제'), item.dependsOn.map(d => itemOf(d)?.title ?? d).join(', '))
            : h('p', { class: 'pp-line' }, h('span', {}, '전제'), '요청문을 만들 때 고른 범위로 살펴봐요.')) : null, refs.length ? h('details', { class: 'pp-why' }, h('summary', {}, `근거 ${refs.length}개`), sourceList(refs)) : null);
    }
    function requestSection(p) {
        const st = s, last = latestSnapshot(), n = p.selected.length;
        const changed = last && (last.planId !== p.id || last.planRevision !== p.revision);
        const names = p.analysis.items.filter(i => p.selected.includes(i.id)).map(i => i.title);
        const sec = h('section', { class: 'pp-request', 'aria-label': '이번에 맡길 것' }, h('p', { class: 'pp-chosen' }, h('strong', {}, `맡길 항목 ${n}/${p.analysis.items.length}`), h('span', { title: names.join('\n') }, names.length ? names.join(' · ') : '목록에서 이번에 맡길 항목에 체크하세요')), st.scoping
            ? h('div', { class: 'pending', role: 'status' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), h('span', {}, `고른 항목 ${st.scoping.count}개의 전제를 살펴보는 중…`), h('button', { type: 'button', class: 'link-button', onclick: () => st.scoping?.controller.abort() }, '취소'))
            : h('div', { class: 'pp-row' }, h('button', { type: 'button', class: 'primary small', disabled: !n || stale(), onclick: makeRequest, title: stale() ? '고친 문장을 먼저 살펴본 뒤 만들 수 있어요' : '만들고 복사해도 보내거나 실행하지 않아요' }, '요청문 만들기'), last ? h('button', { type: 'button', class: 'link-button', onclick: () => { st.sheet = last.id; st.copyMsg = null; render(); } }, `마지막 요청문 · ${ago(last.createdAt)}`) : null), st.scopeError ? h('p', { class: 'pp-error', role: 'alert' }, st.scopeError) : null, !st.scoping && !st.scopeError && st.bundle.by?.kind === 'ai' ? h('p', { class: 'fine' }, '만들 때 고른 항목의 전제를 AI가 한 번 살펴봐요.') : null, changed && !st.scoping ? h('p', { class: 'fine' }, '마지막 요청문 뒤로 변경안이 바뀌었어요. 새로 만들어도 이전 것은 남아요.') : null);
        return sec;
    }
    function resultSection() {
        const st = s, snaps = st.bundle.snapshots, snap = snapshotOf(st.resultFor) ?? snaps.at(-1);
        const labels = st.bundle.labels[snap.id] ?? {}, origin = st.bundle.origins[snap.id];
        const mine = st.bundle.observations.filter(x => st.bundle.attached[x.id] === snap.id);
        const rows = compareResults(snap, mine);
        const sec = h('section', { class: 'pp-sec pp-results' }, h('div', { class: 'pp-sec-head' }, h('h3', {}, '돌아온 기록'), snaps.length > 1 ? (() => {
            const sel = h('select', { 'aria-label': '대조할 요청문' });
            snaps.slice().reverse().forEach((x, i) => sel.append(h('option', { value: x.id, selected: x.id === snap.id }, `${i === 0 ? '마지막 ' : ''}요청문 · ${fullTime(x.createdAt)} · ${x.itemIds.length}개`)));
            sel.addEventListener('change', () => { st.resultFor = sel.value; st.addForm = false; render(); });
            return sel;
        })() : h('span', { class: 'pp-muted' }, `요청문 · ${fullTime(snap.createdAt)}`)));
        const ul = h('ul', { class: 'pp-res' });
        for (const r of rows) {
            const all = [...r.reported, ...r.code, ...r.tests];
            const counts = all.length ? `보고 ${r.reported.length} · 코드 자료 ${r.code.length} · 검사 ${r.tests.length}` : '받은 근거 없음';
            const li = h('li', { class: all.length ? 'has' : 'none' }, h('details', {}, h('summary', {}, h('span', { class: 'pp-res-title' }, labels[r.itemId] ?? r.itemId), h('span', { class: 'pp-res-count' }, counts)), all.length ? h('ol', {}, ...all.map(x => h('li', {}, h('span', { class: `pp-kind k-${x.kind}` }, { report: '담당 보고', code: '코드 자료', test: '검사' }[x.kind]), h('p', {}, x.text), h('p', { class: 'pp-ref' }, x.basis)))) : h('p', { class: 'pp-muted' }, '이 항목에 대응하는 보고·코드·검사가 아직 없어요. 미구현이나 실패로 보지 않아요.')));
            ul.append(li);
        }
        sec.append(ul);
        const asked = new Set(snap.itemIds), outside = mine.filter(x => !asked.has(x.itemId)).length;
        if (outside)
            sec.append(h('p', { class: 'pp-muted' }, `요청하지 않은 항목에 대한 기록 ${outside}개는 대응하지 않았어요.`));
        const loaded = mine.some(x => /^(R07|P02|R08)-/.test(x.id));
        const actions = h('div', { class: 'pp-row' });
        if (st.example && origin === 'example' && !loaded)
            actions.append(h('button', { type: 'button', class: 'secondary small', onclick: () => loadExampleResults(snap) }, '돌아온 기록 살펴보기'));
        if (!st.example || origin !== 'example')
            actions.append(h('button', { type: 'button', class: 'link-button', 'aria-expanded': String(st.addForm), onclick: () => { st.addForm = !st.addForm; render(); } }, st.addForm ? '붙이기 닫기' : '돌아온 기록 붙이기'));
        if (actions.childElementCount)
            sec.append(actions);
        if (st.example && origin !== 'example')
            sec.append(h('p', { class: 'fine' }, '예제의 돌아온 기록은 작성된 예제 항목과만 대응해요. AI 분석 항목에는 받은 글을 직접 붙여 주세요.'));
        if (st.addForm)
            sec.append(addForm(snap, labels));
        return sec;
    }
    function addForm(snap, labels) {
        const st = s;
        const item = h('select', { id: 'obs-item' });
        for (const id of snap.itemIds)
            item.append(h('option', { value: id }, labels[id] ?? id));
        const kind = h('select', { id: 'obs-kind' });
        for (const [v, l] of [['report', '담당 보고'], ['code', '코드 자료'], ['test', '검사 기록']])
            kind.append(h('option', { value: v }, l));
        const text = h('textarea', { id: 'obs-text', rows: '3', maxlength: '12000', placeholder: '작업 AI가 돌려준 글을 붙여 넣으세요' });
        const basis = h('input', { id: 'obs-basis', maxlength: '300', placeholder: '어디의 결과인가요? 예: feature/folder 브랜치 보고' });
        const msg = h('p', { class: 'form-msg', role: 'status' });
        return h('form', { class: 'pp-add', onsubmit: (e) => {
                e.preventDefault();
                if (!text.value.trim() || !basis.value.trim()) {
                    msg.textContent = '받은 글과 그 결과의 위치를 함께 적어 주세요.';
                    return;
                }
                const obs = { id: `O_${crypto.randomUUID()}`, itemId: item.value, kind: kind.value,
                    text: text.value.trim().replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' '), basis: basis.value.trim().replace(/[\u0000-\u001f\u007f]/g, ' '), refs: [] };
                try {
                    compareResults(snap, [...st.bundle.observations.filter(x => st.bundle.attached[x.id] === snap.id), obs]);
                }
                catch {
                    msg.textContent = '이 글은 붙일 수 없어요(길이나 문자를 확인해 주세요).';
                    return;
                }
                st.addForm = false;
                attach(snap, [obs]);
            } }, h('div', { class: 'pp-row' }, h('label', { for: 'obs-item', class: 'sr-only' }, '항목'), item, h('label', { for: 'obs-kind', class: 'sr-only' }, '종류'), kind), h('label', { for: 'obs-text', class: 'sr-only' }, '받은 글'), text, h('label', { for: 'obs-basis', class: 'sr-only' }, '결과의 위치'), basis, msg, h('div', { class: 'pp-row' }, h('button', { type: 'submit', class: 'primary small' }, '붙이기'), h('span', { class: 'fine' }, '붙인 글만 대조해요. 완료로 표시하지 않아요.')));
    }
    function footer(o) {
        const st = s, foot = h('footer', { class: 'pp-foot' });
        if (st.unreadable)
            foot.append(h('p', { class: 'pp-error', role: 'alert' }, '이 브라우저에 저장된 변경안을 읽지 못했어요. 원래 내용은 지우지 않고 그대로 두었어요. ', h('button', { type: 'button', class: 'link-button', onclick: startOver }, '따로 보관하고 새로 시작')));
        if (st.storeMsg)
            foot.append(h('p', { class: 'pp-error', role: 'alert' }, st.storeMsg));
        if (st.fileMsg)
            foot.append(h('p', { class: 'pp-muted', role: 'status' }, st.fileMsg));
        const line = h('div', { class: 'pp-row' });
        if (o.kind === 'saved') {
            line.append(h('span', { class: 'fine' }, st.storeMsg || st.unreadable ? '저장 안 됨' : '이 브라우저에 저장 · 프로젝트 백업과 별도'), h('span', { class: 'grow' }), h('button', { type: 'button', class: 'link-button', disabled: !st.bundle.plan && !st.bundle.snapshots.length, onclick: exportPlan }, '파일로 내보내기'), h('button', { type: 'button', class: 'link-button', onclick: importPlan }, '가져오기'));
        }
        else
            line.append(h('span', { class: 'fine' }, '예제 · 이 탭에서만 남아요'));
        foot.append(line);
        return foot;
    }
    /* The request document reads in its own sheet over the map; closing it returns to the same panel place. */
    function renderSheet() {
        const sheet = $('plan-sheet'), snap = s ? snapshotOf(s.sheet) : null;
        sheet.hidden = !snap;
        if (!s || !snap) {
            sheet.replaceChildren();
            return;
        }
        fitSheet();
        const labels = s.bundle.labels[snap.id] ?? {}, p = plan();
        const old = !p || snap.planId !== p.id || snap.planRevision !== p.revision;
        const total = Object.keys(labels).length || snap.itemIds.length;
        sheet.replaceChildren(h('header', {}, h('div', {}, h('h2', { id: 'sheet-title' }, '요청문'), h('p', {}, `맡길 항목 ${snap.itemIds.length}/${total} · ${snap.itemIds.map(id => labels[id] ?? id).join(' · ')}`), h('p', { class: 'fine' }, `${fullTime(snap.createdAt)}에 만듦 · ${{ example: '작성된 예제 분석의 고정 전제', reviewed: 'AI가 고른 범위의 전제를 살펴봄', ai: '전제 검토 없이 만든 이전 요청문' }[s.bundle.origins[snap.id] ?? 'ai']}${old ? ' · 지금 변경안과 다른 판' : ''}`)), h('button', { type: 'button', class: 'close', 'aria-label': '요청문 닫기', title: '닫기 (Esc)', onclick: closeSheet }, '×')), h('pre', { tabindex: '0' }, snap.text), h('footer', {}, h('button', { type: 'button', id: 'plan-copy', class: 'primary small', onclick: () => void copy(snap.text) }, '복사'), h('span', { class: 'fine', role: 'status' }, s.copyMsg ?? '복사는 이 글을 옮기는 일이에요. 접수·실행·완료를 기록하지 않아요.'), h('button', { type: 'button', class: 'link-button', onclick: closeSheet }, '닫기')));
    }
    /** The sheet reads beside the inspector while the strip left of it is wide enough; otherwise it covers the window. */
    function fitSheet() { $('plan-sheet').classList.toggle('wide', $('space').getBoundingClientRect().width - width() - 48 < 420); }
    // A resized window changes the inspector width: keep the map's reference width and the sheet in step.
    window.addEventListener('resize', () => { if (!s)
        return; fitSheet(); });
    function closeSheet() { if (!s)
        return; s.sheet = null; s.copyMsg = null; render(); document.querySelector('.pp-request .link-button, .pp-request .primary')?.focus(); }
    /** Escape: the innermost open thing first; the plan itself last. Returns true when handled. */
    function escape() {
        if (!s)
            return false;
        if (s.sheet) {
            closeSheet();
            return true;
        }
        if (s.addForm) {
            s.addForm = false;
            render();
            return true;
        }
        if (s.strip) {
            s.strip = null;
            render();
            return true;
        }
        if (s.evidenceFor) {
            s.evidenceFor = null;
            render();
            return true;
        }
        if (s.explain) {
            s.explain = false;
            render();
            return true;
        }
        if (s.detail && plan() && !s.editing) {
            s.detail = false;
            render();
            return true;
        }
        if (s.focus?.kind === 'part' && host.selected()) {
            host.selectPart(null);
            return true;
        }
        if (s.focus) {
            s.focus = null;
            render();
            return true;
        }
        if (host.selected()) {
            host.selectPart(null);
            return true;
        }
        close();
        return true;
    }
    return {
        isOpen: () => !!s,
        /** The right panel's width while the whole plan is open there; 0 while the plan reads on the map. */
        open, close, projectChanged, overlay, escape,
        /** The selection changed on the map while planning: the panel reads it in place of the part panel. */
        selectionChanged: (changed = false) => {
            if (!s)
                return;
            const id = host.selected();
            if (id && plan()) {
                const boxes = host.boxes(), matches = (item) => itemTargets(item).filter(t => t === id || visibleRep(t, boxes) === id);
                const current = s.focus?.kind === 'item' ? itemOf(s.focus.id) : null;
                const item = current && matches(current).length ? current : items().find(i => matches(i).length);
                if (item) {
                    const possible = matches(item), remembered = activeTarget(item);
                    s.targets[item.id] = possible.includes(remembered ?? '') ? remembered : possible[0];
                    s.focus = { kind: 'item', id: item.id };
                }
                else
                    s.focus = { kind: 'part', id };
                s.mode = 'preview';
                s.strip = null;
                if (changed) {
                    s.evidenceFor = null;
                    moveTarget = true;
                }
            }
            else if (!id && s.focus?.kind === 'part')
                s.focus = firstFocus(plan());
            render();
            if (changed && id && s.focus?.kind === 'part')
                host.reveal(id);
        },
        statusChanged: () => { if (s)
            render(); },
        toggle: () => (s ? close() : open()),
        width,
        sheetOpen: () => !!s?.sheet,
    };
}
