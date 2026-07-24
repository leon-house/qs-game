/**
 * 剧情展示系统
 */
import { GameData, saveData } from '../data/gameData.js';
import { Renderer } from '../core/renderer.js';
import { CHAPTER_STORIES } from '../data/config.js';

export function showStory(chapterIndex) {
    const story = CHAPTER_STORIES[chapterIndex] || CHAPTER_STORIES[0];
    Renderer.setText('story-title', story.title);
    Renderer.setText('story-content', story.story);
    Renderer.showModal('story-modal');
}

export function closeStory() {
    Renderer.hideModal('story-modal');
}

export function showCurrentChapterStory() {
    const chapterIndex = Math.min((GameData.player.chapter || 1) - 1, CHAPTER_STORIES.length - 1);
    showStory(chapterIndex);
}

window.closeStory = closeStory;
window.showCurrentChapterStory = showCurrentChapterStory;
