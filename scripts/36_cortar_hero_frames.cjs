// Corta la imagen original (grid 4x2 de 8 frames) en 8 imágenes separadas.
// Coloca la imagen original en: apps/dashboard-ui/public/hero-original.jpg (o .png)
// Output: apps/dashboard-ui/public/hero-frames/frame-1.jpg ... frame-8.jpg
//
// Uso: node scripts/36_cortar_hero_frames.cjs
//
// Requiere: sharp (instalo automaticamente si falta)

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'apps', 'dashboard-ui', 'public');
const FRAMES_DIR = path.join(PUBLIC_DIR, 'hero-frames');

// Buscar la imagen original
const candidates = ['hero-original.jpg', 'hero-original.png', 'hero-original.webp', 'hero.jpg', 'hero.png'];
const originalPath = candidates.map(f => path.join(PUBLIC_DIR, f)).find(p => fs.existsSync(p));
if (!originalPath) {
  console.error('ERROR: no encontre la imagen original en public/. Pone el archivo en:');
  console.error('  ' + path.join(PUBLIC_DIR, 'hero-original.jpg'));
  process.exit(1);
}
console.log('Imagen origen:', originalPath);

// Instalar sharp si falta (en el subproyecto dashboard-ui)
const UI_DIR = path.join(ROOT, 'apps', 'dashboard-ui');
const sharpInstalled = fs.existsSync(path.join(UI_DIR, 'node_modules', 'sharp'));
if (!sharpInstalled) {
  console.log('Instalando sharp temporal en dashboard-ui...');
  execSync('npm install sharp --no-save', { cwd: UI_DIR, stdio: 'inherit' });
}
const sharp = require(path.join(UI_DIR, 'node_modules', 'sharp'));

// Crear directorio de salida
if (!fs.existsSync(FRAMES_DIR)) fs.mkdirSync(FRAMES_DIR, { recursive: true });

(async () => {
  const meta = await sharp(originalPath).metadata();
  console.log('Dimensiones origen:', meta.width + 'x' + meta.height);

  // Grid 4x2 = 4 columnas x 2 filas
  const COLS = 4;
  const ROWS = 2;
  const tileW = Math.floor(meta.width / COLS);
  const tileH = Math.floor(meta.height / ROWS);
  console.log('Tile size:', tileW + 'x' + tileH);

  // Detectar y skipear bordes negros automaticamente (si tu imagen tiene marco)
  // Cropeamos cada frame y guardamos
  let idx = 1;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const left = col * tileW;
      const top = row * tileH;
      const out = path.join(FRAMES_DIR, `frame-${idx}.jpg`);
      await sharp(originalPath)
        .extract({ left, top, width: tileW, height: tileH })
        .jpeg({ quality: 88, progressive: true, mozjpeg: true })
        .toFile(out);
      console.log('  +', `frame-${idx}.jpg`, `(${tileW}x${tileH})`);
      idx++;
    }
  }
  console.log('\nOK. 8 frames generados en:', FRAMES_DIR);
  console.log('Los podes referenciar desde el dashboard como /hero-frames/frame-1.jpg ... frame-8.jpg');
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
