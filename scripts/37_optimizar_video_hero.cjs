// Optimiza un video pesado (ej. 32MB de Sora/Veo/Runway) para usarlo como
// Hero fluido del dashboard. Genera 2 variantes (desktop + mobile) y un poster.
//
// USO:
//   node scripts/37_optimizar_video_hero.cjs <ruta/al/video.mp4>
//
// Si no pasas ruta, busca el video MAS RECIENTE > 20MB en:
//   ~/Downloads, ~/Desktop, ~/Videos
//
// OUTPUTS (en apps/dashboard-ui/public/):
//   - hero.mp4         1280x720  H.264 CRF 26  sin audio  faststart  (~5-8 MB)
//   - hero-mobile.mp4  854x480   H.264 CRF 28  sin audio  faststart  (~2-4 MB)
//   - hero-poster.jpg  frame del segundo 2 (para poster fallback)
//
// Requiere: @ffmpeg-installer/ffmpeg (binario estatico de ffmpeg, sin instalacion del sistema).
// Lo instala on-the-fly si falta.

const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync, execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'apps', 'dashboard-ui', 'public');
const UI_DIR = path.join(ROOT, 'apps', 'dashboard-ui');

if (!fs.existsSync(PUBLIC_DIR)) {
  console.error('ERROR: no existe', PUBLIC_DIR);
  process.exit(1);
}

// 1) Resolver input
function findLatestVideo() {
  const home = os.homedir();
  const dirs = [
    path.join(home, 'Downloads'),
    path.join(home, 'Desktop'),
    path.join(home, 'Videos'),
  ].filter(d => fs.existsSync(d));
  const exts = new Set(['.mp4', '.webm', '.mov', '.mkv']);
  const candidates = [];
  function walk(dir, depth) {
    if (depth > 3) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const full = path.join(dir, e.name);
      try {
        if (e.isDirectory()) walk(full, depth + 1);
        else if (exts.has(path.extname(e.name).toLowerCase())) {
          const st = fs.statSync(full);
          if (st.size > 20 * 1024 * 1024) {
            candidates.push({ path: full, size: st.size, mtime: st.mtimeMs });
          }
        }
      } catch {}
    }
  }
  for (const d of dirs) walk(d, 0);
  candidates.sort((a, b) => b.mtime - a.mtime);
  return candidates[0]?.path || null;
}

let INPUT = process.argv[2];
if (!INPUT) {
  console.log('No se paso ruta. Buscando el video > 20MB mas reciente en Downloads/Desktop/Videos...');
  INPUT = findLatestVideo();
  if (!INPUT) {
    console.error('ERROR: no encontre ningun video > 20MB. Pasa la ruta como argumento:');
    console.error('  node scripts/37_optimizar_video_hero.cjs "C:\\ruta\\al\\video.mp4"');
    process.exit(1);
  }
}
if (!fs.existsSync(INPUT)) {
  console.error('ERROR: no existe el archivo de entrada:', INPUT);
  process.exit(1);
}
const inSize = (fs.statSync(INPUT).size / (1024 * 1024)).toFixed(1);
console.log(`\nInput: ${INPUT}\nTamano original: ${inSize} MB\n`);

// 2) Localizar ffmpeg (intenta del sistema, si no instala @ffmpeg-installer/ffmpeg)
function resolveFfmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return 'ffmpeg';
  } catch {}
  const localPkg = path.join(UI_DIR, 'node_modules', '@ffmpeg-installer', 'ffmpeg');
  if (!fs.existsSync(localPkg)) {
    console.log('Instalando @ffmpeg-installer/ffmpeg (binario estatico, solo 1ra vez)...');
    execSync('npm install @ffmpeg-installer/ffmpeg --no-save', { cwd: UI_DIR, stdio: 'inherit' });
  }
  const installer = require(path.join(UI_DIR, 'node_modules', '@ffmpeg-installer', 'ffmpeg'));
  return installer.path;
}
const FFMPEG = resolveFfmpeg();
console.log('ffmpeg:', FFMPEG, '\n');

// 3) Ejecutar transcodes
function run(args, label) {
  console.log(`  -> ${label}`);
  execFileSync(FFMPEG, args, { stdio: ['ignore', 'ignore', 'inherit'] });
}

const OUT_DESKTOP = path.join(PUBLIC_DIR, 'hero.mp4');
const OUT_MOBILE = path.join(PUBLIC_DIR, 'hero-mobile.mp4');
const OUT_POSTER = path.join(PUBLIC_DIR, 'hero-poster.jpg');

// Desktop: 1280x720, H.264 high, CRF 26, sin audio, faststart, pixfmt yuv420p
// scale: ancho hasta 1280, alto en multiplo de 2 para H.264, preservando aspect (height = -2)
const DESKTOP_ARGS = [
  '-y', '-i', INPUT,
  '-vf', 'scale=1280:-2',
  '-c:v', 'libx264',
  '-profile:v', 'high',
  '-preset', 'slow',          // mejor compresion (build-once, sirve-mil-veces)
  '-crf', '26',
  '-pix_fmt', 'yuv420p',
  '-an',                       // sin audio (hero es muted)
  '-movflags', '+faststart',   // metadata al inicio para streaming
  OUT_DESKTOP,
];

const MOBILE_ARGS = [
  '-y', '-i', INPUT,
  '-vf', 'scale=854:-2',
  '-c:v', 'libx264',
  '-profile:v', 'main',
  '-preset', 'slow',
  '-crf', '28',
  '-pix_fmt', 'yuv420p',
  '-an',
  '-movflags', '+faststart',
  OUT_MOBILE,
];

const POSTER_ARGS = [
  '-y', '-ss', '2', '-i', INPUT,
  '-frames:v', '1',
  '-vf', 'scale=1920:-2',
  '-q:v', '3',
  OUT_POSTER,
];

console.log('Transcodificando (preset slow, esto puede tardar 1-3 min)...');
run(DESKTOP_ARGS, 'hero.mp4 (1280x720 / CRF 26)');
run(MOBILE_ARGS, 'hero-mobile.mp4 (854x480 / CRF 28)');
run(POSTER_ARGS, 'hero-poster.jpg (frame @ 2s)');

// 4) Reporte
function mb(p) { return (fs.statSync(p).size / (1024 * 1024)).toFixed(2); }
console.log('\nGenerado:');
console.log(`  /hero.mp4         ${mb(OUT_DESKTOP).padStart(6)} MB`);
console.log(`  /hero-mobile.mp4  ${mb(OUT_MOBILE).padStart(6)} MB`);
console.log(`  /hero-poster.jpg  ${mb(OUT_POSTER).padStart(6)} MB`);
console.log(`\nReduccion desktop: ${inSize} MB -> ${mb(OUT_DESKTOP)} MB`);
console.log('\nLISTO. El componente HeroVideo ya apunta a /hero.mp4 + /hero-mobile.mp4.');
