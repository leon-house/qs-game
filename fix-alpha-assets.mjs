/**
 * fix-alpha-assets.mjs —— 素材抠底工具
 *
 * 背景：部分 AI 生成的 PNG 图在导出时把「透明棋盘格」或「白底」直接烤进了像素，
 * 在游戏里表现为每个图标外面套着一个灰白方块（见商店 / 装备快捷条）。
 * 本工具用浏览器 canvas 做一次通用抠底：估计背景色板 → 从图像边界泛洪出背景区域 →
 * 背景置透明 → 边缘 2px 做软化与去背景色偏 → 补针孔 / 去杂点 → 清除右下角 AI 水印。
 *
 * 用法：
 *   node fix-alpha-assets.mjs            # 只预览，输出到 .alpha-fix-preview/
 *   node fix-alpha-assets.mjs --write    # 直接原地覆盖
 *
 * 依赖：仅用 node 内置模块 + 本机 Chrome（canvas 编解码走浏览器，无第三方图像库）。
 */
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const WRITE = process.argv.includes('--write');
const PREVIEW_DIR = path.join(ROOT, '.alpha-fix-preview');

/** 需要抠底的素材。webp 为可选产物（部分界面用 webp，其余用 png）。 */
const TARGETS = [
    { png: 'assets/images/equip/weapon.png',    webp: 'assets/images/equip/weapon.webp' },
    { png: 'assets/images/equip/head.png',      webp: 'assets/images/equip/head.webp' },
    { png: 'assets/images/equip/clothes.png',   webp: 'assets/images/equip/clothes.webp' },
    { png: 'assets/images/equip/cloak.png',     webp: 'assets/images/equip/cloak.webp' },
    { png: 'assets/images/equip/armor.png',     webp: 'assets/images/equip/armor.webp' },
    { png: 'assets/images/equip/boots.png',     webp: 'assets/images/equip/boots.webp' },
    { png: 'assets/images/equip/ring.png',      webp: 'assets/images/equip/ring.webp' },
    { png: 'assets/images/equip/amulet.png',    webp: 'assets/images/equip/amulet.webp' },
    { png: 'assets/images/equip/accessory.png', webp: 'assets/images/equip/accessory.webp' },
    { png: 'assets/images/shards/capsule_evolution.png' },
    { png: 'assets/images/shards/crosshair_crit.png' },
    { png: 'assets/images/shards/gold_goldfind.png' },
    { png: 'assets/images/shards/shadow_idle_speed.png' },
    { png: 'assets/images/shards/skull_boss_dmg.png' },
    { png: 'assets/images/shards/sword_atk_power.png' },
    { png: 'assets/images/shards/wind_skill_haste.png' },
    { png: 'assets/images/materials/energy_advanced.png' },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function launch() {
    const userDir = 'C:/tmp/chrome-alpha-fix-' + Date.now();
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--incognito',
        '--allow-file-access-from-files', '--window-size=1200,1400', '--remote-debugging-port=0',
        '--user-data-dir=' + userDir, 'about:blank'], { detached: true, stdio: 'ignore' });
    chrome.unref();
    let targets = null, port = 0;
    for (let i = 0; i < 60; i++) {
        if (!port) { try { port = Number(fs.readFileSync(userDir + '/DevToolsActivePort', 'utf8').split('\n')[0].trim()); } catch (_) {} }
        if (!port) { await sleep(200); continue; }
        try {
            targets = await new Promise((res, rej) => {
                http.get('http://127.0.0.1:' + port + '/json/list', r => {
                    let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
                }).on('error', rej);
            });
            if (targets.some(t => t.type === 'page')) break;
        } catch (_) { await sleep(200); }
        await sleep(300);
    }
    if (!targets) throw new Error('Chrome 未启动成功');
    return { chrome, page: targets.find(t => t.type === 'page'), userDir };
}

