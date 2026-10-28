/**
 * 装备背包 UI（P0 简化版）
 *   - 9 槽已装备：点击卸下
 *   - 背包：点击 → 弹详情/对比浮窗 → 穿装 / 回收
 *   - 批量回收白装
 *   - 过滤 tab（按部位）+ 套装激活提示
 *   - 品质色边框（白/绿/蓝/紫/金/红）
 *
 * 依赖：GameData / saveData / SET_EQUIP_TEMPLATES / SKILL_QUALITY
 */
import { GameData, saveData } from '../data/gameData.js';
import { Renderer } from '../core/renderer.js';
import { SET_EQUIP_TEMPLATES, SKILL_QUALITY } from '../data/config.js';
import { showToast } from './ui.js';
import {
    calculatePower, calculateEquipmentPower,
    getItemPower, previewEquipPower, previewUnequipPower,
    calculateSellPrice,
} from '../systems/equipment.js';
// v equip-refactor-20261008b：装备 modal 里的回收 / 批量回收也要触发 sell_thing 任务
//   之前只有 modals.js:window.sellItem 包了钩子，recycleEquipment / recycleAllWhite 没有
//   玩家用装备 modal 回收完成任务时任务不计数（隐藏 bug）
import { bumpTaskProgress } from '../systems/tasks.js';
import { bumpMainQuest } from '../systems/main-quest.js';

const QUALITY_COLORS = {
    white:  '#d4d4d4',
    green:  '#4ade80',
    blue:   '#3b82f6',
    purple: '#a855f7',
    gold:   '#ffd700',
    red:    '#ff4444',
};
const QUALITY_NAMES = {
    white: '普通', green: '优秀', blue: '稀有', purple: '史诗', gold: '传说', red: '神话',
};
const PART_NAMES = {
    weapon: '武器', armor: '防具', head: '头部', boots: '靴子', clothes: '衣服',
    accessory: '饰品', amulet: '护符', ring: '戒指', cloak: '披风',
};
const PARTS = ['weapon', 'armor', 'head', 'boots', 'clothes', 'accessory', 'amulet', 'ring', 'cloak'];

let currentFilter = 'all';

export function openEquipment() {
    // 2026-10-28：改走 Renderer.showModal —— 玩家主动开弹窗时关掉自动剧情卡片和其它弹窗（互斥）
    Renderer.showModal('equipment-modal');
    renderEquipmentModal();
    bindEquipmentTabs();
}
export function closeEquipment() {
    document.getElementById('equipment-modal')?.classList.remove('active');
}
window.openEquipment = openEquipment;
window.closeEquipment = closeEquipment;

function bindEquipmentTabs() {
    const tabs = document.querySelectorAll('#equip-tabs .equip-tab');
    tabs.forEach(t => {
        if (t._bound) return;
        t._bound = true;
        t.addEventListener('click', () => {
            tabs.forEach(x => x.classList.remove('active'));
            t.classList.add('active');
            currentFilter = t.dataset.part;
            renderBagList();
        });
    });
}

export function renderEquipmentModal() {
    const p = GameData.player;
    if (!p.bag) p.bag = { equipment: [], material: [] };
    if (!p.bag.equipment) p.bag.equipment = [];
    if (!p.equipment) p.equipment = {};
    if (p.bag.equipmentMax === undefined) p.bag.equipmentMax = 30;

    // 顶部信息：已用/上限
    const info = document.getElementById('equip-bag-info');
    if (info) {
        info.textContent = `${p.bag.equipment.length}/${p.bag.equipmentMax}`;
        info.style.color = p.bag.equipment.length >= p.bag.equipmentMax ? '#f87171' : '#fbbf24';
    }
    // 顶部战力分（装备总分 + 总战力）
    renderEquipPowerRow();
    // 已装备 9 槽
    renderEquippedSlots();
    // 套装激活
    renderSetRow();
    // 背包列表
    renderBagList();
}

/**
 * 装备 modal 顶部的战力信息行
 *   显示当前总战力 + 装备总分（不含角色基础分）
 */
