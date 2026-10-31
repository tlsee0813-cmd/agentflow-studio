#!/usr/bin/env node
// AgentFlow connector: an MCP server (stdio) that an AI session on this PC runs beside it, so the session itself can
//   - leave a record of a request and what it did in the AgentFlow project bound to its working folder (agentflow_record), and
//   - take that project's latest handover document without anyone copying it (agentflow_handover).
// It talks only to the AgentFlow Studio running on this PC (AGENTFLOW_URL, default http://127.0.0.1:4317) and keeps nothing itself.
// No packages: Node 22's own modules only. Messages are JSON-RPC 2.0, one per line on stdin/stdout, as MCP's stdio transport has them;
// anything for people goes to stderr.
//
//   claude mcp add agentflow -- node <repo>/app/continuity/connector/agentflow-mcp.mjs
//   (Codex: [mcp_servers.agentflow] command = "node", args = ["<repo>/app/continuity/connector/agentflow-mcp.mjs"] in ~/.codex/config.toml)
//
// Settings (environment): AGENTFLOW_URL (the Studio's address), AGENTFLOW_FOLDER (the working folder, else the folder the client
// started this in), AGENTFLOW_ACCESS_CODE (only when the Studio was started with STUDIO_ACCESS_CODE).
import { createInterface } from 'node:readline';
import { execFile } from 'node:child_process';
import { resolve } from 'node:path';

import { createMcpHandler, connectorTools, SERVER_INFO } from './mcp-core.mjs';

export { SERVER_INFO };
const INSTRUCTIONS = 'AgentFlow Studio는 이 작업 폴더의 개발 기록을 프로젝트 지도로 보여 주는 PC 도구예요. 새로 일을 시작할 때 agentflow_handover로 지금까지의 인수인계를 받고, 사용자의 요청 하나를 끝내면 agentflow_record로 요청 원문과 한 일을 남기세요.';
export const TOOLS = connectorTools('folder');

/** The branch checked out in a folder, or null (not a repository, no git). */
function branchOf(folder) {
  return new Promise(done => execFile('git', ['-C', folder, 'rev-parse', '--abbrev-ref', 'HEAD'], { timeout: 3000, windowsHide: true }, (e, out) => {
    const b = !e && String(out).trim(); done(b && b !== 'HEAD' && /^\S{1,200}$/.test(b) ? b : null);
  }));
}

export function createConnector({ env = process.env, cwd = process.cwd(), fetchImpl = globalThis.fetch, branch = branchOf } = {}) {
  const base = (env.AGENTFLOW_URL || 'http://127.0.0.1:4317').replace(/\/+$/, '');
  const home = resolve(env.AGENTFLOW_FOLDER || cwd);
  let client = null;
  const headers = json => ({ 'X-AgentFlow-Request': '1', ...(json ? { 'Content-Type': 'application/json' } : {}), ...(env.AGENTFLOW_ACCESS_CODE ? { 'X-Studio-Access': env.AGENTFLOW_ACCESS_CODE } : {}) });
  const unreachable = `AgentFlow Studio(${base})에 연결하지 못했어요. 이 PC에서 Studio를 켜 둔 뒤 다시 부르세요.`;
  const FAIL = {
    NOT_FOUND: 'Studio가 커넥터를 받지 않아요. Studio를 최신 코드로 다시 켜 주세요(STUDIO_CONNECTOR=off이면 꺼져 있어요).',
    ACCESS_CODE_REQUIRED: 'Studio에 접속 코드가 걸려 있어요. 커넥터 설정에 AGENTFLOW_ACCESS_CODE를 넣어 주세요.',
    INPUT_TOO_LARGE: '기록이 너무 길어요. 답변을 줄여서 다시 남기세요.',
    INVALID_INPUT: 'Studio가 이 기록을 받지 않았어요(빈 요청·답변이거나 작업 폴더가 절대 경로가 아님).'
  };
  async function call(path, init) {
    let res; try { res = await fetchImpl(`${base}${path}`, init); } catch { throw new Error(unreachable); }
    let data = null; try { data = await res.json(); } catch { /* below */ }
    if (!res.ok) { const code = data?.error?.code; throw new Error(FAIL[code] ?? `Studio가 요청을 받지 않았어요(${code ?? res.status}).`); }
    return data;
  }
  const folderArg = v => (typeof v === 'string' && v.trim() ? resolve(v.trim()) : home);

  async function handover(args) {
    const folder = folderArg(args?.folder);
    const d = await call(`/api/studio/connector/handover?folder=${encodeURIComponent(folder)}`, { headers: headers(false) });
    if (!d?.text) return `${folder}에 연결된 AgentFlow 프로젝트의 인수인계가 아직 없어요. Studio에서 이 폴더를 프로젝트에 자동 연결하고, 그 프로젝트를 한 번 열어 두면 생겨요.`;
    return `(AgentFlow Studio가 ${d.at}에 남긴 「${d.name}」의 인수인계예요. Studio에서 그 프로젝트가 열려 있는 동안 갱신돼요.)\n\n${d.text}`;
  }
  async function record(args) {
    const folder = folderArg(args?.folder);
    const body = { client: client?.name ?? null, folder, branch: await branch(folder), title: args?.title ?? null, request: args?.request, answer: args?.answer, request_id: typeof args?.request_id === 'string' ? args.request_id : null, files: Array.isArray(args?.files) ? args.files : [] };
    const d = await call('/api/studio/connector/records', { method: 'POST', headers: headers(true), body: JSON.stringify(body) });
    return `AgentFlow에 기록을 남겼어요(${folder}${d.redacted ? `, 비밀값처럼 보이는 곳 ${d.redacted}개는 가렸어요` : ''}). 이 폴더에 연결된 프로젝트가 Studio에서 열려 있으면 1분 안에 기록으로 들어가요.`;
  }
  const RUN = { agentflow_handover: handover, agentflow_record: record };
  const handle = createMcpHandler({ tools: TOOLS, instructions: INSTRUCTIONS, run: (name, args) => RUN[name](args), onInitialize: info => { client = info; } });
  return { handle, folder: home, base };
}

/** Runs on stdin/stdout until stdin closes. Replies go out in the order the requests came. */
export function serve({ input = process.stdin, output = process.stdout, ...opts } = {}) {
  const c = createConnector(opts);
  let chain = Promise.resolve();
  const lines = createInterface({ input, crlfDelay: Infinity });
  lines.on('line', line => {
    if (!line.trim()) return;
    chain = chain.then(async () => {
      let msg; try { msg = JSON.parse(line); } catch { output.write(`${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })}\n`); return; }
      const out = Array.isArray(msg) ? (await Promise.all(msg.map(c.handle))).filter(Boolean) : await c.handle(msg);
      if (out && (!Array.isArray(out) || out.length)) output.write(`${JSON.stringify(out)}\n`);
    });
  });
  return { connector: c, closed: new Promise(done => lines.once('close', () => chain.then(done))) };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('agentflow-mcp.mjs')) {
  const { connector } = serve();
  process.stderr.write(`AgentFlow connector: Studio ${connector.base}, working folder ${connector.folder}\n`);
}
