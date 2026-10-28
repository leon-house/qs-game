import http from 'http';
const urls = [
  'http://106.54.31.70:8080/src/main.js',
  'http://106.54.31.70:8080/src/data/gameData.js',
  'http://106.54.31.70:8080/src/systems/battle-canvas.js',
  'http://106.54.31.70:8080/src/systems/battle-v2.js',
  'http://106.54.31.70:8080/src/core/renderer.js',
  'http://106.54.31.70:8080/src/ui/ui.js',
  'http://106.54.31.70:8080/src/systems/equipment.js',
];
let i = 0;
function next() {
  if (i >= urls.length) return;
  const u = urls[i++];
  http.get(u, (res) => {
    let total = 0;
    res.on('data', d => total += d.length);
    res.on('end', () => {
      const ct = res.headers['content-type'] || '';
      const ctOk = (ct.includes('javascript') || ct.includes('css')) ? '✓' : '✗';
      console.log(`${ctOk} ${res.statusCode} ${total}B ${ct.padEnd(28)} ${u}`);
      next();
    });
  });
}
next();