# Reassemble immutable pinned sources into a NEW directory only. No install/configuration.
from pathlib import Path
import subprocess,hashlib,json,argparse
ap=argparse.ArgumentParser();ap.add_argument('--repo',default='/workspace/agentflow-studio');ap.add_argument('--dest',required=True);a=ap.parse_args();dest=Path(a.dest);dest.mkdir(parents=True,exist_ok=False)
base='6643323316daefbe10625484bb1727a2c6a54716';overlay='c4354dccc6f693bf33d5157e7e8da566d152d9a1';basePath='docs/transfer/shared-map-11/author-v0/';overlayPath='docs/transfer/shared-map-11/author-fix1/'
def show(c,p):return subprocess.check_output(['git','-C',a.repo,'show',c+':'+p])
manifest=show(overlay,overlayPath+'MANIFEST.tsv');assert hashlib.sha256(manifest).hexdigest()=='f3d9a0deb20a0d7b715300224c1f0bfa6ab8aad04e3fd4bcf0c4e4bad7789644'
expected=json.loads((Path(__file__).resolve().parent/'fix1-runtime-manifest.json').read_text())
for f,row in expected.items():
 b=show(overlay,overlayPath+'app/engine.js') if f=='engine.js' else show(base,basePath+'app/'+f);assert len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'];p=dest/f;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
print('Pinned base + engine-only overlay verified and assembled:',dest)
