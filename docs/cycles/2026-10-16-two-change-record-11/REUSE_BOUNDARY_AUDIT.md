# cycle11 동일 렌더러 재사용 경계 감사

[30eb628 입력·BRIEF](https://github.com/tlsee0813-cmd/agentflow-studio/tree/30eb628cf8a51733596c82c119b1d668cf041a7a/docs/cycles/2026-10-16-two-change-record-11)과 [cycle10 정확 HTML](https://github.com/tlsee0813-cmd/agentflow-studio/blob/76feae052f716bfe8d0bc09df5a6770048b1f687/docs/transfer/relation-reading-10/author-v0/relation-reading-study.html#L326-L361)(로컬 SHA96e791d2…359ceae)를 대조했다. 실행·구현·원격 변경은 없다. 두 사례 재사용·PC 중심이라는 최신 지시를 따른다.

## 재사용 위험

- **현재는 fixture 교체만으로 작동하지 않는다.** CSS 54–60행은 G1–G5 배치, applyDepth 414행은 G2/G3/G4, 초기 state 361행은 깊이를 고정한다. renderFocus 618–635행은 changed인 어떤 노드에도 C32의 전후·MOCK 사례를 넣고, openXref 541–544행은 모든 관계를 ‘전달’/FLOW091-C로 부른다. defaults 689–699행도 C32/G5와 해당 계약 전용이다. 두 번째 사례를 caseId 분기로 덧대면 동일 렌더러 재사용을 입증하지 못한다.
- **소속과 관계의 의미가 다르다.** parent/children은 표시 포함, relationship은 명시 양끝·관계 설명·근거로 따로 둔다. PowerToys의 외부 ManagedCommon을 편집기 자식으로 편입하거나 검색→녹화 인과선을 만들지 않는다. relList 517–525행은 그룹의 직접 자식 끝점만 출력하므로 그룹 자체 끝점/내부 관계가 있는 fixture에서 누락될 수 있다. 두 fixture의 허용 구조를 명시한다.
- **편집·복귀의 사례 경계.** prep 키는 focusId이며 saved/sel/depth/peek/xref도 전역이다(361,647–664,701–720행). 전환 때 오래된 DOM 초점·참고·saved를 끊고, 보존할 초안/보기는 caseId+대상ID로 구분한다. A에서 E→B 같은 ID→A의 실제 값으로 누수를 구분한다. 미래 요청 초안을 네 칸에 강제하지 않는다.

## 작은 구현의 경계

동일 engine.js/style.css와 두 JSON fixture로 검증한다. 역할·상세·초기 펼침·배치와 optional change/relations를 데이터로 받고, 엔진은 구조와 필드 존재로 표시한다. 사례명/ID/사업 문구별 분기는 두지 않는다. 기록 없는 변경/관계는 가짜 행이나 ‘무관함’으로 채우지 않는다.

근거는 사례별 고정 URL/커밋·원문 종류·요약과 확인 한계를 함께 가진다. FLOW091의 과거 계약·MOCK 재구성과 PowerToys의 사람 리뷰·코드 수정·작성자 주장·병합을 같은 성공 상태로 평탄화하지 않는다. 근거창과 사용자가 명시 선택 후 쓰는 빈 자유문 초안은 분리하며, 후자는 앞으로 할 요청 준비일 뿐 과거 인계 원문/송신 기능이 아니다.

제품 최소 반영 후보는 현재 설명→명시 근거 열람의 읽기 표현까지다. 연구용 자유문 초안으로 [제품 Task별 manual 우선 경로](https://github.com/tlsee0813-cmd/agentflow-studio/blob/618d9bd2b99ad433df35107d8902b15f45e30000/app/continuity/src/shared/domain.ts#L225-L234)를 자동 대체하거나 스키마를 이관하지 않는다. 제품 반영은 재사용 확인 뒤 판단한다. PC1280/1440에서 같은 선택→근거 닫기→초안 편집→복귀·사례 왕복을 보고,390은 접근·가로 넘침·닫기 smoke에 한정한다. 기존 통과 수는 승계하지 않는다.

