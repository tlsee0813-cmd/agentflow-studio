// SQLite Durable Objects provide both the connector's small mailbox and an atomic spent-grant ledger. Existing Workers KV
// deployments may keep their data binding; their one-time OAuth exchanges still require this strongly consistent ledger.
export const OAUTH_CONSUME_BINDING = 'CONNECTOR_OAUTH';
export const OAUTH_CONSUME_CLASS = 'OAuthConsume';
export const OAUTH_CONSUME_MIGRATION = 'agentflow-connector-oauth-v1';
const TOMBSTONE_MS = 31 * 86400000; // longer than the longest grant's KV TTL (30 days), measured from consumption

export class OAuthConsume {
  constructor(ctx) { this.storage = ctx.storage; }
  async fetch(request) {
    if (request.method !== 'POST') return new Response(null, { status: 404 });
    const path = new URL(request.url).pathname;
    if (path === '/kv') return this.kv(await request.json());
    if (path !== '/consume') return new Response(null, { status: 404 });
    const consumed = await this.storage.transaction(async txn => {
      if (await txn.get('spent')) return false;
      await txn.put('spent', true);
      // This is a SQLite class: alarm operations on storage participate in the transaction as well.
      await this.storage.setAlarm(Date.now() + TOMBSTONE_MS);
      return true;
    });
    return reply({ consumed });
  }
  async kv(v) {
    const result = await this.storage.transaction(async txn => {
      const time = Date.now(), key = v.key;
      if (v.op === 'list') {
        const prefix = `i:${v.prefix}`, limit = Math.max(1, Math.min(1000, v.limit ?? 1000));
        if (v.cursor && !v.cursor.startsWith(prefix)) throw new Error('Invalid connector cursor');
        const rows = await txn.list({ prefix, ...(v.cursor ? { startAfter: v.cursor } : {}), limit: limit + 1 });
        const keys = []; let cursor = null;
        for (const [k, index] of rows) {
          if (keys.length === limit) return { keys, list_complete: false, cursor };
          cursor = k;
          if (index.expiresAt !== null && index.expiresAt <= time) { await txn.delete([k, `v:${k.slice(2)}`]); continue; }
          keys.push({ name: k.slice(2) });
        }
        return { keys, list_complete: rows.size < limit + 1, cursor };
      }
      if (typeof key !== 'string' || !key || key.length > 512) throw new Error('Invalid connector key');
      if (v.op === 'put') {
        if (typeof v.value !== 'string' || (v.ttl !== undefined && (!Number.isFinite(v.ttl) || v.ttl <= 0))) throw new Error('Invalid connector value');
        if (v.capacity) {
          if (!key.startsWith(v.capacity.prefix) || !Number.isSafeInteger(v.capacity.limit) || v.capacity.limit < 1 || v.capacity.limit > 500) throw new Error('Invalid mailbox capacity');
          const rows = await txn.list({ prefix: `i:${v.capacity.prefix}`, limit: v.capacity.limit + 1 }); let count = 0;
          for (const [k, index] of rows) {
            if (index.expiresAt !== null && index.expiresAt <= time) await txn.delete([k, `v:${k.slice(2)}`]);
            else if (k !== `i:${key}`) count++;
          }
          if (count >= v.capacity.limit) return false;
        }
        const expiresAt = v.ttl === undefined ? null : time + v.ttl * 1000;
        await txn.put({ [`v:${key}`]: v.value, [`i:${key}`]: { expiresAt } });
        if (expiresAt !== null) {
          const alarm = await this.storage.getAlarm();
          if (alarm === null || expiresAt < alarm) await this.storage.setAlarm(expiresAt);
        }
        return true;
      }
      if (v.op === 'delete') { await txn.delete([`v:${key}`, `i:${key}`]); return null; }
      if (v.op !== 'get') throw new Error('Invalid connector operation');
      const index = await txn.get(`i:${key}`);
      if (!index) return null;
      if (index.expiresAt !== null && index.expiresAt <= time) { await txn.delete([`v:${key}`, `i:${key}`]); return null; }
      return (await txn.get(`v:${key}`)) ?? null;
    });
    return reply(result);
  }
  async alarm() {
    if (await this.storage.get('spent')) { await this.storage.deleteAll(); return; }
    await this.storage.transaction(async txn => {
      // Each mailbox shard contains at most 500 inbox / 40 handover entries. Other shards hold a single key.
      const rows = await txn.list({ prefix: 'i:', limit: 1000 }); let next = null;
      for (const [key, { expiresAt }] of rows) {
        if (expiresAt === null) continue;
        if (expiresAt <= Date.now()) await txn.delete([key, `v:${key.slice(2)}`]);
        else next = next === null ? expiresAt : Math.min(next, expiresAt);
      }
      if (next !== null) await this.storage.setAlarm(next);
    });
  }
}

