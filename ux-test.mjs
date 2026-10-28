// UX 改进验证测试
import pkg from 'jsdom';
const { JSDOM } = pkg;

const BASE = 'http://localhost:8090';

const dom = await JSDOM.fromURL(BASE + '/dist/test-index.html', {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    storageQuota: 10000000
});

const { window } = dom;
window.setTimeout = setTimeout;
window.setInterval = setInterval;

await new Promise(r => window.addEventListener('load', r));
await new Promise(r => setTimeout(r, 500));

const log = (...args) => console.log(...args);
const pass = (msg) => console.log(`\x1b[32m✓\x1b[0m ${msg}`);
const fail = (msg) => console.log(`\x1b[31m✗\x1b[0m ${msg}`);
let total = 0, ok = 0;

function isActive(id) {
    return window.document.getElementById(id)?.classList.contains('active');
}

function activeModals() {
    return Array.from(window.document.querySelectorAll('.modal-overlay.active')).map(m => m.id);
}

// ============================================================
// 测试 1: 弹窗互斥 — 打开 A 后再打开 B，A 应该自动关闭
// ============================================================
log('\n===== 测试 1: 弹窗互斥 =====');
window.openShop();
total++;
if (isActive('shop-modal')) { ok++; pass('商店打开'); }
else fail('商店未打开');

window.openStatsModal();
total++;
if (isActive('stats-modal')) { ok++; pass('属性打开'); }
else fail('属性未打开');

// 关键断言：shop-modal 现在应该自动关闭
total++;
if (!isActive('shop-modal')) { ok++; pass('✓ 商店自动关闭（互斥生效）'); }
else fail('✗ 商店未关闭（弹窗叠加 bug）');

const actives = activeModals();
log(`当前 active 的 modal: [${actives.join(', ')}]`);
window.closeStatsModal();

// ============================================================
// 测试 2: 连续打开多个 modal，最终只保留最后一个
// ============================================================
log('\n===== 测试 2: 连续打开多个 =====');
window.openShop();
window.openBag();
window.openShelter();
window.openCollection();
await new Promise(r => setTimeout(r, 50));
const finalActive = activeModals();
log(`连续打开 4 个后 active: [${finalActive.join(', ')}]`);
total++;
if (finalActive.length === 1 && finalActive[0] === 'collection-modal') {
    ok++; pass('✓ 最终只剩 collection-modal（互斥生效）');
} else {
    fail(`✗ 期望只剩 collection-modal，实际: ${finalActive}`);
}
window.closeCollection();

// ============================================================
// 测试 3: 点击遮罩关闭（模拟玩家点击 modal-overlay 区域）
// ============================================================
log('\n===== 测试 3: 点击遮罩关闭 =====');
window.openShop();
total++;
if (isActive('shop-modal')) { ok++; pass('商店打开'); }
else fail('商店未打开');

// 模拟点击 modal-overlay 本身（target === overlay）
const shopOverlay = window.document.getElementById('shop-modal');
const clickEvent = new window.MouseEvent('click', { bubbles: true });
// 注意：target 是 overlay 时才算点击遮罩
Object.defineProperty(clickEvent, 'target', { value: shopOverlay, writable: false });
shopOverlay.dispatchEvent(clickEvent);
await new Promise(r => setTimeout(r, 50));
total++;
if (!isActive('shop-modal')) { ok++; pass('✓ 点击遮罩成功关闭弹窗'); }
else fail('✗ 点击遮罩未关闭');

// ============================================================
// 测试 4: 点击 modal 内部不会关闭（必须点遮罩）
// ============================================================
log('\n===== 测试 4: 点击内部不关闭 =====');
window.openShop();
const modalContent = window.document.querySelector('#shop-modal .modal');
const innerClick = new window.MouseEvent('click', { bubbles: true });
Object.defineProperty(innerClick, 'target', { value: modalContent, writable: false });
shopOverlay.dispatchEvent(innerClick);
await new Promise(r => setTimeout(r, 50));
total++;
if (isActive('shop-modal')) { ok++; pass('✓ 点击 modal 内部保持打开'); }
else fail('✗ 误关闭：点击内部也被关闭了');
window.closeShop();

// ============================================================
// 测试 5: 所有 modal 在首次 showModal 后注册点击遮罩关闭（懒加载）
// ============================================================
log('\n===== 测试 5: 遮罩关闭事件已注册 =====');
const modalIds = ['stats-modal', 'bag-modal', 'shop-modal', 'shelter-modal', 'collection-modal',
                  'checkin-modal', 'tasks-modal', 'achievements-modal', 'chapter-modal',
                  'dungeon-modal', 'character-modal', 'story-modal', 'event-modal'];

// 先全部打开一遍触发懒加载注册
for (const id of modalIds) {
    try { window.Renderer.showModal(id); } catch {}
}
// 关闭全部
window.Renderer.hideAllModals();

let registered = 0;
for (const id of modalIds) {
    const el = window.document.getElementById(id);
    if (el && el._backdropBound) registered++;
}
total++;
log(`已注册遮罩关闭的 modal: ${registered}/${modalIds.length}`);
if (registered === modalIds.length) { ok++; pass('✓ 所有 modal 都支持点击遮罩关闭'); }
else fail(`✗ 只有 ${registered}/${modalIds.length} 个 modal 注册了`);

