from pathlib import Path
import json,hashlib,csv,subprocess,datetime
R=Path(__file__).parent;old=Path('/workspace/browser-env/reentry32-observer/payload');sha=lambda b:hashlib.sha256(b).hexdigest();repo='/workspace/agentflow-studio';originalCommit='57896a27266c20b21ac1c3b2a94ba27ca7294eec';prefix='docs/transfer/reentry-judgment-32/observer-a/v0/'
manifest=list(csv.DictReader((old/'MANIFEST.tsv').open(),delimiter='\t'));verified=[]
for row in manifest:
 b=(old/row['path']).read_bytes();assert len(b)==int(row['bytes']) and sha(b)==row['sha256'];verified.append(row['path'])
remoteManifest=subprocess.check_output(['git','-C',repo,'show',originalCommit+':'+prefix+'MANIFEST.tsv']);assert remoteManifest==(old/'MANIFEST.tsv').read_bytes()
original=json.loads((R/'input-original/generated-v0/sealed-answer/QUESTION_SIGNAL_PROOF.json').read_text());actual=json.loads((R/'results/QUESTION_SIGNAL_PROOF.Node22.json').read_text());assert {k:v for k,v in original.items() if k!='runtime'}=={k:v for k,v in actual.items() if k!='runtime'}
comparison=[
 {'topic':'목적·포함구조','originalObservation':'파일 앞부분/오류행/내보내기 목적, 두부모·세자식·연결을 읽음','postFacts':'5영역, A/B는읽기검토소속,C는출력준비소속,두관계','classification':'맞게 읽음'},
 {'topic':'질문2의의미','originalObservation':'상세에서미리보기답변있음/오류행답변없음을구분;질문수를미답/새것으로세지않음','postFacts':'A answered=true/applicability answered, 정식answer이고test_answer아님; B answered=false/active','classification':'맞게 읽음'},
 {'topic':'오류행선택상태','originalObservation':'B현재설명/사용자구상에서중단또는제외미선택을읽음','postFacts':'B T0/T2설명과수동네값동일,해당질문미답유지','classification':'맞게 읽음; 우선순위유일정답아님'},
 {'topic':'현재작업/별개초안','originalObservation':'현재작업4는출력안내,미전송은읽기검토이며명시이어가기전유지','postFacts':'D current/owner output, draftTarget read, Dmanual T0/T2불변','classification':'맞게 읽음'},
 {'topic':'미리보기최신내용','originalObservation':'첫지도에서질문2/현재설명2동일로변경/최신성판단불가;A의현재설명전문은읽지않음','postFacts':'A r1데이터10행→r2데이터20행변경→r3동일20행재서술,최신changes[]; A U/N10→20,scope/checks유지','classification':'몰랐고 확인하지 않음; 후행발견으로최초인지를고치지않음'},
 {'topic':'내보내기보류사유','originalObservation':'출력부모의보류신호만봄,현재사실로채택하지않고원인판단유보','postFacts':'C기존r1current.invalid유지;CSV만명시범위가있는데CSV/XLSX늦은설명은plan-changed held1/revisionnull','classification':'보류신호는맞게읽음; 정확사유/CSV조건/원문은안봄'},
 {'topic':'원보고/H와이력','originalObservation':'선택전기존원보고전문0회; B현재설명/질문으로선택','postFacts':'도구는원H6건의sha/UTF16chars/digest/work/record와return raw6건duplicate연결을후행확인','classification':'최초안본것; 이번검산성공을UI인지로세지않음'},
 {'topic':'시간·새것·last-read','originalObservation':'숫자로새것/중요도판단불가;T0/T2는새entryId복구사본이라고한정','postFacts':'B오래됨은사건순서기준,일수backdate아님;last-read/unread기준없음;Project.id같지만entryId별도','classification':'모름을유지한한정과맞음;행동선택을오답채점하지않음'}]
(R/'POST_COMPARISON.json').write_text(json.dumps({'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'firstObservationCommit':originalCommit,'firstPayloadSelfExcludedFilesUnchanged':len(verified),'firstManifestRemoteByteEqual':True,'noOriginalRewriteOrUIRerun':True,'proofOnlyRuntimeChanged':{'original':original['runtime'],'actual':actual['runtime'],'allOtherFieldsEqual':True},'comparisons':comparison},ensure_ascii=False,indent=2))
print('first payload intact',len(verified),'proof',original['runtime'],'->',actual['runtime'])
