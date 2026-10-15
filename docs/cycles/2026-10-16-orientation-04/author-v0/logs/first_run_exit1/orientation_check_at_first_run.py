"""cycle04 orientation-study.html — 후보 A/B 위험 기반 5장면 실제 브라우저 검사 (작성자 검사).

실행:  (HTML 폴더에서) python3 -m http.server 8770 --bind 127.0.0.1
       python3 orientation_check.py <페이지 URL(쿼리 없이)> <기대 HTML 경로> <출력 폴더>
종료:  0 = 모든 필수 장면 PASS·해시 일치·pageerror/fatal/cleanup 없음, 1 = 그 밖의 모든 경우.

- 각 탐색의 실제 문서 응답 body(브라우저가 받은 바이트) SHA256과 HTTP 상태를 기대 파일과 직접 비교한다.
- 클릭은 좌표 마우스 클릭(데스크톱)/터치 탭(390). 스크롤은 마우스 휠 이벤트만 쓴다(390도 휠이며 손가락 스와이프 아님).
  검사 쪽 DOM scrollTo/scrollIntoView 보조는 쓰지 않는다. 앱이 스스로 움직인 거리(B 참조 이동)는 '앱 자동 이동'으로 따로 적는다.
- 판정은 실제 표시 상자·elementFromPoint·activeElement·스크롤 값. 닫힌 상세의 DOM 텍스트는 노출로 세지 않는다.
- 상태: PASS / FAIL / UNOBSERVED(관측 못 함, 사유 기록). 필수 장면의 FAIL·UNOBSERVED·미기록은 nonzero.
- 외부 GitHub 원문 링크는 href만 확인하고 열지 않는다(외부 왕복 미실행).
"""
import hashlib, json, re, sys, time, traceback
from pathlib import Path
from playwright.sync_api import sync_playwright

# BRIEF '동일 데이터·의미 계약' 표의 기대 관계(검사기가 독립적으로 가진 기대값)
EXPECTED = {"purpose": ["home", "task", "next", "restore"],
            "instruction": ["home", "task", "next"],
            "decision": ["home", "task", "next"]}
AREAS = ["home", "task", "next", "restore"]
FORBIDDEN = ["보냈습니다", "전달 완료", "수락됨", "수락했", "인계 완료", "발송됨", "승인 대기", "승인함", "지난 방문 이후 바뀐"]
INTERNAL = re.compile(r"FIX0\d\d|f0fa53|d5ef9a|intent-edit|manual\.|AI055|\b[0-9a-f]{12,}\b")
VIEWPORTS = {"390": (390, 844, True), "1280": (1280, 720, False), "1440": (1440, 900, False)}
REQUIRED = [f"{s}@{v}" for s, v in [("S1", "390"), ("S1", "1280"), ("S1", "1440"), ("S1sel", "390"), ("S1sel", "1280"),
                                    ("S2", "390"), ("S3", "390"), ("S3", "1280"), ("S4", "390"), ("S5", "390"), ("S5", "1280")]]
CONDITIONAL = ["S4@1280"]  # 읽기 영역이 그 크기에서 스크롤되지 않으면 UNOBSERVED가 정당한 결과

JS_STATE = """() => {
  const vis = el => { if(!el) return false; const r=el.getBoundingClientRect(); const cs=getComputedStyle(el);
     return r.width>0 && r.height>0 && cs.visibility!=='hidden' && cs.display!=='none'; };
  const depth = {};
  document.querySelectorAll('.area').forEach(a => {
    const body=a.querySelector('.area-body');
    const lis=[...a.querySelectorAll('.area-body li')].filter(vis).length;
    depth[a.dataset.id] = !vis(body) ? 0 : (lis>0 ? 2 : 1);
  });
  const ms=document.getElementById('mapScroll'); const ae=document.activeElement;
  const ids=[...document.querySelectorAll('[id]')].map(e=>e.id); const dup=ids.filter((x,i)=>ids.indexOf(x)!==i);
  return {map: vis(document.getElementById('mapView')), focus: vis(document.getElementById('focusView')),
    depth, selected:[...document.querySelectorAll('.part.is-selected')].filter(vis).map(p=>p.dataset.id),
    mapScroll:[Math.round(ms.scrollLeft), Math.round(ms.scrollTop)], winY: Math.round(window.scrollY),
    zoom: document.getElementById('zoomVal').textContent, edges: document.querySelectorAll('#edges path').length,
    readingTop: Math.round(document.getElementById('reading').scrollTop), peeks: document.querySelectorAll('.peek').length,
    dialog: document.getElementById('prep').open, refbar: vis(document.getElementById('refbar')),
    pointed: [...document.querySelectorAll('.is-pointed')].map(e=>(e.classList.contains('part')?'p:':'a:')+e.dataset.id),
    active: ae ? ((ae.dataset&&ae.dataset.ref)?'ref:'+ae.dataset.ref : (ae.id || ae.className || ae.tagName) + (ae.dataset&&ae.dataset.id?':'+ae.dataset.id:'') + (ae.dataset&&ae.dataset.claim?':'+ae.dataset.claim:'')) : null,
    dupIds: dup };
}"""

