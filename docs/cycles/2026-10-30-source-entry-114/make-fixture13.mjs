// AF114: writes the synthetic project.13 copy the normal-UI check imports, with a pre-114 build (the start commit 71f473a's
// continuity dist), so its bytes are what that writer kept: a map read from a pasted requirement, a frozen request in its plan
// bundle, and a later pasted report with prose and code. Author-written, model-free; not private 111/113 material.
//   node docs/cycles/2026-10-30-source-entry-114/make-fixture13.mjs <pre-114 app/continuity/dist/public> <out-dir>
import { writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const [dist, out] = process.argv.slice(2).map(p => resolve(p)); mkdirSync(out, { recursive: true });
const at = f => import(pathToFileURL(`${dist}/${f}`).href);
const [D, M, C, S, V, St, P] = await Promise.all(['shared/domain.js', 'shared/map-reading.js', 'shared/change-plan.js', 'shared/storage.js', 'shared/validation.js', 'shared/studio.js', 'client/plan-store.js'].map(at));
const { mapWithRequest } = await import(pathToFileURL(resolve('app/continuity/tests/source114-case.mjs')).href);
const c = mapWithRequest({ D, M, C, S, studioView: St.studioView, emptyBundle: P.emptyBundle });
if (c.project.schemaVersion !== 'idea015.project.13') throw new Error(`not a pre-114 writer: ${c.project.schemaVersion}`);
const raw = S.serializeBackup(V.parseProject(JSON.stringify(c.project)), null);
P.parseBundle(JSON.parse(JSON.stringify(c.bundle)), c.project.id);
writeFileSync(`${out}/project13-backup.json`, raw);
writeFileSync(`${out}/plans13-bundle.json`, JSON.stringify(c.bundle));
console.log(JSON.stringify({ schema: c.project.schemaVersion, project: c.project.id, rq: c.rq.id, pasted: c.project.pasted.length, readings: c.project.readings.length, bytes: raw.length }));
