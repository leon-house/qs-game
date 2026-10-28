// ============================================================
//  src/systems/shelter-v2.js
//  庇护所 modal-v2（PRD v3 · 2026-08-04 · Phase 2 实装）
//
//  4 个独立建筑 tab：
//   - 进化所（Evolution Lab）    ← Phase 1 实装
//   - 发电站（Power Plant）      ← Phase 2 实装
//   - 训练场（Training Ground）  ← Phase 2 实装
//   - 商店等级（Shop Level）     ← Phase 2 实装
//
//  API:
//    openShelterV2()       → 打开庇护所 modal-v2
//    closeShelterV2()      → 关闭
//    switchShelterTab(name) → 切换 tab
//    refreshShelterV2()    → 重新渲染当前 tab（用于升级后刷新）
// ============================================================

import { GameData, saveData, initNewFields } from '../data/gameData.js';
import { Renderer } from '../core/renderer.js';
import { renderEvolutionLabInfo } from './evolution-lab.js';
import { renderPowerPlantInfo } from './power-plant.js';
import { renderTrainingGroundInfo, startTraining, tickTraining, calculateTrainingBonus } from './training-ground.js';
import { renderShopLevelInfo } from './shop-level.js';

let currentTab = 'evolution';

export function openShelterV2() {
    initNewFields();
    const modal = document.getElementById('shelter-v2-modal');
    if (!modal) return;
    currentTab = 'evolution';
    renderShelterV2();
    // 2026-10-28：改走 Renderer.showModal —— 玩家主动开弹窗时关掉自动剧情卡片和其它弹窗（互斥）
    Renderer.showModal('shelter-v2-modal');
    // 启动训练 ticker（如果之前没启动）
    try { window.startTrainingTicker && window.startTrainingTicker(); } catch (_) {}
    if (typeof window.lucide !== 'undefined') window.lucide.createIcons();
}

export function closeShelterV2() {
    const modal = document.getElementById('shelter-v2-modal');
    if (modal) modal.classList.remove('active');
}

export function switchShelterTab(name) {
    currentTab = name;
    renderShelterV2();
    document.querySelectorAll('.shelter-v2-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === name);
    });
    if (typeof window.lucide !== 'undefined') window.lucide.createIcons();
}

/**
 * 重新渲染当前 tab（升级后调用）
 */
export function refreshShelterV2() {
    const body = document.getElementById('shelter-v2-body');
    if (!body) return;
    // 训练 tab 升级后需要检查 tick
    try { tickTraining(); } catch (_) {}
    body.innerHTML = renderTabContent(currentTab);
    if (typeof window.lucide !== 'undefined') window.lucide.createIcons();
}

/**
 * 启动 ticker（main.js init 时调用）
 */
let tabRefreshTimer = null;
export function startShelterTabRefreshTimer() {
    if (tabRefreshTimer) return;
    // 每 5s 重新渲染一次当前 tab（用于训练倒计时实时更新）
    tabRefreshTimer = setInterval(() => {
        if (currentTab === 'training') {
            const body = document.getElementById('shelter-v2-body');
            if (body) body.innerHTML = renderTabContent('training');
        }
    }, 5000);
}

function renderShelterV2() {
    const body = document.getElementById('shelter-v2-body');
    if (!body) return;
    body.innerHTML = renderTabContent(currentTab);
}

/**
 * 渲染当前 tab 内容（统一入口）
 */
function renderTabContent(tab) {
    if (tab === 'evolution') {
        return `
            <div class="shelter-v2-section">
                <div class="shelter-v2-header">
                    <div class="shelter-v2-icon">🧬</div>
                    <div class="shelter-v2-title-block">
                        <div class="shelter-v2-title">进化所</div>
                        <div class="shelter-v2-subtitle">永久强化角色基因 · 不可逆</div>
                    </div>
                </div>
                ${renderEvolutionLabInfo()}
                <div class="shelter-v2-tip" style="margin-top:12px;font-size:11px;color:var(--text-secondary);line-height:1.6;">
                    💡 <strong>进化胶囊</strong>获取途径：
                    <br>· 商店购买（60 金币/颗）
                    <br>· 章节通关奖励（每章节 +1 颗）
                    <br>· 挂机产出（每 30 分钟 +1 颗）
                </div>
            </div>
        `;
    } else if (tab === 'powerplant') {
        return `
            <div class="shelter-v2-section">
                <div class="shelter-v2-header">
                    <div class="shelter-v2-icon">⚡</div>
                    <div class="shelter-v2-title-block">
                        <div class="shelter-v2-title">发电站</div>
                        <div class="shelter-v2-subtitle">提升离线收益 · 延长离线时间上限</div>
                    </div>
                </div>
                ${renderPowerPlantInfo()}
                <div class="shelter-v2-tip">
                    💡 <strong>高级能源</strong>获取：商店 200 金币/个 + 章节 Boss 战奖励
                </div>
            </div>
        `;
    } else if (tab === 'training') {
        return `
            <div class="shelter-v2-section">
                <div class="shelter-v2-header">
                    <div class="shelter-v2-icon">🏋</div>
                    <div class="shelter-v2-title-block">
                        <div class="shelter-v2-title">训练场</div>
                        <div class="shelter-v2-subtitle">3 方向永久属性 · 训练中不可取消</div>
                    </div>
                </div>
                ${renderTrainingGroundInfo()}
                <div class="shelter-v2-tip">
                    💡 <strong>训练手册</strong>获取：商店 100 金币/本 + 章节 Boss 战奖励
                </div>
            </div>
        `;
    } else if (tab === 'shoplevel') {
        return `
            <div class="shelter-v2-section">
                <div class="shelter-v2-header">
                    <div class="shelter-v2-icon">⭐</div>
                    <div class="shelter-v2-title-block">
                        <div class="shelter-v2-title">商店等级</div>
                        <div class="shelter-v2-subtitle">提升紫/金装备出现概率</div>
                    </div>
                </div>
                ${renderShopLevelInfo()}
                <div class="shelter-v2-tip">
                    💡 <strong>商店等级</strong>按账号自然成长：手动点按钮升级，消耗金币 + 后期材料
                </div>
            </div>
        `;
    }
    return '<div class="shelter-v2-placeholder">未知 tab</div>';
}

// ============================================================
// 桥接到 window
// ============================================================
window.openShelterV2 = openShelterV2;
window.closeShelterV2 = closeShelterV2;
window.switchShelterTab = switchShelterTab;
window.refreshShelterV2 = refreshShelterV2;
window.startShelterTabRefreshTimer = startShelterTabRefreshTimer;
