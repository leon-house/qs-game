// ============================================================
//  src/systems/training-ground.js
//  训练场系统（PRD v3 · 2026-08-04）
//
//  - 3 方向 × Lv.0~30：力量 / 技巧 / 经验
//  - 用户明确：不可取消（一旦开始就必须完成）
//  - 后台计时：30 + 5*(lv-1) 分钟/级
//  - 同时只能训练 1 个方向
//
//  API:
//    startTraining(direction)        → 开始训练（不可取消）
//    tickTraining()                  → 检查训练是否完成
//    calculateTrainingBonus()        → 计算累计属性
//    renderTrainingGroundInfo()      → UI HTML
// ============================================================

import { GameData, saveData, initNewFields } from '../data/gameData.js';
import { TRAINING_GROUND_CONFIG } from '../data/config.js';
import { showToast } from '../ui/ui.js';

function getDirection(id) {
    return TRAINING_GROUND_CONFIG.directions.find(d => d.id === id);
}

export function canStartTraining(directionId) {
    initNewFields();
    const p = GameData.player;
    const dir = getDirection(directionId);
    if (!dir) return { ok: false, reason: '未知方向' };
    const cur = p.trainingGround[directionId] || 0;
    if (cur >= TRAINING_GROUND_CONFIG.maxLevel) {
        return { ok: false, reason: '已达最高 Lv.30' };
    }
    if (p.trainingGround.activeDirection && p.trainingGround.activeDirection !== directionId) {
        return { ok: false, reason: `正在训练「${getDirection(p.trainingGround.activeDirection).name}」中` };
    }
    if (p.trainingGround.activeDirection === directionId) {
        return { ok: false, reason: '该方向已在训练中' };
    }
    const cost = TRAINING_GROUND_CONFIG.getGoldCost(cur + 1);
    if ((p.gold || 0) < cost) {
        return { ok: false, reason: `金币不足（${p.gold || 0}/${cost}）` };
    }
    if ((p.materials[dir.manualId] || 0) < 1) {
        return { ok: false, reason: `${dir.name}手册不足` };
    }
    return { ok: true, reason: '' };
}

export function startTraining(directionId) {
    const check = canStartTraining(directionId);
    if (!check.ok) {
        showToast(check.reason, 'error');
        return false;
    }
    const p = GameData.player;
    const dir = getDirection(directionId);
    const cur = p.trainingGround[directionId] || 0;
    const nextLv = cur + 1;
    const cost = TRAINING_GROUND_CONFIG.getGoldCost(nextLv);
    const durationMin = TRAINING_GROUND_CONFIG.getDurationMin(nextLv);

    // 扣金币 + 手册
    p.gold -= cost;
    p.materials[dir.manualId] -= 1;

    // 设置训练状态
    const now = Date.now();
    p.trainingGround.activeDirection = directionId;
    p.trainingGround.trainingStartTime = now;
    p.trainingGround.trainingEndTime = now + durationMin * 60 * 1000;

    saveData();
    showToast(`🏋 开始训练「${dir.name}」Lv.${nextLv}（${durationMin} 分钟）`, 'success');
    return true;
}

/**
 * 检查训练是否完成（每 1s tick 调用一次）
 * 若完成：自动结算 +1 级 + toast + 清状态
 */
export function tickTraining() {
    initNewFields();
    const p = GameData.player;
    const dir = p.trainingGround.activeDirection;
    if (!dir) return false;
    const now = Date.now();
    if (now < p.trainingGround.trainingEndTime) return false;

    // 训练完成 → 升级
    p.trainingGround[dir] = (p.trainingGround[dir] || 0) + 1;
    p.trainingGround.activeDirection = null;
    p.trainingGround.trainingStartTime = 0;
    p.trainingGround.trainingEndTime = 0;
    saveData();
    showToast(`🎉 「${getDirection(dir).name}」训练完成！`, 'success');
    return true;
}

/**
 * 启动后台 ticker（每 1s 检查一次）
 */
let trainingTimerId = null;
export function startTrainingTicker() {
    if (trainingTimerId) return;
    trainingTimerId = setInterval(() => {
        try { tickTraining(); } catch (_) {}
    }, 1000);
}

/**
 * 计算累计属性加成
 * 返回 { attack, critRate, expMul }
 */
