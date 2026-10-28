// 测量页面加载时间 + 资源大小
import { spawn } from 'child_process';
import http from 'http';
import WS from 'ws';

const TARGET = process.argv[2] || 'http://localhost:8090/';
const PORT = 9999;

const userDataDir = process.env.TEMP + '/cdp-perf-' + Date.now();
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

// 启用 Performance API
await call('Performance.enable');

// 测量：cold cache 加载
const t0 = Date.now();
await call('Page.enable');
await call('Page.navigate', { url: TARGET });

// 等到 init 完成
for (let i = 0; i < 30; i++) {
    const ready = await evalExpr(`typeof window.openBuildings === 'function'`);
    if (ready === true) break;
    await new Promise(r => setTimeout(r, 500));
}
const tLoaded = Date.now() - t0;

// 性能数据
const perf = await call('Performance.getMetrics', {});
const metrics = {};
for (const m of perf.metrics) {
    if (['Timestamp','Documents','Frames','JSEventListeners','Nodes','LayoutCount','RecalcStyleCount','LayoutDuration','RecalcStyleDuration','ScriptDuration','TaskDuration','JSHeapUsedSize'].includes(m.name)) {
        metrics[m.name] = m.value;
    }
}

// 资源加载统计
const resourcesResp = await call('Performance.getEntriesByType', { entryType: 'resource' });
const resources = resourcesResp?.result || [];
const sorted = resources.slice().sort((a, b) => b.transferSize - a.transferSize);
const top10 = sorted.slice(0, 10).map(r => ({
    name: r.name.replace(TARGET, ''),
    size: Math.round((r.transferSize || 0) / 1024) + 'KB',
    duration: Math.round(r.duration) + 'ms',
}));
const totalTransfer = resources.reduce((s, r) => s + (r.transferSize || 0), 0);
const byType = {};
for (const r of resources) {
    const ext = (r.name.split('?')[0] || '').split('.').pop().toLowerCase();
    byType[ext] = (byType[ext] || 0) + (r.transferSize || 0);
}

console.log(`\n=== 加载时间 ===`);
console.log(`  init 完成: ${tLoaded}ms`);
console.log(`  资源数量: ${resources.length}`);
console.log(`  总传输: ${Math.round(totalTransfer/1024)}KB (${(totalTransfer/1024/1024).toFixed(2)}MB)`);
console.log(`\n=== 资源类型分布 ===`);
for (const [t, s] of Object.entries(byType).sort((a,b) => b[1]-a[1])) {
    console.log(`  ${t.padEnd(8)} ${Math.round(s/1024)}KB (${(s/totalTransfer*100).toFixed(1)}%)`);
}
console.log(`\n=== Top 10 资源 ===`);
top10.forEach(r => console.log(`  ${r.size.padStart(8)}  ${r.duration.padStart(6)}ms  ${r.name}`));
console.log(`\n=== 性能指标 ===`);
for (const [k, v] of Object.entries(metrics)) {
    if (typeof v === 'number') console.log(`  ${k.padEnd(20)} ${v > 1000 ? (v/1000).toFixed(1) + 'K' : v}`);
}

ws.close();
chrome.kill();