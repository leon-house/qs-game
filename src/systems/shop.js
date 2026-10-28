// ============================================================
//  src/systems/shop.js
//  商店系统（金币刷新 · 6 件商品池 = 碎片 + 装备）
//
//  设计要点（用户已锁定）：
//  - 固定 10 金币 / 次刷新（测试版）
//  - 30 秒 +1 charges，最多累积 10
//  - 看广告 +10 charges
//  - 商品池：60% 碎片 + 40% 装备（无金币袋 / 无强化石 / 无跳关券）
//  - 碎片来源：仅商店（用户已锁定）
//  - 装备入库：挑战强敌掉落也有，这里卖中品质散件
// ============================================================

import { GameData, saveData, initNewFields } from '../data/gameData.js';
import { SHOP_CONFIG, SET_EQUIP_TEMPLATES, SKILL_BOOK_CATALOG, SKILL_QUALITY, SKILL_QUALITY_ORDER }
    from '../data/config.js';
import { addSkillShards, SHARD_PRICE } from './skillbooks.js';
import { watchAd } from './ad.js';
import { showToast, updateUI } from '../ui/ui.js';
import { Renderer } from '../core/renderer.js';

// ============================================================
// Charges 管理（30 秒 +1，上限 10）
// ============================================================
let chargesTimerId = null;

/**
 * 计算当前有效 charges（按 lastRefreshTick 自动累积）
 */
export function calcCurrentCharges() {
    initNewFields();
    const shop = GameData.player.shop;
    if (!shop.charges) shop.charges = SHOP_CONFIG.maxCharges;
    if (!shop.lastRefreshTick) shop.lastRefreshTick = Date.now();
    const elapsed = (Date.now() - shop.lastRefreshTick) / 1000;
    const auto = Math.floor(elapsed / SHOP_CONFIG.refreshRegenSeconds);
    if (auto > 0) {
        shop.charges = Math.min(SHOP_CONFIG.maxCharges, shop.charges + auto);
        shop.lastRefreshTick += auto * SHOP_CONFIG.refreshRegenSeconds * 1000;
        if (shop.charges >= SHOP_CONFIG.maxCharges) {
            shop.lastRefreshTick = Date.now();  // 满了就重置倒计时
        }
        saveData();
    }
    return {
        charges: shop.charges,
        nextChargeSeconds: shop.charges >= SHOP_CONFIG.maxCharges
            ? 0
            : SHOP_CONFIG.refreshRegenSeconds - Math.floor((Date.now() - shop.lastRefreshTick) / 1000),
        max: SHOP_CONFIG.maxCharges,
    };
}

/**
 * 启动后台每秒倒计时 + charges 重新计算 + UI 更新
 */
export function startChargesTimer() {
    if (chargesTimerId) return;
    chargesTimerId = setInterval(() => {
        const prev = GameData.player.shop.charges || 0;
        const cur = calcCurrentCharges().charges;
        if (cur !== prev) {
            try { renderShop(); } catch (_) {}
            try { updateUI(); } catch (_) {}
        } else {
            // 倒计时显示
            const cdEl = document.getElementById('shop-refresh-cd');
            if (cdEl) {
                const cd = calcCurrentCharges();
                if (cd.charges >= cd.max) {
                    cdEl.textContent = '已满';
                } else {
                    const sec = Math.max(0, Math.floor((cd.nextChargeSeconds) % 60));
                    cdEl.textContent = `下次 +1: 0:${String(sec).padStart(2, '0')}`;
                }
            }
        }
    }, 1000);
}

// ============================================================
// 商品生成
// ============================================================
/**
 * 2026-08-04 PRD v3：商品池扩展为 4 类
 *  - 30% 碎片
 *  - 20% 装备
 *  - 25% 进化胶囊（60 金币/颗）
 *  - 25% 升级材料（高级能源/蓝图/radPotion/训练手册）
 */
