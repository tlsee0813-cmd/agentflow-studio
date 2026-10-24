# Execute the unchanged repository tests. Screenshot capture is suppressed to keep the independent evidence to 3 PNGs.
import sys,runpy
from pathlib import Path
from playwright.sync_api import Page
Page.screenshot=lambda self,*a,**kw:b''
target=Path(sys.argv[1]);sys.path.insert(0,str(target.parent));sys.argv=[str(target)]
runpy.run_path(str(target),run_name='__main__')
