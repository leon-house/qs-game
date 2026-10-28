// 验证 boss cooldown UI：直接调 startBossCooldown + 模拟 enemy-killed
import { spawn } from 'child_process';
import fs from 'fs';

const chromePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const port = 9251;
const target = 'http://106.54.31.70:8080/?v=boss-cooldown-20260814d&nocache=' + Date.now();

const chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=1', '--window-size=360,800',
    '--disable-application-cache', '--disk-cache-size=1',
    '--user-data-dir=C:/Users/32545/AppData/Local/Temp/edge-verify-' + Date.now(),
    '--remote-debugging-port=' + port, target
], { stdio: ['ignore', 'pipe', 'pipe'] });

await new Promise(r => setTimeout(r, 4000));

const targetsRes = await fetch('http://127.0.0.1:' + port + '/json');
const targets = await targetsRes.json();
const pageTarget = targets.find(t => t.type === 'page' && t.url.includes('106.54.31.70'));
if (!pageTarget) {
    console.error('No page target found. Targets:', targets.map(t => ({type: t.type, url: t.url})));
    process.exit(1);
}
const wsUrl = pageTarget.webSocketDebuggerUrl;
const { WebSocket } = await import('ws');
const ws = new WebSocket(wsUrl);
await new Promise(r => ws.on('open', r));

let id = 0;
const send = (method, params = {}) => new Promise(r => {
    const msgId = ++id;
    const handler = (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.id === msgId) { ws.off('message', handler); r(msg); }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({id: msgId, method, params}));
});

await send('Page.enable');
await send('Runtime.enable');

const errors = [];
ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.method === 'Runtime.exceptionThrown') {
        errors.push(msg.params.exceptionDetails.text + ' ' + (msg.params.exceptionDetails.exception?.description || ''));
    }
});

console.log('1. Wait for main.js loaded (poll for startContinuousBattle)');
let waited = 0;
while (waited < 10000) {
    const ready = await send('Runtime.evaluate', {expression: 'typeof window.startContinuousBattle', returnByValue: true});
    if (ready.result?.result?.value === 'function') break;
    await new Promise(r => setTimeout(r, 500));
    waited += 500;
}
console.log(`  Waited ${waited}ms for main.js`);
// Wait extra 2 seconds for story modal to open (it fires 1500ms after init)
await new Promise(r => setTimeout(r, 2500));
// Now close any modal that opened
await send('Runtime.evaluate', {expression: `
    document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
    const storyModal = document.getElementById('story-modal');
    if (storyModal) storyModal.classList.remove('active');
`, returnByValue: true});
await new Promise(r => setTimeout(r, 500));

console.log('2. Check window APIs');
let r = await send('Runtime.evaluate', {expression: `
    JSON.stringify({
        startBossCooldown: typeof window.startBossCooldown,
        endBossCooldown: typeof window.endBossCooldown,
        isBossCooldown: typeof window.isBossCooldown,
        challengeCurrentBoss: typeof window.challengeCurrentBoss,
        startContinuousBattle: typeof window.startContinuousBattle,
        docReadyState: document.readyState,
    })
`, returnByValue: true});
console.log('  APIs:', r.result?.result?.value);

console.log('3. Initial state');
r = await send('Runtime.evaluate', {expression: `
    JSON.stringify({
        bossCardState: document.getElementById('boss-card')?.dataset.state,
        bossSub: document.getElementById('boss-card-sub')?.textContent,
        challengeBtnHidden: document.querySelector('.boss-btn-challenge')?.hidden,
        bossTitle: document.getElementById('boss-card-title')?.textContent,
    })
`, returnByValue: true});
console.log('  ', r.result?.result?.value);

console.log('4. Trigger startBossCooldown(5)');
await send('Runtime.evaluate', {expression: 'window.startBossCooldown(5)'});
await new Promise(r => setTimeout(r, 250));
r = await send('Runtime.evaluate', {expression: `
    JSON.stringify({
        bossCardState: document.getElementById('boss-card')?.dataset.state,
        bossSub: document.getElementById('boss-card-sub')?.textContent,
        challengeBtnHidden: document.querySelector('.boss-btn-challenge')?.hidden,
        isBossCooldown: window.isBossCooldown(),
    })
`, returnByValue: true});
console.log('  After startBossCooldown(5):', r.result?.result?.value);

