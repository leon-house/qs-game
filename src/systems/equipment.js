/**
 * 装备系统
 * 装备属性计算、穿戴/卸下、升级、分解
 */
import { GameData } from '../data/gameData.js';
import { EQUIPMENT_TEMPLATES, SETS, GEMS, SURVIVOR_TYPES } from '../data/config.js';
import { Renderer } from '../core/renderer.js';
import { saveData } from '../data/gameData.js';

/**
 * 计算装备属性（含等级加成）
 */
export function getEquipmentStats(item) {
    if (!item || !item.level) {
        return { attack: 0, defense: 0, hp: 0, critRate: 0, critDamage: 0, lifeSteal: 0, combo: 0 };
    }
    const levelMultiplier = 1 + (item.level - 1) * 0.15;
    return {
        attack: Math.floor((item.baseAttack || 0) * levelMultiplier),
        defense: Math.floor((item.baseDefense || 0) * levelMultiplier),
        hp: Math.floor((item.baseHp || 0) * levelMultiplier),
        critRate: Math.floor((item.baseCritRate || 0) * levelMultiplier),
        critDamage: Math.floor((item.baseCritDamage || 0) * levelMultiplier),
        lifeSteal: Math.floor((item.baseLifeSteal || 0) * levelMultiplier),
        combo: Math.floor((item.baseCombo || 0) * levelMultiplier)
    };
}

/**
 * 计算套装效果
 */
export function calculateSetBonus() {
    const eq = GameData.player.equipment;
    const setCount = {};
    Object.values(eq).forEach(item => {
        if (item && item.setId) {
            setCount[item.setId] = (setCount[item.setId] || 0) + 1;
        }
    });
    const bonus = { attack: 0, defense: 0, hp: 0, critRate: 0 };
    const activeSets = [];
    for (const [setId, count] of Object.entries(setCount)) {
        if (count >= 2) {
            const set = SETS[setId];
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
 * 计算宝石加成
 */
export function calculateGemBonus() {
    const eq = GameData.player.equipment;
    const bonus = { attack: 0, defense: 0, hp: 0, critRate: 0 };
    Object.values(eq).forEach(item => {
        if (item && item.gems) {
            item.gems.forEach(gemId => {
                const gem = GEMS[gemId];
                if (gem) {
                    if (gem.attack) bonus.attack += gem.attack;
                    if (gem.defense) bonus.defense += gem.defense;
                    if (gem.hp) bonus.hp += gem.hp;
                    if (gem.critRate) bonus.critRate += gem.critRate;
                }
            });
        }
    });
    return bonus;
}

/**
 * 计算总属性
 */
export function calculateStats() {
    let stats = { ...GameData.baseStats, critDamage: 50, lifeSteal: 0, combo: 0 };

    // 角色类型加成
    if (GameData.player.characterType) {
        const char = SURVIVOR_TYPES[GameData.player.characterType];
        if (char && char.bonus) {
            if (char.bonus.attack) stats.attack = Math.floor(stats.attack * (1 + char.bonus.attack));
            if (char.bonus.hp) stats.hp = Math.floor(stats.hp * (1 + char.bonus.hp));
            if (char.bonus.critRate) stats.critRate += char.bonus.critRate;
        }
    }

    // 装备加成
    const eq = GameData.player.equipment;
    const equipTypes = ['weapon', 'armor', 'accessory', 'head', 'cloak', 'ring', 'amulet', 'boots', 'clothes'];
    equipTypes.forEach(type => {
        if (eq[type]) {
            const s = getEquipmentStats(eq[type]);
            stats.attack += s.attack;
            stats.defense += s.defense;
            stats.hp += s.hp;
            stats.critRate += s.critRate;
            stats.critDamage += s.critDamage;
            stats.lifeSteal += s.lifeSteal;
            stats.combo += s.combo;
        }
    });

    // 套装加成
    const setBonus = calculateSetBonus();
    stats.attack += setBonus.bonus.attack;
    stats.defense += setBonus.bonus.defense;
    stats.hp += setBonus.bonus.hp;
    stats.critRate += setBonus.bonus.critRate;

    // 宝石加成
    const gemBonus = calculateGemBonus();
    stats.attack += gemBonus.attack;
    stats.defense += gemBonus.defense;
    stats.hp += gemBonus.hp;
    stats.critRate += gemBonus.critRate;

    GameData.player.maxHp = stats.hp;
    if (GameData.player.currentHp > stats.hp) {
        GameData.player.currentHp = stats.hp;
    }
    return stats;
}

/**
 * 计算战力
 */
export function calculatePower() {
    const stats = calculateStats();
    return Math.floor(
        stats.attack * 2 +
        stats.defense * 1.5 +
        stats.hp * 0.5 +
        stats.critRate * 10 +
        (stats.critDamage || 50) * 2 +
        (stats.lifeSteal || 0) * 20 +
        (stats.combo || 0) * 15 +
        GameData.player.level * 50
    );
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
    const icons = { head: '⛑️', clothes: '👕', weapon: '🗡️', cloak: '🦺', armor: '🛡️', boots: '👢', ring: '💍', amulet: '🧿', accessory: '🎀' };

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
}
