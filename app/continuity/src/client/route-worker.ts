/* v13 fix 2 (review of v13: a 보기 switch stood still 0.4–0.7 s after the cards landed while the new form's lines were routed): the lines of a
 * form about to be drawn are routed here, off the page's thread, while its cards fly; the page keeps each result by its exact input and
 * draws from it (app.ts routeMemo), so the same lines come out as if routed on the page. Pure: map-route only. */
import { routeEdges, focusRoutes, type RouteOpts } from './map-route.js';
import type { Box, Edge } from './map-layout.js';

/** One set of lines to route: the boxes as the page has them, the set, the router's options, and the static focus's scale (1: none). */
export interface RouteJob { sig: string; boxes: [string, Box][]; edges: Edge[]; opts: RouteOpts; c: number }
interface Scope { onmessage: ((e: { data: { id: number; jobs: RouteJob[] } }) => void) | null; postMessage(m: unknown): void }
const scope = globalThis as unknown as Scope;
scope.onmessage = e => {
  const { id, jobs } = e.data, out: { sig: string; routes: [string, unknown][] }[] = [];
  for (const j of jobs) {
    try { const boxes = new Map(j.boxes); out.push({ sig: j.sig, routes: [...(j.c < 1 ? focusRoutes(boxes, j.edges, j.c, j.opts) : routeEdges(boxes, j.edges, j.opts))] }); }
    catch { /* the page routes this set itself */ }
  }
  scope.postMessage({ id, out });
};
