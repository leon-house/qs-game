/**
 * 主入口 - 游戏初始化（接管 HTML 入口）
 * PRD v2: 技能书 + 商店 + 挑战强敌 + 关卡战斗
 */
import { GameData, loadData, saveData, initNewFields } from './data/gameData.js';
import { calculateStats, calculatePower } from './systems/equipment.js';
import {
    startContinuousBattle, stopContinuousBattle, isBattleActive,
    collectRewardPool, getRewardPool, subscribeRewardPool, sweepCurrentChapter,
    startIdleReward, stopIdleReward, updateRewardPoolUI, getIdleRewardState,
    challengeCurrentBoss, backToPrevChapter, restartCurrentBoss, skipCurrentBoss
} from './systems/battle-v2.js';
import { openEquipment, closeEquipment } from './ui/equipment-ui.js';
import { updateUI, showToast } from './ui/ui.js';
import { Renderer } from './core/renderer.js';
import { Timers } from './core/events.js';

// 2026-08-03：删除 stage.js 的 resetBattle（已过时，操作老字段），战斗初始化由 battle-v2.js startContinuousBattle 接管

// 新功能模块（PRD v2）
import * as SkillBooks from './systems/skillbooks.js';
import {
    openShop, closeShop, refreshShop, refreshShopByAd, buyShopItem,
    calcCurrentCharges, startChargesTimer
} from './systems/shop.js';
import {
    openChallenge, closeChallenge, renderChallengeUI,
    addChallengeByAd, startChallenge, listChallengeTiers
} from './systems/challenge.js';
import { watchAd } from './systems/ad.js';

import { calculateSkillBookStats } from './systems/skillbooks.js';

import {
    openStatsModal, closeStatsModal,
    openBag, closeBag, switchBagTab,
    showItemMenu, closeItemMenu,
    openEquipSelect, closeEquipSelect, equipFromSelect, unequipItem,
    showEquipDetail, closeEquipDetail, equipItem, sellItem, decomposeItem
} from './ui/modals.js';

import { openShelter, closeShelter, upgradeShelter } from './systems/shelter.js';
import { openCollection, closeCollection, switchCollectionTab } from './systems/collection.js';
import { openCheckIn, closeCheckIn, doCheckIn } from './systems/checkin.js';
import { openTasks, closeTasks, claimTask, bumpTaskProgress } from './systems/tasks.js';
import { initMainQuest, bumpMainQuest, gotoMainQuest } from './systems/main-quest.js';
import {
    openAchievements, closeAchievements, checkAchievements
} from './systems/achievements.js';
import { openChapter, closeChapter } from './systems/chapter.js';
import {
    openDungeons, closeDungeons, startDungeonAutoBattle, performDungeonAttack, closeDungeonBattle
} from './systems/dungeons.js';
import { closeEvent, claimEventReward, triggerRandomEvent } from './systems/events.js';
import { closeStory, showCurrentChapterStory, showStory } from './systems/story.js';
import { resetDailyTasks } from './systems/tasks.js';

// 2026-08-04 PRD v3：进化所 + 庇护所 modal-v2（Phase 2 新增 3 建筑）
import { openShelterV2, closeShelterV2, switchShelterTab, refreshShelterV2, startShelterTabRefreshTimer } from './systems/shelter-v2.js';
import { upgradeEvolution, calculateEvolutionBonus } from './systems/evolution-lab.js';
import { upgradePowerPlant } from './systems/power-plant.js';
import { startTraining as tgStartTraining, startTrainingTicker, calculateTrainingBonus } from './systems/training-ground.js';
import { upgradeShopLevel } from './systems/shop-level.js';

/**
 * 初始化游戏
 */
// 2026-08-14：C2 修复 — 模块级 setInterval 句柄，防止 init 多次执行时成倍累积
let sweepCornerTimerId = null;
let rewardPoolUiTimerId = null;

