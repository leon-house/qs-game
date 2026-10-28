/**
 * UI更新层
 * 所有界面刷新函数集中管理
 */
import { GameData, saveData } from '../data/gameData.js';
import { calculateStats, calculatePower, updateEquipmentBar } from '../systems/equipment.js';
import { Renderer } from '../core/renderer.js';

/**
 * 格式化数字
 */
export function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return Math.floor(num).toString();
}

/**
 * 主UI更新
 */
export function updateUI() {
    const stats = calculateStats();
    const power = calculatePower();

    Renderer.setText('gold-display', formatNumber(GameData.player.gold));
    Renderer.setText('gold-count', formatNumber(GameData.player.gold || 0));
    Renderer.setText('diamond-display', formatNumber(GameData.player.diamond));
    Renderer.setText('player-level', GameData.player.characterLevel || GameData.player.level || 1);
    Renderer.setText('boss-level', GameData.player.stageLevel || 1);
    Renderer.setText('power-display', formatNumber(power));

    // 参考图风格顶部 HUD 同步（不改变原有玩家卡字段）
    Renderer.setText('hud-level', GameData.player.characterLevel || GameData.player.level || 1);
    Renderer.setText('hud-name', GameData.player.characterName || '幸存者');
    Renderer.setText('hud-power', formatNumber(power));
    Renderer.setText('hud-gold', formatNumber(GameData.player.gold || 0));
    Renderer.setText('hud-diamond', formatNumber(GameData.player.diamond || 0));
    Renderer.setText('hud-chapter', GameData.player.stageLevel || 1);
    Renderer.setText('hud-day', GameData.player.dayCount || 1);
    Renderer.setText('hud-xp-fill', '');
    const hudXpFill = Renderer.$('hud-xp-fill');
    if (hudXpFill) hudXpFill.style.width = `${Math.min(100, (GameData.player.currentExp / Math.max(1, GameData.player.expToNext)) * 100)}%`;

    // 关卡进度
    const stageInfo = Renderer.$('stage-progress');
    if (stageInfo) stageInfo.textContent = ((GameData.player.stageProgress || 0) + 1) + '/50';

    // v23：章节信息卡进度（基于 stageProgress 0~49 / 50 关）
    const stagePct = Math.min(100, ((GameData.player.stageProgress || 0) + 1) / 50 * 100);
    const pctText = stagePct.toFixed(1) + '%';
    Renderer.setText('hud-chapter-pct', pctText);
    const fillEl = Renderer.$('hud-chapter-fill');
    if (fillEl) fillEl.style.width = stagePct.toFixed(1) + '%';

    // 侧栏按钮红点：点击即标记为已读（localStorage 持久化），下次进入不显示
    const today = new Date().toDateString();
    const checkedToday = GameData.player.checkIn?.lastCheckIn === today;
    const sideBtnSelectors = [
        { sel: '[onclick*="openCheckIn()"]', checked: checkedToday },
        { sel: '[onclick*="openChallenge()"]', checked: isSideRead('challenge') },
        { sel: '[onclick*="openTasks()"]', checked: isSideRead('tasks') },
        { sel: '[onclick*="openAchievements()"]', checked: isSideRead('achievements') },
    ];
    for (const { sel, checked } of sideBtnSelectors) {
        const btn = document.querySelector(sel);
        if (btn) btn.classList.toggle('is-checked', !!checked);
    }

    // 成就按钮：未完成置灰，完成至少一个后变亮可交互
    const achBtn = document.getElementById('side-btn-achievements');
    if (achBtn) {
        const completedCount = (GameData.player.achievements || []).length;
        const hasUnlocked = completedCount > 0;
        achBtn.classList.toggle('is-locked', !hasUnlocked);
        achBtn.classList.toggle('is-unlocked', hasUnlocked);
        achBtn.title = hasUnlocked
            ? `成就（已解锁 ${completedCount} 项）`
            : '成就（暂未解锁，完成任意成就后亮起）';
    }

    // 玩家名称
    if (GameData.player.characterName) {
        Renderer.setText('player-name', GameData.player.characterName);
    }

    // 经验条
    const expPercent = Math.min(100, (GameData.player.currentExp / GameData.player.expToNext) * 100);
    Renderer.setStyle('exp-bar', 'width', expPercent + '%');
    Renderer.setText('current-exp', Math.floor(GameData.player.currentExp));
    Renderer.setText('exp-needed', GameData.player.expToNext);

    // 装备栏
    updateEquipmentBar();

    // 2026-08-03：血条由 battle-v2.js startContinuousBattle 内部维护，移除 stage.js 调用
}

/**
 * 侧栏按钮"已读"标记：localStorage 持久化
 * key: sideRead_<key>
 */
function isSideRead(key) {
    try { return localStorage.getItem('sideRead_' + key) === '1'; } catch { return false; }
}

function markSideRead(key) {
    try { localStorage.setItem('sideRead_' + key, '1'); } catch {}
}

/**
 * Toast通知队列
 */
let toastQueue = [];
let toastShowing = false;

export function showToast(message, type) {
    toastQueue.push({ message, type: type || 'info' });
    if (!toastShowing) showNextToast();
}

function showNextToast() {
    if (toastQueue.length === 0) {
        toastShowing = false;
        return;
    }
    toastShowing = true;
    const { message, type } = toastQueue.shift();
    const container = Renderer.$('toast-container');
    if (!container) {
        toastShowing = false;
        return;
    }
    const toast = Renderer.create('div', {
        className: 'toast ' + type,
        text: message
    });
    container.appendChild(toast);
    setTimeout(() => {
        toast.remove();
        showNextToast();
    }, 2000);
}

// 暴露到 window：让 battle-v2 等模块在运行时能调用 UI 更新
if (typeof window !== 'undefined') {
    window.updateUI = updateUI;
    window.showToast = showToast;
    window.formatNumber = formatNumber;
    window.markSideRead = markSideRead;
}