async function connect(page) {
    const { default: WS } = await import('file:///C:/Users/32545/WorkBuddy/2026-07-23-09-44-01/node_modules/ws/index.js');
    const ws = new WS(page.webSocketDebuggerUrl);
    let id = 1; const pending = new Map();
    ws.on('message', raw => {
        const m = JSON.parse(raw);
        if (m.id && pending.has(m.id)) {
            const { resolve, reject } = pending.get(m.id); pending.delete(m.id);
            m.error ? reject(new Error(m.error.message)) : resolve(m.result);
        }
    });
    await new Promise(r => ws.on('open', r));
    const send = (method, params = {}) => new Promise((resolve, reject) => {
        const mid = id++; pending.set(mid, { resolve, reject });
        ws.send(JSON.stringify({ id: mid, method, params }));
    });
    const raw = async expr => {
        const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        if (r.exceptionDetails) throw new Error(String(r.exceptionDetails.exception?.description || r.exceptionDetails.text).slice(0, 400));
        return r.result.value;
    };
    const evaluate = async expr => {
        const r = await send('Runtime.evaluate', { expression: '(async function(){' + expr + '})()', returnByValue: true, awaitPromise: true });
        if (r.exceptionDetails) throw new Error(String(r.exceptionDetails.exception?.description || r.exceptionDetails.text).slice(0, 400));
        return r.result.value;
    };
    return { ws, send, evaluate, raw };
}

