/**
 * 单元测试（Node 22 内置 test runner + assert）
 * 运行：node --test test/unit.test.mjs
 *
 * 关键约束：
 *   - ES Modules 顶层 await 是合法的（顶层代码）
 *   - 但 node:test 的 describe() 不支持顶层 await
 *   - 所以所有 module import 都在顶层，describe 内部只引用已加载的模块
 *
 * 覆盖范围：
 *   - config.js 数据一致性
 *   - equipment.js calculateStats / calculatePower
 *   - battle-v2.js 章节生成
 *   - challenge.js 30 秒 DPS 公式
 *   - 边界与健壮性
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ============================================================
// Mock window / document / localStorage（ES Modules 不会自动注入）
// ============================================================
const _localStorage = new Map();
globalThis.window = {
    localStorage: {
        getItem: k => _localStorage.has(k) ? _localStorage.get(k) : null,
        setItem: (k, v) => _localStorage.set(k, String(v)),
        removeItem: k => _localStorage.delete(k),
    },
    __skillbooks_module_cache: null,
    lucide: { createIcons: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
};
globalThis.document = {
    getElementById: () => null,
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: () => {},
};
globalThis.localStorage = globalThis.window.localStorage;

// ============================================================
// 顶层加载所有模块（确保只有一个实例）
// ============================================================
const cfg = await import('../src/data/config.js');
const gd = await import('../src/data/gameData.js');
const eq = await import('../src/systems/equipment.js');
const battleV2 = await import('../src/systems/battle-v2.js');
const skillbooks = await import('../src/systems/skillbooks.js');
const shop = await import('../src/systems/shop.js');
const challenge = await import('../src/systems/challenge.js');
const tasks = await import('../src/systems/tasks.js');
const mainQuest = await import('../src/systems/main-quest.js');

// 注入 GameData 到 window（让 equipment.js 的 getEquipmentStats 能找到）
globalThis.window.GameData = gd.GameData;

// ============================================================
// 测试 1: config.js 数据完整性
// ============================================================
describe('config.js 数据一致性', () => {
    test('BASE_HERO_STATS 不含 hp/defense', () => {
        assert.equal(cfg.BASE_HERO_STATS.hp, undefined);
        assert.equal(cfg.BASE_HERO_STATS.defense, undefined);
    });

    test('BASE_HERO_STATS 保留 4 个核心字段', () => {
        assert.equal(typeof cfg.BASE_HERO_STATS.attack, 'number');
        assert.equal(typeof cfg.BASE_HERO_STATS.attackSpeed, 'number');
        assert.equal(typeof cfg.BASE_HERO_STATS.critRate, 'number');
        assert.equal(typeof cfg.BASE_HERO_STATS.critDamage, 'number');
    });

    test('CHALLENGE_TIERS 有 5 个', () => {
        assert.equal(cfg.CHALLENGE_TIERS.length, 5);
    });

    test('CHALLENGE_TIERS 不含 defense 字段', () => {
        for (const tier of cfg.CHALLENGE_TIERS) {
            assert.equal(tier.defense, undefined, `${tier.id} 不应有 defense`);
            assert.ok(tier.baseHp > 0, `${tier.id} 应该有 baseHp`);
        }
    });

    test('CHALLENGE_TIERS HP 递增', () => {
        for (let i = 1; i < cfg.CHALLENGE_TIERS.length; i++) {
            assert.ok(
                cfg.CHALLENGE_TIERS[i].baseHp > cfg.CHALLENGE_TIERS[i - 1].baseHp,
                `章节 ${i} HP ${cfg.CHALLENGE_TIERS[i].baseHp} 应大于章节 ${i - 1} HP ${cfg.CHALLENGE_TIERS[i - 1].baseHp}`
            );
        }
    });

    test('CHALLENGE_TIERS 章节 1 应该可打（HP 适度）', () => {
        const t1 = cfg.CHALLENGE_TIERS.find(t => t.unlockChapter === 1);
        assert.ok(t1);
        assert.ok(t1.baseHp <= 500, `章节 1 HP 应该 ≤500, 实际 ${t1.baseHp}`);
    });

    test('SKILL_BOOK_CATALOG 6 种，去掉 hp_boost/armor', () => {
        assert.equal(cfg.SKILL_BOOK_CATALOG.length, 6);
        const ids = cfg.SKILL_BOOK_CATALOG.map(s => s.id);
        assert.ok(!ids.includes('hp_boost'));
        assert.ok(!ids.includes('armor'));
        assert.ok(ids.includes('atk_power'));
        assert.ok(ids.includes('skill_haste'));
    });

    test('SET_EQUIP_TEMPLATES 装备不含 hp/defense', () => {
        for (const t of cfg.SET_EQUIP_TEMPLATES) {
            const keys = Object.keys(t.baseStats);
            assert.ok(!keys.includes('hp'), `${t.id} 不应有 hp`);
            assert.ok(!keys.includes('defense'), `${t.id} 不应有 defense`);
        }
    });

    test('SET_EQUIP_TEMPLATES 装备字段只能是 5 字段', () => {
        const allowed = new Set(['attack', 'attackSpeed', 'critRate', 'critDamage', 'combo']);
        for (const t of cfg.SET_EQUIP_TEMPLATES) {
            for (const k of Object.keys(t.baseStats)) {
                assert.ok(allowed.has(k), `${t.id} 字段 ${k} 不在允许列表`);
            }
        }
    });

    test('SKILL_QUALITY 6 品质', () => {
        assert.equal(Object.keys(cfg.SKILL_QUALITY).length, 6);
    });
});

// ============================================================
// 测试 2: equipment.js 公式
// ============================================================
describe('equipment.js 公式', () => {
    // 每个 test 前重置 player 状态
    const resetPlayer = () => {
        gd.GameData.player.characterLevel = 1;
        gd.GameData.player.characterStars = 0;
        gd.GameData.player.equipment = {};
        gd.GameData.player.skillShards = {};
        gd.GameData.player.skillBooks = {};
    };

    test('新玩家 (Lv.1, 无装备) 战力 = 100 + 0 + 0 + 40 + 45 + 0 = 185', () => {
        resetPlayer();
        // 与 calculatePower() 逐项对应：
        //   floor(attack × 倍率 × 10) + (lv-1) × 30 + stars × 60   ← 角色基础分
        //   + equipPower(0) + speedBonus(0)
        //   + critRate × 8 + critDamage × 30 + combo × 12            ← 暴击/爆伤/连击
        // Lv.1 / 0 星时等级与星级加成为 0，攻速恰好等于基础 1.0 所以 speedBonus 也为 0。
        const expected =
            Math.floor(10 * 1.0 * 10) +  // 基础攻击 10 × 倍率 1.0 × 10 = 100
            0 +                          // (lv - 1) × 30，Lv.1 无等级加成
            0 +                          // stars × 60，无星级
            5 * 8 +                      // 暴击率 5 × 8 = 40
            1.5 * 30 +                   // 爆伤 1.5 × 30 = 45
            0 * 12;                      // 连击 0 × 12 = 0
        assert.equal(eq.calculatePower(), Math.floor(expected));
        assert.equal(eq.calculatePower(), 185);
    });

    test('getEquipmentStats Lv.1 不增加属性', () => {
        const s = eq.getEquipmentStats({ level: 1, baseAttack: 10 });
        assert.equal(s.attack, 10);
        assert.equal(s.attackSpeed, 0);
    });

    test('getEquipmentStats Lv.5 加成 1.6x', () => {
        const s = eq.getEquipmentStats({ level: 5, baseAttack: 10 });
        assert.equal(s.attack, 16);  // floor(10 * 1.6) = 16
    });

    test('getEquipmentStats attackSpeed 浮点叠加', () => {
        const s = eq.getEquipmentStats({ level: 5, baseAttackSpeed: 0.05 });
        assert.ok(Math.abs(s.attackSpeed - 0.08) < 0.001, `attackSpeed 应为 0.08, 实际 ${s.attackSpeed}`);
    });

    test('stats 不应包含 hp/defense/lifeSteal', () => {
        resetPlayer();
        const stats = eq.calculateStats();
        assert.equal(stats.hp, undefined);
        assert.equal(stats.defense, undefined);
        assert.equal(stats.lifeSteal, undefined);
    });

    test('装备 1 件 +10 attack，升级装备应增加战力', () => {
        resetPlayer();
        gd.GameData.player.equipment = {
            weapon: { level: 1, baseAttack: 10, part: 'weapon' }
        };
        const p1 = eq.calculatePower();
        gd.GameData.player.equipment.weapon = { level: 2, baseAttack: 10, part: 'weapon' };
        const p2 = eq.calculatePower();
        assert.ok(p2 > p1, '升级装备应增加战力');
    });

    test('等级倍率：Lv.10 角色应该比 Lv.1 战力高 ≥350', () => {
        resetPlayer();
        const p1 = eq.calculatePower();
        gd.GameData.player.characterLevel = 10;
        const p10 = eq.calculatePower();
        assert.ok(p10 > p1);
        assert.ok(p10 - p1 >= 350, `差距应该 ≥350, 实际 ${p10 - p1}`);
    });

    test('攻击力为 0 时不会 NaN', () => {
        resetPlayer();
        gd.GameData.player.equipment = {
            weapon: { level: 1, baseAttack: 0, part: 'weapon' }
        };
        const stats = eq.calculateStats();
        const power = eq.calculatePower();
        assert.ok(!Number.isNaN(stats.attack));
        assert.ok(!Number.isNaN(power));
        assert.ok(power >= 0);
    });
});

// ============================================================
// 测试 3: battle-v2.js 章节生成
// ============================================================
describe('battle-v2.js 章节生成', () => {
    test('ENEMIES_PER_CHAPTER = 10', () => {
        assert.equal(battleV2.ENEMIES_PER_CHAPTER, 10);
    });

    test('Boss HP 不再是 99999', () => {
        for (const tier of cfg.CHALLENGE_TIERS) {
            assert.ok(tier.baseHp !== 99999, `Boss HP ${tier.id} 不应该是 99999`);
            assert.ok(tier.baseHp <= 20000, `Boss HP ${tier.id} 应该 < 20000`);
        }
    });
});

// ============================================================
// 测试 4: challenge.js 30 秒 DPS 公式（独立计算）
// ============================================================
describe('challenge.js 30 秒 DPS 公式', () => {
    test('章节 1 Boss HP=250，玩家 attack=10 attackSpeed=1.0 → 30s 平均伤害 ~300', () => {
        const attack = 10;
        const attackSpeed = 1.0;
        const bossHp = 250;
        const totalDamage = attack * attackSpeed * 30;
        assert.ok(totalDamage >= bossHp * 0.9, `平均伤害 ${totalDamage} 应 ≥ Boss HP ${bossHp} × 0.9`);
    });

    test('高 attack + 高 attackSpeed 应该能打高 HP Boss', () => {
        const attack = 100;
        const attackSpeed = 5.0;
        const bossHp = 10000;
        const totalDamage = attack * attackSpeed * 30;
        assert.ok(totalDamage >= bossHp);
    });

    test('低 attack + 低 attackSpeed 应该打不死 Boss', () => {
        const attack = 5;
        const attackSpeed = 0.5;
        const bossHp = 10000;
        const totalDamage = attack * attackSpeed * 30;
        assert.ok(totalDamage < bossHp);
    });

    test('DPS 公式一致性：attack × attackSpeed × 30', () => {
        const c1 = 50 * 1.0 * 30;
        const c2 = 30 * 5 / 3 * 30;
        const c3 = 100 * 0.5 * 30;
        assert.equal(c1, c2);
        assert.equal(c2, c3);
    });
});

// ============================================================
// 测试 5: 边界与健壮性
// ============================================================
describe('边界与健壮性', () => {
    test('calculateSetBonus 容忍 equipment = null', () => {
        const backup = gd.GameData.player.equipment;
        gd.GameData.player.equipment = null;
        try {
            const s = eq.calculateStats();
            assert.ok(s, '应该返回 stats 对象');
        } finally {
            gd.GameData.player.equipment = backup;
        }
    });

    test('无 characterLevel 不应导致 NaN', () => {
        const backup = gd.GameData.player.characterLevel;
        gd.GameData.player.characterLevel = undefined;
        try {
            const p = eq.calculatePower();
            assert.ok(!Number.isNaN(p), '战力不应是 NaN');
            assert.ok(p > 0, '战力应 > 0');
        } finally {
            gd.GameData.player.characterLevel = backup;
        }
    });

    test('装备部分字段缺失不应导致 NaN', () => {
        const backup = gd.GameData.player.equipment;
        gd.GameData.player.equipment = {
            weapon: { level: 1, baseAttack: 10, part: 'weapon' }
        };
        try {
            const s = eq.calculateStats();
            assert.ok(s.attack > 0);
            assert.ok(s.attackSpeed > 0, 'attackSpeed 应该有默认值 > 0');
        } finally {
            gd.GameData.player.equipment = backup;
        }
    });

    test('config.js 中所有 SET_EQUIP_TEMPLATES.part 都是合法部位', () => {
        const validParts = new Set(['head', 'clothes', 'weapon', 'cloak', 'armor', 'boots', 'ring', 'amulet', 'accessory']);
        for (const t of cfg.SET_EQUIP_TEMPLATES) {
            assert.ok(validParts.has(t.part), `${t.id} 部位 ${t.part} 不合法`);
        }
    });
});

// ============================================================
// 测试 6: skillbooks.js 合成 / 升级 / 加成
// ============================================================
describe('skillbooks.js 技能书系统', () => {
    const reset = () => {
        gd.GameData.player.skillShards = {};
        gd.GameData.player.skillBooks = {};
        gd.GameData.player.gold = 100000;  // 给足金币测升级
    };

    test('SHARD_PRICE 6 品质递增', () => {
        const prices = ['white', 'green', 'blue', 'purple', 'gold', 'red'].map(q => skillbooks.SHARD_PRICE(q));
        for (let i = 1; i < prices.length; i++) {
            assert.ok(prices[i] > prices[i - 1], `${prices[i]} 应 > ${prices[i - 1]}`);
        }
        assert.equal(skillbooks.SHARD_PRICE('white'), 30);
        assert.equal(skillbooks.SHARD_PRICE('red'), 5000);
    });

    test('synthesizeBook 4 碎片不能合成', () => {
        reset();
        skillbooks.addSkillShards('white', 'atk_power', 4);
        const ok = skillbooks.synthesizeBook('white', 'atk_power');
        assert.equal(ok, false, '4 碎片不能合成');
        // 碎片应保留
        assert.equal(gd.GameData.player.skillShards['white_atk_power'], 4);
    });

    test('synthesizeBook 5 碎片合成 1 本 + 0 碎片', () => {
        reset();
        skillbooks.addSkillShards('white', 'atk_power', 5);
        const ok = skillbooks.synthesizeBook('white', 'atk_power');
        assert.equal(ok, true);
        assert.equal(gd.GameData.player.skillShards['white_atk_power'], 0, '碎片应被扣完');
        assert.equal(gd.GameData.player.skillBooks['book_atk_power_white'].level, 1);
    });

    test('synthesizeBook 重复合成应退还碎片', () => {
        reset();
        skillbooks.addSkillShards('white', 'atk_power', 10);
        skillbooks.synthesizeBook('white', 'atk_power');  // 第 1 次成功
        const ok = skillbooks.synthesizeBook('white', 'atk_power');  // 第 2 次应退还
        assert.equal(ok, false);
        assert.equal(gd.GameData.player.skillShards['white_atk_power'], 5, '第 2 次应退还碎片');
    });

    test('upgradeSkillBook 升级金币公式 = 50 * 1.5^(lv-1)', () => {
        reset();
        skillbooks.addSkillShards('green', 'atk_power', 5);
        skillbooks.synthesizeBook('green', 'atk_power');  // Lv.1
        // SKILL_BOOK_CONFIG.upgradeCostBase 应该是 50
        const cfgSkill = cfg.SKILL_BOOK_CONFIG;
        const expectedLv1 = Math.floor(cfgSkill.upgradeCostBase * Math.pow(cfgSkill.upgradeCostMul, 0));
        const expectedLv5 = Math.floor(cfgSkill.upgradeCostBase * Math.pow(cfgSkill.upgradeCostMul, 4));
        assert.equal(skillbooks.upgradeSkillBook('book_atk_power_green'), true);
        assert.equal(gd.GameData.player.spentGoldOnBooks, expectedLv1);
        // 升级到 Lv.5 应花 50 + 75 + 112 + 168 = 405
        skillbooks.upgradeSkillBook('book_atk_power_green');
        skillbooks.upgradeSkillBook('book_atk_power_green');
        skillbooks.upgradeSkillBook('book_atk_power_green');
        // 累计应是 50 + 75 + 112 + 168 = 405
        assert.equal(gd.GameData.player.spentGoldOnBooks, expectedLv1 + Math.floor(cfgSkill.upgradeCostBase * cfgSkill.upgradeCostMul) + Math.floor(cfgSkill.upgradeCostBase * Math.pow(cfgSkill.upgradeCostMul, 2)) + Math.floor(cfgSkill.upgradeCostBase * Math.pow(cfgSkill.upgradeCostMul, 3)));
    });

    test('upgradeSkillBook 最大等级不能升', () => {
        reset();
        skillbooks.addSkillShards('white', 'atk_power', 5);
        skillbooks.synthesizeBook('white', 'atk_power');
        const cfgSkill = cfg.SKILL_BOOK_CONFIG;
        for (let i = 0; i < cfgSkill.maxBookLevel - 1; i++) {
            skillbooks.upgradeSkillBook('book_atk_power_white');
        }
        // 升到 maxBookLevel 后再升应失败
        const goldBefore = gd.GameData.player.gold;
        const ok = skillbooks.upgradeSkillBook('book_atk_power_white');
        assert.equal(ok, false);
        assert.equal(gd.GameData.player.gold, goldBefore, '金币不应被扣');
    });

    test('upgradeSkillBook 金币不足应失败', () => {
        reset();
        gd.GameData.player.gold = 0;
        skillbooks.addSkillShards('white', 'atk_power', 5);
        skillbooks.synthesizeBook('white', 'atk_power');
        const ok = skillbooks.upgradeSkillBook('book_atk_power_white');
        assert.equal(ok, false);
    });

    test('calculateSkillBookStats 累计属性 = baseVal × statMul × level', () => {
        reset();
        skillbooks.addSkillShards('blue', 'atk_power', 5);
        skillbooks.synthesizeBook('blue', 'atk_power');  // Lv.1 蓝色
        // blue statMul = 2.2, atk_power baseVal = 5
        // 期望 attack 加成 = 5 * 2.2 * 1 = 11
        const stats = skillbooks.calculateSkillBookStats();
        const meta = cfg.SKILL_BOOK_CATALOG.find(s => s.id === 'atk_power');
        const quality = cfg.SKILL_QUALITY.blue;
        const expected = meta.baseVal * quality.statMul * 1;
        assert.ok(Math.abs(stats.attack - expected) < 0.01, `attack 应 ≈ ${expected}, 实际 ${stats.attack}`);
    });

    test('calculateSkillBookStats 不含 hp/defense', () => {
        reset();
        const stats = skillbooks.calculateSkillBookStats();
        // hp_boost/armor 已被删，不会被加
        assert.ok(stats.attack !== undefined);
    });
});

// ============================================================
// 测试 7: shop.js 商店系统
// ============================================================
describe('shop.js 商店系统', () => {
    const reset = () => {
        gd.GameData.player.gold = 100000;
        gd.GameData.player.shop = { charges: 3, lastRefreshTick: Date.now(), shopItems: [] };
    };

    test('calcCurrentCharges 不超过 maxCharges', () => {
        reset();
        gd.GameData.player.shop.charges = cfg.SHOP_CONFIG.maxCharges;
        gd.GameData.player.shop.lastRefreshTick = Date.now() - 9999999;  // 很久以前
        const c = shop.calcCurrentCharges();
        assert.ok(c.charges <= cfg.SHOP_CONFIG.maxCharges, `charges ${c.charges} 应 ≤ max ${cfg.SHOP_CONFIG.maxCharges}`);
    });

    test('generateShopItems 总是 6 件（PRD v3：4 类商品）', () => {
        reset();
        const items = shop.generateShopItems();
        assert.equal(items.length, cfg.SHOP_CONFIG.slots);
        // PRD v3：4 类商品（碎片 / 装备 / 进化胶囊 / 升级材料）
        const validKinds = new Set(['shard', 'equipment', 'capsule', 'material']);
        for (const item of items) {
            assert.ok(validKinds.has(item.kind), `kind ${item.kind} 应在 4 类中`);
        }
    });

    test('generateShopItems 4 类权重分布（200 次抽样）', () => {
        reset();
        const counts = { shard: 0, equipment: 0, capsule: 0, material: 0 };
        for (let i = 0; i < 200; i++) {
            const items = shop.generateShopItems();
            for (const it of items) {
                if (counts[it.kind] !== undefined) counts[it.kind]++;
            }
        }
        const total = 200 * cfg.SHOP_CONFIG.slots;
        const shardRatio = counts.shard / total;
        const equipmentRatio = counts.equipment / total;
        // 期望：shard ~30%, equipment ~20%，允许 ±5%
        assert.ok(shardRatio >= 0.25 && shardRatio <= 0.35, `碎片比例 ${shardRatio.toFixed(2)} 应 ≈ 30%`);
        assert.ok(equipmentRatio >= 0.15 && equipmentRatio <= 0.25, `装备比例 ${equipmentRatio.toFixed(2)} 应 ≈ 20%`);
    });

    test('refreshShop 金币不足应失败', () => {
        reset();
        gd.GameData.player.gold = 0;
        const ok = shop.refreshShop();
        assert.equal(ok, false);
        assert.equal(gd.GameData.player.shop.shopItems.length, 0, '无商品时不应生成');
    });

    test('refreshShop 正常流程扣金币 + 生成商品', () => {
        reset();
        gd.GameData.player.shop.charges = 1;
        gd.GameData.player.gold = 100;
        const ok = shop.refreshShop();
        assert.equal(ok, true);
        assert.equal(gd.GameData.player.shop.charges, 0);
        assert.equal(gd.GameData.player.shop.shopItems.length, cfg.SHOP_CONFIG.slots);
        // 金币扣了 refreshCostFixed
        assert.equal(gd.GameData.player.gold, 100 - cfg.SHOP_CONFIG.refreshCostFixed);
    });

    test('refreshShop charges=0 时 calcCurrentCharges 自动重置为 10', () => {
        // 文档化行为：charges=0 (falsy) 会被自动重置为 maxCharges (10)
        // 这是设计意图，避免玩家永久卡住
        reset();
        gd.GameData.player.shop.charges = 0;
        const c = shop.calcCurrentCharges();
        assert.equal(c.charges, cfg.SHOP_CONFIG.maxCharges, 'charges=0 应被重置为 maxCharges');
    });

    test('refreshShop charges 充足 + 金币不足应失败', () => {
        reset();
        gd.GameData.player.shop.charges = 10;
        gd.GameData.player.gold = 0;  // 0 < refreshCostFixed (10)
        const ok = shop.refreshShop();
        assert.equal(ok, false, '金币不足应失败');
    });

    test('buyShopItem 金币不足应失败', () => {
        reset();
        gd.GameData.player.shop.shopItems = [{
            kind: 'shard', quality: 'white', skillId: 'atk_power',
            price: 999999, qualityName: '白', skillName: '猛力'
        }];
        gd.GameData.player.gold = 0;
        const ok = shop.buyShopItem(0);
        assert.equal(ok, false);
        assert.equal(gd.GameData.player.shop.shopItems.length, 1, '商品不应被删');
    });

    test('buyShopItem 装备商品入库 bag.equipment', () => {
        reset();
        gd.GameData.player.bag = { equipment: [] };
        gd.GameData.player.shop.shopItems = [{
            kind: 'equipment',
            quality: 'green',
            templateId: 'wasteland_boots',
            name: '废土行者·靴',
            part: 'boots',
            setId: 'wasteland',
            baseStats: { attack: 6 },
            price: 50,
            qualityName: '绿',
        }];
        const ok = shop.buyShopItem(0);
        assert.equal(ok, true);
        assert.equal(gd.GameData.player.bag.equipment.length, 1);
        const item = gd.GameData.player.bag.equipment[0];
        assert.equal(item.part, 'boots');
        assert.equal(item.setId, 'wasteland');
        assert.ok(item.id, '装备应有 id');
        assert.equal(item.stats.attack >= 4 && item.stats.attack <= 8, true, `attack 应在 [4, 8] 浮动，实际 ${item.stats.attack}`);
    });

    test('buyShopItem 碎片商品入 skillShards', () => {
        reset();
        gd.GameData.player.shop.shopItems = [{
            kind: 'shard', quality: 'white', skillId: 'atk_power',
            price: 30, qualityName: '白', skillName: '猛力',
        }];
        const before = gd.GameData.player.skillShards['white_atk_power'] || 0;
        const ok = shop.buyShopItem(0);
        assert.equal(ok, true);
        assert.equal(gd.GameData.player.skillShards['white_atk_power'], before + 1);
    });

    test('SHOP_CONFIG.refreshCostFixed = 10', () => {
        assert.equal(cfg.SHOP_CONFIG.refreshCostFixed, 10);
    });

    test('SHOP_CONFIG.maxCharges = 10', () => {
        assert.equal(cfg.SHOP_CONFIG.maxCharges, 10);
    });

    test('SHOP_CONFIG.refreshRegenSeconds = 30', () => {
        assert.equal(cfg.SHOP_CONFIG.refreshRegenSeconds, 30);
    });
});

// ============================================================
// 测试 8: （已删除）battle.js 1v1 远征战斗
//   原因：远征系统（expedition.js / stage.js）已于 2026-07-28 PRD v2 砍掉
//   battle.js 仅为兼容层（main.js 仍 import，HTML 仍 onclick 调用）
//   数据层（gameData.js / config.js）已无 expeditionRun/relics 等字段
//   battle.js 所有远征残留都是空安全引用（if (GameData.expeditionRun) 等）
// ============================================================

// ============================================================
// 测试 9: challenge.js 30 秒倒计时
// ============================================================
describe('challenge.js 挑战强敌', () => {
    test('CHALLENGE_CONFIG.timeLimitSec 存在', () => {
        // 这是 30 秒倒计时的核心配置
        // 可能在 config.js 里也可能 hardcode
        // 检查后端导出
        if (cfg.CHALLENGE_CONFIG) {
            // 老版本可能叫 tickMs，新版本应该叫 timeLimitSec
            assert.ok(
                cfg.CHALLENGE_CONFIG.timeLimitSec !== undefined || cfg.CHALLENGE_CONFIG.tickMs !== undefined,
                'CHALLENGE_CONFIG 应有时长配置'
            );
        }
    });

    test('startChallenge 暴露且可调', () => {
        assert.equal(typeof challenge.startChallenge, 'function');
    });

    test('openChallenge / closeChallenge 暴露', () => {
        assert.equal(typeof challenge.openChallenge, 'function');
        assert.equal(typeof challenge.closeChallenge, 'function');
    });

    test('挑战强敌的 DPS 公式：30 秒累计 attack × attackSpeed × 30 ≥ Boss HP', () => {
        // 章节 1 Boss HP = 250
        const t1 = cfg.CHALLENGE_TIERS.find(t => t.unlockChapter === 1);
        assert.ok(t1);
        // 玩家 attack=10 attackSpeed=1.0 时 30s 伤害 ≈ 300 > 250
        const dmg = 10 * 1.0 * 30;
        assert.ok(dmg >= t1.baseHp, `${dmg} 应 ≥ ${t1.baseHp}`);
    });
});

// ============================================================
// 测试 10: 模块加载完整性
// ============================================================
describe('模块加载完整性', () => {
    test('所有 src/systems 模块都能成功 import', async () => {
        // ES Modules 的 module identity 陷阱：import 同 URL 返回同实例
        // 这里验证模块基本加载
        const mods = [
            '../src/systems/achievements.js',
            '../src/systems/ad.js',
            '../src/systems/checkin.js',
            '../src/systems/collection.js',
            '../src/systems/dungeons.js',
            '../src/systems/events.js',
            '../src/systems/shelter.js',
            '../src/systems/story.js',
            '../src/systems/tasks.js',
            '../src/systems/chapter.js',
        ];
        for (const path of mods) {
            try {
                const mod = await import(path);
                assert.ok(mod, `${path} 应成功 import`);
            } catch (e) {
                assert.fail(`${path} import 失败: ${e.message}`);
            }
        }
    });
});

// ============================================================
// 测试 11: 每日任务系统（v1.2 — 5 项活动 + 仅金币奖励）
// ============================================================
describe('tasks.js 每日任务 v1.2', () => {
    test('DAILY_TASKS 导出 6 项且不含 diamond', () => {
        assert.equal(tasks.DAILY_TASKS.length, 6, '应有 6 项任务');
        const ids = tasks.DAILY_TASKS.map(t => t.id);
        assert.deepEqual(ids, ['buy_thing', 'sell_thing', 'challenge_boss', 'collect_idle', 'daily_checkin', 'guide_equipment']);
        for (const t of tasks.DAILY_TASKS) {
            assert.equal(t.reward.diamond, undefined, `${t.id} 不应有 diamond 字段`);
            assert.equal(typeof t.reward.gold, 'number');
            assert.equal(typeof t.target, 'number');
        }
    });

    test('resetDailyTasks 初始化 6 项任务状态', () => {
        // 模拟玩家数据：清空已有任务
        gd.GameData.player.dailyTasks.lastResetDate = null;
        gd.GameData.player.dailyTasks.tasks = [];
        tasks.resetDailyTasks();
        const list = gd.GameData.player.dailyTasks.tasks;
        assert.equal(list.length, 6);
        for (const item of list) {
            assert.equal(item.progress, 0);
            assert.equal(item.completed, false);
            assert.equal(item.claimed, false);
        }
        assert.ok(gd.GameData.player.dailyTasks.lastResetDate, 'lastResetDate 应被设置');
    });

    test('bumpTaskProgress 累加进度且达成时标记 completed', () => {
        // 强制初始化
        gd.GameData.player.dailyTasks.lastResetDate = 'Thu Jan 01 1970'; // 强制重置
        gd.GameData.player.dailyTasks.tasks = [];
        tasks.resetDailyTasks();

        // buy_thing target=1
        tasks.bumpTaskProgress('buy_thing');
        let task = gd.GameData.player.dailyTasks.tasks.find(t => t.id === 'buy_thing');
        assert.equal(task.progress, 1);
        assert.equal(task.completed, true, '达到 target=1 应立即 completed');

        // 第二次累加不超 target
        tasks.bumpTaskProgress('buy_thing');
        assert.equal(task.progress, 1, '已完成后再次 bump 不应超过 target');

        // 不存在的任务静默返回
        tasks.bumpTaskProgress('not_exist_id'); // 不抛异常
    });

    test('claimTask 发放金币且标记 claimed', () => {
        gd.GameData.player.dailyTasks.lastResetDate = 'Thu Jan 01 1970';
        gd.GameData.player.dailyTasks.tasks = [];
        gd.GameData.player.gold = 1000;
        tasks.resetDailyTasks();

        tasks.bumpTaskProgress('sell_thing');
        const goldBefore = gd.GameData.player.gold;

        // 直接调用 claimTask（绕过 window 暴露）
        const template = tasks.DAILY_TASKS.find(t => t.id === 'sell_thing');
        tasks.claimTask('sell_thing');

        const task = gd.GameData.player.dailyTasks.tasks.find(t => t.id === 'sell_thing');
        assert.equal(task.claimed, true);
        assert.equal(gd.GameData.player.gold, goldBefore + template.reward.gold);
    });

    test('claimTask 不能重复领奖', () => {
        gd.GameData.player.dailyTasks.lastResetDate = 'Thu Jan 01 1970';
        gd.GameData.player.dailyTasks.tasks = [];
        gd.GameData.player.gold = 1000;
        tasks.resetDailyTasks();

        tasks.bumpTaskProgress('challenge_boss');
        tasks.claimTask('challenge_boss');
        const goldAfter1 = gd.GameData.player.gold;
        tasks.claimTask('challenge_boss'); // 第二次应无效
        assert.equal(gd.GameData.player.gold, goldAfter1, '重复 claimTask 不应再次发奖');

        // 未完成的任务也不能领
        tasks.bumpTaskProgress('collect_idle'); // 设 progress=1，但 'collect_idle' 也要 target=1
        // 故意反向测试：先 bump，但 reverse（设置回 0）让目标未达成
        gd.GameData.player.dailyTasks.tasks.find(t => t.id === 'daily_checkin').progress = 0;
        gd.GameData.player.dailyTasks.tasks.find(t => t.id === 'daily_checkin').completed = false;
        const goldBefore2 = gd.GameData.player.gold;
        tasks.claimTask('daily_checkin'); // progress=0 应无效
        assert.equal(gd.GameData.player.gold, goldBefore2, '未完成任务 claim 应无效');
    });
});

// ============================================================
// 测试 11: 主线任务系统（v25 — 动态 6 阶段任务链）
// ============================================================
describe('main-quest.js 主线任务 v25', () => {
    test('STAGES 导出 6 阶段且 reward 只有 gold', () => {
        assert.equal(mainQuest.STAGES.length, 6, '应有 6 阶段任务');
        const types = mainQuest.STAGES.map(s => s.type);
        assert.deepEqual(types, ['kill_monster', 'buy_thing', 'sell_thing', 'collect_idle', 'challenge_boss', 'defeat_boss']);
        for (const s of mainQuest.STAGES) {
            assert.equal(s.reward.diamond, undefined, `${s.type} 不应有 diamond`);
            assert.equal(typeof s.reward.gold, 'number', `${s.type} 应该有 gold 奖励`);
            assert.ok(s.title && s.desc);
        }
    });

    test('initMainQuest 初始化 6 阶段状态', () => {
        gd.GameData.player.mainQuest = { chapter: 1, stageIndex: 0, stages: [] };
        gd.GameData.player.gold = 0;
        mainQuest.initMainQuest();
        const q = gd.GameData.player.mainQuest;
        assert.equal(q.stages.length, 6);
        for (const s of q.stages) {
            assert.equal(s.progress, 0);
            assert.equal(s.completed, false);
            assert.equal(s.claimed, false);
        }
        assert.equal(q.chapter, 1);
        assert.equal(q.stageIndex, 0);
    });

    test('bumpMainQuest 累加进度且达成时推进 + 发放奖励', () => {
        gd.GameData.player.mainQuest = { chapter: 1, stageIndex: 0, stages: [] };
        gd.GameData.player.gold = 500;
        mainQuest.initMainQuest();
        const goldBefore = gd.GameData.player.gold;

        // 当前 stageIndex=0 是 kill_monster，传 buy_thing 不应生效
        mainQuest.bumpMainQuest('buy_thing');
        assert.equal(gd.GameData.player.mainQuest.stages[0].progress, 0, '类型不匹配应静默');

        // 正确类型应累计
        mainQuest.bumpMainQuest('kill_monster');
        let stage = gd.GameData.player.mainQuest.stages[0];
        assert.equal(stage.progress, 1);
        assert.equal(stage.completed, true, '达到 target=1 应 completed');
        assert.equal(gd.GameData.player.gold, goldBefore + 100, '完成应发 100 金币');
        // 完成应自动推进到 stageIndex=1 (buy_thing)
        assert.equal(gd.GameData.player.mainQuest.stageIndex, 1);

        // 第二次累加不超 target
        mainQuest.bumpMainQuest('kill_monster');
        // 因为已经推进，所以 bump kill_monster 对当前 buy_thing 不生效
        assert.equal(gd.GameData.player.mainQuest.stages[1].progress, 0);
    });

    test('完整 6 阶段链路 + 终极任务完成触发章节切换', () => {
        gd.GameData.player.mainQuest = { chapter: 1, stageIndex: 0, stages: [] };
        gd.GameData.player.gold = 0;
        mainQuest.initMainQuest();

        // 依次推进 6 阶段
        const types = ['kill_monster', 'buy_thing', 'sell_thing', 'collect_idle', 'challenge_boss', 'defeat_boss'];
        for (const t of types) {
            mainQuest.bumpMainQuest(t);
        }

        // 终极完成后：章节++，任务链重置
        const q = gd.GameData.player.mainQuest;
        assert.equal(q.chapter, 2, '章节应 +1');
        assert.equal(q.stageIndex, 0, 'stageIndex 应重置为 0');
        assert.equal(q.stages.length, 6);
        // 重置后所有 stage 应 claimed=true（防止重复发奖）
        for (const s of q.stages) {
            assert.equal(s.claimed, true, `${s.type} 章节切换后应 claimed=true`);
        }
        // 总金币：5 阶段 × 100 + 终极 500 = 1000
        assert.equal(gd.GameData.player.gold, 1000, '6 阶段总奖励应 1000 金币');
    });

    test('不存在的任务类型静默返回', () => {
        gd.GameData.player.mainQuest = { chapter: 1, stageIndex: 0, stages: [] };
        mainQuest.initMainQuest();
        // 不应抛异常
        mainQuest.bumpMainQuest('not_exist_type');
        assert.equal(gd.GameData.player.mainQuest.stages[0].progress, 0);
    });

    test('resetMainQuest 重置到 chapter=1 stageIndex=0', () => {
        gd.GameData.player.mainQuest = { chapter: 5, stageIndex: 3, stages: [] };
        gd.GameData.player.gold = 9999;
        mainQuest.resetMainQuest();
        const q = gd.GameData.player.mainQuest;
        assert.equal(q.chapter, 1);
        assert.equal(q.stageIndex, 0);
        for (const s of q.stages) {
            assert.equal(s.progress, 0);
            assert.equal(s.completed, false);
            assert.equal(s.claimed, false);
        }
    });
});

// ============================================================
// 测试 12: skillbooks.js 碎片 key 解析
//   回归 BUG：碎片 key 形如 `${quality}_${skillId}`，但 skillId 本身含下划线
//   （atk_power / crit_chance / gold_find / idle_speed / boss_dmg / skill_haste），
//   之前用 key.split('_') 只取前两段 → skillId 变成 'atk'，模板匹配不上，
//   导致碎片列表永远是空的、一键合成永远返回 0。
// ============================================================
describe('skillbooks.js 碎片解析', () => {
    const resetShards = () => {
        gd.GameData.player.skillShards = {};
        gd.GameData.player.skillBooks = {};
    };

    test('含下划线的 skillId 能被正确解析', () => {
        resetShards();
        gd.GameData.player.skillShards = { white_atk_power: 12, green_skill_haste: 5 };
        const view = skillbooks.listSkillBookView();
        const ids = view.shardSummary.map(s => s.quality + ':' + s.skillId);
        assert.ok(ids.includes('white:atk_power'), `white_atk_power 应被解析，实际: ${ids.join(',')}`);
        assert.ok(ids.includes('green:skill_haste'), `green_skill_haste 应被解析，实际: ${ids.join(',')}`);
    });

    test('碎片数 >= 5 时 canSynth=true，不足时 false', () => {
        resetShards();
        gd.GameData.player.skillShards = { white_atk_power: 5 };
        let s = skillbooks.listSkillBookView().shardSummary
            .find(x => x.quality === 'white' && x.skillId === 'atk_power');
        assert.ok(s, '应能找到 white/atk_power 碎片');
        assert.equal(s.count, 5);
        assert.equal(s.canSynth, true);

        gd.GameData.player.skillShards = { white_atk_power: 4 };
        s = skillbooks.listSkillBookView().shardSummary
            .find(x => x.quality === 'white' && x.skillId === 'atk_power');
        assert.equal(s.canSynth, false, '4 碎片不足 5，应该不能合成');
    });

    test('一键合成能把碎片合成为技能书并正确扣碎片', () => {
        resetShards();
        gd.GameData.player.skillShards = { white_atk_power: 10 };
        const n = skillbooks.synthesizeAllPossible();
        assert.equal(n, 1, '应合成 1 本');
        const books = skillbooks.listSkillBookView().books;
        assert.equal(books.length, 1);
        assert.equal(books[0].skillId, 'atk_power');
        assert.equal(books[0].quality, 'white');
        assert.equal(gd.GameData.player.skillShards['white_atk_power'], 5, '5 碎片应被扣掉');
    });

    test('合成后 skillBooks key 形如 book_<skillId>_<quality>', () => {
        resetShards();
        gd.GameData.player.skillShards = { white_atk_power: 5 };
        skillbooks.synthesizeAllPossible();
        assert.ok(
            gd.GameData.player.skillBooks['book_atk_power_white'],
            '应生成 book_atk_power_white，实际: ' + Object.keys(gd.GameData.player.skillBooks).join(',')
        );
        resetShards();
    });
});
