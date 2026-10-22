# 사이클18 로컬 작성·독립 core 실행 자료
2026-10-22. 게시된 제품 후보: [ba9bf6e](https://github.com/tlsee0813-cmd/agentflow-studio/tree/ba9bf6e477f6cf36d1a056b3db218c98bf8bf26e). [PR9](https://github.com/tlsee0813-cmd/agentflow-studio/pull/9)는 초안이며 이 자료만으로 화면을 수용하지 않았다.

- author-v0/CORE_FINAL.json: 작성자 로컬 HEAD7bea 위 수정 파일의 SHA와 실행 원장. 실제 제품은 위 후보에 게시했다. receipt의 localEvidenceNotPublishedToGitHub는 캡처 당시의 목록이며, 이 전달 디렉터리에 포함한 파일은 이제 공유 가능하다.
- author-v0/final2-*: 최종 UI와 core 바이트의 Node24.19.0/TS5.8.3 보조 검사. continuity check/build/unit259/259/static build/diff 모두 exit0. 설치·Node22·브라우저 검증의 대체물이 아니다.
- author-v0/question-export-before/after 및 question-test-context-before/after: 인계만으로 질문이 소실되던 실제 결함과 수정 과정의 시험 문맥 질문 혼입. 같은 좁은 검사로 각각 실패 종료→성공을 확인했다.
- author-v0/hierarchy18-first, continuity-units-first, area18-check-first, parent-build-first: 중간 실패 원본. 최종 성공에 섞지 않는다. sparse checkout의 빠진 기존 fixture·launcher와 이전 schema 기대값, 제품 legacy stamp 결함을 원장에서 구분한다.
- core-review-v0/: Astra 독립 코드/Node24 좁은 검토. 초기 inline 실패 관측과 이후 companion script의 실제 수정후 통과를 구별한다. UI/전체회귀/Node22 결과가 아니다. source별 SHA를 기록했다.

증거의 절대 로컬 경로는 원본 실행 출처이며 회수 위치가 아니다. 실제 로그/검토/재현 코드는 이 GitHub 디렉터리에서 읽을 수 있다. 모든 중간 성공 로그·빌드 사본을 중복 업로드하지 않았고, 주요 실패·최종 성공·독립 재현을 보존했다. 구형 project.6 고정 바이트와 출처는 제품의 app/continuity/tests/fixtures/hierarchy18에 있다.

독립 core probe를 재실행하려면 이 디렉터리의 core-review-v0 파일을 product18-review-evidence 폴더에 놓고, 같은 부모 경로의 product18-author에 위 후보를 checkout해 app 및 continuity build를 준비한다. probe의 상대 import는 당시 sibling 구조를 사용한다. Node22와 브라우저의 독립 실행은 별도 independent-v0 전달에서 판정한다.

총괄이 수용한 UI 보완: 연결 읽기를 지도 옆 고정 패널로 이동, 실제 관계 소유자의 질문·설명 접근, 숨은 설명 보류와 탭 내 갱신 구분, 비자손을 감싸는 프레임 생략, 실제 끝점과 새 요청·인계의 출발 보기 보존. 작성자 Python12개(6경로×2PC)는 이 시점 문법만 확인했으며 통과12개가 아니다.
