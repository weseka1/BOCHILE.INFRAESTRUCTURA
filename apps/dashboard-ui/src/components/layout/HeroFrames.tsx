import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Activity } from 'lucide-react';

interface HeroMetric {
  label: string;
  value: string | number;
  hint?: string;
  to?: string;
  accent?: 'gold' | 'emerald' | 'blue' | 'pink';
}

interface HeroFramesProps {
  /** URLs de los frames en orden de construccion (terreno -> casa terminada). Default: 8 frames locales. */
  frames?: string[];
  /** Duracion que cada frame se mantiene visible (ms). Default: 1800 */
  holdMs?: number;
  /** Duracion del cross-fade entre frames (ms). Default: 700 */
  fadeMs?: number;
  /** Pausa extra en el ULTIMO frame antes de loopear (ms). Default: 3500 */
  finalHoldMs?: number;
  title?: React.ReactNode;
  tagline?: string;
  caption?: string;
  metrics?: HeroMetric[];
}

const ACCENT_MAP: Record<string, string> = {
  gold: 'text-accent',
  emerald: 'text-emerald-300',
  blue: 'text-blue-300',
  pink: 'text-pink-300',
};
const ACCENT_BORDER: Record<string, string> = {
  gold: 'hover:border-accent/60',
  emerald: 'hover:border-emerald-400/60',
  blue: 'hover:border-blue-400/60',
  pink: 'hover:border-pink-400/60',
};

const DEFAULT_FRAMES = [
  '/hero-frames/frame-1.jpg',
  '/hero-frames/frame-2.jpg',
  '/hero-frames/frame-3.jpg',
  '/hero-frames/frame-4.jpg',
  '/hero-frames/frame-5.jpg',
  '/hero-frames/frame-6.jpg',
  '/hero-frames/frame-7.jpg',
  '/hero-frames/frame-8.jpg',
];

// Fallback cuando los frames locales no existen (404) - mansion Unsplash
const FALLBACK_POSTER = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2400&q=85';

