/**
 * 弹窗管理
 */
import { GameData, saveData } from '../data/gameData.js';
import { calculateStats, calculatePower, getEquipDesc, getEquipmentStats, updateEquipmentBar } from '../systems/equipment.js';
import { Renderer } from '../core/renderer.js';
import { formatNumber, showToast, updateUI } from './ui.js';

/**
 * 属性弹窗
 */
export function openStatsModal() {
    const stats = calculateStats();
    const power = calculatePower();
    const html = `
        <div class="stat-row" style="justify-content:center;font-size:18px;color:var(--orange);font-weight:900;">
            ⚔️ 战力 ${formatNumber(power)}
        </div>
        <div class="stat-row"><span class="stat-label">⚔️ 攻击</span><span class="stat-value attack">${stats.attack}</span></div>
        <div class="stat-row"><span class="stat-label">🛡️ 防御</span><span class="stat-value defense">${stats.defense}</span></div>
        <div class="stat-row"><span class="stat-label">❤️ 生命</span><span class="stat-value hp">${stats.hp}</span></div>
        <div class="stat-row"><span class="stat-label">⚡ 暴击</span><span class="stat-value crit">${stats.critRate}%</span></div>
        <div class="stat-row"><span class="stat-label">💥 爆伤</span><span class="stat-value" style="color:var(--orange);">${stats.critDamage || 50}%</span></div>
        <div class="stat-row"><span class="stat-label">🩸 吸血</span><span class="stat-value" style="color:var(--red);">${stats.lifeSteal || 0}%</span></div>
        <div class="stat-row"><span class="stat-label">🔗 连击</span><span class="stat-value" style="color:var(--purple);">${stats.combo || 0}%</span></div>
    `;
    Renderer.setHTML('stats-detail', html);
    Renderer.showModal('stats-modal');
}

export function closeStatsModal() {
    Renderer.hideModal('stats-modal');
}

/**
 * 背包弹窗
 */
let currentBagType = 'all';

export function openBag() {
    switchBagTab('all');
    Renderer.showModal('bag-modal');
}

export function closeBag() {
    Renderer.hideModal('bag-modal');
}

export function switchBagTab(type) {
    currentBagType = type;
    document.querySelectorAll('.bag-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.type === type);
    });
    renderBag();
}

function renderBag() {
    const grid = Renderer.$('bag-grid');
    if (!grid) return;
    const bag = GameData.player.bag;
    let items = [];

    if (currentBagType === 'all' || currentBagType === 'equipment') {
        const equipTypes = ['weapon', 'armor', 'head', 'clothes', 'cloak', 'boots', 'ring', 'amulet', 'accessory'];
        equipTypes.forEach(t => {
            (bag[t] || []).forEach((item, idx) => {
                items.push({ ...item, _type: t, _index: idx });
            });
        });
    } else if (currentBagType === 'material') {
        (bag.material || []).forEach((item, idx) => {
            items.push({ ...item, _type: 'material', _index: idx });
        });
    }

    if (items.length === 0) {
        grid.innerHTML = '<div class="empty-bag"><div class="empty-bag-icon">🎒</div><div>背包空空如也</div></div>';
        return;
    }

    const typeIcons = { weapon: '🗡️', armor: '🛡️', head: '⛑️', clothes: '👕', cloak: '🦺', boots: '👢', ring: '💍', amulet: '🧿', accessory: '🎀', material: '📦' };
    grid.innerHTML = items.map(item => {
        const type = item._type;
        const index = item._index;
        const equipped = GameData.player.equipment[type]?.id === item.id ? 'equipped' : '';
        let statsText = '';
        let levelText = '';

        if (type === 'material') {
            statsText = 'x' + item.count;
        } else {
            const levelMultiplier = 1 + (item.level - 1) * 0.15;
            const stats = [];
            const atk = Math.floor((item.baseAttack || 0) * levelMultiplier);
            const def = Math.floor((item.baseDefense || 0) * levelMultiplier);
            const hp = Math.floor((item.baseHp || 0) * levelMultiplier);
            const crit = Math.floor((item.baseCritRate || 0) * levelMultiplier);
            const critDmg = Math.floor((item.baseCritDamage || 0) * levelMultiplier);
            const lifeSteal = Math.floor((item.baseLifeSteal || 0) * levelMultiplier);
            const combo = Math.floor((item.baseCombo || 0) * levelMultiplier);
            if (atk) stats.push('攻+' + atk);
            if (def) stats.push('防+' + def);
            if (hp) stats.push('血+' + hp);
            if (crit) stats.push('暴+' + crit + '%');
            if (critDmg) stats.push('爆伤+' + critDmg + '%');
            if (lifeSteal) stats.push('吸血+' + lifeSteal + '%');
            if (combo) stats.push('连击+' + combo + '%');
            statsText = stats.join(' ');
            levelText = 'Lv.' + item.level;
        }

        return '<div class="bag-item ' + equipped + ' ' + item.quality + '" onclick="handleBagItemClick(\'' + type + '\',' + index + ')" oncontextmenu="showItemMenu(event,\'' + type + '\',' + index + ')">' +
            '<div class="bag-item-icon">' + (typeIcons[type] || '📦') + '</div>' +
            '<div class="bag-item-name">' + item.name + '</div>' +
            (levelText ? '<div class="bag-item-level">' + levelText + '</div>' : '') +
            '<div class="bag-item-stats">' + statsText + '</div>' +
            '</div>';
    }).join('');
}

