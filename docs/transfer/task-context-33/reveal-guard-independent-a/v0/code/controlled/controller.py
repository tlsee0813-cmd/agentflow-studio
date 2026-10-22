from pathlib import Path
import hashlib
r=Path(__file__).parent
f=r/'frozen-controller.py';s=f.read_text()
s=s.replace("A=Path('/workspace/browser-env/task33-flow/candidate/app')","A=Path('/workspace/browser-env/task33-reveal-guard/candidate/app')").replace("'source':'673c580d69ab5f9cffcb7f0003bcf331c57e3c93'","'source':'0e11efb932f0826f40cd5d36983f33044a895157'")
exec(compile(s,str(f),'exec'),{'__name__':'__main__','__file__':str(f)})
