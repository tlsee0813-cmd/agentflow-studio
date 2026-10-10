import { createApp } from './app.mjs';
import { readConfig } from './config.mjs';
const config = readConfig({ ...process.env, ...(process.argv.includes('--mock') ? {AI_MODE:'mock'} : {}) });
const server = createApp({config});
server.listen(config.port,config.host, () => {
  console.log(`AgentFlow Studio: http://127.0.0.1:${server.address().port} | ${config.mode === 'mock' ? 'MOCK — no AI calls' : 'DeepSeek server path — live call not verified'} | local only`);
});
server.on('error', () => { console.error('SERVER_START_FAILED'); process.exitCode = 1; });
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => server.close());
