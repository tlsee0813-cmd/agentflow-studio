import sys
src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding="utf-8").read()
def rep(a, b, n=1):
    global s
    c = s.count(a)
    assert c == n, (a[:80], c)
    s = s.replace(a, b)
def cut(start, end):
    """return the exact base text between markers (inclusive start, exclusive end)"""
    i = s.index(start); j = s.index(end, i)
    return s[i:j]

# ---- title + variant bootstrap (before paint)
rep('<title>복귀 흐름 연구</title>',
    '<title>첫 진입 비교 연구</title>\n<script>(function(){var v=(new URLSearchParams(location.search).get("v")||"a").toLowerCase()==="b"?"b":"a";document.documentElement.className="v-"+v;document.documentElement.dataset.v=v;})();</script>')

# ---- CSS: header + map view block replaced
old_css = cut('/* header */', '/* ---------- focus view ---------- */')
new_css = r'''/* header */
.top{display:flex;align-items:center;gap:14px;padding:0 24px;height:49px;border-bottom:1px solid var(--rule);background:var(--sheet)}
.top b{font-weight:700;letter-spacing:-.01em;white-space:nowrap}
.top .aim{flex:1;min-width:0;font-size:13.5px;color:var(--ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* research-only candidate switch: neutral grey, not product chrome */
.variant{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--ink-3);white-space:nowrap}
.variant a{display:inline-block;padding:3px 9px;border:1px solid var(--rule);border-radius:5px;color:var(--ink-2);text-decoration:none;background:#fff}
.variant a[aria-current="page"]{border-color:var(--ink-2);color:var(--ink);font-weight:600;background:var(--paper)}

/* ---------- map view ---------- */
.narrow-only,.relm{display:none}
.mapview{height:calc(100vh - 49px)}
.lead{background:var(--sheet)}
.ctx .basis{font-size:13px;color:var(--ink-3);margin:0 0 6px}
.ctx h1{font-family:var(--serif);font-weight:600;font-size:26px;line-height:1.3;letter-spacing:-.02em;margin:0 0 8px}
.ctx .core{margin:0 0 6px}
.about{font-size:13px;color:var(--ink-3)}
.about summary{cursor:pointer;color:var(--accent-ink);width:max-content}
.about ul{margin:6px 0 2px;padding-left:18px;line-height:1.5}
.about li{margin:3px 0}

/* A: context band on top, full-width map below */
.v-a .mapview{display:grid;grid-template-rows:auto minmax(0,1fr)}
.v-a .lead{border-bottom:1px solid var(--rule);padding:14px 28px 12px}
.v-a .ctx{display:grid;grid-template-columns:max-content minmax(0,1fr);column-gap:36px;align-items:baseline}
.v-a .ctx-head{display:contents}
.v-a .ctx .basis{grid-column:1/-1;margin-bottom:4px}
.v-a .ctx h1{margin:0}
.v-a .ctx .core{margin:0}
.v-a .about{grid-column:2}
.v-a .explain{display:none}
/* B: explanation column on the left, map on the right */
.v-b .mapview{display:grid;grid-template-columns:420px minmax(0,1fr)}
.v-b .lead{border-right:1px solid var(--rule);padding:24px 26px;overflow:auto}

.explain{margin-top:16px;border-top:1px solid var(--rule-2);padding-top:14px}
.explain h2{font-size:13px;font-weight:500;color:var(--ink-3);margin:0 0 8px}
.explain p{margin:0 0 10px;padding-left:11px;border-left:3px solid transparent;line-height:1.75}
.explain p.is-sel{border-left-color:var(--accent)}
.explain p.unspec{color:var(--ink-2);font-size:14px}
.ref{font:inherit;line-height:1.3;border:0;margin:0;padding:0 2px;border-radius:3px;cursor:pointer;background:var(--accent-soft);color:var(--accent-ink);box-shadow:inset 0 -1.5px 0 var(--accent)}
.ref.pref{font-weight:700;background:transparent;color:var(--ink);box-shadow:inset 0 -2px 0 var(--ink-3)}
.ref:hover,.ref.hint{background:#BFE0E0}
.ref.pref:hover,.ref.pref.hint{background:transparent;box-shadow:inset 0 -2px 0 var(--accent)}

.mappane{display:flex;flex-direction:column;min-width:0;min-height:0}
.maptools{display:flex;align-items:center;gap:8px;padding:9px 18px;border-bottom:1px solid var(--rule-2)}
.maptools .hint{flex:1;color:var(--ink-3);font-size:13px;margin:0}
.zoom{display:flex;align-items:center;border:1px solid var(--rule);border-radius:6px;background:var(--sheet)}
.zoom button{border:0;background:none;width:32px;height:30px;cursor:pointer;font-size:17px;line-height:1}
.zoom button:disabled{color:#AEB6B3;cursor:default}
.zoom output{min-width:48px;text-align:center;font-size:13px;color:var(--ink-2);border-left:1px solid var(--rule-2);border-right:1px solid var(--rule-2);line-height:30px}
.refbar{display:flex;align-items:center;gap:10px;padding:7px 18px;background:#EAF3F3;border-bottom:1px solid var(--rule-2);font-size:13.5px}
.refbar .rt{flex:1;color:var(--ink-2);min-width:0}
.refbar .rt b{color:var(--ink)}
.refbar .btn{padding:5px 12px;font-size:13.5px}
.mapscroll{flex:1;overflow:auto;min-height:0;position:relative}
.sizer{position:relative}
.canvas{position:absolute;left:0;top:0;transform-origin:0 0;display:grid;align-items:start}
.v-a .canvas{grid-template-columns:430px 100px 420px;padding:16px 32px 28px}
.v-b .canvas{grid-template-columns:270px 100px 360px;padding:18px 28px 28px}
.edges{position:absolute;left:0;top:0;pointer-events:none;overflow:visible}
.colhead{font-size:13px;color:var(--ink-3);margin:0 0 8px;font-weight:500}
.legend{font-size:12.5px;color:var(--ink-3);margin:0 0 10px;line-height:1.5}

.parts{grid-column:1;display:flex;flex-direction:column;gap:12px}
.part{display:block;width:100%;text-align:left;background:var(--sheet);border:1px solid var(--rule);border-radius:10px;padding:12px 15px 13px;cursor:pointer;transition:border-color .15s, box-shadow .15s}
.part:hover{border-color:var(--accent)}
.part .nm{display:block;font-weight:700;font-size:16px;letter-spacing:-.01em}
.part .ln{display:block;color:var(--ink-2);font-size:14px;margin-top:2px;line-height:1.5}
.part.is-selected{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent) inset;background:#fff}
.part.is-selected .nm::after{content:" — 선택됨";font-weight:500;font-size:13px;color:var(--accent-ink)}
.rel{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px;align-items:center}
.rel .rl{font-size:12px;color:var(--ink-3);margin-right:2px}
.chip{font-size:12.5px;line-height:1.35;padding:1px 8px;border-radius:11px;border:1px solid var(--accent);color:var(--accent-ink);background:#fff;white-space:nowrap}
.chip.off{border:1px dashed #98A4A0;color:var(--ink-3);background:transparent}
.chip.hint{background:var(--accent-soft)}
.chip.off.hint{background:#E7ECEA}
.part.is-selected .chip.on{background:var(--accent);color:#fff}

.frame{grid-column:3;border:1.5px dashed #9FAAA6;border-radius:12px;padding:12px 14px 14px;background:rgba(250,251,250,.55)}
.frame .colhead{margin-bottom:2px;color:var(--ink-2)}
.frame .framenote{font-size:12.5px;color:var(--ink-3);margin:0 0 2px;line-height:1.45}
.help{font-size:12.5px;color:var(--ink-3);margin:0 0 4px}
.help summary{cursor:pointer;color:var(--accent-ink);width:max-content}
.help p{margin:4px 0 0;line-height:1.5}
.area{background:var(--sheet);border:1px solid var(--rule);border-radius:8px;margin-top:9px;transition:border-color .15s, box-shadow .15s}
.area-head{display:flex;align-items:center;gap:8px;width:100%;border:0;background:none;padding:9px 12px;cursor:pointer;text-align:left}
.area-head .nm{font-weight:600;flex:1}
.area-head .chev{width:18px;height:18px;color:var(--ink-3);transition:transform .15s}
.area-head[aria-expanded="true"] .chev{transform:rotate(90deg)}
.area-body{padding:0 12px 10px 12px;font-size:14px;color:var(--ink-2)}
.area-body p{margin:0}
.area-body ul{margin:6px 0 2px;padding-left:18px}
.area-body li{margin:3px 0}
.more{border:0;background:none;padding:0;margin-left:6px;color:var(--accent-ink);font-size:13px;cursor:pointer;text-decoration:underline;text-underline-offset:3px;white-space:nowrap}
.rel-mark{display:none;font-size:12px;font-weight:500;white-space:nowrap}
.rel-mark.on{color:var(--accent-ink)}
.rel-mark.off{color:var(--ink-3)}
.has-sel .area.is-related{border-color:var(--accent)}
.has-sel .area:not(.is-related){border-style:dashed}
.has-sel .area:not(.is-related) .rel-mark.off{display:inline}
.area.is-hinted,.part.is-hinted{box-shadow:0 0 0 3px var(--accent-soft)}
.area.is-pointed,.part.is-pointed{outline:2px dashed var(--accent);outline-offset:3px}
.unk{color:var(--unk);text-decoration:underline dotted;text-underline-offset:3px}

.strip{display:flex;align-items:center;gap:14px;padding:11px 18px;border-top:1px solid var(--rule);background:var(--sheet);min-height:60px}
.strip .what{flex:1;font-size:14px;color:var(--ink-2)}
.strip .what strong{color:var(--ink);font-size:15px}
.btn{border:1px solid var(--accent);background:var(--accent);color:#fff;border-radius:8px;padding:9px 16px;font-weight:600;cursor:pointer;white-space:nowrap}
.btn:hover{background:var(--accent-ink)}
.btn.ghost{background:transparent;color:var(--accent-ink)}
.btn.ghost:hover{background:var(--accent-soft)}

'''
rep(old_css, new_css)
rep('.rail .kept{font-size:12.5px;color:var(--ink-3);margin-top:22px;line-height:1.5}',
    '.rail .kept{font-size:12.5px;color:var(--ink-3);margin-top:22px;line-height:1.5}\n.rail .unsp,.rail .from{font-size:13px;color:var(--ink-3);margin:8px 0 0;line-height:1.5}')

