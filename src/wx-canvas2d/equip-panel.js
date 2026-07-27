/**
 * 装备面板 Canvas 2D 渲染组件（微信小游戏）
 *
 * 用法：
 *   import { EquipPanel } from './equip-panel.js';
 *   const canvas = wx.createCanvas();
 *   const ctx = canvas.getContext('2d');
 *   const panel = new EquipPanel(ctx, 20, 100, 320);
 *   panel.render(equipData);
 *
 * 装备 JSON 数据结构（与游戏前端一致）：
 *   {
 *     id: 'weapon_xxx',
 *     name: '混沌剑',
 *     level: 5,
 *     quality: 'purple',                  // white/green/blue/purple/orange/red
 *     type: 'weapon',                     // 9 种装备类型
 *     desc: '蕴含远古力量的剑',
 *     baseAttack: 50,
 *     baseDefense: 10,
 *     baseHp: 100,
 *     baseCritRate: 10,
 *     baseCritDamage: 50,
 *     baseLifeSteal: 5,
 *     baseCombo: 8
 *   }
 */

import {
    CanvasUtils,
    QUALITY_COLORS,
    EQUIP_TYPE_ICONS,
    EQUIP_TYPE_NAMES,
    STAT_DEFS
} from './utils.js';

// 布局常量
const PADDING = 16;
const TITLE_HEIGHT = 56;
const DESC_LINE_HEIGHT = 18;
const STAT_ROW_HEIGHT = 32;
const STAT_ROW_GAP = 4;
const SECTION_GAP = 8;
const MIN_HEIGHT = 180;

export class EquipPanel {
    /**
     * @param {CanvasRenderingContext2D} ctx 微信 Canvas 2D 上下文
     * @param {number} x 左上角 X
     * @param {number} y 左上角 Y
     * @param {number} width 面板宽度
     */
    constructor(ctx, x, y, width) {
        this.ctx = ctx;
        this.x = x;
        this.y = y;
        this.width = width;
        this._lastHeight = MIN_HEIGHT;
    }

    /**
     * 计算面板实际高度（用于后续布局堆叠）
     * @param {object} equip
     * @returns {number}
     */
    getHeight(equip) {
        return this._calcHeight(equip);
    }

