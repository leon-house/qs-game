/**
 * 章节系统
 */
import { GameData } from '../data/gameData.js?v=equip-mini-btns-20260725n';
import { Renderer } from '../core/renderer.js?v=equip-mini-btns-20260725n';
import { showToast } from '../ui/ui.js?v=equip-mini-btns-20260725n';

const CHAPTERS = [
    { chapter: 1, name: '废墟之城', bossStart: 1, bossEnd: 10 },
    { chapter: 2, name: '变异森林', bossStart: 11, bossEnd: 20 },
    { chapter: 3, name: '辐射沙漠', bossStart: 21, bossEnd: 30 },
    { chapter: 4, name: '沦陷基地', bossStart: 31, bossEnd: 40 },
    { chapter: 5, name: '感染者巢穴', bossStart: 41, bossEnd: 50 },
    { chapter: 6, name: '地下研究所', bossStart: 51, bossEnd: 60 },
    { chapter: 7, name: '变异海滩', bossStart: 61, bossEnd: 70 },
    { chapter: 8, name: '钢铁工厂', bossStart: 71, bossEnd: 80 },
    { chapter: 9, name: '最终防线', bossStart: 81, bossEnd: 90 },
    { chapter: 10, name: '新世界', bossStart: 91, bossEnd: 100 }
];

export function openChapter() {
    renderChapter();
    Renderer.showModal('chapter-modal');
}

export function closeChapter() {
    Renderer.hideModal('chapter-modal');
}

function renderChapter() {
    const currentChapter = GameData.player.chapter || 1;
    const currentBoss = GameData.player.currentBossLevel || 1;

    Renderer.setText('current-chapter', currentChapter);
    Renderer.setText('current-boss-level', currentBoss);

    const html = CHAPTERS.map(c => {
        const isCurrent = c.chapter === currentChapter;
        const isCompleted = currentBoss > c.bossEnd;
        return `<div class="chapter-item ${isCurrent ? 'current' : ''} ${isCompleted ? 'completed' : ''}">
            <div>
                <div class="chapter-num-small">第${c.chapter}章 ${c.name}</div>
                <div style="font-size:12px;color:var(--text-secondary)">Boss ${c.bossStart}-${c.bossEnd}</div>
            </div>
            <div class="chapter-status">${isCompleted ? '✅ 已完成' : isCurrent ? '🔄 进行中' : '🔒 未解锁'}</div>
        </div>`;
    }).join('');

    Renderer.setHTML('chapter-list', html);
}

export function updateChapter() {
    const bossLevel = GameData.player.currentBossLevel;
    let newChapter = 1;
    CHAPTERS.forEach(c => {
        if (bossLevel > c.bossEnd) newChapter = c.chapter;
    });
    if (newChapter > GameData.player.chapter) {
        GameData.player.chapter = newChapter;
        showToast(`🎉 进入第${newChapter}章: ${CHAPTERS[newChapter - 1].name}`, 'success');
    }
}

window.openChapter = openChapter;
window.closeChapter = closeChapter;