/** 在浏览器里跑的实际抠底逻辑 */
const KERNEL = `﻿const T = 14, T_AXIS = 30, SOFT = 2;
const NB = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];

function kmeans(pts, k, iters) {
    if (!pts.length) return [];
    let cen = [];
    for (let i = 0; i < k; i++) cen.push(pts[Math.floor(i * pts.length / k)].slice());
    for (let it = 0; it < iters; it++) {
        const acc = cen.map(() => [0,0,0,0]);
        for (const p of pts) {
            let bi = 0, bd = Infinity;
            for (let c = 0; c < cen.length; c++) {
                const dr = p[0]-cen[c][0], dg = p[1]-cen[c][1], db = p[2]-cen[c][2];
                const dd = dr*dr + dg*dg + db*db;
                if (dd < bd) { bd = dd; bi = c; }
            }
            acc[bi][0]+=p[0]; acc[bi][1]+=p[1]; acc[bi][2]+=p[2]; acc[bi][3]++;
        }
        cen = cen.map((c,i) => acc[i][3] ? [acc[i][0]/acc[i][3], acc[i][1]/acc[i][3], acc[i][2]/acc[i][3]] : c);
    }
    const w = cen.map(() => 0);
    for (const p of pts) {
        let bi = 0, bd = Infinity;
        for (let c = 0; c < cen.length; c++) {
            const dr = p[0]-cen[c][0], dg = p[1]-cen[c][1], db = p[2]-cen[c][2];
            const dd = dr*dr + dg*dg + db*db;
            if (dd < bd) { bd = dd; bi = c; }
        }
        w[bi]++;
    }
    const keep = cen.filter((c, i) => w[i] >= pts.length * 0.05);
    return keep.length ? keep : cen;
}

function median(arr) {
    if (!arr.length) return [0,0,0];
    const a = arr.slice().sort((x, y) => x - y);
    const m = a.length >> 1;
    return a.length % 2 ? a[m].slice() : [(a[m-1][0]+a[m][0])/2, (a[m-1][1]+a[m][1])/2, (a[m-1][2]+a[m][2])/2];
}

function dist3(a, b) {
    const dr = a[0]-b[0], dg = a[1]-b[1], db = a[2]-b[2];
    return Math.sqrt(dr*dr + dg*dg + db*db);
}

/**
 * 轴向背景模型：每行（列）取边缘像素中值，模拟「影棚渐变底」。
 * 再用宽窗时间中值修掉 AI 水印黑块这类异常行。
 */
function buildAxisModel(perIndex) {
    const raw = perIndex.map(v => median(v));
    const win = Math.max(3, Math.floor(perIndex.length / 8));
    const out = [];
    for (let i = 0; i < raw.length; i++) {
        const lo = Math.max(0, i - win), hi = Math.min(raw.length - 1, i + win);
        const winMed = median(raw.slice(lo, hi + 1));
        const d = Math.abs(raw[i][0]-winMed[0]) + Math.abs(raw[i][1]-winMed[1]) + Math.abs(raw[i][2]-winMed[2]);
        out.push(d > 90 ? winMed : raw[i]);
    }
    return out;
}

async function knockOut(url) {
    const img = new Image();
    img.src = url;
    await img.decode();
    const w = img.naturalWidth, h = img.naturalHeight;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0);
    const id = ctx.getImageData(0, 0, w, h), d = id.data;

    // --- 0. 先在原图上定位「右下角 AI 水印黑框」：一整块纯黑矩形，留到最后整块抹掉 ---
    let wmRect = null;
    {
        const isBlack = (x, y) => { const o = (y*w+x)*4; return Math.max(d[o],d[o+1],d[o+2]) < 78; };
        const seenW = new Uint8Array(w*h);
        for (let sy = Math.floor(h*0.60); sy < h; sy++) for (let sx = Math.floor(w*0.45); sx < w; sx++) {
            const st = sy*w+sx; if (seenW[st] || !isBlack(sx, sy)) continue;
            const comp=[]; const stk=[st]; seenW[st]=1;
            let minX=w, maxX=-1, minY=h, maxY=-1;
            while (stk.length) {
                const i=stk.pop(); comp.push(i);
                const cx=i%w, cy=(i/w)|0;
                if (cx<minX) minX=cx; if (cx>maxX) maxX=cx;
                if (cy<minY) minY=cy; if (cy>maxY) maxY=cy;
                for (const [dx,dy] of NB) { const nx=cx+dx, ny=cy+dy; if(nx<0||ny<0||nx>=w||ny>=h)continue; const j=ny*w+nx;
                    if (!seenW[j] && isBlack(nx, ny)) { seenW[j]=1; stk.push(j); } }
            }
            const bw = maxX-minX+1, bh = maxY-minY+1;
            // 判定为水印框的充要条件：贴住图像边缘 + 实心方块 + 位于右下角
            const touchesEdge = (maxY >= h-3) || (maxX >= w-3);
            const solid = comp.length / Math.max(1, bw*bh);
            if (comp.length > 300 && bw > 12 && bh > 12 && solid > 0.80
                && minX > w*0.55 && minY > h*0.70 && touchesEdge
                && bw*bh < w*h*0.5 && bw < w*0.55 && bh < h*0.55) {
                const r = { x0: Math.max(0,minX-4), y0: Math.max(0,minY-4), x1: Math.min(w-1,maxX+4), y1: Math.min(h-1,maxY+4) };
                if (!wmRect || (r.x1-r.x0)*(r.y1-r.y0) > (wmRect.x1-wmRect.x0)*(wmRect.y1-wmRect.y0)) wmRect = r;
            }
        }
    }

    // --- 1. 初版背景色板（取自图像边界） ---
    let border = [];
    const rowSamples = [], colSamples = [];
    for (let y = 0; y < h; y++) rowSamples.push([]);
    for (let x = 0; x < w; x++) colSamples.push([]);
    for (let x = 0; x < w; x++) for (const y of [0,1,2,h-3,h-2,h-1]) {
        const o = (y*w+x)*4;
        border.push([d[o],d[o+1],d[o+2]]);
        rowSamples[y].push([d[o],d[o+1],d[o+2]]);
    }
    for (let y = 0; y < h; y++) for (const x of [0,1,2,w-3,w-2,w-1]) {
        const o = (y*w+x)*4;
        border.push([d[o],d[o+1],d[o+2]]);
        colSamples[x].push([d[o],d[o+1],d[o+2]]);
    }
    let pal = kmeans(border, 10, 18);

    const nearest = (px) => {
        let bd = Infinity, bc = pal[0];
        for (const c of pal) {
            const dr = px[0]-c[0], dg = px[1]-c[1], db = px[2]-c[2];
            const dd = dr*dr + dg*dg + db*db;
            if (dd < bd) { bd = dd; bc = c; }
        }
        return { d: Math.sqrt(bd), c: bc };
    };

    // --- 1.5 轴向背景模型（覆盖竖向渐变底 + 烤死的棋盘格） ---
    const rowBg = buildAxisModel(rowSamples);
    const colBg = buildAxisModel(colSamples);

    const flood = (like) => {
        const bg = new Uint8Array(w*h), q = [];
        const push = (x,y) => { const i=y*w+x; if (!bg[i] && like[i]) { bg[i]=1; q.push(i); } };
        for (let x=0;x<w;x++){ push(x,0); push(x,h-1); }
        for (let y=0;y<h;y++){ push(0,y); push(w-1,y); }
        while (q.length) {
            const i=q.pop(), x=i%w, y=(i/w)|0;
            for (const [dx,dy] of NB) { const nx=x+dx, ny=y+dy; if (nx>=0&&ny>=0&&nx<w&&ny<h) push(nx,ny); }
        }
        return bg;
    };

    let dist, near, bgLike, bg, adist, acol;
    for (let pass = 0; pass < 3; pass++) {
        dist = new Float32Array(w*h); near = new Array(w*h); bgLike = new Uint8Array(w*h);
        adist = new Float32Array(w*h); acol = new Array(w*h);
        for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
            const i=y*w+x, o=i*4;
            const px = [d[o],d[o+1],d[o+2]];
            const nr = nearest(px);
            dist[i]=nr.d; near[i]=nr.c;
            const dr = dist3(px, rowBg[y]), dc = dist3(px, colBg[x]);
            if (dr <= dc) { adist[i]=dr; acol[i]=rowBg[y]; } else { adist[i]=dc; acol[i]=colBg[x]; }
            if (dist[i] < T || adist[i] < T_AXIS) bgLike[i]=1;
        }
        bg = flood(bgLike);
        // --- 2. 用已识别出的背景区域重估色板 ---
        const samples = [];
        for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
            const i=y*w+x;
            if (!bg[i]) continue;
            const o=i*4; samples.push([d[o],d[o+1],d[o+2]]);
        }
        if (samples.length > 64) pal = kmeans(samples, 16, 22);
    }

    // --- 3. 封闭孔洞（戒指内圈之类）：bgLike 但没和边界背景连通，且面积够大 ---
    const seen = new Uint8Array(w*h); const holes = [];
    for (let s=0; s<w*h; s++) {
        if (seen[s] || !bgLike[s]) continue;
        const comp=[]; const stk=[s]; seen[s]=1;
        while (stk.length) {
            const i=stk.pop(); comp.push(i);
            const cx=i%w, cy=(i/w)|0;
            for (const [dx,dy] of NB) { const nx=cx+dx, ny=cy+dy; if(nx<0||ny<0||nx>=w||ny>=h)continue; const j=ny*w+nx;
                if(!seen[j]&&bgLike[j]){seen[j]=1;stk.push(j);} }
        }
        if (!comp.some(i=>bg[i]) && comp.length > 40) holes.push(...comp);
    }

    // --- 4. 生成 alpha：背景=0，边缘 2px 软化并去背景色偏，其余=1 ---
    const alpha = new Float32Array(w*h);
    for (let i=0;i<w*h;i++) alpha[i] = (d[i*4+3]===0) ? 0 : 1;
    for (let i=0;i<w*h;i++) if (bg[i]) alpha[i]=0;
    for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
        const i=y*w+x; if (bg[i]) continue;
        let edge=false;
        for (let dy=-SOFT;dy<=SOFT&&!edge;dy++) for (let dx=-SOFT;dx<=SOFT;dx++) {
            const nx=x+dx, ny=y+dy; if(nx<0||ny<0||nx>=w||ny>=h)continue;
            if (bg[ny*w+nx]) { edge=true; break; }
        }
        if (!edge) continue;
        const rp = (dist[i]-2)/(T-2);
        const rm = (adist[i]-2)/(T_AXIS-2);
        const r = Math.max(0, Math.min(1, Math.min(rp, rm)));
        alpha[i] = Math.min(alpha[i], r);
    }
    for (const i of holes) alpha[i]=0;

    const out = ctx.createImageData(w,h), od = out.data;
    for (let i=0;i<w*h;i++) {
        const o=i*4, al=alpha[i];
        if (al<=0.03) { od[o+3]=0; continue; }
        if (al<0.97) {
            const useAxis = adist[i] <= dist[i];
            const b = useAxis ? acol[i] : near[i];
            for (let c=0;c<3;c++){ const f=(d[o+c]-(1-al)*b[c])/(al||1); od[o+c]=Math.max(0,Math.min(255,Math.round(f))); }
        } else { od[o]=d[o]; od[o+1]=d[o+1]; od[o+2]=d[o+2]; }
        od[o+3]=Math.round(al*255);
    }

    // --- 5. 补针孔 + 去杂点 + 清除右下角 AI 水印 ---
    const op = i => od[i*4+3] > 100;
    for (let pass=0; pass<2; pass++) {
        for (let y=1;y<h-1;y++) for (let x=1;x<w-1;x++) {
            const i=y*w+x; if (op(i)) continue;
            let c=0; for (const [dx,dy] of NB) if (op((y+dy)*w+(x+dx))) c++;
            if (c>=5) { const o=i*4; od[o]=d[o]; od[o+1]=d[o+1]; od[o+2]=d[o+2]; od[o+3]=255; }
        }
    }
    const seen2 = new Uint8Array(w*h);
    for (let sy=0;sy<h;sy++) for (let sx=0;sx<w;sx++) {
        const st=sy*w+sx; if (seen2[st]||!op(st)) continue;
        const comp=[]; const stk=[st]; seen2[st]=1; let tb=false;
        while (stk.length) {
            const i=stk.pop(); comp.push(i);
            const cx=i%w, cy=(i/w)|0;
            if (cx===0||cy===0||cx===w-1||cy===h-1) tb=true;
            for (const [dx,dy] of NB){ const nx=cx+dx, ny=cy+dy; if(nx<0||ny<0||nx>=w||ny>=h)continue; const j=ny*w+nx;
                if(!seen2[j]&&op(j)){seen2[j]=1;stk.push(j);} }
        }
        const minY=Math.min(...comp.map(i=>(i/w)|0)), maxX=Math.max(...comp.map(i=>i%w));
        const inBR = maxX > w*0.42 && minY > h*0.74;
        if ((comp.length < 24 && !tb) || (inBR && comp.length < 1500 && !tb)) for (const i of comp) od[i*4+3]=0;
    }

    // --- 6. 清掉「黑色水印框」：右下角成片的纯黑矩形，连框内白字一起抹掉 ---
    {
        const black = i => { const o=i*4; if (od[o+3] <= 100) return false; return Math.max(od[o],od[o+1],od[o+2]) < 72; };
        const seenB = new Uint8Array(w*h);
        for (let s=0; s<w*h; s++) {
            if (seenB[s] || !black(s)) continue;
            const comp=[]; const stk=[s]; seenB[s]=1;
            let minX=w, maxX=-1, minY=h, maxY=-1;
            while (stk.length) {
                const i=stk.pop(); comp.push(i);
                const cx=i%w, cy=(i/w)|0;
                if (cx<minX) minX=cx; if (cx>maxX) maxX=cx;
                if (cy<minY) minY=cy; if (cy>maxY) maxY=cy;
                for (const [dx,dy] of NB) { const nx=cx+dx, ny=cy+dy; if(nx<0||ny<0||nx>=w||ny>=h)continue; const j=ny*w+nx;
                    if (!seenB[j] && black(j)) { seenB[j]=1; stk.push(j); } }
            }
            // 只处理右下角、且是「成片矩形」的黑块
            if (comp.length > 110 && minY > h*0.62 && maxX > w*0.45) {
                const bw = maxX-minX+1, bh = maxY-minY+1;
                if (bw*bh < w*h*0.45) {
                    const x0 = Math.max(0, minX-2), x1 = Math.min(w-1, maxX+2);
                    const y0 = Math.max(0, minY-2), y1 = Math.min(h-1, maxY+2);
                    for (let y=y0; y<=y1; y++) for (let x=x0; x<=x1; x++) od[(y*w+x)*4+3]=0;
                }
            }
        }
    }

    // --- 7. 清掉「白色光池」：亮且低饱和、成片的大块残留（AI 画进图里的地面高光） ---
    {
        const bright = i => { const o=i*4; if (od[o+3] <= 100) return false;
            const r=od[o], g=od[o+1], b=od[o+2];
            const mx=Math.max(r,g,b), mn=Math.min(r,g,b);
            return mx >= 150 && (mx-mn) <= 60; };
        const seenW = new Uint8Array(w*h);
        for (let s=0; s<w*h; s++) {
            if (seenW[s] || !bright(s)) continue;
            const comp=[]; const stk=[s]; seenW[s]=1;
            while (stk.length) {
                const i=stk.pop(); comp.push(i);
                const cx=i%w, cy=(i/w)|0;
                for (const [dx,dy] of NB) { const nx=cx+dx, ny=cy+dy; if(nx<0||ny<0||nx>=w||ny>=h)continue; const j=ny*w+nx;
                    if (!seenW[j] && bright(j)) { seenW[j]=1; stk.push(j); } }
            }
            // 只清「大而扁」的块：影棚地面高光是大片扁平区域，
            // 紧凑的高光核心（如闪电白芯）不在这条规则里，避免误伤图标
            let bminX=w, bmaxX=-1, bminY=h, bmaxY=-1;
            for (const i of comp) {
                const cx=i%w, cy=(i/w)|0;
                if (cx<bminX) bminX=cx; if (cx>bmaxX) bmaxX=cx;
                if (cy<bminY) bminY=cy; if (cy>bmaxY) bmaxY=cy;
            }
            const bw2 = bmaxX-bminX+1, bh2 = bmaxY-bminY+1;
            const flat = (bw2 > bh2 * 1.7) || (comp.length / Math.max(1, bw2*bh2) < 0.62);
            if (comp.length > 200 && flat) for (const i of comp) od[i*4+3]=0;
        }
    }

    // --- 8. 清掉右下角 AI 水印残留：整块落在右下角、且孤立的小碎块 ---
    {
        const solid = i => od[i*4+3] > 60;
        const seenC = new Uint8Array(w*h);
        for (let s=0; s<w*h; s++) {
            if (seenC[s] || !solid(s)) continue;
            const comp=[]; const stk=[s]; seenC[s]=1;
            let minX=w, maxX=-1, minY=h, maxY=-1;
            while (stk.length) {
                const i=stk.pop(); comp.push(i);
                const cx=i%w, cy=(i/w)|0;
                if (cx<minX) minX=cx; if (cx>maxX) maxX=cx;
                if (cy<minY) minY=cy; if (cy>maxY) maxY=cy;
                for (const [dx,dy] of NB) { const nx=cx+dx, ny=cy+dy; if(nx<0||ny<0||nx>=w||ny>=h)continue; const j=ny*w+nx;
                    if (!seenC[j] && solid(j)) { seenC[j]=1; stk.push(j); } }
            }
            // 四角里「孤立 + 灰色」的碎块 = 影棚底/水印残留，不是主体
            const inCorner =
                (minX > w*0.68 && minY > h*0.70) ||   // 右下
                (maxX < w*0.30 && minY > h*0.70) ||   // 左下
                (maxX < w*0.30 && maxY < h*0.26) ||   // 左上
                (minX > w*0.68 && maxY < h*0.26);     // 右上
            let gray = true;
            for (const i of comp) {
                const o=i*4, r=od[o], g=od[o+1], b=od[o+2];
                if (Math.max(r,g,b) - Math.min(r,g,b) > 50) { gray = false; break; }
            }
            if (inCorner && gray && comp.length < 900) for (const i of comp) od[i*4+3]=0;
        }
    }

    if (wmRect) {
        for (let y=wmRect.y0; y<=wmRect.y1; y++) for (let x=wmRect.x0; x<=wmRect.x1; x++) od[(y*w+x)*4+3]=0;
    }

    ctx.putImageData(out, 0, 0);
    return { png: cv.toDataURL('image/png'), webp: cv.toDataURL('image/webp', 0.92), w, h };
}`;

