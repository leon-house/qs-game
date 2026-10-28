/**
 * 每日任务系统（v1.3 — 2026-08-13）
 *  - v1.2 (2026-08-04): 5 项活动 + 仅金币奖励
 *  - v1.3 (2026-08-13): 新增 guide 类型任务，引导玩家点击「去完成」跳转
 *    - type='guide' 的任务渲染为「去完成」按钮（不是领取）
 *    - 点击后关闭任务 modal，调用 task.goto 函数（window[t.goto]）跳转
 *    - 跳转目标函数自身负责 bumpTaskProgress（推荐：main.js 包装 openEquipment 等）
 *    - 任务奖励改为弹窗发放（不是 toast），点确认关闭
 */
import { GameData, saveData } from '../data/gameData.js';
import { Renderer } from '../core/renderer.js';
import { showToast, updateUI } from '../ui/ui.js';

export const DAILY_TASKS = [
    { id: 'buy_thing',      name: '购买东西',   desc: '在商店购买任意商品 1 次',     target: 1, reward: { gold: 100 } },
    { id: 'sell_thing',     name: '出售东西',   desc: '出售背包内任意装备 1 次',     target: 1, reward: { gold: 80  } },
    { id: 'challenge_boss', name: '挑战Boss',   desc: '挑战强敌 1 次（可失败）',     target: 1, reward: { gold: 200 } },
    { id: 'collect_idle',   name: '收获挂机',   desc: '点击「📥 收获」提取挂机奖励', target: 1, reward: { gold: 60  } },
    { id: 'daily_checkin',  name: '每日签到',   desc: '完成今日签到',                 target: 1, reward: { gold: 50  } },
    // v1.3 新增：指引类任务。点击「去完成」跳转指定页面，完成后弹窗给奖励
    { id: 'guide_equipment', type: 'guide', name: '查看装备', desc: '点击「去完成」打开装备面板，了解你的装备', target: 1, reward: { gold: 50 }, goto: 'openEquipment', gotoIcon: '🛡️' }
];

export function openTasks() {
    resetDailyTasks();
    renderTasks();
    Renderer.showModal('tasks-modal');
}

export function closeTasks() {
    Renderer.hideModal('tasks-modal');
}

export function resetDailyTasks() {
    const today = new Date().toDateString();
    if (GameData.player.dailyTasks.lastResetDate !== today) {
        GameData.player.dailyTasks.lastResetDate = today;
        GameData.player.dailyTasks.tasks = DAILY_TASKS.map(t => ({
            id: t.id,
            progress: 0,
            completed: false,
            claimed: false
        }));
        saveData();
    }
}

/**
 * 增加每日任务进度（暴露给 main.js 各动作 wrapper 调用）
 *  - 找不到任务：静默返回（方便未来加新动作暂不报错）
 *  - 达到 target：自动标记 completed=true，触发 saveData
 *  - 任务 modal 已打开：自动重渲染列表（让红点/进度实时刷新）
 *  - 同一天内同一任务可累加，达成即饱和
 */
export function bumpTaskProgress(taskId, amount = 1) {
    const task = GameData.player.dailyTasks.tasks?.find(t => t.id === taskId);
    if (!task || task.claimed) return;
    const template = DAILY_TASKS.find(t => t.id === taskId);
    if (!template) return;

    task.progress = Math.min(task.progress + amount, template.target);
    if (task.progress >= template.target && !task.completed) {
        task.completed = true;
    }
    saveData();

    // 若任务弹窗已开，刷新列表（让玩家看到进度变化）
    const modal = document.getElementById('tasks-modal');
    const isOpen = modal && (modal.classList.contains('active') || modal.classList.contains('show'));
    if (isOpen) {
        renderTasks();
    }
}

