/**
 * 火柴人渲染器 · 程序化角色（无需图片素材）
 *
 * 坐标系：中心 (0,0) 是角色脚底所在地面
 *   X 横轴：左负右正
 *   Y 纵轴：上负下正（Canvas 标准）
 *   头部位置：(0, -180)
 *   腰部位置：(0, -100)
 *   总高 180px（可缩放）
 *
 * 装备槽（9 个）：
 *   helmet  /  armor    /  cloak   /  weapon
 *   glovesL /  glovesR  /  bootsL  /  bootsR  /  back
 *
 * 装备定义格式（与 equipment.js 兼容）：
 *   {
 *     part: 'weapon' | 'armor' | ...,
 *     quality: 'white' | 'green' | 'blue' | 'purple' | 'orange' | 'red',
 *     subType: 'sword' | 'axe' | 'staff' | 'gun' | 'dagger' | 'hammer' | 'bow',
 *     // 部位特有 field：
 *     weaponType: 'sword' | 'axe' | 'staff' | 'gun' | 'dagger' | 'hammer' | 'bow',
 *     armorType: 'leather' | 'plate' | 'robe' | 'chain',
 *     helmetType: 'leather' | 'iron' | 'horned' | 'crown',
 *     bootsType: 'leather' | 'iron' | 'magic',
 *     capeColor: string
 *   }
 *
 * 颜色策略：
 *   品质边框：白→绿→蓝→紫→橙→红（递进）
 *   装备填色：材质色（如金属银/皮革棕/布料深褐）
 *   角色身体：暖金（#d4b97a）线条
 */

const QUALITY_GLOW = {
    white:  { color: '#cccccc', glow: 'rgba(204,204,204,0.4)' },
    green:  { color: '#4caf50', glow: 'rgba(76,175,80,0.4)' },
    blue:   { color: '#2196f3', glow: 'rgba(33,150,243,0.45)' },
    purple: { color: '#9c27b0', glow: 'rgba(156,39,176,0.5)' },
    orange: { color: '#ff9800', glow: 'rgba(255,152,0,0.55)' },
    red:    { color: '#f44336', glow: 'rgba(244,67,54,0.6)' }
};

const QUALITY_TINT = {
    white:  'rgba(204,204,204,0.3)',
    green:  'rgba(76,175,80,0.35)',
    blue:   'rgba(33,150,243,0.4)',
    purple: 'rgba(156,39,176,0.5)',
    orange: 'rgba(255,152,0,0.55)',
    red:    'rgba(244,67,54,0.6)'
};

// 装备填色（按 subType 区分材质）
const MATERIAL_COLOR = {
    leather: '#5a3e1a',
    iron: '#7a8390',
    steel: '#b4bcc4',
    gold: '#e8c267',
    plate: '#9aa1a8',
    chain: '#8a8a72',
    robe: '#3a1a4a',
    cloth: '#4a2818',
    wood: '#5a3e1a',
    bone: '#d4d0b8',
    crystal: '#a8e1ff',
    shadow: '#1a1a2a',
    horn: '#1a1208'
};

// ========== 身体骨架（线段） ==========
const SKELETON = {
    // 关键点
    head: { x: 0, y: -180, r: 16 },
    neck: { x: 0, y: -160 },
    shoulderL: { x: -22, y: -150 },
    shoulderR: { x: 22, y: -150 },
    elbowL: { x: -32, y: -120 },
    elbowR: { x: 32, y: -120 },
    handL: { x: -36, y: -85 },
    handR: { x: 36, y: -85 },
    hip: { x: 0, y: -90 },
    kneeL: { x: -16, y: -50 },
    kneeR: { x: 16, y: -50 },
    footL: { x: -22, y: -10 },
    footR: { x: 22, y: -10 },
    footpadL: { x: -28, y: 0 },
    footpadR: { x: 28, y: 0 },
    // 顶级尺寸
    torsoTop: { x: 0, y: -150 },
    torsoBottom: { x: 0, y: -90 }
};

