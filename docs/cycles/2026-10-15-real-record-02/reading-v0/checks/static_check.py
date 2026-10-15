#!/usr/bin/env python3
"""작성자 정적 의미 대조 (author static semantic check) for reading-study.html.

브라우저를 실행하지 않는다. HTML에 내장된 데이터(JSON)와 정적 텍스트만 읽어
A(판단 본문)와 B(범위 대조)가 같은 사실·한계·숫자를 담는지, 금지된 표현/링크가
없는지를 확인한다. 이 검사는 시안 작성자가 만든 자기검사이며 독립 검증이 아니다.

사용: python3 static_check.py <reading-study.html> [result.json]
실패가 하나라도 있으면 종료 코드 1. INFO는 검사 수에 넣지 않는다.
"""
import hashlib, json, re, sys, html as htmlmod

path = sys.argv[1] if len(sys.argv) > 1 else "reading-study.html"
out = sys.argv[2] if len(sys.argv) > 2 else None
raw = open(path, "rb").read()
src = raw.decode("utf-8")
m = re.search(r'<script type="application/json" id="data">(.*?)</script>', src, re.S)
D = json.loads(m.group(1))
FX = {f["id"]: f for f in D["facts"]}

results, infos = [], []
def check(name, ok, detail=""):
    results.append({"name": name, "pass": bool(ok), "detail": detail})
    print(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail and not ok else ""))
def info(msg):
    infos.append(msg); print("INFO " + msg)

# ---- 입력 고정 출처 (INPUT.md @1ec44cc 의 출처 목록 + INPUT 자체) ----
ALLOWED = {
    "https://github.com/tlsee0813-cmd/agentflow-studio/blob/1ec44ccecc10f11e41f60f32ad516497706eed15/docs/cycles/2026-10-15-real-record-02/INPUT.md",
    "https://github.com/tlsee0813-cmd/agentflow-studio/blob/3847a9b267d43dcc16bd1b999af446ad5cc38c91/docs/cycles/2026-10-15-mixed-depth-01/evidence/ui02/acceptance9/REPORT.md",
}
base = "https://github.com/tlsee0813-cmd/agentflow-studio/blob/666437a427b3039fb6321dfec41edd6eb24e164f/docs/cycles/2026-10-15-mixed-depth-01/"
for p in ["INPUT.md", "prototype.html", "canvas-study.html", "UI02_CODE_REVIEW_INITIAL.md",
          "evidence/ui02/author-fixed/REPORT.md", "evidence/ui02/independent/REPORT.md",
          "UI02_RESULT.md", "ENVIRONMENT.md", "UI03_RESEARCH.md"]:
    ALLOWED.add(base + p)

# 1. 구조: 사실·사건·출처·상태 표기
ids = [f["id"] for f in D["facts"]]
check("T01 사실 id 고유", len(ids) == len(set(ids)), str(ids))
check("T02 사건 E01~E10이 모두 데이터에 있음", all(f"E{i:02d}" in D["events"] for i in range(1, 11)))
used_ev = {e for f in D["facts"] for e in f["ev"]}
check("T03 E01~E10이 각각 하나 이상의 사실에 연결됨", all(f"E{i:02d}" in used_ev for i in range(1, 11)),
      str(sorted(set(f"E{i:02d}" for i in range(1, 11)) - used_ev)))
bad = [f["id"] for f in D["facts"] if not f["a"].strip() or any(not f["b"][k].strip() for k in ("subj", "target", "obs", "lim"))]
check("T04 모든 사실이 A 문장과 B 셀 네 칸을 모두 가짐", not bad, str(bad))
bad = [(f["id"], s) for f in D["facts"] for s in f["src"] if s not in D["sources"]]
check("T05 사실의 출처 id가 모두 출처 목록에 있음", not bad, str(bad))
bad = [f["id"] for f in D["facts"] if f["tag"] not in D["tagClass"]]
check("T06 상태 표기가 정의된 표기만 씀", not bad, str(bad))

# 2. A/B 동등성: 같은 사실 단위에서 핵심 한계 문구, 숫자, 대상 버전
def btext(f): return " ".join(f["b"][k] for k in ("subj", "target", "obs", "lim"))
miss = []
for f in D["facts"]:
    for k in f["keys"]:
        if k not in f["a"]: miss.append((f["id"], "A", k))
        if k not in btext(f): miss.append((f["id"], "B", k))
check("T07 사실마다 지정한 핵심 범위·한계 문구가 A와 B 양쪽에 있음", not miss, str(miss))

VER = re.compile(r"H[01](?:\(fix1\))?")
def nums(s):
    s = VER.sub(" ", s)
    return sorted(set(re.findall(r"\d+", s)))
diff = []
for f in D["facts"]:
    a = set(nums(f["a"])); b = set(nums(" ".join(f["b"][k] for k in ("subj", "obs", "lim"))))
    same_sub = [x for x in D["facts"] if x["s"] == f["s"]]
    actx = set(nums(" ".join(x["a"] for x in same_sub[: same_sub.index(f) + 1])))
    a_only = a - b                     # A가 B보다 더 말하면 실패 (B 행은 독립적으로 읽힘)
    b_only = b - actx                  # B의 숫자는 A의 같은 문장 또는 같은 문단 앞 문장에 있어야 함
    if a_only or b_only: diff.append((f["id"], sorted(a_only), sorted(b_only)))
check("T08 사실마다 A와 B의 숫자가 대응함(A 초과 없음, B의 숫자는 A 문장·문단 맥락에 있음)", not diff, str(diff))

