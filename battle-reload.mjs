// battle-reload.mjs - 强制多次重载看稳定性
import { spawn } from 'child_process';
import fs from 'fs';

const chromePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const port = 9247;
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

// 多次 reload，看状态
for (let i = 0; i < 3; i++) {
    await send('Page.reload', { ignoreCache: true });
    await new Promise(r => setTimeout(r, 12000));

    const r = await send('Runtime.evaluate', {
        expression: `(() => {
            const c = document.querySelector('#battle-canvas');
            return c ? JSON.stringify({
                w: c.width, h: c.height,
                gameData: typeof window.GameData,
                startContinuousBattle: typeof window.startContinuousBattle,
            }) : 'no canvas';
        })()`,
        returnByValue: true
    });
    console.log(`Reload ${i+1}: ${r.result.value}`);
}

ws.close();
chrome.kill();