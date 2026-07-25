/**
 * 关卡系统
 * 每关50个怪，第50只为Boss，击败Boss进入下一关
 */
import { GameData } from '../data/gameData.js?v=quick-actions-20260725k';
import { ENEMY_TYPES, BOSS_TEMPLATES } from '../data/config.js?v=quick-actions-20260725k';
import { Renderer } from '../core/renderer.js?v=quick-actions-20260725k';
import { calculateStats } from './equipment.js?v=quick-actions-20260725k';
import { saveData } from '../data/gameData.js?v=quick-actions-20260725k';

/**
 * 生成普通关卡怪物
 */
export function generateStageEnemy(stageLevel, progress) {
    const typeIdx = Math.min(Math.floor((stageLevel - 1) / 2), ENEMY_TYPES.length - 1);
    const template = ENEMY_TYPES[typeIdx];
    const scale = 1 + (stageLevel - 1) * 0.3 + progress * 0.02;
    return {
        name: template.name,
        icon: template.icon,
        image: template.image,
        level: stageLevel,
        maxHp: Math.floor(template.baseHp * scale),
        currentHp: Math.floor(template.baseHp * scale),
        attack: Math.floor(template.baseAttack * scale),
        defense: Math.floor(template.baseDefense * scale),
        reward: Math.floor(10 * scale),
        exp: Math.floor(5 * scale),
        isBoss: false
    };
}

/**
 * 生成Boss
 */
export function generateBoss(level) {
    const templateIndex = (level - 1) % BOSS_TEMPLATES.length;
    const template = BOSS_TEMPLATES[templateIndex];
    const baseHp = 80 * Math.pow(1.2, level - 1);
    return {
        name: template.name,
        icon: template.icon,
        image: template.image,
        level: level,
        maxHp: Math.floor(baseHp),
        currentHp: Math.floor(baseHp),
        attack: Math.floor(8 * Math.pow(1.12, level - 1)),
        defense: Math.floor(2 * Math.pow(1.08, level - 1)),
        reward: Math.floor(40 * Math.pow(1.25, level - 1)),
        exp: Math.floor(50 * Math.pow(1.2, level - 1)),
        isBoss: true
    };
}

/**
 * 初始化当前关卡敌人
 */
export function initStageEnemy() {
    const stage = GameData.player.stageLevel;
    const progress = GameData.player.stageProgress;
    if (progress >= 49) {
        GameData.currentEnemy = generateBoss(stage);
    } else {
        GameData.currentEnemy = generateStageEnemy(stage, progress);
    }
    // 渲染敌人：优先用像素图，缺失时回退 emoji
    const enemy = GameData.currentEnemy;
    if (enemy.image) {
        // Boss 用 4 帧 sprite sheet（boss-sheet.png），普通小怪用单帧
        if (enemy.isBoss) {
            Renderer.setHTML('arena-boss-icon', `<div class="sprite-slot boss-sprite"><img class="boss-sprite-img" src="assets/images/sprites/boss-sheet.png" alt="${enemy.name}"></div>`);
        } else {
            Renderer.setHTML('arena-boss-icon', `<img src="${enemy.image}" class="arena-boss-img idle-anim" alt="${enemy.name}">`);
        }
    } else {
        Renderer.setText('arena-boss-icon', enemy.icon);
    }
    Renderer.setText('arena-boss-name', enemy.name + (enemy.isBoss ? ' [BOSS]' : ''));
    updateArenaHp();
}

/**
 * 更新战场血条
 */
export function updateArenaHp() {
    const enemy = GameData.currentEnemy || GameData.currentBoss;
    if (!enemy) return;
    const stats = calculateStats();

    const bossHpPercent = Math.max(0, (enemy.currentHp / enemy.maxHp) * 100);
    const playerHpPercent = Math.max(0, (GameData.player.currentHp / stats.hp) * 100);

    const bossHpBar = Renderer.$('arena-boss-hp');
    const playerHpBar = Renderer.$('arena-player-hp');
    const bossHpText = Renderer.$('arena-boss-hp-text');
    const playerHpText = Renderer.$('arena-player-hp-text');

    if (bossHpBar) {
        bossHpBar.style.width = bossHpPercent + '%';
        bossHpBar.classList.add('damage-flash');
        setTimeout(() => bossHpBar.classList.remove('damage-flash'), 300);
    }
    if (playerHpBar) {
        playerHpBar.style.width = playerHpPercent + '%';
        playerHpBar.classList.add('damage-flash');
        setTimeout(() => playerHpBar.classList.remove('damage-flash'), 300);
    }
    if (bossHpText) bossHpText.textContent = Math.max(0, Math.floor(enemy.currentHp)) + '/' + enemy.maxHp;
    if (playerHpText) playerHpText.textContent = Math.max(0, Math.floor(GameData.player.currentHp)) + '/' + stats.hp;
}

/**
 * 重置战斗（换Boss按钮）
 */
export function resetBattle() {
    initStageEnemy();
    const stats = calculateStats();
    GameData.player.currentHp = stats.hp;
    GameData.player.maxHp = stats.hp;
    updateArenaHp();
    Renderer.setHTML('battle-log', '<div class="log-item">第 ' + GameData.player.stageLevel + ' 关 - ' + (GameData.player.stageProgress + 1) + '/50</div>');
}

/**
 * 关卡扫荡（已通关关卡快速获取奖励）
 */
export function sweepStage(stageNum) {
    if (stageNum > GameData.player.stageCleared) {
        return { success: false, message: '该关卡尚未通关' };
    }
    const baseReward = 30 * Math.pow(1.2, stageNum - 1);
    const goldGain = Math.floor(baseReward);
    const expGain = Math.floor(15 * Math.pow(1.15, stageNum - 1));

    GameData.player.gold += goldGain;
    // 经验值通过addExperience处理
    saveData();
    return { success: true, gold: goldGain, exp: expGain };
}
