// ============================================================
//  src/data/gameData.js
//  全局可变状态对象（loadData/saveData 持久化）
//  基于 PRD v2: 技能书 + 商店 + 挑战强敌 + 章节战斗
// ============================================================

export const GameData = {
    player: {
        // ===== 永久资源（已删除 2026-07-28：所有引用都是死代码） =====
        gold: 0,                    // 通用金币（商店/挑战/技能书强化共用）
        diamond: 0,                 // 兼容旧字段

        // ===== 单角色 =====
        characterLevel: 1,
        characterStars: 0,
        characterName: '幸存者',
        characterType: 'survivor',
        heroes: null,
        activeSquad: null,

        // ===== 战斗状态（2026-07-30 重构：去 HP 字段，角色不再受伤害）=====
        currentHp: 1,           // 兼容字段，不使用
        maxHp: 1,               // 兼容字段，不使用

        // ===== 章节进度 =====
        bossLevel: 0,                // 已通关章节数（0 = 第 0 章还没打）
        chapter: 1,                  // 2026-08-03：当前章节（achievements/chapter.js 用）
        stageLevel: 1,
        stageProgress: 0,
        stageCleared: 0,

        // ===== 庇护所 =====
        shelterLevel: 1,             // 2026-08-03：庇护所等级（shelter.js / getIdleIncome 用）

        // ===== 2026-08-04 PRD v3：3 独立建筑字段（shelter-v2 modal）=====
        evolutionLab: {
            level: 0,                // 基因层级 0~10（0=未激活）
            totalCapsules: 0,        // 累计消耗胶囊（统计用）
        },
        powerPlant: {
            level: 1,                // 发电站等级 1~10
            offlineCapSeconds: 8 * 3600,   // 离线时间上限（秒）默认 8h
            offlineMultiplier: 1.0,        // 离线产出倍率 1.0~2.0
        },
        trainingGround: {
            power: 0,                // 力量训练等级 0~30
            technique: 0,            // 技巧训练等级 0~30
            experience: 0,           // 经验训练等级 0~30
            activeDirection: null,   // 当前训练中方向（null=空闲）
            trainingStartTime: 0,    // 训练开始时间戳
            trainingEndTime: 0,      // 训练完成时间戳
        },
        materials: {
            advancedEnergy: 0,       // 高级能源（发电站/进化所升级用）
            evolutionCapsules: 0,    // 进化胶囊（进化所升级用）
            powerManual: 0,          // 力量训练手册
            techniqueManual: 0,      // 技巧训练手册
            experienceManual: 0,     // 经验训练手册
        },
        shopLevel: 1,                // 商店等级 1~10（Phase 3 实装）

        // ===== 技能书系统 =====
        skillBooks: {},              // { skillBook_atk_power_white: { level: 1, quality: 'white' } } - 合成后的整本
        skillShards: {},             // { white_atk_power: 3 } 碎片剩余数量（5 碎片 = 1 本）
        spentGoldOnBooks: 0,         // 累计技能书花费金币

        // ===== 商店系统 =====
        shop: {
            charges: 3,              // 默认 3 次刷新机会
            lastRefreshTick: 0,      // 上次回 1 刷新的时间戳
            shopItems: [],           // 当前商店 6 件商品
        },

        // ===== 挑战强敌系统 =====
        challenge: {
            remaining: 3,            // 今日剩余次数（胜利才扣）
            lastResetDate: null,     // 上次重置 YYYY-MM-DD
            totalKills: 0,
            lastResetTimestamp: 0,   // 备用毫秒时间戳
        },

        // ===== 离线挂机 =====
        lastOnlineTime: Date.now(),
        offlineEarnings: null,

        // ===== 通用统计 =====
        level: 1,
        currentExp: 0,
        expToNext: 100,
        radiation: 0,
        daysAlive: 1,
        storyRead: false,
        totalKills: 0,
        combo: 0,
        maxCombo: 0,

        // ===== 装备袋（挑战强敌 + 商店装备入库）=====
        bag: {
            equipment: [],           // 入库的装备列表（强敌 / 商店抽取 / 扫荡产出）
            material: [],            // 材料碎片等
        },

        // ===== 老存档兼容字段 =====
        equipment: {},
        achievements: [],
        checkIn: { lastCheckIn: null, streak: 0, totalDays: 0 },
        dailyTasks: { lastResetDate: null, tasks: [] },
        collection: {},

        // ===== 主线任务（v25：动态 6 阶段任务链，章节切换时重置）=====
        mainQuest: {
            chapter: 1,                  // 当前章节号
            stageIndex: 0,               // 当前阶段 0-5
            stages: [],                  // 6 阶段状态，由 main-quest.js initMainQuest 初始化
        },
    },

    baseStats: { attack: 10, attackSpeed: 1.0, critRate: 5, critDamage: 1.5 },  // 2026-07-30：去 defense/hp
};

// 桥接：把模块内 export 暴露到 window 全局
if (typeof window !== 'undefined') {
    window.GameData = GameData;
    window.initNewFields = initNewFields;
}

export { saveData, loadData } from '../core/storage.js';

/**
 * 新字段初始化（兼容旧存档迁移）
 */
