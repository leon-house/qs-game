// 编译 src/styles/main.scss → dist-release/style.css
// 用 PostCSS 处理 Tailwind directives + Autoprefixer
import * as sass from 'sass';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, 'src', 'styles', 'main.scss');
const OUT = path.join(__dirname, 'dist-release', 'style.css');

console.log('🔨 编译 Sass → CSS（PostCSS + Tailwind + Autoprefixer）...');

// 1. Sass 编译 → CSS
const sassResult = sass.compile(SRC, {
    style: 'expanded',
    loadPaths: [path.join(__dirname, 'src', 'styles')],
});
let css = sassResult.css;

// 2. PostCSS 处理（Tailwind directives + Autoprefixer）
const postcssResult = await postcss([tailwindcss, autoprefixer]).process(css, {
    from: SRC,
    to: OUT,
});
css = postcssResult.css;

// 3. 写入 dist-release
fs.writeFileSync(OUT, css);
const sizeKB = (css.length / 1024).toFixed(1);
console.log(`✓ 编译完成: ${OUT} (${sizeKB} KB)`);
console.log(`  - 源: ${SRC}`);
