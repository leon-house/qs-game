/**
 * 副本系统（普通/精英副本 + 扫荡）
 */
import { GameData, saveData } from '../data/gameData.js?v=equip-mini-btns-20260725n';
import { Renderer } from '../core/renderer.js?v=equip-mini-btns-20260725n';
import { MATERIALS } from '../data/config.js?v=equip-mini-btns-20260725n';
import { calculateStats } from './equipment.js?v=equip-mini-btns-20260725n';
import { showToast, updateUI } from '../ui/ui.js?v=equip-mini-btns-20260725n';
import { triggerRandomEvent } from './events.js?v=equip-mini-btns-20260725n';

const DUNGEONS = [
    { id: 'normal_1', name: '废墟副本', chapter: 1, waves: 10, hpScale: 0.3, rewardScale: 1, type: 'normal' },
    { id: 'normal_2', name: '森林副本', chapter: 2, waves: 10, hpScale: 0.5, rewardScale: 1.5, type: 'normal' },
    { id: 'normal_3', name: '沙漠副本', chapter: 3, waves: 10, hpScale: 0.8, rewardScale: 2, type: 'normal' },
    { id: 'elite_1', name: '精英废墟', chapter: 1, waves: 10, hpScale: 1, rewardScale: 3, type: 'elite', unlockReq: 5 },
    { id: 'elite_2', name: '精英森林', chapter: 2, waves: 10, hpScale: 1.5, rewardScale: 4, type: 'elite', unlockReq: 10 },
    { id: 'elite_3', name: '精英沙漠', chapter: 3, waves: 10, hpScale: 2, rewardScale: 5, type: 'elite', unlockReq: 15 }
];

const ENEMY_TEMPLATES = [
    { name: '辐射鼠', icon: '🐀', baseHp: 20, baseAttack: 3, baseDefense: 1 },
    { name: '变异狗', icon: '🐕', baseHp: 35, baseAttack: 5, baseDefense: 2 },
    { name: '感染者', icon: '🧟', baseHp: 50, baseAttack: 8, baseDefense: 3 },
    { name: '变异体', icon: '👹', baseHp: 80, baseAttack: 12, baseDefense: 5 },
    { name: '变异boss', icon: '👺', baseHp: 150, baseAttack: 20, baseDefense: 8 }
];

// 确保 GameData.player.dungeonProgress 已初始化（在 data/gameData.js 中已包含，若缺则兜底）
if (GameData.player && !GameData.player.dungeonProgress) {
    GameData.player.dungeonProgress = {};
    DUNGEONS.forEach(d => {
        GameData.player.dungeonProgress[d.id] = { maxWave: 0, totalKills: 0 };
    });
}

let currentDungeon = null;
let currentWave = 1;
let currentEnemy = null;
let isDungeonBattle = false;
let dungeonInterval = null;

export function openDungeons() {
    renderDungeons();
    Renderer.showModal('dungeon-modal');
}

export function closeDungeons() {
    stopDungeonBattle();
    Renderer.hideModal('dungeon-modal');
}

function renderDungeons() {
    const container = Renderer.$('dungeon-list');
    container.innerHTML = '';

    DUNGEONS.forEach(dungeon => {
        const progress = GameData.player.dungeonProgress[dungeon.id] || { maxWave: 0 };
        const isElite = dungeon.type === 'elite';
        const isUnlocked = !isElite || (GameData.player.currentBossLevel >= (dungeon.unlockReq || 999));

        const div = Renderer.create('div', {
            className: `dungeon-card ${isElite ? 'elite' : 'normal'} ${!isUnlocked ? 'locked' : ''}`
        });
        div.innerHTML = `
            <div class="dungeon-icon">${isElite ? '👑' : '⚔️'}</div>
            <div class="dungeon-info">
                <div class="dungeon-name">${dungeon.name}</div>
                <div class="dungeon-progress">进度: ${progress.maxWave}/${dungeon.waves} 波</div>
                <div class="dungeon-reward">奖励x${dungeon.rewardScale}</div>
            </div>
            <div class="dungeon-actions">
                ${isUnlocked ? `
                    <button class="dungeon-btn fight" onclick="startDungeon('${dungeon.id}')">挑战</button>
                    <button class="dungeon-btn sweep" onclick="sweepDungeon('${dungeon.id}')" ${progress.maxWave < dungeon.waves ? 'disabled' : ''}>扫荡</button>
                ` : `<button class="dungeon-btn locked">通关Boss${dungeon.unlockReq}解锁</button>`}
            </div>
        `;
        container.appendChild(div);
    });
}

function startDungeon(dungeonId) {
    const dungeon = DUNGEONS.find(d => d.id === dungeonId);
    if (!dungeon) return;

    currentDungeon = dungeon;
    currentWave = 1;
    isDungeonBattle = true;

    generateEnemy();
    Renderer.showModal('dungeon-battle-modal');
    updateDungeonBattleUI();
}
window.startDungeon = startDungeon;

function generateEnemy() {
    const template = ENEMY_TEMPLATES[Math.min(Math.floor((currentWave - 1) / 2), ENEMY_TEMPLATES.length - 1)];
    const scale = currentDungeon.hpScale;
    const playerLevel = GameData.player.level;

    currentEnemy = {
        name: template.name,
        icon: template.icon,
        maxHp: Math.floor(template.baseHp * scale * (1 + playerLevel * 0.1)),
        currentHp: Math.floor(template.baseHp * scale * (1 + playerLevel * 0.1)),
        attack: Math.floor(template.baseAttack * scale * (1 + playerLevel * 0.1)),
        defense: Math.floor(template.baseDefense * scale)
    };
}