console.log('5. Simulate killing 3 small monsters');
await send('Runtime.evaluate', {expression: `
    for (let i = 0; i < 3; i++) {
        window.dispatchEvent(new CustomEvent('enemy-killed', {detail: {isBoss: false, name: '丧尸'}}));
    }
`});
await new Promise(r => setTimeout(r, 200));
r = await send('Runtime.evaluate', {expression: `
    JSON.stringify({
        bossSub: document.getElementById('boss-card-sub')?.textContent,
        challengeBtnHidden: document.querySelector('.boss-btn-challenge')?.hidden,
        isBossCooldown: window.isBossCooldown(),
    })
`, returnByValue: true});
console.log('  After 3 kills:', r.result?.result?.value);

console.log('6. Simulate killing 2 more (should reach 5/5 → end cooldown)');
await send('Runtime.evaluate', {expression: `
    for (let i = 0; i < 2; i++) {
        window.dispatchEvent(new CustomEvent('enemy-killed', {detail: {isBoss: false, name: '丧尸'}}));
    }
`});
await new Promise(r => setTimeout(r, 250));
r = await send('Runtime.evaluate', {expression: `
    JSON.stringify({
        bossCardState: document.getElementById('boss-card')?.dataset.state,
        bossSub: document.getElementById('boss-card-sub')?.textContent,
        challengeBtnHidden: document.querySelector('.boss-btn-challenge')?.hidden,
        isBossCooldown: window.isBossCooldown(),
    })
`, returnByValue: true});
console.log('  After 5 kills (cooldown should end):', r.result?.result?.value);

console.log('7. Screenshot cooldown state (close any modal first)');
// Mark story as already shown so it doesn't auto-open later
await send('Runtime.evaluate', {expression: `
    // Find any global GameData reference and mark story shown
    try {
        if (typeof window.GameData !== 'undefined') {
            window.GameData.player.lastStoryShownLevel = window.GameData.player.bossLevel || 0;
        }
    } catch (_) {}
    // Close any active modal
    document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
    const storyModal = document.getElementById('story-modal');
    if (storyModal) storyModal.classList.remove('active');
    return 'done';
`, returnByValue: true});
await new Promise(r => setTimeout(r, 200));
await send('Runtime.evaluate', {expression: 'window.startBossCooldown(5)'});
await send('Runtime.evaluate', {expression: `
    window.dispatchEvent(new CustomEvent('enemy-killed', {detail: {isBoss: false, name: '丧尸'}}));
`});
await new Promise(r => setTimeout(r, 800));
// Verify no modal before screenshot
const stillOpen = await send('Runtime.evaluate', {expression: `
    Array.from(document.querySelectorAll('.modal-overlay.active')).map(m => m.id || 'unknown').join(',')
`, returnByValue: true});
console.log('  Modals still open:', JSON.stringify(stillOpen.result?.result?.value) || '(none)');
const shot = await send('Page.captureScreenshot', {format: 'png'});
fs.writeFileSync('boss-cooldown.png', Buffer.from(shot.result.data, 'base64'));
console.log('  Saved boss-cooldown.png');

console.log('8. Verify challenge button click is BLOCKED during cooldown');
await send('Runtime.evaluate', {expression: 'window.startBossCooldown(5)'});
await new Promise(r => setTimeout(r, 200));
r = await send('Runtime.evaluate', {expression: 'window.challengeCurrentBoss()', returnByValue: true});
console.log('  challengeCurrentBoss() returned:', r.result?.result?.value, '(should be false — blocked)');

console.log('9. Verify endBossCooldown() restores pending state');
await send('Runtime.evaluate', {expression: 'window.endBossCooldown()'});
await new Promise(r => setTimeout(r, 200));
r = await send('Runtime.evaluate', {expression: `
    JSON.stringify({
        bossCardState: document.getElementById('boss-card')?.dataset.state,
        isBossCooldown: window.isBossCooldown(),
    })
`, returnByValue: true});
console.log('  After endBossCooldown:', r.result?.result?.value);

if (errors.length) console.log('ERRORS:', errors);
else console.log('No errors');

ws.close();
chrome.kill();
console.log('Done');