    /**
     * 渲染装备面板
     * @param {object} equip 装备 JSON 数据
     * @param {object} [opts] 渲染选项
     *   - showDesc {boolean} 是否显示描述（默认 true）
     *   - showStats {boolean} 是否显示属性（默认 true）
     *   - emptyMessage {string} 装备为 null 时显示的文字
     * @returns {number} 实际渲染高度
     */
    render(equip, opts = {}) {
        const {
            showDesc = true,
            showStats = true,
            emptyMessage = '没有装备'
        } = opts;

        const ctx = this.ctx;
        const x = this.x;
        const y = this.y;
        const w = this.width;

        // === 空状态 ===
        if (!equip) {
            const emptyH = 80;
            CanvasUtils.drawRoundRect(ctx, x, y, w, emptyH, 12, {
                fill: 'rgba(30,30,30,0.95)',
                stroke: 'rgba(255,255,255,0.15)',
                strokeWidth: 1,
                shadow: { color: 'rgba(0,0,0,0.4)', blur: 8, offsetY: 3 }
            });
            CanvasUtils.drawText(ctx, emptyMessage, x + w / 2, y + emptyH / 2, {
                font: '14px sans-serif',
                color: '#888888',
                align: 'center',
                baseline: 'middle'
            });
            this._lastHeight = emptyH;
            return emptyH;
        }

        const qColor = QUALITY_COLORS[equip.quality] || QUALITY_COLORS.white;
        const h = this._calcHeight(equip, { showDesc, showStats });
        this._lastHeight = h;

        // === 1. 底层阴影 + 背景圆角矩形 ===
        CanvasUtils.drawRoundRect(ctx, x + 2, y + 3, w - 4, h - 3, 12, {
            fill: 'rgba(0,0,0,0.55)',
            shadow: { color: qColor.glow, blur: 16, offsetY: 0 }
        });

        // === 2. 主体背景（深色半透明） ===
        CanvasUtils.drawRoundRect(ctx, x, y, w, h, 12, {
            fill: 'rgba(20,20,30,0.96)',
            stroke: qColor.border,
            strokeWidth: 2
        });

        // === 3. 品质高亮条（顶部 4px 渐变条）===
        const gradient = ctx.createLinearGradient(x, y, x + w, y);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(0.5, qColor.border);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.save();
        ctx.fillStyle = gradient;
        ctx.fillRect(x + 12, y, w - 24, 3);
        ctx.restore();

        // === 4. 标题区（图标 + 名字 + 等级 + 品质） ===
        let cursorY = y + PADDING;
        const icon = EQUIP_TYPE_ICONS[equip.type] || '📦';
        const typeName = EQUIP_TYPE_NAMES[equip.type] || equip.type || '装备';
        const qualityLabel = qColor.label;

        // 类型图标（左侧）
        ctx.save();
        ctx.font = '32px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(icon, x + PADDING, cursorY);
        ctx.restore();

        // 装备名称 + 等级
        CanvasUtils.drawTextWithStroke(
            ctx,
            `${equip.name || '未知道装备'}`,
            x + PADDING + 44,
            cursorY + 2,
            { font: 'bold 18px sans-serif', color: qColor.text, strokeWidth: 1 }
        );

        CanvasUtils.drawText(
            ctx,
            `Lv.${equip.level || 1}`,
            x + PADDING + 44,
            cursorY + 24,
            { font: '11px sans-serif', color: '#aaaaaa' }
        );

        // 右侧品质标签
        const qualityText = `${typeName} · ${qualityLabel}`;
        const qualityTextWidth = CanvasUtils.measureText(ctx, qualityText, '11px sans-serif');
        CanvasUtils.drawText(
            ctx,
            qualityText,
            x + w - PADDING - qualityTextWidth,
            cursorY + 6,
            { font: '11px sans-serif', color: qColor.text }
        );

        cursorY += TITLE_HEIGHT;

        // === 5. 描述区（可选） ===
        if (showDesc && equip.desc) {
            // 分隔线
            ctx.save();
            ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x + PADDING, cursorY);
            ctx.lineTo(x + w - PADDING, cursorY);
            ctx.stroke();
            ctx.restore();
            cursorY += SECTION_GAP;

            // 描述文字（自动换行）
            const descMaxWidth = w - PADDING * 2;
            const descLines = this._wrapText(equip.desc, descMaxWidth, '12px sans-serif');
            const descBgHeight = descLines.length * DESC_LINE_HEIGHT + 12;
            CanvasUtils.drawRoundRect(ctx, x + PADDING, cursorY, w - PADDING * 2, descBgHeight, 6, {
                fill: 'rgba(0,0,0,0.35)'
            });
            // 左侧金边竖线
            ctx.save();
            ctx.fillStyle = '#ffc107';
            ctx.fillRect(x + PADDING, cursorY, 3, descBgHeight);
            ctx.restore();

            descLines.forEach((line, i) => {
                CanvasUtils.drawText(ctx, line, x + PADDING + 12, cursorY + 6 + i * DESC_LINE_HEIGHT, {
                    font: 'italic 12px sans-serif',
                    color: '#bbbbbb'
                });
            });
            cursorY += descBgHeight + SECTION_GAP;
        }

