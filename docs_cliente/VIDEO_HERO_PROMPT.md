# 🎬 SCRIPT VIDEO HERO BOCHILE — Mansión construyéndose de 0

Prompt master + 5 escenas listas para copiar a Sora 2, Veo 3, Runway Gen-3 o Kling.

---

## RECOMENDACIÓN POR TOOL

| Tool | Calidad | Cómo usar este script |
|---|---|---|
| **Sora 2** (OpenAI Plus/Pro) | 10/10 | Pegá el **MASTER PROMPT** entero. Sora maneja secuencias largas. |
| **Veo 3** (Gemini Advanced / Vertex AI) | 9/10 | Pegá **ESCENA POR ESCENA** (5 clips de 5-8s c/u) y los uno en CapCut/Premiere. |
| **Runway Gen-3 Alpha Turbo** | 8/10 | Igual que Veo 3 (clips cortos). Mejor para tomas drone. |
| **Kling 1.6 Pro** | 8/10 | Clips de 10s. Ideal por costo. |

**Aspect ratio:** 16:9 (1920×1080) horizontal
**Duración total:** 25-35 segundos
**FPS:** 24 (look cinematográfico) o 30 (más liviano)

---

## 🟢 MASTER PROMPT (versión Sora 2 — un solo render)

```
Ultra-cinematic hyper-realistic 30-second commercial showing a modern luxury mansion
constructing itself from absolute zero to completed reveal. Style: Apple + Tesla + Architectural
Digest premium commercial, 8K photorealism, anamorphic lens, volumetric golden-hour lighting,
deep cinematic color grading, smooth crane and drone movements, no people unless cinematic.

ARCHITECTURE REFERENCE: contemporary minimalist Beverly Hills / Malibu mansion. Black concrete
walls with warm vertical premium teak wood cladding, oversized floor-to-ceiling glass panels,
flat dark metal roof, infinity pool reflecting the structure, warm interior lighting glowing
through windows, gardens and palm trees framing the property.

SHOT 1 (0-5s): Empty plot of land at golden-hour sunset, soft warm light, slow cinematic drone
pull-back revealing prepared terrain. Particles of dust suspended in air. Dramatic shadows.
Atmosphere of anticipation.

SHOT 2 (5-10s): Hyper-realistic time-lapse of foundations rising. Excavation, concrete pours
into shape, structural steel columns extend vertically toward the sky, all in seamless smooth
acceleration. Anamorphic flare, dust particles, soft ambient haze.

SHOT 3 (10-15s): Walls and structure form rapidly. Floor-to-ceiling glass panels slide into
place with reflections of the sunset. Vertical premium teak wood cladding wraps the facade
plank by plank. Camera does a slow architectural fly-through, passing through the structure.

SHOT 4 (15-22s): Interiors materialize: warm hanging lights turn on, infinity pool fills with
crystal water, luxury furniture appears, marble counters, designer chandeliers. Sparkling
water reflections. Sunset deepens to golden hour.

SHOT 5 (22-30s): Final epic reveal. Drone crane shot pulls back slowly revealing the entire
finished mansion. Warm interior lights glowing, perfect mirror reflection in infinity pool,
manicured gardens, dusk sky in deep purple-gold transition. Camera continues to rise.

FINAL TEXT OVERLAY (28-30s): Elegant minimalist serif text fades in, centered:
"WHERE VISION BECOMES REALITY"
followed by small wordmark: "BOCHILE · 1970"

TECHNICAL: 16:9, 8K photorealism, anamorphic 2.39:1 letterbox optional, cinematic color grade
warm-cool contrast, Hans Zimmer style ambient piano soundtrack with deep luxury electronic
texture. NO cartoon, NO video-game CGI, NO unrealistic lighting. AAA commercial quality.
```

---

## 🎯 VERSIÓN POR ESCENAS (Veo 3 / Runway / Kling)

Generá cada uno como clip independiente (5-8 segundos) y uní en CapCut/Premiere/DaVinci.