const SHOP_WEIGHTS_V3 = {
    shard: 30,
    equipment: 20,
    capsule: 25,
    material: 25,
};

/**
 * 生成 6 件商品（碎片 + 装备 + 进化胶囊 + 升级材料）
 */
export function generateShopItems() {
    initNewFields();
    const items = [];
    const totalWeight = Object.values(SHOP_WEIGHTS_V3).reduce((s, v) => s + v, 0);
    for (let i = 0; i < SHOP_CONFIG.slots; i++) {
        let r = Math.random() * totalWeight;
        let kind = 'shard';
        for (const [k, w] of Object.entries(SHOP_WEIGHTS_V3)) {
            r -= w;
            if (r <= 0) { kind = k; break; }
        }
        if (kind === 'shard') items.push(rollShardItem());
        else if (kind === 'equipment') items.push(rollEquipmentItem());
        else if (kind === 'capsule') items.push(rollCapsuleItem());
        else if (kind === 'material') items.push(rollMaterialItem());
    }
    GameData.player.shop.shopItems = items;
    saveData();
    return items;
}

/**
 * 抽 1 个进化胶囊商品（PRD v3 新增）
 */
function rollCapsuleItem() {
    return {
        kind: 'capsule',
        id: 'evolution_capsule',
        name: '进化胶囊',
        icon: 'dna',
        color: '#a855f7',  // 紫色，与"进化/基因"主题呼应
        emoji: '🧬',
        pngPath: 'assets/images/shards/capsule_evolution.png',  // AI 生成的进化球
        desc: '进化所升级消耗品',
        price: 60,
    };
}

/**
 * 抽 1 个升级材料商品（PRD v3 新增）
 * 高级能源 / 蓝图 / radPotion / 3 种训练手册
 */
function rollMaterialItem() {
    const matPool = [
        { id: 'advancedEnergy',   name: '高级能源',   color: '#fbbf24', emoji: '⚡',  pngPath: 'assets/images/materials/energy_advanced.png',  price: 200, desc: '发电站/进化所升级用' },
        { id: 'blueprint',        name: '蓝图碎片',   color: '#3b82f6', emoji: '📜',  pngPath: null,                                  price: 150, desc: '进化所/商店等级升级用' },
        { id: 'radPotion',        name: '辐射药剂',   color: '#84cc16', emoji: '🧪',  pngPath: null,                                  price: 100, desc: '进化所升级用' },
        { id: 'powerManual',      name: '力量手册',   color: '#f87171', emoji: '💪',  pngPath: null,                                  price: 100, desc: '训练场·力量方向' },
        { id: 'techniqueManual',  name: '技巧手册',   color: '#fb923c', emoji: '🎯',  pngPath: null,                                  price: 100, desc: '训练场·技巧方向' },
        { id: 'experienceManual', name: '经验手册',   color: '#22d3ee', emoji: '📖',  pngPath: null,                                  price: 100, desc: '训练场·经验方向' },
    ];
    const mat = matPool[Math.floor(Math.random() * matPool.length)];
    return {
        kind: 'material',
        id: mat.id,
        name: mat.name,
        color: mat.color,
        emoji: mat.emoji,
        pngPath: mat.pngPath,
        desc: mat.desc,
        price: mat.price,
    };
}

/**
 * 抽 1 个碎片商品
 */