// 绑定所有 .modal-overlay 的"点击空白处关闭"
function bindModalOverlayClose() {
    // 不参与统一关闭的 modal：战斗中的（防止误关丢失奖励）+ 有自定义关闭逻辑的
    const noCloseIds = new Set([
        'dungeon-battle-modal',     // 副本战斗中
        'challenge-battle-modal',   // 挑战战斗中
        'equip-detail-modal',       // 自带 onclick="if(event.target===this) closeEquipDetail()"（清理动态 backdrop）
    ]);
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        if (overlay.dataset.closeBound === '1') return;
        overlay.dataset.closeBound = '1';
        if (noCloseIds.has(overlay.id)) return;
        overlay.addEventListener('click', (e) => {
            // 只在点击的是遮罩本身（不是子元素 .modal）时关闭
            if (e.target === overlay) {
                Renderer.hideModal(overlay.id);
            }
        });
    });
}

function init() {
    try {
        loadData();
        initNewFields();

        // 2026-08-03：新手礼包（首次进入发放 100 金币 + 5 片白碎片 + 3 次刷新机会）
        try { grantStarterPack(); } catch (e) { console.warn('grantStarterPack:', e.message); }

        try { updateUI(); } catch (e) { console.warn('updateUI:', e.message); }
        try { initIdleSystem(); } catch (e) { console.warn('initIdleSystem:', e.message); }
        try { resetDailyTasks(); } catch (e) { console.warn('resetDailyTasks:', e.message); }
        try { initMainQuest(); } catch (e) { console.warn('initMainQuest:', e.message); }
        try { checkAchievements(); } catch (e) { console.warn('checkAchievements:', e.message); }
        try { calculatePower(); } catch (e) { console.warn('calculatePower:', e.message); }

        // 商店 charges 倒计时
        try { startChargesTimer(); } catch (e) { console.warn('startChargesTimer:', e.message); }

        // 单角色（4 职业已砍）：旧存档没有 characterType 时补默认值
        if (!GameData.player.characterType) {
            GameData.player.characterType = 'survivor';
        }

        // V2 自动战斗：v25c 改成立即启动（之前 setTimeout 800ms 让用户感觉"战斗区渲染慢"）
        // 1. 同步立即启动战斗 canvas（高优先级）
        const canvasEl = document.getElementById('battle-canvas');
        console.log('[Init] battle-canvas element:', canvasEl, 'w=', canvasEl?.width, 'h=', canvasEl?.height);
        if (canvasEl && typeof startContinuousBattle === 'function') {
            startContinuousBattle(canvasEl);
        } else {
            console.error('[Init] 找不到 battle-canvas 或 startContinuousBattle 未定义');
        }
        // 2. 扫荡按钮 + 章节监听放到下个 frame（不阻塞首屏）
        requestAnimationFrame(() => {
            renderSweepCorner();
            // 2026-08-14：C2 修复 — 用模块级变量守卫，HMR / 重复 init 时不重复创建
            if (!sweepCornerTimerId) sweepCornerTimerId = setInterval(renderSweepCorner, 2000);

            // 3. 剧情弹窗延后到战斗跑起来后再触发（不能阻塞首屏）
            const shown = GameData.player.lastStoryShownLevel;
            const cur = GameData.player.bossLevel || 0;
            if (shown === undefined || shown < cur) {
                setTimeout(() => {
                    try {
                        import('./systems/story.js').then(m => {
                            m.showCurrentChapterStory();
                            GameData.player.lastStoryShownLevel = cur;
                            saveData();
                        });
                    } catch (e) { console.warn('[story]', e); }
                }, 1500);
            }
        });

        // 启动挂机自动奖励 + 奖励池倒计时 UI（每 1s 刷一次）
        try {
            startIdleReward();
            updateRewardPoolUI();
            // 2026-08-14：C2 修复 — 同样用模块级守卫
            if (!rewardPoolUiTimerId) rewardPoolUiTimerId = setInterval(updateRewardPoolUI, 1000);
        } catch (e) { console.warn('[idle-reward]', e); }

        // 将 HTML 里所有 <i data-lucide="..."> 渲染成 SVG（首页 HUD + 状态条都用 lucide）
        setTimeout(() => {
            try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch (e) { console.warn('lucide:', e.message); }
        }, 50);

        // 绑定"点击空白处关闭弹窗"（统一处理所有 .modal-overlay，排除战斗中 modal）
        bindModalOverlayClose();

        // 监听奖励池累积事件 → "提取"按钮闪动 + 数字 bounce（粒子飞到位时高亮）
        try {
            subscribeRewardPool((d) => {
                const btn = document.querySelector('.collect-btn');
                if (btn) {
                    btn.classList.remove('pulse');   // restart animation
                    void btn.offsetWidth;
                    btn.classList.add('pulse');
                }
                // v22：更新成就下面侧栏"提取收益"徽章（金币累积数）
                const badge = document.getElementById('collect-pending-badge');
                if (badge) {
                    const total = (d.pendingCoins | 0);
                    if (total > 0) {
                        badge.textContent = total > 9999 ? Math.floor(total / 1000) + 'k' : String(total);
                        badge.hidden = false;
                    } else {
                        badge.hidden = true;
                    }
                }
            });
        } catch (e) { console.warn('[reward-pool-subscribe]', e); }

        console.log('[Game] 初始化成功（PRD v2 · 技能书 + 商店 + 挑战）');
    } catch (e) {
        console.error('[Game] 初始化失败:', e);
        const toast = Renderer.create('div', {
            style: 'position:fixed;top:0;left:0;right:0;background:red;color:white;padding:16px;z-index:9999;font-size:12px;',
            text: '初始化错误: ' + e.message
        });
        document.body.appendChild(toast);
    }
}