# ---- mobile CSS
old_m = cut('  html,body{font-size:15px}', '  .strip{position:fixed;')
new_m = '''  html,body{font-size:15px}
  .top{height:auto;padding:8px 16px;flex-wrap:wrap;gap:4px 10px}
  .top b{flex:1}
  .top .aim{order:3;flex-basis:100%;white-space:normal;line-height:1.45;font-size:13px}
  .variant a{padding:2px 7px}
  .mapview,.focusview,.v-a .mapview,.v-b .mapview{display:block;height:auto}
  .v-a .lead,.v-b .lead{border-right:0;border-bottom:1px solid var(--rule);padding:16px 16px 14px;overflow:visible}
  .v-a .ctx{display:block}
  .v-a .ctx .basis{margin-bottom:6px}
  .v-a .ctx .core{margin:0 0 6px}
  .v-a .ctx h1{margin:0 0 8px}
  .ctx h1{font-size:22px}
  .maptools{padding:12px 16px 6px;border-bottom:0}
  .zoom{display:none}
  .refbar{position:sticky;top:0;z-index:4;padding:8px 16px;flex-wrap:wrap;box-shadow:0 2px 8px rgba(0,0,0,.06)}
  .mapscroll{overflow:visible}
  .sizer{width:auto !important;height:auto !important}
  .v-a .canvas,.v-b .canvas{position:static;transform:none !important;display:block;padding:4px 16px 110px}
  .edges{display:none}
  .parts{gap:10px}
  .frame{margin-top:20px}
  .part{padding:12px 14px}
  .has-sel .area.is-related .rel-mark.on{display:inline}
  .rail .from,.rail .unsp{display:none !important}
'''
rep(old_m, new_m)

