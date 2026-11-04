// Recipe .47 golden: the map asks of v4 and v3 records (and records of no version) as the .46 code built them, by digest. The builder
// takes the modules it builds with, so the very same cases ran on the .46 build (8c8d8c3e) to write tests/fixtures/record47/v4-golden.json
// and run on this build in record47.test.mjs. Fictional records only (the repository's own fixtures).
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const fixture = name => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const long = () => { const a = fixture('record43/chunk1.txt'), b = fixture('record43/chunk2.txt'); return [a, b, a, b, a, b].join('\n\n'); };
/** name → the texts pasted, in order (one minute apart). */
export const GOLDEN_CASES = () => [
  ['v4-chunks', [fixture('record43/chunk1.txt'), fixture('record43/chunk2.txt')]],
  ['v3-koru', ['koru43/k38-status.txt', 'koru43/koru35-design.txt', 'koru43/koru35-status.txt', 'koru43/koru39-design.txt'].map(fixture)],
  ['v3-design-status', ['oss42/design.txt', 'oss42/status.txt', 'cli41/design.txt', 'cli41/status.txt'].map(fixture)],
  // Past every bound: six texts, one of them over 30,000 characters (cut, the rest read next time; the fifth and sixth wait).
  ['v4-long', [fixture('record43/chunk1.txt'), long(), fixture('koru43/koru39-design.txt'), fixture('record43/chunk2.txt'), fixture('oss42/design.txt'), 'plain note of no version\n'.repeat(40)]]];
export const GOLDEN_SCHEMAS = ['studio.map.6', 'studio.map.7', 'studio.map.5', true, false];

/** The digest of what buildMapAsk makes of each case under each schema (ids made positional, times fixed): ask, record refs, coverage,
 * problem, and the job wire's codec version (anchored asks with no problem). */
export function goldenDigests({ D, M, S, J }, limits) {
  const out = {};
  for (const [name, texts] of GOLDEN_CASES()) {
    let p = D.createProject(); p = { ...p, name: 'golden' };
    for (const t of texts) p = D.pasteRecord(p, t, null).project;
    p = { ...p, pasted: p.pasted.map((r, i) => ({ ...r, at: new Date(Date.UTC(2026, 10, 5, 9, i)).toISOString() })) };
    const index = new Map(p.pasted.map((r, i) => [r.id, `#${i}`]));
    for (const schema of GOLDEN_SCHEMAS) {
      const inp = limits ? M.buildMapAsk(p, S.studioView(p), [], undefined, schema, limits) : M.buildMapAsk(p, S.studioView(p), [], undefined, schema);
      const records = [...inp.records].map(([k, v]) => [k, { ...v, id: index.get(v.id) ?? v.id }]);
      const codec = schema !== false && !inp.problem ? J.encodeMapInput(inp).version : null;
      const body = JSON.stringify({ ask: inp.ask, records, coverage: inp.coverage, problem: inp.problem, codec });
      out[`${name} ${schema}`] = createHash('sha256').update(body).digest('hex').slice(0, 32);
    }
  }
  return out;
}
