/**
 * 成就系统
 */
import { GameData, saveData } from '../data/gameData.js?v=quick-actions-20260725k';
import { Renderer } from '../core/renderer.js?v=quick-actions-20260725k';
import { showToast } from '../ui/ui.js?v=quick-actions-20260725k';

const ACHIEVEMENTS = [
    { id: 'first_boss', name: '初战告捷', desc: '击败第一个Boss', icon: '🎯', reward: { gold: 100 } },
    { id: 'boss_10', name: 'Boss杀手', desc: '累计击败10个Boss', icon: '💀', reward: { gold: 500, diamond: 5 } },
    { id: 'boss_50', name: 'Boss克星', desc: '累计击败50个Boss', icon: '☠️', reward: { gold: 2000, diamond: 20 } },
    { id: 'chapter_5', name: '章节达人', desc: '通关第5章', icon: '📖', reward: { gold: 3000, diamond: 30 } },
    { id: 'chapter_10', name: '末世英雄', desc: '通关第10章', icon: '🏅', reward: { gold: 10000, diamond: 100 } },
    { id: 'equip_100', name: '装备收藏家', desc: '收集100件装备', icon: '⚔️', reward: { gold: 2000, diamond: 15 } },
    { id: 'rich', name: '腰缠万贯', desc: '拥有10000金币', icon: '💰', reward: { diamond: 10 } },
    { id: 'level_50', name: '资深幸存者', desc: '达到50级', icon: '⭐', reward: { gold: 5000, diamond: 50 } }
];

function countTotalEquipment() {
    const bag = GameData.player.bag;
    let total = 0;
    Object.values(bag).forEach(arr => {
        if (Array.isArray(arr)) total += arr.length;
    });
    return total;
}

export function openAchievements() {
    renderAchievements();
    Renderer.showModal('achievements-modal');
}

export function closeAchievements() {
    Renderer.hideModal('achievements-modal');
}

export function checkAchievements() {
    const achievements = GameData.player.achievements || [];
    const totalBossKills = GameData.player.currentBossLevel - 1;
    const totalEquip = countTotalEquipment();
    const totalGold = GameData.player.gold;

    const checks = [
        { id: 'first_boss', condition: totalBossKills >= 1 },
        { id: 'boss_10', condition: totalBossKills >= 10 },
        { id: 'boss_50', condition: totalBossKills >= 50 },
        { id: 'chapter_5', condition: GameData.player.chapter >= 5 },
        { id: 'chapter_10', condition: GameData.player.chapter >= 10 },
        { id: 'equip_100', condition: totalEquip >= 100 },
        { id: 'rich', condition: totalGold >= 10000 },
        { id: 'level_50', condition: GameData.player.level >= 50 }
    ];

    checks.forEach(c => {
        if (c.condition && !achievements.includes(c.id)) {
            achievements.push(c.id);
            const ach = ACHIEVEMENTS.find(a => a.id === c.id);
            if (ach) {
                showToast(`🏆 成就解锁: ${ach.name}`, 'success');
            }
        }
    });

    GameData.player.achievements = achievements;
    saveData();
}

function renderAchievements() {
    const achievements = GameData.player.achievements || [];
    const html = ACHIEVEMENTS.map(a => {
        const isCompleted = achievements.includes(a.id);
        return `<div class="achievement-item ${isCompleted ? 'completed' : ''}">
            <div class="achievement-icon">${a.icon}</div>
            <div class="achievement-info">
                <div class="achievement-name">${a.name}</div>
                <div class="achievement-desc">${a.desc}</div>
            </div>
            <div class="task-reward">${a.reward.gold || 0}💰 ${a.reward.diamond || 0}💎</div>
        </div>`;
    }).join('');

    Renderer.setHTML('achievements-list', html);
}

window.openAchievements = openAchievements;
window.closeAchievements = closeAchievements;
