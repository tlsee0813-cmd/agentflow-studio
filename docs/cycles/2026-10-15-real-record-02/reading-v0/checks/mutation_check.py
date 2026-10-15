#!/usr/bin/env python3
"""검사 자체가 실패를 잡는지 확인: reading-study.html의 일부를 일부러 깨뜨린 사본 5개를 만들어
browser_check.py를 돌리고, 각 사본에서 종료 코드 1(실패)이 나오는지 본다.
원본 HTML은 바꾸지 않는다. 사용: python3 mutation_check.py <reading-study.html> <work_dir>
모든 사본이 실패로 끝나면 종료 코드 0, 하나라도 통과해 버리면 1.
"""
import os, subprocess, sys
html = os.path.abspath(sys.argv[1]); work = os.path.abspath(sys.argv[2]); os.makedirs(work, exist_ok=True)
here = os.path.dirname(os.path.abspath(__file__))
s = open(html, encoding="utf-8").read()
MUTS = {
    "m1_no_restore": ("  if(b){ window.scrollBy(0, b.getBoundingClientRect().top - top); b.focus({ preventScroll: true }); }", "  /* mutated: no focus/scroll restore */"),
    "m2_same_tab_link": ("a.target = '_blank'; a.rel = 'noopener noreferrer';", "a.rel = 'noopener noreferrer';"),
    "m3_switch_no_origin": ("  if(state.open){ renderOrigin(); setExpanded(); arrangeSheet(); }", "  /* mutated: origin not updated on A/B switch */"),
    "m4_sheet_covers": ("max-height:62vh;border-radius:14px 14px 0 0", "max-height:100vh;height:100vh;border-radius:14px 14px 0 0"),
    "m5_pvscroll_stale": ("  pvScroll.scrollTop = 0;\n  setExpanded();", "  setExpanded();"),
}
bad = 0
for name, (a, b) in MUTS.items():
    if s.count(a) != 1:
        print(f"FAIL {name}: 변형 지점을 찾지 못함"); bad += 1; continue
    p = os.path.join(work, name + ".html"); open(p, "w", encoding="utf-8").write(s.replace(a, b))
    r = subprocess.run([sys.executable, os.path.join(here, "browser_check.py"), p, os.path.join(work, "run_" + name)], capture_output=True, text=True, timeout=300)
    fails = [l for l in r.stdout.splitlines() if l.startswith("FAIL")]
    last = (r.stdout.strip().splitlines() or ["(no output)"])[-1]
    ok = r.returncode != 0 and fails
    print(("PASS " if ok else "FAIL ") + f"{name}: exit={r.returncode}, {last}")
    for l in fails[:3]: print("     " + l)
    bad += 0 if ok else 1
print(f"mutation: pass {len(MUTS) - bad} fail {bad} (각 PASS = 깨뜨린 사본에서 browser_check가 실제로 실패함)")
sys.exit(1 if bad else 0)
