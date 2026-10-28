// ============================================================
//  src/data/config.js
//  静态配置常量（纯数据，无逻辑依赖）
//  链入方式：<script type="module" src="src/data/config.js"></script>
// ============================================================

// ============================================================
// 一、资源系统
//   6 种永久资源 + 1 种本局临时资源（金币）
// ============================================================
export const PERMANENT_RESOURCES = ['food', 'water', 'scrap', 'parts', 'radPotion', 'intel', 'blueprint'];

export const RESOURCE_META = {
    food:      { name: '食物', icon: 'wheat',     desc: '基础生存资源' },
    water:     { name: '净水', icon: 'droplet',   desc: '核心基础资源' },
    scrap:     { name: '废铁', icon: 'wrench',    desc: '锻造、工坊材料' },
    parts:     { name: '零件', icon: 'cog',       desc: '高级建筑/科技材料' },
    radPotion: { name: '辐射药剂', icon: 'flask-conical', desc: '提升小队抗性' },
    intel:     { name: '情报', icon: 'scroll',    desc: '历史货币（保留）' },
    blueprint: { name: '蓝图', icon: 'blueprint', desc: '解锁高阶内容' },
    gold:      { name: '金币', icon: 'coins',     desc: '通用货币，商店/挑战/技能书强化通用' },
};

// 离线产出公式（保留兼容）
export const IDLE_FORMULA = {
    foodPerSec: 0.5,
    waterPerSec: 0.3,
    scrapPerSec: 0.2,
    partsPerSec: 0.1,
    habitatBonusPerLevel: 0.02,
    offlineCapSeconds: 8 * 3600,
};

// ============================================================
// 二、玩家角色（2026-07-30 重构：单角色，无 HP/Defense 维度）
//   普通战斗：角色只对怪物造成伤害，不再受击、不掉血
//   挑战 Boss：30 秒倒计时，按 attack × attackSpeed × 时间 累积伤害
//   attackSpeed = 每秒攻击次数（1.0 = 1 秒 1 次，2.0 = 500ms 1 次）
// ============================================================
export const BASE_HERO_STATS = {
    attack: 10,         // 基础攻击力
    attackSpeed: 1.0,   // 基础攻速（每秒攻击次数）
    critRate: 5,        // 暴击率（%）
    critDamage: 1.5,    // 暴击伤害倍率
};

// ============================================================
// 三、技能书系统（替代旧天赋树）
//   6 种品质（白/绿/蓝/紫/金/红）
//   获取来源：商店购买碎片 → 5 碎片合成 1 本 → 金币强化
// ============================================================
export const SKILL_QUALITY = {
    white:  { id: 'white',  name: '普通', color: '#d4d4d4', statMul: 1.0, dropWeight: 60 },
    green:  { id: 'green',  name: '优秀', color: '#4ade80', statMul: 1.5, dropWeight: 25 },
    blue:   { id: 'blue',   name: '稀有', color: '#3b82f6', statMul: 2.2, dropWeight: 10 },
    purple: { id: 'purple', name: '史诗', color: '#a855f7', statMul: 3.5, dropWeight: 4  },
    gold:   { id: 'gold',   name: '传说', color: '#ffd700', statMul: 5.0, dropWeight: 1  },
    red:    { id: 'red',    name: '神话', color: '#ff4444', statMul: 8.0, dropWeight: 0  }, // 极稀有，仅推送
};

export const SKILL_QUALITY_ORDER = ['white', 'green', 'blue', 'purple', 'gold', 'red'];

// 技能书目录（2026-07-30 重构：6 种能力，移除 hp_boost / armor）
//   维度：attack / critRate / goldFind / idleSpeed / bossDmg / attackSpeed
export const SKILL_BOOK_CATALOG = [
    { id: 'atk_power',    name: '猛力',   icon: 'sword',     statKey: 'attack',      baseVal: 5   },
    { id: 'crit_chance',  name: '洞察',   icon: 'crosshair', statKey: 'critRate',    baseVal: 2   },
    { id: 'gold_find',    name: '掘金',   icon: 'coins',     statKey: 'goldFind',    baseVal: 0.10 },
    { id: 'idle_speed',   name: '潜行',   icon: 'zap',       statKey: 'idleSpeed',   baseVal: 0.05 },
    { id: 'boss_dmg',     name: '破甲',   icon: 'skull',     statKey: 'bossDmg',     baseVal: 0.03 },
    { id: 'skill_haste',  name: '迅捷',   icon: 'wind',      statKey: 'attackSpeed', baseVal: 0.10 },
];

