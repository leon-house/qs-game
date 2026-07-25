/**
 * 每日任务系统
 */
import { GameData, saveData } from '../data/gameData.js?v=quick-actions-20260725k';
import { Renderer } from '../core/renderer.js?v=quick-actions-20260725k';
import { showToast, updateUI } from '../ui/ui.js?v=quick-actions-20260725k';

const DAILY_TASKS = [
    { id: 'kill_boss', name: '击败Boss', desc: '击败1个Boss', target: 1, reward: { gold: 200, diamond: 2 } },
    { id: 'buy_equip', name: '购买装备', desc: '在商店购买1件装备', target: 1, reward: { gold: 100, diamond: 1 } },
    { id: 'upgrade_equip', name: '强化装备', desc: '强化1件装备', target: 1, reward: { gold: 150, diamond: 2 } },
    { id: 'idle_earn', name: '挂机收益', desc: '通过挂机获得500金币', target: 500, reward: { gold: 50, diamond: 1 } },
    { id: 'challenge_boss', name: '挑战Boss', desc: '挑战Boss 3次', target: 3, reward: { gold: 300, diamond: 3 } }
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

function renderTasks() {
    const tasks = GameData.player.dailyTasks.tasks || [];
    const html = tasks.map((t, i) => {
        const template = DAILY_TASKS.find(dt => dt.id === t.id);
        if (!template) return '';
        const isCompleted = t.progress >= template.target;
        const isClaimed = t.claimed;

        return `<div class="task-item">
            <div class="task-icon">📋</div>
            <div class="task-info">
                <div class="task-name">${template.name}</div>
                <div class="task-desc">${template.desc}</div>
                <div class="task-progress">${t.progress} / ${template.target}</div>
            </div>
            <button class="task-reward" ${!isCompleted || isClaimed ? 'disabled style="opacity:0.5"' : ''} onclick="claimTask('${t.id}')">
                ${isClaimed ? '已领取' : '领取'}
            </button>
        </div>`;
    }).join('');

    Renderer.setHTML('tasks-list', html);
}

export function claimTask(taskId) {
    const tasks = GameData.player.dailyTasks.tasks;
    const task = tasks.find(t => t.id === taskId);
    const template = DAILY_TASKS.find(t => t.id === taskId);

    if (!task || task.claimed || task.progress < template.target) return;

    task.claimed = true;
    GameData.player.gold += template.reward.gold;
    GameData.player.diamond += template.reward.diamond;

    saveData();
    renderTasks();
    updateUI();
    showToast(`领取成功！${template.reward.gold}金币 ${template.reward.diamond}钻石`, 'success');
}

window.openTasks = openTasks;
window.closeTasks = closeTasks;
window.claimTask = claimTask;
