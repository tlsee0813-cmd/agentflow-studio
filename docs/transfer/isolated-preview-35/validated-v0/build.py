import subprocess,os,pathlib,json,datetime,hashlib,sys
r=pathlib.Path(__file__).parent;e=os.environ.copy();e['PATH']='/workspace/browser-env/tools/node_modules/.bin:'+e['PATH'];rows=[]
for name,args in [('check',['tsc','--noEmit','-p','continuity/tsconfig.json']),('demo',['node','continuity/scripts/build-static.mjs']),('preview',['node','continuity/scripts/build-static.mjs','--preview'])]:
 start=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(args,cwd=r/'candidate/app',env=e,capture_output=True);(r/(name+'.stdout.log')).write_bytes(p.stdout);(r/(name+'.stderr.log')).write_bytes(p.stderr);rows.append({'name':name,'command':args,'startUTC':start,'endUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actualChildExit':p.returncode});
 if p.returncode:break
(r/'build.process.json').write_text(json.dumps(rows,indent=2));sys.exit(p.returncode)
