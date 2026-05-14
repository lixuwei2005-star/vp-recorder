import {
  FilesetResolver,
  ImageSegmenter,
  type ImageSegmenterResult,
} from '@mediapipe/tasks-vision';

// Local-first, same pattern as faceDetection.ts: WASM under
// public/mediapipe-wasm/, model under public/models/. Run
// `node scripts/sync-mediapipe-assets.js` (or `npm install`) to keep these
// fresh.
const WASM_FILESET_PATH = '/mediapipe-wasm';
const MODEL_PATH = '/models/selfie_segmenter.tflite';

export type SegmenterHandle = {
  /**
   * Run segmentation on the given source. Returns a `mask` canvas the same
   * size as the segmenter's output (256×256 for the selfie segmenter) where
   * each pixel's RED channel is 0..255 — 255 means foreground (person),
   * 0 means background. Caller may upscale / blur this as needed.
   *
   * The returned canvas is owned by the handle and reused across calls; do
   * NOT retain a reference past the next segment() call.
   */
  segment(
    source: HTMLVideoElement | HTMLCanvasElement | OffscreenCanvas,
    timestampMs: number,
  ): HTMLCanvasElement | null;
  /** Mask canvas size — useful for compositing math. */
  readonly maskWidth: number;
  readonly maskHeight: number;
  close(): void;
};

let visionFilesetPromise: ReturnType<
  typeof FilesetResolver.forVisionTasks
> | null = null;

const loadVisionFileset = () => {
  if (!visionFilesetPromise) {
    visionFilesetPromise = FilesetResolver.forVisionTasks(WASM_FILESET_PATH);
  }
  return visionFilesetPromise;
};

/**
 * Creates a MediaPipe ImageSegmenter (selfie segmenter) in VIDEO mode.
 *
 * Selfie segmenter has a single class ("selfie"), so the *category* mask
 * collapses to "every pixel is class 0" regardless of input — useless for
 * binary masking. We use the *confidence* mask instead: a Float32 image
 * where each pixel is the per-pixel foreground probability ∈ [0,1]. We
 * then rasterise it into an RGBA canvas with R = round(prob * 255) so the
 * canvas can be drawn as an alpha source via globalCompositeOperation
 * 'destination-in'.
 *
 * Throws if WASM or the model fail to load — callers should catch and
 * fall back gracefully (e.g. disable virtual background).
 */
