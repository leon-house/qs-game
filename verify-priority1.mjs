// 验证优先级 1：右键菜单升级按钮已删 + sellPrice 用统一公式 + 任务计数正常
import { spawn } from 'child_process';
import fs from 'fs';

const chromePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const port = 9254;
const target = 'http://106.54.31.70:8080/?v=equip-refactor-20261008c&t=' + Date.now() + Math.floor(Math.random()*10000);

const chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=1', '--window-size=360,800',
    '--disable-application-cache', '--disk-cache-size=1',
    '--user-data-dir=C:/Users/32545/AppData/Local/Temp/edge-verify-' + Date.now(),
    '--remote-debugging-port=' + port, target
], { stdio: ['ignore', 'pipe', 'pipe'] });

await new Promise(r => setTimeout(r, 4500));

const targetsRes = await fetch('http://127.0.0.1:' + port + '/json');
const allTargets = await targetsRes.json();
const pageTarget = allTargets.find(t => t.type === 'page' && t.url.includes('106.54.31.70'));
const { WebSocket } = await import('ws');
const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
await new Promise(r => ws.on('open', r));

let id = 0;
const send = (m, p = {}) => new Promise(r => {
    const mid = ++id;
    const h = d => { const x = JSON.parse(d); if (x.id === mid) { ws.off('message', h); r(x); } };
    ws.on('message', h); ws.send(JSON.stringify({id: mid, method: m, params: p}));
});
await send('Page.enable'); await send('Runtime.enable');

const errors = [];
ws.on('message', d => {
    const m = JSON.parse(d.toString());
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text);
});

let waited = 0;
while (waited < 12000) {
    const r = await send('Runtime.evaluate', {expression: 'typeof window.startContinuousBattle', returnByValue: true});
    if (r.result?.result?.value === 'function') break;
    await new Promise(r => setTimeout(r, 400));
    waited += 400;
}
await new Promise(r => setTimeout(r, 1500));

// DEBUG: 检查 main.js 加载完后 window.decomposeItem 是什么
console.log('\n===== DEBUG: main.js 加载后 window.decomposeItem =====');
let rDebug = await send('Runtime.evaluate', {expression: `
    (async () => {
        const resp = await fetch('/src/main.js?v=equip-refactor-20261008c');
        const text = await resp.text();
        const lines = text.split('\n');
        const line369 = lines[368];
        const line370 = lines[369];
        const line371 = lines[370];
        const line372 = lines[371];
        const line374 = lines[373];
        return JSON.stringify({
            mainJsLength: text.length,
            line369: line369 ? line369.slice(0, 90) : '(none)',
            line370: line370 ? line370.slice(0, 90) : '(none)',
            line371: line371 ? line371.slice(0, 90) : '(none)',
            line372: line372 ? line372.slice(0, 90) : '(none)',
            line374: line374 ? line374.slice(0, 90) : '(none)',
            totalLines: lines.length,
        });
    })()
`, awaitPromise: true, returnByValue: true});
console.log('  ', rDebug.result?.result?.value);

console.log('===== 测试 1：装备 modal 详情弹窗的 sellPrice 用统一公式 =====');
let r = await send('Runtime.evaluate', {expression: `
    (async () => {
        const g = await import('./src/data/gameData.js');
        const eq = await import('./src/systems/equipment.js');
        const purpleSword = { id:'t1', name:'紫武', part:'weapon', quality:'purple', level:1, stats:{attack:25, critRate:5, combo:6, critDamage:0.25} };
        g.GameData.player.bag = { equipment: [purpleSword], material: [], equipmentMax: 30 };
        g.GameData.player.equipment = { weapon: null };
        // 详情弹窗中的"回收 +N💰"应该等于 calculateSellPrice
        return JSON.stringify({
            calculateSellPrice: eq.calculateSellPrice(purpleSword),
        });
    })()
`, awaitPromise: true, returnByValue: true});
console.log('  紫武 calculateSellPrice:', r.result?.result?.value, '(预期 ~147~177)');

