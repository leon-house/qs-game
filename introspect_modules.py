"""introspect_modules.py — 扫 src/**/*.js 的 import/export 匹配
退出码 0 = 全部 OK，1 = 有 missing exports
"""
import os
import re
import sys

ROOT = 'src'
imports = {}
exports = {}

def walk(d):
    for entry in os.listdir(d):
        p = os.path.join(d, entry)
        if os.path.isdir(p):
            walk(p)
        elif p.endswith('.js'):
            with open(p, 'r', encoding='utf-8') as f:
                src = f.read()
            base = os.path.relpath(p, ROOT).replace('\\', '/')
            exports[base] = set()
            for m in re.finditer(r'export\s+(?:async\s+)?(?:const|let|var|function|class)\s+(\w+)', src):
                exports[base].add(m.group(1))
            for m in re.finditer(r'export\s*\{([^}]+)\}', src):
                for n in m.group(1).split(','):
                    n = n.strip()
                    if ' as ' in n:
                        n = n.split(' as ')[0].strip()
                    if n:
                        exports[base].add(n)
            imports[base] = []
            for m in re.finditer(
                r'import\s+(?:\*\s+as\s+(\w+)|\{([^}]+)\}\s+from)\s+["\']([^"\']+)["\']', src):
                star = m.group(1)
                names_str = m.group(2) or ''
                from_path = m.group(3)
                from_path = re.sub(r'\?v=\S+', '', from_path)
                if not from_path.startswith('.'):
                    continue
                if star:
                    imports[base].append((from_path, star, '*'))
                else:
                    for n in names_str.split(','):
                        n = n.strip()
                        if not n:
                            continue
                        if ' as ' in n:
                            orig = n.split(' as ')[0].strip()
                        else:
                            orig = n
                        imports[base].append((from_path, orig, orig))

walk(ROOT)

def resolve(f, target):
    if target.startswith('./'):
        target = target[2:]
    base_dir = os.path.dirname(f)
    full = os.path.normpath(os.path.join(base_dir, target))
    return full.replace('\\', '/')

missing = []
for f, lst in imports.items():
    for from_path, orig, _ in lst:
        full = resolve(f, from_path)
        if orig == '*':
            continue
        if full not in exports or orig not in exports[full]:
            missing.append((f, from_path, orig, full in exports))

print('Missing count:', len(missing))
for f, fp, o, fp_exists in missing:
    print(f'  MISSING: {o!r} in {f} from {fp} (file exists: {fp_exists})')

sys.exit(0 if not missing else 1)
