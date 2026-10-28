// ============================================================
//  src/systems/challenge.js
//  挑战强敌系统（2026-07-30 重构：30 秒倒计时 + DPS 累积伤害）
//
//  设计要点（用户已锁定）：
//  - 默认每日 3 次，胜利才扣次数；失败不扣
//  - 看广告 +10 charges，最多 10 / 日
//  - 章节 1/3/5/7/10 各开放 1 个强敌
//  - 装备按 5 套系掉落，入 bag.equipment
//  - 随机属性 80%~140% 浮动，允许重复掉落
//
//  战斗机制（2026-07-30）：
//  - 30 秒倒计时
//  - 每 100ms tick 累积伤害：DPS = attack × attackSpeed
//  - 角色不再受击，玩家无血条
//  - 30 秒内累计伤害 >= Boss.hp → 胜利；超时 → 失败
// ============================================================

import { GameData, saveData, initNewFields } from '../data/gameData.js';
import { Renderer } from '../core/renderer.js';
import { CHALLENGE_CONFIG, CHALLENGE_TIERS, SET_EQUIP_TEMPLATES, SKILL_QUALITY }
    from '../data/config.js';
import { watchAd } from './ad.js';
import { showToast } from '../ui/ui.js';
import { calculateStats } from './equipment.js';
import { addToRewardPool } from './battle-v2.js';
// 2026-08-14：挑战 Boss 改在战斗画布内进行（火柴人实时挥剑 + 30 秒倒计时浮层）
import { startBattle, onDamageDealt } from './battle-canvas.js';

// ============================================================
// 战斗状态
// ============================================================
const state = {
    active: false,
    tier: null,
    bossMaxHp: 0,
    bossHp: 0,
    interval: null,
    goldReward: 0,
    expReward: 0,
    startTime: 0,
    totalDamage: 0,
    tickCount: 0,
};

// ============================================================
// 计算当前章节（解锁依据）
// bossLevel 是已通关章节数（0 = 第 1 章进行中），玩家能挑战的章节 = bossLevel + 1
// 这样 bossLevel=0 就能解锁第 1 章 Boss（unlockChapter=1）
// ============================================================
function getCurrentChapter() {
    return (GameData.player.bossLevel || 0) + 1;
}

// ============================================================
// 列表（UI 用）
// ============================================================
export function listChallengeTiers() {
    initNewFields();
    const chapter = getCurrentChapter();
    return CHALLENGE_TIERS.map(t => ({
        ...t,
        unlocked: chapter >= t.unlockChapter,
        currentChapter: chapter,
    }));
}

// ============================================================
// 模态入口
// ============================================================
export function openChallenge() {
    const modal = document.getElementById('challenge-modal');
    if (!modal) return;
    initNewFields();
    renderChallengeUI();
    // 2026-10-28：改走 Renderer.showModal —— 玩家主动开弹窗时关掉自动剧情卡片和其它弹窗（互斥）
    //   战利品弹窗 challenge-loot-modal 是受保护弹窗，不会被这里顶掉
    Renderer.showModal('challenge-modal');
    if (typeof window.lucide !== 'undefined') window.lucide.createIcons();
}

export function closeChallenge() {
    const modal = document.getElementById('challenge-modal');
    if (modal) modal.classList.remove('active');
}

/**
 * UI：5 强敌列表 + 今日次数
 */
