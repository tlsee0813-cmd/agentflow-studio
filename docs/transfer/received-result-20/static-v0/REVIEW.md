# 20 v0 독립 정적 검토
Astra High, 2026-10-22 23:49:02–23:51:25 KST. 승인 보류.
app010CC3F4A2B19DB25350B7685ECBD54F1BF5E38E34C8FFCFE068A87A5C91B17B / CSS86DDA3C11A927D454A0086096B255271B70447BF6F9C354CA09060CD0373ED38 / HTMLC3981C397BA764554DA7416F488443EA248E6C51C6891313D01B51B568E525D0. 읽기 전후 해시 불변, 제품수정/브라우저실행 없음.

P2 부모 locator 복귀: app351은 원 origin=null이고 located만 있던 work에서 upstream=located.origin을 합성하고 priorLocation도 복제한다. restoreOrigin389는 same B이면 둘을 origin과located로 동시에 되살린다. 지도 S→A 위치 찾기→A 새 요청 입력(work B 유지)→수신 검토→검토 전 work 복귀에서 원래는located 복귀 하나인데 두 버튼이 같은S를 가리킨다. 일반 origin 복귀는 non-records locator를 소비하지 않아 S 복귀 후에도 위치찾기안내/자기복귀가 남는다. 실제origin/priorLocation 슬롯을 구분해보존, sameB는원래슬롯대로, changedC만필요한상위fallback으로좁히도록제안했다.

초기샷 CF38C0C6…530D19/C01D19DF…31C86에서는 MapOrigin(reader→소유부분찾기) 소실을발견했으며이전체원문은미회수다. v0에서해당수정, root가발견한 h1초점/duplicate pending→memory, 작성자 자체 R1/R2 같은CTA대상구분은보완확인했다. v0원문은보존하며초기미회수원문을추정복원해original이라하지않는다.
