/**
 * 战斗场景 Canvas 2D 渲染器
 *
 * 设计：模拟 2D 横版过关游戏视觉
 *  - 屏幕下半部分：战斗舞台（紫/蓝渐变底 + 远景山影）
 *  - 屏幕中线：地面线（角色和怪物行走）
 *  - 左下：角色 sprite（hero-sheet 帧动画）
 *  - 右侧：怪物 sprite（按怪物类型切换）
 *  - 攻击：角色挥剑 → 怪物受击闪白 → 血条扣减
 *  - 击败：怪物淡出 + 金币粒子飞向右上方奖励池
 *  - 移动：击败后角色向右 ease 走到下一个怪
 *  - Boss：体型放大 1.6 倍 + 红色光晕
 *
 * 与 battle.js 协作：battle.js 调用本模块的 API 启动战斗 / 推送事件
 */

import { calculateStats } from './equipment.js';
import { GameData } from '../data/gameData.js';
// 2026-08-04 火柴人改革：替换 sprite 渲染
import { StickFigure } from './stick-figure.js';
import { renderMonster, renderBoss } from './monster-figures.js';
import { FX } from './combat-fx.js';

// ============ 常量 ============
const ARENA_WIDTH = 480;
// 2026-10-28 UI P1：ARENA_HEIGHT 240→280、GROUND_Y 200→240，两者同步下移。
// 角色在屏幕上的位置一像素不变（脚下留白仍是 40px），但头顶多出 40px 逻辑空间，
// 用来放「名牌 + 血条 + 血量数字」——原来血条固定在 GROUND_Y-100，正好压在怪物胸口。
const ARENA_HEIGHT = 280;
const GROUND_Y = 240;                // 角色脚的 Y 坐标
const PLAYER_X_BASE = 80;            // 角色起始 X
const ENEMY_X_BASE = 340;            // 怪物起始 X（角色右方；往左挪 20 让 Boss 横向不溢出）
const PLAYER_STEP = 30;              // 每击败 1 只移动的距离
const AUTO_ATTACK_INTERVAL = 800;    // 自动攻击间隔 ms
const MOVE_DURATION = 600;           // 角色移动动画时长
const HIT_FLASH_DURATION = 120;      // 受击闪烁
const DEATH_FADE_DURATION = 600;     // 死亡淡出
const COIN_FLY_DURATION = 700;       // 金币飞向奖励池

// 怪物类型（与 battle-v2 ENEMY_TYPE_FILES 一致）
const MONSTER_TYPES = ['zombie', 'dog', 'rat', 'shadow', 'skeleton', 'spider', 'lizard', 'cyberdog', 'boar', 'snake'];

// 攻击时角色挥剑动画帧切换（毫秒）
const ATTACK_ANIM_FRAMES = [120, 120, 120, 120];
const ATTACK_ANIM_TOTAL = ATTACK_ANIM_FRAMES.reduce((a, b) => a + b, 0);

// ============ 状态机 ============
let canvas, ctx;

// 视图映射：逻辑坐标 480x240 → 画布实际像素（等比 contain，见 fitCanvas）
let viewScale = 1;
let viewOffX = 0;
let viewOffY = 0;
let canvasResizeObserver = null;
let animFrameId;
let lastTick = 0;
let loopStarted = false;
let loggedRenderError = false;

// 战斗运行时状态
const state = {
    phase: 'idle',                   // idle | attacking | moving | dying | waiting
    player: { x: PLAYER_X_BASE, attackFrame: 0, attackAnimStart: 0, lastAttack: 0 },
    enemy: null,                     // 当前怪物 {type, x, y, maxHp, hp, alive, alpha, scale, boss}
    particles: [],                   // 战斗粒子（飞行的金币 / 受伤数字 / 挥剑斩光）
    log: [],                         // 战斗日志（最多保留 5 条）
    listeners: {},                   // 事件回调
    rewardPoolUpdate: null,          // 给奖励池的更新函数（外部注入）

    // ===== 沉浸式镜头与动效 2026-07-30 参考视频风格升级 =====
    cameraZoom: 1,                   // 全局缩放（dolly-in 镜头推近，1.0 = 标准）
    cameraKickback: 1,               // 受击瞬间镜头后缩 0.92 → 缓动回 1.0
    enemyShake: { x: 0, y: 0, until: 0 },  // 怪物受击抖动偏移
    fogPhase: 0,                     // 远景雾化呼吸
};

// ============ 初始化 ============
export function initBattleCanvas(canvasEl, rewardPoolUpdate) {
    if (!canvasEl || typeof canvasEl.getContext !== 'function') {
        console.error('[BattleCanvas] init skipped: invalid canvas element');
        return state;
    }

    // 防止重复入口/缓存版本创建第二个 RAF；换 canvas 时才重建。
    if (loopStarted && canvas === canvasEl && ctx) {
        state.rewardPoolUpdate = rewardPoolUpdate;
        return state;
    }
    if (loopStarted && animFrameId) cancelAnimationFrame(animFrameId);
    loopStarted = false;
    loggedRenderError = false;

    canvas = canvasEl;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    console.log('[BattleCanvas] init, dpr=', dpr, 'canvasEl=', canvasEl);
    ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('[BattleCanvas] 2D context unavailable');
        return state;
    }
    // 画布 backing store 跟随实际显示尺寸；逻辑坐标系固定 480x240，等比映射（contain）。
    // 旧版 CSS 用 width/height:100%!important 强行拉伸画布，实测 480x240 被拉成 382x295，
    // 角色横向压扁 20%、纵向拉长 23%，贴图和文字全是变形的 —— 这里改成等比缩放。
    fitCanvas();

    refreshFlyTarget();
    window.addEventListener('resize', onResize, { passive: true });
    setTimeout(refreshFlyTarget, 500);
    // 舞台尺寸不只随窗口变（滚动条出现、布局重排都会改），用 ResizeObserver 兜住
    if (typeof ResizeObserver !== 'undefined' && !canvasResizeObserver) {
        canvasResizeObserver = new ResizeObserver(() => { fitCanvas(); });
        canvasResizeObserver.observe(canvas);
    }
    state.rewardPoolUpdate = rewardPoolUpdate;

    const startLoop = () => {
        if (loopStarted || !ctx) return;
        loopStarted = true;
        lastTick = 0;
        loop(performance.now());
    };
    // v25c：先立即启动主循环（用程序化 fallback 渲染，等不到图片也能画）
    //       然后后台异步预加载图片，加载完会自动替换 spriteImgs
    //       之前是等 preloadSprites 完成才启动 → 图片加载慢时 canvas 一直空白（"战斗区渲染慢"）
    startLoop();
    return state;
}

// ============ 飞向"提取"按钮的目标点 ============
let flyTargetX = ARENA_WIDTH - 60;   // 默认画布右上角
let flyTargetY = 30;

// 画布自适应：backing store = 实际显示尺寸 × dpr（原生分辨率，文字/贴图不再被重采样），
// 逻辑坐标系 480x240 等比映射到画布（contain，居中留边），保证角色永远不变形。
function fitCanvas() {
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(1, Math.round(rect.width));
    const cssH = Math.max(1, Math.round(rect.height));
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const bw = Math.round(cssW * dpr);
    const bh = Math.round(cssH * dpr);
    // 赋值 canvas.width/height 会清空画布并重置 transform，必须放在设置 transform 之前
    if (canvas.width !== bw) canvas.width = bw;
    if (canvas.height !== bh) canvas.height = bh;
    viewScale = Math.min(cssW / ARENA_WIDTH, cssH / ARENA_HEIGHT);
    viewOffX = (cssW - ARENA_WIDTH * viewScale) / 2;
    // 垂直方向贴底：舞台比 2:1 高时多出来的部分留在上方当天空，
    // 角色的脚始终踩在地面上，不会悬在画面中间。
    viewOffY = cssH - ARENA_HEIGHT * viewScale;
    ctx.setTransform(dpr * viewScale, 0, 0, dpr * viewScale, viewOffX * dpr, viewOffY * dpr);
}

function onResize() {
    fitCanvas();
    refreshFlyTarget();
}

function refreshFlyTarget() {
    if (!canvas) return;
    const btn = document.querySelector('.collect-btn');
    if (!btn) return;
    const cRect = canvas.getBoundingClientRect();
    const bRect = btn.getBoundingClientRect();
    // 提取按钮中心点 → 转成 canvas 内部坐标
    const targetAbsX = (bRect.left + bRect.width / 2) - cRect.left;
    const targetAbsY = (bRect.top + bRect.height / 2) - cRect.top;
    // 用 fitCanvas 的同一套映射（等比 + 居中偏移）换算回逻辑坐标
    flyTargetX = (targetAbsX - viewOffX) / viewScale;
    flyTargetY = (targetAbsY - viewOffY) / viewScale;
    // 钳制到画布内（按钮可能在画布下方 → y 超界 → 钳到画布底）
    flyTargetX = Math.max(0, Math.min(ARENA_WIDTH, flyTargetX));
    flyTargetY = Math.max(0, Math.min(ARENA_HEIGHT, flyTargetY));
}
// ============================================================
//  怪物绘制库（Canvas 程序化）— 与玩家角色统一画风
// ============================================================
//  约定：每个 draw 函数内部坐标都以脚底为原点 (0,0)，向上绘制。
//  ctx 在调用前已 translate 到 (e.x, GROUND_Y) 并应用 scale / globalAlpha。
//  t 为 performance.now() 时间戳；opts.flashUntil 控制受击闪烁。
//  公共动画：呼吸（身体上下浮动）+ 受击白闪。
// ============================================================