# ---- header HTML
rep('<header class="top"><b>AgentFlow Studio</b><span class="aim">이 프로젝트의 목표: AI와 만드는 프로그램의 구상과 변화를 살피고, 필요한 부분을 이어 맡기는 공간</span><span class="tag">연구 시안</span></header>',
    '<header class="top"><b>AgentFlow Studio</b><span class="aim">이 프로젝트의 목표: AI와 만드는 프로그램의 구상과 변화를 살피고, 필요한 부분을 이어 맡기는 공간</span>'
    '<nav class="variant" aria-label="연구 비교 후보 선택 (바꾸면 처음 상태로 새로 시작)" title="연구용 비교 도구입니다. 후보를 바꾸면 처음 상태로 새로 시작합니다.">'
    '<span class="wide-only">연구 비교 · 바꾸면 새로 시작</span>'
    '<a href="?v=a" data-v="a"><span class="wide-only">A 관련 범위 먼저</span><span class="narrow-only">A 범위 먼저</span></a>'
    '<a href="?v=b" data-v="b"><span class="wide-only">B 설명에서 바로 연결</span><span class="narrow-only">B 설명 연결</span></a></nav></header>')

# ---- map view HTML (lead + map)
old_main = cut('  <section class="brief" aria-labelledby="briefTitle">', '    <div class="mapscroll" id="mapScroll" tabindex="-1">')
new_main = '''  <div class="lead" id="lead">
    <section class="ctx" aria-labelledby="briefTitle">
      <div class="ctx-head">
        <p class="basis">과거 개발 보고가 적은 변경 당시의 설명입니다. 원요청과 인계 결과는 이 기록에 없습니다.</p>
        <h1 id="briefTitle">목적 정정은 별도로, 작업 지시는 그대로</h1>
      </div>
      <div class="ctx-body">
        <p class="core">목적을 바로잡아도 직접 쓴 작업 지시와 현재 요청은 그대로 두도록 바꿨다고 보고합니다.</p>
        <details class="about"><summary>기록 기준 더 보기</summary><ul>
          <li>방문 이력이 없어 ‘지난 방문 이후’가 아니라 과거 보고의 변경 당시 설명을 보여 줍니다.</li>
          <li>이 기록은 지금 결정을 요청하지 않습니다.</li>
          <li>실제 AI가 정정을 따르는지는 확인되지 않았고, 개발 쪽 검증은 합성 응답과 MOCK이었다고 적혀 있습니다.</li>
          <li>사용자 원요청, 승인, 실제 인계 수신·수락은 이 기록에 없습니다.</li>
          <li>고정 출처와 구절은 각 부분을 읽을 때 ‘근거’에서 볼 수 있습니다.</li>
        </ul></details>
      </div>
    </section>
    <section class="explain" id="explain" aria-labelledby="explainT">
      <h2 id="explainT">무엇이 어디와 함께 적혀 있나</h2>
      <div id="explainBody"></div>
    </section>
  </div>

  <section class="mappane" aria-label="변경 지도">
    <div class="maptools">
      <p class="hint" id="mapHint"></p>
      <div class="zoom" role="group" aria-label="지도 배율">
        <button type="button" id="zoomOut" aria-label="지도 축소">−</button>
        <output id="zoomVal" aria-live="polite">100%</output>
        <button type="button" id="zoomIn" aria-label="지도 확대">+</button>
      </div>
    </div>
    <div class="refbar" id="refbar" hidden>
      <p class="rt" id="refText"></p>
      <button type="button" class="btn ghost" id="refBack">설명으로 돌아가기</button>
    </div>
'''
rep(old_main, new_main)
rep('''            <p class="colhead">기록이 바꿨다고 보고한 동작</p>''',
    '''            <p class="colhead">기록이 바꿨다고 보고한 동작</p>
            <p class="legend" id="legend"></p>''')
