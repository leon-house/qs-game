/**
 * 装备面板 Canvas 2D Demo（微信小游戏入口）
 *
 * 在微信开发者工具中：
 *   game.js 引入 './wx-canvas2d/demo.js' 即可启动 demo
 *
 * 功能：
 *   - 渲染 3 件不同品质的装备面板（白/紫/红）
 *   - 触摸点击切换高亮装备
 *   - 演示品质边框 + 词条文字
 */

import { EquipPanel } from './equip-panel.js';

// ============ 测试装备数据 ============
const EQUIP_LIST = [
    {
        id: 'weapon_white_001',
        name: '破铁剑',
        level: 1,
        quality: 'white',
        type: 'weapon',
        desc: '一根普通的铁剑，已经有些生锈。',
        baseAttack: 8,
        baseDefense: 0,
        baseHp: 0
    },
    {
        id: 'armor_purple_001',
        name: '暗影战甲',
        level: 12,
        quality: 'purple',
        type: 'armor',
        desc: '蕴含远古力量的铠甲，散发着幽紫色的光芒。穿戴者将获得强大的防御能力，并能在黑暗中隐身。',
        baseAttack: 5,
        baseDefense: 45,
        baseHp: 200,
        baseCritRate: 3,
        baseLifeSteal: 2
    },
    {
        id: 'weapon_red_001',
        name: '屠龙宝刀',
        level: 50,
        quality: 'red',
        type: 'weapon',
        desc: '传说中的神器，曾斩杀过远古巨龙，刀身仍残留着龙血。',
        baseAttack: 188,
        baseDefense: 30,
        baseHp: 100,
        baseCritRate: 15,
        baseCritDamage: 80,
        baseLifeSteal: 8,
        baseCombo: 12,
        equipped: true
    }
];

// ============ 微信小游戏入口 ============
class EquipPanelDemo {
    constructor() {
        this.canvas = wx.createCanvas();
        this.ctx = this.canvas.getContext('2d');

        // 全屏适配：使用微信 API 获取屏幕尺寸
        const sysInfo = wx.getSystemInfoSync();
        this.canvas.width = sysInfo.windowWidth * sysInfo.pixelRatio;
        this.canvas.height = sysInfo.windowHeight * sysInfo.pixelRatio;
        this.ctx.scale(sysInfo.pixelRatio, sysInfo.pixelRatio);

        this.screenW = sysInfo.windowWidth;
        this.screenH = sysInfo.windowHeight;
        this.scale = sysInfo.pixelRatio;

        this.equipList = EQUIP_LIST;
        this.selectedIndex = 1;  // 默认选中紫色装备

        // 创建面板实例（每个面板占满宽度）
        this.panelW = this.screenW - 32;  // 左右各留 16px 边距
        this.panelX = 16;
        this.panels = EQUIP_LIST.map((_, i) =>
            new EquipPanel(this.ctx, this.panelX, 0, this.panelW)
        );

        // 计算每个面板的 Y 位置
        this.layoutPanels();

        // 绑定触摸
        this.bindEvents();

        // 启动主循环（按需重绘：默认只画一次）
        this.render();
    }

    /**
     * 计算每个面板的 Y 位置（垂直堆叠 + 间距）
     */
    layoutPanels() {
        const GAP = 12;
        let y = 80;  // 顶部留空（标题区）
        this.panelY = [];
        for (let i = 0; i < this.equipList.length; i++) {
            this.panelY.push(y);
            const h = this.panels[i].getHeight(this.equipList[i]);
            y += h + GAP;
        }
    }

    /**
     * 绑定触摸事件
     */
    bindEvents() {
        wx.onTouchStart((e) => {
            const touches = e.touches || [e];
            for (const touch of touches) {
                this.handleTap(touch.clientX, touch.clientY);
            }
        });
    }

    /**
     * 处理点击：判断点击了哪个面板
     */
    handleTap(tx, ty) {
        for (let i = 0; i < this.equipList.length; i++) {
            const py = this.panelY[i];
            const h = this.panels[i].getHeight(this.equipList[i]);
            if (ty >= py && ty <= py + h) {
                this.selectedIndex = i;
                this.render();
                break;
            }
        }
    }

    /**
     * 渲染整个屏幕
     */
    render() {
        const ctx = this.ctx;

        // === 1. 背景渐变 ===
        const bg = ctx.createLinearGradient(0, 0, 0, this.screenH);
        bg.addColorStop(0, '#0a0a14');
        bg.addColorStop(1, '#1a1a2e');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, this.screenW, this.screenH);

        // === 2. 顶部标题 ===
        ctx.save();
        ctx.font = 'bold 20px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('⚔️ 我的装备', this.screenW / 2, 20);

        ctx.font = '11px sans-serif';
        ctx.fillStyle = '#888888';
        ctx.fillText('点击装备面板切换选中', this.screenW / 2, 50);
        ctx.restore();

        // === 3. 渲染所有装备面板 ===
        for (let i = 0; i < this.equipList.length; i++) {
            // 选中面板加高亮背景
            if (i === this.selectedIndex) {
                ctx.save();
                ctx.fillStyle = 'rgba(255,255,255,0.03)';
                ctx.fillRect(0, this.panelY[i] - 4, this.screenW,
                    this.panels[i].getHeight(this.equipList[i]) + 8);
                ctx.restore();
            }
            this.panels[i].x = this.panelX;
            this.panels[i].y = this.panelY[i];
            this.panels[i].render(this.equipList[i]);
        }

        // === 4. 底部提示 ===
        ctx.save();
        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#555555';
        ctx.textAlign = 'center';
        ctx.fillText(
            `当前选中：${EQUIP_LIST[this.selectedIndex].name} (${EQUIP_LIST[this.selectedIndex].quality})`,
            this.screenW / 2,
            this.screenH - 20
        );
        ctx.restore();
    }
}

// ============ 启动 ============
new EquipPanelDemo();