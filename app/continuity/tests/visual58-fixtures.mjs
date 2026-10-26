// Offline UI58 import fixtures. No reports, return anchors, network, or browser automation.
// Prerequisite: node app/continuity/scripts/build.mjs
// Usage: node app/continuity/tests/visual58-fixtures.mjs --out <absolute-new-directory>
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildExample } from '../dist/public/shared/studio-examples.js';
import { parseProject } from '../dist/public/shared/validation.js';
import { studioView } from '../dist/public/shared/studio.js';

const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Usage: visual58-fixtures.mjs --out <absolute-new-directory>');
assert.equal(args[0], '--out');
assert.ok(isAbsolute(args[1]), '--out must be an explicit absolute directory');
const out = resolve(args[1]);
const input = fileURLToPath(new URL('../../../docs/cycles/2026-10-26-visual-experience-58/OSS_CASES.json', import.meta.url));
const raw = await readFile(input, 'utf8'), data = JSON.parse(raw);
assert.equal(data.schemaVersion, 'agentflow.oss-review-cases.1');
const sha256 = text => createHash('sha256').update(text).digest('hex');
const safeId = id => { assert.match(id, /^[a-z0-9-]+$/); return id; };
const fixedDate = '2026-10-26T00:00:00.000Z';
const baseCases = new Map();

function validateSpec(spec) {
  safeId(spec.id);
  assert.deepEqual(spec.records, [], `${spec.id}: OSS UI fixtures must have no work records`);
  const keys = new Set(), depths = new Map();
  for (const part of spec.parts) {
    assert.ok(!keys.has(part.key), `duplicate part ${part.key}`);
    if (part.parent) assert.ok(keys.has(part.parent), `parent must precede child: ${part.key}`);
    keys.add(part.key); depths.set(part.key, part.parent ? depths.get(part.parent) + 1 : 0);
  }
  for (const [from, to] of spec.relations) assert.ok(keys.has(from) && keys.has(to), 'missing relation endpoint');
  return { parts: keys.size, maxDepth: keys.size ? Math.max(...depths.values()) + 1 : 0, relations: spec.relations.length };
}

function validateAttribution(c) {
  assert.match(c.commit, /^[a-f0-9]{40}$/);
  assert.equal(c.commitUrl, `https://github.com/${c.repository}/commit/${c.commit}`);
  const refs = new Set(c.sources.map(s => s.id));
  assert.equal(refs.size, c.sources.length, 'duplicate source id');
  for (const source of c.sources) {
    const url = new URL(source.url);
    assert.equal(url.hostname, 'github.com');
    assert.ok(url.pathname.startsWith(`/${c.repository}/blob/${c.commit}/`) || url.pathname.startsWith(`/${c.repository}/tree/${c.commit}/`), 'source must use pinned repository commit');
  }
  const checkRefs = p => {
    assert.ok(p && p.classification && p.refs.length, 'missing provenance');
    for (const ref of p.refs) assert.ok(refs.has(ref), `unknown source ref ${ref}`);
  };
  for (const part of c.spec.parts) checkRefs(c.provenance.parts[part.key]);
  assert.equal(c.provenance.relations.length, c.spec.relations.length);
  c.provenance.relations.forEach((p, index) => { assert.equal(p.index, index); checkRefs(p); });
}

