import { createContext, useContext, useRef } from 'react';

import { useLayout } from './layout';
import { usePictureInPicture } from './pictureInPicture';
import { useRecording } from './recording';
import { useStreams } from './streams';

type ScreenshareContextType = {
  startScreenshare: () => Promise<void>;
  switchScreenshare: () => Promise<void>;
};

const ScreenshareContext = createContext<ScreenshareContextType | undefined>(
  undefined,
);

type ScreenshareProviderProps = {
  children: React.ReactNode;
};

export const ScreenshareProvider = ({ children }: ScreenshareProviderProps) => {
  const { screenshareStream, setScreenshareStream } = useStreams();
  const screenshareStreamRef = useRef(screenshareStream);
  screenshareStreamRef.current = screenshareStream;

  const { layout } = useLayout();
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const { isRecording } = useRecording();
  const isRecordingRef = useRef(isRecording);
  isRecordingRef.current = isRecording;

  const { pipWindow, requestPipWindow } = usePictureInPicture();
  const pipWindowRef = useRef(pipWindow);
  pipWindowRef.current = pipWindow;

  const attachEndedHandler = (stream: MediaStream) => {
    stream.getVideoTracks()[0].onended = () => {
      setScreenshareStream(null);
      if (isRecordingRef.current && layoutRef.current !== 'cameraOnly') {
        pipWindowRef.current?.close();
      }
    };
  };

  const startScreenshare = async () => {
    if (!pipWindowRef.current) {
      pipWindowRef.current = await requestPipWindow();
    }
    if (screenshareStream) {
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      attachEndedHandler(stream);
      setScreenshareStream(stream);
    } catch {
      // Happens when the user aborts the screenshare. Close the PiP window
      // when the layout needs a screen — both during an active recording, and
      // at the initial Ready step (otherwise the next click would start a
      // countdown and record without any screen stream).
      if (layoutRef.current !== 'cameraOnly') {
        pipWindowRef.current?.close();
      }
    }
  };

  // Open the picker again, replacing the existing stream. Cancelling the
  // picker leaves the current screenshare untouched (so the user can dismiss
  // by accident without dropping their recording).
  const switchScreenshare = async () => {
    let nextStream: MediaStream;
    try {
      nextStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
    } catch {
      return;
    }
    const previous = screenshareStreamRef.current;
    // Detach the old onended BEFORE stopping, otherwise stopping the track
    // fires the cleanup that would close the PiP window / drop the stream.
    if (previous) {
      previous.getVideoTracks().forEach((t) => {
        t.onended = null;
      });
    }
    attachEndedHandler(nextStream);
    setScreenshareStream(nextStream);
    // Stop old tracks last so the composer's hot-swap (driven by the state
    // change above) has a chance to attach to the new track first.
    if (previous) {
      previous.getTracks().forEach((t) => t.stop());
    }
  };

  return (
    <ScreenshareContext.Provider value={{ startScreenshare, switchScreenshare }}>
      {children}
    </ScreenshareContext.Provider>
  );
};

export const useScreenshare = (): ScreenshareContextType => {
  const context = useContext(ScreenshareContext);

  if (context === undefined) {
    throw new Error('useScreenshare must be used within a ScreenshareProvider');
  }

  return context;
};
