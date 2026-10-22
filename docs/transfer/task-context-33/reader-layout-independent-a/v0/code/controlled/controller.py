from pathlib import Path
import hashlib
r=Path(__file__).parent
f=r/'frozen-controller.py';s=f.read_text()
s=s.replace("A=Path('/workspace/browser-env/task33-flow/candidate/app')","A=Path('/workspace/browser-env/task33-reader-layout/candidate/app')").replace("'source':'673c580d69ab5f9cffcb7f0003bcf331c57e3c93'","'source':'843ca3993615824452bfc80a6c0c4c65d35df376'")
exec(compile(s,str(f),'exec'),{'__name__':'__main__','__file__':str(f)})
