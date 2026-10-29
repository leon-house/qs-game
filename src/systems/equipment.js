/**
 * 装备系统（2026-07-30 重构：去 hp/defense 维度，纯 attack + attackSpeed）
 *   - 装备属性只加 attack / attackSpeed / critRate / critDamage
 *   - 不再有 defense / hp / lifeSteal / combo
 */
import { GameData } from '../data/gameData.js';
import { BASE_HERO_STATS, EQUIPMENT_TEMPLATES } from '../data/config.js';
import { Renderer } from '../core/renderer.js';
import { saveData } from '../data/gameData.js';

/**
 * 计算装备属性（v equip-refactor-20261008a：直接读 item.stats，兼容老存档）
 *   - 新格式（2026-07-30 重构后所有入库装备）：item.stats = { attack, attackSpeed, critRate, critDamage, combo }
 *     这就是实际生效数值，不用再乘 levelMultiplier
 *   - 老格式兼容：item.baseAttack / baseXxx + item.level
 *     （2026-07-30 之前的存档里装备可能只有 baseAttack，没有 stats）
 *   - 修复：旧代码读 baseAttack，但新装备入库存的是 stats → 装备加成全失效（重大隐藏 bug）
 */
export function getEquipmentStats(item) {
    if (!item) {
        return { attack: 0, attackSpeed: 0, critRate: 0, critDamage: 0, combo: 0 };
    }
    // 优先读新格式 stats（实际生效数值，含随机浮动 + 等级加成）
    if (item.stats) {
        const s = item.stats;
        return {
            attack:      Math.floor(s.attack || 0),
            attackSpeed: Number(s.attackSpeed || 0),
            critRate:    Math.floor(s.critRate || 0),
            critDamage:  Number(s.critDamage || 0),    // 暴击伤害增量（如 +0.25 表示 ×1.75 总暴伤）
            combo:       Number(s.combo || 0),
        };
    }
    // 兜底：老格式 baseXxx × levelMultiplier
    const lv = item.level || 1;
    const levelMultiplier = 1 + (lv - 1) * 0.15;
    return {
        attack:      Math.floor((item.baseAttack || 0) * levelMultiplier),
        attackSpeed: (item.baseAttackSpeed || 0) * levelMultiplier,
        critRate:    Math.floor((item.baseCritRate || 0) * levelMultiplier),
        critDamage:  Number(item.baseCritDamage || 0) * levelMultiplier,
        combo:       (item.baseCombo || 0) * levelMultiplier,
    };
}

/**
 * 出售/回收统一公式（v equip-refactor-20261008a）
 *   之前 3 套公式分散在 modals.js / equipment-ui.js / 不同来源装备，数值不一致
 *   现在统一：基础值 = 单件战力分（getItemPower），品质倍数 × 0.12，最低保底 5 金币
 *
 *   数值举例（绿装单件战力分 100）：
 *     白 = 100 × 0.12 × 1   = 12
 *     绿 = 100 × 0.12 × 1.5 = 18
 *     蓝 = 100 × 0.12 × 2.5 = 30
 *     紫 = 100 × 0.12 × 4   = 48
 *     金 = 100 × 0.12 × 7   = 84
 *     红 = 100 × 0.12 × 12  = 144
 */
export const SELL_QUALITY_MUL = {
    white: 1, green: 1.5, blue: 2.5, purple: 4, gold: 7, red: 12,
};
export function calculateSellPrice(item) {
    if (!item) return 0;
    const power = getItemPower(item);
    const mul = SELL_QUALITY_MUL[item.quality] || 1;
    return Math.max(5, Math.floor(power * 0.12 * mul));
}

/**
 * 计算套装效果（2026-07-30：去 defense/hp；2026-08-03 加 null 防御）
 */