/**
 * 物品菜单（右键）
 */
export function showItemMenu(event, type, index) {
    event.preventDefault();
    if (type === 'material') return;

    const item = GameData.player.bag[type][index];
    if (!item) return;

    const desc = getEquipDesc(item);
    const existingMenu = Renderer.$('item-menu');
    if (existingMenu) existingMenu.remove();

    const menu = Renderer.create('div', {
        id: 'item-menu',
        className: 'item-menu',
        style: 'position:fixed;left:' + event.clientX + 'px;top:' + event.clientY + 'px;'
    });

    const upgradeCost = Math.floor((item.price || 100) * Math.pow(1.5, item.level));
    const sellPrice = Math.floor((item.price || 100) * 0.5);

    menu.innerHTML = (desc ? '<div style="padding:8px 12px;font-size:11px;color:var(--text-secondary);font-style:italic;border-bottom:1px solid rgba(255,255,255,0.1);margin-bottom:4px;line-height:1.4;">"' + desc + '"</div>' : '') +
        '<div class="menu-item" onclick="upgradeItem(\'' + type + '\',' + index + ')"><div class="menu-item-title">⬆️ 升级</div><div class="menu-item-cost">💰 ' + upgradeCost + '</div></div>' +
        '<div class="menu-item" onclick="sellItem(\'' + type + '\',' + index + ')"><div class="menu-item-title">💰 出售</div><div class="menu-item-cost" style="color:var(--gold);">+' + sellPrice + '</div></div>' +
        '<div class="menu-item" onclick="closeItemMenu()"><div class="menu-item-title">❌ 取消</div></div>';

    document.body.appendChild(menu);
    setTimeout(() => document.addEventListener('click', closeItemMenu, { once: true }), 100);
}

export function closeItemMenu() {
    const menu = Renderer.$('item-menu');
    if (menu) menu.remove();
}

window.openStatsModal = openStatsModal;
window.closeStatsModal = closeStatsModal;
window.openBag = openBag;
window.closeBag = closeBag;
window.switchBagTab = switchBagTab;
window.showItemMenu = showItemMenu;
window.closeItemMenu = closeItemMenu;
window.handleBagItemClick = function(type, index) {
    if (type === 'material') return;
    const item = GameData.player.bag[type][index];
    if (!item) return;
    const current = GameData.player.equipment[type];
    if (current && current.id === item.id) {
        GameData.player.equipment[type] = null;
    } else {
        GameData.player.equipment[type] = item;
    }
    saveData();
    switchBagTab(currentBagType);
};