/**
 * 挂机系统（统一通过 Timers 管理）
 */
function initIdleSystem() {
    let lastTick = Date.now();
    Timers.set(() => {
        const now = Date.now();
        const delta = (now - lastTick) / 1000;
        lastTick = now;
        const income = getIdleIncome();
        GameData.player.gold = (GameData.player.gold || 0) + income;
        // PRD v3 · 2026-08-04：挂机每 30 分钟 +1 进化胶囊
        GameData.player.idleAccumMs = (GameData.player.idleAccumMs || 0) + delta * 1000;
        if (GameData.player.idleAccumMs >= 30 * 60 * 1000) {
            GameData.player.idleAccumMs -= 30 * 60 * 1000;
            if (!GameData.player.materials) GameData.player.materials = { advancedEnergy: 0, evolutionCapsules: 0, powerManual: 0, techniqueManual: 0, experienceManual: 0 };
            GameData.player.materials.evolutionCapsules = (GameData.player.materials.evolutionCapsules || 0) + 1;
        }
        saveData();
        try { updateUI(); } catch (_) {}
    }, 5000);
}

function getIdleIncome() {
    // PRD v3 · 2026-08-04：基础收入 + 庇护所等级 + 技能书潜行 + 发电站倍率 + 发电站等级
    const p = GameData.player;
    const base = 1 + Math.floor((p.shelterLevel || 1) * 0.5);
    let idleMul = 1;
    try {
        if (typeof calculateStats === 'function') {
            const stats = calculateStats();
            idleMul = 1 + (stats.idleSpeed || 0);
        }
    } catch (_) {}
    // 新增：发电站倍率
    const ppMul = p.powerPlant?.offlineMultiplier || 1.0;
    const ppLvBonus = 1 + ((p.powerPlant?.level || 1) - 1) * 0.02;  // 每级 +2%
    return Math.floor(base * idleMul * ppMul * ppLvBonus);
}

