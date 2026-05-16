import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { Info } from 'lucide-react';

import { useI18n } from 'contexts/i18n';
import { showIntro } from 'services/landingRoute';

import styles from './ViewIntroButton.module.css';

const ViewIntroButton = () => {
  const { t } = useI18n();
  const label = t('footer.viewIntro');

  return (
    <Tooltip title={label} placement="top">
      <IconButton
        className={styles.button}
        onClick={showIntro}
        aria-label={label}
      >
        <Info size={20} />
      </IconButton>
    </Tooltip>
  );
};

export default ViewIntroButton;
