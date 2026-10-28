// CDP 截图验证：5 tab + 3 modal + 扫荡按钮 + 战斗画布
import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import WebSocket from 'ws';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CDP_PORT = 9341;
const TARGET_URL = 'http://106.54.31.70:8080/';
const OUT_DIR = 'C:/Users/32545/WorkBuddy/2026-07-23-09-44-01/shots-skillbook';

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        http.get(url, res => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
        }).on('error', reject);
    });
}

async function cdpSend(ws, id, method, params = {}) {
    return new Promise((resolve) => {
        ws.send(JSON.stringify({ id, method, params }), () => {});
        const handler = (raw) => {
            const msg = JSON.parse(raw.toString());
            if (msg.id === id) { ws.off('message', handler); resolve(msg); }
        };
        ws.on('message', handler);
    });
}

// 启动 Chrome
console.log('[snapshot] starting chrome on port', CDP_PORT);
const chromeArgs = [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    '--window-size=520,900',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=C:/Users/32545/AppData/Local/Temp/wb-chrome-${CDP_PORT}-${Date.now()}`,
    'about:blank',
];
const chromeProc = spawn(CHROME, chromeArgs, { detached: false });
chromeProc.on('error', e => console.error('[chrome] error:', e));

// 等待 CDP ready
let targets;
for (let i = 0; i < 30; i++) {
    await delay(400);
    try { targets = await fetchJson(`http://127.0.0.1:${CDP_PORT}/json`); break; }
    catch (e) {}
}
if (!targets || targets.length === 0) { console.error('Chrome CDP failed'); chromeProc.kill(); process.exit(1); }
const target = targets.find(t => t.type === 'page') || targets[0];
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => ws.once('open', r));
console.log('[snapshot] CDP ready');

// attach + enable
let id = 0;
await cdpSend(ws, ++id, 'Page.enable');
await cdpSend(ws, ++id, 'Runtime.enable');
await cdpSend(ws, ++id, 'Console.enable');

// 收集 console errors
const errors = [];
ws.on('message', (raw) => {
    try {
        const msg = JSON.parse(raw.toString());
        if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
            errors.push('console.error: ' + msg.params.args.map(a => a.value || a.description).join(' '));
        }
        if (msg.method === 'Runtime.exceptionThrown') {
            errors.push('exception: ' + (msg.params.exceptionDetails.text || JSON.stringify(msg.params.exceptionDetails).slice(0, 200)));
        }
    } catch (_) {}
});

// navigate
await cdpSend(ws, ++id, 'Page.navigate', { url: TARGET_URL });
await delay(4000);  // wait for full load + canvas init

async function evalAsync(expr) {
    const r = await cdpSend(ws, ++id, 'Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return r.result?.result?.value;
}

async function shot(name) {
    const r = await cdpSend(ws, ++id, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${OUT_DIR}/${name}.png`, Buffer.from(r.result.data, 'base64'));
    console.log(`[shot] ${name}.png`);
}

console.log('--- 1. 首页 ---');
const turnText = await evalAsync(`document.getElementById('battle-turn').textContent`);
const sweepChapter = await evalAsync(`document.getElementById('sweep-chapter').textContent`);
const sweepBtn = await evalAsync(`document.getElementById('sweep-btn').textContent`);
const navButtons = await evalAsync(`
    Array.from(document.querySelectorAll('.action-buttons .action-btn')).map(e => e.innerText.trim())
`);
console.log('回合:', turnText);
console.log('扫荡章节:', sweepChapter, '扫荡按钮:', sweepBtn);
console.log('底部 nav:', navButtons);
await shot('1-home');

console.log('\n--- 2. 技能书 modal ---');
await evalAsync(`window.openSkillBook()`);
await delay(800);
const sbActive = await evalAsync(`document.getElementById('skillbook-modal').classList.contains('active')`);
console.log('skillbook modal active:', sbActive);
await shot('2-skillbook');
await evalAsync(`window.closeSkillBook()`);
await delay(400);

console.log('\n--- 3. 商店 modal ---');
await evalAsync(`window.openShop()`);
await delay(1500);
const shopItems = await evalAsync(`
    Array.from(document.querySelectorAll('.shop-item')).length
`);
const shopCharges = await evalAsync(`document.getElementById('refresh-count').textContent`);
const shopCost = await evalAsync(`document.getElementById('refresh-cost').textContent`);
const shopGold = await evalAsync(`document.getElementById('shop-gold-display').textContent`);
console.log('商品数:', shopItems, '刷新:', shopCharges, '费用:', shopCost, '金币:', shopGold);
await shot('3-shop');
await evalAsync(`window.closeShop()`);
await delay(400);

console.log('\n--- 4. 挑战 modal ---');
await evalAsync(`window.openChallenge()`);
await delay(800);
const chTiers = await evalAsync(`
    Array.from(document.querySelectorAll('.challenge-tier')).length
`);
const chSummary = await evalAsync(`
    document.getElementById('challenge-tiers').innerText.split('\\n').filter(Boolean).slice(0, 15)
`);
console.log('挑战数:', chTiers);
console.log('挑战内容前 15 行:', chSummary);
await shot('4-challenge');
await evalAsync(`window.closeChallenge()`);
await delay(400);

console.log('\n--- 5. 检查老 modal 已删除 ---');
const expExists = await evalAsync(`!!document.getElementById('expedition-modal')`);
const talExists = await evalAsync(`!!document.getElementById('talents-modal')`);
const herExists = await evalAsync(`!!document.getElementById('heroes-modal')`);
console.log('expedition-modal:', expExists, 'talents-modal:', talExists, 'heroes-modal:', herExists);

console.log('\n--- 6. 检查 GameData 状态 ---');
const gd = await evalAsync(`
    ({
        gold: window.GameData.player.gold,
        bossLevel: window.GameData.player.bossLevel,
        skillBooksCount: Object.keys(window.GameData.player.skillBooks || {}).length,
        skillShardsCount: Object.keys(window.GameData.player.skillShards || {}).length,
        shopCharges: window.GameData.player.shop.charges,
        challengeRemaining: window.GameData.player.challenge.remaining,
        bagEquipmentCount: (window.GameData.player.bag.equipment || []).length,
        skillBooksSystem: !!window.SkillBooks || !!window.synthBook,
    })
`);
console.log('GameData:', JSON.stringify(gd, null, 2));

console.log('\n--- 7. 商店商品类型确认（无金币袋）---');
const shopTypes = await evalAsync(`
    (window.GameData.player.shop.shopItems || []).map(i => ({ kind: i.kind, quality: i.quality, name: i.skillName || i.name }))
`);
console.log('商品种类:', JSON.stringify(shopTypes, null, 2));

console.log('\n=== Errors ===');
console.log(errors.length === 0 ? '(无)' : errors.join('\n'));

ws.close();
chromeProc.kill();