function renderTasks() {
    const tasks = GameData.player.dailyTasks.tasks || [];
    const html = tasks.map((t, i) => {
        const template = DAILY_TASKS.find(dt => dt.id === t.id);
        if (!template) return '';
        const isCompleted = t.progress >= template.target;
        const isClaimed = t.claimed;

        // v1.3：根据任务类型渲染不同按钮
        // - guide 类型未完成 → 「去完成」按钮（绿色，跳转）
        // - guide 类型已完成未领取 → 「领取」按钮（金色，弹窗给奖励）
        // - 普通任务 → 进度条 + 「领取」按钮
        const isGuide = template.type === 'guide';
        let actionBtn;
        if (isGuide && !isCompleted && !isClaimed) {
            actionBtn = `<button class="task-goto" onclick="window.gotoTask('${t.id}')"><span>去完成</span><span class="task-goto-arrow">→</span></button>`;
        } else {
            const disabledAttr = !isCompleted || isClaimed ? 'disabled style="opacity:0.5"' : '';
            actionBtn = `<button class="task-reward" ${disabledAttr} onclick="claimTask('${t.id}')">${isClaimed ? '已领取' : '领取'}</button>`;
        }

        const icon = isGuide ? (template.gotoIcon || '🧭') : '📋';

        return `<div class="task-item ${isGuide ? 'is-guide' : ''} ${isCompleted && !isClaimed ? 'completed' : ''} ${isClaimed ? 'claimed' : ''}">
            <div class="task-icon">${icon}</div>
            <div class="task-info">
                <div class="task-name">${template.name}${isGuide ? ' <span class="task-tag-guide">指引</span>' : ''}</div>
                <div class="task-desc">${template.desc}</div>
                <div class="task-progress">${t.progress} / ${template.target}</div>
            </div>
            ${actionBtn}
        </div>`;
    }).join('');

    Renderer.setHTML('tasks-list', html);
}

/**
 * v1.3：指引任务"去完成"——关闭任务 modal 并跳转到目标页
 */
export function gotoTask(taskId) {
    const template = DAILY_TASKS.find(t => t.id === taskId);
    if (!template || template.type !== 'guide') return;
    // 先关闭任务 modal（避免层叠）
    closeTasks();
    // 调用跳转函数（约定 window[task.goto] 暴露）
    const fn = typeof window !== 'undefined' ? window[template.goto] : null;
    if (typeof fn === 'function') {
        try { fn(); } catch (e) { console.warn('[gotoTask]', e); }
        showToast(`→ ${template.gotoName || template.name}`, 'info');
    } else {
        showToast('目标页面未就绪', 'error');
    }
}

export function claimTask(taskId) {
    const tasks = GameData.player.dailyTasks.tasks;
    const task = tasks.find(t => t.id === taskId);
    const template = DAILY_TASKS.find(t => t.id === taskId);

    if (!task || task.claimed || task.progress < template.target) return;

    task.claimed = true;
    GameData.player.gold += template.reward.gold;

    saveData();
    renderTasks();
    updateUI();
    // v1.3：奖励用弹窗发放（替代之前的 toast），点击确认关闭
    showTaskRewardModal(template);
}

/**
 * v1.3：显示任务奖励弹窗
 *  - 大图标 + 数量 + 任务名
 *  - 「确认」按钮关闭
 */
function showTaskRewardModal(template) {
    const modal = document.getElementById('task-reward-modal');
    if (!modal) {
        // 兜底：弹窗 DOM 不存在则降级为 toast
        showToast(`领取成功！+${template.reward.gold} 金币`, 'success');
        return;
    }
    const iconEl = modal.querySelector('.task-reward-icon');
    const amountEl = modal.querySelector('.task-reward-amount');
    const nameEl = modal.querySelector('.task-reward-name');
    if (iconEl) iconEl.textContent = '💰';
    if (amountEl) amountEl.textContent = `+${template.reward.gold} 金币`;
    if (nameEl) nameEl.textContent = template.name;
    Renderer.showModal('task-reward-modal');
}

export function closeTaskReward() {
    Renderer.hideModal('task-reward-modal');
}

window.openTasks = openTasks;
window.closeTasks = closeTasks;
window.claimTask = claimTask;
window.gotoTask = gotoTask;
window.closeTaskReward = closeTaskReward;
