// verify-stats.mjs
import { spawn } from 'child_process';
import http from 'http';

const PORT = 9226;
const URL = 'http://106.54.31.70:8080/';

const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--incognito',
    '--disable-cache', '--disk-cache-size=0',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=C:/tmp/chrome-ss-' + Date.now(),
    URL,
], { detached: true, stdio: 'ignore' });
chrome.unref();
await new Promise(r => setTimeout(r, 5000));

const targets = await new Promise((resolve, reject) => {
    http.get(`http://localhost:${PORT}/json`, res => {
        let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
});
const target = targets.find(t => t.type === 'page');
const WS = (await import('ws')).default;
const ws = new WS(target.webSocketDebuggerUrl);
let msgId = 1; const pending = new Map();
ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
    }
});
await new Promise(r => ws.on('open', r));
function send(method, params = {}) {
    const id = msgId++;
    return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
    });
}
async function evalJS(expr) {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    if (r.exceptionDetails) return null;
    return r.result.value;
}

let cnt = 0;
while (cnt < 40) {
    const ok = await evalJS('typeof window.GameData !== "undefined" && !!(window.GameData && window.GameData.player)');
    if (ok) break;
    await new Promise(r => setTimeout(r, 500));
    cnt++;
}
await new Promise(r => setTimeout(r, 2000));

console.log('===== 验证 1: 属性面板 5 字段 =====');
// 关闭剧情（如果有）
await evalJS('window.closeStory()');
await new Promise(r => setTimeout(r, 300));
// 打开属性 modal
await evalJS('window.openStatsModal()');
await new Promise(r => setTimeout(r, 500));
const statsHtml = await evalJS('document.getElementById("stats-detail").innerHTML');
const fields = ['attack', '防御', '生命', '暴击', '爆伤', '攻速', '吸血', '连击'];
const hasField = {};
fields.forEach(f => {
    hasField[f] = statsHtml.includes(f);
});
console.log('属性面板字段:', hasField);
const expected = { attack: true, 防御: false, 生命: false, 暴击: true, 爆伤: true, 攻速: true, 吸血: false, 连击: true };
console.log('期望（防御/生命/吸血 应为 false）:', expected);

// 截图属性面板
const r = await send('Page.captureScreenshot', { format: 'png' });
const fs = await import('fs');
fs.writeFileSync('C:/Users/32545/WorkBuddy/2026-07-23-09-44-01/stats-panel.png', Buffer.from(r.data, 'base64'));
console.log('属性面板截图已保存');

console.log('\n===== 验证 2: calculateStats 字段 =====');
const stats = await evalJS(`
    (() => {
        const s = window.calculateStats ? window.calculateStats() : null;
        if (!s) return null;
        return {
            attack: s.attack,
            attackSpeed: s.attackSpeed,
            critRate: s.critRate,
            critDamage: s.critDamage,
            combo: s.combo,
            hasDefense: 'defense' in s,
            hasHp: 'hp' in s,
            hasLifeSteal: 'lifeSteal' in s,
        };
    })()
`);
console.log('计算属性:', stats);

console.log('\n===== 验证 3: 装备配置 5 字段 =====');
const equipFields = await evalJS(`
    Object.keys((window.SET_EQUIP_TEMPLATES || [])[0]?.baseStats || {})
`);
console.log('装备模板字段:', equipFields);

console.log('\n===== 验证 4: 注入完整装备，查看 stats =====');
await evalJS(`
    // 注入全套 wasteland 装备（含 combo）
    window.GameData.player.equipment = {
        weapon: { id: 'beast_claw', baseAttack: 16, baseCritRate: 3, baseCombo: 2, level: 1, quality: 'blue' },
        armor:  { id: 'beast_hide', baseAttack: 10, baseAttackSpeed: 0.05, level: 1, quality: 'blue' },
        head:   { id: 'mech_visor', baseAttack: 12, baseCritRate: 4, level: 1, quality: 'blue' },
    };
`);
const fullStats = await evalJS('window.calculateStats()');
console.log('全套装备后:', fullStats);

ws.close();
process.kill(-chrome.pid);
process.exit(0);