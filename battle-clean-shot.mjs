// battle-clean-shot.mjs - 真正干净的截图：所有 modal 关闭
import { spawn } from 'child_process';
import fs from 'fs';

const chromePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const port = 9250;
const target = 'http://106.54.31.70:8080/?nocache=' + Date.now();

const chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=1', '--window-size=360,800',
    '--disable-application-cache', '--disk-cache-size=1',
    '--remote-debugging-port=' + port, target
], { stdio: ['ignore', 'pipe', 'pipe'] });

await new Promise(r => setTimeout(r, 3500));

const targetsRes = await fetch('http://127.0.0.1:' + port + '/json');
const targets = await targetsRes.json();
const pageTarget = targets.find(t => t.type === 'page' && t.url.includes('106.54.31.70'));
const wsUrl = pageTarget.webSocketDebuggerUrl;
const { WebSocket } = await import('ws');
const ws = new WebSocket(wsUrl);
await new Promise(r => ws.on('open', r));

let id = 0;
const send = (method, params = {}) => new Promise(r => {
    const msgId = ++id;
    const handler = (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.id === msgId) { ws.off('message', handler); r(msg.result); }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id: msgId, method, params }));
});

await send('Network.clearBrowserCache');
await send('Network.clearBrowserCookies');
await send('Page.reload', { ignoreCache: true });

// 等剧情 modal 出现
await new Promise(r => setTimeout(r, 3000));

// 先看哪些 modal 是 active 的
const r_modals = await send('Runtime.evaluate', {
    expression: `(() => {
        const list = [];
        document.querySelectorAll('.modal-overlay').forEach(m => {
            const cs = getComputedStyle(m);
            if (cs.display !== 'none') {
                list.push({ id: m.id, display: cs.display, position: cs.position, top: cs.top, zIndex: cs.zIndex });
            }
        });
        return JSON.stringify(list);
    })()`,
    returnByValue: true
});
console.log('ACTIVE MODALS:', r_modals.result.value);

// 强制关闭所有 modal
await send('Runtime.evaluate', {
    expression: `(() => {
        document.querySelectorAll('.modal-overlay').forEach(m => {
            m.classList.remove('active');
            m.style.display = 'none';
        });
        return 'all closed';
    })()`,
    returnByValue: true
});

await new Promise(r => setTimeout(r, 18000));

// dump canvas
const r = await send('Runtime.evaluate', {
    expression: `(() => {
        const c = document.querySelector('#battle-canvas');
        return c ? c.toDataURL('image/png') : '';
    })()`,
    returnByValue: true
});
const dataUrl = r.result.value;
console.log('canvas dataUrl length:', dataUrl.length);
if (dataUrl && dataUrl.startsWith('data:image/png;base64,')) {
    const base64 = dataUrl.slice('data:image/png;base64,'.length);
    fs.writeFileSync('battle-clean-canvas.png', Buffer.from(base64, 'base64'));
    console.log('SAVED battle-clean-canvas.png', fs.statSync('battle-clean-canvas.png').size);
}

// 全页截图
const fullShot = await send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: 0, y: 0, width: 360, height: 800, scale: 1 }
});
fs.writeFileSync('battle-clean-page.png', Buffer.from(fullShot.data, 'base64'));
console.log('SAVED battle-clean-page.png', fs.statSync('battle-clean-page.png').size);

ws.close();
chrome.kill();