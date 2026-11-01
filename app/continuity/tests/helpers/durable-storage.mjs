import { OAuthConsume } from '../../server/oauth-consume.mjs';

// An isolated, serializable storage double. Each transaction commits its data and alarm together, or rolls both back.
export function memoryDurableNamespace() {
  const objects = new Map();
  return {
    objects,
    idFromName: name => name,
    get(name) {
      if (!objects.has(name)) {
        let values = new Map(), alarm = null, queue = Promise.resolve();
        const storage = {
          get: async key => structuredClone(values.get(key)),
          put: async (key, value) => { for (const [k, v] of typeof key === 'string' ? [[key, value]] : Object.entries(key)) values.set(k, structuredClone(v)); },
          delete: async key => { for (const k of Array.isArray(key) ? key : [key]) values.delete(k); },
          list: async ({ prefix = '', startAfter = '', limit = Infinity } = {}) => new Map([...values].filter(([key]) => key.startsWith(prefix) && key > startAfter).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).slice(0, limit)),
          deleteAll: async () => { values.clear(); alarm = null; },
          getAlarm: async () => alarm,
          setAlarm: async time => { alarm = time; },
          transaction(change) {
            const run = queue.catch(() => {}).then(async () => {
              const before = structuredClone(values), oldAlarm = alarm;
              try { return await change(storage); } catch (e) { values = before; alarm = oldAlarm; throw e; }
            });
            queue = run; return run;
          }
        };
        const object = new OAuthConsume({ storage });
        objects.set(name, { object, storage, fetch: request => object.fetch(request) });
      }
      return objects.get(name);
    }
  };
}
