/**
 * 战斗系统
 * 手动攻击、自动战斗、伤害计算、掉落
 */
import { GameData, saveData } from '../data/gameData.js';
import { calculateStats } from './equipment.js';
import { initStageEnemy, updateArenaHp } from './stage.js';
import { Renderer } from '../core/renderer.js';
import { Timers } from '../core/events.js';
import { EQUIPMENT_TEMPLATES, MATERIALS } from '../data/config.js';

let isAutoBattle = false;
let combatInterval = null;

/**
 * 手动攻击
 */
export function manualAttack() {
    if (!GameData.currentEnemy) {
        initStageEnemy();
    }
    if (GameData.currentEnemy && GameData.currentEnemy.currentHp <= 0) {
        initStageEnemy();
    }
    if (GameData.player.currentHp <= 0) {
        const stats = calculateStats();
        GameData.player.currentHp = stats.hp;
        GameData.player.maxHp = stats.hp;
        initStageEnemy();
        Renderer.setHTML('battle-log', '<div class="log-item">重新挑战！</div>');
    }
    performAttack();
}

/**
 * 执行一次攻击
 */
export function performAttack() {
    const stats = calculateStats();
    const enemy = GameData.currentEnemy || GameData.currentBoss;
    if (!enemy) return;

    const playerImg = Renderer.$q('.arena-player-img');
    const bossIcon = Renderer.$('arena-boss-icon');

    // 玩家攻击动画
    if (playerImg) {
        playerImg.classList.remove('attacking');
        void playerImg.offsetWidth;
        playerImg.classList.add('attacking');
    }

    // 伤害计算
    let damage = stats.attack - enemy.defense;
    const isCrit = Math.random() * 100 < stats.critRate;
    if (isCrit) damage *= (1 + (stats.critDamage || 50) / 100);

    // 连击
    let comboHits = 1;
    if (stats.combo > 0 && Math.random() * 100 < stats.combo) {
        comboHits = 2;
        damage = Math.floor(damage * 1.5);
    }
    damage = Math.max(1, Math.floor(damage));
    enemy.currentHp -= damage;

    // 吸血
    if (stats.lifeSteal > 0) {
        const heal = Math.floor(damage * stats.lifeSteal / 100);
        GameData.player.currentHp = Math.min(GameData.player.maxHp, GameData.player.currentHp + heal);
    }

    // 伤害飘字
    setTimeout(() => {
        if (bossIcon) {
            bossIcon.classList.remove('hit');
            void bossIcon.offsetWidth;
            bossIcon.classList.add('hit');
        }
        showDamageNumber(bossIcon, damage, isCrit);
        if (comboHits > 1) {
            setTimeout(() => showDamageNumber(bossIcon, Math.floor(damage * 0.5), false), 150);
        }
        updateArenaHp();
    }, 200);

    addCombatLog('你对 ' + enemy.name + ' 造成 ' + formatNumber(damage) + (isCrit ? ' 暴击!' : '') + (comboHits > 1 ? ' 连击!' : ''), isCrit ? 'crit' : 'player');

    if (enemy.currentHp <= 0) {
        setTimeout(() => enemyDefeated(), 500);
        return;
    }

    // 敌人反击
    setTimeout(() => {
        if (!enemy || enemy.currentHp <= 0) return;
        if (bossIcon) {
            bossIcon.classList.remove('attacking');
            void bossIcon.offsetWidth;
            bossIcon.classList.add('attacking');
        }

        let bossDamage = Math.max(1, Math.floor(enemy.attack - stats.defense));
        GameData.player.currentHp -= bossDamage;

        setTimeout(() => {
            if (playerImg) {
                playerImg.classList.remove('attacking');
                void playerImg.offsetWidth;
                playerImg.classList.add('attacking');
            }
            showDamageNumber(playerImg, bossDamage, false, true);
            updateArenaHp();
        }, 200);

        addCombatLog(enemy.name + ' 反击造成 ' + formatNumber(bossDamage) + ' 伤害', 'damage');

        if (GameData.player.currentHp <= 0) {
            playerDefeated();
        }
    }, 600);
}

/**
 * 伤害飘字
 */
function showDamageNumber(target, value, isCrit, isPlayerDamage) {
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const num = document.createElement('div');
    num.className = 'damage-number ' + (isCrit ? 'crit' : '') + ' ' + (isPlayerDamage ? 'heal' : '');
    num.textContent = '-' + formatNumber(value);
    num.style.left = (rect.left + rect.width / 2) + 'px';
    num.style.top = (rect.top + window.scrollY) + 'px';
    document.body.appendChild(num);
    setTimeout(() => num.remove(), 1000);
}

/**
 * 战斗日志
 */
function addCombatLog(message, type) {
    const log = Renderer.$('battle-log');
    if (!log) return;
    const item = document.createElement('div');
    item.className = 'log-item ' + (type || '');
    item.textContent = message;
    log.appendChild(item);
    while (log.children.length > 10) {
        log.removeChild(log.firstChild);
    }
    log.scrollTop = log.scrollHeight;
}

/**
 * 敌人被击败
 */