rep('''            <p class="framenote">이 기록에서 함께 언급된 영역입니다. 모듈 구조나 포함 관계가 아닙니다.</p>
            <details class="help"><summary>선과 묶음의 뜻</summary><p>문서에 함께 언급된 곳을 살펴보려고 묶은 연구 배치입니다. 선(좁은 화면에서는 ‘함께 언급’ 표시)은 함께 언급됨만 뜻하며, 실행 순서나 자동 분석 결과가 아닙니다. 지도의 묶음은 실제 포함 관계를 입증하지 않습니다.</p></details>''',
    '''            <p class="framenote">이 기록에서 함께 언급된 영역입니다. 포함 구조나 실행 순서가 아닙니다.</p>
            <details class="help" id="help"><summary>선과 표시의 뜻</summary><p>문서에 함께 언급된 곳을 살펴보려고 묶은 연구 배치입니다. 선(좁은 화면에서는 ‘함께 언급’ 표시)은 함께 언급됨만 뜻하며 실행 순서나 자동 분석 결과가 아닙니다. 묶음은 실제 포함 관계를 입증하지 않습니다. ‘미지정’은 이 기록에 함께 적히지 않았다는 뜻이며 무관하다는 증명이 아닙니다.</p></details>''')

# ---- rail
rep('''    <ul id="railAreas"></ul>''', '''    <ul id="railAreas"></ul>
    <p class="unsp" id="railUnspec" hidden></p>
    <p class="from" id="railFrom" hidden></p>''')

