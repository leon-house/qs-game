// CDP debug
import { spawn } from 'child_process';
import http from 'http';
import WebSocket from 'ws';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CDP_PORT = 9343;
const TARGET_URL = 'http://106.54.31.70:8080/';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function fetchJson(url) {
    return new Promise((r1, r2) => {
        http.get(url, res => { let b=''; res.on('data',d=>b+=d); res.on('end',()=>r1(JSON.parse(b))); }).on('error',r2);
    });
}
async function cdpSend(ws, id, method, params = {}) {
    return new Promise((resolve) => {
        ws.send(JSON.stringify({ id, method, params }), () => {});
        const handler = (raw) => {
            const m = JSON.parse(raw.toString());
            if (m.id === id) { ws.off('message', handler); resolve(m); }
        };
        ws.on('message', handler);
    });
}

const proc = spawn(CHROME, [
    '--headless=new','--disable-gpu','--no-sandbox','--disable-dev-shm-usage','--hide-scrollbars',
    '--window-size=520,900', `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=C:/Users/32545/AppData/Local/Temp/wb-debug-${CDP_PORT}`,
    'about:blank',
], { detached: false });
let t; for (let i=0;i<30;i++) { await delay(400); try { t=await fetchJson(`http://127.0.0.1:${CDP_PORT}/json`); break;}catch(e){} }
const ws = new WebSocket(t.find(x=>x.type==='page').webSocketDebuggerUrl);
await new Promise(r => ws.once('open', r));

let id = 0;
await cdpSend(ws, ++id, 'Page.enable');
await cdpSend(ws, ++id, 'Runtime.enable');

ws.on('message', raw => {
    try {
        const m = JSON.parse(raw.toString());
        if (m.method === 'Runtime.consoleAPICalled') {
            const args = m.params.args.map(a => a.value || a.description).join(' ');
            console.log(`[${m.params.type}]`, args);
        }
        if (m.method === 'Runtime.exceptionThrown') {
            console.log('[exception]', m.params.exceptionDetails.text);
            console.log('[exception desc]', m.params.exceptionDetails.exception?.description);
        }
    } catch (_) {}
});

await cdpSend(ws, ++id, 'Page.navigate', { url: TARGET_URL });
await delay(7000);

const gd = await cdpSend(ws, ++id, 'Runtime.evaluate', { expression: `typeof window.GameData`, returnByValue: true });
console.log('typeof GameData =', gd.result?.result?.value);

ws.close(); proc.kill();
