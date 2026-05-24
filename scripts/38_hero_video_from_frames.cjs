// Genera un VIDEO FLUIDO (.mp4) de 1080p desde los 8 frames del hero.
// Trucos para que NO parezca "fotos corriendo" sino time-lapse de construccion:
//   - Cada frame con zoom pronunciado (1.0 -> 1.22) durante su duracion: motion constante
//   - Pacing time-lapse: 1.4s por frame (no se siente foto estatica)
//   - Crossfade rapido (0.45s) tipo cut de obra
//   - Frame 8 (casa terminada) se queda 4s con zoom suave + es el reveal
//   - Compositing: fondo = mismo frame upscaleado + blur fuerte (rellena 16:9 sin recortar
//     el panel cuadrado); foreground = el frame centrado a altura completa (NO se pierde la casa)
//   - Output 1920x1080 H.264 high CRF 28 + faststart -> ~5-8 MB
//
// USO: node scripts/38_hero_video_from_frames.cjs

const path = require('path');
const fs = require('fs');
const { execFileSync, execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'apps', 'dashboard-ui', 'public');
const FRAMES_DIR = path.join(PUBLIC_DIR, 'hero-frames');
const UI_DIR = path.join(ROOT, 'apps', 'dashboard-ui');

const frames = Array.from({ length: 8 }, (_, i) => path.join(FRAMES_DIR, `frame-${i + 1}.jpg`));
for (const f of frames) if (!fs.existsSync(f)) {
  console.error('Falta', f, '- corre antes scripts/36_cortar_hero_frames.cjs');
  process.exit(1);
}

// 1) ffmpeg con xfade (4.3+). Usamos ffmpeg-static.
function hasXfade(bin) {
  try { return /\sxfade\s/.test(execSync(`"${bin}" -hide_banner -filters`, { encoding: 'utf8' })); }
  catch { return false; }
}
function resolveFfmpeg() {
  if (hasXfade('ffmpeg')) return 'ffmpeg';
  const pkg = path.join(UI_DIR, 'node_modules', 'ffmpeg-static');
  if (!fs.existsSync(pkg)) {
    console.log('Instalando ffmpeg-static (binario moderno con xfade)...');
    execSync('npm install ffmpeg-static --no-save', { cwd: UI_DIR, stdio: 'inherit' });
  }
  const bin = require(pkg);
  if (hasXfade(bin)) return bin;
  throw new Error('ffmpeg sin xfade disponible');
}
const FFMPEG = resolveFfmpeg();
console.log('ffmpeg:', FFMPEG, '\n');

// 2) Filter graph
const W = 1920, H = 1080;
const D_NORMAL = 1.4;    // construccion mas rapida (sensacion time-lapse)
const D_FINAL = 3.5;     // reveal final
const FADE = 0.45;
const FPS = 24;          // cinematografico + 20% menos peso vs 30
const ZOOM_MAX = 1.22;   // zoom pronunciado para que SIEMPRE haya motion

// Para cada frame i con duracion d:
//   - bg: el mismo input scaleado a 1920x1080 STRETCH (no preserve aspect) + boxblur fuerte (fondo borroso)
//   - fg: el input scaleado a altura H preservando aspect (ej. 960x1080) centrado horizontalmente
//   - overlay fg encima de bg en (W-fgW)/2 (centrado horizontal)
//   - sobre el resultado, zoompan con z linear 1.00 -> ZOOM_MAX
function frameFilter(i, d) {
  const n = Math.round(d * FPS);
  const zoomStep = ((ZOOM_MAX - 1) / n).toFixed(6);
  return (
    `[${i}:v]` +
    // Scale a 1080 altura preservando aspect, pad a 1920x1080 con NEGRO (matchea fondo dashboard).
    // Esto es mucho mas eficiente que blur de fondo: pad negro = bitrate casi cero.
    `scale=-2:${H}:flags=lanczos,` +
    `pad=${W}:${H}:(ow-iw)/2:0:color=black,` +
    `setsar=1,` +
    // Zoompan: motion constante (zoom in lento) durante n frames
    `zoompan=z='zoom+${zoomStep}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${n}:s=${W}x${H}:fps=${FPS},setsar=1[v${i}]`
  );
}

