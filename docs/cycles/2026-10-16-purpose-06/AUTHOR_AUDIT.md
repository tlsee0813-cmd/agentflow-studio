# cycle06 — 작성자 v0 수령·독립 정적 검토
2026-10-16 검토 시점. 이후 현재 상태는 [ACTIVE](../ACTIVE.md).
원본 고정 [author-v0](https://github.com/tlsee0813-cmd/agentflow-studio/tree/d16e66742fd487ef11a776fedb5b76fd35e964ea/docs/transfer/purpose-06/author-v0). ZIP wrapper purpose-v0/만 제거해 게시했으며 파일 바이트를 바꾸지 않았다.

## 수령과 실제 작성자 실행
ZIP635737B SHA256 dbe10ea948ad48b993b2def8e7da563997a82b0bc949ac08458d4f3d95bc9050. 전체45파일1010814B. 두 manifest는 같은43payload를 나열하고 자신2파일만 제외한다. 로컬43/43 bytes/SHA 및 원격45/45 base64 바이트 대조가 일치했다.
최종HTML33840B SHA256 c02ee41bd2cfffd546676f339ccb69ade9f40c0b59270f69f1146a97a503c587, run05 snapshot/HTTP/전후파일과같다. run01~04 HTML은33837B d0201cfa16bf5be4b17c921dac5c5fb1ab4211fcc480ea812a879245af787723.

작성자환경 Chromium141.0.7390.37/Playwright1.56.0. child exit 순서1/1/0/1/0. 처음2실패는검사코드(:visible와초점ID), run03은0스크롤맥락왕복만검사, run04는비초기읽기에서실제행높이변경결함, run05는상태문구자리18px고정/문구축약후통과다. 조건완화는없고마지막검사에rowBefore/After기록을추가했다. 첫실패원시JSON에는전후rowrect숫자가없어이전변화량재계산은불가하나실패조건/코드/로그는보존한다. run01의 fatal:null은경로완주가아니다. 74단언은반복검사수이며품질점수가아니다.

## 의미 검토: 정보 없음과 미결정을 구별
Astra는PNG5장을실제열람하고HTML을대조했다. 목적·역할·게시조건과자료/프로그램부분/대상구별이보인다. 준비는작은계획정리이며송신/직접배포를뜻하지않는다. 공개자체의무화문구는없다.
단, [HTML375/447행](https://github.com/tlsee0813-cmd/agentflow-studio/blob/d16e66742fd487ef11a776fedb5b76fd35e964ea/docs/transfer/purpose-06/author-v0/purpose-study.html#L375)의 ‘아직 정하지 않은 것’과 ‘방식은 정해지지 않았다’는 실제미결정을단정한다. 입력에없는방식은이미정해졌을수도있다. 총괄은 **‘이 입력에서 알 수 없는 것/제시되지 않았다’**로정정하도록Opus에배정했다. 원본v0를덮지않고fix1로구별한다. 총괄계약/입력분류의같은표현도좁혔다. 별개로계약의‘공개를건너뛰지않음’은공개할때확인·게시선택을건너뛰지않는조건으로ec035…에서정정했다.

## 코드 검토와 작성자 측정의 한계
Sol 정적검토에서추가중요기능결함은확인하지못했다. 브라우저재실행은아니다. peek의실제제거와출발위치/초점,준비편집상태,최초지도스냅샷을보존하는코드가있다. 수집기는 sys.exit(child returncode)하나 exit.json은child기록이지wrapper외부종료의별도관측은아니다.
- 지도측정은inline style.transform/dataset.scale이고computed transform이아니다.3대상rect diff는있으나원시전후목록은보존하지않았다.
- VIS는첫overflow조상만보고상단한점hit-test를한다. 모든조상clip교집합·문자전체가독성·전영역무가림을확인한것은아니다.
- 모바일기준값일부는window.__study.state.mapView를읽었다. 변조는없지만독립검사는실제보이는DOM/native scroll로측정해야한다.
- 작성자준비영역은scrollable:false,읽기는자연최대99/162px. 폭전환시100%초기화. 사람사용성·큰지도조망·혼합깊이·외부사이트왕복을검증하지않았다.

총괄도초기1440/선택390PNG를읽었다. 짧은역할과게시조건은같은중심카드에있지만390홈페이지는시야밖이다. 별도Pro에초기1440/선택390/편집준비PNG3장을직접첨부하여코드만읽던한계를보완했다. 이정적AI평가는독립Cloud조작과분리한다.

## fix1 수령과 실제 이미지 평가 후속
고정 [author-fix1](https://github.com/tlsee0813-cmd/agentflow-studio/tree/fbea41f245c4020bc044c7e0c7502d106fc900ae/docs/transfer/purpose-06/author-fix1): ZIP397834B SHAfff2044c2af4a26a0146c38e5a8dca1c31ff2b4147b041686e6e8fa228172987. 13파일503972B/manifest11payload. 로컬11/11,원격13/13바이트일치. HTML33944B SHA d3cc065a3f26f7f64a0d42c5fda9551d8ff3cd270f66badf7c262829375bc2cd. 실제diff는읽기제목/부연문/준비칸제목/기본문 네문구뿐이다. CSS/행동/검사코드는그대로이며새단일작성자run child0,74PASS/0FAIL,HTTP200·전후SHA일치. 자연도달읽기118/182px에서행rect유지기록. 이전실패는v0에보존한다. README에서computed미측정은정정했지만 ‘배율/중심이렌더실측’은과장으로남는다. 배율은dataset,중심은그값계산이며실제rect와구별한다. 원본README는그대로두고여기서경계를명시한다.

Pro는직접첨부PNG3장을실제열람했다고확인했다. 목적(상단굵은문장)·역할(중앙카드)·조건(녹색영역)이구별되며기본화면은작은구상도에가깝다는AI정적판단이다. 준비스크린샷의요청칸은검사문장이어서목적이이어지는지판단불가라고정확히남겼다. 총괄은fix1을기본1280창에서직접열어선택→역할→준비→닫기→지도복귀를읽었다. 수정전기본문은‘소개글재입력을줄일첫작은작업정리’가요청이고게시조건은별도경계로남는다. 실제GUI확인이며정확좌표검사/사람사용성으로세지않는다. Cloud기존준비경로에 **기본문을검사용문장으로바꾸기전PNG**를포함하도록배정했다. 원격PNG회수전까지총괄화면캡처는도구관측이며공유증거로주장하지않는다.