// ========== 工具函数 ==========
function pt(p) { return `M${p.x.toFixed(1)},${p.y.toFixed(1)}`; }
function line(p1, p2) { return [p1.x, p1.y, p2.x, p2.y]; }
function dist(p1, p2) { return Math.hypot(p2.x - p1.x, p2.y - p1.y); }
function angle(from, to) { return Math.atan2(to.y - from.y, to.x - from.x); }

// ===================== 武器绘制 =====================
/**
 * 绘制武器（v24：永远画武器，没装备时画默认剑形）
 */
function drawWeapon(ctx, hand, weapon, quality) {
    // v24：没装备画默认剑（让火柴人永远有武器）
    const subType = weapon ? (weapon.subType || weapon.weaponType) : 'sword';
    const tip = { x: hand.x + 70, y: hand.y - 60 };

    ctx.save();
    ctx.translate(hand.x, hand.y);
    ctx.rotate(angle({ x: 0, y: 0 }, { x: 70, y: -60 }));

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // v24：默认剑（不管装备状态都画同样简洁的剑）
    ctx.strokeStyle = '#dcd4b8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(60, 0);
    ctx.stroke();
    // 剑尖三角
    ctx.fillStyle = '#f0e8c8';
    ctx.beginPath();
    ctx.moveTo(60, 0);
    ctx.lineTo(70, -3);
    ctx.lineTo(70, 3);
    ctx.closePath();
    ctx.fill();
    // 剑格（短横线）
    ctx.strokeStyle = '#8a5a20';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-8, 0);
    ctx.stroke();
    ctx.restore();
    return;

    ctx.save();
    ctx.translate(hand.x, hand.y);
    ctx.rotate(angle({ x: 0, y: 0 }, { x: 70, y: -60 }));

    // 武器光晕（v23：禁用 shadowBlur 加速 — 用 stroke 粗细 + 颜色代替光晕）
    // 旧: ctx.shadowColor = glow.color; ctx.shadowBlur = 0;  // v23: disabled for perf

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    switch (weapon.subType || weapon.weaponType) {
        case 'sword':
        case 'épée':
            // 剑：剑刃（灰白）+ 剑柄（深棕）+ 护手（暖金）
            ctx.strokeStyle = MATERIAL_COLOR.steel;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(60, 0);
            ctx.stroke();
            // 刃尖
            ctx.beginPath();
            ctx.moveTo(60, -2);
            ctx.lineTo(70, 0);
            ctx.lineTo(60, 2);
            ctx.closePath();
            ctx.fillStyle = MATERIAL_COLOR.steel;
            ctx.fill();
            // 护手
            ctx.strokeStyle = MATERIAL_COLOR.gold;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, -6);
            ctx.lineTo(0, 6);
            ctx.stroke();
            // 剑柄
            ctx.strokeStyle = MATERIAL_COLOR.leather;
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-10, 0);
            ctx.stroke();
            // 剑首
            ctx.fillStyle = glow.color;
            ctx.beginPath();
            ctx.arc(-12, 0, 3, 0, Math.PI * 2);
            ctx.fill();
            break;
        case 'axe':
            // 斧：斧柄 + 斧头（梯形）+ 斧刃
            ctx.strokeStyle = MATERIAL_COLOR.wood;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(60, 0);
            ctx.stroke();
            // 斧头
            ctx.fillStyle = MATERIAL_COLOR.steel;
            ctx.beginPath();
            ctx.moveTo(40, -12);
            ctx.lineTo(64, -8);
            ctx.lineTo(64, 8);
            ctx.lineTo(40, 12);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = glow.color;
            ctx.lineWidth = 1;
            ctx.stroke();
            break;
        case 'staff':
            // 法杖：长杖 + 顶部宝石
            ctx.strokeStyle = MATERIAL_COLOR.wood;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(70, 0);
            ctx.stroke();
            // 顶部宝石
            ctx.fillStyle = glow.color;
            ctx.beginPath();
            ctx.arc(74, 0, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.beginPath();
            ctx.arc(72, -2, 2, 0, Math.PI * 2);
            ctx.fill();
            // 缠绕
            ctx.strokeStyle = glow.color;
            ctx.lineWidth = 1.5;
            for (let i = 0; i < 4; i++) {
                ctx.beginPath();
                const x = 8 + i * 14;
                ctx.arc(x, 0, 4, 0, Math.PI, false);
                ctx.stroke();
            }
            break;
        case 'gun':
            // 枪：枪身 + 枪管
            ctx.fillStyle = '#2a2a2a';
            ctx.fillRect(0, -3, 50, 6);
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(45, -3, 20, 3);
            // 枪托
            ctx.fillStyle = MATERIAL_COLOR.wood;
            ctx.fillRect(-6, -3, 8, 6);
            // 准星
            ctx.fillStyle = glow.color;
            ctx.fillRect(58, -2, 4, 4);
            ctx.shadowBlur = 0;  // v23: disabled for perf
            break;
        case 'hammer':
            // 锤：锤柄 + 锤头
            ctx.strokeStyle = MATERIAL_COLOR.wood;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(60, 0);
            ctx.stroke();
            ctx.fillStyle = MATERIAL_COLOR.steel;
            ctx.fillRect(48, -10, 14, 20);
            ctx.strokeStyle = glow.color;
            ctx.lineWidth = 1;
            ctx.strokeRect(48, -10, 14, 20);
            break;
        case 'dagger':
            // 匕首：短刃 + 圆柄
            ctx.strokeStyle = MATERIAL_COLOR.steel;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(40, 0);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(40, -2);
            ctx.lineTo(46, 0);
            ctx.lineTo(40, 2);
            ctx.closePath();
            ctx.fillStyle = MATERIAL_COLOR.steel;
            ctx.fill();
            ctx.strokeStyle = MATERIAL_COLOR.gold;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, -5);
            ctx.lineTo(0, 5);
            ctx.stroke();
            ctx.strokeStyle = MATERIAL_COLOR.leather;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-8, 0);
            ctx.stroke();
            break;
        case 'bow':
            // 弓：弧线
            ctx.strokeStyle = MATERIAL_COLOR.wood;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 35, -Math.PI/3, Math.PI/3, false);
            ctx.stroke();
            // 弓弦
            ctx.strokeStyle = '#d4d0b8';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, -30);
            ctx.lineTo(0, 30);
            ctx.stroke();
            // 箭
            ctx.strokeStyle = MATERIAL_COLOR.wood;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(40, 0);
            ctx.stroke();
            ctx.fillStyle = glow.color;
            ctx.beginPath();
            ctx.moveTo(40, -3);
            ctx.lineTo(46, 0);
            ctx.lineTo(40, 3);
            ctx.closePath();
            ctx.fill();
            break;
        default:
            // 默认：细线
            ctx.strokeStyle = MATERIAL_COLOR.steel;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(50, 0);
            ctx.stroke();
    }
    ctx.restore();
}