export function renderChallengeUI() {
    const el = document.getElementById('challenge-tiers');
    if (!el) return;
    const tiers = listChallengeTiers();
    const remaining = GameData.player.challenge.remaining;
    const max = CHALLENGE_CONFIG.dailyMax;
    // 2026-08-14：boss-cooldown — 当前章节 Boss 进入冷却状态，对应 tier 按钮禁用
    const inCooldown = (typeof window.isBossCooldown === 'function' && window.isBossCooldown());
    const currentChapter = getCurrentChapter();
    el.innerHTML = `
        <div style="padding:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding:8px;background:var(--bg-card);border-radius:6px;">
                <div>今日剩余 <strong style="color:var(--gold);font-size:18px;">${remaining}</strong>/${max}</div>
                <button class="btn btn-sm" style="background:var(--orange);color:#000;" onclick="window.addChallengeByAd()">📺 观看广告 +10</button>
            </div>
            ${tiers.map(t => {
                const inTierCooldown = inCooldown && t.unlocked && t.unlockChapter === currentChapter;
                const disabled = !t.unlocked || remaining <= 0 || inTierCooldown;
                let label = '挑战';
                if (!t.unlocked) label = '未解锁';
                else if (inTierCooldown) label = '⏳ 冷却中';
                else if (remaining <= 0) label = '今日用完';
                return `
                <div class="challenge-tier ${t.unlocked ? '' : 'locked'}" style="
                    padding:12px;border:2px solid ${t.unlocked ? 'var(--gold)' : '#555'};
                    border-radius:8px;margin-bottom:8px;
                    opacity:${t.unlocked ? '1' : '0.4'};
                    background:var(--bg-card);
                ">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <div style="font-size:14px;font-weight:600;color:${t.unlocked ? 'var(--gold)' : '#888'};">
                                ${t.unlocked ? '⚔️' : '🔒'} ${t.name}
                                <span style="font-size:11px;color:var(--text-secondary);">
                                    ${t.unlocked ? '' : `(第 ${t.unlockChapter} 章解锁)`}
                                </span>
                            </div>
                            <div style="font-size:11px;color:var(--text-secondary);">
                                HP ${t.baseHp} · ⏱ 30 秒挑战 · ${t.setId} 套
                                · 金币+${t.goldReward} 经验+${t.expReward}
                            </div>
                        </div>
                        <button class="btn btn-primary"
                            ${disabled ? 'disabled' : ''}
                            onclick="window.startChallenge('${t.id}')">
                            ${label}
                        </button>
                    </div>
                </div>
                `;
            }).join('')}
        </div>
    `;
    if (typeof window.lucide !== 'undefined') window.lucide.createIcons();
}

// ============================================================
// 看广告 +10
// ============================================================
export function addChallengeByAd() {
    initNewFields();
    watchAd(() => {
        const p = GameData.player;
        p.challenge.remaining = Math.min(CHALLENGE_CONFIG.dailyMax, (p.challenge.remaining || 0) + CHALLENGE_CONFIG.adRewardCharges);
        saveData();
        renderChallengeUI();
        showToast(`📺 奖励 +${CHALLENGE_CONFIG.adRewardCharges} 挑战次数`, 'success');
    });
}

// ============================================================
// 开始挑战
// ============================================================
export function startChallenge(tierId) {
    // 2026-08-14：M3 修复 — 挑战进行中禁止重复开启，避免画面跳跃 / 计时器被清重建
    if (state.active) {
        showToast('⚔️ 挑战进行中', 'info');
        return false;
    }
    // 2026-08-14：boss-cooldown — 失败冷却期间禁止再次挑战（防止绕过 boss card 直接点 modal）
    if (typeof window.isBossCooldown === 'function' && window.isBossCooldown()) {
        showToast('Boss 冷却中，请先击杀小怪恢复挑战', 'warning');
        return false;
    }
    initNewFields();
    const tier = CHALLENGE_TIERS.find(t => t.id === tierId);
    if (!tier) { showToast('强敌不存在', 'error'); return false; }
    if (getCurrentChapter() < tier.unlockChapter) { showToast(`第 ${tier.unlockChapter} 章解锁`, 'warning'); return false; }
    if (GameData.player.challenge.remaining <= 0) { showToast('今日次数用完', 'warning'); return false; }

    state.tier = tier;
    state.bossMaxHp = tier.baseHp;
    state.bossHp = tier.baseHp;
    state.goldReward = tier.goldReward;
    state.expReward = tier.expReward;
    state.active = true;
    state.startTime = Date.now();
    state.totalDamage = 0;
    state.tickCount = 0;

    closeChallenge();
    pauseContinuousBattle();
    renderBossInCanvas();
    openChallengeOverlay();
    startBattleLoop();
    hideBossActions();
    showToast(`⚔️ 挑战 ${tier.name}！30 秒内击败它`, 'success');
    return true;
}

/**
 * 在战斗画布上展示 Boss（替换原“怪物 + 血条 + 文字”三段弹窗）。
 * bossVariant 来自 tier.id 在 CHALLENGE_TIERS 中的索引（0~4）。
 */
function renderBossInCanvas() {
    if (!state.tier) return;
    const variant = Math.max(0, CHALLENGE_TIERS.findIndex(t => t.id === state.tier.id));
    const chapter = getCurrentChapter();
    try {
        startBattle({
            type: state.tier.id,
            name: state.tier.name,
            chapter,
            level: chapter,
            maxHp: state.bossMaxHp,
            attack: 0,
            coins: 0,
            exp: 0,
            boss: true,
            bossVariant: variant,
        });
    } catch (err) {
        console.warn('[challenge] 启动画布 Boss 失败:', err);
    }
}

/**
 * 挑战过程中暂停战斗-v2 自动循环，避免普通战斗与挑战画布争抢。
 * challengeCurrentBoss 也会做这件事，这里兼容从挑战列表按钮进入的场景。
 */
