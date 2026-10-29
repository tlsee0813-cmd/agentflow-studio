import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { firstMap6OutputSchema as schema, assertFirstMap6Ask, shapeErrors } from './experience95-output-schema.mjs';

const ops = process.cwd(), root = path.resolve(ops, '../product-handoff-20261024'), results = path.join(ops, '.ops/results');
const source = 'b3e2033783f391d9af1d1421fe7621cf4f23aba4';
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const hash = value => createHash('sha256').update(value).digest('hex');
assert.equal(git('rev-parse', 'HEAD'), source); assert.equal(git('status', '--porcelain'), '');
// The map module did not change after the local734 build; check source identity
// rather than relabel that build as a new95 build.
assert.equal(git('rev-parse', 'HEAD:app/continuity/src/shared/map-reading.ts'), git('rev-parse', '734fe8870a90952edb3ce6bed758da677366613a:app/continuity/src/shared/map-reading.ts'));
const { validateMapReply } = await import(pathToFileURL(path.join(root, 'app/continuity/dist/public/shared/map-reading.js')));
const cases = [];
for (const id of ['actual-order', 'micro-javascript']) {
  const name = `experience89-codex-sol-${id}-r1-final.txt`, raw = await fs.readFile(path.join(results, name));
  const prior = JSON.parse(await fs.readFile(path.join(results, `experience89-codex-sol-${id}-r1-parsed.json`), 'utf8'));
  const receipt = JSON.parse(await fs.readFile(path.join(results, `experience89-codex-sol-${id}-r1-result.json`), 'utf8'));
  assert.equal(hash(raw), receipt.finalSha256); assertFirstMap6Ask(prior.ask);
  const wire = JSON.parse(raw.toString('utf8')); // No repairs, fence stripping, omissions, or default filling.
  const errors = shapeErrors(wire); assert.deepEqual(errors, []);
  validateMapReply(wire, prior.ask);
  assert.equal(hash(await fs.readFile(path.join(results, name))), hash(raw));
  cases.push({ id, originalSha256: hash(raw), unchanged: true, shapeErrors: errors, existingValidator: 'accepted',
    meaning: 'Historical acceptance only; no new model, semantic review or UI run' });
}
const minimal = { summary: '', parts: [], relations: [], candidates: [], gaps: [], matches: [], material: [] };
const candidate = { text: '[synthetic] identity unresolved', parts: ['new:a', 'new:b'], at: null, target: 'identity', statement: null };
const synthetic = [];
const record = (name, wire, expected) => { const errors = shapeErrors(wire); assert.equal(errors.length === 0, expected); synthetic.push({ name, shapeAccepted: !errors.length, errors }); };
record('complete candidate shape; not a valid grounded map', { ...minimal, candidates: [candidate] }, true);
const { text, ...missingText } = candidate;
record('missing candidate.text', { ...minimal, candidates: [missingText] }, false);
record('candidate.text null', { ...minimal, candidates: [{ ...candidate, text: null }] }, false);
record('unknown candidate target', { ...minimal, candidates: [{ ...candidate, target: 'maybe' }] }, false);
record('unexpected root key', { ...minimal, extra: true }, false);
record('nonempty matches on first map', { ...minimal, matches: [{}] }, false);
record('candidate parts exceeds bound', { ...minimal, candidates: [{ ...candidate, parts: ['new:a', 'new:b', 'new:c'] }] }, false);
record('string body unmodified including emoji and whitespace', { ...minimal, summary: '  한국어 🧪\t\r\n  ' }, true);
// Demonstrate why a schema pass cannot replace the context-dependent validator.
const ask = JSON.parse(await fs.readFile(path.join(results, 'experience89-codex-sol-actual-order-r1-parsed.json'), 'utf8')).ask;
const domainCases = [];
for (const [name, wire] of [
  ['unknown candidate references', { ...minimal, candidates: [candidate] }],
  // This deliberately has a missing part too: it does not isolate the holds statement rule.
  // See the independent known-part baseline/holds-null probe for that rule.
  ['holds-null candidate also with unresolved part; reject rule not isolated', { ...minimal, candidates: [{ ...candidate, target: 'holds', parts: ['new:a'] }] }],
  ['UTF16 text bound remains in domain validator', { ...minimal, summary: '🧪'.repeat(101) }]
]) {
  assert.deepEqual(shapeErrors(wire), []); assert.throws(() => validateMapReply(wire, ask));
  domainCases.push({ name, shapeAccepted: true, existingValidatorRejected: true });
}
assert.throws(() => assertFirstMap6Ask({ ...ask, parts: [{}] }));
assert.throws(() => shapeErrors({}, { type: 'object', not: {} }), /UNSUPPORTED_OFFLINE_KEYWORD/);
const schemaText = JSON.stringify(schema, null, 2) + '\n';
await fs.writeFile(path.join(results, 'experience95-first-map6-output.schema.json'), schemaText, { flag: 'wx' });
const report = { task: 'AF95 offline complete first-map6 output shape', source, appTree: git('rev-parse', 'HEAD:app'),
  status: 'OFFLINE_SHAPE_COMPATIBLE_FOR_OBSERVED_CANONICAL_FIRST_MAPS; PROVIDER_ENFORCEMENT_UNVERIFIED',
  schemaSha256: hash(schemaText), schemaBytes: Buffer.byteLength(schemaText), schemaType: 'Existing first-map6 final wire, no changed product schema',
  evaluator: 'Custom restricted-keyword structural evaluator. Not a general JSON Schema validator and not provider execution.',
  archivedCases: cases, syntheticCases: synthetic, retainedDomainGuards: domainCases,
  interpretation: 'Only wire structure compatibility and missing-field rejection were evaluated. Model latency, semantics, decoder support and full product success are unproved.',
  execution: { newModelCalls: 0, network: 0, productWrites: 0, installs: 0, oldResponseRepairs: 0, browser: 0, originalPayloadsReusedOffline: 2 } };
await fs.writeFile(path.join(results, 'experience95-offline-result.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(report));
