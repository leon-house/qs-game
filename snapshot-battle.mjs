// 战斗画布快照：验证 Boss 完整 + 剑方向
import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import WebSocket from 'ws';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CDP_PORT = 9346;
const TARGET_URL = 'http://106.54.31.70:8080/';
const OUT_DIR = 'C:/Users/32545/WorkBuddy/2026-07-23-09-44-01/shots-battle';
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
    '--window-size=520,950', `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=C:/Users/32545/AppData/Local/Temp/wb-bat-${CDP_PORT}`,
    'about:blank',
], { detached: false });
let t; for (let i=0;i<30;i++) { await delay(400); try { t=await fetchJson(`http://127.0.0.1:${CDP_PORT}/json`); break;}catch(e){} }
const ws = new WebSocket(t.find(x=>x.type==='page').webSocketDebuggerUrl);
await new Promise(r => ws.once('open', r));

let id = 0;
await cdpSend(ws, ++id, 'Page.enable');
await cdpSend(ws, ++id, 'Runtime.enable');
await cdpSend(ws, ++id, 'Page.navigate', { url: TARGET_URL });
await delay(10000);

// 关剧情 modal
await evalAsync(ws, id, `document.getElementById('story-modal')?.classList.remove('active')`);

// 推 bossLevel 让当前敌人 = Boss（用 main.js 已暴露的 GameData）
await evalAsync(ws, id, `
    window.GameData.player.bossLevel = 0;
`);

// 重启战斗
const restart = await evalAsync(ws, id, `
    (async () => {
        const mod = await import('/src/systems/battle-v2.js?v=battle-boss-sword-20260728g');
        mod.stopContinuousBattle();
        mod.startContinuousBattle(document.getElementById('battle-canvas'));
        return { ok: true, enemies: mod.state ? mod.state.enemies?.length : null };
    })()
`);
// 启动时检查
console.log('[1] 战斗重启:', JSON.stringify(restart));
// 强制切换到 Boss：动态 import battle-v2 + battle-canvas 共享同一个 state
const bossResult = await evalAsync(ws, id, `
    (async () => {
        const mod = await import('/src/systems/battle-v2.js?v=battle-boss-sword-20260728g');
        // state 是模块内 const，不能外部访问；通过 DOM 头部信息反推 + 直接调用 bc.startBattle
        const bc = await import('/src/systems/battle-canvas.js?v=battle-boss-sword-20260728g');
        // 直接调 startBattle 画一个 Boss（variant=2 废土之王）
        bc.startBattle({
            type: 'shadow', name: '废土之王', maxHp: 1000,
            attack: 30, coins: 100, exp: 50,
            boss: true, bossVariant: 2,
        });
        // 触发一次 draw
        bc.onDamageDealt(50, true);
        return { ok: true };
    })()
`);
console.log('[Boss force] ', JSON.stringify(bossResult));

await delay(1500);
await shot(ws, id, '4-boss-final');

// 截图：Boss + 玩家 + 剑挥击姿态
await shot(ws, id, '1-boss-full');

// 强制触发一次挥剑动画：捕获 击打 阶段（击打瞬间最像挥击）
await evalAsync(ws, id, `
    (async () => {
        const bc = await import('/src/systems/battle-canvas.js?v=battle-boss-sword-20260728g');
        bc.onDamageDealt(10, false);
    })()
`);
await delay(300);
await shot(ws, id, '2-sword-strike');

await delay(200);
await shot(ws, id, '3-sword-mid-strike');

// 强制切换到 Boss（直接 state.currentEnemyIndex = 末尾 + 重启战斗）
await evalAsync(ws, id, `
    (async () => {
        const mod = await import('/src/systems/battle-v2.js?v=battle-boss-sword-20260728g');
        if (!mod.state) return { error: 'no state' };
        const boss = mod.state.enemies[mod.state.enemies.length - 1];
        // 把前 N 只全杀掉（hp=0）+ 推进 currentEnemyIndex
        for (let i = 0; i < mod.state.enemies.length - 1; i++) {
            mod.state.enemies[i].hp = 0;
        }
        mod.state.currentEnemyIndex = mod.state.enemies.length - 1;
        // 触发下一战 = Boss（用 import 的 bc.startBattle + canvas 的 initBattleCanvas state）
        const bc = await import('/src/systems/battle-canvas.js?v=battle-boss-sword-20260728g');
        bc.startBattle({
            type: boss.type, name: boss.name, maxHp: boss.maxHp,
            attack: boss.attack, coins: boss.coins, exp: boss.exp,
            boss: boss.boss, bossVariant: boss.bossVariant || 0,
        });
        return { bossName: boss.name, bossVariant: boss.bossVariant, currentEnemyIndex: mod.state.currentEnemyIndex };
    })()
`);
await delay(1500);
await shot(ws, id, '4-boss-final');

console.log('[2] 剑挥击方向 + Boss 完整性截图完成');
ws.close(); proc.kill();