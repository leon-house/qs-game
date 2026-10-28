#!/usr/bin/env python
"""
Python SSH deploy (paramiko) — same as deploy-ssh.mjs but in Python
since the node binary is currently broken in this session.
"""
import os
import sys
import stat
import paramiko
from pathlib import Path

HOST = "106.54.31.70"
PORT = 22
USER = "ubuntu"
PASS = "8}iQ}3@r123"
REMOTE_DIR = "/home/ubuntu/Leon-game"
LOCAL_DIR = r"C:\Users\32545\WorkBuddy\2026-07-23-09-44-01\dist-release"
STATIC_PORT = 8081  # 8080 已被 nginx 占用，改用 8081

def walk_local(local_dir):
    """Return list of (local_path, remote_path_relative)."""
    result = []
    for root, _, files in os.walk(local_dir):
        for f in files:
            full = os.path.join(root, f)
            rel = os.path.relpath(full, local_dir).replace("\\", "/")
            result.append((full, rel))
    return result

def main():
    print(f"[deploy] Connecting to {HOST}...")
    transport = paramiko.Transport((HOST, PORT))
    transport.connect(username=USER, password=PASS)
    sftp = paramiko.SFTPClient.from_transport(transport)
    print(f"[deploy] Connected. Uploading from {LOCAL_DIR} to {REMOTE_DIR}...")

    # mkdir REMOTE_DIR
    try:
        sftp.mkdir(REMOTE_DIR)
    except OSError:
        pass

    files = walk_local(LOCAL_DIR)
    print(f"[deploy] Found {len(files)} files")

    ok = 0
    fail = 0
    for local, rel in files:
        remote = f"{REMOTE_DIR}/{rel}"
        # ensure parent dir
        parent = os.path.dirname(remote)
        try:
            sftp.stat(parent)
        except OSError:
            parts = parent.split("/")
            cur = ""
            for p in parts:
                if not p:
                    continue
                cur += "/" + p
                try:
                    sftp.stat(cur)
                except OSError:
                    sftp.mkdir(cur)
        try:
            sftp.put(local, remote)
            ok += 1
            if ok % 20 == 0:
                print(f"[deploy] {ok}/{len(files)} uploaded...")
        except Exception as e:
            print(f"[deploy] FAIL {rel}: {e}")
            fail += 1

    sftp.close()
    transport.close()
    print(f"[deploy] Done. OK={ok} FAIL={fail}")

    # Restart static server
    print("[deploy] Restarting static server...")
    transport = paramiko.Transport((HOST, PORT))
    transport.connect(username=USER, password=PASS)
    ssh = paramiko.SSHClient()
    ssh._transport = transport

    # Kill existing no-cache server (only python, leave nginx alone)
    ssh.exec_command("pkill -f 'python.*http.server' || true")
    import time
    time.sleep(1)
    # Start new no-cache server
    cmd = f"cd {REMOTE_DIR} && nohup python3 -m http.server {STATIC_PORT} --bind 0.0.0.0 > /tmp/leon-server.log 2>&1 &"
    ssh.exec_command(cmd)
    time.sleep(2)
    # Verify server actually came up
    stdin, stdout, stderr = ssh.exec_command(f"curl -s -o /dev/null -w '%{{http_code}}' http://127.0.0.1:{STATIC_PORT}/")
    rc = stdout.read().decode().strip()
    if rc == '200':
        print(f"[deploy] Server started on port {STATIC_PORT} (verified HTTP 200)")
    else:
        print(f"[deploy] WARNING: server may not be up; curl returned {rc}")
    transport.close()

if __name__ == "__main__":
    main()
