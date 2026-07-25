# 末世幸存者 (Apocalypse Survivor)

挂机肉鸽 H5 游戏，末世题材。

## 🎮 在线试玩

**CloudStudio 部署版**：<https://6396787adb2f4c9bb9afc8f137a04943.app.codebuddy.work>

## 📦 项目结构

```
qs-game/
├── index.html              # 入口 HTML
├── style.css               # 全局样式（25KB，含末世主题 + 弹窗/签到/任务/章节/副本样式）
├── package.json            # 仅保留 vite 配置（项目本身不依赖 vite）
├── assets/images/          # 末世风格资源（6 张）
└── src/                    # 模块化游戏代码
    ├── main.js             # 入口 + 暴露 52 个 window.* 函数
    ├── core/               # 适配层（4）：events / renderer / storage / ui-utils
    ├── data/               # 数据（2）：config / gameData
    ├── systems/            # 业务系统（15）：battle / equipment / stage / shop / shelter ...
    └── ui/                 # UI 渲染（2）：ui / modals
```

## 🛠️ 本地开发

```bash
# 用任意静态 HTTP 服务器，推荐 vite / python / node http-server
python -m http.server 8080
# 或
node -m http-server
# 或
npx vite

# 浏览器打开 http://localhost:8080
```

> 项目用纯原生 ES Modules，**无需打包**。打开 index.html 即可，浏览器自动 import 所有依赖。

## 🚀 GitHub Pages 部署（长期方案）

1. 打开 https://github.com/leon-house/qs-game/settings/pages
2. **Source** 选择 "Deploy from a branch"
3. **Branch** 选 `main` / `(root)`，保存
4. 1-2 分钟后游戏公开访问：
   `https://leon-house.github.io/qs-game/`

## 🔧 微信/抖音小游戏迁移

游戏专门为迁移做了适配层抽象：

- **Storage** (`src/core/storage.js`)：localStorage → `wx.setStorageSync` / `tt.setStorageSync`
- **Renderer** (`src/core/renderer.js`)：DOM → Canvas 2D
- **Events** (`src/core/events.js`)：setInterval → 小游戏主循环

迁移时只需新增对应平台的 StorageAdapter，业务代码 `game.js` **零修改**。

## 🎯 功能清单

- ✅ 装备系统（5 部位 + 8 套装 + 12 宝石 + 等级限制 + 爆伤/吸血/连击/抗性）
- ✅ 关卡系统（50 普通怪 + Boss）
- ✅ 战斗系统（手动 + 自动 + 连击 + 暴击 + 治疗）
- ✅ 7 个核心系统：商店 / 庇护所 / 图鉴 / 签到 / 任务 / 成就 / 章节
- ✅ 副本战（6 个普通/精英副本 + 扫荡）
- ✅ 角色选择（4 种 survivor + 加成）
- ✅ 剧情系统（10 章剧情）
- ✅ 随机事件（宝箱/商人/突袭/治愈/宝藏）

## 🧪 测试

测试覆盖 **97 项功能 + 34 项 UX 改进**，全部通过。

```bash
node dev-server.mjs    # 启动本地 HTTP 服务器 :8090
node ux-test.mjs       # UX 改进测试（弹窗互斥/点击遮罩/样式）
```

## 📝 提交记录

- `a6917d5` chore: 忽略历史临时文件
- `65ec66b` feat: 末世幸存者挂机肉鸽H5游戏 - 完整模块化版本
