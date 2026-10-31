import { studioView } from '../shared/studio.js';
import { handoverDoc, handoverCode, WEB_RECORD_ASK } from '../shared/handover.js';
import { h } from './plan-dom.js';
export function createHandoverView(host) {
    let dialog = null, from = null;
    let state = null;
    function make(project, scope, code, at) {
        try {
            return handoverDoc(project, { scope, code, at });
        }
        catch {
            return null;
        }
    }
    function render() {
        const o = host.current();
        if (!dialog || !state || !o || o.key !== state.key)
            return;
        const view = studioView(o.project), st = state;
        const pick = h('select', { id: 'handover-scope', 'data-act': 'scope', 'aria-label': '인수인계 범위', onchange: (e) => {
                const v = e.target.value, scope = v || null, doc = make(o.project, scope, st.code, st.at);
                if (doc) {
                    st.scope = scope;
                    st.text = doc.text;
                    st.trimmed = doc.trimmed;
                    st.msg = null;
                    render();
                }
            } }, h('option', { value: '' }, '프로젝트 전체'));
        const walk = (id, depth) => {
            const part = view.parts.find(x => x.id === id);
            if (!part)
                return;
            pick.append(h('option', { value: part.id }, `${'　'.repeat(depth)}${part.name}${part.childIds.length ? ` (안쪽 ${part.childIds.length})` : ''}`));
            part.childIds.forEach(c => walk(c, depth + 1));
        };
        view.roots.forEach(r => walk(r, 1));
        pick.value = st.scope ?? '';
        const text = h('textarea', { id: 'handover-text', 'data-act': 'text', class: 'handover-text', readonly: true, rows: '18', spellcheck: 'false', 'aria-label': '인수인계 문서' });
        text.value = st.text;
        // Drawn again (another range, a message): the control that had focus keeps it.
        const had = dialog.contains(document.activeElement) ? document.activeElement.dataset.act ?? null : null;
        dialog.replaceChildren(h('header', { class: 'handover-head' }, h('h2', { id: 'handover-title' }, '인수인계 문서'), h('button', { type: 'button', class: 'close', 'data-act': 'close', 'aria-label': '닫기', title: '닫기 (Esc)', onclick: close }, '×')), h('p', { class: 'handover-lead' }, '새 세션의 첫 메시지에 이 문서를 그대로 붙여 넣고, 그 아래에 이어서 할 일을 적으세요. 지도와 기록에 있는 내용만 옮겼어요(만들 때 AI를 부르지 않아요). 그 세션의 기록이 들어오면 지도에 ‘인수인계로 이어받음’으로 표시돼요.'), 
        // A web chat keeps no session file: its record comes back only through the request text, pasted by hand.
        h('p', { class: 'handover-web' }, '웹 AI 대화에서 이어 가면 기록이 저절로 들어오지 않아요. 일을 마친 뒤 ', h('button', { type: 'button', class: 'link-button', 'data-act': 'web', onclick: copyWebAsk }, '기록 요청 문구 복사'), '를 눌러 그 대화에 붙여 넣고, 나온 답을 ‘돌아와 읽기 › 기록 붙여넣기’에 넣어 저장하세요.'), h('label', { class: 'handover-scope', for: 'handover-scope' }, h('span', {}, '범위'), pick), text, h('div', { class: 'handover-acts' }, h('button', { type: 'button', class: 'primary', 'data-act': 'copy', onclick: copy }, '복사'), h('button', { type: 'button', class: 'secondary', 'data-act': 'save', onclick: save }, '.md로 저장'), 
        // A document cut down to fit one prompt says so here too, not only inside the text.
        h('span', { class: 'handover-msg', role: 'status' }, st.msg ?? `${st.text.length.toLocaleString()}자${st.trimmed ? ` · 길어서 부분 ${st.trimmed}개는 줄여 적었어요` : ''}`)));
        if (had)
            dialog.querySelector(`[data-act="${had}"]`)?.focus();
    }
    async function copy() {
        const st = state;
        if (!st)
            return;
        let ok = true;
        try {
            await navigator.clipboard.writeText(st.text);
        }
        catch {
            ok = false;
        }
        if (state !== st)
            return;
        st.msg = ok ? '복사했어요. 새 세션에 붙여 넣으세요.' : '자동 복사가 막혀 있어요. 글을 선택해 직접 복사하세요.';
        render();
        if (!ok) {
            const t = document.getElementById('handover-text');
            t?.focus();
            t?.select();
        }
    }
    async function copyWebAsk() {
        const st = state;
        if (!st)
            return;
        let ok = true;
        try {
            await navigator.clipboard.writeText(WEB_RECORD_ASK);
        }
        catch {
            ok = false;
        }
        if (state !== st)
            return;
        st.msg = ok ? '기록 요청 문구를 복사했어요. 웹 AI 대화에서 일을 마친 뒤 붙여 넣으세요.' : '자동 복사가 막혀 있어요. ‘기록 붙여넣기’의 ‘웹 대화용 기록 요청 문구 복사’에서 직접 복사하세요.';
        render();
    }
    function save() {
        const o = host.current(), st = state;
        if (!o || !st)
            return;
        const a = document.createElement('a'), url = URL.createObjectURL(new Blob([st.text], { type: 'text/markdown;charset=utf-8' }));
        a.href = url;
        a.download = `${o.project.name.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60) || 'project'}-인수인계-${st.code}.md`;
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        st.msg = '파일로 내려받았어요.';
        render();
    }
    function open(scope, opener = null) {
        const o = host.current();
        if (!o)
            return;
        const code = handoverCode(), at = new Date().toISOString(), doc = make(o.project, scope, code, at) ?? make(o.project, null, code, at);
        if (!doc)
            return;
        state = { key: o.key, scope: doc.text.includes(`:${code}:`) ? scope : null, code, at, text: doc.text, trimmed: doc.trimmed, msg: null };
        if (!dialog) {
            dialog = h('dialog', { id: 'handover-sheet', class: 'handover-sheet', 'aria-labelledby': 'handover-title' });
            // Esc closes this dialog only: the page's own Esc (closing a part, leaving a scope) does not run under it.
            dialog.addEventListener('keydown', e => { if (e.key === 'Escape')
                e.stopPropagation(); });
            dialog.addEventListener('close', () => { state = null; from?.focus(); from = null; });
            document.body.append(dialog);
        }
        from = opener;
        render();
        if (!dialog.open)
            dialog.showModal();
        document.getElementById('handover-text')?.scrollTo(0, 0);
    }
    function close() { dialog?.close(); }
    return { open, close, isOpen: () => !!dialog?.open };
}