function enemyDefeated() {
    const enemy = GameData.currentEnemy || GameData.currentBoss;
    if (!enemy) return;
    const wasAutoBattle = isAutoBattle;
    if (isAutoBattle) stopAutoBattle();

    const goldReward = Math.floor(enemy.reward * getGoldBonus());
    GameData.player.gold += goldReward;
    const expGain = enemy.exp || Math.floor(20 * Math.pow(1.1, enemy.level - 1));
    addExperience(expGain);

    // 掉落
    const drops = generateDrops(0);
    let dropText = '';
    if (drops.length > 0) {
        drops.forEach(d => {
            if (d.type === 'equipment') {
                GameData.player.bag[d.equipType].push(d.item);
                dropText += ' ' + d.item.name;
            } else if (d.type === 'material') {
                const existing = GameData.player.bag.material.find(m => m.id === d.item.id);
                if (existing) existing.count += d.item.count;
                else GameData.player.bag.material.push(d.item);
                dropText += ' ' + d.item.name + 'x' + d.item.count;
            }
        });
    }

    addCombatLog('击败 ' + enemy.name + '！获得 ' + formatNumber(goldReward) + '金币 ' + expGain + '经验' + (dropText ? ' 掉落:' + dropText : ''), 'win');

    if (enemy.isBoss) {
        GameData.player.stageCleared = Math.max(GameData.player.stageCleared, GameData.player.stageLevel);
        GameData.player.stageLevel++;
        GameData.player.stageProgress = 0;
        GameData.player.currentBossLevel++;
        addCombatLog('进入第 ' + GameData.player.stageLevel + ' 关！', 'system');
    } else {
        GameData.player.stageProgress++;
        if (GameData.player.stageProgress >= 49) {
            addCombatLog('⚠️ Boss即将出现！', 'system');
        }
    }

    saveData();
    GameData.currentEnemy = null;
    setTimeout(() => {
        initStageEnemy();
        if (wasAutoBattle) startAutoBattle();
    }, 800);
}

/**
 * 玩家被击败
 */
function playerDefeated() {
    stopAutoBattle();
    addCombatLog('💀 你被击败了...', 'system');
    GameData.player.currentHp = Math.floor(GameData.player.maxHp * 0.5);
    saveData();
    updateArenaHp();
}

/**
 * 掉落系统
 */
function generateDrops(dropBonus) {
    const drops = [];
    const roll = Math.random() + dropBonus;
    const stageLevel = GameData.player.stageLevel;

    if (roll > 0.7) {
        const equipTypes = ['weapon', 'armor', 'head', 'clothes', 'cloak', 'ring', 'amulet', 'boots', 'accessory'];
        const type = equipTypes[Math.floor(Math.random() * equipTypes.length)];
        const templates = EQUIPMENT_TEMPLATES[type];
        let qualityPool;
        if (stageLevel <= 5) qualityPool = ['white', 'green'];
        else if (stageLevel <= 15) qualityPool = ['white', 'green', 'blue'];
        else if (stageLevel <= 30) qualityPool = ['green', 'blue', 'purple'];
        else if (stageLevel <= 50) qualityPool = ['blue', 'purple', 'orange'];
        else qualityPool = ['purple', 'orange', 'red'];

        const quality = qualityPool[Math.floor(Math.random() * qualityPool.length)];
        const template = templates.find(t => t.quality === quality) || templates[0];
        const item = { ...template, level: 1 };
        drops.push({ type: 'equipment', equipType: type, item });
    }

    if (roll > 0.5) {
        const matPool = [
            { id: 'm1', name: '废铁', icon: '🔩', count: Math.floor(1 + Math.random() * 3) },
            { id: 'm2', name: '零件', icon: '⚙️', count: Math.floor(1 + Math.random() * 2) },
            { id: 'enhance_stone', name: '强化石', icon: '🪨', count: 1 }
        ];
        if (stageLevel > 10) matPool.push({ id: 'm3', name: '能源', icon: '🔋', count: 1 });
        if (stageLevel > 20) matPool.push({ id: 'm4', name: '晶体', icon: '💎', count: 1 });
        const mat = matPool[Math.floor(Math.random() * matPool.length)];
        drops.push({ type: 'material', item: mat });
    }
    return drops;
}

// 辅助函数
function getGoldBonus() {
    return 1;
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return Math.floor(num).toString();
}

function addExperience(amount) {
    GameData.player.currentExp += amount;
    let leveledUp = false;
    while (GameData.player.currentExp >= GameData.player.expToNext) {
        GameData.player.currentExp -= GameData.player.expToNext;
        GameData.player.level++;
        GameData.player.expToNext = Math.floor(100 * Math.pow(1.2, GameData.player.level - 1));
        leveledUp = true;
    }
    return { leveledUp };
}

/**
 * 战斗中恢复
 */
export function healInBattle() {
    const healAmount = Math.floor(GameData.player.maxHp * 0.3);
    GameData.player.currentHp = Math.min(GameData.player.maxHp, GameData.player.currentHp + healAmount);
    updateArenaHp();
    addCombatLog('💊 恢复了 ' + healAmount + ' 点生命值', 'system');
}

/**
 * 切换自动战斗
 */
export function toggleAutoBattle() {
    if (isAutoBattle) {
        stopAutoBattle();
    } else {
        startAutoBattle();
    }
}

/**
 * 开始自动战斗
 */
export function startAutoBattle() {
    if (isAutoBattle) return;
    if (!GameData.currentEnemy || GameData.currentEnemy.currentHp <= 0) {
        initStageEnemy();
    }
    isAutoBattle = true;
    const autoBtn = Renderer.$('auto-battle-btn');
    if (autoBtn) {
        autoBtn.textContent = '⏹ 停止';
        autoBtn.classList.add('active');
    }
    combatInterval = Timers.set(() => {
        if (!GameData.currentEnemy || GameData.currentEnemy.currentHp <= 0 || GameData.player.currentHp <= 0) {
            stopAutoBattle();
            return;
        }
        performAttack();
    }, 800);
}

/**
 * 停止自动战斗
 */
export function stopAutoBattle() {
    isAutoBattle = false;
    if (combatInterval) {
        Timers.clear(combatInterval);
        combatInterval = null;
    }
    const autoBtn = Renderer.$('auto-battle-btn');
    if (autoBtn) {
        autoBtn.textContent = '🤖 自动';
        autoBtn.classList.remove('active');
    }
}
