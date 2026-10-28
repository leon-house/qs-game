/**
 * 主线任务系统（v25e：动态 6 阶段任务链 + 引导跳转）
 *
 * 设计：
 *  - 每章节固定 6 阶段任务，按顺序推进：杀怪→买东西→卖东西→收获→挑战→击败Boss
 *  - 每阶段 target=1，完成后自动 +100 金币并解锁下一阶段
 *  - 终极阶段（击败 Boss）完成后：章节++，任务链重置
 *  - HUD mission-card 实时显示当前阶段名 + 进度
 *  - 进度由各动作的 wrapper 通过 bumpMainQuest(type) 钩入
 *  - v25e: 卡片可点击跳转（gotoMainQuest），跳转到能完成当前任务的页面
 *
 * 与每日任务（tasks.js）的区别：
 *  - 每日任务是当天的小循环（买/卖/收获/签到/挑战）
 *  - 主线任务是章节推进的大循环（杀怪→买东西→...→击败Boss）
 *  - 两者独立计数，独立奖励
 */
import { GameData, saveData } from '../data/gameData.js';
import { showToast } from '../ui/ui.js';

/** 6 阶段任务配置（顺序固定，每阶段 target=1）
 *  - goto: 玩家点击 HUD mission-card 时跳转到能完成此任务的 window 函数名
 *  - 不设 goto（undefined）的阶段不响应跳转（已自动完成，无需引导）
 *  - v equip-refactor-20261008b：`sell_thing` 跳转从 openBag 改成 openEquipment
 *      旧 bag-modal 有右键菜单但升级按钮 ReferenceError，已不再维护 */
export const STAGES = [
    { type: 'kill_monster',   title: '击杀异变',     desc: '击杀 1 只异变生物',         reward: { gold: 100 } },                       // 自动发生
    { type: 'buy_thing',      title: '购买补给',     desc: '在商店购买 1 件物品',       reward: { gold: 100 }, goto: 'openShop' },
    { type: 'sell_thing',     title: '出售战利品',   desc: '在装备面板出售 1 件装备',   reward: { gold: 100 }, goto: 'openEquipment' },
    { type: 'collect_idle',   title: '收获挂机',     desc: '点击「📥 收获」提取奖励',   reward: { gold: 100 } },                       // reward-bar 有按钮，无需跳转
    { type: 'challenge_boss', title: '挑战强敌',     desc: '挑战 1 次章节 Boss',        reward: { gold: 100 }, goto: 'challengeCurrentBoss' },
    { type: 'defeat_boss',    title: '击败异变·典狱长', desc: '本章节终极目标：击败典狱长', reward: { gold: 500 }, goto: 'challengeCurrentBoss' }
];

/**
 * 初始化主线任务（启动时调用）
 *  - 如果 stages 为空（新存档），按 STAGES 配置初始化
 *  - 如果 chapter 与 STAGES 长度不匹配（比如玩家修改过存档），自动修复
 *  - 订阅 battle-v2.js 的 enemy-killed 事件，自动累计 kill_monster
 */
export function initMainQuest() {
    const q = GameData.player.mainQuest;
    if (!q.stages || q.stages.length !== STAGES.length) {
        q.stages = STAGES.map(() => ({ progress: 0, completed: false, claimed: false }));
    }
    if (q.stageIndex == null || q.stageIndex < 0 || q.stageIndex >= STAGES.length) {
        q.stageIndex = 0;
    }
    if (!q.chapter || q.chapter < 1) q.chapter = 1;
    // 订阅敌人死亡事件（非 boss 才算 kill_monster；boss 由 defeat_boss 阶段处理）
    if (!initMainQuest._subscribed) {
        window.addEventListener('enemy-killed', (e) => {
            if (!e.detail || !e.detail.isBoss) {
                bumpMainQuest('kill_monster');
            }
        });
        // 订阅 boss 击败事件（challenge.js 派发）→ 推进 defeat_boss 阶段
        window.addEventListener('boss-defeated', () => {
            bumpMainQuest('defeat_boss');
        });
        initMainQuest._subscribed = true;
    }
    saveData();
    renderMissionCard();
}

/**
 * 增加主线任务进度（各 wrapper 调用）
 *  - type 匹配当前阶段 → progress++
 *  - 达到 target → 自动标记 completed，发放奖励，进入下一阶段
 *  - 已完成（claimed）阶段不再接受 progress（防御性）
 *  - type 不匹配当前阶段：静默返回（每日任务、终极 boss 单独钩入）
 */
