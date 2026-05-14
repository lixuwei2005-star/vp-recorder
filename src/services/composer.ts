import type { CameraPosition } from 'contexts/cameraPosition';

export const CAMERA_WIDTH = 240;
export const CAMERA_HEIGHT = 240;
export const CAMERA_BORDER_RADIUS = 8;

const getCameraShape = () => {
  const shape = localStorage.getItem('cameraShape');
  return shape === 'circle' ? CAMERA_WIDTH / 2 : CAMERA_BORDER_RADIUS;
};

const clampCameraOrigin = (
  pos: CameraPosition,
  canvasWidth: number,
  canvasHeight: number,
) => {
  const maxX = Math.max(0, canvasWidth - CAMERA_WIDTH);
  const maxY = Math.max(0, canvasHeight - CAMERA_HEIGHT);
  return {
    x: Math.min(maxX, Math.max(0, pos.x * canvasWidth)),
    y: Math.min(maxY, Math.max(0, pos.y * canvasHeight)),
  };
};

export type ComposeOptions = {
  cameraPositionRef?: { current: CameraPosition };
};

export const composeStreams = (
  cameraStream: MediaStream | null,
  microphoneStream: MediaStream | null,
  screenshareStream: MediaStream | null,
  options: ComposeOptions = {},
): MediaStream => {
  const cameraPositionRef = options.cameraPositionRef;
  const cameraTrack = cameraStream?.getVideoTracks()[0];
  const microphoneTrack = microphoneStream?.getAudioTracks()[0];
  const screenshareTrack = screenshareStream?.getVideoTracks()[0];

  const screenshareProcessor =
    screenshareTrack &&
    new MediaStreamTrackProcessor({
      track: screenshareTrack,
    });

  const cameraProcessor =
    cameraTrack &&
    new MediaStreamTrackProcessor({
      track: cameraTrack,
    });

  const recordingGenerator = new MediaStreamTrackGenerator({ kind: 'video' });

  if (screenshareProcessor && cameraProcessor) {
    const screenshareReader = screenshareProcessor.readable.getReader();

    const canvas = new OffscreenCanvas(0, 0);
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Canvas API not supported');
    }

    let latestScreenshareFrame: VideoFrame | undefined;
    let readingScreenshare = false;

    const transformer = new TransformStream({
      async transform(cameraFrame: VideoFrame, controller) {
        if (recordingGenerator.readyState === 'ended') {
          cameraFrame.close();
          latestScreenshareFrame?.close();
          controller.terminate();
          return;
        }

        if (latestScreenshareFrame) {
          if (!readingScreenshare) {
            // Prevents queueing unnecessary promises while awaiting for
            // the next screenshare frame
            readingScreenshare = true;

            // Awaiting the read operation would block the recording until
            // the next frame, which could come way later when the screenshare
            // is fully static
            screenshareReader.read().then(({ value: screenshareFrame }) => {
              readingScreenshare = false;

              latestScreenshareFrame?.close();
              if (recordingGenerator.readyState === 'ended') {
                screenshareFrame?.close();
              } else {
                latestScreenshareFrame = screenshareFrame;
              }
            });
          }
        } else {
          // Waits for the 1st frame to initialize the canvas dimensions
          const { value: screenshareFrame } = await screenshareReader.read();
          latestScreenshareFrame = screenshareFrame;
        }
        if (latestScreenshareFrame) {
          canvas.width = latestScreenshareFrame.displayWidth;
          canvas.height = latestScreenshareFrame.displayHeight;
          ctx.drawImage(latestScreenshareFrame, 0, 0);
        }

        const currentPos = cameraPositionRef?.current ?? { x: 0, y: 0 };
        const { x: camX, y: camY } = clampCameraOrigin(
          currentPos,
          canvas.width,
          canvas.height,
        );

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(
          camX,
          camY,
          CAMERA_WIDTH,
          CAMERA_HEIGHT,
          getCameraShape(),
        );
        ctx.clip();

        ctx.drawImage(
          cameraFrame,
          (cameraFrame.displayWidth - cameraFrame.displayHeight) / 2,
          0,
          cameraFrame.displayHeight,
          cameraFrame.displayHeight,
          camX,
          camY,
          CAMERA_WIDTH,
          CAMERA_HEIGHT,
        );

        ctx.restore();

        const newFrame = new VideoFrame(canvas, {
          timestamp: cameraFrame.timestamp,
        });
        cameraFrame.close();
        controller.enqueue(newFrame);
      },
    });

    cameraProcessor.readable
      .pipeThrough(transformer)
      .pipeTo(recordingGenerator.writable);
  } else if (cameraProcessor) {
    cameraProcessor.readable.pipeTo(recordingGenerator.writable);
  } else if (screenshareProcessor) {
    screenshareProcessor.readable.pipeTo(recordingGenerator.writable);
  }

  const recordingStream = new MediaStream([recordingGenerator]);
  if (microphoneTrack) {
    recordingStream.addTrack(microphoneTrack);
  }

  return recordingStream;
};