# ---- data: area summaries (all depth 1 at start, same in A and B)
rep('''  {id:"home", name:"홈", depth:1,
   short:"정정한 목적이 AI 해석과 따로 보임",''', '''  {id:"home", name:"홈", depth:1,
   short:"정정한 목적이 AI 해석과 따로 보임",''')
rep('''  {id:"task", name:"작업문", depth:2,''', '''  {id:"task", name:"작업문", depth:1,''')
rep('''  {id:"next", name:"다음 AI 요청", depth:0,
   short:"재정리 요청에 정정 내용이 실림",''', '''  {id:"next", name:"다음 AI 요청", depth:1,
   short:"재정리 요청에 정정이 실린다는 보고이며, <span class=\\"unk\\">실제 AI 준수는 미검증</span>",''')
rep('''   short:"옛 형식의 정정을 복원 때 한 번 새 형식으로 옮김",''', '''   short:"옛 형식 정정은 복원 때 한 번 새 형식으로, 작업 지시는 그대로",''')

# ---- variant + explanation data, inserted after PART index
rep('''var PART = {}; PARTS.forEach(function(p){PART[p.id]=p;});''', '''var PART = {}; PARTS.forEach(function(p){PART[p.id]=p;});
var AREA_ORDER = ["home","task","next","restore"];
var V = document.documentElement.dataset.v==="b" ? "b" : "a";
/* B: the same 10 mention pairs and the 2 unspecified pairs, written as sentences whose names point at the existing targets */
var EXPLAIN = [
  {part:"purpose", t:"{p:purpose}은 작업 지시와 따로 저장되고, 이 기록은 그것을 {a:home} · {a:task} · {a:next} · {a:restore}와 함께 적습니다."},
  {part:"instruction", t:"작업 카드에서 직접 고친 {p:instruction}는 그 작업에만 남으며 {a:home} · {a:task} · {a:next}과 함께 적혀 있습니다."},
  {part:"decision", t:"{p:decision}는 사용자 결정을 AI 해석보다 앞선 조건으로 보이게 하며 {a:home} · {a:task} · {a:next}과 함께 적혀 있습니다."},
  {part:null, t:"{a:restore}와 작업 지시·사용자 결정 표시의 관계는 이 기록에 적혀 있지 않습니다. 미지정이며 무관하다는 뜻은 아닙니다."}
];''')

