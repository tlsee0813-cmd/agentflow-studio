#!/usr/bin/env python3
"""검사 자체가 의도한 결함을 잡는지 확인 (fix1).

reading-study.html의 일부를 일부러 깨뜨린 사본을 만들어 browser_check.py를 돌린다.
각 변형에는 '실패해야 하는 검사 ID'와 그 ID가 실패해야 하는 화면을 미리 정해 둔다.

판정
- DETECTED: 종료 코드 1, 최종 요약 줄이 있음, 예상 ID가 예상 화면마다 FAIL로 기록됨
- MISSED:   종료 코드 0이거나, 예상 ID 중 일부가 FAIL로 기록되지 않음(다른 실패만 있음)
- FATAL:    환경·실행 중단(변형 지점 없음, 시간 초과, 파이썬 예외 흔적, 요약 줄 없음, 종료 코드 0/1 외)
- 원본 기준선이 통과하지 않으면 변형 결과를 해석하지 않고 FATAL로 끝낸다.
ABORT(시나리오 중단)는 따로 표시하며 그것만으로는 DETECTED가 되지 않는다.

사용: python3 mutation_check.py <reading-study.html> <work_dir>
모든 변형이 DETECTED면 종료 코드 0, MISSED가 있으면 1, FATAL이 있으면 2.
"""
import os, re, subprocess, sys
html = os.path.abspath(sys.argv[1]); work = os.path.abspath(sys.argv[2]); os.makedirs(work, exist_ok=True)
here = os.path.dirname(os.path.abspath(__file__))
s = open(html, encoding="utf-8").read()
WIDE, NARROW = ["1440x900", "1280x720"], ["390x664", "390x844"]
ALL = WIDE + NARROW
# 이름: (원문, 바꿀 문자열, {예상 실패 ID: [그 ID가 실패해야 하는 화면]})
MUTS = {
    "m1_no_restore": ("  if(b){ window.scrollBy(0, b.getBoundingClientRect().top - top); b.focus({ preventScroll: true }); }",
                      "  /* mutated: no focus/scroll restore */", {"RT-FOCUS": ALL, "RT-SCROLL": ALL}),
    "m2_same_tab_link": ("a.target = '_blank'; a.rel = 'noopener noreferrer';", "a.rel = 'noopener noreferrer';",
                         {"LINK-NEWTAB": ALL}),
    "m3_switch_no_origin": ("  if(state.open){ renderOrigin(); setExpanded(); arrangeSheet(); }",
                            "  /* mutated: origin not updated on A/B switch */", {"SW-ORIGIN": ALL}),
    "m4_sheet_covers": ("max-height:62vh;border-radius:14px 14px 0 0", "max-height:100vh;height:100vh;border-radius:14px 14px 0 0",
                        {"SHEET-SWITCH-HIT": NARROW, "SHEET-ORIGIN-VIS": NARROW}),
    "m5_pvscroll_stale": ("  pvScroll.scrollTop = 0;\n  setExpanded();", "  setExpanded();", {"PV-TOP-AFTER": NARROW}),
    "m6_hidden_overridden": ("[hidden]{display:none !important}\n", "",
                             {"PANEL-INIT": WIDE, "PANEL-CLOSED-BTN": WIDE, "PANEL-CLOSED-ESC": WIDE, "PANEL-CLOSED-KEY": WIDE}),
}
FAIL_RE = re.compile(r"^FAIL \[([^\]]+)\] (?:([A-Z][A-Z0-9-]+) )?")

def run(path, outdir):
    try:
        r = subprocess.run([sys.executable, os.path.join(here, "browser_check.py"), path, outdir], capture_output=True, text=True, timeout=400)
    except subprocess.TimeoutExpired:
        return None, [], "timeout"
    lines = r.stdout.splitlines()
    fails = [(m.group(1), m.group(2) or "(무ID)") for l in lines for m in [FAIL_RE.match(l)] if m]
    fatal = None
    if r.returncode not in (0, 1): fatal = f"exit {r.returncode}"
    elif "Traceback" in r.stderr: fatal = "python traceback"
    elif not any(l.startswith("browser: pass") for l in lines): fatal = "요약 줄 없음"
    return r, fails, fatal

bad_missed = bad_fatal = 0
r, fails, fatal = run(html, os.path.join(work, "run_baseline"))
if fatal or r.returncode != 0:
    print(f"FATAL baseline: 원본 기준선이 통과하지 않음 ({fatal or 'exit ' + str(r.returncode)}); 변형 결과를 해석하지 않음")
    sys.exit(2)
print(f"PASS baseline: 원본 exit=0, {r.stdout.strip().splitlines()[-1]}")

for name, (a, b, expect) in MUTS.items():
    if s.count(a) != 1:
        print(f"FATAL {name}: 변형 지점을 찾지 못함(원본과 맞지 않음)"); bad_fatal += 1; continue
    p = os.path.join(work, name + ".html"); open(p, "w", encoding="utf-8").write(s.replace(a, b))
    r, fails, fatal = run(p, os.path.join(work, "run_" + name))
    if fatal:
        print(f"FATAL {name}: {fatal}"); bad_fatal += 1; continue
    got = set(fails)
    missing = [f"{cid}@{vp}" for cid, vps in expect.items() for vp in vps if (vp, cid) not in got]
    aborts = sorted({vp for vp, cid in fails if cid == "ABORT"})
    other = sorted({cid for vp, cid in fails if cid not in expect and cid != "ABORT"})
    summary = r.stdout.strip().splitlines()[-1]
    if r.returncode == 1 and not missing:
        print(f"DETECTED {name}: 예상 {', '.join(expect)} 가 예상 화면 모두에서 실패 · {summary}")
    else:
        print(f"MISSED {name}: exit={r.returncode}, 기록 안 된 예상 실패 {missing[:6]} · {summary}"); bad_missed += 1
    if aborts: print(f"     ABORT 동반(시나리오 중단, 판정에 쓰지 않음): {aborts}")
    if other: print(f"     예상 밖 실패 ID(정보): {other}")
total = len(MUTS)
print(f"mutation: detected {total - bad_missed - bad_fatal} missed {bad_missed} fatal {bad_fatal} (총 {total}개 변형)")
sys.exit(2 if bad_fatal else (1 if bad_missed else 0))
