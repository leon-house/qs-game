/**
 * 弹窗管理
 */
import { GameData, saveData } from '../data/gameData.js?v=equip-mini-btns-20260725n';
import { calculateStats, calculatePower, getEquipDesc, getEquipmentStats, updateEquipmentBar } from '../systems/equipment.js?v=equip-mini-btns-20260725n';
import { Renderer } from '../core/renderer.js?v=equip-mini-btns-20260725n';
import { formatNumber, showToast, updateUI } from './ui.js?v=equip-mini-btns-20260725n';

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
    // ★ 点装备图标 → 弹二级详情弹窗（信息+属性+装备/出售/分解三按钮）
    showEquipDetail(type, index);
};

/**
 * 装备详情二级弹窗
 */
export function showEquipDetail(type, index) {
    const item = GameData.player.bag[type][index];
    if (!item) return;

    const existing = Renderer.$('equip-detail-panel');
    if (existing) existing.remove();

    const current = GameData.player.equipment[type];
    const isEquipped = current && current.id === item.id;
    const stats = getEquipmentStats(item);

    const typeNames = {
        weapon: '武器', armor: '防具', head: '头盔', clothes: '衣服',
        cloak: '披风', boots: '鞋', ring: '戒指', amulet: '护符', accessory: '饰品'
    };
    const typeIcons = {
        weapon: '🗡️', armor: '🛡️', head: '⛑️', clothes: '👕',
        cloak: '🦺', boots: '👢', ring: '💍', amulet: '🧿', accessory: '🎀'
    };

    const qualityColors = {
        white: '#cccccc', green: '#4caf50', blue: '#2196f3',
        purple: '#9c27b0', orange: '#ff9800', red: '#f44336'
    };

    // 属性行
    const statRows = [];
    if (stats.attack) statRows.push({ icon: '⚔️', label: '攻击', value: stats.attack, color: 'var(--orange)' });
    if (stats.defense) statRows.push({ icon: '🛡️', label: '防御', value: stats.defense, color: 'var(--blue)' });
    if (stats.hp) statRows.push({ icon: '❤️', label: '生命', value: stats.hp, color: 'var(--red)' });
    if (stats.critRate) statRows.push({ icon: '⚡', label: '暴击', value: stats.critRate + '%', color: 'var(--gold)' });
    if (stats.critDamage) statRows.push({ icon: '💥', label: '爆伤', value: stats.critDamage + '%', color: 'var(--orange)' });
    if (stats.lifeSteal) statRows.push({ icon: '🩸', label: '吸血', value: stats.lifeSteal + '%', color: 'var(--red)' });
    if (stats.combo) statRows.push({ icon: '🔗', label: '连击', value: stats.combo + '%', color: 'var(--purple)' });

    const sellPrice = Math.floor((item.price || 100) * 0.5 * (1 + (item.level - 1) * 0.2));
    const stones = Math.max(1, Math.floor((item.level || 1) * 0.5));

    const html = `
        <div class="equip-detail">
            <div class="equip-detail-header ${item.quality}" style="display:flex;align-items:center;gap:12px;padding:16px;border-bottom:1px solid rgba(255,255,255,0.1);">
                <div class="equip-detail-icon" style="font-size:48px;flex-shrink:0;">${typeIcons[type] || '📦'}</div>
                <div class="equip-detail-title" style="flex:1;">
                    <div class="equip-detail-name" style="color:${qualityColors[item.quality] || '#fff'};font-size:18px;font-weight:700;">${item.name}</div>
                    <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">
                        ${typeNames[type] || type} · Lv.${item.level} · ${item.quality === 'red' ? '传说' : item.quality === 'orange' ? '史诗' : item.quality === 'purple' ? '稀有' : item.quality === 'blue' ? '优秀' : item.quality === 'green' ? '普通' : '劣质'}
                    </div>
                    ${isEquipped ? '<div style="font-size:11px;color:var(--success);margin-top:4px;">✓ 已装备</div>' : ''}
                </div>
                <div class="equip-detail-close" onclick="closeEquipDetail()" style="cursor:pointer;font-size:24px;color:var(--text-secondary);line-height:1;flex-shrink:0;">×</div>
            </div>
            ${item.desc ? `<div class="equip-detail-desc" style="font-size:12px;color:var(--text-secondary);font-style:italic;padding:8px 12px;background:rgba(0,0,0,0.3);border-left:3px solid var(--gold);margin:12px;line-height:1.5;border-radius:4px;">${item.desc}</div>` : ''}
            <div class="equip-detail-stats" style="display:flex;flex-direction:column;gap:6px;padding:0 12px;">
                ${statRows.length > 0 ? statRows.map(r => `
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:rgba(0,0,0,0.25);border-radius:6px;">
                        <span style="font-size:13px;">${r.icon} ${r.label}</span>
                        <span style="font-size:14px;font-weight:700;color:${r.color};">+${r.value}</span>
                    </div>
                `).join('') : '<div style="text-align:center;color:var(--text-secondary);padding:8px;">无附加属性</div>'}
            </div>
            <div class="equip-detail-actions" style="display:flex;flex-direction:column;gap:8px;padding:12px;">
                <button onclick="${isEquipped ? 'unequipItem(\'' + type + '\')' : 'equipItem(\'' + type + '\',' + index + ')'}"
                    style="padding:12px;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;
                           background:${isEquipped ? 'linear-gradient(135deg, #ff6b6b, #c0392b)' : 'linear-gradient(135deg, var(--success), #2e7d32)'};color:#fff;">
                    ${isEquipped ? '📤 卸下' : '⚔️ 装备'}
                </button>
                <div style="display:flex;gap:8px;">
                    <button onclick="sellItem('${type}', ${index})"
                        style="flex:1;padding:10px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;
                               background:linear-gradient(135deg, #ffc107, #ff9800);color:#1a1a2e;">
                        💰 出售<br><span style="font-size:11px;opacity:0.9;">+${sellPrice}金币</span>
                    </button>
                    <button onclick="decomposeItem('${type}', ${index})"
                        style="flex:1;padding:10px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;
                               background:linear-gradient(135deg, #9c27b0, #6a1b9a);color:#fff;">
                        🔮 分解<br><span style="font-size:11px;opacity:0.9;">+${stones}强化石</span>
                    </button>
                </div>
            </div>
        </div>
    `;

    // ★ 先移除旧 backdrop（避免重复叠加）
    const oldBackdrop = document.getElementById('equip-detail-backdrop');
    if (oldBackdrop) oldBackdrop.remove();

    // ★ 背景遮罩：点击即关闭弹窗
    const backdrop = Renderer.create('div', {
        id: 'equip-detail-backdrop',
        className: 'equip-detail-backdrop',
        style: 'position:fixed;top:0;left:0;width:100%;height:100%;' +
            'background:rgba(0,0,0,0.7);z-index:1999;'
    });
    backdrop.addEventListener('click', closeEquipDetail);
    document.body.appendChild(backdrop);

    const panel = Renderer.create('div', {
        id: 'equip-detail-panel',
        className: 'equip-detail-panel',
        style: 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
            'background:rgba(30,30,30,0.98);border:1px solid rgba(255,255,255,0.15);' +
            'border-radius:16px;padding:0;z-index:2000;width:90%;max-width:380px;' +
            'max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.7);'
    });
    panel.innerHTML = html;
    // ★ 阻止面板内部点击冒泡到 backdrop（避免点内部也关闭）
    panel.addEventListener('click', (e) => e.stopPropagation());
    document.body.appendChild(panel);
}

