"""Bump version + sync src -> dist-release + deploy."""
import os, shutil, paramiko
ROOT = os.path.dirname(os.path.abspath(__file__))
LOCAL_DIR = os.path.join(ROOT, 'dist-release')
REMOTE_DIR = '/home/ubuntu/Leon-game'
SERVER = {'host': '106.54.31.70', 'port': 22, 'username': 'ubuntu', 'password': '8}iQ}3@r123'}
OLD_VERSIONS = [
    'harvest-idle-20260728l',
    'battle-header-20260728k',
    'equip-fix-20260728j',
    'idle-reward-20260728i',
    'manual-collect-20260728h',
    'reward-sync-20260728b',
    'expbar-fix-20260728f',
    'battle-boss-sword-20260728g',
]
NEW = 'remove-topbar-20260728m'

def walk(d):
    out = []
    for root, _, fs in os.walk(d):
        for f in fs:
            out.append(os.path.join(root, f))
    return out

count = 0
for target in ['src', 'dist-release']:
    p = os.path.join(ROOT, target)
    if not os.path.isdir(p): continue
    for f in walk(p):
        if f.endswith('.js') or f.endswith('.html'):
            try: txt = open(f, encoding='utf8').read()
            except: continue
            before = txt
            for old in OLD_VERSIONS: txt = txt.replace(old, NEW)
            if txt != before:
                open(f, 'w', encoding='utf8').write(txt)
                count += 1
for fname in ['index.html']:
    p = os.path.join(ROOT, fname)
    if os.path.exists(p):
        txt = open(p, encoding='utf8').read()
        for old in OLD_VERSIONS: txt = txt.replace(old, NEW)
        open(p, 'w', encoding='utf8').write(txt)
print(f'Bumped {count} files to {NEW}')

# Sync src -> dist-release/src file by file
src_root = os.path.join(ROOT, 'src')
dst_root = os.path.join(ROOT, 'dist-release', 'src')
copied = 0
for f in walk(src_root):
    rel = os.path.relpath(f, src_root)
    dst = os.path.join(dst_root, rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(f, dst)
    copied += 1
print(f'Synced {copied} src files -> dist-release/src')
shutil.copy2(os.path.join(ROOT, 'index.html'), os.path.join(ROOT, 'dist-release', 'index.html'))
print('Synced index.html -> dist-release')

# 删除 dist-release/src/systems/idle.js（src/ 已被删但 dist 残留）
idle_path = os.path.join(ROOT, 'dist-release', 'src', 'systems', 'idle.js')
if os.path.exists(idle_path):
    os.remove(idle_path)
    print('Deleted stale dist-release/src/systems/idle.js')

# Deploy
print('Deploying...')
t = paramiko.Transport((SERVER['host'], SERVER['port']))
t.connect(username=SERVER['username'], password=SERVER['password'])
sftp = paramiko.SFTPClient.from_transport(t)

uploaded = 0
for r, _, fs in os.walk(LOCAL_DIR):
    for f in fs:
        full = os.path.join(r, f)
        rel = os.path.relpath(full, LOCAL_DIR).replace('\\', '/')
        rp = REMOTE_DIR + '/' + rel
        rd = os.path.dirname(rp)
        try: sftp.stat(rd)
        except FileNotFoundError:
            parts = rd.split('/')
            cur = ''
            for p in parts:
                if not p: continue
                cur += '/' + p
                try: sftp.stat(cur)
                except FileNotFoundError:
                    try: sftp.mkdir(cur)
                    except: pass
        try:
            sftp.put(full, rp)
            uploaded += 1
        except Exception as e:
            print(f'  err: {rel}: {e}')

print(f'Uploaded {uploaded} files')

# 删除服务器上的 idle.js
try:
    sftp.remove(REMOTE_DIR + '/src/systems/idle.js')
    print('Removed remote idle.js')
except FileNotFoundError:
    pass
except Exception as e:
    print(f'Could not remove remote idle.js: {e}')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(hostname=SERVER['host'], port=SERVER['port'],
            username=SERVER['username'], password=SERVER['password'])
stdin, stdout, _ = ssh.exec_command('curl -sI http://localhost:8080/ 2>&1 | head -3')
print('Server:')
print(stdout.read().decode('utf-8', errors='replace'))
sftp.close()
t.close()
ssh.close()