/* studio.map.1: reading records into the map. The browser sends the map as it is (parts by alias, the person's own words, what
 * earlier readings understood) and the records not yet read; the model answers with parts, claims and relations, each resting on
 * an exact quote of what was sent. applyReading is the only write: it adds parts and relations and keeps one MapReading with the
 * derived understanding. It never renames, moves, archives or re-describes an existing part, never writes Area.note and never
 * touches space.understanding (return.2 and its anchors). What is unclear stays a candidate; nothing asks for approval per part. */
import { CLAIM_KINDS, CLAIM_TOPICS, EVIDENCE_GRADES, PART_STATES, PART_TYPES, CHANNELS, RELATION_MODES, READINGS_LIMIT, READING_EXCLUSION_RULES, isMapReading, isScenarioReading, type PastedRecord, type RecordEvidence, type CandidateTarget, type ClaimKind, type ClaimTopic, type EvidenceGrade, type PartState, type PartType, type Channel, type RelationMode, type MapReading, type Project, type ReadingCandidate, type ReadingClaim, type ReadingPart, type ReadingQuote, type ReadingRelation, type ReadingSkip, type ReadingExclusion, type RelationKind, type ReadingStep, type ReadingLoop, type ReadingStateVar, type ReadingPortMap, type ReadingCondition, type ReadingFileRole, RULE_SCOPES, ANCHOR_KINDS, ENFORCER_KINDS, WITHDRAWAL_KINDS, GATE_KINDS, type RuleScope, type AnchorKind, type EnforcerKind, type WithdrawalKind, type GateKind } from './types.js';
import { indexSpans, encodeSpans, decodeSpans, resolveRef, resolveRange, resolveEvidenceRange, textDigest, ANCHOR_QUOTE_MAX, SPANS_PER_RECORD, type Span, type SpanWire } from './evidence-span.js';
import type { StudioView, RecordView } from './studio.js';
import { addArea, addChildArea, addRelation, addReading } from './domain.js';
import { parseProject, sourceText } from './validation.js';
import { quoteAt } from './digest-api.js';
import { secretLike } from './secret.js';
import { recordKind, recordLabel, mapBasis, mapNoteHead } from './record-source.js';
import { validateFrozenRequest, validateRequestContext, requestContext, validateRequestMatch, requestMatches, hasTarget, sameTarget, canReplace, MATCH_STANCES, recordTexts, readInterval, type RequestContext, type FrozenRequest, type RequestMatch, type RequestMatch3, type StoredRequestMatch, type MatchKind, type MatchStance, type RequestTarget } from './request-return.js';

export const MAP_SCHEMA = 'studio.map.1' as const;
export const MAP2_SCHEMA = 'studio.map.2' as const;
/** studio.map.2 with a stance on each match and the explicit withdrawal of an earlier one (priors). map.2 stays readable. */
export const MAP3_SCHEMA = 'studio.map.3' as const;
/** studio.map.4: the same reading with its evidence named, never copied. Each record goes once as span.2 pieces (lead + spans,
 * which join back to the excerpt exactly); the reply cites a piece ('N01.07') or two adjacent ones ('N01.07-08') and says which
 * ranges it read as material inside the record (an example, a sample under test), which nothing of the map may rest on alone.
 * Every quote then keeps where it stands ([from, to) of the record) through the reply, the one write, storage and the mark. */
export const MAP4_SCHEMA = 'studio.map.4' as const;
/** studio.map.5: the same span.2 wire, with exact contiguous evidence ranges of at most 600 UTF-16 units, across any number
 * of pieces or paragraphs. map.1–4 retain their own contracts. Stored quotes still use map-reading.4 (exact slice and digest). */
export const MAP5_SCHEMA = 'studio.map.5' as const;
/** studio.map.6: the map.5 wire, with what each candidate leaves undecided stated (CandidateTarget) and a reply-local key
 * ('s1'…) on claims and on a candidate's undecided statement. A statement both settled (a claim) and undecided (a candidate),
 * the same target twice, a new part placed under the very parent its candidate leaves undecided, a wrong reference, or map
 * evidence inside the reply's own material refuse the whole reply before anything is applied (MapReplyError names the path).
 * A candidate never removes a claim: map.6 is applied without the overlap rule of map.1–5. Stored as map-reading.6 (now .7), including
 * durable diagnostics when an overlong citation is excluded. Earlier map-reading.4/.5 remain readable as stored. */
export const MAP6_SCHEMA = 'studio.map.6' as const;
/** studio.map.7: map.6 for later readings only (parts, requests or priors sent; never a first map). Each condition the reply names
 * (roleAboutAt, claim and statement aboutAt, match aboutAt) is a sent anchor or null, never words of its own: the server resolves
 * it to the record's exact passage (outer white space trimmed, 80 or 200 UTF-16 units) and keeps the stored about string|null of
 * map.6. A role's condition comes from a record of its basis; every other from the record of its own at. A condition outside
 * those, over its bound, blank, inside the reply's material or written in the old about form refuses the whole reply. What a
 * person declared of a provided source (record.evidence) is shown beside the record and is never a condition. Stored as
 * map-reading.6 (now .7, below), with durable diagnostics for excluded items. */
export const MAP7_SCHEMA = 'studio.map.7' as const;
/* map-reading.7 (pipeline .25): a map.6 or map.7 reply may add, each optional (absent or null: not said), to a claim its topic
 * (CLAIM_TOPICS), the author's evidence tag (EVIDENCE_GRADES), when (40) and where (120) as the record writes them, and, for a
 * withdrawn topic only, the decision as it stood before (120); to a part the record's own state word (PART_STATES) with the span
 * that says it (stateAt, an evidence reference like a claim's at) and when (stateWhen, 40), and its files (up to six of 120,
 * each once in the order given); to a relation what is handed over (payload, 80), how often or when (cadence, 40) and whether it
 * is designed or observed (RELATION_MODES). A wrong value is never changed into a right one: in the lenient readings (map.7, the
 * divided map.6) the claim or relation is set aside, and for a part only the state (with its stateAt and stateWhen) or the files
 * are left out, never the part; plain map.6 refuses. Every reply read under map.6 or map.7 is stored as map-reading.7, each of
 * these keys present (null, or [] for files, when not said).
 * map-reading.8 (pipeline .28): the same reply may add to a part the record's own type word (PART_TYPES) with the span that says it
 * (typeAt), what it receives (inputs, up to six of 60) and hands over (outputs, six of 60), the fields of its rows (fields, twelve
 * of 40) and its settings (config, four of 80), each as written; to a relation what the line carries (channel, CHANNELS); and to
 * the reply the records' own basis time (basisAt, 60) and the target version they explicitly describe (basisVersion, 60). The
 * same lenient rule: a wrong part field is left out alone, a wrong relation sets the relation aside, a wrong reply field is left
 * null; plain map.6 refuses. Stored as map-reading.8, every key present.
 * Pipeline .29 (no storage change): map.6 takes 24 new parts; a config item that is a version is wrong (the list is left out); the
 * divided first map (setAside) also sets aside a data relation naming a file whose store part is not one of its ends (via-store),
 * a claim quoting another part's table row (wrong-part) and a relation whose sender the quoted line does not name, or an unbuilt
 * or retired sender outside design (sender).
 * map-reading.9 (pipeline .30, the map design spec's second cycle): the same reply may add to a part its steps (up to twelve: a
 * name of 40, what it does in 120 or null, up to four used names of 60, and at, the one row of the record's table of inner steps
 * that names it), its loop (the unit it repeats, what stops it and what resumes it, each 60 or null, with at) and the state it
 * keeps (stateVars, up to eight: a name of 40, a scope of 40 or null, up to four readers and changers of 40); and to the reply
 * portMap (up to twelve rows: a relation's index among the reply's relations, a port that is an input or output name of the part
 * at that end, a step of that part, in or out, and at). A wrong step, state or row is set aside alone (step, state-var, port-map);
 * a wrong loop item leaves that item null, a loop whose at does not resolve is left out (loop); a wrong list is left out whole.
 * Steps are never related to one another in this cycle (order, branches and loops inside a part come later). Parts take eight
 * inputs, eight outputs, 24 fields and eight settings; map.6 takes 48 relations. Stored as map-reading.9, every key present.
 * The divided first map also sets aside a status claim that only restates its part's state row while the records hold a change,
 * defect or withdrawal row of that part (restate), and a store whose reader's own row quotes it may send to that reader.
 * Pipeline .31 (still map-reading.9; storage only widens): map.6 takes 36 new parts; a field item may run to 60; one list item (or
 * one used name of a step) that is too long, empty or control-charactered is set aside alone at its own index; a timer's loop
 * whose unit is a clock time is left out (loop) and a loop unit repeating one of the part's settings verbatim is left null.
 * Pipeline .32 (still map-reading.9; storage only widens): map.6 takes sixteen claims per part (MAP6_CLAIMS; map.7 keeps four).
 * The divided first map's via-store asks a store end only for a file the records' artifact table (「산출물」) gives a row, or one a
 * store part of the reading holds, when a record draws such a table (a payload file no row lists, the calendar.json of 「fee_policy·
 * calendar.json」, stays one line's payload); a new part made of a payload token with no table row, no type and no line is set aside
 * whole by the server (payload-part, explained here).
 * map-reading.10 (pipeline .33, the map design spec's fourth cycle, §5 and §8.3): the same reply may add to a rule claim (topic rule)
 * its scope (RULE_SCOPES; scopeName, 40, the step, port or field it names, null for part and project), the places it applies
 * (anchors, up to four: stated or inferred, the place as written in 80 and at, the line that places it) and what keeps it
 * (enforcedBy, up to four: code, gate, person, none = 기록상 미설계 or unknown = 장치 미상, as written in 80, with at, the line naming
 * it, null only for unknown); to a withdrawal (topic withdrawn) its withdrawalKind (design, implementation, report); to a plan claim
 * its gate (run or dev). Each is the claim's own and left out alone, the claim stays: a wrong scope leaves scope and scopeName null
 * (scope), an anchor or a device that breaks a rule (its at resolving to nothing included) is set aside at its own index (anchor,
 * enforced-by), a list that is not one, runs past four or stands on a claim of another topic is left out whole, a none or unknown
 * beside a device (or an unknown beside a none) is set aside, a wrong withdrawalKind or gate is left null (withdrawal-kind, gate);
 * plain map.6 refuses. Stored as map-reading.10, every claim with all six keys (null, or [], when not said).
 * Pipeline .33 also: map.6 takes twenty claims per part (MAP6_CLAIMS); the divided first map sets aside a claim whose words stand
 * inside one of its part's step does or its role sentence (restate), and an input or output of a part that is a field of one of
 * its store partners (a store at the other end of one of its lines) or a bare prefix of another item of the same list (that list's
 * category, at the item's own index).
 * map-reading.11 (pipeline .34, from the blind judging of the .33 KORU map: every one of 78 claims had anchors [], and the money
 * rule's place stood in the design record's 「조건·거부·분기」 row): after a reply is read, the program itself adds to a rule claim
 * (topic rule, scope not project) whose places are none the condition rows of its own part's 「조건·거부·분기」 table that share at
 * least two content words with the rule (the claim's words and its row's rule cells; Latin words of three letters or more, Hangul
 * words of two or more with a trailing particle left off, a few fixed words read as one: 스탑/stop, 상주/resident, 동시/concurrent …),
 * at most two (PROGRAM_ANCHORS_MAX), each { kind inferred, text: the row's 조건 (80), the row's line, program: true }; never beside a
 * place the reply kept, never on material. A program place is the program's, never the model's: the model cannot write one (an
 * unasked key is passed over) and the same reading of the same records adds the same ones (the browser reads them again). Stored as
 * map-reading.11, every anchor with program (true or false); earlier entries keep their shape.
 * Pipeline .34 also (the divided first map): a code device whose line is no row of a 「조건·거부·분기」 or 「파일 지도」 table (when
 * the records draw one) is set aside (enforced-by), and so is a person or gate device of a rule whose own line, or a 「가장 자신 없는
 * 것」 row of its part sharing two content words with it, says with 모름/추정 that it does not know whether the device is code or an
 * operational judgement (enforced-by: then unknown is the record's word); an input or output that a store partner's field repeats is
 * kept when it stands in that part's own 「부분별 설계」 cell (받는 산출물 for inputs, 내는 산출물 for outputs).
 * Pipeline .35 (still map-reading.11; storage unchanged): a place kept as stated whose line is neither the rule claim's own line nor
 * written in it verbatim (a cell of the place's row: its condition or its result) is read as inferred, every reading alike, and said
 * (anchorDowngrades); the program's places also read the part's own 「파일 지도」 rows (text: the path) and its 「부분별 설계」 row's
 * 설정 cell (text: that cell), after its condition rows. The divided first map also sets aside an input or output that is a bare
 * prefix (a space or a dot after it) of a payload name of one of the part's lines in that direction or of an item of its own design
 * cell (a cell split on 「,」 and 「·」 outside parentheses, a noun after the last item of a 「·」 list going on every bare item:
 * 「review·policy·state 행」 is 「review 행」, 「policy 행」, 「state 행」), unless it is that cell's very item (that list's category);
 * and a status or how claim quoting a connection-table row that a relation of the reply quotes (restate).
 * map-reading.12 (pipeline .36, from the blind judging of the .35 KORU map, whose engine traded three record rows for five condition
 * rows under the twenty-claim cap, and of a web-app map): the same reply may add to a part its condition rows (conditions, up to 24:
 * when (80), then (60), else (60 or null) and at, the record's 「조건·거부·분기」 row), outside the claim cap. A wrong row is set aside
 * alone (parts[i].conditions[j], condition); the divided first map also sets aside a row whose line is no condition row of that part
 * (when the records draw that table) or whose words do not stand in it, and a claim quoting a condition row a kept condition of its
 * part stands on (restate). Stored as map-reading.12, every part with conditions ([] when not said); earlier entries keep their shape.
 * Pipeline .36 also (validation, every reading): a loop unit with no number, no unit word and no 마다·주기·폴링 (a resume sentence such
 * as 「없으면 다시 읽기」) is left null, and a retired or unbuilt part's loop is left out (loop). The divided first map also: sets aside
 * a control line carrying an artifact of the records' artifact table alone, at its channel (relations[i].channel, channel; the line's
 * payload names the row, or its ends are the row's maker and reader or the store holding it); sets aside a relation whose line is no
 * row of a connection, artifact, part-design or inner-step table and no arrow line, when a record draws a connection table
 * (unrecorded); and sets aside an input or output that adds a unit noun (행, 메시지, 스트림, 파일, 줄) to a bare item of the part's own
 * design cell (「cards 행」 where the cell says cards). The shared noun of a 「·」 list goes on every item only when it is one such unit
 * word and the items are bare names (no 「/」, no 「:」). */
/* map-reading.13 (pipeline .37, from the blind judging of the .36 maps, KORU and a web app both 20/20 and design 18/18, whose global
 * correction was paid for lines the contract itself set aside, whose engine kept its 설정 cadence as a loop-missing diagnostic, whose
 * collector kept a null stop beside its QUOTA_REACHED row, whose access rule's places stood in the conditions of the part it calls,
 * whose HTTP request formats were lost with their claims and whose render corrections dropped rows unseen): the same reply may add to a
 * relation the fields of the format artifact it carries (payloadFields, up to 24 of 60: a 산출물 row whose 있는 곳 is HTTP, 메모리 or a
 * request, a chip on its line and never a node); a list that is not one or runs past 24 is left out alone (relations[i].payloadFields,
 * payload-fields) and so is one wrong item (relations[i].payloadFields[j]); the divided first map also leaves out a list on a line that
 * carries no format row and an item that is no field of that row. After a reply is read the program itself adds, each marked program
 * (the model cannot write one: an unasked key is passed over; the same reading of the same records adds the same ones): to a part
 * whose loop is null and whose config holds a cadence setting (CADENCE_SETTING: *_cadence N s, POLL_MS N, INTERVAL_MS N, N s 주기)
 * that stands in its own 「부분별 설계」 row's 설정 cell, a loop whose unit is that item verbatim, on that row (programLoop; never beside a
 * unit the model gave, never on a retired or unbuilt part); to a part with a loop whose stop or resume is null, the then or else of the
 * first of its conditions naming a stop or quota code (QUOTA_REACHED, 멈춤, 중단: STOP_CODE) or a resume code (RESUME, 재개); to a rule
 * with no place once its own part's rows gave none, a condition of its own part or of a part one of its outgoing lines reaches sharing
 * at least two content words with it (inferred; 환불·소유자·세션 now read as refund·owner·sess); to a part, each dotted variable of a
 * condition's when (sess.issued_at) that a record row naming the part calls kept state (유지 상태, 카운터/counter, 키) by one of its
 * items, by name only (scope null, no readers or changers). Stored as map-reading.13: every loop and every kept state with program
 * (true or false; a program state names nothing else), every relation with payloadFields ([] when not said); earlier entries keep
 * their shape.
 * Pipeline .37 also (the divided first map): a wrong cadence word leaves the cadence out alone and the line stays, and so does a line
 * whose connection row has a 언제·얼마나 자주 cell with no cadence (relations[i].cadence, cadence); a later line with the same ends,
 * channel and payload as one read before is set aside (relations[i], dup-line); a withdrawal whose 철회·변경 row's 지금 cell says 폐기
 * or 철회 took back a design decision (another kind is left null, withdrawal-kind), and one left null where its row names 폐기·철회·롤백·
 * 되돌림 is named (withdrawal-kind, the claim's own row); the shared noun of a 「·」 list is its last item's last Hangul word, on every
 * earlier item when none contains it, none ends in a class word (CLASS_NOUNS) and no item holds 「/」 or 「:」.
 * Pipeline .38 (still map-reading.13; an io item's exclusion may now carry value, ≤60, and its record cell in record/from/to): the
 * shared noun is an artifact or unit noun only (SHARED_NOUNS; a 「경주 행」 pair whole; a -기 act takes none; a time word stays on its
 * item); an input or output standing as written in its part's design cell or a connection row's 넘기는 것 cell is never a bare prefix;
 * a null cadence is named only on the line's own connection row (its sender the row's, its receiver the row's or a store); a wrong
 * channel word and a control line carrying an artifact leave the channel out alone (relations[i].channel, written null; the line
 * stays). */
/* map-reading.14 (pipeline .39, from the blind judging of the .38 maps: KORU 20/20 with design 18/18 but portMap 0 rows, the model
 * having sent []; a web app whose port rows, query channels, summary sentences and gate kinds stayed as the judge marked them): the
 * same reply may add to a part its file-map rows (fileRoles, up to twelve: the 「파일 지도」 row's path (120) and 「역할 한 줄」 (80) as
 * written, at that row); a list that is not one or runs past twelve is left out alone (parts[i].fileRoles, file-role) and so is one
 * wrong row (parts[i].fileRoles[j]); the divided first map also sets aside a row on no file-map row of its own part or with words its
 * row lacks. After a reply is read the program itself adds, each marked program (the model cannot write one; the same reading of the
 * same records adds the same ones): to a part with no steps whose records give it no 「안의 단계」 row while its 「부분별 설계」 row's 안의
 * 단계 cell is an arrow chain (「A → B → C」), one step per piece (name: the piece as written, 40; does null; uses []; at: that row;
 * programSteps); and to the reply, for a data line with no port row on that side whose stepped end has exactly one step the records
 * tie to the other end (programPortMap: a store's stem as row_<stem>, <stem>_read, <stem>.read or 「<stem> 읽기」 on the reader, a
 * stream's XREADGROUP; on the writer the store's file in the step's name or does, the store's name less its file ending, a stream's
 * XADD or a write call on the store's stem (queue.publish, orders.insert); for any other end a call on the stem of its own part-table
 * row's file (payon.createSession, flags.isOn)), a row on that step's own row, the port being the one input or output naming the other
 * end. Stored as map-reading.14: every part with fileRoles ([] when not said), every step and every port-map row with program (true or
 * false; a program step does nothing and uses nothing). Earlier entries keep their shape.
 * Pipeline .39 also (the divided first map): a claim whose range equals another part's claim's range and whose words mostly meet it
 * (half the smaller one's content words) is set aside (dup-claim) unless
 * its part holds a 모르는 것·철회·가장 자신 없는 것 row the claim resolves (three content words shared) or, failing that, is the part the
 * quoted row's first cell names (neither or both: both stay); a gate run on a claim naming no threshold (a number with a unit or a
 * comparison) and no operating state (만료, 노출, 잔고, 손실, 큐 길이 …) is left out alone (gate); a control line whose 넘기는 것 is a
 * query or a response (조회·요청·응답·결과) between an artifact row's maker and reader is read as no control (its channel left out). */
/* map-reading.15 (pipeline .40, from the blind judging of the .39 maps: KORU and the web app both 20/20 with design 18/18, whose web admin
 * rule kept 장치 미상 on two refusal rows, whose program port rows were none (the web app's twelve model rows filled the bound; a chain step
 * uses nothing), whose diagnostic said 「원문이 단계를 대지 않음」 of six lines a step names, whose CI 관문 looped 「PR마다」 and whose editor's
 * step kept 「(실패면 FALLBACK)」 in its name). The reply's contract is unchanged; after it is read the program itself adds, each marked
 * program (the model cannot write one; the same reading of the same records adds the same ones): to a rule claim with no code device
 * (and no none) whose places, the model's or the program's, stand on a 「조건·거부·분기」 row whose 참이면 refuses (REFUSAL_OUTCOME), the code
 * device { code, that 참이면 (80), that row } of the first such row, an unknown (장치 미상) giving way to it; and port-map rows past the
 * model's twelve, to PORTMAP_MAX (24) in all, from a matcher reading a step's name, does and uses and the store's own artifact rows (their
 * names, Latin stems and key field: 「orders.cursor」, 「orders 행 읽기」, 「event_id 조회」, 「shipments 행」, 「바뀐 것만 shipment.updated」) and,
 * where none names a step, the writer's own 3절 chain's last piece when its 내는 산출물 names the store (portSides). Validation (every
 * reading): a step name ending in a parenthesised tail whose does is not said keeps the tail as its does (stepTail; a program step too:
 * 「plan 행」 does 「실패면 FALLBACK」; a port-map row naming the written name follows it; stepRenames names them); a loop on a part whose
 * type repeats nothing of its own (LOOP_TYPES: loop, collector, compute, ai, actor; a part with no type word may) is left out, and a unit
 * naming a version-control or CI event (VCS_EVENT: PR마다, 커밋마다, 배포 때) is left null (loop). Stored as map-reading.15: every rule
 * device with program (true or false; a program device is code on its row), up to 24 port-map rows, and a program step's does may hold its
 * name's tail (it still uses nothing). Earlier entries keep their shape. */
/** A first map: nothing of the map, no request and no prior is sent (map.7 is never one). */
export const firstAsk = (ask: Pick<MapAsk, 'parts' | 'requests' | 'priors'>): boolean => ask.parts.length === 0 && (ask.requests ?? []).length === 0 && (ask.priors ?? []).length === 0;
/** A reply refused for a contradiction or a wrong reference it holds: where (path), which rule and what it names (an alias,
 * a key or a reference, never record text). The code stays INVALID_RESPONSE. */
export class MapReplyError extends Error {
  constructor(readonly path: string, readonly rule: 'settled-and-open' | 'duplicate-target' | 'duplicate-key' | 'material-evidence' | 'reference' | 'length' | 'source-kind' | 'condition-form' | 'condition-source' | 'condition-length' | 'contract', readonly target: string) { super('INVALID_RESPONSE'); this.name = 'MapReplyError'; }
}
/** AF137: the fixed categories of a map.7 generic guard (rule 'contract'); a refusal names one of these, never a value or a key. */
export type ContractGuard = 'shape' | 'keys' | 'text' | 'count' | 'new-count' | 'parent' | 'existing-name-parent' | 'role-required' | 'basis-required' | 'kind' | 'replaces'
  | 'empty-part' | 'role-basis' | 'parent-cycle' | 'ends' | 'duplicate' | 'match-contract' | 'quote' | 'explicit-request' | 'about' | 'secret-like' | 'target-time' | 'target-count'
  | 'prior' | 'prior-target' | 'parent-skipped'
  // map-reading.7: the optional fields, each named by its own category.
  | 'topic' | 'evidence' | 'when' | 'where' | 'before' | 'state' | 'state-at' | 'state-when' | 'files' | 'payload' | 'cadence' | 'mode'
  // map-reading.8: a part's type word and interface, a relation's channel, the reply's basis.
  | 'type' | 'type-at' | 'inputs' | 'outputs' | 'fields' | 'config' | 'channel' | 'basis-at' | 'basis-version'
  // pipeline .29 (the divided first map): a file line that skips its store, a claim on another part's table row, a sender the
  // line does not name (or an unbuilt or retired part sending what was not designed).
  | 'via-store' | 'wrong-part' | 'sender'
  // map-reading.9: a part's steps, loop and kept state, the reply's port map; pipeline .30: a claim restating its part's state row.
  | 'step' | 'loop' | 'state-var' | 'port-map' | 'restate'
  // pipeline .32: a new part made of what a line hands over, with no table row, no type and no line (set aside by the server).
  | 'payload-part'
  // map-reading.10: a rule's scope, one of its places or devices, a withdrawal's kind, a gate's kind (each left out alone).
  | 'scope' | 'anchor' | 'enforced-by' | 'withdrawal-kind' | 'gate'
  // map-reading.12: a part's condition row; pipeline .36: a store part standing on a place another store part holds (set aside by the
  // server with its lines), a relation no recorded line backs.
  | 'condition' | 'store-dup' | 'unrecorded'
  // map-reading.13: a relation's format fields; pipeline .37: a line read twice (set aside by the program's own reading).
  | 'payload-fields' | 'dup-line'
  // map-reading.14: a part's file-map role row; pipeline .39: a claim quoting the very range another part's claim quotes.
  | 'file-role' | 'dup-claim';
/** map-reading.7–8: the categories that leave out a part's own optional fields only (the part stays). */
const PART_FIELD_GUARDS: ReadonlySet<string> = new Set(['state', 'state-at', 'state-when', 'files', 'type', 'type-at', 'inputs', 'outputs', 'fields', 'config']);
/** map-reading.8: the reply's own optional fields, left null alone when wrong. */
const REPLY_FIELD_GUARDS: ReadonlySet<string> = new Set(['basis-at', 'basis-version']);
/** Pipeline .29: the first map's contract (map.6) takes 24 new parts, every part a reply may hold: a design record's units and
 * its stores did not fit twelve. map.7 keeps twelve. Pipeline .31: 36 (the two KORU records need about 33: 24 table rows and nine
 * stores; at 24 the plan lost three stores, six rows and the lines through them). map.7 keeps 24 parts, twelve of them new. */
export const MAP6_NEW_PARTS = 36;
/** Pipeline .32: the first map's contract (map.6) takes sixteen claims per part (six before): the KORU engine has about fifteen rows
 * of its own (change, defect, withdrawal, rule, unknown) and six held only its state report and design. map.7 keeps four.
 * Pipeline .33: twenty (the .32 engine and card runner filled sixteen; stored map-reading.10 entries hold twenty, .9 sixteen). */
export const MAP6_CLAIMS = 20;
/** Pipeline .31: a store's field item may run to 60 (the LEDGER row's 「event(CYCLE·ARM_CYCLE·…·PULL…)」 is 60 and lost the field list). */
export const FIELD_ITEM_MAX = 60;
/** Pipeline .29: the first map's contract (map.6) takes 32 relations: a store is drawn as two lines (producer → store → reader), and
 * the KORU records' 22 arrow rows with their stores did not fit sixteen. map.7 keeps twelve. Pipeline .30: 48 (the .29 run filled 32
 * and left seven connection rows without a line; a faithful KORU map needs about forty). map-reading.9 stores 48. */