export function calculateSetBonus() {
    const eq = GameData.player.equipment || {};
    const setCount = {};
    Object.values(eq).forEach(item => {
        if (item && item.setId) {
            setCount[item.setId] = (setCount[item.setId] || 0) + 1;
        }
    });
    const bonus = { attack: 0, attackSpeed: 0, critRate: 0, critDamage: 0, combo: 0 };
    const activeSets = [];
    for (const [setId, count] of Object.entries(setCount)) {
        if (count >= 2) {
            // 套装数值表是可选配置；部分现有存档的装备已带 setId，但项目当前未启用套装表。
            // 直接引用未声明的 SETS 会让 calculateStats() 在首击前抛错，导致战斗定时器永久停止。
            const set = globalThis.SETS?.[setId];
            if (set) {
                const setBonus = set.bonus[count >= 3 ? 3 : 2] || set.bonus[2];
                if (setBonus) {
                    Object.assign(bonus, Object.fromEntries(
                        Object.entries(setBonus).map(([k, v]) => [k, (bonus[k] || 0) + v])
                    ));
                    activeSets.push({ ...set, count, bonus: setBonus });
                }
            }
        }
    }
    return { bonus, activeSets };
}

/**
 * 计算宝石加成（2026-08-03：去 defense/hp，加 combo/critDamage）
 */
export function calculateGemBonus() {
    const eq = GameData.player.equipment || {};
    const bonus = { attack: 0, attackSpeed: 0, critRate: 0, critDamage: 0, combo: 0 };
    Object.values(eq).forEach(item => {
        if (item && item.gems) {
            item.gems.forEach(gemId => {
                // 宝石数值表同样为可选配置，不能因旧装备带 gems 字段而中断战斗。
                const gem = globalThis.GEMS?.[gemId];
                if (gem) {
                    if (gem.attack)      bonus.attack += gem.attack;
                    if (gem.attackSpeed) bonus.attackSpeed += gem.attackSpeed;
                    if (gem.critRate)    bonus.critRate += gem.critRate;
                    if (gem.critDamage)  bonus.critDamage += gem.critDamage;
                    if (gem.combo)       bonus.combo += gem.combo;
                }
            });
        }
    });
    return bonus;
}

/**
 * 计算总属性（2026-08-03 精简：5 字段 + 技能书隐藏字段）
 *   角色属性 = BASE_HERO_STATS × (1 + (lv-1)*0.10 + stars*0.20)
 *             + 装备加成 + 套装加成 + 宝石加成 + 技能书加成
 */
