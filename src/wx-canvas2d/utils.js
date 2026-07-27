/**
 * 微信小游戏 Canvas 2D 工具函数集
 *
 * 用法：
 *   const canvas = wx.createCanvas();
 *   const ctx = canvas.getContext('2d');
 *   CanvasUtils.drawRoundRect(ctx, 10, 10, 100, 50, 8);
 *
 * 提供：圆角矩形、文本工具、品质配色映射
 */

// ============ 品质配色（与游戏前端保持一致） ============
export const QUALITY_COLORS = {
    white:  { border: '#cccccc', glow: 'rgba(204,204,204,0.4)', text: '#dddddd', label: '劣质' },
    green:  { border: '#4caf50', glow: 'rgba(76,175,80,0.4)',   text: '#81c784', label: '普通' },
    blue:   { border: '#2196f3', glow: 'rgba(33,150,243,0.4)',  text: '#64b5f6', label: '优秀' },
    purple: { border: '#9c27b0', glow: 'rgba(156,39,176,0.4)',  text: '#ba68c8', label: '稀有' },
    orange: { border: '#ff9800', glow: 'rgba(255,152,0,0.4)',   text: '#ffb74d', label: '史诗' },
    red:    { border: '#f44336', glow: 'rgba(244,67,54,0.5)',   text: '#e57373', label: '传说' }
};

// ============ 装备类型图标（与游戏前端保持一致） ============
export const EQUIP_TYPE_ICONS = {
    weapon:    '🗡️',
    armor:     '🛡️',
    head:      '⛑️',
    clothes:   '👕',
    cloak:     '🦺',
    boots:     '👢',
    ring:      '💍',
    amulet:    '🧿',
    accessory: '🎀'
};

// ============ 装备类型中文名 ============
export const EQUIP_TYPE_NAMES = {
    weapon:    '武器',
    armor:     '防具',
    head:      '头盔',
    clothes:   '衣服',
    cloak:     '披风',
    boots:     '鞋',
    ring:      '戒指',
    amulet:    '护符',
    accessory: '饰品'
};

// ============ 属性定义顺序与图标 ============
export const STAT_DEFS = [
    { key: 'baseAttack',    icon: '⚔️', label: '攻击', suffix: '',  color: '#ff9800' },
    { key: 'baseDefense',   icon: '🛡️', label: '防御', suffix: '',  color: '#2196f3' },
    { key: 'baseHp',        icon: '❤️', label: '生命', suffix: '',  color: '#f44336' },
    { key: 'baseCritRate',  icon: '⚡', label: '暴击', suffix: '%', color: '#ffc107' },
    { key: 'baseCritDamage',icon: '💥', label: '爆伤', suffix: '%', color: '#ff9800' },
    { key: 'baseLifeSteal', icon: '🩸', label: '吸血', suffix: '%', color: '#f44336' },
    { key: 'baseCombo',     icon: '🔗', label: '连击', suffix: '%', color: '#9c27b0' }
];

export const CanvasUtils = {
    /**
     * 绘制圆角矩形（带描边 + 填充，可选）
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} x 左上角 X
     * @param {number} y 左上角 Y
     * @param {number} w 宽
     * @param {number} h 高
     * @param {number} r 圆角半径
     * @param {object} opts { fill, stroke, strokeWidth, shadow }
     */
    drawRoundRect(ctx, x, y, w, h, r, opts = {}) {
        const { fill, stroke, strokeWidth = 1, shadow } = opts;
        ctx.save();
        if (shadow) {
            ctx.shadowColor = shadow.color || 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = shadow.blur || 8;
            ctx.shadowOffsetX = shadow.offsetX || 0;
            ctx.shadowOffsetY = shadow.offsetY || 4;
        }
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.arcTo(x + w, y, x + w, y + r, r);
        ctx.lineTo(x + w, y + h - r);
        ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.lineTo(x + r, y + h);
        ctx.arcTo(x, y + h, x, y + h - r, r);
        ctx.lineTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.closePath();
        if (fill) {
            ctx.fillStyle = fill;
            ctx.fill();
        }
        if (stroke) {
            ctx.lineWidth = strokeWidth;
            ctx.strokeStyle = stroke;
            ctx.stroke();
        }
        ctx.restore();
    },

    /**
     * 绘制单行文本（自动水平居中/左/右对齐）
     * @param {CanvasRenderingContext2D} ctx
     * @param {string} text
     * @param {number} x
     * @param {number} y
     * @param {object} opts { font, color, align, baseline, maxWidth }
     */
    drawText(ctx, text, x, y, opts = {}) {
        const {
            font = '14px sans-serif',
            color = '#ffffff',
            align = 'left',
            baseline = 'top',
            maxWidth
        } = opts;
        ctx.save();
        ctx.font = font;
        ctx.fillStyle = color;
        ctx.textAlign = align;
        ctx.textBaseline = baseline;
        if (maxWidth) {
            // 微信小游戏 Canvas 2D 也支持 measureText + 截断
            const metrics = ctx.measureText(text);
            if (metrics.width > maxWidth) {
                let truncated = text;
                while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
                    truncated = truncated.slice(0, -1);
                }
                text = truncated + '...';
            }
        }
        ctx.fillText(text, x, y);
        ctx.restore();
    },

    /**
     * 绘制文字描边（用于标题突出）
     * @param {CanvasRenderingContext2D} ctx
     * @param {string} text
     * @param {number} x
     * @param {number} y
     * @param {object} opts { font, color, strokeColor, strokeWidth, align, baseline }
     */
    drawTextWithStroke(ctx, text, x, y, opts = {}) {
        const {
            font = 'bold 18px sans-serif',
            color = '#ffffff',
            strokeColor = '#000000',
            strokeWidth = 2,
            align = 'left',
            baseline = 'top'
        } = opts;
        ctx.save();
        ctx.font = font;
        ctx.textAlign = align;
        ctx.textBaseline = baseline;
        ctx.lineWidth = strokeWidth;
        ctx.strokeStyle = strokeColor;
        ctx.strokeText(text, x, y);
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
        ctx.restore();
    },

    /**
     * 测量文本宽度
     */
    measureText(ctx, text, font = '14px sans-serif') {
        ctx.save();
        ctx.font = font;
        const width = ctx.measureText(text).width;
        ctx.restore();
        return width;
    }
};