export const createSegmenter = async (): Promise<SegmenterHandle> => {
  const fileset = await loadVisionFileset();
  const segmenter = await ImageSegmenter.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: MODEL_PATH,
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    outputCategoryMask: false,
    outputConfidenceMasks: true,
  });

  let closed = false;
  // Reused per call so we don't allocate a new canvas/Uint8 every frame.
  // Sized lazily on the first result.
  let maskCanvas: HTMLCanvasElement | null = null;
  let maskCtx: CanvasRenderingContext2D | null = null;
  let maskImageData: ImageData | null = null;
  // Previous-frame mask alpha values, kept for temporal smoothing. Sized
  // lazily to maskW * maskH. Null until the first frame is produced.
  let prevAlpha: Uint8Array | null = null;
  let maskW = 0;
  let maskH = 0;

  // Motion-adaptive temporal smoothing. Fixed-α smoothing produces ghost
  // trails when the person moves (last frame's mask retains alpha at the
  // old position, blending in the OLD camera pixels at that spot). The
  // adaptive variant: large per-pixel delta between frames = motion =
  // trust the new value almost entirely; small delta = stable region =
  // smooth heavily to suppress flicker. Thresholds tuned for 256×256
  // confidence input.
  const MOTION_DELTA_HARD = 80; // ≥ this much change → no smoothing
  const MOTION_DELTA_SOFT = 25; // > this but < HARD → moderate smoothing
  const SMOOTHING_STABLE = 0.45; // new-frame weight when pixel is stable
  const SMOOTHING_MOTION_SOFT = 0.85; // new-frame weight in transition

  // Threshold remap: the raw confidence map has a wide "uncertain" band
  // around the person (0.2–0.6). Keeping that as partial-alpha lets the
  // *raw camera* leak through at the silhouette edge, which in low light
  // produces a visible black halo (the original dark room shows through
  // at half-opacity, blended with the blurred background). We compress the
  // band so anything below T_LOW becomes background, anything above T_HIGH
  // is solid foreground, and only the narrow gap is feathered. Net effect:
  // edges erode inward, halo goes away, hair/fingers still get a soft
  // transition.
  const T_LOW = 0.35;
  const T_HIGH = 0.75;
  const T_SPAN = T_HIGH - T_LOW;

  const remap = (v: number) => {
    if (v <= T_LOW) return 0;
    if (v >= T_HIGH) return 255;
    return Math.round(((v - T_LOW) / T_SPAN) * 255);
  };

  const ensureMaskCanvas = (w: number, h: number) => {
    if (!maskCanvas) {
      maskCanvas = document.createElement('canvas');
      maskCtx = maskCanvas.getContext('2d', { willReadFrequently: false });
    }
    if (maskW !== w || maskH !== h || !maskImageData) {
      maskW = w;
      maskH = h;
      maskCanvas!.width = w;
      maskCanvas!.height = h;
      maskImageData = maskCtx!.createImageData(w, h);
      // Reset temporal-smoothing buffer when the mask size changes — old
      // pixel values are no longer meaningful at the new dimensions.
      prevAlpha = null;
    }
    return { canvas: maskCanvas!, ctx: maskCtx!, imageData: maskImageData! };
  };

  // Selfie segmenter confidence mask: Float32 in [0,1], where 1 means
  // "definitely the person". We rasterise into the alpha channel of an
  // otherwise white RGBA canvas — callers consume it with
  // globalCompositeOperation 'destination-in', which uses the *alpha*
  // channel of the source, not its luminance. (Earlier we wrote the
  // confidence into RGB with alpha=255; that made destination-in keep
  // every pixel unconditionally and silently broke the masking.)
  const fillMaskFromConfidence = (
    data: Float32Array,
    w: number,
    h: number,
  ) => {
    const { canvas, ctx, imageData } = ensureMaskCanvas(w, h);
    const pixels = imageData.data;
    if (!prevAlpha || prevAlpha.length !== data.length) {
      prevAlpha = new Uint8Array(data.length);
      // First frame: no previous to blend with, write through directly.
      for (let i = 0; i < data.length; i++) {
        const byte = remap(data[i]);
        prevAlpha[i] = byte;
        const j = i * 4;
        pixels[j] = 255;
        pixels[j + 1] = 255;
        pixels[j + 2] = 255;
        pixels[j + 3] = byte;
      }
    } else {
      for (let i = 0; i < data.length; i++) {
        const byte = remap(data[i]);
        const prev = prevAlpha[i];
        const delta = byte > prev ? byte - prev : prev - byte;
        let blended: number;
        if (delta >= MOTION_DELTA_HARD) {
          // Real motion / silhouette boundary shift — trust the new value.
          blended = byte;
        } else if (delta >= MOTION_DELTA_SOFT) {
          blended = Math.round(
            byte * SMOOTHING_MOTION_SOFT + prev * (1 - SMOOTHING_MOTION_SOFT),
          );
        } else {
          // Stable region — smooth aggressively to suppress per-frame
          // mask flicker.
          blended = Math.round(
            byte * SMOOTHING_STABLE + prev * (1 - SMOOTHING_STABLE),
          );
        }
        prevAlpha[i] = blended;
        const j = i * 4;
        pixels[j] = 255;
        pixels[j + 1] = 255;
        pixels[j + 2] = 255;
        pixels[j + 3] = blended;
      }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  };

  return {
    get maskWidth() {
      return maskW;
    },
    get maskHeight() {
      return maskH;
    },
    segment(source, timestampMs) {
      if (closed) return null;
      let result: ImageSegmenterResult | null = null;
      try {
        result = segmenter.segmentForVideo(source, timestampMs);
      } catch {
        return null;
      }
      const confMasks = result?.confidenceMasks;
      const mask = confMasks?.[0];
      if (!mask) {
        result?.close?.();
        return null;
      }
      const w = mask.width;
      const h = mask.height;
      const data = mask.getAsFloat32Array();
      const canvas = fillMaskFromConfidence(data, w, h);
      // Free the result so the underlying GL texture can be reused.
      try {
        result.close?.();
      } catch {
        /* noop */
      }
      return canvas;
    },
    close() {
      if (closed) return;
      closed = true;
      try {
        segmenter.close();
      } catch {
        /* noop */
      }
      maskCanvas = null;
      maskCtx = null;
      maskImageData = null;
      prevAlpha = null;
    },
  };
};
