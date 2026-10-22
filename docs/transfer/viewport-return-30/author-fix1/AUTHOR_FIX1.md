# 30 최종 가용 범위 안내 fix1

총괄 v0 정적 검토에서 renderMap의 applyView/markOffscreen이 최종 callback/높이 앞에서 실행된다는 누락을 발견했습니다. 기존 camera가 있으면 finishInitialMapFit은 earlyreturn이므로 화면 밖 class/count가 옛 높이를 참조할 수 있습니다. v0 원문/증거는 보존했습니다.

openSpace의 render가 끝난 뒤 기존 space-plane이 있으면 markOffscreen만 한 번 실행합니다. 이 함수는 최종 map.clientWidth/clientHeight와 기존 camera로 카드 offscreen class/안내만 계산하며 transform·camera·좌표·소속·원자료는 바꾸지 않습니다. applyView/refit/전역 size 확대나 반복 측정 loop는 추가하지 않았습니다. 최초 fit이 이미 안내를 계산한 경우 같은 최종값을 재계산합니다.

Cloud에서 실제 비영점 공간 page scroll을 기억한 뒤 긴 작업에서 복귀하는 조건은 별도로 남깁니다. 최종 높이로 문서 maxScroll이 바뀌어 browser가 page scroll을 clamp할 가능성을 실제 관측 전 해결됐다고 하지 않습니다. 원래0/1200 복귀와 최신 offscreen count/class, 실제 정보 접근, panel reading/카메라 불변을 확인해야 합니다. 새 반복 측정은 반례 전 추가하지 않습니다.

Node24 보조 type/build/diff 모두0. 기존 DEP0190 build 경고 유지, 로컬 UI/서버/단위/설치/원격 쓰기는 미실행입니다. 31 소스는 수정하지 않았습니다.