export function initNewFields() {
    const p = GameData.player;

    // 资源（resources 字段已删除；保留 gold/diamond）
    if (p.gold === undefined) p.gold = 0;
    if (p.diamond === undefined) p.diamond = 0;

    // 角色
    if (!p.characterLevel) p.characterLevel = 1;
    if (!p.characterStars) p.characterStars = 0;
    if (!p.dayCount) p.dayCount = 1;   // v23：末日天数（每通关 1 章 +1，叙事横幅用）
    if (!p.characterName) p.characterName = '幸存者';
    p.heroes = null;
    p.activeSquad = null;

    // 章节进度
    if (p.bossLevel === undefined) p.bossLevel = 0;
    if (p.chapter === undefined) p.chapter = 1;
    if (p.stageLevel === undefined) p.stageLevel = 1;
    if (p.stageProgress === undefined) p.stageProgress = 0;
    if (p.lastStoryShownLevel === undefined) p.lastStoryShownLevel = -1;

    // 庇护所
    if (p.shelterLevel === undefined) p.shelterLevel = 1;

    // PRD v3：3 建筑字段默认值（兼容老存档）
    if (!p.evolutionLab) p.evolutionLab = { level: 0, totalCapsules: 0 };
    if (p.evolutionLab.level === undefined) p.evolutionLab.level = 0;
    if (p.evolutionLab.totalCapsules === undefined) p.evolutionLab.totalCapsules = 0;

    if (!p.powerPlant) p.powerPlant = { level: 1, offlineCapSeconds: 8 * 3600, offlineMultiplier: 1.0 };
    if (p.powerPlant.level === undefined) p.powerPlant.level = 1;
    if (p.powerPlant.offlineCapSeconds === undefined) p.powerPlant.offlineCapSeconds = 8 * 3600;
    if (p.powerPlant.offlineMultiplier === undefined) p.powerPlant.offlineMultiplier = 1.0;

    if (!p.trainingGround) p.trainingGround = {
        power: 0, technique: 0, experience: 0,
        activeDirection: null, trainingStartTime: 0, trainingEndTime: 0,
    };

    if (!p.materials) p.materials = {
        advancedEnergy: 0, evolutionCapsules: 0,
        powerManual: 0, techniqueManual: 0, experienceManual: 0,
    };

    if (p.shopLevel === undefined) p.shopLevel = 1;

    // 挂机累积时长（用于每 30 分钟 +1 进化胶囊）
    if (p.idleAccumMs === undefined) p.idleAccumMs = 0;

    // 挂机时间（当前轮次开始时间戳，上限 8 小时）
    if (p.idleStartTime === undefined) p.idleStartTime = Date.now();

    // 技能书 / 碎片
    if (!p.skillBooks) p.skillBooks = {};
    if (!p.skillShards) p.skillShards = {};

    // 商店
    if (!p.shop) p.shop = { charges: 3, lastRefreshTick: 0, shopItems: [] };
    if (p.shop.charges === undefined) p.shop.charges = 3;

    // 挑战
    if (!p.challenge) p.challenge = { remaining: 3, lastResetDate: null, totalKills: 0, lastResetTimestamp: 0 };
    if (p.challenge.remaining === undefined) p.challenge.remaining = 3;
    if (p.challenge.lastResetTimestamp === undefined) p.challenge.lastResetTimestamp = 0;

    // 装备袋（背包上限 + 扩充券）
    if (!p.bag) p.bag = { equipment: [], material: [] };
    if (!p.bag.equipment) p.bag.equipment = [];
    if (!p.bag.material) p.bag.material = [];
    if (p.bag.equipmentMax === undefined) p.bag.equipmentMax = 30;  // 默认 30 格
    if (p.bag.expandShards === undefined) p.bag.expandShards = 0;  // 商店扩充券数量（每张 +10 格）

    // 离线
    if (!p.lastOnlineTime) p.lastOnlineTime = Date.now();

    // 通用统计
    if (p.combo === undefined) p.combo = 0;
    if (p.maxCombo === undefined) p.maxCombo = 0;
    if (p.totalKills === undefined) p.totalKills = 0;
    if (p.currentExp === undefined) p.currentExp = 0;
    if (p.expToNext === undefined) p.expToNext = 100;

    // 每日挑战重置（基于 UTC+8 凌晨 4 点）
    maybeResetDailyChallenge();
}

/**
 * 每日挑战次数重置
 * 凌晨 4 点（UTC+8）作为重置点
 */
export function maybeResetDailyChallenge() {
    const p = GameData.player;
    const now = Date.now();
    const today = new Date();
    // 计算今天的重置时间戳（4:00 UTC+8）
    const resetHour = 4;
    const resetToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), resetHour, 0, 0, 0);
    let resetTs = resetToday.getTime();
    // 如果今天还没到 4 点，则按昨天 4 点
    if (now < resetTs) {
        resetTs -= 24 * 3600 * 1000;
    }
    if (!p.challenge.lastResetTimestamp || p.challenge.lastResetTimestamp < resetTs) {
        p.challenge.remaining = CHALLENGE_DAILY_FREE_DEFAULT();  // 占位：3 次
        p.challenge.lastResetTimestamp = resetTs;
        p.challenge.lastResetDate = new Date(resetTs).toISOString().slice(0, 10);
    }
}

// 函数级 lazy import，避免循环依赖
function CHALLENGE_DAILY_FREE_DEFAULT() {
    try {
        return window.CHALLENGE_CONFIG?.dailyFree || 3;
    } catch (_) {
        return 3;
    }
}