        // === 6. 属性行（多行） ===
        if (showStats) {
            const stats = equip.stats || this._extractStats(equip);
            const visibleStats = STAT_DEFS.filter(def => (stats[def.key] || 0) > 0);

            if (visibleStats.length === 0) {
                // 无属性
                CanvasUtils.drawText(ctx, '无附加属性', x + w / 2, cursorY + STAT_ROW_HEIGHT / 2, {
                    font: '12px sans-serif',
                    color: '#666666',
                    align: 'center',
                    baseline: 'middle'
                });
                cursorY += STAT_ROW_HEIGHT;
            } else {
                visibleStats.forEach((def, i) => {
                    const value = stats[def.key];
                    const rowY = cursorY + i * (STAT_ROW_HEIGHT + STAT_ROW_GAP);

                    // 行底色
                    CanvasUtils.drawRoundRect(ctx, x + PADDING, rowY, w - PADDING * 2, STAT_ROW_HEIGHT, 6, {
                        fill: 'rgba(255,255,255,0.04)'
                    });

                    // 图标 + 标签（左侧）
                    CanvasUtils.drawText(
                        ctx,
                        `${def.icon} ${def.label}`,
                        x + PADDING + 10,
                        rowY + STAT_ROW_HEIGHT / 2,
                        { font: '13px sans-serif', color: '#cccccc', baseline: 'middle' }
                    );

                    // 数值（右侧）
                    CanvasUtils.drawText(
                        ctx,
                        `+${value}${def.suffix}`,
                        x + w - PADDING - 10,
                        rowY + STAT_ROW_HEIGHT / 2,
                        { font: 'bold 14px sans-serif', color: def.color, align: 'right', baseline: 'middle' }
                    );
                });
                cursorY += visibleStats.length * (STAT_ROW_HEIGHT + STAT_ROW_GAP);
            }
        }

        cursorY += PADDING;

        // === 7. 底部已装备徽章（可选）===
        if (equip.equipped) {
            const badgeW = 60;
            const badgeH = 20;
            const badgeX = x + w - PADDING - badgeW;
            const badgeY = y + PADDING + 30;
            CanvasUtils.drawRoundRect(ctx, badgeX, badgeY, badgeW, badgeH, 4, {
                fill: 'rgba(74,222,128,0.18)',
                stroke: '#4ade80',
                strokeWidth: 1
            });
            CanvasUtils.drawText(ctx, '✓ 已装备', badgeX + badgeW / 2, badgeY + badgeH / 2, {
                font: '11px sans-serif',
                color: '#4ade80',
                align: 'center',
                baseline: 'middle'
            });
        }

        return cursorY - y;
    }

    /**
     * 计算面板高度（内部用）
     */
    _calcHeight(equip, opts = {}) {
        if (!equip) return 80;
        const { showDesc = true, showStats = true } = opts;

        let h = PADDING + TITLE_HEIGHT;
        if (showDesc && equip.desc) {
            const descMaxWidth = this.width - PADDING * 2;
            const lines = this._wrapText(equip.desc, descMaxWidth, '12px sans-serif');
            h += SECTION_GAP + lines.length * DESC_LINE_HEIGHT + 12 + SECTION_GAP;
        }
        if (showStats) {
            const stats = equip.stats || this._extractStats(equip);
            const visibleCount = STAT_DEFS.filter(def => (stats[def.key] || 0) > 0).length;
            const rows = Math.max(visibleCount, 1);  // 至少 1 行（无属性占位）
            h += rows * (STAT_ROW_HEIGHT + STAT_ROW_GAP);
        }
        h += PADDING;
        return Math.max(h, MIN_HEIGHT);
    }

    /**
     * 提取装备属性（兼容多种数据格式）
     */
    _extractStats(equip) {
        return {
            baseAttack: equip.baseAttack || equip.attack || 0,
            baseDefense: equip.baseDefense || equip.defense || 0,
            baseHp: equip.baseHp || equip.hp || 0,
            baseCritRate: equip.baseCritRate || equip.critRate || 0,
            baseCritDamage: equip.baseCritDamage || equip.critDamage || 0,
            baseLifeSteal: equip.baseLifeSteal || equip.lifeSteal || 0,
            baseCombo: equip.baseCombo || equip.combo || 0
        };
    }

    /**
     * 文字自动换行（按宽度估算）
     */
    _wrapText(text, maxWidth, font) {
        if (!text) return [];
        const ctx = this.ctx;
        ctx.save();
        ctx.font = font;
        const lines = [];
        let line = '';
        for (let i = 0; i < text.length; i++) {
            const testLine = line + text[i];
            if (ctx.measureText(testLine).width > maxWidth && line.length > 0) {
                lines.push(line);
                line = text[i];
            } else {
                line = testLine;
            }
        }
        if (line) lines.push(line);
        ctx.restore();
        return lines;
    }
}