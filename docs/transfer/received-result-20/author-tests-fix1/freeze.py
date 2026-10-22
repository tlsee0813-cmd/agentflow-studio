import hashlib,json,shutil,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[1];out=root/'evidence';author=root.parent/'product20-author'
sha=lambda b:hashlib.sha256(b).hexdigest().upper()
files=[];snapshot=out/'frozen-test-sources'
owned=['app/continuity/tests/received20_browser.py','app/continuity/tests/received20-fixtures.mjs','app/continuity/tests/home15_browser.py','.github/workflows/verify.yml','app/continuity/tests/understanding17_browser.py']
for path in owned:
    raw=(root/path).read_bytes();dest=snapshot/path;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(raw)
    files.append({'path':path,'bytes':len(raw),'sha256':sha(raw)})
base=json.loads((out/'BASELINE.json').read_text(encoding='utf-8'))
for item in base['copiedOnlyAfterRemoteGitBlobCheck']:
    if item['path'] not in owned:assert sha((root/item['path']).read_bytes())==item['sha256']
product=[]
for path in ['app/continuity/src/client/app.ts','app/continuity/public/styles.css','app/continuity/public/index.html']:
    product.append({'path':path,'sha256':sha((author/path).read_bytes())})
runtime=[]
for path in ['public/shared/domain.js','public/shared/types.js','public/shared/validation.js']:
    runtime.append({'path':'app/continuity/dist/'+path,'sha256':sha((root/'app/continuity/dist'/path).read_bytes())})
