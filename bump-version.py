"""Bump version: equip-fix-20260728j -> battle-header-20260728k"""
import os, re
ROOT = os.path.dirname(os.path.abspath(__file__))
OLD_VERSIONS = [
    'equip-fix-20260728j',
    'idle-reward-20260728i',
    'manual-collect-20260728h',
    'reward-sync-20260728b',
    'expbar-fix-20260728f',
    'battle-boss-sword-20260728g',
]
NEW = 'battle-header-20260728k'

def walk(dir):
    files = []
    for root, _, fs in os.walk(dir):
        for f in fs:
            files.append(os.path.join(root, f))
    return files

count = 0
for target in ['src', 'dist-release']:
    p = os.path.join(ROOT, target)
    if not os.path.isdir(p):
        continue
    for f in walk(p):
        if not (f.endswith('.js') or f.endswith('.html')):
            continue
        try:
            txt = open(f, encoding='utf8').read()
        except Exception:
            continue
        before = txt
        for old in OLD_VERSIONS:
            txt = txt.replace(old, NEW)
        if txt != before:
            open(f, 'w', encoding='utf8').write(txt)
            count += 1

# root index.html
for fname in ['index.html']:
    p = os.path.join(ROOT, fname)
    if os.path.exists(p):
        txt = open(p, encoding='utf8').read()
        for old in OLD_VERSIONS:
            txt = txt.replace(old, NEW)
        open(p, 'w', encoding='utf8').write(txt)

print(f'Done. Patched {count} files. New version: {NEW}')
