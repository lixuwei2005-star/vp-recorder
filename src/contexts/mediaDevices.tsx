import { createContext, useContext, useEffect, useRef, useState } from 'react';

import useCamera from 'hooks/useCamera';
import useMicrophone from 'hooks/useMicrophone';
import {
  getAuthorizedDevices,
  getDeviceId,
  requestPermissions,
} from 'services/mediaDevices';
import * as devicePreference from 'services/preference/device';

import { useLayout } from './layout';
import { useRecording } from './recording';

type MediaDevicesContextType = {
  cameras: MediaDeviceInfo[];
  cameraId: string;
  cameraEnabled: boolean;
  microphones: MediaDeviceInfo[];
  microphoneId: string;
  microphoneEnabled: boolean;
  setPreferredCamera: (deviceId: string) => Promise<void>;
  setCameraEnabled: (enabled: boolean) => Promise<void>;
  setPreferredMicrophone: (deviceId: string) => Promise<void>;
  setMicrophoneEnabled: (enabled: boolean) => Promise<void>;
};

const MediaDevicesContext = createContext<MediaDevicesContextType | undefined>(
  undefined,
);

type MediaDevicesProviderProps = {
  children: React.ReactNode;
};

export const MediaDevicesProvider = ({
  children,
}: MediaDevicesProviderProps) => {
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState('');
  const [cameraEnabled, _setCameraEnabled] = useState(false);

  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [microphoneId, setMicrophoneId] = useState('');
  const [microphoneEnabled, _setMicrophoneEnabled] = useState(false);

  const { layout } = useLayout();
  const { isRecording } = useRecording();
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const isRecordingRef = useRef(isRecording);
  isRecordingRef.current = isRecording;

  const requestCamera = useCamera(cameraId, cameraEnabled);
  const requestMicrophone = useMicrophone(microphoneId, microphoneEnabled);

  // In cameraOnly layout the camera IS the recording's only video source.
  // The composer has no fallback driver, so we block disable / device switch
  // mid-recording. Switching layouts or stopping the recording lifts the gate.
  const blockedForCameraOnly = (nextDeviceId: string, nextEnabled: boolean) => {
    if (!isRecordingRef.current) return false;
    if (layoutRef.current !== 'cameraOnly') return false;
    if (!nextEnabled) return true;
    if (nextDeviceId !== cameraId) return true;
    return false;
  };

  useEffect(() => {
    const updateDevices = async () => {
      const { cameras, microphones } = await getAuthorizedDevices();

      const preference = devicePreference.get();
      const cameraId = getDeviceId(cameras, preference.cameraId);
      const microphoneId = getDeviceId(microphones, preference.microphoneId);

      setCameras(cameras);
      setCameraId(cameraId);
      _setCameraEnabled(preference.cameraEnabled);

      setMicrophones(microphones);
      setMicrophoneId(microphoneId);
      _setMicrophoneEnabled(preference.microphoneEnabled);

      await Promise.all([
        requestCamera(cameraId, preference.cameraEnabled),
        requestMicrophone(microphoneId, preference.microphoneEnabled),
      ]);
    };

    requestPermissions().then(updateDevices);

    navigator.mediaDevices.addEventListener('devicechange', updateDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', updateDevices);
    };
  }, [requestCamera, requestMicrophone]);

  const setPreferredCamera = async (deviceId: string) => {
    if (blockedForCameraOnly(deviceId, cameraEnabled)) return;
    devicePreference.update({ cameraId: deviceId });
    setCameraId(deviceId);
    await requestCamera(deviceId, cameraEnabled);
  };

  const setCameraEnabled = async (enabled: boolean) => {
    if (blockedForCameraOnly(cameraId, enabled)) return;
    devicePreference.update({ cameraEnabled: enabled });
    _setCameraEnabled(enabled);
    await requestCamera(cameraId, enabled);
  };

  const setPreferredMicrophone = async (deviceId: string) => {
    devicePreference.update({ microphoneId: deviceId });
    setMicrophoneId(deviceId);
    await requestMicrophone(deviceId, microphoneEnabled);
  };

  const setMicrophoneEnabled = async (enabled: boolean) => {
    devicePreference.update({ microphoneEnabled: enabled });
    _setMicrophoneEnabled(enabled);
    await requestMicrophone(microphoneId, enabled);
  };

  return (
    <MediaDevicesContext.Provider
      value={{
        cameras,
        cameraId,
        cameraEnabled,
        microphones,
        microphoneId,
        microphoneEnabled,
        setPreferredCamera,
        setCameraEnabled,
        setPreferredMicrophone,
        setMicrophoneEnabled,
      }}
    >
      {children}
    </MediaDevicesContext.Provider>
  );
};

export const useMediaDevices = (): MediaDevicesContextType => {
  const context = useContext(MediaDevicesContext);

  if (context === undefined) {
    throw new Error(
      'useMediaDevices must be used within a MediaDevicesProvider',
    );
  }

  return context;
};
