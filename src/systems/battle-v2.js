/**
 * 战斗系统 V2 · 持续自动战斗 + Canvas 物理 + 奖励池
 *
 * 与现有 battle.js 共存（V1 处理一次性远征，V2 处理持续自动战斗）
 *
 * 流程：
 *   1. startContinuousBattle() 启动后自动循环
 *   2. 每 0.8s 角色自动攻击 1 次（通过 battle.js 算伤害）
 *   3. 怪物死亡后，Canvas 上角色走 1 个身位（30px）
 *   4. 移动到下一只怪物，开始下一场战斗
 *   5. 每击败 1 只怪，金币 + 经验进奖励池（不进玩家账户）
 *   6. 玩家主动点"收获"按钮，把奖励池领到背包
 *   7. 遇到 Boss：体型放大 + 红光晕
 *   8. Boss 死后，整章完成 → 切下一章
 */

import { GameData, saveData } from '../data/gameData.js';
import { showToast, updateUI } from '../ui/ui.js';
import { calculateStats } from './equipment.js';
import { CHALLENGE_TIERS } from '../data/config.js';

/**
 * 获取当前 goldFind 倍数（2026-08-03：技能书"掘金"接入）
 *   返回 1.5 = +50% 金币；1.0 表示无加成
 */
function getGoldFindMultiplier() {
    try {
        const stats = calculateStats();
        return 1 + (stats.goldFind || 0);
    } catch (_) {
        return 1;
    }
}

/**
 * 获取当前 idleSpeed 倍数（2026-08-03：技能书"潜行"接入挂机收益）
 *   返回 1.5 = 挂机金币 +50%
 */
function getIdleSpeedMultiplier() {
    try {
        const stats = calculateStats();
        return 1 + (stats.idleSpeed || 0);
    } catch (_) {
        return 1;
    }
}

import { initBattleCanvas, startBattle as canvasStartBattle,
    onDamageDealt, stopBattle as canvasStopBattle, on, getBattleState } from './battle-canvas.js';
import { showCurrentChapterStory } from './story.js';

// ============ 奖励池状态 ============
const rewardPool = {
    pendingCoins: 0,
    pendingExp: 0,
    listeners: []
};

export function getRewardPool() {
    return { pendingCoins: rewardPool.pendingCoins, pendingExp: rewardPool.pendingExp };
}

export function subscribeRewardPool(fn) {
    rewardPool.listeners.push(fn);
    fn(getRewardPool());
    return () => {
        const i = rewardPool.listeners.indexOf(fn);
        if (i >= 0) rewardPool.listeners.splice(i, 1);
    };
}

function notifyRewardPool() {
    const data = getRewardPool();
    rewardPool.listeners.forEach(fn => fn(data));
}

export function addToRewardPool(coins, exp) {
    // 纯累积：金币 + 经验都进奖励池，等玩家手动点"📥 收获"才进背包
    // 这样保留挂机 RPG 的核心交互感（看着数字累积 → 一把收取）
    // 2026-08-03：金币应用技能书"掘金"（goldFind）倍率
    const goldMul = getGoldFindMultiplier();
    if (coins > 0) rewardPool.pendingCoins += Math.floor(coins * goldMul);
    if (exp > 0) rewardPool.pendingExp += exp;
    notifyRewardPool();
}

// ============ 挂机自动奖励（每 TICK_INTERVAL 秒给奖励池累加） ============
// 用户口径（2026-07-28 17:00）：
//   ① 奖励池会随时间自动增加奖励（不战斗也涨）
//   ② 玩家点 "📥 收获" 后 10 秒才重新开始累加
export const IDLE_REWARD_CONFIG = {
    tickIntervalMs: 10_000,   // 每 10 秒发放一次
    coinsPerTick: 20,         // 每次 +20 金币
    expPerTick: 10,           // 每次 +10 经验
    restartDelayMs: 10_000,   // 收获后 10 秒才重新启动
};

let idleRewardTimer = null;
let idleRewardNextAt = 0;        // 下次发放的 timestamp (ms)
let idleRewardPaused = false;    // 收获后暂停中

/**
 * 启动挂机奖励定时器（页面 init 时调用一次）
 *   - 首次进入 10 秒后发第一次
 *   - 之后每 10 秒发一次
 *   - 玩家点 collectRewardPool 后会暂停 10 秒
 */
