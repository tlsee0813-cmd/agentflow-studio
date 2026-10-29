# 120 새 부분 ID 어휘 계약 일치

119의 실제 정상 경로는181초에 JSON을 받았지만 new:labelGuide/new:labelLookup가 기존소문자 NEW문법을위반해즉시거절됐다. 생성안내의 ‘짧은영문키’와 실제허용문법사이의틈을메운다. 이번수정은지도를성공적으로만들었다는수용이아니다.

## 선택

1. later map.7 실제생성안내에 `new:` 뒤의 키는 ASCII 소문자 a–z/숫자0–9/밑줄/하이픈으로1–24자이며 전체형식은 `^new:[a-z0-9_-]{1,24}$`라고정확히명시한다. new:label_guide 같은유효예를사용한다. 이름(name)은사용자언어로쓸수있다. parent·relation from/to·candidate parts는정의된같은ID를철자그대로참조한다.
2. 118조건길이표·조건의미·원자료종류·불확실성계약과ask/wire/storage/span2/bounds는그대로둔다. map1–6/FIRST6 및 기존 MAP7 base text는불변으로두고, 별도later7지침으로결합한다. 단일renderer가양경로에전달하며recipe/actualpromptSHA가새지침을포함해야한다. 변경된recipe는oldready7회수에는영향없고oldm7새접수는기존PROMPT_CHANGED로거절한다.
3. map7의parts first-pass에서form()/obj()검사순서를지키고현재compoundref조건이기존에거절하던경우만구조화MapReplyError로진단한다. path parts[i].ref, 기존reference rule, target은invalid-new-key/unknown-part/duplicate-part등고정분류만허용해원문문자열을반사하지않는다. old1–6 generic진단은유지한다. 수용집합·검사순서·원자거절을변경하지않는다.

## 제외

ID를trim/lowercase/재할당하거나부모·관계별칭을고쳐서응답을통과시키지않는다. uppercase허용·길이확장·MAP8/새schema·출력수선·자동retry·time/token증가·원자료편집은없다. 실패119를수정하거나validator에다시넣지않는다.

## 완료 기준

- 새 합성검사에서new:a/new:label_guide/new:label-guide/new:a0/24자유효;대문자/빈키/25자/비ASCII/공백거절. 동일한소문자부분의부모·관계참조가유지되고잘못된참조는그대로거절된다. 실제실패응답을fixture로수리하지않는다.
- map7진단path/고정target및원자거절,old1–6행동/지침불변. 일반JSONsyntax와contract분리유지.
- 실제117ask는Root비공개원본으로새prompt/recipe/stdin을정적계산만한다.118조건표행결과exact,양경로single-renderer바인딩/다시계산불일치차단,oldready7회수0새호출/oldrecipe새접수거절. 기존광범위검사반복은변경의영향범위에맞춘다.
- 작성자검사와Root잠금TS5.8.3/Node24.19·독립delta·정확HEAD CI를구별한다. UI제품코드변경이없으므로모의전체PC흐름을반복하지않고다음실제반환관문에서확인한다.
- 다음실제관찰은120수용뒤별도선택. 같은원projectdd5·bundlecdf·ask579741·RQ0797·기존10기준·299/300초1회유지,새prompt만동결. 제품중심종료선은ready→명시적용→근거/복귀→백업/의미판정이다.

공개73/미수용74/UI75수리·keys/stash·116미커밋을보존한다. 큰기반확장이나공개배포는이번범위가아니다.

기준 SHA: 4858121f20e97e9c10ab523b1a8945a5ba003064 (119 결과만; app tree71ddbda17b49bf20bfe26fc399222065fd6339b0). 119 정적독립검토는새어휘안내/같은조건의진단분리를권고했다.
