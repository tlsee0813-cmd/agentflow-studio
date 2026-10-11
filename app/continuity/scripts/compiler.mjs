import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const pinned=fileURLToPath(new URL('../../node_modules/typescript/bin/tsc',import.meta.url));
export function compile(args,options={}) {
  return existsSync(pinned)?spawnSync(process.execPath,[pinned,...args],options):spawnSync('tsc',args,{...options,shell:process.platform==='win32'});
}
export const compilerSource=existsSync(pinned)?'app/node_modules (locked dependency)':'PATH compiler (offline bootstrap, not npm ci evidence)';
