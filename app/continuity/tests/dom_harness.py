"""Explicit DOM-only browser harness, adapted from the existing app/tests/browser.py.
It does NOT validate browser navigation, CSP, native localStorage, cross-tab storage,
clipboard permissions or browser-to-server fetch. Python -> local HTTP is real.
No browser policies are altered. Only use BROWSER_TRANSPORT=dom-bridge explicitly.
"""
import asyncio,base64,json,re,urllib.request,urllib.error
from pathlib import Path

def mount(case,page,raw=None):
    async def api(path,init):
        if path not in ['/api/config','/api/continuity']:raise ValueError('Unexpected bridge path')
        case.bridge_calls.append(path)
        def sync():
            body=init.get('body');req=urllib.request.Request(case.url+path,data=body.encode() if body else None,method=init.get('method','GET'),headers={**init.get('headers',{}),'Origin':case.url})
            try:
                with urllib.request.urlopen(req,timeout=8) as response:return {'status':response.status,'body':response.read().decode()}
            except urllib.error.HTTPError as e:return {'status':e.code,'body':e.read().decode()}
        return await asyncio.to_thread(sync)
    page.expose_function('__test_local_api',api)
    page.evaluate("""(raw)=>{
      class TestStorage { constructor(){this.map=new Map()} getItem(k){return this.map.get(k)??null} setItem(k,v){this.map.set(k,String(v))} }
      const storage=new TestStorage();if(raw!==null)storage.setItem('agentflow.idea015.project.v1',raw);
      Object.defineProperty(window,'localStorage',{value:storage,configurable:true});
      Object.defineProperty(window,'Storage',{value:TestStorage,configurable:true});
      crypto.randomUUID=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
      window.__testFault=null;
      window.fetch=async(path,init={})=>{
        if(String(path)==='/api/continuity'&&window.__testFault==='invalid')return new Response('{"mode":"mock","advice":{"status":"confirmed"}}',{status:200});
        const data=await window.__test_local_api(String(path),{method:init.method||'GET',headers:init.headers||{},body:init.body||null});
        const response=new Response(data.body,{status:data.status,headers:{'Content-Type':'application/json'}});
        if(String(path)==='/api/continuity'&&window.__testFault==='delay')return new Promise(resolve=>window.__releaseTest=()=>{window.__releaseTest=null;resolve(response)});
        return response;
      };
    }""",raw)
    root=Path(__file__).resolve().parents[1]/'dist/public'
    html=(root/'index.html').read_text(encoding='utf-8')
    html=re.sub(r'<script.*?</script>','',html,flags=re.S);html=re.sub(r'<link rel="stylesheet"[^>]*>','',html)
    page.set_content(html);page.add_style_tag(content=(root/'styles.css').read_text(encoding='utf-8'))
    cache={}
    def module(path):
        path=path.resolve()
        if path in cache:return cache[path]
        content=path.read_text(encoding='utf-8')
        content=re.sub(r"(from\s+['\"])(\.[^'\"]+)(['\"])",lambda m:m[1]+module(path.parent/m[2])+m[3],content)
        uri='data:text/javascript;base64,'+base64.b64encode(content.encode()).decode();cache[path]=uri;return uri
    page.add_script_tag(type='module',content='import '+json.dumps(module(root/'client/app.js'))+';')
    # Visible evidence label, only in this test harness; not shipped in the product page.
    page.evaluate("""()=>{const b=document.createElement('div');b.textContent='검사 화면 · DOM bridge / 저장소 대역 · 직접 브라우저 HTTP 미검증';b.style.cssText='font:11px system-ui;padding:7px 16px;background:#fff5df;color:#835b18';document.body.prepend(b)}""")
