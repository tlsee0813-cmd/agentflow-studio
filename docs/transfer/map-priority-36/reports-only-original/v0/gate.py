from pathlib import Path
import json
r=Path(__file__).parent;d=json.loads((r/'evidence/raw.json').read_text())
assert d['cardsExpanded']['L']['recordButtonCount']>0 and d['cardsCollapsed']['P']['recordButtonCount']>0, 'Observed defect: reports exist in exact owned panels but leaf and collapsed-parent generic record entry are absent'
