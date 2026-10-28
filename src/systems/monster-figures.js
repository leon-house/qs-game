/**
 * 怪物火柴人造型库 · 10 种怪物变体
 *
 * 每个怪物通过具体绘制函数返回，无需图片素材
 * 渲染坐标系：以怪物脚底为 (0,0)
 *   怪物基础高度 180px（与主角一致）
 *
 * 调用方式：
 *   renderMonster(ctx, 'zombie', x, y, hpRatio, scale)
 */

const MONSTER_DEFS = {
    // ============ 普通怪物 ============
    zombie: {
        name: '丧尸',
        baseColor: '#7a8a5a',
        eyeColor: '#f5d676',
        scale: 1.0,
        draw: drawZombie
    },
    dog: {
        name: '野狗',
        baseColor: '#8a6a4a',
        eyeColor: '#f87171',
        scale: 0.85,
        draw: drawDog
    },
    rat: {
        name: '巨鼠',
        baseColor: '#5a4a6a',
        eyeColor: '#f87171',
        scale: 0.6,
        draw: drawRat
    },
    shadow: {
        name: '暗影',
        baseColor: '#1a1a2a',
        eyeColor: '#a78bfa',
        scale: 1.0,
        draw: drawShadow
    },
    skeleton: {
        name: '骷髅',
        baseColor: '#d4d0b8',
        eyeColor: '#fbbf24',
        scale: 1.0,
        draw: drawSkeleton
    },
    spider: {
        name: '变异蜘蛛',
        baseColor: '#3a2a1a',
        eyeColor: '#f87171',
        scale: 0.8,
        draw: drawSpider
    },
    lizard: {
        name: '沙漠蜥蜴',
        baseColor: '#8a7a4a',
        eyeColor: '#fbbf24',
        scale: 0.9,
        draw: drawLizard
    },
    cyberdog: {
        name: '机械狗',
        baseColor: '#5a6a7a',
        eyeColor: '#22d3ee',
        scale: 0.9,
        draw: drawCyberdog
    },
    boar: {
        name: '变异野猪',
        baseColor: '#6a4a3a',
        eyeColor: '#fbbf24',
        scale: 1.1,
        draw: drawBoar
    },
    snake: {
        name: '沙漠毒蛇',
        baseColor: '#5a6a3a',
        eyeColor: '#f87171',
        scale: 0.7,
        draw: drawSnake
    }
};

// ============ 通用：旋转 ============
function rotateCtx(ctx, angle) {
    ctx.rotate(angle);
}

// ============ 通用：HP 血条（2026-08-04 关闭：统一由 battle-canvas 顶部血条展示） ============
function drawHpBar(ctx, hpRatio, w = 50, h = 5) {
    // 留空，怪物自身不再画血条（统一在 battle-canvas 顶部展示）
    return;
}

// ============ 通用：名字（2026-08-04 关闭：统一在 battle-canvas 顶部展示） ============
function drawName(ctx, name, color = '#f5e1a4') {
    // 留空，怪物自身不再画名字
    return;
}

// ============ 通用：受击白闪 ============
function withHitFlash(ctx, hitState, drawFn) {
    ctx.save();
    if (hitState && hitState.flash) {
        ctx.globalCompositeOperation = 'source-over';
    }
    drawFn();
    ctx.restore();
}

// ============ 1. 丧尸（hunched, 棕色） ============
function drawZombie(opts) {
    const { ctx, baseColor, eyeColor, hpRatio, hitState, name } = opts;
    const isFlashing = hitState?.flash;

    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 28, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineCap = 'round';
    ctx.lineWidth = 4;
    ctx.strokeStyle = isFlashing ? '#fff' : baseColor;

    // 弓腰（身体前倾）
    ctx.save();
    ctx.translate(0, -90);
    ctx.rotate(0.15);

    // 右臂（向前伸）
    ctx.beginPath();
    ctx.moveTo(0, -60);
    ctx.lineTo(15, -45);
    ctx.lineTo(35, -55);
    ctx.stroke();
    // 左手
    ctx.beginPath();
    ctx.moveTo(0, -60);
    ctx.lineTo(-15, -45);
    ctx.lineTo(-30, -30);
    ctx.stroke();
    // 腿
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-12, 50);
    ctx.lineTo(-18, 90);
    ctx.moveTo(0, 0);
    ctx.lineTo(12, 50);
    ctx.lineTo(14, 90);
    ctx.stroke();
    // 躯干
    ctx.beginPath();
    ctx.moveTo(0, -60);
    ctx.lineTo(0, 0);
    ctx.stroke();

    // 头部（耷拉）
    ctx.translate(0, -78);
    ctx.rotate(0.2);
    ctx.fillStyle = isFlashing ? '#fff' : baseColor;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    // 眼睛
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.arc(-5, 2, 2, 0, Math.PI * 2);
    ctx.arc(5, 2, 2, 0, Math.PI * 2);
    ctx.fill();
    // 嘴
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-4, 8);
    ctx.lineTo(4, 8);
    ctx.stroke();
    // 血迹
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(8, 5, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // 名字 + HP
    drawName(ctx, name || '丧尸');
    drawHpBar(ctx, hpRatio);
}