// 合成 / 强化配置
export const SKILL_BOOK_CONFIG = {
    shardsToBook: 5,                           // 5 碎片合成 1 本
    maxBookLevel: 10,                          // 单本最高 10 级
    upgradeCostBase: 50,                       // 升级基础花费（金币）
    upgradeCostMul: 1.5,                       // 每级费用倍率
};

// ============================================================
// 四、商店系统（金币刷新，无金币袋 / 无强化石 / 无跳关券）
// ============================================================
export const SHOP_CONFIG = {
    refreshCostFixed: 10,        // 测试版固定 10 金币/次
    maxCharges: 10,              // 最多累积 10 次刷新
    refreshRegenSeconds: 30,     // 30 秒 +1
    adRewardCharges: 10,         // 看广告 +10

    slots: 6,                    // 每次刷 6 件商品
    weights: {
        shard: 60,               // 碎片（白/绿/蓝/紫/金/红 按品质权重抽）
        equipment: 40,           // 装备（按当前章节数概率调整品质）
    },
};

// ============================================================
// 五、装备模板（2026-08-03 精简：5 字段 attack/critRate/critDamage/attackSpeed/combo）
//   防御类装备改为攻击装；部位保留（头/衣/护甲/武器/靴/饰）
//   不再提供：defense / hp / lifeSteal
// ============================================================
export const SET_EQUIP_TEMPLATES = [
    // wasteland 套（章节 1 解锁）
    { id: 'wasteland_boots',     name: '废土行者·靴',    part: 'boots',     setId: 'wasteland', baseStats: { attack: 6,  combo: 1 } },
    { id: 'wasteland_vest',      name: '废土行者·背心',  part: 'armor',     setId: 'wasteland', baseStats: { attack: 12 } },
    { id: 'wasteland_mask',      name: '废土行者·面罩',  part: 'head',      setId: 'wasteland', baseStats: { attack: 4,  critRate: 1 } },
    { id: 'wasteland_gloves',    name: '废土行者·手套',  part: 'clothes',   setId: 'wasteland', baseStats: { attack: 3 } },
    // beast 套（章节 3 解锁）
    { id: 'beast_claw',          name: '野兽之爪',         part: 'weapon',    setId: 'beast',     baseStats: { attack: 16, critRate: 3, combo: 2 } },
    { id: 'beast_hide',          name: '兽皮战甲',         part: 'armor',     setId: 'beast',     baseStats: { attack: 10, attackSpeed: 0.05 } },
    { id: 'beast_fang',          name: '兽牙吊坠',         part: 'amulet',    setId: 'beast',     baseStats: { attack: 8,  critRate: 2 } },
    // mech 套（章节 5 解锁）
    { id: 'mech_core',           name: '机械核心',         part: 'weapon',    setId: 'mech',      baseStats: { attack: 24, attackSpeed: 0.05, critDamage: 0.1 } },
    { id: 'mech_plate',          name: '钛合金护板',       part: 'armor',     setId: 'mech',      baseStats: { attack: 18 } },
    { id: 'mech_visor',          name: '瞄准镜',           part: 'head',      setId: 'mech',      baseStats: { attack: 12, critRate: 4 } },
    // cursed 套（章节 7 解锁）
    { id: 'cursed_blade',        name: '诅咒之刃',         part: 'weapon',    setId: 'cursed',    baseStats: { attack: 35, attackSpeed: 0.10, combo: 3 } },
    { id: 'cursed_robe',         name: '诅咒战袍',         part: 'clothes',   setId: 'cursed',    baseStats: { attack: 14, critRate: 5 } },
    { id: 'cursed_eye',          name: '诅咒之眼',         part: 'accessory', setId: 'cursed',    baseStats: { attack: 18, critDamage: 0.15 } },
    // toxic 套（章节 10 解锁）
    { id: 'toxic_spear',         name: '毒矛',             part: 'weapon',    setId: 'toxic',     baseStats: { attack: 50, critRate: 8, combo: 4 } },
    { id: 'toxic_exo',           name: '辐射外骨骼',       part: 'armor',     setId: 'toxic',     baseStats: { attack: 40, attackSpeed: 0.10 } },
    { id: 'toxic_mask',          name: '生化面罩',         part: 'head',      setId: 'toxic',     baseStats: { attack: 22, attackSpeed: 0.05, critDamage: 0.2 } },
];