# ---- state
rep('''var state = {selected:null, hover:null, zoomIdx:1, mode:"map", saved:null, peek:null, prepFrom:null};''',
    '''var state = {selected:null, hover:null, zoomIdx:1, mode:"map", saved:null, peek:null, prepFrom:null, origin:null, pointed:null};''')

# ---- part build: chips for A
rep('''  b.innerHTML='<span class="nm">'+p.name+'</span><span class="ln">'+p.line+'</span>';
  b.addEventListener("click",function(){select(p.id);});
  b.addEventListener("mouseenter",function(){state.hover=p.id;drawEdges();});
  b.addEventListener("mouseleave",function(){state.hover=null;drawEdges();});''',
'''  var h='<span class="nm">'+p.name+'</span><span class="ln">'+p.line+'</span>';
  if(V==="a"){
    h+='<span class="rel"><span class="rl">함께 언급</span>'+AREA_ORDER.map(function(aid){
      var on=p.related.indexOf(aid)>=0;
      return '<span class="chip '+(on?'on':'off')+'" data-area="'+aid+'">'+AREA[aid].name+(on?'':' 미지정')+'</span>';
    }).join("")+'</span>';
  }
  b.innerHTML=h;
  b.addEventListener("click",function(){select(p.id);});
  b.addEventListener("mouseenter",function(){state.hover=p.id;drawEdges();hintRefs("p:"+p.id,true);});
  b.addEventListener("mouseleave",function(){state.hover=null;drawEdges();hintRefs("p:"+p.id,false);});''')

# ---- area build: marks + hover cross-hint
rep('''    '<span class="nm">'+a.name+'</span><span class="rel-mark">선택한 부분과 함께 언급</span></button>'+''',
    '''    '<span class="nm">'+a.name+'</span><span class="rel-mark on">선택한 동작과 함께 언급</span><span class="rel-mark off">이 동작과는 미지정</span></button>'+''')
rep('''  frameEl.appendChild(box);
  renderArea(a.id);''', '''  box.addEventListener("mouseenter",function(){hintArea(a.id,true);});
  box.addEventListener("mouseleave",function(){hintArea(a.id,false);});
  frameEl.appendChild(box);
  renderArea(a.id);''')
# 'more' inline after the summary sentence
rep('''    var h='<p>'+a.short+'</p>';
    if(d===2) h+='<ul>'+a.detail.map(function(x){return '<li>'+x+'</li>';}).join("")+'</ul>';
    h+='<button type="button" class="more" aria-expanded="'+(d===2)+'">'+(d===2?'간단히':'자세히')+'</button>';''',
'''    var mb='<button type="button" class="more" aria-expanded="'+(d===2)+'">'+(d===2?'간단히':'자세히')+'</button>';
    var h='<p>'+a.short+(d===1?' '+mb:'')+'</p>';
    if(d===2) h+='<ul>'+a.detail.map(function(x){return '<li>'+x+'</li>';}).join("")+'</ul><p>'+mb+'</p>';''')

