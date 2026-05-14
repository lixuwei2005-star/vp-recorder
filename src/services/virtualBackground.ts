import type { SegmenterHandle } from './segmentation';

// Shared composition logic for the virtual background feature. Both the
// preview (a <canvas> that replaces the camera <video>) and the recording
// composer should call applyVirtualBackground() so the user sees exactly
// what gets recorded.
//
// The function draws into `targetCanvas` (or its 2D context); callers can
// then layer it like any other camera surface. Framing (zoom + offset),
// shape clipping, and mirror are NOT done here — they remain CSS / composer
// concerns, so this output is always the full camera frame at source
// resolution.

export type GradientStop = { offset: number; color: string };
export type GradientSpec = {
  type: 'linear' | 'radial';
  /**
   * For linear: angle in degrees, 0 = top→bottom, 90 = left→right.
   * For radial: ignored; gradient starts at center.
   */
  angle?: number;
  stops: GradientStop[];
};

export type BackgroundChoice =
  | { kind: 'none' }
  | { kind: 'blur'; strength?: number }
  | { kind: 'color'; color: string }
  | { kind: 'gradient'; gradient: GradientSpec }
  | { kind: 'image'; image: CanvasImageSource; imageW: number; imageH: number };

// Sources the segmenter accepts. (CanvasImageSource is broader — image
// elements are not a valid segmentation input.)
export type CameraSource =
  | HTMLVideoElement
  | HTMLCanvasElement
  | OffscreenCanvas;

export type ApplyOptions = {
  /** Camera source. Required. */
  cameraSource: CameraSource;
  cameraW: number;
  cameraH: number;
  /** What to put behind the person. */
  background: BackgroundChoice;
  /**
   * Segmenter handle. Required for any kind other than 'none'. The function
   * will call segmenter.segment(cameraSource) internally.
   */
  segmenter?: SegmenterHandle | null;
  /** rAF-compatible timestamp for the segmenter's VIDEO mode. */
  timestampMs: number;
  /** Target canvas (matched to cameraW × cameraH). */
  target: HTMLCanvasElement | OffscreenCanvas;
  /**
   * Optional pre-acquired 2D context for `target`. Saves a getContext() call
   * per frame on the hot path.
   */
  targetCtx?:
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  /**
   * Soft mask edges. Values in CSS-filter `blur(<px>)` units. ~1 px hides
   * the segmenter's stair-stepping along hair / shoulders without widening
   * the soft band enough to let the blurred-bg person-ghost bleed through.
   */
  maskFeather?: number;
};

// Default blur radius for the 'blur' background kind. We blur the camera
// itself, so the radius has to be wide enough that the *person's*
// contribution to the blurred image gets averaged across enough pixels
// that no recognisable person-ghost remains around the silhouette.
const BLUR_DEFAULT_STRENGTH = 28;

const drawCover = (
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
) => {
  // Cover-fit: scale uniformly so the image fills the target, crop overflow.
  const scale = Math.max(dstW / srcW, dstH / srcH);
  const drawW = srcW * scale;
  const drawH = srcH * scale;
  const dx = (dstW - drawW) / 2;
  const dy = (dstH - drawH) / 2;
  ctx.drawImage(source, dx, dy, drawW, drawH);
};

