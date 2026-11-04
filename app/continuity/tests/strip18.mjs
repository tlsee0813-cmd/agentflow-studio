// map-reading.18 (pipeline .43): a stored entry in the exact shape of .17, the keys .18 adds removed (record-reading.ts fields), for the
// tests that read an earlier version's entry made from a current reading. Recipe .45: the keys map-reading.19 adds go too (stripNineteen).
export function stripNineteen(r) {
  for (const k of ['level', 'pages', 'obligations', 'pageEnds', 'checks', 'defaults', 'firstLines']) delete r[k];
  for (const a of r.artifacts ?? []) delete a.sharedBy;
  for (const s of r.projectStatus ?? []) delete s.scopeKind;
  for (const p of r.parts ?? []) {
    for (const k of ['family', 'familyRole', 'familyReason', 'familyQuote', 'familyUnclear', 'added', 'states', 'cites']) delete p[k];
    for (const s of p.statusClaims ?? []) delete s.scopeKind;
    for (const l of p.loops ?? []) for (const k of ['bodyState', 'bodyText', 'cites']) delete l[k];
    for (const s of p.steps ?? []) delete s.cites;
    for (const c of p.claims ?? []) { delete c.cites; delete c.foundBy; }
  }
  for (const x of r.relations ?? []) { delete x.claimNature; delete x.cites; }
  return r;
}
export function stripEighteen(r) {
  stripNineteen(r);
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
