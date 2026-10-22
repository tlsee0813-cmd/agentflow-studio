from pathlib import Path
root=Path(__file__).resolve().parents[1]
path=root/'.github/workflows/verify.yml'
original=(root/'evidence/originals/verify.yml').read_bytes()
marker=b"      # Sentinels and a CSP-blocked fetch are explicit probes; the product journey is native."
assert original.count(marker)==1
step=b'''      - name: RECEIVED20 exact result, export snapshot and explicit return on two PCs (native HTTP, labelled fixtures, mock AI)
        env:
          IDEA015_EVIDENCE_DIR: test-results/received20
        shell: bash
        run: |
          set -o pipefail
          python continuity/tests/received20_browser.py 2>&1 | tee test-results/received20-browser.log
'''
assert b'received20_browser.py' not in original
at=original.index(marker);updated=original[:at]+step+original[at:]
path.write_bytes(updated)
assert updated.replace(step,b'',1)==original
print('WORKFLOW: exactly7 added LF lines; all original bytes preserved. No existing job or expectation removed.')
