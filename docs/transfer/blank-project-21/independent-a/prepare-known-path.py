from pathlib import Path
import json
R=Path(__file__).parent;obs=R.parent/'cycle21-observation';rows=[json.loads(x) for x in (obs/'actions.jsonl').read_text().splitlines()];commands=[x['command'] for x in rows if 69<=x.get('seq',0)<=102];(R/'KNOWN_UI_PATH.json').write_text(json.dumps({'originEvidence':'b0c2c9331578c2ec7a5904db7c90b51f976518ab','boundary':'learned normal UI path, no project import or storage injection; not first-use discovery','commands':commands},ensure_ascii=False,indent=2));print(len(commands),commands[-1])
