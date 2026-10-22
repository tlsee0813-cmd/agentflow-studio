# PC 지도와 기록 읽기19 결과
2026-10-22 · 제한 수용. [PR10](https://github.com/tlsee0813-cmd/agentflow-studio/pull/10), 최종후보 acfafd2dd6426e3fa6fa5443bd2e67d8461608c9, checkpoint 병합41b6854e877d8cc4054dcf6af47b597602b7cf11.

## 제품에서 연결한 흐름
지도 전용 상단에서 이름·목적·저장 상태를 읽고, 프로젝트 관리는 명명된 메뉴로 연다. 기록은 기존 우측 패널에서 부분·연결과 전환하며 지도 높이를 늘리거나 줄이지 않는다. 목적 전문은 bounded 읽기 창으로 읽는다. 정확한 보고→소유 부분→실제 관계 끝점→새 요청·인계→최초 기록의 읽기 위치로 복귀한다. 일반 새 탐색은 옛 출발점을 종료한다. 새 요청으로 원행이 소실되면 이유를 고정 머리에 표시하고 가짜 행을 만들지 않는다.

## 실패와 수정
정적 검토에서 옛 출발점의 새 탐색 누출과 소실행 안내의 후속 render 누락을 보완했다. [정적 원본·작성 자료](https://github.com/tlsee0813-cmd/agentflow-studio/tree/687943a4e237a264de1eda55caff27e84d22d638/docs/transfer/workspace-records-19).

Cloud9fb와81d W19는 각각6실행4실패였다. 이름 입력으로 안내가 제거된 뒤 지도 높이가67.59375px 작게 남는 실제 제품 결함을 renderStatus의 제한된 높이 재계산으로 고쳤다. 별도로 목적 편집을 닫는 검사에는 native toggle 처리 완료 관측을 추가했고 단언은 유지했다. 같은 v2검사를 구제품에 적용하면 test01만 양PC 실패·exit1, 수정제품은6/6·exit0이다. [최초 실패](https://github.com/tlsee0813-cmd/agentflow-studio/tree/430f6aa3c3b47f06a640af63da171cd6247c1ec3/docs/transfer/workspace-records-19/independent-v0/failure-first) · [fix1작성·정적 근거](https://github.com/tlsee0813-cmd/agentflow-studio/tree/9a9b28dd20a4a67ba05935f65cebbb55524aff1f/docs/transfer/workspace-records-19/author-fix1).

독립 목적창 첫 batch의 닫기 직후 초점 즉시측정1실패는 collector1로 보존했다. native close 이벤트 완료 후 같은 단언의 별도2PC 검사는0이다. 최초 batch 전체를 통과로 덮지 않는다.

## 검증 범위
- [exact 양OS CI39792449163](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/39792449163): Ubuntu119871704668·Windows119871705083 completed/success. [받은 CI 응답·총괄 판단](https://github.com/tlsee0813-cmd/agentflow-studio/tree/ab6b7dd79cfc608aeeb905c3d20af85f8a3457d6/docs/transfer/workspace-records-19/coordinator-final). 로그는 provider가 잘린 것으로 반환했다.
- [Cloud exact 실행 REPORT](https://github.com/tlsee0813-cmd/agentflow-studio/tree/6ea576f291f360ac758fe0fbfb59c9583a48f510/docs/transfer/workspace-records-19/independent-fix1/REPORT.md): check/build/domain261, W19 6, PC12 15·PC13 14·HOME15 21·REPORT16 13·AREA17 12·H18 12 각각 종료0. 작성자 suite 실행과 별도 독립 장면을 합산하지 않는다.
- 독립 core는2입력×2PC: native 지도 조작·기록 읽기·실제 끝점·새 요청의ID/count/body·실제 clipboard/다운로드·출발복귀와 미저장구상 보존. 경계4·390최소2입력·같은프로젝트 목록왕복·목적창 긴본문을 따로 확인했다. 실제 scroll extent clamp도 관측했으며 원행 복귀 성공으로 확대하지 않는다.
- 총괄은 원격 대표1440 높이수정·1280 기록복귀 PNG를 직접 보았다. 이는 정적 이미지 대조다. Dify 실제 오른쪽 패널 관측과 Pro 조사·원문 대조는 [착수 판단](RESEARCH.md)에 구분한다.

[대표 화면4장](https://github.com/tlsee0813-cmd/agentflow-studio/tree/6ea576f291f360ac758fe0fbfb59c9583a48f510/docs/transfer/workspace-records-19/independent-fix1/representative) · [바이트/실행 연결](https://github.com/tlsee0813-cmd/agentflow-studio/tree/6ea576f291f360ac758fe0fbfb59c9583a48f510/docs/transfer/workspace-records-19/independent-fix1/PNG_BINDING.json). 전체 실행JSON/JSONL/입력/로그는 원격 회수 가능하며 비대표PNG는 해시목록으로 구분했다.

## 남은 위험과 다음 선택
81d Ubuntu HOME15 test08의 배경 y272≠120 한 건은 원인 미상이다. 원본 Cloud2회와 읽기전용 시점별 관측은120 고정(wide92), 수정후 exact 양OS도 통과했다. 이 실패를 해결로 취소하지 않는다. 자료손상·대상오연결은 보고되지 않았고 읽기·복귀 위치 위험으로 남긴다. 같은 실패가 다시 나면 실패 환경에서 열기와 키·휠 시점을 먼저 좁힌다. body End를 이미 배경 끝에서만 보는 검사 공백은 후속 보완 예정이다.

기본 지도 공간을 회복했지만 긴 기록 문구·전체 미적 완성·큰지도 일반화는 남아 있다. W19 fit후 표본을 미조작 최초 화면으로 세지 않으며 기존PC13을 별도로 유지한다. 실제 OS IME·AI 의미품질·사람 사용성 연구·전체모바일을 주장하지 않는다.

다음20은 모든 유효 수신 결과에서 정확한 보고 검토로 들어가 당시 인계 조건과 현재 구상을 구분하고 명시 요청으로 이어가는 한 흐름이다. 현재B와draft를 보존하며 새 inbox나 자동판정을 추가하지 않는다. 공개 MOCK/main은 그대로이며 예약PAUSED·GUIDE107 HOLD도 유지한다.