export function bumpMainQuest(type, amount = 1) {
    const q = GameData.player.mainQuest;
    if (!q || !q.stages || q.stages.length === 0) return;
    const stage = q.stages[q.stageIndex];
    const template = STAGES[q.stageIndex];
    if (!stage || !template) return;
    if (stage.claimed) return;

    if (template.type !== type) return;  // 不匹配当前阶段 → 静默

    stage.progress = Math.min(stage.progress + amount, 1);
    if (stage.progress >= 1 && !stage.completed) {
        stage.completed = true;
        // 自动发放奖励 + 推进下一阶段
        grantReward(template.reward);
        showToast(`✅ 主线任务「${template.title}」完成 +${template.reward.gold}金币`, 'success');
        advanceStage();
    }
    saveData();
    renderMissionCard();
}

/** 直接标记当前阶段完成（用于"击败 Boss"等不通过普通钩入的场景） */
export function completeCurrentStage() {
    const q = GameData.player.mainQuest;
    const stage = q.stages[q.stageIndex];
    const template = STAGES[q.stageIndex];
    if (!stage || stage.claimed) return;
    stage.progress = 1;
    if (!stage.completed) {
        stage.completed = true;
        grantReward(template.reward);
        showToast(`✅ 主线任务「${template.title}」完成 +${template.reward.gold}金币`, 'success');
        advanceStage();
    }
    saveData();
    renderMissionCard();
}

/** 推进到下一阶段；终极阶段完成后章节++，任务链重置 */
function advanceStage() {
    const q = GameData.player.mainQuest;
    q.stageIndex++;
    if (q.stageIndex >= STAGES.length) {
        // 章节完成 → 进入下一章，任务链重置
        q.chapter++;
        q.stageIndex = 0;
        q.stages = STAGES.map(() => ({ progress: 0, completed: false, claimed: true }));  // 全部 claimed 防止重复发放
        showToast(`🎉 章节 ${q.chapter - 1} 完成！进入第 ${q.chapter} 章`, 'success');
    } else {
        const next = STAGES[q.stageIndex];
        showToast(`📌 下一阶段：${next.title}（${next.desc}）`, 'info');
    }
}

function grantReward(reward) {
    if (reward.gold) GameData.player.gold += reward.gold;
}

/** 渲染 HUD mission-card */
export function renderMissionCard() {
    const q = GameData.player.mainQuest;
    if (!q || !q.stages || q.stages.length === 0) return;
    const stage = q.stages[q.stageIndex];
    const template = STAGES[q.stageIndex];
    if (!stage || !template) return;

    const titleEl = document.querySelector('.mission-title');
    const progressEl = document.querySelector('.mission-progress');
    if (titleEl) titleEl.textContent = template.title;
    if (progressEl) progressEl.textContent = `${stage.progress}/1`;
}

/**
 * v25e：HUD mission-card 点击跳转
 *  - 读取当前阶段模板的 `goto` 字段
 *  - 没设 goto 的阶段（已自动完成）→ toast 提示玩家
 *  - 有 goto → 调用 window[goto]() 跳转（带 bumpMainQuest 包装会自动触发进度）
 */
export function gotoMainQuest() {
    const q = GameData.player.mainQuest;
    const stage = q.stages[q.stageIndex];
    const template = STAGES[q.stageIndex];
    if (!stage || !template) return;
    // 已完成阶段（防御性）→ 不响应跳转
    if (stage.claimed || stage.completed) {
        showToast('当前阶段已完成', 'info');
        return;
    }
    const fn = typeof window !== 'undefined' ? window[template.goto] : null;
    if (typeof fn !== 'function') {
        // 没设 goto（kill_monster / collect_idle）→ 自动发生，无需引导
        if (!template.goto) {
            showToast(`${template.title}：战斗中自动完成，无需跳转`, 'info');
            return;
        }
        showToast('目标页面未就绪', 'error');
        return;
    }
    try { fn(); } catch (e) { console.warn('[gotoMainQuest]', e); }
    showToast(`→ ${template.title}`, 'info');
}

/** 调试：强制重置（开发用） */
export function resetMainQuest() {
    const q = GameData.player.mainQuest;
    q.chapter = 1;
    q.stageIndex = 0;
    q.stages = STAGES.map(() => ({ progress: 0, completed: false, claimed: false }));
    saveData();
    renderMissionCard();
}