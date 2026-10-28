/**
 * 庇护所系统
 */
import { GameData, saveData } from '../data/gameData.js';
import { SHELTER_UPGRADE_COST } from '../data/config.js';
import { Renderer } from '../core/renderer.js';

export function openShelter() {
    updateShelterUI();
    Renderer.showModal('shelter-modal');
}

export function closeShelter() {
    Renderer.hideModal('shelter-modal');
}

export function updateShelterUI() {
    const level = GameData.player.shelterLevel || 1;
    const upgrade = SHELTER_UPGRADE_COST[level];
    Renderer.setText('shelter-level', level);
    if (upgrade && Array.isArray(upgrade.materials)) {
        const incomeBonus = upgrade.incomeBonus;
        const dropBonus = upgrade.dropBonus;
        Renderer.setText('shelter-income', '+' + incomeBonus + '%');
        Renderer.setText('shelter-drop', '+' + dropBonus + '%');
        const itemsEl = Renderer.$('upgrade-items');
        if (itemsEl) {
            let html = upgrade.materials.map(m => {
                const mat = GameData.player.bag.material.find(bm => bm.id === m.id);
                const count = mat ? mat.count : 0;
                const enough = count >= m.count;
                return '<div style="' + (enough ? '' : 'color:red') + '">' + m.id + ': ' + count + '/' + m.count + '</div>';
            }).join('');
            itemsEl.innerHTML = html;
        }
    } else if (upgrade) {
        // 兼容 config.js 现有 schema：{ food, water, scrap }（没有 materials 数组）
        Renderer.setText('shelter-income', '+' + (upgrade.incomeBonus || 0) + '%');
        Renderer.setText('shelter-drop', '+' + (upgrade.dropBonus || 0) + '%');
        const itemsEl = Renderer.$('upgrade-items');
        if (itemsEl) {
            itemsEl.innerHTML = Object.entries(upgrade)
                .map(([k, v]) => '<div>' + k + ': ' + v + '</div>')
                .join('');
        }
    } else {
        Renderer.setText('shelter-income', 'MAX');
        Renderer.setText('shelter-drop', 'MAX');
    }
}

export function upgradeShelter() {
    const level = GameData.player.shelterLevel || 1;
    const upgrade = SHELTER_UPGRADE_COST[level];
    // config.js 里 SHELTER_UPGRADE_COST 是 { food, water, scrap }，没有 materials 数组，
    // 旧版「按 materials 扣材料」的升级逻辑无法执行 —— 安全返回，别抛异常。
    if (!upgrade || !Array.isArray(upgrade.materials)) return;
    const canUpgrade = upgrade.materials.every(m => {
        const mat = GameData.player.bag.material.find(bm => bm.id === m.id);
        return mat && mat.count >= m.count;
    });
    if (!canUpgrade) return;
    upgrade.materials.forEach(m => {
        const mat = GameData.player.bag.material.find(bm => bm.id === m.id);
        mat.count -= m.count;
    });
    GameData.player.shelterLevel++;
    saveData();
    updateShelterUI();
}

window.openShelter = openShelter;
window.closeShelter = closeShelter;
window.upgradeShelter = upgradeShelter;
