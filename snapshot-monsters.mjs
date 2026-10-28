// CDP 脚本：批量切换怪物类型并截图，验证 Canvas 程序化绘制
import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import WebSocket from 'ws';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CDP_PORT = 9340;
const TARGET_URL = 'http://localhost:8090/';
const OUT_DIR = 'C:/Users/32545/WorkBuddy/2026-07-23-09-44-01';
const TYPES = ['zombie', 'dog', 'rat', 'shadow', 'skeleton', 'spider', 'lizard', 'cyberdog', 'boar', 'snake'];
const BOSS_VARIANTS = [
    { name: 'toxic', label: '污染巨兽' },
    { name: 'radiation', label: '辐射领主' },
    { name: 'wasteland', label: '废土之王' },
    { name: 'infected', label: '感染母体' },
    { name: 'mechanical', label: '机械独裁者' },
];

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => resolve(JSON.parse(body)));
            res.on('error', reject);
        }).on('error', reject);
    });
}

async function main() {
    // 1. 启动 chrome
    console.log('启动 Chrome (CDP)...');
    const chrome = spawn(CHROME, [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--no-sandbox',
        `--remote-debugging-port=${CDP_PORT}`,
        '--window-size=520,900',
        'about:blank',
    ], { stdio: 'pipe' });
    chrome.stderr.on('data', () => {});
    await delay(2000);

    // 2. 找 page target
    const targets = await fetchJson(`http://localhost:${CDP_PORT}/json`);
    const page = targets.find(t => t.type === 'page');
    if (!page) throw new Error('no page target');
    console.log('连接 CDP:', page.webSocketDebuggerUrl);

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 0;
    const pending = new Map();
    ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.id && pending.has(msg.id)) {
            pending.get(msg.id)(msg);
            pending.delete(msg.id);
        }
    });
    function send(method, params = {}) {
        const myId = ++id;
        return new Promise((resolve, reject) => {
            pending.set(myId, (msg) => msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result));
            ws.send(JSON.stringify({ id: myId, method, params }));
        });
    }
    await new Promise(r => ws.on('open', r));
    await send('Page.enable');
    await send('Runtime.enable');

    // 3. 导航到目标页面
    console.log('加载', TARGET_URL);
    await send('Page.navigate', { url: TARGET_URL });
    await delay(5000);   // 等战斗初始化 + 模块加载

    // 4. 验证战斗 canvas 已初始化
    const check = await send('Runtime.evaluate', {
        expression: `
            (function() {
                const c = document.getElementById('battle-canvas');
                return JSON.stringify({
                    hasCanvas: !!c,
                    hasForceMonster: typeof window.__forceMonster,
                    bodyLoaded: document.readyState,
                    appHTML: !!document.getElementById('app')
                });
            })();
        `,
        returnByValue: true
    });
    const checkData = JSON.parse(check.result.value);
    console.log('检查状态:', checkData);
    if (!checkData.hasCanvas) throw new Error('battle-canvas not found');
    console.log('Canvas 已就绪');

    // 5. 截 10 只小怪
    // 先停止战斗循环（防止 startNextBattle 覆盖 canvas state）
    await send('Runtime.evaluate', {
        expression: `window.stopContinuousBattle && window.stopContinuousBattle();`,
        returnByValue: true
    });
    await delay(500);

    for (const type of TYPES) {
        await send('Runtime.evaluate', {
            expression: `window.__forceMonster('${type}');`,
            returnByValue: true
        });
        await delay(300);
        const ss = await send('Page.captureScreenshot', { format: 'png' });
        const out = `${OUT_DIR}/preview-${type}.png`;
        fs.writeFileSync(out, Buffer.from(ss.data, 'base64'));
        console.log('  ✓', type, '→', out);
    }

    // 6. 截 5 个 boss 变体
    for (let i = 0; i < BOSS_VARIANTS.length; i++) {
        await send('Runtime.evaluate', {
            expression: `window.__forceBoss(${i});`,
            returnByValue: true
        });
        await delay(300);
        const ss = await send('Page.captureScreenshot', { format: 'png' });
        const out = `${OUT_DIR}/preview-boss-${i}-${BOSS_VARIANTS[i].name}.png`;
        fs.writeFileSync(out, Buffer.from(ss.data, 'base64'));
        console.log('  ✓ boss#' + i, BOSS_VARIANTS[i].label, '→', out);
    }

    // 7. 清理
    ws.close();
    chrome.kill();
    console.log('\n✅ 完成');
}

main().catch(e => { console.error('失败:', e.message); process.exit(1); });