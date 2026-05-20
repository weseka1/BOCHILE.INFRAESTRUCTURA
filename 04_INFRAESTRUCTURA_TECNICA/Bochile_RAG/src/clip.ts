/**
 * CLIP encoder usando @xenova/transformers (Xenova/clip-vit-base-patch32, 512d).
 * Modelo se descarga en primer uso a ~/.cache/huggingface (~150 MB).
 *
 * En produccion Render:
 *  - Starter $7/mo (512MB RAM): justo, pero anda. Cold start ~30s.
 *  - Standard $25/mo (2GB): holgado.
 *  - Si memoria es bloqueo, setear REPLICATE_API_TOKEN para usar Replicate en vez.
 */
import { AutoProcessor, AutoTokenizer, CLIPVisionModelWithProjection, CLIPTextModelWithProjection, RawImage } from '@xenova/transformers';

const MODEL_ID = 'Xenova/clip-vit-base-patch32';
export const CLIP_DIM = 512;

let _vision: any = null;
let _text: any = null;
let _processor: any = null;
let _tokenizer: any = null;

async function loadVision() {
  if (_vision) return _vision;
  console.log('[clip] loading vision encoder + processor (descarga ~150MB primera vez)...');
  _processor = await AutoProcessor.from_pretrained(MODEL_ID);
  _vision = await CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, { quantized: true });
  console.log('[clip] vision encoder ready');
  return _vision;
}

async function loadText() {
  if (_text) return _text;
  console.log('[clip] loading text encoder + tokenizer...');
  _tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);
  _text = await CLIPTextModelWithProjection.from_pretrained(MODEL_ID, { quantized: true });
  console.log('[clip] text encoder ready');
  return _text;
}

/** Embed image -> 512d normalized vector */
export async function embedImage(input: Buffer | string): Promise<number[]> {
  await loadVision();
  // input puede ser Buffer (raw bytes), URL string, or path
  let image: RawImage;
  if (typeof input === 'string') {
    image = await RawImage.fromURL(input);
  } else {
    // Buffer: usar Blob
    const blob = new Blob([new Uint8Array(input)]);
    image = await RawImage.fromBlob(blob);
  }
  const processed = await _processor(image);
  const out = await _vision(processed);
  const emb = out.image_embeds.data as Float32Array;
  // Normalize L2 (Qdrant cosine needs it for stable scores)
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