// ============================================================
// 六、挑战强敌系统（2026-07-30 重构：30 秒倒计时 + DPS 累积伤害）
//   不再有 baseAtk / defense（角色不挨打，Boss 不反击）
//   玩家总伤害 = attack × attackSpeed × 时间（30 秒）× 暴击浮动
// ============================================================
export const CHALLENGE_CONFIG = {
    dailyFree: 3,            // 默认每日 3 次
    dailyMax: 10,            // 含广告最多 10 次
    adRewardCharges: 10,     // 看广告 +10

    // 战斗配置：30 秒倒计时，按 DPS 累积伤害
    timeLimitSec: 30,        // 倒计时总时长
    tickMs: 100,             // 每 100ms 累积一次伤害（高精度）
};

export const CHALLENGE_TIERS = [
    // 章节 1 开放（玩家 attack ~10, attackSpeed ~1.0 → 30秒 ~300 伤害）
    { id: 'giant_zombie', name: '巨尸',      unlockChapter: 1, setId: 'wasteland', baseHp: 250,
      goldReward: 80,  expReward: 30  },
    // 章节 3 开放
    { id: 'mutant_bear',  name: '变异巨熊',   unlockChapter: 3, setId: 'beast',     baseHp: 800,
      goldReward: 180, expReward: 80  },
    // 章节 5 开放
    { id: 'mech_golem',   name: '机械傀儡',   unlockChapter: 5, setId: 'mech',      baseHp: 2000,
      goldReward: 350, expReward: 160 },
    // 章节 7 开放
    { id: 'cursed_knight',name: '诅咒骑士',   unlockChapter: 7, setId: 'cursed',    baseHp: 4500,
      goldReward: 600, expReward: 260 },
    // 章节 10 开放
    { id: 'toxic_lord',   name: '辐射领主',   unlockChapter: 10,setId: 'toxic',     baseHp: 10000,
      goldReward: 1200,expReward: 500 },
];

// ============================================================
// 六、立绘端口（新版手绘钢笔淡彩，2026-07-30）
//   主角 + 10 章节怪 + 4 章节 Boss
//   用于 battle-canvas.js 替换原 ctx.fillRect 程序化绘制
//   缺失图保留 fallback 程序化绘制
// ============================================================
export const PORTRAITS = {
    hero: 'assets/portraits/hero.png',
    monsterByChapter: {
        1:  'assets/portraits/monster_ch01.png',
        2:  'assets/portraits/monster_ch02.png',
        3:  'assets/portraits/monster_ch03.png',
        4:  'assets/portraits/monster_ch04.png',
        5:  'assets/portraits/monster_ch05.png',
        6:  'assets/portraits/monster_ch06.png',
        7:  'assets/portraits/monster_ch07.png',
        8:  'assets/portraits/monster_ch08.png',
        9:  'assets/portraits/monster_ch09.png',
        // ch10 暂未生成（2026-08-03：图缺，fallback 程序化绘制）
    },
    bossByChapter: {
        3:  'assets/portraits/boss_ch03.png',
        5:  'assets/portraits/boss_ch05.png',
        7:  'assets/portraits/boss_ch07.png',
        10: 'assets/portraits/boss_ch10.png',
    },
};
window.PORTRAITS = PORTRAITS;

// ============================================================
// 七、桥接到 window（兼容旧代码）
// ============================================================
window.RESOURCE_META = RESOURCE_META;
window.BASE_HERO_STATS = BASE_HERO_STATS;
window.SKILL_QUALITY = SKILL_QUALITY;
window.SKILL_BOOK_CATALOG = SKILL_BOOK_CATALOG;
window.SKILL_BOOK_CONFIG = SKILL_BOOK_CONFIG;
window.SHOP_CONFIG = SHOP_CONFIG;
window.SET_EQUIP_TEMPLATES = SET_EQUIP_TEMPLATES;
window.CHALLENGE_CONFIG = CHALLENGE_CONFIG;
window.CHALLENGE_TIERS = CHALLENGE_TIERS;
window.IDLE_FORMULA = IDLE_FORMULA;

