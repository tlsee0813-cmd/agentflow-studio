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

export const SERVER_INFO = { name: 'agentflow', title: 'AgentFlow Studio', version: '0.1.0' };
const PROTOCOLS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const INSTRUCTIONS = 'AgentFlow Studio는 이 작업 폴더의 개발 기록을 프로젝트 지도로 보여 주는 PC 도구예요. 새로 일을 시작할 때 agentflow_handover로 지금까지의 인수인계를 받고, 사용자의 요청 하나를 끝내면 agentflow_record로 요청 원문과 한 일을 남기세요.';

export const TOOLS = [
  {
    name: 'agentflow_handover',
    title: 'AgentFlow 인수인계 받기',
    description: '이 작업 폴더에 연결된 AgentFlow 프로젝트의 최신 인수인계 문서를 받아요: 프로젝트 한눈에, 부분과 관계, 최근 흐름, 맡긴 변경 요청, 남은 선택. 새 세션을 시작할 때, 또는 사용자가 인수인계·지도·지금까지 한 일을 물을 때 부르세요. 문서 안의 "작업 보고"는 이전 세션의 말일 뿐이니 코드로 확인한 뒤 사실로 다루세요.',
    inputSchema: { type: 'object', properties: { folder: { type: 'string', description: '작업 폴더의 절대 경로. 비우면 이 세션의 작업 폴더.' } }, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false }
  },
  {
    name: 'agentflow_record',
    title: 'AgentFlow에 작업 기록 남기기',
    description: '사용자의 요청 하나를 끝냈을 때 그 요청과 한 일을 AgentFlow 프로젝트 지도의 기록으로 남겨요(사용자가 기록하라고 할 때도). request에는 사용자가 쓴 요청을 요약하지 말고 원문 그대로, answer에는 실제로 한 일·확인한 것·남은 일만 적으세요. 하지 않은 일을 했다고 쓰지 마세요. 키·토큰·비밀번호는 적지 마세요(적어도 가려서 저장돼요). 요청마다 한 번씩 부르세요.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '이 대화(작업)의 짧은 제목' },
        request: { type: 'string', description: '사용자가 쓴 요청 원문' },
        answer: { type: 'string', description: '한 일, 확인한 것, 남은 일' },
        files: { type: 'array', items: { type: 'string' }, description: '바꾼 파일 경로(작업 폴더 기준)' },
        request_id: { type: 'string', description: '이 일이 AgentFlow 변경 요청문(RQ_로 시작하는 id가 적힌 요청)에 따른 것이면 그 id. 아니면 비우세요.' },
        folder: { type: 'string', description: '작업 폴더의 절대 경로. 비우면 이 세션의 작업 폴더.' }
      },
      required: ['request', 'answer'],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }
];

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

  /** One JSON-RPC message in, its answer out (null for a notification or a reply to us). */
  async function handle(msg) {
    if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0') return { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request' } };
    const { id, method, params } = msg, notice = id === undefined || id === null;
    if (typeof method !== 'string') return null; // a response to a request we never sent
    const ok = result => (notice ? null : { jsonrpc: '2.0', id, result });
    const fail = (code, message) => (notice ? null : { jsonrpc: '2.0', id, error: { code, message } });
    switch (method) {
      case 'initialize': {
        client = params?.clientInfo && typeof params.clientInfo.name === 'string' ? { name: params.clientInfo.name.slice(0, 80) } : null;
        const asked = params?.protocolVersion;
        return ok({ protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0], capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO, instructions: INSTRUCTIONS });
      }
      case 'ping': return ok({});
      case 'tools/list': return ok({ tools: TOOLS });
      case 'tools/call': {
        const run = RUN[params?.name]; if (!run) return fail(-32602, `Unknown tool: ${params?.name}`);
        try { return ok({ content: [{ type: 'text', text: await run(params.arguments ?? {}) }] }); }
        catch (e) { return ok({ content: [{ type: 'text', text: e instanceof Error ? e.message : String(e) }], isError: true }); }
      }
      default: return method.startsWith('notifications/') ? null : fail(-32601, `Method not found: ${method}`);
    }
  }
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