# ---- select(): strip names unspecified too; B marks the sentence
rep('''  $("stripWhat").innerHTML='<strong>'+PART[id].name+'</strong> 선택됨 <span class="ln">함께 언급: '+rel.map(function(r){return AREA[r].name;}).join(", ")+'</span>';''',
'''  var uns=AREA_ORDER.filter(function(r){return rel.indexOf(r)<0;});
  rel=AREA_ORDER.filter(function(r){return rel.indexOf(r)>=0;});
  $("stripWhat").innerHTML='<strong>'+PART[id].name+'</strong> 선택됨 <span class="ln">함께 언급: '+rel.map(function(r){return AREA[r].name;}).join(", ")+
    (uns.length?' · 미지정: '+uns.map(function(r){return AREA[r].name;}).join(", "):'')+'</span>';
  document.querySelectorAll("#explainBody p[data-part]").forEach(function(p){p.classList.toggle("is-sel",p.dataset.part===id);});''')

# ---- renderFocus rail additions
rep('''  $("railAreas").innerHTML=p.related.map(function(r){return '<li>'+AREA[r].name+'</li>';}).join("");''',
'''  var relo=AREA_ORDER.filter(function(r){return p.related.indexOf(r)>=0;});
  $("railAreas").innerHTML=relo.map(function(r){return '<li>'+AREA[r].name+'</li>';}).join("");
  var fromHere=state.origin && state.origin.key==="p:"+id;
  var uns=AREA_ORDER.filter(function(r){return p.related.indexOf(r)<0;});
  $("railUnspec").hidden=!uns.length;
  $("railUnspec").textContent=uns.length?'미지정: '+uns.map(function(r){return AREA[r].name;}).join(", ")+' (무관하다는 뜻은 아님)':'';
  $("railFrom").hidden=!fromHere;
  $("railFrom").textContent=fromHere?'출발: 설명의 ‘'+state.origin.label+'’':'';''')
rep('''    '<p class="relm">함께 언급된 영역: '+p.related.map(function(r){return AREA[r].name;}).join(", ")+'</p>'+''',
'''    '<p class="relm">함께 언급된 영역: '+relo.map(function(r){return AREA[r].name;}).join(", ")+(uns.length?' · 미지정: '+uns.map(function(r){return AREA[r].name;}).join(", "):'')+(fromHere?' · 출발: 설명의 ‘'+state.origin.label+'’':'')+'</p>'+''')