// ============================================================
// 九、进化所升级表（2026-08-04 PRD v3）
//   10 个基因层级，每层需要的材料和金币 + 解锁的属性
// ============================================================
export const EVOLUTION_LAB_CONFIG = {
    // 基因层级 → 升级条件 + 属性奖励
    levels: [
        { level: 1,  capsules: 1,  materials: { food: 0, parts: 0, radPotion: 0, blueprint: 0, advancedEnergy: 0 }, gold: 500,    bonus: { attack: 5 } },
        { level: 2,  capsules: 3,  materials: { food: 20, parts: 10, radPotion: 0, blueprint: 0, advancedEnergy: 0 }, gold: 1000,   bonus: { critRate: 2 } },
        { level: 3,  capsules: 5,  materials: { food: 0, parts: 0, radPotion: 3, blueprint: 1, advancedEnergy: 0 }, gold: 2000,   bonus: { attack: 15, critDamage: 0.10 } },
        { level: 4,  capsules: 8,  materials: { food: 0, parts: 0, radPotion: 0, blueprint: 3, advancedEnergy: 5 }, gold: 5000,  bonus: { critRate: 3, attackSpeed: 0.05 } },
        { level: 5,  capsules: 10, materials: { food: 0, parts: 0, radPotion: 0, blueprint: 5, advancedEnergy: 10 }, gold: 10000, bonus: { attack: 30 } },
        { level: 6,  capsules: 15, materials: { food: 0, parts: 0, radPotion: 0, blueprint: 8, advancedEnergy: 15 }, gold: 20000, bonus: { critRate: 5, critDamage: 0.15 } },
        { level: 7,  capsules: 20, materials: { food: 0, parts: 0, radPotion: 0, blueprint: 12, advancedEnergy: 25 }, gold: 40000, bonus: { attack: 50, attackSpeed: 0.10 } },
        { level: 8,  capsules: 30, materials: { food: 0, parts: 0, radPotion: 0, blueprint: 20, advancedEnergy: 40 }, gold: 80000, bonus: { critRate: 8, critDamage: 0.25 } },
        { level: 9,  capsules: 50, materials: { food: 0, parts: 0, radPotion: 0, blueprint: 30, advancedEnergy: 60 }, gold: 150000, bonus: { attack: 100, critRate: 10 } },
        { level: 10, capsules: 80, materials: { food: 0, parts: 0, radPotion: 0, blueprint: 50, advancedEnergy: 100 }, gold: 300000, bonus: { attack: 200, critRate: 15, critDamage: 0.50, attackSpeed: 0.30 } },
    ],
    // 基因 10 满级总加成
    totalBonus: { attack: 410, critRate: 43, critDamage: 1.00, attackSpeed: 0.45 },
};

// 进化胶囊获取途径配置（用于 UI 提示）
export const EVOLUTION_CAPSULE_SOURCES = [
    { source: '商店购买',     rate: '60 金币/颗' },
    { source: '章节 Boss 战', rate: '每章节必掉 1 颗' },
    { source: '挂机产出',     rate: '30 分钟/颗' },
];

window.EVOLUTION_LAB_CONFIG = EVOLUTION_LAB_CONFIG;
window.EVOLUTION_CAPSULE_SOURCES = EVOLUTION_CAPSULE_SOURCES;

// ============================================================
// 十、发电站升级表（PRD v3 · 2026-08-04）
//   10 级，每级提升离线时间上限 + 离线产出倍率
// ============================================================
export const POWER_PLANT_CONFIG = {
    levels: [
        { level: 1,  scrap: 0,    advancedEnergy: 0,   gold: 0,       offlineCapHours: 8,  multiplier: 1.0 },
        { level: 2,  scrap: 100,  advancedEnergy: 50,  gold: 200,     offlineCapHours: 12, multiplier: 1.1 },
        { level: 3,  scrap: 200,  advancedEnergy: 100, gold: 500,     offlineCapHours: 16, multiplier: 1.2 },
        { level: 4,  scrap: 400,  advancedEnergy: 200, gold: 1000,    offlineCapHours: 20, multiplier: 1.3 },
        { level: 5,  scrap: 800,  advancedEnergy: 400, gold: 2500,    offlineCapHours: 24, multiplier: 1.4 },
        { level: 6,  scrap: 1500, advancedEnergy: 800, gold: 5000,    offlineCapHours: 28, multiplier: 1.5 },
        { level: 7,  scrap: 3000, advancedEnergy: 1500, gold: 10000,  offlineCapHours: 32, multiplier: 1.6 },
        { level: 8,  scrap: 6000, advancedEnergy: 3000, gold: 25000,  offlineCapHours: 36, multiplier: 1.7 },
        { level: 9,  scrap: 12000, advancedEnergy: 6000, gold: 50000, offlineCapHours: 42, multiplier: 1.8 },
        { level: 10, scrap: 25000, advancedEnergy: 12000, gold: 100000, offlineCapHours: 48, multiplier: 2.0 },
    ],
};