const drawGradient = (
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  spec: GradientSpec,
  w: number,
  h: number,
) => {
  let grad: CanvasGradient;
  if (spec.type === 'radial') {
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.hypot(w, h) / 2;
    grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  } else {
    const angle = ((spec.angle ?? 0) * Math.PI) / 180;
    // angle=0 → top→bottom: start at (w/2, 0), end at (w/2, h)
    const dx = Math.sin(angle);
    const dy = -Math.cos(angle);
    const half = Math.max(w, h) / 2;
    const cx = w / 2;
    const cy = h / 2;
    grad = ctx.createLinearGradient(
      cx - dx * half,
      cy - dy * half,
      cx + dx * half,
      cy + dy * half,
    );
  }
  for (const stop of spec.stops) {
    grad.addColorStop(stop.offset, stop.color);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
};

// Per-target scratch canvas used by the blur path's background-only-blur
// composition. WeakMap so callers don't have to manage scratch lifecycles;
// scratches are GC'd when the target goes out of scope.
type Scratch = {
  canvas: OffscreenCanvas;
  ctx: OffscreenCanvasRenderingContext2D | null;
};
const scratchByTarget = new WeakMap<
  HTMLCanvasElement | OffscreenCanvas,
  Scratch
>();

const getScratch = (
  target: HTMLCanvasElement | OffscreenCanvas,
  w: number,
  h: number,
): Scratch | null => {
  let entry = scratchByTarget.get(target);
  if (!entry) {
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    entry = { canvas, ctx };
    scratchByTarget.set(target, entry);
  }
  if (entry.canvas.width !== w) entry.canvas.width = w;
  if (entry.canvas.height !== h) entry.canvas.height = h;
  return entry;
};

/**
 * Apply the configured virtual background and write the composited frame
 * into `target`. Returns true on success, false if the caller should fall
 * back to drawing the camera directly (e.g. segmentation unavailable).
 *
 * Composition strategy:
 * - For 'blur': background-only-blur. We can't just blur the whole camera
 *   and put the person on top, because the blurred camera still contains
 *   a *blurred* version of the person — every mediocre virtual background
 *   that "halos" or "ghosts" around the speaker is doing exactly that.
 *   Instead we (1) punch the person out of the camera into a scratch
 *   canvas, (2) blur that hole-y bg (the blur kernel naturally bleeds
 *   surrounding pixels into the hole), and (3) draw the person on top.
 *   The blurred bg now contains *no* person-shaped data, so the
 *   silhouette edges blend with real background colour, not with a
 *   half-strength echo of the speaker.
 * - For 'color' / 'gradient' / 'image': simple destination-in mask +
 *   destination-over background. The bg image has no person in it, so
 *   the leak-through scenario doesn't apply.
 * - For 'none': straight copy.
 */
export const applyVirtualBackground = (opts: ApplyOptions): boolean => {
  const {
    cameraSource,
    cameraW,
    cameraH,
    background,
    segmenter,
    timestampMs,
    target,
    maskFeather = 1,
  } = opts;
  if (cameraW <= 0 || cameraH <= 0) return false;

  if (target.width !== cameraW) target.width = cameraW;
  if (target.height !== cameraH) target.height = cameraH;

  const ctx = (opts.targetCtx ??
    (target as HTMLCanvasElement).getContext('2d')) as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!ctx) return false;

  // Fast path — straight copy of the camera frame, no segmentation.
  if (background.kind === 'none' || !segmenter) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.clearRect(0, 0, cameraW, cameraH);
    ctx.drawImage(cameraSource, 0, 0, cameraW, cameraH);
    ctx.restore();
    return true;
  }

  const mask = segmenter.segment(cameraSource, timestampMs);
  if (!mask) {
    // Segmenter failed silently — fall back to camera so we don't black out.
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.clearRect(0, 0, cameraW, cameraH);
    ctx.drawImage(cameraSource, 0, 0, cameraW, cameraH);
    ctx.restore();
    return false;
  }

  // ---- Background-only blur path -------------------------------------------
  // Uses a scratch canvas to (a) punch the person out of camera, blur the
  // result onto target; (b) draw person-only on top. Avoids the "blurred
  // person ghost" artifact that plagues simpler approaches.
  if (background.kind === 'blur') {
    const scratch = getScratch(target, cameraW, cameraH);
    if (scratch && scratch.ctx) {
      const sCtx = scratch.ctx;
      const strength = background.strength ?? BLUR_DEFAULT_STRENGTH;

      // 1. scratch = camera with person punched out.
      sCtx.globalCompositeOperation = 'copy';
      sCtx.filter = 'none';
      sCtx.drawImage(cameraSource, 0, 0, cameraW, cameraH);
      // destination-out subtracts the mask's alpha from existing pixels.
      // Slight dilation (10% larger draw) widens the hole so its soft
      // edge falls *outside* the actual person silhouette — when we later
      // composite the person on top, the soft hole edge gets hidden by
      // the person.
      sCtx.globalCompositeOperation = 'destination-out';
      const padX = Math.round(cameraW * 0.03);
      const padY = Math.round(cameraH * 0.03);
      sCtx.drawImage(
        mask,
        -padX,
        -padY,
        cameraW + padX * 2,
        cameraH + padY * 2,
      );

      // 2. target = blur(scratch). Blur kernel pulls surrounding bg pixels
      //    into the hole — instead of person-shaped emptiness we get bg
      //    smoothly extrapolated across the missing area.
      ctx.save();
      ctx.globalCompositeOperation = 'copy';
      ctx.filter = `blur(${strength}px)`;
      ctx.drawImage(scratch.canvas, 0, 0, cameraW, cameraH);
      ctx.filter = 'none';

      // 3. scratch = person only (camera * mask).
      sCtx.globalCompositeOperation = 'copy';
      sCtx.filter = 'none';
      sCtx.drawImage(cameraSource, 0, 0, cameraW, cameraH);
      sCtx.globalCompositeOperation = 'destination-in';
      sCtx.filter = maskFeather > 0 ? `blur(${maskFeather}px)` : 'none';
      sCtx.drawImage(mask, 0, 0, cameraW, cameraH);
      sCtx.filter = 'none';

      // 4. target += person-on-top.
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(scratch.canvas, 0, 0, cameraW, cameraH);
      ctx.restore();

      // Leave scratch in a clean state for the next call.
      sCtx.globalCompositeOperation = 'source-over';
      return true;
    }
    // No scratch context — fall through to the legacy single-canvas
    // approach (with the person-ghost artifact). Better than black frame.
  }

  // ---- Legacy path for non-blur backgrounds (and blur fallback) ------------
  ctx.save();

  // 1. Lay down the camera as the "foreground" layer.
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.clearRect(0, 0, cameraW, cameraH);
  ctx.drawImage(cameraSource, 0, 0, cameraW, cameraH);

  // 2. Keep only the masked region (person). Mask is grayscale R channel;
  //    we use destination-in with the mask as alpha source. A light blur
  //    on the mask softens stair-steps.
  ctx.globalCompositeOperation = 'destination-in';
  ctx.filter = maskFeather > 0 ? `blur(${maskFeather}px)` : 'none';
  ctx.drawImage(mask, 0, 0, cameraW, cameraH);
  ctx.filter = 'none';

  // 3. Paint background behind the surviving person pixels.
  ctx.globalCompositeOperation = 'destination-over';
  if (background.kind === 'blur') {
    // Fallback only (scratch unavailable). Has the person-ghost halo.
    const strength = background.strength ?? BLUR_DEFAULT_STRENGTH;
    ctx.filter = `blur(${strength}px)`;
    ctx.drawImage(cameraSource, 0, 0, cameraW, cameraH);
    ctx.filter = 'none';
  } else if (background.kind === 'color') {
    ctx.fillStyle = background.color;
    ctx.fillRect(0, 0, cameraW, cameraH);
  } else if (background.kind === 'gradient') {
    drawGradient(ctx, background.gradient, cameraW, cameraH);
  } else if (background.kind === 'image') {
    drawCover(
      ctx,
      background.image,
      background.imageW || cameraW,
      background.imageH || cameraH,
      cameraW,
      cameraH,
    );
  }

  ctx.restore();
  return true;
};

/** Returns true when this background choice needs the segmenter to run. */
export const requiresSegmentation = (bg: BackgroundChoice): boolean =>
  bg.kind !== 'none';
