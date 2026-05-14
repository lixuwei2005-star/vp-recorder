import PresentToAllIcon from '@mui/icons-material/PresentToAll';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { useI18n } from 'contexts/i18n';
import { useScreenshare } from 'contexts/screenshare';

import styles from './Placeholder.module.css';

const Placeholder = () => {
  const { startScreenshare } = useScreenshare();
  const { t } = useI18n();

  return (
    <div className={styles.root} data-mui-color-scheme="light">
      <Typography
        className={styles.title}
        variant="h5"
        color="secondary.contrastText"
      >
        {t('app.recordYourScreen')}
      </Typography>
      <Button className={styles.cta} startIcon={<PresentToAllIcon />} onClick={startScreenshare}>
        {t('app.shareScreen')}
      </Button>
    </div>
  );
};

export default Placeholder;