/**
 * 装备槽选择（点击装备位弹出选择面板）
 */
const equipTypeNames = {
    head: '头盔', clothes: '衣服', weapon: '武器', cloak: '披风',
    armor: '防具', boots: '鞋', ring: '戒指', amulet: '护符', accessory: '饰品'
};
const equipIcons = {
    head: '⛑️', clothes: '👕', weapon: '🗡️', cloak: '🦺',
    armor: '🛡️', boots: '👢', ring: '💍', amulet: '🧿', accessory: '🎀'
};

export function openEquipSelect(type) {
    const items = GameData.player.bag[type];
    if (!items || items.length === 0) {
        showToast(`背包中没有${equipTypeNames[type] || type}`, 'warning');
        return;
    }

    const existing = Renderer.$('equip-select-panel');
    if (existing) existing.remove();

    const panel = Renderer.create('div', {
        id: 'equip-select-panel',
        style: 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
            'background:rgba(30,30,30,0.98);border:1px solid rgba(255,255,255,0.15);' +
            'border-radius:16px;padding:20px;z-index:2000;width:90%;max-width:360px;' +
            'max-height:70vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.5);'
    });

    let html = `<div style="font-size:16px;font-weight:700;margin-bottom:12px;text-align:center;">${equipIcons[type]} 选择${equipTypeNames[type]}</div>`;

    const current = GameData.player.equipment[type];
    if (current) {
        html += `<div style="padding:10px;background:rgba(34,197,94,0.15);border-radius:8px;margin-bottom:12px;cursor:pointer;" onclick="unequipItem('${type}')">
            <div style="font-size:12px;color:var(--green);">已装备</div>
            <div style="font-size:14px;font-weight:600;">${current.name} Lv.${current.level}</div>
        </div>`;
    }

    html += '<div style="display:flex;flex-direction:column;gap:8px;">';
    items.forEach((item, index) => {
        const isEquipped = current && current.id === item.id;
        const stats = getEquipmentStats(item);
        const statsText = [];
        if (stats.attack) statsText.push(`攻+${stats.attack}`);
        if (stats.defense) statsText.push(`防+${stats.defense}`);
        if (stats.hp) statsText.push(`血+${stats.hp}`);
        if (stats.critRate) statsText.push(`暴+${stats.critRate}%`);

        html += `
            <div class="bag-item ${item.quality}" onclick="equipFromSelect('${type}', ${index})"
                 style="padding:12px;border-radius:8px;cursor:pointer;${isEquipped ? 'background:rgba(34,197,94,0.2);border:2px solid var(--green);' : ''}">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <div style="font-size:14px;font-weight:600;">${item.name} Lv.${item.level}</div>
                        <div style="font-size:11px;color:var(--green);">${statsText.join(' · ')}</div>
                    </div>
                    ${isEquipped ? '<span style="color:var(--green);">✓</span>' : ''}
                </div>
            </div>
        `;
    });
    html += '</div>';

    html += `<button onclick="closeEquipSelect()" style="margin-top:16px;width:100%;padding:12px;background:rgba(60,60,60,0.8);border:none;border-radius:8px;color:var(--text-primary);cursor:pointer;">关闭</button>`;

    panel.innerHTML = html;
    document.body.appendChild(panel);
}

export function closeEquipSelect() {
    const panel = Renderer.$('equip-select-panel');
    if (panel) panel.remove();
}

export function equipFromSelect(type, index) {
    const item = GameData.player.bag[type][index];
    if (!item) return;
    GameData.player.equipment[type] = item;
    showToast(`已装备 ${item.name}`, 'success');
    closeEquipSelect();
    saveData();
    updateUI();
    updateEquipmentBar();
}

export function unequipItem(type) {
    GameData.player.equipment[type] = null;
    showToast('已卸下');
    closeEquipSelect();
    saveData();
    updateUI();
    updateEquipmentBar();
}

window.openEquipSelect = openEquipSelect;
window.closeEquipSelect = closeEquipSelect;
window.equipFromSelect = equipFromSelect;
window.unequipItem = unequipItem;
