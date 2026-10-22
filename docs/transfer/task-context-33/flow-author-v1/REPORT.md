# 33 · 대상이 분명한 작업 이동과 결과 선택 확인 — 작성자 후보

기준은 notice00 수정 `4ffa06dc28c51f20db9f93887747d353911ccdc9`이다. 이 후보는 작업02를 읽으면서 현재04·별도 미전송 입력을 구별한 뒤 실제 고칠 위치와 파일 교환 확인 단계로 이동하는 부담을 줄이는 기존 화면 내 변경이다. 32 관측의 성공/불편, notice00 반례와 그 수정 검증은 별도 자료이며 이번 UI를 실행한 증거로 합산하지 않는다.

- reader 머리에 기존 이어가기 버튼 한 벌과 실제 편집 대상 번호·소유 부분을 옮겼다. 다른 current에서 바꾸는 경우 그 current도 표시하고, 별도 작성 중인 입력의 실제 대상은 접지 않고 표시한다. 상세 정책 설명만 native details로 접는다. 기존 별개 미전송 요청 주행동·같은 요청의 현재 보고를 계속 고치는 정책은 유지한다. 읽기만으로 current를 바꾸지 않는다.
- 명시 이어가기의 도착은 현재 작업 제목이다. 기존 sticky feedback의 실측 높이만큼 국소 scroll margin을 주고, 바로 아래 현재 task에 묶인 두 jump를 둔다. N 이동은 기존 edit-work와 work-next, 파일 이동은 기존 file-return-options와 설명/파일 결과용 복사 버튼을 연다. 이동 자체는 render/commit/AI 호출/복사/H 생성이 아니다. U/S/C 및 설명 참고 편집기는 그대로다. 입력은 기존 즉시 editTask+refreshPreview를 쓴다.
- 비동기 파일 선택이 검증되면 같은 selection·project·epoch·entry·view·current·revision인 경우에만 기존 확인 영역을 열어 제목에 초점을 둔다. 다른 곳으로 이동하거나 입력을 바꿨다면 끌어오지 않는다. 신규 파일은 ‘아직 가져오지 않았습니다’, duplicate는 ‘이미 가져온 결과입니다’로 구별한다. 잘못된 H/JSON은 기존 경고 또는 메시지로 도달하고, 없는 제목을 강제 접근하지 않는다. acceptResultFile과 exportWork 함수 본문은 기준과 바이트 동일하며 명시 수신/정확 T/H/저장 실패/과거 H 검사는 바꾸지 않았다.

제품 변경은 app.ts 하나이고 CSS/HTML·도메인·스키마는 그대로다. 기존 notice00 evidence 폴더는 건드리지 않았고, 이 폴더의 before는 정확4ffa app/PC12 원문이다. 초기 중간 source payload와 type-v1 결과도 남겨 두었다. root가 발견한 duplicate 안내 모순은 최종 후보에서 분기 처리했고, 같은 H를 실제 한 번 가져온 뒤 재선택하는 검사도 추가했다.

PC12에는 정상 UI/MOCK로 current04/read02/다른 대상 draft를 만든 새 method 하나를 양 PC에 상속했다. 첫 읽기의 저장 자료 불변과 header 실제 대상, 이어가기 후 제목 clip/hit, native Tab/Enter→N focus와 N만 수정, 파일 jump의 무부작용, 실제 clipboard H를 이용한 검토 전 데이터 불변, wrong-H의 제어된 오류 초점, 명시 한 번 수신 뒤 duplicate의 실제 상태를 검사한다. 기존 same-group 보고02 양성 경계에는 실제 편집 R 대상 속성만 보강하고 원 notice/비대상/복귀 단언은 유지했다. 기존 PC12는15개에서17개가 될 예정이다.

최종 Node24 작성자 보조/기존 TS5.8.3 타입·컴파일 빌드·JS probe 구문·Python AST·정확 before에 대한 patch 확인은 모두 exit0이다. 새 의존성·junction은 없다. 브라우저·서버·실제 AI·원격 쓰기는 실행하지 않았다. 따라서 실제 두 PC의 제목/버튼 가림, Tab 순서, 파일선택 이동, 긴 자료 및 기존 왕복 회귀는 Cloud/정확 후보 CI가 검증해야 한다. 사용자 발견 속도나 읽기 성공을 정적 검사로 주장하지 않는다.

source payload와 공개 근거 payload는 분리한다. 근거에는 source/dist/dependencies를 중복하지 않는다. 공개 복사본에서 절대 workspace/runtime 경로만 표시 치환하고 원 로컬 로그·receipt를 보존한다.