# 대상 버전: B의 '대상' 칸에 H0/H1이 있으면, A에서는 그 문장 또는 같은 문단의 앞 문장에 같은 버전이 있어야 함
vmiss = []
for f in D["facts"]:
    want = set(re.findall(r"H[01]", f["b"]["target"]))
    if not want: continue
    same_sub = [x for x in D["facts"] if x["s"] == f["s"]]
    ctx = " ".join(x["a"] for x in same_sub[: same_sub.index(f) + 1])
    for v in want:
        if v not in ctx: vmiss.append((f["id"], v))
check("T09 B의 대상 버전(H0/H1)이 A에서 같은 문장이나 문단 앞부분에 있음", not vmiss, str(vmiss))

# 3. 데이터 엄수
vis_texts = []
NEG = re.compile(r"않|아님|아닙니다|아니다|아니며")
def affirm(t):
    """부정문(…하지 않음/아님)으로 금지하는 문장은 제외하고 단언 문장만 남긴다."""
    return " ".join(x for x in re.split(r"(?<=[.。])\s+", t) if not NEG.search(x))
def walk(o):
    if isinstance(o, dict):
        for v in o.values(): walk(v)
    elif isinstance(o, list):
        for v in o: walk(v)
    elif isinstance(o, str): vis_texts.append(o)
walk(D)
body = re.sub(r"<script.*?</script>|<style.*?</style>", " ", src, flags=re.S)
body_txt = htmlmod.unescape(re.sub(r"<[^>]+>", " ", body))
all_txt = vis_texts + [body_txt]

later = [t for t in all_txt if re.search(r"fix2|fix3", t)]
allowed_later = [t for t in later if ("넣지 않" in t or "반영하지 않" in t)]
check("T10 fix2/fix3 언급은 '이 화면 상태에 넣지 않음' 설명에만 있음", len(later) == len(allowed_later),
      str([t[:80] for t in later if t not in allowed_later]))
sumpat = re.compile(r"\d+\s*\+\s*\d+|%|완료율|총\s*통과|합계|전체\s*통과율")
hits = [t[:80] for t in all_txt if sumpat.search(affirm(t))]
check("T11 통과 수의 합산·완료율·백분율 표현 없음", not hits, str(hits))
hits = [t[:80] for t in all_txt if "상충" in affirm(t)]
check("T12 기록에 없는 '상충'을 만들지 않음", not hits, str(hits))
hits = [t[:80] for t in all_txt if re.search(r"승인된 (개명|변경)|개명되|원래 명칭|이름을 바꾸", affirm(t))]
check("T13 A3를 승인된 개명·원래 명칭으로 쓰지 않음", not hits, str(hits))
urls = set(re.findall(r'https?://[^\s"<>]+', src))
check("T14 HTML의 모든 링크가 INPUT의 고정 출처임", urls <= ALLOWED, str(sorted(urls - ALLOWED)))
nolink = [k for k, s in D["sources"].items() if k.startswith("P")]
check("T15 P01~P03은 원문 링크 없이 '없는 이유'를 가짐",
      all(D["sources"][k]["url"] is None and D["sources"][k].get("why") for k in nolink) and set(nolink) == {"P01", "P02", "P03"})
p01 = D["sources"]["P01"]
check("T16 P01을 전달 발췌로 표시하고 독립 열람이 아님을 밝힘",
      p01["kind"] == "전달 발췌" and "독립 열람하지 않았" in p01["why"])
r1 = D["sources"]["R1"]
check("T17 재실행 결과(R1)를 최초 JSON과 같은 원본이라 하지 않음",
      "최초 JSON을 복구한 것이 아닙니다" in r1["note"] and "재실행" in r1["kind"])
users = [f["id"] for f in D["facts"] if "R1" in f["src"]]
check("T18 R1은 E10 수치 사실에만 연결됨", users == ["f19"], str(users))
f21, f22 = FX["f21"], FX["f22"]
check("T19 합성 A2 정책 미결과 실제 UI 미결을 다른 사실·다른 표기로 둠",
      f21["tag"] == "합성 내용" and f22["tag"] != "합성 내용" and "합성" in f21["b"]["subj"] and "실제 개발 기록" in f22["b"]["subj"])
f18, f19 = FX["f18"], FX["f19"]
check("T20 기존 5사례는 위치 검사에서 '범위 밖'(실패 아님)으로 표시",
      f18["tag"] == "범위 밖" and "범위 아님" in f18["b"]["obs"])
check("T21 미실행 / 기록 미확인 / 실패가 서로 다른 표기로 존재",
      {"미실행", "기록 미확인", "실패"} <= {f["tag"] for f in D["facts"]} and
      len({D["tagClass"]["미실행"], D["tagClass"]["실패"]}) == 2)
appr = [t[:80] for t in all_txt if re.search(r"승인함|승인 완료|확인 완료|수정 완료|읽음 처리", t)]
check("T22 사용자가 승인·수정·확인했다는 자동 표기 문구 없음", not appr, str(appr))
check("T23 외부 스크립트·스타일·폰트 의존 없음",
      not re.search(r'<script[^>]+src=|<link[^>]+stylesheet|@import|url\(', src))

info(f"facts={len(D['facts'])}, events={len(D['events'])}, sources={len(D['sources'])}, urls={len(urls)}")
fails = [r for r in results if not r["pass"]]
print(f"static: pass {len(results) - len(fails)} fail {len(fails)} (INFO {len(infos)} 별도, 검사 수 미포함)")
if out:
    json.dump({"kind": "author static semantic check (not independent, no browser)",
               "html": path, "html_sha256": hashlib.sha256(raw).hexdigest(),
               "checker_sha256": hashlib.sha256(open(__file__, "rb").read()).hexdigest(),
               "results": results, "info": infos,
               "pass": len(results) - len(fails), "fail": len(fails)},
              open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
sys.exit(1 if fails else 0)
