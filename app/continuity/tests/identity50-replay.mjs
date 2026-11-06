// Recipe .50 step 3 (identity50): the later asks of the paperless growth run rebuilt from the stored project states, when the run's
// artefacts are on this machine (AF_GROWTH_DIR). No model is called; the states are read, never written.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as M from '../dist/public/shared/map-reading.js';
import { parseProject } from '../dist/public/shared/validation.js';
import { studioView } from '../dist/public/shared/studio.js';

export const GROWTH = process.env.AF_GROWTH_DIR ?? '';
const json = f => JSON.parse(readFileSync(join(GROWTH, f), 'utf8'));
/** The three later readings the identity diagnosis traced: the state each was asked from and its stored ask. stage3-r1 and R10 were
 * asked from the state before them with the next stage's record pasted (the pastes of the following state, in order). */
export const CASES = Object.freeze([
  { run: 'stage3-r1', state: 'state-after-2', pastes: 'state-after-3' },
  { run: 'stage4-r2', state: 'state-after-3', pastes: 'state-after-4.pre49' },
  { run: 'stage4-r3', state: 'state-after-4.pre49', pastes: null }
]);
export const haveGrowth = () => !!GROWTH && CASES.every(c => existsSync(join(GROWTH, 'runs', c.run, 'ask.json')) && existsSync(join(GROWTH, 'project', `${c.state}.json`)));
export function rebuilt(c) {
  const state = json(`project/${c.state}.json`);
  if (c.pastes) state.pasted = json(`project/${c.pastes}.json`).pasted;
  const p = parseProject(JSON.stringify(state));
  return { project: p, input: M.buildMapAsk(p, studioView(p), [], undefined, M.MAP7_SCHEMA), stored: json(`runs/${c.run}/ask.json`).body.input.ask };
}
export const utf8 = v => new TextEncoder().encode(typeof v === 'string' ? v : JSON.stringify(v)).length;
/** The map part of an ask, as fitMap measures it against META_BYTES. */
export const metaBytes = ask => utf8({ ...ask, records: [], ...(ask.requests ? { requests: [] } : {}), ...(ask.priors ? { priors: [] } : {}) });
