import { useEffect, useRef } from 'react';

import {
  useCameraFraming,
  type CameraFraming,
} from 'contexts/cameraFraming';
import { useCameraShape, type CameraShape } from 'contexts/cameraShape';
import {
  createFaceDetector,
  type FaceBBox,
  type FaceDetectorHandle,
} from 'services/faceDetection';

// Source frames are downsampled to this width before detection. The face
// detector model is robust at low resolution and downsampling caps WASM
// per-frame cost regardless of the underlying camera resolution.
const DETECT_WIDTH = 256;
// Detection cadence. The downstream smoothing loop runs at rAF rate, so a
// detection every 150 ms (~6.7 Hz) is plenty for tracking a roughly
// stationary speaker. Lower cadence = lower CPU cost.
const DETECT_INTERVAL_MS = 150;
// Exponential smoothing factor per rAF frame. Smaller = smoother & laggier.
// At 60 fps, 0.1 reaches ~63% of target in ~10 frames (≈170 ms).
const SMOOTHING = 0.1;
// Dead zone: if the face center is within this distance (normalised, 0..1)
// of the current crop center, don't update the target. Stops micro-jitter
// when the user sits still.
const DEAD_ZONE = 0.04;
// React state sync cadence. We update framingRef.current and the preview
// <video> DOM style every rAF (for composer + smooth preview), but only
// push to React state ~10 times/sec so the manual sliders stay in sync
// without forcing a 60 fps re-render storm.
const STATE_SYNC_INTERVAL_MS = 100;
// Tolerated "no face" duration before we surface the warning to the UI.
// Detection itself just holds the current target — no snap-back.
const NO_FACE_WARNING_MS = 1000;

type FaceTrackingStatus = 'idle' | 'loading' | 'tracking' | 'no-face' | 'error';

type Options = {
  enabled: boolean;
  cameraStream: MediaStream | null;
  onStatusChange?: (status: FaceTrackingStatus) => void;
  onError?: (error: unknown) => void;
};

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

/**
 * Computes the composer's *actual* pan range (as a fraction of source
 * width/height) for a given shape+zoom. Matches the composer math
 * (services/composer.ts) and the preview helper
 * (computeVideoFramingStyle in VideoStreams.tsx) byte-for-byte.
 *
 * For both rectangle and square/circle:
 *   srcSize_W = videoW/zoom (rect) or min(W,H)/zoom (square)
 *   panRangeX = (videoW - srcSize_W) / 2
 *   panRatioX = panRangeX / videoW = (1 - srcSize_W/videoW) / 2
 *
 * Identical relation gives panRatioY.
 *
 * cropCenterNorm(offsetX) = 0.5 + panRatioX * offsetX, so to align the
 * crop center with a detected face center:
 *   targetOffsetX = (faceCenterX - 0.5) / panRatioX
 * (clamped to [-1, 1]; defaulted to 0 when panRatio is ~0).
 */
const computePanRatios = (
  shape: CameraShape,
  zoom: number,
  videoW: number,
  videoH: number,
): { panRatioX: number; panRatioY: number } => {
  let srcW: number;
  let srcH: number;
  if (shape === 'rectangle') {
    srcW = videoW / zoom;
    srcH = videoH / zoom;
  } else {
    const base = Math.min(videoW, videoH);
    srcW = base / zoom;
    srcH = base / zoom;
  }
  const panRatioX = (videoW - srcW) / (2 * videoW);
  const panRatioY = (videoH - srcH) / (2 * videoH);
  return { panRatioX, panRatioY };
};

