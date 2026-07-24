/**
 * 主入口 - 游戏初始化（接管 HTML 入口）
 */
import { GameData, loadData, saveData, initNewFields } from './data/gameData.js';
import { calculateStats, calculatePower } from './systems/equipment.js';
import { initStageEnemy } from './systems/stage.js';
import { manualAttack, toggleAutoBattle, healInBattle } from './systems/battle.js';
import { updateUI, showToast } from './ui/ui.js';
import { Renderer } from './core/renderer.js';
import { Timers } from './core/events.js';

import {
    openStatsModal, closeStatsModal,
    openBag, closeBag, switchBagTab,
    showItemMenu, closeItemMenu,
    openEquipSelect, closeEquipSelect, equipFromSelect, unequipItem
} from './ui/modals.js';

import { openShop, closeShop, refreshShop, buyItem } from './systems/shop.js';
import { openShelter, closeShelter, upgradeShelter } from './systems/shelter.js';
import { openCollection, closeCollection, switchCollectionTab } from './systems/collection.js';
import { resetBattle } from './systems/stage.js';
import { openCrystal } from './systems/crystal.js';
import { openCheckIn, closeCheckIn, doCheckIn } from './systems/checkin.js';
import { openTasks, closeTasks, claimTask } from './systems/tasks.js';
import { openAchievements, closeAchievements, checkAchievements } from './systems/achievements.js';
import { openChapter, closeChapter } from './systems/chapter.js';
import { openDungeons, closeDungeons, startDungeonAutoBattle, performDungeonAttack, closeDungeonBattle } from './systems/dungeons.js';
import { closeEvent, claimEventReward, triggerRandomEvent } from './systems/events.js';
import { closeStory, showCurrentChapterStory, showStory } from './systems/story.js';
import { confirmCharacter, selectCharacter, renderCharacterSelection } from './systems/character.js';
import { resetDailyTasks } from './systems/tasks.js';

/**
 * 初始化游戏
 */
function init() {
    try {
        loadData();
        initNewFields();
        updateUI();

        // 启动挂机系统（统一走 Timers 管理）
        initIdleSystem();

        // 初始化战场
        initStageEnemy();

        // 战斗相关：每日任务重置 / 成就检查
        resetDailyTasks();
        checkAchievements();

        // 战力显示
        const powerEl = Renderer.$('power-display');
        if (powerEl) Renderer.setText('power-display', formatNumber(calculatePower()));

        // 玩家未选角色：进入角色选择流程
        if (!GameData.player.characterType) {
            renderCharacterSelection();
            Renderer.showModal('character-modal');
        } else if (!GameData.player.storyRead) {
            showStory(0);
            GameData.player.storyRead = true;
            saveData();
        }

        console.log('[Game] 初始化成功');
    } catch (e) {
        console.error('[Game] 初始化失败:', e);
        const toast = Renderer.create('div', {
            style: 'position:fixed;top:0;left:0;right:0;background:red;color:white;padding:16px;z-index:9999;font-size:12px;',
            text: '初始化错误: ' + e.message
        });
        document.body.appendChild(toast);
    }
}

/**
 * 挂机系统（统一通过 Timers 管理，便于小游戏迁移）
 */
function initIdleSystem() {
    let lastTick = Date.now();
    Timers.set(() => {
        const now = Date.now();
        const delta = (now - lastTick) / 1000;
        lastTick = now;

        const income = getIdleIncome();

        // 离线收益
        if (delta > 10) {
            const offlineGold = Math.floor(income * delta);
            if (offlineGold > 0) {
                GameData.player.gold += offlineGold;
                showToast(`离线收益: +${offlineGold} 金币`, 'gold');
            }
        }

        // 常规挂机累积
        GameData.player.gold += income;
        saveData();
        updateUI();
    }, 5000);
}

function getIdleIncome() {
    return 1 + Math.floor((GameData.player.shelterLevel || 1) * 0.5);
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return Math.floor(num).toString();
}

// ========================================================================
// 暴露 window 全局（兼容 HTML onclick 调用）
// ========================================================================

// 战斗
window.manualAttack = manualAttack;
window.toggleAutoBattle = toggleAutoBattle;
window.healInBattle = healInBattle;
window.openBattle = () => { resetBattle(); };

// 弹窗
window.openStatsModal = openStatsModal;
window.closeStatsModal = closeStatsModal;
window.openBag = openBag;
window.closeBag = closeBag;
window.switchBagTab = switchBagTab;
window.showItemMenu = showItemMenu;
window.closeItemMenu = closeItemMenu;
window.openEquipSelect = openEquipSelect;
window.closeEquipSelect = closeEquipSelect;
window.equipFromSelect = equipFromSelect;
window.unequipItem = unequipItem;
window.showStory = showStory;
window.closeStory = closeStory;
window.showCurrentChapterStory = showCurrentChapterStory;

// 商店
window.openShop = openShop;
window.closeShop = closeShop;
window.refreshShop = refreshShop;
window.buyItem = buyItem;

// 庇护所
window.openShelter = openShelter;
window.closeShelter = closeShelter;
window.upgradeShelter = upgradeShelter;

// 图鉴
window.openCollection = openCollection;
window.closeCollection = closeCollection;
window.switchCollectionTab = switchCollectionTab;

// 水晶 / 签到 / 任务 / 成就 / 章节 / 副本 / 角色
window.openCrystal = openCrystal;
window.openCheckIn = openCheckIn;
window.closeCheckIn = closeCheckIn;
window.doCheckIn = doCheckIn;
window.openTasks = openTasks;
window.closeTasks = closeTasks;
window.claimTask = claimTask;
window.openAchievements = openAchievements;
window.closeAchievements = closeAchievements;
window.checkAchievements = checkAchievements;
window.openChapter = openChapter;
window.closeChapter = closeChapter;
window.openDungeons = openDungeons;
window.closeDungeons = closeDungeons;
window.startDungeonAutoBattle = startDungeonAutoBattle;
window.performDungeonAttack = performDungeonAttack;
window.closeDungeonBattle = closeDungeonBattle;

// 事件 / 剧情 / 角色选择
window.closeEvent = closeEvent;
window.claimEventReward = claimEventReward;
window.triggerRandomEvent = triggerRandomEvent;
window.confirmCharacter = confirmCharacter;
window.selectCharacter = selectCharacter;
window.renderCharacterSelection = renderCharacterSelection;

// 启动
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
