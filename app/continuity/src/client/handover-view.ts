/* The handover document, opened from the bar above the map (the project, or the part whose inside is open) or from a part's ⋯ menu
 * (that part): made at once
 * from what the map and records hold (shared/handover.ts, no AI call), read in place, copied or saved as a .md file. Changing the
 * range makes the document again with the same code, so one opening is one handover however it is narrowed. Nothing is stored:
 * the code inside the document is how a session that starts from it is known later (it comes back in that session's records). */
import type { Project } from '../shared/types.js';
import type { FrozenRequest } from '../shared/request-return.js';
import { studioView } from '../shared/studio.js';
import { handoverDoc, handoverCode, WEB_RECORD_ASK, type Handover } from '../shared/handover.js';
import { h, svg } from './plan-dom.js';
import type { CloudLink } from './cloud-link.js';

/** requests: the change requests made for the open project (with the plan's), named in the document with what came back. */
export interface HandoverHost { current(): { key: string; kind: string; project: Project } | null; requests?(): FrozenRequest[];
  /** The web AI connector, where this site offers one: the web chat then takes the handover and leaves records itself. */
  cloud?(): CloudLink }

export function createHandoverView(host: HandoverHost) {
  let dialog: HTMLDialogElement | null = null, from: HTMLElement | null = null;
  let state: { key: string; scope: string | null; code: string; at: string; text: string; trimmed: number; msg: string | null } | null = null;

  function make(project: Project, scope: string | null, code: string, at: string): Handover | null {
    try { return handoverDoc(project, { scope, code, at, requests: host.requests?.() ?? [] }); } catch { return null; }
  }
  function render() {
    const o = host.current(); if (!dialog || !state || !o || o.key !== state.key) return;
    const view = studioView(o.project), st = state;
    const pick = h('select', { id: 'handover-scope', 'data-act': 'scope', 'aria-label': '인수인계 범위', onchange: (e: Event) => {
      const v = (e.target as HTMLSelectElement).value, scope = v || null, doc = make(o.project, scope, st.code, st.at);
      if (doc) { st.scope = scope; st.text = doc.text; st.trimmed = doc.trimmed; st.msg = null; render(); }
    } }, h('option', { value: '' }, '프로젝트 전체'));
    const walk = (id: string, depth: number) => {
      const part = view.parts.find(x => x.id === id); if (!part) return;
      pick.append(h('option', { value: part.id }, `${'　'.repeat(depth)}${part.name}${part.childIds.length ? ` (안쪽 ${part.childIds.length})` : ''}`));
      part.childIds.forEach(c => walk(c, depth + 1));
    };
    view.roots.forEach(r => walk(r, 1));
    pick.value = st.scope ?? '';
    const text = h('textarea', { id: 'handover-text', 'data-act': 'text', class: 'handover-text', readonly: true, rows: '18', spellcheck: 'false', 'aria-label': '인수인계 문서' });
    text.value = st.text;
    // Drawn again (another range, a message): the control that had focus keeps it.
    const had = dialog.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.act ?? null : null;
    const cloud = cloudBlock(o.key);
    const glyph = svg('svg', { viewBox: '0 0 20 20' });
    glyph.append(svg('path', { d: 'M6 2.75h5.5L15 6.25v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-12.5a1 1 0 0 1 1-1z' }), svg('path', { d: 'M11.25 2.75v3.75H15M7.75 10.5h4.5M7.75 13.25h3' }));
    const icon = h('span', { class: 'handover-icon', 'aria-hidden': 'true' }, glyph);
    dialog.replaceChildren(
      h('header', { class: 'handover-head' }, icon,
        h('div', { class: 'handover-titles' }, h('h2', { id: 'handover-title' }, '인수인계 문서'),
          h('p', { class: 'handover-lead' }, h('span', { class: 'hl-do' }, '새 세션의 첫 메시지에 이 문서를 그대로 붙여 넣고, 그 아래에 이어서 할 일을 적으세요.'), ' ',
            h('span', { class: 'hl-note' }, '지도와 기록에 있는 내용만 옮겼어요(만들 때 AI를 부르지 않아요). 그 세션의 기록이 들어오면 지도에 ‘인수인계로 이어받음’으로 표시돼요.'))),
        h('button', { type: 'button', class: 'close', 'data-act': 'close', 'aria-label': '닫기', title: '닫기 (Esc)', onclick: close }, '×')),
      // The web AI connector, where this site has one: its own card above the document.
      ...(cloud ? [cloud] : []),
      h('div', { class: 'handover-bar' },
        h('label', { class: 'handover-scope', for: 'handover-scope' }, h('span', {}, '범위'), pick),
        // A document cut down to fit one prompt says so here too, not only inside the text.
        h('span', { class: 'handover-msg', role: 'status' }, st.msg ?? `${st.text.length.toLocaleString()}자${st.trimmed ? ` · 길어서 부분 ${st.trimmed}개는 줄여 적었어요` : ''}`)),
      text,
      h('footer', { class: 'handover-foot' },
        // A web chat keeps no session file: without the connector its record comes back only through the request text, pasted by hand.
        cloud ? null : h('p', { class: 'handover-web' }, '웹 AI 대화에서 이어 가면 기록이 저절로 들어오지 않아요. 일을 마친 뒤 ',
          h('button', { type: 'button', class: 'link-button', 'data-act': 'web', onclick: copyWebAsk }, '기록 요청 문구 복사'),
          '를 눌러 그 대화에 붙여 넣고, 나온 답을 ‘돌아와 읽기 › 기록 붙여넣기’에 넣어 저장하세요.'),
        h('div', { class: 'handover-acts' },
          h('button', { type: 'button', class: 'secondary', 'data-act': 'save', onclick: save }, '.md로 저장'),
          h('button', { type: 'button', class: 'primary', 'data-act': 'copy', onclick: copy }, '복사'))));
    if (had) dialog.querySelector<HTMLElement>(`[data-act="${had}"]`)?.focus();
  }
  /** The web AI connector's part of the dialog: sign in, link this project, then the address to add in claude.ai. */
  function cloudBlock(key: string): HTMLElement | null {
    const c = host.cloud?.(), st = c?.state(); if (!c || !st || st.kind === 'off' || !state || state.key !== key) return null;
    if (st.kind === 'out') return h('div', { class: 'handover-web handover-cloud' },
      h('p', {}, h('strong', {}, '웹 AI 커넥터'), ' · claude.ai에 AgentFlow를 커넥터로 추가하면, 웹 대화가 이 인수인계를 직접 받아 가고 한 일을 기록으로 남겨요.'),
      h('a', { class: 'secondary small', href: c.loginHref(), 'data-act': 'cloud-login' }, 'GitHub로 로그인'));
    if (!c.linked(key)) return h('div', { class: 'handover-web handover-cloud' },
      h('p', {}, h('strong', {}, '웹 AI 커넥터'), ` · ${st.user} 계정으로 로그인했어요. 이 프로젝트를 이으면, 웹 대화가 이 인수인계를 받아 가고 남긴 기록이 이 프로젝트로 들어와요.`),
      h('button', { type: 'button', class: 'secondary small', 'data-act': 'cloud-link', onclick: () => { void c.link(key).then(render); } }, '이 프로젝트를 웹 AI 커넥터에 잇기'));
    return h('div', { class: 'handover-web handover-cloud' },
      h('p', {}, h('strong', {}, '웹 AI 커넥터에 이어져 있어요'), ` (${st.user}). claude.ai › 설정 › 커넥터 › 사용자 지정 커넥터 추가에 이 주소를 넣고 GitHub로 로그인하세요. 웹 대화에서 "AgentFlow 인수인계 받아 줘"라고 하면 돼요.`),
      h('p', {}, h('code', { class: 'handover-mcp' }, st.mcp), ' ', h('button', { type: 'button', class: 'link-button', 'data-act': 'cloud-copy', onclick: () => void copyText(st.mcp, '커넥터 주소를 복사했어요.') }, '주소 복사')),
      h('p', { class: 'fine' }, c.error() ?? '이 프로젝트가 열려 있는 동안 1분마다 웹 대화의 기록을 가져오고, 바뀐 인수인계를 올려 둬요. ',
        h('a', { href: st.pc, target: '_blank', rel: 'noopener' }, 'PC Studio에서도 받기'), ' · ',
        h('button', { type: 'button', class: 'link-button', 'data-act': 'cloud-unlink', onclick: () => { void c.unlink(key).then(render); } }, '잇기 끊기')));
  }
  async function copyText(text: string, done: string) {
    const st = state; if (!st) return;
    let ok = true; try { await navigator.clipboard.writeText(text); } catch { ok = false; }
    if (state !== st) return;
    st.msg = ok ? done : '자동 복사가 막혀 있어요. 주소를 선택해 직접 복사하세요.'; render();
  }
  async function copy() {
    const st = state; if (!st) return;
    let ok = true; try { await navigator.clipboard.writeText(st.text); } catch { ok = false; }
    if (state !== st) return;
    st.msg = ok ? '복사했어요. 새 세션에 붙여 넣으세요.' : '자동 복사가 막혀 있어요. 글을 선택해 직접 복사하세요.';
    render();
    if (!ok) { const t = document.getElementById('handover-text') as HTMLTextAreaElement | null; t?.focus(); t?.select(); }
  }
  async function copyWebAsk() {
    const st = state; if (!st) return;
    let ok = true; try { await navigator.clipboard.writeText(WEB_RECORD_ASK); } catch { ok = false; }
    if (state !== st) return;
    st.msg = ok ? '기록 요청 문구를 복사했어요. 웹 AI 대화에서 일을 마친 뒤 붙여 넣으세요.' : '자동 복사가 막혀 있어요. ‘기록 붙여넣기’의 ‘웹 대화용 기록 요청 문구 복사’에서 직접 복사하세요.';
    render();
  }
  function save() {
    const o = host.current(), st = state; if (!o || !st) return;
    const a = document.createElement('a'), url = URL.createObjectURL(new Blob([st.text], { type: 'text/markdown;charset=utf-8' }));
    a.href = url; a.download = `${o.project.name.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60) || 'project'}-인수인계-${st.code}.md`;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    st.msg = '파일로 내려받았어요.'; render();
  }
  function open(scope: string | null, opener: HTMLElement | null = null) {
    const o = host.current(); if (!o) return;
    const code = handoverCode(), at = new Date().toISOString(), doc = make(o.project, scope, code, at) ?? make(o.project, null, code, at);
    if (!doc) return;
    state = { key: o.key, scope: doc.text.includes(`:${code}:`) ? scope : null, code, at, text: doc.text, trimmed: doc.trimmed, msg: null };
    if (!dialog) {
      dialog = h('dialog', { id: 'handover-sheet', class: 'handover-sheet', 'aria-labelledby': 'handover-title' });
      // Esc closes this dialog only: the page's own Esc (closing a part, leaving a scope) does not run under it.
      dialog.addEventListener('keydown', e => { if (e.key === 'Escape') e.stopPropagation(); });
      dialog.addEventListener('close', () => { state = null; from?.focus(); from = null; });
      document.body.append(dialog);
    }
    from = opener;
    render();
    if (!dialog.open) dialog.showModal();
    (document.getElementById('handover-text') as HTMLTextAreaElement | null)?.scrollTo(0, 0);
  }
  function close() { dialog?.close(); }
  return { open, close, isOpen: () => !!dialog?.open, refresh: () => render() };
}
