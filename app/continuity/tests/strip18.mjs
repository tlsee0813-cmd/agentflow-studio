// map-reading.18 (pipeline .43): a stored entry in the exact shape of .17, the keys .18 adds removed (record-reading.ts fields), for the
// tests that read an earlier version's entry made from a current reading.
export function stripEighteen(r) {
  for (const k of ['basisScope', 'focus', 'projectStatus', 'gatesNone', 'coverage', 'artifacts', 'profileTables', 'recordExtras', 'recordDiagnostics']) delete r[k];
  for (const p of r.parts ?? []) {
    for (const k of ['recordRef', 'implementation', 'implementationQuote', 'members', 'groupAxis', 'groupAxisQuote', 'statusClaims', 'loops', 'variants', 'entries', 'contracts']) delete p[k];
    for (const s of p.steps ?? []) for (const k of ['recordRef', 'loopIds', 'alt', 'branch', 'model']) delete s[k];
    for (const c of p.conditions ?? []) delete c.phase;
    for (const f of p.fileRoles ?? []) delete f.runtime;
    for (const c of p.claims ?? []) for (const k of ['decidedBy', 'actors', 'mergedWhen', 'contractChange', 'shippedIn', 'withdrawalMethod']) delete c[k];
  }
  for (const x of r.relations ?? []) for (const k of ['when', 'optional', 'variantRef', 'crosses', 'cadenceKind', 'payloadRef', 'via', 'member']) delete x[k];
  return r;
}