# 노출: 화면 안에 완전히 들어오고, 중심점의 최상단 요소가 그 요소(또는 자손)인지
JS_EXPOSE = """(items) => items.map(([key, sel]) => {
  const el = document.querySelector(sel);
  if(!el) return {key, exists:false};
  const r = el.getBoundingClientRect(); const cs=getComputedStyle(el);
  const shown = r.width>0 && r.height>0 && cs.display!=='none' && cs.visibility!=='hidden';
  const inside = shown && r.top>=0 && r.left>=0 && r.bottom<=innerHeight && r.right<=innerWidth;
  let top=false;
  if(inside){ const h=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2); top = !!h && (h===el || el.contains(h)); }
  return {key, exists:true, shown, fully_visible: inside && top, y: Math.round(r.top), h: Math.round(r.height)};
})"""

JS_EDGES = """() => {
  const svg=document.getElementById('edges'); const m=svg.getScreenCTM(); const out=[];
  svg.querySelectorAll('path').forEach(p=>{ const L=p.getTotalLength();
    const a=p.getPointAtLength(0).matrixTransform(m), b=p.getPointAtLength(L).matrixTransform(m);
    out.push({x1:a.x,y1:a.y,x2:b.x,y2:b.y}); });
  return out; }"""

JS_HEADS = """() => { const o={}; document.querySelectorAll('.area').forEach(a=>{const r=a.querySelector('.area-head').getBoundingClientRect();
  o[a.dataset.id]={x:r.left,y:r.top+r.height/2};}); const s=document.querySelector('.part.is-selected');
  if(s){const r=s.getBoundingClientRect(); o.__part={x:r.right,y:r.top+r.height/2};} return o; }"""

JS_NODES = """() => { const pick=sel=>{const e=document.querySelector(sel); if(!e) return null; const r=e.getBoundingClientRect();
  return [Math.round(r.left*10)/10, Math.round(r.top*10)/10, Math.round(r.width*10)/10, Math.round(r.height*10)/10];};
  return {part_purpose:pick('.part[data-id="purpose"]'), part_decision:pick('.part[data-id="decision"]'),
    home:pick('.area[data-id="home"] .area-head'), task:pick('.area[data-id="task"] .area-head'),
    next:pick('.area[data-id="next"] .area-head'), restore:pick('.area[data-id="restore"] .area-head'), frame:pick('#frame')}; }"""

JS_HIT = """([x,y]) => { const e=document.elementFromPoint(x,y); if(!e) return null;
  return {inPeek: !!e.closest('.peek'), inDialog: !!e.closest('dialog'), text:(e.textContent||'').trim().slice(0,24)}; }"""


class Fatal(Exception):
    pass


class Session:
    """한 후보·한 viewport의 깨끗한 브라우저 컨텍스트."""

    def __init__(self, browser, cand, vp, url, expected_sha, out, rec_nav):
        w, h, mob = VIEWPORTS[vp]
        self.cand, self.vp, self.vw, self.vh, self.mobile, self.out = cand, vp, w, h, mob, out
        self.ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=1,
                                       is_mobile=mob, has_touch=mob, locale="ko-KR")
        self.page = self.ctx.new_page()
        self.page_errors, self.console_errors, self.requests, self.actions = [], [], [], []
        self.page.on("pageerror", lambda e: self.page_errors.append(str(e)))
        self.page.on("console", lambda m: self.console_errors.append(m.text) if m.type == "error" else None)
        self.page.on("request", lambda r: self.requests.append(r.url))
        full = f"{url}?v={cand}"
        resp = self.page.goto(full)
        body = resp.body()
        nav = {"cand": cand, "vp": vp, "url": full, "status": resp.status,
               "body_sha256": hashlib.sha256(body).hexdigest(), "body_bytes": len(body),
               "expected_sha256": expected_sha, "match": hashlib.sha256(body).hexdigest() == expected_sha and resp.status == 200}
        rec_nav.append(nav)
        if not nav["match"]:
            raise Fatal(f"응답 body 해시/상태 불일치: {nav['status']} {nav['body_sha256'][:12]} != {expected_sha[:12]}")
        self.page.wait_for_timeout(300)

    def st(self):
        return self.page.evaluate(JS_STATE)

    def box(self, sel):
        loc = self.page.locator(sel)
        if not loc.count() or not loc.first.is_visible():
            return None
        return loc.first.bounding_box()

    def limits(self, top=0):
        """실제로 가리지 않는 세로 범위: 390에서 위에 붙은 참조 안내줄, 아래 고정 선택바를 뺀다."""
        bottom = self.vh
        if self.mobile:
            rb = self.box("#refbar")
            if rb is not None and rb["y"] <= 1:
                top = max(top, rb["y"] + rb["height"] + 2)
            sb = self.box("#strip")
            if sb is not None and sb["y"] < self.vh:
                bottom = min(bottom, sb["y"] - 2)
        return top, bottom

    def inview(self, b, top=0):
        t, bot = self.limits(top)
        return b is not None and b["y"] >= t and b["y"] + b["height"] <= bot and b["x"] >= 0 and b["x"] + b["width"] <= self.vw

    def act(self, sel, label):
        b = self.box(sel)
        if b is None:
            raise RuntimeError(f"보이지 않아 누를 수 없음: {label}")
        x, y = b["x"] + b["width"] / 2, b["y"] + b["height"] / 2
        if self.mobile:
            self.page.touchscreen.tap(x, y)
        else:
            self.page.mouse.click(x, y)
        self.page.wait_for_timeout(250)
        self.actions.append(f"{'tap' if self.mobile else 'click'} {label} @({int(x)},{int(y)})")

    def wheel(self, dx, dy, over=None, label=""):
        x, y = over or (self.vw / 2, self.vh / 2)
        self.page.mouse.move(x, y)
        self.page.mouse.wheel(dx, dy)
        self.page.wait_for_timeout(140)
        self.actions.append(f"wheel ({dx},{dy}) over ({int(x)},{int(y)}) {label}")

    def wheel_until(self, sel, label, over=None, top=0, max_steps=30):
        for i in range(max_steps):
            b = self.box(sel)
            if self.inview(b, top):
                return i
            t, bot = self.limits(top)
            dy = 160 if (b is None or b["y"] + b["height"] > bot) else -160
            self.wheel(0, dy, over, label)
        raise RuntimeError(f"휠로 보이게 하지 못함: {label}")

    def expose(self, items):
        return self.page.evaluate(JS_EXPOSE, items)

    def shot(self, tag):
        name = f"{self.cand}_{self.vp}_{tag}.png"
        self.page.screenshot(path=str(self.out / "png" / name))
        return name

    def visible_text(self, sel="#mapView"):
        return self.page.locator(sel).inner_text()

    def close(self):
        self.ctx.close()


