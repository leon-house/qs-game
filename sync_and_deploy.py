"""sync_and_deploy.py — Python 同步 src → dist-release + SFTP 部署"""
import os
import shutil
import subprocess
import sys
import time

ROOT = r'C:\Users\32545\WorkBuddy\2026-07-23-09-44-01'
SRC = os.path.join(ROOT, 'src')
DST_SRC = os.path.join(ROOT, 'dist-release', 'src')
INDEX_HTML = os.path.join(ROOT, 'index.html')
DST_HTML = os.path.join(ROOT, 'dist-release', 'index.html')

# 1. 清空 + 复制
if os.path.exists(DST_SRC):
    shutil.rmtree(DST_SRC)
os.makedirs(DST_SRC, exist_ok=True)
for entry in os.listdir(SRC):
    sp = os.path.join(SRC, entry)
    dp = os.path.join(DST_SRC, entry)
    if os.path.isdir(sp):
        shutil.copytree(sp, dp)
    else:
        shutil.copy(sp, dp)
shutil.copy(INDEX_HTML, DST_HTML)
print(f'[sync] ✓ src → dist-release/src + index.html')

# 2. SFTP 部署（调用 deploy_ssh.py）
print('[sync] 调用 deploy_ssh.py ...')
r = subprocess.run([sys.executable, os.path.join(ROOT, 'deploy_ssh.py')], capture_output=True, text=True)
print(r.stdout)
if r.returncode != 0:
    print(f'[sync] ✗ deploy failed: {r.stderr}')
    sys.exit(1)