export function calculateStats() {
    const p = GameData.player;
    const lv = p.characterLevel || 1;
    const stars = p.characterStars || 0;
    const lvBonus = (lv - 1) * 0.10;
    const starBonus = stars * 0.20;
    const mult = 1 + lvBonus + starBonus;

    // 基础属性 = BASE_HERO_STATS × 等级/星级倍率
    let stats = {
        attack:      Math.floor(BASE_HERO_STATS.attack * mult),
        attackSpeed: BASE_HERO_STATS.attackSpeed * mult,
        critRate:    BASE_HERO_STATS.critRate,
        critDamage:  BASE_HERO_STATS.critDamage,
        combo:       0,        // 装备 / 套装 / 宝石加进来
        // 技能书隐藏字段（不影响属性面板显示）
        goldFind:    0,        // 技能书"掘金"加成
        idleSpeed:   0,        // 技能书"潜行"加成
        bossDmg:     0,        // 技能书"破甲"加成
    };

    // 装备加成
    const eq = p.equipment || {};
    const equipTypes = ['weapon', 'armor', 'accessory', 'head', 'cloak', 'ring', 'amulet', 'boots', 'clothes'];
    equipTypes.forEach(type => {
        if (eq[type]) {
            const s = getEquipmentStats(eq[type]);
            stats.attack      += s.attack;
            stats.attackSpeed += s.attackSpeed;
            stats.critRate    += s.critRate;
            stats.critDamage  += s.critDamage;
            stats.combo       += s.combo;
        }
    });

    // 套装加成
    const setBonus = calculateSetBonus();
    stats.attack      += setBonus.bonus.attack;
    stats.attackSpeed += setBonus.bonus.attackSpeed;
    stats.critRate    += setBonus.bonus.critRate;
    stats.critDamage  += setBonus.bonus.critDamage || 0;
    stats.combo       += setBonus.bonus.combo || 0;

    // 宝石加成
    const gemBonus = calculateGemBonus();
    stats.attack      += gemBonus.attack;
    stats.attackSpeed += gemBonus.attackSpeed;
    stats.critRate    += gemBonus.critRate;
    stats.critDamage  += gemBonus.critDamage;
    stats.combo       += gemBonus.combo;

    // 技能书加成（隐藏字段）
    try {
        const skillMod = window.__skillbooks_module_cache || null;
        if (skillMod && typeof skillMod.calculateSkillBookStats === 'function') {
            const bookStats = skillMod.calculateSkillBookStats();
            if (bookStats.attack)      stats.attack      += bookStats.attack;
            if (bookStats.attackSpeed) stats.attackSpeed += bookStats.attackSpeed;
            if (bookStats.critRate)    stats.critRate    += bookStats.critRate;
            if (bookStats.goldFind)    stats.goldFind    += bookStats.goldFind;
            if (bookStats.idleSpeed)   stats.idleSpeed   += bookStats.idleSpeed;
            if (bookStats.bossDmg)     stats.bossDmg     += bookStats.bossDmg;
        }
    } catch (_) {}

    // 进化所加成（PRD v3 · 2026-08-04：永久属性）
    try {
        const evoMod = window.__evolution_lab_module_cache || null;
        if (evoMod && typeof evoMod.calculateEvolutionBonus === 'function') {
            const evoBonus = evoMod.calculateEvolutionBonus();
            if (evoBonus.attack)      stats.attack      += evoBonus.attack;
            if (evoBonus.attackSpeed) stats.attackSpeed += evoBonus.attackSpeed;
            if (evoBonus.critRate)    stats.critRate    += evoBonus.critRate;
            if (evoBonus.critDamage)  stats.critDamage  += evoBonus.critDamage;
        }
    } catch (_) {}

    // 训练场加成（PRD v3 · 2026-08-04：力量 + 技巧 + 经验）
    try {
        const tgMod = window.__training_ground_module_cache || null;
        if (tgMod && typeof tgMod.calculateTrainingBonus === 'function') {
            const tgBonus = tgMod.calculateTrainingBonus();
            if (tgBonus.attack)      stats.attack      += tgBonus.attack;
            if (tgBonus.critRate)    stats.critRate    += tgBonus.critRate;
            if (tgBonus.expMul)      stats.expMul      += tgBonus.expMul;
        }
    } catch (_) {}

    return stats;
}

/**
 * 计算战力（2026-08-13 重构：装备分相加 + 角色基础分 + 攻速乘积）
 *   单件装备分 = attack*10 + critRate*8 + critDamage*30 + combo*12
 *   装备总分 = Σ 各装备分
 *   总战力 = 角色基础分 + 装备总分 + 套装/宝石/技能书/进化所/训练场加成
 *   + 攻速二次方效应（attack × max(0.1, attackSpeed-1) × 10）作为"系统增益"
 */
export function calculatePower() {
    const stats = calculateStats();
    const lv = GameData.player.characterLevel || 1;
    const stars = GameData.player.characterStars || 0;
    const mult = 1 + (lv - 1) * 0.10 + stars * 0.20;

    // 角色基础分（等级 + 星级）
    const basePower = Math.floor(BASE_HERO_STATS.attack * mult * 10) + (lv - 1) * 30 + stars * 60;

    // 装备总分
    const equipPower = calculateEquipmentPower();

    // 攻速作为乘数增益：仅装备/技能书带来的攻速超过 1.0 的部分按 ×10 算分
    const extraSpeed = Math.max(0, (stats.attackSpeed || 1.0) - 1.0);
    const speedBonus = Math.floor(stats.attack * extraSpeed * 10);

    // 暴击/爆伤/连击来自装备外的加成（技能书/进化所/训练场）也算进总分
    const miscBonus =
        (stats.critRate || 0) * 8 +
        (stats.critDamage || 0) * 30 +
        (stats.combo || 0) * 12;

    return Math.floor(basePower + equipPower + speedBonus + miscBonus);
}

