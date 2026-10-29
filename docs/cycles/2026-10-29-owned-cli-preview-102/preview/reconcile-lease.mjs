// AF102 operator step: after checking yourself that the CLI child of an earlier run is gone (for example in Task Manager on Windows,
// where the executor cannot prove it), record that attestation so the next executor start may admit new jobs. It changes only the
// lease of the leaseId given, and only while no executor owns the state folder. It signals no process.
//   node docs/cycles/2026-10-29-owned-cli-preview-102/preview/reconcile-lease.mjs --state <dir> --lease <L_...> --attest-closed
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { own, fileIo } from '../../../../app/continuity/server/map-jobs.mjs';
import { LEASE_FORMAT } from './cli-executor.mjs';

const args = process.argv.slice(2), opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const state = opt('--state'), id = opt('--lease');
if (!state || !/^L_[0-9a-f-]{36}$/.test(id ?? '') || !args.includes('--attest-closed')) { console.error('Usage: --state <dir> --lease <L_...> --attest-closed'); process.exit(2); }
const sha = t => createHash('sha256').update(t).digest('hex');
const owner = await own(state);
if (owner.busy) { console.error('An executor owns this state folder now; stop it first.'); process.exit(1); }
try {
  let file; try { file = JSON.parse(await readFile(join(state, 'lease.json'), 'utf8')); } catch { console.error('No readable lease.'); process.exit(1); }
  if (file?.format !== LEASE_FORMAT || file.sha256 !== sha(JSON.stringify(file.lease)) || file.lease.leaseId !== id) { console.error('The lease there is not that one (or is damaged); nothing changed.'); process.exit(1); }
  const lease = { ...file.lease, attested: { closed: true, at: new Date().toISOString() } };
  await fileIo.writeAtomic(state, 'lease.json', JSON.stringify({ format: LEASE_FORMAT, lease, sha256: sha(JSON.stringify(lease)) }));
  console.log(`ATTESTED ${id}`);
} finally { await owner.release?.(); }