function renderEquipPowerRow() {
    let el = document.getElementById('equip-power-row');
    if (!el) {
        // 动态插入到 set-row 之前
        const parent = document.querySelector('#equipment-modal .modal-body');
        const setRow = document.getElementById('equip-set-row');
        if (parent && setRow) {
            el = document.createElement('div');
            el.id = 'equip-power-row';
            el.className = 'equip-power-row';
            parent.insertBefore(el, setRow);
        }
    }
    if (!el) return;
    const totalPower = calculatePower();
    const equipPower = calculateEquipmentPower();
    el.innerHTML = `
        <span class="epower-cell">
            <i data-lucide="swords"></i>
            <span class="epower-label">总战力</span>
            <strong class="epower-value">${totalPower.toLocaleString()}</strong>
        </span>
        <span class="epower-sep">·</span>
        <span class="epower-cell epower-equip">
            <span class="epower-label">装备分</span>
            <strong class="epower-value">${equipPower.toLocaleString()}</strong>
        </span>
    `;
    try { if (typeof window.lucide !== 'undefined') window.lucide.createIcons(); } catch (_) {}
}

function renderEquippedSlots() {
    const el = document.getElementById('equip-slots-equipped');
    if (!el) return;
    const eq = GameData.player.equipment || {};
    el.innerHTML = PARTS.map(part => {
        const item = eq[part];
        if (item) {
            const color = QUALITY_COLORS[item.quality] || '#888';
            return `<div class="equip-cell quality-${item.quality}" data-part="${part}" style="border:1.5px solid ${color};border-radius:4px;padding:4px 2px;text-align:center;cursor:pointer;background:rgba(0,0,0,0.3);aspect-ratio:1;">
                <div style="font-size:10px;font-weight:600;color:${color};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${(PART_NAMES[part]||part).slice(0,1)}</div>
                <div style="font-size:8px;color:#888;">${QUALITY_NAMES[item.quality]||''}</div>
            </div>`;
        } else {
            return `<div class="equip-cell empty" data-part="${part}" style="border:1px dashed #555;border-radius:4px;padding:4px 2px;text-align:center;cursor:pointer;background:rgba(0,0,0,0.15);aspect-ratio:1;">
                <div style="font-size:10px;color:#555;">${(PART_NAMES[part]||part).slice(0,1)}</div>
            </div>`;
        }
    }).join('');
    // 点击槽位 = 卸下（如果已装备）
    el.querySelectorAll('.equip-cell').forEach(cell => {
        cell.addEventListener('click', () => {
            const part = cell.dataset.part;
            if (GameData.player.equipment[part]) {
                unequipToBag(part);
            }
        });
    });
}

function renderSetRow() {
    const el = document.getElementById('equip-set-row');
    if (!el) return;
    const eq = GameData.player.equipment || {};
    const setCount = {};
    PARTS.forEach(p => {
        const item = eq[p];
        if (item && item.setId && item.setId !== 'sweep') {
            setCount[item.setId] = (setCount[item.setId] || 0) + 1;
        }
    });
    const SET_NAMES = { wasteland: '废土行者', beast: '野兽', mech: '机械', cursed: '诅咒', toxic: '辐射' };
    const active = Object.entries(setCount).filter(([_, c]) => c >= 2);
    if (active.length === 0) {
        el.textContent = '⚠ 暂未激活套装（凑齐同系 2 件）';
        el.style.color = '#888';
    } else {
        el.innerHTML = active.map(([sid, c]) => `🟢 <b>${SET_NAMES[sid] || sid}</b> ${c}/3 已激活`).join(' · ');
        el.style.color = '#fbbf24';
    }
}

