// ============================================================
//  src/core/storage.js
//  从 game.js B 区块拆出的持久化适配层
//  拆分原则：所有 localStorage 调用集中到此处，未来迁移小游戏只需替换 Storage 接口
//  链入方式：index.html 用 <script type="module" src="src/core/storage.js"></script>
//  依赖：gamedata.js 必须在 storage.js 之前加载（依赖 GameData）
// ============================================================

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
        if (saved) {
            const data = saved;
            Object.assign(GameData.player, data.player);
            GameData.baseStats = data.baseStats || GameData.baseStats;
        }
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
