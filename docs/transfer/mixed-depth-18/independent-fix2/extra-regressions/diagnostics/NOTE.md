# PC13 9330 네 실패장면 rect/hit 추가

제품9330fc3b19994dd5398d4373c1a3fc703bd28574. 원래 전체회귀 원본은 부모 extra-regressions의 c5c7558b8a611d94f00b0cc57f71a079d5ffb05f에서 동결됐다. 이 하위는 요청한 부족한 1280 실패화면/rect/hit만 보완한 새 실행이다. 원래 tests의 네 장면을 고르고 teardown 직전 읽기전용 측정과 screenshot만 추가했다. 원래 단언/조작/제품코드는 수정하지 않았다. 결과는 원래와 같이3 assertion failures+1 actual click timeout, child/collector exit1이다. 최초 full suite exit와 혼합하지 않는다.

## 실제 원인 관측

- 기본/긴제목: map(264,294.125,974,409.875), info(1193.361,327.675,38.089,24.700), fit(1148.469,310.125,71.531,36). info 중앙(약1212.405,340.025)은 fit 내부다. elementFromPoint도 map-fit이다.
- 정상안내: map top361.719/height342.281. info y395.269, fit y377.719이며 동일한 상대중첩과 중앙map-fit hit를 보인다.
- 실제click timeout: info x1190.361/y327.675, fit x1145.469/y310.125. 같은중첩이며 Playwright 정상click의 pointer interception도 map-fit이다.
- 네 장면 모두 page scrollY0, panel없음, computed matrix(0.95,0,0,0.95,424,-52). 10%/50% x표본은 map-fit,90%표본은 원래info다. 따라서 전체버튼DOM소실/완전비가시가 아니라 중앙의 실제부분가림이다. 강제click/가장자리click로검사를구제하지않았다.

## 정적 가설과의 구별

root 최신정정대로 renderSpace의 root.hidden=false 때문에 hidden-map fallback800x480을 확정원인으로 쓰지 않는다. 이번 측정은 최종 화면의 실제 map974폭/약410또는342높이, 화면카드높이171(현transform0.95로환산180)을 보존한다. fitView의 fallback800x480/NODE_H132와 숫자가 다르지만 이 사실만으로 해당 fallback이 실제 사용됐다고 입증할 수 없다. 최초 fit 호출시점의 크기/상단기하 변경 경로는 계측하지 않았다. 확정한 것은 현재 실제 info와 toolbar의 중첩/elementFromPoint 결과이고, toolbar 공간 미예약/fit 타이밍은 구현자가 원인분석할 항목이다.

MANIFEST는 이 diagnostics 추가 payload만 본인제외로 명시한다. 부모 MANIFEST는 c5c7558b 당시 원본payload집합이고 변경하지 않았다. 현재 raw실행코드/프로세스/화면4장/SCENES/raw rect로 재계산 가능하다. screenshot은 원단언 실패 또는 click timeout뒤 teardown전이며 자동정렬/보정스크롤/fit/focus를 추가하지 않았다.
