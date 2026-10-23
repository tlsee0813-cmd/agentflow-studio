import gzip,json,pathlib
p=pathlib.Path(__file__).parent
r=json.loads(gzip.decompress((p/'raw.json.gz').read_bytes()))
s=next(x for x in r['scenes'] if x['name']=='candidate-no-note')
h=next(x for x in s['authorMetric']['cards']['P']['hidden'] if x['el']=='hint')
assert not h['inkFullyHidden'], 'required existing count ink fully clipped: '+str(h)
