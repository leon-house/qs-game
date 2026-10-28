"""Deploy dist-release/ to remote server using paramiko SFTP."""
import os, paramiko, time
ROOT = os.path.dirname(os.path.abspath(__file__))
LOCAL_DIR = os.path.join(ROOT, 'dist-release')
REMOTE_DIR = '/home/ubuntu/Leon-game'
SERVER = {
    'host': '106.54.31.70',
    'port': 22,
    'username': 'ubuntu',
    'password': '8}iQ}3@r123',
}

def list_files(root):
    files = []
    for r, _, fs in os.walk(root):
        for f in fs:
            full = os.path.join(r, f)
            rel = os.path.relpath(full, root).replace('\\', '/')
            files.append((full, rel))
    return files

def deploy():
    print(f'Connecting to {SERVER["host"]}...')
    t = paramiko.Transport((SERVER['host'], SERVER['port']))
    t.connect(username=SERVER['username'], password=SERVER['password'])
    sftp = paramiko.SFTPClient.from_transport(t)

    files = list_files(LOCAL_DIR)
    print(f'Found {len(files)} files to upload')

    uploaded = 0
    for local_path, rel_path in files:
        remote_path = REMOTE_DIR + '/' + rel_path
        remote_dir = os.path.dirname(remote_path)
        try:
            sftp.stat(remote_dir)
        except FileNotFoundError:
            parts = remote_dir.split('/')
            cur = ''
            for p in parts:
                if not p: continue
                cur += '/' + p
                try:
                    sftp.stat(cur)
                except FileNotFoundError:
                    try:
                        sftp.mkdir(cur)
                    except OSError:
                        pass
        try:
            sftp.put(local_path, remote_path)
            uploaded += 1
        except Exception as e:
            print(f'  err: {rel_path}: {e}')
        if uploaded % 20 == 0 and uploaded > 0:
            print(f'  [{uploaded}/{len(files)}]')

    print(f'Uploaded {uploaded}/{len(files)}')

    print('Verifying server...')
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(hostname=SERVER['host'], port=SERVER['port'],
                username=SERVER['username'], password=SERVER['password'])
    stdin, stdout, stderr = ssh.exec_command('curl -sI http://localhost:8080/ 2>&1 | head -3')
    out = stdout.read().decode('utf-8', errors='replace')
    print('Server status:')
    print(out)
    sftp.close()
    t.close()
    ssh.close()

if __name__ == '__main__':
    deploy()