function projectFor(spec) {
  const generated = buildExample(spec, Date.parse(fixedDate));
  assert.deepEqual(generated.sources, []);
  assert.deepEqual(generated.tasks, []);
  // Stable fixture IDs/timestamps only: no imported facts, labels, or relationships are changed.
  const ids = new Map([[generated.id, `P_visual58_${spec.id}`]]);
  generated.space.areas.forEach((area, i) => ids.set(area.id, `A_${spec.id}_${spec.parts[i].key}`));
  generated.space.relations.forEach((relation, i) => ids.set(relation.id, `L_${spec.id}_${i}`));
  function remap(value) {
    if (typeof value === 'string') return ids.get(value) ?? value;
    if (Array.isArray(value)) return value.map(remap);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [ids.get(k) ?? k, remap(v)]));
    return value;
  }
  const project = remap(generated);
  if (project.space.brief) project.space.brief.at = fixedDate;
  project.space.areas.forEach(area => { area.createdAt = fixedDate; });
  const validated = parseProject(JSON.stringify(project));
  const view = studioView(validated);
  assert.equal(view.parts.length, spec.parts.length);
  assert.equal(view.relations.length, spec.relations.length);
  assert.equal(view.records.length, 0);
  assert.ok(view.parts.every(p => p.status === 'plan' && p.summary === null));
  const keys = new Map(spec.parts.map((part, i) => [part.key, view.parts[i].id]));
  spec.parts.forEach((part, i) => {
    assert.equal(view.parts[i].name, part.name);
    assert.equal(view.parts[i].note, part.note.trim());
    assert.equal(view.parts[i].parentId, part.parent ? keys.get(part.parent) : null);
  });
  spec.relations.forEach(([from, to, kind, note], i) => assert.deepEqual(
    [view.relations[i].from, view.relations[i].to, view.relations[i].kind, view.relations[i].note],
    [keys.get(from), keys.get(to), kind, note.trim()]));
  return { project: validated, view };
}

const prepared = [];
function prepare(spec, attribution) {
  const counts = validateSpec(spec), { project, view } = projectFor(spec);
  const text = `${JSON.stringify(project, null, 2)}\n`;
  prepared.push({ file: `${spec.id}.json`, text, attribution: { id: spec.id, name: spec.name, ...counts, bytes: Buffer.byteLength(text), sha256: sha256(text), ...attribution,
    keys: Object.fromEntries(spec.parts.map((part, i) => [part.key, view.parts[i].id])) } });
}

for (const c of data.cases) {
  assert.equal(c.id, c.spec.id); validateAttribution(c);
  const counts = validateSpec(c.spec);
  assert.deepEqual([counts.parts, counts.maxDepth, counts.relations], [c.checks.partCount, c.checks.maxDepth, c.checks.relationCount]);
  assert.ok(!baseCases.has(c.id)); baseCases.set(c.id, c);
  prepare(c.spec, { classification: 'source-grounded-review-map', repository: c.repository, commit: c.commit, commitUrl: c.commitUrl, sources: c.sources, provenance: c.provenance });
}
for (const derived of data.derivedStress) {
  const base = baseCases.get(derived.base); assert.ok(base, 'unknown derived base');
  const spec = structuredClone(base.spec); spec.id = safeId(derived.id);
  spec.name = `[UI58 stress] ${derived.id}`;
  spec.brief = `${derived.classification}: ${derived.purpose}`;
  if (derived.keepKeys) {
    const keep = new Set(derived.keepKeys);
    spec.parts = spec.parts.filter(p => keep.has(p.key));
    spec.relations = spec.relations.filter(([a, b]) => keep.has(a) && keep.has(b));
  }
  if (derived.renameRule) for (const p of spec.parts) if (derived.renameRule.keys.includes(p.key)) p.name = derived.renameRule.template.replace('{originalName}', p.name);
  if (derived.appendParts) spec.parts.push(...derived.appendParts);
  prepare(spec, { classification: derived.classification, base: base.id, repository: base.repository, commit: base.commit, commitUrl: base.commitUrl, recipe: derived });
}

// Preflight everything before making a new output directory; existing directories are never overwritten.
await mkdir(out);
for (const file of prepared) await writeFile(join(out, file.file), file.text, { flag: 'wx' });
const manifest = { schemaVersion: 'agentflow.visual58-fixtures.1', input, inputSha256: sha256(raw), fixtureDate: fixedDate,
  limitations: 'Review maps/subsets are not official architecture or executed OSS results. Zero records, reports, handoffs, anchors, or AI calls. IDs/timestamps are stable fixture metadata. UI checks have not been run by this script.',
  files: prepared.map(f => ({ file: f.file, ...f.attribution })), reviewMatrix: data.reviewMatrix };
await writeFile(join(out, 'ATTRIBUTION.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ out, attribution: join(out, 'ATTRIBUTION.json'), files: prepared.map(f => ({ file: f.file, parts: f.attribution.parts, relations: f.attribution.relations, sha256: f.attribution.sha256 })) }, null, 2));
