from pathlib import Path
import os,json,sys,traceback
R0=Path(__file__).parent
exec(compile((R0/'normal-ui-main.py').read_text().rsplit('u=None;fatal=None;cleanup=[];code=1',1)[0],str(R0/'normal-ui-main.py'),'exec'))
class OwnerLines(Independent):
 def visibleLine(self,q,label):
  before=self.readState();self.reach(q);t=q.evaluate(TEXT);ok=bool(t['lines']) and any(x['positive'] and x['full'] and x['hit'] for x in t['lines']);self.check(ok,label,{'textRange':t,'before':before,'after':self.readState()});return t
 def focusedRun(self,w,h):
  self.configure(w,h);self.click(self.p.locator('#branch-records-'+self.P),'focused actual P record entry');self.signalCheck(self.P,'focused P first record before scrolling')
  row=self.p.locator('#subtree-records-'+self.P+' .subtree-record[data-owner-area="'+self.Q+'"]');self.visibleLine(row.locator('p.source-meta').first,'two levels below P real Q owner line visible');self.visibleLine(row.locator('p.hint').first,'Q actual recorded question answer-status line visible');self.check(self.project()['space']['containment']['parents'][self.Q]==self.S and self.project()['space']['containment']['parents'][self.S]==self.P,'two-level Q lineage remains exact IDs',{'P':self.P,'S':self.S,'Q':self.Q})
  for aid,label in [(self.P,'현재 설명'),(self.S,'이전 기준'),(self.project()['space']['areas'][3]['id'],'보류')]:
   q=self.p.locator('#subtree-records-'+self.P+' .subtree-description[data-owner-area="'+aid+'"] > span');t=self.visibleLine(q,'actual description owner/status visible '+label);self.check(label in t['text'],'actual prepared status wording '+label,t)
  self.closePanel('branch-records-'+self.P,'focused P close');self.click(self.p.locator('#branch-records-'+self.D),'same-name different-parent actual entry');self.signalCheck(self.D,'focused other actual first child owner');ret=next(t for t in self.project()['tasks'] if t.get('resultFile') and t['resultFile']['taskId']==self.Ltask);call=self.p.locator('#subtree-task-'+ret['id']);self.reach(call);pre=self.readState();g=call.evaluate(GEO);call.click();self.check(self.p.locator('#task-pointed').get_attribute('data-report-task-id')==ret['id'] and ret['areaId']==self.L and self.project()==self.baseline,'other same-name parent exact actual-H child report selection',{'report':ret,'sourceH':ret['resultFile']['returnId'],'screen':self.p.evaluate(SNAP)});self.click(self.p.locator('#task-return-origin'),'other parent report exact origin return');post=self.readState();gg=self.p.locator('#subtree-task-'+ret['id']).evaluate(GEO);self.check(post['panel']['owner']==self.D and self.p.evaluate('document.activeElement.id')=='subtree-task-'+ret['id'] and abs(gg['rect']['top']-g['rect']['top'])<=2 and self.project()==self.baseline,'other report returns own same-name parent not old P',{'before':pre,'after':post,'callerBefore':g,'callerAfter':gg});self.p.screenshot(path=str(R/f'{w}-other-parent-exact-report-return.png'));self.closePanel('branch-records-'+self.D,'other actual report then branch caller close')
  # A replayable backup is produced by the real product UI, not the read-only project dump.
  self.detail('project-management')
  with self.p.expect_download() as d:self.click(self.p.locator('#backup'),'actual UI backup of independent normal preparation')
  target=R/f'{w}-normal-ui-prepared-backup.json';d.value.save_as(str(target));self.log('actual normal UI backup saved',{'path':str(target),'sha256':sha(target.read_bytes())});self.rows.append({'viewport':[w,h],'complete':True,'QquestionTwoLevels':self.Q,'D':self.D,'Lowner':self.L,'exactReport':ret['id']})
u=None;fatal=None;cleanup=[];code=1
try:
 u=OwnerLines();u.checks=[]
 for w,h in [(1280,720),(1440,900)]:u.focusedRun(w,h)
except Exception:fatal=traceback.format_exc();print(fatal,file=sys.stderr)
finally:
 if u:cleanup=u.close()
 bad=[x['label'] for x in u.checks if not x['pass']] if u else [];code=int(bool(fatal or not u or len(u.rows)!=2 or bad or u.errors or cleanup))
 (R/'result.json').write_text(json.dumps({'sourceCommit':'0d9831b1141fe14ba0ce91dfc762ce9119041348','scope':'narrow actual owner/status lines and other same-name report return; not rerun full modes/project/fallback','expectedPC':2,'completed':u.rows if u else [],'checks':u.checks if u else [],'failedChecks':bad,'fatal':fatal,'pageerrors':u.errors if u else [],'cleanup':cleanup,'plannedChildExit':code},ensure_ascii=False,indent=2))
sys.exit(code)
