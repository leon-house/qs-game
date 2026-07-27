# 末世幸存者 · 挂机肉鸽 H5

> 末日废土题材的挂机放置类 H5 游戏，4v4 自动战斗，支持微信/抖音小游戏迁移。

![version](https://img.shields.io/badge/version-active-blue) ![tests](https://img.shields.io/badge/tests-100%25_pass-green) ![license](https://img.shields.io/badge/license-proprietary-red)

---

## 🎮 在线试玩

| 地址 | 用途 |
|---|---|
| **http://106.54.31.70:8080/** | 主服务器（腾讯云 Ubuntu，nginx 静态部署）|
| ~~https://6396787adb2f4c9bb9afc8f137a04943.app.codebuddy.work~~ | 临时 CloudStudio 预览（已弃用）|

> 部署提示：80 端口的 nginx default vhost 502 是上游问题，**不影响 8080 端口的游戏访问**。

---

## 🧰 技术栈

| 类型 | 选型 |
|---|---|
| **运行时** | 浏览器原生（无需 Node.js / 后端）|
| **语言** | HTML + ES Modules JavaScript + Sass / CSS |
| **样式** | 自写 CSS（25xx 行），暗色废土主题 |
| **图标** | Lucide Icons (CDN) + emoji 回退 |
| **数据存储** | `localStorage`（已抽象 Storage Adapter，可换 wx.setStorageSync）|
| **打包** | **无** — 纯 ES Modules，浏览器原生 import |
| **服务器** | 任意静态 HTTP server（项目用 nginx）|
| **部署目标** | H5 + 微信小程序 + 抖音小游戏 |

---

## 📐 架构总览

```
┌────────────────────────────────────────────────────────┐
│                    浏览器 / 小游戏                      │
│                                                        │
│   index.html ──► src/main.js (入口)                    │
│                       │                                │
│   ┌───────────────────┼────────────────────────┐      │
│   │                   │                        │      │
│   ▼                   ▼                        ▼      │
│ ┌─────────┐    ┌─────────────────┐    ┌─────────────┐ │
│ │ core/   │    │   systems/      │    │  ui/        │ │
│ │ 适配层   │    │   业务系统       │    │  渲染层      │ │
│ └─────────┘    └─────────────────┘    └─────────────┘ │
│   │ storage           │ battle           │ modals     │
│   │ renderer          │ stage            │ ui         │
│   │ events            │ equipment        │            │
│   │ ui-utils          │ 16 个其他系统     │            │
│ │                   ▼                        │       │
│ │              ┌──────────┐                  │       │
│ │              │ data/    │                  │       │
│ │              │ 配置+状态 │                  │       │
│ │              └──────────┘                  │       │
│ └──────────────────────────────────────────────────────┘
                          │
                          ▼
                  ┌──────────────┐
                  │  localStorage │
                  │  / WX Storage │
                  └──────────────┘
```

**设计原则**：
1. **零打包** — 浏览器原生 ES Modules，修改即生效
2. **适配层隔离** — Storage / Renderer / Events 都抽象了平台，未来切 Canvas / 微信存储只改适配层
3. **状态集中** — `data/gameData.js` 是单一数据源，所有 UI 从这里读
4. **事件驱动** — 战斗/挂机用 setInterval + 自定义事件，迁移到小游戏时只换调度器

---

## 🗂️ 目录结构

```
qs-game/
├── index.html              # 入口（512 行，含 11 个 modal + 装备栏 + 战斗区 + 底部导航）
├── style.css               # 全局样式（2574 行，含末世主题 + 11 个弹窗样式）
├── README.md               # 本文件
├── package.json            # 依赖声明（部署用，dev 仅 esbuild/ssh2）
│
├── src/                    # 游戏代码（4294 行，27 个 .js 模块）
│   ├── main.js             # 入口（134 行）+ window.* 暴露（52 个函数）
│   │
│   ├── core/               # ★ 平台适配层（4 文件）
│   │   ├── storage.js      # localStorage ↔ WX setStorageSync
│   │   ├── renderer.js     # DOM ↔ Canvas 2D（含孤儿节点缓存验证）
│   │   ├── events.js       # setInterval ↔ 小游戏主循环
│   │   └── ui-utils.js     # formatNumber / escapeHtml 等
│   │
│   ├── data/               # ★ 配置 + 状态（2 文件）
│   │   ├── config.js       # 装备/怪物/材料/角色/技能配置
│   │   └── gameData.js     # 玩家运行时状态（存档根）
│   │
│   ├── systems/            # 业务系统（21 文件，每个 ~50-200 行）
│   │   ├── battle.js       # 战斗核心（手动攻击/自动战斗/技能/治疗）
│   │   ├── stage.js        # 关卡（50 怪 1 Boss 循环）
│   │   ├── equipment.js    # 装备（9 部位 + 6 品质 + 随机属性）
│   │   ├── heroes.js       # 4v4 英雄编队
│   │   ├── talent.js       # 天赋树
│   │   ├── idle.js         # 挂机收益
│   │   ├── expedition.js   # 远征（探索派遣）
│   │   ├── dungeons.js     # 副本（6 普通/精英）
│   │   ├── chapter.js      # 章节进度（10 章）
│   │   ├── story.js        # 剧情（10 章故事）
│   │   ├── character.js    # 角色选择（4 幸存者）
│   │   ├── achievements.js # 成就系统
│   │   ├── tasks.js        # 每日任务
│   │   ├── checkin.js      # 每日签到
│   │   ├── shop.js         # 商店
│   │   ├── shelter.js      # 庇护所（基地升级）
│   │   ├── collection.js   # 图鉴（已收集装备/怪物/材料/宝石）
│   │   ├── buildings.js    # 庇护所内部建筑
│   │   ├── events.js       # 随机事件（宝箱/商人/突袭/治愈）
│   │   └── …               # 详见文件列表
│   │
│   └── ui/                 # UI 渲染层（2 文件）
│       ├── modals.js       # 11 个弹窗（属性/背包/商店/庇护所/签到/任务/成就/章节/副本/角色/剧情）
│       └── ui.js           # 主界面 HUD（资源/战力/经验/等级）
│
└── assets/images/          # 末世风格资源（25 张 PNG，总 ~5MB）
    ├── bg.png              # 主背景（废土城市）
    ├── boss.png            # Boss 立绘
    ├── hero.png            # 英雄静态图（备用）
    ├── equip/              # 9 部位装备图标（accessory/amulet/armor/boots/cloak/clothes/head/ring/weapon）
    ├── monster/            # 10 种怪物（boar/cyberdog/dog/lizard/rat/shadow/skeleton/snake/spider/zombie）
    └── sprites/            # 3 张精灵表（hero/boss 动画帧）
```

---

## 🎯 核心玩法

### 关卡推进
```
第1关 → 第2关 → … → 第49关 → 第50关(Boss) → 下一轮第1关
       ├─ 普通怪: 50 关一轮（每关 1 怪）
       └─ Boss: 每 50 关出现一次，血量是普通怪的 10x
```

### 战斗公式（占位 `[PLACEHOLDER]`）
- **伤害** = `(玩家攻击 - 敌人防御) × (1 + 暴击 ? 爆伤 : 0)`
- **吸血** = `伤害 × 吸血%`（不超过 maxHp）
- **连击** = `15% 概率触发，第二次攻击伤害 × 0.5`

### 装备系统
- **9 部位**：头/衣/武/披/甲/鞋/戒/符/饰
- **6 品质**：白/绿/蓝/紫/橙/红（爆率随关卡提升）
- **随机属性**：每件装备独立 id + 属性 ±15% 浮动
- **7 条属性**：攻/防/血/暴击/爆伤/吸血/连击
- **三操作**：装备 / 出售（→金币）/ 分解（→强化石+材料）

### 经济循环
```
战斗掉落 → 装备（战斗属性）/ 材料（升级）/ 金币（购买）
挂机收益 → 离线金币（每分钟 X）
副本扫荡 → 大量材料 + 经验
分解装备 → 强化石（强化装备）+ 材料
商店购买 → 用金币买材料/装备
```

---

## 🔧 系统模块详细

### 核心模块（core/）

| 文件 | 职责 | 迁移关键 |
|---|---|---|
| `storage.js` | 存档读写 | 替换 `setStorageAdapter()`，业务代码零改动 |
| `renderer.js` | DOM 操作（含缓存验证） | 替换为 Canvas 绘制 |
| `events.js` | 定时器/事件总线 | 替换为小游戏主循环 |
| `ui-utils.js` | 工具函数 | 不依赖平台，可直接用 |

### 数据（data/）

- `config.js`：所有游戏配置（装备模板/怪物/材料/角色/技能/远征/副本）
- `gameData.js`：玩家运行时状态（gold/diamond/level/exp/equipment/bag/checkIn/...）

### 业务系统（systems/）

21 个系统文件，每个独立模块。模块间通过 `GameData` 全局状态通信，无循环依赖。

---

## 🚀 部署

### 快速开始（任意静态服务器）
```bash
# 方式 1：Python
python -m http.server 8080

# 方式 2：Node
npx http-server -p 8080

# 方式 3：项目自带 dev server
node dev-server.mjs          # 端口 8090
```

打开 http://localhost:8080/ 即可游玩。

### 生产部署到服务器
```bash
# 1. 构建 dist-release（同步源码 + 加 cache-bust 版本号）
rm -rf dist-release
mkdir -p dist-release
cp index.html dist-release/
cp style.css dist-release/
cp -r assets dist-release/
mkdir -p dist-release/src
cp -r src/* dist-release/src/

# 2. SSH 上传（已封装在 deploy-ssh.mjs）
node deploy-ssh.mjs
```

部署目标目录：`/home/ubuntu/Leon-game`（nginx root）

### Cache-Bust 版本号约定
- 每次改动 → 改 `index.html` 的 `?v=` 和 `src/**/*.js` 的 `?v=`
- 格式：`<feature>-YYYYMMDD<suffix>`，如 `equip-mini-btns-20260725n`
- **强制刷新**：浏览器 `Ctrl+F5` / 手机清除缓存

---

## 🌐 微信/抖音小游戏迁移

项目专门为迁移做了**适配层抽象**，业务代码**零修改**：

### 存储适配（storage.js）
```js
// 当前：localStorage
setStorageAdapter({
    get: (k) => JSON.parse(localStorage.getItem(k)),
    set: (k, v) => localStorage.setItem(k, JSON.stringify(v))
});

// 微信：替换为 wx.setStorageSync
setStorageAdapter({
    get: (k) => wx.getStorageSync(k),
    set: (k, v) => wx.setStorageSync(k, v)
});
```

### 渲染适配（renderer.js）
- 当前：`document.getElementById` / `appendChild`
- 微信小游戏：替换为 Canvas 2D / WebGL 绘制
- 业务代码：`Renderer.setText(id, text)` / `Renderer.setHTML(id, html)` 不变

### 事件循环（events.js）
- 当前：`setInterval` 驱动战斗/挂机
- 微信小游戏：替换为 `requestAnimationFrame` / `wx.onShow/onHide`
- 业务代码：调用 `events.emit('battle.tick')` 不变

---

## 🧪 测试

### 浏览器端测试（jsdom + esbuild IIFE）
```bash
node dev-server.mjs   # 启动 HTTP server :8090
node browser-test.mjs # 97 项功能测试
node ux-test.mjs      # 34 项 UX 测试
```

测试覆盖：
- **51 个 window.* 函数暴露**
- **11 个 modal 打开/关闭**
- **战斗系统**：manualAttack / 击败切换 / healInBattle
- **装备系统**：openEquipSelect / equipFromSelect / unequipItem
- **持久化**：localStorage 读写 + 适配器切换

---

## 📝 开发规范

### 命名约定
- **JS 变量/函数**：camelCase
- **CSS 类**：kebab-case（`.player-card`, `.equip-slot`）
- **常量**：UPPER_SNAKE（`EQUIPMENT_TEMPLATES`, `MATERIALS`）
- **模块导出**：`export function xxx()`

### 数值假设
- 所有战斗数值标记 `[PLACEHOLDER]` 直到 playtest
- 经济数据用 Excel 模拟后写入 config.js

### 提交规范
- 格式：`<type>: <description>`
- type: feat / fix / refactor / docs / chore / style
- 例子：`feat: 装备选择弹窗每行加出售/分解按钮`

### 修改后必做
1. ✅ 改源码 → 同步 `dist-release/`
2. ✅ 改版本号 `?v=`
3. ✅ `node deploy-ssh.mjs` 部署
4. ✅ `node browser-test.mjs` 跑测试
5. ✅ `git add . && git commit` 提交

---

## 🐛 已知问题 & 限制

| 问题 | 状态 | 备注 |
|---|---|---|
| 80 端口 nginx 502 | nginx default vhost 配置问题 | 与游戏无关，用 8080 端口 |
| ~~弹窗无法关闭~~ | ✅ 已修（`Renderer.$` 缓存验证） | commit b9d46d2 |
| ~~同名装备批量装备~~ | ✅ 已修（id 唯一 + UI 过滤） | commit c021d1a |
| ~~AI 水印图片~~ | ✅ 已修（换精灵表） | commit c7390f5 |
| 移动端屏幕适配 | 🔧 进行中 | 部分弹窗在窄屏可能溢出 |

---

## 🎯 路线图

### 已完成 ✅
- [x] 23 个 ES 模块按 data/core/systems/ui 分层
- [x] 11 个弹窗互斥 + 点击遮罩关闭
- [x] 装备 9 部位 + 6 品质 + 随机属性
- [x] 战斗 50 怪 1 Boss 循环
- [x] 4 角色 + 4 技能
- [x] 10 章剧情
- [x] 6 个副本（普通 + 精英）
- [x] 远征 / 挂机 / 签到 / 任务 / 成就

### 进行中 🔧
- [ ] 微信小游戏 StorageAdapter 实现
- [ ] 抖音小游戏 StorageAdapter 实现
- [ ] Canvas 2D 渲染适配层
- [ ] 移动端窄屏适配

### 未来 💡
- [ ] PvP 对战
- [ ] 公会系统
- [ ] 赛季/排行榜
- [ ] 装备词缀重铸
- [ ] 战宠系统

---

## 📜 提交记录

```
c7390f5 fix: 玩家卡片换回精灵表头像 + 缩小尺寸
c021d1a feat: 装备选择弹窗每行加出售/分解按钮
5b19525 refactor: 装备选择弹窗重设计（三段式 + 空状态 + backdrop）
6c1e408 fix: 装备栏回归头像两侧 + 玩家卡片右上角加快捷功能按钮
f70bd84 feat: 首页添加'我的装备'展示区
b9d46d2 fix: 装备详情弹窗无法关闭 + 修复卸下按钮
65925db docs: 添加 README（含在线试玩链接与 GitHub Pages 部署指南）
a6917d5 chore: 忽略历史临时文件
65ec66b feat: 末世幸存者挂机肉鸽H5游戏 - 完整模块化版本
```

---

## 📞 联系

- **GitHub**：[leon-house/qs-game](https://github.com/leon-house/qs-game)
- **服务器**：http://106.54.31.70:8080/

---

_Last updated: 2026-07-27_