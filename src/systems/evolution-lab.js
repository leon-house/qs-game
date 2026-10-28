// ============================================================
//  src/systems/evolution-lab.js
//  进化所系统（PRD v3 · 2026-08-04）
//
//  - 10 个基因层级，每层不可逆升级
//  - 升级条件：进化胶囊 + 材料（金币/蓝图/radPotion/高级能源）
//  - 升级效果：永久属性加成（attack / critRate / critDamage / attackSpeed）
//  - 胶囊获取：商店（60金币/颗）/ Boss 战 / 挂机
//
//  API:
//    canUpgradeEvolution()                  → 是否能升下一级
//    upgradeEvolution()                     → 执行升级
//    calculateEvolutionBonus()              → 当前已激活的累计属性加成
//    getNextLevelInfo()                     → 下一级所需材料预览
// ============================================================

import { GameData, saveData, initNewFields } from '../data/gameData.js';
import { EVOLUTION_LAB_CONFIG } from '../data/config.js';
import { showToast } from '../ui/ui.js';

/**
 * 获取下一级升级配置（level=N 时查 levels[N]）
 * 如果已满级（level=10），返回 null
 */
export function getNextLevelInfo() {
    initNewFields();
    const p = GameData.player;
    const cur = p.evolutionLab.level || 0;
    if (cur >= 10) return null;
    return EVOLUTION_LAB_CONFIG.levels[cur]; // levels[0] = 第 1 级
}

/**
 * 是否可以升级（材料 + 金币都够）
 */
export function canUpgradeEvolution() {
    initNewFields();
    const next = getNextLevelInfo();
    if (!next) return { ok: false, reason: '已满级' };
    const p = GameData.player;
    if ((p.materials.evolutionCapsules || 0) < next.capsules) {
        return { ok: false, reason: `进化胶囊不足（${p.materials.evolutionCapsules || 0}/${next.capsules}）` };
    }
    if ((p.gold || 0) < next.gold) {
        return { ok: false, reason: `金币不足（${p.gold || 0}/${next.gold}）` };
    }
    // 检查每种材料
    for (const [key, need] of Object.entries(next.materials)) {
        if (need <= 0) continue;
        const have = p[key === 'food' ? 'food'
            : key === 'parts' ? 'parts'
            : key === 'radPotion' ? 'radPotion'
            : key === 'blueprint' ? 'blueprint'
            : 'materials']?.[key === 'advancedEnergy' ? 'advancedEnergy' : key] || 0;
        // 注：food/water/scrap/parts/radPotion/blueprint 未来需资源池；advancedEnergy 在 materials 子对象
        // Phase 1 简化：radPotion + blueprint + advancedEnergy 都从 materials 子对象取
        // 后续阶段接入完整资源池时调整
    }
    // 简化：Phase 1 只校验 capsules + gold（材料检查留给 Phase 2）
    return { ok: true, reason: '' };
}

/**
 * 执行升级（不可逆）
 */
export function upgradeEvolution() {
    initNewFields();
    const next = getNextLevelInfo();
    if (!next) {
        showToast('基因已达最高层级 Lv.10', 'warning');
        return false;
    }
    const check = canUpgradeEvolution();
    if (!check.ok) {
        showToast(check.reason, 'error');
        return false;
    }
    const p = GameData.player;

    // 扣进化胶囊
    p.materials.evolutionCapsules -= next.capsules;
    p.evolutionLab.totalCapsules = (p.evolutionLab.totalCapsules || 0) + next.capsules;

    // 扣金币
    p.gold -= next.gold;

    // 扣材料（从 materials 子对象或顶层字段）
    for (const [key, need] of Object.entries(next.materials)) {
        if (need <= 0) continue;
        if (key === 'advancedEnergy') {
            p.materials.advancedEnergy = (p.materials.advancedEnergy || 0) - need;
        }
        // food/parts/radPotion/blueprint 暂未启用（Phase 2 接入完整资源池）
    }

    // 升级
    p.evolutionLab.level += 1;
    saveData();

    showToast(`🧬 基因进化 Lv.${p.evolutionLab.level}！属性大幅提升`, 'success');
    return true;
}