// 怪物脚下阴影
function monsterShadow(ctx, w = 30, h = 6) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(0, -2, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

// 接地阴影（2026-10-28 UI P1）
// 程序化角色本身不带影子：怪物自带的黑影是纯黑 rgba(0,0,0,.4)，
// 压在暗色废墟背景上完全看不见，主角则根本没有影子，
// 结果角色像"飘"在背景上。这里补一层柔和的接地阴影把角色焊进场景。
function contactShadow(x, y, radius) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.3);
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, radius);
    g.addColorStop(0, 'rgba(0,0,0,0.62)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.34)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

// 受击闪烁覆盖：在 ctx 已 translate 到脚底后调用
function applyHitFlash(ctx, flashUntil, now, w, h) {
    if (now >= flashUntil) return;
    const a = Math.max(0, (flashUntil - now) / 120) * 0.7;
    ctx.save();
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    // 蒙在脚下向上 h 高度范围
    ctx.fillRect(-w / 2, -h, w, h);
    ctx.restore();
}

// === 1. zombie 丧尸：灰绿皮肤、歪头、烂衣、垂臂 ===
function drawZombie(ctx, t, opts) {
    const breath = Math.sin(t * 0.004) * 1.5;
    monsterShadow(ctx, 26, 5);
    ctx.save();
    ctx.translate(0, breath);
    // 后腿
    ctx.fillStyle = '#4a4a2e';
    ctx.fillRect(-9, -26, 7, 26);
    ctx.fillRect(2, -26, 7, 26);
    // 烂鞋
    ctx.fillStyle = '#2a1d12';
    ctx.fillRect(-10, -4, 8, 4);
    ctx.fillRect(2, -4, 8, 4);
    // 躯干：破烂衬衫
    ctx.fillStyle = '#5a4a3a';
    ctx.fillRect(-12, -56, 24, 32);
    ctx.fillStyle = '#3a2a1e';
    ctx.fillRect(-13, -50, 26, 4);   // 横条
    ctx.fillRect(-13, -34, 26, 4);
    // 领口（烂洞）
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(-4, -56, 8, 4);
    // 右臂（正常抬起）
    ctx.fillStyle = '#7a8a5a';
    ctx.fillRect(8, -54, 6, 22);
    ctx.fillRect(11, -34, 5, 8);
    // 左臂（拖地）
    ctx.save();
    ctx.translate(-10, -50);
    ctx.rotate(0.5);
    ctx.fillStyle = '#7a8a5a';
    ctx.fillRect(0, 0, 6, 30);
    ctx.fillRect(-1, 28, 7, 6);
    ctx.restore();
    // 头部（歪向左侧）
    ctx.save();
    ctx.translate(-2, -68);
    ctx.rotate(-0.15);
    ctx.fillStyle = '#7a8a5a';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    // 左眼腐烂（红）
    ctx.fillStyle = '#c43030';
    ctx.fillRect(-5, -2, 4, 3);
    // 右眼（黄）
    ctx.fillStyle = '#d8c030';
    ctx.fillRect(2, -2, 4, 3);
    // 张嘴（深）
    ctx.fillStyle = '#1a0a0a';
    ctx.fillRect(-3, 3, 7, 4);
    // 牙齿
    ctx.fillStyle = '#e8e0c0';
    ctx.fillRect(-2, 3, 1, 3);
    ctx.fillRect(2, 3, 1, 3);
    ctx.restore();
    applyHitFlash(ctx, opts.flashUntil, opts.now, 32, 75);
    ctx.restore();
}

// === 2. dog 变异犬：四足、龇牙、辐射绿眼 ===
function drawDog(ctx, t, opts) {
    const breath = Math.sin(t * 0.005) * 2;
    monsterShadow(ctx, 30, 6);
    ctx.save();
    ctx.translate(0, breath);
    // 后腿 + 前腿
    ctx.fillStyle = '#5a3a2a';
    ctx.fillRect(-18, -22, 6, 22);  // 后腿
    ctx.fillRect(12, -22, 6, 22);   // 前腿
    ctx.fillRect(-6, -22, 6, 22);   // 后腿2
    ctx.fillRect(6, -22, 6, 22);    // 前腿2
    // 脚爪
    ctx.fillStyle = '#1a0a0a';
    ctx.fillRect(-19, -4, 8, 4);
    ctx.fillRect(11, -4, 8, 4);
    ctx.fillRect(-7, -4, 8, 4);
    ctx.fillRect(5, -4, 8, 4);
    // 身体
    ctx.fillStyle = '#7a4a2a';
    ctx.fillRect(-20, -42, 40, 22);
    // 背脊刺（变异）
    ctx.fillStyle = '#2a4a1a';
    for (let i = -14; i <= 14; i += 7) {
        ctx.beginPath();
        ctx.moveTo(i - 2, -42);
        ctx.lineTo(i, -50);
        ctx.lineTo(i + 2, -42);
        ctx.fill();
    }
    // 头部（前伸）
    ctx.fillStyle = '#8a5a3a';
    ctx.beginPath();
    ctx.ellipse(20, -38, 12, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // 鼻吻部
    ctx.fillStyle = '#5a3a2a';
    ctx.fillRect(28, -42, 8, 10);
    // 鼻头
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.arc(36, -36, 2, 0, Math.PI * 2);
    ctx.fill();
    // 龇牙（白）
    ctx.fillStyle = '#e8e0c0';
    ctx.fillRect(26, -34, 10, 3);
    ctx.fillRect(28, -31, 2, 4);
    ctx.fillRect(32, -31, 2, 4);
    // 眼睛（辐射绿）
    ctx.fillStyle = '#3aff5a';
    ctx.beginPath();
    ctx.arc(22, -40, 2, 0, Math.PI * 2);
    ctx.fill();
    // 耳朵（尖）
    ctx.fillStyle = '#5a3a2a';
    ctx.beginPath();
    ctx.moveTo(15, -46);
    ctx.lineTo(20, -56);
    ctx.lineTo(22, -44);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(24, -46);
    ctx.lineTo(28, -56);
    ctx.lineTo(28, -44);
    ctx.fill();
    // 尾巴（上翘）
    ctx.strokeStyle = '#7a4a2a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-20, -40);
    ctx.quadraticCurveTo(-28, -52, -24, -60);
    ctx.stroke();
    applyHitFlash(ctx, opts.flashUntil, opts.now, 50, 65);
    ctx.restore();
}

// === 3. rat 巨鼠：大耳、长尾、弓背、黄牙 ===
function drawRat(ctx, t, opts) {
    const breath = Math.sin(t * 0.006) * 2;
    monsterShadow(ctx, 24, 5);
    ctx.save();
    ctx.translate(0, breath);
    // 后腿
    ctx.fillStyle = '#5a5040';
    ctx.fillRect(-10, -18, 6, 18);
    ctx.fillRect(6, -18, 6, 18);
    ctx.fillRect(-11, -4, 8, 4);
    ctx.fillRect(5, -4, 8, 4);
    // 弓背身体
    ctx.fillStyle = '#6a5a48';
    ctx.beginPath();
    ctx.ellipse(0, -30, 18, 16, 0, Math.PI, 0);
    ctx.fill();
    // 头（前低）
    ctx.fillStyle = '#7a6850';
    ctx.beginPath();
    ctx.arc(14, -28, 8, 0, Math.PI * 2);
    ctx.fill();
    // 鼻吻
    ctx.fillStyle = '#5a4838';
    ctx.fillRect(20, -30, 6, 4);
    // 黄牙
    ctx.fillStyle = '#d8c030';
    ctx.fillRect(18, -26, 2, 4);
    ctx.fillRect(22, -26, 2, 4);
    // 红眼
    ctx.fillStyle = '#ff4040';
    ctx.beginPath();
    ctx.arc(16, -30, 1.5, 0, Math.PI * 2);
    ctx.fill();
    // 大耳朵（圆）
    ctx.fillStyle = '#aa9080';
    ctx.beginPath();
    ctx.arc(10, -38, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c0a090';
    ctx.beginPath();
    ctx.arc(10, -38, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#aa9080';
    ctx.beginPath();
    ctx.arc(18, -38, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c0a090';
    ctx.beginPath();
    ctx.arc(18, -38, 3, 0, Math.PI * 2);
    ctx.fill();
    // 长尾（弯）
    ctx.strokeStyle = '#8a7860';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-16, -24);
    ctx.quadraticCurveTo(-26, -34, -30, -44);
    ctx.quadraticCurveTo(-32, -28, -28, -18);
    ctx.stroke();
    applyHitFlash(ctx, opts.flashUntil, opts.now, 36, 50);
    ctx.restore();
}

// === 4. shadow 暗影：模糊黑剪影、发光双眼 ===
function drawShadow(ctx, t, opts) {
    const breath = Math.sin(t * 0.003) * 3;
    monsterShadow(ctx, 28, 5);
    ctx.save();
    ctx.translate(0, breath);
    // 模糊身体（多层半透明）
    for (let i = 3; i >= 0; i--) {
        ctx.save();
        ctx.globalAlpha = 0.18 + i * 0.15;
        ctx.fillStyle = '#0a0510';
        // 人形剪影
        ctx.beginPath();
        ctx.moveTo(-12, -4);
        ctx.lineTo(-12, -30);
        ctx.quadraticCurveTo(-14, -45, -8, -50);
        ctx.lineTo(8, -50);
        ctx.quadraticCurveTo(14, -45, 12, -30);
        ctx.lineTo(12, -4);
        ctx.closePath();
        ctx.fill();
        // 触手下摆（飘）
        ctx.beginPath();
        ctx.moveTo(-12, -10);
        ctx.quadraticCurveTo(-8, 0, -4, -8);
        ctx.moveTo(-4, -8);
        ctx.quadraticCurveTo(0, 2, 4, -10);
        ctx.moveTo(4, -10);
        ctx.quadraticCurveTo(8, 0, 12, -10);
        ctx.fill();
        ctx.restore();
    }
    // 双眼青光
    const glowAlpha = 0.6 + Math.sin(t * 0.008) * 0.3;
    ctx.save();
    ctx.shadowColor = '#00e0ff';
    ctx.shadowBlur = 12;
    ctx.fillStyle = `rgba(120,255,255,${glowAlpha})`;
    ctx.beginPath();
    ctx.arc(-4, -44, 2.2, 0, Math.PI * 2);
    ctx.arc(4, -44, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    applyHitFlash(ctx, opts.flashUntil, opts.now, 28, 55);
    ctx.restore();
}

// === 5. skeleton 骷髅：白骨、破披风、眼洞发光 ===
function drawSkeleton(ctx, t, opts) {
    const breath = Math.sin(t * 0.004) * 1.5;
    monsterShadow(ctx, 24, 5);
    ctx.save();
    ctx.translate(0, breath);
    // 破披风（米色飘带，在身体后）
    ctx.fillStyle = '#6a5a3a';
    ctx.beginPath();
    ctx.moveTo(-14, -32);
    ctx.lineTo(-18, -4);
    ctx.lineTo(-10, -10);
    ctx.lineTo(-6, -4);
    ctx.lineTo(0, -12);
    ctx.lineTo(6, -4);
    ctx.lineTo(10, -10);
    ctx.lineTo(18, -4);
    ctx.lineTo(14, -32);
    ctx.closePath();
    ctx.fill();
    // 腿部
    ctx.fillStyle = '#e8e0d0';
    ctx.fillRect(-8, -28, 5, 24);
    ctx.fillRect(3, -28, 5, 24);
    // 骨盆
    ctx.fillStyle = '#d8d0c0';
    ctx.fillRect(-9, -36, 18, 8);
    // 肋骨
    ctx.fillStyle = '#e8e0d0';
    ctx.fillRect(-10, -54, 20, 18);
    ctx.fillStyle = '#1a1a1a';
    for (let i = 0; i < 3; i++) {
        ctx.fillRect(-10, -50 + i * 5, 20, 1.5);
    }
    // 手臂（骨）
    ctx.strokeStyle = '#e8e0d0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-10, -50);
    ctx.lineTo(-16, -32);
    ctx.lineTo(-14, -22);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(10, -50);
    ctx.lineTo(16, -32);
    ctx.lineTo(14, -22);
    ctx.stroke();
    // 头颅
    ctx.fillStyle = '#e8e0d0';
    ctx.beginPath();
    ctx.arc(0, -64, 11, 0, Math.PI * 2);
    ctx.fill();
    // 下颌
    ctx.fillStyle = '#d8d0c0';
    ctx.fillRect(-5, -56, 10, 5);
    // 齿
    ctx.fillStyle = '#1a1a1a';
    for (let i = 0; i < 5; i++) {
        ctx.fillRect(-5 + i * 2.5, -54, 1, 3);
    }
    // 眼洞（红光）
    ctx.fillStyle = '#ff3030';
    ctx.shadowColor = '#ff3030';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(-4, -66, 2.5, 0, Math.PI * 2);
    ctx.arc(4, -66, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    applyHitFlash(ctx, opts.flashUntil, opts.now, 36, 70);
    ctx.restore();
}

// === 6. spider 蜘蛛：8 腿、大腹、复眼 ===
function drawSpider(ctx, t, opts) {
    const breath = Math.sin(t * 0.005) * 2;
    monsterShadow(ctx, 32, 6);
    ctx.save();
    ctx.translate(0, breath);
    // 8 条腿（弯曲线）
    ctx.strokeStyle = '#3a2a4a';
    ctx.lineWidth = 3;
    for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < 4; i++) {
            ctx.save();
            ctx.translate(side * 6, -28 + i * 4);
            const ang = side * (0.4 + i * 0.18);
            ctx.rotate(ang);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(side * 12, -2, side * 22, -8 + i * 2);
            ctx.stroke();
            ctx.restore();
        }
    }
    // 大腹（紫黑椭圆）
    ctx.fillStyle = '#2a1a3a';
    ctx.beginPath();
    ctx.ellipse(-2, -32, 16, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    // 腹部花纹（淡）
    ctx.fillStyle = '#5a3a7a';
    ctx.beginPath();
    ctx.arc(-2, -38, 4, 0, Math.PI * 2);
    ctx.fill();
    // 头胸（圆）
    ctx.fillStyle = '#3a2a4a';
    ctx.beginPath();
    ctx.arc(8, -44, 8, 0, Math.PI * 2);
    ctx.fill();
    // 复眼（4 红点）
    ctx.fillStyle = '#ff4040';
    ctx.beginPath();
    ctx.arc(8, -47, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(11, -46, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(5, -46, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(8, -43, 1, 0, Math.PI * 2);
    ctx.fill();
    // 螯（口前）
    ctx.fillStyle = '#3a2a4a';
    ctx.fillRect(12, -42, 6, 2);
    ctx.fillRect(14, -40, 2, 4);
    ctx.fillRect(18, -40, 2, 4);
    applyHitFlash(ctx, opts.flashUntil, opts.now, 40, 55);
    ctx.restore();
}

// === 7. lizard 蝾螈：四足爬行、鳞片、长尾 ===
function drawLizard(ctx, t, opts) {
    const breath = Math.sin(t * 0.005) * 2;
    monsterShadow(ctx, 30, 6);
    ctx.save();
    ctx.translate(0, breath);
    // 长尾（曲线）
    ctx.strokeStyle = '#4a6a3a';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-22, -16);
    ctx.quadraticCurveTo(-32, -8, -34, 0);
    ctx.stroke();
    // 身体（低伏）
    ctx.fillStyle = '#5a7a4a';
    ctx.beginPath();
    ctx.ellipse(0, -18, 24, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // 鳞片纹理（深绿斑）
    ctx.fillStyle = '#3a5a2a';
    for (let i = -14; i <= 14; i += 6) {
        ctx.beginPath();
        ctx.arc(i, -18 + (i % 2 === 0 ? -2 : 2), 1.5, 0, Math.PI * 2);
        ctx.fill();
    }
    // 四足（贴地）
    ctx.fillStyle = '#4a6a3a';
    ctx.fillRect(-18, -10, 5, 8);
    ctx.fillRect(-6, -10, 5, 8);
    ctx.fillRect(6, -10, 5, 8);
    ctx.fillRect(18, -10, 5, 8);
    ctx.fillRect(-19, -3, 7, 3);
    ctx.fillRect(-7, -3, 7, 3);
    ctx.fillRect(5, -3, 7, 3);
    ctx.fillRect(17, -3, 7, 3);
    // 头部（扁平前探）
    ctx.fillStyle = '#6a8a5a';
    ctx.beginPath();
    ctx.ellipse(24, -18, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // 张口
    ctx.fillStyle = '#1a0a0a';
    ctx.fillRect(30, -18, 6, 4);
    // 齿
    ctx.fillStyle = '#e8e0c0';
    for (let i = 0; i < 3; i++) {
        ctx.fillRect(31 + i * 2, -15, 1, 2);
    }
    // 红眼
    ctx.fillStyle = '#ff4040';
    ctx.beginPath();
    ctx.arc(22, -20, 1.5, 0, Math.PI * 2);
    ctx.fill();
    // 鼻孔
    ctx.fillStyle = '#1a0a0a';
    ctx.fillRect(32, -20, 1, 1);
    applyHitFlash(ctx, opts.flashUntil, opts.now, 60, 30);
    ctx.restore();
}

// === 8. cyberdog 机械狗：金属四肢、红色机械眼 ===
function drawCyberdog(ctx, t, opts) {
    const breath = Math.sin(t * 0.005) * 2;
    monsterShadow(ctx, 30, 6);
    ctx.save();
    ctx.translate(0, breath);
    // 四条金属腿
    ctx.fillStyle = '#8a8a8a';
    ctx.fillRect(-18, -22, 5, 22);
    ctx.fillRect(-6, -22, 5, 22);
    ctx.fillRect(7, -22, 5, 22);
    ctx.fillRect(19, -22, 5, 22);
    // 腿关节（深）
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(-19, -16, 7, 2);
    ctx.fillRect(-7, -16, 7, 2);
    ctx.fillRect(6, -16, 7, 2);
    ctx.fillRect(18, -16, 7, 2);
    // 脚（金属爪）
    ctx.fillStyle = '#5a5a5a';
    ctx.fillRect(-19, -4, 7, 4);
    ctx.fillRect(-7, -4, 7, 4);
    ctx.fillRect(6, -4, 7, 4);
    ctx.fillRect(18, -4, 7, 4);
    // 身体（机甲）
    ctx.fillStyle = '#a0a0a0';
    ctx.fillRect(-20, -44, 40, 22);
    // 装甲线条（深）
    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(-15 + i * 10, -44);
        ctx.lineTo(-15 + i * 10, -22);
        ctx.stroke();
    }
    // 头颅（方形机甲）
    ctx.fillStyle = '#a0a0a0';
    ctx.fillRect(14, -52, 14, 14);
    // 红色机械眼
    ctx.fillStyle = '#ff1010';
    ctx.shadowColor = '#ff2020';
    ctx.shadowBlur = 8;
    ctx.fillRect(17, -48, 8, 4);
    ctx.shadowBlur = 0;
    // 鼻部金属
    ctx.fillStyle = '#5a5a5a';
    ctx.fillRect(28, -48, 4, 6);
    // 天线
    ctx.strokeStyle = '#5a5a5a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(17, -52);
    ctx.lineTo(17, -58);
    ctx.stroke();
    ctx.fillStyle = '#ff1010';
    ctx.beginPath();
    ctx.arc(17, -59, 1.5, 0, Math.PI * 2);
    ctx.fill();
    // 尾巴（机械臂）
    ctx.strokeStyle = '#8a8a8a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-20, -40);
    ctx.lineTo(-28, -48);
    ctx.lineTo(-26, -56);
    ctx.stroke();
    // 装甲磨损划痕
    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-12, -30);
    ctx.lineTo(-6, -22);
    ctx.stroke();
    applyHitFlash(ctx, opts.flashUntil, opts.now, 50, 65);
    ctx.restore();
}

// === 9. boar 野猪：獠牙、背刺鬃毛、冲撞姿态 ===
function drawBoar(ctx, t, opts) {
    const breath = Math.sin(t * 0.004) * 2;
    // 冲撞前倾（低头）
    ctx.save();
    ctx.translate(0, breath);
    monsterShadow(ctx, 32, 6);
    // 四腿
    ctx.fillStyle = '#4a3020';
    ctx.fillRect(-18, -20, 6, 20);
    ctx.fillRect(-6, -20, 6, 20);
    ctx.fillRect(8, -20, 6, 20);
    ctx.fillRect(20, -20, 6, 20);
    // 蹄
    ctx.fillStyle = '#1a0a0a';
    ctx.fillRect(-19, -4, 8, 4);
    ctx.fillRect(-7, -4, 8, 4);
    ctx.fillRect(7, -4, 8, 4);
    ctx.fillRect(19, -4, 8, 4);
    // 身体（粗壮椭圆）
    ctx.fillStyle = '#5a3a26';
    ctx.beginPath();
    ctx.ellipse(0, -30, 26, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    // 背刺鬃毛（竖立）
    ctx.fillStyle = '#3a2010';
    for (let i = -16; i <= 16; i += 4) {
        ctx.beginPath();
        ctx.moveTo(i - 2, -42);
        ctx.lineTo(i, -54);
        ctx.lineTo(i + 2, -42);
        ctx.fill();
    }
    // 头部（前探低头）
    ctx.save();
    ctx.translate(20, -26);
    ctx.rotate(-0.3);
    ctx.fillStyle = '#6a4830';
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    // 鼻吻（粗圆）
    ctx.fillStyle = '#3a2010';
    ctx.beginPath();
    ctx.arc(10, 4, 6, 0, Math.PI * 2);
    ctx.fill();
    // 鼻孔
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(8, 3, 2, 2);
    ctx.fillRect(12, 3, 2, 2);
    // 獠牙（白色弯钩）
    ctx.fillStyle = '#e8e0c0';
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(2, 8);
    ctx.lineTo(8, 6);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(18, 8);
    ctx.lineTo(12, 6);
    ctx.closePath();
    ctx.fill();
    // 红眼
    ctx.fillStyle = '#ff4040';
    ctx.beginPath();
    ctx.arc(2, -3, 2, 0, Math.PI * 2);
    ctx.fill();
    // 耳
    ctx.fillStyle = '#4a3020';
    ctx.beginPath();
    ctx.moveTo(-6, -10);
    ctx.lineTo(-2, -16);
    ctx.lineTo(0, -8);
    ctx.fill();
    ctx.restore();
    // 短尾
    ctx.strokeStyle = '#3a2010';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-26, -36);
    ctx.quadraticCurveTo(-32, -44, -28, -50);
    ctx.stroke();
    applyHitFlash(ctx, opts.flashUntil, opts.now, 60, 55);
    ctx.restore();
}

// === 10. snake 蛇：S 形盘曲、三角头、吐信 ===
function drawSnake(ctx, t, opts) {
    const breath = Math.sin(t * 0.005) * 2;
    monsterShadow(ctx, 36, 6);
    ctx.save();
    ctx.translate(0, breath);
    // S 形盘曲身体
    ctx.strokeStyle = '#5a6a3a';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-28, -8);
    ctx.quadraticCurveTo(-20, -22, -8, -16);
    ctx.quadraticCurveTo(4, -10, 14, -20);
    ctx.quadraticCurveTo(22, -26, 24, -16);
    ctx.stroke();
    // 鳞片纹理（深）
    ctx.strokeStyle = '#3a4a1a';
    ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
        const px = -28 + i * 4;
        const py = -8 + Math.sin(i * 0.7) * 6;
        ctx.beginPath();
        ctx.moveTo(px, py - 3);
        ctx.lineTo(px + 1.5, py + 3);
        ctx.stroke();
    }
    // 三角头
    ctx.fillStyle = '#6a7a4a';
    ctx.beginPath();
    ctx.moveTo(24, -22);
    ctx.lineTo(38, -18);
    ctx.lineTo(28, -10);
    ctx.closePath();
    ctx.fill();
    // 眼（竖瞳）
    ctx.fillStyle = '#ffaa20';
    ctx.beginPath();
    ctx.arc(28, -18, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(28, -20, 1, 4);
    // 吐信（红叉）
    if (Math.sin(t * 0.01) > 0) {
        ctx.strokeStyle = '#c42020';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(38, -18);
        ctx.lineTo(44, -20);
        ctx.moveTo(38, -18);
        ctx.lineTo(44, -16);
        ctx.stroke();
    }
    applyHitFlash(ctx, opts.flashUntil, opts.now, 70, 35);
    ctx.restore();
}

// === 怪物分发表 ===
const MONSTER_DRAW_FUNCTIONS = {
    zombie: drawZombie,
    dog: drawDog,
    rat: drawRat,
    shadow: drawShadow,
    skeleton: drawSkeleton,
    spider: drawSpider,
    lizard: drawLizard,
    cyberdog: drawCyberdog,
    boar: drawBoar,
    snake: drawSnake,
};

// === Boss 变体绘制 ===
// variant: 0=污染巨兽 1=辐射领主 2=废土之王 3=感染母体 4=机械独裁者
function drawBossVariant(ctx, t, opts, variant = 0) {
    // 统一颤动 + 体型放大（调用前已 scale）
    const tremble = Math.sin(t * 0.012) * 1.5;
    ctx.save();
    ctx.translate(tremble, 0);
    switch (variant % 5) {
        case 0: return drawBossToxic(ctx, t, opts);
        case 1: return drawBossRadiation(ctx, t, opts);
        case 2: return drawBossWastelandKing(ctx, t, opts);
        case 3: return drawBossInfectedMatrix(ctx, t, opts);
        case 4: return drawBossMechanicalTyrant(ctx, t, opts);
    }
    ctx.restore();
}

// Boss 0：污染巨兽 — 巨型 zombie + 毒气云
function drawBossToxic(ctx, t, opts) {
    const breath = Math.sin(t * 0.003) * 4;
    monsterShadow(ctx, 60, 12);
    ctx.save();
    ctx.translate(0, breath);
    // 后腿
    ctx.fillStyle = '#3a3a1e';
    ctx.fillRect(-18, -50, 14, 50);
    ctx.fillRect(4, -50, 14, 50);
    ctx.fillRect(-20, -8, 18, 8);
    ctx.fillRect(2, -8, 18, 8);
    // 躯干（巨型）
    ctx.fillStyle = '#4a4a2a';
    ctx.fillRect(-26, -110, 52, 62);
    // 横条
    ctx.fillStyle = '#2a2a14';
    ctx.fillRect(-28, -98, 56, 5);
    ctx.fillRect(-28, -76, 56, 5);
    // 毒气云（半透明）
    for (let i = 0; i < 6; i++) {
        const phase = (t * 0.001 + i * 0.5) % 3;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 0.4 - phase * 0.12);
        ctx.fillStyle = '#7aff7a';
        ctx.beginPath();
        ctx.arc(-20 + i * 8, -120 - phase * 8, 12 + phase * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    // 双臂（粗大）
    ctx.fillStyle = '#7a8a5a';
    ctx.fillRect(22, -100, 14, 50);
    ctx.fillRect(22, -56, 12, 12);
    ctx.fillRect(-36, -100, 14, 50);
    ctx.fillRect(-34, -56, 12, 12);
    // 头
    ctx.fillStyle = '#7a8a5a';
    ctx.beginPath();
    ctx.arc(0, -130, 22, 0, Math.PI * 2);
    ctx.fill();
    // 多眼（横排 4 个）
    for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#c43030' : '#d8c030';
        ctx.fillRect(-14 + i * 9, -134, 5, 4);
    }
    // 嘴（大）
    ctx.fillStyle = '#1a0a0a';
    ctx.fillRect(-10, -118, 20, 8);
    // 牙
    ctx.fillStyle = '#e8e0c0';
    for (let i = 0; i < 6; i++) {
        ctx.fillRect(-9 + i * 3.5, -112, 1.5, 5);
    }
    applyHitFlash(ctx, opts.flashUntil, opts.now, 60, 145);
    ctx.restore();
}

// Boss 1：辐射领主 — 长袍 + 兜帽 + 双手辐射光
function drawBossRadiation(ctx, t, opts) {
    const breath = Math.sin(t * 0.003) * 3;
    monsterShadow(ctx, 50, 10);
    ctx.save();
    ctx.translate(0, breath);
    // 长袍（拖地）
    ctx.fillStyle = '#3a2a4a';
    ctx.beginPath();
    ctx.moveTo(-26, -90);
    ctx.lineTo(-34, 0);
    ctx.lineTo(34, 0);
    ctx.lineTo(26, -90);
    ctx.closePath();
    ctx.fill();
    // 长袍装饰条
    ctx.fillStyle = '#5a3a7a';
    ctx.fillRect(-30, -60, 60, 4);
    ctx.fillRect(-30, -40, 60, 4);
    // 腰带
    ctx.fillStyle = '#aa8838';
    ctx.fillRect(-26, -50, 52, 4);
    // 双臂（袍袖）
    ctx.fillStyle = '#3a2a4a';
    ctx.fillRect(-40, -90, 14, 60);
    ctx.fillRect(26, -90, 14, 60);
    // 双手辐射光（绿）
    for (const side of [-1, 1]) {
        const glow = 0.5 + Math.sin(t * 0.01 + side) * 0.3;
        ctx.save();
        ctx.shadowColor = '#7aff7a';
        ctx.shadowBlur = 16;
        ctx.fillStyle = `rgba(180,255,120,${glow})`;
        ctx.beginPath();
        ctx.arc(side * 34, -32, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // 触手（向玩家方向）
        ctx.strokeStyle = `rgba(160,255,100,${glow})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(side * 34, -32);
        ctx.quadraticCurveTo(side * 30, -16, side * 24, -4);
        ctx.stroke();
    }
    // 兜帽
    ctx.fillStyle = '#2a1a3a';
    ctx.beginPath();
    ctx.moveTo(-22, -110);
    ctx.lineTo(0, -150);
    ctx.lineTo(22, -110);
    ctx.closePath();
    ctx.fill();
    // 兜帽遮脸（纯黑）
    ctx.fillStyle = '#0a0510';
    ctx.beginPath();
    ctx.ellipse(0, -116, 16, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    // 兜帽下发光双眼（青）
    ctx.save();
    ctx.shadowColor = '#00e0ff';
    ctx.shadowBlur = 14;
    ctx.fillStyle = `rgba(150,255,255,${0.7 + Math.sin(t * 0.008) * 0.2})`;
    ctx.beginPath();
    ctx.arc(-5, -118, 2.5, 0, Math.PI * 2);
    ctx.arc(5, -118, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    applyHitFlash(ctx, opts.flashUntil, opts.now, 70, 155);
    ctx.restore();
}

// Boss 2：废土之王 — 重甲 + 双刃巨剑 + 王冠
function drawBossWastelandKing(ctx, t, opts) {
    const breath = Math.sin(t * 0.003) * 3;
    monsterShadow(ctx, 48, 10);
    ctx.save();
    ctx.translate(0, breath);
    // 双腿甲
    ctx.fillStyle = '#7a6040';
    ctx.fillRect(-14, -56, 12, 56);
    ctx.fillRect(2, -56, 12, 56);
    ctx.fillStyle = '#3a2818';
    ctx.fillRect(-15, -8, 14, 8);
    ctx.fillRect(1, -8, 14, 8);
    // 躯干重甲
    ctx.fillStyle = '#8a7050';
    ctx.fillRect(-22, -110, 44, 56);
    // 胸甲中央宝石（红）
    ctx.fillStyle = '#c42020';
    ctx.shadowColor = '#ff3030';
    ctx.shadowBlur = 10;
    ctx.fillRect(-3, -94, 6, 8);
    ctx.shadowBlur = 0;
    // 装甲条纹
    ctx.fillStyle = '#5a4020';
    ctx.fillRect(-22, -92, 44, 3);
    ctx.fillRect(-22, -76, 44, 3);
    // 双臂甲
    ctx.fillStyle = '#8a7050';
    ctx.fillRect(-32, -108, 10, 50);
    ctx.fillRect(22, -108, 10, 50);
    // 巨剑（右手持）
    ctx.save();
    ctx.translate(28, -100);
    ctx.rotate(-0.3);
    ctx.fillStyle = '#5a3920';
    ctx.fillRect(-3, -2, 6, 30);
    ctx.fillStyle = '#aa8838';
    ctx.fillRect(-7, 26, 14, 4);
    const bladeGrad = ctx.createLinearGradient(-4, 30, 4, 30);
    bladeGrad.addColorStop(0, '#aab8d0');
    bladeGrad.addColorStop(0.5, '#e8f0ff');
    bladeGrad.addColorStop(1, '#aab8d0');
    ctx.fillStyle = bladeGrad;
    ctx.fillRect(-5, 30, 10, 60);
    ctx.fillStyle = '#e8f0ff';
    ctx.beginPath();
    ctx.moveTo(-5, 90);
    ctx.lineTo(5, 90);
    ctx.lineTo(0, 100);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // 头颅（盔甲）
    ctx.fillStyle = '#8a7050';
    ctx.beginPath();
    ctx.arc(0, -130, 18, 0, Math.PI * 2);
    ctx.fill();
    // 王冠
    ctx.fillStyle = '#ffaa20';
    ctx.beginPath();
    ctx.moveTo(-16, -140);
    ctx.lineTo(-12, -150);
    ctx.lineTo(-8, -140);
    ctx.lineTo(-4, -154);
    ctx.lineTo(0, -140);
    ctx.lineTo(4, -154);
    ctx.lineTo(8, -140);
    ctx.lineTo(12, -150);
    ctx.lineTo(16, -140);
    ctx.closePath();
    ctx.fill();
    // 王冠宝石
    ctx.fillStyle = '#c42020';
    ctx.fillRect(-1, -148, 2, 4);
    // 眼缝（红光）
    ctx.fillStyle = '#ff3030';
    ctx.shadowColor = '#ff3030';
    ctx.shadowBlur = 8;
    ctx.fillRect(-8, -132, 6, 2);
    ctx.fillRect(2, -132, 6, 2);
    ctx.shadowBlur = 0;
    applyHitFlash(ctx, opts.flashUntil, opts.now, 64, 145);
    ctx.restore();
}

// Boss 3：感染母体 — blob 形 + 多触手 + 中央核心
function drawBossInfectedMatrix(ctx, t, opts) {
    const breath = Math.sin(t * 0.003) * 4;
    monsterShadow(ctx, 70, 14);
    ctx.save();
    ctx.translate(0, breath);
    // 触手（向外伸展，波动）
    ctx.strokeStyle = '#5a3a6a';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const sway = Math.sin(t * 0.005 + i) * 10;
        ctx.save();
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(0, -50);
        ctx.quadraticCurveTo(sway * 0.3, -20, sway, 0);
        ctx.stroke();
        ctx.restore();
    }
    // 主身体（blob）
    ctx.fillStyle = '#4a2a5a';
    ctx.beginPath();
    ctx.ellipse(0, -50, 45, 55, 0, 0, Math.PI * 2);
    ctx.fill();
    // 表面斑点（脉动）
    ctx.fillStyle = '#6a3a8a';
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r = 28;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r, -50 + Math.sin(a) * r * 1.2, 4, 0, Math.PI * 2);
        ctx.fill();
    }
    // 中央核心（脉动发光）
    const corePulse = 0.7 + Math.sin(t * 0.008) * 0.3;
    ctx.save();
    ctx.shadowColor = '#ff60c0';
    ctx.shadowBlur = 20;
    ctx.fillStyle = `rgba(255,120,200,${corePulse})`;
    ctx.beginPath();
    ctx.arc(0, -55, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // 核心外圈
    ctx.strokeStyle = `rgba(255,180,220,${corePulse * 0.7})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -55, 16, 0, Math.PI * 2);
    ctx.stroke();
    // 顶部裂口（嘴）
    ctx.fillStyle = '#1a0a2a';
    ctx.beginPath();
    ctx.ellipse(0, -90, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // 内圈齿
    ctx.fillStyle = '#e8e0c0';
    for (let i = 0; i < 6; i++) {
        ctx.fillRect(-12 + i * 4.5, -88, 1.5, 3);
    }
    applyHitFlash(ctx, opts.flashUntil, opts.now, 90, 120);
    ctx.restore();
}

// Boss 4：机械独裁者 — 机甲 + 炮管 + 红眼单眼 + 履带
function drawBossMechanicalTyrant(ctx, t, opts) {
    const breath = Math.sin(t * 0.003) * 3;
    monsterShadow(ctx, 56, 12);
    ctx.save();
    ctx.translate(0, breath);
    // 履带（左右）
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(-40, -16, 14, 16);
    ctx.fillRect(26, -16, 14, 16);
    // 履带轮
    ctx.fillStyle = '#5a5a5a';
    for (const cx of [-33, 33]) {
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(cx, -12 + i * 4, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    // 主躯干（机甲）
    ctx.fillStyle = '#8a8a8a';
    ctx.fillRect(-30, -100, 60, 90);
    // 装甲分割线
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(-30, -80, 60, 3);
    ctx.fillRect(-30, -50, 60, 3);
    ctx.fillRect(-30, -22, 60, 3);
    // 中央能量反应堆
    ctx.save();
    ctx.shadowColor = '#ff4040';
    ctx.shadowBlur = 14;
    ctx.fillStyle = `rgba(255,80,80,${0.6 + Math.sin(t * 0.008) * 0.3})`;
    ctx.fillRect(-8, -70, 16, 12);
    ctx.restore();
    // 左肩炮塔
    ctx.fillStyle = '#5a5a5a';
    ctx.fillRect(-42, -100, 14, 24);
    ctx.fillRect(-50, -94, 8, 12);    // 炮管
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-56, -92, 8, 8);
    // 右肩导弹仓
    ctx.fillStyle = '#5a5a5a';
    ctx.fillRect(28, -100, 14, 24);
    ctx.fillStyle = '#c43030';
    ctx.fillRect(30, -94, 4, 8);
    ctx.fillRect(36, -94, 4, 8);
    // 头颅
    ctx.fillStyle = '#9a9a9a';
    ctx.beginPath();
    ctx.arc(0, -120, 22, 0, Math.PI * 2);
    ctx.fill();
    // 装甲面罩
    ctx.fillStyle = '#3a3a3a';
    ctx.beginPath();
    ctx.arc(0, -120, 18, Math.PI * 0.2, Math.PI * 0.8);
    ctx.fill();
    // 中央单眼（红巨眼）
    ctx.save();
    ctx.shadowColor = '#ff2020';
    ctx.shadowBlur = 18;
    ctx.fillStyle = `rgba(255,40,40,${0.8 + Math.sin(t * 0.006) * 0.2})`;
    ctx.beginPath();
    ctx.arc(0, -120, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // 天线
    ctx.strokeStyle = '#5a5a5a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-15, -136);
    ctx.lineTo(-15, -150);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(15, -136);
    ctx.lineTo(15, -150);
    ctx.stroke();
    ctx.fillStyle = '#ff2020';
    ctx.beginPath();
    ctx.arc(-15, -152, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(15, -152, 2, 0, Math.PI * 2);
    ctx.fill();
    applyHitFlash(ctx, opts.flashUntil, opts.now, 84, 145);
    ctx.restore();
}

// ============ 战斗控制 API（由 battle.js 调用） ============

export function startBattle(enemyData) {
    state.phase = 'attacking';
    state.enemy = {
        type: enemyData.type,
        spriteKey: enemyData.boss ? 'boss' : enemyData.type,
        name: enemyData.name,
        level: enemyData.level || 1,                                     // v24：必须复制 level（血条上方名字用）
        chapter: enemyData.chapter || (GameData?.player?.bossLevel || 0),  // 章节号（1-based 用于查图）
        portraitKey: enemyData.portraitKey || null,                        // 显式肖像 key 优先
        x: ENEMY_X_BASE,
        y: GROUND_Y,
        maxHp: enemyData.maxHp,
        hp: enemyData.maxHp,
        alive: true,
        alpha: 1,
        scale: enemyData.boss ? 1.6 : 1,
        boss: !!enemyData.boss,
        bossVariant: enemyData.bossVariant || 0,
        attack: enemyData.attack || 10,
        coins: enemyData.coins || 5,
        exp: enemyData.exp || 3,
        flashUntil: 0
    };
    state.player.x = PLAYER_X_BASE;
    state.player.lastAttack = 0;
    log(`⚔️ 遭遇 ${enemyData.name}${enemyData.boss ? '（Boss）' : ''}！`);
}

export function stopBattle() {
    state.phase = 'idle';
    state.enemy = null;
    state.particles = [];
}

// 玩家攻击造成伤害（被 battle.js 回调）
export function onDamageDealt(damage, isCrit) {
    if (!state.enemy || !state.enemy.alive) return;
    state.enemy.hp -= damage;
    state.enemy.flashUntil = performance.now() + HIT_FLASH_DURATION;
    state.player.attackAnimStart = performance.now();
    // 2026-10-28 UI P1：删掉旧的 spawnDamageNumber(damage, isCrit)。
    // 下面 FX.spawnDamageNumber 弹的是同一个数字，两套系统同时生效 →
    // 一次攻击浮出两个数字，叠在怪物身上糊成一团。这里只保留 FX 那套。
    // ===== 镜头后缩 + 怪物抖动 + 血污溅射 =====
    state.cameraKickback = Math.max(0.88, state.cameraKickback - (isCrit ? 0.10 : 0.06));
    state.enemyShake.until = performance.now() + (isCrit ? 200 : 120);
    spawnBloodParticles(damage, isCrit);

    // ===== 2026-08-04 火柴人反馈：浮动数字 + 粒子 + 屏幕震动 =====
    // 2026-10-28 UI P1：伤害数字加随机横向偏移。
    // 自动攻击 800ms 一次、每个数字上浮 1200ms，连续命中会完全重叠在一起，
    // 现在按 ±13px 随机散开，堆叠时也能逐个看清。
    const enemyCenterX = (state.enemy.x || ENEMY_X_BASE) + (Math.random() - 0.5) * 26;
    // 数字从怪物躯干中段冒出来（原来正好落在名牌/血条那一行）
    const enemyCenterY = GROUND_Y - 88;
    if (isCrit) {
        FX.critEffect(enemyCenterX, enemyCenterY);
        FX.spawnDamageNumber({
            x: enemyCenterX,
            y: enemyCenterY - 12,
            value: damage,
            style: 'crit'
        });
    } else {
        FX.hitEffect(enemyCenterX, enemyCenterY);
        FX.spawnDamageNumber({
            x: enemyCenterX,
            y: enemyCenterY - 12,
            value: damage,
            style: 'normal'
        });
    }

    if (state.enemy.hp <= 0) {
        // 死亡特效
        FX.deathEffect(enemyCenterX, GROUND_Y - 80);
        onEnemyDeath();
        // 死亡瞬间：碎片爆裂 + 镜头甩出
        state.cameraKickback = 0.85;
        state.enemyShake.until = performance.now() + 350;
    }
}

// ============ 内部事件 ============
function onEnemyDeath() {
    state.phase = 'dying';
    const e = state.enemy;
    log(`✅ ${e.name} 已击败！获得 ${e.coins} 金币 + ${e.exp} 经验`);
    // 奖励池累积
    if (state.rewardPoolUpdate) {
        state.rewardPoolUpdate({ coins: e.coins, exp: e.exp, boss: e.boss });
    }
    // 飞金币粒子
    spawnCoinParticles(e);
    // 进入淡出阶段
    setTimeout(() => {
        if (state.enemy) {
            state.enemy.alive = false;
            state.phase = 'moving';
        }
    }, DEATH_FADE_DURATION);
}

function spawnCoinParticles(enemy) {
    const count = enemy.boss ? 8 : 3;
    // 每次怪死时重新计算目标（提取按钮位置可能变了）
    refreshFlyTarget();
    for (let i = 0; i < count; i++) {
        state.particles.push({
            type: 'coin',
            x: enemy.x + (Math.random() - 0.5) * 30,
            y: enemy.y - 40,
            targetX: flyTargetX,    // 飞向"提取"按钮（DOM 元素）
            targetY: flyTargetY,
            life: COIN_FLY_DURATION + i * 80,
            born: performance.now(),
            delay: i * 60,
            value: enemy.boss ? Math.ceil(enemy.coins / count) : 1
        });
    }
}

// ===== 血污溅射 (2026-07-30 升级) =====
// 击打瞬间从怪身抛出 6~12 颗粒子，落地形成血渍
function spawnBloodParticles(damage, isCrit) {
    if (!state.enemy) return;
    const e = state.enemy;
    const cx = e.x;
    const cy = e.y - (e.boss ? 130 : 90);  // 怪身中段
    const count = isCrit ? 14 : (e.boss ? 10 : 7);
    for (let i = 0; i < count; i++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9; // 偏上半扇
        const speed = 3 + Math.random() * 5 + (isCrit ? 3 : 0);
        state.particles.push({
            type: 'blood',
            x: cx + (Math.random() - 0.5) * 30,
            y: cy + (Math.random() - 0.5) * 30,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            born: performance.now(),
            life: 500 + Math.random() * 400,
            radius: 4 + Math.random() * 4,
            alpha: 1,
            color: Math.random() < 0.5 ? '196,40,40' : '230,90,90',
        });
    }
    // 落地血渍：位置随机靠怪脚下
    state.particles.push({
        type: 'blood-splat',
        x: e.x + (Math.random() - 0.5) * 40,
        y: GROUND_Y - 2,
        born: performance.now(),
        life: 1800,
        radius: 4,
        alpha: 0.8,
        color: '148,30,30',
    });
}

// ============ 主循环 ============
function loop(now) {
    if (!loopStarted || !ctx) return;
    const dt = now - (lastTick || now);
    lastTick = now;
    try {
        update(dt, now);
        FX.updateAllFX(dt);
        render(now);
    } catch (err) {
        // 单帧异常不能杀死 RAF，否则画布会永久停在空白帧。
        if (!loggedRenderError) {
            loggedRenderError = true;
            console.error('[BattleCanvas] frame recovered after error:', err);
        }
    } finally {
        if (loopStarted) animFrameId = requestAnimationFrame(loop);
    }
}

function update(dt, now) {
    // 角色挥剑动画帧
    if (state.player.attackAnimStart) {
        const elapsed = now - state.player.attackAnimStart;
        let acc = 0;
        let frame = 0;
        for (let i = 0; i < ATTACK_ANIM_FRAMES.length; i++) {
            acc += ATTACK_ANIM_FRAMES[i];
            if (elapsed < acc) { frame = i; break; }
        }
        state.player.attackFrame = frame;
        if (elapsed > ATTACK_ANIM_TOTAL) {
            state.player.attackAnimStart = 0;
            state.player.attackFrame = 0;
        }
    }

    // 自动攻击（attacking 阶段）
    if (state.phase === 'attacking' && state.enemy && state.enemy.alive) {
        if (!state.player.lastAttack || now - state.player.lastAttack >= AUTO_ATTACK_INTERVAL) {
            state.player.lastAttack = now;
            emit('autoAttack');
        }
    }

    // 移动（moving 阶段）
    if (state.phase === 'moving') {
        if (!state.moveStart) {
            state.moveStart = now;
            state.moveFromX = state.player.x;
            state.moveToX = Math.min(state.player.x + PLAYER_STEP, ARENA_WIDTH - 100);
        }
        const t = Math.min((now - state.moveStart) / MOVE_DURATION, 1);
        const eased = easeOutCubic(t);
        state.player.x = state.moveFromX + (state.moveToX - state.moveFromX) * eased;
        if (t >= 1) {
            delete state.moveStart;
            emit('reachedNext');
        }
    }

    // 粒子更新
    state.particles = state.particles.filter(p => {
        if (p.delay && now - p.born < p.delay) return true;
        if (p.type === 'coin') {
            const t = Math.min((now - p.born - (p.delay || 0)) / p.life, 1);
            const eased = easeOutCubic(t);
            p.x += (p.targetX - p.x) * 0.08;
            p.y += ((p.targetY - p.y) * 0.08) - 0.5;
            if (t >= 1) {
                // 飞到位 → 仅视觉反馈粒子，不再二次加金币（避免双倍计数）
                return false;
            }
        } else if (p.type === 'blood') {
            // 血污溅射：抛物线 + 重力 + 颜色衰减
            const t = Math.min((now - p.born) / p.life, 1);
            p.vy += 0.18;                                  // 重力
            p.x += p.vx;
            p.y += p.vy;
            p.alpha = Math.max(0, 1 - t);
            if (t >= 1 || p.y > GROUND_Y + 4) return false;
        } else if (p.type === 'blood-splat') {
            // 触地血渍扩散：原地扩散逐渐褪色
            const t = Math.min((now - p.born) / p.life, 1);
            p.radius = 4 + t * 18;
            p.alpha = Math.max(0, (1 - t) * 0.85);
            if (t >= 1) return false;
        }
        return true;
    });

    // ===== 镜头缓动 (cameraKickback 后缩→回 base) =====
    state.cameraKickback += (1 - state.cameraKickback) * 0.10;
    if (Math.abs(state.cameraKickback - 1) < 0.001) state.cameraKickback = 1;

    // ===== 怪物抖动衰减 =====
    if (now > state.enemyShake.until) {
        state.enemyShake.x *= 0.7;
        state.enemyShake.y *= 0.7;
        if (Math.abs(state.enemyShake.x) < 0.3) state.enemyShake.x = 0;
        if (Math.abs(state.enemyShake.y) < 0.3) state.enemyShake.y = 0;
    } else {
        // 抖动持续：随机 ±5px
        state.enemyShake.x = (Math.random() - 0.5) * 10;
        state.enemyShake.y = (Math.random() - 0.5) * 6;
    }

    // ===== 远景雾化呼吸 =====
    state.fogPhase += 0.0008;
}

// ============ 渲染 ============
function render(now) {
    if (!ctx) return;
    // 整个设备画布清空（含等比映射留出的边条），否则残影会挂在黑边上
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    // ===== 全局镜头缩放（dolly-in 推进） =====
    // base 1.0 + 受击后缩 0.92 缓动回 1.0；轻微持续呼吸 ±1%
    const zoom = state.cameraZoom * state.cameraKickback * (1 + Math.sin(now * 0.0015) * 0.005);
    const cx = ARENA_WIDTH / 2;
    const cy = GROUND_Y;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(zoom, zoom);
    ctx.translate(-cx, -cy);

    // ===== 2026-08-04 屏幕震动（叠加到 render transform） =====
    const shake = FX.getShakeOffset();
    ctx.translate(shake.x, shake.y);

    drawBackground();
    drawGroundAndSkyline();
    drawPlayer(now);
    drawEnemy(now);
    drawHealthBar();
    drawParticles(now);

    // ===== 2026-08-04 火柴人反馈层（粒子 + 数字 + 弧线 + 弹道） =====
    FX.renderAllFX(ctx, 16);

    drawLogOverlay();

    ctx.restore();
}

// v24：背景透明（让 .stage-canvas 的背景图透出来）
// 砍掉：所有程序化背景绘制（天空渐变 / 废墟剪影 / 红光晕 / 地面线 / 脚底光圈）
function drawBackground() {
    // 故意空：让 DOM 背景图（bg.webp）透出
}

function drawGroundAndSkyline() {
    // 故意空：地面/光圈全部交给背景图
}

function drawPlayer(now) {
    // === 火柴人主角：渲染失败时降级为最小可见骨架 ===
    if (!state.player) return;
    const cx = Number.isFinite(state.player.x) ? state.player.x : PLAYER_X_BASE;
    try {
        const equipped = getEquippedItems();
        const heroFigure = new StickFigure({
            scale: 0.55,
            facing: 1,
            color: '#d4b97a',
            equipment: {
                helmet: equipped.helmet,
                armor: equipped.armor,
                cloak: equipped.cloak,
                weapon: equipped.weapon,
                glovesL: equipped.glovesL,
                glovesR: equipped.glovesR,
                bootsL: equipped.bootsL,
                bootsR: equipped.bootsR,
                back: equipped.back
            }
        });

        if (state.player.attackAnimStart) {
            const elapsed = now - state.player.attackAnimStart;
            if (elapsed < ATTACK_ANIM_TOTAL) {
                heroFigure.triggerAnim('attack', ATTACK_ANIM_TOTAL);
                heroFigure.animT = elapsed / ATTACK_ANIM_TOTAL;
            }
        }

        ctx.save();
        ctx.translate(cx, GROUND_Y);
        // 2026-10-28 UI P1：接地阴影
        contactShadow(cx, GROUND_Y + 2, 24);
        heroFigure.render(ctx);
        ctx.restore();
    } catch (err) {
        if (!loggedRenderError) {
            loggedRenderError = true;
            console.error('[BattleCanvas] player renderer fallback:', err);
        }
        drawPlayerFallback(cx);
    }

    drawUnitLabel(cx, GROUND_Y + 22, `Lv.${(GameData && GameData.player && GameData.player.characterLevel) || 1}`, '#4ade80');
}

function drawPlayerFallback(cx) {
    ctx.save();
    ctx.translate(cx, GROUND_Y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#f0d18a';
    ctx.fillStyle = '#f0d18a';
    ctx.lineWidth = 5;
    ctx.shadowColor = 'rgba(255, 208, 120, 0.45)';
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.arc(0, -126, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -114); ctx.lineTo(0, -62);
    ctx.moveTo(0, -100); ctx.lineTo(-22, -78);
    ctx.moveTo(0, -100); ctx.lineTo(25, -82);
    ctx.moveTo(0, -62); ctx.lineTo(-16, -4);
    ctx.moveTo(0, -62); ctx.lineTo(18, -4);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#e9e9e9';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(24, -83); ctx.lineTo(48, -108);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 25, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

// ============ 提取当前装备（从 GameData.bag.equipment） ============
function getEquippedItems() {
    const out = { helmet: null, armor: null, cloak: null, weapon: null, glovesL: null, glovesR: null, bootsL: null, bootsR: null, back: null };
    try {
        // v23 fix：装备穿上后已在 p.equipment[part]，不在 bag 里。读 p.equipment 而非 bag.equipment
        const eq = (GameData && GameData.player && GameData.player.equipment) || {};
        for (const slot of Object.keys(eq)) {
            const item = eq[slot];
            if (!item) continue;
            const part = (slot || item.part || '').toLowerCase();
            if (part === 'head' || part === 'helmet') out.helmet = item;
            else if (part === 'armor' || part === 'clothes') out.armor = item;
            else if (part === 'cloak') out.cloak = item;
            else if (part === 'weapon') out.weapon = item;
            else if (part === 'gloves') { out.glovesL = item; out.glovesR = item; }
            else if (part === 'boots') { out.bootsL = item; out.bootsR = item; }
            else if (part === 'back' || part === 'accessory') out.back = item;
        }
    } catch (e) {
        // 静默失败
    }
    return out;
}

// 挥剑弧光动画（0..1 进度，0=开始挥，1=已劈完），增强版：金色弧线 + 火花爆点 + 残影圆
function drawSlashArc(cx, cy, t, armRotation = 0) {
    ctx.save();
    // 弧线相对剑身方向：剑尖朝右（armRotation=0）时，弧从右上扫到右下
    // 调整：让弧永远在剑尖位置从剑的上方扫到下方
    const startAngle = -Math.PI / 2 + armRotation;  // 剑尖上方 ~ 90°
    const endAngle = Math.PI / 2 + armRotation;      // 剑尖下方 ~ -90°
    const currentEnd = startAngle + (endAngle - startAngle) * Math.min(t * 1.5, 1);
    ctx.strokeStyle = `rgba(255, 245, 160, ${(1 - t) * 0.95})`;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, 22, startAngle, currentEnd, false);
    ctx.stroke();
    // 击打终点爆点（t > 0.55 时）— 爆点沿剑尖方向向外推
    if (t > 0.55) {
        const sparkT = (t - 0.55) / 0.45;
        // 黄白色实心圆（在剑尖前方）
        const sparkX = cx + Math.cos(armRotation) * 18;
        const sparkY = cy + Math.sin(armRotation) * 18 - 4;
        ctx.fillStyle = `rgba(255, 255, 220, ${(1 - sparkT) * 0.9})`;
        ctx.beginPath();
        ctx.arc(sparkX, sparkY, 7 * (1 - sparkT), 0, Math.PI * 2);
        ctx.fill();
        // 残影圈
        ctx.strokeStyle = `rgba(255, 220, 120, ${(1 - sparkT) * 0.5})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sparkX, sparkY, 14 * (1 - sparkT), 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.restore();
}

function drawEnemy(now) {
    const e = state.enemy;
    if (!e) return;
    const enemyX = Number.isFinite(e.x) ? e.x : ENEMY_X_BASE;
    const shake = state.enemyShake || { x: 0, y: 0 };
    let failed = false;
    ctx.save();
    try {
        ctx.translate(shake.x || 0, shake.y || 0);
        ctx.globalAlpha = Number.isFinite(e.alpha) ? e.alpha : 1;

        if (e.boss) {
            const glowPulse = 0.4 + Math.sin(now * 0.005) * 0.2;
            ctx.strokeStyle = `rgba(244,67,54,${glowPulse})`;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(enemyX, GROUND_Y - 130, 110, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = `rgba(244,67,54,${glowPulse * 0.4})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(enemyX, GROUND_Y - 130, 130, 0, Math.PI * 2);
            ctx.stroke();
        }

        const hpRatio = e.maxHp ? e.hp / e.maxHp : 1;
        const isFlashing = Boolean(e.flashUntil && now < e.flashUntil);
        // 2026-10-28 UI P1：接地阴影
        contactShadow(enemyX, GROUND_Y + 2, e.boss ? 58 : 28);
        const opts = {
            x: enemyX,
            y: GROUND_Y,
            scale: e.boss ? 1.0 : (e.scale || 1),
            facing: -1,
            hpRatio,
            hitState: { flash: isFlashing },
            name: e.name
        };
        if (e.boss) renderBoss(ctx, e.bossVariant || 0, opts);
        else renderMonster(ctx, e.type, opts);
    } catch (err) {
        failed = true;
        if (!loggedRenderError) {
            loggedRenderError = true;
            console.error('[BattleCanvas] enemy renderer fallback:', err);
        }
    } finally {
        ctx.restore();
    }
    if (failed) drawEnemyFallback(enemyX, e);
}

function drawEnemyFallback(x, enemy) {
    const boss = Boolean(enemy?.boss);
    const scale = boss ? 1.25 : 0.82;
    ctx.save();
    ctx.translate(x, GROUND_Y);
    ctx.scale(scale, scale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = boss ? '#68403a' : '#58604a';
    ctx.strokeStyle = boss ? '#e06b57' : '#d1c17a';
    ctx.lineWidth = boss ? 4 : 3;
    ctx.shadowColor = boss ? 'rgba(224,70,50,0.45)' : 'rgba(210,190,110,0.3)';
    ctx.shadowBlur = boss ? 10 : 4;
    ctx.beginPath();
    ctx.ellipse(0, -76, boss ? 48 : 30, boss ? 68 : 48, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -135, boss ? 32 : 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#f6c45a';
    ctx.beginPath(); ctx.arc(-9, -138, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(9, -138, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#252018';
    ctx.lineWidth = boss ? 6 : 4;
    ctx.beginPath();
    ctx.moveTo(-18, -28); ctx.lineTo(-24, 0);
    ctx.moveTo(18, -28); ctx.lineTo(24, 0);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath(); ctx.ellipse(0, 0, boss ? 58 : 36, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}

// 角色 / 怪物在画布逻辑坐标里的绘制高度（用来把血条定位到头顶上方）。
// 原始造型高 180~190，renderMonster / renderBoss 内部统一再乘 0.85。
const FIGURE_SCALE = 0.85;
const MONSTER_FIGURE_H = 190;
const BOSS_FIGURE_H = 155;

function drawHealthBar() {
    if (!state.enemy) return;
    const e = state.enemy;
    const isBoss = Boolean(e.boss);

    // 2026-10-28 UI P1：血条原本固定在 GROUND_Y-100，正好压在怪物胸口；
    // 血量数字又写在条子正中，和填充色撞在一起，怪物被糊成一团看不见。
    // 现在「名牌 + 血条 + 血量数字」作为一组，整体贴在怪物头顶上方。
    const nameH = 16;
    const barH = isBoss ? 12 : 9;
    const txtH = 11;
    const groupH = nameH + 2 + barH + 2 + txtH;
    const figureH = (isBoss ? BOSS_FIGURE_H : MONSTER_FIGURE_H) * FIGURE_SCALE * (e.scale || 1);
    const headTop = GROUND_Y - figureH;
    const groupTop = Math.max(2, headTop - groupH - 4);
    const nameY = groupTop;
    const barY = nameY + nameH + 2;
    const txtY = barY + barH + 2;

    const w = isBoss ? 150 : 92;
    const x = e.x - w / 2;
    const radius = barH / 2;
    const hpRatio = e.maxHp > 0 ? Math.max(0, Math.min(1, e.hp / e.maxHp)) : 0;

    // 1. 名牌（实心暗底，压在亮背景上也能读）
    if (e.name) {
        ctx.font = 'bold 11px sans-serif';
        const tagText = `${e.name} Lv.${e.level || 1}`;
        const tagW = ctx.measureText(tagText).width + 14;
        ctx.fillStyle = 'rgba(12,9,5,0.88)';
        roundRect(ctx, e.x - tagW / 2, nameY, tagW, nameH, 4);
        ctx.fill();
        ctx.fillStyle = isBoss ? '#ff9a8a' : '#f5e1a4';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tagText, e.x, nameY + nameH / 2 + 0.5);
    }

    // 2. 血条外框（深色基底 + 圆角 + 投影）
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = 'rgba(10,7,4,0.95)';
    roundRect(ctx, x, barY, w, barH, radius);
    ctx.fill();
    ctx.restore();

    // 3. 血量填充（绿 → 黄 → 红）
    const fillW = Math.max(radius * 2, hpRatio * (w - 2));  // 保证填满至少圆形端
    let gradColor1, gradColor2;
    if (hpRatio > 0.5) {
        gradColor1 = isBoss ? '#e07a4a' : '#7ec87a';
        gradColor2 = isBoss ? '#a8461f' : '#3f8f4a';
    } else if (hpRatio > 0.25) {
        gradColor1 = '#e8b44a';
        gradColor2 = '#a3701d';
    } else {
        gradColor1 = '#e0664f';
        gradColor2 = '#8e2a1c';
    }
    const fill = ctx.createLinearGradient(x, barY, x, barY + barH);
    fill.addColorStop(0, gradColor1);
    fill.addColorStop(1, gradColor2);
    ctx.fillStyle = fill;
    roundRect(ctx, x + 1, barY + 1, fillW, barH - 2, radius - 1);
    ctx.fill();

    // 4. 顶部高光
    const highlight = ctx.createLinearGradient(x, barY, x, barY + barH / 2);
    highlight.addColorStop(0, 'rgba(255,255,255,0.35)');
    highlight.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = highlight;
    roundRect(ctx, x + 1, barY + 1, fillW, barH / 2, radius - 1);
    ctx.fill();

    // 5. 边框（暗铜边，不用亮金，避免在暗背景上抢戏）
    ctx.strokeStyle = 'rgba(150,118,68,0.85)';
    ctx.lineWidth = 1;
    roundRect(ctx, x, barY, w, barH, radius);
    ctx.stroke();

    // 6. 血量数字移到血条下方（原来写在条子正中，和填充色撞色看不清）
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const hpText = `${Math.max(0, Math.ceil(e.hp))} / ${e.maxHp}`;
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.lineWidth = 3;
    ctx.strokeText(hpText, e.x, txtY + txtH / 2);
    ctx.fillStyle = isBoss ? '#ffb3a0' : '#e8d5a8';
    ctx.fillText(hpText, e.x, txtY + txtH / 2);
}

// 圆角矩形辅助（兼容旧版浏览器）
function roundRect(ctx, x, y, w, h, r) {
    if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r);
    } else {
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
    }
}

function drawUnitLabel(x, y, text, color) {
    ctx.save();
    ctx.font = '13px sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    const w = ctx.measureText(text).width + 14;
    ctx.fillRect(x - w / 2, y, w, 19);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y + 13.5);
    ctx.restore();
}

function drawParticles(now) {
    state.particles.forEach(p => {
        if (p.type === 'coin') {
            if (now - p.born < (p.delay || 0)) return;
            const age = now - p.born - (p.delay || 0);
            const t = Math.min(age / p.life, 1);
            ctx.save();
            ctx.globalAlpha = 1 - t * 0.3;
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('🪙', p.x, p.y);
            ctx.restore();
        } else if (p.type === 'blood') {
            // 血污溅射：圆形 + 颜色衰减
            ctx.save();
            ctx.globalAlpha = (p.alpha ?? 1);
            ctx.fillStyle = `rgba(${p.color || '196,40,40'}, ${p.alpha ?? 1})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius || 4, 0, Math.PI * 2);
            ctx.fill();
            // 拖尾：略带 motion blur 效果
            if (p.vx || p.vy) {
                ctx.fillStyle = `rgba(${p.color || '196,40,40'}, ${(p.alpha ?? 1) * 0.4})`;
                ctx.beginPath();
                ctx.arc(p.x - p.vx * 1.5, p.y - p.vy * 1.5, (p.radius || 4) * 0.7, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        } else if (p.type === 'blood-splat') {
            // 落地血渍扩散
            ctx.save();
            ctx.globalAlpha = p.alpha;
            // 外圈扩散渐变
            const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
            grad.addColorStop(0, `rgba(${p.color}, ${p.alpha})`);
            grad.addColorStop(1, `rgba(${p.color}, 0)`);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    });
}

function drawLogOverlay() {
    // 2026-08-04 关闭：战斗日志不再画在战斗区（飘字影响角色）
    // 日志会通过 battle-v2 的 toast 系统显示在其他区域
    return;
}

// ============ 工具 ============
function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}
function easeInCubic(t) {
    return t * t * t;
}

function log(text) {
    state.log.push(text);
    if (state.log.length > 20) state.log.shift();
}

function emit(event, data) {
    const handlers = state.listeners[event] || [];
    handlers.forEach(h => h(data));
}

export function on(event, handler) {
    if (!state.listeners[event]) state.listeners[event] = [];
    // 2026-08-14：C1 修复 — 同一 handler 引用已注册过则不再 push，
    //   避免 battle-v2.startContinuousBattle 每次调用都累积 autoAttack/reachedNext 监听器，
    //   否则每通关一次挑战，玩家 DPS 就会线性翻倍。
    if (state.listeners[event].indexOf(handler) >= 0) {
        return () => off(event, handler);
    }
    state.listeners[event].push(handler);
    return () => off(event, handler);
}

/** 解绑 on() 注册的 handler */
export function off(event, handler) {
    const arr = state.listeners[event];
    if (!arr) return;
    const i = arr.indexOf(handler);
    if (i >= 0) arr.splice(i, 1);
}

// 提供给 battle.js：判断当前怪物是否已死亡等待移动
export function getBattleState() {
    return {
        phase: state.phase,
        enemyAlive: state.enemy && state.enemy.alive,
        moving: state.phase === 'moving'
    };
}
