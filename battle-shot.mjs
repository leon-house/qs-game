// battle-shot.mjs - 干净截图：reload 后等战斗跑起来
import { spawn } from 'child_process';
import fs from 'fs';

const chromePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const port = 9248;
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

// 第一次 reload 让模块加载完成
await send('Page.reload', { ignoreCache: true });
await new Promise(r => setTimeout(r, 12000));

// 关闭剧情 modal（如果有）
await send('Runtime.evaluate', {
    expression: `(() => {
        const modal = document.getElementById('story-modal');
        if (modal) modal.classList.remove('active');
        return 'closed';
    })()`,
    returnByValue: true
});

// 等战斗真正开始画图（多次reload等15s）
await new Promise(r => setTimeout(r, 15000));

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
    fs.writeFileSync('battle-shot-canvas.png', Buffer.from(base64, 'base64'));
    console.log('SAVED battle-shot-canvas.png', fs.statSync('battle-shot-canvas.png').size);
}

// 全页截图
const fullShot = await send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: 0, y: 0, width: 360, height: 800, scale: 1 }
});
fs.writeFileSync('battle-shot-page.png', Buffer.from(fullShot.data, 'base64'));
console.log('SAVED battle-shot-page.png', fs.statSync('battle-shot-page.png').size);

ws.close();
chrome.kill();