/**
 * 单件装备战力分（用于显示"装备分"和对比）
 *   装备分 = (该装备 attack + critRate + critDamage + combo 加成) × 权重
 *   不含 attackSpeed 乘积（避免重复计算）
 */
export function getItemPower(item) {
    if (!item) return 0;
    const s = getEquipmentStats(item);
    return Math.floor(
        (s.attack || 0) * 10 +
        (s.critRate || 0) * 8 +
        (s.critDamage || 0) * 30 +    // critDamage 是增量（不是绝对值），所以 || 0 兜底
        (s.combo || 0) * 12
    );
}

/**
 * 所有已装备装备的战力分总和（不含角色基础分）
 *   含套装加成和宝石加成（也按相同权重折算）
 */
export function calculateEquipmentPower() {
    const eq = GameData.player.equipment || {};
    let total = 0;
    const equipTypes = ['weapon', 'armor', 'accessory', 'head', 'cloak', 'ring', 'amulet', 'boots', 'clothes'];
    equipTypes.forEach(type => {
        if (eq[type]) total += getItemPower(eq[type]);
    });

    // 套装加成
    const setBonus = calculateSetBonus().bonus;
    total += (setBonus.attack || 0) * 10
        + (setBonus.critRate || 0) * 8
        + (setBonus.critDamage || 0) * 30
        + (setBonus.combo || 0) * 12;

    // 宝石加成
    const gemBonus = calculateGemBonus();
    total += (gemBonus.attack || 0) * 10
        + (gemBonus.critRate || 0) * 8
        + (gemBonus.critDamage || 0) * 30
        + (gemBonus.combo || 0) * 12;

    return Math.floor(total);
}

/**
 * 计算"如果装备/卸下 item 后的总战力"（不实际修改数据）
 *   forItem: 待装备的 item（如已在背包，传 item 本身）
 *   返回: { currentPower, newPower, diff, itemPower, curItemPower }
 *
 * 实现：临时替换 equipment[part]，重算 calculatePower，再还原。
 *   这样能精确反映 attack/attackSpeed/critRate/critDamage/combo 的全部连锁效应。
 */
export function previewEquipPower(item) {
    if (!item) return { currentPower: 0, newPower: 0, diff: 0, itemPower: 0 };
    const cur = GameData.player.equipment[item.part];
    const curPower = calculatePower();
    const itemPower = getItemPower(item);
    const curItemPower = cur ? getItemPower(cur) : 0;

    // 临时换上/卸下 item，重算 total
    if (cur) {
        GameData.player.equipment[item.part] = item;
    } else {
        GameData.player.equipment[item.part] = item;
    }
    const newPower = calculatePower();
    // 还原
    if (cur) {
        GameData.player.equipment[item.part] = cur;
    } else {
        delete GameData.player.equipment[item.part];
    }
    return {
        currentPower: curPower,
        newPower,
        diff: newPower - curPower,
        itemPower,
        curItemPower,
    };
}

/**
 * 计算"如果卸下 part 槽后的总战力"（不实际修改数据）
 */
export function previewUnequipPower(part) {
    const cur = GameData.player.equipment[part];
    if (!cur) return { currentPower: 0, newPower: 0, diff: 0, curItemPower: 0 };
    const curPower = calculatePower();
    const curItemPower = getItemPower(cur);
    // 临时卸下，重算
    delete GameData.player.equipment[part];
    const newPower = calculatePower();
    // 还原
    GameData.player.equipment[part] = cur;
    return {
        currentPower: curPower,
        newPower,
        diff: newPower - curPower,
        curItemPower,
    };
}

/**
 * 从模板查找装备描述
 */
export function getEquipDesc(item) {
    if (item.desc) return item.desc;
    for (const type in EQUIPMENT_TEMPLATES) {
        const template = EQUIPMENT_TEMPLATES[type].find(t => t.id === item.id);
        if (template && template.desc) return template.desc;
    }
    return null;
}

