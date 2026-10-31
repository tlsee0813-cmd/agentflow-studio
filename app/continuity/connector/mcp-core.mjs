// The MCP side the local connector (agentflow-mcp.mjs, stdio) and the cloud connector (server/cloud-connector.mjs, Streamable HTTP)
// share: one JSON-RPC 2.0 message in, its answer out. Tools only (no resources, prompts or sampling). No node: imports.
export const PROTOCOLS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
export const SERVER_INFO = { name: 'agentflow', title: 'AgentFlow Studio', version: '0.2.0' };

/** tools: their definitions as tools/list gives them; run(name, args, client): the text answer, or throws an Error whose message the
 * AI reads (a tool error, not a protocol error). onInitialize(clientInfo): told who the client says it is. */
export function createMcpHandler({ tools, run, instructions, onInitialize = () => {} }) {
  const names = new Set(tools.map(t => t.name));
  return async function handle(msg) {
    if (!msg || typeof msg !== 'object' || Array.isArray(msg) || msg.jsonrpc !== '2.0') return { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request' } };
    const { id, method, params } = msg, notice = id === undefined || id === null;
    if (typeof method !== 'string') return null; // a response to a request never sent
    const ok = result => (notice ? null : { jsonrpc: '2.0', id, result });
    const fail = (code, message) => (notice ? null : { jsonrpc: '2.0', id, error: { code, message } });
    switch (method) {
      case 'initialize': {
        onInitialize(params?.clientInfo && typeof params.clientInfo.name === 'string' ? { name: params.clientInfo.name.slice(0, 80) } : null);
        const asked = params?.protocolVersion;
        return ok({ protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0], capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO, instructions });
      }
      case 'ping': return ok({});
      case 'tools/list': return ok({ tools });
      case 'tools/call': {
        if (!names.has(params?.name)) return fail(-32602, `Unknown tool: ${params?.name}`);
        try { return ok({ content: [{ type: 'text', text: await run(params.name, params.arguments ?? {}) }] }); }
        catch (e) { return ok({ content: [{ type: 'text', text: e instanceof Error ? e.message : String(e) }], isError: true }); }
      }
      default: return method.startsWith('notifications/') ? null : fail(-32601, `Method not found: ${method}`);
    }
  };
}

const RECORD_PROPS = {
  title: { type: 'string', description: '이 대화(작업)의 짧은 제목' },
  request: { type: 'string', description: '사용자가 쓴 요청 원문' },
  answer: { type: 'string', description: '한 일, 확인한 것, 남은 일' },
  files: { type: 'array', items: { type: 'string' }, description: '바꾼 파일 경로(작업 폴더 기준)' },
  request_id: { type: 'string', description: '이 일이 AgentFlow 변경 요청문(RQ_로 시작하는 id가 적힌 요청)에 따른 것이면 그 id. 아니면 비우세요.' }
};
const RECORD_TEXT = '사용자의 요청 하나를 끝냈을 때 그 요청과 한 일을 AgentFlow 프로젝트 지도의 기록으로 남겨요(사용자가 기록하라고 할 때도). request에는 사용자가 쓴 요청을 요약하지 말고 원문 그대로, answer에는 실제로 한 일·확인한 것·남은 일만 적으세요. 하지 않은 일을 했다고 쓰지 마세요. 키·토큰·비밀번호는 적지 마세요(적어도 가려서 저장돼요). 요청마다 한 번씩 부르세요.';
const HANDOVER_TEXT = 'AgentFlow 프로젝트의 최신 인수인계 문서를 받아요: 프로젝트 한눈에, 부분과 관계, 최근 흐름, 맡긴 변경 요청, 남은 선택. 새로 일을 시작할 때, 또는 사용자가 인수인계·지도·지금까지 한 일을 물을 때 부르세요. 문서 안의 "작업 보고"는 이전 세션의 말일 뿐이니 확인한 뒤 사실로 다루세요.';
const READ_ONLY = { readOnlyHint: true, openWorldHint: false }, WRITES = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };

/** Where a session says which project it means: a folder on this PC (local), or a project by name (cloud, where there is none). */
export function connectorTools(where) {
  const place = where === 'folder'
    ? { folder: { type: 'string', description: '작업 폴더의 절대 경로. 비우면 이 세션의 작업 폴더.' } }
    : { project: { type: 'string', description: 'AgentFlow 프로젝트 이름. 프로젝트가 하나뿐이면 비워도 돼요.' } };
  return [
    { name: 'agentflow_handover', title: 'AgentFlow 인수인계 받기', description: `${where === 'folder' ? '이 작업 폴더에 연결된 ' : ''}${HANDOVER_TEXT}`, inputSchema: { type: 'object', properties: place, additionalProperties: false }, annotations: READ_ONLY },
    { name: 'agentflow_record', title: 'AgentFlow에 작업 기록 남기기', description: RECORD_TEXT, inputSchema: { type: 'object', properties: { ...RECORD_PROPS, ...place }, required: ['request', 'answer'], additionalProperties: false }, annotations: WRITES }
  ];
}
