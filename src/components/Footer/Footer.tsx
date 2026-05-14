import BackgroundSelect from 'components/BackgroundSelect';
import CameraSelect from 'components/CameraSelect';
import FramingSelect from 'components/FramingSelect';
import LanguageSwitcher from 'components/LanguageSwitcher';
import MainRecordButton from 'components/MainRecordButton';
import MicLevelMeter from 'components/MicLevelMeter';
import MicrophoneSelect from 'components/MicrophoneSelect';
import PauseButton from 'components/PauseButton';
import PositionSelect from 'components/PositionSelect';
import RecordingTimer from 'components/RecordingTimer';
import ShapeSelect from 'components/ShapeSelect';
import TeleprompterSelect from 'components/TeleprompterSelect';
import { useStreams } from 'contexts/streams';

import styles from './Footer.module.css';

const Footer = () => {
  const { microphoneStream } = useStreams();
  return (
    <footer className={styles.root}>
      <div className={styles.leftSlot}>
        <LanguageSwitcher />
      </div>
      <div className={styles.recordCluster}>
        <div className={styles.timerAnchor}>
          <RecordingTimer />
        </div>
        <MainRecordButton />
        <div className={styles.pauseAnchor}>
          <PauseButton />
        </div>
      </div>
      <div className={styles.devices}>
        <PositionSelect />
        <FramingSelect />
        <BackgroundSelect />
        <TeleprompterSelect />
        <ShapeSelect />
        <MicLevelMeter stream={microphoneStream} />
        <MicrophoneSelect />
        <CameraSelect />
      </div>
    </footer>
  );
};

export default Footer;
