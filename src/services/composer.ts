import {
  DEFAULT_FRAMING,
  type CameraFraming,
} from 'contexts/cameraFraming';
import type { CameraPosition } from 'contexts/cameraPosition';
import type { CameraShape } from 'contexts/cameraShape';
import type { BackgroundOption } from 'contexts/virtualBackground';

import type { RecordingAudioMixer } from './audioMixer';
import type { SegmenterHandle } from './segmentation';
import {
  applyVirtualBackground,
  type BackgroundChoice,
} from './virtualBackground';

// Border radius as a fraction of the camera's smaller side. Keeps the rounded
// corners visually consistent across all camera sizes.
export const CAMERA_BORDER_RADIUS_FRAC = 0.04;

const getNonCircleCornerRadius = (camW: number, camH: number) =>
  Math.min(camW, camH) * CAMERA_BORDER_RADIUS_FRAC;

const clampCameraOrigin = (
  pos: CameraPosition,
  canvasWidth: number,
  canvasHeight: number,
  camW: number,
  camH: number,
) => {
  const maxX = Math.max(0, canvasWidth - camW);
  const maxY = Math.max(0, canvasHeight - camH);
  return {
    x: Math.min(maxX, Math.max(0, pos.x * canvasWidth)),
    y: Math.min(maxY, Math.max(0, pos.y * canvasHeight)),
  };
};

export type ComposeOptions = {
  cameraPositionRef?: { current: CameraPosition };
  cameraSizeRef?: { current: number };
  cameraShapeRef?: { current: CameraShape };
  cameraFramingRef?: { current: CameraFraming };
  /** Live mirror of the selected virtual-background option. */
  virtualBackgroundOptionRef?: { current: BackgroundOption };
  /** Decoded <img> for the 'image' background kind. */
  virtualBackgroundImageRef?: { current: HTMLImageElement | null };
};

export type ComposeCallbacks = {
  onScreenshareEnded?: () => void;
};

export type ComposerHandle = {
  outputStream: MediaStream;
  setCameraStream: (stream: MediaStream | null) => void;
  dispose: () => void;
};

/**
 * Composer-local virtual-background pipeline. Owns two scratch canvases
 * (raw camera rasterise + VB composite output) and lazy-loads a segmenter
 * separate from the preview's. The preview already loaded the segmentation
 * module by the time recording starts, so the dynamic import here is a
 * cache hit; the new segmenter handle still costs ~200–500 ms to spin up
 * on GPU, during which we fall back to raw camera frames.
 *
 * Future optimisation: share a single MediaPipe ImageSegmenter between the
 * preview hook and this composer. The selfie segmenter handles frames
 * sequentially in VIDEO mode, so callers would need to coordinate
 * timestamps (or the shared manager would need to dedupe per-frame). Out
 * of scope for v1 — running two segmenters in parallel is cheap enough
 * (~6 ms each at 720p in our measurements).
 */
type VbPipeline = {
  /**
   * Returns the surface to use as the camera image source for this frame.
   * When VB is inactive (or not yet ready), returns the raw VideoFrame.
   * Otherwise returns the composited canvas (camera with VB applied).
   */
  prepare(cameraFrame: VideoFrame): CanvasImageSource;
  close(): void;
};

const optionToChoice = (
  option: BackgroundOption,
  image: HTMLImageElement | null,
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
      if (image && image.complete) {
        return {
          kind: 'image',
          image,
          imageW: image.naturalWidth || 0,
          imageH: image.naturalHeight || 0,
        };
      }
      return { kind: 'none' };
    default:
      return { kind: 'none' };
  }
};

