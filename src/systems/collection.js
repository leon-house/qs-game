/**
 * 图鉴系统
 */
import { GameData } from '../data/gameData.js?v=quick-actions-20260725k';
import { EQUIPMENT_TEMPLATES } from '../data/config.js?v=quick-actions-20260725k';
import { Renderer } from '../core/renderer.js?v=quick-actions-20260725k';

let currentCollectionType = 'equipment';

export function openCollection() {
    switchCollectionTab('equipment');
    Renderer.showModal('collection-modal');
}

export function closeCollection() {
    Renderer.hideModal('collection-modal');
}

export function switchCollectionTab(type) {
    currentCollectionType = type;
    document.querySelectorAll('.collection-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.type === type);
    });
    renderCollection();
}

export function renderCollection() {
    let items = [];
    const ownedEquipmentIds = new Set();
    const equipTypes = ['weapon', 'armor', 'head', 'clothes', 'cloak', 'boots', 'ring', 'amulet', 'accessory'];
    equipTypes.forEach(type => {
        if (GameData.player.equipment[type]) ownedEquipmentIds.add(GameData.player.equipment[type].id);
        (GameData.player.bag[type] || []).forEach(item => ownedEquipmentIds.add(item.id));
    });
    const ownedMaterials = new Set();
    (GameData.player.bag.material || []).forEach(m => ownedMaterials.add(m.id));
    const defeatedBosses = GameData.player.currentBossLevel || 1;

    if (currentCollectionType === 'equipment') {
        items = EQUIPMENT_TEMPLATES.weapon.concat(
            EQUIPMENT_TEMPLATES.armor, EQUIPMENT_TEMPLATES.head, EQUIPMENT_TEMPLATES.clothes,
            EQUIPMENT_TEMPLATES.boots, EQUIPMENT_TEMPLATES.cloak, EQUIPMENT_TEMPLATES.ring,
            EQUIPMENT_TEMPLATES.amulet, EQUIPMENT_TEMPLATES.accessory
        );
    } else if (currentCollectionType === 'materials') {
        items = [
            { id: 'enhance_stone', name: '强化石', icon: '🪨' },
            { id: 'm1', name: '废铁', icon: '🔩' },
            { id: 'm2', name: '零件', icon: '⚙️' },
            { id: 'm3', name: '能源', icon: '🔋' },
            { id: 'm4', name: '晶体', icon: '💎' },
            { id: 'm5', name: '核心', icon: '🌀' },
            { id: 'm6', name: '神性', icon: '✨' }
        ];
    } else if (currentCollectionType === 'gems') {
        items = [
            { id: 'ruby', name: '红宝石', icon: '🔴' },
            { id: 'sapphire', name: '蓝宝石', icon: '🔵' },
            { id: 'emerald', name: '绿宝石', icon: '🟢' },
            { id: 'topaz', name: '黄宝石', icon: '🟡' }
        ];
    } else if (currentCollectionType === 'bosses') {
        for (let i = 1; i <= Math.min(defeatedBosses, 50); i++) {
            items.push({ id: 'boss_' + i, name: 'Boss ' + i, icon: '👹' });
        }
        for (let i = Math.min(defeatedBosses, 50) + 1; i <= 50; i++) {
            items.push({ id: 'boss_' + i, name: '???', icon: '❓', locked: true });
        }
    }

    const html = items.map(item => {
        let collected = false;
        if (currentCollectionType === 'equipment') collected = ownedEquipmentIds.has(item.id);
        else if (currentCollectionType === 'materials') collected = ownedMaterials.has(item.id);
        else if (currentCollectionType === 'bosses') collected = !item.locked;
        return '<div class="collection-item ' + (collected ? 'collected' : '') + '"><div>' + (item.icon || '') + '</div><div class="col-name">' + (item.name || '') + '</div></div>';
    }).join('');
    Renderer.setHTML('collection-grid', html);
}

window.openCollection = openCollection;
window.closeCollection = closeCollection;
window.switchCollectionTab = switchCollectionTab;