export function closeEquipDetail() {
    // 关闭弹窗面板
    const panel = Renderer.$('equip-detail-panel');
    if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
    // ★ 同步移除背景遮罩
    const backdrop = document.getElementById('equip-detail-backdrop');
    if (backdrop && backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
}

/**
 * 从详情弹窗装备（单件，按 index 精确装备）
 */
export function equipItem(type, index) {
    const item = GameData.player.bag[type][index];
    if (!item) {
        showToast('装备不存在', 'warning');
        return;
    }
    const current = GameData.player.equipment[type];
    if (current && current.id === item.id) {
        showToast('这件已经装备了', 'warning');
        return;
    }
    GameData.player.equipment[type] = item;  // ★ 按 index 精确装备单件
    showToast(`已装备 ${item.name}`, 'success');
    closeEquipDetail();
    saveData();
    updateUI();
    updateEquipmentBar();
    switchBagTab(currentBagType);
}

/**
 * 出售装备（从详情弹窗调用）
 */
export function sellItem(type, index) {
    const item = GameData.player.bag[type][index];
    if (!item) return;
    const sellPrice = Math.floor((item.price || 100) * 0.5 * (1 + (item.level - 1) * 0.2));

    // 如果已装备，卸下
    if (GameData.player.equipment[type]?.id === item.id) {
        GameData.player.equipment[type] = null;
    }

    GameData.player.bag[type].splice(index, 1);
    GameData.player.gold += sellPrice;
    showToast(`出售 ${item.name} +${sellPrice} 金币`, 'success');
    closeEquipDetail();
    closeItemMenu();
    saveData();
    updateUI();
    updateEquipmentBar();
    switchBagTab(currentBagType);
}

/**
 * 分解装备（从详情弹窗调用）— 获得强化石 + 材料
 */
export function decomposeItem(type, index) {
    const item = GameData.player.bag[type][index];
    if (!item) return;

    if (GameData.player.equipment[type]?.id === item.id) {
        GameData.player.equipment[type] = null;
    }

    const stones = Math.max(1, Math.floor((item.level || 1) * 0.5));
    const matId = item.quality === 'red' ? 'm5' :
                  item.quality === 'orange' ? 'm4' :
                  item.quality === 'purple' ? 'm3' :
                  item.quality === 'blue' ? 'm2' : 'm1';
    const matNames = { m1: '废铁', m2: '零件', m3: '能源', m4: '晶体', m5: '钛金' };
    const matName = matNames[matId];

    const existing = (GameData.player.bag.material || []).find(m => m.id === matId);
    if (existing) existing.count += 1;
    else GameData.player.bag.material.push({ id: matId, name: matName, icon: '🔩', count: 1 });

    const enhance = (GameData.player.bag.material || []).find(m => m.id === 'enhance_stone');
    if (enhance) enhance.count += stones;
    else GameData.player.bag.material.push({ id: 'enhance_stone', name: '强化石', icon: '🪨', count: stones });

    GameData.player.bag[type].splice(index, 1);

    showToast(`分解 ${item.name}：+${stones}强化石 +1${matName}`, 'success');
    closeEquipDetail();
    closeItemMenu();
    saveData();
    updateUI();
    updateEquipmentBar();
    switchBagTab(currentBagType);
}

/**
 * 装备槽选择（点击装备位弹出选择面板）
 */
const equipTypeNames = {
    head: '头盔', clothes: '衣服', weapon: '武器', cloak: '披风',
    armor: '防具', boots: '鞋', ring: '戒指', amulet: '护符', accessory: '饰品'
};
const equipIcons = {
    head: '<img src="assets/images/equip/head.png" class="equip-modal-icon">',
    clothes: '<img src="assets/images/equip/clothes.png" class="equip-modal-icon">',
    weapon: '<img src="assets/images/equip/weapon.png" class="equip-modal-icon">',
    cloak: '<img src="assets/images/equip/cloak.png" class="equip-modal-icon">',
    armor: '<img src="assets/images/equip/armor.png" class="equip-modal-icon">',
    boots: '<img src="assets/images/equip/boots.png" class="equip-modal-icon">',
    ring: '<img src="assets/images/equip/ring.png" class="equip-modal-icon">',
    amulet: '<img src="assets/images/equip/amulet.png" class="equip-modal-icon">',
    accessory: '<img src="assets/images/equip/accessory.png" class="equip-modal-icon">'
};

export function openEquipSelect(type) {
    const items = GameData.player.bag[type] || [];

    // 移除旧面板
    const existing = Renderer.$('equip-select-panel');
    if (existing) existing.remove();

    // 移除旧 backdrop
    const oldBackdrop = document.getElementById('equip-select-backdrop');
    if (oldBackdrop) oldBackdrop.remove();

    // 背景遮罩
    const backdrop = Renderer.create('div', {
        id: 'equip-select-backdrop',
        style: 'position:fixed;top:0;left:0;width:100%;height:100%;' +
            'background:rgba(0,0,0,0.7);z-index:1999;'
    });
    backdrop.addEventListener('click', closeEquipSelect);
    document.body.appendChild(backdrop);

    const panel = Renderer.create('div', {
        id: 'equip-select-panel',
        className: 'equip-select-panel',
        style: 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
            'background:#1a1a2e;border:1px solid rgba(255,255,255,0.15);' +
            'border-radius:16px;padding:0;z-index:2000;width:90%;max-width:380px;' +
            'max-height:75vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.7);'
    });

    const current = GameData.player.equipment[type];
    let html = `
        <div class="equip-select-header">
            <div class="equip-select-title">${equipIcons[type]} 选择${equipTypeNames[type]}</div>
            <div class="equip-select-close" onclick="closeEquipSelect()">×</div>
        </div>
        <div class="equip-select-body">
    `;

    // === A 区：当前已装备（如果有） ===
    if (current) {
        const cStats = getEquipmentStats(current);
        const cStatsText = [];
        if (cStats.attack) cStatsText.push(`攻+${cStats.attack}`);
        if (cStats.defense) cStatsText.push(`防+${cStats.defense}`);
        if (cStats.hp) cStatsText.push(`血+${cStats.hp}`);
        if (cStats.critRate) cStatsText.push(`暴+${cStats.critRate}%`);
        html += `
            <div class="equip-section equip-section-current">
                <div class="equip-section-title">✅ 当前装备</div>
                <div class="equip-option equipped" onclick="unequipItem('${type}')">
                    <div class="equip-option-info">
                        <div class="equip-option-name">${current.name} Lv.${current.level}</div>
                        <div class="equip-option-stats">${cStatsText.join(' · ') || '无附加属性'}</div>
                    </div>
                    <div class="equip-option-action">卸下</div>
                </div>
            </div>
        `;
    }

    // === B 区：背包里可选装备 ===
    html += `<div class="equip-section equip-section-bag">`;
    html += `<div class="equip-section-title">📦 背包里可装备 (${items.length})</div>`;

    if (items.length === 0) {
        html += `
            <div class="equip-empty-state">
                <div class="equip-empty-icon">🎒</div>
                <div class="equip-empty-text">背包里还没有${equipTypeNames[type] || type}</div>
                <div class="equip-empty-hint">刷怪掉落获取更多装备</div>
            </div>
        `;
    } else {
        items.forEach((item, index) => {
            const isEquipped = current && current.id === item.id;
            // ★ 只显示未装备的，已装备的那件单独显示在 A 区，避免"同名都被装"的误解
            if (isEquipped) return;

            const stats = getEquipmentStats(item);
            const statsText = [];
            if (stats.attack) statsText.push(`攻+${stats.attack}`);
            if (stats.defense) statsText.push(`防+${stats.defense}`);
            if (stats.hp) statsText.push(`血+${stats.hp}`);
            if (stats.critRate) statsText.push(`暴+${stats.critRate}%`);
            if (stats.critDamage) statsText.push(`爆+${stats.critDamage}%`);
            if (stats.lifeSteal) statsText.push(`吸+${stats.lifeSteal}%`);
            if (stats.combo) statsText.push(`连+${stats.combo}%`);

            // 计算预览价格（用于按钮标签）
            const sellPrice = Math.floor((item.price || 100) * 0.5 * (1 + (item.level - 1) * 0.2));
            const stones = Math.max(1, Math.floor((item.level || 1) * 0.5));

            html += `
                <div class="equip-option quality-${item.quality}">
                    <div class="equip-option-info" onclick="equipFromSelect('${type}', ${index})">
                        <div class="equip-option-name">${item.name} Lv.${item.level}</div>
                        <div class="equip-option-stats">${statsText.join(' · ') || '无附加属性'}</div>
                    </div>
                    <div class="equip-option-actions">
                        <button class="equip-mini-btn equip-mini-btn-equip" onclick="equipFromSelect('${type}', ${index})" title="装备这件">装备</button>
                        <button class="equip-mini-btn equip-mini-btn-sell" onclick="sellItem('${type}', ${index})" title="出售 +${sellPrice}金币">💰${sellPrice}</button>
                        <button class="equip-mini-btn equip-mini-btn-decompose" onclick="decomposeItem('${type}', ${index})" title="分解 +${stones}强化石">🔮${stones}</button>
                    </div>
                </div>
            `;
        });
        // 如果过滤后列表为空（B 区显示提示）
        const visibleCount = items.filter(i => !(current && current.id === i.id)).length;
        if (visibleCount === 0) {
            html = `
                <div class="equip-empty-state">
                    <div class="equip-empty-icon">🎒</div>
                    <div class="equip-empty-text">背包里没有其他可装备的${equipTypeNames[type] || type}</div>
                    <div class="equip-empty-hint">A 区当前装备已是背包里唯一的一件</div>
                </div>
            `;
        }
    }
    html += `</div>`;
    html += `</div>`;

    // 阻止内部点击冒泡
    panel.addEventListener('click', (e) => e.stopPropagation());
    panel.innerHTML = html;
    document.body.appendChild(panel);
}

export function closeEquipSelect() {
    const panel = Renderer.$('equip-select-panel');
    if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
    const backdrop = document.getElementById('equip-select-backdrop');
    if (backdrop && backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
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
    closeEquipDetail();   // ★ 同步关闭装备详情二级弹窗
    saveData();
    updateUI();
    updateEquipmentBar();
}

window.openEquipSelect = openEquipSelect;
window.closeEquipSelect = closeEquipSelect;
window.equipFromSelect = equipFromSelect;
window.unequipItem = unequipItem;

// 装备详情二级弹窗
window.showEquipDetail = showEquipDetail;
window.closeEquipDetail = closeEquipDetail;
window.equipItem = equipItem;
window.sellItem = sellItem;
window.decomposeItem = decomposeItem;
