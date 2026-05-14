import { useCallback, useRef } from 'react';

import { useStreams } from 'contexts/streams';
import { getAudioMixer } from 'services/audioMixer';
import { getMicrophoneStream } from 'services/mediaDevices';

const useMicrophone = (deviceId: string, enabled: boolean) => {
  if (!enabled) {
    deviceId = '';
  }

  const { microphoneStream, setMicrophoneStream } = useStreams();

  const microphoneStreamRef = useRef(microphoneStream);
  microphoneStreamRef.current = microphoneStream;

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
          newStream = await getMicrophoneStream(deviceId);
        } catch (err) {
          console.warn('useMicrophone: failed to acquire microphone', err);
          return;
        }
      }

      const oldStream = microphoneStreamRef.current;

      // Hot-swap the mixer first so the recording's audio destination never
      // sees a gap. The mixer's output track stays the same instance.
      getAudioMixer().setMicrophoneStream(newStream);
      setMicrophoneStream(newStream);

      // Safe to release the old device now — the recording graph no longer
      // depends on it.
      oldStream?.getTracks().forEach((track) => track.stop());
    },
    [setMicrophoneStream],
  );
};

export default useMicrophone;
