// ============================================================
//  src/systems/power-plant.js
//  发电站系统（PRD v3 · 2026-08-04）
//
//  - 10 级升级（废铁 + 高级能源 + 金币）
//  - 效果：离线时间上限 8h→48h，倍率 1.0×→2.0×
//  - 离线收益公式接入 main.js getIdleIncome()
//
//  API:
//    upgradePowerPlant()       → 执行升级
//    canUpgradePowerPlant()    → 校验
//    getNextPowerPlantInfo()   → 下一级预览
//    renderPowerPlantInfo()    → UI HTML 字符串
// ============================================================

import { GameData, saveData, initNewFields } from '../data/gameData.js';
import { POWER_PLANT_CONFIG } from '../data/config.js';
import { showToast } from '../ui/ui.js';

export function getNextPowerPlantInfo() {
    initNewFields();
    const p = GameData.player;
    const cur = p.powerPlant.level || 1;
    if (cur >= 10) return null;
    return POWER_PLANT_CONFIG.levels[cur]; // levels[1] = 第 2 级
}

export function canUpgradePowerPlant() {
    initNewFields();
    const next = getNextPowerPlantInfo();
    if (!next) return { ok: false, reason: '已达最高 Lv.10' };
    const p = GameData.player;
    if ((p.materials.advancedEnergy || 0) < next.advancedEnergy) {
        return { ok: false, reason: `高级能源不足（${p.materials.advancedEnergy || 0}/${next.advancedEnergy}）` };
    }
    if ((p.gold || 0) < next.gold) {
        return { ok: false, reason: `金币不足（${p.gold || 0}/${next.gold}）` };
    }
    return { ok: true, reason: '' };
}

export function upgradePowerPlant() {
    initNewFields();
    const next = getNextPowerPlantInfo();
    if (!next) {
        showToast('发电站已达最高 Lv.10', 'warning');
        return false;
    }
    const check = canUpgradePowerPlant();
    if (!check.ok) {
        showToast(check.reason, 'error');
        return false;
    }
    const p = GameData.player;
    p.materials.advancedEnergy -= next.advancedEnergy;
    p.gold -= next.gold;
    p.powerPlant.level += 1;
    p.powerPlant.offlineCapSeconds = next.offlineCapHours * 3600;
    p.powerPlant.offlineMultiplier = next.multiplier;
    saveData();
    showToast(`⚡ 发电站升级 Lv.${p.powerPlant.level}！离线收益 ×${next.multiplier.toFixed(2)}`, 'success');
    return true;
}

export function renderPowerPlantInfo() {
    initNewFields();
    const p = GameData.player;
    const lv = p.powerPlant.level || 1;
    const cur = POWER_PLANT_CONFIG.levels[lv - 1];
    const next = getNextPowerPlantInfo();
    const ae = p.materials.advancedEnergy || 0;
    const gold = p.gold || 0;

    let html = `
        <div class="pp-current">
            <div class="pp-stat-row">
                <span class="pp-label">⏱ 离线时间上限</span>
                <strong class="pp-stat-val">${cur.offlineCapHours} 小时</strong>
            </div>
            <div class="pp-stat-row">
                <span class="pp-label">💎 离线产出倍率</span>
                <strong class="pp-stat-val">× ${cur.multiplier.toFixed(2)}</strong>
            </div>
        </div>
    `;

    if (next) {
        html += `
            <div class="pp-next">
                <div class="pp-next-title">下一级 Lv.${lv + 1}</div>
                <div class="pp-preview">
                    时间上限：${cur.offlineCapHours}h → ${next.offlineCapHours}h
                    &nbsp;|&nbsp; 倍率：×${cur.multiplier.toFixed(2)} → ×${next.multiplier.toFixed(2)}
                </div>
                <div class="pp-cost">
                    <div class="pp-cost-row ${ae >= next.advancedEnergy ? 'enough' : 'short'}">
                        ⚡ 高级能源：${ae}/${next.advancedEnergy}
                    </div>
                    <div class="pp-cost-row ${gold >= next.gold ? 'enough' : 'short'}">
                        💰 金币：${gold.toLocaleString()}/${next.gold.toLocaleString()}
                    </div>
                </div>
                <button class="pp-upgrade-btn" onclick="window.upgradePowerPlantWithRefresh ? window.upgradePowerPlantWithRefresh() : window.upgradePowerPlant()">
                    ⚡ 升级发电站
                </button>
            </div>
        `;
    } else {
        html += `<div class="pp-maxed">🏆 发电站已达最高 Lv.10 · 离线 ×${cur.multiplier.toFixed(2)} · 48h 封顶</div>`;
    }
    return html;
}

// 模块缓存（equipment.js calculateStats 引用）
window.__power_plant_module_cache = {
    calculatePowerPlantBonus: () => {
        const lv = (GameData.player?.powerPlant?.level || 1);
        return POWER_PLANT_CONFIG.levels[lv - 1];
    },
};

window.upgradePowerPlant = upgradePowerPlant;
window.canUpgradePowerPlant = canUpgradePowerPlant;
window.getNextPowerPlantInfo = getNextPowerPlantInfo;
window.renderPowerPlantInfo = renderPowerPlantInfo;