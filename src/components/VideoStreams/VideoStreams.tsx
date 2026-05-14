import cx from 'classnames';
import { PointerEvent, useCallback, useRef, useState } from 'react';

import Placeholder from 'components/Placeholder';
import { useCameraShape } from 'contexts/cameraShape';
import {
  CameraPosition,
  getPresetPosition,
  PRESET_NAMES,
  SNAP_DISTANCE,
  useCameraPosition,
} from 'contexts/cameraPosition';
import { useLayout } from 'contexts/layout';
import { usePictureInPicture } from 'contexts/pictureInPicture';
import { useStreams } from 'contexts/streams';
import useVideoSource from 'hooks/useVideoSource';
import {
  CAMERA_BORDER_RADIUS,
  CAMERA_HEIGHT,
  CAMERA_WIDTH,
} from 'services/composer';
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

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

const VideoStreams = () => {
  const { layout } = useLayout();
  const { cameraStream, screenshareStream } = useStreams();
  const { pipWindow } = usePictureInPicture();
  // When the PiP window is open, it owns the camera <video>. Avoid binding the
  // same MediaStream here too — two <video> elements means two decoders.
  const updateCameraSource = useVideoSource(pipWindow ? null : cameraStream);
  const updateScreenshareSource = useVideoSource(screenshareStream);
  const [screenshareSize, setScreenshareSize] =
    useState<ScreenshareSize | null>(null);
  const { isCircle } = useCameraShape();
  const { position, setPosition } = useCameraPosition();

  const dragRef = useRef<DragState | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  if (!screenshareStream && screenshareSize) {
    setScreenshareSize(null);
  }
  const screenshareWidth = screenshareSize?.width ?? 1920;
  const screenshareHeight = screenshareSize?.height ?? 1080;

  const sizeFracX = CAMERA_WIDTH / screenshareWidth;
  const sizeFracY = CAMERA_HEIGHT / screenshareHeight;

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLVideoElement>) => {
      if (event.button !== 0) return;
      const target = event.currentTarget;
      const parent = target.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      target.setPointerCapture(event.pointerId);
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startPos: position,
        containerWidth: rect.width,
        containerHeight: rect.height,
      };
      setIsDragging(true);
      event.preventDefault();
    },
    [position],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLVideoElement>) => {
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

  const endDrag = useCallback((event: PointerEvent<HTMLVideoElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setIsDragging(false);
  }, []);

  return (
    <>
      {screenshareStream || layout === 'cameraOnly' ? (
        <video
          className={cx(styles.mainStream, {
            [styles.cameraStream]: layout === 'cameraOnly',
            [styles.circle]: layout === 'cameraOnly' && isCircle,
          })}
          ref={
            layout === 'cameraOnly'
              ? updateCameraSource
              : updateScreenshareSource
          }
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
            if (layout !== 'cameraOnly') {
              setScreenshareSize({
                width: event.currentTarget.videoWidth,
                height: event.currentTarget.videoHeight,
              });
            }
          }}
        />
      ) : (
        <Placeholder />
      )}

      {/*
        If the screenshare stream is defined but its size hasn't been retrieved yet,
        we don't render the camera stream
      */}
      {layout === 'screenAndCamera' &&
        cameraStream &&
        (!screenshareStream || screenshareSize) && (
          <video
            className={cx(styles.pipStream, styles.cameraStream, {
              [styles.circle]: isCircle,
              [styles.dragging]: isDragging,
            })}
            ref={updateCameraSource}
            style={{
              left: percentage(position.x),
              top: percentage(position.y),
              width: percentage(sizeFracX),
              height: percentage(sizeFracY),
              borderRadius: isCircle
                ? '50%'
                : [
                    percentage(CAMERA_BORDER_RADIUS / CAMERA_WIDTH),
                    percentage(CAMERA_BORDER_RADIUS / CAMERA_HEIGHT),
                  ].join('/'),
            }}
            autoPlay
            playsInline
            muted
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          />
        )}
    </>
  );
};

export default VideoStreams;
