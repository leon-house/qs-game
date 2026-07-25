/**
 * 角色选择系统
 */
import { GameData, saveData } from '../data/gameData.js?v=equip-select-redesign-20260725m';
import { Renderer } from '../core/renderer.js?v=equip-select-redesign-20260725m';
import { SURVIVOR_TYPES } from '../data/config.js?v=equip-select-redesign-20260725m';
import { showToast, updateUI } from '../ui/ui.js?v=equip-select-redesign-20260725m';

let selectedCharacterType = null;

export function renderCharacterSelection() {
    const list = Renderer.$('character-list');
    list.innerHTML = Object.entries(SURVIVOR_TYPES).map(([key, char]) => `
        <div class="character-card" data-type="${key}" onclick="selectCharacter('${key}')">
            <div class="character-card-icon">${char.icon}</div>
            <div class="character-card-name">${char.name}</div>
            <div class="character-card-desc">${char.desc}</div>
        </div>
    `).join('');
}

export function selectCharacter(type) {
    selectedCharacterType = type;
    document.querySelectorAll('.character-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.type === type);
    });
}

export function confirmCharacter() {
    if (!selectedCharacterType) {
        showToast('请选择一个幸存者类型', 'warning');
        return;
    }

    const nameInput = document.getElementById('character-name-input');
    const name = nameInput.value.trim() || '幸存者';

    GameData.player.characterType = selectedCharacterType;
    GameData.player.characterName = name;

    // 应用角色初始加成
    const char = SURVIVOR_TYPES[selectedCharacterType];
    if (char.bonus.attack) {
        GameData.baseStats.attack = Math.floor(10 * (1 + char.bonus.attack));
    }
    if (char.bonus.hp) {
        GameData.baseStats.hp = Math.floor(100 * (1 + char.bonus.hp));
        GameData.player.maxHp = GameData.baseStats.hp;
        GameData.player.currentHp = GameData.baseStats.hp;
    }
    if (char.bonus.critRate) {
        GameData.baseStats.critRate = 5 + char.bonus.critRate;
    }

    Renderer.hideModal('character-modal');
    saveData();
    updateUI();
    showToast(`欢迎，${name}！在这个末世中生存下去！`, 'success');

    // 自动展示序章剧情（如果有）
    if (!GameData.player.storyRead) {
        // 通知story模块显示（避免循环依赖）
        if (window.showStory) {
            window.showStory(0);
            GameData.player.storyRead = true;
            saveData();
        }
    }
}

window.confirmCharacter = confirmCharacter;
window.selectCharacter = selectCharacter;