function renderBagList() {
    const el = document.getElementById('equip-bag-list');
    if (!el) return;
    const bag = GameData.player.bag.equipment || [];
    let list = bag.slice();
    if (currentFilter !== 'all') {
        list = list.filter(it => it.part === currentFilter);
    }
    // 按品质降序，再按战力降序
    const Q_ORDER = { red:6, gold:5, purple:4, blue:3, green:2, white:1 };
    list.sort((a, b) => {
        const qd = (Q_ORDER[b.quality]||0) - (Q_ORDER[a.quality]||0);
        if (qd !== 0) return qd;
        return powerOf(b) - powerOf(a);
    });
    if (list.length === 0) {
        el.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:#888;padding:20px;font-size:11px;">背包空空，去打挑战强敌/扫荡吧</div>`;
        return;
    }
    el.innerHTML = list.map(it => {
        const color = QUALITY_COLORS[it.quality] || '#888';
        return `<div class="equip-bag-cell quality-${it.quality}" data-id="${it.id}" style="border:1.5px solid ${color};border-radius:4px;padding:4px;background:rgba(0,0,0,0.25);cursor:pointer;">
            <div style="font-size:10px;font-weight:600;color:${color};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${it.name}">${it.name.replace('废土行者·','').replace('兽皮护甲','兽皮').slice(0,6)}</div>
            <div style="font-size:8px;color:#aaa;margin-top:2px;">${PART_NAMES[it.part]||it.part} · ${QUALITY_NAMES[it.quality]||''}</div>
        </div>`;
    }).join('');
    // 点击 = 弹详情对比
    el.querySelectorAll('.equip-bag-cell').forEach(cell => {
        let pressTimer = null;
        let longPressed = false;
        cell.addEventListener('click', () => {
            if (longPressed) { longPressed = false; return; }
            const id = cell.dataset.id;
            openEquipDetail(id);
        });
        // 长按 = 直接回收（白装）
        cell.addEventListener('mousedown', () => {
            longPressed = false;
            pressTimer = setTimeout(() => {
                const id = cell.dataset.id;
                const it = (GameData.player.bag.equipment || []).find(x => x.id === id);
                if (it && it.quality === 'white') {
                    longPressed = true;
                    recycleEquipment(id);
                } else {
                    showToast('⚠ 只能长按回收白色装备', 'info');
                }
            }, 700);
        });
        cell.addEventListener('mouseup', () => clearTimeout(pressTimer));
        cell.addEventListener('mouseleave', () => clearTimeout(pressTimer));
    });
}

function powerOf(item) {
    // 2026-08-13：废弃旧 powerOf（用旧 stats.defense/hp 字段），改用统一 getItemPower
    return getItemPower(item);
}

// ============================================================
// 穿装 / 卸下 / 回收
// ============================================================
function equipFromBag(itemId) {
    let success = false;
    let powerDiff = 0;
    let itemName = '';
    try {
        const p = GameData.player;
        const bag = p.bag.equipment || [];
        const idx = bag.findIndex(x => x.id === itemId);
        if (idx < 0) { console.warn('[equip] item not found:', itemId); return; }
        const it = bag[idx];
        if (!PARTS.includes(it.part)) {
            showToast('⚠ 部位不识别', 'error');
            return;
        }
        // 装备前算战力变化
        const preview = previewEquipPower(it);
        powerDiff = preview.diff;
        itemName = it.name;
        // 如果该部位已装备 → 老装备回背包
        if (p.equipment[it.part]) {
            bag.push(p.equipment[it.part]);
        }
        // 穿新装备
        p.equipment[it.part] = it;
        // 从背包移除
        bag.splice(idx, 1);
        saveData();
        // 战力变化的 toast 反馈
        if (powerDiff > 0) {
            showToast(`✅ 已装备 ${itemName} · 战力 +${powerDiff}`, 'success');
        } else if (powerDiff < 0) {
            showToast(`🔄 已替换 ${itemName} · 战力 ${powerDiff}`, 'info');
        } else {
            showToast(`✅ 已装备 ${itemName}`, 'success');
        }
        try { renderEquipmentModal(); } catch (e) { console.error('[equip] renderEquipmentModal:', e); }
        try { if (typeof window.updateUI === 'function') window.updateUI(); } catch (e) { console.error('[equip] updateUI:', e); }
        try { if (typeof window.renderStatsModal === 'function') window.renderStatsModal(); } catch (e) { console.error('[equip] renderStatsModal:', e); }
        success = true;
    } catch (e) {
        console.error('[equipFromBag] CRASH:', e);
        showToast('❌ 装备失败：' + e.message, 'error');
    }
    // ★ 装备成功 → 自动关闭详情弹窗（不论 onclick 串接是否执行了 closeEquipDetail）
    if (success) {
        try {
            const modal = document.getElementById('equip-detail-modal');
            if (modal) modal.classList.remove('active');
        } catch (e) { console.error('[equip] auto-close modal:', e); }
        // HUD 战力数字闪一下
        pulseHudPower();
    }
}
window.equipFromBag = equipFromBag;

