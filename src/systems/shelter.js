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
    if (upgrade) {
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
    } else {
        Renderer.setText('shelter-income', 'MAX');
        Renderer.setText('shelter-drop', 'MAX');
    }
}

export function upgradeShelter() {
    const level = GameData.player.shelterLevel || 1;
    const upgrade = SHELTER_UPGRADE_COST[level];
    if (!upgrade) return;
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