function pauseContinuousBattle() {
    try {
        if (typeof window.stopContinuousBattle === 'function') {
            window.stopContinuousBattle();
        }
    } catch (err) {
        console.warn('[challenge] 暂停普通战斗失败:', err);
    }
}

function resumeContinuousBattle() {
    const canvasEl = document.getElementById('battle-canvas');
    // 2026-08-14：M1 修复 — 挑战胜利/失败/放弃 恢复普通战斗时，
    //   重置 Boss 卡状态，避免下章 Boss 卡永久不再弹出。
    try {
        if (typeof window.resetBossFlags === 'function') {
            window.resetBossFlags();
        } else {
            // 兜底（兼容旧版本）
            const s = window.__battleV2State;
            if (s && typeof s === 'object') {
                try { s.bossReached = false; } catch (_) {}
                try { s.bossPending = false; } catch (_) {}
            }
        }
    } catch (_) {}
    if (canvasEl && typeof window.startContinuousBattle === 'function') {
        try {
            window.startContinuousBattle(canvasEl);
        } catch (err) {
            console.warn('[challenge] 恢复普通战斗失败:', err);
        }
    }
}

function hideBossActions() {
    const actions = document.getElementById('boss-actions');
    if (actions) actions.hidden = true;
    const card = document.getElementById('boss-card');
    if (card) card.dataset.state = 'idle';
}

// ============================================================
// 战斗画布覆盖层（2026-08-14：替换原文字挑战 modal）
// ============================================================
function openChallengeOverlay() {
    const overlay = document.getElementById('challenge-overlay');
    if (!overlay) return;
    const tier = state.tier;
    document.getElementById('co-boss-name').textContent = tier.name;
    document.getElementById('co-boss-hp-text').textContent = `${state.bossHp}/${state.bossMaxHp}`;
    document.getElementById('co-boss-hp').style.width = '100%';

    const timerBar = document.getElementById('co-timer-bar');
    const timerText = document.getElementById('co-timer-text');
    if (timerBar) timerBar.style.width = '100%';
    if (timerText) timerText.textContent = `${CHALLENGE_CONFIG.timeLimitSec}.0`;

    document.getElementById('co-total-damage').textContent = '0';
    document.getElementById('co-dps').textContent = '0';

    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
}

function closeChallengeOverlay() {
    const overlay = document.getElementById('challenge-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
    }
}

function abandonChallenge() {
    // 玩家主动放弃：等同于挑战失败，但不计入胜负
    if (!state.active) return;
    stopBattleLoop();
    state.active = false;
    closeChallengeOverlay();
    hideBossActions();
    showToast('⏱ 已放弃本次挑战', 'info');
    setTimeout(resumeContinuousBattle, 200);
}

/**
 * 旧版 closeChallengeBattle 兼容入口（HTML / 旧脚本里仍可能引用）。
 * 现在等同于“放弃当前挑战”。
 */
function closeChallengeBattle() {
    abandonChallenge();
}

// ============================================================
// 战斗循环（每秒 1 次）
// ============================================================
function startBattleLoop() {
    if (state.interval) clearInterval(state.interval);
    state.interval = setInterval(battleTick, CHALLENGE_CONFIG.tickMs);
}

function stopBattleLoop() {
    if (state.interval) clearInterval(state.interval);
    state.interval = null;
}

function battleTick() {
    if (!state.active) { stopBattleLoop(); return; }

    const playerStats = calculateStats();
    const attackSpeed = Math.max(0.1, playerStats.attackSpeed || 1.0);
    // 每秒伤害 = attack × attackSpeed
    // 每 tick (100ms) 伤害 = DPS × 0.1
    const damagePerSec = playerStats.attack * attackSpeed;
    const damagePerTick = damagePerSec * 0.1;
    const variance = 0.9 + Math.random() * 0.2;
    let damage = Math.max(1, damagePerTick * variance);
    const isCrit = Math.random() * 100 < (playerStats.critRate || 5);
    if (isCrit) damage = Math.floor(damage * (playerStats.critDamage || 1.5));
    // 2026-08-03：技能书"破甲"（bossDmg）加成：挑战 Boss 伤害额外 +N%
    damage = Math.floor(damage * (1 + (playerStats.bossDmg || 0)));
    damage = Math.floor(damage);

    state.bossHp = Math.max(0, state.bossHp - damage);
    state.totalDamage += damage;
    state.tickCount++;

    // 把伤害推给画布：触发火柴人挥剑 + 浮动数字 + 粒子，同时驱动画布 Boss 血条
    try { onDamageDealt(damage, isCrit); } catch (_) {}

    updateChallengeUI();

    if (state.bossHp <= 0) {
        onBattleWin();
        return;
    }
    const elapsed = (Date.now() - state.startTime) / 1000;
    if (elapsed >= CHALLENGE_CONFIG.timeLimitSec) {
        onBattleLose();
    }
}

