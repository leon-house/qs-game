// ============================================================
//  src/data/gamedata.js
//  从 game.js 拆出的全局可变状态对象（loadData/saveData 持久化）
//  拆分原则：A2 区块 GameData 全部内容，不依赖 A1 配置
//  链入方式：index.html 用 <script type="module" src="src/data/gamedata.js"></script>
//           （必须在 config.js 之后，game.js 之前）
// ============================================================

        // ---------- A2. 数据模型 (全局状态对象，loadData/saveData 序列化) ----------
        //   拆分时应与 A1 解耦：A1 是静态配置，A2 是可变状态
        export const GameData = {
            player: {
                gold: 100,
                diamond: 10,
                crystals: 0, // 水晶
                level: 1,
                currentExp: 0,
                expToNext: 100,
                refreshCount: 5,
                maxRefreshCount: 10,
                shelterLevel: 1,
                currentBossLevel: 1,
                currentHp: 100,
                maxHp: 100,
                chapter: 1,
                // 关卡系统
                stageLevel: 1,       // 当前所在关卡
                stageProgress: 0,    // 当前关卡进度（0-49，第50个是boss）
                stageCleared: 0,     // 已通关关卡数
                characterType: null, // 幸存者类型
                characterName: '幸存者',
                radiation: 0, // 辐射值
                daysAlive: 1, // 存活天数
                storyRead: false,
                equipment: { weapon: null, armor: null, accessory: null, head: null, cloak: null, ring: null, amulet: null, boots: null, clothes: null },
                bag: { weapon: [], armor: [], accessory: [], head: [], cloak: [], ring: [], amulet: [], boots: [], clothes: [], material: [], gems: [] },
                // 留存系统数据
                checkIn: { lastCheckIn: null, streak: 0, totalDays: 0 },
                dailyTasks: { lastResetDate: null, tasks: [] },
                achievements: [],
                collection: { equipment: [], materials: [], gems: [], bosses: [] }
            },
            baseStats: { attack: 10, defense: 5, hp: 100, critRate: 5 },
            currentBoss: null,
            currentEnemy: null  // 当前普通怪物
        };
// 桥接：把模块内 export 暴露到 window 全局
if (typeof window !== 'undefined') {
    window.GameData = GameData;
    window.initNewFields = initNewFields;
}

/**
 * 新字段初始化（兼容旧存档）
 */
export { saveData, loadData } from '../core/storage.js';

export function initNewFields() {
    const p = GameData.player;
    if (!p.stageLevel) p.stageLevel = 1;
    if (p.stageProgress === undefined) p.stageProgress = 0;
    if (!p.stageCleared) p.stageCleared = 0;
    if (!p.combo) p.combo = 0;
    if (!p.maxCombo) p.maxCombo = 0;
    if (!p.totalKills) p.totalKills = 0;
    if (GameData.currentBoss === undefined) GameData.currentBoss = null;
    if (GameData.currentEnemy === undefined) GameData.currentEnemy = null;
}
