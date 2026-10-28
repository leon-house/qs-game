/**
 * 战斗反馈系统 · 伤害数字 / 粒子 / 震动 / 挥剑弧 / 弹道
 *
 * 模块：
 *   - DamageNumber：浮动数字
 *   - ParticleSystem：粒子（火星 + 能量环）
 *   - ScreenShake：屏幕震动
 *   - SwingArc / Projectile：攻击动画
 *   - HitStop：受击迟滞
 *
 * 与 battle-canvas 协作：
 *   onDamageDealt → spawnDamageNumber + spawnParticles + screenShake
 *   onPlayerHit  → spawnDamageNumber(target='player') + hitStop
 */

const FX_QUEUE = {
    damageNumbers: [],
    particles: [],
    shake: { x: 0, y: 0, duration: 0, intensity: 0 },
    swingArcs: [],
    projectiles: [],
    hitStop: 0          // 单位：ms；>0 时游戏暂停
};

const MAX_PARTICLES = 80;
const MAX_DAMAGE_NUMBERS = 30;

// ===================== 伤害数字 =====================
const DAMAGE_STYLES = {
    normal:  { color: '#fff',     size: 16, weight: 'bold', prefix: '' },
    crit:    { color: '#fbbf24',  size: 24, weight: 'bold', prefix: '暴击 ' },
    super:   { color: '#f87171',  size: 30, weight: 'bold', prefix: '会心 ' },
    heal:    { color: '#4ade80',  size: 16, weight: 'bold', prefix: '+' },
    miss:    { color: 'rgba(255,255,255,0.5)', size: 14, weight: 'normal', prefix: '闪避' },
    blocked: { color: '#9ca3af',  size: 14, weight: 'normal', prefix: '格挡' }
};

export function spawnDamageNumber(opts) {
    const x = opts.x || 0;
    const y = opts.y || 0;
    const value = Math.round(opts.value || 0);
    const style = DAMAGE_STYLES[opts.style || 'normal'];

    FX_QUEUE.damageNumbers.push({
        x,
        y,
        vy: -50,           // 上浮速度
        text: `${style.prefix}${value}`,
        color: style.color,
        size: style.size,
        weight: style.weight,
        value,
        born: performance.now(),
        ttl: 1200,
        crit: opts.style === 'crit' || opts.style === 'super'
    });

    if (FX_QUEUE.damageNumbers.length > MAX_DAMAGE_NUMBERS) {
        FX_QUEUE.damageNumbers.shift();
    }
}