export const MAP6_RELATIONS = 48;
/** map-reading.9: the bounds of a part's lists (map-reading.8 stored six inputs, six outputs, twelve fields and four settings). */
/** map-reading.15 (pipeline .40): a reading's port-map rows, the program's beside the model's twelve (PART_LIST_MAX.portMap bounds the reply). */
export const PORTMAP_MAX = 24;
export const PART_LIST_MAX = Object.freeze({ files: 6, inputs: 8, outputs: 8, fields: 24, config: 8, steps: 12, stateVars: 8, portMap: 12, conditions: 24, payloadFields: 24, fileRoles: 12 });
/* Pipeline .29 (the divided first map): the program's own reading of a quoted passage, never of the model's words. */
/** A name as the record and the map write it, compared loosely (Unicode form, emphasis marks, spacing, case). */
const plainName = (s: string): string => s.normalize('NFC').replace(/[*`]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
/** The cells of each markdown table row of a passage (header and rule rows too: they name no part). */
const tableRows = (text: string): string[][] => text.split('\n').map(l => l.trim()).filter(l => l.startsWith('|'))
  .map(l => l.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim()));
/** The names one cell lists ("엔진·종이 생산자"). */
const cellNames = (cell: string): string[] => cell.split(/[·,/]/).map(plainName).filter(Boolean);
const FILE_END = /\.(jsonl?|json|md|csv|gz)\b/i, STEM = /^[a-z0-9_]+(?:-[a-z0-9_]+)*/i;
/** The files a text names, each as its stem and ending ("/var/…/review.jsonl" and "review.jsonl 행" → review.jsonl,
 * "cards-{CX,CL,DS}.jsonl" → cards.jsonl, "SHEET-<날>.md" → sheet.md); an ending without a stem (".jsonl.active") names none. */
export function fileKeys(text: string): string[] {
  const keys: string[] = [];
  for (const token of text.split(/[\s·()（）「」『』[\]]+/)) {
    const end = FILE_END.exec(token); if (!end) continue;
    const stem = token.slice(0, end.index).split('/').reverse().map(s => STEM.exec(s)?.[0]).find(Boolean);
    const key = stem ? `${stem.toLowerCase()}.${end[1]!.toLowerCase()}` : null;
    if (key && !keys.includes(key)) keys.push(key);
  }
  return keys;
}
/** A setting that is a version (a commit sha bare or inside the words, "sha …", 판본, 명세 <hex>): versions are claims, not config. */
export const versionLike = (s: string): boolean => (/^[0-9a-f]{7,40}$/i.test(s.trim()) && /[a-f]/i.test(s))
  || /(?:^|[^0-9a-z])(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}(?![0-9a-z])/i.test(s)
  || /(?:^|[^a-z])sha(?:[^a-z]|$)/i.test(s) || s.includes('판본') || /명세\s*[0-9a-f]{7,}/i.test(s);
/** The sender each line of a passage names: a table row's first cell (with the row's cells), or the words before an arrow line's
 * first arrow (with the words before its last arrow, where every sending hop of the line stands). */
const ARROW = /\s*(?:─+→|-+>|→|⟶)\s*/g;
interface LineSender { name: string; row: string[] | null; head: string }
const lineSenders = (text: string): LineSender[] => text.split('\n').flatMap((line): LineSender[] => {
  const t = line.trim();
  if (t.startsWith('|')) { const row = t.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim()); return [{ name: plainName(row[0] ?? ''), row, head: '' }]; }
  const arrows = [...t.matchAll(ARROW)];
  if (!arrows.length || arrows[0]!.index! === 0) return [];
  return [{ name: plainName(t.slice(0, arrows[0]!.index).replace(/^(?:[-*•]|\d{1,2}[.)])\s*/, '')), row: null, head: t.slice(0, arrows.at(-1)!.index) }];
}).filter(x => !!x.name);
/** The files a part holds by its own words: its name, its outputs and its files. */
const storeKeys = (b: MapReplyPart): string[] => [b.name ?? '', ...(b.outputs ?? []), ...(b.files ?? [])].flatMap(fileKeys);
/** Pipeline .32: the files the records' artifact tables (「2. 산출물」) give a row of their own (its first cell's file), or null when
 * no record draws such a table (then every file a data line names asks its store, as before). */
function artifactFiles(texts: Iterable<string>): Set<string> | null {
  let out: Set<string> | null = null;
  for (const text of texts) {
    let open = false, header = false;
    for (const raw of text.split('\n')) {
      const line = raw.trim(), heading = line.startsWith('|') ? null : /^\d{1,2}\.\s*(.+)$/.exec(line);
      if (heading) { open = /^산출물/.test(heading[1]!.trim()); header = false; continue; }
      if (!open) continue;
      if (!line.startsWith('|')) { if (header && line) open = false; continue; }
      const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
      if (!header) { header = true; out ??= new Set(); continue; }
      if (cells.every(c => !c || /^:?-{2,}:?$/.test(c))) continue;
      for (const k of fileKeys(cells[0] ?? '')) out!.add(k);
    }
  }
  return out;
}
/* Pipeline .30 (the divided first map): the names a record's change, defect and withdrawal tables name ("5. 최근 소유자 요청과 실제
 * 변화", "8. 오류·미해결·할 일", "6. 철회·변경"): every cell of their data rows (the header and rule rows left out), compared loosely. */
const FACT_SECTION = /실제\s*(?:로\s*)?(?:바뀐|변화)|오류|철회/;
export function factRowNames(texts: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const text of texts) {
    let open = false, header = false;
    for (const raw of text.split('\n')) {
      const line = raw.trim(), heading = line.startsWith('|') ? null : /^\d{1,2}\.\s*(.+)$/.exec(line);
      if (heading) { open = FACT_SECTION.test(heading[1]!); header = false; continue; }
      if (!open) continue;
      if (!line.startsWith('|')) { if (header && line) open = false; continue; }
      const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
      if (!header) { header = true; continue; }
      if (cells.every(c => !c || /^:?-{2,}:?$/.test(c))) continue;
      for (const c of cells) if (c) out.add(plainName(c));
    }
  }
  return out;
}
/* Pipeline .34 (map-reading.11): the program's own reading of the records' numbered section tables, by their headings and header
 * cells, for a rule's places and devices and a part's design cells. Never the model's words. */
const CONDITION_TABLE = /^조건\s*·\s*거부/, FILE_TABLE = /^파일\s*지도/, HEDGE_TABLE = /가장\s*자신\s*없는/, DESIGN_TABLE = /^부분별\s*설계/, WITHDRAWN_TABLE = /^철회/;
interface SectionRow { record: string; from: number; to: number; cells: string[]; header: string[] }
/** The data rows of every table under a numbered heading matching title (header and rule rows left out), each with its cells, its
 * table's header cells, its record and where its line stands ([from, to) of the record's text, the line's own white space left out). */
function rowsUnder(texts: Map<string, { text: string; spans: Span[] | null }>, title: RegExp): SectionRow[] {
  const out: SectionRow[] = [];
  for (const [record, { text }] of texts) {
    let open = false, header: string[] | null = null, offset = 0;
    for (const raw of text.split('\n')) {
      const start = offset; offset += raw.length + 1;
      const line = raw.trim(), heading = line.startsWith('|') ? null : /^\d{1,2}\.\s*(.+)$/.exec(line);
      if (heading) { open = title.test(heading[1]!.trim()); header = null; continue; }
      if (!open) continue;
      if (!line.startsWith('|')) { if (header && line) open = false; continue; }
      const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
      if (!header) { header = cells; continue; }
      if (cells.every(c => !c || /^:?-{2,}:?$/.test(c))) continue;
      const from = start + raw.indexOf(line);
      out.push({ record, from, to: from + line.length, cells, header });
    }
  }
  return out;
}
const column = (header: string[], name: RegExp, fallback = -1): number => { const i = header.findIndex(c => name.test(c)); return i >= 0 ? i : fallback; };
/** The alias of the pieces a line stands on (one piece, or the run of pieces it spans), as a reply would cite it. */
function lineAlias(record: string, spans: Span[] | null, from: number, to: number): string | null {
  const hit = (spans ?? []).flatMap((s, i) => s.from < to && from < s.to ? [i] : []);
  if (!hit.length) return null;
  const n = (i: number) => String(i + 1).padStart(2, '0'), a = hit[0]!, b = hit.at(-1)!;
  return a === b ? `${record}.${n(a)}` : `${record}.${n(a)}-${n(b)}`;
}
/** Pipeline .34: a condition row of a design record's 「조건·거부·분기」 table: the part its 부분 이름 cell names (as written), its 조건
 * and 참이면 cells and the alias of its line (where it stands in its record). */
export interface ConditionRow { part: string; at: string; condition: string; then: string;
  /** Pipeline .36: the row's 거짓이면 cell as written ('' when the table has none). */
  otherwise: string; record: string; from: number; to: number }
export function conditionRows(ask: MapAsk): ConditionRow[] {
  const texts = askRecords(ask);
  return rowsUnder(texts, CONDITION_TABLE).flatMap((r): ConditionRow[] => {
    const part = column(r.header, /부분/, 0), condition = column(r.header, /^조건(\s|$)/), then = column(r.header, /참이면/), otherwise = column(r.header, /거짓이면/);
    if (condition < 0 || then < 0) return [];
    const at = lineAlias(r.record, texts.get(r.record)?.spans ?? null, r.from, r.to), name = r.cells[part] ?? '', words = r.cells[condition] ?? '';
    return at && name && words ? [{ part: name, at, condition: words, then: r.cells[then] ?? '', otherwise: otherwise >= 0 ? r.cells[otherwise] ?? '' : '', record: r.record, from: r.from, to: r.to }] : [];
  });
}
/** Pipeline .35: the place rows of a part beyond its condition rows, for the program's places: its 「파일 지도」 rows (the 경로 cell as the
 * place, the path and 역할 cells as its words) and its 「부분별 설계」 row's 설정 cell (the cell as the place and its words). */
interface PlaceRow { part: string; at: string; text: string; words: string; record: string; from: number; to: number }
function placeRows(ask: MapAsk): PlaceRow[] {
  const texts = askRecords(ask), out: PlaceRow[] = [];
  for (const r of rowsUnder(texts, FILE_TABLE)) {
    const part = column(r.header, /부분/), path = column(r.header, /경로/, 0), role = column(r.header, /역할/);
    const at = lineAlias(r.record, texts.get(r.record)?.spans ?? null, r.from, r.to), name = part >= 0 ? r.cells[part] ?? '' : '', where = r.cells[path] ?? '';
    if (at && name && where) out.push({ part: name, at, text: where, words: `${where} ${role >= 0 ? r.cells[role] ?? '' : ''}`, record: r.record, from: r.from, to: r.to });
  }
  for (const r of rowsUnder(texts, DESIGN_TABLE)) {
    const name = column(r.header, /이름/, 0), set = column(r.header, /설정/);
    const at = lineAlias(r.record, texts.get(r.record)?.spans ?? null, r.from, r.to), cell = set >= 0 ? r.cells[set] ?? '' : '';
    if (at && r.cells[name] && cell && !/^[—–-]+$/.test(cell)) out.push({ part: r.cells[name]!, at, text: cell, words: cell, record: r.record, from: r.from, to: r.to });
  }
  return out;
}
/** Pipeline .35: a cell's items: split on 「,」 then 「·」 outside parentheses; when every item of a 「·」 list but its last is one bare
 * word and the last is a word followed by a noun of one or two Hangul words, that noun goes on every item (「review·policy·state 행」 →
 * 「review 행」, 「policy 행」, 「state 행」; 「journal·outcomes 경주 행」 → 「journal 경주 행」, 「outcomes 경주 행」). */
const splitOutside = (text: string, seps: string): string[] => {
  const out: string[] = []; let depth = 0, word = '';
  for (const ch of text) {
    if ('([{（「'.includes(ch)) depth++; else if (')]}）」'.includes(ch)) depth = Math.max(0, depth - 1);
    if (!depth && seps.includes(ch)) { out.push(word); word = ''; } else word += ch;
  }
  return [...out, word].map(s => s.trim()).filter(Boolean);
};
/* Pipeline .37: the shared noun of a 「·」 list is its last item's last Hangul word (the last item of two words or more), and goes on
 * every earlier item when none of them holds that word already, none ends in a class word of its own (CLASS_NOUNS: 「orders 행」,
 * 「주문 요청」, 「플래그 값」 are whole names) and no item holds 「/」 or 「:」: 「전날 체결·마크 원자료」 → 「전날 체결 원자료」, 「마크
 * 원자료」; 「GTX 진입·HARD STOP_MARKET·TP GTX 주문」 → each 「… 주문」; 「journal·outcomes 경주 행」 → 「journal 행」, 「outcomes 경주 행」.
 * A Latin or numbered tail is the last name's own (「runner cards」, 「지난 24 h LEDGER」); 「cards·counter·review 행·LEDGER」 shares
 * nothing. (.36 shared only a unit word after bare names, and lost 원자료 and 주문.)
 * Pipeline .38 (from the blind judging of the .37 maps, whose io checks set aside seven KORU and four web-app items the records
 * write): the shared noun is an artifact or unit noun only (SHARED_NOUNS; or a word ending in 파일 or 스트림, or in 행 where that 행
 * ends no act word such as 진행·실행·수행): 「한 줄 보고·결정 필요」, 「읽기 한 쪽·메모·사전 등록」, 「주문서 입력·배송 조회」, 「환불·수동
 * 상태 변경·주소 제안 확인」 share nothing (.37 made 「한 줄 보고 필요」, 「메모 등록」, 「주문서 입력 조회」 and then took the record's own
 * 「한 줄 보고」, 「메모」, 「주문서 입력」 for their prefixes). A last item of three words or more whose last two words are Hangul (the
 * first no time word) and end in 행·파일·스트림 or stand in SHARED_NOUNS shares both: 「journal·outcomes 경주 행」 → 「journal 경주 행」,
 * 「outcomes 경주 행」. An earlier item ending in a -기 act (「감독자 보고 붙여 넣기」, 「CSV 내려받기」) takes no noun. A leading time
 * word stays on its own item: 「전날 체결·마크 원자료」 → 「전날 체결 원자료」, 「마크 원자료」. */
export const UNIT_NOUNS: readonly string[] = Object.freeze(['행', '메시지', '스트림', '파일', '줄']);
export const CLASS_NOUNS: readonly string[] = Object.freeze([...UNIT_NOUNS, '요청', '응답', '값', '키', '결과', '답']);
export const SHARED_NOUNS: readonly string[] = Object.freeze(['행', '메시지', '스트림', '파일', '줄', '원자료', '주문', '요청', '결과', '이벤트', '응답', '경주 행', '체결 행', '카드 행', '알림톡']);
/** Pipeline .38: a 행 ending an act word (진행, 실행, 수행, 발행 …) names no row. */
const ACT_ROW = /(?:진|실|수|시|이|발|운|병|강|유|선|후|비|은|여|통|동|흥|현|직|역|평|급|서|보|악|만|횡|순|간)행$/;
const sharedNoun = (w: string): boolean => SHARED_NOUNS.includes(w) || /^[가-힣]+(?:파일|스트림)$/.test(w) || (/^[가-힣]+행$/.test(w) && !ACT_ROW.test(w));
/** Pipeline .38: a -기 act (넣기, 내려받기, 끄기 …) ends an act, which takes no shared noun (the nouns ending in 기 are left out). */
const actWord = (w: string): boolean => /^[가-힣]+기$/.test(w) && !/^(?:주기|크기|시기|초기|후기|동기|경기|위기|인기|기기|일기|공기|전기|무기|용기|정기|증기|연기|분기|장기|단기|표기)$/.test(w);
const TIME_WORD = /^(?:전날|당일|오늘|어제|지난|매일|다음날|그날)$/;
export const sharedItems = (cell: string): string[] => splitOutside(cell, ',').flatMap(group => {
  const items = splitOutside(group, '·'); if (items.length < 2) return items;
  const last = items.at(-1)!, words = last.split(/\s+/), head = items.slice(0, -1);
  const pair = words.length >= 3 ? words.slice(-2) : null;
  const phrase = pair && /^[가-힣]+$/.test(pair[0]!) && !TIME_WORD.test(pair[0]!) && /^[가-힣]+$/.test(pair[1]!)
    && (SHARED_NOUNS.includes(pair.join(' ')) || ['행', '파일', '스트림'].includes(pair[1]!)) ? pair.join(' ') : null;
  const noun = phrase ?? words.at(-1)!, tail = noun.split(' ').at(-1)!;
  const shares = words.length >= 2 && (phrase !== null || (/^[가-힣]+$/.test(noun) && sharedNoun(noun))) && !items.some(x => /[/:]/.test(x))
    && head.every(x => { const w = x.split(/\s+/); return !w.includes(tail) && !CLASS_NOUNS.includes(w.at(-1)!) && !actWord(w.at(-1)!); });
  return shares ? [...head.map(x => `${x} ${noun}`), last] : items;
});
/* Pipeline .36: the records' artifact table (「산출물」) as the program reads it, for the stores a reading draws (one per place), the
 * lines that carry an artifact and the stores a reading leaves without a line. Never the model's words. */
const PART_TABLE_TS = /^부분(\s*유형)?(\s*\(표\))?$/, ARTIFACT_TABLE_TS = /^산출물/, STEP_TABLE = /^안의\s*단계/;
/** Pipeline .36: an artifact row: its name, the parts its 만드는 부분 and 읽는 부분 cells name (loosely compared, a [모름] cell names
 * none), its 있는 곳 as written (「같은 곳」 read as the row above), the place key it stands for (the file it names, or for a folder the
 * file of its own name, else its words, loosely compared), whether that place is a store's (a file or folder, or a place a part-table
 * row holds by its name or its cells) and where its line stands. */
export interface ArtifactRow { name: string; makers: string[]; readers: string[]; where: string; place: string; store: boolean; record: string; from: number; to: number;
  /** The 만드는 부분 and 읽는 부분 cells as written (for a diagnostic's names). */
  makerCell: string; readerCell: string;
  /** Pipeline .37: the 필드 cell's items (split on 「·」 outside parentheses; a [모름] cell has none), and whether the row is a format
   * artifact (no store place, its 있는 곳 HTTP, 메모리 or a request): a chip on the line that carries it, never a node. */
  fields: string[]; format: boolean }
const cellParts = (cell: string): string[] => /\[모름\]/.test(cell) ? [] : cellNames(cell.replace(/\([^)]*\)/g, ''));
/** A part-table cell's places: its 「·」 items outside parentheses (bracketed tags left out), a first item's head words going on every
 * later bare item (「Redis 스트림 events·events:dlq」 → 「Redis 스트림 events」, 「Redis 스트림 events:dlq」). */
export const placeItems = (cell: string): string[] => {
  const items = splitOutside(cell.replace(/\[[^\]]*\]/g, ' '), '·,'), head = (items[0] ?? '').split(/\s+/);
  return items.length > 1 && head.length > 1 && items.slice(1).every(x => !/\s/.test(x)) ? [items[0]!, ...items.slice(1).map(x => `${head.slice(0, -1).join(' ')} ${x}`)] : items;
};
const placeCache = new WeakMap<MapAsk, { rows: ArtifactRow[]; held: Map<string, Set<string>> }>();
function readPlaces(ask: MapAsk): { rows: ArtifactRow[]; held: Map<string, Set<string>> } {
  const hit = placeCache.get(ask); if (hit) return hit;
  const texts = askRecords(ask), partRows = rowsUnder(texts, PART_TABLE_TS);
  // What each part-table name holds by its own cells (loosely compared), and every name the part tables give.
  const cells = new Map<string, Set<string>>();
  for (const r of partRows) { const n = plainName(r.cells[0] ?? ''); if (!n) continue; const set = cells.get(n) ?? new Set<string>(); for (const c of r.cells.slice(1)) for (const x of placeItems(c)) set.add(plainName(x)); cells.set(n, set); }
  const rows: ArtifactRow[] = []; let previous: { where: string } | null = null;
  for (const r of rowsUnder(texts, ARTIFACT_TABLE_TS)) {
    const name = r.cells[column(r.header, /이름/, 0)] ?? '', makers = column(r.header, /만드는/), readers = column(r.header, /읽는/), at = column(r.header, /있는\s*곳/), fieldAt = column(r.header, /필드/);
    if (!name || at < 0) continue;
    let where = (r.cells[at] ?? '').trim(); if (/^같은\s*곳/.test(where) && previous) where = previous.where; previous = { where };
    const files = fileKeys(where), folder = /\/$/.test(where) ? fileKeys(name) : [];
    const place = files.length ? files.join(',') : folder.length ? folder.join(',') : plainName(where);
    const held = !!plainName(where) && (cells.has(plainName(where)) || [...cells.values()].some(set => set.has(plainName(where))));
    const store = files.length > 0 || folder.length > 0 || /\/$/.test(where) || held, fieldCell = fieldAt >= 0 ? r.cells[fieldAt] ?? '' : '';
    rows.push({ name, makers: makers >= 0 ? cellParts(r.cells[makers] ?? '') : [], readers: readers >= 0 ? cellParts(r.cells[readers] ?? '') : [], where, place,
      store, record: r.record, from: r.from, to: r.to,
      makerCell: makers >= 0 ? r.cells[makers] ?? '' : '', readerCell: readers >= 0 ? r.cells[readers] ?? '' : '',
      fields: /\[모름\]/.test(fieldCell) ? [] : splitOutside(fieldCell, '·'), format: !store && /^(?:HTTP|메모리)|요청/i.test(where) });
  }
  // The places each name holds: an artifact row of its name, a place its name is, or a place its own part-table row writes.
  const held = new Map<string, Set<string>>();
  const add = (n: string, place: string) => { const set = held.get(n) ?? new Set<string>(); set.add(place); held.set(n, set); };
  for (const row of rows) if (row.store) {
    add(plainName(row.name), row.place);
    const w = plainName(row.where); if (cells.has(w)) add(w, row.place);
    for (const [n, set] of cells) if (set.has(w)) add(n, row.place);
  }
  const out = { rows, held }; placeCache.set(ask, out); return out;
}
export const artifactRows = (ask: MapAsk): readonly ArtifactRow[] => readPlaces(ask).rows;
/** Pipeline .36: the store places a part of this name holds by the records' tables (empty when none). */
export const heldPlaces = (ask: MapAsk, name: string): ReadonlySet<string> => readPlaces(ask).held.get(plainName(name)) ?? new Set<string>();
/** Pipeline .36: whether a line from → to (by part name) with this payload carries an artifact of the records' artifact table: its
 * payload names a row (an item of it, or a file a row names), or its ends are the row's maker and reader, or a maker and the store
 * holding the row's place, or that store and a reader. */
export function carriesArtifact(ask: MapAsk, from: string, to: string, payload: string | null): boolean {
  const { rows, held } = readPlaces(ask), a = plainName(from), b = plainName(to);
  const items = payload ? sharedItems(payload).map(plainName) : [], files = payload ? fileKeys(payload) : [];
  return rows.some(row => {
    const name = plainName(row.name), keys = fileKeys(row.name);
    if (items.includes(name) || (keys.length && keys.some(k => files.includes(k)))) return true;
    const holds = (n: string) => row.store && (held.get(n)?.has(row.place) ?? false);
    return (row.makers.includes(a) && (row.readers.includes(b) || holds(b))) || (holds(a) && row.readers.includes(b));
  });
}
/** Pipeline .37: the format artifact rows (ArtifactRow.format) a line from → to (by part name) with this payload carries: its ends are
 * the row's maker and reader, or its payload names the row. */
export function formatRows(ask: MapAsk, from: string, to: string, payload: string | null): ArtifactRow[] {
  const a = plainName(from), b = plainName(to), items = payload ? sharedItems(payload).map(plainName) : [];
  return readPlaces(ask).rows.filter(row => row.format && ((row.makers.includes(a) && row.readers.includes(b)) || items.includes(plainName(row.name))));
}
/** Pipeline .37: a setting saying how often its part repeats (*_cadence N s, POLL_MS N, INTERVAL_MS N, N s 주기); never a wait
 * (BLOCK_MS, TIMEOUT_MS) or a bare number of seconds. */
export const CADENCE_SETTING = /(?:^|[^a-z0-9_])[a-z0-9_]*_cadence\s*[:=]?\s*\d|(?:^|[^a-z0-9_])(?:[a-z0-9]+_)*(?:poll|interval)_ms\s*[:=]?\s*\d|\d+(?:\.\d+)?\s*(?:ms|s|초)\s*주기/i;
/** Pipeline .37 (map-reading.13): the program's loop of a part whose loop is null: the first cadence setting of its config (60 or
 * fewer) standing in its own 「부분별 설계」 row's 설정 cell, verbatim as the unit, with the alias of that row; null for a retired or
 * unbuilt part and where no such row says it. */
export function programLoop(ask: MapAsk, part: { name?: string | null | undefined; config?: readonly unknown[] | null | undefined; state?: string | null | undefined; type?: string | null | undefined }): { unit: string; at: string } | null {
  if (!part.name || part.state === 'retired' || part.state === 'unbuilt') return null;
  // Pipeline .40: a type that repeats nothing takes no loop (LOOP_TYPES; a part with no type word may).
  if (part.type && !LOOP_TYPES.includes(part.type as PartType)) return null;
  const items = (Array.isArray(part.config) ? part.config : []).flatMap(x => typeof x === 'string' && x.trim().length <= 60 && CADENCE_SETTING.test(x) ? [x.trim()] : []);
  if (!items.length) return null;
  const texts = askRecords(ask), own = plainName(part.name);
  for (const r of rowsUnder(texts, DESIGN_TABLE)) {
    const name = column(r.header, /이름/, 0), set = column(r.header, /설정/);
    if (set < 0 || plainName(r.cells[name] ?? '') !== own) continue;
    const cell = plainName(r.cells[set] ?? ''), item = items.find(x => cell.includes(plainName(x)));
    const at = item ? lineAlias(r.record, texts.get(r.record)?.spans ?? null, r.from, r.to) : null;
    if (item && at) return { unit: item, at };
  }
  return null;
}
/** Pipeline .39 (map-reading.14): the records' 「파일 지도」 rows: the part its 속한 부분 cell names and its 경로 and 역할 한 줄 cells (each as
 * written; '' for a table with no 역할 column), with the alias of its line and where that line stands. */
export interface FileMapRow { part: string; path: string; role: string; at: string; record: string; from: number; to: number }
export function fileMapRows(ask: MapAsk): FileMapRow[] {
  const texts = askRecords(ask);
  return rowsUnder(texts, FILE_TABLE).flatMap((r): FileMapRow[] => {
    const part = column(r.header, /부분/), path = column(r.header, /경로/, 0), role = column(r.header, /역할/);
    const at = lineAlias(r.record, texts.get(r.record)?.spans ?? null, r.from, r.to);
    return at && part >= 0 && r.cells[part] && r.cells[path] ? [{ part: r.cells[part]!, path: r.cells[path]!, role: role >= 0 ? r.cells[role] ?? '' : '', at, record: r.record, from: r.from, to: r.to }] : [];
  });
}
/** Pipeline .39 (map-reading.14): the program's steps of a part the records give no 「안의 단계」 row: the pieces of its own 「부분별
 * 설계」 row's 안의 단계 cell when that cell is an arrow chain (「race_rows → aggregate → boot_se → render」; two pieces or more, split on
 * the arrows outside parentheses), each piece as written (cut at 40 with 「…」), once, at most twelve, all on that row; [] otherwise
 * (a cell that says 「4절」 or [모름], a part with rows of its own, a part with no design row). */
/** Pipeline .40 (map-reading.15): a step name's parenthesised tail, kept out of the name (「plan 행(실패면 FALLBACK)」 → 「plan 행」 and
 * 「실패면 FALLBACK」, 「address_suggestions 행(PENDING_REVIEW)」 → 「address_suggestions 행」 and 「PENDING_REVIEW」); null when the name has
 * no such tail, the name left is shorter than two characters, the tail runs past 120, or the name is a call (an identifier right before
 * the parenthesis and a Latin argument: 「toCsv(BOM)」, 「row_live(1800 s)」). The model's step keeps its tail where its does is said. */
export function stepTail(name: string): { name: string; tail: string } | null {
  const m = /^(.*?)\s*[(（]([^()（）]+)[)）]\s*$/.exec(name);
  if (!m) return null;
  const head = m[1]!.trim(), tail = m[2]!.trim();
  if (head.length < 2 || !tail || tail.length > 120) return null;
  if (/[A-Za-z0-9_]$/.test(m[1]!) && /^[\x20-\x7e]+$/.test(tail)) return null;
  return { name: head, tail };
}
/* Pipeline .40: a piece's tail goes to the program step's does (the one thing a program step may say); the step's name is the piece
 * less its tail. */
export function programSteps(ask: MapAsk, name: string): { name: string; at: string; does: string | null; written: string }[] {
  const own = plainName(name); if (!own) return [];
  const texts = askRecords(ask);
  if (rowsUnder(texts, STEP_TABLE).some(r => plainName(r.cells[column(r.header, /부분/, 0)] ?? '') === own)) return [];
  for (const r of rowsUnder(texts, DESIGN_TABLE)) {
    const named = column(r.header, /이름/, 0), cellAt = column(r.header, /단계/);
    if (cellAt < 0 || cellAt === named || plainName(r.cells[named] ?? '') !== own) continue;
    const cell = r.cells[cellAt] ?? '', pieces = splitOutside(cell.replace(/─+→|-+>|⟶/g, '→'), '→');
    const at = lineAlias(r.record, texts.get(r.record)?.spans ?? null, r.from, r.to);
    if (!at || pieces.length < 2 || /\[모름\]/.test(cell)) return [];
    const out: { name: string; does: string | null; written: string }[] = [];
    for (const piece of pieces) {
      const cut = stepTail(piece), whole = cut?.name ?? piece, n = whole.length <= 40 ? whole : `${whole.slice(0, 39)}…`;
      if (!out.some(x => x.name === n)) out.push({ name: n, does: cut?.tail ?? null, written: piece });
    }
    return out.slice(0, PART_LIST_MAX.steps).map(x => ({ ...x, at }));
  }
  return [];
}
/* Pipeline .39 (map-reading.14): the program's port-map rows. A part's stems: the stem of each file its name, files or (for a store)
 * outputs name, the first Latin word of its name (three letters or more: 「events 큐」 → events, 「orders 테이블」 → orders) and the base
 * name of each file its own part-table rows' [파일: …] tags name (A/lib/payon.ts → payon, A/lib/queue.ts → queue). */
interface PortPart { ref: string; name?: string | null; type?: string | null; inputs?: readonly string[]; outputs?: readonly string[]; files?: readonly string[];
  steps?: readonly { name: string; does?: string | null; uses?: readonly string[] }[] }
interface PortLine { from: string; to: string; channel?: string | null; payload?: string | null }
export interface ProgramPort { relation: number; port: string; step: string; stepIndex: number; direction: 'in' | 'out' }
const STEM_WORD = /^[a-z][a-z0-9_-]{2,}$/;
const callOf = (use: string): string => (/^[A-Za-z_][\w.-]*/.exec(use.trim())?.[0] ?? '').toLowerCase();
const nameTokens = (s: string): string[] => plainName(s).split(/[\s·,()（）「」[\]]+/).filter(Boolean);
function partStems(ask: MapAsk, part: PortPart, name: string): { stems: string[]; keys: string[]; stream: boolean } {
  const store = part.type === 'store', keys = [...new Set([name, ...(part.files ?? []), ...(store ? part.outputs ?? [] : [])].flatMap(fileKeys))];
  const stems = new Set(keys.map(k => k.slice(0, k.lastIndexOf('.'))));
  const first = /[a-z][a-z0-9_-]*/.exec(plainName(name))?.[0]; if (first && STEM_WORD.test(first)) stems.add(first);
  const rows = rowsUnder(askRecords(ask), PART_TABLE_TS).filter(r => plainName(r.cells[0] ?? '') === plainName(name));
  for (const r of rows) for (const tag of r.cells.join(' ').matchAll(/\[파일:\s*([^\]]+)\]/g)) for (const token of tag[1]!.split(/\s+/)) {
    if (!/[/.]/.test(token)) continue;
    const base = (token.split(/[/:]/).filter(Boolean).at(-1) ?? '').replace(/\..*$/, '').toLowerCase();
    if (STEM_WORD.test(base)) stems.add(base);
  }
  const stream = store && /스트림|큐|stream|queue|redis/i.test([name, ...(part.files ?? []), ...(part.outputs ?? []), ...rows.flatMap(r => r.cells)].join(' '));
  return { stems: [...stems], keys, stream };
}
const WRITE_CALL = /^[a-z0-9_-]+[._](?:insert|put|write|append|publish|add|update|upsert|set)\b/;
/* Pipeline .40 (map-reading.15, from the blind judging of the .39 maps: the web app's twelve model rows left the program no room, its
 * matcher read uses only while the chain steps use nothing, and the diagnostic said 「원문이 단계를 대지 않음」 of six lines a step names):
 * a step's name, does and uses all speak, and so do the store's own artifact rows (the rows the line's payload names, else every row
 * the store holds): a row's name, its Latin stem (「shipments 행」 → shipments, 「processed_events 행」 → processed_events) and its key
 * field (a first field <x>_id or <x>_no: processed_events 행's event_id). The reader of a store also: a call on a stem that writes
 * nothing (orders.cursor, orders.get), 「<row> 읽기」 or 「<stem> 읽기」 (「orders 행 읽기」), the key field in a step that writes nothing
 * (「event_id 조회」). The writer also: a step named as the row (「shipments 행」, 「address_suggestions 행(PENDING_REVIEW)」), a write call
 * on a row's stem (shipments.insert), a write word beside a row's stem (「tracking_events·shipments 쓰기」, 「processed_events INSERT」), a
 * Latin token of the line's payload (「바뀐 것만 shipment.updated」); and, when none of these names a step, the last piece of its own
 * 「부분별 설계」 row's 안의 단계 chain where that row's 내는 산출물 cell names the store, alone, or the piece is a bare write (「행 append」),
 * and the piece writes nothing else (「settle_runs INSERT」 does: none): 성적표 「render」 → SHEET. Exactly one step still. */
const READ_VERB = /^(?:get|read|find|select|cursor|scan|fetch|load|list|query|peek|range|xread)/i;
const WRITE_VERB = /^(?:insert|put|write|append|publish|add|update|upsert|set|save|create|delete|remove|xadd|incr)/i;
const WRITE_WORD = /(?:^|[\s·,(])(?:쓰기|쓴다|저장|기록|갱신|append|insert|put|write|upsert|xadd)(?=$|[\s·,)])/i;
const stemOf = (name: string): string | null => { const m = /[a-z][a-z0-9_-]*/.exec(plainName(name))?.[0]?.replace(/[-_]+$/, ''); return m && STEM_WORD.test(m) ? m : null; };
const stepWords = (s: { name: string; does?: string | null; uses?: readonly string[] }): string[] => plainName(`${s.name} ${s.does ?? ''} ${(s.uses ?? []).join(' ')}`).split(/[\s·,()（）「」[\]→]+/).filter(Boolean);
/** Pipeline .40: the store's rows a line speaks of: the artifact rows the store holds that its payload names, else every row it holds. */
function storeRows(ask: MapAsk, storeName: string, payload: string | null | undefined): ArtifactRow[] {
  const held = heldPlaces(ask, storeName), rows = artifactRows(ask).filter(r => r.store && held.has(r.place));
  const said = plainName(payload ?? ''), items = payload ? sharedItems(payload).map(plainName) : [];
  const named = rows.filter(r => items.includes(plainName(r.name)) || (!!said && said.includes(plainName(r.name))));
  return named.length ? named : rows;
}
/** Pipeline .40: the end's own design row's 안의 단계 chain (its pieces as written) and its 내는 산출물 cell's items, or null. */
function designChain(ask: MapAsk, name: string): { pieces: string[]; outs: string[] } | null {
  const own = plainName(name); if (!own) return null;
  for (const r of rowsUnder(askRecords(ask), DESIGN_TABLE)) {
    const named = column(r.header, /이름/, 0), cellAt = column(r.header, /단계/), outAt = column(r.header, /내는/);
    if (cellAt < 0 || cellAt === named || plainName(r.cells[named] ?? '') !== own) continue;
    const cell = r.cells[cellAt] ?? '', pieces = splitOutside(cell.replace(/─+→|-+>|⟶/g, '→'), '→');
    if (pieces.length < 2 || /\[모름\]/.test(cell)) return null;
    return { pieces, outs: outAt >= 0 ? splitOutside(r.cells[outAt] ?? '', '·,') : [] };
  }
  return null;
}
/** Pipeline .40: one data line's side as the program reads it: the steps of its stepped end the records tie to the other end (hits, by
 * index), the pieces of the end's 3절 chain that would and are no step of it (chain), and the port when exactly one step is tied. Every
 * side whose other end is a store is listed (hits [] when none is tied), any other side only when a step is tied. */
export interface PortSide { relation: number; direction: 'in' | 'out'; hits: number[]; chain: string[]; port: string | null }
export function portSides(ask: MapAsk, parts: readonly PortPart[], relations: readonly PortLine[], nameOf: (ref: string) => string = ref => parts.find(p => p.ref === ref)?.name ?? ''): PortSide[] {
  const byRef = new Map(parts.map(p => [p.ref, p])), out: PortSide[] = [], rows = artifactRows(ask);
  relations.forEach((line, relation) => {
    if (!line || line.channel !== 'data') return;
    for (const direction of ['in', 'out'] as const) {
      const end = byRef.get(direction === 'in' ? line.to : line.from), peer = byRef.get(direction === 'in' ? line.from : line.to);
      const steps = end?.steps ?? []; if (!end || !peer || !steps.length) continue;
      const peerName = nameOf(peer.ref), endName = nameOf(end.ref); if (!peerName || !endName) continue;
      const { stems, keys, stream } = partStems(ask, peer, peerName), store = peer.type === 'store';
      const stripped = plainName(peerName).replace(/\.(?:jsonl?|json|md|csv|gz)\b/g, '').replace(/\s+/g, ' ').trim();
      const own = store ? storeRows(ask, peerName, line.payload) : [];
      const rowNames = own.map(r => plainName(r.name)), rowStems = [...new Set([...stems, ...own.flatMap(r => stemOf(r.name) ?? [])])];
      const rowKeys = own.flatMap(r => /^[a-z][a-z0-9]*_(?:id|no)$/i.test(r.fields[0] ?? '') ? [r.fields[0]!.toLowerCase()] : []);
      const payloadTokens = (line.payload ?? '').toLowerCase().split(/[\s·,()（）「」[\]]+/).filter(t => /^[a-z][a-z0-9]*[._][a-z0-9_.]+$/.test(t) && t.length >= 6);
      const tiedBy = (s: { name: string; does?: string | null; uses?: readonly string[] }): boolean => {
        const uses = (s.uses ?? []).map(callOf), text = `${s.name} ${s.does ?? ''} ${(s.uses ?? []).join(' ')}`, name = plainName(s.name), words = stepWords(s), said = ` ${plainName(text)} `;
        const calls = words.flatMap(w => { const m = /^([a-z][a-z0-9_-]*?)[._]([a-z][a-z0-9]*)/.exec(w); return m ? [[m[1]!, m[2]!] as [string, string]] : []; });
        // A call the line's payload names on the other end's stem (「payon.refund」) ties only the step that names that very call.
        if (!store) { const named = payloadTokens.filter(t => stems.includes(t.split(/[._]/)[0]!)); return named.length ? named.some(t => said.includes(t)) : uses.some(u => stems.includes(u.split(/[.(]/)[0]!)); }
        const writes = WRITE_WORD.test(said) || calls.some(([, v]) => WRITE_VERB.test(v));
        if (direction === 'in') return uses.some(u => stems.some(x => [`row_${x}`, `${x}_read`, `${x}.read`, `${x}.get`].includes(u) || u === `row_${x.replace(/-/g, '_')}`)) || stems.some(x => name === `${x} 읽기`) || (stream && /\bXREADGROUP\b/.test(text))
          || calls.some(([stem, verb]) => rowStems.includes(stem) && !WRITE_VERB.test(verb) && (READ_VERB.test(verb) || !writes))
          || [...rowNames, ...rowStems].some(x => said.includes(`${x} 읽기`))
          || (!writes && rowKeys.some(k => words.includes(k)));
        return fileKeys(`${s.name} ${s.does ?? ''}`).some(k => keys.includes(k)) || (!!stripped && name === stripped) || (stream && /\bXADD\b/.test(text)) || uses.some(u => WRITE_CALL.test(u) && stems.includes(u.split(/[._]/)[0]!))
          || rowNames.some(x => name === x || name.startsWith(`${x}(`) || name.startsWith(`${x} (`))
          || calls.some(([stem, verb]) => rowStems.includes(stem) && WRITE_VERB.test(verb))
          || (writes && rowStems.some(x => words.includes(x) || words.some(w => w.startsWith(`${x}.`))))
          || payloadTokens.some(t => plainName(`${s.name} ${s.does ?? ''}`).includes(t));
      };
      let hits = steps.flatMap((s, i) => tiedBy(s) ? [i] : []);
      // The writer's 3절 chain: its last piece where the design row's 내는 산출물 names this store (alone, or the piece a bare write).
      const chainOut: string[] = [];
      if (store && direction === 'out' && !hits.length) {
        const chain = designChain(ask, endName), last = chain?.pieces.at(-1);
        const names = (x: string) => { const n = plainName(x); return fileKeys(x).some(k => keys.includes(k)) || n === plainName(peerName) || rowNames.includes(n) || (!!stripped && n === stripped); };
        if (chain && last) {
          const said = ` ${plainName(last)} `, outs = chain.outs.filter(names), bare = WRITE_WORD.test(said) || /(?:^|_)(?:append|insert|write|put)$/i.test(last.trim());
          const other = plainName(last).split(/[\s·,()]+/).some(w => /^[a-z][a-z0-9]*[._]/.test(w) && !/^row[._]/.test(w) && !rowStems.some(x => w.startsWith(x)) && (WRITE_WORD.test(said) || WRITE_VERB.test(w.split(/[._]/)[1] ?? '')));
          if (outs.length && (chain.outs.length === 1 || bare) && !other) {
            const piece = stepTail(last)?.name ?? last, at = steps.findIndex(s => plainName(s.name) === plainName(piece) || plainName(s.name) === plainName(last));
            if (at >= 0) hits = [at]; else chainOut.push(piece);
          }
        }
      }
      let port: string | null = null;
      if (hits.length === 1) {
        const list = [...new Set((direction === 'in' ? end.inputs : end.outputs) ?? [])], payload = plainName(line.payload ?? '');
        const from = plainName(nameOf(line.from)), to = plainName(nameOf(line.to)), held = store ? heldPlaces(ask, peerName) : new Set<string>(), me = plainName(endName);
        const tiers = [list.filter(x => plainName(x).length >= 2 && payload.includes(plainName(x))),
          list.filter(x => nameTokens(x).some(t => stems.includes(t)) || fileKeys(x).some(k => keys.includes(k))),
          list.filter(x => rows.some(r => plainName(r.name) === plainName(x) && ((r.makers.includes(from) && r.readers.includes(to))
            || (store && r.store && held.has(r.place) && (direction === 'in' ? r.readers : r.makers).includes(me)))))];
        let pool = list;
        for (const tier of tiers) { const inter = pool.filter(x => tier.includes(x)); if (inter.length === 1) { port = inter[0]!; break; } if (inter.length > 1) pool = inter; }
        if (port && (port.length > 40 || steps[hits[0]!]!.name.length > 40)) port = null;
      }
      if (hits.length || chainOut.length || store) out.push({ relation, direction, hits, chain: chainOut, port });
    }
  });
  return out;
}
/** Pipeline .39 (map-reading.14): for each data line with no row on that side (taken: the rows a reply already has), the one step of its
 * stepped end the records tie to the other end (portSides, .40), and the one input or output of that end naming the other end: of the
 * end's inputs (in) or outputs (out), the one named in the line's payload, else by the other end's stems or files, else an artifact row
 * the records make from the sender to the receiver (or that the store holds); none when that still leaves two. A port or step past 40
 * is none. */
export function programPortMap(ask: MapAsk, parts: readonly PortPart[], relations: readonly PortLine[], taken: readonly { relation: number; direction: string }[] = [], nameOf: (ref: string) => string = ref => parts.find(p => p.ref === ref)?.name ?? ''): ProgramPort[] {
  const byRef = new Map(parts.map(p => [p.ref, p]));
  return portSides(ask, parts, relations, nameOf).flatMap((side): ProgramPort[] => {
    if (side.hits.length !== 1 || !side.port || taken.some(m => m.relation === side.relation && m.direction === side.direction)) return [];
    const line = relations[side.relation]!, end = byRef.get(side.direction === 'in' ? line.to : line.from)!, step = end.steps![side.hits[0]!]!;
    return [{ relation: side.relation, port: side.port, step: step.name, stepIndex: side.hits[0]!, direction: side.direction }];
  });
}
/** Pipeline .39: a query or a response (조회·요청·응답·결과, a parenthesis after it allowed) handed over between an artifact row's maker and
 * reader, either way (the web record's 택배 추적 수집기 → 택배사 API 「택배사 조회」 against its 추적 응답 row): data, never control. */
const QUERY_WORD = /(?:조회|요청|응답|결과)(?:\s*\([^)]*\))?\s*$/;
export function carriesQuery(ask: MapAsk, from: string, to: string, payload: string | null): boolean {
  if (!payload || !QUERY_WORD.test(payload.trim())) return false;
  const a = plainName(from), b = plainName(to);
  return artifactRows(ask).some(r => (r.makers.includes(a) && r.readers.includes(b)) || (r.makers.includes(b) && r.readers.includes(a)));
}
/** Pipeline .39: a plan gated on live operation: a threshold (a number with a unit or a comparison) or an operating state word. */
export const RUN_GATE = /\d[\d,.]*\s*(?:USDT|USD|bp|%|건|원|GB|MB|틱)|\d[\d,.]*\s*(?:개|건|회|초|분|s|ms)?\s*(?:을|를|이|가|에)?\s*(?:넘|초과|이상|이하|미만|밑돌|웃돌)|[<>≥≤]\s*=?\s*[-−]?\d|만료|노출|잔고|손실|손익|실거래|재ARM|XLEN|큐\s*길이|스트림\s*길이|대기열|포지션|끄기\s*줄|결판|가동\s*중|멈춤/;
/** Pipeline .39 (map-blueprint.mjs, read here since .40): a condition row's 참이면 that refuses or denies: a 4xx status with a ROLE·REQUIRED·
 * FORBIDDEN code, a NOT_ code (STOP_NOT_RESIDENT, POSITION_NOT_FLAT), or 쉼·거부·차단. A feature-flag or state check (503 CHECKOUT_DISABLED,
 * 기다림) expects no code device. */
export const REFUSAL_OUTCOME = /\b4\d\d\b[^|]*?\b[A-Z0-9_]*(?:ROLE|REQUIRED|FORBIDDEN)[A-Z0-9_]*\b|\b[A-Z0-9_]*NOT_[A-Z0-9_]+\b|쉼|거부|차단/;
/** Pipeline .40: a loop unit naming a version-control or CI event (PR마다, 커밋마다, push마다, 병합 때): a trigger, never a repeat. */
export const VCS_EVENT = /(?:^|[^a-z])(?:pr|mr|pull\s*request|commit|push|merge|tag|release|deploy|build|ci)\s*(?:마다|때)|(?:커밋|푸시|병합|머지|배포|빌드|릴리스|태그)\s*(?:마다|때)/i;
/** Pipeline .40: the part types a loop may stand on (a gate, a store, a person, a session, an external system or a timer repeats nothing
 * of its own: a timer's schedule is its trigger). */
export const LOOP_TYPES: readonly PartType[] = Object.freeze(['loop', 'collector', 'compute', 'ai', 'actor']);
/** Pipeline .37: a condition's then or else naming a stop or quota code (QUOTA_REACHED, 멈춤, 중단), or a resume code (RESUME, 재개);
 * never a per-item end (events:dlq, 쉼) or a stop price (STOP_NOT_RESIDENT, STOP_MARKET). */
export const STOP_CODE = /\b[A-Z][A-Z0-9_]*(?:QUOTA|HALT|PAUSE)[A-Z0-9_]*\b|멈춤|멈춘다|중단/, RESUME_CODE = /\bRESUME[A-Z0-9_]*\b|재개/;
/** Pipeline .37: a record cell calling something kept state: 유지 상태, 카운터 (counter) or 키 as a word (「관리자 세션 키」, not 쿠키). */
const STATE_CALL = /유지\s*상태|카운터|(?:^|[^a-z])counter(?:$|[^a-z])|(?:^|[\s·(])키(?=$|[\s·),])/i;
/** Pipeline .37: the dotted variables a condition's when reads (「sess.issued_at」; quoted words and calls such as flags.isOn( left out). */
export const conditionVariables = (when: string): string[] => [...new Set(when.replace(/'[^']*'|"[^"]*"/g, ' ').match(/\b[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)+\b(?!\s*\()/g) ?? [])];
/** Pipeline .37: whether a record row naming the part (a cell's names) calls the variable kept state: a cell of it says 유지 상태,
 * 카운터 or 키 and one of its 「·」 items is the variable or its last name (「관리자 세션 키 | user_id·role·issued_at | 주문 API …」). */
function calledState(texts: Map<string, { text: string; spans: Span[] | null }>, part: string, variable: string): boolean {
  const own = plainName(part), whole = plainName(variable), leaf = plainName(variable.split('.').at(-1) ?? '');
  return [...texts.values()].some(({ text }) => tableRows(text).some(cells => cells.some(c => STATE_CALL.test(c)) && cells.some(c => cellNames(c).includes(own))
    && cells.some(c => splitOutside(c, '·,').map(plainName).some(x => x === whole || x === leaf))));
}
/** Pipeline .37: whether a record draws a connection table and none of the given aliases stands on a line a relation may stand on (a
 * connection, artifact, part-design or inner-step row, or an arrow line): a plan's relation item on such lines only is no recorded line
 * (drawn, it would be set aside as unrecorded). False when no record draws a connection table or no alias resolves. */
export function unrecordedAt(ask: MapAsk, aliases: readonly unknown[]): boolean {
  const texts = askRecords(ask), links = connectionLines(texts);
  if (!links.length) return false;
  const spans = aliases.flatMap(a => {
    if (typeof a !== 'string' || !a.includes('.')) return [];
    const record = a.slice(0, a.indexOf('.')), got = texts.get(record), r = got?.spans ? resolveRange(a, record, got.text, got.spans) : null;
    return r ? [{ record, from: r.from, to: r.to, text: got!.text.slice(r.from, r.to) }] : [];
  });
  if (!spans.length) return false;
  const rows = [...links, ...[ARTIFACT_TABLE_TS, DESIGN_TABLE, STEP_TABLE].flatMap(t => rowsUnder(texts, t))];
  return !spans.some(s => rows.some(l => l.record === s.record && s.from < l.to && l.from < s.to) || lineSenders(s.text).some(l => l.row === null));
}
/** Pipeline .38: the cells of a table line standing at [from, to) of text, each as written (its own white space left out) and where
 * it stands; the same cells as splitting the line on 「|」 once its outer pipes are left off. */
interface Cell { text: string; from: number; to: number }
function lineCells(text: string, from: number, to: number): Cell[] {
  const line = text.slice(from, to), out: Cell[] = [];
  let start = line.startsWith('|') ? 1 : 0;
  for (let i = start; i <= line.length; i++) {
    if (i < line.length && line[i] !== '|') continue;
    if (i === line.length && start >= line.length) break;
    const raw = line.slice(start, i), lead = raw.length - raw.trimStart().length, cell = raw.trim();
    out.push({ text: cell, from: from + start + lead, to: from + start + lead + cell.length });
    start = i + 1;
  }
  return out;
}
/** Pipeline .38: the data rows of every connection table (a header naming 보내는 부분 and 받는 부분), each with its 보내는 부분, 받는
 * 부분, 넘기는 것 and 언제·얼마나 자주 cells (null or '' where the table has none) and where the row stands. */
interface FlowRow { record: string; from: number; to: number; sender: string; receiver: string; payload: Cell | null; when: string }
function flowTable(texts: Map<string, { text: string; spans: Span[] | null }>): FlowRow[] {
  const out: FlowRow[] = [];
  for (const [record, { text }] of texts) {
    let at: { s: number; r: number; p: number; w: number } | false | null = null, offset = 0;
    for (const raw of text.split('\n')) {
      const start = offset; offset += raw.length + 1;
      const line = raw.trim();
      if (!line.startsWith('|')) { at = null; continue; }
      const from = start + raw.indexOf(line), cells = lineCells(text, from, from + line.length), words = cells.map(c => c.text);
      if (at === null) {
        const s = words.findIndex(c => /보내는\s*부분/.test(c)), r = words.findIndex(c => /받는\s*부분/.test(c));
        at = s >= 0 && r >= 0 ? { s, r, p: words.findIndex(c => /넘기는\s*것/.test(c)), w: words.findIndex(c => /언제|얼마나\s*자주/.test(c)) } : false;
        continue;
      }
      if (!at || words.every(c => !c || /^:?-{2,}:?$/.test(c))) continue;
      out.push({ record, from, to: from + line.length, sender: words[at.s] ?? '', receiver: words[at.r] ?? '', payload: at.p >= 0 ? cells[at.p] ?? null : null, when: at.w >= 0 ? words[at.w] ?? '' : '' });
    }
  }
  return out;
}
/** Pipeline .37: the connection-table rows whose 언제·얼마나 자주 cell says when (not blank, not a dash), where each stands.
 * Pipeline .38: with the row's sender and receiver cells (a line keeps that cadence only on its own row). */
function cadenceLines(texts: Map<string, { text: string; spans: Span[] | null }>): FlowRow[] {
  return flowTable(texts).filter(r => !!r.when && !/^[—–-]+$/.test(r.when));
}
/** Pipeline .38: whether a table cell names a part of this name (the whole cell, or one of its 「·」「,」「/」 names, loosely compared). */
const cellNamesPart = (cell: string, name: string): boolean => { const n = plainName(name); return !!n && (plainName(cell) === n || cellNames(cell).includes(n)); };
/** Pipeline .35: where the data rows of every connection table (a header naming 보내는 부분 and 받는 부분) stand, wherever it stands. */
function connectionLines(texts: Map<string, { text: string; spans: Span[] | null }>): { record: string; from: number; to: number }[] {
  const out: { record: string; from: number; to: number }[] = [];
  for (const [record, { text }] of texts) {
    let columns: boolean | null = null, offset = 0;
    for (const raw of text.split('\n')) {
      const start = offset; offset += raw.length + 1;
      const line = raw.trim();
      if (!line.startsWith('|')) { columns = null; continue; }
      const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
      if (columns === null) { columns = cells.some(c => /보내는\s*부분/.test(c)) && cells.some(c => /받는\s*부분/.test(c)); continue; }
      if (!columns || cells.every(c => !c || /^:?-{2,}:?$/.test(c))) continue;
      const from = start + raw.indexOf(line);
      out.push({ record, from, to: from + line.length });
    }
  }
  return out;
}
/** Pipeline .35: whether a place may stay stated: its line is the rule claim's own line (the two quotes meet), or the rule's line writes
 * one of the place row's cells (past its part cell, four characters or more, never a bracketed tag) word for word. */
const statedOn = (rule: MapReplyQuote, place: MapReplyQuote): boolean => {
  if (rule.record === place.record && rule.from !== undefined && rule.to !== undefined && place.from !== undefined && place.to !== undefined && rule.from < place.to && place.from < rule.to) return true;
  const said = plainName(rule.quote), row = tableRows(place.quote)[0];
  return (row && row.length > 1 ? row.slice(1) : [place.quote]).map(plainName).some(c => c.length >= 4 && !/^\[.*\]$/.test(c) && said.includes(c));
};
/** Pipeline .35: the places a reading took as inferred although the reply said stated (by part ref, claim key and the place's text). */
const DOWNGRADES = new WeakMap<MapReply, { ref: string; key: string | null; text: string }[]>();
export const anchorDowngrades = (reply: MapReply): readonly { ref: string; key: string | null; text: string }[] => DOWNGRADES.get(reply) ?? [];
/** Pipeline .40: the steps a reading kept whose name lost its parenthesised tail to does (by part ref, the name as written and as kept),
 * for the step-name diagnostic. */
const RENAMED = new WeakMap<MapReply, { ref: string; from: string; to: string }[]>();
export const stepRenames = (reply: MapReply): readonly { ref: string; from: string; to: string }[] => RENAMED.get(reply) ?? [];
/* Pipeline .34: content words, compared loosely: Latin runs of three letters or more and Hangul runs of two or more (a trailing
 * particle left off, twice at most, while two letters stay), a few function words left out, and a few fixed words read as one (a
 * Korean word as the Latin stem the records' code writes, a Latin word by the stem it starts with). */
const PARTICLES = ['으로', '에서', '까지', '부터', '이면', '인지', '이고', '에게', '은', '는', '이', '가', '을', '를', '의', '에', '로', '와', '과', '도', '만', '면'];
const STOP_WORDS = new Set(['not', 'and', 'the', 'for', 'with', 'true', 'false', 'none', 'null', 'then', 'else', 'from', 'into',
  '하나', '모든', '같은', '때만', '없음', '있음', '다음', '그대로', '또는', '이고', '그리고', '않음', '안함']);
// Pipeline .37: 환불, 소유자 and 세션 read as the code's refund, owner and sess(ion) (the web record's 「환불은 운영 담당자와 소유자만, 관리자
// 세션은 8 h 후 만료」 against 「action === 'refund' && !['ops','owner'].includes(sess.role)」).
const GLOSS: Readonly<Record<string, string>> = { 스탑: 'stop', 스톱: 'stop', 상주: 'resident', 크기: 'size', 방향: 'side', 동시: 'concurren', 상한: 'cap', 만료: 'expir',
  연장: 'extend', 게이트: 'gate', 관문: 'gate', 신호: 'signal', 진입: 'entry', 거래: 'trad', 제한: 'restrict', 금지: 'forbid', 계획: 'plan', 검사: 'check',
  환불: 'refund', 소유자: 'owner', 세션: 'sess' };
const STEMS = [...new Set(Object.values(GLOSS))];
const unparticled = (w: string): string => { for (let k = 0; k < 2; k++) { const p = PARTICLES.find(x => w.endsWith(x) && w.length - x.length >= 2); if (!p) break; w = w.slice(0, -p.length); } return w; };
export function contentWords(text: string): Set<string> {
  const out = new Set<string>();
  for (const w of text.normalize('NFC').toLowerCase().match(/[a-z0-9]+|[가-힣]+/g) ?? []) {
    if (/^[a-z0-9]+$/.test(w)) { if (w.length >= 3 && !STOP_WORDS.has(w)) out.add(STEMS.find(s => w.startsWith(s)) ?? w); continue; }
    const h = unparticled(w); if (h.length >= 2 && !STOP_WORDS.has(h) && !STOP_WORDS.has(w)) out.add(GLOSS[h] ?? h);
  }
  return out;
}
const sharedWords = (a: Set<string>, b: Set<string>): number => [...a].filter(w => b.has(w)).length;
/** A rule's own words: the claim's text and, when its line is a table row, that row's cells between its part cell and its last cell
 * (「지켜야 할 것」: the rule line, not who set it). */
const ruleWords = (text: string, quote: string): Set<string> => {
  const row = tableRows(quote)[0] ?? [];
  return contentWords([text, ...(row.length > 2 ? row.slice(1, -1) : row.slice(1))].join(' '));
};
/** Pipeline .40: the 「조건·거부·분기」 rows of other parts that a 「지켜야 할 것」 row of this part speaks of: a rule row naming the part (its
 * 부분 이름 cell) sharing at least two content words (contentWords) between its rule cells and the row's 조건 and 참이면 (the web record's
 * 관리자 화면 「환불은 운영 담당자·소유자만, 관리자 세션은 8 h 만료」 and the order API's refund 403 and session 401 rows), each once with the
 * part its 부분 이름 cell names (owner; the render input calls it from), in the record's order. The plan hands them to the rule's part as read-only references. */
const RULE_TABLE = /^지켜야\s*할/;
export function ruleConditionRows(ask: MapAsk, name: string): (ConditionRow & { owner: string })[] {
  const own = plainName(name); if (!own) return [];
  const rules = rowsUnder(askRecords(ask), RULE_TABLE).filter(r => cellNamesPart(r.cells[column(r.header, /부분/, 0)] ?? '', name));
  if (!rules.length) return [];
  const words = rules.map(r => { const at = column(r.header, /부분/, 0), rest = r.cells.filter((_, i) => i !== at); return contentWords((rest.length > 1 ? rest.slice(0, -1) : rest).join(' ')); });
  return conditionRows(ask).filter(row => !cellNamesPart(row.part, name) && words.some(w => sharedWords(w, contentWords(`${row.condition} ${row.then}`)) >= 2)).map(row => ({ ...row, owner: row.part }));
}
/** Pipeline .34: at most this many program places on one rule. */
export const PROGRAM_ANCHORS_MAX = 2;
/** Pipeline .34: a line saying the record does not know whether a device is code or an operational judgement (모름/추정 about it). */
const MECHANISM_UNKNOWN = (t: string): boolean => /모름|모른다|추정/.test(t) && ((/코드/.test(t) && /운영|판단|사람|수동/.test(t)) || /장치|집행/.test(t));
/** Pipeline .31: a clock time in a loop unit (a timer's schedule, never its loop). */
const CLOCK = /\d{1,2}:\d{2}Z?/;
/** Pipeline .36: a loop unit is a time or event unit: a number, a unit word or 마다·주기·폴링 (「없으면 다시 읽기」 is a resume sentence). */
export const LOOP_UNIT = /\d|마다|주기|폴링|매분|매초|매시|매일|tick|박자|\b(?:ms|sec|s|min|h)\b/i;
/** Pipeline .30: the words of each state as a record writes it, for a claim that only says its part's state again. */
const STATE_SAID: Record<PartState, RegExp> = { running: /돌고\s*있|가동\s*중/, working: /작업\s*중|진행\s*중/, unbuilt: /미구현|설계만/, stopped: /멈|정지/, retired: /폐기|삭제/, unknown: /모름|모른다|확인하지\s*못|알\s*수\s*없|미확인/ };
/** At most this many earlier matches go as priors, within PRIOR_BYTES (records keep the rest of MAP_BYTES). */
export const MAP_PRIORS = 24;
const PRIOR_BYTES = 12000;
/** The server reads at most this many bytes of a request (the studio routes share one limit). */
export const MAP_BYTES = 65536;
export const MAP_RECORDS = 4;
export const MAP_RECORD_CHARS = 12000;
const MIN_RECORD_CHARS = 1500, META_BYTES = 30000;
export const CLAIM_LABEL: Record<ClaimKind, string> = {
  // A report of work says what it says: it may say something was not built. Neither label reads as built.
  want: '원함', idea: '구상', reported: '작업 보고', checked: '확인 보고', describes: '설명', open: '남은 선택', differs: '다른 근거'
};
/** One short state for a part that has no request of its own yet, from what was read (never a verified status). */
export const STATE_LABEL: Partial<Record<ClaimKind, string>> = { reported: '작업 보고 있음', checked: '확인 보고 있음', want: '요구', idea: '구상', describes: '설명만 있음' };
/** The part's short state, saying when its current report took an earlier one back (the corrected report is read first). */
export const stateLabel = (u: Pick<PartUnderstanding, 'state' | 'revised'>): string | null => u.state ? (u.revised && (u.state === 'reported' || u.state === 'checked') ? '보고 정정됨' : STATE_LABEL[u.state] ?? null) : null;
const STATE_ORDER: ClaimKind[] = ['reported', 'checked', 'want', 'idea', 'describes'];
const RELS: RelationKind[] = ['flow', 'needs', 'shares', 'related'];

export interface MapAskPart { id: string; name: string; note: string; parentId: string | null; readAs: string | null; role: string; roleBy: 'reading' | 'person' | null; roleAbout: string | null; current: { key: string; kind: ClaimKind; text: string; about: string | null }[] }
/** text: studio.map.1–3. lead + spans: studio.map.4 (the same excerpt as span.2 pieces; never both). */
export interface MapAskRecord { id: string; kind: 'pasted' | RecordView['kind']; text?: string; lead?: string; spans?: SpanWire[]; note: string; basis: string; addedAt?: string }
/** studio.map.3: an earlier current match the records may explicitly take back, by alias (M01…), with what it said and the one
 * frozen item it answers. Material, never a new record. */
export interface MapAskPrior { key: string; quote: string; text: string; kind: MatchKind; stance: MatchStance | null; about: string | null; target: RequestTarget }
export interface MapAsk {
  schemaVersion: typeof MAP_SCHEMA | typeof MAP2_SCHEMA | typeof MAP3_SCHEMA | typeof MAP4_SCHEMA | typeof MAP5_SCHEMA | typeof MAP6_SCHEMA | typeof MAP7_SCHEMA;
  project: { name: string; purpose: string | null };
  parts: MapAskPart[];
  relations: { from: string; to: string; kind: RelationKind; note: string }[];
  records: MapAskRecord[];
  requests?: (RequestContext | FrozenRequest)[];
  priors?: MapAskPrior[];
}
/** from/to (studio.map.4): where the quote stands in the excerpt that was sent (UTF-16 code units of it). */
export interface MapReplyQuote { record: string; quote: string; from?: number; to?: number }
export interface MapReplyClaim { kind: ClaimKind; text: string; record: string; quote: string; from?: number; to?: number; about: string | null; replaces: string | null;
  /** map.6: the reply-local key of this statement ('s1'…), required and unique in the reply. */
  key?: string | null;
  /** map.6–7 (map-reading.7): always present in a checked reply (null when not said). */
  topic?: ClaimTopic | null; evidence?: EvidenceGrade | null; when?: string | null; where?: string | null; before?: string | null;
  /** map.6–7 (map-reading.10): always present in a checked reply (null / [] when not said); each anchor and device with where its
   * line stands (a device's quote null only for unknown). */
  scope?: RuleScope | null; scopeName?: string | null; anchors?: MapReplyAnchor[]; enforcedBy?: MapReplyEnforcer[]; withdrawalKind?: WithdrawalKind | null; gate?: GateKind | null }
/** map-reading.10: a place a rule applies with the quote of the line placing it; a device keeping it with the quote of its line.
 * map-reading.11: program is set by the validator's own pass only (a candidate it adds), never read from a reply. */
export interface MapReplyAnchor { kind: AnchorKind; text: string; quote: MapReplyQuote; program?: true }
/** map-reading.15: program is set by the validator's own pass only (a refusal row's code device), never read from a reply. */
export interface MapReplyEnforcer { kind: EnforcerKind; text: string; quote: MapReplyQuote | null; program?: true }
/** map.6: the undecided statement a candidate keeps (attribution, holds), exact where it stands in the excerpt. */
export interface MapReplyStatement { key: string; kind: ClaimKind; text: string; about: string | null; record: string; quote: string; from: number; to: number }
export type MapReplyMatch = (RequestMatch | RequestMatch3) & { from?: number; to?: number };
/** studio.map.4: a range of the excerpt the reply read as material inside the record, not the project's own. */
export interface MapReplyMaterial { record: string; from: number; to: number; what: string }
export interface MapReplyPart { ref: string; name: string | null; parent: string | null; role: string | null; roleAbout: string | null; roleReplaces: MapReplyQuote | null; basis: MapReplyQuote[]; claims: MapReplyClaim[];
  /** map.6–7 (map-reading.7): always present in a checked reply (null / [] when not said); stateQuote is where stateAt stands. */
  state?: PartState | null; stateQuote?: MapReplyQuote | null; stateWhen?: string | null; files?: string[];
  /** map.6–7 (map-reading.8): the record's type word with where typeAt stands, and the part's interface, settings and fields. */
  type?: PartType | null; typeQuote?: MapReplyQuote | null; inputs?: string[]; outputs?: string[]; fields?: string[]; config?: string[];
  /** map.6–7 (map-reading.9): the part's steps (each with where its row stands), its loop and the state it keeps. */
  steps?: MapReplyStep[]; loop?: MapReplyLoop | null;
  /** map-reading.13: program is set by the validator's own pass only (a kept state a condition names), never read from a reply. */
  stateVars?: { name: string; scope: string | null; readBy: string[]; changedBy: string[]; program?: true }[];
  /** map.6–7 (map-reading.12): the part's condition rows, each with where its row stands ([] when not said). */
  conditions?: MapReplyCondition[];
  /** map.6–7 (map-reading.14): the part's 「파일 지도」 rows with their roles ([] when not said). */
  fileRoles?: MapReplyFileRole[] }
/** map-reading.12: a condition row of a part (the record's 「조건·거부·분기」 row): its condition, what follows when it holds and when it
 * does not (null: not said), with the quote of its row. */
export interface MapReplyCondition { when: string; then: string; else: string | null; quote: MapReplyQuote }
/** map-reading.9: a step of a part with the quote of its row; a loop with the quote of its line; a port-map row (relation: the index
 * of the relation among the checked reply's relations). */
export interface MapReplyStep { name: string; does: string | null; uses: string[]; quote: MapReplyQuote;
  /** map-reading.14: set by the validator's own pass only (a piece of the part's 3절 arrow chain), never read from a reply. */
  program?: true }
/** map-reading.14: a 「파일 지도」 row of a part: its path and its 역할 한 줄 as written, with the quote of the row. */
export interface MapReplyFileRole { path: string; role: string; quote: MapReplyQuote }
/** map-reading.13: program is set by the validator's own pass only (a unit from a cadence setting, a stop or resume from a condition),
 * never read from a reply. */
export interface MapReplyLoop { unit: string | null; stop: string | null; resume: string | null; quote: MapReplyQuote; program?: true }
export interface MapReplyPortMap { relation: number; port: string; step: string; direction: 'in' | 'out'; quote: MapReplyQuote;
  /** map-reading.14: set by the validator's own pass only (programPortMap), never read from a reply. */
  program?: true }
export interface MapReply {
  summary: string;
  parts: MapReplyPart[];
  /** span (studio.map.4): where the quote stands in the excerpt (from/to here are the two parts). */
  relations: { from: string; to: string; kind: RelationKind; note: string; record: string; quote: string; span?: { from: number; to: number };
    /** map.6–7 (map-reading.7): always present in a checked reply (null when not said). */
    payload?: string | null; cadence?: string | null; mode?: RelationMode | null;
    /** map.6–7 (map-reading.8): what the line carries (null when not said). */
    channel?: Channel | null;
    /** map.6–7 (map-reading.13): the fields of the format artifact the line carries ([] when not said). */
    payloadFields?: string[] }[];
  candidates: { text: string; parts: string[]; record: string | null; quote: string | null; at?: { from: number; to: number } | null; target?: CandidateTarget; statement?: MapReplyStatement | null }[];
  gaps: string[];
  matches?: MapReplyMatch[];
  material?: MapReplyMaterial[];
  /** map.6–7 (map-reading.8): the records' own basis time and target version as written (null when not said). */
  basisAt?: string | null; basisVersion?: string | null;
  /** map.6–7 (map-reading.9): the record's explicit line → port → step correspondences ([] when not said). */
  portMap?: MapReplyPortMap[];
}
/** The excerpt each record of a request stands for: its text, and its span.2 pieces when it was sent as pieces. */
const askTexts = new WeakMap<MapAsk, Map<string, { text: string; spans: Span[] | null }>>();
export function askRecords(ask: MapAsk): Map<string, { text: string; spans: Span[] | null }> {
  const hit = askTexts.get(ask); if (hit) return hit;
  const out = new Map<string, { text: string; spans: Span[] | null }>();
  for (const r of ask.records) {
    if (r.spans) { const d = decodeSpans(r.id, { lead: r.lead ?? '', spans: r.spans }); if (d) out.set(r.id, d); }
    else if (typeof r.text === 'string') out.set(r.id, { text: r.text, spans: null });
  }
  askTexts.set(ask, out); return out;
}

const KEY = /^s\d{1,3}$/, PART = /^P\d{2,3}$/, NEW = /^new:[a-z0-9_-]{1,24}$/, RECORD = /^[NR]\d{2,3}$/, CLAIM = /^C\d{2,3}$/, PRIOR = /^M\d{2}$/;
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const bytes = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;
/** Where a quote stands in a record, as the record's own text. Exactly (white space read loosely, as quoteAt); else, narrowly, when
 * the quote only leaves out the delimiters of paired Markdown strong emphasis ('**Error handling**', '__x__') that the record
 * really has: on one line, opening before a non-space and not after a word character, closing after a non-space and not before
 * one, outside fenced and inline code. Then the one place it matches with those delimiters set aside is returned as the record's
 * span with its marks. A single or unpaired '*' or '_' (a * b, *value, snake_case, 2 ** 3, a**b**c) is never set aside; two
 * places, changed characters or joined pieces give null. */
export function resolveQuote(text: string, quote: string): string | null {
  const q = quote.trim(); if (!q) return null;
  const at = quoteAt(text, q); if (at) return text.slice(at.at, at.at + at.length);
  const marks = (t: string): Set<number> => {
    const out = new Set<number>(); let pos = 0, fenced = false;
    for (const line of t.split('\n')) {
      if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; pos += line.length + 1; continue; }
      if (!fenced) {
        // Inline code keeps its characters: masked so no delimiter is found inside it.
        const masked = line.replace(/`[^`]*`/g, m => ' '.repeat(m.length));
        for (const m of masked.matchAll(/(\*\*|__)(?=\S)(.+?)(?<=\S)\1/g)) {
          const a = m.index!, b = a + m[0].length;
          if (/[\p{L}\p{N}]/u.test(masked[a - 1] ?? '') || /[\p{L}\p{N}]/u.test(masked[b] ?? '')) continue;
          for (const k of [a, a + 1, b - 2, b - 1]) out.add(pos + k);
        }
      }
      pos += line.length + 1;
    }
    return out;
  };
  const strip = (t: string) => { const drop = marks(t), keep: number[] = []; let plain = ''; for (let k = 0; k < t.length; k++) if (!drop.has(k)) { keep.push(k); plain += t[k]; } return { keep, plain }; };
  const { keep, plain } = strip(text), bare = strip(q).plain.trim(); if (!bare || plain === text) return null;
  const pattern = new RegExp(bare.split(/\s+/).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'), 'g');
  // Unique counts every start, overlapping ones too ('very very' in 'very very very' is two places).
  const found: RegExpExecArray[] = [];
  for (let m = pattern.exec(plain); m && found.length < 2; m = pattern.exec(plain)) { found.push(m); pattern.lastIndex = m.index + 1; }
  if (found.length !== 1) return null;
  const m = found[0]!, start = keep[m.index!]!, end = keep[m.index! + m[0].length - 1]! + 1;
  return text.slice(start, end);
}
const clean = (t: string) => t.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ');
const cut = (t: string, n: number) => { if (t.length <= n) return t; const c = t.charCodeAt(n - 1); return t.slice(0, c >= 0xd800 && c <= 0xdbff ? n - 1 : n); };
export const normName = (n: string) => n.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
function check(ok: unknown, code = 'INVALID_INPUT'): asserts ok { if (!ok) throw new Error(code); }
function obj(v: unknown, keys: string[], code?: string): asserts v is Record<string, unknown> {
  check(!!v && typeof v === 'object' && !Array.isArray(v), code);
  check(Object.keys(v as object).length === keys.length && keys.every(k => Object.hasOwn(v as object, k)), code);
}
function str(v: unknown, max: number, empty = false, code?: string): asserts v is string {
  check(typeof v === 'string' && v.length <= max && (empty || !!v.trim()) && !CONTROL.test(v), code);
}
function arr(v: unknown, max: number, code?: string): asserts v is unknown[] { check(Array.isArray(v) && v.length <= max, code); }

/** The whole request within MAP_BYTES of UTF-8 JSON; known aliases, parents and claim keys; nothing is clipped here. */
export function validateMapAsk(value: unknown): MapAsk {
  const version = !!value && typeof value === 'object' ? (value as { schemaVersion?: unknown }).schemaVersion : null;
  const four = version === MAP4_SCHEMA || version === MAP5_SCHEMA || version === MAP6_SCHEMA || version === MAP7_SCHEMA, three = four || version === MAP3_SCHEMA, two = three || version === MAP2_SCHEMA;
  obj(value, ['schemaVersion', 'project', 'parts', 'relations', 'records', ...(two ? ['requests'] : []), ...(three ? ['priors'] : [])]);
  if (value.schemaVersion !== MAP_SCHEMA && !two) throw new Error('UNSUPPORTED_VERSION');
  if (bytes(value) > MAP_BYTES) throw new Error('INPUT_TOO_LARGE');
  obj(value.project, ['name', 'purpose']); str(value.project.name, 120); if (value.project.purpose !== null) str(value.project.purpose, 2000);
  arr(value.parts, 200);
  const parts = new Set<string>(), claims = new Set<string>();
  for (const p of value.parts) {
    obj(p, ['id', 'name', 'note', 'parentId', 'readAs', 'role', 'roleBy', 'roleAbout', 'current']); check(typeof p.id === 'string' && PART.test(p.id) && !parts.has(p.id)); parts.add(p.id);
    str(p.name, 60); str(p.note, 2000, true); if (p.readAs !== null) str(p.readAs, 60); str(p.role, 300, true);
    check(p.roleBy === null ? p.role === '' : (p.roleBy === 'reading' || p.roleBy === 'person') && !!(p.role as string).trim());
    if (p.roleAbout !== null) { str(p.roleAbout, 80); check(p.roleBy === 'reading'); }
    arr(p.current, 8); for (const c of p.current) { obj(c, ['key', 'kind', 'text', 'about']); if (c.about !== null) str(c.about, 80); check(typeof c.key === 'string' && CLAIM.test(c.key) && !claims.has(c.key)); claims.add(c.key); check(CLAIM_KINDS.includes(c.kind as ClaimKind)); str(c.text, 240); }
  }
  for (const p of value.parts as MapAskPart[]) check(p.parentId === null || (parts.has(p.parentId) && p.parentId !== p.id));
  arr(value.relations, 400);
  for (const r of value.relations) { obj(r, ['from', 'to', 'kind', 'note']); check(parts.has(r.from as string) && parts.has(r.to as string) && r.from !== r.to && RELS.includes(r.kind as RelationKind)); str(r.note, 200, true); }
  arr(value.records, MAP_RECORDS); check(value.records.length > 0);
  const records = new Set<string>();
  for (const r of value.records) {
    const hasTime = !!r && typeof r === 'object' && Object.hasOwn(r, 'addedAt');
    obj(r, ['id', 'kind', ...(four ? ['lead', 'spans'] : ['text']), 'note', 'basis', ...(hasTime ? ['addedAt'] : [])]); check(typeof r.id === 'string' && RECORD.test(r.id) && !records.has(r.id)); records.add(r.id);
    check(['pasted', 'request', 'report', 'evidence', 'answer', 'decision'].includes(r.kind as string)); str(r.note, 600, true); str(r.basis, 300);
    if (!four) str(r.text, MAP_RECORD_CHARS);
    else {
      // The pieces are exactly what span.2 makes of the text they join into: no other boundary, alias or mark.
      str(r.lead, MAP_RECORD_CHARS, true); check(!(r.lead as string).trim()); arr(r.spans, SPANS_PER_RECORD); check(r.spans.length > 0);
      for (const x of r.spans) {
        check(!!x && typeof x === 'object' && !Array.isArray(x)); const keys = Object.keys(x as object);
        check(keys.includes('s') && keys.includes('t') && keys.every(k => ['s', 't', 'k', 'q', 'more'].includes(k)));
        str((x as SpanWire).t, MAP_RECORD_CHARS); check(typeof (x as SpanWire).s === 'string');
      }
      const d = decodeSpans(r.id as string, { lead: r.lead as string, spans: r.spans as SpanWire[] });
      check(!!d); str(d!.text, MAP_RECORD_CHARS);
    }
    if (hasTime) { str(r.addedAt, 30); check(Number.isFinite(Date.parse(r.addedAt)) && new Date(r.addedAt).toISOString() === r.addedAt); }
  }
  const requests: { id: string; items: { id: string }[] }[] = [];
  if (two) { arr(value.requests, 8); const ids = new Set<string>(); for (const r of value.requests) { const req = r && typeof r === 'object' && (r as { version?: unknown }).version === 'request-scope.1' ? validateFrozenRequest(r) : validateRequestContext(r); check(!ids.has(req.id)); ids.add(req.id); requests.push(req); } }
  if (three) {
    arr(value.priors, MAP_PRIORS); const keys = new Set<string>();
    for (const x of value.priors) {
      obj(x, ['key', 'quote', 'text', 'kind', 'stance', 'about', 'target']); check(typeof x.key === 'string' && PRIOR.test(x.key) && !keys.has(x.key)); keys.add(x.key);
      str(x.quote, four ? ANCHOR_QUOTE_MAX : 300); str(x.text, 240); check(['reported', 'checked', 'code', 'test', 'open'].includes(x.kind as string)); check(x.stance === null || MATCH_STANCES.includes(x.stance as MatchStance));
      if (x.about !== null) str(x.about, 200);
      obj(x.target, ['requestId', 'itemId']); check(hasTarget(requests, x.target as unknown as RequestTarget));
    }
  }
  // map.7 is a later reading's contract: a first map is asked with map.6.
  if (version === MAP7_SCHEMA) check(!firstAsk(value as unknown as MapAsk));
  return structuredClone(value as unknown as MapAsk);
}

/** Exact keys and bounds; every part, claim and relation rests on a quote found in what was sent; known aliases only; new parts
 * named and grounded, with parents among known or new parts and no cycle; nothing in the reply looks like a key. Containment is
 * all this checks: not that a reading is right. */
/** map.7: how many items a checked reply set aside (0 for one read whole, or not read here). */
const ASIDE = new WeakMap<MapReply, MapReplyError[]>();
const EXCLUSIONS = new WeakMap<MapReply, ReadingExclusion[]>();
export const setAside = (reply: MapReply): readonly MapReplyError[] => ASIDE.get(reply) ?? [];
/** Fixed user explanations: no rejected model text, unknown key or error target enters saved diagnostics. */
const exclusionExplanation = (e: MapReplyError): string => {
  const rules: Record<MapReplyError['rule'], string> = {
    'settled-and-open': '이미 진술한 내용을 미정으로 남긴 후보를 제외했어요.',
    'duplicate-target': '같은 대상을 반복한 후보를 제외했어요.',
    'duplicate-key': '같은 진술 키를 반복한 후보를 제외했어요.',
    'material-evidence': '채택한 근거와 겹치는 예제·자료 표시를 제외했어요.',
    reference: '이번에 보낸 부분이나 원문 구간을 찾을 수 없어 제외했어요.',
    length: '인용이 600자 한도를 넘어 제외했어요. 원래 구간을 잘라 쓰지 않았어요.',
    'source-kind': '이 근거 종류로 사용할 수 없는 기록이어서 제외했어요.',
    'condition-form': '조건을 원문 구간으로 지정하지 않아 제외했어요.',
    'condition-source': '자기 근거와 다른 기록의 조건이어서 제외했어요.',
    'condition-length': '조건 구간이 비어 있거나 길이 한도를 넘어 제외했어요.',
    contract: '항목의 형식이나 참조가 규칙에 맞지 않아 제외했어요.'
  };
  return e.rule === 'contract' && e.target === 'count' ? '허용 개수를 넘는 뒤쪽 항목들을 제외했어요.'
    : e.rule === 'contract' && e.target === 'parent-skipped' ? '참조한 새 부분이 제외되어 이 항목도 제외했어요.'
    // pipeline .29: a relation or a claim set aside by the program's own reading of the line it quotes.
    : e.rule === 'contract' && e.target === 'via-store' ? '파일을 넘기는 연결이 그 파일의 보관소 부분을 거치지 않아 제외했어요.'
    : e.rule === 'contract' && e.target === 'wrong-part' ? '다른 부분의 표 행을 인용한 주장이어서 이 부분에서 제외했어요.'
    : e.rule === 'contract' && e.target === 'sender' ? '원문 줄이 적은 보내는 쪽과 다르거나, 미구현·폐기된 부분이 설계에 없이 보내는 연결이어서 제외했어요.'
    // pipeline .31: one item of a part's list, or one used name of a step, is set aside alone (the list or the step stays).
    // pipeline .33: or an input or output repeating a store partner's field or cut short of another item.
    : e.rule === 'contract' && /^parts\[\d+\]\.(files|inputs|outputs|fields|config)\[\d+\]$/.test(e.path) ? '부분의 목록 칸에서 길이·빈 값 규칙에 맞지 않거나 짝 저장소의 필드·다른 항목의 앞부분을 되풀이한 항목 하나만 빼고 나머지 항목은 남겼어요.'
    : e.rule === 'contract' && /^parts\[\d+\]\.steps\[\d+\]\.uses\[\d+\]$/.test(e.path) ? '단계가 쓰는 이름 중 길이·빈 값 규칙에 맞지 않는 하나만 빼고 단계는 남겼어요.'
    // map-reading.9: a step, a kept state or a port-map row is set aside alone; a loop item is left null; pipeline .30: a restating claim.
    : e.rule === 'contract' && e.target === 'step' ?'부분 안의 단계가 규칙에 맞지 않거나 그 원문 행을 찾을 수 없어 그 단계만 제외했어요.'
    : e.rule === 'contract' && e.target === 'loop' ? '부분의 반복 단위·정지·재개 칸이 규칙에 맞지 않거나 원문 줄을 찾을 수 없어 그 칸만 비웠어요.'
    : e.rule === 'contract' && e.target === 'state-var' ? '부분이 유지하는 상태 항목이 규칙에 맞지 않아 그 항목만 제외했어요.'
    : e.rule === 'contract' && e.target === 'port-map' ? '바깥 연결과 안쪽 단계의 대응이 없는 연결·포트·단계를 가리키거나 원문 줄을 찾을 수 없어 그 대응만 제외했어요.'
    : e.rule === 'contract' && e.target === 'restate' ? '부분의 상태 칸·단계·역할 문장을 되풀이한 주장이어서 제외했어요. 기록의 실제 변화·오류·철회 행이 그 자리를 먼저 써요.'
    // pipeline .32: a part made of what a line hands over (no table row, no type, no line); the line keeps it as its payload.
    : e.rule === 'contract' && e.target === 'payload-part' ? '연결이 넘기는 것의 이름을 떼어 만든 부분이어서 제외했어요. 기록의 표에 그 이름의 행이 없고 유형도 연결도 없었어요.'
    // map-reading.10: a rule's scope, one place or one device, a withdrawal's kind and a gate's kind are left out alone, the claim stays.
    : e.rule === 'contract' && e.target === 'scope' ? '규칙의 적용 범위 칸이 규칙에 맞지 않아 범위와 그 이름 칸만 비우고 규칙은 남겼어요.'
    : e.rule === 'contract' && e.target === 'anchor' ? '규칙의 적용 위치 하나가 규칙에 맞지 않거나 원문 줄을 찾을 수 없어 그 위치만 빼고 규칙은 적용 위치 미해결로 남겼어요.'
    : e.rule === 'contract' && e.target === 'enforced-by' ? '규칙의 보장 장치 하나가 규칙에 맞지 않거나 원문 줄을 찾을 수 없어 그 장치만 빼고 규칙과 적용 위치는 남겼어요. 보장 위치는 미확인이에요.'
    : e.rule === 'contract' && e.target === 'withdrawal-kind' ? '철회의 성격(설계·구현·보고) 칸이 규칙에 맞지 않아 그 칸만 비우고 철회는 남겼어요.'
    : e.rule === 'contract' && e.target === 'gate' ? '관문의 종류(실행·개발) 칸이 규칙에 맞지 않아 그 칸만 비우고 주장은 남겼어요.'
    // map-reading.12: one condition row of a part; pipeline .36: a store part on a place another store part holds (with its lines), a
    // line no record row backs, the channel of a control line carrying an artifact.
    : e.rule === 'contract' && e.target === 'condition' ? '부분의 조건 행 하나가 규칙에 맞지 않거나 그 부분의 「조건·거부·분기」 행에서 찾을 수 없어 그 조건만 제외했어요.'
    : e.rule === 'contract' && e.target === 'store-dup' ? '같은 「있는 곳」을 이미 다른 저장소 부분이 맡고 있어 겹친 저장소 부분과 그 연결을 제외했어요. 다른 부분으로 다시 잇지 않았어요.'
    : e.rule === 'contract' && e.target === 'unrecorded' ? '기록의 연결 표·산출물·부분별 설계·안의 단계 행이나 화살표 줄이 아닌 줄에서 만든 연결이어서 제외했어요.'
    // pipeline .38: the channel alone is written null; the line stays.
    : e.rule === 'contract' && e.target === 'channel' && /^relations\[\d+\]\.channel$/.test(e.path) ? '연결이 나르는 것(채널) 칸이 규칙에 맞지 않거나, 산출물 표의 산출물을 나르는 연결이 control로 적혀 그 칸만 비우고 연결은 남겼어요.'
    // map-reading.13: a relation's format fields (the list or one field); pipeline .37: a cadence left out alone, a line read twice.
    : e.rule === 'contract' && e.target === 'payload-fields' ? '연결이 나르는 형식 산출물의 필드 칸이 규칙에 맞지 않거나 그 산출물 행의 필드가 아니어서 그 칸(또는 그 필드 하나)만 빼고 연결은 남겼어요.'
    : e.rule === 'contract' && e.target === 'cadence' && /^relations\[\d+\]\.cadence$/.test(e.path) ? '연결의 박자(언제·얼마나 자주) 칸이 규칙에 맞지 않거나, 연결 표 행이 적은 박자가 비어 있어 그 칸을 진단에 남겼어요.'
    : e.rule === 'contract' && e.target === 'dup-line' ? '같은 두 부분 사이에 같은 채널·같은 넘기는 것의 연결이 이미 있어 뒤의 겹친 연결을 제외했어요.'
    // map-reading.14: one file-map row of a part (or the list); pipeline .39: a claim another part's claim already quotes on the same range.
    : e.rule === 'contract' && e.target === 'file-role' ? '부분의 파일 역할 행이 규칙에 맞지 않거나 그 부분의 「파일 지도」 행에서 찾을 수 없어 그 행만(또는 그 목록만) 빼고 부분은 남겼어요.'
    : e.rule === 'contract' && e.target === 'dup-claim' ? '다른 부분의 주장이 같은 원문 구간을 이미 인용해, 그 구간이 풀어 주는 모름·철회 행이 있는 부분(없으면 표 행 첫 칸의 부분)에만 남기고 이 주장을 제외했어요.'
    // map-reading.7–8: a part's state, files, type or interface are left out, the part stays (any rule at that place: its stateAt or
    // typeAt may not resolve); the reply's basis time or version is left null alone.
    : PART_FIELD_GUARDS.has(e.rule === 'contract' ? e.target : '') || /^parts\[\d+\]\.(state|stateAt|stateWhen|files|type|typeAt|inputs|outputs|fields|config)$/.test(e.path) ? '부분의 상태·파일·유형·입출력 칸이 규칙에 맞지 않아 그 칸만 비우고 부분은 남겼어요.'
    : REPLY_FIELD_GUARDS.has(e.rule === 'contract' ? e.target : '') || /^basis(At|Version)$/.test(e.path) ? '정리의 기준 시각·판본 칸이 규칙에 맞지 않아 그 칸만 비웠어요.' : rules[e.rule];
};
/** Options of validateMapReply. setAside (studio.map.6 only; ignored for every other schema): the divided first-map pipeline on
 * the PC server reads one isolated bad item the way map.7 does (see below) instead of refusing the whole reply. Without it map.6
 * reads exactly as before; the browser and the single-call Worker path never pass it. owners (with setAside, pipeline .29): the
 * names of every part the divided reading planned, so a fragment read alone checks a quoted table row against the parts the other
 * fragments write, as the combined reply does. */
export interface MapReplyOptions { setAside?: boolean; owners?: readonly string[] }
/** At most this many set-aside reasons travel with a divided first map (a reply with more is refused whole on the server). */
export const DIVIDED_EXCLUSIONS_MAX = 64;
export function validateMapReply(value: unknown, ask: MapAsk, options: MapReplyOptions = {}): MapReply {
  const code = 'INVALID_RESPONSE', aside: MapReplyError[] = [];
  // divided (map.6 + setAside): an item of its own (a basis quote, a claim, a relation, a candidate, a gap, a material range, and
  // what runs past a count bound) that breaks a rule is set aside with its diagnostic, as in map.7. Unlike map.7 a part is never
  // set aside: a part breaking a rule of its own and a new part left without any basis quote still refuse the whole reply (pipeline
  // .34: a new part whose every claim was set aside stays, with no claim); so do contradictions (a candidate settling or repeating what is stated or left open),
  // a key-like word, the reply's shape and a reply with nothing left. Material the reply also quotes as evidence is set aside.
  const seven = ask.schemaVersion === MAP7_SCHEMA, divided = ask.schemaVersion === MAP6_SCHEMA && options?.setAside === true, lenient = seven || divided;
  const six = seven || ask.schemaVersion === MAP6_SCHEMA, five = six || ask.schemaVersion === MAP5_SCHEMA, four = five || ask.schemaVersion === MAP4_SCHEMA, three = four || ask.schemaVersion === MAP3_SCHEMA, two = three || ask.schemaVersion === MAP2_SCHEMA;
  // map.6–7: a list the reply left out names nothing (no relation, candidate, gap, match or material), as an empty one does. A real
  // reading on a PC left out material it had none of, and the whole map was refused for that alone. Every other key stays exact.
  if (six && value && typeof value === 'object' && !Array.isArray(value)) {
    const lists = ['relations', 'candidates', 'gaps', 'matches', 'material'].filter(k => !Object.hasOwn(value as object, k));
    if (lists.length) value = { ...value, ...Object.fromEntries(lists.map(k => [k, []])) };
  }
  // AF137: map.7's generic guards say where (a static path) and which (a fixed category) through MapReplyError, rule 'contract'.
  // Each is the same condition at the same place; map.1–6 go through check/obj/str/arr unchanged (a plain INVALID_RESPONSE).
  function need(ok: unknown, path: string, what: ContractGuard): asserts ok { if (!ok) throw lenient ? new MapReplyError(path, 'contract', what) : new Error(code); }
  // map.6–7: every key asked for must be there; a key not asked for is passed over (nothing is read from it, and the reply is
  // rebuilt from the asked keys alone, so it is never kept). A real reading on a PC was refused whole for one claim carrying a
  // misspelled extra key beside the right one. map.1–5 stay exact.
  function object(v: unknown, keys: string[], path: string): asserts v is Record<string, unknown> {
    if (!six) return obj(v, keys, code);
    const shaped = !!v && typeof v === 'object' && !Array.isArray(v), all = shaped && keys.every(k => Object.hasOwn(v as object, k));
    if (!lenient) return check(all, code);
    need(shaped, path, 'shape'); need(all, path, 'keys');
  }
  function field(v: unknown, max: number, empty: boolean, path: string): asserts v is string {
    if (!lenient) return str(v, max, empty, code);
    need(typeof v === 'string', path, 'shape'); need((v as string).length <= max && (empty || !!(v as string).trim()) && !CONTROL.test(v as string), path, 'text');
  }
  function list(v: unknown, max: number, path: string): asserts v is unknown[] { if (!lenient) return arr(v, max, code); need(Array.isArray(v), path, 'shape'); need((v as unknown[]).length <= max, path, 'count'); }
  // map-reading.7: an optional field of a claim, a part or a relation (map.6–7). Absent or null is not said; else words within the
  // bound (trimmed, never blank, no control character) or one of the fixed words, refused at its own path with its own category.
  const said = (o: Record<string, unknown>, k: string) => Object.hasOwn(o, k) && o[k] !== null && o[k] !== undefined;
  const phrase = (o: Record<string, unknown>, k: string, max: number, path: string, what: ContractGuard): string | null => {
    if (!said(o, k)) return null; const v = o[k];
    need(typeof v === 'string' && v.length <= max && !!v.trim() && !CONTROL.test(v), `${path}.${k}`, what); return (v as string).trim();
  };
  const oneOf = <T extends string>(o: Record<string, unknown>, k: string, fixed: readonly T[], path: string, what: ContractGuard): T | null => {
    if (!said(o, k)) return null; need(fixed.includes(o[k] as T), `${path}.${k}`, what); return o[k] as T;
  };
  object(value, ['summary', 'parts', 'relations', 'candidates', 'gaps', ...(two ? ['matches'] : []), ...(four ? ['material'] : [])], 'reply');
  const parts = new Map(ask.parts.map(p => [p.id, p])), records = new Map(ask.records.map(r => [r.id, r])), texts = askRecords(ask);
  const quote = (rec: unknown, q: unknown): MapReplyQuote => {
    check(typeof rec === 'string' && records.has(rec), code); str(q, 300, false, code);
    const t = (q as string).trim(), span = t.length >= 6 ? resolveQuote(texts.get(rec)!.text, t) : null;
    check(!!span && span.length <= 300, code);
    return { record: rec, quote: span! };
  };
  // map.4 keeps its two-piece/paragraph contract; map.5 allows any exact contiguous range within the evidence length bound.
  // map.6: a reference that resolves to nothing in this request is refused with where it stands (path) and what it said.
  // Never change a cited range to a different prefix: its supporting sentence may be at the end. An overlong quote is an item
  // exclusion, with the full original source position kept in the reading diagnostics.
  const cite = (v: unknown, path = ''): MapReplyQuote => {
    const bad = () => { throw six ? new MapReplyError(path, 'reference', typeof v === 'string' ? v.slice(0, 40) : String(v)) : new Error(code); };
    if (typeof v !== 'string') bad();
    const rec = /^([NR]\d{2,3})\./.exec(v as string)?.[1], got = rec ? texts.get(rec) : undefined;
    if (!got?.spans) bad();
    if (six) {
      const range = resolveRange(v as string, rec!, got!.text, got!.spans!);
      if (!range) bad();
      if (range!.to - range!.from > ANCHOR_QUOTE_MAX) throw new MapReplyError(path, 'length', (v as string).slice(0, 40));
    }
    const at = (five ? resolveEvidenceRange : resolveRef)(v as string, rec!, got!.text, got!.spans!);
    if (!at || at.quote.length > ANCHOR_QUOTE_MAX) bad();
    return { record: rec!, quote: at!.quote, from: at!.from, to: at!.to };
  };
  /** A quote too long to keep: what rests on it alone is left out of the reply rather than the reply refused. */
  const tooLong = (e: unknown) => six && e instanceof MapReplyError && e.rule === 'length';
  // map.7: a condition is a sent anchor (whole pieces of one record, as material is named) or null. It belongs to the records it may
  // come from (owners: the record of the item's own at, or a role's basis records), then is the record's exact passage with its
  // outer white space trimmed, within max. Never clipped, never turned into null. Its place stays for the material check.
  // A refusal names the path and an alias or record, never the words written: a non-anchor value is said as not-anchor.
  const ANCHOR = /^[NR]\d{2,3}\.\d{2,3}(?:-\d{2,3})?$/, conditions: [string, MapReplyQuote][] = [];
  const condition = (v: unknown, path: string, max: number, owners: Set<string>): MapReplyQuote | null => {
    if (v === null) return null;
    const alias = typeof v === 'string' && ANCHOR.test(v) ? v : null;
    if (!alias) throw new MapReplyError(path, 'reference', 'not-anchor');
    const rec = alias.slice(0, alias.indexOf('.')), got = texts.get(rec), at = got?.spans ? resolveRange(alias, rec, got.text, got.spans) : null;
    if (!at) throw new MapReplyError(path, 'reference', alias);
    if (!owners.has(rec)) throw new MapReplyError(path, 'condition-source', rec);
    const raw = got!.text.slice(at.from, at.to), words = raw.trim(), from = at.from + raw.indexOf(words);
    if (!words || words.length > max) throw new MapReplyError(path, 'condition-length', alias);
    const q = { record: rec, quote: words, from, to: from + words.length }; conditions.push([path, q]); return q;
  };
  /** map.7: the old about form, both forms, or no new key is refused by name (the key, never its value). */
  const form = (o: unknown, path: string, old: string) => {
    if (!seven || !o || typeof o !== 'object' || Array.isArray(o)) return;
    if (Object.hasOwn(o, old)) throw new MapReplyError(`${path}.${old}`, 'condition-form', old);
    if (!Object.hasOwn(o, `${old}At`)) throw new MapReplyError(`${path}.${old}At`, 'condition-form', `${old}At`);
  };
  // The evidence of an item, by its wire: a reference (map.4) or a record and a copied quote (map.1–3).
  const evidence = (o: Record<string, unknown>, path = ''): MapReplyQuote => four ? cite(o.at, path) : quote(o.record, o.quote);
  const evidenceKeys = four ? ['at'] : ['record', 'quote'];
  field(value.summary, 200, true, 'summary');
  // map.7 sets one item aside rather than the whole reply: a part, claim, basis quote, role, relation, candidate, gap, material
  // range or match that breaks a rule of its own is left out, with the refusal it would have been (path, rule, fixed category);
  // so is what runs past a count bound (the first ones are read) and what rests on a part set aside. Four readings in a row on a
  // real PC were refused whole for one such item each. What one reply cannot hold at once (contradictions), a key-like word, and
  // the reply's own shape still refuse it whole; so does a reply with nothing left. map.1–6 refuse as they did.
  const conditionOwners = new WeakMap<object, [string, MapReplyQuote][]>(), origins = new WeakMap<object, string>();
  const origin = <T extends object>(v: T, path: string): T => { origins.set(v, path); return v; };
  const soft = <T>(fn: () => T): T | null => {
    const start = conditions.length;
    try {
      const result = fn(), held = conditions.slice(start);
      if (result && typeof result === 'object') {
        conditionOwners.set(result, held);
        if (Array.isArray(result)) for (const item of result) if (item && typeof item === 'object') conditionOwners.set(item, held);
      }
      return result;
    } catch (e) {
      conditions.length = start;
      if (e instanceof MapReplyError && (lenient || tooLong(e) || six && e.rule === 'contract' && e.target === 'parent-skipped')) { if (!aside.includes(e)) aside.push(e); return null; }
      throw e;
    }
  };
  // divided: a part (and everything it holds as a whole) is read or the reply is refused; never set aside.
  const whole = <T>(fn: () => T): T | null => divided ? fn() : soft(fn);
  const many = (v: unknown, max: number, path: string): unknown[] => {
    if (!lenient) { list(v, max, path); return v as unknown[]; }
    need(Array.isArray(v), path, 'shape');
    if ((v as unknown[]).length > max) aside.push(new MapReplyError(path, 'contract', 'count'));
    return (v as unknown[]).slice(0, max);
  };
  let partList: Record<string, unknown>[];
  // pipeline .31: a first map (map.6) holds 36 parts; map.7 keeps 24.
  const partsMax = ask.schemaVersion === MAP6_SCHEMA ? MAP6_NEW_PARTS : 24;
  if (divided) { list(value.parts, partsMax, 'parts'); partList = value.parts as Record<string, unknown>[]; }
  else partList = many(value.parts, partsMax, 'parts') as Record<string, unknown>[];
  const refs = new Set<string>(), news = new Map<string, string | null>(), entries: [number, Record<string, unknown>][] = [];
  for (const [pi, p] of partList.entries()) {
    const ok = whole(() => {
      form(p, `parts[${pi}]`, 'roleAbout'); object(p, ['ref', 'name', 'parent', 'role', seven ? 'roleAboutAt' : 'roleAbout', 'roleReplaces', 'basis', 'claims'], `parts[${pi}]`);
      if (!(typeof p.ref === 'string' && (parts.has(p.ref) || NEW.test(p.ref)) && !refs.has(p.ref))) {
        // AF120 (map.7): the same refusal, said with where and a fixed category, never the ref itself.
        if (seven) throw new MapReplyError(`parts[${pi}].ref`, 'reference', typeof p.ref !== 'string' ? 'invalid-ref' : refs.has(p.ref) ? 'duplicate-part' : p.ref.startsWith('new:') ? 'invalid-new-key' : 'unknown-part');
        check(false, code);
      }
      // map.7: the first 12 new parts are read; one past them is set aside (with what rests on it).
      if (seven && NEW.test(p.ref as string) && news.size >= 12) throw new MapReplyError(`parts[${pi}]`, 'contract', 'new-count');
      return true;
    });
    if (!ok) continue;
    refs.add(p.ref as string); if (NEW.test(p.ref as string)) news.set(p.ref as string, p.parent as string | null);
    entries.push([pi, p]);
  }
  need(news.size <= (ask.schemaVersion === MAP6_SCHEMA ? MAP6_NEW_PARTS : 12), 'parts', 'new-count');
  // pipeline .29 (divided): every part name of this reading (and of the plan, for a fragment), for the table-row owner check.
  const partNames = new Set(divided ? [...(options.owners ?? []), ...entries.map(([, p]) => typeof p.name === 'string' ? p.name : '')].map(plainName).filter(Boolean) : []);
  // pipeline .30 (divided): the names the records' change, defect and withdrawal rows name, read once when first needed.
  let facts: Set<string> | undefined;
  // pipeline .34 (divided): the rows of the records' 「조건·거부·분기」 and 「파일 지도」 tables (null: no record draws one), and the
  // 「가장 자신 없는 것」 rows, read once when first needed.
  let codeRows: SectionRow[] | null | undefined, hedgeRows: SectionRow[] | undefined;
  // map-reading.12 (divided): the rows of the records' 「조건·거부·분기」 tables, read once when first needed (none: [] ).
  let condRows: SectionRow[] | undefined;
  // pipeline .37 (divided): the rows of the records' 「철회·변경」 tables, read once when first needed.
  let withdrawnRows: SectionRow[] | undefined;
  // pipeline .39 (divided): the records' 「파일 지도」 rows, read once when first needed.
  let fileRows: FileMapRow[] | undefined;
  const conditionLines = (): SectionRow[] => (condRows ??= rowsUnder(texts, CONDITION_TABLE));
  const codeLines = (): SectionRow[] | null => {
    if (codeRows === undefined) { const rows = [...rowsUnder(texts, CONDITION_TABLE), ...rowsUnder(texts, FILE_TABLE)]; codeRows = rows.length ? rows : null; }
    return codeRows;
  };
  // pipeline .35: each claim's raw index (a claim set aside after the parts are read names it) and the places read as inferred.
  const rawClaimAt = new Map<MapReplyClaim, number>(), loweredOf = new Map<MapReplyClaim, string[]>();
  // Pipeline .40: the steps whose name lost its parenthesised tail (stepTail), by part ref, the name as written and as kept.
  const renamed: { ref: string; from: string; to: string }[] = [];
  const part = (p: Record<string, unknown>, pi: number): MapReplyPart => {
    const ref = p.ref as string, fresh = news.has(ref);
    if (fresh) {
      field(p.name, 60, false, `parts[${pi}].name`);
      // map.7: where a new part goes is checked once every part is read (below), so one set aside takes the parts under it along.
      if (!seven) need(p.parent === null || (typeof p.parent === 'string' && (parts.has(p.parent) || (news.has(p.parent) && p.parent !== ref))), `parts[${pi}].parent`, 'parent');
      else need(p.parent === null || typeof p.parent === 'string', `parts[${pi}].parent`, 'parent');
    } else need(p.name === null && p.parent === null, `parts[${pi}]`, 'existing-name-parent');
    // The description and what it rests on; map.7 reads it after the quotes, so a description set aside leaves the part's claims.
    const describe = (basis: MapReplyQuote[]) => {
      if (p.role !== null) field(p.role, 300, false, `parts[${pi}].role`);
      if (!seven && p.roleAbout !== null) { check(p.role !== null, code); str(p.roleAbout, 80, false, code); }
      if (seven && p.role === null && p.roleAboutAt !== null) throw new MapReplyError(`parts[${pi}].roleAboutAt`, 'condition-source', 'role:null');
      // Replacing the current description needs the record's own words that it supersedes it: only for a part with a description
      // read from records (never a new part, never the person's own correction).
      let roleReplaces: MapReplyQuote | null = null;
      if (p.roleReplaces !== null) {
        need(p.role !== null, `parts[${pi}].roleReplaces`, 'role-required');
        let q: MapReplyQuote;
        if (four) q = cite(p.roleReplaces, `parts[${pi}].roleReplaces`); else { obj(p.roleReplaces, ['record', 'quote'], code); q = quote(p.roleReplaces.record, p.roleReplaces.quote); }
        // Nothing read to replace (a new part, a part without a read description, the person's own): the quote has no effect.
        roleReplaces = !fresh && parts.get(ref)?.roleBy === 'reading' ? q : null;
      }
      if (!basis) return { roleReplaces };
      need(p.role === null || basis.length > 0, `parts[${pi}].basis`, 'role-basis');
      // map.7: a role's condition is one record of its own basis (a mixed basis has no one condition for all its records).
      const roleAbout = seven ? condition(p.roleAboutAt, `parts[${pi}].roleAboutAt`, 80, new Set(basis.map(b => b.record)))?.quote ?? null : p.roleAbout === null ? null : (p.roleAbout as string).trim();
      return { roleReplaces, role: p.role === null ? null : (p.role as string).trim(), roleAbout };
    };
    const early = seven ? null : describe(null as unknown as MapReplyQuote[]);
    const basisList = many(p.basis, 4, `parts[${pi}].basis`); if (!seven) need(!fresh || basisList.length > 0, `parts[${pi}].basis`, 'basis-required');
    let long: unknown = null;
    const basis = basisList.flatMap((b, j) => {
      if (!four) { obj(b, ['record', 'quote'], code); return [quote(b.record, b.quote)]; }
      if (seven) { const q = soft(() => cite(b, `parts[${pi}].basis[${j}]`)); return q ? [q] : []; }
      // divided: any basis quote that resolves to nothing in this request or runs past the bound is set aside on its own.
      try { return [cite(b, `parts[${pi}].basis[${j}]`)]; } catch (e) { if (!tooLong(e) && !(divided && e instanceof MapReplyError)) throw e; long ??= e; aside.push(e as MapReplyError); return []; }
    });
    // A part keeps the basis quotes within bounds; one whose every quote was too long is refused as before (it would rest on none).
    // divided: a part left with no basis quote is refused with its first set-aside quote (the whole reply, as the part is whole).
    if (long && !basis.length) throw long;
    if (seven) need(!fresh || basis.length > 0, `parts[${pi}].basis`, 'basis-required');
    // map.6 (the first map's divided route) takes six claims per part and (.29) 32 relations, (.30) 48 (sixteen before): a record's
    // flow list and its running part's state did not fit four and twelve (the caps pushed out its main receiver's outputs and live defects).
    // pipeline .32: sixteen (MAP6_CLAIMS): a running part's own change, defect, withdrawal, rule and unknown rows did not fit six.
    // pipeline .33: twenty.
    const claimList = many(p.claims, ask.schemaVersion === MAP6_SCHEMA ? MAP6_CLAIMS : 4, `parts[${pi}].claims`);
    const own = new Set(parts.get(ref)?.current.map(c => c.key) ?? []);
    const claimAt = new Map<MapReplyClaim, number>();
    let claims = claimList.map((c, j): MapReplyClaim | null => { const got = soft((): MapReplyClaim | null => {
      form(c, `parts[${pi}].claims[${j}]`, 'about');
      object(c, ['kind', 'text', ...evidenceKeys, seven ? 'aboutAt' : 'about', 'replaces', ...(six ? ['key'] : [])], `parts[${pi}].claims[${j}]`);
      need(CLAIM_KINDS.includes(c.kind as ClaimKind), `parts[${pi}].claims[${j}].kind`, 'kind'); field(c.text, 240, false, `parts[${pi}].claims[${j}].text`);
      // A claim whose quote runs past the bound is left out (its condition with it); the rest of the reply is read as it is.
      let q: MapReplyQuote;
      try { q = evidence(c, `parts[${pi}].claims[${j}].at`); } catch (e) { if (tooLong(e) && !seven) { aside.push(e as MapReplyError); return null; } throw e; }
      // pipeline .29 (divided): a claim quoting a table row whose first cell names another part of this reading (no cell of that
      // row naming this part, and no quoted row of its own) is set aside: the row is that part's.
      if (divided && typeof p.name === 'string') {
        const own = plainName(p.name), rows = tableRows(q.quote).filter(c => c.length > 1);
        const other = rows.some(c => plainName(c[0]!) !== own && partNames.has(plainName(c[0]!)) && !c.slice(1).some(cell => cellNames(cell).includes(own)));
        need(!other || rows.some(c => plainName(c[0]!) === own), `parts[${pi}].claims[${j}]`, 'wrong-part');
      }
      if (!seven && c.about !== null) field(c.about, 80, false, `parts[${pi}].claims[${j}].about`);
      const about = seven ? condition(c.aboutAt, `parts[${pi}].claims[${j}].aboutAt`, 80, new Set([q.record]))?.quote ?? null : c.about === null ? null : (c.about as string).trim();
      need(c.replaces === null || (typeof c.replaces === 'string' && own.has(c.replaces)), `parts[${pi}].claims[${j}].replaces`, 'replaces');
      // map.6: every claim names its statement with a key unique in the reply (a statement settled under one key and left open
      // under another is not caught by this; it only makes the settled/open clash of one key checkable).
      if (six && !(typeof c.key === 'string' && KEY.test(c.key))) throw new MapReplyError(`parts[${pi}].claims[${j}].key`, 'reference', String(c.key));
      if (!six) return { kind: c.kind as ClaimKind, text: c.text.trim(), ...q, about, replaces: c.replaces as string | null };
      // map-reading.7: what the claim is about, its tag, when and where as written; the decision before only for a withdrawal.
      const at = `parts[${pi}].claims[${j}]`, topic = oneOf(c, 'topic', CLAIM_TOPICS, at, 'topic'), grade = oneOf(c, 'evidence', EVIDENCE_GRADES, at, 'evidence');
      const when = phrase(c, 'when', 40, at, 'when'), where = phrase(c, 'where', 120, at, 'where'), before = phrase(c, 'before', 120, at, 'before');
      need(before === null || topic === 'withdrawn', `${at}.before`, 'before');
      // map-reading.10: a rule's scope, the places it applies and what keeps it; a withdrawal's kind; a gate's kind. Each is the
      // claim's own and left out alone (the claim stays): in the lenient readings set aside with its fixed path and category (an
      // anchor or a device at its own index, whatever rule it broke there), a quote too long to keep set aside as it is; plain map.6
      // refuses. Their reasons join the reply's once the claim itself is read.
      const held: MapReplyError[] = [];
      const alone10 = <T>(fn: () => T, path: string, what: ContractGuard, none: T): T => {
        try { return fn(); } catch (e) {
          if (!(e instanceof MapReplyError)) throw e;
          if (lenient) { held.push(e.rule === 'contract' && e.path === path ? e : new MapReplyError(path, 'contract', what)); return none; }
          if (tooLong(e)) { held.push(e); return none; }
          throw e;
        }
      };
      const short = (v: unknown, max: number): string | null => typeof v === 'string' && v.length <= max && !!v.trim() && !CONTROL.test(v) ? v.trim() : null;
      const rule = topic === 'rule';
      // The scope is one of RULE_SCOPES on a rule; a step, port or field names itself (scopeName), a part or the project names none.
      const [scope, scopeName] = alone10((): [RuleScope | null, string | null] => {
        if (!said(c, 'scope')) { need(!said(c, 'scopeName'), `${at}.scope`, 'scope'); return [null, null]; }
        const sc = oneOf(c, 'scope', RULE_SCOPES, at, 'scope'), named = sc === 'step' || sc === 'port' || sc === 'field';
        need(rule, `${at}.scope`, 'scope');
        const name = said(c, 'scopeName') ? short(c.scopeName, 40) : null;
        need(named ? name !== null : !said(c, 'scopeName'), `${at}.scope`, 'scope');
        return [sc, name];
      }, `${at}.scope`, 'scope', [null, null]);
      // A place: stated or inferred, as written, on the line that places it (each once).
      const lowered: string[] = [];
      const anchors = alone10((): MapReplyAnchor[] => {
        if (!said(c, 'anchors')) return [];
        need(Array.isArray(c.anchors) && c.anchors.length <= 4 && (rule || !c.anchors.length), `${at}.anchors`, 'anchor');
        const out: MapReplyAnchor[] = [];
        (c.anchors as unknown[]).forEach((o, k) => {
          const path = `${at}.anchors[${k}]`;
          const got = alone10((): MapReplyAnchor | null => {
            const x = o as Record<string, unknown>;
            need(!!x && typeof x === 'object' && !Array.isArray(x) && ANCHOR_KINDS.includes(x.kind as AnchorKind), path, 'anchor');
            const text = short(x.text, 80); need(text !== null && said(x, 'at'), path, 'anchor');
            const quote = cite(x.at, `${path}.at`);
            need(!out.some(a => a.text === text && a.quote.record === quote.record && a.quote.from === quote.from && a.quote.to === quote.to), path, 'anchor');
            // pipeline .35: a stated place stands on the rule's own line or is written in it; any other is the reply's reading (inferred).
            const kind = x.kind === 'stated' && !statedOn(q, quote) ? 'inferred' : x.kind as AnchorKind;
            if (kind !== x.kind) lowered.push(text!);
            return { kind, text: text!, quote };
          }, path, 'anchor', null);
          if (got) out.push(got);
        });
        return out;
      }, `${at}.anchors`, 'anchor', []);
      // A device: code, a gate, a person (each on its line), none (기록상 미설계, on its line) or unknown (장치 미상, a line or none), each
      // kind and wording once. A none or unknown beside a device, or an unknown beside a none, says the opposite of it: left out.
      const rank = (k: EnforcerKind) => k === 'none' ? 1 : k === 'unknown' ? 0 : 2;
      const mechanismUnknown = (): boolean => {
        if (MECHANISM_UNKNOWN(q.quote)) return true;
        const own = plainName(typeof p.name === 'string' ? p.name : parts.get(ref)?.name ?? ''), words = ruleWords(c.text as string, q.quote);
        return !!own && (hedgeRows ??= rowsUnder(texts, HEDGE_TABLE)).some(r => {
          const at = column(r.header, /부분/, 0), rest = r.cells.filter((_, i) => i !== at).join(' ');
          return plainName(r.cells[at] ?? '') === own && MECHANISM_UNKNOWN(rest) && sharedWords(contentWords(rest), words) >= 2;
        });
      };
      const enforcedBy = alone10((): MapReplyEnforcer[] => {
        if (!said(c, 'enforcedBy')) return [];
        need(Array.isArray(c.enforcedBy) && c.enforcedBy.length <= 4 && (rule || !c.enforcedBy.length), `${at}.enforcedBy`, 'enforced-by');
        const out: [number, MapReplyEnforcer][] = [];
        (c.enforcedBy as unknown[]).forEach((o, k) => {
          const path = `${at}.enforcedBy[${k}]`;
          const got = alone10((): MapReplyEnforcer | null => {
            const x = o as Record<string, unknown>;
            need(!!x && typeof x === 'object' && !Array.isArray(x) && ENFORCER_KINDS.includes(x.kind as EnforcerKind), path, 'enforced-by');
            const kind = x.kind as EnforcerKind, text = short(x.text, 80); need(text !== null && (said(x, 'at') || kind === 'unknown'), path, 'enforced-by');
            const quote = said(x, 'at') ? cite(x.at, `${path}.at`) : null;
            need(!out.some(([, e]) => e.kind === kind && e.text === text), path, 'enforced-by');
            // pipeline .34 (divided): code stands on a condition row or a file-map row (when a record draws such a table); a person or
            // a gate is not the record's word where the record says it does not know whether the device is code or an operational
            // judgement (the rule's own line, or a hedge row of its part sharing two content words with it): unknown is.
            if (divided && kind === 'code' && quote) { const rows = codeLines(); need(!rows || rows.some(r => r.record === quote.record && r.from < quote.to! && quote.from! < r.to), path, 'enforced-by'); }
            if (divided && (kind === 'person' || kind === 'gate')) need(!mechanismUnknown(), path, 'enforced-by');
            return { kind, text: text!, quote };
          }, path, 'enforced-by', null);
          if (got) out.push([k, got]);
        });
        const top = Math.max(-1, ...out.map(([, e]) => rank(e.kind)));
        return out.filter(([k, e]) => {
          if (rank(e.kind) === 2 || rank(e.kind) === top) return true;
          const path = `${at}.enforcedBy[${k}]`; alone10(() => need(false, path, 'enforced-by'), path, 'enforced-by', null); return false;
        }).map(([, e]) => e);
      }, `${at}.enforcedBy`, 'enforced-by', []);
      // pipeline .37 (divided): the 철회·변경 row the withdrawal quotes: whether its 지금 cell (else its cells past the part cell) says
      // 폐기 or 철회, and whether the row names a kind word (폐기·철회·롤백·되돌림).
      const withdrawnRow = (): { design: boolean; named: boolean } | null => {
        if (q.from === undefined || q.to === undefined) return null;
        const row = (withdrawnRows ??= rowsUnder(texts, WITHDRAWN_TABLE)).find(r => r.record === q.record && r.from < q.to! && q.from! < r.to);
        if (!row) return null;
        const own = column(row.header, /부분/, 0), now = column(row.header, /지금/), rest = row.cells.filter((_, i) => i !== own).join(' | ');
        return { design: /(?:^|[\s,(·|])(?:폐기|철회)/.test(now >= 0 ? row.cells[now] ?? '' : rest), named: /폐기|철회|롤백|되돌/.test(rest) };
      };
      const withdrawalKind = alone10((): WithdrawalKind | null => {
        if (!said(c, 'withdrawalKind')) return null;
        const k = oneOf(c, 'withdrawalKind', WITHDRAWAL_KINDS, at, 'withdrawal-kind'); need(topic === 'withdrawn', `${at}.withdrawalKind`, 'withdrawal-kind');
        // pipeline .37 (divided): a withdrawal whose row's 지금 cell says 폐기 or 철회 took back a design decision (the .36 web map read the
        // payment polling's 「폐기, 웹훅만」 as implementation): another kind is left null alone.
        if (divided) need(k === 'design' || !withdrawnRow()?.design, `${at}.withdrawalKind`, 'withdrawal-kind');
        return k;
      }, `${at}.withdrawalKind`, 'withdrawal-kind', null);
      // pipeline .37 (divided): a withdrawal left without its kind where its row names one (폐기·철회·롤백·되돌림) is named on its row.
      if (divided && topic === 'withdrawn' && withdrawalKind === null && !held.some(e => e.path === `${at}.withdrawalKind`) && withdrawnRow()?.named) held.push(new MapReplyError(`${at}.withdrawalKind`, 'contract', 'withdrawal-kind'));
      const gate = alone10((): GateKind | null => {
        if (!said(c, 'gate')) return null;
        const g = oneOf(c, 'gate', GATE_KINDS, at, 'gate'); need(topic === 'plan', `${at}.gate`, 'gate');
        // pipeline .39 (divided): a run gate stands on live operation, a threshold or an operating state in the claim's words (the .38
        // web map read 「세 파일의 합계가 맞으면 대조를 주 1회로 줄인다」 as run a fifth time): another is left null alone.
        if (divided && g === 'run') need(RUN_GATE.test(c.text as string), `${at}.gate`, 'gate');
        return g;
      }, `${at}.gate`, 'gate', null);
      aside.push(...held);
      const read: MapReplyClaim = { kind: c.kind as ClaimKind, text: c.text.trim(), ...q, about, replaces: c.replaces as string | null, key: c.key as string | null, topic, evidence: grade, when, where, before,
        scope, scopeName, anchors, enforcedBy, withdrawalKind, gate };
      // pipeline .35: the places read as inferred (only those kept count).
      const kept = lowered.filter(x => anchors.some(a => a.text === x && a.kind === 'inferred'));
      if (kept.length) loweredOf.set(read, kept);
      return read;
    }); if (got) { claimAt.set(got, j); rawClaimAt.set(got, j); } return got; }).filter((x): x is MapReplyClaim => x !== null);
    // divided (pipeline .34): a new part whose every claim was set aside stays on its basis with no claim (each claim's reason is
    // kept); before .34 the reading was refused with the first of them, and a correction reply doing so ended the whole run (the
    // first .34 KORU run: 소유자's one claim quoted ARM's rule row, wrong-part). A render's first pass still refuses such a part
    // (validateRenderedFragment, strict) so its one correction may rewrite it; an existing part left with nothing still refuses.
    // map-reading.7: the state the record gives the part (with the span saying it and when) and the part's files. A wrong one is
    // left out alone, the part stays: set aside in the lenient readings (and a quote too long, as for a claim), else refused.
    let state: PartState | null = null, stateQuote: MapReplyQuote | null = null, stateWhen: string | null = null, files: string[] = [];
    let type: PartType | null = null, typeQuote: MapReplyQuote | null = null, inputs: string[] = [], outputs: string[] = [], fields: string[] = [], config: string[] = [];
    let steps: MapReplyStep[] = [], loop: MapReplyLoop | null = null, stateVars: NonNullable<MapReplyPart['stateVars']> = [], conditions: MapReplyCondition[] = [], fileRoles: MapReplyFileRole[] = [];
    if (six) {
      const at = `parts[${pi}]`;
      const alone = <T>(fn: () => T, none: T): T => { try { return fn(); } catch (e) { if (e instanceof MapReplyError && (lenient || tooLong(e))) { aside.push(e); return none; } throw e; } };
      [state, stateQuote] = alone((): [PartState | null, MapReplyQuote | null] => {
        if (!said(p, 'state')) { need(!said(p, 'stateAt'), `${at}.stateAt`, 'state-at'); return [null, null]; }
        const s = oneOf(p, 'state', PART_STATES, at, 'state'); need(said(p, 'stateAt'), `${at}.stateAt`, 'state-at');
        return [s, cite(p.stateAt, `${at}.stateAt`)];
      }, [null, null]);
      // A when of a state left out goes with it; one said without any state is refused on its own.
      stateWhen = said(p, 'state') && !state ? null : alone(() => { const w = phrase(p, 'stateWhen', 40, at, 'state-when'); need(w === null || state !== null, `${at}.stateWhen`, 'state-when'); return w; }, null);
      // A list of the record's own names (map-reading.7 files; map-reading.8 inputs, outputs, fields, config): bounded, trimmed,
      // each once in the order given; a wrong list is left out alone. Pipeline .31: an item too long, empty or with a control
      // character is set aside alone at its own index (parts[i].fields[j], the list's category) and the rest of the list is kept;
      // the list's own path stays for a list that is not one or runs past its bound (and, config, for a version in it).
      const names = (k: 'files' | 'inputs' | 'outputs' | 'fields' | 'config', max: number, len: number): string[] => alone(() => {
        if (!said(p, k)) return [];
        need(Array.isArray(p[k]) && (p[k] as unknown[]).length <= max, `${at}.${k}`, k);
        const out: string[] = [];
        for (const [j, f] of (p[k] as unknown[]).entries()) {
          const ok = typeof f === 'string' && f.length <= len && !!f.trim() && !CONTROL.test(f);
          if (!ok && lenient) { aside.push(new MapReplyError(`${at}.${k}[${j}]`, 'contract', k)); continue; }
          need(ok, `${at}.${k}[${j}]`, k);
          const s = (f as string).trim(); if (!out.includes(s)) out.push(s);
        }
        // pipeline .29: a version (sha, 판본, 명세 <hex>) is a claim's, never a setting; the list is left out as any wrong one is.
        if (k === 'config') need(!out.some(versionLike), `${at}.config`, 'config');
        return out;
      }, []);
      files = names('files', 6, 120);
      // map-reading.8: the record's own type word with the span saying it (a type without its line, or a line without a type, is
      // left out alone), and the part's interface, fields and settings.
      [type, typeQuote] = alone((): [PartType | null, MapReplyQuote | null] => {
        if (!said(p, 'type')) { need(!said(p, 'typeAt'), `${at}.typeAt`, 'type-at'); return [null, null]; }
        const t = oneOf(p, 'type', PART_TYPES, at, 'type'); need(said(p, 'typeAt'), `${at}.typeAt`, 'type-at');
        return [t, cite(p.typeAt, `${at}.typeAt`)];
      }, [null, null]);
      // map-reading.9: eight inputs and outputs, 24 fields and eight settings (map-reading.8 stored six, twelve and four).
      // Pipeline .31: a field item of 60 (40 before).
      inputs = names('inputs', PART_LIST_MAX.inputs, 60); outputs = names('outputs', PART_LIST_MAX.outputs, 60); fields = names('fields', PART_LIST_MAX.fields, FIELD_ITEM_MAX); config = names('config', PART_LIST_MAX.config, 80);
      // map-reading.9: a list of items each checked alone (steps, stateVars): a list that is not one or runs past its bound is left
      // out whole; an item that breaks a rule (or repeats a name) is set aside alone at its own index, with the list's category. A
      // step's row that does not resolve is the step's own fault (category step); one too long to keep is set aside as it is.
      const items = <T extends { name: string }>(k: 'steps' | 'stateVars', what: ContractGuard, read: (o: Record<string, unknown>, path: string) => T): T[] => alone(() => {
        if (!said(p, k)) return [];
        need(Array.isArray(p[k]) && (p[k] as unknown[]).length <= PART_LIST_MAX[k], `${at}.${k}`, what);
        const out: T[] = [];
        (p[k] as unknown[]).forEach((o, j) => {
          const path = `${at}.${k}[${j}]`;
          try {
            need(!!o && typeof o === 'object' && !Array.isArray(o), path, what);
            const got = read(o as Record<string, unknown>, path);
            need(!out.some(x => x.name === got.name), path, what); out.push(got);
          } catch (e) {
            if (!(e instanceof MapReplyError)) throw e;
            if (lenient) aside.push(e.rule === 'contract' && e.path === path ? e : new MapReplyError(path, 'contract', what));
            else if (tooLong(e)) aside.push(e); else throw e;
          }
        });
        return out;
      }, []);
      const words = (o: Record<string, unknown>, key: string, max: number, path: string, what: ContractGuard, required = false): string | null => {
        if (!said(o, key)) { need(!required, path, what); return null; }
        const v = o[key]; need(typeof v === 'string' && v.length <= max && !!v.trim() && !CONTROL.test(v), path, what); return (v as string).trim();
      };
      const wordList = (o: Record<string, unknown>, key: string, max: number, len: number, path: string, what: ContractGuard): string[] => {
        if (!said(o, key)) return [];
        const v = o[key]; need(Array.isArray(v) && v.length <= max, path, what);
        const out: string[] = [];
        for (const x of v as unknown[]) { need(typeof x === 'string' && x.length <= len && !!x.trim() && !CONTROL.test(x), path, what); if (!out.includes(x.trim())) out.push(x.trim()); }
        return out;
      };
      // A step is one row of the record's table of inner steps: its name, what it does, what it uses, and that row (at).
      // Pipeline .31: a used name too long, empty or with a control character is set aside alone (parts[i].steps[j].uses[k], category
      // step) once the step itself is read; the step keeps its other names. A uses that is not a list or runs past four still sets
      // the step aside.
      steps = items('steps', 'step', (o, path) => {
        const name = words(o, 'name', 40, path, 'step', true)!, does = words(o, 'does', 120, path, 'step'), held: MapReplyError[] = [], uses: string[] = [];
        if (said(o, 'uses')) {
          need(Array.isArray(o.uses) && o.uses.length <= 4, path, 'step');
          for (const [k, x] of (o.uses as unknown[]).entries()) {
            const ok = typeof x === 'string' && x.length <= 60 && !!x.trim() && !CONTROL.test(x);
            if (!ok && lenient) { held.push(new MapReplyError(`${path}.uses[${k}]`, 'contract', 'step')); continue; }
            need(ok, path, 'step');
            const s = (x as string).trim(); if (!uses.includes(s)) uses.push(s);
          }
        }
        need(said(o, 'at'), path, 'step');
        const quote = cite(o.at, `${path}.at`);
        aside.push(...held);
        // Pipeline .40: a name ending in a parenthesised tail (「plan 행(실패면 FALLBACK)」) where does is not said: the tail goes to does
        // and the name keeps the rest (a normalisation, named by the step-name diagnostic with the name as written; port-map rows naming
        // the written name follow it).
        const cut = does === null ? stepTail(name) : null;
        if (cut) renamed.push({ ref, from: name, to: cut.name });
        return { name: cut?.name ?? name, does: cut?.tail ?? does, uses, quote };
      });
      // The loop's unit, stop and resume are each the record's own claim: a wrong one is left null alone; with none said there is no
      // loop (its line is not read); a loop whose line does not resolve is left out whole.
      loop = alone((): MapReplyLoop | null => {
        if (!said(p, 'loop')) return null;
        const o = p.loop as Record<string, unknown>; need(!!o && typeof o === 'object' && !Array.isArray(o), `${at}.loop`, 'loop');
        // Pipeline .31: a timer's clock time (「매일 00:15Z」) is its schedule, not a loop: that loop is left out whole.
        need(!(type === 'timer' && typeof o.unit === 'string' && CLOCK.test(o.unit)), `${at}.loop`, 'loop');
        // Pipeline .36: a retired or unbuilt part does not repeat now (the .35 web map gave the retired payment polling 「5분마다」).
        need(state !== 'retired' && state !== 'unbuilt', `${at}.loop`, 'loop');
        // Pipeline .40: a part whose type repeats nothing of its own (a gate, a store, a person, a session, an external system, a timer:
        // LOOP_TYPES are loop, collector, compute, ai, actor) takes no loop; a part with no type word may.
        need(!type || LOOP_TYPES.includes(type), `${at}.loop`, 'loop');
        const one = (k: 'unit' | 'stop' | 'resume') => alone(() => phrase(o, k, 60, `${at}.loop`, 'loop'), null);
        let unit = one('unit');
        // Pipeline .31: a unit that repeats one of the part's own settings word for word (「j1_cadence 60 s」) is that setting, not
        // the record saying the part repeats: the unit alone is left null.
        if (unit !== null) { const u = unit; unit = alone(() => { need(!(Array.isArray(p.config) && p.config.some(c => typeof c === 'string' && c.trim() === u)), `${at}.loop.unit`, 'loop'); return u; }, null); }
        // Pipeline .36: a unit with no number, no unit word and no 마다·주기·폴링 is no unit (the .35 worker's 「없으면 다시 읽기」): left null.
        if (unit !== null) { const u = unit; unit = alone(() => { need(LOOP_UNIT.test(u), `${at}.loop.unit`, 'loop'); return u; }, null); }
        // Pipeline .40: a unit naming a version-control or CI event (the .39 web CI 관문's 「PR마다」) is its trigger, not a repeat: left null.
        if (unit !== null) { const u = unit; unit = alone(() => { need(!VCS_EVENT.test(u), `${at}.loop.unit`, 'loop'); return u; }, null); }
        const stop = one('stop'), resume = one('resume');
        if (unit === null && stop === null && resume === null) return null;
        need(said(o, 'at'), `${at}.loop`, 'loop');
        let quote: MapReplyQuote;
        try { quote = cite(o.at, `${at}.loop.at`); } catch (e) { if (e instanceof MapReplyError && lenient && !tooLong(e)) throw new MapReplyError(`${at}.loop`, 'contract', 'loop'); throw e; }
        return { unit, stop, resume, quote };
      }, null);
      // The state the part keeps: its name, where it holds, and who reads and changes it, as the record names them.
      stateVars = items('stateVars', 'state-var', (o, path) => ({ name: words(o, 'name', 40, path, 'state-var', true)!, scope: words(o, 'scope', 40, path, 'state-var'),
        readBy: wordList(o, 'readBy', 4, 40, path, 'state-var'), changedBy: wordList(o, 'changedBy', 4, 40, path, 'state-var') }));
      // map-reading.12: the part's condition rows ({ when 80, then 60, else 60 or null, at }), outside the claim cap. A list that is not
      // one or runs past 24 is left out whole; a row that breaks a rule or repeats a line is set aside alone (condition). Divided (when a
      // record draws a 「조건·거부·분기」 table): its line is one row of that table whose part cell names this part, and its when, then and
      // else stand in that row (loosely compared), else it is set aside alone.
      const own12 = plainName(typeof p.name === 'string' ? p.name : parts.get(ref)?.name ?? '');
      conditions = alone((): MapReplyCondition[] => {
        if (!said(p, 'conditions')) return [];
        need(Array.isArray(p.conditions) && (p.conditions as unknown[]).length <= PART_LIST_MAX.conditions, `${at}.conditions`, 'condition');
        const out: MapReplyCondition[] = [];
        (p.conditions as unknown[]).forEach((o, j) => {
          const path = `${at}.conditions[${j}]`;
          try {
            need(!!o && typeof o === 'object' && !Array.isArray(o), path, 'condition');
            const x = o as Record<string, unknown>;
            const when = words(x, 'when', 80, path, 'condition', true)!, then = words(x, 'then', 60, path, 'condition', true)!, otherwise = words(x, 'else', 60, path, 'condition');
            need(said(x, 'at'), path, 'condition');
            let quote: MapReplyQuote;
            try { quote = cite(x.at, `${path}.at`); } catch (e) { if (e instanceof MapReplyError && lenient && !tooLong(e)) throw new MapReplyError(path, 'contract', 'condition'); throw e; }
            need(!out.some(c => c.quote.record === quote.record && c.quote.from === quote.from && c.quote.to === quote.to), path, 'condition');
            if (divided) {
              const table = conditionLines(), hit = table.filter(r => r.record === quote.record && r.from < quote.to! && quote.from! < r.to);
              if (table.length) {
                const row = hit.length === 1 ? hit[0]! : null, text = row ? plainName(row.cells.join(' | ')) : '';
                need(!!row && plainName(row.cells[column(row.header, /부분/, 0)] ?? '') === own12 && [when, then, ...(otherwise === null ? [] : [otherwise])].every(w => text.includes(plainName(w))), path, 'condition');
              }
            }
            out.push({ when, then, else: otherwise, quote });
          } catch (e) {
            if (!(e instanceof MapReplyError)) throw e;
            if (lenient) aside.push(e.rule === 'contract' && e.path === path ? e : new MapReplyError(path, 'contract', 'condition'));
            else if (tooLong(e)) aside.push(e); else throw e;
          }
        });
        return out;
      }, []);
      // map-reading.14: the part's 「파일 지도」 rows ({ path 120, role 80, at }, up to twelve), each path once. A list that is not one or runs
      // past twelve is left out whole; a row that breaks a rule is set aside alone (file-role). Divided (when a record draws that table):
      // its line is one file-map row whose 속한 부분 cell names this part, and its path and role stand in that row's cells.
      const ownName14 = typeof p.name === 'string' ? p.name : parts.get(ref)?.name ?? '';
      fileRoles = alone((): MapReplyFileRole[] => {
        if (!said(p, 'fileRoles')) return [];
        need(Array.isArray(p.fileRoles) && (p.fileRoles as unknown[]).length <= PART_LIST_MAX.fileRoles, `${at}.fileRoles`, 'file-role');
        const out: MapReplyFileRole[] = [];
        (p.fileRoles as unknown[]).forEach((o, j) => {
          const path = `${at}.fileRoles[${j}]`;
          try {
            need(!!o && typeof o === 'object' && !Array.isArray(o), path, 'file-role');
            const x = o as Record<string, unknown>;
            const file = words(x, 'path', 120, path, 'file-role', true)!, role14 = words(x, 'role', 80, path, 'file-role', true)!;
            need(said(x, 'at'), path, 'file-role');
            let quote: MapReplyQuote;
            try { quote = cite(x.at, `${path}.at`); } catch (e) { if (e instanceof MapReplyError && lenient && !tooLong(e)) throw new MapReplyError(path, 'contract', 'file-role'); throw e; }
            need(!out.some(f => f.path === file), path, 'file-role');
            if (divided) {
              const table = (fileRows ??= fileMapRows(ask)), hit = table.filter(r => r.record === quote.record && r.from < quote.to! && quote.from! < r.to);
              if (table.length) {
                const row = hit.length === 1 ? hit[0]! : null;
                need(!!row && cellNamesPart(row.part, ownName14) && plainName(row.path).includes(plainName(file)) && plainName(row.role).includes(plainName(role14)), path, 'file-role');
              }
            }
            out.push({ path: file, role: role14, quote });
          } catch (e) {
            if (!(e instanceof MapReplyError)) throw e;
            if (lenient) aside.push(e.rule === 'contract' && e.path === path ? e : new MapReplyError(path, 'contract', 'file-role'));
            else if (tooLong(e)) aside.push(e); else throw e;
          }
        });
        return out;
      }, []);
      // map-reading.12 (divided): a claim quoting a condition row that a kept condition of this part stands on says that row again (the
      // .35 engine spent five of its twenty claims on condition rows): set aside (restate) at its own index.
      if (divided && conditions.length) {
        claims = claims.filter(c => {
          const again = c.from !== undefined && c.to !== undefined && conditions.some(k => k.quote.record === c.record && k.quote.from! < c.to! && c.from! < k.quote.to!);
          if (again) aside.push(new MapReplyError(`parts[${pi}].claims[${claimAt.get(c)}]`, 'contract', 'restate'));
          return !again;
        });
      }
      // pipeline .30 (divided): a status claim that cites the part's own state row and says that state again is set aside when the
      // records hold a change, defect or withdrawal row naming this part: those rows are what its claims are for (the part may end
      // up with no claim; it still stands on its basis).
      if (divided && state && stateQuote && typeof p.name === 'string' && (facts ??= factRowNames([...texts.values()].map(t => t.text))).has(plainName(p.name))) {
        const stateWords = STATE_SAID[state], sq = stateQuote;
        claims = claims.filter(c => {
          const again = c.topic === 'status' && c.record === sq.record && c.from === sq.from && c.to === sq.to && stateWords.test(c.text);
          if (again) aside.push(new MapReplyError(`parts[${pi}].claims[${claimAt.get(c)}]`, 'contract', 'restate'));
          return !again;
        });
      }
      // pipeline .33 (divided): a claim whose words stand inside one of this part's step does or its role sentence says again what
      // those already say (the .32 map had seven such claims of 87): set aside (restate) at its own index.
      if (divided) {
        const said33 = [...steps.map(x => x.does ?? ''), typeof p.role === 'string' ? p.role : ''].map(plainName).filter(Boolean);
        claims = claims.filter(c => {
          const words = plainName(c.text).replace(/[.。]$/, ''), again = !!words && said33.some(w => w.includes(words));
          if (again) aside.push(new MapReplyError(`parts[${pi}].claims[${claimAt.get(c)}]`, 'contract', 'restate'));
          return !again;
        });
      }
    }
    const role = seven ? soft(() => describe(basis)) ?? { roleReplaces: null, role: null, roleAbout: null } : describe(basis);
    // A description, new or changed, rests on its own quote: an existing part's role never comes in without one.
    need(fresh || role.role !== null || claims.length > 0, `parts[${pi}]`, 'empty-part');
    return { ref, name: fresh ? (p.name as string).trim() : null, parent: fresh ? p.parent as string | null : null, role: role.role ?? null,
      roleAbout: role.roleAbout ?? null, roleReplaces: (early ?? role).roleReplaces, basis, claims, ...(six ? { state, stateQuote, stateWhen, files, type, typeQuote, inputs, outputs, fields, config, steps, loop, stateVars, conditions, fileRoles } : {}) };
  };
  const built = entries.flatMap(([pi, p]): [number, MapReplyPart][] => { const b = whole(() => part(p, pi)); return b ? [[pi, b]] : []; });
  // New parts form a forest under known parts: no cycle among them.
  let placed = new Set(news.keys());
  if (!seven) for (const ref of news.keys()) { const seen = new Set<string>(); for (let x: string | null | undefined = ref; x && news.has(x); x = news.get(x)) { need(!seen.has(x), `parts[${partList.findIndex(p => p.ref === ref)}].parent`, 'parent-cycle'); seen.add(x); } }
  if (six) {
    // map.6–7: new parts stand only under actually surviving parents. map.6 may now exclude an overlong sole basis, so its
    // descendants must be diagnosed here as well; an absent parent must never leave them waiting in applyReading's queue.
    // map.6 retains its earlier whole-reply checks for an unknown parent or a cycle (above).
    const fresh = new Map(built.filter(([, b]) => news.has(b.ref)).map(([pi, b]) => [b.ref, { pi, parent: b.parent }]));
    placed = new Set<string>();
    for (let grew = true; grew;) { grew = false; for (const [ref, x] of fresh) if (!placed.has(ref) && (x.parent === null || x.parent !== ref && (parts.has(x.parent) || placed.has(x.parent)))) { placed.add(ref); grew = true; } }
    for (const [ref, x] of fresh) if (!placed.has(ref)) {
      const seen = new Set([ref]); let cycle = false;
      for (let y = x.parent; y !== null && fresh.has(y); y = fresh.get(y)!.parent) { if (seen.has(y)) { cycle = true; break; } seen.add(y); }
      const unplaced = new MapReplyError(`parts[${x.pi}].parent`, 'contract', cycle ? 'parent-cycle' : 'parent');
      // divided: unreachable (map.6 refuses an unknown parent or a cycle above and never sets a part aside); kept closed.
      if (divided) throw unplaced;
      aside.push(unplaced);
    }
  }
  const outParts = built.filter(([, b]) => !news.has(b.ref) || placed.has(b.ref)).map(([, b]) => b);
  const droppedParents = new Set([...news.keys()].filter(ref => !placed.has(ref)));
  const ends = new Set([...parts.keys(), ...placed]);
  // pipeline .29 (divided): the parts as read (their state, type and lists after their own fields were checked), by ref and by name.
  const byRef = new Map(outParts.map(b => [b.ref, b])), refByName = new Map(outParts.flatMap(b => b.name ? [[plainName(b.name), b.ref] as [string, string]] : []));
  // map-reading.9: where each relation of the wire stands among the relations read (a port-map row names it by its wire index).
  const relationAt = new Map<number, number>(); let relationsRead = 0;
  // pipeline .32 (divided): the files the records' artifact tables list, and those a store part of this reading holds.
  const tableFiles = divided ? artifactFiles([...texts.values()].map(t => t.text)) : null;
  const stored = new Set(divided ? outParts.filter(b => b.type === 'store').flatMap(storeKeys) : []);
  // pipeline .36 (divided): whether a record draws a connection table, and the rows a line may stand on (connection, artifact,
  // part-design and inner-step rows), read once when first needed.
  let flowRows: { table: boolean; rows: { record: string; from: number; to: number }[] } | undefined;
  const flowLines = () => flowRows ??= { table: connectionLines(texts).length > 0,
    rows: [...connectionLines(texts), ...[ARTIFACT_TABLE_TS, DESIGN_TABLE, STEP_TABLE].flatMap(t => rowsUnder(texts, t))].map(r => ({ record: r.record, from: r.from, to: r.to })) };
  // pipeline .37 (divided): the connection rows that say when (a 언제·얼마나 자주 cell), and the lines read so far (ends, channel, payload).
  let whenRows: FlowRow[] | undefined;
  const linesRead: { from: string; to: string; channel: Channel | null; payload: string }[] = [];
  const relations = many(value.relations, ask.schemaVersion === MAP6_SCHEMA ? MAP6_RELATIONS : 12, 'relations').flatMap((r, i) => { const got = soft(() => {
    object(r, ['from', 'to', 'kind', 'note', ...evidenceKeys], `relations[${i}]`);
    if (six && !seven && [r.from, r.to].some(ref => typeof ref === 'string' && droppedParents.has(ref))) throw new MapReplyError(`relations[${i}]`, 'contract', 'parent-skipped');
    need(typeof r.from === 'string' && typeof r.to === 'string' && ends.has(r.from) && ends.has(r.to) && r.from !== r.to, `relations[${i}]`, 'ends'); need(RELS.includes(r.kind as RelationKind), `relations[${i}].kind`, 'kind');
    field(r.note, 200, true, `relations[${i}].note`); const q = evidence(r, `relations[${i}].at`);
    // map-reading.7: what is handed over and how often, as written, and whether the record designed or saw it. map-reading.8: what
    // the line carries.
    // pipeline .37 (divided): what this line sets aside of its own fields once the line itself is read (a cadence, its format fields).
    const held7: MapReplyError[] = [];
    // pipeline .37 (divided): a wrong cadence word leaves the cadence out alone; the line stays.
    const cadence7 = (): string | null => {
      if (!divided) return phrase(r, 'cadence', 40, `relations[${i}]`, 'cadence');
      try { return phrase(r, 'cadence', 40, `relations[${i}]`, 'cadence'); } catch (e) { if (e instanceof MapReplyError) { held7.push(e); return null; } throw e; }
    };
    // map-reading.13: the fields of the format artifact the line carries (24 of 60): a list that is not one or runs past 24 is left out
    // alone, so is one wrong item (lenient readings); plain map.6 refuses.
    const fields13 = (): string[] => {
      if (!said(r, 'payloadFields')) return [];
      const path = `relations[${i}].payloadFields`;
      try { need(Array.isArray(r.payloadFields) && (r.payloadFields as unknown[]).length <= PART_LIST_MAX.payloadFields, path, 'payload-fields'); }
      catch (e) { if (e instanceof MapReplyError) { held7.push(e); return []; } throw e; }
      const out: string[] = [];
      for (const [j, x] of (r.payloadFields as unknown[]).entries()) {
        const ok = typeof x === 'string' && x.length <= FIELD_ITEM_MAX && !!x.trim() && !CONTROL.test(x);
        if (!ok && lenient) { held7.push(new MapReplyError(`${path}[${j}]`, 'contract', 'payload-fields')); continue; }
        need(ok, `${path}[${j}]`, 'payload-fields');
        const s = (x as string).trim(); if (!out.includes(s)) out.push(s);
      }
      return out;
    };
    // pipeline .38: a wrong channel word leaves the channel out alone in the lenient readings (relations[i].channel, channel); the line stays.
    const channel7 = (): Channel | null => {
      if (!lenient) return oneOf(r, 'channel', CHANNELS, `relations[${i}]`, 'channel');
      try { return oneOf(r, 'channel', CHANNELS, `relations[${i}]`, 'channel'); } catch (e) { if (e instanceof MapReplyError) { held7.push(e); return null; } throw e; }
    };
    const said7 = six ? { payload: phrase(r, 'payload', 80, `relations[${i}]`, 'payload'), cadence: cadence7(), mode: oneOf(r, 'mode', RELATION_MODES, `relations[${i}]`, 'mode'), channel: channel7(), payloadFields: fields13() } : {};
    // pipeline .29 (divided): a data line naming a file runs through that file's store part (one of its two ends); an unbuilt or
    // retired part sends only by design; when a quoted line names another part of this reading as its sender, the relation's
    // sender is that part, except where the line itself places this sender: a store row naming it in another cell (its producer),
    // a store's file on another part's row or before an arrow line's last arrow, or this sender's name before that last arrow.
    if (divided) {
      const s7 = said7 as { payload: string | null; mode: RelationMode | null; channel: Channel | null }, pair = [byRef.get(r.from as string), byRef.get(r.to as string)];
      // pipeline .32: when a record draws an artifact table, only a file it gives a row (or a store of this reading holds) asks its store.
      const files = (s7.channel === 'data' && s7.payload ? fileKeys(s7.payload) : []).filter(k => !tableFiles || tableFiles.has(k) || stored.has(k));
      need(files.every(k => pair.some(b => b?.type === 'store' && storeKeys(b).includes(k))), `relations[${i}]`, 'via-store');
      const sender = pair[0];
      need(!['unbuilt', 'retired'].includes(sender?.state ?? '') || s7.mode === 'design', `relations[${i}]`, 'sender');
      const own = plainName(sender?.name ?? ''), holds = (text: string) => sender?.type === 'store' && fileKeys(text).some(k => storeKeys(sender).includes(k));
      for (const line of lineSenders(q.quote)) {
        const x = refByName.get(line.name); if (!x || x === r.from) continue;
        // pipeline .30: the reader's own row (what it receives, 「달력·지난 24 h LEDGER」) places a store sending to it, whatever the
        // store's state (the .29 run refused 0층 달력 → 편집장 for the editor's own row and left the calendar with no line).
        if (x === r.to && line.row && sender?.type === 'store') continue;
        const placed = line.row ? (byRef.get(x)?.type === 'store' ? !!own && line.row.slice(1).some(cell => cellNames(cell).includes(own)) : holds(line.row.slice(1).join(' | ')))
          : holds(line.head) || (!!own && plainName(line.head).includes(own));
        need(placed, `relations[${i}]`, 'sender');
      }
      // pipeline .36: when a record draws a connection table, a line stands on a row of a connection, artifact, part-design or
      // inner-step table or on an arrow line; one on any other line (the .35 KORU owner → ARM on the owner's part row, 「잔고 입출금으로
      // 노출 조절」) is no line the records draw (unrecorded).
      const flow = flowLines();
      if (flow.table) need(flow.rows.some(l => q.record === l.record && q.from !== undefined && q.to !== undefined && q.from < l.to && l.from < q.to) || lineSenders(q.quote).some(l => l.row === null), `relations[${i}]`, 'unrecorded');
      // pipeline .36: a control line carrying an artifact of the artifact table (the .35 web map's payment session, webhook, invoice and
      // notification lines) is data by the record. Pipeline .38: only its channel is left out (relations[i].channel, channel, written
      // null) and the line stays, as a wrong channel word's does (the .37 web map lost 주문 API → 결제사 payon.refund, its only refund line).
      const nameOf = (ref: string) => byRef.get(ref)?.name ?? parts.get(ref)?.name ?? '';
      // pipeline .39: and a control line handing over a query or a response between an artifact row's maker and reader (the .38 web map's
      // 택배사 조회, control a fourth time).
      if (s7.channel === 'control' && (carriesArtifact(ask, nameOf(r.from as string), nameOf(r.to as string), s7.payload) || carriesQuery(ask, nameOf(r.from as string), nameOf(r.to as string), s7.payload))) { held7.push(new MapReplyError(`relations[${i}].channel`, 'contract', 'channel')); s7.channel = null; }
      // pipeline .37: a later line with the same ends, channel and payload as one read before is that line again (dup-line).
      const key = { from: r.from as string, to: r.to as string, channel: s7.channel, payload: plainName(s7.payload ?? '') };
      need(!linesRead.some(x => x.from === key.from && x.to === key.to && x.channel === key.channel && x.payload === key.payload), `relations[${i}]`, 'dup-line');
      // map-reading.13: format fields stand on a line carrying a format artifact row, each a field of such a row (else left out alone).
      const s13 = said7 as { payloadFields: string[] };
      if (s13.payloadFields.length) {
        const rows = formatRows(ask, nameOf(r.from as string), nameOf(r.to as string), s7.payload), known = new Set(rows.flatMap(x => x.fields).map(plainName));
        if (!rows.length) { held7.push(new MapReplyError(`relations[${i}].payloadFields`, 'contract', 'payload-fields')); s13.payloadFields = []; }
        else {
          const raw = Array.isArray(r.payloadFields) ? (r.payloadFields as unknown[]).map(x => typeof x === 'string' ? x.trim() : null) : [];
          s13.payloadFields = s13.payloadFields.filter(x => {
            if (known.has(plainName(x))) return true;
            raw.forEach((y, j) => { if (y === x) held7.push(new MapReplyError(`relations[${i}].payloadFields[${j}]`, 'contract', 'payload-fields')); });
            return false;
          });
        }
      }
      // pipeline .37: a line on a connection row that says when (언제·얼마나 자주) carries that cadence; with none it is named (the line stays).
      // pipeline .38: only on the line's own row: its sender is the row's 보내는 부분 and its receiver the row's 받는 부분 or a store (the
      // write line through the store carries the beat). A store → reader line split from a writer's row has the reader's own beat (the
      // .37 KORU state_rows → engine, policy_rows → engine, plan → card runner and review_rows → engine were named for a right null).
      const sc = said7 as { cadence: string | null }, toStore = byRef.get(r.to as string)?.type === 'store';
      if (sc.cadence === null && !held7.some(e => e.path === `relations[${i}].cadence`) && q.from !== undefined && q.to !== undefined
        && (whenRows ??= cadenceLines(texts)).some(l => l.record === q.record && q.from! < l.to && l.from < q.to!
          && cellNamesPart(l.sender, nameOf(r.from as string)) && (cellNamesPart(l.receiver, nameOf(r.to as string)) || toStore))) held7.push(new MapReplyError(`relations[${i}].cadence`, 'contract', 'cadence'));
      linesRead.push(key);
    }
    aside.push(...held7);
    return [{ from: r.from, to: r.to, kind: r.kind as RelationKind, note: r.note.trim(), record: q.record, quote: q.quote, ...(q.from !== undefined ? { span: { from: q.from, to: q.to! } } : {}), ...said7 }];
  }); if (got) relationAt.set(i, relationsRead++); return got ?? []; });
  // pipeline .33 (divided): an input or output of a part that is a field of one of its store partners (a store at the other end of one
  // of the lines read) or a bare prefix of another item of the same list (「review」 beside 「review 행」) is set aside alone at its raw
  // index (every raw copy of it), with the list's category; the port map below reads the lists as left.
  // pipeline .38: what an io item set aside was (≤60, as written) and the record cell it came from (the part's own design cell, else
  // a 넘기는 것 cell of a connection row it stands on), for its exclusion; never a secret-like value.
  const ioSource = new Map<MapReplyError, { value: string | null; place: { record: string; from: number; to: number } | null }>();
  if (divided) {
    const rawOf = new Map(entries.map(([pi, p]) => [p.ref as string, [pi, p] as const]));
    // pipeline .34: a name standing in the part's own 「부분별 설계」 cell (받는 산출물 for inputs, 내는 산출물 for outputs) is the record's
    // own item, kept even where a store partner's field repeats it (the .33 run set aside 카드 러너's 「counter」 of 「cards·counter·…」).
    const design = rowsUnder(texts, DESIGN_TABLE);
    // pipeline .38: the design cell with where it stands.
    const designPlace = (name: string, cell: RegExp): (Cell & { record: string }) | null => {
      const row = design.find(r => plainName(r.cells[column(r.header, /이름/, 0)] ?? '') === plainName(name)), at = row ? column(row.header, cell) : -1;
      const got = row && at >= 0 ? lineCells(texts.get(row.record)!.text, row.from, row.to)[at] : undefined;
      return got ? { ...got, record: row!.record } : null;
    };
    const designCell = (name: string, cell: RegExp): string => designPlace(name, cell)?.text ?? '';
    const flows = flowTable(texts);
    // pipeline .35: y names more than x does, x being y's first word(s) (a space or a dot after it): 「review」 of 「review 행」.
    const bare = (x: string, y: string): boolean => y.length > x.length && y.startsWith(x) && /^[\s.]/.test(y.slice(x.length));
    for (const b of outParts) {
      const raw = rawOf.get(b.ref); if (!raw || b.type === 'store') continue;
      const [pi, p] = raw;
      const partners = relations.flatMap(r => r.from === b.ref ? [r.to] : r.to === b.ref ? [r.from] : []).map(ref => byRef.get(ref)).filter(x => x?.type === 'store');
      const partnerFields = new Set(partners.flatMap(x => x!.fields ?? []).map(plainName));
      for (const k of ['inputs', 'outputs'] as const) {
        const list = b[k] ?? [], names = list.map(plainName), raw = designCell(b.name ?? parts.get(b.ref)?.name ?? '', k === 'inputs' ? /받는/ : /내는/), cell = plainName(raw);
        // pipeline .35: the cell's own items and the payload names of the part's lines in this direction, split the same way.
        const items = sharedItems(raw).map(plainName), payloads = relations.filter(r => (k === 'inputs' ? r.to : r.from) === b.ref && typeof r.payload === 'string')
          .flatMap(r => sharedItems(r.payload as string).map(plainName));
        // pipeline .38: an item standing as written in a record cell of this part (its design cell, or the 넘기는 것 cell of a connection
        // row it sends on for outputs, receives on for inputs) is the record's own and never a bare prefix: only a fragment the shared
        // noun lengthened (「전날 체결」 of 「전날 체결·마크 원자료」, 「review」 of 「review·policy·state 행」) or no such cell holds is checked.
        const own = b.name ?? parts.get(b.ref)?.name ?? '';
        const placed = designPlace(own, k === 'inputs' ? /받는/ : /내는/);
        const cells: { text: string; place: { record: string; from: number; to: number } }[] = [
          ...(placed ? [{ text: placed.text, place: { record: placed.record, from: placed.from, to: placed.to } }] : []),
          ...flows.filter(l => l.payload && cellNamesPart(k === 'inputs' ? l.receiver : l.sender, own)).map(l => ({ text: l.payload!.text, place: { record: l.record, from: l.payload!.from, to: l.payload!.to } }))];
        const standing = new Set<string>();
        for (const c of cells) {
          const plain = splitOutside(c.text, ',').flatMap(g => splitOutside(g, '·')).map(plainName), shared = sharedItems(c.text).map(plainName);
          plain.forEach((x, n) => { if (x === shared[n]) standing.add(x); });
        }
        const prefix = (x: string): boolean => !items.includes(x) && !standing.has(x) && [...items, ...payloads].some(y => bare(x, y));
        // pipeline .36: a bare item of the part's own cell with a unit noun the cell does not give it (「cards 행」 of 「cards·counter·
        // review 행·LEDGER」, the .35 card runner) is no name the record writes.
        const added = (x: string): boolean => !items.includes(x) && items.some(y => UNIT_NOUNS.some(n => x === `${y} ${n}`));
        const odd = new Set(list.filter((_, j) => (partnerFields.has(names[j]!) && !(cell && cell.includes(names[j]!))) || (!standing.has(names[j]!) && names.some((y, i) => i !== j && y.length > names[j]!.length && y.startsWith(names[j]!))) || prefix(names[j]!) || added(names[j]!)));
        if (!odd.size || !Array.isArray(p[k])) continue;
        (p[k] as unknown[]).forEach((x, j) => {
          if (typeof x !== 'string' || !odd.has(x.trim())) return;
          const e = new MapReplyError(`parts[${pi}].${k}[${j}]`, 'contract', k), v = x.trim(), at = cells.find(c => plainName(c.text).includes(plainName(v)))?.place ?? null;
          aside.push(e); ioSource.set(e, { value: v && v.length <= FIELD_ITEM_MAX && !CONTROL.test(v) && !secretLike(v) ? v : null, place: at });
        });
        b[k] = list.filter(x => !odd.has(x));
      }
    }
  }
  // pipeline .35 (divided): a status or how claim quoting a connection-table row (「보내는 부분 | 받는 부분」)
  // that a relation of this reply quotes too says the line again (the .34 map's s305): set aside (restate) at its raw index.
  if (divided) {
    const links = connectionLines(texts), lines = relations.flatMap(r => r.span ? [{ record: r.record, from: r.span.from, to: r.span.to }] : []);
    const meets = (a: { record: string; from?: number; to?: number }, b: { record: string; from: number; to: number }) => a.record === b.record && a.from !== undefined && a.to !== undefined && a.from < b.to && b.from < a.to;
    const piOf = new Map(built.map(([pi, b]) => [b, pi]));
    for (const b of outParts) b.claims = b.claims.filter(c => {
      const again = (c.topic === 'status' || c.topic === 'how') && links.some(l => meets(c, l) && lines.some(x => meets(x, l)));
      if (again) aside.push(new MapReplyError(`parts[${piOf.get(b)}].claims[${rawClaimAt.get(c)}]`, 'contract', 'restate'));
      return !again;
    });
    // pipeline .39 (divided): one range, one home. Claims of two parts or more quoting the very same range are one statement: it stays
    // on the part holding a 모르는 것·철회·가장 자신 없는 것 row it resolves (three content words of the range shared with the row's cells past its
    // part cell; the KORU N01.01 「git show로 라이브 sha를 읽음」 resolves the engine's 「race_rung.py 실제 코드」 row), else on the part the
    // quoted table row's first cell names; the others are set aside (dup-claim). Neither or both found: every copy stays.
    const resolvable = rowsUnder(texts, /모르는\s*것|철회|가장\s*자신\s*없는/);
    const same = new Map<string, { b: MapReplyPart; c: MapReplyClaim }[]>();
    for (const b of outParts) for (const c of b.claims) if (c.from !== undefined && c.to !== undefined) {
      const k = `${c.record}:${c.from}:${c.to}`; same.set(k, [...same.get(k) ?? [], { b, c }]);
    }
    const ownOf = (b: MapReplyPart) => plainName(b.name ?? parts.get(b.ref)?.name ?? '');
    const dup = new Set<MapReplyClaim>();
    // Two claims of one range say the same when their words mostly meet (half the smaller one's content words, two at least): a
    // multi-cell row (the KORU 0. 기준 row) holds several statements, one per part.
    const alike = (a: MapReplyClaim, b: MapReplyClaim) => { const x = contentWords(a.text), y = contentWords(b.text); return sharedWords(x, y) >= Math.max(2, Math.ceil(Math.min(x.size, y.size) / 2)); };
    for (const list of same.values()) {
      if (new Set(list.map(x => x.b)).size < 2) continue;
      const head = list[0]!.c, words = contentWords(head.quote);
      const resolves = (b: MapReplyPart) => resolvable.some(r => {
        const at = column(r.header, /부분/, 0);
        return plainName(r.cells[at] ?? '') === ownOf(b) && !(r.record === head.record && r.from < head.to! && head.from! < r.to) && sharedWords(contentWords(r.cells.filter((_, i) => i !== at).join(' ')), words) >= 3;
      });
      const first = plainName(tableRows(head.quote)[0]?.[0] ?? '');
      list.forEach((x, i) => list.slice(i + 1).forEach(y => {
        if (x.b === y.b || dup.has(x.c) || dup.has(y.c) || !alike(x.c, y.c)) return;
        const rx = resolves(x.b), ry = resolves(y.b), nx = !!first && ownOf(x.b) === first, ny = !!first && ownOf(y.b) === first;
        const keepX = rx !== ry ? rx : nx !== ny ? nx : null;
        if (keepX !== null) dup.add(keepX ? y.c : x.c);
      }));
    }
    if (dup.size) for (const b of outParts) b.claims = b.claims.filter(c => {
      if (!dup.has(c)) return true;
      aside.push(new MapReplyError(`parts[${piOf.get(b)}].claims[${rawClaimAt.get(c)}]`, 'contract', 'dup-claim')); return false;
    });
  }
  // map-reading.9: the record's explicit correspondences of a line (its index among the wire's relations, one that was read) to a
  // port of the part at that end (in: the receiver's input, out: the sender's output) and a step of that part, on the line that says
  // so. A row naming no such relation, port or step, or repeating one, is set aside alone; a list that is not one or runs past
  // twelve is left out whole. The relation is kept as its index among the relations read.
  let portMap: MapReplyPortMap[] = [];
  if (six && said(value as Record<string, unknown>, 'portMap')) {
    const rows = (value as Record<string, unknown>).portMap;
    try {
      need(Array.isArray(rows) && rows.length <= PART_LIST_MAX.portMap, 'portMap', 'port-map');
      (rows as unknown[]).forEach((o, k) => {
        const path = `portMap[${k}]`;
        try {
          need(!!o && typeof o === 'object' && !Array.isArray(o), path, 'port-map');
          const row = o as Record<string, unknown>, index = Number.isSafeInteger(row.relation) ? relationAt.get(row.relation as number) : undefined;
          need(index !== undefined && (row.direction === 'in' || row.direction === 'out'), path, 'port-map');
          const line = relations[index!]!, end = byRef.get(row.direction === 'in' ? line.to : line.from);
          const word = (v: unknown) => typeof v === 'string' && v.length <= 40 && !!v.trim() && !CONTROL.test(v) ? v.trim() : null;
          const port = word(row.port), written = word(row.step), step = written === null ? null : renamed.find(x => x.ref === end?.ref && x.from === written)?.to ?? written;
          need(!!end && port !== null && step !== null && (row.direction === 'in' ? end.inputs ?? [] : end.outputs ?? []).includes(port) && (end.steps ?? []).some(s => s.name === step), path, 'port-map');
          need(!portMap.some(m => m.relation === index && m.port === port && m.step === step && m.direction === row.direction), path, 'port-map');
          need(said(row, 'at'), path, 'port-map');
          let quote: MapReplyQuote;
          try { quote = cite(row.at, `${path}.at`); } catch (e) { if (e instanceof MapReplyError && lenient && !tooLong(e)) throw new MapReplyError(path, 'contract', 'port-map'); throw e; }
          portMap.push({ relation: index!, port: port!, step: step!, direction: row.direction as 'in' | 'out', quote });
        } catch (e) { if (e instanceof MapReplyError && (lenient || tooLong(e))) aside.push(e); else throw e; }
      });
    } catch (e) { if (e instanceof MapReplyError && lenient) { aside.push(e); portMap = []; } else throw e; }
  }
  let candidates = many(value.candidates, 6, 'candidates').flatMap((c, i): MapReply['candidates'] => soft((): MapReply['candidates'] => {
    object(c, ['text', 'parts', ...evidenceKeys, ...(six ? ['target', 'statement'] : [])], `candidates[${i}]`); field(c.text, 240, false, `candidates[${i}].text`);
    // A candidate names known parts or parts this same reply adds (new:...); nothing else.
    list(c.parts, 2, `candidates[${i}].parts`);
    if (six && !seven && c.parts.some(ref => typeof ref === 'string' && droppedParents.has(ref))) throw new MapReplyError(`candidates[${i}].parts`, 'contract', 'parent-skipped');
    for (const x of c.parts) if (!(typeof x === 'string' && ends.has(x))) { if (six) throw new MapReplyError(`candidates[${i}].parts`, 'reference', String(x).slice(0, 40)); check(false, code); }
    need(new Set(c.parts).size === c.parts.length, `candidates[${i}].parts`, 'duplicate');
    if (six) {
      // What it leaves undecided, and only that: a statement's part (attribution: 1–2 alternatives), two parts being one
      // (identity), a part inside a parent (parent: the part, then the parent), a statement holding for a part (holds).
      const target = c.target as CandidateTarget, n = (c.parts as unknown[]).length;
      if (!['attribution', 'identity', 'parent', 'holds'].includes(target as string)) throw new MapReplyError(`candidates[${i}].target`, 'reference', String(c.target));
      if (!(target === 'attribution' ? n >= 1 : target === 'holds' ? n === 1 : n === 2)) throw new MapReplyError(`candidates[${i}].parts`, 'reference', target);
      let statement: MapReplyStatement | null = null;
      if (target === 'attribution' || target === 'holds') {
        const st = c.statement; form(st, `candidates[${i}].statement`, 'about'); object(st, ['key', 'kind', 'text', 'at', seven ? 'aboutAt' : 'about'], `candidates[${i}].statement`);
        if (typeof st.key !== 'string' || !KEY.test(st.key)) throw new MapReplyError(`candidates[${i}].statement.key`, 'reference', String(st.key));
        need(CLAIM_KINDS.includes(st.kind as ClaimKind), `candidates[${i}].statement.kind`, 'kind'); field(st.text, 240, false, `candidates[${i}].statement.text`); if (!seven && st.about !== null) field(st.about, 80, false, `candidates[${i}].statement.about`);
        const q = cite(st.at, `candidates[${i}].statement.at`);
        // map.7: the statement's own record, whatever the candidate's optional at cites.
        const about = seven ? condition(st.aboutAt, `candidates[${i}].statement.aboutAt`, 80, new Set([q.record]))?.quote ?? null : st.about === null ? null : (st.about as string).trim();
        statement = { key: st.key, kind: st.kind as ClaimKind, text: st.text.trim(), about, record: q.record, quote: q.quote, from: q.from!, to: q.to! };
      } else if (c.statement !== null) throw new MapReplyError(`candidates[${i}].statement`, 'reference', target);
      const q = c.at === null ? null : cite(c.at, `candidates[${i}].at`);
      return [origin({ text: c.text.trim(), parts: [...c.parts as string[]], record: q?.record ?? null, quote: q?.quote ?? null, at: q ? { from: q.from!, to: q.to! } : null, target, statement }, `candidates[${i}]`)];
    }
    if (four) {
      const q = c.at === null ? null : cite(c.at);
      return [{ text: c.text.trim(), parts: [...c.parts as string[]], record: q?.record ?? null, quote: q?.quote ?? null, at: q ? { from: q.from!, to: q.to! } : null }];
    }
    check((c.record === null) === (c.quote === null), code);
    const q = c.record === null ? null : quote(c.record, c.quote);
    return [{ text: c.text.trim(), parts: [...c.parts as string[]], record: q?.record ?? null, quote: q?.quote ?? null }];
  }) ?? []);
  const gaps = many(value.gaps, 2, 'gaps').flatMap((g, k) => soft(() => { field(g, 160, false, `gaps[${k}]`); return [(g as string).trim()]; }) ?? []);
  // What the reply read as material inside a record (an example, a sample under test): a range of whole pieces of one record.
  let material: MapReplyMaterial[] = [];
  if (four) {
    material = many(value.material, 6, 'material').flatMap((x, i) => soft(() => {
      object(x, ['at', 'what'], `material[${i}]`); field(x.what, 120, false, `material[${i}].what`); need(typeof x.at === 'string', `material[${i}].at`, 'shape');
      const rec = /^([NR]\d{2,3})\./.exec(x.at as string)?.[1], got = rec ? texts.get(rec) : undefined;
      const at = got?.spans ? resolveRange(x.at as string, rec!, got.text, got.spans) : null;
      if (!at && six) throw new MapReplyError(`material[${i}].at`, 'reference', (x.at as string).slice(0, 40)); check(!!at, code);
      return [origin({ record: rec!, from: at!.from, to: at!.to, what: (x.what as string).trim() }, `material[${i}]`)];
    }) ?? []);
  }
  let matches: MapReplyMatch[] = [];
  if (two) {
    const priors = new Map((ask.priors ?? []).map(x => [x.key, x])), taken = new Set<string>();
    matches = many(value.matches, 24, 'matches').flatMap((v, mi): MapReplyMatch[] => soft((): MapReplyMatch[] => {
      // map.4: the passage is the cited one, exactly where it stands; then the same rules as a copied quote.
      let anchor: MapReplyQuote | null = null, wire = v;
      let condition7: MapReplyQuote | null = null;
      if (four) {
        need(!!v && typeof v === 'object' && !Array.isArray(v) && Object.hasOwn(v, 'at') && !Object.hasOwn(v, 'record') && !Object.hasOwn(v, 'quote'), `matches[${mi}]`, 'shape');
        form(v, `matches[${mi}]`, 'about');
        const { at, ...rest } = v as Record<string, unknown>; anchor = cite(at, `matches[${mi}].at`); wire = { record: anchor.record, quote: anchor.quote, ...rest };
        // map.7: the match's own record (an earlier condition header of that record included), resolved before the match rules.
        if (seven) { const { aboutAt, ...plain } = wire as Record<string, unknown>; condition7 = condition(aboutAt, `matches[${mi}].aboutAt`, 200, new Set([anchor.record])); wire = { ...plain, about: condition7?.quote ?? null }; }
      }
      // map.7: the request-match rules refused it (their own INVALID_REQUEST_SCOPE); which of them is not told. Any other exception
      // stays the generic refusal it was, never said as a contract guard.
      let m: RequestMatch; try { m = validateRequestMatch(wire, ask.requests!, three, four ? ANCHOR_QUOTE_MAX : 300); }
      catch (e) { throw seven && e instanceof Error && e.message === 'INVALID_REQUEST_SCOPE' ? new MapReplyError(`matches[${mi}]`, 'contract', 'match-contract') : new Error(code); }
      // Request correspondence quotes the literal sent passage; it does not repair or join excerpts.
      const rec = records.get(m.record), text = rec ? texts.get(rec.id)!.text : '', at = anchor ? { at: anchor.from!, length: anchor.to! - anchor.from! } : rec ? quoteAt(text, m.quote) : null;
      need(rec && at && at.length >= (anchor ? 1 : 6) && at.length <= (anchor ? ANCHOR_QUOTE_MAX : 300), `matches[${mi}].at`, 'quote');
      const explicit = new Set(text.match(/\bRQ_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi) ?? []);
      need(!explicit.size || m.targets.every(t => explicit.has(t.requestId)), `matches[${mi}].targets`, 'explicit-request');
      // code/test rest on an evidence record only (a project evidence source or a provided source), whatever its alias letter. map.6
      // names where and which record (its alias and kind, never its text); the whole reply is still refused.
      if (['code', 'test'].includes(m.kind) && rec!.kind !== 'evidence') { if (six) throw new MapReplyError(`matches[${mi}].kind`, 'source-kind', `${rec!.id}:${rec!.kind}`); check(false, code); }
      const about = seven ? condition7?.quote ?? null : m.about === null ? null : resolveQuote(text, m.about);
      need(m.about === null || about !== null, `matches[${mi}].about`, 'about');
      need(!secretLike(`${m.text}\n${m.why}`), `matches[${mi}]`, 'secret-like');
      // Identical frozen demands cannot be separated by arrival order. Retain all competing RQ targets, unless the report
      // explicitly names the request id (or the plan id AND revision) itself.
      const targets = [...m.targets];
      const eligible = (request: { createdAt: string }) => !rec!.addedAt || Date.parse(rec!.addedAt) >= Date.parse(request.createdAt);
      need(targets.every(t => eligible(ask.requests!.find(r => r.id === t.requestId)!)), `matches[${mi}].targets`, 'target-time');
      for (const t of m.targets) {
        const req = ask.requests!.find(r => r.id === t.requestId)!, item = req.items.find(i => i.id === t.itemId)!;
        if (text.includes(req.id) || new RegExp(`${req.planId}\\s*/\\s*${req.planRevision}(?!\\d)`).test(text)) continue;
        for (const other of ask.requests!) for (const i of other.items) if (eligible(other) && other.id !== req.id && norm(i.title) === norm(item.title) && norm(i.description) === norm(item.description) && !targets.some(x => x.requestId === other.id && x.itemId === i.id)) targets.push({ requestId: other.id, itemId: i.id });
      }
      need(targets.length <= 8, `matches[${mi}].targets`, 'target-count');
      const quoted = text.slice(at!.at, at!.at + at!.length), where = anchor ? { from: anchor.from!, to: anchor.to! } : {};
      if (!three) return [{ ...m, quote: quoted, about, targets }];
      // A withdrawal names a prior that was sent, for the very item that prior answers: anything else was made up.
      const key = (v as { replaces: unknown }).replaces;
      need(key === null || (typeof key === 'string' && priors.has(key)), `matches[${mi}].replaces`, 'prior');
      const prior = key === null ? null : priors.get(key as string)!;
      need(!prior || (m.targets.length === 1 && sameTarget(m.targets[0]!, prior.target)), `matches[${mi}].replaces`, 'prior-target');
      // Doubtful ones keep the passage and drop the link (the two reports then read side by side): a remark that does not say
      // made or not made, another nature, the prior's own words, a second take-back of the same prior, a target widened to
      // identical items of other requests, or another named version the record never names.
      const holds = !!prior && !taken.has(prior.key) && targets.length === 1 && canReplace({ target: prior.target, excluded: false, replaced: false, kind: prior.kind, quote: prior.quote, about: prior.about }, { ...m, quote: quoted, about }, text);
      if (holds) taken.add(prior!.key);
      return [{ ...m, quote: quoted, about, targets, stance: m.stance!, replaces: holds ? prior!.key : null, ...where }];
    }) ?? []);
  }
  if (seven) {
    // map.7: what one reply cannot hold at once is settled by setting aside the item that is only a question or a marking: a
    // candidate leaving open what a claim (or an earlier candidate) already says, and a material range the reply also quotes as
    // evidence. A real reading on a PC marked a whole record as material and then quoted it 28 times. Two claims under one key
    // still refuse the reply whole (below): which of them holds is not the validator's to choose.
    const settled = new Set(outParts.flatMap(p => p.claims.flatMap(c => c.key ? [c.key] : []))), open = new Set<string>(), targets = new Set<string>();
    candidates = candidates.filter((c, i) => soft(() => {
      const itemPath = origins.get(c) ?? `candidates[${i}]`, path = `${itemPath}.statement.key`;
      if (c.statement && settled.has(c.statement.key)) throw new MapReplyError(path, 'settled-and-open', c.statement.key);
      if (c.statement && open.has(c.statement.key)) throw new MapReplyError(path, 'duplicate-key', c.statement.key);
      const id = candidateTarget(c);
      if (targets.has(id)) throw new MapReplyError(itemPath, 'duplicate-target', id);
      const k = c.target === 'parent' ? outParts.findIndex(p => p.ref === c.parts[0] && p.name !== null) : -1;
      if (k >= 0 && outParts[k]!.parent === c.parts[1]) throw new MapReplyError(itemPath, 'settled-and-open', `${c.parts[0]}>${c.parts[1]}`);
      if (c.statement) open.add(c.statement.key); targets.add(id); return true;
    }) ?? false);
    // Only final surviving items own conditions. A later parent/candidate rejection leaves no ghost evidence.
    conditions.splice(0, conditions.length, ...[...outParts, ...matches, ...candidates].flatMap(x => conditionOwners.get(x) ?? []));
  }
  // divided: only the material marking is set aside here; every contradiction among statements still refuses (below).
  if (seven || divided) {
    const used = evidenceOf(outParts, relations, matches, candidates, conditions, portMap);
    material = material.filter((m, i) => soft(() => {
      if (used.some(([, q]) => q.record === m.record && q.from !== undefined && q.to !== undefined && m.from < q.to && q.from < m.to)) throw new MapReplyError(origins.get(m) ?? `material[${i}]`, 'material-evidence', m.record);
      return true;
    }) ?? false);
  }
  // map-reading.8: the records' own basis time and target version as the reply read them; a wrong one is left null alone in the
  // lenient readings, refused in plain map.6.
  let basisAt: string | null = null, basisVersion: string | null = null;
  if (six) {
    const top = value as Record<string, unknown>;
    const field8 = (k: 'basisAt' | 'basisVersion', what: ContractGuard): string | null => {
      try { if (!said(top, k)) return null; const v = top[k]; need(typeof v === 'string' && v.length <= 60 && !!v.trim() && !CONTROL.test(v), k, what); return (v as string).trim(); }
      catch (e) { if (e instanceof MapReplyError && lenient) { aside.push(e); return null; } throw e; }
    };
    basisAt = field8('basisAt', 'basis-at'); basisVersion = field8('basisVersion', 'basis-version');
  }
  // map.7: a reply with every item set aside is the refusal of its first one (nothing of it would be read).
  if (aside.length && !outParts.length && !relations.length && !candidates.length && !matches.length && !material.length) throw aside[0];
  if (six) contradictions(outParts, relations, candidates, matches, material, conditions, portMap);
  // map-reading.11 (pipeline .34): the program's places. A rule (scope not project) with no place kept gets up to two condition rows
  // of its own part's 「조건·거부·분기」 table sharing at least two content words with it (most first, then in the record's order),
  // each inferred, its 조건 as text and its line as quote, marked program; none on material. The model's words are never changed.
  // pipeline .35: and then the part's 「파일 지도」 rows and its 「부분별 설계」 settings cell (the .34 spending rule's place, C/calls.py's
  // 「지출 상한」 row, was a file-map row).
  if (six) {
    let rows: PlaceRow[] | undefined;
    for (const b of outParts) for (const c of b.claims) {
      if (c.topic !== 'rule' || (c.anchors ?? []).length || c.scope === 'project') continue;
      const own = plainName(b.name ?? parts.get(b.ref)?.name ?? ''), words = ruleWords(c.text, c.quote);
      rows ??= [...conditionRows(ask).map(r => ({ part: r.part, at: r.at, text: r.condition, words: `${r.condition} ${r.then}`, record: r.record, from: r.from, to: r.to })), ...placeRows(ask)];
      const fit = rows.filter(r => plainName(r.part) === own && !material.some(m => m.record === r.record && m.from < r.to && r.from < m.to))
        .map((r, i) => ({ r, i, n: sharedWords(words, contentWords(r.words)) })).filter(x => x.n >= 2).sort((x, y) => y.n - x.n || x.i - y.i).slice(0, PROGRAM_ANCHORS_MAX);
      const placed = fit.flatMap(({ r }): MapReplyAnchor[] => {
        try { return [{ kind: 'inferred', text: r.text.length <= 80 ? r.text : `${r.text.slice(0, 79)}…`, quote: cite(r.at), program: true }]; } catch { return []; }
      });
      if (placed.length) { c.anchors = placed; continue; }
      // map-reading.13 (pipeline .37): once its own part's rows give none, the conditions of its own part and of the parts its outgoing
      // lines reach (the web record's admin screen rule stood in the order API's conditions), each by its when and then.
      const reached = [b, ...relations.filter(r => r.from === b.ref).map(r => byRef.get(r.to)).filter((x): x is MapReplyPart => !!x && x !== b)];
      const known = new Set(fit.map(({ r }) => `${r.record}:${r.from}`));
      const near = [...new Set(reached)].flatMap(x => x.conditions ?? []).filter(k => k.quote.from !== undefined && !known.has(`${k.quote.record}:${k.quote.from}`)
        && !material.some(m => m.record === k.quote.record && m.from < k.quote.to! && k.quote.from! < m.to))
        .map((k, i) => ({ k, i, n: sharedWords(words, contentWords(`${k.when} ${k.then}`)) })).filter(x => x.n >= 2).sort((x, y) => y.n - x.n || x.i - y.i).slice(0, PROGRAM_ANCHORS_MAX);
      if (near.length) c.anchors = near.map(({ k }): MapReplyAnchor => ({ kind: 'inferred', text: k.when, quote: k.quote, program: true }));
    }
    // map-reading.13 (pipeline .37): the program's loop, stop and resume, and the kept state its conditions name. A part with no loop
    // whose config holds a cadence setting in its own design row's 설정 cell gets that item as its unit (the .36 engine's 「j1_cadence
    // 60 s」); a loop with no stop or resume takes the first condition then or else naming a stop or quota code, or a resume code (the
    // collector's 「QUOTA_REACHED, 오늘 조회 멈춤」); a dotted variable of a condition's when that a record row naming the part calls kept
    // state is a kept state by name. Each marked program; the model's own items are never changed; none on material.
    const onMaterial = (q: MapReplyQuote) => material.some(m => m.record === q.record && q.from !== undefined && q.to !== undefined && m.from < q.to && q.from < m.to);
    // map-reading.15 (pipeline .40, from the blind judging of the .39 web map: the admin screen's refund rule held two program places on
    // the order API's 401·403 rows and kept 장치 미상 a third time): the program's code device. A rule with no code device whose places
    // (the model's or the program's, in their order) stand on a 「조건·거부·분기」 row whose 참이면 refuses (REFUSAL_OUTCOME: 403
    // ROLE_REQUIRED, STOP_NOT_RESIDENT, 쉼 …) gets { code, that 참이면 (80), that row, program: true } for the first such row. Never beside
    // a none (기록상 미설계 is the record's own word); an unknown (장치 미상) gives way to it (no unknown stands beside a device); never on
    // material; at most four devices. The model's devices are never changed.
    const refusals = conditionRows(ask).filter(r => REFUSAL_OUTCOME.test(r.then));
    if (refusals.length) for (const b of outParts) for (const c of b.claims) {
      const devices = c.enforcedBy ?? [];
      if (c.topic !== 'rule' || devices.some(e => e.kind === 'code' || e.kind === 'none')) continue;
      const row = (c.anchors ?? []).map(a => refusals.find(r => r.record === a.quote.record && a.quote.from !== undefined && a.quote.to !== undefined && r.from < a.quote.to && a.quote.from < r.to)).find(Boolean);
      if (!row) continue;
      let quote: MapReplyQuote; try { quote = cite(row.at); } catch { continue; }
      const kept = devices.filter(e => e.kind !== 'unknown');
      if (onMaterial(quote) || kept.length >= 4) continue;
      c.enforcedBy = [...kept, { kind: 'code', text: row.then.length <= 80 ? row.then : `${row.then.slice(0, 79)}…`, quote, program: true }];
    }
    for (const b of outParts) {
      const name = b.name ?? parts.get(b.ref)?.name ?? '';
      if (!b.loop) {
        const got = programLoop(ask, { name, config: b.config, state: b.state, type: b.type });
        if (got) { try { const quote = cite(got.at); if (!onMaterial(quote)) b.loop = { unit: got.unit, stop: null, resume: null, quote, program: true }; } catch { /* a row that does not resolve adds nothing */ } }
      }
      if (b.loop) for (const [k, code] of [['stop', STOP_CODE], ['resume', RESUME_CODE]] as const) {
        if (b.loop[k] !== null) continue;
        const words = (b.conditions ?? []).flatMap(x => [x.then, x.else]).find((w): w is string => typeof w === 'string' && code.test(w));
        if (words) b.loop = k === 'stop' ? { ...b.loop, stop: words, program: true } : { ...b.loop, resume: words, program: true };
      }
      const vars = (b.conditions ?? []).flatMap(x => conditionVariables(x.when));
      for (const v of vars) {
        const list = b.stateVars ?? [], leaf = plainName(v.split('.').at(-1) ?? '');
        if (list.length >= PART_LIST_MAX.stateVars || v.length > 40 || !name) break;
        if (list.some(s => plainName(s.name) === plainName(v) || plainName(s.name).split(/[\s.]/).includes(leaf)) || !calledState(texts, name, v)) continue;
        b.stateVars = [...list, { name: v, scope: null, readBy: [], changedBy: [], program: true }];
      }
    }
    // map-reading.14 (pipeline .39): the program's steps, from a part's own 3절 arrow chain where the records give it no 4절 row and the
    // reply no step (the .38 KORU 성적표 lost its 「race_rows → aggregate → boot_se → render」 again), each on that row; then the program's
    // port-map rows (programPortMap: the .38 KORU global sent [] for five rows its step table names). Each marked program; never on a
    // retired part or on material; the model's own steps and rows are never changed.
    for (const b of outParts) {
      if ((b.steps ?? []).length || b.state === 'retired') continue;
      const got = programSteps(ask, b.name ?? parts.get(b.ref)?.name ?? ''); if (!got.length) continue;
      let quote: MapReplyQuote; try { quote = cite(got[0]!.at); } catch { continue; }
      if (onMaterial(quote)) continue;
      // map-reading.15 (pipeline .40): a piece's parenthesised tail is the step's does (「plan 행」 does 「실패면 FALLBACK」), named by step-name.
      b.steps = got.map((s): MapReplyStep => ({ name: s.name, does: s.does, uses: [], quote, program: true }));
      for (const s of got) if (s.does !== null) renamed.push({ ref: b.ref, from: s.written, to: s.name });
    }
    const nameOfRef = (ref: string) => byRef.get(ref)?.name ?? parts.get(ref)?.name ?? '';
    // map-reading.15 (pipeline .40): the program's rows run past the model's twelve, to PORTMAP_MAX in all (the .39 web map's twelve model
    // rows left none for the program's).
    for (const row of programPortMap(ask, outParts, relations, portMap, nameOfRef)) {
      if (portMap.length >= PORTMAP_MAX) break;
      const line = relations[row.relation]!, end = byRef.get(row.direction === 'in' ? line.to : line.from), step = end?.steps?.[row.stepIndex];
      if (!step || onMaterial(step.quote)) continue;
      portMap.push({ relation: row.relation, port: row.port, step: step.name, direction: row.direction, quote: step.quote, program: true });
    }
  }
  const reply: MapReply = { summary: value.summary.trim(), parts: outParts, relations, candidates, gaps, ...(two ? { matches } : {}), ...(four ? { material } : {}), ...(six ? { basisAt, basisVersion, portMap } : {}) };
  // Words the model wrote (never the quotes, which are the person's own records) must not look like a key.
  // map.7 names the first such place (the same strings, the same rule).
  const written: [string, string][] = [['summary', reply.summary], ...gaps.map((g, k): [string, string] => [`gaps[${k}]`, g]),
    ...outParts.flatMap((p, i): [string, string][] => [[`parts[${i}].name`, p.name ?? ''], [`parts[${i}].role`, p.role ?? ''], [`parts[${i}].roleAboutAt`, p.roleAbout ?? ''], ...p.claims.flatMap((c, j): [string, string][] => [[`parts[${i}].claims[${j}].text`, c.text], [`parts[${i}].claims[${j}].aboutAt`, c.about ?? '']])]),
    ...relations.map((r, i): [string, string] => [`relations[${i}].note`, r.note]), ...candidates.map((c, i): [string, string] => [`candidates[${i}].text`, c.text]), ...material.map((x, i): [string, string] => [`material[${i}].what`, x.what]),
    // map-reading.7: the optional words a claim, a part or a relation adds are the model's own too.
    ...outParts.flatMap((p, i): [string, string][] => [[`parts[${i}].stateWhen`, p.stateWhen ?? ''], ...(p.files ?? []).map((f): [string, string] => [`parts[${i}].files`, f]),
      ...p.claims.flatMap((c, j): [string, string][] => [[`parts[${i}].claims[${j}].when`, c.when ?? ''], [`parts[${i}].claims[${j}].where`, c.where ?? ''], [`parts[${i}].claims[${j}].before`, c.before ?? '']])]),
    ...relations.flatMap((r, i): [string, string][] => [[`relations[${i}].payload`, r.payload ?? ''], [`relations[${i}].cadence`, r.cadence ?? ''], ...(r.payloadFields ?? []).map((f): [string, string] => [`relations[${i}].payloadFields`, f])]),
    // map-reading.8: a part's interface and settings, and the reply's basis, are the model's words too.
    ...outParts.flatMap((p, i): [string, string][] => (['inputs', 'outputs', 'fields', 'config'] as const).flatMap(k => (p[k] ?? []).map((f): [string, string] => [`parts[${i}].${k}`, f]))),
    ['basisAt', basisAt ?? ''], ['basisVersion', basisVersion ?? ''],
    // map-reading.9: a part's steps, loop and kept state, and the port map's names, are the model's words too.
    ...outParts.flatMap((p, i): [string, string][] => [
      ...(p.steps ?? []).flatMap((s, j): [string, string][] => [s.name, s.does ?? '', ...s.uses].map((w): [string, string] => [`parts[${i}].steps[${j}]`, w])),
      ...(p.loop ? [p.loop.unit, p.loop.stop, p.loop.resume].map((w): [string, string] => [`parts[${i}].loop`, w ?? '']) : []),
      // map-reading.13: a relation's format fields are the model's words too (below).
      ...(p.stateVars ?? []).flatMap((s, j): [string, string][] => [s.name, s.scope ?? '', ...s.readBy, ...s.changedBy].map((w): [string, string] => [`parts[${i}].stateVars[${j}]`, w])),
      // map-reading.12: a condition row's words are the model's too.
      ...(p.conditions ?? []).flatMap((c, j): [string, string][] => [c.when, c.then, c.else ?? ''].map((w): [string, string] => [`parts[${i}].conditions[${j}]`, w])),
      // map-reading.14: a file-map row's path and role are the model's words too.
      ...(p.fileRoles ?? []).flatMap((f, j): [string, string][] => [f.path, f.role].map((w): [string, string] => [`parts[${i}].fileRoles[${j}]`, w]))]),
    ...portMap.flatMap((m, k): [string, string][] => [[`portMap[${k}]`, m.port], [`portMap[${k}]`, m.step]]),
    // map-reading.10: a rule's scope name, places and devices are the model's words too.
    ...outParts.flatMap((p, i): [string, string][] => p.claims.flatMap((c, j): [string, string][] => [[`parts[${i}].claims[${j}].scope`, c.scopeName ?? ''],
      ...(c.anchors ?? []).filter(a => !a.program).map((a, k): [string, string] => [`parts[${i}].claims[${j}].anchors[${k}]`, a.text]),
      ...(c.enforcedBy ?? []).map((x, k): [string, string] => [`parts[${i}].claims[${j}].enforcedBy[${k}]`, x.text])]))];
  const leaked = written.find(([, w]) => w && secretLike(w));
  need(!leaked, leaked?.[0] ?? 'reply', 'secret-like');
  const lowered = outParts.flatMap(p => p.claims.flatMap(c => (loweredOf.get(c) ?? []).map(text => ({ ref: p.ref, key: c.key ?? null, text }))));
  if (lowered.length) DOWNGRADES.set(reply, lowered);
  // Pipeline .40: the renamed steps the reply kept.
  const kept40 = renamed.filter((x, i) => renamed.findIndex(y => y.ref === x.ref && y.from === x.from) === i && (byRef.get(x.ref)?.steps ?? []).some(st => st.name === x.to));
  if (kept40.length) RENAMED.set(reply, kept40);
  if (aside.length) {
    ASIDE.set(reply, aside);
    // Static diagnostics and source positions only; never the rejected text/target, which could contain a secret.
    EXCLUSIONS.set(reply, aside.map(e => {
      const steps = e.path.replace(/\[(\d+)\]/g, '.$1').split('.');
      let item: unknown = value, parent: unknown = null;
      for (const step of steps) { parent = item; item = item && typeof item === 'object' ? (item as Record<string, unknown>)[step] : null; }
      const holder = item && typeof item === 'object' ? item : parent, o = holder && typeof holder === 'object' ? holder as Record<string, unknown> : null;
      const alias = typeof item === 'string' && ANCHOR.test(item) ? item : typeof o?.at === 'string' ? o.at : typeof o?.stateAt === 'string' && /\.state(When)?$/.test(e.path) ? o.stateAt : typeof o?.typeAt === 'string' && /\.type$/.test(e.path) ? o.typeAt : Array.isArray(o?.basis) ? o.basis.find(x => typeof x === 'string' && ANCHOR.test(x)) : null;
      const record = typeof alias === 'string' ? alias.split('.')[0]! : null, source = record ? texts.get(record) : null;
      const range = source?.spans && typeof alias === 'string' ? resolveRange(alias, record!, source.text, source.spans) : null;
      // pipeline .38: an io item set aside says what it was and the record cell it came from (its value only when not secret-like).
      const io = ioSource.get(e);
      if (io) return { path: e.path, rule: e.rule, category: e.target, explanation: exclusionExplanation(e), record: io.place?.record ?? null, from: io.place?.from ?? null, to: io.place?.to ?? null, ...(io.value !== null ? { value: io.value } : {}) };
      return { path: e.path, rule: e.rule, category: e.rule === 'contract' ? e.target : null, explanation: exclusionExplanation(e), record: range ? record : null, from: range?.from ?? null, to: range?.to ?? null };
    }));
  }
  return reply;
}

/** Pipeline .32: the fixed explanation this module gives a set-aside reason (for a reason the server reads itself: payload-part). */
export const explainExclusion = (path: string, rule: MapReplyError['rule'], category: string | null): string => exclusionExplanation(new MapReplyError(path, rule, category ?? ''));
/** The durable diagnostics of a checked reply's set-aside items (map.6–7): fixed categories and source positions only. */
export const readingExclusions = (reply: MapReply): readonly ReadingExclusion[] => EXCLUSIONS.get(reply) ?? [];
/** Where a saved exclusion may say it stood (the same grammar storage accepts). */
// Pipeline .31: a list item of a part (parts[i].fields[j]) or a used name of a step (parts[i].steps[j].uses[k]) stands alone too.
// map-reading.10: and a claim's scope, one of its places or devices, its withdrawalKind or gate (parts[i].claims[j].anchors[k]).
// map-reading.12: and one condition row of a part (parts[i].conditions[j]).
const EXCLUSION_PATH = /^(parts|relations|candidates|gaps|matches|material|basisAt|basisVersion|portMap)(\[\d+\])?(\.(claims|basis|statement|steps|stateVars|loop|conditions)(\[\d+\])?)?(\.[A-Za-z]+(\[\d+\])?)?$/;
/** Pipeline .38: the exclusions that may carry the value they set aside (one input or output of a part). */
export const IO_EXCLUSION_PATH = /^parts\[\d+\]\.(inputs|outputs)\[\d+\]$/;
/** A divided first map (studio.map.6) arrives as the wire with every set-aside item already left out (it reads whole under plain
 * map.6), and the reasons they were set aside travel beside it. Those reasons are checked here before they join the reply's own
 * diagnostics: fixed rules and categories only, the explanation this module itself gives for them (no other words are taken), and
 * a source position inside a record of this very ask (or none). Anything else refuses (the caller discards the whole result). */
export function attachExclusions(reply: MapReply, value: unknown, ask: MapAsk): void {
  const code = 'INVALID_RESPONSE';
  check(ask.schemaVersion === MAP6_SCHEMA && firstAsk(ask) && Array.isArray(value) && value.length <= DIVIDED_EXCLUSIONS_MAX, code);
  const texts = askRecords(ask), out: ReadingExclusion[] = [];
  for (const x of value as unknown[]) {
    // pipeline .38: an io item's exclusion may say what it was (value, ≤60, never secret-like).
    const valued = !!x && typeof x === 'object' && Object.hasOwn(x as object, 'value');
    obj(x, ['path', 'rule', 'category', 'explanation', 'record', 'from', 'to', ...(valued ? ['value'] : [])], code);
    if (valued) check(typeof x.path === 'string' && IO_EXCLUSION_PATH.test(x.path) && typeof x.value === 'string' && !!x.value.trim() && x.value.length <= FIELD_ITEM_MAX && !CONTROL.test(x.value) && !secretLike(x.value), code);
    check(typeof x.path === 'string' && x.path.length <= 160 && EXCLUSION_PATH.test(x.path), code);
    check(READING_EXCLUSION_RULES.includes(x.rule as ReadingExclusion['rule']), code);
    check(x.rule === 'contract' ? typeof x.category === 'string' && /^[a-z][a-z-]{0,39}$/.test(x.category) : x.category === null, code);
    const rule = x.rule as ReadingExclusion['rule'], category = x.category as string | null;
    const explanation = exclusionExplanation(new MapReplyError(x.path as string, rule, category ?? ''));
    check(x.explanation === explanation, code);
    if (x.record === null) check(x.from === null && x.to === null, code);
    else {
      const source = typeof x.record === 'string' ? texts.get(x.record) : undefined;
      check(!!source && Number.isSafeInteger(x.from) && Number.isSafeInteger(x.to) && 0 <= (x.from as number) && (x.from as number) < (x.to as number) && (x.to as number) <= source!.text.length, code);
    }
    out.push({ path: x.path as string, rule, category, explanation, record: x.record as string | null, from: x.from as number | null, to: x.to as number | null, ...(valued ? { value: x.value as string } : {}) });
  }
  if (out.length) EXCLUSIONS.set(reply, [...out, ...(EXCLUSIONS.get(reply) ?? [])]);
}

/** What one candidate leaves undecided, as one id: a reply leaves each open once. */
const candidateTarget = (c: MapReply['candidates'][number]) => c.target === 'identity' ? `identity:${[...c.parts].sort().join('|')}` : c.target === 'parent' ? `parent:${c.parts[0]}>${c.parts[1]}` : `${c.target}:${c.statement?.key}`;
/** Every place a reply quotes as evidence (a condition included), by where it stands in the reply. */
function evidenceOf(parts: MapReplyPart[], relations: MapReply['relations'], matches: MapReplyMatch[], candidates: MapReply['candidates'], conditions: [string, MapReplyQuote][], portMap: MapReplyPortMap[] = []): [string, { record: string; from?: number; to?: number }][] {
  return [
    ...parts.flatMap((p, i) => [...p.basis.map((q, j) => [`parts[${i}].basis[${j}]`, q] as [string, MapReplyQuote]), ...p.claims.map((q, j) => [`parts[${i}].claims[${j}].at`, q] as [string, MapReplyQuote]), ...(p.roleReplaces ? [[`parts[${i}].roleReplaces`, p.roleReplaces] as [string, MapReplyQuote]] : []),
      ...(p.stateQuote ? [[`parts[${i}].stateAt`, p.stateQuote] as [string, MapReplyQuote]] : []), ...(p.typeQuote ? [[`parts[${i}].typeAt`, p.typeQuote] as [string, MapReplyQuote]] : []),
      // map-reading.9: a step's row and the loop's line are evidence too.
      ...(p.steps ?? []).map((s, j) => [`parts[${i}].steps[${j}].at`, s.quote] as [string, MapReplyQuote]), ...(p.loop ? [[`parts[${i}].loop.at`, p.loop.quote] as [string, MapReplyQuote]] : []),
      // map-reading.12: a condition row stands on its line too.
      ...(p.conditions ?? []).map((c, j) => [`parts[${i}].conditions[${j}].at`, c.quote] as [string, MapReplyQuote]),
      // map-reading.14: a file-map row stands on its line too.
      ...(p.fileRoles ?? []).map((f, j) => [`parts[${i}].fileRoles[${j}].at`, f.quote] as [string, MapReplyQuote]),
      // map-reading.10: a rule's places and devices stand on their lines too.
      ...p.claims.flatMap((c, j) => [...(c.anchors ?? []).map((a, k) => [`parts[${i}].claims[${j}].anchors[${k}].at`, a.quote] as [string, MapReplyQuote]),
        ...(c.enforcedBy ?? []).flatMap((x, k) => x.quote ? [[`parts[${i}].claims[${j}].enforcedBy[${k}].at`, x.quote] as [string, MapReplyQuote]] : [])])]),
    ...portMap.map((m, k) => [`portMap[${k}].at`, m.quote] as [string, MapReplyQuote]),
    ...relations.map((r, i) => [`relations[${i}].at`, { record: r.record, ...(r.span ?? {}) }] as [string, { record: string; from?: number; to?: number }]),
    ...matches.map((m, i) => [`matches[${i}].at`, m] as [string, MapReplyMatch]),
    ...candidates.flatMap((c, i) => c.statement ? [[`candidates[${i}].statement.at`, c.statement] as [string, MapReplyStatement]] : []),
    // map.7: a condition is evidence too (its trimmed place in the record).
    ...conditions];
}

/** map.6: what one reply cannot hold at once. A statement key is one statement: settled (a claim) or undecided (a candidate),
 * never both, and never twice either way; one target is left undecided once; a new part is not placed under the very parent its
 * candidate leaves undecided (only that link is then null); nothing of the map rests on what the same reply read as material.
 * Positions are evidence, not the conflict key: two quotes of one statement are one statement, overlapping quotes of two are two. */
function contradictions(parts: MapReplyPart[], relations: MapReply['relations'], candidates: MapReply['candidates'], matches: MapReplyMatch[], material: MapReplyMaterial[], conditions: [string, MapReplyQuote][] = [], portMap: MapReplyPortMap[] = []): void {
  const keys = new Map<string, string>();
  parts.forEach((p, i) => p.claims.forEach((c, j) => {
    if (!c.key) return; const path = `parts[${i}].claims[${j}].key`;
    if (keys.has(c.key)) throw new MapReplyError(path, 'duplicate-key', c.key); keys.set(c.key, path);
  }));
  const targets = new Set<string>();
  candidates.forEach((c, i) => {
    if (c.statement) {
      const path = `candidates[${i}].statement.key`, settled = keys.get(c.statement.key);
      if (settled?.startsWith('parts[')) throw new MapReplyError(`${path} = ${settled}`, 'settled-and-open', c.statement.key);
      if (settled) throw new MapReplyError(path, 'duplicate-key', c.statement.key);
      keys.set(c.statement.key, path);
    }
    const id = candidateTarget(c);
    if (targets.has(id)) throw new MapReplyError(`candidates[${i}]`, 'duplicate-target', id); targets.add(id);
    if (c.target === 'parent') {
      const k = parts.findIndex(p => p.ref === c.parts[0] && p.name !== null);
      if (k >= 0 && parts[k]!.parent === c.parts[1]) throw new MapReplyError(`parts[${k}].parent`, 'settled-and-open', `${c.parts[0]}>${c.parts[1]}`);
    }
  });
  const inside = (q: { record: string; from?: number; to?: number }) => q.from !== undefined && q.to !== undefined && material.some(m => m.record === q.record && m.from < q.to! && q.from! < m.to);
  const evidence = evidenceOf(parts, relations, matches, candidates, conditions, portMap);
  for (const [path, q] of evidence) if (inside(q)) throw new MapReplyError(path, 'material-evidence', q.record);
}

/** How a stored candidate reads (map-reading.5): what it leaves undecided, the undecided statement itself (its kind, words and
 * version, never as a settled claim of a part), and the passages to open: the candidate's own and the statement's, once each
 * (one passage when both are the same place). A candidate of an earlier reading has no label or statement: it reads as before. */
export const CANDIDATE_LABEL: Record<CandidateTarget, string> = { attribution: '귀속 미정', holds: '성립 미정', identity: '같은 대상인지 미정', parent: '포함 미정' };
export function candidateReading(c: ReadingCandidate): { label: string | null; statement: { kind: string; text: string; about: string | null } | null; quotes: { which: 'at' | 'statement'; quote: ReadingQuote }[] } {
  const same = (a: ReadingQuote, b: ReadingQuote) => a.record === b.record && (a.from !== undefined && b.from !== undefined ? a.from === b.from && a.to === b.to : a.quote === b.quote);
  const quotes: { which: 'at' | 'statement'; quote: ReadingQuote }[] = c.quote ? [{ which: 'at', quote: c.quote }] : [];
  if (c.statement && !(c.quote && same(c.quote, c.statement.quote))) quotes.push({ which: 'statement', quote: c.statement.quote });
  return { label: c.target ? CANDIDATE_LABEL[c.target] : null, statement: c.statement ? { kind: CLAIM_LABEL[c.statement.kind], text: c.statement.text, about: c.statement.about } : null, quotes };
}

/* ---------- what earlier readings understood, per part ---------- */
export interface CurrentClaim extends ReadingClaim { reading: string; index: number; at: string }
export interface PartUnderstanding {
  /** The current description: the person's correction when there is one, else the first description read, replaced only by a
   * later one whose record says in its own words that it supersedes it (roleReplaces). Arrival order and differing version names
   * are never a reason: a v1 document arriving after v2 does not turn the description back. */
  role: string | null; roleAbout: string | null;
  /** The person corrected the description (it stays until they correct it again). */
  corrected: { id: string; at: string } | null;
  /** The quotes the current description rests on (none for the person's correction). */
  roleBasis: ReadingQuote[];
  /** Descriptions read later that did not replace the current one (another version, the same version, or none named), newest first. */
  others: { text: string; about: string | null; at: string }[];
  /** Current claims, newest reading first: superseded ones and repeats of the same words are left out. */
  claims: CurrentClaim[];
  /** Each reading that said something about this part, oldest first (the evidence history, apart from the current view). */
  history: { reading: string; at: string; role: string | null; claims: ReadingClaim[]; basis: ReadingQuote[] }[];
  /** The part was added by a reading: the name it was added with (the person may have renamed it since). */
  createdName: string | null;
  state: ClaimKind | null;
  /** map-reading.7: the state the newest reading that said one gives the part, in the record's own word, with when the record
   * says so and the line that says it (the reading's time as 'at'); null when no reading said one. */
  stateRead: { state: PartState; when: string | null; quote: ReadingQuote | null; at: string } | null;
  /** map-reading.7: the files, folders or units readings named as this part's, newest reading first, each once (up to eight). */
  files: string[];
  /** map-reading.8: the type the newest reading that said one gives the part, in the record's own word, with the line that says it. */
  typeRead: { type: PartType; quote: ReadingQuote | null; at: string } | null;
  /** map-reading.8: what the part receives and hands over, the fields of its rows and its settings, as readings named them (newest
   * reading first, each once; inputs and outputs up to eight, fields 24, settings eight). */
  inputs: string[]; outputs: string[]; fields: string[]; config: string[];
  /** map-reading.9: the part's steps (newest reading first, each name once, up to twelve; at is the reading's time), the loop of the
   * newest reading that gave one, the state it keeps (each name once, up to eight) and the record's explicit correspondences of a
   * line to its ports and steps (newest first, each once, up to twelve). Steps are not related to one another (no order yet). */
  steps: (ReadingStep & { at: string })[];
  loop: (ReadingLoop & { at: string }) | null;
  stateVars: ReadingStateVar[];
  portMap: (Omit<ReadingPortMap, 'areaId'> & { at: string })[];
  /** map-reading.12: the part's condition rows (newest reading first, each condition and outcome once, up to 24; at is the reading's
   * time). Earlier readings carry none. */
  conditions: (ReadingCondition & { at: string })[];
  /** map-reading.14: the part's 「파일 지도」 rows with their roles (newest reading first, each path once, up to twelve). Earlier readings
   * carry none. Steps and port-map rows carry program from map-reading.14 on (true: the program's, labelled 프로그램). */
  fileRoles: ReadingFileRole[];
  /** map-reading.10: of the current claims (newest reading first), the rules (topic rule) with their scope, places and devices, the
   * withdrawals (topic withdrawn) with their kind, and the gates (topic plan with a gate said). Earlier readings carry none of these
   * keys: their rules read with scope, places and devices not said. */
  rules: CurrentClaim[]; withdrawals: CurrentClaim[]; gates: CurrentClaim[];
  /** A current report or check here replaced an earlier one of this part (the record said so). */
  revised: boolean;
  /** Every quote the current description (as read, never the person's) rests on lies inside a report a later record took back:
   * the description stays, but no longer reads as resting on current evidence. */
  roleBasisRevised: boolean;
}
const norm = (t: string) => t.replace(/\s+/g, ' ').trim();
export function partUnderstanding(p: Project, areaId: string): PartUnderstanding | null {
  const history: PartUnderstanding['history'] = []; let createdName: string | null = null, role: string | null = null, roleAbout: string | null = null;
  const others: PartUnderstanding['others'] = []; let roleBasis: ReadingQuote[] = [];
  let corrected: PartUnderstanding['corrected'] = null;
  const all: CurrentClaim[] = [], replaced = new Set<string>();
  let stateRead: PartUnderstanding['stateRead'] = null, typeRead: PartUnderstanding['typeRead'] = null; const files: string[] = [], inputs: string[] = [], outputs: string[] = [], fields: string[] = [], config: string[] = [];
  // A later reading's names go first in its own order; one an earlier reading also named moves up with it.
  const steps: PartUnderstanding['steps'] = [], stateVars: ReadingStateVar[] = [], portMap: PartUnderstanding['portMap'] = []; let loop: PartUnderstanding['loop'] = null;
  const conditions: PartUnderstanding['conditions'] = [], fileRoles: ReadingFileRole[] = [];
  const gather = (list: string[], own: readonly string[] | undefined) => { if (own?.length) list.splice(0, list.length, ...own, ...list.filter(f => !own.includes(f))); };
  for (const r of p.readings) {
    if (!isMapReading(r)) { if (r.version === 'map-correction.1' && r.areaId === areaId) { role = r.text; roleAbout = null; roleBasis = []; corrected = { id: r.id, at: r.at }; } continue; }
    const part = r.parts.find(x => x.areaId === areaId); if (!part) continue;
    if (part.created) createdName = part.created.name;
    // The newest reading that gives a state (or a type) wins (readings are oldest first); the lists gather, newest first, each once.
    if (part.state) stateRead = { state: part.state, when: part.stateWhen ?? null, quote: part.stateQuote ?? null, at: r.at };
    if (part.type) typeRead = { type: part.type, quote: part.typeQuote ?? null, at: r.at };
    gather(files, part.files); gather(inputs, part.inputs); gather(outputs, part.outputs); gather(fields, part.fields); gather(config, part.config);
    // map-reading.9: the newest reading's steps and kept state go first by name; its loop wins; its port-map rows go first.
    if (part.steps?.length) { const own = part.steps.map(s => ({ ...s, at: r.at })); steps.splice(0, steps.length, ...own, ...steps.filter(s => !own.some(x => x.name === s.name))); }
    // Pipeline .40: a program entry (a name only) takes the readers and changers of an earlier reading's model entry of the same name where
    // its own are blank (the .39 KORU 「J1 답」 read again by name would have lost 「집행」).
    if (part.stateVars?.length) {
      const own = part.stateVars.map(v => { const older = v.program ? stateVars.find(x => x.name === v.name && !x.program) : undefined;
        return older ? { ...v, readBy: v.readBy.length ? v.readBy : [...older.readBy], changedBy: v.changedBy.length ? v.changedBy : [...older.changedBy] } : v; });
      stateVars.splice(0, stateVars.length, ...own, ...stateVars.filter(s => !own.some(x => x.name === s.name)));
    }
    if (part.loop) loop = { ...part.loop, at: r.at };
    // map-reading.12: the newest reading's condition rows go first, each condition and outcome once.
    if (part.conditions?.length) { const own = part.conditions.map(c => ({ ...c, at: r.at })), key = (c: ReadingCondition) => `${c.when}|${c.then}`; conditions.splice(0, conditions.length, ...own, ...conditions.filter(c => !own.some(x => key(x) === key(c)))); }
    // map-reading.14: the newest reading's file-map rows go first, each path once.
    if (part.fileRoles?.length) { const own = part.fileRoles; fileRoles.splice(0, fileRoles.length, ...own, ...fileRoles.filter(f => !own.some(x => x.path === f.path))); }
    const rows = (r.portMap ?? []).filter(m => m.areaId === areaId).map(({ areaId: _a, ...m }) => ({ ...m, at: r.at }));
    const same = (a: { relationId: string; port: string; step: string; direction: string }, b: typeof a) => a.relationId === b.relationId && a.port === b.port && a.step === b.step && a.direction === b.direction;
    if (rows.length) portMap.splice(0, portMap.length, ...rows, ...portMap.filter(m => !rows.some(x => same(x, m))));
    // A correction holds the description only: a later reading's description reads apart, its claims still come in.
    if (part.role) {
      if (!role || (!corrected && part.roleReplaces)) { if (role) others.unshift({ text: role, about: roleAbout, at: r.at }); role = part.role; roleAbout = part.roleAbout; roleBasis = part.basis; }
      else others.unshift({ text: part.role, about: part.roleAbout, at: r.at });
    }
    history.push({ reading: r.id, at: r.at, role: part.role, claims: part.claims, basis: part.basis });
    part.claims.forEach((c, index) => { all.push({ ...c, reading: r.id, index, at: r.at }); if (c.replaces) replaced.add(`${c.replaces.reading}:${c.replaces.index}`); });
  }
  if (!history.length) return null;
  const seen = new Set<string>(), claims: CurrentClaim[] = [];
  for (const c of all.reverse()) {
    // The same words about another version are another claim: never merged across versions.
    const key = `${c.kind}|${norm(c.text)}|${c.about ?? ''}`;
    if (seen.has(key)) continue;
    // A withdrawn latest copy still occupies its semantic key: older duplicates stay history, never revive as current.
    // A new assertion after that withdrawal is visited first and remains current on its own evidence.
    seen.add(key);
    if (replaced.has(`${c.reading}:${c.index}`)) continue;
    claims.push(c);
  }
  // map-reading.10: newest reading first, before the replacing ones are moved ahead below.
  const rules = claims.filter(c => c.topic === 'rule'), withdrawals = claims.filter(c => c.topic === 'withdrawn'), gates = claims.filter(c => c.topic === 'plan' && !!c.gate);
  const state = STATE_ORDER.find(k => claims.some(c => c.kind === k)) ?? null;
  const revised = claims.some(c => !!c.replaces && (c.kind === 'reported' || c.kind === 'checked'));
  const roleBasisRevised = !corrected && roleBasis.length > 0 && roleBasis.every(q => insideRevised(p, areaId, q));
  // The corrected report reads first (claims are newest first; a replacing one goes ahead of the rest).
  claims.sort((a, b) => Number(!!b.replaces) - Number(!!a.replaces));
  // AF140: every claim that still stands, never a silent cut (a limitation read early is as current as a feature read late). A reader
  // that needs fewer takes its own (the map ask and the plan's source take the first 6 of this same order).
  return { role, roleAbout, roleBasis, corrected, others: others.slice(0, 6), claims, history, createdName, state, stateRead, files: files.slice(0, 8), typeRead, inputs: inputs.slice(0, 8), outputs: outputs.slice(0, 8), fields: fields.slice(0, 24), config: config.slice(0, 8),
    steps: steps.slice(0, 12), loop, stateVars: stateVars.slice(0, 8), portMap: portMap.slice(0, 12), conditions: conditions.slice(0, 24), fileRoles: fileRoles.slice(0, 12), rules, withdrawals, gates, revised, roleBasisRevised };
}

/* ---------- evidence a later record took back ---------- */
interface RecordSpan { record: string; from: number; to: number }
const spanCache = new WeakMap<Project, Map<string, RecordSpan[]>>();
/** A record as it is read, quoted and marked (a returned report as received: sourceText), or null when there is none. */
const recordText = (p: Project, id: string) => { const pasted = p.pasted.find(r => r.id === id); if (pasted) return pasted.text; const s = p.sources.find(r => r.id === id); return s ? sourceText(p.tasks, s) : null; };
/** Where a quote stands in its record: where it was read (map-reading.4 keeps it), else only when it stands there once (otherwise
 * which passage is meant is not certain, and none is made up). */
function spanOnce(p: Project, q: ReadingQuote): RecordSpan | null {
  const t = recordText(p, q.record); if (t === null) return null;
  if (q.from !== undefined && q.to !== undefined) return t.slice(q.from, q.to) === q.quote ? { record: q.record, from: q.from, to: q.to } : null;
  const at = t.indexOf(q.quote); return at >= 0 && t.indexOf(q.quote, at + 1) < 0 ? { record: q.record, from: at, to: at + q.quote.length } : null;
}
/** Per part: passages of its reports and checks that no longer stand. A map claim of that part a later claim of the same part
 * replaced (a claim is named by reading, part and index: index alone repeats across parts), and a request match a later record
 * explicitly withdrew as not made, for the parts of the item it answered. A passage a current report or check of that same part
 * still rests on is not among them. Derived only; nothing is stored, removed or archived. */
export function revisedSpans(p: Project): Map<string, RecordSpan[]> {
  const hit = spanCache.get(p); if (hit) return hit;
  const replaced = new Set<string>(), maps = p.readings.filter(isMapReading), gone = new Map<string, RecordSpan[]>(), live = new Map<string, RecordSpan[]>();
  const add = (m: Map<string, RecordSpan[]>, area: string, s: RecordSpan) => { const l = m.get(area) ?? []; l.push(s); m.set(area, l); };
  for (const r of maps) for (const part of r.parts) for (const c of part.claims) if (c.replaces) replaced.add(`${c.replaces.reading}|${part.areaId}|${c.replaces.index}`);
  for (const r of maps) for (const part of r.parts) part.claims.forEach((c, i) => {
    if (c.kind !== 'reported' && c.kind !== 'checked') return;
    const s = spanOnce(p, c); if (s) add(replaced.has(`${r.id}|${part.areaId}|${i}`) ? gone : live, part.areaId, s);
  });
  for (const x of requestMatches(p)) if (x.replacedBy?.match.stance === 'not-made' && x.target) {
    const t = x.target, item = x.requests.find(q => q.id === t.requestId)?.items.find(i => i.id === t.itemId);
    for (const area of item?.partIds ?? []) add(gone, area, { record: x.match.record, from: x.match.from, to: x.match.to });
  }
  const out = new Map<string, RecordSpan[]>();
  for (const [area, spans] of gone) {
    const kept = spans.filter(s => !(live.get(area) ?? []).some(l => l.record === s.record && l.from < s.to && s.from < l.to));
    if (kept.length) out.set(area, kept);
  }
  spanCache.set(p, out); return out;
}
function insideRevised(p: Project, area: string, q: ReadingQuote): boolean {
  const spans = revisedSpans(p).get(area); if (!spans) return false;
  const s = spanOnce(p, q); return !!s && spans.some(x => x.record === s.record && s.from >= x.from && s.to <= x.to);
}
/** Relations a reading added on a quote that lies inside a report one of its two ends took back: the line stays (the person's
 * map), but it is not read as a current, confirmed connection. A relation the person drew has no quote and is never among them. */
const relationCache = new WeakMap<Project, Set<string>>();
export function revisedRelations(p: Project): Set<string> {
  const hit = relationCache.get(p); if (hit) return hit;
  const out = new Set<string>();
  if (revisedSpans(p).size) for (const r of p.readings) if (isMapReading(r)) for (const x of r.relations) if (insideRevised(p, x.from, x.quote) || insideRevised(p, x.to, x.quote)) out.add(x.relationId);
  relationCache.set(p, out); return out;
}

/* ---------- the request ---------- */
/** A record with what is still unread of it: characters from 'from' on (0 = never read; > 0 = the tail an earlier reading left). */
export interface MapRecordSource { id: string; kind: MapAskRecord['kind']; text: string; at: string; label: string; from: number;
  /** project.14: the person's declaration of a provided source, shown in the request's basis and note (never in its text). */
  evidence?: RecordEvidence }
/** A normal record as every map request reads it (unread or an explicit request comparison): pasted as it came, or a provided
 * source, kind evidence, with its declaration. Only the record's own text is sent as its text. */
const normalSource = (r: PastedRecord, from: number): MapRecordSource => ({ id: r.id, kind: recordKind(r), text: r.text, at: r.at, label: recordLabel(r), from, ...(r.evidence ? { evidence: r.evidence } : {}) });
export interface MapInput {
  ask: MapAsk;
  /** alias → area id, record id, earlier claim */
  parts: Map<string, string>; records: Map<string, { id: string; from: number; to: number; total: number; text: string }>; claims: Map<string, { reading: string; index: number }>;
  /** Records not yet read, how many go now, and how many go only in part. */
  coverage: { fresh: number; sent: number; partial: number };
  /** The last reading when this request was made: an answer is applied only on top of it. */
  after: string | null;
  problem: 'NOTHING_NEW' | 'TOO_LARGE' | 'REQUEST_CONTEXT_TOO_LARGE' | { secret: string } | null;
  requestCoverage?: { total: number; sent: number };
  /** Full scopes, captured before the call; the wire sends only requestContext(scope). */
  fullRequests?: FrozenRequest[];
  /** prior alias → the stored match it stands for, its item and the person's last correction of it when this was asked. */
  priors?: Map<string, { reading: string; index: number; target: RequestTarget; correction: string | null }>;
}
/** Pasted records a scenario reading (scenario-reading.1) has read: the app read them alone, as a path on the map, so they are
 * read for the map too and never go to a map reading as a status or design record. */
export function scenarioReadRecords(p: Project): Set<string> { return new Set(p.readings.filter(isScenarioReading).map(r => r.record)); }
/** Records of a project with text no map reading has read yet, newest first: pasted records as pasted, and the project's own
 * records. A record sent only in part comes back with its unread tail (from the end of what was read). A record a scenario
 * reading has read is not here (scenarioReadRecords). */
export function unreadRecords(p: Project, view: StudioView): MapRecordSource[] {
  const readTo = new Map<string, number>(), scenario = scenarioReadRecords(p);
  const texts = recordTexts(p);
  for (const r of p.readings) if (isMapReading(r)) for (const x of r.records) { const i = readInterval(r, x, texts); readTo.set(x.id, Math.max(readTo.get(x.id) ?? 0, i.to)); }
  const pasted: MapRecordSource[] = p.pasted.filter(r => !scenario.has(r.id)).map(r => normalSource(r, readTo.get(r.id) ?? 0));
  const own: MapRecordSource[] = view.records.map(r => ({ id: r.id, kind: r.kind, text: r.text, at: r.at, label: '프로젝트 기록', from: readTo.get(r.id) ?? 0 }));
  return [...pasted, ...own].filter(r => r.from < r.text.length).sort((a, b) => b.at.localeCompare(a.at));
}
/** anchored: true for m4, MAP5_SCHEMA for m5 (only after the server advertises that capability); records go as span.2 pieces, ending
 * where a piece ends (a cut excerpt never leaves its last sentence half sent), with requests and priors always present.
 * MAP7_SCHEMA (a server that also advertises the later m7 recipe): the ask is built as map.6 and, once complete, goes as map.7 when it
 * is a later reading (firstAsk false); a first map stays map.6. */
export function buildMapAsk(p: Project, view: StudioView, requests: FrozenRequest[] = [], selectedRequestId?: string, anchored: boolean | typeof MAP5_SCHEMA | typeof MAP6_SCHEMA | typeof MAP7_SCHEMA = false): MapInput {
  const anchoredSchema = anchored === MAP6_SCHEMA || anchored === MAP7_SCHEMA ? MAP6_SCHEMA : anchored === MAP5_SCHEMA ? MAP5_SCHEMA : MAP4_SCHEMA;
  const parts = new Map<string, string>(), alias = new Map<string, string>(), claims = new Map<string, { reading: string; index: number }>();
  view.parts.slice(0, 200).forEach((x, i) => { const a = `P${String(i + 1).padStart(2, '0')}`; parts.set(a, x.id); alias.set(x.id, a); });
  let c = 0;
  const askParts: MapAskPart[] = view.parts.slice(0, 200).map(x => {
    const u = partUnderstanding(p, x.id);
    const current = (u?.claims ?? []).slice(0, 6).map(cl => { const key = `C${String(++c).padStart(2, '0')}`; claims.set(key, { reading: cl.reading, index: cl.index }); return { key, kind: cl.kind, text: cut(cl.text, 240), about: cl.about }; });
    return { id: alias.get(x.id)!, name: x.name, note: cut(clean(x.note), 2000), parentId: x.parentId ? alias.get(x.parentId) ?? null : null,
      readAs: u?.createdName && normName(u.createdName) !== normName(x.name) ? u.createdName : null, role: cut(u?.role ?? '', 300), roleBy: u?.role ? (u.corrected ? 'person' : 'reading') : null, roleAbout: u?.role && !u.corrected ? u.roleAbout : null, current };
  });
  const ask: MapAsk = {
    schemaVersion: MAP_SCHEMA,
    project: { name: cut(p.name, 120), purpose: p.space.brief ? cut(clean(p.space.brief.text), 2000) : null },
    parts: askParts,
    relations: view.relations.filter(r => alias.has(r.from) && alias.has(r.to)).slice(0, 400).map(r => ({ from: alias.get(r.from)!, to: alias.get(r.to)!, kind: r.kind, note: cut(r.note, 200) })),
    records: [],
    ...(anchored ? { requests: [], priors: [] } : {})
  };
  if (anchored) ask.schemaVersion = anchoredSchema;
  let unread = unreadRecords(p, view);
  if (selectedRequestId) {
    if (!requests.some(r => r.id === selectedRequestId)) throw new Error('INVALID_REQUEST_SCOPE');
    // Explicit recovery may compare a report previously read without this RQ. Coverage is per RQ, from its contiguous
    // compared prefix, so an earlier map-only read or a sent tail does not hide an uncompared head forever.
    const texts = recordTexts(p), compared = p.readings.filter(isMapReading).filter(r => r.requests?.some(q => q.id === selectedRequestId)).flatMap(r => r.records.map(x => readInterval(r, x, texts)));
    const prefix = (id: string) => { let end = 0; for (const r of compared.filter(r => r.id === id).sort((a, b) => a.from - b.from)) if (r.from <= end) end = Math.max(end, r.to); return end; };
    const scenario = scenarioReadRecords(p);
    unread = [...p.pasted.filter(r => !scenario.has(r.id)).map(r => normalSource(r, prefix(r.id))),
      ...view.records.map(r => ({ id: r.id, kind: r.kind, text: r.text, at: r.at, label: '프로젝트 기록', from: prefix(r.id) }))].filter(r => r.from < r.text.length).sort((a, b) => b.at.localeCompare(a.at));
  }
  const records = new Map<string, { id: string; from: number; to: number; total: number; text: string }>();
  const input: MapInput = { ask, parts, records, claims, coverage: { fresh: unread.length, sent: 0, partial: 0 }, after: p.readings.filter(isMapReading).at(-1)?.id ?? null, problem: null };
  if (!unread.length) return { ...input, problem: 'NOTHING_NEW' };
  // All comparable contexts or a request the person explicitly chose. Full origins are never sent repeatedly per item.
  if (requests.length) {
    for (const r of requests) { validateFrozenRequest(r); if (r.projectId !== p.id) throw new Error('INVALID_REQUEST_SCOPE'); }
    const chosen = selectedRequestId ? requests.filter(r => r.id === selectedRequestId) : requests, contexts = chosen.map(requestContext);
    input.requestCoverage = { total: requests.length, sent: 0 };
    if (chosen.length > 8 || bytes(contexts) > 28000) return { ...input, problem: 'REQUEST_CONTEXT_TOO_LARGE' };
    ask.schemaVersion = anchored ? anchoredSchema : MAP3_SCHEMA; ask.requests = contexts; input.fullRequests = structuredClone(chosen);
    input.requestCoverage.sent = chosen.length;
    // What the records may take back: current matches of a single item of these requests, newest first, within their own budget.
    const ids = new Set(chosen.map(q => q.id)), priors: MapAskPrior[] = [], refs = new Map<string, { reading: string; index: number; target: RequestTarget; correction: string | null }>();
    for (const x of requestMatches(p)) {
      if (priors.length >= MAP_PRIORS) break;
      if (x.excluded || x.replacedBy || !x.target || !ids.has(x.target.requestId) || x.match.kind === 'open' || secretLike(`${x.match.quote}\n${x.match.text}`)) continue;
      const key = `M${String(priors.length + 1).padStart(2, '0')}`, prior: MapAskPrior = { key, quote: x.match.quote, text: x.match.text, kind: x.match.kind, stance: x.match.stance ?? null, about: x.match.about, target: { ...x.target } };
      if (bytes([...priors, prior]) > PRIOR_BYTES) break;
      priors.push(prior); refs.set(key, { reading: x.reading, index: x.index, target: { ...x.target }, correction: x.correction });
    }
    ask.priors = priors; input.priors = refs;
  }
  // Structure first, bounded: the earlier understanding of each part shrinks before any record is left out.
  const mapBytes = () => bytes({ ...ask, ...(ask.requests ? { requests: [] } : {}), ...(ask.priors ? { priors: [] } : {}) });
  if (mapBytes() > META_BYTES) for (const x of ask.parts) { x.current = x.current.slice(0, 2); x.role = cut(x.role, 120); if (mapBytes() <= META_BYTES) break; }
  if (mapBytes() > META_BYTES) return { ...input, problem: 'TOO_LARGE' };
  // Priors give way first (the oldest go): they never keep a report from being read.
  while (ask.priors?.length && bytes(ask) > MAP_BYTES - MIN_RECORD_CHARS * 3) input.priors!.delete(ask.priors.pop()!.key);
  if (bytes(ask) > MAP_BYTES - MIN_RECORD_CHARS * 3) return { ...input, problem: 'REQUEST_CONTEXT_TOO_LARGE' };
  let n = { N: 0, R: 0 };
  // A cut excerpt (anchored) ends with the last piece that ends there: at a line end, or before a cut nothing of it is sent past.
  const aligned = (rest: string, t: string) => {
    let end = t.length;
    const spans = indexSpans(t);
    const last = spans.at(-1);
    if (t.length < rest.length && last) {
      // The last piece is whole when its line ends, or its sentence ends, before what is left out; else it goes next time.
      const tail = rest.slice(last.to, t.length + 1), piece = t.slice(last.from, last.to);
      const whole = /[\r\n]/.test(tail) || (/^\s/.test(tail) && /[.!?。！？…][)\]"'”’」』]*$/.test(piece));
      end = whole ? last.to : spans.at(-2)?.to ?? t.length;
    }
    if (spans.length > SPANS_PER_RECORD) end = Math.min(end, spans[SPANS_PER_RECORD - 1]!.to);
    return t.slice(0, end);
  };
  const put = (rec: MapAskRecord, t: string) => { if (anchored) { const w = encodeSpans(rec.id, t); rec.lead = w.lead; rec.spans = w.spans; } else rec.text = t; };
  for (const r of unread) {
    if (ask.records.length >= MAP_RECORDS) break;
    const letter = r.kind === 'pasted' ? 'N' : 'R', id = `${letter}${String(++n[letter]).padStart(2, '0')}`;
    // Only the unread part goes: what is quoted is checked against exactly this excerpt.
    const rest = r.text.slice(r.from);
    // Records hold no control characters (they are refused on the way in), so the excerpt is the record's own text.
    let text = anchored ? aligned(rest, cut(rest, MAP_RECORD_CHARS)) : cut(clean(rest), MAP_RECORD_CHARS);
    const rec: MapAskRecord = { id, kind: r.kind, note: '', basis: r.evidence ? mapBasis(r.evidence, r.at) : `${r.label} · ${r.at} (가져온 시각이며 원문 작성·판본 시각이 아님)`, ...(ask.requests ? { addedAt: r.at } : {}) };
    put(rec, text);
    const earlier = ask.requests?.filter(q => Date.parse(r.at) < Date.parse(q.createdAt)).map(q => q.id) ?? [];
    const note = () => {
      const range = r.from > 0 || text.length < rest.length ? `원문 ${r.text.length}자 중 ${r.from + 1}~${r.from + text.length}자 구간만 보냄${r.from > 0 ? ' (앞 구간은 앞선 정리에서 읽음)' : ''}` : '';
      const before = earlier.length ? `다음 요청문 생성 전에 붙인 이전 자료이며 후속 반환 근거가 아님: ${earlier.join(', ')}` : '';
      if (!r.evidence) return [range, before].filter(Boolean).join(' · ');
      // A provided source's declaration is never cut: when the request ids would not fit beside it, their count goes (each record
      // still carries addedAt and each request its createdAt, which the reply is held to).
      const full = [mapNoteHead(r.evidence), range, before].filter(Boolean).join(' · ');
      return full.length <= 600 ? full : [mapNoteHead(r.evidence), range, `다음 요청문 ${earlier.length}개 생성 전에 붙인 이전 자료이며 후속 반환 근거가 아님`].filter(Boolean).join(' · ');
    };
    rec.note = note(); ask.records.push(rec);
    // A record takes the room that is left, down to a readable excerpt; one that cannot is left for the next reading.
    for (let g = 0; bytes(ask) > MAP_BYTES - 256 && text.length > MIN_RECORD_CHARS && g < 40; g++) { const shorter = cut(text, Math.floor(text.length * 0.9)); text = anchored ? aligned(rest, shorter) : shorter; put(rec, text); rec.note = note(); }
    if (bytes(ask) > MAP_BYTES - 256) { ask.records.pop(); n[letter]--; break; }
    records.set(id, { id: r.id, from: r.from, to: r.from + text.length, total: r.text.length, text });
  }
  input.coverage = { fresh: unread.length, sent: ask.records.length, partial: [...records.values()].filter(x => x.to < x.total || x.from > 0).length };
  if (!ask.records.length) return { ...input, problem: 'TOO_LARGE' };
  const leak = ask.records.find(x => secretLike(records.get(x.id)!.text));
  if (leak) return { ...input, problem: { secret: leak.id } };
  if (anchored === MAP7_SCHEMA && !firstAsk(ask)) ask.schemaVersion = MAP7_SCHEMA;
  return input;
}

/* ---------- the one write ---------- */
export interface Applied { project: Project; reading: MapReading; created: string[]; touched: string[] }
/** Applies a validated reply on top of the project it was asked about, atomically: either every part, relation and the reading
 * are kept, or nothing is (the result is re-read by parseProject). Refused when another reading was applied meanwhile or a part
 * the reply names has gone; edits the person made meanwhile (names, notes, places, plans, records) are kept as they are. */
export function applyReading(project: Project, input: MapInput, reply: MapReply, meta: { id: string; at: string; model: string; prompt: string; hash: string }): Applied {
  if (input.problem) throw new Error(input.problem === 'REQUEST_CONTEXT_TOO_LARGE' ? 'REQUEST_CONTEXT_TOO_LARGE' : 'INVALID_INPUT');
  const six = input.ask.schemaVersion === MAP6_SCHEMA || input.ask.schemaVersion === MAP7_SCHEMA, withRequests = input.ask.schemaVersion !== MAP_SCHEMA, four = six || input.ask.schemaVersion === MAP4_SCHEMA || input.ask.schemaVersion === MAP5_SCHEMA, three = four || input.ask.schemaVersion === MAP3_SCHEMA;
  const frozen = withRequests ? input.fullRequests ?? input.ask.requests!.map(validateFrozenRequest) : [];
  if (frozen.some(r => r.projectId !== project.id) || JSON.stringify(frozen.map(requestContext)) !== JSON.stringify((input.ask.requests ?? []).map(r => r.version === 'request-scope.1' ? requestContext(r) : r))) throw new Error('INVALID_REQUEST_SCOPE');
  const done = project.readings.filter(isMapReading);
  if ((done.at(-1)?.id ?? null) !== input.after) throw new Error('MAP_CHANGED');
  if (done.some(r => r.hash === meta.hash)) throw new Error('ALREADY_APPLIED');
  if (project.readings.length >= READINGS_LIMIT) throw new Error('READINGS_FULL');
  // Anchored: every excerpt is still exactly the record's text where it was read (the record, its length and the interval).
  if (four) for (const r of input.records.values()) { const t = recordText(project, r.id); if (t === null || t.length !== r.total || t.slice(r.from, r.to) !== r.text) throw new Error('MAP_CHANGED'); }
  // And every passage of the reply is the excerpt's own text where it says it stands (a reply decoded for another request is not).
  if (four) {
    const at = (q: MapReplyQuote) => { const source = input.records.get(q.record); return !!source && q.from !== undefined && q.to !== undefined && source.text.slice(q.from, q.to) === q.quote; };
    const all = [...reply.parts.flatMap(x => [...x.basis, ...x.claims, ...(x.roleReplaces ? [x.roleReplaces] : []), ...(x.stateQuote ? [x.stateQuote] : []), ...(x.typeQuote ? [x.typeQuote] : []),
      ...(x.steps ?? []).map(s => s.quote), ...(x.loop ? [x.loop.quote] : []), ...(x.conditions ?? []).map(c => c.quote), ...(x.fileRoles ?? []).map(f => f.quote)]), ...(reply.portMap ?? []).map(m => m.quote), ...reply.relations.map(r => ({ record: r.record, quote: r.quote, ...(r.span ?? {}) })),
      ...reply.candidates.flatMap(c => c.record ? [{ record: c.record, quote: c.quote!, ...(c.at ?? {}) }] : []), ...(reply.matches ?? [])];
    if (!all.every(at) || (reply.material ?? []).some(m => { const s = input.records.get(m.record); return !s || m.to > s.text.length; })) throw new Error('INVALID_RESPONSE');
  }
  const addedAt = new Map([...project.pasted.map(r => [r.id, r.at] as const), ...project.sources.map(r => [r.id, r.at] as const)]);
  for (const m of reply.matches ?? []) for (const t of m.targets) {
    const record = input.records.get(m.record), request = frozen.find(r => r.id === t.requestId);
    if (!record || !request || !addedAt.has(record.id) || Date.parse(addedAt.get(record.id)!) < Date.parse(request.createdAt)) throw new Error('INVALID_RESPONSE');
  }
  // A comparison may re-read an old interval. Only quotes containing previously unread bytes can change the map again.
  // Request matches still use the full reply below and are saved with their frozen context in the same write.
  const texts = recordTexts(project), covered = done.flatMap(r => r.records.map(x => readInterval(r, x, texts)));
  const freshQuote = (q: MapReplyQuote) => {
    const source = input.records.get(q.record), at = !source ? null : q.from !== undefined && q.to !== undefined ? { at: q.from, length: q.to - q.from } : quoteAt(source.text, q.quote);
    if (!source || !at) return false;
    let end = source.from + at.at; const limit = end + at.length;
    for (const r of covered.filter(r => r.id === source.id && r.to > end && r.from < limit).sort((a, b) => a.from - b.from)) {
      if (r.from > end) return true; end = Math.max(end, r.to); if (end >= limit) return false;
    }
    return end < limit;
  };
  // Material inside a record (map.4: an example, a sample under test, as the reply read it) grounds nothing of the map alone.
  const material = reply.material ?? [];
  const own = (q: MapReplyQuote) => !material.some(m => m.record === q.record && q.from !== undefined && q.to !== undefined && m.from < q.to && q.from < m.to);
  const usable = (q: MapReplyQuote) => freshQuote(q) && own(q);
  const asMaterial: ReadingSkip[] = [];
  const mapParts = reply.parts.flatMap(x => {
    const basis = x.basis.filter(usable), claims = x.claims.filter(usable), role = basis.length ? x.role : null;
    if (x.name !== null && !basis.length && x.basis.some(freshQuote)) asMaterial.push({ what: 'part', name: x.name, reason: 'material' });
    if (x.name !== null ? !basis.length : !role && !claims.length) return [];
    return [{ ...x, basis, claims, role, roleAbout: role ? x.roleAbout : null, roleReplaces: role && x.roleReplaces && usable(x.roleReplaces) ? x.roleReplaces : null }];
  });
  const lineQuote = (r: MapReply['relations'][number]): MapReplyQuote => ({ record: r.record, quote: r.quote, ...(r.span ?? {}) });
  for (const r of reply.relations) if (freshQuote(lineQuote(r)) && !own(lineQuote(r))) asMaterial.push({ what: 'relation', name: `${r.from}→${r.to}`, reason: 'material' });
  const mapRelations = reply.relations.filter(r => usable(lineQuote(r)));
  const comparisonOnly = frozen.length > 0 && [...input.records].every(([record, source]) => !freshQuote({ record, quote: source.text }));
  const active = (id: string) => project.space.areas.some(a => a.id === id && !a.archived);
  for (const id of input.parts.values()) if (!active(id)) throw new Error('MAP_CHANGED');
  // Anchored: the record's own passage where it was read, [from, to) of the record (the excerpt's offset added once).
  const real = (q: MapReplyQuote): ReadingQuote => {
    const source = input.records.get(q.record)!;
    if (q.from === undefined || q.to === undefined) return { record: source.id, quote: q.quote };
    return { record: source.id, quote: q.quote, from: source.from + q.from, to: source.from + q.to };
  };
  // map-reading.7 (every map.6–7 reply; stored as map-reading.15): each optional field is stored, null (files: []) when the reply did not say it, so the
  // stored shape is exact. A part's state stands on its own passage like a claim: one inside material or already read is not kept.
  const claimOf = (c: MapReplyClaim): ReadingClaim => ({ kind: c.kind, text: c.text, ...real(c), about: c.about, replaces: c.replaces ? input.claims.get(c.replaces)! : null,
    ...(six ? { topic: c.topic ?? null, evidence: c.evidence ?? null, when: c.when ?? null, where: c.where ?? null, before: c.before ?? null,
      // map-reading.10: a place or a device stands on its own line like a step (one inside material or already read is not kept).
      scope: c.scope ?? null, scopeName: c.scopeName ?? null, anchors: (c.anchors ?? []).filter(a => usable(a.quote)).map(a => ({ kind: a.kind, text: a.text, quote: real(a.quote), program: a.program === true })),
      // map-reading.15: every device says whether the program put it there (a refusal row's code device).
      enforcedBy: (c.enforcedBy ?? []).filter(x => !x.quote || usable(x.quote)).map(x => ({ kind: x.kind, text: x.text, quote: x.quote ? real(x.quote) : null, program: x.program === true })),
      withdrawalKind: c.withdrawalKind ?? null, gate: c.gate ?? null } : {}) });
  const stateOf = (x: MapReplyPart): Pick<ReadingPart, 'state' | 'stateWhen' | 'stateQuote' | 'files' | 'type' | 'typeQuote' | 'inputs' | 'outputs' | 'fields' | 'config' | 'steps' | 'loop' | 'stateVars' | 'conditions' | 'fileRoles'> => {
    if (!six) return {};
    const kept = !!x.state && !!x.stateQuote && usable(x.stateQuote);
    // map-reading.8: a type stands on its own passage like a state; the lists are the record's names as read.
    const typed = !!x.type && !!x.typeQuote && usable(x.typeQuote);
    // map-reading.9: a step and a loop stand on their own rows like a state (one inside material or already read is not kept).
    return { state: kept ? x.state! : null, stateWhen: kept ? x.stateWhen ?? null : null, stateQuote: kept ? real(x.stateQuote!) : null, files: [...x.files ?? []],
      type: typed ? x.type! : null, typeQuote: typed ? real(x.typeQuote!) : null, inputs: [...x.inputs ?? []], outputs: [...x.outputs ?? []], fields: [...x.fields ?? []], config: [...x.config ?? []],
      // map-reading.14: every step says whether the program put it there.
      steps: (x.steps ?? []).filter(s => usable(s.quote)).map(s => ({ name: s.name, does: s.does, uses: [...s.uses], quote: real(s.quote), program: s.program === true })),
      // map-reading.13: every loop and kept state says whether the program put it there.
      loop: x.loop && usable(x.loop.quote) ? { unit: x.loop.unit, stop: x.loop.stop, resume: x.loop.resume, quote: real(x.loop.quote), program: x.loop.program === true } : null,
      stateVars: (x.stateVars ?? []).map(s => ({ name: s.name, scope: s.scope, readBy: [...s.readBy], changedBy: [...s.changedBy], program: s.program === true })),
      // map-reading.12: a condition row stands on its own row like a step.
      conditions: (x.conditions ?? []).filter(c => usable(c.quote)).map(c => ({ when: c.when, then: c.then, else: c.else, quote: real(c.quote) })),
      // map-reading.14: a file-map row stands on its own row like a condition.
      fileRoles: (x.fileRoles ?? []).filter(f => usable(f.quote)).map(f => ({ path: f.path, role: f.role, quote: real(f.quote) })) };
  };
  let p = project;
  const ids = new Map(input.parts), skipped: ReadingSkip[] = [...asMaterial], candidates: ReadingCandidate[] = [], parts: ReadingPart[] = [], created: string[] = [];
  const parentOf = (id: string) => p.space.containment.parents[id] ?? null;
  const madeBefore = done.flatMap(r => r.parts.filter(x => x.created).map(x => ({ areaId: x.areaId, ...x.created! })));
  // New parts, parents first (the reply's own order otherwise).
  const queue = mapParts.filter(x => x.name !== null), dropped = new Set(reply.parts.filter(x => x.name !== null && !mapParts.some(p => p.ref === x.ref)).map(x => x.ref));
  for (let guard = 0; queue.length && guard < 64; guard++) {
    for (let i = 0; i < queue.length; i++) {
      const x = queue[i]!; if (x.parent && !ids.has(x.parent) && !dropped.has(x.parent)) continue;
      queue.splice(i--, 1);
      if (x.parent && dropped.has(x.parent)) { dropped.add(x.ref); skipped.push({ what: 'part', name: x.name!, reason: 'parent-skipped' }); continue; }
      const parentId = x.parent ? ids.get(x.parent)! : null, key = normName(x.name!);
      const same = p.space.areas.find(a => !a.archived && parentOf(a.id) === parentId && normName(a.name) === key)
        ?? madeBefore.map(m => p.space.areas.find(a => a.id === m.areaId && !a.archived && m.parentId === parentId && normName(m.name) === key)).find(Boolean);
      if (same) {
        // Not the same thing by its name alone: the new one is not added, and nothing is attached to the existing one.
        dropped.add(x.ref); skipped.push({ what: 'part', name: x.name!, reason: 'same-name' });
        candidates.push({ text: `‘${x.name}’: 같은 이름의 부분이 이미 있어 새로 만들지 않았어요. 같은 대상인지는 원문으로 확인해 주세요.`, areaIds: [same.id], quote: real(x.basis[0]!), ...(six ? { target: 'identity' as const, statement: null } : {}) });
        continue;
      }
      if (madeBefore.some(m => m.parentId === parentId && normName(m.name) === key && p.space.areas.some(a => a.id === m.areaId && a.archived))) {
        dropped.add(x.ref); skipped.push({ what: 'part', name: x.name!, reason: 'archived' }); continue;
      }
      p = parentId ? addChildArea(p, parentId, x.name!, '') : addArea(p, x.name!, '');
      const id = p.space.areas.at(-1)!.id; ids.set(x.ref, id); created.push(id);
      parts.push({ areaId: id, created: { name: p.space.areas.at(-1)!.name, parentId }, role: x.role, roleAbout: x.roleAbout, roleReplaces: null, basis: x.basis.map(real), claims: x.claims.map(claimOf), ...stateOf(x) });
    }
  }
  // map.1–5: what the reply leaves undecided between parts is not also settled on one of them: a claim on a part a candidate
  // names, resting on the same quote as that candidate, stays with the candidate only. map.6 says what is undecided (target and
  // statement key) and refuses a reply that settles it too, so no claim is taken away for sharing a passage with a candidate.
  const unsure = reply.candidates.filter(c => c.quote && c.parts.length).map(c => ({ parts: new Set(c.parts.map(a => ids.get(a))), ...real({ record: c.record!, quote: c.quote!, ...(c.at ? c.at : {}) }) }));
  // Anchored passages overlap where they stand (a repeated sentence elsewhere is another passage); copied ones by their words.
  const overlaps = (a: ReadingQuote, b: ReadingQuote) => a.from !== undefined && b.from !== undefined ? a.from < b.to! && b.from < a.to! : a.quote.includes(b.quote) || b.quote.includes(a.quote);
  const settled = (areaId: string, c: ReadingClaim) => !unsure.some(u => u.parts.has(areaId) && u.record === c.record && overlaps(u, c));
  for (const x of mapParts) if (x.name === null) parts.push({ areaId: ids.get(x.ref)!, created: null, role: x.role, roleAbout: x.roleAbout, roleReplaces: x.roleReplaces ? real(x.roleReplaces) : null, basis: x.basis.map(real), claims: x.claims.map(claimOf), ...stateOf(x) });
  if (!six) for (const part of parts) part.claims = part.claims.filter(c => settled(part.areaId, c));
  for (let i = parts.length - 1; i >= 0; i--) if (!parts[i]!.created && !parts[i]!.role && !parts[i]!.claims.length) parts.splice(i, 1);
  const relations: ReadingRelation[] = [], storedAs = new Map<MapReply['relations'][number], string>();
  const madeRelations = done.flatMap(r => r.relations);
  for (const r of mapRelations) {
    const from = ids.get(r.from), to = ids.get(r.to), name = `${r.from}→${r.to}`;
    if (!from || !to) { skipped.push({ what: 'relation', name, reason: 'parent-skipped' }); continue; }
    // map-reading.7: a line this very reading drew as designed and also read as observed (or the other way) is one line on the
    // map read twice: the second reading of it is kept beside the first, under the same relation, with its own passage.
    const twin = six && r.mode ? relations.find(x => x.from === from && x.to === to && x.kind === r.kind && x.mode && x.mode !== r.mode && !relations.some(y => y.relationId === x.relationId && y.mode === r.mode)) : undefined;
    if (twin) { relations.push({ relationId: twin.relationId, from, to, kind: r.kind, quote: real(lineQuote(r)), payload: r.payload ?? null, cadence: r.cadence ?? null, mode: r.mode!, channel: r.channel ?? null, payloadFields: [...r.payloadFields ?? []] }); storedAs.set(r, twin.relationId); continue; }
    if (p.space.relations.some(x => x.from === from && x.to === to && x.kind === r.kind)) { skipped.push({ what: 'relation', name, reason: 'exists' }); continue; }
    if (madeRelations.some(x => x.from === from && x.to === to && x.kind === r.kind && !p.space.relations.some(y => y.id === x.relationId))) { skipped.push({ what: 'relation', name, reason: 'removed' }); continue; }
    p = addRelation(p, from, to, r.kind, r.note);
    relations.push({ relationId: p.space.relations.at(-1)!.id, from, to, kind: r.kind, quote: real(lineQuote(r)), ...(six ? { payload: r.payload ?? null, cadence: r.cadence ?? null, mode: r.mode ?? null, channel: r.channel ?? null, payloadFields: [...r.payloadFields ?? []] } : {}) });
    storedAs.set(r, relations.at(-1)!.relationId);
  }
  // map-reading.9: a port-map row stands with its relation as stored by this reading (one the map already had, the person removed,
  // or that rests on material is not), on a part this reading kept with that port and that step, and on its own fresh passage.
  const portMap: ReadingPortMap[] = [];
  if (six) for (const m of reply.portMap ?? []) {
    const line = reply.relations[m.relation], relationId = line ? storedAs.get(line) : undefined, stored = relations.find(x => x.relationId === relationId);
    if (!stored || !usable(m.quote)) continue;
    const areaId = m.direction === 'in' ? stored.to : stored.from, part = parts.find(x => x.areaId === areaId);
    if (!part || !(part.steps ?? []).some(s => s.name === m.step) || !(m.direction === 'in' ? part.inputs ?? [] : part.outputs ?? []).includes(m.port)) continue;
    if (portMap.some(x => x.relationId === stored.relationId && x.port === m.port && x.step === m.step && x.direction === m.direction)) continue;
    portMap.push({ relationId: stored.relationId, areaId, port: m.port, step: m.step, direction: m.direction, quote: real(m.quote), program: m.program === true });
  }
  // A candidate naming a part this reply wanted to add but that was not added keeps its words, without that part.
  // map.6: it keeps what it leaves undecided, and an undecided statement itself (content, kind, version, exact place).
  for (const c of reply.candidates) candidates.push({ text: c.text, areaIds: c.parts.map(a => ids.get(a)).filter((x): x is string => !!x), quote: c.record ? real({ record: c.record, quote: c.quote!, ...(c.at ? c.at : {}) }) : null,
    ...(six ? { target: c.target!, statement: c.statement ? { kind: c.statement.kind, text: c.statement.text, about: c.statement.about, quote: real(c.statement) } : null } : {}) });
  // A withdrawal holds only for the match it was asked about as it still is: the person may have retargeted or excluded it (or
  // another record taken it back) while this was being read. Then the passage is kept and the link is not.
  const now = three ? requestMatches(project) : [];
  // Anchored: a passage of material is no report of this project's request, and none is kept as one.
  const matches: StoredRequestMatch[] = (reply.matches ?? []).filter(m => own(m)).map(({ from: rf, to: rt, ...m }) => {
    // An earlier version stores a returned report's place against its labelled Source.text (as such readings always were).
    const source = input.records.get(m.record)!, at = rf !== undefined && rt !== undefined ? { at: rf, length: rt - rf } : quoteAt(source.text, m.quote)!, shift = four ? 0 : texts.get(source.id)?.shift ?? 0, stored = { ...m, record: source.id, from: shift + source.from + at.at, to: shift + source.from + at.at + at.length };
    if (!three) return stored;
    const { replaces: key, ...rest } = stored as typeof stored & { replaces: string | null };
    const ref = key === null ? undefined : input.priors?.get(key), cur = ref && now.find(x => x.reading === ref.reading && x.index === ref.index);
    const holds = !!cur && !cur.excluded && !cur.replacedBy && !!cur.target && sameTarget(cur.target, ref!.target) && cur.correction === ref!.correction;
    return { ...rest, replaces: holds ? { reading: ref!.reading, index: ref!.index } : null };
  });
  const reading: MapReading = { version: six ? 'map-reading.15' : four ? 'map-reading.4' : three ? 'map-reading.3' : withRequests ? 'map-reading.2' : 'map-reading.1', id: meta.id, at: meta.at, model: meta.model, prompt: meta.prompt, hash: meta.hash,
    ...(six ? { basisAt: reply.basisAt ?? null, basisVersion: reply.basisVersion ?? null, portMap } : {}),
    records: [...input.records.values()].map(r => { const shift = four ? 0 : texts.get(r.id)?.shift ?? 0;
      return shift ? { id: r.id, from: r.from + shift, to: r.to + shift, total: texts.get(r.id)!.raw.length } : { id: r.id, from: r.from, to: r.to, total: r.total, ...(four ? { digest: textDigest(r.text) } : {}) }; }),
    ...(six ? { exclusions: (EXCLUSIONS.get(reply) ?? []).map(x => { const source = x.record ? input.records.get(x.record) : null;
      return { ...x, record: source?.id ?? null, from: source && x.from !== null ? source.from + x.from : null, to: source && x.to !== null ? source.from + x.to : null }; }) } : {}),
    summary: comparisonOnly ? '이미 지도에 읽은 원문을 고른 요청과 다시 대조했어요.' : reply.summary, parts, relations, candidates: candidates.slice(0, 16), gaps: reply.gaps, skipped: skipped.slice(0, 64),
    ...(withRequests ? { requests: structuredClone(frozen), matches } : {}),
    ...(four ? { material: material.map(m => { const source = input.records.get(m.record)!; return { record: source.id, from: source.from + m.from, to: source.from + m.to, what: m.what }; }) } : {}) };
  // Anchored: a reply that gets nothing out of the records (no part, claim, line, candidate or match) and says why with gaps
  // (material it found lacking) is not kept: the records stay unread for the person to ask again (NOTHING_READ). A reply with
  // nothing to change and no such reason (the records add nothing to the map as it is) is a reading, kept as before.
  if (four && !parts.length && !relations.length && !candidates.length && !matches.length && reply.gaps.length) throw new Error('NOTHING_READ');
  p = addReading(p, reading);
  const next = parseProject(JSON.stringify(p));
  const corresponding = matches.filter(m => m.targets.length === 1).flatMap(m => {
    const target = m.targets[0]!, req = input.ask.requests?.find(q => q.id === target.requestId);
    return req?.items.find(i => i.id === target.itemId)?.partIds.filter(active) ?? [];
  });
  return { project: next, reading, created, touched: [...new Set([...parts.map(x => x.areaId), ...corresponding])] };
}
