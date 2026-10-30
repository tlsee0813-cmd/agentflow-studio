// AF137: runs the synthetic corpus (app/continuity/tests/contract137-corpus.mjs) through the base validator and this checkout's
// validator on the very same ask/reply objects, and reports per case whether they agree: the same accept/reject, deep-equal values
// when accepted, map.6 refusals identical, structured refusals that existed before identical, and a map.7 generic refusal now a
// MapReplyError (rule contract, a fixed category) that carries none of the planted markers. Model-free; sends nothing.
//   node docs/cycles/2026-10-30-contract-diagnostics-137/compare-base.mjs <base checkout> [<out.json>]
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
const [baseRoot, outFile] = process.argv.slice(2);
const here = fileURLToPath(new URL('../../..', import.meta.url)), at = (root, rel) => import(pathToFileURL(join(root, 'app/continuity', rel)).href);
const sha = root => execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const tree = root => execFileSync('git', ['-C', root, 'rev-parse', 'HEAD:app'], { encoding: 'utf8' }).trim();
const dirty = root => execFileSync('git', ['-C', root, 'status', '--short', 'app/continuity/src'], { encoding: 'utf8' }).trim();
const [D, M, C, S, St, P, V] = await Promise.all(['shared/domain.js', 'shared/map-reading.js', 'shared/change-plan.js', 'shared/storage.js', 'shared/studio.js', 'client/plan-store.js', 'shared/validation.js'].map(f => at(here, `dist/public/${f}`)));
const B = await at(resolve(baseRoot), 'dist/public/shared/map-reading.js');
const { corpus, outcome, MARKERS } = await at(here, 'tests/contract137-corpus.mjs');
const cases = corpus({ D, M, C, S, studioView: St.studioView, emptyBundle: P.emptyBundle, parseProject: V.parseProject });
const rows = cases.map(x => {
  const before = JSON.stringify(x.reply), b = outcome(B.validateMapReply, x), c = outcome(M.validateMapReply, x), problems = [];
  if (JSON.stringify(x.reply) !== before) problems.push('wire-mutated');
  if (b.ok !== c.ok) problems.push('accept-differs');
  else if (b.ok && JSON.stringify(b.value) !== JSON.stringify(c.value)) problems.push('value-differs');
  else if (!b.ok) {
    if (x.schema !== 7 || b.name === 'MapReplyError') { if (JSON.stringify(b) !== JSON.stringify(c)) problems.push('refusal-changed'); }
    else if (!(c.name === 'MapReplyError' && c.message === 'INVALID_RESPONSE' && c.rule === 'contract')) problems.push('not-diagnosed');
    else if (x.expect && JSON.stringify([c.path, c.rule, c.target]) !== JSON.stringify(x.expect)) problems.push('unexpected-diagnosis');
    // Only the new diagnoses are held to this: a structured refusal that existed before 137 is compared for identity above.
    if (c.rule === 'contract' && MARKERS.some(m => JSON.stringify([c.path, c.rule, c.target]).includes(m))) problems.push('marker-exposed');
  }
  const brief = o => o.ok ? 'accept' : o.name === 'MapReplyError' ? `${o.path} | ${o.rule} | ${o.target}` : `${o.name}:${o.message}`;
  return { name: x.name, base: brief(b), candidate: brief(c), problems };
});
const summary = { base: { commit: sha(baseRoot), appTree: tree(baseRoot), srcDirty: dirty(baseRoot) !== '' }, candidate: { commit: sha(here), appTree: tree(here), srcDirty: dirty(here) !== '' },
  cases: rows.length, accepted: rows.filter(r => r.base === 'accept').length, problems: rows.filter(r => r.problems.length).length, rows };
if (outFile) writeFileSync(outFile, JSON.stringify(summary, null, 1) + '\n');
console.log(JSON.stringify({ ...summary, rows: undefined }));
for (const r of rows) console.log(`${r.problems.length ? 'DIFF' : 'same'}  ${r.name.padEnd(36)} base=${r.base}  cand=${r.candidate} ${r.problems.join(',')}`);
process.exitCode = summary.problems ? 1 : 0;
