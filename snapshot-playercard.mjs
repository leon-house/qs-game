// CDP 验证：玩家卡竖排（头像在上，名字经验条在下）
import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import WebSocket from 'ws';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CDP_PORT = 9345;
const TARGET_URL = 'http://106.54.31.70:8080/';
const OUT_DIR = 'C:/Users/32545/WorkBuddy/2026-07-23-09-44-01/shots-playercard';
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

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
async function evalAsync(ws, id, expr) {
    const r = await cdpSend(ws, ++id, 'Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) console.error('  [eval error]', r.result.exceptionDetails.text);
    return r.result?.result?.value;
}
async function shot(ws, id, name) {
    const r = await cdpSend(ws, ++id, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${OUT_DIR}/${name}.png`, Buffer.from(r.result.data, 'base64'));
}

const proc = spawn(CHROME, [
    '--headless=new','--disable-gpu','--no-sandbox','--disable-dev-shm-usage','--hide-scrollbars',
    '--window-size=520,900', `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=C:/Users/32545/AppData/Local/Temp/wb-pc-${CDP_PORT}`,
    'about:blank',
], { detached: false });
let t; for (let i=0;i<30;i++) { await delay(400); try { t=await fetchJson(`http://127.0.0.1:${CDP_PORT}/json`); break;}catch(e){} }
const ws = new WebSocket(t.find(x=>x.type==='page').webSocketDebuggerUrl);
await new Promise(r => ws.once('open', r));

let id = 0;
await cdpSend(ws, ++id, 'Page.enable');
await cdpSend(ws, ++id, 'Runtime.enable');
await cdpSend(ws, ++id, 'Page.navigate', { url: TARGET_URL });
await delay(8000);

// 关掉剧情 modal
await evalAsync(ws, id, `document.getElementById('story-modal')?.classList.remove('active')`);

// 检查 DOM 结构
const dom = await evalAsync(ws, id, `
    ({
        hasPlayerInfoSide: !!document.querySelector('.player-info-side'),
        hasPlayerInfoStack: !!document.querySelector('.player-info-stack'),
        hasPlayerAvatar: !!document.querySelector('.player-avatar'),
        sideClassName: document.querySelector('.player-info-side')?.className,
    })
`);
console.log('[0] DOM 检查:', JSON.stringify(dom));

// 模拟一些经验值/金币让布局有内容
await evalAsync(ws, id, `
    window.GameData.player.characterLevel = 2;
    window.GameData.player.currentExp = 49;
    window.GameData.player.expToNext = 742;
    window.GameData.player.gold = 2345;
`);

// 检查布局方向
const layout = await evalAsync(ws, id, `
    (() => {
        const side = document.querySelector('.player-info-side');
        const stack = document.querySelector('.player-info-stack');
        const avatar = document.querySelector('.player-avatar');
        const expBar = document.querySelector('.player-info-stack .exp-bar-container');
        if (!side) return null;
        const s = getComputedStyle(side);
        const st = stack ? getComputedStyle(stack) : null;
        const e = expBar ? getComputedStyle(expBar) : null;
        return {
            side: {
                display: s.display,
                flexDirection: s.flexDirection,
                alignItems: s.alignItems,
                maxWidth: s.maxWidth,
                width: s.width,
            },
            stack: stack ? {
                display: st.display,
                flexDirection: st.flexDirection,
                alignItems: st.alignItems,
                maxWidth: st.maxWidth,
            } : null,
            avatar: avatar ? {
                width: avatar.offsetWidth,
                height: avatar.offsetHeight,
                top: avatar.getBoundingClientRect().top,
                left: avatar.getBoundingClientRect().left,
            } : null,
            expBar: e ? {
                width: e.width,
                maxWidth: e.maxWidth,
                top: expBar.getBoundingClientRect().top,
                left: expBar.getBoundingClientRect().left,
                right: expBar.getBoundingClientRect().right,
            } : null,
        };
    })()
`);
console.log('[1] 布局方向:', JSON.stringify(layout, null, 2));

// 看头像是否在 stack 上方（avatar.top 应小于 stack.top）
console.log('\n[2] 头像 y 坐标 =', layout.avatar.top, ', 经验条 y =', layout.expBar.top);
console.log('    头像在上:', layout.avatar.top < layout.expBar.top);

// 截图
await shot(ws, id, '1-playercard-stack');

ws.close(); proc.kill();