/**
 * 一键扫荡角落 UI 更新
 * 2026-08-05 v25c：状态机和功能对齐
 * - ch < 1：禁用 + "请先通关第 1 章"
 * - ch >= 1 + 战斗中：可用 + "扫荡第 N 章剩余怪物"
 * - ch >= 1 + 战斗未启动：可用（金黄）+ "战斗未启动，点击启动并扫荡"
 */
function renderSweepCorner() {
    const chEl = document.getElementById('sweep-chapter');
    const btn = document.getElementById('sweep-btn');
    if (!chEl || !btn) return;
    const ch = GameData.player.bossLevel || 0;
    const idx = window.__battleV2State?.currentEnemyIndex || 0;
    chEl.textContent = `第 ${ch} 章`;
    // 放宽限制：至少打过 1 只怪就能扫（与 sweepCurrentChapter 保持一致）
    if (idx < 1) {
        btn.disabled = true;
        btn.title = '请先打完当前章节的第 1 只怪';
    } else if (!isBattleActive()) {
        btn.disabled = false;
        btn.title = `战斗未启动，点击启动并扫荡第 ${ch} 章`;
    } else {
        btn.disabled = false;
        btn.title = `扫荡第 ${ch} 章剩余怪物`;
    }
}

/**
 * 战斗按钮：滚到顶部 + 关掉所有 modal
 */