const reply = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });

/** The subset of Workers KV used by the connector. User inboxes/handovers are isolated shards; token/client keys each have
 * their own shard. Only index metadata is listed, keeping 500 large records out of an enumeration's memory footprint. */
export function durableConnectorKv(namespace) {
  if (!namespace) return null;
  const shard = key => /^(?:in|ho):[^:]+:/.exec(key)?.[0] ?? key;
  async function call(v) {
    const target = v.op === 'list' ? v.prefix : v.key;
    const stub = namespace.get(namespace.idFromName(`data:${shard(target)}`));
    const res = await stub.fetch(new Request('https://connector.internal/kv', { method: 'POST', body: JSON.stringify(v) }));
    if (!res.ok) throw new Error('Connector storage unavailable');
    return res.json();
  }
  return {
    async get(key, type) { const value = await call({ op: 'get', key }); return value === null || type !== 'json' ? value : JSON.parse(value); },
    put: (key, value, options) => call({ op: 'put', key, value, ...(options?.expirationTtl ? { ttl: options.expirationTtl } : {}) }),
    putIfBelow: (key, value, options, capacity) => call({ op: 'put', key, value, capacity, ...(options?.expirationTtl ? { ttl: options.expirationTtl } : {}) }),
    delete: key => call({ op: 'delete', key }),
    list: ({ prefix = '', cursor, limit } = {}) => {
      if (!/^(in|ho):[^:]+:$/.test(prefix)) throw new Error('Connector list requires a user mailbox prefix');
      return call({ op: 'list', prefix, cursor, limit });
    }
  };
}

export function assertConnectorStorage(mode, bindings = []) {
  if (!['durable', 'kv'].includes(mode)) throw new Error('CONNECTOR_STORAGE must be durable or kv.');
  if (mode === 'durable' && bindings.some(b => b.name === 'CONNECTOR_KV')) throw new Error('Existing connector uses KV; set CONNECTOR_STORAGE=kv to preserve its data.');
  if (mode === 'kv' && !bindings.some(b => b.name === 'CONNECTOR_KV') && bindings.some(b => b.name === OAUTH_CONSUME_BINDING)) throw new Error('Existing connector uses Durable Object storage; switching to KV requires an explicit data migration.');
}

export async function consumeOAuth(namespace, kind, hash) {
  if (!namespace || !['code', 'rt'].includes(kind) || !/^[\w-]{43}$/.test(hash)) throw new Error('OAuth consume binding required');
  const stub = namespace.get(namespace.idFromName(`${kind}:${hash}`));
  const res = await stub.fetch(new Request('https://oauth.internal/consume', { method: 'POST' }));
  if (!res.ok) throw new Error('OAuth consume unavailable');
  const result = await res.json();
  if (typeof result?.consumed !== 'boolean') throw new Error('OAuth consume invalid response');
  return result.consumed;
}

/** REST upload migration: first install creates the SQLite namespace, repeated updates verify the same tag with no new step.
 * An unknown migration must be reconciled explicitly instead of overwriting another deployment's migration history. */
export function oauthMigration(previousTag = null) {
  if (previousTag && previousTag !== OAUTH_CONSUME_MIGRATION) throw new Error('Unrecognized Durable Object migration tag; reconcile before deployment.');
  return previousTag === OAUTH_CONSUME_MIGRATION
    ? { old_tag: previousTag, new_tag: previousTag, steps: [] }
    : { old_tag: previousTag ?? '', new_tag: OAUTH_CONSUME_MIGRATION, steps: [{ new_sqlite_classes: [OAUTH_CONSUME_CLASS] }] };
}