const createVbPipeline = (
  optionRef: { current: BackgroundOption } | undefined,
  imageRef: { current: HTMLImageElement | null } | undefined,
): VbPipeline => {
  let segmenter: SegmenterHandle | null = null;
  let loading = false;
  let cameraCanvas: OffscreenCanvas | null = null;
  let cameraCtx: OffscreenCanvasRenderingContext2D | null = null;
  let outputCanvas: OffscreenCanvas | null = null;
  let outputCtx: OffscreenCanvasRenderingContext2D | null = null;
  let closed = false;

  const ensureSegmenter = () => {
    if (segmenter || loading || closed) return;
    loading = true;
    import('./segmentation')
      .then((mod) => mod.createSegmenter())
      .then((handle) => {
        if (closed) {
          handle.close();
          return;
        }
        segmenter = handle;
      })
      .catch((err) => {
        // Surface in dev; in prod the composer simply falls back to raw
        // camera frames — recording continues, just without VB.
        console.warn('composer: segmenter failed to load', err);
      })
      .finally(() => {
        loading = false;
      });
  };

  return {
    prepare(cameraFrame) {
      if (closed) return cameraFrame;
      const option = optionRef?.current;
      if (!option || option.kind === 'none') {
        return cameraFrame;
      }
      // Kick off segmenter load on first non-none frame. Until ready, fall
      // back to raw camera so recording doesn't stutter on cold start.
      ensureSegmenter();
      if (!segmenter) return cameraFrame;

      const w = cameraFrame.displayWidth;
      const h = cameraFrame.displayHeight;
      if (!cameraCanvas) {
        cameraCanvas = new OffscreenCanvas(w, h);
        cameraCtx = cameraCanvas.getContext('2d', { alpha: false });
        outputCanvas = new OffscreenCanvas(w, h);
        outputCtx = outputCanvas.getContext('2d');
      } else if (cameraCanvas.width !== w || cameraCanvas.height !== h) {
        cameraCanvas.width = w;
        cameraCanvas.height = h;
        if (outputCanvas) {
          outputCanvas.width = w;
          outputCanvas.height = h;
        }
      }
      if (!cameraCtx || !outputCanvas || !outputCtx) return cameraFrame;

      cameraCtx.drawImage(cameraFrame, 0, 0, w, h);
      const choice = optionToChoice(option, imageRef?.current ?? null);
      applyVirtualBackground({
        cameraSource: cameraCanvas,
        cameraW: w,
        cameraH: h,
        background: choice,
        segmenter,
        timestampMs: performance.now(),
        target: outputCanvas,
        targetCtx: outputCtx,
      });
      return outputCanvas;
    },
    close() {
      if (closed) return;
      closed = true;
      if (segmenter) {
        segmenter.close();
        segmenter = null;
      }
      cameraCanvas = null;
      cameraCtx = null;
      outputCanvas = null;
      outputCtx = null;
    },
  };
};

const drawCameraFrame = (
  ctx: OffscreenCanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  cameraFrame: VideoFrame,
  options: ComposeOptions,
  vbPipeline: VbPipeline | null,
) => {
  const sizeFrac = options.cameraSizeRef?.current ?? 0.22;
  const shape: CameraShape = options.cameraShapeRef?.current ?? 'rectangle';
  const videoW = cameraFrame.displayWidth;
  const videoH = cameraFrame.displayHeight;
  const videoAspect = videoW > 0 && videoH > 0 ? videoW / videoH : 4 / 3;
  // When VB is active, swap the raw VideoFrame for the composited canvas so
  // the existing framing/shape/clip math below operates on background-
  // replaced pixels. When inactive, the pipeline returns the frame as-is.
  const cameraSource: CanvasImageSource = vbPipeline
    ? vbPipeline.prepare(cameraFrame)
    : cameraFrame;

  const camW = sizeFrac * canvasWidth;
  const camH = shape === 'rectangle' ? camW / videoAspect : camW;

  const currentPos = options.cameraPositionRef?.current ?? { x: 0, y: 0 };
  const { x: camX, y: camY } = clampCameraOrigin(
    currentPos,
    canvasWidth,
    canvasHeight,
    camW,
    camH,
  );

  const framing = options.cameraFramingRef?.current ?? DEFAULT_FRAMING;
  const { zoom, offsetX, offsetY } = framing;

  if (shape === 'rectangle') {
    const visibleW = videoW / zoom;
    const visibleH = videoH / zoom;
    const panRangeX = (videoW - visibleW) / 2;
    const panRangeY = (videoH - visibleH) / 2;
    const srcX = panRangeX * (1 + offsetX);
    const srcY = panRangeY * (1 + offsetY);

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(
      camX,
      camY,
      camW,
      camH,
      getNonCircleCornerRadius(camW, camH),
    );
    ctx.clip();
    ctx.drawImage(
      cameraSource,
      srcX,
      srcY,
      visibleW,
      visibleH,
      camX,
      camY,
      camW,
      camH,
    );
    ctx.restore();
  } else {
    // square + circle: see original implementation note in git history.
    const baseSize = Math.min(videoW, videoH);
    const srcSize = baseSize / zoom;
    const panRangeX = (videoW - srcSize) / 2;
    const panRangeY = (videoH - srcSize) / 2;
    const srcX = panRangeX * (1 + offsetX);
    const srcY = panRangeY * (1 + offsetY);

    ctx.save();
    ctx.beginPath();
    if (shape === 'circle') {
      ctx.arc(
        camX + camW / 2,
        camY + camH / 2,
        Math.min(camW, camH) / 2,
        0,
        Math.PI * 2,
      );
    } else {
      ctx.roundRect(
        camX,
        camY,
        camW,
        camH,
        getNonCircleCornerRadius(camW, camH),
      );
    }
    ctx.clip();
    ctx.drawImage(
      cameraSource,
      srcX,
      srcY,
      srcSize,
      srcSize,
      camX,
      camY,
      camW,
      camH,
    );
    ctx.restore();
  }
};