// ============ 2. 野狗（4 腿，棕色） ============
function drawDog(opts) {
    const { ctx, baseColor, eyeColor, hpRatio, hitState, name } = opts;
    const isFlashing = hitState?.flash;

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 35, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineCap = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = isFlashing ? '#fff' : baseColor;

    // 身体（长椭圆形）
    ctx.fillStyle = isFlashing ? '#fff' : baseColor;
    ctx.beginPath();
    ctx.ellipse(0, -85, 35, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 4 条腿
    ctx.lineWidth = 3;
    ctx.beginPath();
    // 前左
    ctx.moveTo(-18, -68);
    ctx.lineTo(-22, -10);
    // 前右
    ctx.moveTo(18, -68);
    ctx.lineTo(22, -10);
    // 后左
    ctx.moveTo(-22, -100);
    ctx.lineTo(-26, -10);
    // 后右
    ctx.moveTo(22, -100);
    ctx.lineTo(26, -10);
    ctx.stroke();

    // 尾巴（翘起）
    ctx.beginPath();
    ctx.moveTo(28, -90);
    ctx.quadraticCurveTo(45, -100, 48, -78);
    ctx.stroke();

    // 头部
    ctx.fillStyle = isFlashing ? '#fff' : baseColor;
    ctx.beginPath();
    ctx.ellipse(35, -90, 12, 10, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 耳朵（尖）
    ctx.beginPath();
    ctx.moveTo(28, -100);
    ctx.lineTo(22, -114);
    ctx.lineTo(32, -102);
    ctx.closePath();
    ctx.fillStyle = isFlashing ? '#fff' : baseColor;
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(40, -100);
    ctx.lineTo(46, -116);
    ctx.lineTo(44, -100);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 嘴 + 舌头
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.ellipse(48, -84, 3, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.arc(40, -92, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // 利牙
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(46, -86);
    ctx.lineTo(48, -82);
    ctx.lineTo(46, -82);
    ctx.closePath();
    ctx.fill();

    // 名字 + HP
    drawName(ctx, name || '野狗');
    drawHpBar(ctx, hpRatio);
}

// ============ 3. 巨鼠（小，深紫 + 长尾） ============
function drawRat(opts) {
    const { ctx, baseColor, eyeColor, hpRatio, hitState, name } = opts;
    const isFlashing = hitState?.flash;

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 30, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineCap = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = isFlashing ? '#fff' : baseColor;

    // 身体（低矮椭圆）
    ctx.fillStyle = isFlashing ? '#fff' : baseColor;
    ctx.beginPath();
    ctx.ellipse(0, -50, 35, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 4 条腿（短）
    ctx.beginPath();
    ctx.moveTo(-15, -38);
    ctx.lineTo(-18, -8);
    ctx.moveTo(15, -38);
    ctx.lineTo(18, -8);
    ctx.moveTo(-22, -55);
    ctx.lineTo(-25, -8);
    ctx.moveTo(22, -55);
    ctx.lineTo(25, -8);
    ctx.stroke();

    // 长尾巴（蛇形）
    ctx.strokeStyle = isFlashing ? '#fff' : baseColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(30, -50);
    ctx.bezierCurveTo(50, -50, 60, -70, 70, -60);
    ctx.bezierCurveTo(75, -55, 80, -65, 85, -55);
    ctx.stroke();

    // 头部（尖）
    ctx.fillStyle = isFlashing ? '#fff' : baseColor;
    ctx.beginPath();
    ctx.moveTo(35, -50);
    ctx.lineTo(45, -55);
    ctx.lineTo(45, -45);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 耳朵（圆）
    ctx.beginPath();
    ctx.arc(32, -62, 4, 0, Math.PI * 2);
    ctx.arc(38, -62, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 眼睛（红）
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.arc(40, -50, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // 牙
    ctx.fillStyle = '#fff';
    ctx.fillRect(42, -47, 1, 3);
    ctx.fillRect(40, -47, 1, 3);

    // 胡须
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(40, -48);
    ctx.lineTo(55, -50);
    ctx.moveTo(40, -50);
    ctx.lineTo(55, -52);
    ctx.stroke();

    drawName(ctx, name || '巨鼠');
    drawHpBar(ctx, hpRatio);
}

// ============ 4. 暗影（深色 + 紫色眼睛） ============
function drawShadow(opts) {
    const { ctx, baseColor, eyeColor, hpRatio, hitState, name } = opts;
    const isFlashing = hitState?.flash;

    // 阴影没有阴影（概念冲突）
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 30, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineCap = 'round';
    ctx.lineWidth = 4;
    ctx.strokeStyle = isFlashing ? '#fff' : baseColor;

    // 腿（细长）
    ctx.beginPath();
    ctx.moveTo(0, -90);
    ctx.lineTo(-14, -30);
    ctx.lineTo(-22, 0);
    ctx.moveTo(0, -90);
    ctx.lineTo(14, -30);
    ctx.lineTo(22, 0);
    ctx.stroke();

    // 躯干（细长烟雾）
    ctx.fillStyle = isFlashing ? '#fff' : baseColor;
    ctx.beginPath();
    ctx.moveTo(0, -150);
    ctx.lineTo(-12, -90);
    ctx.lineTo(-14, -30);
    ctx.lineTo(0, 0);
    ctx.lineTo(14, -30);
    ctx.lineTo(12, -90);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 头部（无脸）
    ctx.beginPath();
    ctx.arc(0, -160, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 眼睛（紫光）
    ctx.shadowColor = eyeColor;
    ctx.shadowBlur = 6;
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.arc(-5, -160, 2, 0, Math.PI * 2);
    ctx.arc(5, -160, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 烟雾痕迹（随机小点）
    ctx.fillStyle = 'rgba(167,139,250,0.4)';
    for (let i = 0; i < 8; i++) {
        const x = Math.sin(i * 2.5) * 20;
        const y = -50 - i * 12;
        ctx.beginPath();
        ctx.arc(x, y, 1 + (i % 2), 0, Math.PI * 2);
        ctx.fill();
    }

    drawName(ctx, name || '暗影', '#a78bfa');
    drawHpBar(ctx, hpRatio);
}

// ============ 5. 骷髅（白骨色） ============
function drawSkeleton(opts) {
    const { ctx, baseColor, eyeColor, hpRatio, hitState, name } = opts;
    const isFlashing = hitState?.flash;

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 28, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineCap = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = isFlashing ? '#fff' : baseColor;

    // 腿（细）
    ctx.beginPath();
    ctx.moveTo(0, -90);
    ctx.lineTo(-12, -40);
    ctx.lineTo(-15, 0);
    ctx.moveTo(0, -90);
    ctx.lineTo(12, -40);
    ctx.lineTo(15, 0);
    ctx.stroke();

    // 肋骨（横线）
    ctx.lineWidth = 2;
    for (let y = -80; y <= -50; y += 8) {
        ctx.beginPath();
        ctx.moveTo(-12, y);
        ctx.lineTo(12, y);
        ctx.stroke();
    }
    // 脊柱
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -150);
    ctx.lineTo(0, -90);
    ctx.stroke();

    // 头骨
    ctx.fillStyle = isFlashing ? '#fff' : baseColor;
    ctx.beginPath();
    ctx.arc(0, -160, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 眼洞（黑色）
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(-5, -160, 4, 0, Math.PI * 2);
    ctx.arc(5, -160, 4, 0, Math.PI * 2);
    ctx.fill();
    // 眼洞内的橙色光
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.arc(-5, -160, 1.5, 0, Math.PI * 2);
    ctx.arc(5, -160, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // 牙齿（横线）
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    for (let x = -5; x <= 5; x += 2) {
        ctx.beginPath();
        ctx.moveTo(x, -154);
        ctx.lineTo(x, -150);
        ctx.stroke();
    }

    // 肩膀 + 手臂
    ctx.strokeStyle = isFlashing ? '#fff' : baseColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-12, -150);
    ctx.lineTo(-30, -110);
    ctx.lineTo(-35, -85);
    ctx.moveTo(12, -150);
    ctx.lineTo(30, -110);
    ctx.lineTo(35, -85);
    ctx.stroke();

    drawName(ctx, name || '骷髅', '#d4d0b8');
    drawHpBar(ctx, hpRatio);
}

// ============ 6. 蜘蛛（8 条腿 + 圆身体） ============
function drawSpider(opts) {
    const { ctx, baseColor, eyeColor, hpRatio, hitState, name } = opts;
    const isFlashing = hitState?.flash;

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 30, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineCap = 'round';
    ctx.strokeStyle = isFlashing ? '#fff' : baseColor;

    // 8 条腿（4 对）
    const legAngles = [
        [-0.9, -25], [-0.5, -38], [-0.2, -42], [0.2, -38],
        [0.5, -25], [0.9, -10]   // 简化只画 6 条
    ];
    ctx.lineWidth = 2;
    legAngles.forEach(([angle, len]) => {
        ctx.beginPath();
        ctx.moveTo(0, -50);
        ctx.lineTo(Math.cos(angle) * len, -50 + Math.sin(angle) * len);
        ctx.stroke();
    });

    // 身体（圆球）
    ctx.fillStyle = isFlashing ? '#fff' : baseColor;
    ctx.beginPath();
    ctx.arc(0, -55, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 头胸部（小圆）
    ctx.beginPath();
    ctx.arc(0, -85, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 眼睛（红色 8 眼）
    ctx.fillStyle = eyeColor;
    for (let r = 0; r < 2; r++) {
        for (let i = 0; i < 4; i++) {
            const x = -4 + i * 3;
            const y = -85 - r * 3;
            ctx.beginPath();
            ctx.arc(x, y, 0.8, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // 毒牙
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-2, -78);
    ctx.lineTo(-3, -74);
    ctx.moveTo(2, -78);
    ctx.lineTo(3, -74);
    ctx.stroke();

    // 屁股上的图案（沙漏）
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(0, -45, 2, 0, Math.PI * 2);
    ctx.fill();

    drawName(ctx, name || '变异蜘蛛');
    drawHpBar(ctx, hpRatio);
}

// ============ 7. 沙漠蜥蜴（4 腿 + 长尾） ============
function drawLizard(opts) {
    const { ctx, baseColor, eyeColor, hpRatio, hitState, name } = opts;
    const isFlashing = hitState?.flash;

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 30, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineCap = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = isFlashing ? '#fff' : baseColor;

    // 身体（低矮长条）
    ctx.fillStyle = isFlashing ? '#fff' : baseColor;
    ctx.beginPath();
    ctx.ellipse(0, -55, 40, 12, -0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 4 条腿（弯曲）
    ctx.beginPath();
    ctx.moveTo(-18, -50);
    ctx.quadraticCurveTo(-25, -25, -18, -8);
    ctx.moveTo(-8, -55);
    ctx.quadraticCurveTo(-15, -30, -8, -10);
    ctx.moveTo(18, -50);
    ctx.quadraticCurveTo(25, -25, 18, -8);
    ctx.moveTo(8, -55);
    ctx.quadraticCurveTo(15, -30, 8, -10);
    ctx.stroke();

    // 尾巴（长，按波浪）
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(38, -55);
    ctx.bezierCurveTo(55, -50, 65, -65, 75, -55);
    ctx.bezierCurveTo(82, -50, 88, -60, 95, -52);
    ctx.stroke();

    // 头部（尖）
    ctx.fillStyle = isFlashing ? '#fff' : baseColor;
    ctx.beginPath();
    ctx.moveTo(-40, -55);
    ctx.lineTo(-52, -60);
    ctx.lineTo(-52, -50);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 眼睛
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.arc(-44, -58, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // 舌头
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-52, -55);
    ctx.lineTo(-60, -54);
    ctx.lineTo(-58, -56);
    ctx.lineTo(-62, -55);
    ctx.stroke();

    // 背部条纹
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-25, -65);
    ctx.lineTo(-20, -68);
    ctx.moveTo(-15, -65);
    ctx.lineTo(-10, -68);
    ctx.moveTo(-5, -65);
    ctx.lineTo(0, -68);
    ctx.stroke();

    drawName(ctx, name || '沙漠蜥蜴');
    drawHpBar(ctx, hpRatio);
}

// ============ 8. 机械狗（金属 + 青色发光） ============
function drawCyberdog(opts) {
    const { ctx, baseColor, eyeColor, hpRatio, hitState, name } = opts;
    const isFlashing = hitState?.flash;

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 38, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineCap = 'round';
    ctx.strokeStyle = isFlashing ? '#fff' : baseColor;

    // 几何身体（梯形）
    ctx.fillStyle = isFlashing ? '#fff' : baseColor;
    ctx.beginPath();
    ctx.moveTo(-30, -68);
    ctx.lineTo(30, -68);
    ctx.lineTo(35, -100);
    ctx.lineTo(-35, -100);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.stroke();

    // 4 条腿（金属）
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-22, -68);
    ctx.lineTo(-25, -8);
    ctx.moveTo(-10, -68);
    ctx.lineTo(-13, -8);
    ctx.moveTo(22, -68);
    ctx.lineTo(25, -8);
    ctx.moveTo(10, -68);
    ctx.lineTo(13, -8);
    ctx.stroke();

    // 关节（圆）
    ctx.fillStyle = '#3a4a5a';
    [-22, -10, 22, 10].forEach(x => {
        ctx.beginPath();
        ctx.arc(x, -8, 2, 0, Math.PI * 2);
        ctx.fill();
    });

    // 头部（方块）
    ctx.fillStyle = isFlashing ? '#fff' : baseColor;
    ctx.beginPath();
    ctx.moveTo(28, -100);
    ctx.lineTo(48, -100);
    ctx.lineTo(48, -85);
    ctx.lineTo(28, -85);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 青色眼睛（发光）
    ctx.shadowColor = eyeColor;
    ctx.shadowBlur = 6;
    ctx.fillStyle = eyeColor;
    ctx.fillRect(32, -94, 4, 3);
    ctx.fillRect(40, -94, 4, 3);
    ctx.shadowBlur = 0;

    // 鼻部（金属方块）
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(46, -88, 3, 3);

    // 耳朵（天线）
    ctx.strokeStyle = '#5a6a7a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(32, -100);
    ctx.lineTo(28, -114);
    ctx.moveTo(44, -100);
    ctx.lineTo(48, -114);
    ctx.stroke();
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.arc(28, -114, 1.5, 0, Math.PI * 2);
    ctx.arc(48, -114, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // 尾巴（末端发光）
    ctx.strokeStyle = '#5a6a7a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-30, -100);
    ctx.lineTo(-45, -110);
    ctx.lineTo(-50, -120);
    ctx.stroke();
    ctx.shadowColor = eyeColor;
    ctx.shadowBlur = 6;
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.arc(-50, -120, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 背部线条（青色电路）
    ctx.strokeStyle = eyeColor;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(-25, -85);
    ctx.lineTo(25, -85);
    ctx.stroke();

    drawName(ctx, name || '机械狗', '#22d3ee');
    drawHpBar(ctx, hpRatio);
}

// ============ 9. 变异野猪（粗壮 + 獠牙） ============
function drawBoar(opts) {
    const { ctx, baseColor, eyeColor, hpRatio, hitState, name } = opts;
    const isFlashing = hitState?.flash;

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 40, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineCap = 'round';
    ctx.strokeStyle = isFlashing ? '#fff' : baseColor;

    // 粗壮身体
    ctx.fillStyle = isFlashing ? '#fff' : baseColor;
    ctx.beginPath();
    ctx.ellipse(0, -75, 45, 32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.stroke();

    // 4 条腿（粗）
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-28, -55);
    ctx.lineTo(-30, -8);
    ctx.moveTo(-15, -50);
    ctx.lineTo(-17, -8);
    ctx.moveTo(15, -50);
    ctx.lineTo(17, -8);
    ctx.moveTo(28, -55);
    ctx.lineTo(30, -8);
    ctx.stroke();

    // 头部（稍大）
    ctx.fillStyle = isFlashing ? '#fff' : baseColor;
    ctx.beginPath();
    ctx.ellipse(40, -85, 22, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.stroke();

    // 獠牙
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(55, -85);
    ctx.quadraticCurveTo(62, -82, 60, -78);
    ctx.moveTo(55, -90);
    ctx.quadraticCurveTo(62, -92, 60, -94);
    ctx.stroke();

    // 眼睛
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.arc(46, -90, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // 鼻孔
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(58, -82, 1, 0, Math.PI * 2);
    ctx.arc(58, -88, 1, 0, Math.PI * 2);
    ctx.fill();

    // 耳朵
    ctx.beginPath();
    ctx.moveTo(32, -100);
    ctx.lineTo(28, -110);
    ctx.lineTo(36, -106);
    ctx.closePath();
    ctx.fillStyle = isFlashing ? '#fff' : baseColor;
    ctx.fill();
    ctx.stroke();

    // 鬃毛（背部锯齿）
    ctx.strokeStyle = '#1a1208';
    ctx.lineWidth = 1.5;
    for (let x = -25; x <= 30; x += 6) {
        ctx.beginPath();
        ctx.moveTo(x, -107);
        ctx.lineTo(x + 1, -115);
        ctx.stroke();
    }

    drawName(ctx, name || '变异野猪');
    drawHpBar(ctx, hpRatio);
}

// ============ 10. 沙漠毒蛇（蛇形 + 三角形头） ============
function drawSnake(opts) {
    const { ctx, baseColor, eyeColor, hpRatio, hitState, name } = opts;
    const isFlashing = hitState?.flash;

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 35, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineCap = 'round';
    ctx.lineWidth = 4;
    ctx.strokeStyle = isFlashing ? '#fff' : baseColor;

    // 蛇身（蜿蜒 3 节）
    ctx.beginPath();
    ctx.moveTo(-40, -50);
    ctx.bezierCurveTo(-25, -70, -10, -30, 5, -50);
    ctx.bezierCurveTo(20, -70, 32, -30, 40, -45);
    ctx.stroke();

    // 鳞片（背部小点）
    ctx.fillStyle = '#fbbf24';
    for (let i = 0; i < 6; i++) {
        const t = i / 6;
        const x = -40 + t * 80;
        const y = -65 + Math.sin(t * Math.PI * 2) * 5;
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
    }

    // 头部（三角形）
    ctx.fillStyle = isFlashing ? '#fff' : baseColor;
    ctx.beginPath();
    ctx.moveTo(40, -45);
    ctx.lineTo(58, -52);
    ctx.lineTo(58, -38);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 眼睛（红）
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.arc(50, -46, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // 毒牙
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(56, -42);
    ctx.lineTo(58, -38);
    ctx.lineTo(54, -40);
    ctx.closePath();
    ctx.fill();

    // 信子（叉形）
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(58, -45);
    ctx.lineTo(64, -47);
    ctx.moveTo(58, -45);
    ctx.lineTo(64, -43);
    ctx.stroke();

    // 尾
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-40, -50);
    ctx.lineTo(-50, -50);
    ctx.stroke();

    drawName(ctx, name || '沙漠毒蛇');
    drawHpBar(ctx, hpRatio);
}

// ============ 公开 API ============
export function renderMonster(ctx, type, opts = {}) {
    const def = MONSTER_DEFS[type];
    if (!def) {
        console.warn(`[monster-figures] unknown type: ${type}`);
        return;
    }
    ctx.save();
    ctx.translate(opts.x || 0, opts.y || 0);
    // 缩小 0.85 让怪物更紧凑（默认 scale 1.0 → 0.85）
    ctx.scale((opts.scale || 1) * (opts.facing || 1) * 0.85, (opts.scale || 1) * 0.85);
    // 全局圆角设置
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    def.draw({
        ctx,
        baseColor: opts.color || def.baseColor,
        eyeColor: opts.eyeColor || def.eyeColor,
        hpRatio: opts.hpRatio ?? 1,
        hitState: opts.hitState,
        name: opts.name || def.name
    });
    ctx.restore();
}

// ============ 5 种 Boss 变体（粗壮 + 红色光晕 + 压迫感） ============
// 共同特点：scale 1.6、底部有红色光晕、外形粗壮、颜色深沉
// 渲染接口与普通怪物一致（通过 bossVariant 字段切换）

const BOSS_DEFS = {
    0: { name: '剧毒领主', baseColor: '#4a6a1a', eyeColor: '#fbbf24', scale: 1.6, draw: drawBossToxic },
    1: { name: '辐射领主', baseColor: '#8a7a1a', eyeColor: '#fbbf24', scale: 1.6, draw: drawBossRadiation },
    2: { name: '废土之王', baseColor: '#3a1a4a', eyeColor: '#a78bfa', scale: 1.6, draw: drawBossWastelandKing },
    3: { name: '感染矩阵', baseColor: '#7a1a2a', eyeColor: '#f87171', scale: 1.6, draw: drawBossInfectedMatrix },
    4: { name: '机械暴君', baseColor: '#4a5a6a', eyeColor: '#22d3ee', scale: 1.6, draw: drawBossMechanicalTyrant }
};

// 通用 Boss 红色光晕（Boss 角色外围）
function drawBossGlow(ctx, baseColor, intensity = 0.4) {
    ctx.save();
    const glow = ctx.createRadialGradient(0, -90, 30, 0, -90, 140);
    glow.addColorStop(0, `rgba(244,67,54,${intensity})`);
    glow.addColorStop(0.5, `rgba(244,67,54,${intensity * 0.4})`);
    glow.addColorStop(1, 'rgba(244,67,54,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, -90, 140, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

// ============ Boss 0: 剧毒领主（绿色黏液 + 毒气） ============
function drawBossToxic(opts) {
    const { ctx, baseColor, eyeColor, hpRatio, hitState, name } = opts;
    const isFlashing = hitState?.flash;

    drawBossGlow(ctx, baseColor, 0.5);

    // 大型阴影
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(0, 5, 60, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineCap = 'round';
    ctx.lineWidth = 6;
    ctx.strokeStyle = isFlashing ? '#fff' : baseColor;

    // 粗壮腿（4 条）
    ctx.beginPath();
    ctx.moveTo(-30, -90);
    ctx.lineTo(-38, -10);
    ctx.moveTo(-15, -90);
    ctx.lineTo(-20, -10);
    ctx.moveTo(15, -90);
    ctx.lineTo(20, -10);
    ctx.moveTo(30, -90);
    ctx.lineTo(38, -10);
    ctx.stroke();

    // 躯干（粗大）
    ctx.fillStyle = isFlashing ? '#fff' : baseColor;
    ctx.beginPath();
    ctx.moveTo(-50, -180);
    ctx.lineTo(50, -180);
    ctx.lineTo(60, -90);
    ctx.lineTo(-60, -90);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 黏液（几滴）
    ctx.fillStyle = '#84cc16';
    ctx.beginPath();
    ctx.arc(-40, -85, 4, 0, Math.PI * 2);
    ctx.arc(40, -85, 4, 0, Math.PI * 2);
    ctx.arc(-20, -70, 3, 0, Math.PI * 2);
    ctx.arc(25, -75, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = baseColor;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(-30, -50, 5, 0, Math.PI * 2);
    ctx.arc(35, -45, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 双臂（粗壮）
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-50, -170);
    ctx.lineTo(-80, -130);
    ctx.lineTo(-95, -90);
    ctx.moveTo(50, -170);
    ctx.lineTo(80, -130);
    ctx.lineTo(95, -90);
    ctx.stroke();

    // 武器：双刃巨斧
    ctx.fillStyle = '#6a7a3a';
    ctx.beginPath();
    ctx.moveTo(-95, -90);
    ctx.lineTo(-110, -110);
    ctx.lineTo(-100, -90);
    ctx.lineTo(-110, -70);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#3a4a1a';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 头部（巨大型）
    ctx.fillStyle = isFlashing ? '#fff' : baseColor;
    ctx.beginPath();
    ctx.arc(0, -200, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 头盔（毒气面具）
    ctx.fillStyle = '#1a2a0a';
    ctx.beginPath();
    ctx.arc(0, -200, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = baseColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 眼睛（橙色发光）
    ctx.shadowColor = eyeColor;
    ctx.shadowBlur = 8;
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.arc(-10, -200, 4, 0, Math.PI * 2);
    ctx.arc(10, -200, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 毒气排放（顶部管口）
    ctx.fillStyle = '#3a4a1a';
    ctx.fillRect(-3, -228, 6, 8);
    // 毒气小点
    ctx.fillStyle = '#84cc16';
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        const y = -228 - i * 5;
        ctx.arc(0, y, 2 - i * 0.2, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 肩部圆角尖刺（圆润角锥）
    ctx.fillStyle = '#3a4a1a';
    ctx.beginPath();
    ctx.moveTo(-50, -180);
    ctx.quadraticCurveTo(-58, -188, -56, -194);
    ctx.quadraticCurveTo(-54, -198, -50, -194);
    ctx.quadraticCurveTo(-46, -186, -44, -184);
    ctx.closePath();
    ctx.moveTo(50, -180);
    ctx.quadraticCurveTo(58, -188, 56, -194);
    ctx.quadraticCurveTo(54, -198, 50, -194);
    ctx.quadraticCurveTo(46, -186, 44, -184);
    ctx.closePath();
    ctx.fill();

    drawName(ctx, name || '剧毒领主', '#84cc16');
    drawBossHpBar(ctx, hpRatio);
}

// ============ Boss 1: 辐射领主（黄色防护服 + 辐射徽记） ============
function drawBossRadiation(opts) {
    const { ctx, baseColor, eyeColor, hpRatio, hitState, name } = opts;
    const isFlashing = hitState?.flash;

    drawBossGlow(ctx, baseColor, 0.5);

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(0, 5, 60, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineCap = 'round';
    ctx.lineWidth = 6;
    ctx.strokeStyle = isFlashing ? '#fff' : baseColor;

    // 粗壮腿（防护服）
    ctx.fillStyle = isFlashing ? '#fff' : baseColor;
    ctx.beginPath();
    ctx.moveTo(-32, -90);
    ctx.lineTo(-38, -10);
    ctx.lineTo(-22, -10);
    ctx.lineTo(-20, -90);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(32, -90);
    ctx.lineTo(38, -10);
    ctx.lineTo(22, -10);
    ctx.lineTo(20, -90);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 躯干（黄色防护服）
    ctx.beginPath();
    ctx.moveTo(-50, -180);
    ctx.lineTo(50, -180);
    ctx.lineTo(58, -90);
    ctx.lineTo(-58, -90);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 辐射徽记（胸口）
    ctx.fillStyle = '#1a1a0a';
    ctx.beginPath();
    ctx.arc(0, -130, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.stroke();
    // 辐射三叶符号
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
        const angle = (i * 2 * Math.PI / 3) - Math.PI / 2;
        const x = Math.cos(angle) * 10;
        const y = -130 + Math.sin(angle) * 10;
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.fillStyle = '#1a1a0a';
    ctx.beginPath();
    ctx.arc(0, -130, 3, 0, Math.PI * 2);
    ctx.fill();

    // 双臂（辐射手套）
    ctx.lineWidth = 6;
    ctx.strokeStyle = isFlashing ? '#fff' : baseColor;
    ctx.beginPath();
    ctx.moveTo(-50, -170);
    ctx.lineTo(-75, -130);
    ctx.lineTo(-85, -90);
    ctx.moveTo(50, -170);
    ctx.lineTo(75, -130);
    ctx.lineTo(85, -90);
    ctx.stroke();

    // 右手电浆球（发光）
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(85, -90, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(85, -90, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 头部（球形防护头罩）
    ctx.fillStyle = isFlashing ? '#fff' : baseColor;
    ctx.beginPath();
    ctx.arc(0, -200, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 防护面罩（黑色）
    ctx.fillStyle = '#1a1a0a';
    ctx.beginPath();
    ctx.arc(0, -200, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = baseColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 眼睛（橙色发光 + 辐射警告灯）
    ctx.shadowColor = eyeColor;
    ctx.shadowBlur = 8;
    ctx.fillStyle = eyeColor;
    ctx.fillRect(-12, -203, 8, 6);
    ctx.fillRect(4, -203, 8, 6);
    ctx.shadowBlur = 0;

    // 顶部天线（辐射探测器）
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -228);
    ctx.lineTo(-3, -240);
    ctx.moveTo(0, -228);
    ctx.lineTo(3, -240);
    ctx.stroke();
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(-3, -240, 2, 0, Math.PI * 2);
    ctx.arc(3, -240, 2, 0, Math.PI * 2);
    ctx.fill();

    // 肩部辐射指示灯
    ctx.fillStyle = '#fbbf24';
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(-50, -180, 4, 0, Math.PI * 2);
    ctx.arc(50, -180, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    drawName(ctx, name || '辐射领主', '#fbbf24');
    drawBossHpBar(ctx, hpRatio);
}

// ============ Boss 2: 废土之王（紫色 + 头骨面具 + 王冠） ============
function drawBossWastelandKing(opts) {
    const { ctx, baseColor, eyeColor, hpRatio, hitState, name } = opts;
    const isFlashing = hitState?.flash;

    drawBossGlow(ctx, baseColor, 0.6);

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(0, 5, 60, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineCap = 'round';
    ctx.lineWidth = 6;
    ctx.strokeStyle = isFlashing ? '#fff' : baseColor;

    // 腿（披风样式）
    ctx.fillStyle = isFlashing ? '#fff' : baseColor;
    ctx.beginPath();
    ctx.moveTo(-30, -90);
    ctx.lineTo(-38, -10);
    ctx.lineTo(-20, -10);
    ctx.lineTo(-15, -90);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(30, -90);
    ctx.lineTo(38, -10);
    ctx.lineTo(20, -10);
    ctx.lineTo(15, -90);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 躯干（瘦长披风）
    ctx.beginPath();
    ctx.moveTo(-45, -180);
    ctx.lineTo(45, -180);
    ctx.lineTo(60, -90);
    ctx.lineTo(-60, -90);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 披风尾端（拖地）
    ctx.fillStyle = '#1a0a2a';
    ctx.beginPath();
    ctx.moveTo(-60, -90);
    ctx.lineTo(-70, 0);
    ctx.lineTo(70, 0);
    ctx.lineTo(60, -90);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#3a1a4a';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 头骨标记（胸口）
    ctx.fillStyle = '#a78bfa';
    ctx.beginPath();
    ctx.arc(0, -130, 5, 0, Math.PI * 2);
    ctx.arc(-6, -127, 2, 0, Math.PI * 2);
    ctx.arc(6, -127, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a0a2a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -125);
    ctx.lineTo(-3, -120);
    ctx.lineTo(0, -122);
    ctx.lineTo(3, -120);
    ctx.lineTo(0, -125);
    ctx.stroke();

    // 双臂（瘦长）
    ctx.lineWidth = 5;
    ctx.strokeStyle = isFlashing ? '#fff' : baseColor;
    ctx.beginPath();
    ctx.moveTo(-45, -170);
    ctx.lineTo(-65, -130);
    ctx.lineTo(-75, -90);
    ctx.moveTo(45, -170);
    ctx.lineTo(65, -130);
    ctx.lineTo(75, -90);
    ctx.stroke();

    // 权杖（右手）
    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(75, -90);
    ctx.lineTo(75, -160);
    ctx.stroke();
    // 杖头（紫色头骨）
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.arc(75, -160, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a0a2a';
    ctx.beginPath();
    ctx.arc(72, -161, 2, 0, Math.PI * 2);
    ctx.arc(78, -161, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = eyeColor;
    ctx.shadowBlur = 6;
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.arc(75, -156, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 头部（巨大 + 王冠）
    ctx.fillStyle = isFlashing ? '#fff' : baseColor;
    ctx.beginPath();
    ctx.arc(0, -200, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 王冠（圆润 5 圆球顶 + 圆滑底边）
    ctx.fillStyle = '#a78bfa';
    ctx.beginPath();
    ctx.moveTo(-26, -208);
    ctx.bezierCurveTo(-30, -214, -26, -218, -22, -214);
    ctx.bezierCurveTo(-18, -220, -10, -226, -7, -220);
    ctx.bezierCurveTo(-3, -224, 3, -224, 7, -220);
    ctx.bezierCurveTo(10, -226, 18, -220, 22, -214);
    ctx.bezierCurveTo(26, -218, 30, -214, 26, -208);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#5a3a8a';
    ctx.lineWidth = 1;
    ctx.stroke();
    // 顶部圆球（柔化）
    const crownBalls = [-22, -13, 0, 13, 22];
    crownBalls.forEach((x, i) => {
        ctx.fillStyle = i === 2 ? eyeColor : '#d4b97a';
        ctx.beginPath();
        ctx.arc(x, -218 - (i % 2 === 0 ? 2 : 0), 3, 0, Math.PI * 2);
        ctx.fill();
    });
    // 中心宝石（强化光晕）
    ctx.fillStyle = eyeColor;
    ctx.shadowColor = eyeColor;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(0, -220, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 双眼（紫色发光）
    ctx.shadowColor = eyeColor;
    ctx.shadowBlur = 10;
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.arc(-10, -200, 4, 0, Math.PI * 2);
    ctx.arc(10, -200, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 嘴（线条）
    ctx.strokeStyle = '#1a0a2a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, -188);
    ctx.lineTo(8, -188);
    ctx.stroke();

    drawName(ctx, name || '废土之王', '#a78bfa');
    drawBossHpBar(ctx, hpRatio);
}

// ============ Boss 3: 感染矩阵（红色 + 触手 + 不稳定 DNA） ============
function drawBossInfectedMatrix(opts) {
    const { ctx, baseColor, eyeColor, hpRatio, hitState, name } = opts;
    const isFlashing = hitState?.flash;

    drawBossGlow(ctx, baseColor, 0.6);

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(0, 5, 60, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // 触手（多根，从底部伸出）
    ctx.lineCap = 'round';
    ctx.strokeStyle = isFlashing ? '#fff' : baseColor;
    ctx.lineWidth = 4;
    for (let i = 0; i < 6; i++) {
        const angle = -Math.PI / 2 + (i - 2.5) * 0.3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(
            Math.cos(angle) * 20,
            -5,
            Math.cos(angle) * 35,
            Math.sin(angle) * 35
        );
        ctx.stroke();
    }

    // 核心躯干（圆形核心）
    ctx.lineWidth = 6;
    ctx.fillStyle = isFlashing ? '#fff' : baseColor;
    ctx.beginPath();
    ctx.arc(0, -100, 35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // DNA 双螺旋（覆盖核心）
    ctx.strokeStyle = '#f87171';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
        const angle = i * Math.PI / 2;
        ctx.beginPath();
        ctx.arc(0, -100, 30, angle, angle + Math.PI / 4);
        ctx.stroke();
    }
    ctx.strokeStyle = '#fff8e0';
    ctx.beginPath();
    ctx.arc(0, -100, 25, 0, Math.PI * 2);
    ctx.stroke();

    // 触手（顶部爆炸式）
    ctx.lineWidth = 5;
    ctx.strokeStyle = isFlashing ? '#fff' : baseColor;
    for (let i = 0; i < 5; i++) {
        const angle = -Math.PI / 2 + (i - 2) * 0.4;
        ctx.beginPath();
        ctx.moveTo(0, -130);
        ctx.quadraticCurveTo(
            Math.cos(angle) * 30,
            -130,
            Math.cos(angle) * 50,
            -130 + Math.sin(angle) * 50
        );
        ctx.stroke();
    }

    // 眼睛（中心 1 个 + 周围 6 个）
    ctx.shadowColor = eyeColor;
    ctx.shadowBlur = 8;
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    // 中心眼
    ctx.arc(0, -100, 6, 0, Math.PI * 2);
    ctx.fill();
    // 周围眼
    for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI / 3;
        const x = Math.cos(angle) * 18;
        const y = -100 + Math.sin(angle) * 18;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.shadowBlur = 0;

    // 顶部核心（脉冲）
    ctx.fillStyle = '#fbbf24';
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, -160, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // DNA 链（向外延伸）
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
        ctx.moveTo(0, -160);
        ctx.lineTo(8, -180);
        ctx.moveTo(0, -160);
        ctx.lineTo(-8, -180);
    }
    ctx.stroke();

    drawName(ctx, name || '感染矩阵', '#f87171');
    drawBossHpBar(ctx, hpRatio);
}

// ============ Boss 4: 机械暴君（巨型机械 + 青色能量 + 双剑） ============
function drawBossMechanicalTyrant(opts) {
    const { ctx, baseColor, eyeColor, hpRatio, hitState, name } = opts;
    const isFlashing = hitState?.flash;

    drawBossGlow(ctx, baseColor, 0.5);

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(0, 5, 60, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // 能量传导地面线
    ctx.strokeStyle = eyeColor;
    ctx.lineWidth = 1;
    ctx.shadowColor = eyeColor;
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.moveTo(-50, 0);
    ctx.lineTo(50, 0);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = isFlashing ? '#fff' : baseColor;
    ctx.lineWidth = 6;

    // 机械腿（圆润 bezier 曲线 + 圆头）
    ctx.fillStyle = isFlashing ? '#fff' : baseColor;
    // 左腿（圆角矩形 + 圆头）
    ctx.beginPath();
    ctx.moveTo(-15, -90);
    ctx.bezierCurveTo(-26, -70, -32, -40, -22, -10);
    ctx.arc(-22, -10, 6, 0, Math.PI * 2);
    ctx.lineTo(-12, -10);
    ctx.bezierCurveTo(-12, -50, -12, -70, -15, -90);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // 右腿
    ctx.beginPath();
    ctx.moveTo(15, -90);
    ctx.bezierCurveTo(26, -70, 32, -40, 22, -10);
    ctx.arc(22, -10, 6, 0, Math.PI * 2);
    ctx.lineTo(12, -10);
    ctx.bezierCurveTo(12, -50, 12, -70, 15, -90);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // 膝关节（青色发光圆球）
    ctx.fillStyle = eyeColor;
    ctx.shadowColor = eyeColor;
    ctx.shadowBlur = 6;
    [-22, 22].forEach(x => {
        ctx.beginPath();
        ctx.arc(x, -50, 5, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.shadowBlur = 0;

    // 躯干（圆润机甲圆滑曲线 + 圆肩）
    ctx.fillStyle = isFlashing ? '#fff' : baseColor;
    ctx.beginPath();
    ctx.moveTo(-50, -180);
    ctx.bezierCurveTo(-58, -150, -65, -120, -60, -90);
    ctx.lineTo(60, -90);
    ctx.bezierCurveTo(65, -120, 58, -150, 50, -180);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 胸部能量核心（青色发光 + 周围光晕）
    ctx.shadowColor = eyeColor;
    ctx.shadowBlur = 16;
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.arc(0, -130, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, -130, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 胸甲分割线（圆滑曲线）
    ctx.strokeStyle = '#2a3a4a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-50, -135);
    ctx.quadraticCurveTo(0, -132, 50, -135);
    ctx.moveTo(-30, -180);
    ctx.bezierCurveTo(-32, -150, -32, -120, -30, -90);
    ctx.moveTo(30, -180);
    ctx.bezierCurveTo(32, -150, 32, -120, 30, -90);
    ctx.stroke();

    // 双臂（bezier 曲线让上臂有机弯曲）
    ctx.lineWidth = 6;
    ctx.strokeStyle = isFlashing ? '#fff' : baseColor;
    ctx.beginPath();
    ctx.moveTo(-50, -170);
    ctx.quadraticCurveTo(-78, -140, -90, -90);
    ctx.moveTo(50, -170);
    ctx.quadraticCurveTo(78, -140, 90, -90);
    ctx.stroke();

    // 双剑（机械光剑，圆角剑柄）
    function drawLightSaber(x, y, mirror = false) {
        const dir = mirror ? -1 : 1;
        // 剑柄（圆角矩形）
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.roundRect(x - 3, y - 5, 6, 18, 2);
        ctx.fill();
        // 剑刃（青色发光 bezier 曲线）
        ctx.shadowColor = eyeColor;
        ctx.shadowBlur = 12;
        ctx.strokeStyle = eyeColor;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, y - 5);
        ctx.quadraticCurveTo(x + dir * 30, y - 12, x + dir * 60, y - 22);
        ctx.stroke();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(x, y - 5);
        ctx.quadraticCurveTo(x + dir * 30, y - 12, x + dir * 60, y - 22);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    drawLightSaber(-90, -90, true);
    drawLightSaber(90, -90, false);

    // 头部（机甲头盔 - 圆润圆顶）
    ctx.fillStyle = isFlashing ? '#fff' : baseColor;
    ctx.beginPath();
    ctx.moveTo(-25, -200);
    ctx.bezierCurveTo(-30, -180, -25, -160, -15, -160);
    ctx.lineTo(15, -160);
    ctx.bezierCurveTo(25, -160, 30, -180, 25, -200);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 面罩（柔和弓形）
    ctx.fillStyle = '#1a1a2a';
    ctx.beginPath();
    ctx.moveTo(-25, -195);
    ctx.bezierCurveTo(0, -192, 0, -192, 25, -195);
    ctx.quadraticCurveTo(20, -170, 0, -168);
    ctx.quadraticCurveTo(-20, -170, -25, -195);
    ctx.closePath();
    ctx.fill();

    // 眼睛（青色发光横线 + 圆角）
    ctx.shadowColor = eyeColor;
    ctx.shadowBlur = 10;
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.roundRect(-20, -187, 40, 4, 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 头顶天线（圆角 + 圆顶球）
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -200);
    ctx.lineTo(0, -218);
    ctx.stroke();
    ctx.fillStyle = eyeColor;
    ctx.shadowColor = eyeColor;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(0, -220, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 肩部装甲（圆角）
    ctx.fillStyle = '#2a3a4a';
    ctx.beginPath();
    ctx.moveTo(-50, -180);
    ctx.bezierCurveTo(-65, -190, -65, -170, -55, -165);
    ctx.bezierCurveTo(-58, -180, -50, -180, -50, -180);
    ctx.closePath();
    ctx.moveTo(50, -180);
    ctx.bezierCurveTo(65, -190, 65, -170, 55, -165);
    ctx.bezierCurveTo(58, -180, 50, -180, 50, -180);
    ctx.closePath();
    ctx.lineTo(65, -170);
    ctx.lineTo(55, -165);
    ctx.closePath();
    ctx.fill();

    drawName(ctx, name || '机械暴君', '#22d3ee');
    drawBossHpBar(ctx, hpRatio);
}

// ============ Boss 内置 HP 条（关闭：统一由 battle-canvas 绘制） ============
function drawBossHpBar() {
    return;
}

// ============ 公开 API：渲染 Boss ============
export function renderBoss(ctx, variant, opts = {}) {
    const def = BOSS_DEFS[variant];
    if (!def) {
        console.warn(`[monster-figures] unknown boss variant: ${variant}`);
        return;
    }
    ctx.save();
    ctx.translate(opts.x || 0, opts.y || 0);
    // 缩小 0.85 让 Boss 比例更紧凑（之前 1.6 → 现在 1.36）
    ctx.scale((opts.scale || 1) * (opts.facing || 1) * 0.85, (opts.scale || 1) * 0.85);
    // 全局圆角设置
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    def.draw({
        ctx,
        baseColor: opts.color || def.baseColor,
        eyeColor: opts.eyeColor || def.eyeColor,
        hpRatio: opts.hpRatio ?? 1,
        hitState: opts.hitState,
        name: opts.name || def.name
    });
    ctx.restore();
}

export function getBossNames() {
    return Object.entries(BOSS_DEFS).map(([id, d]) => ({ id: parseInt(id), name: d.name }));
}

export function getMonsterNames() {
    return Object.entries(MONSTER_DEFS).map(([id, d]) => ({ id, name: d.name }));
}

export const MONSTER_TYPES = Object.keys(MONSTER_DEFS);
