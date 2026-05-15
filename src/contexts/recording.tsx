import { createContext, useContext, useEffect, useRef, useState } from 'react';

import { RecordingModal } from 'components/RecordingModal';
import { getAudioMixer } from 'services/audioMixer';
import { composeStreams, type ComposerHandle } from 'services/composer';

import { useCameraFraming } from './cameraFraming';
import { useCameraPosition } from './cameraPosition';
import { useCameraShape } from './cameraShape';
import { useLayout } from './layout';
import { useStreams } from './streams';
import { useVirtualBackground } from './virtualBackground';

type RecordingContextType = {
  isRecording: boolean;
  isPaused: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  isModalOpen: boolean;
  closeModal: () => void;
};

const RecordingContext = createContext<RecordingContextType | undefined>(
  undefined,
);

type RecordingProviderProps = {
  children: React.ReactNode;
};

export const RecordingProvider = ({ children }: RecordingProviderProps) => {
  const { layout } = useLayout();
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const { cameraStream, screenshareStream } = useStreams();
  const { positionRef: cameraPositionRef, sizeRef: cameraSizeRef } =
    useCameraPosition();
  const { shapeRef: cameraShapeRef } = useCameraShape();
  const { framingRef: cameraFramingRef } = useCameraFraming();
  const {
    optionRef: virtualBackgroundOptionRef,
    imageElementRef: virtualBackgroundImageRef,
  } = useVirtualBackground();

  const mediaRecorder = useRef<MediaRecorder>();
  const composerHandleRef = useRef<ComposerHandle | null>(null);

  // Push camera stream changes into the live composer so toggling / switching
  // the camera mid-recording doesn't tear down the recording.
  useEffect(() => {
    if (!isRecording || !composerHandleRef.current) return;
    if (layout === 'screenOnly') return;
    composerHandleRef.current.setCameraStream(cameraStream);
  }, [cameraStream, isRecording, layout]);

  // Same idea for the screen source: when the user switches to a different
  // window/tab/monitor mid-recording, hand the new stream to the composer
  // instead of restarting the recording.
  useEffect(() => {
    if (!isRecording || !composerHandleRef.current) return;
    if (layout === 'cameraOnly') return;
    composerHandleRef.current.setScreenshareStream(screenshareStream);
  }, [screenshareStream, isRecording, layout]);

  // Guard against accidental refresh/close while a recording is active or
  // the post-recording preview still holds an un-saved blob.
  const hasUnsavedWork =
    isRecording || (isModalOpen && recordingBlob !== null);
  useEffect(() => {
    if (!hasUnsavedWork) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Legacy requirement: some browsers only show the prompt when
      // returnValue is set to a non-empty string.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedWork]);

  const startRecording = () => {
    setIsRecording(true);

    const audioMixer = getAudioMixer();
    const handle = composeStreams(
      layout === 'screenOnly' ? null : cameraStream,
      audioMixer,
      layout === 'cameraOnly' ? null : screenshareStream,
      {
        cameraPositionRef,
        cameraSizeRef,
        cameraShapeRef,
        cameraFramingRef,
        virtualBackgroundOptionRef,
        virtualBackgroundImageRef,
      },
      // The composer no longer ends naturally when the screen track ends
      // (output is camera-driven now). User stopping the OS-level screen
      // share is still a valid end-of-recording signal.
      { onScreenshareEnded: () => stopRecording() },
    );
    composerHandleRef.current = handle;

    mediaRecorder.current = new MediaRecorder(handle.outputStream, {
      mimeType: 'video/webm; codecs=vp9',
      videoBitsPerSecond: 8e6,
    });

    const chunks: Blob[] = [];

    mediaRecorder.current.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    mediaRecorder.current.onstop = () => {
      handle.outputStream
        .getVideoTracks()
        .forEach((composedTrack) => composedTrack.stop());
      handle.dispose();
      composerHandleRef.current = null;

      const blob = new Blob(chunks);

      setRecordingBlob(blob);
      setIsModalOpen(true);
    };

    mediaRecorder.current.start();
  };

  const stopRecording = () => {
    const recorder = mediaRecorder.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    setIsRecording(false);
    setIsPaused(false);
  };

  const pauseRecording = () => {
    mediaRecorder.current?.pause();
    setIsPaused(true);
  };

  const resumeRecording = () => {
    setIsPaused(false);
    mediaRecorder.current?.resume();
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setRecordingBlob(null);
  };

  return (
    <RecordingContext.Provider
      value={{
        isRecording,
        isPaused,
        startRecording,
        stopRecording,
        pauseRecording,
        resumeRecording,
        isModalOpen,
        closeModal,
      }}
    >
      {children}
      <RecordingModal
        isOpen={isModalOpen}
        onClose={closeModal}
        recordingBlob={recordingBlob}
      />
    </RecordingContext.Provider>
  );
};

export const useRecording = (): RecordingContextType => {
  const context = useContext(RecordingContext);

  if (context === undefined) {
    throw new Error('useRecording must be used within a RecordingProvider');
  }

  return context;
};