export function startIdleReward() {
    if (idleRewardTimer) return;
    idleRewardNextAt = Date.now() + IDLE_REWARD_CONFIG.tickIntervalMs;
    idleRewardPaused = false;
    idleRewardTimer = setInterval(() => {
        if (idleRewardPaused) return;
        if (Date.now() < idleRewardNextAt) return;
        // 到点：发放 + 重置下个 tick
        // 2026-08-03：挂机金币应用技能书"潜行"（idleSpeed）倍率
        const idleMul = getIdleSpeedMultiplier();
        addToRewardPool(
            Math.floor(IDLE_REWARD_CONFIG.coinsPerTick * idleMul),
            IDLE_REWARD_CONFIG.expPerTick
        );
        idleRewardNextAt = Date.now() + IDLE_REWARD_CONFIG.tickIntervalMs;
        if (typeof updateRewardPoolUI === 'function') updateRewardPoolUI();
    }, 1000);  // 每秒检查一次（精度足够）
    if (typeof updateRewardPoolUI === 'function') updateRewardPoolUI();
}

export function stopIdleReward() {
    if (idleRewardTimer) {
        clearInterval(idleRewardTimer);
        idleRewardTimer = null;
    }
}

/** 收获后 10 秒再启动 */
let idlePauseTimerId = null;
function pauseIdleReward() {
    idleRewardPaused = true;
    idleRewardNextAt = Date.now() + IDLE_REWARD_CONFIG.restartDelayMs;
    if (typeof updateRewardPoolUI === 'function') updateRewardPoolUI();
    // 2026-08-14：L1 修复 — 用模块级 id 记录，连点"提取"会取消上一个 timer 而非覆盖 paused 状态
    if (idlePauseTimerId !== null) clearTimeout(idlePauseTimerId);
    idlePauseTimerId = setTimeout(() => {
        idlePauseTimerId = null;
        idleRewardPaused = false;
        idleRewardNextAt = Date.now() + IDLE_REWARD_CONFIG.tickIntervalMs;
        if (typeof updateRewardPoolUI === 'function') updateRewardPoolUI();
    }, IDLE_REWARD_CONFIG.restartDelayMs);
}

export function getIdleRewardState() {
    const now = Date.now();
    return {
        paused: idleRewardPaused,
        nextAt: idleRewardNextAt,
        secondsLeft: Math.max(0, Math.ceil((idleRewardNextAt - now) / 1000)),
        coinsPerTick: IDLE_REWARD_CONFIG.coinsPerTick,
        expPerTick: IDLE_REWARD_CONFIG.expPerTick,
    };
}

export function collectRewardPool() {
    if (rewardPool.pendingCoins === 0 && rewardPool.pendingExp === 0) {
        showToast('奖励池是空的', 'info');
        return;
    }
    const c = rewardPool.pendingCoins;
    const e = rewardPool.pendingExp;
    const p = GameData.player;
    // 金币（同时存 wasteCoin 让远征本局可见；gold 旧字段保留兼容）
    p.gold = (p.gold || 0) + c;
    if (GameData.expeditionRun) {
        GameData.expeditionRun.wasteCoin = (GameData.expeditionRun.wasteCoin || 0) + c;
    }
    // 经验 → 升级（同步 characterLevel 和 characterStars 影响战斗属性）
    p.currentExp = (p.currentExp || 0) + e;
    p.exp = (p.exp || 0) + e;  // 旧字段也保留
    let leveledUp = 0;
    while (p.currentExp >= p.expToNext) {
        p.currentExp -= p.expToNext;
        p.characterLevel = (p.characterLevel || 1) + 1;
        p.level = p.characterLevel;                       // 同步旧字段（UI 显示）
        p.expToNext = Math.floor((p.expToNext || 100) * 1.2);  // 每级递增 20%
        leveledUp++;
        // 每 10 级自动升 1 星（PRD：满级后下一颗星）
        if (p.characterLevel > 0 && p.characterLevel % 10 === 0) {
            p.characterStars = (p.characterStars || 0) + 1;
        }
    }
    // 清空奖励池
    rewardPool.pendingCoins = 0;
    rewardPool.pendingExp = 0;
    // 重置挂机时间（新一轮挂机开始计时）
    p.idleStartTime = Date.now();
    notifyRewardPool();
    saveData();
    if (typeof updateUI === 'function') updateUI();
    // 收获后暂停 10 秒再启动挂机累加
    pauseIdleReward();
    let msg = `已收获 +${c} 金币 · +${e} 经验`;
    if (leveledUp > 0) {
        msg += ` · 升级！Lv.${p.characterLevel}`;
        if (p.characterStars > 0 && p.characterLevel % 10 === 0) {
            msg += ` ★+1`;
        }
    }
    showToast(msg, 'success');
}

// ============ 挂机时间（替代原"收获倒计时"，最大 8 小时） ============
export const MAX_IDLE_SECONDS = 8 * 3600;

