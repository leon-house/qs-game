import os, re
src = 'src'
files = []
for root, _, fs in os.walk(src):
    for f in fs:
        if f.endswith('.js'):
            files.append(os.path.join(root, f).replace('\\', '/'))

exports = {}
imports = {}
for f in files:
    txt = open(f, encoding='utf8').read()
    txt = re.sub(r'\?v=[\w-]+', '', txt)
    base = f
    for m in re.finditer(r'export\s+(?:const|let|var|function|class|async\s+function)\s+(\w+)', txt):
        exports.setdefault(base, set()).add(m.group(1))
    for m in re.finditer(r'export\s*\{\s*([^}]+)\s*\}', txt):
        for x in m.group(1).split(','):
            x = x.strip()
            if x:
                exports.setdefault(base, set()).add(x.split(' as ')[0])
    for m in re.finditer(r'import\s+(?:\*\s+as\s+(\w+)|\{([^}]+)\})\s+from\s+["\']([^"\']+)["\']', txt):
        from_path = m.group(3)
        if not from_path.startswith('.'): continue
        if m.group(1):
            names = [{'orig': '*', 'alias': m.group(1)}]
        else:
            names = []
            for s in m.group(2).split(','):
                s = s.strip()
                if not s: continue
                parts = s.split(' as ')
                names.append({'orig': parts[0].strip(), 'alias': parts[1] if len(parts) > 1 else parts[0].strip()})
        full = os.path.normpath(os.path.join(os.path.dirname(f), from_path)).replace('\\', '/')
        imports.setdefault(full, []).append((base, names))

missing = 0
for frm, refs in imports.items():
    exps = exports.get(frm, set())
    for imp, names in refs:
        for n in names:
            if n['orig'] == '*': continue
            if n['orig'] not in exps:
                print(f"MISSING: '{n['orig']}' in {imp} from {frm}")
                missing += 1
print('---')
print(f'Total files: {len(files)}')
print(f'Missing exports: {missing}')