/**
 * CLIP encoder usando @xenova/transformers (Xenova/clip-vit-base-patch32, 512d).
 * Modelo se descarga en primer uso a ~/.cache/huggingface (~150 MB).
 *
 * Lazy-load AGRESIVO: la libreria @xenova/transformers solo se importa cuando
 * realmente se necesita (primera llamada a embedImage/embedText). Asi el server
 * arranca con ~80-120MB de RAM en lugar de ~250MB+ con la libreria cargada.
 *
 * En produccion Render:
 *  - Starter $7/mo (512MB RAM): OOMea cuando se usa CLIP - NO recomendado.
 *  - Standard $25/mo (2GB): holgado. Recomendado si se procesan imagenes.
 *  - Si memoria sigue siendo bloqueo, setear REPLICATE_API_TOKEN para usar Replicate API.
 */

// Solo type imports - no traen runtime
import type { RawImage as RawImageType } from '@xenova/transformers';

const MODEL_ID = 'Xenova/clip-vit-base-patch32';
export const CLIP_DIM = 512;

// Cache singletons
let _xenova: typeof import('@xenova/transformers') | null = null;
let _vision: any = null;
let _text: any = null;
let _processor: any = null;
let _tokenizer: any = null;

/** Importa @xenova/transformers solo cuando se necesita (lazy). */
async function getXenova() {
  if (!_xenova) {
    console.log('[clip] dynamic import @xenova/transformers (lazy)...');
    _xenova = await import('@xenova/transformers');
  }
  return _xenova;
}

async function loadVision() {
  if (_vision) return _vision;
  const { AutoProcessor, CLIPVisionModelWithProjection } = await getXenova();
  console.log('[clip] loading vision encoder + processor (descarga ~150MB primera vez)...');
  _processor = await AutoProcessor.from_pretrained(MODEL_ID);
  _vision = await CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, { quantized: true });
  console.log('[clip] vision encoder ready');
  return _vision;
}

async function loadText() {
  if (_text) return _text;
  const { AutoTokenizer, CLIPTextModelWithProjection } = await getXenova();
  console.log('[clip] loading text encoder + tokenizer...');
  _tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);
  _text = await CLIPTextModelWithProjection.from_pretrained(MODEL_ID, { quantized: true });
  console.log('[clip] text encoder ready');
  return _text;
}

/** Embed image -> 512d normalized vector */
export async function embedImage(input: Buffer | string): Promise<number[]> {
  await loadVision();
  const { RawImage } = await getXenova();
  let image: RawImageType;
  if (typeof input === 'string') {
    image = await RawImage.fromURL(input);
  } else {
    const blob = new Blob([new Uint8Array(input)]);
    image = await RawImage.fromBlob(blob);
  }
  const processed = await _processor(image);
  const out = await _vision(processed);
  const emb = out.image_embeds.data as Float32Array;
  return normalize(Array.from(emb));
}

/** Embed text -> 512d normalized vector (mismo espacio que image embeddings) */
export async function embedText(text: string): Promise<number[]> {
  await loadText();
  const tokens = _tokenizer([text], { padding: true, truncation: true });
  const out = await _text(tokens);
  const emb = out.text_embeds.data as Float32Array;
  return normalize(Array.from(emb));
}

function normalize(v: number[]): number[] {
  let sum = 0;
  for (const x of v) sum += x * x;
  const norm = Math.sqrt(sum) || 1;
  return v.map((x) => x / norm);
}
