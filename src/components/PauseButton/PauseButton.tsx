import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

import { useI18n } from 'contexts/i18n';
import { usePictureInPicture } from 'contexts/pictureInPicture';
import { useRecording } from 'contexts/recording';

import styles from './PauseButton.module.css';

const PauseButton = () => {
  const { pipWindow } = usePictureInPicture();
  const { isRecording, isPaused, pauseRecording, resumeRecording } =
    useRecording();
  const { t } = useI18n();

  // Only show the pause control after the user has clicked Ready (PiP open).
  if (!pipWindow) return null;

  const disabled = !isRecording;
  const title = disabled
    ? t('pause.startFirst')
    : isPaused
      ? t('pause.resume')
      : t('pause.pause');

  return (
    <Tooltip title={title}>
      <span className={styles.wrapper}>
        <IconButton
          className={styles.button}
          disabled={disabled}
          onClick={() => (isPaused ? resumeRecording() : pauseRecording())}
          aria-label={isPaused ? t('pause.resumeRecording') : t('pause.pauseRecording')}
        >
          {isPaused ? <PlayArrowIcon /> : <PauseIcon />}
        </IconButton>
      </span>
    </Tooltip>
  );
};

export default PauseButton;
