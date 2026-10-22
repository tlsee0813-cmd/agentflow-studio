from pathlib import Path
import os,json,traceback,sys
R=Path(__file__).parent;O=R/'storage-boundaries';O.mkdir(exist_ok=True);os.environ['IDEA015_EVIDENCE_DIR']=str(O)
from helpers import H,UI,base,expect
x=H();x.setUpClass();runs=[];m=json.loads((R/'fixtures/powertoys-meta.json').read_text())
try:
 for w,h in [(1280,720),(1440,900)]:
  for scenario in ['pending-duplicate-storage-failure','late-save-no-navigation-steal']:
   x.setUp();run={'viewport':[w,h],'scenario':scenario,'checks':[],'injectionBoundary':'Public navigator.locks held from another isolated tab; only storage-failure case overrides platform Storage.setItem with synthetic quota after fixture setup. No product state/API injection.'};runs.append(run);u=UI(x,w,h,run);p=u.p;holder=None
   try:
    u.load(R/'fixtures/powertoys-draft.json');u.work();base.saved(p);before=x.state();entry=p.evaluate('document.documentElement.dataset.entryId');holder=x.ctx.new_page();holder.goto(x.url);holder.evaluate("()=>new Promise(held=>navigator.locks.request('agentflow.idea015.workspace',()=>new Promise(release=>{window.__cycle20Release=release;held(true)})))");r=u.receive(R/'fixtures/powertoys-plain.json',wait=False);T=r['receipt']['reportTaskId'];run['pendingReceipt']=r;run['storedWhilePending']=u.stored();u.ck('actual-save-pending-no-auto-reader',r['saving'] is not None and r['receipt']['saveState']=='pending' and r['work'] and not r['task'] and u.stored()==before,r)
    if scenario=='pending-duplicate-storage-failure':
     memory1=u.backup(O/f'{w}-pending-memory-backup.json');d=u.receive(R/'fixtures/powertoys-plain.json',wait=False);memory2=u.backup(O/f'{w}-duplicate-pending-memory-backup.json');u.ck('duplicate-pending-no-extra-task-revision-time',d['receipt']['duplicate']=='true' and d['receipt']['reportTaskId']==T and memory2==memory1 and len(memory1['tasks'])==len(before['tasks'])+1,{'duplicateReceipt':d,'memoryBeforeDuplicate':memory1,'memoryAfterDuplicate':memory2});p.evaluate("()=>{Storage.prototype.setItem=function(){throw new DOMException('independent cycle20 synthetic quota','QuotaExceededError')}}");holder.evaluate('window.__cycle20Release()');expect(p.locator('#storage-error')).to_be_visible();expect(p.locator('#received-result-receipt')).to_have_attribute('data-save-state','memory');after=u.snap();memory3=u.backup(O/f'{w}-failed-save-memory-backup.json');u.ck('failure-honest-memory-receipt-real-backup-full-comparison',after['receipt']['saveState']=='memory' and ('저장되지' in after['receiptStatus'] or '이 탭에만' in after['receiptStatus']) and '저장됨' not in after['saved'] and memory3==memory2 and u.stored()==before,{'snapshot':after,'memoryAfterFailure':memory3,'storedUnchanged':u.stored()});d2=u.receive(R/'fixtures/powertoys-plain.json',wait=False);mem4=u.backup(O/f'{w}-duplicate-memory-backup.json');u.ck('duplicate-after-failure-original-T-memory-no-fictional-save',d2['receipt']['reportTaskId']==T and d2['receipt']['duplicate']=='true' and d2['receipt']['saveState']=='memory' and mem4==memory3,{'receipt':d2,'memoryAfterDuplicate':mem4});u.open_receipt();u.ck('memory-only-report-actually-readable',p.locator('#task-pointed').get_attribute('data-report-task-id')==T and m['plain']['report'] in p.locator('#task-pointed').inner_text(),u.snap());u.reach('#task-return-origin').click();
     if w==1280:u.reach('#received-result-status');p.screenshot(path=str(O/'1280-memory-only-duplicate-receipt.png'))
    else:
     # Real user edit while saves wait, then another actual view before the lock completes.
     u.reach('#draft').fill(m['draft']+' [수신 저장대기 뒤 추가한 새 입력]');p.locator('#nav-history').click();expect(p.locator('#history-view')).to_be_visible();during=u.snap();holder.evaluate('window.__cycle20Release()');base.saved(p);after=u.snap();saved=u.stored();u.ck('late-save-preserves-new-history-view-and-later-input',p.locator('#history-view').is_visible() and not after['task'] and saved['currentTaskId']==m['B'] and saved['draft'].endswith('[수신 저장대기 뒤 추가한 새 입력]') and len(saved['tasks'])==len(before['tasks'])+1,{'beforeCompletion':during,'afterCompletion':after,'saved':saved});p.locator('#nav-projects').click();p.locator('#new-project').click();expect(p.locator('#projects-view')).to_be_hidden();newEntry=p.evaluate('document.documentElement.dataset.entryId');u.ck('other-project-no-stale-receipt-or-wrong-report',newEntry!=entry and p.locator('#received-result-open').count()==0 and not p.locator('#task-view').is_visible(),{'oldEntry':entry,'newEntry':newEntry,'snapshot':u.snap()})
   except Exception:run['fatal']=traceback.format_exc()
   finally:
    if holder:
     try:holder.evaluate('window.__cycle20Release?.()');holder.close()
     except Exception:run['holderCleanupError']=traceback.format_exc()
    run['pageerrors']=list(x.errors)
    try:x.tearDown()
    except Exception:run['cleanupError']=traceback.format_exc()
    (O/'result.json').write_text(json.dumps({'runs':runs},ensure_ascii=False,indent=2))
finally:x.tearDownClass()
code=int(len(runs)!=4 or any(r.get('fatal') or r.get('cleanupError') or r.get('holderCleanupError') or r['pageerrors'] or any(not c['pass'] for c in r['checks']) for r in runs));(O/'result.json').write_text(json.dumps({'source':'0aafca2708863036055cbd3029521b4eb983d22e','expectedRuns':4,'executedRuns':len(runs),'runs':runs,'exit':code},ensure_ascii=False,indent=2));print(json.dumps({'exit':code,'failed':[(r['viewport'],r['scenario'],c['id']) for r in runs for c in r['checks'] if not c['pass']],'fatals':[(r['viewport'],r['scenario'],r.get('fatal')) for r in runs if r.get('fatal')]}));sys.exit(code)