/**
 * 计算当前累计永久属性加成
 * 返回 { attack, critRate, critDamage, attackSpeed }
 */
export function calculateEvolutionBonus() {
    initNewFields();
    const p = GameData.player;
    const lv = p.evolutionLab.level || 0;
    const result = { attack: 0, critRate: 0, critDamage: 0, attackSpeed: 0 };
    for (let i = 0; i < lv; i++) {
        const bonus = EVOLUTION_LAB_CONFIG.levels[i].bonus;
        for (const [k, v] of Object.entries(bonus)) {
            result[k] = (result[k] || 0) + v;
        }
    }
    return result;
}

/**
 * UI 渲染：当前等级 + 下一级预览
 */
export function renderEvolutionLabInfo() {
    const p = GameData.player;
    const lv = p.evolutionLab.level || 0;
    const next = getNextLevelInfo();
    const bonus = calculateEvolutionBonus();

    let html = `
        <div class="evo-current">
            <div class="evo-label">当前基因层级</div>
            <div class="evo-level">Lv.${lv}<span class="evo-max">/10</span></div>
        </div>
        <div class="evo-bonus">
            <div class="evo-bonus-title">累计永久属性</div>
            ${bonus.attack > 0 ? `<div class="evo-bonus-row">⚔️ attack <strong>+${bonus.attack}</strong></div>` : ''}
            ${bonus.critRate > 0 ? `<div class="evo-bonus-row">🎯 critRate <strong>+${bonus.critRate}%</strong></div>` : ''}
            ${bonus.critDamage > 0 ? `<div class="evo-bonus-row">💥 critDamage <strong>+${bonus.critDamage.toFixed(2)}</strong></div>` : ''}
            ${bonus.attackSpeed > 0 ? `<div class="evo-bonus-row">⚡ attackSpeed <strong>+${bonus.attackSpeed.toFixed(2)}</strong></div>` : ''}
            ${lv === 0 ? '<div class="evo-bonus-empty">尚未激活</div>' : ''}
        </div>
    `;

    if (next) {
        const caps = p.materials.evolutionCapsules || 0;
        const gold = p.gold || 0;
        html += `
            <div class="evo-next">
                <div class="evo-next-title">下一级：基因 Lv.${lv + 1}</div>
                <div class="evo-reward-preview">
                    属性预览：
                    ${next.bonus.attack ? `⚔️ +${next.bonus.attack}` : ''}
                    ${next.bonus.critRate ? `🎯 +${next.bonus.critRate}%` : ''}
                    ${next.bonus.critDamage ? `💥 +${next.bonus.critDamage.toFixed(2)}` : ''}
                    ${next.bonus.attackSpeed ? `⚡ +${next.bonus.attackSpeed.toFixed(2)}` : ''}
                </div>
                <div class="evo-cost">
                    <div class="evo-cost-row ${caps >= next.capsules ? 'enough' : 'short'}">
                        🧬 进化胶囊：${caps}/${next.capsules}
                    </div>
                    <div class="evo-cost-row ${gold >= next.gold ? 'enough' : 'short'}">
                        💰 金币：${gold.toLocaleString()}/${next.gold.toLocaleString()}
                    </div>
                </div>
                <button class="evo-upgrade-btn" onclick="window.upgradeEvolutionWithRefresh ? window.upgradeEvolutionWithRefresh() : window.upgradeEvolution()">
                    ▶ 开始进化
                </button>
            </div>
        `;
    } else {
        html += `
            <div class="evo-maxed">
                <div>🏆 基因已达最高层级 Lv.10</div>
                <div style="font-size:11px;color:var(--text-secondary);margin-top:8px;">
                    累计消耗 ${p.evolutionLab.totalCapsules || 0} 颗进化胶囊
                </div>
            </div>
        `;
    }

    return html;
}

// ============================================================
// 桥接到 window（兼容 HTML onclick）
// ============================================================
window.getNextLevelInfo = getNextLevelInfo;
window.canUpgradeEvolution = canUpgradeEvolution;
window.upgradeEvolution = upgradeEvolution;
window.calculateEvolutionBonus = calculateEvolutionBonus;
window.renderEvolutionLabInfo = renderEvolutionLabInfo;