export const composeStreams = (
  initialCameraStream: MediaStream | null,
  audioMixer: RecordingAudioMixer,
  screenshareStream: MediaStream | null,
  options: ComposeOptions = {},
  callbacks: ComposeCallbacks = {},
): ComposerHandle => {
  const screenshareTrack = screenshareStream?.getVideoTracks()[0];
  const recordingGenerator = new MediaStreamTrackGenerator({ kind: 'video' });

  let disposed = false;

  const attachAudio = () => {
    const outputStream = new MediaStream([recordingGenerator]);
    const audioOutputTrack = audioMixer.getOutputTrack();
    if (audioOutputTrack) outputStream.addTrack(audioOutputTrack);
    return outputStream;
  };

  // ---- Camera-only path ----------------------------------------------------
  // No screen → camera is the sole source. UI blocks disabling the camera
  // mid-recording so a hot-swap isn't needed.
  //
  // Two sub-paths depending on virtual background at start time:
  //  (a) VB off → straight pipe (zero per-frame JS work, lowest overhead).
  //  (b) VB on  → read VideoFrame, run segment + composite, emit as new
  //               VideoFrame to the generator. Toggling VB during recording
  //               in cameraOnly mode does NOT swap pipelines; record again
  //               to pick up the change. (Matches existing "frozen at record
  //               start" semantics for layout/etc.)
  if (!screenshareTrack) {
    const initialTrack = initialCameraStream?.getVideoTracks()[0];
    const vbActiveAtStart =
      (options.virtualBackgroundOptionRef?.current?.kind ?? 'none') !== 'none';

    if (initialTrack && vbActiveAtStart) {
      const vbPipeline = createVbPipeline(
        options.virtualBackgroundOptionRef,
        options.virtualBackgroundImageRef,
      );
      const cameraProcessor = new MediaStreamTrackProcessor({
        track: initialTrack,
      });
      const reader = cameraProcessor.readable.getReader();
      const writer = recordingGenerator.writable.getWriter();
      let lastEmittedTs = -1;
      (async () => {
        try {
          while (!disposed) {
            const { done, value } = await reader.read();
            if (done) break;
            const cameraFrame = value;
            if (disposed) {
              cameraFrame.close();
              break;
            }
            // prepare() returns either the raw VideoFrame (no VB / not yet
            // loaded) or an OffscreenCanvas with VB applied.
            const surface = vbPipeline.prepare(cameraFrame);
            const ts = Math.max(cameraFrame.timestamp, lastEmittedTs + 1);
            lastEmittedTs = ts;
            try {
              const outFrame =
                surface === cameraFrame
                  ? cameraFrame
                  : new VideoFrame(surface as CanvasImageSource, {
                      timestamp: ts,
                    });
              await writer.write(outFrame);
              if (surface !== cameraFrame) {
                // Composed-frame path: close BOTH (the composed wrapper and
                // the original camera frame).
                cameraFrame.close();
              }
              // surface === cameraFrame: writer.write consumed it; closing
              // again would throw a "closed" error, which we swallow.
            } catch {
              try {
                cameraFrame.close();
              } catch {
                /* already closed */
              }
            }
          }
        } catch {
          /* reader cancelled / track ended */
        } finally {
          try {
            reader.cancel().catch(() => {});
          } catch {
            /* noop */
          }
          try {
            writer.close().catch(() => {});
          } catch {
            /* noop */
          }
          vbPipeline.close();
        }
      })();

      return {
        outputStream: attachAudio(),
        setCameraStream: () => {
          // cameraOnly path: hot-swap not supported (see UI guard).
        },
        dispose: () => {
          if (disposed) return;
          disposed = true;
          try {
            reader.cancel().catch(() => {});
          } catch {
            /* noop */
          }
          try {
            writer.close().catch(() => {});
          } catch {
            /* noop */
          }
          vbPipeline.close();
        },
      };
    }

    // VB off → zero-overhead direct pipe.
    if (initialTrack) {
      const cameraProcessor = new MediaStreamTrackProcessor({
        track: initialTrack,
      });
      cameraProcessor.readable
        .pipeTo(recordingGenerator.writable)
        .catch(() => {
          /* generator closed */
        });
    }
    return {
      outputStream: attachAudio(),
      setCameraStream: () => {
        // cameraOnly path: hot-swap not supported (see UI guard).
      },
      dispose: () => {
        disposed = true;
      },
    };
  }

  // ---- screenAndCamera (or screenOnly when initialCameraStream is null) ----
  //
  // Output cadence is driven by the **camera** track when present, because
  // hardware camera capture keeps a stable clock even when the recorder's
  // tab is backgrounded. Using requestAnimationFrame or setInterval would
  // be throttled or paused when the tab is hidden — the exact scenario this
  // app is built for (user is on another window while recording).
  //
  // Screen frames run in a separate read loop that only updates the
  // `latestScreenFrame` reference. The camera loop then pairs the freshest
  // screen frame with each new camera frame and emits a composed output.
  //
  // When no camera driver is active (e.g. camera was toggled off mid-record),
  // the screen loop falls back to emitting once per screen frame so the
  // recording keeps producing output. Pure screenOnly layout passes a null
  // camera stream up front and runs in this fallback from the start.

  const screenProcessor = new MediaStreamTrackProcessor({
    track: screenshareTrack,
  });
  const screenReader = screenProcessor.readable.getReader();
  const writer = recordingGenerator.writable.getWriter();

  const canvas = new OffscreenCanvas(0, 0);
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  if (!ctx) {
    throw new Error('Canvas API not supported');
  }

  // VB pipeline is created lazily on the first non-none frame so users on
  // 'none' pay zero overhead. The pipeline itself short-circuits when the
  // option is 'none', so it's safe to create up front; we still defer it to
  // keep the segmenter module out of the recording hot path when unused.
  let cameraVbPipeline: VbPipeline | null = null;
  const getOrCreateVbPipeline = (): VbPipeline | null => {
    if (cameraVbPipeline) return cameraVbPipeline;
    if (!options.virtualBackgroundOptionRef) return null;
    if (options.virtualBackgroundOptionRef.current.kind === 'none') return null;
    cameraVbPipeline = createVbPipeline(
      options.virtualBackgroundOptionRef,
      options.virtualBackgroundImageRef,
    );
    return cameraVbPipeline;
  };

  let latestScreenFrame: VideoFrame | undefined;

  type CameraDriver = {
    reader: ReadableStreamDefaultReader<VideoFrame>;
    cancelled: boolean;
  };
  let cameraDriver: CameraDriver | null = null;

  // Guarantee monotonically increasing timestamps on the output track. Camera
  // and screen tracks may not share a clock, so when we switch drivers we
  // could otherwise emit a frame with a timestamp earlier than the last one,
  // which the generator silently drops.
  let lastEmittedTs = -1;

  const isOutputClosed = () =>
    disposed || recordingGenerator.readyState === 'ended';

  const composeAndWrite = async (
    screenFrame: VideoFrame,
    cameraFrame: VideoFrame | undefined,
    rawTimestamp: number,
  ) => {
    if (isOutputClosed()) return;
    canvas.width = screenFrame.displayWidth;
    canvas.height = screenFrame.displayHeight;
    // drawImage(VideoFrame) rasterizes synchronously into the canvas backing
    // store. After this returns it is safe for either source frame to be
    // closed by its owning loop.
    ctx.drawImage(screenFrame, 0, 0);
    if (cameraFrame) {
      drawCameraFrame(
        ctx,
        canvas.width,
        canvas.height,
        cameraFrame,
        options,
        getOrCreateVbPipeline(),
      );
    }
    const ts = Math.max(rawTimestamp, lastEmittedTs + 1);
    lastEmittedTs = ts;
    const outFrame = new VideoFrame(canvas, { timestamp: ts });
    try {
      await writer.write(outFrame);
    } catch {
      // Writer rejected (track stopped / generator ended). Caller will stop.
      try {
        outFrame.close();
      } catch {
        /* already closed */
      }
    }
  };

  const runScreenLoop = async () => {
    try {
      while (!disposed) {
        const result = await screenReader.read();
        if (result.done) break;
        const frame = result.value;
        if (disposed) {
          frame.close();
          break;
        }
        // Close the previous held frame BEFORE replacing the reference so
        // VideoFrames don't leak.
        latestScreenFrame?.close();
        latestScreenFrame = frame;

        // Fallback driver: when no camera is producing frames, emit a
        // composed frame for every screen frame so recording keeps moving.
        if (!cameraDriver) {
          await composeAndWrite(frame, undefined, frame.timestamp);
        }
      }
    } catch {
      /* reader cancelled or screen track ended */
    } finally {
      latestScreenFrame?.close();
      latestScreenFrame = undefined;
    }
  };

  const runCameraLoop = async (driver: CameraDriver) => {
    try {
      while (!disposed && !driver.cancelled) {
        const result = await driver.reader.read();
        if (result.done) break;
        const cameraFrame = result.value;
        if (disposed || driver.cancelled) {
          cameraFrame.close();
          break;
        }
        if (!latestScreenFrame) {
          // First screen frame not arrived yet. Drop this camera frame
          // (don't compose a partial output) and wait for the next.
          cameraFrame.close();
          continue;
        }
        await composeAndWrite(
          latestScreenFrame,
          cameraFrame,
          cameraFrame.timestamp,
        );
        cameraFrame.close();
      }
    } catch {
      /* camera reader cancelled or track ended */
    } finally {
      try {
        driver.reader.cancel().catch(() => {});
      } catch {
        /* noop */
      }
    }
  };

  const startCameraDriver = (stream: MediaStream) => {
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    try {
      const processor = new MediaStreamTrackProcessor({ track });
      const driver: CameraDriver = {
        reader: processor.readable.getReader(),
        cancelled: false,
      };
      cameraDriver = driver;
      runCameraLoop(driver);
    } catch (err) {
      console.warn('composer: failed to start camera driver', err);
    }
  };

  const stopCameraDriver = () => {
    const driver = cameraDriver;
    if (!driver) return;
    cameraDriver = null;
    driver.cancelled = true;
    try {
      driver.reader.cancel().catch(() => {});
    } catch {
      /* noop */
    }
  };

  // Screen track ending is no longer the implicit recording terminator
  // (camera drives output now), so wire an explicit notification. Use
  // addEventListener so we don't clobber the screenshare context's own
  // onended handler.
  const handleScreenshareEnded = () => {
    callbacks.onScreenshareEnded?.();
  };
  screenshareTrack.addEventListener('ended', handleScreenshareEnded);

  runScreenLoop();
  if (initialCameraStream) startCameraDriver(initialCameraStream);

  const setCameraStream = (stream: MediaStream | null) => {
    stopCameraDriver();
    if (disposed) return;
    if (stream) startCameraDriver(stream);
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    screenshareTrack.removeEventListener('ended', handleScreenshareEnded);
    stopCameraDriver();
    try {
      screenReader.cancel().catch(() => {});
    } catch {
      /* noop */
    }
    try {
      writer.close().catch(() => {});
    } catch {
      /* noop */
    }
    if (cameraVbPipeline) {
      cameraVbPipeline.close();
      cameraVbPipeline = null;
    }
  };

  return { outputStream: attachAudio(), setCameraStream, dispose };
};
