// ============================================================
//  src/systems/skillbooks.js
//  技能书系统（替代旧天赋树）
//
//  - 6 品质（白/绿/蓝/紫/金/红）
//  - 碎片获取：仅从商店（玩家已锁定：其他地方无法获取）
//  - 5 碎片 → 合成 1 本
//  - 金币升级（每级费用 1.5x 递增）
//  - 属性加成叠加到 BASE_HERO_STATS
// ============================================================

import { GameData, saveData, initNewFields } from '../data/gameData.js';
import { Renderer } from '../core/renderer.js';
import { SKILL_QUALITY, SKILL_QUALITY_ORDER, SKILL_BOOK_CATALOG, SKILL_BOOK_CONFIG }
    from '../data/config.js';
import { showToast } from '../ui/ui.js';

// ============================================================
// 公开 API
// ============================================================

/**
 * 加碎片（仅商店调用）
 */
export function addSkillShards(quality, skillId, count = 1) {
    initNewFields();
    const p = GameData.player;
    const key = `${quality}_${skillId}`;
    p.skillShards[key] = (p.skillShards[key] || 0) + count;
    saveData();
    showToast(`✨ +${count} ${SKILL_QUALITY[quality].name}·${findSkillName(skillId)} 碎片`, 'success');
}

/**
 * 合成技能书（5 碎片 = 1 本）
 * 同一 skillId + quality 只允许存在 1 本；如已有，提升等级上限
 */
export function synthesizeBook(quality, skillId) {
    initNewFields();
    const p = GameData.player;
    const key = `${quality}_${skillId}`;
    if (!p.skillShards[key] || p.skillShards[key] < SKILL_BOOK_CONFIG.shardsToBook) {
        showToast('碎片不足，无法合成', 'warning');
        return false;
    }
    p.skillShards[key] -= SKILL_BOOK_CONFIG.shardsToBook;
    const bookKey = `book_${skillId}_${quality}`;
    if (p.skillBooks[bookKey]) {
        // 已有同技能同品质 → 退 1 碎片（避免浪费）
        p.skillShards[key] += SKILL_BOOK_CONFIG.shardsToBook;
        showToast('已有同品质技能书，无法重复合成（碎片已退还）', 'warning');
        saveData();
        return false;
    }
    p.skillBooks[bookKey] = {
        skillId,
        quality,
        level: 1,           // 合成后默认 Lv.1
        createdAt: Date.now()
    };
    saveData();
    showToast(`🎉 合成 ${SKILL_QUALITY[quality].name}·${findSkillName(skillId)} Lv.1`, 'success');
    return true;
}

/**
 * 升级技能书（金币）
 */
export function upgradeSkillBook(bookKey) {
    initNewFields();
    const p = GameData.player;
    const book = p.skillBooks[bookKey];
    if (!book) {
        showToast('技能书不存在', 'error');
        return false;
    }
    if (book.level >= SKILL_BOOK_CONFIG.maxBookLevel) {
        showToast('已达最大等级', 'warning');
        return false;
    }
    const cost = Math.floor(
        SKILL_BOOK_CONFIG.upgradeCostBase *
        Math.pow(SKILL_BOOK_CONFIG.upgradeCostMul, book.level - 1)
    );
    if ((p.gold || 0) < cost) {
        showToast(`金币不足（需要 ${cost}）`, 'error');
        return false;
    }
    p.gold -= cost;
    book.level += 1;
    p.spentGoldOnBooks = (p.spentGoldOnBooks || 0) + cost;
    saveData();
    showToast(`⬆️ ${SKILL_QUALITY[book.quality].name}·${findSkillName(book.skillId)} Lv.${book.level}`, 'success');
    return true;
}

/**
 * 计算所有技能书累计属性（叠加给战斗）
 * 返回形如 { attack: 12, hp: 90, critRate: 4, ... }
 */
export function calculateSkillBookStats() {
    initNewFields();
    const p = GameData.player;
    const result = {
        attack: 0,
        hp: 0,
        defense: 0,
        critRate: 0,
        goldFind: 0,
        idleSpeed: 0,
        bossDmg: 0,
        attackSpeed: 0,
    };
    for (const bookKey in p.skillBooks) {
        const book = p.skillBooks[bookKey];
        const meta = SKILL_BOOK_CATALOG.find(s => s.id === book.skillId);
        if (!meta) continue;
        const quality = SKILL_QUALITY[book.quality];
        if (!quality) continue;
        // 数值 = baseVal * 品质倍数 * 等级
        const raw = meta.baseVal * quality.statMul * book.level;
        result[meta.statKey] = (result[meta.statKey] || 0) + raw;
    }
    return result;
}

/**
 * 列出所有可合成/可升级的技能书 + 碎片余额（用于 UI 渲染）
 */
