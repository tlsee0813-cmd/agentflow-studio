# Cycle18 fix4 독립 실행 결과

**실행한 고정 범위에서 제품 실패 미발견.** 최종 수용·양OS CI 판단은 root가 통합한다. 제품 **73fd6ff82ca035dd9b2e74385ce9194db0b57791**, tree **a029049fdee6b060bd5d0a90ea1f9ff7f62fc37e**, app.ts SHA256 **b5a6fde628584d85097840b61ebf918f2e609ff08b060bc540f72a4ef2695c4a**. SOURCE_BEFORE/AFTER의188파일 크기·SHA가동일하다. 기존 [fix3 실패원본 ebcd3947](https://github.com/tlsee0813-cmd/agentflow-studio/tree/ebcd3947032000bdce086469f695ec884a71db06/docs/transfer/mixed-depth-18/independent-fix3) 및9330/초기증거는변경하지않았다. 정확소스는 [고정tree](https://github.com/tlsee0813-cmd/agentflow-studio/tree/73fd6ff82ca035dd9b2e74385ce9194db0b57791/app)에있으며전체소스/빌드/node_modules/cache를증거에중복하지않는다.

## 정확 작성자 검사와 독립 실행

| 검사 | 실제 결과 | child exit |
|---|---|---|
| PC13 전체 | 14/14 | 0 |
| H18 전체 | 12/12 | 0 |
| AREA17 전체 | 12/12 | 0 |
| PC12 전체 | 15/15 | 0 |
| HOME15 전체 | 21/21 | 0 |
| REPORT16 전체 | 13/13 | 0 |
| static | 1/1 | 0 |

Node22 type/build/continuity check/build/static build는각exit0, domain261/261이다. 표는각원본script를이환경에서실제실행한결과이며작성자보고를재인용한것이아니다. 아래독립UI관측수와합산하지않는다. PC13/H18원본은첫실행에서통과했고이후후속5개suite를분리실행했다.

독립 core2표본×2PC4흐름, longUI, list/keyboard extraUI, 일반Escape, 원질문+trial reply UI/publicAPI state, fresh camera, view protection, PC13기존가림4장면×양PC의읽기전용진단은모두exit0. 동일입력/의미단언을유지하고제품경로와source표기만바꿨다. 원래관계ID배열중복전원시값·actual끝점/대표끝점/종류·direct/hidden/internal을보존한다. UI의기본조건은ID/개수/중복/노트대조이며kind/direction/bundle의명시기대대조는별도state.mjs에있다. 모든DOM kind를UI단언으로자동대조했다고확대하지않는다.

## 실제 RB→A 복귀 개선

RB_A_COMPARISON.json은같은실행의같은caller를before/after로비교한다.

- 출발: body y601.703125/h228.296875, scroll128/max218, caller y789.3125..825.3125.
- 복귀: 같은body/같은caller rect, **scroll128/max300**, caller y789.3125..825.3125.
- y delta0, matrix동일, focus가실제caller, 3점hit모두true. footer y830이므로가리지않는다.

fix3의scroll128→70/y+58/footer hit=panel-open 반례와구별된다. 원점raw는복귀직후추가wheel/focus/fit보정전에측정했고전체원래PC13역시통과했다. H18원래3caller-anchor실패/중간읽기·clamp·context/Escape/입력·저장보호도전체원본에서통과했다. H18의work에서context실제표시와space에서숨은상위+retainedflag/aria는구별한다.

## 실제 독립 보호 관측

- PowerToys/product13 source-restated두입력×1280/1440:실제3수준/가지접기/소유자질문·설명/원래관계와실제자식선택/새요청/명시결과파일용clipboard/원점관계읽기복귀/저장작업유지.
- 정상request에먼저존재한원질문+정확시험답변은소유자기록이남고실제답변으로승격하지않는표시를확인했다. 처음부터시험문맥으로생성한질문과구별한최소API입력/정상답비교군/원시전후를포함한다.
- 긴60자제목/2000자note/무공백URL/5+요청의고정header/footer/행동,실제bodywheel,지도·page불변,A→B→A,미저장입력,비자손B를허위포함하지않는frame생략fallback은같은long probe로실행했다. box·표본hit는모든글자의인쇄잉크/사람가독성증명이아니다.
- list중간읽기/일반입력Escape/실제키isComposing=true(CDPcomposition)후flag·focus·입력유지,일반bodyEscape닫힘을별도확인했다. OS IME·author synthetic dispatch와혼동하지않는다.
- fresh page최초지도미조작camera→native resize→프로젝트목록→동일프로젝트에서camera/world좌표·목록원카드focus/재진입space-titlefocus유지. 별도native비기본zoom/pan은실제이동했고,새영역생성으로실제camera이동이발생한뒤선택개폐/resize가새camera를최초fit으로덮지않았다. 명시locate복귀는core4에서별도확인했다.
- 기존info/map-fit가림4장면을양PC에서원래tests로실행하며단언/첫click직전rect/ancestor clip/elementFromPoint를보존했다. 8장면의info세점모두정상hit이고원본8test도모두통과했다. 숨은map fallback800x480을확정원인으로쓰지않는다.

## 최초 진단 수집기 오류는 보존

최초author단계는정확PC13/H18이각각통과했으나,추가진단에포함된test01이성공해패널을닫은뒤예전실패전용teardown계측이사라진panel을읽으려해timeout했다. **초기collector/외부launcher 실제exit1을그대로보존**했다. first-positive-teardown-error의원본로그/raw/실행첫버전코드/NOTE를참조한다. 제품실패나원래test실패가아니다.

진단의대상을Wide RB-A원래test05하나로좁혀동일단언/동일beforeafter읽기계측으로재실행exit0,그뒤후속5suite를실행해각exit0이었다. test01은정확원본PC13전체와첫화면진단에서별도로실제통과했다. 단언완화/제품수정은없다. 초기9명령collector exit1과추가실행을한개의최초collector exit0인것처럼합치지않는다. initial process와remaining process는별도경로다. 첫진단스크립트는실행도중후속선택자편집이있어실행시점hash를별도로채집하지못했고,실행된첫버전은보존fix3코드의제품경로/SHA치환으로정확재구성한파일임을NOTE에명시했다. traceback/원시결과는원본이다.

## 바이트·종료·재현 경계

Node22.16/TS5.8.3/Playwright1.57/실제Chromium154.0.8037.57/Linux 기존Cloud환경을재사용했다(ENVIRONMENT.json). 설치/npm-ci/권한확대없음. source고정app+기존필수cases만별도경로에추출. fixture는public domainAPI로구성한격리합성자료+source-restated입력을정상UI import했다. paid0,사용자자료/기존preview저장소를건드리지않았다. 저자suite의fixture/fault/synthetic검사와독립nativeclick/key/wheel/clipboard관측을구별한다. hidden앱state/API/DOMscroll/forceclick/복귀후교정없음.

OSclipboard raw를먼저기록하고CRLF쌍만LF비교로정규화하는author원본조건을유지했으며download검사도원본대로실행했다. initial-camera의최초fresh page goto는HTTP200/bodybytesSHA/disk전후SHA를직접결합한다. http-runtime의모든compiled파일별HTTP/diskSHA는별도서버audit이며최초goto와혼동하지않는다. SOURCE_BEFORE/AFTER=188파일동일. source/runtime코드의복제본대신고정source/compiled바이트SHA를보존한다.

명령별actualchildexit/시작끝/원본stdout·stderr해시,외부subprocess의actualcollectorexit는process/외부processJSON에있다. TOOL_COMPLETIONS는실제tool완료후기록이고전체tool서비스원문전사라고부르지않는다. cleanup/pageerror/외부요청검증은재사용lifecycle가유지했으며실제성공종료를확인했다. 전체console원문은미수집이므로console0으로보고하지않는다. static명시CSP음성검사는원본scope다.

재현은새scratch에서고정소스app+cases를cycle18-fix4-candidate에두고이payload를형제cycle18-fix4-independent에둔다. 기존Node/TS PATH로launch-author.py와domain-collector.py/independent-launch.py를실행한다. 과거원본오류재현파일은원래evidence-root위치에서실행하도록NOTE를참조하고기존증거위에는재실행하지않는다.

이결과는사람이해/원프로젝트동작/Windows/OS IME/touch/실AI송신/무제한큰지도성공을주장하지않는다. 대표4장은core양PC/기존가림개선/실제RB-A복귀이며긴패널·비자손frame의기술근거2장을추가했다. PNG는이번원본그대로이며재가공/중복사본없음. MANIFEST는본인제외정확payload집합이다.
