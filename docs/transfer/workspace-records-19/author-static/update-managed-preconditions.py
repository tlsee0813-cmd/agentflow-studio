import re,json
from pathlib import Path
root=Path(__file__).resolve().parent.parent/'product19-author';tests=root/'app/continuity/tests';changes=[]
for path in tests.glob('*browser*.py'):
    if path.name=='workspace19_browser.py':continue
    old=path.read_text(encoding='utf-8');lines=old.splitlines(keepends=True);new=[];count=0
    for line in lines:
        if "locator('#backup').click()" in line or "locator('#new-project-top').click()" in line:
            target=re.search(r"(self\.page|tab)\.locator\('(#[^']+)'\)\.click\(\)",line)
            assert target,(path,line)
            prefix='' if path.name=='browser.py' else 'base.'
            new.append(' '*(len(line)-len(line.lstrip()))+f"{prefix}reveal_management({target[1]},'{target[2]}')\n");count+=1
        new.append(line)
    text=''.join(new)
    if path.name in ['connect039_browser.py','flow049_browser.py','flow090_browser.py','select035_browser.py']:
        needle='    def download(self,button,name):\n';assert needle in text
        text=text.replace(needle,needle+"        if button=='#backup':base.reveal_management(self.page,button)\n",1);count+=1
    if text!=old:path.write_text(text,encoding='utf-8',newline='\n');changes.append({'file':path.name,'nativeMenuPreconditions':count})
# Keep new workflow lines in the repository's LF representation.
workflow=root/'.github/workflows/verify.yml';workflow.write_text(workflow.read_text(encoding='utf-8'),encoding='utf-8',newline='\n')
(Path(__file__).resolve().parent/'managed-preconditions.json').write_text(json.dumps(changes,indent=2)+'\n',encoding='utf-8');print(json.dumps(changes,indent=2))