// ===================== 头盔（圆润版） =====================
function drawHelmet(ctx, helmet) {
    if (!helmet) return;
    const head = SKELETON.head;
    const quality = helmet.quality || 'white';
    const glow = QUALITY_GLOW[quality];

    ctx.save();
    ctx.translate(head.x, head.y);

    ctx.shadowBlur = 0;  // v23: disabled for perf
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const type = helmet.helmetType || helmet.subType || 'iron';
    switch (type) {
        case 'leather':
            // 皮革帽：圆滑半圆 + 圆边带
            ctx.fillStyle = MATERIAL_COLOR.leather;
            ctx.beginPath();
            ctx.arc(0, -4, head.r + 2, Math.PI, 2 * Math.PI);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = glow.color;
            ctx.lineWidth = 1;
            ctx.stroke();
            // 帽带（圆滑）
            ctx.strokeStyle = MATERIAL_COLOR.leather;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-head.r - 2, -2);
            ctx.quadraticCurveTo(0, -1, head.r + 2, -2);
            ctx.stroke();
            break;
        case 'iron':
            // 铁盔：圆顶 + 圆顶饰 + 圆鼻梁
            ctx.fillStyle = MATERIAL_COLOR.iron;
            ctx.beginPath();
            ctx.arc(0, -2, head.r + 2, Math.PI, 2 * Math.PI);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = glow.color;
            ctx.lineWidth = 1;
            ctx.stroke();
            // 顶饰（圆点 + 圆顶）
            ctx.fillStyle = MATERIAL_COLOR.steel;
            ctx.beginPath();
            ctx.arc(0, -head.r - 6, 4, 0, Math.PI * 2);
            ctx.fill();
            // 顶部小球（圆锥已变圆球）
            ctx.fillStyle = MATERIAL_COLOR.gold;
            ctx.beginPath();
            ctx.arc(0, -head.r - 10, 2.5, 0, Math.PI * 2);
            ctx.fill();
            // 鼻梁（圆滑）
            ctx.fillStyle = MATERIAL_COLOR.steel;
            ctx.beginPath();
            ctx.roundRect(-2, -head.r, 4, head.r + 2, 2);
            ctx.fill();
            ctx.strokeStyle = glow.color;
            ctx.lineWidth = 1;
            ctx.stroke();
            break;
        case 'horned':
            // 牛角盔：圆顶 + 圆锥角（粗壮 + 圆头）
            ctx.fillStyle = MATERIAL_COLOR.iron;
            ctx.beginPath();
            ctx.arc(0, -2, head.r + 2, Math.PI, 2 * Math.PI);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = glow.color;
            ctx.lineWidth = 1;
            ctx.stroke();
            // 左角（圆锥粗壮）
            ctx.strokeStyle = MATERIAL_COLOR.bone;
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-head.r - 2, -4);
            ctx.bezierCurveTo(-head.r - 10, -12, -head.r - 16, -16, -head.r - 18, -22);
            ctx.stroke();
            // 角尖小圆球
            ctx.fillStyle = MATERIAL_COLOR.bone;
            ctx.beginPath();
            ctx.arc(-head.r - 18, -22, 3, 0, Math.PI * 2);
            ctx.fill();
            // 右角
            ctx.beginPath();
            ctx.moveTo(head.r + 2, -4);
            ctx.bezierCurveTo(head.r + 10, -12, head.r + 16, -16, head.r + 18, -22);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(head.r + 18, -22, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = glow.color;
            ctx.lineWidth = 1;
            ctx.stroke();
            break;
        case 'crown':
            // 王冠：圆滑 5 球顶 + 半球底
            ctx.fillStyle = MATERIAL_COLOR.gold;
            ctx.beginPath();
            ctx.moveTo(-head.r - 4, 0);
            ctx.lineTo(-head.r - 4, -8);
            ctx.quadraticCurveTo(-head.r - 4, -10, -head.r - 2, -10);
            ctx.quadraticCurveTo(-head.r - 1, -12, 0, -10);
            ctx.quadraticCurveTo(head.r + 1, -12, head.r + 2, -10);
            ctx.quadraticCurveTo(head.r + 4, -10, head.r + 4, -8);
            ctx.lineTo(head.r + 4, 0);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = glow.color;
            ctx.lineWidth = 1;
            ctx.stroke();
            // 顶部圆球
            ctx.fillStyle = MATERIAL_COLOR.gold;
            [-head.r - 2, -head.r + 4, 0, head.r - 4, head.r + 2].forEach((x, i) => {
                ctx.beginPath();
                ctx.arc(x, -12 - (i % 2 === 0 ? 2 : 0), 2.5, 0, Math.PI * 2);
                ctx.fill();
            });
            // 宝石
            ctx.fillStyle = glow.color;

            ctx.shadowBlur = 0;  // v23: disabled for perf
            ctx.beginPath();
            ctx.arc(0, -14, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;  // v23: disabled for perf
            break;
        case 'shadow':
            // 阴影兜帽：圆滑流线
            ctx.fillStyle = MATERIAL_COLOR.shadow;
            ctx.beginPath();
            ctx.moveTo(-head.r - 6, -8);
            ctx.quadraticCurveTo(-head.r - 10, -2, -head.r - 6, head.r + 4);
            ctx.lineTo(head.r + 6, head.r + 4);
            ctx.quadraticCurveTo(head.r + 10, -2, head.r + 6, -8);
            ctx.quadraticCurveTo(0, -2, -head.r - 6, -8);
            // 头部圆
            ctx.quadraticCurveTo(0, -head.r - 4, -head.r - 6, -8);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = 'rgba(244,67,54,0.4)';
            ctx.lineWidth = 1;
            ctx.stroke();
            // 眼孔（红光）
            ctx.fillStyle = glow.color;

            ctx.shadowBlur = 0;  // v23: disabled for perf
            ctx.beginPath();
            ctx.arc(-5, 0, 2, 0, Math.PI * 2);
            ctx.arc(5, 0, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;  // v23: disabled for perf
            break;
        default:
            // 默认圆顶
            ctx.fillStyle = MATERIAL_COLOR.iron;
            ctx.beginPath();
            ctx.arc(0, -2, head.r + 2, Math.PI, 2 * Math.PI);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = glow.color;
            ctx.lineWidth = 1;
            ctx.stroke();
    }
    ctx.restore();
}

// ===================== 护甲（圆润版） =====================
function drawArmor(ctx, body, armor) {
    if (!body) return;
    const quality = body.quality || 'white';
    const glow = QUALITY_GLOW[quality];
    const type = body.armorType || body.subType || 'leather';

    ctx.save();
    ctx.translate(SKELETON.torsoTop.x, (SKELETON.torsoTop.y + SKELETON.torsoBottom.y) / 2);

    ctx.shadowBlur = 0;  // v23: disabled for perf
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const W = 24, H = 30;  // 柔和胸甲宽高

    switch (type) {
        case 'leather':
            // 皮革：圆润马甲（bezier 曲线 + 中线缝）
            ctx.fillStyle = MATERIAL_COLOR.leather;
            ctx.beginPath();
            ctx.moveTo(-W, 0);
            ctx.bezierCurveTo(-W, 5, -W + 2, H - 4, -W + 4, H);
            ctx.lineTo(W - 4, H);
            ctx.bezierCurveTo(W - 2, H - 4, W, 5, W, 0);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = glow.color;
            ctx.lineWidth = 1;
            ctx.stroke();

            // 缝线（曲线）
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(0, 4);
            ctx.quadraticCurveTo(0.5, 18, 0, H - 4);
            ctx.stroke();
            // 腰线
            ctx.beginPath();
            ctx.moveTo(-W + 5, H - 4);
            ctx.quadraticCurveTo(0, H - 1, W - 5, H - 4);
            ctx.stroke();
            break;
        case 'plate':
            // 板甲：圆润护胸 + 圆肩 + 圆形徽
            ctx.fillStyle = MATERIAL_COLOR.steel;
            ctx.beginPath();
            ctx.moveTo(-W - 2, 0);
            ctx.bezierCurveTo(-W - 2, 8, -W, H - 4, -W + 3, H);
            ctx.lineTo(W - 3, H);
            ctx.bezierCurveTo(W, H - 4, W + 2, 8, W + 2, 0);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = glow.color;
            ctx.lineWidth = 1;
            ctx.stroke();

            // 圆肩（圆润球形）
            ctx.fillStyle = MATERIAL_COLOR.iron;
            ctx.beginPath();
            ctx.arc(-W - 2, 4, 5, 0, Math.PI * 2);
            ctx.arc(W + 2, 4, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = glow.color;
            ctx.lineWidth = 1;
            ctx.stroke();

            // 胸口徽章（圆形 + 十字）
            ctx.fillStyle = MATERIAL_COLOR.gold;
            ctx.beginPath();
            ctx.arc(0, 12, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#1a1208';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.strokeStyle = glow.color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, 9);
            ctx.lineTo(0, 15);
            ctx.moveTo(-3, 12);
            ctx.lineTo(3, 12);
            ctx.stroke();

            // 胸甲分割线（圆滑）
            ctx.strokeStyle = 'rgba(0,0,0,0.4)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(0, 4);
            ctx.quadraticCurveTo(0, 14, 0, 20);
            ctx.stroke();
            break;
        case 'robe':
            // 长袍：圆滑长摆（曲线勾勒）
            ctx.fillStyle = MATERIAL_COLOR.robe;
            ctx.beginPath();
            ctx.moveTo(-W, 0);
            ctx.bezierCurveTo(-W, 12, -W - 4, 24, -W - 6, H + 8);
            ctx.lineTo(W + 6, H + 8);
            ctx.bezierCurveTo(W + 4, 24, W, 12, W, 0);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = glow.color;
            ctx.lineWidth = 1;
            ctx.stroke();

            // 中心符文（圆形 + 弧线）
            ctx.strokeStyle = glow.color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(0, 18, 6, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = glow.color;
            ctx.beginPath();
            ctx.arc(0, 18, 2, 0, Math.PI * 2);
            ctx.fill();
            // 弧线装饰
            ctx.beginPath();
            ctx.arc(0, 18, 9, Math.PI * 1.2, Math.PI * 1.8, false);
            ctx.stroke();
            break;
        case 'chain':
            // 锁子甲：圆滑胸 + 金属链点
            ctx.fillStyle = MATERIAL_COLOR.iron;
            ctx.globalAlpha = 0.7;
            ctx.beginPath();
            ctx.moveTo(-W, 0);
            ctx.bezierCurveTo(-W, 10, -W - 2, 22, -W, H);
            ctx.lineTo(W, H);
            ctx.bezierCurveTo(W + 2, 22, W, 10, W, 0);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.strokeStyle = glow.color;
            ctx.lineWidth = 1;
            ctx.stroke();

            // 链点（稀疏更精致）
            ctx.fillStyle = MATERIAL_COLOR.steel;
            for (let y = 4; y < H - 2; y += 5) {
                for (let x = -W + 4; x < W - 2; x += 5) {
                    ctx.beginPath();
                    ctx.arc(x, y, 1, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            break;
        default:
            // 默认：圆滑马甲
            ctx.fillStyle = MATERIAL_COLOR.leather;
            ctx.beginPath();
            ctx.moveTo(-W, 0);
            ctx.bezierCurveTo(-W, 6, -W + 2, H - 4, -W + 4, H);
            ctx.lineTo(W - 4, H);
            ctx.bezierCurveTo(W - 2, H - 4, W, 6, W, 0);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = glow.color;
            ctx.lineWidth = 1;
            ctx.stroke();
    }
    ctx.restore();
}

// ===================== 披风 =====================
function drawCloak(ctx, cloak) {
    if (!cloak) return;
    const quality = cloak.quality || 'white';
    const glow = QUALITY_GLOW[quality];

    ctx.save();
    ctx.translate(SKELETON.shoulderL.x, SKELETON.shoulderL.y + 8);

    ctx.shadowBlur = 0;  // v23: disabled for perf

    const baseColor = cloak.capeColor || MATERIAL_COLOR.robe;
    ctx.fillStyle = baseColor;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(44, 0);
    ctx.lineTo(60, 80);
    ctx.lineTo(-16, 80);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = glow.color;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
}

// ===================== 手套 =====================
function drawGloves(ctx, hand, gloves) {
    if (!gloves) return;
    const quality = gloves.quality || 'white';
    const glow = QUALITY_GLOW[quality];

    ctx.save();

    ctx.shadowBlur = 0;  // v23: disabled for perf

    ctx.fillStyle = gloves.color || MATERIAL_COLOR.iron;
    ctx.beginPath();
    ctx.arc(hand.x, hand.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = glow.color;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
}

// ===================== 靴子（圆润版） =====================
function drawBoots(ctx, foot, footpad, boots) {
    if (!boots) return;
    const quality = boots.quality || 'white';
    const glow = QUALITY_GLOW[quality];

    ctx.save();

    ctx.shadowBlur = 0;  // v23: disabled for perf
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const type = boots.bootsType || boots.subType || 'leather';
    const color = boots.color || MATERIAL_COLOR.leather;
    ctx.fillStyle = color;
    switch (type) {
        case 'leather':
            // 简靴：椭圆 + 圆角矩形
            ctx.beginPath();
            ctx.ellipse(footpad.x - 4, footpad.y - 4, 12, 7, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = glow.color;
            ctx.lineWidth = 1;
            ctx.stroke();
            // 鞋舌（圆弧）
            ctx.beginPath();
            ctx.arc(footpad.x + 4, footpad.y - 6, 4, Math.PI, 2 * Math.PI);
            ctx.fill();
            break;
        case 'iron':
            // 铁靴：圆滑靴筒 + 圆头
            ctx.beginPath();
            ctx.roundRect(footpad.x - 14, footpad.y - 10, 22, 8, 4);
            ctx.fill();
            ctx.strokeStyle = glow.color;
            ctx.lineWidth = 1;
            ctx.stroke();
            // 圆头（突出）
            ctx.beginPath();
            ctx.arc(footpad.x + 8, footpad.y - 6, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            // 铆钉（圆点）
            ctx.fillStyle = MATERIAL_COLOR.gold;
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.arc(footpad.x - 10 + i * 6, footpad.y - 6, 1, 0, Math.PI * 2);
                ctx.fill();
            }
            break;
        case 'magic':
            // 魔法靴：发光 + 符文
            ctx.fillStyle = MATERIAL_COLOR.crystal;
            ctx.beginPath();
            ctx.ellipse(footpad.x - 4, footpad.y - 4, 12, 7, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = glow.color;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            // 中心符文

            ctx.shadowBlur = 0;  // v23: disabled for perf
            ctx.fillStyle = glow.color;
            ctx.beginPath();
            ctx.arc(footpad.x - 4, footpad.y - 4, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;  // v23: disabled for perf
            // 圆点装饰
            ctx.fillStyle = glow.color;
            ctx.beginPath();
            ctx.arc(footpad.x - 10, footpad.y - 4, 1, 0, Math.PI * 2);
            ctx.arc(footpad.x + 4, footpad.y - 4, 1, 0, Math.PI * 2);
            ctx.fill();
            break;
        default:
            // 默认圆滑靴
            ctx.beginPath();
            ctx.ellipse(footpad.x - 4, footpad.y - 4, 12, 7, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = glow.color;
            ctx.lineWidth = 1;
            ctx.stroke();
    }
    ctx.restore();
}

// ===================== 主渲染 =====================
export class StickFigure {
    constructor(opts = {}) {
        this.x = opts.x || 0;
        this.y = opts.y || 0;
        this.scale = opts.scale || 1;
        this.facing = opts.facing || 1; // 1 = 右，-1 = 左
        this.equipment = opts.equipment || {};
        this.animState = 'idle'; // idle / attack / hit / death
        this.animT = 0;          // 0..1 动画进度
        this.baseColor = opts.color || '#d4b97a';
        this.tint = opts.tint || null; // 受击变色
        this.shadow = opts.shadow !== false;
    }

    /**
     * 设置装备槽（9 个槽）
     * @param {object} equipment { helmet, armor, cloak, weapon, glovesL, glovesR, bootsL, bootsR, back }
     */
    setEquipment(equipment) {
        this.equipment = { ...this.equipment, ...equipment };
    }

    /**
     * 触发一次性动画
     */
    triggerAnim(state, duration = 400) {
        this.animState = state;
        this.animT = 0;
        this.animDuration = duration;
    }

    update(dt) {
        if (this.animT < 1) {
            this.animT += dt / (this.animDuration || 400);
            if (this.animT >= 1) {
                this.animT = 1;
                if (this.animState !== 'idle') {
                    this.animState = 'idle';
                }
            }
        }
    }

    /**
     * 渲染火柴人
     * ctx 已 translate 到 (this.x, this.y) 的脚底
     */
    render(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        // 缩小 0.85 让整体更紧凑（默认 scale 1.0 → 0.85）
        ctx.scale(this.scale * this.facing * 0.85, this.scale * 0.85);

        // v24：纯净线条（不再用全局 5.5 lineWidth，由 render 内部细分明定：腿 4.5 / 头描边 1.2）
        // ⚠️ 禁用 shadowBlur：每帧每个 stroke 都会触发高斯模糊，严重拖慢首屏渲染
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // 受击变色
        const baseColor = this.tint || this.baseColor;

        // 攻击时身体向敌人方向倾斜
        if (this.animState === 'attack') {
            const lean = 0.15 * (1 - this.animT);
            ctx.rotate(lean);
        }
        // 受击时向后倾
        if (this.animState === 'hit') {
            const lean = -0.3 * (1 - this.animT);
            ctx.rotate(lean);
        }

        // 阴影（柔和椭圆）
        if (this.shadow) {
            const shadowGrad = ctx.createRadialGradient(0, 2, 4, 0, 2, 28);
            shadowGrad.addColorStop(0, 'rgba(0,0,0,0.5)');
            shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = shadowGrad;
            ctx.beginPath();
            ctx.ellipse(0, 2, 28, 5, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // 受击白闪（在画线之前）
        const isFlashing = this.animState === 'hit' && this.animT < 0.3;
        const strokeColor = isFlashing ? '#fff' : baseColor;

        // === 全局圆角设置（关键：让所有线条/填充都圆润）===
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // === v24：纯净线条火柴人（Stick War 风格）===
// 绘制顺序：腿 → 躯干 → 双臂 → 头 → 武器
// 完全不画装备装饰（头盔/护甲/披风/手套/战靴/眼睛/嘴/头发/腰带/关节圆）—— 干净克制优先

        // === 1. 腿（单线 bezier，圆头粗线）===
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = baseColor;
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.moveTo(SKELETON.hip.x, SKELETON.hip.y);
        ctx.quadraticCurveTo(SKELETON.kneeL.x, SKELETON.hip.y - 12, SKELETON.footL.x, SKELETON.footL.y);
        ctx.moveTo(SKELETON.hip.x, SKELETON.hip.y);
        ctx.quadraticCurveTo(SKELETON.kneeR.x, SKELETON.hip.y - 12, SKELETON.footR.x, SKELETON.footR.y);
        ctx.stroke();

        // === 2. 躯干（单线 neck → hip）===
        ctx.beginPath();
        ctx.moveTo(SKELETON.neck.x, SKELETON.neck.y);
        ctx.lineTo(SKELETON.hip.x, SKELETON.hip.y);
        ctx.stroke();

        // === 3. 双臂（bezier 弯曲）===
        // 攻击时武器臂向前挥
        let weaponHand = SKELETON.handR;
        let otherHand = SKELETON.handL;
        if (this.animState === 'attack') {
            const swing = 0.4 * Math.sin(this.animT * Math.PI);  // 0 → 1 → 0
            weaponHand = {
                x: SKELETON.handR.x + swing * 30,
                y: SKELETON.handR.y - swing * 50
            };
        }
        // 武器臂：肩 → 肘 → 手
        ctx.beginPath();
        ctx.moveTo(SKELETON.shoulderR.x, SKELETON.shoulderR.y);
        ctx.quadraticCurveTo(
            SKELETON.elbowR.x + (weaponHand.x - SKELETON.handR.x) * 0.5,
            SKELETON.elbowR.y + (weaponHand.y - SKELETON.handR.y) * 0.5 - 8,
            weaponHand.x, weaponHand.y
        );
        ctx.stroke();
        // 另一只手臂（静止）
        ctx.beginPath();
        ctx.moveTo(SKELETON.shoulderL.x, SKELETON.shoulderL.y);
        ctx.quadraticCurveTo(
            SKELETON.elbowL.x,
            SKELETON.elbowL.y - 6,
            otherHand.x, otherHand.y
        );
        ctx.stroke();

        // === 4. 头（实心圆 + 描边，无任何五官/头发装饰）===
        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.arc(SKELETON.head.x, SKELETON.head.y, SKELETON.head.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#3a2810';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // === 5. 武器（不放任何装备）===
        drawWeapon(ctx, weaponHand, this.equipment.weapon, this.equipment.weapon?.quality);

        // === 死亡淡出 ===
        if (this.animState === 'death') {
            ctx.globalAlpha = 1 - this.animT;
        }

        ctx.restore();
    }
}

// 暴露辅助工具
export { SKELETON, QUALITY_GLOW, QUALITY_TINT, MATERIAL_COLOR };
