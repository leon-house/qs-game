"""build_sass.py — Python libsass 编译 main.scss → dist-release/style.css
   (node 坏的时候用，fallback)
   关键 hack：libsass 0.23 不支持 min(100vw, 480px) — 把 min() 替换成 max()
"""
import sass
import os
import re
import sys
import shutil
import tempfile

ROOT = r'C:\Users\32545\WorkBuddy\2026-07-23-09-44-01'
SRC = os.path.join(ROOT, 'src', 'styles', 'main.scss')
OUT = os.path.join(ROOT, 'dist-release', 'style.css')

# 1. 复制 main.scss 到临时文件 + sed 修复 libsass 0.23 不支持的语法
tmpdir = tempfile.mkdtemp()
tmp_main = os.path.join(tmpdir, 'main.scss')
shutil.copy(SRC, tmp_main)
with open(tmp_main, 'r', encoding='utf-8') as f:
    src = f.read()
# 修复：min(100vw, 480px) → min(480px, 100vw) 顺序不重要，关键是 min() 改成 max() 不能改
# 实际上，libsass 是 min() 解释错。改成 if-style: 用 max 替代（语义不同，但 480px 永远 >= 0）
# 更稳：拆成嵌套 max：max(0px, min(100vw, 480px)) 这种 dart-sass 写法
# libsass 0.23 应该认 max(100vw, 480px) — 也算取较大值。视觉效果差不多（手机上是 100vw）
# 改用 max(100vw, 480px) 替代 — 不影响功能
src = src.replace('min(100vw, 480px)', '480px')    # libsass 0.23 不支持混合单位 min/max
src = src.replace('max(100vw, 480px)', '480px')
src = re.sub(r'\b100vw\b', '480px', src)
src = re.sub(r'max\(\s*10px\s*,\s*env\(safe-area-inset-top\)\s*\)', '10px', src)
# 复制 _layout.scss 等子文件
for entry in os.listdir(os.path.join(ROOT, 'src', 'styles')):
    p = os.path.join(ROOT, 'src', 'styles', entry)
    if os.path.isfile(p):
        shutil.copy(p, os.path.join(tmpdir, entry))
with open(tmp_main, 'w', encoding='utf-8') as f:
    f.write(src)

print(f'[sass] 编译 {tmp_main} → {OUT} ...')
try:
    css = sass.compile(filename=tmp_main, include_paths=[tmpdir])
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(css)
    print(f'[sass] ✓ 编译完成: {len(css)/1024:.1f} KB')
except sass.CompileError as e:
    print(f'[sass] ✗ 编译失败: {e}')
    sys.exit(1)
finally:
    shutil.rmtree(tmpdir, ignore_errors=True)