checks=[]
for path in sorted(out.glob('*.exit.json')):checks.append({'file':path.name,'raw':json.loads(path.read_text(encoding='utf-8'))})
receipt={
 'overlayRoot':str(root),'baseline':'da3b0171c807dc7241f5fff0ce4f19ba3f2ef463','contractAddendum':'e8ba6fee4fc6121b79858ad2d4408eebd881b02d/docs/cycles/2026-10-22-received-result-20/INPUT.md',
 'ownedPublicationFiles':files,'patch':'evidence/received20-tests.patch','snapshot':'evidence/frozen-test-sources','productReadOnly':product,'compiledFixtureRuntimeReadOnly':runtime,
 'scope':'Tests/fixture/workflow overlay only. No product source changes, git index writes, commit or push. Generated dist junction is read-only use of author build and is excluded from publication.',
 'coverage':[
  'Both PCs1280x720/1440x900: two bounded source-linked reconstructions, return1/no-understanding and return2/held; Bcurrent/draft/target/aux drafts, prior task/source bytes, area ideas/layout and unsaved B note/camera retained. Explicit receipt matches actual reportT, root request, export task and H. Product13 export-task differs from root request.',
  'Exact H1 four-value export snapshot vs newer H2 and current root work all differ. Folded snapshot and full report are explicitly read; report tail Range/clip/hit uses native wheel. Raw JSON textarea plus actual downloaded UTF8 bytes stay exact. Reading/return restores actual work caller focus/Y/disclosures without saved writes or AI calls.',
  'Same H different report creates a distinct actual T; whitespace-different exact duplicate links original first T rather than latest second T and preserves entire persisted project. Wrong task with existing H is rejected after preview readiness. New B input and project switch cannot relink old receipt.',
  'Named faults: actual Web Lock holds save; duplicate receipt while save pending; Storage.setItem quota injection then lock release. Actual pending report identity must persist into visible memory-only status and exact backup. Archived owner stays archived, no active locate substitute; its action opens existing B draft rather than relabelling it as a new A request. Held description and exact snapshot; legal pasted report has no guessed snapshot. A second actual backup after both reads compares the entire in-memory project, independently of unchanged stored bytes.',
  'Actual pending save -> user History navigation -> release cannot auto-open work/reader. Separate no-draft fixture for recordsR -> B work -> A reader -> real owner locate -> native newC -> work return keeps C and actual stable title focus -> receipt reopen -> exact parent recordsR caller. Existing records reader owner locate roundtrip checked before compound path.',
  'Independent located-only case starts without a draft; user explicitly opens an A request input (current B remains, target A, no new task). Capture this post-action work baseline. Original origin=null/located=S slots remain separate after receipt roundtrip; only one locate-back, no synthetic work origin or ghost self-return. S exact caller/camera and baseline saved data retained.',
  '390 minimum only: exact receipt/read/close, no horizontal overflow, B/draft retained. Existing WORKSPACE19/AREA18 and all earlier CI steps preserved.'
 ],
 'nativePreparation':'Wheel is native input, observed trusted activation and matching actual scrollend with bounded failure-only timeout and cleanup/raw diagnostics. No fixed sleep, CSS formula, DOM scrolling/resize or product hook in RECEIVED20. Explicit return assertions observe immediately without scrolling to repair the caller.',
 'home15Followup':'Cycle20 regression-strengthening candidate from separate19 followup: phase pageY/max/focus facts in test08 and actual middle background before body End in test10. All138 prior expectation calls/native key calls remain; no added fixed waits. Not a claimed fix for prior19 CI272!=120; extra observations may influence timing.',
 'checks':checks,'runtime':'Node v24.19.0 supplementary. Actual Cloud/CI Node22 + browser execution remains separate.',
 'failureHistory':'Initial fixture smoke exit1 was missing dist after an incorrect cwd-relative junction preparation command; Node raw stderr/stdout/exit retained as received20-fixture-smoke.*. PowerShell path errors remain in tool transcript. Correct relative target linked only inside test overlay; subsequent four-combination smoke exit0. No product failure/pass inferred.',
 'staticReviewAmendments':{'originalFreeze':'evidence/v0-pre-review-857724','independentFinal':'Astra re-read browser3DDE1649…EF90F4 and unchanged fixture/HOME/workflow; no additional actionable static finding. No browser/server execution claimed.','observationsNotBrowserFailures':['Astra found located-only test05 draft/target precondition conflict; corrected to explicit no-draft A input and a post-action baseline.','Astra found new-input receipt branch skipped after invalid-file selection cleared receipt; moved live-receipt input/read check before invalid selection and removed conditional skip.','Astra found memory-read protection only observing stored project; second actual backup now compares full in-memory state.','Author found archived owner with existing B draft must offer existing-input action, not a disabled A-new-request action; assertion follows the existing draft-protection policy.']},
 'afcActualFailureFollowup':{'originalFailureEvidence':'2309aec1b2caafb67e7842a6ca925342dd5064fa/docs/transfer/received-result-20/independent-v0/failure-first/NOTE.md','priorFreeze':'evidence/v1-3DDE-before-no-export','proof':'evidence/AFC_FOLLOWUP_PROOF.json','incrementalPatch':'evidence/received20-afc-followup.patch','initialReadingLimitation':'Meaningful report/idea openings remain, but some next-action controls are below the first fold. New tests record that initial geometry and verify ordinary native access with full clip/hit; do not claim initial visibility. Existing REPORT16 and SPATIAL102 guards are exact unchanged.','staticReview':'Astra directly re-reviewed F489370D…C853E/7F5B7AC…9265B2 and accepted narrow changes; root approved. No future browser pass claimed.'},
 'notRun':['local server','browser tests','paid AI','provider/external execution','product type/build by this test author (separate UI author owns those checks)'],
 'limits':'Source and static checks establish reviewable wiring only, not browser pass, usability, semantic conflict detection or solved HOME15 discrepancy. Faults and synthetic input boundaries are labelled. Independent reviewer may request narrow amendments after this freeze.'
}
(out/'TEST_FINAL.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'publicationFiles':files,'receipt':str(out/'TEST_FINAL.json'),'browser':'NOT RUN','server':'NOT STARTED'},ensure_ascii=False))