function rollShardItem() {
    const totalWeight = SKILL_QUALITY_ORDER.reduce((s, q) => s + SKILL_QUALITY[q].dropWeight, 0);
    let r = Math.random() * totalWeight;
    let chosenQuality = 'white';
    for (const q of SKILL_QUALITY_ORDER) {
        r -= SKILL_QUALITY[q].dropWeight;
        if (r <= 0) { chosenQuality = q; break; }
    }
    const meta = SKILL_BOOK_CATALOG[Math.floor(Math.random() * SKILL_BOOK_CATALOG.length)];
    const skillEmoji = SHARD_VISUAL[meta.id]?.emoji || '✨';
    const skillPng   = SHARD_VISUAL[meta.id]?.pngPath || null;
    return {
        kind: 'shard',
        quality: chosenQuality,
        skillId: meta.id,
        skillName: meta.name,
        qualityName: SKILL_QUALITY[chosenQuality].name,
        color: SKILL_QUALITY[chosenQuality].color,
        icon: meta.icon,
        emoji: skillEmoji,
        pngPath: skillPng,
        price: SHARD_PRICE(chosenQuality),
    };
}

// 6 种技能书碎片：优先用 AI 生成 PNG（assets/images/shards/），缺失 fallback emoji
const SHARD_VISUAL = {
    atk_power:    { emoji: '⚔️',  pngPath: 'assets/images/shards/sword_atk_power.png' },     // 猛力 剑
    crit_chance:  { emoji: '🎯',  pngPath: 'assets/images/shards/crosshair_crit.png' },       // 洞察 瞄准镜
    gold_find:    { emoji: '💰',  pngPath: 'assets/images/shards/gold_goldfind.png' },         // 掘金 钱袋
    idle_speed:   { emoji: '⚡',  pngPath: 'assets/images/shards/shadow_idle_speed.png' },     // 潜行 闪电
    boss_dmg:     { emoji: '💀',  pngPath: 'assets/images/shards/skull_boss_dmg.png' },         // 破甲 骷髅
    skill_haste:  { emoji: '🌪️', pngPath: 'assets/images/shards/wind_skill_haste.png' },        // 迅捷 风
};

// ============================================================
// 22 段背景故事 lore（按 kind + id 查找）
// ============================================================
const SHARD_LORE = {
    atk_power:    '「猛力」是战场的语言。当愤怒燃烧、剑锋落下时，敌人会永远记住这一击。',
    crit_chance:  '「洞察」是猎人的眼睛。看穿弱点，在敌人反应之前，箭已穿心。',
    gold_find:    '「掘金」是商人的直觉。每一枚硬币都流向善于发现它的人。',
    idle_speed:   '「潜行」是影子的承诺。在黑暗中移动，世界会为你让路。',
    boss_dmg:     '「破甲」是屠龙者的技艺。再坚硬的鳞甲，也挡不住真正的杀意。',
    skill_haste:  '「迅捷」是风之子民的速度。时间在你面前，也要低头让步。',
};

const EQUIP_LORE = {
    head:      '在避难所深处，工匠们用废料拼凑出头盔。每一道划痕都是生存的勋章。',
    clothes:   '旧世界的军装经过修补已面目全非，但依然能挡住辐射尘与丧尸的爪牙。',
    weapon:    '这把武器的前主人早已倒下，但钢铁依然锋利，等待下一个持握它的幸存者。',
    cloak:     '披风上的徽章已褪色，但它的主人依然记得：保护，是战斗之外另一种勇气。',
    armor:     '胸前的合金板曾抵挡过变异兽的撕咬。穿上它，你就穿上了前任主人的意志。',
    boots:     '行千里路，废土上的每一道脚印都通向希望。这双军靴还能再跑十公里。',
    ring:      '在辐射蔓延之前，戒指曾是爱情的信物。如今，它是你对明日承诺的见证。',
    amulet:    '吊坠里封存着辐射警告标志——别忘了过去，才能走向远方。',
    accessory: '别在腰带上的小物件，看似无用，关键时刻却能救你一命。',
};

const MATERIAL_LORE = {
    advancedEnergy:   '从核电站废墟回收的高密度能源芯。握在手里，仍能感到微弱的嗡鸣。',
    blueprint:        '工程师留下的设计草图，记载着末日前最后的工业蓝图。',
    radPotion:        '用变异植物提炼的解毒剂。味道刺鼻，但能让你多活一天。',
    powerManual:      '战前军方训练手册的一页。字迹模糊，但方法永不过时。',
    techniqueManual:  '狙击手用过的瞄准技巧记录。每个标记都曾是某个敌人的终点。',
    experienceManual: '老兵的回忆录。每一行字都是用鲜血换来的教训。',
};