/**
 * 更新挑战战斗 UI：覆盖在画布上的 30 秒倒计时 + Boss 血条 + 累计伤害 + DPS
 */
function updateChallengeUI() {
    // Boss HP
    const bossHpText = document.getElementById('co-boss-hp-text');
    const bossHpBar = document.getElementById('co-boss-hp');
    if (bossHpText) bossHpText.textContent = `${Math.floor(state.bossHp)}/${state.bossMaxHp}`;
    if (bossHpBar) bossHpBar.style.width = Math.max(0, state.bossHp / state.bossMaxHp * 100) + '%';

    // 倒计时
    const elapsed = (Date.now() - state.startTime) / 1000;
    const remaining = Math.max(0, CHALLENGE_CONFIG.timeLimitSec - elapsed);
    const timerBar = document.getElementById('co-timer-bar');
    const timerText = document.getElementById('co-timer-text');
    if (timerBar) timerBar.style.width = (remaining / CHALLENGE_CONFIG.timeLimitSec * 100) + '%';
    if (timerText) timerText.textContent = remaining.toFixed(1);

    // 累计伤害 + DPS
    const dmgEl = document.getElementById('co-total-damage');
    const dpsEl = document.getElementById('co-dps');
    if (dmgEl) dmgEl.textContent = Math.floor(state.totalDamage);
    if (dpsEl) {
        const dps = elapsed > 0 ? Math.floor(state.totalDamage / elapsed) : 0;
        dpsEl.textContent = dps;
    }
}

// ============================================================
// 结算：胜利 / 失败
// ============================================================
function onBattleWin() {
    stopBattleLoop();
    state.active = false;
    closeChallengeOverlay();
    // 扣次数
    GameData.player.challenge.remaining = Math.max(0, (GameData.player.challenge.remaining || 0) - 1);
    GameData.player.challenge.totalKills = (GameData.player.challenge.totalKills || 0) + 1;
    // 金币入背包 + 经验入奖励池
    GameData.player.gold = (GameData.player.gold || 0) + state.goldReward;
    addToRewardPool(0, state.expReward);
    // 战利品
    const loot = rollLoot(state.tier.setId);
    let bagFull = false;
    if (loot) {
        if (!GameData.player.bag) GameData.player.bag = { equipment: [], material: [] };
        if (!GameData.player.bag.equipment) GameData.player.bag.equipment = [];
        const max = GameData.player.bag.equipmentMax || 30;
        if (GameData.player.bag.equipment.length >= max) {
            bagFull = true;
        } else {
            GameData.player.bag.equipment.push(loot);
        }
    }
    // 2026-07-30：挑战成功 → 推进章节（bossLevel = max(bossLevel, tier.unlockChapter)）
    if (GameData.player.bossLevel < state.tier.unlockChapter) {
        GameData.player.bossLevel = state.tier.unlockChapter;
    }
    // v25：派发 boss-defeated 事件，main-quest.js 订阅钩入 defeat_boss 阶段
    window.dispatchEvent(new CustomEvent('boss-defeated', {
        detail: { tierId: state.tier?.id, unlockChapter: state.tier.unlockChapter }
    }));
    saveData();
    resumeContinuousBattle();
    showLootModal(loot, state.goldReward, state.expReward, bagFull);
    setTimeout(() => {
        openChallenge();
    }, 200);
}

function onBattleLose() {
    stopBattleLoop();
    state.active = false;
    closeChallengeOverlay();
    // 2026-08-14：L6 修复 — 失败时把累计伤害的 10% 折算金币入奖励池，
    //   给玩家一点安慰反馈（不掉次数也不入袋，但视觉上承认"打了不少"）。
    let consolation = 0;
    try {
        consolation = Math.max(1, Math.floor(state.totalDamage * 0.1));
        addToRewardPool(consolation, 0);
    } catch (_) {}
    // 2026-08-14：boss-cooldown — 失败后启动冷却，强制玩家刷小怪再挑战
    // 防止玩家无限重试同一 Boss，避免"卡关"挫败感
    if (typeof window.startBossCooldown === 'function') {
        window.startBossCooldown(5);
        showToast(`⏱ 30 秒超时 · 💰 +${consolation} 安慰金 · 击杀 5 只小怪后可再战`, 'info');
    } else {
        showToast(`⏱ 30 秒超时，挑战失败（不扣次数）· 💰 +${consolation} 安慰金`, 'error');
    }
    resumeContinuousBattle();
    // 注意：v boss-cooldown-20260814d 起不再 setTimeout(openChallenge)，
    //   让玩家先刷小怪（boss card 进入 cooldown 状态）
}

