import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { useI18n } from 'contexts/i18n';
import { Layout, useLayout } from 'contexts/layout';

import ScreenAndCameraIcon from './icons/ScreenAndCameraIcon';
import ScreenOnlyIcon from './icons/ScreenOnlyIcon';

import styles from './LayoutSwitcher.module.css';

const LayoutSwitcher = () => {
  const { layout, setLayout } = useLayout();
  const { t } = useI18n();

  return (
    <ToggleButtonGroup
      className={styles.root}
      exclusive
      value={layout}
      onChange={(_, layout: Layout | null) => {
        if (layout !== null) {
          setLayout(layout);
        }
      }}
    >
      <ToggleButton value="screenOnly">
        <ScreenOnlyIcon />
        {t('layout.screenOnly')}
      </ToggleButton>
      <ToggleButton value="screenAndCamera">
        <ScreenAndCameraIcon />
        {t('layout.screenAndCamera')}
      </ToggleButton>
    </ToggleButtonGroup>
  );
};

export default LayoutSwitcher;
