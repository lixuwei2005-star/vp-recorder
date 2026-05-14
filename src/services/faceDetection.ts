import {
  FaceDetector,
  FilesetResolver,
  type Detection,
} from '@mediapipe/tasks-vision';

// Local-first: both the WASM runtime and the .tflite model are served from
// public/ so no network round-trip is required at runtime. WASM files are
// copied from node_modules/@mediapipe/tasks-vision/wasm into
// public/mediapipe-wasm; the model is downloaded once from the MediaPipe
// public bucket into public/models/.
const WASM_FILESET_PATH = '/mediapipe-wasm';
const MODEL_PATH = '/models/blaze_face_short_range.tflite';

export type FaceBBox = {
  /** Normalised x of bbox top-left, 0..1 of source image width. */
  x: number;
  /** Normalised y of bbox top-left, 0..1 of source image height. */
  y: number;
  /** Normalised width, 0..1. */
  width: number;
  /** Normalised height, 0..1. */
  height: number;
  /** Detection confidence as reported by MediaPipe, if any. */
  score?: number;
};

/**
 * Pick the largest detection by bbox area. The closest face is almost always
 * what the user wants centered (i.e. the speaker, not a face on a wall poster
 * behind them).
 */
const pickLargest = (
  detections: Detection[],
  imageW: number,
  imageH: number,
): FaceBBox | null => {
  let best: FaceBBox | null = null;
  let bestArea = 0;
  for (const det of detections) {
    const box = det.boundingBox;
    if (!box) continue;
    // Per MediaPipe docs, originX/originY/width/height are in input pixel
    // coordinates. We normalise so callers don't have to track image dims.
    const x = box.originX / imageW;
    const y = box.originY / imageH;
    const w = box.width / imageW;
    const h = box.height / imageH;
    const area = w * h;
    if (area > bestArea) {
      bestArea = area;
      best = {
        x,
        y,
        width: w,
        height: h,
        score: det.categories?.[0]?.score,
      };
    }
  }
  return best;
};

export type FaceDetectorHandle = {
  detect(
    source: HTMLVideoElement | HTMLCanvasElement | OffscreenCanvas,
    timestampMs: number,
  ): FaceBBox | null;
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
 * Creates a MediaPipe FaceDetector running in VIDEO mode. The returned handle
 * exposes `detect()` for per-frame use and `close()` for teardown. Throws if
 * the WASM or model fail to load — callers should catch and fall back to
 * manual framing.
 */
export const createFaceDetector = async (): Promise<FaceDetectorHandle> => {
  const fileset = await loadVisionFileset();
  const detector = await FaceDetector.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: MODEL_PATH,
      // GPU delegate is faster but not always available; MediaPipe falls back
      // internally if GPU init fails.
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    minDetectionConfidence: 0.5,
  });

  let closed = false;

  return {
    detect(source, timestampMs) {
      if (closed) return null;
      const result = detector.detectForVideo(source, timestampMs);
      const imageW =
        source instanceof HTMLVideoElement
          ? source.videoWidth || source.width || 1
          : source.width || 1;
      const imageH =
        source instanceof HTMLVideoElement
          ? source.videoHeight || source.height || 1
          : source.height || 1;
      return pickLargest(result.detections, imageW, imageH);
    },
    close() {
      if (closed) return;
      closed = true;
      try {
        detector.close();
      } catch {
        // ignore; closing twice or on a broken handle should never throw
        // up into the React tree.
      }
    },
  };
};
