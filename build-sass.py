"""Compile SCSS → CSS using libsass (without postcss+tailwind pre-processing)."""
import sass, os, re
ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src', 'styles', 'main.scss')
OUT = os.path.join(ROOT, 'dist-release', 'style.css')
INCLUDE_DIR = os.path.join(ROOT, 'src', 'styles')

# 1. Sass compile
css = sass.compile(filename=SRC, include_paths=[INCLUDE_DIR], output_style='expanded')
print(f'Compiled SCSS: {len(css)} chars')

# 2. 简单处理 @tailwind directives（保留 postcss 不处理的 raw directives —— 浏览器忽略）
#    不在这里删除，因为旧 dist-release/style.css 已经有 Tailwind utilities 内联
#    我们做的是「diff patch」：只改动我们关注的 .battle-* / .sweep-* 块
#    实际上更简单：直接 patch 现存的 style.css

# 直接读 source 的 CSS 对应块（已经有的部分）+ 我们 patched 的 SCSS 重新编译
# 这里采用：把 SCSS → CSS 输出，但不合并到 dist-release/style.css 之前
# 写到临时文件，让用户手动 merge？
# 不，更简单：先检查 libsass 输出是否正常
tmp = os.path.join(ROOT, 'style-compiled.css')
open(tmp, 'w', encoding='utf8').write(css)
print(f'Wrote temp: {tmp}')