function unequipToBag(part) {
    const p = GameData.player;
    const cur = p.equipment[part];
    if (!cur) return;
    const max = p.bag.equipmentMax || 30;
    if ((p.bag.equipment || []).length >= max) {
        showToast(`📦 背包已满 (${max}/${max})，请先回收或扩充`, 'error');
        return;
    }
    // 卸下前算战力变化
    const preview = previewUnequipPower(part);
    const lostPower = preview.curItemPower;
    p.bag.equipment.push(cur);
    delete p.equipment[part];
    saveData();
    // 提示战力变化
    if (lostPower > 0) {
        showToast(`↩ 已卸下 ${cur.name} → 战力 -${lostPower}`, 'info');
    } else {
        showToast(`↩ 已卸下 ${cur.name}`, 'info');
    }
    renderEquipmentModal();
    if (typeof window.updateUI === 'function') window.updateUI();
    // HUD 战力数字闪一下
    pulseHudPower();
}
window.unequipToBag = unequipToBag;

/**
 * HUD 战力数字变化时的视觉反馈（数字跳一下）
 */
function pulseHudPower() {
    const el = document.getElementById('hud-power');
    if (!el) return;
    el.classList.remove('pulse');
    void el.offsetWidth;
    el.classList.add('pulse');
}

function recycleEquipment(itemId) {
    let success = false;
    try {
        const p = GameData.player;
        const idx = (p.bag.equipment || []).findIndex(x => x.id === itemId);
        if (idx < 0) return;
        const it = p.bag.equipment[idx];
        // v equip-refactor-20261008a：使用统一公式 calculateSellPrice
        //   之前硬编码 stats 加权 × 0.3 × 品质倍数，且 stats 字段不可靠
        const refund = calculateSellPrice(it);
        p.gold = (p.gold || 0) + refund;
        p.bag.equipment.splice(idx, 1);
        saveData();
        // v equip-refactor-20261008b：触发 sell_thing 任务（之前只 modals.js:window.sellItem 包了）
        bumpTaskProgress('sell_thing');
        bumpMainQuest('sell_thing');
        showToast(`♻ 回收 ${it.name} → +${refund} 金币`, 'success');
        try { renderEquipmentModal(); } catch (e) { console.error('[recycle] renderEquipmentModal:', e); }
        try { if (typeof window.updateUI === 'function') window.updateUI(); } catch (e) { console.error('[recycle] updateUI:', e); }
        success = true;
    } catch (e) {
        console.error('[recycleEquipment] CRASH:', e);
        showToast('❌ 回收失败：' + e.message, 'error');
    }
    // ★ 成功 → 自动关闭详情弹窗
    if (success) {
        try {
            const modal = document.getElementById('equip-detail-modal');
            if (modal) modal.classList.remove('active');
        } catch (e) { console.error('[recycle] auto-close modal:', e); }
    }
}
window.recycleEquipment = recycleEquipment;

function recycleAllWhite() {
    const p = GameData.player;
    const before = (p.bag.equipment || []).length;
    const whites = (p.bag.equipment || []).filter(it => it.quality === 'white');
    // v equip-refactor-20261008a：每件白装按 calculateSellPrice 算（不再写死 5 金币）
    //   白装 calculateSellPrice = max(5, getItemPower × 0.12 × 1)，低品质时保底 5 金币
    let refund = 0;
    whites.forEach(it => { refund += calculateSellPrice(it); });
    p.bag.equipment = (p.bag.equipment || []).filter(it => it.quality !== 'white');
    const removed = before - p.bag.equipment.length;
    if (removed === 0) {
        showToast('⚠ 没有白色装备可回收', 'info');
        return;
    }
    p.gold = (p.gold || 0) + refund;
    saveData();
    // v equip-refactor-20261008b：批量回收按件触发 sell_thing（让 daily task 计数正确）
    for (let i = 0; i < removed; i++) {
        bumpTaskProgress('sell_thing');
        bumpMainQuest('sell_thing');
    }
    showToast(`♻ 批量回收 ${removed} 件白装 → +${refund} 金币`, 'success');
    renderEquipmentModal();
    if (typeof window.updateUI === 'function') window.updateUI();
}
window.recycleAllWhite = recycleAllWhite;