# ---- new behaviour block (hints, B references, refbar), before the final layout() call
rep('''mq.addEventListener("change",layout);
layout();''', r'''/* ---------- same-target responses (both candidates) ---------- */
function hintRefs(key,on){
  document.querySelectorAll('.ref[data-ref="'+key+'"]').forEach(function(r){r.classList.toggle("hint",on);});
}
function hintArea(aid,on){
  hintRefs("a:"+aid,on);
  document.querySelectorAll('.chip[data-area="'+aid+'"]').forEach(function(c){c.classList.toggle("hint",on);});
}
function targetOf(key){
  var t=key.split(":");
  return t[0]==="p" ? partsEl.querySelector('.part[data-id="'+t[1]+'"]') : frameEl.querySelector('.area[data-id="'+t[1]+'"]');
}

/* ---------- B: explanation whose names point at the existing map targets ---------- */
function buildExplain(){
  var body=$("explainBody");
  body.innerHTML=EXPLAIN.map(function(e){
    var html=e.t.replace(/\{([pa]):(\w+)\}/g,function(m,k,id){
      var name=k==="p"?PART[id].name:AREA[id].name;
      return '<button type="button" class="ref'+(k==="p"?' pref':'')+'" data-ref="'+k+':'+id+'">'+name+'</button>';
    });
    return '<p'+(e.part?' data-part="'+e.part+'"':' class="unspec"')+'>'+html+'</p>';
  }).join("");
  body.querySelectorAll(".ref").forEach(function(r){
    var on=function(){var t=targetOf(r.dataset.ref); if(t) t.classList.add("is-hinted");};
    var off=function(){var t=targetOf(r.dataset.ref); if(t) t.classList.remove("is-hinted");};
    r.addEventListener("mouseenter",on); r.addEventListener("mouseleave",off);
    r.addEventListener("focus",on); r.addEventListener("blur",off);
    r.addEventListener("click",function(){off(); followRef(r);});
  });
}
function clearPointed(){
  if(state.pointed){var t=targetOf(state.pointed); if(t) t.classList.remove("is-pointed");}
  state.pointed=null;
}
function bringIntoView(el){
  var r=el.getBoundingClientRect();
  if(mobile()){
    var top=$("refbar").offsetHeight+12; /* the bar sticks to the top once the map is reached */
    if(r.top<top || r.bottom>window.innerHeight-80) window.scrollBy(0, r.top-top);
  }else{
    var ms=$("mapScroll"), mr=ms.getBoundingClientRect(), m=16;
    if(r.top<mr.top+m) ms.scrollTop-=(mr.top+m-r.top);
    else if(r.bottom>mr.bottom-m) ms.scrollTop+=Math.min(r.bottom-(mr.bottom-m), r.top-(mr.top+m));
    if(r.left<mr.left+m) ms.scrollLeft-=(mr.left+m-r.left);
    else if(r.right>mr.right-m) ms.scrollLeft+=Math.min(r.right-(mr.right-m), r.left-(mr.left+m));
  }
}
function followRef(btn){
  var key=btn.dataset.ref, t=key.split(":");
  state.origin={key:key, label:btn.textContent, btn:btn, winY:window.scrollY, leadTop:$("lead").scrollTop};
  clearPointed();
  if(t[0]==="p") select(t[1]);
  var target=targetOf(key);
  target.classList.add("is-pointed"); state.pointed=key;
  var txt;
  if(t[0]==="p"){
    txt='설명의 <b>‘'+PART[t[1]].name+'’</b>에서 이 동작을 골랐습니다.';
  }else{
    var acts=PARTS.filter(function(p){return p.related.indexOf(t[1])>=0;}).map(function(p){return p.name;});
    var un=PARTS.filter(function(p){return p.related.indexOf(t[1])<0;}).map(function(p){return p.name;});
    txt='설명의 <b>‘'+AREA[t[1]].name+'’</b> 영역입니다. 함께 언급된 동작: '+acts.join(", ")+(un.length?' · 미지정: '+un.join(", "):'');
  }
  $("refText").innerHTML=txt; $("refbar").hidden=false;
  layout();
  bringIntoView(target);
  (t[0]==="p"?target:target.querySelector(".area-head")).focus({preventScroll:true});
}
$("refBack").addEventListener("click",function(){
  var o=state.origin; clearPointed(); $("refbar").hidden=true; state.origin=null; layout();
  if(!o) return;
  if(mobile()) window.scrollTo(0,o.winY); else $("lead").scrollTop=o.leadTop;
  if(document.body.contains(o.btn)) o.btn.focus({preventScroll:true});
});

/* candidate-specific labels; data, targets and reading/return functions are shared */
document.querySelectorAll('.variant a').forEach(function(a){if(a.dataset.v===V) a.setAttribute("aria-current","page");});
if(V==="a"){
  $("legend").innerHTML='점선 <span class="chip off">미지정</span>은 이 기록에 함께 적히지 않았다는 뜻이며 무관하다는 뜻은 아닙니다.';
  $("mapHint").innerHTML='<span class="wide-only">동작을 고르면 함께 언급된 영역이 선으로 이어집니다.</span><span class="narrow-only">동작을 고르면 함께 언급된 영역에 표시가 붙습니다.</span>';
}else{
  $("legend").remove();
  buildExplain();
  $("mapHint").innerHTML='<span class="wide-only">왼쪽 설명의 밑줄 이름을 누르면 이 지도의 그 대상으로 갑니다.</span><span class="narrow-only">위 설명의 밑줄 이름을 누르면 지도의 그 대상으로 갑니다.</span>';
}

mq.addEventListener("change",layout);
layout();''')
# base mobile rule would show both marks inside related areas; the new on/off rule replaces it
rep('  .has-sel .area.is-related .rel-mark{display:inline}\n','')
open(dst, "w", encoding="utf-8").write(s)
print("ok", len(s.encode()))
