// Offline draft only. This is the complete FIRST map.6 wire shape, not a new wire,
// a validator replacement, or evidence that a provider enforces JSON Schema.
const string = { type: 'string' }, nullableString = { type: ['string', 'null'] };
const object = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const array = (items, maxItems, minItems) => ({ type: 'array', items, maxItems, ...(minItems === undefined ? {} : { minItems }) });
const kinds = { type: 'string', enum: ['want', 'idea', 'reported', 'checked', 'describes', 'open', 'differs'] };
const statement = object({ key: string, kind: kinds, text: string, at: string, about: nullableString });
const claim = object({ kind: kinds, text: string, at: string, about: nullableString, replaces: { type: 'null' }, key: string });
const part = object({ ref: string, name: string, parent: nullableString, role: nullableString, roleAbout: nullableString,
  roleReplaces: nullableString, basis: array(string, 4, 1), claims: array(claim, 4) });
const relation = object({ from: string, to: string, kind: { type: 'string', enum: ['flow', 'needs', 'shares', 'related'] }, note: string, at: string });
const candidate = object({ text: string, parts: array(string, 2), at: nullableString,
  target: { type: 'string', enum: ['attribution', 'identity', 'parent', 'holds'] }, statement: { anyOf: [statement, { type: 'null' }] } });
export const firstMap6OutputSchema = object({ summary: string, parts: array(part, 12), relations: array(relation, 12),
  candidates: array(candidate, 6), gaps: array(string, 2), matches: array(object({}), 0),
  material: array(object({ at: string, what: string }), 6) });

export function assertFirstMap6Ask(ask) {
  if (ask?.schemaVersion !== 'studio.map.6' || !Array.isArray(ask.parts) || ask.parts.length !== 0 ||
      !Array.isArray(ask.requests) || ask.requests.length !== 0 || !Array.isArray(ask.priors) || ask.priors.length !== 0) {
    throw Error('FIRST_MAP6_SCOPE_REQUIRED');
  }
}

// A deliberately small, offline structural evaluator for exactly the keywords
// in this draft. Unknown keywords fail loudly. It is not Ajv, a general JSON
// Schema implementation, or a simulation of the provider's constrained decoder.
const supported = new Set(['type', 'properties', 'required', 'additionalProperties', 'items', 'minItems', 'maxItems', 'enum', 'anyOf']);
export function shapeErrors(value, schema = firstMap6OutputSchema, path = '$') {
  for (const keyword of Object.keys(schema)) if (!supported.has(keyword)) throw Error(`UNSUPPORTED_OFFLINE_KEYWORD:${keyword}`);
  if (schema.anyOf) return schema.anyOf.some(s => shapeErrors(value, s, path).length === 0) ? [] : [`${path}:anyOf`];
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (!types.includes(type)) return [`${path}:type`];
  const errors = [];
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}:enum`);
  if (type === 'object') {
    for (const key of schema.required ?? []) if (!Object.hasOwn(value, key)) errors.push(`${path}.${key}:required`);
    for (const key of Object.keys(value)) {
      if (!Object.hasOwn(schema.properties ?? {}, key)) { if (schema.additionalProperties === false) errors.push(`${path}.${key}:additional`); }
      else errors.push(...shapeErrors(value[key], schema.properties[key], `${path}.${key}`));
    }
  }
  if (type === 'array') {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path}:minItems`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${path}:maxItems`);
    value.forEach((item, index) => errors.push(...shapeErrors(item, schema.items, `${path}[${index}]`)));
  }
  return errors;
}
