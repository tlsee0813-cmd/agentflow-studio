from pathlib import Path
import os,json,sys,traceback
R0=Path(__file__).parent
exec(compile((R0/'phase.py').read_text().rsplit('