function goHome() {
    document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ========================================================================
// 暴露 window 全局（兼容 HTML onclick 调用）
// ========================================================================

// 战斗（2026-08-03：resetBattle 已删除；战斗初始化由 battle-v2.js startContinuousBattle 接管）
window.collectRewardPool = (args) => { const r = collectRewardPool(args); bumpTaskProgress('collect_idle'); bumpMainQuest('collect_idle'); return r; };
window.gotoMainQuest = gotoMainQuest;

// 提取收益 modal（v22：成就下面侧栏入口 → 二级确认弹窗）
window.openCollectModal = function () {
    const pool = getRewardPool();
    const coinsEl = document.getElementById('collect-pending-coins');
    const expEl   = document.getElementById('collect-pending-exp');
    const confirmBtn = document.getElementById('collect-confirm-btn');
    const empty = (pool.pendingCoins | 0) === 0 && (pool.pendingExp | 0) === 0;
    if (coinsEl) coinsEl.textContent = String(pool.pendingCoins | 0);
    if (expEl)   expEl.textContent   = String(pool.pendingExp | 0);
    if (confirmBtn) {
        if (empty) {
            confirmBtn.disabled = true;
            confirmBtn.classList.add('is-empty');
        } else {
            confirmBtn.disabled = false;
            confirmBtn.classList.remove('is-empty');
        }
    }
    showModal('collect-rewards-modal');
    try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch (_) {}
};
window.closeCollectModal = () => hideModal('collect-rewards-modal');
window.confirmCollectRewards = function () {
    const pool = getRewardPool();
    if ((pool.pendingCoins | 0) === 0 && (pool.pendingExp | 0) === 0) {
        showToast('奖励池是空的', 'info');
        hideModal('collect-rewards-modal');
        return;
    }
    window.collectRewardPool();
    hideModal('collect-rewards-modal');
};
window.sweepCurrentChapter = sweepCurrentChapter;
window.goHome = goHome;
window.challengeCurrentBoss = () => { const r = challengeCurrentBoss(); bumpTaskProgress('challenge_boss'); bumpMainQuest('challenge_boss'); return r; };
window.backToPrevChapter = backToPrevChapter;
window.restartCurrentBoss = restartCurrentBoss;
window.skipCurrentBoss = skipCurrentBoss;
// 装备（v25e：openEquipment 包装 bump guide_equipment 指引任务进度）
window.openEquipment = () => { const r = openEquipment(); bumpTaskProgress('guide_equipment'); bumpMainQuest('guide_equipment'); return r; };
window.closeEquipment = closeEquipment;
// 挂机奖励
window.startIdleReward = startIdleReward;
window.stopIdleReward = stopIdleReward;
window.updateRewardPoolUI = updateRewardPoolUI;
window.getIdleRewardState = getIdleRewardState;

// 技能书
window.openSkillBook = SkillBooks.openSkillBook;
window.closeSkillBook = SkillBooks.closeSkillBook;
window.upgradeSkillBook = (bookKey) => SkillBooks.upgradeSkillBook(bookKey);
window.synthBook = (q, s) => SkillBooks.synthesizeBook(q, s);
window.synthAllShards = () => SkillBooks.synthesizeAllPossible();
window.renderSkillBookUI = () => SkillBooks.renderSkillBookUI();

// 商店
window.openShop = openShop;
window.closeShop = closeShop;
window.refreshShop = refreshShop;
window.refreshShopByAd = refreshShopByAd;
window.buyShopItem = (idx) => { const r = buyShopItem(idx); bumpTaskProgress('buy_thing'); bumpMainQuest('buy_thing'); return r; };
window.calcCurrentCharges = calcCurrentCharges;

// 挑战
window.openChallenge = openChallenge;
window.closeChallenge = closeChallenge;
window.renderChallengeUI = renderChallengeUI;
window.addChallengeByAd = addChallengeByAd;
window.startChallenge = startChallenge;
window.listChallengeTiers = listChallengeTiers;

// 广告占位
window.watchAd = watchAd;

// 弹窗（保留一些旧的）
window.openStatsModal = openStatsModal;
window.closeStatsModal = closeStatsModal;
window.openBag = openBag;
window.closeBag = closeBag;
window.switchBagTab = switchBagTab;
window.showItemMenu = showItemMenu;
window.closeItemMenu = closeItemMenu;
window.openEquipSelect = openEquipSelect;
window.closeEquipSelect = closeEquipSelect;
window.equipFromSelect = equipFromSelect;
window.unequipItem = unequipItem;
window.showEquipDetail = showEquipDetail;
window.closeEquipDetail = closeEquipDetail;
window.equipItem = equipItem;
// v equip-refactor-20261008b：sellItem / decomposeItem 都包装 sell_thing 任务钩子（modals.js 里的版本不依赖 window.bumpTaskProgress）
window.sellItem = (idx) => { const r = sellItem(idx); bumpTaskProgress('sell_thing'); bumpMainQuest('sell_thing'); return r; };
window.decomposeItem = (idx) => { const r = decomposeItem(idx); bumpTaskProgress('sell_thing'); bumpMainQuest('sell_thing'); return r; };
window.showStory = showStory;
window.closeStory = closeStory;
window.showCurrentChapterStory = showCurrentChapterStory;

// 庇护所
window.openShelter = openShelter;
window.closeShelter = closeShelter;
window.upgradeShelter = upgradeShelter;

// 图鉴
window.openCollection = openCollection;
window.closeCollection = closeCollection;
window.switchCollectionTab = switchCollectionTab;

// 签到 / 任务 / 成就 / 章节 / 副本
window.openCheckIn = openCheckIn;
window.closeCheckIn = closeCheckIn;
window.doCheckIn = () => { const r = doCheckIn(); bumpTaskProgress('daily_checkin'); return r; };
window.openTasks = openTasks;
window.closeTasks = closeTasks;
window.claimTask = claimTask;
window.openAchievements = openAchievements;
window.closeAchievements = closeAchievements;
window.checkAchievements = checkAchievements;
window.openChapter = openChapter;
window.closeChapter = closeChapter;
window.openDungeons = openDungeons;
window.closeDungeons = closeDungeons;
window.startDungeonAutoBattle = startDungeonAutoBattle;
window.performDungeonAttack = performDungeonAttack;
window.closeDungeonBattle = closeDungeonBattle;

// 事件 / 剧情
window.closeEvent = closeEvent;
window.claimEventReward = claimEventReward;
window.triggerRandomEvent = triggerRandomEvent;

// 启动
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Lucide Icons
function tryRenderLucide() {
    if (typeof lucide !== 'undefined') {
        try { lucide.createIcons(); } catch (e) { console.warn('lucide:', e.message); }
    } else {
        setTimeout(tryRenderLucide, 100);
    }
}
if (document.readyState === 'complete') {
    setTimeout(tryRenderLucide, 50);
} else {
    window.addEventListener('load', () => setTimeout(tryRenderLucide, 50));
}

// 模态 helper
function showModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
}
function hideModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
}

