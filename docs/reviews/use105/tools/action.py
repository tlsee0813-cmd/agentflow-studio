import sys,json,urllib.request
port=sys.argv[1];body=sys.argv[2].encode()
with urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:'+port,data=body,headers={'Content-Type':'application/json'})) as r:print(r.read().decode())
