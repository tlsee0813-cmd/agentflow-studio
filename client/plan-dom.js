/* Small DOM helpers shared by the map client and the change-plan view. Attributes only through setAttribute and CSSOM, so the
 * page keeps working under style-src 'self'. */
import { quoteAt } from '../shared/digest-api.js';
export const $ = (id) => document.getElementById(id);
export function h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (typeof v === 'function')
            el.addEventListener(k.slice(2), v);
        else if (k === 'style')
            el.style.cssText = v; // CSSOM: allowed under style-src 'self' (attributes are not)
        else if (v === true)
            el.setAttribute(k, '');
        else if (v !== false)
            el.setAttribute(k, v);
    }
    for (const c of children)
        if (c !== null && c !== undefined && c !== false)
            el.append(c);
    return el;
}
const SVG = 'http://www.w3.org/2000/svg';
/** Shared original-text rendering, optionally at an exact stored interval (repeated quotes keep their own origin). */
export function quotedText(text, quote, interval) {
    const at = interval && text.slice(interval.at, interval.at + interval.length) === quote ? interval : quote ? quoteAt(text, quote) : null;
    return at ? [text.slice(0, at.at), h('mark', { class: 'rr-mark' }, text.slice(at.at, at.at + at.length)), text.slice(at.at + at.length)] : [text];
}
export const put = (el, ...children) => { for (const c of children)
    if (c)
        el.append(c); };
export const svg = (tag, attrs) => { const el = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs))
    el.setAttribute(k, v); return el; };
export const chevron = (open) => { const el = svg('svg', { viewBox: '0 0 16 16', 'aria-hidden': 'true', class: open ? 'open' : '' }); el.append(svg('path', { d: 'M6 4l4 4-4 4' })); return el; };
export const fullTime = (at) => { const t = new Date(at); return Number.isNaN(t.getTime()) ? '' : new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(t); };
export function ago(at) {
    if (!at)
        return '';
    const t = Date.parse(at);
    if (!Number.isFinite(t))
        return '';
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 1)
        return '방금';
    if (m < 60)
        return `${m}분 전`;
    const hr = Math.round(m / 60);
    if (hr < 24)
        return `${hr}시간 전`;
    const d = Math.round(hr / 24);
    if (d === 1)
        return '어제';
    if (d < 7)
        return `${d}일 전`;
    return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(new Date(t));
}
/** One inspector width for a selected part and the change plan (matches .inspector in styles.css). Narrow: the whole width. */
export const inspectorWidth = () => (window.innerWidth < 720 ? window.innerWidth : Math.min(392, Math.max(336, window.innerWidth * 0.27)));
/** An AI action on a server that asks for an access code reads as unavailable while no code is given, with the reason beside it;
 * typing a code turns it on in place (syncCodeGates; no re-render, so the caret stays in the field). The action's own other
 * reason to be off (busy, nothing to send) is kept apart in data-off. The request path is unchanged. */
export const CODE_FIRST = '접속 코드를 먼저 적어 주세요';
export function codeGate(btn, needed, hasCode, otherwiseOff) {
    if (needed) {
        btn.dataset.codeGate = '';
        btn.dataset.off = otherwiseOff ? '1' : '';
    }
    else {
        delete btn.dataset.codeGate;
        delete btn.dataset.off;
    }
    btn.disabled = otherwiseOff || (needed && !hasCode);
    return btn;
}
export const codeNote = (needed, hasCode) => (needed ? h('span', { class: 'code-first', 'data-code-note': '', role: 'status', hidden: hasCode }, CODE_FIRST) : null);
export function syncCodeGates(hasCode) {
    document.querySelectorAll('button[data-code-gate]').forEach(b => { b.disabled = b.dataset.off === '1' || !hasCode; });
    document.querySelectorAll('[data-code-note]').forEach(n => { n.hidden = hasCode; });
}
