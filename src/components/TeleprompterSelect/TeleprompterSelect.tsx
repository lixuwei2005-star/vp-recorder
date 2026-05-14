import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import cx from 'classnames';

import { TeleprompterIcon } from 'components/ShapeSelect/icons/TeleprompterIcon';
import { useI18n } from 'contexts/i18n';
import { useTeleprompter } from 'contexts/teleprompter';

import styles from './TeleprompterSelect.module.css';

const TeleprompterSelect = () => {
  const { enabled, setEnabled } = useTeleprompter();
  const { t } = useI18n();
  const label = enabled ? t('teleprompter.hide') : t('teleprompter.show');

  return (
    <Tooltip title={label} placement="top">
      <IconButton
        className={cx(styles.button, { active: enabled })}
        onClick={() => setEnabled(!enabled)}
        aria-label={label}
        aria-pressed={enabled}
      >
        <TeleprompterIcon />
      </IconButton>
    </Tooltip>
  );
};

export default TeleprompterSelect;