def scene(rec_list, key, title, fn, **kw):
    rec = {"scene": key, "title": title, "checks": [], "notes": {}, "status": "PASS"}
    try:
        fn(rec, **kw)
    except Fatal:
        raise
    except Exception as e:
        rec["status"] = "FAIL"
        rec["error"] = repr(e)
        rec["trace"] = traceback.format_exc(limit=3)
    if rec["status"] != "UNOBSERVED" and any(c[1] is False for c in rec["checks"]):
        rec["status"] = "FAIL"
    rec_list.append(rec)
    return rec


def chk(rec, what, ok, detail=None):
    rec["checks"].append([what, bool(ok), detail])


# ---------------------------------------------------------------- scenes
def s1_initial(rec, s):
    st = s.st()
    rec["notes"]["state"] = st
    chk(rec, "처음에는 선택 없음(꾸민 선택 없음)", st["selected"] == [] and not st["refbar"] and st["pointed"] == [])
    chk(rec, "중복 DOM id 없음", not st["dupIds"], st["dupIds"])
    chk(rec, "가로 넘침 없음", s.page.evaluate("document.documentElement.scrollWidth") <= s.vw)
    items = [["목표 문장", ".top .aim"], ["기록 기준(과거 보고 당시)", ".ctx .basis"], ["제목", "#briefTitle"], ["핵심 문장", ".ctx .core"],
             ["관계 한정(함께 언급·포함 아님)", ".framenote"], ["다음 AI 요청 한정(미검증)", '.area[data-id="next"] .unk']]
    items += [[f"동작:{p}", f'.part[data-id="{p}"] .nm'] for p in EXPECTED]
    items += [[f"영역:{a}", f'.area[data-id="{a}"] .area-head .nm'] for a in AREAS]
    if s.cand == "a":
        items += [[f"관계칩:{p}", f'.part[data-id="{p}"] .rel'] for p in EXPECTED] + [["미지정 안내", "#legend"]]
    else:
        items += [[f"설명문:{p}", f'#explainBody p[data-part="{p}"]'] for p in EXPECTED] + [["미지정 문장", "#explainBody p.unspec"]]
    ex = s.expose(items)
    rec["notes"]["exposure"] = ex
    rec["notes"]["fully_visible_initial"] = [e["key"] for e in ex if e.get("fully_visible")]
    rec["notes"]["not_fully_visible_initial"] = [e["key"] for e in ex if not e.get("fully_visible")]
    chk(rec, "기록 기준·제목·핵심 문장이 첫 화면에 온전히 보임",
        all(e.get("fully_visible") for e in ex if e["key"] in ("기록 기준(과거 보고 당시)", "제목", "핵심 문장")))
    # 관계 내용 대조(같은 10 관계·미지정 2)
    if s.cand == "a":
        got = s.page.evaluate("""() => { const o={}; document.querySelectorAll('.part').forEach(p=>{
           o[p.dataset.id]={on:[...p.querySelectorAll('.chip.on')].map(c=>c.dataset.area), off:[...p.querySelectorAll('.chip.off')].map(c=>c.dataset.area)};}); return o; }""")
        ok = all(sorted(got[p]["on"]) == sorted(EXPECTED[p]) and sorted(got[p]["off"]) == sorted(set(AREAS) - set(EXPECTED[p])) for p in EXPECTED)
    else:
        got = s.page.evaluate("""() => { const o={}; document.querySelectorAll('#explainBody p[data-part]').forEach(p=>{
           o[p.dataset.part]={on:[...p.querySelectorAll('.ref[data-ref^="a:"]')].map(r=>r.dataset.ref.slice(2)),
                              self:[...p.querySelectorAll('.ref[data-ref^="p:"]')].map(r=>r.dataset.ref.slice(2))};});
           const u=document.querySelector('#explainBody p.unspec');
           o.__unspec={refs:u?[...u.querySelectorAll('.ref')].map(r=>r.dataset.ref):[], text:u?u.textContent:''}; return o; }""")
        ok = all(sorted(set(got[p]["on"])) == sorted(EXPECTED[p]) and got[p]["self"] == [p] for p in EXPECTED) \
            and got["__unspec"]["refs"] == ["a:restore"] and "미지정" in got["__unspec"]["text"] and "무관" in got["__unspec"]["text"]
    rec["notes"]["relations_dom"] = got
    chk(rec, "관계 10개·미지정 2개가 BRIEF 표와 일치", ok)
    vt = s.visible_text()
    chk(rec, "기본 화면에 내부 식별자·해시 없음", not INTERNAL.search(vt), INTERNAL.findall(vt)[:5])
    chk(rec, "발송·수락·승인 숙제 표현 없음", not any(f in vt for f in FORBIDDEN))
    rec["notes"]["shot"] = s.shot("S1_initial")


