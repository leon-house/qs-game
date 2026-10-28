// battle-debug.mjs - debug production with full logs
import { spawn } from 'child_process';
import fs from 'fs';

const chromePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const port = 9244;
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

await send('Runtime.enable');
await send('Network.enable');

// 收集 console + logentry
const events = [];
ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map(a => a.value || a.description || '').join(' ');
        events.push({ type: msg.params.type, text });
    } else if (msg.method === 'Runtime.exceptionThrown') {
        events.push({ type: 'exception', text: msg.params.exceptionDetails.text });
    } else if (msg.method === 'Network.responseReceived') {
        if (msg.params.response.url.includes('main.js') || msg.params.response.url.includes('battle-canvas') || msg.params.response.url.includes('config.js')) {
            events.push({ type: 'net', url: msg.params.response.url, status: msg.params.response.status, mimeType: msg.params.response.mimeType });
        }
    } else if (msg.method === 'Network.loadingFailed') {
        events.push({ type: 'netfail', err: msg.params.error?.errorText });
    }
});

await send('Network.clearBrowserCache');
await send('Network.clearBrowserCookies');
await send('Page.reload', { ignoreCache: true });

await new Promise(r => setTimeout(r, 15000));

console.log('--- EVENTS ---');
for (const e of events) console.log(JSON.stringify(e));

// Canvas 状态
const r_canvas = await send('Runtime.evaluate', {
    expression: `(() => {
        const c = document.querySelector('#battle-canvas');
        if (!c) return 'no canvas';
        return JSON.stringify({
            w: c.width, h: c.height,
            gameData: typeof window.GameData,
            startContinuousBattle: typeof window.startContinuousBattle,
            stageInfoText: document.querySelector('.stage-info')?.textContent?.trim()?.slice(0, 80),
        });
    })()`,
    returnByValue: true
});
console.log('--- CANVAS ---', r_canvas.result.value);

ws.close();
chrome.kill();