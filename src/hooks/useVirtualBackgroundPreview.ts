import { useEffect, useRef, useState } from 'react';

import type { BackgroundOption } from 'contexts/virtualBackground';
import type { SegmenterHandle } from 'services/segmentation';
import {
  applyVirtualBackground,
  type BackgroundChoice,
} from 'services/virtualBackground';

// Lazy-loaded so MediaPipe vision wasm + tflite are NOT shipped to users
// who never turn virtual background on. The module is imported only when
// the user switches to a non-none option for the first time.
let segmenterModulePromise: Promise<typeof import('services/segmentation')> | null =
  null;
const loadSegmenterModule = () => {
  if (!segmenterModulePromise) {
    segmenterModulePromise = import('services/segmentation');
  }
  return segmenterModulePromise;
};

export type VirtualBackgroundPreviewStatus =
  | 'idle'
  | 'loading'
  | 'active'
  | 'error';

type Options = {
  enabled: boolean;
  cameraStream: MediaStream | null;
  option: BackgroundOption;
  /**
   * Resolved background image element (the upload, materialised from
   * dataURL). Passed in by the caller so it can be shared across consumers
   * if needed. Null when option.kind !== 'image' or not yet loaded.
   */
  imageElement?: HTMLImageElement | null;
  onStatusChange?: (status: VirtualBackgroundPreviewStatus) => void;
  onError?: (error: unknown) => void;
};

const optionToChoice = (
  option: BackgroundOption,
  imageElement: HTMLImageElement | null | undefined,
): BackgroundChoice => {
  switch (option.kind) {
    case 'none':
      return { kind: 'none' };
    case 'blur':
      return { kind: 'blur', strength: option.strength };
    case 'color':
      return { kind: 'color', color: option.color };
    case 'gradient':
      return { kind: 'gradient', gradient: option.gradient };
    case 'image':
      if (imageElement && imageElement.complete) {
        return {
          kind: 'image',
          image: imageElement,
          imageW: imageElement.naturalWidth || 0,
          imageH: imageElement.naturalHeight || 0,
        };
      }
      return { kind: 'none' };
    default:
      return { kind: 'none' };
  }
};

/**
 * Drives a single offscreen pipeline that consumes the camera stream,
 * runs MediaPipe selfie segmentation, applies the chosen background, and
 * writes the composited result into the given target canvas every frame.
 *
 * The hook is intentionally headless — the caller renders the
 * `<canvas ref={...}>` wherever the preview needs to show and passes its
 * ref via setCanvas(). Mounting a canvas without enabling the hook is a
 * no-op; the hook stays idle.
 */
const useVirtualBackgroundPreview = ({
  enabled,
  cameraStream,
  option,
  imageElement,
  onStatusChange,
  onError,
}: Options) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Live mirrors so the rAF loop can read latest values without retriggering.
  const optionRef = useRef<BackgroundOption>(option);
  optionRef.current = option;
  const imageRef = useRef<HTMLImageElement | null | undefined>(imageElement);
  imageRef.current = imageElement;
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // The video pixel dimensions, surfaced so consumers can compute framing
  // styles for the canvas the same way they would for the underlying video.
  const [videoDim, setVideoDim] = useState<{ w: number; h: number } | null>(
    null,
  );

  const setCanvas = (node: HTMLCanvasElement | null) => {
    canvasRef.current = node;
  };

  useEffect(() => {
    if (!enabled || !cameraStream) {
      onStatusChangeRef.current?.('idle');
      return undefined;
    }

    let cancelled = false;
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.srcObject = cameraStream;
    const onResize = () => {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (w > 0 && h > 0) setVideoDim({ w, h });
    };
    video.addEventListener('resize', onResize);

    let segmenter: SegmenterHandle | null = null;
    let rafHandle: number | null = null;
    let lastStatus: VirtualBackgroundPreviewStatus = 'idle';

    const setStatus = (s: VirtualBackgroundPreviewStatus) => {
      if (s === lastStatus) return;
      lastStatus = s;
      onStatusChangeRef.current?.(s);
    };

    const cleanup = () => {
      cancelled = true;
      if (rafHandle != null) {
        cancelAnimationFrame(rafHandle);
        rafHandle = null;
      }
      if (segmenter) {
        segmenter.close();
        segmenter = null;
      }
      try {
        video.pause();
      } catch {
        /* noop */
      }
      video.removeEventListener('resize', onResize);
      video.srcObject = null;
      setStatus('idle');
    };

    setStatus('loading');

    (async () => {
      try {
        await video.play().catch(() => {
          /* play() may reject when the tab loses focus — the rAF loop
             tolerates empty frames anyway. */
        });
        const mod = await loadSegmenterModule();
        if (cancelled) return;
        segmenter = await mod.createSegmenter();
        if (cancelled) {
          segmenter.close();
          segmenter = null;
          return;
        }
        setStatus('active');

        const tick = () => {
          if (cancelled) return;
          rafHandle = requestAnimationFrame(tick);

          const canvas = canvasRef.current;
          if (!canvas) return;
          const w = video.videoWidth;
          const h = video.videoHeight;
          if (w === 0 || h === 0) return;

          const choice = optionToChoice(optionRef.current, imageRef.current);
          applyVirtualBackground({
            cameraSource: video,
            cameraW: w,
            cameraH: h,
            background: choice,
            segmenter,
            timestampMs: performance.now(),
            target: canvas,
          });
        };

        rafHandle = requestAnimationFrame(tick);
      } catch (err) {
        if (!cancelled) {
          setStatus('error');
          onErrorRef.current?.(err);
        }
        cleanup();
      }
    })();

    return cleanup;
  }, [enabled, cameraStream]);

  return { setCanvas, videoDim };
};

export default useVirtualBackgroundPreview;
