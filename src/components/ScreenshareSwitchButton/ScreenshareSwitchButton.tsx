import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { MonitorUp } from 'lucide-react';

import { useI18n } from 'contexts/i18n';
import { useLayout } from 'contexts/layout';
import { useScreenshare } from 'contexts/screenshare';
import { useStreams } from 'contexts/streams';

import styles from './ScreenshareSwitchButton.module.css';

const ScreenshareSwitchButton = () => {
  const { switchScreenshare } = useScreenshare();
  const { screenshareStream } = useStreams();
  const { layout } = useLayout();
  const { t } = useI18n();

  if (layout === 'cameraOnly') return null;
  if (!screenshareStream) return null;

  const label = t('screenshare.switch');

  return (
    <Tooltip title={label} placement="top">
      <IconButton
        className={styles.button}
        onClick={() => {
          void switchScreenshare();
        }}
        aria-label={label}
      >
        <MonitorUp size={20} />
      </IconButton>
    </Tooltip>
  );
};

export default ScreenshareSwitchButton;