export function listSkillBookView() {
    initNewFields();
    const p = GameData.player;
    const result = {
        books: [],
        shardSummary: []  // [{ quality, skillId, count, canSynth, qualityName, skillName }]
    };
    for (const key in p.skillBooks) {
        const book = p.skillBooks[key];
        const meta = SKILL_BOOK_CATALOG.find(s => s.id === book.skillId);
        if (!meta) continue;
        const q = SKILL_QUALITY[book.quality];
        result.books.push({
            bookKey: key,
            skillId: book.skillId,
            quality: book.quality,
            level: book.level,
            skillName: meta.name,
            qualityName: q.name,
            color: q.color,
            statKey: meta.statKey,
            baseVal: meta.baseVal,
            statMul: q.statMul,
            upgradeCost: Math.floor(
                SKILL_BOOK_CONFIG.upgradeCostBase *
                Math.pow(SKILL_BOOK_CONFIG.upgradeCostMul, book.level - 1)
            ),
        });
    }
    for (const key in p.skillShards) {
        // key 形如 `${quality}_${skillId}`，但 skillId 本身含下划线
        // （atk_power / crit_chance / gold_find / idle_speed / boss_dmg / skill_haste），
        // 所以只能切第一段，剩余部分整体作为 skillId，否则模板永远匹配不上，
        // 碎片列表会是空的、一键合成永远返回「暂无可合成碎片」。
        const sep = key.indexOf('_');
        if (sep < 0) continue;
        const quality = key.slice(0, sep);
        const skillId = key.slice(sep + 1);
        const meta = SKILL_BOOK_CATALOG.find(s => s.id === skillId);
        if (!meta || !SKILL_QUALITY[quality]) continue;
        const count = p.skillShards[key];
        result.shardSummary.push({
            quality,
            skillId,
            count,
            canSynth: count >= SKILL_BOOK_CONFIG.shardsToBook,
            qualityName: SKILL_QUALITY[quality].name,
            skillName: meta.name,
            color: SKILL_QUALITY[quality].color,
        });
    }
    return result;
}

/**
 * 一键合成所有可合成的碎片（按 quality 优先级：金 > 红 > 紫 > 蓝 > 绿 > 白）
 */
export function synthesizeAllPossible() {
    initNewFields();
    const view = listSkillBookView();
    const candidates = view.shardSummary
        .filter(s => s.canSynth)
        .sort((a, b) => SKILL_QUALITY_ORDER.indexOf(b.quality) - SKILL_QUALITY_ORDER.indexOf(a.quality));
    if (candidates.length === 0) {
        showToast('暂无可合成碎片', 'info');
        return 0;
    }
    let count = 0;
    for (const c of candidates) {
        // 检查是否已有同技能同品质
        const bookKey = `book_${c.skillId}_${c.quality}`;
        if (GameData.player.skillBooks[bookKey]) continue;
        if (synthesizeBook(c.quality, c.skillId)) count++;
    }
    return count;
}

/**
 * 计算当前章节可产出的碎片 shop 物品（供 shop.js 用）
 */
export function rollSkillShardItem() {
    // 商店刷出碎片时按品质权重抽
    const total = SKILL_QUALITY_ORDER.reduce((sum, q) => sum + SKILL_QUALITY[q].dropWeight, 0);
    let r = Math.random() * total;
    let chosenQuality = 'white';
    for (const q of SKILL_QUALITY_ORDER) {
        r -= SKILL_QUALITY[q].dropWeight;
        if (r <= 0) {
            chosenQuality = q;
            break;
        }
    }
    const meta = SKILL_BOOK_CATALOG[Math.floor(Math.random() * SKILL_BOOK_CATALOG.length)];
    return {
        type: 'shard',
        quality: chosenQuality,
        skillId: meta.id,
        skillName: meta.name,
        qualityName: SKILL_QUALITY[chosenQuality].name,
        color: SKILL_QUALITY[chosenQuality].color,
        count: 1,
        price: SHARD_PRICE(chosenQuality),  // 金币
    };
}

/**
 * 碎片商店价（金币，由品质决定）
 */
export function SHARD_PRICE(quality) {
    const map = { white: 30, green: 80, blue: 200, purple: 500, gold: 1500, red: 5000 };
    return map[quality] || 30;
}

// ============================================================
// 内部 helper
// ============================================================
function findSkillName(skillId) {
    const m = SKILL_BOOK_CATALOG.find(s => s.id === skillId);
    return m ? m.name : skillId;
}

