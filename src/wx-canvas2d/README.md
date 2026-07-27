# 微信小游戏 Canvas 2D · 装备面板组件

> 可直接复制到微信开发者工具项目里用的独立组件，**不依赖游戏业务代码**。

---

## 📦 文件清单

| 文件 | 职责 |
|---|---|
| `utils.js` | 工具函数（圆角矩形、文字、品质配色、属性定义）|
| `equip-panel.js` | `EquipPanel` 主类（圆角背景 + 品质边框 + 标题 + 词条）|
| `demo.js` | 完整 demo（3 件装备 + 触摸切换）|

---

## 🚀 快速接入

### 1. 复制文件
把 `src/wx-canvas2d/` 整个目录复制到你的微信小游戏项目里。

### 2. 在 game.js 引入
```js
import './wx-canvas2d/demo.js';  // 启动 demo
```

### 3. 在你的游戏代码里使用
```js
import { EquipPanel } from './wx-canvas2d/equip-panel.js';

// 在主循环里
const canvas = wx.createCanvas();
const ctx = canvas.getContext('2d');

// 1. 清屏 + 背景
ctx.fillStyle = '#000000';
ctx.fillRect(0, 0, canvas.width, canvas.height);

// 2. 渲染装备面板
const panel = new EquipPanel(ctx, 20, 100, 320);
panel.render({
    name: '屠龙宝刀',
    level: 50,
    quality: 'red',
    type: 'weapon',
    desc: '传说中的神器',
    baseAttack: 188,
    baseCritRate: 15,
    baseLifeSteal: 8
});
```

---

## 📋 装备 JSON 数据结构

```js
{
    id: 'weapon_red_001',           // 唯一 ID
    name: '屠龙宝刀',                // 装备名
    level: 50,                       // 等级
    quality: 'red',                  // 品质：white/green/blue/purple/orange/red
    type: 'weapon',                  // 类型：weapon/armor/head/clothes/cloak/boots/ring/amulet/accessory
    desc: '传说中的神器',             // 描述（可选，自动换行）

    // 7 个属性（没有就传 0 或省略）
    baseAttack: 188,                 // 攻击
    baseDefense: 30,                 // 防御
    baseHp: 100,                     // 生命
    baseCritRate: 15,                // 暴击（%）
    baseCritDamage: 80,              // 爆伤（%）
    baseLifeSteal: 8,                // 吸血（%）
    baseCombo: 12,                   // 连击（%）

    equipped: true                   // 是否已装备（可选，true 时右上角显示✓已装备）
}
```

---

## 🎨 6 种品质配色

| 品质 | 标签 | 边框色 | 文字色 |
|---|---|---|---|
| `white` | 劣质 | `#cccccc` | `#dddddd` |
| `green` | 普通 | `#4caf50` | `#81c784` |
| `blue` | 优秀 | `#2196f3` | `#64b5f6` |
| `purple` | 稀有 | `#9c27b0` | `#ba68c8` |
| `orange` | 史诗 | `#ff9800` | `#ffb74d` |
| `red` | 传说 | `#f44336` | `#e57373` |

边框色 + 文字色 + 外发光（rgba 0.4 透明度）整套配色与游戏前端保持一致。

---

## 🧱 面板布局

```
┌────────────────────────────┐
│ ▓▓▓▓▓▓▓ 品质渐变条 ▓▓▓▓▓▓▓ │  ← 3px 品质色
│ 🗡️  屠龙宝刀      武器·传说 │
│     Lv.50                  │  ← TITLE_HEIGHT=56
├────────────────────────────┤
│ "  传说中的神器            │  ← 描述区（自动换行 + 金边竖线）
├────────────────────────────┤
│ ⚔️ 攻击            +188  │
│ 🛡️ 防御             +30  │  ← 属性行（每行 32px）
│ ❤️ 生命            +100  │     仅显示 >0 的属性
│ ⚡ 暴击             +15% │     无属性显示"无附加属性"
│ 💥 爆伤             +80% │
│ 🩸 吸血              +8% │
│ 🔗 连击             +12% │
└────────────────────────────┘
```

**自适应高度**：面板高度根据属性行数自动计算，最小 180px。
使用 `panel.getHeight(equip)` 获取实际高度，用于垂直堆叠布局。

---

## ⚙️ API 参考

### `new EquipPanel(ctx, x, y, width)`
```js
const panel = new EquipPanel(ctx, 20, 100, 320);
```

### `panel.render(equip, opts?)`
```js
const height = panel.render(equip, {
    showDesc: true,        // 默认 true，是否显示描述
    showStats: true,       // 默认 true，是否显示属性行
    emptyMessage: '没有装备'  // 装备为 null 时显示
});
// 返回实际渲染高度（像素）
```

### `panel.getHeight(equip, opts?)`
```js
const h = panel.getHeight(equip);  // 不渲染，仅计算高度
```

### `panel.x / panel.y / panel.width`
可运行时修改位置（用于滚动列表、动画移动）。

---

## 🔄 与 DOM 版（src/ui/modals.js）的差异

| 项 | DOM 版 | Canvas 2D 版 |
|---|---|---|
| **入口** | `showEquipDetail(type, index)` | `new EquipPanel(ctx, x, y, w).render(equip)` |
| **事件** | onclick="..." | `wx.onTouchStart` + 命中测试 |
| **动画** | CSS transition | ctx 帧循环（需自己实现）|
| **数据源** | `GameData.player.bag` | 外部传入 equip 对象 |
| **样式调整** | 改 CSS | 改 utils.js 配色或 equip-panel.js 布局常量 |

---

## 🐛 已知问题

| 问题 | 备注 |
|---|---|
| 文字测量精度 | 微信小游戏 Canvas 字体与 measureText 略有偏差，建议留 10% 余量 |
| emoji 字体 | 部分微信小游戏环境 emoji 渲染不一致，可改用图片资源 |
| 触摸命中 | demo 的 hitTest 是简单矩形检测，复杂形状需自己实现 |

---

## 📝 微信小游戏 Canvas 2D API 注意事项

1. **创建 canvas**：`wx.createCanvas()` 返回的 canvas 直接可用
2. **DPI 适配**：`wx.getSystemInfoSync().pixelRatio` × 设计稿尺寸
3. **触摸事件**：`wx.onTouchStart` 的 `touches` 数组是真实坐标（已 DPI 适配）
4. **字体**：`ctx.font = '14px sans-serif'` 微信小游戏支持系统字体
5. **导出图片**：`canvas.toTempFilePath()` 可保存为本地图片

---

_Last updated: 2026-07-27_