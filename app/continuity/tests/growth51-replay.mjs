// Recipe .51: the offline replay of the two stored growth-run refusals (both stopped on global-final asking for a second revision under .50).
// The fixtures (tests/fixtures/growth51/*.json.gz) are anonymised copies of what those runs stored: every completed stage value, the refused
// global-final verdict, the encoded map input (its ask) and, for track A, the project state the ask was built from. Project and person names
// were replaced by neutral ones of the same length, so every stored offset still holds. Model-free: the provider is a stub that answers only
// the final review, with the stored verdict.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { replayPipeline } from './containment50-replay.mjs';
import { buildMapAsk, MAP7_SCHEMA, projectVariantGloss } from '../dist/public/shared/map-reading.js';
import { decodeMapInput } from '../dist/public/shared/map-job.js';
import { studioView } from '../dist/public/shared/studio.js';
import { currentView } from '../dist/public/shared/map-identity.js';
import { plainView, projectIdGloss } from '../dist/public/client/plain-ids.js';
import { parseProject } from '../dist/public/shared/validation.js';

/** A stored track: { stages, final, input (encoded MapInput), state? (the project before the reading, raw JSON) }. */
export function growthFixture(name) {
  const body = JSON.parse(gunzipSync(readFileSync(fileURLToPath(new URL(`./fixtures/growth51/${name}.json.gz`, import.meta.url)))).toString('utf8'));
  if (body.format !== 'growth51.replay.1') throw new Error('fixture format');
  return body;
}
/** The pipeline over the stored stages; only the final review reaches the stub, which answers the stored verdict (any other call fails). */
export function replayRefusal(fixture, onCall = () => {}) {
  return replayPipeline(fixture.stages, ({ stage, input }) => {
    onCall({ stage, input });
    if (stage === 'global' && input.semanticReview) return structuredClone(fixture.final);
    throw new Error(`unexpected ${stage} call`);
  });
}
export const fixtureInput = fixture => decodeMapInput(fixture.input);
export const fixtureProject = fixture => parseProject(JSON.stringify(fixture.state));
/** The ask the app builds for a project (app.ts plainMapView: the current view with the record IDs glossed), before routing. */
export function appAsk(p) {
  const v = currentView(p, studioView(p));
  return buildMapAsk(p, plainView(v, projectIdGloss(p, id => v.parts.find(x => x.id === id)?.name ?? null, projectVariantGloss(p))), [], undefined, MAP7_SCHEMA);
}
