# 31 닫기 호출자 가시성 fix1

v0 원문/증거는 보존했습니다. 전역 focusFirst는 layout 존재만 확인하므로 pan 뒤 화면 밖 신호에도 focus할 수 있다는 정적 반례를 좁게 보완했습니다. 새 helper는 branchRecordCaller 닫기 경로에만 사용합니다.

정확한 호출자와 지도 소속·CSS visibility를 확인하고, control rect∩viewport∩지도 client clip의 양수 영역 중앙에서 elementFromPoint가 실제 해당 control/자손을 반환해야 focus(preventScroll)합니다. map border/client 범위를 쓰며 화면 가림도 hit로 확인합니다. 신호 실패시 정확 소유자 정보에 같은 판정을 하고, 모두 실패하면 기존 space-title로 focus합니다. 다른 owner/대표 카드로 대체하거나 카메라 이동·접힘 해제를 하지 않습니다. 일반 정보 닫기의 전역 helper/기존 경로는 그대로입니다.

양수 교집합의 실제 hit 한 점은 보이는 유효부분의 존재를 판단하는 조건이며 모든 글자 가독성·최소 클릭 크기·전체 control 가시성 합격을 뜻하지 않습니다. space-title은 sr-only 제목이므로 fallback은 접근성 초점이며 시각 강조는 아닙니다. 정상 신호 닫기와 pan→close, 겹침 가림/정확 소유자 정보 fallback은 Cloud에서 확인해야 합니다.

Node24.19.0 보조 type/build/diff 모두0이며 원 로그와 기존 DEP0190 경고를 보존했습니다. app만 v0 대비 수정했고 CSS는 byte동일입니다. 로컬 UI/서버/원격 쓰기/설치는 수행하지 않았습니다.