window.POWER_PLANT_CONFIG = POWER_PLANT_CONFIG;

// ============================================================
// 十一、训练场升级表（PRD v3 · 2026-08-04）
//   3 方向 × Lv.0~30（用户明确：不可取消）
//   每级消耗：对应手册 ×1 + 金币 200*1.4^(lv-1)
//   训练时长：30 + 5*(lv-1) 分钟
// ============================================================
export const TRAINING_GROUND_CONFIG = {
    maxLevel: 30,
    directions: [
        { id: 'power',      name: '力量', icon: 'dumbbell',  perLevel: { attack: 5 },     manualId: 'powerManual'      },
        { id: 'technique',  name: '技巧', icon: 'crosshair', perLevel: { critRate: 0.5 }, manualId: 'techniqueManual'  },
        { id: 'experience', name: '经验', icon: 'book-open', perLevel: { expMul: 0.02 },   manualId: 'experienceManual' },
    ],
    baseGoldCost: 200,
    goldCostMul: 1.4,
    baseDurationMin: 30,
    durationStepMin: 5,
    getDurationMin(level) {
        return this.baseDurationMin + (level - 1) * this.durationStepMin;
    },
    getGoldCost(level) {
        return Math.floor(this.baseGoldCost * Math.pow(this.goldCostMul, level - 1));
    },
};

window.TRAINING_GROUND_CONFIG = TRAINING_GROUND_CONFIG;

// ============================================================
// 十二、商店等级升级表（PRD v3 · 2026-08-04）
//   Lv.1~10，手动触发升级（玩家点按钮）
//   金币消耗递增 + 后期要零件/蓝图/高级能源
//   效果：紫/金装备概率 ×shopLevel.multiplier
// ============================================================
export const SHOP_LEVEL_CONFIG = {
    levels: [
        { level: 1,  gold: 0,       parts: 0,  blueprint: 0,   advancedEnergy: 0,   multiplier: 1.00 },
        { level: 2,  gold: 5000,    parts: 0,  blueprint: 0,   advancedEnergy: 0,   multiplier: 1.05 },
        { level: 3,  gold: 15000,   parts: 0,  blueprint: 0,   advancedEnergy: 0,   multiplier: 1.10 },
        { level: 4,  gold: 50000,   parts: 5,  blueprint: 0,   advancedEnergy: 0,   multiplier: 1.15 },
        { level: 5,  gold: 100000,  parts: 0,  blueprint: 3,   advancedEnergy: 0,   multiplier: 1.20 },
        { level: 6,  gold: 200000,  parts: 0,  blueprint: 5,   advancedEnergy: 10,  multiplier: 1.30 },
        { level: 7,  gold: 400000,  parts: 0,  blueprint: 10,  advancedEnergy: 25,  multiplier: 1.40 },
        { level: 8,  gold: 800000,  parts: 0,  blueprint: 20,  advancedEnergy: 50,  multiplier: 1.50 },
        { level: 9,  gold: 1500000, parts: 0,  blueprint: 50,  advancedEnergy: 100, multiplier: 1.65 },
        { level: 10, gold: 3000000, parts: 0,  blueprint: 100, advancedEnergy: 200, multiplier: 1.80 },
    ],
};

window.SHOP_LEVEL_CONFIG = SHOP_LEVEL_CONFIG;

// ============================================================
// 十三、旧系统兼容导出（被 buildings / collection / dungeons /
//   equipment / events / shelter / story 等残留模块引用，
//   提供空壳占位让模块能加载通过）
// ============================================================
export const BUILDINGS = {
    habitat:    { name: '居住区',   icon: 'home',     maxLevel: 999, desc: '提升幸存者人数，全局+2%全资源产出' },
    waterPlant: { name: '净水厂',   icon: 'droplet',  maxLevel: 999, desc: '提升净水产出' },
    farm:       { name: '末世农田', icon: 'wheat',    maxLevel: 999, desc: '提升食物产出' },
    workshop:   { name: '机械工坊', icon: 'wrench',   maxLevel: 999, desc: '提升废铁、零件产出' },
    medStation: { name: '医疗总站', icon: 'heart-pulse', maxLevel: 999, desc: '每级+1.5%全队最大生命' },
    radar:      { name: '雷达观测站', icon: 'radar',   maxLevel: 999, desc: '解锁新内容' },
};
export const BUILDING_UPGRADE_COST = (level) => ({
    food: 50 * Math.pow(1.5, level),
    water: 30 * Math.pow(1.5, level),
    scrap: 20 * Math.pow(1.4, level),
    parts: Math.floor(5 * Math.pow(1.4, level)),
});