/** 当前轮次已挂机秒数（封顶 8 小时） */
export function getCurrentIdleSeconds() {
    const p = GameData.player;
    if (!p) return 0;
    if (p.idleStartTime === undefined) p.idleStartTime = Date.now();
    const elapsed = Math.floor((Date.now() - p.idleStartTime) / 1000);
    return Math.max(0, Math.min(MAX_IDLE_SECONDS, elapsed));
}

/** 把秒数格式化成 HH:MM:SS（最多 8 小时 → 永远 ≤ 08:00:00） */
function formatHMS(totalSec) {
    const s = Math.max(0, Math.floor(totalSec));
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

/** 给 HTML UI 用的：刷新奖励池显示 + 挂机时间 */
export function updateRewardPoolUI() {
    const coinEl = document.getElementById('reward-coins');
    const expEl = document.getElementById('reward-exp');
    if (coinEl) coinEl.textContent = String(rewardPool.pendingCoins);
    if (expEl) expEl.textContent = String(rewardPool.pendingExp);
    // 挂机时间（替代原"⏱ 下次 +奖励倒计时"，最大 8 小时）
    // v25：去掉 "/ 08:00:00" 上限文字（移动端会撑爆 reward-bar），改用 title 提示
    const idleEl = document.getElementById('reward-idle-time');
    if (idleEl) {
        const secs = getCurrentIdleSeconds();
        idleEl.textContent = formatHMS(secs);
        idleEl.title = `已挂机 ${formatHMS(secs)} / 上限 08:00:00`;
    }
}

// ============ 战斗流程控制 ============
const state = {
    active: false,
    currentEnemyIndex: 0,
    enemies: [],
    currentEnemy: null,
    nextAttackAt: 0,           // 下次攻击的 timestamp（2026-07-30：按 attackSpeed 计算）
    interval: null,
    canvasInited: false,
    movingToNext: false,
    bossReached: false,
    chapterComplete: false,
    // 2026-08-14：关底 Boss 失败冷却 — 必须再击杀 N 只小怪才能再次挑战
    // 设计动机：防止玩家无限重试卡关，强制留出"我该升级装备/技能"的思考窗口
    bossCooldownActive: false,
    bossCooldownKills: 0,
    bossCooldownRequired: 5,   // [PLACEHOLDER] 默认冷却：杀 5 只小怪
};

// ============ 关底 Boss 失败冷却（v boss-cooldown-20260814d）============
// 触发：challenge.js 的 onBattleLose() 在 30 秒超时/挑战失败后调用 startBossCooldown()
// 效果：boss-card 进入 "cooldown" 状态，挑战按钮隐藏，强制玩家刷小怪
// 解除：杀够 N 只普通怪（enemy-killed 事件里累计），或玩家主动跳过（skipCurrentBoss → backToPrevChapter）
export function startBossCooldown(killsRequired = 5) {
    if (!initBossCooldownListener._done) initBossCooldownListener();
    state.bossCooldownActive = true;
    state.bossCooldownKills = 0;
    state.bossCooldownRequired = Math.max(1, killsRequired | 0);
    renderBossCooldownUI();
}

export function endBossCooldown() {
    if (!state.bossCooldownActive) return;
    state.bossCooldownActive = false;
    state.bossCooldownKills = 0;
    renderBossCooldownUI();
}

export function isBossCooldown() {
    return state.bossCooldownActive;
}

/** 订阅 enemy-killed 事件，累计冷却进度（仅普通怪计入，boss 击杀不计入冷却） */
function initBossCooldownListener() {
    if (initBossCooldownListener._done) return;
    initBossCooldownListener._done = true;
    window.addEventListener('enemy-killed', (e) => {
        if (!state.bossCooldownActive) return;
        if (e && e.detail && e.detail.isBoss) return;     // boss 击杀不算冷却
        state.bossCooldownKills++;
        renderBossCooldownUI();
        if (state.bossCooldownKills >= state.bossCooldownRequired) {
            endBossCooldown();
            showToast('⚔️ Boss 挑战冷却结束，可以再次挑战！', 'success');
        }
    });
}

/** 把冷却状态写到 boss-card DOM 上（避免每个调用方都自己拼 DOM） */
function renderBossCooldownUI() {
    const card = document.getElementById('boss-card');
    const subEl = document.getElementById('boss-card-sub');
    const challengeBtn = document.querySelector('.boss-btn-challenge');

    if (state.bossCooldownActive) {
        // 冷却中：data-state="cooldown"，隐藏挑战按钮
        if (card) card.dataset.state = 'cooldown';
        const remaining = Math.max(0, state.bossCooldownRequired - state.bossCooldownKills);
        if (subEl) subEl.textContent = `⏳ 再击杀 ${remaining}/${state.bossCooldownRequired} 只小怪`;
        if (challengeBtn) challengeBtn.hidden = true;
    } else {
        // 解除：恢复 boss-card 到 pending 状态，挑战按钮亮起
        if (card) card.dataset.state = state.bossReached ? 'pending' : 'idle';
        // 副标题恢复 Boss 信息（Lv + HP）
        const boss = state.enemies && state.enemies.length
            ? state.enemies[state.enemies.length - 1]
            : null;
        if (subEl && boss && boss.boss) {
            subEl.textContent = `Lv.${boss.level || 1} · HP ${boss.maxHp}`;
        } else if (subEl) {
            subEl.textContent = '下一波来袭';
        }
        if (challengeBtn) challengeBtn.hidden = false;
    }
}

// 怪物类型模板（与 stage.js 配合）
const ENEMY_NAMES = ['丧尸', '变异犬', '巨鼠', '暗影', '骷髅', '蜘蛛', '蝾螈', '机械狗', '野猪', '蛇'];
const ENEMY_TYPE_FILES = ['zombie', 'dog', 'rat', 'shadow', 'skeleton', 'spider', 'lizard', 'cyberdog', 'boar', 'snake'];

/**
 * 每章 ENEMIES_PER_CHAPTER 个普通怪（2026-07-30 重构：去 defense，Boss 不在本章战斗）
 *   普通战斗：角色只对怪物造成伤害，不再受击
 *   Boss 出现时弹卡片 → 调 challenge.js 的 startChallenge()（30 秒倒计时）
 */
export const ENEMIES_PER_CHAPTER = 10;
function generateEnemiesForChapter(chapter) {
    const list = [];
    // 怪物等级 = chapter + 1（章节 0 的怪 Lv.1，章节 5 的怪 Lv.6）
    const monsterLevel = chapter + 1;
    for (let i = 0; i < ENEMIES_PER_CHAPTER; i++) {
        const idx = (chapter * 7 + i) % ENEMY_NAMES.length;
        // 怪物血量曲线（章节数大幅影响）+ 攻击力不再有意义（不再反击），但保留字段方便 log
        const baseHp = 30 + i * 8 + chapter * 50;
        list.push({
            name: ENEMY_NAMES[idx],
            type: ENEMY_TYPE_FILES[idx],
            level: monsterLevel,    // 章节挂钩的等级
            maxHp: baseHp,
            attack: 0,              // 已废：不再反击玩家
            defense: 0,             // 已废：玩家攻击不再减防御
            coins: 4 + Math.floor(i / 4) * 2,
            exp: 3 + Math.floor(i / 3),
            boss: false
        });
    }
    // Boss（每个章节末尾都有，对应 CHALLENGE_TIERS 里同章节数的 Boss）
    const BOSS_NAMES = ['污染巨兽', '辐射领主', '废土之王', '感染母体', '机械独裁者'];
    const variant = chapter % BOSS_NAMES.length;
    // 2026-08-03：从 CHALLENGE_TIERS 取真实 HP（按章节对应 unlockChapter）
    //   章节 0 → giant_zombie (HP 250) / 章节 2 → mutant_bear (HP 800) / 章节 4 → mech_golem (HP 2000) / ...
    const bossTier = CHALLENGE_TIERS.find(t => t.unlockChapter === chapter + 1) || CHALLENGE_TIERS[Math.min(variant, CHALLENGE_TIERS.length - 1)];
    list.push({
        name: BOSS_NAMES[variant],
        type: 'shadow',
        bossVariant: variant,           // Canvas drawBoss 用此切换造型
        level: monsterLevel + 1,        // Boss 等级比章节怪高 1
        maxHp: bossTier.baseHp,           // 取自 CHALLENGE_TIERS（不再是 99999 占位）
        attack: 0,
        defense: 0,
        coins: bossTier.goldReward,
        exp: bossTier.expReward,
        boss: true,
        tierId: bossTier.id,             // 真实 tier id，方便后续跳转挑战
    });
    return list;
}

// ============ 启动持续战斗 ============
export function startContinuousBattle(canvasEl) {
    console.log('[BattleV2] startContinuousBattle called, canvasEl =', canvasEl);
    // 初始化 Canvas 一次
    if (!state.canvasInited) {
        initBattleCanvas(canvasEl, (data) => {
            // Canvas 通知：奖励或击中
            if (data.coins !== undefined || data.exp !== undefined) {
                addToRewardPool(data.coins || 0, data.exp || 0);
                // 每只怪入池时即 +1 击杀（收获前已生效，避免合并累加误差）
                GameData.player.totalKills = (GameData.player.totalKills || 0) + 1;
                if (data.boss) {
                    if (!GameData.player.expedition) GameData.player.expedition = { currentArea: 'suburb', clearedAreas: [], totalBossKills: 0 };
                    GameData.player.expedition.totalBossKills = (GameData.player.expedition.totalBossKills || 0) + 1;
                }
            }
        });
        state.canvasInited = true;
        console.log('[BattleV2] canvas initialized');
    }

    // 监听 Canvas 关键事件
    on('autoAttack', () => {
        if (state.currentEnemy && state.active && !state.movingToNext) {
            playerAttackCurrentEnemy();
        }
    });
    on('reachedNext', () => {
        // 角色走到下一个怪位置 → 开始下一场战斗
        state.movingToNext = false;
        startNextBattle();
    });

    // 开始当前章节（bossLevel=0 即第 0 章，怪物 Lv.1）
    state.enemies = generateEnemiesForChapter(GameData.player.bossLevel || 0);
    state.currentEnemyIndex = 0;
    state.active = true;
    state.movingToNext = false;
    // 2026-08-14：新章节开始前清掉旧 Boss 冷却（防止跨章节残留）
    if (state.bossCooldownActive) endBossCooldown();
    initBossCooldownListener();
    startNextBattle();
    console.log('[BattleV2] chapter 0 started');
    showToast('⚔️ 自动战斗已启动', 'success');
}

export function stopContinuousBattle() {
    state.active = false;
    if (state.interval) {
        clearInterval(state.interval);
        state.interval = null;
    }
    canvasStopBattle();
}

/** 给 UI 用的：战斗是否在跑（用于扫荡按钮 enabled 状态） */
export function isBattleActive() {
    return state.active;
}

function startNextBattle() {
    if (state.currentEnemyIndex >= state.enemies.length) {
        onChapterComplete();
        return;
    }
    const enemy = state.enemies[state.currentEnemyIndex];
    state.currentEnemy = {
        ...enemy,
        hp: enemy.maxHp
    };

    // 通知 Canvas 渲染当前怪（传 chapter 给 battle-canvas 查立绘）
    const currentChapter = (GameData.player.bossLevel || 0) + 1;
    canvasStartBattle({
        type: enemy.type,
        name: enemy.name,
        chapter: currentChapter,
        maxHp: enemy.maxHp,
        attack: enemy.attack,
        coins: enemy.coins,
        exp: enemy.exp,
        boss: enemy.boss,
        bossVariant: enemy.bossVariant || 0
    });

    // DOM 头部信息更新
    updateHeader();

    // 启动攻击循环（2026-07-30：每 50ms 检查一次，按 attackSpeed 决定攻击频率）
    if (state.interval) clearInterval(state.interval);
    state.nextAttackAt = Date.now();
    state.interval = setInterval(battleTick, 50);
}

function battleTick() {
    if (!state.active || !state.currentEnemy) return;
    const now = Date.now();
    if (now < state.nextAttackAt) return;
    const playerStats = calculateStats();
    const attackInterval = Math.max(50, 1000 / Math.max(0.1, playerStats.attackSpeed || 1.0));
    state.nextAttackAt = now + attackInterval;
    playerAttackCurrentEnemy();
}

function playerAttackCurrentEnemy() {
    if (!state.currentEnemy || state.currentEnemy.hp <= 0) return;

    // 玩家属性（2026-07-30：去 defense，伤害 = attack × 浮动，无反击）
    const playerStats = calculateStats();
    const variance = 0.8 + Math.random() * 0.4;
    let damage = Math.max(1, Math.floor(playerStats.attack * variance));
    const isCrit = Math.random() * 100 < (playerStats.critRate || 5);
    if (isCrit) damage = Math.floor(damage * (playerStats.critDamage || 1.5));

    state.currentEnemy.hp -= damage;

    // Canvas 显示伤害数字 + 角色挥剑动画（在 onDamageDealt 内部）
    onDamageDealt(damage, isCrit);

    // 怪物死亡：停止循环 + 让 Canvas 播放死亡动画 + 角色移动
    if (state.currentEnemy.hp <= 0) {
        // v25：派发敌人死亡事件，main-quest.js 订阅钩入（解耦避免循环依赖）
        window.dispatchEvent(new CustomEvent('enemy-killed', {
            detail: { isBoss: !!state.currentEnemy.boss, name: state.currentEnemy.name }
        }));
        if (state.interval) clearInterval(state.interval);
        state.interval = null;
        setTimeout(() => {
            if (!state.active) return;
            state.currentEnemyIndex++;
            // ====== v22：打完 10 只怪后弹出 Boss 卡片（挑战/跳过按钮），但自动战斗不暂停 =====
            // 不发起挑战就一直打小怪（重置索引从第 1 只重新开始）
            const nextEnemy = state.enemies[state.currentEnemyIndex];
            if (nextEnemy && nextEnemy.boss && !state.bossReached) {
                state.bossReached = true;
                state.bossPending = true;
                showBossIntroModal(nextEnemy);
                // 重置索引让自动战斗循环刷怪（不进入挑战就不进下章）
                state.currentEnemyIndex = 0;
                state.movingToNext = true;
                // v23 fix：setInterval 已被 clearInterval，需手动重启下一轮战斗
                startNextBattle();
                return;
            }
            if (state.currentEnemyIndex >= state.enemies.length) {
                onChapterComplete();
            } else {
                state.movingToNext = true;
                // v23 fix：同上 —— 必须主动调用 startNextBattle 重启循环
                startNextBattle();
            }
        }, 1200);
    }
}

// onPlayerDeath 已删除（2026-07-30）：角色不再受击，无需死亡处理

// ============================================================
// Boss 卡片 / 失败 modal（v21：Boss 出现时不再弹卡片，改为在主页 boss-card 上展开挑战按钮）
// ============================================================
function showBossIntroModal(boss) {
    // v21：直接更新 boss-card，提示玩家主动点挑战
    const card = document.getElementById('boss-card');
    if (!card) return;
    card.dataset.state = 'pending';
    const titleEl = document.getElementById('boss-card-title');
    const subEl = document.getElementById('boss-card-sub');
    const actionsEl = document.getElementById('boss-actions');
    if (titleEl) titleEl.textContent = `👹 ${boss.name}`;
    if (subEl) subEl.textContent = `Lv.${boss.level || 1} · HP ${boss.maxHp}`;
    if (actionsEl) actionsEl.hidden = false;
}

function closeBossIntroModal() {
    // v21：恢复 boss-card 到默认状态
    const card = document.getElementById('boss-card');
    if (card) card.dataset.state = 'idle';
    const actionsEl = document.getElementById('boss-actions');
    if (actionsEl) actionsEl.hidden = true;
}

// 2026-08-14：L7 修复 — showBattleFailModal 已被 v21 后的 boss-card + challenge.js 接管，
//   全 src 中无调用，删除以减少死代码。battle-fail-modal 元素保留以防外部脚本仍引用。
function closeBattleFailModal() {
    document.getElementById('battle-fail-modal')?.classList.remove('active');
}

/** 玩家主动挑战当前 Boss → 调 challenge.js 的 startChallenge（30 秒倒计时） */
export function challengeCurrentBoss() {
    // 2026-08-14：冷却中拒绝挑战，提示玩家继续刷小怪
    if (state.bossCooldownActive) {
        const remaining = Math.max(0, state.bossCooldownRequired - state.bossCooldownKills);
        showToast(`� Boss 冷却中，再击杀 ${remaining} 只小怪可挑战`, 'warning');
        return false;
    }
    if (state.interval) { clearInterval(state.interval); state.interval = null; }
    closeBossIntroModal();
    state.bossPending = false;
    // 关键改动：跳转到 challenge.js 的 30 秒倒计时挑战
    // Boss tier 顺序对应章节 0/2/4/6/9（chapter = bossLevel）
    const chapter = GameData.player.bossLevel || 0;
    const tierMap = { 0: 'giant_zombie', 2: 'mutant_bear', 4: 'mech_golem', 6: 'cursed_knight', 9: 'toxic_lord' };
    const tierId = tierMap[chapter] || 'giant_zombie';
    import('./challenge.js').then(m => {
        if (typeof m.startChallenge === 'function') {
            m.startChallenge(tierId);
        }
    });
}

/** Boss 战失败后：跳过当前 Boss，回到上一章 */
export function backToPrevChapter() {
    closeBattleFailModal();
    if (state.interval) { clearInterval(state.interval); state.interval = null; }
    GameData.player.bossLevel = Math.max(0, (GameData.player.bossLevel || 0) - 1);
    saveData();
    showToast(`⏭ 回到第 ${GameData.player.bossLevel} 章`, 'info');
    // 2026-08-14：切章节时清理 Boss 冷却（新章节全新开始）
    if (state.bossCooldownActive) endBossCooldown();
    state.enemies = generateEnemiesForChapter(GameData.player.bossLevel);
    state.currentEnemyIndex = 0;
    state.bossReached = false;
    state.bossPending = false;
    state.active = true;
    startNextBattle();
    updateHeader();
}

/** Boss 战失败后：原地重新挑战 → 重新弹 Boss 卡片让玩家挑战 */
export function restartCurrentBoss() {
    closeBattleFailModal();
    if (state.interval) { clearInterval(state.interval); state.interval = null; }
    state.currentEnemyIndex = state.enemies.length - 1;
    state.bossPending = false;
    state.bossReached = true;
    state.active = false;
    const boss = state.enemies[state.currentEnemyIndex];
    showBossIntroModal(boss);
}

/** Boss 卡片选择"跳过"，跟失败等价 */
export function skipCurrentBoss() {
    closeBossIntroModal();
    backToPrevChapter();
}

function onChapterComplete() {
    state.active = false;
    if (state.interval) clearInterval(state.interval);
    state.interval = null;
    // 2026-08-14：通关后清掉 Boss 冷却（新章节全新开始）
    if (state.bossCooldownActive) endBossCooldown();
    // 推进 chapter
    const prevLevel = GameData.player.bossLevel || 0;
    GameData.player.bossLevel = prevLevel + 1;
    // PRD v3 · 2026-08-04：每通关 1 章 +1 进化胶囊
    if (!GameData.player.materials) GameData.player.materials = { advancedEnergy: 0, evolutionCapsules: 0, powerManual: 0, techniqueManual: 0, experienceManual: 0 };
    GameData.player.materials.evolutionCapsules = (GameData.player.materials.evolutionCapsules || 0) + 1;
    // v23：末日天数累计（叙事横幅联动）
    GameData.player.dayCount = (GameData.player.dayCount || 1) + 1;
    saveData();
    try { updateUI(); } catch (_) {}
    showToast(`🎉 第 ${GameData.player.bossLevel} 章完成！+1 进化胶囊`, 'success');

    // 显示对应章节剧情（推后 800ms 让 toast 先出现）
    setTimeout(() => {
        try {
            showCurrentChapterStory();
        } catch (e) { console.warn('[story] showCurrentChapterStory:', e.message); }
    }, 800);

    // 短暂停顿后开下一章
    setTimeout(() => {
        state.enemies = generateEnemiesForChapter(GameData.player.bossLevel);
        state.currentEnemyIndex = 0;
        state.bossReached = false;
        state.active = true;
        startNextBattle();
    }, 3000);
}

function updateHeader() {
    const el = document.getElementById('battle-turn');
    const chapter = (GameData.player.bossLevel || 0) + 1;  // 1-based 章节
    if (el) el.textContent = `第 ${chapter} 章 · 怪 ${state.currentEnemyIndex + 1}/${state.enemies.length}`;
    // v24b：删除 stage header 的"蝾螈 Lv.X"重复描述（血条上方已显示怪物名 + 等级）
    // stage header 只保留 HTML 静态"废土走廊"，避免冗余
    // 2026-08-03：同步怪 1/11 状态到战斗卡底部小字（battle-area-name-2）
    const name2El = document.getElementById('battle-area-name-2');
    if (name2El) name2El.textContent = `${state.currentEnemyIndex + 1}/${state.enemies.length}`;
}

/**
 * 一键扫荡当前章节剩余怪物
 * - 限制：bossLevel >= 1（至少打过 1 个 Boss 才能扫）
 * - 结算：剩余怪的金币/经验直接进奖励池；装备按 30% 概率掉 1 件低级散件
 * - 推进：currentEnemyIndex 直接跳到末尾 → 触发 onChapterComplete
 */
export function sweepCurrentChapter() {
    const p = GameData.player;
    // 放宽限制：至少打过 1 只怪就能扫（避免一上来就扫整章拿 boss 奖励）
    if ((state.currentEnemyIndex || 0) < 1) {
        showToast('请先打完当前章节的第 1 只怪', 'warning');
        return false;
    }
    if (!state.active) {
        // 2026-08-05 v25c：战斗未启动时自动启动（保持当前 bossLevel 章节进度，不重置 enemy index）
        const canvasEl = document.getElementById('battle-canvas');
        if (!canvasEl) {
            showToast('战斗画布丢失，请刷新页面', 'error');
            return false;
        }
        if (!state.canvasInited || !state.enemies || state.enemies.length === 0) {
            // 全新启动：初始化 canvas + 生成章节怪
            startContinuousBattle(canvasEl);
            showToast('⚔️ 战斗已自动启动，开始扫荡', 'success');
        } else {
            // 已初始化但 state.active=false（战斗被暂停）：直接恢复 active + 启动下一只怪
            state.active = true;
            state.movingToNext = false;
            if (state.interval) { clearInterval(state.interval); state.interval = null; }
            startNextBattle();
            showToast('⚔️ 战斗已恢复，开始扫荡', 'success');
        }
    }
    const idx = state.currentEnemyIndex;
    const remaining = state.enemies.slice(idx);
    if (remaining.length === 0) {
        showToast('当前章节已无剩余怪物', 'info');
        return false;
    }
    // 停战斗循环
    if (state.interval) { clearInterval(state.interval); state.interval = null; }

    let coinSum = 0, expSum = 0;
    const sweepLootChance = 0.30;  // 整章扫荡 30% 概率掉 1 件低级装备
    remaining.forEach(e => {
        coinSum += e.coins || 0;
        expSum += e.exp || 0;
    });
    addToRewardPool(coinSum, expSum);

    // 低级装备：随机 part + 白 / 绿 品质 + 1 件（2026-07-30：去 defense/hp，全部转 attack）
    if (Math.random() < sweepLootChance) {
        const parts = ['weapon', 'armor', 'head', 'boots', 'clothes'];
        const part = parts[Math.floor(Math.random() * parts.length)];
        const quality = Math.random() < 0.7 ? 'white' : 'green';
        const rarity = quality === 'white' ? 1 : 1.5;
        const baseStats = ({ weapon: { attack: 4 }, armor: { attack: 6 }, head: { attack: 3 },
                             boots: { attack: 2 }, clothes: { attack: 4 } })[part] || { attack: 3 };
        const stats = {};
        for (const [k, v] of Object.entries(baseStats)) {
            stats[k] = Math.floor(v * rarity * (0.8 + Math.random() * 0.6));
        }
        if (!p.bag) p.bag = { equipment: [], material: [] };
        if (!p.bag.equipment) p.bag.equipment = [];
        // ====== 背包满则丢地上（不阻塞扫荡）======
        if (p.bag.equipment.length >= (p.bag.equipmentMax || 30)) {
            showToast(`🧹 扫荡：+${coinSum} 金币 +${expSum} 经验 · 📦 背包已满，散件已丢地上`, 'warning');
        } else {
            p.bag.equipment.push({
                id: `sweep_${part}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                templateId: `sweep_${part}`,
                name: `扫荡所得·${({weapon:'武器',armor:'防具',head:'头盔',boots:'靴',clothes:'外套'})[part]}`,
                part, quality,
                setId: 'sweep',  // 散件，无套装
                stats,
                source: 'sweep',
                // v equip-refactor-20261008a：补 level 字段，供未来升级机制使用
                level: 1,
                createdAt: Date.now(),
            });
            showToast(`🧹 扫荡：+${coinSum} 金币 +${expSum} 经验 · 🎁 获 ${quality === 'white' ? '白' : '绿'}色散件`, 'success');
        }
    } else {
        showToast(`🧹 扫荡：+${coinSum} 金币 · +${expSum} 经验`, 'success');
    }

    // 推进到章节末尾
    state.currentEnemyIndex = state.enemies.length;
    onChapterComplete();
    saveData();
    return true;
}

// 暴露给外部
window.collectRewardPool = collectRewardPool;
window.sweepCurrentChapter = sweepCurrentChapter;
window.challengeCurrentBoss = challengeCurrentBoss;
window.backToPrevChapter = backToPrevChapter;
window.restartCurrentBoss = restartCurrentBoss;
// 暴露只读快照给 main.js 的 renderSweepCorner 读当前进度（v26 扫荡限制放宽）。
// 2026-08-14：L5 修复 — 之前直接挂 state 引用，外部代码可以 mutate state.interval/active 等
//   内部状态。现改为每次返回 Object.freeze 的快照，外部无法回写。
//   写入请用专门的导出 resetBossFlags()。
window.__battleV2State = new Proxy({}, {
    get(_, prop) {
        if (prop === Symbol.iterator || prop === 'then') return undefined;
        if (!(prop in state)) return undefined;
        const v = state[prop];
        return (typeof v === 'object' && v !== null) ? Object.freeze(Array.isArray(v) ? [...v] : { ...v }) : v;
    },
    has(_, prop) { return prop in state; },
});

/** 2026-08-14：M1 修复 — 重置 Boss 卡状态，供 challenge.js 在 resumeContinuousBattle 时调用 */
export function resetBossFlags() {
    state.bossReached = false;
    state.bossPending = false;
}
window.skipCurrentBoss = skipCurrentBoss;
window.startContinuousBattle = startContinuousBattle;
window.stopContinuousBattle = stopContinuousBattle;
window.isBattleActive = isBattleActive;
window.resetBossFlags = resetBossFlags;
// 2026-08-14：关底 Boss 失败冷却 API（供 challenge.js + UI 调用）
window.startBossCooldown = startBossCooldown;
window.endBossCooldown = endBossCooldown;
window.isBossCooldown = isBossCooldown;