function renderDamageNumbers(ctx, dt) {
    const now = performance.now();
    const survivors = [];
    for (const d of FX_QUEUE.damageNumbers) {
        const age = now - d.born;
        if (age > d.ttl) continue;
        const t = age / d.ttl;
        const alpha = 1 - t * 0.7;
        const y = d.y + d.vy * (age / 1000);
        const x = d.x + Math.sin(t * Math.PI * 4) * 2;  // 轻微晃动

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `${d.weight} ${d.size}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // 描边
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.lineWidth = 3;
        ctx.strokeText(d.text, x, y);

        // 文本
        ctx.fillStyle = d.color;
        ctx.fillText(d.text, x, y);

        // 暴击额外放大 + 闪光
        if (d.crit) {
            ctx.globalAlpha = alpha * 0.5;
            ctx.font = `bold ${d.size * 1.2}px sans-serif`;
            ctx.strokeText(d.text, x, y);
            ctx.fillStyle = '#fff';
            ctx.fillText(d.text, x, y);
        }

        ctx.restore();
        survivors.push(d);
    }
    FX_QUEUE.damageNumbers = survivors;
}

// ===================== 粒子系统 =====================
function spawnParticles(opts) {
    const count = opts.count || 8;
    const cx = opts.x || 0;
    const cy = opts.y || 0;
    const color = opts.color || '#fbbf24';
    const type = opts.type || 'spark';          // spark / ring / blood / energy
    const speed = opts.speed || 80;
    const spread = opts.spread || Math.PI * 2;

    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.5;
        const v = speed * (0.6 + Math.random() * 0.6);
        const life = 400 + Math.random() * 400;
        const size = 2 + Math.random() * 3;

        let vx, vy;
        if (type === 'ring') {
            // 环状：垂直外扩
            vx = Math.cos(angle) * v;
            vy = Math.sin(angle) * v;
        } else {
            // 火星：上扬
            const baseAngle = -Math.PI / 2 + (Math.random() - 0.5) * spread;
            vx = Math.cos(baseAngle) * v * (Math.random() * 0.6 + 0.5);
            vy = Math.sin(baseAngle) * v * (Math.random() * 0.6 + 0.5);
        }

        FX_QUEUE.particles.push({
            x: cx, y: cy,
            vx, vy,
            gravity: type === 'spark' ? 220 : 0,
            size,
            color,
            type,
            born: performance.now(),
            ttl: life,
            alpha0: 1,
            shape: Math.random() < 0.3 ? 'triangle' : 'circle'
        });
    }

    if (FX_QUEUE.particles.length > MAX_PARTICLES) {
        FX_QUEUE.particles.splice(0, FX_QUEUE.particles.length - MAX_PARTICLES);
    }
}

function renderParticles(ctx, dt) {
    const now = performance.now();
    const survivors = [];
    for (const p of FX_QUEUE.particles) {
        const age = now - p.born;
        if (age > p.ttl) continue;
        const t = age / p.ttl;
        const alpha = p.alpha0 * (1 - t * 0.85);

        // 物理
        const x = p.x + p.vx * (age / 1000);
        const y = p.y + p.vy * (age / 1000) + 0.5 * p.gravity * Math.pow(age / 1000, 2);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.strokeStyle = p.color;

        if (p.type === 'ring') {
            // 环：透明填充 + 描边
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(x, y, p.size + t * 8, 0, Math.PI * 2);
            ctx.stroke();
        } else if (p.shape === 'triangle') {
            // 三角形火星
            const ang = Math.atan2(p.vy, p.vx);
            ctx.translate(x, y);
            ctx.rotate(ang);
            ctx.beginPath();
            ctx.moveTo(p.size, 0);
            ctx.lineTo(-p.size, -p.size * 0.6);
            ctx.lineTo(-p.size, p.size * 0.6);
            ctx.closePath();
            ctx.fill();
        } else {
            // 圆点
            ctx.beginPath();
            ctx.arc(x, y, p.size * (1 - t * 0.5), 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
        survivors.push(p);
    }
    FX_QUEUE.particles = survivors;
}

// ===================== 屏幕震动 =====================
function triggerShake(intensity = 8, duration = 200) {
    FX_QUEUE.shake.intensity = Math.max(FX_QUEUE.shake.intensity, intensity);
    FX_QUEUE.shake.duration = Math.max(FX_QUEUE.shake.duration, duration);
}

function updateShake(dt) {
    if (FX_QUEUE.shake.duration > 0) {
        FX_QUEUE.shake.duration -= dt;
        const t = Math.max(0, FX_QUEUE.shake.duration / 200);
        const mag = FX_QUEUE.shake.intensity * t;
        FX_QUEUE.shake.x = (Math.random() - 0.5) * 2 * mag;
        FX_QUEUE.shake.y = (Math.random() - 0.5) * 2 * mag;
        if (FX_QUEUE.shake.duration <= 0) {
            FX_QUEUE.shake.x = 0;
            FX_QUEUE.shake.y = 0;
            FX_QUEUE.shake.intensity = 0;
        }
    }
}

export function getShakeOffset() {
    return { x: FX_QUEUE.shake.x, y: FX_QUEUE.shake.y };
}

// ===================== 挥剑弧线 =====================
function spawnSwingArc(opts) {
    const x = opts.x || 0;
    const y = opts.y || 0;
    const dir = opts.dir || 1;  // 1 右 -1 左
    const color = opts.color || '#fbbf24';
    const size = opts.size || 50;

    FX_QUEUE.swingArcs.push({
        x, y, dir, color, size,
        born: performance.now(),
        ttl: 280,
        angle0: dir > 0 ? -0.6 : Math.PI - 0.6,
        angle1: dir > 0 ? 0.9 : Math.PI + 0.9
    });
}

function renderSwingArcs(ctx) {
    const now = performance.now();
    const survivors = [];
    for (const a of FX_QUEUE.swingArcs) {
        const age = now - a.born;
        if (age > a.ttl) continue;
        const t = age / a.ttl;
        const easeOut = 1 - Math.pow(1 - t, 2);
        const angle = a.angle0 + (a.angle1 - a.angle0) * easeOut;

        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(angle);
        ctx.strokeStyle = a.color;
        ctx.lineWidth = 4 * (1 - t * 0.5);
        ctx.lineCap = 'round';
        ctx.shadowColor = a.color;
        ctx.shadowBlur = 8;
        ctx.globalAlpha = 1 - t * 0.6;

        ctx.beginPath();
        ctx.arc(0, 0, a.size, -0.5, 0.5);
        ctx.stroke();

        ctx.restore();
        survivors.push(a);
    }
    FX_QUEUE.swingArcs = survivors;
}

// ===================== 弹道（投掷物） =====================
function spawnProjectile(opts) {
    FX_QUEUE.projectiles.push({
        x: opts.x || 0,
        y: opts.y || 0,
        tx: opts.tx || 0,
        ty: opts.ty || 0,
        color: opts.color || '#fbbf24',
        born: performance.now(),
        ttl: opts.ttl || 300,
        size: opts.size || 4,
        type: opts.type || 'bullet'   // bullet / arrow / magic
    });
}

function renderProjectiles(ctx) {
    const now = performance.now();
    const survivors = [];
    for (const p of FX_QUEUE.projectiles) {
        const age = now - p.born;
        if (age > p.ttl) continue;
        const t = age / p.ttl;
        const x = p.x + (p.tx - p.x) * t;
        const y = p.y + (p.ty - p.y) * t;

        ctx.save();
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;

        switch (p.type) {
            case 'arrow':
                ctx.translate(x, y);
                ctx.rotate(Math.atan2(p.ty - p.y, p.tx - p.x));
                ctx.fillRect(-8, -1, 16, 2);
                ctx.beginPath();
                ctx.moveTo(8, -3);
                ctx.lineTo(12, 0);
                ctx.lineTo(8, 3);
                ctx.closePath();
                ctx.fill();
                break;
            case 'magic':
                ctx.beginPath();
                ctx.arc(x, y, p.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1;
                ctx.stroke();
                break;
            default:
                ctx.beginPath();
                ctx.arc(x, y, p.size, 0, Math.PI * 2);
                ctx.fill();
        }
        ctx.restore();
        survivors.push(p);
    }
    FX_QUEUE.projectiles = survivors;
}

// ===================== Hit Stop =====================
function triggerHitStop(duration = 50) {
    FX_QUEUE.hitStop = Math.max(FX_QUEUE.hitStop, duration);
}

export function isHitStop() {
    return FX_QUEUE.hitStop > 0;
}

export function tickHitStop(dt) {
    if (FX_QUEUE.hitStop > 0) FX_QUEUE.hitStop -= dt;
}

// ===================== 统一渲染 =====================
export function renderAllFX(ctx, dt) {
    renderDamageNumbers(ctx, dt);
    renderParticles(ctx, dt);
    renderSwingArcs(ctx);
    renderProjectiles(ctx);
}

export function updateAllFX(dt) {
    updateShake(dt);
    tickHitStop(dt);
}

// ===================== 公开 API =====================
export const FX = {
    spawnDamageNumber,
    spawnParticles,
    spawnSwingArc,
    spawnProjectile,
    triggerShake,
    triggerHitStop,
    getShakeOffset,
    isHitStop,
    renderAllFX,
    updateAllFX,
    // 高级复合 API
    hitEffect: (x, y, color = '#fbbf24') => {
        spawnParticles({ x, y, color, type: 'spark', count: 12, speed: 120 });
        spawnSwingArc({ x, y: y - 50, color, size: 45 });
    },
    critEffect: (x, y) => {
        spawnParticles({ x, y, color: '#fbbf24', type: 'spark', count: 24, speed: 180 });
        spawnSwingArc({ x, y: y - 50, color: '#fbbf24', size: 60 });
        spawnParticles({ x, y, color: '#fff', type: 'ring', count: 16, speed: 100 });
        triggerShake(12, 250);
        triggerHitStop(60);
    },
    deathEffect: (x, y) => {
        spawnParticles({ x, y, color: '#dc2626', type: 'spark', count: 30, speed: 150 });
        spawnParticles({ x, y, color: '#dc2626', type: 'ring', count: 20, speed: 80 });
        triggerShake(15, 300);
    }
};

export function clearAllFX() {
    FX_QUEUE.damageNumbers = [];
    FX_QUEUE.particles = [];
    FX_QUEUE.swingArcs = [];
    FX_QUEUE.projectiles = [];
    FX_QUEUE.shake = { x: 0, y: 0, duration: 0, intensity: 0 };
    FX_QUEUE.hitStop = 0;
}
