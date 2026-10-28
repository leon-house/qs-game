// ============================================================
//  src/core/storage.js
//  从 game.js B 区块拆出的持久化适配层
//  拆分原则：所有 localStorage 调用集中到此处，未来迁移小游戏只需替换 Storage 接口
//  链入方式：index.html 用 <script type="module" src="src/core/storage.js"></script>
//  依赖：gamedata.js 必须在 storage.js 之前加载（依赖 GameData）
// ============================================================

// 依赖通过 ES module live binding 注入；调用发生在 gameData 初始化完成后。
import { GameData, initNewFields } from '../data/gameData.js';

// 存储键常量（避免散落字符串）
const STORAGE_KEY = 'apocalypse_idle_game';

// ==================== 存储适配层 ====================
// 当前实现：浏览器 localStorage
// 小游戏迁移时：替换为 WxStorageAdapter / QQStorageAdapter 等

const LocalStorageAdapter = {
    get(key) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            console.error('Storage get failed:', e);
            return null;
        }
    },
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Storage set failed:', e);
            return false;
        }
    },
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.error('Storage remove failed:', e);
            return false;
        }
    }
};

// 当前激活的存储实现（小游戏迁移时改为 WxStorageAdapter）
let Storage = LocalStorageAdapter;

// 暴露适配器供外部切换
export function setStorageAdapter(adapter) {
    Storage = adapter;
}

// ==================== 业务接口（保持兼容） ====================

export let lastSaveTime = Date.now();

export function saveData() {
    try {
        Storage.set(STORAGE_KEY, GameData);
        lastSaveTime = Date.now();
    } catch (e) {
        console.error('Save failed:', e);
    }
}

export function loadData() {
    try {
        const saved = Storage.get(STORAGE_KEY);
        if (!saved) return;
        // 2026-08-14：M2 修复 — 旧存档可能缺少 materials/evolutionLab/powerPlant/
        //   trainingGround/shop/challenge/bag 等嵌套字段。如果只做顶层 Object.assign，
        //   旧存档的"不存在"会整体覆盖默认值，中间窗口期任何读 GameData.player.materials
        //   都会拿到 undefined。这里先 initNewFields() 准备好默认值，再对嵌套对象做深合并。
        try { initNewFields(); } catch (e) { console.warn('initNewFields:', e.message); }

        const data = saved;
        // 顶层用 Object.assign（同字段不删除 GameData 默认的额外键）
        Object.assign(GameData.player, data.player);
        // 嵌套对象深合并：仅当 GameData 有默认值时才合并，否则保留
        const mergeNested = (key) => {
            const def = GameData.player[key];
            const sv = data.player && data.player[key];
            if (!def || typeof def !== 'object' || !sv || typeof sv !== 'object') return;
            GameData.player[key] = { ...def, ...sv };
            // 数组字段（equipment / material）按 saved 覆盖（默认都是空数组）
            for (const arrKey of Object.keys(def)) {
                if (Array.isArray(def[arrKey])) GameData.player[key][arrKey] = sv[arrKey] ?? def[arrKey];
            }
        };
        mergeNested('materials');
        mergeNested('evolutionLab');
        mergeNested('powerPlant');
        mergeNested('trainingGround');
        mergeNested('shop');
        mergeNested('challenge');
        mergeNested('bag');
        // equipment 是 dict（对象），也深合并
        if (data.player.equipment && typeof data.player.equipment === 'object') {
            GameData.player.equipment = { ...(GameData.player.equipment || {}), ...data.player.equipment };
        }
        GameData.baseStats = data.baseStats || GameData.baseStats;
    } catch (e) {
        console.error('Load failed:', e);
    }
}

// 桥接：把模块内 export 暴露到 window 全局（保持向后兼容）
// 注意：用 typeof 检查 — Node ESM 中无 window 概念，不能直接访问
if (typeof window !== 'undefined') {
    window.Storage = Storage;
    window.STORAGE_KEY = STORAGE_KEY;
    window.saveData = saveData;
    window.loadData = loadData;
    window.lastSaveTime = lastSaveTime;
    window.setStorageAdapter = setStorageAdapter;
}
