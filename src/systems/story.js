/**
 * 剧情展示系统
 * 修复：原本读 `story.story`，CHAPTER_STORIES 里是 `text`，导致内容永远为空
 * 修复：bossLevel 增加时自动弹出下一章剧情
 */
import { GameData, saveData } from '../data/gameData.js';
import { CHAPTER_STORIES } from '../data/config.js';
import { showToast } from '../ui/ui.js';

/**
 * 显示第 chapterIndex 个剧情（0-based）
 * 2026-08-03：末尾加"接下来..."指引，告诉玩家下一步做什么
 */
export function showStory(chapterIndex) {
    const stories = CHAPTER_STORIES;
    if (!stories || stories.length === 0) {
        showToast('剧情库为空', 'error');
        return;
    }
    const idx = Math.max(0, Math.min(chapterIndex, stories.length - 1));
    const story = stories[idx];
    const titleEl = document.getElementById('story-title');
    const contentEl = document.getElementById('story-content');
    if (titleEl) titleEl.textContent = `第 ${story.chapter} 章 · ${story.title}`;
    // 2026-08-03：剧情 + 操作指引（让玩家知道下一步做什么）
    const nextStep = `<div style="margin-top:12px;padding:8px 10px;background:rgba(251,191,36,0.12);border-left:3px solid #fbbf24;border-radius:4px;font-size:12px;line-height:1.6;">
        <div style="color:#fbbf24;font-weight:600;margin-bottom:4px;">📌 接下来</div>
        <div>· 战斗会自动进行，无需操作</div>
        <div>· 累积奖励后点击底部「📥 收获」入背包</div>
        <div>· 商店刷碎片合成技能书 → 挑战强敌</div>
    </div>`;
    if (contentEl) {
        contentEl.innerHTML = (story.text || '（该章节剧情尚未解锁）') + nextStep;
    }
    const modal = document.getElementById('story-modal');
    if (modal) modal.classList.add('active');
    if (typeof window.lucide !== 'undefined') window.lucide.createIcons();
}

/**
 * 根据当前 bossLevel 显示应读的章节剧情
 * - bossLevel=0（刚开始第 0 章）→ 第 1 章剧情（CHAPTER_STORIES[0]）
 * - bossLevel=N（即将进入第 N+1 章）→ 第 N+1 章剧情
 * 索引 = min(bossLevel, stories.length - 1)
 */
export function showCurrentChapterStory() {
    const bl = GameData.player.bossLevel || 0;
    showStory(bl);   // 直接 bl 就是 CHAPTER_STORIES 索引（bossLevel=0 → 第 1 章，bossLevel=9 → 第 10 章）
}

/**
 * 关闭剧情弹窗
 */
export function closeStory() {
    const modal = document.getElementById('story-modal');
    if (modal) modal.classList.remove('active');
}

// window 桥接
window.closeStory = closeStory;
window.showCurrentChapterStory = showCurrentChapterStory;
window.showStory = showStory;