console.log('\n===== 测试 2：右键菜单 HTML（升级按钮已删） =====');
r = await send('Runtime.evaluate', {expression: `
    (async () => {
        const g = await import('./src/data/gameData.js');
        const ui = await import('./src/ui/ui.js');
        g.GameData.player.bag = { equipment: [{id:'t1', name:'绿武', part:'weapon', quality:'green', level:1, stats:{attack:12}}], material: [], equipmentMax: 30 };
        // 模拟右键事件
        const fakeEvent = {
            preventDefault: () => {},
            clientX: 100, clientY: 100,
        };
        if (typeof window.showItemMenu === 'function') window.showItemMenu(fakeEvent, 't1');
        await new Promise(r => setTimeout(r, 200));
        const menu = document.getElementById('item-menu');
        return JSON.stringify({
            menuExists: !!menu,
            menuText: menu?.innerText || '(无)',
            hasUpgradeButton: menu?.innerHTML.includes('升级') || false,
            hasSellButton: menu?.innerHTML.includes('出售') || false,
            hasCancelButton: menu?.innerHTML.includes('取消') || false,
        });
    })()
`, awaitPromise: true, returnByValue: true});
console.log('  ', r.result?.result?.value);

console.log('\n===== 测试 3：装备 modal 里的回收触发 sell_thing 任务 =====');
r = await send('Runtime.evaluate', {expression: `
    window.__test3Result = null;
    window.__test3Error = null;
    (async () => {
        try {
            const g = await import('./src/data/gameData.js');
            const t = await import('./src/systems/tasks.js');
            const mq = await import('./src/systems/main-quest.js');
            // 直接重置 dailyTasks 整个对象（绕开 resetDailyTasks 的日期判断）
            g.GameData.player.dailyTasks = { lastResetDate: new Date().toDateString(), tasks: t.DAILY_TASKS.map(t2 => ({id:t2.id, progress:0, completed:false, claimed:false})) };
            const sword = { id:'t_sell', name:'测试紫武', part:'weapon', quality:'purple', level:1, stats:{attack:25}, source:'shop' };
            g.GameData.player.bag = { equipment: [sword], material: [], equipmentMax: 30 };
            g.GameData.player.gold = 0;
            g.GameData.player.mainQuest = { chapter: 1, stageIndex: 2, stages: mq.STAGES.map(() => ({progress:0,completed:false,claimed:false})) };
            const sellTask = g.GameData.player.dailyTasks.tasks.find(t2 => t2.id === 'sell_thing');
            const beforeDaily = sellTask ? sellTask.progress : null;
            const beforeMain = g.GameData.player.mainQuest.stages[2].progress;
            if (typeof window.recycleEquipment === 'function') window.recycleEquipment('t_sell');
            await new Promise(r => setTimeout(r, 300));
            const afterDaily = g.GameData.player.dailyTasks.tasks.find(t2 => t2.id === 'sell_thing').progress;
            const afterMain = g.GameData.player.mainQuest.stages[2].progress;
            window.__test3Result = JSON.stringify({
                goldAfter: g.GameData.player.gold,
                beforeDaily, afterDaily,
                beforeMain, afterMain,
                sell_thing_done: afterDaily >= 1,
                mainQuest_done: afterMain >= 1,
            });
        } catch (e) {
            window.__test3Error = String(e);
        }
    })();
    'started';
`, returnByValue: true});
await new Promise(r => setTimeout(r, 1000));
r = await send('Runtime.evaluate', {expression: 'window.__test3Result || window.__test3Error', returnByValue: true});
console.log('  ', r.result?.result?.value);