export function calculateTrainingBonus() {
    initNewFields();
    const p = GameData.player;
    const result = { attack: 0, critRate: 0, expMul: 0 };
    TRAINING_GROUND_CONFIG.directions.forEach(dir => {
        const lv = p.trainingGround[dir.id] || 0;
        for (const [k, v] of Object.entries(dir.perLevel)) {
            result[k] = (result[k] || 0) + v * lv;
        }
    });
    return result;
}

function formatRemaining(ms) {
    if (ms <= 0) return '即将完成';
    const min = Math.floor(ms / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    if (min > 60) {
        const h = Math.floor(min / 60);
        const m = min % 60;
        return `${h}h${String(m).padStart(2, '0')}m`;
    }
    return `${min}m${String(sec).padStart(2, '0')}s`;
}

/**
 * UI 渲染：3 张方向卡片 + 当前训练状态
 */
export function renderTrainingGroundInfo() {
    initNewFields();
    const p = GameData.player;
    const activeDir = p.trainingGround.activeDirection;
    const cards = TRAINING_GROUND_CONFIG.directions.map(dir => {
        const lv = p.trainingGround[dir.id] || 0;
        const isActive = activeDir === dir.id;
        const isOtherActive = activeDir && !isActive;
        const cost = TRAINING_GROUND_CONFIG.getGoldCost(lv + 1);
        const manualCount = p.materials[dir.manualId] || 0;
        const gold = p.gold || 0;

        let progressHtml = '';
        let actionBtn = '';
        if (isActive) {
            const remaining = p.trainingGround.trainingEndTime - Date.now();
            progressHtml = `<div class="tg-progress"><div class="tg-progress-bar" style="width:0%"></div></div>
                <div class="tg-remaining">⏱ 剩余 ${formatRemaining(remaining)}</div>
                <div class="tg-hint">⚠ 训练中不可取消</div>`;
            actionBtn = `<button class="tg-btn disabled" disabled>训练中...</button>`;
        } else if (isOtherActive) {
            actionBtn = `<button class="tg-btn disabled" disabled>⏳ 另一方向训练中</button>`;
        } else if (lv >= TRAINING_GROUND_CONFIG.maxLevel) {
            actionBtn = `<div class="tg-maxed">🏆 Lv.30 满级</div>`;
        } else {
            const can = canStartTraining(dir.id);
            progressHtml = `
                <div class="tg-cost">
                    <div class="tg-cost-row ${manualCount >= 1 ? 'enough' : 'short'}">
                        📖 ${dir.name}手册：${manualCount}/1
                    </div>
                    <div class="tg-cost-row ${gold >= cost ? 'enough' : 'short'}">
                        💰 金币：${gold.toLocaleString()}/${cost.toLocaleString()}
                    </div>
                </div>`;
            actionBtn = `<button class="tg-btn" onclick="window.startTrainingWithRefresh('${dir.id}')"
                ${can.ok ? '' : 'disabled'}>▶ 开始训练</button>`;
        }

        const bonusStr = Object.entries(dir.perLevel).map(([k, v]) => {
            const total = v * lv;
            return `${k} +${total}`;
        }).join(' / ');

        return `
            <div class="tg-card ${isActive ? 'active' : ''} ${isOtherActive ? 'locked' : ''}">
                <div class="tg-card-header">
                    <div class="tg-icon"><i data-lucide="${dir.icon}"></i></div>
                    <div class="tg-info">
                        <div class="tg-name">${dir.name}</div>
                        <div class="tg-level">Lv.${lv}/${TRAINING_GROUND_CONFIG.maxLevel}</div>
                    </div>
                </div>
                <div class="tg-bonus">${bonusStr || '—'}</div>
                ${progressHtml}
                ${actionBtn}
            </div>
        `;
    }).join('');

    return `<div class="tg-grid">${cards}</div>`;
}

// 模块缓存（equipment.js calculateStats 引用）
window.__training_ground_module_cache = {
    calculateTrainingBonus,
};

window.startTraining = startTraining;
window.tickTraining = tickTraining;
window.calculateTrainingBonus = calculateTrainingBonus;
window.renderTrainingGroundInfo = renderTrainingGroundInfo;
window.startTrainingTicker = startTrainingTicker;
window.canStartTraining = canStartTraining;