import ast,json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parent.parent/'product19-author';tests=root/'app/continuity/tests';count=0;expressions=[]
for path in tests.glob('*.py'):
    tree=ast.parse(path.read_text(encoding='utf-8'),filename=str(path));count+=1
    if path.name=='workspace19_browser.py':
        for node in tree.body:
            if isinstance(node,ast.Assign) and isinstance(node.value,ast.Constant) and isinstance(node.value.value,str) and any(isinstance(t,ast.Name) and t.id in ['GEOM','HIT','PURPOSE_END'] for t in node.targets):expressions.append(node.value.value)
        for node in ast.walk(tree):
            if isinstance(node,ast.Call) and isinstance(node.func,ast.Attribute) and node.func.attr in ['evaluate','evaluate_all'] and node.args and isinstance(node.args[0],ast.Constant) and isinstance(node.args[0].value,str):expressions.append(node.args[0].value)
code='for(const s of '+json.dumps(expressions)+'){new Function("return ("+s+")");} console.log("PASS: "+'+str(len(expressions))+'+" embedded JS expressions parsed without execution");'
subprocess.run(['node','-e',code],check=True,cwd=root)
workflow=(root/'.github/workflows/verify.yml').read_text(encoding='utf-8');assert workflow.count('python continuity/tests/workspace19_browser.py')==1
print(json.dumps({'pythonAST':count,'newEmbeddedJS':len(expressions),'CIWorkspace19Calls':1,'testModuleImport':False,'browser':'NOT RUN','server':'NOT STARTED'}))