const computeVideoFramingDOMStyle = (
  shape: CameraShape,
  framing: CameraFraming,
  videoW: number,
  videoH: number,
): { width: string; height: string; left: string; top: string } | null => {
  if (!videoW || !videoH || framing.zoom <= 0) return null;
  let srcW: number;
  let srcH: number;
  if (shape === 'rectangle') {
    srcW = videoW / framing.zoom;
    srcH = videoH / framing.zoom;
  } else {
    const base = Math.min(videoW, videoH);
    srcW = base / framing.zoom;
    srcH = base / framing.zoom;
  }
  const panRangeX = (videoW - srcW) / 2;
  const panRangeY = (videoH - srcH) / 2;
  // Mirror compensation, same as the preview helper.
  const effOffsetX = -framing.offsetX;
  const srcX = panRangeX * (1 + effOffsetX);
  const srcY = panRangeY * (1 + framing.offsetY);
  return {
    width: `${(videoW / srcW) * 100}%`,
    height: `${(videoH / srcH) * 100}%`,
    left: `${(-srcX / srcW) * 100}%`,
    top: `${(-srcY / srcH) * 100}%`,
  };
};

/**
 * MediaPipe-driven auto framing. Runs only when `enabled` is true.
 *
 * Performance design: detection runs at ~6.7 Hz (interval), smoothing runs
 * at rAF rate. Every rAF we update `framingRef.current` (composer reads
 * this each video frame) and push width/height/left/top directly onto the
 * registered preview <video> element's style — bypassing React. We call
 * `setFraming` only every ~100 ms so the React state and the FramingSelect
 * sliders display roughly-live values without paying for 60 fps re-renders.
 *
 * When detection fails / no face for >1 s, the target offsets are held in
 * place (no snap-back) and status reports 'no-face' for the UI.
 */
