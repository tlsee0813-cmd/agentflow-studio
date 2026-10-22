# Cycle26 하위 부분 배치의 좁은 계산 비교

제품 채택 판단은 아니다. 정확689c의 shared/presentation11파일을 Git blob 대조 후 격리 복사하고 addChildArea의 near 미지정 때만 x 가산300을0으로 바꿨다. 명시near는 기존+300/+200, freeSlot/ring/clamp/fit/schema/카드DOM/CSS/저장 좌표는 그대로다. 후보의 실제domain을 컴파일해 비교했다.

## 결론

24 표본은 폭1300→1000, 양PC fit배율30% 증가다. 다만 제목15px 환산은1280에서9.15px,1440에서11.55px에 머물며 실제 가독성은 미관측이다. 아래와 오른쪽이 차 있는 foreign반례에서는 기존ring 순서 때문에 새child가 왼쪽으로 밀려 폭840→1140, 양PC 배율이 약26.3% 작아졌다. 24 한 사례 개선만으로 일반 채택하지 않는다. 큰 알고리즘으로 확대하지 않았다.

| 고정 사례 | 새child 기존→후보 | bbox 기존→후보 | 1280 scale 기존→후보 | 1440 scale 기존→후보 |
| --- | --- | --- | --- | --- |
| 24 saved root coordinates 1280 | (640,280) → (340,280) | 1300×380 → 1000×380 | 0.469231 → 0.610000 | 0.592308 → 0.770000 |
| 24 saved root coordinates 1440 | (720,360) → (420,360) | 1300×380 → 1000×380 | 0.469231 → 0.610000 | 0.592308 → 0.770000 |
| fixed short structure total4 | (640,240) → (40,240) | 840×380 → 540×380 | 0.726190 → 1.023684 | 0.916667 → 1.200000 |
| fixed short structure total6 | (40,240) → (40,240) | 840×380 → 840×380 | 0.726190 → 0.726190 | 0.916667 → 0.916667 |
| fixed short structure total8 | (40,240) → (40,240) | 1140×380 → 1140×380 | 0.535088 → 0.535088 | 0.675439 → 0.675439 |
| fixed chain depth3 | (940,640) → (40,640) | 1140×780 → 240×780 | 0.498718 → 0.498718 | 0.675439 → 0.729487 |
| fixed chain depth4 | (1240,840) → (40,840) | 1440×980 → 240×980 | 0.396939 → 0.396939 | 0.534722 → 0.580612 |
| archived card directly below parent | (340,240) → (340,240) | 540×380 → 540×380 | 1.023684 → 1.023684 | 1.200000 → 1.200000 |
| nearby other parent and reserved child; unfavorable left spill | (600,200) → (-300,200) | 840×380 → 1140×380 | 0.726190 → 0.535088 | 0.916667 → 0.675439 |
| POSITION_LIMIT upper corner | (199400,200000) → (199600,200000) | 740×280 → 540×280 | 0.824324 → 1.129630 | 1.040541 → 1.200000 |
| explicit near far away remains legacy offset | (12300,-15800) → (12300,-15800) | 12500×16020 → 12500×16020 | 0.024282 → 0.024282 | 0.035518 → 0.035518 |
| previous manual coordinates preserved | (-420,620) → (-420,620) | 2113×1657 → 2113×1657 | 0.234762 → 0.234762 | 0.343392 → 0.343392 |

## 실행과 보존

prepare/compile-baseline/compile-candidate/probe 모두 exit0. Node24.19.0 보조 계산과 기존 TypeScript5.8.3을 사용했고 설치는 없다. 12비교 모두 원project 비파괴, 기존 수동/보관 좌표와 다른field 보존, 새child 카드중복0, 위치상한내, 기존schema 저장재읽기 일치를 확인했다. 깊이3/4는 각 단계 추가를 검사하고 마지막2단계를 기록했다. 1280은 세로 제약 때문에 폭이 줄어도 배율이 같다.

실제24에 저장된 map border-box660×479.109375/820×659.109375와 control높이46을 재사용하고, 기존1px border/정수client치수에서 fit유효폭610/770·높이389/569를 도출했다. 같은 fitViewport를 호출하고24 기존배율 재현도 확인했다. 24root좌표는 원래3개를 public API로 재구성하고 합성manual4값/기준/미전송draft를 붙여 보존을 검사했다. 원24의 전체project에 새child를 이중추가한 시험은 아니다.

## 한계

frame은 불변의 카드외곽14px·foreign교차시생략 정책을 계산상 투영했으며 실제DOM/제목의 위쪽 피하기/선과 문자의 모양은 미검증이다. 반례에서 기존frame은foreign을 둘러싸 생략되고 후보frame은생략불필요라는 계산이나 bbox악화와 별개다. fit에 frame은 들어가지 않는다. 실제브라우저/server/유료AI/사용자 가독성/전체회귀/CI는 미실행이다. 제품source·기존21/23산출물·원격은 바꾸지 않았다.

최소 공유 근거는 REPORT.md/RESULT.json/probe.mjs/candidate-one-line.patch/source-tree.json/raw24-fit-geometry.json/두 baseline-project.json과 실행raw/exit, prepare.mjs/freeze.mjs다. baseline/candidate src와dist는 로컬 재현용이므로 중복 업로드할 필요 없다. 원source는 고정689c의blob목록으로 다시 확보할 수 있다.