const CAPSULE_LORE = '实验室深处冷冻保存的基因核心。据说是末日前夕最后的进化实验产物，等待有人继承它的力量。';

/** 根据商品查 lore（顺序：shard → equipment → material → capsule） */
function lookupLore(item) {
    if (!item) return '';
    if (item.kind === 'shard')     return SHARD_LORE[item.skillId] || '';
    if (item.kind === 'equipment') return EQUIP_LORE[item.part]    || '';
    if (item.kind === 'material')  return MATERIAL_LORE[item.id]   || '';
    if (item.kind === 'capsule')   return CAPSULE_LORE;
    return '';
}

/**
 * 抽 1 个装备商品（中等品质，按当前章节数调整）
 */
function rollEquipmentItem() {
    const chapter = GameData.player.bossLevel || 0;
    // PRD v3 · 2026-08-04：商店等级加成（紫/金 × multiplier 1.0~1.80）
    const shopLevelMul = (window.getShopLevelMultiplier && window.getShopLevelMultiplier()) || 1.0;
    const qualityWeights = {
        white:  Math.max(0, 40 - chapter * 4),
        green:  30,
        blue:   15 + Math.min(15, chapter * 1.5),
        purple: (8  + Math.min(12, chapter * 0.8)) * shopLevelMul,
        gold:   (2  + Math.min(5,  chapter * 0.2)) * shopLevelMul,
        red:    0  + Math.min(2,  chapter * 0.05),
    };
    const total = Object.values(qualityWeights).reduce((s, v) => s + v, 0);
    let r = Math.random() * total;
    let chosenQuality = 'white';
    for (const [q, w] of Object.entries(qualityWeights)) {
        r -= w;
        if (r <= 0) { chosenQuality = q; break; }
    }
    // 装备模板：随机抽
    const tmpl = SET_EQUIP_TEMPLATES[Math.floor(Math.random() * SET_EQUIP_TEMPLATES.length)];
    const qMeta = SKILL_QUALITY[chosenQuality] || SKILL_QUALITY.white;
    // 价格 = 基础 * 品质倍数
    const basePrice = 50;
    const price = Math.floor(basePrice * qMeta.statMul);
    return {
        kind: 'equipment',
        quality: chosenQuality,
        qualityName: qMeta.name,
        color: qMeta.color,
        templateId: tmpl.id,
        name: tmpl.name,
        part: tmpl.part,
        setId: tmpl.setId,
        baseStats: tmpl.baseStats,
        icon: iconForPart(tmpl.part),
        price,
    };
}

function iconForPart(part) {
    // 商店装备用真实彩色立绘（assets/images/equip/*.png，已去水印）
    return {
        head:      'assets/images/equip/head.png',
        clothes:   'assets/images/equip/clothes.png',
        weapon:    'assets/images/equip/weapon.png',
        cloak:     'assets/images/equip/cloak.png',
        armor:     'assets/images/equip/armor.png',
        boots:     'assets/images/equip/boots.png',
        ring:      'assets/images/equip/ring.png',
        amulet:    'assets/images/equip/amulet.png',
        accessory: 'assets/images/equip/accessory.png',
    }[part] || 'assets/images/equip/accessory.png';
}

/** 判断图标是否为本地图片（PNG/WebP/JPG）而非 lucide 名 */
function isPngIcon(icon) {
    return typeof icon === 'string' && /\.(png|webp|jpg|jpeg|gif)$/i.test(icon);
}

