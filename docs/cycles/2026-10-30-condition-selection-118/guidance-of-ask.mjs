// AF118: prints the condition-length guidance rows of one saved later studio.map.7 ask (e.g. the frozen real 117 ask, which is not
// in the repository) for the named starts, with the rendered block and prompt sizes. Reads the ask only; sends nothing.
//   node docs/cycles/2026-10-30-condition-selection-118/guidance-of-ask.mjs <ask.json> [N02.33 N01.03 ...]
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validateMapAsk } from '../../../app/continuity/dist/public/shared/map-reading.js';
import { conditionGuidance } from '../../../app/continuity/dist/public/shared/condition-guidance.js';
import { map7Guidance, map7Prompt } from '../../../app/continuity/server/map-prompt.mjs';
const [file, ...starts] = process.argv.slice(2);
const raw = readFileSync(file, 'utf8'), ask = validateMapAsk(JSON.parse(raw)), rows = conditionGuidance(ask), bytes = t => Buffer.byteLength(t, 'utf8');
console.log(JSON.stringify({ askSha256: createHash('sha256').update(raw).digest('hex'), rows: rows.length, blockBytes: bytes(map7Guidance(ask)), promptBytes: bytes(map7Prompt(ask)),
  promptSha256: createHash('sha256').update(map7Prompt(ask)).digest('hex'), named: starts.map(s => rows.find(r => r[0] === s) ?? [s, 'not sent']) }, null, 1));
