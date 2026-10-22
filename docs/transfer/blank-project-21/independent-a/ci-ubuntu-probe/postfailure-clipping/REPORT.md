# 21 실패 후에만 수행한 clipping / IO 관측

정확 f7b25 제품 / 212163B1F4B7B6E328BC194676656EAED570A65179C6670DC6274E74D10A3117 원검사 / PW1.57.0 / system Chromium154.0.8037.57. 원래 1280×720 한 메서드만 수행했다. 원 setUp·검사·키보드·단언·tearDown을 수정하지 않았다. 별도 TextTestResult.addFailure가 super().addFailure로 원 실패를 기록한 다음에만 page.evaluate(snapshot), fresh IntersectionObserver, snapshot, PNG를 수행했다. 실패 전 observer/evaluate/추가대기 없음. 원 tearDown/screenshot은 이후 그대로 실행했다. source·DOM·스타일·저장값·스크롤 수리 없음.

실제 1실패/0error, line111 ShiftTab focus 통과→toggle→reach→visible→to_be_in_viewport ratio0, Enter 전 실패. child=1, 외부collector 실제 종료=1. 원 traceback과 기존 screenshot, postfailure 원PNG를 보존했다. 이전 원본/관측통과 자료는 덮어쓰지 않는다.

원 visible PROBE는 summary top4.125/bottom47.921875, inside=true/hit=true였다. 실패가 기록된 뒤 첫 snapshot은 top−2250.875/bottom−2207.078125, windowY2875였다. top 차이는 −2255 CSSpx이다. activeElement는 summary이며 details.open=true였다. 새 IO callback도 bounding y−2250.875, rootBounds(0,0,1280,720), intersectionRect(0,0,0,0), isIntersecting=false, ratio0을 기록했다. 첫/IO후 snapshot의 windowY와 summary rect는 같았다. 원PROBE와 실패 후에는 위치가 다르다. 원PROBE에 시각/DOM identity/windowY가 없으므로 이동의 정확시점·원인·노드동일성을 소급해 확정하지 않는다. fresh IO의 sameDOMIdentity는 등록부터 callback까지의 검사다.

모든 summary 조상의 실제 boundingClientRect/getClientRects/clientLeftTopWidthHeight/offsetWidthHeight/scrollTopLeft/dimensions와 computed overflowX,Y/clip-path/clip/visibility/display/transform/contain을 원시 저장했다. 이 postfailure 조상들은 overflow visible, clip-path none, visibility visible/display 비hidden이었다. summary 자체가 viewport 위에 있었다. elementFromPoint의 원시 대표점도 저장했다. 보조 clientBox/scale은 bounding/offset 비율로 계산한 파생치이며 특히 HTML 전체문서 boundingHeight와 viewport offsetHeight가 달라 실제 transform 비율로 해석하면 안 된다. raw clientRects/client metrics와 computed transform을 우선하고 이 파생치로 full-clip 통과를 판정하지 않았다.

이 수집은 IO 실패 assertion의 모든 retry 순간을 기록한 것이 아니라 원 실패가 끝난 뒤의 관측이다. native scroll pending이나 제품/검사 귀책을 확정하지 않는다. 143 다운로드/전체회귀/23/실제AI/서비스환경 변경은 미실행. 새 HTTP observer를 실패 전에 붙이지 않았으므로 이전 동일빌드 HTTP바인딩을 새 수집으로 부풀리지 않는다. MANIFEST.tsv는 자기 자신을 제외한 정확 payload 집합이다.