// 装备部位中文名（用户在商店里看到的，应该是"武器/头盔/..."而不是英文 part）
const PART_NAMES_ZH = {
    head: '头盔', clothes: '外套', weapon: '武器', cloak: '披风',
    armor: '防具', boots: '靴', ring: '戒指', amulet: '护符', accessory: '饰品',
};
function partName(part) {
    return PART_NAMES_ZH[part] || part;
}
const STAT_KEY_ZH = {
    attack: '攻击', defense: '防御', hp: '生命',
    critRate: '暴击率', critDamage: '暴击伤害',
    attackSpeed: '攻速', combo: '连击',
    goldFind: '金币获取', idleSpeed: '挂机效率',
    bossDmg: 'Boss 伤害',
};
function statKeyCN(k) {
    return STAT_KEY_ZH[k] || k;
}

// HTML 转义（防止商品名字带引号/尖括号破坏 DOM）
function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ============================================================
// 模态入口
// ============================================================
export function openShop() {
    initNewFields();
    const modal = document.getElementById('shop-modal');
    if (!modal) return;
    // 首次进入或无商品 → 生成
    if (!GameData.player.shop.shopItems || GameData.player.shop.shopItems.length === 0) {
        GameData.player.shop.charges = GameData.player.shop.charges || 3;
        generateShopItems();
    }
    calcCurrentCharges();  // 结算累积 charges
    renderShop();
    // 2026-10-28：改走 Renderer.showModal —— 玩家主动开弹窗时关掉自动剧情卡片和其它弹窗（互斥）
    Renderer.showModal('shop-modal');
    startChargesTimer();
    if (typeof window.lucide !== 'undefined') window.lucide.createIcons();
}

export function closeShop() {
    const modal = document.getElementById('shop-modal');
    if (modal) modal.classList.remove('active');
}

// ============================================================
// 渲染
// ============================================================
export function renderShop() {
    const grid = document.getElementById('shop-grid');
    if (!grid) return;
    const items = GameData.player.shop.shopItems || [];
    const charges = calcCurrentCharges();
    const gold = GameData.player.gold || 0;

    if (items.length === 0) {
        grid.innerHTML = `<div class="empty-bag"><div class="empty-bag-icon">🛒</div><div>商品已售罄</div></div>`;
    } else {
        grid.innerHTML = items.map((item, i) => {
            const insufficient = gold < item.price;
            const gemColor = item.color || '#fbbf24';

            // ===== 商品名称 + 副信息（核心改进：让用户一眼认出是什么） =====
            let name, sub;
            if (item.kind === 'shard') {
                name = `${item.skillName}`;
                sub = `${item.qualityName}碎片`;
            } else if (item.kind === 'equipment') {
                name = `${item.name}`;
                sub = partName(item.part);
            } else if (item.kind === 'capsule') {
                name = `${item.name}`;
                sub = '进化材料';
            } else if (item.kind === 'material') {
                name = `${item.name}`;
                sub = (item.desc || '升级材料').slice(0, 12);
            } else {
                name = item.name || '物品';
                sub = '';
            }

            // 品质等级（碎片用真实品质色块，装备用品质名头）
            const qualityTag = item.kind === 'shard'
                ? `<span class="shop-quality-dot" style="background:${gemColor};box-shadow:0 0 6px ${gemColor};"></span>${item.qualityName}`
                : (item.kind === 'equipment' ? item.qualityName : '');

            // 图标四级优先级：pngPath（AI 生成） → emoji HTML fallback → 本地 PNG（equip） → lucide
            // v25f：PNG 加 loading=lazy + decoding=async，让浏览器异步解码，不阻塞首屏
            let iconInner;
            if (item.pngPath) {
                iconInner = `<img class="shop-item-img" src="${item.pngPath}" alt="${name}" loading="lazy" decoding="async">`;
            } else if (item.emoji) {
                iconInner = `<span class="emoji-icon" style="--gem-c:${gemColor};">${item.emoji}</span>`;
            } else if (isPngIcon(item.icon)) {
                iconInner = `<img class="shop-item-img" src="${item.icon}" alt="${name}" loading="lazy" decoding="async">`;
            } else {
                iconInner = `<i data-lucide="${item.icon || 'package'}"></i>`;
            }

            return `
                <div class="shop-item quality-${item.quality || 'white'} ${insufficient ? 'short-funds' : ''}"
                     onclick="window.openBuyConfirm(${i})">
                    <div class="shop-item-icon" style="color:${gemColor}; --gem-c:${gemColor};">
                        ${iconInner}
                        ${insufficient ? '<span class="funds-tag">金币不足</span>' : ''}
                    </div>
                    <div class="shop-item-name" style="color:${gemColor};">${escapeHtml(name)}</div>
                    <div class="shop-item-sub">${escapeHtml(sub)}${qualityTag ? ` · <span style="color:${gemColor};">${qualityTag}</span>` : ''}</div>
                    <div class="shop-item-price ${insufficient ? 'over' : ''}">💰 ${item.price}</div>
                </div>
            `;
        }).join('');
    }

    // 顶部信息条
    const chargesEl = document.getElementById('refresh-count');
    if (chargesEl) chargesEl.textContent = `${charges.charges}/${charges.max}`;
    const cdEl = document.getElementById('shop-refresh-cd');
    if (cdEl) {
        if (charges.charges >= charges.max) {
            cdEl.textContent = '次数已满';
        } else {
            const sec = Math.max(0, Math.floor(charges.nextChargeSeconds % 60));
            cdEl.textContent = `下次 +1：0:${String(sec).padStart(2, '0')}`;
        }
    }
    const costEl = document.getElementById('refresh-cost');
    if (costEl) costEl.textContent = SHOP_CONFIG.refreshCostFixed;
    const refreshBtn = document.getElementById('refresh-gold-btn');
    if (refreshBtn) {
        refreshBtn.disabled = charges.charges <= 0 || gold < SHOP_CONFIG.refreshCostFixed;
        refreshBtn.textContent = `💰 金币刷新 (${SHOP_CONFIG.refreshCostFixed})`;
    }

    if (typeof window.lucide !== 'undefined') window.lucide.createIcons();
}