### CLIP 1 — Terreno vacío (5s)
```
Cinematic 5-second drone shot of empty premium real estate plot at golden hour sunset.
Soft warm light, suspended dust particles, dramatic shadows on flat prepared terrain.
Slow drone pull-back. Anamorphic lens flare. Architectural Digest style. 8K photorealism.
No people. Atmosphere of anticipation. NO text.
```

### CLIP 2 — Cimientos y estructura (6s)
```
Hyper-realistic 6-second time-lapse of foundations and steel structure rising on empty plot.
Concrete pours into geometric shapes, structural steel columns extend vertically.
Dust particles, ambient haze, golden-hour light. Smooth accelerated motion.
Cinematic anamorphic lens, 8K photorealism. NO people, NO text.
```

### CLIP 3 — Paredes y vidrio (6s)
```
Cinematic 6-second time-lapse: walls of modern luxury mansion form rapidly. Floor-to-ceiling
glass panels slide into place reflecting sunset. Vertical premium teak wood cladding wraps
the facade. Black concrete contrasts warm wood. Camera does slow architectural fly-through.
Anamorphic lens, dust particles in air, 8K photorealism. NO people, NO text.
```

### CLIP 4 — Interiores y piscina (7s)
```
Cinematic 7-second clip: luxury mansion interiors materialize. Warm pendant lights turn on
gradually, infinity pool fills with crystal water creating reflections, luxury furniture
appears, marble counters, designer chandeliers. Deep golden-hour light. Slow tracking shot.
Hyper-realistic, 8K photorealism, anamorphic lens. NO people, NO text.
```

### CLIP 5 — Reveal final (8s)
```
Epic 8-second drone crane shot pulling back slowly to reveal completed modern luxury mansion
at dusk. Black concrete with vertical teak wood cladding, oversized glass windows glowing warm
interior light, infinity pool with perfect mirror reflection, manicured gardens, palm trees.
Sky transitions from gold to deep purple. Camera rises smoothly. Anamorphic lens.
8K photorealism. Architectural Digest style. NO people. NO text overlay.
```

### CLIP 6 — Text reveal final (3s opcional)
```
Elegant minimalist text fade-in on dark gradient background. Serif typography in champagne gold.
Text reads: "WHERE VISION BECOMES REALITY" centered. Below in smaller text: "BOCHILE · 1970".
Subtle particle effects. Clean, premium, Apple-commercial style. 3 seconds.
```

---

## 🎵 MUSIC PROMPT (Suno AI / Udio)

Si no tenés música stock, generala con Suno/Udio:

```
Ambient cinematic luxury soundtrack, Hans Zimmer style, deep emotional piano with subtle
electronic texture, builds slowly from minimal to triumphant, futuristic luxury feel,
30 seconds, no vocals, perfect for high-end real estate commercial.
```

O usá tracks libres premium:
- **Epidemic Sound** → categoría "Cinematic / Inspiring Corporate"
- **Artlist** → buscar "luxury cinematic" / "elegant rise"
- **YouTube Audio Library** (gratis): buscar "cinematic ambient piano"

---

## 📦 ENTREGABLE FINAL

Una vez tengas el video:
- **Formato:** MP4 H.264 (compatible con todos los browsers)
- **Resolución:** 1920×1080
- **Peso target:** <8 MB (comprimir con HandBrake / FFmpeg si pesa más)
- **Duración:** 25-35s
- **Subir a:** Cloudinary (gratis hasta 25 GB) o el bucket de Render
- **Pegar la URL** en `apps/dashboard-ui/src/pages/DashboardPage.tsx` → prop `videoUrl` del `<HeroVideo>`

---

## 💡 PRO TIPS

1. **Generá 2-3 versiones** de cada clip y elegí la mejor (las IAs varían mucho entre runs).
2. **Color grading final** en DaVinci Resolve gratis para uniformar todos los clips.
3. **Transiciones suaves** entre clips: fade-through-white o match-cut.
4. **Loop seamless**: el último frame del clip 5 debe ser similar al primer frame del clip 1 para que loopée infinito en el hero.
5. **Audio fade-out** al final para que se mezcle bien con un loop.
