import cx from 'classnames';

import RecordButton from 'components/RecordButton';
import { useCountdown } from 'contexts/countdown';
import { useI18n } from 'contexts/i18n';
import { useLayout } from 'contexts/layout';
import { usePictureInPicture } from 'contexts/pictureInPicture';
import { useRecording } from 'contexts/recording';
import { useScreenshare } from 'contexts/screenshare';

import styles from './MainRecordButton.module.css';

const MainRecordButton = () => {
  const { countingDown, setCountingDown } = useCountdown();
  const { layout } = useLayout();
  const { isRecording, startRecording } = useRecording();
  const { pipWindow, requestPipWindow } = usePictureInPicture();
  const { startScreenshare } = useScreenshare();
  const { t } = useI18n();

  const isReady = !pipWindow && !isRecording;

  const ariaLabel = isRecording
    ? t('record.stop')
    : isReady
      ? t('record.ready')
      : t('record.start');

  return (
    <RecordButton
      className={cx(styles.root, {
        [styles.ready]: isReady,
        [styles.recording]: isRecording,
        [styles.countingDown]: countingDown,
      })}
      classes={{ icon: styles.icon }}
      aria-label={ariaLabel}
      onClick={async () => {
        if (countingDown) {
          return;
        }
        if (isRecording) {
          pipWindow?.close();
          return;
        }
        if (pipWindow) {
          setCountingDown(true);
          return;
        }
        if (layout === 'cameraOnly') {
          await requestPipWindow();
        } else {
          await startScreenshare();
        }
      }}
      onAnimationEnd={(event) => {
        if (event.animationName === styles.countdown) {
          if (pipWindow) {
            startRecording();
          }
          setCountingDown(false);
        }
      }}
    />
  );
};

export default MainRecordButton;