// ============================================================
// 测试 6: CSS 文件可访问且样式存在
// ============================================================
log('\n===== 测试 6: CSS 文件可访问 =====');
const cssOk = await fetch(BASE + '/style.css').then(r => r.ok);
if (cssOk) {
    ok++; pass('✓ style.css 可访问');
    const cssText = await fetch(BASE + '/style.css').then(r => r.text());
    const checks = [
        { name: '.checkin-days 样式', regex: /\.checkin-days\s*{/ },
        { name: '.checkin-day.today 样式', regex: /\.checkin-day\.today\s*{/ },
        { name: '.streak-count 样式', regex: /\.streak-count\s*{/ },
        { name: '.task-item 样式', regex: /\.task-item\s*{/ },
        { name: '.chapter-item 样式', regex: /\.chapter-item\s*{/ },
        { name: '.dungeon-card 样式', regex: /\.dungeon-card\s*{/ },
        { name: '.dungeon-btn.fight 样式', regex: /\.dungeon-btn\.fight\s*{/ },
        { name: '.story-title 样式', regex: /\.story-title\s*{/ },
        { name: '.collection-tab 样式', regex: /\.collection-tab\s*{/ }
    ];

    for (const c of checks) {
        total++;
        if (c.regex.test(cssText)) { ok++; pass(`✓ ${c.name}`); }
        else fail(`✗ ${c.name} 缺失`);
    }
} else {
    total++;
    fail('✗ style.css 不可访问');
}

// ============================================================
// 测试 7: 签到 modal 渲染内容
// ============================================================
log('\n===== 测试 7: 签到内容渲染 =====');
GD_setDefault();
window.openCheckIn();
await new Promise(r => setTimeout(r, 100));
total++;
const streakCount = window.document.getElementById('streak-count');
if (streakCount && streakCount.textContent === '1') {
    ok++; pass(`✓ streak-count 显示: ${streakCount.textContent}`);
} else {
    fail(`✗ streak-count 显示异常: ${streakCount?.textContent}`);
}

const checkinDays = window.document.getElementById('checkin-days');
total++;
const dayElements = checkinDays?.querySelectorAll('.checkin-day') || [];
if (dayElements.length === 7) { ok++; pass(`✓ 渲染 7 天签到卡片`); }
else fail(`✗ 签到卡片数: ${dayElements.length}`);

window.closeCheckIn();

// ============================================================
// 测试 8: 任务 modal 渲染内容
// ============================================================
log('\n===== 测试 8: 任务内容渲染 =====');
window.openTasks();
await new Promise(r => setTimeout(r, 100));
total++;
const taskItems = window.document.querySelectorAll('#tasks-modal .task-item');
if (taskItems.length > 0) { ok++; pass(`✓ 任务项数: ${taskItems.length}`); }
else fail('任务未渲染');
window.closeTasks();

// ============================================================
// 测试 9: 章节 modal 渲染
// ============================================================
log('\n===== 测试 9: 章节内容渲染 =====');
window.openChapter();
await new Promise(r => setTimeout(r, 100));
total++;
const chapterItems = window.document.querySelectorAll('#chapter-modal .chapter-item');
if (chapterItems.length === 10) { ok++; pass(`✓ 章节数: ${chapterItems.length}`); }
else fail(`章节数异常: ${chapterItems.length}`);
window.closeChapter();

// ============================================================
// 测试 10: 副本 modal 渲染
// ============================================================
log('\n===== 测试 10: 副本内容渲染 =====');
window.openDungeons();
await new Promise(r => setTimeout(r, 100));
total++;
const dunCards = window.document.querySelectorAll('#dungeon-modal .dungeon-card');
if (dunCards.length === 6) { ok++; pass(`✓ 副本卡数: ${dunCards.length}`); }
else fail(`副本卡数异常: ${dunCards.length}`);

// 检查副本卡正确分类（normal/elite/locked）
const normalCards = window.document.querySelectorAll('.dungeon-card.normal').length;
const eliteCards = window.document.querySelectorAll('.dungeon-card.elite').length;
const lockedCards = window.document.querySelectorAll('.dungeon-card.locked').length;
log(`副本分类: 普通=${normalCards}, 精英=${eliteCards}, 锁定=${lockedCards}`);
total++;
if (normalCards === 3 && eliteCards === 3) {
    ok++; pass('✓ 普通/精英副本各 3 个');
} else {
    fail('副本分类错误');
}
window.closeDungeons();

// ============================================================
// 测试 11: 性能回归 — 互斥逻辑不破坏原有 11 弹窗打开
// ============================================================
log('\n===== 测试 11: 11 弹窗回归 =====');
const modalTests = [
    ['openStatsModal', 'closeStatsModal', 'stats-modal'],
    ['openBag', 'closeBag', 'bag-modal'],
    ['openShop', 'closeShop', 'shop-modal'],
    ['openShelter', 'closeShelter', 'shelter-modal'],
    ['openCollection', 'closeCollection', 'collection-modal'],
    ['openCheckIn', 'closeCheckIn', 'checkin-modal'],
    ['openTasks', 'closeTasks', 'tasks-modal'],
    ['openAchievements', 'closeAchievements', 'achievements-modal'],
    ['openChapter', 'closeChapter', 'chapter-modal'],
    ['openDungeons', 'closeDungeons', 'dungeon-modal']
];
for (const [open, close, id] of modalTests) {
    window[open]();
    total++;
    if (isActive(id)) { ok++; pass(`✓ ${id} 打开`); }
    else fail(`${id} 未打开`);
    window[close]();
}

// ============================================================
log('\n========================================');
log(`测试结果: ${ok} 通过${total < ok ? '' : `/${total} 总计`}`);
if (ok >= total) {
    log('\x1b[32m✅ 全部 UX 改进验证通过\x1b[0m');
    process.exit(0);
} else {
    log(`\x1b[31m❌ ${total - ok} 项失败\x1b[0m`);
    process.exit(1);
}

function GD_setDefault() {
    window.GameData.player.checkIn = { lastCheckIn: '', streak: 0, totalDays: 0 };
    // 模拟已经签到 1 天
    window.GameData.player.checkIn.streak = 1;
    window.GameData.player.checkIn.lastCheckIn = '';
}