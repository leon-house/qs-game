"""Upload dist-release to server (no deletion)."""
import os, paramiko
ROOT = os.path.dirname(os.path.abspath(__file__))
LOCAL_DIR = os.path.join(ROOT, 'dist-release')
REMOTE_DIR = '/home/ubuntu/Leon-game'
SERVER = {'host': '106.54.31.70', 'port': 22, 'username': 'ubuntu', 'password': '8}iQ}3@r123'}

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