const useFaceTracking = ({
  enabled,
  cameraStream,
  onStatusChange,
  onError,
}: Options) => {
  const { framingRef, setFraming, previewVideoRef } = useCameraFraming();
  const { shapeRef } = useCameraShape();

  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (!enabled || !cameraStream) {
      onStatusChangeRef.current?.('idle');
      return undefined;
    }

    let cancelled = false;
    let video: HTMLVideoElement | null = null;
    let canvas: HTMLCanvasElement | null = null;
    let ctx: CanvasRenderingContext2D | null = null;
    let detector: FaceDetectorHandle | null = null;
    let detectIntervalHandle: number | null = null;
    let rafHandle: number | null = null;
    let lastFaceAt = performance.now();
    let lastStateSyncAt = 0;
    let lastStatus: FaceTrackingStatus = 'loading';
    // Smoothed framing state — starts at whatever the framing context says,
    // then walks toward target on each rAF.
    const smoothed = { offsetX: framingRef.current.offsetX, offsetY: framingRef.current.offsetY };
    const target = { offsetX: smoothed.offsetX, offsetY: smoothed.offsetY };

    const setStatus = (s: FaceTrackingStatus) => {
      if (s === lastStatus) return;
      lastStatus = s;
      onStatusChangeRef.current?.(s);
    };

    const cleanup = () => {
      cancelled = true;
      if (detectIntervalHandle != null) {
        window.clearInterval(detectIntervalHandle);
        detectIntervalHandle = null;
      }
      if (rafHandle != null) {
        cancelAnimationFrame(rafHandle);
        rafHandle = null;
      }
      if (detector) {
        detector.close();
        detector = null;
      }
      if (video) {
        try {
          video.pause();
        } catch {
          /* ignore */
        }
        video.srcObject = null;
        video = null;
      }
      canvas = null;
      ctx = null;
      setStatus('idle');
    };

    setStatus('loading');

    (async () => {
      try {
        // Hidden <video> bound to the camera stream so we have a decoded
        // frame surface to sample from each detection tick.
        video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;
        video.srcObject = cameraStream;
        await video.play().catch(() => {
          /* play() can reject on tab focus changes; the loop tolerates
             empty frames anyway. */
        });

        canvas = document.createElement('canvas');
        canvas.width = DETECT_WIDTH;
        canvas.height = DETECT_WIDTH;
        ctx = canvas.getContext('2d', { willReadFrequently: true });

        detector = await createFaceDetector();
        if (cancelled) {
          cleanup();
          return;
        }

        const runDetection = () => {
          if (cancelled || !video || !canvas || !ctx || !detector) return;
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          if (vw === 0 || vh === 0) return;
          // Maintain aspect ratio so bbox normalisation stays correct.
          const targetH = Math.round((DETECT_WIDTH * vh) / vw);
          if (canvas.height !== targetH) canvas.height = targetH;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          let bbox: FaceBBox | null = null;
          try {
            bbox = detector.detect(canvas, performance.now());
          } catch (err) {
            onErrorRef.current?.(err);
            return;
          }

          if (!bbox) {
            // Hold current target — don't snap back to center. UI will
            // surface a warning if this persists.
            return;
          }

          lastFaceAt = performance.now();

          // Face center in normalised source coords.
          const faceCx = bbox.x + bbox.width / 2;
          const faceCy = bbox.y + bbox.height / 2;

          const shape = shapeRef.current;
          const zoom = framingRef.current.zoom;
          const { panRatioX, panRatioY } = computePanRatios(
            shape,
            zoom,
            vw,
            vh,
          );

          // Current crop center under the latest *target* offsets (not the
          // smoothed values — dead zone is about whether to re-aim, not
          // about the current visual state).
          const currentCropCx = 0.5 + panRatioX * target.offsetX;
          const currentCropCy = 0.5 + panRatioY * target.offsetY;

          if (
            Math.abs(faceCx - currentCropCx) >= DEAD_ZONE ||
            Math.abs(faceCy - currentCropCy) >= DEAD_ZONE
          ) {
            const newTargetX =
              panRatioX > 0.001
                ? clamp((faceCx - 0.5) / panRatioX, -1, 1)
                : 0;
            const newTargetY =
              panRatioY > 0.001
                ? clamp((faceCy - 0.5) / panRatioY, -1, 1)
                : 0;
            target.offsetX = newTargetX;
            target.offsetY = newTargetY;
          }
        };

        detectIntervalHandle = window.setInterval(
          runDetection,
          DETECT_INTERVAL_MS,
        );

        const smoothTick = (now: number) => {
          if (cancelled) return;
          rafHandle = requestAnimationFrame(smoothTick);

          // Exponential approach toward target.
          smoothed.offsetX += (target.offsetX - smoothed.offsetX) * SMOOTHING;
          smoothed.offsetY += (target.offsetY - smoothed.offsetY) * SMOOTHING;

          // 1. Mutate framingRef so the composer (next camera frame)
          //    sees the live smoothed value.
          framingRef.current = {
            ...framingRef.current,
            offsetX: smoothed.offsetX,
            offsetY: smoothed.offsetY,
          };

          // 2. Push the preview <video>'s inline style directly so the
          //    DOM reflects every frame, without a React render.
          const previewEl = previewVideoRef.current;
          if (previewEl && video) {
            const vw = video.videoWidth;
            const vh = video.videoHeight;
            if (vw > 0 && vh > 0) {
              const style = computeVideoFramingDOMStyle(
                shapeRef.current,
                framingRef.current,
                vw,
                vh,
              );
              if (style) {
                previewEl.style.width = style.width;
                previewEl.style.height = style.height;
                previewEl.style.left = style.left;
                previewEl.style.top = style.top;
              }
            }
          }

          // 3. Periodically flush smoothed values into React state so
          //    sliders reflect roughly-current values.
          if (now - lastStateSyncAt >= STATE_SYNC_INTERVAL_MS) {
            lastStateSyncAt = now;
            setFraming({
              offsetX: smoothed.offsetX,
              offsetY: smoothed.offsetY,
            });
          }

          // 4. Status surface: distinguish 'tracking' from 'no-face'.
          if (now - lastFaceAt > NO_FACE_WARNING_MS) {
            setStatus('no-face');
          } else {
            setStatus('tracking');
          }
        };

        rafHandle = requestAnimationFrame(smoothTick);
      } catch (err) {
        if (!cancelled) {
          setStatus('error');
          onErrorRef.current?.(err);
        }
        cleanup();
      }
    })();

    return cleanup;
  }, [enabled, cameraStream, framingRef, previewVideoRef, setFraming, shapeRef]);
};

export type { FaceTrackingStatus };
export default useFaceTracking;
