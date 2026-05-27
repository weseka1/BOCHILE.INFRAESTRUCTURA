import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Activity } from 'lucide-react';

interface HeroMetric {
  label: string;
  value: string | number;
  hint?: string;
  to?: string;
  accent?: 'gold' | 'emerald' | 'blue' | 'pink';
}

interface HeroVideoProps {
  /** Video desktop (recomendado <8MB, H.264 mp4 con faststart). Default: /hero.mp4 si existe. */
  videoUrl?: string;
  /** Video mobile mas chico (recomendado <4MB). Default: /hero-mobile.mp4 si existe. */
  videoUrlMobile?: string;
  /** Poster mientras carga el video. Default: Unsplash alta res (mansion moderna). */
  posterUrl?: string;
  /** Donde anclar el frame visible cuando el video se recorta por object-cover.
   *  Por default usamos 'center 70%' para que se vea la casa, NO el cielo. */
  objectPosition?: string;
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

const FALLBACK_POSTER = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2400&q=85';

// Bumpear cuando se cambia el video — fuerza al browser a refetchear (evita cache stale).
const VIDEO_VERSION = 'v7';

export function HeroVideo({
  videoUrl = `/hero.mp4?${VIDEO_VERSION}`,
  videoUrlMobile = `/hero-mobile.mp4?${VIDEO_VERSION}`,
  posterUrl = `/hero-poster.jpg?${VIDEO_VERSION}`,
  objectPosition = 'center center',
  title,
  tagline = 'WHERE VISION BECOMES REALITY',
  caption = 'Bochile Inmobiliaria · Desde 1970 · Bahia Blanca',
  metrics = [],
}: HeroVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  // Calculamos el src en JS: el attr <source media> NO funciona en Chrome moderno
  // (siempre agarra el primer source), asi que elegimos el src manualmente.
  const [activeSrc, setActiveSrc] = useState<string>(() => {
    if (typeof window === 'undefined') return videoUrl;
    return window.matchMedia('(max-width: 768px)').matches ? videoUrlMobile : videoUrl;
  });

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const onChange = () => setActiveSrc(mq.matches ? videoUrlMobile : videoUrl);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [videoUrl, videoUrlMobile]);

  // Autoplay agresivo PERO sin reiniciar: una vez que termina, se queda en el frame final
  // (la mansion completa de noche con pileta). No loop.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    let cancelled = false;
    let ended = false;
    const tryPlay = () => {
      if (cancelled || ended || !v.paused) return;
      const p = v.play();
      if (p && typeof p.catch === 'function') p.catch(() => { /* retry en proximo evento */ });
    };
    const onEnded = () => {
      ended = true;
      // Quedarse en el ultimo frame (mansion terminada). Sin esto algunos browsers
      // vuelven al frame 0 o muestran el poster.
      try { v.currentTime = Math.max(0, v.duration - 0.04); } catch {}
      v.pause();
    };
    tryPlay();
    v.addEventListener('loadeddata', tryPlay);
    v.addEventListener('canplay', tryPlay);
    v.addEventListener('ended', onEnded);
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) tryPlay();
    }, { threshold: 0.01 });
    io.observe(v);
    const onVis = () => { if (document.visibilityState === 'visible') tryPlay(); };
    document.addEventListener('visibilitychange', onVis);
    const onInteract = () => tryPlay();
    document.addEventListener('click', onInteract, { once: true });
    document.addEventListener('touchstart', onInteract, { once: true });
    document.addEventListener('keydown', onInteract, { once: true });
    return () => {
      cancelled = true;
      v.removeEventListener('loadeddata', tryPlay);
      v.removeEventListener('canplay', tryPlay);
      v.removeEventListener('ended', onEnded);
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      document.removeEventListener('click', onInteract);
      document.removeEventListener('touchstart', onInteract);
      document.removeEventListener('keydown', onInteract);
    };
  }, [activeSrc]);

  const activePoster = posterFailed ? FALLBACK_POSTER : posterUrl;

  return (
    <div ref={containerRef} className="relative mb-6 rounded-2xl overflow-hidden border border-accent/20 shadow-glow group">
      {/* MEDIA BACKGROUND: video fluido con poster fallback */}
      <div className="absolute inset-0 w-full h-full overflow-hidden bg-black">
        {!videoFailed ? (
          <video
            ref={videoRef}
            key={activeSrc}
            src={activeSrc}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition }}
            poster={activePoster}
            autoPlay
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
            onError={() => setVideoFailed(true)}
          />
        ) : (
          <img
            src={activePoster}
            alt=""
            className="absolute inset-0 w-full h-full object-cover hero-kenburns"
            style={{ objectPosition }}
            onError={() => setPosterFailed(true)}
            aria-hidden="true"
          />
        )}
        {/* Overlay oscuro para legibilidad */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/85 pointer-events-none" />
        {/* Overlay dorado sutil */}
        <div className="absolute inset-0 bg-gradient-to-r from-accent/15 via-transparent to-transparent pointer-events-none" />
        {/* Light pulse (luces interiores) */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_75%,rgba(255,200,120,0.18)_0%,transparent_70%)] hero-pulse pointer-events-none" />
        {/* Vignette */}
        <div className="absolute inset-0 shadow-[inset_0_0_180px_rgba(0,0,0,0.7)] pointer-events-none" />
      </div>

      {/* CONTENIDO */}
      <div className="relative z-10 p-5 sm:p-8 lg:p-10 min-h-[420px] sm:min-h-[500px] lg:min-h-[600px] xl:min-h-[680px] flex flex-col justify-between">
        {/* TOP: estado + tagline */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-emerald-400/30">
            <Activity className="w-3 h-3 text-emerald-300 animate-pulse" />
            <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-200 font-semibold">Sistema operando 24/7</span>
          </div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-white/60 font-medium">
            {caption}
          </div>
        </div>

        {/* CENTER: Tagline */}
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
