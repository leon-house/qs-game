/**
 * 弹窗互斥测试（jsdom + Renderer.showModal）
 * 运行：node --test test/modal.test.mjs
 *
 * 背景（2026-10-28 全项目自测）：
 *   过去几乎所有弹窗都绕过 Renderer.showModal() 直接切 .active，
 *   自动弹出的剧情卡片（story-modal）会和玩家已经打开的商店并存 ——
 *   两层全屏遮罩叠在一起，看起来像坏了。
 *   现在改成：玩家主动开弹窗 → 走 Renderer.showModal() → 关掉其它普通弹窗（含剧情卡）。
 *   但「受保护弹窗」（副本战斗 / 挑战战利品）持有活的游戏状态，不能被顶掉。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;

const { Renderer } = await import('../src/core/renderer.js');

const ALL_MODALS = [
    'shop-modal', 'equipment-modal', 'story-modal', 'bag-modal', 'skillbook-modal',
    'challenge-modal', 'dungeon-modal', 'dungeon-battle-modal', 'challenge-loot-modal',
];

function mount(ids = ALL_MODALS) {
    document.body.innerHTML = ids.map(id => `<div class="modal-overlay" id="${id}"></div>`).join('');
    Renderer.clearCache();
}

function activeIds() {
    return [...document.querySelectorAll('.modal-overlay.active')].map(el => el.id).sort();
}

describe('renderer.js 弹窗互斥（2026-10-28）', () => {
    test('玩家打开商店时，自动剧情卡片 story-modal 被关掉', () => {
        mount();
        Renderer.showModal('story-modal');
        assert.deepEqual(activeIds(), ['story-modal'], '前置：剧情卡已打开');

        Renderer.showModal('shop-modal');
        assert.deepEqual(activeIds(), ['shop-modal'], '商店打开后只剩商店，剧情卡不该并存');
    });

    test('玩家打开一个弹窗会关掉另一个玩家弹窗', () => {
        mount();
        Renderer.showModal('shop-modal');
        Renderer.showModal('equipment-modal');
        assert.deepEqual(activeIds(), ['equipment-modal']);
    });

    test('受保护的副本战斗弹窗不会被普通弹窗顶掉（否则丢战斗进度）', () => {
        mount();
        Renderer.showModal('dungeon-battle-modal');
        Renderer.showModal('shop-modal');
        assert.ok(activeIds().includes('dungeon-battle-modal'), '副本战斗弹窗必须还在');
        assert.ok(activeIds().includes('shop-modal'), '商店也应该打开');
    });

    test('受保护的战利品确认弹窗不会被普通弹窗顶掉（否则丢战利品）', () => {
        mount();
        Renderer.showModal('challenge-loot-modal');
        Renderer.showModal('shop-modal');
        assert.ok(activeIds().includes('challenge-loot-modal'), '战利品弹窗必须还在');
    });

    test('受保护弹窗自己打开时可以接管画面（关掉普通弹窗）', () => {
        mount();
        Renderer.showModal('shop-modal');
        Renderer.showModal('dungeon-battle-modal');
        assert.deepEqual(activeIds(), ['dungeon-battle-modal']);
    });

    test('重复打开同一个弹窗不会把自己关掉', () => {
        mount();
        Renderer.showModal('shop-modal');
        Renderer.showModal('shop-modal');
        assert.deepEqual(activeIds(), ['shop-modal']);
    });

    test('关闭用 hideModal，不影响受保护弹窗', () => {
        mount();
        Renderer.showModal('dungeon-battle-modal');
        Renderer.showModal('shop-modal');
        Renderer.hideModal('shop-modal');
        assert.deepEqual(activeIds(), ['dungeon-battle-modal']);
    });
});