export const EQUIPMENT_TEMPLATES = {
    weapon: [], armor: [], head: [], clothes: [], boots: [],
    cloak: [], ring: [], amulet: [], accessory: [],
};
export const MATERIALS = [
    { id: 'm1', name: '废铁' }, { id: 'm2', name: '零件' }, { id: 'm3', name: '能源' },
    { id: 'm4', name: '晶体' }, { id: 'm5', name: '核心' }, { id: 'm6', name: '神性' },
];
export const CHAPTER_STORIES = [
    { chapter: 1, title: '避难所的黎明',     text: '辐射云散去后，你从地窖里爬出来。外面的世界满目疮痍——锈蚀的汽车、倾倒的电线杆，以及远处传来的低吼声。避难所外，一只受伤的丧尸正朝你走来。你握紧手里的剑，踏出了第一步。' },
    { chapter: 2, title: '踏上锈蚀高速路', text: '你沿着高速路往前走。头顶是崩塌的高架桥，脚下是被腐蚀的柏油路面。每走一段，都能看见被遗弃的补给车。你打开一辆车的后备箱——里面还残留着罐头和水。' },
    { chapter: 3, title: '深入辐射森林',   text: '高速路的尽头是一片诡异的森林。树木叶子都泛着荧光，空气中弥漫着臭氧的味道。你看见了更大的变异体——它们的眼睛泛着蓝光，朝你扑来。' },
    { chapter: 4, title: '废弃都市的钟声', text: '穿过森林是废弃都市。曾经的摩天大楼只剩下钢筋骨架，钟楼传出沉闷的钟声——这是求救，还是警告？你握紧武器，深入这座死城。' },
    { chapter: 5, title: '地下研究所',     text: '都市的地基下是一座被遗忘的研究所。锈蚀的铁门半开，里面传出机械运转的嗡鸣。这里藏着末日真相的最后一片拼图——也可能是更强的怪物。' },
    { chapter: 6, title: '辐射沼泽',       text: '研究所的后门通向一片沼泽。污水没过膝盖，蓝绿色的藻类在水面上发光。变异鳄鱼潜伏在水下，准备扑向任何移动的目标。' },
    { chapter: 7, title: '机械坟场',       text: '沼泽的尽头是一片机械坟场。战争机器的残骸堆积如山，有些仍在缓慢地扭动——它们被某种程序驱动着，要摧毁任何活物。' },
    { chapter: 8, title: '冰封实验室',     text: '机械坟场的最深处是一座完好无损的实验室。墙壁洁白，灯光柔和，似乎独立于外面的世界运转。但里面传出的是——培养皿的破裂声。' },
    { chapter: 9, title: '感染者母巢',     text: '实验室下方直通感染者母巢。无数感染者在这里被孵化，它们的神经信号被一台巨型服务器控制着。要终结这一切——你必须摧毁那台机器。' },
    { chapter: 10, title: '新世界',        text: '母巢崩塌。你从废墟中爬出，看见远处的地平线露出第一缕阳光。也许这就是新世界的开始。' },
];
export const SHELTER_UPGRADE_COST = {
    1: { food: 50,  water: 30,  scrap: 20  },
    2: { food: 100, water: 60,  scrap: 40  },
    3: { food: 200, water: 120, scrap: 80  },
};

window.BUILDINGS = BUILDINGS;
window.BUILDING_UPGRADE_COST = BUILDING_UPGRADE_COST;
window.EQUIPMENT_TEMPLATES = EQUIPMENT_TEMPLATES;
window.MATERIALS = MATERIALS;
window.CHAPTER_STORIES = CHAPTER_STORIES;
window.SHELTER_UPGRADE_COST = SHELTER_UPGRADE_COST;

window.SET_EQUIP_TEMPLATES = SET_EQUIP_TEMPLATES;
window.CHALLENGE_CONFIG = CHALLENGE_CONFIG;
window.CHALLENGE_TIERS = CHALLENGE_TIERS;
window.IDLE_FORMULA = IDLE_FORMULA;
