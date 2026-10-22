import ast
import pathlib
import sys

target = pathlib.Path(sys.argv[1])
ast.parse(target.read_bytes(), filename=str(target))
print('AST parsed without importing or running the browser suite:', target)
