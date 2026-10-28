// 通过 DOM 检查页面资源加载
import { spawn } from 'child_process';
import http from 'http';
import WS from 'ws';
import fs from 'fs';

const TARGET = process.argv[2] || 'http://localhost:8090/';
const PORT = 10000;

const userDataDir = process.env.TEMP + '/cdp-perf2-' + Date.now();
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDataDir}`,
    '--disable-extensions', '--window-size=720,1280',
    TARGET
], { stdio: 'ignore' });

await new Promise(r => setTimeout(r, 4000));
for (let i = 0; i < 30; i++) {
    try {
        await new Promise((res, rej) => http.get(`http://127.0.0.1:${PORT}/json`, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>res(d)); }).on('error', rej));
        break;
    } catch { await new Promise(r => setTimeout(r, 500)); }
}

const tabsJson = await new Promise((res, rej) => http.get(`http://127.0.0.1:${PORT}/json`, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>res(d)); }).on('error', rej));
const tabs = JSON.parse(tabsJson);
const pageTab = tabs.find(t => t.type === 'page' && t.url.startsWith('http'));
const ws = new WS(pageTab.webSocketDebuggerUrl);
let id = 1;
const pending = new Map();
ws.on('message', d => { const m = JSON.parse(d.toString()); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } });
await new Promise(r => ws.on('open', r));
const call = (m, p={}) => { const i=id++; return new Promise(r => { pending.set(i, r); ws.send(JSON.stringify({ id:i, method:m, params:p })); }); };
const evalExpr = async (e) => { const r = await call('Runtime.evaluate', { expression: e, returnByValue: true }); return r.exceptionDetails ? {__error: r.exceptionDetails.text} : r.result?.value; };

// 直接 fetch 所有图片来测实际大小
const t0 = Date.now();
for (let i = 0; i < 30; i++) {
    const ready = await evalExpr(`typeof window.openBuildings === 'function'`);
    if (ready === true) break;
    await new Promise(r => setTimeout(r, 500));
}
const tLoaded = Date.now() - t0;

// 列出页面所有 image 元素的 src
const imgs = await evalExpr(`
    (function() {
        const arr = [];
        for (const img of document.querySelectorAll('img')) {
            arr.push({ src: img.src.replace('http://localhost:8090', ''), loaded: img.complete && img.naturalWidth > 0 });
        }
        return { count: arr.length, list: arr };
    })()
`);
console.log(`\n=== 图片 (DOM): ${imgs.count} 张 ===`);
imgs.list.forEach(i => console.log(`  ${i.loaded ? '✓' : '✗'} ${i.src}`));

// 还要查 CSS background-image (bg.webp)
const bg = await evalExpr(`
    (function() {
        const styles = [];
        for (const sheet of document.styleSheets) {
            try {
                for (const rule of sheet.cssRules) {
                    if (rule.cssText && rule.cssText.includes('background-image') && rule.cssText.includes('url')) {
                        styles.push(rule.cssText);
                    }
                }
            } catch(e) {}
        }
        return styles.slice(0, 5);
    })()
`);
console.log(`\n=== CSS background-image ===`);
bg.forEach(s => console.log(`  ${s.substring(0, 120)}`));

// 测量每个图片的实际传输大小（用 fetch）
console.log(`\n=== 实际传输大小（fetch + content-length） ===`);
let totalBytes = 0;
for (const img of imgs.list) {
    if (!img.src.startsWith('/assets')) continue;
    const sz = await new Promise(async (res) => {
        try {
            const r = await fetch('http://localhost:8090' + img.src);
            const buf = await r.arrayBuffer();
            res(buf.byteLength);
        } catch { res(0); }
    });
    totalBytes += sz;
    console.log(`  ${(sz/1024).toFixed(1).padStart(7)}KB  ${img.src}`);
}
console.log(`\n  总计: ${(totalBytes/1024).toFixed(1)}KB (${(totalBytes/1024/1024).toFixed(2)}MB)`);

// 关闭 modal，启动战斗看看是否流畅
await evalExpr(`document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'))`);
await evalExpr(`window.startBattle('测试', 3)`);
await new Promise(r => setTimeout(r, 1500));

const shot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: 720, height: 1280, scale: 1 } });
fs.writeFileSync('C:/Users/32545/WorkBuddy/2026-07-23-09-44-01/.workbuddy/perf-shot.png', Buffer.from(shot.data, 'base64'));
console.log(`截图已保存（验证渲染）`);

console.log(`\n=== 时间统计 ===`);
console.log(`  页面加载到 init 完成: ${tLoaded}ms`);

ws.close();
chrome.kill();