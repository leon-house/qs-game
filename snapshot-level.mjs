// 验证：怪物 + 玩家等级显示
import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import WebSocket from 'ws';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CDP_PORT = 9344;
const TARGET_URL = 'http://106.54.31.70:8080/';
const OUT_DIR = 'C:/Users/32545/WorkBuddy/2026-07-23-09-44-01/shots-level';
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
    `--user-data-dir=C:/Users/32545/AppData/Local/Temp/wb-lvl-${CDP_PORT}`,
    'about:blank',
], { detached: false });
let t; for (let i=0;i<30;i++) { await delay(400); try { t=await fetchJson(`http://127.0.0.1:${CDP_PORT}/json`); break;}catch(e){} }
const ws = new WebSocket(t.find(x=>x.type==='page').webSocketDebuggerUrl);
await new Promise(r => ws.once('open', r));

let id = 0;
await cdpSend(ws, ++id, 'Page.enable');
await cdpSend(ws, ++id, 'Runtime.enable');
await cdpSend(ws, ++id, 'Page.navigate', { url: TARGET_URL });
await delay(7000);

// 关闭剧情 modal 看画布
await evalAsync(ws, id, `document.getElementById('story-modal')?.classList.remove('active')`);

// 验证 state.enemies[0].level
const e0 = await evalAsync(ws, id, `
    (() => {
        const enemy = window.__battle_state?.enemies?.[0];
        return enemy ? { name: enemy.name, level: enemy.level, maxHp: enemy.maxHp, boss: enemy.boss } : null;
    })()
`);
console.log('[1] 第一个敌人数据:', JSON.stringify(e0));

// 检查更新 header 的 battle-area-name 是否包含正确等级
const areaName = await evalAsync(ws, id, `document.getElementById('battle-area-name').textContent`);
console.log('[2] battle-area-name:', areaName);

// 拿当前 canvas 截图
await shot(ws, id, '1-monster-lv');

console.log('\n[3] 把 bossLevel 推 5，验证等级 = chapter+1');
await evalAsync(ws, id, `
    (async () => {
        const mod = await import('/src/systems/battle-v2.js?v=skillbook-challenge-20260728e');
        window.__battle_state = mod.state || (await import('/src/systems/battle-canvas.js?v=skillbook-challenge-20260728e')).state;
    })()
`).catch(_ => {});
await evalAsync(ws, id, `
    (() => {
        // 通过修改 bossLevel 让下一章节怪物 Lv.6
        window.GameData.player.bossLevel = 5;
        // 重置战斗：调用 stop + start
        const mod = window.__battle_v2_module;
    })()
`);
// 改用更直接的方式：通过 battle-v2 模块的 state
const adv = await evalAsync(ws, id, `
    (async () => {
        const mod = await import('/src/systems/battle-v2.js?v=skillbook-challenge-20260728e');
        mod.stopContinuousBattle();
        window.GameData.player.bossLevel = 5;
        mod.startContinuousBattle(document.getElementById('battle-canvas'));
        return mod.state.enemies[0].level;
    })()
`);
console.log('  bossLevel=5 时 enemies[0].level:', adv);

await delay(2000);
await shot(ws, id, '2-monster-lv6');

const areaName2 = await evalAsync(ws, id, `document.getElementById('battle-area-name').textContent`);
console.log('[4] 推 5 后 battle-area-name:', areaName2);

ws.close();
proc.kill();