const durations = [D_NORMAL, D_NORMAL, D_NORMAL, D_NORMAL, D_NORMAL, D_NORMAL, D_NORMAL, D_FINAL];
const frameFilters = durations.map((d, i) => frameFilter(i, d)).join(';');

// Crossfade chain
const xfades = [];
let cum = 0;
for (let i = 0; i < 7; i++) {
  cum += durations[i];
  const offset = (cum - FADE).toFixed(2);
  const left = i === 0 ? '[v0]' : `[x${i}]`;
  const right = `[v${i + 1}]`;
  const out = i === 6 ? '[outv]' : `[x${i + 1}]`;
  xfades.push(`${left}${right}xfade=transition=fade:duration=${FADE}:offset=${offset}${out}`);
}

const FILTER = frameFilters + ';' + xfades.join(';');

const OUT_DESKTOP = path.join(PUBLIC_DIR, 'hero.mp4');
const OUT_MOBILE = path.join(PUBLIC_DIR, 'hero-mobile.mp4');
const OUT_POSTER = path.join(PUBLIC_DIR, 'hero-poster.jpg');

function runFfmpeg(args, label) {
  console.log(`  -> ${label}`);
  execFileSync(FFMPEG, args, { stdio: ['ignore', 'ignore', 'inherit'] });
}

// IMPORTANTE: -framerate 1 hace que cada input sea 1 sola "image frame" por segundo.
// Sin esto, image2 demuxer usa 25fps default y zoompan multiplica frames (=> video de 5min).
const inputArgs = [];
durations.forEach((d, i) => { inputArgs.push('-framerate', '1', '-loop', '1', '-t', String(d), '-i', frames[i]); });

const DESKTOP_ARGS = [
  '-y', ...inputArgs,
  '-filter_complex', FILTER,
  '-map', '[outv]',
  '-c:v', 'libx264',
  '-profile:v', 'high',
  '-preset', 'slow',
  '-b:v', '3500k',
  '-maxrate', '4500k',
  '-bufsize', '7000k',
  '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart',
  '-r', String(FPS),
  OUT_DESKTOP,
];

console.log('Renderizando hero.mp4 (1920x1080, time-lapse construccion, ~14s)...');
runFfmpeg(DESKTOP_ARGS, 'hero.mp4');

console.log('Generando hero-mobile.mp4 (960x540)...');
runFfmpeg([
  '-y', '-i', OUT_DESKTOP,
  '-vf', 'scale=960:540:flags=lanczos',
  '-c:v', 'libx264', '-profile:v', 'main', '-preset', 'slow',
  '-b:v', '1200k', '-maxrate', '1600k', '-bufsize', '2400k',
  '-pix_fmt', 'yuv420p', '-an',
  '-movflags', '+faststart',
  OUT_MOBILE,
], 'hero-mobile.mp4');

console.log('Generando hero-poster.jpg (frame final)...');
runFfmpeg([
  '-y', '-i', frames[7],
  '-vf', `scale=${W}:${H}:flags=lanczos`,
  '-update', '1', '-frames:v', '1',
  '-q:v', '3',
  OUT_POSTER,
], 'hero-poster.jpg');

function mb(p) { return (fs.statSync(p).size / (1024 * 1024)).toFixed(2); }
console.log('\nGenerado:');
console.log(`  /hero.mp4         ${mb(OUT_DESKTOP).padStart(6)} MB  1920x1080  time-lapse 14s loop`);
console.log(`  /hero-mobile.mp4  ${mb(OUT_MOBILE).padStart(6)} MB   960x540`);
console.log(`  /hero-poster.jpg  ${mb(OUT_POSTER).padStart(6)} MB`);
console.log('\nLISTO. Refresca el dashboard (Ctrl+Shift+R) para ver el nuevo video.');