def select_purpose(s):
    if s.cand == "a":
        s.wheel_until('.part[data-id="purpose"]', "목적 정정 노드")
        s.act('.part[data-id="purpose"]', "목적 정정 노드")
    else:
        s.wheel_until('.ref[data-ref="p:purpose"]', "설명의 '목적 정정' 참조")
        s.act('.ref[data-ref="p:purpose"]', "설명의 '목적 정정' 참조")


def edges_match(s, part="purpose"):
    edges = s.page.evaluate(JS_EDGES)
    heads = s.page.evaluate(JS_HEADS)
    bad = []
    for aid in EXPECTED[part]:
        h = heads[aid]
        if not any(abs(e["x2"] - h["x"]) < 2 and abs(e["y2"] - h["y"]) < 2 for e in edges):
            bad.append(aid)
    starts_ok = all(abs(e["x1"] - heads["__part"]["x"]) < 2 and abs(e["y1"] - heads["__part"]["y"]) < 2 for e in edges)
    return len(edges) == len(EXPECTED[part]) and not bad and starts_ok, {"edges": len(edges), "unmatched": bad, "starts_ok": starts_ok}


def s1_selected(rec, s):
    before = s.st()
    select_purpose(s)
    after = s.st()
    rec["notes"]["before"], rec["notes"]["after"] = before, after
    chk(rec, "목적 정정이 실제 선택됨", after["selected"] == ["purpose"])
    chk(rec, "선택이 다른 영역 깊이를 바꾸지 않음", after["depth"] == before["depth"], after["depth"])
    if s.cand == "a":
        chk(rec, "선택이 지도/창 위치·배율을 바꾸지 않음", after["mapScroll"] == before["mapScroll"] and after["winY"] == before["winY"] and after["zoom"] == before["zoom"])
    else:
        rec["notes"]["app_auto_move"] = {"winY": [before["winY"], after["winY"]], "mapScroll": [before["mapScroll"], after["mapScroll"]]}
        chk(rec, "참조 출발 안내가 보임", after["refbar"] and "목적 정정" in s.page.locator("#refText").inner_text())
        chk(rec, "참조가 원래 노드를 가리킴(복제 없음)", after["pointed"] == ["p:purpose"] and s.page.locator('.part[data-id="purpose"]').count() == 1)
    items = [[f"관련:{a}", f'.area[data-id="{a}"] .area-head'] for a in AREAS] + [["선택 노드", '.part[data-id="purpose"]'], ["하단 선택 안내", "#stripWhat"]]
    ex = s.expose(items)
    rec["notes"]["exposure_after_select"] = ex
    if not s.mobile:
        ok, d = edges_match(s)
        chk(rec, "연결선 4개가 관련 영역 머리와 실제 좌표로 대응", ok, d)
    else:
        n = s.page.locator(".area.is-related .rel-mark.on").evaluate_all("els=>els.filter(e=>e.getBoundingClientRect().width>0).length")
        chk(rec, "관련 표시 4개가 렌더링됨(화면 안 여부는 노출 기록)", n == 4, n)
    st = s.page.locator("#stripWhat").inner_text()
    chk(rec, "하단 선택 안내에 관련 영역", all(x in st for x in ["홈", "작업문", "다음 AI 요청", "저장 복구"]), st)
    rec["notes"]["shot"] = s.shot("S1_selected")


