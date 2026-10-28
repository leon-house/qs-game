/**
 * 弹窗管理
 */
import { GameData, saveData } from '../data/gameData.js';
import { calculateStats, calculatePower, getEquipDesc, getEquipmentStats, calculateSellPrice, updateEquipmentBar } from '../systems/equipment.js';
import { Renderer } from '../core/renderer.js';
import { formatNumber, showToast, updateUI } from './ui.js';

// ============================================================
//  装备查找辅助函数（按 id 索引，不再依赖 (type, index)）
// ============================================================
/**
 * 在 bag.equipment 中查找唯一 id 的装备
 * @param {string} itemId 装备唯一 id（item.id）
 * @returns {object|null} 装备对象 + 扁平 index { item, index }
 */
function findBagEquip(itemId) {
    const items = GameData.player.bag.equipment || [];
    const index = items.findIndex(it => it.id === itemId);
    if (index < 0) return null;
    return { item: items[index], index };
}

/**
 * 属性弹窗（2026-08-03 精简：只显示 5 字段）
 *   攻击 / 暴击 / 爆伤 / 攻速 / 连击
 *   删：防御 / 生命 / 吸血（角色不受伤害，DPS 模型不需要这 3 项）
 */
export function openStatsModal() {
    const stats = calculateStats();
    const power = calculatePower();
    const atkSpd = (stats.attackSpeed || 1.0).toFixed(2);
    const html = `
        <div class="stat-row" style="justify-content:center;font-size:18px;color:var(--orange);font-weight:900;">
            ⚔️ 战力 ${formatNumber(power)}
        </div>
        <div class="stat-row"><span class="stat-label">⚔️ 攻击</span><span class="stat-value attack">${stats.attack}</span></div>
        <div class="stat-row"><span class="stat-label">⚡ 暴击</span><span class="stat-value crit">${stats.critRate}%</span></div>
        <div class="stat-row"><span class="stat-label">💥 爆伤</span><span class="stat-value" style="color:var(--orange);">${stats.critDamage || 1.5}×</span></div>
        <div class="stat-row"><span class="stat-label">⚡ 攻速</span><span class="stat-value" style="color:var(--cyan);">${atkSpd}/s</span></div>
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
        // 所有装备都堆在 bag.equipment 里（不再按 part 分子数组）
        // _type 用 item.part 仅用于查找图标，_index 用扁平行索引
        const equipList = bag.equipment || [];
        equipList.forEach((item, idx) => {
            items.push({ ...item, _type: item.part, _index: idx });
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
            // v equip-refactor-20261008a：直接读 item.stats（新格式）
            const st = item.stats || {};
            const stats = [];
            const atk = st.attack || 0;
            const atkSpd = st.attackSpeed || 0;
            const crit = st.critRate || 0;
            const critDmg = st.critDamage || 0;
            const combo = st.combo || 0;
            if (atk) stats.push('攻+' + atk);
            if (atkSpd) stats.push('速+' + Number(atkSpd).toFixed(2));
            if (crit) stats.push('暴+' + crit + '%');
            if (critDmg && critDmg !== 1.5) stats.push('爆伤×' + Number(critDmg).toFixed(2));
            if (combo) stats.push('连击+' + Number(combo).toFixed(1) + '%');
            statsText = stats.join(' ');
            levelText = 'Lv.' + (item.level || 1);
        }

        return '<div class="bag-item ' + equipped + ' ' + item.quality + '" onclick="handleBagItemClick(\'' + item.id + '\')" oncontextmenu="showItemMenu(event,\'' + item.id + '\')">' +
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
export function showItemMenu(event, itemId) {
    event.preventDefault();
    const found = findBagEquip(itemId);
    if (!found) return;
    const item = found.item;

    const desc = getEquipDesc(item);
    const existingMenu = Renderer.$('item-menu');
    if (existingMenu) existingMenu.remove();

    const menu = Renderer.create('div', {
        id: 'item-menu',
        className: 'item-menu',
        style: 'position:fixed;left:' + event.clientX + 'px;top:' + event.clientY + 'px;'
    });

    // v equip-refactor-20261008b：统一用 calculateSellPrice（之前硬编码 item.price * 0.5，与详情弹窗数值不一致）
    const sellPrice = calculateSellPrice(item);

    // v equip-refactor-20261008b：删掉"升级"按钮（upgradeItem 函数不存在 → ReferenceError）
    //   升级系统作为新功能做时再加回
    menu.innerHTML = (desc ? '<div style="padding:8px 12px;font-size:11px;color:var(--text-secondary);font-style:italic;border-bottom:1px solid rgba(255,255,255,0.1);margin-bottom:4px;line-height:1.4;">"' + desc + '"</div>' : '') +
        '<div class="menu-item" onclick="sellItem(\'' + itemId + '\')"><div class="menu-item-title">💰 出售</div><div class="menu-item-cost" style="color:var(--gold);">+' + sellPrice + '</div></div>' +
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
window.handleBagItemClick = function(itemId) {
    const found = findBagEquip(itemId);
    if (!found) return;
    // ★ 点装备图标 → 弹二级详情弹窗（信息+属性+装备/出售/分解三按钮）
    showEquipDetail(itemId);
};

/**
 * 装备详情二级弹窗
 */
export function showEquipDetail(itemId) {
    const found = findBagEquip(itemId);
    if (!found) return;
    const item = found.item;
    // 注意：type 在此处是 part 名（如 'head'/'armor'），用于卸载和图标
    const part = item.part;

    const existing = Renderer.$('equip-detail-panel');
    if (existing) existing.remove();

    const current = GameData.player.equipment[part];
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

    // v26：品质名映射（用于右上角徽章 + 名称颜色）
    // v equip-refactor-20261008a：BUG fix —— 把 'orange' 改回 'gold'（SKILL_QUALITY 真实定义）
    const qualityLabels = {
        white: '劣质', green: '普通', blue: '优秀', purple: '稀有', gold: '史诗', red: '传说'
    };
    const qualityNameColors = {
        white: '#b8b8b8', green: '#6dd47e', blue: '#5db4ff',
        purple: '#c97aff', gold: '#ffb84d', red: '#ff6b6b'
    };

    // 属性行（2026-08-03 精简：5 字段；v26：连击/攻速等浮点值用 toFixed 避免 12.2999...% 这种精度尾巴）
    const statRows = [];
    if (stats.attack) statRows.push({ icon: '⚔️', label: '攻击', value: stats.attack, color: 'var(--orange)' });
    if (stats.critRate) statRows.push({ icon: '⚡', label: '暴击', value: stats.critRate + '%', color: 'var(--gold)' });
    if (stats.critDamage) statRows.push({ icon: '💥', label: '爆伤', value: (stats.critDamage || 1.5).toFixed(2) + '×', color: 'var(--orange)' });
    if (stats.attackSpeed) statRows.push({ icon: '⚡', label: '攻速', value: (stats.attackSpeed || 1.0).toFixed(2) + '/s', color: 'var(--cyan)' });
    if (stats.combo) statRows.push({ icon: '🔗', label: '连击', value: parseFloat(stats.combo.toFixed(2)) + '%', color: 'var(--purple)' });

    const sellPrice = calculateSellPrice(item);
    const stones = Math.max(1, Math.floor((item.level || 1) * 0.5));

    // v26：重做 HTML —— 全部用 CSS 类，去掉 inline style
    const html = `
        <div class="equip-detail equip-detail-${item.quality}">
            <div class="equip-detail-info">
                <div class="equip-detail-icon">${typeIcons[part] || '📦'}</div>
                <div class="equip-detail-title-block">
                    <div class="equip-detail-name" style="color:${qualityNameColors[item.quality] || '#fff'};">${item.name}</div>
                    <div class="equip-detail-meta">
                        <span>${typeNames[part] || part}</span>
                        <span>·</span>
                        <span>Lv.${item.level}</span>
                        ${isEquipped ? '<span class="equipped-tag">✓ 已装备</span>' : ''}
                    </div>
                </div>
                <div class="equip-quality-badge ${item.quality}">${qualityLabels[item.quality] || ''}</div>
            </div>
            ${item.desc ? `<div class="equip-detail-desc">${item.desc}</div>` : ''}
            <div class="equip-detail-stats">
                ${statRows.length > 0 ? statRows.map(r => `
                    <div class="equip-stat-row">
                        <span class="stat-label">${r.icon} ${r.label}</span>
                        <span class="stat-value" style="color:${r.color};">+${r.value}</span>
                    </div>
                `).join('') : '<div style="text-align:center;color:var(--text-secondary);padding:8px;">无附加属性</div>'}
            </div>
            <div class="equip-detail-actions">
                <button class="${isEquipped ? 'equip-btn-unequip' : 'equip-btn-primary'}"
                    onclick="${isEquipped ? 'unequipItem(\'' + part + '\')' : 'equipItem(\'' + itemId + '\')'}">
                    ${isEquipped ? '📤 卸下装备' : '⚔️ 装备此件'}
                </button>
                <div class="equip-btn-secondary-row">
                    <button class="equip-btn-secondary" onclick="sellItem('${itemId}')">
                        💰 出售<span class="sub-hint">+${sellPrice} 金币</span>
                    </button>
                    <button class="equip-btn-secondary" onclick="decomposeItem('${itemId}')">
                        🔮 分解<span class="sub-hint">+${stones} 强化石</span>
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
            'background:linear-gradient(180deg, #1f1610 0%, #0d0805 100%);' +
            'border:1px solid rgba(212,185,122,0.45);' +
            'border-radius:12px;padding:0;z-index:2000;width:90%;max-width:380px;' +
            'max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.7),' +
            '0 0 0 1px rgba(212,185,122,0.15) inset;'
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
 * 从详情弹窗装备（单件，按 id 精确装备）
 */
export function equipItem(itemId) {
    const found = findBagEquip(itemId);
    if (!found) {
        showToast('装备不存在', 'warning');
        return;
    }
    const item = found.item;
    const part = item.part;
    const current = GameData.player.equipment[part];
    if (current && current.id === item.id) {
        showToast('这件已经装备了', 'warning');
        return;
    }
    GameData.player.equipment[part] = item;  // ★ 按 id 精确装备单件（这里 part 是 part 名）
    showToast(`已装备 ${item.name}`, 'success');
    closeEquipDetail();
    saveData();
    updateUI();
    updateEquipmentBar();
    switchBagTab(currentBagType);
}

/**
 * 出售装备（按 itemId 查找并从 bag.equipment 删除）
 *   v equip-refactor-20261008a：使用 calculateSellPrice 统一公式
 *   之前硬编码 (item.price * 0.5 * (1 + (level-1) * 0.2))，但 item.price 不可靠
 */
export function sellItem(itemId) {
    const found = findBagEquip(itemId);
    if (!found) return;
    const { item, index } = found;
    const part = item.part;
    const sellPrice = calculateSellPrice(item);

    // 如果已装备，卸下
    if (GameData.player.equipment[part]?.id === item.id) {
        GameData.player.equipment[part] = null;
    }

    GameData.player.bag.equipment.splice(index, 1);
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
 * 分解装备（按 itemId 查找并从 bag.equipment 删除）— 获得强化石 + 材料
 */
export function decomposeItem(itemId) {
    const found = findBagEquip(itemId);
    if (!found) return;
    const { item, index } = found;
    const part = item.part;

    if (GameData.player.equipment[part]?.id === item.id) {
        GameData.player.equipment[part] = null;
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

    GameData.player.bag.equipment.splice(index, 1);

    showToast(`分解 ${item.name}：+${stones}强化石 +1${matName}`, 'success');
    // v equip-refactor-20261008b：任务钩子在 main.js:window.decomposeItem wrap 层完成
    //   之前在这里调 window.bumpTaskProgress，但 window 上没暴露该函数（导致任务永远不计数）
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
    // 装备统一存在 bag.equipment 里 —— 按 part 过滤出当前槽位的可选装备
    const allEquip = GameData.player.bag.equipment || [];
    const items = allEquip.filter(it => it.part === type);

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
            if (stats.attackSpeed) statsText.push(`速+${stats.attackSpeed.toFixed(2)}`);
            if (stats.critRate) statsText.push(`暴+${stats.critRate}%`);
            if (stats.critDamage) statsText.push(`爆+${stats.critDamage.toFixed(2)}×`);
            if (stats.combo) statsText.push(`连+${stats.combo.toFixed(1)}%`);

            // v equip-refactor-20261008a：预览售价走统一公式 calculateSellPrice
            const sellPrice = calculateSellPrice(item);
            const stones = Math.max(1, Math.floor((item.level || 1) * 0.5));

            html += `
                <div class="equip-option quality-${item.quality}">
                    <div class="equip-option-info" onclick="equipFromSelect('${item.id}')">
                        <div class="equip-option-name">${item.name} Lv.${item.level}</div>
                        <div class="equip-option-stats">${statsText.join(' · ') || '无附加属性'}</div>
                    </div>
                    <div class="equip-option-actions">
                        <button class="equip-mini-btn equip-mini-btn-equip" onclick="equipFromSelect('${item.id}')" title="装备这件">装备</button>
                        <button class="equip-mini-btn equip-mini-btn-sell" onclick="sellItem('${item.id}')" title="出售 +${sellPrice}金币">💰${sellPrice}</button>
                        <button class="equip-mini-btn equip-mini-btn-decompose" onclick="decomposeItem('${item.id}')" title="分解 +${stones}强化石">🔮${stones}</button>
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

export function equipFromSelect(itemId) {
    const found = findBagEquip(itemId);
    if (!found) return;
    const item = found.item;
    const part = item.part;
    GameData.player.equipment[part] = item;
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
