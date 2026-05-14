import cx from 'classnames';
import {
  CSSProperties,
  PointerEvent,
  SyntheticEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import Placeholder from 'components/Placeholder';
import { useCameraFraming } from 'contexts/cameraFraming';
import { useI18n } from 'contexts/i18n';
import {
  getEffectiveCameraAspectRatio,
  useCameraShape,
  type CameraShape,
} from 'contexts/cameraShape';
import {
  CameraPosition,
  clampSize,
  getPresetPosition,
  PRESET_NAMES,
  SNAP_DISTANCE,
  useCameraPosition,
} from 'contexts/cameraPosition';
import { useLayout } from 'contexts/layout';
import { usePictureInPicture } from 'contexts/pictureInPicture';
import { useStreams } from 'contexts/streams';
import { useVirtualBackground } from 'contexts/virtualBackground';
import useVideoSource from 'hooks/useVideoSource';
import useVirtualBackgroundPreview from 'hooks/useVirtualBackgroundPreview';
import { percentage } from 'services/format/number';

import styles from './VideoStreams.module.css';

type ScreenshareSize = {
  width: number;
  height: number;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  startPos: CameraPosition;
  containerWidth: number;
  containerHeight: number;
};

const WHEEL_SIZE_STEP = 0.01;

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

/**
 * Computes inline width/height/left/top (as %) for the PiP camera <video>
 * element so that the source region the composer would crop —
 *
 *   rectangle: srcW = videoW/zoom, srcH = videoH/zoom
 *   square|circle: srcW = srcH = min(videoW, videoH) / zoom
 *   panRangeX = (videoW - srcW) / 2
 *   panRangeY = (videoH - srcH) / 2
 *   srcX = panRangeX * (1 + offsetX)
 *   srcY = panRangeY * (1 + offsetY)
 *
 * — is exactly the region visible inside the wrapper. We oversize the <video>
 * to videoW/srcW × videoH/srcH (as % of wrapper) and pull it left/up by
 * srcX/srcW × srcY/srcH (as %) so that the wrapper's [0, 100%] window lands
 * on [srcX, srcX+srcW] of the source.
 *
 * `mirror`: the preview renders with `transform: scaleX(-1)` on the video.
 * That flip is around the <video>'s own center, which shifts the visible
 * source region whenever offsetX != 0. Negating offsetX here cancels that
 * shift so the post-flip visible region matches the composer's crop exactly
 * (just mirrored horizontally — which is the whole point of the mirror).
 *
 * Returns null when video dimensions aren't known yet (before
 * loadedmetadata), so callers can fall back to no inline style.
 */
export function computeVideoFramingStyle(opts: {
  shape: CameraShape;
  zoom: number;
  offsetX: number;
  offsetY: number;
  videoW: number;
  videoH: number;
  mirror?: boolean;
}): { width: string; height: string; left: string; top: string } | null {
  const { shape, zoom, offsetX, offsetY, videoW, videoH, mirror = false } = opts;
  if (!videoW || !videoH || !Number.isFinite(zoom) || zoom <= 0) return null;
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
  const panRangeX = (videoW - srcW) / 2;
  const panRangeY = (videoH - srcH) / 2;
  const effOffsetX = mirror ? -offsetX : offsetX;
  const srcX = panRangeX * (1 + effOffsetX);
  const srcY = panRangeY * (1 + offsetY);
  return {
    width: `${(videoW / srcW) * 100}%`,
    height: `${(videoH / srcH) * 100}%`,
    left: `${(-srcX / srcW) * 100}%`,
    top: `${(-srcY / srcH) * 100}%`,
  };
}

const VideoStreams = () => {
  const { layout } = useLayout();
  const { cameraStream, screenshareStream } = useStreams();
  const { pipWindow } = usePictureInPicture();
  const { t } = useI18n();
  const {
    option: backgroundOption,
    imageElement,
    setOption: setBackgroundOption,
    setLoadError: setBackgroundLoadError,
  } = useVirtualBackground();
  const virtualBackgroundActive =
    backgroundOption.kind !== 'none' && !pipWindow && cameraStream != null;
  // When VB is active OR when the PiP window owns the camera <video>, suppress
  // binding the stream to the in-page <video> element. The VB pipeline drives
  // its own internal <video> for decode; the PiP window drives its own.
  const updateCameraSource = useVideoSource(
    pipWindow || virtualBackgroundActive ? null : cameraStream,
  );
  const updateScreenshareSource = useVideoSource(screenshareStream);
  const { setCanvas: setVbCanvas, videoDim: vbVideoDim } =
    useVirtualBackgroundPreview({
      enabled: virtualBackgroundActive,
      cameraStream,
      option: backgroundOption,
      imageElement,
      onError: (err) => {
        // MediaPipe failed to initialise. Fall back to 'none' and surface
        // a user-visible warning via the BackgroundSelect picker. Logs the
        // detail for diagnostics.
        // eslint-disable-next-line no-console
        console.warn('[VirtualBG] preview pipeline failed:', err);
        setBackgroundLoadError(t('bg.loadFailed'));
        setBackgroundOption({ kind: 'none' });
      },
    });
  const [screenshareSize, setScreenshareSize] =
    useState<ScreenshareSize | null>(null);
  // Camera video pixel dimensions (1280×720, etc). Needed by
  // computeVideoFramingStyle. Set from the camera <video>'s onResize event.
  const [cameraVideoDim, setCameraVideoDim] = useState<{
    w: number;
    h: number;
  } | null>(null);
  const { shape } = useCameraShape();
  const {
    position,
    setPosition,
    size,
    setSize,
    cameraAspectRatio,
    setCameraAspectRatio,
  } = useCameraPosition();
  const { framing, previewVideoRef } = useCameraFraming();

  // Wire the PiP <video> into the framing context so the face-tracking hook
  // (which lives at App level) can push width/height/left/top onto its
  // inline style each rAF without bouncing through React state.
  const attachPreviewVideo = useCallback(
    (node: HTMLVideoElement | null) => {
      previewVideoRef.current = node;
      updateCameraSource(node);
    },
    [previewVideoRef, updateCameraSource],
  );

  // Canvas variant of attachPreviewVideo. Same framing-ref handoff, but the
  // canvas does NOT need a MediaStream binding — its content is drawn by the
  // virtual-background rAF loop. We still register it with the VB hook so
  // the hook knows where to draw.
  const attachPreviewCanvas = useCallback(
    (node: HTMLCanvasElement | null) => {
      previewVideoRef.current = node;
      setVbCanvas(node);
    },
    [previewVideoRef, setVbCanvas],
  );

  const dragRef = useRef<DragState | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  if (!screenshareStream && screenshareSize) {
    setScreenshareSize(null);
  }
  const screenshareWidth = screenshareSize?.width ?? 1920;
  const screenshareHeight = screenshareSize?.height ?? 1080;

  // Effective rendered aspect ratio depends on shape (square/circle clip to 1:1).
  const effectiveAspect = getEffectiveCameraAspectRatio(shape, cameraAspectRatio);
  const sizeFracX = size;
  // sizeFracY = (cameraH_px / screenshare_H_px)
  //            = size * screenshareW / effectiveAspect / screenshareH
  const sizeFracY =
    (size * screenshareWidth) / effectiveAspect / screenshareHeight;

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const target = event.currentTarget;
      const parent = target.parentElement;
      if (!parent) return;
      const parentRect = parent.getBoundingClientRect();
      target.setPointerCapture(event.pointerId);
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startPos: position,
        containerWidth: parentRect.width,
        containerHeight: parentRect.height,
      };
      setIsDragging(true);
      event.preventDefault();
    },
    [position],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dx = (event.clientX - drag.startX) / drag.containerWidth;
      const dy = (event.clientY - drag.startY) / drag.containerHeight;
      let nextX = clamp(drag.startPos.x + dx, 0, 1 - sizeFracX);
      let nextY = clamp(drag.startPos.y + dy, 0, 1 - sizeFracY);

      if (!event.altKey) {
        for (const name of PRESET_NAMES) {
          const target = getPresetPosition(name, sizeFracX, sizeFracY);
          if (
            Math.abs(nextX - target.x) < SNAP_DISTANCE &&
            Math.abs(nextY - target.y) < SNAP_DISTANCE
          ) {
            nextX = target.x;
            nextY = target.y;
            break;
          }
        }
      }

      setPosition({ x: nextX, y: nextY });
    },
    [setPosition, sizeFracX, sizeFracY],
  );

  const endDrag = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setIsDragging(false);
  }, []);

  // React attaches onWheel as a passive listener and ignores preventDefault.
  // Bind a non-passive native listener so the page does not scroll while
  // resizing the camera. Attach to the wrapper so it works regardless of the
  // inner <video> element's reattachment cycles.
  const pipFrameRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = pipFrameRef.current;
    if (!node) return undefined;
    const onWheel = (event: globalThis.WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -WHEEL_SIZE_STEP : WHEEL_SIZE_STEP;
      setSize(clampSize(size + delta));
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      node.removeEventListener('wheel', onWheel);
    };
  }, [setSize, size, layout, cameraStream, screenshareStream, screenshareSize]);

  // The cameraOnly bare <video> still uses CSS-transform zoom (offset
  // intentionally unsupported there), so it needs --cam-zoom on its inline
  // style. PiP no longer reads any CSS vars — its framing is fully JS.
  const cameraOnlyVars: CSSProperties & Record<string, string | number> = {
    '--cam-zoom': framing.zoom,
  };

  const pipFrameStyle: CSSProperties & Record<string, string | number> = {
    left: percentage(position.x),
    top: percentage(position.y),
    width: percentage(sizeFracX),
    height: 'auto',
    '--camera-aspect-ratio':
      cameraAspectRatio > 0 ? `${cameraAspectRatio}` : '4 / 3',
  };

  // When VB is active the underlying <video> doesn't bind to the stream, so
  // its onResize never fires. Prefer the dim reported by the VB pipeline.
  const effectiveCameraVideoDim = virtualBackgroundActive
    ? vbVideoDim
    : cameraVideoDim;

  const pipVideoStyle = effectiveCameraVideoDim
    ? computeVideoFramingStyle({
        shape,
        zoom: framing.zoom,
        offsetX: framing.offsetX,
        offsetY: framing.offsetY,
        videoW: effectiveCameraVideoDim.w,
        videoH: effectiveCameraVideoDim.h,
        mirror: true,
      })
    : null;

  // Keep the global cameraAspectRatio in sync when VB is the source of
  // truth, so the PiP frame and footer sizes still match the camera.
  useEffect(() => {
    if (virtualBackgroundActive && vbVideoDim) {
      setCameraAspectRatio(vbVideoDim.w / vbVideoDim.h);
    }
  }, [virtualBackgroundActive, vbVideoDim, setCameraAspectRatio]);

  const onCameraResize = (event: SyntheticEvent<HTMLVideoElement>) => {
    const { videoWidth, videoHeight } = event.currentTarget;
    if (videoWidth > 0 && videoHeight > 0) {
      setCameraAspectRatio(videoWidth / videoHeight);
      setCameraVideoDim((prev) =>
        prev && prev.w === videoWidth && prev.h === videoHeight
          ? prev
          : { w: videoWidth, h: videoHeight },
      );
    }
  };

  const renderCameraOnly =
    layout === 'cameraOnly' && virtualBackgroundActive ? (
      <canvas
        className={cx(styles.mainStream, styles.cameraOnlyCanvas)}
        data-shape={shape}
        ref={setVbCanvas}
        style={cameraOnlyVars}
      />
    ) : null;

  return (
    <>
      {renderCameraOnly}
      {!renderCameraOnly &&
      (screenshareStream || layout === 'cameraOnly') ? (
        <video
          className={cx(styles.mainStream, {
            [styles.cameraStream]: layout === 'cameraOnly',
          })}
          data-shape={layout === 'cameraOnly' ? shape : undefined}
          ref={
            layout === 'cameraOnly'
              ? updateCameraSource
              : updateScreenshareSource
          }
          style={layout === 'cameraOnly' ? cameraOnlyVars : undefined}
          autoPlay
          playsInline
          muted
          // The 'resize' event exists on HTMLMediaElement and is exactly what we need here:
          // https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement#events
          //
          // Issue created: https://github.com/jsx-eslint/eslint-plugin-react/issues/3594
          //
          // eslint-disable-next-line react/no-unknown-property
          onResize={(event) => {
            const { videoWidth, videoHeight } = event.currentTarget;
            if (layout !== 'cameraOnly') {
              setScreenshareSize({
                width: videoWidth,
                height: videoHeight,
              });
            } else if (videoWidth > 0 && videoHeight > 0) {
              setCameraAspectRatio(videoWidth / videoHeight);
              setCameraVideoDim((prev) =>
                prev && prev.w === videoWidth && prev.h === videoHeight
                  ? prev
                  : { w: videoWidth, h: videoHeight },
              );
            }
          }}
        />
      ) : !renderCameraOnly ? (
        <Placeholder />
      ) : null}

      {/*
        If the screenshare stream is defined but its size hasn't been retrieved yet,
        we don't render the camera stream
      */}
      {layout === 'screenAndCamera' &&
        cameraStream &&
        (!screenshareStream || screenshareSize) && (
          <div
            ref={pipFrameRef}
            className={cx(styles.cameraFrame, styles.pipFrame, {
              [styles.dragging]: isDragging,
            })}
            data-shape={shape}
            style={pipFrameStyle}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {virtualBackgroundActive ? (
              <canvas
                ref={attachPreviewCanvas}
                style={pipVideoStyle ?? undefined}
              />
            ) : (
              <video
                ref={attachPreviewVideo}
                style={pipVideoStyle ?? undefined}
                autoPlay
                playsInline
                muted
                // eslint-disable-next-line react/no-unknown-property
                onResize={onCameraResize}
              />
            )}
            {pipWindow && <div className={styles.pipMovedHint}>{t('pip.movedHint')}</div>}
          </div>
        )}
    </>
  );
};

export default VideoStreams;