export function HeroFrames({
  frames = DEFAULT_FRAMES,
  holdMs = 1800,
  fadeMs = 700,
  finalHoldMs = 3500,
  title,
  tagline = 'WHERE VISION BECOMES REALITY',
  caption = 'BOCHILE · 1970 · Sistema Operativo IA',
  metrics = [],
}: HeroFramesProps) {
  const [current, setCurrent] = useState(0);
  const [allLoaded, setAllLoaded] = useState(false);
  const [loadedOk, setLoadedOk] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Preload de TODAS las imagenes. Si NINGUNA cargo (404 todas), usamos fallback.
  useEffect(() => {
    let cancelled = false;
    let pending = frames.length;
    let ok = 0;
    if (pending === 0) { setAllLoaded(true); return; }
    frames.forEach((src) => {
      const img = new Image();
      img.onload = () => {
        ok++;
        pending--;
        if (!cancelled && pending <= 0) {
          setLoadedOk(ok);
          setAllLoaded(true);
        }
      };
      img.onerror = () => {
        pending--;
        if (!cancelled && pending <= 0) {
          setLoadedOk(ok);
          setAllLoaded(true);
        }
      };
      img.src = src;
    });
    return () => { cancelled = true; };
  }, [frames]);

  // Si NO cargo ninguna imagen real, usar el fallback poster (no loop)
  const useFallback = allLoaded && loadedOk === 0;
  const activeFrames = useFallback ? [FALLBACK_POSTER] : frames;

  // Loop: cicla los frames con hold + fade. El ultimo frame se queda mas tiempo.
  // No loopea si hay solo 1 frame (caso fallback).
  useEffect(() => {
    if (!allLoaded) return;
    if (activeFrames.length <= 1) return;
    const isLast = current === activeFrames.length - 1;
    const delay = isLast ? finalHoldMs : holdMs;
    timerRef.current = setTimeout(() => {
      setCurrent((c) => (c + 1) % activeFrames.length);
    }, delay);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [current, allLoaded, activeFrames.length, holdMs, finalHoldMs]);

  // Respeta prefers-reduced-motion -> solo muestra el ultimo frame estatico
  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  return (
    <div className="relative mb-6 rounded-2xl overflow-hidden border border-accent/20 shadow-glow group">
      {/* STACK de frames superpuestos */}
      <div className="absolute inset-0 w-full h-full overflow-hidden bg-black">
        {/* Mientras carga, mostrar fallback poster con Ken Burns - evita pantalla negra */}
        {!allLoaded && (
          <img
            src={FALLBACK_POSTER}
            alt=""
            className="absolute inset-0 w-full h-full object-cover hero-kenburns"
            aria-hidden="true"
          />
        )}
        {activeFrames.map((src, i) => {
          const isActive = useFallback
            ? true // fallback siempre visible
            : prefersReducedMotion ? i === activeFrames.length - 1 : i === current;
          return (
            <img
              key={src + '-' + i}
              src={src}
              alt=""
              loading={i === 0 ? 'eager' : 'lazy'}
              className={`absolute inset-0 w-full h-full object-cover ${useFallback ? 'hero-kenburns' : ''}`}
              style={{
                opacity: isActive ? 1 : 0,
                transition: `opacity ${fadeMs}ms ease-in-out`,
                willChange: 'opacity',
              }}
              aria-hidden="true"
            />
          );
        })}
        {/* Overlay legibilidad */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/85 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-accent/15 via-transparent to-transparent pointer-events-none" />
        <div className="absolute inset-0 shadow-[inset_0_0_180px_rgba(0,0,0,0.7)] pointer-events-none" />
        {/* Progress bar abajo (solo cuando hay loop real, no en fallback) */}
        {!useFallback && activeFrames.length > 1 && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10 pointer-events-none">
            <div
              className="h-full bg-accent transition-all"
              style={{
                width: `${((current + 1) / activeFrames.length) * 100}%`,
                transitionDuration: `${fadeMs}ms`,
              }}
            />
          </div>
        )}
      </div>

      {/* CONTENIDO encima */}
      <div className="relative z-10 p-5 sm:p-8 lg:p-10 min-h-[420px] sm:min-h-[460px] flex flex-col justify-between">
        {/* TOP */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-emerald-400/30">
            <Activity className="w-3 h-3 text-emerald-300 animate-pulse" />
            <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-200 font-semibold">Sistema operando 24/7</span>
          </div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-white/60 font-medium">
            {caption}
          </div>
        </div>

        {/* CENTER */}
        <div className="flex-1 flex flex-col justify-center items-start mt-6 mb-6">
          {title ? (
            <h1 className="font-display text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[0.95] tracking-tight drop-shadow-2xl">
              {title}
            </h1>
          ) : (
            <h1 className="font-display text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[0.95] tracking-tight drop-shadow-2xl">
              Panel <span className="text-accent">Central</span>
            </h1>
          )}
          <p className="mt-3 sm:mt-4 text-xs sm:text-sm uppercase tracking-[0.35em] sm:tracking-[0.4em] text-white/75 font-light">
            {tagline}
          </p>
        </div>

        {/* BOTTOM: metricas glassmorphism */}
        {metrics.length > 0 && (
          <div className={`grid grid-cols-2 ${metrics.length >= 4 ? 'sm:grid-cols-4' : metrics.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-2 sm:gap-3`}>
            {metrics.map((m, i) => {
              const accentColor = ACCENT_MAP[m.accent || 'gold'];
              const accentBorder = ACCENT_BORDER[m.accent || 'gold'];
              const content = (
                <>
                  <div className="text-[9px] sm:text-[10px] uppercase tracking-[0.15em] text-white/60 font-medium">
                    {m.label}
                  </div>
                  <div className={`font-display text-xl sm:text-2xl md:text-3xl font-bold mt-0.5 sm:mt-1 ${accentColor} flex items-center gap-1.5`}>
                    {m.value}
                    {m.to && (
                      <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 opacity-0 group-hover:opacity-60 transition-opacity" />
                    )}
                  </div>
                  {m.hint && (
                    <div className="text-[9px] sm:text-[10px] text-white/50 mt-0.5 truncate">{m.hint}</div>
                  )}
                </>
              );
              const klass = `block px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-white/5 backdrop-blur-xl border border-white/15 ${accentBorder} hover:bg-white/10 transition-all`;
              return m.to ? (
                <Link key={i} to={m.to} className={klass}>{content}</Link>
              ) : (
                <div key={i} className={klass}>{content}</div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