def s2_scope(rec, s):
    """390: 같은 시작에서 목적 정정을 고르고 관련 범위를 확인."""
    st0 = s.st()
    select_purpose(s)
    st1 = s.st()
    rec["notes"]["after_select"] = st1
    chk(rec, "선택됨, 깊이 유지", st1["selected"] == ["purpose"] and st1["depth"] == st0["depth"])
    if s.cand == "b":
        rec["notes"]["app_auto_move_winY"] = [st0["winY"], st1["winY"]]
    # 관련 영역 4곳을 휠로 한 번씩 화면 안에서 보기(표시 포함)
    seen, steps, y0 = {}, 0, s.st()["winY"]
    for i in range(30):
        for a in AREAS:
            if a in seen:
                continue
            b = s.box(f'.area[data-id="{a}"]')
            m = s.box(f'.area[data-id="{a}"] .rel-mark.on')
            if s.inview(b) and m is not None:
                seen[a] = s.st()["winY"]
        if len(seen) == 4:
            break
        s.wheel(0, 160, label="관련 범위 확인")
        steps += 1
    rec["notes"]["related_seen_at_winY"] = seen
    rec["notes"]["wheel_steps"] = steps
    rec["notes"]["distance_px"] = s.st()["winY"] - y0
    chk(rec, "관련 영역 4곳이 표시와 함께 실제 화면에 들어옴", len(seen) == 4, list(seen))
    st2 = s.st()
    chk(rec, "탐색 중 선택·깊이 유지", st2["selected"] == ["purpose"] and st2["depth"] == st0["depth"])
    if s.cand == "b":
        # 설명으로 돌아가기 → 출발 참조, 이어서 영역 참조 직행
        s.wheel_until("#refBack", "설명으로 돌아가기")
        s.act("#refBack", "설명으로 돌아가기")
        b1 = s.st()
        ob = s.box('.ref[data-ref="p:purpose"]')
        chk(rec, "출발 참조가 화면에 다시 보이고 초점이 그 참조에", s.inview(ob) and b1["active"] == "ref:p:purpose", b1["active"])
        chk(rec, "돌아간 위치가 참조 직전 창 위치", b1["winY"] == st0["winY"], [st0["winY"], b1["winY"]])
        chk(rec, "돌아가도 선택은 유지(새 선택과 구별)", b1["selected"] == ["purpose"])
        s.wheel_until('.ref[data-ref="a:next"]', "설명의 '다음 AI 요청' 참조")
        pre = s.st()
        s.act('.ref[data-ref="a:next"]', "설명의 '다음 AI 요청' 참조")
        b2 = s.st()
        tb = s.box('.area[data-id="next"]')
        bar = s.box("#refbar")
        txt = s.page.locator("#refText").inner_text()
        chk(rec, "원래 '다음 AI 요청' 영역을 가리킴(같은 DOM 1개)", b2["pointed"] == ["a:next"] and s.page.locator('.area[data-id="next"]').count() == 1)
        chk(rec, "가리킨 영역이 안내줄·하단바에 가리지 않고 화면 안", s.inview(tb), [tb, bar])
        chk(rec, "안내줄에 함께 언급된 동작 3개", all(x in txt for x in ["목적 정정", "작업 지시", "사용자 결정 표시"]), txt)
        chk(rec, "영역 참조는 선택을 바꾸지 않음", b2["selected"] == ["purpose"] and b2["depth"] == st0["depth"])
        rec["notes"]["app_auto_move_area_ref_winY"] = [pre["winY"], b2["winY"]]
        s.act("#refBack", "설명으로 돌아가기(2)")
        b3 = s.st()
        chk(rec, "두 번째 복귀도 출발 참조·위치로", b3["active"] == "ref:a:next" and b3["winY"] == pre["winY"], [pre["winY"], b3["winY"], b3["active"]])
    rec["notes"]["shot"] = s.shot("S2_scope")


def s3_layout(rec, s):
    """사용자 깊이 조정 → 선택 → 새 접힘(기록 기준·선 뜻) 열고 닫기 → 재선택 없이 대응 확인."""
    # 깊이 조정: 작업문 자세히(2), 홈 접기(0)
    s.wheel_until('.area[data-id="task"] .more', "작업문 자세히", over=None if s.mobile else (900, 450))
    s.act('.area[data-id="task"] .more', "작업문 자세히")
    s.wheel_until('.area[data-id="home"] .area-head', "홈 머리", over=None if s.mobile else (900, 450))
    s.act('.area[data-id="home"] .area-head', "홈 접기")
    d0 = s.st()["depth"]
    chk(rec, "사용자 깊이 조정 반영", d0["task"] == 2 and d0["home"] == 0, d0)
    select_purpose(s)
    st = s.st()
    chk(rec, "선택 후 깊이 그대로", st["depth"] == d0 and st["selected"] == ["purpose"], st["depth"])
    for sel, label in [(".about summary", "기록 기준 더 보기"), ("#help summary", "선과 표시의 뜻")]:
        s.wheel_until(sel, label, over=None if s.mobile else (900, 450))
        s.act(sel, label + " 열기")
        if not s.mobile:
            ok, d = edges_match(s)
            chk(rec, f"{label} 연 뒤 재선택 없이 선-영역 대응", ok, d)
        s.act(sel, label + " 닫기")
        if not s.mobile:
            ok, d = edges_match(s)
            chk(rec, f"{label} 닫은 뒤 재선택 없이 선-영역 대응", ok, d)
    st2 = s.st()
    chk(rec, "접힘 조작 뒤 선택·깊이 유지", st2["selected"] == ["purpose"] and st2["depth"] == d0)
    if s.mobile:
        marks = s.page.evaluate("""() => [...document.querySelectorAll('.area')].map(a=>[a.dataset.id,
            getComputedStyle(a.querySelector('.rel-mark.on')).display!=='none', a.classList.contains('is-related')])""")
        chk(rec, "390 관련 표시가 기대 4영역에만", all(m[1] == (m[0] in EXPECTED["purpose"]) for m in marks), marks)
        # 표시가 실제로 보이는지(가림) 한 곳 확인: 휠로 저장 복구 표시까지
        s.wheel_until('.area[data-id="restore"] .rel-mark.on', "저장 복구 표시")
        b = s.box('.area[data-id="restore"] .rel-mark.on')
        hit = s.page.evaluate(JS_HIT, [b["x"] + b["width"] / 2, b["y"] + b["height"] / 2])
        chk(rec, "저장 복구 표시가 하단 고정바에 가리지 않음", hit is not None and "함께 언급" in hit["text"], hit)
    rec["notes"]["depth"] = d0
    rec["notes"]["shot"] = s.shot("S3_layout")
    return d0


