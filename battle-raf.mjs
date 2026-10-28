// battle-raf.mjs - 检查 RAF 是否在跑
import { spawn } from 'child_process';
import fs from 'fs';

const chromePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const port = 9246;
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

await new Promise(r => setTimeout(r, 12000));

// 用 RAF 计数器验证 RAF 是否在跑
const r = await send('Runtime.evaluate', {
    expression: `(() => {
        return new Promise((resolve) => {
            let count = 0;
            let lastT = performance.now();
            const startT = lastT;
            const tick = () => {
                count++;
                if (count >= 60) {
                    const elapsed = performance.now() - startT;
                    resolve(JSON.stringify({
                        frames: count,
                        elapsedMs: elapsed.toFixed(1),
                        avgFps: (count * 1000 / elapsed).toFixed(2),
                    }));
                } else {
                    requestAnimationFrame(tick);
                }
            };
            requestAnimationFrame(tick);
        });
    })()`,
    returnByValue: true,
    awaitPromise: true
});
console.log('RAF CHECK (60 frames):', r.result.value);

// 同时检查 canvas 状态
const r2 = await send('Runtime.evaluate', {
    expression: `(() => {
        const c = document.querySelector('#battle-canvas');
        if (!c) return 'no canvas';
        const ctx = c.getContext('2d');
        // 检查画布是否有非透明像素
        let opaque = 0;
        try {
            const data = ctx.getImageData(0, 0, c.width, c.height).data;
            for (let i = 3; i < data.length; i += 4) if (data[i] > 0) opaque++;
        } catch (e) {}
        return JSON.stringify({
            w: c.width, h: c.height,
            opaque,
        });
    })()`,
    returnByValue: true
});
console.log('CANVAS:', r2.result.value);

ws.close();
chrome.kill();