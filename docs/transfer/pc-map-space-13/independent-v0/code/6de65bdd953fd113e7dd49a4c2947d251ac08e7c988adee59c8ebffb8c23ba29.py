from pathlib import Path
import json,hashlib
R=Path(__file__).parent;r=json.loads((R/'features/run02/result.json').read_text());rows=[]
for s in r['scenes']:
 if s['id'].startswith('records-'):
  name=s['id'][8:];p=json.loads((R/f'features/{name}.json').read_text());requests=[t for t in p['tasks'] if next(x for x in p['sources'] if x['id']==t['sourceIds'][0])['kind']=='request'];reports=[t for t in p['tasks'] if next(x for x in p['sources'] if x['id']==t['sourceIds'][0])['kind']=='report'];expected=[]
  if reports:expected.append('check-open-'+reports[-1]['id'])
  q=next((t for t in requests if next(x for x in p['sources'] if x['id']==t['sourceIds'][0])['text'].startswith('빈자리가 나면')),None)
  if q:expected.append('check-open-'+q['id'])
  actual=[b['id'] for b in s['row_buttons']];assert actual==expected,(name,expected,actual)
  nav=None
  if expected:
   task=reports[-1] if reports else q;task=next(t for t in p['tasks'] if t['id']==task['parentTaskId']) if reports else task;expected_title=next(x for x in p['sources'] if x['id']==task['sourceIds'][0])['text'];nav=s['target_read']==expected_title;assert nav,(expected_title,s['target_read'])
   if reports:assert next(x for x in p['sources'] if x['id']==reports[-1]['sourceIds'][0])['text'] in s['pointed_report']
  rows.append({'fixture':name,'expected_button_ids':expected,'actual_button_ids':actual,'expected_target_title_matches':nav,'status':'PASS'})
 if s['id'].endswith('area-add-and-global-error'):
  assert all(x['notice']['hit'] and x['notice']['rect']['y']>=0 and x['notice']['rect']['y']+x['notice']['rect']['h']<=(720 if s['id'].startswith('1280') else 900) for x in s['error_views'])
(R/'recomputed-raw-checks.json').write_text(json.dumps({'source_raw':'features/run02/result.json','raw_sha256':hashlib.sha256((R/'features/run02/result.json').read_bytes()).hexdigest(),'kind':'postprocessing exact expectations against preserved executed DOM observations, no browser rerun','records':rows,'error_notice_all_viewport_hit':True},ensure_ascii=False,indent=2));print('raw recomputation PASS')