// ============================================================
// 业务操作
// ============================================================
/**
 * 金币刷新（消耗 1 charges + 10 金币）
 */
export function refreshShop() {
    initNewFields();
    const p = GameData.player;
    calcCurrentCharges();
    if ((p.shop.charges || 0) <= 0) {
        showToast('刷新次数用完，看广告或等待恢复', 'warning');
        return false;
    }
    if ((p.gold || 0) < SHOP_CONFIG.refreshCostFixed) {
        showToast('金币不足', 'error');
        return false;
    }
    p.gold -= SHOP_CONFIG.refreshCostFixed;
    p.shop.charges -= 1;
    p.shop.lastRefreshTick = Date.now();
    generateShopItems();
    renderShop();
    saveData();
    showToast(`🔄 已刷商店（消耗 1 次 + ${SHOP_CONFIG.refreshCostFixed} 金币）`, 'success');
    return true;
}

/**
 * 看广告 +10 charges
 */
export function refreshShopByAd() {
    initNewFields();
    watchAd(() => {
        const p = GameData.player;
        p.shop.charges = Math.min(SHOP_CONFIG.maxCharges, (p.shop.charges || 0) + SHOP_CONFIG.adRewardCharges);
        p.shop.lastRefreshTick = Date.now();
        saveData();
        renderShop();
        showToast(`📺 奖励 +${SHOP_CONFIG.adRewardCharges} 刷新次数`, 'success');
    });
}

/**
 * 购买第 i 件商品
 */