// ============================================================
// 装备详情 / 对比浮窗
// ============================================================
function openEquipDetail(itemId) {
    const it = (GameData.player.bag.equipment || []).find(x => x.id === itemId);
    if (!it) return;
    const color = QUALITY_COLORS[it.quality] || '#888';
    const cur = GameData.player.equipment[it.part];
    const statList = Object.keys(it.stats || {});

    // 战力对比
    const preview = previewEquipPower(it);
    const diffSign = preview.diff > 0 ? '+' : (preview.diff < 0 ? '' : '±');
    const diffColor = preview.diff > 0 ? '#4ade80' : (preview.diff < 0 ? '#f87171' : '#888');
    const diffText = preview.diff === 0 ? '战力持平' : `${diffSign}${preview.diff}`;

    const powerCompareHtml = `
        <div class="equip-power-compare" style="margin-top:10px;padding:8px 10px;background:linear-gradient(180deg,rgba(0,0,0,0.4),rgba(0,0,0,0.2));border:1px solid ${diffColor}55;border-radius:6px;">
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;">
                <span style="color:#888;">本件战力分</span>
                <strong style="color:${color};">${preview.itemPower}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;margin-top:4px;">
                <span style="color:#888;">总战力变化</span>
                <span style="color:#888;">${preview.currentPower} → <strong style="color:#fbbf24;">${preview.newPower}</strong></span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:14px;margin-top:6px;padding-top:6px;border-top:1px dashed #444;">
                <span style="color:#aaa;font-weight:600;">战力 ${diffText}</span>
                <strong style="color:${diffColor};font-size:16px;">${diffSign}${preview.diff}</strong>
            </div>
        </div>
    `;

    // 当前装备 vs 新装备 对比
    let compareHtml = '';
    if (cur) {
        compareHtml = `<div style="margin-top:12px;padding:8px;background:rgba(0,0,0,0.3);border-radius:4px;">
            <div style="font-size:10px;color:#888;margin-bottom:4px;">与当前 ${cur.name} 对比：</div>
            ${statList.map(k => {
                const newV = it.stats[k] || 0;
                const oldV = cur.stats?.[k] || 0;
                const diff = newV - oldV;
                const color = diff > 0 ? '#4ade80' : (diff < 0 ? '#f87171' : '#888');
                return `<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0;">
                    <span>${k}</span>
                    <span><span style="color:#888;">${oldV}</span> → <span style="color:${QUALITY_COLORS[cur.quality]||'#888'};">${newV}</span> <span style="color:${color};">(${diff>0?'+':''}${diff})</span></span>
                </div>`;
            }).join('')}
        </div>`;
    }
    document.getElementById('equip-detail-name').textContent = it.name;
    document.getElementById('equip-detail-name').style.color = color;
    document.getElementById('equip-detail-body').innerHTML = `
        <div style="text-align:center;padding:8px 0;">
            <div style="font-size:10px;color:${color};">${QUALITY_NAMES[it.quality]}品质 · ${PART_NAMES[it.part]||it.part}</div>
            ${it.setId && it.setId !== 'sweep' ? `<div style="font-size:10px;color:#888;margin-top:2px;">套系：${it.setId}</div>` : ''}
        </div>
        <div style="background:rgba(0,0,0,0.3);padding:8px;border-radius:4px;margin-top:4px;">
            ${Object.entries(it.stats || {}).map(([k, v]) => `<div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0;">
                <span>${k}</span><span style="color:#fbbf24;">+${v}</span>
            </div>`).join('')}
        </div>
        ${powerCompareHtml}
        ${compareHtml}
        <div style="display:flex;gap:8px;margin-top:12px;">
            <button class="btn btn-secondary" style="flex:1;" onclick="window.recycleEquipment('${it.id}'); window.closeEquipDetail();">♻ 回收 +${calculateSellPrice(it)}💰</button>
            <button class="btn btn-primary" style="flex:2;background:linear-gradient(180deg,#4ade80,#16a34a);" onclick="window.equipFromBag('${it.id}'); window.closeEquipDetail();">${cur ? '🔄 替换' : '✅ 穿装'}</button>
        </div>
    `;
    document.getElementById('equip-detail-modal').classList.add('active');
}
function closeEquipDetail() {
    document.getElementById('equip-detail-modal')?.classList.remove('active');
}
window.openEquipDetail = openEquipDetail;
window.closeEquipDetail = closeEquipDetail;