/**
 * 抽 1 件套系装备（80%-140% 属性浮动）
 */
function rollLoot(setId) {
    const candidates = SET_EQUIP_TEMPLATES.filter(t => t.setId === setId);
    if (candidates.length === 0) return null;
    const tmpl = candidates[Math.floor(Math.random() * candidates.length)];
    const stats = {};
    for (const [k, v] of Object.entries(tmpl.baseStats)) {
        stats[k] = Math.floor(v * (0.8 + Math.random() * 0.6));
    }
    return {
        id: `${tmpl.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        templateId: tmpl.id,
        name: tmpl.name,
        part: tmpl.part,
        setId: tmpl.setId,
        quality: qualityByChapter(),
        stats,
        source: 'challenge',
        // v equip-refactor-20261008a：补 level 字段，供未来升级机制使用
        level: 1,
        createdAt: Date.now(),
    };
}

function qualityByChapter() {
    const ch = getCurrentChapter();
    const r = Math.random() * 100;
    if (ch >= 10) {
        // 章节 10+：30% 红 30% 金 25% 紫 15% 蓝
        if (r < 30) return 'red';
        if (r < 60) return 'gold';
        if (r < 85) return 'purple';
        return 'blue';
    } else if (ch >= 7) {
        if (r < 30) return 'gold';
        if (r < 65) return 'purple';
        return 'blue';
    } else if (ch >= 5) {
        if (r < 25) return 'gold';
        return 'purple';
    } else if (ch >= 3) {
        if (r < 25) return 'purple';
        return 'blue';
    }
    return 'blue';
}

function showLootModal(loot, gold, exp, bagFull) {
    const modal = document.getElementById('challenge-loot-modal');
    if (!modal) return;
    const el = document.getElementById('challenge-loot-content');
    if (!el) return;
    const color = loot ? (SKILL_QUALITY[loot.quality]?.color || '#888') : '#888';
    el.innerHTML = `
        <div style="padding:20px;text-align:center;">
            <div style="font-size:32px;margin-bottom:12px;">🎉</div>
            <div style="font-size:18px;font-weight:600;color:var(--gold);margin-bottom:12px;">挑战胜利！</div>
            <div style="font-size:14px;margin-bottom:8px;">
                💰 +${gold} 金币 · ✨ +${exp} 经验（入奖励池）
            </div>
            ${loot ? `
                <div class="skillbook-card quality-${loot.quality}" style="margin:12px auto;max-width:240px;padding:12px;border-left:4px solid ${color};text-align:left;">
                    <div style="font-weight:600;color:${color};">${SKILL_QUALITY[loot.quality]?.name || ''}·${loot.name}</div>
                    <div style="font-size:11px;color:var(--text-secondary);">部位：${loot.part} · 套系：${loot.setId}</div>
                    <div style="font-size:11px;color:var(--text-primary);margin-top:4px;">
                        ${Object.entries(loot.stats).map(([k, v]) => `+${v} ${k}`).join(' · ')}
                    </div>
                </div>
                ${bagFull ? '<div style="margin-top:8px;color:#f87171;font-size:12px;">📦 背包已满，战利品已丢地上（请去背包 modal 扩充格子）</div>' : ''}
            ` : ''}
            <button class="btn btn-primary" style="margin-top:16px;" onclick="window.closeLootModal()">收下战利品</button>
        </div>
    `;
    modal.classList.add('active');
    if (typeof window.lucide !== 'undefined') window.lucide.createIcons();
}

function closeLootModal() {
    const modal = document.getElementById('challenge-loot-modal');
    if (modal) modal.classList.remove('active');
}

// ============================================================
// window 桥接
// ============================================================
window.openChallenge = openChallenge;
window.closeChallenge = closeChallenge;
window.renderChallengeUI = renderChallengeUI;
window.addChallengeByAd = addChallengeByAd;
window.startChallenge = startChallenge;
window.closeChallengeBattle = closeChallengeBattle;
window.closeLootModal = closeLootModal;
window.abandonChallenge = abandonChallenge;

// 2026-08-14：挑战覆盖层关闭按钮
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('challenge-overlay-close');
    if (btn && !btn.__challengeHooked) {
        btn.__challengeHooked = true;
        btn.addEventListener('click', () => abandonChallenge());
    }
});
