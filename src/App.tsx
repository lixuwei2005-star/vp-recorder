import cx from 'classnames';

import Footer from 'components/Footer';
import LayoutSwitcher from 'components/LayoutSwitcher';
import PiPWindow from 'components/PiPWindow';
import { Teleprompter } from 'components/Teleprompter/Teleprompter';
import VideoStreams from 'components/VideoStreams';
import { useCameraFraming } from 'contexts/cameraFraming';
import { useLayout } from 'contexts/layout';
import { useMediaDevices } from 'contexts/mediaDevices';
import { usePictureInPicture } from 'contexts/pictureInPicture';
import { useStreams } from 'contexts/streams';
import { useTeleprompter } from 'contexts/teleprompter';
import useCameraPositionShortcuts from 'hooks/useCameraPositionShortcuts';
import useFaceTracking from 'hooks/useFaceTracking';
import useKeyboardShorcut from 'hooks/useKeyboardShortcut';

import styles from './App.module.css';

const App = () => {
  const { layout } = useLayout();
  const { cameraStream, screenshareStream } = useStreams();
  const { pipWindow } = usePictureInPicture();
  const { enabled: teleprompterEnabled, setEnabled: setTeleprompterEnabled } =
    useTeleprompter();
  const {
    cameraEnabled,
    microphoneEnabled,
    setCameraEnabled,
    setMicrophoneEnabled,
  } = useMediaDevices();

  useKeyboardShorcut('e', () => setCameraEnabled(!cameraEnabled));
  useKeyboardShorcut('d', () => setMicrophoneEnabled(!microphoneEnabled));
  useCameraPositionShortcuts();

  const { framingMode, setFramingMode, setFaceTrackingStatus } =
    useCameraFraming();
  useFaceTracking({
    enabled: framingMode === 'auto',
    cameraStream,
    onStatusChange: setFaceTrackingStatus,
    // If MediaPipe or the model fail to load, bail out to manual mode so
    // the user isn't stuck with a non-functioning auto toggle.
    onError: (err) => {
      // eslint-disable-next-line no-console
      console.warn('[FaceTrack] error, falling back to manual:', err);
      setFramingMode('manual');
    },
  });

  return (
    <div
      className={cx(styles.root, {
        [styles.placeholder]:
          layout === 'cameraOnly' ? !cameraStream : !screenshareStream,
      })}
    >
      <main className={styles.main}>
        <VideoStreams />
        <LayoutSwitcher />
      </main>
      <Footer />
      {teleprompterEnabled && !pipWindow && (
        <Teleprompter
          variant="floating"
          onClose={() => setTeleprompterEnabled(false)}
        />
      )}
      {pipWindow && <PiPWindow pipWindow={pipWindow} />}
    </div>
  );
};

export default App;
