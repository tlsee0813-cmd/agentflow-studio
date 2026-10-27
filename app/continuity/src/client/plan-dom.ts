/* Small DOM helpers shared by the map client and the change-plan view. Attributes only through setAttribute and CSSOM, so the
 * page keeps working under style-src 'self'. */
export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
export type Child = Node | string | null | undefined | false;
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | boolean | ((e: Event) => void)> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'style') el.style.cssText = v as string; // CSSOM: allowed under style-src 'self' (attributes are not)
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false) el.setAttribute(k, v);
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}
const SVG = 'http://www.w3.org/2000/svg';
export const put = (el: HTMLElement, ...children: Child[]) => { for (const c of children) if (c) el.append(c); };
export const svg = (tag: string, attrs: Record<string, string>) => { const el = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); return el; };
export const chevron = (open: boolean) => { const el = svg('svg', { viewBox: '0 0 16 16', 'aria-hidden': 'true', class: open ? 'open' : '' }); el.append(svg('path', { d: 'M6 4l4 4-4 4' })); return el; };
export const fullTime = (at: string) => { const t = new Date(at); return Number.isNaN(t.getTime()) ? '' : new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(t); };
export function ago(at: string | null): string {
  if (!at) return '';
  const t = Date.parse(at); if (!Number.isFinite(t)) return '';
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return '방금'; if (m < 60) return `${m}분 전`;
  const hr = Math.round(m / 60); if (hr < 24) return `${hr}시간 전`;
  const d = Math.round(hr / 24); if (d === 1) return '어제'; if (d < 7) return `${d}일 전`;
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(new Date(t));
}
/** One inspector width for a selected part and the change plan (matches .inspector in styles.css). Narrow: the whole width. */
export const inspectorWidth = () => (window.innerWidth < 720 ? window.innerWidth : Math.min(392, Math.max(336, window.innerWidth * 0.27)));