def s4_s5(recs, s, d0):
    """S5 기준 기록 → 진입 → S4(비초기 근거) → (390 A: 준비 하단) → 복귀 → S5 비교."""
    pre = {}

    def prep_base(rec):
        if not s.mobile:
            s.act("#zoomIn", "지도 확대(+)")
            s.wheel(40, 120, over=(900, 450), label="지도 위치 옮기기")
        else:
            s.wheel(0, -200, label="창 위치 조정")
        st = s.st()
        chk(rec, "비초기 지도/창 위치", (st["mapScroll"] != [0, 0]) if not s.mobile else st["winY"] > 0,
            {"mapScroll": st["mapScroll"], "winY": st["winY"], "zoom": st["zoom"]})
        pre["state"] = st
        pre["nodes"] = s.page.evaluate(JS_NODES)
        pre["refText"] = s.page.locator("#refText").inner_text() if st["refbar"] else None
        pre["shot"] = s.shot("S5_before_enter")
        s.wheel_until("#enterFocus", "이 부분 읽기") if s.mobile else None
        if s.mobile and s.st()["winY"] != st["winY"]:
            # 하단 고정바의 버튼은 항상 화면 안이어야 함: 움직였다면 기준을 다시 기록
            pre["state"] = s.st(); pre["nodes"] = s.page.evaluate(JS_NODES)
        s.act("#enterFocus", "이 부분 읽기")
        f = s.st()
        chk(rec, "읽기 공간 진입", f["focus"] and not f["map"])

    def s4(rec):
        btn = '.evbtn[data-claim="p3"]'
        over = None if s.mobile else (900, 400)
        s.wheel(0, 260, over=over, label="읽어 내려가기")
        s.wheel_until(btn, "p3 근거", over=over, top=70 if s.mobile else 49)
        b0 = s.st()
        pos0 = b0["winY"] if s.mobile else b0["readingTop"]
        rec["notes"]["start"] = {"pos": pos0, "active": b0["active"]}
        if pos0 == 0:
            rec["status"] = "UNOBSERVED"
            rec["notes"]["reason"] = "이 크기에서 휠 뒤에도 읽기 위치가 0(본문이 스크롤되지 않음). DOM 조작·가짜 여백으로 만들지 않음."
            return
        para0 = s.box("#c-p3")
        s.act(btn, "p3 근거 열기")
        o = s.st()
        chk(rec, "근거 1개 열림", o["peeks"] == 1 and s.box("#peek-p3") is not None)
        pa = s.box("#c-p3")
        chk(rec, "출발 문장이 화면 안에 남음", pa is not None and pa["y"] >= (55 if s.mobile else 49) and pa["y"] < s.vh, pa and int(pa["y"]))
        txt = s.page.locator("#peek-p3").inner_text()
        chk(rec, "문서 보고·해석·미확인 구분", all(k in txt for k in ["문서 보고", "원문 전체가 아닙니다", "이 설명이 읽은 방식", "이 기록으로 알 수 없는 것"]))
        href = s.page.locator("#peek-p3 a").get_attribute("href") or ""
        chk(rec, "외부 원문 링크 고정 커밋(열지 않음)", "f0fa5326" in href and "#L226-L237" in href)
        if not s.inview(s.box("#peek-p3 .peek-close")):
            s.wheel_until("#peek-p3 .peek-close", "근거 닫기 버튼")
        cb = s.box("#peek-p3 .peek-close")
        pt = [cb["x"] + cb["width"] / 2, cb["y"] + cb["height"] / 2]
        s.act("#peek-p3 .peek-close", "근거 닫기")
        c = s.st()  # 닫은 직후, 다음 휠 전에
        pos1 = c["winY"] if s.mobile else c["readingTop"]
        hit = s.page.evaluate(JS_HIT, pt)
        chk(rec, "닫은 근거가 DOM·화면에서 사라짐", c["peeks"] == 0 and not (hit and hit["inPeek"]), hit)
        chk(rec, "닫은 직후 읽던 위치 = 열기 전(비초기)", pos1 == pos0, {"before_open": pos0, "after_close": pos1})
        chk(rec, "초점이 출발 근거 버튼", c["active"] == "evbtn:p3", c["active"])
        pc = s.box("#c-p3")
        chk(rec, "출발 문장 위치 동일", pc is not None and abs(pc["y"] - para0["y"]) < 1, [para0["y"], pc and pc["y"]])
        s.act(btn, "p3 근거 다시 열기")
        r = s.st()
        head = s.page.locator("#peek-p3 .peek-head .t").inner_text()
        chk(rec, "다시 열어도 1개, 출발 인용 첫 줄", r["peeks"] == 1 and "AI 해석이 낡아도" in head and s.box("#peek-p3 .peek-head") is not None)
        s.page.keyboard.press("Escape"); s.page.wait_for_timeout(200); s.actions.append("key Escape")
        e = s.st()
        pos2 = e["winY"] if s.mobile else e["readingTop"]
        chk(rec, "Escape로 닫힘·초점·위치 복귀", e["peeks"] == 0 and e["active"] == "evbtn:p3" and pos2 == pos0, {"pos": pos2, "active": e["active"]})
        rec["notes"]["positions"] = {"before_open": pos0, "after_close": pos1, "after_escape": pos2}
        rec["notes"]["shot_closed"] = s.shot("S4_closed")

    def prep390(rec):
        pb = "#prepBtn"
        s.wheel_until(pb, "준비 제안 버튼", top=70)
        b = s.st(); pos = b["winY"]
        s.act(pb, "준비 제안 열기")
        d = s.st()
        chk(rec, "준비 화면 열림", d["dialog"])
        t = s.page.locator("#prep").inner_text()
        chk(rec, "준비 제안·보내지 않음 표시", "준비 제안이며 보내지 않습니다" in t and "받을 담당자: 기록에 없음" in t)
        btns = [x.strip() for x in s.page.locator("#prep button").all_inner_texts()]
        chk(rec, "준비 화면 버튼은 닫기뿐", btns == ["닫기"], btns)
        steps = s.wheel_until("#prep .nosend", "준비 하단 안내", over=(195, 600))
        rec["notes"]["prep_wheel_steps_to_bottom"] = steps
        rec["notes"]["prep_inner_scroll"] = s.page.evaluate("document.getElementById('prepBody').scrollTop")
        s.act("#prepClose", "준비 닫기")
        a = s.st()
        chk(rec, "준비 닫힘·초점·위치", (not a["dialog"]) and a["active"] == "prepBtn" and a["winY"] == pos, {"pos": [pos, a["winY"]], "active": a["active"]})
        vt = s.page.locator("body").inner_text()
        chk(rec, "발송·수락 표현 없음", not any(f in vt for f in FORBIDDEN))

    def s5(rec):
        ret = "#returnAll"
        b = s.box(ret)
        chk(rec, "전체 복귀 버튼이 지금 화면 안(추가 스크롤 불필요)", s.inview(b), b and int(b["y"]))
        s.act(ret, "전체 지도로 돌아가기")
        s.page.wait_for_timeout(150)
        a = s.st()                                  # 복귀 직후, 어떤 보조 스크롤도 하기 전
        nodes = s.page.evaluate(JS_NODES)
        p = pre["state"]
        rec["notes"]["pre"] = {"state": p, "nodes": pre["nodes"]}
        rec["notes"]["post"] = {"state": a, "nodes": nodes}
        chk(rec, "지도 보임·읽기 닫힘", a["map"] and not a["focus"])
        chk(rec, "같은 선택", a["selected"] == p["selected"] == ["purpose"])
        chk(rec, "사용자 깊이 유지", a["depth"] == d0 == p["depth"], a["depth"])
        chk(rec, "지도/창 위치·배율 복귀", a["mapScroll"] == p["mapScroll"] and a["winY"] == p["winY"] and a["zoom"] == p["zoom"],
            {"pre": [p["mapScroll"], p["winY"], p["zoom"]], "post": [a["mapScroll"], a["winY"], a["zoom"]]})
        diff = {k: (pre["nodes"][k], nodes[k]) for k in nodes if pre["nodes"][k] != nodes[k]}
        chk(rec, "기준 노드 7개 좌표 동일(0.1px 반올림)", not diff, diff)
        chk(rec, "초점이 선택 노드", a["active"] == "part is-selected:purpose", a["active"])
        if not s.mobile:
            ok, d = edges_match(s)
            chk(rec, "복귀 뒤 선-영역 대응", ok, d)
        if s.cand == "b":
            post_ref = s.page.locator("#refText").inner_text() if a["refbar"] else None
            chk(rec, "B 출발 참조 안내가 진입 전과 같음", post_ref == pre["refText"], [pre["refText"], post_ref])
        chk(rec, "근거·준비 잔여 없음", a["peeks"] == 0 and not a["dialog"])
        rec["notes"]["shot"] = s.shot("S5_returned")

    out = {}
    r5 = {"scene": f"S5@{s.vp}", "title": "전체로 돌아와 이어보기", "checks": [], "notes": {}, "status": "PASS"}
    try:
        prep_base(r5)
        out["S4"] = scene(recs, f"S4@{s.vp}", "비초기 위치에서 근거 닫기·다시 열기·Escape", s4)
        if s.mobile and s.cand == "a":
            out["prep"] = scene(recs, "S5prep@390", "준비 열기·하단 접근·닫기(390에서 한 번)", prep390)
        s5(r5)
    except Fatal:
        raise
    except Exception as e:
        r5["status"] = "FAIL"; r5["error"] = repr(e); r5["trace"] = traceback.format_exc(limit=3)
    if any(c[1] is False for c in r5["checks"]):
        r5["status"] = "FAIL"
    recs.append(r5)
    return out


