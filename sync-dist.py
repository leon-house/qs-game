"""sync src -> dist-release/src (and index.html and style.css) without using node"""
import shutil, os
ROOT = os.path.dirname(os.path.abspath(__file__))

def sync_dir(src_subdir, dst_subdir):
    src = os.path.join(ROOT, src_subdir)
    dst = os.path.join(ROOT, dst_subdir)
    os.makedirs(dst, exist_ok=True)
    if not os.path.isdir(src):
        return
    for root, dirs, files in os.walk(src):
        rel = os.path.relpath(root, src)
        target = os.path.join(dst, rel)
        os.makedirs(target, exist_ok=True)
        for f in files:
            sp = os.path.join(root, f)
            dp = os.path.join(target, f)
            shutil.copy2(sp, dp)
    print(f'synced {src_subdir} -> {dst_subdir}')

# Sync all
sync_dir('src', 'dist-release/src')

# Copy index.html
shutil.copy2(os.path.join(ROOT, 'index.html'), os.path.join(ROOT, 'dist-release', 'index.html'))
print('synced index.html -> dist-release')

# style.css 同
src_css = os.path.join(ROOT, 'dist-release', 'style.css')
dst_css = os.path.join(ROOT, 'style.css')
if os.path.exists(src_css):
    shutil.copy2(src_css, dst_css)
    print('synced style.css (dist-release -> root)')
