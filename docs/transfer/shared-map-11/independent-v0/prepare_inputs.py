from pathlib import Path
import json,copy,hashlib,re
r=Path(__file__).resolve().parent;site=r/'fix1';td=site/'test-inputs';td.mkdir(exist_ok=True);flow=json.loads((site/'fixtures/flow091.json').read_text());pt=json.loads((site/'fixtures/powertoys.json').read_text());manifest={}
def save(name,d):
 b=(json.dumps(d,ensure_ascii=False,indent=2)+'\n').encode();(td/(name+'.json')).write_bytes(b);manifest['test-inputs/'+name+'.json']={'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
def renamed(d,mapping):
 d=copy.deepcopy(d)
 for n in d['nodes']:n['id']=mapping.get(n['id'],n['id']);n['parent']=mapping.get(n['parent'],n['parent'])
 for e in d['relations']:e['from']=mapping.get(e['from'],e['from']);e['to']=mapping.get(e['to'],e['to'])
 iv=d['initialView'];iv['expanded']=[mapping.get(x,x) for x in iv.get('expanded',[])];iv['layout']['place']={mapping.get(k,k):v for k,v in iv['layout']['place'].items()};return d
x=renamed(pt,{n['id']:'probe_'+str(i) for i,n in enumerate(pt['nodes'])});x['caseId']='independent-renamed-input';save('id-renamed',x)
x=copy.deepcopy(flow)
for n in x['nodes']:n.pop('change',None)
save('changes-absent',x)
x=renamed(pt,{'SR':'C32'});x['caseId']=flow['caseId'];save('same-node-id-across-cases',x)
x=copy.deepcopy(pt);x['nodes'][1]['parent']='missing_parent';save('invalid-parent',x)
x=copy.deepcopy(pt);x['nodes'].append({'id':'grandchild','parent':'SR','name':'시험 깊이','role':'지원하지 않는 깊이 오류 검사용'});save('invalid-depth',x)
x=copy.deepcopy(pt);x['relations'][0]['to']='missing_endpoint';save('invalid-endpoint',x)
x=copy.deepcopy(pt);x['nodes'].append(copy.deepcopy(x['nodes'][1]));save('invalid-duplicate',x)
x=copy.deepcopy(pt);x['nodes'][1]['parent']='RC';x['nodes'][2]['parent']='SR';save('invalid-cycle',x)
(r/'test-input-manifest.json').write_text(json.dumps({'method':'Independent static JSON file derivatives, no app state injection, not third real-use cases','files':manifest},indent=2))
expected=json.loads((r/'EXPECTED_SEMANTICS.json').read_text());L=expected['FLOW091']['independentLiterals'];assertions=[]
def ck(id,ok,data=None):assertions.append({'id':id,'status':'PASS' if ok else 'FAIL','details':data})
ck('flow-roots',[(n['id'],n['name']) for n in flow['nodes'] if n['parent'] is None]==[(g,L['NAMES'][g]) for g in expected['FLOW091']['roots']]);ck('flow-change-owner',[n['id'] for n in flow['nodes'] if n.get('change')]==['C32']);ck('flow-relations-exact',[(e['id'],e['from'],e['to'],e['kind'],e['condition']) for e in flow['relations']]==[(rid,a,b,L['KINDS'][rid],L['CONDITIONS'][rid]) for rid,a,b in L['RELS']])
base=L['LINKBASE'];fanchors={'F1':'#L52','F2':'#L10','F3':'#L11','F4':'#L12','F5':'#L13','F6':'#L14','F7':'#L15','F8':'#L16','F9':'#L17','F10':'#L18-L22','F11':'#L33-L41'};ck('flow-all-F-exact-href',{e['id']:e['source']['url'] for e in flow['evidence']}=={f:base+a for f,a in fanchors.items()})
P=expected['PowerToys'];ck('pt-node-boundary',{n['id']:n['parent'] for n in pt['nodes']}==P['parents']);ck('pt-only-support-relation',[(e['id'],e['from'],e['to'],e['kind']) for e in pt['relations']]==[('X1','HK','RC','이벤트 종류 전달')]);ck('pt-changes-evidence',{n['id']:n['change']['evidence'] for n in pt['nodes'] if n.get('change')}=={'SR':['RVS','PS','RPS'],'RC':['RVR','PRC'],'HK':['PH']});ev={e['id']:e for e in pt['evidence']};ck('pt-human-request-hrefs',ev['RVS']['source']['url']==P['searchRequestHref'] and ev['RVR']['source']['url']==P['recordRequestHref']);ck('pt-author-merge-boundary',ev['RPS']['source']['url']==P['authorReplyHref'] and '수정 주장' in ev['RPS']['type'] and '녹화 수정의 성공 근거로 넓히지' in ev['RPS']['limits'] and '병합은 출시' in ev['PRS']['limits']);ck('pt-X1-exact-hrefs',[ev[e]['source']['url'] for e in pt['relations'][0]['evidence']]==P['X1Hrefs']);ck('pt-actual-change-directions','args.QueryText' in next(n['change']['after'] for n in pt['nodes'] if n['id']=='SR') and 'isKeyDown' in next(n['change']['after'] for n in pt['nodes'] if n['id']=='RC') and '별도 요구 아님' in next(n['change']['label'] for n in pt['nodes'] if n['id']=='HK'))
engine=(site/'engine.js').read_text();css=(site/'style.css').read_text();bias=re.findall(r'\b(?:FLOW091|PowerToys|C32|C21|G3|X1|SR|RC|flow091|powertoys)\b',engine+css);ck('generic-engine-css-no-case-literals',not bias,bias);ck('shared-entry-asset-references','src="engine.js"' in (site/'index.html').read_text() and 'href="style.css"' in (site/'index.html').read_text())
result={'kind':'Static literal checks separate from real browser paths','checks':assertions,'passed':all(c['status']=='PASS' for c in assertions)};(r/'static-semantics.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps({'staticPassed':result['passed'],'failed':[c['id'] for c in assertions if c['status']=='FAIL'],'testInputFiles':len(manifest)}));assert result['passed']
