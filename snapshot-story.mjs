// CDP 测试：剧情触发
import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import WebSocket from 'ws';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CDP_PORT = 9342;
const TARGET_URL = 'http://106.54.31.70:8080/';
const OUT_DIR = 'C:/Users/32545/WorkBuddy/2026-07-23-09-44-01/shots-story';
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

let targets;
for (let i = 0; i < 30; i++) {
    await delay(400);
    try { targets = await fetchJson(`http://127.0.0.1:${CDP_PORT}/json`); break; }
    catch (e) {}
}
const target = targets.find(t => t.type === 'page') || targets[0];
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => ws.once('open', r));

let id = 0;
await cdpSend(ws, ++id, 'Page.enable');
await cdpSend(ws, ++id, 'Runtime.enable');

const errors = [];
ws.on('message', (raw) => {
    try {
        const m = JSON.parse(raw.toString());
        if (m.method === 'Runtime.exceptionThrown') {
            errors.push('ex: ' + (m.params.exceptionDetails.text || JSON.stringify(m.params.exceptionDetails).slice(0, 200)));
        }
        if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
            errors.push('console: ' + m.params.args.map(a => a.value || a.description).join(' '));
        }
    } catch (_) {}
});

async function evalAsync(expr) {
    const r = await cdpSend(ws, ++id, 'Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) {
        console.error('  [eval error]', expr.substring(0, 80).replace(/\n/g,' '), '→', r.result.exceptionDetails.text);
        return undefined;
    }
    const v = r.result?.result?.value;
    return v;
}
async function shot(name) {
    const r = await cdpSend(ws, ++id, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${OUT_DIR}/${name}.png`, Buffer.from(r.result.data, 'base64'));
}

console.log('[1] 进入页面，验证首次剧情弹窗...');
await cdpSend(ws, ++id, 'Page.navigate', { url: TARGET_URL });
await delay(7000);

// 直接 eval 看 GameData 是否定义
const hasGD = await evalAsync(`typeof window.GameData`);
console.log('  typeof GameData:', hasGD);

// 主动 import story 一次（防止 lazy import 时未加载）
await evalAsync(`(async () => { await import('/src/systems/story.js?v=skillbook-challenge-20260728d'); })()`);
await delay(800);

const sbActive = await evalAsync(`document.getElementById('story-modal').classList.contains('active')`);
const sbTitle = await evalAsync(`(document.getElementById('story-title')||{}).textContent`);
const sbContent = await evalAsync(`(document.getElementById('story-content')||{}).textContent`);
const bossLevel = await evalAsync(`window.GameData?.player?.bossLevel`);
const lastShown = await evalAsync(`window.GameData?.player?.lastStoryShownLevel`);
console.log('  剧情 modal active:', sbActive);
console.log('  剧情标题:', sbTitle);
console.log('  内容前 100 字:', (sbContent || '').substring(0, 100));
console.log('  bossLevel:', bossLevel, 'lastStoryShownLevel:', lastShown);
await shot('1-first-story');

console.log('\n[2] 关闭剧情，模拟 bossLevel 推进 1 后重新弹剧情...');
await evalAsync(`document.getElementById('story-modal').classList.remove('active')`);
await evalAsync(`window.GameData.player.lastStoryShownLevel = -1`);
await evalAsync(`window.GameData.player.bossLevel = 1`);
await evalAsync(`window.saveData()`);
await evalAsync(`window.showCurrentChapterStory()`);
await delay(500);
const sb2Active = await evalAsync(`document.getElementById('story-modal').classList.contains('active')`);
const sb2Title = await evalAsync(`document.getElementById('story-title').textContent`);
const sb2Content = await evalAsync(`document.getElementById('story-content').textContent`);
console.log('  bossLevel=1 → 剧情 modal active:', sb2Active);
console.log('  标题:', sb2Title);
console.log('  内容前 80 字:', sb2Content.substring(0, 80));
await shot('2-second-story');

console.log('\n[3] 直接调 showStory(5) → 第 6 章剧情');
await evalAsync(`document.getElementById('story-modal').classList.remove('active')`);
await evalAsync(`window.showStory(5)`);
await delay(500);
const sb3Title = await evalAsync(`document.getElementById('story-title').textContent`);
const sb3Content = await evalAsync(`document.getElementById('story-content').textContent`);
console.log('  标题:', sb3Title);
console.log('  内容前 80 字:', sb3Content.substring(0, 80));
await shot('3-chapter6-story');

console.log('\n[4] 验证 CHAPTER_STORIES 长度 = 10');
const storyCount = await evalAsync(`window.CHAPTER_STORIES?.length || (window.GameData && Object.keys(window.GameData).length)`);
const configStories = await evalAsync(`(await import('/src/data/config.js?v=skillbook-challenge-20260728d')).CHAPTER_STORIES.length`);
console.log('  CHAPTER_STORIES.length:', configStories);

console.log('\n=== Errors ===');
console.log(errors.length === 0 ? '(无)' : errors.join('\n'));

ws.close();
chromeProc.kill();
