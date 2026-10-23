from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
import sys
s=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=sys.argv[1]));print('http://127.0.0.1:'+str(s.server_port),flush=True);s.serve_forever()