# ---------------------------------------------------------------- driver
def run_candidate(browser, cand, url, exp_sha, out, nav, info):
    recs = []
    sessions = []

    def new(vp):
        s = Session(browser, cand, vp, url, exp_sha, out, nav)
        sessions.append(s)
        return s
    try:
        for vp in ["390", "1280", "1440"]:
            s = new(vp)
            scene(recs, f"S1@{vp}", "새로 연 첫 화면", s1_initial, s=s)
            if vp != "1440":
                scene(recs, f"S1sel@{vp}", "목적 정정 선택 직후", s1_selected, s=s)
        s = new("390")
        scene(recs, "S2@390", "현재 부분과 관련 범위 찾기", s2_scope, s=s)
        for vp in ["390", "1280"]:
            s = new(vp)
            box_ = {}

            def s3wrap(rec):
                box_["d0"] = s3_layout(rec, s)
            r3 = scene(recs, f"S3@{vp}", "선택을 유지한 배치 변화", s3wrap)
            if "d0" in box_:
                s4_s5(recs, s, box_["d0"])
    finally:
        for s in sessions:
            info.setdefault("page_errors", []).extend(s.page_errors)
            info.setdefault("console_errors", []).extend(s.console_errors)
            info.setdefault("actions", {})[f"{s.cand}_{s.vp}_{len(info['actions'])}"] = s.actions
            info.setdefault("external_requests", []).extend([u for u in s.requests if not u.startswith(url.rsplit('/', 1)[0])])
            try:
                s.close()
            except Exception as e:
                info.setdefault("cleanup_errors", []).append(repr(e))
    return recs


