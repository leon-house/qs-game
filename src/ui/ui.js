/**
 * UI更新层
 * 所有界面刷新函数集中管理
 */
import { GameData, saveData } from '../data/gameData.js?v=equip-select-redesign-20260725m';
import { calculateStats, calculatePower, updateEquipmentBar } from '../systems/equipment.js?v=equip-select-redesign-20260725m';
import { initStageEnemy, updateArenaHp } from '../systems/stage.js?v=equip-select-redesign-20260725m';
import { Renderer } from '../core/renderer.js?v=equip-select-redesign-20260725m';

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
    Renderer.setText('diamond-display', formatNumber(GameData.player.diamond));
    Renderer.setText('player-level', GameData.player.level);
    Renderer.setText('boss-level', GameData.player.stageLevel || 1);
    Renderer.setText('power-display', formatNumber(power));

    // 关卡进度
    const stageInfo = Renderer.$('stage-progress');
    if (stageInfo) stageInfo.textContent = ((GameData.player.stageProgress || 0) + 1) + '/50';

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

    // 血条
    updateArenaHp();
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