function updateDungeonBattleUI() {
    Renderer.setText('dungeon-wave', `第 ${currentWave}/${currentDungeon.waves} 波`);
    Renderer.setText('dungeon-enemy-icon', currentEnemy.icon);
    Renderer.setText('dungeon-enemy-name', currentEnemy.name);
    Renderer.setText('dungeon-enemy-hp', `${Math.floor(currentEnemy.currentHp)}/${currentEnemy.maxHp}`);
    Renderer.setStyle('dungeon-enemy-hp-bar', 'width', (currentEnemy.currentHp / currentEnemy.maxHp * 100) + '%');

    Renderer.setText('dungeon-player-hp', `${Math.floor(GameData.player.currentHp)}/${GameData.player.maxHp}`);
    Renderer.setStyle('dungeon-player-hp-bar', 'width', (GameData.player.currentHp / GameData.player.maxHp * 100) + '%');

    Renderer.setText('dungeon-combo', `连击: ${GameData.player.combo || 0}`);
}

export function startDungeonAutoBattle() {
    if (dungeonInterval) return;
    dungeonInterval = setInterval(() => {
        if (!isDungeonBattle || !currentEnemy || currentEnemy.currentHp <= 0) return;
        performDungeonAttack();
    }, 600);
}

export function stopDungeonBattle() {
    if (dungeonInterval) {
        clearInterval(dungeonInterval);
        dungeonInterval = null;
    }
}

export function performDungeonAttack() {
    const stats = calculateStats();
    const comboBonus = Math.min((GameData.player.combo || 0) * 0.02, 0.5);

    // 玩家攻击
    let damage = Math.floor(stats.attack * (1 + comboBonus) - currentEnemy.defense);
    damage = Math.max(1, damage);
    const isCrit = Math.random() * 100 < stats.critRate;
    if (isCrit) damage *= 2;

    currentEnemy.currentHp -= damage;
    GameData.player.combo = (GameData.player.combo || 0) + 1;
    GameData.player.maxCombo = Math.max(GameData.player.maxCombo || 0, GameData.player.combo);

    // 敌人反击
    if (currentEnemy.currentHp > 0) {
        let enemyDamage = Math.max(1, currentEnemy.attack - stats.defense);
        GameData.player.currentHp -= enemyDamage;

        if (GameData.player.currentHp <= 0) {
            GameData.player.currentHp = 0;
            GameData.player.combo = 0;
            stopDungeonBattle();
            showToast('副本失败！连击已中断', 'warning');
            closeDungeonBattle();
            return;
        }
    }

    updateDungeonBattleUI();

    // 敌人死亡
    if (currentEnemy.currentHp <= 0) {
        GameData.player.totalKills = (GameData.player.totalKills || 0) + 1;

        // 掉落金币
        const goldReward = Math.floor(10 * currentDungeon.rewardScale * (1 + currentWave * 0.1));
        GameData.player.gold += goldReward;

        // 检查是否通过当前波
        if (currentWave >= currentDungeon.waves) {
            const progress = GameData.player.dungeonProgress[currentDungeon.id];
            progress.maxWave = currentDungeon.waves;
            progress.totalKills = (progress.totalKills || 0) + currentWave;

            showToast(`🎉 通关${currentDungeon.name}！获得 ${goldReward} 金币`, 'success');
            stopDungeonBattle();
            closeDungeonBattle();
            saveData();
            renderDungeons();
            return;
        }

        currentWave++;
        generateEnemy();
        updateDungeonBattleUI();
    }
}

export function closeDungeonBattle() {
    stopDungeonBattle();
    isDungeonBattle = false;
    if (GameData.player.maxHp) {
        GameData.player.currentHp = GameData.player.maxHp;
    }
    Renderer.hideModal('dungeon-battle-modal');
}

function sweepDungeon(dungeonId) {
    const dungeon = DUNGEONS.find(d => d.id === dungeonId);
    if (!dungeon) return;

    const totalGold = Math.floor(100 * dungeon.rewardScale * dungeon.waves);
    const expGain = Math.floor(20 * dungeon.waves);
    const materialCount = Math.floor(dungeon.waves / 3) + 1;

    GameData.player.gold += totalGold;
    GameData.player.currentExp = (GameData.player.currentExp || 0) + expGain;

    const mat = MATERIALS[Math.floor(Math.random() * MATERIALS.length)];
    const existing = GameData.player.bag.material.find(m => m.id === mat.id);
    if (existing) existing.count += materialCount;
    else GameData.player.bag.material.push({ ...mat, count: materialCount });

    showToast(`🎉 扫荡成功！+${totalGold}金币 ${materialCount}${mat.name}`, 'success');
    saveData();
    updateUI();
    renderDungeons();
    triggerRandomEvent();
}

window.openDungeons = openDungeons;
window.closeDungeons = closeDungeons;
window.startDungeonAutoBattle = startDungeonAutoBattle;
window.performDungeonAttack = performDungeonAttack;
window.closeDungeonBattle = closeDungeonBattle;
window.sweepDungeon = sweepDungeon;