def verdict(cand_res, nav):
    reasons = []
    if cand_res.get("fatal"):
        reasons.append(f"fatal: {cand_res['fatal']}")
    seen = {r["scene"]: r["status"] for r in cand_res.get("scenes", [])}
    for k in REQUIRED:
        if k not in seen:
            reasons.append(f"미완주: {k} 기록 없음")
        elif seen[k] != "PASS":
            reasons.append(f"{k} {seen[k]}")
    for k in CONDITIONAL + ["S5prep@390"]:
        if seen.get(k) == "FAIL":
            reasons.append(f"{k} FAIL")
    i = cand_res.get("info", {})
    if i.get("page_errors"):
        reasons.append(f"pageerror {len(i['page_errors'])}건")
    if i.get("cleanup_errors"):
        reasons.append(f"cleanup 오류 {i['cleanup_errors']}")
    return reasons


def main(argv):
    url, html, out = argv[1], Path(argv[2]), Path(argv[3])
    (out / "png").mkdir(parents=True, exist_ok=True)
    exp_sha = hashlib.sha256(html.read_bytes()).hexdigest()
    res = {"started": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "expected_html": html.name, "expected_sha256": exp_sha,
           "url": url, "navigations": [], "candidates": {}, "browser": None}
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            res["browser"] = f"chromium {browser.version}"
            try:
                for cand in ["a", "b"]:
                    cr = {"info": {}, "scenes": []}
                    res["candidates"][cand] = cr
                    try:
                        cr["scenes"] = run_candidate(browser, cand, url, exp_sha, out, res["navigations"], cr["info"])
                    except Fatal as e:
                        cr["fatal"] = str(e)
                    except Exception as e:
                        cr["fatal"] = repr(e); cr["trace"] = traceback.format_exc(limit=4)
            finally:
                try:
                    browser.close()
                except Exception as e:
                    res["cleanup_error"] = repr(e)
    except Exception as e:
        res["fatal"] = repr(e)
    failures = {}
    if res.get("fatal"):
        failures["*"] = [f"fatal: {res['fatal']}"]
    if res.get("cleanup_error"):
        failures.setdefault("*", []).append(f"cleanup: {res['cleanup_error']}")
    if any(not n["match"] for n in res["navigations"]):
        failures.setdefault("*", []).append("응답 body 해시/상태 불일치")
    for cand in ["a", "b"]:
        c = res["candidates"].get(cand)
        r = ["실행 기록 없음"] if c is None else verdict(c, res["navigations"])
        if r:
            failures[cand] = r
    code = 1 if failures else 0
    res["verdict"] = {"exit_code": code, "failures": failures}
    (out / "orientation_result.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
    L = [f"기대 HTML {html.name} sha256={exp_sha}", f"{res['browser']} · {url} · 시작 {res['started']}"]
    shas = sorted({(n['body_sha256'], n['status']) for n in res['navigations']})
    L.append(f"브라우저 응답 body: 탐색 {len(res['navigations'])}회, 고유 (sha256,status)={[(s[:16], st) for s, st in shas]}, 모두 일치={all(n['match'] for n in res['navigations'])}")
    for cand, c in res["candidates"].items():
        L.append(f"\n== 후보 {cand.upper()}" + (f"  FATAL {c['fatal']}" if c.get("fatal") else ""))
        for r in c.get("scenes", []):
            L.append(f"[{r['status']}] {r['scene']} {r['title']}" + (f"  ERROR {r['error']}" if "error" in r else "")
                     + (f"  ({r['notes'].get('reason')})" if r["status"] == "UNOBSERVED" else ""))
            for ck in r["checks"]:
                if not ck[1]:
                    L.append(f"     - FAIL {ck[0]} :: {ck[2]}")
        i = c.get("info", {})
        L.append(f"   pageerror: {i.get('page_errors') or '없음'} / console error: {i.get('console_errors') or '없음'} / 외부 요청: {i.get('external_requests') or '없음'} / cleanup: {i.get('cleanup_errors') or '없음'}")
    L.append("\n외부 GitHub 원문 왕복: 미실행(href만 확인)")
    L.append(f"판정: {'FAIL' if code else 'PASS'} (exit {code})")
    for k, v in failures.items():
        for x in v:
            L.append(f"   {k}: {x}")
    (out / "orientation_log.txt").write_text("\n".join(L) + "\n", encoding="utf-8")
    print("\n".join(L))
    return code


if __name__ == "__main__":
    sys.exit(main(sys.argv))