// ============================================================
// 模态开关（供 main.js 桥接）
// ============================================================
export function openSkillBook() {
    const modal = document.getElementById('skillbook-modal');
    if (!modal) return;
    renderSkillBookUI();
    // 2026-10-28：改走 Renderer.showModal —— 玩家主动开弹窗时关掉自动剧情卡片和其它弹窗（互斥）
    Renderer.showModal('skillbook-modal');
    if (typeof window.lucide !== 'undefined') window.lucide.createIcons();
}
export function closeSkillBook() {
    const modal = document.getElementById('skillbook-modal');
    if (modal) modal.classList.remove('active');
}

/**
 * 渲染技能书 modal UI（写到 #skillbook-content）
 */
export function renderSkillBookUI() {
    const el = document.getElementById('skillbook-content');
    if (!el) return;
    const p = GameData.player;
    const view = listSkillBookView();

    let html = `
        <div style="padding:12px;">
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">
                💰 金币 <strong style="color:var(--gold);">${p.gold || 0}</strong> ·
                📚 已合成 <strong>${Object.keys(p.skillBooks).length}</strong> 本
            </div>
            <button class="btn btn-primary" style="width:100%;margin-bottom:12px;" onclick="window.synthAllShards()">🧪 一键合成可合成碎片</button>
    `;

    // 已合成技能书（可升级）
    if (view.books.length > 0) {
        html += `<div style="font-size:13px;color:var(--gold);margin-bottom:6px;">📚 已合成技能书</div>`;
        html += view.books.map(book => {
            const qMeta = SKILL_QUALITY[book.quality];
            const meta = SKILL_BOOK_CATALOG.find(s => s.id === book.skillId);
            const curStat = (meta.baseVal * book.statMul * book.level).toFixed(1);
            const nextStat = book.level < SKILL_BOOK_CONFIG.maxBookLevel
                ? (meta.baseVal * book.statMul * (book.level + 1)).toFixed(1) : '-';
            return `
                <div class="skillbook-card quality-${book.quality}" style="margin-bottom:8px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <div style="font-weight:600;color:${book.color};">${book.qualityName}·${book.skillName}</div>
                            <div style="font-size:11px;color:var(--text-secondary);">
                                Lv.${book.level}/${SKILL_BOOK_CONFIG.maxBookLevel} ·
                                +${curStat} ${meta.statKey}${nextStat !== '-' ? ' → ' + nextStat : ''}
                            </div>
                        </div>
                        <button class="btn btn-sm" style="background:var(--green);color:#000;"
                            ${book.level >= SKILL_BOOK_CONFIG.maxBookLevel ? 'disabled' : ''}
                            onclick="window.upgradeSkillBook('${book.bookKey}')">
                            ${book.level >= SKILL_BOOK_CONFIG.maxBookLevel ? '已满' : '升级 ' + book.upgradeCost + '金币'}
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        html += `<div style="color:var(--text-secondary);font-size:12px;padding:8px 0;">暂无已合成技能书 — 去商店购买碎片</div>`;
    }

    // 碎片状态
    if (view.shardSummary.length > 0) {
        html += `<div style="font-size:13px;color:var(--gold);margin:12px 0 6px;">💎 当前碎片库存</div>`;
        html += `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;">`;
        html += view.shardSummary.map(s => `
            <div class="skillbook-card quality-${s.quality}" style="padding:6px;font-size:11px;">
                <div style="color:${s.color};font-weight:600;">${s.qualityName}·${s.skillName}</div>
                <div>碎片 <strong>${s.count}</strong>/${SKILL_BOOK_CONFIG.shardsToBook}</div>
                ${s.canSynth
                    ? `<button class="btn btn-sm" style="background:var(--orange);color:#000;margin-top:4px;"
                        onclick="window.synthBook('${s.quality}','${s.skillId}')">合成</button>`
                    : `<div style="color:var(--text-secondary);">还差 ${SKILL_BOOK_CONFIG.shardsToBook - s.count} 个</div>`
                }
            </div>
        `).join('');
        html += `</div>`;
    }

    html += `</div>`;
    el.innerHTML = html;
}

// ============================================================
// window 桥接（HTML onclick 兼容）
// ============================================================
window.openSkillBook = openSkillBook;
window.closeSkillBook = closeSkillBook;
window.upgradeSkillBook = (bookKey) => {
    if (upgradeSkillBook(bookKey)) {
        renderSkillBookUI();
        try { window.updateUI && window.updateUI(); } catch (_) {}
    }
};
window.synthBook = (quality, skillId) => {
    if (synthesizeBook(quality, skillId)) {
        renderSkillBookUI();
        try { window.updateUI && window.updateUI(); } catch (_) {}
    }
};
window.synthAllShards = () => {
    const n = synthesizeAllPossible();
    if (n > 0) {
        renderSkillBookUI();
        try { window.updateUI && window.updateUI(); } catch (_) {}
    }
};