export function buyShopItem(index) {
    initNewFields();
    const p = GameData.player;
    const item = (p.shop.shopItems || [])[index];
    if (!item) return false;
    if ((p.gold || 0) < item.price) {
        showToast('金币不足', 'error');
        return false;
    }
    p.gold -= item.price;
    // 分发：碎片 / 装备 / 进化胶囊 / 升级材料
    if (item.kind === 'shard') {
        addSkillShards(item.quality, item.skillId, 1);
    } else if (item.kind === 'capsule') {
        // PRD v3：进化胶囊 → materials.evolutionCapsules
        if (!p.materials) p.materials = { advancedEnergy: 0, evolutionCapsules: 0, powerManual: 0, techniqueManual: 0, experienceManual: 0 };
        p.materials.evolutionCapsules = (p.materials.evolutionCapsules || 0) + 1;
        showToast(`🧬 获得 进化胶囊 ×1（当前 ${p.materials.evolutionCapsules}）`, 'success');
    } else if (item.kind === 'material') {
        // PRD v3：升级材料 → materials 对应字段
        if (!p.materials) p.materials = { advancedEnergy: 0, evolutionCapsules: 0, powerManual: 0, techniqueManual: 0, experienceManual: 0 };
        p.materials[item.id] = (p.materials[item.id] || 0) + 1;
        showToast(`📦 获得 ${item.name} ×1（当前 ${p.materials[item.id]}）`, 'success');
    } else {
        // 装备入库：随机属性 80%~140%
        const stats = {};
        for (const [k, v] of Object.entries(item.baseStats)) {
            stats[k] = Math.floor(v * (0.8 + Math.random() * 0.6));
        }
        const equipped = {
            id: `${item.templateId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            templateId: item.templateId,
            name: item.name,
            part: item.part,
            setId: item.setId,
            quality: item.quality,
            stats,
            source: 'shop',
            // v equip-refactor-20261008a：补 level 字段，供未来升级机制使用
            level: 1,
            createdAt: Date.now(),
        };
        if (!p.bag.equipment) p.bag.equipment = [];
        p.bag.equipment.push(equipped);
        showToast(`🎁 获得 ${item.qualityName}·${item.name}`, 'success');
    }
    // 删除该商品，6 → 5
    p.shop.shopItems.splice(index, 1);
    saveData();
    renderShop();
    try { updateUI(); } catch (_) {}
    return true;
}

// ============================================================
// 二次确认购买（点击商品卡片 → 弹窗确认）
// ============================================================
let _pendingBuyIndex = -1;

export function openBuyConfirm(index) {
    initNewFields();
    const items = (GameData.player.shop && GameData.player.shop.shopItems) || [];
    const item = items[index];
    if (!item) return;
    _pendingBuyIndex = index;
    // 名称 + 描述行（按 kind 还原）
    let nameLine, metaLine, kindShortName;
    if (item.kind === 'shard') {
        nameLine = `${item.qualityName}·${item.skillName}`;
        metaLine = `技能书碎片 ×1（再凑 4 个可合成完整技能书）`;
        kindShortName = '技能书碎片';
    } else if (item.kind === 'equipment') {
        nameLine = `${item.qualityName}·${item.name}`;
        const statsStr = Object.entries(item.baseStats || {})
            .map(([k, v]) => `${statKeyCN(k)} +${v}`)
            .join(' / ');
        metaLine = `部位：${partName(item.part)}${statsStr ? '　·　' + statsStr : ''}`;
        kindShortName = '装备';
    } else if (item.kind === 'capsule') {
        nameLine = item.name || '进化胶囊';
        metaLine = item.desc || '用于进化所升级（基因层级突破）';
        kindShortName = '进化材料';
    } else if (item.kind === 'material') {
        nameLine = item.name || '材料';
        metaLine = item.desc || '用于发电站/训练场升级';
        kindShortName = '升级材料';
    } else {
        nameLine = item.name || '?';
        metaLine = '';
        kindShortName = '物品';
    }
    const gold = GameData.player.gold || 0;
    const insufficient = gold < item.price;
    const overlay = document.getElementById('buy-confirm-modal');
    if (!overlay) return;
    // 切换顶部标题 / footer 按钮状态
    const titleEl = overlay.querySelector('.modal-title');
    if (titleEl) titleEl.innerHTML = insufficient ? '❌ 金币不足' : '📦 确认购买';
    overlay.classList.toggle('insufficient', insufficient);
    const cancelBtn = overlay.querySelector('.buy-confirm-btn.cancel');
    const confirmBtn = overlay.querySelector('.buy-confirm-btn.confirm');
    if (cancelBtn) cancelBtn.textContent = insufficient ? '关闭' : '取消';
    if (confirmBtn) {
        if (insufficient) {
            confirmBtn.textContent = '金币不足无法购买';
            confirmBtn.disabled = true;
        } else {
            confirmBtn.textContent = '✅ 确认购买';
            confirmBtn.disabled = false;
        }
    }
    const body = overlay.querySelector('.modal-body');
    if (body) {
        const gap = Math.max(0, item.price - gold);
        const gemColor = item.color || '#fbbf24';
        // 图标四级优先级：pngPath（AI 生成） → emoji HTML fallback → 本地 PNG（equip） → lucide
        let iconInner;
        if (item.pngPath) {
            iconInner = `<img class="buy-confirm-img" src="${item.pngPath}" alt="${item.name || ''}" loading="lazy" decoding="async">`;
        } else if (item.emoji) {
            iconInner = `<span class="emoji-icon" style="--gem-c:${gemColor};">${item.emoji}</span>`;
        } else if (isPngIcon(item.icon)) {
            iconInner = `<img class="buy-confirm-img" src="${item.icon}" alt="${item.name || ''}" loading="lazy" decoding="async">`;
        } else {
            iconInner = `<i data-lucide="${item.icon || 'package'}"></i>`;
        }
        body.innerHTML = `
            <div class="buy-confirm-icon" style="color:${item.color || 'var(--gold)'}; --gem-c:${item.color || '#fbbf24'};">
                ${iconInner}
            </div>
            <div class="buy-confirm-kind">${kindShortName}</div>
            <div class="buy-confirm-name" style="color:${item.color || 'var(--gold)'};">${nameLine}</div>
            <div class="buy-confirm-meta">${metaLine}</div>
            <div class="buy-confirm-lore">${lookupLore(item) || ''}</div>
            <div class="buy-confirm-price-row ${insufficient ? 'over-budget' : ''}">
                <span>价格：</span>
                <strong class="gold-text">💰 ${item.price}</strong>
                <span class="buy-confirm-balance">· 余额 ${gold}</span>
            </div>
            ${insufficient ? `<div class="buy-confirm-warn">还差 <strong>💰 ${gap}</strong> 金币</div>` : ''}
        `;
    }
    overlay.classList.add('active');
    if (typeof window.lucide !== 'undefined') window.lucide.createIcons();
}

export function closeBuyConfirm() {
    _pendingBuyIndex = -1;
    const overlay = document.getElementById('buy-confirm-modal');
    if (overlay) overlay.classList.remove('active');
}

export function confirmBuy() {
    if (_pendingBuyIndex < 0) return;
    const idx = _pendingBuyIndex;
    const ok = buyShopItem(idx);
    closeBuyConfirm();
    if (!ok) showToast('购买失败', 'error');
}

// ============================================================
// window 桥接
// ============================================================
window.openShop = openShop;
window.closeShop = closeShop;
window.refreshShop = refreshShop;
window.refreshShopByAd = refreshShopByAd;
window.buyShopItem = buyShopItem;
window.openBuyConfirm = openBuyConfirm;
window.closeBuyConfirm = closeBuyConfirm;
window.confirmBuy = confirmBuy;
window.calcCurrentCharges = calcCurrentCharges;
window.startChargesTimer = startChargesTimer;