/**
 * 2026-08-03 新手礼包：首次进入发放 100 金币 + 5 片白碎片 + 3 次刷新
 *   - 老存档（gold > 0）跳过，不影响存档
 *   - 用 starterPackGranted 标记，只发一次
 *   - showToast 提示玩家"已收到新手礼包"
 */
function grantStarterPack() {
    const p = GameData.player;
    if (p.starterPackGranted) return;  // 已发过
    // 触发条件：玩家没有任何金币且 never 领取过
    if ((p.gold || 0) > 0) {
        p.starterPackGranted = true;
        return;
    }
    p.gold = (p.gold || 0) + 100;
    // 5 片白碎片（猛力·攻击）让玩家立刻能合成一本
    if (!p.skillShards) p.skillShards = {};
    p.skillShards['white_atk_power'] = (p.skillShards['white_atk_power'] || 0) + 5;
    // 商店 3 次刷新机会
    if (!p.shop) p.shop = { charges: 3, lastRefreshTick: 0, shopItems: [] };
    p.shop.charges = Math.max(p.shop.charges || 0, 3);
    p.starterPackGranted = true;
    saveData();
    // 延迟 1.5s 弹剧情后再 toast，避免剧情 modal 挡住
    setTimeout(() => {
        if (typeof showToast === 'function') {
            showToast('🎁 新手礼包：100 金币 + 5 攻击碎片 + 3 刷新', 'success');
        }
    }, 1800);
}

// 资源条已删除（2026-07-28）：顶部资源栏无 UI 入口，refreshResourceBar 是死代码

// 2026-08-03：删除 openBuildings 占位（buildings.js 死代码已删，底栏"建筑"按钮已替换为"签到"）
// 设置
window.openSettings = function () {
    const last = new Date(GameData.player.lastOnlineTime || Date.now()).toLocaleString('zh-CN');
    const el = document.getElementById('last-online');
    if (el) el.textContent = last;
    showModal('settings-modal');
    if (typeof lucide !== 'undefined') lucide.createIcons();
};
window.closeSettings = () => hideModal('settings-modal');

// 2026-08-04 PRD v3：庇护所 v2 + 进化所（升级后自动刷新 modal）
window.upgradeEvolutionWithRefresh = function () {
    const ok = upgradeEvolution();
    if (ok) {
        try { refreshShelterV2(); } catch (_) {}
        try { updateUI(); } catch (_) {}
    }
    return ok;
};

// Phase 2：发电站升级 + 刷新
window.upgradePowerPlantWithRefresh = function () {
    const ok = upgradePowerPlant();
    if (ok) {
        try { refreshShelterV2(); } catch (_) {}
        try { updateUI(); } catch (_) {}
    }
    return ok;
};

// Phase 2：训练场开始训练 + 刷新
window.startTrainingWithRefresh = function (direction) {
    const ok = tgStartTraining(direction);
    if (ok) {
        try { refreshShelterV2(); } catch (_) {}
    }
    return ok;
};

// Phase 2：商店等级升级 + 刷新
window.upgradeShopLevelWithRefresh = function () {
    const ok = upgradeShopLevel();
    if (ok) {
        try { refreshShelterV2(); } catch (_) {}
    }
    return ok;
};

// 启动训练 ticker + tab 实时刷新
try { startTrainingTicker(); } catch (_) {}
try { startShelterTabRefreshTimer(); } catch (_) {}
