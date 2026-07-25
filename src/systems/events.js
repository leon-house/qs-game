/**
 * 随机事件系统
 * 宝箱/商人/突袭等
 */
import { GameData, saveData } from '../data/gameData.js?v=equip-select-redesign-20260725m';
import { Renderer } from '../core/renderer.js?v=equip-select-redesign-20260725m';
import { MATERIALS } from '../data/config.js?v=equip-select-redesign-20260725m';
import { showToast, updateUI } from '../ui/ui.js?v=equip-select-redesign-20260725m';

const RANDOM_EVENTS = [
    { type: 'chest', name: '神秘宝箱', icon: '📦', weight: 30 },
    { type: 'merchant', name: '流浪商人', icon: '🧙', weight: 20 },
    { type: 'ambush', name: '变异体突袭', icon: '💀', weight: 25 },
    { type: 'heal', name: '生命源泉', icon: '💖', weight: 15 },
    { type: 'treasure', name: '隐藏宝藏', icon: '💎', weight: 10 }
];

let currentEvent = null;
let currentEventReward = null;

export function triggerRandomEvent() {
    // 30%概率触发随机事件
    if (Math.random() > 0.3) return;

    const totalWeight = RANDOM_EVENTS.reduce((sum, e) => sum + e.weight, 0);
    let random = Math.random() * totalWeight;

    for (const event of RANDOM_EVENTS) {
        random -= event.weight;
        if (random <= 0) {
            currentEvent = event;
            showEventModal(event);
            break;
        }
    }
}

function showEventModal(event) {
    const rewards = generateEventRewards(event.type);
    Renderer.setText('event-icon', event.icon);
    Renderer.setText('event-name', event.name);
    Renderer.setText('event-reward', rewards.text);
    currentEventReward = rewards;
    Renderer.showModal('event-modal');
}

export function closeEvent() {
    Renderer.hideModal('event-modal');
    currentEvent = null;
}

export function claimEventReward() {
    if (!currentEventReward) return;

    if (currentEventReward.gold) GameData.player.gold += currentEventReward.gold;
    if (currentEventReward.diamond) GameData.player.diamond += currentEventReward.diamond;
    if (currentEventReward.material) {
        const existing = GameData.player.bag.material.find(m => m.id === currentEventReward.material.id);
        if (existing) existing.count += currentEventReward.material.count;
        else GameData.player.bag.material.push(currentEventReward.material);
    }

    showToast(`获得: ${currentEventReward.text}`, 'success');
    saveData();
    updateUI();
    closeEvent();
}

function generateEventRewards(type) {
    switch (type) {
        case 'chest':
            const gold1 = Math.floor(100 + Math.random() * 200);
            return { gold: gold1, text: `${gold1}金币` };
        case 'merchant':
            const gold2 = Math.floor(50 + Math.random() * 100);
            return { gold: gold2, text: `${gold2}金币` };
        case 'ambush':
            const gold3 = Math.floor(80 + Math.random() * 150);
            return { gold: gold3, text: `${gold3}金币` };
        case 'heal':
            const heal = Math.floor(GameData.player.maxHp * 0.3);
            GameData.player.currentHp = Math.min(GameData.player.maxHp, GameData.player.currentHp + heal);
            return { text: `恢复${heal}生命`, heal: heal };
        case 'treasure':
            const diamond = Math.floor(1 + Math.random() * 5);
            const mat = MATERIALS[Math.floor(Math.random() * MATERIALS.length)];
            return { diamond, material: { ...mat, count: 2 }, text: `${diamond}💎 + ${mat.name}x2` };
        default:
            return { gold: 50, text: '50金币' };
    }
}

window.closeEvent = closeEvent;
window.claimEventReward = claimEventReward;
window.triggerRandomEvent = triggerRandomEvent;