async function main() {
    const { chrome, page } = await launch();
    const { ws, send, evaluate, raw } = await connect(page);
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 1400, deviceScaleFactor: 1, mobile: false });

    fs.mkdirSync(PREVIEW_DIR, { recursive: true });
    const blank = path.join(PREVIEW_DIR, 'blank.html');
    fs.writeFileSync(blank, '<!doctype html><meta charset="utf-8"><body style="background:#c0c"></body>');
    await send('Page.navigate', { url: 'file:///' + blank.replace(/\\/g, '/') });
    await sleep(800);
    await raw(KERNEL);
    const results = [];
    for (const t of TARGETS) {
        const abs = path.join(ROOT, t.png).replace(/\\/g, '/');
        const r = await evaluate('return await knockOut(' + JSON.stringify('file:///' + abs) + ');');
        const base = path.basename(t.png);
        if (WRITE) {
            fs.writeFileSync(path.join(ROOT, t.png), Buffer.from(r.png.split(',')[1], 'base64'));
            if (t.webp) fs.writeFileSync(path.join(ROOT, t.webp), Buffer.from(r.webp.split(',')[1], 'base64'));
        } else {
            fs.writeFileSync(path.join(PREVIEW_DIR, base), Buffer.from(r.png.split(',')[1], 'base64'));
        }
        results.push({ file: t.png, w: r.w, h: r.h, pngKB: Math.round(r.png.length * 0.75 / 1024), webpKB: t.webp ? Math.round(r.webp.length * 0.75 / 1024) : null });
        console.log((WRITE ? '✔ ' : '· ') + t.png + '  ' + r.w + 'x' + r.h + '  png≈' + results.at(-1).pngKB + 'KB' + (t.webp ? '  webp≈' + results.at(-1).webpKB + 'KB' : ''));
    }
    console.log('\n' + (WRITE ? '已原地写回 ' : '预览输出到 ') + (WRITE ? '仓库' : PREVIEW_DIR));
    try { spawnSync('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore', timeout: 20000 }); } catch (_) {}
    ws.close();
    process.exit(0);
}

main().catch(e => { console.error('失败:', e); process.exit(1); });




