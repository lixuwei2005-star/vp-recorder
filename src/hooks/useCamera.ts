import { useCallback, useRef } from 'react';

import { useStreams } from 'contexts/streams';
import { getCameraStream } from 'services/mediaDevices';

const useCamera = (deviceId: string, enabled: boolean) => {
  if (!enabled) {
    deviceId = '';
  }

  const { cameraStream, setCameraStream } = useStreams();

  const cameraStreamRef = useRef(cameraStream);
  cameraStreamRef.current = cameraStream;

  const deviceIdRef = useRef(deviceId);
  deviceIdRef.current = deviceId;

  return useCallback(
    async (deviceId: string, enabled: boolean) => {
      if (!enabled) {
        deviceId = '';
      }
      if (deviceId === deviceIdRef.current) {
        return;
      }

      let newStream: MediaStream | null = null;
      if (deviceId) {
        try {
          newStream = await getCameraStream(deviceId);
        } catch (err) {
          console.warn('useCamera: failed to acquire camera', err);
          return;
        }
      }

      const oldStream = cameraStreamRef.current;

      // Publish new stream first so the recording composer & previews
      // hot-swap onto it; only then release the old device.
      setCameraStream(newStream);

      oldStream?.getTracks().forEach((track) => track.stop());
    },
    [setCameraStream],
  );
};

export default useCamera;
