import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const pinned=fileURLToPath(new URL('../../node_modules/typescript/bin/tsc',import.meta.url));
export function compile(args,options={}) {
  // The pinned compiler runs without a shell: a path with spaces (a Windows desktop folder) stays one argument.
  return existsSync(pinned)?spawnSync(process.execPath,[pinned,...args],{...options,shell:false}):spawnSync('tsc',args,{...options,shell:process.platform==='win32'});
}
export const compilerSource=existsSync(pinned)?'app/node_modules (locked dependency)':'PATH compiler (offline bootstrap, not npm ci evidence)';
