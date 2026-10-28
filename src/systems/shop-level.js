// ============================================================
//  src/systems/shop-level.js
//  商店等级系统（PRD v3 · 2026-08-04，替代 VIP）
//
//  - Lv.1~10，手动触发升级（玩家点按钮）
//  - 金币消耗递增 + 后期要零件/蓝图/高级能源
//  - 效果：紫/金装备概率 ×multiplier（1.0~1.80）
//
//  API:
//    upgradeShopLevel()        → 执行升级
//    canUpgradeShopLevel()     → 校验
//    getShopLevelMultiplier()  → 当前倍率
//    renderShopLevelInfo()     → UI HTML
// ============================================================

import { GameData, saveData, initNewFields } from '../data/gameData.js';
import { SHOP_LEVEL_CONFIG } from '../data/config.js';
import { showToast } from '../ui/ui.js';

export function getShopLevelMultiplier() {
    initNewFields();
    const lv = GameData.player.shopLevel || 1;
    return SHOP_LEVEL_CONFIG.levels[lv - 1].multiplier;
}

export function getNextShopLevelInfo() {
    initNewFields();
    const cur = GameData.player.shopLevel || 1;
    if (cur >= 10) return null;
    return SHOP_LEVEL_CONFIG.levels[cur];
}

export function canUpgradeShopLevel() {
    initNewFields();
    const next = getNextShopLevelInfo();
    if (!next) return { ok: false, reason: '已达最高 Lv.10' };
    const p = GameData.player;
    if ((p.gold || 0) < next.gold) return { ok: false, reason: `金币不足` };
    // blueprint / advancedEnergy 暂从顶层字段读（兼容老数据）
    const bp = p.blueprint || p.materials?.blueprint || 0;
    if (bp < next.blueprint) return { ok: false, reason: `蓝图不足` };
    const ae = p.materials?.advancedEnergy || 0;
    if (ae < next.advancedEnergy) return { ok: false, reason: `高级能源不足` };
    return { ok: true, reason: '' };
}

export function upgradeShopLevel() {
    initNewFields();
    const next = getNextShopLevelInfo();
    if (!next) {
        showToast('商店等级已达 Lv.10', 'warning');
        return false;
    }
    const check = canUpgradeShopLevel();
    if (!check.ok) {
        showToast(check.reason, 'error');
        return false;
    }
    const p = GameData.player;
    p.gold -= next.gold;
    // 蓝图扣减：优先从顶层 blueprint，否则 materials.blueprint
    if (p.blueprint !== undefined) p.blueprint -= next.blueprint;
    else if (p.materials) p.materials.blueprint = (p.materials.blueprint || 0) - next.blueprint;
    // 高级能源扣减
    if (p.materials) p.materials.advancedEnergy -= next.advancedEnergy;
    // 升级
    p.shopLevel += 1;
    saveData();
    showToast(`⭐ 商店升级到 Lv.${p.shopLevel}！紫/金概率 ×${next.multiplier.toFixed(2)}`, 'success');
    return true;
}

export function renderShopLevelInfo() {
    initNewFields();
    const p = GameData.player;
    const lv = p.shopLevel || 1;
    const cur = SHOP_LEVEL_CONFIG.levels[lv - 1];
    const next = getNextShopLevelInfo();
    const gold = p.gold || 0;
    const ae = p.materials?.advancedEnergy || 0;
    const bp = p.blueprint || p.materials?.blueprint || 0;

    let html = `
        <div class="sl-current">
            <div class="sl-stat-row">
                <span class="sl-label">⭐ 商店等级</span>
                <strong class="sl-stat-val">Lv.${lv}/10</strong>
            </div>
            <div class="sl-stat-row">
                <span class="sl-label">💎 紫/金装备概率</span>
                <strong class="sl-stat-val">× ${cur.multiplier.toFixed(2)}</strong>
            </div>
        </div>
    `;

    if (next) {
        html += `
            <div class="sl-next">
                <div class="sl-next-title">下一级 Lv.${lv + 1}</div>
                <div class="sl-preview">紫/金概率：×${cur.multiplier.toFixed(2)} → ×${next.multiplier.toFixed(2)}</div>
                <div class="sl-cost">
                    ${next.gold > 0 ? `<div class="sl-cost-row ${gold >= next.gold ? 'enough' : 'short'}">💰 金币：${gold.toLocaleString()}/${next.gold.toLocaleString()}</div>` : ''}
                    ${next.parts > 0 ? `<div class="sl-cost-row ${(p.parts || 0) >= next.parts ? 'enough' : 'short'}">🔧 零件：${p.parts || 0}/${next.parts}</div>` : ''}
                    ${next.blueprint > 0 ? `<div class="sl-cost-row ${bp >= next.blueprint ? 'enough' : 'short'}">📐 蓝图：${bp}/${next.blueprint}</div>` : ''}
                    ${next.advancedEnergy > 0 ? `<div class="sl-cost-row ${ae >= next.advancedEnergy ? 'enough' : 'short'}">⚡ 高级能源：${ae}/${next.advancedEnergy}</div>` : ''}
                </div>
                <button class="sl-upgrade-btn" onclick="window.upgradeShopLevelWithRefresh ? window.upgradeShopLevelWithRefresh() : window.upgradeShopLevel()">
                    ⭐ 提升商店等级
                </button>
            </div>
        `;
    } else {
        html += `<div class="sl-maxed">🏆 商店等级已达 Lv.10 · 紫/金 ×${cur.multiplier.toFixed(2)}</div>`;
    }
    return html;
}

window.upgradeShopLevel = upgradeShopLevel;
window.canUpgradeShopLevel = canUpgradeShopLevel;
window.getShopLevelMultiplier = getShopLevelMultiplier;
window.getNextShopLevelInfo = getNextShopLevelInfo;
window.renderShopLevelInfo = renderShopLevelInfo;