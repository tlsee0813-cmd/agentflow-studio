// TEST ONLY: load the actual CLI with temporary path bindings, not historical live paths.
// Its authorization, review, ledger, stage and dispatch logic remains unchanged.
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { code } from './init009-helpers.mjs';

export async function isolatedInit009Cli() {
  const directory=mkdtempSync(join(tmpdir(),'afs-I9.02-SYNTHETIC-'));
  const root=join(directory,'synthetic-live'),control=join(directory,'synthetic-control');
  mkdirSync(control);
  const policyUrl=new URL('../scripts/init009/policy.mjs',import.meta.url).href;
  const policyFile=join(directory,'test-policy.mjs');
  writeFileSync(policyFile,`export * from ${JSON.stringify(policyUrl)};
export const LIVE_DIR=${JSON.stringify(root)},CONTROL_DIR=${JSON.stringify(control)};
export const MOCK_DIR=${JSON.stringify(join(directory,'synthetic-mock'))},MOCK_CONTROL=${JSON.stringify(join(directory,'synthetic-mock-control'))};
export const codeIdentity=()=>(${JSON.stringify(code)});
`);
  const httpFile=join(directory,'forbidden-transport.mjs');
  writeFileSync(httpFile,`export const openLiveHttp=()=>{throw Error('I9.02 TRANSPORT MUST NOT OPEN');};
export const openMockHttp=openLiveHttp;
`);
  const cliUrl=new URL('../scripts/init009/cli.mjs',import.meta.url);
  const imports=[];
  const cli=readFileSync(cliUrl,'utf8').replace(/from '(\.\/[^']+)'/g,(_match,specifier)=>{
    imports.push(specifier);
    const target=specifier==='./policy.mjs'?pathToFileURL(policyFile).href:
      specifier==='./http.mjs'?pathToFileURL(httpFile).href:new URL(specifier,cliUrl).href;
    return `from ${JSON.stringify(target)}`;
  });
  assert.deepEqual(imports,['./policy.mjs','./ledger.mjs','./engine.mjs','./gates.mjs','./http.mjs','./report.mjs']);
  const cliFile=join(directory,'actual-cli-with-test-bindings.mjs');writeFileSync(cliFile,cli);
  const {operate}=await import(pathToFileURL(cliFile).href);
  return {operate,root,control,directory};
}