/**
 * 更新装备栏显示
 */
export function updateEquipmentBar() {
    const equipTypes = ['head', 'clothes', 'weapon', 'cloak', 'armor', 'boots', 'ring', 'amulet', 'accessory'];
    const icons = { head: '<img src="assets/images/equip/head.webp" class="equip-slot-img">', clothes: '<img src="assets/images/equip/clothes.webp" class="equip-slot-img">', weapon: '<img src="assets/images/equip/weapon.webp" class="equip-slot-img">', cloak: '<img src="assets/images/equip/cloak.webp" class="equip-slot-img">', armor: '<img src="assets/images/equip/armor.webp" class="equip-slot-img">', boots: '<img src="assets/images/equip/boots.webp" class="equip-slot-img">', ring: '<img src="assets/images/equip/ring.webp" class="equip-slot-img">', amulet: '<img src="assets/images/equip/amulet.webp" class="equip-slot-img">', accessory: '<img src="assets/images/equip/accessory.webp" class="equip-slot-img">' };

    equipTypes.forEach(type => {
        let slot = Renderer.$(`equip-${type}`);
        if (!slot) slot = Renderer.$q(`.equip-slot[data-type="${type}"]`);
        if (!slot) return;

        const equipped = GameData.player.equipment[type];
        if (equipped) {
            Renderer.$(slot.id) && Renderer.$(slot.id).classList.add('equipped');
            slot.innerHTML = icons[type] + '<div class="quality-dot quality-' + equipped.quality + '"></div>';
            slot.title = equipped.name + ' (点击切换)';
        } else {
            slot.classList.remove('equipped');
            slot.innerHTML = icons[type];
            const names = { head: '头盔', clothes: '衣服', weapon: '武器', cloak: '披风', armor: '防具', boots: '鞋', ring: '戒指', amulet: '护符', accessory: '饰品' };
            slot.title = names[type] + ' (点击穿戴)';
        }
    });

    // 2026-10-28 UI P1：首页装备快捷条跟着一起刷新
    renderGearStrip();
}

// ===== 装备快捷条（2026-10-28 UI P1）=====
// 首页任务卡和收获条之间原本空着 158px，用 9 个装备槽填上。
// 渲染函数放在 equipment.js 里，和 updateEquipmentBar 放在一起，
// 由 updateEquipmentBar() 统一调用，装备一变就跟着刷新。
const GEAR_SLOT_TYPES = [
    { type: 'weapon', label: '武器' },
    { type: 'head', label: '头盔' },
    { type: 'armor', label: '防具' },
    { type: 'clothes', label: '衣服' },
    { type: 'cloak', label: '披风' },
    { type: 'boots', label: '鞋' },
    { type: 'ring', label: '戒指' },
    { type: 'amulet', label: '护符' },
    { type: 'accessory', label: '饰品' },
];

const GEAR_QUALITY_LABEL = {
    white: '普通', green: '优秀', blue: '精良', purple: '史诗', gold: '传说', red: '神话',
};

export function renderGearStrip() {
    const wrap = document.getElementById('gear-slots');
    if (!wrap) return;
    const equipped = (GameData && GameData.player && GameData.player.equipment) || {};
    let count = 0;
    wrap.innerHTML = GEAR_SLOT_TYPES.map(({ type, label }) => {
        const item = equipped[type];
        if (item) count++;
        const quality = item ? (item.quality || 'white') : '';
        const dot = item ? `<span class="gear-slot-dot quality-${quality}"></span>` : '';
        const title = item
            ? `${item.name}（${GEAR_QUALITY_LABEL[quality] || quality}）`
            : `${label}（未装备）`;
        return `<button type="button" class="gear-slot${item ? ' is-equipped' : ''}" data-gear-type="${type}" title="${title}">`
            + `<img class="gear-slot-img" src="assets/images/equip/${type}.webp" alt="">${dot}</button>`;
    }).join('');
    const hint = document.getElementById('gear-strip-hint');
    if (hint) hint.textContent = `${count} / ${GEAR_SLOT_TYPES.length}`;
}