console.log('\n===== 测试 4：decomposeItem 也触发 sell_thing =====');
r = await send('Runtime.evaluate', {expression: `
    window.__test4Result = null;
    window.__test4Error = null;
    (async () => {
        try {
            const g = await import('./src/data/gameData.js');
            const t = await import('./src/systems/tasks.js');
            const mq = await import('./src/systems/main-quest.js');
            g.GameData.player.mainQuest = { chapter: 1, stageIndex: 2, stages: mq.STAGES.map(() => ({progress:0,completed:false,claimed:false})) };
            g.GameData.player.dailyTasks = { lastResetDate: new Date().toDateString(), tasks: t.DAILY_TASKS.map(t2 => ({id:t2.id, progress:0, completed:false, claimed:false})) };
            const sword = { id:'t_decomp', name:'测试紫武', part:'weapon', quality:'purple', level:1, stats:{attack:25} };
            g.GameData.player.bag = { equipment: [sword], material: [], equipmentMax: 30 };
            // DEBUG
            const decompExists = typeof window.decomposeItem;
            const decompSource = String(window.decomposeItem).slice(0, 100);
            const bagBefore = g.GameData.player.bag.equipment.length;
            if (typeof window.decomposeItem === 'function') window.decomposeItem('t_decomp');
            await new Promise(r => setTimeout(r, 300));
            const bagAfter = g.GameData.player.bag.equipment.length;
            const material = g.GameData.player.bag.material.length;
            const before = g.GameData.player.dailyTasks.tasks.find(t2 => t2.id === 'sell_thing').progress;
            const beforeMain = g.GameData.player.mainQuest.stages[2].progress;
            window.__test4Result = JSON.stringify({
                decompExists, decompSource,
                bagBefore, bagAfter, material,
                dailyBefore: before, dailyAfter: g.GameData.player.dailyTasks.tasks.find(t2 => t2.id === 'sell_thing').progress,
                mainBefore: beforeMain, mainAfter: g.GameData.player.mainQuest.stages[2].progress,
            });
        } catch (e) {
            window.__test4Error = String(e);
        }
    })();
    'started';
`, returnByValue: true});
await new Promise(r => setTimeout(r, 1000));
r = await send('Runtime.evaluate', {expression: 'window.__test4Result || window.__test4Error', returnByValue: true});
console.log('  ', r.result?.result?.value);

console.log('\n===== 测试 5：main-quest sell_thing 现在跳到 openEquipment =====');
r = await send('Runtime.evaluate', {expression: `
    (async () => {
        const mq = await import('./src/systems/main-quest.js');
        const sellStage = mq.STAGES.find(s => s.type === 'sell_thing');
        return JSON.stringify({ goto: sellStage.goto, expected: 'openEquipment' });
    })()
`, awaitPromise: true, returnByValue: true});
console.log('  ', r.result?.result?.value);

console.log('\n===== 测试 6：右键菜单 sellPrice 与详情弹窗一致 =====');
r = await send('Runtime.evaluate', {expression: `
    (async () => {
        const eq = await import('./src/systems/equipment.js');
        const g = await import('./src/data/gameData.js');
        const sword = { id:'consis', name:'紫武', part:'weapon', quality:'purple', level:1, stats:{attack:25, critRate:5, combo:6} };
        g.GameData.player.bag = { equipment: [sword], material: [], equipmentMax: 30 };
        // 详情弹窗的回收按钮显示
        if (typeof window.openEquipDetail === 'function') window.openEquipDetail('consis');
        await new Promise(r => setTimeout(r, 200));
        const detailHtml = document.getElementById('equip-detail-body')?.innerHTML || '';
        // 抓取"回收 +N💰"中的 N
        const detailMatch = detailHtml.match(/回收 \\+(\\d+)/);
        // 右键菜单的显示
        if (typeof window.showItemMenu === 'function') window.showItemMenu({preventDefault:()=>{},clientX:1,clientY:1}, 'consis');
        await new Promise(r => setTimeout(r, 200));
        const menuHtml = document.getElementById('item-menu')?.innerHTML || '';
        const menuMatch = menuHtml.match(/\\+(\\d+)/);
        return JSON.stringify({
            detailRecycleGold: detailMatch?.[1],
            menuSellGold: menuMatch?.[1],
            consistent: detailMatch?.[1] === menuMatch?.[1],
        });
    })()
`, awaitPromise: true, returnByValue: true});
console.log('  ', r.result?.result?.value);

if (errors.length) console.log('\nERRORS:', errors);
else console.log('\n✅ No errors');

ws.close(); chrome.kill();
