// SOURCE40: the review example. Exactly the 8 actual excerpts and the 3 reviewed candidates of cycle 39
// (docs/cycles/2026-10-24-organizer-observation-39: source-manifest.json, candidates3.json), with the reviewed corrections and
// unknowns kept. Roles map the manifest kinds; 'missing' restates the candidates' own unconfirmed items. No raw JSONL, path or key.
// Copied from those files (not retyped); the excerpt hashes are checked again whenever the example opens.
import { type ProposalSample } from './source-proposals.js';
export const PROPOSAL_EXAMPLE:ProposalSample={
 "schemaVersion": "agentflow.source-proposals.1",
 "source": {
  "id": "S_MAIN_01",
  "label": "총괄 기록 한 표본",
  "nature": "승인된 실제 총괄 JSONL 한 파일에서 고른 비연속 발췌예요. 분석·비공개 추론은 넣지 않았어요. 묶음은 검토자의 제안이에요.",
  "rawSha256": "cc6e6903e7c8160d60b88aab7806aead63a209679eb4c71a02f7e622ad798448",
  "totalLines": 50421
 },
 "range": {
  "label": "비연속 8발췌 · 행 503–786",
  "omitted": "발췌 사이의 행과 각 발화의 나머지 부분은 들어 있지 않아요. 원본 JSONL 전문과 개인 경로는 이 예제에 없어요."
 },
 "excerpts": [
  {
   "ref": "E01",
   "line": 503,
   "role": "user_instruction",
   "kind": "human_user_product_direction",
   "lineSha256": "42e5d943383dafd971ae90386f7d6f1b0d5d50e2a9af41aa9c94ae86568fcd78",
   "quoteSha256": "91e0864b399e47ca1038c747c9f4db8d5c85e4e0d645404f17ccd0cabe738358",
   "quote": "그리고 dify도 브라우저에 띄워놓긴했거든 난 dify같은 느낌이면좋겟어 그 UI같은걸 잘참고하라는거지 dify랑 우리프로젝트의 목적은 아예다르니까  dify저기창에서 우리는 평면이아니라 층위를두고 더 세세하게 표현되는느낌으로 이건 진짜 단순히말한거고 이걸 진짜 꼼꼼히 연구해야한다는거야 dify를 대표적으로 말했지만 다른 유사사이트나 UI오픈소스등등많으니까      이 작업은 계속해서 수정해나가야하는작업이야 진짜 꼼꼼히해야해 간단히정할려하지말고 조사철철히하고 최소 dify이상은 만들어  똑같이만들라는게아니라 우리의 목표목적에맞게 잘 디테일살려서 해야지 부분부분 무슨말인지이해했지?",
   "truncated": false,
   "note": null
  },
  {
   "ref": "E02",
   "line": 508,
   "role": "coordinator_interpretation",
   "kind": "coordinator_interpretation",
   "lineSha256": "bca9b4144bda58284457c2e791bb6af28ec899a861a422086486070b4c434525",
   "quoteSha256": "7f2c96a064c3f4a5b123bfd32a886d34fb24cb3f3f53b45b81e639f911469929",
   "quote": "열어두신 Dify를 직접 살펴보고, 전체 배치·부분 선택·상세 패널·탐색·화면 밀도로 나눠 조사하겠습니다.",
   "truncated": false,
   "note": null
  },
  {
   "ref": "E03",
   "line": 552,
   "role": "user_instruction",
   "kind": "human_user_role_correction",
   "lineSha256": "a72063fb6377f8d0aaf0ec364cdf13ad421468190650e6b897c2ae8cd65422d7",
   "quoteSha256": "20d5b24bf2be8207fa4ed8ecd589dffa58126b6a1946ced9cf96ecdfb48eeb44",
   "quote": "느낌만보고 너가 이런거 직접하지말고 시켜 pro나 opus나 코덱스클라우드나 많잖아",
   "truncated": false,
   "note": null
  },
  {
   "ref": "E04",
   "line": 557,
   "role": "assignment_notice",
   "kind": "coordinator_assignment_change",
   "lineSha256": "9fd68a265baf204d0673b2c93a89ff394ec274d5829fca1721b983a004f73d99",
   "quoteSha256": "f6891bce4d73a0408d2edee9d671a57094ccd0db5d2f35871f1e45216e663dc4",
   "quote": "알겠습니다. 저는 방향·작업 분할·결과 판단과 통합에 집중하겠습니다. 직접 조사·구현·반복 검증하는 비중을 줄이고, Dify UI 분석은 Pro에, 시안 수정은 Opus에, 실행 검증은 Codex 클라우드에 맡기겠습니다. 이미 발견한 결함도 재현 조건과 함께 전달해 수정 결과를 회수하겠습니다.",
   "truncated": false,
   "note": "배정 예고예요. 실제 담당 교체·접수·완료 근거가 아니에요."
  },
  {
   "ref": "E05",
   "line": 573,
   "role": "assignment_notice",
   "kind": "tool_assignment_text",
   "lineSha256": "2ef06b6518c301f9695038f1f2b60045f7bd206ea81a3d87bd2e2ac43d652bcd",
   "quoteSha256": "58aae685158565c27f73ebba27423520be533829df19c306420e831250916290",
   "quote": "사용자 최신 방향: Dify 수준 이상의 완성도를 지향하되 목적은 완전히 다릅니다. AgentFlow는 실행 노드 그래프가 아니라 일부만 세분화된 프로그램 구상·실제 관계·변경·인계입니다.",
   "truncated": false,
   "note": null
  },
  {
   "ref": "E06",
   "line": 619,
   "role": "assignment_notice",
   "kind": "tool_assignment_text",
   "lineSha256": "efe94d519cffa0b79b10f3fa3b5e85efdb56fa3371f4982ad62df907ef7964de",
   "quoteSha256": "0159285741bd27a9e6b31a924fd6952f29c4ab9f3b544149a610dd8e84777223",
   "quote": "AgentFlow의 Q03·Q04 중 “층위가 다른 부분을 같은 공간에서 이해하고 집중 화면을 왕복하는 세부 조작”만 연구하세요. 다른 세션이 Dify의 시각밀도·선택패널과 React Flow/X6 기술을 조사 중이므로 반복하지 마세요.",
   "truncated": false,
   "note": "다른 세션이 조사 중이라는 것은 배정문의 주장이에요. 실제 중복 발생 근거가 아니에요."
  },
  {
   "ref": "E07",
   "line": 724,
   "role": "assignment_notice",
   "kind": "tool_implementation_followup",
   "lineSha256": "e2b14ebe6aac8da6c5141ebec3eeee86c9b4f2953aef7b2da245c11b114e5502",
   "quoteSha256": "7f4fba0e0c860de5a080517cedfddbeea294f8f60596073cb933048943155f49",
   "quote": "수정본 회수했습니다. 독립 검토에서 남은 복귀 경로 1개를 찾았습니다. 아직 실제 브라우저 확인 전이므로 먼저 재현해 판단하세요:",
   "truncated": true,
   "note": "허용 발췌에서 명시적 수정 명령·경로 상세가 잘렸어요. 재현·판단 요청까지만 확인돼요. 수정·diff·재현 성공의 실행 근거가 아니에요."
  },
  {
   "ref": "E08",
   "line": 786,
   "role": "coordinator_interpretation",
   "kind": "coordinator_result_claim",
   "lineSha256": "1bee587b57ba1dbc080bbf0601f6219e4e5056feb5a76f72ad5f411a761a09a0",
   "quoteSha256": "4d34f6ebbbe336978e7bef3b40cd1c80562b12e38ed2786b3b173919568164a9",
   "quote": "현재로서는 관계를 비교할 때는 부분 펼침을, 긴 설명과 결정을 읽을 때는 집중 보기를 쓰는 조합이 유력합니다.",
   "truncated": false,
   "note": "총괄의 후보 판단이에요. 실행 관측이 아니고, 적용·성공으로 보지 않아요."
  }
 ],
 "proposals": [
  {
   "id": "C1",
   "label": "사용자가 명시한 제품 방향",
   "refs": [
    "E01",
    "E02",
    "E05"
   ],
   "observed": "사용자는 Dify 참고·다른 제품 목적·세밀한 층위·반복 조사를 명시했다. 총괄은 조사 분할을 예고하고 도구 배정문에 목적을 재진술했다.",
   "fidelity": "사용자 발화는 실제 기록이다. 합성인 것은 아니다. 제품 방향의 존재는 확인되지만 두 구현 부분의 변경은 미확인.",
   "scope": "제품 방향 관측. 구현 기능 노드나 영역 소속으로 배치하지 않는다. 두 연구 축의 구체 분할은 C3/E06에만 둔다.",
   "identity": "층위 지도는 요약 명칭이다. 기존 영역 이름 변경·동일성·별칭 근거 없음.",
   "roleChange": "해당 없음. C2에서 별도 관측.",
   "missing": [
    "두 구현 부분의 실제 변경",
    "기존 영역 이름 변경·동일성·별칭 근거"
   ]
  },
  {
   "id": "C2",
   "label": "총괄 역할 조정 요청과 배정 예고",
   "refs": [
    "E03",
    "E04"
   ],
   "observed": "사용자가 직접 작업 대신 외부 담당 활용을 요구했다. 총괄은 Pro 조사·Opus 시안 수정·Cloud 실행 검증과 자신의 판단·통합 역할을 예고했다.",
   "fidelity": "역할 조정 요청과 배정 예고가 확인된다. 특정 작업의 실제 담당 교체·접수·성공은 미확인.",
   "scope": "담당 역할의 관측이다. 프로그램 부분과 합치지 않는다. E06의 연구 중복 가능성은 이 후보의 사실로 쓰지 않는다.",
   "identity": "Pro/Opus/Cloud는 발췌의 담당 표기다. 실제 세션 동일성·이름 변경 근거 없음.",
   "roleChange": "requested_and_planned; receipt_and_completed_transfer_unknown",
   "missing": [
    "특정 작업의 실제 담당 교체·접수·성공",
    "Pro/Opus/Cloud 표기와 실제 세션의 동일성"
   ]
  },
  {
   "id": "C3",
   "label": "연구 분할·재현 판단 요청·후보 판단",
   "refs": [
    "E06",
    "E07",
    "E08"
   ],
   "observed": "E06은 층위·왕복과 시각밀도·선택패널 연구를 나눈다. E07은 수정본 회수라는 진술과 브라우저 확인 전 재현·판단 요청이다. E08은 부분 펼침·집중 보기 조합의 후보 판단이다.",
   "fidelity": "E07의 허용 발췌에는 명시적 수정 명령·경로 상세가 잘렸다. 실제 작업 수정·접수·diff·재현 성공·적용·E01과의 인과는 미확인.",
   "scope": "세 사건의 순서만 보존한다. 한 작업 또는 두 부분 구현 변경으로 합치지 않는다. C1의 사용자 방향과 별도 층위다.",
   "identity": "부분 펼침·집중 보기는 후보 동작 표현이다. 영역 개명·노드 병합 근거 없음.",
   "roleChange": "E06의 다른 세션은 배정문 주장이다. E04 담당과 동일 세션인지, 실제 인계됐는지 미확인.",
   "missing": [
    "E07에서 잘린 명시적 수정 명령·경로 상세",
    "실제 작업 수정·접수·diff·재현 성공·적용",
    "세 사건 사이, 그리고 E01과의 인과",
    "E06의 다른 세션과 E04 담당의 동일성·실제 인계"
   ]
  }
 ]
};
